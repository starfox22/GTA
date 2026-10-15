# Vehicles and driving: sports source preparation

## Source and attribution

- Author: [Hari / Hari31](https://sketchfab.com/Hari31).
- Original listing: [2019 Chevrolet Corvette C8 Stingray](https://sketchfab.com/3d-models/2019-chevrolet-corvette-c8-stingray-790c40ccff6843eab0b7b4bd18421ff8).
- Asset-specific exported `license.txt` and matching `scene.gltf` `asset.extras`:
  **CC BY 4.0**, attribution required, commercial use explicitly allowed.
- Reproducible mirror: `zymantas-dev/corvette-c8-threejs-exp`, revision
  `1811c2f116145a409131839be5b2411e4f4f92de`, directory
  `static/models/2019_chevrolet_corvette_c8_stingray/`.
- Exact URLs and all 27 SHA-256 values: [sports_vehicle_source.json](../../tools/sports_vehicle_source.json).
  The source download is 13,518,032 bytes, 263,683 triangles, 119 primitives,
  50 materials and 24 native images. No Draco/meshopt decoder is needed.
- The original Sketchfab page returned an access denial in this environment. The
  licence evidence comes from the asset-specific original export in the pinned
  mirror; independent verification of the original account's ownership was unavailable.
  Preserve that limitation in future reports.

Use this credit in redistributions and the game's asset credits:

> This work is based on "2019 Chevrolet Corvette C8 Stingray"
> (https://sketchfab.com/3d-models/2019-chevrolet-corvette-c8-stingray-790c40ccff6843eab0b7b4bd18421ff8)
> by Hari (https://sketchfab.com/Hari31), licensed under CC BY 4.0
> (https://creativecommons.org/licenses/by/4.0/). Modified for Dead End City:
> uniform coordinate/size fit, conservative LOD reduction, source material atlases,
> paint template and native door/wheel partitioning.

## Clean source preparation and conversion

Python 3 with NumPy/Pillow and Blender 4.3 are required; the saved environment
already provides these. The downloader keeps TLS verification and verifies every
dependency against the pinned hashes. Source files stay outside the checkout.

```sh
python3 tools/sports_vehicle_source.py /tmp/c8-source
python3 tools/sports_vehicle_source.py /tmp/c8-source --verify-only
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 tools/sports_vehicle_models.py \
  /tmp/c8-source/scene.gltf --out /tmp/c8-clean/assets --work /tmp/c8-clean/work
OPENBLAS_NUM_THREADS=1 python3 tools/sports_vehicle_models_verify.py \
  --source /tmp/c8-source/scene.gltf --assets /tmp/c8-clean/assets --work /tmp/c8-clean/work
OPENBLAS_NUM_THREADS=1 python3 tools/sports_vehicle_models_texels.py \
  --source /tmp/c8-source/scene.gltf --assets /tmp/c8-clean/assets --work /tmp/c8-clean/work
```

Use a fresh work directory for a clean rebuild; it does not need cached
`parts-output.npz`. `sports_vehicle_models.py` calls the common Blender helper
`approved_vehicle_models_prepare.py` with `preserveSourceNormals:true`. Do not
replace that flag with a smooth-normal rebake. Unreduced seats bypass Blender
exactly; reduced meshes transfer original custom corner normals after collapse.
Five collapsed decorative trim vertices that produced zero normals use the nearest
same-material authored normal, 1.3–3.3 mm away; the exact repairs are in the receipt.

The original pack `vehicle-models.bin`/`vehicle-atlas.webp` is checked unchanged.
The converter writes only `sports-vehicle-*` in its selected output directory.
The separate approved five-vehicle pack is neither opened for mutation nor merged
into the sports pack. Import the seven staged outputs through the existing asset
manifest only after structural, source and runtime checks pass.

Native source inspection, without modifying/exporting source geometry:

```sh
blender -b --threads 1 -P tools/sports_vehicle_preview.py -- \
  /tmp/c8-source/scene.gltf /tmp/c8-preview
```


Runtime geometry/material/door/seat contracts and CPU verification: [sports integration](vehicles-and-driving-models-sports.md).
