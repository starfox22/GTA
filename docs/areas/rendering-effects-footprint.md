# Effect billboard footprint

`src/fx3d-particles.js` trims only the provably transparent border of a smoke,
fire, glow or flash billboard. Its four vertices, two triangles, sorted single
instanced draw, full render resolution and existing depth/blend pipeline remain
the same. The particle store, recipes, live count, lifetime, delay, movement and
random stream are unchanged. Glass and blood/drop frames retain their original
square, as do sprites 16 pixels across or smaller.

This addresses fragment work when several vehicle wrecks and ground fires
overlap. A single instanced draw can still shade a large number of transparent
pixels. The old square covers considerably more area than the alpha-bearing
billows inside its atlas tile. The fragment shader also sampled scene depth
before discovering that an atlas texel had zero alpha.

## Conservative texture support

After the existing atlas bake completes, `fxBuildFootprints` scans the actual
atlas alpha and builds a four-level table of rectangles. It includes adjacent
atlas tiles and one-texel bilinear influence around each nonzero mip texel.
Each higher level also includes all lower levels, so trilinear interpolation
cannot expose a texel outside the rectangle. A further original atlas texel
protects numerical and rasterization boundaries.

The helper uses nonzero max pooling. Every ordinary averaged 2x2 mip texel
with nonzero alpha must lie in this support, including values a device might
round down to zero. The actual glass tile participates as a possible neighbor;
its own billboard is never trimmed. Bounds update the existing 32 `Vector4`
uniform values once. There is no fight-time texture rebuild or shader variant.

The vertex shader estimates a conservative upper mip from the original
particle's projected size, with a three-percent derivative margin. The lower
projection scale of the two screen axes bounds both orthographic and
perspective cameras. A streak increases only the billboard's second axis, so
the original size still bounds its strongest minification through any
rotation. The shader accounts for the streak's shifted center depth. If that
upper mip is outside the four proved levels, the original square is used.

World displacement and UVs use the same affine rectangle. The visible texture
keeps its original size and world placement, including its soft edges, tiny
flash spikes, additive core, ground fade and scene-depth intersections. The
existing per-corner point-light and sun-scatter approximations sample the
trimmed corners; their interpolated gradient can differ slightly. Fragment
lighting and additive flash energy are retained.

Immediately after the atlas texture sample, `t.a == 0.0` now discards the
fragment before its scene-depth sample and lighting calculations. Zero atlas
alpha contributes neither premultiplied coverage nor additive emission, so
this early rejection preserves the later discard's output semantics.

## Measured work and limits

The production-atlas host receipt measures the following reductions in
projected smoke-billboard rectangle area across its four smoke frames:

| Original sprite side | Rectangle area omitted |
| --- | --- |
| 32 pixels | 16.4–31.4% |
| 64 pixels | 33.6–36.9% |
| 128 pixels | 38.0–44.1% |
| 256 pixels | 41.0–46.5% |

These are geometry/fragment-work reductions, not hardware FPS measurements.
They precede screen clipping, depth tests, alpha rejection and overlap; they
do not mean that the same fraction of the final picture changes. There is no
new render target, composite pass, target resize or runtime quality switch.

`DeadEndCity.effectParticles().footprint` reports `ready`, `levels`,
`fullQuadPixels`, `trimmedQuadPixels` and `rasterShare`. Pixel totals estimate
unclipped projected billboard area for the current staged instances. A value
of 0.65 means that their trimmed rectangles cover about 65% of the original
square area. The estimate runs only when the report is requested. It is not
an occupied-screen-area measurement or a GPU timer.

## Verification

```sh
node tools/fx-footprint-host-check.mjs --out work/military-combat-review/fx-footprint/verification
```

The receipt is `fx-footprint-host-proof.json`: 808 assertions and 2,132,340
nonzero bilinear-support boxes checked. It enumerates complete support boxes,
including adjacent-tile influence, instead of relying on a sampling grid
that could miss a thin flash spike. It covers all eight tiles, all relevant
mips, 14 sprite sizes from 2–512 pixels and an adversarial completely opaque
glass neighbor. Glass/drop geometry remains the full square in both cases.

The host uses real Three.js and the production atlas bake, but has no canvas
for the glass glints. The deliberately opaque glass tile proves a stronger
neighbor-leakage case; it is not claimed as a native screenshot of glass.
The same check covers UV/world mapping through rotations and streaks,
unchanged live fields/randomness/lifetimes, one instanced draw, render-pass
state restoration and material/program identity across repeated draws.

Native shader compilation and multi-fire visual captures remain necessary
integration checks. The host proof establishes texture-support conservation
and reduced geometry area; it does not establish a hardware frame-rate gain.
