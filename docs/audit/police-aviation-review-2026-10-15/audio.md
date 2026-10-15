# Aircraft engine audio review — 15 October 2026

The SKYLARK 172/Cessna 172 had a reproducible classification error: `engineKind`
returned `turbofan` for every named plane except `courier`. That selected the jet
whine/roar/hiss, with no piston combustion sound. The frozen pre-change source is
commit `d75acc1`, archived at `dist/review16/baseline-source`; the new host regression
fails its first assertion against that source and passes against the revised source.
Exact outputs: [before](audio-evidence/before-host.txt), [after](audio-evidence/after-host.txt).

## What changed

| Airframe | Actual in-game engine/model | Revised sound |
| --- | --- | --- |
| `skyhawk` / SKYLARK 172 | C172, single four-cylinder piston, two-blade prop | Four-stroke combustion pulses and blade harmonics, 700–2700 RPM, no turbine hiss |
| `courier` / SERRANO C200 | Procedural PC-12-like single turboprop, four blades | Turbine whine/noise plus 70–113 Hz blade passing, 1050–1700 prop RPM |
| `jet` / AURELIA J8 | Twin rear turbofan business jet | Fan tone, turbine whine, broadband thrust roar/hiss |
| `airliner` / MERIDIAN 220 | Twin wing turbofan airliner | Lower fan/whine than the business jet, larger thrust-noise voice |

There is no twin-piston/twin-prop airframe in the present flight/model inventory;
no aircraft has been relabelled to create one. The downloaded business-jet work
keeps key `jet` and the twin turbofan profile. Missing/unknown airframe keys fall
back to the courier, matching the renderer and vehicle-spec fallback.

`aircraft-audio.js` supplies band-limited combustion/propeller pulse waves and
filtered turbine noise, generated locally. No downloaded audio or new runtime
media asset is used. Audio follows actual `c.power`, which already follows the
throttle through each flight profile's spool rates; `c.throttle` is only the
fallback for an aircraft without power state. Four-stroke firing Hz is
RPM × cylinders / 120; propeller blade-passing Hz is RPM × blades / 60. The fixed
pitch C172 also gains a modest airflow contribution to RPM.
`aircraftPropellerRpm(car)` is the pure, allocation-free shared rule for audio and
visual propeller animation. Extracting it preserved all five rendered WAVs exactly;
the [byte comparison](audio-evidence/rpm-extraction-byte-proof.json) records old/new
source hashes and the unchanged WAV hashes.

The renderer previously drove every propeller with 14–84 rad/s, only about
134–802 RPM, so the visual C172 and courier shafts disagreed with their sound.
`animateAircraft` now converts the shared RPM with π/30, retaining its smooth
spin-up and coast-down. Blur uses 20–75 blade passages/second, so a four-blade
propeller blurs more than a two-blade propeller at the same shaft RPM. Uncrewed
parked/destroyed propellers coast to a stop; abandoned airborne engines continue.
The existing turbofan animation scale and null-prop behavior are preserved.

The player's plane idles while crewed, changes pitch/load with power and fades
when destroyed, parked and exited, paused or muted. A modest tyre rumble is present
on the runway and stops after lift-off or gear retraction. One related cutoff bug
is covered: changing from a plane into a road vehicle must fade the plane even
while the road-engine sample buffers are still decoding.

There are at most four reusable fixed-wing voices: one aboard and the nearest
three running exterior planes within 2400 world units. Present exterior running
cases are abandoned airborne planes; AI planes are also supported. Uncrewed parked
planes stay silent. Each voice has four sources and 15 nodes, and shares the noise
buffer and cached pulse waves. Family changes reuse nodes. The existing four road
traffic voices remain capped separately. Exterior attenuation includes altitude,
relative velocity gives Doppler, `soundRight` gives camera-relative pan and
`soundShade` gives building/terrain occlusion. Everything feeds `engineBus`, so
engine/master sliders, the saved Sound switch and mix limiter still apply.

`engineSound().aircraft` exposes airframe, family, engine count, actual power,
RPM, firing/blade Hz, output gain, hiss, distance, pan and Doppler. Full contract:
[Aircraft audio](../../areas/audio-aircraft.md).

## Validation and listening fixtures

Review copies: [C172 before](audio-evidence/skyhawk-before.mp3),
[C172 after](audio-evidence/skyhawk-after.mp3),
[courier](audio-evidence/courier-after.mp3),
[business jet](audio-evidence/business-jet-after.mp3),
[airliner](audio-evidence/airliner-after.mp3),
[C172 flyby](audio-evidence/skyhawk-flyby.mp3). These six small MP3s are evidence
copies, not game assets. [Encoding/source hashes](audio-evidence/listen-receipt.json),
[before WAV/source receipt](audio-evidence/before-render.json) and
[after WAV/source receipt](audio-evidence/after-render.json) retain provenance.

`node tools/tests/aircraft-audio.mjs` passes **60 host assertions** against the
production functions and recording Web Audio nodes. It covers all four model
families, actual power versus lever position, rate calculations, cutoff/mute,
full 3D distance, relative motion, camera pan, occlusion, voice cap/reuse, runway
roll and the production `updateEngineAudio` call path. The existing
`chase-audio-pan.mjs` also passed **669 host assertions** without launching a
browser. This does not measure hardware audio performance or validate subjective
sound quality.

