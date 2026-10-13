      // Off-road 3D mud on vehicles, body plans, liveries, shapes, tubes, tyres and rims.
      // ---- TRAIL MUD maps (assets/trail-mud.webp, tools/trail_mud.py; Poly Haven and Kenney, CC0) -------
      /*
       * One sheet cut into three textures: the wet mud's colour (sRGB, tiling), its detail (normal X and Y in
       * R and G, OpenGL convention; roughness in B; tiling) and the sprite cells (MUD_SPRITE_CELLS: coverage in
       * R, a domed normal's X and Y in G and B). `mean` is the colour map's linear mean: shaders use colour /
       * mean as a detail ratio, so a build without the sheet (neutral 1-pixel maps) keeps the plain tints.
       */
      const trailMud = (() => {
        const image = visualAssets.trailMud,
          ready = !!(image && image.width >= 64 && image.height === image.width),
          half = ready ? image.width / 2 : 1,
          mean = new Three.Vector3(0.5, 0.5, 0.5);
        const cut = (sx, sy, w, h, fallback, colour, repeat) => {
          let t;
          if (ready) {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(image, sx, sy, w, h, 0, 0, w, h);
            t = new Three.CanvasTexture(canvas);
            t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          } else {
            t = new Three.DataTexture(new Uint8Array(fallback), 1, 1);
            t.needsUpdate = true;
          }
          t.colorSpace = colour ? Three.SRGBColorSpace : Three.NoColorSpace;
          t.wrapS = t.wrapT = repeat ? Three.RepeatWrapping : Three.ClampToEdgeWrapping;
          t.magFilter = Three.LinearFilter;
          t.minFilter = ready ? Three.LinearMipmapLinearFilter : Three.LinearFilter;
          t.generateMipmaps = ready;
          return t;
        };
        const colour = cut(0, 0, half, half, [128, 128, 128, 255], true, true),
          detail = cut(half, 0, half, half, [128, 128, 160, 255], false, true),
          sprites = cut(0, half, half * 2, half, [255, 128, 128, 255], false, false);
        if (ready) {
          // The colour map's linear mean (a 4 x 4 reduction of the cut).
          const small = document.createElement('canvas');
          small.width = small.height = 4;
          const g = small.getContext('2d', { willReadFrequently: true });
          g.drawImage(colour.image, 0, 0, 4, 4);
          const px = g.getImageData(0, 0, 4, 4).data,
            linear = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
          let r = 0,
            gr = 0,
            b = 0;
          for (let i = 0; i < 64; i += 4) {
            r += linear(px[i]);
            gr += linear(px[i + 1]);
            b += linear(px[i + 2]);
          }
          mean.set(r / 16, gr / 16, b / 16);
        } else {
          // The stand-in's 128 grey, linear.
          mean.setScalar(0.2158);
        }
        for (const t of [colour, detail, sprites]) {
          // On the GPU from the start (the first muddy wheel must not upload them), the canvases then freed.
          renderer.initTexture(t);
          if (ready) bakedCanvases.push(t);
        }
        return { ready, colour, detail, sprites, mean, uniforms: { mudColorMap: { value: colour }, mudMean: { value: mean } } };
      })();
      // ---- Mud on a vehicle's materials ---------------------------------------------------
      const MUD_NOISE = `
        float mudHash( vec3 p ) {
          p = fract( p * 0.3183099 + 0.1 );
          p *= 17.0;
          return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
        }
        float mudNoise( vec3 x ) {
          vec3 i = floor( x ), f = fract( x );
          f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( mudHash( i ), mudHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( mudHash( i + vec3( 0.0, 1.0, 0.0 ) ), mudHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
                      mix( mix( mudHash( i + vec3( 0.0, 0.0, 1.0 ) ), mudHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( mudHash( i + vec3( 0.0, 1.0, 1.0 ) ), mudHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z );
        }`;
      // The mud photo (trailMud) on a surface, triplanar in the body's own space so it rides with the body: rgb its
      // colour over its mean (a detail ratio, 1 on average), a its relief (relative luminance, 0..1); and a bump from
      // a height's screen derivatives (three.js perturbNormalArb, which needs no tangents).
      const MUD_PHOTO = `
        vec4 mudPhoto( vec3 p, vec3 n ) {
          vec3 w = pow( abs( n ), vec3( 4.0 ) );
          w /= max( w.x + w.y + w.z, 1e-4 );
          vec3 c = texture2D( mudColorMap, p.zy ).rgb * w.x + texture2D( mudColorMap, p.xz ).rgb * w.y + texture2D( mudColorMap, p.xy ).rgb * w.z;
          float luma = dot( c, vec3( 0.3, 0.55, 0.15 ) ) / max( dot( mudMean, vec3( 0.3, 0.55, 0.15 ) ), 1e-4 );
          return vec4( c / max( mudMean, vec3( 1e-4 ) ), clamp( luma * 0.5, 0.0, 1.0 ) );
        }
        vec3 mudPerturb( vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir ) {
          vec3 vSigmaX = normalize( dFdx( surfPos ) );
          vec3 vSigmaY = normalize( dFdy( surfPos ) );
          vec3 R1 = cross( vSigmaY, surfNorm );
          vec3 R2 = cross( surfNorm, vSigmaX );
          float fDet = dot( vSigmaX, R1 ) * faceDir;
          vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
          return normalize( abs( fDet ) * surfNorm - vGrad );
        }`;
      function mudUniforms() {
        return { mudAmount: { value: 0 }, mudWet: { value: 1 }, mudBase: { value: new Three.Vector2(0, 16) } };
      }
      /*
       * Adds the mud layer to a lit material (chained after any patch it has): the mud photo (trailMud) thrown up
       * from the ground, a ragged line from the wheels up with streaks and flecks above it, its own relief (a bump
       * from the photo, deeper where thick), dark and glossy wet, pale and matt dry.
       * `tyre`: the whole tread and sidewall take it, whatever the height.
       */
      function vehicleMudPatch(material, uniforms, tyre = false) {
        const previous = material.onBeforeCompile,
          previousKey = material.customProgramCacheKey;
        material.onBeforeCompile = (shader, renderer) => {
          if (previous) previous.call(material, shader, renderer);
          Object.assign(shader.uniforms, uniforms, trailMud.uniforms);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vMudLocal;\nvarying vec3 vMudWorld;\nvarying float vMudUp;\nvarying vec3 vMudNormal;')
            .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvMudUp = normalize( mat3( modelMatrix ) * objectNormal ).y;\nvMudNormal = objectNormal;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMudLocal = transformed;\nvMudWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
          shader.fragmentShader = shader.fragmentShader
            .replace(
              '#include <common>',
              '#include <common>\nvarying vec3 vMudLocal;\nvarying vec3 vMudWorld;\nvarying float vMudUp;\nvarying vec3 vMudNormal;\nuniform float mudAmount;\nuniform float mudWet;\nuniform vec2 mudBase;\nuniform sampler2D mudColorMap;\nuniform vec3 mudMean;\n' +
                MUD_NOISE +
                MUD_PHOTO,
            )
            .replace(
              '#include <color_fragment>',
              `#include <color_fragment>
              float mudMask = 0.0;
              float mudGrain = 0.5;
              float mudRelief = 0.0;
              if ( mudAmount > 0.002 ) {
                float h = clamp( ( vMudWorld.y - mudBase.x ) / mudBase.y, 0.0, 1.5 );
                // The photo about 2.8 m a repeat (world units, 8 to the metre); large patches from the noise; streaks
                // thrown up and back off the wheels (noise stretched up the body); the photo's clods rag the edge.
                vec4 photo = mudPhoto( vMudLocal * 0.045, vMudNormal );
                float streak = mudNoise( vec3( vMudLocal.x * 0.32, vMudLocal.y * 0.05, vMudLocal.z * 0.9 ) );
                float mudBlotch = mudNoise( vMudLocal * 0.55 );
                mudGrain = mudBlotch * 0.45 + photo.a * 0.55;
                // The line's rag: mostly smooth noise (blotches), a little of the photo's clods (no salt and pepper).
                float rag = mudBlotch * 0.75 + photo.a * 0.25;
                float spray = ${tyre ? 'mudAmount * 2.6 - 0.35' : 'mudAmount * 2.2 - h * 1.5 - max( vMudUp, 0.0 ) * 0.3'} + ( rag - 0.5 ) * 1.15 + ( streak - 0.5 ) * 0.5;
                mudMask = smoothstep( 0.0, 0.12, spray );
                ${
                  tyre
                    ? ''
                    : `// Flecks above the line: round spatter (smooth noise blobs), fewer with height and on faces looking up.
                float blob = mudNoise( vMudLocal * 0.7 + 11.0 ) * 0.75 + mudNoise( vMudLocal * 2.1 + 5.0 ) * 0.25;
                float fleck = smoothstep( 0.66, 0.72, blob * 0.85 + photo.a * 0.15 ) * smoothstep( -0.7, -0.05, spray ) * ( 1.0 - max( vMudUp, 0.0 ) * 0.75 ) * step( 0.05, mudAmount );
                mudMask = max( mudMask, fleck * 0.92 );`
                }
                // Thick well inside the line: deeper relief.
                float thick = clamp( spray * 2.5, 0.0, 1.0 );
                // The relief fades as the photo is minified (past ~1 texel a pixel a bump only sparkles).
                float mudTexels = length( fwidth( vMudLocal * 0.045 ) ) * 512.0;
                mudRelief = mudMask * ( 0.35 + 0.65 * thick ) * photo.a * clamp( 1.6 - mudTexels * 0.6, 0.0, 1.0 );
                vec3 mudColor = mix( vec3( 0.3, 0.24, 0.17 ), vec3( 0.07, 0.048, 0.03 ), mudWet ) * mix( vec3( 1.0 ), clamp( photo.rgb, vec3( 0.5 ), vec3( 1.6 ) ), 0.7 ) * ( 0.84 + 0.32 * mudGrain );
                diffuseColor.rgb = mix( diffuseColor.rgb, mudColor, mudMask );
              }`,
            )
            .replace(
              '#include <roughnessmap_fragment>',
              '#include <roughnessmap_fragment>\nroughnessFactor = mix( roughnessFactor, clamp( mix( 0.96, 0.3, mudWet ) + ( 0.5 - mudRelief ) * 0.22 * mudWet + ( mudGrain - 0.5 ) * 0.1, 0.12, 1.0 ), mudMask );',
            )
            .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - mudMask;')
            .replace(
              '#include <normal_fragment_maps>',
              '#include <normal_fragment_maps>\nif ( mudAmount > 0.002 ) normal = mudPerturb( - vViewPosition, normal, vec2( dFdx( mudRelief ), dFdy( mudRelief ) ), faceDirection );',
            )
            .replace(
              '#include <lights_physical_fragment>',
              '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - mudMask;\n#endif',
            );
        };
        material.customProgramCacheKey = () => (previousKey ? previousKey.call(material) : '') + (tyre ? '|mud-tyre' : '|mud');
        material.needsUpdate = true;
        return material;
      }
      // Any vehicle model: the mud uniforms from the vehicle, the body's ground and roof.
      function applyVehicleMud(c, m) {
        if (!m.mudUniforms) {
          if (!m.paint || !(m.paint.isMeshStandardMaterial || m.paint.isMeshPhysicalMaterial)) return;
          m.mudUniforms = mudUniforms();
          vehicleMudPatch(m.paint, m.mudUniforms);
        }
        const u = m.mudUniforms;
        u.mudAmount.value = c.mudCoat;
        u.mudWet.value = c.mudWet;
        u.mudBase.value.set(m.group.position.y, m.dims?.roof || 16);
      }
      // ---- Bodies ------------------------------------------------------------------------------
      /*
       * The police body format (police3d.js): heights in world units at real scale
       * (8 to the metre), lengths along the truck as fractions of its length.
       * `bodyW` is the body's width as a share of the collider's (the rest is
       * flares, mirrors and tyres); `wheel.xs` the axles; `hood` the hood panel's
       * height and width share; `bed` an open pickup bed [front x, floor, wall top].
       */
      const OFFROAD_BODIES = {
        series: {
          name: 'club-series',
          bodyW: 0.97,
          yb: 3.7,
          h: 9.6,
          section: [[0, 0.93], [0.1, 0.99], [0.3, 1], [0.85, 1], [0.95, 0.98], [1, 0.9], [1, 0.45], [1, 0]],
          profile: [[-0.5, 0.97, 9.6], [-0.49, 1, 9.8], [0.22, 1, 9.8], [0.24, 0.97, 9.6], [0.47, 0.95, 9.5], [0.5, 0.9, 9.0]],
          glass: { base: 9.95, roof: 15.4, xf: 0.235, xb: -0.492, rf: 0.222, rb: -0.49, wb: 0.44, wt: 0.395, bow: 0.004, bulge: 0.1, arch: 0.1, pillars: [[0.64, 1.0, 'paint'], [0.3, 1.0, 'paint'], [0, 1.3, 'paint']] },
          wheel: { r: 3.25, width: 1.85, xs: [0.31, -0.3], inset: 0.2, style: 'steel', rim: '#e5e2d6', tread: 'mt' },
          hood: [9.65, 0.66],
          head: [0.496, 7.9, 0.3, 0.3, 1.4, 1.4, 'round'],
          tail: [-0.5, 6.2, 0.43, 0.3, 1.2, 0.07],
          bumpers: [[0.53, 4.6, 1.2, 1.4, 0.98], [-0.52, 4.8, 1.0, 1.3, 0.9]],
        },
        crawler: {
          name: 'club-crawler',
          bodyW: 0.84,
          yb: 4.7,
          h: 11.2,
          section: [[0, 0.93], [0.1, 0.98], [0.3, 1], [0.88, 1], [0.96, 0.97], [1, 0.88], [1, 0.4], [1, 0]],
          profile: [[-0.5, 0.97, 11.0], [-0.49, 1, 11.2], [0.2, 1, 11.2], [0.23, 0.97, 11.7], [0.46, 0.94, 11.6], [0.5, 0.86, 10.8]],
          glass: { base: 11.7, roof: 16.2, xf: 0.215, xb: -0.44, rf: 0.2, rb: -0.44, wb: 0.44, wt: 0.44, bow: 0, bulge: 0, arch: 0, pillars: [] },
          open: true,
          wheel: { r: 3.76, width: 3.1, xs: [0.335, -0.3], inset: 0.1, style: 'beadlock', rim: '#8c6a3c', tread: 'mt' },
          hood: [11.7, 0.7],
          head: [0.505, 10.0, 0.3, 0.3, 1.5, 1.5, 'round'],
          tail: [-0.503, 8.7, 0.44, 0.3, 1.4, 0.06],
          bumpers: [[0.53, 6.6, 1.6, 2.2, 0.9], [-0.52, 6.6, 1.4, 2.0, 0.88]],
        },
        bronco: {
          name: 'club-bronco',
          bodyW: 0.94,
          yb: 4.2,
          h: 10.7,
          section: [[0, 0.93], [0.1, 0.99], [0.3, 1], [0.86, 1], [0.95, 0.975], [1, 0.9], [1, 0.4], [1, 0]],
          profile: [[-0.5, 0.97, 10.5], [-0.49, 1, 10.7], [0.2, 1, 10.7], [0.24, 0.98, 10.6], [0.46, 0.96, 10.5], [0.5, 0.92, 9.8]],
          glass: { base: 10.9, roof: 15.3, xf: 0.19, xb: -0.488, rf: 0.155, rb: -0.482, wb: 0.46, wt: 0.44, bow: 0.004, bulge: 0.2, arch: 0.18, pillars: [[0.55, 1.3, 'paint'], [0, 1.5, 'paint']] },
          wheel: { r: 3.55, width: 2.8, xs: [0.31, -0.29], inset: 0.15, style: 'spoke', rim: '#c9ccce', tread: 'at', letters: true },
          hood: [10.75, 0.72],
          head: [0.503, 8.9, 0.34, 0.3, 1.45, 1.45, 'round'],
          tail: [-0.5, 7.2, 0.44, 0.3, 1.6, 0.07],
          bumpers: [[0.52, 5.5, 1.0, 1.3, 0.98], [-0.515, 5.6, 1.0, 1.3, 0.98]],
        },
        expedition: {
          name: 'club-expedition',
          bodyW: 0.94,
          yb: 3.2,
          h: 10.2,
          section: [[0, 0.9], [0.1, 0.97], [0.25, 1], [0.8, 1], [0.92, 0.985], [0.97, 0.95], [1, 0.86], [1, 0.4], [1, 0]],
          profile: [[-0.5, 0.96, 10.0], [-0.49, 1, 10.2], [0.21, 1, 10.2], [0.26, 0.985, 10.1], [0.44, 0.965, 10.0], [0.49, 0.94, 9.6], [0.5, 0.9, 8.8]],
          glass: { base: 10.35, roof: 15.4, xf: 0.215, xb: -0.49, rf: 0.165, rb: -0.485, wb: 0.47, wt: 0.445, bow: 0.004, bulge: 0.15, arch: 0.12, pillars: [[0.64, 1.0, 'paint'], [0.34, 1.0, 'paint'], [0, 1.6, 'paint']] },
          wheel: { r: 3.4, width: 2.55, xs: [0.3, -0.27], inset: 0.15, style: 'steel', rim: '#26282b', tread: 'mt' },
          hood: [10.1, 0.72],
          head: [0.5, 8.4, 0.33, 0.3, 1.35, 1.35, 'round'],
          tail: [-0.502, 7.6, 0.45, 0.3, 2.2, 0.06],
          bumpers: [[0.53, 5.0, 1.8, 2.0, 0.96], [-0.52, 5.0, 1.2, 1.6, 0.94]],
        },
        hilux: {
          name: 'club-hilux',
          bodyW: 0.93,
          yb: 3.6,
          h: 10.6,
          section: [[0, 0.88], [0.12, 0.96], [0.3, 1], [0.78, 1], [0.9, 0.98], [0.96, 0.93], [1, 0.8], [1, 0.3], [1, 0]],
          profile: [[-0.5, 0.97, 8.2], [-0.49, 1, 8.4], [-0.16, 1, 8.4], [-0.145, 1, 10.6], [0.2, 1, 10.6], [0.26, 0.99, 10.45], [0.42, 0.97, 10.1], [0.48, 0.94, 9.6], [0.5, 0.88, 8.8]],
          glass: { base: 10.8, roof: 14.9, xf: 0.21, xb: -0.132, rf: 0.065, rb: -0.105, wb: 0.45, wt: 0.395, bow: 0.012, bulge: 0.6, arch: 0.28, pillars: [[0.52, 1.1, 'black'], [0, 1.9, 'paint']] },
          bed: [-0.15, 8.4, 10.8],
          wheel: { r: 3.55, width: 2.9, xs: [0.31, -0.29], inset: 0.1, style: 'spoke', rim: '#1b1c1e', tread: 'at' },
          hood: [10.35, 0.72],
          head: [0.48, 9.3, 0.34, 0.8, 0.9, 0.24],
          tail: [-0.503, 8.3, 0.45, 0.3, 2.6, 0.07],
          bumpers: [[0.52, 5.4, 1.6, 2.2, 0.95], [-0.515, 5.4, 1.2, 1.6, 0.95]],
        },
        sixbysix: {
          name: 'club-sixbysix',
          bodyW: 0.93,
          yb: 5.4,
          h: 12.4,
          section: [[0, 0.92], [0.08, 0.98], [0.2, 1], [0.86, 1], [0.95, 0.985], [1, 0.9], [1, 0.4], [1, 0]],
          profile: [[-0.5, 0.97, 9.4], [-0.49, 1, 9.6], [-0.15, 1, 9.6], [-0.135, 1, 12.4], [0.24, 1, 12.4], [0.3, 0.99, 12.3], [0.46, 0.97, 12.1], [0.5, 0.93, 11.2]],
          glass: { base: 12.6, roof: 17.8, xf: 0.23, xb: -0.125, rf: 0.19, rb: -0.118, wb: 0.46, wt: 0.44, bow: 0.004, bulge: 0.2, arch: 0.15, pillars: [[0.5, 1.3, 'paint'], [0, 1.8, 'paint']] },
          bed: [-0.14, 9.6, 12.2],
          wheel: { r: 3.8, width: 3.2, xs: [0.33, -0.13, -0.345], inset: 0.1, style: 'beadlock', rim: '#1d1e20', tread: 'mt' },
          hood: [12.45, 0.72],
          head: [0.5, 10.8, 0.34, 0.3, 1.5, 1.5, 'round'],
          tail: [-0.503, 8.8, 0.45, 0.3, 1.6, 0.08],
          bumpers: [[0.52, 6.9, 1.6, 2.4, 0.96], [-0.515, 6.9, 1.2, 1.8, 0.96]],
        },
        trophy: {
          name: 'club-trophy',
          bodyW: 0.86,
          yb: 5.6,
          h: 11.0,
          section: [[0, 0.86], [0.12, 0.95], [0.35, 1], [0.7, 1], [0.86, 0.97], [0.95, 0.9], [1, 0.75], [1, 0.3], [1, 0]],
          profile: [[-0.5, 0.95, 8.6], [-0.49, 1, 8.8], [-0.17, 1, 8.8], [-0.155, 1, 11.0], [0.08, 1, 11.0], [0.14, 0.98, 10.8], [0.36, 0.95, 10.1], [0.46, 0.9, 9.4], [0.5, 0.8, 8.2]],
          glass: { base: 11.2, roof: 15.1, xf: 0.085, xb: -0.148, rf: -0.03, rb: -0.125, wb: 0.43, wt: 0.36, bow: 0.02, bulge: 0.7, arch: 0.3, pillars: [[0, 1.9, 'paint']] },
          bed: [-0.16, 8.8, 10.6],
          wheel: { r: 4.0, width: 3.1, xs: [0.31, -0.31], inset: -0.2, style: 'beadlock', rim: '#202226', tread: 'desert' },
          hood: [10.3, 0.64],
          head: [0.49, 8.9, 0.28, 0.6, 0.8, 0.2],
          tail: [-0.503, 8.2, 0.42, 0.3, 1.0, 0.1],
          bumpers: [[0.51, 7.0, 1.2, 1.2, 0.8], [-0.51, 7.0, 1.0, 1.2, 0.8]],
        },
      };
      // ---- Liveries ----------------------------------------------------------------------------
      const OFFROAD_LIVERIES = {
        // [hood, roof, door, trunk, pillar, base, black, accent]
        series: { base: '#c9b27a', swatches: ['#c9b27a', '#efeadb', '#c9b27a', '#c9b27a', '#efeadb', '#c9b27a', '#141517', '#6d5226'] },
        crawler: { base: '#e8672a', swatches: ['#e8672a', '#16171a', '#e8672a', '#e8672a', '#16171a', '#e8672a', '#141517', '#16171a'] },
        bronco: { base: '#2e8b91', swatches: ['#2e8b91', '#f1eee6', '#2e8b91', '#2e8b91', '#f1eee6', '#2e8b91', '#141517', '#f1eee6'] },
        expedition: { base: '#d7c9a6', swatches: ['#d7c9a6', '#d7c9a6', '#d7c9a6', '#d7c9a6', '#d7c9a6', '#d7c9a6', '#141517', '#5a3d22'] },
        hilux: { base: '#eeeeea', swatches: ['#eeeeea', '#eeeeea', '#eeeeea', '#eeeeea', '#eeeeea', '#eeeeea', '#141517', '#c42a22'] },
        sixbysix: { base: '#7d7556', swatches: ['#7d7556', '#7d7556', '#7d7556', '#7d7556', '#7d7556', '#7d7556', '#141517', '#2c2a22'] },
        trophy: { base: '#f1c232', swatches: ['#f1c232', '#151618', '#f1c232', '#f1c232', '#151618', '#f1c232', '#141517', '#d8321f'] },
      };
      const offroadLiveryTextures = new Map();
      function offroadLiveryTexture(type, def, l, w) {
        const key = type + ':' + l + ':' + w;
        if (offroadLiveryTextures.has(key)) return offroadLiveryTextures.get(key);
        const canvas = document.createElement('canvas');
        canvas.width = LIVERY_W;
        canvas.height = LIVERY_H;
        const g = canvas.getContext('2d'),
          spec = OFFROAD_LIVERIES[type],
          f = liveryFrame(def, l, w),
          yb = def.yb,
          waist = def.h,
          black = '#141517';
        g.fillStyle = spec.base;
        g.fillRect(0, 0, LIVERY_W, LIVERY_H);
        const seams = (xs) => liverySeams(g, f, xs.map((x) => x * l), yb + 0.7, waist - 0.3, 'rgba(0,0,0,0.5)');
        if (type === 'series') {
          // Safari: a zebra band along the sills, a roundel on the doors.
          liveryBand(g, f, -0.6 * l, 0.6 * l, 0, yb + 2.5, '#efe6cc');
          for (let x = -0.55 * l; x < 0.55 * l; x += 1.7) liveryPolygon(g, f, [[x, yb + 0.2], [x + 0.7, yb + 0.2], [x + 1.5, yb + 2.4], [x + 0.8, yb + 2.4]], '#1a1714');
          liveryBand(g, f, -0.6 * l, 0.6 * l, yb + 2.45, yb + 2.7, '#6d5226');
          seams([0.22, 0.05, -0.12]);
          liveryDraw(g, f, 0.12 * l, waist - 2.8, (c, px) => {
            c.beginPath();
            c.arc(0, 0, 1.55 * px, 0, TAU);
            c.fillStyle = '#efe6cc';
            c.fill();
            c.lineWidth = 0.18 * px;
            c.strokeStyle = '#6d5226';
            c.stroke();
            c.fillStyle = '#6d5226';
            c.beginPath();
            c.moveTo(-1.1 * px, 0.45 * px);
            c.lineTo(-0.35 * px, -0.6 * px);
            c.lineTo(0.05 * px, -0.1 * px);
            c.lineTo(0.45 * px, -0.75 * px);
            c.lineTo(1.1 * px, 0.45 * px);
            c.fill();
          });
          liveryText(g, f, 'SERENGETI TRAILS', -0.1 * l, waist - 2.2, 0.62, '#4b3718', { stretch: 1.1, spacing: 0.1 });
          liveryText(g, f, 'SAFARI · EST. 1978', -0.1 * l, waist - 3.2, 0.42, '#4b3718', { stretch: 1.05 });
        } else if (type === 'crawler') {
          liveryBand(g, f, -0.6 * l, 0.6 * l, 0, yb + 1.0, black);
          // No doors: the openings, dark to the sill.
          liveryPolygon(g, f, [[0.19 * l, waist + 1], [0.19 * l, yb + 2.0], [-0.02 * l, yb + 1.6], [-0.11 * l, waist - 2.4], [-0.11 * l, waist + 1]], '#101114');
          liveryText(g, f, 'BADGER', 0.33 * l, waist - 1.7, 1.0, black, { stretch: 1.2, spacing: 0.12 });
          liveryDraw(g, f, -0.3 * l, waist - 2.0, (c, px) => {
            c.fillStyle = black;
            c.beginPath();
            c.moveTo(-1.5 * px, -0.55 * px);
            c.lineTo(1.5 * px, -0.55 * px);
            c.lineTo(1.2 * px, 0.55 * px);
            c.lineTo(-1.2 * px, 0.55 * px);
            c.fill();
            c.fillStyle = '#d62d20';
            c.font = `bold ${Math.round(0.62 * px)}px ${POLICE_FONT}`;
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText('TRAIL RATED', 0, 0);
          });
          liveryText(g, f, 'RUBICON', -0.3 * l, yb + 2.2, 0.55, black, { stretch: 1.1, spacing: 0.1 });
        } else if (type === 'bronco') {
          liveryBand(g, f, -0.6 * l, 0.6 * l, 0, yb + 1.7, '#f1eee6');
          liveryBand(g, f, -0.6 * l, 0.6 * l, yb + 1.7, yb + 1.9, '#b8bec2');
          liveryBand(g, f, -0.6 * l, 0.6 * l, waist - 0.55, waist - 0.35, '#d6dadc');
          seams([0.2, -0.14]);
          liveryText(g, f, 'Ridge', 0.34 * l, waist - 1.6, 0.95, '#f1eee6', { weight: 'italic bold', stretch: 1.05 });
        } else if (type === 'expedition') {
          liveryBand(g, f, -0.6 * l, 0.6 * l, 0, yb + 1.1, '#2a2a28');
          liveryBand(g, f, -0.6 * l, 0.6 * l, waist - 2.3, waist - 2.05, '#5a3d22');
          liveryBand(g, f, -0.6 * l, 0.6 * l, waist - 1.9, waist - 1.8, '#8a6a3a');
          seams([0.21, 0.0, -0.2]);
          liveryPolygon(g, f, [[-0.44 * l, yb + 1.3], [-0.36 * l, yb + 3.6], [-0.31 * l, yb + 2.6], [-0.26 * l, yb + 4.4], [-0.18 * l, yb + 1.3]], '#5a3d22');
          liveryText(g, f, 'ALTITUDE OVERLAND', -0.3 * l, yb + 0.55 + 1.35, 0.5, '#f0e6d0', { stretch: 1.08, spacing: 0.12 });
        } else if (type === 'hilux') {
          liveryBand(g, f, -0.6 * l, 0.6 * l, 0, yb + 2.3, '#17181a');
          liveryBand(g, f, -0.6 * l, 0.6 * l, yb + 2.3, yb + 2.5, '#c42a22');
          seams([0.2, 0.02, -0.14]);
          liveryText(g, f, 'HX35', -0.33 * l, yb + 1.25, 1.4, '#eeeeea', { stretch: 1.2, weight: 'italic bold' });
          liveryText(g, f, 'ARCTIC', 0.07 * l, yb + 1.15, 0.8, '#eeeeea', { stretch: 1.2, spacing: 0.2 });
        } else if (type === 'sixbysix') {
          liveryBand(g, f, -0.6 * l, 0.6 * l, 0, yb + 0.9, '#232320');
          seams([0.23, 0.05, -0.13]);
          liveryText(g, f, 'OKTAV', -0.33 * l, waist - 1.1, 0.7, '#2c2a22', { stretch: 1.3, spacing: 0.3 });
          liveryText(g, f, '6×6', 0.36 * l, waist - 1.3, 0.8, '#2c2a22', { stretch: 1.1 });
        } else if (type === 'trophy') {
          // Race livery: black lower flank with a red slash, a number roundel, sponsors.
          liveryPolygon(g, f, [[0.6 * l, 0], [0.6 * l, yb + 1.2], [0.0, yb + 2.6], [-0.6 * l, yb + 4.2], [-0.6 * l, 0]], '#151618');
          liveryPolygon(g, f, [[0.6 * l, yb + 1.2], [0.6 * l, yb + 1.7], [0.0, yb + 3.1], [-0.6 * l, yb + 4.7], [-0.6 * l, yb + 4.2], [0.0, yb + 2.6]], '#d8321f');
          liveryDraw(g, f, -0.03 * l, waist - 2.0, (c, px) => {
            c.beginPath();
            c.ellipse(0, 0, 1.9 * px, 1.55 * px, 0, 0, TAU);
            c.fillStyle = '#f7f5ef';
            c.fill();
            c.fillStyle = '#111';
            c.font = `bold ${Math.round(2.3 * px)}px ${POLICE_FONT}`;
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText('88', 0, 0.1 * px);
          });
          liveryText(g, f, 'MUDLINE TIRES', 0.3 * l, waist - 1.2, 0.55, '#151618', { stretch: 1.1, spacing: 0.08 });
          liveryText(g, f, 'RIDGELINE RACING', -0.32 * l, waist - 1.6, 0.6, '#151618', { stretch: 1.1, spacing: 0.08 });
          liveryText(g, f, 'HOLESHOT FUEL', 0.24 * l, yb + 0.7, 0.5, '#f1c232', { stretch: 1.1 });
        }
        spec.swatches.forEach((color, i) => {
          g.fillStyle = color;
          g.fillRect((i * LIVERY_W) / 8, LIVERY_H * (1 - POLICE_SWATCH_BAND), LIVERY_W / 8, LIVERY_H * POLICE_SWATCH_BAND);
        });
        const tx = policeCanvasTexture(canvas);
        offroadLiveryTextures.set(key, tx);
        return tx;
      }
      // ---- Tyres and rims -----------------------------------------------------------------------
      const offroadShapes = new Map();
      function offroadShape(key, make) {
        let geo = offroadShapes.get(key);
        if (!geo) {
          geo = make();
          offroadShapes.set(key, geo);
        }
        return geo;
      }
      // A cylinder along x (tubes: roll cages, sliders, bars) and a tread lug.
      const tubeX = offroadShape('tubeX', () => new Three.CylinderGeometry(1, 1, 1, 10).rotateZ(Math.PI / 2));
      function kitTube(set, a, b, radius, color) {
        policeBeam(set, tubeX, a, b, radius, radius, color);
      }
      /*
       * A tyre, axis along z: a lathed carcass (bead, bulging sidewall, square
       * shoulder, crowned tread) and a ring of staggered lugs. Mud-terrain: big
       * blocks with shoulder lugs down the sidewall; all-terrain: smaller, denser
       * blocks; desert: low, open blocks. Raised white letters for the Bronco.
       */
      function offroadTyreGeometry(r, width, tread, letters) {
        return offroadShape(['tyre', r, width, tread, letters].join(':'), () => {
          const set = policeSet(),
            hw = width / 2,
            rim = r * 0.6,
            outline = [
              [rim, -hw * 0.86], [r * 0.7, -hw * 0.99], [r * 0.82, -hw * 1.04], [r * 0.9, -hw * 1.0], [r * 0.945, -hw * 0.88],
              [r * 0.955, -hw * 0.45], [r * 0.955, hw * 0.45], [r * 0.945, hw * 0.88], [r * 0.9, hw * 1.0], [r * 0.82, hw * 1.04], [r * 0.7, hw * 0.99], [rim, hw * 0.86],
            ],
            lathe = new Three.LatheGeometry(outline.map(([x, y]) => new Three.Vector2(x, y)), 40).rotateX(Math.PI / 2);
          policeAddMatrix(set, lathe, policeIdentity, '#1c1c1d');
          lathe.dispose();
          const count = tread === 'desert' ? 22 : tread === 'at' ? 32 : 26,
            depth = tread === 'desert' ? 0.16 : tread === 'at' ? 0.2 : 0.3,
            pitch = TAU / count;
          for (let k = 0; k < count; k++)
            for (const side of [-1, 1]) {
              const a = k * pitch + (side > 0 ? pitch * 0.5 : 0),
                R = r * 0.955 + depth / 2,
                along = tread === 'at' ? hw * 0.42 : hw * 0.5,
                z = side * (tread === 'at' ? hw * 0.5 : hw * 0.46);
              policeAdd(set, boxGeo, Math.cos(a) * R, Math.sin(a) * R, z, depth, r * pitch * (tread === 'desert' ? 0.45 : 0.56), along, '#202021', null, 0, 0, a);
              if (tread === 'at') policeAdd(set, boxGeo, Math.cos(a + pitch * 0.25) * R, Math.sin(a + pitch * 0.25) * R, side * hw * 0.12, depth, r * pitch * 0.3, hw * 0.2, '#202021', null, 0, 0, a);
              // Shoulder lugs wrap over the edge onto the sidewall.
              if (tread === 'mt' && k % 2 === (side > 0 ? 0 : 1)) {
                const Rs = r * 0.9;
                policeAdd(set, boxGeo, Math.cos(a) * Rs, Math.sin(a) * Rs, side * hw * 1.02, r * 0.14, r * pitch * 0.55, 0.22, '#202021', null, 0, 0, a);
              }
            }
          if (letters)
            for (let k = 0; k < 18; k++) {
              if (k % 9 > 6) continue;
              const a = (k / 18) * TAU,
                R = r * 0.83;
              policeAdd(set, boxGeo, Math.cos(a) * R, Math.sin(a) * R, hw * 1.05, r * 0.07, r * 0.18, 0.06, '#e8e4d8', null, 0, 0, a + Math.PI / 2);
            }
          return policeGeometry(set);
        });
      }
      // Rims: steel (the Series and the Highlander), a six-spoke cast wheel, a beadlock.
      function offroadRimGeometry(r, width, style, color, side) {
        return offroadShape(['rim', r, width, style, color, side].join(':'), () => {
          const set = policeSet(),
            S = policeShapeKit(),
            rim = r * 0.6,
            face = side * width * 0.3,
            across = Math.PI / 2,
            dark = '#101112';
          policeAdd(set, S.cylinder, 0, 0, face - side * 0.15, rim, 0.3, rim, dark, null, across, 0, 0);
          policeAdd(set, S.cylinder, 0, 0, face, rim * 0.97, 0.12, rim * 0.97, color, null, across, 0, 0);
          if (style === 'steel') {
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * TAU;
              policeAdd(set, S.cylinderLow, Math.cos(a) * rim * 0.62, Math.sin(a) * rim * 0.62, face + side * 0.07, rim * 0.16, 0.04, rim * 0.16, dark, null, across, 0, 0);
            }
            policeAdd(set, S.dome, 0, 0, face + side * 0.05, rim * 0.34, 0.35, rim * 0.34, color, null, side * across, 0, 0);
          } else {
            const spokes = style === 'beadlock' ? 8 : 6;
            policeAdd(set, S.cylinder, 0, 0, face + side * 0.05, rim * 0.72, 0.08, rim * 0.72, dark, null, across, 0, 0);
            for (let i = 0; i < spokes; i++) policeAdd(set, boxGeo, 0, 0, face + side * 0.12, rim * 0.16, rim * 1.36, 0.16, color, null, 0, 0, (i * Math.PI) / spokes);
            policeAdd(set, S.cylinder, 0, 0, face + side * 0.16, rim * 0.28, 0.14, rim * 0.28, color, null, across, 0, 0);
            if (style === 'beadlock') {
              // The clamp ring and its bolts, proud of the face.
              policeAdd(set, S.cylinder, 0, 0, face + side * 0.1, rim * 1.02, 0.1, rim * 1.02, color, null, across, 0, 0);
              policeAdd(set, S.cylinder, 0, 0, face + side * 0.12, rim * 0.86, 0.1, rim * 0.86, dark, null, across, 0, 0);
              for (let i = 0; i < 20; i++) {
                const a = (i / 20) * TAU;
                policeAdd(set, S.cylinderLow, Math.cos(a) * rim * 0.93, Math.sin(a) * rim * 0.93, face + side * 0.2, 0.09, 0.1, 0.09, '#c9ccce', null, across, 0, 0);
              }
            }
          }
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            policeAdd(set, S.cylinderLow, Math.cos(a) * rim * 0.2, Math.sin(a) * rim * 0.2, face + side * 0.22, 0.12, 0.14, 0.12, '#b9bec2', null, across, 0, 0);
          }
          return policeGeometry(set);
        });
      }
      // A flared arch: an extruded band round the top of the wheel opening.
      function flareGeometry(r, depth) {
        return offroadShape(['flare', r, depth].join(':'), () => {
          const shape = new Three.Shape(),
            outer = r * 1.34,
            inner = r * 1.12,
            a0 = -0.12,
            a1 = Math.PI + 0.12;
          shape.absarc(0, 0, outer, a0, a1, false);
          shape.absarc(0, 0, inner, a1, a0, true);
          const geo = new Three.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 1, curveSegments: 16 });
          geo.translate(0, 0, -depth / 2);
          return geo;
        });
      }
