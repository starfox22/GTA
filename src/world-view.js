    // BEGIN SUBSYSTEM: src/world-view.js — World camera gestures
    /**
     * World camera gestures
     * Source: src/world-view.js
     * Scope: shared game closure.
     * World zoom, pinch gestures, mouse wheel and camera limits.
     */
    /* World gestures are independent from navigation-map gestures and touch sticks. */
    let worldZoom = 1,
      worldZoomTarget = 1,
      worldTouchUntil = 0,
      worldPinch = null,
      worldSafariGesture = null,
      incomingCallRemaining = 0;
    const worldPointers = new Map();
    function setWorldZoom(value) {
      worldZoomTarget = clamp(value, 0.14, 1.5);
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
      worldZoom += (worldZoomTarget - worldZoom) * (1 - Math.exp(-deltaSeconds * 12));
      canvasScale = clamp(Math.min(viewportWidth / 1250, viewportHeight / 850), 0.72, 1.35) * worldZoom;
      incomingCallRemaining = Math.max(0, incomingCallRemaining - deltaSeconds);
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
