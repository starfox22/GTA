    // BEGIN SUBSYSTEM: src/world-view.js — World camera gestures
    /**
     * World camera gestures
     * Source: src/world-view.js
     * Scope: shared game closure.
     * World zoom, pinch gestures, mouse wheel and camera limits.
     */
    /* World gestures are independent from navigation-map gestures and touch sticks. */
    /* The street view's default zoom. At true scale a car is 4.8 m and a person
       1.75 m (game.js WORLD SCALE). On foot the camera stands close enough that
       a person reads clearly (about 28 px tall on a 1280 x 800 screen, over
       about 34 m of street top to bottom: one zoom step, x1.25, out from the
       old 2.5, so more of the street round the player is on screen); in a
       vehicle it frames wider (CAMERA CONTEXT below) and eases back further
       with speed (SPEED PULL-BACK). The wheel reaches from the whole district (0.14) to 4.5,
       close enough to see a face. The player's zoom is one number: the context
       and speed framing are factors on it, so a player who zooms out on foot is
       zoomed out in the car too. The zoom is not saved: every start is here. */
    const STREET_ZOOM = 2,
      // One step of the zoom keys (game-input.js).
      STREET_ZOOM_STEP = 1.25,
      STREET_ZOOM_MIN = 0.14,
      STREET_ZOOM_MAX = 4.5;
    /* CAMERA CONTEXT: the share of the player's zoom the camera frames at for
       what the player is in, so entering a car pulls the view back over a
       couple of seconds and stepping out brings it in again (both eased with
       the speed framing in updateCameraFraming). A car at rest frames at 0.56
       of the on-foot zoom (1.12 by default: two zoom steps further out than the
       old 1.75, so the street flows past the screen more slowly, which is what
       eases motion sickness, and more of the road ahead is in view); motorbikes,
       bicycles, long vehicles and boats keep their proportions to it. Settings ·
       Driving · Vehicle camera distance is a factor on every vehicle's share
       (vehicleCameraFactor, driving.js). Rides keep 0.7; aircraft keep the
       framing the flight view was tuned at (1.6 by default), the parachute its own. */
    const CAMERA_CONTEXT = {
      car: 0.56,
      bike: 0.61,
      bicycle: 0.66,
      long: 0.48,
      boat: 0.48,
      air: 1.6 / STREET_ZOOM,
      ride: 0.7,
      parachute: 0.78 * STREET_ZOOM_STEP,
      // Pulling a driver out of a car (carjack-struggle.js): in close on the struggle.
      carjack: 1.3,
    };
    function cameraContextZoom() {
      const c = player.car;
      if (c) {
        const spec = vehicleSpec(c);
        if (isAircraft(c)) return CAMERA_CONTEXT.air;
        const far = vehicleCameraFactor();
        if (spec.boat || spec.jetski) return CAMERA_CONTEXT.boat * far;
        if (spec.bicycle) return CAMERA_CONTEXT.bicycle * far;
        if (spec.bike) return CAMERA_CONTEXT.bike * far;
        if (spec.truck || spec.tank || spec.l > 7 * UNITS_PER_METRE) return CAMERA_CONTEXT.long * far;
        return CAMERA_CONTEXT.car * far;
      }
      if (player.parachute) return CAMERA_CONTEXT.parachute;
      if (transitRide || taxiRide || player.coaster) return CAMERA_CONTEXT.ride;
      if (player.carjack && player.carjack.phase !== 'approach') return CAMERA_CONTEXT.carjack;
      return 1;
    }
    let worldZoom = STREET_ZOOM,
      worldZoomTarget = STREET_ZOOM,
      // The context and speed framing (cameraContextZoom × speedZoomTarget), eased in
      // two stages (framingStage, then speedZoom), on top of the player's zoom.
      framingStage = 1,
      speedZoom = 1,
      worldTouchUntil = 0,
      worldPinch = null,
      worldSafariGesture = null,
      incomingCallRemaining = 0;
    const worldPointers = new Map();
    function setWorldZoom(value) {
      worldZoomTarget = clamp(value, STREET_ZOOM_MIN, STREET_ZOOM_MAX);
    }
    // The factor on the player's zoom the camera eases towards (updateWorldView).
    function cameraFramingTarget() {
      // A garage's drive-in show eases in closer, and quicker (garages.js).
      const garageFrame = garageCameraFrame(),
        context = cameraContextZoom();
      // So does a drawbridge opening close by, the other way: back a little (drawbridge.js).
      return context * (garageFrame ? garageFrame.zoom : speedZoomTarget(context) * drawbridgeCameraZoom());
    }
    function resetWorldGesture() {
      worldPointers.clear();
      worldPinch = null;
      worldSafariGesture = null;
    }
    function updateWorldView(deltaSeconds) {
      if (gameMode !== 'play') {
        resetWorldGesture();
        return;
      }
      worldZoom += (worldZoomTarget * speedZoom - worldZoom) * (1 - Math.exp(-deltaSeconds * 12));
      canvasScale = clamp(Math.min(viewportWidth / 1250, viewportHeight / 850), 0.72, 1.35) * worldZoom;
      incomingCallRemaining = Math.max(0, incomingCallRemaining - deltaSeconds);
    }
    /* The context and speed framing eases with the simulation (camera-feel.js
       updateCameraFollow, so console simulate() advances it too), in two
       first-order stages: the zoom's rate starts and stops smoothly and never
       overshoots. Out (a wider view) at FRAMING_OUT, back in at FRAMING_IN:
       boarding a car settles in about three seconds (the zoom never faster
       than ~30 % a second: a quick zoom is a looming flow), stepping out in
       about four; a garage's show and a carjack at FRAMING_QUICK. */
    const FRAMING_OUT = 1.5,
      FRAMING_IN = 0.9,
      FRAMING_QUICK = 5;
    function updateCameraFraming(deltaSeconds) {
      const aim = cameraFramingTarget(),
        quick = repairJob || player.carjack,
        // A smaller factor is a wider view.
        rate = (from, to) => (quick ? FRAMING_QUICK : to < from ? FRAMING_OUT : FRAMING_IN);
      framingStage += (aim - framingStage) * (1 - Math.exp(-deltaSeconds * rate(framingStage, aim)));
      speedZoom += (framingStage - speedZoom) * (1 - Math.exp(-deltaSeconds * rate(speedZoom, framingStage)));
      if (!(speedZoom > 0)) speedZoom = framingStage = 1;
    }
    /* SPEED PULL-BACK. At real speeds a car covers the street view in a few
       seconds, so the view widens with speed: the factor on the vehicle's
       framing at rest is 1 / (1 + DRIVE_PULL * g), g the km/h over
       DRIVE_PULL_FROM with a soft start over the first DRIVE_PULL_SOFT: about
       0.96 at 50 km/h, 0.86 at 100, 0.78 at 150 and 0.71 at 200 (no wider than
       DRIVE_PULL_LIMIT). By default (1.12 at rest) that is 1.08, 0.97, 0.87 and
       0.79: the old curve's top-speed width (0.80) reached from a wider start, so
       the zoom swings through a smaller range (x1.4, not x1.75) as the speed
       changes; a zoom in motion is a looming flow, a strong cue for motion
       sickness. It reads the eased speed (camera-drive.js drivingCameraSpeed), so
       a bump, a crash or wheelspin never pumps it; boats too, aircraft have their
       own flight view. With Motion comfort on (motionComfortOn, settings.js) the
       framing never follows the speed: it holds MOTION_COMFORT_FRAMING (the
       default curve's 100 km/h). A player who zoomed out keeps the proportional
       pull-back. `context` is the vehicle's share of the player's zoom
       (cameraContextZoom); returns a factor on top of it. */
    const DRIVE_PULL = 0.0025,
      DRIVE_PULL_FROM = 20,
      DRIVE_PULL_SOFT = 30,
      DRIVE_PULL_LIMIT = 0.5,
      MOTION_COMFORT_FRAMING = 0.86;
    function speedZoomTarget(context = 1) {
      const c = player.car;
      if (!c || isAircraft(c)) return 1;
      if (motionComfortOn()) return MOTION_COMFORT_FRAMING;
      const over = Math.max(0, drivingCameraSpeed() / KMH - DRIVE_PULL_FROM),
        g = over < DRIVE_PULL_SOFT ? (over * over) / (2 * DRIVE_PULL_SOFT) : over - DRIVE_PULL_SOFT / 2;
      return Math.max(DRIVE_PULL_LIMIT, 1 / (1 + DRIVE_PULL * g));
    }
    /* DeadEndCity.cameraView(): the street camera's framing as it stands. `zoom` is
       the zoom in force (player's zoom × framing), `target` the player's own,
       `context` the share for what the player is in, `speed` the speed pull-back
       on top (`kmh` the eased speed it reads), `framing` the eased product and
       `aim` the zoom it eases to (the simulation advances the easing, console
       simulate() included; `zoom` follows it on drawn frames); `viewMetres` the
       screen's height in metres of street and `personPx` how tall a 1.75 m
       person stands on screen (the street camera looks down at STREET_PITCH,
       flight-view3d.js). */
    function cameraViewReport() {
      const context = cameraContextZoom(),
        frameH = clamp(viewportHeight * 0.68, 430, 630),
        viewH = frameH / Math.max(1e-3, worldZoom),
        standing = PERSON_HEIGHT * Math.cos(Math.atan2(680, 560));
      return {
        zoom: +worldZoom.toFixed(3),
        target: +worldZoomTarget.toFixed(3),
        context: +context.toFixed(3),
        speed: +speedZoomTarget(context).toFixed(3),
        kmh: Math.round(drivingCameraSpeed() / KMH),
        framing: +speedZoom.toFixed(3),
        // The zoom the framing holds now (the player's zoom times `framing`).
        framed: +(worldZoomTarget * speedZoom).toFixed(3),
        aim: +(worldZoomTarget * cameraFramingTarget()).toFixed(3),
        defaultZoom: STREET_ZOOM,
        limits: [STREET_ZOOM_MIN, STREET_ZOOM_MAX],
        viewport: [viewportWidth, viewportHeight],
        viewMetres: +worldMeters(viewH).toFixed(1),
        personPx: Math.round((standing * viewportHeight) / viewH),
        // Settings: Motion comfort (settings.js) and Vehicle camera distance (driving.js, %).
        motionComfort: motionComfortOn(),
        vehicleDistance: drivingSettings.cameraDistance,
        // How the view has moved over the last few seconds (camera-comfort.js).
        comfort: cameraComfortReport(),
      };
    }
    function newCallNotice() {
      if (storyCallWaiting()) incomingCallRemaining = 8;
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || gameMode !== 'play' || worldSafariGesture) return;
      e.preventDefault();
      worldTouchUntil = performance.now() + 700;
      canvas.setPointerCapture?.(e.pointerId);
      worldPointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
      });
      if (worldPointers.size === 2) {
        const [a, b] = [...worldPointers.values()];
        worldPinch = {
          distance: distanceBetween(a, b),
          zoom: worldZoomTarget,
        };
        mouse.down = false;
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!worldPointers.has(e.pointerId)) return;
      e.preventDefault();
      // CHASE TOUCH: one finger dragged over the game turns the chase camera (chase-camera.js).
      const was = worldPointers.get(e.pointerId);
      if (worldPointers.size === 1 && chaseCameraLive() && was)
        chaseTurn((e.clientX - was.x) * CHASE_LOOK_RATE * 1.6 * lookSensitivity(), (e.clientY - was.y) * CHASE_LOOK_RATE * 1.6 * lookSensitivity() * (settings.invertLook ? -1 : 1));
      worldPointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
      });
      if (worldPointers.size === 2 && worldPinch) {
        const [a, b] = [...worldPointers.values()];
        setWorldZoom((worldPinch.zoom * distanceBetween(a, b)) / Math.max(1, worldPinch.distance));
      }
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      canvas.addEventListener(event, (e) => {
        if (!worldPointers.has(e.pointerId)) return;
        worldPointers.delete(e.pointerId);
        worldPinch = null;
        if (worldPointers.size === 2) {
          const [a, b] = [...worldPointers.values()];
          worldPinch = {
            distance: distanceBetween(a, b),
            zoom: worldZoomTarget,
          };
        }
        worldTouchUntil = performance.now() + 700;
      });
    canvas.addEventListener(
      'wheel',
      (e) => {
        if (gameMode !== 'play' || worldSafariGesture) return;
        e.preventDefault();
        const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewportHeight : 1);
        // In the chase view the wheel moves the camera along its boom (chase-camera.js).
        if (chaseCameraLive()) chaseZoom(Math.exp(-clamp(delta, -160, 160) * 0.004));
        else setWorldZoom(worldZoomTarget * Math.exp(-clamp(delta, -160, 160) * 0.008));
      },
      {
        passive: false,
      },
    );
    canvas.addEventListener(
      'gesturestart',
      (e) => {
        if (gameMode !== 'play') return;
        e.preventDefault();
        if (worldPointers.size >= 2) return;
        worldSafariGesture = {
          zoom: worldZoomTarget,
        };
        mouse.down = false;
      },
      {
        passive: false,
      },
    );
    canvas.addEventListener(
      'gesturechange',
      (e) => {
        if (!worldSafariGesture || gameMode !== 'play') return;
        e.preventDefault();
        setWorldZoom(worldSafariGesture.zoom * (e.scale || 1));
      },
      {
        passive: false,
      },
    );
    canvas.addEventListener(
      'gestureend',
      (e) => {
        if (worldSafariGesture) e.preventDefault();
        worldSafariGesture = null;
      },
      {
        passive: false,
      },
    );
    window.addEventListener('blur', resetWorldGesture);
    window.addEventListener('resize', resetWorldGesture);
    // END SUBSYSTEM: src/world-view.js
