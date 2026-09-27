import test from "node:test";
import assert from "node:assert/strict";
import { createTutorial } from "@boardgamers/protocol/tutorial";
import { chapters } from "../viewer/tutorials.js";
import { availableMoves, majority, move } from "../engine/index.js";

test("planning opponents spread their markers and release a blocked fishing action", () => {
  const chapter = chapters.planning;
  for (const choice of availableMoves(chapter.initialState(), 0)) {
    let state = chapter.move(chapter.initialState(), choice);
    for (const actions of [["sail", "fish"], ["draw", "rest"], ["tourist"]])
      state = chapter.move(state, { type: "plan", actions });
    assert.equal(state.phase, "actions");
    for (const opponent of state.players.slice(1)) {
      const stacks = Object.values(opponent.markers).filter(Boolean);
      assert.equal(
        stacks.reduce((a, b) => a + b, 0),
        5,
      );
      assert.ok(
        stacks.length >= 3,
        `${choice.character}: ${opponent.name} spreads markers`,
      );
      assert.equal(Math.max(...stacks), 2);
    }
    assert.equal(state.players[1].markers.fish, 2);
    assert.equal(majority(state, 0, "fish"), false);
    state = chapter.move(
      state,
      availableMoves(state, 0).find(
        (m) =>
          m.action === "sail" && m.path.length === 1 && m.path[0] === "1,0",
      ),
    );
    assert.equal(state.players[1].markers.fish, 0);
    assert.equal(majority(state, 0, "fish"), true);
    const fish = availableMoves(state, 0).find((m) => m.action === "fish");
    assert.ok(fish, `${choice.character}: the player can fish after Maya`);
    state = chapter.move(state, fish);
    assert.deepEqual(state.players[0].fish, [1]);
    let turns = 0;
    while (state.round === 1 && turns++ < 15) {
      const legal = availableMoves(state, 0);
      const next =
        legal.find((m) => m.type === "act") ??
        legal.find((m) => m.type === "rest" || m.type === "discard");
      assert.ok(next, `${choice.character}: the round can continue`);
      state = chapter.move(state, next);
    }
    assert.equal(state.round, 2, `${choice.character}: the round finishes`);
  }
});

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
    while (lesson.snapshot.canContinue) await lesson.continue();
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

test("water lesson demonstrates combined construction, the countdown and an island sinking", async () => {
  const lesson = await createTutorial(chapters["rising-waters"]);
  const seen = new Set();
  while (!lesson.snapshot.completed) {
    const { state, step, canContinue } = lesson.snapshot;
    const current = chapters["rising-waters"].steps[step];
    seen.add(current.id);
    if (current.id === "coasts") {
      assert.equal(state.players[0].money, 0);
      assert.deepEqual(state.board["0,0"].dikes, ["0,1", "1,0"]);
      assert.deepEqual(state.board["0,0"].huts, [0]);
      assert.equal(state.waterCountdown, 2);
    }
    if (current.id === "tourist") assert.equal(state.waterCountdown, 1);
    if (current.id === "flood") {
      assert.equal(state.waterTriggered, true);
      assert.equal(state.board["0,0"].water, 4);
      assert.equal(state.board["0,0"].submerged, false);
      assert.equal(state.board["2,1"].submerged, true);
      assert.deepEqual(state.board["2,1"].huts, []);
      assert.deepEqual(state.board["2,1"].goods, {});
      assert.equal(state.board["2,1"].tourists, 0);
      assert.equal(state.board["2,1"].drawings, 0);
      assert.equal(state.round, 4);
    }
    if (canContinue) await lesson.continue();
    else
      await lesson.play(
        availableMoves(state, 0).find((m) => !current.validateMove?.(state, m)),
      );
  }
  assert.equal(seen.size, chapters["rising-waters"].steps.length);
  lesson.destroy();
});

test("the export lesson explains both the ordinary reward and ship completion bonus", async () => {
  for (const good of ["copra", "beef"]) {
    const lesson = await createTutorial(chapters.trade);
    let count = 0;
    while (!lesson.snapshot.completed && count++ < 12) {
      const { state, step, canContinue } = lesson.snapshot;
      if (canContinue) {
        await lesson.continue();
        continue;
      }
      const current = chapters.trade.steps[step];
      const selected = availableMoves(state, 0).find(
        (m) =>
          !current.validateMove?.(state, m) &&
          (m.action !== "buy" || m.good === good),
      );
      assert.ok(selected, `${good}/${current.id}`);
      assert.equal(await lesson.play(selected), true);
    }
    assert.equal(lesson.snapshot.completed, true);
    const { state, text } = lesson.snapshot;
    assert.equal(state.players[0].score, good === "copra" ? 3 : 7);
    assert.equal(state.players[0].money, good === "copra" ? 1 : 0);
    assert.equal(state.demands[0].filled.every(Boolean), good === "beef");
    assert.equal(state.demands[1].filled.every(Boolean), false);
    assert.match(
      text,
      good === "copra" ? /no completion bonus/ : /7 prosperity/,
    );
    lesson.destroy();
  }
});
