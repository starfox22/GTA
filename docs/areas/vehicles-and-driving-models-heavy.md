# Vehicles and driving: downloaded police bodies, trucks and Fort Sentinel's vehicles

Round three of the downloaded models (the converter and the car kit: vehicles-and-driving-models-assets.md). One bin and
one atlas for everything (assets/vehicle-models.bin, vehicle-atlas.webp, now 4096 x 2048); `tools/vehicle_models.py
SRC_DIR` regenerates both from the downloads (a folder holding `zhab/`, `mirror/`, `misc/` and `dl3/`; symlinks are
followed). Credits in docs/THIRD_PARTY_CREDITS.txt.

## Converter knobs (round three)

- `stretch`: a body longer than its model keeps what lies within `cut` metres of the front and stretches the rest
  (the 10 m box truck on a 6 m light truck, the ambulance's box); with `band` only that many metres behind the cut grow
  and the rest moves back whole (the limousine, stretched at its rear doors). `rigid` parts (wheels, running gear)
  move whole.
- `paintTex`: paint and trim in one texture; only triangles whose texels are the listed colours stay paint.
- `clusterParts` / `cluster` (special kind): vertex clustering before the edge collapse for parts built too finely
  for it (a bus's tread, the convertible's solid-colour trim, the tank's hundreds of small closed parts).
- `texWeight`: a model's texel share per square metre; `texFloor` keeps the earlier rounds' models at the density
  they had in the 2048-square atlas (adding models never shrinks their textures). `--atlas WxH` compares densities.

## Police bodies (POLICE_ASSET_TYPES, police3d-asset.js)

- `policeLookChoice` / `pickPoliceLook` still choose body and livery; `policeAssetType(body)` names the model that draws
  it: 'crownvic' the 80 American Police Sedan (`police`), 'charger' the 80s Generic Police Car (`police_charger`, the
  same author's series), 'utility' and 'tahoe' the Chevrolet Suburban Sheriff Cruiser (`police_suv`). The SWAT
  Bearcat stays procedural (no armoured truck with a usable licence was found). Each body keeps its own livery canvas
  and section ring (the projection is per body), so a utility and a Tahoe on the same model still differ.
- The Suburban's bar: its coloured lenses join the housing in the trim (`lightbar`, so the bar reads red, white and
  blue when the lights are off) and its clear covers are the light mesh (`beacon`, the police light channels).
- A body without the model in the build falls back to its procedural kit (police3d-kits.js), as before.

## Civilian trucks, bus, ambulance, convertible, limousine (ASSET CARS)

- The box truck ('truck'), the bus and the ambulance ride `makeAssetCar` (render3d-vehicle-models.js: a `truck` spec
  with a car-kind model), so they gain the car contract (crumple, marks, blood, the merge). The ambulance's livery is
  its texture (`paintTexture`); its roof light bars (`beacon`) are its two strobes, split left and right
  (`vaSplitSides`; render3d-frame.js flashes `strobes` while `emergencyBeacons(c)`).
- The Chrynser Sebing ('roadster') is the Chrysler Sebring Convertible: an open car (a windscreen and no side glass:
  the kit's glass record gets `open`, so seats, wipers and headroom treat it as the procedural roadster).
- The RANGER 4X4 ('suv') is the patrol SUV's Suburban in plain paint (bar, push bar, spot lamp left out); the
  WORKHORSE ('pickup') the Compact Pickup '78; the SOVEREIGN STRETCH the 80 American Sedan stretched to 8.8 m; the
  Chorley 72 ('cruiser', ASSET MOTORBIKES) the Seventy-Two chopper (same author and hints as the VORTEX 900).
- CAR_GLASS_BANDS rows for these types are the models' numbers at the types' lengths (belt, roof + crown, rear and
  screen feet over the length; tools: the converter's header).

## Vinny's truck (VINNY ASSET CAB, vinnytruck3d.js)

- With the 'flatbed' model in the build the cab, chassis, wheels and head lamps are the downloaded truck's (its box,
  rear doors, rear lamps and bumper dropped by `nodeRoles`, stretched to 9.5 m); the deck, headache rack, rails, rear
  end, markers, tail lamps and crate slots stay this file's (`vinnyKit(true)`: the deck from `VT_ASSET_DECK_FRONT`
  2.82 m, behind the cab-over cab). VINNY_CARGO (deck height, slots) is unchanged, so mission 1's crane and bay are
  too. The door lettering is lost with the procedural cab; the ATLAS name stays on the rack.

## Fort Sentinel (ASSET MILITARY, military-assets3d.js; tools/vehicle_models_special.py)

- `kind: 'special'` models: one atlas body (camouflage and markings are its texture), glass, lamps, road wheels on
  pivots (`tyreBox`: of a material holding wheels and running gear, only what lies low and far out is wheel), and a
  tank's turret and gun (`split`: by height and position, metres; `turretAt`, `barrelAt` pivots). Big parts go out in
  slices (`slices`, joined by `militaryAssetSlices`). Drawn at the type's design size: makeVehicle scales by the
  type's modelScale as before; `hull` is the length the collider stands for (the tank's gun reaches past it).
- Hum-4 (formerly M4 utility, 'jeep') = HMMWV M998A1 soft top; the gun jeep keeps its procedural ring mount and M2 at the same design
  numbers (`militaryGunMount`), so MOUNTED_GUNS (pivot -2.9, height 17.5) is unchanged. It is converted without
  `cluster`: vertex clustering folded its thin hood, wings and canvas into each other (the hood was lost and the top
  went inside out, so the single-sided atlas material showed holes); the edge collapse alone stops near 17k triangles.
  Its clustered body (~4.4k triangles) ships as `bodyFar` (the converter's `far` hint) and draws instead in the chase
  view where the jeep is small (MILITARY LOD, `militaryLod`: chase zoom under `MILITARY_LOD_ZOOM` 1 times the tier's
  lodBias, about 55 m on HIGH; never the player's vehicle, never the street or flight view); the levels are two groups
  kept out of the merge and swapped by their visibility. The fort's motor pool fills a chase view with these, so a
  new special model with a heavy body gets a `far` level too.
  M35 ('armytruck') = Military Truck 1/2 Ton (an M35 2 1/2-ton); the fuel bowser stays procedural.
- The tank is procedural again (county3d-forest.js makeTank, merged by compactTank): the downloaded MBT's ~300k
  triangles of small closed parts reached a budget only by clustering, which broke it apart. `makeAssetTank` and the
  converter's `split` (turret and gun by position; `turretAt`, `barrelAt` pivots) stay for a tank model that converts
  cleanly: give `MILITARY_ASSET_TYPES` a `tank` entry. The LAV-8 stays procedural (no LAV/Stryker model with a usable
  licence was found).
- Check a special model's conversion before shipping it: render the bin's parts with back faces marked (the atlas
  material is single-sided, so a face wound inwards is a hole in the game); `cluster` is the usual cause.
- Military runtime kit sharing, original HMMWV lamp lenses, matte finishes, char/repair and wheel animation:
  [military model contracts](vehicles-and-driving-models-military.md). Special tyres hide on burn and restore
  on repair; per-car atlas char materials darken the body.

## Console

`assetCars()` lists every model (`kind` car, moto, special), `assetCarsOn(false)` builds every later model
procedurally (before/after rows), `policeLineup`, `carLineup(['truck', 'flatbed', 'bus', 'ambulance', 'roadster',
'limousine', 'suv', 'pickup', 'jeep', 'armytruck', 'tank'])`.
