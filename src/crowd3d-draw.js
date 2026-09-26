      const HOLD_POSES = {
        pistolAim: { grip: [3.35, 4.55, 0.18], pitch: 0, twist: 0, lean: -0.06, headPitch: 0.12, aiming: true },
        pistolOneHand: { grip: [3.8, 4.55, 0.85], pitch: 0, twist: -0.3, lean: -0.04, headPitch: 0.08, oneHand: true, aiming: true },
        pistolReady: { grip: [2.05, 2.55, 0.45], pitch: -0.85, twist: 0, lean: 0, headPitch: 0.05 },
        // Carried in the firing hand at the side, muzzle down; the arms swing.
        pistolSide: { inHand: true, at: [0.12, -0.62, 0.02], rz: -1.2 },
        smgSide: { inHand: true, at: [0.1, -0.6, 0.04], rz: -1.05 },
        smgAim: { grip: [2.55, 3.85, 0.42], pitch: 0, twist: -0.25, lean: -0.1, headPitch: 0.2, aiming: true },
        smgReady: { grip: [1.9, 2.9, 0.5], pitch: -0.6, twist: -0.15, lean: 0, headPitch: 0.05 },
        longAim: { grip: [2.45, 3.88, 0.52], pitch: 0, twist: -0.45, lean: -0.16, headPitch: 0.3, headYaw: 0.28, aiming: true },
        longReady: { grip: [2.1, 3.05, 0.6], pitch: -0.55, twist: -0.3, lean: -0.05, headPitch: 0.1, headYaw: 0.15 },
        longCarry: { grip: [1.25, 2.75, 0.8], pitch: -0.5, yaw: -0.95, twist: 0, lean: 0, headPitch: 0 },
        rocket: { grip: [1.35, 3.55, 1.08], pitch: 0.03, twist: -0.2, lean: -0.08, headPitch: 0.15, headYaw: 0.2, aiming: true },
        knife: { grip: [2.3, 3.35, 0.9], pitch: 0.1, twist: -0.15, lean: -0.1, headPitch: 0.1, oneHand: true },
        fists: { twist: 0, lean: -0.1, headPitch: 0.15, fists: true },
        shield: { grip: [3.3, 4.4, 0.55], pitch: 0, twist: -0.2, lean: -0.12, headPitch: 0.1, oneHand: true, aiming: true },
      };
      const WEAPON_PAINTS = {
        pistol: rigPaint('#1d1f22', '#121315', '#121315', '#9aa6ae', [0, 1, 2, 3]),
        smg: rigPaint('#212326', '#141517', '#141517', '#8a969e', [0, 1, 2, 3]),
        shotgun: rigPaint('#222427', '#141516', '#6b4426', '#a0a4a8', [0, 1, 2, 3]),
        rifle: rigPaint('#26292c', '#1a1b1d', '#3a3226', '#3f6475', [0, 1, 2, 3]),
        rifleArmy: rigPaint('#2a2c2e', '#5f5646', '#5f5646', '#3f6475', [0, 1, 2, 3]),
        sniper: rigPaint('#2a2c2e', '#1a1b1d', '#5d4a33', '#3f5d6d', [0, 1, 2, 3]),
        rocket: rigPaint('#56603f', '#1e2019', '#3c4430', '#888888', [0, 1, 2, 3]),
        knife: rigPaint('#1c1c1c', '#101010', '#101010', '#cfd6db', [0, 1, 2, 3]),
        shield: rigPaint('#15181c', '#0f1113', '#0f1113', '#56707f', [0, 1, 2, 3]),
      };
      const PLAYER_WEAPONS = ['pistol', 'smg', 'shotgun', 'rocket', 'rifle', 'sniper', 'knife', null];
      const holdVec2 = new Three.Vector3(),
        holdPole = new Three.Vector3(),
        shoulderWorld = [new Three.Vector3(), new Three.Vector3()],
        handFrames = [new Three.Matrix4(), new Three.Matrix4()],
        legLocal = new Three.Vector3(),
        legInverse = new Three.Matrix4(),
        armTargets = [new Three.Vector3(), new Three.Vector3()];

      // Per-person gait scratch (both sides), reused so packing allocates nothing.
      const gaitHip = new Float32Array(2),
        gaitKnee = new Float32Array(2),
        gaitFoot = new Float32Array(2),
        gaitArm = new Float32Array(2),
        gaitElbow = new Float32Array(2),
        gaitAbduct = new Float32Array(2);
      /* Which poses carry something that needs the phone in hand. */
      const PHONE_POSES = new Set(['text', 'phone', 'film']);
      /* The far figure: plain standing or walking people only. */
      function farFigureOk(p, spec, J) {
        return !spec?.hold && !spec?.rootOverride && !(p.hp <= 0) && J[J_FALL] < 0.02 && J[J_DROP] > -0.6 && J[J_LOCO] > 0.9 && !p.sitting && !p.dancing;
      }
      /**
       * Pack one person. `detail` 2 full, 1 without hands and small props, 0 far
       * (the figure, when they are only standing or walking). `spec` (special
       * characters) carries the outfit, what they hold and pose overrides.
       */
      function drawCrowdPerson(p, s, deltaSeconds, detail, spec = null) {
        const look = spec?.look || p.look || ensureLook(p),
          R = compiledLook(look, p),
          J = s.joints,
          T = poseTarget,
          t = gameTime,
          dt = deltaSeconds;
        // Measure how far they actually moved: that drives the stride.
        const dx = p.x - s.x,
          dy = p.y - s.y,
          moved = Math.hypot(dx, dy),
          facing = spec?.facing ?? p.a ?? 0;
        s.x = p.x;
        s.y = p.y;
        // Still and unchanged since their instances were recorded: copy them (STILL FIGURES).
        const stillPose = spec ? spec.pose : p.pose,
          dead = p.hp <= 0,
          still = s.still;
        if (
          still &&
          s.seen &&
          moved < 1e-4 &&
          still.pose === stillPose &&
          still.dead === dead &&
          still.detail === detail &&
          still.body === BODY &&
          still.look === R &&
          still.facing === facing &&
          hitFlinch(p) === 0
        ) {
          replayInstances(still.records);
          crowdStillCount++;
          return null;
        }
        let fresh = false;
        if (moved > 40 || !s.seen) {
          s.speed = 0;
          s.yaw = s.hipYaw = s.moveYaw = facing;
          s.seen = true;
          fresh = true;
        } else if (dt > 0) {
          s.speed += (moved / dt - s.speed) * (1 - Math.exp(-dt * 10));
          if (moved > 1e-3) s.moveYaw += normalizeAngle(Math.atan2(dy, dx) - s.moveYaw) * (1 - Math.exp(-dt * 12));
        }
        s.umbrella = weather.rain > 0.25 && !!look.umbrella && !p.react && !p.sitting && p.hp > 0 && !p.scene && !spec;
        s.guitar = false;
        s.ember = false;
        crowdPoseTargets(p, s, T, t + s.seed, spec);
        // Ease the base pose.
        const k = 1 - Math.exp(-dt * (p.react || spec?.hold?.aiming ? 14 : 9));
        let unsettled = 0;
        for (let i = 0; i < J_COUNT; i++) {
          const d = (T[i] - J[i]) * (dt > 0 && !fresh ? k : 1);
          J[i] += d;
          unsettled = Math.max(unsettled, Math.abs(T[i] - J[i]));
        }
        if (p.hp <= 0 && !p.deathStyle?.slump) J[J_FALL] = personFallAmount(p);
        // Lying still and settled: copy last frame's instances (STILL FIGURES).
        const settledStill =
          unsettled < 0.003 &&
          !p.ejected &&
          ((p.hp <= 0 && J[J_FALL] >= 0.999) || (STILL_POSES.has(spec?.pose) && hitFlinch(p) === 0)) &&
          moved < 1e-4;
        s.still = null;
        if (settledStill) {
          // Record this frame's instances; later frames copy them.
          s.still = { pose: stillPose, dead, detail, body: BODY, look: R, facing, records: [] };
          crowdRecording = s.still.records;
        }
        // Swimming strokes and the parachute set the limbs outright.
        if (spec && (spec.swim || spec.parachute)) applyLimbOverrides(spec, J);
        // Facing. The upper body turns to where they face; the hips follow the
        // direction of travel (strafing, backing away) or, standing, step round
        // once the twist grows large.
        const aimRate = spec?.snapFacing ? 40 : s.speed > 20 ? 12 : 8;
        s.yaw += clamp(normalizeAngle(facing - s.yaw), -aimRate * dt, aimRate * dt) || 0;
        if (dt === 0 || fresh) s.yaw = facing;
        const H = R.height * RIG_UNIT,
          loco = J[J_LOCO] * clamp((s.speed - 1.5) / 5, 0, 1);
        let strideSign = 1;
        if (loco > 0.05) {
          const rel = normalizeAngle(s.moveYaw - s.yaw),
            back = Math.abs(rel) > 1.95;
          if (back) strideSign = -1;
          const hipTarget = s.yaw + clamp(back ? normalizeAngle(rel - Math.PI) : rel, -1.2, 1.2) * 0.85;
          s.hipYaw += normalizeAngle(hipTarget - s.hipYaw) * (1 - Math.exp(-dt * 10));
          s.turning = false;
        } else {
          const lag = normalizeAngle(s.yaw - s.hipYaw);
          if (Math.abs(lag) > (spec?.hold ? 0.55 : 0.8)) s.turning = true;
          if (s.turning) {
            const step = clamp(lag, -4.5 * dt, 4.5 * dt);
            s.hipYaw += step;
            s.turnPhase += Math.abs(step) * 4.2;
            if (Math.abs(lag) < 0.06) s.turning = false;
          }
        }
        if (fresh || J[J_FALL] > 0.02 || J[J_LOCO] < 0.2) {
          s.hipYaw = s.yaw;
          s.turning = false;
        }
        const upperTurn = normalizeAngle(s.yaw - s.hipYaw);
        // The gait. One cycle (two steps) covers strideCycle (game.js), a
        // little shorter for smaller people.
        const run = clamp((s.speed - 20) / 18, 0, 1),
          cycle = strideCycle(s.speed) * (0.55 + 0.45 * R.height);
        if (!fresh && dt > 0) s.phase += (moved / cycle) * TAU * strideSign * (p.injured || spec?.limp ? 0.8 : 1);
        const phi = s.phase,
          beta = 0.62 - 0.26 * run,
          L1 = RIG.thigh,
          L2 = RIG.shin,
          stanceLen = Math.min((beta * cycle) / H, 6.4),
          liftH = 0.75 + 2.3 * run,
          bobWalk = -0.28 * (0.5 + 0.5 * Math.cos(2 * phi)),
          bobRun = 0.55 * (0.5 - 0.5 * Math.cos(2 * (phi - Math.PI * beta))) - 0.4,
          bob = loco * (bobWalk + (bobRun - bobWalk) * run),
          hipY = RIG.hip + J[J_DROP] + bob;
        const legHip = gaitHip,
          legKnee = gaitKnee,
          footPitch = gaitFoot;
        const limp = p.injured || spec?.limp;
        for (let side = 0; side < 2; side++) {
          let hip = J[J_HIP[side]],
            knee = J[J_KNEE[side]],
            pitch = 0;
          if (loco > 0.01) {
            let u = ((phi + side * Math.PI) / TAU) % 1;
            if (u < 0) u += 1;
            let fx, lift;
            if (u < beta) {
              const q = u / beta;
              fx = stanceLen * (0.5 - q);
              lift = 0;
              pitch = q < 0.14 ? 0.28 * (1 - q / 0.14) : q > 0.7 ? -0.75 * Math.pow((q - 0.7) / 0.3, 2) : 0;
            } else {
              const q = (u - beta) / (1 - beta),
                e = q * q * (3 - 2 * q);
              fx = stanceLen * (-0.5 + e);
              lift = liftH * Math.pow(Math.sin(Math.PI * Math.pow(q, 0.8 - 0.25 * run)), 0.9);
              pitch = -0.55 * (1 - q) * (1 - q) + 0.22 * q * q;
            }
            if (limp && side === 1) {
              fx *= 0.55;
              lift *= 0.4;
            }
            fx *= strideSign;
            const leg = solveLeg(fx, -(hipY - RIG.ankle - lift), L1, L2);
            hip += (leg.hip - hip) * loco;
            knee += (leg.knee - knee) * loco;
            pitch *= loco;
          }
          if (s.turning && loco < 0.3) {
            const lift = Math.max(0, Math.sin(s.turnPhase + side * Math.PI)) * 0.6;
            hip += lift * 0.35;
            knee -= lift * 0.7;
          }
          legHip[side] = hip;
          legKnee[side] = knee;
          footPitch[side] = pitch;
        }
        const hipsDiff = legHip[0] - legHip[1],
          pelvisYaw = -0.12 * hipsDiff * loco,
          lean = J[J_LEAN] - loco * (0.03 + run * 0.17),
          twist = J[J_TWIST] - clamp(upperTurn, -1.1, 1.1) + 0.2 * hipsDiff * loco * (1 - J[J_HOLD] * 0.8),
          roll = J[J_ROLL] + loco * (limp ? 0.1 * Math.sin(phi) : 0.02 * Math.cos(phi));
        // Arms swing against the legs, bent more at a run.
        const armSwing = gaitArm,
          elbows = gaitElbow,
          abduct = gaitAbduct,
          meanHip = (legHip[0] + legHip[1]) / 2;
        for (let side = 0; side < 2; side++) {
          const free = loco * J[J_ARMFREE[side]];
          armSwing[side] = J[J_SH[side]] - free * (0.85 + run * 0.45) * (legHip[side] - meanHip);
          elbows[side] = J[J_EL[side]] + free * (0.22 + run * 1.15 + Math.max(0, armSwing[side]) * 0.35);
          abduct[side] = J[J_AB[side]] - free * run * 0.12;
        }
        // Breathing: the chest rises a little, faster after running.
        s.breath = (s.breath || 0) + dt * (1.7 + Math.min(1, s.speed / 40) * 2.5);
        const breathe = p.hp <= 0 ? 0 : Math.sin(s.breath) * (1 - loco * 0.5),
          shrug = breathe * 0.035;
        const elevation = spec?.elevation ?? entityElevation(p),
          fall = J[J_FALL];
        // Someone lying along the camera's line of sight reads as standing, so a
        // body going down turns a little across the screen as it falls.
        if (fall < 0.05 || spec?.lieInPlace) s.fallTurn = null;
        else if (s.fallTurn == null) {
          const along = Math.abs(Math.sin(s.hipYaw));
          s.fallTurn = along > 0.6 ? (s.seed % 2 < 1 ? 1 : -1) * (0.7 + (s.seed % 0.4)) : 0;
        }
        const fallSign = p.hp <= 0 ? (p.deathStyle?.sign ?? 1) : p.pose === 'crawl' || spec?.pose === 'crawl' || spec?.pose === 'lieFront' ? -1 : 1,
          fallYaw = ((s.fallTurn || 0) + (p.hp <= 0 ? p.deathStyle?.turn || 0 : 0)) * fall;
        // Root: position, heading, then the fall (a rotation about the lateral
        // axis): over backwards, or face down for fallSign -1.
        const thrown = spec?.thrown || (p.ejected?.rider ? p.ejected : null);
        if (spec?.rootOverride) mRoot.copy(spec.rootOverride);
        else if (thrown) {
          // Thrown off a bike (riders.js): somersaulting about the hips along the
          // flight (`pitch`), the hips `z` above the road; flat once down.
          const hips = RIG.hip * H,
            along = -hips * Math.sin(thrown.pitch);
          crowdJoint(
            mRoot,
            mIdentity,
            p.x + Math.cos(thrown.heading) * along,
            elevation + thrown.z - hips * Math.cos(thrown.pitch) + 1.2,
            p.y + Math.sin(thrown.heading) * along,
            -thrown.pitch,
            0,
            -thrown.heading,
          );
        } else {
          // Someone lying down on purpose (a sunbather) lies with their hips on the spot, not their feet.
          const shift = spec?.lieInPlace ? fallSign * RIG.hip * H * fall : 0,
            heading = s.hipYaw + fallYaw;
          crowdJoint(mRoot, mIdentity, p.x + Math.cos(heading) * shift, elevation + fall * 1.2 * H, p.y + Math.sin(heading) * shift, (fallSign * fall * Math.PI) / 2, p.ejected ? p.ejectRoll || 0 : 0, -heading);
        }
        mRoot.scale(crowdScale.set(H, H, H));
        rigRimFlag = spec?.rim ? 16 : 0;
        const w = R.width,
          paints = R.paints;
        // Far away and simply standing or walking: three instances.
        if (detail === 0 && farFigureOk(p, spec, J)) {
          crowdJoint(mHips, mRoot, 0, bob, 0, 0, 0, pelvisYaw);
          rigEmit(P.figure, mHips, w, 1, w, paints.figure);
          for (let side = 0; side < 2; side++) {
            crowdJoint(mOut, mRoot, 0, hipY, (side ? 1 : -1) * R.hipZ * w, legHip[side] * 0.8);
            rigEmit(P.figureLeg, mOut, 1, 1, 1, paints.figureLeg);
          }
          crowdRecording = null;
          return null;
        }
        crowdJoint(mHips, mRoot, 0, hipY, 0, -run * loco * 0.06, roll * 0.4, pelvisYaw);
        crowdJoint(mTorso, mHips, 0, RIG.waist, 0, lean, roll, twist);
        rigEmit(BODY[R.pelvis], mHips, w, 1, w, paints.pelvis);
        if (R.skirtOn) rigEmit(BODY.skirt, mHips, w, 1, w, paints.skirt);
        if (R.belt) rigEmit(BODY.belt, mHips, w, 1, w, paints.belt);
        // The torso breathes (a touch deeper and taller at the chest).
        rigEmit(BODY[R.torso], mTorso, w * (1 + breathe * 0.012), 1 + breathe * 0.006, w, paints.torso);
        if (R.collar) rigEmit(BODY.collar, mTorso, w, 1, w, paints.collar);
        if (R.hood) rigEmit(BODY.hood, mTorso, w, 1, w, paints.hood);
        if (R.vest) rigEmit(BODY.vest, mTorso, w, 1, w, paints.vest);
        if (R.label) {
          crowdJoint(mOut, mTorso, -(R.vest ? 1.16 : 1.0) * w, 2.62, 0);
          crowdEmit(R.label, mOut, 1, 1, w);
        }
        if (R.radio && detail > 1) {
          crowdJoint(mOut, mTorso, 0.72 * w, 2.95, -1.02 * w, 0, 0.3, 0);
          rigEmit(BODY.radio, mOut, 1, 1, 1, paints.radio);
        }
        if (R.backpack || look.backpack) {
          crowdJoint(mOut, mTorso, -1.42 * w, 1.9, 0);
          rigEmit(BODY.backpack, mOut, 1, 1, w, paints.backpack);
        }
        // Head: turned towards what they look at, steadied against the stride.
        const headYaw = J[J_HEAD_YAW] - (upperTurn - clamp(upperTurn, -1.1, 1.1)) - 0.2 * hipsDiff * loco * 0.8;
        crowdJoint(mHead, mTorso, 0.04, RIG.neck, 0, -J[J_HEAD_PITCH] - lean * 0.3, 0, headYaw);
        const hs = R.headScale;
        rigEmit(BODY.head, mHead, hs, hs, hs, paints.head);
        if (R.hatPart) rigEmit(BODY[R.hatPart], mHead, hs, hs, hs, paints.hat);
        if (R.hairPart && !(R.hatPart && R.hairPart === 'hairCurly')) rigEmit(BODY[R.hairPart], mHead, hs, hs, hs, paints.hair);
        // Shoulders.
        for (let side = 0; side < 2; side++) {
          const sign = side ? 1 : -1;
          crowdJoint(mShoulder[side], mTorso, 0, RIG.shoulderY + shrug, sign * R.shoulderZ * w, armSwing[side], -sign * abduct[side], 0);
          crowdJoint(mElbow[side], mShoulder[side], 0, -RIG.upperArm, 0, elbows[side]);
          crowdJoint(mHand[side], mElbow[side], 0, -RIG.forearm, 0, 0.1);
        }
        // Weapons and fists: both hands to the hold by IK.
        const hold = spec?.hold,
          holdWeight = J[J_HOLD];
        if (hold?.inHand) {
          crowdJoint(mGun, mHand[1], hold.at[0], hold.at[1], hold.at[2], hold.rz);
          rigEmit(P[spec.weapon], mGun, 1, 1, 1, WEAPON_PAINTS[spec.weapon] || WEAPON_PAINTS.pistol);
        } else if (hold && holdWeight > 0.05) drawHold(p, s, spec, hold, H, elevation, hipY, holdWeight);
        // A rider's hands on the bars (RIDERS).
        if (spec?.handTargets) {
          for (let side = 0; side < 2; side++) {
            shoulderWorld[side].setFromMatrixPosition(mShoulder[side]);
            holdPole.set(-0.4, -1, (side ? 1 : -1) * 0.6).transformDirection(mTorso);
            ikArm(mShoulder[side], mElbow[side], mHand[side], shoulderWorld[side], spec.handTargets[side], holdPole, RIG.upperArm * H, RIG.forearm * H, H);
          }
        }
        const armPaint = paints.upperArm,
          forePaint = paints.forearm;
        for (let side = 0; side < 2; side++) {
          rigEmit(BODY.upperArm, mShoulder[side], w, 1, w, armPaint);
          rigEmit(BODY.forearm, mElbow[side], w, 1, w, forePaint);
          if (detail > 1) rigEmit(BODY.hand, mHand[side], 1, 1, 1, paints.hand);
        }
        // Legs.
        for (let side = 0; side < 2; side++) {
          const sign = side ? 1 : -1;
          let hip = legHip[side],
            knee = legKnee[side],
            spread = J[J_SPREAD];
          if (spec?.legTargets) {
            // A rider's feet on the pedals or pegs: the target in the pelvis frame.
            legLocal.copy(spec.legTargets[side]).applyMatrix4(legInverse.copy(mHips).invert());
            const leg = solveLeg(legLocal.x, legLocal.y, RIG.thigh, RIG.shin);
            hip = leg.hip;
            knee = leg.knee;
            spread = clamp(Math.atan2(sign * legLocal.z - R.hipZ * w, -legLocal.y), -0.15, 0.5);
          }
          crowdJoint(mHip[side], mHips, 0, 0, sign * R.hipZ * w, hip, -sign * spread, 0);
          rigEmit(BODY[R.thigh], mHip[side], w, 1, w, paints.thigh);
          crowdJoint(mKnee[side], mHip[side], 0, -RIG.thigh, 0, knee);
          rigEmit(BODY.shin, mKnee[side], w, 1, w, paints.shin);
          // The foot stays flat on the ground through the stance, rolls onto the
          // toes at push-off and hangs toes-down in the swing.
          const flat = fall > 0.5 ? 0.3 : 1;
          crowdJoint(mFoot, mKnee[side], 0, -RIG.shin, 0, -(hip + knee) * flat + footPitch[side] + (-run * loco * 0.06));
          rigEmit(BODY[R.shoePart], mFoot, 1, 1, 1, paints.shoe);
        }
        // Things in hand.
        const right = mHand[1];
        if (detail > 1 && !hold) {
          const pose = p.pose || (p.onPhone ? 'phone' : null);
          if (PHONE_POSES.has(pose)) crowdEmit(P.phone, right, 1, 1, 1);
          if (p.carry === 'camera') crowdEmit(P.phone, right, 2.2, 1.1, 1.8);
          if (p.carry === 'briefcase' && p.hp > 0 && !s.umbrella) crowdEmit(P.briefcase, right, 1, 1, 1);
          if ((p.carry === 'shopping' || p.carry === 'handbag') && p.hp > 0 && !s.umbrella)
            crowdEmit(P.shopping, right, p.carry === 'handbag' ? 0.75 : 1, p.carry === 'handbag' ? 0.8 : 1, 1, cachedCrowdColor(umbrellaColors, p.carry === 'handbag' ? look.bagColor || '#6b2f36' : ['#e9dcc4', '#c9a26b', '#f2f0ea', '#b8413a'][Math.floor(((look.build || 1) * 97) % 4)]));
          if ((p.carry === 'coffee' || p.carry === 'food') && p.hp > 0 && !PHONE_POSES.has(pose)) crowdEmit(P.cup, right, 1, 1, 1);
          if (s.ember) crowdEmit(P.ember, right, 1, 1, 1);
          if (spec?.cocktail && p.hp > 0) crowdEmit(P.cocktail, right, 1, 1, 1);
          if (p.hp > 0 && p.club) {
            const pose = p.pose;
            if (p.carry === 'cocktail' && pose !== 'dj' && pose !== 'swim' && pose !== 'lounge') crowdEmit(P.cocktail, right, 1, 1, 1);
            if (p.carry === 'sparkler') {
              crowdEmit(P.bottle, right, 1, 1, 1);
              const e = right.elements;
              for (let k = 0; k < 3; k++) {
                const f = Math.sin(gameTime * 40 + k * 2.1) * 0.5 + 0.6;
                crowdJoint(mOut, mIdentity, e[12] + Math.sin(gameTime * 23 + k) * 0.8, e[13] + 2.3 + k * 0.45, e[14] + Math.cos(gameTime * 29 + k) * 0.8);
                crowdEmit(P.spark, mOut, f * 0.36, f * 0.36, f * 0.36);
              }
            }
            if (pose === 'sweep') crowdEmit(P.broom, right, 1, 1, 1);
          }
        }
        if (p.carry === 'tray' && p.hp > 0 && p.pose === 'tray') {
          // The tray stays flat whatever the wrist is doing.
          const e = right.elements;
          crowdJoint(mOut, mIdentity, e[12], e[13] + 0.3, e[14], 0, 0, -s.yaw);
          crowdEmit(P.tray, mOut, H, H, H);
        }
        if (p.carry === 'box' && p.hp > 0) {
          crowdJoint(mOut, mTorso, 2.3, 1.7, 0);
          crowdEmit(P.carton, mOut, 1, 1, 1);
        }
        if (s.guitar) {
          crowdJoint(mOut, mTorso, 1.85, 1.5, 0.25, 0, 0.55, 0);
          crowdEmit(P.guitar, mOut, 1, 1, 1);
        }
        if (s.umbrella) {
          // The canopy stays upright whatever the arm is doing.
          const e = right.elements;
          crowdJoint(mOut, mIdentity, e[12], e[13], e[14], -0.12, 0, -s.yaw);
          crowdEmit(P.umbrella, mOut, H, H, H, cachedCrowdColor(umbrellaColors, look.umbrella || '#1b1d22'));
        }
        rigRimFlag = 0;
        crowdRecording = null;
        return right;
      }
      /**
       * Weapons in hand. The hold's grip is placed in the aim frame (at the
       * hips, turned to where they face), with recoil and the reload, the
       * weapon is drawn there, and the wrists are brought to its grip and
       * handguard by IK (overwriting the posed arm matrices).
       */
      function drawHold(p, s, spec, hold, H, elevation, hipY, weight) {
        crowdJoint(mAim, mIdentity, p.x, elevation + hipY * H, p.y, 0, 0, -s.yaw);
        mAim.scale(crowdScale.set(H, H, H));
        for (let side = 0; side < 2; side++) shoulderWorld[side].setFromMatrixPosition(mShoulder[side]);
        const L1 = RIG.upperArm * H,
          L2 = RIG.forearm * H,
          recoil = spec.recoil || 0,
          reload = spec.reload ?? -1,
          reloadBump = reload >= 0 ? Math.sin(Math.PI * clamp(reload, 0, 1)) : 0;
        let rightTarget = null,
          leftTarget = null,
          rightFrame = null,
          leftFrame = null;
        if (hold.fists) {
          // Guard up at the chin; the punching hand snaps out and back.
          const lead = spec.punchLead ?? 1,
            punch = spec.punch || 0;
          for (let side = 0; side < 2; side++) {
            const sign = side ? 1 : -1,
              isLead = side === lead,
              x = isLead ? 2.1 + punch * 2.3 : 1.55,
              z = sign * (isLead ? 0.45 - punch * 0.4 : 0.62);
            armTargets[side].set(x, 4.55 - (isLead ? punch * 0.15 : 0), z).applyMatrix4(mAim);
          }
          rightTarget = armTargets[1];
          leftTarget = armTargets[0];
        } else if (spec.weapon) {
          const g = hold.grip,
            info = WEAPON_HOLDS[spec.weapon] || WEAPON_HOLDS.pistol,
            knife = spec.weapon === 'knife' ? spec.knifeSwing || 0 : 0,
            slash = Math.sin(knife * Math.PI);
          crowdJoint(
            mGun,
            mAim,
            g[0] - recoil * (info.shoulder ? 0.25 : 0.5) + slash * 1.2 - reloadBump * 0.5,
            g[1] + recoil * (info.shoulder ? 0.05 : 0.2) - reloadBump * 0.6 + slash * 0.4,
            g[2] - slash * 1.6 - reloadBump * 0.2,
            (hold.pitch || 0) + recoil * (info.shoulder ? 0.1 : 0.32) + reloadBump * 0.45,
            reloadBump * 0.6,
            (hold.yaw || 0) + slash * 1.1,
          );
          const kind = spec.weapon === 'rifle' && spec.army ? 'rifleArmy' : spec.weapon;
          rigEmit(P[spec.weapon], mGun, 1, 1, 1, WEAPON_PAINTS[kind] || WEAPON_PAINTS.pistol);
          // The firing hand: its wrist a little behind and above the grip.
          // The firing hand wraps the grip: the wrist a little behind and above it,
          // the hand down the grip, fingers round the front.
          crowdJoint(handFrames[1], mGun, -0.3, 0.34, 0.02, 0.22);
          rightTarget = armTargets[1].setFromMatrixPosition(handFrames[1]);
          rightFrame = handFrames[1];
          if (info.support && !hold.oneHand) {
            const sp = info.support,
              k = WEAPON_SCALE_OF(spec.weapon),
              pistolGrip = spec.weapon === 'pistol';
            // Reloading: the support hand goes to the magazine and back.
            crowdJoint(
              handFrames[0],
              mGun,
              sp[0] * k - reloadBump * (sp[0] * k - 0.5) + (pistolGrip ? -0.22 : -0.3),
              sp[1] + (pistolGrip ? 0.3 : 0.12) - reloadBump * 1.1,
              sp[2] - (pistolGrip ? 0.08 : 0.22),
              pistolGrip ? 0.22 : 0.9,
              pistolGrip ? 0 : -0.5,
            );
            leftTarget = armTargets[0].setFromMatrixPosition(handFrames[0]);
            leftFrame = handFrames[0];
          }
        }
        if (spec.shield) {
          // The ballistic shield on the left forearm, square to the front.
          crowdJoint(mShieldM, mAim, 2.6, 3.9, -0.55, 0, 0, 0.08);
          rigEmit(P.shield, mShieldM, 1, 1, 1, WEAPON_PAINTS.shield);
          crowdJoint(mOut, mShieldM, 0.52, -1.0, 0, -0.3);
          crowdEmit(P.labelPolice, mOut, 1.3, 1.3, 1.3);
          crowdJoint(handFrames[0], mShieldM, -0.3, 0.55, 0.1, 0.1);
          leftTarget = armTargets[0].setFromMatrixPosition(handFrames[0]);
          leftFrame = handFrames[0];
        }
        for (let side = 0; side < 2; side++) {
          const target = side ? rightTarget : leftTarget;
          if (!target) continue;
          const sign = side ? 1 : -1;
          // Blend from the posed wrist while the hold eases in.
          if (weight < 0.999) {
            holdVec2.setFromMatrixPosition(mHand[side]);
            target.lerpVectors(holdVec2, target, weight);
          }
          // Elbows down and out, a little back.
          holdPole.set(-0.25, -1, sign * 0.7).transformDirection(mAim);
          ikArm(mShoulder[side], mElbow[side], mHand[side], shoulderWorld[side], target, holdPole, L1, L2, H);
          // A hand on the weapon takes the weapon's frame once the hold is in.
          const frame = side ? rightFrame : leftFrame;
          if (frame && weight > 0.6) mHand[side].copy(frame);
        }
      }
      const WEAPON_SCALE_OF = (weapon) => (weapon === 'shield' ? 1 : WEAPON_SCALE);
