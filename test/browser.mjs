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
// The overview remains reachable above the taller character-selection tray.
for (const width of [390, 1440]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.locator("[data-overview]").click();
  assert.equal(
    await page.locator("[data-overview]").getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("[data-overview]").click();
}
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
// Unavailable planning actions explain prerequisites without placing a marker.
const blockedFish = page.locator('[data-action="fish"]');
assert.equal(await blockedFish.getAttribute("aria-disabled"), "true");
assert.ok((await blockedFish.getAttribute("title")).length > 20);
await blockedFish.dispatchEvent("click");
assert.equal(await page.locator("dialog[open]").count(), 1);
assert.ok((await page.locator("dialog p").innerText()).length > 20);
await page.locator("dialog [data-close]").click();
await page.evaluate(() => {
  window.originalMap = document.querySelector(".map-scroll");
});
await page.locator('[data-action="sail"]').click();
assert.equal(
  await page.evaluate(
    () => window.originalMap === document.querySelector(".map-scroll"),
  ),
  true,
);
await page.locator("[data-undo]").click();
assert.equal(
  await page.evaluate(
    () => window.originalMap === document.querySelector(".map-scroll"),
  ),
  true,
);
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
  const closeView = await page.locator(".archipelago").getAttribute("viewBox");
  const position = await page.evaluate(() =>
    JSON.stringify(window.vanuatuDemo.state),
  );
  await page.locator("[data-overview]").click();
  assert.equal(
    await page.locator("[data-overview]").getAttribute("aria-pressed"),
    "true",
  );
  assert.ok(
    await page.locator(".archipelago").evaluate((svg) => {
      const box = svg.viewBox.baseVal;
      return [...svg.querySelectorAll(".cell-surface")].every((path) => {
        const cell = path.getBBox();
        return (
          cell.x >= box.x &&
          cell.y >= box.y &&
          cell.x + cell.width <= box.x + box.width &&
          cell.y + cell.height <= box.y + box.height
        );
      });
    }),
    "Overview must include every empty space",
  );
  assert.equal(await page.locator(".map-scroll .map-cell").count(), 16);
  assert.ok(
    await page.locator(".sea-board").evaluate((board) => {
      const upcoming = board.querySelector(".upcoming").getBoundingClientRect();
      return [...board.querySelectorAll(".cell-surface")].every((path) => {
        const cell = path.getBoundingClientRect();
        return (
          cell.bottom <= upcoming.top ||
          cell.right <= upcoming.left ||
          cell.top >= upcoming.bottom ||
          cell.left >= upcoming.right
        );
      });
    }),
    "Overview spaces must stay clear of the upcoming tiles",
  );
  assert.equal(
    await page.evaluate(() => JSON.stringify(window.vanuatuDemo.state)),
    position,
  );
  await page.screenshot({
    path: `.local/qa/overview-${width}.png`,
    fullPage: true,
  });
  await page.locator("[data-overview]").click();
  assert.equal(
    await page.locator(".archipelago").getAttribute("viewBox"),
    closeView,
  );
  await page.locator("[data-zoom]").click();
  await page.locator("[data-overview]").click();
  assert.equal(await page.locator(".map-scroll.zoomed").count(), 0);
  await page.locator("[data-overview]").click();
  // Upcoming tiles open with the same starting resources and capacities as the board.
  await page.locator("[data-upcoming]").click();
  const upcoming = await page.evaluate(() => window.vanuatuDemo.state.upcoming);
  assert.equal(
    await page.locator("dialog[open] .tile-preview").count(),
    upcoming.length,
  );
  for (const [i, id] of upcoming.entries()) {
    const spec = E.TILES[id];
    const expected =
      spec.type === "island"
        ? [`0/${spec.tourists}`, `0/${spec.drawings}`]
        : [spec.fish, spec.treasure].filter(Boolean).map(String);
    assert.deepEqual(
      await page
        .locator("dialog .tile-preview")
        .nth(i)
        .locator(".resource-n")
        .allTextContents(),
      expected,
    );
  }
  await page.screenshot({
    path: `.local/qa/upcoming-${width}.png`,
    fullPage: true,
  });
  assert.ok(
    await page
      .locator("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    "Tile preview must fit on mobile",
  );
  await page.locator("[data-close]").click();
  assert.equal(
    await page.evaluate(() => JSON.stringify(window.vanuatuDemo.state)),
    position,
  );
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
await page.locator(".chat-composer input").focus();
await page.locator(".chat-composer input").press("ArrowUp");
await page.waitForFunction(
  () =>
    document.querySelector(".chat-composer input").value ===
    "Practice message 79",
);
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
