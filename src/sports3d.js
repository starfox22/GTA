      // BEGIN SUBSYSTEM: src/sports3d.js — Sports stadium and match meshes
      /**
       * Live urban sports scenery and athlete animation
       * Source: src/sports3d.js
       * Scope: createCityRenderer() closure.
       * Venue dimensions, ball positions and scores come from sports.js. World x/y
       * map to Three.js x/z; height always uses Three.js y. Athlete scale matches
       * ordinary pedestrians: feet at zero and hair just below 18 world units.
       *
       * Match day dresses the venue from the fixture: kits with their patterns on
       * the athletes (officials in black, stewards in yellow), fans in the two
       * clubs' colours filling the stands to the attendance, flags on the plaza,
       * six big screens (STADIUM_SCREENS) and the court board sharing one live
       * canvas per venue. The stands cheer a goal, and empty in a panic.
       */
      const sportsVenueModels = new Map(),
        sportsAthleteModels = new Map(),
        sportsBallModels = new Map(),
        sportsBoardSurfaces = new Map(),
        sportsScreens = [],
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

      /**
       * LIVE SCOREBOARDS
       * Every screen at a venue shows the same picture, so each venue paints one
       * canvas and all its screens share the texture. It is repainted only when
       * what it shows changes: the score, the match minute, the stage, the status
       * line, or a frame of the goal animation (8 a second while it runs).
       * Screens are MeshBasicMaterial with tone mapping off: they glow at night.
       */
      const SPORTS_BOARD_W = 1024,
        SPORTS_BOARD_H = 512;
      function sportsBoardSurface(sport) {
        let surface = sportsBoardSurfaces.get(sport);
        if (surface) return surface;
        const canvas = document.createElement('canvas');
        canvas.width = SPORTS_BOARD_W;
        canvas.height = SPORTS_BOARD_H;
        const texture = new Three.CanvasTexture(canvas);
        texture.colorSpace = Three.SRGBColorSpace;
        texture.anisotropy = 4;
        const material = new Three.MeshBasicMaterial({ map: texture, toneMapped: false });
        surface = { sport, canvas, texture, material, key: null, repaintCount: 0 };
        sportsBoardSurfaces.set(sport, surface);
        return surface;
      }

      /**
       * One screen: the lit face, a casing behind it, a frame and two legs down
       * to whatever it stands on. `screen` is a STADIUM_SCREENS entry (x, y, z,
       * w, yaw, tilt); the face is a 2:1 plane facing +z before the yaw.
       */
      function createSportsScreen(parent, sport, screen) {
        const surface = sportsBoardSurface(sport),
          width = screen.w,
          height = screen.w / 2,
          holder = new Three.Group(),
          tilted = new Three.Group();
        holder.name = sport + ' scoreboard ' + screen.id;
        holder.position.set(screen.x, screen.z, screen.y);
        holder.rotation.y = screen.yaw;
        // Lean the top back so the elevated street camera reads the face square on.
        tilted.rotation.x = -screen.tilt;
        holder.add(tilted);
        parent.add(holder);
        const face = mesh(new Three.PlaneGeometry(width, height), surface.material, tilted, 0, 0, 0.9);
        face.castShadow = false;
        face.name = sport + ' live scoreboard';
        box(tilted, 0, 0, -1, width + 4, height + 4, 3.2, sportsMaterials.facade);
        box(tilted, 0, height / 2 + 2.6, 0.2, width + 5, 1.6, 2.2, darkMetal);
        box(tilted, 0, -height / 2 - 2.6, 0.2, width + 5, 1.6, 2.2, darkMetal);
        // Legs from the ground (or the beam it sits on) up to the casing.
        const base = screen.base === undefined ? 0 : screen.base;
        if (base !== null)
          for (const side of [-1, 1])
            box(holder, side * width * 0.3, (base - screen.z) / 2, -3.5, 2.2, screen.z - base, 2.2, darkMetal);
        // A soft glow round the screen after dark.
        const glow = halo(holder, 0, 0, 3, width * 1.25, '#bcd9ff');
        glow.material.opacity = 0;
        const entry = { sport, screen, holder, face, glow, surface };
        sportsScreens.push(entry);
        return entry;
      }

      function sportsBoardKey(match) {
        const flash = sportsGoalFlashFrame(match);
        return [
          match.fixture.id,
          match.stage,
          match.period,
          match.scores.join(':'),
          sportsBoardClock(match),
          match.status,
          match.abandoned,
          flash,
          match.invader ? 1 : 0,
        ].join('|');
      }

      /* Which frame of the goal animation is showing (-1: none): five seconds at
         8 fps for a goal, a quick flash for a basket. */
      function sportsGoalFlashFrame(match) {
        const flash = match.goalFlash;
        if (!flash) return -1;
        const age = match.time - flash.time;
        return age >= 0 && age < (match.sport === 'basketball' ? 1.5 : 5) ? Math.floor(age * 8) : -1;
      }

      function boardText(context, text, x, y, size, color, weight = 800, maxWidth = 900, align = 'center') {
        context.font = weight + ' ' + size + 'px Arial';
        context.fillStyle = color;
        context.textAlign = align;
        context.textBaseline = 'middle';
        context.fillText(text, x, y, maxWidth);
      }

      function paintSportsBoard(surface, match) {
        const key = sportsBoardKey(match);
        if (surface.key === key) return;
        surface.key = key;
        surface.repaintCount++;
        const context = surface.canvas.getContext('2d'),
          W = SPORTS_BOARD_W,
          H = SPORTS_BOARD_H,
          [home, away] = match.teams,
          [homeKit, awayKit] = match.kits,
          frame = sportsGoalFlashFrame(match);
        // Background: a dark LED panel with a subtle scanline.
        const sky = context.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#0b1a28');
        sky.addColorStop(1, '#050b12');
        context.fillStyle = sky;
        context.fillRect(0, 0, W, H);
        if (frame >= 0) {
          paintGoalAnimation(context, match, frame);
        } else if (match.abandoned) {
          context.fillStyle = '#8a1620';
          context.fillRect(0, 0, W, 110);
          boardText(context, 'MATCH ABANDONED', W / 2, 58, 74, '#fff1ec');
          drawSportsCrest(context, home, 150, 250, 150);
          drawSportsCrest(context, away, W - 150, 250, 150);
          boardText(context, match.scores[0] + ' - ' + match.scores[1], W / 2, 250, 170, '#f6f4d7');
          boardText(context, home.short + '  v  ' + away.short, W / 2, 365, 54, '#c9d7da');
          boardText(context, 'THE VENUE IS CLOSED · NEXT FIXTURE TOMORROW', W / 2, 450, 38, '#ffb4a8', 700);
        } else if (['upcoming', 'warmup', 'over'].includes(match.stage)) {
          const header = match.stage === 'warmup' ? 'WARM UP · KICK OFF SOON' : match.stage === 'over' ? 'RESULT' : 'NEXT MATCH';
          context.fillStyle = '#16354c';
          context.fillRect(0, 0, W, 96);
          boardText(context, header, W / 2, 50, 58, '#e8f3f2');
          drawSportsCrest(context, home, 170, 230, 170);
          drawSportsCrest(context, away, W - 170, 230, 170);
          if (match.stage === 'over') boardText(context, match.scores[0] + ' - ' + match.scores[1], W / 2, 230, 150, '#f6f4d7');
          else boardText(context, 'v', W / 2, 230, 110, '#8fb4bd');
          boardText(context, home.name, 250, 360, 44, lightenForBoard(homeKit.primary), 800, 460);
          boardText(context, away.name, W - 250, 360, 44, lightenForBoard(awayKit.primary), 800, 460);
          const day = Math.floor(match.fixture.kickoff / 1440) + 1;
          boardText(
            context,
            match.stage === 'over' ? 'FULL TIME · DAY ' + day : 'KICK OFF ' + sportsKickoffText(match.fixture.kickoff) + ' · DAY ' + day,
            W / 2,
            450,
            56,
            '#ffd76a',
          );
        } else {
          // Live, break or full time: the classic score layout.
          context.fillStyle = '#12304a';
          context.fillRect(0, 0, W, 92);
          boardText(context, match.venue.league, 30, 48, 42, '#cfe5ea', 800, 560, 'left');
          // The clock in its own box, top right.
          context.fillStyle = match.stage === 'live' ? '#f2d34a' : '#e8e8e0';
          context.fillRect(W - 300, 14, 280, 66);
          boardText(context, sportsBoardClock(match), W - 160, 49, 48, '#101418', 900, 260);
          for (const [team, x] of [
            [0, 150],
            [1, W - 150],
          ]) {
            const kit = match.kits[team];
            drawSportsCrest(context, match.teams[team], x, 190, 140);
            context.fillStyle = kit.primary;
            context.fillRect(x - 110, 282, 220, 16);
            context.fillStyle = kit.secondary;
            context.fillRect(x - 110, 298, 220, 8);
            boardText(context, match.teams[team].short, x, 350, 86, '#f4f4ec');
          }
          boardText(context, String(match.scores[0]), W / 2 - 130, 245, 230, '#f6f4d7', 900, 240);
          boardText(context, String(match.scores[1]), W / 2 + 130, 245, 230, '#f6f4d7', 900, 240);
          boardText(context, '-', W / 2, 235, 140, '#8fb4bd');
          // Status line: who has the ball, PITCH INVADER!, HALF TIME, FULL TIME.
          const alert = match.invader || match.status.includes('INVADER');
          context.fillStyle = alert ? '#b3261e' : '#0f2335';
          context.fillRect(0, 420, W, 92);
          boardText(context, match.status, W / 2, 466, 50, alert ? '#fff4d8' : '#bfe3ef', 800, 980);
        }
        // LED dot texture over everything.
        context.fillStyle = 'rgba(0,0,0,0.18)';
        for (let y = 0; y < H; y += 4) context.fillRect(0, y, W, 1);
        surface.texture.needsUpdate = true;
      }

      /* Light team colours stay as they are; very dark ones are lifted to read on a dark panel. */
      function lightenForBoard(color) {
        const value = parseInt(color.slice(1), 16),
          r = (value >> 16) & 255,
          g = (value >> 8) & 255,
          b = value & 255;
        if (r * 0.3 + g * 0.59 + b * 0.11 > 90) return color;
        return 'rgb(' + Math.min(255, r + 110) + ',' + Math.min(255, g + 110) + ',' + Math.min(255, b + 110) + ')';
      }

      /* GOAL! flashing in the scoring side's colours, with bursting stripes. */
      function paintGoalAnimation(context, match, frame) {
        const W = SPORTS_BOARD_W,
          H = SPORTS_BOARD_H,
          flash = match.goalFlash,
          kit = match.kits[flash.team],
          on = frame % 4 < 2;
        context.fillStyle = on ? kit.primary : '#0b1622';
        context.fillRect(0, 0, W, H);
        // Stripes fanning out from the middle, turning as the frames go.
        context.save();
        context.translate(W / 2, H / 2);
        context.rotate(frame * 0.08);
        context.fillStyle = on ? kit.secondary : kit.primary;
        context.globalAlpha = 0.45;
        for (let ray = 0; ray < 12; ray++) {
          context.rotate(TAU / 12);
          context.beginPath();
          context.moveTo(0, 0);
          context.lineTo(W, -60);
          context.lineTo(W, 60);
          context.closePath();
          context.fill();
        }
        context.restore();
        const pulse = 1 + 0.08 * Math.sin(frame * 1.3);
        context.save();
        context.translate(W / 2, 205);
        context.scale(pulse, pulse);
        context.lineWidth = 16;
        context.strokeStyle = '#0b0f14';
        context.font = '900 250px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.strokeText(match.sport === 'basketball' ? '+' + flash.points : 'GOAL!', 0, 0);
        context.fillStyle = '#fff8d8';
        context.fillText(match.sport === 'basketball' ? '+' + flash.points : 'GOAL!', 0, 0);
        context.restore();
        const line = flash.byPlayer
          ? flash.friendly
            ? 'WHAT A FINISH!'
            : 'PITCH INVADER SCORES!'
          : match.teams[flash.team].name;
        context.fillStyle = 'rgba(8,12,18,0.82)';
        context.fillRect(0, 372, W, 140);
        boardText(context, line, W / 2, 412, 58, '#ffe27a', 900, 980);
        boardText(
          context,
          match.teams[0].short + '  ' + match.scores[0] + ' - ' + match.scores[1] + '  ' + match.teams[1].short,
          W / 2,
          474,
          50,
          '#f4f4ec',
        );
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
        // Court lines are hundreds of short segments: merged by the static batcher.
        batchGroups.push(group);
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
        createSportsScreen(group, 'basketball', { id: 'court', x: centerX, y: venue.y - 4, z: 29, w: 43, yaw: 0, tilt: 0.25 });
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
        const boardMat = mat('#1c2a36', 0.6, 0.3),
          steel = mat('#8d979e', 0.45, 0.6),
          yellow = mat('#e0b545', 0.5, 0.3),
          booth = mat('#2f4a5e', 0.7, 0.2),
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

      // Athlete factories share one material per kit colour and primitive geometry.
      // A new fixture replaces the athletes; stale groups are removed without
      // disposing resources the next match reuses.
      const sportsKitMaterials = new Map();
      function sportsKitMaterial(color) {
        let material = sportsKitMaterials.get(color);
        if (!material) sportsKitMaterials.set(color, (material = mat(color, 0.78)));
        return material;
      }

      /**
       * The kit's pattern in the second colour over the shirt (the torso is 4.5
       * deep along x, the way the athlete faces, and 6.5 wide along z):
       * stripes, hoops, halves, a sash, or a chevron across the chest.
       */
      function addKitPattern(group, kit) {
        const trim = sportsKitMaterial(kit.secondary);
        if (kit.pattern === 'stripes')
          for (const z of [-2.2, 0, 2.2]) box(group, 0, 10, z, 4.62, 6.02, 0.95, trim);
        else if (kit.pattern === 'hoops') for (const y of [8.6, 11.2]) box(group, 0, y, 0, 4.62, 1.2, 6.62, trim);
        else if (kit.pattern === 'halves') box(group, 0, 10, 1.64, 4.62, 6.02, 3.3, trim);
        else if (kit.pattern === 'sash') {
          const sash = box(group, 0, 10, 0, 4.64, 1.5, 8.2, trim);
          sash.rotation.x = 0.72;
        } else if (kit.pattern === 'chevron')
          for (const side of [-1, 1]) {
            const bar = box(group, 2.28, 11, side * 1.5, 0.12, 1.1, 3.6, trim);
            bar.rotation.x = side * 0.55;
          }
      }

      function createSportsAthlete(athlete) {
        const group = new Three.Group();
        group.name = athlete.sport + ' ' + athlete.kind + ' ' + athlete.id;
        const kit = athlete.kit,
          cloth = sportsKitMaterial(kit.primary),
          shorts = sportsKitMaterial(kit.shorts),
          socks = sportsKitMaterial(kit.socks),
          seed = sportsHash(athlete.id.length, athlete.number, athlete.team + 5),
          skin = sportsMaterials.skin[seed % sportsMaterials.skin.length];
        const torso = box(group, 0, 10, 0, 4.5, 6, 6.5, cloth);
        addKitPattern(group, kit);
        if (athlete.kind === 'athlete') box(group, 2.3, 10.3, 0, 0.14, 0.8, 5.4, sportsKitMaterial(kit.secondary));
        box(group, 0, 7.1, 0, 4.6, 1.2, 6.6, shorts);
        mesh(sphereGeo, skin, group, 0, 15.3, 0, 2, 2.5, 2.1);
        mesh(sphereGeo, sportsMaterials.hair, group, -0.5, 16.5, 0, 1.9, 1.6, 2.13);
        const parts = {};
        for (const side of [-1, 1]) {
          const leg = new Three.Group();
          leg.position.set(0, 7, side * 1.8);
          group.add(leg);
          box(leg, 0, -1.1, 0, 2.1, 2.4, 2.5, shorts);
          box(leg, 0, -2.8, 0, 1.7, 1.6, 2.1, athlete.kind === 'steward' ? shorts : skin);
          box(leg, 0, -4.1, 0, 1.8, 1.5, 2.2, socks);
          box(leg, 1, -5.6, 0, 3.6, 1.3, 2.5, sportsMaterials.shoes);
          parts['leg' + side] = leg;
          const arm = new Three.Group();
          arm.position.set(0, 12, side * 4);
          group.add(arm);
          box(arm, 0, -0.9, 0, 1.8, 2, 1.9, cloth);
          box(arm, 0, -2, 0, 1.5, 1.1, 1.6, athlete.kind === 'steward' ? cloth : skin);
          const forearm = new Three.Group();
          forearm.position.set(0, -2.5, 0);
          arm.add(forearm);
          box(forearm, 0, -0.8, 0, 1.5, 2.1, 1.5, skin);
          mesh(sphereGeo, skin, forearm, 0.2, -2.1, 0, 0.9, 1.05, 0.95);
          // The assistant referees carry their flags.
          if (athlete.kind === 'assistant' && side > 0) {
            box(forearm, 0.3, -3.2, 0, 0.3, 4.4, 0.3, darkMetal);
            box(forearm, 0.3, -1.9, 1.4, 0.15, 2, 2.6, sportsKitMaterial('#f2d33a'));
          }
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
        group.position.set(athlete.x, athlete.jump || 0, athlete.y);
        group.rotation.set(0, -athlete.a, 0);
        torso.rotation.z = 0;
        // Down: shot, stabbed, run over. The dead stay on their backs; the
        // knocked-down lie there until they get up.
        if (athlete.hp <= 0 || athlete.knockedFor > 0) {
          group.position.y = 2.3;
          group.rotation.set(0, -athlete.a, Math.PI / 2);
          for (const side of [-1, 1]) {
            parts['leg' + side].rotation.z = side * 0.12;
            parts['arm' + side].rotation.z = 2.4 + side * 0.3;
            parts['forearm' + side].rotation.z = 0.2;
          }
          return;
        }
        // Running for their lives: long strides, arms pumping, leaning in.
        const fleeing = athlete.fleeing || (match.abandoned && athlete.walking);
        const stride = fleeing ? 0.9 : 0.62;
        const running = athlete.walking ? Math.sin(athlete.walk) * stride : 0;
        const actionProgress =
          athlete.actionDuration > 0 ? 1 - athlete.actionTime / athlete.actionDuration : 0;
        const actionSwing = Math.sin(Math.max(0, Math.min(1, actionProgress)) * Math.PI);
        parts.leg1.rotation.z = running;
        parts['leg-1'].rotation.z = -running;
        parts.arm1.rotation.z = -running * (fleeing ? 1.1 : 0.65);
        parts['arm-1'].rotation.z = running * (fleeing ? 1.1 : 0.65);
        parts.forearm1.rotation.z = fleeing ? 1.2 : 0.35;
        parts['forearm-1'].rotation.z = fleeing ? 1.2 : 0.35;
        if (fleeing) {
          torso.rotation.z = -0.22;
          return;
        }
        if (athlete.kind === 'assistant' && match.stage === 'live' && match.phase === 'restart') {
          // Flag up for the restart.
          parts.arm1.rotation.z = 2.7;
          return;
        }
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
          } else if (athlete.kind === 'athlete' && !ownsBall && match.possessionTeam !== athlete.team) {
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
        const on = !match.abandoned && ['warmup', 'live', 'break', 'fulltime'].includes(match.stage);
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
        const liveAthletes = new Set();
        const liveMatches = new Set(Object.values(sportsMatches).filter(Boolean));
        for (const match of liveMatches) for (const athlete of match.people) liveAthletes.add(athlete);
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
      // END SUBSYSTEM: src/sports3d.js

