      // The carjack struggle drawn: the driver's door swinging, the poses of the tug of war
      // and the player's hands on the driver (swingDriverDoor, carjackPose, playerCarjackSpec).
      /**
       * CARJACK, DRAWN
       * Everything here reads carjack-struggle.js state: `player.carjack` (phase,
       * seconds into it, the driver's temper) and the driver's `pose`
       * ('carjackCling' in the seat, 'carjackHauled' dragged out, 'carjackStagger'
       * let go, or 'handsUp' for one who gives up), `carjackT`, `carjackPull` and
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
        } else if (pose === 'carjackReachIn') {
          // Leaning in through the open door, one foot on the sill, both hands going
          // for the driver's collar (the hands follow it by IK).
          const e = k * k * (3 - 2 * k);
          T[J_DROP] = -0.55 * e;
          T[J_LEAN] = -0.5 * e;
          carjackLeg(T, 0, 1.4 + 0.8 * e, -0.55 * e, 0.6 * Math.sin(k * Math.PI));
          carjackLeg(T, 1, -1.2 - 0.6 * e, -0.55 * e);
          setArm(T, 0, 0.9 + 0.6 * e, 0.2, 0.9 - 0.4 * e);
          setArm(T, 1, 0.9 + 0.6 * e, 0.2, 0.9 - 0.4 * e);
          T[J_HEAD_PITCH] = 0.3 * e;
        } else if (pose === 'carjackTug') {
          // Braced, weight low and back, heaving in uneven pulls against the
          // driver's grip on the wheel; knocked back a step by a shove or a punch.
          const job = player.carjack,
            t = (job?.t || 0) * TAU * CARJACK.rhythm,
            r = Math.sin(t) + 0.35 * Math.sin(t * 2.3 + 1.1),
            since = job ? gameTime - job.shoveAt : 9,
            hit = since >= 0 && since < 0.5 ? Math.sin((since / 0.5) * Math.PI) : 0;
          T[J_DROP] = -0.9 - 0.25 * k;
          carjackLeg(T, 0, 1.9, -0.9 - 0.25 * k);
          carjackLeg(T, 1, -2.7 - 0.4 * k, -0.9 - 0.25 * k);
          T[J_SPREAD] = 0.12;
          // Leaning in to the grip at first, hauling back with the weight by the end.
          T[J_LEAN] = -0.25 + 0.6 * k + 0.14 * r + 0.4 * hit;
          T[J_TWIST] = 0.12 * r - 0.3 * hit;
          T[J_ROLL] = 0.05 * r;
          setArm(T, 0, 1.3 + 0.5 * hit, 0.15 + 0.3 * hit, 0.6 + 0.25 * r);
          setArm(T, 1, 1.3 + 0.3 * hit, 0.15, 0.6 - 0.2 * r);
          T[J_HEAD_PITCH] = 0.12 - 0.3 * hit;
          T[J_HEAD_YAW] = -0.4 * hit;
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
          // In the seat, one hand gripping the wheel behind, the other flailing at
          // (or, from a defiant or angry one, punching and shoving) the attacker;
          // dragged up out of the seat as the tug goes on (`carjackPull` 0 to 1),
          // the wheel arm stretched straight before it lets go.
          const t = p.carjackT || 0,
            out = clamp(p.carjackPull || 0, 0, 1),
            T0 = t * TAU * CARJACK.rhythm,
            r = Math.sin(T0) + 0.35 * Math.sin(T0 * 2.3 + 1.1),
            punch = p.punchAt != null ? clamp((gameTime - p.punchAt) / 0.28, 0, 1) : 1,
            jab = punch < 1 ? Math.sin(punch * Math.PI) : 0,
            drop = -2.2 + 1.3 * out * out;
          T[J_DROP] = drop;
          carjackLeg(T, 0, 2.3 - 1.1 * out, drop, 0.5 * out * Math.max(0, Math.sin(t * TAU * 2.1)));
          carjackLeg(T, 1, -1.2 + 0.6 * out, drop, 1.6 * (1 - out));
          T[J_SPREAD] = 0.18;
          // Pulled forward by the collar against the lean back into the seat.
          T[J_LEAN] = 0.2 - 0.35 * out - 0.22 * r;
          T[J_TWIST] = -0.35 - 0.35 * jab + 0.12 * r;
          T[J_ROLL] = 0.09 * r;
          setArm(T, 1, -0.75 - 0.5 * out, 0.5, 1.1 * (1 - out) + 0.15 * r);
          if (jab > 0) setArm(T, 0, 1.25 + 0.35 * jab, 0.08, 1.4 * (1 - jab));
          else setArm(T, 0, 1.2 + 0.7 * Math.sin(t * TAU * 2.9), 0.4 + 0.35 * Math.cos(t * TAU * 2.3), 1.0 + 0.6 * Math.sin(t * TAU * 3.4 + 1));
          T[J_HEAD_PITCH] = -0.12 - 0.1 * r;
          T[J_HEAD_YAW] = Math.sin(t * TAU * 1.7) * 0.35;
        } else if (pose === 'carjackHauled') {
          // Dragged out by the collar: bent forward off balance, feet scrambling
          // under them, the hands up at the fists on the collar.
          const t = p.carjackT || 0,
            step = Math.sin(t * TAU * 3.2);
          T[J_DROP] = -0.7;
          T[J_LEAN] = -0.5;
          T[J_TWIST] = 0.2 * step;
          T[J_ROLL] = -0.12;
          carjackLeg(T, 0, 1.2 + 1.3 * step, -0.7, 1.2 * Math.max(0, step));
          carjackLeg(T, 1, 1.2 - 1.3 * step, -0.7, 1.2 * Math.max(0, -step));
          setArm(T, 0, 1.6, 0.25, 1.5);
          setArm(T, 1, 1.4, 0.45, 1.2 + 0.3 * step);
          T[J_HEAD_PITCH] = 0.35;
          T[J_HEAD_YAW] = 0.3;
        } else if (pose === 'carjackStagger') {
          // Let go: stumbling backwards, arms flung out for balance, then upright.
          const t = p.carjackT || 0,
            k2 = clamp(t / 0.85, 0, 1),
            fade = 1 - k2 * k2,
            step = Math.sin(t * TAU * 2.6);
          T[J_DROP] = -0.5 * fade;
          T[J_LEAN] = 0.38 * fade;
          T[J_ROLL] = 0.1 * step * fade;
          carjackLeg(T, 0, (-1.1 + 1.6 * step) * fade, -0.5 * fade, 1.1 * Math.max(0, step) * fade);
          carjackLeg(T, 1, (-1.1 - 1.6 * step) * fade, -0.5 * fade, 1.1 * Math.max(0, -step) * fade);
          setArm(T, 0, (1.1 + 0.7 * Math.sin(t * TAU * 1.9)) * fade, 0.9 * fade + 0.1, 0.5);
          setArm(T, 1, (0.8 + 0.7 * Math.sin(t * TAU * 1.9 + 2)) * fade, 1.0 * fade + 0.1, 0.5);
          T[J_HEAD_PITCH] = -0.25 * fade;
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
        const span = carjackFor(job, job.phase) || 1;
        if (job.phase === 'approach') {
          if (job.approachFor - job.t < 0.12) sp.pose = 'carjackReach';
          sp.progress = 0;
        } else if (job.phase === 'door') {
          sp.pose = 'carjackReach';
          sp.progress = job.t / span;
        } else if (job.phase === 'reach') {
          sp.pose = 'carjackReachIn';
          sp.progress = job.t / span;
        } else if (job.phase === 'tug') {
          sp.pose = job.mood === 'plead' ? 'carjackReach' : 'carjackTug';
          sp.progress = job.mood === 'plead' ? 1 : job.t / span;
        } else if (job.phase === 'pull') {
          sp.pose = 'carjackThrow';
          sp.progress = job.t / span;
        }
        // Both hands on the collar while the driver is held (not one who gives up).
        const d = job.driver,
          s = d?.carjackHeld && job.mood !== 'plead' && (job.phase === 'reach' || job.phase === 'tug' || job.phase === 'pull') && crowdState.get(d);
        if (s?.grip && s.gripAt === gameTime) {
          // Right hand to the left of the collar as they face each other, and back.
          carjackGrip[0].copy(s.grip[1]);
          carjackGrip[1].copy(s.grip[0]);
          sp.handTargets = carjackGrip;
        }
        sp.elevation = entityElevation(player);
        return sp;
      }
