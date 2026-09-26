# Audio and radio

audio.js (Web Audio lifecycle, the mix, samples, procedural sounds), engine-audio.js,
crash-audio.js, weather-audio.js, water-audio.js, ambience.js, sealife-audio.js,
sports-audio.js, beachclub-audio.js, themepark-sound.js, car-radio.js, settings.js (volumes).

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
  (`earFilter`, dulled while swimming), then `mixBus` (master × Sound switch) and a limiter.
- `applyVolumes()` pushes every change into the live mix and the radio knob.
- Recorded loops (engines, rain) end with 0.2 s of their own start and are listed with their
  exact length in `LOOP_SECONDS`; play them with `loopingSource(name)` (Vorbis decoders
  disagree by a few hundred samples about where a file ends).
- Console: `audioMix()`, `engineSound()`, `rainSound()`, `crashSounds()`, `stadiumSound()`.

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
- Everything else is procedural (ambience hum, water, drawbridge motors, parachute wind,
  sea life whistles, the beach club's music on a look-ahead scheduler with `mareaGroove` as
  the beat clock for dancers and lights).

## Media and credits

- Media lives under `assets/` and is listed in `assets/manifest.json` (`id`, `file`, `mime`,
  `original`), referenced by id from `src/asset-loader.js`.
- **Every third-party asset is credited in `docs/THIRD_PARTY_CREDITS.txt`** (the build embeds
  that file in the page: keep it, and keep it accurate).
- Entries marked `"stream": true` (the nine radio tracks in `assets/music/`) are embedded in
  the single-file build but, with `--split-media` / `--zip`, written beside the page as
  `media/*.mp3` and loaded by URL. The published artifact page is capped at 16 MB (each extra
  file at 15 MB): keep the split page under ~15.5 MB; prefer procedural textures and small
  media (WebP, MP3/OGG).
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
  is refused: `carRadioBlocked` shows "Click anywhere to play radio" and `titleRadioGesture`
  retries inside the next gesture. Leaving the title, the radio carries into a vehicle or
  fades out over `RADIO_HANDOVER_MS`.
- Saved in `dead-end-city-radio-v2`. Console `radio()` (state and knob).
- Check streamed tracks load from a split build with `node tools/media-check.mjs <dir>/index.html`.