`node tools/tests/aircraft-propeller-sync.mjs` adds **22 host assertions**, executing
the full actual `animateAircraft` function with recording scene objects: C172 and
PC-12-like courier idle/full-power agreement with audio RPM/blade Hz, blur, smooth
acceleration/coast-down, parked/destroyed/abandoned states and unchanged twin-fan
rotation with a null propeller. Against the frozen pre-sync renderer it fails
immediately at C172 idle (about 134 visual RPM versus 700 audible RPM). Exact
[before output](audio-evidence/propeller-before-host.txt),
[after output](audio-evidence/propeller-after-host.txt) and
[source/test receipt](audio-evidence/propeller-sync-receipt.json) are retained.
This proves parameter/rotation behavior on the host; it is not a rendered visual test.

The separate preview script renders the **actual production Web Audio graph**
with `web-audio-engine@0.13.4`'s CPU `OfflineAudioContext`, without a browser/GPU or
audio device. It produces five stereo PCM WAVs at 24 kHz, each 8.5 seconds:
four model profiles and a left-to-right C172 flyby. These are isolated graph
fixtures at unity dry engineBus level; they exclude the global mix makeup/limiter,
radio, scene ambience, cabin effects and the separate runway/wind layers. They
are not recordings of gameplay. The rendering package is an optional tool in
`/tmp`, with no game dependency or manifest change.

```sh
npm install --prefix /tmp/dec-aircraft-audio --cache /tmp/dec-npm-cache --ignore-scripts --no-audit --no-fund web-audio-engine@0.13.4
node tools/tests/aircraft-audio.mjs
node tools/aircraft-audio-preview.mjs dist/review16/audio
DEC_ENGINE_AUDIO_SOURCE=dist/review16/baseline-source/src/engine-audio.js node tools/tests/aircraft-audio.mjs
# Above deliberately exits 1 on the old C172 classification.
DEC_ENGINE_AUDIO_SOURCE=dist/review16/baseline-source/src/engine-audio.js node tools/aircraft-audio-preview.mjs dist/review16/audio-before
```

The WAV timeline is 0–1.5 seconds idle, throttle advanced at 1.5 seconds, actual
power ramps at the existing flight profile's rate, and output cuts at 6.2 seconds.
The new voice release time constant is 0.12 seconds. The old graph released its
layers over 0.3–0.4 seconds. Listen to the C172 before/after to assess the removal
of the turbine whistle, then compare C172 versus courier and the two jets. Preview
receipts include exact source/audio SHA-256 hashes, peaks, RMS and cutoff residuals.
The model cannot consume audio input in this session; these clips were rendered
and metered, with **no claim of subjective listening approval**.

The final candidate isolated full-power RMS levels are C172 0.133, courier 0.116,
business jet 0.135 and airliner 0.144; all individual peaks are below 0.508, and the
new voices' measured post-cutoff RMS is below 0.000001. The short dry clips are
reproducible evidence, not a calibrated sound-pressure comparison between aircraft.
The root review owns integrated browser/mix follow-up and the final quick check.

## Actual browser audio follow-up

The final visual recorder uses `?dev&seed=1&hold&shadercheck`. In this game,
`initAudio()` deliberately returns before creating an AudioContext whenever
`DEV_BOOT_SEED` is set (`src/audio.js`). Turning Sound on or clicking Start cannot
override that gate. Its first wait for the C172's audio gain therefore cannot
complete in that seeded session. This is a recorder prerequisite error; the
completed visual/aircraft-control checks remain separate from audio validation.
The preserved run recorded **116 checks and three screenshots**, then timed out
after 540000 ms at `aviation-vehicle-runtime-review.mjs:234`, with **zero audio
profiles completed**. Its actual ground/cruise snapshots show `context: null` and
`engineSound().ready: false`. The [failure receipt](verification/seeded-aircraft-audio-wait-failure.json)
retains the exact timeout, original report hash and those snapshots. This timeout
does not count as a passing integrated WebGL/audio test.

The follow-up [standalone recorder](../../../tools/aircraft-audio-runtime-review.mjs)
ran the same immutable `published.html` with **`?dev&norender&hold` and no seed**.
It clicked the real Start button, created a real Chromium AudioContext, and passed
**40 assertions** for all four airframes. The
[full receipt](verification/unseeded-aircraft-audio-runtime.json) and
[log](verification/unseeded-aircraft-audio-runtime.log) retain named actions,
actual voice/mix/meter snapshots, environment names, Chromium version and input/tool
SHA-256 hashes. HTML SHA-256:
`719a535fe3905275c381737acb7fc3e80ee1ab4378c0d5736a4595096b16c03c`.

The checks wait for output gain, hiss, RPM, firing and blade rates to settle,
including the slower hiss release when changing families. Each selected the
correct engine family/count and idle parameters; all four output analysers
measured a nonzero signal. Master 100 and engine 75 produced live mix 1 and engine
bus 0.465. Muting faded the actual voices and analyser output to silence; unmuting
restored them, and a normal parked exit faded them again. The observed voice pool
remained at or below four, with zero console errors and frame faults.

| Airframe | Observed output gain | Observed hiss gain | Actual idle output RMS |
| --- | ---: | ---: | ---: |
| C172 | 0.306 | 0 | 0.0319 |
| Courier | 0.8497 | 0.0042 | 0.0414 |
| Business jet | 1.19 | 0.027 | 0.0370 |
| Airliner | 1.2747 | 0.027 | 0.0359 |

These readings include the actual game mix and limiter at the stated slider
settings. They are not sound-pressure measurements. This was an actual browser
**audio** run with **NO_RENDER**, without a WebGL context or screenshots. It does
not establish rendered scene performance or subjective listening approval.

```sh
source /workspace/setup/GTA-env.sh
node tools/aircraft-audio-runtime-review.mjs dist/review16/published.html dist/review16/unseeded-audio-runtime
```
