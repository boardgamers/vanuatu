import test from "node:test";
import assert from "node:assert/strict";
import {
  achievementManifestSchema,
  achievementResultsSchema,
} from "@boardgamers/protocol/achievements";
import * as E from "../engine/index.js";

const json = (value) => JSON.parse(JSON.stringify(value));
const countAwards = [
  "duel-victory",
  "trio-victory",
  "quartet-victory",
  "full-table-victory",
];
const ids = [
  "island-victory",
  ...countAwards,
  "rising-waters-victory",
  "no-characters-victory",
  "fifty-points",
  "seventy-five-points",
  "nine-vatus",
  "four-huts",
  "three-islands",
  "tourism-twelve",
  "treasure-six",
  "treasure-twelve",
  "weather-the-waters",
];
const fixtures = new Map();
function completed(count = 3, expansions = []) {
  const key = `${count}/${expansions}`;
  if (!fixtures.has(key)) {
    let s = E.init(count, expansions, {}, "bot-full-game");
    for (let turn = 0; !s.finished && turn < 1000; turn++) {
      // moveAI uses the engine's legal move application, not fabricated history.
      s = E.moveAI(s, s.actor);
    }
    assert.equal(s.finished, true);
    assert.equal(s.phase, "ended");
    fixtures.set(key, s);
  }
  return json(fixtures.get(key));
}
function results(s) {
  const before = structuredClone(s);
  const result = E.achievements(s);
  assert.deepEqual(s, before, "evaluation must not mutate persisted state");
  achievementResultsSchema(E.achievementDefinitions(), s.players.length).parse(
    result,
  );
  return result;
}
// Synthetic boundary fixtures intentionally start with a real completed game.
// Scores and final-scoring components are independent here: these are predicate
// tests, not claims that these modified totals could arise from that history.
function boundary(count = 3) {
  const s = completed(count);
  assert.equal(s.lost, false);
  assert.equal(s.round, 8);
  s.options.risingWaters = false;
  s.options.characters = true;
  for (const tile of Object.values(s.board)) tile.huts = [];
  for (const p of s.players) {
    p.score = 0;
    p.money = 0;
    p.final.tourists = 0;
    p.final.treasure = 0;
  }
  s.players[1].score = 100; // seat 0 loses, so thresholds cannot hide behind wins.
  return s;
}
const earned = (s, seat = 0) => results(s)[seat].earned;
function islands(s) {
  return Object.values(s.board).filter(
    (t) => t.type === "island" && !t.submerged,
  );
}

test("manifest passes the official runtime schema and is independently owned", () => {
  const manifest = E.achievementDefinitions();
  achievementManifestSchema.parse(manifest);
  assert.equal(manifest.revision, 1);
  assert.deepEqual(
    manifest.achievements.map((a) => a.id),
    ids,
  );
  manifest.achievements[0].name = "changed";
  manifest.achievements.pop();
  assert.equal(E.achievementDefinitions().achievements.length, 16);
  assert.equal(
    E.achievementDefinitions().achievements[0].name,
    "Island Victory",
  );
});

test("real legal AI games serialize, evaluate and replay without mutation", () => {
  for (const count of [2, 3, 4, 5]) {
    for (const expansions of [[], ["rising-waters"]]) {
      const s = completed(count, expansions);
      const before = json(s);
      const awards = results(s);
      assert.equal(awards.length, count);
      assert.deepEqual(
        awards.map((r) => r.seat),
        Array.from({ length: count }, (_, i) => i),
      );
      assert.deepEqual(results(json(s)), awards);
      assert.deepEqual(results(E.replay(s)), awards);
      assert.deepEqual(
        s,
        before,
        "replay and evaluation preserve source history/frames",
      );
      if (s.lost) {
        assert.ok(
          awards.every((r) => r.outcome === "loss" && r.earned.length === 0),
        );
      } else {
        const ranks = E.rankings(s);
        const leaders = ranks.filter((r) => r === 1).length;
        awards.forEach((r, seat) => {
          assert.equal(
            r.outcome,
            ranks[seat] !== 1 ? "loss" : leaders === 1 ? "win" : "draw",
          );
          assert.equal(
            r.earned.includes("weather-the-waters"),
            expansions.length > 0,
          );
        });
      }
    }
  }
});

test("outright wins award exactly the correct table-size predicate for 2–5 seats", () => {
  for (const count of [2, 3, 4, 5]) {
    const s = boundary(count);
    assert.deepEqual(earned(s, 1), [
      "island-victory",
      countAwards[count - 2],
      "fifty-points",
      "seventy-five-points",
    ]);
    assert.deepEqual(earned(s), []);
    s.players[0].score = 100;
    for (const seat of [0, 1]) {
      const r = results(s)[seat];
      assert.equal(r.outcome, "draw");
      assert.ok(!r.earned.some((id) => id.endsWith("victory")));
    }
  }
});

test("expansion and character predicates require outright victory; survival does not", () => {
  for (const risingWaters of [false, true]) {
    for (const characters of [false, true]) {
      const s = boundary();
      Object.assign(s.options, { risingWaters, characters });
      const r = results(s);
      assert.equal(r[1].earned.includes("rising-waters-victory"), risingWaters);
      assert.equal(r[1].earned.includes("no-characters-victory"), !characters);
      assert.equal(r[0].earned.includes("rising-waters-victory"), false);
      assert.equal(r[0].earned.includes("no-characters-victory"), false);
      assert.ok(
        r.every(
          (a) => a.earned.includes("weather-the-waters") === risingWaters,
        ),
      );
      s.players[0].score = 100;
      assert.ok(
        results(s).every((a) => !a.earned.some((id) => id.endsWith("victory"))),
      );
    }
  }
});

