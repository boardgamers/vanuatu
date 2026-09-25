import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
function actionState(players = 3) {
  const s = E.init(players, [], {}, "fixture");
  s.phase = "actions";
  s.actor = 0;
  s.first = 0;
  for (const p of s.players) {
    p.character = null;
    p.markers = Object.fromEntries(E.ACTIONS.map((a) => [a, 0]));
    p.boat = "1,0";
  }
  s.board["1,0"] = E.tileState("startWreck");
  s.players[0].markers.fish = 2;
  s.players[1].markers.rest = 1;
  return s;
}
const act = (s, p, action, fields = {}) =>
  E.availableMoves(s, p).find(
    (m) =>
      m.action === action &&
      Object.entries(fields).every(
        ([k, v]) => JSON.stringify(m[k]) === JSON.stringify(v),
      ),
  );
test("seeded setup, deck ordering and player counts", () => {
  for (let n = 2; n <= 5; n++) {
    const a = E.init(n, [], {}, "seed"),
      b = E.init(n, [], {}, "seed");
    assert.deepEqual(a, b);
    assert.equal(a.upcoming[0][0], "a");
    assert.equal(a.upcoming[1][0], "b");
    assert.equal(Object.keys(a.board).length, 4);
    assert.equal(a._touristDeck.length, 7);
    assert.equal(a.players[0].money, 3);
  }
});
test("majorities use turn order and all tokens are retrieved", () => {
  let s = actionState();
  s.players[1].markers.fish = 2;
  s.first = 1;
  assert.equal(E.majority(s, 0, "fish"), false);
  s.first = 0;
  assert.equal(E.majority(s, 0, "fish"), true);
  s = E.move(s, act(s, 0, "fish"), 0);
  assert.equal(s.players[0].markers.fish, 0);
  assert.deepEqual(s.players[0].fish, [1]);
  assert.equal(s.board["1,0"].fish, 0);
});
test("income converts immediately, and selling lowers the market once", () => {
  let s = actionState();
  s.players[0].markers = { ...s.players[0].markers, fish: 0, sell: 2 };
  s.players[0].fish = [1, 2];
  s.players[0].money = 3;
  s.board["0,0"].huts = [0];
  const m = act(s, 0, "sell", { fish: [1, 2] });
  s = E.move(s, m, 0);
  assert.equal(s.players[0].money, 2);
  assert.equal(s.players[0].score, 5);
  assert.equal(s.market, 2);
});
test("planning requires an achievable prerequisite and considers existing plans", () => {
  const s = actionState();
  s.players[0].markers.fish = 0;
  s.players[0].money = 0;
  assert.equal(E.canPlan(s, 0, "sell"), false);
  s.players[0].markers.fish = 1;
  s.players[0].markers.build = 1;
  s.players[0].money = 3;
  assert.equal(E.canPlan(s, 0, "sell"), true);
});
test("buyer exports to first demand and completion gives +2", () => {
  let s = actionState();
  s.players[0].markers.buy = 1;
  s.players[0].markers.fish = 0;
  s.players[0].character = "buyer";
  s.demands = [
    { id: 1, goods: ["kava", "kava"], filled: [false, false] },
    { id: 2, goods: ["kava"], filled: [false] },
  ];
  s = E.move(
    s,
    act(s, 0, "buy", { cell: "0,0", good: "kava", bonus: true }),
    0,
  );
  assert.deepEqual(s.demands[0].filled, [true, true]);
  assert.deepEqual(s.demands[1].filled, [false]);
  assert.equal(s.players[0].score, 4);
});
test("exports preserve the selected resource, cost and reward", () => {
  for (const good of E.GOODS) {
    const s = actionState();
    s.players[0].markers.buy = 1;
    s.players[0].money = 9;
    s.demands = [{ id: 1, goods: [...E.GOODS], filled: [false, false, false] }];
    const chosen = act(s, 0, "buy", { cell: "0,0", good });
    const next = E.move(s, chosen, 0);
    assert.equal(next._history.at(-1).move.good, good);
    assert.equal(next.players[0].money, 9 - E.PRICES[good]);
    assert.equal(next.players[0].score, E.VALUES[good]);
    for (const [i, resource] of E.GOODS.entries()) {
      assert.equal(
        next.board["0,0"].goods[resource],
        resource === good ? 0 : 1,
      );
      assert.equal(next.demands[0].filled[i], resource === good);
    }
    assert.throws(
      () => E.move(s, { ...chosen, good: "unknown" }, 0),
      /not available/,
    );
    const { good: ignored, ...missing } = chosen;
    assert.throws(() => E.move(s, missing, 0), /not available/);
  }
});
test("character is optional and a bonus is usable only once", () => {
  let s = actionState();
  s.players[0].character = "fisherman";
  assert.ok(act(s, 0, "fish", { bonus: false }));
  s = E.move(s, act(s, 0, "fish", { bonus: true }), 0);
  assert.equal(s.players[0].score, 1);
  assert.equal(s.players[0].used, true);
});
test("two-player neutral thresholds and matching character ties", () => {
  const s = actionState(2);
  s.neutral.fish = 2;
  assert.equal(E.majority(s, 0, "fish"), false);
  s.players[0].character = "fisherman";
  assert.equal(E.majority(s, 0, "fish"), true);
  s.players[0].used = true;
  assert.equal(E.majority(s, 0, "fish"), true);
});
test("preacher can break a blocked turn but cannot ignore another majority", () => {
  const s = actionState();
  s.players[0].character = "preacher";
  s.players[1].markers.fish = 3;
  assert.ok(E.availableMoves(s, 0).some((m) => m.preach));
  s.players[0].markers.rest = 2;
  assert.ok(!E.availableMoves(s, 0).some((m) => m.preach));
});
test("governor transfers the entire stack and uses the turn", () => {
  let s = actionState();
  s.players[0].character = "governor";
  s = E.move(s, { type: "governor", from: "fish", to: "explore" }, 0);
  assert.equal(s.players[0].markers.explore, 2);
  assert.equal(s.players[0].markers.fish, 0);
  assert.equal(s.players[0].used, true);
  assert.equal(s.actor, 1);
});
test("free treasure sales work out of turn and do not add clock increments", () => {
  let s = actionState();
  s.players[2].treasures = [2];
  const inc = [...s.increments];
  s = E.move(s, { type: "treasure", values: [2] }, 2);
  assert.equal(s.players[2].money, 5);
  assert.equal(s.actor, 0);
  assert.deepEqual(s.increments, inc);
});
test("illegal moves cannot mutate the source state", () => {
  const s = actionState(),
    before = structuredClone(s);
  assert.throws(() =>
    E.move(
      s,
      { type: "act", action: "buy", good: "beef", cell: "0,0", bonus: false },
      0,
    ),
  );
  assert.deepEqual(s, before);
});
test("hidden deck, future RNG and rest choice are not exposed", () => {
  const s = actionState();
  s.players[1].rest = "first";
  s.phase = "rest";
  s.actor = 0;
  const spectator = E.stripSecret(s);
  assert.ok(!("_seed" in spectator));
  assert.ok(!("_history" in spectator));
  assert.ok(!("restAvailable" in spectator));
  assert.equal(spectator.players[1].rest, "hidden");
  assert.deepEqual(spectator.legal, []);
  assert.ok(E.stripSecret(s, 0).restAvailable);
});
test("deterministic replay reconstructs every history boundary", () => {
  let s = E.init(3, [], {}, "replay");
  for (let n = 0; n < 14; n++) s = E.moveAI(s, s.actor);
  for (let n = 1; n <= E.logLength(s); n++) {
    const r = E.createAnalysis(s, { to: n });
    assert.equal(E.logLength(r), n);
    assert.deepEqual(
      E.stripSecret(r, 0).board,
      E.logSlice(s, { player: 0, start: n - 1, end: n - 1 }).frames[0].board,
    );
  }
});
test("Rising Waters floods after its action countdown and dikes protect edges", () => {
  let s = actionState();
  s.options.risingWaters = true;
  s.waterCountdown = 1;
  s.board["0,0"].dikes = ["1,0"];
  s = E.move(s, act(s, 0, "fish"), 0);
  assert.equal(s.board["0,0"].water, 2);
  assert.equal(s.waterTriggered, true);
});
test("rest choices stay secret in replay events as well as state", () => {
  let s = actionState();
  s.phase = "rest";
  s.actor = 0;
  s._restAvailable = ["first", "coin"];
  s = E.move(s, { type: "rest", token: "first" }, 0);
  const last = E.logSlice(s, { player: 1, start: E.logLength(s) - 1 })
    .frames[0];
  assert.equal(last.players[0].rest, "hidden");
  assert.equal(last.lastEvents.find((e) => e.type === "rest").token, "hidden");
  assert.equal(
    E.stripSecret(s, 0).lastEvents.find((e) => e.type === "rest").token,
    "first",
  );
});
test("dropped players are automated on future turns and replay boundaries remain valid", () => {
  let s = E.init(3, [], {}, "drop");
  const dropped = (s.actor + 1) % 3;
  s = E.dropPlayer(s, dropped);
  for (let n = 0; n < 22 && !s.finished; n++) {
    assert.notEqual(s.actor, dropped);
    s = E.moveAI(s, s.actor);
  }
  assert.ok(s._history.some((h) => h.p === dropped));
  for (let n = 1; n <= E.logLength(s); n++)
    assert.deepEqual(
      E.createAnalysis(s, { to: n }).board,
      s._frames[n - 1].board,
    );
});
test("batched planning accounts for the first new marker as a prerequisite", () => {
  const s = actionState();
  s.phase = "plan";
  s.planningPass = 0;
  s.players[0].markers = Object.fromEntries(E.ACTIONS.map((a) => [a, 0]));
  s.board["0,0"].huts = [0];
  s.players[0].fish = [];
  assert.ok(
    E.availableMoves(s).some(
      (m) =>
        m.type === "plan" && m.actions[0] === "fish" && m.actions[1] === "sell",
    ),
  );
});
test("an optional treasure sale is not skipped by automatic marker retrieval", () => {
  let s = actionState();
  s.actor = 0;
  s.players[0].markers = { ...s.players[0].markers, fish: 1 };
  s.players[1].markers = Object.fromEntries(
    E.ACTIONS.map((a) => [a, a === "sail" ? 1 : 0]),
  );
  s.players[1].money = 0;
  s.players[1].treasures = [2];
  s = E.move(s, act(s, 0, "fish"), 0);
  assert.equal(s.actor, 1);
  assert.ok(E.availableMoves(s, 1).some((m) => m.type === "treasure"));
  s = E.move(s, { type: "treasure", values: [2] }, 1);
  assert.ok(E.availableMoves(s, 1).some((m) => m.action === "sail"));
});
test("Governor marker movement does not perform an action or advance the flood die", () => {
  let s = actionState();
  s.players[0].character = "governor";
  s.options.risingWaters = true;
  s.waterCountdown = 1;
  s = E.move(s, { type: "governor", from: "fish", to: "explore" }, 0);
  assert.equal(s.waterCountdown, 1);
  assert.equal(s.waterTriggered, false);
});

