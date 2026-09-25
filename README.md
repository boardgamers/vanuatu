# Vanuatu — Boardgamers private beta

A board-first adaptation of Alain Epron's **Vanuatu**, second edition (Quined Games, 2016). Artwork by Konstantin Vohwinkel, supplied by the publisher for this adaptation.

This repository and the BGS listing remain **private**. Supplied artwork and game materials remain the property of their respective rights holders; permission to use them for this adaptation is not a general redistribution license.

## Development

Node 24+, pnpm. `pnpm install`, `pnpm build`, `pnpm dev` (port 5246). `pnpm test` runs rules tests; install the browser once with `pnpm exec playwright install chromium`; `pnpm test:browser` checks the viewer.

Supported scope: 2–5 players, all eleven characters, the official two-player variant, optional Rising Waters, replay and finished-game analysis, bots, BGS chat, player hover cards and board thumbnails.

## References

- [Publisher and rules](https://www.quined.nl/featured_item/vanuatu-2nd-edition/)
- [English rules](https://www.quined.nl/wp-content/uploads/2019/01/Vanuatu_Rulebook_UK_WEBversion-4.pdf)
- [Official two-player rules](https://quined.nl/wp-content/uploads/2017/06/Vanuatu2p_EN.pdf)
- [BoardGameGeek](https://boardgamegeek.com/boardgame/193927/vanuatu-second-edition)

Component uncertainties and implementation validation are recorded in the beta report.

## Beta review

Read [the beta report](docs/BETA-REPORT.md) before public release: the supplied ocean values and one outer board location still need confirmation. Bots are suitable for practice and automated coverage, not a claim of strong competitive play.

Guided lessons are available locally at `/?lesson=planning`, `/?lesson=fishing` and `/?lesson=islands`. Add `?players=2&new`, `?water&new` or `?hotseat&new` for practice variants. Practice progress stays in this browser.

Release: `pnpm build && pnpm test && pnpm test:browser`, then `node scripts/publish-private.mjs`. The publisher reads the admin token from `~/.bgs`, keeps the version private and checks the unlisted flag. It refuses to overwrite a public version. `node test/simulations.mjs` runs the longer complete-game sweep.
