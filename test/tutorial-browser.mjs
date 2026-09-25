import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createTutorial } from "@boardgamers/protocol/tutorial";
import { chapters } from "../viewer/tutorials.js";
import { availableMoves } from "../engine/index.js";
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
  for (const [locale, sail, rule] of [
    ["fr", "Naviguer", "Si vous n’avez la majorité sur aucune action"],
    ["nl", "Varen", "Als je bij geen enkele actie de meerderheid hebt"],
  ]) {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async (locale) => {
      await window.vanuatu.launchTutorial("#game", {
        chapter: "planning",
        locale,
      });
    }, locale);
    await page.waitForFunction(
      (expected) =>
        document.querySelector('[data-action="sail"] .action-label')
          ?.textContent === expected,
      sail,
    );
    assert.ok(
      !(await page.locator(".bgs-tutorial-body").innerText()).includes(
        "You may place",
      ),
    );
    await page.locator("[data-help]").first().click();
    assert.ok((await page.locator("dialog[open]").innerText()).includes(rule));
    assert.equal(
      await page.locator("[data-language]").count(),
      0,
      "Hosted tutorials follow the language supplied by BGS",
    );
    await page.screenshot({
      path: `.local/qa/tutorial-language-${locale}.png`,
      fullPage: true,
    });
    await page.close();
  }
  const saved = new Map();
  const lesson = await createTutorial({
    ...chapters.planning,
    storage: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
      removeItem: (key) => saved.delete(key),
    },
  });
  await lesson.continue();
  for (const actions of [["sail", "buy"], ["fish", "draw"], ["build"]]) {
    const move = availableMoves(lesson.snapshot.state, 0).find(
      (m) =>
        m.type === "plan" &&
        JSON.stringify(m.actions) === JSON.stringify(actions),
    );
    assert.equal(await lesson.play(move), true);
  }
  while (lesson.snapshot.canContinue) await lesson.continue();
  const sail = availableMoves(lesson.snapshot.state, 0).find(
    (m) => m.action === "sail" && m.path.length === 1 && m.path[0] === "1,0",
  );
  assert.equal(await lesson.play(sail), true);
  while (lesson.snapshot.canContinue) await lesson.continue();
  lesson.destroy();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(
    async (entries) => {
      for (const [key, value] of entries) localStorage.setItem(key, value);
      await window.vanuatu.launchTutorial("#game", {
        chapter: "planning",
        locale: "en",
      });
    },
    [...saved],
  );
  await page.locator('[data-action="buy"]').click();
  const exports = page.locator(".turn-tray .primary[data-move]");
  assert.equal(await exports.count(), 2);
  assert.match(await exports.nth(1).innerHTML(), /Copra/);
  await page
    .locator(".sea-board")
    .screenshot({ path: ".local/qa/tutorial-export-outline.png" });
  await exports.nth(1).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".player-card.own .score b")?.textContent === "3",
  );
  assert.equal(
    await page
      .locator(".player-card.own .player-supplies > .token")
      .first()
      .locator("b")
      .innerText(),
    "0",
  );
  assert.ok(
    !(
      await page
        .locator('[data-cell="0,0"] .island-goods title')
        .allTextContents()
    ).some((text) => text.includes("Copra")),
  );
  await page.close();
  console.log(
    "Nine tutorial steps, completion controls, mobile/desktop layout, French/Dutch locale forwarding and white-resource export passed.",
  );
} finally {
  await browser.close();
  server.close();
}
