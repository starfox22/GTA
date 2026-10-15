# Police marking review, 15 October 2026

Downloaded police lettering folded across otherwise flat doors because the runtime
projected its procedural section ring through sparse source vertex envelopes at
every longitudinal station. This was reproduced on the real shipped packs:

| Body | Adjacent stored section lower bounds, metres | Consequence |
| --- | --- | --- |
| Crown Vic | 0.293 → 0.829 → 0.293 | One straight door height jumps almost to the belt and back. |
| Charger | 0.230 → 0.861 → 0.229 | A 1 mm section height occurs at a door station. |
| Approved full-size SUV | 0.6468 → 1.6245 → 1.1117 | A roof-only bin controls writing on the door below it. |

These are converter measurement bins, not an actual sampled continuous body
surface. The old S2 frame also included the 1.66–1.73 m roof in its side height;
the central side shell sits below about 1.073 m. That pushed SHERIFF upward toward
the glass. The source model's art does not contain these generated words.

`police3d-cabins.js` now supplies an affine side painter for downloaded police
bodies. `police3d-asset.js` maps the shell through one measured model sill and
glass-belt interval, with a separate central cap blend away from exterior doors.
The painter and geometry therefore agree on a constant height scale across every
written side panel. Both sides read left to right from their exterior viewpoints.
The original curved frame remains the procedural fallback. Original liveries,
unit numbers, badges, equipment, damage/char materials, pools and gameplay are
preserved. This does not paint over or manufacture lettering in source artwork.

The affine mapping adds no geometry. The subsequent marked-S2 face-role repair
duplicates only 82 near / 64 far boundary vertices; it adds no triangles, meshes,
draw calls, shader variants or texture resolution. A shared police canvas remains 1024×512 RGBA8 (2 MiB base,
about 2.67 MiB with mipmaps), cached per body/livery/dimensions. The approved source
atlas/PBR coordinates and authored normals remain exact; near/far shells share
the projection, and source-backed moving doors inherit its attributes.

## Marked S2 source-skin ownership

Native R2 images showed readable SHERIFF lettering but exposed black triangular
tips across white doors and the rear quarter. These also existed before the affine
mapping. Actual production-builder rays reproduced the defect: 18 of an 88-point
written-door subset hit dark source trim instead of the painted shell.

The source body has narrow moulding strips about 10–12 mm outside its main skin.
Some large door triangles have their centroids behind those strips while their
upper and lower corners remain exposed. The converter's centroid-only first-hit
ownership test assigned those complete source door faces to dark trim. This is
source role classification, separate from the letter-projection distortion.

`policeApprovedSideBody` in `approved-suv3d.js` transfers the connected source
side-body UV island into the marked S2's existing painted-shell draw, after both
LOD levels are constructed. Every selected corner is within the audited body
side island and physical side bounds, with outward side winding; a retained-position
connection to existing painted skin excludes unrelated candidate fragments.
Independent original-source matching confirms that all 434 near transferred faces
belong to `SUV Body_Body_0` / `Body_7` and its 3,997-face main component. Detached
handles, rails, glass, wheels and the wheel-arch plastic are excluded. Four tiny
near candidate fragments at the rear upper corner are omitted; they are disconnected
inside this bounded candidate graph, rather than detached source components.

Only marked police kits using `s2_suv` run this transfer. Civilian and unmarked
S2 geometry and source packs are untouched. Existing trim-before-cabin index order
is retained and both `trimOuter` prefixes shrink by the moved face count, keeping
cabins out of distant impostors. All ordered source corner attributes and winding
remain identical at Float32 shader precision. S2 uses generic clipped doors;
this repair does not introduce native door-part metadata.

| Affected marked-S2 buffers | Near | Far |
| --- | ---: | ---: |
| Faces moved from trim to existing shell | 434 | 213 |
| Shell triangles, before → after | 538 → 972 | 295 → 508 |
| Exterior trim triangles, before → after | 2,759 → 2,325 | 1,515 → 1,302 |
| Shell + trim + cabin vertices, before → after | 5,223 → 5,305 | 2,333 → 2,397 |
| Additional boundary vertices | 82 | 64 |

Full source S2 totals remain 7,951 near / 4,354 far triangles. The
[ownership receipt](verification/police-s2-side-body-ownership.json) retains exact
selected packed face IDs, source hashes and counts. A standalone recorder,
`tools/sheriff-livery-render-review.mjs HTML OUT LABEL`, replays the original
three-car fixture and captures only the three sheriff follow-up images. It does
not alter or launch the concurrently running main recorder.

