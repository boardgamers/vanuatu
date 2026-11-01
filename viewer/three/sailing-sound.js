// Continuous filtered water noise, tied to animation start/stop rather than a
// fixed-length cue. No ambience runs while the board is idle.
export function createSailingSound(
  createContext = () =>
    new (globalThis.AudioContext ?? globalThis.webkitAudioContext)(),
) {
  let context,
    buffer,
    voices = [],
    generation = 0,
    ready = Promise.resolve(),
    level = 1;
  function unlock() {
    try {
      context ??= createContext();
      if (context.state === "suspended")
        ready = context.resume().catch(() => {});
    } catch {}
  }
  function stop(fade = 0.72) {
    generation++;
    const current = voices;
    voices = [];
    for (const { source, gain } of current) {
      const now = context.currentTime;
      if (gain.gain.cancelAndHoldAtTime) gain.gain.cancelAndHoldAtTime(now);
      else {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
      }
      gain.gain.setTargetAtTime(0.0001, now, fade / 4.5);
      try {
        source.stop(now + fade);
      } catch {}
    }
  }
  async function start() {
    if (voices.length) return;
    stop(0.12);
    level = 1;
    const request = generation;
    unlock();
    await ready;
    if (request !== generation || context?.state !== "running") return;
    try {
      if (!buffer) {
        buffer = context.createBuffer(
          1,
          context.sampleRate * 2,
          context.sampleRate,
        );
        const data = buffer.getChannelData(0);
        let seed = 9173;
        for (let i = 0; i < data.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          data[i] = seed / 2147483648 - 1;
        }
      }
      for (const [frequency, volume] of [
        [700, 0.095],
        [1100, 0.045],
      ]) {
        const source = context.createBufferSource(),
          filter = context.createBiquadFilter(),
          gain = context.createGain();
        source.buffer = buffer;
        source.loop = true;
        filter.type = "lowpass";
        filter.frequency.value = frequency;
        source.connect(filter).connect(gain).connect(context.destination);
        const now = context.currentTime;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(volume * level, now + 0.12);
        source.onended = () => {
          source.disconnect();
          filter.disconnect();
          gain.disconnect();
        };
        voices.push({ source, gain, volume });
        source.start();
      }
    } catch {
      stop();
    }
  }
  function setRemainingTime(seconds) {
    const t = Math.max(0, Math.min(1, seconds / 0.6)),
      next = 0.35 + 0.65 * t * t * (3 - 2 * t);
    if (Math.abs(level - next) < 0.005) return;
    level = next;
    for (const { gain, volume } of voices)
      gain.gain.setTargetAtTime(volume * level, context.currentTime, 0.045);
  }
  return { unlock, start, stop, setRemainingTime };
}
