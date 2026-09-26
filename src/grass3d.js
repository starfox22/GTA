      // BEGIN SUBSYSTEM: src/grass3d.js — Grass tufts
      /**
       * Grass tufts
       * Source: src/grass3d.js
       * Scope: createCityRenderer() closure (included after surfaces3d.js).
       *
       * On HIGH and ULTRA, zoomed in past the default street view, the lawns grow
       * real blades: one instanced draw of tufts (five tapered blades each) on a
       * 2.6-unit grid round the view centre. The grid is anchored to the world
       * (it moves a whole cell at a time), each tuft's place, turn and height come
       * from a hash of its cell, and the vertex shader reads the ground sheet
       * under it: off a lawn (or on a path, a bed, a road) a tuft collapses to
       * nothing, on it the blades take the lawn's colour, darker at the root and
       * sunlit at the tips, and sway with the wind. They fade in with the zoom
       * and out towards the edge of the grid, cast no shadows and receive the
       * sun's, lamp light and headlights like the ground.
       */
      const TUFT_COLS = 168,
        TUFT_ROWS = 128,
        TUFT_SPACING = 2.6,
        TUFT_BLADES = 5,
        // The street zoom where they start to show and where they are full.
        TUFT_ZOOM_IN = 1.75,
        TUFT_ZOOM_FULL = 2.3;
      const tuftUniforms = {
        tuftSheet: { value: groundTx },
        tuftRect: { value: new Three.Vector4(CITY_LEFT, CITY_TOP, 1 / CITY_WIDTH, 1 / CITY_HEIGHT) },
        tuftOrigin: { value: new Three.Vector2() },
        tuftCenter: { value: new Three.Vector2() },
        tuftReach: { value: new Three.Vector2((TUFT_COLS * TUFT_SPACING) / 2, (TUFT_ROWS * TUFT_SPACING) / 2) },
        tuftFade: { value: 0 },
      };
      const tuftMesh = (() => {
        const pos = [],
          tip = [],
          nrm = [];
        let seed = 5;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let b = 0; b < TUFT_BLADES; b++) {
          const a = rnd() * TAU,
            r = Math.sqrt(rnd()) * 0.6,
            bx = Math.cos(a) * r,
            bz = Math.sin(a) * r,
            facing = rnd() * TAU,
            w = 0.22 + rnd() * 0.16,
            height = 0.8 + rnd() * 0.9,
            lean = 0.2 + rnd() * 0.5,
            la = a + (rnd() - 0.5);
          const fx = Math.cos(facing) * w,
            fz = Math.sin(facing) * w;
          pos.push(bx - fx, 0, bz - fz, bx + fx, 0, bz + fz, bx + Math.cos(la) * lean, height, bz + Math.sin(la) * lean);
          tip.push(0, 0, 1);
          nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
        }
        const g = new Three.InstancedBufferGeometry();
        g.setAttribute('position', new Three.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new Three.Float32BufferAttribute(nrm, 3));
        g.setAttribute('tuftTip', new Three.Float32BufferAttribute(tip, 1));
        g.instanceCount = TUFT_COLS * TUFT_ROWS;
        const m = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0, side: Three.DoubleSide });
        m.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          Object.assign(shader.uniforms, tuftUniforms, surfaceUniforms);
          shader.vertexShader = shader.vertexShader
            .replace(
              '#include <common>',
              `#include <common>
              uniform sampler2D tuftSheet;
              uniform vec4 tuftRect;
              uniform vec2 tuftOrigin, tuftCenter, tuftReach;
              uniform float tuftFade, cityWindTime, cityWindAmp;
              attribute float tuftTip;
              varying vec3 vTuftColour;
              float tuftHash( vec2 p ) {
                vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
                p3 += dot( p3, p3.yzx + 33.33 );
                return fract( ( p3.x + p3.y ) * p3.z );
              }`,
            )
            .replace(
              '#include <begin_vertex>',
              `vec3 transformed;
              {
                int id = gl_InstanceID;
                int row = id / ${TUFT_COLS};
                vec2 cell = tuftOrigin + vec2( float( id - row * ${TUFT_COLS} ), float( row ) );
                float h1 = tuftHash( cell ), h2 = tuftHash( cell + 19.1 ), h3 = tuftHash( cell + 7.7 );
                vec2 world = ( cell + 0.15 + 0.7 * vec2( h1, h2 ) ) * ${TUFT_SPACING.toFixed(2)};
                vec2 uv = ( world - tuftRect.xy ) * tuftRect.zw;
                uv.y = 1.0 - uv.y;
                vec3 c = textureLod( tuftSheet, uv, 0.0 ).rgb;
                float lumT = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ), green = c.g - max( c.r, c.b );
                float grass = smoothstep( 0.12, 0.22, green / max( lumT, 0.02 ) ) * smoothstep( 0.004, 0.014, green );
                // Not in the beds (pink and violet) nor off the sheet.
                grass *= 1.0 - smoothstep( 0.01, 0.03, c.r - c.g );
                if ( uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ) grass = 0.0;
                vec2 e = abs( world - tuftCenter ) / tuftReach;
                float edge = 1.0 - smoothstep( 0.7, 1.0, max( e.x, e.y ) );
                float s = grass * edge * tuftFade * step( 0.1, h3 ) * ( 0.6 + 0.8 * h3 );
                float ang = h1 * 6.2832, ca = cos( ang ), sa = sin( ang );
                vec3 p = position;
                p.xz = mat2( ca, sa, -sa, ca ) * p.xz;
                p *= step( 0.02, s );
                p.y *= s;
                float phase = cityWindTime * 2.1 + world.x * 0.13 + world.y * 0.11;
                p.xz += vec2( sin( phase ), cos( phase * 0.8 ) ) * tuftTip * ( 0.12 + 0.3 * cityWindAmp ) * s;
                transformed = p + vec3( world.x, 0.06, world.y );
                // The lawn's colour as the ground shader grades it, darker at the
                // root, sunlit and a little straw-coloured at the tips.
                vec3 col = c * mix( 0.5, 1.25, tuftTip ) * ( 0.84 + 0.32 * h2 );
                col = max( mix( vec3( dot( col, vec3( 0.2126, 0.7152, 0.0722 ) ) ), col, 1.06 ) * vec3( 0.85, 0.9, 0.84 ), 0.0 );
                vTuftColour = mix( col, col * vec3( 1.12, 1.05, 0.78 ), tuftTip * 0.4 * h1 );
              }`,
            );
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vTuftColour;')
            .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vTuftColour;')
            // Blades light like the lawn under them, whichever side faces the camera.
            .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );');
        };
        m.customProgramCacheKey = () => 'city-grass-tufts';
        const mesh = new Three.Mesh(g, m);
        mesh.name = 'grass tufts';
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.visible = false;
        scene.add(mesh);
        return mesh;
      })();
      // The sheets the tufts can grow on: the city's and Monarch Isle's.
      const monarchTileTexture = countyTileTextures.find((e) => e.tile.x === MONARCH_TILE.x && e.tile.y === MONARCH_TILE.y);
      function updateGrassTufts() {
        const tier = (activeTier || graphicsTier()).name,
          fade = clamp((viewZoom - TUFT_ZOOM_IN) / (TUFT_ZOOM_FULL - TUFT_ZOOM_IN), 0, 1),
          cx = viewCenter.x,
          cz = viewCenter.y;
        let sheet = null;
        if (cx > CITY_LEFT && cx < CITY_RIGHT && cz > CITY_TOP && cz < CITY_SIZE) sheet = { tx: groundTx, x: CITY_LEFT, y: CITY_TOP, w: CITY_WIDTH, h: CITY_HEIGHT };
        else if (monarchTileTexture) {
          const t = MONARCH_TILE;
          if (cx > t.x && cx < t.x + t.w && cz > t.y && cz < t.y + t.h) sheet = { tx: monarchTileTexture.texture, x: t.x, y: t.y, w: t.w, h: t.h };
        }
        tuftMesh.visible = !!sheet && fade > 0 && !flightViewActive && (tier === 'HIGH' || tier === 'ULTRA');
        if (!tuftMesh.visible) return;
        tuftUniforms.tuftFade.value = fade;
        tuftUniforms.tuftSheet.value = sheet.tx;
        tuftUniforms.tuftRect.value.set(sheet.x, sheet.y, 1 / sheet.w, 1 / sheet.h);
        tuftUniforms.tuftCenter.value.set(cx, cz);
        tuftUniforms.tuftOrigin.value.set(Math.floor(cx / TUFT_SPACING) - TUFT_COLS / 2, Math.floor(cz / TUFT_SPACING) - TUFT_ROWS / 2);
      }
      // END SUBSYSTEM: src/grass3d.js
