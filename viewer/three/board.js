import * as THREE from "three";
import { translateText } from "../localization/index.js";
import { goodsSlots } from "../goods-slots.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TILES } from "../../engine/catalog.js";
import { icon, token as renderToken, esc } from "../art.js";
import {
  seaRoute,
  routePosition,
  passingSide,
  giveWay,
  arrivalFraction,
  stepYield,
} from "./navigation.js";
import { createSailingSound } from "./sailing-sound.js";
import { liveEvents } from "../effects.js";
import {
  createSandDrawing,
  setDrawingProgress,
  newDrawingSlots,
  DRAW_DURATION,
} from "./sand-drawing.js";
import "./style.css";

// Presentation only: selection is handed back to the regular viewer. The engine
// is the sole authority for legal actions, resources, turn order and bot moves.
export function mountBoard3D(target, { onSelect } = {}) {
  const events = new AbortController();
  const listen = (node, type, callback, options = {}) =>
    node.addEventListener(type, callback, {
      ...options,
      signal: events.signal,
    });
  target.innerHTML = '<div class="world"></div><div class="labels"></div>';
  target.setAttribute("translate", "no");
  const host = target.querySelector(".world"),
    labelHost = target.querySelector(".labels");
  let words = {},
    presentation = {},
    state,
    visible = true,
    selected = null,
    pending = 0;
  let tiles = [],
    labels = [],
    selection,
    center = new THREE.Vector3(),
    bounds;
  let boats = [],
    solids = [],
    protectedPieces = [],
    motion = null,
    ghostTiles = [],
    highlights;
  let drawings = [],
    drawingMotion = null,
    cameraMotion = null,
    tileMotion = null,
    cameraFramed = false;
  let viewportWidth = 0,
    viewportHeight = 0;
  let cameraReady = Promise.resolve(),
    resolveCamera,
    tileReady = Promise.resolve(),
    resolveTiles;
  let tileGroups = new Map();
  let contentKey, layoutKey, selectionKey, styleKey, ready, resolveReady;
  const sailingSound = createSailingSound();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const token = (kind, n, label) =>
    renderToken(kind, n, label, presentation.colorBlind);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch {
    target.innerHTML = `<p class="fallback">${"3D unavailable — use 2D."}</p>`;
    throw Error("WebGL unavailable");
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  host.append(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("aria-label", "Vanuatu · 3D");
  renderer.domElement.setAttribute("role", "img");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#9fcace");
  scene.fog = new THREE.Fog("#9fcace", 44, 90);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 150);
  const gestureSurface = target;
  const controls = new OrbitControls(camera, gestureSurface);
  controls.enableDamping = false;
  controls.screenSpacePanning = false;
  controls.minDistance = 4;
  controls.maxDistance = 65;
  controls.minPolarAngle = 0.02;
  controls.maxPolarAngle = Math.PI * 0.41;
  controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
  controls.enableRotate = false;
  controls.mouseButtons.RIGHT = null;
  controls.touches.ONE = THREE.TOUCH.PAN;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  controls.panSpeed = 0.8;
  scene.add(new THREE.HemisphereLight("#fff7df", "#4d9290", 1.6));
  const sun = new THREE.DirectionalLight("#fff0ce", 2.2);
  sun.position.set(-10, 17, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -19,
    right: 19,
    top: 19,
    bottom: -19,
    near: 0.5,
    far: 55,
  });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00015;
  scene.add(sun);
  let board = new THREE.Group();
  scene.add(board);
  const palette = new Map(),
    goodsLabels = new Map();
  function material(color, roughness = 0.8) {
    const key = `${color}:${roughness}`;
    if (!palette.has(key))
      palette.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness,
          flatShading: true,
          side: THREE.DoubleSide,
        }),
      );
    return palette.get(key);
  }
  function mesh(g, geometry, color, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(
      geometry,
      typeof color === "string" ? material(color) : color,
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }
  const ocean = mesh(
    scene,
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshBasicMaterial({ color: "#9fcace" }),
    0,
    -0.24,
    0,
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.castShadow = false;
  ocean.receiveShadow = false;
  const oceanShadow = mesh(
    scene,
    new THREE.PlaneGeometry(180, 180),
    new THREE.ShadowMaterial({ opacity: 0.16 }),
    0,
    -0.235,
    0,
  );
  oceanShadow.rotation.x = -Math.PI / 2;
  oceanShadow.castShadow = false;
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
  function tileShape() {
    const h = 140.3 / 3;
    const v = [
      [81, -h],
      [81, h],
      [0, 2 * h],
      [-81, h],
      [-81, -h],
      [0, -2 * h],
    ].map(([x, z]) => [
      (x * Math.cos(tilt) - z * Math.sin(tilt)) / 60,
      -(x * Math.sin(tilt) + z * Math.cos(tilt)) / 60,
    ]);
    const shape = new THREE.Shape();
    shape.moveTo(...v[0]);
    for (let i = 0; i < 6; i++) {
      const [ax, ay] = v[i],
        [bx, by] = v[(i + 1) % 6],
        dx = bx - ax,
        dy = by - ay;
      shape.bezierCurveTo(
        ax + dx / 3 + dy * 0.28,
        ay + dy / 3 - dx * 0.28,
        ax + (2 * dx) / 3 - dy * 0.28,
        ay + (2 * dy) / 3 + dx * 0.28,
        bx,
        by,
      );
    }
    shape.closePath();
    return shape;
  }
  const shape = tileShape();
  function extrude(g, shape, height, color, x = 0, y = 0, z = 0, bevel = 0.01) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 1,
      curveSegments: 8,
    });
    geometry.rotateX(-Math.PI / 2);
    return mesh(g, geometry, color, x, y, z);
  }
  function line(g, points, color, opacity = 1, loop = false) {
    const geo = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(...p)),
    );
    const m = new THREE.LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
    });
    const obj = loop ? new THREE.LineLoop(geo, m) : new THREE.Line(geo, m);
    g.add(obj);
    return obj;
  }
  function blob(radius, seed) {
    const s = new THREE.Shape(),
      v = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2,
        r = radius * (1 + Math.sin(i * 2.7 + seed) * 0.12);
      v.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r * 0.84));
    }
    const curve = new THREE.SplineCurve([...v, v[0], v[1]]);
    const p = curve.getPoints(70).slice(0, 65);
    s.moveTo(p[0].x, p[0].y);
    for (const v of p.slice(1)) s.lineTo(v.x, v.y);
    s.closePath();
    return s;
  }
  function box(g, color, w, h, d, x = 0, y = h / 2, z = 0) {
    return mesh(g, new THREE.BoxGeometry(w, h, d), color, x, y, z);
  }
  function beam(g, color, radius, a, b) {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b),
      center = from.clone().add(to).multiplyScalar(0.5);
    const part = mesh(
      g,
      new THREE.CylinderGeometry(radius, radius * 1.2, from.distanceTo(to), 6),
      color,
      ...center.toArray(),
    );
    part.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      to.sub(from).normalize(),
    );
    return part;
  }
  function palm(g, x, z, seed) {
    const p = new THREE.Group();
    g.add(p);
    p.position.set(x, 0.23, z);
    p.rotation.y = seed;
    beam(p, "#9e7950", 0.036, [0, 0, 0], [0.1, 0.67, -0.07]);
    beam(p, "#b09260", 0.028, [0.1, 0.67, -0.07], [0.18, 0.99, -0.1]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2,
        dx = Math.cos(a),
        dz = Math.sin(a),
        w = 0.12;
      const verts = [
        0.18,
        0.99,
        -0.1,
        0.18 + dx * 0.3 - dz * w,
        1.1,
        -0.1 + dz * 0.3 + dx * w,
        0.18 + dx * 0.68,
        0.87,
        -0.1 + dz * 0.68,
        0.18 + dx * 0.3 + dz * w,
        1.06,
        -0.1 + dz * 0.3 - dx * w,
      ];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      geo.computeVertexNormals();
      mesh(p, geo, i % 2 ? "#5d914d" : "#80a752");
    }
    mesh(
      p,
      new THREE.IcosahedronGeometry(0.065, 0),
      "#8e633e",
      0.18,
      0.96,
      -0.1,
    );
  }
  function hut(g, color, x, z) {
    const h = new THREE.Group();
    g.add(h);
    h.position.set(x, 0.23, z);
    box(h, "#d5bf86", 0.48, 0.06, 0.44, 0, 0.03);
    box(h, color, 0.37, 0.36, 0.34, 0, 0.22);
    box(h, "#fff0c5", 0.105, 0.22, 0.013, 0.025, 0.15, 0.177);
    box(h, "#4e6055", 0.085, 0.15, 0.012, -0.1, 0.29, 0.18);
    const roof = new THREE.Shape();
    roof.moveTo(-0.26, 0);
    roof.lineTo(0, 0.25);
    roof.lineTo(0.26, 0);
    roof.closePath();
    const geo = new THREE.ExtrudeGeometry(roof, {
      depth: 0.48,
      bevelEnabled: false,
    });
    geo.translate(0, 0, -0.24);
    mesh(h, geo, "#ab7e42", 0, 0.4, 0);
    for (const dx of [-0.17, -0.08, 0.08, 0.17])
      line(
        h,
        [
          [dx, 0.65 - Math.abs(dx) * 0.95, -0.245],
          [dx, 0.65 - Math.abs(dx) * 0.95, 0.245],
        ],
        "#d8b06a",
      );
  }
  function emptyHut(g, x, z) {
    // Above both the sand bevel and the grass, so vacant sites remain visible.
    const site = new THREE.Group();
    site.position.set(x, 0.33, z);
    g.add(site);
    box(site, "#dfcb97", 0.4, 0.018, 0.38, 0, 0, 0);
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.2, 0.012, -0.19),
        new THREE.Vector3(0.2, 0.012, -0.19),
        new THREE.Vector3(0.2, 0.012, 0.19),
        new THREE.Vector3(-0.2, 0.012, 0.19),
      ]),
      new THREE.LineDashedMaterial({
        color: "#836a47",
        dashSize: 0.05,
        gapSize: 0.035,
      }),
    );
    outline.computeLineDistances();
    site.add(outline);
    for (const dx of [-0.17, 0.17])
      for (const dz of [-0.16, 0.16])
        box(site, "#9e8353", 0.035, 0.045, 0.035, dx, 0.025, dz);
    protectedPieces.push(site);
  }
  function island(g, t, index, id) {
    const spec = TILES[t.id];
    const lagoon = extrude(
      g,
      blob(1.22, index + 1),
      0.015,
      "#81d9c5",
      0,
      0.035,
      0,
      0,
    );
    lagoon.castShadow = false;
    const sand = new THREE.Shape();
    blob(1.04, index)
      .getPoints(80)
      .forEach((p, i) => {
        // A slightly wider beach lip keeps the drawings in front of the goods.
        const y = p.y < 0 ? p.y * 1.4 : p.y;
        if (i) sand.lineTo(p.x, y);
        else sand.moveTo(p.x, y);
      });
    sand.closePath();
    extrude(
      g,
      sand,
      0.17,
      [material("#f2de9f"), material("#cfb77e")],
      0,
      0.055,
      0,
      0.035,
    );

    const coast = sand.getPoints(70).map((p) => [p.x, 0.06, -p.y]);
    line(g, coast, "#d7f3d9", 0.85, true);
    extrude(g, blob(0.73, index + 4), 0.065, "#99b76c", 0, 0.23, -0.24, 0.02);
    for (let i = 0; i < 4; i++) {
      const a = i * 2.3 + index,
        px = Math.cos(a) * 0.42,
        pz = -0.42 + Math.sin(a) * 0.14;
      const rock = mesh(
        g,
        new THREE.IcosahedronGeometry(0.24, 0),
        ["#9ab470", "#7fa363", "#adbd7b"][i % 3],
        px,
        0.32,
        pz,
      );
      rock.scale.set(1, 0.58, 1);
    }
    palm(g, -0.58, -0.31, index * 0.6);
    palm(g, 0.43, -0.4, index * 0.6 + 1.3);
    for (let i = 0; i < spec.huts; i++) {
      const x = (i - (spec.huts - 1) / 2) * 0.49;
      if (t.huts[i] !== undefined)
        hut(g, state.players[t.huts[i]].color, x, 0.19);
      else emptyHut(g, x, 0.19);
    }
    const goodsGroup = new THREE.Group();
    g.add(goodsGroup);
    const goods = goodsSlots(t);
    goods.forEach(({ good, filled }, i) => {
      const x = (i - (goods.length - 1) / 2) * 0.3;
      const slot = new THREE.Group();
      slot.position.set(x, 0.37, 0.66);
      slot.rotation.y = 0.12;
      goodsGroup.add(slot);
      const color = { kava: "#9aca49", copra: "#fff7dc", beef: "#e77557" }[
        good
      ];
      if (filled) box(slot, color, 0.23, 0.24, 0.23, 0, 0, 0);
      else {
        // A solid, flat colour patch marks the missing cube's footprint.
        const footprint = mesh(
          slot,
          new THREE.PlaneGeometry(0.26, 0.26),
          new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
          0,
          -0.097,
          0,
        );
        footprint.rotation.x = -Math.PI / 2;
        footprint.castShadow = false;
        footprint.receiveShadow = false;
      }
      if (presentation.colorBlind) {
        if (!goodsLabels.has(good)) {
          const canvas = document.createElement("canvas");
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext("2d");
          ctx.font = "bold 50px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#29423d";
          ctx.fillText({ kava: "K", copra: "C", beef: "B" }[good], 32, 34);
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          goodsLabels.set(
            good,
            new THREE.SpriteMaterial({ map: texture, depthTest: true }),
          );
        }
        if (filled) {
          const letter = new THREE.Sprite(goodsLabels.get(good));
          letter.position.set(0, 0.02, 0.13);
          letter.scale.set(0.18, 0.18, 1);
          slot.add(letter);
        } else {
          const letter = mesh(
            slot,
            new THREE.PlaneGeometry(0.16, 0.16),
            new THREE.MeshBasicMaterial({
              map: goodsLabels.get(good).map,
              transparent: true,
              depthWrite: false,
            }),
            0,
            -0.094,
            0,
          );
          letter.rotation.x = -Math.PI / 2;
          letter.castShadow = false;
          letter.receiveShadow = false;
        }
      }
    });
    for (let slot = 0; slot < t.drawings; slot++) {
      const drawing = createSandDrawing(slot, spec.drawings);
      drawing.cell = id;
      drawing.slot = slot;
      g.add(drawing.group);
      drawings.push(drawing);
      protectedPieces.push(drawing.group);
    }
    if (goods.length) protectedPieces.push(goodsGroup);
    return goods.length ? goodsGroup : null;
  }
  function boat(g, color, x, z, index) {
    const b = new THREE.Group();
    g.add(b);
    b.position.set(x, 0.08, z);
    b.scale.setScalar(0.85);
    const hull = new THREE.Shape();
    hull.moveTo(-0.19, -0.34);
    hull.lineTo(-0.22, 0.25);
    hull.lineTo(0, 0.59);
    hull.lineTo(0.22, 0.25);
    hull.lineTo(0.19, -0.34);
    hull.closePath();
    extrude(
      b,
      hull,
      0.14,
      [material(color), material("#375b5b")],
      0,
      0.015,
      0,
      0.018,
    );
    line(
      b,
      hull.getPoints().map((p) => [p.x, 0.17, -p.y]),
      "#fff0c5",
      1,
      true,
    );
    box(b, "#d9bc7b", 0.26, 0.03, 0.38, 0, 0.17, 0.06);
    beam(b, "#5c6c5b", 0.018, [0, 0.17, 0.04], [0, 1.15, 0.04]);
    const sail = new THREE.Shape();
    sail.moveTo(0.025, 0.31);
    sail.lineTo(0.025, 1.1);
    sail.quadraticCurveTo(0.27, 1.03, 0.54, 0.38);
    sail.closePath();
    const geo = new THREE.ExtrudeGeometry(sail, {
      depth: 0.016,
      bevelEnabled: false,
      curveSegments: 8,
    });
    mesh(b, geo, color, 0, 0, 0.035);
    line(
      b,
      [
        [0.04, 0.33, 0.055],
        [0.51, 0.39, 0.055],
      ],
      "#fff4da",
    );
    const small = new THREE.Shape();
    small.moveTo(-0.04, 0.37);
    small.lineTo(-0.04, 0.94);
    small.lineTo(-0.33, 0.4);
    small.closePath();
    mesh(b, new THREE.ShapeGeometry(small), "#fff5d4", 0, 0, 0.035);
    for (const dx of [-1, 1])
      line(
        b,
        [
          [dx * 0.29, 0.015, 0.2],
          [dx * 0.39, 0.015, 0.42],
          [dx * 0.45, 0.015, 0.61],
        ],
        "#ddf7e8",
        0.5,
      );
    return b;
  }

  function fishPiece(group, x, z) {
    const fish = new THREE.Group();
    group.add(fish);
    fish.position.set(x, 0.065, z);
    const body = new THREE.Shape();
    body.moveTo(-0.41, 0);
    body.bezierCurveTo(-0.2, 0.29, 0.1, 0.28, 0.24, 0.11);
    body.lineTo(0.43, 0.25);
    body.lineTo(0.43, -0.25);
    body.lineTo(0.24, -0.11);
    body.bezierCurveTo(0.1, -0.28, -0.2, -0.29, -0.41, 0);
    body.closePath();
    extrude(
      fish,
      body,
      0.075,
      [material("#e58bad"), material("#a94d77")],
      0,
      0,
      0,
      0.016,
    );
    const eye = mesh(
      fish,
      new THREE.SphereGeometry(0.025, 8, 6),
      "#5b3452",
      -0.22,
      0.095,
      -0.055,
    );
    eye.scale.y = 0.45;
    line(
      fish,
      [
        [0.02, 0.096, -0.09],
        [0.09, 0.096, 0],
        [0.02, 0.096, 0.09],
      ],
      "#b46589",
    );
    return fish;
  }
  function treasurePiece(group, x, z) {
    const chest = new THREE.Group();
    group.add(chest);
    chest.position.set(x, 0.055, z);
    chest.rotation.y = 0.12;
    box(chest, "#a96835", 0.5, 0.24, 0.36, 0, 0.12);
    const lid = new THREE.Shape();
    lid.moveTo(-0.25, 0);
    lid.bezierCurveTo(-0.25, 0.21, 0.25, 0.21, 0.25, 0);
    lid.closePath();
    const geometry = new THREE.ExtrudeGeometry(lid, {
      depth: 0.36,
      bevelEnabled: false,
      curveSegments: 8,
    });
    geometry.translate(0, 0, -0.18);
    mesh(chest, geometry, "#c68c48", 0, 0.24, 0);
    box(chest, "#e9c25f", 0.52, 0.025, 0.38, 0, 0.24);
    for (const x of [-0.18, 0.18]) {
      box(chest, "#dcb357", 0.035, 0.23, 0.012, x, 0.12, 0.187);
      box(chest, "#dcb357", 0.035, 0.23, 0.012, x, 0.12, -0.187);
      const arch = [];
      for (let i = 0; i <= 12; i++) {
        const z = -0.18 + i * 0.03;
        arch.push([x, 0.24 + 0.13 * Math.sin((i / 12) * Math.PI), z]);
      }
      line(chest, arch, "#f8d581");
    }
    box(chest, "#f5d675", 0.09, 0.1, 0.027, 0, 0.22, 0.203);
    box(chest, "#805121", 0.021, 0.038, 0.01, 0, 0.22, 0.222);
    return chest;
  }

  function addMapLabel(id, html, point, priority, help, model = false) {
    const leader = document.createElement("span");
    leader.className = "map-label-link";
    leader.hidden = true;
    leader.setAttribute("aria-hidden", "true");
    labelHost.append(leader);
    const el = document.createElement("button");
    el.className = "map-label" + (model ? " model-label" : "");
    el.innerHTML = html;
    el.setAttribute("aria-label", help);
    el.setAttribute("aria-pressed", "false");
    el.dataset.mapTile = id;
    el.title = help;
    el.onclick = (e) => {
      if (e.detail === 0) selectTile(id);
    };
    labelHost.append(el);
    const label = { el, leader, id, priority, point };
    labels.push(label);
    return label;
  }

  function resourceMarkup(t) {
    const spec = TILES[t.id];
    return t.type === "island"
      ? token("tourist", `${t.tourists}/${spec.tourists}`, words.tourist) +
          token("draw", `${t.drawings}/${spec.drawings}`, words.draw)
      : (t.fish > 0 ? token("fish", t.fish, words.fish) : "") +
          (t.treasure > 0 ? token("explore", t.treasure, words.treasure) : "");
  }
  function tileName(t, id) {
    return t.type === "island"
      ? t.id === "efate"
        ? "Éfaté"
        : `${words.island} ${id}`
      : t.fish
        ? words.sea
        : words.emptySea;
  }
  function disposeBoard() {
    finishCamera(false);
    settleAnimations();
    board.traverse((o) => {
      o.geometry?.dispose();
      if (o.isLine || o.material?.isMeshBasicMaterial) o.material.dispose();
    });
    scene.remove(board);
    board = new THREE.Group();
    scene.add(board);
    labelHost.replaceChildren();
    tiles = [];
    labels = [];
    boats = [];
    solids = [];
    protectedPieces = [];
    drawings = [];
    tileGroups.clear();
    ghostTiles = [];
    selectionKey = undefined;
  }
  function buildBoard() {
    disposeBoard();
    let i = 0;
    for (const [id, t] of Object.entries(state.board)) {
      const p = position(id),
        g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      board.add(g);
      tileGroups.set(id, g);
      const top = new THREE.Color().setHSL(
        0.5 + (i % 3) * 0.006,
        0.8,
        0.29 + (i % 4) * 0.012,
      );
      const tile = extrude(
        g,
        shape,
        0.14,
        [material("#" + top.getHexString(), 0.55), material("#29878a")],
        0,
        -0.11,
        0,
        0.008,
      );
      tile.scale.set(0.994, 1, 0.994);
      tile.userData.cell = id;
      tiles.push(tile);
      line(
        g,
        shape.getPoints(60).map((p) => [p.x * 0.994, 0.052, -p.y * 0.994]),
        "#a5eadb",
        0.72,
        true,
      );
      for (let j = 0; j < 5; j++) {
        const wave = [];
        for (let k = 0; k < 15; k++) {
          let x = -0.8 + k * 0.12;
          wave.push([
            x,
            0.056,
            -0.95 + j * 0.44 + Math.sin(k * 0.38 + j + i) * 0.065,
          ]);
        }
        line(g, wave, "#d5f4dc", 0.3);
      }
      const goods = t.type === "island" ? island(g, t, i, id) : null;
      const here = state.players
        .map((p, index) => ({ ...p, index }))
        .filter((p) => p.boat === id);
      here.forEach((player, j) => {
        const x = (j - (here.length - 1) / 2) * 0.94;
        const model = boat(
          board,
          player.color,
          p.x + x,
          p.z - 0.15,
          player.index,
        );
        boats[player.index] = { model, cell: id, slot: x };
        if (presentation.colorBlind) {
          const label = addMapLabel(
            id,
            esc(
              presentation.symbols?.[player.index] ??
                ["●", "◆", "▲", "■", "✦"][player.index],
            ),
            model.position.clone().add(new THREE.Vector3(0, 1.35, 0)),
            3,
            player.name,
            true,
          );
          label.boat = player.index;
        }
      });
      if (t.type === "island") {
        const label = addMapLabel(
          id,
          resourceMarkup(t),
          new THREE.Vector3(p.x, 0.2, p.z + 1.02),
          2,
          tileName(t, id),
        );
        label.piece = goods;
      } else {
        const resources = [
          ...(t.fish > 0 ? [["fish", t.fish]] : []),
          ...(t.treasure > 0 ? [["treasure", t.treasure]] : []),
        ];
        const resourceZ = 0.83;
        resources.forEach(([kind, value], j) => {
          const x = (j - (resources.length - 1) / 2) * 0.94;
          const piece =
            kind === "fish"
              ? fishPiece(g, x, resourceZ)
              : treasurePiece(g, x, resourceZ);
          solids.push({ object: piece, kind });
          protectedPieces.push(piece);
          const label = addMapLabel(
            id,
            `<b>${value}</b>`,
            new THREE.Vector3(p.x + x, 0.13, p.z + resourceZ + 0.37),
            1,
            `${words[kind]} : ${value}`,
            true,
          );
          label.piece = piece;
        });
      }
      i++;
    }
    const pts = shape.getPoints(80).map((p) => [p.x, 0.08, -p.y]);
    selection = line(board, pts, "#a76d2d", 1, true);
    selection.visible = false;
    board.updateMatrixWorld(true);
    for (const piece of protectedPieces)
      piece.userData.labelBox = new THREE.Box3().setFromObject(piece);
    bounds = new THREE.Box3().setFromObject(board);
    center = bounds.getCenter(new THREE.Vector3());
    center.y = 0.2;

    highlights = new THREE.Group();
    board.add(highlights);
    renderer.shadowMap.needsUpdate = true;
  }
  function selectTile(id) {
    if (id) onSelect?.(id);
  }
  function selectionUpdate() {
    const key = JSON.stringify([
      presentation.selected,
      presentation.targets,
      presentation.hoverTile,
      presentation.journalCells,
    ]);
    if (key === selectionKey) return;
    selectionKey = key;
    selected = presentation.selected;
    const targets = new Set(presentation.targets ?? []),
      journal = new Set(presentation.journalCells ?? []);
    highlights.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    highlights.clear();
    ghostTiles = [];
    for (const id of new Set([
      ...targets,
      ...journal,
      ...(selected ? [selected] : []),
    ])) {
      const p = position(id),
        g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      highlights.add(g);
      const color = journal.has(id)
        ? "#1255ad"
        : id === selected
          ? "#a76d2d"
          : "#fff5c5";
      const ring = line(
        g,
        shape.getPoints(60).map((v) => [v.x * 0.97, 0.078, -v.y * 0.97]),
        color,
        1,
        true,
      );
      if (!state.board[id] && id !== selected) {
        ring.material.dispose();
        ring.material = new THREE.LineDashedMaterial({
          color,
          dashSize: 0.1,
          gapSize: 0.065,
        });
        ring.computeLineDistances();
      }
      ring.material.depthTest = false;
      ring.renderOrder = 5;
      if (journal.has(id)) {
        const wash = mesh(
          g,
          new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({
            color: "#8ad9ff",
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
          0,
          0.08,
          0,
        );
        wash.rotation.x = -Math.PI / 2;
      }
      if (!state.board[id]) {
        const ghost = mesh(
          g,
          new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({
            color: "#eaf9d9",
            transparent: true,
            opacity: id === selected ? 0.62 : 0.23,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
          0,
          0.02,
          0,
        );
        ghost.rotation.x = -Math.PI / 2;
        ghost.castShadow = false;
        ghost.receiveShadow = false;
        ghost.userData.cell = id;
        ghostTiles.push(ghost);
      }
    }
    for (const label of labels) {
      label.el.setAttribute("aria-pressed", String(label.id === selected));
      label.el.classList.toggle("legal", targets.has(label.id));
      label.el.classList.toggle("journal-highlight", journal.has(label.id));
    }
    // Empty expansion slots also need keyboard-accessible targets.
    for (const label of labels.filter((l) => l.ghost)) {
      label.el.remove();
      label.leader.remove();
    }
    labels = labels.filter((l) => !l.ghost);
    for (const id of targets) {
      if (labels.some((label) => label.id === id)) continue;
      const spec =
        !state.board[id] && state.phase === "expand"
          ? TILES[presentation.hoverTile]
          : null;
      const preview = spec
        ? { ...spec, id: presentation.hoverTile, tourists: 0, drawings: 0 }
        : null;
      const html = preview
        ? resourceMarkup(preview)
        : state.board[id]
          ? icon("sail")
          : "";
      const resources =
        preview?.type === "sea"
          ? [
              preview.fish > 0 ? `${words.fish} : ${preview.fish}` : "",
              preview.treasure > 0
                ? `${words.treasure} : ${preview.treasure}`
                : "",
            ]
              .filter(Boolean)
              .join(", ")
          : preview
            ? `${words.tourist} : ${spec.tourists}, ${words.draw} : ${spec.drawings}`
            : "";
      const p = position(id),
        label = addMapLabel(
          id,
          html,
          new THREE.Vector3(p.x, 0.1, p.z),
          preview ? 4 : 0,
          `${words.choose} ${id}${resources ? " · " + resources : ""}`,
          !preview,
        );
      label.ghost = true;
      label.el.classList.add("legal");
      label.el.setAttribute("aria-pressed", String(id === selected));
      if (preview) {
        label.el.classList.add("placement-label");
        label.el.classList.toggle("empty-placement", !html);
        label.el.dataset.placementTile = presentation.hoverTile;
      }
    }
    invalidate();
  }
  function update(next, config = {}) {
    const previous = state;
    const expansionTargetsChanged =
      next.phase === "expand" &&
      JSON.stringify(presentation.targets) !== JSON.stringify(config.targets);
    presentation = { ...presentation, ...config };
    words = Object.fromEntries(
      Object.entries({
        island: "Island",
        sea: "Ocean",
        emptySea: "Ocean",
        fish: "Fish value",
        treasure: "Treasure value",
        tourist: "Tourists",
        draw: "Sand drawings",
        choose: "Choose",
      }).map(([key, value]) => [
        key,
        translateText(value, presentation.language),
      ]),
    );
    const newStyle = JSON.stringify([
      presentation.language,
      presentation.colorBlind,
      presentation.symbols,
      next.players.map((p) => p.color),
    ]);
    const newContent = JSON.stringify(next.board),
      newLayout = Object.keys(next.board).join("|");
    const moves =
      previous && config.live !== false ? liveEvents(previous, next) : [];
    const sailing = moves.find(
      (e) =>
        e.type === "action" &&
        e.action === "sail" &&
        previous.players[e.p].boat !== next.players[e.p].boat,
    );
    const boatChanged =
      previous &&
      previous.players.some((p, i) => p.boat !== next.players[i]?.boat);
    const rebuild =
      !state ||
      newContent !== contentKey ||
      newStyle !== styleKey ||
      (boatChanged && !sailing);
    const reframe = !state || newLayout !== layoutKey;
    const enteringExpansion =
      state?.phase !== "expand" && next.phase === "expand";
    // Never let decorative animation hold an authoritative state update hostage.
    // Local bots wait for it, but a catch-up/replay can safely settle immediately.
    if (
      (motion || drawingMotion) &&
      previous?.historyLength !== next.historyLength
    )
      settleAnimations();
    state = next;
    const viewport = resizeViewport();
    if (rebuild) buildBoard();
    contentKey = newContent;
    layoutKey = newLayout;
    styleKey = newStyle;
    selectionUpdate();
    if (
      reframe ||
      enteringExpansion ||
      expansionTargetsChanged ||
      viewport?.widthChanged
    )
      resetCamera({
        animate:
          !!previous && (config.live !== false || expansionTargetsChanged),
      });
    const placed = moves
      .filter((e) => e.type === "place")
      .map((e) => tileGroups.get(e.cell))
      .filter(Boolean);
    if (placed.length && canAnimate()) startTiles(placed);
    if (
      sailing &&
      !rebuild &&
      visible &&
      presentation.animations !== false &&
      !reducedMotion.matches &&
      !document.hidden
    )
      sailTo(sailing.p, next.players[sailing.p].boat, sailing.path);
    else if (sailing && !rebuild) {
      sailTo(sailing.p, next.players[sailing.p].boat, sailing.path);
      finishSailing();
    }
    if (
      visible &&
      presentation.animations !== false &&
      !reducedMotion.matches &&
      !document.hidden
    ) {
      const slots = newDrawingSlots(moves, previous, next);
      const fresh = drawings.filter((d) =>
        slots.some((s) => s.cell === d.cell && s.slot === d.slot),
      );
      if (fresh.length) startDrawing(fresh);
    }
    if (presentation.sound !== true) sailingSound.stop();
    if (presentation.animations === false) settleAnimations();
    invalidate();
  }
  function canAnimate() {
    return (
      visible &&
      presentation.animations !== false &&
      !reducedMotion.matches &&
      !document.hidden
    );
  }
  function finishCamera(complete = true) {
    if (!cameraMotion) return;
    if (complete) {
      camera.position.copy(cameraMotion.to);
      controls.target.copy(cameraMotion.target);
      controls.update();
    }
    cameraMotion = null;
    delete target.dataset.cameraTransition;
    resolveCamera?.();
    resolveCamera = null;
    invalidate();
  }
  function animateCamera(now) {
    if (!cameraMotion) return;
    const m = cameraMotion;
    m.start ??= now;
    const t = Math.min(1, (now - m.start) / 850),
      ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(m.from, m.to, ease);
    controls.target.lerpVectors(m.origin, m.target, ease);
    controls.update();
    if (t === 1) finishCamera();
  }
  function startTiles(groups) {
    finishTiles();
    tileMotion = { groups, start: null };
    tileReady = new Promise((resolve) => (resolveTiles = resolve));
    for (const g of groups) {
      g.position.y = -0.22;
      g.scale.setScalar(0.96);
    }
    target.dataset.tileTransition = "arrival";
    invalidate();
  }
  function finishTiles() {
    if (!tileMotion) return;
    for (const g of tileMotion.groups) {
      g.position.y = 0;
      g.scale.setScalar(1);
    }
    tileMotion = null;
    delete target.dataset.tileTransition;
    resolveTiles?.();
    resolveTiles = null;
    renderer.shadowMap.needsUpdate = true;
    invalidate();
  }
  function animateTiles(now) {
    if (!tileMotion) return;
    const m = tileMotion;
    m.start ??= now;
    const t = Math.min(1, (now - m.start) / 650),
      ease = 1 - Math.pow(1 - t, 3);
    for (const g of m.groups) {
      g.position.y = -0.22 * (1 - ease);
      g.scale.setScalar(0.96 + 0.04 * ease);
    }
    renderer.shadowMap.needsUpdate = true;
    if (t === 1) finishTiles();
  }
  function resetCamera({ animate = true } = {}) {
    const from = camera.position.clone(),
      origin = controls.target.clone();
    finishCamera(false);
    controls.target.copy(center);
    const narrow = host.clientWidth < 700;
    const direction = (
      narrow
        ? new THREE.Vector3(1.45, 1.8, -0.18)
        : new THREE.Vector3(0.12, 1.5, 1.4)
    ).normalize();
    const corners = [];
    for (const [id, t] of Object.entries({
      ...Object.fromEntries(
        (presentation.targets ?? []).map((id) => [id, { type: "sea" }]),
      ),
      ...state.board,
    })) {
      const p = position(id);
      for (const v of shape.getPoints(18))
        corners.push(new THREE.Vector3(p.x + v.x, 0, p.z - v.y));
      if (t.type === "island" || state.players.some((p) => p.boat === id))
        corners.push(new THREE.Vector3(p.x, 1.45, p.z));
    }
    let distance = 8;
    for (let i = 0; i < 100; i++) {
      camera.position.copy(center).addScaledVector(direction, distance);
      camera.lookAt(center);
      camera.updateMatrixWorld();
      if (
        corners.every((p) => {
          const v = p.clone().project(camera);
          return Math.abs(v.x) < 0.89 && Math.abs(v.y) < 0.77;
        })
      )
        break;
      distance *= 1.04;
    }
    // Center the actual silhouette, not the empty corners of its bounding box.
    for (let i = 0; i < 6; i++) {
      const screen = corners.map((p) => p.clone().project(camera));
      const mid = new THREE.Vector2(
        (Math.min(...screen.map((p) => p.x)) +
          Math.max(...screen.map((p) => p.x))) /
          2,
        (Math.min(...screen.map((p) => p.y)) +
          Math.max(...screen.map((p) => p.y))) /
          2,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(mid, camera);
      const target = ray.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2),
        new THREE.Vector3(),
      );
      if (target) {
        const delta = target.sub(controls.target);
        camera.position.add(delta);
        controls.target.add(delta);
        camera.lookAt(controls.target);
        camera.updateMatrixWorld();
      }
      if (i < 5) {
        const screen = corners.map((p) => p.clone().project(camera));
        const usage = Math.max(
          ...screen.map((p) =>
            Math.max(Math.abs(p.x) / 0.87, Math.abs(p.y) / 0.79),
          ),
        );
        distance *= usage;
        camera.position
          .copy(controls.target)
          .addScaledVector(direction, distance);
        camera.lookAt(controls.target);
        camera.updateMatrixWorld();
      }
    }
    if (
      animate &&
      cameraFramed &&
      canAnimate() &&
      (from.distanceTo(camera.position) > 0.01 ||
        origin.distanceTo(controls.target) > 0.01)
    ) {
      cameraMotion = {
        from,
        origin,
        to: camera.position.clone(),
        target: controls.target.clone(),
        start: null,
      };
      cameraReady = new Promise((resolve) => (resolveCamera = resolve));
      target.dataset.cameraTransition = "reframe";
      camera.position.copy(from);
      controls.target.copy(origin);
    }
    cameraFramed = true;
    controls.update();
    invalidate();
  }

  function sailTo(index, destination, cellPath) {
    const route = routeFor(index, destination, cellPath);
    if (!route) return;
    const length = route.path
      .slice(1)
      .reduce(
        (sum, p, i) =>
          sum + Math.hypot(p.x - route.path[i].x, p.z - route.path[i].z),
        0,
      );
    motion = {
      ...route,
      index,
      destination,
      length,
      elapsed: 0,
      last: 0,
      duration: Math.max(1000, Math.min(5000, length * 530)),
    };
    ready = new Promise((resolve) => (resolveReady = resolve));
    target.setAttribute("aria-busy", "true");
    if (presentation.sound === true && visible) sailingSound.start();
    invalidate();
  }
  function finishSailing() {
    if (!motion) return;
    const current = motion,
      vessel = boats[current.index],
      end = current.path.at(-1);
    vessel.model.position.set(end.x, 0.08, end.z);
    vessel.cell = current.destination;
    for (const neighbour of current.neighbours) {
      neighbour.object.position.copy(neighbour.target);
      neighbour.object.rotation.copy(neighbour.rotation);
    }
    board.updateMatrixWorld(true);
    for (const piece of protectedPieces)
      piece.userData.labelBox.setFromObject(piece);
    sailingSound.stop();
    motion = null;
    renderer.shadowMap.needsUpdate = true;
    resolveAnimation();
    invalidate();
  }
  function resolveAnimation() {
    if (motion || drawingMotion) return;
    target.setAttribute("aria-busy", "false");
    resolveReady?.();
    resolveReady = null;
  }
  function startDrawing(fresh) {
    drawingMotion = { fresh, elapsed: 0, last: null };
    for (const drawing of fresh) setDrawingProgress(drawing, 0);
    ready = new Promise((resolve) => (resolveReady = resolve));
    target.setAttribute("aria-busy", "true");
    target.dataset.drawingCell = fresh[0].cell;
    invalidate();
  }
  function finishDrawing() {
    if (!drawingMotion) return;
    for (const drawing of drawingMotion.fresh) setDrawingProgress(drawing, 1);
    drawingMotion = null;
    delete target.dataset.drawingCell;
    resolveAnimation();
    invalidate();
  }
  function animateDrawing(now) {
    if (!drawingMotion) return;
    const current = drawingMotion;
    if (current.last !== null)
      current.elapsed += Math.min(80, now - current.last);
    current.last = now;
    const progress = Math.min(1, current.elapsed / DRAW_DURATION);
    for (const drawing of current.fresh) setDrawingProgress(drawing, progress);
    if (progress === 1) finishDrawing();
  }
  function settleAnimations() {
    finishSailing();
    finishDrawing();
    finishTiles();
    finishCamera();
  }
  function zoom(factor) {
    finishCamera(false);
    const offset = camera.position.clone().sub(controls.target);
    const length = Math.max(
      controls.minDistance,
      Math.min(controls.maxDistance, offset.length() * factor),
    );
    camera.position.copy(controls.target).add(offset.setLength(length));
    controls.update();
    invalidate();
  }
  const raycaster = new THREE.Raycaster(),
    activePointers = new Set();
  let down,
    moved = false;
  listen(gestureSurface, "pointerdown", (e) => {
    if (!visible) return;
    finishCamera(false);
    activePointers.add(e.pointerId);
    if (activePointers.size > 1) {
      down = null;
      moved = true;
    } else if (e.button === 0) {
      down = {
        x: e.clientX,
        y: e.clientY,
        id: e.pointerId,
        cell: e.target.closest("[data-map-tile]")?.dataset.mapTile,
      };
      moved = false;
    }
  });
  listen(gestureSurface, "pointermove", (e) => {
    if (!visible) return;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5)
      moved = true;
  });
  listen(gestureSurface, "pointerup", (e) => {
    if (!visible) return;
    activePointers.delete(e.pointerId);
    if (!down || down.id !== e.pointerId) return;
    if (!moved) {
      const r = host.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      selectTile(
        down.cell ??
          raycaster.intersectObjects([...tiles, ...ghostTiles], false)[0]
            ?.object.userData.cell ??
          null,
      );
    }
    down = null;
  });
  listen(gestureSurface, "pointercancel", (e) => {
    activePointers.delete(e.pointerId);
    down = null;
  });
  listen(renderer.domElement, "keydown", (e) => {
    const keys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "+",
      "=",
      "-",
      "0",
      "Escape",
    ];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    if (e.key === "Escape") selectTile(null);
    else if (e.key === "0") resetCamera();
    else if (e.key === "+" || e.key === "=") zoom(0.8);
    else if (e.key === "-") zoom(1.25);
    else {
      const delta = new THREE.Vector3(
        e.key === "ArrowLeft" ? -0.6 : e.key === "ArrowRight" ? 0.6 : 0,
        0,
        e.key === "ArrowUp" ? -0.6 : e.key === "ArrowDown" ? 0.6 : 0,
      );
      camera.position.add(delta);
      controls.target.add(delta);
      controls.update();
      invalidate();
    }
  });
  function screenBox(box) {
    const points = [];
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const p = new THREE.Vector3(x, y, z).project(camera);
          points.push({
            x: (p.x * 0.5 + 0.5) * host.clientWidth,
            y: (0.5 - p.y * 0.5) * host.clientHeight,
          });
        }
    const x = Math.min(...points.map((p) => p.x)),
      y = Math.min(...points.map((p) => p.y));
    return {
      x,
      y,
      w: Math.max(...points.map((p) => p.x)) - x,
      h: Math.max(...points.map((p) => p.y)) - y,
    };
  }
  function updateLabels() {
    const w = host.clientWidth,
      h = host.clientHeight;
    // Reserve the projected volume of goods: HTML badges have no depth testing.
    const pieces = new Map(
      protectedPieces.map((piece) => [
        piece,
        screenBox(piece.userData.labelBox),
      ]),
    );
    const occupied = [...pieces.values()];
    const frame = host.getBoundingClientRect();
    for (const overlay of target.parentElement.querySelectorAll(
      ".market-info, .demand-ships, .map-tools, .upcoming",
    )) {
      const r = overlay.getBoundingClientRect();
      if (r.width && r.height)
        occupied.push({
          x: r.left - frame.left,
          y: r.top - frame.top,
          w: r.width,
          h: r.height,
        });
    }
    const overlaps = (r, o) =>
      r.x < o.x + o.w + 4 &&
      r.x + r.w + 4 > o.x &&
      r.y < o.y + o.h + 4 &&
      r.y + r.h + 4 > o.y;
    for (const label of [...labels].sort((a, b) => b.priority - a.priority)) {
      label.leader.hidden = true;
      if (label.boat !== undefined)
        label.point
          .copy(boats[label.boat].model.position)
          .add(new THREE.Vector3(0, 1.35, 0));
      const p = label.point.clone().project(camera);
      label.el.hidden = p.z > 1 || p.z < -1;
      if (label.el.hidden) continue;
      const lw = label.el.offsetWidth,
        lh = label.el.offsetHeight;
      const piece = pieces.get(label.piece);
      const model = label.el.classList.contains("model-label");
      const x = model && piece ? piece.x + piece.w / 2 : (p.x * 0.5 + 0.5) * w;
      const y = Math.max(
        (0.5 - p.y * 0.5) * h,
        piece ? piece.y + piece.h + lh / 2 + 5 : -Infinity,
      );
      let rect = null;
      const candidates =
        model && piece
          ? [
              { x, y: piece.y + piece.h + lh / 2 + 5 },
              { x: piece.x + piece.w + lw / 2 + 5, y: piece.y + piece.h / 2 },
              { x: piece.x - lw / 2 - 5, y: piece.y + piece.h / 2 },
              { x, y: piece.y - lh / 2 - 5 },
            ]
          : [];
      for (const offset of [
        0,
        5,
        10,
        15,
        20,
        lh + 5,
        -lh - 5,
        2 * (lh + 5),
        -2 * (lh + 5),
        3 * (lh + 5),
        -3 * (lh + 5),
      ]) {
        for (const dx of [0, -lw * 0.5, lw * 0.5, -lw, lw])
          candidates.push({ x: x + dx, y: y + offset });
      }
      for (const point of candidates) {
        const candidate = {
          x: Math.max(4, Math.min(w - lw - 4, point.x - lw / 2)),
          y: Math.max(4, Math.min(h - lh - 4, point.y - lh / 2)),
          w: lw,
          h: lh,
        };
        if (!occupied.some((o) => overlaps(candidate, o))) {
          rect = candidate;
          break;
        }
      }
      if (!rect) {
        label.el.hidden = true;
        continue;
      }
      occupied.push(rect);
      label.el.style.transform = `translate(${rect.x + lw / 2}px,${rect.y + lh / 2}px) translate(-50%,-50%)`;
      label.el.style.zIndex = String(Math.round((1 - p.z) * 100));
      const ax = (p.x * 0.5 + 0.5) * w,
        ay = (0.5 - p.y * 0.5) * h,
        dx = rect.x + lw / 2 - ax,
        dy = rect.y + lh / 2 - ay;
      if (Math.hypot(dx, dy) > Math.max(42, lh * 1.3)) {
        label.leader.hidden = false;
        label.leader.style.width = `${Math.hypot(dx, dy)}px`;
        label.leader.style.transform = `translate(${ax}px,${ay}px) rotate(${Math.atan2(dy, dx)}rad)`;
      }
    }
  }
  function pieceFootprint(object) {
    const box = new THREE.Box3(),
      origin = object.getWorldPosition(new THREE.Vector3());
    object.traverse((part) => {
      if (part.isMesh) {
        part.geometry.computeBoundingBox();
        box.union(
          part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld),
        );
      }
    });
    return {
      minX: box.min.x - origin.x,
      maxX: box.max.x - origin.x,
      minZ: box.min.z - origin.z,
      maxZ: box.max.z - origin.z,
    };
  }
  function routeFor(index, destination, cellPath) {
    const vessel = boats[index],
      p = position(destination);
    if (state.board[destination]?.type !== "sea" || vessel.cell === destination)
      return null;
    const occupants = boats
      .map((b, i) => ({ b, i }))
      .filter(({ b, i }) => i === index || b.cell === destination);
    const targets = new Map(
      occupants.map(({ i }, j) => [
        i,
        new THREE.Vector3(
          p.x + (j - (occupants.length - 1) / 2) * 0.94,
          0.08,
          p.z - 0.15,
        ),
      ]),
    );
    const departure = position(vessel.cell);
    const staying = boats
      .map((b, i) => ({ b, i }))
      .filter(({ b, i }) => i !== index && b.cell === vessel.cell);
    staying.forEach(({ i }, j) =>
      targets.set(
        i,
        new THREE.Vector3(
          departure.x + (j - (staying.length - 1) / 2) * 0.94,
          0.08,
          departure.z - 0.15,
        ),
      ),
    );
    const goal = targets.get(index),
      origin = vessel.model.position;
    const path = seaRoute(
      state.board,
      vessel.cell,
      destination,
      { x: origin.x, z: origin.z },
      { x: goal.x, z: goal.z },
      position,
      cellPath,
    );
    board.updateMatrixWorld(true);
    const pieces = [
      ...boats.filter((b, i) => i !== index).map((b) => b.model),
      ...solids.map((s) => s.object),
    ];
    const neighbours = pieces.map((object, i) => {
      const local = object.position.clone(),
        world = object.getWorldPosition(new THREE.Vector3());
      const boatIndex = boats.findIndex((b) => b.model === object),
        target = targets.get(boatIndex)?.clone() ?? local.clone();
      return {
        object,
        local,
        world,
        target,
        departing: staying.some((p) => p.i === boatIndex),
        rotation: object.rotation.clone(),
        isBoat: boatIndex >= 0,
        footprint: pieceFootprint(object),
        side: passingSide(path, world, i),
        pose: { x: 0, z: 0, yaw: 0, vx: 0, vz: 0, vyaw: 0 },
      };
    });
    return {
      path,
      targets,
      neighbours,
      footprint: pieceFootprint(vessel.model),
    };
  }
  function animateSailing(now) {
    if (!motion) return;
    const dt = motion.last ? Math.min(80, now - motion.last) : 16;
    motion.elapsed += motion.last ? dt : 0;
    motion.last = now;
    const t = Math.min(1, motion.elapsed / motion.duration),
      ease = t * t * (3 - 2 * t),
      p = routePosition(motion.path, ease);
    sailingSound.setRemainingTime((motion.duration - motion.elapsed) / 1000);
    const ahead = routePosition(motion.path, Math.min(1, ease + 0.018)),
      behind = routePosition(motion.path, Math.max(0, ease - 0.018));
    const direction = { x: ahead.x - behind.x, z: ahead.z - behind.z };
    boats[motion.index].model.position.set(
      p.x,
      0.08 + Math.sin(t * Math.PI) * 0.025,
      p.z,
    );
    const arrival = arrivalFraction(motion.length * (1 - ease));
    const passing = routePosition(
      motion.path,
      Math.min(1, ease + 0.1 / Math.max(0.1, motion.length)),
    );
    if (t === 1 && !motion.arrived) {
      motion.arrived = true;
      sailingSound.stop();
    }
    for (const neighbour of motion.neighbours) {
      const departure = THREE.MathUtils.smoothstep(
        motion.length * ease,
        0.9,
        1.8,
      );
      const base = neighbour.local
        .clone()
        .lerp(neighbour.target, neighbour.departing ? departure : arrival);
      const world = neighbour.world
        .clone()
        .add(base.clone().sub(neighbour.local));
      const nudge =
        t === 1
          ? { x: 0, z: 0 }
          : giveWay(
              world,
              passing,
              direction,
              neighbour.side,
              motion.footprint,
              neighbour.footprint,
            );
      const amount = Math.hypot(nudge.x, nudge.z),
        maxAngle = neighbour.isBoat ? 0.26 : 0.13;
      const yaw = amount
        ? THREE.MathUtils.clamp(
            Math.atan2(-nudge.x, -nudge.z),
            -maxAngle,
            maxAngle,
          ) * Math.min(1, amount / 0.28)
        : 0;
      const pose = stepYield(
        neighbour.pose,
        { x: nudge.x, z: nudge.z, yaw },
        dt / 1000,
      );
      neighbour.object.position
        .copy(base)
        .add(new THREE.Vector3(pose.x, 0, pose.z));
      neighbour.object.rotation.y = neighbour.rotation.y + pose.yaw;
      neighbour.object.rotation.z =
        neighbour.rotation.z +
        (neighbour.isBoat
          ? THREE.MathUtils.clamp(pose.vx * 0.018, -0.025, 0.025)
          : 0);
    }
    board.updateMatrixWorld(true);
    for (const solid of solids)
      solid.object.userData.labelBox.setFromObject(solid.object);
    renderer.shadowMap.needsUpdate = true;
    if (
      t === 1 &&
      (motion.elapsed - motion.duration > 500 ||
        motion.neighbours.every(
          (n) => Math.hypot(n.pose.x, n.pose.z, n.pose.yaw) < 0.001,
        ))
    )
      finishSailing();
  }

  function invalidate() {
    if (visible && !pending && !document.hidden)
      pending = requestAnimationFrame(render);
  }
  function render(now) {
    pending = 0;
    if (document.hidden || !visible) return;
    animateSailing(now);
    animateDrawing(now);
    animateCamera(now);
    animateTiles(now);
    updateLabels();
    renderer.render(scene, camera);
    if (motion || drawingMotion || cameraMotion || tileMotion) invalidate();
  }
  controls.addEventListener("change", invalidate);
  function resizeViewport() {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h || (w === viewportWidth && h === viewportHeight)) return null;
    const widthChanged = w !== viewportWidth;
    // A taller/shorter action panel must not reset a player's zoom or pan.
    // Preserve the on-screen scale while adjusting the available canvas height.
    if (cameraFramed && viewportHeight) {
      const ratio = h / viewportHeight;
      camera.position
        .sub(controls.target)
        .multiplyScalar(ratio)
        .add(controls.target);
      if (cameraMotion) {
        cameraMotion.from
          .sub(cameraMotion.origin)
          .multiplyScalar(ratio)
          .add(cameraMotion.origin);
        cameraMotion.to
          .sub(cameraMotion.target)
          .multiplyScalar(ratio)
          .add(cameraMotion.target);
      }
    }
    viewportWidth = w;
    viewportHeight = h;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    controls.update();
    invalidate();
    return { widthChanged };
  }
  const resize = new ResizeObserver(() => {
    const changed = resizeViewport();
    if (changed?.widthChanged && bounds) resetCamera({ animate: cameraFramed });
  });
  resize.observe(host);
  listen(
    target,
    "pointerdown",
    () => {
      if (presentation.sound === true) sailingSound.unlock();
    },
    { passive: true },
  );
  listen(document, "visibilitychange", () => {
    if (document.hidden) {
      settleAnimations();
      cancelAnimationFrame(pending);
      pending = 0;
      sailingSound.stop();
    } else invalidate();
  });
  listen(gestureSurface, "wheel", () => finishCamera(false), { passive: true });
  listen(window, "pagehide", () => {
    settleAnimations();
    sailingSound.stop();
  });
  listen(reducedMotion, "change", () => {
    if (reducedMotion.matches) settleAnimations();
  });
  return {
    update,
    zoom,
    reset: resetCamera,
    unlock: () => {
      if (presentation.sound === true) sailingSound.unlock();
    },
    setVisible(value) {
      if (visible === value) return;
      visible = value;
      controls.enabled = value;
      if (!value) {
        settleAnimations();
        cancelAnimationFrame(pending);
        pending = 0;
        sailingSound.stop();
      } else invalidate();
    },
    whenIdle: async () => {
      do {
        await Promise.all([ready, cameraReady, tileReady]);
      } while (motion || drawingMotion || cameraMotion || tileMotion);
    },
    settle: settleAnimations,
    destroy() {
      visible = false;
      events.abort();
      resize.disconnect();
      settleAnimations();
      cancelAnimationFrame(pending);
      controls.dispose();
      disposeBoard();
      for (const m of palette.values()) m.dispose();
      for (const m of goodsLabels.values()) {
        m.map.dispose();
        m.dispose();
      }
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (!Array.isArray(o.material)) o.material?.dispose();
      });
      renderer.dispose();
      target.replaceChildren();
    },
  };
}
