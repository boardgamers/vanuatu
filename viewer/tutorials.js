import { LESSON } from "./tutorial-copy.js";
import { FIRST_HELP, EXPORT_RULE } from "./learning.js";
import {
  EXTEND_TITLE,
  EXTEND_WHO,
  EXTEND_HOW,
  EXTEND_WHEN,
  REMAINING_TILES,
} from "./learning.js";
import * as E from "../engine/index.js";
export const chapterMetadata = [
  {
    id: "planning",
    version: 4,
    title: "Plan your day",
    description: "Place five markers and understand action majorities.",
  },
  {
    id: "fishing",
    version: 2,
    title: "From sea to market",
    description: "Sail, fish and sell your catch beside your hut.",
  },
  {
    id: "islands",
    version: 2,
    title: "An island economy",
    description: "Build a hut, draw in the sand and welcome a tourist.",
  },
  { id: "trade", version: 3, title: "Trade", description: LESSON.tradeStart },
  { id: "rest", version: 1, title: "Rest", description: LESSON.restStart },
  { id: "expansion", version: 2, title: EXTEND_TITLE, description: EXTEND_WHO },
  {
    id: "rising-waters",
    version: 1,
    title: "Rising Waters (expansion only)",
    description: LESSON.waterStart,
  },
];
function prepared(phase = "actions") {
  const s = E.init(3, [], {}, "vanuatu-lesson");
  s.actor = 0;
  s.first = 0;
  s.phase = phase;
  s.players.forEach((p, i) => {
    p.name = ["You", "Maya", "Noa"][i];
    p.markers = Object.fromEntries(E.ACTIONS.map((a) => [a, 0]));
    p.character = null;
    p.boat = "1,1";
  });
  s.board = {
    "0,0": E.tileState("efate"),
    "1,0": E.tileState("startFish"),
    "0,1": E.tileState("startWreck"),
    "1,1": E.tileState("startBoat"),
  };
  s.tourists = 2;
  return s;
}
function play(s, m, opponentMove = E.moveAI) {
  let next = E.move(s, m, 0),
    n = 0;
  while (!next.finished && next.actor !== 0 && n++ < 100)
    next = opponentMove(next, next.actor);
  return next;
}
// Demonstrate several stacks and useful action sequences instead of the general
// bot's scoring strategy. Pick only legal moves so the player's choices stay free.
const planningOpponents = {
  1: {
    characters: ["fisherman", "navigator"],
    passes: [["fish", "sail"], ["fish", "draw"], ["rest"]],
    actions: ["fish", "sail", "draw", "rest"],
  },
  2: {
    characters: ["diver", "builder"],
    passes: [["explore", "build"], ["explore", "tourist"], ["rest"]],
    actions: ["explore", "build", "tourist", "rest"],
  },
};
function planningOpponent(s, p) {
  if (s.round !== 1) return E.moveAI(s, p);
  const script = planningOpponents[p];
  const legal = E.availableMoves(s, p);
  let selected;
  if (s.phase === "character")
    selected = script.characters
      .map((character) => legal.find((m) => m.character === character))
      .find(Boolean);
  else if (s.phase === "plan")
    selected = legal.find(
      (m) =>
        m.type === "plan" &&
        m.actions.join() === script.passes[s.planningPass].join(),
    );
  else if (s.phase === "actions")
    selected = script.actions
      .map((action) =>
        legal.find(
          (m) =>
            m.type === "act" &&
            m.action === action &&
            (action !== "sail" || m.path.length === 1),
        ),
      )
      .find(Boolean);
  return selected ? E.move(s, selected, p) : E.moveAI(s, p);
}
const planCount = (s) =>
  Object.values(s.players[0].markers).reduce((a, b) => a + b, 0);
const only = (action) => (s, m) =>
  m.action === action ? undefined : `Choose ${action} for this step.`;
