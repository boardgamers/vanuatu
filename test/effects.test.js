import test from "node:test";
import assert from "node:assert/strict";
import { liveEvents, rewards, soundFor } from "../viewer/effects.js";

test("live feedback ignores initial load, duplicates, undo, catch-up and replaced histories", () => {
  const start = { type: "start", p: 0 };
  const event = { type: "action", action: "sail", p: 0 };
  const before = { historyLength: 1, events: [start] };
  const after = { historyLength: 2, events: [start, event] };
  assert.deepEqual(liveEvents(before, after), [event]);
  for (const [a, b] of [
    [null, after],
    [after, after],
    [after, before],
    [before, { ...after, historyLength: 4 }],
    [before, { ...after, events: [{ type: "start", p: 1 }, event] }],
  ])
    assert.deepEqual(liveEvents(a, b), []);
});

test("rewards show gross sale income separately from automatic conversion", () => {
  const sale = {
    type: "action",
    action: "sell",
    details: { income: 6, price: 3 },
  };
  assert.deepEqual(rewards(sale), [{ icon: "coin", value: 6 }]);
  assert.deepEqual(rewards({ type: "conversion", points: 5 }), []);
  assert.deepEqual(
    rewards({ type: "action", action: "buy", details: { cost: 3, points: 7 } }),
    [
      { icon: "coin", value: -3 },
      { icon: "point", value: 7 },
    ],
  );
  assert.deepEqual(rewards({ type: "beg", amount: 3 }), [
    { icon: "point", value: -3 },
    { icon: "coin", value: 3 },
  ]);
  assert.deepEqual(
    rewards({ type: "action", action: "fish", details: { fish: 2 } }),
    [{ icon: "fish", value: 2 }],
  );
  assert.deepEqual(rewards({ type: "action", action: "sell" }), []);
});

test("sound follows the actual action and distinguishes a completed ship", () => {
  assert.equal(
    soundFor([
      {
        type: "action",
        action: "buy",
        details: { shipments: [{ complete: true }] },
      },
    ]),
    "complete",
  );
  assert.equal(
    soundFor([
      {
        type: "action",
        action: "buy",
        details: { shipments: [{ complete: false }] },
      },
    ]),
    "buy",
  );
  assert.equal(
    soundFor([{ type: "action", action: "sail" }, { type: "discard" }]),
    "sail",
  );
  assert.equal(soundFor([{ type: "round" }]), null);
});
