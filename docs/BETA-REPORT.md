# Vanuatu beta — implementation and open questions

25 September 2026 · Second edition, Quined Games (2016)

## Available

- Listed beta [BGS game](https://boardgamers.space/boardgame/vanuatu), access granted to **coyotte508**.
- Public [Codeberg repository](https://codeberg.org/boardgamers/vanuatu).
- Local practice: `http://127.0.0.1:5246/` (start with `pnpm build && pnpm dev`).
- Three guided lessons: planning, fishing/trade, and island development.

The engine covers eight rounds, 2–5 players, all eleven characters, the official two-player rules, optional play without characters for 3–5 players, and Rising Waters. It automates setup, replenishment, income conversion, turn order, mandatory retrieval when no decision remains, floods and final scoring. Free treasure sales and the Beggar remain available out of turn.

The viewer uses a large interactive map, a compact action dock and player supplies below the board. It supports tap-based mobile play, legal destination highlights, character bonuses, resource pictograms, shared sound/color-blind preferences, English game text by default, with fourteen other languages available, BGS chat with translation and editing, journal, replay, finished-game analysis, player hover cards, fullscreen and board-thumbnail rendering. Tutorials are translated into the same languages.

## Points requiring publisher confirmation

These are explicit beta assumptions, **not resolved official errata**. They should be checked before a public release; changing a tile value may require starting fresh beta games.

| Question                      | Evidence                                                                                                                                                                      | Implemented choice                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fish and treasure quantities  | The rulebook lists 14 fish tiles (8×1, 4×2, 2×3) and 10 treasure tiles (4×1, 4×2, 2×3). The supplied cut-tile faces instead total **16 fish markers and 8 treasure markers**. | Use the readable values on the supplied tile faces. Fish/treasure rewards follow the remaining count on the ocean tile; no artificial shortage of reward tiles. |
| Governor during Rising Waters | The Governor moves markers **instead of** performing an action. The flood rule counts performed actions; no explicit Governor exception was found.                            | Governor transfers and discarded stacks do **not** decrease the flood die. Normal actions do.                                                                   |

The supplied demand art also contains repeated patterns: cards 1/10 have one of each good; cards 2/8 have two kava and one copra. Duplicates can be intentional; they are preserved, not “corrected” speculatively.

### Tile values currently used

The fixed starting island is additional to this table. Two tiles of each letter A–F are split between the two ordered stacks, following the rulebook.

| Tile           | Source cut image | Fish | Treasure | Island capacity: huts / drawings / tourists | Goods       |
| -------------- | ---------------- | ---: | -------: | ------------------------------------------- | ----------- |
| Starting fish  | 1                |    2 |        0 | —                                           | —           |
| Starting wreck | 3                |    1 |        2 | —                                           | —           |
| Starting boats | 5                |    0 |        0 | —                                           | —           |
| A1             | 7                |    — |        — | 3 / 2 / 4                                   | kava, beef  |
| A2             | 9                |    — |        — | 3 / 2 / 4                                   | kava, copra |
| B1             | 11               |    1 |        3 | —                                           | —           |
| B2             | 13               |    3 |        0 | —                                           | —           |
| C1             | 15               |    0 |        0 | —                                           | —           |
| C2             | 17               |    1 |        2 | —                                           | —           |
| D1             | 19               |    — |        — | 2 / 3 / 3                                   | 2 kava      |
| D2             | 21               |    — |        — | 3 / 1 / 4                                   | kava, copra |
| E1             | 23               |    0 |        0 | —                                           | —           |
| E2             | 25               |    2 |        0 | —                                           | —           |
| F1             | 27               |    3 |        1 | —                                           | —           |
| F2             | 29               |    3 |        0 | —                                           | —           |

## Validation

- 34 focused engine/tutorial tests: majorities, prerequisites, optional powers, export resource selection, money conversion, two-player blocking, illegal-move immutability, hidden information, dropped players, deterministic replay, legacy saves, the 4/5/6/1 footprint, floods and complete tutorials.
- 80 full simulated games (14,564 moves in the latest sweep), across 2/3/4/5 players with and without Rising Waters. Both purposeful bots and varied legal choices exercise all nine actions and the Governor. These check termination, resource invariants and deterministic reconstruction; they do not establish strategic bot strength or resolve component discrepancies.
- Browser checks at **1440 px** and **390 px**: all nine actions, planning, tile placement, final scores, no page-width overflow, color symbols, replay, analysis chat hiding, player hover, board thumbnails, chat scroll-to-bottom, translation controls and ↑ editing.
- The installed production engine completed an eight-round bot game and reconstructed its history. The uploaded viewer is checked through a protocol harness. A real multi-account online session remains a useful beta playtest.

## Sources

Rules take precedence over artwork where they specify the behavior. Supplied component faces are used for values not individually listed in the rules.

- [Publisher’s English rulebook](https://www.quined.nl/wp-content/uploads/2019/01/Vanuatu_Rulebook_UK_WEBversion-4.pdf), especially setup, actions, characters and Rising Waters.
- [Publisher’s French rulebook](https://quined.nl/wp-content/uploads/2019/01/Vanuatu_Rulebook_FR-WEBversion.pdf).
- [Official two-player rules](https://quined.nl/wp-content/uploads/2017/06/Vanuatu2p_EN.pdf).
- [BGG second-edition page](https://boardgamegeek.com/boardgame/193927/vanuatu-second-edition), including its listing of the publisher’s corrected English rulebook. BGG’s direct page fetch was blocked, so no unverified forum clarification has been treated as authoritative.
- [BGG discussion of fish sales and optional treasure sales](https://boardgamegeek.com/thread/1883649/fish-price-and-treasure), consistent with the English rulebook: the market decreases once per sale action; treasure liquidation is optional.

Artwork remains the property of its rights holders. Public access to the repository does not grant a license to redistribute the supplied materials.

## Resolved: exact outer board outline

The printed board has rows of **4, 5, 6, 1** spaces. The lone bottom space adjoins the second and third spaces in the row above. New games use this footprint (`boardLayout: 2`). Existing beta saves retain the previous 5/5/5/1 footprint so their placements and replays remain valid. The viewer follows the game’s layout, tilts the grid approximately 20° clockwise like the printed board, and offers a full-board overview including unplaced spaces. This resolves the former “exact outer board outline” question.
