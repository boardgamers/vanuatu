export const COLORS = ["#e98332", "#773c94", "#149c9a", "#397abd", "#e5b62e"];
export const ACTIONS = [
  "sail",
  "fish",
  "sell",
  "explore",
  "build",
  "buy",
  "draw",
  "tourist",
  "rest",
];
export const GOODS = ["kava", "copra", "beef"];
export const PRICES = { kava: 1, copra: 2, beef: 3 };
export const VALUES = { kava: 1, copra: 3, beef: 5 };
export const REST = ["first", "both", "point", "coin"];
export const CHARACTERS = {
  navigator: {
    action: "sail",
    art: "navigator",
    name: "Navigator",
    fr: "Navigateur",
  },
  fisherman: {
    action: "fish",
    art: "fisher",
    name: "Fisherman",
    fr: "Pêcheur",
  },
  vendor: { action: "sell", art: "merchant", name: "Vendor", fr: "Vendeur" },
  diver: { action: "explore", art: "diver", name: "Diver", fr: "Plongeur" },
  builder: { action: "build", art: "worker", name: "Builder", fr: "Bâtisseur" },
  buyer: { action: "buy", art: "purchaser", name: "Buyer", fr: "Acheteur" },
  artist: { action: "draw", art: "drawer", name: "Artist", fr: "Dessinateur" },
  guide: { action: "tourist", art: "guide", name: "Guide", fr: "Guide" },
  beggar: { art: "baggar", name: "Beggar", fr: "Mendiant" },
  preacher: { art: "preacher", name: "Preacher", fr: "Prédicateur" },
  governor: { art: "governess", name: "Governor", fr: "Gouverneur" },
};
const sea = (art, fish = 0, treasure = 0, letter) => ({
  type: "sea",
  art,
  fish,
  treasure,
  letter,
});
const land = (art, huts, drawings, tourists, goods, letter) => ({
  type: "island",
  art,
  huts,
  drawings,
  tourists,
  goods,
  letter,
});
export const TILES = {
  efate: land("efate", 3, 1, 5, { kava: 1, copra: 1, beef: 1 }),
  startFish: sea("tile-1", 2),
  startWreck: sea("tile-3", 1, 2),
  startBoat: sea("tile-5"),
  a1: land("tile-7", 3, 2, 4, { kava: 1, beef: 1 }, "A"),
  a2: land("tile-9", 3, 2, 4, { kava: 1, copra: 1 }, "A"),
  b1: sea("tile-11", 1, 3, "B"),
  b2: sea("tile-13", 3, 0, "B"),
  c1: sea("tile-15", 0, 0, "C"),
  c2: sea("tile-17", 1, 2, "C"),
  d1: land("tile-19", 2, 3, 3, { kava: 2 }, "D"),
  d2: land("tile-21", 3, 1, 4, { kava: 1, copra: 1 }, "D"),
  e1: sea("tile-23", 0, 0, "E"),
  e2: sea("tile-25", 2, 0, "E"),
  f1: sea("tile-27", 3, 1, "F"),
  f2: sea("tile-29", 3, 0, "F"),
};
export const DEMANDS = [
  ["beef", "copra", "kava"],
  ["kava", "kava", "copra"],
  ["beef", "beef", "copra"],
  ["copra", "copra", "beef"],
  ["kava", "beef", "beef"],
  ["kava", "copra", "copra"],
  ["kava", "kava", "beef"],
  ["kava", "kava", "copra"],
  ["kava", "kava", "kava"],
  ["beef", "copra", "kava"],
];
// Coordinates follow the printed board, with the fixed starting island at 0,0.
export const CELLS = [
  [-1, 0],
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [-1, 2],
  [0, 2],
  [1, 2],
  [2, 2],
  [3, 2],
  [1, 3],
].map(([q, r]) => ({ id: `${q},${r}`, q, r }));
export const DIRECTIONS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
];
export const START_CELLS = ["1,0", "0,1", "1,1"];
export function neighbors(id) {
  const [q, r] = id.split(",").map(Number);
  return DIRECTIONS.map(([a, b]) => `${q + a},${r + b}`).filter((c) =>
    CELLS.some((x) => x.id === c),
  );
}
export function tileState(id) {
  const t = TILES[id];
  return {
    id,
    type: t.type,
    fish: t.fish ?? 0,
    treasure: t.treasure ?? 0,
    goods: { ...t.goods },
    huts: [],
    drawings: 0,
    tourists: 0,
    water: 0,
    dikes: [],
    submerged: false,
  };
}
