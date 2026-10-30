// Only adjacent live states qualify. Loading, undoing, replaying and catching up
// must never celebrate old moves, or invent gains from a net balance change.
export function liveEvents(before, after) {
  if (!before || after.historyLength !== before.historyLength + 1) return [];
  const previous = before.events ?? [];
  const events = after.events ?? [];
  if (events.length <= previous.length) return [];
  if (
    previous.length &&
    JSON.stringify(previous.at(-1)) !==
      JSON.stringify(events[previous.length - 1])
  )
    return [];
  return events.slice(previous.length);
}

export function rewards(event) {
  const d = event.details ?? {};
  const result = [];
  const add = (icon, value) => {
    if (Number.isFinite(value) && value !== 0) result.push({ icon, value });
  };
  if (event.type === "action") {
    add("coin", -d.cost);
    add("coin", d.income);
    add("point", d.points);
    add("fish", d.fish);
    add("explore", d.treasure);
  } else if (event.type === "treasure") {
    add(
      "coin",
      event.values?.reduce((a, b) => a + b, 0),
    );
  } else if (event.type === "beg") {
    add("point", -event.amount);
    add("coin", event.amount);
  }
  return result;
}

export function soundFor(events) {
  const event = events.find((e) =>
    [
      "action",
      "plan",
      "neutral",
      "place",
      "treasure",
      "beg",
      "discard",
      "character",
      "rest",
      "governor",
    ].includes(e.type),
  );
  if (!event) return null;
  if (event.details?.shipments?.some((s) => s.complete)) return "complete";
  if (event.type === "action") return event.action;
  return (
    {
      plan: "marker",
      neutral: "marker",
      place: "build",
      treasure: "sell",
      beg: "sell",
      governor: "marker",
      character: "marker",
    }[event.type] ?? event.type
  );
}

