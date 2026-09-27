    // Cloud layer (game side): cloudBaseAt/cloudTopAt, the only source of the cloud altitude, by weather and area;
    // the coverage and area maps the renderer draws from, the drift of the field and how deep in cloud a point is.
    /**
     * CLOUD LAYER
     * The layer's altitude follows the weather and the ground beneath it:
     *
     *   weather   the base comes down as it clouds over: about 400 m on a clear day,
     *             370 m fair, 330 m cloudy, 300 m overcast, 270 m in rain and 250 m
     *             in a storm. Fair and cloudy skies are cumulus 250-500 m deep;
     *             an overcast is a flatter stratocumulus deck (~260 m), rain and
     *             storms a deep one (430-550 m) with ragged scud hanging under it.
     *   area      over open sea the base is lower (the marine air is cooler and
     *             moister: 20-35 m, more at dawn), over the city a little higher
     *             (its warmth), and over the Ridgeline much lower as it gets wet:
     *             broken cloud clinging to the peaks in overcast and rain, with
     *             more cover over the summits (air forced up the slopes).
     *
     * cloudBaseAt(x, y) and cloudTopAt(x, y) (world units) are the only source of the
     * cloud altitude: the renderer (clouds3d*.js) draws the same numbers from the same
     * maps (the area map is sampled bilinearly from the same bytes the GPU filters),
     * and anything else that needs the layer (rain box, HUD, sound) asks here.
     * cloudAmountAt(x, y, z) estimates how deep in cloud a point is (0 clear .. 1 in
     * the heart of a cloud) from the coverage map and the layer's profile: the GPU
     * carves the cells finer, so it is a likelihood, right for sound and reports.
     * `cloudLayer.immersion` is that amount at the player while airborne, smoothed:
     * the hook for sound (the parachute's wind can read playerCloudImmersion()).
     */
    const CLOUD_MAP_SIZE = 128,
      CLOUD_MAP_SPAN = 9000, // world units per tile of the coverage map
      CLOUD_AREA_SIZE = 128, // area map texels per side, over the world rectangle
      CLOUD_GROUND_STEP = 5, // world units per step of the area map's ground channel (to 1275)
      cloudMap = new Float32Array(CLOUD_MAP_SIZE * CLOUD_MAP_SIZE);
    // ---- Coverage map: where cloud may form (tiling, drifts with the wind) -----------------
    {
      let seed = 19970611;
      const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      // Tiling value noise, four octaves, quintic interpolation.
      for (const [cells, weight] of [
        [4, 1],
        [8, 0.5],
        [16, 0.26],
        [32, 0.12],
      ]) {
        const lattice = Array.from({ length: cells * cells }, rnd);
        for (let y = 0; y < CLOUD_MAP_SIZE; y++)
          for (let x = 0; x < CLOUD_MAP_SIZE; x++) {
            const fx = (x / CLOUD_MAP_SIZE) * cells,
              fy = (y / CLOUD_MAP_SIZE) * cells,
              ix = Math.floor(fx),
              iy = Math.floor(fy),
              ease = (t) => t * t * t * (t * (t * 6 - 15) + 10),
              u = ease(fx - ix),
              v = ease(fy - iy),
              at = (i, j) => lattice[((j + cells) % cells) * cells + ((i + cells) % cells)],
              top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * u,
              bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * u;
            cloudMap[y * CLOUD_MAP_SIZE + x] += (top + (bottom - top) * v) * weight;
          }
      }
      // Histogram-equalise: rank order becomes value, so a coverage of 0.3 puts cloud
      // over 30% of the map whatever the noise statistics were.
      const order = Array.from(cloudMap.keys()).sort((a, b) => cloudMap[a] - cloudMap[b]);
      order.forEach((index, rank) => (cloudMap[index] = rank / (order.length - 1)));
    }
    // The coverage map quantised as the GPU sees it (8 bits, bilinear).
    const cloudMapBytes = Uint8Array.from(cloudMap, (v) => Math.round(v * 255));
    function cloudMapAt(x, z) {
      const fx = ((((x / CLOUD_MAP_SPAN) % 1) + 1) % 1) * CLOUD_MAP_SIZE - 0.5,
        fz = ((((z / CLOUD_MAP_SPAN) % 1) + 1) % 1) * CLOUD_MAP_SIZE - 0.5,
        ix = Math.floor(fx),
        iz = Math.floor(fz),
        u = fx - ix,
        v = fz - iz,
        n = CLOUD_MAP_SIZE,
        at = (i, j) => cloudMapBytes[(((j % n) + n) % n) * n + (((i % n) + n) % n)] / 255,
        top = at(ix, iz) + (at(ix + 1, iz) - at(ix, iz)) * u,
        bottom = at(ix, iz + 1) + (at(ix + 1, iz + 1) - at(ix, iz + 1)) * u;
      return top + (bottom - top) * v;
    }
    // ---- Area map: sea, Ridgeline and city weights and the ground, over the world ----------
    // RGBA bytes, CLOUD_AREA_SIZE square over WORLD_LEFT/TOP .. WIDTH/HEIGHT:
    // r = open sea, g = mountain (smoothed terrain height), b = city, a = highest ground
    // in the texel / CLOUD_GROUND_STEP (the renderer stops its rays there).
    let cloudAreaBytes = null;
    function cloudAreaMap() {
      if (cloudAreaBytes) return cloudAreaBytes;
      const n = CLOUD_AREA_SIZE,
        cellX = WORLD_WIDTH / n,
        cellY = WORLD_HEIGHT / n,
        land = new Float32Array(n * n),
        height = new Float32Array(n * n),
        ground = new Float32Array(n * n);
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          let dry = 0,
            top = 0,
            sum = 0;
          for (let s = 0; s < 3; s++)
            for (let t = 0; t < 3; t++) {
              const x = WORLD_LEFT + (i + (s + 0.5) / 3) * cellX,
                y = WORLD_TOP + (j + (t + 0.5) / 3) * cellY,
                h = terrainHeight(x, y);
              if (landAt(x, y)) dry++;
              top = Math.max(top, h);
              sum += h;
            }
          land[j * n + i] = dry / 9;
          height[j * n + i] = sum / 9;
          // The corners too: the ray stop must not undercut a ridge between samples.
          for (const [s, t] of [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ])
            top = Math.max(top, terrainHeight(WORLD_LEFT + (i + s) * cellX, WORLD_TOP + (j + t) * cellY));
          ground[j * n + i] = top;
        }
      // Separable box blur, twice (close to a Gaussian), radius in texels.
      const blur = (field, radius) => {
        const out = new Float32Array(n * n),
          tmp = new Float32Array(n * n);
        for (let pass = 0; pass < 2; pass++) {
          const src = pass ? out : field;
          for (let j = 0; j < n; j++)
            for (let i = 0; i < n; i++) {
              let s = 0;
              for (let k = -radius; k <= radius; k++) s += src[j * n + clamp(i + k, 0, n - 1)];
              tmp[j * n + i] = s / (radius * 2 + 1);
            }
          for (let j = 0; j < n; j++)
            for (let i = 0; i < n; i++) {
              let s = 0;
              for (let k = -radius; k <= radius; k++) s += tmp[clamp(j + k, 0, n - 1) * n + i];
              out[j * n + i] = s / (radius * 2 + 1);
            }
        }
        return out;
      };
      // Sea: ~200 m from the shore before the marine layer takes over.
      const dryness = blur(land, 6),
        // Mountains: the terrain smoothed over ~250 m, so the lowered layer is a
        // broad swell over the range, deepest over the high ground, not a mould of it.
        relief = blur(height, 7);
      let reliefTop = 1;
      for (const v of relief) reliefTop = Math.max(reliefTop, v);
      const bytes = new Uint8Array(n * n * 4);
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const k = j * n + i,
            x = WORLD_LEFT + (i + 0.5) * cellX,
            y = WORLD_TOP + (j + 0.5) * cellY,
            // The city: the streets' own rectangle, eased in over ~130 m.
            city = smoothStep(-3900, -2900, x) * smoothStep(4600, 3600, x) * smoothStep(-4700, -3700, y) * smoothStep(6200, 5200, y),
            sea = clamp(1 - dryness[k] * 1.6, 0, 1),
            mountain = Math.pow(clamp(relief[k] / reliefTop, 0, 1), 0.8);
          bytes[k * 4] = Math.round(sea * 255);
          bytes[k * 4 + 1] = Math.round(mountain * 255);
          bytes[k * 4 + 2] = Math.round(city * clamp(dryness[k] * 1.4, 0, 1) * 255);
          bytes[k * 4 + 3] = Math.min(255, Math.ceil(ground[k] / CLOUD_GROUND_STEP));
        }
      cloudAreaBytes = bytes;
      return bytes;
    }
    // Bilinear read of the area map (the GPU's LinearFilter on the same bytes); `out`
    // gets sea, mountain, city (0..1) and ground (world units).
    const cloudAreaScratch = { sea: 0, mountain: 0, city: 0, ground: 0 };
    function cloudAreaAt(x, y, out = cloudAreaScratch) {
      const bytes = cloudAreaMap(),
        n = CLOUD_AREA_SIZE,
        fx = clamp(((x - WORLD_LEFT) / WORLD_WIDTH) * n - 0.5, 0, n - 1),
        fy = clamp(((y - WORLD_TOP) / WORLD_HEIGHT) * n - 0.5, 0, n - 1),
        i = Math.min(n - 2, Math.floor(fx)),
        j = Math.min(n - 2, Math.floor(fy)),
        u = fx - i,
        v = fy - j,
        a = (j * n + i) * 4,
        b = a + 4,
        c = a + n * 4,
        d = c + 4,
        read = (o) =>
          ((bytes[a + o] * (1 - u) + bytes[b + o] * u) * (1 - v) + (bytes[c + o] * (1 - u) + bytes[d + o] * u) * v) / 255;
      out.sea = read(0);
      out.mountain = read(1);
      out.city = read(2);
      out.ground = read(3) * 255 * CLOUD_GROUND_STEP;
      return out;
    }
    // ---- The layer now ---------------------------------------------------------------------
    // All heights in world units. `base`/`top` are the layer over neutral ground; each
    // area weight moves them by its offset (cloudBaseAt adds them up).
    const cloudLayer = {
      coverage: 0.4,
      base: 0,
      top: 0,
      seaBase: 0,
      mountainBase: 0,
      cityBase: 0,
      seaTop: 0,
      mountainTop: 0,
      cityTop: 0,
      // Extra coverage over the mountains (orographic lift).
      mountainCover: 0,
      // Ragged scud under the base in wet weather: how deep (units) and how much.
      scudDepth: 0,
      scud: 0,
      // A closed deck (overcast and up): flatter tops.
      deck: 0,
      // Drift of the whole field (world units, kept small so float precision holds).
      windX: 0,
      windY: 0,
      clock: 0,
      // How deep in cloud the airborne player is (0..1, smoothed).
      immersion: 0,
      set: false,
    };
    function setCloudLayer() {
      const cloud = weather.cloud,
        rain = weather.rain,
        m = UNITS_PER_METRE,
        hour = (worldMinutes % 1440) / 60,
        // Marine layer: the sea air is at its coolest around dawn.
        marine = smoothStep(4, 6, hour) * (1 - smoothStep(8.5, 11, hour)) * (1 - rain),
        wet = clamp(smoothStep(0.5, 1, cloud) + rain * 0.5, 0, 1),
        deck = clamp((cloud - 0.75) / 0.15, 0, 1),
        cumulus = 240 + 260 * clamp(cloud / 0.7, 0, 1),
        deckDepth = 250 + 300 * rain;
      const L = cloudLayer;
      L.coverage = clamp(0.1 + cloud * 0.95, 0, 1);
      L.deck = deck;
      L.base = (410 - 120 * cloud - 40 * rain) * m;
      L.top = L.base + (cumulus + (deckDepth - cumulus) * deck) * m;
      L.seaBase = -(15 + 20 * cloud + 30 * marine) * m;
      L.seaTop = L.seaBase;
      L.cityBase = (4 + 16 * (1 - cloud)) * m;
      L.cityTop = L.cityBase;
      L.mountainBase = -(40 + 140 * wet) * m;
      L.mountainTop = L.mountainBase * 0.5;
      L.mountainCover = 0.08 + 0.3 * wet;
      L.scudDepth = (25 + 40 * wet) * m;
      L.scud = smoothStep(0.25, 0.9, wet);
      L.set = true;
    }
    // The layer's base and top over (x, y), world units ({ base, top } in `out`).
    const cloudSlabScratch = { base: 0, top: 0, cover: 0 };
    function cloudLayerAt(x, y, out = cloudSlabScratch) {
      if (!cloudLayer.set) setCloudLayer();
      const L = cloudLayer,
        a = cloudAreaAt(x, y);
      out.base = L.base + a.sea * L.seaBase + a.mountain * L.mountainBase + a.city * L.cityBase;
      out.top = L.top + a.sea * L.seaTop + a.mountain * L.mountainTop + a.city * L.cityTop;
      out.cover = clamp(L.coverage + a.mountain * L.mountainCover, 0, 1);
      return out;
    }
    function cloudBaseAt(x, y) {
      return cloudLayerAt(x, y).base;
    }
    function cloudTopAt(x, y) {
      return cloudLayerAt(x, y).top;
    }
    // Cloud cover over (x, y) now: where the drifting cells are (0..1).
    function cloudCoverAt(x, y) {
      const cover = cloudLayerAt(x, y).cover,
        m = cloudMapAt(x + cloudLayer.windX, y + cloudLayer.windY);
      return smoothStep(1 - cover, 1 - cover + 0.28, m);
    }
    // How deep in cloud the point (x, y) at elevation z is: 0 in clear air, 1 in the
    // heart of a cloud. The same profile as the GPU's cloudDensity (a firm base, a
    // domed top that grows with cover, scud under a wet base), without its noise.
    function cloudAmountAt(x, y, z) {
      const slab = cloudLayerAt(x, y),
        base = slab.base,
        top = slab.top,
        cover = cloudCoverAt(x, y),
        h = (z - base) / Math.max(1, top - base);
      if (h >= 1 || cover <= 0.001) return 0;
      if (z < base) {
        // Scud: rags of cloud under the base.
        const below = (base - z) / Math.max(1, cloudLayer.scudDepth);
        return below >= 1 ? 0 : cloudLayer.scud * cover * (1 - below) * 0.4;
      }
      const dome = 0.36 + 0.64 * cover,
        profile = smoothStep(0, 0.07, h) * (1 - smoothStep(dome * 0.35, dome, h));
      return smoothStep(0.2, 0.75, cover * profile * 0.94);
    }
    function playerCloudImmersion() {
      return cloudLayer.immersion;
    }
    // Every frame from updateWeather(): the layer follows the weather, the wind carries
    // the field, and the airborne player's immersion eases in and out.
    function updateCloudLayer(deltaSeconds) {
      setCloudLayer();
      const L = cloudLayer,
        windSpeed = 30 + weather.wind * 70;
      L.windX = (L.windX + Math.cos(weather.windAngle) * windSpeed * deltaSeconds) % (CLOUD_MAP_SPAN * 3);
      L.windY = (L.windY + Math.sin(weather.windAngle) * windSpeed * deltaSeconds) % (CLOUD_MAP_SPAN * 3);
      L.clock += deltaSeconds;
      const airborne = player.parachute || (player.car && isAircraft(player.car)),
        target = airborne ? cloudAmountAt(player.x, player.y, entityElevation(player.car || player)) : 0;
      // Into cloud quickly, out of it a little slower (the damp hangs on).
      L.immersion += (target - L.immersion) * (1 - Math.exp(-deltaSeconds * (target > L.immersion ? 5 : 2.5)));
      if (L.immersion < 1e-4) L.immersion = 0;
      updateCloudAudio(deltaSeconds);
    }
    // For reports and tests: the layer over (x, y) in metres.
    function cloudLayerReport(x = player.x, y = player.y, altitudeM = null) {
      // (Fresh from the weather, even while a test holds the simulation.)
      setCloudLayer();
      const slab = cloudLayerAt(x, y),
        area = cloudAreaAt(x, y, {}),
        z = altitudeM === null ? entityElevation(player.car || player) : altitudeM * UNITS_PER_METRE,
        metres = (v) => +worldMeters(v).toFixed(1);
      return {
        weather: weatherState().id,
        x: Math.round(x),
        y: Math.round(y),
        baseM: metres(slab.base),
        topM: metres(slab.top),
        cover: +cloudCoverAt(x, y).toFixed(2),
        coverage: +slab.cover.toFixed(2),
        area: { sea: +area.sea.toFixed(2), mountain: +area.mountain.toFixed(2), city: +area.city.toFixed(2), groundM: metres(area.ground) },
        altitudeM: metres(z),
        amount: +cloudAmountAt(x, y, z).toFixed(2),
        immersion: +cloudLayer.immersion.toFixed(2),
        weatherBaseM: metres(cloudLayer.base),
        weatherTopM: metres(cloudLayer.top),
        scudM: metres(cloudLayer.scud > 0.01 ? cloudLayer.scudDepth : 0),
      };
    }
