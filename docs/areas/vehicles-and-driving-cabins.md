# Vehicles and driving: cabins, headroom and rear badges

Car cabins seen through the glass (cars3d-interior.js), the seat plan fitted round the drawn head
(cars3d-headroom.js) and the model names on the tails (cars3d-badges.js). Models in general:
vehicles-and-driving-models.md.

## See-through glass and the cabin (cars3d-interior.js)

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
- The people (crowd3d-driveby.js SEATED OCCUPANTS): the vehicle pass queues cars (`queueCarOccupants` from
  `animateCivilianCar` / `animatePoliceVehicle`), `drawCarOccupants` (finishCrowd3D) seats the nearest
  `OCCUPANT_CAP` within `OCCUPANT_REACH` of the camera (keep it at or past `CAR_GLASS_CLEAR`'s far end): the player
  (unless the drive-by pose draws them), traffic drivers dressed by `driverColor` / `driverFemale` / `driverRole`, one
  passenger (`passengers`), a patrol car's two officers while `!crewDeployed`. Hands on the rim (`carWheelRim`), the
  'riding' pose lying back with the seat (`plan.lean`, below).
- Road dirt toward the sills (civLiveryPatch ROAD DIRT): `m.dirt` is the paint's own uniform (amount, ground height),
  written by `animateCivilianCar` when it changes; impostors keep none.
- Report: `carModels()` gives each civilian model's `cabin` (hip, recline, rear bench, `headroom` round the tallest
  seated head as drawn, `behind` (headrest to rear glass, metres), `cabinTriangles`, `seated` people); tools/tests/car-cabins.mjs.

## Seats and headroom (cars3d-headroom.js CABIN HEADROOM)

- `carSeatPlan` is the one seat rule (kit.seats, `m.seats`): the default hip is the drive-by's (1.4 m behind the
  screen's foot, 0.42 m under the belt); under a roof `cabinSeatFit` fits the seat round the head the rig draws: the
  head, hair and caps of the tallest man (1.086 x 1.75 m) and woman drawn in cars, posed by the same joint chain as
  drawCrowdPerson (`cabinHeadPose`: the torso at `seatTorsoLean(recline)`, the face level, `seatHeadPitch`), kept
  `CABIN_HEAD_GAP` (2 cm) inside the glasshouse's inner outline (`cabinProfile`: rear glass, the roof lowered by
  `CABIN_ROOF_LINER` 3 cm, windscreen; the side glass across). Search order: up to 10 cm lower and 23 degrees back,
  then down to the floor and back to 32 degrees (39 in a `CAR_TWO_SEATERS` mid-engined car, as real supercar seats lie),
  then along the cabin (a pass whose lowest seat has no room at its middle and deepest lie is skipped: the fit runs
  when a kit is built, `fitMs` in the report, a few ms). A body's `seats.recline` raises its own limit (the Valkyrie's
  and La Fera's racing seats). The seat back's top stays inside the rear glass; a rear bench only where its back fits
  (`CAR_TWO_SEATERS` never). A body may give its own (`seats`, the roadster's buckets).
- The seated people (crowd3d-driveby.js `seatOccupant`) lie at `plan.lean` with `seatHeadPitch`: change the pose there
  and in `cabinHeadPose` together. A roof too low for every step is a body to fix (raise its `glass.roof`, add a
  `crown`, move `rb` back over the head), never a smaller margin.
- The drive-by pose (`drawDriveByDriver`) sits in the same seat (`m.seats`, lean and face) and reaches the grip the
  bullet leaves from (driveby.js `driveByGrip`, in the vehicle's frame).
- DRIVE-BY SEATS (driveby-seats.js, game side): `DRIVEBY_SEATS` is the model's seat per car type ('law:<body>' for a
  police body; `policeLookChoice` is the one choice of a law car's body and livery, pickPoliceLook reads it) in world
  metres [x ahead, hip height, offset from the centre line, lean, belt], recorded from the renderer's plans;
  `driveBySeat` takes it (`fitted`), and `driveByReachClamp` keeps every grip within `DRIVEBY_RIG.reach` of the arm from
  the shoulder on its side (the player's proportions, the seat's lean and the pose's twist, never its roll), keeping the
  sill height: the drawn hand holds the gun the bullet leaves from (`driveByArm.gap` 0; drawCrowdPerson still brings a
  gun in with the wrist should a grip ever lie past reach). A seat that moves (a body or headroom change) re-records
  its line: tools/tests/cabin-headroom.mjs prints the drifted lines (gap over 2 cm) to paste;
  tools/tests/driveby-seats.mjs (no-render) checks reach and sill. Console `driveBySeatReport()`.
- Report: `DeadEndCity.cabinHeadroom()`: per kit the room (metres) round the man's, woman's and player's heads
  (`clear`, `roof`), the hip and recline, `key`, `seat` and the game's `gameSeat` / `seatGap`, `through` (who pokes out
  where); the top-level `through` counts cars with any head out and `driveByArm` is the last drive-by frame's pull-in
  (metres). tools/tests/cabin-headroom.mjs holds `through` at 0 (rendered page only: the suite's no-render page skips
  it). The avatars people in cars are drawn as (motorists, police, agents, the story cast, the player in a disguise:
  `cabinAvatarClouds`, their head-bone points at the tallest height of their sex) count too: `clear.avatarRoom` is the
  least room any of them has (`clear.avatar` who), and one out joins `through`. The seat search itself still fits the
  rig's clouds (DRIVEBY_SEATS unchanged).

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
