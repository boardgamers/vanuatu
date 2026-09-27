import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
import { markerBlockers } from "../engine/marker-blockers.js";
import { CHARACTERS } from "../engine/catalog.js";
test("blocker explanations agree with majority including neutral and character ties", () => {
  for (const n of [2, 3, 5]) {
    const s = E.init(n, [], {}, "blockers");
    for (let first = 0; first < n; first++)
      for (const character of [null, ...Object.keys(CHARACTERS)]) {
        s.first = first;
        s.players[0].character = character;
        for (const action of E.ACTIONS)
          for (const ours of [1, 2, 3])
            for (const theirs of [0, 1, 2, 3]) {
              s.players.forEach(
                (p, i) => (p.markers[action] = i === 0 ? ours : theirs),
              );
              s.neutral[action] = theirs;
              assert.equal(
                markerBlockers(s, 0, action).length === 0,
                E.majority(s, 0, action),
              );
            }
      }
  }
});
test("discard log preserves blockers and counts before markers disappear", () => {
  const s = E.init(3, [], {}, "log");
  s.phase = "actions";
  s.first = 0;
  s.actor = 1;
  s.players.forEach((p) => {
    p.markers = Object.fromEntries(E.ACTIONS.map((a) => [a, 0]));
    p.character = null;
  });
  s.players[0].markers.fish = 2;
  s.players[1].markers.fish = 1;
  s.players[1].markers.sail = 1;
  s.players[2].markers.sail = 2;
  const next = E.move(s, { type: "discard", action: "fish" }, 1);
  const event = next.events.findLast(
    (e) => e.type === "discard" && e.p === 1 && e.action === "fish",
  );
  assert.equal(event.markers, 1);
  assert.deepEqual(event.blockers, [{ p: 0, count: 2, tied: false }]);
  assert.equal(next.players[1].markers.fish, 0);
});

test("entering a fully blocked turn preserves the choice between stacks", () => {
  const s = E.init(3, [], {}, "blocked-choice");
  s.phase = "actions";
  s.first = 0;
  s.actor = 0;
  s.players.forEach((p) => {
    p.markers = Object.fromEntries(E.ACTIONS.map((a) => [a, 0]));
    p.character = null;
    p.score = 0;
    p.treasures = [];
  });
  Object.assign(s.players[0].markers, { build: 1, fish: 2, sail: 2 });
  s.players[0].money = 0;
  Object.assign(s.players[1].markers, { fish: 1, sail: 1 });
  s.players[2].markers.rest = 1;
  const next = E.move(s, { type: "discard", action: "build" }, 0);
  assert.equal(next.actor, 1);
  assert.equal(next.players[1].markers.fish, 1);
  assert.equal(next.players[1].markers.sail, 1);
  assert.deepEqual(E.availableMoves(next, 1), [
    { type: "discard", action: "sail" },
    { type: "discard", action: "fish" },
  ]);
});
