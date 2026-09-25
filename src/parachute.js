    // BEGIN SUBSYSTEM: src/parachute.js — Bailout and parachute
    /**
     * Bailout and parachute
     * Source: src/parachute.js
     * Scope: shared game closure.
     * Aircraft exit, freefall, canopy controls, landing and water rescue.
     */
    /* Deliberate bailout, freefall, steerable canopy and safe ground transitions. */
    // Belly-to-earth freefall at about 50 m/s; the canopy opens itself 85 m up
    // (it takes a second to open and some 35 m to bite).
    const PARACHUTE_TERMINAL = 50 * UNITS_PER_METRE,
      PARACHUTE_AUTO_OPEN = 85 * UNITS_PER_METRE;
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
      };
      player.inv = 1;
      c.throttle = 0;
      c.ai = false;
      c.abandonedFlight = true;
      clearTouchInput();
      keys = {};
      mouse.down = false;
      if (requiredAircraft)
        failMission(
          passenger
            ? 'You left Daniel aboard. Retry the mission to bring him safely home.'
            : 'You abandoned the aircraft needed for this mission.',
        );
      tell(
        'PARACHUTE · ' + keyName('handbrake') + ' to open · ' + keyName('left') + '/' + keyName('right') + ' steer · ' +
          keyName('forward') + ' glide · ' + keyName('back') + ' flare · Opens automatically near ground',
        7,
      );
      if (aircraftClearance(c) < PARACHUTE_AUTO_OPEN) deployParachute();
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
      parachuteOpeningSound();
      tell('CANOPY OPEN · Steer toward clear ground · Hold S to slow your landing', 4);
      return true;
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
      const water = !groundAt(player.x, player.y);
      // Down in the sea within swimming distance of a way out: swim for it (water.js).
      if (water && parachuteSplashdown()) return;
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
      else announce('BACK ON THE GROUND', 'SAFE LANDING', 2.5);
    }
    function updateParachute(deltaSeconds) {
      const p = player.parachute;
      if (!p) return;
      p.elapsed += deltaSeconds;
      const turn = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
        fast = keys.KeyW || keys.ArrowUp,
        flare = keys.KeyS || keys.ArrowDown;
      p.heading = normalizeAngle(
        p.heading + turn * (p.stage === 'canopy' ? 1.15 : 0.65) * deltaSeconds,
      );
      player.a = p.heading;
      const agl = player.altitude - terrainHeight(player.x, player.y);
      if (p.stage === 'freefall' && (keys.Space || agl < PARACHUTE_AUTO_OPEN)) deployParachute();
      const canopy = p.stage === 'canopy';
      if (canopy) p.opening = Math.min(1, p.opening + deltaSeconds / 1.0);
      // Canopy forward speed: about 15 km/h flared, 31 trimmed, 45 with the risers pulled.
      const speed = (canopy ? (flare ? 15 : fast ? 45 : 31) : 34) * KMH,
        response = 1 - Math.exp(-deltaSeconds * (canopy ? 2.6 : 0.65));
      p.vx += (Math.cos(p.heading) * speed - p.vx) * response;
      p.vy += (Math.sin(p.heading) * speed - p.vy) * response;
      p.vz = canopy
        ? p.vz + ((flare ? -2.1 : -3.5) * UNITS_PER_METRE - p.vz) * (1 - Math.exp(-deltaSeconds * 4 * p.opening))
        : Math.max(-PARACHUTE_TERMINAL, p.vz - GRAVITY * deltaSeconds);
      // Aircraft can fly over open ocean; a bailout keeps that position until landing.
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
          Object.assign(player, spot);
          player.parachute = null;
          player.roof = true;
          player.altitude = ROOFTOP.height + 3;
          player.inv = 1;
          clearTouchInput();
          keys = {};
          announce('THE BLUE HOUR', 'TERRACE LANDING', 2.6);
          tell('Canopy down on the terrace. E at the bar, Mara, or the elevator.', 5);
          // Arriving by canopy in street clothes is not a quiet entrance.
          const hit = rooftopJob();
          if (hit && !hit.disguise) roofAlarm(hit);
          return;
        }
      }
      // Glide past building faces instead of landing inside an inaccessible roof volume.
      for (const b of buildings)
        if (
          !(overTerrace && b.roofBar) &&
          player.altitude < b.height + 18 &&
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
