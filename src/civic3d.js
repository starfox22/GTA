      // BEGIN SUBSYSTEM: src/civic3d.js — Civic and rooftop meshes
      /**
       * Civic and rooftop meshes
       * Source: src/civic3d.js
       * Scope: createCityRenderer() closure.
       * Businesses, rooftop party, service signs and animated city lighting.
       */
      // The island ends at masonry seawalls, with open water beyond every coast.
      const coast = staticMat('#727d7b', 0.88),
        serviceRings = [];
      for (const d of DOCKS) {
        const group = new Three.Group();
        scene.add(group);
        batchGroups.push(group);
        for (let x = d.x + 2; x < d.x + d.w; x += 5) box(group, x, 1, d.y + d.h / 2, 4.5, 2, d.h, wood);
        for (const x of [d.x + 4, d.x + d.w - 4])
          for (const z of [d.y + 3, d.y + d.h - 3]) {
            box(group, x, 3, z, 2, 9, 2, wood);
            mesh(cylinderGeo, darkMetal, group, x, 5, z, 2, 2, 2);
          }
        sign('MARINA', d.x + d.w / 2, d.y - 3, 52, '#b3dfdd');
        statics.push({
          x: d.x + d.w / 2,
          y: d.y + d.h / 2,
          group,
          radius: 90,
        });
      }
      for (const p of PLACES) {
        const color = new Three.Color(p.color),
          group = new Three.Group();
        scene.add(group);
        const x = p.door.x,
          z = p.door.y;
        const ring = new Three.Mesh(
          new Three.RingGeometry(p.kind === 'rooftop' ? 7 : 15, p.kind === 'rooftop' ? 9 : 17, 40),
          new Three.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.6,
            side: Three.DoubleSide,
            depthWrite: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.28, z);
        group.add(ring);
        serviceRings.push(ring);
        if (p.x === undefined) {
          sign('SAFEHOUSE · ROOMS', x, z - 27, 95, p.color);
          box(group, x, 12, z - 29, 4, 24, 4, darkMetal);
          continue;
        }
        const face = p.y + p.h;
        if (p.kind !== 'rooftop') {
          // The fascia board sits above the entrance canopy (top at 19) so the
          // canopy does not hide the lower line of a two-line design.
          const width = Math.min(220, p.w * 0.85),
            board = sign(p.name, p.x + p.w / 2, face + 2, width, p.color);
          board.position.y = board.userData.backing.position.y = Math.max(board.position.y, 21 + width / 8);
        }
        // Recessed glass doors, lit entrances, steps and weather canopies.
        box(group, x, 8, face + 1, 17, 16, 1.2, glass);
        box(group, x, 8, face + 1.8, 0.7, 16, 0.3, chrome);
        box(group, x, 18, face + 7, 38, 2, 16, mat(p.kind === 'club' ? '#332745' : '#4f6464'));
        box(group, x, 0.8, face + 10, 34, 1.6, 17, concrete);
        // The lit entrance: a glow under the canopy, its colour on the steps and,
        // in the rain, down the wet road.
        addGlow(x, 15, face + 11, 30, p.color, 0.5, {});
        signSpill(x, face + 20, 70, p.color, 0.45, { width: 40, length: 90, strength: 0.9 });
        for (const side of [-1, 1]) {
          box(group, x + side * 17, 9, face + 13, 1.1, 18, 1.1, chrome);
          box(group, x + side * (p.w * 0.38), 1.5, face + 14, 23, 3, 10, concrete);
          for (let j = 0; j < 3; j++)
            mesh(
              sphereGeo,
              stillLeafMat,
              group,
              x + side * (p.w * 0.38) + j * 5 - 5,
              6,
              face + 14,
              5,
              4,
              4,
            );
        }
        if (p.kind === 'casino') {
          const gold = staticMat('#bd9654', 0.3, 0.65),
            ivory = staticMat('#d9c7a5'),
            nightGlass = staticMat('#203d48', 0.18, 0.65),
            burgundy = staticMat('#5d2c41');
          box(group, x, p.height + 4, p.y + p.h / 2, p.w * 0.62, 8, p.h * 0.55, ivory);
          box(group, x, p.height + 12, p.y + p.h / 2, p.w * 0.38, 8, p.h * 0.35, burgundy);
          // The stepped roof and its corner lanterns are roof plant (rooftops.js).
          const roof = buildings.find((b) => b.place === p.id);
          if (roof)
            (roof.roofKeepOuts || (roof.roofKeepOuts = [])).push(
              { x, y: p.y + p.h / 2, hx: p.w * 0.31 + 2, hy: p.h * 0.275 + 2, a: 0 },
              { x: x - 126, y: p.y + 30, hx: 8, hy: 8, a: 0 },
              { x: x + 126, y: p.y + 30, hx: 8, hy: 8, a: 0 },
            );
          for (let dx = -140; dx <= 140; dx += 28) {
            box(group, x + dx, 38, face - 2, 5, 72, 4, ivory);
            box(group, x + dx + 10, 38, face + 0.2, 14, 48, 0.5, nightGlass);
            for (const h of [21, 39, 57])
              box(
                group,
                x + dx + 10,
                h,
                face + 0.7,
                9,
                1,
                0.3,
                new Three.MeshBasicMaterial({
                  color: '#dab174',
                }),
              );
          }
          box(group, x, 28, face + 18, 166, 4, 42, burgundy);
          box(group, x, 30.2, face + 20, 168, 0.7, 44, gold);
          for (let dx = -66; dx <= 66; dx += 22) box(group, x + dx, 25.7, face + 29, 7, 0.6, 3, warmLamp);
          sign('GOLDEN TIDE', x, face + 41, 162, '#f8d78a', false, { marquee: true });
          // Marquee bulbs chase round the canopy's edge.
          bulbRow(x - 83, 26, face + 39.5, x + 83, 26, face + 39.5, 4.5, '#ffd27a');
          for (const side of [-1, 1]) bulbRow(x + side * 83, 26, face + 39.5, x + side * 83, 26, face + 2, 4.5, '#ffd27a');
          signSpill(x, face + 60, 120, '#ffc862', 0.4, { width: 150, length: 110, strength: 1 });
          for (const side of [-1, 1]) {
            box(group, x + side * 149, 45, face + 1, 4, 80, 3, gold);
            box(group, x + side * 126, p.height + 7, p.y + 30, 11, 14, 11, ivory);
          }
        }
        if (p.kind === 'hospital') {
          const red = staticMat('#a6313b');
          box(group, p.x + 34, p.height - 15, face + 2, 7, 24, 1.5, red);
          box(group, p.x + 34, p.height - 15, face + 2, 24, 7, 1.5, red);
          box(group, x, 22, face + 24, 88, 3, 37, staticMat('#b1ccca'));
          for (const side of [-1, 1]) box(group, x + side * 40, 11, face + 37, 2, 22, 2, concrete);
          sign('EMERGENCY · 24H', x, face + 43, 90, '#e5a0a0');
          for (let dx = -95; dx <= 95; dx += 38) {
            box(group, x + dx, 0.15, face + 59, 1, 0.2, 28, concrete);
            box(group, x + dx + 13, 0.15, face + 72, 25, 0.2, 1, concrete);
          }
        }
        if (p.kind === 'school') {
          box(group, p.x + 40, 32, face + 3, 1, 64, 1, chrome);
          box(group, p.x + 48, 56, face + 3, 16, 9, 0.5, staticMat('#c8b894'));
          const cx = p.x + p.w * 0.62,
            cz = face + 57;
          box(group, cx, 0.1, cz, 102, 0.2, 62, staticMat('#667e75'));
          for (const dz of [-30, 30]) box(group, cx, 0.3, cz + dz, 102, 0.3, 1, concrete);
          for (const dx of [-50, 50]) {
            box(group, cx + dx, 0.3, cz, 1, 0.3, 60, concrete);
            box(group, cx + dx, 14, cz, 1, 28, 1, chrome);
            box(group, cx + dx, 25, cz, 1, 9, 15, concrete);
            const hoop = mesh(
              new Three.TorusGeometry(3, 0.25, 5, 16),
              staticMat('#ad583c'),
              group,
              cx + dx + (dx > 0 ? -4 : 4),
              23,
              cz,
            );
            hoop.rotation.x = Math.PI / 2;
          }
          const mid = new Three.Mesh(
            new Three.RingGeometry(12, 12.8, 32),
            new Three.MeshBasicMaterial({
              color: '#dfd6b8',
              side: Three.DoubleSide,
            }),
          );
          mid.rotation.x = -Math.PI / 2;
          mid.position.set(cx, 0.3, cz);
          group.add(mid);
          box(group, cx, 0.3, cz, 1, 0.3, 60, concrete);
        }
        if (p.kind === 'bar') {
          for (const side of [-1, 1]) {
            const xx = x + side * 65,
              zz = face + 32;
            mesh(cylinderGeo, wood, group, xx, 7, zz, 8, 1.5, 8);
            box(group, xx, 3.5, zz, 1.5, 7, 1.5, chrome);
            for (const dx of [-11, 11]) {
              box(group, xx + dx, 4, zz, 5, 1, 6, wood);
              box(group, xx + dx, 2, zz, 1, 4, 1, chrome);
            }
            box(group, xx, 15, zz, 1, 30, 1, chrome);
            mesh(new Three.ConeGeometry(16, 5, 8), staticMat('#956459'), group, xx, 30, zz);
          }
        }
        if (p.kind === 'club') {
          // Colour-walking neon pillars that breathe to the beat, a tube frame round
          // the door and chasing bulbs along the canopy.
          const pillars = neonTube(p.color, { cycle: true, pulse: 2.1 }),
            frame = neonTube(p.color, { night: 5 });
          for (const side of [-1, 1]) {
            box(group, x + side * 47, 18, face + 2, 2, 33, 2, pillars);
            addGlow(x + side * 47, 24, face + 6, 36, p.color, 0.55, { mode: 'cycle', phase: side * 0.25 });
            box(group, x + side * 11, 8, face + 1.8, 0.9, 16, 0.9, frame);
            for (let dz = 18; dz < 58; dz += 14) {
              box(group, x + side * 14, 5, face + dz, 1, 10, 1, chrome);
              box(group, x + side * 14, 9, face + dz + 6, 1, 0.8, 14, staticMat('#9c485a'));
            }
          }
          box(group, x, 16.4, face + 1.8, 22.8, 0.9, 0.9, frame);
          bulbRow(x - 19, 17, face + 15.2, x + 19, 17, face + 15.2, 3.2, p.color);
          signSpill(x, face + 26, 90, p.color, 0.5, { width: 70, length: 110, strength: 1.3, mode: 'cycle' });
        }
        if (p.kind === 'sleep') {
          // A VACANCY neon on a post by the door; it stutters.
          box(group, x + 58, 13, face + 16, 1.2, 26, 1.2, darkMetal);
          atlasSign(group, windowNeonCell('VACANCY'), x + 58, 29, face + 16.8, 22, 11, neonBoardFlicker[0]);
          box(group, x + 58, 29, face + 16, 23, 12, 1, darkMetal);
          signSpill(x + 58, face + 28, 40, '#ff4f6d', 0.35, { width: 16, length: 60, strength: 0.9, mode: 'flicker' });
        }
        if (p.kind === 'guns') {
          for (const side of [-1, 1]) {
            box(group, x + side * 60, 11, face + 1, 43, 15, 1, glass);
            for (let dx = -16; dx <= 16; dx += 8)
              box(group, x + side * 60 + dx, 11, face + 2, 0.5, 15, 0.5, chrome);
          }
          sign('WEAPONS · AMMO · ARMOR', x, face + 36, 137, '#e9cb91');
        }
        if (p.kind === 'sleep')
          for (let dx = 30; dx < p.w; dx += 45) {
            box(group, p.x + dx, 9, face + 1, 14, 18, 1, staticMat('#4c7477'));
            box(group, p.x + dx, 11, face + 1.6, 8, 4, 0.4, glass);
          }
        statics.push({
          x: p.x + p.w / 2,
          y: p.y + p.h / 2,
          group,
          radius: Math.max(p.w, p.h),
        });
      }
      const bloodMaps = Array.from(
        {
          length: 4,
        },
        (_, i) => {
          const t = new Three.CanvasTexture(bloodStamp(i));
          t.colorSpace = Three.SRGBColorSpace;
          return t;
        },
      );
      const treadCanvas = document.createElement('canvas');
      treadCanvas.width = 64;
      treadCanvas.height = 16;
      const treadCtx = treadCanvas.getContext('2d');
      treadCtx.fillStyle = '#78101c';
      treadCtx.fillRect(0, 1, 64, 14);
      treadCtx.clearRect(0, 7, 64, 2);
      for (let x = 0; x < 64; x += 7) {
        treadCtx.clearRect(x, 0, 2, 16);
      }
      const treadMap = new Three.CanvasTexture(treadCanvas);
      treadMap.colorSpace = Three.SRGBColorSpace;
      const poolGeo = new Three.PlaneGeometry(1, 1),
        bloodMeshes = Array.from(
          {
            length: BLOOD_LIMIT,
          },
          () => {
            const m = new Three.Mesh(
              poolGeo,
              new Three.MeshStandardMaterial({
                map: bloodMaps[0],
                color: '#ffffff',
                // Satin, not a mirror. The street camera looks north-down at one fixed
                // angle, so on a mid-morning sun (east-north-east, ~45 degrees up) every
                // flat glossy surface in view sits right on the sun's mirror angle: at
                // roughness 0.27 the whole pool turned into a pale pink-white highlight.
                roughness: 0.62,
                envMapIntensity: 0.5,
                transparent: true,
                opacity: 0.97,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -2,
                polygonOffsetUnits: -2,
              }),
            );
            m.rotation.x = -Math.PI / 2;
            m.visible = false;
            m.renderOrder = 3;
            m.userData.blood = true;
            scene.add(m);
            return m;
          },
        );
      /**
       * TIME OF DAY
       * Sky, fog, sun and ambient colours follow daylight() through four keyframes:
       * night (cool moonlight), dawn/dusk (amber horizon, long warm shadows), day.
       * The dusk weight peaks when daylight is near 0.3 so sunsets read as sunsets.
       */
      const SKY_NIGHT = new Three.Color('#0d1524'),
        SKY_DAY = new Three.Color('#9fc0d8'),
        SKY_DUSK = new Three.Color('#c07a55'),
        SUN_NIGHT = new Three.Color('#7d93c4'),
        SUN_DUSK = new Three.Color('#ffa564'),
        SUN_DAY = new Three.Color('#fff4de'),
        HEMI_SKY_NIGHT = new Three.Color('#2f3d5e'),
        HEMI_SKY_DAY = new Three.Color('#cfe0f2'),
        HEMI_GROUND_NIGHT = new Three.Color('#1c1a22'),
        // Daylight bounces off pavement and planting, not off bare earth.
        HEMI_GROUND_DAY = new Three.Color('#6d6a52'),
        skyScratch = new Three.Color();
      let lastBadge = '';
      function updateCivicVisuals() {
        const light = daylight(),
          night = 1 - light,
          dusk = clamp(1 - Math.abs(light - 0.3) / 0.3, 0, 1);
        // Daylight is kept inside the tone curve's range: the pale pavements and
        // roofs used to sit on its shoulder at noon, so the city read washed out and
        // shadows grey. The sky fill is also kept well under the sun (about 1 : 3
        // on a sunlit pavement) so shadows read. Exposure stays where it was, so
        // display-referred shaders (water, signs, sky) look as designed.
        const daylightScale = 1 - 0.29 * light;
        // (More sky fill through twilight, or roofs facing away from the low sun
        // went black against the lit streets.)
        hemi.intensity = 0.45 + light * 0.5 + dusk * 0.35;
        hemi.color.copy(HEMI_SKY_NIGHT).lerp(HEMI_SKY_DAY, light);
        hemi.groundColor.copy(HEMI_GROUND_NIGHT).lerp(HEMI_GROUND_DAY, light);
        // Golden hour: the low sun is a strong warm key, not a fading one.
        sun.intensity = (0.35 + light * 3.75 + dusk * 0.9) * daylightScale;
        sun.color.copy(SUN_NIGHT).lerp(SUN_DAY, light).lerp(SUN_DUSK, dusk * 0.85);
        fill.intensity = 0.28 + night * 0.25;
        skyScratch.copy(SKY_NIGHT).lerp(SKY_DAY, light).lerp(SKY_DUSK, dusk * 0.6);
        scene.background.copy(skyScratch);
        scene.fog.color.copy(skyScratch);
        renderer.toneMappingExposure = 1.1 + night * 0.16 + dusk * 0.07;
        const badge =
          'SOUTH COAST · ' +
          (light < 0.1
            ? 'NIGHT'
            : light < 0.4
              ? dusk > 0.5 && (worldMinutes % 1440) / 60 < 12
                ? 'DAWN'
                : 'DUSK'
              : 'DAY') +
          ' · ' +
          weatherLabel();
        if (badge !== lastBadge) getElement('renderBadge').textContent = lastBadge = badge;
        for (let i = 0; i < bloodMeshes.length; i++) {
          const m = bloodMeshes[i],
            p = bloodPools[i];
          m.visible =
            bloodOn &&
            !!p &&
            Math.abs(p.x - cameraTarget.x) < 850 &&
            Math.abs(p.y - cameraTarget.y) < 950;
          if (!m.visible) continue;
          const age = gameTime - p.created,
            growth = p.grow ? 1 + Math.min(0.28, age * 0.045) : 1;
          m.position.set(p.x, (p.surface || 0) + 0.32, p.y);
          m.rotation.z = -p.a;
          m.scale.set(
            p.track ? p.r * 2.6 : p.r * 2.5 * growth,
            p.track ? p.r * 0.46 : p.r * 2.5 * growth,
            1,
          );
          m.material.map = p.track ? treadMap : bloodMaps[p.variant || 0];
          m.material.opacity = (p.opacity ?? 0.95) * clamp((240 - age) / 35, 0, 1);
        }
      }
      // END SUBSYSTEM: src/civic3d.js
