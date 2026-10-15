# Vehicles and driving: licensed C8 sports model

The ordinary `chevette` / CHEVETTE Z06 now uses Hari's downloaded **2019 Chevrolet
Corvette C8 Stingray**. This is a C8 Stingray source, not an exact Z06 model. Its
4.69 m game length, collider, handling, tuning and save identity remain the existing
Chevette's. `chevetteSE` and the other Prestige variants retain their own builders.
The source provides an actual cabin, two bucket seats, dashboard, gauges, engine,
door cards, windows and mirrors. Do not add a second procedural cabin inside it.

The active seat fit uses each source cushion: driver hip
`[.035,.23,-.464]` m; passenger `[0,.24581404,+.464]` m, each with its measured
minimum hip height. `seatOccupant` uses the separate passenger plan rather than
mirroring the lower driver seat. Full-size head clearance is 21.35/21.99 mm.
The measured cushion is about `.24984` m high; the hip joint sits about2cm below
its surface. Preserve the full character scale and source chair geometry rather
than shrinking riders. `DRIVEBY_SEATS` records `[.035,.23,.464,.49,.7997014]`;
headroom and real door/drive-by checks must stay in step if those values change.

The steering rim's fitted grip circle is centred at
`[.31392,.72501,-.358883]` m, radius `.165` m, tilt `.25284` rad.
`carSeatPlan` accepts independent `wheelZ` and `radius` overrides; its `wheel`
X option remains relative to the windscreen foot. The authored steering node is
a column pivot, not the rim centre. The fit is accurate to about 5–10 mm; the
normal hand targets lie within 11.34 mm of the original leather surface.
See [source measurement](../audit/vehicle-fidelity-2026-10-15/verification/c8-steering-contact-source.json).

Source, attribution, pinned downloads and clean offline rebuild commands: [sports source preparation](vehicles-and-driving-models-sports-source.md).

## Pack and source geometry contracts

`sports-vehicle-models.bin` uses `DECVM001`, model key `c8_hari`. Hero/far counts
are **85,031 / 9,407 triangles**. There are 43 actual parts at each resolution;
43 source partitions own all 263,683 source faces exactly once before reduction.
The source's front −Z becomes game +X, Y remains up and source +X becomes game +Z.
One uniform scale fits the 4.69 m length; final dimensions are approximately
4.69 × 1.203 × 2.171 m including mirrors.

- `.p`: 16-bit positions with model `quant`; `.n`: **16-bit** authored normals,
  divisor32767; `.i`: u2 or u4 according to actual vertex count.
- `.a`: original float source UV, including repetition; `.t`: normalized atlas
  rectangle. `.uv` remains available for the general damage contract. Never
  overwrite `.a/.t` for a respray/livery.
- `.f`: normalized per-vertex roughness/metallic scalar; shared ORM texture retains
  source factors independently. Lamp `.c` is white: the source has no COLOR_0 and
  albedo is already in the map, so a baked lamp colour would multiply it twice.
- `roleParts` expands `shell`, `panels`, `hood`, `glass`, `trim`, `cabin`,
  `opticalGlass` and each `Far` counterpart into actual part names. Alias expansion
  must request raw parts to avoid recursion where an actual part shares its role name.
- `lodParts` explicitly maps actual parts and canonical roles to their Far names.
  Every near and Far source part has exactly one closed render owner: canonical
  roles, four lamps or a tyre/rim/caliper slot. Indicators belong to trim aliases
  while retaining distinct source ranges for native doors.
- `rolePanes.glass`/`glassFar` are five triangle counts in the game's pane order.
  Source door windows join fixed glass **by pane**, retaining
  `geometry.userData.vehiclePartRanges` so extraction removes exactly the authored
  door layers without cutting unrelated cabin/roof geometry.
- `doors.left/right` contains side−1/+1, authored parent hinge and normalized axis,
  source bounds and actual `paint/trim/cabin/glass/indicator/opticalGlass` part names.
  These are author pivots near the front door seams, not arbitrary body origins.
  Mirrors and their optical covers travel on the native door; their transparent
  covers are excluded from breakable cabin pane bounds.
- Four wheels retain exact source parent hubs and axle metadata. Tyre and rim are
  children0/1. Calipers are separate hub-relative child2 and counter-rotate against
  wheel roll, following steering/camber/suspension. Calipers must never also be in
  fixed trim roles. Their matching Far parts retain the same hub origin.

## Materials and performance

Six independent lossless WebP atlases provide albedo, linear ORM and sRGB emissive
maps at4096 (HIGH/ULTRA) and2048 (LOW/MEDIUM). All three channels use identical
source rectangles. The native images fit4096 without blind source downsampling;
the2048 tier is an explicit offline downsample. Only untextured body material0's
red pigment becomes white for resprays; cabin, trim and detailed source maps retain
their colours. Transparent source alphas .5/.75 remain128/191 in the albedo atlas.
Optical covers use one transparent two-sided pass with `depthWrite:false`.

Gauges, buttons, display and lamp emission remain a separate emissive atlas,
sampled through the same repeated-source UV shader as albedo/ORM. Day/night,
braking, damage and char shaders must retain those maps. Char pool reuse restores
source opaque/transparent flags, emission intensity and finish floor on every reuse.

Far parts are cached and swapped by mesh reference. Door movement or damage pins
the close parts so native source ranges remain valid. Geometry is shared until the
existing per-car damage path needs a clone. Atlas quality changes preserve Texture
identity, ignore stale asynchronous loads and dispose old GPU storage before
changing dimensions. Three4096 RGBA8 mipmapped maps cost roughly256 MiB;2048 costs
about64 MiB, before other game textures. Actual hardware FPS needs a browser/GPU
measurement; source triangle budgets alone do not establish an FPS promise.

The four head/tail meshes also swap to their authored Far geometry while retaining
lamp state materials. Actual closed-model traversal is85,031 close /9,407 far
triangles. Retaining near lamps would silently add1,958 triangles per distant C8;
the production host test checks the complete draw, not just exported metadata.

## Verification and evidence

The [isolated conversion audit](../audit/vehicle-fidelity-2026-10-15/conversion-c8/README.md)
contains source/licence receipts, source partition proof, native previews, exact
per-part LOD counts, output hashes and the offline integrity/host results.
`tools/tests/sports-vehicle-assets.mjs` uses the real production decoder, geometry,
role composition, C8 builder, wheel animation, LOD, material shader hooks, asynchronous
texture tier loader and char/repair pool. It runs without WebGL:

```sh
node --input-type=module - <<'JS'
import run from './tools/tests/sports-vehicle-assets.mjs';
let count = 0;
await run({assert(ok, message) { count++; if (!ok) throw Error(message); }, note: console.log});
console.log({assertions: count});
JS
```

This CPU check cannot prove final game lighting, transparent sorting, visible door
apertures or laptop frame rate. Keep the rendered game checks and native source
previews distinct; the source preview is not an in-game screenshot.
