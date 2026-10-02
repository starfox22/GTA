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
        overcast: ['#8a949e', '#b3b9bf', '#4a4d50', '#d0d0d0'],
      };
      const skyKeyColors = Object.fromEntries(
        Object.entries(SKY_KEYS).map(([k, list]) => [k, list.map((c) => new Three.Color(c))]),
      );
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
        const light = daylight(),
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
        for (let i = 0; i < 4; i++) {
          const target = [skyUniforms.uZenith, skyUniforms.uHorizon, skyUniforms.uGround, skyUniforms.uGlow][i].value;
          target.copy(k.night[i]).lerp(k.day[i], 1 - dark).lerp(k.dusk[i], dusk * 0.75).lerp(k.overcast[i], overcast * 0.7 * light);
        }
        skyUniforms.uNight.value = night;
        skyUniforms.uStars.value = night * (1 - overcast);
        skyUniforms.uSunColor.value.copy(sun.color);
        refreshEnvironment(false);
        // The dome only exists for the flight camera.
        skyDome.visible = flightViewActive;
        if (skyDome.visible) {
          skyDome.position.copy(camera.position);
          skyDome.scale.setScalar(camera.far * 0.9);
        }
        // Sun glints on the water, cloud lighting and cloud shadows follow the real sun.
        waterUniforms.uSun.value.copy(sunDirection);
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
        // Moonlight and sky light strong enough to read the streets by at night.
        sun.intensity += dark * NIGHT_LOOK.moon;
        hemi.intensity += dark * NIGHT_LOOK.sky;
        // Post look: exposure, bloom and grade (postfx3d.js).
        // A touch more exposure at night: legibility first, darkness second.
        postLook.exposure = renderer.toneMappingExposure * (1 + dark * NIGHT_LOOK.exposure);
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
        postLook.contrast = 1.2 + dusk * 0.02 - dark * NIGHT_LOOK.contrast - overcast * 0.08;
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
          if (flightViewActive ? viewZoom > PEOPLE_ZOOM : worldZoom > 0.22) {
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
        if (contactCount) contactShadows.instanceMatrix.needsUpdate = true;
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
