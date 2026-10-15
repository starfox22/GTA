# Vehicles and driving: downloaded police bodies

- `policeLookChoice` / `pickPoliceLook` choose body and livery. `POLICE_ASSET_TYPES` maps the Crown Vic role to
  `police`, the Charger role to `police_charger`, and utility/Tahoe roles to `police_suv`. These are game role
  names: the legacy Charger-role export is an 80s generic patrol car. The approved S2 kit supplies utility
  replacements; see [approved SUVs](vehicles-and-driving-models-approved-suvs.md). `look.asset` selects the
  downloaded kit in bw, modern, sheriff and unmarked liveries; impostor keys retain `...:asset`.
- Downloaded bodies use `policeLiveryTexture(..., true)` and its affine side frame. The shell maps one measured
  sill-to-glass-belt interval along the whole car; source station bins must never set writing height. Those sparse
  vertex envelopes jump from sill to roof or belt when a bin has no lower panel vertex, folding otherwise straight
  letters. Near/far shells and extracted moving source doors retain the same projection. Pillars and roof take the
  roof / pillar swatches (triangles unshared where they meet), the hood its swatch. Procedural bodies retain their
  curved-ring painter. Both paths keep shared 1024×512 canvases and the existing draw/triangle budgets.
- The bar's lenses (`nodeRoles` 'beacon') are the light mesh: eight segments across the car on channels 0-4 (red left,
  white takedowns, blue right) with impostor beacons and halo anchors; the housing ('lightbar') joins the trim. The rear
  window bar (5/6) as the procedural; unmarked cars drop the bar and get the dash, grille and deck lights.
- Roof, trunk and fender numbers sit on the model's surfaces (`kit.roofDecal`, `trunkDecal`, `sideDecal`, read by
  `policeDecalGeometry`). Rear badges, mirrors, push bar and wheels are the model's own; no running-light strips.
- Original Crown Vic budget: 11 draws pristine (21 procedural), 3 shadow casters (11), ~10k triangles. DRIVEBY_SEATS `'law:crownvic'` is the
  model's seat (re-record with `test.mjs --render cabin-headroom` after a model change).

The [October 15 police audit](../audit/police-aviation-review-2026-10-15/police-markings.md) records native High/both-side and Low comparisons, projection checks, S2 paint ownership and source-measured unit decals. Retain the authored reflective black roof-edge border; it is distinct from misplaced lettering.
