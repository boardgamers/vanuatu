import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname } from "node:path";
import * as E from "../engine/index.js";

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
await mkdir(".local/qa", { recursive: true });
try {
  const expanded = E.init(3, [], {}, "map-fit");
  const remainingTiles = Object.keys(E.TILES).filter(
    (id) => !Object.values(expanded.board).some((tile) => tile.id === id),
  );
  for (const cell of E.boardCells(expanded))
    if (!expanded.board[cell.id])
      expanded.board[cell.id] = E.tileState(remainingTiles.shift());
  expanded.round = 7;
  expanded.phase = "plan";
  for (const width of [760, 900, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    page.on("pageerror", (error) => errors.push(error.message));
    for (const state of [E.init(3, [], {}, "map-fit"), expanded]) {
      await page.goto(base + "/?hotseat");
      await page.evaluate(
        (s) => localStorage.setItem("vanuatu-practice-v1", JSON.stringify(s)),
        state,
      );
      await page.reload();
      await page.waitForSelector(".map-scroll[data-zoom]");
      await page.waitForFunction(
        () => document.querySelector(".map-scroll").dataset.zoom === "1",
      );
      const fit = await page.locator(".map-scroll").evaluate((map) => {
        const frame = map.getBoundingClientRect(),
          css = getComputedStyle(map);
        const svg = map.querySelector(".archipelago").getBoundingClientRect();
        return (
          svg.left >= frame.left + parseFloat(css.paddingLeft) - 1 &&
          svg.right <=
            frame.left + map.clientWidth - parseFloat(css.paddingRight) + 1 &&
          svg.top >= frame.top + parseFloat(css.paddingTop) - 1 &&
          svg.bottom <=
            frame.top + map.clientHeight - parseFloat(css.paddingBottom) + 1
        );
      });
      assert.ok(fit, `${width}px: the whole active map fits after reload`);
      await page.locator("[data-zoom-in]").click();
      assert.equal(
        await page.locator(".map-scroll").getAttribute("data-zoom"),
        "1.25",
      );
      await page.reload();
      await page.waitForFunction(
        () => document.querySelector(".map-scroll")?.dataset.zoom === "1",
      );
    }
    await page.screenshot({ path: `.local/qa/map-fit-expanded-${width}.png` });
    await page.close();
  }
  const resizedPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  resizedPage.on("pageerror", (error) => errors.push(error.message));
  await resizedPage.goto(base + "/?hotseat");
  await resizedPage.evaluate(
    (s) => localStorage.setItem("vanuatu-practice-v1", JSON.stringify(s)),
    expanded,
  );
  await resizedPage.reload();
  await resizedPage.waitForFunction(
    () => Number(document.querySelector(".map-scroll")?.dataset.zoom) > 1,
  );
  assert.ok(
    await resizedPage
      .locator(".archipelago")
      .evaluate((svg) => svg.getScreenCTM().a >= 0.499),
    "An expanded phone map keeps readable tiles",
  );
  await resizedPage.setViewportSize({ width: 900, height: 844 });
  await resizedPage.waitForFunction(
    () => document.querySelector(".map-scroll").dataset.zoom === "1",
  );
  await resizedPage.locator("[data-zoom-in]").click();
  await resizedPage.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await resizedPage.locator(".map-scroll").getAttribute("data-zoom"),
    "1.25",
    "Resizing preserves an explicitly chosen zoom",
  );
  await resizedPage.close();
  for (const width of [320, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/?new&hotseat&locale=fr");
    await page.waitForSelector(".map-scroll[data-zoom]");
    assert.equal(
      await page
        .locator(".archipelago")
        .evaluate((svg) =>
          svg
            .getAnimations({ subtree: true })
            .some((a) => a.playState === "running"),
        ),
      false,
      "The mobile board must not continuously repaint decorative water",
    );
    await page.locator(".sea-board").scrollIntoViewIfNeeded();
    const map = page.locator(".map-scroll");
    const zoom = () => map.evaluate((el) => Number(el.dataset.zoom));
    const initialZoom = await zoom();
    assert.ok(initialZoom >= 1 && initialZoom <= 1.5);
    const tileScale = await page
      .locator(".archipelago")
      .evaluate((svg) => svg.getScreenCTM().a);
    assert.ok(
      tileScale >= 0.499,
      "The initial phone view keeps tile badges readable",
    );
    await page.screenshot({ path: `.local/qa/map-zoom-default-${width}.png` });
    const original = await page.evaluate(() =>
      JSON.stringify(window.vanuatuDemo.state),
    );
    const cdp = await page.context().newCDPSession(page);
    const midpoint = await map.evaluate((el) => {
      const r = el.getBoundingClientRect(),
        css = getComputedStyle(el);
      return {
        x: r.x + el.clientWidth / 2,
        y:
          r.y +
          parseFloat(css.paddingTop) +
          (el.clientHeight -
            parseFloat(css.paddingTop) -
            parseFloat(css.paddingBottom)) /
            2,
      };
    });
    // Use native touch dispatch: the page must not zoom and the map point under
    // the fingers must stay anchored throughout the pinch.
    const world = await page.locator(".archipelago").evaluate((svg, p) => {
      const q = new DOMPoint(p.x, p.y).matrixTransform(
        svg.getScreenCTM().inverse(),
      );
      return { x: q.x, y: q.y };
    }, midpoint);
    const points = (distance) => [
      { id: 1, x: midpoint.x - distance / 2, y: midpoint.y },
      { id: 2, x: midpoint.x + distance / 2, y: midpoint.y },
    ];
    // Real pinches usually begin with one finger, then add the second.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: points(80).slice(0, 1),
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: points(80),
    });
    for (const distance of [90, 100, 110, 120, 130, 140, 150, 160]) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: points(distance),
      });
      await page.waitForTimeout(20);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    assert.ok(
      Math.abs((await zoom()) - initialZoom * 2) < 0.01,
      "Pinching should double the map scale",
    );
    assert.equal(
      await page.evaluate(() => visualViewport.scale),
      1,
      "Only the map should zoom",
    );
    const screen = await page.locator(".archipelago").evaluate((svg, p) => {
      const q = new DOMPoint(p.x, p.y).matrixTransform(svg.getScreenCTM());
      return { x: q.x, y: q.y };
    }, world);
    assert.ok(
      Math.hypot(screen.x - midpoint.x, screen.y - midpoint.y) < 3,
      "The pinch midpoint stays on the same map location",
    );
    assert.equal(
      await page.locator("dialog[open]").count(),
      0,
      "Pinching must not activate a tile",
    );
    await page.screenshot({ path: `.local/qa/map-zoom-pinched-${width}.png` });
    // A regular single-finger swipe still pans the enlarged board natively.
    const left = await map.evaluate((el) => el.scrollLeft);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: midpoint.x, y: midpoint.y }],
    });
    for (const dx of [20, 40, 60, 80]) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: midpoint.x - dx, y: midpoint.y }],
      });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForFunction(
      (x) => document.querySelector(".map-scroll").scrollLeft > x + 20,
      left,
    );
    await page.waitForTimeout(300);
    // Preference/state refreshes retain the chosen scale, center and SVG nodes.
    const preserved = await page.evaluate(() => {
      const map = document.querySelector(".map-scroll");
      window.savedBoard = map.querySelector(".archipelago");
      return { x: map.scrollLeft, y: map.scrollTop, zoom: map.dataset.zoom };
    });
    await page.evaluate(() =>
      window.vanuatuDemo.setState(window.vanuatuDemo.state),
    );
    const current = await map.evaluate((el) => ({
      x: el.scrollLeft,
      y: el.scrollTop,
      zoom: el.dataset.zoom,
    }));
    assert.deepEqual(current, preserved);
    assert.equal(
      await page.evaluate(
        () => window.savedBoard === document.querySelector(".archipelago"),
      ),
      true,
    );
    // Zoom out reaches a complete overview; the limit button also permits a
    // vertical swipe to scroll the page, without changing the game state.
    while (
      (await page.locator("[data-zoom-out]").getAttribute("aria-disabled")) !==
      "true"
    )
      await page.locator("[data-zoom-out]").click();
    assert.equal(await zoom(), 1);
    const button = await page.locator("[data-zoom-out]").boundingBox();
    const beforeY = await page.evaluate(() => scrollY);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: button.x + button.width / 2, y: button.y + button.height / 2 },
      ],
    });
    for (const dy of [20, 40, 60, 80, 100]) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: button.x + button.width / 2,
            y: button.y + button.height / 2 - dy,
          },
        ],
      });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForFunction((y) => scrollY > y + 20, beforeY);
    assert.equal(
      await page.evaluate(() => JSON.stringify(window.vanuatuDemo.state)),
      original,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "Map zoom: desktop reload fitting, responsive defaults, phone readability, native pinch, anchoring, panning and page scrolling passed.",
  );
} finally {
  await browser.close();
  server.close();
}
