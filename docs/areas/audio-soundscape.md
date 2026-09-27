# Audio: the free-roam soundscape

acoustics-audio.js (the ear probe, the room, occlusion), ambience-beds.js (beds and events
by place and time), footsteps-audio.js (steps by surface, landings, runners), vehicle-foley-audio.js
(horns, doors, tyre ground, traffic skids), bullets-audio.js (strikes, near misses). The mix
itself is in audio-and-radio.md.

## The ear probe (acoustics-audio.js)

- `earProbe` runs about three times a second (or after 60 units of travel) from
  `updateAcoustics` in soundUpdate. Eight rays find walls taller than the ear within 280
  units: `acoustics.enclosure` (0 open .. 1 canyon), `wallDistance`, `tall`; plus `relief`
  (terrain 500 units off), `lift` (ear over the ground, on foot only), `county`, and
  `cover` from `overheadCover` weighted by kind (`COVER_ROOM`: the underpass, a garage, a
  showroom 1; rail decks and bridges 0.6; awnings, canopies, shelters 0.25). Cover raises
  the enclosure, tightens the slap and sends the player's engine (`engineTap`) and footsteps
  (`foleyBus`) into the room.
- It also names the place for the beds, `acoustics.zone`: city, harbour, green, country,
  mountain, monarch, beach (0..1), the district and the nearest reservoir. **Read the zone,
  do not call districtAt() per frame** (ambience.js used to).
- The smoothed values glide over ~0.8 s; a jump over 400 units (a teleport) snaps them.

## The room

- `reverbSend` (audio.js global, built by `buildRoom` in initAudio) is the one input for
  roomy sounds; it feeds the convolver (`reverb`), SLAP (two feedback delays, left/right,
  delay from `wallDistance`, level from `enclosure²`) and ECHO (one dark long delay, level
  from openness and relief, 0.26 s in town, 0.4-0.65 s in the county). All returns land on
  `master` (effects). Connect new roomy one-shots to `reverbSend`, never to `reverb`.
- playSample sends only `ROOM_SAMPLES` (guns, explosions), from the source before its
  distance and occlusion shading, at `roomSendLevel(distance)` (falls off slower than the
  direct sound). crash-audio.js sends its bus (post-attenuation).

## Placing one-shots

- `soundShade(position, distance)` returns a scratch `{ cutoff, gain, occluded }` (do not
  keep it): the air-absorption cut-off (`airCutoff`) times 0.22 and gain 0.55 when a
  building (or a hill out of town) is between the ear and the source (`earBlocked`,
  building grid + `sightBlockedBy`, cached per source object for 0.25 s in a WeakMap).
- Used by playSample (every positioned sample over 24 units), crashes, traffic horns and
  the siren loop's filter. The siren loop is also panned to the nearest cruiser and
  pitched by its closing speed (the traffic engines' `SOUND_SPEED`).

## Beds and events (ambience-beds.js)

- `ambienceBeds.weights` glide (1.6 s) to the zone: every bed's level is a sum over them,
  so places cross-fade. Five noise layers (wash, whistle, leaves, cicada, chorus) plus
  ambience.js's `wind`, which the beds now drive (gusts x exposure x weather.wind).
- Up on a roof (`height` weight) the near traffic hum thins and the wash rises; birds thin.
- Events fire on their own clocks through `bedFire` (counted in `heard`), only when their
  zone weight is over 0.05. Rain (`weather.rain`) silences birds and insects.
- The ambience bus has a cabin low-pass (`ambience.cabin`): 1.8 kHz in a closed car,
  900 Hz in an aircraft, open on bikes, bicycles, boats and the roadster.
- Audio code uses `sfxRandom` (Math.random): never `randomBetween`/`seededRandom`, which
  would make the world's seeded sequence depend on whether sound is on.

## Footsteps (footsteps-audio.js)

- A step every half `strideCycle` of the distance actually moved (so they follow the
  legs, stop at walls and never fire on a teleport, over 40 units a frame). Not in a
  vehicle, swimming, climbing, falling, tumbling, thrown, carjacking, riding.
- `footSurfaceAt(x, y, roof)` is the one ground rule (the tyres use it too): drawbridge
  span metal; docks, piers, pontoons, boardwalk wood; beach sand; roads asphalt; North
  Point Key tile; parks grass; Monarch sand/grass/pavement; the Ridgeline snow, rock, trail
  dirt/mud, scree above the treeline, grass; county towns pavement, else grass.
- `footLandSound(into)` is called from playerImpact (falls-body.js) for every dry landing
  over 1.5 m/s: the one landing sound on foot.
- Other people: officers and crowd people within 150 units moving 2.4-9 m/s (runners, not
  walkers) keep a stride clock in a WeakMap and step on their own ground, placed; a token
  bucket (8/s) caps them. Only while the player is on foot.

## Bullets (bullets-audio.js)

- `bulletImpactSound(x, y, kind)` is called from updateBullets (game-combat.js) with the
  hit kind (wall, metal, glass, dust; never flesh), within 700 units, one occlusion ray a
  strike, capped by a token bucket (6, refilled 14/s): a shotgun load is at most six.
- `updateBulletWhizz` looks at enemy rounds each frame: one that passed the ear this frame
  within 32 units whizzes once (a WeakSet), panned to the side it passed; rounds faster than
  1,600 units/s or snipers' crack first. It only reads `bullets`.

## Vehicle foley (vehicle-foley-audio.js)

- `hornKind(c)` / `HORN_VOICES`: the one horn voicing, for the player (`actionHeld('horn')`,
  engine bus) and traffic (`hornSound` in ambience.js, ambience bus).
- `vehicleDoorSound(c, 'enter'|'exit')` replaced the enter/exit beeps in
  game-player-actions.js; `lockedHandleSound()` the LOCKED beep.
- `tyreGround(c)` (cached 0.2 s): loose ground mutes the squeal (audio.js tyres loop) and
  opens the scrub loop; a wet road squeals softer and lower.
- One traffic-skid voice: the loudest sliding AI/cop car within 500 units, re-picked every
  0.15 s.
- Suspension: a new `c.hop` object on the player's road vehicle (a kerb in physics-driving.js,
  a rock or rut in offroad-trails.js, a landing in falls-vehicles.js, a blast) knocks once
  through the engine bus, scaled by `hop.vz`. Code that sets a hop gets the knock for free.
- Pass-bys: a moving car (over 15 km/h, closing over 25 km/h) crossing the ear's line within
  80 units whooshes on the ambience bus (so a closed cabin dulls it), panned across; a
  token bucket keeps it to ~2 a second. Per-car state is a WeakMap.

## Cost

- Persistent: 5 bed layers, 2 foley loops (scrub, skid), the room (2 slap + 1 echo delay,
  merger), the siren panner. Per event: 3-12 short nodes that stop within ~1 s (a mower or
  a ship's horn up to ~30 s); a pass-by is 4 nodes for 0.7 s. The probe is 40 point tests + 6 terrain samples at 3 Hz;
  occlusion one grid walk per new source per 0.25 s (skipped past 49 cells).
