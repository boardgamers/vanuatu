import { esc, icon } from "./art.js";
import { resolveLocale } from "./localization/runtime.js";

// Only authored explanatory prose uses this formatter, never player names, chat,
// inputs or HTML. Translate the complete sentence first, then replace whole terms.
// Include grammatical forms used by the catalogues; longest phrases win.
const terms = {
  en: ["vatus|vatu", "prosperity points|prosperity", "Build", "Draw"],
  fr: [
    "vatus|vatu",
    "points de prospérité|point de prospérité|prospérité",
    "Construire",
    "Dessiner",
  ],
  de: [
    "Vatus|Vatu",
    "Wohlstandspunkte|Wohlstandspunkten|Wohlstands|Wohlstand",
    "Bauen",
    "Zeichnen",
  ],
  nl: ["vatus|vatu", "welvaartspunten|welvaart", "Bouwen", "Tekenen"],
  da: ["vatus|vatu", "velstandspoint|velstand", "Byg", "Tegn"],
  it: [
    "vatus|vatu",
    "punti prosperità|punti di prosperità|prosperità",
    "Costruisci|Costruire",
    "Disegnare|Disegna",
  ],
  "pt-BR": [
    "vatus|vatu",
    "pontos de prosperidade|ponto de prosperidade|prosperidade",
    "Construir",
    "Desenhar",
  ],
  pl: [
    "vatus|vatu",
    "punkty dobrobytu|punktów dobrobytu|dobrobytu|dobrobyt",
    "Buduj|Budowa|Budowy|Budowę",
    "Rysuj|Rysowanie|Rysowania",
  ],
  ro: [
    "vatus|vatu",
    "puncte de prosperitate|prosperitate",
    "Construiește|Construcție",
    "Desenează|Desen",
  ],
  ru: [
    "вату",
    "очки процветания|очков процветания|процветания|процветание",
    "Строить|Строительство|Строительства",
    "Рисовать|Рисование|Рисования",
  ],
  el: [
    "βάτου",
    "πόντοι ευημερίας|πόντους ευημερίας|ευημερία|ευημερίας",
    "Χτίσε|Κατασκευή|Κατασκευής",
    "Σχεδίαση|Σχέδιο|Σχεδίου",
  ],
  hi: ["वातु", "समृद्धि अंक|समृद्धि", "निर्माण", "चित्र बनाएँ|चित्र"],
  ko: ["바투", "번영 점수|번영", "건설", "모래그림|그림"],
  "zh-TW": ["瓦圖", "繁榮點數|繁榮分數|繁榮", "建造", "沙畫"],
  vi: ["vatus|vatu", "điểm thịnh vượng|thịnh vượng", "Xây dựng|Xây", "Vẽ"],
  fa: ["واتو|واتوی", "امتیاز شکوفایی|شکوفایی|رفاه", "ساخت", "نقاشی"],
};
const cache = new Map();
const escapePattern = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function vocabulary(locale) {
  if (cache.has(locale)) return cache.get(locale);
  const names = ["coin", "point", "build", "draw"];
  const words = new Map(
    (terms[locale] ?? terms.en).flatMap((group, i) =>
      group.split("|").map((word) => [word.toLowerCase(), names[i]]),
    ),
  );
  const body = [...words.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapePattern)
    .join("|");
  // Korean particles and Chinese words have no separating spaces. Numbers can
  // touch a unit in any language (e.g. 0바투); letters in other words cannot.
  const boundary = ["ko", "zh-TW"].includes(locale) ? "" : "[\\p{L}\\p{M}]";
  const pattern = new RegExp(
    `${boundary ? `(?<!${boundary})` : ""}(?:${body})${boundary ? `(?!${boundary})` : ""}`,
    "giu",
  );
  const result = { words, pattern };
  cache.set(locale, result);
  return result;
}
export function pictogramText(text, locale = "en") {
  const { words, pattern } = vocabulary(resolveLocale(locale));
  let result = "",
    end = 0;
  for (const match of String(text).matchAll(pattern)) {
    const label = match[0],
      name = words.get(label.toLowerCase());
    result += esc(text.slice(end, match.index));
    result += `<span class="prose-icon" role="img" aria-label="${esc(label)}" title="${esc(label)}">${icon(name, label)}</span>`;
    end = match.index + label.length;
  }
  return result + esc(text.slice(end));
}
