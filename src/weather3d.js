      // BEGIN SUBSYSTEM: src/weather3d.js — Weather and sky visuals
      /**
       * Weather and sky visuals
       * Source: src/weather3d.js
       * Scope: createCityRenderer() closure.
       * Rain, wet roads, lightning, and the cloud deck you can fly into.
       */
      /**
       * RAIN
       * One LineSegments object of short streaks kept in a box around the camera.
       * Each drop falls and is wrapped back to the top of the box, so the same few
       * thousand vertices cover the whole city and nothing is allocated per frame.
       *
       * CLOUD DECK
       * A broken layer of soft billboards at flying height whose coverage follows
       * the weather. Climb into it and the fog closes in, which is the only honest
       * altitude cue an overhead camera can give you.
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
      // ---- Cloud deck ---------------------------------------------------------------
      const CLOUD_ALTITUDE = 1180,
        CLOUD_COUNT = touchEnabled() ? 26 : 54,
        cloudTexture = (() => {
          const cv = document.createElement('canvas');
          cv.width = cv.height = 128;
          const g = cv.getContext('2d'),
            grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
          grad.addColorStop(0, 'rgba(255,255,255,0.95)');
          grad.addColorStop(0.45, 'rgba(250,251,253,0.6)');
          grad.addColorStop(1, 'rgba(240,244,250,0)');
          g.fillStyle = grad;
          g.beginPath();
          g.arc(64, 64, 63, 0, Math.PI * 2);
          g.fill();
          const tx = new Three.CanvasTexture(cv);
          tx.colorSpace = Three.SRGBColorSpace;
          return tx;
        })();
      const cloudMaterial = new Three.SpriteMaterial({
        map: cloudTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.8,
        fog: false,
      });
      const clouds = [];
      for (let i = 0; i < CLOUD_COUNT; i++) {
        const sprite = new Three.Sprite(cloudMaterial.clone());
        const size = 620 + Math.random() * 1250;
        sprite.scale.set(size, size * (0.42 + Math.random() * 0.2), 1);
        sprite.userData.offset = {
          x: (Math.random() - 0.5) * 9000,
          z: (Math.random() - 0.5) * 9000,
          y: CLOUD_ALTITUDE + (Math.random() - 0.5) * 210,
          threshold: Math.random(),
          drift: 0.4 + Math.random() * 0.8,
        };
        sprite.renderOrder = -2;
        scene.add(sprite);
        clouds.push(sprite);
      }
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
          const baseX = cameraTarget.x,
            baseZ = cameraTarget.y,
            ground = terrainHeight(cameraTarget.x, cameraTarget.y);
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
        scene.fog.density *= 1 + rain * 2.6 + cloud * 0.5;
        if (weather.flash > 0) {
          const f = weather.flash * weather.flash;
          sun.intensity += 9 * f;
          hemi.intensity += 3 * f;
          scene.background.lerp(new Three.Color('#dfe6f2'), f * 0.7);
        } else {
          // Grey the sky down as it clouds over, without losing the dusk colour.
          scene.background.lerp(new Three.Color('#8d949c'), overcast * 0.55);
          scene.fog.color.lerp(new Three.Color('#8d949c'), overcast * 0.55);
        }
        // Cloud deck: coverage follows the weather, and it drifts downwind.
        const tint = 0.55 + light * 0.45;
        for (const sprite of clouds) {
          const d = sprite.userData.offset,
            shown = cloud > d.threshold * 0.95;
          sprite.visible = shown;
          if (!shown) continue;
          d.x += Math.cos(weather.windAngle) * weather.wind * d.drift * deltaSeconds * 26;
          d.z += Math.sin(weather.windAngle) * weather.wind * d.drift * deltaSeconds * 26;
          if (d.x > 5200) d.x -= 10400;
          if (d.x < -5200) d.x += 10400;
          if (d.z > 5200) d.z -= 10400;
          if (d.z < -5200) d.z += 10400;
          sprite.position.set(cameraTarget.x + d.x, d.y, cameraTarget.y + d.z);
          sprite.material.opacity = (0.2 + cloud * 0.62) * tint;
          sprite.material.color.setScalar(tint);
        }
        // Inside the deck the world greys out, which is what tells you how high you are.
        const altitude = entityElevation(player.car || player),
          inCloud = clamp(1 - Math.abs(altitude - CLOUD_ALTITUDE) / 240, 0, 1) * cloud;
        if (inCloud > 0.01) {
          scene.fog.density += inCloud * 0.0022;
          scene.fog.color.lerp(new Three.Color('#d5dbe2'), inCloud * 0.8);
          scene.background.lerp(new Three.Color('#d5dbe2'), inCloud * 0.8);
        }
      }
      // END SUBSYSTEM: src/weather3d.js
