    // Objective and player markers: which ones are drawn (the floating arrow; the optional player ring) and a read-only report.
    /* There is no ring or light pool on the ground at an objective any more: the floating
       arrow (render3d-effects.js `arrowGroup`, the diamond in game-draw2d.js `marker()`) is the
       only pointer, the HUD's distance pill and the map stay as they were. The arrow rests
       while the Blue Hour job is only watching its spiked glass work (roofWatchQuiet). The
       ring under the player is Settings · Graphics · Ring under your character (off). */
    function objectiveArrowShown(target = objective()) {
      return !!target && !roofWatchQuiet();
    }
    /* Console `markers()`: what should be on screen, plus the renderer's own state. */
    function markersReport() {
      const target = objective();
      return {
        playerRing: playerRingOn(),
        objectiveArrow: objectiveArrowShown(target),
        objectiveRing: false,
        target: target ? { x: Math.round(target.x), y: Math.round(target.y) } : null,
        // The respray arrow over a garage door (garages.js RESPRAY BEACON: only while the police want the player).
        respray: garageBeacon() ? { x: Math.round(garageBeacon().x), y: Math.round(garageBeacon().y) } : null,
        renderer: city3D?.markerProbe ? city3D.markerProbe() : null,
      };
    }
