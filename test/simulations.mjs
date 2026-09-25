import assert from "node:assert/strict";
import * as E from "../engine/index.js";
const counts = {};
let games = 0,
  turns = 0;
for (let seed = 0; seed < 10; seed++)
  for (const n of [2, 3, 4, 5])
    for (const water of [false, true]) {
      let s = E.init(n, water ? ["rising-waters"] : [], {}, `qa-${seed}`),
        k = 0;
      while (!s.finished && k++ < 600) {
        const legal = E.availableMoves(s);
        assert.ok(legal.length, `${seed}/${n}/${water}/${s.round}/${s.phase}`);
        // Alternate purposeful bots with varied legal choices to exercise uncommon characters/actions.
        if (seed % 3 === 0) {
          const moves = legal.filter(
            (m) => !["beg", "treasure"].includes(m.type),
          );
          const m = moves[(k * 73 + seed * 41) % moves.length];
          counts[m.action ?? m.type] = (counts[m.action ?? m.type] ?? 0) + 1;
          s = E.move(s, m, s.actor);
        } else s = E.moveAI(s, s.actor);
        assert.ok(
          s.players.every(
            (p) => p.money >= 0 && p.money < 10 && p.hutsLeft >= 0,
          ),
        );
        assert.ok(
          Object.values(s.board).every(
            (t) =>
              t.fish >= 0 &&
              t.treasure >= 0 &&
              Object.values(t.goods).every((x) => x >= 0),
          ),
        );
        assert.ok(s.round <= 8);
        turns++;
      }
      assert.ok(s.finished, `Unfinished ${seed}/${n}/${water}`);
      assert.equal(E.currentPlayer(s), undefined);
      const restored = E.replay(s);
      assert.deepEqual(E.scores(restored), E.scores(s));
      assert.deepEqual(restored.board, s.board);
      games++;
      if (games % 8 === 0) console.log(`${games} full games passed`);
    }
console.log(JSON.stringify({ games, turns, coverage: counts }));
