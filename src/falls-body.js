    // Falls on foot: the impact scale (fallInjury), the player's ballistic fall off a drop, landings and the fatal splat.
    /**
     * IMPACT SCALE
     * One scale for a body meeting the ground, whatever brought it there: what
     * matters is the speed into the surface, read as the drop it is worth
     * (v^2 / 2g). Below FALL_SAFE_DROP (6 m, 11 m/s) a fit person lands it with a
     * stumble; from there to FALL_LETHAL_DROP (17 m, 18 m/s) the injury climbs
     * from a bruising 8 points to all of them; past it nobody walks away. Armour
     * does not help. Water forgives more: nothing below 20 m/s, fatal from
     * FALL_WATER_LETHAL (30 m/s, a 46 m drop), where it is as hard as concrete.
     */
    const FALL_SAFE_DROP = 6 * UNITS_PER_METRE,
      FALL_LETHAL_DROP = 17 * UNITS_PER_METRE,
      FALL_WATER_SAFE = 20 * UNITS_PER_METRE,
      FALL_WATER_LETHAL = 30 * UNITS_PER_METRE,
      // Ground falling away steeper than this (54 degrees) under a moving person:
      // no foothold, the body leaves it. A 4x4 trail is 0.37 at its steepest, a
      // face the player tumbles down (terrain-field.js TUMBLE_GRADE) 0.52.
      FALL_START_GRADE = 1.35,
      // A face steeper than this (45 degrees) cannot be landed on: a body that
      // meets it goes on down it, losing its speed into the rock at each strike
      // and scraping (FALL_SCRAPE hit points a metre) against FALL_FACE_FRICTION;
      // where it stops, the whole height from the lip counts as the fall.
      FALL_SLIDE_GRADE = 1,
      FALL_FACE_FRICTION = 0.3,
      FALL_SCRAPE = 1.5,
      FALL_FACE_KEEP = 0.9,
      // A body tumbling through the air tops out at about 55 m/s.
      FALL_TERMINAL = 55 * UNITS_PER_METRE,
      // Hips above the feet, for the flailing pose (crowd3d-special.js).
      FALL_HIPS = 0.95 * UNITS_PER_METRE,
      // The last few impacts (for the console's fallState and the tests), numbered
      // on one count with the vehicles' landings (falls-vehicles.js cliffLog).
      fallLog = [];
    let fallSeq = 0;
    // Metres of drop a landing speed (map units a second) is worth.
    function fallDropMetres(into) {
      return worldMeters((into * into) / (2 * GRAVITY));
    }
    /* Hit points a landing at `into` costs: 0 (a stumble), 8..100, or Infinity. */
    function fallInjury(into, water = false) {
      if (water) {
        if (into <= FALL_WATER_SAFE) return 0;
        if (into >= FALL_WATER_LETHAL) return Infinity;
        return 10 + 80 * Math.pow((into - FALL_WATER_SAFE) / (FALL_WATER_LETHAL - FALL_WATER_SAFE), 1.5);
      }
      const drop = (into * into) / (2 * GRAVITY);
      if (drop <= FALL_SAFE_DROP) return 0;
      if (drop >= FALL_LETHAL_DROP) return Infinity;
      return 8 + 92 * Math.pow((drop - FALL_SAFE_DROP) / (FALL_LETHAL_DROP - FALL_SAFE_DROP), 1.5);
    }
    function logFall(entry) {
      entry.at = +gameTime.toFixed(2);
      entry.seq = ++fallSeq;
      fallLog.push(entry);
      if (fallLog.length > 8) fallLog.shift();
    }
    /**
     * THE PLAYER HITS THE GROUND
     * playerImpact(into, z, cause, water): the landing at `into` (map units a
     * second, along the surface normal) on a surface at height `z`. Returns
     * 'safe', 'hurt' or 'dead'. Everything that drops the player (a freefall, a
     * canopy opened too low, a run off a cliff, a car's cabin) comes through
     * here, so one scale and one death apply.
     */
    function playerImpact(into, z, cause, water = false, roof = false, extra = 0) {
      const injury = fallInjury(into, water) + extra,
        entry = {
          cause,
          speed: +worldMeters(into).toFixed(1),
          drop: +fallDropMetres(into).toFixed(1),
          injury: injury === Infinity ? 'lethal' : Math.round(injury),
          scraped: Math.round(extra),
          water,
          roof,
          outcome: 'safe',
        };
      logFall(entry);
      // Both feet coming down on the ground's own surface (footsteps-audio.js).
      if (!water && into > 1.5 * UNITS_PER_METRE && cause !== 'vehicle') footLandSound(into);
      if (!injury || player.godMode || gameMode !== 'play') {
        if (!water && into > 5 * UNITS_PER_METRE) {
          // A stumble: dust, the knees and a nudge of the camera.
          particle(player.x, player.y, '#a39a82', 5, 45, 2.5);
          shake = Math.max(shake, 1.5);
        }
        return 'safe';
      }
      if (injury >= player.hp) {
        entry.outcome = 'dead';
        splatPlayer(into, z, water, roof, cause === 'vehicle');
        return player.hp > 0 ? 'safe' : 'dead';
      }
      player.inv = 0;
      hurt(injury, 'fall');
      entry.outcome = player.hp > 0 ? 'hurt' : 'dead';
      if (player.hp <= 0) return 'dead';
      // Hard landing: winded, bruised, a knee gone.
      shake = Math.max(shake, clamp(injury / 8, 3, 9));
      tone(90, 0.22, 0.5, 'sine', 45);
      noise(0.16, 0.3, 300);
      if (!water && !player.car) particle(player.x, player.y, '#a39a82', 8, 60, 3);
      tell(injury > 45 ? 'HARD LANDING · Badly hurt.' : 'HARD LANDING', 2.4);
      return 'hurt';
    }
    /**
     * THE SPLAT
     * A body arriving far too fast: a heavy thud, the camera jolts, the body lies
     * flat, face down, where it hit, and a pool of blood spreads out from under
     * it (not in the water). Then the ordinary death: WASTED and the hospital.
     */
    function splatPlayer(into, z, water = false, roof = false, inVehicle = false) {
      const x = player.x,
        y = player.y,
        a = player.a || 0;
      player.fall = null;
      player.tumble = null;
      player.tumbleRoll = 0;
      if (!inVehicle) player.deathStyle = { sign: -1, turn: randomBetween(-0.5, 0.5), slump: false, fall: true };
      player.inv = 0;
      hurt(1000, 'fall');
      if (player.hp > 0) return;
      if (inVehicle) {
        // Killed in the cabin: the wreck tells the rest.
        shake = Math.max(shake, 14);
        tone(62, 0.45, 0.8, 'sine', 30);
        return;
      }
      // die() drops roof state; the body stays on the surface it hit.
      player.altitude = z;
      player.splat = { x, y, z, water, roof, speed: +worldMeters(into).toFixed(1), at: gameTime };
      shake = Math.max(shake, clamp(into / 30, 8, 16));
      flash = Math.max(flash, 0.35);
      // The thud: a deep body blow, a crack and the dull spread of it.
      tone(62, 0.45, 0.95, 'sine', 30);
      noise(0.22, 0.55, 240);
      playSample('crash-bump-2', 0.45, 0.55, { x, y });
      if (water) {
        splashAt(x, y, clamp(into / (12 * UNITS_PER_METRE), 1.4, 3.2));
        return;
      }
      if (!bloodOn) return;
      // hurt() has bled the fall (blood.js bleed, kind 'fall'): the pool spreads
      // from under the body on the surface it hit, and a few drops are thrown out.
      const pool = bodyPool(player, 'fall', a + Math.PI, z);
      if (pool) pool.surface = z;
      for (let i = 0; i < 4; i++) {
        const aa = a + randomBetween(-1.4, 1.4),
          d = randomBetween(8, 20);
        addBloodDrop(x + Math.cos(aa) * d, y + Math.sin(aa) * d, randomBetween(0.8, 1.5), aa, { stretch: 1.6, surface: z });
      }
    }
    /* Into the sea or a lake from a height: a swim, a hurt one, or the end. */
    function fallIntoWater(into) {
      splashAt(player.x, player.y, clamp(into / (12 * UNITS_PER_METRE), 1, 3.2));
      if (playerImpact(into, 0, 'water', true) === 'dead') return;
      player.fall = null;
      player.altitude = SWIM_ALTITUDE;
      player.swimming = true;
      player.swimStroke = 0;
      player.swimDrive = 0;
    }
    /**
     * FALLING ON FOOT
     * settleFootOnGround() stands the player on the ground each frame (it
     * replaced the plain terrainHeight snap in update()) and watches the step
     * just taken: if the ground dropped away steeper than FALL_START_GRADE under
     * it, the player is off the edge and the fall begins from the lip, keeping
     * the speed they had. updatePlayerFall() flies the body (gravity, a little
     * air drag, walls in the way) until the ground or the water comes up, then
     * lands it through playerImpact(); on a steep face the rest of the speed
     * carries on down it as a tumble (terrain-field.js). Trails, roads, stairs
     * and every slope a person can walk down are well under the grade, so
     * nothing there ever leaves the ground.
     */
    const footTrack = { x: 0, y: 0, z: 0, t: -1 };
    function settleFootOnGround() {
      if (player.hp <= 0) return;
      if (player.deathStyle?.fall) player.deathStyle = null;
      const ground = terrainHeight(player.x, player.y),
        dt = gameTime - footTrack.t,
        moved = Math.hypot(player.x - footTrack.x, player.y - footTrack.y),
        drop = footTrack.z - ground;
      const fell =
        dt > 0 &&
        dt < 0.25 &&
        !player.thrown &&
        moved > 0.01 &&
        moved < 40 &&
        drop > 0.3 &&
        drop > moved * FALL_START_GRADE &&
        !playerOnRoof();
      if (fell) startPlayerFall(footTrack.x, footTrack.y, footTrack.z, dt);
      else player.altitude = ground;
      footTrack.x = player.x;
      footTrack.y = player.y;
      footTrack.z = ground;
      footTrack.t = gameTime;
    }
    function startPlayerFall(fromX, fromY, fromZ, dt) {
      const vx = (player.x - fromX) / dt,
        vy = (player.y - fromY) / dt,
        speed = Math.hypot(vx, vy);
      player.tumble = null;
      player.tumbleRoll = 0;
      player.altitude = fromZ;
      player.fall = {
        vx,
        vy,
        vz: -GRAVITY * dt,
        z: fromZ,
        time: 0,
        from: { x: fromX, y: fromY, z: fromZ },
        screamed: false,
        // On a face too steep to stop on (sliding down it), whether it has been,
        // and what the scraping has cost so far.
        contact: false,
        slid: false,
        hurt: 0,
        // What the renderer poses: a thrown body's frame (crowd3d-draw.js), flailing.
        pose: { phase: 'air', z: FALL_HIPS, pitch: 0, heading: speed > 2 ? Math.atan2(vy, vx) : player.a, flail: true },
      };
    }
    function updatePlayerFall(deltaSeconds) {
      const f = player.fall;
      if (!f) return false;
      if (player.car || player.parachute || player.swimming || transitRide || player.coaster || gameMode !== 'play') {
        player.fall = null;
        return false;
      }
      f.time += deltaSeconds;
      f.vz = Math.max(-FALL_TERMINAL, f.vz - GRAVITY * deltaSeconds);
      if (!f.contact) {
        const drag = Math.exp(-0.06 * deltaSeconds);
        f.vx *= drag;
        f.vy *= drag;
      }
      // Walls and trunks stop the drift, not the drop: the body slides down them.
      const blocked = moveBody(player, f.vx * deltaSeconds, f.vy * deltaSeconds, 8);
      if (blocked) {
        f.vx *= 0.2;
        f.vy *= 0.2;
      }
      f.z += f.vz * deltaSeconds;
      player.altitude = f.z;
      // Turning over, limbs going (crowd3d-poses.js 'thrown' with flail).
      f.pose.pitch = f.time * 1.25;
      // A yell once it is clearly a long way down.
      if (!f.screamed && f.time > 0.55 && Math.hypot(f.vx, f.vy, f.vz) > 9 * UNITS_PER_METRE) {
        f.screamed = true;
        // The player's own voice, as the rig draws them (voices.js).
        playPersonScream(player, 0.55);
      }
      const water = !groundAt(player.x, player.y),
        ground = water ? 0 : terrainHeight(player.x, player.y);
      if (f.z > ground) {
        f.contact = false;
        return true;
      }
      if (water) {
        player.fall = null;
        player.altitude = ground;
        footTrack.t = -1;
        fallIntoWater(Math.max(0, -f.vz));
        return true;
      }
      // The speed into the surface along its normal is what hurts.
      const slope = terrainSlope(player.x, player.y),
        grade = Math.hypot(slope.x, slope.y),
        norm = Math.sqrt(1 + grade * grade),
        into = Math.max(0, (slope.x * f.vx + slope.y * f.vy - f.vz) / norm);
      if (grade > FALL_SLIDE_GRADE && !blocked && f.time < 15 && !onMountainTrail(player.x, player.y)) {
        // A face too steep to stop on: it takes the body on down, striking and
        // scraping. The strike loses the speed into the rock (fatal alone if hard
        // enough); friction works on the rest; gravity keeps pulling.
        if (fallInjury(into) === Infinity) {
          player.fall = null;
          player.altitude = ground;
          playerImpact(into, ground, 'foot');
          return true;
        }
        f.slid = true;
        f.contact = true;
        f.z = ground;
        player.altitude = ground;
        f.vx -= (into * slope.x) / norm;
        f.vy -= (into * slope.y) / norm;
        f.vz += into / norm;
        const along = Math.hypot(f.vx, f.vy, f.vz),
          loss = FALL_FACE_FRICTION * ((GRAVITY / norm) * deltaSeconds + into),
          keep = along > loss ? (along - loss) / along : 0;
        f.vx *= keep;
        f.vy *= keep;
        f.vz *= keep;
        if (along > 3 * UNITS_PER_METRE) f.hurt += worldMeters(along * deltaSeconds) * FALL_SCRAPE;
        if (Math.random() < deltaSeconds * 6) particle(player.x, player.y, '#8f8672', 3, 40, 2.5);
        return true;
      }
      // Down on ground it can stop on. Whatever part of the way went down a face
      // too steep to stop on counts as a fall: the whole height from the lip, the
      // face taking a tenth of the speed off (FALL_FACE_KEEP).
      player.fall = null;
      player.altitude = ground;
      footTrack.t = -1;
      const faceSpeed = f.slid ? Math.sqrt(2 * GRAVITY * Math.max(0, f.from.z - ground)) * FALL_FACE_KEEP : 0;
      if (playerImpact(Math.max(into, faceSpeed), ground, 'foot', false, false, f.hurt) === 'dead') return true;
      // Still alive on a steep slope: what is left of the speed goes on down it.
      if (grade > TUMBLE_GRADE && !onMountainTrail(player.x, player.y)) {
        // The velocity less its part along the surface normal, kept in plan.
        const k = (f.vz - slope.x * f.vx - slope.y * f.vy) / (norm * norm);
        startTumble({ x: -slope.x / grade, y: -slope.y / grade }, grade);
        if (player.tumble) {
          player.tumble.vx = (f.vx + slope.x * k) * 0.7;
          player.tumble.vy = (f.vy + slope.y * k) * 0.7;
        }
      }
      return true;
    }
