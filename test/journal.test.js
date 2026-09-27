import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
import { journalRows } from "../viewer/journal.js";

function fixture(action, options = {}) {
  const s = E.init(3, ["rising-waters"], {}, "journal");
  s.phase = "actions";
  s.actor = s.first = 0;
  s.players.forEach((p) => {
    p.character = null;
    p.boat = "1,0";
    p.markers = Object.fromEntries(E.ACTIONS.map((a) => [a, 0]));
  });
  s.board["1,0"] = E.tileState("startWreck");
  s.players[0].markers[action] = 2;
  s.players[1].markers.rest = 1;
  Object.assign(s.players[0], options);
  return s;
}
function perform(s, action, fields = {}) {
  const move = E.availableMoves(s, 0).find(
    (m) =>
      m.type === "act" &&
      m.action === action &&
      Object.entries(fields).every(([k, v]) => m[k] === v),
  );
  assert.ok(move, `legal ${action}`);
  const next = E.move(s, move, 0);
  return [next, next.events.findLast((e) => e.type === "action")];
}
test("sale records the historical price and gross income before conversion", () => {
  const s = fixture("sell", { fish: [1, 2], money: 8 });
  s.board["0,0"].huts = [0];
  s.market = 3;
  const [next, e] = perform(s, "sell");
  // Pick the sale of both fish, not merely the first legal subset.
  const both = E.availableMoves(s, 0).find(
    (m) => m.action === "sell" && m.fish.length === 2,
  );
  const sold = E.move(s, both, 0);
  const event = sold.events.findLast((e) => e.type === "action");
  assert.deepEqual(event.details, { markers: 2, price: 3, income: 9 });
  assert.equal(sold.players[0].money, 7);
  assert.equal(sold.players[0].score, 5);
  assert.equal(sold.events.at(-1).type, "conversion");
  assert.equal(sold.market, 2);
  assert.equal(next.market, 2);
  assert.equal(e.details.price, 3);
});
test("exports record each shipment and its completion bonus, including Buyer", () => {
  const s = fixture("buy", { character: "buyer", money: 3 });
  s.demands = [
    { id: 1, goods: ["kava", "kava"], filled: [false, false] },
    { id: 2, goods: ["kava"], filled: [false] },
  ];
  const [next, e] = perform(s, "buy", { good: "kava", bonus: true });
  assert.equal(e.details.cost, 1);
  assert.equal(e.details.points, 4);
  assert.equal(next.players[0].score, 4);
  assert.deepEqual(e.details.shipments, [
    { ship: 1, complete: false },
    { ship: 1, complete: true },
  ]);
  assert.equal(e.details.character, "buyer");
  const [, ordinary] = perform(s, "buy", { good: "kava", bonus: false });
  assert.equal(ordinary.details.points, 1);
  assert.deepEqual(ordinary.details.shipments, [{ ship: 1, complete: false }]);
});
test("fishing, diving, drawing, tourism and construction keep their exact rewards and costs", () => {
  for (const [action, character, expected] of [
    ["fish", "fisherman", { fish: 1, points: 1 }],
    ["explore", "diver", { treasure: 2, income: 2 }],
    ["draw", "artist", { points: 5 }],
    ["tourist", "guide", { income: 2, points: 2 }],
    ["build", "builder", { cost: 1 }],
  ]) {
    const s = fixture(action, { character });
    if (action === "tourist") {
      s.tourists = 2;
      s.board["0,0"].huts = [0, 1];
      s.board["0,0"].drawings = 1;
    }
    const [, e] = perform(s, action, {
      bonus: true,
      ...(action === "build" ? { hut: true } : {}),
    });
    for (const [k, value] of Object.entries(expected))
      assert.equal(e.details[k], value, `${action}: ${k}`);
    assert.equal(e.details.character, character);
    assert.equal(e.details.markers, 2);
  }
  const [, dike] = perform(fixture("build"), "build", { hut: false });
  assert.equal(dike.details.cost, 1);
});
test("historical reconstruction matches recorded outcomes and marker totals over a full game", () => {
  let s = E.init(3, ["rising-waters"], {}, "journal-legacy");
  for (let i = 0; i < 700 && !s.finished; i++) s = E.moveAI(s, s.actor);
  assert.ok(s.finished);
  const publicState = E.stripSecret(s, 0);
  const old = structuredClone(publicState);
  old.events.forEach((e) => {
    delete e.details;
    delete e.totals;
    delete e.pass;
  });
  const legacy = journalRows(old)
    .filter((r) => r.kind === "event")
    .map((r) => r.event);
  for (const e of legacy) {
    const actual = publicState.events.find(
      (a) =>
        a.step === e.step &&
        a.type === e.type &&
        a.p === e.p &&
        a.action === e.action,
    );
    if (e.type === "action") {
      for (const [key, value] of Object.entries(e.details))
        assert.deepEqual(
          value,
          actual.details[key],
          `${e.action}, step ${e.step}, ${key}`,
        );
    }
    if (e.type === "plan") assert.deepEqual(e.totals, actual.totals);
  }
  assert.ok(legacy.some((e) => e.type === "plan" && e.pass === 3));
  assert.ok(
    journalRows(old).some((r) => r.kind === "phase" && r.phase === "actions"),
  );
});
test("partial replay history does not invent a past fish price, catch or character", () => {
  const s = fixture("fish", { character: "artist" });
  delete s.events;
  s.lastEvents = [
    { type: "action", p: 0, action: "sell", fish: [2], round: 3, step: 50 },
  ];
  const e = journalRows(s).find((r) => r.kind === "event").event;
  assert.deepEqual(e.details, {});
});
test("rest choice is folded into its action without exposing an opponent's secret token", () => {
  let s = fixture("rest");
  s = perform(s, "rest")[0];
  s = E.move(s, { type: "rest", token: "both" }, 0);
  const otherRows = journalRows(E.stripSecret(s, 1));
  assert.equal(otherRows.filter((r) => r.event?.type === "rest").length, 0);
  assert.equal(
    otherRows.find((r) => r.event?.action === "rest").event.restToken,
    "hidden",
  );
  assert.equal(
    journalRows(E.stripSecret(s, 0)).find((r) => r.event?.action === "rest")
      .event.restToken,
    "both",
  );
});
