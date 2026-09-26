    /**
     * PROFILER
     * Rolling averages of simulation and render CPU time per frame, plus the
     * renderer's draw-call and triangle counts. Read through DeadEndCity.stats().
     */
    const profile = { frames: 0, update: 0, draw: 0, frameGap: 0, last: 0, parts: {} };
    function timed(name, fn) {
      const t0 = performance.now();
      fn();
      profile.parts[name] = (profile.parts[name] || 0) + performance.now() - t0;
    }
    // Split timing for long straight-line passes (the renderer's frame): adds the
    // time since `t0` to `name` and returns the new mark, so no closure is made.
    function profileLap(name, t0) {
      const now = performance.now();
      profile.parts[name] = (profile.parts[name] || 0) + now - t0;
      return now;
    }
    /**
     * FPS COUNTER
     * Optional readout switched from Settings · Graphics and remembered in
     * localStorage beside the touch-controls setting. It averages over half a
     * second so the number is readable, and shows the average frame time too.
     */
    const fpsMeter = { shown: false, frames: 0, since: 0 };
    try {
      fpsMeter.shown = localStorage.getItem('dead-end-city-fps') === 'on';
    } catch {}
    function applyFpsSetting() {
      getElement('fpsCounter').classList.toggle('hidden', !fpsMeter.shown);
    }
    function toggleFpsCounter() {
      fpsMeter.shown = !fpsMeter.shown;
      fpsMeter.frames = 0;
      fpsMeter.since = performance.now();
      getElement('fpsCounter').textContent = '-- FPS';
      try {
        localStorage.setItem('dead-end-city-fps', fpsMeter.shown ? 'on' : 'off');
      } catch {}
      applyFpsSetting();
    }
    function updateFpsCounter(t) {
      if (!fpsMeter.shown) return;
      fpsMeter.frames++;
      const elapsed = t - fpsMeter.since;
      if (elapsed < 500) return;
      const fps = (fpsMeter.frames * 1000) / elapsed,
        el = getElement('fpsCounter');
      el.textContent = Math.round(fps) + ' FPS · ' + (elapsed / fpsMeter.frames).toFixed(1) + ' ms';
      el.classList.toggle('slow', fps < 30);
      fpsMeter.frames = 0;
      fpsMeter.since = t;
    }
    applyFpsSetting();
    /**
     * FRAME LIMITER
     * Settings · Graphics caps the frame rate at 30, 60 or 120 FPS, or leaves it
     * UNLIMITED (the display's refresh rate; the default). Remembered in
     * localStorage under 'dead-end-city-frame-limit'. requestAnimationFrame still
     * fires every display refresh; a frame is only simulated and drawn once the
     * cap's interval has come round. The next due time advances by exactly one
     * interval per drawn frame (so the average is the cap), a frame arriving a
     * little early (vsync jitter, up to a fifth of the interval) still counts,
     * so 60 on a 60 Hz display stays 60 rather than falling to 30, and after a
     * stall the schedule restarts from now instead of racing to catch up. Skipped
     * refreshes do nothing at all: the next drawn frame's time step covers them.
     */
    const FRAME_LIMITS = [30, 60, 120, 0],
      frameLimiter = { limit: 0, next: 0 };
    try {
      const saved = localStorage.getItem('dead-end-city-frame-limit');
      if (saved === 'unlimited') frameLimiter.limit = 0;
      else if (FRAME_LIMITS.includes(Number(saved))) frameLimiter.limit = Number(saved);
    } catch {}
    // 30, 60, 120, or 0 for unlimited.
    function frameLimit() {
      return frameLimiter.limit;
    }
    function setFrameLimit(value) {
      const limit = value === 'unlimited' ? 0 : Number(value);
      if (!FRAME_LIMITS.includes(limit)) return frameLimiter.limit;
      frameLimiter.limit = limit;
      frameLimiter.next = 0;
      try {
        localStorage.setItem('dead-end-city-frame-limit', limit ? String(limit) : 'unlimited');
      } catch {}
      return limit;
    }
    // Whether the frame at time t is to be drawn (and, if so, books the next one).
    function frameDue(t) {
      const limit = frameLimiter.limit;
      if (!limit) return true;
      const interval = 1000 / limit;
      if (!frameLimiter.next || t - frameLimiter.next > interval * 3) frameLimiter.next = t;
      if (t < frameLimiter.next - interval * 0.2) return false;
      frameLimiter.next += interval;
      if (frameLimiter.next < t) frameLimiter.next = t;
      return true;
    }
    function frame(t) {
      if (!frameDue(t)) {
        requestAnimationFrame(frame);
        return;
      }
      syncTouchInput();
      updateFpsCounter(t);
      // At a 30 FPS cap a frame is 33.3 ms: the step limit allows it, so the
      // simulation keeps real time rather than running 1% slow.
      const deltaSeconds = Math.min(frameLimiter.limit === 30 ? 0.04 : 0.033, Math.max(0, (t - lastTime) / 1000));
      // Headline cards run on the wall clock: a phone call or pause that opens
      // right after one must not leave it frozen across the middle of the screen.
      // Up to a second a frame: a slow renderer (a 1 FPS software GL) must not
      // stretch the 1.8 s SOUTH COAST · 1997 welcome card over the first minute
      // of play (at 0.25 s a frame it did), yet one long hitch (a save, a
      // console simulate()) must not swallow a MISSION COMPLETE card unseen.
      if (announceTime > 0) {
        announceTime -= lastTime ? Math.min(1, Math.max(0, (t - lastTime) / 1000)) : 0;
        if (announceTime <= 0) getElement('announcement').classList.remove('show');
      }
      if (profile.last) profile.frameGap += t - profile.last;
      profile.last = t;
      // The police banner is a notice, like the headline cards: it times out on
      // the wall clock (capped per frame) rather than the simulation's 33 ms step,
      // so a slow frame rate cannot leave "POLICE CLEARED!" up for minutes.
      updatePoliceNotice(Math.min(0.25, Math.max(0, (t - lastTime) / 1000)));
      lastTime = t;
      updateWorldView(deltaSeconds);
      updateCasino(deltaSeconds);
      updateElevator(deltaSeconds);
      const updateStart = performance.now();
      // The city keeps living behind the title menu, and behind settings opened
      // from it. WASTED and BUSTED play out in slow motion.
      // A test holding the simulation (console `holdSimulation`) still draws.
      if (simulationHeld) soundUpdate(0);
      else if (
        gameMode === 'play' ||
        gameMode === 'menu' ||
        (gameMode === 'settings' && settingsOrigin === 'menu')
      )
        update(deltaSeconds);
      else if (gameMode === 'dead') update(deltaSeconds * 0.35);
      else {
        soundUpdate(deltaSeconds);
        updateAmbience(deltaSeconds);
      }
      syncPanelCover();
      const drawStart = performance.now();
      drawWorld();
      updateTankReticle();
      const frameEnd = performance.now();
      profile.update += drawStart - updateStart;
      profile.draw += frameEnd - drawStart;
      profile.frames++;
      // AUTO graphics: dynamic resolution and tier from the frame rate (quality.js).
      if (gameMode === 'play') adaptGraphics(t - (profile.previousFrame || t), frameEnd - updateStart, frameEnd);
      profile.previousFrame = t;
      requestAnimationFrame(frame);
    }
