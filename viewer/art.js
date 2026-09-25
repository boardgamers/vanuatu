export const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  sail: '<path d="M12 3Q24 6 28 19L12 21Z" fill="currentColor" stroke="#244e53" stroke-width=".8"/><path d="M11 2v21M11 5v14" fill="none" stroke="#244e53" stroke-width="1.4"/><path d="m3 24 27-5-7 10H10Z" fill="currentColor" stroke="#244e53" stroke-width=".8"/><path d="m5 24 23-4" fill="none" stroke="#fff5d5" stroke-width="1.2"/>',
  fish: '<path d="M4 16C10 4 21 5 26 12l5-5v18l-5-5C18 28 10 27 4 16Z" fill="#df83a4" stroke="#a6426a"/><circle cx="10" cy="14" r="1.5" fill="#713847"/>',
  sell: '<path d="M3 10h26l-2 17H5z" fill="#d3a163" stroke="#754627"/><path d="M8 5h16l4 6H4z" fill="#f4bc65"/><path d="M8 16h16M8 21h16" stroke="#805938"/>',
  explore:
    '<path d="M6 4h20l5 12-5 12H6L1 16z" fill="#eab343" stroke="#8d5a1d"/><path d="M9 12h14v11H9zM9 12a7 7 0 0 1 14 0" fill="#b57132" stroke="#754a25"/><path d="M16 12v8" stroke="#ffe9a3" stroke-width="3"/>',
  build:
    '<path d="M4 15 16 4l12 11v14H5z" fill="currentColor" stroke="#684b2d"/><path d="m1 15 15-13 15 13" fill="none" stroke="#876031" stroke-width="3"/><path d="M13 20h7v9h-7z" fill="#f8e7ba"/>',
  draw: '<circle cx="16" cy="16" r="14" fill="#ead293"/><path d="M8 13q7-12 15 0t-15 0m0 6q7-12 15 0t-15 0M11 5v22m10-22v22" fill="none" stroke="#91663d" stroke-width="1.5"/>',
  tourist:
    '<circle cx="16" cy="7" r="5" fill="#fff4d4" stroke="#977c57"/><path d="M12 12h8l5 16H7z" fill="#fff4d4" stroke="#977c57"/>',
  rest: '<path d="M2 13q14-22 28 0H2z" fill="#e5983b" stroke="#935b26"/><path d="M16 13v17" stroke="#795431" stroke-width="2"/><path d="m4 25 20-7 4 4-22 8z" fill="#eeebcf" stroke="#82764e"/>',
  coin: '<path d="M4 7q12-5 24 0v18q-12 5-24 0z" fill="#e1c48c" stroke="#826749"/><path d="M5 8q11 5 22 0M6 25l19-16" stroke="#fff0ce"/><text x="16" y="23" text-anchor="middle" font-size="17" font-weight="bold" fill="#725939">V</text>',
  point:
    '<path d="M3 9Q16 0 29 9L20 29h-8z" fill="#ecd7b0" stroke="#9d7950"/><path d="m7 10 7 15m2-17v17m9-15-7 15" stroke="#b69a72"/>',
  first:
    '<path d="M9 30V3m0 1h18l-5 7 5 7H9" fill="#e88743" stroke="#5a5b52" stroke-width="2.5"/>',
  water:
    '<path d="M16 2S5 14 5 21a11 11 0 0 0 22 0C27 14 16 2 16 2Z" fill="#419ed2" stroke="#236b9b"/><path d="M10 20q0 7 6 7" fill="none" stroke="#bfeafa" stroke-width="2"/>',
  dike: '<path d="m2 23 23-17 5 5L7 28z" fill="#987450" stroke="#674527"/>',
  kava: '<path d="m4 7 18-3 7 4-18 4z" fill="#b9e26a"/><path d="M4 7v20l7 3V12z" fill="#77ae35"/><path d="m11 12 18-4v19l-18 3z" fill="#90ce40" stroke="#649b2a"/>',
  copra:
    '<path d="m4 7 18-3 7 4-18 4z" fill="#fffbed"/><path d="M4 7v20l7 3V12z" fill="#cecbba"/><path d="m11 12 18-4v19l-18 3z" fill="#f7f4df" stroke="#b7b6a2"/>',
  beef: '<path d="m4 7 18-3 7 4-18 4z" fill="#f59274"/><path d="M4 7v20l7 3V12z" fill="#b94b40"/><path d="m11 12 18-4v19l-18 3z" fill="#e76754" stroke="#b84437"/>',
  buy: '<path d="M3 23h27l-5 6H8zM16 2v20M17 5l12 15H17z" fill="#986541" stroke="#725234"/><path d="M5 13h9v9H5z" fill="#90ce40"/>',
  marker:
    '<ellipse cx="16" cy="19" rx="12" ry="8" fill="currentColor" stroke="#ffffff" stroke-width="2"/><ellipse cx="16" cy="14" rx="12" ry="8" fill="currentColor" stroke="#ffffff" stroke-width="2"/>',
  chat: '<path d="M4 5h24v18H13l-7 6v-6H4zM10 12h12M10 17h8" fill="none" stroke="currentColor" stroke-width="2"/>',
  journal:
    '<path d="M6 3h20v26H6zM11 9h10M11 15h10M11 21h7" fill="none" stroke="currentColor" stroke-width="2"/>',
  colorBlind:
    '<g transform="scale(1.25)" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6" cy="7" r="4"/><path d="m17 3 5 9H12Z"/><rect x="3" y="15" width="8" height="7" rx="1"/><path d="m18 15 4 4-4 4-4-4Z"/></g>',
  help: '<circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 10c0-6 13-6 12 1 0 4-7 4-7 8M16 23v2" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  overview:
    '<path d="M3 11V3h8m10 0h8v8M3 21v8h8m10 0h8v-8" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 7 8 5v9l-8 5-8-5v-9Z" fill="none" stroke="currentColor" stroke-width="2"/>',
  fullscreen:
    '<path d="M3 12V3h9m8 0h9v9M3 20v9h9m8 0h9v-9" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  close:
    '<path d="m8 8 16 16M8 24 24 8" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  undo: '<path d="M9 5 2 12l7 7M3 12h15a8 8 0 0 1 0 16" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  check:
    '<path d="m5 16 8 8L28 7" fill="none" stroke="currentColor" stroke-width="3"/>',
  eye: '<path d="M2 16Q16-2 30 16 16 34 2 16z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="currentColor"/>',
  zoom: '<circle cx="13" cy="13" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20 9 9M8 13h10m-5-5v10" stroke="currentColor" stroke-width="2"/>',
  sound:
    '<path d="M3 12h7l8-7v22l-8-7H3zM23 10q8 6 0 12" fill="none" stroke="currentColor" stroke-width="2"/>',
};
const meanings = {
  sail: ["Sailing / boat", "Navigation / bateau"],
  fish: ["Fish value", "Valeur du poisson"],
  sell: ["Sell fish", "Vendre du poisson"],
  explore: ["Treasure value", "Valeur du trésor"],
  build: ["Huts", "Cabanes"],
  draw: ["Sand drawings", "Dessins de sable"],
  tourist: ["Tourists", "Touristes"],
  rest: ["Rest bonus", "Bonus de repos"],
  coin: ["Vatus (money)", "Vatus (argent)"],
  point: ["Prosperity points", "Points de prospérité"],
  first: ["First player", "Premier joueur"],
  water: ["Rising Waters", "Montée des eaux"],
  dike: [
    "Dike — protects this coast from flooding",
    "Digue — protège cette côte des inondations",
  ],
  kava: ["Kava — costs 1 vatu", "Kava — coûte 1 vatu"],
  copra: ["Copra — costs 2 vatus", "Coprah — coûte 2 vatus"],
  beef: ["Beef — costs 3 vatus", "Bœuf — coûte 3 vatus"],
  buy: ["Export goods", "Exporter des marchandises"],
  marker: ["Action marker", "Pion d’action"],
  chat: ["Chat", "Discussion"],
  journal: ["Journal", "Journal"],
  colorBlind: ["Color-blind mode", "Mode daltonien"],
  help: ["Rules & help", "Règles et aide"],
  fullscreen: ["Full screen", "Plein écran"],
  close: ["Close", "Fermer"],
  undo: ["Undo", "Annuler"],
  check: ["Complete", "Terminé"],
  eye: ["Overview", "Vue d’ensemble"],
  zoom: ["Zoom board", "Agrandir le plateau"],
  sound: ["Game sounds", "Sons du jeu"],
};
export const iconLabel = (name, language = "en") => meanings[name]?.[0] ?? name;
function resourceSymbol(name, colorBlind) {
  const mark = { kava: "K", copra: "C", beef: "B" }[name];
  return colorBlind && mark
    ? `<text class="resource-symbol" x="19" y="24" text-anchor="middle" font-size="15" font-weight="800" fill="#173d49" stroke="#fffce8" stroke-width="2" paint-order="stroke">${mark}</text>`
    : "";
}
export function icon(
  name,
  label = iconLabel(name),
  accessible = false,
  colorBlind = false,
) {
  return `<svg class="icon icon-${esc(name)}" viewBox="0 0 32 32" ${accessible ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}><title>${esc(label)}</title>${paths[name] ?? paths.point}${resourceSymbol(name, colorBlind)}</svg>`;
}
export function svgIcon(
  name,
  x,
  y,
  size = 26,
  color = "currentColor",
  label = iconLabel(name),
  colorBlind = false,
) {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 32 32" style="color:${color}" aria-hidden="true"><title>${esc(label)}</title>${paths[name] ?? paths.point}${resourceSymbol(name, colorBlind)}</svg>`;
}
export const token = (
  name,
  n,
  label = `${iconLabel(name)}: ${n}`,
  colorBlind = false,
) =>
  `<span class="token" role="img" aria-label="${esc(label)}" title="${esc(label)}">${icon(name, label, false, colorBlind)}<b>${esc(n)}</b></span>`;