export function createEffects(root, { icon, sound, center }) {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const motion = view.matchMedia("(prefers-reduced-motion: reduce)");
  const layer = doc.createElement("div");
  layer.className = "action-effects";
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("translate", "no");
  root.append(layer);
  const animations = new Set();
  let frame = 0,
    enabled = true;
  const allowed = () => enabled && !motion.matches && !doc.hidden;
  const query = (selector) => root.querySelector(selector);
  const point = (element) => {
    if (!element) return null;
    const r = element.getBoundingClientRect();
    if (
      !r.width ||
      !r.height ||
      r.bottom <= 0 ||
      r.top >= view.innerHeight ||
      r.right <= 0 ||
      r.left >= view.innerWidth
    )
      return null;
    const map = element.closest(".map-scroll");
    if (map) {
      const clip = map.getBoundingClientRect();
      if (
        r.right < clip.left ||
        r.left > clip.right ||
        r.bottom < clip.top ||
        r.top > clip.bottom
      )
        return null;
    }
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      width: r.width,
      height: r.height,
    };
  };
  const boat = (p) => query(`[data-boat="${p}"]`);
  const card = (p) => query(`[data-player-card="${p}"] .player-name`);
  const cell = (id) => query(`[data-cell="${id}"] .cell-surface`);
  function cancel() {
    view.cancelAnimationFrame(frame);
    for (const animation of animations) animation.cancel();
    animations.clear();
    layer.replaceChildren();
  }
  function animate(
    node,
    frames,
    duration,
    { delay = 0, remove = false, fill = "none" } = {},
  ) {
    if (!node?.animate) {
      if (remove) node?.remove();
      return;
    }
    const animation = node.animate(frames, {
      duration,
      delay,
      fill,
      easing: "ease-out",
    });
    animations.add(animation);
    const finish = () => {
      animations.delete(animation);
      if (remove) node.remove();
    };
    animation.onfinish = () => {
      animation.cancel();
      finish();
    };
    animation.oncancel = finish;
  }
  function overlay(at, html, kind = "reward") {
    if (!at) return null;
    const node = doc.createElement("div");
    node.className = `action-effect effect-${kind}`;
    node.innerHTML = html;
    node.style.left = `${Math.max(72, Math.min(view.innerWidth - 72, at.x))}px`;
    node.style.top = `${Math.max(24, at.y)}px`;
    layer.append(node);
    return node;
  }
  function gain(at, html, delay = 0) {
    const node = overlay(at, html);
    if (node)
      animate(
        node,
        [
          {
            opacity: 0,
            transform: "translate(-50%, -40%) scale(.94)",
            offset: 0,
          },
          {
            opacity: 1,
            transform: "translate(-50%, -80%) scale(1)",
            offset: 0.15,
          },
          { opacity: 1, transform: "translate(-50%, -100%)", offset: 0.8 },
          { opacity: 0, transform: "translate(-50%, -115%)", offset: 1 },
        ],
        1100,
        { delay, remove: true, fill: "backwards" },
      );
  }
  function pulse(element) {
    if (!point(element)) return;
    animate(
      element,
      [
        { boxShadow: "inset 0 0 0 2px #c59543, 0 0 0 3px #c5954344" },
        { boxShadow: "inset 0 0 0 2px transparent, 0 0 0 6px transparent" },
      ],
      750,
    );
  }
  function drop(element) {
    if (!allowed() || !point(element)) return;
    animate(
      element,
      [
        { transform: "translateY(-7px) scale(1.14)" },
        { transform: "translateY(1px) scale(.98)", offset: 0.7 },
        { transform: "none" },
      ],
      230,
    );
  }
  function fly(html, from, to, duration = 420, waypoints = []) {
    if (!from || !to) return false;
    const node = overlay(from, html, "piece");
    node.style.left = `${from.x}px`;
    node.style.top = `${from.y}px`;
    const positions = [from, ...waypoints, to];
    animate(
      node,
      positions.map((p) => ({
        transform: `translate(calc(-50% + ${p.x - from.x}px), calc(-50% + ${p.y - from.y}px))`,
      })),
      duration,
      { remove: true },
    );
    return node;
  }
  function capture() {
    if (!allowed()) return null;
    return {
      boats: new Map(
        [...root.querySelectorAll("[data-boat]")].map((b) => [
          Number(b.dataset.boat),
          point(b),
        ]),
      ),
      first: point(query(".player-name [data-first-help]")),
    };
  }
  function show(events, before, after, captured, player) {
    cancel();
    if (doc.hidden) return;
    const cue = soundFor(events);
    if (cue) void sound.play(cue);
    if (!allowed()) return;
    // Pending controls and dialog closure can render again in the same turn.
    // Position effects once, after that work, without a per-frame layout loop.
    frame = view.requestAnimationFrame(() => {
      frame = 0;
      if (!allowed()) return;
      for (const event of events) {
        const p = event.p;
        const d = event.details ?? {};
        if (["plan", "neutral"].includes(event.type)) {
          for (const action of new Set(event.actions))
            drop(
              query(
                `[data-action="${action}"] ${event.type === "neutral" ? ".neutral" : `[data-marker-player="${p}"]`}`,
              ),
            );
        }
        if (event.type === "action" && event.action === "sail") {
          const node = boat(p),
            end = point(node),
            start = captured?.boats.get(p);
          const matrix = query(".archipelago")?.getScreenCTM();
          const path = matrix
            ? (event.path ?? []).slice(0, -1).map((id) => {
                const c = center(id);
                return new view.DOMPoint(c.x, c.y + 11).matrixTransform(matrix);
              })
            : [];
          const duration = Math.min(650, 280 + (event.path?.length ?? 1) * 110);
          const box = node?.getBBox();
          const piece = fly(
            `<svg class="icon" viewBox="${box ? `${box.x} ${box.y} ${box.width} ${box.height}` : "0 0 48 48"}">${node?.innerHTML ?? ""}</svg>`,
            start,
            end,
            duration,
            path,
          );
          if (piece) {
            piece.style.color = after.players[p].color;
            piece.style.width = `${end.width}px`;
            piece.style.height = `${end.height}px`;
            animate(node, [{ opacity: 0 }, { opacity: 0 }], duration);
          }
        }
        const source =
          point(cell(event.cell ?? d.cell ?? after.players[p]?.boat)) ??
          point(card(p));
        if (
          event.type === "action" &&
          ["build", "draw", "tourist"].includes(event.action)
        ) {
          const piece = overlay(source, icon(event.action), "stamp");
          if (piece) {
            piece.style.color = after.players[p].color;
            animate(
              piece,
              [
                { opacity: 0, transform: "translate(-50%, -90%) scale(1.2)" },
                {
                  opacity: 1,
                  transform: "translate(-50%, -60%) scale(1)",
                  offset: 0.3,
                },
                {
                  opacity: 0,
                  transform: "translate(-50%, -60%) scale(1)",
                  offset: 1,
                },
              ],
              650,
              { remove: true },
            );
          }
        }
        if (event.action === "buy")
          for (const shipment of d.shipments ?? []) {
            const ship = query(`[data-ship="${shipment.ship}"]`);
            fly(icon(event.good), source, point(ship));
            if (shipment.complete) pulse(ship);
          }
        const changes = rewards(event);
        if (changes.length)
          gain(
            source,
            changes
              .map(
                ({ icon: name, value }) =>
                  `<span>${value > 0 ? "+" : "−"}${Math.abs(value)}${icon(name)}</span>`,
              )
              .join(""),
            event.action === "sail" ? 500 : 130,
          );
        if (event.type === "conversion")
          gain(
            point(card(p)) ?? source,
            `<span>${event.points * 2}${icon("coin")}</span><span>→</span><span>+${event.points}${icon("point")}</span>`,
            450,
          );
      }
      if (before.first !== after.first)
        fly(
          icon("first"),
          captured?.first,
          point(query(".player-name [data-first-help]")),
          480,
        );
      if (
        after.phase === "actions" &&
        before.phase === "actions" &&
        Number.isInteger(player)
      ) {
        const previous = before.majorities?.[player] ?? [];
        for (const action of after.majorities?.[player] ?? [])
          if (
            !previous.includes(action) &&
            after.players[player].markers[action] > 0
          )
            pulse(query(`[data-action="${action}"]`));
      }
    });
  }
  // Cancel overlays on scrolling instead of tracking layout on every frame.
  const scrolled = (event) => {
    // The journal follows new entries by scrolling its own list; that does not
    // move the board and must not cancel feedback for the move just received.
    if (event.target === doc || event.target.closest?.(".play")) cancel();
  };
  doc.addEventListener("scroll", scrolled, { capture: true, passive: true });
  view.addEventListener("resize", cancel, { passive: true });
  const visibility = () => {
    if (doc.hidden) {
      cancel();
      sound.stop();
    }
  };
  doc.addEventListener("visibilitychange", visibility);
  motion.addEventListener("change", cancel);
  return {
    capture,
    show,
    cancel,
    drop,
    setEnabled(value) {
      enabled = value !== false;
      if (!enabled) cancel();
    },
    destroy() {
      cancel();
      doc.removeEventListener("scroll", scrolled, true);
      view.removeEventListener("resize", cancel);
      doc.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", cancel);
      layer.remove();
    },
  };
}
