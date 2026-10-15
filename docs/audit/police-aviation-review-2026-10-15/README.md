# Police, aviation and hot rod review — 15 October 2026

Development continues on the permanent GitHub branch **`codex-reviews`**. The
comparison baseline is `d75acc1ebc3c56a6c62434512d72d2fde632200d`; main was
`bde9ee4c7f295b096fe71f6924b84d491a56a86e` and is not an output of this review.
The browser game remains **https://starfox22.github.io/GTA/**. The screenshot and
sound gallery is **https://starfox22.github.io/GTA/review/**.

## Changes

1. **Police markings:** removed the downloaded-body UV folds that stretched and
   scrambled POLICE/SHERIFF across door panels. Both exterior sides use the same
   measured sill-to-belt projection. Completed the S2's exterior paint ownership
   to remove dark triangular gaps in white doors. Shared 1024×512 canvases, face
   counts, source shading and draw budgets remain; cached shell/trim seams add
   82 near and 64 far vertices.
2. **Aircraft audio:** C172 piston/two-blade propeller, courier turbine/four-blade
   propeller, business-jet turbofan and larger airliner turbofan profiles. Engine
   load follows spooled power; exterior sound includes height, occlusion,
   camera-relative pan and relative-motion Doppler. At most four fixed-wing
   voices reuse their nodes through the existing volume/mute chain.
3. **Visible propellers:** RPM now comes from the audio's shared physical RPM
   rule, with blade-count-aware blur and smooth acceleration/coast-down.
4. **Flight and boarding:** gentler Cessna rotation prevents the reproduced
   immediate post-liftoff stall; piston power limits excessive high-speed thrust.
   Model-specific taxi steering keeps larger planes maneuverable. Larger planes
   can be boarded from outside their wing collision box. Courier/airliner
   collision envelopes contain their actual drawn geometry.
5. **Parking and airport collision:** seven existing flyable planes face clear
   taxi connections toward runway thresholds. Painted apron spurs show the
   routes. Static transports have measured compound wing/tail/gear/fuselage
   bounds instead of only narrow fuselage boxes.
6. **Downloaded jets:** a licensed Citation exterior replaces the flyable
   business jet; a licensed 737 replaces the three terminal scenery jets. Near
   source geometry is retained; distant LODs and material sharing bound cost.
   The flyable airliner and courier keep their procedural models. The Citation
   export has a native 256px exterior texture and painted windows, without a
   cabin or separate turbine blades; adapted hinges are estimated from its mesh.
7. **Downloaded hot rod:** Daniel Zhabotinsky's Coupe '33 Hot Rod #3 replaces the
   procedural hot rod. Original cabin, wheels, UVs, normals and PBR channels are
   retained. Near/far meshes and shared 4096/2048 atlases support quality tiers.
   Doors use source-derived apertures; the source has no separately authored
   door objects. Driver/drive-by and window-hit coordinates now match the actual
   2.07 m production width; tests extract production dimensions rather than a
   smaller fixture. Its stock hood is closed, without invented flames or blower.
8. **Rocky-trail suspension:** rock-contact normals now include the same rock
   relief as contact height, fixing the compact SUV's reproduced rollover on a
   graded trail. Only the winning tyre sample evaluates the added gradient:
   seven maximum rock queries rather than the initial correction's fifteen;
   ordinary contacts retain three. The pilot and SUV selection are unchanged.
9. **Visible cabins in top-down view:** building/cloud clearance moves the
   orthographic camera backwards without changing the picture. Occupant culling
   and window tint now use the corresponding effective eye, fixing hidden
   drivers and opaque close windows. Physical camera/clipping, fade distances,
   16-car occupant cap and perspective/chase behavior remain intact.
10. **Visible credits:** corrected the old claim that every vehicle model was
   original; the complete embedded attributions are now readable through a
   keyboard-accessible, expandable Credits section, including offline.
11. **Deployment caching:** packed media, streamed tracks and gallery evidence
   use content-hashed URLs. A changed asset cannot silently reuse an older
   browser-cached pack; unchanged files keep their cache identity.
12. **Review infrastructure:** fresh localhost dev-RPC connections prevent an
   expired keepalive socket from failing the command after a long synchronous
   host test. No automatic retry can duplicate a mutating command. The Pages
   deployment also builds the native screenshot/sound gallery and verifies all
   published files against their complete SHA-256 hashes.

These are scoped improvements, not a certification that the entire game has AAA
production quality or meets an M4 Max frame-rate target. The cloud browser uses
software graphics. FPS remains enabled by default, with saved opt-out respected.

The hot rod uses 20,856 near / 5,202 far triangles and shared 4096px atlases on
High/Ultra, 2048px on Low/Medium (128 / 32 MiB base GPU texture storage for both
atlases). The business jet uses 20,131 / 6,929 triangles and one shared native
256px texture. Terminal jets use 162,629 / 17,319 triangles, four / three material
draws each, with their high-detail cabin limited to the near level. These are
resource budgets and distance-based LODs, not measured laptop frame rates.

## Detailed evidence and continuation

