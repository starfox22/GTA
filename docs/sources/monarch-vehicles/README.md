# Monarch downloaded car sources

The ten sources in [the pinned manifest](../../../tools/monarch_vehicle_sources.json)
replace eleven Monarch Prestige entries. The existing Brutini SVJ is retained.
All ten sources declare CC BY 4.0 at the model level; the game distributes the
required attribution in [THIRD_PARTY_CREDITS.txt](../../THIRD_PARTY_CREDITS.txt).
Repository application licenses are separate from those model grants.

| Game entry | Downloaded source | Identity |
| --- | --- | --- |
| Valkyrie | MHDesigning's Aston Martin Valkyrie | Valkyrie |
| DBS | Black Snow's Aston Martin DB11 | Aston GT family alternative |
| ZR1X / Chevette SE | Hari's 2019 Corvette C8 Stingray | C8 family alternative; shared full source |
| Wayron | andikapratamaw's Bugatti Veyron Super Sport | Veyron |
| Tourbillon | MdMahib's Bugatti Tourbillon 2024 | Tourbillon |
| Jasko | _Sheep19's 2007 Koenigsegg CCX without roof | Koenigsegg family alternative |
| Sirocco | Black Snow's Pagani Huayra | Huayra |
| Novera | metarex.4d's Tesla Roadster 2020 concept | EV-class alternative; not a Rimac Nevera |
| W1 | Desiccated_Lemon's McLaren P1 GTR | McLaren family alternative |
| Lafera | vecarz's Ferrari LaFerrari | LaFerrari coupe |

The manifest records the exact artist/source URLs, pinned GitHub mirror URLs,
SHA-256 and byte counts for all 36 native model/buffer/image files, observed
license evidence and the native glTF attribution records. The included exported
license files and two Tesla README files are verbatim evidence copies, each
pinned to its original URL and hash. The Tesla re-export has no embedded artist
or license extras; its evidence is the exact source link in the primary mirror
README, the indexed original listing and the independently attributed WebGi
README. This limitation is recorded rather than inferred from an app license.

Run these commands from the repository root, with Python 3, Node.js and the
existing converter dependencies (Blender, NumPy, Pillow and SciPy) available:

```sh
python3 tools/monarch_vehicle_sources.py
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 tools/monarch_vehicle_models.py \
  work/monarch-recipes.json --out work/monarch-assets \
  --work work/monarch-convert --reuse-prepared
OPENBLAS_NUM_THREADS=1 python3 tools/monarch_vehicle_verify.py \
  work/monarch-recipes.json work/monarch-assets/monarch-vehicle-models.bin \
  --out work/monarch-corner-proof.json
```

The first command downloads only missing pinned inputs into ignored
`work/monarch-sources/`. It verifies native bytes, every external glTF companion,
the model attribution records, local evidence copies and decoder identity before
emitting `work/monarch-recipes.json` and `work/monarch-source-receipt.json`.
An existing file with a different hash is rejected; the helper never silently
overwrites it. Downloads are verified in a temporary file before being installed.
`--only monarch_valkyrie,monarch_db11` stages a smaller selection.

Veyron and CCX require `EXT_meshopt_compression` preparation. The helper fetches
the hash-pinned official meshoptimizer 0.22 decoder and runs
`tools/monarch_vehicle_decode.cjs`, which emits the decoded GLB plus a detailed
view/accessor receipt. Both native and prepared GLB hashes are pinned. This step
does not change source quantization, material/image data, scene transforms or
accessor semantics. Native files remain unchanged. No rejected candidate is
part of the manifest or rebuild.

To reuse an earlier download collection without another network transfer:

```sh
python3 tools/monarch_vehicle_sources.py --offline \
  --import-recipes work/previous-source-recipes.json \
  --decoder work/previous-decoder/meshopt_decoder.js
python3 tools/monarch_vehicle_sources.py --check-only
```

`--import-recipes` uses only the matching source key's native directory and
canonical relative companion names, and checks the canonical hashes before
copying. Its old rig/metadata is ignored. `--check-only` validates already staged
native/prepared sources without copying, decoding or downloading. It refreshes
the source receipt but leaves the aggregate recipe unchanged.

Editable per-source recipes are in `tools/monarch-recipes/`. They specify rigid
coordinate and display-steering alignment, one uniform real-size fit, native
wheel/caliper roles, full-face damage/door/pane roles and measured cabin contacts.
Descriptive `fitEvidence` and `measuredFit` notes retain initial source
measurements, including bounds before display-wheel neutralization and ground
rounding. Conversion recomputes these values; the final pack’s `sourceShift`,
`sourceUniformScale` and fitted dimensions describe the finished kit. The explicit
seat metadata and open-top classifications match the final pack.
Near keeps all included source faces and authored corner attributes. Only Far
is reduced; the six CCX studio-plane faces are explicitly excluded. The existing
ordinary Chevette C8 pack and Brutini SVJ pack are separate and unchanged.

PBR channels use padded per-source atlases, preserving source material/UV seams,
opacity modes, color attributes and normal scale. P1 GTR alone explicitly limits
source images to 1020 pixels per edge to fit its 4096-pixel atlas budget; this is
resampling, not a claim of lossless texture copying. Low/Medium maps are at most
1024 pixels. High scalar-only palettes allocate compact maps rather than empty
4096-pixel maps. Fitted game seats/dashboard are supplied for sources without
an authored cabin. The fictional vehicle names and driving specifications are
unchanged by source-family alternatives.

See [the pipeline contract](../../areas/vehicles-and-driving-models-monarch-pipeline.md)
for conversion, immutable sharing, renderer attributes and independent corner
verification. Conversion output can vary with Blender/library versions; the
source pins and per-corner proof establish input identity and source preservation.
