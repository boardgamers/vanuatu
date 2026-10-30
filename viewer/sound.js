// Short, locally synthesized materials: no audio download or looping ambience.
export function createMoveSound(
  createContext = () =>
    new (globalThis.AudioContext ?? globalThis.webkitAudioContext)(),
) {
  let context,
    noise,
    ready = Promise.resolve(),
    enabled = false,
    destroyed = false,
    generation = 0;
  const active = new Set();
  function stop() {
    generation++;
    for (const source of [...active]) {
      try {
        source.stop();
      } catch {}
    }
  }
  function voice(source, duration, volume, delay = 0, filter) {
    const gain = context.createGain();
    const start = context.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    if (filter) source.connect(filter).connect(gain);
    else source.connect(gain);
    gain.connect(context.destination);
    active.add(source);
    source.onended = () => {
      active.delete(source);
      source.disconnect();
      filter?.disconnect();
      gain.disconnect();
    };
    source.start(start);
    source.stop(start + duration);
  }
  function tone(
    frequency,
    duration,
    volume,
    delay = 0,
    end = frequency,
    type = "sine",
  ) {
    const source = context.createOscillator();
    source.type = type;
    source.frequency.setValueAtTime(frequency, context.currentTime + delay);
    source.frequency.exponentialRampToValueAtTime(
      end,
      context.currentTime + delay + duration,
    );
    voice(source, duration, volume, delay);
  }
  function rustle(frequency, duration, volume, delay = 0) {
    if (!noise) {
      noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = noise.getChannelData(0);
      let seed = 9173;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = seed / 2147483648 - 1;
      }
    }
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    voice(source, duration, volume, delay, filter);
  }
  return {
    setEnabled(value) {
      enabled = value === true;
      if (!enabled) stop();
    },
    stop,
    unlock() {
      // Unlock on a user gesture, before waiting for a server response.
      if (!enabled || destroyed) return;
      try {
        context ??= createContext();
        if (context.state === "suspended")
          ready = context.resume().catch(() => {});
      } catch {}
    },
    async play(kind = "marker") {
      const request = ++generation;
      await ready;
      if (
        !enabled ||
        destroyed ||
        request !== generation ||
        context?.state !== "running"
      )
        return;
      try {
        // Fast bot moves replace the previous cue instead of building a queue.
        stop();
        switch (kind) {
          case "sail":
            rustle(700, 0.42, 0.04);
            rustle(1100, 0.28, 0.025, 0.12);
            break;
          case "fish":
            tone(380, 0.13, 0.035, 0, 160);
            tone(510, 0.16, 0.025, 0.1, 220);
            break;
          case "draw":
            rustle(1800, 0.27, 0.025);
            rustle(1300, 0.16, 0.018, 0.13);
            break;
          case "build":
            tone(190, 0.1, 0.045, 0, 100);
            tone(260, 0.14, 0.035, 0.12, 130);
            break;
          case "sell":
            tone(880, 0.18, 0.022);
            tone(1175, 0.24, 0.018, 0.075);
            break;
          case "buy":
            tone(180, 0.12, 0.04, 0, 100);
            tone(660, 0.25, 0.022, 0.08);
            break;
          case "complete":
            tone(660, 0.28, 0.025);
            tone(880, 0.3, 0.022, 0.1);
            tone(1320, 0.34, 0.015, 0.2);
            break;
          case "explore":
            tone(220, 0.09, 0.035, 0, 110);
            tone(990, 0.32, 0.017, 0.08);
            break;
          case "rest":
          case "tourist":
            tone(440, 0.24, 0.022);
            tone(660, 0.28, 0.012, 0.08);
            break;
          case "discard":
            tone(160, 0.09, 0.018, 0, 110);
            break;
          default:
            tone(260, 0.09, 0.04, 0, 130);
        }
      } catch {
        // Sound is optional; unavailable audio must never interrupt the game.
        stop();
      }
    },
    destroy() {
      destroyed = true;
      stop();
      active.clear();
      noise = undefined;
      context?.close().catch(() => {});
    },
  };
}
