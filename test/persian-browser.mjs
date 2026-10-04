import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createTutorial } from "@boardgamers/protocol/tutorial";
import { chapters, chapterMetadata } from "../viewer/tutorials.js";
import { availableMoves, stripSecret, init } from "../engine/index.js";
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/viewer.css"><div id="game"></div><script src="/viewer.js"></script>',
      );
    } else {
      res.setHeader(
        "Content-Type",
        req.url.endsWith(".css") ? "text/css" : "text/javascript",
      );
      res.end(await readFile(new URL("../dist" + req.url, import.meta.url)));
    }
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch();
await mkdir(".local/qa", { recursive: true });
try {
  for (const width of [390, 1440])
    for (const { id } of chapterMetadata) {
      const chapter = chapters[id];
      const lesson = await createTutorial(chapter);
      const p = await browser.newPage({ viewport: { width, height: 1000 } });
      p.setDefaultTimeout(5000);
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(`http://127.0.0.1:${server.address().port}/`);
      await p.evaluate(async (id) => {
        window.progress = null;
        await window.vanuatu.launchTutorial("#game", {
          chapter: id,
          locale: "fa-IR",
          onProgress: (v) => (window.progress = v),
        });
      }, id);
      let guard = 0;
      while (!lesson.snapshot.completed && guard++ < 45) {
        const snap = lesson.snapshot;
        await p.waitForFunction(
          (step) => window.progress?.step === step,
          snap.step,
        );
        if (snap.canContinue) {
          await p
            .locator('.bgs-tutorial-playback button[title="ادامه"]')
            .click();
          await lesson.continue();
          continue;
        }
        const prose = await p.locator(".bgs-tutorial-body").innerText();
        assert.match(prose, /[\u0600-\u06ff]/u);
        assert.doesNotMatch(prose, /Choose |Your |You |Before |After /);
        assert.equal(
          await p
            .locator(".bgs-tutorial-guide")
            .evaluate((el) => getComputedStyle(el).direction),
          "rtl",
        );
        assert.equal(
          await p
            .locator("svg.archipelago")
            .evaluate((el) => getComputedStyle(el).direction),
          "ltr",
        );
        const step = chapter.steps[snap.step];
        const m = availableMoves(snap.state, 0)
          .sort((a, b) => (a.path?.length ?? 0) - (b.path?.length ?? 0))
          .find((m) => !step.validateMove?.(snap.state, m));
        assert.ok(m, `${id}/${step.id}`);
        const idx = stripSecret(snap.state, 0).legal.findIndex(
          (a) => JSON.stringify(a) === JSON.stringify(m),
        );
        if (m.type === "character")
          await p.locator(`[data-character-choice="${m.character}"]`).click();
        else if (m.type === "plan")
          for (const action of m.actions)
            await p.locator(`[data-action="${action}"]`).click();
        else if (m.type === "place") {
          await p.locator(`[data-tile="${m.tile}"]`).click();
          await p.locator(`.map-cell[data-cell="${m.cell}"]`).click();
        } else if (["act", "discard"].includes(m.type)) {
          await p.locator(`[data-action="${m.action}"]`).click();
          const toggle = p.locator("[data-bonus]");
          if (await toggle.count()) await toggle.setChecked(!!m.bonus);
          const cell = m.cell ?? m.path?.at(-1);
          if (cell) await p.locator(`.map-cell[data-cell="${cell}"]`).click();
        } else if (["treasure", "beg"].includes(m.type))
          await p.locator(`[data-free="${m.type}"]`).click();
        else if (m.type === "governor")
          await p.locator("[data-governor]").click();
        const root = (await p.locator("dialog[open]").count())
          ? "dialog[open]"
          : ".turn-tray";
        await p.locator(`${root} [data-move="${idx}"]`).click();
        if (await p.locator("[data-confirmed-retrieval]").count())
          await p.locator("[data-confirmed-retrieval]").click();
        assert.equal(await lesson.play(m), true, `${id}/${step.id}`);
      }
      assert.ok(lesson.snapshot.completed, id);
      await p.waitForFunction(() => window.progress?.completed);
      assert.deepEqual(errors, [], id);
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${id}: overflow`,
      );
      await p.screenshot({ path: `.local/qa/persian-${id}-${width}.png` });
      await p.reload();
      await p.evaluate(async (id) => {
        window.progress = null;
        await window.vanuatu.launchTutorial("#game", {
          chapter: id,
          locale: "fa-IR",
          onProgress: (v) => (window.progress = v),
        });
      }, id);
      await p.waitForFunction(() => window.progress?.completed);
      lesson.destroy();
      await p.close();
      console.log(
        `${width}: Persian ${id} completed and restored (${chapter.steps.length} steps)`,
      );
    }

  for (const width of [390, 1440]) {
    const p = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await p.goto(`http://127.0.0.1:${server.address().port}/`);
    const state = init(3, [], {}, "persian-switch");
    state.players[0].name = "Draw";
    await p.evaluate(
      (state) => {
        window.host = vanuatu.launch("#game");
        host.emit("player", { index: 0 });
        host.emit("preferences", { locale: "en", sound: false });
        host.emit("state", state);
      },
      stripSecret(state, 0),
    );
    await p.locator("svg.archipelago").waitFor();
    const geometry = () =>
      p
        .locator("svg.archipelago")
        .evaluate((el) =>
          [...el.querySelectorAll("path,g,image,rect")].map((node) =>
            ["d", "x", "y", "width", "height", "transform", "data-cell"].map(
              (attr) => node.getAttribute(attr),
            ),
          ),
        );
    const before = await geometry();
    await p.evaluate(() =>
      host.emit("preferences", { locale: "fa-IR", sound: false }),
    );
    await p.waitForFunction(
      () =>
        document.querySelector('[data-action="sail"] .action-label')
          ?.textContent === "قایقرانی",
    );
    assert.deepEqual(
      await geometry(),
      before,
      "Persian leaves map coordinates and transforms unchanged",
    );
    assert.equal(await p.locator('[data-bgs-player="0"]').innerText(), "Draw");
    await p.locator("[data-help]").first().click();
    assert.equal(
      await p
        .locator("dialog[open]")
        .evaluate((el) => getComputedStyle(el).direction),
      "rtl",
    );
    assert.match(await p.locator("dialog[open]").innerText(), /شکوفایی/);
    await p.locator("[data-close]").click();
    await p.evaluate(() =>
      host.emit("preferences", { locale: "en", sound: false }),
    );
    await p.waitForFunction(
      () =>
        document.querySelector('[data-action="sail"] .action-label')
          ?.textContent === "Sail",
    );
    assert.deepEqual(await geometry(), before);
    assert.deepEqual(errors, []);
    await p.close();
    console.log(`${width}: fa-IR switching, player names and geometry passed`);
  }
} finally {
  await browser.close();
  server.close();
}