## Verification

[Independent before/after audit](verification/police-uv-before-after-audit.py)
evaluates both original `d75acc1` and current production UV functions against the
same packed Float32 positions. Its [measurements](verification/police-uv-before-after-measurements.json)
record the sample selection and exact function/pack/array hashes:

| Written side sample | Triangles | Folded/flat before → after | p95 vertical shear, pixels per horizontal pixel |
| --- | ---: | ---: | ---: |
| Crown Vic | 338 | 8 → 0 | 1.396 → 0.000019 |
| Charger | 462 | 9 → 0 | 2.030 → 0.000007 |
| S2 near | 320 | 0 → 0 | 0.481 → 0.000015 |
| S2 far | 182 | 4 → 0 | 0.488 → 0.000002 |

[Initial host receipt](verification/police-markings-host.json) records the affine
candidate's hashes and checks. The [final police/S2 host receipt](verification/police-s2-final-host.json)
selects the matching three modules from the root's final published 14-module
production-function run (18,062 assertions), with no browser or WebGL:

- `police-livery-projection.mjs`: 10,839 assertions. It checks finite atlas bounds,
  untouched source attributes and indices, actual painter orientation and sharing,
  and constant, unsheared UV gradients on 1,918 real door triangles. Bodies include
  Crown Vic, Charger, legacy SUV fallback and both approved S2 roles, near and far.
- `approved-suv-rigs.mjs`: 1,019 assertions (initially 856; 905 after side ownership), covering real production
  builders, LOD, shared pools, source-backed door openings, damage/char and repair.
  Added checks compare every ordered source corner attribute/winding before and
  after marked face transfer, verify both exterior impostor prefixes and confirm
  that 40 actual exterior door rays now hit livery-capable skin. The final 114
  added checks cover real number geometry, complete near/far roof clearance,
  100 rear-quarter glyph-cell rays and the non-S2 refusal case.
- `vehicle-source-fidelity.mjs`: 118 assertions against independent original-source
  position and normal samples.

Host geometry checks establish that panel tessellation no longer folds text;
native image acceptance remains a separate check. The actual native fixture uses
three `policeLineup` rows: `['police','crownvic','bw']`,
`['police','charger','modern']`, `['police','utility','sheriff']`, origin
(418, 6000), heading 0, spacing 110, lights off, seed 1, clear weather at 13:00.
Each receives High sides 0°/180° and Low side 0°, inspect pitch 9°, with a
740×500 native crop from a 1000×700 viewport. These are nine police images per build.

The R2 native captures use HTML SHA-256
`06b27514b0e368013a6fbdd80356e1c81f431849d4b382106b39c7dd595dd64f`.
They establish improved readable words and retain the dark S2 skin defect that
triggered this final follow-up. The final S2 ownership repair changes only
`src/approved-suv3d.js` and its call site in `src/police3d-asset.js`; the Crown Vic
and Charger paths and affine painter are unchanged from R2. Do not relabel those
R2 pictures as final S2 ownership evidence. Root owns the separately frozen final
build and three matching sheriff retakes; final acceptance is recorded below.
Tiny supporting slogans remain limited by screen size and the shared
canvas; texture resolution remains unchanged.

## S2 roof and rear-quarter unit anchors

The first final native sheriff retake showed clean white doors but jagged green
roof streaks and a small repeated 41 near the rear roof edge. These are generated
number decals intersecting source surfaces, rather than roof livery sampling:
the S2 shell has no faces above 1.59 m, and all 546 upper paint faces sample only
roof/pillar swatches, both white in the sheriff palette. The livery canvas does
not contain unit digits.

The generic asset anchors incorrectly emitted a sedan trunk number on the SUV's
rear roof and put its side numbers at 1.60217 m beside the glass. Its intended roof
number was a 1.12936 m-wide plane at 1.69823 m; the bowed roof crosses that plane,
and the number also intersects raised rails reaching 1.73323 m.

`policeApprovedDecalAnchors` now runs only on marked S2 kits, after side ownership
is repaired. It omits the unsupported trunk number, places both side unit numbers
in the measured sill/belt interval at 0.98137 m, and limits the aerial number to
0.800 m between source rails outside |z|=0.48 m. The roof anchor is 1.70496 m,
above the actual source roof. No source position, normal, UV, livery UV, index or
part ownership changes in this follow-up. Civilian/unmarked and legacy sedans
retain their existing anchors.

