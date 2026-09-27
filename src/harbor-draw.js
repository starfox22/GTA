    // Harbor drawing: ground paint, buildHarbor, the 2D view, map and 3D labels, and the 2D traffic lights.
    function paintHarborGround(drawingContext) {
      drawingContext.save();
      drawingContext.fillStyle = '#778184';
      drawingContext.fillRect(HARBOR.x, HARBOR.y, HARBOR.w, HARBOR.h);
      drawingContext.strokeStyle = '#5e686d';
      drawingContext.lineWidth = 1;
      for (let x = HARBOR.x; x < 3415; x += 50) {
        drawingContext.beginPath();
        drawingContext.moveTo(x, HARBOR.y);
        drawingContext.lineTo(x, 1780);
        drawingContext.stroke();
      }
      for (let y = HARBOR.y; y < 1780; y += 50) {
        drawingContext.beginPath();
        drawingContext.moveTo(HARBOR.x, y);
        drawingContext.lineTo(3415, y);
        drawingContext.stroke();
      }
      for (let i = 0; i < 120; i++) {
        const x = 2790 + ((i * 173) % 605),
          y = 1240 + ((i * 107) % 520);
        drawingContext.fillStyle = i % 3 ? '#92979316' : '#25313712';
        drawingContext.fillRect(x, y, 8 + (i % 9) * 3, 2 + (i % 5) * 2);
      }
      drawingContext.strokeStyle = '#29363b30';
      drawingContext.lineWidth = 0.8;
      for (let i = 0; i < 14; i++) {
        const x = 2800 + ((i * 131) % 590),
          y = 1240 + ((i * 89) % 520);
        drawingContext.beginPath();
        drawingContext.moveTo(x, y);
        drawingContext.lineTo(x + 12, y + 5);
        drawingContext.lineTo(x + 18, y + 3);
        drawingContext.lineTo(x + 26, y + 10);
        drawingContext.stroke();
      }
      drawingContext.fillStyle = '#4d585f';
      drawingContext.fillRect(2780, 1608, 555, 112);
      drawingContext.fillRect(3160, 1350, 105, 375);
      drawingContext.strokeStyle = '#d6b76c';
      drawingContext.lineWidth = 3;
      drawingContext.setLineDash([12, 8]);
      drawingContext.strokeRect(HARBOR.bay.x - 48, HARBOR.bay.y - 62, 96, 124);
      drawingContext.setLineDash([]);
      drawingContext.fillStyle = '#d3b55f';
      for (let y = 1240; y < 1770; y += 22) drawingContext.fillRect(3394, y, 16, 9);
      drawingContext.font = 'bold 14px monospace';
      drawingContext.textAlign = 'center';
      drawingContext.fillText('CARGO 03', 3210, 1440);
      drawingContext.fillText('IRONWORKS TERMINAL', 3000, 1655);
      drawingContext.restore();
    }
    function buildHarbor() {
      paintHarborGround(groundContext);
      for (const b of HARBOR.warehouses) {
        makeBuilding(b.x, b.y, b.w, b.h, 2, true);
        Object.assign(buildings[buildings.length - 1], {
          height: b.height,
          harbor: true,
        });
      }
      for (let i = trees.length - 1; i >= 0; i--)
        if (inHarbor(trees[i].x, trees[i].y, 15)) trees.splice(i, 1);
      for (let i = lamps.length - 1; i >= 0; i--)
        if (inHarbor(lamps[i].x, lamps[i].y, 15)) lamps.splice(i, 1);
    }
    function drawHarbor2D() {
      const s = HARBOR.ship;
      if (
        visible(
          {
            x: s.x,
            y: s.y,
          },
          450,
        )
      ) {
        worldContext.save();
        worldContext.translate(s.x, s.y);
        worldContext.fillStyle = '#151f26';
        worldContext.beginPath();
        worldContext.moveTo(-s.w / 2, s.l / 2);
        worldContext.lineTo(-s.w / 2, -s.l * 0.35);
        worldContext.quadraticCurveTo(-s.w * 0.45, -s.l * 0.46, 0, -s.l / 2);
        worldContext.quadraticCurveTo(s.w * 0.45, -s.l * 0.46, s.w / 2, -s.l * 0.35);
        worldContext.lineTo(s.w / 2, s.l / 2);
        worldContext.closePath();
        worldContext.fill();
        worldContext.fillStyle = '#a07758';
        worldContext.fillRect(-s.w * 0.4, -s.l * 0.32, s.w * 0.8, s.l * 0.69);
        for (let y = -105; y < 60; y += 42)
          for (let x = -42; x < 35; x += 32) {
            worldContext.fillStyle = y % 3 ? '#506f79' : '#a36f42';
            worldContext.fillRect(x, y, 27, 35);
            worldContext.strokeStyle = '#182c32';
            worldContext.strokeRect(x, y, 27, 35);
          }
        worldContext.fillStyle = '#d8d7c9';
        worldContext.fillRect(-51, 94, 102, 57);
        worldContext.fillStyle = '#3c6d80';
        worldContext.fillRect(-46, 99, 92, 12);
        worldContext.fillStyle = '#263a43';
        worldContext.fillRect(-15, 125, 30, 25);
        worldContext.restore();
      }
      if (!visible(HARBOR.bay, 650)) return;
      worldContext.fillStyle = '#354447';
      for (const b of harborWalls) worldContext.fillRect(b.x, b.y, b.w, b.h);
      worldContext.strokeStyle = harborGate > 0.82 ? '#8dbd87' : '#e4ba58';
      worldContext.lineWidth = 4;
      worldContext.beginPath();
      worldContext.moveTo(HARBOR.gate.x, HARBOR.gate.y - 68);
      worldContext.lineTo(HARBOR.gate.x, HARBOR.gate.y - 68 + 136 * (1 - harborGate));
      worldContext.stroke();
      for (const c of HARBOR.containers) {
        worldContext.fillStyle = '#547887';
        worldContext.fillRect(c.x, c.y, c.w, c.h);
        worldContext.strokeStyle = '#344f5c';
        worldContext.lineWidth = 2;
        for (let x = c.x + 4; x < c.x + c.w; x += 6) {
          worldContext.beginPath();
          worldContext.moveTo(x, c.y);
          worldContext.lineTo(x, c.y + c.h);
          worldContext.stroke();
        }
      }
      for (const y of [1320, 1675]) {
        const x = 3360,
          reach = 125 + Math.sin(gameTime * 0.23 + y) * 24;
        worldContext.strokeStyle = '#e3b95e';
        worldContext.lineWidth = 9;
        worldContext.beginPath();
        worldContext.moveTo(x - 42, y);
        worldContext.lineTo(x + reach, y);
        worldContext.stroke();
        worldContext.fillStyle = '#c99943';
        worldContext.fillRect(x - 20, y - 23, 40, 46);
        worldContext.strokeStyle = '#252e32';
        worldContext.lineWidth = 2;
        worldContext.beginPath();
        worldContext.moveTo(x + reach, y);
        worldContext.lineTo(x + reach, y + 25);
        worldContext.stroke();
        worldContext.fillStyle = '#6d8590';
        worldContext.fillRect(x + reach - 12, y + 19, 24, 21);
      }
      const m = harborCargoJob();
      for (let i = 0; i < 3; i++) {
        if (m?.packages?.[i]?.got || (!m && missionIndex > 0)) continue;
        const p = HARBOR.crates[i];
        worldContext.fillStyle = '#402e20';
        worldContext.fillRect(p.x - 17, p.y - 15, 36, 34);
        worldContext.fillStyle = '#be8e4c';
        worldContext.fillRect(p.x - 16, p.y - 16, 32, 30);
        worldContext.strokeStyle = '#5c4229';
        worldContext.lineWidth = 2;
        for (let z = -10; z < 14; z += 6) {
          worldContext.beginPath();
          worldContext.moveTo(p.x - 14, p.y + z);
          worldContext.lineTo(p.x + 14, p.y + z);
          worldContext.stroke();
        }
        worldContext.fillStyle = '#efce74';
        worldContext.fillRect(p.x - 10, p.y - 16, 4, 30);
        worldContext.fillRect(p.x + 6, p.y - 16, 4, 30);
        marker(p, '#ffdc86', String(i + 1), 15);
      }
      if (m?.stage === 2) {
        worldContext.strokeStyle = '#f2d68d';
        worldContext.lineWidth = 3;
        worldContext.strokeRect(HARBOR.bay.x - 48, HARBOR.bay.y - 62, 96, 124);
      }
    }
    function drawHarborMap(drawingContext, big) {
      drawingContext.fillStyle = '#ad996b55';
      drawingContext.fillRect(HARBOR.x, HARBOR.y, HARBOR.w, HARBOR.h);
      drawingContext.strokeStyle = '#b69965';
      drawingContext.lineWidth = big ? 8 : 5;
      drawingContext.strokeRect(HARBOR.x, HARBOR.y, HARBOR.w, HARBOR.h);
      drawingContext.fillStyle = '#b7bab1';
      drawingContext.fillRect(HARBOR.ship.x - 64, HARBOR.ship.y - 187, 128, 374);
      const m = harborCargoJob();
      for (let i = 0; i < 3; i++) {
        if (m?.packages?.[i]?.got || (!m && missionIndex > 0)) continue;
        const p = HARBOR.crates[i];
        drawingContext.fillStyle = '#f4cf72';
        drawingContext.fillRect(p.x - 18, p.y - 18, 36, 36);
        drawingContext.strokeStyle = '#302b21';
        drawingContext.lineWidth = 4;
        drawingContext.strokeRect(p.x - 18, p.y - 18, 36, 36);
      }
      if (big) {
        drawingContext.font = 'bold 69px monospace';
        drawingContext.fillStyle = '#f7e3b4';
        drawingContext.textAlign = 'center';
        drawingContext.fillText('HARBOR', 3080, 1200);
      }
    }
    function drawHarborLabels3D(api) {
      const m = harborCargoJob();
      if (!m || distanceBetween(player, HARBOR.bay) > 1100) return;
      for (let i = 0; i < 3; i++) {
        if (m.packages[i].got) continue;
        const c = HARBOR.crates[i],
          q = api.project(c.x, c.y, 58);
        if (q.x < 24 || q.x > viewportWidth - 24 || q.y < 100 || q.y > viewportHeight - 150) continue;
        worldContext.fillStyle = '#17222bea';
        worldContext.fillRect(q.x - 34, q.y - 15, 68, 24);
        worldContext.strokeStyle = '#efd38b';
        worldContext.lineWidth = 1;
        worldContext.strokeRect(q.x - 34, q.y - 15, 68, 24);
        worldContext.fillStyle = '#ffe5a1';
        worldContext.font = 'bold 11px Arial';
        worldContext.textAlign = 'center';
        worldContext.fillText('CRATE ' + (i + 1), q.x, q.y + 1);
        worldContext.beginPath();
        worldContext.moveTo(q.x - 4, q.y + 12);
        worldContext.lineTo(q.x + 4, q.y + 12);
        worldContext.lineTo(q.x, q.y + 19);
        worldContext.fill();
      }
    }
    function drawTrafficLights2D() {
      for (const x of ROAD_CENTERS)
        for (const y of ROAD_ROWS) {
          if (
            !visible(
              {
                x,
                y,
              },
              100,
            ) ||
            !cityIntersectionAt(x, y) ||
            !groundAt(x, y, 92) ||
            inHarbor(x, y, 100)
          )
            continue;
          const state = trafficSignal(x, y);
          for (const [axis, dx, dy] of [
            ['vertical', 61, -65],
            ['horizontal', -65, 61],
          ]) {
            worldContext.fillStyle = '#263338';
            worldContext.fillRect(x + dx - 4, y + dy - 9, 8, 18);
            for (let i = 0; i < 3; i++) {
              worldContext.fillStyle =
                i ===
                {
                  red: 0,
                  amber: 1,
                  green: 2,
                }[state[axis]]
                  ? ['#ef6650', '#edc766', '#8ac99a'][i]
                  : '#475355';
              worldContext.beginPath();
              worldContext.arc(x + dx, y + dy - 5 + i * 5, 1.8, 0, TAU);
              worldContext.fill();
            }
          }
        }
    }
