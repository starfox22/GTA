      // BEGIN SUBSYSTEM: src/character-rig3d.js — Character rig: sculpted body parts, outfits and paint
      /**
       * Character rig: sculpted body parts, outfits and paint
       * Source: src/character-rig3d.js
       * Scope: renderer closure (inside createCityRenderer), before crowd3d.js.
       *
       * Everybody on foot (pedestrians, the player, police, SWAT, agents,
       * soldiers, gangs, mission characters) is drawn from ONE set of instanced
       * body parts: a sculpted head with a face hint, hair styles and hats, a
       * male and a female torso, pelvis, upper arm, forearm, hand, thigh, shin,
       * shoe and boot, plus kit worn over them (plate carrier / hi-vis vest, duty
       * belt, jacket collar, hood, radio, POLICE / FED back lettering) and the
       * weapons in hand. crowd3d.js poses the skeleton and packs the instances.
       *
       * PROPORTIONS. Parts are modelled for the reference adult, PERSON_HEIGHT
       * (game.js: 1.75 m = 14 units) to the crown, about 7.5 heads tall: crown
       * 14, chin 12.2, shoulder joints 11.3, waist 8.25, hip joints 7.3, knees
       * 4.0, ankles 0.55. A look's height scales the whole rig (1.6-1.9 m).
       *
       * PAINT. Parts are lofted from elliptical rings (`rigLoft`), and every
       * vertex carries a region id (a torso: body, open front, bust band, upper
       * band, shoulder yoke, badge, tie strip, waistband). Each instance carries
       * four packed sRGB colours and a 2-bit-per-region mask choosing which of the
       * four paints each region, so one torso mesh is a tee, a tank top, a bikini,
       * an open leather jacket over a tee, a suit with a tie or a police shirt with
       * its badge, all in the same draw call. Slot A can also carry a procedural
       * pattern (camouflage, denim, check, floral, stripes, leather or satin
       * sheen, and club kits' stripes, hoops, halves and sash in slot C), and
       * the player's instances a faint night rim (render3d.js PLAYER
       * AT NIGHT).
       */
      const RIG = {
        hip: 7.3, // hip joint height
        waist: 0.95, // torso joint above the hip joint
        neck: 3.36, // neck base above the torso joint
        shoulderY: 3.06,
        shoulderZ: [1.56, 1.38], // male, female
        hipZ: [0.7, 0.78],
        upperArm: 2.55,
        forearm: 2.05,
        hand: 1.3,
        thigh: 3.3,
        shin: 3.45,
        ankle: 0.55,
      };
      // Rigs are modelled at 14 units = PERSON_HEIGHT; a changed constant rescales them.
      const RIG_UNIT = PERSON_HEIGHT / 14;

      /* ---- Materials -------------------------------------------------------------- */
      /**
       * PAINT SHADER
       * Per-vertex `crowdRegion`, per-instance `crowdPaint` (four colours packed
       * as 0xRRGGBB floats, sRGB) and `crowdMeta` (x: the region mask, y: pattern
       * for slot A + 16 x rim). Chained after the city patch (lighting3d.js) so
       * street lights, headlights and the cutaway still apply.
       *
       * WOUNDS: `crowdWound` (per instance, crowd3d-gore.js goreWoundFor) is where a round went into this
       * part (xyz, the part's own space) and w = 2 + the stain's reach (+100 when it went through, so the
       * mirrored point on the far side soaks too); w under 1.5 is no wound (a geometry without the
       * attribute reads w = 1). The cloth or skin round it soaks dark red with a ragged edge (value
       * noise), further below the wound than above (it runs down), near black in the hole itself; never
       * emissive.
       */
      const RIG_PAINT_VERTEX_PARS = `
        attribute float crowdRegion;
        attribute vec4 crowdPaint;
        attribute vec2 crowdMeta;
        attribute vec4 crowdWound;
        varying vec4 vCrowdWound;
        varying vec3 vCrowdColor;
        varying vec3 vCrowdLocal;
        varying float vCrowdPattern;
        varying float vCrowdSlotA;
        varying float vCrowdRim;
        varying vec3 vCrowdAccent;
        vec3 crowdUnpack( float packed ) {
          packed = floor( packed + 0.5 );
          float r = floor( packed / 65536.0 );
          float g = floor( ( packed - r * 65536.0 ) / 256.0 );
          float b = packed - r * 65536.0 - g * 256.0;
          vec3 c = vec3( r, g, b ) / 255.0;
          return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( 0.04045, c ) );
        }`;
      const RIG_PAINT_VERTEX = `
        {
          int crowdMask = int( crowdMeta.x + 0.5 );
          int crowdSlot = ( crowdMask >> ( 2 * int( crowdRegion + 0.5 ) ) ) & 3;
          float crowdPacked = crowdSlot == 0 ? crowdPaint.x : crowdSlot == 1 ? crowdPaint.y : crowdSlot == 2 ? crowdPaint.z : crowdPaint.w;
          vCrowdColor = crowdUnpack( crowdPacked );
          float crowdFlags = floor( crowdMeta.y + 0.5 );
          vCrowdRim = mod( floor( crowdFlags / 16.0 ), 2.0 );
          // The pattern is the same at every vertex; whether a vertex wears slot A is not.
          vCrowdPattern = mod( crowdFlags, 16.0 );
          vCrowdSlotA = crowdSlot == 0 ? 1.0 : 0.0;
          vCrowdLocal = position;
          vCrowdAccent = crowdUnpack( crowdPaint.z );
          vCrowdWound = crowdWound;
        }`;
      const RIG_PAINT_FRAGMENT_PARS = `
        varying vec3 vCrowdColor;
        varying vec3 vCrowdLocal;
        varying float vCrowdPattern;
        varying float vCrowdSlotA;
        varying float vCrowdRim;
        varying vec3 vCrowdAccent;
        varying vec4 vCrowdWound;
        uniform vec3 cityPlayerRim;
        float crowdWoundHash( vec3 p ) {
          return fract( sin( dot( p, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
        }
        float crowdWoundNoise( vec3 p ) {
          vec3 i = floor( p ), f = fract( p );
          f = f * f * ( 3.0 - 2.0 * f );
          float a = mix( crowdWoundHash( i ), crowdWoundHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x );
          float b = mix( crowdWoundHash( i + vec3( 0.0, 1.0, 0.0 ) ), crowdWoundHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x );
          float c = mix( crowdWoundHash( i + vec3( 0.0, 0.0, 1.0 ) ), crowdWoundHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x );
          float d = mix( crowdWoundHash( i + vec3( 0.0, 1.0, 1.0 ) ), crowdWoundHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x );
          return mix( mix( a, b, f.y ), mix( c, d, f.y ), f.z );
        }
        float crowdWoundSpot( vec3 d, float r, float n ) {
          d.y *= d.y < 0.0 ? 0.55 : 1.0;
          return 1.0 - smoothstep( r * 0.3, r * ( 0.85 + 0.5 * n ), length( d ) + n * r * 0.35 );
        }
        vec3 crowdWoundSoak( vec3 c, vec3 p ) {
          float exitSide = step( 50.0, vCrowdWound.w );
          float r = vCrowdWound.w - 2.0 - exitSide * 100.0;
          float n = crowdWoundNoise( p * 2.7 ) * 0.6 + crowdWoundNoise( p * 6.3 ) * 0.4;
          vec3 d = p - vCrowdWound.xyz;
          float soak = crowdWoundSpot( d, r, n );
          if ( exitSide > 0.5 ) soak = max( soak, crowdWoundSpot( p - vec3( -vCrowdWound.x, vCrowdWound.y, -vCrowdWound.z ), r * 1.15, n ) );
          float hole = 1.0 - smoothstep( r * 0.05, r * 0.22, length( d ) );
          float lum = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
          // Blood in cloth: deep red on light fabric, darker and wet on dark.
          vec3 blood = vec3( 0.16, 0.012, 0.016 ) * ( 0.32 + 1.0 * min( lum * 2.5, 1.0 ) );
          c = mix( c, blood, soak * 0.94 );
          return mix( c, vec3( 0.045, 0.003, 0.004 ), hole * 0.85 );
        }
        vec3 crowdPatternColor( vec3 c, float pattern, vec3 p ) {
          if ( pattern > 7.5 ) {
            // Club kits in the accent colour (slot C): stripes, hoops, halves, a sash.
            float k = pattern < 8.5 ? step( 0.5, fract( p.z * 1.05 + 0.25 ) )
              : pattern < 9.5 ? step( 0.5, fract( p.y * 1.25 + 0.1 ) )
              : pattern < 10.5 ? step( 0.0, p.z )
              : step( abs( p.y - 1.75 - p.z * 0.75 ), 0.38 );
            return mix( c, vCrowdAccent, k );
          }
          if ( pattern < 1.5 ) {
            // Woodland camouflage: three blotch tones over the base.
            float a = sin( p.x * 2.3 + sin( p.y * 1.9 + p.z * 0.7 ) * 1.6 ) * cos( p.z * 2.1 - p.y * 1.1 );
            float b = sin( p.y * 2.9 - p.x * 1.7 + cos( p.z * 2.6 ) * 1.3 );
            vec3 dark = c * vec3( 0.52, 0.5, 0.46 );
            vec3 brown = c * vec3( 0.95, 0.78, 0.62 );
            vec3 light = c * vec3( 1.28, 1.26, 1.1 );
            c = a > 0.32 ? dark : b > 0.55 ? brown : a < -0.45 ? light : c;
          } else if ( pattern < 2.5 ) {
            // Denim: faded on the front of the leg, darker seams.
            c *= 0.92 + 0.3 * smoothstep( -0.1, 0.55, p.x ) * smoothstep( -3.4, -0.6, p.y );
          } else if ( pattern < 3.5 ) {
            // Check shirt.
            float g = step( 0.55, fract( p.y * 1.35 ) ) + step( 0.55, fract( ( p.z + p.x ) * 1.35 ) );
            c = mix( c, c * 0.55, 0.42 * g );
          } else if ( pattern < 4.5 ) {
            // Floral (a holiday shirt).
            float f = sin( p.x * 4.1 + 1.3 ) * sin( p.y * 3.7 ) * sin( p.z * 4.3 + 0.7 );
            c = f > 0.3 ? vec3( 0.92, 0.86, 0.72 ) : f < -0.42 ? c * 0.55 + vec3( 0.05, 0.16, 0.08 ) : c;
          } else if ( pattern < 5.5 ) {
            // Breton stripes.
            c = mix( c, vec3( 0.86 ), step( 0.5, fract( p.y * 2.4 ) ) );
          }
          return c;
        }`;
      const playerRim = { value: new Three.Color(0, 0, 0) };
      function rigPaintPatch(shader) {
        cityMaterialPatch(shader);
        shader.uniforms.cityPlayerRim = playerRim;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' + RIG_PAINT_VERTEX_PARS)
          .replace('#include <color_vertex>', '#include <color_vertex>\n' + RIG_PAINT_VERTEX);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + RIG_PAINT_FRAGMENT_PARS)
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            float crowdPattern = vCrowdSlotA > 0.5 ? floor( vCrowdPattern + 0.5 ) : 0.0;
            diffuseColor.rgb *= crowdPattern > 0.5 ? crowdPatternColor( vCrowdColor, crowdPattern, vCrowdLocal ) : vCrowdColor;
            if ( vCrowdWound.w > 1.5 ) diffuseColor.rgb = crowdWoundSoak( diffuseColor.rgb, vCrowdLocal );`,
          )
          .replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
            // Leather (6) and satin (7) have a sheen the cloth around them lacks.
            if ( vCrowdSlotA > 0.5 && vCrowdPattern > 5.5 && vCrowdPattern < 7.5 ) roughnessFactor = vCrowdPattern > 6.5 ? 0.36 : 0.42;`,
          )
          .replace(
            '#include <lights_fragment_end>',
            `#include <lights_fragment_end>
            if ( vCrowdRim > 0.5 ) {
              float rimView = 1.0 - clamp( dot( normal, geometryViewDir ), 0.0, 1.0 );
              totalEmissiveRadiance += cityPlayerRim * rimView * rimView * rimView;
            }`,
          );
      }
      function rigMaterial(options, key) {
        const material = new Three.MeshStandardMaterial({ color: '#ffffff', ...options });
        material.onBeforeCompile = rigPaintPatch;
        material.customProgramCacheKey = () => 'crowd-paint-' + key;
        return material;
      }
      const rigSkinMaterial = rigMaterial({ roughness: 0.78 }, 'body'),
        rigClothDouble = rigMaterial({ roughness: 0.85, side: Three.DoubleSide }, 'cloth2'),
        rigHairMaterial = rigMaterial({ roughness: 0.6 }, 'hair'),
        rigGearMaterial = rigMaterial({ roughness: 0.5, metalness: 0.35 }, 'gear');

      /* ---- Geometry --------------------------------------------------------------- */
      /**
       * A lofted surface: rings stacked along y. Each ring is a superellipse
       * { y, fx (half-depth forward, +x), bx (backward), w (half-width, z),
       *   cx, cz (centre offset), n (2 = ellipse, higher = boxier), dome }.
       * `region(ring, theta, y, x, z)` gives each vertex its paint region;
       * theta is 0 straight ahead (+x) and positive towards the right (+z).
       * The seam shares its vertices, so normals are smooth all round.
       */
      // Radial detail for the parts being built: 1 for the close-up set, less for the street set.
      let rigSegmentScale = 1;
      function rigLoft(allRings, segments, region = null, capBottom = true, capTop = true) {
        // The street set keeps every other ring (and the ends); regions still see the original index.
        const ringIndex = [];
        for (let i = 0; i < allRings.length; i++) if (rigSegmentScale >= 1 || i % 2 === 0 || i === allRings.length - 1 || allRings.length <= 4) ringIndex.push(i);
        const rings = ringIndex.map((i) => allRings[i]);
        const positions = [],
          regions = [],
          index = [],
          n = Math.max(5, Math.round(segments * rigSegmentScale));
        for (let i = 0; i < rings.length; i++) {
          const r = rings[i],
            e = 2 / (r.n || 2);
          for (let k = 0; k < n; k++) {
            const th = (k / n) * TAU,
              c = Math.cos(th),
              s = Math.sin(th),
              pc = Math.sign(c) * Math.pow(Math.abs(c), e),
              ps = Math.sign(s) * Math.pow(Math.abs(s), e),
              x = (r.cx || 0) + pc * (c >= 0 ? r.fx : (r.bx ?? r.fx)),
              z = (r.cz || 0) + ps * r.w;
            positions.push(x, r.y, z);
            regions.push(region ? region(ringIndex[i], th > Math.PI ? th - TAU : th, r.y, x, z) : 0);
          }
        }
        // Rings stacked downwards (a limb hanging from its joint) wind the other way, so every loft faces out.
        const down = rings.length > 1 && rings[rings.length - 1].y < rings[0].y;
        for (let i = 0; i < rings.length - 1; i++)
          for (let k = 0; k < n; k++) {
            const a = i * n + k,
              b = i * n + ((k + 1) % n);
            if (down) index.push(a, b, a + n, b, b + n, a + n);
            else index.push(a, a + n, b, b, a + n, b + n);
          }
        const cap = (i, top) => {
          const r = rings[i],
            centre = positions.length / 3,
            // The dome stands away from the neighbouring ring; the upper end faces up.
            up = top !== down;
          positions.push(r.cx || 0, r.y + (up ? 1 : -1) * (r.dome || 0), r.cz || 0);
          regions.push(region ? region(ringIndex[i], 0, r.y, r.cx || 0, r.cz || 0, true) : 0);
          for (let k = 0; k < n; k++) {
            const a = i * n + k,
              b = i * n + ((k + 1) % n);
            if (up) index.push(centre, b, a);
            else index.push(centre, a, b);
          }
        };
        if (capBottom) cap(0, false);
        if (capTop) cap(rings.length - 1, true);
        const g = new Three.BufferGeometry();
        g.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        g.setAttribute('crowdRegion', new Three.Float32BufferAttribute(regions, 1));
        g.setIndex(index);
        g.computeVertexNormals();
        return g;
      }
      /* Ring list sampled from a profile of key rings (linear between keys). */
      function rigProfile(keys, ys) {
        return ys.map((y) => {
          let i = 0;
          while (i < keys.length - 2 && keys[i + 1].y < y) i++;
          const a = keys[i],
            b = keys[i + 1],
            t = clamp((y - a.y) / (b.y - a.y || 1), 0, 1),
            mix = (k, fallback = 0) => (a[k] ?? fallback) + ((b[k] ?? fallback) - (a[k] ?? fallback)) * t;
          return { y, fx: mix('fx'), bx: mix('bx'), w: mix('w'), cx: mix('cx'), cz: mix('cz'), n: mix('n', 2) };
        });
      }
      /* A primitive with every vertex in one region. */
      function rigRegion(geo, region) {
        const g = geo.index ? geo : geo;
        g.deleteAttribute('uv');
        g.setAttribute('crowdRegion', new Three.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(region), 1));
        return g;
      }
      function rigPlace(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
        const g = geo.clone();
        g.scale(sx, sy, sz);
        g.rotateX(rx);
        g.rotateY(ry);
        g.rotateZ(rz);
        g.translate(x, y, z);
        return g;
      }
      const rigBox = (w, h, d, region, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
        rigPlace(rigRegion(new Three.BoxGeometry(w, h, d), region), x, y, z, rx, ry, rz);
      const rigBall = (rx, ry, rz, region, x = 0, y = 0, z = 0, segments = 8, rings = 6) =>
        rigPlace(
          rigRegion(new Three.SphereGeometry(1, Math.max(4, Math.round(segments * rigSegmentScale)), Math.max(3, Math.round(rings * rigSegmentScale))), region),
          x,
          y,
          z,
          0,
          0,
          0,
          rx,
          ry,
          rz,
        );
      // A cylinder along +x from x0 to x1.
      const rigRod = (x0, x1, r, region, y = 0, z = 0, segments = 8, r1 = r) =>
        rigPlace(rigRegion(new Three.CylinderGeometry(r1, r, x1 - x0, segments, 1), region), (x0 + x1) / 2, y, z, 0, 0, -Math.PI / 2);
      /* Merge indexed geometries (position, normal, crowdRegion). */
      function rigMerge(list) {
        let vertices = 0,
          indices = 0;
        for (const g of list) {
          vertices += g.attributes.position.count;
          indices += g.index ? g.index.count : g.attributes.position.count;
        }
        const position = new Float32Array(vertices * 3),
          normal = new Float32Array(vertices * 3),
          region = new Float32Array(vertices),
          index = new Uint32Array(indices);
        let v = 0,
          ix = 0;
        for (const g of list) {
          const n = g.attributes.position.count;
          position.set(g.attributes.position.array, v * 3);
          normal.set(g.attributes.normal.array, v * 3);
          region.set(g.attributes.crowdRegion.array, v);
          if (g.index) for (let k = 0; k < g.index.count; k++) index[ix++] = g.index.array[k] + v;
          else for (let k = 0; k < n; k++) index[ix++] = k + v;
          v += n;
        }
        const merged = new Three.BufferGeometry();
        merged.setAttribute('position', new Three.BufferAttribute(position, 3));
        merged.setAttribute('normal', new Three.BufferAttribute(normal, 3));
        merged.setAttribute('crowdRegion', new Three.BufferAttribute(region, 1));
        merged.setIndex(new Three.BufferAttribute(index, 1));
        merged.computeBoundingSphere();
        return merged;
      }
      const RIG_DEG = Math.PI / 180;

      /**
       * HEAD
       * Joint at the neck base. Regions: 0 skin, 1 eyes and brows, 2 jaw (clean,
       * stubble or beard), 3 lips. Ears and a nose are merged in.
       */
      const RIG_HEAD_RINGS = [
        { y: 0.0, fx: 0.4, bx: 0.42, w: 0.45, cx: -0.06 },
        { y: 0.5, fx: 0.38, bx: 0.4, w: 0.41, cx: -0.04 },
        { y: 0.6, fx: 0.58, bx: 0.44, w: 0.44, cx: 0.06 },
        { y: 0.74, fx: 0.74, bx: 0.6, w: 0.54, cx: 0.04 },
        { y: 0.92, fx: 0.8, bx: 0.7, w: 0.59, cx: 0.02 },
        { y: 1.12, fx: 0.84, bx: 0.76, w: 0.62 },
        { y: 1.32, fx: 0.85, bx: 0.8, w: 0.645 },
        { y: 1.47, fx: 0.83, bx: 0.82, w: 0.65 },
        { y: 1.6, fx: 0.84, bx: 0.83, w: 0.65 },
        { y: 1.72, fx: 0.83, bx: 0.83, w: 0.645 },
        { y: 1.92, fx: 0.77, bx: 0.81, w: 0.62, cx: -0.01 },
        { y: 2.1, fx: 0.64, bx: 0.72, w: 0.55, cx: -0.03 },
        { y: 2.25, fx: 0.44, bx: 0.54, w: 0.4, cx: -0.04 },
        { y: 2.35, fx: 0.16, bx: 0.22, w: 0.15, cx: -0.04, dome: 0.03 },
      ];
      function rigHeadGeometry() {
        const skull = rigLoft(RIG_HEAD_RINGS, 16, (i, th) => {
          const a = Math.abs(th) / RIG_DEG;
          if (i === 7 && a > 10 && a < 35) return 1; // eyes
          if (i === 9 && a > 10 && a < 50) return 1; // brows
          if (i === 4 && a < 30) return 3; // lips
          if ((i === 2 || i === 3) && a < 115) return 2; // jaw
          if (i === 4 && a < 115) return 2;
          if (i === 5 && a > 55 && a < 115) return 2; // sideburns
          if (i === 5 && a < 30) return 2; // moustache
          return 0;
        });
        return rigMerge([
          skull,
          rigBall(0.13, 0.19, 0.085, 0, 0.86, 1.27, 0, 6, 5),
          rigBall(0.17, 0.25, 0.07, 0, -0.06, 1.42, 0.64, 6, 5),
          rigBall(0.17, 0.25, 0.07, 0, -0.06, 1.42, -0.64, 6, 5),
        ]);
      }
      /* Hair styles and hats, in head space. */
      const hairRings = (list) => list.map(([y, fx, bx, w, cx = 0, dome = 0]) => ({ y, fx, bx, w, cx, dome }));
      function rigHairRingLists() {
        const short = hairRings([
          [0.95, 0.2, 0.8, 0.6],
          [1.2, 0.35, 0.87, 0.675],
          [1.55, 0.6, 0.9, 0.7],
          [1.8, 0.8, 0.9, 0.705],
          [1.98, 0.86, 0.88, 0.68],
          [2.15, 0.74, 0.78, 0.615, -0.02],
          [2.32, 0.52, 0.58, 0.45, -0.03],
          [2.45, 0.2, 0.26, 0.18, -0.03, 0.03],
        ]);
        const crop = hairRings([
          [1.05, 0.2, 0.8, 0.62],
          [1.35, 0.4, 0.86, 0.675],
          [1.65, 0.66, 0.88, 0.69],
          [1.9, 0.84, 0.88, 0.69],
          [2.1, 0.9, 0.84, 0.66],
          [2.3, 0.78, 0.68, 0.54, -0.02],
          [2.47, 0.5, 0.4, 0.34, -0.03],
          [2.56, 0.16, 0.12, 0.12, -0.03, 0.02],
        ]);
        const buzz = hairRings([
          [1.3, 0.2, 0.835, 0.66],
          [1.7, 0.62, 0.845, 0.665],
          [1.95, 0.795, 0.835, 0.64],
          [2.15, 0.67, 0.75, 0.575, -0.02],
          [2.3, 0.47, 0.56, 0.42, -0.03],
          [2.4, 0.15, 0.2, 0.15, -0.04, 0.02],
        ]);
        const long = hairRings([
          [-0.85, 0.15, 0.5, 0.7, -0.5],
          [-0.2, 0.2, 0.6, 0.74, -0.42],
          [0.45, 0.25, 0.72, 0.74, -0.25],
          [0.95, 0.35, 0.86, 0.72, -0.05],
          [1.3, 0.55, 0.9, 0.72],
          [1.6, 0.78, 0.91, 0.72],
          [1.9, 0.88, 0.9, 0.7],
          [2.1, 0.78, 0.8, 0.64, -0.02],
          [2.3, 0.54, 0.6, 0.47, -0.03],
          [2.44, 0.2, 0.25, 0.18, -0.03, 0.03],
        ]);
        const curly = hairRings([
          [0.9, 0.2, 0.92, 0.74],
          [1.25, 0.45, 1.02, 0.84],
          [1.6, 0.8, 1.06, 0.88],
          [1.95, 0.98, 1.04, 0.87],
          [2.25, 0.9, 0.94, 0.8],
          [2.5, 0.62, 0.66, 0.58],
          [2.7, 0.22, 0.24, 0.2, 0, 0.04],
        ]);
        const bob = hairRings([
          [0.7, 0.3, 0.8, 0.72, -0.05],
          [1.0, 0.55, 0.9, 0.76],
          [1.4, 0.75, 0.92, 0.74],
          [1.8, 0.86, 0.91, 0.72],
          [2.02, 0.84, 0.86, 0.67],
          [2.2, 0.7, 0.74, 0.58, -0.02],
          [2.36, 0.46, 0.52, 0.4, -0.03],
          [2.46, 0.14, 0.18, 0.13, -0.03, 0.03],
        ]);
        return { short, crop, buzz, long, curly, bob };
      }
      function rigHairGeometries() {
        const { short, crop, buzz, long, curly, bob } = rigHairRingLists();
        return {
          hairShort: rigLoft(short, 14),
          hairCrop: rigLoft(crop, 14),
          hairBuzz: rigLoft(buzz, 14),
          hairLong: rigLoft(long, 14),
          hairCurly: rigLoft(curly, 14),
          hairBun: rigMerge([rigLoft(bob, 14), rigBall(0.36, 0.34, 0.36, 0, -0.78, 2.12, 0, 8, 6)]),
          hairPony: rigMerge([
            rigLoft(bob, 14),
            rigBall(0.2, 0.2, 0.22, 0, -0.86, 1.92, 0, 6, 5),
            rigPlace(rigRegion(new Three.CylinderGeometry(0.2, 0.08, 1.4, 7, 1), 0), -1.02, 1.28, 0, 0, 0, -0.28),
          ]),
        };
      }
      /* Lift the front of a helmet's rim to the brow so the face shows beneath it. */
      function rigFaceCut(g, brow) {
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i),
            y = p.getY(i),
            front = clamp((x - 0.15) / 0.65, 0, 1);
          if (y < brow) p.setY(i, y + (brow - y) * front * front * (3 - 2 * front));
        }
        g.computeVertexNormals();
        return g;
      }
      function rigHatGeometries() {
        const dome = (list) => rigLoft(hairRings(list), 14, (i) => (i === 0 ? 1 : 0));
        return {
          // Baseball cap: crown (0), peak (1).
          cap: rigMerge([
            rigLoft(hairRings([[1.86, 0.88, 0.9, 0.715], [2.08, 0.86, 0.87, 0.69], [2.3, 0.7, 0.7, 0.56], [2.46, 0.42, 0.42, 0.34], [2.53, 0.1, 0.1, 0.1, 0, 0.02]]), 14),
            rigPlace(rigBall(0.62, 0.05, 0.6, 1, 0, 0, 0, 10, 4), 0.98, 1.9, 0, 0, 0, -0.14),
          ]),
          // Peaked patrol cap: crown (0), band and peak (1), badge (2).
          patrolCap: rigMerge([
            rigLoft(
              hairRings([[1.84, 0.84, 0.86, 0.69], [2.02, 0.86, 0.88, 0.71], [2.2, 0.9, 0.92, 0.74], [2.38, 0.98, 0.98, 0.8], [2.46, 0.94, 0.94, 0.77], [2.5, 0.2, 0.2, 0.2, 0, 0.01]]),
              14,
              (i) => (i < 2 ? 1 : 0),
            ),
            rigPlace(rigBall(0.5, 0.045, 0.62, 1, 0, 0, 0, 10, 4), 0.95, 1.86, 0, 0, 0, -0.22),
            rigBall(0.06, 0.13, 0.12, 2, 0.93, 2.16, 0, 6, 4),
          ]),
          // Ballistic helmet: shell (0), strap / band (1), mount (2).
          helmet: rigMerge([
            rigFaceCut(rigLoft(
              hairRings([[1.36, 0.92, 1.0, 0.8, -0.02], [1.56, 0.96, 1.02, 0.83], [1.72, 0.97, 1.02, 0.83], [1.98, 0.95, 0.99, 0.81], [2.26, 0.8, 0.85, 0.68], [2.5, 0.5, 0.55, 0.43], [2.63, 0.15, 0.15, 0.15, 0, 0.02]]),
              14,
              (i) => (i === 1 || i === 2 ? 1 : 0),
            ), 1.86),
            rigBox(0.14, 0.3, 0.34, 2, 0.98, 2.08, 0),
          ]),
          // Straw sun hat: crown (0), brim (1).
          sunhat: rigMerge([
            dome([[1.9, 0.8, 0.8, 0.68], [2.15, 0.78, 0.78, 0.66], [2.4, 0.62, 0.62, 0.52], [2.55, 0.2, 0.2, 0.2, 0, 0.03]]),
            rigPlace(rigRegion(new Three.CylinderGeometry(1.45, 1.5, 0.08, 16, 1), 1), 0, 1.92, 0),
          ]),
          // Hard hat: shell (0), brim (1).
          hardHat: rigMerge([
            dome([[1.9, 0.9, 0.92, 0.76], [2.2, 0.86, 0.88, 0.72], [2.45, 0.64, 0.66, 0.54], [2.62, 0.18, 0.18, 0.16, 0, 0.03]]),
            rigPlace(rigBall(0.62, 0.05, 0.62, 1, 0, 0, 0, 10, 4), 0.62, 1.94, 0),
            rigBox(1.5, 0.06, 1.62, 1, 0, 1.92, 0),
          ]),
        };
      }
      /**
       * TORSO
       * Joint at the waist (hips + RIG.waist). Regions:
       *   0 belly, 1 open front (a V widening upwards), 2 bust band, 3 upper
       *   chest and back, 4 shoulder yoke and collar line, 5 badge (left chest),
       *   6 centre strip (tie, placket, zip), 7 waistband.
       */
      const TORSO_SAMPLES = [-0.3, 0.1, 0.45, 0.62, 0.8, 1.05, 1.25, 1.4, 1.62, 1.85, 2.0, 2.12, 2.35, 2.6, 2.8, 2.9, 2.98, 3.1, 3.22, 3.32, 3.4];
      function torsoRegion(i, th, y, x, z) {
        const a = Math.abs(th) / RIG_DEG,
          front = a < 62;
        if (front && a < 5 && y > 1.0 && y < 3.2) return 6;
        if (front && y > 1.4 && Math.abs(z) < 0.1 + (y - 1.4) * 0.27) return 1;
        if (y > 2.2 && y < 2.5 && th < -14 * RIG_DEG && th > -28 * RIG_DEG) return 5;
        // The shoulder tops (epaulettes, bare shoulders); the ring round the neck stays with the upper band.
        if (y >= 2.85 && Math.abs(z) > 0.72) return 4;
        if (y >= 2.05) return 3;
        if (y >= 1.25) return 2;
        if (y <= 0.62) return 7;
        return 0;
      }
      function rigTorsoKeys(female) {
        return female
          ? [
              { y: -0.3, fx: 0.74, bx: 0.8, w: 1.02, n: 2.2 },
              { y: 0.25, fx: 0.72, bx: 0.76, w: 0.96, n: 2.2 },
              { y: 0.75, fx: 0.8, bx: 0.8, w: 1.06, n: 2.3 },
              { y: 1.2, fx: 0.98, bx: 0.84, w: 1.2, n: 2.4 },
              { y: 1.55, fx: 1.15, bx: 0.86, w: 1.3, n: 2.4 },
              { y: 1.9, fx: 1.1, bx: 0.88, w: 1.34, n: 2.4 },
              { y: 2.25, fx: 0.96, bx: 0.9, w: 1.4, n: 2.5 },
              { y: 2.6, fx: 0.9, bx: 0.9, w: 1.48, n: 2.5 },
              { y: 2.85, fx: 0.82, bx: 0.86, w: 1.52, n: 2.4 },
              { y: 3.05, fx: 0.7, bx: 0.78, w: 1.46, n: 2.3 },
              { y: 3.22, fx: 0.54, bx: 0.6, w: 1.16, n: 2.1 },
              { y: 3.34, fx: 0.4, bx: 0.43, w: 0.6 },
              { y: 3.4, fx: 0.38, bx: 0.41, w: 0.5 },
            ]
          : [
              { y: -0.3, fx: 0.84, bx: 0.86, w: 1.14, n: 2.3 },
              { y: 0.2, fx: 0.86, bx: 0.86, w: 1.18, n: 2.3 },
              { y: 0.7, fx: 0.92, bx: 0.87, w: 1.27, n: 2.4 },
              { y: 1.2, fx: 1.0, bx: 0.9, w: 1.38, n: 2.5 },
              { y: 1.7, fx: 1.08, bx: 0.94, w: 1.5, n: 2.6 },
              { y: 2.15, fx: 1.1, bx: 0.98, w: 1.6, n: 2.6 },
              { y: 2.55, fx: 1.02, bx: 1.0, w: 1.68, n: 2.7 },
              { y: 2.85, fx: 0.92, bx: 0.96, w: 1.74, n: 2.6 },
              { y: 3.05, fx: 0.78, bx: 0.86, w: 1.68, n: 2.4 },
              { y: 3.22, fx: 0.6, bx: 0.68, w: 1.36, n: 2.2 },
              { y: 3.34, fx: 0.45, bx: 0.48, w: 0.7 },
              { y: 3.4, fx: 0.42, bx: 0.44, w: 0.56 },
            ];
      }
      function rigTorsoGeometry(female) {
        return rigLoft(rigProfile(rigTorsoKeys(female), TORSO_SAMPLES), 16, torsoRegion);
      }
      /* Pelvis: joint at the hip joints' height. Regions: 0 cloth, 1 belt, 2 buckle. */
      function rigPelvisRings(female) {
        const w = female ? 1.08 : 1.0;
        return [
          { y: -0.88, fx: 0.3, bx: 0.36, w: 0.42 * w },
          { y: -0.62, fx: 0.7, bx: 0.8, w: 1.02 * w },
          { y: -0.2, fx: 0.78, bx: (female ? 0.98 : 0.92), w: 1.26 * w, n: 2.3 },
          { y: 0.3, fx: 0.82, bx: 0.88, w: 1.25 * w, n: 2.3 },
          { y: 0.6, fx: 0.84, bx: 0.85, w: (female ? 1.16 : 1.22), n: 2.3 },
          { y: 0.72, fx: 0.86, bx: 0.87, w: (female ? 1.14 : 1.22), n: 2.3 },
          { y: 0.98, fx: 0.86, bx: 0.87, w: (female ? 1.08 : 1.2), n: 2.3 },
          { y: 1.08, fx: 0.84, bx: 0.85, w: (female ? 1.04 : 1.17), n: 2.3 },
          { y: 1.22, fx: 0.7, bx: 0.72, w: 0.98 },
        ];
      }
      function rigPelvisGeometry(female) {
        return rigLoft(rigPelvisRings(female), 16, (i, th) => (i >= 5 && i <= 6 ? (Math.abs(th) < 14 * RIG_DEG ? 2 : 1) : 0));
      }
      /* Skirt or dress hem: open, drawn double sided. Regions: 0 cloth, 1 hem. */
      function rigSkirtGeometry() {
        const rings = [
          { y: 0.95, fx: 0.9, bx: 0.92, w: 1.14 },
          { y: 0.2, fx: 1.0, bx: 1.08, w: 1.36 },
          { y: -0.8, fx: 1.1, bx: 1.2, w: 1.5 },
          { y: -2.1, fx: 1.25, bx: 1.34, w: 1.62 },
          { y: -2.3, fx: 1.27, bx: 1.36, w: 1.64 },
        ];
        return rigLoft(rings, 16, (i) => (i === 4 ? 1 : 0), false, false);
      }
      /* Limbs hang down (-y) from their joint. Regions by height (see paints). */
      const RIG_UPPER_ARM_RINGS = [
          { y: 0.3, fx: 0.3, w: 0.3, dome: 0.06 },
          { y: 0.12, fx: 0.5, bx: 0.48, w: 0.5 },
          { y: -0.3, fx: 0.55, bx: 0.52, w: 0.54 },
          { y: -0.75, fx: 0.5, bx: 0.49, w: 0.5 },
          { y: -1.05, fx: 0.47, bx: 0.47, w: 0.46 },
          { y: -1.2, fx: 0.46, bx: 0.46, w: 0.45 },
          { y: -1.9, fx: 0.4, bx: 0.39, w: 0.38 },
          { y: -2.5, fx: 0.34, bx: 0.37, w: 0.34 },
          { y: -2.8, fx: 0.3, bx: 0.33, w: 0.3, dome: 0.1 },
        ],
        RIG_FOREARM_RINGS = [
          { y: 0.28, fx: 0.3, bx: 0.33, w: 0.3, dome: 0.08 },
          { y: -0.1, fx: 0.34, bx: 0.37, w: 0.34 },
          { y: -0.6, fx: 0.36, bx: 0.34, w: 0.35 },
          { y: -1.5, fx: 0.27, bx: 0.26, w: 0.26 },
          { y: -1.72, fx: 0.24, bx: 0.23, w: 0.22 },
          { y: -2.0, fx: 0.19, bx: 0.19, w: 0.17 },
          { y: -2.12, fx: 0.15, bx: 0.15, w: 0.13 },
        ];
      const rigUpperArmGeometry = () => rigLoft(RIG_UPPER_ARM_RINGS, 10, (i) => (i <= 4 ? 0 : 1)),
        rigForearmGeometry = () => rigLoft(RIG_FOREARM_RINGS, 9, (i) => (i >= 4 ? 1 : 0));
      /* Hand from the wrist: palm, curled fingers, thumb. Thin across (z). */
      function rigHandGeometry() {
        return rigMerge([
          rigLoft(
            [
              { y: 0.08, fx: 0.18, bx: 0.18, w: 0.14 },
              { y: -0.3, fx: 0.3, bx: 0.28, w: 0.16 },
              { y: -0.78, fx: 0.31, bx: 0.28, w: 0.15 },
              { y: -1.12, fx: 0.26, bx: 0.22, w: 0.14, cx: 0.05 },
              { y: -1.36, fx: 0.16, bx: 0.12, w: 0.11, cx: 0.12, dome: 0.03 },
            ],
            7,
          ),
          rigPlace(rigRegion(new Three.CylinderGeometry(0.08, 0.1, 0.66, 5, 1), 0), 0.3, -0.52, 0.06, 0, 0, 0.55),
        ]);
      }
      function rigThighRings(female) {
        const w = female ? 1.05 : 1;
        return [
            { y: 0.55, fx: 0.62, bx: 0.66, w: 0.62 * w },
            { y: 0.05, fx: 0.7, bx: 0.72, w: 0.7 * w },
            { y: -0.6, fx: 0.7, bx: 0.66, w: 0.66 * w },
            { y: -1.3, fx: 0.6, bx: 0.58, w: 0.58 * w },
            { y: -1.45, fx: 0.59, bx: 0.56, w: 0.57 * w },
            { y: -2.5, fx: 0.47, bx: 0.47, w: 0.46 },
            { y: -3.25, fx: 0.43, bx: 0.41, w: 0.42 },
            { y: -3.55, fx: 0.38, bx: 0.36, w: 0.38, dome: 0.12 },
          ];
      }
      const rigThighGeometry = (female) => rigLoft(rigThighRings(female), 10, (i) => (i <= 3 ? 0 : 1));
      const RIG_SHIN_RINGS = [
        { y: 0.32, fx: 0.38, bx: 0.36, w: 0.38, dome: 0.1 },
        { y: -0.12, fx: 0.42, bx: 0.4, w: 0.42 },
        { y: -0.35, fx: 0.37, bx: 0.44, w: 0.41 },
        { y: -1.0, fx: 0.35, bx: 0.52, w: 0.42 },
        { y: -1.9, fx: 0.31, bx: 0.36, w: 0.33 },
        { y: -2.75, fx: 0.26, bx: 0.26, w: 0.25 },
        { y: -2.9, fx: 0.25, bx: 0.25, w: 0.24 },
        { y: -3.45, fx: 0.23, bx: 0.24, w: 0.22 },
        { y: -3.62, fx: 0.15, bx: 0.15, w: 0.15, dome: 0.03 },
      ];
      const rigShinGeometry = () => rigLoft(RIG_SHIN_RINGS, 9, (i) => (i <= 1 ? 2 : i >= 6 ? 1 : 0));
      /* Shoe or boot, from the ankle joint; sole at -RIG.ankle. Regions: 0 upper, 1 sole, 2 collar / shaft. */
      function rigShoeGeometry(boot) {
        // Lofted along the foot (loft y = forward); loft x becomes down.
        const top = boot ? 1.45 : 0.6,
          rings = [
            { y: -0.62, fx: 0.3, bx: boot ? top - 0.1 : 0.4, w: 0.26, cx: 0.25 },
            { y: -0.46, fx: 0.3, bx: boot ? top : 0.6, w: 0.32, cx: 0.25 },
            { y: -0.05, fx: 0.3, bx: boot ? top : 0.72, w: 0.35, cx: 0.25 },
            { y: 0.25, fx: 0.3, bx: boot ? top - 0.3 : 0.6, w: 0.37, cx: 0.25 },
            { y: 0.65, fx: 0.3, bx: 0.44, w: 0.39, cx: 0.25 },
            { y: 1.1, fx: 0.28, bx: 0.3, w: 0.4, cx: 0.27 },
            { y: 1.42, fx: 0.26, bx: 0.22, w: 0.34, cx: 0.29 },
            { y: 1.6, fx: 0.18, bx: 0.1, w: 0.2, cx: 0.31, dome: 0.03 },
          ];
        const g = rigLoft(rings, 10, (i, th, y, x) => (x > 0.46 ? 1 : x < -0.25 ? 2 : 0));
        g.rotateZ(-Math.PI / 2);
        return g;
      }
      // @include src/character-rig3d-kit.js
      // @include src/character-rig3d-weapons.js

      /* ---- Paint ------------------------------------------------------------------ */
      const hexCache = new Map();
      function packColor(hex) {
        let v = hexCache.get(hex);
        if (v === undefined) {
          const c = new Three.Color(hex);
          // Three.Color holds linear values; pack the sRGB bytes.
          const s = c.clone().convertLinearToSRGB();
          v = Math.round(s.r * 255) * 65536 + Math.round(s.g * 255) * 256 + Math.round(s.b * 255);
          hexCache.set(hex, v);
        }
        return v;
      }
      const maskOf = (slots) => slots.reduce((m, slot, region) => m + slot * Math.pow(4, region), 0);
      /* A paint: colours for slots A-D, the region mask, pattern for A, rim. */
      function rigPaint(a, b = a, c = a, d = a, slots = [0, 1, 2, 3, 0, 0, 0, 0], pattern = 0, rim = 0) {
        return new Float32Array([packColor(a), packColor(b), packColor(c), packColor(d), maskOf(slots), pattern + rim * 16]);
      }
      const PATTERN = { camo: 1, denim: 2, check: 3, floral: 4, stripes: 5, leather: 6, satin: 7, kitStripes: 8, kitHoops: 9, kitHalves: 10, kitSash: 11 };
      // Torso region -> slot, per garment (slots: 0 outer, 1 inner, 2 accent, 3 skin).
      const TORSO_MASKS = {
        tee: [0, 0, 0, 0, 0, 0, 0, 0],
        vneck: [0, 3, 0, 0, 0, 0, 3, 0],
        tank: [0, 0, 0, 0, 3, 0, 0, 0],
        crop: [3, 0, 0, 0, 0, 0, 0, 3],
        bikini: [3, 3, 0, 3, 3, 3, 3, 3],
        shirtless: [3, 3, 3, 3, 3, 3, 3, 3],
        jacket: [0, 1, 0, 0, 0, 0, 1, 0],
        accentJacket: [0, 1, 0, 0, 2, 0, 1, 0],
        suit: [0, 1, 0, 0, 0, 0, 2, 0],
        uniform: [0, 0, 0, 0, 0, 2, 1, 0],
        hoodie: [0, 0, 0, 0, 0, 0, 2, 0],
        dress: [0, 0, 0, 0, 3, 0, 0, 0],
      };
      // @include src/character-near3d.js
      // END SUBSYSTEM: src/character-rig3d.js
