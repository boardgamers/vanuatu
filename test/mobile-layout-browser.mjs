import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname } from "node:path";

const dist = resolve("dist");
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const path = resolve(
      dist,
      "." + (url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (!path.startsWith(dist + "/")) throw Error("Invalid path");
    res.setHeader(
      "Content-Type",
      { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" }[
        extname(path)
      ] ?? "application/octet-stream",
    );
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : {}),
});
const errors = [];
try {
  for (const width of [320, 390, 430]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    page.on("pageerror", (error) => errors.push(error.message));
    for (const count of [2, 3, 5]) {
      await page.goto(`${base}/?new&hotseat&players=${count}&locale=fr`);
      await page.waitForFunction(() => window.vanuatuDemo);
      await page.evaluate(() => {
        let s = vanuatuDemo.state;
        while (s.phase === "character")
          s = vanuatuDemo.engine.moveAI(s, s.actor);
        s.phase = "plan";
        s.actor = 0;
        s.planningPass = 0;
        s.players.forEach((p, i) => {
          p.fish = [3, 2];
          p.treasures = [2, 1];
          p.score = 100 + i;
          p.markers.rest = 1;
          p.name = [
            "AlphaZero",
            "coyote508",
            "SchweddyBalls",
            "Spock",
            "TheLongName",
          ][i];
        });
        vanuatuDemo.setState(s);
        vanuatuDemo.ui.setPreferences({ language: "fr", colorBlind: true });
      });
      // Even five players' stacks plus a draft marker fit in the same band.
      await page.locator('[data-action="rest"]').click();
      assert.equal(await page.locator(".draft-marker").textContent(), "+1");
      const layout = await page.evaluate(() => {
        const dock = document.querySelector(".action-dock");
        const strip = document.querySelector(".players");
        const cards = [...strip.children];
        const contained = (outer, inner) => {
          const a = outer.getBoundingClientRect(),
            b = inner.getBoundingClientRect();
          return (
            b.left >= a.left - 1 &&
            b.right <= a.right + 1 &&
            b.top >= a.top - 1 &&
            b.bottom <= a.bottom + 1
          );
        };
        return {
          dockWidth: dock.clientWidth,
          dockScroll: dock.scrollWidth,
          dockHeight: dock.clientHeight,
          actions: [...dock.children].length,
          controlsFit: [
            ...dock.querySelectorAll(
              ".action-symbol, .marker-stack, .draft-marker",
            ),
          ].every((e) => contained(e.closest("button"), e)),
          badgesFit: [...dock.querySelectorAll(".marker-stack")].every(
            (e) => e.scrollWidth <= e.clientWidth + 1,
          ),
          twoCards: contained(strip, cards[0]) && contained(strip, cards[1]),
          cardsFit: cards.every((card) =>
            [
              ...card.querySelectorAll(
                ".player-supplies .token b, .score b, .character-owned",
              ),
            ].every((e) => contained(card, e)),
          ),
          height: strip.clientHeight,
          supplies: cards.map((c) =>
            [...c.querySelectorAll(".player-supplies b")].map(
              (e) => e.textContent,
            ),
          ),
          names: cards.map((c) => c.querySelector(".profile").title),
        };
      });
      assert.equal(layout.actions, 9);
      assert.equal(
        layout.dockScroll,
        layout.dockWidth,
        "all nine actions fit without horizontal scrolling",
      );
      assert.ok(
        layout.dockHeight >= 44 && layout.dockHeight <= 74,
        "action strip keeps a touch target of at least 44px without becoming taller than before",
      );
      assert.ok(
        layout.controlsFit,
        "all marker counts and draft counters stay inside their button",
      );
      assert.ok(
        layout.badgesFit,
        "color-blind symbols and counts stay readable",
      );
      assert.ok(layout.twoCards, "two complete player cards fit side by side");
      assert.ok(
        layout.cardsFit,
        "individual stock values and scores are not clipped",
      );
      assert.ok(
        layout.height <= 140,
        "loaded player cards stay shorter than the previous 191px strip",
      );
      for (const values of layout.supplies)
        assert.deepEqual(values.slice(1), ["3", "2", "2", "1", "8"]);
      assert.equal(
        layout.names[2] ?? layout.names[1],
        count === 2 ? "coyote508" : "SchweddyBalls",
      );
    }
    const cdp = await page.context().newCDPSession(page);
    async function swipe(locator, dx, dy) {
      await locator.scrollIntoViewIfNeeded();
      const r = await locator.boundingBox();
      const x = r.x + r.width / 2,
        y = r.y + r.height / 2;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (const ratio of [0.2, 0.4, 0.6, 0.8, 1]) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + dx * ratio, y: y + dy * ratio }],
        });
        await page.waitForTimeout(35);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await page.waitForTimeout(150);
    }
    const before = await page.evaluate(() => JSON.stringify(vanuatuDemo.state));
    // The remaining player cards can still be swiped, including over buttons.
    await swipe(
      page.locator(".player-card").nth(1).locator(".character-owned"),
      -180,
      0,
    );
    assert.ok(
      await page.locator(".players").evaluate((e) => e.scrollLeft > 30),
    );
    assert.equal(await page.locator("dialog[open]").count(), 0);
    // Vertical gestures starting on enabled and disabled action buttons scroll
    // the document; they must not select an action or submit a move.
    for (const disabled of [false, true]) {
      if (disabled) await page.evaluate(() => vanuatuDemo.ui.setEnabled(false));
      await page.locator('[data-action="rest"]').scrollIntoViewIfNeeded();
      const beforeY = await page.evaluate(() => scrollY);
      await swipe(page.locator('[data-action="rest"]'), 0, -90);
      assert.ok(await page.evaluate((y) => scrollY > y + 20, beforeY));
    }
    assert.equal(
      await page.evaluate(() => JSON.stringify(vanuatuDemo.state)),
      before,
    );
    await page.close();
    console.log(
      `${width}px: nine actions, two visible player cards, full stocks, color-blind markers and touch scrolling passed`,
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  server.close();
}
