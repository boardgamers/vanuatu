// The "Undo my move" header control BGS enables in games against bots (protocol `undo`).
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
server.unref();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : {}),
});
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/?new&hotseat`);
await page.waitForSelector("[data-character-choice]");

const undo = page.locator("[data-undo-move]");
assert.equal(await undo.count(), 0, "hidden until BGS offers undo");
await page.evaluate(() => window.vanuatuDemo.ui.setUndoAvailable(true));
assert.equal(await undo.getAttribute("title"), "Undo my move");
await undo.click();
assert.equal(await page.evaluate(() => window.vanuatuDemo.undoRequests), 1);

await page.evaluate(() => window.vanuatuDemo.ui.setEnabled(false));
assert.equal(await undo.count(), 0, "hidden while replaying");
await page.evaluate(() => window.vanuatuDemo.ui.setEnabled(true));
await page.evaluate(() => window.vanuatuDemo.ui.setUndoAvailable(false));
assert.equal(await undo.count(), 0);
assert.deepEqual(errors, []);
await browser.close();
console.log("undo control ok");
