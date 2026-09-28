      // Parachute 3D rigging: lines through the slider's grommets, risers, the billowing slider, pilot chute, bag and
      // container; updateParachute3D() shapes the rig stage by stage through the deployment, flight and the collapse.
      /* Lines: per rib, the A-D suspension lines through the slider's four grommets
         to the front/rear risers; brake lines from the outer tail down the rear
         groups; the bridle from the canopy's top through the bag to the pilot chute.
         Every line is a polyline of CHUTE_LINE_PARTS segments (attachment, bow,
         grommet, bow, riser) so it can go slack, whip out of its stows and draw
         tight. Grey Dyneema, the brake lines orange, the bridle red. */
      const CHUTE_LINE_ROWS = [0.04, 0.3, 0.56, 0.82],
        CHUTE_LINE_PARTS = 4,
        chuteSuspension = chuteRibCount * CHUTE_LINE_ROWS.length,
        chuteLineCount = chuteSuspension + 8 + 1,
        chuteLinePos = new Float32Array(chuteLineCount * CHUTE_LINE_PARTS * 6),
        chuteLineColor = new Float32Array(chuteLineCount * CHUTE_LINE_PARTS * 6);
      for (let i = 0; i < chuteLineCount; i++) {
        const brake = i >= chuteSuspension && i < chuteLineCount - 1,
          c = brake ? [0.95, 0.42, 0.12] : i === chuteLineCount - 1 ? [0.85, 0.2, 0.16] : [0.78, 0.8, 0.8];
        for (let v = 0; v < CHUTE_LINE_PARTS * 2; v++) chuteLineColor.set(c, (i * CHUTE_LINE_PARTS * 2 + v) * 3);
      }
      const chuteLineGeometry = new Three.BufferGeometry();
      chuteLineGeometry.setAttribute('position', new Three.BufferAttribute(chuteLinePos, 3));
      chuteLineGeometry.setAttribute('color', new Three.BufferAttribute(chuteLineColor, 3));
      const chuteLineMaterial = new Three.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }),
        chuteLines = new Three.LineSegments(chuteLineGeometry, chuteLineMaterial);
      chuteLines.frustumCulled = false;
      chuteRoot.add(chuteLines);
      // Hardware: risers (webbing), the slider, the pilot chute.
      const chuteWebbing = chuteCloudLit(new Three.MeshStandardMaterial({ color: '#23262b', roughness: 0.8 })),
        chuteSliderMaterial = chuteCloudLit(new Three.MeshStandardMaterial({ color: '#d2362a', roughness: 0.65, side: Three.DoubleSide })),
        chuteRisers = [];
      for (let i = 0; i < 4; i++) {
        const riser = new Three.Mesh(boxGeo, chuteWebbing);
        riser.castShadow = false;
        chuteRoot.add(riser);
        chuteRisers.push(riser);
      }
      /* The slider: a small sheet of cloth (0.8 x 1.05 m) with a grommet at each
         corner; built in the rig's frame each frame so it can billow and flap. */
      const CHUTE_SLIDER_HALF = [3.2, 4.2],
        chuteSliderGeometry = new Three.PlaneGeometry(1, 1, 4, 4),
        chuteSliderGrid = chuteSliderGeometry.attributes.position.array.slice(),
        chuteSlider = new Three.Mesh(chuteSliderGeometry, chuteSliderMaterial),
        chuteGrommet = [new Three.Vector3(), new Three.Vector3(), new Three.Vector3(), new Three.Vector3()];
      chuteSlider.frustumCulled = false;
      chuteRoot.add(chuteSlider);
      const chutePilot = new Three.Group();
      {
        const dome = new Three.Mesh(new Three.SphereGeometry(3.2, 12, 6, 0, TAU, 0, Math.PI / 2), chuteSliderMaterial);
        dome.scale.y = 0.55;
        chutePilot.add(dome);
        const mesh = new Three.Mesh(
          new Three.CylinderGeometry(3.1, 1.2, 3.2, 12, 1, true),
          chuteCloudLit(
            new Three.MeshStandardMaterial({ color: '#1a1c20', roughness: 0.9, transparent: true, opacity: 0.55, side: Three.DoubleSide }),
          ),
        );
        mesh.position.y = -1.6;
        chutePilot.add(mesh);
      }
      chuteRoot.add(chutePilot);
      // The deployment bag: out of the container on the bridle, then left under the pilot chute.
      const chuteBag = new Three.Mesh(boxGeo, chuteCloudLit(mat('#15181c', 0.85)));
      chuteBag.scale.set(1.6, 2.4, 3);
      chuteBag.visible = false;
      chuteRoot.add(chuteBag);
      // The container on the jumper's back (a child of the rig so it follows the pose).
      const chutePack = new Three.Group();
      {
        const shell = chuteCloudLit(mat('#1f242b', 0.75));
        box(chutePack, 0, 0, 0, 1.8, 5.4, 5.2, shell);
        box(chutePack, -0.95, 0.4, 0, 0.3, 4.2, 4.2, chuteCloudLit(mat('#2c333c', 0.7)));
        // Main-closing flap pin cover and the reserve handle.
        box(chutePack, -1.1, 2.2, 0, 0.2, 0.7, 1.6, chuteCloudLit(mat('#d2362a', 0.6)));
        for (const side of [-1, 1]) box(chutePack, 1.2, -0.5, side * 2.2, 0.5, 6.2, 0.9, chuteWebbing);
      }
      chutePack.visible = false;
      scene.add(chutePack);
      /* The rig is never scenery: without the dynamic mark the detail pass (flight-view3d.js
         tagSceneryDetail) files its small parts, lines and all, on the layers the flight
         camera stops drawing high up, and the canopy vanished from a jump's own camera. */
      for (const group of [chuteRoot, chutePack]) group.traverse((o) => (o.userData.dynamic = true));
      // In cloud: the cloth takes the cloud's light (chuteCloudLit), the unlit lines dim with it.
      function chuteCloudTint() {
        const a = cloudRigAmount,
          light = cloudRigLight;
        chuteCloudUniform.value.set(light.r, light.g, light.b, a);
        chuteLineMaterial.color.setRGB(1 + (Math.min(1.1, light.r) - 1) * a, 1 + (Math.min(1.1, light.g) - 1) * a, 1 + (Math.min(1.1, light.b) - 1) * a);
      }
      const chuteMid = new Three.Vector3();
      function chuteSetSegment(segment, a, b) {
        const o = segment * 6;
        chuteLinePos[o] = a.x;
        chuteLinePos[o + 1] = a.y;
        chuteLinePos[o + 2] = a.z;
        chuteLinePos[o + 3] = b.x;
        chuteLinePos[o + 4] = b.y;
        chuteLinePos[o + 5] = b.z;
      }
      /* Line `i` from `a` through `g` (a grommet, or the bag) to `r`. The span above
         `g` bows by `bowTop` (slack lines over a canopy not yet taking the load, each
         its own way), the span below by `bowBottom` (the bundle whipping out of its
         stows, all together). */
      function chuteSetLine(i, a, g, r, bowTop = 0, bowBottom = 0) {
        const t = chuteShape.time,
          segment = i * CHUTE_LINE_PARTS;
        chuteMid.addVectors(a, g).multiplyScalar(0.5);
        if (bowTop) {
          chuteMid.x += Math.sin(t * 17 + i * 1.7) * bowTop;
          chuteMid.z += Math.cos(t * 13 + i * 2.3) * bowTop;
        }
        chuteSetSegment(segment, a, chuteMid);
        chuteSetSegment(segment + 1, chuteMid, g);
        chuteMid.addVectors(g, r).multiplyScalar(0.5);
        if (bowBottom) {
          chuteMid.x += (Math.sin(t * 7.3) + 0.35 * Math.sin(t * 21 + i * 0.9)) * bowBottom;
          chuteMid.z += (Math.cos(t * 5.1) + 0.35 * Math.cos(t * 17 + i * 1.3)) * bowBottom;
        }
        chuteSetSegment(segment + 2, g, chuteMid);
        chuteSetSegment(segment + 3, chuteMid, r);
      }
      const chuteBagTop = new Three.Vector3(),
        chuteBagFoot = new Three.Vector3(),
        chutePilotLocal = new Three.Vector3(),
        chuteBridleMid = new Three.Vector3(),
        chuteCrown = new Three.Vector3();
      /* Risers, slider, lines and bridle for this frame. `mode`: 'stowed' (only the
         pilot chute out), 'bundle' (the canopy still in the bag at `chuteBag`, the
         lines paying out of it), 'canopy'. `slide` is the slider's run down the lines
         (0 against the canopy .. 1 on the risers); `billow` how hard the air pushes
         it up and flaps it; `bowTop`/`bowBottom` the lines' slack and whip. */
      function chuteRigging(o) {
        const t = chuteShape.time,
          riserTop = 6 + 3 * o.opening;
        for (let i = 0; i < 4; i++) {
          const front = i % 2 === 0,
            side = i < 2 ? -1 : 1;
          chuteRiser[i].set(front ? 1.2 : -1.2, riserTop, side * 3.4);
          const r = chuteRisers[i];
          r.position.set((front ? 0.6 : -0.6) - 0.5, riserTop / 2, side * 3.1);
          r.scale.set(0.35, riserTop, 1.6);
          r.rotation.z = front ? -0.08 : 0.08;
        }
        chuteRoot.worldToLocal(chutePilotLocal.copy(o.pilotWorld));
        chuteBagTop.copy(chuteBag.position);
        chuteBagTop.y += 1.2;
        chuteBagFoot.copy(chuteBag.position);
        chuteBagFoot.y -= 1.2;
        // The slider: against the canopy (or the bag) at the top of the lines, then down them to the links.
        const canopy = o.mode === 'canopy';
        if (canopy) chuteSkinPoint(0, 0.4, 0.5, false, chuteCrown);
        const top = canopy ? chuteCrown.y - 1.4 : chuteBagFoot.y,
          bottom = riserTop + 1.2,
          sliderY = top + (bottom - top) * o.slide,
          // Pinched in over the links once it is down.
          spread = 1 - 0.3 * smooth01(0.7, 1, o.slide);
        for (let i = 0; i < 4; i++) {
          const front = i % 2 === 0,
            side = i < 2 ? -1 : 1;
          chuteGrommet[i].set((front ? 1 : -1) * CHUTE_SLIDER_HALF[0] * spread, sliderY, side * CHUTE_SLIDER_HALF[1] * spread);
        }
        if (o.mode === 'stowed') {
          for (let i = 0; i < chuteLineCount - 1; i++) chuteSetLine(i, chuteRiser[0], chuteRiser[0], chuteRiser[0]);
        } else {
          let line = 0;
          for (let rib = 0; rib < chuteRibCount; rib++) {
            const s = (rib / CHUTE_CELLS) * 2 - 1,
              side = s < 0 ? 0 : 2;
            for (let row = 0; row < CHUTE_LINE_ROWS.length; row++) {
              const riser = side + (row < 2 ? 0 : 1);
              if (canopy) chuteSkinPoint(s, CHUTE_LINE_ROWS[row], 0, false, chutePoint);
              else chutePoint.copy(chuteBagFoot);
              chuteSetLine(line++, chutePoint, canopy ? chuteGrommet[riser] : chuteBagFoot, chuteRiser[riser], o.bowTop, o.bowBottom);
            }
          }
          // Brake lines: the outer half of the tail cascades down each rear group.
          for (let k = 0; k < 8; k++) {
            const s = (k < 4 ? -1 : 1) * (0.25 + (k % 4) * 0.25),
              riser = k < 4 ? 1 : 3;
            if (canopy) chuteSkinPoint(s, 0.98, 0, false, chutePoint);
            else chutePoint.copy(chuteBagFoot);
            chuteSetLine(line++, chutePoint, canopy ? chuteGrommet[riser] : chuteBagFoot, chuteRiser[riser], o.bowTop * 1.5, o.bowBottom);
          }
        }
        // Bridle: from the top of the centre cell (or the container's pin) through the bag to the pilot chute.
        if (canopy) chuteSkinPoint(0, 0.35, 0.5, true, chuteCrown);
        else if (o.mode === 'bundle') chuteCrown.copy(chuteBagTop);
        else chuteCrown.set(-0.8, 1, 0);
        chuteSetLine(
          chuteLineCount - 1,
          chuteCrown,
          o.mode === 'stowed' ? chuteBridleMid.addVectors(chuteCrown, chutePilotLocal).multiplyScalar(0.5) : chuteBagTop,
          chutePilotLocal,
          o.bridleSlack || 0,
          0,
        );
        chuteLineGeometry.attributes.position.needsUpdate = true;
        chuteLineGeometry.computeBoundingSphere();
        // The slider's cloth: bellied up by the air through it, its edges flapping.
        const grid = chuteSliderGrid,
          pos = chuteSliderGeometry.attributes.position.array,
          hx = CHUTE_SLIDER_HALF[0] * spread,
          hz = CHUTE_SLIDER_HALF[1] * spread;
        for (let v = 0; v < pos.length / 3; v++) {
          const gx = grid[v * 3] * 2,
            gz = grid[v * 3 + 1] * 2,
            belly = (1 - gx * gx) * (1 - gz * gz),
            edge = Math.max(Math.abs(gx), Math.abs(gz));
          pos[v * 3] = gx * hx;
          pos[v * 3 + 1] = sliderY + o.billow * (1.4 * belly + 0.5 * edge * Math.sin(t * 27 + gx * 5 + gz * 7));
          pos[v * 3 + 2] = gz * hz;
        }
        chuteSliderGeometry.attributes.position.needsUpdate = true;
        chuteSliderGeometry.computeVertexNormals();
      }
      const chuteRiggingState = { mode: 'canopy', opening: 1, slide: 1, billow: 0, bowTop: 0, bowBottom: 0, bridleSlack: 0, pilotWorld: new Three.Vector3() };
      /**
       * Per frame (after the person pass): place and shape the rig for the
       * current stage and deployment phase, or play the collapse after a landing.
       */
      function updateParachute3D(deltaSeconds) {
        const p = player.parachute,
          dt = Math.min(0.05, deltaSeconds || 0.016),
          rig = chuteRiggingState;
        chuteShape.time += dt;
        chuteCloudTint();
        const stage = p ? p.stage : null;
        // Just landed (or splashed down) from under a canopy: start the collapse
        // (not for one still in the bag or barely out of it).
        if (!p && chuteRig.lastStage === 'canopy' && !chuteRig.collapse && chuteRig.lastOpening > 0.5)
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
        chuteRig.lastOpening = p ? p.opening : 0;
        if (p) chuteRig.collapse = null;
        if (stage === 'canopy') {
          const phase = p.phase,
            k = p.phaseK,
            opening = p.opening,
            u = clamp(chuteRig.upright, 0, 1),
            packed = phase === 'pilot' || phase === 'lines',
            flying = phase === 'open',
            flown = p.flown || 0,
            // The lines out of the bag: 0 in the container .. 1 at line stretch.
            stretch = phase === 'pilot' ? 0 : phase === 'lines' ? k * (2 - k) : 1,
            // The kill-line collapses the pilot chute once the canopy has taken the load.
            inflate = smooth01(0.3, 1, opening),
            // The canopy comes out of the bag a little off heading and swings round to it.
            yaw = packed ? 0 : 0.16 * Math.sin(p.deploy * 2.4 + 0.5) * Math.exp(-2.5 * flown) * (phase === 'snivel' ? smooth01(0, 0.4, k) : 1);
          chuteRoot.visible = true;
          chuteRoot.position.copy(chuteRig.harness);
          // The lines trail in the relative wind, then hang on the pendulum (poseParachutist).
          chuteRoot.quaternion.setFromEuler(chuteEuler.set(chuteRig.roll * u, -chuteRig.heading + yaw, chuteRig.pitch, 'YXZ'));
          chuteRoot.scale.setScalar(1);
          chuteShape.height = CHUTE_LINES;
          chuteShape.shift = 0;
          rig.mode = phase === 'pilot' ? 'stowed' : packed ? 'bundle' : 'canopy';
          rig.opening = opening;
          rig.bowTop = rig.bowBottom = rig.bridleSlack = rig.billow = 0;
          if (packed) {
            // Still in the bag; the lines whip out of their stows behind it until line stretch snaps them straight.
            chuteShape.fill = 0;
            rig.slide = 0;
            rig.bowBottom = phase === 'lines' ? 2.2 * Math.sin(Math.PI * Math.min(1, k * 1.1)) : 0;
            rig.bridleSlack = phase === 'pilot' ? 2.5 * (1 - smooth01(0.5, 0.9, k)) : 0;
          } else if (phase === 'snivel') {
            /* Out of the bag: the cloth streams up off the top of the lines (canopy
               stretch), the slider holds it gathered while the centre cells fill nose
               first; the rest flogs. The lines above the slider are still slack. */
            const out = smooth01(0, 0.25, k);
            chuteShape.fill = -0.3 + 0.95 * k ** 1.2;
            chuteShape.bunch = 0;
            chuteShape.stream = 1.6 - 0.8 * out;
            chuteShape.flog = 1.5 - 0.5 * k;
            chuteShape.span = 0.34 + 0.1 * k + 0.02 * Math.sin(chuteShape.time * 11);
            chuteShape.chord = 0.72 + 0.14 * k;
            chuteShape.thick = 0.75 + 0.25 * k;
            chuteShape.arc = CHUTE_ARC * 1.5;
            chuteShape.flutter = 3;
            // Canopy stretch: the cloth leaves the bag over the first moments.
            chuteShape.height = CHUTE_LINES - 6 * (1 - out);
            rig.slide = 0.04 * k;
            rig.billow = 1;
            rig.bowTop = 0.9 * (1 - 0.6 * k);
          } else if (phase === 'snap') {
            // The slider runs down the lines; the wing spreads from the centre out, the end cells last, and settles.
            const spread = smooth01(0.05, 1, k);
            chuteShape.fill = 0.65 + 1.05 * smooth01(0, 0.85, k);
            chuteShape.bunch = smooth01(0.05, 0.75, k);
            chuteShape.stream = 0.8 * (1 - k);
            chuteShape.flog = 1 - k;
            chuteShape.span = 0.44 + 0.56 * clamp(easeOutBack(spread), 0, 1.06);
            chuteShape.chord = 0.86 + 0.14 * smooth01(0, 0.6, k);
            chuteShape.thick = 1;
            chuteShape.arc = CHUTE_ARC * (1.5 - 0.5 * smooth01(0, 0.8, k));
            chuteShape.flutter = 3 - 2 * k;
            rig.slide = 0.04 + 0.96 * smooth01(0.08, 0.85, k);
            rig.billow = 1 - 0.6 * k;
            rig.bowTop = 0.35 * (1 - smooth01(0, 0.5, k));
          } else {
            // Flying: the span overshoots and settles, and the cells breathe in the first moments.
            const settle = Math.exp(-flown * 2.5);
            chuteShape.fill = CHUTE_FILLED;
            chuteShape.bunch = 1;
            chuteShape.stream = chuteShape.flog = 0;
            chuteShape.span = 1 + 0.035 * Math.sin(flown * 11) * settle;
            chuteShape.thick = 1 + 0.05 * Math.sin(flown * 9 + 1) * settle;
            chuteShape.chord = chuteShape.flutter = 1;
            chuteShape.arc = CHUTE_ARC;
            rig.slide = 1;
            rig.billow = 0.4;
          }
          // Toggles: the deployment brakes until they are unstowed, then the jumper's hands.
          const pullR = flying ? Math.max(chuteRig.flare, chuteRig.turn) : 0,
            pullL = flying ? Math.max(chuteRig.flare, -chuteRig.turn) : 0;
          chuteShape.brakeR = Math.max(clamp(pullR, 0, 1), chuteRig.brakes) * 1.3;
          chuteShape.brakeL = Math.max(clamp(pullL, 0, 1), chuteRig.brakes) * 1.3;
          chuteSkin.visible = chuteRibs.visible = !packed;
          if (!packed) chuteRebuild();
          // Pilot chute: out of the hand, inflating as it climbs on the bridle; then
          // it drags the bag up the lines; after line stretch it trails above the tail.
          chuteSkinPoint(0, 0.5, 0.5, true, chutePoint);
          if (phase === 'pilot') {
            const thrown = smooth01(0.3, 0.5, k),
              rise = smooth01(0.45, 1, k);
            chuteTmp.set(-thrown - 5 * rise, 1 + 2 * thrown + 13 * rise, 3 + 3 * thrown - 5 * rise);
            chutePilot.scale.setScalar(0.3 + 0.7 * smooth01(0.4, 0.85, k));
            chutePilot.visible = k > 0.25;
          } else if (phase === 'lines') {
            chuteTmp.set(-1.5 * stretch - 4 + Math.sin(chuteShape.time * 3.7) * 0.8, 1 + (CHUTE_LINES + 1) * stretch + 14, 1);
            chutePilot.scale.setScalar(1 + 0.06 * Math.sin(chuteShape.time * 9));
            chutePilot.visible = true;
          } else {
            // Trailing behind the tail; from where it towed the bag, over the first half of the snivel.
            chuteTmp.set(-18, chutePoint.y + 5, Math.sin(chuteShape.time * 1.3) * 1.5);
            if (phase === 'snivel') chuteTmp.lerp(chuteTmp2.set(-5.5, CHUTE_LINES + 16, 1), 1 - smooth01(0, 0.6, k));
            chutePilot.scale.setScalar(1 - 0.62 * inflate);
            chutePilot.visible = true;
          }
          chutePilot.position.copy(chuteTmp);
          chutePilot.rotation.set(0, 0, (phase === 'pilot' ? 0 : 0.5) + Math.sin(chuteShape.time * 3.1) * 0.15);
          // The bag: in the container, then climbing on top of the lines, then on the bridle under the pilot chute.
          chuteBag.visible = phase !== 'pilot';
          if (phase === 'lines') chuteBag.position.set(-1.5 * stretch, 1 + (CHUTE_LINES + 1) * stretch, 0);
          else chuteBag.position.set(chuteTmp.x + 1.5, chuteTmp.y - 3.5 * chutePilot.scale.x, chuteTmp.z);
          chuteBag.rotation.set(0, 0, phase === 'lines' ? 0 : 0.6);
          chutePilot.updateMatrixWorld();
          chuteRoot.updateMatrixWorld();
          chutePilot.getWorldPosition(rig.pilotWorld);
          chuteRigging(rig);
          chuteLines.visible = true;
          chuteSlider.visible = !packed;
          // The risers come out of the container with the bag.
          for (const r of chuteRisers) r.visible = phase !== 'pilot';
          return;
        }
        chuteBag.visible = false;
        chuteSkin.visible = chuteRibs.visible = true;
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
        chuteShape.fill = CHUTE_FILLED;
        chuteShape.bunch = 1;
        chuteShape.stream = chuteShape.flog = 0;
        // The wing lands ahead of the jumper, draped forward.
        chuteShape.shift = fall * 26;
        chuteRebuild();
        chuteRoot.updateMatrixWorld();
        rig.mode = 'canopy';
        rig.opening = 1;
        rig.slide = 1;
        rig.billow = rig.bowTop = rig.bowBottom = rig.bridleSlack = 0;
        rig.pilotWorld.copy(chuteRoot.position);
        chuteRigging(rig);
        chutePilot.visible = chuteSlider.visible = false;
        for (const r of chuteRisers) r.visible = false;
        chuteLines.visible = gather < 0.5;
      }
      // DeadEndCity.parachuteView(): the rig as drawn in the last frame (world metres; heights above the harness).
      function parachuteViewReport() {
        const r = (v, d = 2) => +v.toFixed(d),
          m = (v) => r(worldMeters(v), 2),
          p = player.parachute,
          root = chuteRoot.position;
        chuteSkinPoint(0, 0.3, 0.5, true, chutePoint);
        return {
          visible: chuteRoot.visible,
          phase: p ? (p.stage === 'canopy' ? p.phase : p.stage) : chuteRig.collapse ? 'collapse' : null,
          rootM: [m(root.x), m(root.y), m(root.z)],
          harnessToPlayerM: p ? m(Math.hypot(root.x - player.x, root.z - player.y, root.y - player.altitude)) : null,
          skin: chuteSkin.visible,
          crownM: m(chutePoint.y),
          spanM: m(CHUTE_SPAN * chuteShape.span),
          fill: r(Math.min(chuteShape.fill, CHUTE_FILLED) / CHUTE_FILLED),
          bunch: r(chuteShape.bunch),
          flog: r(chuteShape.flog),
          sliderM: chuteSlider.visible ? m(chuteGrommet[0].y) : null,
          slide: r(chuteRiggingState.slide),
          lines: chuteLines.visible ? chuteRiggingState.mode : null,
          bag: chuteBag.visible ? [m(chuteBag.position.x), m(chuteBag.position.y)] : null,
          pilot: chutePilot.visible ? r(chutePilot.scale.x) : null,
          upright: r(chuteRig.upright),
          pitchDeg: r((chuteRig.pitch * 180) / Math.PI, 1),
          brakes: r(chuteRig.brakes),
          accelG: r(chuteRig.accel / GRAVITY),
          cloud: r(cloudRigAmount),
          cloudLight: [r(cloudRigLight.r), r(cloudRigLight.g), r(cloudRigLight.b)],
          finite: [root.x, root.y, root.z, chutePoint.y, chuteRig.pitch].every(Number.isFinite),
        };
      }
