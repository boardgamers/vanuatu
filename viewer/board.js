import { CELLS, TILES, COLORS, DIRECTIONS } from "../engine/catalog.js";
import { esc, svgIcon, iconLabel } from "./art.js";
import { boardArt } from "./board-assets.js";
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
    language = "en",
    t,
  } = {},
) {
  const fr = language === "fr";
  const label = (name) => iconLabel(name, language);
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
    svg += `<g class="map-cell ${tile ? "occupied" : ""} ${legal ? "legal" : ""} ${selected === c.id ? "selected" : ""}" data-cell="${c.id}" ${legal ? `role="button" tabindex="0" aria-label="${esc(t(tile?.type === "island" ? "island" : "sea"))} ${c.id}"` : ""}>`;
    svg += `<title>${esc(tile ? `${t(tile.type === "island" ? "island" : "sea")} · ${c.id}${tile.submerged ? ` · ${fr ? "Submergé" : "Submerged"}` : ""}` : fr ? "Emplacement de tuile" : "Tile space")}</title><polygon class="cell-surface" points="${hex(c.x, c.y)}"/>`;
    if (tile) {
      svg += `<image href="${boardArt(spec)}" x="${c.x - 111}" y="${c.y - 111}" width="222" height="222" clip-path="url(#cell-${c.q + 2}-${c.r})"/>`;
      if (tile.submerged) {
        svg += `<polygon points="${hex(c.x, c.y)}" fill="#1c708ca6"/>${svgIcon("water", c.x - 25, c.y - 25, 50)}`;
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
                ? `${label(kind)}: ${value} — ${fr ? "prochaine prise sur cette tuile" : "next catch on this tile"}`
                : `${label(kind)}: 0 — ${fr ? "épuisé" : "depleted"}`,
            })),
          );
      } else {
        const goods = Object.entries(tile.goods).filter(([, n]) => n > 0);
        let j = 0;
        for (const [good, n] of goods)
          for (let k = 0; k < n; k++, j++)
            svg += svgIcon(
              good,
              c.x -
                goods.reduce((sum, [, count]) => sum + count, 0) * 14 +
                j * 28,
              c.y + 48,
              29,
              "currentColor",
              `${label(good)} · ${fr ? "disponible à l’export" : "available to export"}`,
              colorBlind,
            );
        const huts = tile.huts;
        for (let i = 0; i < spec.huts; i++) {
          const x = c.x - spec.huts * 16 + i * 32,
            y = c.y - 29;
          const help =
            huts[i] !== undefined
              ? `${label("build")} · ${s.players[huts[i]].name}`
              : fr
                ? "Emplacement de cabane libre"
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
        svg += resourceBadge(c.x, c.y + 10, [
          {
            kind: "tourist",
            value: `${tile.tourists}/${spec.tourists}`,
            help: `${label("tourist")}: ${tile.tourists}/${spec.tourists}`,
          },
          {
            kind: "draw",
            value: tile.drawings,
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
      svg += `<image class="tile-ghost" href="${boardArt(TILES[hoverTile])}" x="${c.x - 103}" y="${c.y - 103}" width="206" height="206" clip-path="url(#cell-${c.q + 2}-${c.r})"/>`;
    if (!tile)
      svg += `<text x="${c.x}" y="${c.y + 7}" class="empty-label">${legal ? "+" : "·"}</text>`;
    svg += `<polygon class="cell-ring" points="${hex(c.x, c.y, 92)}"/>`;
    const boats = s.players
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.boat === c.id);
    for (const [i, { p, i: pi }] of boats.entries()) {
      const row = Math.floor(i / 3);
      const rowSize = Math.min(3, boats.length - row * 3);
      const x = c.x + ((i % 3) - (rowSize - 1) / 2) * 39,
        y = c.y + (boats.length > 3 ? row * 32 : 11);
      const help = `${fr ? "Bateau" : "Boat"} · ${p.name}`;
      svg += `<g class="boat ${pi === player ? "own" : ""}" transform="translate(${x - 24} ${y - 24})" style="color:${p.color}" filter="url(#boat-shadow)"><title>${esc(help)}</title>${svgIcon("sail", 0, 0, 48, p.color, help)}${colorBlind ? `<text x="25" y="40" class="color-symbol">${symbols[pi]}</text>` : ""}</g>`;
    }
    svg += "</g>";
  }
  return svg + "</svg>";
}
