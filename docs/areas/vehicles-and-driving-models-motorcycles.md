# Vehicles and driving: motorcycle models

Runtime: `motorbikes3d.js`, `motorbike-assets3d.js`; converters: `tools/vehicle_models_moto.py`,
`tools/approved_vehicle_models.py` (approved pack).
Handling and wheelies stay in the game rules; renderer rigs only read their state.

## Approved replacement pack

The owner's October 14 selection uses the separate approved vehicle pack: `m1_enduro`
replaces the KR 500 (`kr500`), and `m2_sport` replaces the VORTEX 900 (`bike`). The
cruiser and bicycle still use the original pack and keep their styles and rigs. The
game's type, collision size, handling and mission rules stay the same. When the
approved pack is missing or asset rendering is disabled, the prior asset/procedural
fallback remains available.

`motoAssetKit` accepts the same measured `kind: 'moto'` contract from either pack.
Approved paint keeps the source UVs; its own atlas and surface finishes are provided
by `approvedVehiclePaint` / `approvedVehicleMaterials`. Glass stays a separate
transparent mesh. Kits are cached by source key and game length, so repeated bikes
share geometry while their wheels, forks, paint and damage remain independent.

`lodParts` maps each near part to its reduced counterpart. Both levels receive the
same fixed fork/axle transform once, then `motoAssetLod` swaps geometry on the existing
meshes. Body, fork and wheels have no extra LOD draws. The screen-scale threshold
uses either street `viewZoom` or chase `chaseZoomAt`, at 1.65 times the preset's `lodBias` and
10% hysteresis. The player's bike always keeps the detailed level. Bullet-marked or
dented bikes retain near geometry to preserve the triangle order of pinned marks.

Approved `seatProof` records vertical barycentric rays onto the actual front driver
saddle, rather than rear plastic/pillion positions. M1's mild lean is -.10 radians;
M2 uses a -.95 sport tuck. Paired grips stay on the source rubber bars. Rider checks
use the production 2.1/2.2 m game lengths and adults 1.65–1.9 m tall. Head mounting is
source-specific: M1 lens/halo steers, M2 fairing lamp stays fixed. `lampOut` masks both
broken and absent lenses, and a repair restores the head/tail halos.

## Existing pack and shared rig

- `kind: 'moto'` models (tools/vehicle_models_moto.py): the VORTEX 900 ('bike') is the Honda CB 750 F (1970). The
  converter splits frame paint / trim, the steering (everything wholly ahead of the steering axis moved back `reach`,
  and the bars above `bars`; hints `axis`, `bars`, `seat`, `pegs` in the game frame), the head lamp (in the fork), the
  tail lamp and both wheels; brand badges go by material (`roles` 'drop') or `erase` rectangles in the texture.
- CB750/cruiser `grips` are two independently measured rubber-grip axis points, negative-Z then positive-Z,
  in the source body frame. They replace mirror/rear-grab-bar hints and retain the source lean/asymmetry.
  `MODELS` stores these overrides; the full converter emits them and `vehicle_wheel_metadata.py` can update
  the header without reconverting any geometry. The old `grip` average remains for legacy readers.
  Detailed riders consume raw scaled points without a second wrist offset; cached coarse riders use the same
  paired contacts. A cached fixed-fork inverse and current `m.steer.matrixWorld` make the hands follow steering.
  Apply chassis slopes before `finishCrowd3D`, including enclosed occupants. The arm IK retains its physical
  reach/length clamp; current CB750 full-lock and ambiguous KR source-partition limits are in the audit report.
- The kit puts the steering geometry in the fork pivot's frame (axis top, tilted by the model's `rake`), the front wheel
  under it; `m.rearAxleX` is the wheelie's pivot (animateMotorbike); the rider's pose (`riderSeat`, the stand-in
  `motoRiderGeometry(type, pose, scale)`) comes from the measured saddle, grips and pegs.
