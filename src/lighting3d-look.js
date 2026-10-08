      // Lighting 3D time-of-day look (updateLighting, NIGHT_LOOK, grade), contact shadows and the quality tier switch.
      // ---- Time-of-day look ------------------------------------------------------------------
      const SKY_KEYS = {
        // [zenith, horizon, ground, glow] in scene-linear sRGB hex.
        day: ['#5b87bd', '#c4d2dc', '#5c5a52', '#ffe2b8'],
        // (A soft blue zenith over a gold horizon: the old slate violet and
        // orange filtered into a mauve sky light that outshone the low sun on
        // dark asphalt.)
        dusk: ['#5a78a0', '#f2b27c', '#4a4038', '#ffa860'],
        // A blue-hour night, brighter than a real one on purpose: the moonlit sky
        // is the ambient that keeps streets readable between the lamp pools.
        night: ['#43557a', '#5f6a88', '#2b2e37', '#463d5e'],
        // CHASE NIGHT's sky: at street level the lamps carry the light, so the night sky is a deep navy over the
        // city's glow (the one sky: dome, environment and haze all take it).
        chaseNight: ['#1f2a44', '#3b4260', '#1b1d24', '#30294a'],
        overcast: ['#8a949e', '#b3b9bf', '#4a4d50', '#d0d0d0'],
      };
      const skyKeyColors = Object.fromEntries(
          Object.entries(SKY_KEYS).map(([k, list]) => [k, list.map((c) => new Three.Color(c))]),
        ),
        SKY_KEY_TARGETS = [skyUniforms.uZenith, skyUniforms.uHorizon, skyUniforms.uGround, skyUniforms.uGlow];
      /**
       * SKY AND HAZE (aerial-haze3d.js CITY_HAZE, lighting3d-sky-dome.js SKY)
       * The keys become the one sky the dome, the environment map and the chase view's haze
       * draw: the zenith a touch deeper and bluer by clear day; the horizon (the key, a little
       * brighter by day, with the city's sodium glow low over it at night); the glow along the
       * horizon towards the sun (faint by day, broad and gold at dusk); and the broad
       * circumsolar glow, whiter (the old sky's glow, the same light; its core is the dome's). Tuned
       * against the old gradient: the environment's irradiance stays within a few per cent
       * for roofs and walls by day, dusk, night and overcast (at dusk roofs ~7 % less, walls
       * facing the sun ~12 % more: the gold is low on the horizon). In the chase view the
       * haze model is on (cityHazeSun.w), told how dense the air is at the camera (scale
       * height HAZE_SCALE_HEIGHT above sea level) and where the far clip is.
       */
      const HAZE_SCALE_HEIGHT = 150 * UNITS_PER_METRE,
        HAZE_DEEP = [0.78, 0.9, 1.0],
        // Sodium light scattered in the night air over the city (times nightAmount and the city's weight): in
        // the haze and the environment about as bright as the blue it replaces, and a stronger band low over
        // the horizon on the dome only (uCityGlow), so the night's ambient keeps its level.
        HAZE_CITY_GLOW = new Three.Color('#c07848').multiplyScalar(0.1),
        DOME_CITY_GLOW = new Three.Color('#c27a45').multiplyScalar(0.18),
        // At dusk the horizon away from the sun cools towards a dusty pink (as bright as the key it
        // replaces); round the sun the glow is whiter than the gold along the horizon (Mie light is grey).
        HAZE_DUSK_AWAY = new Three.Color('#c8a0a8'),
        HAZE_HALO_WHITE = new Three.Color('#fff2dc'),
        // The dome alone (lighting3d-sky-dome.js uDomeZenith): share of the zenith's light taken out up
        // high, by clear day, at dusk and at night, so the sky through the grade's warm gain is a deep
        // blue (and the night's stars read). The environment keeps its light; at the horizon, where the
        // haze meets the dome, nothing changes.
        DOME_ZENITH_DAY = [0.7, 0.45, 0],
        DOME_ZENITH_DUSK = [0, -0.25, -0.1],
        DOME_ZENITH_NIGHT = [0.25, 0.22, 0.15],
        SKY_SUN_DISC = 36;
      let hazeCityWeight = 0,
        hazeCityX = Infinity,
        hazeCityY = Infinity;
      function updateHaze(dark, dusk, night, overcast) {
        const H = CITY_HAZE,
          sunU = H.cityHazeSun.value,
          skyU = H.cityHazeSky.value,
          glowU = H.cityHazeGlow.value,
          topU = H.cityHazeTop.value,
          haloU = H.cityHazeHalo.value,
          viewU = H.cityHazeView.value,
          zenith = skyUniforms.uZenith.value,
          horizon = skyUniforms.uHorizon.value,
          glow = skyUniforms.uGlow.value,
          clear = 1 - overcast,
          day = clear * (1 - dark),
          glowOn = 1 - night,
          away = 1 + 0.1 * day - 0.1 * dusk * clear,
          glowShare = (0.1 + 0.9 * dusk) * clear * glowOn,
          haloShare = 0.55 * (2 - 0.5 * dusk) * glowOn * (1 - 0.5 * overcast);
        // How much city lies round the camera (clouds.js area map; read again only after it moves 256 units).
        if (Math.abs(camera.position.x - hazeCityX) + Math.abs(camera.position.z - hazeCityY) > 256) {
          hazeCityX = camera.position.x;
          hazeCityY = camera.position.z;
          hazeCityWeight = clamp(cloudAreaAt(hazeCityX, hazeCityY).city * 1.4, 0, 1);
        }
        const city = nightAmount * (0.35 + 0.65 * hazeCityWeight),
          blue = away * (1 - 0.2 * city),
          pink = 0.45 * dusk * clear,
          pinkScale = (horizon.r + horizon.g + horizon.b) / (HAZE_DUSK_AWAY.r + HAZE_DUSK_AWAY.g + HAZE_DUSK_AWAY.b),
          domeDay = (1 - dark) * clear,
          domeDusk = dusk * clear,
          domeNight = dark * (1 - 0.5 * overcast);
        skyUniforms.uDomeZenith.value.set(
          DOME_ZENITH_DAY[0] * domeDay + DOME_ZENITH_DUSK[0] * domeDusk + DOME_ZENITH_NIGHT[0] * domeNight,
          DOME_ZENITH_DAY[1] * domeDay + DOME_ZENITH_DUSK[1] * domeDusk + DOME_ZENITH_NIGHT[1] * domeNight,
          DOME_ZENITH_DAY[2] * domeDay + DOME_ZENITH_DUSK[2] * domeDusk + DOME_ZENITH_NIGHT[2] * domeNight,
        );
        skyUniforms.uCityGlow.value.copy(DOME_CITY_GLOW).multiplyScalar(city * (1 - 0.6 * overcast));
        sunU[0] = skySunDirection.x;
        sunU[1] = skySunDirection.y;
        sunU[2] = skySunDirection.z;
        sunU[3] = chaseViewActive ? 1 : 0;
        skyU[0] = (horizon.r + (HAZE_DUSK_AWAY.r * pinkScale - horizon.r) * pink) * blue + HAZE_CITY_GLOW.r * city;
        skyU[1] = (horizon.g + (HAZE_DUSK_AWAY.g * pinkScale - horizon.g) * pink) * blue + HAZE_CITY_GLOW.g * city;
        skyU[2] = (horizon.b + (HAZE_DUSK_AWAY.b * pinkScale - horizon.b) * pink) * blue + HAZE_CITY_GLOW.b * city;
        skyU[3] = 1 / HAZE_SCALE_HEIGHT;
        glowU[0] = glow.r * glowShare;
        glowU[1] = glow.g * glowShare;
        glowU[2] = glow.b * glowShare;
        glowU[3] = 4 + 4 * (1 - dusk);
        topU[0] = zenith.r * (1 + (HAZE_DEEP[0] - 1) * day);
        topU[1] = zenith.g * (1 + (HAZE_DEEP[1] - 1) * day);
        topU[2] = zenith.b * (1 + (HAZE_DEEP[2] - 1) * day);
        topU[3] = 2.2 + 0.8 * clear;
        haloU[0] = (glow.r + (HAZE_HALO_WHITE.r - glow.r) * 0.6) * haloShare;
        haloU[1] = (glow.g + (HAZE_HALO_WHITE.g - glow.g) * 0.6) * haloShare;
        haloU[2] = (glow.b + (HAZE_HALO_WHITE.b - glow.b) * 0.6) * haloShare;
        haloU[3] = 40;
        viewU[0] = Math.exp(-Math.max(0, camera.position.y) / HAZE_SCALE_HEIGHT);
        viewU[1] = chaseViewActive ? camera.far : 0;
        viewU[2] = camera.position.y;
      }
      // Lamp materials are declared after this file; their day colours are read on first use.
      let warmLampBase = null,
        tailLampBase = null,
        brakeLampBase = null;
      /**
       * NIGHT LOOK
       * A readable blue-hour night rather than an ink-black one: moonlight and a
       * cool sky fill strong enough that roads, buildings, people and cars read
       * everywhere, blacks lifted slightly towards blue, less contrast than by
       * day, and exposure opened up. Lamps, neon and headlights stay far brighter
       * than this ambient, so they still pop and pool. (No light follows the
       * player: they are lit like everyone else.)
       */
      const NIGHT_LOOK = {
        moon: 0.75, // added to the moon's (the sun light's) night intensity
        sky: 1.5, // added to the hemisphere sky fill
        exposure: 0.3, // extra exposure share at full night
        saturation: 0.2, // saturation lost at full night
        contrast: 0.08, // contrast lost at full night
        lampPower: 3.6, // street-lamp map strength
      };
      /* CHASE NIGHT: at street level the lamps, windows, neon and headlights light the way (CITY WALL LIGHT reaches
         the facades), so the chase view takes less of the moon and sky fill and of the night exposure and keeps more
         contrast: a darker night with stronger pools, as GTA IV draws it. The street view keeps the readable night.
         Shares of NIGHT_LOOK's moon, sky, exposure and contrast terms. */
      const CHASE_NIGHT = { moon: 0.5, sky: 0.55, exposure: 0.6, contrast: 0.25 },
        STREET_NIGHT = { moon: 1, sky: 1, exposure: 1, contrast: 1 };
      const gradeLiftNight = new Three.Vector3(0.012, 0.02, 0.036),
        gradeGainNight = new Three.Vector3(1.05, 1.0, 0.95),
        gradeLiftDusk = new Three.Vector3(0.0, 0.002, 0.006),
        gradeGainDusk = new Three.Vector3(1.08, 1.02, 0.84),
        // Day: cool, sky-lit shade and warm sunlit highlights, so depth reads as
        // colour as well as value.
        gradeLiftDay = new Three.Vector3(0.0, 0.004, 0.012),
        gradeGainDay = new Three.Vector3(1.07, 1.0, 0.88);
      // How dark the sky is (0 by day .. 1 at night): it stays a day sky until
      // the last half hour of sun, however low the sun, then dims through
      // twilight. The night look and the sky fill's colour follow it.
      function skyDarkness(light) {
        const up = clamp(light / 0.3, 0, 1);
        return 1 - up * up * (3 - 2 * up);
      }
      let lightingClock = performance.now();
      function updateLighting(deltaSeconds) {
        // The environment rebuild is throttled on the wall clock, not game time.
        const now = performance.now();
        envAge += (now - lightingClock) / 1000;
        lightingClock = now;
        updateSunPath();
        const light = litDaylight(),
          // The lights come on with `night` (from ~1.5 h before sunset); the
          // night LOOK (moon and sky fill, exposure, the blue grade) waits for
          // `dark`, from the last half hour of sun: the moonlit fill and blue lift
          // laid over the low warm sun turned the golden hour magenta.
          night = clamp(1 - light * 1.6, 0, 1),
          dark = skyDarkness(light),
          dusk = clamp(1 - Math.abs(light - 0.3) / 0.3, 0, 1),
          overcast = weather.cloud * weather.cloud,
          rain = weather.rain;
        // Sky colours: night -> day, dusk on top, grey as it clouds over.
        const k = skyKeyColors;
        const nightKeys = chaseViewActive ? k.chaseNight : k.night;
        for (let i = 0; i < 4; i++)
          SKY_KEY_TARGETS[i].value.copy(nightKeys[i]).lerp(k.day[i], 1 - dark).lerp(k.dusk[i], dusk * 0.75).lerp(k.overcast[i], overcast * 0.7 * light);
        updateHaze(dark, dusk, night, overcast);
        // The disc keeps its light until it sets, dimmer low down (the long path through the air reddens it
        // too, in the light's own dusk colour); it hides as the cloud closes (the clouds drawn over it do
        // the rest). The moon goes behind an overcast, the stars behind any cloud and over the city's glow.
        const closing = clamp((weather.cloud - 0.5) / 0.35, 0, 1),
          sunUp = skySunDirection.y;
        skyUniforms.uSunDisc.value =
          SKY_SUN_DISC * smoothStep(-0.015, 0.03, sunUp) * (0.35 + 0.65 * smoothStep(0, 0.45, sunUp)) * (1 - 0.85 * closing * closing * (3 - 2 * closing));
        skyUniforms.uMoonLight.value = night * (1 - 0.85 * overcast);
        skyUniforms.uStars.value = night * (1 - overcast) * (1 - 0.45 * hazeCityWeight);
        skyUniforms.uSunColor.value.copy(sun.color);
        refreshEnvironment(false);
        // The dome only exists for the perspective views: in the air and the chase view (chase-view3d.js).
        skyDome.visible = flightViewActive || chaseViewActive;
        if (skyDome.visible) {
          skyDome.position.copy(camera.position);
          skyDome.scale.setScalar(camera.far * 0.9);
        }
        // Sun glints on the water, cloud lighting and cloud shadows follow the real sun; in the chase view
        // the glitter lies under the sun the sky draws (handing over to the moon as the light does).
        waterUniforms.uSun.value.copy(chaseViewActive ? skyLightDirection : sunDirection);
        SUN_DIRECTION.copy(sunDirection);
        marchUniforms.uSunDirection.value.copy(sunDirection);
        shadeUniforms.uSunDirection.value.copy(sunDirection);
        // Night light: lamp pools, and emissive lamp heads bright enough to bloom.
        cityLightUniforms.cityLampPower.value = night * NIGHT_LOOK.lampPower;
        cityLightUniforms.cityWet.value = weather.wet;
        const blackout = cityLightUniforms.cityZonePower.value;
        blackout.set(sideJobPower(100, 100), sideJobPower(100, 2000), sideJobPower(100, 3000));
        if (!warmLampBase) {
          warmLampBase = warmLamp.color.clone();
          tailLampBase = tailLamp.color.clone();
          brakeLampBase = brakeLamp.color.clone();
        }
        const lampsOn = vehicleLampAmount();
        warmLamp.color.copy(warmLampBase).multiplyScalar(1 + lampsOn * 3.5);
        tailLamp.color.copy(tailLampBase).multiplyScalar(1 + lampsOn * 2.5);
        brakeLamp.color.copy(brakeLampBase).multiplyScalar(3 + lampsOn * 3);
        updateHeadlightBeams();
        // Moonlight and sky light strong enough to read the streets by at night (less of it at street level).
        const nightFill = chaseViewActive ? CHASE_NIGHT : STREET_NIGHT;
        sun.intensity += dark * NIGHT_LOOK.moon * nightFill.moon;
        hemi.intensity += dark * NIGHT_LOOK.sky * nightFill.sky;
        // Through twilight the light swings from the sun to the moon (sun-path.js): its shadows fade out and back
        // while it turns, the sky fill taking a little of what it gives up (twilight light is diffuse).
        if (sunShade < 1) {
          hemi.intensity += sun.intensity * (1 - sunShade) * 0.3;
          sun.intensity *= sunShade;
        }
        // Post look: exposure, bloom and grade (postfx3d.js).
        // A touch more exposure at night: legibility first, darkness second.
        postLook.exposure = renderer.toneMappingExposure * (1 + dark * NIGHT_LOOK.exposure * nightFill.exposure);
        // Bloom: by day only glints and the sun on glass and water (at 2.2 the
        // sunlit pale paving itself crossed the knee and hung a milky veil over
        // the street); after dark the lights themselves (lamps, neon, windows,
        // headlight glows), not the pale paving and paint a beam lights up.
        postLook.bloomThreshold = 3.3 - night * 0.7 - dusk * 0.7;
        postLook.bloomStrength = 0.18 + night * 0.32 + dusk * 0.12;
        // Rich rather than loud: a little saturation, more vibrance (it lifts
        // the muted paint, awnings and planting, not what is already strong).
        postLook.saturation = (1.12 + dusk * 0.05 - dark * NIGHT_LOOK.saturation) * (1 - overcast * 0.14 - rain * 0.06);
        postLook.vibrance = (0.42 + dusk * 0.08 - dark * 0.2) * (1 - overcast * 0.5);
        postLook.contrast = 1.2 + dusk * 0.02 - dark * NIGHT_LOOK.contrast * nightFill.contrast - overcast * 0.08;
        postLook.lift.copy(gradeLiftDay).lerp(gradeLiftDusk, dusk).lerp(gradeLiftNight, dark);
        postLook.gain.copy(gradeGainDay).lerp(gradeGainDusk, dusk).lerp(gradeGainNight, dark);
        if (rain > 0.05) {
          postLook.lift.lerp(gradeLiftNight, rain * 0.3);
          postLook.gain.lerp(gradeGainDay, rain * 0.5);
        }
        postLook.vignette = 0.22 + dark * 0.06;
        // AO reads at street scale on the ground and grows with the view from the air.
        postLook.aoRadius = clamp(18 / Math.max(0.25, viewZoom), 18, 72);
        postLook.aoIntensity = 1.75;
        // Rain and lightning on top of the time of day (weather3d.js).
        weatherGrade();
      }
      /**
       * SHADOW CASTERS
       * A car or a person is two dozen small meshes, and every one of them was
       * drawn again into the shadow map. Seen from the street camera their shadow
       * is the body's: the lamps, trims, hands and gun models under it add
       * nothing but draw calls. New models keep shadows only on parts larger
       * than `minRadius` (world units, bounding-sphere radius).
       */
      const casterScale = new Three.Vector3();
      function trimShadowCasters(root, minRadius) {
        root.updateMatrixWorld(true);
        root.traverse((o) => {
          if (!o.isMesh || !o.castShadow || !o.geometry) return;
          if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
          o.getWorldScale(casterScale);
          const radius = o.geometry.boundingSphere.radius * Math.max(casterScale.x, casterScale.y, casterScale.z);
          if (radius < minRadius) o.castShadow = false;
        });
      }
      // ---- Contact shadows ---------------------------------------------------------------
      /**
       * CONTACT SHADOWS
       * With sun shadows off (quality.js SHADOWS: the LOW tier's default, or the
       * Settings choice), every car, pedestrian and figure in view sits on a soft
       * dark blob instead, so nothing floats over the street: one instanced draw
       * for all of them. Nothing is drawn while the shadow map is on.
       */
      const CONTACT_CAPACITY = 900,
        contactCanvas = document.createElement('canvas');
      contactCanvas.width = contactCanvas.height = 64;
      {
        const g = contactCanvas.getContext('2d'),
          grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(0.55, 'rgba(0,0,0,0.8)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
      }
      const contactShadows = new Three.InstancedMesh(
        new Three.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        new Three.MeshBasicMaterial({
          color: '#000000',
          map: new Three.CanvasTexture(contactCanvas),
          transparent: true,
          // Sunlit pavement sits high on the tone curve, where halving the light
          // only darkens it a little: the blob has to be strong to read by day.
          opacity: 0.82,
          depthWrite: false,
          fog: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -2,
        }),
        CONTACT_CAPACITY,
      );
      contactShadows.count = 0;
      contactShadows.visible = false;
      contactShadows.frustumCulled = false;
      contactShadows.renderOrder = 2;
      contactShadows.userData.dynamic = true;
      contactShadows.name = 'contact shadows';
      scene.add(contactShadows);
      const contactMatrix = new Three.Matrix4(),
        contactPosition = new Three.Vector3(),
        contactRotation = new Three.Quaternion(),
        contactScale = new Three.Vector3(),
        contactUp = new Three.Vector3(0, 1, 0);
      let contactCount = 0;
      function contactBlob(x, y, ground, length, width, angle) {
        if (contactCount >= CONTACT_CAPACITY) return;
        contactPosition.set(x, ground + 0.3, y);
        contactRotation.setFromAxisAngle(contactUp, -angle);
        contactScale.set(length, 1, width);
        contactShadows.setMatrixAt(contactCount++, contactMatrix.compose(contactPosition, contactRotation, contactScale));
      }
      // Called every frame from render(), once the people and vehicles are placed.
      function updateContactShadows() {
        contactCount = 0;
        if (!renderer.shadowMap.enabled) {
          for (const c of vehicles) {
            const spec = vehicleSpec(c);
            if (spec.boat || spec.jetski) continue;
            // (The view test first: terrainHeight for the ~250 vehicles off screen was the cost.)
            if (!entityInView(c, Math.max(40, spec.l))) continue;
            const ground = terrainHeight(c.x, c.y),
              aircraft = isAircraft(c);
            // Aircraft only on the ground.
            if (aircraft && (c.altitude ?? 0) - ground > 3) continue;
            const shrink = aircraft ? 0.8 : 1;
            contactBlob(c.x, c.y, aircraft ? ground : entityElevation(c), spec.l * 1.12 * shrink, spec.w * 1.35 * shrink, c.a || 0);
          }
          // People are only drawn this close in (render3d.js, crowd3d.js).
          if (chaseViewActive || (flightViewActive ? viewZoom > PEOPLE_ZOOM : worldZoom > 0.22)) {
            for (const p of pedestrians)
              if (!p.hidden && !p.swimming && entityInView(p, 20)) contactBlob(p.x, p.y, entityElevation(p), 10, 10, 0);
            for (const p of renderPeople) {
              if (p.hidden || p.swimming || p.parachute) continue;
              if (p === player && (player.car || transitRide || taxiRide)) continue;
              if (entityInView(p, 20)) contactBlob(p.x, p.y, entityElevation(p), 10, 10, 0);
            }
          }
        }
        contactShadows.count = contactCount;
        contactShadows.visible = contactCount > 0;
        if (contactCount) {
          // Only the instances in use go to the GPU (the buffer holds CONTACT_CAPACITY).
          contactShadows.instanceMatrix.addUpdateRange(0, contactCount * 16);
          contactShadows.instanceMatrix.needsUpdate = true;
        }
      }
      // ---- Quality tier ----------------------------------------------------------------------
      let activeTier = null;
      /**
       * LIT STATE
       * Whether the sun and the helicopter's spot cast shadows and whether the trees draw with alpha to
       * coverage are part of every lit program's cache key: a tier or shadow-setting change that flips one
       * relinks ~45 programs the first time a frame draws with it (a stall of seconds on a slow driver).
       * Where the driver compiles in parallel, `stageLitSwitch` stages it: the new state's programs are
       * compiled in slices behind the running frames (render3d-resources.js prewarmShaders(stage)), the flags
       * flipped only for the length of each slice, and the flags change for good once every program is ready.
       * A later change replaces a pending one; software GL (no parallel compile) switches at once.
       */
      let litStaged = null,
        // Set by prewarmShaders once the driver is known to compile in parallel.
        litStagingReady = false;
      const litStageInfo = { pending: false, switches: 0, ms: 0, compiled: 0, linked: 0, queued: 0, passes: 0, uploads: 0, error: '' };
      function litStateFor(tier) {
        const mode = shadowQuality();
        return {
          shadows: mode !== 'off',
          size: mode === 'low' ? Math.min(tier.shadowMap, 2048) : Math.max(2048, tier.shadowMap),
          spot: searchlightShadowFor(tier),
          coverage: foliageCoverageFor(tier),
        };
      }
      function litProgramsDiffer(state) {
        return renderer.shadowMap.enabled !== state.shadows || airSpot.castShadow !== state.spot.cast || treeMaterial.alphaToCoverage !== state.coverage;
      }
      // The program-keyed flags only (no map sizes or disposals): what a staged compile slice flips.
      function setLitFlags(state) {
        renderer.shadowMap.enabled = state.shadows;
        sun.castShadow = state.shadows;
        airSpot.castShadow = state.spot.cast;
        setFoliageCoverageOn(state.coverage);
      }
      function litFlagsNow() {
        return { shadows: renderer.shadowMap.enabled, spot: { cast: airSpot.castShadow }, coverage: treeMaterial.alphaToCoverage };
      }
      function applyLitState(state) {
        renderer.shadowMap.enabled = state.shadows;
        if (sun.castShadow !== state.shadows) sun.castShadow = state.shadows;
        if (sun.shadow.mapSize.x !== state.size || (!state.shadows && sun.shadow.map)) {
          sun.shadow.mapSize.set(state.size, state.size);
          if (sun.shadow.map) {
            sun.shadow.map.dispose();
            sun.shadow.map = null;
          }
        }
        applySearchlightShadow(state.spot);
        setFoliageCoverageOn(state.coverage);
      }
      function stageLitSwitch(state) {
        // A shadow map that does not exist yet takes its size now, so the staged shadow pass makes the right one.
        if (state.shadows && !renderer.shadowMap.enabled) sun.shadow.mapSize.set(state.size, state.size);
        if (state.spot.cast && !airSpot.castShadow) airSpot.shadow.mapSize.set(state.spot.size, state.spot.size);
        litStaged = { state, started: performance.now() };
        litStageInfo.pending = true;
        try {
          postSceneTarget(); // (the post targets of the new tier must exist for the post passes)
          prewarmShaders(litStaged);
        } catch (error) {
          // Staging is an optimisation: when it cannot start the switch is made at once.
          litStageInfo.error = String(error).slice(0, 160);
          litStaged = null;
          litStageInfo.pending = false;
          applyLitState(state);
        }
      }
      // Called by the staged prewarm when every program of the new state is ready.
      function finishLitSwitch(stage) {
        if (litStaged !== stage) return;
        litStaged = null;
        litStageInfo.pending = false;
        litStageInfo.switches++;
        applyLitState(litStateFor(activeTier));
      }
      function applyRendererQuality(tier) {
        activeTier = tier;
        const ratio = Math.min(devicePixelRatio || 1, tier.pixelRatio);
        if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
        renderer.setSize(viewportWidth, viewportHeight);
        // Sun shadows (quality.js SHADOWS): off, a smaller map, or the tier's map. A new size only
        // reallocates the map; flipping them on or off changes the lit programs (LIT STATE above).
        const state = litStateFor(tier);
        setPostQuality(tier);
        setSearchlightQuality(tier, false);
        litStaged = null;
        litStageInfo.pending = false;
        if (litStagingReady && lookSwitchState.stagedSwitch && litProgramsDiffer(state)) stageLitSwitch(state);
        else applyLitState(state);
      }
