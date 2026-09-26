      // Sports 3D venue materials, net and ball materials, ground lines and scoreboards.
      const sportsVenueModels = new Map(),
        sportsBallModels = new Map(),
        sportsBoardSurfaces = new Map(),
        sportsScreens = [],
        stadiumStandModels = [];
      const sportsMaterials = {
        concrete: staticMat('#d0d0c4', 0.91),
        facade: staticMat('#283c50', 0.73, 0.2),
        canopy: staticMat('#a8b3c0', 0.49, 0.4),
        seat: staticMat('#407b99', 0.77),
        field: staticMat('#397b48', 0.94),
        fieldStripe: staticMat('#458955', 0.96),
        court: staticMat('#326a77', 0.93),
        courtKey: staticMat('#b5714b', 0.9),
        white: staticMat('#ececdb', 0.79),
        rim: staticMat('#ee7840', 0.48, 0.2),
        basketball: staticMat('#db8239', 0.88),
        soccer: staticMat('#f4eee0', 0.82),
        shoes: staticMat('#202630'),
        shorts: staticMat('#233a4b'),
        homeShirt: staticMat('#3caae1'),
        awayShirt: staticMat('#e76854'),
        goalkeeperShirt: staticMat('#e9c34c'),
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
          boardText(context, home.name, 250, 362, 56, lightenForBoard(homeKit.primary), 900, 470);
          boardText(context, away.name, W - 250, 362, 56, lightenForBoard(awayKit.primary), 900, 470);
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
