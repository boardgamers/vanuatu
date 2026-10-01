const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const STEP = 1.25;
const READABLE_TILE_SCALE = 0.5;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function mountMapZoom(root) {
  let zoom,
    observed,
    pinch,
    mapEvents,
    pinchEvents,
    layoutKey,
    autoFit = true,
    suppressClick = false;
  const events = new AbortController();
  const observer = new ResizeObserver(() => update(capture()));
  const elements = () => {
    const map = root.querySelector(".map-scroll");
    const canvas = map?.querySelector(".map-canvas");
    const svg = canvas?.querySelector(".archipelago");
    return svg ? { map, canvas, svg } : null;
  };
  function frame(map) {
    const css = getComputedStyle(map),
      rect = map.getBoundingClientRect();
    const left = parseFloat(css.paddingLeft),
      top = parseFloat(css.paddingTop);
    const width = map.clientWidth - left - parseFloat(css.paddingRight);
    const height = map.clientHeight - top - parseFloat(css.paddingBottom);
    return { x: rect.left + left, y: rect.top + top, width, height };
  }
  function center(map) {
    const f = frame(map);
    const left = Math.max(0, f.x),
      right = Math.min(innerWidth, f.x + f.width),
      top = Math.max(0, f.y),
      bottom = Math.min(innerHeight, f.y + f.height);
    return {
      x: right > left ? (left + right) / 2 : f.x + f.width / 2,
      y: bottom > top ? (top + bottom) / 2 : f.y + f.height / 2,
    };
  }
  function capture(point) {
    const el = elements();
    if (!el || zoom === undefined) return null;
    const client = point ?? center(el.map),
      matrix = el.svg.getScreenCTM();
    if (!matrix) return null;
    const world = new DOMPoint(client.x, client.y).matrixTransform(
      matrix.inverse(),
    );
    return { world, client: point };
  }
  function update(anchor) {
    const el = elements();
    if (!el) return;
    const { map, canvas, svg } = el,
      f = frame(map),
      box = svg.viewBox.baseVal;
    if (f.width <= 0 || f.height <= 0) return;
    const initial = zoom === undefined;
    const fitScale = Math.min(f.width / box.width, f.height / box.height);
    if (autoFit) {
      // Fit desktop panels even when narrow; on phones keep 176-unit tiles
      // at least 88px wide so their resource badges remain readable.
      zoom = matchMedia("(max-width: 700px)").matches
        ? clamp(READABLE_TILE_SCALE / fitScale, MIN_ZOOM, MAX_ZOOM)
        : MIN_ZOOM;
    }
    const scale = fitScale * zoom;
    const width = box.width * scale,
      height = box.height * scale;
    let resized = false;
    for (const [node, property, value] of [
      [canvas, "width", Math.max(f.width, width)],
      [canvas, "height", Math.max(f.height, height)],
      [svg, "width", width],
      [svg, "height", height],
    ]) {
      // CSSOM rounds fractional pixels; comparing the serialized strings can
      // otherwise rewrite the same size after every state update.
      if (
        !node.style[property] ||
        Math.abs(parseFloat(node.style[property]) - value) > 0.01
      ) {
        node.style[property] = `${value}px`;
        resized = true;
      }
    }
    const nextLayout = [
      box.x,
      box.y,
      box.width,
      box.height,
      f.width,
      f.height,
      zoom,
    ].join();
    if (map.dataset.zoom !== String(zoom)) map.dataset.zoom = String(zoom);
    if (!autoFit && anchor && (resized || layoutKey !== nextLayout)) {
      const client = anchor.client ?? center(map);
      const actual = anchor.world.matrixTransform(svg.getScreenCTM());
      map.scrollLeft += actual.x - client.x;
      map.scrollTop += actual.y - client.y;
    } else if (initial || (autoFit && layoutKey !== nextLayout)) {
      map.scrollLeft = (canvas.clientWidth - f.width) / 2;
      map.scrollTop = (canvas.clientHeight - f.height) / 2;
    }
    layoutKey = nextLayout;
    for (const [selector, disabled] of [
      ["[data-zoom-out]", zoom <= MIN_ZOOM],
      ["[data-zoom-in]", zoom >= MAX_ZOOM],
    ]) {
      const button = root.querySelector(selector);
      if (button?.getAttribute("aria-disabled") !== String(disabled))
        button?.setAttribute("aria-disabled", String(disabled));
    }
    if (observed !== map) {
      observer.disconnect();
      mapEvents?.abort();
      endPinch();
      mapEvents = new AbortController();
      for (const type of ["pointerdown", "wheel"])
        map.addEventListener(
          type,
          () => {
            autoFit = false;
          },
          {
            passive: true,
            signal: mapEvents.signal,
          },
        );
      map.addEventListener("touchstart", startPinch, {
        passive: true,
        signal: mapEvents.signal,
      });
      for (const type of ["touchend", "touchcancel"])
        map.addEventListener(
          type,
          (event) => {
            if (event.touches.length < 2) endPinch();
          },
          { passive: true, signal: mapEvents.signal },
        );
      observer.observe(map, { box: "border-box" });
      observed = map;
    }
  }
  function setZoom(value, anchor = capture()) {
    autoFit = false;
    zoom = clamp(value, MIN_ZOOM, MAX_ZOOM);
    update(anchor);
  }
  const geometry = (touches) => {
    const [a, b] = touches;
    return {
      distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      point: { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 },
    };
  };
  function endPinch() {
    pinch = null;
    pinchEvents?.abort();
    pinchEvents = null;
  }
  function startPinch(event) {
    if (event.touches.length === 1) suppressClick = false;
    const map = event.currentTarget;
    if (
      event.touches.length !== 2 ||
      ![...event.touches].every((t) => map.contains(t.target))
    )
      return;
    const { distance, point } = geometry(event.touches);
    const anchor = capture(point);
    if (!distance || !anchor) return;
    endPinch();
    pinch = { distance, zoom, anchor };
    suppressClick = true;
    // Ordinary swipes stay native. Only a two-finger map gesture needs a
    // cancellable move listener; do not make all page scrolling wait for JS.
    pinchEvents = new AbortController();
    map.addEventListener("touchmove", movePinch, {
      passive: false,
      signal: pinchEvents.signal,
    });
  }
  function movePinch(event) {
    if (!pinch || event.touches.length !== 2) return;
    if (event.cancelable) event.preventDefault();
    const { distance, point } = geometry(event.touches);
    setZoom((pinch.zoom * distance) / pinch.distance, {
      ...pinch.anchor,
      client: point,
    });
  }
  root.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType !== "touch") suppressClick = false;
    },
    { signal: events.signal },
  );
  root.addEventListener(
    "click",
    (event) => {
      if (
        suppressClick &&
        event.detail !== 0 &&
        event.target.closest(".map-scroll")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClick = false;
      }
    },
    { capture: true, signal: events.signal },
  );
  return {
    capture,
    update,
    step(direction) {
      setZoom((zoom ?? 1) * STEP ** direction);
    },
    destroy() {
      endPinch();
      mapEvents?.abort();
      events.abort();
      observer.disconnect();
    },
  };
}
