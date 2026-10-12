    // Frame guard: an exception in one part of a frame (pre-step, simulation, draw) is logged once per message and
    // counted, and the frame loop keeps running (game-loop.js frame/runFrame); console frameFaults() lists them.
    /**
     * FRAME GUARD
     * requestAnimationFrame used to be booked after runFrame, so one throw anywhere stopped the game for good (a
     * frozen picture, no input). Now each part of a frame runs inside its own catch: a fault skips the rest of that
     * part for that frame only. Each distinct message is written to the console once (console.error, so tests and
     * dev.mjs errors still see it) with where it happened; repeats only count. The list is capped (FRAME_FAULT_KINDS).
     */
    const FRAME_FAULT_KINDS = 24;
    // `drill` ('update' or 'draw'): console frameFaultDrill() throws once there on the next live frame (a test of
    // this guard; it is written with console.warn so a test's console-error check stays clean).
    const frameFaultState = { count: 0, kinds: [], drill: null };
    function frameFaultDrillAt(where) {
      if (frameFaultState.drill !== where) return;
      frameFaultState.drill = null;
      const error = new Error('frame fault drill (' + where + ')');
      error.drill = true;
      throw error;
    }
    function frameFault(error, where) {
      frameFaultState.count++;
      const message = String((error && (error.stack || error.message)) || error).split('\n').slice(0, 3).join(' | ');
      for (let i = 0; i < frameFaultState.kinds.length; i++) {
        const k = frameFaultState.kinds[i];
        if (k.where === where && k.message === message) {
          k.count++;
          k.last = gameTime;
          return;
        }
      }
      // Past the cap new kinds are only counted (and never flood the console).
      if (frameFaultState.kinds.length >= FRAME_FAULT_KINDS) return;
      frameFaultState.kinds.push({ where, message, count: 1, first: gameTime, last: gameTime });
      (error && error.drill ? console.warn : console.error)('Dead End City: ' + where + ' fault (the game keeps running):', error);
    }
    function frameFaultReport() {
      return {
        count: frameFaultState.count,
        gameTime: +gameTime.toFixed(2),
        drill: frameFaultState.drill,
        kinds: frameFaultState.kinds.map((k) => ({ where: k.where, message: k.message, count: k.count, first: +k.first.toFixed(1), last: +k.last.toFixed(1) })),
      };
    }
