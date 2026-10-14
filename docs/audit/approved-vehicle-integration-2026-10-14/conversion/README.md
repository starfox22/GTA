# Rebuilding the approved vehicle sources

The converter builds **all five approved models** into a separate pack. It never rewrites
the original 23-model pack. Source downloads stay outside the repository; use
[source-inputs.json](source-inputs.json) for exact URLs, filenames, sizes and SHA-256 checks.
[source-provenance.json](source-provenance.json) records creators, licence evidence and adaptations.

| Approval | Original repository and revision | Original path / prepared input |
|---|---|---|
| M1 enduro | `vimontgames/vgframework@b3173a3814790af7061f1949437a3c958b00000b` | `data/Meshes/Cars/Motorbike/{motorbike,motorbike_fork,motorbike_wheel}.fbx`; prefab/materials below |
| M2 sport | `thomasfork/Nonplanar-Vehicle-Control@8cb0ee51e2cf5cf7b3abbf21d3bdadc538a6c672` | `assets/motorcycle.glb` → `motorcycles/nonplanar/assets--motorcycle.glb` |
| S1 Jimny | `PatrickRuan/Jimny3D@e582c466ae61c4543168fbacfe8e57e94d94101f` | `public/models/jimny.glb` → `suv/jimny-2023.glb`, then decode below |
| S2 SUV / S3 offroad | `clarkbar-sys/done-rite-detailing@299ee2e33d72828281a8f7048242a42c60339b01` | `src-models/generic_passenger_car_pack/generic_passenger_car_pack.glb` → `suv/carpack-4.glb` |

S2/S3 use the **original 11,761,956-byte pack**, SHA `a2d5667f…`; the processed mirror
variant used during research has different meshes and is unsuitable for this converter.

M1's `data/Prefabs/Cars/Motorbike.prefab` is XML, saved as `prefab.xml`.
Other M1 filenames replace every `/` in the original path with `--` and live under
`motorcycles/vgframework/`. Required materials are `Motorbike.mat`, `MotorbikeLights.mat`,
`ScooterMetal.mat`, `ScooterPlastic.mat` and `ScooterWheel.mat`, from the original
`data/Materials/Cars/Motorbike/` and `data/Materials/Cars/Scooter/` directories.
The texture is `data/Textures/Cars/Motorbike/motorbike_albedo.png`.
The prefab instances `Motorbike`, `HandleBar`, `FrontWheel` and `BackWheel`.
The Blender preparation helper uses raw FBX vertices and prefab transforms, matching
the source engine importer, rather than also applying the FBX scene placement.
Particle-only prefab resources are not needed for vehicle geometry.

## Tools and source download

Audited tools: **Python 3.12.14, NumPy 2.3.5, Pillow 12.3.0, Blender 4.3.2,
Node 24.19.0**. Blender supplies its own Python/NumPy. The converter uses NumPy and
Pillow in the host Python; SciPy was used only for exploratory component audits.
The decoder uses Node built-ins and the official wrapper/WASM, with **no npm install**.

From the repository root, this creates a fresh, checksum-verified source tree:

```sh
python3 - <<'PY'
import hashlib, json, pathlib, urllib.request
root = pathlib.Path('/tmp/GTA-approved-sources')
manifest = json.loads(pathlib.Path(
    'docs/audit/approved-vehicle-integration-2026-10-14/conversion/source-inputs.json'
).read_text())
for item in manifest['files']:
    with urllib.request.urlopen(item['url'], timeout=60) as response:
        data = response.read()
    assert len(data) == item['bytes'], item['path']
    assert hashlib.sha256(data).hexdigest() == item['sha256'], item['path']
    target = root / item['path']
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
print('Verified', len(manifest['files']), 'pinned source files')
PY
```

## Exact Jimny Draco preparation

The decoder is the **Google Draco 1.5.6 glTF build**:

