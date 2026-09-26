      const POLICE_FONT = '"Arial Narrow", "Liberation Sans Narrow", Arial, "Liberation Sans", Helvetica, sans-serif',
        // Share of the livery canvas (from the bottom) kept for the panel swatches.
        POLICE_SWATCH_BAND = 0.125,
        POLICE_SWATCH = { hood: 0, roof: 1, door: 2, trunk: 3, pillar: 4, base: 5, black: 6, accent: 7 },
        POLICE_RED = '#ff2d22',
        POLICE_BLUE = '#2f62ff',
        POLICE_WHITE = '#fff3e2',
        POLICE_AMBER = '#ffa42a';
      /*
       * Bodies. Lengths along the car are fractions of its length l (x forward),
       * widths fractions of the body width w (0.87 of the collider's, as every car),
       * heights in world units. `section` is half the cross-section from the
       * underside to the roof line centre as [height fraction, width fraction];
       * `profile` scales it along the car: [t, width factor, top height].
       * `glass` is the glasshouse: base and roof heights, the windscreen foot (xf)
       * and top (rf), the rear glass foot (xb) and top (rb), half widths at the
       * base (wb) and roof (wt), outward bow of the side glass, forward bulge of
       * the windscreen foot, roof arch and the side pillars ([s, width, 'paint' or
       * 'black'], s = 0 at the rear glass, 1 at the windscreen).
       */
      const POLICE_DRAW_SCALE = 0.8;
      const POLICE_BODIES = {
        charger: {
          name: 'charger',
          kind: 'sedan',
          yb: 3.4,
          h: 9.1,
          section: [[0, 0.8], [0.14, 0.95], [0.34, 1], [0.64, 1], [0.8, 0.98], [0.9, 0.93], [0.96, 0.8], [0.99, 0.56], [1, 0.28], [1, 0]],
          profile: [
            [-0.5, 0.7, 7.5], [-0.49, 0.83, 8.3], [-0.47, 0.915, 8.85], [-0.44, 0.96, 9.08], [-0.39, 0.99, 9.16], [-0.3, 1.028, 9.16],
            [-0.23, 1, 9.12], [0.19, 1, 9.1], [0.26, 1.028, 9.06], [0.34, 1.015, 9.0], [0.4, 0.985, 8.88], [0.45, 0.94, 8.6],
            [0.475, 0.885, 8.2], [0.49, 0.815, 7.8], [0.5, 0.69, 7.1],
          ],
          glass: { base: 8.45, roof: 14.1, xf: 0.25, xb: -0.36, rf: 0.04, rb: -0.2, wb: 0.415, wt: 0.315, bow: 0.018, bulge: 0.9, arch: 0.55, pillars: [[0.47, 1.1, 'black'], [0, 2.6, 'paint']] },
          wheel: { r: 4.3, width: 2.7, x: 0.3, z: 0.46 },
          hoodTilt: -0.028,
          head: [0.48, 7.85, 0.33, 1.1, 0.95, 0.24],
          tail: [-0.492, 8.15, 0.215, 0.5, 0.75, 0.43],
          bumpers: [[0.488, 4.95, 1.2, 2.1, 0.84], [-0.494, 5.25, 1.0, 2.0, 0.86]],
          spoiler: -0.468,
          trunk: -0.43,
        },
        crownvic: {
          name: 'crownvic',
          kind: 'sedan',
          yb: 3.5,
          h: 9.3,
          section: [[0, 0.84], [0.12, 0.97], [0.3, 1], [0.74, 1], [0.87, 0.975], [0.94, 0.91], [0.98, 0.76], [1, 0.5], [1, 0.25], [1, 0]],
          profile: [
            [-0.5, 0.8, 8.5], [-0.49, 0.9, 9.05], [-0.47, 0.96, 9.28], [-0.42, 0.99, 9.32], [-0.3, 1.022, 9.34], [-0.22, 1, 9.3], [0.2, 1, 9.3],
            [0.3, 1.022, 9.26], [0.42, 0.985, 9.08], [0.47, 0.94, 8.8], [0.49, 0.88, 8.45], [0.5, 0.8, 8.0],
          ],
          glass: { base: 8.75, roof: 14.6, xf: 0.24, xb: -0.265, rf: 0.085, rb: -0.17, wb: 0.415, wt: 0.335, bow: 0.012, bulge: 0.6, arch: 0.42, pillars: [[0.5, 1.2, 'black'], [0, 1.9, 'paint']] },
          wheel: { r: 4.3, width: 2.7, x: 0.3, z: 0.46 },
          hoodTilt: -0.012,
          head: [0.488, 7.75, 0.325, 0.7, 1.45, 0.22],
          tail: [-0.494, 8.25, 0.33, 0.5, 1.55, 0.2],
          bumpers: [[0.49, 5.0, 1.2, 2.2, 0.86], [-0.494, 5.2, 1.1, 2.1, 0.88]],
          chrome: true,
          trunk: -0.4,
        },
        utility: {
          name: 'utility',
          kind: 'suv',
          yb: 3.8,
          h: 10.3,
          section: [[0, 0.82], [0.12, 0.95], [0.3, 1], [0.72, 1], [0.86, 0.975], [0.94, 0.92], [0.98, 0.8], [1, 0.55], [1, 0.25], [1, 0]],
          profile: [
            [-0.5, 0.82, 9.7], [-0.49, 0.92, 10.15], [-0.47, 0.97, 10.32], [-0.4, 0.995, 10.36], [-0.3, 1.03, 10.36], [-0.2, 1, 10.3],
            [0.2, 1, 10.3], [0.3, 1.03, 10.24], [0.38, 1.005, 10.1], [0.44, 0.97, 9.7], [0.475, 0.915, 9.2], [0.49, 0.86, 8.85], [0.5, 0.76, 8.4],
          ],
          glass: { base: 9.75, roof: 17.9, xf: 0.26, xb: -0.478, rf: 0.065, rb: -0.445, wb: 0.425, wt: 0.345, bow: 0.014, bulge: 0.8, arch: 0.42, pillars: [[0.53, 1.1, 'black'], [0.2, 1.3, 'black'], [0, 2.2, 'paint']] },
          wheel: { r: 4.6, width: 2.9, x: 0.3, z: 0.455 },
          hoodTilt: -0.05,
          head: [0.474, 9.0, 0.33, 1.1, 1.0, 0.23],
          tail: [-0.494, 9.55, 0.36, 0.5, 1.15, 0.2],
          bumpers: [[0.487, 5.3, 1.3, 2.4, 0.86], [-0.494, 5.5, 1.1, 2.4, 0.88]],
          rails: true,
        },
        tahoe: {
          name: 'tahoe',
          kind: 'suv',
          yb: 4.2,
          h: 11.1,
          section: [[0, 0.86], [0.1, 0.97], [0.28, 1], [0.78, 1], [0.9, 0.975], [0.95, 0.93], [0.985, 0.82], [1, 0.58], [1, 0.26], [1, 0]],
          profile: [
            [-0.5, 0.86, 10.6], [-0.49, 0.94, 11.0], [-0.47, 0.98, 11.12], [-0.3, 1.025, 11.15], [-0.2, 1, 11.1], [0.2, 1, 11.1],
            [0.3, 1.025, 11.05], [0.42, 0.995, 10.9], [0.47, 0.95, 10.4], [0.49, 0.9, 10.0], [0.5, 0.82, 9.6],
          ],
          glass: { base: 10.55, roof: 19.2, xf: 0.255, xb: -0.482, rf: 0.07, rb: -0.458, wb: 0.44, wt: 0.38, bow: 0.012, bulge: 0.55, arch: 0.35, pillars: [[0.55, 1.2, 'black'], [0.22, 1.3, 'black'], [0, 2.4, 'paint']] },
          wheel: { r: 4.9, width: 3.0, x: 0.31, z: 0.45 },
          hoodTilt: -0.02,
          head: [0.488, 9.5, 0.33, 0.8, 1.4, 0.24],
          tail: [-0.494, 10.3, 0.4, 0.5, 2.6, 0.12],
          bumpers: [[0.49, 5.8, 1.3, 2.6, 0.9], [-0.494, 5.9, 1.2, 2.4, 0.9]],
          rails: true,
        },
        bearcat: {
          name: 'bearcat',
          kind: 'bearcat',
          yb: 4.4,
          h: 12.4,
          uvTop: 23,
          section: [[0, 0.88], [0.05, 0.97], [0.12, 1], [0.9, 1], [0.955, 0.95], [0.985, 0.85], [1, 0.62], [1, 0.3], [1, 0]],
          profile: [
            [-0.5, 0.97, 22.5], [-0.49, 1, 23], [0.12, 1, 23], [0.135, 0.985, 22.6], [0.205, 0.935, 13.1], [0.215, 0.93, 12.7],
            [0.44, 0.93, 12.3], [0.48, 0.905, 11.5], [0.5, 0.87, 10.3],
          ],
          // The armoured windows sit on the slab (policeBearcatGlass); these
          // numbers only place the wipers and the lightbar.
          glass: { base: 14, roof: 21.6, xf: 0.198, xb: -0.1, rf: 0.142, rb: -0.1, wb: 0.42, wt: 0.42, bow: 0, bulge: 0, arch: 0 },
          wheel: { r: 5.4, width: 3.6, x: 0.29, z: 0.44 },
          hoodTilt: -0.018,
          head: [0.494, 9.9, 0.35, 0.6, 1.7, 0.14],
          tail: [-0.521, 5.0, 0.39, 0.4, 1.1, 0.1],
          bumpers: [[0.5, 6.4, 1.6, 2.8, 0.96], [-0.5, 5.0, 1.0, 2.2, 0.96]],
        },
      };
      const POLICE_LIVERIES = {
        bw: {
          // Black and white: black body, white doors and roof, SOUTH COAST POLICE and a gold star.
          base: '#0d0e11',
          swatches: ['#0d0e11', '#f1f2ef', '#f1f2ef', '#0d0e11', '#f1f2ef', '#0d0e11', '#0a0b0d', '#c9a44a'],
          roofDigits: '#0c0d10',
          sideDigits: '#eeeeea',
        },
        modern: {
          // White with a navy and sky-blue swoosh edged with reflective silver, black pillars.
          base: '#eff1f2',
          swatches: ['#eff1f2', '#eff1f2', '#eff1f2', '#eff1f2', '#0d0e11', '#eff1f2', '#0a0b0d', '#13295c'],
          roofDigits: '#12275a',
          sideDigits: '#12275a',
        },
        sheriff: {
          // The county's green and white, a gold stripe and star: SHERIFF.
          base: '#f0f0ec',
          swatches: ['#1d4a33', '#f0f0ec', '#f0f0ec', '#1d4a33', '#f0f0ec', '#f0f0ec', '#0a0b0d', '#c9a44a'],
          roofDigits: '#173d2a',
          sideDigits: '#173d2a',
        },
        swat: {
          // Navy armour with a grey reflective band: POLICE, SWAT.
          base: '#18202c',
          swatches: ['#18202c', '#18202c', '#18202c', '#18202c', '#141a24', '#18202c', '#0a0b0d', '#8d98a6'],
          roofDigits: '#eef0ec',
          sideDigits: '#eef0ec',
        },
      };
      const POLICE_PATROL_BODIES = ['charger', 'charger', 'utility', 'utility', 'crownvic'],
        UNMARKED_PAINTS = ['#2a2f35', '#1e2227', '#3b3f3c', '#41454d', '#252f3c', '#4a2a2c'];
      // ---- Which model ---------------------------------------------------------------
      // Looks are cached per vehicle (never stored on the vehicle object: the
      // physics keeps every vehicle one object layout).
      const policeLooks = new WeakMap();
      function policeLookFor(vehicle) {
        let look = policeLooks.get(vehicle);
        if (look === undefined) {
          look = pickPoliceLook(vehicle);
          policeLooks.set(vehicle, look);
        }
        return look;
      }
      function pickPoliceLook(vehicle) {
        const hash = Math.imul((vehicle.id | 0) + 0x9e37, 0x85ebca6b) >>> 0,
          pick = (list, shift) => list[((hash >>> shift) & 0xffff) % list.length];
        let body, livery;
        // DeadEndCity.policeLineup() names the model and livery outright.
        if (vehicle.policeLook) ({ body, livery } = vehicle.policeLook);
        else if (vehicle.lawUnit === 'swat') [body, livery] = ['bearcat', 'swat'];
        else if (vehicle.lawUnit === 'fed') [body, livery] = ['tahoe', 'unmarked'];
        else if (vehicle.type === 'police') {
          const county = vehicle.x > CITY_SIZE || vehicle.y > CITY_SIZE;
          body = pick(POLICE_PATROL_BODIES, 3);
          livery = county ? 'sheriff' : !vehicle.blockade && ((hash >>> 19) & 0xff) % 9 === 0 ? 'unmarked' : (hash >>> 11) & 1 ? 'bw' : 'modern';
          if (livery === 'unmarked' && body === 'utility') body = 'charger';
        } else return null;
        if (!POLICE_BODIES[body]) body = 'charger';
        const unmarked = livery === 'unmarked' || !POLICE_LIVERIES[livery];
        return {
          body,
          livery: unmarked ? 'unmarked' : livery,
          unmarked,
          equipment: livery === 'swat' ? 'swat' : unmarked ? 'unmarked' : 'marked',
          paint: unmarked ? (body === 'tahoe' ? '#1c2026' : pick(UNMARKED_PAINTS, 7)) : '#ffffff',
          unit: livery === 'swat' ? 'S' + (1 + (hash % 9)) : String((livery === 'sheriff' ? 20 : 10) + (hash % 79)),
          key: 'police:' + body + ':' + (unmarked ? 'unmarked' : livery),
        };
      }
      // The body-impostor pool a vehicle belongs to (flight-view3d.js), or null.
      function policeImpostorKey(c) {
        if (c.type !== 'police' && !c.lawUnit && !c.policeLook) return null;
        const look = policeLookFor(c);
        return look ? look.key : null;
      }
      // ---- Shared materials and shapes ---------------------------------------------
      const policeTrimMaterial = new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.52, metalness: 0.25 }),
        policeBrightMaterial = new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.9 }),
        policeWheelMaterial = new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.72 }),
        policeBumperMaterial = new Three.MeshStandardMaterial({ color: '#16181b', roughness: 0.62, metalness: 0.15 }),
        // Dark tinted glass with a strong sky reflection (damage3d.js falls back to it
        // for an intact pane through the model's `glass`).
        policeGlass = new Three.MeshStandardMaterial({ color: '#141f29', roughness: 0.05, metalness: 0.88, envMapIntensity: 1.6 }),
        // A headlamp lens with the lamp off (the dark half of the wig-wag).
        policeLampOff = new Three.MeshStandardMaterial({ color: '#b9bec2', roughness: 0.12, metalness: 0.7 }),
        // The bright half of the wig-wag: white, scaled with the light gain each frame.
        policeWigwagLamp = new Three.MeshBasicMaterial({ color: '#ffffff' }),
        // Halo colours for the flashing lights (anchor sprites are never drawn).
        policeHaloMaterials = {
          red: new Three.SpriteMaterial({ color: '#ff3a2c' }),
          blue: new Three.SpriteMaterial({ color: '#3f6cff' }),
          white: new Three.SpriteMaterial({ color: '#fff0dc' }),
        },
        // Scene light of a fully lit segment (bloom threshold 1.6); raised at night.
        policeLightGain = { value: 3.4 };
      let policeResourcesClaimed = false,
        policeShapes = null;
      // Shared resources must survive pruneModels(); registered on first use
      // (sharedMaterials is declared after this file).
      function claimPoliceResources() {
        if (policeResourcesClaimed) return;
        policeResourcesClaimed = true;
        for (const m of [policeTrimMaterial, policeBrightMaterial, policeWheelMaterial, policeBumperMaterial, policeGlass, policeLampOff, policeWigwagLamp, ...Object.values(policeHaloMaterials)])
          sharedMaterials.add(m);
      }
      function policeShapeKit() {
        if (policeShapes) return policeShapes;
        policeShapes = {
          cylinder: new Three.CylinderGeometry(1, 1, 1, 16),
          cylinderLow: new Three.CylinderGeometry(1, 1, 1, 8),
          sphere: new Three.SphereGeometry(1, 12, 8),
          dome: new Three.SphereGeometry(1, 16, 5, 0, TAU, 0, Math.PI / 2),
          arch: new Three.TorusGeometry(1, 0.075, 6, 18, Math.PI),
          halfDisc: new Three.CircleGeometry(1, 18, 0, Math.PI),
          disc: new Three.CircleGeometry(1, 12),
        };
        return policeShapes;
      }
      // A bar with rounded long edges: a `depth` × `height` rounded rectangle
      // extruded `length` along z, centred on the origin (merge input only).
      const policeBars = new Map();
      function roundedBar(length, height, depth, radius) {
        const key = [length, height, depth, radius].map((v) => v.toFixed(3)).join(':');
        let geo = policeBars.get(key);
        if (geo) return geo;
        const bevel = Math.min(radius, length / 4, height / 3, depth / 3),
          grow = bevel * 0.8,
          x = depth / 2 - grow,
          y = height / 2 - grow,
          r = Math.max(0.01, Math.min(radius - grow, x * 0.9, y * 0.9)),
          shape = new Three.Shape();
        shape.moveTo(-x + r, -y);
        shape.lineTo(x - r, -y);
        shape.quadraticCurveTo(x, -y, x, -y + r);
        shape.lineTo(x, y - r);
        shape.quadraticCurveTo(x, y, x - r, y);
        shape.lineTo(-x + r, y);
        shape.quadraticCurveTo(-x, y, -x, y - r);
        shape.lineTo(-x, -y + r);
        shape.quadraticCurveTo(-x, -y, -x + r, -y);
        geo = new Three.ExtrudeGeometry(shape, {
          depth: Math.max(0.01, length - bevel * 2),
          bevelEnabled: true,
          bevelSize: grow,
          bevelThickness: bevel,
          bevelSegments: 2,
          curveSegments: 3,
        });
        geo.translate(0, 0, -Math.max(0.01, length - bevel * 2) / 2);
        policeBars.set(key, geo);
        return geo;
      }
      // ---- Merging kit -----------------------------------------------------------------
      /*
       * Static parts are accumulated into one vertex set per material (position,
       * normal, uv, colour, light channel) and built once per body and equipment.
       */
      const policeMatrix = new Three.Matrix4(),
        policeNormalMatrix = new Three.Matrix3(),
        policeVector = new Three.Vector3(),
        policeQuaternion = new Three.Quaternion(),
        policeEuler = new Three.Euler(),
        policeScale = new Three.Vector3(),
        policePosition = new Three.Vector3(),
        policeColor = new Three.Color(),
        policeAxisX = new Three.Vector3(),
        policeAxisY = new Three.Vector3(),
        policeAxisZ = new Three.Vector3(),
        policeUp = new Three.Vector3();
      function policeSet() {
        return { position: [], normal: [], uv: [], color: [], channel: [], index: [], count: 0 };
      }
      function policeAddMatrix(set, geo, matrix, color, options) {
        policeNormalMatrix.getNormalMatrix(matrix);
        policeColor.set(color);
        const pos = geo.attributes.position,
          nor = geo.attributes.normal,
          uv = geo.attributes.uv,
          base = set.count,
          fixedUv = options?.uv,
          channel = options?.channel || 0;
        for (let i = 0; i < pos.count; i++) {
          policeVector.fromBufferAttribute(pos, i).applyMatrix4(matrix);
          set.position.push(policeVector.x, policeVector.y, policeVector.z);
          policeVector.fromBufferAttribute(nor, i).applyMatrix3(policeNormalMatrix).normalize();
          set.normal.push(policeVector.x, policeVector.y, policeVector.z);
          if (fixedUv) set.uv.push(fixedUv[0], fixedUv[1]);
          else set.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
          set.color.push(policeColor.r, policeColor.g, policeColor.b);
          set.channel.push(channel);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) set.index.push(base + geo.index.getX(i));
        else for (let i = 0; i < pos.count; i++) set.index.push(base + i);
        set.count += pos.count;
      }
      function policeAdd(set, geo, x, y, z, sx, sy, sz, color, options, rx = 0, ry = 0, rz = 0) {
        policeMatrix.compose(policePosition.set(x, y, z), policeQuaternion.setFromEuler(policeEuler.set(rx, ry, rz)), policeScale.set(sx, sy, sz));
        policeAddMatrix(set, geo, policeMatrix, color, options);
      }
      // A box (or any unit shape) from a to b: `height` along the side of `up`,
      // `depth` across both.
      function policeBeam(set, geo, a, b, height, depth, color, options, up = [0, 1, 0]) {
        policeAxisX.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const length = policeAxisX.length();
        if (length < 1e-4) return;
        policeAxisX.divideScalar(length);
        policeUp.set(up[0], up[1], up[2]);
        policeAxisZ.crossVectors(policeAxisX, policeUp);
        if (policeAxisZ.lengthSq() < 1e-8) policeAxisZ.set(0, 0, 1);
        policeAxisZ.normalize();
        policeAxisY.crossVectors(policeAxisZ, policeAxisX).normalize();
        policeMatrix.makeBasis(policeAxisX.multiplyScalar(length), policeAxisY.multiplyScalar(height), policeAxisZ.multiplyScalar(depth));
        policeMatrix.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        policeAddMatrix(set, geo, policeMatrix, color, options);
      }
      function policeGeometry(set, { colors = true, channels = false } = {}) {
        const g = new Three.BufferGeometry();
        g.setAttribute('position', new Three.Float32BufferAttribute(set.position, 3));
        g.setAttribute('normal', new Three.Float32BufferAttribute(set.normal, 3));
        g.setAttribute('uv', new Three.Float32BufferAttribute(set.uv, 2));
        if (colors) g.setAttribute('color', new Three.Float32BufferAttribute(set.color, 3));
        if (channels) g.setAttribute('lightChannel', new Three.Float32BufferAttribute(set.channel, 1));
        g.setIndex(set.index);
        g.computeBoundingSphere();
        sharedGeometries.add(g);
        return g;
      }
      // Flips any triangle whose normal faces `inward(centroid)` (a point inside the
      // surface), so lofted surfaces face out whatever order they were built in.
      function orientOutward(position, index, inside) {
        const a = new Three.Vector3(),
          b = new Three.Vector3(),
          c = new Three.Vector3(),
          centroid = new Three.Vector3(),
          centre = new Three.Vector3();
        for (let i = 0; i < index.length; i += 3) {
          a.fromArray(position, index[i] * 3);
          b.fromArray(position, index[i + 1] * 3);
          c.fromArray(position, index[i + 2] * 3);
          centroid.copy(a).add(b).add(c).divideScalar(3);
          inside(centroid, centre);
          b.sub(a);
          c.sub(a);
          b.cross(c);
          if (b.dot(centroid.sub(centre)) < 0) {
            const t = index[i + 1];
            index[i + 1] = index[i + 2];
            index[i + 2] = t;
          }
        }
      }
      // A (cols × rows) grid over fn(u, v) -> [x, y, z], u and v in 0..1, with its own
      // vertices and smooth normals, facing away from `inside`.
      function gridGeometry(cols, rows, fn, inside) {
        const position = [],
          uv = [],
          index = [];
        for (let j = 0; j <= rows; j++)
          for (let i = 0; i <= cols; i++) {
            position.push(...fn(i / cols, j / rows));
            uv.push(i / cols, j / rows);
          }
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols; i++) {
            const p = j * (cols + 1) + i,
              q = p + cols + 1;
            index.push(p, p + 1, q, p + 1, q + 1, q);
          }
        orientOutward(position, index, inside);
        const g = new Three.BufferGeometry();
        g.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        g.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
        g.setIndex(index);
        g.computeVertexNormals();
        return g;
      }
      const policeIdentity = new Three.Matrix4();
      // ---- POLICE SHELL ------------------------------------------------------------------
      function policeRing(body) {
        const side = body.section.slice(0, -1);
        return [...side.map(([n, z]) => [n, -z]), [1, 0], ...side.slice().reverse().map(([n, z]) => [n, z])];
      }
      function profileAt(profile, t) {
        if (t <= profile[0][0]) return [profile[0][1], profile[0][2]];
        for (let k = 0; k < profile.length - 1; k++) {
          const a = profile[k],
            b = profile[k + 1];
          if (t <= b[0]) {
            const f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
            return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
          }
        }
        const last = profile[profile.length - 1];
        return [last[1], last[2]];
      }
      // v round the section (arc length at the reference section), above the swatch band.
      function policeRingV(body, w) {
        const ring = policeRing(body),
          top = body.uvTop || body.h,
          points = ring.map(([nh, zf]) => [body.yb + nh * (top - body.yb), (zf * w) / 2]),
          v = [0];
        for (let j = 1; j < points.length; j++)
          v.push(v[j - 1] + Math.hypot(points[j][0] - points[j - 1][0], points[j][1] - points[j - 1][1]));
        const total = v[v.length - 1];
        return v.map((d) => POLICE_SWATCH_BAND + (1 - POLICE_SWATCH_BAND) * (d / total));
      }
      const policeShells = new Map();
      /*
       * The body: the section lofted along the profile (slices closer together at
       * the ends, where cars crumple, and at every profile break), capped at both
       * ends, smooth-shaded, UVs for the livery. Shared until dented, like
       * carShellGeometry().
       */
      function policeShellGeometry(body, l, w) {
        const key = body.name + ':' + l + ':' + w;
        if (policeShells.has(key)) return policeShells.get(key);
        const ring = policeRing(body),
          n = ring.length,
          vs = policeRingV(body, w),
          ts = [];
        for (let i = 0; i <= 30; i++) ts.push(-0.5 * Math.cos((i / 30) * Math.PI));
        for (const p of body.profile) ts.push(p[0]);
        ts.sort((a, b) => a - b);
        const slices = ts.filter((t, i) => i === 0 || t - ts[i - 1] > 0.004);
        const position = [],
          uv = [],
          index = [];
        for (const t of slices) {
          const [wf, top] = profileAt(body.profile, t);
          for (let j = 0; j < n; j++) {
            const [nh, zf] = ring[j];
            position.push(t * l, body.yb + nh * (top - body.yb), (zf * wf * w) / 2);
            uv.push(t + 0.5, vs[j]);
          }
        }
        const count = slices.length;
        for (let k = 0; k < count - 1; k++)
          for (let j = 0; j < n; j++) {
            const a = k * n + j,
              b = k * n + ((j + 1) % n),
              c = (k + 1) * n + ((j + 1) % n),
              d = (k + 1) * n + j;
            index.push(a, b, d, b, c, d);
          }
        // End caps round a centre point.
        for (const [k, u] of [[0, 0], [count - 1, 1]]) {
          const centre = position.length / 3;
          let y = 0;
          for (let j = 0; j < n; j++) y += position[(k * n + j) * 3 + 1];
          position.push(slices[k] * l, y / n, 0);
          uv.push(u, (POLICE_SWATCH_BAND + 1) / 2);
          for (let j = 0; j < n; j++) index.push(centre, k * n + ((j + 1) % n), k * n + j);
        }
        const middle = (body.yb + body.h) / 2;
        orientOutward(position, index, (p, out) => out.set(clamp(p.x, -0.46 * l, 0.46 * l), middle, 0));
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
        geo.setIndex(index);
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        sharedGeometries.add(geo);
        policeShells.set(key, geo);
        return geo;
      }
      // The body's outer half width and top at a point along it (reference section).
      function policeShellAt(body, l, w, x, y) {
        const [wf, top] = profileAt(body.profile, x / l),
          nh = clamp((y - body.yb) / (top - body.yb), 0, 1),
          section = body.section;
        let zf = section[section.length - 1][1];
        for (let k = 0; k < section.length - 1; k++) {
          const [n0, z0] = section[k],
            [n1, z1] = section[k + 1];
          if (nh <= n1) {
            zf = n1 > n0 ? lerpNumber(z0, z1, (nh - n0) / (n1 - n0)) : z1;
            break;
          }
        }
        return { half: (zf * wf * w) / 2, top };
      }
      function lerpNumber(a, b, f) {
        return a + (b - a) * f;
      }
