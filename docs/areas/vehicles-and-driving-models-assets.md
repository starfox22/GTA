# Vehicles and driving: downloaded models

Types drawn from downloaded ready-made models (assets/vehicle-models.bin + vehicle-atlas.webp, made offline by
`tools/vehicle_models.py SRC_DIR`; motorbikes through tools/vehicle_models_moto.py). The contracts the models keep are
vehicles-and-driving-models.md's; credits in docs/THIRD_PARTY_CREDITS.txt. Console `assetCars()`,
`assetCarsOn(false)` (models built from then on procedural: park a second row for before/after).

## Cars (ASSET CARS, vehicle-assets3d.js)

- Sedan, taxi, coupe, sport, supercar and luxury are drawn from downloaded CC-BY cars (Daniel Zhabotinsky's
  series; credits in THIRD_PARTY_CREDITS.txt), converted offline by `tools/vehicle_models.py SRC_DIR` into
  assets/vehicle-models.bin + vehicle-atlas.webp (2048x1024, one trim material, two wheel materials). `makeVehicle`
  takes `makeAssetCar` when `vehicleAssetModel(type)` has one, else the procedural body (a build without the block
  falls back by itself). Muscle and rally stay procedural (the four-door '73 is no muscle car; the rally loses its
  livery), as do every other type; only replace a type where the model clearly looks better and loses nothing.
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
