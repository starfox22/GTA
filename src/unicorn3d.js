      // BEGIN SUBSYSTEM: src/unicorn3d.js — Aurora, the black unicorn on Sunset Pier
      /**
       * Aurora, the black unicorn on Sunset Pier
       * Source: src/unicorn3d.js
       * Scope: createCityRenderer() closure (included by themepark3d.js, after
       * the gate; uses parkParts, parkMats, parkBulbs and parkRoot).
       * A monumental rearing unicorn (12 m to the horn tip, 13 m above the
       * lawn) on the lawn south of the drop tower (PIER.unicorn), cast in
       * polished black: a clearcoated lacquer whose reflections are folded up
       * into the sky (see OBSIDIAN), so the blue of the day and the sunset run
       * along her back and a sky rim outlines her against the grass; the edges
       * of her mane and tail turn a shade lighter (anthracite). Her spiral horn
       * is polished gold, her hooves stay black. She stands on a low octagonal
       * plinth of polished black granite (1.3 m) with a brass line inlaid under
       * the cornice and an engraved brass AURORA plaque on the face towards the
       * street camera, in a ring of pale paving painted on the lawn
       * (themepark.js). The sculpt is Catmull-Rom tubes with elliptical
       * sections (body, neck, head, legs, the crest, mane and tail locks, the
       * spiral horn) and a few embedded masses for the musculature, modelled
       * in life-size metres and scaled up. At night four warm-white uplights
       * in the paving catch her gloss (a shader term, UPLIGHTS: glints more
       * than light on the black) and the horn glows softly. Everything is
       * merged per material: about 9.2k triangles in five draws, and the plaque.
       */
      const UNICORN = PIER.unicorn,
        // Model metres to world units (3.75 times life size: 12 m to the horn tip); the plinth top (1.3 m).
        UNICORN_SCALE = 30,
        UNICORN_PLINTH_TOP = 10.4,
        // Where the sculpt's origin sits on the plinth, along her heading (model metres),
        // so her hooves, the rock and the tail's touch all stand on the plinth top.
        UNICORN_SHIFT = 0.36,
        // The plinth's die (octagon circumradius) and the plaque's height on it.
        UNICORN_DIE = 23.5,
        UNICORN_PLAQUE_Y = 5.6,
        // The uplights: map angles round her and their distance, set in the paving.
        UNICORN_LAMPS = [Math.PI * 0.6, Math.PI * 0.16, -Math.PI * 0.42, Math.PI * 0.97],
        UNICORN_LAMP_RADIUS = 39;
      const unicornHornTip = new Three.Vector3();
      /**
       * OBSIDIAN
       * One patched physical material serves the statue, her mane, the granite
       * and the horn (one shader program, per-material uniforms):
       * - reflections folded into the sky: both city cameras look down, so a
       *   mirror-true reflection off her flanks would show the dim ground and a
       *   black statue would read as a hole in the lawn; folded up, the gloss
       *   carries the sky, the sunset and the clearcoat's bright rim;
       * - the sky's colour partly desaturated, so black reads black (not navy)
       *   at noon and still warms at sunset, and `unicornRim`, the sky along
       *   her edges, so she stands out from the grass seen from above;
       * - `unicornEdge` lightens grazing surfaces towards anthracite (the locks
       *   of the mane and tail);
       * - `unicornSpeckle` gives the granite its grain and a slow cloud;
       * - UPLIGHTS: the island has no city light map, so four lamps round her
       *   are a term of their own: each lights what faces it and rises above
       *   it, fading with distance, scaled by the night, with a sharp specular
       *   glint (Blinn-Phong in view space) since black lacquer shows light as
       *   reflection rather than colour.
       */
      const unicornUniforms = {
        unicornLights: { value: UNICORN_LAMPS.map(() => new Three.Vector3()) },
        unicornLightColor: { value: new Three.Color('#ffe6c4') },
        unicornLightPower: { value: 0 },
      };
      const UNICORN_PARS = `
        uniform vec3 unicornLights[ ${UNICORN_LAMPS.length} ];
        uniform vec3 unicornLightColor;
        uniform float unicornLightPower;
        uniform float unicornUplight;
        uniform float unicornEdge;
        uniform vec3 unicornEdgeColor;
        uniform float unicornSpeckle;
        uniform float unicornRim;`,
        UNICORN_SURFACE = `
        {
          vec3 unicornView = isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition );
          float unicornGrazing = 1.0 - clamp( abs( dot( normal, unicornView ) ), 0.0, 1.0 );
          diffuseColor.rgb = mix( diffuseColor.rgb, unicornEdgeColor, unicornEdge * pow( unicornGrazing, 1.4 ) );
          if ( unicornSpeckle > 0.0 ) {
            // A slow cloud in the stone and a faint coarse grain (coarse, so the
            // far camera does not shimmer on it).
            vec3 grainCell = floor( vCityWorld * 0.6 );
            float grain = fract( sin( dot( grainCell, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
            float cloud = 0.5 + 0.5 * sin( vCityWorld.x * 0.23 + sin( vCityWorld.z * 0.17 ) * 2.0 ) * sin( vCityWorld.z * 0.21 + vCityWorld.y * 0.35 );
            diffuseColor.rgb *= 0.8 + ( 0.4 * cloud + 0.18 * grain ) * unicornSpeckle;
          }
        }`,
        UNICORN_UPLIGHT = `
        #ifdef ENVMAP_TYPE_CUBE_UV
        if ( unicornRim > 0.0 ) {
          // Rim light: the sky along her edges (see OBSIDIAN).
          vec3 rimView = isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition );
          float rim = pow( 1.0 - clamp( abs( dot( normal, rimView ) ), 0.0, 1.0 ), 2.4 );
          vec3 rimDir = inverseTransformDirection( normal, viewMatrix );
          rimDir.y = abs( rimDir.y ) * 0.6 + 0.35;
          vec3 rimSky = textureCubeUV( envMap, normalize( rimDir ), 0.3 ).rgb;
          rimSky = mix( vec3( dot( rimSky, vec3( 0.3, 0.59, 0.11 ) ) ), rimSky, 0.7 );
          reflectedLight.indirectSpecular += rimSky * envMapIntensity * unicornRim * rim;
        }
        #endif
        if ( unicornLightPower > 0.001 && unicornUplight > 0.0 ) {
          vec3 upView = isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition );
          vec3 upPos = - vViewPosition;
          float upDiffuse = 0.0, upGlint = 0.0;
          float upShine = mix( 24.0, 240.0, 1.0 - material.roughness );
          for ( int i = 0; i < ${UNICORN_LAMPS.length}; i++ ) {
            vec3 toLampWorld = unicornLights[ i ] - vCityWorld;
            float d = length( toLampWorld );
            // Aimed up: a wide cone above the lamp, nothing below its lens.
            float beam = smoothstep( 0.04, 0.42, - toLampWorld.y / max( d, 0.001 ) );
            float fall = beam / ( 1.0 + d * d / 5200.0 );
            vec3 toLamp = normalize( ( viewMatrix * vec4( unicornLights[ i ], 1.0 ) ).xyz - upPos );
            float facing = max( dot( normal, toLamp ), 0.0 );
            upDiffuse += facing * fall;
            upGlint += pow( max( dot( normal, normalize( toLamp + upView ) ), 0.0 ), upShine ) * fall * facing;
          }
          vec3 upLight = unicornLightColor * unicornLightPower * unicornUplight;
          reflectedLight.directDiffuse += upLight * upDiffuse * material.diffuseColor;
          // Black lacquer shows the lamps as tight warm glints, a faint sheen round them.
          reflectedLight.directSpecular += upLight * ( upGlint * 2.2 + upDiffuse * 0.012 );
        }`,
        UNICORN_IBL = `
        vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
          #ifdef ENVMAP_TYPE_CUBE_UV
            vec3 reflectVec = reflect( - viewDir, normal );
            reflectVec = normalize( mix( reflectVec, normal, roughness * roughness ) );
            reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
            reflectVec.y = abs( reflectVec.y ) * 0.8 + 0.1;
            reflectVec = normalize( reflectVec );
            vec3 sky = textureCubeUV( envMap, reflectVec, roughness ).rgb;
            // A little of the sky's colour is kept, so black reads as black
            // (not navy) under a blue noon and still warms at sunset.
            sky = mix( vec3( dot( sky, vec3( 0.3, 0.59, 0.11 ) ) ), sky, 0.55 );
            return sky * envMapIntensity;
          #else
            return vec3( 0.0 );
          #endif
        }`;
      function unicornMaterial(settings, { uplight = 1, edge = 0, edgeColor = '#3a3b41', speckle = 0, rim = 0 } = {}) {
        const m = new Three.MeshPhysicalMaterial(settings),
          own = {
            unicornUplight: { value: uplight },
            unicornEdge: { value: edge },
            unicornEdgeColor: { value: new Three.Color(edgeColor) },
            unicornSpeckle: { value: speckle },
            unicornRim: { value: rim },
          };
        m.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          Object.assign(shader.uniforms, unicornUniforms, own);
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\n' + UNICORN_PARS)
            .replace(
              '#include <envmap_physical_pars_fragment>',
              Three.ShaderChunk.envmap_physical_pars_fragment.replace(/vec3 getIBLRadiance\([\s\S]*?\n\t}\n/, UNICORN_IBL + '\n'),
            )
            .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + UNICORN_SURFACE)
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + UNICORN_UPLIGHT);
        };
        m.customProgramCacheKey = () => 'unicorn-obsidian';
        return m;
      }
      const unicornMats = {
        // Black lacquer over bronze: a touch of blue in the black, a firm
        // clearcoat for the sky and the sun's glints.
        obsidian: unicornMaterial(
          { color: '#07080b', roughness: 0.3, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 },
          { edge: 0.35, edgeColor: '#1c1d22', rim: 0.45 },
        ),
        // The mane and tail: the same black, the lock edges turning anthracite.
        mane: unicornMaterial(
          { color: '#0b0c10', roughness: 0.36, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 },
          { edge: 1, edgeColor: '#4a4b52', rim: 0.55 },
        ),
        // Polished black granite: grain, a slow cloud, a softer gloss than hers.
        granite: unicornMaterial(
          { color: '#1d1e22', roughness: 0.34, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.14, envMapIntensity: 1.3 },
          { uplight: 0.7, speckle: 1, rim: 0.12 },
        ),
        horn: unicornMaterial(
          { color: '#e8bf62', roughness: 0.18, metalness: 1, clearcoat: 0.5, clearcoatRoughness: 0.05, envMapIntensity: 1.5, emissive: '#ffcf7a', emissiveIntensity: 0 },
          { uplight: 0.8 },
        ),
      };
      /**
       * SCULPTED TUBES
       * Control rings {p: [x, y, z], r, w, o}: centre, the half-size along the
       * frame's normal (r) and across it (w), and an offset of the centre along
       * the normal (o). Centres and sizes are Catmull-Rom interpolated, `perSpan`
       * rings between control rings, `sides` round. The normal is `hint` made
       * square to the tube, so a flattened lock's broad side can be turned
       * towards the sky (the camera) or sideways. `groove(angle, s)` scales the
       * section (the horn's spiral); `cap` closes the far end (hooves).
       */
      const unicornCatmull = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
      function unicornTube(ctrl, { perSpan = 3, sides = 10, hint = [0, 1, 0], groove = null, cap = false } = {}) {
        const n = ctrl.length,
          at = (i) => ctrl[Math.max(0, Math.min(n - 1, i))],
          rings = [];
        for (let i = 0; i < n - 1; i++)
          for (let k = 0; k < (i === n - 2 ? perSpan + 1 : perSpan); k++) {
            const t = k / perSpan,
              a = at(i - 1),
              b = at(i),
              c = at(i + 1),
              d = at(i + 2),
              f = (get) => unicornCatmull(get(a), get(b), get(c), get(d), t);
            rings.push({
              p: [0, 1, 2].map((j) => f((q) => q.p[j])),
              r: Math.max(0.0015, f((q) => q.r)),
              w: Math.max(0.0015, f((q) => q.w ?? q.r)),
              o: f((q) => q.o || 0),
            });
          }
        const count = rings.length,
          pos = [],
          idx = [],
          tangent = new Three.Vector3(),
          normal = new Three.Vector3(),
          side = new Three.Vector3(),
          hintV = new Three.Vector3(...hint),
          prevNormal = new Three.Vector3();
        for (let i = 0; i < count; i++) {
          const a = rings[Math.max(0, i - 1)].p,
            b = rings[Math.min(count - 1, i + 1)].p,
            ring = rings[i];
          tangent.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
          normal.copy(hintV).addScaledVector(tangent, -hintV.dot(tangent));
          if (normal.lengthSq() < 0.04) normal.copy(prevNormal).addScaledVector(tangent, -prevNormal.dot(tangent));
          normal.normalize();
          prevNormal.copy(normal);
          side.crossVectors(tangent, normal).normalize();
          for (let k = 0; k < sides; k++) {
            const angle = (k / sides) * TAU,
              g = groove ? groove(angle, i / (count - 1)) : 1,
              u = Math.cos(angle) * ring.r * g + ring.o,
              v = Math.sin(angle) * ring.w * g;
            pos.push(ring.p[0] + normal.x * u + side.x * v, ring.p[1] + normal.y * u + side.y * v, ring.p[2] + normal.z * u + side.z * v);
          }
        }
        for (let i = 0; i < count - 1; i++)
          for (let k = 0; k < sides; k++) {
            const k2 = (k + 1) % sides,
              a = i * sides + k,
              b = i * sides + k2,
              c = (i + 1) * sides + k,
              d = (i + 1) * sides + k2;
            idx.push(a, b, c, b, d, c);
          }
        if (cap) {
          const last = rings[count - 1].p,
            centre = pos.length / 3;
          pos.push(last[0], last[1], last[2]);
          for (let k = 0; k < sides; k++) idx.push((count - 1) * sides + k, (count - 1) * sides + ((k + 1) % sides), centre);
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(pos, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        return geo;
      }
      /* A mass under the skin (a muscle): a flattened ellipsoid, radii along its
         own x, y, z, turned `roll` about z (in the body's plane), at `p`. */
      const unicornMassGeo = new Three.SphereGeometry(1, 10, 7);
      function unicornMass(p, radii, roll) {
        const geo = unicornMassGeo.clone();
        geo.scale(...radii);
        geo.rotateZ(roll);
        geo.translate(...p);
        return geo;
      }
      /* Aurora in life-size metres: x forward, y up, z to her left (her right
         side, with the mane, faces the street camera). She rears on her hind
         legs, the body pitched up 42 degrees, forelegs folded high, the neck
         arched and the head bowed and turned a little towards the camera, the
         horn thrust forward; the mane streams back off the crest in long
         waved locks and the tail sweeps down in an S to the plinth (the
         sculptor's third point of support) and fans out behind. */
      function unicornStatue(parts, matrix) {
        const add = (material, geo) => parts.add(material, geo, matrix),
          pitch = (42 * Math.PI) / 180,
          dir = [Math.cos(pitch), Math.sin(pitch)],
          up = [-Math.sin(pitch), Math.cos(pitch)],
          rumpX = -0.62,
          rumpY = 0.98,
          length = 1.45,
          // A point in the body's frame: t along the spine, `rise` towards the back.
          body = (t, rise = 0, z = 0) => [rumpX + dir[0] * t * length + up[0] * rise, rumpY + dir[1] * t * length + up[1] * rise, z],
          offset = (p, dx, dy, dz = 0) => [p[0] + dx, p[1] + dy, p[2] + dz];
        // The rock she rears from, carved from the plinth's granite.
        {
          const rock = new Three.SphereGeometry(1, 22, 10),
            p = rock.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const x = p.getX(i),
              y = p.getY(i),
              z = p.getZ(i),
              bump = 1 + 0.16 * Math.sin(x * 5.1 + z * 3.3) * Math.cos(z * 4.7 - x * 2.1) + 0.08 * Math.sin(x * 11 + y * 7) * Math.cos(z * 9 - y * 5) + 0.05 * Math.abs(Math.sin(x * 17 + z * 13));
            p.setXYZ(i, x * bump, Math.max(-0.2, y) * bump, z * bump);
          }
          rock.computeVertexNormals();
          rock.scale(0.6, 0.15, 0.46);
          rock.translate(-0.3, -0.02, 0);
          add(unicornMats.granite, rock);
        }
        // Barrel: round hindquarters, a lean waist, a deep girth and chest.
        add(
          unicornMats.obsidian,
          unicornTube(
            [
              { p: body(-0.06), r: 0.04, w: 0.04, o: 0.08 },
              { p: body(0.0), r: 0.2, w: 0.17, o: 0.07 },
              { p: body(0.08), r: 0.31, w: 0.27, o: 0.05 },
              { p: body(0.17), r: 0.35, w: 0.305, o: 0.03 },
              { p: body(0.3), r: 0.33, w: 0.28 },
              { p: body(0.45), r: 0.31, w: 0.25, o: -0.035 },
              { p: body(0.6), r: 0.33, w: 0.255, o: -0.03 },
              { p: body(0.74), r: 0.355, w: 0.265, o: -0.015 },
              { p: body(0.86), r: 0.36, w: 0.26 },
              { p: body(0.95), r: 0.3, w: 0.235, o: 0.02 },
              { p: body(1.01), r: 0.18, w: 0.16 },
              { p: body(1.05), r: 0.03, w: 0.03 },
            ],
            { perSpan: 3, sides: 20, hint: [up[0], up[1], 0] },
          ),
        );
        // Musculature: the hindquarters, the shoulders over the scapulae, the chest.
        for (const side of [-1, 1]) {
          add(unicornMats.obsidian, unicornMass(body(0.15, 0.02, side * 0.13), [0.3, 0.26, 0.17], pitch));
          add(unicornMats.obsidian, unicornMass(body(0.78, -0.03, side * 0.125), [0.26, 0.13, 0.13], pitch - 1.0));
          add(unicornMats.obsidian, unicornMass(body(0.96, -0.17, side * 0.075), [0.15, 0.14, 0.11], pitch));
        }
        // Neck: out of the top of the chest, a long arch up to the poll, turning
        // a little to her right towards its top.
        const withers = body(0.86, 0.1),
          neck = [
            { p: withers, r: 0.31, w: 0.21 },
            { p: offset(withers, 0.14, 0.33, -0.005), r: 0.25, w: 0.16 },
            { p: offset(withers, 0.26, 0.64, -0.02), r: 0.19, w: 0.13 },
            { p: offset(withers, 0.31, 0.9, -0.045), r: 0.15, w: 0.11 },
            { p: offset(withers, 0.3, 1.03, -0.065), r: 0.13, w: 0.1 },
          ];
        add(unicornMats.obsidian, unicornTube(neck, { perSpan: 3, sides: 16, hint: [-1, 0.25, 0] }));
        // Head: bowed 40 degrees below level from the poll, turned `turn` about
        // the vertical towards her right; the jaw deep at the back, nostrils flared.
        const poll = offset(neck[4].p, 0.02, 0.05, -0.01),
          headDown = (40 * Math.PI) / 180,
          turn = 0.32,
          hd = [Math.cos(headDown), -Math.sin(headDown)],
          hn = [Math.sin(headDown), Math.cos(headDown)],
          headLength = 0.64,
          turned = (x, y, z) => [x * Math.cos(turn) + z * Math.sin(turn), y, -x * Math.sin(turn) + z * Math.cos(turn)],
          head = (s, rise = 0, z = 0) => {
            const [x, y, dz] = turned(hd[0] * s * headLength + hn[0] * rise, hd[1] * s * headLength + hn[1] * rise, z);
            return [poll[0] + x, poll[1] + y, poll[2] + dz];
          },
          headUp = turned(hn[0], hn[1], 0);
        add(
          unicornMats.obsidian,
          unicornTube(
            [
              { p: head(-0.06), r: 0.1, w: 0.09 },
              { p: head(0.06), r: 0.165, w: 0.12, o: -0.045 },
              { p: head(0.2), r: 0.155, w: 0.118, o: -0.035 },
              { p: head(0.36), r: 0.112, w: 0.095, o: -0.01 },
              { p: head(0.55), r: 0.088, w: 0.078 },
              { p: head(0.74), r: 0.086, w: 0.074, o: -0.006 },
              { p: head(0.88), r: 0.094, w: 0.084, o: -0.012 },
              { p: head(0.97), r: 0.075, w: 0.066, o: -0.015 },
              { p: head(1.03), r: 0.02, w: 0.02, o: -0.01 },
            ],
            { perSpan: 3, sides: 14, hint: headUp },
          ),
        );
        // Ears, pricked up and a little forward.
        for (const z of [-1, 1]) {
          const base = head(0.03, 0.1, z * 0.055),
            tip = head(-0.02, 0.29, z * 0.085),
            mid = head(0.01, 0.2, z * 0.075);
          add(
            unicornMats.obsidian,
            unicornTube(
              [
                { p: base, r: 0.04, w: 0.028 },
                { p: mid, r: 0.034, w: 0.024 },
                { p: tip, r: 0.003, w: 0.003 },
              ],
              { perSpan: 3, sides: 6, hint: turned(1, 0, 0) },
            ),
          );
        }
        // The horn: a polished gold two-start spiral from the forehead, thrust forward.
        let hornTip;
        {
          const base = head(0.2, 0.12),
            hornDir = turned(hd[0] * 0.5 + hn[0] * 0.87, hd[1] * 0.5 + hn[1] * 0.87, 0),
            len = Math.hypot(...hornDir),
            hornLength = 0.62,
            ctrl = [];
          for (let i = 0; i <= 4; i++) {
            const s = i / 4;
            ctrl.push({ p: [0, 1, 2].map((j) => base[j] + (hornDir[j] / len) * s * hornLength), r: 0.056 * (1 - s) + 0.003 });
          }
          add(unicornMats.horn, unicornTube(ctrl, { perSpan: 4, sides: 12, hint: turned(0, 0, 1), groove: (angle, s) => 0.8 + 0.2 * Math.cos(angle * 2 - s * TAU * 3.5) }));
          hornTip = ctrl[4].p;
        }
        // Legs through their joints (rings flattened across the leg), black hooves.
        const leg = (joints, hoofDir) => {
          add(unicornMats.obsidian, unicornTube(joints, { perSpan: 2, sides: 10, hint: [0, 0, 1] }));
          const end = joints[joints.length - 1].p,
            z = end[2],
            tip = [end[0] + hoofDir[0] * 0.09, end[1] + hoofDir[1] * 0.09, z];
          add(
            unicornMats.obsidian,
            unicornTube(
              [
                { p: [end[0] - hoofDir[0] * 0.01, end[1] - hoofDir[1] * 0.01, z], r: 0.05 },
                { p: tip, r: 0.068, w: 0.072 },
              ],
              { perSpan: 1, sides: 10, hint: [0, 0, 1], cap: true },
            ),
          );
        };
        // Hind legs: thigh to stifle, a strong gaskin to the hock, cannon, fetlock, hoof planted.
        const hip = body(0.12, -0.05);
        for (const [z, stifle, hock, fetlock, pastern] of [
          [0.16, [-0.25, 0.68], [-0.5, 0.36], [-0.4, 0.1], [-0.37, 0.075]],
          [-0.16, [-0.18, 0.7], [-0.44, 0.38], [-0.26, 0.11], [-0.22, 0.08]],
        ]) {
          const hoof = [pastern[0] + 0.02, 0.0],
            dx = hoof[0] - pastern[0],
            dy = hoof[1] - pastern[1] - 0.005,
            dl = Math.hypot(dx, dy);
          leg(
            [
              { p: [hip[0], hip[1], z * 0.8], r: 0.17, w: 0.22 },
              { p: [hip[0] + 0.1, hip[1] - 0.18, z], r: 0.145, w: 0.19 },
              { p: [...stifle, z], r: 0.105, w: 0.125 },
              { p: [(stifle[0] + hock[0]) / 2 + 0.015, (stifle[1] + hock[1]) / 2, z], r: 0.08, w: 0.095 },
              { p: [...hock, z], r: 0.056, w: 0.08 },
              { p: [(hock[0] + fetlock[0]) / 2, (hock[1] + fetlock[1]) / 2, z], r: 0.041, w: 0.055 },
              { p: [...fetlock, z], r: 0.052, w: 0.062 },
              { p: [...pastern, z], r: 0.042, w: 0.046 },
            ],
            [dx / dl, dy / dl],
          );
        }
        // Forelegs folded: the one on the camera side raised high at the knee, the far one lower.
        const shoulder = body(0.8, -0.05),
          elbow = body(0.88, -0.3);
        for (const [z, knee, fold] of [
          [-0.17, [0.34, 0.22], [-0.08, -0.3]],
          [0.17, [0.25, -0.02], [-0.15, -0.27]],
        ]) {
          const k = offset(elbow, knee[0], knee[1]),
            f = offset(k, fold[0], fold[1]),
            pastern = offset(f, 0.04, -0.09);
          leg(
            [
              { p: [shoulder[0], shoulder[1], z * 0.75], r: 0.135, w: 0.175 },
              { p: [elbow[0], elbow[1], z], r: 0.105, w: 0.125 },
              { p: [(elbow[0] + k[0]) / 2, (elbow[1] + k[1]) / 2, z], r: 0.07, w: 0.088 },
              { p: [k[0], k[1], z], r: 0.06, w: 0.072 },
              { p: [(k[0] + f[0]) / 2, (k[1] + f[1]) / 2, z], r: 0.04, w: 0.052 },
              { p: [f[0], f[1], z], r: 0.05, w: 0.06 },
              { p: [pastern[0], pastern[1], z], r: 0.041, w: 0.045 },
            ],
            [0.35, -0.94],
          );
        }
        // Mane: a rolled crest along the top of the neck, and heavy waved
        // clumps off it, the way a bronze founder models hair: most falling
        // to her right (the camera side) and a few to the left, lying on the
        // neck and lifting clear only towards their curled tips, broad side
        // outward. A forelock.
        const crestAt = (s) => {
            const k = Math.min(3, Math.floor(s * 4)),
              f = s * 4 - k,
              c = neck[k].p,
              d = neck[k + 1].p,
              r = neck[k].r + (neck[k + 1].r - neck[k].r) * f;
            return {
              p: [c[0] + (d[0] - c[0]) * f - r * 0.78, c[1] + (d[1] - c[1]) * f + r * 0.22, c[2] + (d[2] - c[2]) * f],
              half: neck[k].w + (neck[k + 1].w - neck[k].w) * f,
            };
          },
          crestRoll = [];
        for (let i = 0; i <= 6; i++) {
          const s = i / 6;
          crestRoll.push({ p: crestAt(s * 0.97).p, r: 0.045 - s * 0.012, w: 0.07 - s * 0.02 });
        }
        add(unicornMats.mane, unicornTube(crestRoll, { perSpan: 2, sides: 8, hint: [-1, 0.3, 0] }));
        // Each clump is a ribbon whose broad side faces up and outward, so
        // the mane reads from the street camera above as well as in profile.
        const MANE_LOCKS = 19;
        for (let i = 0; i < MANE_LOCKS; i++) {
          const s = 0.02 + (i * 0.93) / (MANE_LOCKS - 1),
            { p: crest, half } = crestAt(s),
            side = i % 4 === 1 ? 1 : -1,
            // Streaming back and down, longer at the withers; neighbours
            // overlap, so the mane reads as one waved sheet with a scalloped edge.
            reach = 0.34 - s * 0.1 + 0.035 * Math.sin(i * 1.9),
            drop = 0.26 - s * 0.06 + 0.04 * Math.cos(i * 1.4),
            wave = 0.035 * Math.sin(i * 2.3 + 0.6),
            out = side * half;
          add(
            unicornMats.mane,
            unicornTube(
              [
                { p: offset(crest, 0.03, -0.01), r: 0.028, w: 0.075 },
                { p: offset(crest, -reach * 0.25, -drop * 0.22, out * 0.6), r: 0.03, w: 0.11 },
                { p: offset(crest, -reach * 0.55, -drop * 0.55 + wave, out + side * 0.03), r: 0.028, w: 0.12 },
                { p: offset(crest, -reach * 0.82, -drop * 0.85 - wave, out + side * 0.045), r: 0.022, w: 0.09 },
                { p: offset(crest, -reach, -drop, out + side * 0.04), r: 0.012, w: 0.04 },
                { p: offset(crest, -reach - 0.01, -drop - 0.03, out + side * 0.03), r: 0.004, w: 0.01 },
              ],
              { perSpan: 2, sides: 6, hint: [0.25, 0.75, side * 0.6] },
            ),
          );
        }
        for (const [z, lift] of [
          [-0.02, 0],
          [0.03, 0.03],
        ])
          add(
            unicornMats.mane,
            unicornTube(
              [
                { p: head(-0.02, 0.13, z), r: 0.024, w: 0.045 },
                { p: head(0.1, 0.17 + lift, z - 0.02), r: 0.022, w: 0.05 },
                { p: head(0.2, 0.15 + lift, z - 0.06), r: 0.014, w: 0.032 },
                { p: head(0.27, 0.11 + lift, z - 0.09), r: 0.003, w: 0.004 },
              ],
              { perSpan: 3, sides: 5, hint: headUp },
            ),
          );
        // Tail: a thick root off the croup, an S down to the plinth (the main
        // lock rests on it and flicks out behind), the other locks fanning and
        // curling apart towards their ends. Broad side outward.
        const dock = body(-0.02, 0.22),
          spine = [offset(dock, -0.15, 0.02), offset(dock, -0.3, -0.2), offset(dock, -0.32, -0.52), offset(dock, -0.22, -0.82), offset(dock, -0.14, -1.07)];
        const tailLocks = [
          { z: 0, spread: 0, end: 5, flick: [-0.34, -1.08, -0.04] },
          { z: 0.055, spread: -0.05, end: 4, flick: [-0.42, -0.84, 0.2] },
          { z: -0.055, spread: -0.04, end: 4, flick: [-0.36, -0.88, -0.2] },
          { z: 0.03, spread: -0.1, end: 3, flick: [-0.52, -0.54, 0.12] },
          { z: -0.035, spread: -0.08, end: 3, flick: [-0.5, -0.6, -0.14] },
          { z: -0.03, spread: 0.06, end: 4, flick: [-0.12, -1.0, -0.12] },
          { z: 0.04, spread: 0.05, end: 4, flick: [-0.1, -1.02, 0.14] },
        ];
        tailLocks.forEach((lock, i) => {
          const ctrl = [{ p: offset(dock, 0.03, 0.01), r: 0.075, w: 0.06 }];
          for (let k = 0; k < lock.end; k++) {
            const s = (k + 1) / 5,
              taper = 1 - s * 0.45;
            ctrl.push({ p: offset(spine[k], lock.spread * s * s, 0, lock.z * s * 1.6), r: (i ? 0.058 : 0.078) * taper, w: (i ? 0.046 : 0.058) * taper });
          }
          // The ends curl round, blunt, rather than tapering to a point.
          ctrl.push({ p: offset(dock, ...lock.flick), r: 0.018, w: 0.016 });
          ctrl.push({ p: offset(dock, lock.flick[0] - 0.04, lock.flick[1] + 0.05, lock.flick[2] * 1.1), r: 0.004, w: 0.004 });
          add(unicornMats.mane, unicornTube(ctrl, { perSpan: 2, sides: 6, hint: [0, 0, 1] }));
        });
        return hornTip;
      }
      // ---- The plinth, the plaque, the uplights and Aurora ---------------------------
      {
        const b = parkParts(),
          at = new Three.Matrix4().makeTranslation(UNICORN.x, 0, UNICORN.y),
          // An octagonal lathe with flat faces, one face towards the camera (south, +z).
          octagon = (profile) => {
            const geo = new Three.LatheGeometry(
              profile.map(([r, y]) => new Three.Vector2(r, y)),
              8,
              Math.PI / 8,
            ).toNonIndexed();
            geo.computeVertexNormals();
            return geo;
          },
          D = UNICORN_DIE,
          T = UNICORN_PLINTH_TOP;
        // Traced bottom up and outside in, so every face looks outward: the base
        // course with a chamfer, the die, the cornice, the top.
        b.add(
          unicornMats.granite,
          octagon([
            [UNICORN.r, 0],
            [UNICORN.r, 1.8],
            [UNICORN.r - 0.8, 2.5],
            [D + 0.5, 2.8],
            [D, 2.9],
            [D, 8.5],
            [D + 0.6, 8.7],
            [D + 1.4, 9.3],
            [D + 1.4, 9.8],
            [D + 0.8, T],
            [0, T],
          ]),
          at,
        );
        // A brass line inlaid under the cornice.
        b.add(parkMats.gold, octagon([[D + 0.04, 7.7], [D + 0.12, 7.85], [D + 0.04, 8.0]]), at);
        // The plaque on the die's camera face: engraved brass on a thin brass back.
        const apothem = D * Math.cos(Math.PI / 8);
        b.box(parkMats.gold, parkPlaced(UNICORN.x, UNICORN.y + apothem + 0.1, UNICORN_PLAQUE_Y, 15.2, 3.7, 0.2));
        const plaqueCanvas = document.createElement('canvas');
        plaqueCanvas.width = 512;
        plaqueCanvas.height = 116;
        {
          const g = plaqueCanvas.getContext('2d'),
            brass = g.createLinearGradient(0, 0, 512, 112);
          brass.addColorStop(0, '#8c6a32');
          brass.addColorStop(0.45, '#d9b56a');
          brass.addColorStop(0.55, '#e8c77e');
          brass.addColorStop(1, '#8a672f');
          g.fillStyle = brass;
          g.fillRect(0, 0, 512, 116);
          // Engraved: a dark cut with a bright lip below it.
          const engrave = (draw) => {
            g.save();
            g.translate(0, 1.5);
            g.fillStyle = g.strokeStyle = 'rgba(255,236,190,0.55)';
            draw();
            g.restore();
            g.fillStyle = g.strokeStyle = '#3a2810';
            draw();
          };
          engrave(() => {
            g.lineWidth = 2;
            g.strokeRect(10, 10, 492, 96);
          });
          engrave(() => {
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.font = '600 62px Georgia, "Times New Roman", serif';
            if ('letterSpacing' in g) g.letterSpacing = '18px';
            g.fillText('AURORA', 265, 62);
          });
        }
        const plaqueTexture = new Three.CanvasTexture(plaqueCanvas);
        plaqueTexture.colorSpace = Three.SRGBColorSpace;
        plaqueTexture.anisotropy = 4;
        const plaque = new Three.Mesh(
          new Three.PlaneGeometry(14.6, 3.3),
          new Three.MeshStandardMaterial({ map: plaqueTexture, roughness: 0.38, metalness: 0.3 }),
        );
        plaque.position.set(UNICORN.x, UNICORN_PLAQUE_Y, UNICORN.y + apothem + 0.22);
        plaque.userData.dynamic = true;
        plaque.name = 'unicorn plaque';
        parkRoot.add(plaque);
        // The uplights: granite rings set in the lawn, their lenses (bulbs) lit by night.
        UNICORN_LAMPS.forEach((a, i) => {
          const x = UNICORN.x + Math.cos(a) * UNICORN_LAMP_RADIUS,
            y = UNICORN.y + Math.sin(a) * UNICORN_LAMP_RADIUS;
          b.add(unicornMats.granite, new Three.CylinderGeometry(1.5, 1.8, 0.8, 10), new Three.Matrix4().makeTranslation(x, 0.4, y));
          unicornUniforms.unicornLights.value[i].set(x, 0.9, y);
          parkBulbs.add(x, y, 1.0, 3.4, '#fff1dc');
        });
        // Aurora herself, turned to her heading.
        const statueMatrix = new Three.Matrix4()
          .makeTranslation(UNICORN.x, T, UNICORN.y)
          .multiply(new Three.Matrix4().makeRotationY(-UNICORN.face))
          .multiply(new Three.Matrix4().makeScale(UNICORN_SCALE, UNICORN_SCALE, UNICORN_SCALE))
          .multiply(new Three.Matrix4().makeTranslation(UNICORN_SHIFT, 0, 0));
        const hornTip = unicornStatue(b, statueMatrix);
        b.flush(parkRoot, 'unicorn statue');
        unicornHornTip.set(...hornTip).applyMatrix4(statueMatrix);
        // A soft glow at the horn's tip after dark.
        parkBulbs.add(unicornHornTip.x, unicornHornTip.z, unicornHornTip.y, 7, '#ffe2a8');
      }
      function updateUnicornStatue(night) {
        // The uplights come up as the dusk goes: black by day, glints by night.
        unicornUniforms.unicornLightPower.value = night * night * 1.4;
        // The horn: a slow warm breath of light after dark.
        unicornMats.horn.emissiveIntensity = night * (0.55 + 0.2 * Math.sin(gameTime * 0.8));
      }
      // END SUBSYSTEM: src/unicorn3d.js
