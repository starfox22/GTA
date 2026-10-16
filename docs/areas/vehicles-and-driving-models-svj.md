# Vehicles and driving: downloaded BRUTINI SVJ

The ordinary `brutini` / BRUTINI SVJ uses SDC PERFORMANCE’s **Lamborghini
Aventador SVJ SDC (FREE)**, an actual downloaded CC BY 4.0 model. The fictional
game identity, collider, handling, tuning and saves retain their existing values.
The procedural builder remains the asset-disabled fallback.

Original listing: https://sketchfab.com/3d-models/lamborghini-aventador-svj-sdc-free-784e4656aca649cca55d6b18740a19b2 .
Pinned mirror: `pxlinspace/lambo`, revision
`e94085e40e5137ae1f9c35cc517024167e8711cb`,
`assets/models/lamborghini/lamborghini_aventador_svj_sdc__free.glb`.
The model-specific embedded glTF extras identify the artist, original listing,
title and CC-BY-4.0 license. The mirror’s application MIT license does not replace
the model’s license. Preserve the artist attribution in `THIRD_PARTY_CREDITS.txt`,
which is also included in the playable game’s complete credits.

`tools/svj_vehicle_models.py` downloads and verifies the pinned original GLB,
SHA-256 `4c56b1baafe861dcbb7438571d685ddb96709d3cc909f58b83bc58887e96fd16`.
The 18,659,824-byte source has 508,324 triangles, 62 mesh primitives, 30 materials
and one native 1024-square carbon JPEG. The listing mentions 4K textures, but the
downloaded file’s 1024-square image is the evidence for the shipped texture size.
No other assets from the mirror are included.

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 tools/svj_vehicle_models.py \
  work/svj-source/original.glb --download --out assets --work work/svj-convert
OPENBLAS_NUM_THREADS=1 python3 tools/svj_vehicle_verify.py \
  work/svj-source/original.glb --assets assets --out work/svj-source-proof.json
```

The converter writes only the independent `svj-vehicle-*` pack/textures. It keeps
all 508,324 near triangles, authored split normals and original UV seams/repetition.
The separate 20,133-triangle far model is decimated with transferred source normals.
Near normals use signed16 storage. An independent verifier compares every packed
near triangle corner’s position, normal and UV with its original source corner.
Existing vehicle, approved, C8, hotrod and motorcycle packs stay unchanged.

Source +Z becomes game +X. One uniform metre fit produces 4.94×1.143×2.274m,
including mirrors. With the existing 2.41m-wide game specification, runtime scale
is exactly 8 game units/metre; it does not shrink the length to fit the mirrors.
The source’s static display wheel steering/camber is neutralized by rigid
transforms around measured tyre-circle hubs; every source normal follows the same
rotation. Four separate wheels roll/steer/suspend at their actual source radii.
All three provided brake calipers stay hub-relative and cancel wheel roll; the
source has no fourth caliper, so no extra caliper is claimed as source geometry.

Both source doors/windows/mirrors are combined under a body-origin parent. The
converter separates the disconnected sides without cutting triangles. Forward
seam pivots and slightly outward scissor axes are **derived measurements**, not
authored animation pivots. Exact source-part ranges remove the closed door from
the body and lift its paint, trim/mirror and window together. Closing restores the
same immutable source geometry. The front luggage lid remains the source hood.

The source provides no seats, dashboard or steering wheel, and uses opaque dark
metal for its canopy. A fitted two-seat game cabin fills that missing interior;
the canopy uses the existing see-through gameplay glass, with no depth writing or
glass shadow. Source optical lamp/engine covers keep their transparent atlas pass.
The driver hip is about [-.05184,.21125,-.43]m; the actual production headroom
fit keeps the tallest character heads clear. `DRIVEBY_SEATS.brutini` and
`CAR_GLASS_BANDS.brutini` match this source fit.

Source body paint alone becomes white in its material tile for resprays. Carbon,
trim, badges, caliper colour, finish and lamp emission keep their source colours.
Lossless 2048 atlases retain the full native carbon image; Low/Medium use explicit
1024 derivatives. Texture objects stay shared through tier changes, and stale
asynchronous loads cannot replace a newer tier. Player cars retain full near
geometry. Undamaged traffic changes to far beyond 12m before tier bias, with the
existing hysteresis; open doors and damage pin near source ownership.

`svjAssets()` reports source identity, near/far counts and actual texture dimensions.
`assetCars().models.brutini.sourceKey` and the live `approvedAssets().models` must
report `svj_sdc`, so a procedural fallback cannot pass the runtime review.
`tools/tests/svj-vehicle-assets.mjs` exercises the actual builder, real headroom fit,
source doors, wheels, complete far draw and char/repair. The independent
`svj-loader-materials.mjs` exercises both actual media-loader stages, the decoder,
source UV/PBR hooks and texture-tier transitions. These CPU checks do not establish
final shader compilation, transparent sorting or hardware frame rate; the final
native game captures supply that separate evidence.
