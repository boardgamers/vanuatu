import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { achievementManifestSchema } from "@boardgamers/protocol/achievements";
import { achievementDefinitions } from "../engine/achievements.js";
const root = new URL("../artwork/achievements/", import.meta.url);
const hash = (b) => createHash("sha256").update(b).digest("hex");
test("art-only contract, baseline predicates and complete decoded unique exports", async () => {
  const baseline = JSON.parse(await readFile(new URL("baseline.json", root)));
  const current = achievementDefinitions();
  achievementManifestSchema.parse(current);
  assert.equal(current.revision, 2);
  assert.deepEqual(
    current.achievements.map(({ icon, ...a }) => a),
    baseline.achievements,
  );
  const source = await readFile(
    new URL("../engine/achievements.js", import.meta.url),
    "utf8",
  );
  assert.equal(
    hash(source.split("export function evaluateAchievements")[1]),
    "3ca2c00f7aff7021f7e33095a2639f5cae9e2a5ed3e7417a3e72b50ca4cf42dc",
  );
  const exports = JSON.parse(await readFile(new URL("manifest.json", root)));
  assert.equal(
    exports.sourceSha256,
    hash(
      await readFile(
        new URL("../scripts/achievement-art.mjs", import.meta.url),
      ),
    ),
  );
  assert.deepEqual(
    exports.assets.map((a) => a.id),
    current.achievements.map((a) => a.id),
  );
  assert.equal(new Set(exports.assets.map((a) => a.pngSha256)).size, 16);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const [i, a] of exports.assets.entries()) {
      assert.deepEqual(current.achievements[i].icon, {
        type: "asset",
        key: a.key,
      });
      assert.equal(a.key, `achievement-${a.id}`);
      const svg = await readFile(new URL(a.svg, root));
      const png = await readFile(new URL(a.png, root));
      assert.equal(hash(svg), a.svgSha256);
      assert.equal(hash(png), a.pngSha256);
      const dimensions = await page.evaluate(async (data) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      }, png.toString("base64"));
      assert.deepEqual(dimensions, [256, 256]);
      const boats = (svg.toString().match(/data-boat=/g) || []).length;
      const expected = {
        "duel-victory": 2,
        "trio-victory": 3,
        "quartet-victory": 4,
        "full-table-victory": 5,
      };
      assert.equal(boats, expected[a.id] || 0);
    }
  } finally {
    await browser.close();
  }
});
