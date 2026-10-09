# Vehicles and driving: downloaded models

Types drawn from downloaded ready-made models (assets/vehicle-models.bin + vehicle-atlas.webp, made offline by
`tools/vehicle_models.py SRC_DIR`; motorbikes through tools/vehicle_models_moto.py). The contracts the models keep are
vehicles-and-driving-models.md's; credits in docs/THIRD_PARTY_CREDITS.txt. Console `assetCars()`,
`assetCarsOn(false)` (models built from then on procedural: park a second row for before/after).

## Cars (ASSET CARS, vehicle-assets3d.js)

- Sedan, taxi, coupe, sport, supercar, luxury and muscle (American Muscle '71) are drawn from downloaded CC-BY cars
  (Daniel Zhabotinsky's series; credits in THIRD_PARTY_CREDITS.txt), converted offline by `tools/vehicle_models.py
  SRC_DIR` into assets/vehicle-models.bin + vehicle-atlas.webp (2048x2048, one trim material, two wheel materials).
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

## Motorbikes (ASSET MOTORBIKES, motorbike-assets3d.js)

- `kind: 'moto'` models (tools/vehicle_models_moto.py): the VORTEX 900 ('bike') is the Honda CB 750 F (1970). The
  converter splits frame paint / trim, the steering (everything wholly ahead of the steering axis moved back `reach`,
  and the bars above `bars`; hints `axis`, `bars`, `seat`, `pegs` in the game frame), the head lamp (in the fork), the
  tail lamp and both wheels; brand badges go by material (`roles` 'drop') or `erase` rectangles in the texture.
- The kit puts the steering geometry in the fork pivot's frame (axis top, tilted by the model's `rake`), the front wheel
  under it; `m.rearAxleX` is the wheelie's pivot (animateMotorbike); the rider's pose (`riderSeat`, the stand-in
  `motoRiderGeometry(type, pose, scale)`) comes from the measured saddle, grips and pegs.
- Kept procedural: dolcati, yamasaki, cruiser, kr500 (the matching models are Draco-compressed with no plain mirror on
  GitHub, or their paint and maker's logos are baked into one texture: the NR750 cannot take the traffic colours).
- 11 draws (as procedural), ~14k triangles with the rider stand-in (procedural 6.9k).

## Boats (ASSET BOATS, boat-assets3d.js)

- `kind: 'boat'` models (tools/vehicle_models_boat.py): the HARBOR LAUNCH ('workboat') is the Tow Boat, scaled to
  9 m with its waterline (`waterline` m over the lowest point) at y 0; one alpha-tested body, the clear panes, a mast
  lamp; wakes and handling are the type's. The sponsor, outboard and radar names are erased in the texture.
- Held back (`ASSET_BOATS_HELD`): beside the procedural launch the Tow Boat read flatter and lost the paint colour, so
  the lead kept the procedural boat (owner rule: only upgrades). The data stays in the bin; drop it from the converter
  at the next regeneration, or take it off the held list if a better boat model replaces it.

## Tried and kept procedural

- Helicopters: the MD-500 Defender (1.9k triangles, camouflage, a gun pod, no door gunners: not the Black Hawk the
  military type and MOUNTED_GUNS are) and the Bell 429 (83k triangles, one painted scheme) would drop the per-look
  liveries painted on the surface (police, news, executive, the civil schemes) and the door guns.
- Hot rod (the Coupe '33 lacks the HELLFIRE's flames and blower), the private bicycle (the Old Bicycle's thin frame and
  grey tyres read weaker; the converter's `crank` role and the runtime's crank are ready for another model), the
  fishing boat (no type; untextured), the NR750 and the Draco-only motorbikes (see Motorbikes).
