import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serveViewerCheck } from "./three-viewer-fixture.mjs";
const { server, base } = await serveViewerCheck();
const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/qa/hosted.html");
    await page.locator(".map-3d canvas").waitFor();
    const state = () => page.locator("#status").textContent().then(JSON.parse);
    assert.equal(
      (await state()).updates.length,
      0,
      "Receiving preferences never echoes them",
    );
    // Rebuilding the 3D board must retain/reuse the resource-letter textures.
    for (const enabled of [true, false, true]) {
      await page.locator("[data-color-blind]").click();
      assert.equal((await state()).preferences.colorBlind, enabled);
      assert.equal(
        await page.locator(".export-reference .resource-symbol").count(),
        enabled ? 3 : 0,
      );
    }
    await page.locator('[data-map-view="2d"]').click();
    assert.equal(
      await page.locator(".vanuatu").getAttribute("data-map-view"),
      "2d",
    );
    assert.deepEqual((await state()).updates.at(-1), {
      name: "mapView",
      value: "2d",
    });
    assert.equal(
      await page.locator(".goods-slot.empty").first().getAttribute("opacity"),
      "0.55",
    );
    await page.locator("[data-help]").first().click();
    assert.equal(await page.locator('[data-pref="animations"]').count(), 0);
    await page.locator("[data-map-preference]").selectOption("3d");
    assert.deepEqual((await state()).updates.at(-1), {
      name: "mapView",
      value: "3d",
    });
    await page.locator('[data-pref="sound"]').check();
    assert.deepEqual((await state()).updates.at(-1), {
      name: "sound",
      value: true,
    });
    await page.locator("dialog [data-close]").click();
    const count = (await state()).updates.length;
    await page.locator("[data-remote]").click();
    assert.equal(
      await page.locator(".vanuatu").getAttribute("data-map-view"),
      "2d",
    );
    assert.equal((await state()).updates.length, count);
    await page.goto(base + "/qa/hosted.html?saved");
    assert.equal((await state()).preferences.mapView, "3d");
    await page.locator(".map-3d canvas").waitFor();
    const reference = page.locator(".trade-info > .export-reference");
    assert.deepEqual(
      await reference
        .locator(".export-rate")
        .evaluateAll((rates) =>
          rates.map((rate) => [
            rate.getAttribute("role"),
            rate.title,
            rate.getAttribute("aria-label"),
          ]),
        ),
      [
        "Kava : −1 vatus → +1 prospérité",
        "Coprah : −2 vatus → +3 prospérité",
        "Bœuf : −3 vatus → +5 prospérité",
      ].map((label) => ["img", label, label]),
    );
    assert.equal(await reference.locator(".export-completion").count(), 1);
    assert.equal(
      await reference.locator(".export-completion b").textContent(),
      "2",
    );
    const referenceBefore = await reference.evaluate((el) => {
      window.exportReferenceBefore = el;
      return el.outerHTML;
    });
    async function assertReferencePersists() {
      assert.equal(await reference.count(), 1);
      assert.equal(
        await reference.evaluate((el) => el.outerHTML),
        referenceBefore,
      );
      assert.ok(
        await reference.evaluate((el) => el === window.exportReferenceBefore),
      );
      assert.equal(
        await page.locator(".trade-info > .demand-ships").count(),
        1,
      );
      await reference.scrollIntoViewIfNeeded();
      assert.ok(
        await reference.evaluate((el) =>
          [...el.querySelectorAll(".export-rate, .export-completion")].every(
            (rate) =>
              [rate, ...rate.querySelectorAll("svg, b")].every((part) => {
                const r = part.getBoundingClientRect();
                return (
                  document
                    .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
                    ?.closest(".export-rate, .export-completion") === rate
                );
              }),
          ),
        ),
        "The reference stays hoverable above the 3D map during and after the final export",
      );
    }
    await assertReferencePersists();
    await page.locator("[data-export]").click();
    await page.locator("[data-trade-transition]").waitFor();
    await assertReferencePersists();
    await page.waitForFunction(
      () => !document.querySelector("[data-trade-transition]"),
    );
    assert.equal((await state()).round, 2);
    assert.equal(await page.locator(".goods-slot.empty").count(), 0);
    assert.equal(
      await page.locator('.demand-ship[data-ship="101"]').count(),
      0,
    );
    await assertReferencePersists();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(
      () => document.querySelector(".vanuatu").dataset.animations === "false",
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  const page = await browser.newPage();
  await page.goto(base + "/qa/hosted.html?no-webgl");
  await page.waitForFunction(
    () => document.querySelector(".vanuatu")?.dataset.mapView === "2d",
  );
  assert.equal(await page.locator('[data-map-view="3d"]').isDisabled(), true);
  await page.close();
  console.log(
    "Hosted 2D/3D persistence, remote changes, sound, refill transitions, reduced motion and WebGL fallback passed.",
  );
} finally {
  await browser.close();
  server.close();
}
