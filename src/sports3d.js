      // BEGIN SUBSYSTEM: src/sports3d.js — Sports stadium and match meshes
      /**
       * Live urban sports scenery and athlete animation
       * Source: src/sports3d.js
       * Scope: createCityRenderer() closure.
       * Venue dimensions, ball positions and scores come from sports.js. World x/y
       * map to Three.js x/z; height always uses Three.js y. Athlete scale matches
       * ordinary pedestrians: feet at zero and hair just below 18 world units.
       */
      const sportsVenueModels = new Map(),
        sportsAthleteModels = new Map(),
        sportsBallModels = new Map(),
        sportsScoreboards = [],
        stadiumStandModels = [];
      const sportsMaterials = {
        concrete: mat('#d0d0c4', 0.91),
        facade: mat('#283c50', 0.73, 0.2),
        canopy: mat('#a8b3c0', 0.49, 0.4),
        seat: mat('#407b99', 0.77),
        field: mat('#397b48', 0.94),
        fieldStripe: mat('#458955', 0.96),
        court: mat('#326a77', 0.93),
        courtKey: mat('#b5714b', 0.9),
        white: mat('#ececdb', 0.79),
        rim: mat('#ee7840', 0.48, 0.2),
        basketball: mat('#db8239', 0.88),
        soccer: mat('#f4eee0', 0.82),
        skin: ['#d6af88', '#b88964', '#875e43', '#67452f'].map((color) => mat(color)),
        hair: mat('#302821'),
        shoes: mat('#202630'),
        shorts: mat('#233a4b'),
        homeShirt: mat('#3caae1'),
        awayShirt: mat('#e76854'),
        goalkeeperShirt: mat('#e9c34c'),
      };
      const sportsNetMaterial = new Three.LineBasicMaterial({
        color: '#ecefdf',
        transparent: true,
        opacity: 0.6,
      });
      const sportsLineMaterial = new Three.LineBasicMaterial({ color: '#f4f1db' });
      const sportsBallSeamMaterial = new Three.LineBasicMaterial({ color: '#473727' });

      // Draw nets and ball seams in one geometry per object, instead of individual
      // cylinder meshes for every thread. These geometries live with the venue.
      function sportsLineSegments(parent, coordinates, material = sportsNetMaterial) {
        const geometry = new Three.BufferGeometry();
        geometry.setAttribute('position', new Three.Float32BufferAttribute(coordinates, 3));
        const lines = new Three.LineSegments(geometry, material);
        parent.add(lines);
        return lines;
      }
      function sportsGroundLine(parent, x1, y1, x2, y2, width = 0.65) {
        const length = Math.hypot(x2 - x1, y2 - y1);
        const line = box(
          parent,
          (x1 + x2) / 2,
          0.34,
          (y1 + y2) / 2,
          length,
          0.12,
          width,
          sportsMaterials.white,
        );
        line.rotation.y = -Math.atan2(y2 - y1, x2 - x1);
        line.castShadow = false;
        return line;
      }
      function sportsGroundRectangle(parent, x, y, width, depth) {
        sportsGroundLine(parent, x, y, x + width, y);
        sportsGroundLine(parent, x + width, y, x + width, y + depth);
        sportsGroundLine(parent, x + width, y + depth, x, y + depth);
        sportsGroundLine(parent, x, y + depth, x, y);
      }
      function sportsGroundArc(parent, x, y, radius, start = 0, end = TAU) {
        const segments = Math.max(12, Math.ceil((end - start) * 14));
        for (let index = 0; index < segments; index++) {
          const angle1 = start + ((end - start) * index) / segments;
          const angle2 = start + ((end - start) * (index + 1)) / segments;
          sportsGroundLine(
            parent,
            x + Math.cos(angle1) * radius,
            y + Math.sin(angle1) * radius,
            x + Math.cos(angle2) * radius,
            y + Math.sin(angle2) * radius,
            0.55,
          );
        }
      }
      function sportsGroundSpot(parent, x, y, radius = 1) {
        const marker = mesh(cylinderGeo, sportsMaterials.white, parent, x, 0.36, y, radius, 0.13, radius);
        marker.castShadow = false;
      }

      // Repaint the existing canvas only when the score changes. The texture and
      // material remain stable across ordinary frames and new-game resets.
      function createSportsScoreboard(
        parent,
        venueKind,
        title,
        x,
        y,
        height,
        width,
        facingDirection = 1,
      ) {
        const canvas = document.createElement('canvas');
        canvas.width = 768;
        canvas.height = 384;
        const texture = new Three.CanvasTexture(canvas);
        texture.colorSpace = Three.SRGBColorSpace;
        const material = new Three.MeshBasicMaterial({
          map: texture,
          side: Three.DoubleSide,
          toneMapped: false,
        });
        const display = mesh(new Three.PlaneGeometry(width, width / 2), material, parent, x, height, y);
        display.name = venueKind + ' live scoreboard';
        display.castShadow = false;
        display.rotation.y = facingDirection < 0 ? Math.PI : 0;
        // Orient the backing together with the face. The south scoreboard faces
        // north into the pitch; its opaque casing must therefore sit to the south.
        const backing = box(
          parent,
          x,
          height,
          y - facingDirection * 2,
          width + 5,
          width / 2 + 5,
          3,
          sportsMaterials.facade,
        );
        const scoreboard = {
          venueKind,
          title,
          canvas,
          texture,
          display,
          backing,
          facingDirection,
          scoreKey: null,
          repaintCount: 0,
        };
        sportsScoreboards.push(scoreboard);
        return scoreboard;
      }
      function repaintSportsScoreboard(scoreboard, match) {
        const score = match.scores;
        const scoreKey = score[0] + ':' + score[1];
        if (scoreboard.scoreKey === scoreKey) return;
        scoreboard.scoreKey = scoreKey;
        scoreboard.repaintCount++;
        const context = scoreboard.canvas.getContext('2d');
        context.fillStyle = '#10222f';
        context.fillRect(0, 0, 768, 384);
        context.strokeStyle = '#91cbd9';
        context.lineWidth = 6;
        context.strokeRect(10, 10, 748, 364);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#d9e8d5';
        context.font = '600 35px Arial';
        context.fillText(scoreboard.title, 384, 49, 710);
        context.font = '600 34px Arial';
        context.fillStyle = match.venue.teamColors[0];
        context.fillText(match.venue.teamNames[0], 195, 115, 320);
        context.fillStyle = match.venue.teamColors[1];
        context.fillText(match.venue.teamNames[1], 573, 115, 320);
        context.fillStyle = '#f6f4d7';
        context.font = '700 156px Arial';
        context.fillText(String(score[0]), 195, 235, 260);
        context.fillText(String(score[1]), 573, 235, 260);
        context.font = '700 57px Arial';
        context.fillText(':', 384, 230);
        context.font = '500 27px Arial';
        context.fillStyle = '#9dbbbc';
        context.fillText(
          scoreboard.venueKind === 'basketball' ? 'RIVERSIDE 3 ON 3' : 'SOUTH COAST FOOTBALL',
          384,
          337,
          700,
        );
        scoreboard.texture.needsUpdate = true;
      }

      function createBasketballHoop(parent, rimX, centerY, direction, hoopHeight, hoopRadius) {
        const supportX = rimX - direction * 7;
        box(parent, supportX, 16, centerY, 1.6, 32, 1.6, darkMetal);
        box(parent, supportX, 3, centerY, 3.1, 6, 3.1, sportsMaterials.court);
        rod(
          parent,
          new Three.Vector3(supportX, 30, centerY),
          new Three.Vector3(rimX - direction * 2.6, hoopHeight + 1, centerY),
          0.65,
          darkMetal,
        );
        const boardX = rimX - direction * 3.1;
        box(parent, boardX, hoopHeight + 3.1, centerY, 0.7, 10, 16, sportsMaterials.white);
        box(
          parent,
          boardX + direction * 0.43,
          hoopHeight + 1.7,
          centerY,
          0.1,
          4.8,
          7.4,
          sportsMaterials.facade,
        );
        box(
          parent,
          boardX + direction * 0.5,
          hoopHeight + 1.7,
          centerY,
          0.1,
          3.8,
          6.4,
          sportsMaterials.white,
        );
        const rim = mesh(
          new Three.TorusGeometry(hoopRadius, 0.25, 6, 24),
          sportsMaterials.rim,
          parent,
          rimX,
          hoopHeight,
          centerY,
        );
        rim.rotation.x = Math.PI / 2;
        const threads = [];
        for (let strand = 0; strand < 12; strand++) {
          const angle = (strand / 12) * TAU;
          const nextAngle = ((strand + 1) / 12) * TAU;
          threads.push(
            rimX + Math.cos(angle) * hoopRadius,
            hoopHeight,
            centerY + Math.sin(angle) * hoopRadius,
            rimX + Math.cos(nextAngle) * 1.55,
            hoopHeight - 4,
            centerY + Math.sin(nextAngle) * 1.55,
          );
          for (const drop of [1.4, 2.8, 4]) {
            const radius = hoopRadius - (drop / 4) * (hoopRadius - 1.55);
            threads.push(
              rimX + Math.cos(angle) * radius,
              hoopHeight - drop,
              centerY + Math.sin(angle) * radius,
              rimX + Math.cos(nextAngle) * radius,
              hoopHeight - drop,
              centerY + Math.sin(nextAngle) * radius,
            );
          }
        }
        sportsLineSegments(parent, threads);
      }

      function createBasketballVenue(venue) {
        const group = new Three.Group();
        group.name = 'Riverside live basketball court';
        scene.add(group);
        const centerX = venue.x + venue.w / 2;
        const centerY = venue.y + venue.h / 2;
        box(group, centerX, 0.12, centerY, venue.w + 8, 0.2, venue.h + 8, sportsMaterials.court);
        sportsGroundRectangle(group, venue.x, venue.y, venue.w, venue.h);
        sportsGroundLine(group, centerX, venue.y, centerX, venue.y + venue.h);
        sportsGroundArc(group, centerX, centerY, 12);
        for (const direction of [1, -1]) {
          const baselineX = direction === 1 ? venue.x : venue.x + venue.w;
          const freeThrowX = baselineX + direction * 30;
          box(group, baselineX + direction * 15, 0.24, centerY, 30, 0.07, 31, sportsMaterials.courtKey);
          sportsGroundRectangle(group, Math.min(baselineX, freeThrowX), centerY - 15.5, 30, 31);
          sportsGroundArc(group, freeThrowX, centerY, 10);
          const rimX = baselineX + direction * (venue.hoopInset || 10);
          sportsGroundArc(
            group,
            rimX,
            centerY,
            venue.threePointRadius,
            direction === 1 ? -Math.PI / 2 : Math.PI / 2,
            direction === 1 ? Math.PI / 2 : Math.PI * 1.5,
          );
          createBasketballHoop(group, rimX, centerY, direction, venue.hoopHeight, venue.hoopRadius);
        }
        createSportsScoreboard(group, 'basketball', 'RIVERSIDE COURTS', centerX, venue.y - 4, 29, 43);
        for (const postX of [centerX - 15, centerX + 15])
          box(group, postX, 9, venue.y - 6, 1.2, 18, 1.2, darkMetal);
        sportsVenueModels.set('basketball', { group, venue, x: centerX, y: centerY, radius: 110 });
      }

      function createSoccerGoal(parent, goalX, centerY, direction, goalWidth, goalHeight, goalDepth) {
        const rearX = goalX - direction * goalDepth;
        const side1 = centerY - goalWidth / 2;
        const side2 = centerY + goalWidth / 2;
        for (const sideY of [side1, side2]) {
          rod(
            parent,
            new Three.Vector3(goalX, 0, sideY),
            new Three.Vector3(goalX, goalHeight, sideY),
            0.7,
            sportsMaterials.white,
          );
          rod(
            parent,
            new Three.Vector3(goalX, goalHeight, sideY),
            new Three.Vector3(rearX, goalHeight - 3, sideY),
            0.4,
            sportsMaterials.white,
          );
          rod(
            parent,
            new Three.Vector3(rearX, 0, sideY),
            new Three.Vector3(rearX, goalHeight - 3, sideY),
            0.4,
            sportsMaterials.white,
          );
        }
        rod(
          parent,
          new Three.Vector3(goalX, goalHeight, side1),
          new Three.Vector3(goalX, goalHeight, side2),
          0.7,
          sportsMaterials.white,
        );
        const net = [];
        for (let sideY = side1; sideY <= side2; sideY += 3) {
          net.push(rearX, 0.2, sideY, rearX, goalHeight - 3, sideY);
          net.push(rearX, goalHeight - 3, sideY, goalX, goalHeight, sideY);
        }
        for (let height = 0.3; height <= goalHeight - 3; height += 3) {
          net.push(rearX, height, side1, rearX, height, side2);
          for (const sideY of [side1, side2]) net.push(rearX, height, sideY, goalX, height, sideY);
        }
        for (let distance = 3; distance <= goalDepth; distance += 3) {
          const netX = goalX - direction * distance;
          const top = goalHeight - (distance / goalDepth) * 3;
          net.push(netX, top, side1, netX, top, side2);
          for (const sideY of [side1, side2]) net.push(netX, 0.2, sideY, netX, top, sideY);
        }
        sportsLineSegments(parent, net);
      }

      // Each shared STADIUM_STANDS rectangle is an exact, solid base footprint.
      // Rows step upward toward the outside of the stadium; the field and the
      // central south entrance remain entirely free of permanent stand geometry.
      function createStadiumStand(parent, stand, crowdSeats) {
        const group = new Three.Group();
        group.name = 'Stadium stand ' + stand.id;
        parent.add(group);
        const side = stand.side || (stand.id.startsWith('south') ? 'south' : stand.id);
        const horizontal = side === 'north' || side === 'south';
        const depth = horizontal ? stand.h : stand.w;
        const length = horizontal ? stand.w : stand.h;
        const rowCount = Math.max(6, Math.floor(depth / 9));
        const rowDepth = depth / rowCount;
        // The shared collision height includes the canopy and seated spectators.
        const heightStep = (stand.height - 31) / rowCount;
        const facadeMaterial = sportsMaterials.facade;
        box(group, stand.x + stand.w / 2, 2, stand.y + stand.h / 2, stand.w, 4, stand.h, facadeMaterial);
        for (let row = 0; row < rowCount; row++) {
          const rowHeight = 6 + (row + 1) * heightStep;
          const offset = (row + 0.5) * rowDepth;
          const rowX =
            side === 'west'
              ? stand.x + stand.w - offset
              : side === 'east'
                ? stand.x + offset
                : stand.x + stand.w / 2;
          const rowY =
            side === 'north'
              ? stand.y + stand.h - offset
              : side === 'south'
                ? stand.y + offset
                : stand.y + stand.h / 2;
          box(
            group,
            rowX,
            rowHeight / 2,
            rowY,
            horizontal ? length : rowDepth,
            rowHeight,
            horizontal ? rowDepth : length,
            sportsMaterials.concrete,
          );
          const seatCount = Math.floor((length - 15) / 8.2);
          for (let seat = 0; seat < seatCount; seat++) {
            // Regular stair aisles cut through the seating, while preserving the
            // stepped concrete slab below spectators and the collision footprint.
            if (seat % 15 === 0 || seat % 15 === 1) continue;
            const along = 8 + seat * 8.2;
            const seatX = horizontal ? stand.x + along : rowX;
            const seatY = horizontal ? rowY : stand.y + along;
            const facing =
              side === 'north'
                ? -Math.PI / 2
                : side === 'south'
                  ? Math.PI / 2
                  : side === 'west'
                    ? 0
                    : Math.PI;
            crowdSeats.push({ x: seatX, y: seatY, height: rowHeight, facing, seed: seat + row * 83 });
          }
        }
        const outerX =
          side === 'west' ? stand.x + 2 : side === 'east' ? stand.x + stand.w - 2 : stand.x + stand.w / 2;
        const outerY =
          side === 'north'
            ? stand.y + 2
            : side === 'south'
              ? stand.y + stand.h - 2
              : stand.y + stand.h / 2;
        box(
          group,
          outerX,
          stand.height - 16,
          outerY,
          horizontal ? length : 3,
          3,
          horizontal ? 3 : length,
          sportsMaterials.facade,
        );
        // A narrow outer canopy gives the venue its stadium silhouette without
        // covering the open pitch or hiding the players from the elevated camera.
        const canopyDepth = Math.min(22, depth * 0.26);
        const canopyX =
          side === 'west'
            ? stand.x + canopyDepth / 2
            : side === 'east'
              ? stand.x + stand.w - canopyDepth / 2
              : stand.x + stand.w / 2;
        const canopyY =
          side === 'north'
            ? stand.y + canopyDepth / 2
            : side === 'south'
              ? stand.y + stand.h - canopyDepth / 2
              : stand.y + stand.h / 2;
        box(
          group,
          canopyX,
          stand.height - 1,
          canopyY,
          horizontal ? length : canopyDepth,
          2,
          horizontal ? canopyDepth : length,
          sportsMaterials.canopy,
        );
        for (let along = 10; along < length; along += 70) {
          box(
            group,
            horizontal ? stand.x + along : outerX,
            stand.height - 9,
            horizontal ? outerY : stand.y + along,
            1.2,
            16,
            1.2,
            sportsMaterials.facade,
          );
        }
        stadiumStandModels.push({ group, stand });
      }

      function createStadiumCrowd(parent, seats) {
        const crowd = new Three.Group();
        crowd.name = 'Stadium crowd (' + seats.length + ' seated spectators)';
        parent.add(crowd);
        const bodies = new Three.InstancedMesh(boxGeo, sportsMaterials.white, seats.length);
        const heads = new Three.InstancedMesh(sphereGeo, sportsMaterials.white, seats.length);
        const benches = new Three.InstancedMesh(boxGeo, sportsMaterials.seat, seats.length);
        const legs = new Three.InstancedMesh(boxGeo, sportsMaterials.shorts, seats.length);
        const arms = new Three.InstancedMesh(boxGeo, sportsMaterials.white, seats.length * 2);
        bodies.name = 'Crowd shirts';
        heads.name = 'Crowd heads';
        benches.name = 'Individual stadium seats';
        const transform = new Three.Object3D();
        const color = new Three.Color();
        const shirtColors = ['#459ace', '#5cb3d1', '#e56c58', '#e3c579', '#d4e2dc', '#7583a1'];
        function putInstance(instances, index, seat, x, height, z, scaleX, scaleY, scaleZ, lean = 0) {
          const cosine = Math.cos(seat.facing);
          const sine = Math.sin(seat.facing);
          transform.position.set(
            seat.x + x * cosine + z * sine,
            seat.height + height,
            seat.y - x * sine + z * cosine,
          );
          transform.rotation.set(0, seat.facing, lean);
          transform.scale.set(scaleX, scaleY, scaleZ);
          transform.updateMatrix();
          instances.setMatrixAt(index, transform.matrix);
        }
        seats.forEach((seat, index) => {
          putInstance(benches, index, seat, -0.6, 2.4, 0, 4.8, 1, 6.2);
          putInstance(bodies, index, seat, -0.6, 6, 0, 4.4, 5.6, 6);
          putInstance(heads, index, seat, 0, 10.9, 0, 1.9, 2.4, 2);
          putInstance(legs, index, seat, 2.2, 2, 0, 5.5, 2.2, 5.2);
          const cheering = seat.seed % 7 === 0;
          for (const side of [-1, 1]) {
            putInstance(
              arms,
              index * 2 + (side === 1 ? 1 : 0),
              seat,
              cheering ? 0.3 : 0.4,
              cheering ? 11 : 6,
              side * 3.8,
              1.5,
              5.3,
              1.6,
              cheering ? side * 0.4 : 0.2,
            );
            arms.setColorAt(
              index * 2 + (side === 1 ? 1 : 0),
              color.set(shirtColors[seat.seed % shirtColors.length]),
            );
          }
          bodies.setColorAt(index, color.set(shirtColors[seat.seed % shirtColors.length]));
          heads.setColorAt(index, color.set(['#ca9e79', '#a77853', '#78513a'][seat.seed % 3]));
        });
        for (const instances of [bodies, heads, benches, legs, arms]) {
          instances.instanceMatrix.needsUpdate = true;
          if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
          instances.receiveShadow = true;
          instances.castShadow = false;
          instances.computeBoundingSphere();
          crowd.add(instances);
        }
        return crowd;
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
        createSportsScoreboard(group, 'soccer', 'SOUTH COAST STADIUM', centerX, 4319, 119, 130);
        // A second board faces inward from the south side, above the entry gap.
        createSportsScoreboard(group, 'soccer', 'SOUTH COAST STADIUM', centerX, 4878, 119, 86, -1);
        for (const x of [2653, 2725]) box(group, x, 43, 4863, 4, 86, 4, sportsMaterials.facade);
        box(group, centerX, 86, 4863, 77, 4, 5, sportsMaterials.canopy);
        sportsVenueModels.set('soccer', { group, crowd, venue, x: centerX, y: centerY, radius: 600 });
      }

      for (const [sport, venue] of Object.entries(SPORTS_VENUES)) {
        if (sport === 'basketball') createBasketballVenue(venue);
        if (sport === 'soccer') createSoccerVenue(venue);
      }

      // Athlete factories use fixed shared materials and primitive geometry. A reset
      // removes stale groups without disposing resources used by the next match.
      const sportsShirtMaterials = new Map();
      for (const venue of Object.values(SPORTS_VENUES))
        for (const color of venue.teamColors) sportsShirtMaterials.set(color, mat(color));
      for (const color of ['#e5c84c', '#74c99b']) sportsShirtMaterials.set(color, mat(color));

      function createSportsAthlete(athlete) {
        const group = new Three.Group();
        group.name = athlete.sport + ' player ' + athlete.team + ':' + athlete.number;
        const cloth = sportsShirtMaterials.get(athlete.color) || sportsMaterials.homeShirt;
        const skin = sportsMaterials.skin[(athlete.number + athlete.team) % sportsMaterials.skin.length];
        const torso = box(group, 0, 10, 0, 4.5, 6, 6.5, cloth);
        box(group, 2.3, 10.3, 0, 0.14, 0.8, 5.4, sportsMaterials.white);
        box(group, 0, 7.1, 0, 4.6, 1.2, 6.6, sportsMaterials.shorts);
        mesh(sphereGeo, skin, group, 0, 15.3, 0, 2, 2.5, 2.1);
        mesh(sphereGeo, sportsMaterials.hair, group, -0.5, 16.5, 0, 1.9, 1.6, 2.13);
        const parts = {};
        for (const side of [-1, 1]) {
          const leg = new Three.Group();
          leg.position.set(0, 7, side * 1.8);
          group.add(leg);
          box(leg, 0, -1.1, 0, 2.1, 2.4, 2.5, sportsMaterials.shorts);
          box(leg, 0, -2.8, 0, 1.7, 1.6, 2.1, skin);
          box(leg, 0, -4.1, 0, 1.8, 1.5, 2.2, sportsMaterials.white);
          box(leg, 1, -5.6, 0, 3.6, 1.3, 2.5, sportsMaterials.shoes);
          parts['leg' + side] = leg;
          const arm = new Three.Group();
          arm.position.set(0, 12, side * 4);
          group.add(arm);
          box(arm, 0, -0.9, 0, 1.8, 2, 1.9, cloth);
          box(arm, 0, -2, 0, 1.5, 1.1, 1.6, skin);
          const forearm = new Three.Group();
          forearm.position.set(0, -2.5, 0);
          arm.add(forearm);
          box(forearm, 0, -0.8, 0, 1.5, 2.1, 1.5, skin);
          mesh(sphereGeo, skin, forearm, 0.2, -2.1, 0, 0.9, 1.05, 0.95);
          parts['arm' + side] = arm;
          parts['forearm' + side] = forearm;
        }
        scene.add(group);
        return { group, torso, parts };
      }

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
        return { group };
      }

      function poseSportsAthlete(model, athlete, match) {
        const { group, parts, torso } = model;
        const running = athlete.walking ? Math.sin(athlete.walk) * 0.62 : 0;
        const actionProgress =
          athlete.actionDuration > 0 ? 1 - athlete.actionTime / athlete.actionDuration : 0;
        const actionSwing = Math.sin(Math.max(0, Math.min(1, actionProgress)) * Math.PI);
        group.position.set(athlete.x, athlete.jump || 0, athlete.y);
        group.rotation.set(0, -athlete.a, 0);
        torso.rotation.z = 0;
        parts.leg1.rotation.z = running;
        parts['leg-1'].rotation.z = -running;
        parts.arm1.rotation.z = -running * 0.65;
        parts['arm-1'].rotation.z = running * 0.65;
        parts.forearm1.rotation.z = 0.35;
        parts['forearm-1'].rotation.z = 0.35;
        const ownsBall = match.ball.ownerId === athlete.id;
        if (match.sport === 'basketball') {
          if (ownsBall && athlete.action === 'dribble') {
            // The hand follows the same bounce frequency used by sports.js.
            const bounce = Math.abs(Math.sin(match.time * 8 + athlete.number));
            parts.arm1.rotation.z = 0.45 + bounce * 0.75;
            parts.forearm1.rotation.z = -0.2 + bounce * 0.3;
            parts['arm-1'].rotation.z = 0.35;
            torso.rotation.z = -0.08;
          } else if (athlete.action === 'shoot') {
            parts.arm1.rotation.z = 2.25 + actionSwing * 0.45;
            parts['arm-1'].rotation.z = 2.05 + actionSwing * 0.5;
            parts.forearm1.rotation.z = -0.45 * (1 - actionProgress);
            parts['forearm-1'].rotation.z = -0.35 * (1 - actionProgress);
            parts.leg1.rotation.z = 0.15;
            parts['leg-1'].rotation.z = -0.15;
          } else if (athlete.action === 'pass') {
            parts.arm1.rotation.z = 1.2 + actionSwing * 0.3;
            parts['arm-1'].rotation.z = 1.2 + actionSwing * 0.3;
            parts.forearm1.rotation.z = 0.25 * (1 - actionProgress);
            parts['forearm-1'].rotation.z = 0.25 * (1 - actionProgress);
          } else if (athlete.action === 'rebound') {
            parts.arm1.rotation.z = 2.7;
            parts['arm-1'].rotation.z = 2.5;
          } else if (!ownsBall && match.possessionTeam !== athlete.team) {
            parts.arm1.rotation.z = 0.95;
            parts['arm-1'].rotation.z = 0.85;
            torso.rotation.z = -0.06;
          }
        } else {
          if (athlete.action === 'shoot' || athlete.action === 'pass') {
            // A planted support foot, full kicking-leg follow-through and opposite
            // arm swing make kicks visibly distinct from running after the ball.
            parts.leg1.rotation.z = -0.55 + actionSwing * 1.8;
            parts['leg-1'].rotation.z = -0.18;
            parts.arm1.rotation.z = -0.55;
            parts['arm-1'].rotation.z = 0.8;
            torso.rotation.z = -0.15;
          } else if (athlete.action === 'save') {
            parts.arm1.rotation.z = 1.7;
            parts['arm-1'].rotation.z = 1.7;
            parts.forearm1.rotation.z = 0;
            parts['forearm-1'].rotation.z = 0;
            group.rotation.x = Math.sin(match.time * 5) * 0.23;
          } else if (ownsBall) {
            parts.leg1.rotation.z += Math.sin(match.time * 9) * 0.23;
            torso.rotation.z = -0.07;
          }
        }
        if (athlete.action === 'celebrate') {
          parts.arm1.rotation.z = 2.6 + Math.sin(match.time * 7 + athlete.number) * 0.2;
          parts['arm-1'].rotation.z = 2.6 - Math.sin(match.time * 7 + athlete.number) * 0.2;
          group.rotation.z = Math.sin(match.time * 5 + athlete.number) * 0.06;
        }
      }

      function updateSportsVisuals(deltaSeconds) {
        // deltaSeconds is deliberately not used as an animation clock: simulation
        // time and action timers freeze during pause and remain authoritative.
        const liveAthletes = new Set();
        const liveMatches = new Set(Object.values(sportsMatches));
        for (const match of liveMatches) for (const athlete of match.players) liveAthletes.add(athlete);
        for (const [athlete, model] of sportsAthleteModels) {
          if (!liveAthletes.has(athlete)) {
            scene.remove(model.group);
            sportsAthleteModels.delete(athlete);
          }
        }
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
          if (venueModel.crowd) venueModel.crowd.visible = worldZoom > 0.28;
          for (const scoreboard of sportsScoreboards) {
            if (scoreboard.venueKind === match.sport && venueModel.group.visible)
              repaintSportsScoreboard(scoreboard, match);
          }
          for (const athlete of match.players) {
            const visible = venueModel.group.visible && worldZoom > 0.22 && entityInView(athlete, 25);
            let model = sportsAthleteModels.get(athlete);
            if (!model && !visible) continue;
            if (!model) {
              model = createSportsAthlete(athlete);
              sportsAthleteModels.set(athlete, model);
            }
            model.group.visible = visible;
            if (visible) poseSportsAthlete(model, athlete, match);
          }
          const ballVisible =
            venueModel.group.visible && worldZoom > 0.22 && entityInView(match.ball, 40);
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
      }
      // END SUBSYSTEM: src/sports3d.js
