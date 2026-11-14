# Per-game achievements

The optional `achievementDefinitions()` and `achievements(data)` exports use the
published `@boardgamers/protocol` **0.11.0** engine contract. Revision **1** has
16 stable game-local IDs. Icons are omitted (platform generic presentation); no
asset uploads or external image URLs are required. The JavaScript implementation
uses official JSDoc types; `pnpm test:achievements:types` also checks its exported
hooks against `Engine`. Tests validate results with the official runtime schemas.

## Manifest

| ID                    | Name               | Requirement                                                  |
| --------------------- | ------------------ | ------------------------------------------------------------ |
| island-victory        | Island Victory     | Outright win                                                 |
| duel-victory          | Duel Victory       | Outright win, 2 players                                      |
| trio-victory          | Trio Victory       | Outright win, 3 players                                      |
| quartet-victory       | Quartet Victory    | Outright win, 4 players                                      |
| full-table-victory    | Full Table Victory | Outright win, 5 players                                      |
| rising-waters-victory | Against the Tide   | Outright win with Rising Waters                              |
| no-characters-victory | On Your Own Merits | Outright win with Characters disabled                        |
| fifty-points          | Island Prosperity  | Final score at least 50                                      |
| seventy-five-points   | Island Renown      | Final score at least 75                                      |
| nine-vatus            | Full Purse         | Retain 9 vatus after final scoring                           |
| four-huts             | Village Builder    | At least 4 surviving huts                                    |
| three-islands         | Island Network     | Surviving huts on at least 3 islands                         |
| tourism-twelve        | Welcoming Shores   | At least 12 final hut-tourism points                         |
| treasure-six          | Treasure Keeper    | At least 6 final retained-treasure points                    |
| treasure-twelve       | Sunken Riches      | At least 12 final retained-treasure points                   |
| weather-the-waters    | Weather the Waters | Complete round 8 with Rising Waters, without collective loss |

## Result semantics and trust boundary

- Evaluate only authoritative completed serialized engine data. The engine's save
  format is a plain object: JSON serialization/hydration requires no special class
  reconstruction. Evaluation reads it without mutation, randomness, replay, or I/O.
  Each call returns fresh objects; callers cannot mutate the stored manifest.
- A normally finished game must have final-scoring details and round 8. Unfinished
  games, public/stripped views, known tutorials, local practice, and analysis games
  return no results. New practice/tutorial setups carry explicit flags. Loaded
  local practice saves are marked too. Analysis markers survive replay. Old local
  saves without these markers cannot be identified if supplied outside that flow.
- Vanuatu has 2–5 seats, no solo/automa mode. Official `rankings` compares score,
  then surviving huts, then money. Only a unique rank-1 seat wins. Multiple rank-1
  seats draw; all lower seats lose. Disabling Characters is only possible for 3–5
  players (two-player rules force Characters on).
- Rising Waters' collective catastrophe is a real completed loss, **not** a
  cancellation or shared win despite identical rankings. Every seat gets `loss`
  and no feats: final scoring never runs in this case.
- Normal-game non-win feats are not gated on victory: losers and drawers can earn
  them. Tourism and treasure use the engine's final scoring breakdown, not action
  history guesses. Submerged huts do not count. Money is the retained balance
  after fish liquidation; 10 vatus converts automatically into 5 points. Treasure
  is worth twice its retained value; tourism is 2 points per hut per tourist.
- The engine metadata contract only supplies names, not account IDs or bot flags.
  `moveAI` is also used for recommendations and does not identify seat ownership.
  Hooks therefore describe **all seats**, without guessing human status from
  names, AI moves or dropped-player flags. BGS must map eligible human seats to
  accounts, filter bots, and invoke awards only for authoritative completed,
  non-cancelled games. Platform cancellation is not stored in this engine's state.
  Dropped seats retain their actual game outcome; platform eligibility is separate.
  No historical backfill or cross-game counters are implemented.

## Release prerequisites

This branch is for independent review only; no BGS upload or release-branch push
is part of this change. Before publication, deploy platform achievement support
and verify authoritative completion/cancellation and human-seat eligibility in
integration. Run `pnpm check`, review the manifest, and follow the repository's BGS
release workflow (including required version bumps, latest release-branch
integration, source/lockfile commit, release-branch push and public mirror update).
Do not repurpose IDs. Any future definition changes require a manifest revision
bump. No new protocol release or artwork is needed for this manifest.
