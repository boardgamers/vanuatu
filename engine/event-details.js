import { PRICES } from "./catalog.js";

// Capture public costs and rewards before the action mutates the board or market.
// Keep gross vatu income separate from the automatic 10-vatu conversion event.
export function actionDetails(s, p, m) {
  const a = s.players[p];
  const cell = m.cell ?? a.boat;
  const tile = s.board[cell];
  const details = { markers: a.markers[m.action] };
  if (m.bonus || m.preach) details.character = a.character;
  if (m.cell || ["fish", "explore"].includes(m.action)) details.cell = cell;
  switch (m.action) {
    case "sail":
      Object.assign(details, {
        from: a.boat,
        cell: m.path.at(-1),
        cost: m.bonus ? 0 : m.path.length,
      });
      break;
    case "fish":
      details.fish = tile.fish;
      if (m.bonus) details.points = tile.fish;
      break;
    case "explore":
      details.treasure = tile.treasure;
      if (m.bonus) details.income = tile.treasure;
      break;
    case "sell":
      details.price = s.market;
      details.income = m.fish.reduce((a, b) => a + b, 0) * s.market;
      break;
    case "build":
      details.cost = (m.hut ? (m.bonus ? 1 : 3) : 0) + (m.dike ? 1 : 0);
      break;
    case "buy":
      details.cost = PRICES[m.good];
      break;
    case "draw":
      details.points = m.bonus ? 5 : 3;
      break;
    case "tourist":
      details.income = tile.huts.length;
      if (m.bonus) details.points = tile.drawings * 2;
      break;
  }
  return details;
}
