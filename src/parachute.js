    // BEGIN SUBSYSTEM: src/parachute.js — Bailout and parachute
    /**
     * Bailout and parachute
     * Source: src/parachute.js
     * Scope: shared game closure.
     * Aircraft exit, freefall, canopy controls, landing and water rescue.
     */
    /* Deliberate bailout, freefall, steerable canopy and safe ground transitions. */
    function aircraftClearance(c) {
      return Math.max(0, (c.altitude || 0) - terrainHeight(c.x, c.y));
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
        'PARACHUTE · Space to open · A/D steer · W glide · S flare · Opens automatically near ground',
        7,
      );
      if (aircraftClearance(c) < 240) deployParachute();
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
      tell('CANOPY OPEN · Steer toward clear ground · Hold S to slow your landing', 4);
      return true;
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
      if (p.stage === 'freefall' && (keys.Space || agl < 230)) deployParachute();
      const canopy = p.stage === 'canopy';
      if (canopy) p.opening = Math.min(1, p.opening + deltaSeconds / 0.7);
      const speed = canopy ? (flare ? 33 : fast ? 100 : 70) : 75,
        response = 1 - Math.exp(-deltaSeconds * (canopy ? 2.6 : 0.65));
      p.vx += (Math.cos(p.heading) * speed - p.vx) * response;
      p.vy += (Math.sin(p.heading) * speed - p.vy) * response;
      p.vz = canopy
        ? p.vz + ((flare ? -17 : -28) - p.vz) * (1 - Math.exp(-deltaSeconds * 4 * p.opening))
        : Math.max(-200, p.vz - 65 * deltaSeconds);
      // Aircraft can fly over open ocean; a bailout keeps that position until landing.
      player.x += p.vx * deltaSeconds;
      player.y += p.vy * deltaSeconds;
      player.altitude += p.vz * deltaSeconds;
      // Glide past building faces instead of landing inside an inaccessible roof volume.
      for (const b of buildings)
        if (
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
