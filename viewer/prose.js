import { esc, icon } from "./art.js";
import { resolveLocale } from "./localization/runtime.js";

// Only authored explanatory prose uses this formatter, never player names, chat,
// inputs or HTML. Translate the complete sentence first, then replace whole terms.
// Include grammatical forms used by the catalogues; longest phrases win.
const terms = {
  en: [
    "vatus|vatu",
    "prosperity points|prosperity",
    "Build",
    "Draw",
    "first player",
  ],
  fr: [
    "vatus|vatu",
    "points de prospérité|point de prospérité|prospérité",
    "Construire",
    "Dessiner",
    "premier joueur",
  ],
  de: [
    "Vatus|Vatu",
    "Wohlstandspunkte|Wohlstandspunkten|Wohlstands|Wohlstand",
    "Bauen",
    "Zeichnen",
    "Startspieler|Startspielers",
  ],
  nl: [
    "vatus|vatu",
    "welvaartspunten|welvaart",
    "Bouwen",
    "Tekenen",
    "startspeler",
  ],
  da: [
    "vatus|vatu",
    "velstandspoint|velstand",
    "Byg",
    "Tegn",
    "startspiller|startspilleren|startspillerens",
  ],
  it: [
    "vatus|vatu",
    "punti prosperità|punti di prosperità|prosperità",
    "Costruisci|Costruire",
    "Disegnare|Disegna",
    "primo giocatore",
  ],
  "pt-BR": [
    "vatus|vatu",
    "pontos de prosperidade|ponto de prosperidade|prosperidade",
    "Construir",
    "Desenhar",
    "primeiro jogador",
  ],
  pl: [
    "vatus|vatu",
    "punkty dobrobytu|punktów dobrobytu|dobrobytu|dobrobyt",
    "Buduj|Budowa|Budowy|Budowę",
    "Rysuj|Rysowanie|Rysowania",
    "pierwszy gracz|pierwszego gracza|pierwszym graczem|gracz rozpoczynający|gracza rozpoczynającego",
  ],
  ro: [
    "vatus|vatu",
    "puncte de prosperitate|prosperitate",
    "Construiește|Construcție",
    "Desenează|Desen",
    "primul jucător|primului jucător",
  ],
  ru: [
    "вату",
    "очки процветания|очков процветания|процветания|процветание",
    "Строить|Строительство|Строительства",
    "Рисовать|Рисование|Рисования",
    "первый игрок|первого игрока|первым игроком|первому игроку",
  ],
  el: [
    "βάτου",
    "πόντοι ευημερίας|πόντους ευημερίας|ευημερία|ευημερίας",
    "Χτίσε|Κατασκευή|Κατασκευής",
    "Σχεδίαση|Σχέδιο|Σχεδίου",
    "πρώτος παίκτης|πρώτο παίκτη|πρώτου παίκτη",
  ],
  hi: [
    "वातु",
    "समृद्धि अंक|समृद्धि",
    "निर्माण",
    "चित्र बनाएँ|चित्र",
    "पहला खिलाड़ी|पहले खिलाड़ी|प्रथम खिलाड़ी",
  ],
  ko: [
    "바투",
    "번영 점수|번영",
    "건설",
    "모래그림|그림",
    "선 플레이어|시작 플레이어",
  ],
  "zh-TW": ["瓦圖", "繁榮點數|繁榮分數|繁榮", "建造", "沙畫", "起始玩家"],
  vi: [
    "vatus|vatu",
    "điểm thịnh vượng|thịnh vượng",
    "Xây dựng|Xây",
    "Vẽ",
    "người chơi đầu tiên|người chơi đầu",
  ],
  fa: [
    "واتو|واتوی",
    "امتیاز شکوفایی|شکوفایی|رفاه",
    "ساخت",
    "نقاشی",
    "بازیکن اول",
  ],
};
const goods = {
  en: ["kava", "copra", "beef"],
  fr: ["kava", "coprah|copra", "bœuf|boeuf"],
  de: ["Kava", "Kopra", "Rindfleisch"],
  nl: ["kava", "kopra", "rundvlees"],
  da: ["kava", "kopra|kopraen", "oksekød"],
  it: ["kava", "copra", "manzo"],
  "pt-BR": ["kava", "copra", "boi"],
  pl: [
    "kava|kavy|kavę|kavą",
    "kopra|kopry|koprę|koprą",
    "wołowina|wołowiny|wołowinę|wołowiną",
  ],
  ro: ["kava", "copra", "vită|vita"],
  ru: [
    "кава|кавы|каву|кавой",
    "копра|копры|копру|копрой",
    "говядина|говядины|говядину|говядиной",
  ],
  el: ["κάβα", "κόπρα", "μοσχάρι"],
  hi: ["कावा", "खोपरा|खोपरे", "गोमांस"],
  ko: ["카바", "코프라", "소고기"],
  "zh-TW": ["卡瓦", "椰乾", "牛肉"],
  vi: ["kava", "cùi dừa khô", "thịt bò"],
  fa: ["کاوا", "مغز خشک نارگیل", "گوشت گاو"],
};
const cache = new Map();
const escapePattern = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function vocabulary(locale) {
  if (cache.has(locale)) return cache.get(locale);
  const names = [
    "coin",
    "point",
    "build",
    "draw",
    "first",
    "kava",
    "copra",
    "beef",
  ];
  const words = new Map(
    [...(terms[locale] ?? terms.en), ...(goods[locale] ?? goods.en)].flatMap(
      (group, i) =>
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
export function pictogramText(text, locale = "en", colorBlind = false) {
  const { words, pattern } = vocabulary(resolveLocale(locale));
  let result = "",
    end = 0;
  for (const match of String(text).matchAll(pattern)) {
    const label = match[0],
      name = words.get(label.toLowerCase());
    result += esc(text.slice(end, match.index));
    result += `<span class="prose-icon" role="img" aria-label="${esc(label)}" title="${esc(label)}">${icon(name, label, false, colorBlind)}</span>`;
    end = match.index + label.length;
  }
  return result + esc(text.slice(end));
}