- The front wheel sits on an un-raked axle carrier (`motoFrontAxle`): roll, tyre squash and the flat-tyre drop use
  its own upright frame instead of translating along the fork. Damage identifies it with `wheel.userData.front`.
  `bikeContact` records each tyre's original body-space contact and real radius/width for mud and spray, independent
  of the nested steering rig; only the rear tyre is driven. The extra groups add no meshes or draw calls;
  constant axle carriers keep their local matrices fixed instead of recomposing them each frame.
- The KR 500 ('kr500') is OCTbuilds' KTM Dirt Bike: its plastics' orange takes the paint (`paintTex`, so a respray
  shows), the white and black graphics stay their texture, the maker's logos erased.
- Sources posed with the bars turned (all three bikes) are turned straight first (`unsteer`: everything ahead of the
  head tube's axis, above `above`, out at the bars' ends `wide`, and inside the front tyre's sphere turns back about
  the axis; the axis passes the rear tyre's middle plane). Without it the front wheel spun about an axle that was not
  its own and wobbled.
  Check a new bike: its front tyre's flattest direction must match its recorded rolling axle (z by default).
- A straightened source can still carry a small display lean: the cruiser and KR 500 wheel planes remain about
  2.5–3.5 degrees off z. Explicit per-wheel `wheelAxes` hints (front then rear) become packed `wheels[].axle`.
  The runtime inverse-rotates cached tyre/rim geometry into that axle frame and restores its original pose with a
  constant carrier quaternion. Every rest vertex/normal stays in place; local-Z rolling then follows the actual axle.
  No geometry fit runs in the browser. `tools/motorcycle_axles.py` is an optional offline numpy/scipy audit of the
  actual packed tyres (elliptical torus, area-weighted robust fit); re-audit hints if a source/decimation changes.
  Source unsteering and axle calibration address different poses; retain both. The bike's already upright wheels
  use the default z axis. `tools/tests/motorcycle-wheel-rig.mjs` checks production builders with real packed meshes.
- Motorcycle rolling follows the tyre physics' lock and signed `c.spinSpeed` at each wheel's real-size radius;
  the generic special-wheel loop skips `bikeUpdate` models. Steering reads the physics ramp (`c.tyres.steer`),
  with action bindings as a fallback. These visuals read game state and never change grip, speed or mission rules.
- Motorcycle bullet punctures (damage-vehicles.js `bulletHitVehicle`) are independent of a car glass band: only
  side entries at or below 0.8 m, within 0.14 of the type's length of an axle at ±0.34 length, can puncture a tyre
  under the existing 75% damage chance. This is the simulation's scaled collision contract, independent of render
  assets; centre/engine and high body hits leave both tyres intact. Either side's flag flattens the one physical
  front/rear tyre. `tools/tests/motorcycle-puncture.mjs` checks real production entry rays under rotation/elevation.
  Handling counts physical front/rear tyres once even if both side flags are set; punctures add no left/right
  pull to the one tyre, while existing crash `damage.pull` remains. Normal riding and four-wheel handling stay intact.
- A wheel turns only whole pieces inside its hub circle that go round the axle (rim, hub, disc, sprocket), run from
  hub to rim (a spoke) or are small bits on hub or rim (nipples, bolts): a caliper, a fork's foot or a chain link
  stays put (the converter prints what it left). `fork` (sphere in tyre radii, `reach` behind the axis) puts what
  hangs round the front wheel (fork feet, caliper, a wrapping fender) in the steering; `barsWide` the levers and hand
  guards. Stands modelled down are left out with `dropBox`. Hints after `unsteer` are in the re-centred frame.
- Cars (convert): a wheel takes nothing past its tyre's inner wall (the Suburban's arch lining turned with its wheels).
- Kept procedural: dolcati, yamasaki (the matching models are Draco-compressed with no plain mirror on GitHub, or their
  paint and maker's logos are baked into one texture: the NR750 cannot take the traffic colours).
- 11 draws (as procedural), ~14k triangles with the rider stand-in (procedural 6.9k).
