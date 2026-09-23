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
    function applyGraphicsSetting() {
      if (city3D && city3D.setQuality) city3D.setQuality(graphicsTier());
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
