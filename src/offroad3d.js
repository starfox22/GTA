      // BEGIN SUBSYSTEM: src/offroad3d.js — 4x4 club trucks, the club lot, trail props and mud
      /**
       * 4x4 club trucks, the club lot, trail props and mud
       * Source: src/offroad3d.js
       * Scope: createCityRenderer() closure (included after police3d.js, whose
       * lofting, merging and livery kit it reuses).
       *
       * TRUCKS (makeOffroadVehicle): the seven club types of offroad.js, each a
       * lofted shell and glasshouse on the damage contract (the police bodies'
       * format: section, profile, glass), a canvas livery with panel swatches, and
       * static kit merged per material: steel bumpers and a winch, fender flares,
       * rock sliders, snorkels, roof racks, a roof tent, jerry cans, sand ladders,
       * light bars and pods, roll cages, a trophy truck's coilovers and spares.
       * Tyres are modelled (a lathed carcass with a bulging sidewall and a ring of
       * staggered tread lugs: mud-terrain, all-terrain or desert) on beadlock,
       * steel or cast rims. Each wheel hangs from a knuckle that steers (front)
       * and follows the ground under it (articulation within the travel), and it
       * turns at the wheel speed: spinning in the mud it runs ahead of the truck.
       *
       * MUD ON BODIES (vehicleMudPatch): a shader layer on the paint, trim and
       * tyres, driven by c.mudCoat / c.mudWet: splatter heaviest low down and
       * behind the wheels, dark and glossy when fresh, pale and matt when dry.
       * Ordinary cars get it on their paint the first time they get muddy.
       *
       * MUD EFFECTS (updateOffroadVisuals): pooled clumps (instanced, lit) thrown
       * rearward and up from spinning or fast tyres in mud, flying ballistic arcs
       * and leaving splats where they land; a finer mist; pale dust on dry dirt;
       * tyre tracks laid behind every wheel on dirt that fade over minutes. Splats
       * and tracks are decals in one instanced multiply-blend shader each, laid on
       * the ground's own slope. Nothing allocates per frame.
       *
       * THE LOT (built once): the gravel pad, log rails, the carved 4X4 CLUB sign
       * on log posts with a rusted steel emblem, a pop-up canopy with a table,
       * camp chairs, a cooler, a kettle grill that smokes, a fire ring, a flag
       * that flies, string lights and lanterns for the evening; on the trail the
       * start gate, checkpoint flags, the rock-step ledges and the finish banner.
       */
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
      function mudUniforms() {
        return { mudAmount: { value: 0 }, mudWet: { value: 1 }, mudBase: { value: new Three.Vector2(0, 16) } };
      }
      /*
       * Adds the mud layer to a lit material (chained after any patch it has).
       * `tyre`: the whole tread and sidewall take it, whatever the height.
       */
      function vehicleMudPatch(material, uniforms, tyre = false) {
        const previous = material.onBeforeCompile,
          previousKey = material.customProgramCacheKey;
        material.onBeforeCompile = (shader, renderer) => {
          if (previous) previous.call(material, shader, renderer);
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vMudLocal;\nvarying vec3 vMudWorld;\nvarying float vMudUp;')
            .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvMudUp = normalize( mat3( modelMatrix ) * objectNormal ).y;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMudLocal = transformed;\nvMudWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
          shader.fragmentShader = shader.fragmentShader
            .replace(
              '#include <common>',
              '#include <common>\nvarying vec3 vMudLocal;\nvarying vec3 vMudWorld;\nvarying float vMudUp;\nuniform float mudAmount;\nuniform float mudWet;\nuniform vec2 mudBase;\n' + MUD_NOISE,
            )
            .replace(
              '#include <color_fragment>',
              `#include <color_fragment>
              float mudMask = 0.0;
              float mudGrain = 0.5;
              if ( mudAmount > 0.002 ) {
                float h = clamp( ( vMudWorld.y - mudBase.x ) / mudBase.y, 0.0, 1.5 );
                mudGrain = mudNoise( vMudLocal * 0.55 ) * 0.6 + mudNoise( vMudLocal * 2.3 + 3.7 ) * 0.4;
                float spray = ${tyre ? 'mudAmount * 2.6 - 0.35' : 'mudAmount * 2.2 - h * 1.5 - max( vMudUp, 0.0 ) * 0.3'} + ( mudGrain - 0.5 ) * 1.15;
                mudMask = smoothstep( 0.0, 0.16, spray );
                vec3 mudColor = mix( vec3( 0.3, 0.24, 0.17 ), vec3( 0.07, 0.048, 0.03 ), mudWet ) * ( 0.72 + 0.56 * mudGrain );
                diffuseColor.rgb = mix( diffuseColor.rgb, mudColor, mudMask );
              }`,
            )
            .replace(
              '#include <roughnessmap_fragment>',
              '#include <roughnessmap_fragment>\nroughnessFactor = mix( roughnessFactor, mix( 0.96, 0.38, mudWet ) + ( mudGrain - 0.5 ) * 0.1, mudMask );',
            )
            .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - mudMask;')
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
          tail: [-0.5, 6.2, 0.43, 0.3, 1.2, 0.9],
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
          tail: [-0.503, 8.7, 0.44, 0.3, 1.4, 0.6],
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
          tail: [-0.5, 7.2, 0.44, 0.3, 1.6, 0.7],
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
          tail: [-0.502, 7.6, 0.45, 0.3, 2.2, 0.55],
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
          tail: [-0.503, 8.3, 0.45, 0.3, 2.6, 0.5],
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
          tail: [-0.503, 8.8, 0.45, 0.3, 1.6, 0.8],
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
          tail: [-0.503, 8.2, 0.42, 0.3, 1.0, 0.4],
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
      function tube(set, a, b, radius, color) {
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
      // ---- Kits ------------------------------------------------------------------------------
      const offroadKits = new Map();
      function offroadKit(type, def, l, w, specW) {
        const key = [type, l, w].join(':');
        if (offroadKits.has(key)) return offroadKits.get(key);
        const S = policeShapeKit(),
          g = def.glass,
          paint = policeSet(),
          trim = policeSet(),
          bright = policeSet(),
          lens = policeSet(),
          anchors = [],
          spares = [],
          swatch = (name) => ({ uv: swatchUv(POLICE_SWATCH[name]) }),
          black = '#141517',
          steel = '#26292d',
          alu = '#b3b8bc',
          topAt = (x) => profileAt(def.profile, x / l)[1],
          halfAt = (x, y) => policeShellAt(def, l, w, x, y).half,
          r = def.wheel.r,
          zWheel = specW / 2 - def.wheel.width / 2 - def.wheel.inset,
          nose = 0.5 * l,
          tail = -0.5 * l,
          kit = {
            shell: policeShellGeometry(def, l, w),
            cabin: def.open ? null : policeCabinGeometry(def, l, w),
            hood: policeSwatchBox(POLICE_SWATCH.hood),
            door: policeSwatchBox(POLICE_SWATCH.door),
            trunk: policeSwatchBox(POLICE_SWATCH.trunk),
            tyre: offroadTyreGeometry(r, def.wheel.width, def.wheel.tread, !!def.wheel.letters),
            rims: [-1, 1].map((side) => offroadRimGeometry(r, def.wheel.width, def.wheel.style, def.wheel.rim, side)),
            zWheel,
            anchors,
            spares,
          };
        const lightPod = (x, y, z, radius, facing = 0) => {
          policeAdd(trim, S.cylinder, x, y, z, radius, 0.9, radius, black, null, 0, 0, Math.PI / 2 + facing);
          policeAdd(lens, S.disc, x + 0.46 * Math.cos(facing), y + 0.46 * Math.sin(facing), z, radius * 0.86, radius * 0.86, 1, '#f4f2e8', null, 0, Math.PI / 2, facing);
          anchors.push({ x: x + 0.8, y, z, size: radius * 7 });
        };
        const lightBar = (x, y, width, z = 0) => {
          policeAdd(trim, roundedBar(width, 1.1, 1.0, 0.3), x, y, z, 1, 1, 1, black);
          policeAdd(lens, boxGeo, x + 0.52, y, z, 0.08, 0.7, width * 0.94, '#f4f2e8');
          for (const t of [-0.3, 0, 0.3]) anchors.push({ x: x + 0.9, y, z: z + t * width, size: width * 0.45 });
        };
        const jerryCan = (x, y, z, color, ry = 0) => {
          policeAdd(trim, roundedBar(0.95, 3.6, 2.6, 0.25), x, y + 1.8, z, 1, 1, 1, color, null, 0, ry, 0);
          policeAdd(trim, boxGeo, x, y + 3.75, z, 0.5, 0.35, 1.3, color, null, 0, ry, 0);
        };
        const roofRack = (x0, x1, y, half) => {
          for (const side of [-1, 1]) tube(trim, [x0, y, side * half], [x1, y, side * half], 0.18, black);
          tube(trim, [x0, y, -half], [x0, y, half], 0.18, black);
          tube(trim, [x1, y, -half], [x1, y, half], 0.18, black);
          for (let x = x0 + 2.2; x < x1 - 1; x += 2.4) policeAdd(trim, boxGeo, x, y - 0.05, 0, 0.5, 0.1, half * 2, '#2b2d30');
          for (const side of [-1, 1])
            for (const x of [x0 + 1, x1 - 1, (x0 + x1) / 2]) tube(trim, [x, g.roof + g.arch, side * half * 0.95], [x, y, side * half], 0.12, black);
        };
        const snorkel = (side) => {
          const x0 = g.xf * l + 2.2,
            z = side * (halfAt(g.xf * l, def.h - 1) + 0.45),
            top = g.roof + 1.4;
          tube(trim, [x0, def.h - 2.2, z], [x0, def.h + 0.2, z], 0.42, black);
          tube(trim, [x0, def.h + 0.2, z], [lerpNumber(g.xf, g.rf, 0.92) * l - 0.3, top, z], 0.42, black);
          policeAdd(trim, roundedBar(1.6, 1.0, 1.2, 0.35), lerpNumber(g.xf, g.rf, 0.92) * l, top + 0.3, z, 1, 1, 1, black);
        };
        const steelBumper = (front, winch, bull) => {
          const x = front ? nose + 0.7 : tail - 0.6,
            y = def.bumpers[front ? 0 : 1][1],
            half = w * 0.5;
          policeAdd(trim, roundedBar(w * 1.0, 1.9, 1.3, 0.2), x, y, 0, 1, 1, 1, steel);
          for (const side of [-1, 1]) policeAdd(trim, boxGeo, x + (front ? 0.3 : -0.3), y - 0.6, side * half * 0.92, 1.2, 1.1, 1.6, steel);
          // D-ring shackles.
          for (const side of [-1, 1]) policeAdd(bright, S.arch, x + (front ? 0.85 : -0.85), y + 0.2, side * half * 0.55, 0.55, 0.55, 3, '#c43a22', null, 0, Math.PI / 2, Math.PI / 2 * (front ? -1 : 1));
          if (winch) {
            policeAdd(trim, S.cylinder, x + 0.4, y + 0.15, 0, 0.8, w * 0.42, 0.8, '#1a1b1d', null, Math.PI / 2, 0, 0);
            policeAdd(trim, S.cylinderLow, x + 0.4, y + 0.15, 0, 0.62, w * 0.3, 0.62, '#3b3f44', null, Math.PI / 2, 0, 0);
            policeAdd(bright, boxGeo, x + 0.85, y + 0.1, 0, 0.3, 0.9, 1.8, alu);
            policeAdd(bright, S.arch, x + 1.35, y - 0.35, 0, 0.45, 0.45, 3, '#c9ccce', null, 0, Math.PI / 2, Math.PI);
          }
          if (bull) {
            const top = topAt(nose - 1) + 0.6;
            for (const side of [-1, 1]) {
              tube(trim, [x, y + 0.9, side * w * 0.33], [x - 0.3, top, side * w * 0.3], 0.3, steel);
              tube(trim, [x - 0.3, top, side * w * 0.3], [x - 0.4, top, 0], 0.3, steel);
            }
          }
          if (!front) policeAdd(trim, boxGeo, x - 0.6, y - 0.4, 0, 1.2, 0.6, 0.8, steel);
        };
        const rockSliders = () => {
          const x0 = def.wheel.xs[def.wheel.xs.length - 1] * l + r * 1.15,
            x1 = def.wheel.xs[0] * l - r * 1.15,
            y = def.yb + 0.3;
          for (const side of [-1, 1]) {
            const z = side * (halfAt(0, def.yb + 1) + 0.55);
            tube(trim, [x0, y, z], [x1, y, z], 0.34, steel);
            for (const x of [x0 + 1, (x0 + x1) / 2, x1 - 1]) tube(trim, [x, y, z], [x, y + 0.2, side * (halfAt(0, def.yb + 1) - 0.4)], 0.22, steel);
          }
        };
        const mirrors = (tall = false) => {
          for (const side of [-1, 1]) {
            const mx = g.xf * l - 1.4,
              my = g.base + (tall ? 1.8 : 1.2),
              mz = side * (g.wb * w + 1.3);
            policeAdd(trim, roundedBar(0.5, tall ? 1.8 : 1.2, 1.2, 0.25), mx, my, mz, 1, 1, 1, black);
            policeBeam(trim, boxGeo, [mx + 0.2, my - 0.6, side * g.wb * w], [mx + 0.2, my - 0.4, mz - side * 0.5], 0.3, 0.4, black);
          }
        };
        const handles = (xs) => {
          for (const side of [-1, 1]) for (const hx of xs) policeAdd(trim, boxGeo, hx * l, def.h - 1.2, side * (halfAt(hx * l, def.h - 1.2) + 0.05), 1.1, 0.25, 0.16, black);
        };
        const spareOnBack = (y, facing = -1) => spares.push({ x: tail - 0.3 - def.wheel.width / 2 - 0.4, y, z: 0, ry: facing * Math.PI / 2 });
        // ---- Every truck: arches and flares, wells, sills, grille, plates.
        for (const fx of def.wheel.xs)
          for (const side of [-1, 1]) {
            const x = fx * l,
              half = halfAt(x, r + 1.5),
              reach = zWheel + def.wheel.width / 2 + 0.25 - half;
            policeAdd(trim, S.halfDisc, x, r * 0.98, side * (half + 0.03), r * 1.14, r * 1.14, 1, '#060607', null, 0, side < 0 ? Math.PI : 0, 0);
            if (type === 'crawler') {
              // Tube-style flat fenders on the rock crawler.
              policeAdd(trim, flareGeometry(r, Math.max(1.2, reach)), x, r * 1.02, side * (half + Math.max(1.2, reach) / 2 - 0.3), 1.05, 0.9, 1, black);
            } else if (type !== 'series') policeAdd(trim, flareGeometry(r, Math.max(0.7, reach)), x, r * 0.98, side * (half + Math.max(0.7, reach) / 2 - 0.2), 1, 1, 1, type === 'bronco' ? '#2b7f85' : black);
            else policeAdd(trim, S.arch, x, r * 0.98, side * (half + 0.05), r * 1.16, r * 1.16, 4, '#15161a');
          }
        for (const side of [-1, 1]) policeAdd(trim, boxGeo, 0, def.yb + 0.6, side * (halfAt(0, def.yb + 0.6) + 0.03), l * 0.35, 0.8, 0.12, '#1d1f22');
        policeAdd(trim, boxGeo, tail - 0.1, def.bumpers[1][1] + 1.6, 0, 0.12, 1.2, 2.8, '#dcd6c4');
        // ---- The glasshouse's frame: roof panel, pillars, mirrors (closed bodies).
        if (!def.open) {
          const roofPoint = (s, t, lift = 0.14) => [lerpNumber(g.rb * l - 0.25, g.rf * l + 0.25, t), g.roof + lift + g.arch * (1 - s * s), s * g.wt * w * 1.03];
          const roofGeo = gridGeometry(6, 4, (u, v) => roofPoint(u * 2 - 1, v), (p, out) => out.set(p.x, p.y - 5, 0));
          policeAddMatrix(paint, roofGeo, policeIdentity, '#ffffff', swatch('roof'));
          roofGeo.dispose();
          for (const side of [-1, 1]) {
            const skirt = gridGeometry(6, 1, (u, v) => {
              const p = roofPoint(side, u, 0.14 - (1 - v) * 0.4);
              return [p[0], p[1], p[2] + side * 0.02];
            }, (p, out) => out.set(p.x, p.y, 0));
            policeAddMatrix(paint, skirt, policeIdentity, '#ffffff', swatch('roof'));
            skirt.dispose();
            for (const [s, width, kind] of [[1, 1.05, 'paint'], ...g.pillars]) {
              const set = kind === 'paint' ? paint : trim,
                options = kind === 'paint' ? swatch('pillar') : null,
                shift = s === 1 ? -width * 0.35 : s === 0 ? width * 0.45 : 0,
                points = [0, 0.5, 1].map((t) => {
                  const p = glassPoint(g, l, w, 'side', s, t, side);
                  return [p[0] + shift, p[1], p[2] + side * 0.14];
                });
              for (let k = 0; k < 2; k++) policeBeam(set, boxGeo, points[k], points[k + 1], 0.32, width, kind === 'paint' ? '#ffffff' : '#07080a', options, [0, 0, side]);
            }
            policeBeam(trim, boxGeo, glassPoint(g, l, w, 'side', 0, 0.03, side), glassPoint(g, l, w, 'side', 1, 0.03, side), 0.28, 0.3, '#0b0c0e');
          }
          mirrors(type === 'sixbysix' || type === 'expedition');
        }
        // ---- Per truck.
        if (type === 'series') {
          // Land Rover-style: flat grille panel with the headlamps in it, bonnet
          // spare, exposed hinges, safari double roof and alpine lights, rear ladder.
          policeAdd(trim, boxGeo, nose + 0.05, 7.4, 0, 0.3, 3.6, w * 0.62, '#1a1b1d');
          for (let i = -3; i <= 3; i++) policeAdd(bright, boxGeo, nose + 0.22, 7.4, i * w * 0.07, 0.1, 3.0, 0.22, '#9aa0a4');
          spares.push({ x: 0.36 * l, y: topAt(0.36 * l) + def.wheel.width / 2 + 0.1, z: 0, rx: Math.PI / 2 });
          for (const side of [-1, 1]) {
            for (const hx of [0.2, 0.02, -0.14]) policeAdd(bright, boxGeo, hx * l + 0.3, def.h - 1.6, side * (halfAt(hx * l, def.h - 1.6) + 0.1), 0.8, 0.35, 0.2, '#8b9094');
            // Alpine light windows along the roof edge (the safari roof's hallmark).
            for (let k = 0; k < 4; k++) policeAdd(trim, boxGeo, (-0.36 + k * 0.1) * l, g.roof - 0.35, side * (g.wt * w + 0.05), 2.4, 0.7, 0.1, '#1b2833');
          }
          // Safari roof: a second white skin on spacers, raised off the first.
          policeAdd(paint, boxGeo, (g.rb + g.rf) * 0.5 * l, g.roof + g.arch + 0.95, 0, (g.rf - g.rb) * l * 0.94, 0.28, g.wt * w * 2.08, '#ffffff', swatch('roof'));
          for (const x of [-0.4, -0.15, 0.1]) for (const side of [-1, 1]) policeAdd(trim, boxGeo, x * l, g.roof + g.arch + 0.55, side * g.wt * w * 0.9, 0.6, 0.6, 0.6, '#d8d3c4');
          roofRack(g.rb * l + 1, g.rf * l - 1.5, g.roof + g.arch + 1.9, g.wt * w * 0.98);
          jerryCan(-0.3 * l, g.roof + g.arch + 2.0, -3.5, '#56603a', Math.PI / 2);
          jerryCan(-0.3 * l, g.roof + g.arch + 2.0, -0.5, '#56603a', Math.PI / 2);
          policeAdd(trim, boxGeo, -0.05 * l, g.roof + g.arch + 2.6, 2.2, 8, 1.4, 3, '#5b4a34');
          for (let k = 0; k < 6; k++) tube(trim, [tail - 0.25, def.yb + 1 + k * 1.9, -w * 0.3], [tail - 0.25, def.yb + 1 + k * 1.9, -w * 0.15], 0.14, alu);
          for (const z of [-w * 0.3, -w * 0.15]) tube(trim, [tail - 0.25, def.yb, z], [tail - 0.25, g.roof + g.arch + 1.9, z], 0.16, alu);
          policeAdd(trim, boxGeo, nose + 0.6, def.bumpers[0][1], 0, 1.2, 1.4, w * 1.04, '#1a1b1d');
          lightPod(nose + 0.8, def.bumpers[0][1] + 1.6, -w * 0.28, 0.9);
          lightPod(nose + 0.8, def.bumpers[0][1] + 1.6, w * 0.28, 0.9);
          handles([0.16, -0.02]);
        } else if (type === 'crawler') {
          // Seven-slot grille, winch bumper, windscreen frame and sport cage, soft
          // bikini top, visible seats, rear spare, sliders, a light bar on the screen.
          const grilleY = topAt(nose - 0.5) - 3.2;
          policeAdd(trim, boxGeo, nose + 0.05, grilleY, 0, 0.25, 4.2, w * 0.7, '#121315');
          for (let i = -3; i <= 3; i++) policeAdd(paint, roundedBar(0.3, 3.4, w * 0.075, 0.2), nose + 0.2, grilleY, i * w * 0.1, 1, 1, 1, '#ffffff', swatch('hood'));
          const screenFoot = [g.xf * l, g.base, 0],
            screenTop = [g.rf * l, g.roof, 0];
          for (const side of [-1, 1]) {
            tube(trim, [screenFoot[0], screenFoot[1], side * g.wb * w], [screenTop[0], screenTop[1], side * g.wb * w], 0.4, black);
            // Sport cage: hoops over the seats, bars back to the tub.
            tube(trim, [screenTop[0], screenTop[1], side * g.wb * w], [-0.12 * l, g.roof, side * g.wb * w], 0.38, black);
            tube(trim, [-0.12 * l, g.roof, side * g.wb * w], [-0.12 * l, def.h, side * g.wb * w], 0.38, black);
            tube(trim, [-0.12 * l, g.roof, side * g.wb * w], [-0.44 * l, g.roof - 0.4, side * g.wb * w], 0.34, black);
            tube(trim, [-0.44 * l, g.roof - 0.4, side * g.wb * w], [-0.44 * l, def.h, side * g.wb * w], 0.34, black);
            // Seats, front and rear, with headrests.
            for (const sx of [0.02, -0.26]) {
              policeAdd(trim, roundedBar(2.6, 1.0, 3.2, 0.4), sx * l, def.h + 0.2, side * w * 0.2, 1, 1, 1, '#1f2023', null, 0, Math.PI / 2, 0);
              policeAdd(trim, roundedBar(0.9, 4.2, 3.2, 0.4), sx * l - 1.4, def.h + 2.2, side * w * 0.2, 1, 1, 1, '#1f2023', null, 0, Math.PI / 2, 0.12);
            }
          }
          tube(trim, [screenTop[0], screenTop[1], -g.wb * w], [screenTop[0], screenTop[1], g.wb * w], 0.4, black);
          tube(trim, [-0.12 * l, g.roof, -g.wb * w], [-0.12 * l, g.roof, g.wb * w], 0.38, black);
          // Bikini top over the front seats.
          policeAdd(trim, boxGeo, (screenTop[0] - 0.12 * l) / 2, g.roof + 0.45, 0, screenTop[0] + 0.12 * l, 0.25, g.wb * w * 2.1, '#18191b');
          lightBar(screenTop[0] - 0.2, g.roof + 1.2, g.wb * w * 1.8);
          for (const side of [-1, 1]) lightPod(screenFoot[0] + 0.5, g.base + 0.8, side * (g.wb * w + 0.6), 0.55);
          policeAdd(trim, boxGeo, -0.2 * l, def.h - 0.1, 0, 0.3 * l, 0.2, w * 0.3, '#1f2023');
          // Steering wheel.
          policeAdd(trim, S.cylinderLow, 0.1 * l, def.h + 2.2, -w * 0.2, 1.1, 0.2, 1.1, '#111', null, 0, 0, 1.1);
          spareOnBack(def.yb + 5.2);
          steelBumper(true, true, false);
          steelBumper(false, false, false);
          rockSliders();
        } else if (type === 'bronco') {
          // Classic: white grille surround and letters, round lamps, chrome bumpers,
          // swing-away spare, a white hardtop.
          const grilleY = topAt(nose - 0.5) - 2.3;
          policeAdd(paint, boxGeo, nose + 0.05, grilleY, 0, 0.35, 3.0, w * 0.86, '#ffffff', swatch('roof'));
          policeAdd(trim, boxGeo, nose + 0.2, grilleY, 0, 0.12, 2.2, w * 0.5, '#101113');
          for (let i = 0; i < 6; i++) policeAdd(trim, boxGeo, nose + 0.28, grilleY + 0.1, (i - 2.5) * w * 0.075, 0.05, 1.0, 0.9, '#e4e2da');
          policeAdd(bright, roundedBar(w * 1.0, 1.1, 1.0, 0.3), nose + 0.6, def.bumpers[0][1], 0, 1, 1, 1, '#d9dde0');
          policeAdd(bright, roundedBar(w * 1.0, 1.1, 1.0, 0.3), tail - 0.5, def.bumpers[1][1], 0, 1, 1, 1, '#d9dde0');
          spareOnBack(def.yb + 5.0);
          tube(trim, [tail - 0.8, def.bumpers[1][1], w * 0.42], [tail - 0.8, def.yb + 7.5, w * 0.42], 0.3, steel);
          handles([0.14]);
          for (const side of [-1, 1]) policeAdd(bright, boxGeo, 0.02 * l, def.h - 1.0, side * (halfAt(0, def.h - 1) + 0.08), 0.4 * l, 0.12, 0.1, '#d9dde0');
          roofRack(g.rb * l + 1.5, g.rf * l - 2, g.roof + g.arch + 1.1, g.wt * w * 0.92);
          policeAdd(trim, boxGeo, -0.18 * l, g.roof + g.arch + 1.5, 0, 6, 1.2, 4.5, '#3a3f2f');
          jerryCan(-0.36 * l, g.roof + g.arch + 1.2, -2.5, '#b22a1e', Math.PI / 2);
        } else if (type === 'expedition') {
          // Overland wagon: bull bar and winch, snorkel, full rack with a roof tent,
          // jerry cans and sand ladders, rear ladder and spare, light bar, sliders.
          const grilleY = topAt(nose - 0.5) - 2.0;
          policeAdd(trim, boxGeo, nose + 0.05, grilleY, 0, 0.3, 2.6, w * 0.58, '#15161a');
          for (let i = 0; i < 5; i++) policeAdd(bright, boxGeo, nose + 0.2, grilleY - 1 + i * 0.5, 0, 0.08, 0.18, w * 0.56, '#aeb3b7');
          steelBumper(true, true, true);
          steelBumper(false, false, false);
          snorkel(1);
          rockSliders();
          const rackY = g.roof + g.arch + 1.4,
            x0 = g.rb * l + 0.5,
            x1 = g.rf * l - 0.4;
          roofRack(x0, x1, rackY, g.wt * w * 1.0);
          // Roof tent: a folded shell with its grey cover over the front two-thirds.
          policeAdd(trim, roundedBar(g.wt * w * 2.0, 1.7, (x1 - x0) * 0.58, 0.4), x1 - (x1 - x0) * 0.32, rackY + 1.0, 0, 1, 1, 1, '#4b4f52', null, 0, Math.PI / 2, 0);
          policeAdd(trim, boxGeo, x1 - (x1 - x0) * 0.32, rackY + 0.2, 0, (x1 - x0) * 0.6, 0.35, g.wt * w * 2.04, '#1b1c1e');
          policeAdd(trim, boxGeo, x1 - (x1 - x0) * 0.32, rackY + 1.9, g.wt * w * 0.2, (x1 - x0) * 0.5, 0.1, 0.4, '#d9a441');
          for (const k of [0, 1, 2]) jerryCan(x0 + 1.4, rackY, -g.wt * w * 0.7 + k * 1.2, k === 2 ? '#2f5d9a' : '#b22a1e', Math.PI / 2);
          for (const side of [-1, 1]) policeAdd(trim, boxGeo, x0 + (x1 - x0) * 0.25, rackY + 0.5, side * (g.wt * w + 0.3), (x1 - x0) * 0.45, 0.22, 3.2, '#e2721f', null, Math.PI / 2 - 0.12 * side, 0, 0);
          lightBar(x1 - 0.2, rackY + 0.6, g.wt * w * 1.7);
          spareOnBack(def.yb + 4.6);
          for (let k = 0; k < 7; k++) tube(trim, [tail - 0.25, def.yb + 2.2 + k * 1.75, w * 0.18], [tail - 0.25, def.yb + 2.2 + k * 1.75, w * 0.36], 0.14, black);
          for (const z of [w * 0.18, w * 0.36]) tube(trim, [tail - 0.25, def.yb + 1.5, z], [tail - 0.25, rackY, z], 0.16, black);
          handles([0.16, -0.02, -0.2]);
        } else if (type === 'hilux') {
          // Arctic-style pickup: flares, snorkel, roof light bar, sports bar and a
          // loaded bed (cases, jerry cans, a spare), bull bar with pods.
          const grilleY = topAt(nose - 0.5) - 1.9;
          policeAdd(trim, roundedBar(w * 0.62, 2.4, 0.5, 0.4), nose - 0.1, grilleY, 0, 1, 1, 1, '#111214');
          policeAdd(bright, boxGeo, nose + 0.15, grilleY + 0.9, 0, 0.1, 0.25, w * 0.6, '#c9ccce');
          policeAdd(bright, roundedBar(1.8, 1.1, 0.2, 0.3), nose + 0.2, grilleY, 0, 1, 1, 1, '#c9ccce');
          steelBumper(true, true, true);
          for (const side of [-1, 1]) lightPod(nose + 1.2, topAt(nose - 1) + 0.1, side * w * 0.26, 0.8);
          steelBumper(false, false, false);
          snorkel(1);
          lightBar(g.rf * l - 1.2, g.roof + g.arch + 0.9, g.wt * w * 1.8);
          for (const side of [-1, 1]) policeAdd(trim, boxGeo, g.rf * l - 1.2, g.roof + g.arch + 0.35, side * g.wt * w * 0.8, 0.8, 0.6, 0.6, black);
          const [bx, floor, wall] = def.bed;
          for (const side of [-1, 1]) {
            const z = side * (halfAt(bx * l - 2, floor + 1) - 0.25);
            policeAdd(paint, boxGeo, (bx * l + tail) / 2, (floor + wall) / 2, z, bx * l - tail, wall - floor, 0.5, '#ffffff', swatch('door'));
            policeAdd(trim, boxGeo, (bx * l + tail) / 2, wall + 0.1, z, bx * l - tail, 0.2, 0.7, black);
            // Sports bar behind the cab.
            tube(trim, [bx * l - 1.2, wall, z * 0.95], [bx * l - 1.6, wall + 3.4, z * 0.8], 0.38, black);
          }
          tube(trim, [bx * l - 1.6, wall + 3.4, -w * 0.38], [bx * l - 1.6, wall + 3.4, w * 0.38], 0.38, black);
          policeAdd(paint, boxGeo, tail + 0.25, (floor + wall) / 2, 0, 0.5, wall - floor, w * 0.92, '#ffffff', swatch('trunk'));
          policeAdd(trim, boxGeo, tail + 0.2, wall - 0.5, 0, 0.1, 0.6, w * 0.4, '#17181a');
          policeAdd(trim, boxGeo, bx * l - 0.5, (floor + g.base) / 2, 0, 0.5, g.base - floor, w * 0.9, '#eeeeea');
          policeAdd(trim, roundedBar(4.0, 2.6, 3.0, 0.3), -0.28 * l, floor + 1.3, -2.4, 1, 1, 1, '#2b2d31');
          policeAdd(trim, roundedBar(3.0, 2.2, 2.4, 0.3), -0.4 * l, floor + 1.1, -2.6, 1, 1, 1, '#c77a1e');
          jerryCan(-0.3 * l, floor, 3.0, '#b22a1e', 0);
          jerryCan(-0.36 * l, floor, 3.0, '#b22a1e', 0);
          spares.push({ x: -0.43 * l, y: floor + 1.9, z: 2.6, rx: 0, ry: 0, lie: true });
          handles([0.14, -0.04]);
          rockSliders();
        } else if (type === 'sixbysix') {
          // Portal-axled 6x6 wagon-pickup: square grille, big flares, rack with a
          // light bar, a rollbar in the bed with pods, a spare in the bed, side pipes.
          const grilleY = topAt(nose - 0.5) - 2.3;
          policeAdd(trim, boxGeo, nose + 0.05, grilleY, 0, 0.3, 2.6, w * 0.5, '#101113');
          for (let i = 0; i < 4; i++) policeAdd(paint, boxGeo, nose + 0.2, grilleY - 0.9 + i * 0.6, 0, 0.12, 0.28, w * 0.48, '#ffffff', swatch('hood'));
          steelBumper(true, true, false);
          steelBumper(false, false, false);
          for (const side of [-1, 1]) {
            // Indicator pods on the wings, the G-wagen's signature.
            policeAdd(trim, roundedBar(1.2, 0.8, 1.2, 0.3), 0.44 * l, topAt(0.44 * l) + 0.4, side * w * 0.44, 1, 1, 1, '#d98a1a');
            // Side exhausts ahead of the rear axles.
            tube(bright, [-0.02 * l, def.yb + 0.6, side * (halfAt(0, def.yb + 1) + 0.3)], [0.04 * l, def.yb + 0.6, side * (halfAt(0, def.yb + 1) + 0.3)], 0.45, '#9aa0a4');
          }
          roofRack(g.rb * l + 0.8, g.rf * l - 0.6, g.roof + g.arch + 1.2, g.wt * w * 0.98);
          lightBar(g.rf * l - 0.8, g.roof + g.arch + 1.9, g.wt * w * 1.8);
          const [bx, floor, wall] = def.bed;
          for (const side of [-1, 1]) {
            const z = side * (halfAt(bx * l - 2, floor + 1) - 0.25);
            policeAdd(paint, boxGeo, (bx * l + tail) / 2, (floor + wall) / 2, z, bx * l - tail, wall - floor, 0.5, '#ffffff', swatch('door'));
            policeAdd(trim, boxGeo, (bx * l + tail) / 2, wall + 0.1, z, bx * l - tail, 0.25, 0.8, black);
            tube(trim, [bx * l - 1.0, wall, z * 0.95], [bx * l - 1.0, wall + 4.2, z * 0.8], 0.4, black);
          }
          tube(trim, [bx * l - 1.0, wall + 4.2, -w * 0.38], [bx * l - 1.0, wall + 4.2, w * 0.38], 0.4, black);
          for (const side of [-1, 1]) lightPod(bx * l - 0.6, wall + 4.9, side * w * 0.2, 0.7);
          policeAdd(paint, boxGeo, tail + 0.25, (floor + wall) / 2, 0, 0.5, wall - floor, w * 0.92, '#ffffff', swatch('trunk'));
          policeAdd(trim, boxGeo, bx * l - 0.5, (floor + g.base) / 2, 0, 0.5, g.base - floor, w * 0.9, '#7d7556');
          spares.push({ x: -0.3 * l, y: floor + 1.7, z: 0, rx: 0, ry: 0, lie: true });
          handles([0.14, -0.02]);
        } else if (type === 'trophy') {
          // Baja trophy truck: long nose with a louvered hood, roof scoop and pods,
          // an open bed of cage tubes over two spares, the rear coilovers and bypass
          // shocks, a front light bar, number plates on the roof.
          const grilleY = topAt(nose - 0.5) - 1.5;
          policeAdd(trim, roundedBar(w * 0.7, 1.4, 0.4, 0.4), nose - 0.05, grilleY, 0, 1, 1, 1, '#101113');
          for (let k = 0; k < 6; k++) policeAdd(trim, boxGeo, (0.34 - k * 0.025) * l, topAt((0.34 - k * 0.025) * l) + 0.05, 0, 0.4, 0.1, w * 0.4, '#151618');
          lightBar(0.3 * l, topAt(0.3 * l) + 1.4, w * 0.8);
          for (const side of [-1, 1]) tube(trim, [0.3 * l, topAt(0.3 * l), side * w * 0.3], [0.3 * l, topAt(0.3 * l) + 1.0, side * w * 0.3], 0.2, black);
          policeAdd(paint, roundedBar(2.2, 1.2, 3.4, 0.4), (g.rb + g.rf) * 0.5 * l, g.roof + g.arch + 0.6, 0, 1, 1, 1, '#ffffff', swatch('roof'));
          for (const side of [-1, 1]) lightPod(g.rf * l - 0.4, g.roof + g.arch + 0.9, side * w * 0.22, 0.6);
          const [bx, floor] = def.bed,
            cage = floor + 5.6;
          for (const side of [-1, 1]) {
            const z = side * w * 0.46;
            tube(trim, [bx * l - 0.5, g.roof - 0.5, side * w * 0.3], [tail + 1, cage, z], 0.3, '#1b1c1e');
            tube(trim, [tail + 1, cage, z], [tail + 0.6, floor, z], 0.3, '#1b1c1e');
            tube(trim, [bx * l - 1, floor + 0.2, z], [tail + 0.6, floor + 0.2, z], 0.28, '#1b1c1e');
            // Rear coilover and bypass shocks leaning in from the axle to the cage.
            const ax = def.wheel.xs[1] * l;
            tube(bright, [ax + 1.4, r + 0.6, side * (zWheel - 1.2)], [ax + 3.8, cage - 0.4, side * w * 0.36], 0.55, '#c9a227');
            tube(trim, [ax + 1.0, r + 0.6, side * (zWheel - 1.4)], [ax + 3.2, cage - 0.6, side * w * 0.3], 0.45, '#2b2d30');
            tube(bright, [ax - 1.2, r + 0.6, side * (zWheel - 1.3)], [ax - 0.6, cage - 1.0, side * w * 0.38], 0.4, '#b8292a');
            // Front shock towers through the hood.
            tube(bright, [def.wheel.xs[0] * l, r + 0.5, side * (zWheel - 1.1)], [def.wheel.xs[0] * l - 1, topAt(def.wheel.xs[0] * l) + 1.2, side * w * 0.34], 0.5, '#c9a227');
          }
          tube(trim, [tail + 1, cage, -w * 0.46], [tail + 1, cage, w * 0.46], 0.3, '#1b1c1e');
          tube(trim, [bx * l - 0.5, g.roof - 0.5, -w * 0.3], [bx * l - 0.5, g.roof - 0.5, w * 0.3], 0.3, '#1b1c1e');
          spares.push({ x: -0.35 * l, y: floor + 3.2, z: -w * 0.18, ry: 0, rx: 0, lean: 0.35 });
          spares.push({ x: -0.35 * l, y: floor + 3.2, z: w * 0.18, ry: 0, rx: 0, lean: -0.35 });
          policeAdd(trim, roundedBar(w * 0.9, 1.6, 1.2, 0.3), -0.36 * l, floor + 1.0, 0, 1, 1, 1, '#2b2d30');
          policeAdd(trim, boxGeo, tail + 0.3, floor + 2.0, 0, 0.3, 2.4, w * 0.5, '#151618');
          policeAdd(paint, boxGeo, tail + 0.4, floor + 2.0, 0, 0.1, 1.6, 3.2, '#ffffff', swatch('base'));
          mirrors(false);
        }
        kit.paint = policeGeometry(paint);
        kit.trim = policeGeometry(trim);
        kit.bright = bright.count ? policeGeometry(bright) : null;
        kit.lens = lens.count ? policeGeometry(lens) : null;
        offroadKits.set(key, kit);
        return kit;
      }
      // ---- The model ----------------------------------------------------------------------------
      const offroadLensMaterial = new Three.MeshStandardMaterial({ color: '#f2f1ea', emissive: '#fff4dc', emissiveIntensity: 0, roughness: 0.1, metalness: 0.6 }),
        offroadHalo = new Three.SpriteMaterial({ color: '#fff1d6' });
      let offroadClaimed = false;
      /*
       * A club truck, on makeVehicle's contract (render3d.js): shell / cabin for the
       * crumple and the panes, hood, bumpers, wheels, lamps, nightLights in lampOut
       * order, dims. `offroad` marks it for animateOffroadVehicle.
       */
      function makeOffroadVehicle(vehicle) {
        claimPoliceResources();
        if (!offroadClaimed) {
          offroadClaimed = true;
          sharedMaterials.add(offroadLensMaterial);
          sharedMaterials.add(offroadHalo);
        }
        const spec = vehicleSpec(vehicle),
          type = spec.clubModel,
          def = OFFROAD_BODIES[type],
          l = spec.l,
          w = spec.w * def.bodyW,
          kit = offroadKit(type, def, l, w, spec.w),
          g = def.glass,
          group = new Three.Group(),
          body = new Three.Group(),
          uniforms = mudUniforms();
        group.add(body);
        scene.add(group);
        const livery = offroadLiveryTexture(type, def, l, w),
          finish = type === 'sixbysix' ? { roughness: 0.62, metalness: 0.05 } : type === 'series' ? { roughness: 0.5, metalness: 0.05 } : { roughness: 0.32, metalness: 0.1 },
          paint = vehicleMudPatch(
            new Three.MeshPhysicalMaterial({ color: '#ffffff', map: livery, roughness: finish.roughness, metalness: finish.metalness, clearcoat: type === 'sixbysix' ? 0.1 : 1, clearcoatRoughness: 0.08 }),
            uniforms,
          ),
          trimMaterial = vehicleMudPatch(new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 }), uniforms),
          tyreMaterial = vehicleMudPatch(new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }), uniforms, true);
        const shell = mesh(kit.shell, paint, body, 0, 0, 0),
          cabin = kit.cabin
            ? mesh(kit.cabin, policeGlass, body, 0, 0, 0)
            : box(body, g.xf * l + 0.2, (g.base + g.roof) / 2, 0, 0.25, g.roof - g.base - 0.6, g.wb * w * 1.9, policeGlass),
          hood = mesh(kit.hood, paint, body, l * 0.34, def.hood[0], 0, l * 0.25, 0.4, w * def.hood[1]);
        if (!kit.cabin) cabin.rotation.z = -Math.atan2((g.xf - g.rf) * l, g.roof - g.base);
        mesh(kit.paint, paint, body, 0, 0, 0);
        mesh(kit.trim, trimMaterial, body, 0, 0, 0);
        if (kit.bright) mesh(kit.bright, policeBrightMaterial, body, 0, 0, 0);
        if (kit.lens) mesh(kit.lens, offroadLensMaterial, body, 0, 0, 0).castShadow = false;
        const bumpers = def.bumpers.map(([x, y, sx, sy, sz]) => box(body, x * l, y, 0, sx, sy, sz * w, policeBumperMaterial));
        const wheels = [],
          knuckles = [],
          r = def.wheel.r;
        for (const fx of def.wheel.xs)
          for (const side of [-1, 1]) {
            const knuckle = new Three.Group(),
              wheel = new Three.Group();
            knuckle.position.set(fx * l, r, side * kit.zWheel);
            body.add(knuckle);
            // A hair off centre so damage3d.js files it as front or rear.
            wheel.position.set(fx > 0 ? 0.01 : -0.01, 0, 0);
            knuckle.add(wheel);
            // The tyre stays the wheel's first child (hidden on a burnt wreck).
            mesh(kit.tyre, tyreMaterial, wheel, 0, 0, 0);
            mesh(kit.rims[side < 0 ? 0 : 1], policeWheelMaterial, wheel, 0, 0, 0);
            wheels.push({ wheel, side });
            knuckles.push({ knuckle, x: fx * l, z: side * kit.zWheel, front: fx > 0, driven: spec.drive !== 'rwd' || fx < 0, baseY: r, offset: 0 });
          }
        for (const s of kit.spares) {
          const holder = new Three.Group();
          holder.position.set(s.x, s.y, s.z);
          holder.rotation.set(s.rx || 0, s.ry || 0, s.lean || 0);
          if (s.lie) holder.rotation.x = Math.PI / 2;
          body.add(holder);
          mesh(kit.tyre, tyreMaterial, holder, 0, 0, 0);
          mesh(kit.rims[1], policeWheelMaterial, holder, 0, 0, 0);
        }
        const lamps = [],
          nightLights = [],
          [hx, hy, hz, hsx, hsy, hsz, round] = def.head,
          [tx, ty, tz, tsx, tsy, tsz] = def.tail,
          S = policeShapeKit();
        for (const side of [-1, 1]) {
          const head = round
            ? mesh(S.cylinder, warmLamp, body, hx * l, hy, side * hz * w, hsy / 2, 0.35, hsy / 2)
            : box(body, hx * l, hy, side * hz * w, hsx, hsy, hsz * w, warmLamp);
          if (round) head.rotation.z = Math.PI / 2;
          lamps.push(
            { mesh: head, key: side < 0 ? 'headLeft' : 'headRight', lit: warmLamp },
            { mesh: box(body, tx * l, ty, side * tz * w, tsx, tsy, tsz * w, tailLamp), key: side < 0 ? 'tailLeft' : 'tailRight', lit: tailLamp },
          );
          nightLights.push(halo(body, hx * l + 0.5, hy, side * hz * w, 11, '#ffe9bd'), halo(body, tx * l - 0.5, ty, side * tz * w, 7, '#ff5a44'));
        }
        const extraHalos = kit.anchors.map((a) => {
          const sprite = new Three.Sprite(offroadHalo);
          sprite.position.set(a.x, a.y, a.z);
          sprite.scale.set(a.size, a.size, 1);
          sprite.visible = false;
          body.add(sprite);
          return sprite;
        });
        const wiperHost = {};
        if (!def.open) addWipers(wiperHost, body, g.xf * l, g.base + 0.4, lerpNumber(g.xf, g.rf, 0.55) * l, lerpNumber(g.base, g.roof, 0.55), g.wb * w * 0.92);
        return {
          wipers: wiperHost.wipers,
          group,
          body,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          car: true,
          offroad: true,
          dims: { l, w, h: def.h, roof: g.roof, van: true },
          shell,
          shellBase: shell.geometry.attributes.position.array,
          cabin,
          cabinBase: kit.cabin ? cabin.geometry.attributes.position.array : null,
          wheels,
          knuckles,
          wheelRadius: r,
          spin: 0,
          bumpers,
          bumperOrigins: bumpers.map((b) => b.position.clone()),
          hood,
          hoodBaseY: def.hood[0],
          lamps,
          damageVersion: -1,
          nightLights,
          extraHalos,
          rearDoors: null,
          liveryMap: livery,
          liveryColor: '#ffffff',
          finish,
          bumperMaterial: policeBumperMaterial,
          glass: policeGlass,
          panelGeometry: kit.door,
          trunkGeometry: kit.trunk,
          mudUniforms: uniforms,
        };
      }
      /*
       * Per frame, for a club truck in view: the wheels turn at the wheel speed
       * (ahead of the ground when spinning), the fronts steer, every wheel follows
       * the ground under it within the suspension's travel, the light bars glow at
       * night, and the mud uniforms follow the truck.
       */
      function animateOffroadVehicle(c, m, deltaSeconds) {
        const spec = vehicleSpec(c),
          along = c.speed || 0,
          roll = along * deltaSeconds,
          spinExtra = (c.spinSpeed || 0) * (along < -2 ? -1 : 1) * deltaSeconds,
          r = m.wheelRadius;
        m.spin -= (roll + spinExtra) / r;
        m.rollOnly = (m.rollOnly || 0) - roll / r;
        const steer = clamp(Math.atan(((c.av || 0) * spec.l * 0.62) / Math.max(Math.abs(along), 12)) * Math.sign(along || 1), -0.62, 0.62),
          cos = Math.cos(c.a),
          sin = Math.sin(c.a),
          onGround = !!c.offroadState,
          travel = r * 0.45 * (spec.travel || 1),
          pitch = Math.sin(c.slopePitch || 0),
          rollSlope = Math.sin(c.slopeRoll || 0),
          centre = c.groundHeight || 0,
          ease = 1 - Math.exp(-deltaSeconds * 18),
          rough = onGround ? (c.surfaceRock > 0.5 ? 1.1 : 0.35 + 0.4 * c.surfaceMud) : 0;
        for (let i = 0; i < m.knuckles.length; i++) {
          const k = m.knuckles[i],
            wheel = m.wheels[i].wheel;
          wheel.rotation.z = k.driven ? m.spin : m.rollOnly;
          if (k.front) k.knuckle.rotation.y = -steer;
          let target = 0;
          if (onGround) {
            const wx = c.x + cos * k.x - sin * k.z,
              wy = c.y + sin * k.x + cos * k.z,
              ground = terrainHeight(wx, wy) + (terrainNoise(wx / 9, wy / 9, 71) * 0.5) * rough;
            target = clamp(ground - (centre + k.x * pitch - k.z * rollSlope), -travel, travel);
          }
          k.offset += (target - k.offset) * ease;
          k.knuckle.position.y = k.baseY + k.offset;
        }
        applyVehicleMud(c, m);
        // Light bars and pods at night on a driven truck.
        const lampsOn = vehicleLampAmount();
        if (lampsOn > 0.25 && c.hp > 0 && (c === player.car || c.ai)) for (const sprite of m.extraHalos) queueVehicleHalo(sprite, 0.7 * lampsOn);
        const glow = c.hp > 0 && c === player.car ? lampsOn * 2.4 : 0;
        if (offroadLensMaterial.emissiveIntensity !== glow && c === player.car) offroadLensMaterial.emissiveIntensity = glow;
      }
      // ---- Mud, dust, splats and tracks -----------------------------------------------------------
      const MUD_CLUMPS = 640,
        MUD_MIST = 360,
        MUD_SPLATS = 700,
        MUD_TRACKS = 1800;
      // Clumps: lit, instanced lumps flying ballistic arcs.
      const clumpMesh = new Three.InstancedMesh(
          new Three.IcosahedronGeometry(1, 0),
          new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62, metalness: 0 }),
          MUD_CLUMPS,
        ),
        clump = {
          x: new Float32Array(MUD_CLUMPS),
          y: new Float32Array(MUD_CLUMPS),
          z: new Float32Array(MUD_CLUMPS),
          vx: new Float32Array(MUD_CLUMPS),
          vy: new Float32Array(MUD_CLUMPS),
          vz: new Float32Array(MUD_CLUMPS),
          life: new Float32Array(MUD_CLUMPS),
          size: new Float32Array(MUD_CLUMPS),
          wet: new Float32Array(MUD_CLUMPS),
          count: 0,
        };
      clumpMesh.count = 0;
      clumpMesh.frustumCulled = false;
      clumpMesh.castShadow = false;
      clumpMesh.userData.dynamic = true;
      clumpMesh.name = 'mud clumps';
      clumpMesh.setColorAt(0, new Three.Color(1, 1, 1));
      scene.add(clumpMesh);
      // Mist and dust: soft billboards with their own size and opacity.
      function billboardPool(capacity, name) {
        const geo = new Three.InstancedBufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        const at = (n) => new Three.InstancedBufferAttribute(new Float32Array(capacity * n), n).setUsage(Three.DynamicDrawUsage);
        geo.setAttribute('iPos', at(3));
        geo.setAttribute('iSize', at(1));
        geo.setAttribute('iAlpha', at(1));
        geo.setAttribute('iColor', at(3));
        geo.instanceCount = 0;
        const material = new Three.ShaderMaterial({
          uniforms: { uLight: { value: 1 } },
          vertexShader: `
            attribute vec3 iPos; attribute float iSize; attribute float iAlpha; attribute vec3 iColor;
            varying vec2 vUv; varying float vAlpha; varying vec3 vColor;
            void main() {
              vec3 right = vec3( viewMatrix[ 0 ][ 0 ], viewMatrix[ 1 ][ 0 ], viewMatrix[ 2 ][ 0 ] );
              vec3 up = vec3( viewMatrix[ 0 ][ 1 ], viewMatrix[ 1 ][ 1 ], viewMatrix[ 2 ][ 1 ] );
              vec3 p = iPos + ( right * position.x + up * position.y ) * iSize;
              vUv = position.xy + 0.5; vAlpha = iAlpha; vColor = iColor;
              gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
            }`,
          fragmentShader: `
            uniform float uLight; varying vec2 vUv; varying float vAlpha; varying vec3 vColor;
            void main() {
              float d = length( vUv - 0.5 ) * 2.0;
              float a = ( 1.0 - smoothstep( 0.35, 1.0, d ) ) * vAlpha;
              if ( a < 0.01 ) discard;
              gl_FragColor = vec4( vColor * uLight, a );
              #include <colorspace_fragment>
            }`,
          transparent: true,
          depthWrite: false,
        });
        const meshPool = new Three.Mesh(geo, material);
        meshPool.frustumCulled = false;
        meshPool.renderOrder = 3;
        meshPool.name = name;
        meshPool.userData.dynamic = true;
        scene.add(meshPool);
        return {
          mesh: meshPool,
          geo,
          x: new Float32Array(capacity),
          y: new Float32Array(capacity),
          z: new Float32Array(capacity),
          vx: new Float32Array(capacity),
          vy: new Float32Array(capacity),
          vz: new Float32Array(capacity),
          life: new Float32Array(capacity),
          max: new Float32Array(capacity),
          size: new Float32Array(capacity),
          grow: new Float32Array(capacity),
          alpha: new Float32Array(capacity),
          r: new Float32Array(capacity),
          g: new Float32Array(capacity),
          b: new Float32Array(capacity),
          count: 0,
          capacity,
        };
      }
      const mist = billboardPool(MUD_MIST, 'mud mist');
      /*
       * Ground decals (splats and tracks): a quad per instance laid on the ground
       * along `iAxis` (its length) and `iSide` (its width), multiplied into what is
       * under it, fading from its birth over `iLife.y` seconds.
       */
      function decalPool(capacity, texture, name) {
        const geo = new Three.InstancedBufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        const at = (n) => new Three.InstancedBufferAttribute(new Float32Array(capacity * n), n).setUsage(Three.DynamicDrawUsage);
        geo.setAttribute('iPos', at(3));
        geo.setAttribute('iAxis', at(3));
        geo.setAttribute('iSide', at(3));
        geo.setAttribute('iLife', at(3));
        geo.instanceCount = 0;
        const material = new Three.ShaderMaterial({
          uniforms: { uTime: { value: 0 }, uMap: { value: texture } },
          vertexShader: `
            attribute vec3 iPos; attribute vec3 iAxis; attribute vec3 iSide; attribute vec3 iLife;
            varying vec2 vUv; varying float vFade; varying float vWet;
            uniform float uTime;
            void main() {
              vec3 p = iPos + iAxis * position.x + iSide * position.y;
              vUv = uv;
              float age = uTime - iLife.x;
              vFade = clamp( 1.0 - age / iLife.y, 0.0, 1.0 ) * step( 0.0, age );
              vWet = iLife.z;
              gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
            }`,
          fragmentShader: `
            uniform sampler2D uMap; varying vec2 vUv; varying float vFade; varying float vWet;
            void main() {
              vec4 t = texture2D( uMap, vUv );
              float a = t.a * vFade;
              if ( a < 0.01 ) discard;
              // Multiplied into the ground: dark, wet mud darker still.
              vec3 tint = mix( vec3( 0.62, 0.52, 0.42 ), vec3( 0.32, 0.25, 0.19 ), vWet ) * ( 0.8 + 0.4 * t.r );
              gl_FragColor = vec4( mix( vec3( 1.0 ), tint, a ), 1.0 );
            }`,
          transparent: true,
          depthWrite: false,
          blending: Three.CustomBlending,
          blendSrc: Three.DstColorFactor,
          blendDst: Three.ZeroFactor,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        });
        const meshPool = new Three.Mesh(geo, material);
        meshPool.frustumCulled = false;
        meshPool.renderOrder = 1;
        meshPool.name = name;
        meshPool.userData.dynamic = true;
        scene.add(meshPool);
        return { mesh: meshPool, geo, material, next: 0, used: 0, capacity };
      }
      function decalTexture(paint) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const g = canvas.getContext('2d');
        paint(g);
        const tx = new Three.CanvasTexture(canvas);
        tx.anisotropy = 4;
        return tx;
      }
      // A splat: a lumpy blob with droplets flung round it.
      const splatTexture = decalTexture((g) => {
        let seed = 7;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        g.fillStyle = 'rgba(255,255,255,0.95)';
        g.beginPath();
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * TAU,
            rr = 30 + rnd() * 16;
          if (i) g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr);
          else g.moveTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr);
        }
        g.fill();
        for (let i = 0; i < 26; i++) {
          const a = rnd() * TAU,
            d = 36 + rnd() * 26;
          g.beginPath();
          g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 1.5 + rnd() * 5, 0, TAU);
          g.fill();
        }
        g.globalCompositeOperation = 'source-atop';
        for (let i = 0; i < 120; i++) {
          g.fillStyle = `rgba(${rnd() < 0.5 ? 60 : 255},0,0,0.25)`;
          g.fillRect(rnd() * 128, rnd() * 128, 5, 5);
        }
      });
      // A tread print: chevron lugs across the track, soft edges.
      const trackTexture = decalTexture((g) => {
        g.fillStyle = 'rgba(255,255,255,0.45)';
        g.fillRect(0, 22, 128, 84);
        g.fillStyle = 'rgba(255,255,255,0.9)';
        for (let x = -16; x < 144; x += 16) {
          g.beginPath();
          g.moveTo(x, 24);
          g.lineTo(x + 7, 24);
          g.lineTo(x + 13, 64);
          g.lineTo(x + 7, 104);
          g.lineTo(x, 104);
          g.lineTo(x + 6, 64);
          g.fill();
        }
      });
      trackTexture.wrapS = Three.RepeatWrapping;
      const splats = decalPool(MUD_SPLATS, splatTexture, 'mud splats'),
        tracks = decalPool(MUD_TRACKS, trackTexture, 'tyre tracks');
      const decalNormal = new Three.Vector3(),
        decalAlong = new Three.Vector3(),
        decalAcross = new Three.Vector3();
      // Lays one decal on the ground at (x, y) along heading `a`.
      function addDecal(pool, x, y, a, length, width, seconds, wet) {
        const i = pool.next;
        pool.next = (pool.next + 1) % pool.capacity;
        pool.used = Math.min(pool.capacity, pool.used + 1);
        const h = terrainHeight(x, y),
          sx = (terrainHeight(x + 2, y) - terrainHeight(x - 2, y)) / 4,
          sy = (terrainHeight(x, y + 2) - terrainHeight(x, y - 2)) / 4;
        decalNormal.set(-sx, 1, -sy).normalize();
        decalAlong.set(Math.cos(a), 0, Math.sin(a));
        decalAlong.y = sx * decalAlong.x + sy * decalAlong.z;
        decalAlong.normalize();
        decalAcross.crossVectors(decalNormal, decalAlong).normalize();
        const at = pool.geo.attributes,
          lift = 0.12 + (h > 0.2 ? 0.1 : 0);
        at.iPos.setXYZ(i, x + decalNormal.x * lift, h + 0.06 + decalNormal.y * lift, y + decalNormal.z * lift);
        at.iAxis.setXYZ(i, decalAlong.x * length, decalAlong.y * length, decalAlong.z * length);
        at.iSide.setXYZ(i, decalAcross.x * width, decalAcross.y * width, decalAcross.z * width);
        at.iLife.setXYZ(i, gameTime, seconds, wet);
        for (const name of ['iPos', 'iAxis', 'iSide', 'iLife']) at[name].needsUpdate = true;
        pool.geo.instanceCount = pool.used;
      }
      function spawnClump(x, y, z, vx, vy, vz, size, wet) {
        if (clump.count >= MUD_CLUMPS) return;
        const i = clump.count++;
        clump.x[i] = x;
        clump.y[i] = y;
        clump.z[i] = z;
        clump.vx[i] = vx;
        clump.vy[i] = vy;
        clump.vz[i] = vz;
        clump.life[i] = 2.2;
        clump.size[i] = size;
        clump.wet[i] = wet;
      }
      function spawnMist(x, y, z, vx, vy, vz, size, grow, alpha, life, color) {
        if (mist.count >= mist.capacity) return;
        const i = mist.count++;
        mist.x[i] = x;
        mist.y[i] = y;
        mist.z[i] = z;
        mist.vx[i] = vx;
        mist.vy[i] = vy;
        mist.vz[i] = vz;
        mist.size[i] = size;
        mist.grow[i] = grow;
        mist.alpha[i] = alpha;
        mist.life[i] = mist.max[i] = life;
        mist.r[i] = color.r;
        mist.g[i] = color.g;
        mist.b[i] = color.b;
      }
      const MUD_WET = new Three.Color('#3a2a1c'),
        MUD_DRY = new Three.Color('#7a654a'),
        DUST = new Three.Color('#b6a283'),
        clumpColor = new Three.Color(),
        clumpMatrix = new Three.Matrix4(),
        clumpQuat = new Three.Quaternion(),
        clumpEuler = new Three.Euler(),
        clumpScale = new Three.Vector3(),
        clumpPos = new Three.Vector3();
      // Wheel contact points of a model in body space (club trucks: their knuckles).
      function contactWheels(c, m) {
        if (m.contacts) return m.contacts;
        const spec = vehicleSpec(c),
          list = [];
        if (m.knuckles) for (const k of m.knuckles) list.push({ x: k.x, z: k.z, driven: k.driven, r: m.wheelRadius, width: OFFROAD_BODIES[spec.clubModel].wheel.width, emit: 0, lastX: NaN, lastY: NaN });
        else if (m.wheels?.length && m.wheels[0].wheel.position)
          for (const { wheel } of m.wheels) {
            const x = wheel.position.x,
              drive = spec.drive || (spec.offroad ? '4x4' : 'rwd');
            list.push({ x, z: wheel.position.z, driven: drive === '4x4' || (drive === 'fwd' ? x > 0 : x < 0), r: wheel.position.y || 4, width: 2.6, emit: 0, lastX: NaN, lastY: NaN });
          }
        m.contacts = list;
        return list;
      }
      // Throw mud (or dust) from a vehicle's tyres and lay its tracks.
      function vehicleSpray(c, m, deltaSeconds) {
        const onRange = !!c.offroadState,
          dirt = onRange || (c.x > CITY_SIZE - 200 && landAt(c.x, c.y) && !onRoad(c.x, c.y) && !onCountyRoad(c.x, c.y, 2));
        if (!dirt || isAircraft(c) || isBoat(c) || c.hp <= 0) return;
        const along = c.speed || 0,
          speed = Math.abs(along),
          spin = c.wheelSpin || 0,
          mud = onRange ? c.surfaceMud || 0 : 0.05,
          wet = clamp(0.45 + 0.55 * (weather.wet || 0), 0, 1) * (mud > 0.1 ? 1 : 0.4),
          cos = Math.cos(c.a),
          sin = Math.sin(c.a),
          wheelSpeed = speed + (c.spinSpeed || 0),
          dir = along < -2 ? -1 : 1,
          base = entityElevation(c);
        for (const w of contactWheels(c, m)) {
          const wx = c.x + cos * w.x - sin * w.z,
            wy = c.y + sin * w.x + cos * w.z;
          // Tracks: a print every metre and a half of travel.
          if (w.lastX !== w.lastX) {
            w.lastX = wx;
            w.lastY = wy;
          }
          const moved = Math.hypot(wx - w.lastX, wy - w.lastY);
          if (moved > 12 || (moved > 2 && spin > 0.5 && moved > 6)) {
            if (moved < 40) addDecal(tracks, (wx + w.lastX) / 2, (wy + w.lastY) / 2, Math.atan2(wy - w.lastY, wx - w.lastX), moved + 1, w.width * 0.95, 90 + mud * 120, mud > 0.15 ? wet : 0.1);
            w.lastX = wx;
            w.lastY = wy;
          } else if (spin > 0.6 && speed < 8 && Math.random() < deltaSeconds * 4) addDecal(tracks, wx, wy, c.a, w.r * 1.2, w.width, 120, wet);
          if (!w.driven && spin > 0.1) continue;
          // How much is thrown: spin in mud throws the most; speed through mud some;
          // dry dirt only a haze.
          const rate = (spin * 70 + speed * (mud * 0.5 + 0.03)) * (w.driven ? 1 : 0.4) * (mud > 0.1 ? 1 : 0.25);
          w.emit += rate * deltaSeconds;
          while (w.emit >= 1) {
            w.emit -= 1;
            const throwSpeed = Math.min(160, wheelSpeed) * (0.25 + Math.random() * 0.35),
              up = 14 + Math.random() * 28 + throwSpeed * 0.35,
              sideways = (Math.random() - 0.5) * 16 + Math.sign(w.z) * Math.random() * 10,
              ox = wx - cos * dir * w.r * 0.8,
              oy = wy - sin * dir * w.r * 0.8,
              oz = base + w.r * (0.35 + Math.random() * 0.5),
              vx = -cos * dir * throwSpeed - sin * sideways + (c.vx || 0) * 0.85,
              vy = -sin * dir * throwSpeed + cos * sideways + (c.vy || 0) * 0.85;
            if (mud > 0.1) {
              spawnClump(ox, oz, oy, vx, up, vy, 0.25 + Math.random() * 0.55, wet);
              if (Math.random() < 0.5) {
                clumpColor.copy(MUD_DRY).lerp(MUD_WET, wet);
                spawnMist(ox, oz, oy, vx * 0.5, up * 0.4, vy * 0.5, 1.5 + Math.random(), 5, 0.45, 0.9 + Math.random() * 0.6, clumpColor);
              }
            } else if (Math.random() < 0.6) spawnMist(ox, oz - w.r * 0.3, oy, vx * 0.35, 4 + Math.random() * 6, vy * 0.35, 2.5 + Math.random() * 2, 9, 0.3, 1.6 + Math.random(), DUST);
          }
        }
      }
      function updateMudParticles(deltaSeconds) {
        const g = GRAVITY,
          drag = Math.exp(-0.35 * deltaSeconds);
        let n = clump.count;
        for (let i = 0; i < n; i++) {
          clump.vy[i] -= g * deltaSeconds;
          clump.vx[i] *= drag;
          clump.vz[i] *= drag;
          clump.x[i] += clump.vx[i] * deltaSeconds;
          clump.y[i] += clump.vy[i] * deltaSeconds;
          clump.z[i] += clump.vz[i] * deltaSeconds;
          clump.life[i] -= deltaSeconds;
          let dead = clump.life[i] <= 0;
          if (!dead && clump.vy[i] < 0) {
            const ground = terrainHeight(clump.x[i], clump.z[i]);
            if (clump.y[i] <= ground + 0.1) {
              dead = true;
              // A splat where it lands (the bigger lumps).
              if (clump.size[i] > 0.4 || Math.random() < 0.35) addDecal(splats, clump.x[i], clump.z[i], Math.random() * TAU, clump.size[i] * 7, clump.size[i] * 7, 70, clump.wet[i]);
            }
          }
          if (dead) {
            n--;
            for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'size', 'wet']) clump[k][i] = clump[k][n];
            i--;
          }
        }
        clump.count = n;
        for (let i = 0; i < n; i++) {
          const s = clump.size[i];
          clumpEuler.set(clump.life[i] * 7, clump.life[i] * 5, i);
          clumpQuat.setFromEuler(clumpEuler);
          clumpScale.set(s * 1.2, s * 0.8, s);
          clumpPos.set(clump.x[i], clump.y[i], clump.z[i]);
          clumpMatrix.compose(clumpPos, clumpQuat, clumpScale);
          clumpMesh.setMatrixAt(i, clumpMatrix);
          clumpMesh.setColorAt(i, clumpColor.copy(MUD_DRY).lerp(MUD_WET, clump.wet[i]));
        }
        clumpMesh.count = n;
        clumpMesh.instanceMatrix.needsUpdate = true;
        if (clumpMesh.instanceColor) clumpMesh.instanceColor.needsUpdate = true;
        // Mist and dust.
        const at = mist.geo.attributes,
          mistDrag = Math.exp(-2.2 * deltaSeconds);
        n = mist.count;
        for (let i = 0; i < n; i++) {
          mist.life[i] -= deltaSeconds;
          if (mist.life[i] <= 0) {
            n--;
            for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'size', 'grow', 'alpha', 'r', 'g', 'b']) mist[k][i] = mist[k][n];
            i--;
            continue;
          }
          mist.vx[i] *= mistDrag;
          mist.vz[i] *= mistDrag;
          mist.vy[i] = mist.vy[i] * mistDrag - g * 0.08 * deltaSeconds;
          mist.x[i] += mist.vx[i] * deltaSeconds;
          mist.y[i] += mist.vy[i] * deltaSeconds;
          mist.z[i] += mist.vz[i] * deltaSeconds;
          mist.size[i] += mist.grow[i] * deltaSeconds;
        }
        mist.count = n;
        for (let i = 0; i < n; i++) {
          const t = mist.life[i] / mist.max[i];
          at.iPos.setXYZ(i, mist.x[i], mist.y[i], mist.z[i]);
          at.iSize.setX(i, mist.size[i]);
          at.iAlpha.setX(i, mist.alpha[i] * t * Math.min(1, (1 - t) * 8));
          at.iColor.setXYZ(i, mist.r[i], mist.g[i], mist.b[i]);
        }
        for (const name of ['iPos', 'iSize', 'iAlpha', 'iColor']) at[name].needsUpdate = true;
        mist.geo.instanceCount = n;
        mist.mesh.material.uniforms.uLight.value = 1 - 0.78 * nightAmount;
      }
      // ---- The club lot ---------------------------------------------------------------------------
      const clubGroup = new Three.Group();
      clubGroup.name = '4x4 club';
      scene.add(clubGroup);
      batchGroups.push(clubGroup);
      const clubLive = new Three.Group();
      clubLive.name = '4x4 club (animated)';
      scene.add(clubLive);
      const bark = staticMat('#56412e', 0.95),
        logEnd = staticMat('#b39468', 0.9),
        canopyMetal = staticMat('#c3c7ca', 0.35, 0.7),
        clubBlack = staticMat('#1c1d1f', 0.6, 0.2),
        rust = staticMat('#7a3f22', 0.85, 0.35),
        clubStone = staticMat('#77756d', 0.95),
        clubLog = new Three.CylinderGeometry(1, 1, 1, 9);
      function clubPos(u, v) {
        return clubPoint(u, v);
      }
      // A log from a to b (map x, height, map y) of radius r.
      function logBetween(parent, ax, ay, az, bx, by, bz, radius) {
        const m = mesh(clubLog, bark, parent, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, radius, Math.hypot(bx - ax, by - ay, bz - az), radius);
        m.quaternion.setFromUnitVectors(new Three.Vector3(0, 1, 0), new Three.Vector3(bx - ax, by - ay, bz - az).normalize());
        return m;
      }
      function canvasMap(width, height, paint) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        paint(canvas.getContext('2d'), width, height);
        const tx = new Three.CanvasTexture(canvas);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      {
        const L = OFFROAD_CLUB.lot;
        // The gravel pad: stone speckle, worn wheel paths, a couple of puddles, oil.
        const padTexture = canvasMap(1024, 576, (g, W, H) => {
          let seed = 31;
          const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647),
            sx = W / L.w,
            sy = H / L.h;
          g.fillStyle = '#9c8a6d';
          g.fillRect(0, 0, W, H);
          for (let i = 0; i < 9000; i++) {
            const v = 110 + rnd() * 90;
            g.fillStyle = `rgba(${v},${v * 0.9},${v * 0.74},${0.35 + rnd() * 0.4})`;
            g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 3);
          }
          g.strokeStyle = 'rgba(70,56,40,0.35)';
          for (const off of [-7, 7]) {
            g.lineWidth = 16;
            g.beginPath();
            g.moveTo((150 + off) * sx, 0);
            g.quadraticCurveTo((150 + off) * sx, 70 * sy, 250 * sx, (90 + off) * sy);
            g.lineTo(W, (90 + off) * sy);
            g.stroke();
          }
          for (const [u, v, rx, ry] of [[70, 80, 18, 7], [236, 84, 12, 5], [40, 128, 9, 4]]) {
            g.fillStyle = 'rgba(52,44,36,0.55)';
            g.beginPath();
            g.ellipse(u * sx, v * sy, rx * sx, ry * sy, 0.3, 0, TAU);
            g.fill();
            g.fillStyle = 'rgba(120,130,135,0.35)';
            g.beginPath();
            g.ellipse(u * sx, v * sy, rx * sx * 0.75, ry * sy * 0.7, 0.3, 0, TAU);
            g.fill();
          }
          g.fillStyle = 'rgba(30,26,22,0.35)';
          for (const [u, v] of [[152, 60], [196, 62], [240, 64]]) {
            g.beginPath();
            g.ellipse(u * sx, v * sy, 6 * sx, 4 * sy, 0, 0, TAU);
            g.fill();
          }
        });
        const pad = new Three.Mesh(
          new Three.PlaneGeometry(L.w + 8, L.h + 8),
          new Three.MeshStandardMaterial({ map: padTexture, roughness: 0.96, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
        );
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(L.x + L.w / 2, 0.09, L.y + L.h / 2);
        pad.receiveShadow = true;
        pad.name = '4x4 club gravel';
        clubGroup.add(pad);
        // Log rails on short posts, open along the road.
        for (const [u0, v0, u1, v1] of OFFROAD_CLUB.rails) {
          const a = clubPos(u0, v0),
            b = clubPos(u1, v1),
            length = Math.hypot(b.x - a.x, b.y - a.y),
            posts = Math.max(1, Math.round(length / 26));
          logBetween(clubGroup, a.x, 3.3, a.y, b.x, 3.3, b.y, 1.05);
          for (let k = 0; k <= posts; k++) {
            const t = k / posts,
              x = a.x + (b.x - a.x) * t,
              y = a.y + (b.y - a.y) * t;
            logBetween(clubGroup, x, 0, y, x, 4.2, y, 0.95);
            mesh(clubLog, logEnd, clubGroup, x, 4.25, y, 0.9, 0.1, 0.9);
          }
        }
        // ---- The sign: carved planks between two log posts, chained under a
        // crossbeam, a rusted steel emblem on top, goose-neck lamps.
        const s = OFFROAD_CLUB.sign,
          face = document.createElement('canvas'),
          glowCanvas = document.createElement('canvas');
        face.width = glowCanvas.width = 1024;
        face.height = glowCanvas.height = 256;
        const glowContext = glowCanvas.getContext('2d');
        glowContext.fillStyle = '#000';
        glowContext.fillRect(0, 0, 1024, 256);
        const design = SignArt.paint(face.getContext('2d'), glowContext, 1024, 256, '4X4 CLUB', '#f3dca8', 'trail'),
          board = new Three.Mesh(new Three.PlaneGeometry(48, 12), litSignMaterial(signTexture(face), signTexture(glowCanvas), { night: design.night, day: design.day }));
        board.position.set(s.x, 21, s.y + 0.8);
        clubLive.add(board);
        box(clubGroup, s.x, 21, s.y, 49.5, 13.5, 1.2, staticMat('#3d2a1a', 0.9));
        for (const side of [-1, 1]) {
          logBetween(clubGroup, s.x + side * 27, 0, s.y, s.x + side * 27, 34, s.y, 1.5);
          mesh(clubLog, logEnd, clubGroup, s.x + side * 27, 34.05, s.y, 1.4, 0.1, 1.4);
          box(clubGroup, s.x + side * 17, 29.5, s.y, 0.25, 3.4, 0.25, clubBlack);
          // Lamps over the board.
          box(clubGroup, s.x + side * 14, 31.2, s.y + 2.2, 0.3, 0.3, 4.2, clubBlack);
          box(clubGroup, s.x + side * 14, 30.8, s.y + 4.2, 1.6, 0.8, 1.2, clubBlack);
          addGlow(s.x + side * 14, 30.2, s.y + 4.4, 5, '#ffe2b0', 1.1, { day: 0 });
        }
        logBetween(clubGroup, s.x - 31, 31.5, s.y, s.x + 31, 31.5, s.y, 1.35);
        const emblem = new Three.Mesh(
          new Three.PlaneGeometry(16, 10),
          new Three.MeshStandardMaterial({
            map: canvasMap(256, 160, (g) => {
              // A tyre ring round a mountain, cut from sheet steel and left to rust.
              g.fillStyle = '#7a3f22';
              g.beginPath();
              g.arc(128, 84, 70, 0, TAU);
              g.arc(128, 84, 52, 0, TAU, true);
              g.fill();
              for (let i = 0; i < 16; i++) {
                const a = (i / 16) * TAU;
                g.save();
                g.translate(128 + Math.cos(a) * 72, 84 + Math.sin(a) * 72);
                g.rotate(a);
                g.fillRect(-4, -8, 12, 16);
                g.restore();
              }
              g.beginPath();
              g.moveTo(66, 118);
              g.lineTo(108, 52);
              g.lineTo(126, 78);
              g.lineTo(148, 40);
              g.lineTo(192, 118);
              g.fill();
              g.fillStyle = 'rgba(40,20,10,0.5)';
              for (let i = 0; i < 400; i++) g.fillRect(Math.random() * 256, Math.random() * 160, 2, 2);
              g.fillStyle = 'rgba(200,120,70,0.35)';
              for (let i = 0; i < 300; i++) g.fillRect(Math.random() * 256, Math.random() * 160, 2, 2);
            }),
            alphaTest: 0.5,
            transparent: false,
            side: Three.DoubleSide,
            roughness: 0.8,
            metalness: 0.5,
          }),
        );
        emblem.position.set(s.x, 38, s.y);
        clubLive.add(emblem);
        // ---- Canopy: four legs, a truss, a peaked roof in club green with the
        // name on the valance; a folding table with a lantern and a map under it.
        const cp = OFFROAD_CLUB.canopy,
          half = cp.size / 2,
          canopyTexture = canvasMap(512, 128, (g, W, H) => {
            g.fillStyle = '#2f5d3a';
            g.fillRect(0, 0, W, H);
            g.fillStyle = '#f2e8cf';
            g.font = `bold 72px ${POLICE_FONT}`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText('4X4 CLUB', W / 2, H / 2 + 4);
            g.fillStyle = '#d9a441';
            g.fillRect(0, H - 14, W, 6);
          });
        for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(clubGroup, cp.x + dx * half, 10.5, cp.y + dz * half, 0.5, 21, 0.5, canopyMetal);
        const roof = new Three.Mesh(new Three.ConeGeometry(half * Math.SQRT2 * 1.02, 5.5, 4, 1, true), new Three.MeshStandardMaterial({ color: '#2f5d3a', roughness: 0.85, side: Three.DoubleSide }));
        roof.rotation.y = Math.PI / 4;
        roof.position.set(cp.x, 23.8, cp.y);
        roof.castShadow = roof.receiveShadow = true;
        clubGroup.add(roof);
        const valanceMaterial = new Three.MeshStandardMaterial({ map: canopyTexture, roughness: 0.85, side: Three.DoubleSide });
        for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
          const v = new Three.Mesh(new Three.PlaneGeometry(cp.size, 2.4), valanceMaterial);
          v.position.set(cp.x + dx * half, 19.8, cp.y + dz * half);
          v.rotation.y = ry;
          clubGroup.add(v);
        }
        box(clubGroup, cp.x, 5.9, cp.y - 4, 14.5, 0.35, 6, staticMat('#e2e0da', 0.6));
        for (const dx of [-6, 6]) for (const dz of [-6.5, -1.5]) box(clubGroup, cp.x + dx, 2.9, cp.y + dz, 0.3, 5.8, 0.3, canopyMetal);
        box(clubGroup, cp.x - 2, 6.15, cp.y - 4.5, 5, 0.1, 3.6, staticMat('#d8cfa6', 0.9));
        box(clubGroup, cp.x + 4, 6.5, cp.y - 3.5, 1.4, 1.2, 1.4, staticMat('#b8292a', 0.6));
        for (const dx of [-5, -4, 1]) mesh(cylinderGeo, staticMat('#c93a2a', 0.5), clubGroup, cp.x + dx, 6.9, cp.y - 2.5, 0.35, 1.2, 0.35);
        // Lanterns: on the table and hanging from the truss.
        const lanterns = [[cp.x + 5.5, 7.4, cp.y - 5], [cp.x - half + 2, 18.5, cp.y - half + 2], [cp.x + half - 2, 18.5, cp.y + half - 2]];
        for (const [x, y, z] of lanterns) {
          box(clubGroup, x, y, z, 1.2, 1.8, 1.2, clubBlack);
          addGlow(x, y, z, 7, '#ffcf8a', 1.6, { mode: 'flicker', day: 0 });
        }
        // Camp chairs where the members sit (offroad.js members), a cooler, a grill.
        const chairColors = ['#27456b', '#8e2a24', '#35573a', '#222'];
        let chair = 0;
        for (const [u, v, a, role] of OFFROAD_CLUB.members) {
          if (role !== 'clubSit') continue;
          const p = clubPos(u, v),
            seat = new Three.Group();
          seat.position.set(p.x, 0, p.y);
          seat.rotation.y = -a;
          clubGroup.add(seat);
          const cloth = staticMat(chairColors[chair++ % chairColors.length], 0.8);
          box(seat, -0.4, 3.5, 0, 3.8, 0.35, 4.2, cloth);
          const back = box(seat, -2.4, 6.3, 0, 0.35, 5.2, 4.2, cloth);
          back.rotation.z = -0.22;
          for (const dz of [-2, 2]) {
            const leg = box(seat, -0.4, 1.75, dz, 5, 0.28, 0.28, canopyMetal);
            leg.rotation.z = 0.62;
            const leg2 = box(seat, -0.4, 1.75, dz, 5, 0.28, 0.28, canopyMetal);
            leg2.rotation.z = -0.62;
            box(seat, -0.4, 4.8, dz * 1.08, 3.6, 0.3, 0.4, canopyMetal);
          }
        }
        const cool = OFFROAD_CLUB.cooler;
        box(clubGroup, cool.x, 1.8, cool.y, 5.6, 3.4, 3.6, staticMat('#f2f1ea', 0.5));
        box(clubGroup, cool.x, 3.7, cool.y, 5.8, 0.6, 3.8, staticMat('#2d6aa0', 0.5));
        box(clubGroup, cool.x, 4.2, cool.y, 3, 0.3, 0.5, clubBlack);
        const gr = OFFROAD_CLUB.grill;
        mesh(new Three.SphereGeometry(2.6, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2), clubBlack, clubGroup, gr.x, 6.8, gr.y);
        mesh(cylinderGeo, staticMat('#2b2b2b', 0.4, 0.6), clubGroup, gr.x, 6.8, gr.y, 2.55, 0.15, 2.55);
        const lid = mesh(new Three.SphereGeometry(2.6, 14, 6, 0, TAU, 0, Math.PI / 2), clubBlack, clubGroup, gr.x - 2.4, 7.2, gr.y);
        lid.rotation.z = 1.3;
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * TAU,
            leg = box(clubGroup, gr.x + Math.cos(a) * 1.6, 3.2, gr.y + Math.sin(a) * 1.6, 0.3, 6.6, 0.3, clubBlack);
          leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
        }
        for (let k = 0; k < 4; k++) box(clubGroup, gr.x - 1 + k * 0.7, 7.05, gr.y + (k % 2) * 0.6 - 0.3, 0.6, 0.3, 1.1, staticMat('#6b3a22', 0.8));
        addGlow(gr.x, 7.1, gr.y, 5, '#ff8a3a', 1.4, { mode: 'flicker', day: 0.15 });
        // Fire ring: stones round split logs.
        const fr = OFFROAD_CLUB.fire;
        for (let k = 0; k < 11; k++) {
          const a = (k / 11) * TAU,
            stone = mesh(new Three.IcosahedronGeometry(1, 0), clubStone, clubGroup, fr.x + Math.cos(a) * 5, 0.8, fr.y + Math.sin(a) * 5, 1.5, 1.1, 1.3);
          stone.rotation.y = k;
        }
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * TAU;
          logBetween(clubGroup, fr.x + Math.cos(a) * 2.8, 0.5, fr.y + Math.sin(a) * 2.8, fr.x - Math.cos(a) * 0.6, 2.2, fr.y - Math.sin(a) * 0.6, 0.55);
        }
        for (const [dx, dz] of [[9, -3], [10, 3]]) logBetween(clubGroup, fr.x + dx - 4, 1.6, fr.y + dz, fr.x + dx + 4, 1.6, fr.y + dz, 1.4);
        addGlow(fr.x, 2.4, fr.y, 12, '#ff9a48', 2.2, { mode: 'flicker', day: 0 });
        // A stack of spare tyres and a pair of jerry cans by the rail.
        for (let k = 0; k < 3; k++) mesh(new Three.TorusGeometry(2.7, 1.2, 8, 16), staticMat('#1c1c1d', 0.95), clubGroup, clubPos(276, 150).x, 1.2 + k * 2.3, clubPos(276, 150).y, 1, 1, 1).rotation.x = Math.PI / 2;
        // String lights: from the canopy to two poles, a bulb every metre and a half.
        const polesAt = [clubPos(40, 98), clubPos(250, 98), clubPos(210, 150)];
        for (const p of polesAt) {
          box(clubGroup, p.x, 12, p.y, 0.6, 24, 0.6, staticMat('#5a4630', 0.9));
        }
        const runs = [
          [[cp.x - half, 21, cp.y - half], [polesAt[0].x, 23.5, polesAt[0].y]],
          [[cp.x + half, 21, cp.y - half], [polesAt[1].x, 23.5, polesAt[1].y]],
          [[polesAt[1].x, 23.5, polesAt[1].y], [polesAt[2].x, 23.5, polesAt[2].y]],
          [[cp.x + half, 21, cp.y + half], [polesAt[2].x, 23.5, polesAt[2].y]],
        ];
        const wire = staticMat('#202020', 0.8);
        for (const [a, b] of runs) {
          const length = Math.hypot(b[0] - a[0], b[2] - a[2]),
            n = Math.max(2, Math.round(length / 12)),
            sag = length * 0.06;
          let prev = a;
          for (let k = 1; k <= n; k++) {
            const t = k / n,
              p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t];
            const seg = mesh(cylinderGeo, wire, clubGroup, (p[0] + prev[0]) / 2, (p[1] + prev[1]) / 2, (p[2] + prev[2]) / 2, 0.08, Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]), 0.08);
            seg.quaternion.setFromUnitVectors(new Three.Vector3(0, 1, 0), new Three.Vector3(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]).normalize());
            seg.castShadow = false;
            if (k < n) addGlow(p[0], p[1] - 0.6, p[2], 3.4, k % 3 ? '#ffd9a0' : '#ffb27a', 1.3, { day: 0, mode: 'steady' });
            prev = p;
          }
        }
        // Their light on the gravel after dark.
        signSpill(cp.x + 30, cp.y, 120, '#ffc98a', 0.55);
        signSpill(s.x, s.y + 20, 60, '#ffe2b0', 0.35);
        signSpill(fr.x, fr.y, 70, '#ff9a48', 0.5);
        statics.push({ x: L.x + L.w / 2, y: L.y + L.h / 2, group: clubGroup, radius: 260 });
      }
      // ---- The flag: club colours on a pole, flying ----------------------------------------------
      const flagPoint = OFFROAD_CLUB.flag,
        flagGeometry = new Three.PlaneGeometry(14, 9, 12, 4);
      flagGeometry.translate(7, 0, 0);
      const flagBase = Float32Array.from(flagGeometry.attributes.position.array),
        flag = new Three.Mesh(
          flagGeometry,
          new Three.MeshStandardMaterial({
            map: canvasMap(256, 160, (g) => {
              g.fillStyle = '#2f5d3a';
              g.fillRect(0, 0, 256, 160);
              g.fillStyle = '#d9a441';
              g.fillRect(0, 118, 256, 14);
              g.fillStyle = '#f2e8cf';
              g.beginPath();
              g.moveTo(40, 110);
              g.lineTo(96, 34);
              g.lineTo(122, 70);
              g.lineTo(150, 28);
              g.lineTo(214, 110);
              g.fill();
              g.fillStyle = '#2f5d3a';
              g.font = `bold 34px ${POLICE_FONT}`;
              g.textAlign = 'center';
              g.fillText('4X4', 128, 100);
            }),
            side: Three.DoubleSide,
            roughness: 0.85,
          }),
        );
      flag.position.set(flagPoint.x + 0.4, 50, flagPoint.y);
      flag.castShadow = true;
      clubLive.add(flag);
      box(clubGroup, flagPoint.x, 28, flagPoint.y, 0.7, 56, 0.7, staticMat('#d8dadc', 0.3, 0.7));
      mesh(sphereGeo, staticMat('#d9a441', 0.3, 0.8), clubGroup, flagPoint.x, 56.4, flagPoint.y, 0.8, 0.8, 0.8);
      function waveFlag() {
        const pos = flagGeometry.attributes.position,
          wind = weather.wind || 0.4,
          t = gameTime * (4 + wind * 4),
          angle = weather.windAngle || 0;
        for (let i = 0; i < pos.count; i++) {
          const x = flagBase[i * 3],
            y = flagBase[i * 3 + 1],
            f = x / 14;
          pos.setXYZ(i, x * (0.96 + 0.04 * Math.cos(t)), y - f * f * (1.6 - wind), Math.sin(x * 0.55 - t + y * 0.08) * f * (1.2 + wind * 1.4));
        }
        pos.needsUpdate = true;
        flagGeometry.computeVertexNormals();
        flag.rotation.y = -angle;
      }
      // ---- Trail furniture: start gate, checkpoints, rock steps, finish ------------------------------
      const trailGroup = new Three.Group();
      trailGroup.name = 'hill climb course';
      scene.add(trailGroup);
      batchGroups.push(trailGroup);
      const bannerMaterial = (text, colors = ['#1d1f22', '#f6ead0', '#e2721f']) =>
        new Three.MeshStandardMaterial({
          map: canvasMap(512, 96, (g, W, H) => {
            g.fillStyle = colors[0];
            g.fillRect(0, 0, W, H);
            // Chequered ends.
            for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) {
              g.fillStyle = colors[1];
              g.fillRect(i * 16, j * 32, 16, 32);
              g.fillRect(W - 96 + i * 16, j * 32, 16, 32);
            }
            g.fillStyle = colors[1];
            g.font = `bold 54px ${POLICE_FONT}`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(text, W / 2, H / 2 + 3);
            g.fillStyle = colors[2];
            g.fillRect(96, H - 8, W - 192, 5);
          }),
          side: Three.DoubleSide,
          roughness: 0.8,
        });
      function gateAt(trail, point, text, width, height) {
        const path = trail.path,
          i = point.i,
          next = path[Math.min(path.length - 1, i + 1)],
          prev = path[Math.max(0, i - 1)],
          dx = next[0] - prev[0],
          dy = next[1] - prev[1],
          len = Math.hypot(dx, dy) || 1,
          px = -dy / len,
          py = dx / len,
          half = trail.width / 2 + 5,
          ground = terrainHeight(point.x, point.y);
        for (const side of [-1, 1]) {
          const x = point.x + px * half * side,
            y = point.y + py * half * side,
            h = terrainHeight(x, y);
          box(trailGroup, x, h + height / 2 - 2, y, 1.1, height + 4, 1.1, staticMat('#e8e6df', 0.5));
          box(trailGroup, x, h + 1.2, y, 2.4, 2.4, 2.4, staticMat('#e2721f', 0.7));
        }
        if (text) {
          const banner = new Three.Mesh(new Three.PlaneGeometry(half * 2, width), bannerMaterial(text));
          banner.position.set(point.x, ground + height - 1, point.y);
          banner.rotation.y = -Math.atan2(py, px);
          trailGroup.add(banner);
        } else {
          for (const side of [-1, 1]) {
            const x = point.x + px * half * side,
              y = point.y + py * half * side,
              h = terrainHeight(x, y),
              f = new Three.Mesh(new Three.PlaneGeometry(6, 4), bannerMaterial('', ['#f6ead0', '#1d1f22', '#1d1f22']));
            f.position.set(x + px * 3 * side, h + height - 1, y + py * 3 * side);
            f.rotation.y = -Math.atan2(py, px);
            trailGroup.add(f);
          }
        }
      }
      MOUNTAIN_TRAILS.forEach((trail, t) => {
        const course = trailCourse(t);
        gateAt(trail, course.start, 'HILL CLIMB · START', 5, 26);
        course.checkpoints.forEach((cp) => gateAt(trail, cp, null, 0, 16));
        // Rock steps: slabs across the trail, every other path sample in the band.
        const sections = OFFROAD_SECTIONS[t];
        for (const band of sections.rocks) {
          const i0 = Math.round(band.from * (trail.path.length - 1)),
            i1 = Math.round(band.to * (trail.path.length - 1));
          for (let i = i0 - (i0 % 2); i <= i1; i += 2) {
            const [x, y] = trail.path[i],
              next = trail.path[Math.min(trail.path.length - 1, i + 1)],
              a = Math.atan2(next[1] - y, next[0] - x);
            for (let k = -2; k <= 2; k++) {
              const across = k * trail.width * 0.2 + (terrainHash(i, k + 9, 5) - 0.5) * 3,
                sx = x - Math.sin(a) * across,
                sy = y + Math.cos(a) * across,
                h = terrainHeight(sx, sy),
                slab = mesh(new Three.IcosahedronGeometry(1, 0), clubStone, trailGroup, sx, h + 0.35, sy, 3.2 + terrainHash(i, k, 3) * 2, 1.1, 4.5 + terrainHash(i, k, 4) * 2.5);
              slab.rotation.y = -a + (terrainHash(i, k, 6) - 0.5) * 0.5;
            }
          }
        }
        const top = trail.path.at(-1),
          prevTop = trail.path.at(-6);
        gateAt(trail, { x: prevTop[0], y: prevTop[1], i: trail.path.length - 6 }, 'SUMMIT · FINISH', 5, 24);
        statics.push({ x: (course.start.x + top[0]) / 2, y: (course.start.y + top[1]) / 2, group: trailGroup, radius: 1400 });
      });
      // SIGN_DESIGNS gets the club's own board (signdesigns3d.js).
      // ---- Per frame -----------------------------------------------------------------------------
      let grillSmoke = 0;
      function updateOffroadVisuals(deltaSeconds) {
        if (deltaSeconds <= 0) return;
        const L = OFFROAD_CLUB.lot,
          nearClub = Math.abs(viewCenter.x - L.x - L.w / 2) < viewReach + 300 && Math.abs(viewCenter.y - L.y - L.h / 2) < viewReach + 300;
        clubLive.visible = nearClub;
        if (nearClub) {
          waveFlag();
          // The grill smokes; the fire ring smoulders by day and burns at night.
          grillSmoke += deltaSeconds * (5 + nightAmount * 3);
          while (grillSmoke > 1) {
            grillSmoke -= 1;
            const gr = OFFROAD_CLUB.grill,
              fr = OFFROAD_CLUB.fire;
            engineSmoke(gr.x, 8.2, gr.y, '#cfcfca', 5, 9);
            if (Math.random() < 0.4) engineSmoke(fr.x, 3, fr.y, nightAmount > 0.3 ? '#8a7f74' : '#b5b2ab', 7, 12);
          }
        }
        for (const [c, m] of carModels)
          if (m.group.visible && (c.offroadState || c.x > CITY_SIZE - 200) && Math.abs(c.x - viewCenter.x) < viewReach + 100 && Math.abs(c.y - viewCenter.y) < viewReach + 100)
            vehicleSpray(c, m, deltaSeconds);
        updateMudParticles(deltaSeconds);
        splats.material.uniforms.uTime.value = gameTime;
        tracks.material.uniforms.uTime.value = gameTime;
      }
      // END SUBSYSTEM: src/offroad3d.js
