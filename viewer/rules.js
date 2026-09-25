import {
  icon as renderIcon,
  token as renderToken,
  iconLabel,
  esc,
} from "./art.js";
import { translateText } from "./localization/index.js";
export function rulesHtml(lang = "en") {
  const t = (text) => translateText(text, lang);
  const icon = (name) => renderIcon(name, t(iconLabel(name)));
  const token = (name, value) =>
    renderToken(name, value, `${t(iconLabel(name))}: ${value}`);
  const message = (text, icons) =>
    esc(t(text)).replace(/\{p(\d+)\}/g, (_, i) => icons[Number(i)]);
  const paragraphs = [
    [
      "A living archipelago",
      message(
        "Over 8 rounds, earn prosperity {p0} through trade, tourism and sand drawings. Every {p1} immediately becomes {p2}.",
        [icon("point"), token("coin", 10), token("point", 5)],
      ),
    ],
    [
      "Plan, then act",
      message(
        "Choose a character, then place your 5 markers in three passes: 2, 2, 1. On your turn, take an action where you have the most markers. Ties follow turn order from the first player {p0}. Retrieve all your markers from that action. If you have no majority on any action, retrieve one stack without acting. You may also choose an impossible action where you hold the majority and retrieve its markers without acting.",
        [icon("first")],
      ),
    ],
    [
      "Be in the right place",
      message(
        "Sail {p0} 1–3 ocean spaces for that many {p1}. Fish {p2} or explore {p3} on your space: take its remaining value, then remove one marker. Island actions need your boat beside the island.",
        [icon("sail"), icon("coin"), icon("fish"), icon("explore")],
      ),
    ],
    [
      "Trade",
      message(
        "Sell fish beside one of your huts {p0}: fish values × the market price. The price falls after each sale. Pay {p4} to export {p1} / {p2} / {p3}, earning {p5} when a ship needs them. Completing a ship earns {p6}.",
        [
          icon("build"),
          icon("kava"),
          icon("copra"),
          icon("beef"),
          token("coin", "1 / 2 / 3"),
          token("point", "1 / 3 / 5"),
          token("point", 2),
        ],
      ),
    ],
    [
      "Develop the islands",
      message(
        "A hut {p0} costs {p1}. A drawing {p2} earns {p3}. Transporting a tourist {p4} earns {p5} for every hut on that island, of any colour. Rest {p6} lets you choose a secret bonus, resolved at the end of the round.",
        [
          icon("build"),
          token("coin", 3),
          icon("draw"),
          token("point", 3),
          icon("tourist"),
          token("coin", 1),
          icon("rest"),
        ],
      ),
    ],
    [
      "Characters",
      message(
        "Each character improves one action, once per round. Choose your next character before returning your old one; you cannot keep the same character for consecutive rounds. Treasures {p0} may be sold at any time for their value in {p1}.",
        [icon("explore"), icon("coin")],
      ),
    ],
    [
      "Final scoring",
      message(
        "After round 8: remaining fish → their value in {p0}; first player → {p1}; every {p2} → {p3}; treasures → twice their value in {p4}; each hut → {p5} per tourist on its island. Most prosperity wins; ties favour more huts, then more vatus.",
        [
          icon("coin"),
          token("point", 3),
          token("coin", 3),
          token("point", 1),
          icon("point"),
          token("point", 2),
        ],
      ),
    ],
    [
      "Two players",
      `Place 2, then 3 neutral markers before choosing characters. You must also beat the neutral stack to act; the matching character lets you tie it. Available characters change each round. Boats cannot end their movement on the same space.`,
    ],
    [
      "Rising Waters",
      message(
        "On even rounds, the die gives the number of actions before flooding. Every adjacent ocean coast without a dike adds 1 water. Build a dike {p0} for {p1} with the Build action. At 5 waters an island sinks; if 3 islands sink, everyone loses. Each hut on an island with 1 / 2 / 3 / 4 waters loses 1 / 3 / 5 / 7 prosperity at game end.",
        [icon("dike"), token("coin", 1)],
      ),
    ],
  ];
  return `<div class="rules">${paragraphs.map(([h, p]) => `<section><h3>${esc(t(h))}</h3><p translate="no">${p.includes("<") ? p : esc(t(p))}</p></section>`).join("")}</div><p class="rules-links"><a href="https://www.quined.nl/wp-content/uploads/2019/01/Vanuatu_Rulebook_${lang === "fr" ? "FR-WEBversion" : "UK_WEBversion-4"}.pdf" target="_blank" rel="noopener">${esc(t("Original rulebook"))} ↗</a> · <a href="https://quined.nl/wp-content/uploads/2017/06/Vanuatu2p_EN.pdf" target="_blank" rel="noopener">${esc(t("Two-player rules"))} ↗</a></p>`;
}
