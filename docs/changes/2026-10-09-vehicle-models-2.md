# Downloaded vehicle models, round two

- The Crown Vic patrol cars are now an '80s police sedan model (Daniel Zhabotinsky, CC-BY) in the game's own
  liveries (black and white, modern, sheriff, unmarked), with the unit numbers on the roof, trunk and fenders and its
  roof light bar flashing on the game's patterns; fewer draw calls and shadow casters than the procedural body.
- Internals: police3d-asset.js (the livery projected from the procedural crownvic's shell frame onto the model,
  the bar's lenses on the police light channels); tools/vehicle_models.py `nodeRoles`, `section`, `--out`.
- Console: `policeLineup(..., looks)` parks only the given [type, body, livery] rows; `carModels(true)` reports
  the police models too.
