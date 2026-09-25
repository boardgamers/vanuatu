import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname } from "node:path";
import * as E from "../engine/index.js";
await mkdir(".local/qa", { recursive: true });
const dist = resolve("dist");
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const path = resolve(
      dist,
      "." + (url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (!path.startsWith(dist + "/")) throw Error("Invalid path");
    const body = await readFile(path);
    res.setHeader(
      "Content-Type",
      { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" }[
        extname(path)
      ] ?? "application/octet-stream",
    );
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
server.unref();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : {}),
});
const errors = [];
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  locale: "fr-FR",
});
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base + "/?new&hotseat");
await page.waitForSelector("[data-character-choice]");
// Empty action stacks do not leave labels above their icons or shift columns.
const actionLayout = await page
  .locator(".action-dock > button")
  .evaluateAll((buttons) =>
    buttons.map((button) => {
      const icon = button
        .querySelector(".action-symbol")
        .getBoundingClientRect();
      const label = button
        .querySelector(".action-label")
        .getBoundingClientRect();
      return {
        x: label.left,
        delta: Math.abs(
          icon.top + icon.height / 2 - label.top - label.height / 2,
        ),
      };
    }),
  );
assert.ok(
  actionLayout.every(
    (b) => b.delta < 1 && Math.abs(b.x - actionLayout[0].x) < 1,
  ),
);
assert.ok(
  await page
    .locator(".resource-badge")
    .evaluateAll((badges) =>
      badges.every((badge) =>
        [...badge.querySelectorAll("g")].every(
          (g) =>
            g.querySelector("svg").getBoundingClientRect().right <
            g.querySelector("text").getBoundingClientRect().left,
        ),
      ),
    ),
);
assert.match(
  await page
    .locator(".resource-badge title")
    .allTextContents()
    .then((t) => t.join(" ")),
  /Tourists: 0\/5/,
);
// Browser language does not override the English default; an explicit choice persists.
assert.equal(
  await page.locator("[data-back] span").textContent(),
  "Back to board",
);
await page.locator("[data-help]").first().click();
await page.locator("[data-language]").selectOption("fr");
assert.equal(
  await page.locator("[data-back] span").textContent(),
  "Retour au plateau",
);
await page.reload();
await page.waitForSelector("[data-character-choice]");
assert.equal(
  await page.locator("[data-back] span").textContent(),
  "Retour au plateau",
);
await page.locator("[data-help]").first().click();
await page.locator("[data-language]").selectOption("en");
assert.equal(
  await page.locator("[data-back] span").textContent(),
  "Back to board",
);
await page.locator("[data-character-choice]").first().click();
assert.equal(await page.locator("dialog[open]").count(), 1);
await page.locator("dialog [data-move]").click();
assert.equal(await page.locator("dialog[open]").count(), 0);
for (let n = 0; n < 2; n++) {
  await page.locator("[data-character-choice]").first().click();
  await page.locator("dialog [data-move]").click();
}
await page.locator('[data-action="sail"]').click();
await page.locator('[data-action="fish"]').click();
await page.locator(".turn-tray [data-move]").click();
const after = await page.evaluate(() => window.vanuatuDemo.state);
assert.equal(after.players[after.first].markers.sail, 1);
assert.equal(after.players[after.first].markers.fish, 1);
// Every action can be selected and committed with pointer/touch controls, no dragging.
function actionState() {
  const s = E.init(3, [], {}, "ui-actions");
  s.actor = 0;
  s.first = 0;
  s.phase = "actions";
  s.players.forEach((p, i) => {
    p.markers = Object.fromEntries(E.ACTIONS.map((a) => [a, i === 0 ? 1 : 0]));
    p.money = 9;
    p.boat = "1,0";
  });
  s.board["1,0"] = E.tileState("startWreck");
  s.board["0,1"] = E.tileState("startFish");
  s.board["1,1"] = E.tileState("startBoat");
  s.board["0,0"].huts = [0];
  s.tourists = 2;
  s.players[0].fish = [1, 2];
  s.players[0].treasures = [1];
  return s;
}
// A neighbouring destination has 1- and 3-step legal paths, but only needs one UI choice.
const sailing = actionState();
assert.deepEqual(
  [
    ...new Set(
      E.sailOptions(sailing, 0)
        .filter((m) => m.path.at(-1) === "1,1")
        .map((m) => m.path.length),
    ),
  ].sort(),
  [1, 3],
);
await page.evaluate((s) => window.vanuatuDemo.setState(s), sailing);
await page.locator('[data-action="sail"]').click();
await page.locator('[data-cell="1,1"]').click();
assert.equal(await page.locator(".turn-tray .primary[data-move]").count(), 1);
await page.locator(".turn-tray .primary[data-move]").click();
assert.equal(
  await page.evaluate(() => window.vanuatuDemo.state.players[0].money),
  8,
);
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  for (const action of E.ACTIONS) {
    const s = actionState();
    await page.evaluate((s) => window.vanuatuDemo.setState(s), s);
    await page.locator(`[data-action="${action}"]`).click();
    const targets = page.locator(".map-cell.legal");
    if (await targets.count()) await targets.first().click();
    const option = page.locator(".turn-tray [data-move]").first();
    assert.ok(await option.count(), `No UI choice ${width}/${action}`);
    await option.click();
    if (action === "rest")
      await page.locator(".turn-tray [data-move]").first().click();
    assert.equal(
      await page.locator(".feedback:not([hidden])").count(),
      0,
      `${action} feedback`,
    );
    assert.ok(
      (await page.evaluate(() => window.vanuatuDemo.state._history.length)) > 0,
    );
  }
  await page.evaluate((s) => window.vanuatuDemo.setState(s), actionState());
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Page overflows horizontally",
  );
  await page.screenshot({
    path: `.local/qa/actions-${width}.png`,
    fullPage: true,
  });
  await page.locator("[data-help]").first().click();
  await page.locator('[data-pref="colorBlind"]').check();
  await page.locator("[data-close]").click();
  assert.ok(await page.locator(".color-symbol").count());
  assert.deepEqual(
    await page.locator('[data-cell="0,0"] .resource-symbol').allTextContents(),
    ["K", "C", "B"],
  );
  assert.ok(await page.locator(".demand-ships .resource-symbol").count());
}
// Extension placement and optional expansion remain usable.
let expansion = E.init(3, [], {}, "expand");
while (expansion.round < 2) expansion = E.moveAI(expansion, expansion.actor);
await page.evaluate((s) => window.vanuatuDemo.setState(s), expansion);
await page.locator(".map-cell.legal").first().click();
await page.locator(".turn-tray [data-move]").click();
// Ended games and spectator states must not reference a missing actor.
let final = E.init(3, [], {}, "finish");
while (!final.finished) final = E.moveAI(final, final.actor);
await page.evaluate((s) => window.vanuatuDemo.setState(s), final);
await page.locator("[data-scores]").click();
assert.equal(await page.locator(".final-scores>div").count(), 3);
await page.locator("[data-close]").click();
// Hosted protocol: replay, names, analysis chat visibility, hover anchors and board thumbnail.
await page.goto(base + "/");
await page.evaluate(() => {
  document.body.innerHTML = '<div id="host"></div>';
});
await page.addStyleTag({ url: base + "/viewer.css" });
await page.addScriptTag({ url: base + "/viewer.js" });
await page.evaluate(() => {
  window.emitter = window.vanuatu.launch("#host");
  window.hostEvents = [];
  for (const kind of [
    "player:hovered",
    "boardgame:clicked",
    "replay:info",
    "thumbnail:ready",
    "update:preference",
  ])
    window.emitter.on(kind, (v) => window.hostEvents.push({ kind, v }));
});
await page.evaluate(
  (s) => {
    emitter.receive("player", { index: 0 });
    emitter.receive("state", s);
    emitter.receive("preferences", { analysis: true, colorBlind: true });
  },
  E.stripSecret(final, 0),
);
assert.equal(await page.locator('[data-activity="chat"]').count(), 0);
// BGS owns both shared settings; changes apply live without echoing incoming preferences.
assert.equal(
  await page.evaluate(
    () => hostEvents.filter((e) => e.kind === "update:preference").length,
  ),
  0,
);
await page.locator("[data-help]").first().click();
assert.equal(await page.locator('[data-pref="colorBlind"]').isChecked(), true);
await page.evaluate(() =>
  emitter.receive("preferences", {
    analysis: true,
    colorBlind: false,
    sound: true,
  }),
);
assert.equal(await page.locator('[data-pref="colorBlind"]').isChecked(), false);
assert.equal(await page.locator('[data-pref="sound"]').isChecked(), true);
assert.equal(await page.locator(".resource-symbol").count(), 0);
await page.locator('[data-pref="colorBlind"]').check();
await page.locator('[data-pref="sound"]').uncheck();
assert.deepEqual(
  await page.evaluate(() =>
    hostEvents.filter((e) => e.kind === "update:preference").map((e) => e.v),
  ),
  [
    { name: "colorBlind", value: true },
    { name: "sound", value: false },
  ],
);
await page.locator("[data-close]").click();
await page.evaluate(() =>
  emitter.receive("preferences", {
    analysis: true,
    colorBlind: true,
    sound: false,
  }),
);
assert.equal(
  await page.evaluate(
    () => hostEvents.filter((e) => e.kind === "update:preference").length,
  ),
  2,
);
await page.evaluate(
  (s) => {
    emitter.receive("replay:start");
    emitter.receive("replay:to", 1);
    emitter.receive("gamelog", { start: 0, data: s });
  },
  E.logSlice(final, { player: 0, start: 0, end: 0 }),
);
assert.equal(await page.locator("[data-scores]").count(), 0);
await page.locator('[data-bgs-player="0"]').hover();
assert.ok(
  await page.evaluate(() =>
    hostEvents.some((e) => e.kind === "player:hovered"),
  ),
);
await page.evaluate(() => {
  emitter.receive("replay:end");
  emitter.receive("preferences", { analysis: false });
  emitter.receive("chat:state", {
    canSend: true,
    canEdit: true,
    translationTarget: "fr",
  });
  emitter.receive(
    "chat:messages",
    Array.from({ length: 80 }, (_, i) => ({
      _id: i.toString(16).padStart(24, "0"),
      type: "text",
      author: "You",
      playerIndex: 0,
      createdAt: new Date().toISOString(),
      editableUntil: new Date(Date.now() + 600000).toISOString(),
      text: "Practice message " + i,
      language: "en",
    })),
  );
});
await page.locator('[data-tab="chat"]').click();
const messageList = page.locator(".chat-messages");
await messageList.scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
await messageList.evaluate((el) => {
  el.scrollTop = el.scrollHeight;
});
await page.screenshot({ path: ".local/qa/chat-mobile.png", fullPage: true });
assert.ok(
  await messageList.evaluate(
    (el) => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 2,
  ),
);
await page.locator(".chat-composer input").press("ArrowUp");
assert.equal(
  await page.locator(".chat-composer input").inputValue(),
  "Practice message 79",
);
assert.ok(await page.locator(".chat-translate").count());
await page.screenshot({ path: ".local/qa/chat-mobile.png", fullPage: true });
await page.evaluate(() =>
  emitter.receive("thumbnail:render", { width: 1000, height: 600 }),
);
await page.waitForTimeout(200);
assert.ok(await page.locator(".bgs-board-thumbnail svg").count());
await page.screenshot({ path: ".local/qa/thumbnail.png" });
assert.deepEqual(errors, []);
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log(
  "Desktop, mobile, all nine actions, expansion, endgame, replay, hover cards and thumbnail checks passed.",
);
