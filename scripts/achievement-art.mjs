// Original achievement geometry. See artwork/achievements/README.md for provenance.
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { achievementDefinitions } from "../engine/achievements.js";
const out = "artwork/achievements";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const p = (d, fill = "#f6d793", extra = "") =>
  `<path d="${d}" fill="${fill}" ${extra}/>`;
const circle = (x, y, r, fill) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const group = (x, y, s, body) =>
  `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;
const island = (x, y, s = 1) =>
  group(
    x,
    y,
    s,
    p("M-30 6Q-36-3-19-10L3-15 25-6Q40 8 20 14L-13 17Z", "#efd49a") +
      p("M-22 3-11-7 7-8 22 1 12 7-10 9Z", "#6ca57b"),
  );
const hut = (x, y, s = 1) =>
  group(
    x,
    y,
    s,
    p("M-14-3H14V18H-14Z", "#eab168") +
      p("M-21-2 0-22 21-2Z", "#c76a40") +
      p("M-4 18V5H5V18", "#3a5550"),
  );
const flag = (x, y, s = 1) =>
  group(
    x,
    y,
    s,
    p("M0 23V-17", "none") + p("M0-17H24L17-8 24 0H0Z", "#f3ae42"),
  );
const boat = (x, y, s = 1, rot = 0, lead = false) =>
  `<g data-boat="true" transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${p("M-21 9H23L13 19H-11Z", lead ? "#f3ae42" : "#e9a982")}${p("M0 8V-23L18 5H0Z", "#fff1c9")}${p("M-19 24H20M-10 14V24M11 14V24", "none")}</g>`;
const shell = (x, y, s = 1) =>
  group(
    x,
    y,
    s,
    p("M-21-10Q0-29 21-10L7 17H-7Z", "#fff0c2") +
      p("M-13-9-4 11M0-15V11M13-9 4 11", "none"),
  );
const label = (n) =>
  `<g stroke="none"><rect x="43" y="91" width="42" height="25" rx="12" fill="#fff1ce"/><text x="64" y="110" text-anchor="middle" font-family="sans-serif" font-size="21" font-weight="bold" fill="#294e50">${n}</text></g>`;
const waves = p(
  "M14 88Q24 80 35 88T57 88T79 88T111 88M25 99Q36 92 47 99T69 99T98 99",
  "none",
  'stroke="#a9ded5"',
);
const flood =
  p("M13 92Q23 63 48 75T83 70Q111 46 110 80Q99 101 75 97T13 106Z", "#469cac") +
  p("M22 89Q35 76 53 85T88 80", "none", 'stroke="#d5eee1"');
const chest = (x, y, s = 1, open = false) =>
  group(
    x,
    y,
    s,
    (open
      ? p("M-24-6-17-28H24L28-6Z", "#d69b48") +
        shell(-10, -6, 0.45) +
        shell(9, -10, 0.55)
      : p("M-24 0V-13Q0-29 24-13V0Z", "#d69b48")) +
      p("M-25 0H25V25H-25Z", "#a96237") +
      p("M-14 0V25M14 0V25", "none", 'stroke="#f2c872" stroke-width="5"') +
      p("M-4 0H4V10H-4Z", "#fff0c2"),
  );
const art = {};
art["island-victory"] =
  island(64, 84, 1.4) + hut(57, 65, 1.25) + flag(77, 40, 0.9);
art["duel-victory"] =
  island(64, 43, 0.65) +
  flag(65, 28, 0.55) +
  boat(33, 70, 0.85, 15, true) +
  boat(91, 77, 0.85, -15);
art["trio-victory"] =
  island(64, 67, 0.65) +
  boat(64, 32, 0.68, 0, true) +
  boat(33, 87, 0.68, -20) +
  boat(95, 87, 0.68, 20) +
  flag(66, 60, 0.5);
art["quartet-victory"] =
  island(64, 64, 0.64) +
  flag(64, 54, 0.5) +
  [
    [64, 28, 0],
    [101, 64, 90],
    [64, 100, 180],
    [27, 64, -90],
  ]
    .map(([x, y, r], i) => boat(x, y, 0.57, r, i === 0))
    .join("");
art["full-table-victory"] =
  island(64, 65, 0.6) +
  flag(65, 54, 0.5) +
  Array.from({ length: 5 }, (_, i) => {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    return boat(
      64 + 39 * Math.cos(a),
      64 + 39 * Math.sin(a),
      0.53,
      i * 72,
      i === 0,
    );
  }).join("");
art["rising-waters-victory"] =
  island(59, 77, 1.2) + hut(53, 59, 1) + flag(73, 36, 0.8) + flood;
art["no-characters-victory"] =
  '<rect x="65" y="35" width="31" height="48" rx="5" fill="#fff0cd" stroke-dasharray="5 4"/>' +
  p("M71 76 89 42", "none", 'stroke="#b15e42"') +
  flag(36, 39, 0.9) +
  [77, 68, 59]
    .map((y) => `<ellipse cx="43" cy="${y}" rx="20" ry="8" fill="#d57b4e"/>`)
    .join("");
art["fifty-points"] =
  island(64, 82, 1.25) +
  hut(45, 70, 0.7) +
  hut(82, 71, 0.7) +
  shell(64, 41, 0.85) +
  label(50);
art["seventy-five-points"] =
  island(64, 86, 1.35) +
  p("M25 81H103V89H25ZM35 65H93V75H35Z", "#bf975a") +
  hut(43, 67, 0.56) +
  hut(85, 67, 0.56) +
  hut(64, 55, 0.6) +
  shell(64, 29, 0.8) +
  p("M35 28 29 22M93 28 99 22M64 8V3", "none", 'stroke="#f3b850"') +
  label(75);
art["nine-vatus"] =
  p("M42 43Q29 63 32 86Q64 111 96 86Q99 63 86 43Z", "#c9864b") +
  '<ellipse cx="64" cy="44" rx="24" ry="10" fill="#354d49"/>' +
  [
    [48, 42],
    [64, 36],
    [79, 44],
  ]
    .map(
      ([x, y]) =>
        circle(x, y, 10, "#f6d385") + p(`M${x - 4} ${y - 4}l4 8 4-8`, "none"),
    )
    .join("") +
  label(9);
art["four-huts"] =
  island(64, 74, 1.45) +
  [
    [44, 49],
    [84, 49],
    [43, 78],
    [85, 78],
  ]
    .map(([x, y]) => hut(x, y, 0.75))
    .join("");
art["three-islands"] =
  p("M64 39 31 83 96 83Z", "none", 'stroke-dasharray="4 5" stroke="#e9d7a6"') +
  [
    [64, 36],
    [33, 83],
    [95, 83],
  ]
    .map(([x, y]) => island(x, y, 0.65) + hut(x, y - 10, 0.6))
    .join("");
art["tourism-twelve"] =
  island(64, 78, 1.4) +
  hut(42, 53, 0.8) +
  hut(86, 53, 0.8) +
  [47, 65, 83]
    .map(
      (x) =>
        circle(x, 71, 5, "#fff2ce") + p(`M${x - 4} 77h8l3 14h-14Z`, "#fff2ce"),
    )
    .join("") +
  shell(64, 26, 0.45) +
  label(12);
art["treasure-six"] =
  island(64, 86, 1.2) + chest(64, 65, 1) + shell(36, 91, 0.4) + label(6);
art["treasure-twelve"] =
  chest(64, 62, 1.3, true) +
  shell(29, 84, 0.5) +
  shell(99, 84, 0.5) +
  label(12);
art["weather-the-waters"] =
  Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return circle(64 + 48 * Math.cos(a), 64 + 48 * Math.sin(a), 4, "#f6d793");
  }).join("") +
  island(64, 68, 0.95) +
  hut(63, 51, 0.9) +
  flood +
  p("M28 77 89 65 95 75 31 88Z", "#b99873");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 256, height: 256 },
  deviceScaleFactor: 1,
});
const manifest = {
  game: "vanuatu",
  engineVersion: "0.2.2",
  revision: 2,
  sourceSha256: hash(await readFile("scripts/achievement-art.mjs")),
  provenance: "README.md",
  assets: [],
};
for (const a of achievementDefinitions().achievements) {
  if (!art[a.id]) throw Error(a.id);
  const key = `achievement-${a.id}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 128 128"><circle cx="64" cy="64" r="62" fill="#285c60" stroke="#efd49a" stroke-width="3"/><g stroke="#344e47" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${waves}${art[a.id]}</g></svg>`;
  await writeFile(`${out}/${key}.svg`, svg);
  await page.setContent(
    `<style>body{margin:0;background:transparent}svg{display:block}</style>${svg}`,
  );
  const png = await page.screenshot({ omitBackground: true });
  await writeFile(`${out}/${key}.png`, png);
  manifest.assets.push({
    id: a.id,
    key,
    svg: `${key}.svg`,
    png: `${key}.png`,
    svgSha256: hash(svg),
    pngSha256: hash(png),
    width: 256,
    height: 256,
  });
}
await writeFile(
  `${out}/manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
for (const dark of [false, true]) {
  await page.setViewportSize({ width: 1000, height: 1000 });
  await page.setContent(
    `<style>body{margin:0;padding:20px;background:${dark ? "#17252c" : "#fff8ea"};color:${dark ? "#fff1cf" : "#294e50"};font:14px sans-serif}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article{height:215px;text-align:center}img{vertical-align:middle;border-radius:50%;margin:5px}</style><h2>Vanuatu · 32 / 48 / 64 / 96 px · ${dark ? "dark" : "light"}</h2><main>${await Promise.all(manifest.assets.map(async (a) => `<article><p>${a.id}</p>${[32, 48, 64, 96].map((n) => `<img width="${n}" height="${n}" src="data:image/png;base64,${""}" data-key="${a.key}">`).join("")}</article>`)).then((xs) => xs.join(""))}</main>`,
  );
  for (const a of manifest.assets) {
    const data = (await readFile(`${out}/${a.png}`)).toString("base64");
    await page
      .locator(`[data-key="${a.key}"]`)
      .evaluateAll(
        (els, data) =>
          els.forEach((el) => (el.src = `data:image/png;base64,${data}`)),
        data,
      );
  }
  await page.evaluate(() =>
    Promise.all([...document.images].map((i) => i.decode())),
  );
  await page.screenshot({
    path: `${out}/contact-${dark ? "dark" : "light"}.png`,
  });
}
await browser.close();