- [Police UV diagnosis and source-preservation checks](police-markings.md).
- [Aircraft sound and actual production graph samples](audio.md).
- [Flight, parking, boarding and collision measurements](flight-and-parking.md).
- [Jet source, licences, reconstruction and runtime lifecycle](jet-assets.md).
- [Hot rod source, licences, source fidelity and rig](hotrod/README.md).
- [Rocky-trail suspension reproduction and CPU measurements](terrain-rock-contact.md).
- [Shared street-camera cabin distance and before/after proof](car-cabin-view-distance.md).
- Native comparison inputs: [gallery manifest](gallery.json).
- [Final delivery verification and complete evidence index](verification/final-delivery-verification.json).
- [All 36 unmodified PNG hashes and capture inputs](verification/gallery-image-manifest.json).
- [Frozen final source/asset manifest](verification/final-runtime-candidate.json).
- [Published candidate, identical to the native capture game](verification/published-candidate.json).
- [14 production-function modules: 18,062 passing assertions](verification/published-host.json).
- [Actual unseeded Chromium WebAudio: 40 passing assertions](verification/unseeded-aircraft-audio-runtime.json).
- [Original seeded vehicle/control capture attempt](verification/final-seeded-runtime-attempt.json).
- [Original browser regression logs and structured outcomes](verification/browser-regressions.json).
- [Exact split/ZIP file parity and CRC](verification/package-integrity.json).

## Verification scope

The immutable prior build completed all 222 existing modules: **200 passed,
18 skipped, four failed**. The skips are retained, including WebGL-only checks in
the no-render sweep. The failures were the reproduced trail rollover, the
dev-RPC keepalive transport failure after a synchronous host test, and two
wall-time input thresholds under heavy software-graphics load (`god-mode-codes`
and `player-jump`). Their original failures are preserved rather than relabelled
as passes. The final focused suite, quiet unchanged input tests, native WebGL
review and packaged smoke have separate receipts.

The final package passed a fresh-profile rendered smoke test: title/start,
walking, driving, map, chase and return to top-down, default FPS display and
expanded full Credits, with zero browser errors. All nine streamed music tracks
loaded, and the unchanged `god-mode-codes` / `player-jump` tests both passed in
the quiet rerun. The local Pages artifact contains **63 files**, including
**36 native images** (16 before/after pairs and four additional runtime/Credits
screenshots) and **six production-graph sound samples**. All image input/hash
receipts, 86 gallery links and all six MP3 decodes passed local verification.

The final focused suite passed **15 of 16 modules**, with no skips. The remaining
failure is the scripted hill-climb pilot's 60 Hz run: 76.88 s against the unchanged
75 s target. Fresh-run investigation also found the pilot cutting onto a bank;
a strict nearest-sample controller change made routing unsafe and was rejected.
Production pilot, vehicle tuning, challenge timer and original assertions remain
unchanged. The separate descent/rest checks passed. This is an open controller
and challenge-balance item, detailed in the [terrain audit](terrain-rock-contact.md),
not a passing regression check or a claim of production readiness.

The seeded rendered vehicle/control attempt completed 116 assertions and three
native runtime images, then timed out waiting for audio. `initAudio()` deliberately
disables sound in seeded sessions to preserve deterministic captures. Its original
timeout is retained. Actual Chromium audio was therefore checked in a separate
unseeded no-render page against identical frozen game bytes: **40 assertions
passed**, including all four profiles, nonzero output, mute and exit fades. The
review tools now separate those contexts; production audio was not changed to
bypass the seeded-session rule. This is separate visual and audio evidence, not
an integrated rendered-audio pass.

Final source is frozen in HTML SHA-256
`719a535fe3905275c381737acb7fc3e80ee1ab4378c0d5736a4595096b16c03c`.
Before screenshots use the original published game SHA-256
`21403cd7c63950f619da9e8818a60be14ef306b0d08ced79ac336cd247c4df1a`.
The accepted gallery records every PNG's original capture hash and input build.
Earlier R2/R4 capture attempts and source manifests remain explicitly labelled
intermediate: they exposed the S2 coating/decal and hot rod/cabin problems and
are superseded by the consolidated final comparison set. Overlapping hot rod
staging photos are excluded. PNGs are native viewport pixels, with only the
documented browser crop; no retouching or generated imagery is used.

Browser tools run Chromium/SwiftShader through the managed local HTTP adapter,
even when their input syntax is `file://`. This verifies the packaged web game,
not native file-scheme behavior or hardware FPS. Four normal-control airplane
flights are verified separately from all seven host-driven routes. Mission
state/retry/summit regression coverage does not establish four uninterrupted
manual mission wins.

All three new models use free CC BY 4.0 source grants from asset-specific
Sketchfab export metadata and matching pinned mirror attribution. Original
Sketchfab pages are blocked here; the archived exported licences are the stated
basis. Conversion tools, pinned input hashes and redistribution credits are
checked in. CPU source inspection images in the asset audits are explicitly
labelled; the public gallery uses actual game screenshots.

Claude should fetch **`origin/codex-reviews`**, continue on that permanent branch,
and read `CLAUDE.md`, `docs/HANDOFF.md`, this audit and the relevant area docs.
Coordinate branch pushes and merge newer approved main changes into the review
branch when necessary. Moving this work to main requires the owner's approval.
