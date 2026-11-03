import { PRICES, VALUES } from "../engine/catalog.js";
import { esc, icon, token } from "./art.js";

const names = { kava: "Kava", copra: "Copra", beef: "Beef" };

export function exportGoodHelp(good, state = "available") {
  if (state === "delivered") return `${names[good]}: already delivered`;
  if (state === "empty") return `${names[good]}: empty`;
  return `${names[good]}: −${PRICES[good]} vatus → +${VALUES[good]} prosperity`;
}

export function exportReference(colorBlind = false) {
  const completionHelp = "Completing a ship adds 2 to the good's reward.";
  const amount = (kind, value, help) =>
    value === 1 ? icon(kind, help) : token(kind, value, help);
  return `<div class="export-reference" role="group" aria-label="Export goods">${Object.keys(
    PRICES,
  )
    .map((good) => {
      const help = exportGoodHelp(good);
      return `<span class="export-rate" role="img" aria-label="${esc(help)}" title="${esc(help)}">${icon(good, help, false, colorBlind)}${amount("coin", PRICES[good], help)}<span class="export-arrow" aria-hidden="true">→</span>${amount("point", VALUES[good], help)}</span>`;
    })
    .join(
      "",
    )}<span class="export-completion" title="${esc(completionHelp)}"><span class="completed-ship" role="img" aria-label="Complete">${icon("buy", completionHelp)}${icon("check", completionHelp)}</span><span aria-hidden="true">→</span>${token("point", 2)}</span></div>`;
}
