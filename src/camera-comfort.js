    // Camera comfort: what the street camera's motion does to the eye, sampled as it runs (cameraView().comfort):
    // the view's acceleration and jerk in screen heights, the zoom's rate, the jolts and the player's drift on screen.
    /**
     * CAMERA COMFORT
     * Every camera update (updateCameraFollow) records where the view stands in the
     * view plane's units (x across; y down the screen: the map's y times sin(pitch)
     * less the camera's height times cos(pitch), so a bob over rough ground counts),
     * the jolt on top (cameraKick and the tremor), the framing in force (the player's
     * zoom times `speedZoom`) and where the player stands on screen, for the last
     * COMFORT_WINDOW seconds. cameraComfortReport() resamples that at 30 Hz, smooths it
     * over about a tenth of a second (what the eye integrates) and returns, in screen
     * heights (the frame's height at that moment's zoom): `accel` and `jerk` (rms and
     * peak) of the view's path, `zoomRate` (% a second, rms and peak), `jolt` (the
     * largest kick-and-tremor offset) and `drift` (how far from the middle of the
     * screen the player stood, peak, and how far that wandered, swing). Sickness comes
     * from the whole frame accelerating, mostly at 0.1-1 Hz (a view that sways or
     * pumps), so these are the numbers tools/tests/camera-comfort.mjs holds down.
     */
    const COMFORT_WINDOW = 4,
      COMFORT_CAP = 512,
      COMFORT_STEP = 1 / 30,
      COMFORT_SIN = 680 / Math.hypot(680, 560),
      COMFORT_COS = 560 / Math.hypot(680, 560),
      comfortLog = { n: 0, head: 0 };
    for (const key of ['t', 'x', 'y', 'lz', 'view', 'jx', 'jy', 'px', 'py']) comfortLog[key] = new Float64Array(COMFORT_CAP);
    // One sample, after the camera has moved (camera-feel.js updateCameraFollow).
    function recordCameraComfort(deltaSeconds) {
      if (!(deltaSeconds > 0)) return;
      const L = comfortLog,
        i = L.head,
        zoom = Math.max(1e-3, worldZoomTarget * speedZoom),
        viewH = clamp(viewportHeight * 0.68, 430, 630) / zoom,
        h = streetCameraAltitude(),
        tremor = cameraShakeOffset(gameTime, cameraShakeLevel()),
        body = player.car || player;
      L.t[i] = gameTime;
      L.x[i] = cameraTarget.x;
      L.y[i] = cameraTarget.y * COMFORT_SIN - h * COMFORT_COS;
      L.lz[i] = Math.log(zoom);
      L.view[i] = viewH;
      L.jx[i] = cameraKick.x + tremor.x;
      L.jy[i] = (cameraKick.y + tremor.y) * COMFORT_SIN;
      L.px[i] = body.x - cameraTarget.x;
      L.py[i] = (body.y - cameraTarget.y) * COMFORT_SIN - (entityElevation(body) - h) * COMFORT_COS;
      L.head = (i + 1) % COMFORT_CAP;
      L.n = Math.min(COMFORT_CAP, L.n + 1);
    }
    function resetCameraComfort() {
      comfortLog.n = comfortLog.head = 0;
    }
    /* The report over the last `seconds` (at most COMFORT_WINDOW): see CAMERA COMFORT. */
    function cameraComfortReport(seconds = COMFORT_WINDOW) {
      const L = comfortLog,
        span = clamp(+seconds || COMFORT_WINDOW, 0.5, COMFORT_WINDOW),
        order = [];
      for (let k = L.n - 1; k >= 0; k--) {
        const i = (L.head - 1 - k + COMFORT_CAP * 2) % COMFORT_CAP;
        if (L.t[i] >= gameTime - span - 1e-6 && (!order.length || L.t[i] > L.t[order[order.length - 1]])) order.push(i);
      }
      if (order.length < 8 || L.t[order[order.length - 1]] - L.t[order[0]] < 0.4) return null;
      // Resample at 30 Hz (the live loop runs at any frame rate), then smooth [1 2 1] / 4.
      const t0 = L.t[order[0]],
        count = Math.floor((L.t[order[order.length - 1]] - t0) / COMFORT_STEP) + 1,
        keys = ['x', 'y', 'lz', 'view', 'jx', 'jy', 'px', 'py'],
        grid = {};
      for (const key of keys) grid[key] = new Float64Array(count);
      for (let g = 0, k = 0; g < count; g++) {
        const t = t0 + g * COMFORT_STEP;
        while (k < order.length - 2 && L.t[order[k + 1]] < t) k++;
        const a = order[k],
          b = order[Math.min(k + 1, order.length - 1)],
          u = L.t[b] > L.t[a] ? clamp((t - L.t[a]) / (L.t[b] - L.t[a]), 0, 1) : 0;
        for (const key of keys) grid[key][g] = L[key][a] + (L[key][b] - L[key][a]) * u;
      }
      for (const key of ['x', 'y', 'lz']) {
        const src = grid[key].slice();
        for (let g = 1; g < count - 1; g++) grid[key][g] = (src[g - 1] + 2 * src[g] + src[g + 1]) / 4;
      }
      const h = COMFORT_STEP,
        ax = new Float64Array(count),
        ay = new Float64Array(count);
      let aSum = 0,
        aPeak = 0,
        aN = 0,
        jSum = 0,
        jPeak = 0,
        jN = 0,
        zSum = 0,
        zPeak = 0,
        zN = 0,
        jolt = 0,
        drift = 0,
        minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (let g = 2; g < count - 2; g++) {
        const view = grid.view[g];
        ax[g] = (grid.x[g + 1] - 2 * grid.x[g] + grid.x[g - 1]) / (h * h) / view;
        ay[g] = (grid.y[g + 1] - 2 * grid.y[g] + grid.y[g - 1]) / (h * h) / view;
        const a = Math.hypot(ax[g], ay[g]);
        aSum += a * a;
        aPeak = Math.max(aPeak, a);
        aN++;
        const z = ((grid.lz[g + 1] - grid.lz[g - 1]) / (2 * h)) * 100;
        zSum += z * z;
        zPeak = Math.max(zPeak, Math.abs(z));
        zN++;
        jolt = Math.max(jolt, Math.hypot(grid.jx[g], grid.jy[g]) / view);
        const px = grid.px[g] / view,
          py = grid.py[g] / view;
        drift = Math.max(drift, Math.hypot(px, py));
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
      for (let g = 3; g < count - 3; g++) {
        const j = Math.hypot(ax[g + 1] - ax[g - 1], ay[g + 1] - ay[g - 1]) / (2 * h);
        jSum += j * j;
        jPeak = Math.max(jPeak, j);
        jN++;
      }
      const r = (v, d = 3) => +v.toFixed(d);
      return {
        seconds: r(L.t[order[order.length - 1]] - t0, 2),
        accel: { rms: r(Math.sqrt(aSum / Math.max(1, aN))), peak: r(aPeak) },
        jerk: { rms: r(Math.sqrt(jSum / Math.max(1, jN)), 2), peak: r(jPeak, 2) },
        zoomRate: { rms: r(Math.sqrt(zSum / Math.max(1, zN)), 2), peak: r(zPeak, 2) },
        jolt: r(jolt, 4),
        drift: { peak: r(drift), swing: r(Math.hypot(maxX - minX, maxY - minY)) },
      };
    }
