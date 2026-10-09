# Vehicles and driving: models

Builders: render3d-vehicle-models.js (`makeVehicle`), cars3d-*.js (civilian cars and the Prestige Collection,
hypercars3d.js), police3d-*.js, motorbikes3d.js, helicopter3d-*.js, vehicles3d.js. Specs and handling:
vehicles-and-driving.md.

## Contracts and draw calls

- `makeVehicle` dispatches by type to the builders above. All civilian/police/helicopter
  models follow the **damage contract** damage3d.js reads (crumple and marks: vehicles-and-driving-damage.md): a lofted shell and a five-pane
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
- CHEVETTE Z06 (cars3d-bodies-b.js, after the C8 Z06): its glass keeps the numbers of damage-vehicles.js
  `CAR_GLASS_BANDS` (belt 0.88, roof 1.22, rear foot -0.42, screen foot 0.13) with a `crown` over the driver; the
  Z06 Carbon Aero (hypercars3d.js `chevetteSE`) spreads its body and details and adds the tall wing; the ZR1X is a
  body of its own. A change to a body's glass keeps CAR_GLASS_BANDS in step and `cabinHeadroom()` at zero `through`.

## Downloaded models

The traffic cars, the Crown Vic patrol body and the motorbikes drawn from downloaded models (the converter, the
kits, what each type keeps): vehicles-and-driving-models-assets.md.

## Cabins, headroom and rear badges

The glass, the cabins, the seat plan, the seated people's headroom and the badges on the tails:
vehicles-and-driving-cabins.md.
