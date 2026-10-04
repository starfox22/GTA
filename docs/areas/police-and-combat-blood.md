# Blood

What a wound leaves on the ground (blood.js; strikePerson in citylife-civic.js calls it).
Part of police-and-combat.md.

## The rule: a hit is not a pool

- One round: a short dark-red mist at the wound, 2-8 fine drops thrown out of the exit side
  (the shot's heading, a narrow cone), one directional **spatter** a step behind the body
  and a **drop** at its feet. Never a pool.
- A **pool** only under a body on the ground (`p.hp <= 0`): `bodyPool(p, kind, a)` starts it
  small (r 0.8) under the chest (4 units along the line of the shot, `deathStyle.turn`; at the
  wall's foot for a slump) and it spreads in `updateBlood` as a volume that flows out ever
  slower (`vol += (rMax² - vol)(1 - e^(-dt/tau))`, `r = √vol`). `rMax` grows with the number
  of wounds (`p.bloodHits`), not the damage: 4.2 units for one round, +1.1 a wound, 9 at most
  for gunfire; +2.2 for an impact or fall, +3.5 for a blast (11.5 at most). `tau` 14.5 s for
  one round, down to 7 s for many, 8 s for an impact or fall, 5 s for a blast (which also
  starts at r 3 and throws a radial spray). A later hit only raises `rMax`/lowers `tau`, never jumps the size.
- Anyone wounded who keeps moving drips a trail of small drops (wounds.js `updateWounds`).
- Wounded-down people (alive, crawling) do not pool; vest-stopped rounds do not bleed;
  poisoned bodies never bleed.

## Data and renderers

- `bloodPools` entries are decals: `{x, y, r, a, variant, stretch, surface, opacity}`, plus
  `rMax/tau/vol` for a spreading pool, `track` for tyre prints (physics-knockdowns.js; tyres
  pick blood up only from pools, r ≥ 2.5). `r` is the visible radius in world units
  (`bloodDecalScale`: 2.5 r across the stamp, × `stretch` along `a`).
- Stamps (`bloodStamp`): variants 0-3 pools (lobed, near black at the centre, a thin redder
  rim, no highlight), 4-7 spatters (a fan of drops along +x from the wound at the left:
  `addBloodSpatter` puts that origin on the point), 8-11 drops (scalloped edge). Landing
  flight drops become drops drawn out by their speed (game-update.js).
- The renderers only read: civic3d.js (size from `bloodDecalScale`, fade `bloodFade`, a
  slow darkening as blood dries) and `drawBlood2D`. The mist is a `mist` particle
  (render3d-frame.js draws it at its height, fading and spreading).
- Bounds: `BLOOD_LIMIT` 240 decals (the oldest non-pool goes first), `BLOOD_LIFE` 240 s.

## For other code

- `bleed(entity, severity, heading, kind)`: severity 0.25 a graze, ~0.5-1 a round, 2 a
  killing blast, max 2.5; `kind` 'ballistic' | 'headshot' | 'blast' | 'impact' | 'fall' |
  'melee'. It counts the wound and pools the body if it is dead. A thrown bike rider or a
  fall calls `bleed(rider, severity, heading, 'impact')`; a pool alone: `bodyPool(p, kind, a)`.
- Someone already down who is run over again (runover.js, docs/areas/people-and-crowd-vehicles.md): a
  splash (`bleed(p, sev, heading, 'impact')`, a living body does not pool), streaks along the tyre path,
  `c.bloodTrackRemaining` for the tyres, and the pool (`bodyPool`) once they have died a second or two later.
  A non-fatal first pass leaves no blood at all.
- Console: `bloodReport(x, y, radius)`, `bloodVictim(hits, damage, kind)` (docs/console/crowd.md).
  Test: tools/tests/blood-wounds.mjs.

## Blood on vehicles

A hit that hurts leaves a stain on the car (`addCarStain`, car-stains.js, called from knockPerson
and, for a second pass over someone down, runOverDowned with the real speed). It is data on the
vehicle: `c.stains`, at most 3 records `{id, t, face, x, z, sev, sx, sz, kph, seed, wash, reach,
flow, creep, hits, load, adds}` (the body-local point struck, severity, the direction the blood is
carried: inward and back along the airflow). How much is `carStainSeverity(kph, fatal)`: nothing
under 14 km/h (a crawl over someone leaves the bonnet clean), then `0.76 (1 - exp(-((kph - 14) /
37)^1.45))` for a death (0.05 at 20 km/h, 0.12 at 25, 0.47 at 50, 0.69 at 80, at most 0.76: a third
less per person than the old flat 0.62-1), 0.6 of that for a survivor; the painter makes a sev under
~0.18 a few small drops (`lite`/`few` in the paint context). PILING UP: once a car holds three
records, a hit on a face that has one tops up the nearest (`hits`, `load` = summed sev, the hit in
`adds` {x, z, sev, kph, seed}, at most 12, and `t` fresh again); only a hit on a new face replaces
the oldest. `reach` is the metres the airflow can drag it back (~1.5 m for a light hit, ~2.5 m for
a fatal one at 80 km/h: bumper to windscreen). `flow` (0-1) is how far it has
been dragged: `updateCarStainFlow` advances it every frame, only while the car runs faster than
4 m/s, so a car that keeps going blows the streaks the whole length of the bonnet in about a
second and one that stops dead stops them short; `creep` (0-1) is the gravity runs, advanced only
while the car is slow (18 s at rest). `updateCarStains` (every 0.5 s, only stained cars) washes
them in rain > 0.5 outside cover and retires them after 1500 s; `clearCarStains` runs from
`repairVehicle` and the garage service. `bloodOn` false stops new ones and hides the old.

- Renderer (carblood3d.js, `-paint`, `-streaks`, `-fit`, `-skin`): the only reader. One mesh
  (child of `m.body`), one material and one 1536x1024 canvas sheet per stained car, `CB_MAX_CARS`
  5 (out of sight / oldest retire; a retired skin goes back to a pool of one). Each stain is two
  512 px tiles: TOP (bonnet, fender tops, windscreen base, as long as `reach`) and FACE (bumper,
  grille or flank). A record's `adds` are painted over its own tiles by `cbTopUpJob` (each tile
  copied back from the sheet, the new impacts drawn over it with 'lighten' at their own offset and
  seed): no re-fit, nothing redrawn or blinking; `carBloodReport().skin.piled/piledPainted`. The boxes are laid out once per stain (`event.layout`) and every visible mesh
  triangle inside is clipped to them, lifted 0.1 units along its normal, UV-mapped; meshes another
  mesh covers (bonnet over shell) are skipped. It re-fits when `damageVersion` / `shapeVersion`
  change (crumple, hood hinge), the old geometry showing until the new one is committed.
- The sheet holds a FIELD, painted once, seeded: R thickness, G and B arrival values times the
  thickness (a soft edge keeps the ratio; the shader divides it back out): G when the airflow's
  streak reaches the pixel (shown once `flow` passes it), B when a gravity run does (once `creep`
  does). Strands grow at their own speeds, so they end ragged where the car stopped. TOP: impact
  mass + pad where the body slid, wipe fingers, a band of strands in bundles, thick beaded ropes,
  hairlines and veils, spray, mist, short runs toward the nose. The shader makes colour, cover,
  roughness and normals from thickness and the wet/dry look from the age (uniform `uBloodEv[3]`:
  birth, rain left, flow, creep per stain): wet crimson and glossy, dry brown-black by ~2 min, thick
  cores later; fade 200-1500 s; thin films barely glint. Never emissive; lit through
  `cityMaterialPatch` like the paint. Change colours only in the shader (paint has no colour).
- Cost (the first stain used to hitch): the fit and the paint are generators run in slices of
  `CB_BUDGET_MS` (3 ms, up to 9 on a slow frame) from the vehicle pass (`cbSlice`, one budget for
  every car); any yield point checks `cbOver()`. Gather (body-space copy of the meshes) is cached
  per vehicle type while its geometry is the shared one; the fit clips on typed buffers and the
  cover test reads a grid. A spare skin (canvas, uploaded texture, material) is made and the
  program compiled and linked while the title menu is up (`cbWarmStep`, again if the post pipeline
  changes); a painted tile goes to the GPU as `copyTextureToTexture` of the shared scratch tile,
  not the whole sheet. `carBloodReport().skin` shows slices, `work`, `warm` and `programs`.
- Gotchas: do not parent anything else raycastable to the skin (its `raycast` is a no-op so bullet
  marks pass through); a newly pushed pedestrian is struck only from the next frame; a headless
  software GL (SwiftShader) rasterises canvas work at the tile upload, so its slices look longer
  than on a GPU; new paint primitives must yield (`cbOver()`) and keep G, B as arrival x R.
- Test: tools/tests/car-blood.mjs (reach, flow, creep, drying, cap, rain, repair, garage); console
  `carBloodReport`, `carBloodMark`, `carBloodVictim` (docs/console/crowd.md).
