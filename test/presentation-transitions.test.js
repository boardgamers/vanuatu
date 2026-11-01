import test from "node:test";
import assert from "node:assert/strict";
import * as engine from "../engine/index.js";
import { tradeFrames } from "../viewer/trade-transition.js";
import { eventCells, journalRows } from "../viewer/journal.js";
import { goodsSlots } from "../viewer/goods-slots.js";

function lastExport() {
  const s = engine.init(3, [], {}, "smooth-transitions");
  s.phase = "actions";
  s.actor = s.first = 0;
  s.players.forEach((p) => {
    p.character = null;
    p.markers = Object.fromEntries(engine.ACTIONS.map((a) => [a, 0]));
  });
  s.players[0].markers.buy = 1;
  s.players[0].money = 3;
  s.players[0].boat = "1,0";
  s.board["0,0"].goods = { kava: 0, copra: 0, beef: 1 };
  s.demands[0] = {
    id: 101,
    goods: ["kava", "copra", "beef"],
    filled: [true, true, false],
  };
  return s;
}
function exportLast(s) {
  return engine.move(
    s,
    engine
      .availableMoves(s)
      .find(
        (m) =>
          m.type === "act" &&
          m.action === "buy" &&
          m.good === "beef" &&
          !m.bonus,
      ),
    0,
  );
}

test("last export keeps the completed ship available for presentation after the next round starts", () => {
  const before = lastExport(),
    unchanged = structuredClone(before),
    after = exportLast(before);
  assert.equal(after.round, 2);
  const events = after.events.slice(before.events.length),
    frames = tradeFrames(before, after, events);
  assert.deepEqual(frames.departing, [101]);
  assert.deepEqual(frames.initial[0].filled, [true, true, false]);
  assert.deepEqual(frames.delivered[0].filled, [true, true, true]);
  assert.ok(!after.demands.some((d) => d.id === 101));
  assert.deepEqual(
    before,
    unchanged,
    "presentation never mutates the engine state",
  );
  assert.equal(
    tradeFrames(before, after, []),
    null,
    "loading or replaying does not animate",
  );
});
test("a Buyer delivering twice fills distinct slots in order", () => {
  const before = {
      demands: [{ id: 1, goods: ["kava", "kava"], filled: [false, false] }],
    },
    after = structuredClone(before);
  const frame = tradeFrames(before, after, [
    {
      good: "kava",
      details: { shipments: [{ ship: 1 }, { ship: 1, complete: true }] },
    },
  ]);
  assert.deepEqual(frame.delivered[0].filled, [true, true]);
  assert.deepEqual(frame.completed, [1]);
});
test("only fully empty islands refill, and each refill is logged with exact goods", () => {
  const s = lastExport();
  s.board["2,1"] = engine.tileState("a1");
  s.board["2,1"].goods = { kava: 1, copra: 0, beef: 0 };
  const after = exportLast(s),
    round = after.events.findLast((e) => e.type === "round");
  assert.deepEqual(round.refills, [
    { cell: "0,0", goods: engine.TILES.efate.goods },
  ]);
  assert.deepEqual(after.board["2,1"].goods, s.board["2,1"].goods);
  const rows = journalRows(engine.stripSecret(after, 0)).filter(
    (r) => r.event?.type === "restock",
  );
  assert.deepEqual(
    rows.map((r) => [r.event.cell, r.event.goods]),
    [["0,0", engine.TILES.efate.goods]],
  );
});
test("older complete journals reconstruct refill locations without guessing from current stock", () => {
  const s = engine.init(3, [], {}, "legacy-refill");
  s.events = [
    { type: "start", round: 1, p: 0 },
    ...["kava", "copra", "beef"].map((good) => ({
      type: "action",
      action: "buy",
      cell: "0,0",
      p: 0,
      round: 1,
      good,
    })),
    { type: "round", round: 2, first: 0 },
  ];
  const before = structuredClone(s);
  const rows = journalRows(s).filter((r) => r.event?.type === "restock");
  assert.deepEqual(
    rows.map((r) => r.event.cell),
    ["0,0"],
  );
  assert.deepEqual(rows[0].event.goods, engine.TILES.efate.goods);
  assert.deepEqual(s, before);
  const incomplete = { ...s, events: s.events.slice(1) };
  assert.equal(
    journalRows(incomplete).filter((r) => r.event?.type === "restock").length,
    0,
  );
});
test("journal highlights the actual route and affected tile, never malformed coordinates", () => {
  assert.deepEqual(
    eventCells({ path: ["1,0", "2,0"], details: { from: "0,0", cell: "2,0" } }),
    ["0,0", "1,0", "2,0"],
  );
  assert.deepEqual(eventCells({ type: "restock", cell: "-1,0" }), ["-1,0"]);
  assert.deepEqual(eventCells({ cell: "<script>", details: { from: 1 } }), []);
  assert.deepEqual(eventCells({ type: "plan" }), []);
});
test("goods positions remain fixed as cubes are bought and replenished", () => {
  const t = engine.tileState("efate");
  assert.deepEqual(
    goodsSlots(t).map((s) => [s.good, s.filled]),
    [
      ["kava", true],
      ["copra", true],
      ["beef", true],
    ],
  );
  t.goods.copra = 0;
  assert.deepEqual(
    goodsSlots(t).map((s) => [s.good, s.filled]),
    [
      ["kava", true],
      ["copra", false],
      ["beef", true],
    ],
  );
  t.goods = { kava: 0, copra: 0, beef: 0 };
  assert.ok(goodsSlots(t).every((s) => !s.filled));
  t.submerged = true;
  assert.deepEqual(goodsSlots(t), []);
});
