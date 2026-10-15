# Baseline compact-SUV rollover — contact normal correction

The immutable d75acc1 baseline sweep failed `falls`: the compact civilian SUV overturned on Mount Ascent with full HP. This was a real physics event. `cliffRest` can choose roof/side after a gentle landing while damage remains zero below 5 m/s. A fresh vehicle and held simulation rule out a stale overturned flag or an external frame interrupting the synchronous descent.

The test could select different SUV bodies because the three approved civilian dimensions use `id % 3`. Old WASTED callbacks can also run between console calls while simulation is held and only check the current dead state; occurrence in the failed run was not established. Neither the ID selection nor the test/pilot was changed.

A CPU fixture using the actual baseline terrain, controlVehicle, tyres/brakes/steering, offroadDrive, suspension and cliff functions reproduced the failure. It uses drivePath at 30 Hz and four 120 Hz vehicle substeps. At pilot 28 km/h, style 0 left the ground at 11.425 s near (7710.36,1184.78), at 34.85 km/h, with roll rate 6.77 rad/s; it landed on its roof undamaged and stalled at progress .163. The launch was only .75 map units (9.4 cm) from the graded trail centre, within its 21-unit half-width, in the authored .83–.88 steep section. Style 0 also tipped onto its side at pilot 20 km/h (actual maximum 26). This was not the pilot driving onto a bank.

`rideTyreGround` added the authored rock relief to contact height but retained the underlying terrain triangle's gradient. Spring and axle reactions therefore used the downhill plane's normal when a tyre struck a boulder. The reaction launched the chassis instead of scrubbing the speed into the rock. The correction adds the relief gradient from centred 0.5-unit samples (6.25 cm) to that same contact normal. Genuine flight, damage, rollover and braking rules remain.

Only the highest of the tyre's three rounded contact samples supports the wheel. The final implementation retains that winner and computes four relief-gradient samples once. This makes seven relief queries on a rocky contact (three heights plus four gradient samples), and retains the original three queries where relief is zero. It allocates no contact record. Against the initial correct implementation that calculated every candidate's gradient, 4,206 actual-terrain/headings/radii queries and all nine descent runs had numerically identical results.

| Pilot limit | Compact SUV before | All three SUV styles after |
| --- | --- | --- |
| 15 km/h | No flight/overturn | No flights, damage or overturn; progress .291–.293 |
| 20 km/h | Side, full HP, stuck at .157 | No flights, damage or overturn; progress .337–.339 |
| 28 km/h | Roof, full HP, stuck at .163 | No flights, damage or overturn; progress .396–.399 |

The unchanged controls were numerically identical before/after: a 60 m cliff drop still wrecks and overturns a sedan; a sedan and motorbike driven down an ordinary graded road retain the same exact positions, HP and progress, with no flight. The host excludes generated scenery, other actors and static contacts; the original live `falls` regression is verified separately below. No browser/GPU was used for this CPU investigation.

`terrain-rock-contact` passed 18 assertions on fresh generated terrain: analytic sum of terrain/rock slopes, caller-record reuse, seven/three-query bounds, all nine SUV descents and retained cliff/road/motorbike controls. `terrain-rock-contact-before-after.json` retains the telemetry, source hashes and optimization equivalence receipt; `terrain-rock-contact-host.log` records that run.

The CPU benchmark warms all contexts and rotates their order over nine measured batches of 3,000 actual `rideTyreGround` calls, using `process.threadCpuUsage` to exclude scheduler waits. These host query costs are not a frame-rate measurement:

| Query workload | Baseline median | Correct, before optimization | Final winner-only normal |
| --- | ---: | ---: | ---: |
| Rock probe | 13.50 µs | 49.85 µs | 24.52 µs |
| No-relief probe | 6.68 µs | 7.19 µs | 7.24 µs |
| Points across the whole trail | 8.79 µs | 11.98 µs | 9.08 µs |

