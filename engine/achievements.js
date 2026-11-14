// @ts-check

/** @type {import('@boardgamers/protocol/engine').AchievementManifest} */
const manifest = {
  revision: 2,
  achievements: [
    ["island-victory", "Island Victory", "Win a game outright."],
    ["duel-victory", "Duel Victory", "Win a two-player game outright."],
    ["trio-victory", "Trio Victory", "Win a three-player game outright."],
    ["quartet-victory", "Quartet Victory", "Win a four-player game outright."],
    [
      "full-table-victory",
      "Full Table Victory",
      "Win a five-player game outright.",
    ],
    [
      "rising-waters-victory",
      "Against the Tide",
      "Win a Rising Waters game outright.",
    ],
    [
      "no-characters-victory",
      "On Your Own Merits",
      "Win outright with Characters disabled.",
    ],
    ["fifty-points", "Island Prosperity", "Finish with at least 50 points."],
    ["seventy-five-points", "Island Renown", "Finish with at least 75 points."],
    ["nine-vatus", "Full Purse", "Retain 9 vatus after final scoring."],
    [
      "four-huts",
      "Village Builder",
      "Finish with at least four surviving huts.",
    ],
    [
      "three-islands",
      "Island Network",
      "Finish with huts on at least three islands.",
    ],
    [
      "tourism-twelve",
      "Welcoming Shores",
      "Earn at least 12 final-scoring points from hut tourism.",
    ],
    [
      "treasure-six",
      "Treasure Keeper",
      "Retain treasure worth at least 6 final-scoring points.",
    ],
    [
      "treasure-twelve",
      "Sunken Riches",
      "Retain treasure worth at least 12 final-scoring points.",
    ],
    [
      "weather-the-waters",
      "Weather the Waters",
      "Complete all eight rounds of Rising Waters without the collective flood loss.",
    ],
  ].map(([id, name, description]) => ({
    id,
    name,
    description,
    icon: { type: "asset", key: `achievement-${id}` },
  })),
};

export function achievementDefinitions() {
  return structuredClone(manifest);
}

/**
 * Plain JSON is the engine's serialized format; no hydration or replay is needed.
 * Account eligibility, cancellation and bot-seat filtering belong to BGS.
 * @param {any} s
 * @param {number[]} ranks Official engine rankings, including hut/vatu tiebreaks.
 * @returns {import('@boardgamers/protocol/engine').SeatAchievements[]}
 */
export function evaluateAchievements(s, ranks) {
  if (
    !s?.finished ||
    s.phase !== "ended" ||
    s.achievementMode ||
    s._setup?.options?.practice ||
    s._setup?.options?.tutorial ||
    s._analysisPublicDraws ||
    !s._setup ||
    !s._history ||
    s.players.length < 2 ||
    s.players.length > 5
  )
    return [];
  // Catastrophe does not run final scoring and is not a tied victory.
  if (s.lost)
    return s.players.map((_, seat) => ({ seat, earned: [], outcome: "loss" }));
  if (s.round !== 8 || !s.players.every((p) => p.final)) return [];
  const leaders = ranks.filter((rank) => rank === 1).length;
  return s.players.map((p, seat) => {
    const win = ranks[seat] === 1 && leaders === 1;
    const islands = Object.values(s.board).filter(
      (t) => t.type === "island" && !t.submerged,
    );
    const huts = islands.map((t) => t.huts.filter((q) => q === seat).length);
    const earned = [];
    if (win) {
      earned.push(
        "island-victory",
        [
          "duel-victory",
          "trio-victory",
          "quartet-victory",
          "full-table-victory",
        ][s.players.length - 2],
      );
      if (s.options.risingWaters) earned.push("rising-waters-victory");
      if (!s.options.characters) earned.push("no-characters-victory");
    }
    if (p.score >= 50) earned.push("fifty-points");
    if (p.score >= 75) earned.push("seventy-five-points");
    if (p.money === 9) earned.push("nine-vatus");
    if (huts.reduce((a, b) => a + b, 0) >= 4) earned.push("four-huts");
    if (huts.filter((n) => n > 0).length >= 3) earned.push("three-islands");
    if (p.final.tourists >= 12) earned.push("tourism-twelve");
    if (p.final.treasure >= 6) earned.push("treasure-six");
    if (p.final.treasure >= 12) earned.push("treasure-twelve");
    if (s.options.risingWaters) earned.push("weather-the-waters");
    return {
      seat,
      earned,
      outcome: win ? "win" : ranks[seat] === 1 ? "draw" : "loss",
    };
  });
}
