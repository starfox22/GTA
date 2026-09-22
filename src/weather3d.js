      // BEGIN SUBSYSTEM: src/weather3d.js — Weather and sky visuals
      /**
       * Weather and sky visuals
       * Source: src/weather3d.js
       * Scope: createCityRenderer() closure.
       * Rain, wet roads, lightning, cloud shadows and the deck you can fly into.
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
      /**
       * CLOUD
       * Billboards were wrong for an overhead view: they face the camera, so a
       * deck of them read as grey smears lying over the sea. Cloud is two
       * horizontal layers instead. The deck itself sits at flying height and is
       * only ever in frame when you are above it, which is exactly when you want
       * to see cloud tops. What you see from the street is the second layer: the
       * shadows those clouds throw, drifting across the city on the wind. The sun
       * is dimmed by the same field sampled under the camera, so the light
       * breathes in step with the shadow that is crossing you.
       */
      const CLOUD_ALTITUDE = 1180,
        CLOUD_SPAN = 16000,
        CLOUD_TILE = 1900;
      function buildCloudTexture(dark) {
        const size = 512,
          cv = document.createElement('canvas');
        cv.width = cv.height = size;
        const g = cv.getContext('2d');
        g.clearRect(0, 0, size, size);
        let seed = 20260922;
        const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
        // Drawn with wrapped copies so the sheet tiles without a visible seam.
        // Fewer, larger, better-separated patches: a dense sheet averages out to a
        // flat wash over the whole frame instead of reading as cloud going past.
        for (let i = 0; i < 74; i++) {
          const cx = rnd() * size,
            cy = rnd() * size,
            r = 38 + rnd() * 118,
            peak = 0.4 + rnd() * 0.5;
          for (const ox of [-size, 0, size])
            for (const oy of [-size, 0, size]) {
              const grad = g.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
              grad.addColorStop(0, dark ? 'rgba(20,26,34,' + peak + ')' : 'rgba(255,255,255,' + peak + ')');
              grad.addColorStop(1, dark ? 'rgba(20,26,34,0)' : 'rgba(255,255,255,0)');
              g.fillStyle = grad;
              g.beginPath();
              g.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
              g.fill();
            }
        }
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        tx.repeat.set(CLOUD_SPAN / CLOUD_TILE, CLOUD_SPAN / CLOUD_TILE);
        return tx;
      }
      const cloudTopTexture = buildCloudTexture(false),
        cloudShadowTexture = buildCloudTexture(true);
      const cloudDeck = new Three.Mesh(
        new Three.PlaneGeometry(CLOUD_SPAN, CLOUD_SPAN),
        new Three.MeshBasicMaterial({
          map: cloudTopTexture,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          side: Three.DoubleSide,
          fog: false,
        }),
      );
      cloudDeck.rotation.x = -Math.PI / 2;
      cloudDeck.visible = false;
      cloudDeck.frustumCulled = false;
      scene.add(cloudDeck);
      const cloudShade = new Three.Mesh(
        new Three.PlaneGeometry(CLOUD_SPAN, CLOUD_SPAN),
        new Three.MeshBasicMaterial({
          map: cloudShadowTexture,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          fog: false,
        }),
      );
      cloudShade.rotation.x = -Math.PI / 2;
      cloudShade.renderOrder = 6;
      cloudShade.visible = false;
      cloudShade.frustumCulled = false;
      scene.add(cloudShade);
      // How much cloud is directly overhead, read off the same tiling the shadow
      // layer uses, so the sun dims when a shadow is actually crossing you.
      let cloudDrift = 0;
      function overheadCloud(x, z) {
        const u = (x / CLOUD_TILE + cloudDrift) * 6.2831,
          v = (z / CLOUD_TILE + cloudDrift * 0.6) * 6.2831;
        return clamp(
          0.5 + 0.28 * (Math.sin(u) + Math.sin(v * 0.83 + 1.7)) + 0.16 * Math.sin((u + v) * 0.41),
          0,
          1,
        );
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
        // Two horizontal layers drifting downwind on one shared tiling: cloud tops
        // at flying height, and the shadows they throw across the city.
        cloudDrift += deltaSeconds * weather.wind * 0.013;
        const tint = 0.62 + light * 0.38,
          driftX = Math.cos(weather.windAngle) * cloudDrift,
          driftZ = Math.sin(weather.windAngle) * cloudDrift;
        cloudDeck.visible = cloud > 0.08;
        if (cloudDeck.visible) {
          cloudDeck.position.set(cameraTarget.x, CLOUD_ALTITUDE, cameraTarget.y);
          cloudTopTexture.offset.set(
            cameraTarget.x / CLOUD_TILE + driftX,
            -cameraTarget.y / CLOUD_TILE - driftZ,
          );
          cloudDeck.material.opacity = clamp(cloud * 1.15 - 0.08, 0, 0.95) * tint;
          cloudDeck.material.color.setScalar(tint);
        }
        cloudShade.visible = cloud > 0.12 && light > 0.06;
        if (cloudShade.visible) {
          const shadowHeight = terrainHeight(cameraTarget.x, cameraTarget.y);
          cloudShade.position.set(cameraTarget.x, shadowHeight + 2.2, cameraTarget.y);
          cloudShadowTexture.offset.set(
            cameraTarget.x / CLOUD_TILE + driftX,
            -cameraTarget.y / CLOUD_TILE - driftZ,
          );
          // Solid overcast has no edges to cast, so the shadows are strongest in
          // broken cloud and fade away again as the sky closes over.
          cloudShade.material.opacity = clamp(Math.sin(cloud * Math.PI) * 0.5, 0, 0.5) * light;
        }
        sun.intensity *= 1 - overheadCloud(cameraTarget.x, cameraTarget.y) * cloud * 0.45;
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
