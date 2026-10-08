import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";

function position() {
  const s = E.init(3, [], {}, "retrieval");
  s.phase = "actions";
  s.actor = s.first = 0;
  s.players.forEach((p) => {
    p.markers = Object.fromEntries(E.ACTIONS.map((a) => [a, 0]));
    p.money = p.score = 0;
    p.character = null;
    p.treasures = [];
    p.boat = "1,0";
  });
  s.players[0].markers.build = 1;
  s.players[1].markers.rest = 1;
  return s;
}

test("the last unusable stack waits for its player before ending the round", () => {
  let s = position();
  s.players[1].markers.rest = 0;
  s.players[0].markers.draw = 2;
  s.board["0,0"].drawings = E.TILES[s.board["0,0"].id].drawings;
  s.players[0].rest = "both";
  const before = structuredClone(s);
  s = E.move(s, { type: "discard", action: "build" }, 0);
  assert.equal(s.round, 1);
  assert.equal(s.actor, 0);
  assert.equal(s.players[0].markers.draw, 2);
  assert.equal(s.players[0].score, 0);
  assert.deepEqual(E.availableMoves(s), [{ type: "discard", action: "draw" }]);
  assert.deepEqual(before.players[0].markers.draw, 2);
  s = E.move(s, { type: "discard", action: "draw" }, 0);
  assert.equal(s.round, 2);
  assert.equal(s.players[0].markers.draw, 0);
  assert.equal(s.players[0].score, 1);
  assert.equal(s._history.at(-1).move.action, "draw");
});

test("automatic retrieval is opt-in for the next actor, scoped to each player", () => {
  let s = position();
  s.players[1].markers = { draw: 1 };
  s.board["0,0"].drawings = E.TILES[s.board["0,0"].id].drawings;
  assert.deepEqual(E.playerSettings(s, 1), { autoRetrieve: false });
  const optedIn = E.setPlayerSettings(s, 1, { autoRetrieve: true });
  assert.deepEqual(E.playerSettings(s, 1), { autoRetrieve: false });
  assert.deepEqual(E.playerSettings(optedIn, 0), { autoRetrieve: false });
  const manual = E.move(s, { type: "discard", action: "build" }, 0);
  assert.equal(manual.actor, 1);
  assert.equal(manual.players[1].markers.draw, 1);
  const automatic = E.move(optedIn, { type: "discard", action: "build" }, 0);
  assert.equal(automatic.round, 2);
  assert.equal(automatic.players[1].markers.draw, 0);
  assert.deepEqual(automatic._history.at(-1).autoRetrieve, [
    false,
    true,
    false,
  ]);
  const disabled = E.setPlayerSettings(optedIn, 1, { autoRetrieve: false });
  assert.equal(
    E.move(disabled, { type: "discard", action: "build" }, 0).round,
    1,
  );
  assert.equal(
    E.playerSettings(E.setPlayerSettings(s, 1, { autoRetrieve: "true" }), 1)
      .autoRetrieve,
    false,
  );
});

test("treasure exchanges count as retrieval alternatives only when they unlock an action", () => {
  const s = position();
  s.players[0].treasures = [2];
  assert.deepEqual(E.actionsAfterExchanges(s), []);
  s.players[0].treasures = [3];
  const before = structuredClone(s);
  const expected = [{ exchanges: ["treasure"], actions: ["build"] }];
  assert.deepEqual(E.actionsAfterExchanges(s), expected);
  assert.deepEqual(E.actionsAfterExchanges(E.stripSecret(s, 0)), expected);
  assert.deepEqual(s, before);
  const after = E.move(s, { type: "treasure", values: [3] }, 0);
  assert.equal(after.actor, 0);
  assert.equal(after.players[0].markers.build, 1);
  assert.ok(
    E.availableMoves(after).some(
      (m) => m.type === "act" && m.action === "build",
    ),
  );
  assert.deepEqual(E.actionsAfterExchanges(after), []);
});

test("money does not remove marker or board restrictions", () => {
  const s = position();
  s.players[0].treasures = [3];
  s.players[1].markers.build = 2;
  assert.deepEqual(E.actionsAfterExchanges(s), []);
  s.players[1].markers.build = 1;
  s.first = 1;
  assert.deepEqual(E.actionsAfterExchanges(s), []);
  s.first = 0;
  assert.deepEqual(E.actionsAfterExchanges(s), [
    { exchanges: ["treasure"], actions: ["build"] },
  ]);
  s.players[1].markers.build = 0;
  s.players[0].hutsLeft = 0;
  assert.deepEqual(E.actionsAfterExchanges(s), []);
  s.players[0].markers = { tourist: 1 };
  s.tourists = 0;
  assert.deepEqual(E.actionsAfterExchanges(s), []);
});

test("beggar funding distinguishes single and combined exchanges", () => {
  const s = position();
  s.players[0].character = "beggar";
  s.players[0].score = 1;
  s.players[0].treasures = [2];
  assert.deepEqual(E.actionsAfterExchanges(s), [
    { exchanges: ["treasure", "beg"], actions: ["build"] },
  ]);
  s.players[0].treasures = [];
  s.players[0].score = 3;
  assert.deepEqual(E.actionsAfterExchanges(s), [
    { exchanges: ["beg"], actions: ["build"] },
  ]);
  s.players[0].used = true;
  assert.deepEqual(E.actionsAfterExchanges(s), []);
});

test("already playable actions are omitted and partial treasure sales are considered", () => {
  const s = position();
  s.players[0].treasures = [5, 5];
  s.players[0].money = 5;
  s.players[0].markers.sail = 1;
  assert.deepEqual(E.actionsAfterExchanges(s), []);
  s.players[0].money = 0;
  s.players[0].treasures = [3, 7];
  assert.deepEqual(E.actionsAfterExchanges(s), [
    { exchanges: ["treasure"], actions: ["sail", "build"] },
  ]);
});

test("funding respects preacher permission and actor", () => {
  const s = position();
  s.players[0].character = "preacher";
  s.players[0].treasures = [3];
  s.players[1].markers.build = 2;
  assert.deepEqual(E.actionsAfterExchanges(s), [
    { exchanges: ["treasure"], actions: ["build"] },
  ]);
  s.players[0].used = true;
  assert.deepEqual(E.actionsAfterExchanges(s), []);
  assert.deepEqual(E.actionsAfterExchanges(s, 1), []);
});

test("replay keeps automatic retrieval decisions across setting changes", () => {
  let s = E.init(3, [], {}, "retrieval-replay");
  for (let n = 0; n < 120 && !s.finished; n++) {
    if (n % 10 === 0)
      s = E.setPlayerSettings(s, n % 3, { autoRetrieve: n % 20 === 0 });
    s = E.moveAI(s, s.actor);
  }
  const replayed = E.replay(s);
  assert.equal(replayed.actor, s.actor);
  assert.equal(replayed.round, s.round);
  assert.deepEqual(replayed.events, s.events);
  assert.deepEqual(replayed.players, s.players);
});
