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
       a person reads clearly (about 35 px tall on a 1280 x 800 screen, over
       about 27 m of street top to bottom); in a vehicle it frames wider
       (CAMERA CONTEXT below) and eases back further with speed. The wheel
       reaches from the whole district (0.14) to 4.5, close enough to see a
       face. The player's zoom is one number: the context and speed framing
       are factors on it, so a player who zooms out on foot is zoomed out in
       the car too. */
    const STREET_ZOOM = 2.5,
      STREET_ZOOM_MIN = 0.14,
      STREET_ZOOM_MAX = 4.5,
      // How far out the street camera eases at full speed (below).
      DRIVE_ZOOM_FAR = 0.82;
    /* CAMERA CONTEXT: the share of the player's zoom the camera frames at for
       what the player is in, so entering a car pulls the view back over a
       couple of seconds and stepping out brings it in again (both eased with
       the speed framing in updateWorldView). A car at rest frames at 0.7 of
       the on-foot zoom (1.75 by default, about the old all-round 1.6), so the
       road ahead reads as before; long vehicles and boats wider; aircraft
       keep the framing the flight view was tuned at (1.6 by default). */
    const CAMERA_CONTEXT = { car: 0.7, bike: 0.76, bicycle: 0.82, long: 0.6, boat: 0.6, air: 1.6 / STREET_ZOOM, ride: 0.7, parachute: 0.78 };
    function cameraContextZoom() {
      const c = player.car;
      if (c) {
        const spec = vehicleSpec(c);
        if (isAircraft(c)) return CAMERA_CONTEXT.air;
        if (spec.boat || spec.jetski) return CAMERA_CONTEXT.boat;
        if (spec.bicycle) return CAMERA_CONTEXT.bicycle;
        if (spec.bike) return CAMERA_CONTEXT.bike;
        if (spec.truck || spec.tank || spec.l > 7 * UNITS_PER_METRE) return CAMERA_CONTEXT.long;
        return CAMERA_CONTEXT.car;
      }
      if (player.parachute) return CAMERA_CONTEXT.parachute;
      if (transitRide || taxiRide || player.coaster) return CAMERA_CONTEXT.ride;
      return 1;
    }
    let worldZoom = STREET_ZOOM,
      worldZoomTarget = STREET_ZOOM,
      // The context and speed framing (cameraContextZoom × speedZoomTarget), eased,
      // on top of the player's zoom.
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
      speedZoom += (cameraFramingTarget() - speedZoom) * (1 - Math.exp(-deltaSeconds * (repairJob ? 2.5 : 0.8)));
      worldZoom += (worldZoomTarget * speedZoom - worldZoom) * (1 - Math.exp(-deltaSeconds * 12));
      canvasScale = clamp(Math.min(viewportWidth / 1250, viewportHeight / 850), 0.72, 1.35) * worldZoom;
      incomingCallRemaining = Math.max(0, incomingCallRemaining - deltaSeconds);
    }
    /* At real speeds a car covers the street view in a few seconds: from about
       45 km/h the camera eases back (boats too; aircraft have their own flight
       view). By 205 km/h it is out to 0.68 of the vehicle's framing at rest or
       to DRIVE_ZOOM_FAR, whichever is wider, so the default gives the same view
       of the road ahead at speed as it always has (0.82); a player who has
       zoomed out keeps the proportional pull-back. `context` is the vehicle's
       share of the player's zoom (cameraContextZoom); returns a factor on top
       of it. */
    function speedZoomTarget(context = 1) {
      const c = player.car;
      if (!c || isAircraft(c)) return 1;
      const v = Math.hypot(c.vx || 0, c.vy || 0),
        s = clamp((v - 45 * KMH) / (160 * KMH), 0, 1),
        zoom = Math.max(worldZoomTarget * context, 1e-3),
        proportional = 1 / (1 + s * 0.47),
        toFar = (zoom + (Math.min(zoom, DRIVE_ZOOM_FAR) - zoom) * s) / zoom;
      return Math.min(proportional, toFar);
    }
    /* DeadEndCity.cameraView(): the street camera's framing as it stands. `zoom` is
       the zoom in force (player's zoom × framing), `target` the player's own,
       `context` the share for what the player is in, `speed` the speed pull-back
       on top, `framing` the eased product and `aim` the zoom it eases to (drawn
       frames advance the easing; console simulate() does not); `viewMetres` the
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
        framing: +speedZoom.toFixed(3),
        aim: +(worldZoomTarget * cameraFramingTarget()).toFixed(3),
        defaultZoom: STREET_ZOOM,
        limits: [STREET_ZOOM_MIN, STREET_ZOOM_MAX],
        viewport: [viewportWidth, viewportHeight],
        viewMetres: +worldMeters(viewH).toFixed(1),
        personPx: Math.round((standing * viewportHeight) / viewH),
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
        setWorldZoom(worldZoomTarget * Math.exp(-clamp(delta, -160, 160) * 0.008));
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
