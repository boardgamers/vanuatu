const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const STEP = 1.25;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function mountMapZoom(root) {
  let zoom,
    observed,
    pinch,
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
    zoom ??= map.clientWidth < 700 ? 1.5 : 1;
    const scale = Math.min(f.width / box.width, f.height / box.height) * zoom;
    const width = box.width * scale,
      height = box.height * scale;
    canvas.style.width = `${Math.max(f.width, width)}px`;
    canvas.style.height = `${Math.max(f.height, height)}px`;
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
    map.dataset.zoom = String(zoom);
    if (anchor) {
      const client = anchor.client ?? center(map);
      const actual = anchor.world.matrixTransform(svg.getScreenCTM());
      map.scrollLeft += actual.x - client.x;
      map.scrollTop += actual.y - client.y;
    } else if (initial) {
      map.scrollLeft = (canvas.clientWidth - f.width) / 2;
      map.scrollTop = (canvas.clientHeight - f.height) / 2;
    }
    root
      .querySelector("[data-zoom-out]")
      ?.setAttribute("aria-disabled", String(zoom <= MIN_ZOOM));
    root
      .querySelector("[data-zoom-in]")
      ?.setAttribute("aria-disabled", String(zoom >= MAX_ZOOM));
    if (observed !== map) {
      observer.disconnect();
      observer.observe(map, { box: "border-box" });
      observed = map;
    }
  }
  function setZoom(value, anchor = capture()) {
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
  root.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length === 1) suppressClick = false;
      const el = elements();
      if (
        !el ||
        event.touches.length !== 2 ||
        ![...event.touches].every((t) => el.map.contains(t.target))
      )
        return;
      const { distance, point } = geometry(event.touches);
      const anchor = capture(point);
      if (!distance || !anchor) return;
      pinch = { distance, zoom, anchor };
      suppressClick = true;
      if (event.cancelable) event.preventDefault();
    },
    { passive: false, signal: events.signal },
  );
  root.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType !== "touch") suppressClick = false;
    },
    { signal: events.signal },
  );
  root.addEventListener(
    "touchmove",
    (event) => {
      if (!pinch || event.touches.length !== 2) return;
      if (event.cancelable) event.preventDefault();
      const { distance, point } = geometry(event.touches);
      setZoom((pinch.zoom * distance) / pinch.distance, {
        ...pinch.anchor,
        client: point,
      });
    },
    { passive: false, signal: events.signal },
  );
  for (const type of ["touchend", "touchcancel"])
    root.addEventListener(
      type,
      (event) => {
        if (!pinch || event.touches.length >= 2) return;
        pinch = null;
        if (event.cancelable) event.preventDefault();
      },
      { passive: false, signal: events.signal },
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
      events.abort();
      observer.disconnect();
    },
  };
}
