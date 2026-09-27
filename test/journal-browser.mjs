import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import * as E from "../engine/index.js";
const s = E.stripSecret(E.init(3, [], {}, "journal-browser"), 0);
s.players.forEach((p, i) => (p.name = ["Coyote", "Spock", "AlphaZero"][i]));
s.round = 2;
s.events = [
  { type: "start", p: 0 },
  { type: "character", p: 0, character: "vendor" },
  { type: "character", p: 1, character: "artist" },
  { type: "character", p: 2, character: "buyer" },
  ...[0, 1, 2].flatMap((pass) =>
    [0, 1, 2].map((p) => ({
      type: "plan",
      p,
      pass: pass + 1,
      actions: pass === 2 ? ["rest"] : [E.ACTIONS[p], "draw"],
    })),
  ),
  {
    type: "action",
    p: 0,
    action: "sell",
    fish: [1, 2],
    details: { price: 3, income: 9, character: "vendor" },
  },
  { type: "conversion", p: 0, points: 5 },
  {
    type: "action",
    p: 1,
    action: "draw",
    cell: "0,0",
    bonus: true,
    details: { points: 5, character: "artist" },
  },
  {
    type: "action",
    p: 2,
    action: "buy",
    cell: "0,0",
    good: "kava",
    bonus: true,
    details: {
      cost: 1,
      points: 4,
      character: "buyer",
      shipments: [
        { ship: 1, complete: false },
        { ship: 1, complete: true },
      ],
    },
  },
  {
    type: "action",
    p: 0,
    action: "build",
    hut: true,
    cell: "0,0",
    details: { cost: 3 },
  },
  { type: "action", p: 1, action: "rest" },
  { type: "rest", p: 1, token: "hidden" },
  { type: "discard", p: 0, action: "sail", markers: 2 },
  { type: "restBonus", p: 1, token: "both" },
  { type: "round", round: 2, first: 1 },
].map((e, i) => ({ round: 1, step: i + 1, ...e }));
const server = createServer(async (req, res) => {
  const name = req.url === "/viewer.css" ? "viewer.css" : "viewer.js";
  if (req.url === "/")
    res.end(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/viewer.css"><div id="app"></div><script src="/viewer.js"></script>',
    );
  else {
    res.setHeader(
      "Content-Type",
      name.endsWith("css") ? "text/css" : "text/javascript",
    );
    const url = name.endsWith("css")
      ? process.env.JOURNAL_CSS_URL
      : process.env.JOURNAL_JS_URL;
    if (url) {
      const response = await fetch(url);
      assert.ok(response.ok);
      res.end(Buffer.from(await response.arrayBuffer()));
    } else res.end(await readFile(new URL("../dist/" + name, import.meta.url)));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch();
await mkdir(".local/qa", { recursive: true });
try {
  for (const width of [320, 390, 1400]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      isMobile: width < 768,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate((state) => {
      window.fixture = state;
      window.host = vanuatu.launch("#app");
      host.emit("player", { index: 0 });
      host.emit("preferences", { sound: false, locale: "en" });
      host.emit("state", state);
    }, s);
    const list = page.locator(".event-list");
    assert.equal(await list.locator(".round-divider").count(), 2);
    assert.equal(await list.locator(".phase-divider").count(), 6);
    assert.equal(await list.locator(".event-plan").count(), 9);
    assert.ok(
      await list
        .locator("li")
        .evaluateAll((rows) =>
          rows.every(
            (row, i) =>
              !i ||
              row.getBoundingClientRect().top >=
                rows[i - 1].getBoundingClientRect().bottom - 1,
          ),
        ),
      "journal rows do not overlap",
    );
    assert.match(
      await list.locator(".event-plan").nth(6).innerText(),
      /Planned/,
    );
    assert.match(
      await list.locator(".event-action").first().innerText(),
      /3.*×.*3.*→.*\+9/s,
    );
    const exportRow = list
      .locator(".event-action")
      .filter({ hasText: "Export" });
    assert.match(
      await exportRow.innerText(),
      /Ship completed \(\+2 included\)/,
    );
    assert.ok(await exportRow.locator(".event-character").count());
    assert.equal(
      await list.locator(".event-rest").count(),
      0,
      "rest choice merged",
    );
    assert.equal(
      await list
        .locator(".event-action")
        .filter({ hasText: "Rest token chosen" })
        .locator(".token")
        .count(),
      0,
      "opponent choice hidden",
    );
    for (const locale of [
      "fr",
      "de",
      "pl",
      "ro",
      "el",
      "hi",
      "ru",
      "da",
      "pt-BR",
      "ko",
      "zh-TW",
      "vi",
      "it",
      "nl",
      "fa",
      "en",
    ]) {
      const c = JSON.parse(
        await readFile(
          new URL(`../viewer/localization/${locale}.json`, import.meta.url),
          "utf8",
        ),
      );
      await page.evaluate(
        (locale) => host.emit("preferences", { locale, colorBlind: true }),
        locale,
      );
      await page.waitForFunction(
        (text) =>
          document
            .querySelector(".phase-divider")
            ?.parentElement.textContent.includes(text),
        c["Marker placement"],
      );
      assert.ok(
        (await list.innerText()).includes(c["Ship completed (+2 included)"]),
      );
      assert.equal(
        await list.locator(".event-action .resource-symbol").count(),
        1,
      );
      assert.ok(
        await list.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        `${width} ${locale}: no horizontal overflow`,
      );
    }
    await page.evaluate(() => host.emit("preferences", { locale: "fr" }));
    await list.scrollIntoViewIfNeeded();
    await list
      .locator(".event-plan")
      .first()
      .evaluate((e) => {
        e.closest(".event-list").scrollTop =
          e.offsetTop - e.closest(".event-list").offsetTop - 40;
      });
    await list.screenshot({ path: `.local/qa/journal-planning-${width}.png` });
    await list
      .locator(".event-action")
      .first()
      .evaluate((e) => {
        e.closest(".event-list").scrollTop =
          e.offsetTop - e.closest(".event-list").offsetTop - 40;
      });
    await list.screenshot({ path: `.local/qa/journal-actions-${width}.png` });
    await list.evaluate((e) => (e.scrollTop = e.scrollHeight));
    await page.waitForTimeout(100);
    const bottom = await list.evaluate((e) => e.scrollTop),
      b = await list.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, -8);
    await page.waitForTimeout(100);
    const reading = await list.evaluate((e) => e.scrollTop);
    assert.ok(reading < bottom - 3, "slow wheel escapes bottom");
    await page.evaluate(() => {
      fixture.events.push({ type: "beg", p: 0, amount: 2, round: 2, step: 99 });
      host.emit("state", fixture);
    });
    await page.waitForTimeout(100);
    assert.ok(
      Math.abs((await list.evaluate((e) => e.scrollTop)) - reading) < 2,
      "new entries preserve reading position",
    );
    assert.deepEqual(errors, []);
    console.log(
      `${width}px: journal phases, sale/export outcomes, rest privacy, 16 locales and scrolling passed`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
