    /**
     * AIRCRAFT STRIKES
     * An airframe is not a car: a helicopter or a plane flown into a building, a
     * hillside or a bridge tower faster than AIRCRAFT_CRASH_SPEED (40 km/h along
     * the contact) breaks up. The tanks go, the wreck burns and falls (the usual
     * vehicle explosion and debris, updateCars), and whoever is aboard dies with
     * it; in god mode the player is thrown clear instead (riders.js throw) and
     * lands unhurt. Slower, it is a scrape: the ordinary crash damage.
     * The rotor reaches past the fuselage (a disc the length of the airframe):
     * blades meeting a wall faster than ROTOR_STRIKE_SPEED (15 km/h toward it)
     * shatter and the helicopter goes down the same way; slower, the tips chip,
     * it is pushed back and the pilot is warned.
     */
    const AIRCRAFT_CRASH_SPEED = 40 * KMH,
      ROTOR_STRIKE_SPEED = 15 * KMH,
      aircraftCrashes = [];
    function aircraftAirborne(c) {
      return isAircraft(c) && c.hp > 0 && aircraftClearance(c) > 3;
    }
    function destroyAircraft(c, cause, speed) {
      if (c.hp <= 0) return;
      aircraftCrashes.push({ type: c.type, cause, kmh: Math.round(speed / KMH), altitudeM: Math.round(worldMeters(aircraftClearance(c))), player: c === player.car, at: +gameTime.toFixed(1) });
      if (aircraftCrashes.length > 8) aircraftCrashes.shift();
      damageVehicle(c, c.hp + 1, c.x, c.y, null, { kind: 'crash', nx: 0, ny: 0, closing: speed, otherMass: 0 });
      if (c.damage) c.damage.burning = true;
      playSample('crash-heavy-2', 0.9, 0.8, c);
      // The wreck drops out of the sky, carrying a little of its way.
      c.vx *= 0.35;
      c.vy *= 0.35;
      c.vz = Math.min(c.vz || 0, 0);
      if (c.type === 'helicopter') c.abandonedFlight = true;
      if (c === player.car) {
        tell(cause === 'rotor strike' ? 'ROTOR STRIKE' : 'THE AIRFRAME BREAKS UP', 3);
        if (player.godMode) {
          // God mode: thrown clear of the fireball, falling unhurt (riders.js).
          let x = c.x,
            y = c.y;
          const back = Math.atan2(-c.vy, -c.vx);
          for (let r = 0; r < 200 && solid(x, y, RIDER_RADIUS); r += 12) {
            x = c.x + Math.cos(back) * r;
            y = c.y + Math.sin(back) * r;
          }
          c.ai = false;
          player.car = null;
          player.x = x;
          player.y = y;
          player.altitude = terrainHeight(x, y);
          player.thrown = riderThrowState(c.vx * 0.5, c.vy * 0.5, Math.max(RIDER_SEAT, c.altitude - terrainHeight(x, y)), 4 * UNITS_PER_METRE, 'aircraft', [c, null], c);
        }
      }
    }
    // From collisionImpact: an airborne aircraft into a static body or a vehicle.
    function aircraftImpact(c, other, closing, staticBody) {
      if (!aircraftAirborne(c)) return false;
      // A small prop or a bicycle does not bring an airframe down.
      if (other && (vehicleSpec(other).mass || 1.25) < 1) return false;
      if (staticBody && staticBody.breakKJ !== undefined && staticBody.breakKJ < 100) return false;
      if (closing < AIRCRAFT_CRASH_SPEED) return false;
      destroyAircraft(c, staticBody ? (staticBody.building || staticBody.kind === 'building' ? 'building' : staticBody.kind || 'structure') : 'vehicle', closing);
      return true;
    }
    // The rotor disc against the walls round a flying helicopter (settleVehicle).
    function rotorStrikes(c, stepSeconds) {
      if (c.type !== 'helicopter' || !aircraftAirborne(c) || (c.rotorSpeed || 0) < 0.4) return;
      const radius = vehicleSpec(c).l * 0.5,
        shape = contactShape(c);
      for (const b of nearbyStatics(c)) {
        if (b.height === undefined || b.height < c.altitude + 2) continue;
        if (b.minHeight !== undefined && b.minHeight > c.altitude + 30) continue;
        // Nearest point of the box to the rotor mast.
        const cosine = Math.cos(b.a || 0),
          sine = Math.sin(b.a || 0),
          dx = c.x - b.x,
          dy = c.y - b.y,
          lx = dx * cosine + dy * sine,
          ly = -dx * sine + dy * cosine,
          qx = clamp(lx, -b.hx, b.hx),
          qy = clamp(ly, -b.hy, b.hy),
          gap = Math.hypot(lx - qx, ly - qy);
        if (gap >= radius || gap < 0.01 || boxContact(shape, b)) continue;
        // Outward normal from the wall toward the mast, and the speed into it.
        const nx = ((lx - qx) * cosine - (ly - qy) * sine) / gap,
          ny = ((lx - qx) * sine + (ly - qy) * cosine) / gap,
          toward = -(c.vx * nx + c.vy * ny);
        if (toward > ROTOR_STRIKE_SPEED) {
          destroyAircraft(c, 'rotor strike', toward);
          return;
        }
        // A graze: blade tips chip, the helicopter is shoved clear.
        if (toward > 0) {
          c.vx += nx * toward * 1.4;
          c.vy += ny * toward * 1.4;
        }
        c.x += nx * Math.min(2, radius - gap) * 0.5;
        c.y += ny * Math.min(2, radius - gap) * 0.5;
        if (physicsClock - (c.rotorGrazeAt || -100) > 0.5) {
          c.rotorGrazeAt = physicsClock;
          damageVehicle(c, 6, c.x - nx * radius, c.y - ny * radius, null, { kind: 'crash', nx, ny, closing: Math.max(0, toward), otherMass: 0 });
          playSample('crash-scrape', 0.5, 1.4, c);
          if (c === player.car) {
            shake = Math.max(shake, 3);
            tell('ROTOR TIPS ON THE WALL · Back off!', 2);
          }
        }
      }
    }
    function helicopterControl(c, stepSeconds, active) {
      if (c.abandonedFlight && c !== player.car) {
        // A pilotless helicopter settling onto a flat roof it fits on lands there.
        const site = (c.roofSite = helicopterRoofSite(c)),
          floor = site ? Math.max(site.height, terrainHeight(c.x, c.y)) : terrainHeight(c.x, c.y);
        let surface = floor,
          blocked = false;
        for (const b of nearbyStatics(c))
          if (b.height > surface && (!site || b.building !== site) && boxContact(vehicleShape(c), b)) {
            surface = b.height;
            blocked = true;
          }
        c.vx *= Math.exp(-stepSeconds * 0.3);
        c.vy *= Math.exp(-stepSeconds * 0.3);
        c.av *= Math.exp(-stepSeconds);
        c.a += c.av * stepSeconds;
        c.vz = Math.max(-110, (c.vz || 0) - 32 * stepSeconds);
        const next = c.altitude + c.vz * stepSeconds;
        if (next <= surface) {
          const sink = -c.vz,
            speed = Math.hypot(c.vx, c.vy),
            slope = terrainSlope(c.x, c.y);
          c.altitude = surface;
          if (
            blocked ||
            (!site && !groundAt(c.x, c.y, 8)) ||
            (!site && Math.hypot(slope.x, slope.y) > 0.35) ||
            sink > 36 ||
            speed > 45
          )
            damageVehicle(c, c.maxhp, c.x, c.y, 'world');
          else damageVehicle(c, Math.max(0, sink - 14) * 3, c.x, c.y, 'world');
          c.vx = c.vy = c.vz = c.av = 0;
          c.abandonedFlight = false;
        } else c.altitude = next;
        c.rotorSpeed = Math.max(0, (c.rotorSpeed || 0) - stepSeconds * 0.3);
        c.speed = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
        return;
      }
      if (c.airUnit && c.hp > 0) {
        policeHelicopterControl(c, stepSeconds);
        return;
      }
      // A wreck continues its emergency descent, but cannot receive powered flight
      // or yaw commands while the player is still aboard waiting to bail out.
      const controlled = c === player.car && active && c.hp > 0;
      let forward = 0,
        turn = 0,
        lift = 0;
      if (controlled) {
        forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
        turn = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
        // Climb and descend have their own keys (T / G by default, controls.js),
        // clear of Space (handbrake) and Shift (sprint).
        lift = (actionHeld('ascend') ? 1 : 0) - (actionHeld('descend') ? 1 : 0);
      }
      if (c.hp <= 0) lift = -1;
      c.av += (turn * 1.6 - c.av) * Math.min(1, stepSeconds * 4);
      c.a += c.av * stepSeconds;
      // Over a flat roof that the whole airframe fits on, the roof is the floor.
      const site = helicopterRoofSite(c),
        floor = site ? Math.max(site.height, terrainHeight(c.x, c.y)) : terrainHeight(c.x, c.y),
        landingClear = () => (site ? roofLandingClear(c, site) : safeLanding(c)),
        // About 1400 m, above the cloud tops (clouds3d.js).
        ceiling = 7200,
        clearance = c.altitude - floor;
      const flying = clearance > 1 || lift > 0,
        desired = flying ? forward * VEHICLE_DEFINITIONS.helicopter.max : 0,
        along = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
      // Nose-down acceleration of about half a g; flat out it settles near 240 km/h.
      const acceleration = clamp((desired - along) * 1.8, -0.6 * GRAVITY, VEHICLE_DEFINITIONS.helicopter.acc);
      c.vx += Math.cos(c.a) * acceleration * stepSeconds;
      c.vy += Math.sin(c.a) * acceleration * stepSeconds;
      c.vx *= Math.exp(-stepSeconds * 0.04);
      c.vy *= Math.exp(-stepSeconds * 0.04);
      // The rotor disc tilts into a turn: sideways drift dies away in a second or two.
      const drift = (-c.vx * Math.sin(c.a) + c.vy * Math.cos(c.a)) * (1 - Math.exp(-stepSeconds * 1.2));
      c.vx += Math.sin(c.a) * drift;
      c.vy -= Math.cos(c.a) * drift;
      // Climb and descent quicken once well clear of the rooftops, so the cloud
      // layer is a half-minute climb rather than a minute; low flying is unchanged.
      const climbRate = 75 + clamp(clearance - 400, 0, 3000) * 0.035;
      c.vz += (lift * climbRate - c.vz) * Math.min(1, stepSeconds * 3);
      let next = clamp(c.altitude + c.vz * stepSeconds, floor, ceiling);
      // Flown into the ground (a hillside rising under it, a roof, a hard
      // set-down with way on): the skids dig in and it rolls over and breaks up.
      const groundSpeed = Math.hypot(c.vx, c.vy);
      if (c.hp > 0 && clearance > 0.5 && c.altitude + c.vz * stepSeconds < floor && groundSpeed > AIRCRAFT_CRASH_SPEED) {
        destroyAircraft(c, site ? 'roof' : 'terrain', groundSpeed);
        c.altitude = floor;
        return;
      }
      c.roofSite = site;
      if (c.hp > 0 && next < floor + 20 && clearance >= 20 && !landingClear()) {
        next = floor + 20;
        c.vz = 0;
        if (controlled && physicsClock - (c.landingWarning || -100) > 3) {
          c.landingWarning = physicsClock;
          tell('Landing blocked. Slow down and find clear, open ground.', 2.5);
        }
      }
      if (c.hp > 0 && clearance < 20 && lift < 0 && !landingClear()) {
        next = c.altitude;
        c.vz = 0;
      }
      c.altitude = next;
      if (next === floor) {
        c.vz = 0;
        c.vx *= Math.exp(-stepSeconds * 6);
        c.vy *= Math.exp(-stepSeconds * 6);
      }
      if (next === ceiling) c.vz = Math.min(0, c.vz);
      c.rotorSpeed = clamp((c.rotorSpeed || 0) + (controlled && c.hp > 0 ? 1 : -1) * stepSeconds, 0, 1);
      c.speed = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
    }
    function boatControl(c, stepSeconds, active) {
      const vehicleDefinition = vehicleSpec(c),
        controlled = c === player.car && active,
        headingCosine = Math.cos(c.a),
        headingSine = Math.sin(c.a),
        along = c.vx * headingCosine + c.vy * headingSine,
        // A police launch in a water pursuit steers itself (pursuit.js).
        helm = !controlled && active && c.marineUnit && c.cop && c.hp > 0 && wantedStars > 0 ? marineBoatInput(c, along) : !controlled && c.isleBoat && c.hp > 0 ? isleBoatHelm(c, along) : null,
        up = controlled ? keys.KeyW || keys.ArrowUp : !!helm?.up,
        down = controlled ? keys.KeyS || keys.ArrowDown : !!helm?.down,
        turn = controlled
          ? (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0)
          : helm?.turn || 0,
        brake = controlled && keys.Space;
      // Thrust fades as the hull nears its top speed (water resistance grows with
      // the square of the speed, balancing it 15% past the cap below); astern is
      // reverse thrust, not brakes.
      const topSpeed = vehicleDefinition.max * (0.65 + (0.35 * c.hp) / c.maxhp) * (c.marineUnit ? 1.15 : 1);
      let force = up
        ? vehicleDefinition.acc * (1 - Math.min(1, (Math.max(0, along) / (topSpeed * 1.15)) ** 2))
        : down
          ? along > 8
            ? -0.35 * GRAVITY
            : -vehicleDefinition.acc * 0.55
          : 0;
      if (
        // Police launches are tuned a little quicker than anything they chase.
        (along > topSpeed && up) ||
        (along < -8 * KNOTS && down)
      )
        force = 0;
      if (c.hp <= 0) force = 0;
      c.vx += headingCosine * force * stepSeconds;
      c.vy += headingSine * force * stepSeconds;
      // Wet tarmac lets the back end go earlier and stretches the stopping distance.
      const road = isBoat(c) || isAircraft(c) ? 1 : wetGrip(),
        lateral = -c.vx * headingSine + c.vy * headingCosine,
        grip = 1 - Math.exp(-stepSeconds * 2.4 * road);
      c.vx += headingSine * lateral * grip;
      c.vy -= headingCosine * lateral * grip;
      // Off the throttle a planing hull settles and slows quickly.
      const drag = Math.exp(-(brake ? 2.5 * road : up ? 0 : 0.3) * stepSeconds);
      c.vx *= drag;
      c.vy *= drag;
      c.av +=
        (turn * vehicleDefinition.turn * clamp(Math.abs(along) / 70, 0.15, 1) * Math.sign(along || 1) -
          c.av) *
        Math.min(1, stepSeconds * 2);
      const nextA = c.a + c.av * stepSeconds;
      if (boatFits(c, c.x, c.y, nextA)) c.a = nextA;
      else c.av = 0;
    }
