import { CHARACTERS } from "./catalog.js";
export function markerBlockers(s, p, action) {
  const count = s.players[p].markers[action];
  if (!count) return [];
  const rank = (q) => (q - s.first + s.players.length) % s.players.length;
  const blockers = s.players.flatMap((player, q) => {
    const n = player.markers[action];
    return q !== p && (n > count || (n === count && rank(q) < rank(p)))
      ? [{ p: q, count: n, tied: n === count }]
      : [];
  });
  if (s.players.length === 2) {
    const n = s.neutral[action];
    const tieAllowed =
      CHARACTERS[s.players[p].character]?.action === action ||
      s.players[p].governorAction === action;
    if (n > count || (n === count && !tieAllowed))
      blockers.push({ count: n, neutral: true, tied: n === count });
  }
  return blockers;
}
