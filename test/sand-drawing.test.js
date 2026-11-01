import test from "node:test";
import assert from "node:assert/strict";
import * as engine from "../engine/index.js";
import {
  createSandDrawing,
  setDrawingProgress,
  newDrawingSlots,
} from "../viewer/three/sand-drawing.js";
test("sand groove draws progressively, then the tip settles", () => {
  const drawing = createSandDrawing(0, 1),
    full = drawing.groove.geometry.index.count;
  assert.equal(drawing.groove.geometry.drawRange.count, full);
  // The sand extrusion includes a .035 top bevel above its .225 surface.
  assert.ok(
    drawing.group.position.y - 0.01 > 0.26,
    "groove stays above the beach bevel",
  );
  for (const progress of [0, 0.2, 0.5, 0.88, 1]) {
    setDrawingProgress(drawing, progress);
    assert.ok(drawing.groove.geometry.drawRange.count <= full);
    assert.equal(
      drawing.rim.geometry.drawRange.count,
      drawing.groove.geometry.drawRange.count,
    );
    assert.equal(drawing.tip.visible, progress > 0 && progress < 1);
    if (progress === 0)
      assert.equal(drawing.groove.geometry.drawRange.count, 0);
    else if (progress < 0.88)
      assert.ok(
        drawing.groove.geometry.drawRange.count > 0 &&
          drawing.groove.geometry.drawRange.count < full,
      );
    else assert.equal(drawing.groove.geometry.drawRange.count, full);
  }
});
test("all three drawings have stable separate places on the beach", () => {
  const drawings = Array.from({ length: 3 }, (_, i) => createSandDrawing(i, 3));
  assert.deepEqual(
    drawings.map((d) => d.group.position.x),
    [-0.43, 0, 0.43],
  );
  for (let i = 0; i < 2; i++)
    assert.ok(
      drawings[i + 1].group.position.x - drawings[i].group.position.x >
        0.34 + 0.034,
    );
});
test("a real draw move animates only its newly added drawing, never a reload", () => {
  let before = engine.init(3, [], {}, "drawing-check"),
    move;
  for (let i = 0; i < 100 && !move; i++) {
    move = engine
      .availableMoves(before)
      .find((m) => m.type === "act" && m.action === "draw");
    if (!move) before = engine.moveAI(before, before.actor);
  }
  assert.ok(move, "fixture reaches a legal draw");
  const after = engine.move(before, move, before.actor);
  const events = after.events.slice(before.events.length);
  assert.deepEqual(newDrawingSlots(events, before, after), [
    { cell: move.cell, slot: before.board[move.cell].drawings },
  ]);
  assert.deepEqual(newDrawingSlots([], before, after), []);
  assert.deepEqual(newDrawingSlots(events, after, after), []);
  assert.deepEqual(newDrawingSlots(events, null, after), []);
  assert.deepEqual(
    newDrawingSlots(
      [{ type: "action", action: "draw", cell: "x" }],
      { board: { x: { drawings: 2 } } },
      { board: { x: { drawings: 3 } } },
    ),
    [{ cell: "x", slot: 2 }],
  );
});
