      // Crowd 3D drive-by pose: the player at the wheel with the gun arm out of the window, torso
      // and head turned to the aim, recoil per shot (drawDriveByDriver; driveByRiderArm on a bike);
      // the people seated in cars seen through the glass (drawCarOccupants, SEATED OCCUPANTS).
      /**
       * DRIVE-BY POSE
       * Drawn only while the gun is out (driveby.js `driveBy.out` > 0): the
       * player is seated at the driver's hip point (driveBySeat), feet on the
       * pedals, one hand on the wheel (turning with the steering) and the
       * other on the pistol. The pistol travels from the lap to the grip that
       * driveByGrip gives for the window (the same point the bullet leaves
       * from), lifted over the sill on the way, its yaw easing from the nose
       * to the aim; the wrist takes the pistol's frame and the arm reaches it
       * by IK from the shoulder, so the elbow bends where it must. The torso
       * rolls toward the window it is out of (across the cabin for the
       * passenger window), twists toward the aim and the head looks along it;
       * a shot back through the rear screen turns the torso round to the right
       * over the seat. Those targets ease through the pose joints, so going in
       * and out never pops. A shot kicks the muzzle up and the hand back.
       * Riders keep their rig (RIDERS): the left hand leaves the bar for the gun.
       */
      const driveByGhost = { x: 0, y: 0, a: 0, hp: 1 },
        dbView = { rel: 0, window: null },
        dbFrame = new Three.Matrix4(),
        dbSeat = new Three.Matrix4(),
        dbAim = new Three.Matrix4(),
        dbGun = new Three.Matrix4(),
        dbGunHand = new Three.Matrix4(),
        dbRoot = new Three.Matrix4(),
        dbPos = new Three.Vector3(),
        dbQuat = new Three.Quaternion(),
        dbBodyQuat = new Three.Quaternion(),
        dbScale = new Three.Vector3(),
        dbEuler = new Three.Euler(),
        dbReady = new Three.Vector3(),
        dbGrip = new Three.Vector3(),
        dbUp = new Three.Vector3(),
        dbHands = [new Three.Vector3(), new Three.Vector3()],
        dbFeet = [new Three.Vector3(), new Three.Vector3()];
      const driveBySmooth = (k) => k * k * (3 - 2 * k);
      /* The aim the arm follows, eased; the rear shot unwrapped past +PI so the gun swings round the right. */
      function driveByViewRel(deltaSeconds) {
        const d = driveBy;
        let target = d.rel;
        if (d.window === 'rear' && target < 0) target += TAU;
        if (dbView.window !== d.window) {
          dbView.window = d.window;
          dbView.rel = target;
        } else dbView.rel += (target - dbView.rel) * (1 - Math.exp(-deltaSeconds * 16));
        return dbView.rel;
      }
      /**
       * Poses the pistol in `seat` (a frame at the driver's hips, vehicle axes:
       * x ahead, y up, z right, world units) out to the grip for `rel`, blended
       * from `ready` (world) by `e`; fills sp.gunFrame / gunHandFrame and the
       * hand target. Returns the hand that holds it.
       */
      function poseDriveByGun(c, sp, seat, ready, rel, e, H) {
        const s = driveBySeat(c),
          g = driveByGrip(c, driveBy.window, rel),
          M = UNITS_PER_METRE,
          recoil = clamp(((player.recoilUntil || 0) - gameTime) / 0.12, 0, 1);
        dbGrip.set(g.x - s.x, g.z - s.z, g.y - s.y).applyMatrix4(seat);
        dbUp.set(0, 1, 0).transformDirection(seat);
        // Lap to window, lifted over the sill on the way; the kick throws the hand back and up.
        dbPos.lerpVectors(ready, dbGrip, e).addScaledVector(dbUp, Math.sin(Math.PI * e) * 0.13 * M + recoil * 0.12);
        const yaw = rel * e;
        dbAim.extractRotation(seat).setPosition(dbPos);
        crowdJoint(dbGun, dbAim, -Math.cos(yaw) * recoil * 0.4, 0, -Math.sin(yaw) * recoil * 0.4, recoil * 0.42, (1 - e) * 0.5 + (g.hand ? -0.08 : 0.08) * e, -yaw);
        dbGun.scale(crowdScale.set(H, H, H));
        // The firing hand wraps the grip (as drawHold): the wrist behind and above it.
        crowdJoint(dbGunHand, dbGun, -0.3, 0.34, 0.02, 0.22);
        dbHands[g.hand].setFromMatrixPosition(dbGunHand);
        sp.weapon = PLAYER_WEAPONS[selectedWeaponIndex] || 'pistol';
        sp.gunFrame = dbGun;
        sp.gunHandFrame = dbGunHand;
        sp.gunHand = g.hand;
        sp.recoil = recoil;
        // The body follows the aim: toward the window, twisted round, the head along the aim.
        const w = driveBy.window;
        let twist, roll;
        if (w === 'rear') {
          twist = -1.0;
          roll = 0.14;
        } else {
          twist = clamp(-rel * 0.3, -0.75, 0.85);
          roll = w === 'right' ? 0.3 : w === 'left' ? -0.26 : w === 'open' ? -0.08 : 0;
        }
        sp.torsoTwist = twist * e;
        sp.torsoRoll = roll * e;
        sp.headYaw = (w === 'rear' ? -1.15 : clamp(-rel - twist, -1.25, 1.25) * 0.85) * e;
        sp.headPitch = 0.05 * e;
        return g.hand;
      }
      /* The player at the wheel during a drive-by (finishCrowd3D). */
      function drawDriveByDriver(deltaSeconds, detail) {
        const c = player.car,
          d = driveBy;
        if (!c || d.out <= 0 || !d.window || d.car !== c || c.hp <= 0) return;
        const profile = driveByProfile(c);
        // Cars and trucks: a boat's helm and a cockpit have no seat model to sit in.
        if (!profile || profile.body === 'rider' || isAircraft(c) || isBoat(c)) return;
        const m = carModels.get(c);
        if (!m || !m.group.visible || !m.body) return;
        const M = UNITS_PER_METRE,
          s = driveBySeat(c),
          e = driveBySmooth(clamp(d.out, 0, 1)),
          rel = driveByViewRel(deltaSeconds);
        // The body's frame in world units: the group without its model scale, the body's
        // tilt with the slope added (render3d-frame.js adds it after the crowd is packed).
        m.group.updateMatrixWorld(true);
        m.group.matrixWorld.decompose(dbPos, dbQuat, dbScale);
        const r = m.body.rotation,
          sloped = !isAircraft(c) && !isBoat(c);
        dbEuler.set(r.x + (sloped ? c.slopeRoll || 0 : 0), r.y, r.z + (sloped ? c.slopePitch || 0 : 0), r.order);
        dbBodyQuat.setFromEuler(dbEuler);
        dbQuat.multiply(dbBodyQuat);
        dbFrame.compose(dbPos, dbQuat, crowdScale.set(1, 1, 1));
        dbSeat.copy(dbFrame).multiply(dbRoot.makeTranslation(s.x, s.z, s.y));
        const sp = specialSpec(player);
        sp.hold = null;
        sp.pose = 'riding';
        sp.riderLean = driveBy.window === 'right' ? 0.02 : 0.16;
        sp.facing = c.a;
        sp.look = specialLook(player);
        // The pistol comes up from the lap on its hand's side.
        const gunHand = driveByGrip(c, d.window, rel).hand;
        dbReady.set(0.3 * M, 0.24 * M, (gunHand ? 0.1 : -0.1) * M).applyMatrix4(dbSeat);
        const R = compiledLook(sp.look, driveByGhost),
          H = R.height * RIG_UNIT;
        poseDriveByGun(c, sp, dbSeat, dbReady, rel, e, H);
        // The other hand on the wheel's rim, turning with the steering.
        const wheelHand = 1 - gunHand,
          steer = clamp(c.tyres ? c.tyres.steer : clamp(c.av * 0.5, -1, 1), -1, 1),
          clock = (wheelHand ? 1 : -1) * 1.35 - steer * 0.9;
        dbHands[wheelHand].set(0.5 * M, 0.36 * M + Math.cos(clock) * 0.18 * M, Math.sin(clock) * 0.18 * M).applyMatrix4(dbSeat);
        // Feet on the pedals.
        for (let side = 0; side < 2; side++) dbFeet[side].set(0.74 * M, -0.26 * M, (side ? 0.1 : -0.12) * M).applyMatrix4(dbSeat);
        sp.handTargets = dbHands;
        sp.legTargets = dbFeet;
        // The rig's root: its hip joint on the seat's hip point.
        dbRoot.copy(dbSeat).multiply(dbAim.makeTranslation(0, -RIG.hip * H, 0));
        sp.rootOverride = dbRoot;
        sp.elevation = dbPos.setFromMatrixPosition(dbRoot).y;
        driveByGhost.x = c.x;
        driveByGhost.y = c.y;
        driveByGhost.a = c.a;
        drawCrowdPerson(driveByGhost, stateFor(driveByGhost), deltaSeconds, detail, sp);
      }
      /**
       * On a bike (drawQueuedRiders): the left hand off the bar and onto the
       * pistol, out from the shoulder along the aim. `root` is the rider's root
       * (vehicle axes, at the feet); `hands` the bar grips, the left replaced.
       */
      function driveByRiderArm(c, sp, root, hands, H, deltaSeconds) {
        const d = driveBy;
        if (d.out <= 0 || d.car !== c || d.window !== 'open' || c.hp <= 0) return;
        const e = driveBySmooth(clamp(d.out, 0, 1)),
          rel = driveByViewRel(deltaSeconds);
        dbSeat.copy(root).multiply(dbRoot.makeTranslation(0, RIG.hip * H, 0));
        dbReady.copy(hands[0]);
        poseDriveByGun(c, sp, dbSeat, dbReady, rel, e, H);
        hands[0].copy(dbHands[0]);
      }
      /**
       * SEATED OCCUPANTS
       * The car glass is see-through (cars3d-interior.js CAR GLASS), so whoever is in a car shows: the player at the
       * wheel (the drive-by pose above takes over while the gun is out), a traffic car's driver and passenger
       * (`occupied`, `passengers`: the sex and colour carjack.js dresses them in on foot), a patrol car's two officers
       * while the crew is aboard. Each is the rig in the 'riding' pose: hips on the model's seat (`m.seats`,
       * carSeatPlan), hands on the wheel's rim (a passenger's in the lap), feet on the pedals, the head turning now
       * and then. The vehicle pass queues the cars in view (queueCarOccupants, from animateCivilianCar and
       * animatePoliceVehicle); only those within OCCUPANT_REACH of the camera, where the glass is clear, are seated,
       * the nearest OCCUPANT_CAP of them (passengers only in the nearest OCCUPANT_PASSENGERS).
       */
      const OCCUPANT_REACH = 37 * UNITS_PER_METRE,
        OCCUPANT_CAP = 16,
        OCCUPANT_PASSENGERS = 8,
        occupantCars = new Array(OCCUPANT_CAP).fill(null),
        occupantModels = new Array(OCCUPANT_CAP).fill(null),
        occupantDistance = new Float64Array(OCCUPANT_CAP),
        occupantLooks = new WeakMap(),
        OCCUPANT_COLORS = ['#2f3d52', '#6b2d2d', '#3f4a3a', '#c9c3b5', '#1e1f22', '#7b6a55', '#3a5f7a', '#8a3f5c'],
        ocRim = [0, 0, 0],
        ocHands = [new Three.Vector3(), new Three.Vector3()],
        ocFeet = [new Three.Vector3(), new Three.Vector3()],
        ocFrame = new Three.Matrix4(),
        ocSeat = new Three.Matrix4(),
        ocRoot = new Three.Matrix4(),
        ocShift = new Three.Matrix4(),
        ocPos = new Three.Vector3(),
        ocQuat = new Three.Quaternion(),
        ocTilt = new Three.Quaternion(),
        ocEuler = new Three.Euler(),
        ocUnit = new Three.Vector3(1, 1, 1);
      let occupantCount = 0,
        occupantsDrawn = 0,
        occupantMsAverage = 0;
      // Whether `c` has people to show: 1 the driver, 2 a passenger too (0 none).
      function carOccupancy(c) {
        if (c.hp <= 0) return 0;
        if (c === player.car && !transitRide && !taxiRide) return 1;
        if (c.cop || c.lawUnit) return c.crewDeployed || c.crewLost || c === player.car ? 0 : 2;
        return c.occupied ? (c.passengers > 0 ? 2 : 1) : 0;
      }
      /* A civilian or police model in view (vehicle pass): kept if near enough, the nearest OCCUPANT_CAP. */
      function queueCarOccupants(c, m) {
        if (!m.group.visible || !carOccupancy(c)) return;
        const p = camera.position,
          dx = c.x - p.x,
          dy = m.group.position.y - p.y,
          dz = c.y - p.z,
          d = c === player.car ? -1 : dx * dx + dy * dy + dz * dz;
        if (d > OCCUPANT_REACH * OCCUPANT_REACH) return;
        let at = occupantCount;
        if (occupantCount >= OCCUPANT_CAP) {
          // Full: replace the farthest if this one is nearer.
          at = 0;
          for (let i = 1; i < OCCUPANT_CAP; i++) if (occupantDistance[i] > occupantDistance[at]) at = i;
          if (occupantDistance[at] <= d) return;
        } else occupantCount++;
        occupantCars[at] = c;
        occupantModels[at] = m;
        occupantDistance[at] = d;
      }
      // The looks of the people in a traffic or patrol car (made once, by the car's id).
      function occupantLooksFor(c) {
        const police = !!(c.cop || c.lawUnit),
          key = police ? 'police:' + (c.lawUnit || 'patrol') : 'civ:' + (c.driverColor || '') + (c.driverFemale ? 'f' : 'm');
        let entry = occupantLooks.get(c);
        if (entry && entry.key === key) return entry;
        const seed = (c.id || 1) * 13.7,
          outfit = police ? (c.lawUnit === 'fed' ? 'fed' : 'police') : 'motorist',
          driver = outfitLook({ color: c.driverColor || '#4b5563' }, outfit, seed + 1),
          passenger = outfitLook({ color: OCCUPANT_COLORS[(c.id || 0) % OCCUPANT_COLORS.length] }, outfit, seed + 7);
        if (!police && c.driverFemale !== undefined && driver.female !== !!c.driverFemale) {
          // The sex the driver gets out as (carjack.js makeCarDriver); the hair to go with it.
          driver.female = !!c.driverFemale;
          driver.hairStyle = driver.female ? pickOf([2, 3, 4], hashOf(seed + 1, 6)) : pickOf([1, 1, 4, 'hairBuzz'], hashOf(seed + 1, 6));
        }
        if (!police && c.driverRole === 'elder') driver.hair = '#b9b5ad';
        entry = { key, looks: [driver, passenger], proxies: [{ x: c.x, y: c.y, a: c.a, hp: 1 }, { x: c.x, y: c.y, a: c.a, hp: 1 }] };
        occupantLooks.set(c, entry);
        return entry;
      }
      /* Seat everyone queued this frame (finishCrowd3D, after the vehicles are posed). */
      function drawCarOccupants(deltaSeconds, detail) {
        occupantsDrawn = 0;
        if (!occupantCount) {
          occupantMsAverage *= 0.95;
          return;
        }
        const frameBody = BODY,
          started = performance.now();
        // Nearest first, so the passengers go to the closest cars.
        for (let i = 1; i < occupantCount; i++)
          for (let j = i; j > 0 && occupantDistance[j] < occupantDistance[j - 1]; j--) {
            const d = occupantDistance[j],
              c = occupantCars[j],
              m = occupantModels[j];
            occupantDistance[j] = occupantDistance[j - 1];
            occupantCars[j] = occupantCars[j - 1];
            occupantModels[j] = occupantModels[j - 1];
            occupantDistance[j - 1] = d;
            occupantCars[j - 1] = c;
            occupantModels[j - 1] = m;
          }
        for (let i = 0; i < occupantCount; i++) {
          const c = occupantCars[i],
            m = occupantModels[i];
          occupantCars[i] = occupantModels[i] = null;
          const people = Math.min(carOccupancy(c), i < OCCUPANT_PASSENGERS ? 2 : 1);
          let seated = 0;
          for (let seat = 0; seat < people; seat++) if (seatOccupant(c, m, seat, deltaSeconds, detail)) seated++;
          // (DeadEndCity.carModels: `cabin.seated`, the people drawn in it on the last frame it was queued.)
          if (m.seated !== seated) m.seated = seated;
          occupantsDrawn += seated;
        }
        occupantCount = 0;
        BODY = frameBody;
        occupantMsAverage += (performance.now() - started - occupantMsAverage) * 0.05;
      }
      /* One person in seat 0 (the driver's) or 1 (the front passenger's) of `c`. */
      function seatOccupant(c, m, seat, deltaSeconds, detail) {
        const isPlayer = c === player.car && seat === 0,
          plan = m.seats;
        if (isPlayer) {
          // The drive-by pose draws them while the gun is out; the car-entry stand-in for its first moments.
          const d = driveBy;
          if (d.out > 0 && d.window && d.car === c) return false;
          if (carTransition.kind === 'enter' && carTransition.car === c && gameTime - carTransition.at < 0.4) return false;
        }
        const entry = isPlayer ? null : occupantLooksFor(c),
          proxy = isPlayer ? driveByGhost : entry.proxies[seat];
        proxy.x = c.x;
        proxy.y = c.y;
        proxy.a = c.a;
        const personDetail = chaseViewActive ? crowdChaseDetail(proxy) : detail;
        if (personDetail < 0) return false;
        // The body's frame in world units (the group's scale turns a police model's design units into them), its tilt
        // with the slope added as the drive-by pose does (render3d-frame.js adds it after the crowd is packed).
        const r = m.body.rotation;
        ocEuler.set(r.x + (c.slopeRoll || 0), r.y, r.z + (c.slopePitch || 0), r.order);
        ocTilt.setFromEuler(ocEuler);
        ocQuat.copy(m.group.quaternion).multiply(ocTilt);
        ocFrame.compose(m.group.position, ocQuat, m.group.scale);
        const M = plan.M,
          z = seat ? -plan.z : plan.z;
        ocPos.set(plan.x, plan.y, z).applyMatrix4(ocFrame);
        ocSeat.compose(ocPos, ocQuat, ocUnit);
        const sp = isPlayer ? specialSpec(player) : resetSpec(specScratch);
        if (!isPlayer) sp.look = entry.looks[seat];
        sp.hold = null;
        sp.weapon = null;
        sp.pose = 'riding';
        sp.facing = c.a;
        // Lying back with the seat; a glance about now and then, more for a passenger.
        sp.riderLean = 0.12 + (plan.recline - 0.3) * 0.9;
        const steer = clamp(c === player.car && c.tyres ? c.tyres.steer : (c.av || 0) * 0.5, -1, 1),
          glance = Math.sin(gameTime * (seat ? 0.31 : 0.23) + (c.id || 0) * 1.7);
        sp.torsoTwist = 0;
        sp.torsoRoll = clamp(-steer * Math.min(1, Math.abs(c.speed || 0) / 120) * 0.1, -0.1, 0.1);
        sp.headYaw = isPlayer ? -steer * 0.2 : (glance > 0.6 ? (glance - 0.6) * (seat ? 1.6 : 0.9) : 0) * ((c.id || 0) % 2 ? 1 : -1) - steer * 0.15;
        sp.headPitch = 0.04;
        const R = compiledLook(sp.look, proxy),
          H = R.height * RIG_UNIT;
        if (seat === 0) {
          // Both hands on the rim a little above nine and three, sliding with the steering.
          for (let hand = 0; hand < 2; hand++) {
            carWheelRim(plan.wheel, (hand ? 1.2 : -1.2) - steer * 0.3, ocRim);
            ocHands[hand].set(ocRim[0], ocRim[1], ocRim[2]).applyMatrix4(ocFrame);
          }
        } else for (let hand = 0; hand < 2; hand++) ocHands[hand].set(plan.x + 0.3 * M, plan.y + 0.1 * M, z + (hand ? 0.1 : -0.1) * M).applyMatrix4(ocFrame);
        for (let foot = 0; foot < 2; foot++) ocFeet[foot].set(plan.x + 0.74 * M, plan.y - 0.26 * M, z + (foot ? 0.11 : -0.11) * M).applyMatrix4(ocFrame);
        sp.handTargets = ocHands;
        sp.legTargets = ocFeet;
        // The rig's root: its hip joint on the seat's hip point.
        ocRoot.copy(ocSeat).multiply(ocShift.makeTranslation(0, -RIG.hip * H, 0));
        sp.rootOverride = ocRoot;
        sp.elevation = ocPos.setFromMatrixPosition(ocRoot).y;
        drawCrowdPerson(proxy, stateFor(proxy), deltaSeconds, personDetail, sp);
        return true;
      }
