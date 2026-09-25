import { assets } from "./assets.js";
import efate from "./assets/efate-board.webp";
import a1 from "./assets/tile-7-board.webp";
import a2 from "./assets/tile-9-board.webp";
import d1 from "./assets/tile-19-board.webp";
import d2 from "./assets/tile-21-board.webp";

// Static printed counters stay in the reference art; the board draws live state.
const islands = {
  efate,
  "tile-7": a1,
  "tile-9": a2,
  "tile-19": d1,
  "tile-21": d2,
};
export const boardArt = (tile) =>
  tile.type === "sea" ? assets.ocean : islands[tile.art];
