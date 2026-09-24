    // BEGIN SUBSYSTEM: src/quality.js — Graphics quality tiers
    /**
     * Graphics quality tiers
     * Source: src/quality.js
     * Scope: shared game closure (read by the renderer, switched from Settings · Graphics).
     *
     * Four tiers trade frame time for image quality. Each is a plain record the
     * renderer reads when it is built and again whenever the setting changes:
     *
     *   pixelRatio   cap on device pixels per CSS pixel for the 3D canvas
     *   shadowMap    sun shadow map size (texels per side)
     *   shadowEvery  frames between shadow-map refreshes (1 = every frame)
     *   msaa         multisample count of the HDR scene target (0 = FXAA instead)
     *   ao           screen-space ambient occlusion samples (0 = off)
     *   bloom        bloom mip levels (0 = off)
     *   grade        time-of-day colour grading, vignette and film grain
     *   lodBias      multiplies the zoom thresholds where far scenery, small props
     *                and traffic impostors take over (above 1 = they take over sooner)
     *   rain         rain streak count (read once, when the renderer is built)
     *
     * The setting is 'auto' or a tier name and is remembered in localStorage next
     * to the other settings. 'auto' picks a tier from the GPU the browser reports
     * (see detectGraphicsTier); phones and tablets start at LOW or MEDIUM.
     */
    const GRAPHICS_TIERS = {
      low: { name: 'LOW', pixelRatio: 1, shadowMap: 1024, shadowEvery: 4, msaa: 0, ao: 0, bloom: 0, grade: false, lodBias: 1.35, rain: 900 },
      medium: { name: 'MEDIUM', pixelRatio: 1.25, shadowMap: 2048, shadowEvery: 3, msaa: 0, ao: 0, bloom: 4, grade: true, lodBias: 1.1, rain: 1600 },
      high: { name: 'HIGH', pixelRatio: 1.5, shadowMap: 3072, shadowEvery: 2, msaa: 4, ao: 8, bloom: 5, grade: true, lodBias: 1, rain: 2600 },
      ultra: { name: 'ULTRA', pixelRatio: 2, shadowMap: 4096, shadowEvery: 1, msaa: 4, ao: 14, bloom: 6, grade: true, lodBias: 0.85, rain: 3200 },
    };
    const GRAPHICS_ORDER = ['auto', 'low', 'medium', 'high', 'ultra'];
    let graphicsSetting = 'auto',
      // Tier chosen by detectGraphicsTier() once the renderer has a GL context.
      graphicsDetected = null,
      graphicsGpuName = '';
    try {
      const saved = localStorage.getItem('dead-end-city-graphics');
      if (GRAPHICS_ORDER.includes(saved)) graphicsSetting = saved;
    } catch {}
    function graphicsTierId() {
      if (graphicsSetting !== 'auto') return graphicsSetting;
      return graphicsDetected || (touchEnabled() ? 'low' : 'medium');
    }
    function graphicsTier() {
      return GRAPHICS_TIERS[graphicsTierId()];
    }
    /**
     * GPU CAPABILITY CHECK
     * A quick look at what the browser says about the GPU: the unmasked renderer
     * string where the browser exposes it, WebGL 2, the texture size limit and
     * whether half-float render targets work (the HDR pipeline needs them).
     * Software rasterisers get LOW; phones and tablets LOW or MEDIUM; integrated
     * laptop graphics MEDIUM (recent Intel Iris Xe / Arc and Apple silicon HIGH);
     * discrete desktop GPUs HIGH. ULTRA is never picked automatically.
     */
    function detectGraphicsTier(gl) {
      let renderer = '';
      try {
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
      } catch {}
      graphicsGpuName = renderer;
      const name = renderer.toLowerCase(),
        webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
        halfFloat = webgl2 && !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')),
        maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048,
        mobile = touchEnabled() || /android|iphone|ipad|mobile/i.test(navigator.userAgent || '');
      if (!webgl2 || !halfFloat || /swiftshader|llvmpipe|software|basic render/.test(name)) return 'low';
      if (mobile) {
        // Recent flagship phone GPUs manage the bloom pass comfortably.
        if (/apple gpu|adreno \(tm\) (7[3-9]\d|8\d\d)|mali-g(7[1-9]|[89]\d|7\d\d)|immortalis/.test(name)) return 'medium';
        return 'low';
      }
      if (/nvidia|geforce|quadro|rtx|radeon rx|radeon pro|amd radeon(?! graphics)|arc\b|apple m\d/.test(name)) return 'high';
      if (/iris\s*xe|apple gpu/.test(name)) return 'high';
      if (/intel|uhd|hd graphics|radeon graphics|vega \d|mali|adreno/.test(name)) return 'medium';
      return maxTexture >= 16384 ? 'high' : 'medium';
    }
    /**
     * LOW RESOLUTION CAP
     * LOW is meant to be smooth on integrated graphics, whose cost is mostly the
     * pixels shaded. On a large canvas (a 1440p or 4K monitor) LOW draws the scene
     * at no more than about a 1080p frame's worth of pixels and the composite
     * pass upsamples it; the HUD stays sharp. Other tiers draw at full size
     * (AUTO's adaptive scale still applies on top of this).
     */
    const LOW_TIER_PIXELS = 1920 * 1080;
    function tierBaseScale() {
      const tier = graphicsTier();
      if (tier.name !== 'LOW') return 1;
      const ratio = Math.min(devicePixelRatio || 1, tier.pixelRatio),
        pixels = viewportWidth * ratio * viewportHeight * ratio;
      return pixels > LOW_TIER_PIXELS ? clamp(Math.sqrt(LOW_TIER_PIXELS / pixels), 0.5, 1) : 1;
    }
    // Called on a tier change and when the window is resized (game.js resize()).
    function applyTierResolution() {
      if (!city3D || !city3D.setRenderScale) return;
      // A chosen tier gets exactly its base scale; AUTO keeps any lower adaptive scale.
      const base = tierBaseScale();
      adaptive.scale = city3D.setRenderScale(graphicsSetting === 'auto' ? Math.min(adaptive.scale, base) : base);
    }
    function applyGraphicsSetting() {
      adaptive.scale = 1;
      adaptive.slowFor = adaptive.fastFor = adaptive.cpuFor = 0;
      adaptive.average = 0;
      adaptive.tierDrops = 0;
      if (city3D && city3D.setRenderScale) city3D.setRenderScale(1);
      if (city3D && city3D.setQuality) city3D.setQuality(graphicsTier());
      applyTierResolution();
    }
    /**
     * ADAPTIVE QUALITY (AUTO only)
     * The GPU name only says roughly what a machine can do; the frame rate says
     * what it is doing. With the setting on AUTO, every frame feeds the time
     * since the last one and the CPU milliseconds the game spent on it:
     *
     *  - GPU-bound and slow (frames averaging 15% over the budget, i.e. under
     *    ~52 FPS, or under ~26 FPS with the frame limiter at 30, while the CPU
     *    work is well inside the frame): the scene is drawn at a lower resolution,
     *    in 10% steps down to MIN_SCALE, and upsampled by the composite pass
     *    (postfx3d.js), so the HUD stays sharp.
     *  - Still slow at the lowest scale, or CPU-bound (the simulation and draw
     *    submission fill the frame): one tier down (fewer shadow refreshes, an
     *    earlier LOD, no AO), at most twice per session.
     *  - Comfortably fast for a while: the resolution creeps back up in 5% steps,
     *    never sooner than 15 s after a drop, so it does not oscillate.
     *
     * A chosen tier (LOW..ULTRA) is never touched: tests and players who pick one
     * get exactly that. Hidden tabs and long stalls (a tab switch, a GC pause, a
     * loading hitch) are ignored.
     */
    const ADAPTIVE_MIN_SCALE = 0.6,
      adaptive = { scale: 1, average: 0, slowFor: 0, fastFor: 0, cpuFor: 0, lastDrop: -1e9, tierDrops: 0 };
    function adaptGraphics(frameMs, cpuMs, now) {
      if (graphicsSetting !== 'auto' || !city3D || !city3D.setRenderScale || document.hidden) return;
      if (!(frameMs > 0) || frameMs > 250) return;
      adaptive.average = adaptive.average ? adaptive.average * 0.92 + frameMs * 0.08 : frameMs;
      // The frame budget: 60 FPS, or the frame limiter's cap below that (a 30 FPS
      // cap's 33 ms frames are on time, not slow). A cap above 60 does not make
      // AUTO trade image quality for more than 60 FPS.
      const budget = 1000 / Math.min(60, frameLimit() || 60),
        seconds = frameMs / 1000,
        slow = adaptive.average > budget * 1.15,
        cpuBound = cpuMs > adaptive.average * 0.75;
      adaptive.slowFor = slow && !cpuBound ? adaptive.slowFor + seconds : 0;
      adaptive.cpuFor = slow && cpuBound ? adaptive.cpuFor + seconds : 0;
      adaptive.fastFor = adaptive.average < budget * 1.045 ? adaptive.fastFor + seconds : 0;
      const order = ['low', 'medium', 'high'],
        tierIndex = order.indexOf(graphicsTierId());
      const dropTier = () => {
        if (tierIndex <= 0 || adaptive.tierDrops >= 2) return false;
        adaptive.tierDrops++;
        graphicsDetected = order[tierIndex - 1];
        city3D.setQuality(graphicsTier());
        adaptive.scale = city3D.setRenderScale(Math.min(tierBaseScale(), Math.max(adaptive.scale, 0.8)));
        return true;
      };
      if (adaptive.slowFor > 1.2) {
        adaptive.slowFor = 0;
        adaptive.lastDrop = now;
        if (adaptive.scale > ADAPTIVE_MIN_SCALE + 0.01) adaptive.scale = city3D.setRenderScale(adaptive.scale - 0.1);
        else dropTier();
      } else if (adaptive.cpuFor > 4) {
        adaptive.cpuFor = 0;
        adaptive.lastDrop = now;
        dropTier();
      } else if (adaptive.fastFor > 6 && adaptive.scale < tierBaseScale() && now - adaptive.lastDrop > 15000) {
        adaptive.fastFor = 0;
        adaptive.scale = city3D.setRenderScale(Math.min(tierBaseScale(), adaptive.scale + 0.05));
      }
    }
    // Settings · Graphics (settings.js) passes a tier; with none the setting steps
    // AUTO -> LOW -> MEDIUM -> HIGH -> ULTRA -> AUTO.
    function cycleGraphicsSetting(to) {
      graphicsSetting = GRAPHICS_ORDER.includes(to)
        ? to
        : GRAPHICS_ORDER[(GRAPHICS_ORDER.indexOf(graphicsSetting) + 1) % GRAPHICS_ORDER.length];
      try {
        localStorage.setItem('dead-end-city-graphics', graphicsSetting);
      } catch {}
      applyGraphicsSetting();
    }
    // END SUBSYSTEM: src/quality.js
