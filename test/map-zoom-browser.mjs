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
async function zoomOutFully(page) {
  const out = page.locator("[data-zoom-out]");
  let steps = 0;
  while ((await out.getAttribute("aria-disabled")) !== "true") {
    assert.ok(steps++ < 20, "Zoom out reaches its full-board limit");
    await out.click();
  }
  // The zoom limit is set before the final camera animation has settled.
  await page.waitForFunction(
    () => !document.querySelector("[data-map-transition]"),
  );
  const clipped = await page.locator(".map-scroll").evaluate((map) => {
    const frame = map.getBoundingClientRect();
    const css = getComputedStyle(map);
    const svg = map.querySelector(".archipelago");
    const bounds = svg.viewBox.baseVal;
    return [...svg.querySelectorAll(".map-cell .cell-surface")].flatMap(
      (path) => {
        const tile = path.getBoundingClientRect();
        const world = path.getBBox();
        const inside =
          tile.left >= frame.left + parseFloat(css.paddingLeft) - 1 &&
          tile.top >= frame.top + parseFloat(css.paddingTop) - 1 &&
          tile.right <=
            frame.left + map.clientWidth - parseFloat(css.paddingRight) + 1 &&
          tile.bottom <=
            frame.top + map.clientHeight - parseFloat(css.paddingBottom) + 1 &&
          world.x >= bounds.x &&
          world.y >= bounds.y &&
          world.x + world.width <= bounds.x + bounds.width &&
          world.y + world.height <= bounds.y + bounds.height;
        return inside ? [] : [path.closest("[data-cell]").dataset.cell];
      },
    );
  });
  assert.deepEqual(
    clipped,
    [],
    "Full overview includes every complete tile space, even empty ones",
  );
}
try {
  const partial = E.init(3, [], {}, "map-fit");
  partial.board["2,0"] = E.tileState("c1");
  partial.board["2,1"] = E.tileState("a1");
  partial.round = 2;
  partial.phase = "plan";
  const expanded = E.init(3, [], {}, "map-fit");
  const remainingTiles = Object.keys(E.TILES).filter(
    (id) => !Object.values(expanded.board).some((tile) => tile.id === id),
  );
  for (const cell of E.boardCells(expanded))
    if (!expanded.board[cell.id])
      expanded.board[cell.id] = E.tileState(remainingTiles.shift());
  expanded.round = 7;
  expanded.phase = "plan";
  for (const [width, height] of [
    [760, 800],
    [900, 800],
    [1280, 800],
    [1493, 935],
    [1920, 1080],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", (error) => errors.push(error.message));
    for (const state of [E.init(3, [], {}, "map-fit"), partial, expanded]) {
      await page.addInitScript(() =>
        localStorage.setItem("vanuatu-map-view", "2d"),
      );
      await page.goto(base + "/?hotseat");
      await page.evaluate(
        (s) => localStorage.setItem("vanuatu-practice-v1", JSON.stringify(s)),
        state,
      );
      await page.reload();
      await page.waitForSelector(".map-scroll[data-zoom]");
      await page.waitForFunction(
        () => document.querySelector(".archipelago").style.width,
      );
      const initialZoom = Number(
        await page.locator(".map-scroll").getAttribute("data-zoom"),
      );
      assert.ok(
        width >= 1280
          ? initialZoom >= (state === expanded ? 1.1 : 1) && initialZoom <= 1.25
          : initialZoom === 1,
        `${width}px: use a closer default when space allows (zoom ${initialZoom})`,
      );
      const fit = await page.locator(".map-scroll").evaluate((map) => {
        const frame = map.getBoundingClientRect(),
          css = getComputedStyle(map);
        const svg = map.querySelector(".archipelago");
        const [x, y, w, h] = svg.dataset.focusBox.split(" ").map(Number);
        const matrix = svg.getScreenCTM();
        const first = new DOMPoint(x, y).matrixTransform(matrix);
        const last = new DOMPoint(x + w, y + h).matrixTransform(matrix);
        const wide =
          map.clientWidth -
            parseFloat(css.paddingLeft) -
            parseFloat(css.paddingRight) >=
          900;
        const closer = wide && Number(map.dataset.zoom) > 1;
        const top = closer ? 12 : parseFloat(css.paddingTop);
        const bottom = closer
          ? map
              .closest(".sea-board")
              .querySelector(".turn-tray")
              .getBoundingClientRect().height + 12
          : parseFloat(css.paddingBottom);
        const middleX = frame.left + map.clientWidth / 2;
        const middleY =
          frame.top +
          parseFloat(css.paddingTop) +
          (map.clientHeight -
            parseFloat(css.paddingTop) -
            parseFloat(css.paddingBottom)) /
            2;
        return (
          Math.abs((first.x + last.x) / 2 - middleX) < 1 &&
          Math.abs((first.y + last.y) / 2 - middleY) < 1 &&
          first.x >= frame.left + parseFloat(css.paddingLeft) - 1 &&
          last.x <=
            frame.left + map.clientWidth - parseFloat(css.paddingRight) + 1 &&
          first.y >= frame.top + top - 1 &&
          last.y <= frame.top + map.clientHeight - bottom + 1
        );
      });
      assert.ok(fit, `${width}px: the whole active map fits after reload`);
      await page.locator("[data-zoom-in]").click();
      assert.ok(
        Math.abs(
          Number(await page.locator(".map-scroll").getAttribute("data-zoom")) -
            initialZoom * 1.25,
        ) < 0.001,
      );
      await page.reload();
      await page.waitForFunction(
        (zoom) =>
          Number(document.querySelector(".map-scroll")?.dataset.zoom) === zoom,
        initialZoom,
      );
      const overlaps = await page.locator(".sea-board").evaluate((board) => {
        const overlays = [
          ...board.querySelectorAll(
            ".sea-dashboard > *, .map-tools, .upcoming, .turn-tray",
          ),
        ].map((el) => ({
          rect: el.getBoundingClientRect(),
          name: el.className,
        }));
        return [
          ...board.querySelectorAll(
            ".archipelago .map-cell.occupied .cell-surface",
          ),
        ].flatMap((el) => {
          const tile = el.getBoundingClientRect();
          return overlays
            .filter(
              ({ rect: o }) =>
                tile.right > o.left &&
                tile.left < o.right &&
                tile.bottom > o.top &&
                tile.top < o.bottom,
            )
            .map(({ name, rect }) => ({
              cell: el.closest("[data-cell]").dataset.cell,
              overlay: name,
              tile: tile.toJSON(),
              control: rect.toJSON(),
            }));
        });
      });
      if (width >= 1280 && initialZoom > 1)
        assert.deepEqual(
          overlaps,
          [],
          `${width}px: controls do not obscure tiles at the default zoom`,
        );
      if (state === partial)
        await page.screenshot({
          path: `.local/qa/map-partial-default-${width}.png`,
        });
      await zoomOutFully(page);
      if (state !== expanded)
        assert.ok(
          Number(await page.locator(".map-scroll").getAttribute("data-zoom")) <
            1,
          "An incomplete map can zoom out beyond the active tiles",
        );
      if (state === partial)
        await page.screenshot({
          path: `.local/qa/map-partial-overview-${width}.png`,
        });
    }
    await page.screenshot({ path: `.local/qa/map-fit-expanded-${width}.png` });
    await page.close();
  }
  const resizedPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  resizedPage.on("pageerror", (error) => errors.push(error.message));
  await resizedPage.addInitScript(() =>
    localStorage.setItem("vanuatu-map-view", "2d"),
  );
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
    await page.addInitScript(() =>
      localStorage.setItem("vanuatu-map-view", "2d"),
    );
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
    await zoomOutFully(page);
    assert.ok((await zoom()) < 1);
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