- [Official wrapper](https://raw.githubusercontent.com/google/draco/1.5.6/javascript/draco_wasm_wrapper_gltf.js), downloaded as `draco/draco_wasm_wrapper.js`; SHA `8bb2952d2ba7d67e1414f8df819410cb0434a666be53f671fff75f68843d76f6`.
- [Official WASM](https://raw.githubusercontent.com/google/draco/1.5.6/javascript/draco_decoder_gltf.wasm), downloaded as `draco/draco_decoder.wasm`; SHA `a680d927bed9cb864ddbd63521868891af2bfbe755092761b4837487618df8ac`.
- Software licence: [Apache 2.0](https://github.com/google/draco/blob/1.5.6/LICENSE).

Both files byte-match the decoder originally obtained from the Jimny mirror and the
Three.js r160 `examples/jsm/libs/draco/gltf/` distribution. The 1.5.7 WASM differs;
use the pinned 1.5.6 pair together. The helper validates both hashes before loading it.

```sh
node tools/approved_vehicle_models_decode.cjs \
  /tmp/GTA-approved-sources/suv/jimny-2023.glb \
  /tmp/GTA-approved-sources/suv/jimny-decoded.glb \
  /tmp/GTA-approved-sources/draco
```

Input SHA: `0f70478e347b1bf19410e45ade6f0b1037041df5417b7bc8da4d9739bdb5f6ce`.
Decoded SHA: `5e9062ad80993b33b716a003de8f0a766299daadfa36ba7caeef99c26b13c2d7`.
Output: 45,908,032 bytes, **146 primitives, 456,991 triangles, 1,203,752 vertices**.
This step only decompresses geometry; embedded image bytes, materials and author/licence
metadata remain intact. It writes a `.decode-receipt.json` alongside the output.

## Fresh conversion without cached geometry

Choose an unused work directory. This command assembles M1, partitions all sources,
generates both LODs through Blender, builds the atlases and writes every model anew:

```sh
python3 tools/approved_vehicle_models.py /tmp/GTA-approved-sources \
  --work /tmp/GTA-approved-rebuild-fresh/work \
  --out /tmp/GTA-approved-rebuild-fresh/assets
```

Do **not** use `--reuse-geometry` for a clean rebuild or after changing source geometry,
part classification or simplification. That option is for metadata/material-only updates
against an already matching `parts-output.npz` and lookup. The earlier opaque-optics / coating-only S2 caches
are incompatible with the current source roles; rebuild those in an unused work directory. `write_pack()` derives and
verifies every close/far mapping on both paths.

Expected close/far triangle totals are M1 **12,350/2,707**, M2 **50,795/12,820**,
S1 **65,000/10,043**, S2 **7,948/4,354**, S3 **6,502/3,563**. See
[approved-vehicle-conversion-receipt.json](approved-vehicle-conversion-receipt.json).
The published pack SHA is `9fc2408fd1f8b7b2649a4e69d6868854c22987856ef6868e0f8d0c3b51d28512`.
Receipts record the actual rebuild hash; serializer ordering or different Blender/tool
versions can change binary hashes, so inspect metadata/geometry and run the approved
vehicle host regressions before replacing the committed pack.

HQ atlases retain the full source image resolutions; LOW/MEDIUM get 2048² variants.
Raw repeated UVs and per-material rectangles are separate attributes, and only the
Comrade coating pigment is neutralized for game paint. Original trim texels remain.
The converter's pack verifier checks all parts, attributes, indices, rolling tyres,
budgets and LOD maps. Replacements still need rendered shader, damage/repair, rider
and graphics-tier checks after integration. Asset creator licence evidence is separate
from the decoder software licence; M1/M2's primary creator pages remained inaccessible.


## Authored optics and exterior paint corrections

Jimny's **17,818 non-cabin BLEND source faces** are a separate `opticalGlass` role,
**5,329 close / 390 far triangles**, retaining their source tint and alpha (.4 for
black/amber/reflector covers, .5 for red covers). Opaque reflector geometry remains
under the working lamp roles. The runtime draws these covers once with source maps,
two-sided transparency and depth writes disabled; it does not alpha-test them away.

S2's verified outer roof and upper doors include **840 nonmetallic source faces**
previously assigned to trim (406 roof, 434 upper doors). Their positions, normals,
UVs, RGB and ORM remain intact; only their render/damage role changes to shell/panels.
Selection uses the named main source-body component, outward normals, measured
bounds and source first-surface tests. Detached handles/rails and other materials
remain separate. All **45 roof/door verification rays** hit the actual paint surfaces.
The body atlas is byte-identical to the previous candidate, and pigment normalization
still affects only the original coating93 region.

[exterior-paint-proof.json](exterior-paint-proof.json) lists exact moved source face IDs
and ray coordinates. [source-optics-exterior-proof.json](source-optics-exterior-proof.json)
records full face ownership, source alpha/texel checks and unaffected-array comparisons.
M1/M2's **302 arrays are byte-identical** to the previous pack; S3 changes only four
window atlas-UV/rectangle arrays because its transparent black tile is now distinct
from opaque mirror black. Its positions, normals, indices, raw UVs and finish are
unchanged. The previous and current pack hashes are both recorded in the proof.
