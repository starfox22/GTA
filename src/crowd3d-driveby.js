      // Crowd 3D drive-by pose: the player at the wheel with the gun arm out of the window, torso
      // and head turned to the aim, recoil per shot (drawDriveByDriver; driveByRiderArm on a bike).
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
