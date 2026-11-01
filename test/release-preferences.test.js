import test from "node:test";
import assert from "node:assert/strict";
import { releasePreferences } from "../scripts/release-preferences.mjs";

test("release replaces animation preference with a persistent view selector, preserving existing sound and shared options", () => {
  const existing = [
    { name: "colorBlind", type: "checkbox", default: false },
    { name: "sound", type: "checkbox", default: false, label: "Sound" },
    { name: "animations", type: "checkbox", default: true },
  ];
  const before = structuredClone(existing);
  const next = releasePreferences(existing);
  assert.deepEqual(next.slice(0, 2), existing.slice(0, 2));
  assert.equal(
    next.some((p) => p.name === "animations"),
    false,
  );
  assert.equal(next.at(-1).default, "3d");
  assert.deepEqual(
    next.at(-1).items.map((p) => p.name),
    ["2d", "3d"],
  );
  assert.deepEqual(existing, before);
  assert.deepEqual(releasePreferences(next), next);
});

test("a missing sound preference is added once", () => {
  const next = releasePreferences([]);
  assert.equal(next.find((p) => p.name === "sound").default, true);
  assert.deepEqual(releasePreferences(next), next);
});
