import test from "node:test";
import assert from "node:assert/strict";
import {
  createTranslator,
  resolveLocale,
} from "../viewer/localization/runtime.js";

const catalogs = {
  nl: {
    Draw: "Tekenen",
    Round: "Ronde",
    "{p0} buys {p1} for {p2} coins.": "Voor {p2} munten koopt {p0} {p1}.",
    "{p0} fish": "{p0} vissen",
    Sail: "Navigeren",
  },
};

test("locale negotiation preserves regional language variants", () => {
  for (const [input, expected] of [
    ["nl-BE", "nl"],
    ["NL-nl", "nl"],
    ["pt", "pt-BR"],
    ["zh-Hant", "zh-TW"],
    ["zh-CN", "en"],
    [undefined, "en"],
  ])
    assert.equal(resolveLocale(input), expected);
});

test("sentence translations can reorder values while protecting player names", () => {
  const translator = createTranslator(catalogs, "nl");
  translator.setNames(["Draw"]);
  assert.equal(
    translator.translate("Draw buys 2 fish for 3 coins."),
    "Voor 3 munten koopt Draw 2 vissen.",
  );
  assert.equal(translator.translate("Draw"), "Draw");
});

test("switching locale preserves original input, numbers and whitespace", () => {
  const translator = createTranslator(catalogs, "nl");
  assert.equal(translator.translate("  Round 3/8\n"), "  Ronde 3/8\n");
  assert.equal(translator.translate("Sail"), "Navigeren");
  translator.setLocale("en");
  assert.equal(translator.translate("Sail"), "Sail");
  assert.equal(translator.translate("Unknown content"), "Unknown content");
  assert.equal(translator.translate("3/8"), "3/8");
});
