    // Camera feel: the street camera's follow (a lead along the vehicle's path; on foot the way the
    // player goes and toward the aim in a fight) and its kicks and shake, offsets the renderer adds.
    /**
     * CAMERA FEEL
     * FOLLOW: the view is pulled after the player by a critically damped spring
     * (camera-drive.js cameraSpring: exact at any frame rate, never overshooting) with
     * a LEAD. In a road vehicle or a boat that is the DRIVING FOLLOW (camera-drive.js:
     * a steady lead along the smoothed way it goes, firm along the road, soft across
     * it, a smoothed height). In an aircraft about 0.45 s of travel along its velocity
     * (not its nose), up to CAMERA_LEAD_AHEAD ahead or CAMERA_LEAD_BEHIND reversing; on
     * foot a little of the way the player runs and, in a fight (footwork.js
     * playerInFight), a share of the way to the cursor or the aim, so the street the
     * gun points at is on screen; these leads ease on their own (CAMERA_LEAD_RATE) and
     * the spring keeps the old lag. Settings · Driving · Camera look-ahead scales every
     * lead (0 turns them off). CHASE FRAMING: with police on the player's tail (a unit
     * within CAMERA_CHASE_REACH behind), a vehicle's lead shrinks by up to
     * CAMERA_CHASE_PULL so the pursuer stays in the frame.
     * KICKS: kickCamera(heading, units) pushes the view along a map heading; a
     * damped spring (CAMERA_KICK_SPRING / _DAMPING, about 0.1 s to the peak) brings
     * it back. Gunfire kicks against the aim, crashes along the way the car was
     * going, blasts away from the blast, a hit away from the shooter. In a road
     * vehicle a kick goes CAMERA_KICK_VEHICLE as far and settles with no bounce.
     * SHAKE: `shake` (game-state.js) is drawn as a smooth tremor of a few sines
     * (cameraShakeOffset) instead of a new random offset each frame, which read as
     * jitter at low frame rates; in a road vehicle at CAMERA_SHAKE_VEHICLE of `shake`
     * (cameraShakeLevel). The renderer (render3d-frame.js) and the 2D view add
     * cameraKick and the tremor to the camera; nothing in the game reads them.
     * MOTION COMFORT (settings.js motionComfortOn): no kicks and no tremor, and on
     * foot no lean toward the aim.
     */
    const CAMERA_LEAD_SECONDS = 0.45,
      CAMERA_LEAD_AHEAD = 300,
      CAMERA_LEAD_BEHIND = 80,
      CAMERA_LEAD_RATE = 2.4,
      CAMERA_FOOT_LEAD_SECONDS = 0.3,
      CAMERA_FOOT_LEAD_MAX = 28,
      CAMERA_AIM_SHARE = 0.3,
      CAMERA_AIM_MAX = 52,
      CAMERA_AIM_KEYS = 34,
      CAMERA_CHASE_REACH = 420,
      CAMERA_CHASE_PULL = 0.35,
      CAMERA_KICK_SPRING = 150,
      CAMERA_KICK_DAMPING = 17,
      // Impulse per unit of peak displacement for that spring (about 1 / 0.0378).
      CAMERA_KICK_IMPULSE = 26.5,
      CAMERA_KICK_MAX = 22,
      // In a road vehicle: kicks this share as far, settled without a bounce (critical damping),
      // and the tremor this share of `shake` (cameraShakeLevel).
      CAMERA_KICK_VEHICLE = 0.7,
      CAMERA_KICK_VEHICLE_DAMPING = 2 * Math.sqrt(CAMERA_KICK_SPRING),
      CAMERA_SHAKE_VEHICLE = 0.45;
    const cameraLead = { x: 0, y: 0 },
      cameraKick = { x: 0, y: 0, vx: 0, vy: 0 },
      cameraFootMotion = { x: 0, y: 0, vx: 0, vy: 0, ready: false },
      cameraShakeOut = { x: 0, y: 0 };
    /* Push the view along map heading `angle`, peaking about `amount` units out. */
    function kickCamera(angle, amount) {
      if (!(amount > 0) || !Number.isFinite(angle) || motionComfortOn()) return;
      const v = Math.min(amount, CAMERA_KICK_MAX) * CAMERA_KICK_IMPULSE * (cameraInRoadVehicle() ? CAMERA_KICK_VEHICLE : 1);
      cameraKick.vx += Math.cos(angle) * v;
      cameraKick.vy += Math.sin(angle) * v;
      // Several kicks at once (a shotgun into a crash) must not throw the view away.
      const speed = Math.hypot(cameraKick.vx, cameraKick.vy),
        top = CAMERA_KICK_MAX * CAMERA_KICK_IMPULSE;
      if (speed > top) {
        cameraKick.vx *= top / speed;
        cameraKick.vy *= top / speed;
      }
    }
    function updateCameraKick(deltaSeconds) {
      // Semi-implicit steps of at most 1/120 s: stable at any frame rate.
      const steps = Math.min(8, Math.ceil(deltaSeconds * 120));
      if (!steps) return;
      const dt = deltaSeconds / steps,
        k = cameraKick,
        damping = cameraInRoadVehicle() ? CAMERA_KICK_VEHICLE_DAMPING : CAMERA_KICK_DAMPING;
      for (let i = 0; i < steps; i++) {
        k.vx += (-CAMERA_KICK_SPRING * k.x - damping * k.vx) * dt;
        k.vy += (-CAMERA_KICK_SPRING * k.y - damping * k.vy) * dt;
        k.x += k.vx * dt;
        k.y += k.vy * dt;
      }
      if (Math.abs(k.x) + Math.abs(k.y) + (Math.abs(k.vx) + Math.abs(k.vy)) * 0.02 < 0.01) k.x = k.y = k.vx = k.vy = 0;
    }
    /* The tremor for `shake` at game time `t`, in map units (x across, y down the
       screen): a few sines at unrelated rates, about +-0.35 shake across. */
    function cameraShakeOffset(t, amount, out = cameraShakeOut) {
      out.x = amount * (0.21 * Math.sin(t * 83.1 + 1.3) + 0.14 * Math.sin(t * 131.7 + 0.4));
      out.y = amount * (0.13 * Math.sin(t * 97.3 + 2.1) + 0.09 * Math.sin(t * 149.9 + 5.2));
      return out;
    }
    /* The player's ground velocity on foot, smoothed (a teleport is not a velocity). */
    function trackFootMotion(deltaSeconds) {
      const m = cameraFootMotion;
      if (!m.ready || deltaSeconds <= 0) {
        m.x = player.x;
        m.y = player.y;
        m.ready = true;
        return;
      }
      let vx = (player.x - m.x) / deltaSeconds,
        vy = (player.y - m.y) / deltaSeconds;
      if (Math.hypot(vx, vy) > 600) vx = vy = 0;
      const blend = 1 - Math.exp(-deltaSeconds * 6);
      m.vx += (vx - m.vx) * blend;
      m.vy += (vy - m.vy) * blend;
      m.x = player.x;
      m.y = player.y;
    }
    /* How close a police unit sits on the tail of the player's vehicle, 0..1
       (checked four times a second). */
    const cameraChase = { at: -1, close: 0 };
    function cameraChaseCloseness(c, vx, vy, speed) {
      if (!(wantedStars > 0)) return (cameraChase.close = 0);
      if (gameTime >= cameraChase.at && gameTime - cameraChase.at < 0.25) return cameraChase.close;
      cameraChase.at = gameTime;
      let close = 0;
      for (const u of vehicles) {
        if (u === c || !(u.cop || u.lawUnit) || u.hp <= 0 || u.crewDeployed || u.blockade) continue;
        const dx = u.x - c.x,
          dy = u.y - c.y;
        if (Math.abs(dx) > CAMERA_CHASE_REACH || Math.abs(dy) > CAMERA_CHASE_REACH) continue;
        // Behind: at least a car's length back along the way the player is going.
        if ((dx * vx + dy * vy) / speed > -40) continue;
        close = Math.max(close, 1 - Math.hypot(dx, dy) / CAMERA_CHASE_REACH);
      }
      cameraChase.close = close;
      return close;
    }
    /* Where the lead wants to be now (units from the player), into `out`. */
    const cameraLeadAim = { x: 0, y: 0 };
    function cameraLeadTarget(out) {
      out.x = out.y = 0;
      const scale = drivingLookAhead(),
        c = player.car;
      if (!scale) return out;
      if (c) {
        const vx = c.vx === c.vx ? c.vx || 0 : Math.cos(c.a) * (c.speed || 0),
          vy = c.vy === c.vy ? c.vy || 0 : Math.sin(c.a) * (c.speed || 0),
          speed = Math.hypot(vx, vy);
        if (speed < 1) return out;
        const forward = vx * Math.cos(c.a) + vy * Math.sin(c.a) >= 0,
          chase = 1 - CAMERA_CHASE_PULL * cameraChaseCloseness(c, vx, vy, speed),
          lead = Math.min(speed * CAMERA_LEAD_SECONDS, forward ? CAMERA_LEAD_AHEAD : CAMERA_LEAD_BEHIND) * scale * chase;
        out.x = (vx / speed) * lead;
        out.y = (vy / speed) * lead;
        return out;
      }
      if (player.coaster || player.parachute || transitRide || taxiRide || player.fall || player.thrown) return out;
      // The way the player runs: a few metres at a sprint.
      const m = cameraFootMotion,
        run = Math.hypot(m.vx, m.vy) * CAMERA_FOOT_LEAD_SECONDS,
        runLead = Math.min(run, CAMERA_FOOT_LEAD_MAX);
      if (run > 0.5) {
        out.x = (m.vx / Math.hypot(m.vx, m.vy)) * runLead;
        out.y = (m.vy / Math.hypot(m.vx, m.vy)) * runLead;
      }
      // In a fight with a gun: toward the cursor (a share of its offset from the
      // middle of the screen, so the view does not chase the cursor), or along the
      // aim with the keyboard or the touch stick.
      const w = currentWeapon();
      if (!w.melee && !motionComfortOn() && (touchAim !== null || playerInFight()) && !player.swimming && !player.carjack) {
        let ax = 0,
          ay = 0;
        if (touchAim === null && mouse.active) {
          const ground = city3D ? city3D.groundPoint(mouse.x, mouse.y, entityElevation(player)) : null;
          if (ground) {
            ax = (ground.x - cameraTarget.x) * CAMERA_AIM_SHARE;
            ay = (ground.y - cameraTarget.y) * CAMERA_AIM_SHARE;
          } else if (!city3D) {
            ax = ((mouse.x - viewportWidth / 2) / Math.max(0.01, canvasScale)) * CAMERA_AIM_SHARE;
            ay = ((mouse.y - viewportHeight / 2) / Math.max(0.01, canvasScale)) * CAMERA_AIM_SHARE;
          }
          const d = Math.hypot(ax, ay);
          if (d > CAMERA_AIM_MAX) {
            ax *= CAMERA_AIM_MAX / d;
            ay *= CAMERA_AIM_MAX / d;
          }
        } else {
          const a = aim();
          ax = Math.cos(a) * CAMERA_AIM_KEYS;
          ay = Math.sin(a) * CAMERA_AIM_KEYS;
        }
        out.x = out.x * 0.4 + ax;
        out.y = out.y * 0.4 + ay;
      }
      out.x *= scale;
      out.y *= scale;
      return out;
    }
    /* The street camera's target for this frame (game-update.js), its framing (world-view.js)
       and the comfort log (camera-comfort.js). */
    function updateCameraFollow(deltaSeconds) {
      if (!(deltaSeconds > 0)) return;
      trackFootMotion(deltaSeconds);
      updateCameraKick(deltaSeconds);
      updateDrivingCameraSpeed(deltaSeconds);
      updateCameraFraming(deltaSeconds);
      followCamera(deltaSeconds);
      updateCameraHeight(deltaSeconds);
      // The chase view behind the player (chase-camera.js), when it is the view.
      updateCursorLook(deltaSeconds);
      updateChaseCamera(deltaSeconds);
      recordCameraComfort(deltaSeconds);
    }
    function followCamera(deltaSeconds) {
      const c = player.car,
        frame = garageCameraFrame();
      if (c?.type === 'plane') {
        // A plane: its velocity led by 0.42 s, the view held close behind it.
        cameraDrive.on = false;
        const lead = 1 - Math.exp(-deltaSeconds * 1.4);
        cameraLead.x += ((c.vx || 0) * 0.42 - cameraLead.x) * lead;
        cameraLead.y += ((c.vy || 0) * 0.42 - cameraLead.y) * lead;
        const hold = 1 - Math.exp(-deltaSeconds * 7),
          x = cameraTarget.x,
          y = cameraTarget.y;
        cameraTarget.x += (player.x + cameraLead.x - cameraTarget.x) * hold;
        cameraTarget.y += (player.y + cameraLead.y - cameraTarget.y) * hold;
        cameraVel.x = (cameraTarget.x - x) / deltaSeconds;
        cameraVel.y = (cameraTarget.y - y) / deltaSeconds;
        return;
      }
      // A road vehicle or a boat: the comfortable follow (camera-drive.js DRIVING FOLLOW).
      if (c && !isAircraft(c) && !frame) return followVehicle(c, deltaSeconds);
      cameraDrive.on = false;
      const want = cameraLeadTarget(cameraLeadAim),
        ease = 1 - Math.exp(-deltaSeconds * CAMERA_LEAD_RATE);
      cameraLead.x += (want.x - cameraLead.x) * ease;
      cameraLead.y += (want.y - cameraLead.y) * ease;
      // On foot and the rest: a critically damped spring with the old first-order lag (twice
      // its rate), so nothing jerks when the follow changes hands. A coaster outruns the usual
      // trailing camera: stay with the train. A garage's drive-in show frames the bay.
      const rate = 2 * (player.coaster ? 10 : 4.5);
      cameraSpring(frame ? frame.x : player.x + cameraLead.x, frame ? frame.y : player.y + cameraLead.y, 0, 0, 1, 0, rate, rate, deltaSeconds);
    }
    /* A teleport starts the view afresh on the player (game-input.js teleportPlayer). */
    function resetCameraFeel() {
      cameraLead.x = cameraLead.y = 0;
      cameraKick.x = cameraKick.y = cameraKick.vx = cameraKick.vy = 0;
      cameraFootMotion.ready = false;
      resetCameraDrive();
      resetCameraComfort();
      resetChaseCamera();
    }
    // A road vehicle or a boat under the player: the driving follow, its height and its gentler jolts.
    function cameraInRoadVehicle() {
      return !!player.car && !isAircraft(player.car);
    }
    /* The height the street camera looks at (render3d-frame.js): in a road vehicle the
       smoothed one (camera-drive.js), a boat's water line (a boat dipping under a bridge
       deck must not jolt the view), else the player's. */
    function streetCameraAltitude() {
      const c = player.car;
      if (c && isBoat(c)) return 0;
      if (c && !isAircraft(c) && cameraHeight.ready) return cameraHeight.z;
      return entityElevation(c || player);
    }
    /* The tremor's amount the renderers draw (cameraShakeOffset): in a road vehicle
       CAMERA_SHAKE_VEHICLE of it, so a kerb, a trail or a crash rumbles without blurring the road. */
    function cameraShakeLevel() {
      if (motionComfortOn()) return 0;
      return cameraInRoadVehicle() ? shake * CAMERA_SHAKE_VEHICLE : shake;
    }
    /* DeadEndCity.cameraFeel(): the lead (units and metres), where the view stands
       from the player, the kick and the shake. */
    function cameraFeelReport() {
      const r = (v) => +v.toFixed(1);
      return {
        lead: [r(cameraLead.x), r(cameraLead.y)],
        leadMetres: r(worldMeters(Math.hypot(cameraLead.x, cameraLead.y))),
        leadHeading: Math.hypot(cameraLead.x, cameraLead.y) > 1 ? Math.round((Math.atan2(cameraLead.y, cameraLead.x) * 180) / Math.PI) : null,
        want: [r(cameraLeadAim.x), r(cameraLeadAim.y)],
        offset: [r(cameraTarget.x - player.x), r(cameraTarget.y - player.y)],
        kick: [r(cameraKick.x), r(cameraKick.y)],
        kickSpeed: r(Math.hypot(cameraKick.vx, cameraKick.vy)),
        shake: +shake.toFixed(2),
        // The tremor actually drawn (less in a road vehicle) and the camera's height over the raw one.
        shakeDrawn: +cameraShakeLevel().toFixed(2),
        heightLag: r(streetCameraAltitude() - (player.car && isBoat(player.car) ? 0 : entityElevation(player.car || player))),
        lookAhead: drivingLookAhead(),
        chase: +cameraChase.close.toFixed(2),
        // The driving follow (camera-drive.js): on, the lead's heading, the speed the framing reads (km/h), the view's speed.
        drive: cameraDrive.on,
        driveHeading: Math.round((cameraDrive.h * 180) / Math.PI),
        driveKmh: Math.round(cameraDrive.speed / KMH),
        viewSpeed: r(Math.hypot(cameraVel.x, cameraVel.y)),
      };
    }
