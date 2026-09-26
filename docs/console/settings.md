# Console: settings

`addConsoleMethods('settings', …)` in `src/game-console-settings.js`. Settings, key bindings and the car radio. It also registers the feature consoles below.

| Method | Purpose |
| --- | --- |
| `radio()` | The car radio and its volume row as shown: shown / open, station, on (`enabled`: on the Falcon the ride's own switch; `saved`: the saved setting), playing, `volume` (= Settings radio), muted, `unmuteTo`, `volumeSet` (the player chose the level), `elementVolume` (the `<audio>` element's live volume), `scale` (`volumeScale('radio')`), and `knob`: value, angle in degrees, lit LEDs, LCD readout, aria value text, whether it is being dragged and in which mode (`linear` / `circular`), the last drag (mode, from, to, pixels, degrees swept), pixels per step and sweep; `title` (the title menu's radio: enabled, shown, station, power, `waiting` for a user gesture, `inMenu`), `carStation`, `blocked`, `unavailable`, `loaded` (what the element holds), `src`, `time`, `fading` (the title handover's fade-out) |
| `settings(changes)` | Every setting (graphics, shadows (`'auto'`, `'off'`, `'low'`, `'high'`), frameLimit (30, 60, 120 or `'unlimited'`), fps, cutaway, playerOutline (the faint moonlit rim on the player at night), sound, the seven volumes (`masterVolume`, `radioVolume`, `engineVolume`, `soundVolume` = effects, `voiceVolume`, `ambienceVolume`, `sirenVolume`; `audioReset: true` restores the defaults), voices, NPC chatter, minimap fold and zoom, `flightHud` (the flight instruments), `gps` and the points in the minimap's objective route `gpsRoute`, touch mode, and Settings · Driving: `abs`, `esc`, `tcs` (booleans), `steering` (50-150 %), `lookAhead` (0-150 %), `units`; `drivingReset: true` restores them); pass an object such as `{ chatter: false, minimapZoom: 2, gps: false }` to change some |
| `openSettings(tab)` | Open the settings screen on `graphics`, `audio`, `gameplay`, `driving`, `controls` or (with god mode on) `god` (over the pause menu during play) |
| `bindings(changes)` | Key bindings as `{ action: [primary, secondary] }`; `{ ascend: 'KeyY' }` binds a primary key (a clash swaps), `'reset'` restores the defaults |

## audio (`audioConsole() in src/audio.js`)

| Method | Purpose |
| --- | --- |
| `audioMix()`, `engineSound()` | The audio context, every bus's live gain (`buses`: mix, effects, engines, ambience, sirens, music, voices), the fixed loops (tyres, siren, rotor) with their gains; the player's engine: set, revs, gear, throttle, load, output gain and tone, each layer's rate and gain, road / wind / track levels, the jet voice, the traffic voices (`nearbyDriven`, the nearest four with loop, distance, revs, rate, level) and `trace` (the last 12 s at 0.1 s: speed, revs, gear, load, gain and the audible layers). `simulate()` drives it, so a test can hold `KeyW` from a standstill and read the gear shifts |
| `rainSound()` | The rain beds: `rain` and `wet`, each bed's target weight (`targets`) and live gain (`light`, `steady`, `heavy`), the roof drumming and tyre spray gains, the `cabin` low-pass (16 kHz in the open, 2.5 kHz under cover, 620 Hz in a closed vehicle) and `shelter` (0 open, 1 under cover) |
