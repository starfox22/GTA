# Downloaded vehicle models, round three

- Police: the pursuit sedans are now an '80s patrol car model and the patrol and agents' SUVs a Chevrolet Suburban
  cruiser model, both in the game's own liveries (black and white, modern, sheriff, unmarked) with their light bars on
  the game's flash patterns; with the Crown Vic, every patrol car is a downloaded model. The SWAT truck stays procedural.
- The ATLAS BOX TRUCK and Vinny's ATLAS CARGO FLATBED (mission 1) are a '90s light commercial truck: the box truck as
  modelled with its box stretched to 10 m; the flatbed on its cab and chassis with the game's hardwood deck, rack and
  crate slots behind. The METRO CITY BUS is a town bus, the PARAMEDIC a modelled ambulance (its roof bars flash), the
  SOLSTICE SPIDER a late-'90s convertible, the SOVEREIGN STRETCH the '80s sedan stretched into a limousine, the
  WORKHORSE a compact pickup, the RANGER 4X4 a Suburban in plain paint.
- Fort Sentinel: the M4 utility (and the gun jeep, its ring-mounted .50 cal unchanged) is an HMMWV, the M35 cargo truck
  a 2 1/2-ton M35, the main battle tank an Abrams M1A2 (turret and gun turn and recoil as before). Kept procedural: the
  LAV-8 and the SWAT truck (no usable models found), the fuel bowser, the van, the hot rod, the rally car, boats.
- Internals: tools/vehicle_models.py `stretch` (with `band`), `paintTex`, `clusterParts`, `texWeight` and the earlier
  models' `texFloor`, `--atlas`, the atlas 4096 x 2048; tools/vehicle_models_special.py (`kind: 'special'`);
  src/military-assets3d.js (ASSET MILITARY); police3d-asset.js POLICE_ASSET_TYPES; Vinny's truck on the downloaded cab
  (`vinnyKit(true)`); the box truck, bus and ambulance ride makeAssetCar; CAR_GLASS_BANDS rows for the new types.