The [anchor receipt](verification/police-s2-decal-anchors.json) records actual
production anchors and the focused 1,019-assertion host result. Tests use the
real glyph builder with a documented font-metric fixture, rather than dummy
number geometry. Clipping every near/far source triangle to the whole aerial
number footprint proves 4.885 mm minimum clearance. One hundred rays over both
complete side glyph cells hit painted rear-quarter skin, with no glass, trim,
wheel void or clipping; plane-to-skin clearance is 34.1–65.6 mm on this curved
quarter. The initial lower side anchor was rejected because glyph bottoms
overlapped moulding. A non-S2 refusal check and existing full source-corner
checks preserve the scope and source fidelity.

For a two-digit unit, omitting the duplicate trunk number reduces the existing
glyph mesh from 16 to 12 triangles and 32 to 24 vertices. No new mesh, draw call,
texture, shader or source seam vertex is added. The source shell/trim budgets in
the preceding table are unchanged. The earlier sheriff retake predates this
anchor repair; use the matched final native receipt below for acceptance.

## Final native police acceptance

The final nine police images in `dist/review16/final-captures/after-images/`
come from frozen `dist/review16/final-runtime.html`, SHA-256
`719a535fe3905275c381737acb7fc3e80ee1ab4378c0d5736a4595096b16c03c`.
The main recorder is `tools/police-aircraft-render-review.mjs`, SHA-256
`e610ddc37b8231d65a876099e609d51b76213378b8ccc938c1b7c8e4d08f5108`.
All nine police captures pass the renderer, GPU-context and frame-fault checks;
the main report has 11 captured frames and zero recorded errors at this receipt.
The complete component pipeline and its final report remain root-owned. The
[police facts receipt](verification/police-native-final.json) preserves the exact
fixture, source report snapshot, image hashes and individual capture checks.

High sides 0°/180° and Low side 0° show readable SHERIFF, clean white door skin,
legible rear-quarter 41 numbers and one intended aerial 41. The unsupported rear
roof duplicate is gone. The approved final police subset retains the straight,
correctly oriented Crown Vic and Charger markings accepted in the earlier review.

Thin blue roof-edge strips are retained source detail, separate from the unit
digits. [Direct original-source proof](verification/police-s2-roof-border-source.json)
matches the visible surfaces to `SUV Body_Body_0` / `Body_7`, with source UVs on
the roof island's authored continuous dark border under the raised rails.
Across five longitudinal UV samples, interior source pixels are 29 grey while
the narrow border is 13–16 grey, with glossy ORM `[255,27,0]`. Its black gloss
reflects the blue sky in the native view. Adjacent raised rails sample the white
roof/pillar swatches. Main-body connectivity alone does not establish whether
a source detail should be painted; the earlier ownership-omission hypothesis was
rejected after this atlas comparison. No additional coating or source edit was
made for the retained border, and it contains no generated lettering.

| Final native PNG | SHA-256 |
| --- | --- |
| `police-crownvic-bw-high-side0.png` | `7fb9c853260b4b9bd3f1ae821cffc89527bd1d092b0b280a861c09353b4bb9a9` |
| `police-crownvic-bw-high-side180.png` | `dc9595b99655d9afe3da96cae148df427b061b3a8b70ba0e650da8b447bc30d0` |
| `police-crownvic-bw-low-side0.png` | `d8aea44ee0b75d57295fcb923be908f472c7af3c3b68e952c86d5b2a5ce592a3` |
| `police-charger-modern-high-side0.png` | `ea99fafca7ea4eb4f8c33d07821784fa563c82932749fccbd751c5ea6771c57a` |
| `police-charger-modern-high-side180.png` | `63ecc2250d76b7884dc7410ef1ff2468b357275018cb2e58fd8af600ddce559c` |
| `police-charger-modern-low-side0.png` | `e760c5d1cd0b715a8bd93bb7b8467cfb0d947492d7fc7fd5c42ecad496a9fedb` |
| `police-utility-sheriff-high-side0.png` | `dcb2135b9152cf5a022fa2238b9ccebc108bcf74aee883a3abf8d720d81a279c` |
| `police-utility-sheriff-high-side180.png` | `44ab5d6977620e6220ff21f8185b5f76dac757ebfaaa975c74a15ee09dec2f25` |
| `police-utility-sheriff-low-side0.png` | `033eb3ee9ff58b7fc4dccf064c84b2d0e43bd4800b690d61d0cd55fd9ea2c008` |
