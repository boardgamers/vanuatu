import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/viewer.css"><div id="game"></div><script src="/viewer.js"></script>',
      );
    } else {
      res.setHeader(
        "Content-Type",
        req.url.endsWith(".css") ? "text/css" : "text/javascript",
      );
      res.end(await readFile(new URL("../dist" + req.url, import.meta.url)));
    }
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ headless: true });
await mkdir(".local/qa", { recursive: true });
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error(e.message);
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async () => {
      window.progress = null;
      await window.vanuatu.launchTutorial("#game", {
        chapter: "planning",
        locale: "en",
        onProgress: (p) => (window.progress = p),
        nextChapter: {
          title: "From sea to market",
          open: () => {
            window.nextOpened = true;
          },
        },
      });
    });
    await page.waitForFunction(() => window.progress?.total === 9);
    const seen = new Set();
    for (let i = 0; i < 70; i++) {
      const progress = await page.evaluate(() => window.progress);
      seen.add(progress.step);
      if (progress.completed) break;
      const next = page.locator(
        '.bgs-tutorial-playback button[title="Continue"]',
      );
      if ((await next.count()) && (await next.isEnabled())) await next.click();
      else {
        const move = page
          .locator(".turn-tray [data-move]:not(:disabled)")
          .first();
        if (await move.count()) await move.click();
        else if (await page.locator(".map-cell.legal").count())
          await page.locator(".map-cell.legal").first().click();
        else
          await page
            .locator(".action-dock .available:not(:disabled)")
            .first()
            .click();
      }
      await page.waitForTimeout(40);
    }
    assert.equal(await page.evaluate(() => window.progress.completed), true);
    assert.equal(seen.size, 10);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const controls = page.locator(".bgs-tutorial-playback button:visible");
    for (const button of await controls.all()) {
      const box = await button.boundingBox();
      assert.ok(box.height >= 36);
    }
    const gap = await page
      .locator(".bgs-tutorial-playback")
      .evaluate((el) => getComputedStyle(el).gap);
    assert.equal(gap, "8px");
    await page.screenshot({
      path: `.local/qa/tutorial-complete-${width}.png`,
      fullPage: true,
    });
    await page.locator(".bgs-tutorial-heading button").click();
    assert.equal(await page.locator(".bgs-tutorial-body").isVisible(), false);
    await page.locator(".bgs-tutorial-heading button").click();
    await page.locator(".bgs-tutorial-next-chapter").click();
    assert.equal(await page.evaluate(() => window.nextOpened), true);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "Nine tutorial steps, completion controls, next chapter and mobile/desktop layout passed.",
  );
} finally {
  await browser.close();
  server.close();
}