export const chapters = {
  expansion: {
    game: "vanuatu",
    id: "expansion",
    version: 2,
    initialState: () => {
      const s = prepared("expand");
      s.round = 2;
      return s;
    },
    move: (s, m) => E.move(s, m, 0),
    steps: [
      { id: "round", title: EXTEND_TITLE, text: LESSON.extendStart },
      {
        id: "first-tile",
        title: EXTEND_TITLE,
        text: EXTEND_HOW,
        complete: (s) => s.upcoming.length === 1,
        validateMove: (s, m) => (m.type === "place" ? undefined : EXTEND_HOW),
      },
      {
        id: "second-tile",
        title: REMAINING_TILES,
        text: EXTEND_WHO,
        complete: (s) => s.phase !== "expand",
        validateMove: (s, m) => (m.type === "place" ? undefined : EXTEND_HOW),
      },
      {
        id: "character",
        title: "Choose a character",
        text: LESSON.extendCharacter,
        complete: (s) => !!s.players[0].character,
        validateMove: (s, m) =>
          m.type === "character" ? undefined : LESSON.extendCharacter,
      },
    ],
    completion: { title: EXTEND_TITLE, text: EXTEND_WHEN },
  },
  planning: {
    game: "vanuatu",
    id: "planning",
    version: 4,
    initialState: () => {
      const s = prepared("character");
      s.players[1].boat = "1,0";
      s.players[2].boat = "0,1";
      return s;
    },
    move: (s, m) => play(s, m, planningOpponent),
    steps: [
      {
        id: "character",
        title: "Choose a character",
        text: LESSON.character,
        complete: (s) => s.phase === "plan",
        validateMove: (s, m) =>
          m.type === "character" ? undefined : LESSON.character,
      },
      {
        id: "five-actions",
        title: "Five markers, up to five actions",
        text: "You may place one marker on each of five different actions and perform all five this round, if each is possible. Stacking markers improves your majority, not the number of times you act. Place them in three passes: 2, 2, then 1.",
      },
      {
        id: "first-two",
        title: "Plan two actions",
        text: "Place your first two markers. Sailing opens up fishing and island actions; extra markers help win a majority.",
        complete: (s) => planCount(s) >= 2,
        validateMove: (s, m) =>
          m.type === "plan" ? undefined : "Place the two markers first.",
      },
      {
        id: "next-two",
        title: "Two more markers",
        text: "The others have placed their markers. Reinforce an action or plan something new. An action can be performed once, however many markers you place there.",
        complete: (s) => planCount(s) >= 4,
      },
      {
        id: "last",
        title: "One last marker",
        text: "Place your fifth marker. During the action phase, ties are broken in order from the first player.",
        complete: (s) => s.phase === "actions",
      },
      {
        id: "majority",
        title: "Two markers beat one",
        text: "If you have 1 marker on Fish and Maya has 2, Maya can fish before you. Your marker stays there. After she fishes and removes both her markers, you may fish on a later turn if you then have the majority and fish remain.",
      },
      {
        id: "ties",
        title: "Ties follow player order",
        text: "With 1 marker each, the player earlier in turn order has priority, starting with the first player. A majority means more markers than each opponent, not more than all opponents combined.",
      },
      {
        id: "resolve-first",
        title: "Resolve your first stack",
        text: "Choose an available action and perform it. All your markers on that action return together: even a stack of 3 grants only one action. You choose the order of your actions; it need not match placement order.",
        complete: (s) => planCount(s) < 5,
      },
      {
        id: "no-majority",
        title: "When you cannot act",
        text: "If you cannot afford Build yet, you can choose another action where you have the majority and keep Build for later. Resolving Build now means retrieving its markers without building. If you have no majority anywhere, you must retrieve one stack without acting. When resolving an action you can perform, you must perform it.",
      },
      {
        id: "finish-round",
        title: "Finish your planned actions",
        text: "Resolve your remaining stacks. Watch which actions become available when opponents remove theirs. Planning an action does not guarantee it: someone may take the last fish or use the last space first.",
        complete: (s) => s.round > 1,
      },
    ],
    completion: {
      title: "Your plan is ready",
      text: "Spread your markers for more actions, or stack them for priority. Plan prerequisites first, then choose your action order as the round unfolds.",
    },
  },
  fishing: {
    game: "vanuatu",
    id: "fishing",
    version: 2,
    initialState: () => {
      const s = prepared();
      s.board["0,0"].huts = [0];
      s.players[0].hutsLeft = 7;
      s.players[0].markers.sail = 1;
      s.players[0].markers.fish = 1;
      s.players[0].markers.sell = 1;
      // Leave Rest unresolved so the sale's price drop is visible before round setup.
      s.players[0].markers.rest = 2;
      return s;
    },
    move: play,
    steps: [
      { id: "route", title: "From sea to market", text: LESSON.fishingStart },
      {
        id: "sail",
        title: "Find a fishing ground",
        text: "Choose Sail and move to the ocean space with fish value 2. Each space costs 1 vatu.",
        complete: (s) => s.players[0].boat === "1,0",
        validateMove: (s, m) =>
          m.action === "sail" && m.path.at(-1) === "1,0"
            ? undefined
            : "Sail to the ocean space with fish value 2.",
      },
      {
        id: "fish",
        title: "Catch the fish",
        text: "Choose Fish. The catch has value 2; the fishing ground then falls to 1.",
        complete: (s) => s.players[0].fish.includes(2),
        validateMove: only("fish"),
      },
      { id: "hold", title: "Fish in hold", text: LESSON.fishingHold },
      {
        id: "sell",
        title: "Sell your catch",
        text: "Your boat is beside your orange hut. Sell the catch: fish value 2 × market price 3 = 6 vatus.",
        complete: (s) => s._history.some((h) => h.move.action === "sell"),
        validateMove: only("sell"),
      },
    ],
    completion: {
      title: "Trade keeps you moving",
      text: "The fish price has dropped from 3 to 2 (top left of the board). It resets to 3 next round. Every 10 vatus automatically becomes 5 prosperity.",
    },
  },
  islands: {
    game: "vanuatu",
    id: "islands",
    version: 2,
    initialState: () => {
      const s = prepared();
      s.players[0].character = "builder";
      s.players[0].boat = "1,0";
      for (const a of ["build", "draw", "tourist"]) s.players[0].markers[a] = 1;
      return s;
    },
    move: play,
    steps: [
      { id: "route", title: "An island economy", text: LESSON.islandStart },
      {
        id: "hut",
        title: "Build a beach hut",
        text: "Build beside your boat. Use the Builder: your hut costs only 1 vatu instead of 3.",
        complete: (s) => s.board["0,0"].huts.includes(0),
        validateMove: (s, m) =>
          m.action === "build" && m.bonus
            ? undefined
            : "Build a hut with the Builder bonus enabled.",
      },
      {
        id: "shared-island",
        title: "Character bonus",
        text: LESSON.usedCharacter,
      },
      {
        id: "drawing",
        title: "Draw in the sand",
        text: "A sand drawing earns 3 prosperity. It stays on the island and may help a future Guide.",
        complete: (s) => s.board["0,0"].drawings > 0,
        validateMove: only("draw"),
      },
      {
        id: "tourist",
        title: "Welcome a visitor",
        text: "Transport a tourist to the island. You earn 1 vatu per hut there. At game end, each of your huts earns 2 prosperity per tourist.",
        complete: (s) => s.board["0,0"].tourists > 0,
        validateMove: only("tourist"),
      },
    ],
    completion: {
      title: "Ready to sail",
      text: "Prosperity comes from trade, drawings, characters and endgame scoring. Keep enough vatus to fund the actions you plan.",
    },
  },

  trade: {
    game: "vanuatu",
    id: "trade",
    version: 3,
    initialState: () => {
      const s = prepared();
      s.players[0].boat = "0,1";
      s.players[0].money = 1;
      for (const a of ["explore", "buy", "rest"]) s.players[0].markers[a] = 1;
      s.demands[0] = {
        id: 10,
        goods: ["kava", "copra", "beef"],
        filled: [true, true, false],
      };
      s.demands[1] = {
        id: 3,
        goods: ["beef", "beef", "copra"],
        filled: [false, false, false],
      };
      return s;
    },
    move: play,
    steps: [
      { id: "route", title: "Trade", text: LESSON.tradeStart },
      {
        id: "explore",
        title: "Explore",
        text: LESSON.explore,
        complete: (s) => s.players[0].treasures.includes(2),
        validateMove: only("explore"),
      },
      { id: "choice", title: "Explore", text: LESSON.keepTreasure },
      {
        id: "sell-treasure",
        title: "Sell treasures",
        text: LESSON.sellTreasure,
        complete: (s) => s.players[0].money === 3,
        validateMove: (s, m) =>
          m.type === "treasure" ? undefined : LESSON.sellTreasure,
      },
      { id: "buy-and-ship", title: "Export", text: EXPORT_RULE },
      { id: "compare", title: "Export", text: LESSON.tradeCompare },
      {
        id: "export",
        title: "Export",
        text: LESSON.tradeChoose,
        complete: (s) => s._history.some((h) => h.move.action === "buy"),
        validateMove: (s, m) =>
          m.action === "buy" && ["copra", "beef"].includes(m.good)
            ? undefined
            : LESSON.tradeChoose,
      },
    ],
    completion: {
      title: "Trade",
      text: (s) =>
        s.players[0].score === 7 ? LESSON.tradeDone : LESSON.tradeIncomplete,
    },
  },
  rest: {
    game: "vanuatu",
    id: "rest",
    version: 1,
    initialState: () => {
      const s = prepared();
      s.first = 1;
      s.players[0].markers.rest = 1;
      return s;
    },
    move: play,
    steps: [
      { id: "bonus", title: "Rest", text: LESSON.restStart },
      {
        id: "rest",
        title: "Rest",
        text: LESSON.restStart,
        complete: (s) => s.phase === "rest",
        validateMove: only("rest"),
      },
      {
        id: "token",
        title: "Choose a rest token",
        text: LESSON.restChoice,
        complete: (s) => s.round === 2 && s.first === 0,
        validateMove: (s, m) =>
          m.type === "rest" && m.token === "first"
            ? undefined
            : LESSON.restChoice,
      },
    ],
    completion: { title: "First player", text: FIRST_HELP },
  },
  "rising-waters": {
    game: "vanuatu",
    id: "rising-waters",
    version: 1,
    initialState: () => {
      const s = prepared();
      s.options.risingWaters = true;
      s.round = 4;
      s.waterCountdown = 3;
      s.players[0].boat = "1,0";
      s.players[0].money = 4;
      for (const a of ["build", "fish", "tourist", "sail", "rest"])
        s.players[0].markers[a] = 1;
      s.board["0,0"].water = 3;
      s.board["0,0"].dikes = ["0,1"];
      s.board["2,1"] = E.tileState("a1");
      Object.assign(s.board["2,1"], {
        water: 4,
        huts: [1],
        tourists: 1,
        drawings: 1,
      });
      s.players[1].hutsLeft = 7;
      s.dikesLeft = 19;
      return s;
    },
    move: play,
    steps: [
      {
        id: "expansion",
        title: "Rising Waters (expansion only)",
        text: LESSON.waterStart,
      },
      {
        id: "timing",
        title: "How a round works",
        text: "In rounds 2, 4, 6 and 8, a die rolled at the start of the round sets a countdown. During the action phase, each performed action reduces it by 1. At 0, the waters rise immediately after that action, before the next player acts.",
      },
      {
        id: "countdown",
        title: "Actions until the waters rise",
        text: LESSON.waterCountdown,
      },
      {
        id: "dike",
        title: "Build",
        text: LESSON.waterBuild,
        complete: (s) =>
          s.board["0,0"].dikes.includes("1,0") &&
          s.board["0,0"].huts.includes(0),
        validateMove: (s, m) =>
          m.action === "build" && m.cell === "0,0" && m.hut && m.dike === "1,0"
            ? undefined
            : LESSON.waterBuild,
      },
      { id: "coasts", title: "Dike", text: LESSON.waterCoasts },
      {
        id: "fish",
        title: "Catch the fish",
        text: LESSON.waterFish,
        complete: (s) => s.waterCountdown === 1,
        validateMove: only("fish"),
      },
      {
        id: "tourist",
        title: "Welcome a visitor",
        text: LESSON.waterTourist,
        complete: (s) => s.waterTriggered,
        validateMove: (s, m) =>
          m.action === "tourist" && m.cell === "0,0"
            ? undefined
            : LESSON.waterTourist,
      },
      { id: "flood", title: "Rising Waters", text: LESSON.waterResult },
      { id: "score", title: "Final scoring", text: LESSON.waterScoring },
    ],
    completion: { title: "Rising Waters", text: LESSON.waterDone },
  },
};
