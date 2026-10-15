# Vehicles and driving: licensed Coupe '33 hotrod

The HELLFIRE CUSTOM / `hotrod` uses Daniel Zhabotinsky's **Coupe '33 Hot Rod #3 – Low Poly Model** from its own `hotrod-vehicle-*` pack. `vehicleAssetModel('hotrod')` selects model key `coupe33_zhab`; `makeAssetCar` builds it through the existing civilian damage, lamps, seats and LOD contracts. `cars3d-bodies-a.js` retains the procedural fallback for missing/disabled assets. The original 23-model, approved motorcycle/SUV and C8 packs remain unchanged.

The active source has a stock closed hood, smooth period coupe body, genuine cabin/dashboard/steering wheel, chrome blade wheels and engine/undercarriage. The hood covers the engine. The fallback's exposed blower, flames and whitewalls are not features of this downloaded source. This is a detailed low-poly source, not a photoreal claim.

## Source, licence and rebuild

[Source audit and exact attribution](../audit/police-aviation-review-2026-10-15/hotrod/README.md) contains the licence, pinned download receipt, conversion receipts, source previews and independent fidelity/host proofs. The previews there are native source-model renders, not in-game screenshots.

The source is [Coupe '33 Hot Rod #3](https://sketchfab.com/3d-models/coupe-33-hot-rod-3-low-poly-model-cb5b519024c7472895ef10a8663fb533) by [Daniel Zhabotinsky](https://sketchfab.com/DanielZhabotinsky), **CC BY 4.0**. Both the exported asset-specific `license.txt` and matching GLTF `asset.extras` identify the creator, source and licence; the licence explicitly permits commercial use with attribution. The public mirror is `abd0175149-droid/new-mafia`, commit `f1eab6db49e1eaf69d5fb61c4c09b529ada65595`, `frontend/public/3d/sketchfab/coupe33/`. Its code licence supplies no asset permission. The original Sketchfab page returned a proxy 403, so original account ownership was not independently verified. Credits and the adaptation notice are retained in `docs/THIRD_PARTY_CREDITS.txt` and the audit.

From repository root, with Python NumPy/Pillow and CPU Blender 4.3.2:

```sh
python3 tools/hotrod_vehicle_source.py /tmp/hotrod-source
python3 tools/hotrod_vehicle_source.py /tmp/hotrod-source --verify-only
OPENBLAS_NUM_THREADS=1 python3 tools/hotrod_vehicle_models.py \
  /tmp/hotrod-source/scene.gltf --out /tmp/hotrod-clean/assets --work /tmp/hotrod-clean/work
```

Use fresh staging/work directories. The converter writes only `hotrod-vehicle-*` into the selected output directory; its common-writer intermediate stays under `WORK/pack-stage/`. `tools/hotrod_vehicle_verify.py` independently compares packed close vertices with the original source (requires SciPy). `tools/hotrod_vehicle_preview.py` renders the unmodified source using CPU Blender. Exact commands and output/source hashes are in the audit; all five shipped outputs reproduce byte-for-byte.

## Geometry, UVs and materials

The separate `DECVM001` pack draws **20,856 close / 5,202 far triangles**, including cabin, wheels, lamps and optical covers. Every active source face has one owner. The GLTF's mesh table also contains an unreachable 596-face alternate cut hood, which is excluded from the active stock-hood scene.

Close geometry bypasses reduction and preserves original split normals; do not weld or smooth it. Far parts use 25% edge-collapse reduction with custom normals transferred from source faces. Normals are signed 16-bit. Shared immutable geometry swaps by reference; an open/damaged door pins close geometry for clipping and source anchors.

The source faces +X, Y up, +Z right. Conversion uses one uniform length fit and centring/ground translation. Its normalized dimensions are 4.5 × 1.62422 × 1.88523 m. The production 4.5 × 2.07 m vehicle spec selects native scale, exactly 8 map units per source metre; drawn dimensions remain 4.5 × 1.62422 × 1.88523 m. Existing collider, handling and save identity remain the hotrod's. Host fixtures extract the production dimensions; the earlier copied 1.8 m fixture and its smaller fit were corrected.

Eight padded material tiles, mostly native 1024px images, require a 4096px shared atlas to retain their original albedo/ORM tile resolutions together. Source 512px specular intensity is resampled to its corresponding 1024px tile for the shared grid. High/Ultra use 4096; Low/Medium deliberately downsample to 2048. Two mipmapped RGBA8 maps cost about 128 MiB at 4096 or 32 MiB at 2048, before other game textures. Texture identity is shared across cars and retained through tier changes.

- `.a` holds unchanged raw source UVs; `.t` holds the atlas rectangle. Repeat inside each rectangle, not across the full atlas.
- `.o` / `avOrmSourceUv` independently applies the source body's 20× `KHR_texture_transform` to roughness/metallic sampling. Albedo, occlusion and specular retain their untransformed source coordinates.
- ORM alpha carries the source `KHR_materials_specular` intensity for physical materials. Red supplies occlusion only for materials that declare it. Source factors and alpha remain independent of per-car paint.
- Only the untextured body pigment becomes white for resprays. Cabin/trim/wheel textures retain source colours. Existing road-dirt and paint roughness floors still apply.
- Ordinary hotrod wear/heat retains its physical material and UV/PBR shader. The `m.atlasPaint` gate for non-burnt pooled char is absent on this builder. Burnt wrecks use the existing matte approved-char path; repair restores source materials.

## Cabin, doors and wheels

Native seats, dashboard and roof liner draw once; no second procedural cabin is added. Driver/passenger hips use normalized source `[0,.665,±.29]` m. Original cushion rays put the surface 26.17 mm above that hip joint reference, and the full-size production head fit has 21.650 mm clearance. Characters and source chairs are not resized. `DRIVEBY_SEATS.hotrod` and `CAR_GLASS_BANDS.hotrod` match the fitted source body.

Steering grip circle: centre `[.21183315,.98653741,-.24934615]` m, radius `.17113967` m, tilt `.54038` rad. Production driver hand targets lie on this fitted rim. Pedal targets remain the existing approximation; the source has no rigged pedal hierarchy.

The source combines doors with its shell and has no separate authored door parents or hinge rig. [Source-backed front-door clipping](vehicles-and-driving-doors.md) extracts paint/trim/window layers at the measured span, opening a real aperture through the fixed body. Seats/dashboard remain visible; the fallback inner card belongs to the moving door. All source attributes, including the separate ORM UVs, survive clipping, shaped fallback panels, marks, crumple and repair. These are source-extracted doors, not native authored door animations.

Each tyre/rim keeps its exact source parent hub. Front wheels steer; all four roll with road speed in forward/reverse and use the same origins at both LODs. No separate source calipers exist, so none are invented or spun with the wheels.

`assetCars().models.hotrod` reports the loaded source. `hotrodVehicleReport()` supplies key, triangle budgets, atlas dimensions and source identity. Production host tests are `tools/tests/hotrod-vehicle-assets.mjs` and `hotrod-vehicle-rig.mjs`; the audit records their 208 assertions. Reproduce them with `node tools/hotrod-vehicle-host-check.mjs --out /tmp/hotrod-host-proof`; this also checks gameplay glass and the 19 extracted window rays. These CPU checks do not prove final shader compilation, transparent sorting or hardware FPS; rendered review evidence belongs to the parent review.
