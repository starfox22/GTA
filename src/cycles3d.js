      // BEGIN SUBSYSTEM: src/cycles3d.js — Bike-share station meshes
      /**
       * Bike-share station meshes
       * Source: src/cycles3d.js
       * Scope: createCityRenderer() closure.
       *
       * SOUTH COAST CYCLE stations (cycles.js BIKE SHARE): a steel dock rack, a
       * city bike in each dock in the teal and white livery, and a payment totem
       * with a backlit map, the brand header and a lit canopy strip at night. The
       * rack, the totem and every bike are breakable props drawn as instances
       * (render3d.js BREAKABLE SCENERY), so a whole station costs a handful of
       * draws per map cell and a car can knock any piece over. Each part is one
       * merged, vertex-coloured geometry (shareGeometry): a bike is a single
       * instance, not twenty meshes.
       *
       * An empty dock's bike is zeroed out of its instances (and put back when
       * the dock fills) by updateBikeShareVisuals, only when cycles.js reports a
       * change (bikeShareVersion); a bike a car knocked over belongs to
       * damage3d.js until the city stands it up again.
       *
       * The share bike's model is designed in SHARE_BIKE_DESIGN units (30 long,
       * wheels at +-10, the proportions of the old city cycle) and drawn scaled
       * to the bicycle's collider length (cycles.js SHARE_BIKE_LENGTH), docked
       * or ridden (makeShareBicycle, used by vehicles3d.js for `shareBike`).
       */
      const SHARE_BIKE_DESIGN = 30,
        shareBikeScale = () => SHARE_BIKE_LENGTH / SHARE_BIKE_DESIGN,
        SHARE_COLORS = {
          teal: BIKE_SHARE_TEAL,
          tealDark: '#0c6b67',
          white: '#eef2ef',
          tyre: '#1b1c1f',
          steel: '#b9c0c2',
          dark: '#2a2e31',
          saddle: '#161719',
          lamp: '#fff3cf',
          tail: '#d6362b',
          led: '#58e98a',
          plinth: '#5b6164',
        };
      /* Merged, vertex-coloured geometry from boxes, rods, rings and discs, all
         in one local frame. Shared low-poly primitives keep a bike near a
         thousand triangles. */
      const shareFlat = new Map(),
        shareRodGeo = new Three.CylinderGeometry(1, 1, 1, 7),
        shareDiscGeo = new Three.CylinderGeometry(1, 1, 1, 12),
        shareUp = new Three.Vector3(0, 1, 0);
      function shareFlatGeometry(geo) {
        if (!shareFlat.has(geo)) shareFlat.set(geo, geo.index ? geo.toNonIndexed() : geo);
        return shareFlat.get(geo);
      }
      function shareGeometry() {
        const positions = [],
          normals = [],
          colors = [],
          matrix = new Three.Matrix4(),
          normalMatrix = new Three.Matrix3(),
          q = new Three.Quaternion(),
          e = new Three.Euler(),
          v = new Three.Vector3(),
          s = new Three.Vector3(),
          color = new Three.Color();
        function add(geo, m, hex) {
          const g = shareFlatGeometry(geo),
            P = g.attributes.position,
            N = g.attributes.normal;
          normalMatrix.getNormalMatrix(m);
          color.set(hex);
          for (let i = 0; i < P.count; i++) {
            v.fromBufferAttribute(P, i).applyMatrix4(m);
            positions.push(v.x, v.y, v.z);
            v.fromBufferAttribute(N, i).applyMatrix3(normalMatrix).normalize();
            normals.push(v.x, v.y, v.z);
            colors.push(color.r, color.g, color.b);
          }
        }
        const api = {
          box(x, y, z, w, h, d, hex, rx = 0, ry = 0, rz = 0) {
            q.setFromEuler(e.set(rx, ry, rz));
            add(boxGeo, matrix.compose(v.set(x, y, z), q, s.set(w, h, d)), hex);
            return api;
          },
          rod(a, b, r, hex) {
            const dir = new Three.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
              length = dir.length();
            q.setFromUnitVectors(shareUp, dir.normalize());
            add(shareRodGeo, matrix.compose(v.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, s.set(r, length, r)), hex);
            return api;
          },
          // A disc or short drum across the bike (its axis along z).
          disc(x, y, z, r, depth, hex) {
            q.setFromEuler(e.set(Math.PI / 2, 0, 0));
            add(shareDiscGeo, matrix.compose(v.set(x, y, z), q, s.set(r, depth, r)), hex);
            return api;
          },
          // A ring in the bike's plane (a tyre, a rim) from `geo` (a torus).
          ring(geo, x, y, z, hex) {
            add(geo, matrix.compose(v.set(x, y, z), q.identity(), s.set(1, 1, 1)), hex);
            return api;
          },
          // A mudguard: an arc of flat boxes over a wheel at (cx, cy).
          arc(cx, cy, radius, from, to, pieces, width, hex) {
            const step = (to - from) / pieces;
            for (let i = 0; i < pieces; i++) {
              const t = from + step * (i + 0.5);
              api.box(cx + Math.cos(t) * radius, cy + Math.sin(t) * radius, 0, radius * step * 1.08, 0.45, width, hex, 0, 0, t - Math.PI / 2);
            }
            return api;
          },
          geometry() {
            const g = new Three.BufferGeometry();
            g.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
            g.setAttribute('normal', new Three.Float32BufferAttribute(normals, 3));
            g.setAttribute('color', new Three.Float32BufferAttribute(colors, 3));
            g.computeBoundingSphere();
            return g;
          },
        };
        return api;
      }
      const shareTyreGeo = new Three.TorusGeometry(5.5, 0.75, 5, 18),
        shareRimGeo = new Three.TorusGeometry(4.75, 0.28, 4, 18),
        shareMaterial = new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.28 });
      /* A wheel at the origin in design units: tyre, rim, three spokes across and
         the hub (the dynamo drum of a share bike). */
      function addShareWheel(b, x, y) {
        const C = SHARE_COLORS;
        b.ring(shareTyreGeo, x, y, 0, C.tyre).ring(shareRimGeo, x, y, 0, C.steel);
        for (let k = 0; k < 3; k++) b.box(x, y, 0, 9.4, 0.16, 0.16, C.steel, 0, 0, (k * Math.PI) / 3);
        b.disc(x, y, 0, 0.9, 2.2, C.dark);
      }
      /* The frame in design units (x forward, y up): a step-through with fat
         teal tubes, white mudguards, chain case and front carrier with the teal
         brand panel, a black saddle, swept bars, dynamo lamps. */
      function addShareFrame(b) {
        const C = SHARE_COLORS;
        b.rod([6.5, 10.4, 0], [7.3, 14.6, 0], 0.8, C.teal)
          .rod([6.8, 11.6, 0], [3.4, 6.1, 0], 0.9, C.teal)
          .rod([3.4, 6.1, 0], [0.4, 4.6, 0], 0.9, C.teal)
          .rod([0.4, 4.6, 0], [-2.2, 13.2, 0], 0.82, C.teal)
          .disc(0.4, 4.6, 0, 1.3, 2.4, C.dark);
        for (const z of [-0.95, 0.95])
          b.rod([0.4, 4.6, z], [-10, 5.5, z], 0.38, C.teal)
            .rod([-1.8, 11.6, z * 0.8], [-10, 5.5, z], 0.36, C.teal)
            .rod([6.9, 11.1, z * 0.8], [10, 5.5, z], 0.45, C.teal);
        // Mudguards and the enclosed chain case.
        b.arc(-10, 5.5, 6.5, 0.15, 2.7, 6, 2.4, C.white).arc(10, 5.5, 6.5, 0.45, 2.75, 5, 2.4, C.white);
        b.box(-4.8, 5.1, 1.45, 11.5, 2.8, 0.35, C.white);
        // Saddle and post, stem and swept bars with black grips.
        b.rod([-2.2, 13.2, 0], [-2.7, 15.2, 0], 0.45, C.steel).box(-2.9, 15.6, 0, 5.2, 1.3, 3.2, C.saddle);
        b.rod([7.3, 14.6, 0], [6.9, 17.3, 0], 0.45, C.steel)
          .box(6.3, 17.5, 0, 1, 0.7, 8.4, C.dark)
          .box(5.2, 17.4, 3.9, 2.4, 0.95, 1.3, C.saddle)
          .box(5.2, 17.4, -3.9, 2.4, 0.95, 1.3, C.saddle);
        // Front carrier on the head tube: white rails, a teal panel with a white
        // brand band, the struts down to the fork ends.
        b.box(10.3, 13.1, 0, 5.8, 0.6, 6.2, C.white)
          .box(10.3, 14.5, 3.05, 5.8, 2.4, 0.35, C.white)
          .box(10.3, 14.5, -3.05, 5.8, 2.4, 0.35, C.white)
          .box(13.1, 14.6, 0, 0.45, 3.2, 6.2, C.teal)
          .box(13.35, 14.8, 0, 0.1, 0.9, 5.2, C.white);
        for (const z of [-2.4, 2.4]) b.rod([12.4, 12.9, z], [10, 5.5, z * 0.4], 0.28, C.white);
        // Dynamo lamps.
        b.box(13.4, 12.1, 0, 1, 1.2, 1.7, C.lamp).box(-16.2, 9.1, 0, 0.6, 1, 1.5, C.tail);
      }
      let dockedShareGeometry = null,
        shareFrameGeometry = null,
        shareWheelGeometry = null;
      function dockedBikeGeometry() {
        if (!dockedShareGeometry) {
          const b = shareGeometry();
          addShareFrame(b);
          addShareWheel(b, -10, 5.5);
          addShareWheel(b, 10, 5.5);
          // The crank at rest, pedals level.
          b.box(0.4, 4.6, 1.8, 1, 6, 0.8, SHARE_COLORS.steel).box(0.4, 7.6, 2.6, 3, 0.7, 2.2, SHARE_COLORS.saddle).box(0.4, 1.6, -2.6, 3, 0.7, 2.2, SHARE_COLORS.saddle);
          dockedShareGeometry = b.geometry();
        }
        return dockedShareGeometry;
      }
      /* The ridden share bike (vehicles3d.js makeBicycle hands `shareBike`
         vehicles here): the same frame, wheels that spin, a crank that turns and
         the rider, all in design units under one group scaled to the collider. */
      function makeShareBicycle(vehicle) {
        const model = specialVehicle(vehicle),
          body = model.body,
          frame = new Three.Group();
        model.bike = true;
        model.bicycle = true;
        frame.scale.setScalar(shareBikeScale());
        // The design runs from -16.2 to +13.9: centred on the collider.
        frame.position.x = 1.15 * shareBikeScale();
        body.add(frame);
        if (!shareFrameGeometry) {
          const b = shareGeometry();
          addShareFrame(b);
          shareFrameGeometry = b.geometry();
          const w = shareGeometry();
          addShareWheel(w, 0, 0);
          shareWheelGeometry = w.geometry();
        }
        mesh(shareFrameGeometry, shareMaterial, frame, 0, 0, 0);
        const wheels = [-10, 10].map((x) => ({ wheel: mesh(shareWheelGeometry, shareMaterial, frame, x, 5.5, 0) }));
        const crank = new Three.Group();
        crank.position.set(0.4, 4.6, 0);
        frame.add(crank);
        box(crank, 0, 0, 1.8, 1, 6, 0.8, chrome);
        box(crank, 0, 3, 2.6, 3, 0.7, 2.2, rubber);
        box(crank, 0, -3, -2.6, 3, 0.7, 2.2, rubber);
        // The rider, as on the city cycle: jacket, head, a teal helmet.
        const rider = new Three.Group(),
          skin = mat('#c4a489'),
          helmet = mat(SHARE_COLORS.teal, 0.4, 0.2);
        frame.add(rider);
        box(rider, -1.5, 20, 0, 4, 8, 6, mat('#4d7782'));
        mesh(sphereGeo, skin, rider, 1.5, 26, 0, 2.2, 2.7, 2.2);
        mesh(sphereGeo, helmet, rider, 1.4, 28, 0, 2.6, 1.5, 2.6);
        for (const side of [-1, 1]) {
          rod(rider, new Three.Vector3(-0.5, 22, side * 3), new Three.Vector3(5.6, 17.6, side * 3.9), 0.8, skin);
          rod(rider, new Three.Vector3(-2.8, 15.5, side * 2), new Three.Vector3(0.9, 8.6, side * 3), 1, mat('#334d59'));
        }
        model.rider = rider;
        model.crank = crank;
        model.wheels = wheels;
        return model;
      }
      /* The dock rack for `n` docks in metres from the station origin (x along
         the rack, z toward the walkway): a low plinth rail, and per dock a steel
         post with a teal head, a lock jaw, a green LED and a wheel guide. */
      const shareRackGeometries = new Map();
      function rackGeometry(n) {
        if (shareRackGeometries.has(n)) return shareRackGeometries.get(n);
        const M = SHARE_BIKE_METRE,
          C = SHARE_COLORS,
          half = (n * BIKE_SHARE.pitch) / 2,
          b = shareGeometry();
        b.box(0, 0.06 * M, 0, half * 2 + 0.3 * M, 0.12 * M, 0.4 * M, C.plinth);
        for (let i = 0; i < n; i++) {
          const u = -half + (i + 0.5) * BIKE_SHARE.pitch;
          b.box(u, 0.5 * M, 0, 0.26 * M, 0.9 * M, 0.3 * M, C.steel)
            .box(u, 0.98 * M, 0.06 * M, 0.3 * M, 0.2 * M, 0.42 * M, C.teal)
            .box(u, 0.72 * M, 0.2 * M, 0.16 * M, 0.26 * M, 0.12 * M, C.dark)
            .box(u, 1.04 * M, 0.28 * M, 0.1 * M, 0.05 * M, 0.02 * M, C.led)
            .box(u, 0.06 * M, 0.5 * M, 0.1 * M, 0.08 * M, 0.7 * M, C.steel);
        }
        const g = b.geometry();
        shareRackGeometries.set(n, g);
        return g;
      }
      /* The totem in metres (z toward the walkway): plinth, teal body with white
         edges, cap, card reader; its lit faces are separate planes. */
      let shareTotemGeometry = null;
      function totemGeometry() {
        if (shareTotemGeometry) return shareTotemGeometry;
        const M = SHARE_BIKE_METRE,
          C = SHARE_COLORS,
          b = shareGeometry();
        b.box(0, 0.07 * M, 0, 0.95 * M, 0.14 * M, 0.62 * M, C.plinth)
          .box(0, 1.15 * M, 0, 0.74 * M, 2.05 * M, 0.4 * M, C.teal)
          .box(0.38 * M, 1.15 * M, 0, 0.03 * M, 2.05 * M, 0.42 * M, C.white)
          .box(-0.38 * M, 1.15 * M, 0, 0.03 * M, 2.05 * M, 0.42 * M, C.white)
          .box(0, 2.25 * M, 0, 0.9 * M, 0.12 * M, 0.52 * M, C.white)
          .box(0.2 * M, 1.28 * M, 0.23 * M, 0.14 * M, 0.2 * M, 0.06 * M, C.dark)
          .box(0, 1.62 * M, 0.21 * M, 0.5 * M, 0.36 * M, 0.02 * M, C.dark);
        return (shareTotemGeometry = b.geometry());
      }
      /* The totem's lit faces: canvas textures in the lit-sign material
         (signage3d.js), bright at night and faint by day. */
      function shareCanvas(width, height, paint) {
        const cv = document.createElement('canvas');
        cv.width = width;
        cv.height = height;
        paint(cv.getContext('2d'), width, height);
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      const shareBrandTexture = shareCanvas(512, 128, (g, w, h) => {
          g.fillStyle = '#f4f7f5';
          g.fillRect(0, 0, w, h);
          g.fillStyle = BIKE_SHARE_TEAL;
          g.fillRect(0, h - 14, w, 14);
          // The mark: a wheel pair and a wave.
          g.strokeStyle = BIKE_SHARE_TEAL;
          g.lineWidth = 9;
          for (const x of [46, 100]) {
            g.beginPath();
            g.arc(x, 58, 22, 0, TAU);
            g.stroke();
          }
          g.font = 'bold 44px Arial, Helvetica, sans-serif';
          g.textBaseline = 'middle';
          g.fillStyle = '#0c3f3d';
          g.fillText('SOUTH COAST', 140, 44);
          g.fillStyle = BIKE_SHARE_TEAL;
          g.fillText('CYCLE', 140, 88);
        }),
        shareMapTexture = shareCanvas(256, 352, (g, w, h) => {
          g.fillStyle = '#0d3a3a';
          g.fillRect(0, 0, w, h);
          g.fillStyle = BIKE_SHARE_TEAL;
          g.fillRect(0, 0, w, 44);
          g.fillStyle = '#ffffff';
          g.font = 'bold 22px Arial, Helvetica, sans-serif';
          g.textBaseline = 'middle';
          g.fillText('STATION MAP', 16, 23);
          // A little map: water, the grid, parks, the stations and YOU ARE HERE.
          g.fillStyle = '#2b6f8c';
          g.fillRect(12, 56, w - 24, h - 120);
          g.fillStyle = '#e8ece6';
          g.fillRect(40, 70, w - 70, h - 150);
          g.fillStyle = '#9fc58c';
          g.fillRect(120, 150, 56, 44);
          g.strokeStyle = '#b8bfb6';
          g.lineWidth = 5;
          for (let x = 62; x < w - 30; x += 38) {
            g.beginPath();
            g.moveTo(x, 70);
            g.lineTo(x, h - 80);
            g.stroke();
          }
          for (let y = 92; y < h - 80; y += 38) {
            g.beginPath();
            g.moveTo(40, y);
            g.lineTo(w - 30, y);
            g.stroke();
          }
          g.fillStyle = BIKE_SHARE_TEAL;
          for (const [x, y] of [[62, 92], [138, 130], [214, 168], [100, 244], [176, 206], [62, 206]]) {
            g.beginPath();
            g.arc(x, y, 7, 0, TAU);
            g.fill();
          }
          g.fillStyle = '#e2402f';
          g.beginPath();
          g.arc(138, 206, 9, 0, TAU);
          g.fill();
          g.fillStyle = '#ffffff';
          g.font = 'bold 17px Arial, Helvetica, sans-serif';
          g.fillText('RENT $5 · DOCK ANY STATION', 14, h - 44);
          g.fillStyle = '#9fd9d3';
          g.fillText('$2 BACK ON RETURN', 14, h - 20);
        }),
        shareScreenTexture = shareCanvas(256, 176, (g, w, h) => {
          g.fillStyle = '#071b20';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#7ff0dd';
          g.font = 'bold 30px Arial, Helvetica, sans-serif';
          g.textBaseline = 'middle';
          g.fillText('RENT A BIKE', 22, 44);
          g.fillStyle = '#ffffff';
          g.font = 'bold 54px Arial, Helvetica, sans-serif';
          g.fillText('$5', 22, 104);
          g.fillStyle = '#58e98a';
          g.font = 'bold 20px Arial, Helvetica, sans-serif';
          g.fillText('TAP CARD ▸', 22, 150);
        });
      const shareBrandMat = litSignMaterial(shareBrandTexture, shareBrandTexture, { night: 1.1, day: 0.05 }),
        shareMapMat = litSignMaterial(shareMapTexture, shareMapTexture, { night: 1.0, day: 0.04 }),
        shareScreenMat = litSignMaterial(shareScreenTexture, shareScreenTexture, { night: 1.6, day: 0.5 }),
        shareStripMat = new Three.MeshBasicMaterial({ color: '#fff3d6' }),
        sharePlaneGeo = new Three.PlaneGeometry(1, 1);
      function sharePlane(parent, material, x, y, z, w, h, yaw = 0) {
        const m = mesh(sharePlaneGeo, material, parent, x, y, z, w, h, 1);
        m.rotation.y = yaw;
        m.castShadow = false;
        return m;
      }
      /* Build every station once the street furniture is down (the plan settles
         against it first), and link each dock to its bike prop. */
      {
        const M = SHARE_BIKE_METRE,
          bikeHalf = [SHARE_BIKE_LENGTH / 2 - 0.1 * M, BIKE_SHARE.bikeWidth / 2],
          scale = shareBikeScale();
        for (const st of settleBikeStations()) {
          const ground = terrainHeight(st.x, st.y),
            yaw = -st.a,
            e = stationExtent(st.n);
          // The rack: plinth and posts (one merged geometry per dock count).
          const rack = new Three.Group();
          rack.position.set(st.x, ground, st.y);
          rack.rotation.y = yaw;
          mesh(rackGeometry(st.n), shareMaterial, rack, 0, 0, 0);
          st.rack = registerStreetProp('bikerack', st.x, st.y, yaw, { half: [e.half + 0.15 * M, 0.2 * M] });
          breakableGroup(st.rack, rack);
          // The totem, its lit faces (map to the walkway, brand both ways,
          // screen), the canopy strip, a night glow on top and a pool below.
          const t = st.totemAt,
            totem = new Three.Group();
          totem.position.set(t.x, terrainHeight(t.x, t.y), t.y);
          totem.rotation.y = yaw;
          mesh(totemGeometry(), shareMaterial, totem, 0, 0, 0);
          sharePlane(totem, shareMapMat, -0.06 * M, 0.82 * M, 0.205 * M, 0.56 * M, 0.78 * M);
          sharePlane(totem, shareScreenMat, 0, 1.62 * M, 0.222 * M, 0.44 * M, 0.3 * M);
          sharePlane(totem, shareBrandMat, 0, 2.02 * M, 0.205 * M, 0.72 * M, 0.18 * M);
          sharePlane(totem, shareBrandMat, 0, 2.02 * M, -0.205 * M, 0.72 * M, 0.18 * M, Math.PI);
          sharePlane(totem, shareMapMat, 0, 1.1 * M, -0.205 * M, 0.6 * M, 0.84 * M, Math.PI);
          box(totem, 0, 2.18 * M, 0, 0.7 * M, 0.03 * M, 0.3 * M, shareStripMat).castShadow = false;
          st.totem = registerStreetProp('biketotem', t.x, t.y, yaw, { half: [BIKE_SHARE.totemHalf, 0.3 * M] });
          st.totem.glow = glowHandle(addGlow(t.x, totem.position.y + 2.3 * M, t.y, 1.6 * M, '#dff8f2', 0.9, { day: 0, phase: 0 }));
          breakableGroup(st.totem, totem);
          const pool = stationPoint(st, 0, BIKE_SHARE.bikeV);
          signSpill(pool.x, pool.y, 5 * M, '#d8f3ee', 0.32);
          // The bikes, each its own prop, nose in to the dock.
          for (const slot of st.slots) {
            const bike = new Three.Group();
            bike.position.set(slot.x, terrainHeight(slot.x, slot.y), slot.y);
            bike.rotation.y = -slot.a;
            const m = mesh(dockedBikeGeometry(), shareMaterial, bike, 0, 0, 0, scale, scale, scale);
            m.position.x = 1.15 * scale;
            slot.prop = registerStreetProp('sharebike', slot.x, slot.y, -slot.a, { half: bikeHalf });
            slot.prop.down = !slot.bike;
            breakableGroup(slot.prop, bike);
          }
        }
        bikeShareVersion++;
      }
      /* Empty docks drawn empty: a bike leaving zeroes its instances, one
         coming back restores them (kept from the first time it was hidden). */
      let bikeShareSeen = -1;
      const shareZero = new Three.Matrix4().makeScale(0, 0, 0);
      function updateBikeShareVisuals() {
        if (bikeShareSeen === bikeShareVersion || !bikeStationCache) return;
        let pending = false;
        for (const st of bikeStationCache)
          for (const slot of st.slots) {
            const prop = slot.prop;
            if (!prop) continue;
            if (!prop.instances) {
              pending = true;
              continue;
            }
            const hide = !slot.bike;
            if (hide === !!prop.shareHidden || knockedProps.includes(prop)) continue;
            if (!prop.shareOriginals)
              prop.shareOriginals = prop.instances.map(({ im, index }) => {
                const m = new Three.Matrix4();
                im.getMatrixAt(index, m);
                return m;
              });
            prop.instances.forEach(({ im, index }, k) => {
              im.setMatrixAt(index, hide ? shareZero : prop.shareOriginals[k]);
              im.instanceMatrix.needsUpdate = true;
            });
            prop.shareHidden = hide;
          }
        if (!pending) bikeShareSeen = bikeShareVersion;
      }
      // END SUBSYSTEM: src/cycles3d.js
