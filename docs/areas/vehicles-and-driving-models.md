# Vehicles and driving: models

Builders: render3d-vehicle-models.js (`makeVehicle`), cars3d-*.js (civilian cars and the Prestige Collection,
hypercars3d.js), police3d-*.js, motorbikes3d.js, helicopter3d-*.js, vehicles3d.js. Specs and handling:
vehicles-and-driving.md.

## Contracts and draw calls

- `makeVehicle` dispatches by type to the builders above. All civilian/police/helicopter
  models follow the **damage contract** damage3d.js reads: a lofted shell and a five-pane
  glasshouse (`PANE_ORDER`) shared until dented; hooks `liveryMap` / `liveryColor` /
  `finish`, `bumperMaterial`, `panelGeometry` / `trunkGeometry`, `glass`; lamps keep their
  keys and `lit` materials; `nightLights` are [head, tail] per side.
- Liveries are one canvas per body/livery painted in the shell's UV space, with a band of
  solid swatches that panels and damage parts sample: the whole paint is one material.
- Civilian glasshouses may curve (`glass.crown`, `screenCurve`, `backCurve`, metres;
  `glassPoint` / `glassCrown` in police3d-cabins.js): place anything on the roof with
  `glassPoint(g, l, w, 'roof', s, t)` or add `glassCrown(g, x, l)`, never `g.roof + g.arch`
  alone. The MULE VAN's shell runs up to its roof (its glasshouse is only the cab's screen and
  door glass; `hoodHinge`, `doorTop`); shell sections must keep ten points to blend.
- Draw-call budget: a civilian car 22 draws and 3 shadow casters (13 while pristine), a motorbike 11, a
  patrol car ~22 (fewer while pristine), helicopters 9-14. Zoomed out, cars pool into instanced impostors per type
  (BODY IMPOSTORS). **PRISTINE MERGE** (vehicle-merge3d.js): an untouched civilian or police car draws its
  non-casting static parts merged per material (hood + panels + paint bumpers, other bumpers, lamp pairs, a front
  wheel's tyre and rim, a rear axle's wheels; police: all wheels, never turned), the originals hidden underneath;
  `vehicleMergeEligible` (damage, stains, mud, burnt, carjack door, the player's car) sends it back to its parts for
  good, bumping `m.shapeVersion`. A new part that animates, changes material per side or is read by damage, blood
  or lights must stay out of the kit's plan (`vmCivilianPlan` / `vmPolicePlan`); `vehicleMergeAudit()` compares
  every merged mesh with its parts vertex by vertex, `vehicleMerges()` counts them. Report with `carModels()`, `helicopterModels()`; line-ups with
  `carLineup`, `policeLineup`, `helicopterLineup`.
- Looks are cached per vehicle in a WeakMap (`pickPoliceLook`, `helicopterLookFor`), not on it.
- Police lights run when `(c.cop && wantedStars > 0) || c.airUnit || c.gangTarget ||
  c.showLights`; `policeLightLevels` writes the flash pattern.
- `helicopterSearchlightMount(c, out)` returns the Nightsun lens in world space: the only
  thing searchlight3d.js takes from the helicopter model. Keep it when changing models.
- Helicopter liveries are generator jobs (`heliLiveryJob`) prewarmed behind the title, so the
  air unit's first call does not hitch.
- Motorbikes: the body's `rider` pose gives `riderSeat`; the character rig draws whoever
  rides (crowd3d RIDERS).
- Boat kit (boats3d.js): `loftHull`, deckhouses, railings; `tint(color, finish)` meshes are
  merged per finish by `kitMerge(group)`. Do **not** push kit-built groups into
  `batchGroups`: the static batcher drops vertex colours.
- Flagships: one traffic car in forty (`FLAGSHIP_TYPES`); SHOWCASE PARKING in
  game-populate.js (`showcase()`). The Prestige Collection and MONARCH MOTORS:
  places-monarch-and-county.md.

## Cabins and see-through glass (cars3d-interior.js)

- The civilian and police glass is see-through (CAR GLASS: `carGlassMaterial`, premultiplied alpha): the tint is
  `opacity` of the pane in front of the cabin, the sky's reflection lies over it unweakened and grazing angles turn
  to mirror (Fresnel). Past `CAR_GLASS_CLEAR` (24-36 m from the camera) the tint closes to `CAR_GLASS_FAR_TINT`, so a
  far cabin never shows empty. The body impostors keep the old opaque glass (`glassFar`, `policeGlass`); the
  4x4 club trucks still use `policeGlass`. Cracked and burst panes are damage3d.js's own (opaque) materials.
- See-through glass casts no shadow (the sun reaches the cabin through it): the paint panels (roof panel, pillars)
  cast instead, and the pristine merge's paint set casts when they do, so a car still has three casters.
- The cabin (`carCabinParts`: seats and headrests, dash and binnacle, wheel, mirror, parcel shelf, a patrol car's
  cage and laptop, the carpet over the shell top) is merged at the END of the kit's trim: no draw call of its own.
  `kit.trimOuter` is the same buffers with a shorter draw range, and the impostors pool that (no cabin far away).
  Anything added to the trim after the cabin would vanish from the impostors: add exterior trim before it.
- `carSeatPlan` is the one seat rule (kit.seats, `m.seats`): the drive-by's hip (driveby.js `driveBySeat`: 1.4 m
  behind the screen's foot, 0.42 m under the belt), lowered and laid back under a low roof, moved forward until the
  seat back is inside a short glasshouse; a rear bench only where its back fits under the rear glass
  (`CAR_TWO_SEATERS` never). A body may give its own (`seats`, the roadster's buckets). The model's seat may sit a
  little apart from `driveBySeat` (vans, hot rod, police: their game-side glass band is generic), so the drive-by
  pose can shift a few centimetres when the gun comes out there.
- The people (crowd3d-driveby.js SEATED OCCUPANTS): the vehicle pass queues cars (`queueCarOccupants` from
  `animateCivilianCar` / `animatePoliceVehicle`), `drawCarOccupants` (finishCrowd3D) seats the nearest
  `OCCUPANT_CAP` within `OCCUPANT_REACH` of the camera (keep it at or past `CAR_GLASS_CLEAR`'s far end): the player
  (unless the drive-by pose draws them), traffic drivers dressed by `driverColor` / `driverFemale` / `driverRole`, one
  passenger (`passengers`), a patrol car's two officers while `!crewDeployed`. Hands on the rim (`carWheelRim`), the
  'riding' pose with the seat's lie in `riderLean`.
- Road dirt toward the sills (civLiveryPatch ROAD DIRT): `m.dirt` is the paint's own uniform (amount, ground height),
  written by `animateCivilianCar` when it changes; impostors keep none.
- Report: `carModels()` gives each civilian model's `cabin` (hip, recline, rear bench, `headroom` over a seated
  crown, `behind` (headrest to rear glass, metres), `cabinTriangles`, `seated` people); tools/tests/car-cabins.mjs.
