import * as THREE from "three";

export const GOODS_CUBE = { width: 0.23, height: 0.24, depth: 0.23 };
export const GOODS_FOOTPRINT_Y = -0.097;

export function createGoodsLabel(texture, filled) {
  const size = filled ? 0.18 : 0.16;
  const letter = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  // Print on the top face, rather than billboarding through the cube as the
  // camera tilts. The small lift avoids z-fighting with the face/empty slot.
  letter.position.y =
    (filled ? GOODS_CUBE.height / 2 : GOODS_FOOTPRINT_Y) + 0.003;
  letter.rotation.x = -Math.PI / 2;
  return letter;
}
