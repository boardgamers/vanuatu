import { CELLS, TILES, COLORS, DIRECTIONS } from "../engine/catalog.js";
import { assets } from "./assets.js";
import { esc, svgIcon } from "./art.js";
export const center = (id) => {
  const [q, r] = id.split(",").map(Number);
  return { x: 355 + q * 162 - r * 81, y: 150 + r * 140.3 };
};
function hex(x, y, r = 94) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 30) * Math.PI) / 180;
    return `${x + Math.cos(a) * r},${y + Math.sin(a) * r}`;
  }).join(" ");
}
const symbols = ["●", "◆", "▲", "■", "✦"];
export function boardSvg(
  s,
  { selected, targets = [], hoverTile, player, colorBlind = false, t } = {},
) {
  const targetSet = new Set(targets);
  const all = CELLS.map((c) => ({ ...c, ...center(c.id) }));
  const visible = all.filter((c) => s.board[c.id] || targetSet.has(c.id));
  const x0 = Math.min(...visible.map((c) => c.x)) - 120,
    x1 = Math.max(...visible.map((c) => c.x)) + 120,
    y0 = Math.min(...visible.map((c) => c.y)) - 120,
    y1 = Math.max(...visible.map((c) => c.y)) + 120;
  const defs = all
    .map(
      (c) =>
        `<clipPath id="cell-${c.q + 2}-${c.r}"><polygon points="${hex(c.x, c.y)}"/></clipPath>`,
    )
    .join("");
  let svg = `<svg class="archipelago" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" role="group" aria-label="Vanuatu"><defs>${defs}<filter id="boat-shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".3"/></filter></defs>`;
  for (const c of all) {
    const tile = s.board[c.id],
      legal = targetSet.has(c.id),
      spec = tile ? TILES[tile.id] : null;
    svg += `<g class="map-cell ${legal ? "legal" : ""} ${selected === c.id ? "selected" : ""}" data-cell="${c.id}" ${legal ? `role="button" tabindex="0" aria-label="${esc(t(tile?.type === "island" ? "island" : "sea"))} ${c.id}"` : ""}>`;
    svg += `<polygon class="cell-surface" points="${hex(c.x, c.y)}"/>`;
    if (tile) {
      svg += `<image href="${assets[spec.art]}" x="${c.x - 111}" y="${c.y - 111}" width="222" height="222" clip-path="url(#cell-${c.q + 2}-${c.r})"/>`;
      if (tile.submerged) {
        svg += `<polygon points="${hex(c.x, c.y)}" fill="#1c708ca6"/>${svgIcon("water", c.x - 25, c.y - 25, 50)}`;
      } else if (tile.type === "sea") {
        const res = [
          ...(spec.fish ? [["fish", tile.fish]] : []),
          ...(spec.treasure ? [["explore", tile.treasure]] : []),
        ];
        if (res.length)
          svg += `<rect x="${c.x - 16}" y="${c.y - 85}" width="92" height="40" rx="18" fill="#edf5ddec"/>`;
        for (const [i, [kind, n]] of res.entries()) {
          const x = c.x + 30 - (res.length * 45) / 2 + i * 45;
          svg += `<rect x="${x - 6}" y="${c.y - 80}" width="44" height="29" rx="14" fill="#fff9dfeb"/>${svgIcon(kind, x - 4, c.y - 80, 27)}<text x="${x + 26}" y="${c.y - 60}" class="resource-n">${n}</text>`;
        }
      } else {
        const goods = Object.entries(tile.goods).filter(([, n]) => n > 0);
        let j = 0;
        for (const [good, n] of goods)
          for (let k = 0; k < n; k++, j++)
            svg += svgIcon(good, c.x - 45 + j * 28, c.y + 48, 29);
        const huts = tile.huts;
        for (let i = 0; i < spec.huts; i++) {
          const x = c.x - 40 + i * 32,
            y = c.y - 29;
          svg +=
            huts[i] !== undefined
              ? svgIcon("build", x, y, 30, COLORS[huts[i]])
              : `<rect x="${x + 3}" y="${y + 5}" width="24" height="23" rx="4" fill="#ffffff77" stroke="#786344" stroke-dasharray="3 2"/>`;
          if (colorBlind && huts[i] !== undefined)
            svg += `<text x="${x + 16}" y="${y + 26}" class="color-symbol">${symbols[huts[i]]}</text>`;
        }
        svg += `<rect x="${c.x - 44}" y="${c.y + 10}" width="88" height="28" rx="14" fill="#fff9dfeb"/>${svgIcon("tourist", c.x - 42, c.y + 11, 24)}<text x="${c.x - 17}" y="${c.y + 30}" class="resource-n">${tile.tourists}/${spec.tourists}</text>${svgIcon("draw", c.x + 7, c.y + 13, 22)}<text x="${c.x + 32}" y="${c.y + 30}" class="resource-n">${tile.drawings}</text>`;
        if (tile.water)
          svg += `${svgIcon("water", c.x - 74, c.y - 20, 25)}<text x="${c.x - 59}" y="${c.y + 20}" class="resource-n">${tile.water}</text>`;
        for (const edge of tile.dikes) {
          const o = center(edge);
          const dx = o.x - c.x,
            dy = o.y - c.y;
          const mx = c.x + dx * 0.48,
            my = c.y + dy * 0.48,
            l = Math.hypot(dx, dy);
          svg += `<line x1="${mx - (dy / l) * 22}" y1="${my + (dx / l) * 22}" x2="${mx + (dy / l) * 22}" y2="${my - (dx / l) * 22}" stroke="#654429" stroke-width="9" stroke-linecap="round"/><line x1="${mx - (dy / l) * 22}" y1="${my + (dx / l) * 22}" x2="${mx + (dy / l) * 22}" y2="${my - (dx / l) * 22}" stroke="#d1aa67" stroke-width="5" stroke-linecap="round"/>`;
        }
      }
    } else if (hoverTile && legal)
      svg += `<image class="tile-ghost" href="${assets[TILES[hoverTile].art]}" x="${c.x - 103}" y="${c.y - 103}" width="206" height="206" clip-path="url(#cell-${c.q + 2}-${c.r})"/>`;
    if (!tile)
      svg += `<text x="${c.x}" y="${c.y + 7}" class="empty-label">${legal ? "+" : "·"}</text>`;
    svg += `<polygon class="cell-ring" points="${hex(c.x, c.y, 92)}"/></g>`;
    const boats = s.players
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.boat === c.id);
    for (const [i, { p, i: pi }] of boats.entries()) {
      const x = c.x + (i - (boats.length - 1) / 2) * 37,
        y = c.y + (tile?.type === "sea" ? 11 : 0);
      svg += `<g class="boat ${pi === player ? "own" : ""}" transform="translate(${x - 24} ${y - 24})" style="color:${p.color}" filter="url(#boat-shadow)">${svgIcon("sail", 0, 0, 48, p.color)}${colorBlind ? `<text x="25" y="40" class="color-symbol">${symbols[pi]}</text>` : ""}<title>${esc(p.name)}</title></g>`;
    }
  }
  return svg + "</svg>";
}
