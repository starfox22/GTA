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
  Damage ride height and `rideWheels` remain on the same wheel pivot; the M4 keeps
  that pivot rigid and deforms only rubber when punctured.
- The original HMMWV wheel parts also contained fixed running gear, so their whole-part
  bounds measured the wrong axle: one front centre was 11.35 cm off the tyre circle,
  both rear centres about 35.4 cm off it. `militaryAssetWheelPartition` runs once per
  cached `army_jeep` kit: it finds and validates the dominant connected tyre/rim circle,
  retains small coaxial hub pieces, moves other components into the static near/far
  body, and recovers the circle's centre/radius. Every source triangle remains once;
  fixed running gear keeps its exact source positions/normals/UVs. Four wheel draws
  stay four. Compact subsets own their buffers; the obsolete unuploaded input is
  removed from `sharedGeometries` and disposed. Other types and uncertain new layouts
  retain their original geometry. Regenerated source packs need `m4-wheel-partition`
  and rendered moving-wheel checks; the classifier never assumes a generic new asset.
- The source rolling mesh itself has a mild ellipse: about 0.85768 m across versus
  0.86822 m high (aspect 0.98785), independent of the earlier wrong-centre orbit.
  `militaryWheelCircularize` measures all 24 outer tread stations and fits their
  positive-definite XY ellipse around the recovered axle. Its symmetric square-root
  transform makes that ellipse circular without adding or deleting vertices/faces.
  For the shipped wheels the largest stretch is only 1.229%; the corrected outer
  tread radius spread is about 0.05 mm. All six tyre/rim/hub rings share this same
  correction, retaining their relative profile and axial thickness. The fit requires
  every station, a clean residual and principal stretches within 5%; uncertain layouts
  stay unchanged. The packed assets and the body/fixed running gear are not rewritten.
  Original UVs and source triangle ownership stay exact. Authored split normals
  follow the affine inverse transpose; they are never replaced by smoothed normals.
  This runs once per shared kit and adds no draws or per-frame work.
- An intact M4 uses a uniform 0.65 model scale. Its source tyre and metal rim share
  one mesh; the old whole-pivot 0.82 puncture squash also made the rim 18% oval.
  `specialDamage` now sets M4 pressure while keeping the whole pivot at scale 1.
  A shared radial profile anchors every source vertex at or below 0.56 tyre radius
  (the metal ends below 0.536r), smoothly reaching full rubber squash at 0.98r.
  `militaryRubberUpdate` rolls the source coordinates, compresses only rubber
  vertically, then unrolls them; the flat therefore stays outside wheel spin.
  Authored normals follow the analytic inverse-transpose deformation Jacobian.
  Rigid metal/bead positions and normals remain byte exact, including split seams.
  The first puncture clones all geometry attributes and the index privately, once;
  rolling updates reuse those buffers and conservative circle bounds. Stationary
  wheels skip buffer writes. Repair/burn immediately restore the shared source and
  dispose the clone; ordinary model retirement disposes any attached private flat.
  Never add those private geometries to the shared set or dispose shared VBOs.
  Existing suspension/drop, burn visibility and other models' puncture paths stay
  intact. Camera projection may still foreshorten a circular sidewall.
- Near HMMWV body stays unclustered. Far body is eligible only for other vehicles
  in chase view. The tier-scaled transition has 0.9/1.1 hysteresis; the player's
  own vehicle and street/flight views always keep the near body.
- `military-mark-rays3d.js` accelerates CPU ray queries on these immutable shared
  near/far bodies. A cached triangle BVH and conservative per-triangle bounds
  select candidates within the ray's world near/far segment, including under
  nonuniform/negative model scale. Three r160 still performs the original exact
  triangle/material/normal/UV intersection; source face order and `faceIndex` are
  restored. The private reusable subset index is never drawn or uploaded. Render
  positions, indices, materials and the mark's 16-point support checks stay exact.
  Trees build with the title-prewarmed model kit and are reused by patrol copies;
  the M4 near body retains about 1.13 MB of typed query data. Source disposal drops
  its WeakMap entry and disposes the CPU-only subset. Changed position/index
  versions, morphs, array materials and partial draw ranges use vanilla Three.
  Never register deformable civilian geometry here.

Checks: `military-model-rig` runs the production decoder/builders/animation/char
functions with real Three.js and the packed assets. Render `asset-char` and all
graphics tiers with `--shadercheck` too; shader string checks cannot prove WebGL
compilation. See the October 13 audit for actual captures and limits.
`m4-wheel-partition` also proves actual packed triangle conservation, fixed source
geometry, wheel affine fit/inverse-transpose normals, unchanged UVs, corrected source
axle pairs, and circle-centre stability across 48 spin
phases per wheel. The original rear circles orbited over 71 cm peak-to-peak in source
metres; corrected circle centres stay on their axles.
`m4-wheel-shape` separately measures six actual tyre/rim/hub cross-sections in world
space through the production military builder, wheel animation, 0.65 design/group
scale, body bank/pitch, near/far LOD and actual clean/puncture/repair matrices. It
covers 48 forward/reverse phases and three steering angles. Punctured metal/bead
rings must remain circular in actual world space, without compensating for squash;
only outer rubber is checked against its intentional vertical pressure collapse.
The worst corrected band radius spread is 0.153 mm, below the 0.25 mm tolerance.
`m4-puncture-rims` also checks exact rigid vertices/normals, smooth-transition
normals against finite differences, UV/split-normal seam continuity, all private
attribute/index ownership, repair/burn/retirement disposal and an unaffected second
M4. A 1,000-frame four-flat-wheel warm host sample asserts no new geometry or buffers
and reports timing/heap diagnostics. These are host geometry/resource checks;
final native game captures remain separate visual evidence.

For matched native wheel/base captures and first-hit attribution, run
`node tools/m4-utility-render-review.mjs HTML OUT before --quality low`, then use
`after` against the candidate HTML with the same quality. The receipt records the
HTML/recorder hashes, every named input, native screenshots, two explicitly stepped
render frames per stage, draw counters and raw CPU profiles. It compares pristine,
12 newly shot side marks, cached marks, and actual motor-pool boarding/return fire.
The short rendered samples identify the responsible pass; repeatable host ray probes
measure mark throughput. Keep a separate HIGH capture explicitly separate from a
LOW before/after pair. The recorder uses the normal 1000×700 title layout so the
radio panel stays beside the start button.

`military-mark-rays` compares full and accelerated actual M4/M35 ray intersections,
near/far edge cases, sidedness, scaled transforms and production hole anchors,
including failed/retried marks. `node tools/m4-marks-bench.mjs --baseline` versus
the same command without `--baseline` records process CPU, exact triangle work,
build cost, bounded retained data and source hashes; timings are evidence, never
test thresholds. Add `--out work/<receipt>.json` to retain a measurement.
