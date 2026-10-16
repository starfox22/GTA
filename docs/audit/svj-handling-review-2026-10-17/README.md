# Brutini SVJ replacement and earlier motorcycle handling

This review continues the permanent `codex-reviews` branch. It replaces the
procedural Brutini SVJ body with a downloaded, licensed Aventador SVJ model and
restores the earlier motorcycle turn and wheelie response. Dedicated rider keys,
distance achievements, the improved riding/fall animation and earlier impact,
audio and graphics changes remain.

## Downloaded model

The source is SDC PERFORMANCE's [Lamborghini Aventador SVJ SDC — FREE](https://sketchfab.com/3d-models/lamborghini-aventador-svj-sdc-free-784e4656aca649cca55d6b18740a19b2),
licensed CC-BY-4.0. The exact GLB was downloaded from the
[pinned mirror](https://github.com/pxlinspace/lambo/blob/e94085e40e5137ae1f9c35cc517024167e8711cb/assets/models/lamborghini/lamborghini_aventador_svj_sdc__free.glb).
Its embedded credit, original artist page and mirror attribution identify the
same asset. Source SHA-256:
`4c56b1baafe861dcbb7438571d685ddb96709d3cc909f58b83bc58887e96fd16`.

All **508,324** source triangles remain in the near model, with authored split
normals and UVs. The far model has **20,133** triangles. Wheel steering is
neutralized by rigid hub transforms. Paired doors are separated by source face
ownership and open on measured scissor hinges. The source has no seat/dashboard
cabin and uses opaque canopy glass; the integration adds the game's fitted
two-seat cabin and transparent gameplay glass. These are documented adaptations,
not claims of an authored interior or authored door pivots. The supplied carbon
texture is 1024 square; no missing 4K texture is claimed.

The [model integration audit](../svj-integration-2026-10-16/README.md) retains
source intake, conversion and independent original-source studio previews.
The [model area notes](../../areas/vehicles-and-driving-models-svj.md) document
reproduction, the fitted cabin and measured hinge adaptations. Studio previews
are source references, separate from the native game screenshots below.

## Restored handling

Motorcycle steering again follows the earlier direct yaw response and immediate
bank. Bank is a pose snapshot rather than a delayed steering solver. Wheelie
lift returns to the earlier 0.45 rad/s rider pace and mass-shift coefficients;
there is no fixed 29-degree hold target. Feather throttle/rider-back to balance a
long wheelie. Excessive continued pull can loop out.

W/S remains throttle/brake. Up and Down remain separate, remappable rider weight
actions in Settings. Down shifts forward without applying the brake or cutting
W. The 3–8 km/h activation gate, contacting-tyre force limits, airborne contact
guards, source rear-axle pivot and improved rider motion remain. Actual settled
front-wheel-up travel still feeds the 100 m and 200 m achievements.

## Native screenshots

The [recorder](../../../tools/svj-bike-render-review.mjs) uses named developer
actions and the actual 3D renderer. The SVJ rear before/after views share seed 1,
position `(418, 6000)`, heading 0, High graphics, clear weather, 13:00 lighting,
1000 × 700 viewport and the same inspection cameras. Simulation is held between
explicit advances. Boarding is first observed by a drawn frame and then allowed
to finish; the ordinary radio popover closes on its normal timer. No pixels or
game UI are painted over, removed or composited.

Before uses the previous published game, monolithic SHA-256
`aa9ca8c1d6a9279894308e0b2f5a9d7e99ebc67b3d1328825b64cb0c5b8632cb`.
The two additional Kuzuki frames use actual throttle/rider-back and throttle/turn
simulation. Their runway fixture positions and all input/state observations are
retained in the capture receipts. The image manifest covers exactly the images
in [gallery.json](gallery.json), with native byte hashes and exact input HTML
and recorder hashes. The first before front image caught the radio during its
closing transition and was rejected; only the clear rear view is used for the
matched comparison. The raw before receipt retains that rejected capture. The
final recorder waits for the panel's collapsed bounds as well as its closed state.

The preceding wheelie/rider, impact/motorcycle and police/aviation galleries are
retained as historical reviews. Their screenshots describe their own releases.
Software rendering and inspection cameras do not establish hardware frame rates.

## Verification

The integrated source passes **20 host modules / 18,758 assertions**, covering
the actual SVJ loader, PBR materials, source identity, wheels, scissor doors,
headroom, LOD and char/repair; existing C8, hot rod, SUV and motorcycle source
contracts; prior controller traces; contact/braking, bindings, scorer, rider
poses and fatal/ordinary falls. Every near triangle corner also passes the
original-source position, authored-normal and UV comparison. Exact receipts:
`verification/final-host.json` and `verification/source-corner-proof.json`.

The restored controller's live browser check earns **201.701 m / tier 2** using
rearward rider weight and **12 throttle changes**, without setting pitch or
distance. A prolonged pull causes a real loop-out and completes the earned
meter as crashed. Real W/Up, W/Down, Space, coasting and stationary arrow inputs
pass, as do the cruiser, bicycle and other lift-capable motorcycles. This check
uses the isolated controller source `acc08f81` with test update `ce748636`;
the tested control, physics, scoring and rider source files match the integrated
release exactly (`verification/live-controller-source-parity.json`). It is
not presented as a rendered SVJ test. The integrated release separately passes
the actual Settings remap/reload UI check (`verification/bindings-ui.json`).

Frozen integrated gameplay source is `d6f01674` (followed only by test/evidence
changes). Monolithic HTML SHA-256:
`c3200fc63508a789867d7ff8617c7f5c2a79c4dc703529f8ac69002372cd579d`.
Game JavaScript SHA-256:
`b0247b8cf78d68ea66396eb97ebb5bb261c88e1fed3821413569133ce9e86147`.
The split entry is
`edd4ead2d4e72b00a7792a4626ca304a81007848e82ba3ec6565f66b1ea5d5e1`.
The full 240+ module suite was not repeated for this focused pass.

The packaged split build passes real-key walking and driving, map opening,
both camera modes, default FPS visibility and the complete Credits UI,
including the new SVJ attribution. Its seven captures and browser receipt
record **zero errors**; the sole warning is the existing Three.js legacy-build
notice. See `verification/packaged-smoke.json` and `packaged-console.log`.

The final native review also confirms the actual `svj_sdc` selection, visible
near geometry and loaded 2048px High textures. Opening the driver door transfers
8,079 source triangles from the static body to its visible moving layers;
500,245 body triangles plus those door layers retain the complete 508,324 faces.
The closed/open captures, lifted front with a live 14.19 m meter and 4.2-degree
corner bank have zero GPU loss, frame faults or console errors. See
`verification/native-runtime.json` and the raw capture receipts.
