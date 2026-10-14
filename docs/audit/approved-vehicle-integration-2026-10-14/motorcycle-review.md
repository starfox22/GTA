# Approved motorcycles: rendered review

Both approved motorcycles passed the captured candidate4 rendered review: M2 sport
replaces VORTEX 900 (`bike`), and M1 enduro replaces KR 500 (`kr500`). The browser
was closed after the run. The [after receipt](motorcycle-render-after.json) and
[log](motorcycle-render-after.log) retain the actual game state, damage, camera,
model, material and GPU reports. The [before receipt](motorcycle-render-before.json)
uses the previous published game, rather than a source-model studio render.

The [screenshot manifest](motorcycle-screenshot-manifest.json) records the hashes
and dimensions of 28 native screenshots: the two models in both versions, each
shown in street view, normal chase view, moving with steering input, punctured,
burnt and repaired, plus four full street contexts with the HUD/FPS display.
The images were copied byte for byte; the 520×520 comparisons use the same native
clip inside a 1000×700 viewport. No image was resized, edited or generated.

The four static before/after comparisons match the vehicle origin, heading,
stationary state, clock, seed, inspection/zoom and clip. Actual chase camera
position, pivot, yaw, pitch and field of view match exactly. The initial camera
setup resets the first requested 72° look offset, so these chase hero captures
show the normal rear view at yaw0°/pitch15°. Later movement/damage captures show
the 72° side view. Street mode's stored chase pose is stale; the manifest instead
compares the active street settings and staged vehicle. Movement/damage images
verify behavior, rather than exact pixel matching: the after run additionally
draws the tier checks and new geometry changes which real side shots hit tyres.

All **20 quality/camera cases passed**: LOW, MEDIUM, HIGH, ULTRA and AUTO in
street and chase view for both motorcycles. The recorder waited for both actual
approved atlases to load at 2048px for LOW/MEDIUM (also AUTO selecting LOW here),
and 4096px for HIGH/ULTRA, then drew with that resolution before accepting each
case. There were **zero JavaScript, shader/GL errors, frame faults or context
losses**. The one console warning is the existing Three.js script deprecation.
These software-rendered cloud checks are not laptop or M4 Max FPS benchmarks.

Actual driving/steering reached 7km/h, seeded side shots punctured tyres, source
atlas char shaders rendered both burnt models, and repair restored full health
and tyre visibility. Sport draw counts changed 12→10→12 and enduro 11→9→11 when
intact, burnt and repaired. The [motorcycle host receipt](motorcycle-host.json)
records **561 passing assertions**, including legacy compatibility, measured
source axles, signed roll, rider IK, independent instances, source UV attributes,
LOD tier behavior, broken-light halo masks, damage and repair. The player's
source detail stays near; ordinary overhead NPCs use the offline far geometry.

Near/far source budgets are 12,350/2,707 triangles for M1 and 50,795/12,820 for M2.
Measured grips and front driver saddles fit the actual scaled 1.8m and 1.9m
riders with zero wrist gap through the fixture's steering range. The 1.65m
fixture retains natural bone-length limits; its maximum wrist gap is 1.52cm
under an intentionally stronger ±0.46rad steering request. M1's tiny source peg
anchors remain approximate, as documented in the conversion metadata.

Captured candidate4 runtime JavaScript SHA-256 is
`711ae993349e465c4dcc6940d7a2d411fe317cf52ab6757e21a5f943f852a151`;
the standalone capture HTML SHA-256 is
`2e8fa954b875d3b0b15d9c7d4bc68c87f856266a7c11899d73689cc7ab17b813`.
Published candidate8 includes the later SUV palette, pool-report, optics,
exterior and lid corrections, plus helicopter-gun aiming corrections. All 302
M1/M2 packed arrays match the captured candidate4 models. This archive retains
the actual candidate4 capture hashes; the final package has its own receipt.
The source and recorder hashes are in the manifest. The earlier before recorder
did not log its own source hash; the archived baseline HTML hash, fixture,
observed camera reports, log and native screenshots preserve its evidence.
An unsuccessful candidate3 capture attempt remains separately under
`verification/motorcycle-candidate3-capture-timeout/`; its timeout is not a
passing result and none of its images are in the final screenshot manifest.

To repeat the final rendered check from the cloud environment:

```sh
source /workspace/setup/GTA-env.sh
node tools/approved-motorcycle-render-review.mjs \
  dist/review-approved-vehicles-2026-10-14-candidate4.html \
  dist/approved-moto-review after --tiers
```

Use the recorded immutable candidate, or rebuild and record the new input hash
when continuing development. These assets improve two selected vehicles; the
results do not establish AAA or production readiness for the whole game.
