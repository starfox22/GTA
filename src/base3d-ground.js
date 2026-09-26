      // Fort Sentinel ground sheet: the base plot rectangle G and its painted ground.
      const G = { x: 9040, y: 7730, w: 1560, h: 2240 },
        groundSheet = document.createElement('canvas');
      groundSheet.width = G.w;
      groundSheet.height = G.h;
      (function paintBaseGround() {
        const g = groundSheet.getContext('2d');
        g.translate(-G.x, -G.y);
        let seed = 4242;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const X0 = MILITARY.x,
          Y0 = MILITARY.y,
          X1 = MILITARY.x + MILITARY.w,
          Y1 = MILITARY.y + MILITARY.h,
          gate = SENTINEL.gate;
        const speckle = (x, y, w, h, colors, n, size = 3) => {
          for (let i = 0; i < n; i++) {
            g.fillStyle = colors[i % colors.length];
            g.fillRect(x + rnd() * w, y + rnd() * h, 1 + rnd() * size, 1 + rnd() * size);
          }
        };
        const slab = (a, fill, joint = 40, jointColor = '#00000022') => {
          g.fillStyle = fill;
          g.fillRect(a.x, a.y, a.w, a.h);
          speckle(a.x, a.y, a.w, a.h, ['#ffffff10', '#00000012'], (a.w * a.h) / 90);
          g.strokeStyle = jointColor;
          g.lineWidth = 1;
          g.beginPath();
          for (let x = a.x + joint; x < a.x + a.w; x += joint) {
            g.moveTo(x, a.y);
            g.lineTo(x, a.y + a.h);
          }
          for (let y = a.y + joint; y < a.y + a.h; y += joint) {
            g.moveTo(a.x, y);
            g.lineTo(a.x + a.w, y);
          }
          g.stroke();
        };
        const asphalt = '#4b5153';
        const road = (points, width, { centre = '#d8b64a', dash = true, edges = true } = {}) => {
          g.strokeStyle = asphalt;
          g.lineWidth = width;
          g.lineCap = 'butt';
          g.beginPath();
          g.moveTo(points[0][0], points[0][1]);
          for (const p of points.slice(1)) g.lineTo(p[0], p[1]);
          g.stroke();
          if (centre) {
            g.strokeStyle = centre;
            g.lineWidth = 2;
            g.setLineDash(dash ? [18, 14] : []);
            g.beginPath();
            g.moveTo(points[0][0], points[0][1]);
            for (const p of points.slice(1)) g.lineTo(p[0], p[1]);
            g.stroke();
            g.setLineDash([]);
          }
          if (edges && points.length === 2) {
            const [a, b] = points,
              len = Math.hypot(b[0] - a[0], b[1] - a[1]),
              nx = -(b[1] - a[1]) / len,
              ny = (b[0] - a[0]) / len;
            g.strokeStyle = '#d9d6c8';
            g.lineWidth = 1.5;
            for (const side of [-1, 1]) {
              const o = side * (width / 2 - 4);
              g.beginPath();
              g.moveTo(a[0] + nx * o, a[1] + ny * o);
              g.lineTo(b[0] + nx * o, b[1] + ny * o);
              g.stroke();
            }
          }
        };
        const text = (t, x, y, size, color = '#e2dfcf', rotation = 0) => {
          g.save();
          g.translate(x, y);
          g.rotate(rotation);
          g.fillStyle = color;
          g.font = `bold ${size}px Arial`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(t, 0, 0);
          g.restore();
        };
        // Grass inside the fence, with mowing stripes and mottling.
        g.fillStyle = '#687452';
        g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
        for (let y = Y0; y < Y1; y += 24) {
          g.fillStyle = (y / 24) % 2 ? '#ffffff08' : '#0000000a';
          g.fillRect(X0, y, X1 - X0, 12);
        }
        speckle(X0, Y0, X1 - X0, Y1 - Y0, ['#7d8a5f55', '#4f5c3e55', '#8f8a5c44', '#3f4a3355'], 26000, 4);
        // Gravel clear zone along the double fence.
        g.fillStyle = '#9a958a';
        g.fillRect(X0 - 10, Y0 - 10, X1 - X0 + 20, 58);
        g.fillRect(X0 - 10, Y1 - 48, X1 - X0 + 20, 58);
        g.fillRect(X0 - 10, Y0 - 10, 58, Y1 - Y0 + 20);
        g.fillRect(X1 - 48, Y0 - 10, 58, Y1 - Y0 + 20);
        speckle(X0 - 10, Y0 - 10, X1 - X0 + 20, 58, ['#6f6b62', '#c2bdb0'], 4000, 2);
        speckle(X0 - 10, Y1 - 48, X1 - X0 + 20, 58, ['#6f6b62', '#c2bdb0'], 4000, 2);
        speckle(X0 - 10, Y0, 58, Y1 - Y0, ['#6f6b62', '#c2bdb0'], 7000, 2);
        speckle(X1 - 48, Y0, 58, Y1 - Y0, ['#6f6b62', '#c2bdb0'], 7000, 2);
        // Gate approach: the causeway road, the checkpoint lanes and the island.
        g.fillStyle = asphalt;
        g.fillRect(G.x, gate.opening[0] - 12, X0 + 60 - G.x, gate.opening[1] - gate.opening[0] + 24);
        g.fillStyle = '#9a958a';
        g.fillRect(G.x, gate.opening[0] - 45, X0 - G.x, 33);
        g.fillRect(G.x, gate.opening[1] + 12, X0 - G.x, 33);
        speckle(G.x, gate.opening[0] - 45, X0 - G.x, 33, ['#6f6b62', '#c2bdb0'], 1200, 2);
        speckle(G.x, gate.opening[1] + 12, X0 - G.x, 33, ['#6f6b62', '#c2bdb0'], 1200, 2);
        g.fillStyle = '#d9d6c8';
        for (const lane of gate.lanes) {
          g.fillRect(G.x, lane.y0 + 3, X0 - G.x, 1.5);
          g.fillRect(G.x, lane.y1 - 4.5, X0 - G.x, 1.5);
        }
        // Stop lines, STOP stencils and rumble strips before the booth.
        for (const lane of gate.lanes) {
          const inbound = !lane.out,
            cy = (lane.y0 + lane.y1) / 2;
          g.fillStyle = '#ece8da';
          g.fillRect(inbound ? gate.checkpoint - 34 : 9330, lane.y0 + 4, 5, lane.y1 - lane.y0 - 8);
          text('STOP', inbound ? gate.checkpoint - 58 : 9352, cy, 20, '#ece8da', inbound ? -Math.PI / 2 : Math.PI / 2);
          text('SLOW', inbound ? 9110 : 9420, cy, 18, '#ece8da', inbound ? -Math.PI / 2 : Math.PI / 2);
          for (let k = 0; k < 4; k++) {
            g.fillStyle = k % 2 ? '#1e2021' : '#d8b23a';
            for (let s = 0; s < 6; s++) g.fillRect(inbound ? 9146 + k * 4 : 9360 + k * 4, lane.y0 + 4 + s * 12, 4, 6);
          }
        }
        // Yellow hatching round the island nose.
        g.strokeStyle = '#d8b23a';
        g.lineWidth = 3;
        for (let k = 0; k < 6; k++) {
          g.beginPath();
          g.moveTo(gate.island.x - 70 + k * 12, 8138);
          g.lineTo(gate.island.x - 60 + k * 12, 8162);
          g.stroke();
        }
        // Base roads.
        const pr = SENTINEL.perimeterRoad;
        road(
          [
            [pr.x0, pr.y0],
            [pr.x1, pr.y0],
            [pr.x1, pr.y1],
            [pr.x0, pr.y1],
            [pr.x0, pr.y0],
          ],
          pr.width,
          { edges: false },
        );
        for (const r of SENTINEL.roads) road(r.points, r.width, r.name === 'SENTINEL AVENUE' ? { dash: false } : {});
        // Avenue: double yellow centre and crossings.
        g.fillStyle = '#d8b64a';
        g.fillRect(9330, 8146, 1110, 2);
        g.fillRect(9330, 8152, 1110, 2);
        for (const x of [9740, 10000])
          for (let y = 8104; y < 8196; y += 10) {
            g.fillStyle = '#e6e2d4';
            g.fillRect(x - 12, y, 24, 5);
          }
        // Paved areas.
        slab(SENTINEL.hqLot, '#55595a', 1000);
        g.strokeStyle = '#e1ddcf';
        g.lineWidth = 1.5;
        for (let y = SENTINEL.hqLot.y + 12; y < SENTINEL.hqLot.y + SENTINEL.hqLot.h - 10; y += 38) {
          g.beginPath();
          g.moveTo(SENTINEL.hqLot.x + 6, y);
          g.lineTo(SENTINEL.hqLot.x + 60, y);
          g.stroke();
        }
        slab(SENTINEL.motorPool, '#8f8d84', 40);
        g.strokeStyle = '#d8b23a';
        g.lineWidth = 2;
        for (const row of [8950, 9080])
          for (let x = 9446; x < 9950; x += 45) {
            g.beginPath();
            g.moveTo(x, row - 46);
            g.lineTo(x, row + 46);
            g.stroke();
          }
        for (let i = 0; i < 26; i++) {
          g.fillStyle = '#2a2a2a22';
          g.beginPath();
          g.ellipse(9460 + rnd() * 480, 8900 + rnd() * 310, 6 + rnd() * 10, 4 + rnd() * 6, rnd() * 3, 0, TAU);
          g.fill();
        }
        text('MOTOR POOL', 9700, 9205, 18, '#d8b23a');
        // Parade ground: asphalt, marching grid, the crest.
        const pa = SENTINEL.parade;
        g.fillStyle = '#595d5c';
        g.fillRect(pa.x, pa.y, pa.w, pa.h);
        speckle(pa.x, pa.y, pa.w, pa.h, ['#ffffff0c', '#0000000f'], 5000);
        g.strokeStyle = '#e4e0d0';
        g.lineWidth = 3;
        g.strokeRect(pa.x + 8, pa.y + 8, pa.w - 16, pa.h - 16);
        g.lineWidth = 1;
        g.strokeStyle = '#e4e0d055';
        for (let x = pa.x + 30; x < pa.x + pa.w - 20; x += 30) {
          g.beginPath();
          g.moveTo(x, pa.y + 12);
          g.lineTo(x, pa.y + pa.h - 12);
          g.stroke();
        }
        const cx = pa.x + pa.w / 2,
          cy = pa.y + pa.h / 2;
        g.strokeStyle = '#d9c68a';
        g.lineWidth = 5;
        g.beginPath();
        g.arc(cx, cy, 58, 0, TAU);
        g.stroke();
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cx, cy, 48, 0, TAU);
        g.stroke();
        g.fillStyle = '#d9c68a';
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 14 : 36,
            a = -Math.PI / 2 + (i * Math.PI) / 5;
          g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        g.fill();
        text('FORT SENTINEL', cx, cy + 80, 20, '#d9c68a');
        // Footpaths between the buildings.
        g.fillStyle = '#aaa596';
        for (const [x, y, w, h] of [
          [9960, 8200, 30, 480],
          [10030, 8325, 380, 60],
          [10030, 8475, 380, 60],
          [9560, 8575, 400, 26],
          [9690, 8036, 100, 64],
          [9550, 7890, 16, 150],
          [10010, 8625, 220, 24],
          [9440, 8240, 110, 16],
        ])
          g.fillRect(x, y, w, h);
        // Building pads.
        for (const b of SENTINEL.buildings) {
          g.fillStyle = '#7f7d74';
          g.fillRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
        }
        // Obstacle course sand, range dirt, fuel gravel, bunker aprons.
        const oc = SENTINEL.obstacleCourse;
        g.fillStyle = '#ad9a73';
        g.fillRect(oc.x, oc.y, oc.w, oc.h);
        speckle(oc.x, oc.y, oc.w, oc.h, ['#8e7c58', '#c8b58c'], 3000, 2);
        const rg = SENTINEL.range;
        g.fillStyle = '#86775a';
        g.fillRect(rg.x, rg.y, rg.w, rg.h);
        speckle(rg.x, rg.y, rg.w, rg.h, ['#6f6148', '#a08e6c'], 3000, 2);
        g.strokeStyle = '#d9d6c8aa';
        g.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
          g.beginPath();
          g.moveTo(rg.x + 40, rg.y + i * 20);
          g.lineTo(rg.targetsX, rg.y + i * 20);
          g.stroke();
        }
        for (let x = rg.x + 90; x < rg.targetsX; x += 60) text(String(Math.round(worldMeters(x - rg.x - 40) / 25) * 25), x, rg.y - 7, 9, '#e2dfcf');
        const fb = SENTINEL.fuel.bund;
        slab({ x: fb.x - 6, y: fb.y - 6, w: fb.w + 12, h: fb.h + 12 }, '#8a877d', 1000);
        g.fillStyle = '#958e7c';
        g.fillRect(fb.x, fb.y, fb.w, fb.h);
        speckle(fb.x, fb.y, fb.w, fb.h, ['#6f6b62', '#c2bdb0'], 5000, 2);
        slab({ x: 10040, y: 8990, w: 260, h: 70 }, '#86847b', 30);
        for (const b of SENTINEL.bunkers) {
          g.fillStyle = '#9a958a';
          g.fillRect(b.x - 24, b.y + 8, 26, b.h - 16);
        }
        // Comms compound pad and the radome yard.
        slab({ x: 10010, y: 7905, w: 440, h: 160 }, '#8b897f', 40);
        // Airfield: apron, taxiway, runway and helipads.
        slab(SENTINEL.apron, '#9a978c', 45);
        slab(SENTINEL.taxiway, '#9a978c', 45);
        for (const h of [
          { x: 9440, y: 9430, w: 220, h: 18 },
          { x: 9700, y: 9430, w: 220, h: 18 },
        ])
          slab(h, '#9a978c', 45);
        g.strokeStyle = '#e0bd3c';
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(9990, 9750);
        g.lineTo(9990, 9560);
        g.lineTo(9550, 9560);
        g.moveTo(9990, 9560);
        g.lineTo(10420, 9560);
        g.moveTo(9550, 9560);
        g.lineTo(9550, 9432);
        g.moveTo(9810, 9560);
        g.lineTo(9810, 9432);
        g.stroke();
        for (const x of [9550, 9810]) {
          g.strokeStyle = '#e0bd3c';
          g.strokeRect(x - 48, 9500, 96, 44);
          text(x === 9550 ? 'H1' : 'H2', x, 9588, 14, '#e0bd3c');
        }
        const rw = SENTINEL.runway;
        g.fillStyle = '#3c4244';
        g.fillRect(rw.x, rw.y, rw.w, rw.h);
        speckle(rw.x, rw.y, rw.w, rw.h, ['#ffffff09', '#00000014'], 9000);
        for (const x of [rw.x + 60, rw.x + rw.w - 110])
          for (let k = 0; k < 6; k++) {
            g.fillStyle = '#1f2224';
            g.globalAlpha = 0.35;
            g.fillRect(x + rnd() * 50, rw.y + 20 + k * 9, 30 + rnd() * 30, 3);
            g.globalAlpha = 1;
          }
        g.fillStyle = '#e8e5d6';
        g.fillRect(rw.x, rw.y + 3, rw.w, 2);
        g.fillRect(rw.x, rw.y + rw.h - 5, rw.w, 2);
        for (let x = rw.x + 120; x < rw.x + rw.w - 120; x += 60) g.fillRect(x, rw.y + rw.h / 2 - 1.5, 32, 3);
        for (const end of [0, 1]) {
          const x = end ? rw.x + rw.w - 36 : rw.x + 6;
          for (let k = 0; k < 8; k++) if (k !== 3 && k !== 4) g.fillRect(x, rw.y + 8 + k * 10, 30, 5);
          text(end ? '27' : '09', end ? rw.x + rw.w - 60 : rw.x + 60, rw.y + rw.h / 2, 30, '#e8e5d6', end ? Math.PI / 2 : -Math.PI / 2);
          for (const dy of [-26, 26]) g.fillRect(end ? rw.x + rw.w - 160 : rw.x + 120, rw.y + rw.h / 2 + dy - 3, 40, 6);
        }
        for (const p of SENTINEL.helipads) {
          slab({ x: p.x - 58, y: p.y - 58, w: 116, h: 116 }, '#8e8b80', 1000);
          g.strokeStyle = '#e6e2d2';
          g.lineWidth = 4;
          g.beginPath();
          g.arc(p.x, p.y, p.r - 4, 0, TAU);
          g.stroke();
          text('H', p.x, p.y + 2, 54, '#e6e2d2');
        }
        // Lawn in front of HQ with a gravel crest.
        g.fillStyle = '#6f7d54';
        g.fillRect(9570, 8040, 340, 58);
        for (let x = 9570; x < 9910; x += 20) {
          g.fillStyle = (x / 20) % 2 ? '#ffffff0a' : '#0000000c';
          g.fillRect(x, 8040, 10, 58);
        }
        // Outside the fence: tidy the verge the sheet covers (one path: each
        // destination-in fill clears everything outside itself).
        g.globalCompositeOperation = 'destination-in';
        g.fillStyle = '#000';
        g.beginPath();
        g.rect(X0 - 12, Y0 - 12, X1 - X0 + 24, Y1 - Y0 + 24);
        g.rect(G.x, gate.opening[0] - 45, X0 - G.x + 1, gate.opening[1] - gate.opening[0] + 90);
        g.fill();
        g.globalCompositeOperation = 'source-over';
      })();
      {
        const tx = new Three.CanvasTexture(groundSheet);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const groundMaterial = new Three.MeshStandardMaterial({ map: tx, roughness: 0.93, alphaTest: 0.5 }),
          ground = new Three.Mesh(new Three.PlaneGeometry(G.w, G.h), groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        // Above the causeway deck (0.4), which runs on into the gate.
        ground.position.set(G.x + G.w / 2, 0.46, G.y + G.h / 2);
        ground.receiveShadow = true;
        ground.name = 'Fort Sentinel ground';
        scene.add(ground);
        countyGroundMaterials.push(groundMaterial);
        statics.push({ x: G.x + G.w / 2, y: G.y + G.h / 2, group: ground, radius: 1400 });
      }
