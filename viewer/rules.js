import { icon, token } from "./art.js";
export function rulesHtml(lang = "en") {
  const fr = lang === "fr";
  const paragraphs = fr
    ? [
        [
          "Vivre de l’archipel",
          `En 8 tours, gagnez de la prospérité ${icon("point")} en commerçant, en accueillant des touristes et en créant des dessins de sable. ${token("coin", 10)} se convertissent immédiatement en ${token("point", 5)}.`,
        ],
        [
          "Programmer, puis agir",
          `Choisissez un personnage, puis placez vos 5 pions en trois passages : 2, 2, 1. À votre tour, effectuez une action où vous avez le plus de pions. Les égalités se départagent depuis le premier joueur ${icon("first")}. Tous vos pions de cette action sont repris. Sans majorité, reprenez une pile sans effectuer l’action.`,
        ],
        [
          "Au bon endroit",
          `Naviguez ${icon("sail")} de 1 à 3 cases d’océan pour autant de ${icon("coin")}. Pêchez ${icon("fish")} ou explorez ${icon("explore")} sur votre case : prenez la valeur encore présente, puis retirez un marqueur. Les autres actions concernent une île voisine.`,
        ],
        [
          "Faire du commerce",
          `Vendez vos poissons près de l’une de vos cabanes ${icon("build")} : leur valeur × le prix du marché. Le prix diminue après chaque vente. Exportez ${icon("kava")} / ${icon("copra")} / ${icon("beef")} pour ${token("coin", "1 / 2 / 3")}, contre ${token("point", "1 / 3 / 5")} si un navire en demande. Compléter un navire rapporte ${token("point", 2)}.`,
        ],
        [
          "Développer les îles",
          `Une cabane ${icon("build")} coûte ${token("coin", 3)}. Un dessin ${icon("draw")} rapporte ${token("point", 3)}. Transporter un touriste ${icon("tourist")} rapporte ${token("coin", 1)} par cabane sur cette île, quelle que soit sa couleur. Se reposer ${icon("rest")} permet de choisir un bonus secret, résolu en fin de tour.`,
        ],
        [
          "Personnages",
          `Chaque personnage améliore une action, une fois par tour. Vous choisissez le nouveau personnage avant de rendre l’ancien : impossible de garder le même deux tours de suite. Les trésors ${icon("explore")} peuvent être vendus à tout moment pour leur valeur en ${icon("coin")}.`,
        ],
        [
          "Fin de partie",
          `Après le 8e tour : poissons restants → autant de ${icon("coin")}, premier joueur → ${token("point", 3)}, chaque ${token("coin", 3)} → ${token("point", 1)}, trésors → deux fois leur valeur en ${icon("point")}, chaque cabane → ${token("point", 2)} par touriste sur son île. La plus grande prospérité l’emporte ; puis le plus de cabanes, puis de vatus.`,
        ],
        [
          "À deux joueurs",
          `Placez d’abord 2, puis 3 pions neutres. Pour agir, il faut aussi dépasser leur nombre ; le personnage correspondant permet de les égaler. Les personnages disponibles changent chaque tour. Deux bateaux ne peuvent pas terminer leur déplacement sur la même case.`,
        ],
        [
          "La Montée des eaux",
          `Aux tours pairs, le dé indique combien d’actions précèdent l’inondation. Chaque côte adjacente à un océan et sans digue ajoute 1 eau. Construisez une digue ${icon("dike")} pour ${token("coin", 1)} avec l’action Construire. À 5 eaux, l’île est submergée ; à 3 îles submergées, tout le monde perd. Chaque cabane sur une île avec 1 / 2 / 3 / 4 eaux perd 1 / 3 / 5 / 7 prospérité en fin de partie.`,
        ],
      ]
    : [
        [
          "A living archipelago",
          `Over 8 rounds, earn prosperity ${icon("point")} through trade, tourism and sand drawings. Every ${token("coin", 10)} immediately becomes ${token("point", 5)}.`,
        ],
        [
          "Plan, then act",
          `Choose a character, then place your 5 markers in three passes: 2, 2, 1. On your turn, take an action where you have the most markers. Ties follow turn order from the first player ${icon("first")}. Retrieve all your markers from that action. Without a majority, retrieve one stack without performing its action.`,
        ],
        [
          "Be in the right place",
          `Sail ${icon("sail")} 1–3 ocean spaces for that many ${icon("coin")}. Fish ${icon("fish")} or explore ${icon("explore")} on your space: take its remaining value, then remove one marker. Island actions need your boat beside the island.`,
        ],
        [
          "Trade",
          `Sell fish beside one of your huts ${icon("build")}: fish values × the market price. The price falls after each sale. Export ${icon("kava")} / ${icon("copra")} / ${icon("beef")} for ${token("coin", "1 / 2 / 3")}, earning ${token("point", "1 / 3 / 5")} when a ship needs them. Completing a ship earns ${token("point", 2)}.`,
        ],
        [
          "Develop the islands",
          `A hut ${icon("build")} costs ${token("coin", 3)}. A drawing ${icon("draw")} earns ${token("point", 3)}. Transporting a tourist ${icon("tourist")} earns ${token("coin", 1)} for every hut on that island, of any colour. Rest ${icon("rest")} lets you choose a secret bonus, resolved at the end of the round.`,
        ],
        [
          "Characters",
          `Each character improves one action, once per round. Choose your next character before returning your old one; you cannot keep the same character for consecutive rounds. Treasures ${icon("explore")} may be sold at any time for their value in ${icon("coin")}.`,
        ],
        [
          "Final scoring",
          `After round 8: remaining fish → their value in ${icon("coin")}; first player → ${token("point", 3)}; every ${token("coin", 3)} → ${token("point", 1)}; treasures → twice their value in ${icon("point")}; each hut → ${token("point", 2)} per tourist on its island. Most prosperity wins; ties favour more huts, then more vatus.`,
        ],
        [
          "Two players",
          `Place 2, then 3 neutral markers before choosing characters. You must also beat the neutral stack to act; the matching character lets you tie it. Available characters change each round. Boats cannot end their movement on the same space.`,
        ],
        [
          "Rising Waters",
          `On even rounds, the die gives the number of actions before flooding. Every adjacent ocean coast without a dike adds 1 water. Build a dike ${icon("dike")} for ${token("coin", 1)} with the Build action. At 5 waters an island sinks; if 3 islands sink, everyone loses. Each hut on an island with 1 / 2 / 3 / 4 waters loses 1 / 3 / 5 / 7 prosperity at game end.`,
        ],
      ];
  return `<div class="rules">${paragraphs.map(([h, p]) => `<section><h3>${h}</h3><p>${p}</p></section>`).join("")}</div><p class="rules-links"><a href="https://www.quined.nl/wp-content/uploads/2019/01/Vanuatu_Rulebook_${fr ? "FR-WEBversion" : "UK_WEBversion-4"}.pdf" target="_blank" rel="noopener">${fr ? "Règles originales" : "Original rulebook"} ↗</a> · <a href="https://quined.nl/wp-content/uploads/2017/06/Vanuatu2p_EN.pdf" target="_blank" rel="noopener">${fr ? "Règles à deux" : "Two-player rules"} ↗</a></p>`;
}
