import { sha256 } from "@noble/hashes/sha2.js";
import {
  ACTIONS,
  CHARACTERS,
  COLORS,
  GOODS,
  PRICES,
  VALUES,
  REST,
  TILES,
  DEMANDS,
  CELLS,
  START_CELLS,
  neighbors,
  tileState,
} from "./catalog.js";
export * from "./catalog.js";
export const hashSeed = true;
const copy = (x) => structuredClone(x);
const check = (b, m = "Illegal move") => {
  if (!b) throw new Error(m);
};
const sum = (a) => a.reduce((x, y) => x + y, 0);
function random(s, n) {
  const b = sha256(new TextEncoder().encode(`${s._seed}:${s._rng++}`));
  return new DataView(b.buffer, b.byteOffset, 4).getUint32(0) % n;
}
function shuffle(s, a) {
  a = copy(a);
  for (let i = a.length - 1; i > 0; i--) {
    const j = random(s, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const turnOrder = (s) =>
  s.players.map((_, p) => (s.first + p) % s.players.length);
const remaining = (s, p) => sum(Object.values(s.players[p].markers));
const has = (s, p, c) => s.players[p].character === c && !s.players[p].used;
function say(s, type, data = {}) {
  s.events.push({ ...data, type, round: s.round, step: s._history.length + 1 });
}
function earn(s, p, n) {
  const a = s.players[p];
  a.money += n;
  const points = Math.floor(a.money / 10) * 5;
  a.money %= 10;
  a.score += points;
  if (points) say(s, "conversion", { p, points });
}
function pay(s, p, n) {
  check(
    Number.isInteger(n) && n >= 0 && s.players[p].money >= n,
    "Not enough vatus",
  );
  s.players[p].money -= n;
}
function adjacentIslands(s, p) {
  return neighbors(s.players[p].boat).filter(
    (c) => s.board[c]?.type === "island" && !s.board[c].submerged,
  );
}
function emptyMarkers() {
  return Object.fromEntries(ACTIONS.map((a) => [a, 0]));
}
function capture(s) {
  const frame = copy(
    Object.fromEntries(
      Object.entries(s).filter(([k]) => !k.startsWith("_") && k !== "events"),
    ),
  );
  frame.restAvailable = copy(s._restAvailable);
  frame.lastEvents = s.events.filter((e) => e.step === s._history.length);
  return frame;
}
function saveFrame(s) {
  s._frames.push(capture(s));
}
export function init(count, expansions = [], options = {}, seed = "vanuatu") {
  check(
    Number.isInteger(count) && count >= 2 && count <= 5,
    "Vanuatu is for 2–5 players",
  );
  check(
    expansions.every((e) => e === "rising-waters"),
    "Unknown expansion",
  );
  const s = {
    version: 1,
    round: 1,
    phase: "character",
    actor: 0,
    first: 0,
    players: Array.from({ length: count }, (_, p) => ({
      name: `Player ${p + 1}`,
      color: COLORS[p],
      money: 3,
      score: 0,
      boat: "",
      fish: [],
      treasures: [],
      hutsLeft: 8,
      markers: emptyMarkers(),
      character: null,
      used: false,
      rest: null,
      governorAction: null,
      dropped: false,
    })),
    board: { "0,0": tileState("efate") },
    planningPass: 0,
    neutral: emptyMarkers(),
    neutralPlaced: 0,
    market: 3,
    tourists: 0,
    demands: [],
    upcoming: [],
    characters: [],
    waterCountdown: null,
    waterTriggered: false,
    dikesLeft: 20,
    lost: false,
    finished: false,
    events: [],
    increments: Array(count).fill(0),
    options: {
      characters: count === 2 ? true : options.characters !== false,
      risingWaters:
        expansions.includes("rising-waters") || options.risingWaters === true,
    },
    _seed: String(seed),
    _rng: 0,
    _history: [],
    _frames: [],
    _restAvailable: [...REST],
    _demandDiscards: [],
  };
  s._setup = {
    count,
    expansions: [...expansions],
    options: copy(options),
    seed: String(seed),
  };
  const starts = shuffle(s, ["startFish", "startWreck", "startBoat"]);
  starts.forEach((id, i) => {
    s.board[START_CELLS[i]] = tileState(id);
    if (id === "startBoat") s.players.forEach((p) => (p.boat = START_CELLS[i]));
  });
  const halves = [[], []];
  for (const letter of ["a", "b", "c", "d", "e", "f"]) {
    const pair = shuffle(s, [`${letter}1`, `${letter}2`]);
    halves[0].push(pair[0]);
    halves[1].push(pair[1]);
  }
  s._tileDeck = halves.flat();
  s.upcoming = s._tileDeck.splice(0, 2);
  const tourists = [0, 1, 1, 2, 2, 2, 3, 3, 4];
  tourists.splice(tourists.indexOf(count <= 3 ? 4 : count === 4 ? 2 : 0), 1);
  s._touristDeck = shuffle(s, tourists);
  s.tourists = s._touristDeck.shift();
  s._demandDeck = shuffle(
    s,
    DEMANDS.map((goods, i) => ({
      id: i + 1,
      goods,
      filled: goods.map(() => false),
    })),
  );
  s.demands = s._demandDeck.splice(0, 3);
  s.first = random(s, count);
  s.actor = s.first;
  s.characters =
    count === 2
      ? shuffle(s, Object.keys(CHARACTERS)).slice(0, 5)
      : Object.keys(CHARACTERS);
  startSelection(s);
  say(s, "start", { p: s.first });
  saveFrame(s);
  return s;
}
function startSelection(s) {
  s.actor = s.first;
  s.phase =
    s.players.length === 2
      ? "neutral"
      : s.options.characters
        ? "character"
        : "plan";
  s.neutral = emptyMarkers();
  s.neutralPlaced = 0;
  s.planningPass = 0;
}
export function majority(s, p, action) {
  const n = s.players[p].markers[action];
  if (!n) return false;
  const rank = turnOrder(s);
  for (const q of rank) {
    if (q === p) continue;
    const m = s.players[q].markers[action];
    if (m > n || (m === n && rank.indexOf(q) < rank.indexOf(p))) return false;
  }
  if (s.players.length === 2) {
    const tied =
      CHARACTERS[s.players[p].character]?.action === action ||
      s.players[p].governorAction === action;
    if (n < s.neutral[action] + (tied ? 0 : 1)) return false;
  }
  return true;
}
function combinations(values) {
  const counts = [1, 2, 3].map((v) => values.filter((x) => x === v).length);
  const out = [];
  for (let a = 0; a <= counts[0]; a++)
    for (let b = 0; b <= counts[1]; b++)
      for (let c = 0; c <= counts[2]; c++)
        if (a + b + c)
          out.push([
            ...Array(a).fill(1),
            ...Array(b).fill(2),
            ...Array(c).fill(3),
          ]);
  return out;
}
export function sailOptions(s, p, bonus = false) {
  const out = [],
    seen = new Set();
  const start = s.players[p].boat;
  const max = bonus ? 3 : Math.min(3, s.players[p].money);
  function visit(c, path) {
    if (path.length) {
      const key = `${c}:${path.length}`;
      if (
        !seen.has(key) &&
        !(
          s.players.length === 2 &&
          s.players.some((x, q) => q !== p && x.boat === c)
        )
      ) {
        seen.add(key);
        out.push({ type: "act", action: "sail", path: [...path], bonus });
      }
    }
    if (path.length === max) return;
    for (const next of neighbors(c)) {
      if (s.board[next]?.type === "sea" && !s.board[next].submerged)
        visit(next, [...path, next]);
    }
  }
  if (max) visit(start, []);
  return out;
}
export function actionOptions(s, p, action) {
  const a = s.players[p],
    islands = adjacentIslands(s, p),
    out = [];
  const bonuses =
    CHARACTERS[a.character]?.action === action && !a.used
      ? [true, false]
      : [false];
  for (const bonus of bonuses) {
    const base = { type: "act", action, bonus };
    switch (action) {
      case "sail":
        out.push(...sailOptions(s, p, bonus));
        break;
      case "fish":
        if (s.board[a.boat]?.fish > 0) out.push(base);
        break;
      case "explore":
        if (s.board[a.boat]?.treasure > 0) out.push(base);
        break;
      case "sell":
        if (
          a.fish.length &&
          (bonus || islands.some((c) => s.board[c].huts.includes(p)))
        )
          for (const fish of combinations(a.fish)) out.push({ ...base, fish });
        break;
      case "build":
        for (const cell of islands) {
          const t = s.board[cell];
          const hut =
            a.hutsLeft > 0 &&
            t.huts.length < TILES[t.id].huts &&
            a.money >= (bonus ? 1 : 3);
          if (hut) out.push({ ...base, cell, hut: true });
          if (s.options.risingWaters && s.dikesLeft && a.money >= 1)
            for (const edge of neighbors(cell).filter(
              (c) =>
                s.board[c]?.type === "sea" &&
                !s.board[c].submerged &&
                !t.dikes.includes(c),
            )) {
              out.push({ ...base, cell, hut: false, dike: edge });
              if (hut && a.money >= (bonus ? 1 : 3) + 1)
                out.push({ ...base, cell, hut: true, dike: edge });
            }
        }
        break;
      case "buy":
        for (const cell of islands)
          for (const good of GOODS)
            if (s.board[cell].goods[good] > 0 && a.money >= PRICES[good])
              out.push({ ...base, cell, good });
        break;
      case "draw":
        for (const cell of islands)
          if (s.board[cell].drawings < TILES[s.board[cell].id].drawings)
            out.push({ ...base, cell });
        break;
      case "tourist":
        if (s.tourists > 0)
          for (const cell of islands)
            if (s.board[cell].tourists < TILES[s.board[cell].id].tourists)
              out.push({ ...base, cell });
        break;
      case "rest":
        if (s._restAvailable?.length) out.push(base);
        break;
    }
  }
  return out;
}
export function goodsAvailable(s, good) {
  return (
    { kava: 10, copra: 8, beef: 6 }[good] -
    Object.values(s.board).reduce((n, t) => n + (t.goods[good] ?? 0), 0) -
    s.demands.reduce(
      (n, d) => n + d.goods.filter((g, i) => g === good && d.filled[i]).length,
      0,
    )
  );
}
function exportGood(s, p, good) {
  for (const d of s.demands) {
    const i = d.goods.findIndex((g, k) => g === good && !d.filled[k]);
    if (i < 0) continue;
    d.filled[i] = true;
    s.players[p].score += VALUES[good];
    if (d.filled.every(Boolean)) s.players[p].score += 2;
    return;
  }
}
function takeFrom(a, values) {
  for (const value of values) {
    const i = a.indexOf(value);
    check(i >= 0);
    a.splice(i, 1);
  }
}
function effect(s, p, m) {
  const a = s.players[p],
    t = m.cell ? s.board[m.cell] : s.board[a.boat];
  if (m.bonus) a.used = true;
  switch (m.action) {
    case "sail":
      pay(s, p, m.bonus ? 0 : m.path.length);
      a.boat = m.path.at(-1);
      break;
    case "fish":
      a.fish.push(t.fish);
      if (m.bonus) a.score += t.fish;
      t.fish--;
      break;
    case "explore":
      a.treasures.push(t.treasure);
      if (m.bonus) earn(s, p, t.treasure);
      t.treasure--;
      break;
    case "sell":
      takeFrom(a.fish, m.fish);
      earn(s, p, sum(m.fish) * s.market);
      s.market = Math.max(1, s.market - 1);
      break;
    case "build":
      if (m.hut) {
        pay(s, p, m.bonus ? 1 : 3);
        a.hutsLeft--;
        t.huts.push(p);
      }
      if (m.dike) {
        pay(s, p, 1);
        t.dikes.push(m.dike);
        s.dikesLeft--;
      }
      break;
    case "buy":
      pay(s, p, PRICES[m.good]);
      t.goods[m.good]--;
      exportGood(s, p, m.good);
      if (m.bonus && goodsAvailable(s, m.good) > 0) exportGood(s, p, m.good);
      break;
    case "draw":
      t.drawings++;
      a.score += m.bonus ? 5 : 3;
      break;
    case "tourist":
      s.tourists--;
      t.tourists++;
      earn(s, p, t.huts.length);
      if (m.bonus) a.score += t.drawings * 2;
      break;
    case "rest":
      s.phase = "rest";
      s.actor = p;
      break;
  }
}
function planningState(s) {
  const b = copy({
    players: s.players,
    board: s.board,
    market: s.market,
    tourists: s.tourists,
    demands: s.demands,
    options: s.options,
    dikesLeft: s.dikesLeft,
    _restAvailable: s._restAvailable,
    events: [],
    _history: [],
    round: s.round,
  });
  return b;
}
function freeVariants(s, p) {
  const out = [s],
    a = s.players[p];
  if (a.treasures.length) {
    for (const values of combinations(a.treasures)) {
      const b = planningState(s);
      takeFrom(b.players[p].treasures, values);
      earn(b, p, sum(values));
      out.push(b);
    }
  }
  const previous = [...out];
  if (has(s, p, "beggar"))
    for (const b of previous)
      for (let n = 1; n <= Math.min(3, b.players[p].score); n++) {
        const c = planningState(b);
        c.players[p].score -= n;
        c.players[p].used = true;
        earn(c, p, n);
        out.push(c);
      }
  return out;
}
const planningCache = new WeakMap();
export function canPlan(s, p, target, markers = s.players[p].markers) {
  return canPlanUncached(s, p, target, markers);
}
function cachedCanPlan(s, p, target, markers = s.players[p].markers) {
  const cacheKey = `${p}:${target}:${ACTIONS.map((a) => (markers[a] > 0 ? 1 : 0)).join("")}`;
  let cache = planningCache.get(s);
  if (!cache) {
    cache = new Map();
    planningCache.set(s, cache);
  }
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const result = canPlanUncached(s, p, target, markers);
  cache.set(cacheKey, result);
  return result;
}
function canPlanUncached(s, p, target, markers) {
  const islands = Object.values(s.board).filter(
    (t) => t.type === "island" && !t.submerged,
  );
  if (target === "fish" && !Object.values(s.board).some((t) => t.fish > 0))
    return false;
  if (
    target === "explore" &&
    !Object.values(s.board).some((t) => t.treasure > 0)
  )
    return false;
  if (
    target === "draw" &&
    !islands.some((t) => t.drawings < TILES[t.id].drawings)
  )
    return false;
  if (
    target === "tourist" &&
    (!s.tourists || !islands.some((t) => t.tourists < TILES[t.id].tourists))
  )
    return false;
  if (
    target === "buy" &&
    !islands.some((t) => Object.values(t.goods).some((n) => n > 0))
  )
    return false;
  if (target === "sell" && !s.players[p].fish.length && !markers.fish)
    return false;
  const actions = ACTIONS.filter(
    (a) => markers[a] > 0 && a !== target && a !== "rest",
  );
  const seen = new Set();
  function visit(b, mask) {
    for (const v of freeVariants(b, p)) {
      if (actionOptions(v, p, target).length) return true;
      const a = v.players[p];
      const key = JSON.stringify([
        mask,
        a.boat,
        a.money,
        a.fish,
        a.treasures,
        a.used,
        a.hutsLeft,
        v.board,
        v.market,
        v.tourists,
        v.demands,
      ]);
      if (seen.has(key)) continue;
      seen.add(key);
      for (let i = 0; i < actions.length; i++) {
        if (mask & (1 << i)) continue;
        for (const m of actionOptions(v, p, actions[i])) {
          const c = planningState(v);
          effect(c, p, m);
          if (visit(c, mask | (1 << i))) return true;
        }
      }
    }
    return false;
  }
  return visit(planningState(s), 0);
}
export function placementOptions(s) {
  const candidates = s.upcoming.flatMap((id) =>
    CELLS.filter(
      (c) =>
        !s.board[c.id] && neighbors(c.id).filter((n) => s.board[n]).length >= 2,
    ).map((c) => ({ type: "place", tile: id, cell: c.id })),
  );
  const strict = candidates.filter((m) => {
    const adj = neighbors(m.cell)
      .map((c) => s.board[c])
      .filter(Boolean);
    return TILES[m.tile].type === "island"
      ? !adj.some((t) => t.type === "island")
      : adj.some((t) => t.type === "island");
  });
  return strict.length ? strict : candidates;
}
export function freeMoves(s, p) {
  if (s.finished || !s.players[p]) return [];
  const a = s.players[p];
  const moves = combinations(a.treasures).map((values) => ({
    type: "treasure",
    values,
  }));
  if (has(s, p, "beggar"))
    for (let n = 1; n <= Math.min(3, a.score); n++)
      moves.push({ type: "beg", amount: n });
  return moves;
}
export function availableMoves(s, p = s.actor) {
  if (s.finished || p === undefined || !s.players[p]) return [];
  const free = freeMoves(s, p);
  if (p !== s.actor) return free;
  const a = s.players[p];
  let moves = [];
  switch (s.phase) {
    case "expand":
      moves = placementOptions(s);
      break;
    case "neutral": {
      const count = s.neutralPlaced === 0 ? 2 : 3;
      const append = (actions, start) => {
        if (actions.length === count) {
          moves.push({ type: "neutral", actions });
          return;
        }
        for (let i = start; i < ACTIONS.length; i++)
          append([...actions, ACTIONS[i]], i);
      };
      append([], 0);
      break;
    }
    case "character":
      moves = s.characters.map((character) => ({
        type: "character",
        character,
      }));
      break;
    case "plan": {
      planningCache.delete(s);
      const count = s.planningPass === 2 ? 1 : 2;
      for (const action of ACTIONS) {
        if (!cachedCanPlan(s, p, action)) continue;
        if (count === 1) {
          moves.push({ type: "plan", actions: [action] });
          continue;
        }
        const markers = { ...a.markers, [action]: a.markers[action] + 1 };
        for (const next of ACTIONS)
          if (cachedCanPlan(s, p, next, markers))
            moves.push({ type: "plan", actions: [action, next] });
      }
      break;
    }
    case "rest":
      moves = s._restAvailable.map((token) => ({ type: "rest", token }));
      break;
    case "actions": {
      const own = ACTIONS.filter((action) => a.markers[action] > 0),
        majorities = own.filter((action) => majority(s, p, action));
      for (const action of majorities) {
        const options = actionOptions(s, p, action);
        moves.push(
          ...(options.length ? options : [{ type: "discard", action }]),
        );
      }
      if (!majorities.length) {
        moves.push(...own.map((action) => ({ type: "discard", action })));
        if (has(s, p, "preacher"))
          for (const action of own)
            for (const option of actionOptions(s, p, action))
              moves.push({ ...option, preach: true });
      }
      if (has(s, p, "governor"))
        for (const from of own)
          for (const to of ACTIONS)
            if (from !== to) moves.push({ type: "governor", from, to });
      break;
    }
  }
  return [...moves, ...free];
}
function sameMove(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function normalizeMove(m) {
  check(m && typeof m === "object" && !Array.isArray(m));
  const out = {};
  for (const k of [
    "type",
    "action",
    "actions",
    "character",
    "tile",
    "cell",
    "token",
    "from",
    "to",
    "amount",
    "values",
    "path",
    "fish",
    "bonus",
    "hut",
    "dike",
    "preach",
  ])
    if (m[k] !== undefined) out[k] = m[k];
  if (out.values) out.values = [...out.values].sort((a, b) => a - b);
  if (out.fish) out.fish = [...out.fish].sort((a, b) => a - b);
  return out;
}
function matches(a, b) {
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]))
  );
}
function nextActor(s) {
  s.actor = (s.actor + 1) % s.players.length;
  return s.actor === s.first;
}
function flood(s) {
  s.waterTriggered = true;
  say(s, "flood");
  for (const [cell, t] of Object.entries(s.board)) {
    if (t.type !== "island" || t.submerged) continue;
    const n = neighbors(cell).filter(
      (c) =>
        s.board[c]?.type === "sea" &&
        !s.board[c].submerged &&
        !t.dikes.includes(c),
    ).length;
    t.water = Math.min(5, t.water + n);
    if (t.water >= 5) {
      t.submerged = true;
      t.goods = {};
      t.tourists = 0;
      t.drawings = 0;
      t.huts = [];
      say(s, "submerged", { cell });
    }
  }
  if (Object.values(s.board).filter((t) => t.submerged).length >= 3) {
    s.lost = true;
    s.finished = true;
    s.phase = "ended";
    s.actor = undefined;
    say(s, "lost");
  }
}
function actionDone(s, p, counts = true) {
  s.increments[p]++;
  if (counts && s.waterCountdown !== null && !s.waterTriggered) {
    s.waterCountdown--;
    if (s.waterCountdown === 0) flood(s);
    if (s.finished) return;
  }
  s.phase = "actions";
  if (s.players.every((_, q) => remaining(s, q) === 0)) {
    endRound(s);
    return;
  }
  do {
    nextActor(s);
  } while (!remaining(s, s.actor));
}
function revealDemand(s) {
  if (!s._demandDeck.length) {
    s._demandDeck = shuffle(
      s,
      s._demandDiscards.map((d) => ({
        ...d,
        filled: d.goods.map(() => false),
      })),
    );
    s._demandDiscards = [];
  }
  return s._demandDeck.shift();
}
function endRound(s) {
  for (const p of turnOrder(s)) {
    const token = s.players[p].rest;
    if (!token) continue;
    say(s, "restBonus", { p, token });
    if (token === "first") s.nextFirst = p;
    if (token === "point" || token === "both") s.players[p].score++;
    if (token === "coin" || token === "both") earn(s, p, 1);
    s.players[p].rest = null;
  }
  if (s.nextFirst !== undefined) s.first = s.nextFirst;
  delete s.nextFirst;
  s._restAvailable = [...REST];
  if (s.round === 8) {
    finish(s);
    return;
  }
  s.round++;
  s.market = 3;
  s.tourists = s._touristDeck.shift() ?? 0;
  s.waterTriggered = false;
  s.waterCountdown =
    s.options.risingWaters && s.round % 2 === 0 ? 1 + random(s, 6) : null;
  s.players.forEach((a) => {
    a.used = false;
    a.governorAction = null;
  });
  for (const d of s.demands.filter((d) => d.filled.every(Boolean)))
    s._demandDiscards.push(d);
  s.demands = s.demands.filter((d) => !d.filled.every(Boolean));
  while (s.demands.length < 3) s.demands.push(revealDemand(s));
  for (const t of Object.values(s.board))
    if (
      t.type === "island" &&
      !t.submerged &&
      sum(Object.values(t.goods)) === 0
    )
      t.goods = { ...TILES[t.id].goods };
  if (s.players.length === 2) {
    const previous = new Set([
      ...s.characters,
      ...s.players.map((p) => p.character),
    ]);
    const next = Object.keys(CHARACTERS).filter((c) => !previous.has(c));
    s.characters = shuffle(s, next).slice(0, 5);
    s.players.forEach((p) => (p.character = null));
  }
  s.actor = s.first;
  s.phase =
    s.round < 8
      ? "expand"
      : s.players.length === 2
        ? "neutral"
        : s.options.characters
          ? "character"
          : "plan";
  s.planningPass = 0;
  s.neutral = emptyMarkers();
  s.neutralPlaced = 0;
  say(s, "round", { round: s.round });
}
function finish(s) {
  for (const [p, a] of s.players.entries()) {
    earn(s, p, sum(a.fish));
    a.fish = [];
    const detail = {
      wealth: Math.floor(a.money / 3),
      treasure: sum(a.treasures) * 2,
      tourists: 0,
      first: p === s.first ? 3 : 0,
      water: 0,
    };
    for (const t of Object.values(s.board)) {
      const huts = t.huts.filter((q) => q === p).length;
      detail.tourists += huts * t.tourists * 2;
      if (s.options.risingWaters && t.water > 0 && !t.submerged)
        detail.water -= huts * (2 * t.water - 1);
    }
    a.score += sum(Object.values(detail));
    a.final = detail;
  }
  s.finished = true;
  s.phase = "ended";
  s.actor = undefined;
  say(s, "end", { scores: s.players.map((p) => p.score) });
}
function execute(s, m, p) {
  const a = s.players[p];
  say(s, m.type === "act" ? "action" : m.type, { p, ...m });
  switch (m.type) {
    case "treasure":
      takeFrom(a.treasures, m.values);
      earn(s, p, sum(m.values));
      return;
    case "beg":
      a.score -= m.amount;
      a.used = true;
      earn(s, p, m.amount);
      return;
    case "place":
      s.board[m.cell] = tileState(m.tile);
      s.upcoming.splice(s.upcoming.indexOf(m.tile), 1);
      s.increments[p]++;
      if (!s.upcoming.length) {
        s.upcoming = s._tileDeck.splice(0, 2);
        startSelection(s);
      }
      return;
    case "neutral":
      for (const action of m.actions) s.neutral[action]++;
      s.neutralPlaced += m.actions.length;
      s.increments[p]++;
      if (s.neutralPlaced === 2) nextActor(s);
      if (s.neutralPlaced === 5) {
        s.actor = s.first;
        s.phase = "character";
      }
      return;
    case "character":
      s.characters.splice(s.characters.indexOf(m.character), 1);
      if (a.character && s.players.length !== 2) s.characters.push(a.character);
      a.character = m.character;
      a.used = false;
      s.increments[p]++;
      if (nextActor(s)) s.phase = "plan";
      return;
    case "plan":
      for (const action of m.actions) a.markers[action]++;
      s.increments[p]++;
      if (nextActor(s)) {
        s.planningPass++;
        if (s.planningPass === 3) s.phase = "actions";
      }
      return;
    case "discard":
      a.markers[m.action] = 0;
      actionDone(s, p, false);
      return;
    case "governor":
      a.markers[m.to] += a.markers[m.from];
      a.markers[m.from] = 0;
      a.used = true;
      a.governorAction = m.to;
      actionDone(s, p, false);
      return;
    case "rest":
      a.rest = m.token;
      s._restAvailable.splice(s._restAvailable.indexOf(m.token), 1);
      actionDone(s, p);
      return;
    case "act":
      a.markers[m.action] = 0;
      effect(s, p, m);
      if (m.preach) a.used = true;
      if (s.phase !== "rest") actionDone(s, p);
      else if (s._restAvailable.length === 1) {
        a.rest = s._restAvailable.shift();
        actionDone(s, p);
      }
      return;
    default:
      throw new Error("Unknown move");
  }
}
function automate(s) {
  let guard = 0;
  while (!s.finished && guard++ < 100) {
    if (s.phase === "expand" && !placementOptions(s).length)
      throw new Error("No legal archipelago placement");
    if (s.phase !== "actions") break;
    const moves = availableMoves(s).filter(
      (m) => !["beg", "treasure"].includes(m.type),
    );
    if (
      moves.length === 1 &&
      moves[0].type === "discard" &&
      freeMoves(s, s.actor).length === 0
    ) {
      execute(s, moves[0], s.actor);
      continue;
    }
    break;
  }
  check(guard < 100, "Automatic turn limit");
}
function applyMove(data, input, p) {
  check(!data.finished, "The game has ended");
  check(
    Number.isInteger(p) && p >= 0 && p < data.players.length,
    "Unknown player",
  );
  const m = normalizeMove(input);
  check(
    p === data.actor || ["beg", "treasure"].includes(m.type),
    "Not your turn",
  );
  const legal = availableMoves(data, p).find((x) =>
    matches(normalizeMove(x), m),
  );
  check(legal, "That move is not available");
  const s = copy(data);
  execute(s, legal, p);
  automate(s);
  s._history.push({ p, move: copy(legal) });
  saveFrame(s);
  return s;
}
function playDropped(data) {
  let s = data,
    n = 0;
  while (!s.finished && s.players[s.actor]?.dropped && n++ < 1000)
    s = applyMove(s, chooseAI(s, s.actor), s.actor);
  check(n < 1000, "Dropped player automation limit");
  return s;
}
export function move(data, input, p) {
  return playDropped(applyMove(data, input, p));
}
export const ended = (s) => s.finished;
export const scores = (s) => s.players.map((p) => p.score);
export function rankings(s) {
  if (s.lost) return s.players.map(() => 1);
  const stats = s.players.map((a, p) => [
    a.score,
    Object.values(s.board).reduce(
      (n, t) => n + t.huts.filter((q) => q === p).length,
      0,
    ),
    a.money,
  ]);
  return stats.map(
    (v) =>
      1 +
      stats.filter(
        (w) =>
          w[0] > v[0] ||
          (w[0] === v[0] && (w[1] > v[1] || (w[1] === v[1] && w[2] > v[2]))),
      ).length,
  );
}
export const currentPlayer = (s) => (s.finished ? undefined : s.actor);
export const round = (s) => s.round;
export const logLength = (s) => s._frames.length;
export const timeIncrements = (s) => s.increments;
export const canMoveOutOfTurn = (s, m, p) =>
  !s.finished && !!s.players[p] && ["beg", "treasure"].includes(m?.type);
