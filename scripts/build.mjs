import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["engine/index.js"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/engine.js",
});
for (const [entry, format] of [
  ["viewer/index.js", "iife"],
  ["viewer/preview.js", "esm"],
])
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: "browser",
    format,
    target: "es2022",
    outfile: entry.endsWith("preview.js")
      ? "dist/preview.js"
      : "dist/viewer.js",
    loader: { ".webp": "dataurl" },
    minify: true,
  });
await writeFile(
  "dist/index.html",
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vanuatu · Private beta</title><link rel="stylesheet" href="preview.css"><body><div id="game"></div><script type="module" src="preview.js"></script></body></html>',
);
