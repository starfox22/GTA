      // Mountain village 3D kit: per-material buffers and primitives (mvBatch, mvQuad, mvBox, mvCyl).
      /* ---- The kit: pieces written straight into per-material buffers ---------------------- */
      const mvColor = new Three.Color(),
        mvTmp = new Three.Color();
      function mvBatch(name) {
        return { name, parts: new Map() };
      }
      function mvBuf(batch, material) {
        let b = batch.parts.get(material);
        if (!b) batch.parts.set(material, (b = { pos: [], nor: [], uv: [], col: [], idx: [] }));
        return b;
      }
      const mvV3 = (x, y, z) => new Three.Vector3(x, y, z);
      // A quad p0..p3 counter-clockwise seen from its front; uvs explicit or world-projected.
      function mvQuad(batch, material, p, color, uvs = null, shade = true) {
        const b = mvBuf(batch, material),
          base = b.pos.length / 3,
          e1 = mvV3(p[1].x - p[0].x, p[1].y - p[0].y, p[1].z - p[0].z),
          e2 = mvV3(p[3].x - p[0].x, p[3].y - p[0].y, p[3].z - p[0].z),
          n = e1.clone().cross(e2).normalize(),
          tile = MV_TILE[material] || [2, 2];
        let U = null,
          Vv = null;
        if (!uvs) {
          if (Math.abs(n.y) > 0.85) {
            U = mvV3(1, 0, 0);
            Vv = mvV3(0, 0, -1);
          } else {
            // To the viewer's right (horizontal), and up the face (up the slope on a roof).
            U = mvV3(0, 1, 0).cross(n).normalize();
            Vv = n.clone().cross(U).normalize();
          }
        }
        mvColor.set(color);
        for (let k = 0; k < 4; k++) {
          const q = p[k];
          b.pos.push(q.x, q.y, q.z);
          b.nor.push(n.x, n.y, n.z);
          if (uvs) b.uv.push(uvs[k][0], uvs[k][1]);
          else b.uv.push((q.x * U.x + q.y * U.y + q.z * U.z) / (tile[0] * MVU), (q.x * Vv.x + q.y * Vv.y + q.z * Vv.z) / (tile[1] * MVU));
          // Walls darken towards the ground (splash and shade under the eaves' drip line).
          const s = shade && Math.abs(n.y) < 0.5 ? 0.8 + 0.2 * clamp(q.y / (1.6 * MVU), 0, 1) : 1;
          b.col.push(mvColor.r * s, mvColor.g * s, mvColor.b * s);
        }
        b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      function mvTri(batch, material, a, bb, c, color) {
        // A degenerate quad keeps one code path (the fourth corner on the third).
        mvQuad(batch, material, [a, bb, c, c], color);
      }
      // An oriented box: centre c, unit axes [X, Y, Z], half sizes [hx, hy, hz]; `skip` names faces to leave out.
      function mvOBox(batch, material, c, axes, half, color, skip = '') {
        const [X, Y, Z] = axes,
          faces = [
            ['px', X, Y, Z, half[0], half[1], half[2]],
            ['nx', X.clone().negate(), Y, Z, half[0], half[1], half[2]],
            ['py', Y, Z, X, half[1], half[2], half[0]],
            ['ny', Y.clone().negate(), Z, X, half[1], half[2], half[0]],
            ['pz', Z, X, Y, half[2], half[0], half[1]],
            ['nz', Z.clone().negate(), X, Y, half[2], half[0], half[1]],
          ];
        for (const [id, N, A0, B0, hn, ha, hb] of faces) {
          if (skip.includes(id)) continue;
          let A = A0,
            B = B0,
            a = ha,
            bh = hb;
          if (A.clone().cross(B).dot(N) < 0) {
            [A, B] = [B, A];
            [a, bh] = [bh, a];
          }
          const o = c.clone().addScaledVector(N, hn),
            corner = (sa, sb) => o.clone().addScaledVector(A, sa * a).addScaledVector(B, sb * bh);
          mvQuad(batch, material, [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], color);
        }
      }
      const mvAX = mvV3(1, 0, 0),
        mvAY = mvV3(0, 1, 0),
        mvAZ = mvV3(0, 0, 1);
      // An axis-aligned box (optionally turned `yaw` about the vertical).
      function mvBox(batch, material, cx, cy, cz, sx, sy, sz, color, yaw = 0, skip = '') {
        const axes = yaw ? [mvV3(Math.cos(yaw), 0, -Math.sin(yaw)), mvAY, mvV3(Math.sin(yaw), 0, Math.cos(yaw))] : [mvAX, mvAY, mvAZ];
        mvOBox(batch, material, mvV3(cx, cy, cz), axes, [sx / 2, sy / 2, sz / 2], color, skip);
      }
      // A box from its base (y0 at the bottom).
      function mvBlock(batch, material, x0, y0, z0, x1, y1, z1, color, skip = 'ny') {
        mvBox(batch, material, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, 0, skip);
      }
      // A prism (cylinder) from a to b, radius r, `sides`; `cap` material for the ends (or none).
      function mvCyl(batch, material, a, b, r, sides, color, cap = null, capColor = color) {
        const d = mvV3(b.x - a.x, b.y - a.y, b.z - a.z),
          length = d.length();
        d.normalize();
        const ref = Math.abs(d.y) < 0.9 ? mvAY : mvAX,
          e1 = ref.clone().cross(d).normalize(),
          e2 = d.clone().cross(e1).normalize(),
          tile = MV_TILE[material] || [2, 2],
          buf = mvBuf(batch, material);
        mvColor.set(color);
        const circumference = TAU * r;
        for (let k = 0; k < sides; k++) {
          const a0 = (k / sides) * TAU,
            a1 = ((k + 1) / sides) * TAU,
            n0 = e1.clone().multiplyScalar(Math.cos(a0)).addScaledVector(e2, Math.sin(a0)),
            n1 = e1.clone().multiplyScalar(Math.cos(a1)).addScaledVector(e2, Math.sin(a1)),
            base = buf.pos.length / 3,
            pts = [a.clone().addScaledVector(n0, r), a.clone().addScaledVector(n1, r), b.clone().addScaledVector(n1, r), b.clone().addScaledVector(n0, r)],
            norms = [n0, n1, n1, n0],
            us = [k / sides, (k + 1) / sides, (k + 1) / sides, k / sides].map((u) => (u * circumference) / (tile[0] * MVU)),
            vs = [0, 0, length, length].map((v) => v / (tile[1] * MVU));
          for (let i = 0; i < 4; i++) {
            buf.pos.push(pts[i].x, pts[i].y, pts[i].z);
            buf.nor.push(norms[i].x, norms[i].y, norms[i].z);
            buf.uv.push(vs[i], us[i]);
            buf.col.push(mvColor.r, mvColor.g, mvColor.b);
          }
          // Outward winding: (p1 - p0) x (p2 - p0) = L (e2 x d) = L e1 at the seam.
          buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
        if (cap) {
          const cb = mvBuf(batch, cap);
          mvTmp.set(capColor);
          for (const [p, sign] of [
            [a, -1],
            [b, 1],
          ]) {
            const base = cb.pos.length / 3,
              n = d.clone().multiplyScalar(sign);
            cb.pos.push(p.x, p.y, p.z);
            cb.nor.push(n.x, n.y, n.z);
            cb.uv.push(0.5, 0.5);
            cb.col.push(mvTmp.r, mvTmp.g, mvTmp.b);
            for (let k = 0; k < sides; k++) {
              const ang = (k / sides) * TAU,
                q = p.clone().addScaledVector(e1, Math.cos(ang) * r).addScaledVector(e2, Math.sin(ang) * r);
              cb.pos.push(q.x, q.y, q.z);
              cb.nor.push(n.x, n.y, n.z);
              cb.uv.push(0.5 + Math.cos(ang) * 0.12, 0.5 + Math.sin(ang) * 0.12);
              cb.col.push(mvTmp.r, mvTmp.g, mvTmp.b);
            }
            for (let k = 0; k < sides; k++) {
              const i0 = base + 1 + k,
                i1 = base + 1 + ((k + 1) % sides);
              if (sign > 0) cb.idx.push(base, i0, i1);
              else cb.idx.push(base, i1, i0);
            }
          }
        }
      }
      // Any three.js geometry, placed by a matrix (flowers, rocks, chairs' curves, tyres).
      const mvMatrix = new Three.Matrix4(),
        mvNormalMatrix = new Three.Matrix3();
      function mvGeometry(batch, material, geo, x, y, z, sx, sy, sz, color, yaw = 0, pitch = 0) {
        mvMatrix.compose(mvV3(x, y, z), new Three.Quaternion().setFromEuler(new Three.Euler(pitch, yaw, 0, 'YXZ')), mvV3(sx, sy, sz));
        mvNormalMatrix.getNormalMatrix(mvMatrix);
        const buf = mvBuf(batch, material),
          base = buf.pos.length / 3,
          pos = geo.attributes.position,
          nor = geo.attributes.normal,
          uv = geo.attributes.uv,
          v = new Three.Vector3();
        mvColor.set(color);
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(mvMatrix);
          buf.pos.push(v.x, v.y, v.z);
          v.fromBufferAttribute(nor, i).applyMatrix3(mvNormalMatrix).normalize();
          buf.nor.push(v.x, v.y, v.z);
          buf.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
          buf.col.push(mvColor.r, mvColor.g, mvColor.b);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) buf.idx.push(base + geo.index.getX(i));
        else for (let i = 0; i < pos.count; i++) buf.idx.push(base + i);
      }
      const MV_GEO = {
        blob: new Three.IcosahedronGeometry(1, 0),
        rock: new Three.DodecahedronGeometry(1, 0),
        torus: new Three.TorusGeometry(1, 0.42, 6, 14),
        ball: new Three.SphereGeometry(1, 6, 4),
        cone: new Three.ConeGeometry(1, 1, 10),
      };
      // A flat decal on the ground (gravel, dirt, cobbles, the helipad): y just above the county sheet.
      function mvGround(batch, material, x0, z0, x1, z1, color = '#ffffff', y = 0.12) {
        mvQuad(batch, material, [mvV3(x0, y, z1), mvV3(x1, y, z1), mvV3(x1, y, z0), mvV3(x0, y, z0)], color, null, false);
      }
      // Pieces with uvs from an atlas cell: [u0, v0, u1, v1].
      function mvCellQuad(batch, material, p, cell, color = '#ffffff') {
        const [u0, v0, u1, v1] = cell;
        mvQuad(batch, material, p, color, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], false);
      }
      // A vertical rectangle facing +z (south) at z, centred on x, from y0 to y1.
      function mvFacing(x, y0, y1, z, width, facing = 'south') {
        const h = width / 2;
        if (facing === 'south') return [mvV3(x - h, y0, z), mvV3(x + h, y0, z), mvV3(x + h, y1, z), mvV3(x - h, y1, z)];
        if (facing === 'north') return [mvV3(x + h, y0, z), mvV3(x - h, y0, z), mvV3(x - h, y1, z), mvV3(x + h, y1, z)];
        // East / west faces: `x` is the face's x and `z` the centre along it.
        if (facing === 'east') return [mvV3(x, y0, z + h), mvV3(x, y0, z - h), mvV3(x, y1, z - h), mvV3(x, y1, z + h)];
        return [mvV3(x, y0, z - h), mvV3(x, y0, z + h), mvV3(x, y1, z + h), mvV3(x, y1, z - h)];
      }
      const mvMix = (a, b, t) => '#' + new Three.Color(a).lerp(new Three.Color(b), t).getHexString();
      /* ---- Signs: every village board in one atlas (SignArt designs), one material ---------- */
      const MV_SIGN_W = 512,
        MV_SIGN_H = 128,
        MV_SIGN_COLS = 4;
      const mvSignTexts = [];
      for (const b of MOUNTAIN_VILLAGE.buildings) if (b.name) mvSignTexts.push(b.name);
      mvSignTexts.push('4X4 CLUB', 'RIDGELINE 4X4 CLUB', 'MOUNT ASCENT TRAILHEAD', 'VACANCY', 'MECHANICS', '4X4 CLUB · TV');
      const mvSignRows = Math.ceil(mvSignTexts.length / MV_SIGN_COLS),
        mvSignDay = document.createElement('canvas'),
        mvSignGlow = document.createElement('canvas');
      mvSignDay.width = mvSignGlow.width = MV_SIGN_W * MV_SIGN_COLS;
      mvSignDay.height = mvSignGlow.height = MV_SIGN_H * mvSignRows;
      const mvSignCells = new Map();
      {
        const dg = mvSignDay.getContext('2d'),
          gg = mvSignGlow.getContext('2d');
        gg.fillStyle = '#000';
        gg.fillRect(0, 0, mvSignGlow.width, mvSignGlow.height);
        mvSignTexts.forEach((text, i) => {
          const x = (i % MV_SIGN_COLS) * MV_SIGN_W,
            y = Math.floor(i / MV_SIGN_COLS) * MV_SIGN_H;
          for (const g of [dg, gg]) {
            g.save();
            g.translate(x, y);
            g.beginPath();
            g.rect(0, 0, MV_SIGN_W, MV_SIGN_H);
            g.clip();
          }
          if (text === '4X4 CLUB · TV') {
            // The clubhouse TV: a rally truck mid-jump over dunes at sunset.
            const sky = dg.createLinearGradient(0, 0, 0, MV_SIGN_H);
            sky.addColorStop(0, '#f08a3a');
            sky.addColorStop(1, '#f6d27a');
            dg.fillStyle = sky;
            dg.fillRect(0, 0, MV_SIGN_W, MV_SIGN_H);
            dg.fillStyle = '#b8742e';
            dg.beginPath();
            dg.moveTo(0, 100);
            dg.quadraticCurveTo(140, 60, 280, 96);
            dg.quadraticCurveTo(400, 118, 512, 84);
            dg.lineTo(512, 128);
            dg.lineTo(0, 128);
            dg.fill();
            dg.fillStyle = '#1c2a3a';
            dg.fillRect(220, 40, 80, 26);
            dg.fillRect(236, 26, 44, 16);
            dg.fillStyle = '#111';
            for (const wx of [236, 286]) {
              dg.beginPath();
              dg.arc(wx, 68, 10, 0, TAU);
              dg.fill();
            }
            dg.fillStyle = '#fff';
            dg.font = 'bold 18px Arial';
            dg.fillText('LIVE · BAJA 1000', 16, 24);
            gg.fillStyle = '#d0c0a0';
            gg.fillRect(0, 0, MV_SIGN_W, MV_SIGN_H);
          } else SignArt.paint(dg, gg, MV_SIGN_W, MV_SIGN_H, text, '#f2e3b3', /TRAILHEAD/.test(text) ? 'trail' : undefined);
          dg.restore();
          gg.restore();
          mvSignCells.set(text, [x / mvSignDay.width, 1 - (y + MV_SIGN_H) / mvSignDay.height, (x + MV_SIGN_W) / mvSignDay.width, 1 - y / mvSignDay.height]);
        });
      }
      const mvSignTexture = new Three.CanvasTexture(mvSignDay),
        mvSignGlowTexture = new Three.CanvasTexture(mvSignGlow);
      for (const t of [mvSignTexture, mvSignGlowTexture]) {
        t.colorSpace = Three.SRGBColorSpace;
        t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      }
      // Floodlit boards: the lanterns wash them at night (signage3d.js drives the emissive).
      MV_MAT.sign = litSignMaterial(mvSignTexture, mvSignGlowTexture, { night: 1.3, day: 0.06, cutout: true, roughness: 0.7 });
      MV_MAT.sign.userData.mountainKit = true;
      // A sign board facing south, centred at (x, y, z), `width` wide (4:1), with two lanterns over it.
      function mvSign(batch, text, x, y, z, width, lanterns = true, facing = 'south') {
        const cell = mvSignCells.get(text);
        if (!cell) return;
        const h = width / 4;
        mvCellQuad(batch, 'sign', mvFacing(x, y - h / 2, y + h / 2, z, width, facing), cell);
        if (!lanterns || facing !== 'south') return;
        for (const side of [-1, 1]) {
          const lx = x + side * width * 0.36;
          // An iron goose-neck with a lantern hood over the board.
          mvBox(batch, 'iron', lx, y + h / 2 + 1.4, z + 1.4, 0.35, 0.35, 2.8, '#1e1e1e');
          mvBox(batch, 'iron', lx, y + h / 2 + 1.1, z + 2.8, 1.4, 0.9, 1.2, '#1e1e1e');
          mvBox(batch, 'lamp', lx, y + h / 2 + 0.4, z + 2.8, 0.9, 0.6, 0.8, '#fff0cc');
          addGlow(lx, y + h / 2, z + 3.2, 6, '#ffd89a', 1.1, { day: 0 });
        }
      }
      /* ---- Night: warm pools on the ground (one additive mesh per town) ------------------- */
      const mvPoolTexture = (() => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 64;
        const g = cv.getContext('2d'),
          grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.35, 'rgba(255,255,255,0.5)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        return new Three.CanvasTexture(cv);
      })();
      const mvPoolMaterial = new Three.MeshBasicMaterial({ map: mvPoolTexture, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: Three.AdditiveBlending, fog: true });
      // `y` is the surface it lies on (a boardwalk or deck is a couple of units up).
      function mvPool(batch, x, z, radius, color, strength = 1, y = 0.35) {
        mvColor.set(color).multiplyScalar(strength);
        const b = mvBuf(batch, 'pool'),
          base = b.pos.length / 3;
        for (const [dx, dz, u, v] of [[-1, 1, 0, 0], [1, 1, 1, 0], [1, -1, 1, 1], [-1, -1, 0, 1]]) {
          b.pos.push(x + dx * radius, y, z + dz * radius);
          b.nor.push(0, 1, 0);
          b.uv.push(u, v);
          b.col.push(mvColor.r, mvColor.g, mvColor.b);
        }
        b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      /* ---- Flush: a batch becomes one mesh per material under `group` ---------------------- */
      const mvStats = { meshes: 0, triangles: 0, vertices: 0, towns: {} };
      function mvFlush(batch, group, tag = batch.name) {
        const stat = mvStats.towns[tag] || (mvStats.towns[tag] = { meshes: 0, triangles: 0 });
        for (const [material, b] of batch.parts) {
          if (!b.idx.length) continue;
          const geo = new Three.BufferGeometry();
          geo.setAttribute('position', new Three.Float32BufferAttribute(b.pos, 3));
          geo.setAttribute('normal', new Three.Float32BufferAttribute(b.nor, 3));
          geo.setAttribute('uv', new Three.Float32BufferAttribute(b.uv, 2));
          geo.setAttribute('color', new Three.Float32BufferAttribute(b.col, 3));
          geo.setIndex(b.pos.length / 3 > 65535 ? new Three.Uint32BufferAttribute(b.idx, 1) : new Three.Uint16BufferAttribute(b.idx, 1));
          geo.computeBoundingSphere();
          const m = new Three.Mesh(geo, material === 'pool' ? mvPoolMaterial : MV_MAT[material]);
          m.name = 'village ' + tag + ' ' + material;
          m.castShadow = !['pool', 'gravel', 'dirt', 'cobbles', 'sign', 'windowLit', 'windowDark', 'map'].includes(material);
          m.receiveShadow = material !== 'pool';
          if (material === 'pool') m.renderOrder = 2;
          group.add(m);
          stat.meshes++;
          stat.triangles += b.idx.length / 3;
          mvStats.meshes++;
          mvStats.triangles += b.idx.length / 3;
          mvStats.vertices += b.pos.length / 3;
        }
        batch.parts.clear();
      }
      /* ---- Building pieces ------------------------------------------------------------------ */
      // The finish's material and tint for a wall band.
      function mvWallFinish(b, finish) {
        const F = b.finish;
        if (finish === 'stone') return ['stone', mvMix(F.stone, '#ffffff', 0.35)];
        if (finish === 'log') return ['logs', mvMix(F.stain, '#ffffff', 0.25)];
        if (finish === 'plaster') return ['plaster', F.plaster];
        return ['boards', F.boards];
      }
      function mvRoofFinish(b) {
        const F = b.finish;
        if (F.roof === 'metal') return ['metal', F.roofColor];
        if (F.roof === 'slate') return ['slate', mvMix(F.roofColor, '#ffffff', 0.1)];
        return ['shake', mvMix(F.roofColor, '#ffffff', 0.18)];
      }
      /*
       * A gable roof over x0..x1, z0..z1 with its ridge along `axis` ('x' or 'y'
       * = map y), eaves at `eaves`, rising `rise`, overhanging `ov` (eaves) and
       * `ovg` (gables). Writes the two slopes, the ridge cap, fascia and
       * bargeboards, rafter tails on the south eave and snow when `snow` > 0.
       */
      function mvGableRoof(batch, x0, z0, x1, z1, axis, eaves, rise, ov, ovg, roofFinish, trim, snow = 0, tails = false, faceSkip = '') {
        const [material, color] = roofFinish,
          t = 0.22 * MVU,
          cx = (x0 + x1) / 2,
          cz = (z0 + z1) / 2,
          half = axis === 'x' ? (z1 - z0) / 2 : (x1 - x0) / 2,
          along = axis === 'x' ? (x1 - x0) / 2 + ovg : (z1 - z0) / 2 + ovg,
          pitch = Math.atan2(rise, half),
          run = half + ov,
          L = run / Math.cos(pitch) + 0.12 * MVU,
          ridgeY = eaves + rise,
          R = axis === 'x' ? mvAX : mvAZ;
        for (const s of [1, -1]) {
          if (faceSkip.includes(s > 0 ? '+' : '-')) continue;
          const D = axis === 'x' ? mvV3(0, -Math.sin(pitch), s * Math.cos(pitch)) : mvV3(s * Math.cos(pitch), -Math.sin(pitch), 0),
            N = axis === 'x' ? mvV3(0, Math.cos(pitch), s * Math.sin(pitch)) : mvV3(s * Math.sin(pitch), Math.cos(pitch), 0),
            ridge = mvV3(cx, ridgeY, cz),
            centre = ridge.clone().addScaledVector(D, L / 2 - 0.12 * MVU).addScaledVector(N, t / 2);
          mvOBox(batch, material, centre, [R, N, D], [along, t / 2, L / 2], color);
          if (snow > 0) {
            const cover = L * (0.55 + 0.4 * snow);
            mvOBox(batch, 'snow', ridge.clone().addScaledVector(D, cover / 2).addScaledVector(N, t + 0.08 * MVU), [R, N, D], [along - 0.1 * MVU, 0.1 * MVU, cover / 2], '#f4f7fb');
          }
          // Fascia along the eave edge.
          const edge = ridge.clone().addScaledVector(D, L - 0.12 * MVU);
          mvOBox(batch, 'timber', edge.clone().addScaledVector(N, -0.05 * MVU), [R, N, D], [along + 0.05 * MVU, 0.2 * MVU, 0.06 * MVU], trim);
          // Rafter tails under the eave (the camera sees the south one).
          if (tails && s > 0 && axis === 'x') {
            for (let u = -along + 0.6 * MVU; u < along - 0.3 * MVU; u += 0.9 * MVU) {
              const p = ridge.clone().addScaledVector(D, L - 0.55 * MVU).addScaledVector(N, -0.16 * MVU).addScaledVector(R, u);
              mvOBox(batch, 'timber', p, [R, N, D], [0.07 * MVU, 0.1 * MVU, 0.5 * MVU], trim);
            }
          }
          // Bargeboards up the two gable edges.
          for (const e of [-1, 1]) {
            const p = ridge.clone().addScaledVector(D, L / 2 - 0.12 * MVU).addScaledVector(R, e * (along + 0.04 * MVU)).addScaledVector(N, -0.08 * MVU);
            mvOBox(batch, 'timber', p, [R, N, D], [0.06 * MVU, 0.24 * MVU, L / 2], trim);
          }
        }
        // Ridge cap.
        mvOBox(batch, material === 'metal' ? 'metal' : 'timber', mvV3(cx, ridgeY + t * 0.9, cz), [R, mvAY, axis === 'x' ? mvAZ : mvAX], [along + 0.06 * MVU, 0.12 * MVU, 0.22 * MVU], material === 'metal' ? color : mvMix(color, '#000000', 0.25));
        return ridgeY;
      }
      // The gable triangles of a roof over the given footprint.
      function mvGables(batch, x0, z0, x1, z1, axis, eaves, rise, finish, color, faces = 'both') {
        const top = eaves + rise;
        if (axis === 'y') {
          const cx = (x0 + x1) / 2;
          if (faces !== 'north') mvTri(batch, finish, mvV3(x0, eaves, z1), mvV3(x1, eaves, z1), mvV3(cx, top, z1), color);
          if (faces !== 'south') mvTri(batch, finish, mvV3(x1, eaves, z0), mvV3(x0, eaves, z0), mvV3(cx, top, z0), color);
        } else {
          const cz = (z0 + z1) / 2;
          mvTri(batch, finish, mvV3(x0, eaves, z0), mvV3(x0, eaves, z1), mvV3(x0, top, cz), color);
          mvTri(batch, finish, mvV3(x1, eaves, z1), mvV3(x1, eaves, z0), mvV3(x1, top, cz), color);
        }
      }
      // A window on a face: glass (lit or dark), sill, lintel, optional shutters and flower box.
      function mvWindow(batch, b, face, x, y0, z, width, height, options = {}) {
        const F = b.finish,
          cellIndex = options.cell ?? 0,
          lit = options.lit ?? mvRand() < 0.62,
          out = face === 'south' ? 1 : face === 'north' ? -1 : 0,
          sideOut = face === 'east' ? 1 : face === 'west' ? -1 : 0,
          push = 0.06 * MVU;
        const px = x + sideOut * push,
          pz = z + out * push;
        mvCellQuad(batch, lit ? 'windowLit' : 'windowDark', mvFacing(px, y0, y0 + height, pz, width, face), MV_WINDOW_CELL[cellIndex]);
        const along = face === 'south' || face === 'north';
        const put = (du, y, dn, su, sy, sn, material, color) => {
          if (along) mvBox(batch, material, x + du, y, z + out * dn, su, sy, sn, color);
          else mvBox(batch, material, x + sideOut * dn, y, z + du, sn, sy, su, color);
        };
        // Sill and head.
        put(0, y0 - 0.06 * MVU, 0.14 * MVU, width + 0.3 * MVU, 0.12 * MVU, 0.3 * MVU, 'timber', options.trim || F.trim);
        put(0, y0 + height + 0.1 * MVU, 0.08 * MVU, width + 0.4 * MVU, 0.2 * MVU, 0.18 * MVU, 'timber', mvMix(F.stain, '#000000', 0.2));
        if (options.shutters) {
          const sw = width * 0.5;
          for (const side of [-1, 1]) {
            const u = side * (width / 2 + sw / 2 + 0.05 * MVU);
            if (along) mvCellQuad(batch, 'shutter', mvFacing(x + u, y0, y0 + height, z + out * 0.1 * MVU, sw, face), [0, 0, 1, 1], F.shutter);
            else mvCellQuad(batch, 'shutter', mvFacing(x + sideOut * 0.1 * MVU, y0, y0 + height, z + u, sw, face), [0, 0, 1, 1], F.shutter);
          }
        }
        if (options.flowers) {
          put(0, y0 - 0.32 * MVU, 0.3 * MVU, width + 0.1 * MVU, 0.36 * MVU, 0.36 * MVU, 'timber', F.trim);
          const n = Math.max(3, Math.round(width / (0.3 * MVU)));
          for (let k = 0; k < n; k++) {
            const du = -width / 2 + ((k + 0.5) * width) / n,
              color = k % 3 === 1 ? '#3f6a32' : F.flower,
              r = (0.16 + mvRand() * 0.08) * MVU;
            if (along) mvGeometry(batch, 'paint', MV_GEO.blob, x + du, y0 - 0.02 * MVU, z + out * 0.34 * MVU, r, r * 0.9, r, color, mvRand() * 3);
            else mvGeometry(batch, 'paint', MV_GEO.blob, x + sideOut * 0.34 * MVU, y0 - 0.02 * MVU, z + du, r, r * 0.9, r, color, mvRand() * 3);
          }
          // Trailing geranium stems over the front of the box.
          if (along) mvBox(batch, 'paint', x, y0 - 0.46 * MVU, z + out * 0.5 * MVU, width * 0.8, 0.26 * MVU, 0.08 * MVU, '#3f6a32');
        }
      }
      // A door on the south face: its leaf, frame and step.
      function mvDoor(batch, b, x, z, cellIndex = 0, width = 1.1 * MVU, height = DOOR_HEIGHT) {
        const cell = MV_DOOR_CELL[cellIndex];
        mvCellQuad(batch, 'door', mvFacing(x, 0.15 * MVU, height, z + 0.05 * MVU, width), [cell[0], 0, cell[1], 1], mvMix(b.finish.stain, '#ffffff', 0.4));
        const trim = b.finish.trim;
        for (const side of [-1, 1]) mvBox(batch, 'timber', x + side * (width / 2 + 0.1 * MVU), height / 2, z + 0.1 * MVU, 0.2 * MVU, height + 0.1 * MVU, 0.22 * MVU, trim);
        mvBox(batch, 'timber', x, height + 0.12 * MVU, z + 0.12 * MVU, width + 0.5 * MVU, 0.24 * MVU, 0.26 * MVU, trim);
        mvBox(batch, 'stone', x, 0.08 * MVU, z + 0.45 * MVU, width + 0.6 * MVU, 0.16 * MVU, 0.9 * MVU, '#b8b2a6');
      }
      // Log corner notches: the crossing log ends that stand out at each corner of a log wall.
      function mvLogCorners(batch, b, x0, z0, x1, z1, y0, y1, color) {
        const r = 0.15 * MVU,
          stick = 0.28 * MVU;
        for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
          let k = 0;
          for (let y = y0 + r; y < y1 - r * 0.5; y += 0.3 * MVU, k++) {
            const sx = cx < (x0 + x1) / 2 ? -1 : 1,
              sz = cz < (z0 + z1) / 2 ? -1 : 1;
            if (k % 2) mvCyl(batch, 'logs', mvV3(cx - sx * 0.2 * MVU, y, cz), mvV3(cx + sx * stick, y, cz), r, 7, color, 'stack', '#caa678');
            else mvCyl(batch, 'logs', mvV3(cx, y, cz - sz * 0.2 * MVU), mvV3(cx, y, cz + sz * stick), r, 7, color, 'stack', '#caa678');
          }
        }
      }
      // A stone chimney through the roof, a cap and a pot; returns its top for the smoke.
      function mvChimney(batch, b, x, z, fromY, top) {
        const c = mvMix(b.finish.stone, '#ffffff', 0.3);
        mvBlock(batch, 'stone', x - 0.55 * MVU, fromY, z - 0.55 * MVU, x + 0.55 * MVU, top, z + 0.55 * MVU, c);
        mvBlock(batch, 'stone', x - 0.7 * MVU, top, z - 0.7 * MVU, x + 0.7 * MVU, top + 0.18 * MVU, z + 0.7 * MVU, '#9b968c', '');
        mvCyl(batch, 'paint', mvV3(x, top + 0.18 * MVU, z), mvV3(x, top + 0.7 * MVU, z), 0.16 * MVU, 8, '#8a4a32');
        return { x, y: top + 0.7 * MVU, z };
      }
      const mvChimneys = [];
      /*
       * A house of any kind: plinth, ground storey, jettied upper storeys,
       * floor band, gables, roof, chimney, windows, doors, and the kind's own
       * features. `batch` is the town's.
       */
      function mvHouse(batch, b) {
        const K = MOUNTAIN_KINDS[b.kind],
          F = b.finish,
          M = MVU,
          x0 = b.x,
          z0 = b.y,
          x1 = b.x + b.w,
          z1 = b.y + b.h,
          cx = (x0 + x1) / 2,
          cz = (z0 + z1) / 2,
          eaves = b.eaves,
          ground = K.ground * M,
          plinth = 0.6 * M,
          axis = b.ridge === 'y' ? 'y' : 'x',
          [baseMat, baseColor] = mvWallFinish(b, F.base),
          [wallMat, wallColor] = mvWallFinish(b, F.walls),
          roofFinish = mvRoofFinish(b),
          trim = F.trim,
          dark = mvMix(F.stain, '#1a120a', 0.45);
        mvSeed = (b.seed % 2147483646) + 1;
        if (K.tower) return mvLookout(batch, b);
        if (K.openSides) return mvOpenShed(batch, b);
        // Plinth, ground storey, upper storeys (jettied out a little on timber and logs).
        mvBlock(batch, 'stone', x0 - 0.1 * M, 0, z0 - 0.1 * M, x1 + 0.1 * M, plinth, z1 + 0.1 * M, mvMix(F.stone, '#ffffff', 0.2), 'ny');
        let jetty = 0;
        if (b.floors >= 2) {
          mvBlock(batch, baseMat, x0, plinth, z0, x1, ground, z1, baseColor, 'nypy');
          jetty = F.walls === 'stone' ? 0 : 0.14 * M;
          mvBlock(batch, wallMat, x0 - jetty, ground, z0 - jetty, x1 + jetty, eaves, z1 + jetty, wallColor, 'nypy');
          mvBlock(batch, 'timber', x0 - jetty - 0.06 * M, ground - 0.2 * M, z0 - jetty - 0.06 * M, x1 + jetty + 0.06 * M, ground + 0.06 * M, z1 + jetty + 0.06 * M, dark, 'ny');
          if (F.walls === 'plaster') mvHalfTimber(batch, x0 - jetty, z1 + jetty, x1 + jetty, ground, eaves, dark);
        } else mvBlock(batch, wallMat, x0, plinth, z0, x1, eaves, z1, wallColor, 'nypy');
        if (F.walls === 'log' || (b.floors < 2 && F.base === 'log') || (F.base === 'log' && b.floors >= 2)) {
          const from = b.floors >= 2 && F.base !== 'log' ? ground : plinth,
            to = b.floors >= 2 && F.walls !== 'log' ? ground : eaves;
          if (to > from) mvLogCorners(batch, b, x0 - jetty, z0 - jetty, x1 + jetty, z1 + jetty, from, to, wallColor);
        }
        const gx0 = x0 - jetty,
          gz0 = z0 - jetty,
          gx1 = x1 + jetty,
          gz1 = z1 + jetty;
        // The false front hides the south gable; everything else shows it.
        const gableFinish = F.walls === 'plaster' ? 'boards' : wallMat,
          gableColor = F.walls === 'plaster' ? mvMix(F.stain, '#ffffff', 0.35) : wallColor;
        mvGables(batch, gx0, gz0, gx1, gz1, axis, eaves, b.rise, gableFinish, gableColor, K.falseFront ? 'north' : 'both');
        const ov = K.overhang * M,
          ridgeY = mvGableRoof(batch, gx0, gz0, gx1, gz1, axis, eaves, b.rise, ov, ov * 0.85, roofFinish, dark, b.snow, ['chalet', 'lodge', 'house', 'tavern', 'station', 'bakery'].includes(b.kind));
        // Chimney: on the ridge, towards one end.
        if (!['barn', 'rescue', 'chapel', 'gas', 'store', 'shop'].includes(b.kind) || b.kind === 'shop') {
          const along = mvRand() < 0.5 ? 0.28 : 0.72,
            chX = axis === 'x' ? x0 + b.w * along : cx + b.w * 0.18,
            chZ = axis === 'x' ? cz - b.h * 0.08 : z0 + b.h * along;
          mvChimneys.push(mvChimney(batch, b, chX, chZ, eaves, ridgeY + 1.1 * M));
        }
        // Windows on the south, east and west faces, floor by floor.
        const storeys = [];
        if (b.floors >= 2) {
          storeys.push({ y: plinth + 0.5 * M, h: Math.min(1.35 * M, ground - plinth - 1.1 * M), face: z1, fx0: x0, fx1: x1, sx0: x0, sx1: x1 });
          for (let f = 1; f < b.floors; f++) {
            const y = ground + (f - 1) * K.upper * M + 0.8 * M;
            storeys.push({ y, h: 1.25 * M, face: z1 + jetty, fx0: x0 - jetty, fx1: x1 + jetty });
          }
        } else storeys.push({ y: plinth + 0.5 * M, h: Math.min(1.35 * M, eaves - plinth - 1.0 * M), face: z1, fx0: x0, fx1: x1 });
        const doorX = b.door.x,
          winW = 0.95 * M,
          cellIndex = b.kind === 'chapel' ? 3 : mvRand() < 0.5 ? 0 : 1;
        storeys.forEach((s, f) => {
          const width = s.fx1 - s.fx0,
            n = Math.max(1, Math.floor((width - 1.2 * M) / (2.5 * M)));
          // (Motels, barns and the rescue barn dress their own street faces; false fronts carry the upper windows.)
          const ownFront = K.motel || K.barnDoor || K.bayDoors || (K.falseFront && f > 0);
          for (let k = 0; k < n && !ownFront; k++) {
            const x = s.fx0 + ((k + 0.5) * width) / n;
            if (f === 0 && (K.shopWindow || Math.abs(x - doorX) < 1.4 * M)) continue;
            if (f === 1 && K.balcony && Math.abs(x - cx) < 0.9 * M) continue;
            if (K.crossGable && Math.abs(x - doorX) < Math.min(b.w * 0.18, 4 * M) + 0.6 * M) continue;
            mvWindow(batch, b, 'south', x, s.y, s.face, winW, s.h, { cell: cellIndex, shutters: K.shutters, flowers: K.flowers && mvRand() < 0.7 });
          }
          if (K.motel) return;
          // Side windows (seen at an angle).
          const depth = b.h,
            m = Math.max(1, Math.floor((depth - 2 * M) / (3.2 * M)));
          for (let k = 0; k < m; k++) {
            const z = z0 + ((k + 0.6) * depth) / (m + 0.2);
            const off = f > 0 ? jetty : 0;
            mvWindow(batch, b, 'east', x1 + off, s.y, z, winW * 0.9, s.h, { cell: cellIndex, shutters: K.shutters });
            mvWindow(batch, b, 'west', x0 - off, s.y, z, winW * 0.9, s.h, { cell: cellIndex, shutters: K.shutters });
          }
        });
        // Attic window in a street-facing gable.
        if (axis === 'y' && !K.falseFront && b.rise > 2.2 * M && b.kind !== 'chapel') mvWindow(batch, b, 'south', cx, eaves + 0.5 * M, gz1, 0.8 * M, 1.0 * M, { cell: 1, shutters: K.shutters });
        // Shop windows either side of the door, on a timber stall riser.
        if (K.shopWindow) {
          const shopW = Math.min(2.8 * M, b.w / 2 - 1.3 * M);
          if (shopW > 1.2 * M)
            for (const side of [-1, 1]) {
              const x = doorX + side * (0.9 * M + shopW / 2);
              if (x - shopW / 2 < x0 || x + shopW / 2 > x1) continue;
              mvBox(batch, 'timber', x, 0.35 * M, z1 + 0.12 * M, shopW + 0.2 * M, 0.7 * M, 0.26 * M, dark);
              mvWindow(batch, b, 'south', x, 0.75 * M, z1, shopW, 2.1 * M, { cell: 2, lit: true });
            }
        }
        // The door (carved double doors for the big public buildings).
        const bigDoor = ['lodge', 'tavern', 'chapel', 'station', 'store'].includes(b.kind);
        if (!K.motel && !K.barnDoor && !K.bayDoors) mvDoor(batch, b, doorX, z1, bigDoor ? 2 : K.shopWindow ? 1 : 0, bigDoor ? 2 * M : 1.1 * M);
        // Wall lanterns either side of the door.
        if (!K.motel)
          for (const side of [-1, 1]) {
            const lx = doorX + side * (bigDoor ? 1.6 : 1.0) * M;
            mvBox(batch, 'iron', lx, 2.6 * M, z1 + 0.25 * M, 0.3 * M, 0.5 * M, 0.3 * M, '#1d1d1d');
            mvBox(batch, 'lamp', lx, 2.3 * M, z1 + 0.35 * M, 0.26 * M, 0.34 * M, 0.26 * M, '#fff0cc');
            addGlow(lx, 2.3 * M, z1 + 0.6 * M, 5, '#ffd08a', 1, { day: 0 });
          }
        mvPool(batch, doorX, z1 + 2.2 * M, 4.5 * M, '#ffb866', 0.55, b.boardwalk ? 2.6 : 0.35);
        // Features. A porch roof over the boardwalk, unless an awning shades it;
        // a carved balcony where no porch roof or front gable is in its way.
        const porched = (K.porch || !!b.boardwalk) && !K.awning;
        if (K.balcony && b.floors >= 2 && !porched && !K.crossGable) mvBalcony(batch, b, cx, ground, gz1, axis === 'y' ? b.w * 0.82 : b.w * 0.62);
        if (K.falseFront) mvFalseFront(batch, b, ridgeY);
        if (porched) mvPorch(batch, b, ground);
        if (K.awning) mvAwning(batch, b);
        if (K.dormers && axis === 'x' && b.w > 7 * M) mvDormers(batch, b, gx0, gz1, gx1, eaves, roofFinish, wallMat, wallColor, dark);
        if (K.crossGable) mvCrossGable(batch, b, eaves, ridgeY, roofFinish, wallMat, wallColor, dark);
        if (K.steeple) mvSteeple(batch, b, ridgeY, roofFinish, dark);
        if (K.motel) mvMotelFront(batch, b, dark);
        if (K.barnDoor) mvBarnFront(batch, b, ridgeY, roofFinish);
        if (K.bayDoors) mvBayDoors(batch, b);
        if (b.kind === 'station') mvFlagpole(batch, b.x + b.w + 3 * M, b.y + b.h + 3 * M, 10 * M);
        if (b.kind === 'tavern' && b.options.deck) mvTavernDeck(batch, b);
        // The name board.
        if (b.name && !K.falseFront) {
          const width = Math.min(b.w * 0.72, 6.5 * M),
            y = porched ? Math.min(ground, 3.4 * M) + 1.3 * M : b.floors >= 2 ? ground + 0.1 * M : eaves - 0.2 * M;
          const z = porched && !K.crossGable ? z1 + (b.boardwalk ? b.boardwalk.h : 2 * M) + 0.1 * M : (K.crossGable ? z1 + 1.3 * M : gz1) + 0.12 * M;
          mvSign(batch, b.name, doorX, K.crossGable ? ground + 1.45 * M : y, z, K.crossGable ? Math.min(width, Math.min(b.w * 0.36, 8 * M) * 0.9) : width);
        }
      }
      // Dark timber framing on a plastered upper storey's street face.
      function mvHalfTimber(batch, x0, z, x1, y0, y1, color) {
        // Posts between the window bays (the same bays mvHouse spaces the windows in),
        // the wall plate and a mid rail at sill height.
        const w = x1 - x0,
          n = Math.max(1, Math.floor((w - 1.2 * MVU) / (2.5 * MVU)));
        for (let k = 0; k <= n; k++) mvBox(batch, 'timber', x0 + 0.1 * MVU + (k * (w - 0.2 * MVU)) / n, (y0 + y1) / 2, z + 0.05 * MVU, 0.2 * MVU, y1 - y0, 0.12 * MVU, color);
        mvBox(batch, 'timber', (x0 + x1) / 2, y1 - 0.1 * MVU, z + 0.05 * MVU, w, 0.2 * MVU, 0.12 * MVU, color);
        mvBox(batch, 'timber', (x0 + x1) / 2, y0 + 0.7 * MVU, z + 0.05 * MVU, w, 0.16 * MVU, 0.1 * MVU, color);
      }
