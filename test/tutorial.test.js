import test from "node:test";
import assert from "node:assert/strict";
import { createTutorial } from "@boardgamers/protocol/tutorial";
import { chapters } from "../viewer/tutorials.js";
import { availableMoves } from "../engine/index.js";
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
