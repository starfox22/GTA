      // Blood decals in 3D: every pool, spatter, drop and tyre track on the ground and every splash on a wall
      // (blood.js bloodPools) in ONE instanced draw, its stamps in one atlas. Renderer only: it reads the decals.
      /**
       * BLOOD DECALS
       * One InstancedMesh of BLOOD_LIMIT unit quads (it was one Mesh and one draw call per decal). The atlas is
       * 4 x 5 tiles of 128 px: the sixteen bloodStamp variants (pools, spatters, drops, wall splashes) and the
       * tyre track's tread. Per instance: the matrix (ground: flat, turned to `a`, `bloodDecalScale`; wall:
       * standing on the face `nx, ny` at height `surface`, a little off it by damage3d-decals.js wallOffset,
       * the stamp's down down the wall), `aBloodTile` and `aBloodLook` (x `bloodFade`, y how dry, z how far
       * rain has thinned it: blood.js `wash`). Never emissive, lit and shadowed like the street; transparent at
       * renderOrder 3, no depth write, pulled forward by polygon offset. The buffers are rewritten only when the
       * list changed, a pool is still spreading, or every BLOOD_DECAL_REFRESH s (fades and drying), and only the
       * used range is uploaded.
       *
       * THE LOOK (one program for every state: the state is per instance). Fresh blood is wet: deep dark red and
       * glossy (roughness 0.2), its specular held to a tenth (BLOOD_WET_SPECULAR), softly capped and half
       * tinted by the blood, so a low sun at a grazing angle gives a small glint, never the broad orange-brown
       * wash a plain satin or gloss film took on (the sun's specular, not the albedo, made it). It dries over
       * minutes (BLOOD_DRY_START, BLOOD_DRY_SECONDS) to a darker matte brown-red, the thin film first: the
       * stamp's own darkness is its thickness (near black in a pool's middle, lighter at its rim and in fine
       * drops), so rims and spatter dry before the middle of a pool. Rain thins it: lighter, pinker, fainter.
       */
      const BLOOD_ATLAS_COLUMNS = 4,
        BLOOD_ATLAS_ROWS = 5,
        BLOOD_TREAD_TILE = 16,
        BLOOD_DECAL_REFRESH = 0.5,
        BLOOD_DRY_START = 15,
        BLOOD_DRY_SECONDS = 180,
        BLOOD_WET_SPECULAR = 0.1;
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
        // The roughness and the specular are the shader's (THE LOOK): wet glossy, dry matte.
        roughness: 0.6,
        envMapIntensity: 0.5,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      bloodDecalMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float aBloodTile;\nattribute vec3 aBloodLook;\nvarying vec3 vBloodLook;')
          .replace(
            '#include <uv_vertex>',
            `#include <uv_vertex>
            {
              float col = mod( aBloodTile, ${BLOOD_ATLAS_COLUMNS.toFixed(1)} );
              float row = floor( aBloodTile / ${BLOOD_ATLAS_COLUMNS.toFixed(1)} );
              vMapUv = vMapUv * vec2( ${(1 / BLOOD_ATLAS_COLUMNS).toFixed(4)}, ${(1 / BLOOD_ATLAS_ROWS).toFixed(4)} ) + vec2( col * ${(1 / BLOOD_ATLAS_COLUMNS).toFixed(4)}, 1.0 - ( row + 1.0 ) * ${(1 / BLOOD_ATLAS_ROWS).toFixed(4)} );
              vBloodLook = aBloodLook;
            }`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vBloodLook;')
          .replace(
            '#include <map_fragment>',
            `#include <map_fragment>
            // Thickness from the stamp's darkness: the thin film (rims, fine drops) dries first.
            float bloodThin = smoothstep( 0.025, 0.15, diffuseColor.r );
            float bloodDry = clamp( vBloodLook.y * ( 0.55 + 1.1 * bloodThin ), 0.0, 1.0 );
            float bloodWash = vBloodLook.z;
            vec3 bloodColor = diffuseColor.rgb * 0.8;
            bloodColor = mix( bloodColor, bloodColor * vec3( 0.6, 0.42, 0.34 ) + vec3( 0.005, 0.0015, 0.001 ), bloodDry );
            bloodColor = mix( bloodColor, bloodColor * vec3( 1.45, 1.12, 1.12 ), bloodWash * 0.6 );
            diffuseColor.rgb = bloodColor;
            diffuseColor.a *= vBloodLook.x * ( 1.0 - 0.45 * bloodWash );`,
          )
          .replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
            roughnessFactor = mix( mix( 0.2, 0.86, bloodDry ), 0.24, bloodWash );`,
          )
          .replace(
            '#include <lights_fragment_end>',
            `#include <lights_fragment_end>
            {
              // A wet sheen, not a glare: scaled down, softly capped and half taken by the blood's own red, so a
              // low sun at a grazing angle lights a small glint and the pool stays deep red (THE LOOK).
              float bloodSpecular = mix( ${BLOOD_WET_SPECULAR.toFixed(2)}, 0.02, bloodDry * ( 1.0 - bloodWash ) );
              vec3 bloodGlint = reflectedLight.directSpecular * bloodSpecular;
              bloodGlint = bloodGlint / ( 1.0 + bloodGlint * 4.0 );
              reflectedLight.directSpecular = bloodGlint * mix( vec3( 1.0 ), vec3( 1.0, 0.35, 0.3 ), 0.5 );
              reflectedLight.indirectSpecular *= bloodSpecular * 1.4;
            }`,
          );
      };
      bloodDecalMaterial.customProgramCacheKey = () => 'blood-decals';
      const bloodDecalGeometry = new Three.PlaneGeometry(1, 1),
        bloodDecalTiles = new Three.InstancedBufferAttribute(new Float32Array(BLOOD_LIMIT), 1),
        bloodDecalLooks = new Three.InstancedBufferAttribute(new Float32Array(BLOOD_LIMIT * 3), 3);
      bloodDecalTiles.setUsage(Three.DynamicDrawUsage);
      bloodDecalLooks.setUsage(Three.DynamicDrawUsage);
      bloodDecalGeometry.setAttribute('aBloodTile', bloodDecalTiles);
      bloodDecalGeometry.setAttribute('aBloodLook', bloodDecalLooks);
      const bloodDecals = new Three.InstancedMesh(bloodDecalGeometry, bloodDecalMaterial, BLOOD_LIMIT);
      bloodDecals.instanceMatrix.setUsage(Three.DynamicDrawUsage);
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

          tiles = bloodDecalTiles.array,
          looks = bloodDecalLooks.array;
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
          // THE LOOK: the fade, how dry (over minutes), how far rain has thinned it.
          tiles[i] = b.track ? BLOOD_TREAD_TILE : b.variant || 0;
          looks[i * 3] = bloodFade(b);
          looks[i * 3 + 1] = clamp((gameTime - b.created - BLOOD_DRY_START) / BLOOD_DRY_SECONDS, 0, 1);
          looks[i * 3 + 2] = b.wash || 0;
        }
        bloodDecals.count = n;
        st.drawn = n;
        if (!n) return;
        bloodDecals.instanceMatrix.clearUpdateRanges();
        bloodDecals.instanceMatrix.addUpdateRange(0, n * 16);
        bloodDecals.instanceMatrix.needsUpdate = true;
        bloodDecalTiles.clearUpdateRanges();
        bloodDecalTiles.addUpdateRange(0, n);
        bloodDecalTiles.needsUpdate = true;
        bloodDecalLooks.clearUpdateRanges();
        bloodDecalLooks.addUpdateRange(0, n * 3);
        bloodDecalLooks.needsUpdate = true;
      }
      /* Console (bloodDecalReport via the renderer api): decals drawn, rewrites so far, one draw call. */
      function bloodDecalReport() {
        return { drawn: bloodDecalState.drawn, writes: bloodDecalState.writes, capacity: BLOOD_LIMIT, drawCalls: bloodDecals.count ? 1 : 0 };
      }
