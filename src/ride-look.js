    // Ride head-look: on the Sunset Eye and the Falcon the pointer's place on screen, a touch drag or the gamepad's
    // right stick turns the rider's head (updateRideLook); the ride camera (themepark3d-shows.js) reads rideLookAngles().
    /**
     * RIDE HEAD-LOOK
     * Only the look moves: nothing here touches the player, the ride or any other
     * game state, and a click does nothing new (it does what it always did).
     * - Mouse (no click, no pointer lock: the claude.ai frame may refuse it): the
     *   pointer's place on screen is where the head points, read on the window so
     *   the HUD (the radio panel, the minimap) never freezes it. The centre looks
     *   straight ahead; towards the side edges the head and shoulders turn up to
     *   RIDE_LOOK_YAW, towards the top RIDE_LOOK_UP, the bottom RIDE_LOOK_DOWN.
     *   A small dead zone at the centre, then a curve gentle near the centre and
     *   quicker towards the edges (rideLookCurve). Until the pointer moves after a
     *   reset the head faces forward.
     * - Touch: a one-finger drag on the world turns the head by as much as the
     *   finger moves (half the screen = the full range) and it stays where it was
     *   left; a second finger (the pinch) stops the drag.
     * - Gamepad: the right stick holds the head turned while it is pushed, and
     *   it eases back to forward when let go.
     * The newest input wins (`source`). The head follows its target through a
     * critically damped spring (RIDE_LOOK_SMOOTH), so it never snaps or jitters.
     * Boarding, leaving and every view change with E (a camera cut) reset it to
     * forward. In the seat views (the Eye's capsule, the Falcon's front seat) the
     * angles turn the head about the seat's own up; the camera views (chase,
     * trackside, the orbit round the wheel) turn by RIDE_LOOK_CAMERA_* of them.
     */
    const RIDE_LOOK_YAW = (120 * Math.PI) / 180,
      RIDE_LOOK_UP = (50 * Math.PI) / 180,
      RIDE_LOOK_DOWN = (60 * Math.PI) / 180,
      // Fraction of the half screen (or of the stick) that still looks straight ahead.
      RIDE_LOOK_DEAD = 0.06,
      RIDE_LOOK_PAD_DEAD = 0.2,
      // Seconds: the spring's smoothing time (about 90 % of a turn in twice this).
      RIDE_LOOK_SMOOTH = 0.18,
      // Camera views: +-60 deg of yaw, +-30 deg of pitch at the edges.
      RIDE_LOOK_CAMERA_YAW = 0.5,
      RIDE_LOOK_CAMERA_UP = 0.6,
      RIDE_LOOK_CAMERA_DOWN = 0.5,
      // Ride seconds before the one hint a ride gets (after the boarding line).
      RIDE_LOOK_HINT_AT = 2;
    const rideLook = {
      // The ride and view the look belongs to; any change resets it.
      ride: null,
      view: -1,
      yaw: 0,
      pitch: 0,
      yawRate: 0,
      pitchRate: 0,
      targetYaw: 0,
      targetPitch: 0,
      // 'none' | 'mouse' | 'touch' | 'pad': the newest input since the last reset.
      source: 'none',
      // The pointer anywhere over the page (client px) and whether it moved since the last reset.
      mouseX: 0,
      mouseY: 0,
      mouseMoved: false,
      touchId: null,
      touchX: 0,
      touchY: 0,
      touchYaw: 0,
      touchPitch: 0,
      hinted: false,
    };
    // Touch pointers down on the world (a second one is a pinch, not a look).
    const rideLookTouches = new Set();
    /* 0..1 of the range for a 0..1 push past a dead zone: gentle near the centre, quicker towards the edge. */
    function rideLookCurve(n, dead) {
      const u = clamp((n - dead) / (1 - dead), 0, 1);
      return u * (0.35 + 0.65 * u);
    }
    /* The Eye's capsule and the Falcon's front seat: a head, not a camera. */
    function rideLookSeat(ride) {
      return ride.kind === 'wheel' ? ride.view === 0 : ride.view === 1;
    }
    function rideLookReset(ride) {
      rideLook.ride = ride;
      rideLook.view = ride ? ride.view : -1;
      rideLook.yaw = rideLook.pitch = rideLook.yawRate = rideLook.pitchRate = 0;
      rideLook.targetYaw = rideLook.targetPitch = 0;
      rideLook.touchYaw = rideLook.touchPitch = 0;
      // `mouseMoved` is kept: a move since the last step (the frame E was pressed in) counts as after the reset.
      rideLook.source = 'none';
    }
    function rideLookHint() {
      const device = hintDevice();
      if (device === 'touch') return 'Drag to look around.';
      if (device === 'gamepad') return 'Right stick to look around.';
      return 'Move the mouse to look around.';
    }
    /* Each game step (themepark-rides.js updateCoaster): inputs to a target, the spring to the head. */
    function updateRideLook(deltaSeconds) {
      const ride = player.coaster;
      if (ride !== rideLook.ride || (ride && ride.view !== rideLook.view)) {
        if (ride !== rideLook.ride) rideLook.hinted = false;
        rideLookReset(ride);
      }
      if (!ride) {
        // Off a ride the pointer's moves are the aim's, never a head turn waiting for the next ride.
        rideLook.mouseMoved = false;
        return;
      }
      if (!rideLook.hinted && ride.time >= RIDE_LOOK_HINT_AT) {
        rideLook.hinted = true;
        tell(rideLookHint(), 4, { id: 'ride-look' });
      }
      // The newest input wins.
      if (rideLook.mouseMoved) {
        rideLook.mouseMoved = false;
        rideLook.source = 'mouse';
      }
      const padX = gamepad.lookX,
        padY = gamepad.lookY,
        padPush = hypot2(padX, padY);
      if (padPush > RIDE_LOOK_PAD_DEAD) rideLook.source = 'pad';
      let yaw = 0,
        pitch = 0;
      if (rideLook.source === 'mouse') {
        const halfW = Math.max(1, viewportWidth / 2),
          halfH = Math.max(1, viewportHeight / 2),
          nx = clamp((rideLook.mouseX - halfW) / halfW, -1, 1),
          ny = clamp((rideLook.mouseY - halfH) / halfH, -1, 1);
        yaw = (nx < 0 ? -1 : 1) * rideLookCurve(Math.abs(nx), RIDE_LOOK_DEAD) * RIDE_LOOK_YAW;
        pitch = ny < 0 ? rideLookCurve(-ny, RIDE_LOOK_DEAD) * RIDE_LOOK_UP : -rideLookCurve(ny, RIDE_LOOK_DEAD) * RIDE_LOOK_DOWN;
      } else if (rideLook.source === 'touch') {
        yaw = rideLook.touchYaw;
        pitch = rideLook.touchPitch;
      } else if (rideLook.source === 'pad' && padPush > RIDE_LOOK_PAD_DEAD) {
        const push = rideLookCurve(Math.min(1, padPush), RIDE_LOOK_PAD_DEAD),
          ux = padX / padPush,
          uy = padY / padPush;
        yaw = ux * push * RIDE_LOOK_YAW;
        pitch = uy < 0 ? -uy * push * RIDE_LOOK_UP : -uy * push * RIDE_LOOK_DOWN;
      }
      if (rideLook.targetYaw !== yaw) rideLook.targetYaw = yaw;
      if (rideLook.targetPitch !== pitch) rideLook.targetPitch = pitch;
      // Critically damped spring (the smooth-damp step: stable at any frame time).
      const dt = Math.max(0, Math.min(0.25, deltaSeconds));
      if (dt <= 0) return;
      const omega = 2 / RIDE_LOOK_SMOOTH,
        x = omega * dt,
        decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      let change = rideLook.yaw - yaw,
        temp = (rideLook.yawRate + omega * change) * dt,
        rate = (rideLook.yawRate - omega * temp) * decay,
        value = yaw + (change + temp) * decay;
      if (Math.abs(value - yaw) < 1e-5 && Math.abs(rate) < 1e-4) {
        value = yaw;
        rate = 0;
      }
      if (rideLook.yaw !== value) rideLook.yaw = value;
      if (rideLook.yawRate !== rate) rideLook.yawRate = rate;
      change = rideLook.pitch - pitch;
      temp = (rideLook.pitchRate + omega * change) * dt;
      rate = (rideLook.pitchRate - omega * temp) * decay;
      value = pitch + (change + temp) * decay;
      if (Math.abs(value - pitch) < 1e-5 && Math.abs(rate) < 1e-4) {
        value = pitch;
        rate = 0;
      }
      if (rideLook.pitch !== value) rideLook.pitch = value;
      if (rideLook.pitchRate !== rate) rideLook.pitchRate = rate;
    }
    /**
     * What the ride camera turns by this frame (radians; yaw > 0 turns right,
     * pitch > 0 looks up), written into `out` { yaw, pitch, seat }: the head's
     * angles in a seat view, scaled down in a camera view, zero off a ride or on
     * the frame a view changed (before the next step resets the head).
     */
    function rideLookAngles(out) {
      const ride = player.coaster;
      let yaw = 0,
        pitch = 0,
        seat = false;
      if (ride && ride === rideLook.ride && ride.view === rideLook.view) {
        seat = rideLookSeat(ride);
        yaw = seat ? rideLook.yaw : rideLook.yaw * RIDE_LOOK_CAMERA_YAW;
        pitch = seat ? rideLook.pitch : rideLook.pitch * (rideLook.pitch > 0 ? RIDE_LOOK_CAMERA_UP : RIDE_LOOK_CAMERA_DOWN);
      }
      if (out.yaw !== yaw) out.yaw = yaw;
      if (out.pitch !== pitch) out.pitch = pitch;
      if (out.seat !== seat) out.seat = seat;
      return out;
    }
    // The pointer over the whole page (game-input.js reads it on the canvas only, for the aim); mouse events made
    // from a touch are skipped as the aim skips them.
    window.addEventListener(
      'mousemove',
      (e) => {
        if (performance.now() < worldTouchUntil || e.sourceCapabilities?.firesTouchEvents) return;
        if (e.clientX === rideLook.mouseX && e.clientY === rideLook.mouseY) return;
        rideLook.mouseX = e.clientX;
        rideLook.mouseY = e.clientY;
        rideLook.mouseMoved = true;
      },
      { capture: true, passive: true },
    );
    // A one-finger drag on the world while riding turns the head (world-view.js keeps the pinch zoom).
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || gameMode !== 'play' || !player.coaster) return;
      rideLookTouches.add(e.pointerId);
      if (rideLookTouches.size === 1) {
        rideLook.touchId = e.pointerId;
        rideLook.touchX = e.clientX;
        rideLook.touchY = e.clientY;
      } else rideLook.touchId = null;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch' || e.pointerId !== rideLook.touchId || !player.coaster) return;
      const dx = e.clientX - rideLook.touchX,
        dy = e.clientY - rideLook.touchY;
      rideLook.touchX = e.clientX;
      rideLook.touchY = e.clientY;
      rideLook.touchYaw = clamp(rideLook.touchYaw + (dx / Math.max(1, viewportWidth / 2)) * RIDE_LOOK_YAW, -RIDE_LOOK_YAW, RIDE_LOOK_YAW);
      rideLook.touchPitch = clamp(rideLook.touchPitch - (dy / Math.max(1, viewportHeight / 2)) * RIDE_LOOK_UP, -RIDE_LOOK_DOWN, RIDE_LOOK_UP);
      rideLook.source = 'touch';
    });
    for (const type of ['pointerup', 'pointercancel'])
      canvas.addEventListener(type, (e) => {
        if (e.pointerType !== 'touch') return;
        rideLookTouches.delete(e.pointerId);
        if (e.pointerId === rideLook.touchId) rideLook.touchId = null;
      });
    /* Console rideLook(): the head's state in degrees, and the viewport the pointer is read against. */
    function rideLookReport() {
      const ride = player.coaster,
        deg = (r) => Math.round((r * 1800) / Math.PI) / 10,
        applied = rideLookAngles({ yaw: 0, pitch: 0, seat: false });
      return {
        active: !!ride,
        kind: ride ? ride.kind : null,
        view: ride ? ride.view : null,
        seat: applied.seat,
        yaw: deg(rideLook.yaw),
        pitch: deg(rideLook.pitch),
        targetYaw: deg(rideLook.targetYaw),
        targetPitch: deg(rideLook.targetPitch),
        // What the camera turns by (scaled down in the camera views).
        cameraYaw: deg(applied.yaw),
        cameraPitch: deg(applied.pitch),
        source: rideLook.source,
        pointer: [Math.round(rideLook.mouseX), Math.round(rideLook.mouseY)],
        viewport: [viewportWidth, viewportHeight],
        limits: { yaw: deg(RIDE_LOOK_YAW), up: deg(RIDE_LOOK_UP), down: deg(RIDE_LOOK_DOWN), smooth: RIDE_LOOK_SMOOTH },
      };
    }
