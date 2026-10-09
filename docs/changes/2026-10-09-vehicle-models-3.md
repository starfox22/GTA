# Downloaded vehicle models, round three

- Police: the pursuit sedans are now an '80s patrol car model and the patrol and agents' SUVs a Chevrolet Suburban
  cruiser model, both in the game's own liveries (black and white, modern, sheriff, unmarked) with their light bars on
  the game's flash patterns; with the Crown Vic, every patrol car is a downloaded model. The SWAT truck stays procedural.
- The ATLAS BOX TRUCK and Vinny's ATLAS CARGO FLATBED (mission 1) are a '90s light commercial truck: the box truck as
  modelled with its box stretched to 10 m; the flatbed on its cab and chassis with the game's hardwood deck, rack and
  crate slots behind. The METRO CITY BUS is a town bus model, the SOLSTICE SPIDER a late-'90s convertible.
- Fort Sentinel: the M4 utility (and the gun jeep, its ring-mounted .50 cal unchanged) is an HMMWV, the M35 cargo truck
  a 2 1/2-ton M35 model. Kept procedural after a look: the LAV-8 (no usable model), the tank (the Abrams tried was eight
  times a car's triangles), the ambulance (its model's glass and wheels are painted on), the fuel bowser.
- Internals: tools/vehicle_models.py `stretch`, `paintTex`, `wheelsSquare`, the atlas 4096 x 2048, symlinked source
  folders; tools/vehicle_models_special.py (`kind: 'special'`: body, glass, lamps, wheels, turret and gun, `tyreBox`,
  `split`, `hull`, slices); src/military-assets3d.js (ASSET MILITARY); police3d-asset.js POLICE_ASSET_TYPES; Vinny's
  truck on the downloaded cab (`vinnyKit(true)`); the box truck and bus ride makeAssetCar (the car contract).
