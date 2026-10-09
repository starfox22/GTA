# Vehicles and driving: downloaded police bodies, trucks and Fort Sentinel's vehicles

Round three of the downloaded models (the converter and the car kit: vehicles-and-driving-models-assets.md). One bin and
one atlas for everything (assets/vehicle-models.bin, vehicle-atlas.webp, now 4096 x 2048); `tools/vehicle_models.py
SRC_DIR` regenerates both from the downloads (a folder holding `zhab/`, `mirror/`, `misc/` and `dl3/`). Credits in
docs/THIRD_PARTY_CREDITS.txt.

## Police bodies (POLICE_ASSET_TYPES, police3d-asset.js)

- `policeLookChoice` / `pickPoliceLook` still choose body and livery; `policeAssetType(body)` names the model that draws
  it: 'crownvic' the 80 American Police Sedan (`police`), 'charger' the 80s Generic Police Car (`police_charger`, the
  same author's series), 'utility' and 'tahoe' the Chevrolet Suburban Sheriff Cruiser (`police_suv`). The SWAT
  Bearcat stays procedural (no armoured truck with a usable licence was found). Each body keeps its own livery canvas
  and section ring (the projection is per body), so a utility and a Tahoe on the same model still differ.
- The Suburban's paint and trim share one texture: the converter's `paintTex` keeps as paint only the triangles whose
  texels are the body's black or white (`colors`, `tol`); the rest (grille, bumpers, lamps, push bar) is trim.
- A body without the model in the build falls back to its procedural kit (police3d-kits.js), as before.

## Trucks, bus, convertible (ASSET CARS)

- The box truck ('truck') and the bus ('bus') ride `makeAssetCar` (render3d-vehicle-models.js: a `truck` spec with a
  car-kind model), so they gain the car contract (crumple, marks, blood, the merge); the ambulance stays procedural (the
  only clean model found is one mesh with painted glass and fused wheels). An asset ambulance would get its two roof
  strobes from makeAssetCar (`strobes`, flashed by render3d-frame.js).
- `stretch` (converter): a body longer than its model (the 10 m box truck on a 6 m light truck) keeps the cab and
  stretches what lies behind `cut` metres from the front; wheels and running gear (`rigid`) move whole.
- The SOLSTICE SPIDER ('roadster') is the Chrysler Sebring Convertible: an open car, so its glass is the windscreen
  only (the converter takes the windscreen for the side panes' measurements); CAR_GLASS_BANDS keeps `open`.

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
- M4 utility ('jeep') = HMMWV M998A1 soft top; the gun jeep keeps its procedural ring mount and M2 at the same design
  numbers (`militaryGunMount`), so MOUNTED_GUNS (pivot -2.9, height 17.5) is unchanged. M35 ('armytruck') = Military
  Truck 1/2 Ton (an M35 2 1/2-ton); the fuel bowser stays procedural. Tank = Abrams M1A2 SEPv3 (`makeAssetTank`; the
  frame turns `model.turret` and recoils `model.barrel` by its x, so the gun's offset lies on its mesh). The LAV-8
  stays procedural (no LAV/Stryker model with a usable licence found).
- Burnt special vehicles hide their wheels (specialDamage); the shared atlas body does not darken per vehicle.

## Console

`assetCars()` lists every model (`kind` car, moto, boat, special), `assetCarsOn(false)` builds every later model
procedurally (before/after rows), `policeLineup`, `carLineup(['truck', 'bus', 'roadster', 'jeep', 'armytruck', 'tank'])`.
