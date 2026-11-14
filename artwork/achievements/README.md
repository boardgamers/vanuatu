# Vanuatu achievement artwork

Original warm island vector compositions for the 16 existing achievements.
Tracking: https://codeberg.org/boardgamers/boardgamers/issues/595

## Provenance and editing

All geometry in `scripts/achievement-art.mjs` was newly drawn for this change;
no publisher art, photographs, downloaded icons, fonts, or traced paths are inputs.
The original geometry in that script and its generated SVG/PNG artwork is dedicated
to the public domain under CC0-1.0 (https://creativecommons.org/publicdomain/zero/1.0/).
System sans-serif is used only to render supplementary threshold digits.

`viewer/art.js` at baseline commit `9fefc927595df49b939cad14e96d068a0b7ecf3e`
provides semantic vocabulary only: sail/boat, build/hut, point/shell, coin/vatu,
explore/chest, tourist/pawn, marker/stack, dike and water. No path or source bytes
from it are copied. This avoids assumptions about publisher derivative rights.

Run `pnpm install --frozen-lockfile`, install Playwright Chromium if needed, then
`pnpm art:achievements`. The generator is the editable source; individual SVGs
are also editable vector exports. Chromium renders transparent 256px PNGs offline,
with no server or database. The export manifest records source and asset SHA-256s.
Regenerate after changing or formatting the generator. Renderer/font differences
may change raster bytes; use the checked-in PNGs as the reviewed upload candidates.
Contact sheets show 32/48/64/96px circular images on light and dark backgrounds.

Count-specific victories contain exactly 2/3/4/5 outrigger boats respectively.
Four huts and three occupied islands are literal. Score/cash/treasure/tourism
numbers represent thresholds, not counts of decorative objects. Flood survival
uses an eight-dot completed-round ring and dike without a victory flag; flood
victory has a flag. The no-characters award uses a crossed empty card beside
action tokens, not a portrait. Ordinary tourism pawns denote visitors only.

## Contract and review

`baseline.json` is the revision-1 manifest from engine 0.2.1. Tests require identical
IDs/names/descriptions, a pinned unchanged evaluator hash, protocol-0.11 schema,
complete asset references, exact boat counts, unique hashes and decoded dimensions.
Engine 0.2.2 / manifest revision 2 changes only icon references and revision.

Canonical release target is Codeberg `boardgamers/vanuatu`, branch `main`;
configured public mirror is GitHub `boardgamers/vanuatu`, branch `main`.
No assets or engine have been uploaded or activated. Independent code and actual
visual review are required before publication. Do not use broad metadata publisher
scripts: subsequent publication must upload only these 16 keys and activate only
the exact tested engine package, preserving viewer/settings/visibility metadata.
