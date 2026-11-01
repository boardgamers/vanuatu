import assert from "node:assert/strict";
import {
  seaRoute,
  routePosition,
  giveWay,
  passingSide,
  arrivalFraction,
  stepYield,
} from "../viewer/three/navigation.js";
import * as engine from "../engine/index.js";
const opening = engine.init(3, [], {}, "navigation");
const expanded = structuredClone(opening);
for (const cell of ["2,0", "2,1", "2,2", "1,2", "0,2", "-1,1", "-1,0"])
  expanded.board[cell] = engine.tileState("c1");
const scenes = { opening, expanded };
const tilt = Math.PI / 9;
function position(id) {
  const [q, r] = id.split(",").map(Number),
    x = q * 162 - r * 81,
    z = r * 140.3;
  return {
    x: (x * Math.cos(tilt) - z * Math.sin(tilt)) / 60,
    z: (x * Math.sin(tilt) + z * Math.cos(tilt)) / 60,
  };
}
let checks = 0;
for (const state of Object.values(scenes)) {
  const seas = Object.keys(state.board).filter(
    (id) => state.board[id].type === "sea",
  );
  for (const from of seas)
    for (const to of seas) {
      if (from === to) continue;
      for (let count = 1; count <= 3; count++) {
        const a = position(from),
          b = position(to),
          start = { x: a.x, z: a.z - 0.15 },
          end = { x: b.x + (count - 1) * 0.47, z: b.z - 0.15 };
        const path = seaRoute(state.board, from, to, start, end, position);
        assert.ok(
          path.length >= 2,
          "Every sea destination has an animation even when crowded",
        );
        assert.deepEqual(routePosition(path, 0), start);
        assert.deepEqual(routePosition(path, 1), end);
        for (let i = 0; i <= 100; i++) {
          const p = routePosition(path, i / 100);
          assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
        }
        checks++;
      }
    }
}
const path = [
    { x: 0, z: 0 },
    { x: 5, z: 0 },
  ],
  near = { x: 2.5, z: 0.2 };
const boat = { minX: -0.28, maxX: 0.46, minZ: -0.52, maxZ: 0.3 };
const fish = { minX: -0.43, maxX: 0.43, minZ: -0.26, maxZ: 0.26 };
const side = passingSide(path, near, 0);
const offset = giveWay(
  near,
  { x: 2.5, z: 0 },
  { x: 1, z: 0 },
  side,
  boat,
  fish,
);
assert.ok(
  near.z + offset.z + fish.minZ > boat.maxZ,
  "An intersecting fish moves far enough aside",
);
assert.deepEqual(
  giveWay(near, { x: 5, z: 0 }, { x: 1, z: 0 }, side, boat, fish),
  { x: 0, z: 0 },
  "It returns after the boat passes",
);
for (const direction of [
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: 1, z: 1 },
  { x: -1, z: 1 },
]) {
  for (const sign of [-1, 1]) {
    for (const point of [
      { x: 0, z: -10 },
      { x: 0, z: 10 },
      { x: -10, z: 0 },
      { x: 10, z: 0 },
      { x: 2.7, z: 0 },
    ]) {
      assert.deepEqual(
        giveWay(point, { x: 0, z: 0 }, direction, sign, boat, fish),
        { x: 0, z: 0 },
        "Remote and neighbouring-tile resources stay still, even on the opposite side of the route",
      );
    }
  }
}
assert.equal(
  arrivalFraction(6),
  0,
  "No destination rearrangement at departure",
);
assert.equal(
  arrivalFraction(1.1),
  0,
  "Wait until the boat is actually approaching its berth",
);
assert.ok(
  arrivalFraction(0.6) > 0 && arrivalFraction(0.6) < 1,
  "Rearrange progressively on approach",
);
assert.equal(arrivalFraction(0), 1, "Berths settle completely on arrival");
console.log(
  `${checks} routes checked; local contact only, remote pieces stay still, destination waits for arrival.`,
);

const pose = { x: 0, z: 0, yaw: 0, vx: 0, vz: 0, vyaw: 0 };
let previous = 0;
for (let i = 0; i < 40; i++) {
  stepYield(pose, { x: 0.5, z: 0, yaw: 0.2 }, 1 / 60);
  assert.ok(
    pose.x >= previous && pose.x <= 0.5,
    "Yielding approaches its target without reversing or overshooting",
  );
  previous = pose.x;
}
assert.ok(pose.yaw > 0.19, "The piece pivots while giving way");
for (let i = 0; i < 60; i++) {
  stepYield(pose, { x: 0, z: 0, yaw: 0 }, 1 / 60);
  assert.ok(
    pose.x >= 0 && pose.x <= previous,
    "Returning home never overshoots or oscillates",
  );
  previous = pose.x;
}
assert.ok(
  Math.hypot(pose.x, pose.z, pose.yaw) < 0.0001,
  "Position and orientation settle completely",
);
console.log(
  "Yielding: gradual pivot, damped slide, no oscillation and complete restoration passed.",
);
