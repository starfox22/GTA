    // Chase camera: the third-person view behind the player that V switches with the street view: where it
    // stands and looks, mouse / stick / touch look, the boom pulled in by walls, and its projection for game rules.
    /**
     * CHASE CAMERA
     * Two views of one game. The STREET view is the overhead one the game was built on
     * (camera-feel.js, world-view.js). The CHASE view stands behind the player at
     * street level and looks where the player looks, the way a modern third-person
     * crime game does: on foot over the shoulder (closer and further over it while
     * aiming), in a vehicle low behind it, swinging after it through corners.
     *
     * Everything about where the chase camera stands is game state, here, so the rules
     * that depend on what the player can see (shooterInView, crowd spawning out of
     * sight, the HUD's player box, the aim) work the same with or without a renderer;
     * chase-view3d.js only copies it into a three.js PerspectiveCamera. The frame is a
     * pinhole camera: `chaseCam.x/y/z` (map units, z the elevation), heading `yaw` (the
     * map heading it looks along, as player.a), `pitch` (radians below level), the
     * vertical field of view `fov` (degrees) and the screen's aspect. chaseProject(),
     * chaseRay() and chaseSees() are its projection.
     *
     * LOOK: with the chase view on, a click on the game captures the pointer (pointer
     * lock); the mouse then turns the camera (Settings · Controls · Look sensitivity,
     * Invert look) and the aim is the reticle in the middle of the screen. The right
     * stick of a gamepad and a drag on the touch screen turn it too. In a vehicle the
     * camera swings back behind it CHASE_LOOK_RETURN seconds after the last look.
     *
     * FOLLOW: on foot the camera turns only when the player turns it, except that it
     * eases round behind a run after a while without looking. In a vehicle the heading
     * follows the way the vehicle goes through a critically damped spring (no
     * overshoot), so the vehicle swings a little across the frame in a corner; the
     * boom lengthens and the lens widens a little with speed. MOTION COMFORT
     * (motionComfortOn) holds the lens and the boom still and slows the swing.
     *
     * WALLS: the boom from the pivot (the shoulder, or above the vehicle) to the
     * camera is marched against building footprints and heights; the camera comes in
     * at once in front of a wall and backs out slowly. It never goes below the ground
     * or the water.
     */
    const VIEW_STREET = 'street',
      VIEW_CHASE = 'chase',
      CHASE_LOOK_RATE = 0.0026,
      CHASE_PAD_RATE = 3.2,
      CHASE_PITCH_MIN = -0.55,
      CHASE_PITCH_MAX = 1.15,
      CHASE_LOOK_RETURN = 1.6,
      CHASE_FOOT = { pivot: 1.58, dist: 3.5, shoulder: 0.42, fov: 52, pitch: 0.16 },
      CHASE_AIM = { pivot: 1.62, dist: 1.85, shoulder: 0.66, fov: 44 },
      CHASE_NEAR = 4,
      CHASE_WALL_MARGIN = 3,
      CHASE_GROUND_CLEAR = 3,
      // The reticle's place on screen, as a share of the width and height.
      CHASE_RETICLE = { x: 0.5, y: 0.5 },
      // How far the camera's reticle reaches when it meets nothing (the convergence of the shoulder offset).
      CHASE_AIM_REACH = 70 * UNITS_PER_METRE,
      // How far a camera ray looks for people and vehicles to stop on (chaseAimPoint).
      CHASE_PICK_REACH = 120 * UNITS_PER_METRE;
    const chaseCam = {
      x: 0,
      y: 0,
      z: 0,
      yaw: -Math.PI / 2,
      pitch: CHASE_FOOT.pitch,
      fov: CHASE_FOOT.fov,
      // The boom as drawn (pulled in by walls) and as wanted.
      dist: CHASE_FOOT.dist * UNITS_PER_METRE,
      wantDist: CHASE_FOOT.dist * UNITS_PER_METRE,
      // The pivot it turns about (map x, y and the elevation).
      px: 0,
      py: 0,
      pz: 0,
      // The look offsets the mouse adds in a vehicle (they ease back behind it).
      lookYaw: 0,
      lookPitch: 0,
      // Seconds since the last look input; the heading spring's rate of turn.
      idle: 99,
      yawVel: 0,
      // The over-the-shoulder aim blend (0..1), the speed share (0..1) and the slope pitch.
      aimBlend: 0,
      speedBlend: 0,
      slope: 0,
      shoulder: CHASE_FOOT.shoulder * UNITS_PER_METRE,
      // The player's wheel / zoom keys: a factor on the boom.
      zoom: 1,
      ready: false,
      // What the camera followed last frame (a change of vehicle snaps the heading round).
      subject: null,
      locked: false,
      aspect: 16 / 9,
      // The heading and pitch the lens actually looks along (the boom's, or down at the
      // shoulder when the ground lifted the camera): what the renderer and the projection use.
      viewYaw: -Math.PI / 2,
      viewPitch: CHASE_FOOT.pitch,
      // The page could not capture the pointer (CURSOR LOOK instead).
      lockFailed: false,
    };
    let viewMode = VIEW_STREET;
    try {
      if (localStorage.getItem('dead-end-city-view') === VIEW_CHASE) viewMode = VIEW_CHASE;
    } catch {}
    /* The chase view is drawn (the overhead street view otherwise). */
    function chaseViewOn() {
      return viewMode === VIEW_CHASE;
    }
    /* The ride cameras (the Falcon, the Eye) take over from either view while the player rides one. */
    function chaseCameraLive() {
      return viewMode === VIEW_CHASE && !player.coaster;
    }
    function setViewMode(mode, quiet = false) {
      const next = mode === VIEW_CHASE ? VIEW_CHASE : VIEW_STREET;
      // The 2D fallback (no WebGL) can only draw the street view.
      if (next === VIEW_CHASE && !city3D && !NO_RENDER) {
        if (!quiet) tell('The chase camera needs 3D graphics.', 3);
        return viewMode;
      }
      if (next !== viewMode) {
        viewMode = next;
        try {
          localStorage.setItem('dead-end-city-view', viewMode);
        } catch {}
        resetChaseCamera();
        if (viewMode === VIEW_STREET) releaseChasePointer();
      }
      if (!quiet)
        tell(
          viewMode === VIEW_CHASE
            ? 'CHASE CAMERA · ' + (touchModeOn() ? 'drag to look' : 'the mouse looks') + ' · ' + keyName('cameraView') + ' for the street view'
            : 'STREET CAMERA · ' + keyName('cameraView') + ' for the chase camera',
          3,
          { id: 'view-mode' },
        );
      return viewMode;
    }
    function toggleViewMode() {
      return setViewMode(viewMode === VIEW_CHASE ? VIEW_STREET : VIEW_CHASE);
    }
    function touchModeOn() {
      return typeof document !== 'undefined' && document.body.classList.contains('touch-mode');
    }
    /* ---- Look input --------------------------------------------------------------------- */
    /* The mouse turns the camera by `dx`, `dy` screen pixels (a captured pointer's movement). */
    function chaseLook(dx, dy) {
      if (!chaseCameraLive() || gameMode !== 'play') return;
      const rate = CHASE_LOOK_RATE * lookSensitivity() * (chaseCam.aimBlend > 0.5 ? 0.6 : 1);
      chaseTurn(dx * rate, dy * rate * (settings.invertLook ? -1 : 1));
    }
    /* Turn by `yaw` and `pitch` radians (a stick or a drag), counted as looking. */
    function chaseTurn(yaw, pitch) {
      if (!Number.isFinite(yaw + pitch)) return;
      chaseCam.idle = 0;
      if (chaseFollowsVehicle()) {
        chaseCam.lookYaw = normalizeAngle(chaseCam.lookYaw + yaw);
        chaseCam.lookPitch = clamp(chaseCam.lookPitch + pitch, CHASE_PITCH_MIN - chaseCam.pitch, CHASE_PITCH_MAX - chaseCam.pitch);
      } else {
        chaseCam.yaw = normalizeAngle(chaseCam.yaw + yaw);
        chaseCam.pitch = clamp(chaseCam.pitch + pitch, CHASE_PITCH_MIN, CHASE_PITCH_MAX);
      }
    }
    function lookSensitivity() {
      return clamp((settings.lookSensitivity ?? 100) / 100, 0.2, 3);
    }
    /* The gamepad's right stick (gamepad.js), every poll: radians a second at full tilt. */
    function chaseStick(rx, ry, dt) {
      const m = Math.hypot(rx, ry);
      if (m < 0.18 || !(dt > 0)) return false;
      // A response curve: fine near the centre, quick at the edge.
      const k = (CHASE_PAD_RATE * lookSensitivity() * Math.pow((m - 0.18) / 0.82, 1.6)) / m;
      chaseTurn(rx * k * dt, ry * k * dt * 0.6 * (settings.invertLook ? -1 : 1));
      return true;
    }
    /* Pointer lock: a click on the game in the chase view captures the mouse; Escape lets it go.
       Returns true when a capture was asked for (the click that asks fires nothing). A page that
       cannot capture the pointer (an embedding frame without the permission) falls back on
       CURSOR LOOK (updateCursorLook). */
    function captureChasePointer() {
      if (!chaseCameraLive() || gameMode !== 'play' || touchModeOn() || chaseCam.lockFailed) return false;
      if (document.pointerLockElement === canvas || typeof canvas.requestPointerLock !== 'function') {
        chaseCam.lockFailed = typeof canvas.requestPointerLock !== 'function';
        return false;
      }
      try {
        const asked = canvas.requestPointerLock();
        // (Some browsers return a promise that rejects when the page is not focused.)
        if (asked && typeof asked.catch === 'function') asked.catch(() => {});
      } catch {
        chaseCam.lockFailed = true;
        return false;
      }
      return true;
    }
    function releaseChasePointer() {
      if (typeof document !== 'undefined' && document.pointerLockElement === canvas) document.exitPointerLock?.();
    }
    function chasePointerLocked() {
      return typeof document !== 'undefined' && document.pointerLockElement === canvas;
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerlockchange', () => {
        chaseCam.locked = chasePointerLocked();
        if (chaseCam.locked) placeMouseOnReticle();
      });
      document.addEventListener('pointerlockerror', () => {
        chaseCam.lockFailed = true;
        chaseCam.locked = false;
      });
    }
    /**
     * CURSOR LOOK
     * Without a captured pointer the cursor stays on screen: the aim is the cursor (the camera's
     * ray through it), and the camera turns while the cursor stands in a band along the left or
     * right edge of the frame (faster the deeper in), and pitches in a band along the top and
     * bottom. Called every simulation step.
     */
    function updateCursorLook(deltaSeconds) {
      if (chaseCam.locked || !mouse.active || gameMode !== 'play' || touchModeOn() || !(deltaSeconds > 0)) return;
      const band = 0.1,
        u = mouse.x / Math.max(1, viewportWidth),
        v = mouse.y / Math.max(1, viewportHeight),
        push = (t) => (t < band ? -(band - t) / band : t > 1 - band ? (t - (1 - band)) / band : 0),
        h = push(u),
        p = push(v);
      if (h || p) chaseTurn(h * Math.abs(h) * 2.4 * lookSensitivity() * deltaSeconds, p * Math.abs(p) * 1.2 * lookSensitivity() * deltaSeconds * (settings.invertLook ? -1 : 1));
    }
    /* While the pointer is captured the aim is the reticle (mouse.x / y stand on it for every reader). */
    function placeMouseOnReticle() {
      mouse.x = viewportWidth * CHASE_RETICLE.x;
      mouse.y = viewportHeight * CHASE_RETICLE.y;
      mouse.active = true;
    }
    /* ---- Follow -------------------------------------------------------------------------- */
    /* In a vehicle (not a passenger) the camera follows the vehicle's heading. */
    function chaseFollowsVehicle() {
      return !!player.car && !player.coaster;
    }
    /* Aiming over the shoulder: the right button held on foot with a gun, or the touch / pad aim. */
    function chaseAiming() {
      if (player.car || player.swimming || player.parachute || player.coaster || transitRide || taxiRide) return false;
      const w = currentWeapon();
      if (!w || w.melee) return false;
      return !!mouse.alt || (typeof gamepad !== 'undefined' && !!gamepad.aimHeld);
    }
    /* The heading a vehicle travels (its velocity, or its nose when slow or reversing). */
    function chaseVehicleHeading(c) {
      const vx = Number.isFinite(c.vx) ? c.vx : 0,
        vy = Number.isFinite(c.vy) ? c.vy : 0,
        speed = Math.hypot(vx, vy);
      if (speed < 4 * UNITS_PER_METRE || vx * Math.cos(c.a) + vy * Math.sin(c.a) < 0) return c.a;
      // Blend from the nose to the velocity over 4..10 m/s, so a slide shows the car's side.
      const share = clamp((speed - 4 * UNITS_PER_METRE) / (6 * UNITS_PER_METRE), 0, 1) * 0.7;
      return c.a + normalizeAngle(Math.atan2(vy, vx) - c.a) * share;
    }
    /* How the camera frames what the player is in: pivot height, boom, shoulder (metres), lens, pitch. */
    const chaseShape = { pivot: 0, dist: 0, shoulder: 0, fov: 0, pitch: 0 };
    function chaseShapeFor(c) {
      const s = chaseShape;
      if (!c) {
        s.pivot = CHASE_FOOT.pivot;
        s.dist = CHASE_FOOT.dist;
        s.shoulder = CHASE_FOOT.shoulder;
        s.fov = CHASE_FOOT.fov;
        s.pitch = CHASE_FOOT.pitch;
        if (player.parachute) {
          s.pivot = 0.4;
          s.dist = 7.5;
          s.shoulder = 0;
          s.fov = 56;
        } else if (player.swimming) {
          s.pivot = 0.6;
          s.dist = 4.2;
          s.shoulder = 0.2;
        }
        return s;
      }
      const spec = vehicleSpec(c),
        length = spec.l / UNITS_PER_METRE,
        height = (spec.height ?? Math.min(32, spec.l * 0.32)) / UNITS_PER_METRE;
      s.shoulder = 0;
      if (isAircraft(c)) {
        const span = Math.max(length, spec.w / UNITS_PER_METRE);
        s.pivot = Math.max(1.5, height * 0.7);
        s.dist = span * (spec.plane ? 1.25 : 1.15) + 6;
        s.fov = 55;
        s.pitch = spec.plane ? 0.15 : 0.26;
        return s;
      }
      s.pivot = clamp(height * 0.95 + 0.35, 1.25, 4.2);
      s.dist = length * 0.72 + (spec.bike || spec.bicycle ? 2.6 : 3.3);
      s.fov = 55;
      s.pitch = spec.bike || spec.bicycle ? 0.14 : 0.13;
      if (spec.boat || spec.jetski) {
        s.dist += 1.5;
        s.pitch = 0.16;
      }
      return s;
    }
    /* Ground (or water) under a point, for the camera's floor. */
    function chaseFloor(x, y) {
      const ground = terrainHeight(x, y);
      return Number.isFinite(ground) ? Math.max(ground, 0) : 0;
    }
    /* The camera's pivot and the follow, every simulation step (camera-feel.js updateCameraFollow). */
    function updateChaseCamera(deltaSeconds) {
      if (!(deltaSeconds > 0)) return;
      const cam = chaseCam;
      cam.aspect = viewportWidth / Math.max(1, viewportHeight);
      if (cam.locked && gameMode === 'play') placeMouseOnReticle();
      if (!chaseCameraLive()) {
        cam.ready = false;
        return;
      }
      const c = player.car && !player.coaster ? player.car : null,
        comfort = motionComfortOn(),
        shape = chaseShapeFor(c),
        M = UNITS_PER_METRE;
      cam.idle += deltaSeconds;
      // Pivot: the shoulders on foot, above the middle of a vehicle.
      const body = c || player,
        bx = body.x,
        by = body.y,
        bz = c && isBoat(c) ? Math.max(0, entityElevation(c)) : entityElevation(body);
      const subject = c || player;
      if (!cam.ready || cam.subject !== subject) {
        // A new subject: the camera starts behind it.
        const heading = c ? c.a : cam.ready ? cam.yaw : player.a;
        cam.yaw = heading;
        cam.yawVel = 0;
        cam.lookYaw = cam.lookPitch = 0;
        if (!cam.ready || c) cam.pitch = shape.pitch;
        cam.wantDist = cam.dist = shape.dist * M * cam.zoom;
        cam.slope = 0;
        cam.speedBlend = 0;
        cam.subject = subject;
        cam.ready = true;
      }
      // Aiming over the shoulder eases in and out (about a fifth of a second).
      const aimWant = chaseAiming() ? 1 : 0;
      cam.aimBlend += (aimWant - cam.aimBlend) * (1 - Math.exp(-deltaSeconds * 11));
      const a = cam.aimBlend,
        pivotM = shape.pivot + (CHASE_AIM.pivot - shape.pivot) * a,
        distM = shape.dist + (CHASE_AIM.dist - shape.dist) * a,
        shoulderM = shape.shoulder + (CHASE_AIM.shoulder - shape.shoulder) * a;
      let fov = shape.fov + (CHASE_AIM.fov - shape.fov) * a;
      if (c) {
        const speed = Math.hypot(c.vx || 0, c.vy || 0),
          speedShare = clamp(speed / (150 * KMH), 0, 1);
        cam.speedBlend += ((comfort ? 0 : speedShare) - cam.speedBlend) * (1 - Math.exp(-deltaSeconds * 1.6));
        fov += 7 * cam.speedBlend;
        // The heading spring: critically damped, after the way the vehicle goes.
        const target = chaseVehicleHeading(c),
          omega = comfort ? 2.6 : isAircraft(c) ? 2.4 : 3.6,
          error = normalizeAngle(target - cam.yaw);
        cam.yawVel += (omega * omega * error - 2 * omega * cam.yawVel) * deltaSeconds;
        cam.yawVel = clamp(cam.yawVel, -6, 6);
        cam.yaw = normalizeAngle(cam.yaw + cam.yawVel * deltaSeconds);
        // A big change (a spin, a teleport) is caught up at once rather than swept round.
        if (Math.abs(normalizeAngle(target - cam.yaw)) > 2.4 && speed < 2 * M) cam.yaw = target;
        // Looking about in a vehicle eases back behind it a moment after the last look.
        if (cam.idle > CHASE_LOOK_RETURN && (speed > 1.5 * M || isAircraft(c))) {
          const back = 1 - Math.exp(-deltaSeconds * 2.2);
          cam.lookYaw -= normalizeAngle(cam.lookYaw) * back;
          cam.lookPitch -= cam.lookPitch * back;
        }
        // On a slope the camera tilts with the road (planes: with the flight path).
        let slope = 0;
        if (isAircraft(c)) {
          if (c.type === 'plane') slope = clamp(Math.atan2(c.vz || 0, Math.max(1, speed)), -0.6, 0.6) * 0.8;
        } else if (!isBoat(c)) {
          const step = 4 * M,
            ahead = terrainHeight(bx + Math.cos(c.a) * step, by + Math.sin(c.a) * step),
            behind = terrainHeight(bx - Math.cos(c.a) * step, by - Math.sin(c.a) * step);
          if (Number.isFinite(ahead + behind)) slope = Math.atan2(ahead - behind, 2 * step) * 0.7;
        }
        cam.slope += (slope - cam.slope) * (1 - Math.exp(-deltaSeconds * 3));
        cam.wantDist = distM * M * cam.zoom * (1 + 0.12 * cam.speedBlend);
      } else {
        cam.speedBlend = 0;
        cam.slope += (0 - cam.slope) * (1 - Math.exp(-deltaSeconds * 4));
        cam.lookYaw = cam.lookPitch = 0;
        cam.wantDist = distM * M * cam.zoom;
        // On foot the camera turns only when looked about, except that it eases round
        // behind a run after a while without looking (never swinging to face a run toward it).
        const m = cameraFootMotion,
          run = Math.hypot(m.vx, m.vy);
        if (!comfort && cam.idle > 2 && run > 2.5 * M && a < 0.05 && !player.carjack) {
          const error = normalizeAngle(Math.atan2(m.vy, m.vx) - cam.yaw);
          if (Math.abs(error) < 2) cam.yaw = normalizeAngle(cam.yaw + error * (1 - Math.exp(-deltaSeconds * 0.9 * clamp(run / (5 * M), 0, 1))));
        }
      }
      cam.fov = fov;
      const yaw = normalizeAngle(cam.yaw + cam.lookYaw),
        pitch = clamp(cam.pitch + cam.lookPitch - cam.slope, CHASE_PITCH_MIN, CHASE_PITCH_MAX);
      cam.px = bx;
      cam.py = by;
      cam.pz = bz + pivotM * M;
      cam.shoulder = shoulderM * M;
      // The boom: back along the view from the pivot, out to the right shoulder.
      const cy = Math.cos(yaw),
        sy = Math.sin(yaw),
        cp = Math.cos(pitch),
        sp = Math.sin(pitch),
        fx = cy * cp,
        fy = sy * cp,
        fz = -sp,
        rx = -sy,
        ry = cy,
        sx0 = cam.px + rx * cam.shoulder,
        sy0 = cam.py + ry * cam.shoulder;
      const reach = chaseBoomReach(sx0, sy0, cam.pz, -fx, -fy, -fz, cam.wantDist, c);
      // In at once in front of a wall, out again slowly (about 4 m/s).
      if (reach < cam.dist) cam.dist = reach;
      else cam.dist = Math.min(reach, cam.dist + deltaSeconds * 4 * M * (1 + cam.speedBlend * 3));
      cam.x = sx0 - fx * cam.dist;
      cam.y = sy0 - fy * cam.dist;
      cam.z = cam.pz - fz * cam.dist;
      const floor = chaseFloor(cam.x, cam.y) + CHASE_GROUND_CLEAR;
      if (cam.z < floor) cam.z = floor;
      // The camera looks through the shoulder point: along the boom, or down at it when the
      // floor lifted the camera.
      const hd = Math.hypot(sx0 - cam.x, sy0 - cam.y);
      cam.viewYaw = yaw;
      cam.viewPitch = hd > 1 ? Math.atan2(cam.z - cam.pz, hd) : pitch;
    }
    /* How far the boom can reach from (x, y, z) along the unit direction (dx, dy, dz) before a
       building (footprint and height), up to `want`; the vehicle itself is not a wall. */
    function chaseBoomReach(x, y, z, dx, dy, dz, want, vehicle) {
      const step = 4,
        n = Math.ceil(want / step);
      let ok = want;
      for (let i = 1; i <= n; i++) {
        const t = Math.min(want, i * step),
          px = x + dx * t,
          py = y + dy * t,
          pz = z + dz * t;
        if (chaseInsideBuilding(px, py, pz)) {
          ok = Math.max(CHASE_NEAR * 1.5, t - step - CHASE_WALL_MARGIN);
          break;
        }
      }
      return ok;
    }
    function chaseInsideBuilding(x, y, z) {
      const list = buildingsNear(x, y),
        m = CHASE_WALL_MARGIN;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (x + m > b.x && x - m < b.x + b.w && y + m > b.y && y - m < b.y + b.h) {
          const top = (b.base ?? 0) + (b.height || 0);
          if (z < top + m) return true;
        }
      }
      return false;
    }
    /* A teleport, a new game or a switch of view starts the camera behind the player. */
    function resetChaseCamera() {
      chaseCam.ready = false;
      chaseCam.subject = null;
      chaseCam.idle = 99;
      chaseCam.aimBlend = 0;
    }
    /* The wheel and the zoom keys in the chase view: the boom's length (0.6..1.8). */
    function chaseZoom(factor) {
      chaseCam.zoom = clamp(chaseCam.zoom / factor, 0.6, 1.8);
      return chaseCam.zoom;
    }
    /* ---- Projection (the same pinhole camera chase-view3d.js draws) -------------------------- */
    const chaseBasis = { fx: 1, fy: 0, fz: 0, rx: 0, ry: 1, ux: 0, uy: 0, uz: 1, tan: 0.5 };
    function chaseFrame() {
      const b = chaseBasis,
        yaw = chaseCam.viewYaw ?? chaseCam.yaw,
        pitch = chaseCam.viewPitch ?? chaseCam.pitch,
        cy = Math.cos(yaw),
        sy = Math.sin(yaw),
        cp = Math.cos(pitch),
        sp = Math.sin(pitch);
      b.fx = cy * cp;
      b.fy = sy * cp;
      b.fz = -sp;
      b.rx = -sy;
      b.ry = cy;
      b.ux = cy * sp;
      b.uy = sy * sp;
      b.uz = cp;
      b.tan = Math.tan((chaseCam.fov * Math.PI) / 360);
      return b;
    }
    /* A map point (x, y) at elevation z on screen (CSS px), into `out` { x, y, depth, behind }. */
    function chaseProject(x, y, z, out) {
      const b = chaseFrame(),
        dx = x - chaseCam.x,
        dy = y - chaseCam.y,
        dz = z - chaseCam.z,
        depth = dx * b.fx + dy * b.fy + dz * b.fz,
        across = dx * b.rx + dy * b.ry,
        up = dx * b.ux + dy * b.uy + dz * b.uz,
        d = Math.max(1e-3, Math.abs(depth)),
        half = viewportHeight / 2;
      out.x = viewportWidth / 2 + (across / d / b.tan) * half;
      out.y = half - (up / d / b.tan) * half;
      out.depth = depth;
      out.behind = depth <= CHASE_NEAR;
      return out;
    }
    /* The camera ray through screen point (sx, sy): origin and unit direction, into `out`. */
    function chaseRay(sx, sy, out) {
      const b = chaseFrame(),
        half = viewportHeight / 2,
        u = ((sx - viewportWidth / 2) / half) * b.tan,
        v = ((half - sy) / half) * b.tan,
        dx = b.fx + b.rx * u + b.ux * v,
        dy = b.fy + b.ry * u + b.uy * v,
        dz = b.fz + b.uz * v,
        l = Math.hypot(dx, dy, dz);
      out.ox = chaseCam.x;
      out.oy = chaseCam.y;
      out.oz = chaseCam.z;
      out.dx = dx / l;
      out.dy = dy / l;
      out.dz = dz / l;
      return out;
    }
    /* Whether a sphere at map (x, y), elevation z, radius r is on screen in the chase view, `inset`
       CSS pixels in from the edges and no further than `reach` units from the camera. */
    function chaseSees(x, y, z, r = 0, inset = 0, reach = Infinity) {
      const b = chaseFrame(),
        dx = x - chaseCam.x,
        dy = y - chaseCam.y,
        dz = z - chaseCam.z,
        depth = dx * b.fx + dy * b.fy + dz * b.fz;
      if (depth < CHASE_NEAR - r || depth > reach + r) return false;
      const across = dx * b.rx + dy * b.ry,
        up = dx * b.ux + dy * b.uy + dz * b.uz,
        half = viewportHeight / 2,
        tanV = b.tan * (1 - inset / half),
        tanH = b.tan * ((viewportWidth / 2 - inset) / half),
        // A sphere's slack across the frustum's side planes (r over the cosine of the half-angle).
        slackH = r * Math.hypot(1, tanH),
        slackV = r * Math.hypot(1, tanV);
      return Math.abs(across) <= depth * tanH + slackH && Math.abs(up) <= depth * tanV + slackV;
    }
    /* ---- Aim -------------------------------------------------------------------------------- */
    /* Where the reticle's ray meets the world: the first person or vehicle it passes close by,
       else the ground, else CHASE_AIM_REACH out. Into `out` { x, y, z, hit }. */
    const chaseAimRay = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0 },
      chaseAimOut = { x: 0, y: 0, z: 0, hit: null, t: 0 },
      chasePick = { best: 0, hit: null };
    /* One person or vehicle against the reticle's ray (chaseAimPoint): nearer than the best so far
       and within `radius` of the ray (people are tall: the vertical miss counts half). */
    function chasePickAlong(r, e, radius, height) {
      if (!e || e === player || e === player.car || e.hp <= 0 || e.hidden) return;
      const ex = e.x - r.ox,
        ey = e.y - r.oy;
      if (Math.abs(ex) > CHASE_PICK_REACH || Math.abs(ey) > CHASE_PICK_REACH) return;
      const ez = entityElevation(e) + height * 0.5 - r.oz,
        t = ex * r.dx + ey * r.dy + ez * r.dz;
      if (t < chaseCam.dist || t > chasePick.best || t > CHASE_PICK_REACH) return;
      const qx = ex - r.dx * t,
        qy = ey - r.dy * t,
        qz = ez - r.dz * t;
      if (qx * qx + qy * qy + (qz * qz) / 4 > radius * radius) return;
      chasePick.best = t;
      chasePick.hit = e;
    }
    function chaseAimPoint(out = chaseAimOut, sx = viewportWidth * CHASE_RETICLE.x, sy = viewportHeight * CHASE_RETICLE.y) {
      const r = chaseRay(sx, sy, chaseAimRay);
      chasePick.best = CHASE_AIM_REACH;
      chasePick.hit = null;
      // The ground (a level plane at the player's feet; terrain is gentle where people fight).
      const feet = entityElevation(player.car || player);
      if (r.dz < -1e-3) {
        const t = (feet - r.oz) / r.dz;
        if (t > 0 && t < chasePick.best) chasePick.best = t;
      }
      // People and vehicles the ray passes close to, beyond the player.
      for (let i = 0; i < enemies.length; i++) chasePickAlong(r, enemies[i], 3.2, PERSON_HEIGHT);
      for (let i = 0; i < gangMembers.length; i++) chasePickAlong(r, gangMembers[i], 3.2, PERSON_HEIGHT);
      for (let i = 0; i < officers.length; i++) chasePickAlong(r, officers[i], 3.2, PERSON_HEIGHT);
      for (let i = 0; i < storyActors.length; i++) chasePickAlong(r, storyActors[i], 3.2, PERSON_HEIGHT);
      for (let i = 0; i < pedestrians.length; i++) chasePickAlong(r, pedestrians[i], 3.2, PERSON_HEIGHT);
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i],
          spec = vehicleSpec(v);
        chasePickAlong(r, v, Math.max(spec.w, spec.l * 0.6) * 0.5, vehicleCollisionHeight(v));
      }
      out.x = r.ox + r.dx * chasePick.best;
      out.y = r.oy + r.dy * chasePick.best;
      out.z = r.oz + r.dz * chasePick.best;
      out.t = chasePick.best;
      out.hit = chasePick.hit;
      return out;
    }
    /* The map heading from `from` (the player or their vehicle) to the point under the reticle (or,
       without a captured pointer, under the cursor: CURSOR LOOK). */
    function chaseAimHeading(from = player.car || player) {
      const p = chaseCam.locked || !mouse.active ? chaseAimPoint() : chaseAimPoint(chaseAimOut, mouse.x, mouse.y);
      const dx = p.x - from.x,
        dy = p.y - from.y;
      if (Math.hypot(dx, dy) < 4) return chaseCam.viewYaw ?? chaseCam.yaw;
      return Math.atan2(dy, dx);
    }
    /* The way the movement keys point in the chase view: rotated from the screen to the camera's heading. */
    function chaseMoveHeading(x, y) {
      // x: right (+1) / left (-1), y: back (+1) / forward (-1), as the street view's screen axes.
      const yaw = chaseCam.viewYaw ?? chaseCam.yaw;
      return normalizeAngle(Math.atan2(y, x) + yaw + Math.PI / 2);
    }
    /* DeadEndCity.chaseCamera(): the view mode and where the chase camera stands and looks. */
    function chaseCameraReport() {
      const r = (v, d = 1) => (Number.isFinite(v) ? +v.toFixed(d) : null),
        deg = (v) => (Number.isFinite(v) ? Math.round((v * 180) / Math.PI) : null),
        aim = chaseCameraLive() && chaseCam.ready ? chaseAimPoint({ x: 0, y: 0, z: 0, hit: null, t: 0 }) : null,
        M = UNITS_PER_METRE;
      return {
        mode: viewMode,
        live: chaseCameraLive(),
        ready: chaseCam.ready,
        locked: chaseCam.locked,
        position: [r(chaseCam.x), r(chaseCam.y), r(chaseCam.z)],
        pivot: [r(chaseCam.px), r(chaseCam.py), r(chaseCam.pz)],
        yawDeg: deg(chaseCam.viewYaw ?? chaseCam.yaw),
        pitchDeg: deg(chaseCam.viewPitch ?? chaseCam.pitch),
        lookYawDeg: deg(chaseCam.lookYaw),
        fov: r(chaseCam.fov),
        boomMetres: r(chaseCam.dist / M, 2),
        wantMetres: r(chaseCam.wantDist / M, 2),
        heightMetres: r((chaseCam.z - chaseFloor(chaseCam.x, chaseCam.y)) / M, 2),
        aiming: r(chaseCam.aimBlend, 2),
        speedBlend: r(chaseCam.speedBlend, 2),
        zoom: r(chaseCam.zoom, 2),
        aim: aim
          ? { metres: r(aim.t / M), at: [r(aim.x), r(aim.y), r(aim.z)], hit: aim.hit ? aim.hit.type || aim.hit.role || aim.hit.faction || 'person' : null, headingDeg: deg(chaseAimHeading()) }
          : null,
        sensitivity: settings.lookSensitivity ?? 100,
        invert: !!settings.invertLook,
      };
    }
