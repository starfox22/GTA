# Licensed Coupe '33 hotrod integration

The `hotrod` / HELLFIRE CUSTOM uses Daniel Zhabotinsky's **Coupe '33 Hot Rod #3 – Low Poly Model**. Its original stock hood, smooth coupe body, cabin, steering wheel, chrome blade wheels and engine/undercarriage are retained. The closed stock hood covers the engine. This source does not have the procedural fallback's exposed blower, flame graphics or whitewall tyres, and is not represented as a photoreal model.

The two `source-preview-*.png` files here are **native source-model CPU renders, not in-game screenshots**. Their review lights, floor and camera were added only for inspection. Geometry and source materials were not exported or smoothed for these previews. Final in-game lighting, transparency and performance are assessed by the parent review's rendered checks.

## Source and licence

- Creator: [Daniel Zhabotinsky](https://sketchfab.com/DanielZhabotinsky).
- Original model: <https://sketchfab.com/3d-models/coupe-33-hot-rod-3-low-poly-model-cb5b519024c7472895ef10a8663fb533>.
- Download mirror: `abd0175149-droid/new-mafia`, commit `f1eab6db49e1eaf69d5fb61c4c09b529ada65595`, `frontend/public/3d/sketchfab/coupe33/`.
- Asset-specific `license.txt` and matching `scene.gltf` `asset.extras` both identify **CC BY 4.0**. The exported licence explicitly says commercial use is allowed and requires attribution. The mirror's code licence is not used as asset permission.
- The original Sketchfab page returned a proxy 403; [original-page-check.json](original-page-check.json) records this limitation. Original account ownership was not independently verified.
- [source-download-receipt.json](source-download-receipt.json) pins every file URL, byte count and SHA-256. [source-license.txt](source-license.txt) is the exact exported asset licence.

Required attribution, plus adaptation notice:

> This work is based on "Coupe '33 Hot Rod #3 - Low Poly Model" (https://sketchfab.com/3d-models/coupe-33-hot-rod-3-low-poly-model-cb5b519024c7472895ef10a8663fb533) by Daniel Zhabotinsky (https://sketchfab.com/DanielZhabotinsky) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Adapted for Dead End City: uniformly normalized and partitioned into damage/animation parts, PBR maps atlas-packed, paint neutralized for resprays, and a reduced far LOD added. Original close topology, split normals, source cabin and stock-hood identity retained.

## Rebuild

Requirements: Python 3 with NumPy/Pillow, Blender 4.3.2; independent source verification additionally uses SciPy. Commands work from repository root and use CPU Blender with one thread.

```sh
python3 tools/hotrod_vehicle_source.py /tmp/hotrod-source
python3 tools/hotrod_vehicle_source.py /tmp/hotrod-source --verify-only
OPENBLAS_NUM_THREADS=1 python3 tools/hotrod_vehicle_models.py \
  /tmp/hotrod-source/scene.gltf --out /tmp/hotrod-clean/assets --work /tmp/hotrod-clean/work
OPENBLAS_NUM_THREADS=1 python3 tools/hotrod_vehicle_verify.py \
  /tmp/hotrod-source/scene.gltf /tmp/hotrod-clean/assets/hotrod-vehicle-models.bin \
  /tmp/hotrod-clean/source-fidelity-proof.json
blender -b --threads 1 -P tools/hotrod_vehicle_preview.py -- \
  /tmp/hotrod-source/scene.gltf /tmp/hotrod-source-previews
```

Use a fresh work/output directory. The converter writes only `hotrod-vehicle-*` into the requested output directory. Its common-writer intermediate stays in `WORK/pack-stage/`, keeping the shipped C8 pack protected even when `--out assets` is selected. Use isolated staging outputs for review. [protected-existing-packs.json](protected-existing-packs.json) proves all fourteen existing model/texture files are byte-identical to HEAD. [clean-rebuild-proof.json](clean-rebuild-proof.json) records a complete independent clean rebuild against all five shipped outputs.

Reproduce the production builder/seat/window proofs without a browser or GPU:

```sh
node tools/hotrod-vehicle-host-check.mjs --out /tmp/hotrod-host-proof
```

## Geometry and textures

`DECVM001` model key `coupe33_zhab` owns **20,856 close / 5,202 far triangles**, including body, cabin, lamps and all wheels. All 20,856 active original faces are assigned exactly once. The GLTF also contains an unreachable 596-face alternate cut hood, bringing its mesh-table total to 21,452; that unused alternate is not silently drawn on top of the stock hood. [source-partition.json.gz](source-partition.json.gz) records original primitive/triangle owners.

Close preparation uses ratio one and the existing source-normal bypass: it neither welds nor recomputes authored split normals. Far parts use 25% edge-collapse reduction and custom normals transferred from original source faces. Normal components are signed 16-bit; positions are 16-bit over the model bounds, indices select 16/32-bit by vertex count. [source-fidelity-proof.json](source-fidelity-proof.json) checks every close vertex against original transformed positions, raw UVs and split normals: maximum position error 38.43 micrometres, minimum normal dot 0.99999999970.

The source already faces +X, Y up, +Z right. One uniform scale fits the conversion to 4.5 m, with centring/ground translation. Production `VEHICLE_DEFINITIONS.hotrod` is 4.5 m long and 2.07 m wide. Its approved-kit length/width/native-scale limits choose exactly 8 map units per source metre: the drawn source stays 4.5 × 1.62422 × 1.88523 m. Collider, handling and save/type identity remain the existing hotrod's. Earlier host fixtures incorrectly copied a 1.8 m width and described a smaller fit; the corrected fixtures extract both dimensions from production `game-vehicles.js`.

Eight material tiles, mostly authored 1024px images, require the padded 4096px atlas to retain their original resolution together. It is not a 4096px upscale of a single 1024px image. The shared high albedo and ORM textures retain native albedo/ORM tile sizes; source 512px specular intensity is resampled to its matching 1024px ORM tile for the shared grid. Low/Medium use an explicit 2048px downsample. Two mipmapped RGBA8 4096 atlases cost about **128 MiB**, or **32 MiB** at 2048, before other game textures.

Source albedo, roughness/metalness factors, alpha and UV repetition are retained; only the untextured body pigment becomes white for per-car resprays. ORM alpha holds the authored `KHR_materials_specular` intensity, sampled by physical materials. ORM red supplies source occlusion only where the GLTF declares it. Raw `.a` source UVs remain unchanged. Separate `.o` ORM UVs retain the body roughness/metallic texture's source `KHR_texture_transform` 20x repetition, while albedo, specular and occlusion retain their own untransformed coordinates. Near/far geometry, clipped doors, shaped fallback panels and crumple clones carry these attributes. The existing road-dirt/paint roughness floor still applies.

## Cabin, doors and wheels

The actual source seats/dashboard/roof liner are drawn once inside the trim. No procedural second cabin is added. Driver and passenger hips use normalized source `[0, .665, ±.29]` m. Original cushion rays put the surface 26.17 mm above that joint reference at production scale. The full-size production head fit has **21.650 mm** minimum clearance; characters are not resized. The final gameplay seat row is `[0, .665, .29, .49, 1.12446907]`, matching `DRIVEBY_SEATS.hotrod`. `CAR_GLASS_BANDS.hotrod` also uses the source belt/roof and front/rear feet, keeping glass hits and drive-by apertures aligned with the drawn body.

Original steering rim fit: centre `[.21183315,.98653741,-.24934615]` m, radius `.17113967` m, tilt `.54038` rad. The real production driver hand targets lie on this circle. Existing procedural pedal targets remain an approximation; this source does not provide a rigged pedal hierarchy.

The source body combines the doors with its shell. It has no separate native door parents or reliable authored hinge animation. Existing source-backed clipping opens actual apertures through the combined paint/trim/window layers at the measured source door span. Source windows move with those doors, native seats/dashboard remain visible, and a fallback inner card belongs only to the moving door. Damage, source bullet anchors, entry/exit, two open doors, char-before-first-door and repair all use the existing geometry ownership path.

Each tyre/rim retains the exact source wheel-parent hub. Their material boundaries are partitioned by the source metallic texture; there are no duplicated procedural wheels. Front wheels steer, all four roll with forward/reverse road speed, and near/far wheel parts share each hub. No separate brake caliper is present in this source, so none is invented or incorrectly spun.

## Evidence and limits

[host-proof.json](host-proof.json) records 208 assertions against production decoder/builders, real head geometry and seat poses, source cushion/steering targets, closed/open doorway and 19 moving-window rays, production-extracted dimensions and gameplay glass bands, source interior visibility, bullet-anchor transfer, crumple/repair attribute restoration, late burnt doors, shared textures and complete near/far triangle counts. These tests run without WebGL and cannot establish final shader compilation, lighting, transparent sorting or hardware FPS. The existing C8 production host suite also passed after the shared single-role alias fix (1,228 assertions).

Runtime files: `src/hotrod-vehicle-assets3d.js`, hotrod branches in `src/vehicle-assets3d.js`, the hotrod seat row in `src/driveby-seats.js`, and optional independent ORM UV inheritance in `src/damage3d-crumple.js`. The original hotrod body remains the asset-disabled fallback. Shared loader/manifest/includes/quality callbacks are managed by the parent review. `assetCars().models.hotrod` and `hotrodVehicleReport()` expose the loaded source identity and budgets.

## Final native runtime review

The completed hotrod phase on frozen game SHA-256 `719a535fe3905275c381737acb7fc3e80ee1ab4378c0d5736a4595096b16c03c` passed. [runtime-proof.json](runtime-proof.json) retains its exact source snapshots, capture hash and **27 passing read-only checks**. The combined aviation/audio/trail recorder was still running when this hotrod receipt was taken; this is a hotrod-phase result, not a claim that those later phases passed. The receipt pins the changing report's read checkpoint and separately hashes the durable hotrod payload.

| Requested setting | Actual tier | Two atlas sizes | Visible close / far triangles |
| --- | --- | --- | --- |
| Low | LOW | 2048 × 2048 | 20,856 / 5,202 |
| Medium | MEDIUM | 2048 × 2048 | 20,856 / 5,202 |
| High | HIGH | 4096 × 4096 | 20,856 / 5,202 |
| Ultra | ULTRA | 4096 × 4096 | 20,856 / 5,202 |
| Auto, SwiftShader | LOW | 2048 × 2048 | 20,856 / 5,202 |

Exact runtime car ID 285 began pristine and unboarded with no constructed doors. Burn damage activated the approved char pool (27 swapped meshes), built both source-extracted door sets, and the explicit driver-door action opened the body aperture. Repair removed char, restored 145/145 HP, closed both doors, restored all five source-geometry flags and returned the exact original material/map records. The separate host proof specifically covers char activation before the first door is constructed; the runtime burn path itself constructs doors as damage occurs.

After boarding and reopening the repaired driver door, `cabin.seated` was **1**, the native cabin remained 1,951 triangles with no duplicate fallback, and the public seat report matched gameplay with **seatGap 0**. Rounded minimum headroom was **.022 m**; recorded clearances were man .022, woman .084, player .103 and active avatar .039 m, with no roof/glass penetration. Three original paint/trim layers and the intact moving window were visible; no centre panel filled the aperture. Shader checking was enabled, with no recorded console warnings/errors, frame faults or GPU losses through these hotrod snapshots. Individual independent ORM/source-UV arrays remain covered by the host test because the public runtime report does not expose them.

The native 960 × 600 `final-captures/runtime/hotrod-open-source-cabin.png` was inspected without retouching. It shows the actual source body, open door/window and seated driver. Its front three-quarter angle leaves most upholstery dark; normal lingering burn/repair particles remain above the roof. It is state and aperture evidence, not a clean upholstery portrait. [parking-runtime-proof.json](parking-runtime-proof.json) separately records the final input's unobstructed front/side body views: both report one seated driver, .022 m headroom, 18 draws and 20,856 triangles, with no recorded errors or GPU/frame faults. These are software WebGL checks; they do not establish hardware FPS.
