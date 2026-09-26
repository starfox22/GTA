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
       * (themepark.js). Her body is a real horse: the three.js examples
       * horse (MIT; from "3 Dreams of Black", Apache 2.0), re-posed rearing
       * by tools/unicorn_model.py, which writes its 494-vertex cage and the
       * layout of her mane, tail and horn to assets/unicorn-horse.json
       * (ASSETS.unicorn, about 30 KB); here the cage is Loop-subdivided twice
       * into a smooth cast body, the locks are swept as flattened tubes and
       * the horn as a grooved spiral. At night four warm-white uplights in
       * the paving catch her gloss (a shader term, UPLIGHTS: glints more than
       * light on the black) and the horn glows softly. Everything is merged
       * per material: about 29.5k triangles in five draws, and the plaque.
       */
      const UNICORN = PIER.unicorn,
        // Her horn tip above the plinth (12 m: about four times life size); the plinth top (1.3 m).
        UNICORN_HEIGHT = 96,
        UNICORN_PLINTH_TOP = 10.4,
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
      /**
       * LOOP SUBDIVISION
       * One step of Loop's scheme on a closed triangle mesh (the same as
       * tools/unicorn_model.py): each edge gets a point (3/8 of its ends and
       * 1/8 of the two corners across it), each vertex moves towards its
       * neighbours (Warren's weights), each triangle becomes four. The old
       * vertices keep their indices; the edge points follow.
       */
      function unicornLoop(pos, tri) {
        const nv = pos.length / 3,
          nt = tri.length / 3,
          edgeOf = new Map(),
          ends = [],
          across = [],
          faceEdges = new Int32Array(nt * 3);
        for (let f = 0; f < nt; f++)
          for (let k = 0; k < 3; k++) {
            const a = tri[f * 3 + k],
              b = tri[f * 3 + ((k + 1) % 3)],
              c = tri[f * 3 + ((k + 2) % 3)],
              key = a < b ? a * nv + b : b * nv + a;
            let e = edgeOf.get(key);
            if (e === undefined) {
              e = ends.length / 2;
              edgeOf.set(key, e);
              ends.push(a, b);
              across.push(0, 0, 0);
            }
            for (let j = 0; j < 3; j++) across[e * 3 + j] += pos[c * 3 + j];
            faceEdges[f * 3 + k] = e;
          }
        const ne = ends.length / 2,
          out = new Float32Array((nv + ne) * 3),
          around = new Float64Array(nv * 3),
          valence = new Uint16Array(nv);
        for (let e = 0; e < ne; e++) {
          const a = ends[e * 2],
            b = ends[e * 2 + 1];
          valence[a]++;
          valence[b]++;
          for (let j = 0; j < 3; j++) {
            around[a * 3 + j] += pos[b * 3 + j];
            around[b * 3 + j] += pos[a * 3 + j];
            out[(nv + e) * 3 + j] = 0.375 * (pos[a * 3 + j] + pos[b * 3 + j]) + 0.125 * across[e * 3 + j];
          }
        }
        for (let v = 0; v < nv; v++) {
          const n = valence[v],
            beta = n === 3 ? 3 / 16 : 3 / (8 * n);
          for (let j = 0; j < 3; j++) out[v * 3 + j] = pos[v * 3 + j] * (1 - n * beta) + around[v * 3 + j] * beta;
        }
        const faces = new Uint32Array(nt * 12);
        for (let f = 0; f < nt; f++) {
          const a = tri[f * 3],
            b = tri[f * 3 + 1],
            c = tri[f * 3 + 2],
            ab = nv + faceEdges[f * 3],
            bc = nv + faceEdges[f * 3 + 1],
            ca = nv + faceEdges[f * 3 + 2];
          faces.set([a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca], f * 12);
        }
        return [out, faces];
      }
      /* The sculpt (assets/unicorn-horse.json, written by tools/unicorn_model.py
         from the three.js examples horse): millimetres, life size, x forward,
         y up, -z the side she turns to and shows the street camera. */
      function unicornSculptData() {
        const url = ASSETS.unicorn;
        return JSON.parse(atob(url.slice(url.indexOf(',') + 1)));
      }
      /* Aurora in life-size metres. She rears in a levade on her gathered hind
         legs, the body pitched up, forelegs folded high, the neck arched and
         the head turned towards the camera, the horn thrust forward and up;
         the mane streams back off the crest in the wind, most of it to the
         camera side, and the tail falls in an S to the plinth (the
         sculptor's third point of support) and fans out there. The body is
         the posed horse's cage, Loop-subdivided twice (about 15.7k
         triangles, smooth as cast bronze); the locks are flattened
         Catmull-Rom tubes; the horn a two-start spiral. */
      function unicornStatue(parts, matrix, data) {
        const add = (material, geo) => parts.add(material, geo, matrix),
          metres = (a) => a.map((v) => v / 1000),
          centre = metres(data.centre);
        // The rock under her hooves and the tail's rest, carved from the plinth's granite.
        {
          const rock = new Three.SphereGeometry(1, 22, 9),
            p = rock.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const x = p.getX(i),
              y = p.getY(i),
              z = p.getZ(i),
              bump = 1 + 0.16 * Math.sin(x * 5.1 + z * 3.3) * Math.cos(z * 4.7 - x * 2.1) + 0.08 * Math.sin(x * 11 + y * 7) * Math.cos(z * 9 - y * 5) + 0.05 * Math.abs(Math.sin(x * 17 + z * 13));
            p.setXYZ(i, x * bump, Math.max(-0.2, y) * bump, z * bump);
          }
          rock.computeVertexNormals();
          rock.scale(0.62, 0.075, 0.5);
          rock.translate(centre[0] + 0.02, -0.012, centre[2]);
          add(unicornMats.granite, rock);
        }
        // The body: the cage, subdivided twice.
        let pos = new Float32Array(metres(data.vertices)),
          tri = data.triangles;
        for (let i = 0; i < 2; i++) [pos, tri] = unicornLoop(pos, tri);
        const body = new Three.BufferGeometry();
        body.setAttribute('position', new Three.BufferAttribute(pos, 3));
        body.setIndex(new Three.BufferAttribute(tri, 1));
        body.computeVertexNormals();
        add(unicornMats.obsidian, body);
        // The mane, forelock and tail, and the hooves: rings [x, y, z, r, w] in millimetres.
        const rings = (lock) => {
          const ctrl = [];
          for (let i = 0; i < lock.rings.length; i += 5) {
            const [x, y, z, r, w] = metres(lock.rings.slice(i, i + 5));
            ctrl.push({ p: [x, y, z], r, w });
          }
          return ctrl;
        };
        for (const lock of [...data.mane, ...data.tail]) add(unicornMats.mane, unicornTube(rings(lock), { perSpan: 2, sides: 6, hint: lock.hint }));
        for (const hoof of data.hooves) add(unicornMats.obsidian, unicornTube(rings(hoof), { perSpan: 1, sides: 12, hint: hoof.hint, cap: true }));
        // The horn: polished gold, a slight flare at its root, two spiral
        // grooves running five turns to the tip.
        const horn = data.horn,
          base = metres(horn.base),
          length = horn.length / 1000,
          radius = horn.radius / 1000,
          ctrl = [];
        for (let i = 0; i <= 8; i++) {
          const s = i / 8;
          ctrl.push({ p: base.map((b, j) => b + horn.dir[j] * length * s), r: radius * (Math.pow(1 - s, 0.85) + (s < 0.13 ? 0.12 * (1 - s / 0.13) : 0)) + 0.0015 });
        }
        add(unicornMats.horn, unicornTube(ctrl, { perSpan: 8, sides: 16, hint: horn.side, groove: (angle, s) => 1 - 0.15 * Math.pow(0.5 + 0.5 * Math.cos(angle * 2 - s * TAU * 5), 2), cap: true }));
        return metres(horn.tip);
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
        // Aurora herself, turned to her heading, scaled so her horn tip stands
        // UNICORN_HEIGHT above the plinth, her support centred on it.
        const sculpt = unicornSculptData(),
          scale = UNICORN_HEIGHT / (sculpt.horn.tip[1] / 1000),
          statueMatrix = new Three.Matrix4()
            .makeTranslation(UNICORN.x, T, UNICORN.y)
            .multiply(new Three.Matrix4().makeRotationY(-UNICORN.face))
            .multiply(new Three.Matrix4().makeScale(scale, scale, scale))
            .multiply(new Three.Matrix4().makeTranslation(-sculpt.centre[0] / 1000, 0, -sculpt.centre[2] / 1000));
        const hornTip = unicornStatue(b, statueMatrix, sculpt);
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
