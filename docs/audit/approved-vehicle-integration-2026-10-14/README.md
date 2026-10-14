# Approved replacement vehicle integration

The owner approved **M1, M2, S1, S2 and S3** from the
[free-asset shortlist](../vehicle-asset-shortlist-2026-10-14/README.md).
Work continues on `codex/chase-clouds-polish-2026-10-12`; main is not changed.

See the [native before/after gallery](screenshots.md) for all five approved assets and
the sheriff variant, and the [motorcycle rendered review](motorcycle-review.md) for
camera, graphics-tier, damage and repair evidence.

## Changes

- VORTEX 900 (`bike`) uses M2 sport geometry; KR 500 (`kr500`) uses M1 enduro geometry.
  The cruiser and bicycle retain their distinct models. Source rolling axles, steering
  assemblies and rider contacts drive the existing animation, damage and repair systems.
- Civilian RANGER (`suv`) uses all three SUV styles, selected by stable vehicle ID.
  Collision length, width and height match the actual body without per-frame allocation
  or consuming random numbers. Existing drivetrain and handling parameters remain.
- Patrol utility/Tahoe bodies use the four-door S2 with sheriff or unmarked equipment.
  Source UVs remain independent of projected livery. Front steering and signed wheel
  roll follow physics, including reverse, brake lock and driven-axle spin.
- A separate five-model pack preserves the original 23-model binary and atlas byte for
  byte. Near/far LODs share geometry across repeated spawns. The player keeps near detail;
  damaged SUVs restore near geometry before applying deformation.
- Shared albedo and roughness/metallic atlases retain source texture detail and repetition.
  Low/Medium use 2048px atlases; High/Ultra use 4096px atlases. Tier changes replace GPU
  texture images instead of keeping duplicate live texture objects.
- Wear, fire, repair and respray retain approved maps and livery through bounded char
  material pools. Production credits are embedded in the standalone playable HTML.
- Jimny lamp covers preserve the source transparent glass and original reflectors.
  The four-door SUV roof and upper doors are correctly assigned to exterior paint,
  preserving sheriff markings and damage. A repaired closed trunk hides its synthetic
  moving lid, which previously obscured the rear window.
- Helicopter side guns aim from their physical mounts to the actual ground target.
  This removes close-target parallax while preserving traverse stops and slew speed;
  the barrels and bullets use the same aim state.

## Provenance and repeatability

The shortlist records download URLs, inspected licence evidence and source hashes.
M1/M2 have explicit model-specific CC BY 4.0 repository credits; S1/S2/S3 embed their
CC BY 4.0 creator records in the GLBs. Original marketplace pages were blocked here.
No unrelated NC assets or unverified 1989 Suburban model were imported.

The [fresh conversion recipe](conversion/README.md) lists every pinned input, dependency
and command, including the Draco decode step for the Jimny. The preparation helper
assembles the enduro prefab from its source transforms. Runtime builders do not fit
axles, reduce meshes or allocate vehicle specs each frame. See the
[motorcycle contracts](../../areas/vehicles-and-driving-models-motorcycles.md) and
[SUV contracts](../../areas/vehicles-and-driving-models-approved-suvs.md) for the rigs,
material attributes and named inspection methods.

The converted pack contains the following close/far triangle budgets, before runtime
visibility choices. Reduction is performed offline; source textures retain their
original tile resolution in the 4096px atlas.

| Approved source | Game role | Close triangles | Far triangles |
| --- | --- | ---: | ---: |
| M1 enduro | KR 500 | 12,350 | 2,707 |
| M2 sport | VORTEX 900 | 50,795 | 12,820 |
| S1 Jimny | Civilian RANGER variant | 65,000 | 10,043 |
| S2 four-door SUV | Civilian RANGER, sheriff utility/Tahoe | 7,948 | 4,354 |
| S3 two-door offroad | Civilian RANGER variant | 6,502 | 3,563 |

