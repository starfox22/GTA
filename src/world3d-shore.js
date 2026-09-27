      // Shoreline notes, street ends (barriers, gates) and the esplanade furniture along the waterfront (buildPromenade).
      /**
       * SHORELINE
       * The wash, the breaking band and the wet-sand darkening are all produced by
       * the water shader from its distance-to-shore field, so the shore carries no
       * overlay planes. An earlier pass laid flat foam and shallow quads a few
       * units under the surface; because they were fixed while the water is
       * displaced by four Gerstner swells, they surfaced through the waves as pale
       * rectangles. They are gone. What remains here is real build: the concrete
       * quay edge, its coping, mooring bollards and a sand bank along the beaches.
       */
      for (const e of coastSegments()) {
        if (e.opening) continue;
        // Palm Keys Beach's waterline is drawn by beach3d.js (sand, wet sand, swash).
        if (beachShore(e)) continue;
        const group = new Three.Group(),
          style = shoreStyle(e),
          { nx, ny } = shoreNormal(e);
        group.position.set(e.x, 0, e.y);
        group.rotation.y = -e.a;
        scene.add(group);
        batchGroups.push(group);
        const outward = -Math.sin(e.a) * nx + Math.cos(e.a) * ny;
        if (style === 'quay') {
          box(group, 0, 2.3, 0, e.length + 1, 5, 5, staticMat('#727e80'));
          box(group, 0, 5.2, 0, e.length + 1, 0.9, 7, concrete);
          box(group, 0, 0.6, outward * 3.4, e.length + 1, 4, 2.2, staticMat('#5d6668', 0.95));
          if (Math.round(e.x + e.y) % 3 === 0) {
            mesh(cylinderGeo, darkMetal, group, 0, 6.6, -outward * 1.4, 1.5, 3.4, 1.5);
            mesh(sphereGeo, darkMetal, group, 0, 8.3, -outward * 1.4, 1.9, 1.1, 1.9);
          }
        } else if (RUNWAY_PIERS.some((p) => p.id === e.region)) {
          // A runway pier's rock armour: a sloping band of grey armour stone into
          // the water under a concrete coping.
          box(group, 0, 0.5, 0, e.length + 1, 1.6, 4, concrete);
          box(group, 0, -0.6, outward * 5, e.length + 1, 3.2, 7, staticMat('#6f6d66', 0.97));
          box(group, 0, -2.2, outward * 10, e.length + 2, 3, 6, staticMat('#5c5a54', 0.98));
          for (let k = -1; k <= 1; k++)
            if ((Math.round(e.x * 0.7 + e.y * 1.3) + k) % 2 === 0)
              box(group, k * e.length * 0.3, -0.2, outward * (6 + k), e.length * 0.28, 2.4, 3.2, staticMat('#7b786f', 0.96));
        } else {
          // A low sand bank so the beach meets the water with a lip, not an edge.
          box(group, 0, 0.45, -outward * 5, e.length + 1, 1.2, 12, staticMat('#c8b68e', 0.97));
          box(group, 0, 0.18, -outward * 13, e.length + 1, 0.9, 10, staticMat('#b8a884', 0.97));
        }
        statics.push({
          x: e.x,
          y: e.y,
          group,
          radius: 90,
        });
      }
      /**
       * STREET ENDS
       * Every grid road stops where the land does. A road that simply stops is a
       * bug; a road that stops at a kerbed turning head with a guardrail, a pair
       * of chevron boards and a NO THROUGH ROAD plate is a street. Ends on a
       * bridge or a boulevard are junctions, not ends, and are skipped.
       */
      function buildStreetEnds() {
        const railMat = staticMat('#cfd3cd', 0.7),
          chevron = staticMat('#e9e3d0', 0.75),
          stripe = staticMat('#c14c3c', 0.7),
          kerb = staticMat('#a9a89b', 0.92);
        // One plate texture shared by every end: a canvas per sign would cost
        // more memory than the rest of the street furniture put together.
        const plate = document.createElement('canvas');
        plate.width = 512;
        plate.height = 128;
        const pg = plate.getContext('2d');
        pg.fillStyle = '#e9e3d0';
        pg.fillRect(0, 0, 512, 128);
        pg.strokeStyle = '#b23c33';
        pg.lineWidth = 10;
        pg.strokeRect(10, 10, 492, 108);
        pg.fillStyle = '#20262a';
        pg.font = '700 46px Arial';
        pg.textAlign = 'center';
        pg.textBaseline = 'middle';
        pg.fillText('NO THROUGH ROAD', 256, 66, 460);
        const plateTexture = new Three.CanvasTexture(plate);
        plateTexture.colorSpace = Three.SRGBColorSpace;
        const plateMaterial = new Three.MeshBasicMaterial({
          map: plateTexture,
          side: Three.DoubleSide,
          toneMapped: false,
        });
        const plateGeometry = new Three.PlaneGeometry(34, 8.5);
        // Where each piece stands comes from streetEndPlan() (streets.js), which
        // also gives the pieces their colliders, so a rail you see is a rail that
        // stops you. Local frame: +x out past the end, z across the street.
        for (const end of streetEndPlan()) {
          const { p, a, width } = end,
            half = width / 2,
            group = new Three.Group();
          group.position.set(p.x, terrainHeight(p.x, p.y), p.y);
          group.rotation.y = -a;
          scene.add(group);
          batchGroups.push(group);
          statics.push({ x: p.x, y: p.y, group, radius: 120 });
          if (end.kind === 'gate') {
            // Gate piers either side of the forecourt with a length of railing
            // running back from each pier along the edge of the footway.
            const pier = staticMat('#a8a396', 0.9),
              gateIron = staticMat('#3f4744', 0.5, 0.5),
              g = STREET_END_GATE;
            for (const side of [-1, 1]) {
              const z = side * (half + g.offset);
              box(group, g.pierX, 13, z, g.pier, 26, g.pier, pier);
              box(group, g.pierX, 27.5, z, g.pier + 3, 3, g.pier + 3, pier);
              const length = g.railTo - g.railFrom,
                mid = (g.railFrom + g.railTo) / 2;
              box(group, mid, 8, z, length, 1.8, 1.8, gateIron);
              box(group, mid, 4, z, length, 1.4, 1.4, gateIron);
              for (let d = g.railFrom + 1; d < g.railTo; d += 16) box(group, d, 6, z, 1.6, 12, 1.6, gateIron);
              box(group, g.pierX, 32, z, 2.4, 10, 2.4, gateIron);
            }
            continue;
          }
          // A closed end: the carriageway stops square at a kerb, a guardrail
          // with chevron boards spans it, and the footways carry on round it.
          const g = STREET_END_RAIL;
          box(group, 0.2, 1.4, 0, 3, 2.8, width, kerb);
          for (let i = 0; i <= 6; i++) box(group, g.x, 7, -half + (i * width) / 6, 3.4, 14, 3.4, railMat);
          box(group, g.x, 12, 0, 3, 3.6, width + 4, railMat);
          box(group, g.x, 6.4, 0, 3, 3, width + 4, railMat);
          // Chevron boards facing the road, red and white.
          for (const side of [-1, 1]) {
            const z = side * (width * 0.24);
            box(group, g.x - 2.6, 9.5, z, 1.6, 13, 26, chevron);
            for (let k = -2; k <= 2; k++) box(group, g.x - 3.4, 9.5, z + k * 5.2, 0.8, 13, 2.6, stripe);
          }
          // NO THROUGH ROAD plate on a post at the kerb, a car length before the end.
          box(group, g.plateX, 11, -half - g.plateZ, 1.8, 22, 1.8, railMat);
          const boardMesh = new Three.Mesh(plateGeometry, plateMaterial);
          boardMesh.position.set(g.plateX, 22, -half - g.plateZ);
          boardMesh.rotation.y = -Math.PI / 2;
          boardMesh.userData.sign = true;
          group.add(boardMesh);
        }
      }
      buildStreetEnds();
      /**
       * ESPLANADE
       * Railing bays, lamp standards, benches and planters along the whole
       * waterfront, built from the shared promenadeSpots() list so the people
       * strolling it walk exactly where the furniture is.
       */
      function buildPromenade() {
        const railMetal = staticMat('#b9bcb4', 0.4, 0.55),
          walkStone = staticMat('#b7b4a6', 0.9),
          seatWood = staticMat('#9c7b52', 0.85),
          lampPost = staticMat('#42484a', 0.6, 0.35),
          lampGlass = new Three.MeshBasicMaterial({ color: '#ffe9bd' }),
          planter = staticMat('#8c8779', 0.9),
          planterTrunk = staticMat('#6b5442'),
          planterGeo = new Three.CylinderGeometry(9, 9.6, 3, 12);
        let group = null,
          groupAt = null,
          count = 0;
        for (const spot of promenadeSpots()) {
          // Batch the furniture in runs so a mile of railing is a handful of meshes.
          if (!group || Math.hypot(spot.x - groupAt.x, spot.y - groupAt.y) > 420 || count > 40) {
            group = new Three.Group();
            scene.add(group);
            batchGroups.push(group);
            statics.push({ x: spot.x, y: spot.y, group, radius: 560 });
            groupAt = spot;
            count = 0;
          }
          count++;
          // Local +z points out to sea whichever way the coast polygon is wound
          // (the coast heading alone put the railing on the landward edge of the
          // walk on every Northbank and Palm Keys quay, beside the road).
          const inner = new Three.Group();
          inner.position.set(spot.x, terrainHeight(spot.x, spot.y), spot.y);
          inner.rotation.y = -promenadeYaw(spot);
          group.add(inner);
          // A breakable piece (damage.js) is modelled in its own throwaway group
          // placed like `inner` and drawn as instances (render3d.js BREAKABLE SCENERY).
          const yaw = promenadeYaw(spot),
            at = (lx, lz) => [spot.x + lx * Math.cos(yaw) - lz * Math.sin(yaw), spot.y + lx * Math.sin(yaw) + lz * Math.cos(yaw)],
            piece = () => {
              const g = new Three.Group();
              g.position.copy(inner.position);
              g.rotation.y = inner.rotation.y;
              return g;
            };
          if (!spot.beach) {
            // Sea railing on the quay coping, carried straight across a street
            // mouth; it breaks for ladders and gangways (promenadeRailRuns). Each
            // run is a breakable railing: a pedestrian rail does not stop a car,
            // and where one is broken the quay edge is open (promenadeRailBlocked).
            spot.railProps = [];
            for (const run of spot.rail) {
              const length = run[1] - run[0],
                mid = (run[0] + run[1]) / 2;
              if (length < 2) {
                spot.railProps.push(null);
                continue;
              }
              box(inner, mid, 1.2, ESPLANADE_RAIL_Z, length, 2.4, 3, walkStone);
              const g = piece(),
                prop = registerStreetProp('railing', ...at(mid, ESPLANADE_RAIL_Z), -yaw, { half: [length / 2, 1.5] });
              for (const u of [run[0] + 1, run[1] - 1]) box(g, u, 6, ESPLANADE_RAIL_Z, 2, 12, 2, railMetal);
              box(g, mid, 11, ESPLANADE_RAIL_Z, length, 1.8, 1.8, railMetal);
              box(g, mid, 6.5, ESPLANADE_RAIL_Z, length, 1.4, 1.4, railMetal);
              breakableGroup(prop, g);
              spot.railProps.push(prop);
            }
          }
          if (spot.crossing) continue;
          // Lamp standards, benches and planters are breakable props; standing,
          // they are also what stops people on foot (footObstacleBlocked). A piece
          // whose place falls in the mouth of a street (the spot itself is just
          // clear of it) is left out.
          const pieceAt = spot.kind === 'lamp' ? at(0, 14) : spot.kind === 'bench' ? at(0, 5) : at(0, -22);
          if (spot.kind !== 'rail' && cityStreetAt(pieceAt[0], pieceAt[1], 4)) continue;
          if (spot.kind === 'lamp') {
            const g = piece(),
              prop = registerStreetProp('lantern', ...at(0, 14), -yaw, { half: [3, 3] });
            box(g, 0, 15, 14, 2.6, 30, 2.6, lampPost);
            box(g, 0, 2, 14, 7, 4, 7, lampPost);
            mesh(sphereGeo, lampGlass, g, 0, 32, 14, 3.4, 4.2, 3.4);
            breakableGroup(prop, g);
          } else if (spot.kind === 'bench') {
            const g = piece(),
              prop = registerStreetProp('seat', ...at(0, 5), -yaw, { half: [10, 3.5] });
            box(g, 0, 4.4, 6, 20, 1.6, 6, seatWood);
            box(g, 0, 7.6, 3.6, 20, 5.4, 1.4, seatWood);
            for (const side of [-1, 1]) box(g, side * 8, 2, 6, 1.4, 4.4, 5.4, lampPost);
            breakableGroup(prop, g);
          } else if (spot.kind === 'tree') {
            const g = piece(),
              prop = registerStreetProp('planter', ...at(0, -22), -yaw, { half: [9, 9], size: 11 });
            mesh(planterGeo, planter, g, 0, 1.5, -22);
            rod(g, new Three.Vector3(0, 3, -22), new Three.Vector3(0, 17, -22), 1.3, planterTrunk);
            mesh(sphereGeo, leafMats[0], g, 0, 22, -22, 11, 9, 11);
            breakableGroup(prop, g);
          }
        }
      }
      buildPromenade();
