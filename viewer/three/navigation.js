const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const neighbours = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
];

// Only the game's sea topology guides the illustration. Pieces never block it.
export function seaRoute(board, from, to, start, end, position, cellPath) {
  const queue = [from],
    parent = new Map([[from, null]]);
  for (let i = 0; i < queue.length && !parent.has(to); i++) {
    const [q, r] = queue[i].split(",").map(Number);
    for (const [dq, dr] of neighbours) {
      const id = `${q + dq},${r + dr}`;
      if (board[id]?.type === "sea" && !parent.has(id)) {
        parent.set(id, queue[i]);
        queue.push(id);
      }
    }
  }
  const cells = cellPath?.length ? [from, ...cellPath] : [];
  if (!cells.length && parent.has(to))
    for (let id = to; id; id = parent.get(id)) cells.unshift(id);
  const points = [
    start,
    ...cells.slice(1, -1).map((id) => {
      const p = position(id);
      return { x: p.x, z: p.z - 0.15 };
    }),
    end,
  ];
  const path = [start];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1];
    const radius = Math.min(0.28, distance(a, b) * 0.25, distance(b, c) * 0.25);
    if (!radius) continue;
    const entry = {
      x: b.x + ((a.x - b.x) * radius) / distance(a, b),
      z: b.z + ((a.z - b.z) * radius) / distance(a, b),
    };
    const exit = {
      x: b.x + ((c.x - b.x) * radius) / distance(b, c),
      z: b.z + ((c.z - b.z) * radius) / distance(b, c),
    };
    for (let j = 0; j <= 8; j++) {
      const t = j / 8,
        u = 1 - t;
      path.push({
        x: u * u * entry.x + 2 * u * t * b.x + t * t * exit.x,
        z: u * u * entry.z + 2 * u * t * b.z + t * t * exit.z,
      });
    }
  }
  path.push(end);
  return path;
}

export function routePosition(path, progress) {
  if (progress <= 0) return path[0];
  if (progress >= 1) return path.at(-1);
  const lengths = path.slice(1).map((p, i) => distance(path[i], p));
  let remaining = progress * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const t = lengths[i] ? remaining / lengths[i] : 1;
      return {
        x: path[i].x + (path[i + 1].x - path[i].x) * t,
        z: path[i].z + (path[i + 1].z - path[i].z) * t,
      };
    }
    remaining -= lengths[i];
  }
  return path.at(-1);
}

export function passingSide(path, point, index) {
  let nearest = Infinity,
    side = index % 2 ? 1 : -1;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      dx = b.x - a.x,
      dz = b.z - a.z,
      length = Math.hypot(dx, dz);
    if (!length) continue;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - a.x) * dx + (point.z - a.z) * dz) / (length * length),
      ),
    );
    const x = a.x + dx * t,
      z = a.z + dz * t,
      d = Math.hypot(point.x - x, point.z - z);
    if (d < nearest) {
      nearest = d;
      const cross = (point.x - x) * -dz + (point.z - z) * dx;
      if (Math.abs(cross) > 0.02) side = Math.sign(cross);
    }
  }
  return side;
}

export function arrivalFraction(remaining) {
  const t = Math.max(0, Math.min(1, 1 - remaining / 1.1));
  return t * t * (3 - 2 * t);
}

export function giveWay(point, vessel, direction, side, boat, piece) {
  const gap = 0.055;
  const a = {
    minX: point.x + piece.minX,
    maxX: point.x + piece.maxX,
    minZ: point.z + piece.minZ,
    maxZ: point.z + piece.maxZ,
  };
  const b = {
    minX: vessel.x + boat.minX - gap,
    maxX: vessel.x + boat.maxX + gap,
    minZ: vessel.z + boat.minZ - gap,
    maxZ: vessel.z + boat.maxZ + gap,
  };
  // Both axes must overlap. An infinite strip perpendicular to the route was
  // making remote pieces move, especially when the route changed direction.
  if (
    a.maxX <= b.minX ||
    a.minX >= b.maxX ||
    a.maxZ <= b.minZ ||
    a.minZ >= b.maxZ
  )
    return { x: 0, z: 0 };
  const length = Math.hypot(direction.x, direction.z);
  if (!length) return { x: 0, z: 0 };
  const normal = { x: -direction.z / length, z: direction.x / length };
  function clearance(sign) {
    const x = normal.x * sign,
      z = normal.z * sign;
    return Math.min(
      x > 1e-6
        ? (b.maxX - a.minX) / x
        : x < -1e-6
          ? (a.maxX - b.minX) / -x
          : Infinity,
      z > 1e-6
        ? (b.maxZ - a.minZ) / z
        : z < -1e-6
          ? (a.maxZ - b.minZ) / -z
          : Infinity,
    );
  }
  const left = clearance(1),
    right = clearance(-1);
  const sign = Math.abs(left - right) < 0.08 ? side : left < right ? 1 : -1;
  const amount = sign === 1 ? left : right;
  return { x: normal.x * sign * amount, z: normal.z * sign * amount };
}

// Critically damped: accelerate and settle without oscillating back and forth.
export function stepYield(pose, target, seconds) {
  const omega = 23,
    decay = Math.exp(-omega * seconds);
  for (const [key, velocity] of [
    ["x", "vx"],
    ["z", "vz"],
    ["yaw", "vyaw"],
  ]) {
    const change = pose[key] - target[key],
      step = (pose[velocity] + omega * change) * seconds;
    pose[key] = target[key] + (change + step) * decay;
    pose[velocity] = (pose[velocity] - omega * step) * decay;
  }
  return pose;
}
