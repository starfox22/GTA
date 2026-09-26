    // BEGIN SUBSYSTEM: src/parachute.js — Bailout and parachute
    /**
     * Bailout and parachute
     * Source: src/parachute.js
     * Scope: shared game closure.
     * Aircraft exit, freefall, canopy controls, landing and water rescue.
     */
    /* Deliberate bailout, freefall, a canopy the jumper must open, steering and landings.
       Nothing opens by itself: after the jump the bail action (J) pressed again,
       once it has been let go, pulls the ripcord. Leave it and the jumper meets the
       ground at freefall speed (falls-body.js splatPlayer). The canopy takes
       PARACHUTE_OPEN_SECONDS to inflate; opened from terminal speed it needs about
       55 m to bring the rate down to a safe landing, so opened lower it lands hard
       (playerImpact: hurt, or dead below about 25 m). The freefall cue on screen
       (FREEFALL CUE below) counts the height down and turns red once there is no
       longer room to open. */
    // Belly-to-earth freefall tops out at about 50 m/s; the canopy settles at 3.5 m/s.
    const PARACHUTE_TERMINAL = 50 * UNITS_PER_METRE,
      PARACHUTE_OPEN_SECONDS = 2.4,
      // The slider keeps the opening shock under about 5 g.
      PARACHUTE_OPEN_SHOCK = 5,
      // A descent rate the jumper lands on their feet from (the body scale's 6 m drop is 11 m/s).
      PARACHUTE_SAFE_RATE = 7 * UNITS_PER_METRE;
    // Height above whatever the aircraft would set down on: the ground, or the
    // flat roof under a helicopter (`roofSite`, rooftops.js).
    function aircraftClearance(c) {
      const floor = c.roofSite ? Math.max(c.roofSite.height, terrainHeight(c.x, c.y)) : terrainHeight(c.x, c.y);
      return Math.max(0, (c.altitude || 0) - floor);
    }
    function bailOut() {
      const c = player.car;
      if (gameMode !== 'play' || !isAircraft(c)) return false;
      if (aircraftClearance(c) < 60) {
        tell('Too low to jump. Climb before using the parachute.', 3);
        return false;
      }
      const requiredAircraft = mission?.car === c,
        passenger =
          requiredAircraft && (mission.index === 10 || (mission.index === 9 && mission.witness));
      player.car = null;
      player.roof = false;
      player.x = c.x;
      player.y = c.y;
      player.a = c.a;
      player.altitude = c.altitude;
      player.parachute = {
        stage: 'freefall',
        elapsed: 0,
        opening: 0,
        vx: (c.vx || 0) * 0.55,
        vy: (c.vy || 0) * 0.55,
        vz: -20,
        heading: c.a,
        // The press that jumped does not also open it: the bail action has to be
        // let go first (armed), then pressed again.
        armed: false,
        from: Math.round(worldMeters(aircraftClearance(c))),
      };
      player.inv = 1;
      c.throttle = 0;
      c.ai = false;
      c.abandonedFlight = true;
      clearTouchInput();
      // Every held key is dropped except the bail action itself (game-input.js
      // holds it before jumping), so its release is seen and arms the ripcord.
      const bailHeld = actionHeld('bail');
      keys = {};
      if (bailHeld) keys[actionCode('bail')] = true;
      mouse.down = false;
      if (requiredAircraft)
        failMission(
          passenger
            ? 'You left Daniel aboard. Retry the mission to bring him safely home.'
            : 'You abandoned the aircraft needed for this mission.',
        );
      tell(
        'FREEFALL · ' + keyName('bail') + ' again to open the parachute · ' + keyName('left') + '/' + keyName('right') + ' steer · ' +
          keyName('forward') + ' track · It will not open by itself',
        7,
      );
      if (requiredAircraft)
        tell(
          'JOB FAILED · ' +
            (passenger ? 'Daniel was left aboard.' : 'Required aircraft abandoned.') +
            ' Land safely, then retry from the pause menu.',
          7,
        );
      return true;
    }
    function deployParachute() {
      const p = player.parachute;
      if (!p || p.stage !== 'freefall') return false;
      p.stage = 'canopy';
      p.opening = 0;
      p.openedAt = Math.round(worldMeters(Math.max(0, player.altitude - parachuteFloor(player.x, player.y))));
      parachuteOpeningSound();
      tell('CANOPY OPENING · Steer toward clear ground · Hold ' + keyName('back') + ' to flare and slow your landing', 4);
      return true;
    }
    /* A fresh press of the bail action (a keydown or the touch button): pull the
       ripcord. The press that jumped never gets here (game-input.js jumps first). */
    function openParachuteByHand() {
      const p = player.parachute;
      if (!p || p.stage !== 'freefall') return false;
      return deployParachute();
    }
    // What the jumper would come down on here: the ground, or a building's roof.
    function parachuteRoofAt(x, y) {
      let best = null;
      for (const b of buildingsNear(x, y))
        if (!b.depotWall && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h && (!best || b.height > best.height)) best = b;
      return best;
    }
    function parachuteFloor(x, y) {
      const ground = terrainHeight(x, y),
        roof = parachuteRoofAt(x, y);
      return roof ? Math.max(ground, roof.height) : ground;
    }
    /* Height lost opening the canopy from a fall rate of `rate` (map units a
       second, downward) before it is down to PARACHUTE_SAFE_RATE: about 55 m from
       terminal speed. The same drag the flight uses, stepped ahead. */
    function parachuteOpeningLoss(rate) {
      let fall = Math.max(0, rate),
        lost = 0;
      const dt = 1 / 30;
      for (let t = 0; t < 6 && fall > PARACHUTE_SAFE_RATE; t += dt) {
        fall += parachuteFallAccel(fall, Math.min(1, t / PARACHUTE_OPEN_SECONDS), 3.5 * UNITS_PER_METRE) * dt;
        lost += fall * dt;
      }
      return lost;
    }
    /* Downward acceleration of a jumper falling at `fall` with the canopy
       `opening` (0 in freefall .. 1 open, settling at `rate`): gravity less a
       drag that grows with the square of the speed, the canopy's area coming in
       with the cube of the opening, the shock capped by the slider. */
    function parachuteFallAccel(fall, opening, rate) {
      const ratio = (PARACHUTE_TERMINAL / rate) ** 2,
        terminal = PARACHUTE_TERMINAL / Math.sqrt(1 + (ratio - 1) * opening ** 3);
      return Math.max(-PARACHUTE_OPEN_SHOCK * GRAVITY, GRAVITY * (1 - (fall / terminal) ** 2));
    }
    function roofLandingSpot(x, y) {
      for (let r = 12; r <= 200; r += 12)
        for (let i = 0; i < 24; i++) {
          const q = {
            x: x + Math.cos((i * TAU) / 24) * r,
            y: y + Math.sin((i * TAU) / 24) * r,
          };
          if (roofPointFree(q.x, q.y, 9)) return q;
        }
      return null;
    }
    function parachuteLandingClear(x, y) {
      if (!groundAt(x, y, 10) || solid(x, y, 10)) return false;
      const floor = terrainHeight(x, y);
      return !vehicles.some((c) => {
        const height = isAircraft(c) ? c.altitude || 0 : terrainHeight(c.x, c.y) + (c.altitude || 0);
        return Math.abs(height - floor) < 22 && pointInCar(x, y, c, 10);
      });
    }
    function findParachuteLandingPoint(x, y) {
      if (parachuteLandingClear(x, y))
        return {
          x,
          y,
        };
      for (let r = 20; r <= 1800; r += 20)
        for (let i = 0; i < 32; i++) {
          const q = {
            x: x + Math.cos((i * TAU) / 32) * r,
            y: y + Math.sin((i * TAU) / 32) * r,
          };
          if (parachuteLandingClear(q.x, q.y)) return q;
        }
      return null;
    }
    function parachuteLanding() {
      const p = player.parachute;
      if (!p) return;
      const water = !groundAt(player.x, player.y),
        // What hurts is the rate of descent; a canopy's forward speed is run out.
        into = Math.max(0, -p.vz);
      // Into the sea at freefall speed: as hard as the ground (falls-body.js).
      if (water && fallInjury(into, true) >= player.hp && !player.godMode) {
        player.parachute = null;
        splashAt(player.x, player.y, 3);
        playerImpact(into, 0, p.stage, true);
        return;
      }
      // Down in the sea within swimming distance of a way out: swim for it (water.js).
      if (water && parachuteSplashdown()) {
        playerImpact(into, 0, p.stage, true);
        return;
      }
      if (!water && fallInjury(into) >= player.hp && !player.godMode) {
        // Never opened, or opened far too low: nothing to be done.
        player.parachute = null;
        playerImpact(into, terrainHeight(player.x, player.y), p.stage);
        return;
      }
      let safe = findParachuteLandingPoint(player.x, player.y),
        recovered = false;
      if (!safe) {
        safe = findParachuteLandingPoint(spawn.x, spawn.y);
        recovered = true;
      }
      if (!safe) {
        player.altitude = terrainHeight(player.x, player.y) + 30;
        tell('Landing area blocked. Steer toward clear ground.', 3);
        return;
      }
      Object.assign(player, safe);
      player.parachute = null;
      clearTouchInput();
      player.altitude = terrainHeight(player.x, player.y);
      player.inv = 1;
      keys = {};
      if (recovered) tell('OFFSHORE RESCUE · Returned to South Coast', 5);
      else if (water) tell('WATER LANDING · Recovered at a nearby safe shore', 5);
      else if (playerImpact(into, player.altitude, p.stage) === 'safe') announce('BACK ON THE GROUND', 'SAFE LANDING', 2.5);
      player.inv = Math.max(player.inv, 1);
    }
    function updateParachute(deltaSeconds) {
      const p = player.parachute;
      if (!p) return;
      p.elapsed += deltaSeconds;
      // The ripcord: the bail action let go since the jump, then held again.
      if (!actionHeld('bail')) p.armed = true;
      else if (p.armed && p.stage === 'freefall') deployParachute();
      const turn = (actionHeld('right') ? 1 : 0) - (actionHeld('left') ? 1 : 0),
        fast = actionHeld('forward'),
        flare = actionHeld('back');
      p.heading = normalizeAngle(
        p.heading + turn * (p.stage === 'canopy' ? 1.15 : 0.65) * deltaSeconds,
      );
      player.a = p.heading;
      const canopy = p.stage === 'canopy';
      if (canopy) p.opening = Math.min(1, p.opening + deltaSeconds / PARACHUTE_OPEN_SECONDS);
      // Canopy forward speed: about 15 km/h flared, 31 trimmed, 45 with the risers pulled.
      const speed = (canopy ? (flare ? 15 : fast ? 45 : 31) : 34) * KMH,
        response = 1 - Math.exp(-deltaSeconds * (canopy ? 2.6 * Math.max(0.2, p.opening) : 0.65));
      p.vx += (Math.cos(p.heading) * speed - p.vx) * response;
      p.vy += (Math.sin(p.heading) * speed - p.vy) * response;
      // The fall: gravity against drag, the canopy's share coming in as it inflates.
      const rate = (canopy ? (flare ? 2.1 : fast ? 4.2 : 3.5) : 3.5) * UNITS_PER_METRE,
        fall = Math.max(0, -p.vz);
      p.vz = -Math.max(0, fall + parachuteFallAccel(fall, canopy ? p.opening : 0, rate) * deltaSeconds);
      // Aircraft can fly over open ocean; a bailout keeps that position until landing.
      const wasAltitude = player.altitude;
      player.x += p.vx * deltaSeconds;
      player.y += p.vy * deltaSeconds;
      player.altitude += p.vz * deltaSeconds;
      // The Blue Hour terrace is a real landing zone: come in over the roof line
      // with the canopy open and you put down among the tables instead of being
      // pushed off the parapet like any other building.
      const overTerrace =
        p.stage === 'canopy' &&
        player.x > ROOFTOP.x + 22 &&
        player.x < ROOFTOP.x + ROOFTOP.w - 22 &&
        player.y > ROOFTOP.y + 22 &&
        player.y < ROOFTOP.y + ROOFTOP.h - 22;
      if (overTerrace && player.altitude <= ROOFTOP.height + 4) {
        const spot = roofPointFree(player.x, player.y, 9)
          ? {
              x: player.x,
              y: player.y,
            }
          : roofLandingSpot(player.x, player.y);
        if (spot) {
          const into = Math.max(0, -p.vz);
          Object.assign(player, spot);
          player.parachute = null;
          player.roof = true;
          player.altitude = ROOFTOP.height + 3;
          clearTouchInput();
          keys = {};
          // A canopy opened too late still lands hard, on the terrace as anywhere.
          if (playerImpact(into, player.altitude, 'canopy', false, true) === 'dead') return;
          player.inv = 1;
          announce('THE BLUE HOUR', 'TERRACE LANDING', 2.6);
          tell('Canopy down on the terrace. E at the bar, Mara, or the elevator.', 5);
          // Arriving by canopy in street clothes is not a quiet entrance.
          const hit = rooftopJob();
          if (hit && !hit.disguise) roofAlarm(hit);
          return;
        }
      }
      // Freefall onto a roof: it is the ground as far as the body is concerned.
      if (!canopy) {
        const roof = parachuteRoofAt(player.x, player.y);
        if (roof && player.altitude <= roof.height && wasAltitude > roof.height - 12) {
          player.altitude = roof.height;
          player.parachute = null;
          clearTouchInput();
          if (playerImpact(Math.max(0, -p.vz), roof.height, 'freefall', false, true) === 'dead') return;
          // Survived a short drop onto it: stand on it, as off a helicopter (rooftops.js).
          if (roof.roofBar) {
            player.roof = true;
            player.altitude = ROOFTOP.height + 3;
          } else if (roofLandable(roof) && roofPointFreeOn(roof, player.x, player.y, 8)) player.buildingRoof = roof;
          else {
            // Nowhere to stand up there (plant, a pitched roof): it throws the body off the edge.
            const out = [
              [roof.x - 10, player.y, player.x - roof.x],
              [roof.x + roof.w + 10, player.y, roof.x + roof.w - player.x],
              [player.x, roof.y - 10, player.y - roof.y],
              [player.x, roof.y + roof.h + 10, roof.y + roof.h - player.y],
            ].sort((a, b) => a[2] - b[2])[0];
            player.x = out[0];
            player.y = out[1];
            player.altitude = terrainHeight(player.x, player.y);
          }
          return;
        }
      }
      // Glide past building faces instead of landing inside an inaccessible roof volume.
      for (const b of buildings)
        if (
          !(overTerrace && b.roofBar) &&
          player.altitude < b.height + (canopy ? 18 : 0) &&
          player.x > b.x - 9 &&
          player.x < b.x + b.w + 9 &&
          player.y > b.y - 9 &&
          player.y < b.y + b.h + 9
        ) {
          const sides = [
            {
              d: player.x - b.x,
              x: b.x - 10,
              y: player.y,
            },
            {
              d: b.x + b.w - player.x,
              x: b.x + b.w + 10,
              y: player.y,
            },
            {
              d: player.y - b.y,
              x: player.x,
              y: b.y - 10,
            },
            {
              d: b.y + b.h - player.y,
              x: player.x,
              y: b.y + b.h + 10,
            },
          ].sort((a, b) => a.d - b.d);
          player.x = sides[0].x;
          player.y = sides[0].y;
          p.vx *= 0.6;
          p.vy *= 0.6;
        }
      if (player.altitude <= terrainHeight(player.x, player.y) + 1) parachuteLanding();
    }
    /**
     * FREEFALL CUE
     * While the canopy is still packed: a call to open it with the key that does
     * (keyName('bail'), the touch button's name on a touch screen), the height
     * above whatever is below, and a bar of that height against what opening
     * takes from the current fall rate (parachuteOpeningLoss). It pulses; under
     * the room needed to open (with a little margin) it turns red and pulses
     * fast. Hidden the moment the ripcord is pulled.
     */
    const freefallCue = { shown: false, state: '', key: '', altitude: -1 };
    function parachuteCueState() {
      const p = player.parachute;
      if (!p || p.stage !== 'freefall' || gameMode !== 'play') return null;
      const agl = Math.max(0, player.altitude - parachuteFloor(player.x, player.y)),
        need = parachuteOpeningLoss(-p.vz);
      return {
        agl,
        need,
        state: agl < need + 4 * UNITS_PER_METRE ? 'danger' : agl < need * 2 + 20 * UNITS_PER_METRE ? 'soon' : 'high',
      };
    }
    function updateFreefallCue() {
      const cue = parachuteCueState(),
        root = getElement('freefallCue');
      if (!root) return;
      if (!cue) {
        if (freefallCue.shown) {
          freefallCue.shown = false;
          root.classList.remove('on');
        }
        return;
      }
      if (!freefallCue.shown) {
        freefallCue.shown = true;
        root.classList.add('on');
      }
      const key = touchEnabled() ? 'TAP OPEN' : keyName('bail');
      if (key !== freefallCue.key) {
        freefallCue.key = key;
        getElement('freefallKey').textContent = key;
        getElement('freefallCall').textContent = touchEnabled() ? 'TO OPEN PARACHUTE' : 'PRESS ' + key + ' TO OPEN PARACHUTE';
      }
      if (cue.state !== freefallCue.state) {
        freefallCue.state = cue.state;
        root.dataset.state = cue.state;
        getElement('freefallNote').textContent = cue.state === 'danger' ? 'TOO LOW · OPEN NOW' : cue.state === 'soon' ? 'OPEN SOON' : 'FREEFALL';
      }
      const metres = Math.round(worldMeters(cue.agl));
      if (metres !== freefallCue.altitude) {
        freefallCue.altitude = metres;
        getElement('freefallAlt').textContent = metres;
      }
      // The bar: height left against three times the room needed; the mark is that room.
      const full = Math.max(cue.need * 3, 60 * UNITS_PER_METRE);
      root.style.setProperty('--ff-left', clamp(cue.agl / full, 0, 1).toFixed(3));
      root.style.setProperty('--ff-need', clamp(cue.need / full, 0, 1).toFixed(3));
    }
    /* ---- Sound ------------------------------------------------------------------
       Freefall is loud: a roar of wind that rises with the fall rate, buffeting
       and flapping the jumpsuit. Under the canopy it drops to the flutter of the
       wing's tail. One looping band of noise does both through a band-pass whose
       gain, centre and wobble follow the stage; the opening is a rustle of the
       bag, the crack of the slider and the thump of the canopy taking the load. */
    let chuteWindSource = null,
      chuteWindGain = null,
      chuteWindFilter = null;
    function startParachuteWind() {
      const seconds = 2.5,
        n = Math.floor(audio.sampleRate * seconds),
        buffer = audio.createBuffer(1, n, audio.sampleRate),
        data = buffer.getChannelData(0);
      let low = 0,
        mid = 0;
      for (let i = 0; i < n; i++) {
        const white = Math.random() * 2 - 1;
        low = low * 0.97 + white * 0.03;
        mid = mid * 0.7 + white * 0.3;
        data[i] = low * 5 + mid * 0.8;
      }
      const fade = Math.floor(audio.sampleRate * 0.2);
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        data[i] = data[i] * t + data[n - fade + i] * (1 - t);
      }
      chuteWindSource = audio.createBufferSource();
      chuteWindGain = audio.createGain();
      chuteWindFilter = audio.createBiquadFilter();
      chuteWindSource.buffer = buffer;
      chuteWindSource.loop = true;
      chuteWindFilter.type = 'bandpass';
      chuteWindFilter.Q.value = 0.7;
      chuteWindFilter.frequency.value = 600;
      chuteWindGain.gain.value = 0;
      chuteWindSource.connect(chuteWindFilter).connect(chuteWindGain).connect(ambienceBus);
      chuteWindSource.start();
    }
    function updateParachuteWind() {
      if (!audio || !master) return;
      const p = player.parachute;
      if (!chuteWindSource) {
        if (!p || !soundOn) return;
        startParachuteWind();
      }
      const now = audio.currentTime;
      let level = 0,
        centre = 500;
      if (p && soundOn && gameMode === 'play') {
        if (p.stage === 'freefall') {
          const rate = clamp(-p.vz / PARACHUTE_TERMINAL, 0, 1);
          // Buffeting: the level and colour wander a few times a second.
          const buffet = 0.8 + 0.2 * Math.sin(gameTime * 7.3) * Math.sin(gameTime * 3.1 + 1);
          level = (0.08 + rate * 0.3) * buffet;
          centre = 380 + rate * 900 + Math.sin(gameTime * 5.7) * 120;
        } else {
          // The tail flutters; the brakes and speed change its pitch.
          const flap = 0.75 + 0.25 * Math.sin(gameTime * 23) * Math.sin(gameTime * 4.3);
          level = 0.05 * flap * (0.5 + 0.5 * p.opening);
          centre = 900 + Math.hypot(p.vx, p.vy) * 4;
        }
      }
      chuteWindGain.gain.setTargetAtTime(level, now, 0.12);
      chuteWindFilter.frequency.setTargetAtTime(centre, now, 0.1);
    }
    function parachuteOpeningSound() {
      if (!audio || !soundOn) return;
      // Bag off the back and the lines paying out...
      noise(0.35, 0.12, 2400);
      // ...the slider cracks down and the canopy takes the load.
      setTimeout(() => {
        if (player.parachute) {
          noise(0.18, 0.26, 900);
          tone(70, 0.3, 0.3, 'sine', 42);
        }
      }, 520);
      setTimeout(() => {
        if (player.parachute) noise(0.4, 0.1, 500);
      }, 760);
    }
    function drawParachute2D() {
      const p = player.parachute;
      if (!p || p.stage !== 'canopy') return;
      worldContext.save();
      worldContext.strokeStyle = '#ddd9bc';
      worldContext.lineWidth = 1;
      for (const side of [-1, 1]) {
        worldContext.beginPath();
        worldContext.moveTo(player.x + side * 3, player.y);
        worldContext.lineTo(player.x + side * 27, player.y - 37);
        worldContext.stroke();
      }
      worldContext.fillStyle = '#df8659';
      worldContext.beginPath();
      worldContext.ellipse(player.x, player.y - 39, 34 * p.opening, 15 * p.opening, 0, Math.PI, TAU);
      worldContext.lineTo(player.x + 34 * p.opening, player.y - 35);
      worldContext.lineTo(player.x - 34 * p.opening, player.y - 35);
      worldContext.closePath();
      worldContext.fill();
      worldContext.strokeStyle = '#efd8ad';
      worldContext.stroke();
      worldContext.restore();
    }
    // END SUBSYSTEM: src/parachute.js
