# KUZUKI600R inline-four sound audit — 16 October 2026

The `bike` vehicle alone now uses a Japanese inline-four bank. It previously
shared a Yamaha parallel-twin idle and several car recordings with the other
sport motorcycles. Vehicle appearance and driving performance remain separate.

## Recordings and limits

- Sclolex, [KawasakiZX6RStart.wav](https://freesound.org/people/Sclolex/sounds/211668/), CC0.
  Pinned public copy: `alfredr/thirty-phantom@83cdeea54cf2d1c5da96e80e85d772037bae0c61`,
  `public/audio/engine-bike.mp3`; its neighboring `CREDITS.md` independently records the attribution.
- richwise, [Sportsbike Flyby](https://freesound.org/people/richwise/sounds/361403/),
  a Suzuki 1000cc sportsbike on a racetrack, CC0. Pinned derivative:
  `web3-engineer/zaeon-os@07d3a67215bd3814436994bcbb38816f80ef65ef`,
  `public/assets/sounds/cyber/moto-motor-alto.wav`; neighboring credits document the original,
  stabilization to 300 Hz and 22% circular convolution reverb. This earlier version precedes
  that mirror's added bass/saturation. Its mild baked coloration remains in our loop.

The authors' original Freesound pages were checked with web search/open. The cloud
network permits GitHub downloads but blocks Freesound/CDN downloads; no proxy bypass
was attempted. Searches of public mirrors found these usable samples, but no dry
GSX-R600-specific recording. The result is a real Japanese inline-four reference
bank with procedural load detail, **not** a claimed exact GSX-R600 recording or a
commercial multi-microphone dyno session. No copyrighted game sound was imported.

`python3 tools/sportbike_audio.py` downloads only the pinned sources, verifies their
SHA-256 hashes, converts them with ffmpeg + numpy and saves a receipt under
`work/sportbike-source/conversion-receipt.json`. Exact circular loop lengths plus
0.2 s padding use the game's existing decoder-padding contract. Playback roots
are measured apparent firing frequencies (38/300 Hz × 30), not source tachometer data.
All sources, transformations and licenses are also in the game's embedded credits.

## Production behavior

1,300 rpm warm idle; 14,500 rpm full-load upshift; 15,500 rpm ceiling. Six close
ratios are normalized to the game's existing top speed. Pull-away clutch slip,
85 ms upshift unloading, lower-gear downshift blips and wheel-driven engine braking
keep pitch attached to road speed. The real idle hands over to the Suzuki exhaust
between 1,800 and 3,800 rpm. Intake harmonics fire at `rpm / 30` (four cylinders,
four strokes), with a quieter gear whine. A reusable 17 Hz gain envelope makes
the ignition limiter regular at low rendering FPS. The stock four has no random
V8-style exhaust pops or Ford V8 starter sound.

All added sound reaches the existing engine bus and envelope: saved engine volume,
master/mute, paused play, damage and vehicle changes apply. Sources are built once
and reused. Other motorcycle sets remain mapped as before.

## Verification

- `node tools/tests/sportbike-audio.mjs`: 1,777 host assertions against the shipped
  caller/functions: bank/type isolation, 1,300–15,500 range, all five upshifts,
  shift cuts, limiter modulation routing, four-stroke firing rate, lift-off,
  engine braking, downshifts, source bounds, mute, wreck and pending-bank handover.
- `node tools/tests/aircraft-audio.mjs`: 60 assertions pass for the existing aircraft graph.
- `node tools/sportbike-audio-preview.mjs`: renders the actual `updateEngineAudio()`
  caller and shipped OGG buffers through `web-audio-engine@0.13.4`, at 48 kHz stereo.
  Optional tool dependency only: `npm install --prefix work/audio-tools --ignore-scripts
  --no-audit --no-fund web-audio-engine@0.13.4`.

The listening artifact is `dist/sportbike-audio/kuzuki600r-idle-six-gears-limiter-overrun.wav`
(and an MP3 copy). It is 24 seconds: idle 0–1.8; six-gear pull 1.8–15.5;
sixth-gear limiter 15.5–17; closed-throttle braking to stop 17–21; idle 21–22;
mute at 22. This is an isolated production graph fixture, not a gameplay recording.
It includes recorded loops, intake/gear detail, limiter, road and wind. It excludes
radio, ambience, cabin acoustics and global limiter/makeup; engineBus is at unity.
A neighboring receipt includes source hashes, schedule and measured levels.

Peak 0.280; RMS idle 0.027, loaded 0.090, limiter 0.068, overrun 0.060, muted tail 0.000033. All finite, with no clipping.
