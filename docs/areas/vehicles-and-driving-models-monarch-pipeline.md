# Vehicles and driving: Monarch downloaded-source pipeline

`tools/monarch_vehicle_models.py` converts independently attributed downloaded
glTF/GLB cars into the separate `monarch-vehicle-models.bin` pack and per-source
WebP families. Fictional gameplay names map through each source model's
`gameTypes`; two trims may share one source kit. Source selection, identity and
fallback disclosure belong in the collection's credits and audit, not in guessed
model names. Existing vehicle packs are protected by before/after hashes.

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 tools/monarch_vehicle_models.py \
  work/monarch-recipes.json --out work/monarch-assets --work work/monarch-convert --reuse-prepared
OPENBLAS_NUM_THREADS=1 python3 tools/monarch_vehicle_verify.py \
  work/monarch-recipes.json work/monarch-assets/monarch-vehicle-models.bin --out work/monarch-proof.json
OPENBLAS_NUM_THREADS=1 python3 tools/test_monarch_vehicle_models.py
```

Recipes pin source SHA-256, every external glTF buffer/image companion SHA-256,
artist, source URL and license; state source forward
axis, metre length and optional rigid source rotation; identify four independent
tyre/rim/caliper groups; and claim original triangle ranges by primitive ID,
material/path expression and optional source-frame centroid bounds. Rules claim
whole faces in order. Unclaimed faces remain source trim. Explicit exclusions
account separately for studio floors. Seats, glazing bounds and door pivots are
measured gameplay fits, not claims of authored animation. Static display steering
is removed by one rigid transform around each measured tyre hub, including its
source normals and caliper. Near keeps every included original source face.

Meshopt sources first use `tools/monarch_vehicle_decode.cjs`, which requires the
pinned official meshoptimizer 0.22 decoder and records native/decoded hashes and
view proofs. It redirects compressed views without rewriting accessor semantics,
materials, images or scene transforms. It rejects Draco instead of silently
substituting geometry. Original native downloads remain untouched.

The converter preserves source split normals, source COLOR0 RGBA, independent
UV0/UV1 maps and per-channel texture transforms. Referenced UV sets above1 and
unsupported non-repeat samplers fail explicitly. PBR maps, normal scale, source
sidedness and source MASK cutoffs travel per vertex. Atlas pigment neutralization
applies only to verified paint roles; badges, vents, cabin and same-material wheel
parts retain source colour. Source emissive strengths are normalized against the
model's recorded runtime emission multiplier. The renderer uses game glazing,
resprays, lamps and finish approximations for unsupported glTF material extensions;
this is not an assertion of an identical external path-traced material system.

Atlas size is the smallest power-of-two fit below the recipe ceiling. Source
images are resampled only with an explicit `maxTextureSize`; native/staged sizes
and RGBA8-with-mips GPU estimates are recorded. Low/Medium default to 1024 and
cannot exceed 1024. Geometry Far alone uses the existing Blender reducer and
nearest same-material source UV1/colour transfer. `--reuse-prepared` accepts a
cache only when source part input, part manifest and reducer SHA all match.
Identical typed-array payloads and exact constant prefixes share immutable pack
offsets; every alias is compared byte for byte. `--deduplicate` can apply the same
storage pass to an existing generated pack. `--update-seat-fits` updates only
measured seats and the explicit source `openTop` fit flag for the same pinned source and verifies that the entire
binary geometry/material payload remains unchanged.

`monarchVehicleData/Model/Materials/Paint/Lamps/KitFit/TextureQuality/Report`
are the runtime hooks. All source kits, geometry and shared palettes are cached.
Texture families load lazily. Low/Medium use the bounded Low images; High keeps
only the current driven or nearest inspected source family at full texture size,
with an 18m walking range and hysteresis. All other families retain Low images.
The old hero demotes synchronously before the next High promotion; stale image
callbacks cannot restore a retired High request. The complete ten-source set is
about 118MiB of RGBA8 textures with mipmaps at Low, and about 438MiB with the
largest single High hero, before unrelated game textures and geometry. These are
allocation estimates, not measured hardware throughput or a universal VRAM cap.
The combined `avSurface` vec4 uses one vertex attribute slot: paint mask,
double-sided flag, normal scale and source alpha cutoff (`-1` opaque, `-2` blend).
Near source geometry is immutable; do not deform it or dispose a shared resource
when a vehicle retires. Dynamic source door assemblies retain original closed
face ownership, and source-fixed calipers cancel wheel rotation. Missing cabin
geometry receives an explicitly fitted game cabin.
Measured source seats may pass `fixed`, `floor`, `minHipY` and `pedal` controls;
generic fallback constraints remain unchanged when these fields are absent.

The independent verifier checks every near corner against the pinned original
position, rigid normal, four channel UVs, colour and source flags. It also checks
face conservation and valid Far arrays. Synthetic host cases cover coincident
COLOR/UV1 seams, display-steered wheels, per-role pigment ownership, source hash
and wheel rejection, native alpha cutoff and explicit texture budgets. Production
builder tests and native shader/render captures remain separate required checks.
