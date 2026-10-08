import { markerBlockers } from "../engine/marker-blockers.js";
import {
  actionObstacles,
  cellObstacles,
  planObstacles,
} from "../engine/action-obstacles.js";
import { IMPOSSIBLE } from "./learning.js";
import { translateText } from "./localization/index.js";
import { esc, icon } from "./art.js";
import { pictogramText } from "./prose.js";

// Templates are translated before values are filled in, so player names and
// numbers never need catalogue entries.
const OBSTACLES = {
  noMoney: "Not enough vatus: {p0} available, {p1} needed.",
  noRoute: "No open ocean space can be reached from the boat.",
  noFishHere: "No fish left on the boat's ocean space.",
  noTreasureHere: "No treasure left on the boat's ocean space.",
  noFishInHold: "No fish to sell.",
  noHutNearby: "Fish can only be sold next to an island with your own hut.",
  noIslandNearby: "The boat is not next to any island.",
  noHutsLeft: "No huts left.",
  islandsFull: "Every island next to the boat already has all its huts.",
  noDikesLeft: "No dikes left.",
  coastsProtected: "Every coast next to the boat already has a dike.",
  noGoodsNearby: "No goods left on the islands next to the boat.",
  drawingsFull:
    "Every island next to the boat already has all its sand drawings.",
  noTourists: "No tourists left this round.",
  touristsFull: "Every island next to the boat already has all its tourists.",
  noRestTokens: "No rest tokens left.",
  notOpenSea: "Boats only sail on open ocean spaces.",
  alreadyHere: "Your boat is already here.",
  occupied: "Another boat is on this space.",
  tooFar: "Too far: {p0} spaces away, you can sail at most {p1}.",
  notIsland: "Choose an island.",
  notAdjacent: "This island is not next to your boat.",
  islandFull: "This island has no free hut space ({p0}/{p1}).",
  noGoodsHere: "This island has no goods left.",
  drawingFull: "This island has no room for another sand drawing ({p0}/{p1}).",
  touristFull: "This island cannot host another tourist ({p0}/{p1}).",
  noFishAnywhere: "No fish left anywhere on the board.",
  noTreasureAnywhere: "No treasure left anywhere on the board.",
  noDrawingAnywhere: "No island has room for another sand drawing.",
  noTouristAnywhere: "No island can host another tourist.",
  noGoodsAnywhere: "No goods left on any island.",
  noFishPlanned:
    "Selling requires fish. Plan Fish first if your hold is empty.",
};
const VALUES = {
  noMoney: (o) => [o.have, o.need],
  tooFar: (o) => [o.distance, o.max],
  islandFull: (o) => [o.count, o.max],
  drawingFull: (o) => [o.count, o.max],
  touristFull: (o) => [o.count, o.max],
};
// A pictogram leads each explanation so the cause reads at a glance.
const ICONS = {
  noMoney: null, // "vatus" already becomes a coin pictogram.
  noRoute: "sail",
  noFishHere: "fish",
  noTreasureHere: "explore",
  noFishInHold: "fish",
  noHutNearby: "build",
  noIslandNearby: "sail",
  noHutsLeft: "build",
  islandsFull: "build",
  noDikesLeft: "dike",
  coastsProtected: "dike",
  noGoodsNearby: "buy",
  drawingsFull: "draw",
  noTourists: "tourist",
  touristsFull: "tourist",
  noRestTokens: "rest",
  notOpenSea: "sail",
  alreadyHere: "sail",
  occupied: "sail",
  tooFar: "sail",
  notIsland: "build",
  notAdjacent: "sail",
  islandFull: "build",
  noGoodsHere: "buy",
  drawingFull: "draw",
  touristFull: "tourist",
  noFishAnywhere: "fish",
  noTreasureAnywhere: "explore",
  noDrawingAnywhere: "draw",
  noTouristAnywhere: "tourist",
  noGoodsAnywhere: "buy",
  noFishPlanned: "fish",
};
const fill = (template, values) =>
  template.replace(/\{p(\d+)\}/g, (key, i) => values[i] ?? key);
const obstacleItems = (obstacles, lang) =>
  obstacles.map((o) => ({
    icon: ICONS[o.reason],
    text: fill(
      translateText(OBSTACLES[o.reason], lang),
      VALUES[o.reason]?.(o) ?? [],
    ),
    prose: true,
  }));
const joinText = (items) => items.map((i) => i.text).join(" ");
// Player names are never passed to the pictogram formatter.
const joinHtml = (items, lang, colorBlind) =>
  items
    .map(
      (i) =>
        `<span class="obstacle">${i.icon ? icon(i.icon, undefined, false, colorBlind) : ""}<span>${i.prose ? pictogramText(i.text, lang, colorBlind) : esc(i.text)}</span></span>`,
    )
    .join("");
function blockerText(s, b, mine, lang) {
  const t = (text) => translateText(text, lang);
  if (b.neutral)
    return b.tied
      ? fill(t("As many neutral markers ({p0}), and they win ties."), [mine])
      : fill(t("More neutral markers: {p0} against {p1}."), [b.count, mine]);
  return b.tied
    ? fill(t("{p0} has as many markers ({p1}) and is earlier in turn order."), [
        s.players[b.p].name,
        b.count,
      ])
    : fill(t("{p0} has more markers: {p1} against {p2}."), [
        s.players[b.p].name,
        b.count,
        mine,
      ]);
}
// `saved` is a journal discard event, so the explanation matches the moment of
// the move rather than the displayed state.
function blockingItems(s, p, action, lang, saved) {
  const blockers = saved?.blockers ?? markerBlockers(s, p, action);
  if (blockers.length) {
    const mine = saved?.markers ?? s.players[p]?.markers[action] ?? 0;
    return [
      {
        icon: "marker",
        text: translateText("No majority on this action.", lang),
      },
      ...blockers.map((b) => ({ text: blockerText(s, b, mine, lang) })),
    ];
  }
  const obstacles =
    saved?.obstacles ?? (saved ? [] : actionObstacles(s, p, action));
  return obstacles.length
    ? obstacleItems(obstacles, lang)
    : [{ icon: "warning", text: translateText(IMPOSSIBLE, lang), prose: true }];
}
export function blockingText(s, p, action, lang, saved) {
  return joinText(blockingItems(s, p, action, lang, saved));
}
export function blockingHtml(s, p, action, lang, saved, colorBlind = false) {
  return joinHtml(blockingItems(s, p, action, lang, saved), lang, colorBlind);
}
export function cellHtml(s, p, action, cell, lang, colorBlind = false) {
  return joinHtml(
    obstacleItems(cellObstacles(s, p, action, cell), lang),
    lang,
    colorBlind,
  );
}
export function planText(s, p, action, lang, markers) {
  return joinText(obstacleItems(planObstacles(s, p, action, markers), lang));
}
// Explanatory prose without a specific cause, e.g. the planning fallbacks.
export function proseHtml(text, lang, colorBlind = false, name = "warning") {
  return joinHtml([{ icon: name, text, prose: true }], lang, colorBlind);
}
