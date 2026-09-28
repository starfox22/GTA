# No health boxes on the street

- The floating health boxes are gone from the streets, the hospitals' fronts and the county
  lodges, and from the maps (the PICKUPS map layer went with them). Nothing lies about to be
  picked up any more.
- Health is bought indoors with the action key: hospital treatment ($150, full health), a
  diner plate (+45) or coffee (+12), a bar meal (+30), a club break (+20), a bed at a motel,
  the safehouse or a county lodge (full), and new: a county LODGE's hot meal ($25, +35), so
  every county town has food without sleeping.
- Internals: the `pickups` list and its update, 3D models, 2D and minimap drawing are
  removed; `ammoSupply()` no longer reports pickups; console `places()` also gives each
  place's `kind` and `door`. Test: tools/tests/health-indoors.mjs (replaces pickups-islands).
