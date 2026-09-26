      // Cityscape 3D roof props and facades: AC units, water towers, billboards, helipads, shopfronts, fire escapes (decorateRoof).
      // ---- Roof props ----------------------------------------------------------------
      /* Roof plant is recorded on its building as `b.roofKeepOuts` (world-space
         boxes) while the building is dressed: a helicopter will not set down on it
         and a player on the roof walks round it (rooftops.js). */
      function roofKeepOut(x, y, w, d) {
        if (roofOwner) (roofOwner.roofKeepOuts || (roofOwner.roofKeepOuts = [])).push({ x, y, hx: w / 2, hy: d / 2, a: 0 });
      }
      function acCluster(gx, top, gz, count) {
        for (let j = 0; j < count; j++) {
          const x = gx + j * 21,
            z = gz + (j % 2) * 6;
          place(pools.acUnit, x, top + 4.5, z, 17, 9, 14);
          place(pools.acFan, x, top + 9.3, z, 5.5, 0.6, 5.5);
          place(pools.pipe, x + 9, top + 2.5, z, 0.7, 5, 0.7);
        }
      }
      function waterTower(group, x, top, z) {
        roofKeepOut(group.position.x + x, group.position.z + z, 24, 24);
        const legs = [-6, 6];
        for (const dx of legs) for (const dz of legs) box(group, x + dx, top + 8, z + dz, 1, 16, 1, darkMetal);
        box(group, x, top + 9, z, 15, 0.8, 15, darkMetal);
        mesh(new Three.CylinderGeometry(9.5, 9.5, 17, 16), wood, group, x, top + 25, z);
        mesh(new Three.ConeGeometry(11, 5.5, 16), darkMetal, group, x, top + 36, z);
        for (const y of [19, 26, 32]) box(group, x, top + y, z, 0.6, 0.6, 20.2, darkMetal);
      }
      function bulkhead(group, x, top, z, w = 18, d = 14, h = 11, material = concrete) {
        roofKeepOut(group.position.x + x, group.position.z + z, w + 3, d + 3);
        box(group, x, top + h / 2, z, w, h, d, material);
        box(group, x, top + h + 0.6, z, w + 1.5, 1.2, d + 1.5, darkMetal);
        box(group, x, top + h * 0.45, z + d / 2 + 0.3, 5, h * 0.8, 0.5, staticMat('#3a4247'));
      }
      function billboard(group, x, top, z, width, faceSouth = true) {
        roofKeepOut(group.position.x + x, group.position.z + z, width + 4, 5);
        const height = width * 0.3125,
          led = cityRandom() < 0.45,
          face = new Three.Mesh(
            led ? new Three.PlaneGeometry(width, height) : adPlane(width, height, Math.floor(cityRandom() * ADS.length)),
            led ? cityPick(adChannels).material : adBoardMaterial,
          );
        face.position.set(x, top + 9 + height / 2, z + (faceSouth ? 0.7 : -0.7));
        if (!faceSouth) face.rotation.y = Math.PI;
        face.receiveShadow = true;
        group.add(face);
        box(group, x, top + 9 + height / 2, z, width + 2, height + 2, 1, darkMetal);
        for (const dx of [-width * 0.35, width * 0.35]) box(group, x + dx, top + 4.5, z, 0.8, 9, 0.8, darkMetal);
        if (led) {
          // A screen: a thin bezel and a status light, no lamps.
          box(group, x, top + 9 + height + 0.9, z + (faceSouth ? 0.6 : -0.6), width + 2, 0.8, 0.4, chrome);
          return;
        }
        // Goose-neck lamps over the board wash it at night.
        for (const dx of [-width * 0.3, 0, width * 0.3]) {
          box(group, x + dx, top + 9 + height + 2.5, z + 3, 1, 1, 6, darkMetal);
          addGroupGlow(group, x + dx, top + 9 + height + 1.4, z + (faceSouth ? 5 : -5), 9, '#ffe7c2', 1.4, {});
        }
      }
      // A rooftop helipad sized for the helicopter (b.helipad, rooftops.js): the
      // pad replaces the usual roof clutter, with one stair bulkhead in a corner.
      function roofHelipad(group, b, top) {
        const pad = b.helipad,
          x = pad.x - b.x,
          z = pad.y - b.y,
          r = pad.r,
          s = r / 22;
        mesh(new Three.CylinderGeometry(r, r, 0.6, 40), staticMat('#3f464b', 0.85), group, x, top + 0.3, z);
        const ring = new Three.Mesh(
          new Three.RingGeometry(r - 5 * s, r - 3 * s, 48),
          new Three.MeshBasicMaterial({ color: '#f1e3ad', side: Three.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, top + 0.7, z);
        group.add(ring);
        const h = new Three.MeshBasicMaterial({ color: '#f1e3ad' });
        box(group, x - 6 * s, top + 0.7, z, 2.5 * s, 0.1, 18 * s, h);
        box(group, x + 6 * s, top + 0.7, z, 2.5 * s, 0.1, 18 * s, h);
        box(group, x, top + 0.7, z, 12 * s, 0.1, 2.5 * s, h);
        for (let k = 0; k < 12; k++) {
          const a = (k * TAU) / 12;
          addGroupGlow(group, x + Math.cos(a) * (r - 1), top + 1.5, z + Math.sin(a) * (r - 1), 6, '#a9f5c2', 1.8, { day: 0.15 });
        }
        bulkhead(group, 20, top, 16);
      }
      function pergola(group, x, top, z, w, d) {
        roofKeepOut(group.position.x + x, group.position.z + z + 5, w + 4, d + 14);
        for (const dx of [-w / 2, w / 2])
          for (const dz of [-d / 2, d / 2]) box(group, x + dx, top + 5.5, z + dz, 1, 11, 1, wood);
        for (let k = -w / 2; k <= w / 2; k += 4) box(group, x + k, top + 11, z, 0.8, 0.8, d + 2, wood);
        box(group, x, top + 10.2, z + d / 2, w + 2, 0.8, 0.8, wood);
        box(group, x, top + 10.2, z - d / 2, w + 2, 0.8, 0.8, wood);
        // Instanced props live in world space; the pergola is placed in group-local space.
        const wx = group.position.x,
          wz = group.position.z,
          wy = group.position.y;
        for (let k = -w / 2 + 6; k < w / 2; k += 12) {
          place(pools.planter, wx + x + k, wy + top + 1.5, wz + z + d / 2 + 5, 8, 3, 5);
          place(pools.shrub, wx + x + k, wy + top + 5, wz + z + d / 2 + 5, 4, 3, 3);
        }
        // Festoon bulbs along the pergola beam.
        for (let k = -w / 2 + 3; k <= w / 2 - 3; k += 6) addGroupGlow(group, x + k, top + 9.6, z + d / 2, 3.2, '#ffd9a0', 1.3, { mode: 'pulse', phase: k * 0.01 });
      }
      function sawtoothRoof(group, b, top) {
        const rows = Math.max(1, Math.floor(b.h / 34));
        for (let r = 0; r < rows; r++) {
          const z = 17 + r * 34;
          box(group, b.w / 2, top + 4, z + 6, b.w - 14, 8, 14, staticMat('#6f7c83', 0.55, 0.4));
          place(pools.skylight, b.x + b.w / 2, top + 5.5, b.y + z - 4, b.w - 18, 7, 1.2);
        }
        for (let k = 0; k < Math.floor(b.w / 60); k++) {
          const x = 30 + k * 60;
          place(pools.vent, b.x + x, top + 6, b.y + b.h - 12, 3, 12, 3);
          place(pools.vent, b.x + x, top + 12.8, b.y + b.h - 12, 4.5, 1.6, 4.5);
        }
      }
      function decorateRoof(kind, b, group, i) {
        const top = b.height,
          gx = b.x,
          gz = b.y;
        if (kind === 'hotel') return;
        if (b.helipad) {
          roofHelipad(group, b, top);
          return;
        }
        if (kind === 'warehouse') {
          sawtoothRoof(group, b, top);
          if (cityRandom() < 0.6) {
            place(pools.chimney, gx + b.w - 18, top + 12, gz + 18, 8, 24, 8);
            place(pools.vent, gx + b.w - 18, top + 25, gz + 18, 2.2, 3, 2.2);
          }
          place(pools.tank, gx + 22, top + 7, gz + b.h - 24, 9, 14, 9);
          return;
        }
        // Access bulkhead on almost every roof.
        if (cityRandom() < 0.85) bulkhead(group, 20 + cityRandom() * 12, top, 16 + cityRandom() * 10);
        if (kind === 'tower') {
          // Plant sits on the finished crown, not buried inside the setbacks.
          const crownTop = top + (b.crownHeight || 0);
          bulkhead(group, b.w / 2, crownTop, b.h / 2, b.w * 0.3, b.h * 0.28, 14 + (i % 3) * 5, staticMat('#8c949a', 0.6, 0.3));
          const penthouseTop = crownTop + 14 + (i % 3) * 5;
          acCluster(gx + b.w * 0.2, penthouseTop, gz + b.h * 0.25, Math.max(1, Math.floor(b.w / 95)));
          box(group, b.w / 2, penthouseTop + 12, b.h / 2, 1.2, 24, 1.2, darkMetal);
          const beacon = mesh(sphereGeo, beaconMaterial, group, b.w / 2, penthouseTop + 25, b.h / 2, 1.6, 1.6, 1.6);
          beacons.push(beacon);
          addGroupGlow(group, b.w / 2, penthouseTop + 25, b.h / 2, 22, '#ff3020', 5, { mode: 'beacon', day: 0.35, phase: (i % 7) / 7 });
          if (cityRandom() < 0.5) {
            for (let k = 0; k < 3; k++) place(pools.solar, gx + b.w - 12 - k * 11, top + 2.5, gz + b.h - 12, 9, 0.6, 16, 0.3);
          }
          for (const dx of [7, b.w - 7]) for (const dz of [7, b.h - 7]) place(pools.vent, gx + dx, top + 3, gz + dz, 1.6, 6, 1.6);
          return;
        }
        if (kind === 'office') {
          acCluster(gx + 24, top, gz + b.h - 34, Math.max(2, Math.floor(b.w / 70)));
          if (!b.place && cityRandom() < 0.5) billboard(group, b.w / 2, top, b.h - 4, Math.min(120, b.w * 0.6));
          if (cityRandom() < 0.5) place(pools.dish, gx + b.w - 20, top + 6, gz + 22, 6, 3, 6);
          for (let k = 0; k < Math.floor(b.w / 45); k++) place(pools.hatch, gx + 14 + k * 45, top + 0.6, gz + b.h / 2, 6, 1.2, 6);
          if (cityRandom() < 0.4)
            for (let k = 0; k < 4; k++) place(pools.solar, gx + 40 + k * 15, top + 2.2, gz + 30, 13, 0.6, 20, 0.28);
          return;
        }
        if (kind === 'brick' || kind === 'stucco') {
          if (cityRandom() < (kind === 'brick' ? 0.42 : 0.2)) waterTower(group, b.w - 32, top, b.h - 30);
          if (cityRandom() < 0.6) place(pools.chimney, gx + 14 + cityRandom() * (b.w - 28), top + 5, gz + 12 + cityRandom() * (b.h - 24), 5, 10, 5);
          if (cityRandom() < 0.45) acCluster(gx + b.w * 0.3, top, gz + b.h * 0.55, 1 + Math.floor(cityRandom() * 2));
          if (cityRandom() < 0.35) place(pools.skylight, gx + b.w * 0.55, top + 2.5, gz + b.h * 0.3, 16, 5, 10);
          if (cityRandom() < 0.18) pergola(group, b.w * 0.5, top, b.h * 0.55, Math.min(50, b.w * 0.4), 22);
          if (cityRandom() < 0.3) place(pools.dish, gx + b.w - 18, top + 4, gz + b.h - 20, 4.5, 2.2, 4.5);
          if (cityRandom() < 0.3) {
            roofKeepOut(gx + 46, gz + 10, 44, 10);
            for (let k = 0; k < 3; k++) {
              place(pools.planter, gx + 30 + k * 16, top + 1.5, gz + 10, 9, 3, 6);
              place(pools.shrub, gx + 30 + k * 16, top + 5, gz + 10, 4, 3.2, 3);
            }
          }
          for (let k = 0; k < 2 + Math.floor(cityRandom() * 3); k++)
            place(pools.vent, gx + 10 + cityRandom() * (b.w - 20), top + 2.5, gz + 10 + cityRandom() * (b.h - 20), 1.4, 5, 1.4);
          if (!b.place && cityRandom() < 0.25 && b.w > 150) billboard(group, b.w / 2, top, b.h - 4, Math.min(90, b.w * 0.5));
          return;
        }
        if (kind === 'deco' || kind === 'decoTower') {
          const wide = b.w > 200;
          if (cityRandom() < 0.7) pergola(group, wide ? b.w * 0.3 : b.w / 2, top, b.h * 0.5, Math.min(46, b.w * 0.35), 20);
          if (cityRandom() < 0.5) acCluster(gx + b.w - 60, top, gz + 22, 1 + Math.floor(cityRandom() * 2));
          const signWidth = Math.min(110, b.w * 0.7),
            color = hotelNeonColor(i);
          atlasSign(group, hotelScriptCell(i), b.w / 2, top + 12, b.h + 0.8, signWidth, signWidth * (84 / 384), i % 4 === 1 ? neonCutoutFlicker : neonCutout);
          roofKeepOut(gx + b.w / 2, gz + b.h - 2, Math.min(112, b.w * 0.72) + 4, 6);
          box(group, b.w / 2, top + 6, b.h - 2, Math.min(112, b.w * 0.72), 1, 1, darkMetal);
          for (const dx of [-Math.min(50, b.w * 0.3), Math.min(50, b.w * 0.3)])
            box(group, b.w / 2 + dx, top + 8, b.h - 2, 0.8, 16, 0.8, darkMetal);
          // A soft coloured haze round the letters (the bloom sharpens it).
          for (const dx of [-0.3, 0, 0.3]) addGroupGlow(group, b.w / 2 + dx * signWidth, top + 12, b.h + 3, signWidth * 0.45, color, 0.25, {});
        }
      }
      // ---- Facade details: shopfronts, awnings, fire escapes ------------------------
      function shopSignStyle(b) {
        const district = districtAt(b.x + b.w / 2, b.y + b.h / 2),
          old = district.includes('OLD QUARTER') || district.includes('IRONWORKS') || district === 'BATTERY POINT' || district === 'BROADWAY',
          r = cityRandom();
        if (b.tropical) return r < 0.65 ? 'neon' : 'lightbox';
        if (old) return r < 0.5 ? 'neon' : r < 0.82 ? 'lightbox' : 'channel';
        return r < 0.3 ? 'neon' : r < 0.68 ? 'lightbox' : 'channel';
      }
      function shopfront(group, b, kind, i) {
        let windowNeon = cityRandom() < 0.4 ? cityPick(WINDOW_NEONS) : null;
        // The ground floor is SHOP_FLOOR (4.5 m) high: a 2.3 m door, glazing from a
        // low sill to 3.6 m, awnings at 3.2 m and the sign on the fascia above.
        const face = b.h + 0.6,
          bays = Math.max(1, Math.floor((b.w - 16) / 46)),
          bayWidth = (b.w - 16) / bays,
          glassTop = SHOP_FLOOR * 0.8,
          awningY = SHOP_FLOOR * 0.72,
          signY = SHOP_FLOOR + 4;
        box(group, b.w / 2, SHOP_FLOOR / 2, b.h + 0.4, b.w - 2, SHOP_FLOOR, 1.2, staticMat('#2b3033', 0.7, 0.2));
        box(group, b.w / 2, SHOP_FLOOR + 0.6, b.h + 1.2, b.w, 1.4, 2.6, mat(kind === 'stucco' ? '#d9c8a8' : '#4a4d50'));
        for (let k = 0; k < bays; k++) {
          const x = 8 + bayWidth * (k + 0.5),
            door = k === Math.floor(bays / 2);
          if (door) {
            box(group, x, DOOR_HEIGHT / 2, face + 0.2, 8, DOOR_HEIGHT, 0.6, staticMat('#3f2f28'));
            box(group, x, DOOR_HEIGHT / 2, face + 0.6, 0.6, DOOR_HEIGHT, 0.3, chrome);
            box(group, x, DOOR_HEIGHT + 0.6, face + 0.4, 9, 0.8, 0.6, chrome);
            // A transom light over the door, up to the glazing line.
            box(group, x, (DOOR_HEIGHT + 1 + glassTop) / 2, face + 0.2, 8, glassTop - DOOR_HEIGHT - 1, 0.5, shopGlassMaterial);
          } else {
            box(group, x, (3 + glassTop) / 2, face + 0.2, bayWidth - 8, glassTop - 3, 0.5, shopGlassMaterial);
            // The pane in world space, so a bullet can star it and a blast blow it in.
            (b.shopPanes || (b.shopPanes = [])).push({
              x0: b.x + x - (bayWidth - 8) / 2,
              x1: b.x + x + (bayWidth - 8) / 2,
              cx: b.x + x,
              width: bayWidth - 8,
              face: b.y + face + 0.45,
              state: 0,
              hits: 0,
            });
            box(group, x, 1.8, face + 0.3, bayWidth - 8, 2.4, 0.7, staticMat('#5b5f63'));
            if (windowNeon) {
              const color = windowNeonColor(windowNeon);
              atlasSign(group, windowNeonCell(windowNeon), x, 14, face + 0.9, Math.min(14, bayWidth - 12), Math.min(14, bayWidth - 12) / 2, cityRandom() < 0.3 ? neonCutoutFlicker : neonCutout);
              addGroupGlow(group, x, 14, face + 2, 16, color, 0.18, {});
              // One per shop, in its first window.
              windowNeon = null;
            }
          }
          if (!door && cityRandom() < 0.55) {
            const awning = box(group, x, awningY, face + 5.4, bayWidth - 6, 0.7, 11, cityPick(awningMaterials));
            awning.rotation.x = 0.42;
            const stripe = box(group, x, awningY, face + 5.4, bayWidth - 6, 0.75, 11, awningStripe);
            stripe.rotation.x = 0.42;
            stripe.scale.x = 0.34;
            // Someone standing under it is out of sight of the helicopter (air-cover.js).
            registerOverheadCover(b.x + x, b.y + face + 5.4, (bayWidth - 6) / 2, 5.4, 0, awningY - 2.4, awningY + 2.4, 'awning');
          }
        }
        const style = shopSignStyle(b),
          name = SHOP_NAMES[(i * 7 + Math.floor(cityRandom() * 5)) % SHOP_NAMES.length],
          signWidth = Math.min(72, Math.max(44, bayWidth * 1.4)),
          signX = 8 + bayWidth * 0.5 + (bays > 2 ? bayWidth : 0),
          cell = shopSignCell(name),
          light = shopSignLight(name),
          flicker = shopSignIsNeon(name) && cityRandom() < 0.14;
        atlasSign(group, cell, signX, signY, b.h + 1.9, signWidth, signWidth / 4, flicker ? cityPick(neonBoardFlicker) : neonBoard);
        box(group, signX, signY, b.h + 1.2, signWidth + 2, signWidth / 4 + 2, 0.8, darkMetal);
        // Colour on the pavement and, in the rain, smeared down the wet road.
        signSpill(b.x + signX, b.y + b.h + 14, signWidth * 0.8, light, style === 'lightbox' ? 0.3 : 0.4, {
          width: signWidth * 0.8,
          length: 70,
          strength: style === 'lightbox' ? 0.7 : 1.1,
          mode: flicker ? 'flicker' : 'steady',
        });
      }
      function fireEscape(group, b) {
        const x = Math.max(24, b.w * 0.3),
          floors = Math.floor((b.height - SHOP_FLOOR) / STOREY);
        for (let f = 1; f <= floors; f++) {
          const y = SHOP_FLOOR + (f - 1) * STOREY;
          box(group, x, y, b.h + 3.2, 24, 0.6, 6, darkMetal);
          for (const dx of [-11, 11]) box(group, x + dx, y + 3, b.h + 6, 0.5, 6, 0.5, darkMetal);
          box(group, x, y + 6, b.h + 6.2, 24, 0.5, 0.5, darkMetal);
          if (f < floors)
            rod(
              group,
              new Three.Vector3(x + (f % 2 ? -11 : 11), y + 0.5, b.h + 4),
              new Three.Vector3(x + (f % 2 ? 11 : -11), y + STOREY - 0.5, b.h + 4),
              0.4,
              darkMetal,
            );
        }
      }
      function balconies(group, b, material) {
        const floors = Math.floor((b.height - SHOP_FLOOR) / STOREY) + 1;
        for (let f = 1; f < floors; f++) {
          const y = SHOP_FLOOR + (f - 1) * STOREY;
          for (let x = 16; x < b.w - 12; x += 30) {
            box(group, x, y, b.h + 2.4, 18, 0.8, 5, material);
            box(group, x, y + 3, b.h + 4.6, 18, 5, 0.4, glass);
          }
        }
      }
      // @include src/skyline3d.js
      // ---- Build every building -------------------------------------------------------
      const cityStreetSouth = (b) => cityStreetAt(b.x + b.w / 2, b.y + b.h + 44, 10);
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        // Fort Sentinel's buildings are drawn by base3d.js.
        // Monarch Isle builds its own (monarch3d.js and after), and so do the
        // mountain villages (mountain-village3d.js).
        if (b.depotWall || b.baseBuilding || b.monarch || b.mountain) continue;
        const kind = (b.archetype = archetypeFor(b)),
          height = b.height,
          group = new Three.Group();
        roofOwner = b;
        b.roofKeepOuts = [];
        group.position.set(b.x, 0, b.y);
        scene.add(group);
        batchGroups.push(group);
        if (b.skyline) {
          // A planned tower of the financial cluster (src/skyline3d.js).
          const glassMaterial = buildSkylineTower(b, group);
          roofOwner = null;
          allBuildings.push({ b, group, height: height + (b.crownHeight || 0), materials: [glassMaterial] });
          statics.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, group, radius: Math.max(b.w, b.h) });
          continue;
        }
        const face = facadeMaterial(kind, i, b),
          roof = roofMaterial(kind),
          top = roof.material,
          trimColor =
            kind === 'tower'
              ? '#a9b3ba'
              : kind === 'deco' || kind === 'decoTower'
                ? '#f1e6d4'
                : kind === 'warehouse'
                  ? '#6b7379'
                  : i % 2
                    ? '#9a958d'
                    : '#7c6d63',
          trim = staticMat(trimColor);
        blockBox(group, b.w / 2, height / 2, b.h / 2, b.w, height, b.h, face, top);
        // Parapet coping and a plinth along the street.
        box(group, b.w / 2, height + 1.6, 2, b.w + 3, 3.2, 4, trim);
        box(group, b.w / 2, height + 1.6, b.h - 2, b.w + 3, 3.2, 4, trim);
        box(group, 2, height + 1.6, b.h / 2, 4, 3.2, b.h, trim);
        box(group, b.w - 2, height + 1.6, b.h / 2, 4, 3.2, b.h, trim);
        if (kind !== 'tower') box(group, b.w / 2, 2.5, b.h + 0.8, b.w + 3, 5, 2, kind === 'stucco' || kind === 'deco' ? staticMat('#cbbfae') : trim);
        if (kind === 'tower' && height > realBuildingHeight(120)) {
          /* Setback crown. A single step reads as an office block; the towers of
             the financial core step two or three times and carry a mast, which is
             what makes a skyline out of a row of buildings. */
          const steps = height > realBuildingHeight(420) ? 3 : height > realBuildingHeight(260) ? 2 : 1;
          let level = height,
            sw = b.w,
            sh = b.h,
            crown = 0;
          for (let s = 0; s < steps; s++) {
            const stepH = Math.min(3 * STOREY, height * (0.2 - s * 0.042));
            sw *= 0.78;
            sh *= 0.78;
            if (s === 0) roofKeepOut(b.x + b.w / 2, b.y + b.h / 2, sw + 3, sh + 3);
            blockBox(group, b.w / 2, level + stepH / 2, b.h / 2, sw, stepH, sh, face, top);
            box(group, b.w / 2, level + stepH + 1.2, b.h / 2, sw + 2, 2.4, sh + 2, trim);
            level += stepH + 1.2;
            crown += stepH + 1.2;
          }
          if (height > realBuildingHeight(420)) {
            const spire = Math.min(180, height * 0.17);
            mesh(cylinderGeo, trim, group, b.w / 2, level + spire / 2, b.h / 2, 2.8, spire, 2.8);
            mesh(cylinderGeo, chrome, group, b.w / 2, level + spire + 8, b.h / 2, 0.9, 20, 0.9);
            crown += spire + 18;
          }
          // Vertical mullion fins: the curtain wall needs relief to catch the sun.
          if (height > realBuildingHeight(260)) {
            const finMat = staticMat('#b6bec4', 0.45, 0.35);
            for (let x = 22; x < b.w - 14; x += 38) {
              box(group, x, height / 2, b.h + 0.7, 1.4, height - 10, 1.4, finMat);
              box(group, x, height / 2, -0.7, 1.4, height - 10, 1.4, finMat);
            }
            for (let z = 22; z < b.h - 14; z += 38) {
              box(group, -0.7, height / 2, z, 1.4, height - 10, 1.4, finMat);
              box(group, b.w + 0.7, height / 2, z, 1.4, height - 10, 1.4, finMat);
            }
          }
          // Glazed podium: towers meet the street on a wider base, never on a knife edge.
          if (height > realBuildingHeight(260)) {
            const podium = Math.min(SHOP_FLOOR + STOREY, height * 0.1);
            blockBox(group, b.w / 2, podium / 2, b.h / 2, b.w + 22, podium, b.h + 22, face, top);
            box(group, b.w / 2, podium + 1.4, b.h / 2, b.w + 26, 2.8, b.h + 26, trim);
          }
          b.crownHeight = crown;
        }
        if (kind === 'brick' && cityRandom() < 0.5)
          for (let y = SHOP_FLOOR; y < height - 6; y += STOREY) box(group, b.w / 2, y, b.h + 0.3, b.w + 1, 1.1, 1.4, trim);
        if (kind === 'office') box(group, b.w / 2, height - 5, b.h + 0.6, b.w + 1.5, 2.2, 2, trim);
        if (kind === 'hotel') {
          // A slab edge at every floor, a picture window and a balcony shelf over it.
          for (let y = SHOP_FLOOR; y < height - 8; y += STOREY) {
            for (const z of [-1, b.h + 1]) {
              box(group, b.w / 2, y, z, b.w + 2, 1.8, 3, concrete);
              for (let x = 18; x < b.w - 12; x += 26) {
                box(group, x, y + STOREY * 0.45, z, 18, STOREY * 0.6, 1, glass);
                box(group, x, y + 2, z + (z < 0 ? -1 : 1), 20, 1.2, 5, trim);
              }
            }
            for (const x of [-1, b.w + 1]) {
              box(group, x, y, b.h / 2, 3, 1.8, b.h, concrete);
              for (let z = 18; z < b.h - 12; z += 26) box(group, x, y + STOREY * 0.45, z, 1, STOREY * 0.6, 18, glass);
            }
          }
          for (const x of [5, b.w - 5]) for (const z of [5, b.h - 5]) box(group, x, height / 2, z, 7, height + 1, 7, concrete);
        }
        const streetSouth = cityStreetSouth(b);
        if (streetSouth && !b.place && ['brick', 'stucco', 'office', 'deco'].includes(kind)) shopfront(group, b, kind, i);
        else if (kind === 'brick' && !b.place && cityRandom() < 0.7) fireEscape(group, b);
        if (kind === 'decoTower' && !b.place) balconies(group, b, staticMat('#efe4d2'));
        decorateRoof(kind, b, group, i);
        roofOwner = null;
        allBuildings.push({
          b,
          group,
          height: height + (b.crownHeight || 0),
          materials: [face.material, top, trim],
          // The facade's own colour (damage3d.js tints debris with it).
          tint: face.tint,
        });
        statics.push({
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          group,
          radius: Math.max(b.w, b.h),
        });
      }
      // ---- Sidewalk furniture --------------------------------------------------------
      const furnitureGroup = new Three.Group();
      scene.add(furnitureGroup);
      batchGroups.push(furnitureGroup);
      const shelters = [],
        adLightbox = litSignMaterial(adTexture, adTexture, { night: 1.3, day: 0.3, roughness: 0.3 });
      function clearSidewalk(x, y) {
        return landAt(x, y) && !onRoad(x, y) && !solid(x, y, 5) && !onBoulevard(x, y, 12) &&
          !SERVICE_ROADS.some((r) => r.points.some((p, i) => i && segmentDistance(x, y, r.points[i - 1], p) < r.width / 2 + 4)) && !inHarbor(x, y, 20) && !inStadiumLot(x, y, 10) && !inGarageLot(x, y, 6) && !sportsbookNearShop(x, y, 30);
      }
      function busShelter(x, z, faceSouth, kerbZ) {
        const g = new Three.Group();
        g.position.set(x, 0, z);
        g.rotation.y = faceSouth ? 0 : Math.PI;
        furnitureGroup.add(g);
        // A 2.5 m shelter: posts, roof, back glass, bench, ad panel and the stop's flag.
        for (const dx of [-13, 13]) box(g, dx, 10, -3, 1, 20, 1, darkMetal);
        box(g, 0, 20.2, 0, 30, 0.7, 9, staticMat('#6b7378', 0.4, 0.5));
        box(g, 0, 10.5, -3.4, 27, 16, 0.5, glass);
        box(g, 0, 3.8, -0.5, 22, 0.8, 4, propMats.benchSeat);
        for (const dx of [-9, 9]) box(g, dx, 1.9, -0.5, 0.8, 3.6, 3.4, darkMetal);
        const adPanel = new Three.Mesh(adPlane(10, 14, Math.floor(cityRandom() * ADS.length)), adLightbox);
        adPanel.position.set(-16.5, 10, 2.8);
        adPanel.rotation.y = Math.PI / 2;
        g.add(adPanel);
        box(g, -16.5, 10, 2.8, 0.8, 15, 11, darkMetal);
        box(g, 18, 11, 2, 0.8, 22, 0.8, darkMetal);
        box(g, 18, 21, 2, 6, 3, 0.4, staticMat('#2f5f9a'));
        // The bus stop box painted on the carriageway in front of the shelter,
        // a bus length along the kerb, with BUS STOP lettering in the lane.
        if (kerbZ !== undefined) {
          const d = Math.abs(kerbZ - z),
            yellow = staticMat('#d9b845', 0.8);
          for (const dz of [d + 1, d + 17]) box(g, 0, 0.14, dz, 84, 0.08, 1.4, yellow);
          for (const dx of [-42, 42]) box(g, dx, 0.14, d + 9, 1.4, 0.08, 17.4, yellow);
          for (let k = -36; k <= 36; k += 12) box(g, k, 0.15, d + 11, 5, 0.08, 1, yellow);
        }
        shelters.push(g);
        statics.push({ x, y: z, group: g, radius: 40 });
        // The back glass and the advertising panel stop people; the front is open.
        const back = faceSouth ? 1 : -1;
        registerFootObstacle(x, z - back * 3.4, 14, 1);
        registerFootObstacle(x - back * 16.5, z + back * 2.8, 1, 5.5);
        // The roof is cut away round a player waiting under it (lighting3d.js).
        registerCutawayRoof(x, z, 16, 6.5, 0, 19, 22);
        // People wait here (src/crowd.js) and buses stop for them.
        registerBusStop(x, z);
      }
      for (const bx of BLOCK_COLUMNS)
        for (let by = BLOCK_Y_MIN; by <= BLOCK_Y_MAX; by++) {
          const x = blockX(bx) + 89,
            z = blockY(by) + 89,
            w = 334;
          if (!validCityBlock(x, z, w, w) || harborOverlap(x, z, w, w) || stadiumOverlap(x, z, w, w) || isPark(bx, by)) continue;
          const south = z + w + 14,
            north = z - 14,
            west = x - 14,
            east = x + w + 14;
          // South sidewalk: hydrant, bins, newspaper boxes, mailbox, parking meters.
          if (clearSidewalk(x + 10, south)) placeProp('hydrant', pools.hydrant, x + 10, 2.8, south, 1.6, 5.6, 1.6);
          for (const px of [x + 96, x + 238])
            if (clearSidewalk(px, south + 4)) placeProp('trash', pools.trash, px, 3.2, south + 4, 2.6, 6.4, 2.6);
          if (clearSidewalk(x + 150, south + 4)) {
            placeProp('news', pools.newsRed, x + 150, 4.4, south + 4, 3.5, 8.8, 3);
            placeProp('news', pools.newsYellow, x + 154, 4.4, south + 4, 3.5, 8.8, 3);
            placeProp('news', pools.newsBlue, x + 158, 4.4, south + 4, 3.5, 8.8, 3);
          }
          if (clearSidewalk(x + 300, south + 3) && cityRandom() < 0.6) placeProp('mailbox', pools.mailbox, x + 300, 5.2, south + 3, 4, 10.4, 4);
          if (cityRandom() < 0.5)
            for (let px = x + 40; px < x + w - 30; px += 52)
              if (clearSidewalk(px, south - 4)) placeProp('meter', pools.meter, px, 5.2, south - 4, 1.2, 10.4, 1.2);
          // North sidewalk: a bin and bollards; benches come from the shared benchSpots() list below.
          if (clearSidewalk(x + w - 30, north)) placeProp('trash', pools.trash, x + w - 30, 3.2, north, 2.6, 6.4, 2.6);
          // West and east sidewalks: bollards and the odd traffic cone.
          for (const [sx, sz] of [[west, z + 30], [west, z + w - 30], [east, z + 30], [east, z + w - 30]])
            if (clearSidewalk(sx, sz)) placeProp('bollard', pools.bollard, sx, 3.6, sz, 1.4, 7.2, 1.4);
          if (cityRandom() < 0.25 && clearSidewalk(east, z + w / 2)) placeProp('cone', pools.cone, east, 3, z + w / 2, 3, 6, 3);
          // Alley clutter: dumpsters and crates in the interior parking court.
          if (cityRandom() < 0.7 && clearSidewalk(x + 200, z + 176)) {
            placeProp('dumpster', pools.dumpster, x + 200, 4.5, z + 176, 16, 9, 8);
            if (cityRandom() < 0.5) placeProp('crate', pools.crate, x + 214, 3, z + 176, 6, 6, 6, 0.4);
          }
          // Bus shelters on the wide avenues, one per block on the north sidewalk.
          const avenue = blockY(by + 1);
          if (wideRow(avenue) && cityRandom() < 0.6 && clearSidewalk(x + 180, south + 6))
            busShelter(x + 180, south + 6, true, avenue - 56);
        }
      for (const spot of benchSpots()) {
        // Seat 0.45 m up, backrest to 0.85 m.
        const bench = placeProp('bench', pools.benchSeat, spot.x, 3.6, spot.y, 16, 1, 5);
        placeProp('bench', pools.benchSeat, spot.x, 5.6, spot.y - 2.4, 16, 3.6, 0.8, 0, bench);
        placeProp('bench', pools.benchLeg, spot.x - 6.5, 1.6, spot.y, 1, 3.2, 4.6, 0, bench);
        placeProp('bench', pools.benchLeg, spot.x + 6.5, 1.6, spot.y, 1, 3.2, 4.6, 0, bench);
        // Knocked over, nobody can sit on it (damage.js topple).
        if (bench) bench.bench = spot;
      }
      for (const im of Object.values(pools)) im.instanceMatrix.needsUpdate = true;
      // ---- Night lighting update --------------------------------------------------------
      function updateCityscapeVisuals() {
        const light = daylight(),
          night = clamp(1 - light * 1.6, 0, 1),
          hour = (worldMinutes % 1440) / 60,
          lateNight = hour > 1 && hour < 5 ? 0.45 : 1;
        facadeClock.value = gameTime;
        for (const material of facadeMaterials.values()) material.emissiveIntensity = night * lateNight * 1.35;
        for (const w of litWindowMaterials) {
          const flicker = 0.92 + 0.08 * Math.sin(gameTime * 0.7 + w.phase);
          w.material.emissiveIntensity =
            night * w.strength * lateNight * flicker * 1.35 * sideJobPower(w.x, w.y);
        }
        shopGlassMaterial.emissiveIntensity = night * 0.9 * (hour > 0.5 && hour < 6 ? 0.35 : 1);
        for (const n of neonSigns) {
          const on = n.beacon ? (Math.sin(gameTime * 2.4) > 0 ? 1 : 0.15) : 1,
            power = sideJobPower(n.sprite.parent.position.x, n.sprite.parent.position.z);
          n.sprite.material.opacity = clamp(0.06 + night * n.base, 0, 1) * on * power;
          if (n.mesh) n.mesh.material.opacity = (0.65 + night * 0.35) * (0.3 + 0.7 * power);
        }
        beaconMaterial.color.set(Math.sin(gameTime * 2.4) > 0 ? '#ff3b2f' : '#4a1512');
        updateGlowField(night);
        updateSignage(night);
        updateSkyline(night);
      }
