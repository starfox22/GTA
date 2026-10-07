      // Blood decals in 3D: every pool, spatter, drop and tyre track on the ground and every splash on a wall
      // (blood.js bloodPools) in ONE instanced draw, its stamps in one atlas. Renderer only: it reads the decals.
      /**
       * BLOOD DECALS
       * One InstancedMesh of BLOOD_LIMIT unit quads (it was one Mesh and one draw call per decal). The atlas is
       * 4 x 5 tiles of 128 px: the sixteen bloodStamp variants (pools, spatters, drops, wall splashes) and the
       * tyre track's tread. Per instance: the matrix (ground: flat, turned to `a`, `bloodDecalScale`; wall:
       * standing on the face `nx, ny` at height `surface`, a little off it by damage3d-decals.js wallOffset,
       * the stamp's down down the wall), `aBloodTile`, `aBloodAlpha` (`bloodFade`) and the instance colour (it
       * darkens as it dries over the first minutes). Satin, never emissive, lit and shadowed like the street;
       * transparent at renderOrder 3, no depth write, pulled forward by polygon offset. The buffers are
       * rewritten only when the list changed, a pool is still spreading, or every BLOOD_DECAL_REFRESH s
       * (fades and drying), and only the used range is uploaded.
       */
      const BLOOD_ATLAS_COLUMNS = 4,
        BLOOD_ATLAS_ROWS = 5,
        BLOOD_TREAD_TILE = 16,
        BLOOD_DECAL_REFRESH = 0.5,
        BLOOD_DECAL_TONE = 0.8;
      const bloodAtlasCanvas = document.createElement('canvas');
      bloodAtlasCanvas.width = 128 * BLOOD_ATLAS_COLUMNS;
      bloodAtlasCanvas.height = 128 * BLOOD_ATLAS_ROWS;
      {
        const g = bloodAtlasCanvas.getContext('2d');
        for (let i = 0; i < BLOOD_VARIANTS; i++) g.drawImage(bloodStamp(i), (i % BLOOD_ATLAS_COLUMNS) * 128, Math.floor(i / BLOOD_ATLAS_COLUMNS) * 128);
        // The tread a bloodied tyre prints (physics-knockdowns.js tracks), stretched over its quad.
        const tx = (BLOOD_TREAD_TILE % BLOOD_ATLAS_COLUMNS) * 128,
          ty = Math.floor(BLOOD_TREAD_TILE / BLOOD_ATLAS_COLUMNS) * 128;
        g.fillStyle = '#78101c';
        g.fillRect(tx, ty + 8, 128, 112);
        g.clearRect(tx, ty + 56, 128, 16);
        for (let x = 0; x < 128; x += 14) g.clearRect(tx + x, ty, 4, 128);
      }
      const bloodAtlas = new Three.CanvasTexture(bloodAtlasCanvas);
      bloodAtlas.colorSpace = Three.SRGBColorSpace;
      bloodAtlas.anisotropy = 4;
      // On the GPU from the start (the first wound must not upload it), its canvas then freed.
      renderer.initTexture(bloodAtlas);
      bakedCanvases.push(bloodAtlas);
      const bloodDecalMaterial = new Three.MeshStandardMaterial({
        map: bloodAtlas,
        color: '#ffffff',
        // Satin, not a mirror: at roughness 0.27 a pool on the sun's mirror angle turned pale pink-white.
        roughness: 0.62,
        envMapIntensity: 0.5,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      bloodDecalMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float aBloodTile;\nattribute float aBloodAlpha;\nvarying float vBloodAlpha;')
          .replace(
            '#include <uv_vertex>',
            `#include <uv_vertex>
            {
              float col = mod( aBloodTile, ${BLOOD_ATLAS_COLUMNS.toFixed(1)} );
              float row = floor( aBloodTile / ${BLOOD_ATLAS_COLUMNS.toFixed(1)} );
              vMapUv = vMapUv * vec2( ${(1 / BLOOD_ATLAS_COLUMNS).toFixed(4)}, ${(1 / BLOOD_ATLAS_ROWS).toFixed(4)} ) + vec2( col * ${(1 / BLOOD_ATLAS_COLUMNS).toFixed(4)}, 1.0 - ( row + 1.0 ) * ${(1 / BLOOD_ATLAS_ROWS).toFixed(4)} );
              vBloodAlpha = aBloodAlpha;
            }`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vBloodAlpha;')
          .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vBloodAlpha;');
      };
      bloodDecalMaterial.customProgramCacheKey = () => 'blood-decals';
      const bloodDecalGeometry = new Three.PlaneGeometry(1, 1),
        bloodDecalTiles = new Three.InstancedBufferAttribute(new Float32Array(BLOOD_LIMIT), 1),
        bloodDecalAlphas = new Three.InstancedBufferAttribute(new Float32Array(BLOOD_LIMIT), 1);
      bloodDecalTiles.setUsage(Three.DynamicDrawUsage);
      bloodDecalAlphas.setUsage(Three.DynamicDrawUsage);
      bloodDecalGeometry.setAttribute('aBloodTile', bloodDecalTiles);
      bloodDecalGeometry.setAttribute('aBloodAlpha', bloodDecalAlphas);
      const bloodDecals = new Three.InstancedMesh(bloodDecalGeometry, bloodDecalMaterial, BLOOD_LIMIT);
      bloodDecals.instanceMatrix.setUsage(Three.DynamicDrawUsage);
      bloodDecals.setColorAt(0, new Three.Color('#ffffff'));
      bloodDecals.instanceColor.setUsage(Three.DynamicDrawUsage);
      bloodDecals.count = 0;
      bloodDecals.frustumCulled = false;
      bloodDecals.receiveShadow = true;
      bloodDecals.renderOrder = 3;
      bloodDecals.name = 'blood decals';
      bloodDecals.userData.blood = true;
      scene.add(bloodDecals);
      const bloodDecalState = { first: null, length: -1, last: null, refreshAt: 0, drawn: 0, writes: 0 };
      /* Rewrite the instances when something changed (BLOOD DECALS). */
      function updateBloodDecals() {
        const list = bloodPools,
          n = bloodOn ? Math.min(list.length, BLOOD_LIMIT) : 0,
          st = bloodDecalState;
        let dirty = n !== st.length || list[0] !== st.first || list[n - 1] !== st.last || gameTime >= st.refreshAt;
        if (!dirty)
          for (let i = n - 1; i >= 0; i--) {
            const b = list[i];
            if (b.rMax && b.vol < b.rMax * b.rMax * 0.998) {
              dirty = true;
              break;
            }
          }
        if (!dirty) return;
        st.length = n;
        st.first = list[0];
        st.last = list[n - 1];
        st.refreshAt = gameTime + BLOOD_DECAL_REFRESH;
        st.writes++;
        const m = bloodDecals.instanceMatrix.array,
          c = bloodDecals.instanceColor.array,
          tiles = bloodDecalTiles.array,
          alphas = bloodDecalAlphas.array;
        for (let i = 0; i < n; i++) {
          const b = list[i],
            o = i * 16;
          if (b.wall) {
            // Standing on the face: x along the wall (so x cross up is the face's normal), y up, z out of it.
            const s = 2.5 * b.r,
              roll = b.a || 0,
              cr = Math.cos(roll),
              sr = Math.sin(roll),
              tx = b.ny,
              tz = -b.nx,
              lift = wallOffset(b.building, 0, b.surface) + 0.04;
            m[o] = tx * cr * s;
            m[o + 1] = sr * s;
            m[o + 2] = tz * cr * s;
            m[o + 3] = 0;
            m[o + 4] = -tx * sr * s;
            m[o + 5] = cr * s;
            m[o + 6] = -tz * sr * s;
            m[o + 7] = 0;
            m[o + 8] = b.nx;
            m[o + 9] = 0;
            m[o + 10] = b.ny;
            m[o + 11] = 0;
            m[o + 12] = b.x + b.nx * lift;
            m[o + 13] = b.surface;
            m[o + 14] = b.y + b.ny * lift;
            m[o + 15] = 1;
          } else {
            // Flat on the ground: x along the decal's heading, y across it, z up.
            const along = b.track ? b.r * 2.6 : b.r * 2.5 * (b.stretch || 1),
              across = b.track ? b.r * 0.46 : b.r * 2.5,
              ca = Math.cos(b.a),
              sa = Math.sin(b.a);
            m[o] = ca * along;
            m[o + 1] = 0;
            m[o + 2] = sa * along;
            m[o + 3] = 0;
            m[o + 4] = sa * across;
            m[o + 5] = 0;
            m[o + 6] = -ca * across;
            m[o + 7] = 0;
            m[o + 8] = 0;
            m[o + 9] = 1;
            m[o + 10] = 0;
            m[o + 11] = 0;
            m[o + 12] = b.x;
            m[o + 13] = (b.surface || 0) + 0.32;
            m[o + 14] = b.y;
            m[o + 15] = 1;
          }
          // Wet blood darkens as it dries over the first minutes (and soaks into the street: never candy red).
          const dry = BLOOD_DECAL_TONE * (1 - clamp((gameTime - b.created - 20) / 150, 0, 1) * 0.35);
          c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = dry;
          tiles[i] = b.track ? BLOOD_TREAD_TILE : b.variant || 0;
          alphas[i] = bloodFade(b);
        }
        bloodDecals.count = n;
        st.drawn = n;
        if (!n) return;
        bloodDecals.instanceMatrix.clearUpdateRanges();
        bloodDecals.instanceMatrix.addUpdateRange(0, n * 16);
        bloodDecals.instanceMatrix.needsUpdate = true;
        bloodDecals.instanceColor.clearUpdateRanges();
        bloodDecals.instanceColor.addUpdateRange(0, n * 3);
        bloodDecals.instanceColor.needsUpdate = true;
        bloodDecalTiles.clearUpdateRanges();
        bloodDecalTiles.addUpdateRange(0, n);
        bloodDecalTiles.needsUpdate = true;
        bloodDecalAlphas.clearUpdateRanges();
        bloodDecalAlphas.addUpdateRange(0, n);
        bloodDecalAlphas.needsUpdate = true;
      }
      /* Console (bloodDecalReport via the renderer api): decals drawn, rewrites so far, one draw call. */
      function bloodDecalReport() {
        return { drawn: bloodDecalState.drawn, writes: bloodDecalState.writes, capacity: BLOOD_LIMIT, drawCalls: bloodDecals.count ? 1 : 0 };
      }
