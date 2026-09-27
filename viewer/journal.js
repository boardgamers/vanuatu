import { ACTIONS, START_CELLS, tileState, PRICES } from "../engine/catalog.js";
import { actionDetails } from "../engine/event-details.js";

const emptyMarkers = () => Object.fromEntries(ACTIONS.map((a) => [a, 0]));
const total = (values) => values.reduce((a, b) => a + b, 0);

// Old saves contain the moves, but not their outcomes. Reconstruct only public,
// deterministic information. In particular, never guess old trade-ship bonuses
// or use today's character, fish price or board contents for an earlier action.
export function journalRows(state) {
  const events = state.events ?? state.lastEvents ?? [];
  const completeHistory = events[0]?.type === "start";
  const board = {};
  if (completeHistory)
    for (const cell of ["0,0", ...START_CELLS]) {
      const id = state.board[cell]?.id;
      if (id) board[cell] = tileState(id);
    }
  const startBoat = Object.keys(board).find((c) => board[c].id === "startBoat");
  const players = state.players.map(() => ({
    boat: startBoat,
    markers: emptyMarkers(),
    character: null,
  }));
  const context = { board, players, market: completeHistory ? 3 : undefined };
  let neutral = emptyMarkers(),
    round,
    phase;
  const rows = [];
  for (const original of events) {
    const e = { ...original };
    if (e.round !== round) {
      round = e.round;
      phase = undefined;
      rows.push({
        kind: "round",
        round,
        first: e.type === "start" ? e.p : e.first,
      });
      if (completeHistory || e.type === "round") context.market = 3;
      neutral = emptyMarkers();
      players.forEach((p) => (p.markers = emptyMarkers()));
    }
    if (["start", "round"].includes(e.type)) continue;
    const player = players[e.p];
    let nextPhase = {
      place: "expand",
      neutral: "neutral",
      character: "character",
      plan: "plan",
      action: "actions",
      discard: "actions",
      governor: "actions",
      rest: "actions",
      restBonus: "restBonus",
      end: "ended",
      lost: "ended",
    }[e.type];
    if (e.type === "plan") {
      const n = total(Object.values(player.markers));
      e.pass ??= completeHistory ? Math.floor(n / 2) + 1 : undefined;
      nextPhase += e.pass ?? "";
    }
    if (nextPhase && phase !== nextPhase) {
      phase = nextPhase;
      rows.push({
        kind: "phase",
        phase: e.type === "plan" ? "plan" : phase,
        pass: e.pass,
      });
    }
    if (e.type === "character") player.character = e.character;
    if (e.type === "plan" || e.type === "neutral") {
      const markers = e.type === "neutral" ? neutral : player.markers;
      for (const action of e.actions) markers[action]++;
      if (e.totals) Object.assign(markers, e.totals);
      e.totals ??= completeHistory ? { ...markers } : undefined;
    }
    if (e.type === "place") board[e.cell] = tileState(e.tile);
    if (e.type === "action") {
      const fallback = {};
      if (completeHistory && board[e.cell ?? player.boat])
        Object.assign(fallback, actionDetails(context, e.p, e));
      else {
        if (e.cell) fallback.cell = e.cell;
        if (e.action === "sail") {
          fallback.cost = e.bonus ? 0 : e.path.length;
          fallback.cell = e.path.at(-1);
        }
        if (e.action === "build")
          fallback.cost = (e.hut ? (e.bonus ? 1 : 3) : 0) + (e.dike ? 1 : 0);
        if (e.action === "buy") fallback.cost = PRICES[e.good];
        if (e.action === "draw") fallback.points = e.bonus ? 5 : 3;
        if (e.action === "sell" && context.market !== undefined) {
          fallback.price = context.market;
          fallback.income = total(e.fish) * context.market;
        }
      }
      e.details = { ...fallback, ...e.details };
      const tile = board[e.cell ?? player.boat];
      if (e.action === "sail") player.boat = e.path.at(-1);
      if (e.action === "sell" && context.market !== undefined)
        context.market = Math.max(1, context.market - 1);
      if (tile) {
        if (e.action === "fish") tile.fish--;
        if (e.action === "explore") tile.treasure--;
        if (e.action === "build" && e.hut) tile.huts.push(e.p);
        if (e.action === "draw") tile.drawings++;
      }
      player.markers[e.action] = 0;
    }
    if (e.type === "discard") {
      e.markers ??= completeHistory ? player.markers[e.action] : undefined;
      player.markers[e.action] = 0;
    }
    if (e.type === "governor") {
      e.markers ??= completeHistory ? player.markers[e.from] : undefined;
      player.markers[e.to] += player.markers[e.from];
      player.markers[e.from] = 0;
    }
    if (e.type === "submerged" && board[e.cell]) {
      board[e.cell].huts = [];
      board[e.cell].drawings = 0;
    }
    if (e.type === "rest") {
      const previous = rows.findLast(
        (row) => row.kind === "event" && row.event.p === e.p,
      );
      if (
        previous?.event.type === "action" &&
        previous.event.action === "rest" &&
        previous.event.round === e.round
      ) {
        previous.event.restToken = e.token;
        continue;
      }
    }
    rows.push({ kind: "event", event: e });
  }
  return rows;
}
