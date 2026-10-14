# Downloaded military vehicles: kits, lamps and wheels

`military-assets3d.js` adapts the existing licensed HMMWV/M35 packed meshes. It reads
game state only. The tank/LAV/bowser remain procedural; gun mount coordinates and
handling are unchanged. Credits: THIRD_PARTY_CREDITS.txt.

- `militaryAssetKit(type,l)` caches immutable decoded near/far bodies, panes, lamp
  lenses and wheels per type/design length. Every car has independent pivots and
  materials for damage. Kits belong to `sharedGeometries`; repeat patrol spawns
  must not decode or retain another set of buffers. Special damage does not mutate
  these buffers. Any future crumpling must clone geometry before writing it.
- HMMWV `glass` contains window panes **and** lamp lenses. `militaryLensParts`
  partitions the original indexed triangles in converted source metres: below
  1.2 m, ahead of 2.1 m or behind -2.1 m, then left/right by Z. This is specific to
  `army_jeep`, not a classifier for future vehicles. Four damageable lamp meshes
  use the existing head/tail keys and materials. 156 triangles move out of the
  373-triangle glass part; positions, normals, UVs and total triangles stay exact.
  Four small lamp draws are added to make the existing lenses functional.
  These geometries share the original attributes, but bounds use only submitted
  indices; full-window bounds would defeat lamp frustum/small-part culling.
  `animateMilitaryLamps` selects shared reflector/lens materials for daylight and
  parked vehicles, lights only a live driven vehicle when `vehicleLampAmount()`
  requests them, and handles brakes, broken lamps, wrecks and repair independently.
  It runs after the damage material reset. The old procedural/M35 lamp path stays
  separate; the new lens palette allocates three materials once, not per car/frame.
- `vaMaterials().armyBody` gives coated paint/canvas a matte finish rather than
  civilian trim's metal/gloss. `armyWheel` reads a cached `finish` attribute:
  tyre tread/sidewall outside 0.68 of the measured radius uses roughness .9,
  metalness .02; painted inner hub .78/.15. Each packed wheel stays one draw.
  This radial finish rule does not change geometry or pretend to be a new PBR
  texture set. A future licensed replacement should carry authored material masks.
- Army materials tag `userData.assetAtlas` as `cut` or `finish` so char detection
  covers them. `assetCharPatch` composes the finish and soot shaders; wear/heat
  preserve the tyre/hub distinction, burnt finish is matte, repair restores the
  original shared materials. All four char kinds prewarm once and pool at most
  12 materials each. Keep the `asset-char-finish` program key separate.
- Asset wheel descriptors keep `front`, `side` and world-space `radius`.
  `animateMilitaryWheels` reads the physics tyre steer/lock and rear `spinSpeed`;
  only fronts steer, reverse rolls backwards and locked tyres stop rolling.
  This replaces the generic special-wheel loop; never animate both in one frame.
  Damage squash and `rideWheels` remain on the same wheel pivot.
- The original HMMWV wheel parts also contained fixed running gear, so their whole-part
  bounds measured the wrong axle: one front centre was 11.35 cm off the tyre circle,
  both rear centres about 35.4 cm off it. `militaryAssetWheelPartition` runs once per
  cached `army_jeep` kit: it finds and validates the dominant connected tyre/rim circle,
  retains small coaxial hub pieces, moves other components into the static near/far
  body, and recovers the circle's centre/radius. Every source triangle remains once
  at its original rest location; normals and atlas UVs stay exact. Four wheel draws
  stay four. Compact subsets own their buffers; the obsolete unuploaded input is
  removed from `sharedGeometries` and disposed. Other types and uncertain new layouts
  retain their original geometry. Regenerated source packs need `m4-wheel-partition`
  and rendered moving-wheel checks; the classifier never assumes a generic new asset.
- Near HMMWV body stays unclustered. Far body is eligible only for other vehicles
  in chase view. The tier-scaled transition has 0.9/1.1 hysteresis; the player's
  own vehicle and street/flight views always keep the near body.

Checks: `military-model-rig` runs the production decoder/builders/animation/char
functions with real Three.js and the packed assets. Render `asset-char` and all
graphics tiers with `--shadercheck` too; shader string checks cannot prove WebGL
compilation. See the October 13 audit for actual captures and limits.
`m4-wheel-partition` also proves actual packed triangle conservation, rest geometry,
normals/UVs, corrected source axle pairs, and circle-centre stability across 48 spin
phases per wheel. The original rear circles orbited over 71 cm peak-to-peak in source
metres; corrected circle centres stay on their axles.
