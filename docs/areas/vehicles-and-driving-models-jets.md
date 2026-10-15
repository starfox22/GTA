# Downloaded airport jets

The flyable `jet` (AURELIA J8 identity) draws a downloaded Citation exterior.
Oceanview's three static terminal aircraft draw a downloaded Boeing 737. The
flyable `airliner` and mission courier retain their existing procedural models.
Existing flight handling, controls, damage, shadows and saved airframe keys stay
on the aircraft contracts. The separate `jet-models.bin` / `jet-skin.webp` pack
does not rewrite the Bell/Cessna pack or any car/motorcycle pack.

Runtime: `jet-assets3d.js`; route in `makePlane`; static route in `parkedJet`.
Console `jetAssets()` reports model sources, actual dimensions and budgets.

| Source / use | Near triangles | Far triangles | Model size, length × span × height |
| --- | ---: | ---: | --- |
| Citation exterior / flyable business jet | 20,131 | 6,929 | 15.621 × 14.750 × 5.663 m |
| Boeing 737 / static terminal transports | 162,629 | 17,319 | 39.232 × 35.672 × 12.693 m before stand scaling |

The Citation fits the existing jet's 14.75 m span uniformly. Its rendered length
is shorter than the existing conservative 18.75 m collider; no axis is stretched.
Each static 737 retains its stand's former aircraft length. The actual 737 wing
plan is wider than the previous procedural aircraft and is represented by the
matching compound collision plan in `geography-regions.js`.

## Source and licensing

Both models are **CC BY 4.0**, including commercial use with attribution. Exact
download URLs, complete pinned mirror revisions and every input SHA-256 are in
[`jet_models_source.json`](../../tools/jet_models_source.json).

