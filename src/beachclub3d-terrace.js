        /* ---- bars ---- */
        const bar = MAREA.bar,
          back = MAREA.backBar;
        clubSlab(clubGroup, bar[0], bar[1], bar[2], bar[3], 0, 9, M.darkWood);
        clubSlab(clubGroup, bar[0] - 1, bar[1] - 1, bar[2] + 1.5, bar[3] + 1, 9, 10, M.coping);
        clubSlab(clubGroup, bar[2] + 1, bar[1], bar[2] + 1.6, bar[3], 1, 2, LED.amber);
        clubSlab(clubGroup, back[0], back[1], back[2], back[3], 0, 18, M.darkWood);
        for (let v = back[1] + 3; v < back[3] - 2; v += 3.4)
          for (const y of [10, 14]) clubCyl(clubGroup, back[2] - 3 - ((v * 7) % 4), v, y, y + 3.4, 0.55, M.bottle);
        clubSlab(clubGroup, back[0], back[1], back[2], back[3], 18, 19, M.bronze);
        for (const [u, v] of MAREA.highTables) {
          clubCyl(clubGroup, u, v, 0, 8, 0.5, M.metal);
          clubCyl(clubGroup, u, v, 8, 8.6, 4, M.coping, 16);
        }
        // Pool bar: a stone counter, a thatched parasol roof, stools.
        const pb = MAREA.poolBar;
        clubSlab(clubGroup, pb[0], pb[1], pb[2], pb[3], 0, 9, M.stone);
        clubSlab(clubGroup, pb[0] - 1, pb[1] - 1, pb[2] + 1, pb[3] + 1, 9, 10, M.teak);
        clubSlab(clubGroup, pb[0], pb[3] + 0.2, pb[2], pb[3] + 0.8, 1, 2, LED.cyan);
        for (let u = 350; u <= 386; u += 9) {
          clubCyl(clubGroup, u, 226, 0, 6.4, 0.4, M.metal);
          clubCyl(clubGroup, u, 226, 6.4, 7, 2, M.teak, 12);
        }
        for (const [u, v] of [
          [pb[0], pb[1]],
          [pb[2], pb[1]],
        ])
          clubCyl(clubGroup, u, v, 0, 22, 0.8, M.teak);
        const thatch = mesh(new Three.ConeGeometry(30, 10, 6, 1), M.thatch, clubGroup, MX + (pb[0] + pb[2]) / 2, 26, MY + pb[1] + 4, 1, 1, 0.55);
        thatch.rotation.y = Math.PI / 6;

        /* ---- VIP terrace ---- */
        const vip = MAREA.vip;
        clubSlab(clubGroup, vip[0], vip[1], vip[2], vip[3], 0, 1.4, M.darkWood);
        for (const r of MAREA.vipSofas) {
          const alongV = r[3] - r[1] > r[2] - r[0];
          clubSlab(clubGroup, r[0], r[1], r[2], r[3], 1.4, 5, M.cushion);
          if (alongV) clubSlab(clubGroup, r[2] - 3.5, r[1], r[2], r[3], 5, 10, M.cushion);
          else clubSlab(clubGroup, r[0], r[1], r[2], r[1] + 3.5, 5, 10, M.cushion);
          for (let k = alongV ? r[1] + 6 : r[0] + 6; k < (alongV ? r[3] : r[2]) - 3; k += 13)
            if (alongV) clubSlab(clubGroup, r[2] - 6, k, r[2] - 3.5, k + 5, 5, 8.5, M.teal);
            else clubSlab(clubGroup, k, r[1] + 3.5, k + 5, r[1] + 6, 5, 8.5, M.teal);
        }
        for (const [u, v] of MAREA.vipTables) {
          clubCyl(clubGroup, u, v, 1.4, 5.2, 5, M.black, 16);
          clubCyl(clubGroup, u, v, 5.2, 8, 1.6, M.chrome, 12);
          clubCyl(clubGroup, u + 0.5, v, 7, 10.5, 0.45, M.bottle);
          kitLight(clubLights, scene, MX + u, 6.5, MY + v, '#ffd08a');
        }
        // Gold rope posts round the terrace (the gate gap is left open).
        const vipRope = (u0, v0, u1, v1) => {
          const n = Math.max(1, Math.round(Math.hypot(u1 - u0, v1 - v0) / 10));
          for (let k = 0; k <= n; k++) {
            const u = u0 + ((u1 - u0) * k) / n,
              v = v0 + ((v1 - v0) * k) / n;
            clubCyl(clubGroup, u, v, 1.4, 8, 0.45, M.gold);
            clubCyl(clubGroup, u, v, 8, 8.8, 0.8, M.gold);
            if (k < n) {
              const u2 = u0 + ((u1 - u0) * (k + 1)) / n,
                v2 = v0 + ((v1 - v0) * (k + 1)) / n;
              clubSlab(clubGroup, Math.min(u, u2) - 0.4, Math.min(v, v2) - 0.4, Math.max(u, u2) + 0.4, Math.max(v, v2) + 0.4, 6.4, 7.2, M.velvet);
            }
          }
        };
        vipRope(vip[0], vip[1], vip[0], MAREA.vipGate[1]);
        vipRope(vip[0], MAREA.vipGate[3], vip[0], vip[3]);
        vipRope(vip[0], vip[3], vip[2], vip[3]);
        // The VIP gate rope: drawn across the gap while the player has no band.
        const vipGateRope = clubSlab(clubLive, vip[0] - 0.4, MAREA.vipGate[1], vip[0] + 0.4, MAREA.vipGate[3], 6.4, 7.2, M.velvet);

        /* ---- daybeds, cabanas, sunbeds ---- */
        function daybed(r, height = 4.2) {
          clubSlab(clubGroup, r[0], r[1], r[2], r[3], 0, height - 1.6, M.teak);
          clubSlab(clubGroup, r[0] + 0.5, r[1] + 0.5, r[2] - 0.5, r[3] - 0.5, height - 1.6, height, M.cushion);
          clubSlab(clubGroup, r[0] + 1, r[1] + 1, r[0] + 5, r[3] - 1, height, height + 1.6, M.teal);
        }
        for (const r of MAREA.daybeds) daybed(r);
        for (const r of MAREA.southDaybeds) daybed(r);
        for (const r of MAREA.cabanas) {
          clubSlab(clubGroup, r[0], r[1], r[2], r[3], 0, 0.8, M.deck);
          daybed([r[0] + 6, r[1] + 3, r[2] - 4, r[1] + 13]);
          clubCyl(clubGroup, r[2] - 4, r[1] + 19, 0, 2.6, 3, M.teal, 12);
          for (const [u, v] of [
            [r[0] + 1, r[1] + 1],
            [r[2] - 1, r[1] + 1],
            [r[0] + 1, r[3] - 1],
            [r[2] - 1, r[3] - 1],
          ])
            clubCyl(clubGroup, u, v, 0, 20, 0.6, M.teak);
          // Curtains on the back and a canvas roof that fades with the sails.
          clubSlab(clubGroup, r[0] + 0.5, r[1] + 1, r[0] + 1.2, r[3] - 1, 1, 19, M.cushion);
          clubSlab(clubLive, r[0], r[1], r[2], r[3], 20, 20.8, sailMaterial);
        }
        const parasolRibs = new Three.ConeGeometry(13, 5, 10, 1);
        for (const s of MAREA.sunbeds) {
          clubSlab(clubGroup, s.u, s.v - 4, s.u + 20, s.v + 4, 0, 1.6, M.teak);
          clubSlab(clubGroup, s.u + 0.5, s.v - 3.5, s.u + 19.5, s.v + 3.5, 1.6, 2.6, M.cushion);
          clubSlab(clubGroup, s.u + 0.5, s.v - 3.5, s.u + 4, s.v + 3.5, 2.6, 3.6, M.cushion);
          clubCyl(clubGroup, s.u + 10, s.v - 9, 0, 16, 0.45, M.teak);
          mesh(parasolRibs, M.thatch, clubGroup, MX + s.u + 10, 18, MY + s.v - 9);
        }

        /* ---- the pool ---- */
        const P = MAREA.pool,
          W = MAREA.poolWater;
        clubSlab(clubGroup, P[0], P[1], P[2], W[1], 0, 1.6, M.coping);
        clubSlab(clubGroup, P[0], W[1], W[0], W[3], 0, 1.6, M.coping);
        clubSlab(clubGroup, W[2], W[1], P[2], W[3], 0, 1.6, M.coping);
        // The infinity edge: the south lip sits flush with the water, a dark slot below.
        clubSlab(clubGroup, P[0], W[3], P[2], P[3], 0, 1.05, M.coping);
        clubSlab(clubGroup, W[0], W[3] + 0.5, W[2], W[3] + 2.5, 0.9, 1.1, M.stage);
        const poolFloorMaterial = new Three.MeshStandardMaterial({ map: mosaicTexture, emissiveMap: mosaicTexture, emissive: '#39d8ff', emissiveIntensity: 0, roughness: 0.4 });
        const poolFloor = clubPlane(W[0], W[1], W[2], W[3], 0.45, poolFloorMaterial, 42);
        poolFloor.parent.remove(poolFloor);
        clubLive.add(poolFloor);
        const rippleTexture = clubTexture(128, 128, (g, w, h) => {
          const img = g.createImageData(w, h);
          const f = (x, y) => Math.sin((x / w) * TAU * 3 + Math.sin((y / h) * TAU * 2) * 1.5) + Math.sin((y / h) * TAU * 4 + Math.cos((x / w) * TAU * 2) * 1.2);
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const dx = f(x + 1, y) - f(x - 1, y),
                dy = f(x, y + 1) - f(x, y - 1),
                i = (y * w + x) * 4;
              img.data[i] = 128 + dx * 40;
              img.data[i + 1] = 128 + dy * 40;
              img.data[i + 2] = 255;
              img.data[i + 3] = 255;
            }
          g.putImageData(img, 0, 0);
        });
        rippleTexture.colorSpace = Three.NoColorSpace;
        rippleTexture.wrapS = rippleTexture.wrapT = Three.RepeatWrapping;
        rippleTexture.repeat.set(5, 1);
        const waterMaterial = new Three.MeshStandardMaterial({
          color: '#5fd6e2',
          roughness: 0.06,
          metalness: 0.1,
          transparent: true,
          opacity: 0.5,
          normalMap: rippleTexture,
          normalScale: new Three.Vector2(0.35, 0.35),
          emissive: '#1fb8d8',
          emissiveIntensity: 0,
          depthWrite: false,
        });
        const water = clubPlane(W[0], W[1], W[2], W[3], 1.0, waterMaterial);
        water.parent.remove(water);
        water.receiveShadow = false;
        water.renderOrder = 4;
        clubLive.add(water);
        for (let u = W[0] + 20; u < W[2] - 10; u += 40)
          for (const v of [W[1] + 1.5, W[3] - 1.5]) kitLight(clubLights, scene, MX + u, 0.9, MY + v, '#7ff4ff');

        /* ---- the sunken fire lounge ---- */
        const L = MAREA.lounge;
        const loungeFloor = mesh(new Three.CylinderGeometry(L.r, L.r, 0.4, 36), M.stage, clubGroup, MX + L.u, 0.3, MY + L.v);
        loungeFloor.castShadow = false;
        mesh(new Three.CylinderGeometry(L.r + 1.5, L.r + 1.5, 1.6, 36, 1, true), M.coping, clubGroup, MX + L.u, 0.8, MY + L.v);
        const seat = new Three.RingGeometry(L.r - 9, L.r - 1, 36);
        seat.rotateX(-Math.PI / 2);
        mesh(seat, M.cushion, clubGroup, MX + L.u, 2.3, MY + L.v);
        mesh(new Three.CylinderGeometry(L.r - 1, L.r - 1, 6, 36, 1, true), M.teal, clubGroup, MX + L.u, 3, MY + L.v);
        clubCyl(clubGroup, L.u, L.v, 0, 2.4, 5, M.render, 18);
        // Flames: the fire pit and the tiki torches round the deck.
        const torches = [
          [L.u, L.v, 2.4, 1.6],
          [60, 206, 8, 1],
          [320, 206, 8, 1],
          [60, 282, 8, 1],
          [180, 292, 8, 1],
          [260, 292, 8, 1],
          [330, 282, 8, 1],
          [150, 346, 8, 1],
          [290, 346, 8, 1],
        ];
        for (const [u, v, h, big] of torches) {
          if (big === 1) {
            clubCyl(clubGroup, u, v, 0, h, 0.5, M.teak);
            clubCyl(clubGroup, u, v, h - 1, h + 0.4, 0.9, M.metal);
          }
          kitLight(clubLights, scene, MX + u, h + 3, MY + v, '#ff9a3a');
        }
        const flameGeo = new Three.ConeGeometry(1, 1, 7, 1);
        flameGeo.translate(0, 0.5, 0);
        const flames = new Three.InstancedMesh(
          flameGeo,
          new Three.MeshBasicMaterial({ color: '#ffa640', toneMapped: false, transparent: true, opacity: 0.9, blending: Three.AdditiveBlending, depthWrite: false }),
          torches.length * 2,
        );
        flames.frustumCulled = false;
        clubLive.add(flames);

        /* ---- palms, uplights and string lights ---- */
        for (const [u, v] of MAREA.palms) {
          makePalm(MX + u, MY + v, 0.95 + ((u * 13 + v * 7) % 10) / 40);
          kitLight(clubLights, scene, MX + u + 2, 1.5, MY + v + 3, v > 40 ? '#ff6ad0' : '#ffd08a');
        }
        // Festoons: warm bulbs on catenaries across the deck.
        const festoon = (a, c, n, droop) => {
          for (let k = 1; k < n; k++) {
            const s = k / n,
              y = a[2] + (c[2] - a[2]) * s - droop * Math.sin(Math.PI * s);
            kitLight(clubLights, scene, MX + a[0] + (c[0] - a[0]) * s, y, MY + a[1] + (c[1] - a[1]) * s, '#ffd28a');
          }
        };
        festoon([20, 204, 26], [340, 194, 26], 26, 5);
        festoon([50, 292, 22], [330, 292, 22], 22, 4);
        festoon([20, 204, 26], [50, 292, 22], 8, 3);
        festoon([340, 194, 26], [392, 290, 22], 9, 3);
        for (let u = 132; u < 290; u += 26) kitLight(clubLights, scene, MX + u, 10, MY + 94, '#ff4fb8');
        neonSigns.push({ sprite: halo(clubHalos, 188, 12, 244, 150, '#40e0ff'), base: 0.35 });
        neonSigns.push({ sprite: halo(clubHalos, 206, 12, 140, 150, '#b84fff'), base: 0.3 });
        neonSigns.push({ sprite: halo(clubHalos, 60, 10, 150, 80, '#ffb45a'), base: 0.35 });
        kitLightCloud(clubLights, 7);

        /**
         * THE SHOW
         */
        const PALETTE = ['#ff2fa8', '#27e3ff', '#9b4dff', '#ffb43a', '#30ff9a', '#ff4a3a'].map((c) => new Three.Color(c));
        // Palette by bar number; bars count from just below zero when a set starts.
        const hue = (n) => PALETTE[((n % PALETTE.length) + PALETTE.length) % PALETTE.length];
        const scratchColor = new Three.Color(),
          clubMatrix = new Three.Matrix4(),
          clubQuat = new Three.Quaternion(),
          clubDown = new Three.Vector3(0, -1, 0),
          clubX = new Three.Vector3(1, 0, 0),
          clubDir = new Three.Vector3(),
          clubPos = new Three.Vector3(),
          clubScale = new Three.Vector3(),
          clubZero = new Three.Matrix4().makeScale(0, 0, 0);
        let clubLastTime = 0,
          screenClock = 0,
          clubWasShowing = true,
          sailFade = 1;
        const hashN = (n) => {
          const x = Math.sin(n * 91.7 + 13.3) * 43758.5453;
          return x - Math.floor(x);
        };
        function drawScreen(showing, g) {
          const c = screenCanvas.getContext('2d'),
            w = screenCanvas.width,
            h = screenCanvas.height;
          if (!showing) {
            // Day: the sea, slow waves and the logo.
            const grad = c.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#7fd3e8');
            grad.addColorStop(0.55, '#2f9fc4');
            grad.addColorStop(1, '#0f4f7a');
            c.fillStyle = grad;
            c.fillRect(0, 0, w, h);
            c.strokeStyle = 'rgba(255,255,255,0.35)';
            c.lineWidth = 2;
            for (let k = 0; k < 4; k++) {
              c.beginPath();
              for (let x = 0; x <= w; x += 8) c.lineTo(x, 50 + k * 12 + Math.sin(x / 20 + gameTime * 0.8 + k) * 3);
              c.stroke();
            }
            c.fillStyle = '#ffffff';
            c.font = 'italic 700 34px Georgia, serif';
            c.textAlign = 'center';
            c.fillText('Marea', w / 2, 38);
            return;
          }
          const col = hue(Math.floor(g.bar / 2)),
            col2 = hue(Math.floor(g.bar / 2) + 2);
          c.fillStyle = '#05040a';
          c.fillRect(0, 0, w, h);
          const on = Math.max(0, Math.cos(g.beat * TAU)),
            bars = 24;
          for (let i = 0; i < bars; i++) {
            const level = (0.25 + 0.75 * hashN(i * 7 + Math.floor(g.beat * 4))) * (0.35 + on * 0.65) * (0.3 + g.energy * 0.7),
              bh = level * (h - 10);
            const grad = c.createLinearGradient(0, h, 0, h - bh);
            grad.addColorStop(0, '#' + col.getHexString());
            grad.addColorStop(1, '#' + col2.getHexString());
            c.fillStyle = grad;
            c.fillRect(4 + i * (w - 8) / bars, h - bh, (w - 8) / bars - 3, bh);
          }
          c.globalAlpha = 0.85;
          c.fillStyle = '#ffffff';
          c.font = 'italic 700 30px Georgia, serif';
          c.textAlign = 'center';
          c.fillText(g.section === 'break' ? 'M A R E A' : 'Marea', w / 2, 34 + on * 3);
          c.globalAlpha = 1;
        }
        /* Per frame, from updateBeachVisuals (beach3d.js). */
        function updateBeachClubVisuals() {
          const dt = clamp(gameTime - clubLastTime, 0, 0.1);
          clubLastTime = gameTime;
          const near = Math.abs(viewCenter.x - (MX + 200)) < viewReach + 450 && Math.abs(viewCenter.y - (MY + 150)) < viewReach + 450;
          clubLive.visible = near;
          if (!near) return;
          const night = nightAmount,
            g = mareaGroove,
            spooked = gameTime < marea.spookedUntil,
            show = !spooked && g.set === 'night' && night > 0.2,
            dusk = !spooked && g.set === 'sunset' && night > 0.1,
            e = g.energy,
            ph = g.beat * TAU,
            on = Math.max(0, Math.cos(ph)),
            bar = g.bar,
            section = g.section,
            drop = section === 'drop',
            sinceDrop = gameTime - g.dropAt;
          // LEDs follow the night; the booth strips pulse on the beat.
          for (const l of clubLeds) l.m.color.copy(l.color).multiplyScalar(l.day + (1 - l.day) * night * (spooked ? 0.6 : 1));
          if (show) LED.magenta.color.copy(hue(Math.floor(bar / 4))).multiplyScalar(0.35 + on * 0.65);
          signMaterial.opacity = 0.45 + night * 0.55;
          pylonMaterial.color.setScalar(0.35 + night * 0.65);
          screenMaterial.color.setScalar(show ? 1 : 0.45 + 0.5 * (1 - night));
          M.bottle.emissiveIntensity = night * 0.8;
        floorMaterial.color.copy(floorDay).lerp(floorNight, clamp(night * 1.4, 0, 1));
          // Pool: gently moving ripples, glowing at night.
          rippleTexture.offset.set(gameTime * 0.012, gameTime * 0.007);
          poolFloorMaterial.emissiveIntensity = night * (0.55 + Math.sin(gameTime * 1.3) * 0.05);
          waterMaterial.emissiveIntensity = night * 0.35;
          // Sails fade while the player is inside so nobody under them is hidden.
          const inside = mareaInside(player.x, player.y) && !isAircraft(player.car);
          sailFade += ((inside ? 0.1 : 1) - sailFade) * Math.min(1, dt * 4);
          sailMaterial.opacity = sailFade;
          sailMaterial.depthWrite = sailFade > 0.9;
          vipGateRope.visible = !marea.vip;
          // Flames flicker.
          torches.forEach(([u, v, h, big], i) => {
            for (let k = 0; k < 2; k++) {
              const f = 0.75 + 0.25 * Math.sin(gameTime * (11 + k * 5) + i * 1.7 + k),
                lit = night > 0.08 || big > 1;
              if (!lit) {
                flames.setMatrixAt(i * 2 + k, clubZero);
                continue;
              }
              clubScale.set(big * (1.3 - k * 0.5), big * (4.2 - k * 1.6) * f, big * (1.3 - k * 0.5));
              clubPos.set(MX + u + Math.sin(gameTime * 7 + i) * 0.2, h, MY + v);
              clubQuat.identity();
              flames.setMatrixAt(i * 2 + k, clubMatrix.compose(clubPos, clubQuat, clubScale));
            }
          });
          flames.instanceMatrix.needsUpdate = true;
          // The LED wall redraws about ten times a second.
          screenClock -= dt;
          if (screenClock <= 0) {
            screenClock = 0.1;
            drawScreen(show || dusk, g);
            screenTexture.needsUpdate = true;
          }
          const showing = show || dusk;
          tiles.visible = spots.visible = beams.visible = showing;
          lasers.visible = show && section !== 'break';
          strobe.visible = show;
          if (!showing) {
            if (clubWasShowing) strobe.material.opacity = 0;
            clubWasShowing = false;
            return;
          }
          clubWasShowing = true;
          // LED floor: a pattern per bar, palette per two bars.
          const pattern = section === 'break' ? 4 : dusk ? 5 : bar % 4,
            colA = hue(Math.floor(bar / 2)),
            colB = hue(Math.floor(bar / 2) + 3),
            level = dusk ? 0.35 : 0.3 + e * 0.7;
          for (let j = 0; j < tileRows; j++)
            for (let i = 0; i < tileCols; i++) {
              const cx = (i - (tileCols - 1) / 2) / tileCols,
                cy = j / tileRows,
                beatFrac = g.beat % 1;
              let k = 0,
                useB = false;
              if (pattern === 0) {
                const r = Math.hypot(cx * 1.8, cy);
                k = Math.max(0, 1 - Math.abs(r - beatFrac * 1.4) * 5);
              } else if (pattern === 1) {
                k = (i + j + Math.floor(g.beat)) % 2 ? 0.9 : 0.12;
                useB = (i + j) % 2 === 0;
              } else if (pattern === 2) {
                k = 0.5 + 0.5 * Math.sin(i * 0.8 - g.beat * Math.PI);
                useB = j % 2 === 1;
              } else if (pattern === 3) k = hashN(i * 31 + j * 17 + Math.floor(g.beat * 4)) > 0.6 ? 1 : 0.06;
              else if (pattern === 4) k = 0.25 + 0.2 * Math.sin(gameTime * 1.5 + i * 0.4 + j * 0.3);
              else k = 0.3 + 0.25 * Math.sin(gameTime * 0.9 + i * 0.35 - j * 0.2);
              if (drop && sinceDrop < 0.4) k = 1;
              scratchColor.copy(useB ? colB : colA).multiplyScalar(k * level * night);
              tiles.setColorAt(j * tileCols + i, scratchColor);
            }
          tiles.instanceColor.needsUpdate = true;
          // Moving heads and their floor spots.
          const speed = section === 'build' ? 2 : drop ? 1 : 0.5;
          heads.forEach((hd, i) => {
            const sweep = g.beat * speed * Math.PI * 0.25 + i * 0.9,
              pointUp = section === 'break',
              tu = pointUp ? hd.u + Math.sin(sweep) * 30 : 206 + Math.sin(sweep) * 70,
              tv = pointUp ? hd.v + (hd.v < 140 ? -40 : 40) : 140 + Math.cos(sweep * 0.7 + i) * 36,
              ty = pointUp ? 140 : 0.6;
            clubPos.set(MX + hd.u, hd.y, MY + hd.v);
            clubDir.set(MX + tu - clubPos.x, ty - hd.y, MY + tv - clubPos.z);
            const len = clubDir.length();
            clubDir.normalize();
            clubQuat.setFromUnitVectors(clubDown, clubDir);
            const width = pointUp ? 5 : drop ? 9 : 7;
            clubScale.set(width, len, width);
            beams.setMatrixAt(i, clubMatrix.compose(clubPos, clubQuat, clubScale));
            const strobeOff = (drop || section === 'build') && hashN(i + Math.floor(g.beat * 4) * 13) < 0.25;
            scratchColor.copy(hue(i + Math.floor(bar / 2))).multiplyScalar(strobeOff ? 0 : dusk ? 0.35 : 0.5 + e * 0.5);
            beams.setColorAt(i, scratchColor);
            if (pointUp) spots.setMatrixAt(i, clubZero);
            else {
              clubQuat.identity();
              clubPos.set(MX + tu, 0.7, MY + tv);
              clubScale.set(width * 2.6, 1, width * 2.6);
              spots.setMatrixAt(i, clubMatrix.compose(clubPos, clubQuat, clubScale));
            }
            spots.setColorAt(i, scratchColor);
          });
          // Two searchlights sweep the sky from the corners at night.
          [
            [30, 60],
            [370, 60],
          ].forEach(([u, v], k) => {
            const i = heads.length + k,
              a = gameTime * 0.35 + k * Math.PI;
            if (!show) {
              beams.setMatrixAt(i, clubZero);
              return;
            }
            clubPos.set(MX + u, 17, MY + v);
            clubDir.set(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35 - 0.15).normalize();
            clubQuat.setFromUnitVectors(clubDown, clubDir);
            clubScale.set(22, 520, 22);
            beams.setMatrixAt(i, clubMatrix.compose(clubPos, clubQuat, clubScale));
            beams.setColorAt(i, scratchColor.set('#b8d8ff').multiplyScalar(0.45));
          });
          beams.instanceMatrix.needsUpdate = true;
          beams.instanceColor.needsUpdate = true;
          spots.instanceMatrix.needsUpdate = true;
          spots.instanceColor.needsUpdate = true;
          beamMaterial.opacity = dusk ? 0.1 : 0.14 + e * 0.12;
          // Lasers fan out from the booth over the floor.
          if (lasers.visible) {
            const fan = drop ? 1.1 : 0.7,
              laserCol = PALETTE[drop ? 4 : 1],
              blink = drop ? (Math.floor(g.beat * 2) % 2 ? 1 : 0.4) : 1;
            for (let i = 0; i < LASERS; i++) {
              const s = i / (LASERS - 1) - 0.5,
                a = Math.PI / 2 + s * fan * 2 + Math.sin(g.beat * Math.PI * 0.5) * 0.35,
                tilt = -0.13 - 0.03 * Math.sin(g.beat * Math.PI + i);
              clubPos.set(MX + 200, 16, MY + 84);
              clubDir.set(Math.cos(a), tilt, Math.sin(a)).normalize();
              clubQuat.setFromUnitVectors(clubX, clubDir);
              clubScale.set(104, 0.28, 0.28);
              lasers.setMatrixAt(i, clubMatrix.compose(clubPos, clubQuat, clubScale));
              lasers.setColorAt(i, scratchColor.copy(i % 3 === 0 ? hue(Math.floor(bar / 4) + 1) : laserCol).multiplyScalar(blink));
            }
            lasers.instanceMatrix.needsUpdate = true;
            lasers.instanceColor.needsUpdate = true;
          }
          // Strobe: the last bar of the build and the first moments of the drop.
          const barInCycle = bar % 32,
            sixteenth = Math.floor(g.beat * 4),
            strobeOn = (section === 'build' && barInCycle === 27 && sixteenth % 2 === 0) || (drop && sinceDrop < 1.2 && sixteenth % 2 === 0);
          strobe.material.opacity = strobeOn ? 0.22 * night : 0;
        }
        return updateBeachClubVisuals;
