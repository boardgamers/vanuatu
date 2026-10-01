import * as E from "../engine/index.js";

export const fullRoundMetadata = {
  id: "full-round",
  version: 1,
  title: "A round does not always go to plan",
  description:
    "Play a complete round: blocked actions, changing priorities and end-of-round bonuses.",
};

export const ROUND_LESSON = {
  character:
    "This practice island already has two huts. Choose the Navigator, then plan your five markers. Maya and Noa will compete for the same actions.",
  first:
    "Plan Fish and Sell: one marker on each. You hope to catch fish, then sell them beside your hut.",
  second:
    "Plan Draw and Build: one marker on each. The island has one drawing space and one hut space left.",
  last: "Place your last marker on Rest. All three players will now have five markers, placed in passes of 2, 2 and 1.",
  blocked:
    "Your planned Fish → Sell sequence cannot start yet: Maya has 2 Fish markers against your 1. Maya also leads Draw; Noa leads Build and Sell. Rest is tied, and you win that tie as first player.",
  rest: "You cannot skip your turn to wait for Fish. Take Rest now and keep your other stacks for later.",
  bonus:
    "Choose 1 vatu + 1 prosperity. You receive this bonus only after everyone has resolved all their markers.",
  fish: "Maya fished and removed both Fish markers; Noa built the last hut. Fish is now available to you. Catch the remaining fish before selling them.",
  changed:
    "Maya used the last drawing space, and Noa sold his fish first: the price fell from 3 to 2. Your markers reserved neither those spaces nor the selling price.",
  sell: "Sell your fish at the current price of 2 vatus. You can still complete this part of your plan, even though Rest came first.",
  retrieve:
    "Only Build and Draw remain. Both now have your majority, but the island has no space for either. Choose which stack to retrieve without acting; the game does not choose for you.",
  remaining:
    "The last stack had no possible action, so it was retrieved automatically. Rest bonuses are now paid; Maya's First player token makes her start the next round.",
  done: "You played a whole round: Rest → Fish → Sell, then retrieved two unusable stacks. Your Rest bonus is now paid. Plan useful alternatives: a marker does not reserve an action, its resources or its place in your sequence.",
};

const opponents = {
  1: {
    character: "artist",
    passes: [["fish", "draw"], ["fish", "draw"], ["rest"]],
    actions: ["fish", "draw", "rest"],
    token: "first",
  },
  2: {
    character: "builder",
    passes: [["build", "sell"], ["build", "sell"], ["rest"]],
    actions: ["build", "sell", "rest"],
    token: "point",
  },
};

function opponentMove(state) {
  const script = opponents[state.actor];
  const legal = E.availableMoves(state, state.actor);
  const selected =
    legal.find((m) =>
      state.phase === "character"
        ? m.character === script.character
        : state.phase === "plan"
          ? m.type === "plan" &&
            m.actions.join() === script.passes[state.planningPass].join()
          : state.phase === "rest"
            ? m.token === script.token
            : false,
    ) ??
    script.actions
      .map((action) =>
        legal.find((m) => m.type === "act" && m.action === action),
      )
      .find(Boolean);
  if (!selected)
    throw Error("The full-round tutorial opponent has no scripted legal move");
  return E.move(state, selected, state.actor);
}

const count = (state) =>
  Object.values(state.players[0].markers).reduce((a, b) => a + b, 0);
const plan = (actions, text) => (state, move) =>
  move.type === "plan" &&
  [...move.actions].sort().join() === [...actions].sort().join()
    ? undefined
    : text;
const act = (action, text) => (state, move) =>
  move.type === "act" && move.action === action ? undefined : text;
const retrieve = (state, move) =>
  move.type === "discard" && ["build", "draw"].includes(move.action)
    ? undefined
    : ROUND_LESSON.retrieve;

export function createFullRoundChapter(prepared) {
  return {
    game: "vanuatu",
    id: fullRoundMetadata.id,
    version: fullRoundMetadata.version,
    initialState: () => {
      const s = prepared("character");
      s.players.forEach((p) => {
        p.boat = "1,0";
      });
      s.board["0,0"].huts = [0, 2];
      s.players[0].hutsLeft--;
      s.players[2].hutsLeft--;
      s.players[2].fish = [1];
      return s;
    },
    move: (state, move) => {
      let next = E.move(state, move, 0);
      while (next.round === state.round && next.actor !== 0)
        next = opponentMove(next);
      return next;
    },
    steps: [
      {
        id: "character",
        title: "Choose a character",
        text: ROUND_LESSON.character,
        complete: (s) => s.phase === "plan",
        validateMove: (s, m) =>
          m.character === "navigator" ? undefined : ROUND_LESSON.character,
      },
      {
        id: "first-pair",
        title: "Plan two actions",
        text: ROUND_LESSON.first,
        complete: (s) => count(s) === 2,
        validateMove: plan(["fish", "sell"], ROUND_LESSON.first),
      },
      {
        id: "second-pair",
        title: "Two more markers",
        text: ROUND_LESSON.second,
        complete: (s) => count(s) === 4,
        validateMove: plan(["draw", "build"], ROUND_LESSON.second),
      },
      {
        id: "last-marker",
        title: "One last marker",
        text: ROUND_LESSON.last,
        complete: (s) => s.phase === "actions",
        validateMove: plan(["rest"], ROUND_LESSON.last),
      },
      {
        id: "blocked",
        title: "Your first action is blocked",
        text: ROUND_LESSON.blocked,
      },
      {
        id: "rest",
        title: "Change your action order",
        text: ROUND_LESSON.rest,
        complete: (s) => s.phase === "rest",
        validateMove: act("rest", ROUND_LESSON.rest),
      },
      {
        id: "rest-bonus",
        title: "Rest",
        text: ROUND_LESSON.bonus,
        complete: (s) => s.players[0].rest === "both",
        validateMove: (s, m) =>
          m.type === "rest" && m.token === "both"
            ? undefined
            : ROUND_LESSON.bonus,
      },
      {
        id: "fish",
        title: "Fish is now available",
        text: ROUND_LESSON.fish,
        complete: (s) => s.players[0].fish.length > 0,
        validateMove: act("fish", ROUND_LESSON.fish),
      },
      {
        id: "changed",
        title: "The island and market changed",
        text: ROUND_LESSON.changed,
      },
      {
        id: "sell",
        title: "Sell your catch",
        text: ROUND_LESSON.sell,
        complete: (s) => s.players[0].markers.sell === 0,
        validateMove: act("sell", ROUND_LESSON.sell),
      },
      {
        id: "retrieve",
        title: "Choose which stack to retrieve",
        text: ROUND_LESSON.retrieve,
        complete: (s) => s.round === 2,
        validateMove: retrieve,
      },
      {
        id: "last-stack",
        title: "Finish the round",
        text: ROUND_LESSON.remaining,
      },
    ],
    completion: { title: "A complete round", text: ROUND_LESSON.done },
  };
}
