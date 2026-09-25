import * as E from "../engine/index.js";
export const chapterMetadata = [
  {
    id: "planning",
    version: 2,
    title: "Plan your day",
    description: "Place five markers and understand action majorities.",
  },
  {
    id: "fishing",
    version: 1,
    title: "From sea to market",
    description: "Sail, fish and sell your catch beside your hut.",
  },
  {
    id: "islands",
    version: 1,
    title: "An island economy",
    description: "Build a hut, draw in the sand and welcome a tourist.",
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
function play(s, m) {
  let next = E.move(s, m, 0),
    n = 0;
  while (!next.finished && next.actor !== 0 && n++ < 100)
    next = E.moveAI(next, next.actor);
  return next;
}
const planCount = (s) =>
  Object.values(s.players[0].markers).reduce((a, b) => a + b, 0);
const only = (action) => (s, m) =>
  m.action === action ? undefined : `Choose ${action} for this step.`;
export const chapters = {
  planning: {
    game: "vanuatu",
    id: "planning",
    version: 2,
    initialState: () => {
      const s = prepared("plan");
      s.characters = [];
      s.options.characters = false;
      return s;
    },
    move: play,
    steps: [
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
        text: "You cannot simply wait. If you have no majority anywhere, remove one of your stacks without acting. If you have a majority but that action is impossible, remove that stack too. You must perform a possible action when resolving its stack.",
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
    version: 1,
    initialState: () => {
      const s = prepared();
      s.board["0,0"].huts = [0];
      s.players[0].hutsLeft = 7;
      s.players[0].markers.sail = 1;
      s.players[0].markers.fish = 1;
      s.players[0].markers.sell = 1;
      return s;
    },
    move: play,
    steps: [
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
      text: "The fish market falls after a sale and resets next round. Every 10 vatus automatically becomes 5 prosperity.",
    },
  },
  islands: {
    game: "vanuatu",
    id: "islands",
    version: 1,
    initialState: () => {
      const s = prepared();
      s.players[0].character = "builder";
      s.players[0].boat = "1,0";
      for (const a of ["build", "draw", "tourist"]) s.players[0].markers[a] = 1;
      return s;
    },
    move: play,
    steps: [
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
};
