import { boardCells, tileState, TILES, COLORS } from "../engine/catalog.js";
import { esc, svgIcon, iconLabel } from "./art.js";
import { boardArt } from "./board-assets.js";
const tilt = (20 * Math.PI) / 180;
const rotate = (x, y) => ({
  x: x * Math.cos(tilt) - y * Math.sin(tilt),
  y: x * Math.sin(tilt) + y * Math.cos(tilt),
});
export const center = (id) => {
  const [q, r] = id.split(",").map(Number);
  const p = rotate(q * 162 - r * 81, r * 140.3);
  return { x: 355 + p.x, y: 150 + p.y };
};
// Opposite sides share the same S-curve, so neighbouring tiles interlock.
// Use the board spacing directly to keep their vertices and curves identical.
function tilePath(x, y) {
  const h = 140.3 / 3;
  const vertices = [
    [81, -h],
    [81, h],
    [0, 2 * h],
    [-81, h],
    [-81, -h],
    [0, -2 * h],
  ].map(([dx, dy]) => {
    const p = rotate(dx, dy);
    return { x: x + p.x, y: y + p.y };
  });
  let path = `M${vertices[0].x},${vertices[0].y}`;
  for (let i = 0; i < 6; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % 6];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const bend = 0.28;
    path += `C${a.x + dx / 3 - dy * bend},${a.y + dy / 3 + dx * bend} ${a.x + (2 * dx) / 3 + dy * bend},${a.y + (2 * dy) / 3 - dx * bend} ${b.x},${b.y}`;
  }
  return path + "Z";
}
const symbols = ["●", "◆", "▲", "■", "✦"];
function tileImage(spec, c, ghost = false, prefix = "board") {
  const clip = `url(#${prefix}-cell-${c.q + 2}-${c.r})`;
  const ocean = `<image href="${boardArt({ type: "sea" })}" x="${c.x - 111}" y="${c.y - 111}" width="222" height="222"/>`;
  const art =
    spec.type === "island"
      ? `<image href="${boardArt(spec)}" x="${c.x - 88}" y="${c.y - 88}" width="176" height="176"/>`
      : "";
  return `<g ${ghost ? 'class="tile-ghost"' : ""} clip-path="${clip}" pointer-events="none">${ocean}${art}</g>`;
}
function resourceBadge(x, y, items) {
  const widths = items.map(({ value }) => 34 + String(value).length * 11);
  const width = widths.reduce((a, b) => a + b, 0) + 8;
  let offset = x - width / 2 + 4;
  return `<g class="resource-badge"><rect x="${x - width / 2}" y="${y}" width="${width}" height="30" rx="15" fill="#fff9dfed"/>${items
    .map(({ kind, value, help }, i) => {
      const left = offset;
      offset += widths[i];
      return `<g><title>${esc(help)}</title><rect x="${left}" y="${y}" width="${widths[i]}" height="30" fill="transparent"/>${svgIcon(kind, left, y + 3, 24)}<text x="${left + 29}" y="${y + 21}" class="resource-n">${esc(value)}</text></g>`;
    })
    .join("")}</g>`;
}
export function boardSvg(
  s,
  {
    selected,
    targets = [],
    hoverTile,
    player,
    colorBlind = false,
    overview = false,
    preview = false,
    prefix = "board",
    language = "en",
    t,
  } = {},
) {
  const label = (name) => iconLabel(name, language);
  const targetSet = new Set(targets);
  const all = boardCells(s)
    .filter((c) => !preview || s.board[c.id])
    .map((c) => ({ ...c, ...center(c.id) }));
  const visible = overview
    ? all
    : all.filter((c) => s.board[c.id] || targetSet.has(c.id));
  const x0 = Math.min(...visible.map((c) => c.x)) - 120,
    x1 = Math.max(...visible.map((c) => c.x)) + 120,
    y0 = Math.min(...visible.map((c) => c.y)) - 120,
    y1 = Math.max(...visible.map((c) => c.y)) + 120;
  const defs = all
    .map(
      (c) =>
        `<clipPath id="${prefix}-cell-${c.q + 2}-${c.r}"><path d="${tilePath(c.x, c.y)}"/></clipPath>`,
    )
    .join("");
  let svg = `<svg class="${preview ? "tile-art" : "archipelago"}${overview ? " overview" : ""}" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" role="group" aria-label="${preview ? esc(t(s.board["0,0"].type === "island" ? "island" : "sea")) : "Vanuatu"}"><defs>${defs}<filter id="${prefix}-boat-shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="0" stdDeviation=".9" flood-color="#fff9df" flood-opacity="1"/><feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-opacity=".45"/></filter></defs>`;
  for (const c of all) {
    const tile = s.board[c.id],
      legal = targetSet.has(c.id),
      spec = tile ? TILES[tile.id] : null;
    svg += `<g class="map-cell ${tile ? "occupied" : ""} ${legal ? "legal" : ""} ${selected === c.id ? "selected" : ""}" ${preview ? "" : `data-cell="${c.id}"`} ${legal ? `role="button" tabindex="0" aria-label="${esc(t(tile?.type === "island" ? "island" : "sea"))} ${c.id}"` : ""}>`;
    svg += `<title>${esc(tile ? `${t(tile.type === "island" ? "island" : "sea")} · ${c.id}${tile.submerged ? ` · ${"Submerged"}` : ""}` : "Tile space")}</title><path class="cell-surface" d="${tilePath(c.x, c.y)}"/>`;
    if (tile) {
      svg += tileImage(spec, c, false, prefix);
      if (tile.submerged) {
        svg += `<path d="${tilePath(c.x, c.y)}" fill="#1c708ca6"/>${svgIcon("water", c.x - 25, c.y - 25, 50)}`;
      } else if (tile.type === "sea") {
        const res = [
          ...(spec.fish ? [["fish", tile.fish]] : []),
          ...(spec.treasure ? [["explore", tile.treasure]] : []),
        ];
        if (res.length)
          svg += resourceBadge(
            c.x,
            c.y - 52,
            res.map(([kind, value]) => ({
              kind,
              value,
              help: value
                ? `${label(kind)}: ${value} — ${"next catch on this tile"}`
                : `${label(kind)}: 0 — ${"depleted"}`,
            })),
          );
      } else {
        const goods = Object.entries(tile.goods).filter(([, n]) => n > 0);
        svg += '<g class="island-goods">';
        let j = 0;
        for (const [good, n] of goods)
          for (let k = 0; k < n; k++, j++)
            svg += svgIcon(
              good,
              c.x -
                goods.reduce((sum, [, count]) => sum + count, 0) * 14 +
                j * 28,
              c.y + 34,
              29,
              "currentColor",
              `${label(good)} · ${"available to export"}`,
              colorBlind,
            );
        svg += "</g>";
        const huts = tile.huts;
        for (let i = 0; i < spec.huts; i++) {
          const x = c.x - spec.huts * 16 + i * 32,
            y = c.y - 29;
          const help =
            huts[i] !== undefined
              ? `${label("build")} · ${s.players[huts[i]].name}`
              : "Empty hut space";
          svg += `<g><title>${esc(help)}</title>`;
          svg +=
            huts[i] !== undefined
              ? svgIcon("build", x, y, 30, COLORS[huts[i]], help)
              : `<rect x="${x + 3}" y="${y + 5}" width="24" height="23" rx="4" fill="#ffffff77" stroke="#786344" stroke-dasharray="3 2"/>`;
          if (colorBlind && huts[i] !== undefined)
            svg += `<text x="${x + 16}" y="${y + 26}" class="color-symbol">${symbols[huts[i]]}</text>`;
          svg += "</g>";
        }
        svg += resourceBadge(c.x, c.y + 4, [
          {
            kind: "tourist",
            value: `${tile.tourists}/${spec.tourists}`,
            help: `${label("tourist")}: ${tile.tourists}/${spec.tourists}`,
          },
          {
            kind: "draw",
            value: preview
              ? `${tile.drawings}/${spec.drawings}`
              : tile.drawings,
            help: `${label("draw")}: ${tile.drawings}/${spec.drawings}`,
          },
        ]);
        if (tile.water)
          svg += `<g><title>${esc(`${label("water")}: ${tile.water}`)}</title>${svgIcon("water", c.x - 74, c.y - 20, 25)}<text x="${c.x - 59}" y="${c.y + 20}" class="resource-n">${tile.water}</text></g>`;
        for (const edge of tile.dikes) {
          const o = center(edge);
          const dx = o.x - c.x,
            dy = o.y - c.y;
          const mx = c.x + dx * 0.48,
            my = c.y + dy * 0.48,
            l = Math.hypot(dx, dy);
          svg += `<g><title>${esc(label("dike"))}</title><line x1="${mx - (dy / l) * 22}" y1="${my + (dx / l) * 22}" x2="${mx + (dy / l) * 22}" y2="${my - (dx / l) * 22}" stroke="#654429" stroke-width="9" stroke-linecap="round"/><line x1="${mx - (dy / l) * 22}" y1="${my + (dx / l) * 22}" x2="${mx + (dy / l) * 22}" y2="${my - (dx / l) * 22}" stroke="#d1aa67" stroke-width="5" stroke-linecap="round"/></g>`;
        }
      }
    } else if (hoverTile && legal)
      svg += tileImage(TILES[hoverTile], c, true, prefix);
    if (!tile)
      svg += `<text x="${c.x}" y="${c.y + 7}" class="empty-label">${legal ? "+" : "·"}</text>`;
    svg += `<path class="cell-ring" d="${tilePath(c.x, c.y)}"/>`;
    const boats = s.players
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.boat === c.id);
    for (const [i, { p, i: pi }] of boats.entries()) {
      const row = Math.floor(i / 3);
      const rowSize = Math.min(3, boats.length - row * 3);
      const x = c.x + ((i % 3) - (rowSize - 1) / 2) * 39,
        y = c.y + (boats.length > 3 ? row * 32 : 11);
      const help = `${"Boat"} · ${p.name}`;
      svg += `<g class="boat ${pi === player ? "own" : ""}" transform="translate(${x - 24} ${y - 24})" style="color:${p.color}" filter="url(#${prefix}-boat-shadow)"><title>${esc(help)}</title>${svgIcon("sail", 0, 0, 48, p.color, help)}${colorBlind ? `<text x="25" y="40" class="color-symbol">${symbols[pi]}</text>` : ""}</g>`;
    }
    svg += "</g>";
  }
  return svg + "</svg>";
}

export function tilePreviewSvg(id, options) {
  return boardSvg(
    { boardLayout: 2, board: { "0,0": tileState(id) }, players: [] },
    { ...options, preview: true, prefix: `preview-${id}` },
  );
}
