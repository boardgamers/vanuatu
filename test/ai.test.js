import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";

function planning(players = 3) {
  const s = E.init(players, [], {}, "bot-planning");
  s.actor = 0;
  s.first = 0;
  s.phase = "plan";
  s.planningPass = 0;
  s.board = {
    "0,0": E.tileState("efate"),
    "1,0": E.tileState("startWreck"),
    "0,1": E.tileState("startFish"),
    "1,1": E.tileState("startBoat"),
  };
  s.tourists = 2;
  for (const player of s.players) {
    player.boat = "1,0";
    player.character = null;
  }
  return s;
}

test("a two-marker bot placement opens two useful actions instead of overstacking", () => {
  const s = planning();
  s.players[0].character = "builder";
  const next = E.moveAI(s, 0);
  const { actions } = next._history[0].move;
  assert.equal(new Set(actions).size, 2);
  assert.ok(actions.includes("build"));
  assert.equal(
    Object.values(s.players[0].markers).reduce((a, b) => a + b),
    0,
  );
});

function contested(players = 3) {
  const s = planning(players);
  s.planningPass = 2;
  s.players[0].character = "fisherman";
  s.players[0].money = 0;
  Object.assign(s.players[0].markers, { fish: 1, draw: 1, sail: 2 });
  s.board["1,0"].treasure = 0;
  s.board["0,0"].goods = {};
  s.board["0,0"].huts = [];
  s.tourists = 0;
  return s;
}

test("the bot reinforces a tied fishing stack only when turn order requires it", () => {
  for (const first of [0, 1]) {
    const s = contested();
    s.first = first;
    s.players[1].markers.fish = 1;
    const next = E.moveAI(s, 0);
    assert.deepEqual(next._history[0].move.actions, [
      first === 1 ? "fish" : "rest",
    ]);
  }
});

test("the bot accounts for persistent neutral stacks and matching character ties", () => {
  for (const character of ["fisherman", null]) {
    const s = contested(2);
    s.players[0].character = character;
    s.neutral.fish = 2;
    const next = E.moveAI(s, 0);
    assert.deepEqual(next._history[0].move.actions, [
      character ? "fish" : "rest",
    ]);
  }
});

test("bots complete games with 2–5 players, including Rising Waters", () => {
  for (const count of [2, 3, 4, 5])
    for (const expansions of [[], ["rising-waters"]]) {
      let s = E.init(count, expansions, {}, "bot-full-game");
      let turns = 0;
      while (!s.finished && turns++ < 1000) s = E.moveAI(s, s.actor);
      assert.equal(s.finished, true, `${count} players / ${expansions}`);
      assert.ok(s.players.every((p) => Number.isFinite(p.score)));
    }
});
