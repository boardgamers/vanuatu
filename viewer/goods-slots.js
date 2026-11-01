import { TILES } from "../engine/catalog.js";
// The original assortment defines stable positions, including bought cubes.
export function goodsSlots(tile) {
  if (tile.type !== "island" || tile.submerged) return [];
  return Object.entries(TILES[tile.id].goods).flatMap(([good, count]) =>
    Array.from({ length: count }, (_, i) => ({
      good,
      filled: i < (tile.goods[good] ?? 0),
    })),
  );
}
