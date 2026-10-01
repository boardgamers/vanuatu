import test from "node:test";
import assert from "node:assert/strict";
import { init } from "../engine/index.js";
import {
  playerColorState,
  playerColorInk,
  playerColorText,
} from "../viewer/player-colors.js";

test("viewer colours preserve engine state and accessibility defaults", () => {
  const original = init(3, [], {}, "colour-test");
  const saved = structuredClone(original);
  const view = playerColorState(original, ["#12abcd", "url(x)"]);
  assert.equal(view.players[0].color, "#12abcd");
  assert.equal(view.players[1].color, original.players[1].color);
  assert.deepEqual(original, saved);
  assert.deepEqual(playerColorState(original, ["#12abcd"], true), original);
  assert.deepEqual(playerColorState(original, []), original);
});

test("white and black custom colours keep readable labels", () => {
  assert.equal(playerColorText("#ffffff"), "#000");
  assert.equal(playerColorText("#000000"), "#fff");
  assert.notEqual(playerColorInk("#ffffff"), "#ffffff");
  assert.equal(playerColorInk("#000000"), "#000000");
});
