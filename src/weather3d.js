      // BEGIN SUBSYSTEM: src/weather3d.js — Weather and sky visuals
      /**
       * Weather and sky visuals
       * Source: src/weather3d.js
       * Scope: createCityRenderer() closure.
       * Rain, wet roads, lightning and the overcast light (clouds are in clouds3d.js).
       */
      /**
       * RAIN
       * One LineSegments object of short streaks kept in a box around the camera.
       * Each drop falls and is wrapped back to the top of the box, so the same few
       * thousand vertices cover the whole city and nothing is allocated per frame.
       */
      const RAIN_DROPS = touchEnabled() ? 1100 : 2600,
        RAIN_BOX = 1500,
        RAIN_TOP = 560;
      const rainPositions = new Float32Array(RAIN_DROPS * 6),
        rainSeeds = new Float32Array(RAIN_DROPS * 3);
      for (let i = 0; i < RAIN_DROPS; i++) {
        rainSeeds[i * 3] = (Math.random() - 0.5) * RAIN_BOX;
        rainSeeds[i * 3 + 1] = Math.random() * RAIN_TOP;
        rainSeeds[i * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX;
      }
      const rainGeometry = new Three.BufferGeometry();
      rainGeometry.setAttribute('position', new Three.BufferAttribute(rainPositions, 3));
      const rainMaterial = new Three.LineBasicMaterial({
        color: '#bcd2e4',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const rainMesh = new Three.LineSegments(rainGeometry, rainMaterial);
      rainMesh.frustumCulled = false;
      rainMesh.visible = false;
      scene.add(rainMesh);
      // Clouds and their shadows live in clouds3d.js.
      // ---- Frame update --------------------------------------------------------------
      let rainPhase = 0;
      function updateWeatherVisuals(deltaSeconds) {
        const rain = weather.rain,
          cloud = weather.cloud,
          light = daylight();
        // Rain.
        rainMesh.visible = rain > 0.02;
        if (rainMesh.visible) {
          rainMaterial.opacity = clamp(rain * 0.5, 0, 0.55) * (0.45 + 0.55 * light);
          const fall = 900 + rain * 700,
            slant = weather.wind * 190,
            wx = Math.cos(weather.windAngle) * slant,
            wz = Math.sin(weather.windAngle) * slant,
            length = 16 + rain * 26;
          rainPhase += deltaSeconds * fall;
          // In the air the box of rain rides with the aircraft (below the cloud base),
          // so you fly through the streaks instead of looking down on a patch of them.
          const baseX = cameraTarget.x,
            baseZ = cameraTarget.y,
            street = terrainHeight(cameraTarget.x, cameraTarget.y),
            ground = flightViewActive
              ? Math.max(street, Math.min(flightAltitude, CLOUD_BASE) - RAIN_TOP * 0.6)
              : street;
          for (let i = 0; i < RAIN_DROPS; i++) {
            const seedY = rainSeeds[i * 3 + 1],
              y = ground + RAIN_TOP - ((rainPhase + seedY * 3) % RAIN_TOP),
              drop = (rainPhase + seedY * 3) / RAIN_TOP,
              x = baseX + rainSeeds[i * 3] + ((wx * drop) % RAIN_BOX),
              z = baseZ + rainSeeds[i * 3 + 2] + ((wz * drop) % RAIN_BOX),
              o = i * 6;
            rainPositions[o] = x;
            rainPositions[o + 1] = y;
            rainPositions[o + 2] = z;
            rainPositions[o + 3] = x - (wx / fall) * length;
            rainPositions[o + 4] = y + length;
            rainPositions[o + 5] = z - (wz / fall) * length;
          }
          rainGeometry.attributes.position.needsUpdate = true;
        }
        // Wet tarmac: a darker, glossier ground while the water stands.
        groundMesh.material.roughness = 1 - weather.wet * 0.72;
        groundMesh.material.metalness = 0.14 + weather.wet * 0.34;
        groundMesh.material.color.setScalar(1 - weather.wet * 0.26);
        // Overcast flattens the sun and lifts the ambient; lightning blows both out.
        const overcast = cloud * cloud;
        sun.intensity *= 1 - overcast * 0.62;
        hemi.intensity *= 1 + overcast * 0.22;
        scene.fog.density *= 1 + rain * 2.6;
        if (weather.flash > 0) {
          const f = weather.flash * weather.flash;
          sun.intensity += 9 * f;
          hemi.intensity += 3 * f;
          scene.background.lerp(new Three.Color('#dfe6f2'), f * 0.7);
        } else {
          // Grey the sky down as it clouds over, without losing the dusk colour.
          scene.background.lerp(new Three.Color('#8d949c'), overcast * 0.4);
          scene.fog.color.lerp(new Three.Color('#8d949c'), overcast * 0.4);
        }
      }
      // END SUBSYSTEM: src/weather3d.js
