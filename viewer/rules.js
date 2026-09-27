import {
  EXPORT_RULE,
  EXTEND_TITLE,
  EXTEND_RULE,
  ROUND_TITLE,
  ROUND_HELP,
  FIRST_HELP,
  RETRIEVE_HELP,
} from "./learning.js";
import {
  icon as renderIcon,
  token as renderToken,
  iconLabel,
  esc,
} from "./art.js";
import { PRICES, VALUES } from "../engine/catalog.js";
import { translateText } from "./localization/index.js";
export function rulesHtml(lang = "en", colorBlind = false) {
  const t = (text) => translateText(text, lang);
  const icon = (name) =>
    renderIcon(name, t(iconLabel(name)), false, colorBlind);
  const token = (name, value) =>
    renderToken(name, value, `${t(iconLabel(name))}: ${value}`, colorBlind);
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
    [ROUND_TITLE, ROUND_HELP],
    ["First player", FIRST_HELP],
    [EXTEND_TITLE, EXTEND_RULE],
    [
      "Characters",
      message(
        "Each character improves one action, once per round. Choose your next character before returning your old one; you cannot keep the same character for consecutive rounds. Treasures {p0} may be sold at any time for their value in {p1}.",
        [icon("explore"), icon("coin")],
      ),
    ],
    [
      "Five markers, up to five actions",
      "You may place one marker on each of five different actions and perform all five this round, if each is possible. Stacking markers improves your majority, not the number of times you act. Place them in three passes: 2, 2, then 1.",
    ],
    [
      "Plan, then act",
      message(
        "Choose a character, then place your 5 markers in three passes: 2, 2, 1. On your turn, take an action where you have the most markers. Ties follow turn order from the first player {p0}. Retrieve all your markers from that action. If you have no majority on any action, retrieve one stack without acting. You may also choose an impossible action where you hold the majority and retrieve its markers without acting.",
        [icon("first")],
      ),
    ],
    [
      "Two markers beat one",
      "If you have 1 marker on Fish and Maya has 2, Maya can fish before you. Your marker stays there. After she fishes and removes both her markers, you may fish on a later turn if you then have the majority and fish remain.",
    ],
    [
      "When you cannot act",
      "If you cannot afford Build yet, you can choose another action where you have the majority and keep Build for later. Resolving Build now means retrieving its markers without building. If you have no majority anywhere, you must retrieve one stack without acting. When resolving an action you can perform, you must perform it.",
    ],
    ["Retrieve markers", RETRIEVE_HELP],
    [
      "Be in the right place",
      message(
        "Sail {p0} 1–3 ocean spaces for that many {p1}. Fish {p2} or explore {p3} on your space: take its remaining value, then remove one marker. Island actions need your boat beside the island.",
        [icon("sail"), icon("coin"), icon("fish"), icon("explore")],
      ),
    ],
    [
      "Sell fish",
      message(
        "Sell fish beside one of your huts {p0}: fish values × the market price. The price falls after each sale.",
        [icon("build")],
      ),
    ],
    [
      "Export",
      esc(t(EXPORT_RULE)) +
        '<span class="export-prices" role="list">' +
        Object.keys(PRICES)
          .map(
            (good) =>
              `<span role="listitem"><strong>${icon(good)} ${esc(t({ kava: "Kava", copra: "Copra", beef: "Beef" }[good]))}</strong><span>${esc(t("Cost"))} ${token("coin", `−${PRICES[good]}`)} → ${token("point", `+${VALUES[good]}`)}</span></span>`,
          )
          .join("") +
        "</span>" +
        message("Completing a ship adds {p0} to the good's reward.", [
          token("point", "+2"),
        ]),
    ],
    [
      "Develop the islands",
      message(
        "A hut {p0} costs {p1}. A drawing {p2} earns {p3}. Transporting a tourist {p4} earns {p5} for every hut on that island, of any colour.",
        [
          icon("build"),
          token("coin", 3),
          icon("draw"),
          token("point", 3),
          icon("tourist"),
          token("coin", 1),
        ],
      ),
    ],
    [
      "Rest",
      esc(
        t(
          "Secretly choose one of the remaining Rest tokens. Receive its bonus at the end of the round:",
        ),
      ) +
        '<span class="rest-bonuses" role="list">' +
        [
          icon("first") + " " + esc(t("First player")),
          token("coin", 1) + " " + esc(t("Vatu")),
          token("point", 1) + " " + esc(t("Prosperity")),
          token("coin", 1) +
            " " +
            esc(t("Vatu")) +
            " + " +
            token("point", 1) +
            " " +
            esc(t("Prosperity")),
        ]
          .map((bonus) => '<span role="listitem">' + bonus + "</span>")
          .join("") +
        "</span>",
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
      "Rising Waters (expansion only)",
      [
        esc(
          t(
            "In rounds 2, 4, 6 and 8, a die rolled at the start of the round sets a countdown. During the action phase, each performed action reduces it by 1. At 0, the waters rise immediately after that action, before the next player acts.",
          ),
        ),
        esc(
          t(
            "Add 1 water marker to each island for each side adjacent to an Ocean tile without a dike on that side. Sides facing empty board spaces do not count.",
          ),
        ),
        message(
          "Build a dike {p0} for {p1} with the Build action. At 5 waters an island sinks; if 3 islands sink, everyone loses. Each hut on an island with 1 / 2 / 3 / 4 waters loses 1 / 3 / 5 / 7 prosperity at game end.",
          [icon("dike"), token("coin", 1)],
        ),
      ].join("<br><br>"),
    ],
  ];
  const sectionIcons = {
    "First player": "first",
    [EXTEND_TITLE]: "overview",
    "Five markers, up to five actions": "marker",
    "Retrieve markers": "undo",
    "Be in the right place": "sail",
    "Sell fish": "sell",
    Export: "buy",
    "Develop the islands": "build",
    Rest: "rest",
    "Final scoring": "point",
    "Rising Waters (expansion only)": "water",
  };
  return `<div class="rules">${paragraphs.map(([h, p]) => `<section><h3>${sectionIcons[h] ? icon(sectionIcons[h]) + " " : ""}${esc(t(h))}</h3><p translate="no">${p.includes("<") ? p : esc(t(p))}</p></section>`).join("")}</div><p class="rules-links"><a href="https://www.quined.nl/wp-content/uploads/2019/01/Vanuatu_Rulebook_${lang === "fr" ? "FR-WEBversion" : "UK_WEBversion-4"}.pdf" target="_blank" rel="noopener">${esc(t("Original rulebook"))} ↗</a> · <a href="https://quined.nl/wp-content/uploads/2017/06/Vanuatu2p_EN.pdf" target="_blank" rel="noopener">${esc(t("Two-player rules"))} ↗</a></p>`;
}
