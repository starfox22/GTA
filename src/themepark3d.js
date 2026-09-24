      // BEGIN SUBSYSTEM: src/themepark3d.js — Sunset Pier resort meshes
      /**
       * Sunset Pier resort meshes
       * Source: src/themepark3d.js
       * Scope: createCityRenderer() closure.
       * The Falcon (swept rails and spine, supports, station, the train and its
       * riders), the Sunset Eye (legs, hub, cable spokes, rim, 48 level capsules,
       * LED shows), the Fountain Lagoon and its jets, the Sunset Palace hotel,
       * the beach club, the family rides, the log flume, the dark ride, bumper
       * cars, the gate, kiosks, palms and lamps; night light (bulbs, a light-pool
       * overlay on the ground), fireworks, and the ride cameras.
       *
       * Static scenery is merged here into one mesh per material (parkParts),
       * so the whole island is a few dozen draw calls; what moves (the train, the
       * wheel, the rides, jets, sparks) is instanced or grouped per ride. Motion
       * is read from themepark.js so what is drawn is what the game simulates.
       */
      const parkRoot = new Three.Group();
      parkRoot.name = 'sunset pier';
      scene.add(parkRoot);
      statics.push({ x: 3050, y: -6380, group: parkRoot, radius: 1500 });
      const parkP3 = (x, y, z = 0) => new Three.Vector3(x, z, y);
      // ---- Materials (shared; night levels are set in updateParkVisuals) --------------
      const parkMats = {
        white: mat('#f1eee6', 0.42, 0.25),
        steel: mat('#c9ccd0', 0.28, 0.9),
        gold: mat('#d8aa48', 0.3, 0.9),
        darkSteel: mat('#3a4047', 0.5, 0.7),
        concrete: mat('#b9b2a4', 0.9),
        sand: mat('#e6d6b2', 0.85),
        stone: mat('#d9c7a2', 0.8),
        terracotta: mat('#b8664a', 0.75),
        turquoise: mat('#2c9fa3', 0.4, 0.2),
        red: mat('#b8323a', 0.55),
        cream: mat('#f3e8d0', 0.7),
        seat: mat('#23262b', 0.6),
        wood: mat('#8a6440', 0.8),
        canvasRed: mat('#c9463d', 0.85),
        canvasWhite: mat('#f4efe6', 0.85),
        glass: new Three.MeshStandardMaterial({ color: '#5f8fae', roughness: 0.06, metalness: 0.9, emissive: '#ffd9a0', emissiveIntensity: 0 }),
        glassDark: new Three.MeshStandardMaterial({ color: '#1f3346', roughness: 0.08, metalness: 0.85 }),
        water: new Three.MeshStandardMaterial({ color: '#1f6f7c', roughness: 0.05, metalness: 0.35 }),
        pool: new Three.MeshStandardMaterial({ color: '#39b8c9', roughness: 0.08, metalness: 0.15 }),
        lampHead: new Three.MeshStandardMaterial({ color: '#fff1d0', emissive: '#ffd79a', emissiveIntensity: 0, roughness: 0.5 }),
        skin: mat('#c79a7a', 0.7),
      };
      /**
       * PARTS BUILDER
       * Geometry is added with a matrix and merged into one BufferGeometry per
       * material when flushed; the result is added to `parent`. This is what keeps
       * several thousand track ties, supports and fittings to a handful of draws.
       */
      function parkParts() {
        const byMaterial = new Map(),
          v = new Three.Vector3(),
          nm = new Three.Matrix3();
        return {
          add(material, geo, matrix) {
            if (!byMaterial.has(material)) byMaterial.set(material, []);
            byMaterial.get(material).push({ geo, matrix: matrix.clone() });
          },
          box(material, matrix) {
            this.add(material, boxGeo, matrix);
          },
          flush(parent, name) {
            const meshes = [];
            for (const [material, parts] of byMaterial) {
              let vertices = 0,
                indices = 0;
              for (const { geo } of parts) {
                vertices += geo.attributes.position.count;
                indices += geo.index ? geo.index.count : geo.attributes.position.count;
              }
              const pos = new Float32Array(vertices * 3),
                nor = new Float32Array(vertices * 3),
                uvs = new Float32Array(vertices * 2),
                idx = new Uint32Array(indices);
              let vo = 0,
                io = 0;
              for (const { geo, matrix } of parts) {
                const p = geo.attributes.position,
                  n = geo.attributes.normal,
                  uv = geo.attributes.uv;
                nm.getNormalMatrix(matrix);
                for (let i = 0; i < p.count; i++) {
                  v.fromBufferAttribute(p, i).applyMatrix4(matrix);
                  pos.set([v.x, v.y, v.z], (vo + i) * 3);
                  if (n) v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
                  else v.set(0, 1, 0);
                  nor.set([v.x, v.y, v.z], (vo + i) * 3);
                  if (uv) uvs.set([uv.getX(i), uv.getY(i)], (vo + i) * 2);
                }
                if (geo.index) for (let i = 0; i < geo.index.count; i++) idx[io++] = geo.index.getX(i) + vo;
                else for (let i = 0; i < p.count; i++) idx[io++] = vo + i;
                vo += p.count;
              }
              const merged = new Three.BufferGeometry();
              merged.setAttribute('position', new Three.BufferAttribute(pos, 3));
              merged.setAttribute('normal', new Three.BufferAttribute(nor, 3));
              merged.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
              merged.setIndex(new Three.BufferAttribute(idx, 1));
              merged.computeBoundingSphere();
              const m = new Three.Mesh(merged, material);
              m.castShadow = m.receiveShadow = true;
              m.name = name;
              m.userData.dynamic = true;
              parent.add(m);
              meshes.push(m);
            }
            byMaterial.clear();
            return meshes;
          },
        };
      }
      const pm = new Three.Matrix4(),
        pq = new Three.Quaternion(),
        parkV = new Three.Vector3(),
        ps = new Three.Vector3(),
        parkUpAxis = new Three.Vector3(0, 1, 0);
      // Matrix for a unit primitive: at (x, height, y), scaled, turned `yaw` about the vertical.
      function parkPlaced(x, y, z, sx, sy, sz, yaw = 0) {
        pq.setFromAxisAngle(parkUpAxis, -yaw);
        return pm.compose(parkV.set(x, z, y), pq, ps.set(sx, sy, sz));
      }
      // Matrix for a unit cylinder (height along +y) running from a to b (three coords).
      function parkBetween(a, b, r) {
        const d = parkV.subVectors(b, a),
          len = d.length();
        pq.setFromUnitVectors(parkUpAxis, d.normalize());
        return pm.compose(ps.addVectors(a, b).multiplyScalar(0.5), pq, new Three.Vector3(r, len, r));
      }
      const parkTubeGeo = new Three.CylinderGeometry(1, 1, 1, 10, 1, true),
        parkThinGeo = new Three.CylinderGeometry(1, 1, 1, 6, 1, true),
        parkDomeGeo = new Three.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI / 2),
        parkConeGeo = new Three.ConeGeometry(1, 1, 16);
      /* A tube swept through a list of frames {p, a, b} (three coords), `sides` round. */
      function parkSweptTube(frames, radius, sides, closed) {
        const n = frames.length,
          pos = new Float32Array(n * sides * 3),
          nor = new Float32Array(n * sides * 3),
          uv = new Float32Array(n * sides * 2),
          idx = [];
        for (let i = 0; i < n; i++) {
          const { p, a, b } = frames[i];
          for (let k = 0; k < sides; k++) {
            const t = (k / sides) * TAU,
              c = Math.cos(t),
              s = Math.sin(t),
              nx = a.x * c + b.x * s,
              ny = a.y * c + b.y * s,
              nz = a.z * c + b.z * s,
              o = (i * sides + k) * 3;
            pos[o] = p.x + nx * radius;
            pos[o + 1] = p.y + ny * radius;
            pos[o + 2] = p.z + nz * radius;
            nor[o] = nx;
            nor[o + 1] = ny;
            nor[o + 2] = nz;
            uv[(i * sides + k) * 2] = i / 8;
            uv[(i * sides + k) * 2 + 1] = k / sides;
          }
        }
        const rings = closed ? n : n - 1;
        for (let i = 0; i < rings; i++) {
          const j = (i + 1) % n;
          for (let k = 0; k < sides; k++) {
            const k2 = (k + 1) % sides,
              a = i * sides + k,
              b = i * sides + k2,
              c = j * sides + k,
              d = j * sides + k2;
            idx.push(a, c, b, b, c, d);
          }
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new Three.BufferAttribute(nor, 3));
        geo.setAttribute('uv', new Three.BufferAttribute(uv, 2));
        geo.setIndex(idx);
        geo.computeBoundingSphere();
        return geo;
      }
      /**
       * GLOW POINTS
       * Bulbs, LED pixels, sparks and fireworks: additive round sprites sized in
       * world units under either camera (orthographic street view or the
       * perspective flight/ride view), in HDR so the bright ones bloom. One draw
       * per set. `intensity` scales the whole set (the night level).
       */
      const parkGlowViewport = new Three.Vector2();
      function parkGlowMaterial() {
        return new Three.ShaderMaterial({
          uniforms: { uHalfHeight: { value: 400 }, uIntensity: { value: 1 }, uTime: { value: 0 } },
          vertexShader: `
            attribute float size;
            attribute vec3 color;
            attribute float phase;
            uniform float uHalfHeight, uTime;
            varying vec3 vColor;
            void main() {
              vec4 mv = modelViewMatrix * vec4( position, 1.0 );
              gl_Position = projectionMatrix * mv;
              float perspective = projectionMatrix[ 3 ][ 3 ] > 0.5 ? 1.0 : max( 1.0, -mv.z );
              gl_PointSize = clamp( size * projectionMatrix[ 1 ][ 1 ] * uHalfHeight / perspective, 1.5, 96.0 );
              // phase > 0: a twinkle; < 0 stays steady.
              float tw = phase > 0.0 ? 0.65 + 0.35 * sin( uTime * 3.0 + phase * 40.0 ) : 1.0;
              vColor = color * tw;
            }`,
          fragmentShader: `
            varying vec3 vColor;
            uniform float uIntensity;
            void main() {
              vec2 d = gl_PointCoord - 0.5;
              float r = length( d ) * 2.0;
              float core = smoothstep( 1.0, 0.0, r );
              float glow = core * core * ( 0.35 + 0.65 * smoothstep( 0.45, 0.0, r ) );
              gl_FragColor = vec4( vColor * glow * uIntensity, 1.0 );
            }`,
          transparent: true,
          depthWrite: false,
          blending: Three.AdditiveBlending,
        });
      }
      const parkGlowSets = [];
      function parkGlowPoints(capacity, name, parent = parkRoot) {
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(Three.DynamicDrawUsage));
        geo.setAttribute('color', new Three.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(Three.DynamicDrawUsage));
        geo.setAttribute('size', new Three.BufferAttribute(new Float32Array(capacity), 1).setUsage(Three.DynamicDrawUsage));
        geo.setAttribute('phase', new Three.BufferAttribute(new Float32Array(capacity), 1));
        geo.setDrawRange(0, 0);
        const points = new Three.Points(geo, parkGlowMaterial());
        points.frustumCulled = false;
        points.userData.dynamic = true;
        points.name = name;
        points.renderOrder = 5;
        const set = {
          points,
          count: 0,
          capacity,
          add(x, y, z, size, color, phase = -1) {
            if (this.count >= capacity) return -1;
            const i = this.count++,
              c = new Three.Color(color);
            geo.attributes.position.setXYZ(i, x, z, y);
            geo.attributes.color.setXYZ(i, c.r, c.g, c.b);
            geo.attributes.size.setX(i, size);
            geo.attributes.phase.setX(i, phase);
            geo.setDrawRange(0, this.count);
            return i;
          },
          done() {
            for (const k of ['position', 'color', 'size', 'phase']) geo.attributes[k].needsUpdate = true;
            geo.computeBoundingSphere();
          },
        };
        parent.add(points);
        parkGlowSets.push(set);
        return set;
      }
      // Static bulbs (festoons, lamp heads, ride lights): lit by night only.
      const parkBulbs = parkGlowPoints(6000, 'park bulbs'),
        parkLampSpots = [];
      // ---- The Falcon: track ---------------------------------------------------------
      const coasterGroup = new Three.Group();
      coasterGroup.name = 'falcon';
      parkRoot.add(coasterGroup);
      const coasterLeds = [],
        COASTER_GAUGE = 3.2,
        SPINE_DROP = 3.8;
      /* Three-space frame of the circuit at arc length s: position, tangent, up, side. */
      const cf = {};
      function coasterFrame3(s, out) {
        coasterFrame(s, cf);
        out.p.set(cf.x, cf.z, cf.y);
        out.t.set(cf.tx, cf.tz, cf.ty).normalize();
        out.u.set(cf.ux, cf.uz, cf.uy);
        out.u.addScaledVector(out.t, -out.u.dot(out.t)).normalize();
        out.s.crossVectors(out.t, out.u).normalize();
        out.kind = cf.kind;
        return out;
      }
      const parkNewFrame3 = () => ({ p: new Three.Vector3(), t: new Three.Vector3(), u: new Three.Vector3(), s: new Three.Vector3() });
      {
        const T = coasterCircuit(),
          n = T.count,
          frames = [];
        for (let i = 0; i < n; i++) frames.push(coasterFrame3(i * T.ds, parkNewFrame3()));
        const offsetFrames = (du, ds) =>
          frames.map((f) => ({
            p: f.p.clone().addScaledVector(f.u, du).addScaledVector(f.s, ds),
            a: f.u,
            b: f.s,
          }));
        const track = parkParts(),
          ident = new Three.Matrix4();
        // Running rails and the box spine under them, swept along the circuit.
        track.add(parkMats.steel, parkSweptTube(offsetFrames(0, COASTER_GAUGE), 0.62, 8, true), ident);
        track.add(parkMats.steel, parkSweptTube(offsetFrames(0, -COASTER_GAUGE), 0.62, 8, true), ident);
        track.add(parkMats.gold, parkSweptTube(offsetFrames(-SPINE_DROP, 0), 1.9, 12, true), ident);
        // Ties every 4 units: a flat bar under both rails and a V down to the spine.
        const basis = new Three.Matrix4(),
          a = new Three.Vector3(),
          b = new Three.Vector3();
        for (let i = 0; i < n; i += 2) {
          const f = frames[i];
          basis.makeBasis(f.t, f.u, f.s).scale(ps.set(0.9, 0.7, COASTER_GAUGE * 2 + 1.6)).setPosition(parkV.copy(f.p).addScaledVector(f.u, -0.9));
          track.box(parkMats.gold, basis);
          if (i % 4) continue;
          for (const side of [-1, 1]) {
            a.copy(f.p).addScaledVector(f.s, side * COASTER_GAUGE).addScaledVector(f.u, -1);
            b.copy(f.p).addScaledVector(f.u, -SPINE_DROP);
            track.add(parkMats.gold, parkThinGeo, parkBetween(a, b, 0.45));
          }
        }
        // Lift hill: chain and catwalk with a handrail beside the track.
        for (let i = 0; i < n; i += 3) {
          const f = frames[i];
          if (T.kind[i] !== 2 || f.p.y < 26) continue;
          basis.makeBasis(f.t, f.u, f.s).scale(ps.set(6.2, 0.4, 4)).setPosition(parkV.copy(f.p).addScaledVector(f.u, -1.2).addScaledVector(f.s, -6.2));
          track.box(parkMats.darkSteel, basis);
          if (i % 6 === 0) {
            a.copy(f.p).addScaledVector(f.s, -8.2);
            b.copy(a).addScaledVector(f.u, 4);
            track.add(parkMats.darkSteel, parkThinGeo, parkBetween(a, b, 0.25));
          }
        }
        // Supports: white columns on concrete footings; banked and inverted track is
        // held from the side by a column and an arm to the spine.
        for (const f of coasterFootings()) {
          const top = f.attach;
          a.set(f.x, 0, f.y);
          b.set(f.x, f.top, f.y);
          const r = 1.5 + Math.min(2.2, f.top * 0.008);
          track.add(parkMats.white, parkTubeGeo, parkBetween(a, b, r));
          track.box(parkMats.concrete, parkPlaced(f.x, f.y, 1.5, r * 3.4, 3, r * 3.4));
          if (f.side) {
            b.set(f.x, f.top, f.y);
            a.set(top.x, top.z, top.y);
            track.add(parkMats.white, parkTubeGeo, parkBetween(b, a, r * 0.8));
          }
          // Tall columns get a second, raking leg for stiffness.
          if (f.top > 130) {
            const d = Math.atan2(f.dy, f.dx) + Math.PI / 2,
              reach = f.top * 0.22;
            a.set(f.x + Math.cos(d) * reach, 0, f.y + Math.sin(d) * reach);
            b.set(f.x, f.top * 0.7, f.y);
            track.add(parkMats.white, parkTubeGeo, parkBetween(a, b, r * 0.7));
            track.box(parkMats.concrete, parkPlaced(a.x, a.z, 1.5, r * 3, 3, r * 3));
          }
        }
        track.flush(coasterGroup, 'falcon track');
        // Night: a string of LEDs along both sides of the spine.
        for (let i = 0; i < n; i += 3) {
          const f = frames[i];
          for (const side of [-1, 1]) {
            const p = f.p.clone().addScaledVector(f.u, -SPINE_DROP).addScaledVector(f.s, side * 2.1);
            coasterLeds.push(parkBulbs.add(p.x, p.z, p.y, 2.2, '#ffc46b'));
          }
        }
      }
      // ---- The Falcon: station and queue hall ----------------------------------------
      {
        const b = parkParts(),
          st = PIER.station,
          x0 = st.x - 70,
          x1 = st.x + 80;
        // Base under the track and the raised boarding platform on its south side.
        b.box(parkMats.concrete, parkPlaced((x0 + x1) / 2, -6450, 9, x1 - x0, 18, 20));
        b.box(parkMats.stone, parkPlaced((x0 + x1) / 2, -6412, 10, x1 - x0, 20, 12));
        b.box(parkMats.cream, parkPlaced((x0 + x1) / 2, -6405, 21, x1 - x0, 2, 26));
        // Wing-shaped roof: gold panels rising to a peak over the track.
        for (let i = 0; i < 8; i++) {
          const x = x0 + 8 + i * ((x1 - x0 - 16) / 7);
          for (const [z, dz] of [
            [-6452, -1],
            [-6408, 1],
          ]) {
            b.add(parkMats.white, parkTubeGeo, parkBetween(parkP3(x, z, 0), parkP3(x, z, 50), 1.4));
            b.add(parkMats.white, parkTubeGeo, parkBetween(parkP3(x, z, 50), parkP3(x, -6430, 60), 1));
          }
        }
        for (const [z0, z1] of [
          [-6460, -6430],
          [-6400, -6430],
        ]) {
          const panel = new Three.PlaneGeometry(1, 1);
          const m = new Three.Matrix4(),
            dirY = z1 - z0;
          // A sloped panel from the eave (50) to the ridge (62).
          const len = Math.hypot(dirY, 12),
            tilt = Math.atan2(12, Math.abs(dirY));
          m.compose(
            parkP3((x0 + x1) / 2, (z0 + z1) / 2, 56),
            new Three.Quaternion().setFromEuler(new Three.Euler(dirY > 0 ? -Math.PI / 2 + tilt : -Math.PI / 2 - tilt, 0, 0)),
            new Three.Vector3(x1 - x0 + 10, len, 1),
          );
          b.add(parkMats.gold, panel, m);
          m.compose(
            parkP3((x0 + x1) / 2, (z0 + z1) / 2, 55.6),
            new Three.Quaternion().setFromEuler(new Three.Euler(dirY > 0 ? Math.PI / 2 + tilt : Math.PI / 2 - tilt, 0, 0)),
            new Three.Vector3(x1 - x0 + 10, len, 1),
          );
          b.add(parkMats.white, panel, m);
        }
        // Queue hall: a shade canopy on posts over the switchback rails.
        b.box(parkMats.canvasWhite, parkPlaced(2600, -6375, 30, 200, 1.2, 50));
        for (let x = 2505; x <= 2695; x += 38)
          for (const y of [-6398, -6352]) b.add(parkMats.gold, parkTubeGeo, parkBetween(parkP3(x, y, 0), parkP3(x, y, 30), 0.8));
        for (const [y, x0q, x1q] of [
          [-6388, 2505, 2640],
          [-6373, 2520, 2690],
          [-6358, 2505, 2690],
        ]) {
          b.add(parkMats.steel, parkThinGeo, parkBetween(parkP3(x0q, y, 4), parkP3(x1q, y, 4), 0.35));
          for (let x = x0q; x <= x1q; x += 15) b.add(parkMats.steel, parkThinGeo, parkBetween(parkP3(x, y, 0), parkP3(x, y, 4), 0.3));
        }
        b.flush(coasterGroup, 'falcon station');
        for (let i = 0; i < 12; i++) parkBulbs.add(x0 + 6 + i * 13, -6400, 49, 3, i % 2 ? '#ffd79a' : '#ffb35c');
        const s = sign('THE FALCON', st.x, -6397, 80, '#f3cf7a');
        s.position.y = 40;
        s.userData.backing.position.y = 40;
      }
      // ---- The Falcon: train -----------------------------------------------------------
      /* One car: gold and white shell, four seats with lap bars, bogies on the rails.
         +x is forward, +y up, z across; the front car wears the falcon's head. */
      function coasterCar(front) {
        const g = new Three.Group(),
          b = parkParts();
        b.box(parkMats.darkSteel, parkPlaced(0, 0, 1.7, 11, 1.2, 5.6));
        // The tub: tapered white sides and a gold belt.
        b.box(parkMats.white, parkPlaced(0, 0, 3.6, 11.6, 3, 6.8));
        b.box(parkMats.gold, parkPlaced(0, 0, 5.1, 11.8, 0.5, 7));
        for (const row of [-2.6, 2.4]) {
          b.box(parkMats.seat, parkPlaced(row - 1.6, 0, 6.6, 1, 4.2, 6));
          b.box(parkMats.seat, parkPlaced(row, 0, 5.2, 2.8, 0.6, 6));
          // Over-the-shoulder restraints in gold.
          for (const z of [-1.5, 1.5]) b.box(parkMats.gold, parkPlaced(row - 0.4, z, 7.4, 0.8, 2.6, 1));
        }
        for (const x of [-4, 4])
          for (const z of [-COASTER_GAUGE, COASTER_GAUGE]) {
            const m = parkPlaced(x, z, 0.5, 1.3, 1.6, 1.3);
            m.multiply(new Three.Matrix4().makeRotationX(Math.PI / 2));
            b.add(parkMats.darkSteel, wheelGeo, m);
          }
        if (front) {
          // The falcon: a swept nose cone, a hooked gold beak and dark eyes.
          const nose = parkPlaced(7.4, 0, 4, 3.4, 5, 3.4);
          nose.multiply(new Three.Matrix4().makeRotationZ(-Math.PI / 2));
          b.add(parkMats.white, parkConeGeo, nose);
          const beak = parkPlaced(10.4, 0, 3.4, 1.2, 2.4, 1.2);
          beak.multiply(new Three.Matrix4().makeRotationZ(-Math.PI / 2 - 0.5));
          b.add(parkMats.gold, parkConeGeo, beak);
          for (const z of [-1.6, 1.6]) b.box(parkMats.seat, parkPlaced(8, z, 5.2, 1.4, 0.8, 0.5));
          b.box(parkMats.gold, parkPlaced(6, 0, 7.4, 1.2, 3, 7.2));
        }
        b.flush(g, front ? 'falcon car (front)' : 'falcon car');
        g.userData.dynamic = true;
        g.matrixAutoUpdate = false;
        coasterGroup.add(g);
        return g;
      }
      const coasterCarModels = Array.from({ length: COASTER_CARS }, (_, i) => coasterCar(i === 0));
      // Riders: instanced torsos (with raised arms) and heads, four to a car.
      const riderBodyGeo = (() => {
        const b = parkParts();
        b.box(parkMats.white, parkPlaced(0, 0, 1.6, 1.4, 3.2, 2));
        for (const z of [-1.2, 1.2]) b.add(parkMats.white, parkThinGeo, parkBetween(parkP3(0, z, 2.8), parkP3(0.5, z * 1.6, 6.2), 0.4));
        const m = b.flush(new Three.Group(), 'rider')[0];
        return m.geometry;
      })();
      const RIDERS = COASTER_CARS * 4,
        riderBodies = new Three.InstancedMesh(riderBodyGeo, new Three.MeshStandardMaterial({ roughness: 0.8 }), RIDERS),
        riderHeads = new Three.InstancedMesh(sphereGeo, parkMats.skin, RIDERS);
      for (const m of [riderBodies, riderHeads]) {
        m.frustumCulled = false;
        m.castShadow = true;
        m.userData.dynamic = true;
        coasterGroup.add(m);
      }
      {
        const c = new Three.Color(),
          shirts = ['#d8453c', '#2f6db3', '#f2d25a', '#ffffff', '#2d9a6a', '#e07b39', '#8b4fc2', '#222831'];
        for (let i = 0; i < RIDERS; i++) riderBodies.setColorAt(i, c.set(shirts[(i * 5) % shirts.length]));
      }
      const trainFrame = parkNewFrame3(),
        carMatrix = new Three.Matrix4(),
        riderMatrix = new Three.Matrix4(),
        riderLocal = new Three.Matrix4();
      function updateCoasterTrain(visible) {
        let r = 0;
        const riders = coasterTrain.riders;
        for (let i = 0; i < COASTER_CARS; i++) {
          const car = coasterCarModels[i];
          car.visible = visible;
          if (!visible) continue;
          coasterFrame3(coasterTrain.t - i * COASTER_CAR_GAP, trainFrame);
          carMatrix.makeBasis(trainFrame.t, trainFrame.u, trainFrame.s).setPosition(trainFrame.p);
          car.matrix.copy(carMatrix);
          car.matrixWorldNeedsUpdate = true;
          for (const [dx, dz] of [
            [-2.6, -1.5],
            [-2.6, 1.5],
            [2.4, -1.5],
            [2.4, 1.5],
          ]) {
            const seated = r < riders && !(i === 0 && dx > 0 && dz < 0 && player.coaster?.kind === 'train' && player.coaster.view === 1);
            riderLocal.makeTranslation(dx - 0.4, 5.2, dz);
            riderMatrix.multiplyMatrices(carMatrix, riderLocal);
            if (!seated) riderMatrix.scale(ps.set(0.001, 0.001, 0.001));
            riderBodies.setMatrixAt(r, riderMatrix);
            riderLocal.makeTranslation(dx - 0.4, 9.1, dz).scale(ps.set(1.05, 1.2, 1.05));
            riderMatrix.multiplyMatrices(carMatrix, riderLocal);
            if (!seated) riderMatrix.scale(ps.set(0.001, 0.001, 0.001));
            riderHeads.setMatrixAt(r, riderMatrix);
            r++;
          }
        }
        riderBodies.visible = riderHeads.visible = visible;
        riderBodies.instanceMatrix.needsUpdate = true;
        riderHeads.instanceMatrix.needsUpdate = true;
      }
      // ---- The Sunset Eye ------------------------------------------------------------
      /**
       * Twin A-frame legs carry a long spindle; the rim (two rings joined by a
       * lattice) hangs from it on cable spokes that fan out to both ends of the
       * spindle, so the wheel reads as a lens edge-on. 48 glass capsules ride on
       * the outside of the rim and stay level. At night LEDs on the rim and down
       * every spoke run colour shows.
       */
      const EYE = PIER.wheel,
        eyeGroup = new Three.Group(),
        eyeLedCount = { rim: 0 };
      eyeGroup.name = 'sunset eye';
      eyeGroup.position.set(EYE.x, EYE.hub, EYE.y);
      eyeGroup.userData.dynamic = true;
      parkRoot.add(eyeGroup);
      const eyeLeds = parkGlowPoints(3200, 'eye leds', eyeGroup),
        eyeLedAngle = [];
      {
        const R = EYE.r,
          b = parkParts(),
          ring = new Three.TorusGeometry(R, 2.4, 8, 240),
          outer = new Three.TorusGeometry(R + 10, 1.6, 6, 240),
          ident = new Three.Matrix4();
        for (const z of [-11, 11]) b.add(parkMats.white, ring, ident.clone().makeTranslation(0, 0, z));
        b.add(parkMats.steel, outer, ident);
        const at = (a, r, z) => new Three.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
        // Rim lattice: struts across and diagonals between the two rings.
        for (let k = 0; k < 96; k++) {
          const a = (k / 96) * TAU,
            a2 = ((k + 1) / 96) * TAU;
          b.add(parkMats.white, parkThinGeo, parkBetween(at(a, R, -11), at(a, R, 11), 0.9));
          b.add(parkMats.white, parkThinGeo, parkBetween(at(a, R, -11), at(a2, R, 11), 0.6));
          b.add(parkMats.steel, parkThinGeo, parkBetween(at(a, R, 0), at(a, R + 10, 0), 0.7));
        }
        // Cable spokes to the spindle ends: 32 a side, crossing like a bicycle wheel.
        for (let k = 0; k < 32; k++) {
          const a = (k / 32) * TAU;
          b.add(parkMats.steel, parkThinGeo, parkBetween(at(a, R, 11), at(a + 0.3, 9, 36), 0.35));
          b.add(parkMats.steel, parkThinGeo, parkBetween(at(a + TAU / 64, R, -11), at(a + TAU / 64 - 0.3, 9, -36), 0.35));
          // LED pixels down each spoke (rotating with the wheel).
          for (let d = 0.12; d < 0.98; d += 0.07) {
            for (const [a0, z0, z1, off] of [
              [a, 11, 36, 0.3],
              [a + TAU / 64, -11, -36, -0.3],
            ]) {
              const p = at(a0, R, z0).lerp(at(a0 + off, 9, z1), d);
              eyeLeds.add(p.x, p.z, p.y, 2.6, '#ffffff');
              eyeLedAngle.push(a0, d);
            }
          }
        }
        eyeLedCount.spokes = eyeLeds.count;
        for (let k = 0; k < 360; k++) {
          const a = (k / 360) * TAU;
          for (const z of [-13.5, 13.5]) {
            const p = at(a, R, z);
            eyeLeds.add(p.x, p.z, p.y, 3.2, '#ffffff');
            eyeLedAngle.push(a, 1);
          }
        }
        eyeLeds.done();
        // The hub drum (turns with the wheel).
        const drum = new Three.CylinderGeometry(16, 16, 30, 24);
        b.add(parkMats.steel, drum, ident.clone().makeRotationX(Math.PI / 2));
        b.flush(eyeGroup, 'eye rim');
      }
      {
        // Static: spindle, the A-frames, the terminal.
        const b = parkParts(),
          hub = (z) => new Three.Vector3(EYE.x, EYE.hub, EYE.y + z);
        b.add(parkMats.gold, new Three.CylinderGeometry(8, 8, 1, 20), parkBetween(hub(-44), hub(44), 1).scale(ps.set(1, 1, 1)));
        for (const z of [-44, 44]) b.add(parkMats.gold, parkDomeGeo, parkPlaced(EYE.x, EYE.y + z * 1.02, EYE.hub, 8, 8, 8));
        for (const [fx, fy] of wheelFeet()) {
          const side = fy < EYE.y ? -1 : 1,
            top = hub(side * 40),
            foot = new Three.Vector3(fx, 0, fy);
          b.add(parkMats.white, parkTubeGeo, parkBetween(foot, top, 6));
          b.box(parkMats.concrete, parkPlaced(fx, fy, 3, 26, 6, 26));
        }
        // Cross ties between the two legs of each A-frame and between the frames.
        for (const side of [-1, 1]) {
          const y = EYE.y + side * 82;
          for (const h of [0.35, 0.62]) {
            const l = new Three.Vector3(EYE.x - 130, 0, y).lerp(hub(side * 40), h),
              r = new Three.Vector3(EYE.x + 130, 0, y).lerp(hub(side * 40), h);
            b.add(parkMats.white, parkTubeGeo, parkBetween(l, r, 2.6));
          }
        }
        // Terminal: a glass pavilion with a floating white roof and a boarding deck.
        const t = PIER.terminal;
        b.box(parkMats.glassDark, parkPlaced(t.x + t.w / 2, t.y + t.h / 2, 13, t.w - 8, 26, t.h - 8));
        b.box(parkMats.white, parkPlaced(t.x + t.w / 2, t.y + t.h / 2, 28, t.w + 16, 3, t.h + 16));
        b.box(parkMats.stone, parkPlaced(t.x + t.w / 2, EYE.y, 31, 70, 4, 34));
        for (const dx of [-30, 30]) b.box(parkMats.gold, parkPlaced(t.x + t.w / 2 + dx, EYE.y + 17, 36, 1, 8, 1));
        b.flush(parkRoot, 'eye structure');
        const s = sign('SUNSET EYE', t.x + t.w / 2, t.y + t.h + 2, 70, '#9fe6ff');
        s.position.y = 38;
        s.userData.backing.position.y = 38;
      }
      // Capsules: glass pods in a white cradle, instanced and kept level.
      const eyePods = new Three.InstancedMesh(
          new Three.SphereGeometry(1, 20, 12),
          new Three.MeshStandardMaterial({ color: '#7fb2cc', roughness: 0.05, metalness: 0.8, emissive: '#ffe2b0', emissiveIntensity: 0 }),
          WHEEL_CAPSULES,
        ),
        eyeCradles = new Three.InstancedMesh(new Three.TorusGeometry(1, 0.12, 6, 24), parkMats.white, WHEEL_CAPSULES * 2),
        eyeFloors = new Three.InstancedMesh(new Three.CylinderGeometry(1, 0.8, 1, 16), parkMats.white, WHEEL_CAPSULES);
      for (const m of [eyePods, eyeCradles, eyeFloors]) {
        m.frustumCulled = false;
        m.castShadow = true;
        m.userData.dynamic = true;
        parkRoot.add(m);
      }
      const podMatrix = new Three.Matrix4(),
        podSpot = {};
      function updateEyeCapsules() {
        for (let k = 0; k < WHEEL_CAPSULES; k++) {
          wheelCapsule(k, podSpot);
          eyePods.setMatrixAt(k, podMatrix.compose(parkV.set(podSpot.x, podSpot.z, podSpot.y), pq.identity(), ps.set(10, 8.5, 15)));
          eyeFloors.setMatrixAt(k, podMatrix.compose(parkV.set(podSpot.x, podSpot.z - 7.2, podSpot.y), pq.identity(), ps.set(10.5, 2.4, 13)));
          for (const s of [0, 1]) {
            pq.setFromEuler(new Three.Euler(0, Math.PI / 2, 0));
            eyeCradles.setMatrixAt(
              k * 2 + s,
              podMatrix.compose(parkV.set(podSpot.x, podSpot.z, podSpot.y + (s ? 9 : -9)), pq.setFromAxisAngle(parkUpAxis, 0), ps.set(10.8, 9.2, 10)),
            );
          }
        }
        eyePods.instanceMatrix.needsUpdate = true;
        eyeCradles.instanceMatrix.needsUpdate = true;
        eyeFloors.instanceMatrix.needsUpdate = true;
      }
      // LED shows: rainbow chase, gold sparkle, the national colours, a white pulse.
      const eyeLedColor = new Three.Color();
      function updateEyeLeds(night) {
        const geo = eyeLeds.points.geometry,
          col = geo.attributes.color,
          show = Math.floor(gameTime / 30) % 4,
          t = gameTime;
        eyeLeds.points.material.uniforms.uIntensity.value = night * 3.2;
        eyeLeds.points.visible = night > 0.03;
        if (!eyeLeds.points.visible) return;
        for (let i = 0; i < eyeLeds.count; i++) {
          const a = eyeLedAngle[i * 2],
            d = eyeLedAngle[i * 2 + 1];
          if (show === 0) eyeLedColor.setHSL((a / TAU + d * 0.3 - t * 0.08 + 10) % 1, 0.85, 0.55);
          else if (show === 1) {
            const s = Math.sin(a * 37 + d * 23 + t * 6) > 0.6 ? 1 : 0.35;
            eyeLedColor.setRGB(1 * s, 0.72 * s, 0.32 * s);
          } else if (show === 2) {
            const band = Math.floor(((a / TAU) * 4 + t * 0.25) % 4);
            eyeLedColor.set(['#00843d', '#ffffff', '#1a1a1a', '#ef3340'][band]);
            if (band === 2) eyeLedColor.setRGB(0.25, 0.25, 0.25);
          } else {
            const pulse = 0.5 + 0.5 * Math.sin(d * 9 - t * 4);
            eyeLedColor.setRGB(0.55 + pulse * 0.45, 0.7 + pulse * 0.3, 1);
          }
          col.setXYZ(i, eyeLedColor.r, eyeLedColor.g, eyeLedColor.b);
        }
        col.needsUpdate = true;
      }
      // ---- The Fountain Lagoon -------------------------------------------------------
      const LAG = PIER.lagoon;
      {
        const shape = new Three.Shape();
        shape.absellipse(0, 0, LAG.rx, LAG.ry, 0, TAU);
        const water = new Three.Mesh(new Three.ShapeGeometry(shape, 64), parkMats.water);
        water.rotation.x = -Math.PI / 2;
        water.position.set(LAG.x, 2.2, LAG.y);
        water.receiveShadow = true;
        water.userData.dynamic = true;
        water.name = 'lagoon';
        parkRoot.add(water);
        // Coping stones round the edge.
        const b = parkParts();
        for (let i = 0; i < 96; i++) {
          const a = (i / 96) * TAU,
            x = LAG.x + Math.cos(a) * (LAG.rx + 4),
            y = LAG.y + Math.sin(a) * (LAG.ry + 4),
            tangent = Math.atan2(Math.cos(a) * LAG.ry, -Math.sin(a) * LAG.rx);
          b.box(parkMats.stone, parkPlaced(x, y, 2, 16, 4, 9, tangent));
        }
        b.flush(parkRoot, 'lagoon edge');
      }
      /**
       * Jets: an outer ring, an inner ring, a centre row and five tall shooters,
       * each an additive plume whose height and colour the show sets every frame.
       */
      const JETS = [];
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * TAU;
        JETS.push({ x: LAG.x + Math.cos(a) * LAG.rx * 0.78, y: LAG.y + Math.sin(a) * LAG.ry * 0.74, ring: 0, u: i / 40 });
      }
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        JETS.push({ x: LAG.x + Math.cos(a) * LAG.rx * 0.45, y: LAG.y + Math.sin(a) * LAG.ry * 0.42, ring: 1, u: i / 24 });
      }
      for (let i = 0; i < 15; i++) JETS.push({ x: LAG.x - LAG.rx * 0.6 + (i / 14) * LAG.rx * 1.2, y: LAG.y, ring: 2, u: i / 14 });
      for (let i = 0; i < 5; i++) JETS.push({ x: LAG.x - 60 + i * 30, y: LAG.y + (i % 2 ? 18 : -18), ring: 3, u: i / 4 });
      const jetGeo = new Three.CylinderGeometry(0.35, 1.6, 1, 10, 6, true);
      jetGeo.translate(0, 0.5, 0);
      const jetMaterial = new Three.ShaderMaterial({
          uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
          vertexShader: `
            varying float vH;
            varying vec3 vColor;
            varying float vSide;
            void main() {
              vH = position.y;
              vSide = atan( position.z, position.x );
              #ifdef USE_INSTANCING_COLOR
                vColor = instanceColor;
              #else
                vColor = vec3( 1.0 );
              #endif
              vec4 p = vec4( position, 1.0 );
              #ifdef USE_INSTANCING
                p = instanceMatrix * p;
              #endif
              gl_Position = projectionMatrix * modelViewMatrix * p;
            }`,
          fragmentShader: `
            varying float vH;
            varying vec3 vColor;
            varying float vSide;
            uniform float uTime, uIntensity;
            void main() {
              float fade = ( 1.0 - smoothstep( 0.55, 1.0, vH ) ) * ( 0.35 + 0.65 * smoothstep( 0.0, 0.08, vH ) );
              float streak = 0.6 + 0.4 * sin( vH * 38.0 - uTime * 14.0 + vSide * 3.0 );
              gl_FragColor = vec4( vColor * fade * streak * uIntensity, 1.0 );
            }`,
          transparent: true,
          depthWrite: false,
          blending: Three.AdditiveBlending,
          side: Three.DoubleSide,
        }),
        jets = new Three.InstancedMesh(jetGeo, jetMaterial, JETS.length);
      jets.frustumCulled = false;
      jets.userData.dynamic = true;
      jets.name = 'fountain jets';
      jets.renderOrder = 4;
      jets.setColorAt(0, new Three.Color());
      parkRoot.add(jets);
      const jetSpray = parkGlowPoints(JETS.length * 3, 'fountain spray'),
        jetLights = parkGlowPoints(JETS.length, 'fountain lights');
      for (let i = 0; i < JETS.length * 3; i++) jetSpray.add(0, 0, -100, 10, '#ffffff');
      for (const j of JETS) jetLights.add(j.x, j.y, 2.6, 7, '#ffffff');
      jetSpray.done();
      jetLights.done();
      const jetColor = new Three.Color(),
        jetMatrix = new Three.Matrix4();
      /* The choreography: heights and colours of every jet at show time t. */
      function parkJetState(j, show, t, night) {
        const beat = (t * show.bpm) / 60,
          bar = Math.floor(beat / 8) % 4,
          pulse = Math.pow(1 - (beat % 1), 3),
          end = Math.max(0, 1 - Math.max(0, t - 38) / 4) * Math.min(1, t / 1.5);
        let h = 0;
        if (show.index === 0) {
          // Sweeps: a wave running round the rings, the row pulsing on the beat.
          if (j.ring < 2) h = (40 + 90 * Math.max(0, Math.sin((j.u - beat / 16) * TAU * 2))) * (j.ring ? 0.8 : 1);
          else if (j.ring === 2) h = 30 + 70 * pulse * (bar % 2 ? 1 : Math.abs(j.u - 0.5) * 2);
          else h = bar === 3 ? 260 * pulse : 0;
        } else if (show.index === 1) {
          // Breathing: slow swells, the shooters rising in turn.
          const swell = 0.5 + 0.5 * Math.sin(beat * 0.4 + j.ring);
          h = j.ring === 3 ? (Math.floor(beat / 4) % 5 === Math.round(j.u * 4) ? 300 : 0) : 30 + 110 * swell * (0.7 + 0.3 * Math.sin(j.u * TAU * 3));
        } else {
          // Dance: alternating halves on the beat and a finale of everything.
          const half = (j.u < 0.5) === (Math.floor(beat) % 2 === 0);
          h = j.ring === 3 ? (beat % 16 > 14 ? 320 : 0) : (half ? 140 : 40) * (0.5 + 0.5 * pulse) + (t > 34 ? 120 : 0);
        }
        h *= end;
        if (night) jetColor.setHSL((j.u * 0.3 + beat / 32 + show.index * 0.33) % 1, 0.7, 0.62);
        else jetColor.setRGB(0.9, 0.95, 1);
        return h;
      }
      function updateFountain(night) {
        const show = parkShow.fountain;
        jets.visible = !!show;
        const spray = jetSpray.points.geometry.attributes,
          lights = jetLights.points.geometry.attributes;
        jetSpray.points.visible = jetLights.points.visible = !!show;
        if (!show) return;
        jetMaterial.uniforms.uTime.value = gameTime;
        jetMaterial.uniforms.uIntensity.value = night > 0.2 ? 1.6 + night * 1.8 : 0.9;
        jetSpray.points.material.uniforms.uIntensity.value = night > 0.2 ? 1.2 : 0.5;
        jetLights.points.material.uniforms.uIntensity.value = night * 2.5;
        for (let i = 0; i < JETS.length; i++) {
          const j = JETS[i],
            h = parkJetState(j, show, show.t, night > 0.2),
            w = 1 + h / 120;
          jets.setMatrixAt(i, jetMatrix.compose(parkV.set(j.x, 2.2, j.y), pq.identity(), ps.set(w, Math.max(0.01, h), w)));
          jets.setColorAt(i, jetColor);
          lights.color.setXYZ(i, jetColor.r, jetColor.g, jetColor.b);
          for (let k = 0; k < 3; k++) {
            const s = i * 3 + k,
              drift = Math.sin(gameTime * 2 + i + k * 2) * (3 + h * 0.04);
            spray.position.setXYZ(s, j.x + drift, 2 + h * (0.82 + k * 0.07), j.y + Math.cos(gameTime * 1.7 + i * 1.3 + k) * (3 + h * 0.03));
            spray.size.setX(s, h > 5 ? 6 + h * 0.06 : 0);
            spray.color.setXYZ(s, 0.5 + jetColor.r * 0.5, 0.5 + jetColor.g * 0.5, 0.5 + jetColor.b * 0.5);
          }
        }
        jets.instanceMatrix.needsUpdate = true;
        jets.instanceColor.needsUpdate = true;
        spray.position.needsUpdate = spray.size.needsUpdate = spray.color.needsUpdate = true;
        lights.color.needsUpdate = true;
      }
      // ---- Facades --------------------------------------------------------------------
      /* A window-grid texture (and the matching night emissive map) for the hotel. */
      function parkFacadeTextures(cols, rows, base, frame, glass) {
        const c = document.createElement('canvas'),
          e = document.createElement('canvas');
        c.width = e.width = 256;
        c.height = e.height = 256;
        const g = c.getContext('2d'),
          ge = e.getContext('2d');
        g.fillStyle = base;
        g.fillRect(0, 0, 256, 256);
        ge.fillStyle = '#000';
        ge.fillRect(0, 0, 256, 256);
        const cw = 256 / cols,
          rh = 256 / rows;
        for (let i = 0; i < cols; i++)
          for (let j = 0; j < rows; j++) {
            const x = i * cw,
              y = j * rh;
            g.fillStyle = frame;
            g.fillRect(x + cw * 0.12, y + rh * 0.18, cw * 0.76, rh * 0.66);
            g.fillStyle = glass;
            g.fillRect(x + cw * 0.18, y + rh * 0.24, cw * 0.64, rh * 0.5);
            // Balcony rail.
            g.fillStyle = 'rgba(255,255,255,0.55)';
            g.fillRect(x + cw * 0.1, y + rh * 0.78, cw * 0.8, rh * 0.06);
            const lit = (i * 7 + j * 13) % 10;
            if (lit < 6) {
              ge.fillStyle = lit < 2 ? '#ffe9c0' : lit < 4 ? '#ffc98a' : '#d9b27a';
              ge.fillRect(x + cw * 0.18, y + rh * 0.24, cw * 0.64, rh * 0.5);
            }
          }
        const make = (canvas) => {
          const t = new Three.CanvasTexture(canvas);
          t.colorSpace = Three.SRGBColorSpace;
          t.wrapS = t.wrapT = Three.RepeatWrapping;
          t.anisotropy = 4;
          return t;
        };
        return { map: make(c), emissiveMap: make(e) };
      }
      const hotelTex = parkFacadeTextures(4, 4, '#e9c3a4', '#c89f82', '#3d5f78'),
        hotelFacade = new Three.MeshStandardMaterial({
          map: hotelTex.map,
          emissiveMap: hotelTex.emissiveMap,
          emissive: '#ffffff',
          emissiveIntensity: 0,
          roughness: 0.6,
          metalness: 0.05,
        });
      /* A quad with world-scaled UVs (one texture tile per `tile` units). */
      function parkFacadeQuad(b, material, p0, p1, p2, p3, tileU, tileV) {
        const g = new Three.BufferGeometry(),
          wu = p0.distanceTo(p1) / tileU,
          wv = p0.distanceTo(p3) / tileV,
          n = new Three.Vector3().subVectors(p1, p0).cross(new Three.Vector3().subVectors(p3, p0)).normalize();
        g.setAttribute('position', new Three.Float32BufferAttribute([...p0.toArray(), ...p1.toArray(), ...p2.toArray(), ...p3.toArray()], 3));
        g.setAttribute('normal', new Three.Float32BufferAttribute([...n.toArray(), ...n.toArray(), ...n.toArray(), ...n.toArray()], 3));
        g.setAttribute('uv', new Three.Float32BufferAttribute([0, 0, wu, 0, wu, wv, 0, wv], 2));
        g.setIndex([0, 1, 2, 0, 2, 3]);
        b.add(material, g, new Three.Matrix4());
      }
      // ---- The Sunset Palace ----------------------------------------------------------
      /**
       * A crescent hotel opening to the lagoon: two stepped wings on an arc, joined
       * at the top by a bridge over a great central arch, crowned with a dome.
       */
      {
        const H = PIER.hotel,
          b = parkParts(),
          cx = H.x,
          cy = H.y + 420,
          radius = 460,
          span = H.w / radius,
          segs = 22,
          depth = H.d;
        for (let i = 0; i < segs; i++) {
          const a0 = -Math.PI / 2 - span / 2 + (i / segs) * span,
            a1 = -Math.PI / 2 - span / 2 + ((i + 1) / segs) * span,
            mid = Math.abs(i + 0.5 - segs / 2) / (segs / 2),
            // Tiers step down towards the wing ends.
            top = H.height - Math.floor(mid * 4) * 32,
            arch = Math.abs(i + 0.5 - segs / 2) < 1.6,
            bottom = arch ? H.height - 64 : 0,
            inner = radius - depth / 2,
            outer = radius + depth / 2,
            q = (a, r, z) => new Three.Vector3(cx + Math.cos(a) * r, z, cy + Math.sin(a) * r);
          // Front (south, the concave side) and back faces, and the ends of each tier.
          parkFacadeQuad(b, hotelFacade, q(a0, inner, bottom), q(a1, inner, bottom), q(a1, inner, top), q(a0, inner, top), 14, 12);
          parkFacadeQuad(b, hotelFacade, q(a1, outer, bottom), q(a0, outer, bottom), q(a0, outer, top), q(a1, outer, top), 14, 12);
          b.add(parkMats.cream, boxGeo, parkPlaced((q(a0, radius, 0).x + q(a1, radius, 0).x) / 2, (q(a0, radius, 0).z + q(a1, radius, 0).z) / 2, top + 2, (a1 - a0) * radius + 1, 4, depth + 4, a0 + (a1 - a0) / 2 + Math.PI / 2));
          if (arch) b.add(parkMats.gold, boxGeo, parkPlaced((q(a0, radius, 0).x + q(a1, radius, 0).x) / 2, (q(a0, radius, 0).z + q(a1, radius, 0).z) / 2, bottom - 2, (a1 - a0) * radius + 1, 4, depth + 2, a0 + (a1 - a0) / 2 + Math.PI / 2));
          if (i === 0 || i === segs - 1) {
            const a = i === 0 ? a0 : a1;
            parkFacadeQuad(b, hotelFacade, q(a, outer, 0), q(a, inner, 0), q(a, inner, top), q(a, outer, top), 14, 12);
            if (i === 0) parkFacadeQuad(b, hotelFacade, q(a, inner, 0), q(a, outer, 0), q(a, outer, top), q(a, inner, top), 14, 12);
          }
          const prevTop = H.height - Math.floor((Math.abs(i - 0.5 - segs / 2 + 1) / (segs / 2)) * 4) * 32;
          if (i > 0 && prevTop !== top) {
            const lo = Math.min(prevTop, top),
              hi = Math.max(prevTop, top);
            parkFacadeQuad(b, hotelFacade, q(a0, inner, lo), q(a0, outer, lo), q(a0, outer, hi), q(a0, inner, hi), 14, 12);
            parkFacadeQuad(b, hotelFacade, q(a0, outer, lo), q(a0, inner, lo), q(a0, inner, hi), q(a0, outer, hi), 14, 12);
          }
          // Arch sides.
          if (arch && Math.abs(i + 0.5 - segs / 2) > 0.6) {
            const a = i < segs / 2 ? a0 : a1;
            parkFacadeQuad(b, parkMats.cream, q(a, inner, 0), q(a, outer, 0), q(a, outer, bottom), q(a, inner, bottom), 20, 20);
            parkFacadeQuad(b, parkMats.cream, q(a, outer, 0), q(a, inner, 0), q(a, inner, bottom), q(a, outer, bottom), 20, 20);
          }
        }
        // Crown: a gold dome on a drum over the arch, and minaret-like finials.
        const crown = { x: cx, y: cy - radius };
        b.add(parkMats.cream, new Three.CylinderGeometry(1, 1, 1, 24), parkPlaced(crown.x, crown.y, H.height + 14, 34, 24, 34));
        b.add(parkMats.gold, parkDomeGeo, parkPlaced(crown.x, crown.y, H.height + 26, 34, 34, 34));
        b.add(parkMats.gold, parkConeGeo, parkPlaced(crown.x, crown.y, H.height + 68, 4, 20, 4));
        for (const side of [-1, 1]) {
          const a = -Math.PI / 2 + side * span * 0.28,
            x = cx + Math.cos(a) * radius,
            y = cy + Math.sin(a) * radius,
            t = H.height - 32;
          b.add(parkMats.cream, new Three.CylinderGeometry(1, 1, 1, 12), parkPlaced(x, y, t + 20, 12, 40, 12));
          b.add(parkMats.gold, parkDomeGeo, parkPlaced(x, y, t + 40, 12, 16, 12));
        }
        // Entrance canopy and fountain court in front of the arch.
        b.box(parkMats.gold, parkPlaced(crown.x, crown.y + depth / 2 + 16, 22, 90, 3, 30));
        for (const dx of [-40, 40]) b.add(parkMats.white, parkTubeGeo, parkBetween(parkP3(crown.x + dx, crown.y + depth / 2 + 28, 0), parkP3(crown.x + dx, crown.y + depth / 2 + 28, 21), 1.4));
        b.flush(parkRoot, 'sunset palace');
        for (let i = 0; i < 40; i++) {
          const a = -Math.PI / 2 - span / 2 + (i / 39) * span;
          parkBulbs.add(cx + Math.cos(a) * (radius - depth / 2 - 1), cy + Math.sin(a) * (radius - depth / 2 - 1), 6, 5, '#ffd08a');
        }
        parkBulbs.add(crown.x, crown.y, H.height + 80, 16, '#ffe9b0');
        const s = sign('SUNSET PALACE', crown.x, crown.y + depth / 2 + 3, 90, '#f3cf7a');
        s.position.y = H.height - 90;
        s.userData.backing.position.y = H.height - 90;
      }
      // ---- The beach club -------------------------------------------------------------
      {
        const c = PIER.beachClub,
          b = parkParts();
        // Deck, infinity pool, cabanas, loungers and umbrellas, the club house.
        b.box(parkMats.cream, parkPlaced(c.x + c.w / 2, c.y + 105, 1.2, c.w, 2.4, 90));
        const pool = new Three.Mesh(new Three.PlaneGeometry(300, 44), parkMats.pool);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(c.x + c.w / 2, 2.6, c.y + 105);
        pool.userData.dynamic = true;
        parkRoot.add(pool);
        for (let i = 0; i < 9; i++) {
          const x = c.x + 30 + i * 52,
            y = c.y + 20;
          b.box(parkMats.canvasWhite, parkPlaced(x, y, 9, 20, 1, 20));
          b.add(parkMats.canvasWhite, parkConeGeo, parkPlaced(x, y, 15, 14, 12, 14, Math.PI / 4));
          for (const dx of [-9, 9]) for (const dy of [-9, 9]) b.add(parkMats.wood, parkThinGeo, parkBetween(parkP3(x + dx, y + dy, 0), parkP3(x + dx, y + dy, 9), 0.5));
        }
        for (let i = 0; i < 18; i++) {
          const x = c.x + 20 + i * 26,
            y = c.y + 140;
          b.box(parkMats.white, parkPlaced(x, y, 1.5, 5, 1.2, 12));
          if (i % 2 === 0) {
            b.add(parkMats.wood, parkThinGeo, parkBetween(parkP3(x + 6, y, 0), parkP3(x + 6, y, 14), 0.4));
            b.add(i % 4 ? parkMats.canvasRed : parkMats.canvasWhite, parkConeGeo, parkPlaced(x + 6, y, 15.5, 10, 3, 10));
          }
        }
        b.box(parkMats.white, parkPlaced(c.x + 240, c.y + 35, 16, 180, 32, 50));
        b.box(parkMats.gold, parkPlaced(c.x + 240, c.y + 35, 33, 196, 2, 66));
        b.box(parkMats.glassDark, parkPlaced(c.x + 240, c.y + 60.5, 12, 160, 18, 1));
        b.flush(parkRoot, 'beach club');
        for (let i = 0; i < 20; i++) parkBulbs.add(c.x + 150 + i * 9.5, c.y + 68, 32, 3, '#ffcf8a', i);
      }
      // ---- The gate ------------------------------------------------------------------
      {
        const g = PIER.gate,
          b = parkParts();
        for (const side of [-1, 1]) {
          const x = g.x + side * 77;
          b.box(parkMats.cream, parkPlaced(x, g.y - 15, 55, 45, 110, 30));
          b.box(parkMats.gold, parkPlaced(x, g.y - 15, 112, 49, 4, 34));
          b.add(parkMats.gold, parkDomeGeo, parkPlaced(x, g.y - 15, 114, 20, 24, 20));
          b.add(parkMats.gold, parkConeGeo, parkPlaced(x, g.y - 15, 146, 2, 14, 2));
          // Pointed arch niches.
          for (const dz of [-1, 1]) b.box(parkMats.turquoise, parkPlaced(x, g.y - 15 + dz * 15.2, 45, 18, 50, 0.6));
        }
        // The great arch across the promenade: a lintel carrying the sign.
        b.box(parkMats.cream, parkPlaced(g.x, g.y - 15, 92, 120, 22, 26));
        b.box(parkMats.gold, parkPlaced(g.x, g.y - 15, 104, 124, 3, 30));
        const archGeo = new Three.TorusGeometry(52, 4, 8, 32, Math.PI);
        b.add(parkMats.gold, archGeo, parkPlaced(g.x, g.y - 1, 28, 1, 1.2, 1));
        b.flush(parkRoot, 'gate');
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * Math.PI;
          parkBulbs.add(g.x + Math.cos(a) * 52, g.y + 3, 28 + Math.sin(a) * 62, 3, i % 2 ? '#ffd79a' : '#8fe8ff', i);
        }
        const s = sign('SUNSET PIER', g.x, g.y - 1, 110, '#f6d27f');
        s.position.y = 93;
        s.userData.backing.position.y = 93;
      }
      // ---- Carousel ------------------------------------------------------------------
      const carousel = new Three.Group();
      carousel.position.set(PIER.carousel.x, 0, PIER.carousel.y);
      carousel.userData.dynamic = true;
      carousel.name = 'carousel';
      parkRoot.add(carousel);
      const carouselHorses = [];
      {
        const R = PIER.carousel.r,
          b = parkParts();
        b.add(parkMats.wood, new Three.CylinderGeometry(1, 1, 1, 32), parkPlaced(0, 0, 2, R, 4, R));
        b.add(parkMats.gold, new Three.CylinderGeometry(1, 1, 1, 16), parkPlaced(0, 0, 18, 6, 32, 6));
        b.add(parkMats.cream, new Three.CylinderGeometry(1, 1, 1, 32, 1, true), parkPlaced(0, 0, 31, R + 4, 6, R + 4));
        // Striped canopy: alternating red and white gores.
        for (let i = 0; i < 16; i++) {
          const gore = new Three.ConeGeometry(R + 7, 16, 2, 1, true, (i / 16) * TAU, TAU / 16);
          b.add(i % 2 ? parkMats.canvasRed : parkMats.canvasWhite, gore, parkPlaced(0, 0, 42, 1, 1, 1));
        }
        b.add(parkMats.gold, parkConeGeo, parkPlaced(0, 0, 54, 3, 10, 3));
        b.flush(carousel, 'carousel');
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU,
            r = R - 9,
            horse = new Three.Group(),
            hb = parkParts();
          hb.box(i % 2 ? parkMats.white : parkMats.cream, parkPlaced(0, 0, 0, 12, 5.5, 4.2));
          hb.box(i % 2 ? parkMats.white : parkMats.cream, parkPlaced(5.5, 0, 4, 4, 7, 3.4));
          hb.box(parkMats.gold, parkPlaced(0, 0, 3, 5, 1.2, 4.6));
          for (const dx of [-4.5, 4]) hb.box(parkMats.gold, parkPlaced(dx, 0, -4, 1.6, 6, 1.6));
          hb.add(parkMats.gold, parkThinGeo, parkPlaced(0, 0, 8, 0.5, 44, 0.5));
          hb.flush(horse, 'horse');
          horse.position.set(Math.cos(a) * r, 12, Math.sin(a) * r);
          horse.rotation.y = -a + Math.PI / 2;
          carousel.add(horse);
          carouselHorses.push(horse);
        }
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU;
          parkBulbs.add(PIER.carousel.x + Math.cos(a) * (R + 5), PIER.carousel.y + Math.sin(a) * (R + 5), 34, 3, i % 2 ? '#ffd79a' : '#ff9fc4', i);
        }
      }
      // ---- Swing carousel --------------------------------------------------------------
      const SW = PIER.swing,
        swingTop = new Three.Group(),
        swingSeats = [];
      {
        const b = parkParts();
        b.add(parkMats.white, new Three.CylinderGeometry(3.5, 6, 1, 16), parkPlaced(SW.x, SW.y, 45, 1, 90, 1));
        b.add(parkMats.stone, new Three.CylinderGeometry(1, 1, 1, 32), parkPlaced(SW.x, SW.y, 1.5, SW.r, 3, SW.r));
        b.flush(parkRoot, 'swing tower');
        swingTop.position.set(SW.x, 84, SW.y);
        swingTop.userData.dynamic = true;
        parkRoot.add(swingTop);
        const tb = parkParts();
        for (let i = 0; i < 16; i++) {
          const gore = new Three.ConeGeometry(34, 10, 2, 1, true, (i / 16) * TAU, TAU / 16);
          tb.add(i % 2 ? parkMats.turquoise : parkMats.gold, gore, parkPlaced(0, 0, 8, 1, 1, 1));
        }
        tb.add(parkMats.white, new Three.CylinderGeometry(34, 34, 3, 32, 1, true), parkPlaced(0, 0, 1.5, 1, 1, 1));
        tb.flush(swingTop, 'swing top');
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU,
            arm = new Three.Group();
          arm.position.set(Math.cos(a) * 30, 0, Math.sin(a) * 30);
          arm.rotation.y = -a;
          swingTop.add(arm);
          const seat = parkParts();
          seat.add(parkMats.steel, parkThinGeo, parkPlaced(0, 0, -21, 0.25, 42, 0.25));
          seat.box(parkMats.seat, parkPlaced(0, 0, -43, 3.4, 1, 3.4));
          seat.box(i % 3 ? parkMats.white : parkMats.red, parkPlaced(0, -1.6, -41, 1.6, 3.2, 1.2));
          seat.add(parkMats.skin, sphereGeo, parkPlaced(0, 0, -37.6, 0.9, 1.1, 0.9));
          seat.flush(arm, 'swing seat');
          swingSeats.push(arm);
        }
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * TAU;
          parkBulbs.add(SW.x + Math.cos(a) * 34, SW.y + Math.sin(a) * 34, 85, 3, i % 2 ? '#8fe8ff' : '#ffd79a', i);
        }
      }
      // ---- Teacups -------------------------------------------------------------------
      const teacups = new Three.Group(),
        teacupCups = [];
      teacups.position.set(PIER.teacups.x, 0, PIER.teacups.y);
      teacups.userData.dynamic = true;
      parkRoot.add(teacups);
      {
        const b = parkParts();
        b.add(parkMats.cream, new Three.CylinderGeometry(1, 1, 1, 32), parkPlaced(0, 0, 1.2, PIER.teacups.r, 2.4, PIER.teacups.r));
        b.add(parkMats.gold, new Three.CylinderGeometry(1, 1, 1, 16), parkPlaced(0, 0, 4, 8, 6, 8));
        b.flush(teacups, 'teacup deck');
        const cup = new Three.LatheGeometry(
          [
            [0, 0],
            [5, 0.4],
            [7.5, 3],
            [8.4, 7],
            [8.2, 9],
          ].map(([r, y]) => new Three.Vector2(r, y)),
          20,
        );
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU,
            g = new Three.Group();
          g.position.set(Math.cos(a) * 25, 2.4, Math.sin(a) * 25);
          const m = new Three.Mesh(cup, [parkMats.turquoise, parkMats.canvasRed, parkMats.gold][i % 3]);
          m.castShadow = true;
          g.add(m);
          const riders = parkParts();
          for (const d of [-3, 3]) riders.add(parkMats.skin, sphereGeo, parkPlaced(d, 0, 9.5, 1, 1.2, 1));
          riders.flush(g, 'cup riders');
          teacups.add(g);
          teacupCups.push(g);
        }
      }
      // ---- Drop tower ----------------------------------------------------------------
      const DT = PIER.dropTower,
        dropCar = new Three.Group(),
        dropLeds = [];
      {
        const b = parkParts(),
          H = 300;
        b.add(parkMats.white, new Three.CylinderGeometry(1, 1, 1, 16), parkPlaced(DT.x, DT.y, H / 2, 9, H, 9));
        for (let y = 0; y < H; y += 24)
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * TAU + Math.PI / 4;
            b.add(parkMats.gold, parkThinGeo, parkBetween(parkP3(DT.x + Math.cos(a) * 9, DT.y + Math.sin(a) * 9, y), parkP3(DT.x + Math.cos(a + Math.PI / 2) * 9, DT.y + Math.sin(a + Math.PI / 2) * 9, y + 24), 0.5));
          }
        b.add(parkMats.gold, parkDomeGeo, parkPlaced(DT.x, DT.y, H, 14, 12, 14));
        b.add(parkMats.gold, parkConeGeo, parkPlaced(DT.x, DT.y, H + 22, 2, 26, 2));
        b.add(parkMats.stone, new Three.CylinderGeometry(1, 1, 1, 24), parkPlaced(DT.x, DT.y, 2, 22, 4, 22));
        b.flush(parkRoot, 'drop tower');
        for (let y = 10; y < H; y += 8) {
          dropLeds.push(parkBulbs.add(DT.x, DT.y + 9.6, y, 2.4, '#ffffff'));
        }
        dropCar.userData.dynamic = true;
        parkRoot.add(dropCar);
        const c = parkParts();
        c.add(parkMats.turquoise, new Three.CylinderGeometry(16, 16, 5, 24, 1, true), parkPlaced(0, 0, 0, 1, 1, 1));
        c.add(parkMats.gold, new Three.CylinderGeometry(17, 17, 1.5, 24), parkPlaced(0, 0, 3, 1, 1, 1));
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          c.box(parkMats.seat, parkPlaced(Math.cos(a) * 18, Math.sin(a) * 18, -3, 3, 6, 3, a));
          c.add(parkMats.skin, sphereGeo, parkPlaced(Math.cos(a) * 18, Math.sin(a) * 18, 1.4, 1, 1.2, 1));
          c.add(i % 2 ? parkMats.red : parkMats.white, boxGeo, parkPlaced(Math.cos(a) * 18.4, Math.sin(a) * 18.4, -4.5, 1.4, 3.4, 2, a));
        }
        c.flush(dropCar, 'drop car');
        const s = sign('FREE FALL', DT.x, DT.y + 24, 50, '#ffb4a0');
        s.position.y = 30;
        s.userData.backing.position.y = 30;
      }
      // ---- Log flume ------------------------------------------------------------------
      const flumeBoats = [],
        flumeSplash = parkGlowPoints(160, 'flume splash'),
        splashParticles = [];
      {
        const F = flumeCircuit(),
          b = parkParts(),
          n = F.pts.length;
        for (let i = 0; i < n; i++) {
          const a = F.pts[i],
            c = F.pts[(i + 1) % n],
            len = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]),
            yaw = Math.atan2(c[1] - a[1], c[0] - a[0]),
            pitch = Math.atan2(c[2] - a[2], Math.hypot(c[0] - a[0], c[1] - a[1])),
            mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2],
            m = parkPlaced(mid[0], mid[1], mid[2], 1, 1, 1, yaw);
          // Trough: floor and two walls, pitched along the run; water inside.
          const tilt = new Three.Matrix4().makeRotationZ(pitch);
          for (const [dz, sy, h, material] of [
            [0, 1.2, 0, parkMats.wood],
            [-6, 7, 3.5, parkMats.wood],
            [6, 7, 3.5, parkMats.wood],
            [0, 0.3, 2.2, parkMats.pool],
          ])
            b.add(material, boxGeo, m.clone().multiply(tilt).multiply(new Three.Matrix4().compose(new Three.Vector3(0, h, dz), new Three.Quaternion(), new Three.Vector3(len + 0.6, sy, dz ? 1 : 11))));
          if (i % 5 === 0 && mid[2] > 6)
            for (const dz of [-5, 5]) {
              const px = mid[0] - Math.sin(yaw) * dz,
                py = mid[1] + Math.cos(yaw) * dz;
              b.add(parkMats.wood, parkThinGeo, parkBetween(parkP3(px, py, 0), parkP3(px, py, mid[2]), 0.8));
            }
        }
        // Splash pool, station hut with a thatched roof, rock work round the drop.
        b.add(parkMats.pool, new Three.CylinderGeometry(1, 1, 1, 24), parkPlaced(4075, -6508, 1.5, 36, 3, 24));
        b.box(parkMats.wood, parkPlaced(4025, -6470, 14, 50, 28, 22));
        b.add(parkMats.sand, parkConeGeo, parkPlaced(4025, -6470, 34, 34, 16, 20, Math.PI / 4));
        for (let i = 0; i < 9; i++) b.add(parkMats.terracotta, new Three.DodecahedronGeometry(1), parkPlaced(4050 + (i % 3) * 16, -6560 + Math.floor(i / 3) * 14, 6, 10 + (i % 4) * 3, 8 + (i % 3) * 6, 9));
        b.flush(parkRoot, 'log flume');
        for (let k = 0; k < FLUME_BOATS; k++) {
          const g = new Three.Group(),
            bb = parkParts();
          bb.box(parkMats.wood, parkPlaced(0, 0, 2.5, 16, 4, 8));
          bb.box(parkMats.wood, parkPlaced(7, 0, 4.5, 3, 4, 7.6));
          for (let r = 0; r < 3; r++) {
            bb.box([parkMats.red, parkMats.white, parkMats.turquoise][r], parkPlaced(-4 + r * 4, 0, 6, 2, 3, 3));
            bb.add(parkMats.skin, sphereGeo, parkPlaced(-4 + r * 4, 0, 8.4, 1, 1.2, 1));
          }
          bb.flush(g, 'flume boat');
          g.userData.dynamic = true;
          parkRoot.add(g);
          flumeBoats.push({ g, wasHigh: false });
        }
        for (let i = 0; i < 160; i++) flumeSplash.add(0, 0, -100, 4, '#e8f6ff');
        flumeSplash.done();
        const s = sign('WADI SPLASH', 4025, -6458, 50, '#9fe6ff');
        s.position.y = 30;
        s.userData.backing.position.y = 30;
      }
      const boatSpot = {};
      function updateFlume(dt) {
        for (let k = 0; k < flumeBoats.length; k++) {
          const boat = flumeBoats[k];
          flumeBoat(k, boatSpot);
          boat.g.position.set(boatSpot.x, boatSpot.z + 1.5, boatSpot.y);
          boat.g.rotation.set(0, -boatSpot.a, Math.atan(boatSpot.slope));
          // At the foot of the big drop the boat throws up a wall of spray.
          const high = boatSpot.z > 40;
          if (boat.wasHigh && boatSpot.z < 10) {
            for (let i = 0; i < 70; i++)
              splashParticles.push({
                x: boatSpot.x,
                y: boatSpot.y,
                z: 4,
                vx: randomBetween(-30, 30) + Math.cos(boatSpot.a) * 40,
                vy: randomBetween(-30, 30) + Math.sin(boatSpot.a) * 40,
                vz: randomBetween(40, 110),
                life: randomBetween(0.8, 1.6),
              });
            parkSplashSound(boatSpot.x, boatSpot.y);
          }
          if (boatSpot.z > 40) boat.wasHigh = true;
          else if (boatSpot.z < 10) boat.wasHigh = false;
        }
        const attr = flumeSplash.points.geometry.attributes;
        for (let i = splashParticles.length - 1; i >= 0; i--) {
          const p = splashParticles[i];
          p.life -= dt;
          p.vz -= 120 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (p.life <= 0 || p.z < 0) splashParticles.splice(i, 1);
        }
        if (splashParticles.length > 160) splashParticles.splice(0, splashParticles.length - 160);
        for (let i = 0; i < 160; i++) {
          const p = splashParticles[i];
          if (p) {
            attr.position.setXYZ(i, p.x, p.z, p.y);
            attr.size.setX(i, 5 + (1 - p.life) * 5);
          } else attr.size.setX(i, 0);
        }
        attr.position.needsUpdate = attr.size.needsUpdate = true;
      }
      // ---- Dark ride: Arabian Nights ---------------------------------------------------
      {
        const d = PIER.darkRide,
          b = parkParts(),
          cx = d.x + d.w / 2,
          front = d.y + d.h;
        b.box(parkMats.sand, parkPlaced(cx, d.y + d.h / 2, 26, d.w, 52, d.h));
        // Facade: a crenellated wall with three horseshoe-arched gateways.
        b.box(parkMats.stone, parkPlaced(cx, front - 2, 34, d.w + 10, 68, 6));
        for (let x = d.x; x <= d.x + d.w; x += 12) b.box(parkMats.stone, parkPlaced(x, front - 2, 71, 6, 6, 6));
        for (const dx of [-60, 0, 60]) {
          b.box(parkMats.seat, parkPlaced(cx + dx, front + 1.2, 16, 22, 32, 1));
          b.add(parkMats.gold, new Three.TorusGeometry(12, 1.6, 6, 20, Math.PI * 1.25), parkPlaced(cx + dx, front + 1.6, 31, 1, 1, 1).multiply(new Three.Matrix4().makeRotationZ(-Math.PI * 0.125)));
          b.add(parkMats.turquoise, parkDomeGeo, parkPlaced(cx + dx, d.y + d.h / 2, 52, 20, 24, 20));
        }
        // Towers with onion domes at the corners of the facade.
        for (const dx of [-d.w / 2 - 4, d.w / 2 + 4]) {
          b.add(parkMats.stone, new Three.CylinderGeometry(1, 1, 1, 12), parkPlaced(cx + dx, front - 4, 45, 11, 90, 11));
          b.add(parkMats.gold, new Three.SphereGeometry(1, 14, 10), parkPlaced(cx + dx, front - 4, 96, 12, 14, 12));
          b.add(parkMats.gold, parkConeGeo, parkPlaced(cx + dx, front - 4, 114, 3, 16, 3));
        }
        b.flush(parkRoot, 'dark ride');
        for (let i = 0; i < 16; i++) parkBulbs.add(d.x + 6 + i * 12.6, front + 3, 60, 4, i % 2 ? '#ff9f5a' : '#ffd79a', i);
        for (const dx of [-60, 0, 60]) parkBulbs.add(cx + dx, front + 4, 22, 9, '#ffb060', 1 + dx);
        const s = sign('ARABIAN NIGHTS', cx, front + 3, 100, '#f6d27f');
        s.position.y = 48;
        s.userData.backing.position.y = 48;
      }
      // ---- Bumper cars ----------------------------------------------------------------
      const BC = PIER.bumper,
        BUMPERS = 10,
        bumperCars = new Three.InstancedMesh(new Three.BoxGeometry(9, 4, 6), new Three.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3 }), BUMPERS),
        bumperPoles = new Three.InstancedMesh(parkThinGeo, parkMats.steel, BUMPERS),
        bumperState = [];
      {
        const b = parkParts(),
          cx = BC.x + BC.w / 2,
          cy = BC.y + BC.h / 2;
        b.box(parkMats.darkSteel, parkPlaced(cx, cy, 0.8, BC.w - 6, 1.6, BC.h - 6));
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
          [0, -1],
          [0, 1],
        ])
          b.add(parkMats.gold, parkTubeGeo, parkBetween(parkP3(cx + dx * (BC.w / 2 - 3), cy + dy * (BC.h / 2 - 3), 0), parkP3(cx + dx * (BC.w / 2 - 3), cy + dy * (BC.h / 2 - 3), 30), 1.6));
        b.box(parkMats.canvasWhite, parkPlaced(cx, cy, 31, BC.w + 6, 2, BC.h + 6));
        b.box(parkMats.turquoise, parkPlaced(cx, cy, 34, BC.w - 20, 4, BC.h - 20));
        b.box(parkMats.red, parkPlaced(cx, BC.y + BC.h + 2, 26, BC.w + 6, 8, 1));
        b.flush(parkRoot, 'bumper cars');
        const c = new Three.Color();
        for (let i = 0; i < BUMPERS; i++) {
          bumperCars.setColorAt(i, c.setHSL(i / BUMPERS, 0.75, 0.5));
          bumperState.push({ x: cx + randomBetween(-50, 50), y: cy + randomBetween(-30, 30), a: randomBetween(0, TAU), v: 30 });
        }
        for (const m of [bumperCars, bumperPoles]) {
          m.frustumCulled = false;
          m.castShadow = true;
          m.userData.dynamic = true;
          parkRoot.add(m);
        }
        for (let i = 0; i < 14; i++) parkBulbs.add(BC.x + 6 + i * 10.5, BC.y + BC.h + 3, 30, 3, i % 2 ? '#ff7fb0' : '#8fe8ff', i);
        const s = sign('DODGEMS', cx, BC.y + BC.h + 4, 56, '#ff9fc4');
        s.position.y = 40;
        s.userData.backing.position.y = 40;
      }
      function updateBumpers(dt) {
        const cx = BC.x + BC.w / 2,
          cy = BC.y + BC.h / 2;
        for (let i = 0; i < BUMPERS; i++) {
          const s = bumperState[i];
          s.a += Math.sin(gameTime * 0.7 + i * 2.1) * dt * 1.4;
          s.x += Math.cos(s.a) * s.v * dt;
          s.y += Math.sin(s.a) * s.v * dt;
          // Off the rails of the floor, and off each other: bounce.
          if (Math.abs(s.x - cx) > BC.w / 2 - 12 || Math.abs(s.y - cy) > BC.h / 2 - 10) {
            s.a = Math.atan2(cy - s.y, cx - s.x) + randomBetween(-0.6, 0.6);
            s.x = clamp(s.x, BC.x + 12, BC.x + BC.w - 12);
            s.y = clamp(s.y, BC.y + 10, BC.y + BC.h - 10);
          }
          for (let j = 0; j < i; j++) {
            const o = bumperState[j];
            if (Math.hypot(o.x - s.x, o.y - s.y) < 9) {
              s.a += Math.PI * 0.8;
              o.a -= Math.PI * 0.7;
            }
          }
          bumperCars.setMatrixAt(i, jetMatrix.compose(parkV.set(s.x, 3.4, s.y), pq.setFromAxisAngle(parkUpAxis, -s.a), ps.set(1, 1, 1)));
          bumperPoles.setMatrixAt(i, jetMatrix.compose(parkV.set(s.x - Math.cos(s.a) * 3, 18, s.y - Math.sin(s.a) * 3), pq.identity(), ps.set(0.3, 28, 0.3)));
        }
        bumperCars.instanceMatrix.needsUpdate = true;
        bumperPoles.instanceMatrix.needsUpdate = true;
      }
      // ---- Food court (souk), kiosks and stalls --------------------------------------
      {
        const f = PIER.foodCourt,
          b = parkParts();
        b.box(parkMats.sand, parkPlaced(f.x + f.w / 2, f.y + f.h / 2, 15, f.w, 30, f.h));
        for (let i = 0; i < 7; i++) {
          const x = f.x + 16 + i * ((f.w - 32) / 6);
          b.box(parkMats.seat, parkPlaced(x, f.y + f.h + 0.6, 11, 16, 22, 1));
          b.box(i % 2 ? parkMats.canvasRed : parkMats.canvasWhite, parkPlaced(x, f.y + f.h + 7, 23, 22, 1, 14));
          if (i % 2 === 0) b.add(parkMats.turquoise, parkDomeGeo, parkPlaced(x, f.y + f.h / 2, 30, 14, 14, 14));
        }
        for (const k of parkKiosks()) {
          const games = k.kind === 'games',
            h = games ? 20 : 14;
          b.box(games ? parkMats.cream : parkMats.white, parkPlaced(k.x, k.y, h / 2, k.w, h, k.h));
          b.box(k.kind === 'bar' || k.kind === 'dates' ? parkMats.wood : parkMats.canvasRed, parkPlaced(k.x, k.y + k.h / 2 + 4, h + 1, k.w + 6, 1, 10));
          b.box(parkMats.canvasWhite, parkPlaced(k.x, k.y, h + 3, k.w + 2, 4, k.h + 2));
          if (games) for (let i = 0; i < 6; i++) b.box([parkMats.red, parkMats.turquoise, parkMats.gold][i % 3], parkPlaced(k.x - k.w / 2 + 6 + i * 9.6, k.y + k.h / 2 + 0.8, 12, 5, 5, 1));
          parkBulbs.add(k.x, k.y + k.h / 2 + 6, h + 2, 4, '#ffd79a', k.x);
        }
        // Bus shelter by the car park.
        const bs = PIER.busStop;
        b.box(parkMats.glassDark, parkPlaced(bs.x, bs.y - 6, 7, 30, 14, 1));
        b.box(parkMats.white, parkPlaced(bs.x, bs.y, 15, 34, 1.2, 14));
        for (const dx of [-15, 15]) b.add(parkMats.steel, parkThinGeo, parkBetween(parkP3(bs.x + dx, bs.y + 5, 0), parkP3(bs.x + dx, bs.y + 5, 15), 0.6));
        b.add(parkMats.steel, parkThinGeo, parkBetween(parkP3(bs.x + 20, bs.y + 6, 0), parkP3(bs.x + 20, bs.y + 6, 22), 0.5));
        b.box(parkMats.gold, parkPlaced(bs.x + 20, bs.y + 6, 22, 6, 6, 0.6));
        b.flush(parkRoot, 'souk and kiosks');
      }
      // ---- Palms and lamps -------------------------------------------------------------
      {
        const palms = parkPalms(),
          trunkGeo = new Three.CylinderGeometry(1.2, 2, 30, 7, 5);
        trunkGeo.translate(0, 15, 0);
        // A gentle lean: bend the trunk's upper rings.
        const tp = trunkGeo.attributes.position;
        for (let i = 0; i < tp.count; i++) tp.setX(i, tp.getX(i) + Math.pow(tp.getY(i) / 30, 2) * 3);
        trunkGeo.computeVertexNormals();
        const crown = parkParts();
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * TAU,
            verts = [];
          for (let j = 0; j < 7; j++) {
            const d = (j / 6) * 20,
              h = 31 + Math.sin((j / 6) * Math.PI) * 4 - (j / 6) * (8 + (k % 3) * 3),
              w = Math.sin((j / 6) * Math.PI) * 3.4;
            verts.push(3 + Math.cos(a) * d - Math.sin(a) * w, h, Math.sin(a) * d + Math.cos(a) * w, 3 + Math.cos(a) * d + Math.sin(a) * w, h, Math.sin(a) * d - Math.cos(a) * w);
          }
          const geo = new Three.BufferGeometry();
          geo.setAttribute('position', new Three.Float32BufferAttribute(verts, 3));
          const idx = [];
          for (let j = 0; j < 6; j++) idx.push(j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 1, j * 2 + 3, j * 2 + 2);
          geo.setIndex(idx);
          geo.computeVertexNormals();
          crown.add(palmFrondMaterial, geo, new Three.Matrix4());
        }
        crown.add(palmTrunkMaterial, sphereGeo, parkPlaced(3, 0, 30.5, 2.6, 2.6, 2.6));
        const crownMeshes = crown.flush(new Three.Group(), 'palm crown');
        const trunks = new Three.InstancedMesh(trunkGeo, palmTrunkMaterial, palms.length),
          crowns = crownMeshes.map((m) => new Three.InstancedMesh(m.geometry, m.material, palms.length)),
          m4 = new Three.Matrix4();
        palms.forEach((p, i) => {
          m4.compose(parkV.set(p.x, 0, p.y), pq.setFromAxisAngle(parkUpAxis, (p.x * 13 + p.y * 7) % TAU), ps.set(p.s, p.s, p.s));
          trunks.setMatrixAt(i, m4);
          for (const c of crowns) c.setMatrixAt(i, m4);
        });
        for (const m of [trunks, ...crowns]) {
          m.castShadow = true;
          m.receiveShadow = true;
          m.userData.dynamic = true;
          m.name = 'park palms';
          parkRoot.add(m);
        }
        // Lamp posts: bronze posts with lantern heads along the promenades.
        const spots = [];
        for (const s of parkPathSegments()) {
          const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]),
            nx = (s.b[0] - s.a[0]) / len,
            ny = (s.b[1] - s.a[1]) / len;
          for (let d = 10; d < len; d += 58) {
            const side = Math.floor(d / 58) % 2 ? 1 : -1,
              x = s.a[0] + nx * d - ny * side * (s.w / 2 + 3),
              y = s.a[1] + ny * d + nx * side * (s.w / 2 + 3);
            if (!parkBlocked(x, y, 3) && spots.every((o) => Math.hypot(o[0] - x, o[1] - y) > 30)) spots.push([x, y]);
          }
        }
        const posts = new Three.InstancedMesh(parkThinGeo, parkMats.darkSteel, spots.length),
          heads = new Three.InstancedMesh(new Three.SphereGeometry(1, 10, 8), parkMats.lampHead, spots.length);
        spots.forEach(([x, y], i) => {
          posts.setMatrixAt(i, m4.compose(parkV.set(x, 11, y), pq.identity(), ps.set(0.7, 22, 0.7)));
          heads.setMatrixAt(i, m4.compose(parkV.set(x, 23.5, y), pq.identity(), ps.set(2.2, 3, 2.2)));
          parkBulbs.add(x, y, 23.5, 7, '#ffdca0');
        });
        for (const m of [posts, heads]) {
          m.castShadow = true;
          m.userData.dynamic = true;
          m.name = 'park lamps';
          parkRoot.add(m);
        }
        parkLampSpots.push(...spots);
      }
      // ---- Night light on the ground ---------------------------------------------------
      /**
       * The island lies outside the city's night light map (lighting3d.js), so it
       * carries its own: warm pools under every lamp, colour spill round the rides,
       * the lagoon's glow and the hotel's forecourt, painted once and laid over the
       * ground as an additive sheet whose strength follows the night.
       */
      const parkNightSheet = (() => {
        const t = PARK_TILE,
          scale = 0.25,
          c = document.createElement('canvas');
        c.width = Math.round(t.w * scale);
        c.height = Math.round(t.h * scale);
        const g = c.getContext('2d'),
          pool = (x, y, r, color, a) => {
            const px = (x - t.x) * scale,
              py = (y - t.y) * scale,
              gr = g.createRadialGradient(px, py, 0, px, py, r * scale);
            gr.addColorStop(0, color.replace('A', a));
            gr.addColorStop(0.4, color.replace('A', a * 0.5));
            gr.addColorStop(1, color.replace('A', 0));
            g.fillStyle = gr;
            g.fillRect(px - r * scale, py - r * scale, r * 2 * scale, r * 2 * scale);
          };
        g.fillStyle = '#000';
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'lighter';
        for (const [x, y] of parkLampSpots) pool(x, y, 48, 'rgba(255,200,130,A)', 0.55);
        pool(LAG.x, LAG.y, 300, 'rgba(90,170,255,A)', 0.3);
        pool(PIER.hotel.x, PIER.hotel.y + 60, 260, 'rgba(255,190,120,A)', 0.35);
        for (const r of [PIER.carousel, PIER.swing, PIER.teacups]) pool(r.x, r.y, 90, 'rgba(255,170,200,A)', 0.4);
        pool(PIER.darkRide.x + 100, PIER.darkRide.y + PIER.darkRide.h + 20, 130, 'rgba(255,150,80,A)', 0.45);
        pool(PIER.bumper.x + 75, PIER.bumper.y + 50, 110, 'rgba(160,120,255,A)', 0.45);
        pool(PIER.gate.x, PIER.gate.y, 170, 'rgba(255,215,150,A)', 0.55);
        pool(PIER.wheel.x, PIER.wheel.y, 200, 'rgba(140,220,255,A)', 0.3);
        pool(PIER.station.x, PIER.station.y, 140, 'rgba(255,200,120,A)', 0.4);
        pool(PIER.beachClub.x + 240, PIER.beachClub.y + 100, 220, 'rgba(120,230,255,A)', 0.3);
        for (let x = PARK_CAR_PARK.x + 40; x < PARK_CAR_PARK.x + PARK_CAR_PARK.w; x += 110) pool(x, PARK_CAR_PARK.y + 55, 70, 'rgba(255,210,150,A)', 0.4);
        const tx = new Three.CanvasTexture(c);
        tx.colorSpace = Three.SRGBColorSpace;
        const sheet = new Three.Mesh(
          new Three.PlaneGeometry(t.w, t.h),
          new Three.MeshBasicMaterial({ map: tx, transparent: true, blending: Three.AdditiveBlending, depthWrite: false, opacity: 0 }),
        );
        sheet.rotation.x = -Math.PI / 2;
        sheet.position.set(t.x + t.w / 2, 0.5, t.y + t.h / 2);
        sheet.userData.dynamic = true;
        sheet.renderOrder = 2;
        sheet.name = 'park night light';
        parkRoot.add(sheet);
        return sheet;
      })();
      parkBulbs.done();
      // ---- Fireworks -------------------------------------------------------------------
      const FIREWORK_SPARKS = 2400,
        fireworkSparks = parkGlowPoints(FIREWORK_SPARKS, 'fireworks'),
        sparkSeen = new Map(),
        sparkColor = new Three.Color();
      for (let i = 0; i < FIREWORK_SPARKS; i++) fireworkSparks.add(0, 0, -500, 0, '#ffffff');
      fireworkSparks.done();
      fireworkSparks.points.material.uniforms.uIntensity.value = 3.5;
      /* Each burst is drawn from its rocket's seed, so no particle state is kept:
         a sphere (or ring, willow, crossette) of sparks that falls and fades. */
      function updateFireworks() {
        const attr = fireworkSparks.points.geometry.attributes,
          rockets = parkShow.rockets;
        let i = 0;
        fireworkSparks.points.visible = rockets.length > 0;
        if (!rockets.length) return;
        for (const r of rockets) {
          if (!r.burst) {
            // The rising trail.
            for (let k = 0; k < 4 && i < FIREWORK_SPARKS; k++, i++) {
              attr.position.setXYZ(i, r.x - r.vx * k * 0.02, r.z - r.vz * k * 0.02, r.y - r.vy * k * 0.02);
              attr.size.setX(i, 5 - k);
              attr.color.setXYZ(i, 1, 0.75, 0.4);
            }
            continue;
          }
          const age = gameTime - r.burst,
            fade = Math.max(0, 1 - age / 3),
            count = r.style === 1 ? 90 : 140;
          sparkColor.setHSL(r.hue, 0.9, 0.6);
          for (let k = 0; k < count && i < FIREWORK_SPARKS; k++, i++) {
            // Fibonacci sphere directions; ring style flattens them.
            const t = (k + 0.5) / count,
              inc = Math.acos(1 - 2 * t),
              az = k * 2.39996 + r.hue * 10,
              speed = r.style === 2 ? 110 : 150,
              dx = Math.sin(inc) * Math.cos(az),
              dy = Math.sin(inc) * Math.sin(az),
              dz = r.style === 1 ? 0.1 * Math.cos(inc) : Math.cos(inc),
              drag = (1 - Math.exp(-age * 1.6)) / 1.6,
              fall = age * age * (r.style === 2 ? 30 : 18);
            attr.position.setXYZ(i, r.x + dx * speed * drag, r.z + dz * speed * drag - fall, r.y + dy * speed * drag);
            const twinkle = r.style === 3 && Math.sin(gameTime * 30 + k) > 0.3 ? 0.2 : 1;
            attr.size.setX(i, (age < 0.08 ? 16 : 6) * fade * twinkle);
            const white = Math.max(0, 1 - age * 4);
            attr.color.setXYZ(i, sparkColor.r + white, sparkColor.g + white, sparkColor.b + white);
          }
        }
        for (let k = i; k < FIREWORK_SPARKS; k++) attr.size.setX(k, 0);
        attr.position.needsUpdate = attr.size.needsUpdate = attr.color.needsUpdate = true;
      }
      // ---- Per frame -------------------------------------------------------------------
      let parkLastTime = 0;
      function updateParkVisuals() {
        const dt = clamp(gameTime - parkLastTime, 0, 0.1);
        parkLastTime = gameTime;
        if (!parkRoot.visible) return;
        const night = nightAmount;
        renderer.getDrawingBufferSize(parkGlowViewport);
        for (const s of parkGlowSets) {
          s.points.material.uniforms.uHalfHeight.value = parkGlowViewport.y / 2;
          s.points.material.uniforms.uTime.value = gameTime;
        }
        parkBulbs.points.material.uniforms.uIntensity.value = night * 2.2;
        parkBulbs.points.visible = night > 0.03;
        parkNightSheet.material.opacity = night * 0.9;
        parkNightSheet.visible = night > 0.03;
        parkMats.lampHead.emissiveIntensity = night * 2;
        hotelFacade.emissiveIntensity = night * 1.3;
        eyePods.material.emissiveIntensity = night * 0.55;
        // The Eye.
        eyeGroup.rotation.z = wheelAngle();
        updateEyeCapsules();
        updateEyeLeds(night);
        // The Falcon.
        updateCoasterTrain(true);
        // Rides.
        carousel.rotation.y = gameTime * 0.5;
        for (let i = 0; i < carouselHorses.length; i++) carouselHorses[i].position.y = 12 + Math.sin(gameTime * 2.4 + i * 1.7) * 3;
        const swingCycle = (gameTime % 50) / 50,
          spin = swingCycle < 0.1 ? swingCycle / 0.1 : swingCycle < 0.75 ? 1 : swingCycle < 0.9 ? 1 - (swingCycle - 0.75) / 0.15 : 0,
          omega = 1.15 * spin;
        swingTop.rotation.y = (swingTop.rotation.y + omega * dt) % TAU;
        swingTop.rotation.x = Math.sin(gameTime * 0.4) * 0.08 * spin;
        const fling = Math.atan((omega * omega * 50) / COASTER_G);
        for (const arm of swingSeats) arm.rotation.z = fling;
        teacups.rotation.y = -gameTime * 0.6;
        for (let i = 0; i < teacupCups.length; i++) teacupCups[i].rotation.y = gameTime * (1.6 + (i % 3) * 0.5);
        // Drop tower: haul up, hold, fall, brake, settle.
        const dp = (gameTime % 26) / 26;
        let dropY;
        if (dp < 0.45) dropY = 12 + (dp / 0.45) * 258;
        else if (dp < 0.55) dropY = 270;
        else if (dp < 0.64) dropY = 270 - Math.pow((dp - 0.55) / 0.09, 2) * 220;
        else if (dp < 0.72) dropY = 50 - ((dp - 0.64) / 0.08) * 38;
        else dropY = 12;
        dropCar.position.set(DT.x, dropY, DT.y);
        if (dp > 0.55 && dp < 0.6 && !updateParkVisuals.dropScreamed) {
          updateParkVisuals.dropScreamed = true;
          parkScream(DT.x, DT.y, 0.9);
        }
        if (dp < 0.5) updateParkVisuals.dropScreamed = false;
        // The tower's chaser runs up while the car climbs.
        if (night > 0.03) {
          const col = parkBulbs.points.geometry.attributes.color;
          for (let k = 0; k < dropLeds.length; k++) {
            const on = (k - Math.floor(gameTime * 12)) % 10 === 0 || (k * 8 + 10 < dropY + 6 && k * 8 + 10 > dropY - 6);
            col.setXYZ(dropLeds[k], on ? 1 : 0.15, on ? 0.35 : 0.1, on ? 0.9 : 0.25);
          }
          col.needsUpdate = true;
        }
        updateFlume(dt);
        updateBumpers(dt);
        updateFountain(night);
        updateFireworks();
      }
      // ---- Ride cameras ----------------------------------------------------------------
      /**
       * While the player rides, the view is the perspective flight camera placed
       * on the ride: on the Falcon a chase view over the train (up follows the
       * track halfway, so loops and rolls turn the horizon), the front seat
       * (fully with the track), or a trackside camera that follows the train; on
       * the Eye the view from the capsule over the island and the city, or the
       * wheel seen from outside. E cycles the views. Called right after the
       * street/flight camera is set up each frame (render3d.js).
       */
      const rideCam = { pos: new Three.Vector3(), look: new Three.Vector3(), up: new Three.Vector3(0, 1, 0), ready: false },
        rideA = parkNewFrame3(),
        rideB = parkNewFrame3(),
        parkWorldUp = new Three.Vector3(0, 1, 0),
        TRACKSIDE = [
          [2300, -6250, 60],
          [1790, -6600, 40],
          [2150, -7030, 30],
          [2700, -7000, 90],
          [3150, -6520, 40],
          [2700, -6200, 50],
          [2000, -5900, 30],
          [2800, -5780, 40],
        ];
      function updateParkCamera(deltaSeconds) {
        const ride = player.coaster;
        if (!ride) {
          rideCam.ready = false;
          return false;
        }
        const target = new Three.Vector3(),
          look = new Three.Vector3(),
          up = new Three.Vector3();
        let fov = 60;
        if (ride.kind === 'wheel') {
          wheelCapsule(ride.capsule, podSpot);
          if (ride.view === 1) {
            // Outside: a slow orbit that keeps the whole wheel in frame.
            const a = gameTime * 0.05;
            target.set(EYE.x + Math.sin(a) * 900, EYE.hub + 120, EYE.y + Math.cos(a) * 900 + 300);
            look.set(EYE.x, EYE.hub, EYE.y);
            fov = 55;
          } else {
            // Inside the capsule, looking out across the island and the sound.
            const pan = Math.sin(gameTime * 0.05) * 1.1;
            target.set(podSpot.x, podSpot.z + 2, podSpot.y + 10);
            look.set(podSpot.x + Math.sin(pan) * 400, podSpot.z - 110, podSpot.y + Math.cos(pan) * 400 + 200);
            fov = 65;
          }
          up.copy(parkWorldUp);
        } else {
          const t = coasterTrain.t;
          if (ride.view === 1) {
            // Front row of the front car, over the falcon's head.
            coasterFrame3(t + 2, rideA);
            coasterFrame3(t + 22, rideB);
            target.copy(rideA.p).addScaledVector(rideA.u, 9.6).addScaledVector(rideA.s, -1.5);
            look.copy(rideB.p).addScaledVector(rideB.u, 7);
            up.copy(rideA.u);
            fov = 75;
          } else if (ride.view === 2) {
            // Trackside: the nearest of a set of cameras round the circuit.
            coasterFrame3(t - COASTER_CAR_GAP * 3, rideA);
            let best = TRACKSIDE[0],
              bestD = Infinity;
            for (const c of TRACKSIDE) {
              const d = Math.hypot(c[0] - rideA.p.x, c[1] - rideA.p.z);
              if (d < bestD) {
                bestD = d;
                best = c;
              }
            }
            target.set(best[0], best[2], best[1]);
            look.copy(rideA.p);
            up.copy(parkWorldUp);
            fov = clamp(8000 / Math.max(80, bestD), 25, 70);
          } else {
            // Chase: behind and above the front of the train.
            coasterFrame3(t - COASTER_CAR_GAP * COASTER_CARS - 26, rideA);
            coasterFrame3(t + 30, rideB);
            target.copy(rideA.p).addScaledVector(rideA.u, 22).addScaledVector(parkWorldUp, 8);
            look.copy(rideB.p).addScaledVector(rideB.u, 6);
            up.copy(rideA.u).lerp(parkWorldUp, 0.5).normalize();
            fov = 68;
          }
        }
        if (!rideCam.ready || rideCam.pos.distanceTo(target) > 400) {
          rideCam.pos.copy(target);
          rideCam.look.copy(look);
          rideCam.up.copy(up);
          rideCam.ready = true;
        } else {
          const k = 1 - Math.exp(-deltaSeconds * (ride.view === 1 ? 30 : 9));
          rideCam.pos.lerp(target, k);
          rideCam.look.lerp(look, k);
          rideCam.up.lerp(up, k).normalize();
        }
        camera = flightCamera;
        flightViewActive = true;
        flightCamera.fov = fov;
        flightCamera.aspect = viewportWidth / viewportHeight;
        flightCamera.near = 1.5;
        flightCamera.far = 24000;
        flightCamera.position.copy(rideCam.pos);
        flightCamera.up.copy(rideCam.up);
        flightCamera.lookAt(rideCam.look);
        flightCamera.updateProjectionMatrix();
        flightCamera.updateMatrixWorld(true);
        flightCamera.up.set(0, 1, 0);
        // What the renderer considers in view: the park and a good way beyond.
        viewCenter.x = (rideCam.look.x + rideCam.pos.x) / 2;
        viewCenter.y = (rideCam.look.z + rideCam.pos.z) / 2;
        viewReach = 2600;
        viewZoom = 0.5;
        viewGroundDistance = 700;
        scene.fog.near = 900;
        scene.fog.density = STREET_FOG_DENSITY * 0.8;
        return true;
      }
      // END SUBSYSTEM: src/themepark3d.js
