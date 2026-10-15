# Vehicles and driving: downloaded models

Downloaded kits retain the common damage, seats and impostor contracts
(vehicles-and-driving-models.md). The original vehicle pack and atlas come from
`tools/vehicle_models.py`; credits are in `docs/THIRD_PARTY_CREDITS.txt`.
`assetCars()` reports models; `assetCarsOn(false)` selects procedural builders for
newly spawned vehicles, useful for before/after comparisons.

October 14 replacements use a **separate** pack and albedo/roughness-metallic atlases;
all original 23 models stay intact. See [approved SUVs](vehicles-and-driving-models-approved-suvs.md),
[motorcycles](vehicles-and-driving-models-motorcycles.md), and `approvedAssets()` for
loaded keys, atlas sizes and LODs. Source UVs repeat inside each atlas rectangle.
Low/Medium use 2048px images; High/Ultra use 4096px, replacing texture images on tier
changes. Approved PBR/livery also pass through pooled wear/char shaders.

October 15: the base Chevette Z06 uses the separate
[licensed C8 pack](vehicles-and-driving-models-sports.md). SUV source shading is
covered by [source fidelity](vehicles-and-driving-source-fidelity.md), and real
openings by [front doors](vehicles-and-driving-doors.md). The carbon-aero Chevette
SE keeps its existing body and equipment.

## Cars (ASSET CARS, vehicle-assets3d.js)

