import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";

test("simulation replaces private future state and can continue", () => {
  const s = E.init(3, [], {}, "source-secret");
  const before = structuredClone(s);
  const other = structuredClone(s);
  other._seed = "other";
  other._setup.seed = "other";
  other._rng = 555;
  other._tileDeck.reverse();
  other._touristDeck.reverse();
  other._demandDeck.reverse();
  other._history.push({ p: 1, move: { secret: "source-secret" } });
  const a = E.createAnalysisScenario(s, { player: 0, seed: "fake" });
  assert.deepEqual(
    a,
    E.createAnalysisScenario(other, { player: 0, seed: "fake" }),
  );
  assert.deepEqual(s, before);
  assert.ok(!JSON.stringify(a).includes("source-secret"));
  assert.notDeepEqual(
    a,
    E.createAnalysisScenario(s, { player: 0, seed: "different" }),
  );
  let state = a;
  for (let i = 0; i < 300 && !E.ended(state); i++)
    state = E.moveAI(state, E.currentPlayer(state));
  assert.ok(state.round > 1);
});

test("observer rest tokens and re-sampling remain independent", () => {
  const s = E.init(3, [], {}, "private");
  s.players[1].rest = "coin";
  s._restAvailable = ["first", "both", "point"];
  const changed = structuredClone(s);
  changed.players[1].rest = "point";
  changed._restAvailable = ["first", "both", "coin"];
  const a = E.createAnalysisScenario(s, { seed: "same" });
  assert.deepEqual(a, E.createAnalysisScenario(changed, { seed: "same" }));
  const again = E.createAnalysisScenario(a, { seed: "new" });
  assert.equal(again._touristDeck.length, a._touristDeck.length);
  assert.deepEqual(
    [...again._demandDeck].map((d) => d.id).sort(),
    [...a._demandDeck].map((d) => d.id).sort(),
  );
  assert.equal(
    new Set([
      ...again._restAvailable,
      ...again.players.map((p) => p.rest).filter(Boolean),
    ]).size,
    4,
  );
});

test("rest tokens seen on an earlier personal turn constrain later scenarios and rerolls", () => {
  const s = E.init(3, [], {}, "known-rest");
  s.players[0].rest = "coin";
  s.players[1].rest = "point";
  s.players[2].rest = "both";
  s._restAvailable = ["first"];
  const observed = structuredClone(s._frames[0]);
  observed.phase = "rest";
  observed.actor = 0;
  observed.players[1].rest = "point";
  observed.restAvailable = ["coin", "both", "first"];
  s._frames.push(observed);
  for (const seed of ["one", "two", "three"]) {
    const a = E.createAnalysisScenario(s, { player: 0, seed });
    assert.equal(a.players[1].rest, "point");
    const b = E.createAnalysisScenario(a, { player: 0, seed: "reroll" });
    assert.equal(b.players[1].rest, "point");
  }
});
