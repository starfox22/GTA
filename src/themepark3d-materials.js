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
      /**
       * INSTANCED RIDE PARTS
       * Rides move many copies of one small model: carousel horses, swing seats,
       * teacups, flume boats, the Falcon's cars. Each copy is a group of merged
       * meshes, one per material, so each copy cost that many draw calls (well
       * over a hundred for the park, twice with the shadow map). Once built, the
       * copies' meshes are hidden and drawn as instances instead: one
       * InstancedMesh per (part, material), fed each frame from the hidden meshes'
       * world matrices, so the ride code still animates the plain groups.
       * parkRoot sits at the origin, so world matrices are instance matrices.
       */
      const rideInstanceSets = [];
      function instanceRideParts(groups, name) {
        const sets = new Map();
        for (const g of groups) {
          const meshes = [];
          g.traverse((o) => o.isMesh && !o.isInstancedMesh && meshes.push(o));
          meshes.forEach((m, k) => {
            const key = k + '|' + m.material.uuid + '|' + m.geometry.attributes.position.count;
            if (!sets.has(key)) sets.set(key, { geometry: m.geometry, material: m.material, sources: [], owners: [] });
            sets.get(key).sources.push(m);
            sets.get(key).owners.push(g);
            m.visible = false;
          });
        }
        for (const set of sets.values()) {
          const im = new Three.InstancedMesh(set.geometry, set.material, set.sources.length);
          im.name = name;
          im.castShadow = im.receiveShadow = true;
          im.frustumCulled = false;
          im.userData.dynamic = true;
          parkRoot.add(im);
          rideInstanceSets.push({ im, roots: groups, sources: set.sources, owners: set.owners });
        }
      }
      const hiddenRidePart = new Three.Matrix4().makeScale(0, 0, 0);
      function syncRideInstances() {
        const refreshed = new Set();
        for (const set of rideInstanceSets) {
          for (const root of set.roots)
            if (!refreshed.has(root)) {
              refreshed.add(root);
              root.updateWorldMatrix(true, true);
            }
          // A copy its ride code hides (a coaster car off the track) collapses to nothing.
          for (let i = 0; i < set.sources.length; i++) set.im.setMatrixAt(i, set.owners[i].visible ? set.sources[i].matrixWorld : hiddenRidePart);
          set.im.instanceMatrix.needsUpdate = true;
        }
      }
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
          basis.makeBasis(f.t, f.u, f.s).scale(ps.set(6.2, 0.3, 2.6)).setPosition(parkV.copy(f.p).addScaledVector(f.u, -1.2).addScaledVector(f.s, -5.6));
          track.box(parkMats.steel, basis);
          if (i % 6 === 0) {
            a.copy(f.p).addScaledVector(f.s, -7);
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
      const stationRoofMeshes = [];
      {
        const b = parkParts(),
          st = PIER.station,
          x0 = st.x - 70,
          x1 = st.x + 80;
        // Base under the track and the raised boarding platform on its south side.
        b.box(parkMats.concrete, parkPlaced((x0 + x1) / 2, -6450, 9, x1 - x0, 18, 20));
        b.box(parkMats.stone, parkPlaced((x0 + x1) / 2, -6412, 10, x1 - x0, 20, 12));
        b.box(parkMats.cream, parkPlaced((x0 + x1) / 2, -6405, 21, x1 - x0, 2, 26));
        // Wing-shaped roof: gold panels rising to a peak over the track. Its own
        // batch, so the ride camera can cut it away (setStationRoofCut).
        const roof = parkParts();
        for (let i = 0; i < 8; i++) {
          const x = x0 + 8 + i * ((x1 - x0 - 16) / 7);
          for (const [z, dz] of [
            [-6452, -1],
            [-6408, 1],
          ]) {
            roof.add(parkMats.white, parkTubeGeo, parkBetween(parkP3(x, z, 0), parkP3(x, z, 50), 1.4));
            roof.add(parkMats.white, parkTubeGeo, parkBetween(parkP3(x, z, 50), parkP3(x, -6430, 60), 1));
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
          roof.add(parkMats.gold, panel, m);
          m.compose(
            parkP3((x0 + x1) / 2, (z0 + z1) / 2, 55.6),
            new Three.Quaternion().setFromEuler(new Three.Euler(dirY > 0 ? Math.PI / 2 + tilt : Math.PI / 2 - tilt, 0, 0)),
            new Three.Vector3(x1 - x0 + 10, len, 1),
          );
          roof.add(parkMats.white, panel, m);
        }
        stationRoofMeshes.push(...roof.flush(coasterGroup, 'falcon station roof'));
        // Queue hall: a shade canopy on posts over the switchback rails.
        b.box(parkMats.canvasWhite, parkPlaced(2600, -6375, 30, 200, 1.2, 50));
        // Both roofs hide whoever is under them from the police helicopter (air-cover.js).
        registerOverheadCover(2600, -6375, 100, 25, 0, 29, 31, 'queue canopy');
        registerOverheadCover((x0 + x1) / 2, -6430, (x1 - x0) / 2 + 5, 30, 0, 50, 62, 'station roof');
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
        // The sign hangs from the roof and goes with it.
        stationRoofMeshes.push(s, s.userData.backing);
      }
