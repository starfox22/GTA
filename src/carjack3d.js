      // The carjack struggle drawn: the driver's door swinging, the poses of the tug of war
      // and the player's hands on the driver (swingDriverDoor, carjackPose, playerCarjackSpec).
      /**
       * CARJACK, DRAWN
       * Everything here reads carjack-struggle.js state: `player.carjack` (phase,
       * seconds into it, the driver's temper) and the driver's `pose`
       * ('carjackCling' in the seat, 'carjackHauled' dragged out, 'carjackStagger'
       * let go, or 'handsUp' for one who gives up), `carjackT`, `carjackPull` and
       * `punchAt`. The door is the damage model's hinged door (damage3d-bodies.js
       * DOORS), made on first use and shown only while it is open, so a closed,
       * undamaged door is the body's own (DOOR SWING). The player's hands go to the driver's
       * collar by IK (`handTargets`), read off the driver's torso as it was drawn
       * this frame (the street is drawn before the player).
       */
      const carjackGrip = [new Three.Vector3(), new Three.Vector3()];
      /**
       * DOOR SWING
       * The carjack's door (`c.doorSwing`, carjack-struggle.js) and the player's own way in and out
       * (crowd3d-frame.js `carTransition.door`) swing the body's front door on its front hinge (damage3d-bodies.js
       * DOORS: the door cut from the body's side with its window, the cabin seen through the opening). Yanked open:
       * the latch gives (a crack), the door swings out fast and is caught by its check strap with a small bounce;
       * pulled shut it speeds up to the latch. While a door with its window stands open the body's side pane is
       * left out (`missingGlass`, as a lowered window), so the window goes with the door.
       */
      const DOOR_OPEN = 1.1;
      // The carjack's yank: radians open `t` seconds after the hand pulled the handle (sw.openAt).
      function doorYank(t) {
        if (t <= 0) return 0;
        if (t < 0.07) return 0.1 * Math.sin((t / 0.07) * Math.PI * 0.5);
        if (t < 0.33) {
          const k = (t - 0.07) / 0.26;
          return 0.1 + (DOOR_OPEN + 0.07 - 0.1) * (1 - (1 - k) * (1 - k) * (1 - k));
        }
        const s = t - 0.33;
        return DOOR_OPEN + 0.07 * Math.exp(-s * 9) * Math.cos(s * 22);
      }
      // Pulled shut over 0.28 s from `closeAt`, quicker as it goes (a share 1 to 0 of the open angle).
      function doorShutShare(since) {
        if (since <= 0) return 1;
        const k = clamp(since / 0.28, 0, 1);
        return 1 - k * k;
      }
      // Getting in and out of a car without a struggle: open as the player steps up, shut behind them (seconds since).
      function doorStepOpen(kind, since) {
        if (kind === 'enter') {
          // The duck in is 0.4 s (drawEnterCar): the door opens ahead of it and is pulled shut once they sit.
          if (since < 0.16) return DOOR_OPEN * 0.85 * Math.sin((since / 0.16) * Math.PI * 0.5);
          return DOOR_OPEN * 0.85 * doorShutShare(since - 0.42);
        }
        // Out (exitCar puts the player beside the door at once; the step out is 0.5 s): open, then pushed shut.
        if (since < 0.12) return DOOR_OPEN * 0.85 * Math.sin((since / 0.12) * Math.PI * 0.5);
        return DOOR_OPEN * 0.85 * doorShutShare(since - 0.5);
      }
      /* Per vehicle with a swinging door (render3d-frame.js): a carjack, or the player getting in or out. */
      function swingDriverDoor(c, m) {
        if (!m.car || !m.dims || !m.body) return;
        let left = 0,
          right = 0;
        const sw = c.doorSwing;
        if (sw) {
          left = doorYank(gameTime - sw.openAt);
          if (sw.closeAt) left *= doorShutShare(gameTime - sw.closeAt);
        }
        const tr = carTransition;
        if (tr.door === c && tr.kind) {
          const since = gameTime - tr.at;
          if (since < 1.2 && !vehicleSpec(c).truck && Math.hypot(c.vx || 0, c.vy || 0) < 30) {
            const open = doorStepOpen(tr.kind, since);
            if (tr.doorSide > 0) right = open;
            else left = Math.max(left, open);
          }
        }
        // Nothing swinging and nothing left to put back: the damage pass draws any sprung door.
        const active = left > 0.002 || right > 0.002;
        if (!active && m.doorsIdle) return;
        m.doorsIdle = !active;
        let paneOpen = false;
        for (let side = -1; side <= 1; side += 2) {
          const open = side < 0 ? left : right,
            state = c.damage?.parts?.[side < 0 ? 'doorLeft' : 'doorRight'] || 0;
          if (state === 2) continue;
          let door = m.doors?.[side];
          if (!door) {
            if (open <= 0.002) continue;
            door = vehicleDoor(c, m, side);
          }
          m.carjackDoor = true;
          door.pivot.rotation.set(0, side * Math.max(state === 1 ? 0.95 : 0, open), state === 1 ? -0.09 : 0);
          const shown = state > 0 || open > 0.002;
          door.panel.visible = shown;
          door.opening.visible = shown;
          // The window rides with a whole door; a sprung one has lost it (damage3d-bodies.js).
          const glassShown = !!door.glass && state === 0 && open > 0.002;
          if (door.glass) door.glass.visible = glassShown;
          if (glassShown) paneOpen = side;
        }
        doorSidePane(m, paneOpen);
      }
      /* The body's side pane left out while its door (with the window) stands open: `side` -1 or 1, or false. */
      function doorSidePane(m, side) {
        const cabin = m.cabin;
        if (!cabin || !m.cabinBase) return;
        const held = m.doorPane;
        if (held && held.side !== side) {
          // Put back what the pane was (the damage pass may have changed it since: then it is its own).
          const list = cabin.material;
          if (Array.isArray(list)) {
            if (list === held.list) cabin.material = held.one;
            else if (list[held.index] === missingGlass && held.was) list[held.index] = held.was;
          }
          m.doorPane = null;
        }
        if (!side) return;
        const index = side < 0 ? 0 : 2;
        let hold = m.doorPane;
        if (!hold) hold = m.doorPane = { side, index, list: null, one: null, was: null };
        const now = cabin.material;
        if (!Array.isArray(now)) {
          // One material for the whole glasshouse: five slots of it with the side's left out.
          hold.one = now;
          hold.list = hold.list || [now, now, now, now, now];
          hold.list.fill(now);
          hold.list[index] = missingGlass;
          cabin.material = hold.list;
        } else if (now !== hold.list && now[index] !== missingGlass) {
          // The damage pass's own panes: leave its side out until the door shuts.
          hold.was = now[index];
          now[index] = missingGlass;
        }
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
