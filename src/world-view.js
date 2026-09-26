    // BEGIN SUBSYSTEM: src/world-view.js — World camera gestures
    /**
     * World camera gestures
     * Source: src/world-view.js
     * Scope: shared game closure.
     * World zoom, pinch gestures, mouse wheel and camera limits.
     */
    /* World gestures are independent from navigation-map gestures and touch sticks. */
    /* The street view's default zoom. At true scale a car is 4.8 m and a person
       1.75 m (game.js WORLD SCALE), about 0.8 of what they were drawn at before,
       so the camera starts 1.2x closer than it did: a car and a person read at
       about their old size on screen, over 57 m of street top to bottom. */
    const STREET_ZOOM = 1.2;
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
      worldZoomTarget = clamp(value, 0.14, 1.8);
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
      speedZoom += (speedZoomTarget() - speedZoom) * (1 - Math.exp(-deltaSeconds * 0.8));
      worldZoom += (worldZoomTarget * speedZoom - worldZoom) * (1 - Math.exp(-deltaSeconds * 12));
      canvasScale = clamp(Math.min(viewportWidth / 1250, viewportHeight / 850), 0.72, 1.35) * worldZoom;
      incomingCallRemaining = Math.max(0, incomingCallRemaining - deltaSeconds);
    }
    /* At real speeds a car covers the street view in a few seconds: from about
       60 km/h the camera eases back, to about 0.68 of the player's zoom by 220
       km/h (boats too; aircraft have their own flight view). */
    function speedZoomTarget() {
      const c = player.car;
      if (!c || isAircraft(c)) return 1;
      const v = Math.hypot(c.vx || 0, c.vy || 0);
      return 1 / (1 + clamp((v - 60 * KMH) / (160 * KMH), 0, 1) * 0.47);
    }
    function newCallNotice() {
      if (missionIndex < missions.length) incomingCallRemaining = 8;
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
