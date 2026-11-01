import assert from "node:assert/strict";
import { createSailingSound } from "../viewer/three/sailing-sound.js";
const sources = [],
  gains = [];
const param = () => ({
  value: 0.1,
  setValueAtTime() {},
  exponentialRampToValueAtTime() {},
  cancelScheduledValues() {},
  setTargetAtTime(value, time, constant) {
    this.target = value;
    this.timeConstant = constant;
  },
});
const node = () => ({
  connect(next) {
    return next;
  },
  disconnect() {},
});
const context = {
  state: "running",
  currentTime: 0,
  sampleRate: 100,
  destination: {},
  createBuffer: (_, n) => ({ getChannelData: () => new Float32Array(n) }),
  createGain: () => {
    const gain = param();
    gains.push(gain);
    return { ...node(), gain };
  },
  createBiquadFilter: () => ({ ...node(), frequency: {} }),
  createBufferSource() {
    const s = {
      ...node(),
      start() {
        this.started = true;
      },
      stop(time) {
        this.stopped = time;
      },
    };
    sources.push(s);
    return s;
  },
};
const sound = createSailingSound(() => context);
await sound.start();
assert.equal(sources.length, 2);
assert.ok(sources.every((s) => s.loop && s.started && s.stopped === undefined));
context.currentTime = 12;
assert.ok(
  sources.every((s) => s.stopped === undefined),
  "No fixed short duration: still playing after a long movement",
);
sound.setRemainingTime(0.3);
assert.ok(
  gains[0].target > 0 && gains[0].target < 0.095,
  "Volume drops progressively as the boat slows",
);
sound.setRemainingTime(0);
assert.ok(
  gains[0].target > 0,
  "The cue remains audible until the boat arrives",
);
sound.stop();
assert.ok(
  sources.every((s) => s.stopped === 12.72),
  "A soft water tail continues after arrival",
);
assert.ok(
  gains.every((g) => g.timeConstant >= 0.15),
  "The tail fades gently instead of cutting off in a few milliseconds",
);
await sound.start();
const recent = sources.slice(-2);
assert.ok(recent.every((s) => s.started && s.stopped === undefined));
sound.stop();
let resume;
const delayed = createSailingSound(() => ({
  ...context,
  state: "suspended",
  resume: () => new Promise((r) => (resume = r)),
}));
const attempt = delayed.start();
delayed.stop();
resume();
await attempt;
assert.equal(
  sources.length,
  4,
  "A cancelled animation cannot start stale audio after unlock",
);
console.log(
  "Sailing sound: continuous loop, approach fade, soft arrival tail and cancelled unlock passed.",
);
