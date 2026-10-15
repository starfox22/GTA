# Vehicles and driving: rear badges

Model names and emblems share the existing vehicle trim atlas. Cabins and seated occupants: [cabins and headroom](vehicles-and-driving-cabins.md).

## Rear badges (cars3d-badges.js REAR BADGES)

- Every civilian and Prestige car carries its model name on the tail (`CAR_BADGES`: text, style, height over the
  ground, offset across, capital height, colour, finish, an optional second badge and round emblem); types not listed
  get the last word of their game name (`VEHICLE_DEFINITIONS[type].name`) over the plate. Letters are 4-6 cm capitals
  (the pickup's tailgate 8.5), a little larger than real ones so the chase camera reads them.
- The glyphs live in the trim atlas's lower half (512 x 1024 now: `trimCellRect` maps the sixteen cells into the top
  half; the atlas is on `bakedCanvases`). Three styles: 'block', 'wide' (spaced capitals), 'italic'. Each letter is one
  quad on the tail's own surface (`k.surf` / `k.normalAt`), merged into the trim before the cabin (`rawUv` in
  civAddMatrix): no texture, material, program or draw call of its own. The trim material alpha-tests
  (`alphaTest` 0.5): only the glyph cells have transparent pixels; on the small mips the letters drop under the test
  and simply go. A new atlas cell keeps opaque pixels.
- Other vehicles, no draw call added either: police kits (their trim takes the atlas, `policeSolidUv` sends its other
  vertices to the solid cell; POLICE or SHERIFF across a marked trunk, `POLICE_MODEL_BADGES` right of the plate; the
  kit key includes `policeRearWord`), the 4x4 club (`CLUB_BADGES` on a tailgate corner, clear of the plate, a hung
  spare's disc and a ladder or carrier, `CLUB_BADGE_LEFT`; its per-vehicle trim material alpha-tests the atlas),
  motorbikes (`MOTO_BADGES` on both tank or fairing sides), the flatbed (ATLAS on its headache rack), the box truck,
  ambulance and bus (`BADGE_PANELS`: a canvas on a panel that was already a mesh; the bus's two flank bands became one
  box to pay for its tail panel) and the army (`MILITARY_STENCILS`, base3d-vehicles.js: stencils and stars share one
  texture and material, so mergeUnder keeps them one mesh). Console `carBadges()`.
- Crumpled cars (damage3d-crumple.js) bend the trim, badges included, with the shell.
- Placing one: keep it off lamps, the plate (y +/- 6 cm, 26 cm either side), pipes, emblems and light bars, and give it
  a `lift` past any trim panel under it (letters stand 1.2 cm proud by default; patches lie 1-2 cm off the paint).
  `carModels()` lists each model's `badge` {text, sub, letters}; tools/tests/rear-badges.mjs checks every letter is
  laid and the draw count.
