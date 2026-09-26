      // Sports 3D stadium crowd (one instance per seat), floodlights and venue builders (createSoccerVenue).
      /**
       * THE CROWD
       * One instance per seat for each body part. Each seat has a random `rank`:
       * the stands fill to the fixture's attendance lowest rank first, so a thin
       * crowd is spread round the ground instead of packed at one end, and they
       * empty in the same order. Fans wear the colours of the club whose end they
       * sit in (home to the west, away to the east, a mix along the sides).
       * Poses: seated; standing to cheer their club's goal (arms up, bouncing);
       * in a panic, up on their feet and backing up the terrace before they go.
       * The instance matrices are only rewritten when the picture changes.
       */
      let stadiumCrowd = null;
      function createStadiumCrowd(parent, seats) {
        const crowd = new Three.Group();
        crowd.name = 'Stadium crowd (' + seats.length + ' seats)';
        parent.add(crowd);
        const bodies = new Three.InstancedMesh(boxGeo, sportsMaterials.white, seats.length);
        const heads = new Three.InstancedMesh(sphereGeo, sportsMaterials.white, seats.length);
        const benches = new Three.InstancedMesh(boxGeo, sportsMaterials.seat, seats.length);
        const legs = new Three.InstancedMesh(boxGeo, sportsMaterials.shorts, seats.length);
        const arms = new Three.InstancedMesh(boxGeo, sportsMaterials.white, seats.length * 2);
        bodies.name = 'Crowd shirts';
        heads.name = 'Crowd heads';
        benches.name = 'Individual stadium seats';
        const color = new Three.Color();
        seats.forEach((seat, index) => {
          seat.rank = sportsHash(index, 7331) / 4294967296;
          seat.end = seat.x < 2560 ? 0 : seat.x > 2820 ? 1 : sportsHash(index, 17) % 2;
          seat.shade = sportsHash(index, 29) % 20;
          seat.bounce = (sportsHash(index, 3) % 628) / 100;
          stadiumCrowdInstance(benches, index, seat, -0.6, 2.4, 0, 4.8, 1, 6.2);
          heads.setColorAt(index, color.set(['#ca9e79', '#a77853', '#78513a', '#e3bf9a'][seat.seed % 4]));
          // Placeholder colours until the first fixture paints them.
          bodies.setColorAt(index, color.set('#8a97a6'));
          arms.setColorAt(index * 2, color);
          arms.setColorAt(index * 2 + 1, color);
        });
        for (const instances of [bodies, heads, benches, legs, arms]) {
          instances.instanceMatrix.needsUpdate = true;
          if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
          instances.receiveShadow = true;
          instances.castShadow = false;
          crowd.add(instances);
        }
        stadiumCrowd = { group: crowd, seats, bodies, heads, legs, arms, key: '', colorKey: '' };
        poseStadiumCrowd(null, 1, -1, 0, 0);
        for (const instances of [bodies, heads, benches, legs, arms]) instances.computeBoundingSphere();
        return crowd;
      }

      const stadiumCrowdTransform = new Three.Object3D();
      // Local frame of a seat: +x toward the pitch, +z along the row.
      function stadiumCrowdInstance(instances, index, seat, x, height, z, scaleX, scaleY, scaleZ, lean = 0) {
        const cosine = Math.cos(seat.facing);
        const sine = Math.sin(seat.facing);
        stadiumCrowdTransform.position.set(seat.x + x * cosine + z * sine, seat.height + height, seat.y - x * sine + z * cosine);
        stadiumCrowdTransform.rotation.set(0, seat.facing, lean);
        stadiumCrowdTransform.scale.set(scaleX, scaleY, scaleZ);
        stadiumCrowdTransform.updateMatrix();
        instances.setMatrixAt(index, stadiumCrowdTransform.matrix);
      }

      /* Fans in the fixture's colours: mostly the shirt, some the second colour, a few neutrals. */
      function colorStadiumCrowd(match) {
        const state = stadiumCrowd,
          color = new Three.Color(),
          neutrals = ['#d4e2dc', '#7583a1', '#3c4452', '#e3c579'];
        state.seats.forEach((seat, index) => {
          const kit = match.kits[seat.end],
            shirt = seat.shade < 12 ? kit.primary : seat.shade < 17 ? kit.secondary : neutrals[seat.shade % 4];
          color.set(shirt);
          state.bodies.setColorAt(index, color);
          // Scarves and sleeves: arms in the second colour now and then.
          if (seat.shade % 5 === 0) color.set(kit.secondary);
          state.arms.setColorAt(index * 2, color);
          state.arms.setColorAt(index * 2 + 1, color);
        });
        state.bodies.instanceColor.needsUpdate = true;
        state.arms.instanceColor.needsUpdate = true;
      }

      /**
       * presence: share of seats filled (0..1). cheerTeam: whose fans are
       * celebrating (-1 none, 2 everyone). cheerTime: seconds into it (bounce).
       * panic: 0..1 how far the panic has gone (fans standing and backing away).
       */
      function poseStadiumCrowd(match, presence, cheerTeam, cheerTime, panic) {
        const { seats, bodies, heads, legs, arms } = stadiumCrowd;
        seats.forEach((seat, index) => {
          if (seat.rank >= presence) {
            for (const [instances, slot] of [
              [bodies, index],
              [heads, index],
              [legs, index],
              [arms, index * 2],
              [arms, index * 2 + 1],
            ])
              stadiumCrowdInstance(instances, slot, seat, 0, -40, 0, 0.001, 0.001, 0.001);
            return;
          }
          const cheering = cheerTeam === 2 || cheerTeam === seat.end,
            standing = cheering || panic > 0;
          if (!standing) {
            stadiumCrowdInstance(bodies, index, seat, -0.6, 6, 0, 4.4, 5.6, 6);
            stadiumCrowdInstance(heads, index, seat, 0, 10.9, 0, 1.9, 2.4, 2);
            stadiumCrowdInstance(legs, index, seat, 2.2, 2, 0, 5.5, 2.2, 5.2);
            // A few are always on their feet in spirit: one arm in the air.
            const waving = seat.shade === 7;
            for (const side of [-1, 1])
              stadiumCrowdInstance(arms, index * 2 + (side === 1 ? 1 : 0), seat, waving ? 0.3 : 0.4, waving && side > 0 ? 11 : 6, side * 3.8, 1.5, 5.3, 1.6, waving ? side * 0.4 : 0.2);
            return;
          }
          // On their feet: backing up the terrace in a panic, bouncing in a cheer.
          const back = panic * 18,
            lift = back * 0.35 + (cheering ? Math.abs(Math.sin(cheerTime * 9 + seat.bounce)) * 1.8 : 0),
            x = -0.8 - back;
          stadiumCrowdInstance(legs, index, seat, x, 3.3 + lift, 0, 2.6, 6.4, 5);
          stadiumCrowdInstance(bodies, index, seat, x, 9.4 + lift, 0, 4, 5.6, 5.8);
          stadiumCrowdInstance(heads, index, seat, x + 0.4, 14.3 + lift, 0, 1.9, 2.4, 2);
          for (const side of [-1, 1]) {
            const slot = index * 2 + (side === 1 ? 1 : 0);
            if (cheering)
              stadiumCrowdInstance(arms, slot, seat, x + 0.3, 15 + lift, side * 3.4, 1.4, 5.6, 1.5, side * (0.25 + 0.15 * Math.sin(cheerTime * 7 + seat.bounce)));
            else stadiumCrowdInstance(arms, slot, seat, x - 0.4, 9.2 + lift, side * 3.6, 1.4, 5.3, 1.5, 0.35);
          }
        });
        for (const instances of [bodies, heads, legs, arms]) instances.instanceMatrix.needsUpdate = true;
      }

      /* Once a frame: colours for a new fixture, then the pose if anything changed. */
      function updateStadiumCrowd(match) {
        const state = stadiumCrowd;
        if (!state || !match) return;
        if (state.colorKey !== match.fixture.id) {
          state.colorKey = match.fixture.id;
          colorStadiumCrowd(match);
        }
        const presence = sportsCrowdPresence(match),
          flash = match.goalFlash,
          cheerAge = flash ? match.time - flash.time : Infinity,
          cheerTeam = cheerAge < 4.5 ? (flash.byPlayer ? 2 : flash.team) : match.stage === 'fulltime' && match.remaining > match.calendar.afterSeconds - 6 ? 2 : -1,
          cheerTime = Number.isFinite(cheerAge) ? cheerAge : match.time,
          panic = match.abandoned ? sportsLimit((match.time - match.panicAt) / 3, 0.05, 1) : 0,
          key = [
            Math.round(presence * 60),
            cheerTeam,
            cheerTeam >= 0 ? Math.floor(cheerTime * 10) : 0,
            Math.round(panic * 12),
          ].join('|');
        if (key === state.key) return;
        state.key = key;
        poseStadiumCrowd(match, presence, cheerTeam, cheerTime, panic);
      }

      function createStadiumFloodlight(parent, x, y, facing) {
        const group = new Three.Group();
        group.name = 'Stadium floodlight tower';
        group.position.set(x, 0, y);
        group.rotation.y = facing;
        parent.add(group);
        for (const offset of [-2.5, 2.5])
          box(group, offset, 72, 0, 1.5, 144, 1.5, sportsMaterials.facade);
        for (let height = 12; height < 138; height += 13)
          rod(
            group,
            new Three.Vector3(-2.5, height - 8, 0),
            new Three.Vector3(2.5, height, 0),
            0.4,
            chrome,
          );
        box(group, 0, 148, 0, 25, 13, 3, sportsMaterials.facade);
        for (const lampX of [-8, 0, 8])
          for (const lampY of [144, 151]) box(group, lampX, lampY, 2, 6, 5, 0.7, warmLamp);
      }

      function createSoccerVenue(venue) {
        const group = new Three.Group();
        group.name = 'South Coast Stadium';
        scene.add(group);
        batchGroups.push(group);
        const centerX = venue.x + venue.w / 2;
        const centerY = venue.y + venue.h / 2;
        box(group, centerX, 0.1, centerY, venue.w + 46, 0.18, venue.h + 46, sportsMaterials.field);
        for (let stripe = 0; stripe < 12; stripe++) {
          if (stripe % 2) continue;
          box(
            group,
            venue.x + ((stripe + 0.5) * venue.w) / 12,
            0.22,
            centerY,
            venue.w / 12,
            0.07,
            venue.h,
            sportsMaterials.fieldStripe,
          );
        }
        sportsGroundRectangle(group, venue.x, venue.y, venue.w, venue.h);
        sportsGroundLine(group, centerX, venue.y, centerX, venue.y + venue.h);
        sportsGroundArc(group, centerX, centerY, 45);
        sportsGroundSpot(group, centerX, centerY);
        for (const direction of [1, -1]) {
          const baselineX = direction === 1 ? venue.x : venue.x + venue.w;
          sportsGroundRectangle(
            group,
            direction === 1 ? baselineX : baselineX - 81,
            centerY - 87,
            81,
            174,
          );
          sportsGroundRectangle(
            group,
            direction === 1 ? baselineX : baselineX - 27,
            centerY - 43,
            27,
            86,
          );
          sportsGroundSpot(group, baselineX + direction * 58, centerY);
          const penaltyX = baselineX + direction * 58;
          sportsGroundArc(
            group,
            penaltyX,
            centerY,
            35,
            direction === 1 ? -0.85 : Math.PI - 0.85,
            direction === 1 ? 0.85 : Math.PI + 0.85,
          );
          createSoccerGoal(
            group,
            baselineX,
            centerY,
            direction,
            venue.goalWidth,
            venue.goalHeight,
            venue.goalDepth,
          );
          for (const sideY of [venue.y, venue.y + venue.h]) {
            box(group, baselineX, 5.5, sideY, 0.6, 11, 0.6, sportsMaterials.white);
            box(group, baselineX + direction * 2, 9.4, sideY, 4, 2.6, 0.3, sportsMaterials.rim);
          }
        }
        const seats = [];
        for (const stand of STADIUM_STANDS) createStadiumStand(group, stand, seats);
        const crowd = createStadiumCrowd(group, seats);
        for (const [x, y, facing] of [
          [2265, 4301, 0.65],
          [3110, 4301, -0.65],
          [2265, 4890, 2.5],
          [3110, 4890, -2.5],
        ])
          createStadiumFloodlight(group, x, y, facing);
        for (const screen of STADIUM_SCREENS) createSportsScreen(group, 'soccer', screen);
        for (const x of [2653, 2725]) box(group, x, 43, 4863, 4, 86, 4, sportsMaterials.facade);
        box(group, centerX, 86, 4863, 77, 4, 5, sportsMaterials.canopy);
        sportsVenueModels.set('soccer', { group, crowd, venue, x: centerX, y: centerY, radius: 600 });
      }

      /**
       * STADIUM ENCLOSURE
       * Meshes for the logical enclosure defined in sports-world.js: pitch
       * perimeter boards with sponsors, the south entrance arch, turnstiles with
       * two person-wide gates, a bollard row that stops vehicles, ticket booths,
       * flag poles, dugouts, exterior cladding ribs and entrance lamps.
       */
      const stadiumLampHalos = [];
      function createStadiumEnclosure() {
        const group = new Three.Group();
        group.name = 'Stadium enclosure';
        scene.add(group);
        batchGroups.push(group);
        const boardMat = staticMat('#1c2a36', 0.6, 0.3),
          steel = staticMat('#8d979e', 0.45, 0.6),
          yellow = staticMat('#e0b545', 0.5, 0.3),
          booth = staticMat('#2f4a5e', 0.7, 0.2),
          f = PITCH_FENCE,
          e = STADIUM_ENTRANCE;
        // Perimeter fence with advertising boards (shared sign atlas from cityscape3d).
        for (const seg of f.segments) {
          const horizontal = seg.w > seg.h,
            length = horizontal ? seg.w : seg.h,
            cx = seg.x + seg.w / 2,
            cz = seg.y + seg.h / 2;
          box(group, cx, f.height / 2, cz, horizontal ? length : 1.6, f.height, horizontal ? 1.6 : length, boardMat);
          box(group, cx, f.height + 0.6, cz, horizontal ? length : 2.4, 1.2, horizontal ? 2.4 : length, steel);
          const panels = Math.floor(length / 64);
          for (let k = 0; k < panels; k++) {
            const t = (k + 0.5) / panels,
              px = horizontal ? seg.x + length * t : cx,
              pz = horizontal ? cz : seg.y + length * t,
              plane = new Three.Mesh(
                new Three.PlaneGeometry(58, 7),
                new Three.MeshBasicMaterial({
                  map: adAtlas.cell(k % AD_LINES.length),
                  toneMapped: false,
                  side: Three.DoubleSide,
                }),
              );
            plane.position.set(px + (horizontal ? 0 : seg.id === 'fence-west' ? 1.1 : -1.1), f.height / 2 + 0.5, pz + (horizontal ? (seg.id === 'fence-north' ? 1.1 : -1.1) : 0));
            plane.rotation.y = horizontal ? 0 : Math.PI / 2;
            plane.userData.sign = true;
            group.add(plane);
          }
        }
        // Entrance arch: two pylons, a lit lintel and the stadium name.
        for (const pylon of e.pylons)
          box(group, pylon.x + pylon.w / 2, pylon.height / 2, pylon.y + pylon.h / 2, pylon.w, pylon.height, pylon.h, sportsMaterials.facade);
        box(group, e.x + e.w / 2, 80, 4887, e.w + 24, 6, 6, sportsMaterials.canopy);
        const arch = sign('SOUTH COAST STADIUM', e.x + e.w / 2, 4892, 90, '#f2e2b0');
        arch.position.y = arch.userData.backing.position.y = 72;
        for (let k = -2; k <= 2; k++) {
          box(group, e.x + e.w / 2 + k * 15, 76.5, 4890.5, 4, 1, 1, warmLamp);
          stadiumLampHalos.push(halo(group, e.x + e.w / 2 + k * 15, 75, 4891, 14, '#ffe1b3'));
        }
        // Turnstiles: posts, tripod arms and a lit "ENTER" plate above each gate.
        for (const post of e.posts) {
          box(group, post.x + post.w / 2, e.turnstiles.height / 2, e.turnstiles.y + e.turnstiles.depth / 2, post.w, e.turnstiles.height, e.turnstiles.depth, steel);
          box(group, post.x + post.w / 2, e.turnstiles.height + 0.5, e.turnstiles.y + e.turnstiles.depth / 2, post.w + 1, 1, e.turnstiles.depth + 1, darkMetal);
        }
        for (const gate of e.gates) {
          const gx = gate.x + gate.w / 2;
          for (let k = 0; k < 3; k++) {
            const arm = box(group, gx - gate.w / 2 + 1.5 + k * 0.4, 7, e.turnstiles.y + 2, 9, 0.5, 0.5, chrome);
            arm.rotation.y = (k * TAU) / 3;
          }
          box(group, gx, 15, e.turnstiles.y + 2, gate.w - 2, 4, 0.6, new Three.MeshBasicMaterial({ color: '#8fdc9a', toneMapped: false }));
          box(group, gx, 17.5, e.turnstiles.y + 2, gate.w, 1, 1, darkMetal);
        }
        box(group, e.x + e.w / 2, 17.5, e.turnstiles.y + 2, e.w + 2, 1, 1, darkMetal);
        // Bollards across the entrance mouth.
        for (const x of e.bollards.xs) {
          mesh(cylinderGeo, yellow, group, x, e.bollards.height / 2, e.bollards.y, 1.7, e.bollards.height, 1.7);
          mesh(cylinderGeo, darkMetal, group, x, e.bollards.height + 0.4, e.bollards.y, 1.8, 0.8, 1.8);
        }
        // Ticket booths with a serving window and a small marquee.
        for (const b of e.booths) {
          box(group, b.x + b.w / 2, b.height / 2, b.y + b.h / 2, b.w, b.height, b.h, booth);
          box(group, b.x + b.w / 2, b.height + 1, b.y + b.h / 2, b.w + 3, 2, b.h + 3, sportsMaterials.canopy);
          box(group, b.x + b.w / 2, 8, b.y + b.h + 0.3, b.w - 8, 6, 0.6, glass);
          const marquee = sign('TICKETS', b.x + b.w / 2, b.y + b.h + 1.2, 30, '#f2e2b0');
          marquee.position.y = marquee.userData.backing.position.y = b.height + 4;
        }
        // Flag poles with team flags.
        e.flagPoles.forEach((pole, i) => {
          box(group, pole.x, 31, pole.y, 1.4, 62, 1.4, steel);
          mesh(sphereGeo, yellow, group, pole.x, 62.5, pole.y, 1.2, 1.2, 1.2);
          // Each flag gets its own material: its colour follows the day's fixture
          // (home club on the west poles, visitors on the east).
          const flag = box(group, pole.x + 9, 55, pole.y, 17, 9, 0.4, mat('#c9c9c0', 0.9));
          flag.userData.dynamic = true;
          flag.userData.team = pole.x < STADIUM_ENTRANCE.x ? 0 : 1;
          flag.userData.stripe = i % 2;
          stadiumFlags.push(flag);
        });
        // Dugouts against the north stand.
        for (const d of e.dugouts) {
          box(group, d.x + d.w / 2, d.height / 2, d.y + d.h / 2, d.w, d.height, d.h, sportsMaterials.facade);
          box(group, d.x + d.w / 2, d.height + 0.4, d.y + d.h / 2 + 2, d.w + 2, 0.8, d.h + 6, glass);
          for (let k = 0; k < 5; k++) box(group, d.x + 4 + k * 6.5, 3, d.y + d.h / 2, 5, 3, 3, sportsMaterials.seat);
        }
        // Exterior cladding ribs and lamps on the outside faces of the stands.
        for (const stand of STADIUM_STANDS) {
          const outsideZ = stand.id === 'north' ? stand.y - 1 : stand.y + stand.h + 1,
            horizontal = stand.id === 'north' || stand.id.startsWith('south');
          if (horizontal) {
            for (let x = stand.x + 12; x < stand.x + stand.w - 8; x += 24) {
              box(group, x, stand.height * 0.45, outsideZ, 3, stand.height * 0.9, 2, sportsMaterials.canopy);
              if (x % 72 < 24) {
                box(group, x, stand.height * 0.7, outsideZ + (stand.id === 'north' ? -1.6 : 1.6), 2, 1.5, 1.5, warmLamp);
                stadiumLampHalos.push(halo(group, x, stand.height * 0.7, outsideZ + (stand.id === 'north' ? -3 : 3), 12, '#ffe1b3'));
              }
            }
          } else {
            const outsideX = stand.id === 'west' ? stand.x - 1 : stand.x + stand.w + 1;
            for (let z = stand.y + 12; z < stand.y + stand.h - 8; z += 24)
              box(group, outsideX, stand.height * 0.45, z, 2, stand.height * 0.9, 3, sportsMaterials.canopy);
          }
        }
        statics.push({ x: e.x + e.w / 2, y: 4600, group, radius: 620 });
      }
      const stadiumFlags = [];
      for (const [sport, venue] of Object.entries(SPORTS_VENUES)) {
        if (sport === 'basketball') createBasketballVenue(venue);
        if (sport === 'soccer') {
          createSoccerVenue(venue);
          createStadiumEnclosure();
        }
      }

      /* Athletes, officials and stewards are drawn by the character rig in
         their kits (crowd3d.js ATHLETES, `queueAthlete`). */

      // The two balls share their component geometries across match resets.
      const basketballSeamCoordinates = [];
      for (let circle = 0; circle < 3; circle++) {
        for (let segment = 0; segment < 40; segment++) {
          for (const angle of [(segment / 40) * TAU, ((segment + 1) / 40) * TAU]) {
            const horizontal = Math.cos(angle) * 1.012;
            const vertical = Math.sin(angle) * 1.012;
            basketballSeamCoordinates.push(
              circle === 0 ? 0 : horizontal,
              circle === 1 ? 0 : vertical,
              circle === 0 ? horizontal : circle === 1 ? vertical : 0,
            );
          }
        }
      }
      const basketballSeamGeometry = new Three.BufferGeometry();
      basketballSeamGeometry.setAttribute(
        'position',
        new Three.Float32BufferAttribute(basketballSeamCoordinates, 3),
      );
      const soccerPatchGeometry = new Three.CylinderGeometry(0.29, 0.29, 0.018, 5);

      function createSportsBall(match) {
        const group = new Three.Group();
        group.name = match.sport + ' live ball';
        scene.add(group);
        mesh(
          sphereGeo,
          match.sport === 'basketball' ? sportsMaterials.basketball : sportsMaterials.soccer,
          group,
          0,
          0,
          0,
        );
        if (match.sport === 'basketball') {
          group.add(new Three.LineSegments(basketballSeamGeometry, sportsBallSeamMaterial));
        } else {
          // Small pentagonal panels sit on the spherical surface and stay legible
          // while the ball rolls, without an external texture or per-frame canvas.
          for (const latitude of [-0.66, 0.66]) {
            for (let panel = 0; panel < 5; panel++) {
              const angle = (panel / 5) * TAU + (latitude > 0 ? 0 : Math.PI / 5);
              const normal = new Three.Vector3(
                Math.cos(angle) * 0.75,
                latitude,
                Math.sin(angle) * 0.75,
              ).normalize();
              const patch = mesh(
                soccerPatchGeometry,
                sportsMaterials.shoes,
                group,
                normal.x * 0.976,
                normal.y * 0.976,
                normal.z * 0.976,
              );
              patch.quaternion.setFromUnitVectors(new Three.Vector3(0, 1, 0), normal);
            }
          }
        }
        group.scale.setScalar(match.ball.radius);
        trimShadowCasters(group, 0.8);
        return { group };
      }

      /**
       * NIGHT MATCHES
       * The floodlights throw the pitch into the night light map (lighting3d.js
       * paints stadiumFloodPools() into it) while a fixture is on; when that
       * changes the map is repainted, which happens a few times a game day.
       */
      let stadiumFloodlightsOn = false;
      function stadiumFloodPools() {
        if (!stadiumFloodlightsOn) return [];
        const pitch = SPORTS_VENUES.soccer,
          pools = [];
        for (const along of [1 / 6, 0.5, 5 / 6])
          for (const across of [0.25, 0.75])
            pools.push({ x: pitch.x + pitch.w * along, y: pitch.y + pitch.h * across, radius: 190, strength: 0.62 });
        return pools;
      }
      function updateStadiumFloodlights(match) {
        // An abandoned match keeps its lights on until the fixture would have ended.
        const on = match.abandoned
          ? worldMinutes < match.fixture.kickoff + sportsMatchLength('soccer') + match.calendar.afterSeconds
          : ['warmup', 'live', 'break', 'fulltime'].includes(match.stage);
        if (on === stadiumFloodlightsOn) return;
        stadiumFloodlightsOn = on;
        paintLampLight();
      }

      function updateSportsVisuals(deltaSeconds) {
        const soccer = sportsMatches.soccer;
        for (let i = 0; i < stadiumFlags.length; i++) {
          const flag = stadiumFlags[i];
          flag.rotation.y = Math.sin(gameTime * 1.7 + i) * 0.25;
          if (soccer && flag.userData.fixture !== soccer.fixture.id) {
            flag.userData.fixture = soccer.fixture.id;
            const kit = soccer.kits[flag.userData.team];
            flag.material.color.set(flag.userData.stripe ? kit.secondary : kit.primary);
          }
        }
        for (const h of stadiumLampHalos) h.material.opacity = 0.1 + 0.9 * nightAmount;
        if (soccer) updateStadiumFloodlights(soccer);
        // deltaSeconds is deliberately not used as an animation clock: simulation
        // time and action timers freeze during pause and remain authoritative.
        const liveMatches = new Set(Object.values(sportsMatches).filter(Boolean));
        for (const [match, model] of sportsBallModels) {
          if (!liveMatches.has(match)) {
            scene.remove(model.group);
            sportsBallModels.delete(match);
          }
        }
        for (const match of liveMatches) {
          const venueModel = sportsVenueModels.get(match.sport);
          if (!venueModel) continue;
          venueModel.group.visible = entityInView(venueModel, venueModel.radius);
          if (venueModel.crowd) {
            venueModel.crowd.visible = viewZoom > 0.28;
            if (venueModel.group.visible && venueModel.crowd.visible) updateStadiumCrowd(match);
          }
          if (venueModel.group.visible) {
            const surface = sportsBoardSurfaces.get(match.sport);
            if (surface) paintSportsBoard(surface, match);
          }
          for (const athlete of match.people) {
            const visible = !athlete.hidden && venueModel.group.visible && viewZoom > 0.22 && entityInView(athlete, 25);
            if (visible) queueAthlete(athlete, match);
          }
          const ballVisible =
            venueModel.group.visible && viewZoom > 0.22 && entityInView(match.ball, 40);
          let ballModel = sportsBallModels.get(match);
          if (!ballModel && ballVisible) {
            ballModel = createSportsBall(match);
            sportsBallModels.set(match, ballModel);
          }
          if (ballModel) {
            ballModel.group.visible = ballVisible;
            if (ballVisible) {
              ballModel.group.position.set(match.ball.x, match.ball.z, match.ball.y);
              ballModel.group.rotation.set(
                match.ball.spin * 0.65,
                match.ball.spin * 0.18,
                match.ball.spin,
              );
            }
          }
        }
        // Screens glow after dark.
        for (const screen of sportsScreens) {
          const lit = nightAmount > 0.05 && screen.holder.parent?.visible !== false;
          screen.glow.visible = lit;
          if (lit) screen.glow.material.opacity = 0.35 * nightAmount;
        }
      }
