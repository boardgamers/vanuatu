import { uploadViewerFiles } from "./viewer-files.mjs";
import { chapterMetadata } from "../viewer/tutorials.js";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const token = (await readFile(`${homedir()}/.bgs`, "utf8")).trim();
const base = "https://admin.boardgamers.space/api/admin/gameinfo/vanuatu";
async function api(path, method = "GET", body, contentType) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": contentType ?? "application/json" } : {}),
    },
    body: body ? (contentType ? body : JSON.stringify(body)) : undefined,
  });
  if (!response.ok)
    throw Error(
      `${method} ${path}: ${response.status} ${await response.text()}`,
    );
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
const versions = await api("/versions");
const existing = versions.some((v) => v.version === 1) ? await api("/1") : null;
// Existing entries receive only changed release fields; all other metadata is kept.
const live = !!existing?.public;
const defaults = {
  public: false,
  meta: { botsPublic: true },
  label: "🏝️ Vanuatu",
  players: [2, 3, 4, 5],
  description:
    "Compete for prosperity in a growing Pacific archipelago. Plan actions, sail, trade and welcome tourists. Includes all eleven characters, the official two-player variant and Rising Waters.",
  credits:
    "Designed by **Alain Epron**. Artwork by **Konstantin Vohwinkel**; graphic design and rulebook by **Rafaël Theunis**.\n\n[Vanuatu — Quined Games, second edition (2016)](https://www.quined.nl/featured_item/vanuatu-2nd-edition/). Supplied artwork used with permission for this adaptation.\n\n[Source code](https://codeberg.org/boardgamers/vanuatu).",
  links: {
    source: "https://codeberg.org/boardgamers/vanuatu",
    publisher: "https://www.quined.nl/featured_item/vanuatu-2nd-edition/",
    bgg: "https://boardgamegeek.com/boardgame/193927/vanuatu-second-edition",
  },
  rules:
    "[Original rules (English PDF)](https://www.quined.nl/wp-content/uploads/2019/01/Vanuatu_Rulebook_UK_WEBversion-4.pdf) · [Official two-player rules](https://quined.nl/wp-content/uploads/2017/06/Vanuatu2p_EN.pdf)\n\n**Eight rounds to prosper.** Choose a character, then place five action markers in batches of 2, 2 and 1. Resolve one action at a time where you have the most markers; ties follow player order. Retrieve all your markers from that action. With no majority, retrieve a stack without acting.\n\nSail to reach fish and treasure, or trade and build beside islands. Every 10 vatus becomes 5 prosperity immediately. At the end, remaining money and treasure score points; every hut earns 2 prosperity per tourist on its island. Most prosperity wins.",
  viewer: {
    url: "",
    topLevelVariable: "vanuatu",
    fullScreen: true,
    fullScreenMobile: true,
    replayable: true,
    chat: true,
    thumbnail: true,
    dependencies: { scripts: [], stylesheets: [] },
  },
  settings: [
    {
      name: "autoRetrieve",
      label: "Automatically retrieve markers when there is no choice",
      type: "checkbox",
      default: false,
    },
  ],
  preferences: [
    {
      name: "colorBlind",
      label: "Color-blind mode",
      type: "checkbox",
      default: false,
    },
    { name: "sound", label: "Game sounds", type: "checkbox", default: true },
    {
      name: "language",
      label: "Language",
      type: "select",
      default: "en",
      items: [
        { name: "en", label: "English" },
        { name: "fr", label: "Français" },
      ],
    },
  ],
  tutorial: { chapters: chapterMetadata },
  options: [
    {
      name: "characters",
      label: "Character powers",
      type: "checkbox",
      default: true,
    },
  ],
  expansions: [{ name: "rising-waters", label: "Rising Waters" }],
};
if (!existing) await api("/1", "PUT", defaults);
await mkdir(".local/release", { recursive: true });
if (existing)
  await writeFile(
    ".local/release/before.json",
    JSON.stringify(existing, null, 2),
  );
execFileSync("npm", ["pack", "--pack-destination", ".local/release"], {
  stdio: "inherit",
});
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const engine = await api(
  "/1/engine",
  "POST",
  await readFile(`.local/release/boardgamers-vanuatu-${pkg.version}.tgz`),
  "application/octet-stream",
);
const files = await uploadViewerFiles(
  "dist",
  "viewer.js",
  ["viewer.css"],
  (query, bytes) =>
    api("/1/viewer/file?" + query, "POST", bytes, "application/octet-stream"),
);
const viewer = { url: files.url },
  style = { url: files.stylesheets[0] };
const patch = {
  settings: [
    ...(existing?.settings ?? []).filter(
      (setting) => setting.name !== "autoRetrieve",
    ),
    ...defaults.settings,
  ],
  tutorial: {
    ...(existing?.tutorial ?? defaults.tutorial),
    chapters: existing?.tutorial?.chapters
      ? existing.tutorial.chapters.map((chapter) =>
          chapter.id === "full-round"
            ? {
                ...chapter,
                version: chapterMetadata.find((c) => c.id === "full-round")
                  .version,
              }
            : chapter,
        )
      : chapterMetadata,
  },
  engine: { ...engine.engine, entryPoint: "dist/engine.js" },
  viewer: {
    ...(existing?.viewer ?? defaults.viewer),
    url: viewer.url,
    scriptBytes: files.scriptBytes,
    dependencies: {
      ...(existing?.viewer?.dependencies ?? defaults.viewer.dependencies),
      stylesheets: [style.url],
    },
  },
};
if (existing) {
  for (const field of ["settings", "tutorial"])
    if (JSON.stringify(patch[field]) === JSON.stringify(existing[field]))
      delete patch[field];
}
await writeFile(".local/release/patch.json", JSON.stringify(patch, null, 2));
await api("/1", "PUT", patch);
if (!existing) {
  await api("/meta", "PUT", { unlisted: null });
  await api(
    "/assets/cover?name=Vanuatu",
    "PUT",
    await readFile("viewer/assets/cover.webp"),
    "image/webp",
  );
  const access = await api("/beta-users");
  if (!access.some((u) => u.username === "coyotte508"))
    await api("/beta-users", "POST", { usernameOrEmail: "coyotte508" });
}
const published = await api("/1"),
  meta = await api("/meta");
assert.equal(published.public, live);
if (existing) {
  for (const [field, value] of Object.entries(existing))
    if (!["engine", "viewer", "settings", "tutorial", "updatedAt"].includes(field))
      assert.deepEqual(
        published[field],
        value,
        `Unexpected metadata change: ${field}`,
      );
} else assert.ok(!meta.unlisted);
assert.equal(published.engine.package.version, pkg.version);
assert.equal(published.viewer.chat, true);
await writeFile(
  ".local/release/published.json",
  JSON.stringify(published, null, 2),
);
console.log(
  JSON.stringify({
    public: published.public,
    listed: !meta.unlisted,
    engine: published.engine.package.version,
    viewer: published.viewer.url,
    betaUsers: (await api("/beta-users")).map((u) => u.username),
  }),
);
