# Native in-game before/after screenshots

These images are direct browser captures, copied byte for byte. Static pairs use the same
seed, placement, camera and native crop. The final sheriff inspection explicitly selects
the sheriff livery; its vehicle ID differs from the earlier random patrol fixture. The motorcycle crops are 520×520
and SUV crops are 660×460. The reports record actual camera fields and input hashes.

Asset names in the first column identify the approved replacements. Before shows the
previous in-game models (CB750, KTM and Suburban bodies), using the previous published runtime. Motorcycle and S3 after images
use candidate4. Corrected S1, S2 and sheriff portraits use candidate6, which includes
the source optical glass, exterior paint assignment and patrol palette fixes.

## Street / front inspection views

| Vehicle | Before | After |
| --- | --- | --- |
| M2 sport — VORTEX 900 | ![Before VORTEX 900](screenshots/moto-before-bike-street.png) | ![After M2 sport — VORTEX 900](screenshots/moto-after-bike-street.png) |
| M1 enduro — KR 500 | ![Before KR 500](screenshots/moto-before-kr500-street.png) | ![After M1 enduro — KR 500](screenshots/moto-after-kr500-street.png) |
| S1 Jimny — RANGER variant | ![Before RANGER, previous body](screenshots/suv-before-s1-jimny-front.png) | ![After S1 Jimny — RANGER variant](screenshots/suv-after-s1-jimny-front.png) |
| S2 four-door SUV — RANGER variant | ![Before RANGER, previous body](screenshots/suv-before-s2-suv-front.png) | ![After S2 four-door SUV — RANGER variant](screenshots/suv-after-s2-suv-front.png) |
| S3 two-door offroad — RANGER variant | ![Before RANGER, previous body](screenshots/suv-before-s3-offroad-front.png) | ![After S3 two-door offroad — RANGER variant](screenshots/suv-after-s3-offroad-front.png) |
| S2 sheriff utility | ![Before sheriff utility, previous body](screenshots/suv-before-sheriff-front.png) | ![After S2 sheriff utility](screenshots/suv-after-sheriff-front.png) |

## Motorcycle normal chase views

| Vehicle | Before | After |
| --- | --- | --- |
| M2 sport — VORTEX 900 | ![Before VORTEX 900](screenshots/moto-before-bike-chase.png) | ![After M2 sport — VORTEX 900](screenshots/moto-after-bike-chase.png) |
| M1 enduro — KR 500 | ![Before KR 500](screenshots/moto-before-kr500-chase.png) | ![After M1 enduro — KR 500](screenshots/moto-after-kr500-chase.png) |

## SUV rear inspection views

These use an oblique inspection camera. They are distinct from the normal chase camera.

| Vehicle | Before | After |
| --- | --- | --- |
| S1 Jimny — RANGER variant | ![Before RANGER, previous body](screenshots/suv-before-s1-jimny-rear.png) | ![After S1 Jimny — RANGER variant](screenshots/suv-after-s1-jimny-rear.png) |
| S2 four-door SUV — RANGER variant | ![Before RANGER, previous body](screenshots/suv-before-s2-suv-rear.png) | ![After S2 four-door SUV — RANGER variant](screenshots/suv-after-s2-suv-rear.png) |
| S3 two-door offroad — RANGER variant | ![Before RANGER, previous body](screenshots/suv-before-s3-offroad-rear.png) | ![After S3 two-door offroad — RANGER variant](screenshots/suv-after-s3-offroad-rear.png) |
| S2 sheriff utility | ![Before sheriff utility, previous body](screenshots/suv-before-sheriff-rear.png) | ![After S2 sheriff utility](screenshots/suv-after-sheriff-rear.png) |

Movement, puncture, fire and repair screenshots are behavioral checks rather than exact
pixel comparisons. See the [motorcycle review](motorcycle-review.md),
[motorcycle screenshot manifest](motorcycle-screenshot-manifest.json), and SUV receipts
for the full states, preset checks and limitations.

## Rendering defects found and fixed during integration

These are actual earlier failing captures, with corrected in-game views. They are
behavioral comparisons; the reports retain their different input hashes. The patrol
fixture also changed to an explicitly selected sheriff look, as recorded in the manifest.

| Defect | Before fix | After fix |
| --- | --- | --- |
| Jimny source glass incorrectly opaque over lamps | ![Opaque Jimny lens covers](screenshots/suv-bug-jimny-opaque-optics.png) | ![Restored source Jimny glass and reflectors](screenshots/suv-after-jimny-optics-day-front.png) |
| S2 exterior roof and upper doors classified as trim | ![Incorrect patrol exterior paint ownership](screenshots/suv-bug-patrol-exterior-trim.png) | ![Correct exterior paint and sheriff markings](screenshots/suv-after-sheriff-front.png) |
| Synthetic closed trunk lid covering repaired rear glass | ![Closed repair lid obscures rear window](screenshots/suv-bug-repair-closed-lid.png) | ![Candidate8 repaired rear window restored](screenshots/suv-after-sheriff-repaired.png) |

The final repair picture still contains ordinary fading shatter particles from the
preceding damage step; they are distinct from the repaired body and window geometry.
