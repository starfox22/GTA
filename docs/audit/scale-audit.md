# Scale audit: people, vehicles, streets, furniture and the camera

Measured 2026-09-27 with `DeadEndCity.scaleReport(radius)` (built models measured from their
meshes), `cameraView()` and the source constants; 8 map units to the metre. "Body" widths are
the drawn body without mirrors (a car's collider `w` × 0.87, trucks × 0.91).

## People

| What | Game | Real | Verdict |
| --- | --- | --- | --- |
| Character rig at look height 1 | 1.75 m | 1.75 m (`PERSON_HEIGHT`) | ok |
| Player figure | 1.80 m (with shoes and hair) | 1.75-1.85 m | ok |
| Crowd statures (adults) | 1.60 / 1.73 avg / 1.90 m | 1.55-1.95 m | ok |

People were the right size; they read small because of the camera (below), not the scale.

## Civilian vehicles (spec length x body width; model height measured)

| Type | Game l x w (h) | Real reference | Verdict |
| --- | --- | --- | --- |
| sedan REGENT | 4.85 x 1.85 (1.47) | Camry 4.88 x 1.84 x 1.44 | ok |
| taxi CITY CAB | 4.90 x 1.85 | Crown Victoria 5.39 x 1.99 | short (a compact cab); left, collider |
| coupe VOLT COUPE | 4.40 x 1.80 (1.45) | Model 3 4.69 x 1.85 x 1.44; Polestar 2 4.61 | 5 % short; model rebuilt to real proportions |
| muscle DUKE V8 | 5.00 x 1.91 | Challenger 5.02 x 1.92 x 1.45 | ok |
| sport COMET GT | 4.50 x 1.85 | 911 4.52 x 1.85 x 1.30 | ok |
| roadster SOLSTICE | 4.20 x 1.78 (1.23) | Solstice 3.99 x 1.81; MX-5 3.92 | 5 % long; ok |
| rally KODIAK RS | 4.35 x 1.80 | Focus RS 4.39 x 1.82 | ok |
| hotrod HELLFIRE | 4.50 x 1.80 | '32 coupe ~4.0-4.3 | long for a '32, fine for a custom |
| supercar V12 TEMPEST | 4.70 x 2.00 (1.34) | 812 4.66 x 1.97 x 1.28 | ok |
| luxury MONARCH V12 | 5.30 x 1.95 | S-Class L 5.29 x 1.95 (Phantom 5.76) | ok |
| limousine SOVEREIGN | 8.80 x 2.00 | Town Car stretch 8.5-9.0 | ok |
| suv RANGER 4X4 | 4.95 x 1.95 | Range Rover 5.00 x 2.05 x 1.87 | ok |
| van MULE VAN | 5.25 x 2.00, roof 2.55 | Transit L2H3 5.53 x 2.06 x 2.7 | a little short; ok |
| pickup WORKHORSE | 5.60 x 1.94 | F-150 SuperCrew 5.89 x 2.03 | 5 % short; ok |
| chevette / brutini / cavalino | 4.69 x 2.02 / 4.94 x 2.10 / 4.53 x 1.94 | C8 Z06 / Aventador SVJ / 458 | exact |
| bike / bicycle | 2.10 x 0.80 / 1.85 x 0.62 | 2.1 / 1.8 | ok |
| truck / bus / ambulance | 10 x 2.55 / 12 x 2.55 / 6.7 x 2.28 | box truck / city bus / type III | ok |

Wheels: sedan r 0.335 (real 0.33), coupe 0.34 (0.335), SUV 0.41 (0.40), pickup 0.42 (0.42).
Spec lengths drive collisions, parking and AI, so the short taxi, van and pickup were left.

## Streets and buildings

| What | Game | Real | Verdict |
| --- | --- | --- | --- |
| Street carriageway | 88 u = 11 m (a 5.5 m lane + parking each way) | 10-12 m | ok |
| Avenue | 112 u = 14 m, four 3.5 m lanes | 3.0-3.7 m lanes | ok |
| Sidewalk | ~45 u = 5.6 m | 3-6 m downtown | ok |
| City block (lots) | 334 u = 41.8 m, 64 m centre to centre | 60-80 m | ok |
| Storey / shop floor / door | 3.2 / 4.5 / 2.3 m | 3.0-3.5 / 4-5 / 2.1-2.4 | ok |
| Buildings | median 12.5 m, p90 22.5 m, tallest 246.6 m | | ok |

## Street furniture

| Prop | Before | Now | Real |
| --- | --- | --- | --- |
| Street light | 9 m pole, 0.9 m arm | unchanged | 8-10 m, arm 1.5-2.5 m (short; its light pools belong to lighting) |
| Hydrant | 0.40 m wide x 0.70 m | 0.33 x 0.80 m | 0.3 x 0.75-0.9 m |
| Traffic cone | 0.75 m base x 0.75 m | 0.40 x 0.70 m | 0.36 x 0.70 m (was twice as wide) |
| Bollard | 0.35 m x 0.90 m | 0.28 x 0.90 m | 0.15-0.30 x 0.9-1.0 m |
| Litter bin | 0.65 x 0.80 m | unchanged | 0.55-0.65 x 0.9 m |
| News boxes / mailbox / meter | 0.44 x 1.1 / 0.5 x 1.3 / 0.15 x 1.3 m | unchanged | ok |
| Bench | 2.0 m, seat 0.45 m, back 0.92 m | unchanged | ok |
| Bus shelter | 3.75 x 1.1 x 2.5 m | unchanged | ok |
| Dumpster | 2.0 x 1.0 x 1.1 m | unchanged | ok |
| Street trees | 6.5-10 m (plane 8.75, oak 9.5, birch 10) | unchanged | 6-15 m (vegetation owns them) |

Collision footprints (damage-upkeep.js STREET_PROP_KINDS) were not touched; the new drawn
sizes sit inside them.

## Camera (1280 x 800)

| View | Before | Now |
| --- | --- | --- |
| On foot | zoom 1.6: 42.5 m of street on screen, a person ~21 px | zoom 2.5: 27 m, ~33 px |
| Car at rest | 1.6 | 1.4 (0.7 of the on-foot 2; was 1.75 until the comfort camera), eased in ~2 s on boarding |
| Motorbike / bicycle | 1.6 | 1.52 / 1.64 (was 1.9 / 2.05) |
| Bus, truck, tank, boats | 1.6 | 1.2 (was 1.5) |
| Aircraft (flight view framing) | 1.6 | 1.6 |
| Speed pull-back | from 60 km/h to 0.82 by 220 km/h | keeps widening on the eased speed: 1.31 at 50 km/h, 1.08 at 100, 0.92 at 150, 0.80 at 200 (was from 45 km/h to 0.82 by 205) |
| Wheel limits | 0.14-3.0 | 0.14-4.5 |

The street camera is orthographic, so the cutaway's hole through a building is the same in
world units at any zoom; a closer camera shows it larger, never misses it.