- **1990 Cessna Citation, Texture Detailed, Exterior**,
  [BlenderCommunityHead](https://sketchfab.com/aboodgoudagad),
  [original listing](https://sketchfab.com/3d-models/1990-cessna-citation-texture-detailed-exterior-a78839624fe64900a8352cb23462350a).
  Mirror: `SKauanDev/Anubis`, revision
  `827d46ce9cdefbf70c529196b28481e6735db658`, `public/models/citation2.glb`.
  Embedded asset metadata matches the mirror's asset-specific attribution table.
  This is an already optimized source derivative: geometry merged, native image
  reduced to 256px, exterior only. It is not the full original author export.
- **Southwest Airlines Boeing 737**,
  [A Random Modeler](https://sketchfab.com/danielskom111),
  [original listing](https://sketchfab.com/3d-models/southwest-airlines-boeing-737-73d0cd0c03594c5d9c53235d74b429bf).
  Mirror: `zyetaone/z-aero-window`, revision
  `f29024af69b6ab925103b90ef165d092b1f6cda8`,
  `tools/wing-source/southwest-737/`. Original `license.txt` and exported glTF
  metadata agree. All 500 primitives, 36 source materials and the actual cabin
  seats/floor are retained in the near model. The source has no image textures.

Original Sketchfab pages are blocked in this environment; the asset-specific
export evidence above is the licensing basis. Generic repository software
licences are not treated as model licences. No purchase or account credential
was used. Required redistribution credits:

> This work is based on "1990 Cessna Citation, Texture Detailed, Exterior"
> (https://sketchfab.com/3d-models/1990-cessna-citation-texture-detailed-exterior-a78839624fe64900a8352cb23462350a)
> by BlenderCommunityHead (https://sketchfab.com/aboodgoudagad), licensed under
> CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
> Modified for Dead End City: uniform frame/size fit, source-triangle partition
> into estimated control/gear pivots, distant geometry reduction and game lights.
> The mirrored derivative already reduced geometry and the image to 256px.

> This work is based on "Southwest Airlines Boeing 737"
> (https://sketchfab.com/3d-models/southwest-airlines-boeing-737-73d0cd0c03594c5d9c53235d74b429bf)
> by A Random Modeler (https://sketchfab.com/danielskom111), licensed under
> CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
> Modified for Dead End City: uniform frame/size fit, fictional Oceanview
> material palette and branding-face recolor, material merging and distant LOD.

## Conversion and source fidelity

```sh
python3 tools/jet_models_source.py /tmp/jet-source
python3 tools/jet_models_source.py /tmp/jet-source --verify-only
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 tools/jet_models.py \
  /tmp/jet-source --out /tmp/jet-rebuild/assets
python3 tools/jet_models_verify.py /tmp/jet-source \
  /tmp/jet-rebuild/assets/jet-models.bin /tmp/jet-rebuild/verification.json
```

For the checked-in pack, pass `--receipt
docs/audit/police-aviation-review-2026-10-15/verification/jet-conversion-receipt.json`;
the receipt is kept with audit evidence rather than embedded as game media.

Near geometry retains every source triangle, original split normal and UV.
There is no ratio-one weld or normal smoothing. Normal quantization is signed
16-bit; positions are signed 16-bit over each complete model. Regular UVs are
unsigned 16-bit. The 737's untextured fan primitives contain UVs well outside
0–1; their parts store Float32 UVs without clipping. Indices use 32 bits only
when the source cabin needs them. Both sources explicitly authored double-sided
materials; the runtime preserves that flag. Far simplification keeps surviving
source positions, normals and UVs. The 737's 76,646-triangle cabin is near-only.

The Southwest letters/hearts are welded inlay faces forming the shell. Removing
them would open literal letter-shaped holes. All **4,140 branding faces are
recolored**, with exact original triangle IDs in `jet_models_branding.json`.
Shared-edge and projected-glass audits prove the ownership; window cutouts
already exist in those faces. The fictional navy/teal palette retains navigation
light red and existing source trim. Material finish is adapted for the game
(Citation paint roughness .46 rather than source .801); no authored normal,
roughness or metalness maps are invented.

## Rig, sharing and practical limits

The Citation mirror merged its source parts. Seven control regions and three
gear regions partition its actual triangles; the neutral pose reconstructs the
source exactly. Hinge cuts and retraction poses are **adaptation estimates**
measured on the source, not an authored aircraft animation. Paired upper/lower
skin measurements produce mirrored hinge midlines; the rudder follows its fin's
sweep with no lateral axis tilt. Nose/main pivots are measured at their source
attachment regions. Gear follows `c.gearPos`; controls follow the existing stick,
rudder and flap channels. Seven small bay triangles remain fixed.

The Citation has painted windows, no cabin interior, and dark intake disks
without separate turbine blades. These source limitations remain visible; the
runtime does not present procedural additions as downloaded source detail.
The static 737 has actual fan blades, gear and cabin geometry. Its source fans
have measured axes but do not animate on parked scenery.

Each model's near/far geometries are cached and shared. The player aircraft pins
near; other jets switch at the existing tier-scaled viewing distance with
hysteresis. Static transports use Three.LOD at a tier-scaled distance and stay
outside the static merger, so no instance duplicates or permanently merges the
full close mesh. The static aircraft draw four material groups near and three
far; cabin and glass do not cast shadows. This is a measured asset budget, not a
hardware frame-rate claim.

The native Three.js test `jet-assets-rig.mjs` checks the production decoder,
builders, animation, LOD, dimensions, contact, sharing and repair map restore.
`jet-assets-lifecycle.mjs` exercises actual renderer retirement: private instance
paint is disposed; all 29 shared source geometries and four static materials
survive retirement, respawn and quality-scaled static LOD changes. Both tests use
the standard runner's assertion contract (26 rig + 43 lifecycle assertions).
The independent Python verifier reconstructs all 182,760 original triangles and
their corner attributes, and rejects deliberately corrupted normals, UVs and
winding. Source/pack inspection images and numeric receipts are indexed in
[the jet audit](../audit/police-aviation-review-2026-10-15/jet-assets.md).
