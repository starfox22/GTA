      // Parachute 3D canopy: the ram-air wing's meshes and materials, its shape (chuteShape, chuteSkinPoint: airfoil,
      // arc, cell-by-cell pressurisation, flogging cloth before it) and the in-cloud light on the rig (chuteCloudLit).
      const CHUTE_CELLS = 9,
        CHUTE_SEGMENTS = 6, // spanwise segments per cell
        CHUTE_ROWS = 16, // chordwise segments
        CHUTE_SPAN = 56,
        CHUTE_CHORD = 21,
        CHUTE_THICK = 0.16, // of the chord
        CHUTE_ARC = 0.62, // half the arc of the span, radians
        CHUTE_LINES = 38, // harness to the centre of the lower skin
        CHUTE_MOUTH = 0.06, // the lower skin starts this far back: the cell openings
        CHUTE_FILLED = 1.6; // chuteShape.fill at which every cell is pressurised
      // Panel colours across the span, tip to tip (linear-ish sRGB hex).
      const CHUTE_PANELS = ['#1d2f5e', '#e8e4da', '#d2362a', '#d2362a', '#f0c23a', '#d2362a', '#d2362a', '#e8e4da', '#1d2f5e'];
      const chuteRoot = new Three.Group();
      chuteRoot.name = 'Player parachute';
      chuteRoot.visible = false;
      scene.add(chuteRoot);
      /* Inside a cloud the rig is lit by the cloud around it, not by the sun: every
         direction the same dim, diffuse light, so the cloth loses its sunlit side and
         its shadows and greys into the fog with the veil (clouds3d-frame.js sets
         cloudRigLight and cloudRigAmount; chuteCloudTint copies them in). rgb the
         light, a how far in cloud. */
      const chuteCloudUniform = { value: new Three.Vector4(1, 1, 1, 0) };
      function chuteCloudLit(material) {
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uChuteCloud = chuteCloudUniform;
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec4 uChuteCloud;')
            .replace(
              '#include <opaque_fragment>',
              'outgoingLight = mix(outgoingLight, diffuseColor.rgb * uChuteCloud.rgb, uChuteCloud.a);\n#include <opaque_fragment>',
            );
        };
        material.customProgramCacheKey = () => 'chute-cloud';
        return material;
      }
      // The wing is built in the rig's frame: x forward, y up, z to the right; the
      // origin is the harness (the jumper's shoulders).
      const chuteMaterial = chuteCloudLit(
        new Three.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.62,
          metalness: 0,
          side: Three.DoubleSide,
        }),
      );
      /* One strip of skin per cell, (CHUTE_SEGMENTS + 1) x (CHUTE_ROWS + 1) vertices,
         upper then lower; `chuteSkinInfo` holds each vertex's (s, c, f, upper) and
         `chuteSkinBase` its cloth colour (shaded per frame while cells fill). */
      const chuteColumns = CHUTE_SEGMENTS + 1,
        chuteRowsN = CHUTE_ROWS + 1,
        chutePerStrip = chuteColumns * chuteRowsN,
        chuteVertexCount = CHUTE_CELLS * chutePerStrip * 2;
      const chuteSkinPos = new Float32Array(chuteVertexCount * 3),
        chuteSkinColor = new Float32Array(chuteVertexCount * 3),
        chuteSkinBase = new Float32Array(chuteVertexCount * 3),
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
                chuteSkinBase.set([tone.r * tape, tone.g * tape, tone.b * tape], v * 3);
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
        chuteSkinColor.set(chuteSkinBase);
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
      /* ---- Shape ------------------------------------------------------------------- */
      // NACA 4-digit half-thickness, 1 at 30% chord.
      function chuteAirfoil(c) {
        const x = clamp(c, 0, 1);
        return 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x) / 0.6;
      }
      const chuteShape = {
        span: 1, // spanwise scale of the pressurised wing (the slider holds it narrow)
        chord: 1,
        thick: 1,
        arc: CHUTE_ARC,
        height: CHUTE_LINES,
        brakeL: 0,
        brakeR: 0,
        time: 0,
        flutter: 1,
        shift: 0, // forward offset of the whole wing (the collapse drapes it ahead)
        /* Pressurisation: the front of it across the span from the centre out, nose
           first (0 none .. CHUTE_FILLED every cell); `bunch` how far the cloth not yet
           under pressure is gathered in by the slider (0 all of it .. 1 none), `stream`
           how far it trails up into the relative wind, `flog` how hard it flaps. */
        fill: CHUTE_FILLED,
        bunch: 1,
        stream: 0,
        flog: 0,
      };
      const chutePoint = new Three.Vector3();
      // How far the cell at span `s`, chord `c` is pressurised (0 flat cloth .. 1 a full airfoil).
      function chuteCellFill(s, c) {
        const front = chuteShape.fill;
        if (front >= CHUTE_FILLED) return 1;
        const t = clamp((front - Math.abs(s) - 0.25 * c) / 0.3, 0, 1);
        return t * t * (3 - 2 * t);
      }
      // Position of skin point (s, c) on the upper (or lower) skin, `f` through its cell.
      function chuteSkinPoint(s, c, f, upper, out) {
        const sh = chuteShape,
          fill = chuteCellFill(s, c),
          halfSpan = (CHUTE_SPAN / 2) * sh.span,
          arc = Math.max(0.05, sh.arc),
          radius = halfSpan / arc,
          theta = s * arc,
          // A cell not yet under pressure is a flat, slack sheet: the two skins together.
          chord = CHUTE_CHORD * sh.chord * (0.72 + 0.28 * fill),
          thickness = CHUTE_THICK * chord * sh.thick * (0.1 + 0.9 * fill);
        // Tail deflection: each toggle pulls the tail down on its own side.
        const brake = (s < 0 ? sh.brakeL : sh.brakeR) * (0.35 + 0.65 * Math.abs(s)),
          tail = c * c * c;
        let radial = upper ? thickness * chuteAirfoil(c) : -thickness * 0.08 * Math.sin(Math.PI * c);
        // Pillows between the ribs: the upper skin bulges, the lower skin a little.
        const pillow = Math.sin(Math.PI * f);
        radial += upper ? pillow * thickness * 0.22 * (1 - c * 0.6) : -pillow * thickness * 0.07;
        // Breathing and a ripple running along the trailing edge.
        radial *= 1 + 0.035 * Math.sin(sh.time * 2.7 + s * 2.1);
        // The skins never quite meet, even where a cell is flat.
        radial += upper ? 0.16 : -0.16;
        const flutter = sh.flutter * tail * (0.35 * Math.sin(sh.time * 17 + s * 9 + c * 4) + 0.2 * Math.sin(sh.time * 29 - s * 13)),
          // Ripples chasing over cloth that is out but not yet under pressure.
          ripple = sh.flog * (1 - fill) * (0.9 * Math.sin(sh.time * 19 + s * 13 + c * 8) + 0.5 * Math.sin(sh.time * 31 - s * 7 + c * 15));
        const x = chord * (0.36 - c) + brake * tail * -1.5 + sh.shift,
          down = brake * tail * chord * 0.55 + flutter + ripple,
          r = radius + radial - down;
        out.set(x, sh.height + r * Math.cos(theta) - radius, r * Math.sin(theta));
        const gather = (1 - fill) * (1 - sh.bunch);
        if (gather > 0.001) {
          /* Not yet pressurised and still inside the slider's grip: gathered in
             towards the centre, trailing up into the relative wind in folds (the end
             cells furthest), flogging. The two skins keep a little apart. */
          const t = sh.time,
            a = Math.abs(s),
            crease = Math.sin(s * 41 + c * 29) * Math.sin(s * 23 - c * 37),
            flap = sh.flog * (Math.sin(t * 23 + s * 11 + c * 7) + 0.6 * Math.sin(t * 37 - s * 19 + c * 5)),
            bx = CHUTE_CHORD * 0.55 * (0.36 - c) * (1 - 0.3 * a) + flap * 0.5,
            by = sh.height + 1.5 + sh.stream * (a * 7 + c * 3) + crease * 0.9 + flap * 0.6 + (upper ? 0.3 : -0.3),
            bz = s * CHUTE_SPAN * 0.1 * (1 + 0.4 * sh.stream * a) + crease * 0.7 + flap * 0.6 * a;
          out.x += (bx - out.x) * gather;
          out.y += (by - out.y) * gather;
          out.z += (bz - out.z) * gather;
        }
        return out;
      }
      let chuteShaded = false;
      function chuteRebuild() {
        // Cloth still bunched in its own folds reads darker until the cells fill out.
        const shading = chuteShape.fill < CHUTE_FILLED;
        for (let v = 0; v < chuteVertexCount; v++) {
          const s = chuteSkinInfo[v * 4],
            c = chuteSkinInfo[v * 4 + 1],
            f = chuteSkinInfo[v * 4 + 2],
            upper = chuteSkinInfo[v * 4 + 3] > 0.5;
          chuteSkinPoint(s, c, f, upper, chutePoint);
          chuteSkinPos[v * 3] = chutePoint.x;
          chuteSkinPos[v * 3 + 1] = chutePoint.y;
          chuteSkinPos[v * 3 + 2] = chutePoint.z;
          if (shading) {
            const shade = 0.66 + 0.34 * chuteCellFill(s, c);
            chuteSkinColor[v * 3] = chuteSkinBase[v * 3] * shade;
            chuteSkinColor[v * 3 + 1] = chuteSkinBase[v * 3 + 1] * shade;
            chuteSkinColor[v * 3 + 2] = chuteSkinBase[v * 3 + 2] * shade;
          }
        }
        if (shading || chuteShaded) {
          if (!shading) chuteSkinColor.set(chuteSkinBase);
          chuteSkinGeometry.attributes.color.needsUpdate = true;
          chuteShaded = shading;
        }
        chuteSkinGeometry.attributes.position.needsUpdate = true;
        chuteSkinGeometry.computeVertexNormals();
        chuteSkinGeometry.computeBoundingSphere();
        // Ribs: the airfoil outline at each rib (upper surface forward, lower back).
        for (let rib = 0; rib < chuteRibCount; rib++) {
          const s = (rib / CHUTE_CELLS) * 2 - 1,
            base = rib * (CHUTE_RIB_POINTS * 2 + 1);
          chuteSkinPoint(s, 0.3, 0, true, chutePoint);
          const tx = chutePoint.x,
            ty = chutePoint.y,
            tz = chutePoint.z;
          chuteSkinPoint(s, 0.3, 0, false, chutePoint);
          chuteRibPos.set([(tx + chutePoint.x) / 2, (ty + chutePoint.y) / 2, (tz + chutePoint.z) / 2], base * 3);
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
