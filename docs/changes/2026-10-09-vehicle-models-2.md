# Downloaded vehicle models, round two

- The Crown Vic patrol cars are now an '80s police sedan model (Daniel Zhabotinsky, CC-BY) in the game's own
  liveries (black and white, modern, sheriff, unmarked), with the unit numbers on the roof, trunk and fenders and its
  roof light bar flashing on the game's patterns; fewer draw calls and shadow casters than the procedural body.
- The DUKE V8 muscle car is an American Muscle '71; the VORTEX 900 motorbike is a 1970 four-cylinder classic
  (fork, bars and head lamp steer, the rider sits on its saddle, grips and pegs, maker's names removed); the HARBOR
  LAUNCH is a tow boat with its outboards and wheelhouse (sponsor and maker names removed).
- Kept procedural after a look in the game: helicopters (their painted liveries and the Black Hawk's door guns),
  the hot rod (flames and blower), the private bicycle, the other four motorbikes (Draco-only or baked logos).
- Internals: police3d-asset.js (the livery projected from the procedural crownvic's shell frame onto the model,
  the bar's lenses on the police light channels), motorbike-assets3d.js, boat-assets3d.js; tools/vehicle_models.py
  `nodeRoles`, `section`, `borderCos`, `minPiece`, `texCap`, `--out`, the atlas 2048 square;
  tools/vehicle_models_moto.py (steering split, crank, `erase`), tools/vehicle_models_boat.py.
- Console: `policeLineup(..., looks)` parks only the given [type, body, livery] rows; `carModels(true)` reports
  the police models too; `carBadges()` rows carry `asset`.