export function setPlayerMetaData(s, p, meta) {
  s.players[p].name = String(meta.name ?? s.players[p].name);
  return s;
}
function publicFrame(frame, p, finished = false) {
  const out = copy(frame);
  for (const [q, a] of out.players.entries())
    if (q !== p && !finished) a.rest = a.rest ? "hidden" : null;
  if (!(out.phase === "rest" && out.actor === p) && !finished)
    delete out.restAvailable;
  out.lastEvents = (out.lastEvents ?? []).map((e) =>
    e.type === "rest" && e.p !== p && !finished ? { ...e, token: "hidden" } : e,
  );
  return out;
}
export function stripSecret(s, p) {
  const out = publicFrame(capture(s), p, s.finished);
  out.events = copy(s.events).map((e) =>
    e.type === "rest" && e.p !== p && !s.finished
      ? { ...e, token: "hidden" }
      : e,
  );
  out.historyLength = logLength(s);
  out.legal = p === undefined ? [] : availableMoves(s, p);
  out.majorities = s.players.map((_, q) =>
    ACTIONS.filter((a) => majority(s, q, a)),
  );
  return out;
}
export function logSlice(
  s,
  { player, start = 0, end = s._frames.length - 1 } = {},
) {
  return {
    frames: s._frames
      .slice(start, end + 1)
      .map((f) => publicFrame(f, player, s.finished)),
    start,
    end: Math.min(end, s._frames.length - 1),
    length: logLength(s),
  };
}
export function replay(s, { to = logLength(s) } = {}) {
  check(
    Number.isInteger(to) && to >= 1 && to <= logLength(s),
    "Invalid replay position",
  );
  const b = s._setup;
  let r = init(b.count, b.expansions, b.options, b.seed);
  for (const h of s._history.slice(0, to - 1)) r = applyMove(r, h.move, h.p);
  s.players.forEach((p, i) => {
    r.players[i].name = p.name;
    r.players[i].dropped = p.dropped;
  });
  return r;
}
export function createAnalysis(s, { to }) {
  const r = replay(s, { to });
  r.players.forEach((p) => (p.dropped = false));
  return r;
}
function chooseAI(s, p) {
  check(p === s.actor);
  const moves = availableMoves(s, p);
  check(moves.length, "No legal bot move");
  const a = s.players[p];
  function value(m) {
    if (m.type === "treasure")
      return a.money < 3 ? sum(m.values) * 0.5 - 1 : -30;
    if (m.type === "beg") return a.money < 3 ? 1 : -30;
    if (m.type === "place") {
      const adj = neighbors(m.cell)
        .map((c) => s.board[c])
        .filter(Boolean);
      return TILES[m.tile].type === "island"
        ? 5 + adj.filter((t) => t.type === "sea").length
        : adj.filter((t) => t.type === "island").length;
    }
    if (m.type === "neutral")
      return m.actions.reduce(
        (v, action) =>
          v +
          (({ sail: 4, sell: 3, fish: 2, rest: 1 }[action] ?? 0) -
            s.neutral[action]),
        0,
      );
    if (m.type === "character")
      return (
        ({
          fisherman: 4,
          navigator: 3,
          builder: 3,
          artist: 2,
          buyer: 2,
          diver: 2,
          guide: 1,
        }[m.character] ?? 0) +
        (CHARACTERS[m.character].action &&
        actionOptions(s, p, CHARACTERS[m.character].action).length
          ? 3
          : 0)
      );
    if (m.type === "plan") {
      return m.actions.reduce(
        (v, action, i) =>
          v +
          value({ type: "plan-single", action }) -
          (i && action === m.actions[0] ? 0.1 : 0),
        0,
      );
    }
    if (m.type === "plan-single") {
      const n = a.markers[m.action];
      const need =
        Math.max(0, ...s.players.map((x) => x.markers[m.action])) + 1;
      const useful = {
        fish: a.fish.length ? 2 : 5,
        sell: a.fish.length ? 6 : 3,
        explore: 6,
        build: a.hutsLeft > 5 ? 6 : 3,
        buy: 5,
        draw: 5,
        tourist: 4,
        sail: 3,
        rest: 1,
      }[m.action];
      return (
        useful -
        (n >= need ? 8 : n ? 0 : 1) +
        (CHARACTERS[a.character]?.action === m.action ? 2 : 0)
      );
    }
    if (m.type === "discard") return -15;
    if (m.type === "governor") return -10;
    if (m.type === "rest")
      return { first: s.round === 8 ? 4 : 2, both: 3, point: 2, coin: 1 }[
        m.token
      ];
    if (m.action === "sail") {
      const cell = m.path.at(-1),
        t = s.board[cell];
      const lands = neighbors(cell)
        .map((c) => s.board[c])
        .filter((t) => t?.type === "island" && !t.submerged);
      return (
        (t.fish && a.markers.fish ? 4 + t.fish : 0) +
        (t.treasure && a.markers.explore ? 4 + t.treasure : 0) +
        (lands.some((t) => t.huts.includes(p)) && a.markers.sell ? 5 : 0) +
        lands.length -
        (m.bonus ? 0 : m.path.length) * 0.5
      );
    }
    if (m.type === "act")
      return (
        ({
          fish: 4 + (s.board[a.boat].fish ?? 0),
          sell: sum(m.fish ?? []) * s.market,
          explore: 5 + (s.board[a.boat].treasure ?? 0),
          build: 5,
          buy: VALUES[m.good] ?? 0,
          draw: 5,
          tourist: 5,
          rest: 1,
        }[m.action] ?? 0) +
        (m.bonus ? 1 : 0) +
        (m.dike ? 2 : 0)
      );
    return 0;
  }
  const ranked = moves
    .map((m, i) => ({ m, i, value: value(m) }))
    .sort((a, b) => b.value - a.value || a.i - b.i);
  return ranked[0].m;
}
export function moveAI(s, p) {
  return move(s, chooseAI(s, p), p);
}
export function dropPlayer(s, p) {
  check(Number.isInteger(p) && !!s.players[p], "Unknown player");
  const out = copy(s);
  out.players[p].dropped = true;
  return playDropped(out);
}
