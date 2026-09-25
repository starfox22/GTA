      // BEGIN SUBSYSTEM: src/airfields3d.js — Runways, taxiways and airfield lighting
      /**
       * Runways, taxiways and airfield lighting
       * Source: src/airfields3d.js
       * Scope: createCityRenderer() closure (after base3d.js).
       *
       * Draws every runway in RUNWAYS and taxiway in TAXIWAYS (airfields.js) over
       * the baked ground sheets:
       *   - The runway surface is one quad per runway whose uv is metres (along
       *     from the `from` threshold, across from the centre line). A patched
       *     standard material paints the markings in the fragment shader, so they
       *     stay sharp at any zoom: threshold stripes, side stripes, centre line,
       *     aiming point and touchdown zone bars (ICAO Annex 14 for the length),
       *     yellow chevrons on the blast pads, rubber in the touchdown zones, wear
       *     and rain. The designation numbers are small decals.
       *   - Taxiways: yellow centre line and runway-holding positions (two solid
       *     lines on the holding side, two dashed on the runway side), with a red
       *     holding-position sign beside each.
       *   - Lights are glow-field instances (signage3d.js: one draw call for all
       *     of them, lit after dark) on small fixtures merged by the static
       *     batcher: white edge lights, green threshold and red end lights, blue
       *     taxiway edges, approach lights on piles out over the water with
       *     sequenced flashers running in towards the threshold, a green and white
       *     beacon on each control tower and red obstruction lights.
       *   - PAPI: the four lenses beside each aiming point turn red or white by the
       *     player's aircraft's angle above them (PAPI_ANGLES), so an approach on a
       *     3 degree path shows two of each; with no plane about they show on-slope.
       *   - Windsocks swing with the weather's wind.
       * updateAirfieldVisuals() runs per frame from updateCountyVisuals.
       */
      const AIRFIELD_M = UNITS_PER_METRE;
      const airfieldGroup = new Three.Group();
      airfieldGroup.name = 'airfields';
      scene.add(airfieldGroup);
      batchGroups.push(airfieldGroup);
      const windsocks = [];
      const airfieldDynamic = new Three.Group();
      airfieldDynamic.name = 'airfield moving parts';
      scene.add(airfieldDynamic);
      const AIRFIELD_SURFACE_VERTEX = `
        vRunwayUv = uv;`;
      // Shared GLSL: antialiased bands in metres.
      const AIRFIELD_SURFACE_PARS = `
        varying vec2 vRunwayUv;
        uniform vec4 rwShape;     // length (m), half width (m), blast pad at from (m), at to (m)
        uniform vec4 rwAim;       // aiming point: from threshold (m), length, inner offset, width
        uniform vec4 rwTouchdown; // touchdown zone bars from threshold (m); 0 = none
        uniform vec4 rwStyle;     // centre line width (m), runway (1) or taxiway (0), hold at (m, < 0 none), spare
        float rwBand( float v, float lo, float hi, float fw ) {
          return smoothstep( lo - fw, lo + fw, v ) * ( 1.0 - smoothstep( hi - fw, hi + fw, v ) );
        }
        // Threshold stripes, aiming point and touchdown bars at one end: d is the
        // distance in from that threshold, c the distance off the centre line.
        float rwEndMarks( float d, float c, float fwA, float fwC ) {
          float paint = 0.0;
          // Eight stripes 1.8 m wide and 1.8 m apart, 30 m long from 6 m in.
          float s = ( c - 1.8 ) / 3.6;
          paint = max( paint, rwBand( d, 6.0, 36.0, fwA ) * rwBand( s, 0.0, 4.0, fwC / 3.6 ) * rwBand( fract( s ), 0.0, 0.5, fwC / 3.6 ) );
          paint = max( paint, rwBand( d, rwAim.x, rwAim.x + rwAim.y, fwA ) * rwBand( c, rwAim.z, rwAim.z + rwAim.w, fwC ) );
          for ( int i = 0; i < 4; i++ ) {
            float t = rwTouchdown[ i ];
            if ( t <= 0.0 ) continue;
            float n = i == 0 ? 3.0 : 2.0;
            float q = ( c - 6.0 ) / 2.7;
            paint = max( paint, rwBand( d, t, t + 22.5, fwA ) * rwBand( q, 0.0, n, fwC / 2.7 ) * rwBand( fract( q ), 0.0, 1.5 / 2.7, fwC / 2.7 ) );
          }
          return paint;
        }`;
      const AIRFIELD_SURFACE_ALBEDO = `
        vec2 rUv = vRunwayUv;
        vec2 wp = vCityWorld.xz;
        float L = rwShape.x, H = rwShape.y;
        float a = rUv.x, c = abs( rUv.y );
        float fwA = max( fwidth( rUv.x ), 1e-3 ), fwC = max( fwidth( rUv.y ), 1e-3 );
        float detail = 1.0 - smoothstep( 0.6, 2.5, length( fwidth( wp ) ) );
        float g1 = cityNoise( wp * 1.3 ), g2 = cityNoise( wp * 3.7 + 7.0 ), g3 = cityNoise( wp * 0.021 + 3.0 );
        float grain = mix( 0.5, g1 * 0.55 + g2 * 0.45, detail );
        float runway = rwStyle.y;
        float pad = runway * ( 1.0 - rwBand( a, 0.0, L, fwA ) );
        // Grooved runway asphalt; the blast pads and taxiways a paler, older mix.
        vec3 base = mix( vec3( 0.052, 0.056, 0.06 ), vec3( 0.075, 0.077, 0.078 ), max( pad, 1.0 - runway ) );
        base *= ( 0.86 + 0.28 * grain ) * ( 0.9 + 0.2 * g3 );
        // Longitudinal paving lanes, 7.5 m apart.
        float lane = 1.0 - smoothstep( 0.05, 0.12 + fwC, abs( mod( rUv.y + 3.75, 7.5 ) - 3.75 ) );
        base *= 1.0 - 0.18 * lane * detail * runway;
        // Rubber: dark smears on the wheel tracks through each touchdown zone.
        float dEnd = min( a, L - a );
        float zone = smoothstep( 40.0, 120.0, dEnd ) * ( 1.0 - smoothstep( 250.0, 700.0, dEnd ) );
        float tracks = 1.0 - smoothstep( 1.5, 7.0, c );
        float streak = smoothstep( 0.3, 0.8, cityNoise( vec2( a * 0.08, rUv.y * 1.6 ) + 5.0 ) );
        base *= 1.0 - 0.55 * zone * tracks * ( 0.5 + 0.5 * streak ) * runway * ( 1.0 - pad );
        float white = 0.0, yellow = 0.0;
        if ( runway > 0.5 ) {
          if ( pad < 0.5 ) {
            // Side stripes 0.9 m wide just inside each edge.
            white = max( white, rwBand( c, H - 1.5, H - 0.6, fwC ) );
            // Centre line: 30 m stripes and 20 m gaps between the designations.
            float m = mod( a - 60.0, 50.0 );
            white = max( white, rwBand( m, 0.0, 30.0, fwA ) * rwBand( a, 60.0, L - 60.0, fwA ) * rwBand( c, -1.0, rwStyle.x * 0.5, fwC ) );
            white = max( white, rwEndMarks( a, c, fwA, fwC ) );
            white = max( white, rwEndMarks( L - a, c, fwA, fwC ) );
          } else {
            // Blast pad chevrons pointing at the runway, 0.9 m wide, every 10 m.
            float p = a < 0.0 ? -a : a - L;
            float padLength = a < 0.0 ? rwShape.z : rwShape.w;
            float k = mod( p - c, 10.0 );
            yellow = rwBand( k, 0.0, 1.27, max( fwA, fwC ) ) * step( c, H * 0.92 ) * step( p - c, padLength - 3.0 ) * step( 2.0, p - c );
          }
        } else {
          // Taxiway: yellow centre line; the holding position across it.
          yellow = rwBand( c, -1.0, 0.18, fwC ) * step( 0.5, a ) * step( a, L - 0.5 );
          float h = rwStyle.z;
          if ( h > 0.0 ) {
            float solid = max( rwBand( a, h, h + 0.3, fwA ), rwBand( a, h + 0.6, h + 0.9, fwA ) );
            float dashed = ( rwBand( a, h + 1.2, h + 1.5, fwA ) + rwBand( a, h + 1.8, h + 2.1, fwA ) ) * step( 0.5, fract( rUv.y / 2.0 ) );
            yellow = max( yellow, max( solid, dashed ) * step( c, H - 0.3 ) );
          }
          // Edge lines where the pavement meets the shoulder.
          yellow = max( yellow, rwBand( c, H - 0.9, H - 0.6, fwC ) );
        }
        float wear = smoothstep( 0.45, 0.85, cityNoise( wp * 0.35 + 5.0 ) * 0.7 + g2 * 0.3 + zone * tracks * 0.3 ) * detail;
        white *= 1.0 - 0.5 * wear;
        yellow *= 1.0 - 0.4 * wear;
        float paint = max( white, yellow );
        base = mix( base, vec3( 0.7, 0.7, 0.66 ) * ( 0.92 + 0.12 * g1 ), white );
        base = mix( base, vec3( 0.66, 0.46, 0.09 ) * ( 0.92 + 0.12 * g1 ), yellow );
        float airWet = cityWet;
        float puddle = smoothstep( 0.6, 0.68, cityNoise( wp * 0.025 + 41.0 ) * 0.8 + tracks * zone * 0.2 + g1 * 0.05 )
                     * smoothstep( 0.2, 0.8, airWet ) * ( 1.0 - paint * 0.7 );
        base *= 1.0 - 0.3 * airWet - 0.3 * puddle;
        diffuseColor.rgb = base;`;
      const AIRFIELD_SURFACE_ROUGHNESS = `
        roughnessFactor = mix( 0.9 + 0.05 * grain - 0.12 * zone * tracks, 0.6, paint );
        roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.45, airWet );
        roughnessFactor = mix( roughnessFactor, 0.12, puddle );`;
      function airfieldSurfaceMaterial(shape, aim, touchdown, style) {
        const m = new Three.MeshStandardMaterial({
            color: '#ffffff',
            roughness: 0.9,
            metalness: 0,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
          }),
          uniforms = {
            rwShape: { value: new Three.Vector4(...shape) },
            rwAim: { value: new Three.Vector4(...aim) },
            rwTouchdown: { value: new Three.Vector4(...touchdown) },
            rwStyle: { value: new Three.Vector4(...style) },
          };
        m.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vRunwayUv;')
            .replace('#include <uv_vertex>', '#include <uv_vertex>\n' + AIRFIELD_SURFACE_VERTEX);
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\n' + SURFACE_NOISE + AIRFIELD_SURFACE_PARS)
            .replace('#include <color_fragment>', '#include <color_fragment>\n' + AIRFIELD_SURFACE_ALBEDO)
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + AIRFIELD_SURFACE_ROUGHNESS)
            .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = 0.0;');
        };
        m.customProgramCacheKey = () => 'airfield-surface';
        return m;
      }
      /* A flat quad from `start` to `end` (map points, axis-aligned or not), `width`
         units wide, at height y; uv = (metres along from start + uvStart, metres
         across, positive to the right of the direction of travel... either way the
         shader only uses its magnitude). */
      function airfieldQuad(start, end, width, y, uvStart = 0) {
        const dx = end[0] - start[0],
          dz = end[1] - start[1],
          len = Math.hypot(dx, dz),
          ux = dx / len,
          uz = dz / len,
          // Across: 90 degrees from along.
          px = -uz * (width / 2),
          pz = ux * (width / 2),
          positions = new Float32Array([
            start[0] - px, y, start[1] - pz,
            start[0] + px, y, start[1] + pz,
            end[0] + px, y, end[1] + pz,
            end[0] - px, y, end[1] - pz,
          ]),
          halfM = width / 2 / AIRFIELD_M,
          u0 = uvStart,
          u1 = uvStart + len / AIRFIELD_M,
          uvs = new Float32Array([u0, -halfM, u0, halfM, u1, halfM, u1, -halfM]),
          geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.BufferAttribute(positions, 3));
        geo.setAttribute('normal', new Three.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
        geo.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
        // Wound to face up.
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        geo.computeBoundingSphere();
        return geo;
      }
      function airfieldSurface(geo, material, name) {
        const m = new Three.Mesh(geo, material);
        m.name = name;
        m.receiveShadow = true;
        m.castShadow = false;
        m.userData.dynamic = true; // its own material and geometry; nothing to merge
        airfieldDynamic.add(m);
        return m;
      }
      // Designation decals: white runway digits, 9 m tall, on a transparent card.
      const designationMaterials = new Map();
      function designationMaterial(text) {
        if (designationMaterials.has(text)) return designationMaterials.get(text);
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 320;
        const g = canvas.getContext('2d');
        g.fillStyle = '#ffffff';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = "700 300px 'Arial Narrow', 'Roboto Condensed', Arial, sans-serif";
        g.save();
        g.translate(128, 170);
        g.scale(0.62, 1.05);
        g.fillText(text, 0, 0);
        g.restore();
        const texture = new Three.CanvasTexture(canvas);
        texture.colorSpace = Three.SRGBColorSpace;
        texture.anisotropy = 4;
        const m = new Three.MeshStandardMaterial({
          map: texture,
          color: '#b8b8b0',
          roughness: 0.65,
          transparent: true,
          alphaTest: 0.35,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4,
        });
        designationMaterials.set(text, m);
        return m;
      }
      // Holding-position signs: white on red, lit from inside (taxiway signs are).
      const holdSignMaterials = new Map();
      function holdSignMaterial(text) {
        if (holdSignMaterials.has(text)) return holdSignMaterials.get(text);
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 96;
        const g = canvas.getContext('2d');
        g.fillStyle = '#1a1a1a';
        g.fillRect(0, 0, 256, 96);
        g.fillStyle = '#c8261f';
        g.fillRect(6, 6, 244, 84);
        g.fillStyle = '#ffffff';
        g.font = '700 64px Arial, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, 128, 52);
        const texture = new Three.CanvasTexture(canvas);
        texture.colorSpace = Three.SRGBColorSpace;
        const m = new Three.MeshBasicMaterial({ map: texture });
        holdSignMaterials.set(text, m);
        return m;
      }
      const fixtureYellow = staticMat('#d7b43c', 0.6),
        fixtureGrey = staticMat('#6f7478', 0.5, 0.4),
        pileConcrete = staticMat('#8a8b86', 0.93),
        lensWhite = new Three.MeshBasicMaterial({ color: '#fff4dc' }),
        lensGreen = new Three.MeshBasicMaterial({ color: '#57f08a' }),
        lensRed = new Three.MeshBasicMaterial({ color: '#ff4a3a' }),
        lensBlue = new Three.MeshBasicMaterial({ color: '#4f7dff' });
      // An inset or elevated light: a stake with a lens, and its glow.
      function airfieldLight(x, z, lens, color, strength = 1, size = 7, options = {}) {
        box(airfieldGroup, x, 0.45, z, 0.5, 0.9, 0.5, fixtureYellow).castShadow = false;
        box(airfieldGroup, x, 1.0, z, 0.9, 0.35, 0.9, lens).castShadow = false;
        return addGlow(x, 1.2, z, size, color, strength, options);
      }
      // A concrete pile carrying approach lights over the water.
      function pileLight(x, z) {
        const pile = mesh(cylinderGeo, pileConcrete, airfieldGroup, x, -4, z, 1.1, 10, 1.1);
        pile.castShadow = false;
        return pile;
      }
      /* ---- Runways ------------------------------------------------------------------ */
      const papiLenses = [];
      for (const r of RUNWAYS) {
        const L = runwayLength(r),
          half = r.width / 2,
          M = AIRFIELD_M;
        const start = runwayPoint(r, -r.blast[0]),
          end = runwayPoint(r, L + r.blast[1]),
          material = airfieldSurfaceMaterial(
            [L / M, half / M, r.blast[0] / M, r.blast[1] / M],
            [r.aim, r.aimLength, r.width > 238 ? 9 : 6, r.width > 238 ? 4 : 3],
            [...r.touchdown, 0, 0, 0, 0].slice(0, 4),
            [r.centreLine, 1, -1, 0],
          );
        airfieldSurface(airfieldQuad([start.x, start.y], [end.x, end.y], r.width, 0.12, -r.blast[0] / M), material, r.name + ' runway');
        // Designations, 52 m in from each threshold, the digits' tops pointing
        // along the landing direction.
        r.ends.forEach((designation, endIndex) => {
          const p = runwayPoint(r, endIndex === 0 ? 52 * M : L - 52 * M),
            landing = r.axis === 'x' ? (endIndex === 0 ? 0 : Math.PI) : endIndex === 0 ? Math.PI / 2 : -Math.PI / 2,
            decal = new Three.Mesh(new Three.PlaneGeometry(8 * M, 10 * M), designationMaterial(designation));
          decal.rotation.x = -Math.PI / 2;
          // The card's up (+y before the tilt) points north (-z); turn it to the landing heading.
          decal.rotation.z = -(landing + Math.PI / 2);
          decal.rotation.order = 'XYZ';
          decal.position.set(p.x, 0.16, p.y);
          decal.receiveShadow = true;
          decal.userData.dynamic = true;
          airfieldDynamic.add(decal);
        });
        // Edge lights: white, about every 60 m (50 m on the short strip), 1.5 m out.
        const edgeSpacing = L / Math.round(L / ((L > 6000 ? 60 : 50) * M));
        for (let along = 0; along <= L + 1; along += edgeSpacing)
          for (const side of [-1, 1]) {
            const p = runwayPoint(r, along, side * (half + 1.5 * M));
            airfieldLight(p.x, p.y, lensWhite, '#fff1d2', 1.7, 13);
          }
        // Threshold (green, facing the approach) and runway end (red, facing the
        // runway) lights: a bi-coloured row across each end.
        for (const [along, outward] of [
          [0, -1],
          [L, 1],
        ])
          for (let across = -half + 1.5 * M; across <= half - 1.5 * M + 1; across += (r.width - 3 * M) / 9) {
            const g = runwayPoint(r, along + outward * 0.9 * M, across),
              e = runwayPoint(r, along - outward * 0.9 * M, across);
            airfieldLight(g.x, g.y, lensGreen, '#5cff8e', 2.0, 12);
            airfieldLight(e.x, e.y, lensRed, '#ff4636', 1.6, 10);
          }
        // Approach lights out over the sea: a centre row of five-lamp barrettes
        // every 30 m with a crossbar at 60 m, and a flasher on each barrette that
        // fires in sequence towards the threshold.
        r.ends.forEach((designation, endIndex) => {
          if (!r.approachLights[endIndex]) return;
          const outward = endIndex === 0 ? -1 : 1,
            threshold = endIndex === 0 ? 0 : L,
            rows = [];
          for (let k = 1; k <= 5; k++) {
            const along = threshold + outward * k * 30 * M;
            const centre = runwayPoint(r, along);
            if (centre.x < WORLD_LEFT + 60) break;
            rows.push({ k, along, centre });
          }
          for (const row of rows) {
            const overWater = !landAt(row.centre.x, row.centre.y);
            const lamps = row.k === 2 ? [-12, -9, -6, -3, -1.5, 0, 1.5, 3, 6, 9, 12] : [-3, -1.5, 0, 1.5, 3];
            if (overWater) {
              // Piles under the ends of the bar and a steel beam across them.
              const span = Math.max(...lamps) * M;
              for (const s of lamps.length > 5 ? [-span, 0, span] : [0]) {
                const p = runwayPoint(r, row.along, s);
                pileLight(p.x, p.y);
              }
              const a = runwayPoint(r, row.along, -span - M),
                b = runwayPoint(r, row.along, span + M);
              box(
                airfieldGroup,
                (a.x + b.x) / 2,
                1.2,
                (a.y + b.y) / 2,
                r.axis === 'x' ? 1.4 : Math.abs(b.x - a.x),
                0.8,
                r.axis === 'x' ? Math.abs(b.y - a.y) : 1.4,
                fixtureGrey,
              ).castShadow = false;
            }
            for (const s of lamps) {
              const p = runwayPoint(r, row.along, s * M);
              airfieldLight(p.x, p.y, lensWhite, '#fff6e8', 1.9, 13, { day: 0.05 });
            }
            // The sequenced flasher ("rabbit"): outermost first.
            const f = runwayPoint(r, row.along + outward * 1.2 * M);
            addGlow(f.x, 2.2, f.y, 26, '#ffffff', 3.2, { mode: 'beacon', phase: 0.5 - row.k * 0.035, day: 0.25 });
          }
        });
        // PAPI boxes: a housing each and a lens that turns red or white.
        for (const unit of PAPI_UNITS.filter((u) => u.runway === r)) {
          box(airfieldGroup, unit.x, 0.9, unit.y, 2.6, 1.4, 2.0, fixtureGrey).castShadow = false;
          const lens = new Three.Mesh(boxGeo, new Three.MeshBasicMaterial({ color: '#ff4a3a' }));
          lens.position.set(unit.x, 1.3, unit.y);
          lens.scale.set(1.8, 0.8, 1.8);
          lens.userData.dynamic = true;
          airfieldDynamic.add(lens);
          const glow = addGlow(unit.x, 1.9, unit.y, 16, '#ff4a3a', 2.4, { day: 0.55 });
          papiLenses.push({ unit, lens, glow, white: null });
        }
        // Windsocks: a hinged pole with a floodlight, a red light on top and an
        // orange and white sock that swings with the wind.
        for (const w of r.windsocks) {
          box(airfieldGroup, w.x, 7, w.y, 0.8, 14, 0.8, fixtureGrey);
          box(airfieldGroup, w.x, 0.3, w.y, 5, 0.6, 5, pileConcrete);
          addGlow(w.x, 14.6, w.y, 6, '#ff3a2a', 1.3, { day: 0.1 });
          addGlow(w.x, 10, w.y, 18, '#fff0d0', 0.45);
          const sock = new Three.Group();
          sock.position.set(w.x, 13.4, w.y);
          sock.userData.dynamic = true;
          airfieldDynamic.add(sock);
          const orange = mat('#ec6a2a', 0.8),
            white = mat('#ecebe4', 0.8);
          for (let k = 0; k < 5; k++) {
            const seg = new Three.Mesh(new Three.CylinderGeometry(1.1 - k * 0.12, 1.2 - k * 0.12, 1.4, 10, 1, true), k % 2 ? white : orange);
            seg.rotation.z = Math.PI / 2;
            seg.position.x = 0.8 + k * 1.4;
            seg.castShadow = true;
            sock.add(seg);
          }
          windsocks.push(sock);
        }
      }
      /* ---- Taxiways -------------------------------------------------------------------- */
      for (const t of TAXIWAYS) {
        const len = Math.hypot(t.to[0] - t.from[0], t.to[1] - t.from[1]),
          material = airfieldSurfaceMaterial([len / AIRFIELD_M, t.width / 2 / AIRFIELD_M, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [
            0.36,
            0,
            t.hold !== undefined ? t.hold / AIRFIELD_M : -1,
            0,
          ]);
        airfieldSurface(airfieldQuad(t.from, t.to, t.width, 0.1), material, t.airport + ' taxiway');
        // Blue edge lights about every 30 m.
        const ux = (t.to[0] - t.from[0]) / len,
          uz = (t.to[1] - t.from[1]) / len,
          n = Math.max(1, Math.round(len / (30 * AIRFIELD_M)));
        for (let k = 0; k <= n; k++)
          for (const side of [-1, 1]) {
            const s = (k / n) * len,
              off = side * (t.width / 2 + 0.8 * AIRFIELD_M);
            airfieldLight(t.from[0] + ux * s - uz * off, t.from[1] + uz * s + ux * off, lensBlue, '#4a78ff', 1.5, 10);
          }
        // The runway-holding position sign, on the left as a pilot taxies up.
        if (t.hold !== undefined) {
          const runway = RUNWAYS.find((r) => r.name === t.airport),
            s = t.hold - 1.5 * AIRFIELD_M,
            off = -(t.width / 2 + 3 * AIRFIELD_M),
            x = t.from[0] + ux * s - uz * off,
            z = t.from[1] + uz * s + ux * off,
            sign = new Three.Mesh(new Three.BoxGeometry(12, 4.2, 0.6), holdSignMaterial(runway.ends.join('-')));
          sign.position.set(x, 3.2, z);
          // Face the pilot coming along the taxiway (towards -along).
          sign.rotation.y = Math.atan2(ux, uz) + Math.PI;
          sign.userData.sign = true;
          airfieldGroup.add(sign);
          for (const leg of [-4.5, 4.5]) box(airfieldGroup, x + uz * leg, 0.6, z - ux * leg, 0.5, 1.2, 0.5, fixtureGrey);
          addGlow(x, 3.2, z, 9, '#ff5a40', 0.35);
        }
      }
      /* ---- Towers: rotating beacon (green / white) and obstruction lights ------------ */
      for (const [x, y, z] of [
        [790, 153, 5075],
        [3530, 190, 8980],
      ]) {
        addGlow(x, y, z, 26, '#ffffff', 2.6, { mode: 'beacon', phase: 0, day: 0.1 });
        addGlow(x, y, z, 26, '#44ff7a', 2.2, { mode: 'beacon', phase: 0.5, day: 0.1 });
      }
      statics.push({ x: 418, y: 6000, group: airfieldGroup, radius: 4200 });
      /* ---- Per frame -------------------------------------------------------------------- */
      const papiColorWhite = new Three.Color('#fff6e6'),
        papiColorRed = new Three.Color('#ff4a3a');
      function updateAirfieldVisuals() {
        // PAPI: lit white above its angle, red below, as seen from the player's
        // aircraft (papiShowsWhite, airfields.js).
        const observer = papiObserver();
        let changed = false;
        for (const p of papiLenses) {
          const white = papiShowsWhite(p.unit, observer);
          if (white === p.white) continue;
          p.white = white;
          const col = white ? papiColorWhite : papiColorRed;
          p.lens.material.color.copy(col);
          if (p.glow >= 0) {
            glowColors.set([col.r, col.g, col.b], p.glow * 3);
            changed = true;
          }
        }
        if (changed) glowMesh.geometry.attributes.glowColor.needsUpdate = true;
        // Windsocks: point downwind; they hang slack in a calm and stream out in
        // a gale (weather.wind 0..1.5).
        const wind = weather?.wind ?? 0.4,
          heading = weather?.windAngle ?? -0.7;
        for (const [i, sock] of windsocks.entries()) {
          sock.rotation.y = -heading + Math.sin(gameTime * 1.1 + i) * 0.1 * (1 - Math.min(1, wind));
          sock.rotation.z = -1.1 + Math.min(1.05, wind * 0.8) + Math.sin(gameTime * 2.3 + i) * 0.04;
        }
      }
      // END SUBSYSTEM: src/airfields3d.js
