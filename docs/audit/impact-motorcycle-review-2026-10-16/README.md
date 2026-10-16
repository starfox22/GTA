# Vehicle impacts and motorcycles — 16 October 2026

This pass continues the permanent `codex-reviews` branch. The owner requested more convincing vehicle strikes for the player and pedestrians, a fix for walking beside cars, a downloaded Dolcati replacement, a Japanese inline-four sound for the sport motorcycle, graphics defaults, its KUZUKI 600R name, and improved Up/Down wheelie controls.

Published [playable game](https://starfox22.github.io/GTA/?review=871f214e44785d89) and [native screenshot/sound gallery](https://starfox22.github.io/GTA/review/). [Deployment 38911041748](https://github.com/starfox22/GTA/actions/runs/38911041748) from `321b8de6` succeeded, including exact public SHA-256 verification of all 121 files (173,923,210 bytes). [Success receipt](verification/successful-deployment.json) retains actual job/step status. Later receipt/documentation commits leave the game and gallery bytes identical.

## Changes

- Bumper contacts now launch player and NPC bodies into the same gravity-driven flight, with speed/frontage/edge-dependent momentum, tumble, ground bounce and sliding. Survivors blend through getting up. Fatal impacts retain body motion and leave a pool only after landing. Vehicle-hit deaths wait for their slowed fall/slide before hospital return, with a 16-second fallback; ordinary deaths retain 4.2 seconds. Harmless walking-speed nudges and separate repeat run-overs retain their contracts.
- People already overlapping a vehicle’s padded footprint can move out or along it. Walking into a clear car, deeper into one, into a second car or through a wall remains blocked.
- The Dolcati V4 uses ROY’s CC BY 4.0 Panigale source. Source close geometry, textures and normals are retained, with shared near/far geometry and fitted steering, wheel centres, saddle, grips and pegs. The existing vehicle and approved motorcycle packs are preserved.
- KUZUKI 600R replaces the VORTEX 900 display name. Its `bike` identity stays compatible with existing traffic and saves. Its sound uses real CC0 Kawasaki ZX6R idle and Suzuki inline-four exhaust recordings, six ratios, shift unloading, engine braking and a high-rev limiter.
- Wheelies retain throttle plus Up to lift, and Down reliably cuts drive and uses rear braking even while throttle is held. Brake grip, front load/lock/lateral force, skid marks and spray follow actual front contact. Rear-axle pivots account for banking and terrain; the fork settles consistently across simulation rates.
- Motion blur is disabled and removed from Graphics. Player outline and ring default to off; explicit saved outline/ring choices are preserved.

## Sound source and reproduction

[Sound audit](../2026-10-16-sportbike-audio.md) records pinned sources, licensing, conversion, behavior and checks. The 24-second sample is an offline render of the shipped engine graph and actual OGG bank, including idle, six gears, limiter, overrun and mute. It excludes global mix processing, radio, ambience and cabin acoustics. It is not a recording of gameplay or an exact GSX-R600 recording. The high loop retains mild coloration from its credited mirror.

## Screenshot evidence

Before model images use the frozen game from `7f45832a`. Native PNGs are cropped original game viewport pixels, with matched inspection cameras, High graphics, clear weather, 13:00 and held simulation. Final runtime images show their recorded flight/wheelie/settings states. No source previews or generated images are presented as game screenshots.

The capture receipts retain exact HTML and recorder hashes, fixture parameters, game state, model identity, GPU state and frame faults. `verification/before-recorder.mjs` is the exact earlier recorder snapshot, retained to match its receipt; the current executable tool is `tools/impact-motorcycle-render-review.mjs`.

## Verification inputs

The final game is frozen from `9cdfb304`, SHA-256 `4fb728805903abdb8a6afe04c258fdb1c2d7e21274814d9e7cb44d26fbb45d08`. Later test-fixture corrections and documentation build byte-identically. The split entry point is `871f214e44785d89a19e530f16ae91cdbc44b401c65caab6acd4ec93d8e58fa0`. The disjoint broad suite uses `9db35c35`; the final source adds only the bounded fatal-impact respawn, checked separately with actual solver/timer cases and focused release tests. Receipts are under [verification](verification/).

- The eight final native captures passed with zero captured console errors, GL losses or frame faults. They verify the actual imported `dolcati_roy` model, a player and NPC airborne after 65 km/h strikes, the KUZUKI wheelie at 18.9°/60 km/h, and Graphics with motion blur absent and outline/ring off despite a legacy saved blur setting.
- The fatal-impact respawn and existing death/arrest focus paths passed 138 host assertions. Actual wet-road trajectories at 70/110/150 km/h settle after 7.84/11.21/13.55 wall seconds under 35% slow motion and return after 7.9/11.3/13.6. Stalled flight returns at 16 seconds; ordinary death stays at 4.2 seconds. Stale callbacks preserve a later death and canceled scenes clean up WASTED.
- The production sound graph and native browser decode checks passed. The offline sample and exact source/buffer hashes are retained with their receipts.
- Media-pack tests passed 183 assertions, cache tests passed 23, and the oversized model reconstructed byte-for-byte from bounded classic-script chunks. All 14 packs are at most 12,000,000 bytes including their wrappers.
- Local project-subpath verification passed all 121 publication files (173,923,210 bytes), including both galleries and preserved prior image URLs. Gallery asset links resolve and native screenshot digests match their capture receipts.

## Regression results

The disjoint 239-module broad run retained **214 PASS / 18 renderer-only SKIP / 7 FAIL**. Final-source focused checks retained **16 PASS / 1 FAIL** across 17 distinct modules. Combining corrected final results gives **220 PASS / 18 SKIP / 2 known failures** across 240 modules, including the new respawn regression. This is a qualified result, not a one-shot green suite. Exact inputs, original/focused logs and per-module outcomes are in [regression-results.json](verification/regression-results.json).

Four test setups were corrected without lowering assertions: cloud flight restores cloudy weather; the isolated terrain VM loads production controls; blood-stain contacts clear unrelated traffic; the cocktail test observes a quiet sip after dialogue. A production-code phase sweep shows the old cocktail window fails 252/850 phases and the quiet window 0/850. Its archived VM reproduction can be run from the repository root and writes its report to `work/`. The unchanged garage test passed its release rerun.

Two failures remain explicit. The existing Mount Ascent pilot repeats its prior 76.88 s miss of the unchanged 75 s target. The original pedestrian-awareness rate assertion also fails the previous published `7f45832a` build: 0.4 cleared versus 0.5 in the current original test, against 0.6 required. Its live-world RNG, actor indices and update cadence prevent a clean statistical comparison. A population-isolation experiment did not stabilize it and was reverted; both builds and that experiment are retained in the baseline receipts. Perception/dodge/contact source was not changed to tune the rates. See [baseline comparison](verification/baseline-pedestrian-results.json).

The split release passed native smoke with real keys: 16 units walking, 24 driving, map, both cameras, [six native PNGs](verification/packaged-smoke/) and zero errors (one existing Three.js deprecation warning). All nine streamed tracks reached `canplay`. Final native captures use the exact release HTML, actual downloaded model and unchanged PNG bytes.

## Limits

These changes improve this browser game’s existing physics and procedural animation system. Software WebGL checks do not establish hardware FPS on an M4 Max or AAA production readiness. The close Dolcati is a large hero mesh (372,664 source triangles); distant traffic uses a 25,717-triangle version. Model-specific source and conversion evidence are documented with the import. Native High → Low → High checks retain the actual player model and show zero GL/frame faults (the tier receipt identifies its earlier integrated source build).
