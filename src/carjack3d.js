      // The carjack struggle drawn: the driver's door swinging, the poses of the tug of war
      // and the player's hands on the driver (swingDriverDoor, carjackPose, playerCarjackSpec).
      /**
       * CARJACK, DRAWN
       * Everything here reads carjack-struggle.js state: `player.carjack` (phase,
       * seconds into it, the driver's temper) and the driver's `pose`
       * ('carjackCling', or 'handsUp' for one who gives up), `carjackT` and
       * `punchAt`. The door is the damage model's hinged panel (damage3d-bodies.js
       * doors), made on first use and shown only while it is open, so a closed,
       * undamaged door is the body's own. The player's hands go to the driver's
       * collar by IK (`handTargets`), read off the driver's torso as it was drawn
       * this frame (the street is drawn before the player).
       */
      const carjackGrip = [new Three.Vector3(), new Three.Vector3()];
      function carjackDoorShape(m) {
        claimDamageResources();
        const { l, w, h } = m.dims,
          side = -1,
          pivot = new Three.Group();
        pivot.position.set(l * 0.2, 0, side * w * 0.5);
        m.body.add(pivot);
        const sill = m.dims.sill ?? 4.8,
          panel = box(pivot, -l * 0.13, (sill + h + 0.4) / 2, side * 0.25, l * 0.26, h + 0.4 - sill, 0.45, m.paint),
          opening = box(m.body, l * 0.07, (sill + h) / 2, side * (w * 0.5 + 0.04), l * 0.24, h - sill - 0.2, 0.3, engineBay);
        if (m.panelGeometry) panel.geometry = m.panelGeometry;
        m.doors = m.doors || {};
        return (m.doors[side] = { pivot, panel, opening });
      }
      /* Per vehicle with a carjack door (render3d-frame.js): yanked open, swung shut. */
      function swingDriverDoor(c, m) {
        if (!m.car || !m.dims || !m.body) return;
        const state = c.damage?.parts?.doorLeft || 0;
        if (state === 2) return;
        const sw = c.doorSwing;
        let open = 0;
        if (sw) {
          const k = clamp((gameTime - sw.openAt) / 0.22, 0, 1);
          open = 1 - (1 - k) * (1 - k);
          if (sw.closeAt) open *= 1 - clamp((gameTime - sw.closeAt) / 0.3, 0, 1);
        }
        let door = m.doors?.[-1];
        if (!door) {
          if (open <= 0) return;
          door = carjackDoorShape(m);
        }
        m.carjackDoor = true;
        door.pivot.rotation.set(0, -Math.max(state === 1 ? 0.95 : 0, open * 1.1), state === 1 ? -0.09 : 0);
        const shown = state > 0 || open > 0.002;
        door.panel.visible = shown;
        door.opening.visible = shown;
      }
      /* Leg angles for an ankle `fx` ahead of the hip with the hips `drop` lower (rig units). */
      function carjackLeg(T, side, fx, drop, lift = 0) {
        const leg = solveLeg(fx, -(RIG.hip + drop - RIG.ankle - lift), RIG.thigh, RIG.shin);
        T[J_HIP[side]] = leg.hip;
        T[J_KNEE[side]] = leg.knee;
      }
      /* Pose targets for the struggle (crowd3d-poses.js crowdPoseTargets). */
      function carjackPose(p, T, spec, pose) {
        T[J_LOCO] = 0;
        T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
        T[J_HEAD_YAW] = 0;
        const k = clamp(spec?.progress ?? 0, 0, 1);
        if (pose === 'carjackReach') {
          // A step in, the left hand to the handle, the door hauled open.
          T[J_LEAN] = -0.14 * k;
          T[J_TWIST] = 0.18 * k;
          carjackLeg(T, 0, 1.4, -0.35);
          carjackLeg(T, 1, -1.3, -0.35);
          setArm(T, 0, 1.05 + 0.35 * Math.sin(k * Math.PI), 0.28, 0.55 - 0.3 * k);
          setArm(T, 1, 0.35, 0.18, 0.5);
          T[J_DROP] = -0.35;
          T[J_HEAD_PITCH] = 0.12;
        } else if (pose === 'carjackTug') {
          // Braced, weight low and back, heaving in time with the driver's resistance.
          const r = Math.sin((player.carjack?.t || 0) * TAU * CARJACK.rhythm);
          T[J_DROP] = -0.9;
          carjackLeg(T, 0, 1.9, -0.9);
          carjackLeg(T, 1, -2.7, -0.9);
          T[J_SPREAD] = 0.1;
          T[J_LEAN] = 0.26 + 0.12 * r;
          T[J_TWIST] = 0.1 * r;
          T[J_ROLL] = 0.04 * r;
          setArm(T, 0, 1.3, 0.15, 0.6);
          setArm(T, 1, 1.3, 0.15, 0.6);
          T[J_HEAD_PITCH] = 0.12;
        } else if (pose === 'carjackThrow') {
          // The swing out and round to the right, the arms following through.
          const e = Math.sin(k * Math.PI);
          T[J_DROP] = -0.6 * (1 - k);
          carjackLeg(T, 0, 1.6 - 1.2 * k, -0.6 * (1 - k));
          carjackLeg(T, 1, -2.2 + 1.8 * k, -0.6 * (1 - k), 0.8 * e);
          T[J_TWIST] = -0.85 * e;
          T[J_LEAN] = -0.12 * e;
          setArm(T, 0, 1.35 - 0.7 * k, 0.3 + 0.5 * k, 0.35);
          setArm(T, 1, 1.2 - 0.9 * k, 0.45 + 0.4 * k, 0.4);
          T[J_HEAD_YAW] = -0.5 * e;
        } else if (pose === 'carjackCling') {
          // Half out of the seat, one hand still on the wheel behind, the other
          // flailing at the attacker (or, from a defiant one, a punch).
          const t = p.carjackT || 0,
            r = Math.sin(t * TAU * CARJACK.rhythm),
            punch = p.punchAt != null ? clamp((gameTime - p.punchAt) / 0.28, 0, 1) : 1,
            jab = punch < 1 ? Math.sin(punch * Math.PI) : 0;
          T[J_DROP] = -2.1;
          carjackLeg(T, 0, 2.3, -2.1);
          carjackLeg(T, 1, -1.2, -2.1, 1.6);
          T[J_SPREAD] = 0.18;
          T[J_LEAN] = 0.12 - 0.3 * r;
          T[J_TWIST] = -0.35 - 0.35 * jab;
          T[J_ROLL] = 0.08 * r;
          setArm(T, 1, -0.75, 0.55, 1.0 + 0.2 * r);
          if (jab > 0) setArm(T, 0, 1.25 + 0.35 * jab, 0.08, 1.4 * (1 - jab));
          else setArm(T, 0, 1.2 + 0.7 * Math.sin(t * TAU * 4.3), 0.4 + 0.35 * Math.cos(t * TAU * 3.7), 1.0 + 0.6 * Math.sin(t * TAU * 5.1 + 1));
          T[J_HEAD_PITCH] = -0.12;
          T[J_HEAD_YAW] = Math.sin(t * TAU * 2.3) * 0.35;
        }
      }
      /* The driver's collar, from the torso just drawn (crowd3d-draw.js). */
      function recordCarjackGrip(s, w) {
        if (!s.grip) s.grip = [new Three.Vector3(), new Three.Vector3()];
        for (let side = 0; side < 2; side++) s.grip[side].set(1.05 * w, RIG.shoulderY - 0.35, (side ? 1 : -1) * 0.55 * w).applyMatrix4(mTorso);
        s.gripAt = gameTime;
      }
      /* The player in the struggle (crowd3d-special.js specialSpec). */
      function playerCarjackSpec(sp) {
        const job = player.carjack;
        sp.facing = player.a;
        sp.snapFacing = false;
        if (job.phase === 'approach') {
          if (job.approachFor - job.t < 0.12) sp.pose = 'carjackReach';
          sp.progress = 0;
        } else if (job.phase === 'door') {
          sp.pose = 'carjackReach';
          sp.progress = job.t / CARJACK.door;
        } else if (job.phase === 'tug') {
          sp.pose = job.mood === 'plead' ? 'carjackReach' : 'carjackTug';
          sp.progress = job.mood === 'plead' ? 1 : job.t / job.tugFor;
          const d = job.driver,
            s = d && crowdState.get(d);
          if (s?.grip && s.gripAt === gameTime && job.mood !== 'plead') {
            // Right hand to the left of the collar as they face each other, and back.
            carjackGrip[0].copy(s.grip[1]);
            carjackGrip[1].copy(s.grip[0]);
            sp.handTargets = carjackGrip;
          }
        } else if (job.phase === 'throw') {
          sp.pose = 'carjackThrow';
          sp.progress = job.t / CARJACK.throwFor;
        }
        sp.elevation = entityElevation(player);
        return sp;
      }
