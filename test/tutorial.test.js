import test from "node:test";
import assert from "node:assert/strict";
import { createTutorial } from "@boardgamers/protocol/tutorial";
import { chapters } from "../viewer/tutorials.js";
import { availableMoves, move } from "../engine/index.js";
for (const [id, chapter] of Object.entries(chapters))
  test(`tutorial ${id} is completable with real engine moves`, async () => {
    const lesson = await createTutorial(chapter);
    let count = 0;
    while (!lesson.snapshot.completed && count++ < 20) {
      const snap = lesson.snapshot;
      if (snap.canContinue) {
        await lesson.continue();
        continue;
      }
      const step = chapter.steps[snap.step];
      const moves = availableMoves(snap.state, 0).filter(
        (m) => !step.validateMove?.(snap.state, m),
      );
      assert.ok(moves.length, `${id}/${snap.step}`);
      assert.equal(await lesson.play(moves[0]), true);
    }
    assert.equal(lesson.snapshot.completed, true);
    lesson.destroy();
  });

test("the fishing lesson shows the sale's lower price before the next round resets it", async () => {
  const saved = new Map();
  const options = {
    ...chapters.fishing,
    storage: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
      removeItem: (key) => saved.delete(key),
    },
  };
  const lesson = await createTutorial(options);
  for (const action of ["sail", "fish", "sell"]) {
    const state = lesson.snapshot.state;
    const selected = availableMoves(state, 0).find(
      (m) =>
        m.action === action &&
        (action !== "sail" || (m.path.length === 1 && m.path[0] === "1,0")),
    );
    assert.equal(await lesson.play(selected), true);
    assert.equal(lesson.snapshot.state.market, action === "sell" ? 2 : 3);
    assert.equal(lesson.snapshot.state.round, 1);
  }
  assert.equal(lesson.snapshot.completed, true);
  assert.equal(lesson.snapshot.state.players[0].money, 8);
  let next = lesson.snapshot.state;
  next = move(
    next,
    availableMoves(next, 0).find((m) => m.action === "rest"),
    0,
  );
  next = move(
    next,
    availableMoves(next, 0).find((m) => m.type === "rest"),
    0,
  );
  assert.equal(next.round, 2);
  assert.equal(next.market, 3);
  lesson.destroy();
  const resumed = await createTutorial(options);
  assert.equal(resumed.snapshot.completed, true);
  assert.equal(resumed.snapshot.state.market, 2);
  assert.equal(resumed.snapshot.state.round, 1);
  resumed.destroy();
});
