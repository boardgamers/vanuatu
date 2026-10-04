import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium } from "playwright";
import { languages } from "../viewer/localization/runtime.js";
const dist = resolve("dist");
const server = createServer(async (req, res) => {
  try {
    const path = resolve(
      dist,
      "." +
        new URL(req.url, "http://localhost").pathname.replace(
          /^\/$/,
          "/index.html",
        ),
    );
    if (!path.startsWith(dist + "/")) throw Error("Invalid path");
    res.setHeader(
      "Content-Type",
      {
        ".js": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".json": "application/json",
      }[extname(path)] ?? "application/octet-stream",
    );
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
await mkdir(".local/qa", { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const locale of Object.keys(languages)) {
    await page.goto(`${base}/?lesson=beggar&locale=${locale}`);
    const prose = page.locator(".bgs-tutorial-body > p").first();
    for (const name of ["coin", "point", "draw", "build"])
      await prose.locator(`.icon-${name}`).first().waitFor();
    for (const symbol of await prose.locator(".prose-icon").all()) {
      assert.ok(await symbol.getAttribute("aria-label"));
      assert.equal(
        await symbol.getAttribute("title"),
        await symbol.getAttribute("aria-label"),
      );
      const box = await symbol.locator("svg").boundingBox();
      assert.ok(box.width >= 20 && box.height >= 20, locale);
    }
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      locale,
    );
    if (["fr", "en"].includes(locale)) {
      await page
        .locator(".vanuatu-tutorial")
        .screenshot({ path: `.local/qa/prose-beggar-${locale}.png` });
      await page.locator(".bgs-tutorial-playback button").nth(3).click();
      await prose.locator(".icon-point").first().waitFor();
      await page.locator(".bgs-tutorial-playback button").nth(1).click();
      await prose.locator(".icon-coin").first().waitFor();
    }
  }
  await page.goto(`${base}/?new&hotseat&locale=fr`);
  await page.locator('[data-character-choice="beggar"]').click();
  const help = page.locator('dialog [data-character-help="beggar"]');
  await help.locator(".icon-coin").waitFor();
  await help.locator(".icon-point").waitFor();
  assert.equal(
    await help.locator(".icon-point").locator("..").getAttribute("aria-label"),
    "points de prospérité",
  );
  await page
    .locator("dialog")
    .screenshot({ path: ".local/qa/prose-game-fr.png" });
  await page.evaluate(() => vanuatuDemo.ui.setPreferences({ language: "en" }));
  await page.waitForFunction(
    () =>
      document
        .querySelector("dialog [data-character-help] .icon-point")
        ?.parentElement.getAttribute("aria-label") === "prosperity",
  );
  await page.locator("dialog [data-close]").click();
  await page.locator("[data-help]").first().click();
  assert.ok(await page.locator(".rules .prose-icon").count());
  assert.deepEqual(errors, []);
  console.log(
    "16-language tutorial pictograms, replay, mobile layout, accessible labels, and live game help passed.",
  );
} finally {
  await browser.close();
  server.close();
}
