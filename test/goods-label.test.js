import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createGoodsLabel,
  GOODS_CUBE,
  GOODS_FOOTPRINT_Y,
} from "../viewer/three/goods-label.js";

function assertUpward(label) {
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(label.quaternion);
  assert.ok(normal.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-9);
}

test("colour-blind letters fit entirely above the cube's top face", () => {
  const texture = new THREE.Texture();
  const label = createGoodsLabel(texture, true);
  assert.equal(label.isMesh, true);
  assertUpward(label);
  const bounds = new THREE.Box3().setFromObject(label);
  assert.ok(bounds.min.y > GOODS_CUBE.height / 2);
  assert.ok(bounds.max.y < GOODS_CUBE.height / 2 + 0.005);
  assert.ok(bounds.min.x > -GOODS_CUBE.width / 2);
  assert.ok(bounds.max.x < GOODS_CUBE.width / 2);
  assert.ok(bounds.min.z > -GOODS_CUBE.depth / 2);
  assert.ok(bounds.max.z < GOODS_CUBE.depth / 2);
  assert.equal(label.material.map, texture);
  assert.equal(label.material.depthTest, true);
  assert.equal(label.material.depthWrite, false);
  assert.equal(label.castShadow, false);
  assert.equal(label.receiveShadow, false);
});

test("the cube cannot clip any part of its letter at supported camera tilts", () => {
  const slot = new THREE.Group();
  slot.rotation.y = 0.12;
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(
      GOODS_CUBE.width,
      GOODS_CUBE.height,
      GOODS_CUBE.depth,
    ),
    new THREE.MeshBasicMaterial(),
  );
  const label = createGoodsLabel(new THREE.Texture(), true);
  slot.add(cube, label);
  slot.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const tilt of [0.02, 0.6, 1, Math.PI * 0.41]) {
    for (const azimuth of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const camera = new THREE.Vector3().setFromSpherical(
        new THREE.Spherical(4, tilt, azimuth),
      );
      for (const x of [-0.085, 0, 0.085]) {
        for (const z of [-0.085, 0, 0.085]) {
          const point = new THREE.Vector3(x, label.position.y, z).applyMatrix4(
            slot.matrixWorld,
          );
          ray.set(camera, point.sub(camera).normalize());
          assert.equal(ray.intersectObjects([cube, label])[0]?.object, label);
        }
      }
    }
  }
});

test("empty resource slots keep their flat colour-blind labels", () => {
  const label = createGoodsLabel(new THREE.Texture(), false);
  assertUpward(label);
  assert.ok(Math.abs(label.position.y - (GOODS_FOOTPRINT_Y + 0.003)) < 1e-9);
  assert.equal(label.geometry.parameters.width, 0.16);
  assert.equal(label.geometry.parameters.height, 0.16);
  assert.equal(label.material.transparent, true);
  assert.equal(label.castShadow, false);
});
