const DEFAULT_ZOOM = 1;
const MAX_ZOOM = 4;
const STEP = 1.25;
const READABLE_TILE_SCALE = 0.5;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function mountMapZoom(root) {
  let zoom,
    minZoom = 1,
    observed,
    pinch,
    drag,
    mapEvents,
    pinchEvents,
    dragEvents,
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
  const canPan = (map) =>
    map.scrollWidth > map.clientWidth + 1 ||
    map.scrollHeight > map.clientHeight + 1;
  function updatePanCursor(map) {
    const state =
      drag?.map === map && drag.moving
        ? "dragging"
        : canPan(map)
          ? "ready"
          : "none";
    if (map.dataset.pan !== state) map.dataset.pan = state;
  }
  function frame(map) {
    const css = getComputedStyle(map),
      rect = map.getBoundingClientRect();
    const left = parseFloat(css.paddingLeft),
      top = parseFloat(css.paddingTop);
    const width = map.clientWidth - left - parseFloat(css.paddingRight);
    const height = map.clientHeight - top - parseFloat(css.paddingBottom);
    return {
      x: rect.left + left,
      y: rect.top + top,
      width,
      height,
      top,
      bottom: parseFloat(css.paddingBottom),
    };
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
    const [x, y, w, h] = svg.dataset.focusBox.split(" ").map(Number);
    const active = { x, y, width: w, height: h };
    if (f.width <= 0 || f.height <= 0) return;
    const initial = zoom === undefined;
    const fitScale = Math.min(f.width / active.width, f.height / active.height);
    const overviewScale = Math.min(f.width / box.width, f.height / box.height);
    minZoom = Math.min(DEFAULT_ZOOM, overviewScale / fitScale);
    if (autoFit) {
      // Fit desktop panels even when narrow; on phones keep 176-unit tiles
      // at least 88px wide so their resource badges remain readable.
      zoom = matchMedia("(max-width: 700px)").matches
        ? clamp(READABLE_TILE_SCALE / fitScale, DEFAULT_ZOOM, MAX_ZOOM)
        : DEFAULT_ZOOM;
      if (f.width >= 900) {
        // Wide panels leave room between the corner controls. Use the spare
        // vertical padding for a closer view, while keeping the active tiles
        // above the action tray and at least 12px from the viewport edges.
        const trayHeight =
          root.querySelector(".turn-tray")?.getBoundingClientRect().height ?? 0;
        const extra = Math.max(
          0,
          Math.min(f.top - 12, f.bottom - trayHeight - 12),
        );
        const closeScale = Math.min(
          f.width / active.width,
          (f.height + 2 * extra) / active.height,
        );
        zoom = clamp(closeScale / fitScale, DEFAULT_ZOOM, STEP);
      }
    } else zoom = clamp(zoom, minZoom, MAX_ZOOM);
    const scale = fitScale * zoom;
    const width = box.width * scale,
      height = box.height * scale;
    // Leave enough room to center an off-center cluster of active tiles, even
    // when the full map fits along one axis. At overview, remove that room so
    // the whole board fits without leaving an unnecessary scrollable area.
    const focus = zoom <= minZoom + 0.000001 ? box : active;
    const canvasSize = (size, viewport, middle) =>
      Math.max(
        viewport,
        size + 2 * Math.max(0, viewport / 2 - Math.min(middle, size - middle)),
      );
    let resized = false;
    for (const [node, property, value] of [
      [
        canvas,
        "width",
        canvasSize(width, f.width, (focus.x + focus.width / 2 - box.x) * scale),
      ],
      [
        canvas,
        "height",
        canvasSize(
          height,
          f.height,
          (focus.y + focus.height / 2 - box.y) * scale,
        ),
      ],
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
      svg.dataset.focusBox,
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
      const middle = new DOMPoint(
        active.x + active.width / 2,
        active.y + active.height / 2,
      ).matrixTransform(svg.getScreenCTM());
      map.scrollLeft += middle.x - (f.x + f.width / 2);
      map.scrollTop += middle.y - (f.y + f.height / 2);
    }
    layoutKey = nextLayout;
    updatePanCursor(map);
    for (const [selector, disabled] of [
      ["[data-zoom-out]", zoom <= minZoom + 0.000001],
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
      endDrag();
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
      map.addEventListener("pointerdown", startDrag, {
        passive: true,
        signal: mapEvents.signal,
      });
      map.addEventListener("dragstart", (event) => event.preventDefault(), {
        signal: mapEvents.signal,
      });
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
    endDrag();
    autoFit = false;
    zoom = clamp(value, minZoom, MAX_ZOOM);
    update(anchor);
  }
  function endDrag(event) {
    if (
      !drag ||
      (event?.pointerId !== undefined && event.pointerId !== drag.id)
    )
      return;
    const { map, id } = drag;
    drag = null;
    dragEvents?.abort();
    dragEvents = null;
    if (map.hasPointerCapture(id)) map.releasePointerCapture(id);
    updatePanCursor(map);
  }
  function startDrag(event) {
    const map = event.currentTarget;
    if (event.pointerType !== "mouse" || event.button !== 0 || !canPan(map))
      return;
    const rect = map.getBoundingClientRect();
    // Leave native scrollbar drags alone.
    if (
      event.clientX >= rect.left + map.clientWidth ||
      event.clientY >= rect.top + map.clientHeight
    )
      return;
    endDrag();
    drag = {
      map,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: map.scrollLeft,
      top: map.scrollTop,
      moving: false,
    };
    dragEvents = new AbortController();
    const options = { signal: dragEvents.signal };
    const doc = map.ownerDocument;
    doc.addEventListener("pointermove", moveDrag, {
      ...options,
      passive: false,
    });
    doc.addEventListener("pointerup", endDrag, options);
    doc.addEventListener("pointercancel", endDrag, options);
    map.addEventListener("lostpointercapture", endDrag, options);
    doc.defaultView.addEventListener("blur", endDrag, options);
  }
  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (!(event.buttons & 1)) {
      endDrag(event);
      return;
    }
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (!drag.moving) {
      // Small hand movements still count as an ordinary tile click.
      if (Math.hypot(dx, dy) < 5) return;
      drag.moving = true;
      suppressClick = true;
      drag.map.setPointerCapture(drag.id);
      updatePanCursor(drag.map);
    }
    event.preventDefault();
    drag.map.scrollLeft = drag.left - dx;
    drag.map.scrollTop = drag.top - dy;
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
      endDrag();
      mapEvents?.abort();
      events.abort();
      observer.disconnect();
    },
  };
}
