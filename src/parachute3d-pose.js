      // Parachute 3D pose: the rig's state (chuteRig), the jumper's body through the jump (box, the pull, line
      // stretch, hanging) and the pendulum under the wing, driven by the rig's own accelerations (poseParachutist).
      /* ---- Rig state -------------------------------------------------------------- */
      const chuteRig = {
        active: false,
        roll: 0,
        rollRate: 0,
        // The line from the harness to the wing against the vertical (positive: the wing behind the jumper).
        pitch: 0,
        pitchRate: 0,
        turn: 0,
        flare: 0,
        // The deployment brakes (tails half down) as drawn: eased off when they are unstowed.
        brakes: 0,
        heading: 0,
        // Forward speed last frame and the forward acceleration it gives (units/s, units/s²).
        along: null,
        sampledAt: 0,
        accel: 0,
        harness: new Three.Vector3(),
        quaternion: new Three.Quaternion(),
        // 0 in the box position .. 1 hanging under the lines (a sprung swing at line stretch).
        upright: 0,
        uprightRate: 0,
        // After landing: where the canopy came down and how long ago.
        collapse: null,
        lastStage: null,
        lastOpening: 0,
        pilotLag: new Three.Vector3(),
        // The jump (player.parachute) the state belongs to.
        jump: null,
      };
      const chuteEuler = new Three.Euler(0, 0, 0, 'YXZ'),
        chuteTmp = new Three.Vector3(),
        chuteTmp2 = new Three.Vector3(),
        chuteHarnessOffset = new Three.Vector3(0, 11.4 * (PERSON_HEIGHT / 14), 0),
        chuteRiser = [new Three.Vector3(), new Three.Vector3(), new Three.Vector3(), new Three.Vector3()];
      const smooth01 = (a, b, x) => {
        const t = clamp((x - a) / (b - a), 0, 1);
        return t * t * (3 - 2 * t);
      };
      // Ease with a small overshoot: the canopy "snaps" open and settles.
      const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
      /**
       * Pose the player's body for the parachute (called from the person pass).
       * Freefall: belly to earth, arched, arms and legs spread; the pull throws
       * the pilot chute with the right hand. The lines paying out start to lift the
       * shoulders and line stretch swings the body upright (a sprung swing), then
       * it hangs from the harness on the pendulum, hands on the toggles. Records
       * `chuteRig.harness`, where the rig hangs from: the container on the back,
       * moving to the shoulders as the body comes upright.
       *
       * The pendulum (chuteRig.pitch): until the wing flies the lines trail in the
       * relative wind (behind a jumper still moving forward); flying, the wing and
       * the jumper swing about the harness as a pendulum of the lines' length,
       * pushed by the rig's forward acceleration: it leads as it starts to fly and
       * as it surges off its deployment brakes (the jumper swinging back under it),
       * and drops back when it slows in a flare (the jumper swinging forward).
       */
      function poseParachutist(m, deltaSeconds) {
        const p = player.parachute,
          arms = [m.parts.arm1, m.parts['arm-1']],
          legs = [m.parts.leg1, m.parts['leg-1']];
        if (!p) {
          if (chuteRig.active) for (const part of [...arms, ...legs]) part.rotation.x = 0;
          chuteRig.active = false;
          chuteRig.upright = chuteRig.uprightRate = 0;
          chuteRig.along = null;
          chuteRig.accel = 0;
          chutePack.visible = false;
          return;
        }
        chuteRig.active = true;
        // A new jump starts from the box position, whatever the last one ended in.
        if (chuteRig.jump !== p) {
          chuteRig.jump = p;
          chuteRig.upright = chuteRig.uprightRate = chuteRig.pitch = chuteRig.pitchRate = chuteRig.roll = chuteRig.rollRate = 0;
          chuteRig.brakes = chuteRig.accel = 0;
          chuteRig.along = null;
        }
        const dt = Math.min(0.05, deltaSeconds || 0.016),
          turnInput = (actionHeld('right') ? 1 : 0) - (actionHeld('left') ? 1 : 0),
          agl = player.altitude - terrainHeight(player.x, player.y),
          canopy = p.stage === 'canopy',
          phase = canopy ? p.phase : 'freefall',
          k = canopy ? p.phaseK : 0,
          flying = phase === 'open',
          // Brakes stay stowed until the canopy flies; the last few metres a jumper flares whether or not you ask.
          flareInput = flying && actionHeld('back') ? 1 : 0,
          autoFlare = flying ? smooth01(40, 12, agl) : 0;
        chuteRig.turn += (turnInput - chuteRig.turn) * (1 - Math.exp(-dt * 4));
        chuteRig.flare += (Math.max(flareInput, autoFlare) - chuteRig.flare) * (1 - Math.exp(-dt * 5));
        // Deployment brakes: set as it opens, let off quickly once the toggles are unstowed.
        const brakesTarget = canopy && (!flying || p.brakesSet) ? 0.42 : 0;
        chuteRig.brakes += (brakesTarget - chuteRig.brakes) * (1 - Math.exp(-dt * (brakesTarget > chuteRig.brakes ? 3 : 7)));
        chuteRig.heading = p.heading;
        m.parts.guns.forEach((gun) => (gun.visible = false));
        // Box position to hanging: the lines lift the shoulders a little as they pay
        // out, line stretch swings the body upright with a small overshoot.
        if (!canopy) chuteRig.upright = chuteRig.uprightRate = 0;
        else {
          const target = phase === 'pilot' ? 0 : phase === 'lines' ? 0.3 * k * k : 1;
          chuteRig.uprightRate += ((target - chuteRig.upright) * 40 - chuteRig.uprightRate * 9) * dt;
          chuteRig.upright = clamp(chuteRig.upright + chuteRig.uprightRate * dt, 0, 1.08);
        }
        const u = clamp(chuteRig.upright, 0, 1);
        // The rig's forward acceleration (along the heading), from the game's velocity over the game time between frames.
        const along = p.vx * Math.cos(p.heading) + p.vy * Math.sin(p.heading),
          elapsed = gameTime - chuteRig.sampledAt,
          accel = chuteRig.along == null || !(elapsed > 0) ? 0 : (along - chuteRig.along) / elapsed;
        if (chuteRig.along == null || elapsed > 0) {
          chuteRig.along = along;
          chuteRig.sampledAt = gameTime;
        }
        chuteRig.accel += (clamp(accel, -3 * GRAVITY, 3 * GRAVITY) - chuteRig.accel) * (1 - Math.exp(-dt * 12));
        if (!canopy) chuteRig.roll = chuteRig.rollRate = chuteRig.pitch = chuteRig.pitchRate = 0;
        else {
          const opening = p.opening,
            fall = Math.max(1, -p.vz),
            // The lines trail in the relative wind while the wing is not yet flying.
            trail = Math.atan2(along, fall) * (1 - opening),
            rollTarget = chuteRig.turn * 0.5 * opening,
            pitchTarget =
              trail + (chuteRig.flare * 0.14 - (flying && actionHeld('forward') ? 0.08 : 0)) * opening - (chuteRig.accel / GRAVITY) * 0.45 * opening;
          chuteRig.rollRate += ((rollTarget - chuteRig.roll) * 9 - chuteRig.rollRate * 3.2) * dt;
          // About a 3 s swing, lightly damped: the surge rocks the jumper through a couple of swings.
          chuteRig.pitchRate += ((pitchTarget - chuteRig.pitch) * 4.4 - chuteRig.pitchRate * 1.5) * dt;
          // The opening shock: the wing checks hard and the jumper swings on under it.
          if (phase === 'snap') chuteRig.pitchRate += Math.max(0, (p.load || 1) - 1) * 0.45 * dt;
          chuteRig.roll += chuteRig.rollRate * dt;
          chuteRig.pitch = clamp(chuteRig.pitch + chuteRig.pitchRate * dt, -0.7, 0.7);
        }
        // Box: a slow wobble, a turn drops a shoulder; blended into the pendulum's angles.
        const boxRoll = Math.sin(gameTime * 2.3) * 0.06 + chuteRig.turn * 0.35,
          boxPitch = -Math.PI / 2 + Math.sin(gameTime * 1.7) * 0.04;
        chuteEuler.set(boxRoll + (chuteRig.roll - boxRoll) * u, -p.heading, boxPitch + (chuteRig.pitch - boxPitch) * u, 'YXZ');
        m.group.rotation.copy(chuteEuler);
        // Hanging, the body swings about the harness, not the feet.
        chuteTmp2.set(player.x, player.altitude + chuteHarnessOffset.y, player.y);
        chuteTmp.copy(chuteHarnessOffset).applyEuler(chuteEuler);
        const hangX = chuteTmp2.x - chuteTmp.x,
          hangY = chuteTmp2.y - chuteTmp.y,
          hangZ = chuteTmp2.z - chuteTmp.z;
        m.group.position.set(
          player.x + (hangX - player.x) * u,
          player.altitude + 6 + (hangY - player.altitude - 6) * u,
          player.y + (hangZ - player.y) * u,
        );
        // The pull: the right hand goes back to the pilot chute pouch, then flings it out.
        const reach = phase === 'pilot' ? smooth01(0, 0.25, k) * (1 - smooth01(0.3, 0.5, k)) : 0,
          fling = phase === 'pilot' ? smooth01(0.3, 0.5, k) * (1 - smooth01(0.6, 1, k)) : 0,
          pullR = Math.max(chuteRig.flare, chuteRig.turn),
          pullL = Math.max(chuteRig.flare, -chuteRig.turn),
          // Line stretch kicks the legs down and apart; they come together hanging.
          snatch = phase === 'snivel' ? Math.sin(Math.PI * smooth01(0, 0.35, k)) : 0,
          legLift = 0.25 + chuteRig.flare * 0.5 + Math.sin(gameTime * 1.3) * 0.04 - 0.2 * snatch;
        arms.forEach((arm, i) => {
          const side = i === 0 ? 1 : -1,
            boxZ = 0.75 + Math.sin(gameTime * 3.1 + i) * 0.05 + (i === 0 ? 0.5 * fling - 1.1 * reach : 0),
            boxX = -side * 1.35 + (i === 0 ? reach - 0.3 * fling : 0),
            // Hands on the toggles: up by the risers, down to the hips to brake.
            togglesZ = 2.75 - (i === 0 ? pullR : pullL) * 1.6,
            togglesX = -side * 0.18;
          arm.rotation.z = boxZ + (togglesZ - boxZ) * u;
          arm.rotation.x = boxX + (togglesX - boxX) * u;
        });
        // Legs spread in the box; together, a little forward and raised for the landing under the wing.
        legs.forEach((leg, i) => {
          const side = i === 0 ? 1 : -1,
            lift = legLift + (i ? 0.06 : 0);
          leg.rotation.z = -0.55 + (lift + 0.55) * u;
          leg.rotation.x = -side * (0.32 * (1 - u) + 0.22 * snatch);
        });
        m.torso.rotation.z = -0.08 * (1 - u);
        // The container rides on the back.
        chutePack.visible = true;
        chutePack.position.copy(m.group.position);
        chutePack.quaternion.setFromEuler(m.group.rotation);
        chuteTmp.set(-1.6, 10.2, 0).multiplyScalar(PERSON_HEIGHT / 14).applyQuaternion(chutePack.quaternion);
        chutePack.position.add(chuteTmp);
        chutePack.scale.setScalar(0.72 * (PERSON_HEIGHT / 14));
        // The rig hangs from the container while the jumper lies flat, the shoulders once upright.
        chuteRig.harness.copy(chutePack.position).lerp(chuteTmp2, u);
      }
