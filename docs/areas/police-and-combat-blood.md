# Blood

What a wound leaves on the ground (blood.js; strikePerson in citylife-civic.js calls it).
Part of police-and-combat.md.

## The rule: a hit is not a pool

- One round: a fine entry puff toward the shooter (it lands nowhere), a short dark-red mist at
  the wound height and an **exit spray** away from the shooter (the shot's heading `a`): a
  plume carried a metre or two on, fine drops in a cone landing 1-4 m beyond the body, a
  directional **spatter** 3-7 units behind it (more, further on, from a heavy round) and a
  **drop** at its feet leaning to the exit side. Nothing lands toward the shooter. Never a
  pool. The body is not moved.
- HOW MUCH (bloodShotPlan, deterministic: console `bloodPlanTable`): gore.js goreHit's `scale`
  by calibre, range and zone (police-and-combat-gore.md) multiplies the drops (3 + 4 x severity,
  at most 48), the plume, the spray's speed, cone and the spatters (at most 5); a pistol round at
  mid range is scale 1 (the old spray). A point-blank load, a .50 or a close blast adds a
  **burst** (`bloodBurst`: tissue lumps, a heavy mist, spatter up to ~4 m).
- WALLS AND VEHICLES (`bloodSprayObstacle`): the first building face or vehicle along the spray
  within its `reach` (2.8 m for a pistol, ~6-7 m for a point-blank load) takes it: wall splashes
  (`wall` decals with the face's normal, a radial burst with drips running down; their `surface`
  is the height) or a stain through `addCarStain(c, point, 0, false, sev)` (car-stains.js: a
  gunshot's spray brings its own severity, the car standing or moving). The flying drops stop
  there (`stopX/stopY`); ground spatter never lands past the wall.
- Landing drops (`landBloodDrop`): a drop is 0.4 of its flying size on the ground (a centimetre
  or few), drawn out by its speed; one landing where a body's pool will spread is lost in it, one
  on a fresh drop adds to it, and fine ones leave no mark more than half the time (round drops
  overlapping in a pool read as bubbles).
- A **pool** only under a body on the ground: `bodyPool(p, kind, a)` (sizes in `bodyPoolPlan`,
  POOL SIZE) starts it at r 1.2 under the chest (4 units along the line of the shot,
  `deathStyle.turn`; at the wall's foot for a slump) and it spreads in `updateBlood` as a volume
  that flows out ever slower (`vol += (rMax² - vol)(1 - e^(-dt/tau))`, `r = √vol`). `rMax` grows
  with the number of wounds (`p.bloodHits`), not the damage: 7 units (1.75 m across) for one
  round, +0.9 a wound, 10 at most for gunfire; 8.5-13 for an impact, fall or blast; a body that
  lost a part 2.5 more (13.5 at most). `tau` 6.5 s for one round, down to 3.5 s for many (most of
  the spread in 10-15 s), 4 s for an impact or fall, 3 s for a blast (which also starts at r 3 and
  throws a radial spray). One round: r ~3 at 1 s, 6.2 at 10 s, 7 at 30 s (6 before October 7).
  A later hit only raises `rMax`/lowers `tau`.
- Someone wounded on the floor (alive: `woundedDown` crawling, officers `downed`) who lies still
  1.5 s bleeds a small pool (`bodyPool(p, 'wounded')`, r 2.6-4, tau 9, `wounded: true`) where they
  lie (wounds.js `updateWounds`); crawling on freezes it at its size; dying there grows it into the body's.
- Anyone wounded who keeps moving drips a trail of small drops (wounds.js `updateWounds`).
- Vest-stopped rounds do not bleed (police-and-combat-armour.md); poisoned bodies never bleed.

## Data and renderers

- `bloodPools` entries are decals: `{x, y, r, a, variant, stretch, surface, opacity}`, plus
  `rMax/tau/vol` for a spreading pool, `track` for tyre prints (physics-knockdowns.js; tyres
  pick blood up only from pools, r ≥ 2.5), `wall` + `nx, ny` + `building` for a wall splash.
  `r` is the visible radius in world units (`bloodDecalScale`: 2.5 r across the stamp, ×
  `stretch` along `a`).
- Stamps (`bloodStamp`): variants 0-3 pools (lobed, near black at the centre, a thin redder
  rim, no highlight), 4-7 spatters (a fan of drops along +x from the wound at the left:
  `addBloodSpatter` puts that origin on the point), 8-11 drops (scalloped edge), 12-15 wall
  splashes (+y down the wall: drips). Landing flight drops: `landBloodDrop` (game-update.js).
- The renderers only read: blood3d.js (every decal in ONE instanced draw from one atlas of the
  stamps and the tread; a wall splash stands on its face, lifted by damage3d-decals.js
  `wallOffset`; transparent, renderOrder 3; rewritten only when the list changes, a pool spreads
  or every 0.5 s; `bloodDecalReport`) and
  `drawBlood2D` (walls left out; blood particles drawn round, never squares). Fire, smoke,
  sparks and drops are the effect particle pool (rendering-effects.md), drawn at `FX_SPRITE_ORDER` 8
  (render3d-effects.js): with the default 0 the floor blood was painted over an explosion's fireball
  (transparent objects sort by renderOrder before depth, and none of them write depth). The mist is a `mist`
  particle (fx3d-particles.js draws it at its height, fading and spreading).
- THE LOOK (blood3d.js; one program, the state per instance in `aBloodLook`: fade, dryness,
  wash): fresh blood is wet, deep dark red and glossy, its specular cut to a tenth, softly capped
  and half tinted red, so a low sun at a grazing angle lights a small glint, never the orange-brown
  wash a satin film took on (the sun's specular made it, not the colour). It dries from 15 s over
  three minutes to a darker matte brown-red, the thin film first (the stamp's darkness is its
  thickness: rims and fine drops before a pool's middle).
- RAIN (`washBlood`, every 0.5 s): on open ground in rain over 0.3 a decal thins (`wash`, ~a
  minute of a downpour to the full) and spreads up to a fifth wider; drawn lighter, pinker,
  fainter and wet again. Not under cover, on walls or in tyre tracks.
- Bounds: `BLOOD_LIMIT` 480 decals (the oldest non-pool goes first; was 240 meshes, now one
  draw), `BLOOD_LIFE` 240 s. Randomness: gore.js `goreRandom` (blood never draws on the seeded
  game stream).

## For other code

- `bleed(entity, severity, heading, kind, hit)`: severity 0.25 a graze, ~0.5-1 a round, 2 a
  killing blast, max 2.5; `kind` 'ballistic' | 'headshot' | 'blast' | 'impact' | 'fall' |
  'melee'; `hit` (optional) gore.js goreHit's scratch from strikePerson. It counts the wound,
  records it on the clothes (gore.js `goreWound`, rounds and blades) and pools the body if it
  is dead. A thrown bike rider or a
  fall calls `bleed(rider, severity, heading, 'impact')`; a pool alone: `bodyPool(p, kind, a)`.
- Someone already down who is run over again (runover.js, docs/areas/people-and-crowd-vehicles.md): a
  splash (`bleed(p, sev, heading, 'impact')`, a living body does not pool), streaks along the tyre path,
  `c.bloodTrackRemaining` for the tyres, and the pool (`bodyPool`) once they have died a second or two later.
  A non-fatal first pass leaves no blood at all.
- Console: `bloodReport(x, y, radius)`, `bloodVictim(hits, damage, kind)`, `bloodSides(x, y, a, radius)`
  (docs/console/crowd.md). Tests: tools/tests/blood-wounds.mjs, tools/tests/bullet-hits.mjs (exit spray).

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
