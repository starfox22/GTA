# Downloaded Dolcati source and integration evidence

The owner requested a realistic internet model specifically for the Dolcati.
This replacement uses **Ducati Panigale V4** by **ROY**, under **CC BY 4.0**.
The pinned GitHub mirror and exact SHA are in [conversion-receipt.json](conversion-receipt.json).
The GLB itself embeds the author, original Sketchfab URL and model-specific licence;
the mirror README independently gives the same attribution. The original Sketchfab
page returned 403 during this session, so creator-page availability is not claimed.

Reproduce without modifying any previous pack:

```sh
python3 tools/dolcati_vehicle_models.py work/dolcati-source/roy.glb --download \
  --out assets --work work/dolcati-convert
```

All 372,664 close source faces, authored split normals and source UVs survive.
[Geometry reductions](geometry-reductions.json) records exact-attribute bypasses
for every near part and the independently reduced 25,717-triangle far parts.
Native source images remain at their authored resolutions in the 2048px atlas;
Low/Medium use 1024px derivatives. The source declares no normal map.

The host regression invokes the actual pack decoder, builder, wheel rig, LODs and
character IK. It checks separate instance state, shared geometry, fixed fairing
lamps, per-wheel contacts and paired rider grips at three adult heights. The
finite anatomy clamp remains at extreme full lock for the shortest rider.
Unoccupied Low/Medium and distant bikes receive far geometry. The player bike and
close High/Ultra inspection retain the source hero mesh. Host mesh budgets include
the coarse rider placeholder and are not whole-scene FPS measurements.

`host-regression.json` contains assertions, source/traffic budgets and contact errors.
The lead session supplies matched native game screenshots, shader validation and
combined gameplay checks before publication; this source audit does not claim
visual verification from numeric tests alone.
