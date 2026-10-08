# Rendering: wet streets at night (lamp glints)

How the street lamps show in a wet road, in the street view and the chase view (the rest of the wet look, the film,
puddles and the reflections pass: rendering-weather.md).

## WET LAMP GLINTS (wet-glints3d.js, in surfaces3d.js `GROUND_WET_LIGHT`)

- A street lamp in the wet road is its head mirrored by the water: a GGX highlight per lamp of a per-frame list
  (`cityGlintA/B/Count`, up to `WET_GLINT_SLOTS` 32: MEDIUM 16, LOW none), with the wet surface's own roughness
  broken up by a two-scale roughness texture, and two lobes (the film's narrow core, the surface's skirt): a puddle
  mirror-sharp and rippled, the film soft, worn patches dimmer, dry crowns nothing. Water's Fresnel (F0 0.02) makes
  a faint spot south of each lamp's foot from the street camera and a long bright streak towards the lens at a
  grazing view; the head's size widens the lobe (no pin-points, no discs).
- The list: the lit lamps nearest the view (the chase view: in front of the lens; those a building hides from the
  lens fade out, a few tested a frame with `chaseHiddenFrom`), each fading in and out over a third of a second; the
  blackout's district power and lamps knocked flat count. Console `wetGlints()`.
- The light map is not read for reflections any more (its pools smeared into streaks where no lamp stood), and the
  fixed additive smear each lamp laid south of its foot is gone. The reflections pass compresses hits far brighter
  than a lit facade (a lamp is not mirrored twice). The street view lifts the glint (`streetGain`: the game's
  compressed range) where Fresnel leaves 2 %. `citySheenDir` 0 stays the street-level flag (the film's flat sky).
- Sources: `wetGlintSources` (built on the first wet night): the city's `lamps` (head `LAMP_HEIGHT` - 1.2 at
  `l.x + 6`, colour `lampTint`) and Monarch Isle's `monarchLamps` (a third of a lamp's strength). Bridge lamps
  still lay a fixed `addStreak` (bridge decks have no glint shader), so do signs (signage3d.js).
- Look numbers (`WET_GLINT`): `intensity` 1500, `streetGain` 4, `chaseGain` 1.8; `wetGlints({ intensity,
  streetGain, chaseGain })` sets them live for an A/B, `lookSwitches({ wetGlints: false })` turns them off and
  `lookSwitches({ wetReflections: false })` the reflections pass.
- Cost: no new program or draw call (uniforms in the ground's program; the ~850 lamp streak instances are gone from
  the neon streak mesh); per wet ground pixel at night a loop over at most 32 (MEDIUM 16) lamps.

Gotchas: the GLSL reads `material.roughness` (three's, after its specular anti-aliasing), `wetReflect`, `puddle` and
`fp` from the ground shader's own scope; it runs only where `wetReflect` > 0, the lamps are lit and the list is
not empty. The street camera is orthographic: the eye direction is the view matrix's third row there.
