    // Falls, vehicles: road vehicles leaving the terrain (cliffSettle, cliffFlight), landings, tumbles down a face and rollovers.
    /**
     * VEHICLES OFF THE TERRAIN
     * A road vehicle on a terrain field carries a free body height (`fallZ`, its
     * climb rate `fallVz`): gravity pulls it down, the ground pushes it up. While
     * the ground is under the wheels the body rides it; where the ground drops
     * away faster than gravity can pull the car after it (a cliff edge, the lip
     * of a steep face, a crest taken far too fast) the body keeps going and the
     * gap opens. Up to CLIFF_DROOP the springs still reach (the car goes light
     * over a crest and is drawn that far up); past it the car is airborne
     * (`c.cliffAir`): no grip, no steering, a ballistic arc, the nose tipping
     * over the edge (faster the slower it went over: g / 2v) and a roll if it
     * went over at an angle.
     *
     * Landing, the speed into the surface decides, as for a body (falls-body.js):
     * under CLIFF_SAFE_INTO (5 m/s, a 1.3 m drop) the springs take it; above it
     * the share of the car's hit points lost is ((v - 5) / 20)^1.3, so a sedan
     * dropped 10 m (14 m/s) on its wheels loses a third, and from 25 m/s (32 m)
     * it is scrap and burns (physics-update.js explodes a car at 0 hit points,
     * killing anyone still inside). Landing on the roof or a side costs 1.35
     * times as much. The people inside take the body scale at 0.72 of the speed
     * (seat, belt, a cabin around them): shaken below 11 m of drop, dead from
     * about 33. A rider is thrown (riders.js) and takes the full body scale.
     *
     * On a face steeper than CLIFF_TUMBLE_GRADE (40 degrees), or down on its roof
     * or side fast, the car does not stop: hard strikes bounce it off, turning it
     * over, each one another landing; between them it slides down against the
     * rock's friction (CLIFF_FACE_FRICTION), until the ground eases. Where it
     * stops, the whole height from the edge counts as the landing, at
     * CLIFF_FACE_KEEP of the speed. Then it comes to rest on whatever
     * side is down: its wheels, its roof or a side (`c.overturned`, which no
     * one can drive: the engine runs, nothing turns).
     *
     * Roads, the 4x4 trails and any slope a car can drive down never open a gap
     * past the droop; the drawbridge keeps its own flight (drawbridge-span.js).
     */
    const CLIFF_DROOP = 0.75 * UNITS_PER_METRE,
      CLIFF_SAFE_INTO = 5 * UNITS_PER_METRE,
      CLIFF_DAMAGE_SPAN = 20 * UNITS_PER_METRE,
      CLIFF_ROOF_FACTOR = 1.35,
      CLIFF_CABIN = 0.72,
      CLIFF_TUMBLE_GRADE = 0.85,
      // Metal and glass on rock, sliding down a face.
      CLIFF_FACE_FRICTION = 0.45,
      CLIFF_FACE_KEEP = 0.85,
      CLIFF_TERMINAL = 60 * UNITS_PER_METRE,
      cliffLog = [];
    // Standing height of a vehicle (the same classes as riders.js riderObstacleTop).
    function vehicleStandHeight(c) {
      const spec = vehicleSpec(c),
        mass = spec.mass || 1.25;
      return (spec.bike ? 1.1 : spec.bus || spec.truck || mass >= 2.8 ? 3 : mass >= 2 ? 1.9 : 1.45) * UNITS_PER_METRE;
    }
    /* How far below its centre a tilted body reaches, and the lift that keeps a
       body turned about its base (the renderer's pivot) centred where it was. */
    function cliffExtent(c, pitch, roll) {
      const spec = vehicleSpec(c),
        half = vehicleStandHeight(c) / 2;
      return (spec.l / 2) * Math.abs(Math.sin(pitch)) + (spec.w / 2) * Math.abs(Math.sin(roll) * Math.cos(pitch)) + half * Math.abs(Math.cos(roll) * Math.cos(pitch));
    }
    function cliffPivotLift(c, pitch, roll) {
      const half = vehicleStandHeight(c) / 2;
      return half * (1 - Math.cos(pitch) * Math.cos(roll));
    }
    // Resting on its roof (roll PI) or a side (+-PI/2): the base lifted clear of the ground.
    function overturnLift(c) {
      const roll = c.overturned?.roll || 0,
        half = vehicleStandHeight(c) / 2;
      return half * (1 - Math.cos(roll)) + Math.max(0, vehicleSpec(c).w / 2 - half) * Math.abs(Math.sin(roll));
    }
    function logCliff(c, entry) {
      cliffLog.push({ type: c.type, player: c === player.car, ...entry, at: +gameTime.toFixed(2), seq: ++fallSeq });
      if (cliffLog.length > 10) cliffLog.shift();
    }
    /* After terrainVehiclePose (settleVehicle): follow the ground, take off, land. */
    function cliffSettle(c, stepSeconds) {
      if (isAircraft(c) || isBoat(c)) return;
      if (c.deckAir || c.deckLeaf || c.sinkFor > 0) {
        if (c.cliffAir || c.cliffLift) clearCliffState(c);
        c.fallZ = undefined;
        return;
      }
      if (c.cliffAir) return cliffAirSettle(c, stepSeconds);
      // The flat city and the sea: nothing to fall off (most vehicles, every step).
      if (c.fallZ === undefined && !(c.groundHeight > 0.2) && !c.overturned) return;
      const moved = c.x !== c.stepStartX || c.y !== c.stepStartY;
      if (!moved && !c.cliffLift && !(c.fallVz > 0)) return;
      const ground = terrainHeight(c.x, c.y);
      if (c.fallZ === undefined || Math.abs(c.x - c.fallX) + Math.abs(c.y - c.fallY) > 60) {
        // First sight of it, or it was moved by hand (a teleport, a respawn): on the ground.
        c.fallZ = c.fallGround = ground;
        c.fallVz = 0;
        c.fallX = c.x;
        c.fallY = c.y;
        return;
      }
      c.fallX = c.x;
      c.fallY = c.y;
      let vz = (c.fallVz || 0) - GRAVITY * stepSeconds,
        z = c.fallZ + vz * stepSeconds;
      if (z <= ground) {
        // On its wheels: the ground carries it (and launches it off a crest).
        vz = clamp((ground - (c.fallGround ?? ground)) / stepSeconds, -CLIFF_TERMINAL, CLIFF_TERMINAL);
        z = ground;
      }
      c.fallGround = ground;
      c.fallZ = z;
      c.fallVz = vz;
      const gap = z - ground;
      if (gap > CLIFF_DROOP) return startCliffFlight(c, ground);
      // Light over a crest: the body drawn up off the springs (entityElevation adds deckLift).
      const base = c.overturned ? overturnLift(c) : 0,
        lift = base + (gap > 0.3 ? gap : 0);
      if (lift > 0.01 || c.cliffLift) {
        c.deckLift = lift;
        c.groundHeight = ground + lift;
        c.cliffLift = lift > 0.01;
      }
      if (c === player.car) player.altitude = c.groundHeight;
      if (!ground && !gap && !c.overturned) c.fallZ = undefined;
    }
    function startCliffFlight(c, ground) {
      const spec = vehicleSpec(c),
        speed = Math.hypot(c.vx || 0, c.vy || 0),
        slope = terrainSlope(c.x, c.y),
        grade = Math.hypot(slope.x, slope.y),
        cos = Math.cos(c.a),
        sin = Math.sin(c.a),
        down = grade > 1e-3 ? { x: -slope.x / grade, y: -slope.y / grade } : { x: cos, y: sin },
        ahead = down.x * cos + down.y * sin,
        right = -down.x * sin + down.y * cos,
        // The wheels still on the lip hold that end up while the rest drops: the
        // slower it goes over, the longer they hold and the more it tips (about g / 2v).
        tip = clamp(GRAVITY / (2 * Math.max(speed, 25)), 0.12, 2.2) * (spec.bike ? 0.6 : 1);
      c.cliffAir = {
        z: c.fallZ,
        vz: c.fallVz,
        pitch: c.slopePitch || 0,
        roll: c.slopeRoll || 0,
        vp: -tip * ahead,
        vr: tip * 1.3 * right,
        time: 0,
        bounces: 0,
        from: { x: Math.round(c.x), y: Math.round(c.y), z: c.fallZ },
        lowest: c.fallZ,
        worstInto: 0,
      };
      c.overturned = null;
      c.cliffLift = true;
      c.fallZ = undefined;
      if (c === player.car) shake = Math.max(shake, 2);
      cliffPose(c, ground);
    }
    /* Control step (physics-driving.js): ballistic in the air, or sliding on its
       roof or side on the ground with nothing to drive. */
    function cliffFlight(c, stepSeconds) {
      const air = c.cliffAir;
      if (!air) return overturnedSlide(c, stepSeconds);
      air.time += stepSeconds;
      air.vz = Math.max(-CLIFF_TERMINAL, air.vz - GRAVITY * stepSeconds);
      air.z += air.vz * stepSeconds;
      air.lowest = Math.min(air.lowest, air.z);
      const drag = Math.exp(-0.04 * stepSeconds);
      c.vx *= drag;
      c.vy *= drag;
      c.av = (c.av || 0) * Math.exp(-0.6 * stepSeconds);
      c.a = normalizeAngle(c.a + c.av * stepSeconds);
      air.pitch += air.vp * stepSeconds;
      air.roll += air.vr * stepSeconds;
      c.moveA = Math.atan2(c.vy, c.vx);
      c.speed = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
    }
    function overturnedSlide(c, stepSeconds) {
      // Metal on rock: about 0.7 g of friction, and a steep face still pulls it down.
      const slope = terrainSlope(c.x, c.y),
        grade = Math.hypot(slope.x, slope.y);
      if (grade > 0.55) {
        c.vx -= slope.x * 0.6 * GRAVITY * stepSeconds;
        c.vy -= slope.y * 0.6 * GRAVITY * stepSeconds;
      }
      const speed = Math.hypot(c.vx || 0, c.vy || 0),
        stop = 0.7 * GRAVITY * stepSeconds,
        keep = speed > stop ? (speed - stop) / speed : 0;
      c.vx *= keep;
      c.vy *= keep;
      c.av = (c.av || 0) * Math.exp(-3 * stepSeconds);
      c.a = normalizeAngle(c.a + c.av * stepSeconds);
      c.moveA = Math.atan2(c.vy, c.vx);
      c.speed = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
    }
    // Where the renderer draws a car in the air: its pitch and roll, the base lifted so the body turns about its middle.
    function cliffPose(c, ground) {
      const air = c.cliffAir;
      c.slopePitch = air.pitch;
      c.slopeRoll = air.roll;
      c.deckLift = air.z - ground + cliffPivotLift(c, air.pitch, air.roll);
      c.groundHeight = ground + c.deckLift;
      c.poseX = undefined;
      if (c === player.car) player.altitude = air.z;
    }
    function cliffAirSettle(c, stepSeconds) {
      const air = c.cliffAir,
        water = !groundAt(c.x, c.y),
        ground = water ? 0 : terrainHeight(c.x, c.y),
        half = vehicleStandHeight(c) / 2,
        bottom = air.z + half - cliffExtent(c, air.pitch, air.roll);
      if (bottom > ground) {
        air.contact = false;
        return cliffPose(c, ground);
      }
      const slope = water ? { x: 0, y: 0 } : terrainSlope(c.x, c.y),
        grade = Math.hypot(slope.x, slope.y),
        norm = Math.sqrt(1 + grade * grade),
        into = Math.max(0, (slope.x * c.vx + slope.y * c.vy - air.vz) / norm),
        up = Math.cos(air.pitch) * Math.cos(air.roll),
        wheels = up > 0.75;
      air.worstInto = Math.max(air.worstInto, into);
      if (water) return cliffSplash(c, into);
      const speed = Math.hypot(c.vx, c.vy, air.vz),
        tangential = Math.sqrt(Math.max(0, speed * speed - into * into)),
        steep = grade > CLIFF_TUMBLE_GRADE,
        stuck = air.contact && speed < 1.5 * UNITS_PER_METRE && air.time > 3;
      if (!stuck && air.time < 25 && (steep || (!wheels && into > 8 * UNITS_PER_METRE && tangential > 6 * UNITS_PER_METRE))) {
        // A strike (not the steady press of sliding down a face): it costs.
        if (!air.contact || into > 2 * UNITS_PER_METRE) cliffImpact(c, into, wheels);
        air.slid = air.slid || steep;
        // Down the face: hard strikes bounce it off (the speed into the rock comes
        // back at a fraction and turns the car over), the rest slides against the
        // rock's friction, and gravity keeps pulling it on down.
        const hard = into > 4 * UNITS_PER_METRE,
          e = hard ? 0.28 : 0,
          k = (1 + e) * into;
        c.vx -= (k * slope.x) / norm;
        c.vy -= (k * slope.y) / norm;
        air.vz += k / norm;
        const along = Math.hypot(c.vx, c.vy, air.vz),
          loss = CLIFF_FACE_FRICTION * ((GRAVITY / norm) * stepSeconds + into),
          keep = along > loss ? (along - loss) / along : 0;
        c.vx *= keep;
        c.vy *= keep;
        air.vz *= keep;
        if (hard) {
          const right = Math.sin(c.a) * slope.x - Math.cos(c.a) * slope.y,
            ahead = -Math.cos(c.a) * slope.x - Math.sin(c.a) * slope.y,
            spin = clamp(tangential / (6 * UNITS_PER_METRE), 1, 4.5);
          air.vr += spin * (Math.abs(right) > 0.25 * grade ? Math.sign(right) : seededRandom() < 0.5 ? -1 : 1) * 0.8;
          air.vp -= spin * Math.sign(ahead || 1) * 0.35;
          c.av = (c.av || 0) + randomBetween(-1.2, 1.2);
          air.bounces++;
          if (c === player.car || distanceBetween(c, player) < 900)
            playSample(into > 12 * UNITS_PER_METRE ? 'crash-heavy-2' : 'crash-medium-2', clamp(into / (20 * UNITS_PER_METRE), 0.3, 0.9), 0.9, c);
        }
        air.contact = true;
        air.z = ground - half + cliffExtent(c, air.pitch, air.roll) + 0.2;
        return cliffPose(c, ground);
      }
      // Down where it can stop. Gone down a face on the way: the whole height from
      // the edge counts, less what the face took off (CLIFF_FACE_KEEP).
      const landing = air.slid ? Math.max(into, Math.sqrt(2 * GRAVITY * Math.max(0, air.from.z - ground)) * CLIFF_FACE_KEEP) : into;
      cliffImpact(c, landing, wheels);
      cliffRest(c, ground, landing, wheels);
    }
    /* What a landing does to the vehicle and whoever is in it. */
    function cliffImpact(c, into, wheels) {
      const spec = vehicleSpec(c),
        ms = worldMeters(into);
      // Touching down off a crest or a hop: the springs' business, not a landing.
      if (ms < 1.5) return;
      logCliff(c, { speed: +ms.toFixed(1), drop: +fallDropMetres(into).toFixed(1), wheels, hp: Math.round(c.hp) });
      const near = c === player.car || distanceBetween(c, player) < 900;
      if (into <= CLIFF_SAFE_INTO) {
        if (near) playSample('crash-bump-1', 0.35, 1, c);
        return;
      }
      // The people first: a crash that kills the car kills them in the blast anyway.
      if (c === player.car) {
        if (spec.bike) {
          // Off the bike (riders.js), and into the ground as a body.
          const thrown = riderLanding(c, into);
          playerImpact(into * (thrown ? 1 : 0.85), terrainHeight(player.x, player.y), 'rider');
        } else playerImpact(into * CLIFF_CABIN, terrainHeight(c.x, c.y), 'vehicle');
      } else if (spec.bike) riderLanding(c, into);
      const share = Math.pow((into - CLIFF_SAFE_INTO) / CLIFF_DAMAGE_SPAN, 1.3) * (wheels ? 1 : CLIFF_ROOF_FACTOR),
        hit = share * (c.maxhp || spec.hp || 150) * (spec.tank ? 0.1 : 1);
      damageVehicle(c, hit, c.x, c.y, null, { kind: 'crash', nx: 0, ny: 0, closing: into, otherMass: 0 });
      if (near) {
        playSample(into > 14 * UNITS_PER_METRE ? 'crash-heavy-1' : 'crash-medium-1', clamp(into / (18 * UNITS_PER_METRE), 0.3, 0.95), 0.95, c);
        if (into > 10 * UNITS_PER_METRE) playSample('crash-glass-1', 0.35, 1, c);
      }
      if (c === player.car) shake = Math.max(shake, clamp(into / 14, 3, 14));
    }
    // Down for good: settle on whichever face is down, back on the terrain's pose.
    function cliffRest(c, ground, into, wheels) {
      const air = c.cliffAir,
        spec = vehicleSpec(c),
        r = normalizeAngle(air.roll),
        p = normalizeAngle(air.pitch);
      let rest = 0;
      if (Math.abs(Math.sin(r)) >= Math.abs(Math.sin(p))) rest = Math.cos(r) > 0.5 ? 0 : Math.cos(r) < -0.5 ? Math.PI : Math.sign(r) * (Math.PI / 2);
      // Standing on its nose or tail: it topples on the way it was turning, or falls back.
      else rest = Math.abs(p) > Math.PI / 2 || (air.vp * p > 0 && into > 6 * UNITS_PER_METRE) ? Math.PI : 0;
      if (spec.bike) {
        if (rest && !c.fallen) c.fallen = { roll: 0, side: Math.sign(r) || 1, tumble: clamp(Math.hypot(c.vx, c.vy) / UNITS_PER_METRE * 0.6, 0, 9) };
        rest = 0;
      }
      const keep = into > 10 * UNITS_PER_METRE || rest ? 0.7 : 0.92;
      c.vx *= keep;
      c.vy *= keep;
      logCliff(c, { rest: rest ? (Math.abs(rest) > 2 ? 'roof' : 'side') : 'wheels', fell: +worldMeters(air.from.z - ground).toFixed(1), bounces: air.bounces, hp: Math.round(c.hp) });
      c.cliffAir = null;
      c.overturned = rest ? { roll: rest, at: gameTime } : null;
      c.fallZ = c.fallGround = ground;
      c.fallVz = 0;
      c.fallX = c.x;
      c.fallY = c.y;
      c.slopePitch = 0;
      c.slopeRoll = rest;
      c.deckLift = rest ? overturnLift(c) : 0;
      c.cliffLift = !!rest;
      c.groundHeight = ground + c.deckLift;
      c.poseX = undefined;
      if (!rest && wheels && into > 3 * UNITS_PER_METRE && !spec.bike)
        // The springs bottom out and throw the body back up a little.
        c.hop = { z: 0, vz: clamp(into * 0.08, 4, 30), pitch: 0, vp: randomBetween(-1, 1), roll: 0, vr: randomBetween(-1, 1) };
      if (c === player.car) {
        player.altitude = c.groundHeight;
        if (rest && c.hp > 0 && gameMode === 'play') tell((Math.abs(rest) > 2 ? 'On its roof.' : 'On its side.') + ' ' + keyName('interact') + ' to climb out.', 3.5);
      }
    }
    // Off a sea cliff: into the water, which floods it from here (water.js).
    function cliffSplash(c, into) {
      splashAt(c.x, c.y, clamp(into / (8 * UNITS_PER_METRE), 1.6, 3.2));
      logCliff(c, { speed: +worldMeters(into).toFixed(1), water: true, hp: Math.round(c.hp) });
      if (c === player.car) playerImpact(into * CLIFF_CABIN, 0, 'vehicle', true);
      if (into > FALL_WATER_SAFE) damageVehicle(c, (into - FALL_WATER_SAFE) * 0.8, c.x, c.y, null, { kind: 'crash', nx: 0, ny: 0, closing: into, otherMass: 0 });
      c.vx *= 0.3;
      c.vy *= 0.3;
      clearCliffState(c);
      if (c === player.car && gameMode === 'play') tell('Into the sea. Get out before it goes under.', 3);
    }
    function clearCliffState(c) {
      c.cliffAir = null;
      c.overturned = null;
      c.cliffLift = false;
      c.deckLift = 0;
      c.slopePitch = 0;
      c.slopeRoll = 0;
      c.groundHeight = terrainHeight(c.x, c.y);
      c.poseX = undefined;
      c.fallZ = undefined;
    }
