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
  for (const [index, good] of E.GOODS.entries()) {
    const s = actionState();
    s.demands = [{ id: 1, goods: [...E.GOODS], filled: [false, false, false] }];
    await page.evaluate((s) => window.vanuatuDemo.setState(s), s);
    await page.locator('[data-action="buy"]').click();
    assert.equal(
      await page
        .locator(".cell-highlight.selected")
        .getAttribute("data-highlight-cell"),
      "0,0",
    );
    assert.ok(
      await page
        .locator(".board-highlights")
        .evaluate((el) => el === el.parentElement.lastElementChild),
    );
    assert.equal(
      await page.locator(".turn-tray .primary[data-move]").count(),
      3,
    );
    await page.locator(".turn-tray .primary[data-move]").nth(index).click();
    const exported = await page.evaluate(() => window.vanuatuDemo.state);
    assert.equal(exported._history.at(-1).move.good, good);
    assert.equal(exported.players[0].money, 9 - E.PRICES[good]);
    assert.equal(exported.players[0].score, E.VALUES[good]);
    assert.equal(exported.board["0,0"].goods[good], 0);
  }
  // Resolving an unaffordable majority is retrieval only, and selecting actions
  // must preserve the board's SVG/images (including its current zoom and scroll).
  const poor = actionState();
  poor.players[0].money = 0;
  poor.players[0].character = null;
  await page.evaluate((s) => window.vanuatuDemo.setState(s), poor);
  await page.locator("[data-zoom]").click();
  await page.evaluate(() => {
    const map = document.querySelector(".map-scroll");
    map.scrollLeft = 120;
    map.scrollTop = 80;
    window.boardBeforeAction = {
      map,
      svg: map.querySelector("svg"),
      images: [...map.querySelectorAll("image")],
      x: map.scrollLeft,
      y: map.scrollTop,
      state: JSON.stringify(window.vanuatuDemo.state),
    };
  });
  const build = page.locator('[data-action="build"]');
  assert.match(await build.getAttribute("class"), /retrieve-only/);
  assert.match(await build.getAttribute("title"), /Retrieve without acting/);
  await build.click();
  assert.match(
    await page.locator(".turn-tray").innerText(),
    /Not enough vatus/,
  );
  assert.match(
    await page.locator(".turn-tray [data-move]").innerText(),
    /Retrieve without acting/,
  );
  await page.screenshot({
    path: `.local/qa/unaffordable-build-${width}.png`,
    fullPage: true,
  });
  await page.locator('[data-action="sail"]').click();
  await page.locator("[data-cancel]").click();
  await page.locator('[data-action="build"]').click();
  assert.ok(
    await page.evaluate(() => {
      const before = window.boardBeforeAction,
        map = document.querySelector(".map-scroll");
      return (
        map === before.map &&
        map.querySelector("svg") === before.svg &&
        [...map.querySelectorAll("image")].every(
          (image, i) => image === before.images[i],
        ) &&
        map.scrollLeft === before.x &&
        map.scrollTop === before.y &&
        JSON.stringify(window.vanuatuDemo.state) === before.state
      );
    }),
    "Selecting and cancelling actions must not rebuild or scroll the board",
  );
  await page.locator("[data-zoom]").click();
  for (const action of E.ACTIONS) {
    const s = actionState();
    await page.evaluate((s) => window.vanuatuDemo.setState(s), s);
    await page.evaluate(() => {
      window.actionBoard = document.querySelector(".archipelago");
    });
    await page.locator(`[data-action="${action}"]`).click();
    assert.ok(
      await page.evaluate(
        () => window.actionBoard === document.querySelector(".archipelago"),
      ),
      `${action} must preserve the board`,
    );
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
    "fetchState",
    "fetchLog",
    "move",
    "thumbnail:ready",
    "update:preference",
    "chat:read",
  ])
    window.emitter.on(kind, (v) => window.hostEvents.push({ kind, v }));
});
// Production acknowledges a move with a log, not a replacement state.
const hostedInitial = E.init(3, [], {}, "hosted-builder");
const hostedPlayer = hostedInitial.actor;
await page.evaluate(
  ({ state, player }) => {
    emitter.receive("player", { index: player });
    emitter.receive("state", state);
  },
  { state: E.stripSecret(hostedInitial, hostedPlayer), player: hostedPlayer },
);
await page.waitForSelector('[data-character-choice="builder"]');
assert.deepEqual(
  await page.evaluate(() => hostEvents.filter((e) => e.kind === "replay:info")),
  [],
);
await page.locator('[data-character-choice="builder"]').click();
await page.locator("dialog [data-move]").click();
const builderMove = await page.evaluate(
  () => hostEvents.find((e) => e.kind === "move").v,
);
const hostedAfter = E.move(hostedInitial, builderMove, hostedPlayer);
assert.equal(hostedAfter.players[hostedPlayer].character, "builder");
await page.evaluate((log) => emitter.receive("gamelog", log), {
  start: E.logLength(hostedInitial),
  data: E.logSlice(hostedAfter, {
    player: hostedPlayer,
    start: E.logLength(hostedInitial),
  }),
});
await page.waitForFunction(() =>
  hostEvents.some((e) => e.kind === "fetchState"),
);
await page.evaluate(
  (state) => emitter.receive("state", state),
  E.stripSecret(hostedAfter, hostedPlayer),
);
await page.waitForFunction(() => !document.querySelector("dialog").open);
assert.deepEqual(
  await page.evaluate(() => hostEvents.filter((e) => e.kind === "replay:info")),
  [],
);
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
// Updating colors must preserve the SVG images (including their clip paths).
await page.evaluate(() => {
  window.tileImages = [...document.querySelectorAll(".archipelago image")];
  window.boardElement = document.querySelector(".archipelago");
});
await page.locator("[data-color-blind]").click();
assert.equal(await page.locator(".resource-symbol").count(), 0);
await page.locator("[data-color-blind]").click();
assert.ok(await page.locator(".resource-symbol").count());
assert.ok(
  await page.evaluate(
    () =>
      boardElement === document.querySelector(".archipelago") &&
      tileImages.every(
        (image) => image.isConnected && boardElement.contains(image),
      ),
  ),
);
await page.evaluate(() => {
  // The two local toggles were checked above; keep the earlier preference assertions.
  let preferences = 0;
  hostEvents = hostEvents.filter(
    (e) => e.kind !== "update:preference" || preferences++ < 2,
  );
});
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
assert.deepEqual(
  await page.evaluate(
    () => hostEvents.filter((e) => e.kind === "replay:info").at(-1).v,
  ),
  { start: 1, current: 1, end: E.logLength(final) },
);
await page.locator('[data-bgs-player="0"]').hover();
assert.ok(
  await page.evaluate(() =>
    hostEvents.some((e) => e.kind === "player:hovered"),
  ),
);
await page.evaluate(() => {
  window.hostEvents = [];
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
await page.evaluate(
  (state) => emitter.receive("state", state),
  E.stripSecret(final, 0),
);
await page.waitForSelector("[data-scores]");
assert.deepEqual(
  await page.evaluate(() => hostEvents.filter((e) => e.kind === "replay:info")),
  [],
);
// Hosted avatars can arrive after the roster/messages and update both surfaces.
await page.evaluate(() => {
  window.avatarUrls = ["#e8832e", "#80398d", "#209b9a"].map(
    (color) =>
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="16" fill="${color}"/><circle cx="16" cy="12" r="6" fill="white"/></svg>`,
      ),
  );
  emitter.receive("avatars", avatarUrls);
});
assert.equal(await page.locator(".player-card .player-avatar").count(), 3);
assert.equal(await page.locator(".chat-author .player-avatar").count(), 80);
assert.equal(
  await page.locator(".player-card .player-avatar").first().getAttribute("src"),
  await page.evaluate(() => avatarUrls[0]),
);
// Incoming messages from other players show on both entry points while unread.
await page.evaluate(() => {
  window.scrollTo(0, 0);
  emitter.receive("chat:appended", [
    {
      _id: "000000000000000000000050",
      type: "text",
      author: "Maya",
      playerIndex: 1,
      createdAt: new Date().toISOString(),
      text: "Your turn!",
    },
  ]);
});
assert.equal(await page.locator(".unread-badge").textContent(), "1");
assert.equal(
  await page.locator('[data-tab="chat"] .unread').textContent(),
  "1",
);
assert.ok(await page.locator(".unread-badge").isVisible());
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.locator('[data-tab="journal"]').click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const before = await page.evaluate(() => ({
    scroll: window.scrollY,
    height: document.documentElement.scrollHeight,
    panel: document.querySelector(".activity").getBoundingClientRect().height,
  }));
  await page.locator('[data-tab="chat"]').click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    scroll: window.scrollY,
    height: document.documentElement.scrollHeight,
    panel: document.querySelector(".activity").getBoundingClientRect().height,
  }));
  assert.deepEqual(after, before, `Chat tab must not jump at ${width}px`);
  assert.ok(await page.locator(".chat-composer input").isVisible());
}
await page.waitForFunction(
  () => document.querySelector(".unread-badge").hidden,
);
await page.waitForFunction(() =>
  hostEvents.some(
    (e) =>
      e.kind === "chat:read" && e.v.messageId === "000000000000000000000050",
  ),
);
assert.equal(
  await page.evaluate(
    () =>
      getComputedStyle(document.documentElement).backgroundColor ===
        getComputedStyle(document.querySelector(".vanuatu")).backgroundColor &&
      getComputedStyle(document.body).backgroundColor ===
        getComputedStyle(document.querySelector(".vanuatu")).backgroundColor,
  ),
  true,
);
// Leaving an open chat offscreen must not collapse it or mark new messages read.
await page.evaluate(() => {
  window.scrollTo(0, 0);
});
await page.waitForTimeout(100);
await page.evaluate(() =>
  emitter.receive("chat:appended", [
    {
      _id: "000000000000000000000051",
      type: "text",
      author: "Maya",
      playerIndex: 1,
      createdAt: new Date().toISOString(),
      text: "Good luck!",
    },
  ]),
);
await page.waitForTimeout(100);
assert.equal(await page.locator(".unread-badge").textContent(), "1");
assert.ok(
  (await page.locator(".chat-panel details").getAttribute("open")) !== null,
);
await page.locator('[data-activity="chat"]').click();
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
// In the tabbed layout, a visible Journal must not read the hidden Chat.
await page.locator('[data-tab="journal"]').click();
await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(600);
await page.evaluate(() => {
  hostEvents = [];
  emitter.receive("chat:appended", [
    {
      _id: "000000000000000000000052",
      type: "text",
      author: "Maya",
      playerIndex: 1,
      createdAt: new Date().toISOString(),
      text: "Still unread in Journal",
    },
  ]);
});
await page.waitForTimeout(750);
assert.equal(await page.locator(".chat-panel").isHidden(), true);
assert.equal(
  await page.locator('[data-tab="chat"] .unread').textContent(),
  "1",
);
assert.deepEqual(
  await page.evaluate(() => hostEvents.filter((e) => e.kind === "chat:read")),
  [],
);
// Large screens show both panels, so visible chat messages can now be read.
await page.setViewportSize({ width: 1440, height: 1000 });
await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
await page.waitForFunction(
  () => document.querySelector(".unread-badge").hidden,
);
const journalBox = await page.locator(".journal-panel").boundingBox();
const chatBox = await page.locator(".chat-panel").boundingBox();
assert.equal(journalBox.y, chatBox.y);
assert.equal(journalBox.height, chatBox.height);
assert.ok(journalBox.x + journalBox.width <= chatBox.x + 1);
await page.screenshot({
  path: ".local/qa/chat-journal-desktop.png",
  fullPage: true,
});
await page.locator('.chat-author[data-bgs-player="1"]').last().hover();
assert.ok(
  await page.evaluate(() =>
    hostEvents.some((e) => e.kind === "player:hovered"),
  ),
);
await page.setViewportSize({ width: 390, height: 1000 });
await page.locator('[data-tab="chat"]').click();
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