The final rock query is about half the initial corrected query's CPU cost. Its added cost against the faulty baseline is about 11 µs at the measured rock probe; the full-trail mixture adds about .3 µs/query. Ordinary ground retains three relief-height checks and makes no gradient samples. Timing ranges and every sample are retained in `terrain-contact-cpu.json`; `terrain-contact-benchmark.mjs` reproduces the comparison against an immutable baseline checkout/archive and optional initial-correction source snapshot.

## Live-game regression

The final focused suite finished **15/16 passed, zero skipped, one failed** in 882 s. The sole failure is `hillclimb-physics`; [the original log](verification/final-focused-suite.log) retains it. This result is not a complete regression-suite pass.

The unchanged `falls` test passed in 76.0 seconds on frozen game SHA-256 `719a535fe3905275c381737acb7fc3e80ee1ab4378c0d5736a4595096b16c03c`, through the no-render production game. The trail SUV remains intact; the deliberately driven cliff drop still destroys and overturns the sedan and kills the player. The final focused log retains the original assertions and telemetry. Native before/after trail outcome images are recorded separately in the gallery capture receipts.

That focused run failed `hillclimb-physics`: the crawler reached the summit cleanly at 60 Hz in 76.88 s, exceeding the unchanged 75 s challenge. The 30 Hz climb passed in 72.97 s. The 60 Hz run passed its preceding health, rollover, flight and suspension limits; the later descent and stationary-load checks were not reached after the time assertion failed. An archived baseline recheck recorded 74.92 s at 60 Hz, leaving only 0.08 s margin. The pilot steps production updates synchronously while simulation is held, so this result must not be dismissed as browser key timing or reported as a complete hill-climb pass.

A bounded follow-up used the same immutable game in one held, seeded no-render instance, through ordinary named `drive`, `hillClimb` and `trailDrive` calls. A fresh 60 Hz crawler took 77.23 s and struck a bank: its worst blow was at (7388,1242), 47.54 map units (5.94 m) from the generated trail centreline, beyond the 21-unit carriageway half-width and the turning pad. Its 6.14 m/s upward speed and 5.42 m/s bump-stop blow also exceed the regression limits. A fresh 30 Hz run reproduced 72.97 s; the following reused-vehicle 60 Hz run took 75.62 s with acceptable suspension telemetry. Thus retained vehicle state changes the trajectory, but is not the sole explanation. These results expose a console pilot that can leave the graded route, rather than establishing an invalid rock normal or a general player-driven climb limit. No engine, challenge time, test assertion or production pilot was changed to force a pass.

The separately executed original descent and rest assertions passed on that same game: 73.7 s to the trailhead, zero flights/air time, a maximum 1.03 m/s bump-stop blow, then stable pitch/roll and 1 g stationary load. The [fresh/reused runs](verification/hillclimb-original-runtime.json) and [descent/rest result](verification/hillclimb-original-descent-rest.json) retain the named-call output. The full `hillclimb-physics` test remains failed; its challenge-time and route-following limitation is unresolved.

A separate immutable candidate (`80f7b408cce5dd3c711210ad11f917841e43f0cb4fd3d712588bb75d28388dc4`) tested the proposed geometric index correction, changing only `next <= here + 2` to `next <= here` and adding local, read-only route telemetry. The unchanged 30 Hz hill-climb test failed: the crawler became stuck at progress .694 after 78.2 s, with one cliff flight and an overturn. Its centre spent 13.57 s outside the authored carriageway/turn-pad union, reaching 6.696 m beyond that corridor. The attempt was rejected, the entire pilot file was restored byte-for-byte, and no challenge time, vehicle tuning or assertion was changed. The [result](verification/hillclimb-index-runtime.json), [raw log](verification/hillclimb-index-runtime.log) and [rejected patch](verification/hillclimb-index-rejected.patch) retain the failure. This comparison does not justify keeping the strict-index change or claiming the pilot regression fixed.

The [follow-up receipt](verification/hillclimb-followup-receipt.json) records the unchanged game/test hashes, restored pilot hash and executed harnesses. The rejected candidate is **not published**. Further controller work is tracked in [BACKLOG](../../BACKLOG.md); the correct rock-normal change and original 75 s timer remain.
