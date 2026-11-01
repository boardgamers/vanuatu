import * as THREE from "three";

export const DRAW_DURATION = 1500;
const SEGMENTS = 160;
const SIDES = 5;

// Stable slots: adding a drawing never slides the ones already in the sand.
export function createSandDrawing(slot, capacity) {
  const group = new THREE.Group();
  group.position.set((slot - (capacity - 1) / 2) * 0.43, 0.271, 0.94);
  const points = Array.from({ length: 121 }, (_, i) => {
    const t = (i / 120) * Math.PI * 4;
    return new THREE.Vector3(Math.sin(t) * 0.17, 0, Math.sin(t * 1.5) * 0.105);
  });
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const groove = new THREE.Mesh(
    new THREE.TubeGeometry(curve, SEGMENTS, 0.01, SIDES, false),
    new THREE.MeshBasicMaterial({ color: "#906437" }),
  );
  const rim = new THREE.Mesh(
    new THREE.TubeGeometry(curve, SEGMENTS, 0.017, SIDES, false),
    new THREE.MeshBasicMaterial({ color: "#ffe8b4" }),
  );
  rim.position.y = -0.008;
  group.add(rim, groove);
  const tip = new THREE.Group();
  const grains = new THREE.MeshBasicMaterial({
    color: "#fff0c7",
    transparent: true,
    opacity: 0,
  });
  for (let i = 0; i < 3; i++) {
    const grain = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.018 - i * 0.003, 0),
      grains,
    );
    grain.position.set((i - 1) * 0.025, 0.027 + i * 0.009, -i * 0.016);
    tip.add(grain);
  }
  group.add(tip);
  tip.visible = false;
  const drawing = { group, groove, rim, tip, curve, grains };
  setDrawingProgress(drawing, 1);
  return drawing;
}

export function setDrawingProgress(drawing, progress) {
  const p = Math.max(0, Math.min(1, progress));
  // Leave time for the fresh sand at the tip to settle after the line closes.
  const trace = Math.min(1, p / 0.88);
  const count = Math.floor(trace * SEGMENTS) * SIDES * 6;
  for (const mesh of [drawing.groove, drawing.rim])
    mesh.geometry.setDrawRange(0, count);
  drawing.tip.visible = p > 0 && p < 1;
  if (drawing.tip.visible) {
    drawing.tip.position.copy(drawing.curve.getPointAt(trace));
    drawing.grains.opacity = Math.min(1, p / 0.08, (1 - p) / 0.12);
  }
}

// Call only with adjacent live events. Loading/replaying a state does not draw
// its old patterns again, and a third drawing is as visible as the first two.
export function newDrawingSlots(events, before, after) {
  const slots = [];
  for (const event of events) {
    if (event.type !== "action" || event.action !== "draw") continue;
    const cell = event.cell ?? event.details?.cell;
    const start = before?.board[cell]?.drawings;
    const end = after?.board[cell]?.drawings;
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    for (let slot = start; slot < end; slot++) slots.push({ cell, slot });
  }
  return slots;
}
