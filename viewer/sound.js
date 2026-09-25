export function createMoveSound(
  createContext = () =>
    new (globalThis.AudioContext ?? globalThis.webkitAudioContext)(),
) {
  let context,
    ready = Promise.resolve(),
    enabled = false,
    destroyed = false;
  const active = new Set();
  return {
    setEnabled(value) {
      enabled = value === true;
      if (!enabled)
        for (const oscillator of active) {
          try {
            oscillator.stop();
          } catch {}
        }
    },
    unlock() {
      // Called from the user's click, before awaiting the server's move response.
      if (!enabled || destroyed) return;
      try {
        context ??= createContext();
        if (context.state === "suspended")
          ready = context.resume().catch(() => {});
      } catch {}
    },
    async play() {
      await ready;
      if (!enabled || destroyed || context?.state !== "running") return;
      try {
        const oscillator = context.createOscillator(),
          gain = context.createGain();
        gain.gain.setValueAtTime(0.025, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          context.currentTime + 0.13,
        );
        oscillator.frequency.value = 540;
        oscillator.connect(gain).connect(context.destination);
        active.add(oscillator);
        oscillator.onended = () => {
          active.delete(oscillator);
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start();
        oscillator.stop(context.currentTime + 0.13);
      } catch {}
    },
    destroy() {
      destroyed = true;
      active.clear();
      context?.close().catch(() => {});
    },
  };
}
