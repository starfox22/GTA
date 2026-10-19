      // Airport architecture and apron dressing shared by Southport and Oceanview.
      // Existing building footprints and geography-regions.js structure plans stay
      // authoritative; ordinary static meshes join the cell batches and far LOD.
      const airportFinish = {
        panel: staticMat('#c4cfcc', 0.58, 0.35),
        edge: staticMat('#e1e3d9', 0.44, 0.45),
        frame: staticMat('#6b7e82', 0.38, 0.68),
        glass: staticMat('#335560', 0.2, 0.55),
        glassLight: staticMat('#496a73', 0.23, 0.5),
        stone: staticMat('#8c9690', 0.94),
        roof: staticMat('#78888b', 0.74, 0.4),
        vent: staticMat('#3b494d', 0.76, 0.32),
        dark: staticMat('#26383d', 0.82, 0.2),
        yellow: staticMat('#c5a443', 0.88),
        white: staticMat('#c6cbc0', 0.86),
        joint: staticMat('#777f79', 0.98),
      };
      const airportPlacards = new Map();
      function airportPlacard(parent, text, x, height, z, width, yaw = 0, yellow = false) {
        const key = text + '|' + yellow;
        let material = airportPlacards.get(key);
        if (!material) {
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 128;
          const g = canvas.getContext('2d');
          g.fillStyle = yellow ? '#d2b34f' : '#213e48';
          g.fillRect(0, 0, 512, 128);
          g.strokeStyle = yellow ? '#2c3434' : '#a9c1c0';
          g.lineWidth = 5;
          g.strokeRect(8, 8, 496, 112);
          g.fillStyle = yellow ? '#202c30' : '#d4e0d8';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.font = '600 66px Arial, sans-serif';
          g.fillText(text, 256, 68, 464);
          const texture = new Three.CanvasTexture(canvas);
          texture.colorSpace = Three.SRGBColorSpace;
          texture.anisotropy = 4;
          bakedCanvases.push(texture);
          material = new Three.MeshStandardMaterial({ map: texture, roughness: 0.72 });
          airportPlacards.set(key, material);
        }
        const aspect = Math.max(4, Math.min(16, text.length * 0.62)),
          face = new Three.Mesh(new Three.PlaneGeometry(width, width / aspect), material);
        face.position.set(x, height, z);
        face.rotation.y = yaw;
        face.receiveShadow = true;
        parent.add(face);
        return face;
      }
      // Broad opaque reflective bays survive in the merged distant silhouette;
      // small aluminium mullions become ordinary cell-batched near detail.
      function airportCurtainWall(group, x, z, width, bottom, top, heading = 0) {
        const wall = new Three.Group();
        wall.position.set(x, 0, z);
        wall.rotation.y = heading;
        group.add(wall);
        const span = Math.max(1, Math.round(width / 54)),
          bay = width / span;
        for (let i = 0; i < span; i++) {
          box(wall, -width / 2 + (i + 0.5) * bay, (bottom + top) / 2, 0,
            bay - 0.8, top - bottom, 0.7, i % 3 ? airportFinish.glass : airportFinish.glassLight);
        }
        for (let x0 = -width / 2; x0 <= width / 2 + 0.1; x0 += bay / 3)
          box(wall, x0, (bottom + top) / 2, 0.7, 0.65, top - bottom + 1, 1.1, airportFinish.frame);
        for (const y of [bottom, bottom + (top - bottom) * 0.48, top])
          box(wall, 0, y, 0.9, width + 1, 0.8, 1.2, airportFinish.frame);
      }
      function airportRoofPlant(group, b) {
        // The real collision roof includes 22 units of rooftop equipment.
        const h = b.height;
        for (const side of [-1, 1]) {
          const x = b.x + b.w * (side < 0 ? 0.25 : 0.75),
            z = b.y + b.h * 0.36;
          box(group, x, h + 4.3, z, 29, 8, 19, airportFinish.panel);
          box(group, x, h + 8.6, z, 31, 0.7, 21, airportFinish.edge);
          for (let k = -3; k <= 3; k++)
            box(group, x + k * 3.6, h + 4.5, z + 9.8, 1.3, 5.8, 0.7, airportFinish.vent);
          const fan = mesh(cylinderGeo, airportFinish.vent, group, x, h + 9.2, z, 6, 0.6, 6);
          fan.castShadow = false;
          box(group, x, h + 4.2, z + 22, 8, 6.5, 28, airportFinish.roof);
        }
      }
      function airportTerminal(group, footprint, title, regional = false) {
        const b = buildings.find((b) => b.x === footprint.x && b.y === footprint.y) || { ...footprint, height: 80 },
          cx = b.x + b.w / 2, front = b.y + b.h, h = b.height;
        for (const [x, z, width, turn] of [
          [cx, front + 1.8, b.w - 5, 0],
          [b.x - 1.8, b.y + b.h / 2, b.h - 5, -Math.PI / 2],
          [b.x + b.w + 1.8, b.y + b.h / 2, b.h - 5, Math.PI / 2],
        ]) airportCurtainWall(group, x, z, width, 8, h - 15, turn);
        box(group, cx, h - 7, front + 1.2, b.w + 2, 13, 2.3, airportFinish.panel);
        box(group, cx, 3.5, front + 1.5, b.w + 2, 7, 2.5, airportFinish.stone);
        box(group, cx, h + 1, b.y + b.h / 2, b.w + 8, 2, b.h + 6, airportFinish.edge);
        // Standing-seam roof, sheltered clerestories and a raised central spine
        // give the terminal a readable silhouette from an arriving aircraft.
        for (let x = b.x + 12; x < b.x + b.w - 8; x += 28)
          box(group, x, h + 2.3, b.y + b.h / 2, 0.7, 0.6, b.h - 6, airportFinish.roof);
        box(group, cx, h + 6, b.y + b.h * 0.62, b.w * 0.64, 8, 26, airportFinish.glass);
        box(group, cx, h + 10.6, b.y + b.h * 0.62, b.w * 0.64 + 4, 1.3, 30, airportFinish.edge);
        for (let x = cx - b.w * 0.3; x <= cx + b.w * 0.3; x += 28)
          box(group, x, h + 6, b.y + b.h * 0.62 + 13.5, 0.9, 8, 1, airportFinish.frame);
        airportPlacard(group, title, cx, h - 7, front + 2.7, Math.min(b.w - 20, regional ? 330 : 252));
        // Entrances are facade details; no new posts or barriers on the apron.
        for (const fraction of regional ? [0.24, 0.5, 0.76] : [0.5]) {
          const x = b.x + b.w * fraction;
          box(group, x, 13, front + 2.2, 23, 25, 0.8, airportFinish.dark);
          for (const side of [-1, 1]) {
            box(group, x + side * 5.4, 12.7, front + 2.8, 10, 24, 0.8, airportFinish.glassLight);
            box(group, x + side * 1.8, 12, front + 3.5, 0.55, 5, 0.6, airportFinish.edge);
          }
          box(group, x, 26.8, front + 2.5, 26, 1.2, 2, airportFinish.edge);
        }
        airportRoofPlant(group, b);
      }
      function airportHangar(group, footprint, label) {
        const b = buildings.find((b) => b.x === footprint.x && b.y === footprint.y) || { ...footprint, height: 80 },
          cx = b.x + b.w / 2, front = b.y + b.h, h = b.height;
        box(group, cx, h / 2, front + 1, b.w, h, 1.7, airportFinish.panel);
        const doorW = b.w * 0.78, doorH = h * 0.68;
        box(group, cx, doorH / 2 + 1, front + 2, doorW + 3, doorH + 2, 1.6, airportFinish.dark);
        const leaves = 8, leaf = doorW / leaves;
        for (let i = 0; i < leaves; i++) {
          const x = cx - doorW / 2 + (i + 0.5) * leaf;
          box(group, x, doorH / 2 + 1, front + 3, leaf - 0.7, doorH, 0.9, i % 2 ? airportFinish.roof : airportFinish.frame);
          box(group, x, doorH * 0.67, front + 3.6, leaf - 4, 8, 0.5, airportFinish.glass);
          for (let k = 1; k < 5; k++)
            box(group, x, k * doorH / 5, front + 3.6, leaf - 1, 0.6, 0.6, airportFinish.panel);
        }
        box(group, cx, h - 2, front + 3, b.w + 6, 5, 8, airportFinish.edge);
        box(group, cx, h + 1, b.y + b.h / 2, b.w + 6, 2, b.h + 6, airportFinish.roof);
        for (let x = b.x + 10; x < b.x + b.w; x += 20)
          box(group, x, h + 2.2, b.y + b.h / 2, 0.7, 0.5, b.h, airportFinish.edge);
        airportPlacard(group, label, cx, h - 10, front + 4.5, Math.min(110, b.w * 0.48));
        box(group, cx, 0.13, front + 8, doorW, 0.08, 1.5, airportFinish.yellow).castShadow = false;
      }
      function airportTower(group, t) {
        box(group, t.x, t.shaftH / 2, t.y, t.shaft, t.shaftH, t.shaft, airportFinish.stone);
        for (const side of [-1, 1]) {
          box(group, t.x + side * (t.shaft / 2 + 0.25), t.shaftH / 2, t.y, 0.5, t.shaftH, t.shaft * 0.42, airportFinish.frame);
          for (let y = 20; y < t.bottom - 8; y += 22)
            box(group, t.x, y, t.y + t.shaft / 2 + 0.4, 6, 9, 0.6, airportFinish.glass);
        }
        box(group, t.x, t.bottom + 2, t.y, t.cabW, 4, t.cabD, airportFinish.edge);
        box(group, t.x, (t.bottom + t.top) / 2, t.y, t.cabW - 3, t.top - t.bottom - 4, t.cabD - 3, airportFinish.glass);
        for (const side of [-1, 1]) {
          for (let x = -t.cabW / 2 + 2; x < t.cabW / 2; x += t.cabW / 5)
            box(group, t.x + x, (t.bottom + t.top) / 2, t.y + side * (t.cabD / 2 - 1), 0.8, t.top - t.bottom - 3, 0.9, airportFinish.frame);
          for (const x of [-t.cabW / 2 + 1, t.cabW / 2 - 1])
            box(group, t.x + x, (t.bottom + t.top) / 2, t.y + side * (t.cabD / 2 - 1), 1.3, t.top - t.bottom, 1.3, airportFinish.edge);
        }
        box(group, t.x, t.top - 1.3, t.y, t.cabW, 2.6, t.cabD, airportFinish.edge);
        box(group, t.x, (t.top + t.beacon) / 2, t.y, 1, t.beacon - t.top, 1, airportFinish.frame);
      }
      function airportEntranceCanopy(group, c) {
        box(group, c.x, (c.bottom + c.top) / 2, c.y, c.w, c.top - c.bottom, c.h, airportFinish.edge);
        for (let x = c.x - c.w / 2 + 8; x < c.x + c.w / 2 - 5; x += 24)
          box(group, x, c.bottom + 0.3, c.y, 1.2, 0.6, c.h - 2, airportFinish.frame);
        for (const [x, z] of c.posts) {
          box(group, x, c.bottom / 2, z, 3, c.bottom, 3, airportFinish.frame);
          box(group, x, 1.5, z, 3, 3, 3, airportFinish.yellow);
        }
      }
      function airportJetbridge(group, b) {
        const parts = airportOverheadVolumes().filter((v) => v.kind.startsWith('airport ') &&
          Math.abs(v.x - b.x) < 40 && v.y > b.from && v.y < b.dock.y + 12);
        for (const v of parts) {
          const part = new Three.Group();
          part.position.set(v.x, 0, v.y);
          part.rotation.y = -v.a;
          group.add(part);
          const w = v.hx * 2, d = v.hy * 2, floor = v.minHeight, roof = v.height;
          box(part, 0, floor + 1, 0, w, 2, d, airportFinish.frame);
          box(part, 0, roof - 1, 0, w, 2, d, airportFinish.edge);
          box(part, 0, (floor + roof) / 2, 0, w - 1, roof - floor - 4, d - 1, airportFinish.glass);
          for (const side of [-1, 1]) {
            // Long axis may be local Z (concourse) or local X (telescope).
            const alongZ = d >= w, length = Math.max(w, d), half = Math.min(w, d) / 2;
            for (let s = -length / 2 + 1; s < length / 2; s += 16)
              box(part, alongZ ? side * (half - 0.5) : s, (floor + roof) / 2,
                alongZ ? s : side * (half - 0.5), 0.8, roof - floor - 2, 0.8, airportFinish.edge);
          }
        }
        for (const p of airportBridgeSupports(b)) {
          box(group, p.x + p.w / 2, p.height / 2, p.y + p.h / 2, p.w, p.height, p.h, airportFinish.stone);
          box(group, p.x + p.w / 2, 1, p.y + p.h / 2, p.w, 2, p.h, airportFinish.yellow);
        }
        // Accordion docking seal remains wholly inside its collision cab.
        for (let x = -8; x <= 8; x += 2.3)
          box(group, b.dock.x + x, 33, b.dock.y + 9.4, 0.7, 23, 0.7, airportFinish.dark);
        airportPlacard(group, b.gate, b.x, 36, b.to - 18, 14, Math.PI / 2, true);
      }
      // Shallow concrete joints and markings cannot catch a taxiing wheel. They
      // are merged, never a giant new unculled mesh or a collision obstacle.
      function airportApron(group, rect, exclusions = []) {
        const step = 64;
        for (let x = rect.x; x < rect.x + rect.w - 0.1; x += step) {
          const w = Math.min(step, rect.x + rect.w - x);
          box(group, x + w / 2, 0.067, rect.y + rect.h / 2, 0.7, 0.018, rect.h, airportFinish.joint).castShadow = false;
        }
        for (let z = rect.y; z < rect.y + rect.h - 0.1; z += step)
          box(group, rect.x + rect.w / 2, 0.067, z, rect.w, 0.018, 0.7, airportFinish.joint).castShadow = false;
        for (const e of exclusions) {
          // Yellow hatched equipment exclusion zones are paint beside existing
          // building walls, not crates placed across the aircraft's route.
          for (let x = e.x + 8; x < e.x + e.w - 8; x += 13) {
            const stripe = box(group, x, 0.09, e.y + e.h / 2, 1.1, 0.04, e.h * 0.85, airportFinish.yellow);
            stripe.rotation.y = -0.45;
            stripe.castShadow = false;
          }
        }
      }
      function airportStandPaint(group, stand, index) {
        const southport = stand.id.startsWith('southport'), length = southport ? 62 : 110,
          heading = stand.a, ux = Math.cos(heading), uz = Math.sin(heading),
          nx = -uz, nz = ux;
        const line = box(group, stand.x - ux * 18, 0.105, stand.y - uz * 18, length, 0.025, 1.4, airportFinish.yellow);
        line.rotation.y = -heading;
        line.castShadow = false;
        for (const side of [-1, 1]) {
          const stop = box(group, stand.x + nx * side * 14, 0.11, stand.y + nz * side * 14, 16, 0.025, 1.2, airportFinish.yellow);
          stop.rotation.y = -(heading + Math.PI / 2);
          stop.castShadow = false;
        }
        // Small stand number is ground-painted; one shared texture per label.
        const label = airportPlacard(group, (southport ? 'G' : 'B') + index,
          stand.x - ux * (length * 0.63), 0.12, stand.y - uz * (length * 0.63), southport ? 18 : 26, 0, true);
        label.rotation.set(-Math.PI / 2, 0, -(heading + Math.PI / 2));
        label.castShadow = false;
      }
