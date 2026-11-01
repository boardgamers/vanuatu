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
    await page.locator("[data-export]").click();
    await page.locator("[data-trade-transition]").waitFor();
    await page.waitForFunction(
      () => !document.querySelector("[data-trade-transition]"),
    );
    assert.equal((await state()).round, 2);
    assert.equal(await page.locator(".goods-slot.empty").count(), 0);
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
