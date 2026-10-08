    // Camera drive: the street camera's follow in a road vehicle or a boat, built for comfort: a steady lead,
    // critically damped springs (firm along the travel, soft across it), a smoothed height and the speed the framing reads.
    /**
     * DRIVING FOLLOW
     * What made the old follow sickening: its lead pointed along the raw velocity and
     * followed every steering input, so a slalom swung the view from side to side by
     * nearly twice the car's own weave (the lead acted as a phase advance at 0.3-1 Hz,
     * the band that makes people ill); two first-order easings in series overshot when
     * the speed changed; the camera's height followed the ground under the car exactly,
     * so each triangle of the terrain was a kink in the view's motion; crash kicks rang.
     * Now:
     *   way it goes   the velocity smoothed in two stages (CAMERA_DRIVE.velocityRate),
     *                 read for the lead's heading and length only
     *   lead          LEAD heading eases to the smoothed velocity's (leadHeadRate) and
     *                 turns no faster than leadTurnMax; a reversal shrinks the lead to
     *                 nothing first and then turns at once (no swing round); length
     *                 leadSeconds of travel, at most leadShare of the frame's half
     *                 height on the ground (so the vehicle sits centre-low, the road
     *                 ahead in view, at any zoom), leadBack reversing, eased in two
     *                 stages; Camera look-ahead and the chase framing scale it, but the
     *                 frame's share grows at most to leadShareMax (a look-ahead past
     *                 ~120 % lengthens the lead at lower speeds only, so a fast bus
     *                 never reaches the strip and prompt along the bottom)
     *   follow        cameraSpring: an exact critically damped spring (no overshoot,
     *                 stable at any step), `along` the lead's heading with the vehicle's
     *                 own speed fed forward (no lag), `across` it a softer one with no
     *                 feed-forward, so a weave or a slalom moves the car on screen and
     *                 not the whole view; a crash stops it in about a quarter second
     *   height        the vehicle's ground height, its rate of climb smoothed and fed
     *                 forward (no lag up a long grade), a critically damped spring
     *                 (`height`) over the kinks and crests; jumps over heightSnap snap
     *   turns         the lead is what swings the view sideways at a corner (its
     *                 length times its turn rate on top of the car's own path), so it
     *                 is a quarter of the half frame and turns at 0.9 rad/s at most;
     *                 Motion comfort (settings.js) halves it and turns it at 0.55
     *   speed         the speed the framing reads (world-view.js speedZoomTarget),
     *                 eased up at speedUp and down at speedDown, so a bump, a crash or
     *                 wheelspin never pumps the zoom
     * On foot, in aircraft and on rides the follow keeps its old lag (cameraSpring
     * with no feed-forward at twice the old easing rate) and the raw height.
     */
    const CAMERA_DRIVE = {
      velocityRate: 3,
      leadSeconds: 0.55,
      leadShare: 0.25,
      leadShareMax: 0.3,
      leadBack: 60,
      leadMinSpeed: 12,
      leadHeadRate: 2,
      leadTurnMax: 0.9,
      // Motion comfort (settings.js motionComfortOn): the lead's length and turn rate scaled by these.
      steadyLead: 0.5,
      steadyTurn: 0.6,
      leadFlip: 2.1,
      leadLengthRate: 2.2,
      along: 3,
      across: 1.8,
      height: 3.5,
      heightRate: 4,
      heightSnap: 300,
      speedUp: 1.6,
      speedDown: 0.6,
    };
    const cameraDrive = { on: false, h: 0, len1: 0, len: 0, v1x: 0, v1y: 0, vx: 0, vy: 0, speed: 0 },
      cameraVel = { x: 0, y: 0 },
      cameraHeight = { z: 0, v: 0, r1: 0, r: 0, last: 0, ready: false };
    /* One step of a critically damped spring pulling the view to (tx, ty), a target moving
       at (vx, vy): rate `wAlong` along (ux, uy), `wCross` across it. Solved exactly over the
       step, so it never overshoots a target that stops and is stable at any frame rate. */
    function cameraSpring(tx, ty, vx, vy, ux, uy, wAlong, wCross, dt) {
      const ex = cameraTarget.x - (tx - vx * dt),
        ey = cameraTarget.y - (ty - vy * dt),
        rx = cameraVel.x - vx,
        ry = cameraVel.y - vy,
        ea = ex * ux + ey * uy,
        ec = ey * ux - ex * uy,
        ra = rx * ux + ry * uy,
        rc = ry * ux - rx * uy,
        ba = ra + wAlong * ea,
        da = Math.exp(-wAlong * dt),
        bc = rc + wCross * ec,
        dc = Math.exp(-wCross * dt),
        ea1 = (ea + ba * dt) * da,
        ra1 = (ra - wAlong * ba * dt) * da,
        ec1 = (ec + bc * dt) * dc,
        rc1 = (rc - wCross * bc * dt) * dc;
      cameraTarget.x = tx + ea1 * ux - ec1 * uy;
      cameraTarget.y = ty + ea1 * uy + ec1 * ux;
      cameraVel.x = vx + ra1 * ux - rc1 * uy;
      cameraVel.y = vy + ra1 * uy + rc1 * ux;
    }
    /* The follow in a road vehicle or a boat (DRIVING FOLLOW). */
    function followVehicle(c, dt) {
      const D = cameraDrive,
        K = CAMERA_DRIVE,
        rvx = c.vx === c.vx ? c.vx || 0 : Math.cos(c.a) * (c.speed || 0),
        rvy = c.vy === c.vy ? c.vy || 0 : Math.sin(c.a) * (c.speed || 0);
      if (!D.on) {
        // Boarding: carry on from the view as it stands.
        const held = Math.hypot(cameraLead.x, cameraLead.y);
        D.on = true;
        D.h = held > 1 ? Math.atan2(cameraLead.y, cameraLead.x) : c.a;
        D.len = D.len1 = held;
        D.v1x = D.vx = rvx;
        D.v1y = D.vy = rvy;
      }
      const kv = 1 - Math.exp(-dt * K.velocityRate);
      D.v1x += (rvx - D.v1x) * kv;
      D.v1y += (rvy - D.v1y) * kv;
      D.vx += (D.v1x - D.vx) * kv;
      D.vy += (D.v1y - D.vy) * kv;
      const steady = motionComfortOn(),
        sv = Math.hypot(D.vx, D.vy),
        scale = drivingLookAhead() * (steady ? K.steadyLead : 1),
        turnMax = K.leadTurnMax * (steady ? K.steadyTurn : 1);
      let want = 0;
      if (scale && sv > K.leadMinSpeed) {
        const forward = D.vx * Math.cos(c.a) + D.vy * Math.sin(c.a) >= 0,
          // Ground units from the middle of the frame to its top edge at the framing in force.
          half = clamp(viewportHeight * 0.68, 430, 630) / Math.max(1e-3, worldZoomTarget * speedZoom) / 2 / COMFORT_SIN,
          chase = 1 - CAMERA_CHASE_PULL * cameraChaseCloseness(c, D.vx, D.vy, sv),
          aim = Math.atan2(D.vy, D.vx);
        want = Math.min(sv * K.leadSeconds * scale, forward ? half * Math.min(K.leadShare * scale, K.leadShareMax) : K.leadBack * scale) * chase;
        let turn = Math.atan2(Math.sin(aim - D.h), Math.cos(aim - D.h));
        if (Math.abs(turn) > K.leadFlip) {
          // Forward to reverse (or back): shrink the lead to nothing, then face the new way at once.
          want = 0;
          if (D.len < 4) {
            D.h = aim;
            turn = 0;
          }
        }
        D.h += clamp(turn * (1 - Math.exp(-dt * K.leadHeadRate)), -turnMax * dt, turnMax * dt);
      }
      const kl = 1 - Math.exp(-dt * K.leadLengthRate);
      D.len1 += (want - D.len1) * kl;
      D.len += (D.len1 - D.len) * kl;
      const ux = Math.cos(D.h),
        uy = Math.sin(D.h),
        along = rvx * ux + rvy * uy;
      cameraLead.x = ux * D.len;
      cameraLead.y = uy * D.len;
      cameraLeadAim.x = ux * want;
      cameraLeadAim.y = uy * want;
      cameraSpring(player.x + cameraLead.x, player.y + cameraLead.y, ux * along, uy * along, ux, uy, K.along, K.across, dt);
    }
    /* The speed the framing reads (world-view.js speedZoomTarget), eased; 0 out of a vehicle. */
    function updateDrivingCameraSpeed(dt) {
      const c = player.car,
        v = c && !isAircraft(c) ? Math.hypot(c.vx || 0, c.vy || 0) : 0,
        D = cameraDrive;
      D.speed += (v - D.speed) * (1 - Math.exp(-dt * (v > D.speed ? CAMERA_DRIVE.speedUp : CAMERA_DRIVE.speedDown)));
      if (!(D.speed === D.speed)) D.speed = 0;
    }
    function drivingCameraSpeed() {
      return cameraDrive.speed;
    }
    /* The camera's height in a road vehicle (DRIVING FOLLOW height); elsewhere the raw one. */
    function updateCameraHeight(dt) {
      const H = cameraHeight,
        c = player.car,
        raw = c && isBoat(c) ? 0 : entityElevation(c || player),
        smooth = !!c && !isAircraft(c) && !isBoat(c);
      if (!H.ready || !smooth || !(dt > 0) || !(Math.abs(raw - H.z) < CAMERA_DRIVE.heightSnap)) {
        H.z = H.last = Number.isFinite(raw) ? raw : 0;
        H.v = H.r1 = H.r = 0;
        H.ready = true;
        return;
      }
      const climb = (raw - H.last) / dt,
        k = 1 - Math.exp(-dt * CAMERA_DRIVE.heightRate),
        w = CAMERA_DRIVE.height;
      H.last = raw;
      H.r1 += (climb - H.r1) * k;
      H.r += (H.r1 - H.r) * k;
      const e0 = H.z - (raw - H.r * dt),
        v0 = H.v - H.r,
        b = v0 + w * e0,
        d = Math.exp(-w * dt);
      H.z = raw + (e0 + b * dt) * d;
      H.v = H.r + (v0 - w * b * dt) * d;
    }
    function resetCameraDrive() {
      cameraDrive.on = false;
      cameraDrive.len = cameraDrive.len1 = cameraDrive.speed = 0;
      cameraVel.x = cameraVel.y = 0;
      cameraHeight.ready = false;
    }
