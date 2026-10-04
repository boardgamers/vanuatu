import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium } from "playwright";

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
  for (const width of [390, 1440])
    for (const locale of ["en", "fr"]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/?lesson=full-round&locale=${locale}`);
      const guide = page.locator(".vanuatu-tutorial");
      const instruction = guide.locator(".bgs-tutorial-body > p").first();
      const alert = guide.locator('[role="alert"]');
      const accept = async () =>
        page.locator("dialog[open] [data-move]").first().click();
      const assertCorrection = async () => {
        await alert.waitFor({ state: "visible" });
        await page.waitForFunction(
          () => !document.querySelector("dialog[open]"),
        );
        assert.equal(await page.locator('[role="alert"]:visible').count(), 1);
        assert.equal(
          await page.locator(".vanuatu .feedback").isVisible(),
          false,
        );
        assert.equal(
          await instruction.isVisible(),
          false,
          "Do not repeat the instruction",
        );
        await page.waitForFunction(() => {
          const el = document.querySelector(".tutorial-error");
          const b = el.getBoundingClientRect();
          return b.top >= 0 && b.bottom <= innerHeight;
        });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
      };
      // A wrong choice in a modal must not leave the correction behind that modal.
      await page.locator('[data-character-choice="builder"]').click();
      await accept();
      await assertCorrection();
      await page.locator('[data-character-choice="navigator"]').click();
      await accept();
      assert.equal(await alert.isVisible(), false);
      assert.equal(await instruction.isVisible(), true);
      const saved = await page.evaluate(() =>
        localStorage.getItem("bgs:tutorial:vanuatu:full-round"),
      );
      // Match the reported rejected pair. Also reopen a collapsed tutorial guide.
      await guide.locator(".bgs-tutorial-heading button").click();
      await page.locator('[data-action="fish"]').click();
      await page.locator('[data-action="draw"]').click();
      await page.locator(".turn-tray [data-move]").click();
      await assertCorrection();
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("bgs:tutorial:vanuatu:full-round"),
        ),
        saved,
        "Rejected choices must not change the lesson history",
      );
      assert.equal(await page.locator(".draft-slot .icon-fish").count(), 1);
      assert.equal(await page.locator(".draft-slot .icon-draw").count(), 1);
      await guide.screenshot({
        path: `.local/qa/tutorial-correction-${locale}-${width}.png`,
      });
      // Keep the valid first marker and replace only the wrong second marker.
      await page.locator("[data-undo]").click();
      await page.locator('[data-action="sell"]').click();
      await page.locator(".turn-tray [data-move]").click();
      await page.waitForFunction(() =>
        document
          .querySelector(".bgs-tutorial-heading strong")
          .textContent.startsWith("3/12"),
      );
      assert.equal(await alert.isVisible(), false);
      assert.equal(await instruction.isVisible(), true);
      assert.equal(await page.locator(".draft-marker").count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(
        `${width}/${locale}: one inline correction, unchanged state, editable draft and successful retry`,
      );
    }
} finally {
  await browser.close();
  server.close();
}
