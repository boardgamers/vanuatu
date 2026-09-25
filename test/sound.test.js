import test from "node:test";
import assert from "node:assert/strict";
import { createMoveSound } from "../viewer/sound.js";

function audioFixture() {
  const counts = { created: 0, played: 0, stopped: 0, closed: 0 };
  const context = {
    state: "suspended",
    currentTime: 0,
    destination: {},
    async resume() {
      this.state = "running";
    },
    async close() {
      this.state = "closed";
      counts.closed++;
    },
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    },
    createOscillator() {
      return {
        frequency: {},
        connect(gain) {
          return gain;
        },
        disconnect() {},
        start() {
          counts.played++;
        },
        stop(at) {
          if (at === undefined) {
            counts.stopped++;
            this.onended?.();
          }
        },
      };
    },
  };
  const audio = createMoveSound(() => {
    counts.created++;
    return context;
  });
  return { audio, counts, context };
}

test("sound stays silent until enabled and unlocked by a gesture", async () => {
  const { audio, counts } = audioFixture();
  audio.unlock();
  await audio.play();
  audio.setEnabled(true);
  await audio.play();
  assert.equal(counts.created, 0);
  assert.equal(counts.played, 0);
});

test("successful moves reuse the context unlocked before the server reply", async () => {
  const { audio, counts } = audioFixture();
  audio.setEnabled(true);
  audio.unlock();
  assert.equal(counts.created, 1);
  await audio.play();
  audio.unlock();
  await audio.play();
  assert.equal(counts.created, 1);
  assert.equal(counts.played, 2);
  audio.setEnabled(false);
  assert.equal(counts.stopped, 2);
  await audio.play();
  assert.equal(counts.played, 2);
  audio.destroy();
  assert.equal(counts.closed, 1);
});

test("muting while audio unlock is pending suppresses delayed confirmation", async () => {
  const { audio, counts, context } = audioFixture();
  let resume;
  context.resume = () =>
    new Promise((resolve) => {
      resume = () => {
        context.state = "running";
        resolve();
      };
    });
  audio.setEnabled(true);
  audio.unlock();
  const confirmation = audio.play();
  audio.setEnabled(false);
  resume();
  await confirmation;
  assert.equal(counts.played, 0);
  audio.destroy();
});

test("destroyed viewers cannot play or recreate audio", async () => {
  const { audio, counts } = audioFixture();
  audio.setEnabled(true);
  audio.unlock();
  audio.destroy();
  audio.unlock();
  await audio.play();
  assert.equal(counts.created, 1);
  assert.equal(counts.closed, 1);
  assert.equal(counts.played, 0);
});

test("unavailable browser audio does not interrupt play", async () => {
  const audio = createMoveSound(() => {
    throw Error("Audio unavailable");
  });
  audio.setEnabled(true);
  audio.unlock();
  await audio.play();
  audio.destroy();
});