Other corrections found during integration include missing default vertex colours,
source tyre metalness, resizing immutable WebGL2 textures, repeat UVs crossing atlas
tiles, lost road wear, source attributes on shaped door cuts, char pooling before the
legacy material set exists, far-first SUV body-pool creation, the patrol paint palette,
and reports of the actual drawn instance count after the frame. Regression fixtures
load their new production dependencies; camera movement samples hold simulation to
avoid extra live frames between RPC snapshots without relaxing their assertions.

## Validation and limits

Final candidate8 runtime JavaScript SHA-256 is
`d5ca3c913a71d9a4295bd73f6a0d0a0646c2b985e559de1cf6442ac48cabb574`;
standalone HTML SHA-256 is
`5b199b249eeb301af2722c21e84470c6b20902ff0976d17c3e439be1ab3e58da`.
The [host receipt](host-regression.json) records **3,105 assertions across 10 modules**.
The [package receipt](verification/package.json) verifies ZIP CRC, all approved assets,
embedded credits, runtime agreement, and nine unchanged canplay-tested radio tracks.
The [cumulative gameplay receipt](verification/gameplay-cumulative.json) records
**196 passed / 18 expected no-WebGL skips / 0 failures across 214 modules**.
This combines the initial/resumed suite with affected follow-ups; it is not a single
final-candidate full-suite rerun. Original failures and the exact corrections remain
in the archive. All staged mission 1–4 route/state checks pass. The corrected model pack SHA-256 is
`9fc2408fd1f8b7b2649a4e69d6868854c22987856ef6868e0f8d0c3b51d28512`.
Conversion accounts for every one of 887,191 source faces exactly once; 1,483 pack
integrity assertions and 150 canonical source/LOD/axle assertions pass. Every visible
source albedo/alpha and roughness/metallic texel is checked independently.

The motorcycle rendered run passes all 20 model/preset/camera cases. The SUV run passes
all 10 preset/camera cases, Jimny daytime/nighttime optics, actual instanced drawing,
and fitted sheriff equipment and driver checks. Both runs report zero JavaScript,
shader, frame or context errors. These use Chromium with software WebGL; the reports
retain actual atlas sizes and resource counts. They establish functional rendering,
not hardware FPS or memory benchmarks. The [final packaged smoke](verification/final8-smoke/smoke.json)
passes real-key walking and driving, map opening, both camera switches and visible
default FPS, with six native screenshots and zero console errors.

Before captures use the previous published runtime, standalone SHA-256
`ccf195e35e4ae7b87d09133c317abcb1b54ddb2d3f3e9d30acb5923b6daeee92`.
Motorcycle and S3 after portraits use candidate4, standalone SHA-256
`2e8fa954b875d3b0b15d9c7d4bc68c87f856266a7c11899d73689cc7ab17b813`.
The refreshed S1/S2/sheriff portraits and final SUV tier checks use candidate6,
standalone SHA-256 `6f8ec191f8b2d8d0ceb98ba28c116d05071d52741086a96e84cc4da183bc710e`.
The [candidate8 repair-only follow-up](suv-render-candidate8-repair.json) confirms the
rear window restored after fire and repair, with zero renderer/frame/context faults.
Later fixes are covered by targeted follow-ups rather than relabelling earlier images.
M1/M2's 302 geometry/material arrays remain identical to candidate4. S3's only pack
changes are four unused window atlas/UV arrays; positions, normals and indices match.
Source-model studio previews are not in-game evidence. Original failures are retained
alongside the passing follow-ups, including [actual graphical bugs](suv-graphical-bugs.json).

These approved assets improve the selected vehicles; they do not establish AAA or
production readiness for the whole game. S2/S3 remain modest-detail source models.
Four continuous normal-input mission wins and M4 Max/laptop GPU frame rates remain
unverified. The existing chatgpt.site website cannot be updated with this session's
tools; the branch workflow publishes the downloadable playable ZIP.
