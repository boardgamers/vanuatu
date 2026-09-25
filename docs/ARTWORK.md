# Board artwork

The interactive board uses cleaned derivatives of the supplied publisher artwork. Original component images remain in `viewer/assets` for reference and tile-selection cards. Their existing rights notice still applies.

The built-in image-editing tool was used on 25 September 2026. Outputs were inspected, resized to 640 × 640 and encoded as WebP. The engine's component values were not changed.

| Original                     | Board derivative                   |
| ---------------------------- | ---------------------------------- |
| `viewer/assets/efate.webp`   | `viewer/assets/efate-board.webp`   |
| `viewer/assets/tile-7.webp`  | `viewer/assets/tile-7-board.webp`  |
| `viewer/assets/tile-9.webp`  | `viewer/assets/tile-9-board.webp`  |
| `viewer/assets/tile-19.webp` | `viewer/assets/tile-19-board.webp` |
| `viewer/assets/tile-21.webp` | `viewer/assets/tile-21-board.webp` |

Sea tiles use the existing `viewer/assets/ocean.webp` texture, with live resource badges and player boats rendered in SVG. They no longer display decorative printed boats or static resource values underneath the live state.

## Editing prompts

For each island tile (7, 9, 19, 21):

> Edit this exact supplied board-game island tile for a digital adaptation. Preserve its EXACT overhead hand-painted island silhouette, position, relative size, vegetation, sand, turquoise water, colours, tiny scenery huts, beach umbrellas and piers. Remove ONLY printed game overlays: white tourist pawn and number near top/side, all thin rectangular building-slot outlines and thin circular scoring-slot outlines, and the colored resource cubes near the bottom. Also remove tiny boats in the water. Fill small removed areas seamlessly from the adjacent water/sand/vegetation texture. Keep the same 1:1 square framing and scale, do not zoom the island or recompose. Extend matching turquoise water to fill the whole square outside the original irregular water-tile edge, without a black/white/transparent border. No new icons, text, numbers, slot markings, outlines or scenery. Restrained cleanup of publisher art, not redesign.

For Efate:

> Edit this exact square board-game island tile image for a digital adaptation. Preserve the same overhead hand-painted art, EXACT island silhouette, size, placement, colours, palms, sand and water texture. Remove ALL printed game overlays only: the white pawn with number 5 at left; the partly visible number/counter at top edge and top right; thin rectangular building boxes, the large thin circular scoring outline at bottom left, colored red/white/green resource cube symbols at lower right, and the faint thin hexagonal board-grid outlines. Fill those small areas seamlessly with adjacent original ocean/sand/vegetation texture. Keep tiny scenery huts, beach umbrellas and pier. No icons, numbers, text, geometric game outlines or new scenery. Return the same 1:1 square composition, full bleed water background. This is restrained cleanup of supplied publisher art, not a redesign.