test("printed footprint has 4/5/6/1 cells and the bottom touches row-three spaces 2 and 3", () => {
  const s = E.init(3, [], {}, "printed-board");
  const rows = [0, 1, 2, 3].map((r) =>
    E.boardCells(s).filter((c) => c.r === r),
  );
  assert.deepEqual(
    rows.map((row) => row.length),
    [4, 5, 6, 1],
  );
  assert.deepEqual(
    E.neighbors(rows[3][0].id, s).sort(),
    [rows[2][1].id, rows[2][2].id].sort(),
  );
  s.phase = "expand";
  s.upcoming = ["startFish"];
  s.board["3,1"] = E.tileState("a1");
  s.board["3,2"] = E.tileState("startBoat");
  assert.ok(E.placementOptions(s).some((m) => m.cell === "4,2"));
  assert.ok(!E.placementOptions(s).some((m) => m.cell === "3,0"));
  const old = structuredClone(s);
  delete old.boardLayout;
  assert.ok(!E.placementOptions(old).some((m) => m.cell === "4,2"));
  assert.ok(E.boardCells(old).some((c) => c.id === "3,0"));
});

test("saved beta history replays on its original footprint", async () => {
  const { readFile } = await import("node:fs/promises");
  const fixture = JSON.parse(
    await readFile(
      new URL("./fixtures/legacy-board.json", import.meta.url),
      "utf8",
    ),
  );
  const saved = {
    _setup: fixture.setup,
    _history: fixture.history,
    _frames: Array(fixture.history.length + 1),
    players: fixture.players,
  };
  const replayed = E.replay(saved);
  assert.equal(replayed.boardLayout, 1);
  assert.equal(replayed.finished, true);
  assert.deepEqual(replayed.board, fixture.board);
  assert.deepEqual(E.scores(replayed), fixture.scores);
  assert.ok(E.stripSecret(replayed, 0).board["3,0"]);
});

test("an unaffordable majority can be retrieved or kept while taking another action", () => {
  const s = actionState();
  s.players[0].money = 0;
  s.players[0].markers.build = 1;
  const moves = E.availableMoves(s, 0);
  const discard = moves.find(
    (m) => m.type === "discard" && m.action === "build",
  );
  const fish = moves.find((m) => m.type === "act" && m.action === "fish");
  assert.ok(discard);
  assert.ok(fish);
  assert.ok(!moves.some((m) => m.type === "act" && m.action === "build"));
  const retrieved = E.move(s, discard, 0);
  assert.equal(retrieved.players[0].markers.build, 0);
  assert.equal(retrieved.players[0].markers.fish, 2);
  assert.deepEqual(retrieved.board["0,0"].huts, []);
  const waited = E.move(s, fish, 0);
  assert.equal(waited.players[0].markers.build, 1);
});
