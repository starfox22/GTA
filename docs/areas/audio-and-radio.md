# Audio and radio

audio.js (Web Audio lifecycle, the mix, samples, procedural sounds), engine-audio.js,
crash-audio.js, weather-audio.js, water-audio.js, ambience.js, sealife-audio.js,
sports-audio.js, beachclub-audio.js, themepark-sound.js, car-radio.js, settings.js (volumes).
The free-roam soundscape (the ear probe and the room, ambience beds, footsteps, horns,
doors, tyre ground) is in audio-soundscape.md.

## The mix (audio.js THE MIX)

- One gain per category, each set by its Settings · Audio slider (`AUDIO_VOLUMES`;
  `busLevel(channel)` = 0.62 × slider):
  - `master`: effects (weapons, impacts, crashes, UI). Historical name: **anything connected
    to `master` is an effect**.
  - `engineBus`: engines, tyre and rotor loops.
  - `ambienceBus` (also `ambience.bus`): ambience, weather, water, rides, the drawbridge,
    parachute wind, the stadium's goal reactions.
  - `sirenBus`, `musicBus` (the beach club), `voiceBus` (callouts).
- All but voices pass the ride-skip `duckBus` (`setMixDuck`), then the ear filter
  (`earFilter`, dulled while swimming), then `mixBus` (master × Sound switch), a limiter
  (soft knee at -12 dB) and a brick-wall ceiling at -1 dBFS.
- The ambience bus passes `ambienceDuck` (LOUD DUCK): `duckForLoud(level)` from playSample
  for ROOM_SAMPLES dips it up to 0.45 (~5 dB) in ~15 ms, holds 0.12 s, releases over ~1 s
  (`updateLoudDuck`). The ambience slider stays on `ambienceBus`; never set the duck's gain
  elsewhere.
- `applyVolumes()` pushes every change into the live mix and the radio knob.
- Roomy sounds (guns, explosions, crashes) connect to `reverbSend`, never to `reverb`
  directly: it also feeds the street slap-back and the county echo (audio-soundscape.md).
- Audio code draws its randomness from `sfxRandom` (Math.random), not the seeded
  `randomBetween`, so the world's sequence does not depend on the Sound switch.
- Recorded loops (engines, rain) end with 0.2 s of their own start and are listed with their
  exact length in `LOOP_SECONDS`; play them with `loopingSource(name)` (Vorbis decoders
  disagree by a few hundred samples about where a file ends).
- Console: `audioMix()`, `engineSound()`, `rainSound()`, `crashSounds()`, `stadiumSound()`,
  `acoustics()`, `soundscape()`, `footsteps(x, y)`, `vehicleFoley()`.

## Sound systems

- Engines (engine-audio.js): `ENGINE_SETS` are recorded loops per class with the revs each
  was recorded at; `ENGINE_OF_TYPE` maps vehicle types to sets. The player's engine is
  simulated (idle, clutch, automatic gearbox, load) and layers are pitched and cross-faded by
  rpm; the nearest four traffic vehicles get a voice each with Doppler. Hypercars add
  synthesised turbo and motor sounds (hypercars.js `updateHypercarVoice`).
- Crashes (crash-audio.js): one positioned recorded crash per impact, picked by closing speed
  and material, one per pair per 0.7 s, at `CRASH_LEVEL` under gunfire and engines.
- Rain (weather-audio.js): three recorded beds cross-faded by intensity, muffled under cover
  (`rainShelter()`) and inside closed vehicles. Thunder is queued at distance / speed of sound.
- Stadium: silent between goals (a filtered-noise bed read as white noise and was removed);
  a goal plays a recorded cheer from the scoring end and a groan from the other, scaled by
  `stadiumAudibility()`.
- Everything else is procedural (ambience hum and beds, footsteps, horns and doors, water,
  drawbridge motors, parachute wind, sea life whistles, the beach club's music on a
  look-ahead scheduler with `mareaGroove` as the beat clock for dancers and lights).
- The car radio ducks under callouts and mission lines (0.27 to 0.11 of its level), gliding
  down in ~0.1 s and back over ~1 s (`carRadioLevel`).

## Media and credits

- Media lives under `assets/` and is listed in `assets/manifest.json` (`id`, `file`, `mime`,
  `original`), referenced by id from `src/asset-loader.js`.
- **Every third-party asset is credited in `docs/THIRD_PARTY_CREDITS.txt`** (the build embeds
  that file in the page: keep it, and keep it accurate).
- The single-file build (`build.py`, `--out`: dev, tests) embeds every entry as a Base64
  block. The split build (`--split-media`, `--zip`: the artifact and the download) puts **no
  media in the page**: `"stream": true` entries (the nine radio tracks) are copied to
  `media/*.mp3` and played by URL; every other entry goes into a media pack,
  `media/pack-{images,audio,data}[-n].js`, a plain script registering the same data: URL in
  `window.DEAD_END_CITY_MEDIA` (asset-loader.js reads it first). Classic `<script src>` works
  from file://, where fetch() and WebGL textures from image files are blocked, so the zip
  still plays offline. Limits: page ≤ 16 MB, each file ≤ 15 MB (packs split at 12 MB),
  256 MB per artifact version. Prefer small media (WebP, MP3/OGG) all the same: players
  download it.
- Generated media is rebuilt by its tool, not edited: `assets/unicorn-horse.json` comes from
  `python3 tools/unicorn_model.py` (numpy; reads `tools/models/Horse.glb`).

## The car radio (car-radio.js)

- `MUSIC_STATIONS`: six stations, each one or more streamed tracks (keys of `ASSETS.music`);
  a station change cuts straight to the new music. The player is the `<audio id="carRadioAudio">`
  element (plain element, no Web Audio routing, so it works from `file://` and on the
  artifact host), scaled by `volumeScale('radio')` (master × radio).
- Plays in vehicles, in a hired cab, and on the Sunset Pier rides (`radioAboard()`); on the
  Falcon it starts off every ride and the switch holds for that ride only (never saved).
- RADIO VOLUME: the 90s knob in the radio box (drag, wheel, keys, double-click to mute; a
  soft detent tick each 5 steps). Same value as Settings · Audio · Radio, set through
  `setRadioVolume()` and redrawn by `renderRadioVolume()`. The row stops pointer and key
  events so nothing reaches the canvas or the window's keydown. Default 100 (a save still at
  the old default 80 moves to 100 once; `radioVolumeSet` marks a player's own choice).
- TITLE RADIO: the same box docks on the title menu (`setTitleRadio`) with its own station
  (NEON by default, saved as `titleStation`) and switch. The first `play()` without a gesture
  is refused (browsers allow no sound before a click or key in the page; nothing gets
  round that): `carRadioBlocked` shows "Click anywhere to play radio", `titleRadioGesture`
  retries inside the next gesture and a timer retries every 2 s (autoplay granted later). Leaving the title, the radio carries into a vehicle or
  fades out over `RADIO_HANDOVER_MS`.
- Saved in `dead-end-city-radio-v2`. Console `radio()` (state and knob).
- Check streamed tracks load from a split build with `node tools/media-check.mjs <dir>/index.html`.
