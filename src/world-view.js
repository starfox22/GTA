    // BEGIN SUBSYSTEM: src/world-view.js — World camera gestures
    /**
     * World camera gestures
     * Source: src/world-view.js
     * Scope: shared game closure.
     * World zoom, pinch gestures, mouse wheel and camera limits.
     */
    /* World gestures are independent from navigation-map gestures and touch sticks. */
    /* The street view's default zoom. At true scale a car is 4.8 m and a person
       1.75 m (game.js WORLD SCALE). The ground is drawn at the screen's
       resolution (ground-shader3d.js), so the camera starts closer than it used
       to (1.2): people read bigger, over about 43 m of street top to bottom on
       a 16:10 screen. The wheel reaches from the whole district (0.14) to 3.0,
       close enough to see a face. */
    const STREET_ZOOM = 1.6,
      STREET_ZOOM_MIN = 0.14,
      STREET_ZOOM_MAX = 3.0,
      // How far out the street camera eases at full speed (below).
      DRIVE_ZOOM_FAR = 0.82;
    let worldZoom = STREET_ZOOM,
      worldZoomTarget = STREET_ZOOM,
      // Pulled back while driving fast (speedZoomTarget), on top of the player's zoom.
      speedZoom = 1,
      worldTouchUntil = 0,
      worldPinch = null,
      worldSafariGesture = null,
      incomingCallRemaining = 0;
    const worldPointers = new Map();
    function setWorldZoom(value) {
      worldZoomTarget = clamp(value, STREET_ZOOM_MIN, STREET_ZOOM_MAX);
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
      // A garage's drive-in show eases in closer, and quicker (garages.js).
      const garageFrame = garageCameraFrame();
      // So does a drawbridge opening close by, the other way: back a little (drawbridge.js).
      speedZoom += ((garageFrame ? garageFrame.zoom : speedZoomTarget() * drawbridgeCameraZoom()) - speedZoom) * (1 - Math.exp(-deltaSeconds * (repairJob ? 2.5 : 0.8)));
      worldZoom += (worldZoomTarget * speedZoom - worldZoom) * (1 - Math.exp(-deltaSeconds * 12));
      canvasScale = clamp(Math.min(viewportWidth / 1250, viewportHeight / 850), 0.72, 1.35) * worldZoom;
      incomingCallRemaining = Math.max(0, incomingCallRemaining - deltaSeconds);
    }
    /* At real speeds a car covers the street view in a few seconds: from about
       60 km/h the camera eases back (boats too; aircraft have their own flight
       view). By 220 km/h it is out to 0.68 of the player's zoom or to
       DRIVE_ZOOM_FAR, whichever is wider, so the closer default zoom gives the
       same view of the road ahead at speed as the old one did (0.82 either
       way); a player who has zoomed out keeps the old proportional pull-back.
       Returns a factor on the player's zoom. */
    function speedZoomTarget() {
      const c = player.car;
      if (!c || isAircraft(c)) return 1;
      const v = Math.hypot(c.vx || 0, c.vy || 0),
        s = clamp((v - 60 * KMH) / (160 * KMH), 0, 1),
        zoom = Math.max(worldZoomTarget, 1e-3),
        proportional = 1 / (1 + s * 0.47),
        toFar = (zoom + (Math.min(zoom, DRIVE_ZOOM_FAR) - zoom) * s) / zoom;
      return Math.min(proportional, toFar);
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
