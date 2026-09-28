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
       ground at freefall speed (falls-body.js splatPlayer). A pull is not an open
       canopy: the deployment runs in real stages (DEPLOYMENT below) and from
       terminal speed takes about 4.7 s and 200 m, so it has to be timed. Opened too
       low, the jumper meets the ground still fast (playerImpact: hurt, or dead).
       The freefall cue on screen (FREEFALL CUE below) counts the height down against
       the height the opening needs from the current fall rate, calls OPEN SOON and
       OPEN NOW in time, and then follows the opening until the canopy flies. */
    // Belly-to-earth freefall tops out at about 54 m/s (120 mph); the canopy settles at 3.5 m/s.
    const PARACHUTE_TERMINAL = 54 * UNITS_PER_METRE,
      /* DEPLOYMENT, from the pull (a ram-air sport main, seconds):
           pilot   0.8   the hand goes to the pouch and throws the pilot chute, which
                         inflates in the burble, stretches the bridle, pulls the
                         closing pin and lifts the bag off the container;
           lines   1.0   the bag leaves the container and the lines pay out of their
                         stows; line stretch (1.8 s after the pull) snatches the
                         jumper upright;
           snivel  1.1-2 out of the bag, the canopy snivels: the slider at the top of the
                         lines holds it half closed while the cells pressurise from the
                         centre out (1.1 s pulled from rest, 2 s at terminal speed);
           snap    0.9   the slider runs down the lines, the end cells fill and the
                         canopy takes the load: the opening shock builds to a peak
                         under 4 g (PARACHUTE_OPEN_SHOCK, soft) rather than a bang.
         Measured at 30 Hz (tools/tests/parachute-deploy.mjs), pulled at 54 m/s: line
         stretch 1.8 s / 95 m after the pull (pilot 45 m, bag and lines 50 m), out of
         the snivel at 3.8 s / 183 m still falling 30 m/s, flying at 4.7 s and 200 m
         at 7 m/s after a 3.8 g peak; pulled at 30 m/s 4.3 s / 138 m; pulled at a few
         m/s (straight off a hovering helicopter) 3.8 s / 57 m. Once it flies, the
         canopy is on its deployment brakes (PARACHUTE_BRAKES_SET) until the jumper
         unstows the toggles, and then surges forward to trim speed. */
      PARACHUTE_DEPLOY = { pilot: 0.8, lines: 1, snivel: 1.1, snivelFast: 0.9, snap: 0.9 },
      PARACHUTE_PHASES = ['pilot', 'lines', 'snivel', 'snap'],
      // Drag area, in multiples of the freefall body's, at the end of each stage.
      PARACHUTE_DEPLOY_DRAG = { pilot: 1.25, lines: 1.4, snivel: 12 },
      // The snatch of line stretch: extra drag for the first moments of the snivel.
      PARACHUTE_SNATCH = 0.9,
      // The slider spreads the opening shock: the load (g in the harness) eases towards this and never passes it.
      PARACHUTE_OPEN_SHOCK = 3.8,
      // Flying on the deployment brakes: seconds before the toggles are unstowed (or the first steer or flare).
      PARACHUTE_BRAKES_SET = 1.4,
      // A descent rate the jumper lands on their feet from (the body scale's 6 m drop is 11 m/s).
      PARACHUTE_SAFE_RATE = 7 * UNITS_PER_METRE,
      /* The freefall cue's lines, in seconds of fall at the current rate above the
         height the opening needs (with a floor in metres for slow falls): OPEN SOON,
         then OPEN NOW (still room for a full opening), then TOO LOW (none left). */
      PARACHUTE_CUE_SOON = [4, 40],
      PARACHUTE_CUE_NOW = [1.5, 15],
      PARACHUTE_CUE_LATE = [0, 2];
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
        'FREEFALL · ' + keyName('bail') + ' again to open the parachute · It will not open by itself, and opening takes about ' +
          Math.round(worldMeters(parachuteForecast(PARACHUTE_TERMINAL).need) / 10) * 10 + ' m at full speed · ' +
          keyName('left') + '/' + keyName('right') + ' steer · ' + keyName('forward') + ' track',
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
    /* The ripcord: `stage` becomes 'canopy' for good (no second opening), and the
       deployment runs from here: `deploy` seconds since the pull, `phase` (pilot,
       lines, snivel, snap, open) with `phaseK` 0..1 through it, `opening` the
       canopy's inflation (0 in the bag .. 1 flying), `pullRate` the fall rate at
       the pull (it sets the snivel), `load` the g felt in the harness; once it
       flies, `flown` seconds since and `brakesSet` while it is still on its
       deployment brakes; `safeLost`/`safeTime` the height and time from the pull
       to PARACHUTE_SAFE_RATE, the point parachuteForecast() counts to. */
    function deployParachute() {
      const p = player.parachute;
      if (!p || p.stage !== 'freefall') return false;
      p.stage = 'canopy';
      p.deploy = 0;
      p.phase = 'pilot';
      p.phaseK = 0;
      p.opening = 0;
      p.pullRate = Math.max(0, -p.vz);
      p.load = p.peakLoad = 1;
      p.openedAt = Math.round(worldMeters(Math.max(0, player.altitude - parachuteFloor(player.x, player.y))));
      p.openAt = p.openTime = p.openLost = p.safeLost = p.safeTime = null;
      p.flown = 0;
      p.brakesSet = true;
      p.pullAltitude = player.altitude;
      parachutePhaseSound('pilot');
      return true;
    }
    /* Deployment stage `t` seconds after a pull at `pullRate` (map units a second,
       downward), written into `out` as { phase, phaseK }; 'open' once it is done. */
    function parachuteDeployPhase(t, pullRate, out) {
      const d = PARACHUTE_DEPLOY,
        snivel = d.snivel + d.snivelFast * clamp(pullRate / PARACHUTE_TERMINAL, 0, 1);
      let start = 0;
      for (let i = 0; i < 4; i++) {
        const length = i === 0 ? d.pilot : i === 1 ? d.lines : i === 2 ? snivel : d.snap;
        if (t < start + length) {
          out.phase = PARACHUTE_PHASES[i];
          out.phaseK = Math.max(0, t - start) / length;
          return out;
        }
        start += length;
      }
      out.phase = 'open';
      out.phaseK = 1;
      return out;
    }
    /* Drag area of the jumper and whatever is out, in multiples of the freefall
       body's, at `k` through `phase` ('freefall' is the body alone); open, the
       canopy's settles the descent at `rate`. The pilot chute and bag add a little,
       line stretch snatches, the snivelling canopy grows it several times over as the
       cells pressurise, the slider's run down the lines the rest. */
    function parachuteDragArea(phase, k, rate) {
      const drag = PARACHUTE_DEPLOY_DRAG,
        full = (PARACHUTE_TERMINAL / rate) ** 2,
        ease = k * k * (3 - 2 * k);
      if (phase === 'pilot') return 1 + (drag.pilot - 1) * ease;
      if (phase === 'lines') return drag.pilot + (drag.lines - drag.pilot) * k;
      if (phase === 'snivel')
        return drag.lines * (drag.snivel / drag.lines) ** (k ** 1.5) + PARACHUTE_SNATCH * Math.exp(-((k * 8) ** 2));
      if (phase === 'snap') return drag.snivel * (full / drag.snivel) ** ease;
      if (phase === 'open') return full;
      return 1;
    }
    // How far the canopy is inflated (0 in the bag .. 1 flying): the drawing, steering and wind read it.
    function parachuteInflation(phase, k) {
      if (phase === 'snivel') return 0.3 * k ** 1.3;
      if (phase === 'snap') return 0.3 + 0.7 * k * k * (3 - 2 * k);
      return phase === 'open' ? 1 : 0;
    }
    // The canopy's settled descent rate for the brakes held: flared, trimmed, risers pulled.
    function parachuteSinkRate() {
      return (actionHeld('back') ? 2.1 : actionHeld('forward') ? 4.2 : 3.5) * UNITS_PER_METRE;
    }
    /* Height the canopy still needs (map units), stepping the deployment on from
       `deploy` seconds after a pull at `pullRate` (a pull now if still packed),
       falling at `fall`, until it is out of the snivel with the descent down to
       PARACHUTE_SAFE_RATE; and how many seconds that takes. The same steps the
       flight uses at the console's 30 Hz. */
    const parachuteForecastPhase = { phase: '', phaseK: 0 };
    function parachuteForecast(fall, deploy = 0, pullRate = fall, rate = 3.5 * UNITS_PER_METRE) {
      const dt = 1 / 30;
      let lost = 0,
        t = deploy,
        fallRate = Math.max(0, fall);
      for (let i = 0; i < 600; i++) {
        t += dt;
        const s = parachuteDeployPhase(t, pullRate, parachuteForecastPhase);
        fallRate = Math.max(0, fallRate + parachuteFallAccel(fallRate, parachuteDragArea(s.phase, s.phaseK, rate)) * dt);
        lost += fallRate * dt;
        if ((s.phase === 'snap' || s.phase === 'open') && fallRate <= PARACHUTE_SAFE_RATE) break;
      }
      return { need: lost, seconds: t - deploy };
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
    /* The load (g felt in the harness) of a jumper falling at `fall` with drag area
       `area`: the slider and the stretch in the lines round the peak off, so it eases
       towards PARACHUTE_OPEN_SHOCK instead of clipping at it. */
    function parachuteLoad(fall, area) {
      const raw = area * (fall / PARACHUTE_TERMINAL) ** 2;
      return PARACHUTE_OPEN_SHOCK * Math.tanh(raw / PARACHUTE_OPEN_SHOCK);
    }
    /* Downward acceleration of a jumper falling at `fall` with drag area `area`
       (parachuteDragArea): gravity less a drag that grows with the square of the
       speed, the opening shock capped by the slider. */
    function parachuteFallAccel(fall, area) {
      return GRAVITY * (1 - parachuteLoad(fall, area));
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
        flare = actionHeld('back'),
        canopy = p.stage === 'canopy',
        rate = parachuteSinkRate();
      // The deployment runs on from the pull (DEPLOYMENT); `area` is the drag it gives.
      let area = 1;
      if (canopy) {
        const was = p.phase;
        p.deploy += deltaSeconds;
        parachuteDeployPhase(p.deploy, p.pullRate, p);
        p.opening = parachuteInflation(p.phase, p.phaseK);
        area = parachuteDragArea(p.phase, p.phaseK, rate);
        if (p.phase !== was) parachutePhaseChange(p);
      }
      // Until the canopy flies the jumper steers and moves as in freefall.
      const wing = canopy ? p.opening : 0,
        flying = canopy && p.phase === 'open';
      /* Flying, the canopy is still on its deployment brakes (the tails stowed half
         down, slow and nose-high) until the jumper unstows the toggles: after
         PARACHUTE_BRAKES_SET, or at once to steer or flare. Let go, it dives and
         surges forward to trim speed, and the jumper swings back under it. */
      if (flying) {
        p.flown += deltaSeconds;
        if (p.brakesSet && (p.flown >= PARACHUTE_BRAKES_SET || turn || flare)) p.brakesSet = false;
      }
      p.heading = normalizeAngle(p.heading + turn * (0.65 + 0.5 * wing) * deltaSeconds);
      player.a = p.heading;
      // Canopy forward speed: about 15 km/h flared (or on its brakes), 31 trimmed, 45 with the risers pulled.
      const braked = flare || (flying && p.brakesSet),
        speed = (34 + ((braked ? 15 : fast ? 45 : 31) - 34) * wing) * KMH,
        response = 1 - Math.exp(-deltaSeconds * (0.65 + (2.6 - 0.65) * wing));
      p.vx += (Math.cos(p.heading) * speed - p.vx) * response;
      p.vy += (Math.sin(p.heading) * speed - p.vy) * response;
      // The fall: gravity against drag, the canopy's share coming in along the stages.
      const fall = Math.max(0, -p.vz);
      p.load = parachuteLoad(fall, area);
      if (canopy) {
        p.peakLoad = Math.max(p.peakLoad, p.load);
        // The opening shock jolts the view (the renderer reads `shake`).
        if (p.phase === 'snap') shake = Math.max(shake, (p.load - 1) * 1.2);
      }
      p.vz = -Math.max(0, fall + parachuteFallAccel(fall, area) * deltaSeconds);
      // Where the forecast stops counting: out of the snivel and down to a landable rate.
      if (canopy && p.safeLost == null && (p.phase === 'snap' || p.phase === 'open') && -p.vz <= PARACHUTE_SAFE_RATE) {
        p.safeLost = +worldMeters(p.pullAltitude - (player.altitude + p.vz * deltaSeconds)).toFixed(1);
        p.safeTime = +p.deploy.toFixed(2);
      }
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
      // Freefall (or a canopy still opening) onto a roof: it is the ground as far as the body is concerned.
      if (!flying) {
        const roof = parachuteRoofAt(player.x, player.y);
        if (roof && player.altitude <= roof.height && wasAltitude > roof.height - 12) {
          player.altitude = roof.height;
          player.parachute = null;
          clearTouchInput();
          if (playerImpact(Math.max(0, -p.vz), roof.height, p.stage, false, true) === 'dead') return;
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
          player.altitude < b.height + (flying ? 18 : 0) &&
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
     * above whatever is below, a bar of that height against the height the
     * opening needs from the current fall rate (parachuteForecast, the tick) and
     * that height in metres. States (data-state): high (FREEFALL); soon (OPEN
     * SOON, PARACHUTE_CUE_SOON above the need); now (OPEN NOW, PARACHUTE_CUE_NOW:
     * pulled now it still opens fully); danger (TOO LOW, no room for a full
     * opening left). After the pull: opening (the stage, the height left and
     * what the rest of the opening takes), or short (TOO LOW · BRACE: it will not
     * be open before the ground). Hidden once the canopy flies.
     */
    const freefallCue = { shown: false, state: '', call: '', note: '', foot: '', altitude: -1 };
    const PARACHUTE_PHASE_NOTES = {
      pilot: 'PILOT CHUTE OUT',
      lines: 'LINES PAYING OUT',
      snivel: 'CANOPY INFLATING',
      snap: 'CANOPY SNAPPING OPEN',
    };
    function parachuteCueState() {
      const p = player.parachute;
      if (!p || gameMode !== 'play' || (p.stage === 'canopy' && p.phase === 'open')) return null;
      const agl = Math.max(0, player.altitude - parachuteFloor(player.x, player.y)),
        fall = Math.max(0, -p.vz);
      if (p.stage === 'canopy') {
        const rest = parachuteForecast(fall, p.deploy, p.pullRate, parachuteSinkRate());
        return { agl, need: rest.need, seconds: rest.seconds, phase: p.phase, state: agl < rest.need ? 'short' : 'opening' };
      }
      const f = parachuteForecast(fall),
        above = ([seconds, metres]) => f.need + Math.max(seconds * fall, metres * UNITS_PER_METRE);
      return {
        agl,
        need: f.need,
        seconds: f.seconds,
        phase: 'freefall',
        state:
          agl < above(PARACHUTE_CUE_LATE)
            ? 'danger'
            : agl < above(PARACHUTE_CUE_NOW)
              ? 'now'
              : agl < above(PARACHUTE_CUE_SOON)
                ? 'soon'
                : 'high',
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
      const opening = cue.phase !== 'freefall',
        touch = hintDevice() === 'touch',
        key = touch ? 'TAP OPEN' : keyName('bail'),
        call = opening ? 'CANOPY OPENING' : touch ? 'TO OPEN PARACHUTE' : 'PRESS ' + key + ' TO OPEN PARACHUTE';
      if (call !== freefallCue.call) {
        freefallCue.call = call;
        getElement('freefallKey').textContent = key;
        getElement('freefallCall').textContent = call;
      }
      if (cue.state !== freefallCue.state) {
        freefallCue.state = cue.state;
        root.dataset.state = cue.state;
      }
      const note = opening
        ? cue.state === 'short'
          ? 'TOO LOW · BRACE'
          : PARACHUTE_PHASE_NOTES[cue.phase]
        : cue.state === 'danger'
          ? 'TOO LOW · OPEN NOW'
          : cue.state === 'now'
            ? 'OPEN NOW'
            : cue.state === 'soon'
              ? 'OPEN SOON'
              : 'FREEFALL';
      if (note !== freefallCue.note) {
        freefallCue.note = note;
        getElement('freefallNote').textContent = note;
      }
      const metres = Math.round(worldMeters(cue.agl));
      if (metres !== freefallCue.altitude) {
        freefallCue.altitude = metres;
        getElement('freefallAlt').textContent = metres;
      }
      // What opening takes: from here in freefall, or what is left of it after the pull.
      const needM = Math.round(worldMeters(cue.need) / 5) * 5,
        foot = opening
          ? 'FULLY OPEN IN ' + cue.seconds.toFixed(1) + ' S · ' + needM + ' M'
          : 'OPENING TAKES ' + needM + ' M AT THIS SPEED';
      if (foot !== freefallCue.foot) {
        freefallCue.foot = foot;
        getElement('freefallNeed').textContent = foot;
      }
      // The bar: height left against three times the height needed; the mark is that height.
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
        // The roar lasts until the canopy has the speed off; the snivel flogs the cloth.
        const rate = clamp(-p.vz / PARACHUTE_TERMINAL, 0, 1),
          roar = p.stage === 'freefall' ? 1 : clamp(rate * 1.6 - 0.1, 0, 1);
        // Buffeting: the level and colour wander a few times a second.
        const buffet = 0.8 + 0.2 * Math.sin(gameTime * 7.3) * Math.sin(gameTime * 3.1 + 1),
          freefall = (0.08 + rate * 0.3) * buffet,
          freefallCentre = 380 + rate * 900 + Math.sin(gameTime * 5.7) * 120;
        // The tail flutters; the brakes and speed change its pitch.
        const flap = 0.75 + 0.25 * Math.sin(gameTime * 23) * Math.sin(gameTime * 4.3),
          snivel = p.phase === 'snivel' ? 0.06 * (0.6 + 0.4 * Math.sin(gameTime * 31)) : 0,
          wing = 0.05 * flap * (0.5 + 0.5 * (p.opening || 0)) + snivel,
          wingCentre = 900 + Math.hypot(p.vx, p.vy) * 4;
        level = freefall * roar + wing * (1 - roar);
        centre = freefallCentre * roar + wingCentre * (1 - roar);
      }
      chuteWindGain.gain.setTargetAtTime(level, now, 0.12);
      chuteWindFilter.frequency.setTargetAtTime(centre, now, 0.1);
    }
    // A stage of the deployment begins (updateParachute): its sound, the jolt of line stretch, the call once it flies.
    function parachutePhaseChange(p) {
      parachutePhaseSound(p.phase);
      if (p.phase === 'snivel') shake = Math.max(shake, 1.6);
      if (p.phase === 'open') {
        p.openTime = +p.deploy.toFixed(2);
        p.openLost = Math.round(worldMeters(p.pullAltitude - player.altitude));
        p.openAt = Math.round(worldMeters(Math.max(0, player.altitude - parachuteFloor(player.x, player.y))));
        tell('CANOPY OPEN · Steer toward clear ground · Hold ' + keyName('back') + ' to flare and slow your landing', 4);
      }
    }
    /* The pull's sounds, stage by stage: the pilot chute thrown into the wind, the
       bag off the back and the lines paying out, the snatch of line stretch, the
       slider cracking down and the canopy taking the load. */
    function parachutePhaseSound(phase) {
      if (!audio || !soundOn) return;
      if (phase === 'pilot') noise(0.14, 0.1, 1800);
      else if (phase === 'lines') noise(0.9, 0.09, 2600);
      else if (phase === 'snivel') {
        noise(0.12, 0.16, 1100);
        tone(95, 0.14, 0.18, 'sine', 60);
      } else if (phase === 'snap') {
        noise(0.18, 0.26, 900);
        tone(70, 0.3, 0.3, 'sine', 42);
        setTimeout(() => {
          if (player.parachute) noise(0.4, 0.1, 500);
        }, 240);
      }
    }
    function drawParachute2D() {
      const p = player.parachute;
      if (!p || p.stage !== 'canopy') return;
      worldContext.save();
      worldContext.strokeStyle = '#ddd9bc';
      worldContext.lineWidth = 1;
      // The lines pay out behind the pilot chute until line stretch.
      const out = p.phase === 'pilot' ? 0.1 : p.phase === 'lines' ? 0.1 + 0.9 * p.phaseK : 1;
      if (out < 1) {
        worldContext.fillStyle = '#d2362a';
        worldContext.beginPath();
        worldContext.arc(player.x, player.y - 12 - 40 * out, 3, 0, TAU);
        worldContext.fill();
      }
      for (const side of [-1, 1]) {
        worldContext.beginPath();
        worldContext.moveTo(player.x + side * 3, player.y);
        worldContext.lineTo(player.x + side * (3 + 24 * p.opening), player.y - 37 * out);
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
