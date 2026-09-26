      // BEGIN SUBSYSTEM: src/parachute3d.js — Ram-air parachute
      /**
       * Ram-air parachute
       * Source: src/parachute3d.js
       * Scope: createCityRenderer() closure (after render3d.js's person models).
       *
       * The player's parachute (player.parachute, parachute.js) drawn as a modern
       * ram-air wing rather than a dome:
       *
       *  - Canopy: nine cells, each its own strip of the upper and lower skins so
       *    the panel colours stay crisp; an airfoil section (open cell mouths along
       *    the leading edge, a thin trailing edge), pillowed upper skin between the
       *    ribs, an arched span and closed side stabilisers. It is rebuilt on the
       *    CPU each frame (about 2,300 vertices, only while it is in the air), so it
       *    can inflate, breathe, flutter along the trailing edge and pull its tail
       *    down with the brakes.
       *  - Rigging: four rows of suspension lines from the ribs to the four risers,
       *    brake lines from the tail to the rear risers, the slider, the risers and
       *    the harness container on the jumper's back. All lines are one
       *    LineSegments.
       *  - Deployment over opening 0 -> 1 (one second): the pilot chute is thrown
       *    and drags the bag out on its bridle, the lines stretch, the canopy
       *    inflates from the centre cells out (span overshoots slightly and
       *    settles) while the slider runs down the lines.
       *  - Flight: the jumper hangs under the wing on a damped pendulum; turns bank
       *    the whole rig into the turn and pull one toggle down (that side's tail
       *    deflects), the flare (hand-held, and automatically in the last seconds)
       *    pitches the wing back and brings both tails down.
       *  - Freefall: a belly-to-earth box position with the pack closed on the back.
       *  - After landing the canopy overflies the jumper, collapses onto the ground
       *    in front of them, lies a moment and is gathered up.
       *
       * poseParachutist(model) is called from the person pass for the player; it
       * poses the body and records the harness point that updateParachute3D()
       * hangs the wing from.
       */
      const CHUTE_CELLS = 9,
        CHUTE_SEGMENTS = 6, // spanwise segments per cell
        CHUTE_ROWS = 16, // chordwise segments
        CHUTE_SPAN = 56,
        CHUTE_CHORD = 21,
        CHUTE_THICK = 0.16, // of the chord
        CHUTE_ARC = 0.62, // half the arc of the span, radians
        CHUTE_LINES = 38, // harness to the centre of the lower skin
        CHUTE_MOUTH = 0.06; // the lower skin starts this far back: the cell openings
      // Panel colours across the span, tip to tip (linear-ish sRGB hex).
      const CHUTE_PANELS = ['#1d2f5e', '#e8e4da', '#d2362a', '#d2362a', '#f0c23a', '#d2362a', '#d2362a', '#e8e4da', '#1d2f5e'];
      const chuteRoot = new Three.Group();
      chuteRoot.name = 'Player parachute';
      chuteRoot.visible = false;
      scene.add(chuteRoot);
      // The wing is built in the rig's frame: x forward, y up, z to the right; the
      // origin is the harness (the jumper's shoulders).
      const chuteMaterial = new Three.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.62,
        metalness: 0,
        side: Three.DoubleSide,
      });
      /* One strip of skin per cell, (CHUTE_SEGMENTS + 1) x (CHUTE_ROWS + 1) vertices,
         upper then lower; `chuteSkinInfo` holds each vertex's (s, c, f, upper). */
      const chuteColumns = CHUTE_SEGMENTS + 1,
        chuteRowsN = CHUTE_ROWS + 1,
        chutePerStrip = chuteColumns * chuteRowsN,
        chuteVertexCount = CHUTE_CELLS * chutePerStrip * 2;
      const chuteSkinPos = new Float32Array(chuteVertexCount * 3),
        chuteSkinColor = new Float32Array(chuteVertexCount * 3),
        chuteSkinInfo = new Float32Array(chuteVertexCount * 4),
        chuteSkinIndex = [];
      {
        const tone = new Three.Color();
        let v = 0;
        for (const upper of [1, 0])
          for (let cell = 0; cell < CHUTE_CELLS; cell++) {
            tone.set(CHUTE_PANELS[cell]);
            // The underside is the same cloth seen in its own shade.
            if (!upper) tone.multiplyScalar(0.62);
            const base = v;
            for (let r = 0; r < chuteRowsN; r++)
              for (let k = 0; k < chuteColumns; k++) {
                const f = k / CHUTE_SEGMENTS,
                  s = ((cell + f) / CHUTE_CELLS) * 2 - 1,
                  t = r / CHUTE_ROWS,
                  // Rows crowd towards the leading edge, where the curvature is.
                  c = upper ? t * t * 0.55 + t * 0.45 : CHUTE_MOUTH + (1 - CHUTE_MOUTH) * (t * t * 0.4 + t * 0.6);
                chuteSkinInfo.set([s, c, f, upper], v * 4);
                // Leading-edge reinforcement tape: a slightly paler band.
                const tape = upper && c < 0.04 ? 1.18 : 1;
                chuteSkinColor.set([tone.r * tape, tone.g * tape, tone.b * tape], v * 3);
                v++;
              }
            for (let r = 0; r < CHUTE_ROWS; r++)
              for (let k = 0; k < CHUTE_SEGMENTS; k++) {
                const a = base + r * chuteColumns + k,
                  b = a + 1,
                  c = a + chuteColumns,
                  d = c + 1;
                chuteSkinIndex.push(a, c, b, b, c, d);
              }
          }
      }
      const chuteSkinGeometry = new Three.BufferGeometry();
      chuteSkinGeometry.setAttribute('position', new Three.BufferAttribute(chuteSkinPos, 3));
      chuteSkinGeometry.setAttribute('color', new Three.BufferAttribute(chuteSkinColor, 3));
      chuteSkinGeometry.setIndex(chuteSkinIndex);
      const chuteSkin = new Three.Mesh(chuteSkinGeometry, chuteMaterial);
      chuteSkin.castShadow = true;
      chuteSkin.frustumCulled = false;
      chuteRoot.add(chuteSkin);
      /* Side stabilisers and the ribs you see through the cell mouths: an airfoil
         outline at each rib, filled as a fan from its centre (the end ribs are the
         closed tips of the wing). */
      const CHUTE_RIB_POINTS = 12,
        chuteRibCount = CHUTE_CELLS + 1,
        chuteRibPos = new Float32Array(chuteRibCount * (CHUTE_RIB_POINTS * 2 + 1) * 3),
        chuteRibColor = new Float32Array(chuteRibCount * (CHUTE_RIB_POINTS * 2 + 1) * 3),
        chuteRibIndex = [];
      {
        const tone = new Three.Color();
        for (let rib = 0; rib < chuteRibCount; rib++) {
          const base = rib * (CHUTE_RIB_POINTS * 2 + 1),
            end = rib === 0 || rib === CHUTE_CELLS;
          tone.set(CHUTE_PANELS[Math.min(CHUTE_CELLS - 1, rib)]).multiplyScalar(end ? 0.8 : 0.45);
          for (let i = 0; i < CHUTE_RIB_POINTS * 2 + 1; i++) chuteRibColor.set([tone.r, tone.g, tone.b], (base + i) * 3);
          for (let i = 1; i < CHUTE_RIB_POINTS * 2; i++) chuteRibIndex.push(base, base + i, base + i + 1);
          chuteRibIndex.push(base, base + CHUTE_RIB_POINTS * 2, base + 1);
        }
      }
      const chuteRibGeometry = new Three.BufferGeometry();
      chuteRibGeometry.setAttribute('position', new Three.BufferAttribute(chuteRibPos, 3));
      chuteRibGeometry.setAttribute('color', new Three.BufferAttribute(chuteRibColor, 3));
      chuteRibGeometry.setIndex(chuteRibIndex);
      const chuteRibs = new Three.Mesh(chuteRibGeometry, chuteMaterial);
      chuteRibs.frustumCulled = false;
      chuteRoot.add(chuteRibs);
      /* Lines: per rib, the A-D suspension lines to the front/rear risers; brake
         lines from the outer tail to the rear risers; the bridle to the pilot
         chute. Grey Dyneema, the brake lines orange. */
      const CHUTE_LINE_ROWS = [0.04, 0.3, 0.56, 0.82],
        chuteLineCount = chuteRibCount * CHUTE_LINE_ROWS.length + 8 + 1,
        chuteLinePos = new Float32Array(chuteLineCount * 6),
        chuteLineColor = new Float32Array(chuteLineCount * 6);
      {
        for (let i = 0; i < chuteLineCount; i++) {
          const brake = i >= chuteRibCount * CHUTE_LINE_ROWS.length && i < chuteLineCount - 1,
            c = brake ? [0.95, 0.42, 0.12] : i === chuteLineCount - 1 ? [0.85, 0.2, 0.16] : [0.78, 0.8, 0.8];
          chuteLineColor.set([...c, ...c], i * 6);
        }
      }
      const chuteLineGeometry = new Three.BufferGeometry();
      chuteLineGeometry.setAttribute('position', new Three.BufferAttribute(chuteLinePos, 3));
      chuteLineGeometry.setAttribute('color', new Three.BufferAttribute(chuteLineColor, 3));
      const chuteLines = new Three.LineSegments(
        chuteLineGeometry,
        new Three.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }),
      );
      chuteLines.frustumCulled = false;
      chuteRoot.add(chuteLines);
      // Hardware: risers (webbing), the slider, the pilot chute.
      const chuteWebbing = new Three.MeshStandardMaterial({ color: '#23262b', roughness: 0.8 }),
        chuteSliderMaterial = new Three.MeshStandardMaterial({ color: '#d2362a', roughness: 0.65, side: Three.DoubleSide }),
        chuteRisers = [];
      for (let i = 0; i < 4; i++) {
        const riser = new Three.Mesh(boxGeo, chuteWebbing);
        riser.castShadow = false;
        chuteRoot.add(riser);
        chuteRisers.push(riser);
      }
      const chuteSlider = new Three.Mesh(new Three.PlaneGeometry(1, 1), chuteSliderMaterial);
      chuteSlider.rotation.x = -Math.PI / 2;
      chuteRoot.add(chuteSlider);
      const chutePilot = new Three.Group();
      {
        const dome = new Three.Mesh(new Three.SphereGeometry(3.2, 12, 6, 0, TAU, 0, Math.PI / 2), chuteSliderMaterial);
        dome.scale.y = 0.55;
        chutePilot.add(dome);
        const mesh = new Three.Mesh(
          new Three.CylinderGeometry(3.1, 1.2, 3.2, 12, 1, true),
          new Three.MeshStandardMaterial({ color: '#1a1c20', roughness: 0.9, transparent: true, opacity: 0.55, side: Three.DoubleSide }),
        );
        mesh.position.y = -1.6;
        chutePilot.add(mesh);
      }
      chuteRoot.add(chutePilot);
      // The container on the jumper's back (a child of the rig so it follows the pose).
      const chutePack = new Three.Group();
      {
        const shell = mat('#1f242b', 0.75);
        box(chutePack, 0, 0, 0, 1.8, 5.4, 5.2, shell);
        box(chutePack, -0.95, 0.4, 0, 0.3, 4.2, 4.2, mat('#2c333c', 0.7));
        // Main-closing flap pin cover and the reserve handle.
        box(chutePack, -1.1, 2.2, 0, 0.2, 0.7, 1.6, mat('#d2362a', 0.6));
        for (const side of [-1, 1]) box(chutePack, 1.2, -0.5, side * 2.2, 0.5, 6.2, 0.9, chuteWebbing);
      }
      chutePack.visible = false;
      scene.add(chutePack);
      /* ---- Shape ------------------------------------------------------------------- */
      // NACA 4-digit half-thickness, 1 at 30% chord.
      function chuteAirfoil(c) {
        const x = clamp(c, 0, 1);
        return 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x) / 0.6;
      }
      const chuteShape = {
        span: 1, // spanwise scale (inflation)
        chord: 1,
        thick: 1,
        arc: CHUTE_ARC,
        height: CHUTE_LINES,
        brakeL: 0,
        brakeR: 0,
        time: 0,
        flutter: 1,
        shift: 0, // forward offset of the whole wing (the collapse drapes it ahead)
      };
      const chutePoint = new Three.Vector3();
      // Position of skin point (s, c) on the upper (or lower) skin, `f` through its cell.
      function chuteSkinPoint(s, c, f, upper, out) {
        const sh = chuteShape,
          halfSpan = (CHUTE_SPAN / 2) * sh.span,
          arc = Math.max(0.05, sh.arc),
          radius = halfSpan / arc,
          theta = s * arc,
          chord = CHUTE_CHORD * sh.chord,
          thickness = CHUTE_THICK * chord * sh.thick;
        // Tail deflection: each toggle pulls the tail down on its own side.
        const brake = (s < 0 ? sh.brakeL : sh.brakeR) * (0.35 + 0.65 * Math.abs(s)),
          tail = c * c * c;
        let radial = upper ? thickness * chuteAirfoil(c) : -thickness * 0.08 * Math.sin(Math.PI * c);
        // Pillows between the ribs: the upper skin bulges, the lower skin a little.
        const pillow = Math.sin(Math.PI * f);
        radial += upper ? pillow * thickness * 0.22 * (1 - c * 0.6) : -pillow * thickness * 0.07;
        // Breathing and a ripple running along the trailing edge.
        radial *= 1 + 0.035 * Math.sin(sh.time * 2.7 + s * 2.1);
        const flutter = sh.flutter * tail * (0.35 * Math.sin(sh.time * 17 + s * 9 + c * 4) + 0.2 * Math.sin(sh.time * 29 - s * 13));
        const x = chord * (0.36 - c) + brake * tail * -1.5 + sh.shift,
          down = brake * tail * chord * 0.55 + flutter,
          r = radius + radial - down;
        out.set(x, sh.height + r * Math.cos(theta) - radius, r * Math.sin(theta));
        return out;
      }
      function chuteRebuild() {
        for (let v = 0; v < chuteVertexCount; v++) {
          const s = chuteSkinInfo[v * 4],
            c = chuteSkinInfo[v * 4 + 1],
            f = chuteSkinInfo[v * 4 + 2],
            upper = chuteSkinInfo[v * 4 + 3] > 0.5;
          chuteSkinPoint(s, c, f, upper, chutePoint);
          chuteSkinPos[v * 3] = chutePoint.x;
          chuteSkinPos[v * 3 + 1] = chutePoint.y;
          chuteSkinPos[v * 3 + 2] = chutePoint.z;
        }
        chuteSkinGeometry.attributes.position.needsUpdate = true;
        chuteSkinGeometry.computeVertexNormals();
        chuteSkinGeometry.computeBoundingSphere();
        // Ribs: the airfoil outline at each rib (upper surface forward, lower back).
        for (let rib = 0; rib < chuteRibCount; rib++) {
          const s = (rib / CHUTE_CELLS) * 2 - 1,
            base = rib * (CHUTE_RIB_POINTS * 2 + 1);
          chuteSkinPoint(s, 0.3, 0, true, chutePoint);
          const top = chutePoint.clone();
          chuteSkinPoint(s, 0.3, 0, false, chutePoint);
          chuteRibPos.set([(top.x + chutePoint.x) / 2, (top.y + chutePoint.y) / 2, (top.z + chutePoint.z) / 2], base * 3);
          for (let i = 0; i < CHUTE_RIB_POINTS; i++) {
            const t = i / (CHUTE_RIB_POINTS - 1);
            chuteSkinPoint(s, t * t, 0, true, chutePoint);
            chuteRibPos.set([chutePoint.x, chutePoint.y, chutePoint.z], (base + 1 + i) * 3);
            const u = 1 - t;
            chuteSkinPoint(s, CHUTE_MOUTH + (1 - CHUTE_MOUTH) * u, 0, false, chutePoint);
            chuteRibPos.set([chutePoint.x, chutePoint.y, chutePoint.z], (base + 1 + CHUTE_RIB_POINTS + i) * 3);
          }
        }
        chuteRibGeometry.attributes.position.needsUpdate = true;
        chuteRibGeometry.computeVertexNormals();
      }
      /* ---- Rig state -------------------------------------------------------------- */
      const chuteRig = {
        active: false,
        roll: 0,
        rollRate: 0,
        pitch: 0,
        pitchRate: 0,
        turn: 0,
        flare: 0,
        heading: 0,
        harness: new Three.Vector3(),
        quaternion: new Three.Quaternion(),
        // After landing: where the canopy came down and how long ago.
        collapse: null,
        lastStage: null,
        pilotLag: new Three.Vector3(),
      };
      const chuteEuler = new Three.Euler(0, 0, 0, 'YXZ'),
        chuteTmp = new Three.Vector3(),
        chuteTmp2 = new Three.Vector3(),
        chuteHarnessOffset = new Three.Vector3(0, 11.4 * (PERSON_HEIGHT / 14), 0),
        chuteRiser = [new Three.Vector3(), new Three.Vector3(), new Three.Vector3(), new Three.Vector3()];
      const smooth01 = (a, b, x) => {
        const t = clamp((x - a) / (b - a), 0, 1);
        return t * t * (3 - 2 * t);
      };
      // Ease with a small overshoot: the canopy "snaps" open and settles.
      const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
      /**
       * Pose the player's body for the parachute (called from the person pass).
       * Freefall: belly to earth, arched, arms and legs spread. Under canopy:
       * hanging from the harness on the pendulum, hands on the toggles.
       */
      function poseParachutist(m, deltaSeconds) {
        const p = player.parachute,
          arms = [m.parts.arm1, m.parts['arm-1']],
          legs = [m.parts.leg1, m.parts['leg-1']];
        if (!p) {
          if (chuteRig.active) for (const part of [...arms, ...legs]) part.rotation.x = 0;
          chuteRig.active = false;
          chutePack.visible = false;
          return;
        }
        chuteRig.active = true;
        const dt = Math.min(0.05, deltaSeconds || 0.016),
          turnInput = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
          agl = player.altitude - terrainHeight(player.x, player.y),
          flareInput = keys.KeyS || keys.ArrowDown ? 1 : 0,
          canopy = p.stage === 'canopy',
          // The last few metres: a jumper flares whether or not you ask.
          autoFlare = canopy ? smooth01(40, 12, agl) : 0;
        chuteRig.turn += (turnInput - chuteRig.turn) * (1 - Math.exp(-dt * 4));
        chuteRig.flare += (Math.max(flareInput, autoFlare) - chuteRig.flare) * (1 - Math.exp(-dt * 5));
        chuteRig.heading = p.heading;
        m.parts.guns.forEach((gun) => (gun.visible = false));
        if (!canopy) {
          // Box position, a slow wobble; a turn drops a shoulder.
          const wobble = Math.sin(gameTime * 2.3) * 0.06 + chuteRig.turn * 0.35;
          m.group.rotation.set(wobble, -p.heading, -Math.PI / 2 + Math.sin(gameTime * 1.7) * 0.04);
          m.group.position.set(player.x, player.altitude + 6, player.y);
          arms.forEach((arm, i) => {
            const side = i === 0 ? 1 : -1;
            arm.rotation.z = 0.75 + Math.sin(gameTime * 3.1 + i) * 0.05;
            arm.rotation.x = -side * 1.35;
          });
          legs.forEach((leg, i) => {
            const side = i === 0 ? 1 : -1;
            leg.rotation.z = -0.55;
            leg.rotation.x = -side * 0.32;
          });
          m.torso.rotation.z = -0.08;
          chuteRig.roll = chuteRig.rollRate = chuteRig.pitch = chuteRig.pitchRate = 0;
        } else {
          // Damped pendulum: the rig banks into the turn and pitches with the flare.
          const opening = p.opening,
            rollTarget = chuteRig.turn * 0.5 * opening,
            pitchTarget = (-chuteRig.flare * 0.3 + (keys.KeyW || keys.ArrowUp ? 0.1 : 0)) * opening;
          chuteRig.rollRate += ((rollTarget - chuteRig.roll) * 9 - chuteRig.rollRate * 3.2) * dt;
          chuteRig.pitchRate += ((pitchTarget - chuteRig.pitch) * 7 - chuteRig.pitchRate * 2.6) * dt;
          // The opening shock swings the jumper forward under the wing.
          if (opening < 1) chuteRig.pitchRate += Math.sin(opening * Math.PI) * 1.2 * dt;
          chuteRig.roll += chuteRig.rollRate * dt;
          chuteRig.pitch += chuteRig.pitchRate * dt;
          chuteEuler.set(chuteRig.roll, -p.heading, chuteRig.pitch, 'YXZ');
          m.group.rotation.copy(chuteEuler);
          // Swing about the harness, not the feet.
          chuteRig.harness.set(player.x, player.altitude + chuteHarnessOffset.y, player.y);
          chuteTmp.copy(chuteHarnessOffset).applyEuler(chuteEuler);
          m.group.position.copy(chuteRig.harness).sub(chuteTmp);
          const pullR = Math.max(chuteRig.flare, chuteRig.turn),
            pullL = Math.max(chuteRig.flare, -chuteRig.turn);
          // Hands on the toggles: up by the risers, down to the hips to brake.
          m.parts.arm1.rotation.z = 2.75 - pullR * 1.6;
          m.parts['arm-1'].rotation.z = 2.75 - pullL * 1.6;
          arms.forEach((arm, i) => (arm.rotation.x = (i === 0 ? -1 : 1) * 0.18));
          // Legs together and a little forward, raised for the landing.
          const legLift = 0.25 + chuteRig.flare * 0.5 + Math.sin(gameTime * 1.3) * 0.04;
          legs.forEach((leg, i) => {
            leg.rotation.z = legLift + (i ? 0.06 : 0);
            leg.rotation.x = 0;
          });
          m.torso.rotation.z = 0;
        }
        // The container rides on the back.
        chutePack.visible = true;
        chutePack.position.copy(m.group.position);
        chutePack.quaternion.setFromEuler(m.group.rotation);
        chuteTmp.set(-1.6, 10.2, 0).multiplyScalar(PERSON_HEIGHT / 14).applyQuaternion(chutePack.quaternion);
        chutePack.position.add(chuteTmp);
        chutePack.scale.setScalar(0.72 * (PERSON_HEIGHT / 14));
      }
      function chuteSetLine(i, a, b) {
        chuteLinePos[i * 6] = a.x;
        chuteLinePos[i * 6 + 1] = a.y;
        chuteLinePos[i * 6 + 2] = a.z;
        chuteLinePos[i * 6 + 3] = b.x;
        chuteLinePos[i * 6 + 4] = b.y;
        chuteLinePos[i * 6 + 5] = b.z;
      }
      function chuteRigging(opening, pilotWorld) {
        // Risers: front and rear on each shoulder, up to the connector links.
        const riserTop = 6 + 3 * opening;
        for (let i = 0; i < 4; i++) {
          const front = i % 2 === 0,
            side = i < 2 ? -1 : 1;
          chuteRiser[i].set(front ? 1.2 : -1.2, riserTop, side * 3.4);
          const r = chuteRisers[i];
          r.position.set((front ? 0.6 : -0.6) - 0.5, riserTop / 2, side * 3.1);
          r.scale.set(0.35, riserTop, 1.6);
          r.rotation.z = front ? -0.08 : 0.08;
        }
        let line = 0;
        for (let rib = 0; rib < chuteRibCount; rib++) {
          const s = (rib / CHUTE_CELLS) * 2 - 1,
            side = s < 0 ? 0 : 2;
          for (let row = 0; row < CHUTE_LINE_ROWS.length; row++) {
            chuteSkinPoint(s, CHUTE_LINE_ROWS[row], 0, false, chutePoint);
            chuteSetLine(line++, chutePoint, chuteRiser[side + (row < 2 ? 0 : 1)]);
          }
        }
        // Brake lines: the outer half of the tail cascades to each rear riser.
        for (let k = 0; k < 8; k++) {
          const s = (k < 4 ? -1 : 1) * (0.25 + (k % 4) * 0.25);
          chuteSkinPoint(s, 0.98, 0, false, chutePoint);
          chuteSetLine(line++, chutePoint, chuteRiser[k < 4 ? 1 : 3]);
        }
        // Bridle from the top of the centre cell to the pilot chute.
        chuteSkinPoint(0, 0.35, 0.5, true, chutePoint);
        chuteRoot.worldToLocal(chuteTmp2.copy(pilotWorld));
        chuteSetLine(line++, chutePoint, chuteTmp2);
        chuteLineGeometry.attributes.position.needsUpdate = true;
        chuteLineGeometry.computeBoundingSphere();
        // Slider: at the canopy while it opens, then down the lines to the risers.
        const slide = smooth01(0.25, 1, opening);
        chuteSkinPoint(0, 0.4, 0, false, chutePoint);
        chuteSlider.position.set(0, chutePoint.y + (riserTop + 1 - chutePoint.y) * slide, 0);
        const w = 4 + 3 * slide;
        chuteSlider.scale.set(w, 7 + 3 * slide, 1);
      }
      /**
       * Per frame (after the person pass): place and shape the wing for the
       * current stage, or play the collapse after a landing.
       */
      function updateParachute3D(deltaSeconds) {
        const p = player.parachute,
          dt = Math.min(0.05, deltaSeconds || 0.016);
        chuteShape.time += dt;
        const stage = p ? p.stage : null;
        // Just landed (or splashed down) from under a canopy: start the collapse.
        if (!p && chuteRig.lastStage === 'canopy' && !chuteRig.collapse)
          chuteRig.collapse = {
            t: 0,
            // Where the jumper stands now: a landing is moved to clear ground
            // (parachute.js), and the canopy comes down in front of them there.
            x: player.x,
            z: player.y,
            ground: entityElevation(player),
            heading: chuteRig.heading,
          };
        chuteRig.lastStage = stage;
        if (p) {
          chuteRig.collapse = null;
        }
        if (stage === 'canopy') {
          const opening = p.opening,
            stretch = smooth01(0, 0.35, opening),
            inflate = smooth01(0.28, 1, opening);
          chuteRoot.visible = true;
          chuteRoot.position.copy(chuteRig.harness);
          chuteRoot.quaternion.setFromEuler(chuteEuler.set(chuteRig.roll, -chuteRig.heading, chuteRig.pitch, 'YXZ'));
          chuteRoot.scale.setScalar(1);
          // The bag lifts off the back on the bridle, the lines stretch, then it inflates.
          chuteShape.height = 4 + (CHUTE_LINES - 4) * stretch;
          chuteShape.span = 0.14 + 0.86 * (inflate < 1 ? clamp(easeOutBack(inflate), 0, 1.06) : 1);
          chuteShape.chord = 0.3 + 0.7 * smooth01(0.3, 0.75, opening);
          chuteShape.thick = 0.25 + 0.75 * inflate;
          chuteShape.arc = CHUTE_ARC * (1.6 - 0.6 * inflate);
          chuteShape.flutter = 1 + (1 - inflate) * 4;
          chuteShape.shift = 0;
          const pullR = Math.max(chuteRig.flare, chuteRig.turn),
            pullL = Math.max(chuteRig.flare, -chuteRig.turn);
          chuteShape.brakeR = clamp(pullR, 0, 1) * 1.3;
          chuteShape.brakeL = clamp(pullL, 0, 1) * 1.3;
          chuteRebuild();
          // Pilot chute: thrown up and back, it then trails above the tail.
          chuteSkinPoint(0, 0.5, 0.5, true, chutePoint);
          chuteTmp.set(-10 - 8 * stretch, chutePoint.y + 5 + (1 - stretch) * 10, Math.sin(chuteShape.time * 1.3) * 1.5);
          chutePilot.position.copy(chuteTmp);
          chutePilot.rotation.set(0, 0, 0.5 + Math.sin(chuteShape.time * 3.1) * 0.15);
          // Once the canopy has taken the load the kill-line collapses it to a small bundle.
          chutePilot.scale.setScalar(1 - 0.62 * inflate);
          chutePilot.updateMatrixWorld();
          chuteRoot.updateMatrixWorld();
          chuteRigging(opening, chutePilot.getWorldPosition(chuteTmp2));
          chutePilot.visible = chuteSlider.visible = chuteLines.visible = true;
          for (const r of chuteRisers) r.visible = true;
          return;
        }
        const c = chuteRig.collapse;
        if (!c || stage === 'freefall') {
          chuteRoot.visible = false;
          return;
        }
        /* The canopy overflies the jumper, its nose drops and it settles on the
           ground in front of them, lies a moment, then is gathered up. */
        c.t += dt;
        const fall = smooth01(0, 1.5, c.t),
          gather = smooth01(3.2, 4.6, c.t);
        if (gather >= 1 || Math.hypot(player.x - c.x, player.y - c.z) > 260) {
          chuteRig.collapse = null;
          chuteRoot.visible = false;
          return;
        }
        chuteRoot.visible = true;
        chuteRoot.position.set(c.x, c.ground + 1, c.z);
        chuteRoot.quaternion.setFromEuler(chuteEuler.set(0, -c.heading, -fall * 0.25, 'YXZ'));
        chuteRoot.scale.setScalar(Math.max(0.02, 1 - gather));
        chuteShape.height = CHUTE_LINES * (1 - fall) + 1.2 * fall;
        chuteShape.span = 1 - 0.1 * fall;
        chuteShape.chord = 1;
        chuteShape.thick = Math.max(0.03, 1 - fall * 1.1);
        chuteShape.arc = CHUTE_ARC * (1 - 0.85 * fall);
        chuteShape.flutter = 1 + fall * 2 * (1 - smooth01(1.5, 2.5, c.t));
        chuteShape.brakeL = chuteShape.brakeR = 0;
        // The wing lands ahead of the jumper, draped forward.
        chuteShape.shift = fall * 26;
        chuteRebuild();
        chuteRoot.updateMatrixWorld();
        chuteRigging(1, chuteRoot.position);
        chutePilot.visible = chuteSlider.visible = false;
        for (const r of chuteRisers) r.visible = false;
        chuteLines.visible = gather < 0.5;
      }
      // END SUBSYSTEM: src/parachute3d.js
