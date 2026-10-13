      // The 4x4 club's flag (waving) and lot statics, and the hill climb's gates: start, checkpoints, summit finish.
      // ---- The club's flag pole (the flag itself below) ----------------------------------------------
      const trailClubGroup = new Three.Group();
      trailClubGroup.name = '4x4 club';
      scene.add(trailClubGroup);
      batchGroups.push(trailClubGroup);
      const trailClubLive = new Three.Group();
      trailClubLive.name = '4x4 club (animated)';
      scene.add(trailClubLive);
      const clubStone = staticMat('#77756d', 0.95);
      function canvasMap(width, height, paint) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        paint(canvas.getContext('2d'), width, height);
        const tx = new Three.CanvasTexture(canvas);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      // The club block itself (clubhouse, workshop, yard, lot, gate and its carved
      // sign) is built with the mountain village kit: mountain-club3d.js.
      statics.push({ x: OFFROAD_CLUB.lot.x + OFFROAD_CLUB.lot.w / 2, y: OFFROAD_CLUB.lot.y + OFFROAD_CLUB.lot.h / 2, group: trailClubGroup, radius: 420 });
      // ---- The flag: club colours on a pole, flying ----------------------------------------------
      const flagPoint = OFFROAD_CLUB.flag,
        flagGeometry = new Three.PlaneGeometry(14, 9, 12, 4);
      flagGeometry.translate(7, 0, 0);
      const flagBase = Float32Array.from(flagGeometry.attributes.position.array),
        clubFlag = new Three.Mesh(
          flagGeometry,
          new Three.MeshStandardMaterial({
            map: canvasMap(256, 160, (g) => {
              g.fillStyle = '#2f5d3a';
              g.fillRect(0, 0, 256, 160);
              g.fillStyle = '#d9a441';
              g.fillRect(0, 118, 256, 14);
              g.fillStyle = '#f2e8cf';
              g.beginPath();
              g.moveTo(40, 110);
              g.lineTo(96, 34);
              g.lineTo(122, 70);
              g.lineTo(150, 28);
              g.lineTo(214, 110);
              g.fill();
              g.fillStyle = '#2f5d3a';
              g.font = `bold 34px ${POLICE_FONT}`;
              g.textAlign = 'center';
              g.fillText('4X4', 128, 100);
            }),
            side: Three.DoubleSide,
            roughness: 0.85,
          }),
        );
      clubFlag.position.set(flagPoint.x + 0.4, 50, flagPoint.y);
      clubFlag.castShadow = true;
      trailClubLive.add(clubFlag);
      box(trailClubGroup, flagPoint.x, 28, flagPoint.y, 0.7, 56, 0.7, staticMat('#d8dadc', 0.3, 0.7));
      mesh(sphereGeo, staticMat('#d9a441', 0.3, 0.8), trailClubGroup, flagPoint.x, 56.4, flagPoint.y, 0.8, 0.8, 0.8);
      function waveFlag() {
        const pos = flagGeometry.attributes.position,
          wind = weather.wind || 0.4,
          t = gameTime * (4 + wind * 4),
          angle = weather.windAngle || 0;
        for (let i = 0; i < pos.count; i++) {
          const x = flagBase[i * 3],
            y = flagBase[i * 3 + 1],
            f = x / 14;
          pos.setXYZ(i, x * (0.96 + 0.04 * Math.cos(t)), y - f * f * (1.6 - wind), Math.sin(x * 0.55 - t + y * 0.08) * f * (1.2 + wind * 1.4));
        }
        pos.needsUpdate = true;
        flagGeometry.computeVertexNormals();
        clubFlag.rotation.y = -angle;
      }
      // ---- Trail furniture: start gate, checkpoints, rock steps, finish ------------------------------
      const trailGroup = new Three.Group();
      trailGroup.name = 'hill climb course';
      scene.add(trailGroup);
      batchGroups.push(trailGroup);
      const bannerMaterial = (text, colors = ['#1d1f22', '#f6ead0', '#e2721f']) =>
        new Three.MeshStandardMaterial({
          map: canvasMap(512, 96, (g, W, H) => {
            g.fillStyle = colors[0];
            g.fillRect(0, 0, W, H);
            // Chequered ends.
            for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) {
              g.fillStyle = colors[1];
              g.fillRect(i * 16, j * 32, 16, 32);
              g.fillRect(W - 96 + i * 16, j * 32, 16, 32);
            }
            g.fillStyle = colors[1];
            g.font = `bold 54px ${POLICE_FONT}`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(text, W / 2, H / 2 + 3);
            g.fillStyle = colors[2];
            g.fillRect(96, H - 8, W - 192, 5);
          }),
          side: Three.DoubleSide,
          roughness: 0.8,
        });
      function gateAt(trail, point, text, width, height) {
        const path = trail.path,
          i = point.i,
          next = path[Math.min(path.length - 1, i + 1)],
          prev = path[Math.max(0, i - 1)],
          dx = next[0] - prev[0],
          dy = next[1] - prev[1],
          len = Math.hypot(dx, dy) || 1,
          px = -dy / len,
          py = dx / len,
          half = trail.width / 2 + 5,
          ground = terrainHeight(point.x, point.y);
        for (const side of [-1, 1]) {
          const x = point.x + px * half * side,
            y = point.y + py * half * side,
            h = terrainHeight(x, y);
          box(trailGroup, x, h + height / 2 - 2, y, 1.1, height + 4, 1.1, staticMat('#e8e6df', 0.5));
          box(trailGroup, x, h + 1.2, y, 2.4, 2.4, 2.4, staticMat('#e2721f', 0.7));
        }
        if (text) {
          const banner = new Three.Mesh(new Three.PlaneGeometry(half * 2, width), bannerMaterial(text));
          banner.position.set(point.x, ground + height - 1, point.y);
          banner.rotation.y = -Math.atan2(py, px);
          trailGroup.add(banner);
        } else {
          for (const side of [-1, 1]) {
            const x = point.x + px * half * side,
              y = point.y + py * half * side,
              h = terrainHeight(x, y),
              f = new Three.Mesh(new Three.PlaneGeometry(6, 4), bannerMaterial('', ['#f6ead0', '#1d1f22', '#1d1f22']));
            f.position.set(x + px * 3 * side, h + height - 1, y + py * 3 * side);
            f.rotation.y = -Math.atan2(py, px);
            trailGroup.add(f);
          }
        }
      }
      MOUNTAIN_TRAILS.forEach((trail, t) => {
        const course = trailCourse(t);
        gateAt(trail, course.start, 'HILL CLIMB · START', 5, 26);
        course.checkpoints.forEach((cp) => gateAt(trail, cp, null, 0, 16));
        // (The rock sections' rock, the markers, cairns and logs: offroad3d-trail.js.)
        const top = trail.path.at(-1),
          prevTop = trail.path.at(-6);
        gateAt(trail, { x: prevTop[0], y: prevTop[1], i: trail.path.length - 6 }, 'SUMMIT · FINISH', 5, 24);
        statics.push({ x: (course.start.x + top[0]) / 2, y: (course.start.y + top[1]) / 2, group: trailGroup, radius: 1400 });
      });
      // SIGN_DESIGNS gets the club's own board (signdesigns3d.js).
