      // Theme park 3D Falcon train and Sunset Eye capsules and LEDs (updateCoasterTrain, updateEyeCapsules).
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
      instanceRideParts(coasterCarModels, 'falcon cars');
      // Riders: instanced torsos (with raised arms) and heads, four to a car.
      const riderBodyGeo = (() => {
        const b = parkParts();
        b.box(parkMats.white, parkPlaced(0, 0, 1.6, 1.4, 3.2, 2));
        for (const z of [-1.1, 1.1]) b.add(parkMats.white, parkThinGeo, parkBetween(parkP3(0, z, 2.8), parkP3(0.4, z * 1.35, 5.4), 0.28));
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
