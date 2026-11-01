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
const browser = await chromium.launch();
await mkdir(".local/qa", { recursive: true });
try {
  for (const width of [900, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/?new&hotseat");
    await page.waitForFunction(() => window.vanuatuDemo);
    const state = E.init(3, [], {}, "mouse-pan");
    state.phase = "actions";
    state.first = state.actor = 0;
    state.players[0].boat = "1,0";
    state.players[0].money = 5;
    state.players[0].character = null;
    state.players[0].markers.sail = 1;
    state.players[0].markers.build = 1;
    await page.evaluate((s) => window.vanuatuDemo.setState(s), state);
    await page.locator(".map-scroll[data-zoom]").waitFor();
    const map = page.locator(".map-scroll");
    for (let i = 0; i < 2; i++) await page.locator("[data-zoom-in]").click();
    await page.locator('[data-action="sail"]').click();
    const target = page.locator('.map-cell[data-cell="1,1"]');
    assert.ok(await target.evaluate((el) => el.classList.contains("legal")));
    const original = await page.evaluate(() =>
      JSON.stringify(window.vanuatuDemo.state),
    );
    await map.evaluate((el) =>
      el.addEventListener(
        "pointerdown",
        (e) => (window.lastPointer = e.pointerId),
      ),
    );
    const scroll = () =>
      map.evaluate((el) => ({
        x: el.scrollLeft,
        y: el.scrollTop,
        maxX: el.scrollWidth - el.clientWidth,
        maxY: el.scrollHeight - el.clientHeight,
      }));
    async function centerTarget() {
      await target.scrollIntoViewIfNeeded();
      const b = await target.boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }
    // A tiny hand movement must still be an ordinary tile selection.
    let start = await centerTarget();
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 2, start.y + 1);
    await page.mouse.up();
    assert.equal(
      await page.locator('.map-cell.selected[data-cell="1,1"]').count(),
      1,
    );
    await page.locator('[data-action="sail"]').click();
    assert.equal(await page.locator(".map-cell.selected").count(), 0);
    // Drag from a selectable tile; it should pan both axes without selecting it.
    start = await centerTarget();
    const before = await scroll();
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 90, start.y - 65, { steps: 8 });
    assert.equal(await map.getAttribute("data-pan"), "dragging");
    assert.equal(
      await target.evaluate((el) => getComputedStyle(el).cursor),
      "grabbing",
    );
    assert.ok(
      await map.evaluate((el) => el.hasPointerCapture(window.lastPointer)),
    );
    const moved = await scroll();
    assert.ok(Math.abs(moved.x - Math.min(before.x + 90, before.maxX)) < 2);
    assert.ok(Math.abs(moved.y - Math.min(before.y + 65, before.maxY)) < 2);
    assert.ok(moved.x - before.x > 30 && moved.y - before.y > 30);
    await page.mouse.up();
    assert.equal(await map.getAttribute("data-pan"), "ready");
    assert.equal(
      await page.locator(".map-cell.selected, dialog[open]").count(),
      0,
    );
    assert.equal(await page.evaluate(() => getSelection().toString()), "");
    assert.equal(
      await page.evaluate(() => JSON.stringify(window.vanuatuDemo.state)),
      original,
    );
    // The next click and keyboard selection work immediately after a drag.
    await target.click();
    assert.equal(
      await page.locator('.map-cell.selected[data-cell="1,1"]').count(),
      1,
    );
    await page.locator('[data-action="sail"]').click();
    await target.focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await page.locator('.map-cell.selected[data-cell="1,1"]').count(),
      1,
    );
    await page.locator('[data-action="sail"]').click();
    // Pointer capture follows the cursor beyond the map and releases cleanly.
    start = await centerTarget();
    const box = await map.boundingBox();
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(box.x - 10, box.y + 100, { steps: 8 });
    await page.mouse.up();
    assert.equal(await map.getAttribute("data-pan"), "ready");
    assert.equal(
      await page.locator(".map-cell.selected, dialog[open]").count(),
      0,
    );
    assert.equal(
      await map.evaluate((el) => el.hasPointerCapture(window.lastPointer)),
      false,
    );
    // Cancellation or losing window focus must never leave a stuck dragging state.
    for (const cancel of ["pointercancel", "blur"]) {
      start = await centerTarget();
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x - 20, start.y - 20, { steps: 3 });
      await page.evaluate((type) => {
        if (type === "blur") window.dispatchEvent(new Event("blur"));
        else
          document
            .querySelector(".map-scroll")
            .dispatchEvent(
              new PointerEvent(type, {
                bubbles: true,
                pointerId: window.lastPointer,
                pointerType: "mouse",
              }),
            );
      }, cancel);
      await page.mouse.up();
      assert.equal(await map.getAttribute("data-pan"), "ready");
      assert.equal(
        await map.evaluate((el) => el.hasPointerCapture(window.lastPointer)),
        false,
      );
    }
    await page
      .locator(".sea-board")
      .screenshot({ path: `.local/qa/map-drag-${width}.png` });
    while (
      (await page.locator("[data-zoom-out]").getAttribute("aria-disabled")) !==
      "true"
    )
      await page.locator("[data-zoom-out]").click();
    assert.equal(
      await map.getAttribute("data-pan"),
      "none",
      "No grab cursor when the whole map fits",
    );
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `${width}: mouse pan, click threshold, no accidental selection, keyboard, outside release and cancellation passed`,
    );
  }
} finally {
  await browser.close();
  server.close();
}
