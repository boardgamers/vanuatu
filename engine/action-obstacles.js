import { CHARACTERS, GOODS, PRICES, TILES, neighbors } from "./catalog.js";

// Explains why an action has no legal option, from the public state only, so
// the viewer can tell players what is missing instead of a generic refusal.
// Each obstacle is `{ reason, ...values }`; the viewer chooses the wording.
const bonusFor = (s, p, action) => {
  const a = s.players[p];
  return CHARACTERS[a.character]?.action === action && !a.used;
};
const openSea = (s, c) => s.board[c]?.type === "sea" && !s.board[c].submerged;
const islandsNear = (s, p) =>
  neighbors(s.players[p].boat, s).filter(
    (c) => s.board[c]?.type === "island" && !s.board[c].submerged,
  );
const occupied = (s, p, c) =>
  s.players.length === 2 && s.players.some((x, q) => q !== p && x.boat === c);
export function sailRange(s, p) {
  return bonusFor(s, p, "sail") ? 3 : Math.min(3, s.players[p].money);
}
function sailDistances(s, p) {
  const start = s.players[p].boat,
    distance = new Map([[start, 0]]),
    queue = [start];
  while (queue.length) {
    const c = queue.shift();
    for (const next of neighbors(c, s))
      if (openSea(s, next) && !distance.has(next)) {
        distance.set(next, distance.get(c) + 1);
        queue.push(next);
      }
  }
  distance.delete(start);
  return distance;
}
function buildCost(s, p) {
  return bonusFor(s, p, "build") ? 1 : 3;
}
export function actionObstacles(s, p, action) {
  const a = s.players[p];
  if (!a) return [];
  const bonus = bonusFor(s, p, action),
    here = s.board[a.boat],
    islands = islandsNear(s, p),
    out = [];
  const needIsland = () => {
    if (!islands.length) out.push({ reason: "noIslandNearby" });
    return islands.length > 0;
  };
  switch (action) {
    case "sail": {
      const nearest = Math.min(
        ...[...sailDistances(s, p)]
          .filter(([c]) => !occupied(s, p, c))
          .map(([, d]) => d),
      );
      if (nearest > 3) out.push({ reason: "noRoute" });
      else if (nearest > sailRange(s, p))
        out.push({ reason: "noMoney", have: a.money, need: nearest });
      break;
    }
    case "fish":
      if (!(here?.fish > 0)) out.push({ reason: "noFishHere" });
      break;
    case "explore":
      if (!(here?.treasure > 0)) out.push({ reason: "noTreasureHere" });
      break;
    case "sell":
      if (!a.fish.length) out.push({ reason: "noFishInHold" });
      if (!bonus && !islands.some((c) => s.board[c].huts.includes(p)))
        out.push({ reason: "noHutNearby" });
      break;
    case "build": {
      if (!needIsland()) break;
      if (a.hutsLeft <= 0) out.push({ reason: "noHutsLeft" });
      else if (
        islands.every(
          (c) => s.board[c].huts.length >= TILES[s.board[c].id].huts,
        )
      )
        out.push({ reason: "islandsFull" });
      const need = buildCost(s, p);
      if (a.money < need) out.push({ reason: "noMoney", have: a.money, need });
      if (s.options?.risingWaters) {
        if (!s.dikesLeft) out.push({ reason: "noDikesLeft" });
        else if (
          islands.every((c) =>
            neighbors(c, s).every(
              (e) => !openSea(s, e) || s.board[c].dikes.includes(e),
            ),
          )
        )
          out.push({ reason: "coastsProtected" });
      }
      break;
    }
    case "buy": {
      if (!needIsland()) break;
      const goods = GOODS.filter((g) =>
        islands.some((c) => s.board[c].goods[g] > 0),
      );
      if (!goods.length) out.push({ reason: "noGoodsNearby" });
      else {
        const need = Math.min(...goods.map((g) => PRICES[g]));
        if (a.money < need)
          out.push({ reason: "noMoney", have: a.money, need });
      }
      break;
    }
    case "draw":
      if (
        needIsland() &&
        islands.every(
          (c) => s.board[c].drawings >= TILES[s.board[c].id].drawings,
        )
      )
        out.push({ reason: "drawingsFull" });
      break;
    case "tourist":
      if (!(s.tourists > 0)) out.push({ reason: "noTourists" });
      else if (
        needIsland() &&
        islands.every(
          (c) => s.board[c].tourists >= TILES[s.board[c].id].tourists,
        )
      )
        out.push({ reason: "touristsFull" });
      break;
    case "rest":
      if (s.restAvailable && !s.restAvailable.length)
        out.push({ reason: "noRestTokens" });
      break;
  }
  return out;
}
// Why a map space cannot be chosen for the selected action.
export function cellObstacles(s, p, action, cell) {
  const a = s.players[p],
    t = s.board[cell];
  if (!a || !t) return [];
  if (action === "sail") {
    if (!openSea(s, cell)) return [{ reason: "notOpenSea" }];
    if (cell === a.boat) return [{ reason: "alreadyHere" }];
    if (occupied(s, p, cell)) return [{ reason: "occupied" }];
    const distance = sailDistances(s, p).get(cell);
    if (distance === undefined) return [{ reason: "noRoute" }];
    if (distance > 3) return [{ reason: "tooFar", distance, max: 3 }];
    if (distance > sailRange(s, p))
      return [{ reason: "noMoney", have: a.money, need: distance }];
    return [];
  }
  if (!["build", "buy", "draw", "tourist"].includes(action)) return [];
  if (t.type !== "island" || t.submerged) return [{ reason: "notIsland" }];
  if (!islandsNear(s, p).includes(cell)) return [{ reason: "notAdjacent" }];
  const tile = TILES[t.id],
    out = [];
  switch (action) {
    case "build": {
      if (a.hutsLeft <= 0) out.push({ reason: "noHutsLeft" });
      else if (t.huts.length >= tile.huts)
        out.push({
          reason: "islandFull",
          count: t.huts.length,
          max: tile.huts,
        });
      const need = buildCost(s, p);
      if (a.money < need) out.push({ reason: "noMoney", have: a.money, need });
      break;
    }
    case "buy": {
      const goods = GOODS.filter((g) => t.goods[g] > 0);
      if (!goods.length) out.push({ reason: "noGoodsHere" });
      else {
        const need = Math.min(...goods.map((g) => PRICES[g]));
        if (a.money < need)
          out.push({ reason: "noMoney", have: a.money, need });
      }
      break;
    }
    case "draw":
      if (t.drawings >= tile.drawings)
        out.push({
          reason: "drawingFull",
          count: t.drawings,
          max: tile.drawings,
        });
      break;
    case "tourist":
      if (!(s.tourists > 0)) out.push({ reason: "noTourists" });
      else if (t.tourists >= tile.tourists)
        out.push({
          reason: "touristFull",
          count: t.tourists,
          max: tile.tourists,
        });
      break;
  }
  return out;
}
// Planning only checks whether some ordering of the player's markers can
// reach the action this round. These are the causes no ordering can fix.
export function planObstacles(s, p, action, markers = s.players[p].markers) {
  const islands = Object.values(s.board).filter(
    (t) => t.type === "island" && !t.submerged,
  );
  switch (action) {
    case "fish":
      return Object.values(s.board).some((t) => t.fish > 0)
        ? []
        : [{ reason: "noFishAnywhere" }];
    case "explore":
      return Object.values(s.board).some((t) => t.treasure > 0)
        ? []
        : [{ reason: "noTreasureAnywhere" }];
    case "draw":
      return islands.some((t) => t.drawings < TILES[t.id].drawings)
        ? []
        : [{ reason: "noDrawingAnywhere" }];
    case "tourist":
      if (!(s.tourists > 0)) return [{ reason: "noTourists" }];
      return islands.some((t) => t.tourists < TILES[t.id].tourists)
        ? []
        : [{ reason: "noTouristAnywhere" }];
    case "buy":
      return islands.some((t) => Object.values(t.goods).some((n) => n > 0))
        ? []
        : [{ reason: "noGoodsAnywhere" }];
    case "sell":
      return s.players[p].fish.length || markers.fish
        ? []
        : [{ reason: "noFishPlanned" }];
    case "build":
      return s.players[p].hutsLeft > 0 || s.options?.risingWaters
        ? []
        : [{ reason: "noHutsLeft" }];
  }
  return [];
}
