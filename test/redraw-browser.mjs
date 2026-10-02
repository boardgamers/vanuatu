import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import * as E from "../engine/index.js";

const dist = resolve("dist");
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/viewer.css"><div id="app"></div><script src="/viewer.js"></script>',
      );
      return;
    }
    const path = resolve(dist, "." + pathname);
    if (!path.startsWith(dist + "/")) throw Error("Invalid path");
    res.setHeader(
      "Content-Type",
      {
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".webp": "image/webp",
      }[extname(path)] ?? "application/octet-stream",
    );
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch();
try {
  for (const width of [390, 1400]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      isMobile: width < 700,
      hasTouch: width < 700,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const game = E.init(3, [], {}, "redraws");
    game.phase = "actions";
    game.actor = 0;
    game.first = 0;
    game.players[0].boat = "1,0";
    game.players[0].character = null;
    game.players[0].markers.sail = 1;
    game.players[0].markers.fish = 1;
    game.board["1,0"] = E.tileState("startFish");
    const state = E.stripSecret(game, 0);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate((s) => {
      window.fixture = s;
      window.host = vanuatu.launch("#app");
      host.emit("player", { index: 0 });
      host.emit("preferences", { locale: "fr", sound: false });
      host.emit("state", s);
      window.settle = () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
    }, state);
    await page.waitForSelector(".archipelago");
    await page.waitForFunction(
      () =>
        document.querySelector(".vanuatu").lang === "fr" ||
        document.querySelector("#app").lang === "fr",
    );
    await page.waitForTimeout(100);
    // Repeated server/preference events must leave the visible game untouched.
    assert.deepEqual(
      await page.evaluate(async () => {
        const records = [];
        const observer = new MutationObserver((rs) => records.push(...rs));
        observer.observe(document.querySelector(".play"), {
          childList: true,
          attributes: true,
          characterData: true,
          subtree: true,
        });
        for (let i = 0; i < 3; i++) {
          host.emit("state", structuredClone(fixture));
          host.emit("player", { index: 0 });
          host.emit("preferences", { locale: "fr", sound: !!(i % 2) });
          await settle();
        }
        observer.disconnect();
        return records.map((r) => r.type);
      }),
      [],
      "duplicate state/player events and sound toggles do not patch the board or controls",
    );

    await page.locator("[data-zoom-in]").click();
    const before = await page.evaluate(() => {
      const map = document.querySelector(".map-scroll");
      map.scrollLeft = 60;
      map.scrollTop = 40;
      return { x: map.scrollLeft, y: map.scrollTop, zoom: map.dataset.zoom };
    });
    // An opponent's marker affects the dock, but not the SVG or map layout.
    assert.equal(
      await page.evaluate(async () => {
        let mutations = 0;
        const observer = new MutationObserver((rs) => (mutations += rs.length));
        observer.observe(document.querySelector(".map-scroll"), {
          childList: true,
          attributes: true,
          characterData: true,
          subtree: true,
        });
        fixture.players[1].markers.rest = 2;
        host.emit("state", structuredClone(fixture));
        await settle();
        observer.disconnect();
        return mutations;
      }),
      0,
    );
    assert.equal(
      await page.locator('[data-action="rest"] .marker-stack').textContent(),
      "2",
    );
    assert.deepEqual(
      await page.locator(".map-scroll").evaluate((map) => ({
        x: map.scrollLeft,
        y: map.scrollTop,
        zoom: map.dataset.zoom,
      })),
      before,
    );

    // Selection highlights are transient. The next real move must clear them,
    // even when it changes no boat position or other board artwork.
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-action="sail"]').click();
      assert.ok(await page.locator(".map-cell.legal").count());
      assert.equal(await page.locator(".turn-tray [data-cancel]").count(), 1);
      await page.evaluate(async () => {
        fixture.historyLength++;
        fixture.players[1].money++;
        host.emit("state", structuredClone(fixture));
        await settle();
      });
      assert.equal(await page.locator(".map-cell.legal").count(), 0);
      assert.equal(await page.locator(".cell-highlight.legal").count(), 0);
      assert.equal(await page.locator(".turn-tray [data-cancel]").count(), 0);
    }

    const fish = page.locator('[data-cell="1,0"] .resource-n').first();
    assert.equal(await fish.textContent(), "2");
    await page.evaluate(async () => {
      fixture.board["1,0"].fish = 1;
      host.emit("state", structuredClone(fixture));
      await settle();
    });
    assert.equal(
      await fish.textContent(),
      "1",
      "real resource changes still reach the board",
    );

    // New history is appended without removing the rows a player is reading.
    assert.deepEqual(
      await page.evaluate(async () => {
        const list = document.querySelector(".event-list");
        const rows = [...list.children];
        let removed = 0;
        const observer = new MutationObserver(
          (rs) =>
            (removed += rs.reduce((n, r) => n + r.removedNodes.length, 0)),
        );
        observer.observe(list, { childList: true, subtree: true });
        fixture.events.push({
          type: "beg",
          p: 0,
          amount: 2,
          round: 1,
          step: ++fixture.historyLength,
        });
        host.emit("state", structuredClone(fixture));
        await settle();
        observer.disconnect();
        return {
          removed,
          kept: rows.every((row, i) => row === list.children[i]),
        };
      }),
      { removed: 0, kept: true },
    );
    assert.equal(await page.locator(".event-beg").count(), 1);
    // Switching back to an earlier state (as replay does) removes stale rows
    // and updates resources; it must not hit an obsolete render cache.
    await page.evaluate(async (s) => {
      host.emit("state", s);
      await settle();
    }, state);
    assert.equal(await page.locator(".event-beg").count(), 0);
    assert.equal(await fish.textContent(), "2");
    await page.evaluate(async () => {
      host.emit("preferences", {
        locale: "fr",
        sound: false,
        colorBlind: true,
        bgs: {
          players: [],
          playerColors: [],
          playerSymbols: ["star", "hexagon", "cross"],
        },
      });
      await settle();
    });
    assert.equal(
      await page.locator(".boat.own .color-symbol").textContent(),
      "★",
    );
    await page.evaluate(async () => {
      host.emit("preferences", {
        locale: "fr",
        sound: false,
        colorBlind: true,
        bgs: {
          players: [],
          playerColors: [],
          playerSymbols: ["diamond", "hexagon", "cross"],
        },
      });
      await settle();
    });
    assert.equal(
      await page.locator(".boat.own .color-symbol").textContent(),
      "◆",
      "symbol-only updates invalidate the board cache",
    );
    assert.deepEqual(errors, []);
    console.log(
      `${width}px: duplicate updates, sound, marker-only changes, selection reset, resources and retained journal rows passed`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
