// Reconstruct deliveries from the public event; never delay the actual game state.
export function tradeFrames(before, after, events) {
  if (!before || !events.length) return null;
  const initial = before.demands.map((d) => ({
    ...d,
    goods: [...d.goods],
    filled: [...d.filled],
  }));
  const delivered = initial.map((d) => ({ ...d, filled: [...d.filled] }));
  const touched = new Set(),
    completed = new Set();
  for (const event of events)
    for (const shipment of event.details?.shipments ?? []) {
      const ship = delivered.find((d) => d.id === shipment.ship);
      const slot = ship?.goods.findIndex(
        (good, i) => good === event.good && !ship.filled[i],
      );
      if (slot >= 0) {
        ship.filled[slot] = true;
        touched.add(ship.id);
      }
      if (shipment.complete) completed.add(shipment.ship);
    }
  const departing = initial
    .filter((d) => !after.demands.some((n) => n.id === d.id))
    .map((d) => d.id);
  return touched.size || departing.length
    ? {
        initial,
        delivered,
        touched: [...touched],
        completed: [...completed],
        departing,
      }
    : null;
}

export function createTradeTransition(root, repaint) {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let enabled = true,
    plan,
    visual,
    epoch = 0,
    ready = Promise.resolve(),
    resolveReady;
  const timers = new Map(),
    animations = new Set();
  const allowed = () => enabled && !motion.matches && !document.hidden;
  const ships = () => [...root.querySelectorAll(".demand-ship")];
  const animate = (node, frames, duration, fill = "none") => {
    const a = node.animate(frames, {
      duration,
      fill,
      easing: "cubic-bezier(.22,.61,.36,1)",
    });
    animations.add(a);
    a.onfinish = () => {
      if (fill === "none") {
        animations.delete(a);
        a.cancel();
      }
    };
  };
  const wait = (ms) =>
    new Promise((resolve) => {
      const id = setTimeout(() => {
        timers.delete(id);
        resolve();
      }, ms);
      timers.set(id, resolve);
    });
  function cancel(render = true) {
    epoch++;
    for (const [id, resolve] of timers) {
      clearTimeout(id);
      resolve();
    }
    timers.clear();
    for (const a of animations) a.cancel();
    animations.clear();
    const changed = !!visual;
    visual = plan = null;
    delete root.dataset.tradeTransition;
    resolveReady?.();
    resolveReady = null;
    if (changed && render) repaint();
  }
  function prepare(before, after, events) {
    cancel(false);
    plan = allowed() ? tradeFrames(before, after, events) : null;
    if (plan) visual = plan.touched.length ? plan.initial : plan.delivered;
  }
  async function run() {
    if (!plan) return;
    const current = epoch,
      frame = plan;
    ready = new Promise((resolve) => (resolveReady = resolve));
    root.dataset.tradeTransition = "delivery";
    if (frame.touched.length) {
      await wait(420);
      if (epoch !== current) return;
      visual = frame.delivered;
      repaint();
      for (const ship of ships().filter((n) =>
        frame.touched.includes(Number(n.dataset.ship)),
      ))
        animate(
          ship,
          [
            { boxShadow: "0 0 0 3px #ba913866", background: "#fff4bd" },
            { boxShadow: "0 0 0 0 transparent" },
          ],
          800,
        );
    }
    if (frame.departing.length) {
      root.dataset.tradeTransition = "completed";
      await wait(650);
      if (epoch !== current) return;
      root.dataset.tradeTransition = "departure";
      for (const ship of ships().filter((n) =>
        frame.departing.includes(Number(n.dataset.ship)),
      ))
        animate(
          ship,
          [
            { opacity: 1, transform: "translateX(0)" },
            { opacity: 0, transform: "translateX(32px)" },
          ],
          360,
          "forwards",
        );
      await wait(360);
      if (epoch !== current) return;
      const positions = new Map(
        ships().map((n) => [n.dataset.ship, n.getBoundingClientRect()]),
      );
      for (const a of animations) a.cancel();
      animations.clear();
      visual = null;
      repaint();
      root.dataset.tradeTransition = "arrival";
      for (const ship of ships()) {
        const old = positions.get(ship.dataset.ship),
          next = ship.getBoundingClientRect();
        animate(
          ship,
          old
            ? [
                {
                  transform: `translate(${old.left - next.left}px,${old.top - next.top}px)`,
                },
                { transform: "none" },
              ]
            : [
                { opacity: 0, transform: "translateX(-20px)" },
                { opacity: 1, transform: "none" },
              ],
          360,
        );
      }
      await wait(360);
    } else await wait(frame.completed.length ? 800 : 300);
    if (epoch === current) cancel();
  }
  const stop = () => cancel();
  const visibility = () => {
    if (document.hidden) cancel();
  };
  motion.addEventListener("change", stop);
  document.addEventListener("visibilitychange", visibility);
  return {
    prepare,
    run,
    cancel,
    demands: (fallback) => visual ?? fallback,
    whenIdle: () => ready,
    setEnabled(value) {
      enabled = value;
      if (!allowed()) cancel();
    },
    destroy() {
      cancel(false);
      motion.removeEventListener("change", stop);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
