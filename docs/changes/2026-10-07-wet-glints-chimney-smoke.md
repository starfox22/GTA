# Wet streets mirror the lamps; real chimney smoke

- Rain at night: a street lamp in the wet road is now its head mirrored by the water, a soft glossy highlight
  that stretches into a long streak towards the viewer at street level (the chase view) and stays a faint spot
  just past the lamp's foot from the street camera; sharp and shivering in the puddles, soft over the damp
  film, broken by worn patches, nothing on dry crowns. The fixed smear every lamp laid south of its foot and
  the light map's pools streaked along the view (shop windows, neon spill) are gone. Monarch Isle's lanterns too.
- Wet asphalt reads darker and a little richer; standing water darker still.
- The 4x4 club's chimney (and the mountain village's chimneys, the club's fire ring and grill) now give thin,
  lit, blue-grey wood smoke that widens and fades as it rises, bends with the wind and wanders, a few chimneys
  by day and more at night. (The old puffs were hard flat cards: they were spawned without an opacity.)
- Internals: wet-glints3d.js (WET LAMP GLINTS: GGX lobe per lamp head over a per-frame list of up to 32,
  uniforms only, in the ground shader), chimney-smoke3d.js (`fxWoodSmoke`, `CHIMNEY_SMOKE`), the effect pool's
  `thin` field; `lookSwitches({ wetGlints, wetReflections })`. Console `wetGlints()`, `chimneySmoke()`;
  tests wet-glints.mjs, chimney-smoke.mjs.
