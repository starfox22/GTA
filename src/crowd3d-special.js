      const SPEC_FIELDS = [
        'look', 'facing', 'snapFacing', 'rim', 'elevation', 'rootOverride', 'pose', 'transition', 'hold', 'weapon', 'recoil', 'reload',
        'knifeSwing', 'punch', 'punchLead', 'army', 'shield', 'dazed', 'limp', 'cocktail', 'sip', 'swim', 'parachute', 'lieInPlace',
        'progress', 'bounce', 'flag', 'riderLean', 'handTargets', 'legTargets', 'thrown',
      ];
      // One spec object with every field declared up front, so its shape never changes.
      const specScratch = Object.fromEntries(SPEC_FIELDS.map((k) => [k, undefined]));
      function resetSpec(sp) {
        for (let i = 0; i < SPEC_FIELDS.length; i++) sp[SPEC_FIELDS[i]] = undefined;
        return sp;
      }
      const parachuteProxy = (() => {
        const part = () => ({ rotation: { x: 0, z: 0 } });
        return {
          group: { position: new Three.Vector3(), rotation: new Three.Euler() },
          parts: { arm1: part(), 'arm-1': part(), leg1: part(), 'leg-1': part(), guns: [] },
          torso: { rotation: { z: 0 } },
        };
      })();
      const rootQuat = new Three.Quaternion(),
        rootMatrixScratch = new Three.Matrix4(),
        unitScale = new Three.Vector3(1, 1, 1);
      // Car transitions (render side only): when the player got in or out.
      const carTransition = { car: null, at: -10, kind: null, x: 0, y: 0, a: 0 };
      const recoilSince = (at) => (at != null ? clamp(1 - (gameTime - at) / 0.13, 0, 1) : 0);
      function specialSpec(p) {
        const sp = specScratch;
        resetSpec(sp);
        sp.look = specialLook(p);
        sp.facing = p.a || 0;
        const incapacitated = personIncapacitated(p) || p.hp <= 0;
        if (p === player) {
          sp.rim = true;
          sp.snapFacing = true;
          if (mouse.active || touchAim !== null) sp.facing = aim();
          const holstered = !!rooftopJob() && player.disguised && !rooftopJob().weaponDrawn;
          // The Marea pool (clubpool.js): a dive in, and a climb out onto the deck.
          if (player.pool?.phase === 'out') {
            sp.pose = 'exitCar';
            sp.transition = clamp(player.pool.t || 0, 0, 1);
            sp.facing = player.a;
            return sp;
          }
          if (player.swimming) return playerSwimSpec(sp);
          if (player.parachute) return playerParachuteSpec(sp);
          if (player.thrown) {
            // Thrown off a bike or out of a crash (riders.js).
            sp.pose = 'thrown';
            sp.thrown = player.thrown;
            sp.elevation = entityElevation(player);
            return sp;
          }
          if (player.tumble) {
            sp.pose = 'tumble';
            sp.elevation = entityElevation(player) + 2;
            crowdJoint(rootMatrixScratch, mIdentity, player.x, sp.elevation, player.y, Math.PI / 2, player.tumbleRoll || 0, -player.a);
            sp.rootOverride = rootMatrixScratch;
            return sp;
          }
          if (carTransition.kind === 'exit' && gameTime - carTransition.at < 0.5) {
            sp.pose = 'exitCar';
            sp.transition = clamp((gameTime - carTransition.at) / 0.5, 0, 1);
          }
          if (incapacitated || holstered) return sp;
          const weapon = PLAYER_WEAPONS[selectedWeaponIndex] ?? null,
            firedRecently = gameTime - (player.lastShotAt ?? -100) < 1.6;
          if (selectedWeaponIndex === FISTS_INDEX) {
            const guard = gameTime - (player.punchAt ?? -100) < 2.5;
            if (guard) {
              sp.hold = HOLD_POSES.fists;
              sp.punch = (player.punchUntil || 0) > gameTime ? Math.sin(clamp(1 - ((player.punchUntil || 0) - gameTime) / 0.26, 0, 1) * Math.PI) : 0;
              sp.punchLead = player.punchHand === -1 ? 0 : 1;
            }
            return sp;
          }
          if (!weapon) return sp;
          sp.weapon = weapon;
          sp.recoil = clamp(((player.recoilUntil || 0) - gameTime) / 0.12, 0, 1);
          const w = weapons[selectedWeaponIndex];
          if (reloadSecondsRemaining > 0 && w?.load) sp.reload = 1 - reloadSecondsRemaining / w.load;
          if (weapon === 'knife') {
            sp.hold = HOLD_POSES.knife;
            sp.knifeSwing = Math.max(0, ((player.knifeSwingUntil || 0) - gameTime) / 0.28);
          } else if (weapon === 'rocket') sp.hold = HOLD_POSES.rocket;
          else if (weapon === 'pistol') sp.hold = firedRecently || sp.reload >= 0 ? HOLD_POSES.pistolAim : HOLD_POSES.pistolSide;
          else if (weapon === 'smg') sp.hold = firedRecently || sp.reload >= 0 ? HOLD_POSES.smgAim : HOLD_POSES.smgSide;
          else sp.hold = firedRecently || sp.reload >= 0 ? HOLD_POSES.longAim : HOLD_POSES.longReady;
          return sp;
        }
        if (p.dazedFor > 0) sp.dazed = true;
        if (p.limping) sp.limp = true;
        if (p.downed && p.hp > 0) {
          sp.pose = 'crawl';
          return sp;
        }
        if (incapacitated) return sp;
        if (p.police || p.military) {
          const aiming = p.state === 'aim' || p.state === 'suppress' || !!p.aiming || !!p.aimingOnly,
            unit = p.unit,
            weapon = p.military || unit === 'soldier' ? 'rifle' : p.shield ? 'pistol' : unit === 'swat' ? 'rifle' : unit === 'sniper' ? 'sniper' : unit === 'fed' ? 'smg' : 'pistol';
          sp.weapon = weapon;
          sp.army = !!(p.military || unit === 'soldier');
          sp.shield = !!p.shield;
          sp.recoil = recoilSince(p.muzzleAt);
          if (p.shield) sp.hold = HOLD_POSES.shield;
          else if (weapon === 'pistol') sp.hold = aiming ? HOLD_POSES.pistolAim : wantedStars > 0 ? HOLD_POSES.pistolReady : null;
          else if (weapon === 'smg') sp.hold = aiming ? HOLD_POSES.smgAim : HOLD_POSES.smgReady;
          else sp.hold = aiming ? HOLD_POSES.longAim : p.military || wantedStars <= 0 ? HOLD_POSES.longCarry : HOLD_POSES.longReady;
          if (!sp.hold) sp.weapon = null;
          return sp;
        }
        if (p.faction && p.aiming && p.hp > 0) {
          sp.weapon = 'pistol';
          sp.hold = HOLD_POSES.pistolOneHand;
          sp.recoil = p.recoiling ? 1 : recoilSince(p.muzzleAt);
          return sp;
        }
        if (p.guest || p.boss) {
          if (p.drinking) {
            sp.pose = 'drink';
            sp.cocktail = true;
            sp.sip = Math.sin(gameTime * 1.3 + (p.phase || 0)) > 0.6;
          } else if (p.role === 'serve' || p.staff) sp.pose = 'serve';
          else if (!p.dancing && p.role === 'chat') sp.pose = 'chat';
        }
        return sp;
      }
      /* The player in the water: front crawl, or breaststroke when easing off. */
      function playerSwimSpec(sp) {
        const stroke = player.swimStroke || 0,
          hard = typeof swimHard === 'function' ? swimHard() : true,
          drive = clamp(player.swimDrive || 0, 0, 1),
          roll = hard ? Math.sin(stroke) * 0.44 * (0.4 + drive * 0.6) : 0;
        sp.facing = player.a;
        if (player.pool?.phase === 'dive') {
          // Head first: from a lean off the edge to arms-first into the water.
          const k = clamp(player.pool.t || 0, 0, 1);
          sp.elevation = entityElevation(player);
          crowdJoint(rootMatrixScratch, mIdentity, player.x, sp.elevation + 4 * k, player.y, -(0.35 + k * 1.75), 0, -player.a);
          sp.rootOverride = rootMatrixScratch;
          sp.swim = { stroke: 0, hard: true, drive: 0, dive: true };
          return sp;
        }
        // The body's axis just under the surface: the back and head break it (the sea at
        // -3.1, world3d.js; the Marea pool's water 2.4 above the swimmer, clubpool.js).
        sp.elevation = entityElevation(player) + (player.pool ? 2.2 : 1.3);
        crowdJoint(rootMatrixScratch, mIdentity, player.x, sp.elevation, player.y, -Math.PI / 2 + 0.12, roll, -player.a);
        sp.rootOverride = rootMatrixScratch;
        sp.swim = { stroke, hard, drive };
        return sp;
      }
      /* Parachute: parachute3d.js poses a stand-in model; its angles drive the rig. */
      function playerParachuteSpec(sp) {
        const proxy = parachuteProxy;
        poseParachutist(proxy, lastDelta);
        const g = proxy.group;
        rootQuat.setFromEuler(g.rotation);
        rootMatrixScratch.compose(g.position, rootQuat, unitScale);
        sp.rootOverride = rootMatrixScratch;
        sp.parachute = proxy;
        sp.facing = player.parachute.heading ?? player.a;
        sp.elevation = g.position.y;
        return sp;
      }
      let lastDelta = 0;
      /* Swimming and the parachute set the limbs directly, after the pose has eased. */
      function applyLimbOverrides(sp, J) {
        if (sp.swim) {
          const { stroke, hard, drive, float, dive } = sp.swim;
          J[J_LOCO] = 0;
          J[J_FALL] = 0;
          J[J_DROP] = 0;
          J[J_HOLD] = 0;
          if (dive) {
            // Streamlined: arms overhead, legs together.
            J[J_SH[0]] = J[J_SH[1]] = 3.05;
            J[J_AB[0]] = J[J_AB[1]] = 0.08;
            J[J_EL[0]] = J[J_EL[1]] = 0.05;
            J[J_HIP[0]] = J[J_HIP[1]] = 0;
            J[J_KNEE[0]] = J[J_KNEE[1]] = -0.08;
            J[J_SPREAD] = 0;
            J[J_HEAD_PITCH] = 0.25;
            J[J_HEAD_YAW] = 0;
          } else if (float) {
            // Floating on the back, arms and legs spread, a lazy scull.
            J[J_SH[0]] = J[J_SH[1]] = 0.2;
            J[J_AB[0]] = J[J_AB[1]] = 1.2 + Math.sin(stroke) * 0.1;
            J[J_EL[0]] = J[J_EL[1]] = 0.2;
            J[J_HIP[0]] = J[J_HIP[1]] = 0.1;
            J[J_KNEE[0]] = J[J_KNEE[1]] = -0.15;
            J[J_SPREAD] = 0.3;
            J[J_HEAD_PITCH] = -0.2;
            J[J_HEAD_YAW] = 0;
          } else if (hard) {
            // Front crawl: arms windmill half a cycle apart, a flutter kick at twice the rate.
            J[J_SH[1]] = Math.PI - stroke;
            J[J_SH[0]] = -stroke;
            J[J_AB[0]] = J[J_AB[1]] = 0.25;
            J[J_EL[1]] = 0.3 + Math.max(0, Math.sin(stroke)) * 1.2;
            J[J_EL[0]] = 0.3 + Math.max(0, -Math.sin(stroke)) * 1.2;
            J[J_HIP[0]] = Math.sin(stroke * 2) * 0.3 * (0.5 + drive);
            J[J_HIP[1]] = -Math.sin(stroke * 2) * 0.3 * (0.5 + drive);
            J[J_KNEE[0]] = J[J_KNEE[1]] = -0.2;
            J[J_HEAD_YAW] = Math.sin(stroke) * 0.6;
            J[J_HEAD_PITCH] = 0.1;
          } else {
            // Breaststroke: arms reach forward, sweep out and tuck back; frog kick.
            const c = Math.sin(stroke),
              pull = Math.max(0, c),
              recover = Math.max(0, -c);
            J[J_SH[0]] = J[J_SH[1]] = 2.9 - pull * 1.1;
            J[J_AB[0]] = J[J_AB[1]] = 0.2 + pull * 1.1;
            J[J_EL[0]] = J[J_EL[1]] = 0.2 + pull * 1.3;
            J[J_HIP[0]] = J[J_HIP[1]] = recover * 1.1;
            J[J_KNEE[0]] = J[J_KNEE[1]] = -0.2 - recover * 1.8;
            J[J_SPREAD] = 0.15 + recover * 0.45;
            J[J_HEAD_PITCH] = -0.5 + pull * 0.25;
            J[J_HEAD_YAW] = 0;
          }
          J[J_ARMFREE[0]] = J[J_ARMFREE[1]] = 0;
          J[J_LEAN] = 0;
          J[J_TWIST] = 0;
        } else if (sp.parachute) {
          const parts = sp.parachute.parts;
          J[J_LOCO] = 0;
          J[J_FALL] = 0;
          J[J_DROP] = 0;
          J[J_HOLD] = 0;
          J[J_SH[1]] = parts.arm1.rotation.z;
          J[J_SH[0]] = parts['arm-1'].rotation.z;
          J[J_AB[1]] = -parts.arm1.rotation.x;
          J[J_AB[0]] = parts['arm-1'].rotation.x;
          J[J_EL[0]] = J[J_EL[1]] = 0.35;
          J[J_HIP[1]] = parts.leg1.rotation.z;
          J[J_HIP[0]] = parts['leg-1'].rotation.z;
          J[J_KNEE[0]] = J[J_KNEE[1]] = -0.35;
          J[J_SPREAD] = Math.abs(parts.leg1.rotation.x);
          J[J_LEAN] = sp.parachute.torso.rotation.z;
          J[J_ARMFREE[0]] = J[J_ARMFREE[1]] = 0;
        }
      }
      /**
       * BEACHGOERS
       * Palm Keys Beach's people (beach.js) are drawn by the rig too: their
       * `pose` is mapped onto the rig's poses, `z` is their height (the sand, a
       * towel, a lounger, the lifeguard tower, the water), and swimmers get the
       * crawl or float on the surface like the player.
       */
      const BEACH_POSES = {
        walk: null,
        run: null,
        stand: null,
        wadeWalk: 'wade',
        wade: 'wade',
        sit: 'sitGround',
        ride: 'ride',
        recline: 'recline',
        kneel: 'kneelDig',
        lie: 'lieBack',
        lieFront: 'lieFront',
        tread: 'swim',
        ready: 'vbReady',
        hit: 'vbHit',
        bump: 'vbBump',
        dig: 'vbDig',
        set: 'vbSet',
        spike: 'vbSpike',
        serve: 'vbServe',
        cheer: 'cheer',
        throw: 'throw',
        // The SHARK! alarm (sealife.js).
        point: 'point',
      };
      const beachFacing = new Three.Matrix4();
      function beachSpec(p) {
        const sp = specScratch;
        resetSpec(sp);
        let entry = specialLooks.get(p);
        if (!entry) {
          entry = { outfit: 'beach', look: outfitLook(p, 'beach', (p.threshold || 0.5) * 997 + (p.phase || 0) * 13) };
          specialLooks.set(p, entry);
        }
        sp.look = entry.look;
        sp.facing = p.a || 0;
        sp.elevation = p.z || 0;
        const pose = p.pose;
        if (pose === 'swim' || pose === 'float') {
          const stroke = (p.phase || 0) * 3.2 + gameTime * (pose === 'swim' ? 3.2 : 0.8),
            onBack = pose === 'float';
          sp.elevation = (p.z || 0) + 1.3;
          crowdJoint(beachFacing, mIdentity, p.x, sp.elevation, p.y, onBack ? Math.PI / 2 : -Math.PI / 2 + 0.12, onBack ? 0 : Math.sin(stroke) * 0.35, -(p.a || 0));
          sp.rootOverride = beachFacing;
          sp.swim = { stroke, hard: true, drive: 0.7, float: onBack };
          return sp;
        }
        if (pose === 'tread') sp.elevation = (p.z || 0) - 9.3;
        sp.pose = BEACH_POSES[pose] ?? null;
        sp.lieInPlace = pose === 'lie' || pose === 'lieFront';
        return sp;
      }
      function drawBeachgoers(deltaSeconds, detail) {
        if (typeof beachgoers === 'undefined' || !beachgoers.length) return 0;
        if (Math.abs(cameraTarget.x + 2010) > 1900 || Math.abs(cameraTarget.y - 5620) > 1500) return 0;
        let n = 0;
        for (const p of beachgoers) {
          if (!p.visible || p.state === 'off' || p.pose === 'dive' || !entityInView(p, 30)) {
            const s = crowdState.get(p);
            if (s) s.seen = false;
            continue;
          }
          drawCrowdPerson(p, stateFor(p), deltaSeconds, detail, beachSpec(p));
          n++;
        }
        return n;
      }
      /**
       * RIDERS
       * Whoever rides a bicycle, a share bike, a motorbike or a jet ski is drawn
       * by the rig on the vehicle's model (render3d.js hands each one over with
       * `queueRider` once the vehicle is posed): hips on the seat, hands on the
       * grips and feet on the pedals (turning with the crank) or the pegs, all
       * by IK, leaning into the bars. The player keeps their own look.
       */
      const RIDER_SEATS = {
        bicycle: { seat: [-2.2, 15.25, 0], grip: [8.6, 18, 4.1], crank: 3, pedalZ: 2, lean: -0.45 },
        share: { seat: [-3.1, 16.25, 0], grip: [5.0, 17.4, 3.9], crank: 3, pedalZ: 2.6, lean: -0.32 },
        motorbike: { seat: [-5.2, 12.35, 0], grip: [6.8, 14, 3], peg: [0.2, 5.4, 3.4], lean: -0.32 },
        jetski: { seat: [-4.6, 8.1, 0], grip: [2.4, 9.6, 4.4], peg: [-3.8, 4.6, 3.1], lean: -0.22 },
      };
      const riderQueue = [],
        riderProxies = new WeakMap(),
        riderRoot = new Three.Matrix4(),
        riderRotation = new Three.Matrix4(),
        riderSeat = new Three.Vector3(),
        riderUp = new Three.Vector3(),
        riderHands = [new Three.Vector3(), new Three.Vector3()],
        riderFeet = [new Three.Vector3(), new Three.Vector3()],
        riderScratch = new Three.Vector3(),
        riderScale = new Three.Vector3();
      /* Called by render3d.js for a two-wheeler or jet ski whose rider shows; true when the rig draws them. */
      function queueRider(c, m) {
        riderQueue.push(c, m);
        return true;
      }
      function drawQueuedRiders(deltaSeconds, detail) {
        for (let i = 0; i < riderQueue.length; i += 2) {
          const c = riderQueue[i],
            m = riderQueue[i + 1],
            kind = m.jetski ? 'jetski' : c.shareBike ? 'share' : m.bicycle ? 'bicycle' : 'motorbike',
            // A model built at real size gives its own seat, grips and pegs (motorbikes3d.js).
            seat = m.riderSeat || RIDER_SEATS[kind],
            frame = m.rider.parent;
          if (!frame) continue;
          m.group.updateMatrixWorld(true);
          const M = frame.matrixWorld,
            isPlayer = c === player.car;
          let proxy = riderProxies.get(c);
          if (!proxy) riderProxies.set(c, (proxy = { x: c.x, y: c.y, a: c.a, hp: 1 }));
          proxy.x = c.x;
          proxy.y = c.y;
          proxy.a = c.a;
          const sp = isPlayer ? specialSpec(player) : specScratch;
          if (!isPlayer) {
            resetSpec(sp);
            let entry = specialLooks.get(c);
            const outfit = kind === 'motorbike' ? 'motorcyclist' : kind === 'jetski' ? 'jetskier' : 'cyclist';
            if (!entry || entry.outfit !== outfit) {
              entry = { outfit, look: outfitLook(c, outfit, (c.id || 1) * 7.31) };
              specialLooks.set(c, entry);
            }
            sp.look = entry.look;
          }
          sp.hold = null;
          sp.weapon = null;
          sp.swim = null;
          sp.parachute = null;
          sp.pose = 'riding';
          sp.riderLean = seat.lean;
          const R = compiledLook(sp.look, proxy),
            H = R.height * RIG_UNIT;
          // Root: the frame's rotation, the hips on the seat.
          M.decompose(riderSeat, crowdQuat, riderScale);
          riderRotation.makeRotationFromQuaternion(crowdQuat);
          riderSeat.set(...seat.seat).applyMatrix4(M);
          riderUp.set(0, 1, 0).applyQuaternion(crowdQuat);
          riderRoot.copy(riderRotation).setPosition(riderSeat.addScaledVector(riderUp, -(RIG.hip - 0.5) * H));
          sp.rootOverride = riderRoot;
          sp.elevation = riderSeat.y;
          sp.facing = c.a;
          for (let side = 0; side < 2; side++) {
            const z = (side ? 1 : -1) * seat.grip[2];
            riderHands[side].set(seat.grip[0] - 0.4, seat.grip[1] + 0.2, z).applyMatrix4(M);
            if (seat.crank && m.crank) {
              // The pedal on this side, then the ankle just above it.
              const a = (m.crank.rotation.z || 0) + (side ? 0 : Math.PI);
              riderScratch.set(m.crank.position.x - Math.sin(a) * seat.crank, m.crank.position.y + Math.cos(a) * seat.crank, (side ? 1 : -1) * seat.pedalZ);
              riderFeet[side].copy(riderScratch).applyMatrix4(M).addScaledVector(riderUp, RIG.ankle * H);
            } else riderFeet[side].set(seat.peg[0], seat.peg[1], (side ? 1 : -1) * seat.peg[2]).applyMatrix4(M).addScaledVector(riderUp, RIG.ankle * H);
          }
          sp.handTargets = riderHands;
          sp.legTargets = riderFeet;
          drawCrowdPerson(proxy, stateFor(proxy), deltaSeconds, detail, sp);
        }
        riderQueue.length = 0;
      }
      /**
       * ATHLETES
       * Footballers, basketball players, referees, assistants with their flags
       * and stewards (sports.js) are queued by sports3d.js and drawn here in
       * their kits, their touches mapped onto the rig's poses.
       */
      const athleteQueue = [];
      function queueAthlete(athlete, match) {
        athleteQueue.push(athlete, match);
      }
      function athleteSpec(a, match) {
        const sp = specScratch;
        resetSpec(sp);
        let entry = specialLooks.get(a);
        if (!entry || entry.kit !== a.kit) {
          entry = { outfit: 'athlete', kit: a.kit, look: outfitLook(a, 'athlete', (a.number || 7) * 13.7 + (a.team + 2) * 91 + a.id.length) };
          specialLooks.set(a, entry);
        }
        sp.look = entry.look;
        sp.facing = a.a || 0;
        sp.elevation = entityElevation(a) + (a.jump || 0);
        if (a.hp <= 0 || a.knockedFor > 0) return sp;
        if (a.fleeing || (match.abandoned && a.walking)) return sp;
        if (a.kind === 'assistant') {
          sp.flag = true;
          if (match.stage === 'live' && match.phase === 'restart') sp.pose = 'flagUp';
          return sp;
        }
        const progress = a.actionDuration > 0 ? 1 - a.actionTime / a.actionDuration : 0,
          ownsBall = match.ball.ownerId === a.id;
        sp.progress = progress;
        if (match.sport === 'basketball') {
          if (ownsBall && a.action === 'dribble') {
            sp.pose = 'bbDribble';
            sp.bounce = Math.abs(Math.sin(match.time * 8 + (a.number || 0)));
          } else if (a.action === 'shoot') sp.pose = 'bbShoot';
          else if (a.action === 'pass') sp.pose = 'bbPass';
          else if (a.action === 'rebound') sp.pose = 'bbRebound';
          else if (a.kind === 'athlete' && !ownsBall && match.possessionTeam !== a.team) sp.pose = 'bbDefend';
        } else if (a.action === 'shoot' || a.action === 'pass') sp.pose = 'kick';
        else if (a.action === 'save') sp.pose = 'save';
        if (a.action === 'celebrate') sp.pose = 'cheer';
        return sp;
      }
      function drawQueuedAthletes(deltaSeconds, detail) {
        for (let i = 0; i < athleteQueue.length; i += 2) {
          const a = athleteQueue[i],
            match = athleteQueue[i + 1],
            spec = athleteSpec(a, match);
          const hand = drawCrowdPerson(a, stateFor(a), deltaSeconds, detail, spec);
          if (spec.flag && hand && detail > 0) crowdEmit(P.flag, hand, 1, 1, 1);
        }
        athleteQueue.length = 0;
      }
