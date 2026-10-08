# Rendering: wet streets at night (lamp glints)

How the street lamps show in a wet road, in the street view and the chase view (the rest of the wet look, the film,
puddles and the reflections pass: rendering-weather.md).

## WET LAMP GLINTS (wet-glints3d.js, in surfaces3d.js `GROUND_WET_LIGHT`)

- A street lamp in the wet road is its head mirrored by the water: a GGX highlight per lamp of a per-frame list
  (`cityGlintA/B/Count`, up to `WET_GLINT_SLOTS` 40: MEDIUM 20, LOW none; lit signs take at most 10/5 of them), with the wet surface's own roughness
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
  `l.x + 6`, colour `lampTint`), Monarch Isle's `monarchLamps`, and everything registered while the world is built
  with `addWetGlint` / `addWetGlintIn` (lighting3d-sky.js `wetGlintExtras`): bridge deck lamps (`bridgeGlint`:
  truss, cobra and globe posts, the Coronation Bridge, the drawbridge leaves' lamps, which follow the leaf as it
  moves), the mountain villages' lanterns, the county towns' street lamps, and lit signs facing a street
  (`signSpill` with a `streak`: a wide, soft coloured source at the sign's height, kind `sign`).
- Surfaces that draw them, each in its own program (no new one): the ground sheets (city, county, Monarch, pier,
  fort, hills), the bridge road (`bridge-road`) and the county scenic roads (`scenic-road`), through
  `wetGlintPatch(shader, wet, puddle, footprint)`. Not drawn: roofs, the mountain villages' cobble decals, the
  terrain of the range (`ridgeline-terrain`: no wet film), boat decks. Nothing lays a fixed `addStreak` any more
  (the neon streak mesh stays hidden while empty).
- Look numbers (`WET_GLINT`): `intensity` 1500, `streetGain` 4, `chaseGain` 1.8; `wetGlints({ intensity,
  streetGain, chaseGain })` sets them live for an A/B, `lookSwitches({ wetGlints: false })` turns them off and
  `lookSwitches({ wetReflections: false })` the reflections pass.
- Cost: no new program or draw call (uniforms in the ground's, the bridge road's and the scenic road's programs;
  the lamp and sign streak instances are gone and the streak mesh with them); per wet pixel at night a loop over
  at most 40 (MEDIUM 20) sources. After the title prewarm, starting rain at night links no program on any tier
  in either view.

Gotchas: the GLSL reads `material.roughness` (three's, after its specular anti-aliasing), `wetReflect`, `puddle` and
`fp` from the ground shader's own scope; it runs only where `wetReflect` > 0, the lamps are lit and the list is
not empty. The street camera is orthographic: the eye direction is the view matrix's third row there.
