import test from "node:test";
import assert from "node:assert/strict";
import { init } from "../engine/index.js";
import { build } from "esbuild";
const { outputFiles } = await build({
  entryPoints: ["viewer/board.js"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  loader: { ".webp": "dataurl" },
});
const { boardSvg } = await import(
  "data:text/javascript;base64," +
    Buffer.from(outputFiles[0].text).toString("base64")
);

test("boat ownership symbols use host assignments only in colourblind mode", () => {
  const state = init(3, [], {}, "symbols");
  const before = structuredClone(state);
  const options = { t: (x) => x, colorBlind: true };
  const standard = boardSvg(state, options);
  const custom = boardSvg(state, {
    ...options,
    playerSymbols: ["star", "hexagon", "cross"],
  });
  assert.ok(custom.includes("★"));
  assert.ok(custom.includes("⬢"));
  assert.notEqual(custom, standard);
  assert.equal(
    boardSvg(state, { ...options, playerSymbols: ["<svg>"] }),
    standard,
  );
  assert.equal(
    boardSvg(state, { t: (x) => x, playerSymbols: ["star"] }),
    boardSvg(state, { t: (x) => x }),
  );
  assert.deepEqual(state, before);
});
