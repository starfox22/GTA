# Motorcycle rendered review

Actual WebGL captures ran against frozen main **9b2a5633…** and final ready
**b8d87130…**. Both matching 18-stage runs passed with zero console errors,
frame faults and WebGL losses. The complete per-model reports are
`motorcycle-render-before.json` and `motorcycle-render-after.json`; exact input
hashes and the portable tools are recorded in `motorcycle-capture-inputs.json`.

`tools/motorcycle-render-review.mjs` uses named developer methods only: seed 1
boot, held simulation, high preset, clear weather, 13:00, airport position
(680, 4520), heading zero, street inspection (18°, 10°, lift 6), closeUp 12. Each
VORTEX 900, NOMAD CRUISER and KR 500 is captured at rest, rolling at about 7 km/h,
steered, after two actual right-side shots, burnt and repaired. The same explicit
simulation steps run on both inputs. Normal 6500 ms notice settling and a named
settings refresh precede captures. The native viewport is 1000×700; hero crops
are **x280, y140, width400, height410**, chosen to include the complete rider
and both wheels while excluding HUD panels. Full bike context remains in
`dist/review13-moto`, including the FPS overlay.

| Production observation | Before | After |
| --- | --- | --- |
| CB750-based VORTEX 900 rider | Hands hover at mirror height | Hands meet measured bar grips |
| NOMAD CRUISER rider | Arms reach backwards over the pillion | Arms reach forwards to measured grips |
| Two real side shots: VORTEX 900 | No puncture | Body hits; no puncture |
| Two real side shots: NOMAD CRUISER | No puncture | Body hits; no puncture |
| Two real side shots: KR 500 | No puncture | Only `frontRight` punctured; front tyre lowers/squashes |
| All three burnt→repair transitions | Reports repaired; rubber remains hidden, 9 model draws | Rubber restored, 11 model draws |

`seedRandom` controls `Math.random`, but bullet-height scatter uses the separate
map `seededRandom` stream. Two shots therefore cannot guarantee a tyre puncture;
the table follows the recorded flags, not visual assumptions. The forty-shot
chase-view supplement uses `tools/motorcycle-puncture-render-review.mjs` with the
same fresh VORTEX 900 fixture, orbit heading 72°/pitch 18°, and native 600×530
crop on both inputs. It passed: baseline flags `[]`; final flags
`[frontRight,rearRight]`. Both wheels visibly deflate in the final crop, and both
runs have zero console errors, frame faults and WebGL losses. The actual damage,
camera and model receipts accompany the supplemental screenshots. This QA crop
retains part of the normal mission card below the bike; it does not cover either tyre.

Ten selected PNGs are in `screenshots/moto-{before,after}-*.png`. Their pairs show
CB750 bar contact, cruiser bar contact, VORTEX 900 rubber restoration, KR 500
front-only gunshot puncture and KR 500 rolling. Every selected image was visually
inspected. The enlarged grey patch in the street inspection's shot stage is a
deliberate street-view bullet decal; chase decals use a smaller physical scale.
Inspection zoom 12 exceeds the player's street zoom limit 4.5, so that patch does
not represent normal chase-view decal size.

The supplemental pair is `screenshots/moto-{before,after}-puncture-chase.png`;
both were also visually inspected. Full contexts and all unselected raw captures
remain in ignored `dist/review13-moto` and `dist/review13-moto-puncture`.

The axle/flat-tyre production host proof passed 70 assertions; actual bullet-entry
and handling proof passed 121. Cached geometry preserves the rest mesh and
normals, removes the measured cruiser/KR 500 lateral wobble across 48 spin phases,
and adds no draws. M4 partition proof separately passed 31,289 mesh assertions.
These are correctness checks and real software-WebGL captures; they do not
measure laptop/GPU FPS or establish AAA/production certification.
