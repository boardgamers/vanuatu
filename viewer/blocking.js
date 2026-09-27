import { markerBlockers } from "../engine/marker-blockers.js";
import { BLOCKED, TIE, IMPOSSIBLE } from "./learning.js";
import { translateText } from "./localization/index.js";
import { esc } from "./art.js";
export function blockingText(s, p, action, lang, saved) {
  const blockers = saved ?? markerBlockers(s, p, action);
  const t = (text) => translateText(text, lang);
  return blockers.length
    ? `${t(BLOCKED)}: ${blockers.map((b) => `${b.neutral ? t("Neutral markers") : s.players[b.p].name} (${b.count})${b.tied ? ` — ${t(TIE)}` : ""}`).join("; ")}`
    : t(IMPOSSIBLE);
}
export function blockingHtml(s, p, action, lang, saved) {
  return esc(blockingText(s, p, action, lang, saved));
}
