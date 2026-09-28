    // Acoustics: the space round the ear (street canyons, open country, height) and how a
    // positioned sound reaches it (air absorption, occlusion by buildings, the room's returns).
    /**
     * ACOUSTICS
     * The EAR PROBE (earProbe, about three times a second from soundUpdate): eight rays
     * from the listener look for building walls taller than the ear within 280 units:
     * `enclosure` (0 in the open, 1 in a narrow street canyon), the walls' mean distance
     * (`wallDistance`, which sets the slap-back delay) and their height over the ear
     * (`tall`). `relief` is how far the ground rises or falls 500 units off (hills throw
     * an echo back), `lift` the ear's height over the ground under it (a roof, a tower,
     * the helideck), `county` whether the ear is out of town, `cover` whether a deck or a
     * roof is overhead (the underpass, a garage, a canopy, a bridge: a concrete box that
     * also sends the player's engine and footsteps to the room). The same probe names the
     * place (`zone`) for ambience-beds.js, so districtAt() runs three times a second at
     * most.
     *
     * THE ROOM (buildRoom, from initAudio): gunshots, explosions and crashes send into
     * `reverbSend`, which feeds three returns on the effects bus:
     *  - the convolver `reverb` (audio.js, a 1.3 s tail), louder among tall walls;
     *  - SLAP: two short feedback delays (left and right, 40-160 ms from the walls'
     *    distance, low-passed at 3.4 kHz): a shot fluttering between the facades;
     *  - ECHO: one long, dark delay (0.26 s off far facades in town, 0.4-0.65 s off hills
     *    in the county; 1.2 kHz, feedback 0.3): the rolling echo of open country.
     * The returns glide with the probe, so walking out of a canyon into a park opens a
     * shot's tail over a second or two.
     *
     * PLACING A ONE-SHOT (soundShade, used by playSample with a position, crashes and
     * the siren): the direct sound loses its top with distance (air absorption: 20 kHz
     * close, about 6 kHz at 700 units, 3 kHz at 2,000) and, when a building or a hill
     * stands between it and the ear (a ray through the building grid, cached per source
     * for a quarter second), it is muffled to a thud (0.22 of the cut-off, 0.55 of the
     * level). The room send is not muffled, and it falls off more slowly than the direct
     * sound, so gunfire round the corner or far off is heard mostly by its echo.
     */
    const acoustics = {
      enclosure: 0,
      open: 1,
      tall: 0,
      wallDistance: 280,
      relief: 0,
      lift: 0,
      county: 0,
      cover: 0,
      // The player's engine into the room under cover (a tunnel's boom).
      engineTap: null,
      // Where the smoothed values last glided from (a teleport snaps them).
      probeX: 1e9,
      probeY: 1e9,
      returns: null,
      // The last probe (targets the smoothed values above glide to).
      probe: { enclosure: 0, tall: 0, wallDistance: 280, relief: 0, lift: 0, county: 0, cover: 0, x: 1e9, y: 1e9, at: -1, rays: 0 },
      // The place round the ear, for the ambience beds (ambience-beds.js).
      zone: { district: '', city: 0, harbour: 0, green: 0, country: 0, mountain: 0, monarch: 0, beach: 0, ground: 0, lake: 1e9 },
      stats: { placed: 0, occluded: 0, rays: 0 },
    };
    // Audio-only randomness: never the game's seeded sequence (game-state.js seededRandom),
    // so whether the sound is on never changes what happens in the world.
    const sfxRandom = (lo, hi) => lo + Math.random() * (hi - lo);
    // How much of a room each kind of cover makes (air-cover.js overheadCover kinds): an
    // awning, a canopy or a bus shelter (any kind not listed) hardly any, the underpass, a
    // garage or MONARCH MOTORS' showroom a hard-walled box.
    const COVER_ROOM = { underpass: 1, building: 1, garage: 1, 'garage office': 1, roof: 0.8, railway: 0.6, bridge: 0.6 },
      PROBE_STEPS = [36, 80, 140, 210, 280],
      PROBE_DIRS = 8,
      PROBE_REACH = 320;
    /* The room's returns: the convolver's wet, the canyon slap and the open-country echo. */
    function buildRoom() {
      reverbSend = audio.createGain();
      const reverbWet = audio.createGain();
      reverbWet.gain.value = 0.2;
      reverbSend.connect(reverb);
      reverb.connect(reverbWet).connect(master);
      const lowpass = (f) => {
        const n = audio.createBiquadFilter();
        n.type = 'lowpass';
        n.frequency.value = f;
        n.Q.value = 0.5;
        return n;
      };
      // A feedback delay: in -> delay -> filter -> (feedback -> delay) and -> out.
      const tap = (seconds, cutoff, feedback, out) => {
        const delay = audio.createDelay(1.5),
          filter = lowpass(cutoff),
          back = audio.createGain();
        delay.delayTime.value = seconds;
        back.gain.value = feedback;
        reverbSend.connect(delay);
        delay.connect(filter);
        filter.connect(back).connect(delay);
        if (out) filter.connect(out);
        return { delay, filter, back };
      };
      const slapWet = audio.createGain(),
        merge = audio.createChannelMerger(2);
      slapWet.gain.value = 0;
      merge.connect(slapWet).connect(master);
      const slapL = tap(0.07, 3400, 0.28, null),
        slapR = tap(0.096, 3400, 0.25, null);
      // One side each of the merger: the flutter moves between the ears.
      slapL.filter.connect(merge, 0, 0);
      slapR.filter.connect(merge, 0, 1);
      const echoWet = audio.createGain();
      echoWet.gain.value = 0;
      const echo = tap(0.45, 1200, 0.3, echoWet);
      echoWet.connect(master);
      acoustics.returns = { reverbWet, slapWet, slapL, slapR, echoWet, echo };
    }
    /* A building wall at (x, y) standing higher than `above` over its ground. */
    function earWallAt(x, y, above) {
      const list = buildingsNear(x, y);
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h && b.height > above) return b;
      }
      return null;
    }
    /* What the place round the ear sounds like (see ACOUSTICS). Allocates nothing. */
    function earProbe(ear) {
      const p = acoustics.probe,
        z = entityElevation(player),
        ground = terrainHeight(ear.x, ear.y),
        lift = player.car ? 0 : Math.max(0, z - ground),
        above = lift + 16;
      let sum = 0,
        hits = 0,
        dist = 0,
        height = 0;
      for (let k = 0; k < PROBE_DIRS; k++) {
        const a = (k * TAU) / PROBE_DIRS,
          dx = Math.cos(a),
          dy = Math.sin(a);
        for (let s = 0; s < PROBE_STEPS.length; s++) {
          const step = PROBE_STEPS[s],
            b = earWallAt(ear.x + dx * step, ear.y + dy * step, above);
          if (b) {
            sum += 1 - step / PROBE_REACH;
            hits++;
            dist += step;
            height += b.height - lift;
            break;
          }
        }
      }
      acoustics.stats.rays += PROBE_DIRS;
      // Under a deck or a roof (the Northbank underpass, a garage, a station canopy, a
      // bridge over the water): a concrete box, close and loud.
      const cover = overheadCover(ear.x, ear.y, z);
      p.cover = cover ? COVER_ROOM[cover.kind] ?? 0.25 : 0;
      p.enclosure = Math.max(clamp(sum / PROBE_DIRS / 0.42, 0, 1), p.cover * 0.85);
      p.wallDistance = hits ? dist / hits : PROBE_REACH;
      if (p.cover) p.wallDistance = Math.min(p.wallDistance, 70);
      p.tall = hits ? clamp(height / hits / 400, 0, 1) : 0;
      p.lift = lift;
      p.rays = hits;
      // Hills: how far the ground 500 units off rises or falls from here.
      let relief = 0;
      if (terrainFieldAt(ear.x, ear.y) || ear.x > CITY_SIZE || ear.y > CITY_SIZE)
        for (let k = 0; k < 6; k++) {
          const a = (k * TAU) / 6;
          relief = Math.max(relief, Math.abs(terrainHeight(ear.x + Math.cos(a) * 500, ear.y + Math.sin(a) * 500) - ground));
        }
      p.relief = clamp(relief / 160, 0, 1);
      p.x = ear.x;
      p.y = ear.y;
      p.at = gameTime;
      earZone(ear, ground);
    }
    /* The zone weights (0..1 each) the ambience beds cross-fade by. */
    function earZone(ear, ground) {
      const zone = acoustics.zone,
        x = ear.x,
        y = ear.y,
        district = districtAt(x, y) || '',
        monarch = onMonarchIsle(x, y) || /^MONARCH|^ROYAL BOTANIC|^THE CRESCENT|^CROWN AVENUE|^REGENCY|^WESTGATE|^SOVEREIGN SOUND/.test(district),
        // Monarch Isle lies east of the city frame too, but it is no county.
        county = !monarch && (!!countyRegionAt(x, y) || (x > CITY_SIZE && landAt(x, y))),
        town = county && COUNTY_TOWNS.some((t) => x > t.x - 180 && x < t.x + 1200 && y > t.y - 180 && y < t.y + 1200);
      acoustics.probe.county = county && !town ? 1 : 0;
      zone.district = district;
      zone.monarch = monarch ? 1 : 0;
      zone.city = !county && !monarch && inCityGrid(x, y) ? 1 : town ? 0.35 : monarch ? 0.25 : 0;
      zone.harbour = /DOCKS|MARINA|CRUISE TERMINAL|HARBOUR|HARBOR/.test(district) ? 1 : 0;
      zone.green =
        parkAt(x, y) || district === 'ROYAL BOTANIC GARDEN' || district === 'CENTRAL GARDEN'
          ? 1
          : county && !town && ground < TERRAIN_TREELINE
            ? 0.8
            : 0;
      zone.country = county && !town ? 1 : 0;
      zone.mountain = clamp((ground - 90) / 330, 0, 1);
      zone.beach = onBeach(x, y) || district === 'MONARCH BEACH' || district === 'PALM KEYS BEACH' ? 1 : 0;
      zone.ground = ground;
      // The nearest reservoir's shore (frogs at night): its centre is close enough.
      let lake = 1e9;
      for (const r of COUNTY_LAKES) {
        const b = r.bounds || regionBounds(r);
        lake = Math.min(lake, Math.hypot(clamp(x, b.minx, b.maxx) - x, clamp(y, b.miny, b.maxy) - y));
      }
      zone.lake = lake;
    }
    function regionBounds(r) {
      regionContains(r, r.polygon[0][0], r.polygon[0][1]);
      return r.bounds;
    }
    /* Per frame: probe now and then, glide the smoothed values and the room's returns. */
    function updateAcoustics(deltaSeconds) {
      if (!audio) return;
      const ear = player.car || player,
        p = acoustics.probe;
      if (gameTime - p.at > 0.33 || gameTime < p.at || Math.abs(ear.x - p.x) + Math.abs(ear.y - p.y) > 60) earProbe(ear);
      // A teleport (or the first probe) snaps; walking about glides over about a second.
      const jump = Math.abs(acoustics.probeX - p.x) + Math.abs(acoustics.probeY - p.y) > 400,
        k = jump ? 1 : 1 - Math.exp(-deltaSeconds / 0.8);
      acoustics.probeX = p.x;
      acoustics.probeY = p.y;
      acoustics.enclosure += (p.enclosure - acoustics.enclosure) * k;
      acoustics.tall += (p.tall - acoustics.tall) * k;
      acoustics.wallDistance += (p.wallDistance - acoustics.wallDistance) * k;
      acoustics.relief += (p.relief - acoustics.relief) * k;
      acoustics.lift += (p.lift - acoustics.lift) * k;
      acoustics.county += (p.county - acoustics.county) * k;
      acoustics.cover += (p.cover - acoustics.cover) * (jump ? 1 : 1 - Math.exp(-deltaSeconds / 0.35));
      acoustics.open = 1 - acoustics.enclosure;
      const r = acoustics.returns;
      if (!r) return;
      const now = audio.currentTime;
      if (!acoustics.engineTap && engineAudio?.out && reverbSend) {
        acoustics.engineTap = audio.createGain();
        acoustics.engineTap.gain.value = 0;
        engineAudio.out.connect(acoustics.engineTap).connect(reverbSend);
      }
      if (acoustics.engineTap) glideParam(acoustics.engineTap.gain, 0.45 * acoustics.cover, now, 0.3);
      const
        e = acoustics.enclosure,
        // Two round trips to the walls at the speed of sound (343 m/s = 2,744 units/s).
        slap = clamp((2 * acoustics.wallDistance) / 2744, 0.035, 0.16),
        county = acoustics.county,
        echoDelay = county > 0.5 ? 0.4 + 0.25 * acoustics.relief : 0.26,
        echoLevel = acoustics.open * (county > 0.5 ? 0.3 + 0.7 * acoustics.relief : 0.5) * (acoustics.lift > 200 ? 0.6 : 1);
      glideParam(r.reverbWet.gain, 0.1 + e * (0.1 + 0.08 * acoustics.tall) + 0.03 * (1 - county), now, 0.5);
      glideParam(r.slapWet.gain, 0.3 * e * e, now, 0.5);
      glideParam(r.slapL.delay.delayTime, slap, now, 1.2);
      glideParam(r.slapR.delay.delayTime, slap * 1.37, now, 1.2);
      glideParam(r.echoWet.gain, 0.2 * echoLevel, now, 0.6);
      glideParam(r.echo.delay.delayTime, echoDelay, now, 2);
    }
    /**
     * OCCLUSION
     * Does a building (or, out of town, a hill) stand between the ear and a sound at
     * `position`? The segment is tested against the building grid cells its bounding box
     * covers (each block once, citylife-police.js sightBlockedBy), like clearSight but
     * with no allocation and without the low clutter lists.
     */
    let earStamp = 0;
    function earBlocked(position) {
      const start = entityElevation(player) + 14,
        end = (position.elevation ?? entityElevation(position)) + 14,
        ax = player.car ? player.car.x : player.x,
        ay = player.car ? player.car.y : player.y,
        dx = position.x - ax,
        dy = position.y - ay,
        dz = end - start;
      acoustics.stats.rays++;
      if (ax > CITY_SIZE || position.x > CITY_SIZE || ay > CITY_SIZE || position.y > CITY_SIZE) {
        const steps = Math.min(24, Math.max(1, Math.ceil(Math.hypot(dx, dy) / 48)));
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          if (terrainHeight(ax + dx * t, ay + dy * t) > start + dz * t + 8) return true;
        }
      }
      if (!buildingGrid.size) return false;
      const stamp = ++earStamp,
        x0 = Math.floor((Math.min(ax, position.x) - 8) / BUILDING_CELL),
        x1 = Math.floor((Math.max(ax, position.x) + 8) / BUILDING_CELL),
        y0 = Math.floor((Math.min(ay, position.y) - 8) / BUILDING_CELL),
        y1 = Math.floor((Math.max(ay, position.y) + 8) / BUILDING_CELL);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 49) return false;
      for (let i = x0; i <= x1; i++)
        for (let j = y0; j <= y1; j++) {
          const cell = buildingGrid.get(i * 4096 + j);
          if (!cell) continue;
          for (const block of cell) {
            if (block.earStamp === stamp) continue;
            block.earStamp = stamp;
            if (sightBlockedBy(block, ax, ay, start, dx, dy, dz)) return true;
          }
        }
      return false;
    }
    /* Air absorption: the direct sound's low-pass cut-off at `distance` map units. */
    function airCutoff(distance) {
      return clamp(20000 / (1 + distance / 330), 1500, 20000);
    }
    const shadeCache = new WeakMap(),
      shadeOut = { cutoff: 20000, gain: 1, occluded: false };
    /* The direct sound's cut-off and level for a source at `position` (see ACOUSTICS). */
    function soundShade(position, distance) {
      let occluded = false;
      if (position && distance > 40 && distance < 1800 && gameMode === 'play') {
        const cached = shadeCache.get(position);
        if (cached && gameTime - cached.at < 0.25 && gameTime >= cached.at) occluded = cached.value;
        else {
          occluded = earBlocked(position);
          if (cached) {
            cached.at = gameTime;
            cached.value = occluded;
          } else shadeCache.set(position, { at: gameTime, value: occluded });
        }
      }
      acoustics.stats.placed++;
      if (occluded) acoustics.stats.occluded++;
      shadeOut.occluded = occluded;
      shadeOut.cutoff = airCutoff(distance) * (occluded ? 0.22 : 1);
      shadeOut.gain = occluded ? 0.55 : 1;
      return shadeOut;
    }
    /* A positioned one-shot's send to the room: falls off slower than the direct sound. */
    function roomSendLevel(distance) {
      return 1 / (1 + distance / 700);
    }
    // Console (DeadEndCity.acoustics): the probe, the zone and the room's returns; with a
    // map point, how a sound there reaches the ear (`at`: distance, occluded, cut-off, gain).
    function acousticsReport(x, y) {
      let at = null;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        const point = { x, y },
          distance = distanceBetween(point, player),
          occluded = distance > 40 && earBlocked(point);
        at = { x, y, distance: Math.round(distance), occluded, cutoff: Math.round(airCutoff(distance) * (occluded ? 0.22 : 1)), roomSend: +roomSendLevel(distance).toFixed(3) };
      }
      const r = acoustics.returns,
        p = acoustics.probe,
        z = acoustics.zone,
        f = (v, n = 3) => +v.toFixed(n);
      return {
        enclosure: f(acoustics.enclosure),
        open: f(acoustics.open),
        tall: f(acoustics.tall),
        wallDistance: Math.round(acoustics.wallDistance),
        relief: f(acoustics.relief),
        lift: Math.round(acoustics.lift),
        county: f(acoustics.county),
        cover: f(acoustics.cover),
        engineRoom: acoustics.engineTap ? f(acoustics.engineTap.gain.value) : 0,
        probe: { enclosure: f(p.enclosure), walls: p.rays, cover: p.cover, wallDistance: Math.round(p.wallDistance), relief: f(p.relief), lift: Math.round(p.lift), county: p.county },
        zone: { district: z.district, city: z.city, harbour: z.harbour, green: z.green, country: z.country, mountain: f(z.mountain), monarch: z.monarch, beach: z.beach, ground: Math.round(z.ground), lake: Math.round(Math.min(z.lake, 99999)) },
        returns: r
          ? {
              reverb: f(r.reverbWet.gain.value),
              slap: f(r.slapWet.gain.value),
              slapMs: Math.round(r.slapL.delay.delayTime.value * 1000),
              echo: f(r.echoWet.gain.value),
              echoMs: Math.round(r.echo.delay.delayTime.value * 1000),
            }
          : null,
        stats: { ...acoustics.stats },
        bullets: bulletAudioReport(),
        at,
      };
    }
