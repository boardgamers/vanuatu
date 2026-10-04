import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pictogramText } from "../viewer/prose.js";
import { LESSON } from "../viewer/tutorial-copy.js";
import { languages } from "../viewer/localization/runtime.js";

for (const locale of Object.keys(languages))
  test(`tutorial prose preserves ${locale} grammar around the four symbols`, async () => {
    const catalog = JSON.parse(
      await readFile(
        new URL(`../viewer/localization/${locale}.json`, import.meta.url),
        "utf8",
      ),
    );
    const text = catalog[LESSON.beggarStart];
    const html = pictogramText(text, locale);
    for (const name of ["coin", "point", "draw", "build"])
      assert.ok(html.includes(`icon-${name}`), `${locale}: ${name}`);
    // Replace the generated icon with its accessible name: no translated text,
    // punctuation or amounts may disappear or change order.
    const plain = html.replace(
      /<span class="prose-icon" role="img" aria-label="([^"]*)"[^>]*>.*?<\/span>/g,
      "$1",
    );
    const escaped = text.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
    assert.equal(plain, escaped);
  });

test("prose escapes HTML and matches whole terms without changing character names", () => {
  assert.equal(
    pictogramText('<img src=x onerror="oops"> Builder Drawbridge rebuild'),
    "&lt;img src=x onerror=&quot;oops&quot;&gt; Builder Drawbridge rebuild",
  );
  assert.match(
    pictogramText("5 points de prospérité", "fr"),
    /aria-label="points de prospérité"/,
  );
  assert.equal(
    (pictogramText("5 points de prospérité", "fr").match(/prose-icon/g) ?? [])
      .length,
    1,
  );
  assert.match(pictogramText("0바투", "ko"), /icon-coin/);
  assert.match(pictogramText("0 رفاه", "fa-IR"), /icon-point/);
});
