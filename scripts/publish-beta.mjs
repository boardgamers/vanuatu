import { chapterMetadata } from "../viewer/tutorials.js";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
if (existing?.public)
  throw Error("Refusing to change a public release with the beta publisher.");
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
  preferences: [
    {
      name: "colorBlind",
      label: "Color-blind mode",
      type: "checkbox",
      default: false,
    },
    { name: "sound", label: "Game sounds", type: "checkbox", default: false },
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
execFileSync("pnpm", ["pack", "--pack-destination", ".local/release"], {
  stdio: "inherit",
});
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const engine = await api(
  "/1/engine",
  "POST",
  await readFile(`.local/release/boardgamers-vanuatu-${pkg.version}.tgz`),
  "application/octet-stream",
);
const js = await readFile("dist/viewer.js"),
  css = await readFile("dist/viewer.css");
const hash = createHash("sha256")
  .update(js)
  .update(css)
  .digest("hex")
  .slice(0, 16);
const viewer = await api(
  `/1/viewer/file?filename=viewer.js&bundle=${hash}`,
  "POST",
  js,
  "application/octet-stream",
);
const style = await api(
  `/1/viewer/file?filename=viewer.css&bundle=${hash}`,
  "POST",
  css,
  "application/octet-stream",
);
const { unlisted: _unlisted, ...previous } = existing ?? {};
await api("/1", "PUT", {
  ...previous,
  ...defaults,
  engine: { ...engine.engine, entryPoint: "dist/engine.js" },
  viewer: {
    ...defaults.viewer,
    url: viewer.url,
    dependencies: { scripts: [], stylesheets: [style.url] },
  },
});
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
const published = await api("/1"),
  meta = await api("/meta");
assert.equal(published.public, false);
assert.ok(!meta.unlisted);
assert.equal(published.engine.package.version, pkg.version);
assert.equal(published.viewer.chat, true);
await writeFile(
  ".local/release/published.json",
  JSON.stringify(published, null, 2),
);
console.log(
  JSON.stringify({
    beta: !published.public,
    listed: !meta.unlisted,
    engine: published.engine.package.version,
    viewer: published.viewer.url,
    betaUsers: (await api("/beta-users")).map((u) => u.username),
  }),
);
