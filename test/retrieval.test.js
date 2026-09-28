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