- Sedan, taxi, coupe, sport, supercar, luxury and muscle (American Muscle '71) are drawn from downloaded CC-BY cars
  (Daniel Zhabotinsky's series; credits in THIRD_PARTY_CREDITS.txt), converted offline by `tools/vehicle_models.py
  SRC_DIR` into assets/vehicle-models.bin + vehicle-atlas.webp (4096x2048 since round three, one trim material, two wheel materials).
  `makeVehicle` takes `makeAssetCar` when `vehicleAssetModel(type)` has one, else the procedural body (a build without
  the block falls back by itself). Rally (its livery) and hotrod (the HELLFIRE's flames and blower; the Coupe '33 was
  tried) stay procedural, as do every other type; only replace a type where the model clearly looks better and loses
  nothing. Mirrors that carry the original license.txt are fetched under SRC_DIR/mirror/.
- Decimation knobs per model: `keep` shares, `borderCos` (how far a seam or border run may bend and still collapse:
  0.985 by default, 0.7-0.85 for the muscle car, the bike and the boat), `minPiece` (pieces smaller than this many
  metres left out: bolts and clips), `texCap` (the largest atlas tile, 512 px by default).
- The kit (`vaKit`) has civKit's shape: shell/panels/hood in the car's paint on a clear livery (the taxi's paint is
  its texture: `paintTexture`, `liveryColor` white), five-pane glass, trim with the cabin last (`trimOuter`), four
  lamps with baked vertex colours, wheels about their centres (tyre first). No bumpers (the crumple bends them with
  the body); no game badges (the model's own). The hood hinges at the model's hinge (`m.hoodHinge`).
- The converter measures the glasshouse into a CAR_BODIES `glass` record (belt, roof with a `crown` from the roof
  line, screen and rear glass feet and tops, widths); the seat fit starts 1.15 m behind the screen's foot
  (`carSeatPlan` `own.hipX`). A changed model re-records DRIVEBY_SEATS (cabin-headroom test) and CAR_GLASS_BANDS
  (the model's numbers at the type's length). Fronts are fixed per model (`front`), checked in a side view.
- Budget: decimated (quadric half-edge collapse, seams and creases kept) to the procedural bodies' triangles or
  fewer (supercar +7 %); draw calls the same (13-14 pristine). `assetCars()` reports, `assetCarsOn(false)` builds
  models made from then on procedurally (before/after rows).

## Burnt, worn and wet (ASSET CHAR, vehicle-char3d.js)

- The shared atlas materials (`vaMaterials`) and the asset cars' one-texel paint UVs cannot take the procedural soot map,
  so a burnt model with atlas parts swaps its atlas and paint meshes (door panels' `[paint, bay]` arrays too, and parts
  the damage adds later, on a `shapeVersion` change) onto per-car char materials: soot projected in each mesh's frame in
  world units on three planes, matte, embers in the emissive (`assetCharEmbers`). An army model (`m.atlasPaint`) also
  takes the wear's grime and the fire's heat through them. Intact models keep the shared materials and the merge; a
  repair or respray swaps back (`assetCharRelease`, materials pooled). Programs (cut-out, atlas, plain, military vertex finish, approved PBR and approved livery), compiled
  at the title prewarm (`assetCharWarm`, kept in sharedMaterials). Draw calls unchanged. Console `assetChar()`,
  `burnVehicle(id, ago, mend)`.
- Each released char-material pool keeps at most 12 materials; overflow is disposed immediately so repaired cars
  do not retain GPU program references. Vehicle paint caches wear, heat and colour separately: unchanged paint
  allocates no string per frame, and distinct damage states cannot collide in the cache.
- Wipers: the truck types (box truck, bus, ambulance, pickup; Vinny's cab) take the procedural pair (`addWipers`) at the
  foot of the measured windscreen, arms capped to the glass's height (`reach`); swept in the rain as before.

## Police: the Crown Vic body (POLICE ASSET BODY, police3d-asset.js)

- `policeLookChoice` / `pickPoliceLook` still choose body and livery; only the 'crownvic' body is drawn from the
  80 American Police Sedan (`look.asset`, impostor key `...:asset`), in every livery (bw, modern, sheriff, unmarked).
- The livery canvas is the procedural crownvic's (`policeLiveryTexture`); the model's shell gets UVs in its frame by
  projecting each vertex on the crownvic's section ring scaled to the model's own section (`section`: bottom, top,
  half width at 41 stations, measured by the converter). Pillars and roof take the roof / pillar swatches (triangles
  unshared where they meet), the hood its swatch. A new police livery needs nothing more.
- The bar's lenses (`nodeRoles` 'beacon') are the light mesh: eight segments across the car on channels 0-4 (red left,
  white takedowns, blue right) with impostor beacons and halo anchors; the housing ('lightbar') joins the trim. The rear
  window bar (5/6) as the procedural; unmarked cars drop the bar and get the dash, grille and deck lights.
- Roof, trunk and fender numbers sit on the model's surfaces (`kit.roofDecal`, `trunkDecal`, `sideDecal`, read by
  `policeDecalGeometry`). Rear badges, mirrors, push bar and wheels are the model's own; no running-light strips.
- 11 draws pristine (21 procedural), 3 shadow casters (11), ~10k triangles. DRIVEBY_SEATS `'law:crownvic'` is the
  model's seat (re-record with `test.mjs --render cabin-headroom` after a model change).

## Motorbikes

Downloaded motorcycle parts, source unsteering, recorded rolling axles, front tyre rigs,
steering/lock/spin animation and validation: [motorcycle models](vehicles-and-driving-models-motorcycles.md).

## Military vehicles

Shared immutable geometry, the HMMWV's original lamp lenses, matte coatings,
single-draw tyre/hub finish, steering and far LOD: [military models](vehicles-and-driving-models-military.md).

## Boats (ASSET BOATS, boat-assets3d.js)

- `kind: 'boat'` models (tools/vehicle_models_boat.py): the HARBOR LAUNCH ('workboat') is the Tow Boat, scaled to
  9 m with its waterline (`waterline` m over the lowest point) at y 0; one alpha-tested body, the clear panes, a mast
  lamp; wakes and handling are the type's. The sponsor, outboard and radar names are erased in the texture.
- Held back (`ASSET_BOATS_HELD`): beside the procedural launch the Tow Boat read flatter and lost the paint colour, so
  the lead kept the procedural boat (owner rule: only upgrades); round three dropped it from the bin (every boat is
  procedural now; `ASSET_BOATS_HELD` waits for a better model).

## Tried and kept procedural

- Helicopters: the MD-500 Defender (camouflage, a gun pod, no door gunners: not the Black Hawk the military type and
  MOUNTED_GUNS are). The Bell 429 replaces no look: it is the extra SKYRANGER 429 civil helicopter
  (vehicles-and-driving-models-aircraft.md).
- Hot rod (the Coupe '33 lacks the HELLFIRE's flames and blower), the private bicycle (the Old Bicycle's thin frame and
  grey tyres read weaker; the converter's `crank` role and the runtime's crank are ready for another model), the
  fishing boat (no type; untextured), the NR750 and the Draco-only motorbikes (see Motorbikes).
