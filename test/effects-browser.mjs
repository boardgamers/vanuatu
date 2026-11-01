import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import * as E from "../engine/index.js";

const dist = resolve("dist");
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/sound-test.js") {
      res.setHeader("Content-Type", "text/javascript; charset=utf-8");
      res.end(await readFile("viewer/sound.js"));
      return;
    }
    if (pathname === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/viewer.css"><div id="game"></div><script src="/viewer.js"></script>',
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
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch();
await mkdir(".local/qa", { recursive: true });
function fixture() {
  const s = E.init(3, [], {}, "action-feedback");
  s.phase = "actions";
  s.actor = s.first = 0;
  s.players[0].boat = "1,0";
  s.players[0].money = 7;
  s.players[0].fish = [1];
  s.players[0].character = null;
  for (const a of E.ACTIONS) s.players[0].markers[a] = 1;
  s.players[1].markers.rest = 1;
  s.players[2].markers.rest = 1;
  s.board["0,0"].huts = [0];
  s.demands[0] = {
    id: 10,
    goods: ["kava", "copra", "beef"],
    filled: [true, true, false],
  };
  return s;
}
try {
  for (const width of [390, 1440]) {
    const p = await browser.newPage({
      viewport: { width, height: 1000 },
      isMobile: width < 700,
      hasTouch: width < 700,
    });
    const errors = [];
    p.on("pageerror", (e) => {
      errors.push(e.message);
      console.error(e.message);
    });
    await p.addInitScript(() => {
      window.played = 0;
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        constructor() {
          super();
          for (const name of ["createOscillator", "createBufferSource"]) {
            const create = this[name].bind(this);
            this[name] = () => {
              const source = create();
              const start = source.start.bind(source);
              source.start = (...args) => {
                window.played++;
                return start(...args);
              };
              return source;
            };
          }
        }
      };
    });
    await p.addInitScript(() => localStorage.setItem("vanuatu-map-view", "2d"));
    await p.goto(`http://127.0.0.1:${server.address().port}/`);
    if (width === 1440) {
      const samples = await p.evaluate(async () => {
        const { createMoveSound } = await import("/sound-test.js");
        const result = {};
        for (const kind of [
          "marker",
          "sail",
          "fish",
          "draw",
          "build",
          "sell",
          "buy",
          "complete",
          "explore",
          "rest",
          "tourist",
          "discard",
        ]) {
          const offline = new OfflineAudioContext(1, 24000, 24000);
          const proxy = new Proxy(offline, {
            get(target, name) {
              if (name === "state") return "running";
              const value = target[name];
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
          const audio = createMoveSound(() => proxy);
          audio.setEnabled(true);
          audio.unlock();
          await audio.play(kind);
          const buffer = await offline.startRendering();
          const data = buffer.getChannelData(0);
          result[kind] = {
            peak: Math.max(...data.map(Math.abs)),
            energy: data.reduce((sum, n) => sum + n * n, 0),
          };
        }
        return result;
      });
      for (const [kind, { peak, energy }] of Object.entries(samples)) {
        assert.ok(peak < 0.1, `${kind}: soft volume without clipping`);
        assert.ok(energy > 0.001, `${kind}: audio actually renders`);
      }
    }
    await p.evaluate(() => {
      window.host = vanuatu.launch("#game");
      host.emit("player", { index: 0 });
      host.emit("preferences", { locale: "fr", sound: true });
      window.settle = () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
    });
    const emit = async (state) => {
      await p.evaluate(
        async (state) => {
          host.emit("state", state);
          await settle();
        },
        E.stripSecret(state, 0),
      );
    };
    let s = fixture();
    await emit(s);
    assert.equal(
      await p.locator(".action-effect").count(),
      0,
      "Initial load is still",
    );
    await p.locator(".brand").click();
    await p.waitForTimeout(100);
    const sail = E.availableMoves(s, 0).find(
      (m) =>
        m.action === "sail" &&
        m.path.length === 2 &&
        m.path.at(-1) !== s.players[0].boat,
    );
    assert.ok(sail);
    const sailed = E.move(s, sail, 0);
    await emit(sailed);
    await p.locator(".effect-piece").waitFor();
    const progress = await p.evaluate(() => {
      const piece = document.querySelector(".effect-piece");
      const animation = piece.getAnimations()[0];
      animation.pause();
      animation.currentTime = animation.effect.getTiming().duration / 2;
      const frames = animation.effect.getKeyframes();
      return {
        frames: frames.length,
        first: frames[0].transform,
        last: frames.at(-1).transform,
        pointerEvents: getComputedStyle(piece).pointerEvents,
      };
    });
    assert.equal(progress.frames, 3, "Boat follows the intermediate space");
    assert.notEqual(progress.first, progress.last);
    assert.equal(progress.pointerEvents, "none");
    assert.equal(
      await p
        .locator('[data-boat="0"]')
        .evaluate((el) => getComputedStyle(el).opacity),
      "0",
    );
    await p.screenshot({ path: `.local/qa/feedback-sail-${width}.png` });
    assert.ok(await p.evaluate(() => window.played >= 2));
    // Scrolling cancels the overlay immediately and restores the real boat.
    await p.evaluate(() => document.dispatchEvent(new Event("scroll")));
    assert.equal(await p.locator(".action-effect").count(), 0);
    assert.equal(
      await p
        .locator('[data-boat="0"]')
        .evaluate((el) => getComputedStyle(el).opacity),
      "1",
    );

    await emit(s);
    const sold = E.move(
      s,
      E.availableMoves(s, 0).find((m) => m.action === "sell"),
      0,
    );
    await emit(sold);
    await p.locator(".effect-reward").first().waitFor();
    const amounts = await p.locator(".effect-reward").allTextContents();
    assert.ok(
      amounts.some((t) => t.includes("+3")),
      "Show gross income, not the net money drop",
    );
    assert.ok(
      amounts.some((t) => t.includes("10") && t.includes("+5")),
      "Show automatic prosperity conversion",
    );
    await p.waitForTimeout(650);
    await p.screenshot({ path: `.local/qa/feedback-sale-${width}.png` });
    await p.waitForTimeout(1700);
    assert.equal(
      await p.locator(".action-effect").count(),
      0,
      "Effects clean themselves up",
    );
    const audioCount = await p.evaluate(() => window.played);
    await emit(sold);
    assert.equal(await p.locator(".action-effect").count(), 0);
    assert.equal(
      await p.evaluate(() => window.played),
      audioCount,
      "Duplicate states are silent",
    );

    for (const action of ["build", "draw", "buy"]) {
      await emit(s);
      const move = E.availableMoves(s, 0).find(
        (m) => m.action === action && (action !== "buy" || m.good === "beef"),
      );
      assert.ok(move, action);
      await emit(E.move(s, move, 0));
      assert.ok(
        await p
          .locator(action === "buy" ? ".effect-piece" : ".effect-stamp")
          .count(),
        `${action}: feedback is attached to the action`,
      );
      if (action === "buy") {
        assert.ok(
          (await p.locator(".effect-reward").allTextContents()).some((text) =>
            text.includes("+7"),
          ),
        );
      }
    }
    const planning = fixture();
    planning.phase = "plan";
    for (const player of planning.players)
      for (const action of E.ACTIONS) player.markers[action] = 0;
    await emit(planning);
    await emit(
      E.move(
        planning,
        E.availableMoves(planning, 0).find((m) => m.type === "plan"),
        0,
      ),
    );
    assert.ok(
      await p
        .locator("[data-marker-player='0']")
        .evaluateAll((nodes) =>
          nodes.some((node) => node.getAnimations().length),
        ),
      "Placed markers have a short landing animation",
    );

    await p.emulateMedia({ reducedMotion: "reduce" });
    await emit(s);
    await emit(sailed);
    assert.equal(
      await p.locator(".action-effect").count(),
      0,
      "Reduced motion suppresses overlays",
    );
    await p.evaluate(() =>
      host.emit("preferences", { locale: "fr", sound: false, mapView: "2d" }),
    );
    await emit(s);
    const mutedAt = await p.evaluate(() => window.played);
    await emit(sailed);
    assert.equal(await p.locator(".action-effect").count(), 0);
    assert.equal(
      await p.evaluate(() => window.played),
      mutedAt,
      "Muted incoming moves are silent",
    );
    await p.locator("[data-help]").first().click();
    assert.equal(await p.locator('[data-pref="animations"]').count(), 0);
    assert.equal(await p.locator("[data-map-preference]").inputValue(), "2d");
    await p.emulateMedia({ reducedMotion: "no-preference" });
    await p.locator("dialog [data-close]").click();
    await emit(s);
    await emit(sailed);
    assert.ok(await p.locator(".action-effect").count());
    await p.evaluate(() => host.emit("replay:start"));
    assert.equal(await p.locator(".action-effect").count(), 0);
    await p.evaluate(
      async (states) => {
        for (let i = 0; i < states.length; i++) {
          host.emit("replay:to", i + 1);
          host.emit("gamelog", { start: i, data: { frames: [states[i]] } });
          await settle();
        }
      },
      [E.stripSecret(s, 0), E.stripSecret(sailed, 0)],
    );
    assert.equal(
      await p.locator(".action-effect").count(),
      0,
      "Forward replay does not animate",
    );
    await p.evaluate(async () => {
      host.emit("replay:end");
      await settle();
    });
    assert.equal(await p.locator(".action-effect").count(), 0);
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    await p.close();
    console.log(
      `${width}: route animation, accurate rewards, sound gating, cleanup, reduced motion and replay passed`,
    );
  }
} finally {
  await browser.close();
  server.close();
}