for (const [id, field, threshold, final] of [
  ["fifty-points", "score", 50, false],
  ["seventy-five-points", "score", 75, false],
  ["nine-vatus", "money", 9, false],
  ["tourism-twelve", "tourists", 12, true],
  ["treasure-six", "treasure", 6, true],
  ["treasure-twelve", "treasure", 12, true],
]) {
  test(`synthetic boundary: ${id}`, () => {
    for (const value of [threshold - 1, threshold, threshold + 1]) {
      const s = boundary();
      (final ? s.players[0].final : s.players[0])[field] = value;
      assert.equal(
        earned(s).includes(id),
        id === "nine-vatus" ? value === 9 : value >= threshold,
        `${field}=${value}`,
      );
    }
  });
}

test("surviving huts and distinct islands have separate inclusive boundaries", () => {
  for (const count of [3, 4, 5]) {
    const s = boundary();
    islands(s)[0].huts = Array(count).fill(0);
    assert.equal(earned(s).includes("four-huts"), count >= 4);
    assert.equal(earned(s).includes("three-islands"), false);
  }
  for (const count of [2, 3, 4]) {
    const s = boundary();
    assert.ok(islands(s).length >= count);
    islands(s)
      .slice(0, count)
      .forEach((t) => {
        t.huts = [0];
      });
    assert.equal(earned(s).includes("three-islands"), count >= 3);
    assert.equal(earned(s).includes("four-huts"), count >= 4);
  }
  const s = boundary();
  const tiles = islands(s);
  tiles.slice(0, 2).forEach((t) => {
    t.huts = [0];
  });
  tiles[2].huts = [0, 0, 0, 1];
  tiles[2].submerged = true;
  Object.values(s.board).find((t) => t.type !== "island").huts = [0, 0];
  assert.deepEqual(
    earned(s),
    [],
    "submerged, non-island and opponents' huts do not count",
  );
});

test("official ranking uses huts then money; tied leaders draw and lower seats lose", () => {
  const s = boundary();
  s.players[0].score = s.players[1].score = 40;
  s.players[0].money = 8;
  islands(s)[0].huts = [1];
  assert.deepEqual(E.rankings(s), [2, 1, 3]);
  assert.equal(results(s)[1].outcome, "win");
  assert.ok(earned(s, 1).includes("island-victory"));
  islands(s)[0].huts = [0, 1];
  assert.deepEqual(E.rankings(s), [1, 2, 3]);
  assert.equal(results(s)[0].outcome, "win");
  assert.ok(earned(s).includes("island-victory"));
  s.players[1].money = 8;
  assert.deepEqual(E.rankings(s), [1, 1, 3]);
  assert.deepEqual(
    results(s).map((r) => r.outcome),
    ["draw", "draw", "loss"],
  );
  assert.ok(results(s).every((r) => r.earned.length === 0));
});

test("collective loss overrides rankings and every otherwise qualifying award", () => {
  const s = boundary();
  Object.assign(s.options, { risingWaters: true, characters: false });
  s.lost = true;
  s.players.forEach((p, seat) => {
    Object.assign(p, {
      score: 100,
      money: 9,
      final: { tourists: 12, treasure: 12 },
    });
    islands(s)
      .slice(0, 3)
      .forEach((t) => {
        t.huts.push(seat, seat);
      });
  });
  assert.deepEqual(E.rankings(s), [1, 1, 1]);
  assert.deepEqual(
    results(s),
    s.players.map((_, seat) => ({ seat, earned: [], outcome: "loss" })),
  );
});

test("unfinished, non-final, practice, tutorial, analysis and public states award nothing", () => {
  assert.deepEqual(results(E.init(3, [], {}, "unfinished")), []);
  const variants = [
    (s) => {
      s.finished = false;
    },
    (s) => {
      s.phase = "actions";
    },
    (s) => {
      s.round = 7;
    },
    (s) => {
      delete s.players[0].final;
    },
    (s) => {
      s._setup.options.practice = true;
    },
    (s) => {
      s._setup.options.tutorial = true;
    },
    ...["practice", "tutorial", "analysis"].map((mode) => (s) => {
      s.achievementMode = mode;
    }),
    (s) => {
      s._analysisPublicDraws = {};
    },
    (s) => {
      delete s._setup;
    },
    (s) => {
      delete s._history;
    },
  ];
  for (const mutate of variants) {
    const s = completed();
    mutate(s);
    assert.deepEqual(results(s), [], String(mutate));
  }
  const s = completed();
  const analysis = E.createAnalysis(s, { to: E.logLength(s) });
  assert.deepEqual(results(analysis), []);
  const replayedAnalysis = E.replay(analysis);
  assert.equal(replayedAnalysis.achievementMode, "analysis");
  assert.deepEqual(results(replayedAnalysis), []);
  for (const seat of [undefined, 0, 1, 2]) {
    const publicState = E.stripSecret(s, seat);
    assert.equal(publicState._setup, undefined);
    assert.equal(publicState._history, undefined);
    assert.deepEqual(results(publicState), []);
  }
});
