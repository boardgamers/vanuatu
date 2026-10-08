import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
import { actionObstacles, cellObstacles } from "../engine/action-obstacles.js";

// Every state of a few bot games, from each player's point of view.
function* positions(count, options = {}) {
  for (const seed of ["obstacles-a", "obstacles-b"]) {
    let s = E.init(count, [], options, seed);
    for (let i = 0; i < 400 && !s.finished; i++) {
      if (s.phase === "actions") yield s;
      const p = s.actor;
      s = E.moveAI(s, p);
    }
  }
}
const targets = (s, p, action) =>
  new Set(E.actionOptions(s, p, action).map((m) => m.cell ?? m.path?.at(-1)));

test("an action is explained exactly when it has no legal option", () => {
  for (const count of [2, 3, 5])
    for (const s of positions(count))
      for (let p = 0; p < count; p++)
        for (const action of E.ACTIONS) {
          const options = E.actionOptions(s, p, action).length;
          const obstacles = actionObstacles(
            { ...s, restAvailable: s._restAvailable },
            p,
            action,
          );
          assert.equal(
            obstacles.length > 0,
            options === 0,
            `${action} for ${p}: ${JSON.stringify(obstacles)}`,
          );
        }
});

test("rising waters still explains every unavailable build", () => {
  for (const s of positions(3, { risingWaters: true }))
    for (let p = 0; p < 3; p++)
      if (!E.actionOptions(s, p, "build").length)
        assert.ok(actionObstacles(s, p, "build").length);
});

test("a map space is explained exactly when it cannot be chosen", () => {
  for (const count of [2, 4])
    for (const s of positions(count))
      for (let p = 0; p < count; p++)
        for (const action of ["sail", "build", "buy", "draw", "tourist"]) {
          const legal = targets(s, p, action);
          for (const cell of Object.keys(s.board)) {
            const reasons = cellObstacles(s, p, action, cell);
            if (action === "sail" && cell === s.players[p].boat) continue;
            assert.equal(
              reasons.length === 0,
              legal.has(cell),
              `${action} ${cell} for ${p}: ${JSON.stringify(reasons)}`,
            );
          }
        }
});

test("missing vatus are reported with the amounts involved", () => {
  const s = [...positions(3)][0];
  const p = s.actor,
    a = s.players[p];
  a.character = null;
  a.money = 2;
  const island = Object.keys(s.board).find(
    (c) =>
      s.board[c].type === "island" &&
      E.neighbors(c, s).some((n) => s.board[n]?.type === "sea"),
  );
  a.boat = E.neighbors(island, s).find((n) => s.board[n]?.type === "sea");
  s.board[island].huts = [];
  assert.deepEqual(cellObstacles(s, p, "build", island), [
    { reason: "noMoney", have: 2, need: 3 },
  ]);
  a.hutsLeft = 0;
  assert.equal(cellObstacles(s, p, "build", island)[0].reason, "noHutsLeft");
});
