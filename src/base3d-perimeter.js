      // Fort Sentinel perimeter: double fence, razor wire, towers, CCTV, signs, searchlights and gate parts.
      {
        const X0 = MILITARY.x,
          Y0 = MILITARY.y,
          X1 = MILITARY.x + MILITARY.w,
          Y1 = MILITARY.y + MILITARY.h,
          f = SENTINEL.fence,
          gate = SENTINEL.gate;
        // One fence run: posts, fabric, top rail, outrigger arms, strands and a coil.
        const fenceRun = (ax, az, bx, bz, outX, outZ, screen) => {
          const length = Math.hypot(bx - ax, bz - az),
            n = Math.max(1, Math.round(length / 26));
          strip(baseGroup, ax, az, bx, bz, 0.5, 13, B.fence, 6);
          if (screen) strip(baseGroup, ax + outX * 0.6, az + outZ * 0.6, bx + outX * 0.6, bz + outZ * 0.6, 0.5, 10, B.screen, 20);
          for (let i = 0; i <= n; i++) {
            const x = ax + ((bx - ax) * i) / n,
              z = az + ((bz - az) * i) / n;
            box(baseGroup, x, 7.5, z, 1.3, 15, 1.3, B.galv);
            rodTo(baseGroup, x, 14.5, z, x + outX * 4, 18, z + outZ * 4, 0.3, B.galv);
          }
          strip(baseGroup, ax, az, bx, bz, 13.2, 0.8, B.galv, 100);
          for (const k of [1.6, 2.8, 4])
            box(baseGroup, (ax + bx) / 2 + outX * k, 15.2 + k * 0.7, (az + bz) / 2 + outZ * k, Math.abs(bx - ax) + 0.3, 0.25, Math.abs(bz - az) + 0.3, B.galv);
          coil(baseGroup, ax, az, bx, bz, 16.5, 2.4);
        };
        const side = (ax, az, bx, bz, nx, nz, skip) => {
          // Outer fence on the line, inner fence `f` inside it, skipping the gate.
          for (const [o, screen] of [
            [1, true],
            [f - 1, false],
          ]) {
            const x0 = ax + nx * o,
              z0 = az + nz * o,
              x1 = bx + nx * o,
              z1 = bz + nz * o;
            if (skip) {
              fenceRun(x0, z0, x0, skip[0], -nx, -nz, screen);
              fenceRun(x0, skip[1], x1, z1, -nx, -nz, screen);
            } else fenceRun(x0, z0, x1, z1, -nx, -nz, screen);
          }
        };
        side(X0, Y0, X1, Y0, 0, 1);
        side(X0, Y1, X1, Y1, 0, -1);
        side(X1, Y0, X1, Y1, -1, 0);
        side(X0, Y0, X0, Y1, 1, 0, gate.opening);
        // Gate posts either side of the opening and on the centre fence stub.
        for (const z of [gate.opening[0] - 3, gate.lanes[0].y1 + 2, gate.lanes[1].y0 - 2, gate.opening[1] + 3]) {
          box(baseGroup, X0 + 1, 11, z, 4, 22, 4, B.steel);
          box(baseGroup, X0 + f - 1, 11, z, 4, 22, 4, B.steel);
          box(baseGroup, X0 + f / 2, 21, z, f, 2, 2, B.steel);
        }
        // Warning signs along the outer fence, facing out.
        const warn = plateMaterial(['USE OF DEADLY FORCE', 'AUTHORIZED'], { header: 'RESTRICTED AREA', bg: '#f1eee4', fg: '#1d1f22' });
        const keepOut = plateMaterial(['MILITARY INSTALLATION', 'NO TRESPASSING'], { header: 'WARNING', bg: '#f1eee4', fg: '#1d1f22', headerBg: '#c9392d' });
        let k = 0;
        for (let x = X0 + 150; x < X1 - 60; x += 240) {
          plate(baseGroup, x, 8, Y1 + 0.2, 26, 13, k++ % 2 ? keepOut : warn, 0);
          plate(baseGroup, x, 8, Y0 - 0.2, 26, 13, k % 2 ? keepOut : warn, Math.PI);
        }
        for (let z = Y0 + 150; z < Y1 - 60; z += 240) {
          plate(baseGroup, X1 + 0.2, 8, z, 26, 13, k++ % 2 ? keepOut : warn, Math.PI / 2);
          if (z < gate.opening[0] - 60 || z > gate.opening[1] + 60) plate(baseGroup, X0 - 0.2, 8, z, 26, 13, k % 2 ? keepOut : warn, -Math.PI / 2);
        }
        // CCTV poles.
        for (const [x, z] of SENTINEL.cctv) {
          box(baseGroup, x, 11, z, 1.4, 22, 1.4, B.oliveDark);
          const out = x < X0 + 60 ? -1 : x > X1 - 60 ? 1 : 0,
            outZ = out ? 0 : z < Y0 + 60 ? -1 : 1,
            hx = x + out * 3,
            hz = z + outZ * 3;
          box(baseGroup, hx, 21.5, hz, out ? 6 : 2.6, 2.4, out ? 2.6 : 6, B.cream);
          box(baseGroup, hx + out * 3.2, 21.5, hz + outZ * 3.2, out ? 0.4 : 1.6, 1.6, out ? 1.6 : 0.4, B.black);
          box(baseGroup, x, 16, z, 2.4, 3.4, 2.4, B.oliveDark);
        }
      }
      // Watch towers, each with a searchlight that sweeps at night.
      const searchlights = [];
      for (const [i, t] of SENTINEL.towers.entries()) {
        const x = t.x,
          z = t.y,
          floor = SENTINEL.towerFloor - 2;
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) rodTo(baseGroup, x + sx * 13, 0, z + sz * 13, x + sx * 10, floor, z + sz * 10, 0.9, B.steel);
        for (const lv of [0, 1]) {
          const y0 = lv * floor * 0.5,
            y1 = y0 + floor * 0.5,
            r0 = 13 - lv * 1.5,
            r1 = 11.5 - lv * 1.5;
          for (const s of [-1, 1]) {
            rodTo(baseGroup, x - r0, y0, z + s * r0, x + r1, y1, z + s * r1, 0.35, B.steel);
            rodTo(baseGroup, x + s * r0, y0, z - r0, x + s * r1, y1, z + r1, 0.35, B.steel);
          }
        }
        box(baseGroup, x, floor, z, 28, 1.6, 28, B.oliveDark);
        // Armoured lower cab, glazing, corner posts, roof.
        for (const [dx, dz, w, d] of [
          [0, -12.5, 26, 1],
          [0, 12.5, 26, 1],
          [-12.5, 0, 1, 26],
          [12.5, 0, 1, 26],
        ]) {
          box(baseGroup, x + dx, floor + 4, z + dz, w, 7, d, B.olive);
          box(baseGroup, x + dx, floor + 10, z + dz, w * 0.96, 5, d * 0.96, B.window);
        }
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(baseGroup, x + sx * 12.5, floor + 7, z + sz * 12.5, 1.4, 14, 1.4, B.oliveDark);
        box(baseGroup, x, floor + 14.5, z, 32, 1.4, 32, B.roofGreen);
        box(baseGroup, x, floor + 15.6, z, 20, 1, 20, B.roofGreen);
        // Ladder up one leg.
        for (let y = 2; y < floor; y += 3) box(baseGroup, x + 14, y, z + 4, 0.4, 0.4, 5, B.steel);
        rodTo(baseGroup, x + 14, 0, z + 1.5, x + 12, floor, z + 1.5, 0.3, B.steel);
        rodTo(baseGroup, x + 14, 0, z + 6.5, x + 12, floor, z + 6.5, 0.3, B.steel);
        // Sandbags round the tower foot.
        for (let a = 0; a < 8; a++) box(baseGroup, x + Math.cos((a * TAU) / 8) * 17, 1.4, z + Math.sin((a * TAU) / 8) * 17, 7, 2.8, 4, B.sandbag);
        // Searchlight (moves), beam and ground spot (added by the night pass).
        const head = new Three.Group();
        head.position.set(x, floor + 17.5, z);
        baseDynamic.add(head);
        box(head, 0, 0, 0, 2.5, 2, 2.5, B.oliveDark);
        const lampBody = new Three.Group();
        lampBody.position.set(0, 2.5, 0);
        head.add(lampBody);
        mesh(cylinderGeo, B.oliveDark, lampBody, 1.5, 0, 0, 2.6, 5, 2.6).rotation.z = Math.PI / 2;
        const lens = mesh(cylinderGeo, B.lamp, lampBody, 4.1, 0, 0, 2.3, 0.3, 2.3);
        lens.rotation.z = Math.PI / 2;
        lens.castShadow = false;
        // Light shaft and ground pool (searchlight3d.js), placed by the night pass.
        const beam = createSearchBeam('#fff1d6'),
          spot = createSearchPool('#fff0c8');
        const beamHalo = baseHalo(x, floor + 20, z, 26, '#fff4d8');
        searchlights.push({ tower: t, head, lampBody, beam, spot, halo: beamHalo, phase: i * 1.7, aim: t.a, target: null });
      }
      // ---- Main gate -------------------------------------------------------------------
      const gateParts = [];
      {
        const g = SENTINEL.gate,
          grp = new Three.Group();
        baseGroup.add(grp);
        // Island kerb with striped nose.
        box(grp, g.island.x + g.island.w / 2, 1.6, 8150, g.island.w, 3.2, g.island.h, B.concreteLight);
        for (let k = 0; k < 6; k++) box(grp, g.island.x + 2 + k * 4, 1.7, 8150, 2, 3.3, g.island.h + 0.2, k % 2 ? B.black : B.yellow);
        // Booth: armoured base, glazing, overhanging roof, door and desk.
        const bx = g.booth.x + g.booth.w / 2,
          bz = g.booth.y + g.booth.h / 2;
        box(grp, bx, 4.5, bz, g.booth.w, 9, g.booth.h, B.cream);
        for (const [dx, dz, w, d] of [
          [0, -g.booth.h / 2, g.booth.w, 0.6],
          [0, g.booth.h / 2, g.booth.w, 0.6],
          [-g.booth.w / 2, 0, 0.6, g.booth.h],
          [g.booth.w / 2, 0, 0.6, g.booth.h],
        ])
          box(grp, bx + dx, 14, bz + dz, w, 9, d, B.window);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(grp, bx + sx * g.booth.w * 0.5, 14, bz + sz * g.booth.h * 0.5, 1.4, 9, 1.4, B.cream);
        box(grp, bx, 19.5, bz, g.booth.w + 8, 2, g.booth.h + 8, B.roofGreen);
        box(grp, bx, 21.5, bz, 10, 3, 6, B.steel);
        box(grp, bx + 12, 5, bz + g.booth.h / 2 + 0.3, 7, 10, 0.4, B.oliveDark);
        plate(grp, bx, 16.5, bz + g.booth.h / 2 + 0.8, 18, 4.5, plateMaterial('MILITARY POLICE', { bg: '#182338', fg: '#f0e6c8' }), 0);
        // Canopy over both lanes: an open steel frame (a solid roof would hide the
        // booth and barriers from the camera), with light bars under the beams.
        const cp = g.canopy,
          ccx = (cp.x0 + cp.x1) / 2,
          ccz = (cp.y0 + cp.y1) / 2;
        for (const x of [cp.x0 + 6, cp.x1 - 6])
          for (const z of [cp.y0 + 4, 8150, cp.y1 - 4]) box(grp, x, cp.height / 2, z, 3.5, cp.height, 3.5, B.white);
        for (const x of [cp.x0 + 1.5, cp.x1 - 1.5]) box(grp, x, cp.height + 2, ccz, 3, 4, cp.y1 - cp.y0, B.olive);
        for (const z of [cp.y0 + 1.5, cp.y1 - 1.5]) box(grp, ccx, cp.height + 2, z, cp.x1 - cp.x0, 4, 3, B.olive);
        for (let z = cp.y0 + 20; z < cp.y1 - 10; z += 20) box(grp, ccx, cp.height + 1, z, cp.x1 - cp.x0 - 2, 2, 1.6, B.white);
        box(grp, ccx, cp.height + 1, 8150, cp.x1 - cp.x0 - 2, 2.4, 3, B.white);
        plate(grp, cp.x0 - 1.2, cp.height + 3, 8150, 150, 6, plateMaterial('FORT SENTINEL · MAIN GATE · ALL VEHICLES SUBJECT TO SEARCH', { w: 1024, h: 48, bg: '#2b3527', fg: '#efe3c0' }), -Math.PI / 2);
        plate(grp, ccx, cp.height + 3, cp.y1 + 1.3, cp.x1 - cp.x0 - 6, 5, plateMaterial('FORT SENTINEL · MAIN GATE', { w: 512, h: 32, bg: '#2b3527', fg: '#efe3c0' }), 0);
        for (const lane of g.lanes) {
          const lz = (lane.y0 + lane.y1) / 2;
          for (const x of [cp.x0 + 20, ccx, cp.x1 - 20]) {
            const l = box(grp, x, cp.height - 0.2, lz, 3, 0.5, 14, B.lamp);
            l.castShadow = false;
          }
          glowPool(ccx, lz, 70, '#fff0d0', 1.2);
          baseHalo(ccx, cp.height - 2, lz, 30, '#fff0d4');
          // Traffic light on the island facing inbound traffic.
        }
        box(grp, g.island.x + 20, 7, 8150, 1.2, 14, 1.2, B.black);
        box(grp, g.island.x + 20, 15, 8150, 2.4, 6, 2.6, B.black);
        const stopLamp = mesh(sphereGeo, B.redLamp, grp, g.island.x + 18.7, 16.5, 8150, 0.9, 0.9, 0.9);
        stopLamp.castShadow = false;
        // Jersey-barrier funnel and median.
        const jersey = (x0, x1, z) => {
          for (let x = x0, k = 0; x < x1 - 4; x += 20, k++) {
            box(grp, x + 9.5, 1.2, z, 19, 2.4, 4.2, B.concreteLight);
            box(grp, x + 9.5, 4.2, z, 18.6, 3.8, 2.4, B.concreteLight);
            for (const s of [-1, 1]) box(grp, x + 9.5, 4.6, z + s * 1.25, 6, 1.2, 0.1, k % 2 ? B.red : B.white);
          }
        };
        jersey(g.funnel.x0, g.funnel.x1, g.opening[0] - 6);
        jersey(g.funnel.x0, g.funnel.x1, g.opening[1] + 6);
        jersey(g.funnel.x0 + 10, g.island.x, 8150);
        // Signs on the approach.
        const warnBig = plateMaterial(['USE OF DEADLY FORCE AUTHORIZED', 'PHOTOGRAPHY PROHIBITED'], { header: 'WARNING · RESTRICTED AREA', bg: '#f3efe4', fg: '#1d1f22', w: 768, h: 256 });
        for (const [x, z] of [
          [9120, 8026],
          [9120, 8282],
        ]) {
          for (const dx of [-15, 15]) box(grp, x + dx, 9, z, 1.3, 18, 1.3, B.galv);
          plate(grp, x, 15, z + 0.9, 36, 12, warnBig, 0);
          box(grp, x, 15, z, 37, 13, 1.2, B.steel);
        }
        const stopSign = plateMaterial(['STOP', 'ID CHECK'], { bg: '#b8322a', fg: '#ffffff', w: 256, h: 256 });
        box(grp, 9186, 6, 8252, 1, 12, 1, B.galv);
        plate(grp, 9186, 12, 8253, 10, 10, stopSign, 0);
        const speed = plateMaterial(['SPEED', 'LIMIT', '10'], { bg: '#f3efe4', fg: '#1d1f22', w: 192, h: 256 });
        box(grp, 9060, 6, 8250, 1, 12, 1, B.galv);
        plate(grp, 9060, 12, 8251, 7.5, 10, speed, 0);
        // The entrance monument: stone wall with the base name and crest.
        const mx = 9150,
          mz = 7996;
        box(grp, mx, 6, mz, 92, 12, 8, B.sandDark);
        box(grp, mx, 12.8, mz, 96, 1.6, 10, B.cream);
        for (const dx of [-50, 50]) box(grp, mx + dx, 8, mz, 10, 16, 10, B.sandDark);
        plate(grp, mx + 6, 6.5, mz + 4.2, 70, 9, plateMaterial(['FORT SENTINEL', 'SOUTH COAST DEFENSE COMMAND'], { bg: '#26321f', fg: '#e3cf97', w: 1024, h: 132 }), 0);
        const crest = mesh(cylinderGeo, B.yellow, grp, mx - 36, 6.5, mz + 4.3, 5.5, 0.6, 5.5);
        crest.rotation.x = Math.PI / 2;
        plate(grp, mx - 36, 6.5, mz + 4.7, 9, 9, B.star, 0);
        for (const dx of [-46, 46]) {
          box(grp, mx + dx, 1, mz + 8, 14, 2, 6, B.earth);
          glowPool(mx + dx, mz + 8, 26, '#ffe0a8', 0.8);
        }
        // Moving pieces per lane: drop arm, bollards, sliding gate.
        for (const [li, lane] of g.lanes.entries()) {
          const dir = lane.out ? -1 : 1,
            edge = lane.out ? lane.y1 : lane.y0,
            span = lane.y1 - lane.y0,
            pedestalZ = edge + (lane.out ? 5 : -5),
            parts = { lane, state: militaryGateState[li] };
          // Drop arm.
          box(grp, g.armX, 4.5, pedestalZ, 5, 9, 5, B.yellow);
          box(grp, g.armX, 9.5, pedestalZ, 4, 1.4, 4, B.black);
          const pivot = new Three.Group();
          pivot.position.set(g.armX, 8.5, pedestalZ);
          baseDynamic.add(pivot);
          const armLength = span + 2;
          for (let k = 0; k < 8; k++) box(pivot, 0, 0, dir * (3 + ((k + 0.5) * armLength) / 8), 1.6, 1.6, armLength / 8, k % 2 ? B.red : B.white);
          box(pivot, 0, 0, -dir * 4, 2.4, 3, 6, B.black);
          const armLamp = mesh(sphereGeo, B.redLamp, pivot, 0, 1.3, dir * (armLength + 1), 0.6, 0.6, 0.6);
          armLamp.castShadow = false;
          parts.pivot = pivot;
          parts.dir = dir;
          const stub = new Three.Group();
          stub.position.set(g.armX, 8.5, pedestalZ);
          stub.visible = false;
          baseDynamic.add(stub);
          box(stub, 0, 0, dir * 8, 1.6, 1.6, 10, B.white);
          for (let k = 0; k < 3; k++) {
            const piece = box(stub, 6 + k * 5, -7.8, dir * (22 + k * 16), 1.6, 1.6, 14, k % 2 ? B.red : B.white);
            piece.rotation.y = 0.4 * (k - 1);
          }
          parts.stub = stub;
          // Bollards (rise out of the road).
          const bollards = new Three.Group();
          bollards.position.set(g.bollardX, 0, 0);
          baseDynamic.add(bollards);
          parts.bollardList = [];
          for (let k = 0; k < 5; k++) {
            const post = new Three.Group();
            post.position.set(0, 0, lane.y0 + 8 + (k * (span - 16)) / 4);
            bollards.add(post);
            cylinder(post, 0, 4.5, 0, 2.3, 9, B.steel, 12);
            cylinder(post, 0, 8.6, 0, 2.35, 1.4, B.yellow, 12);
            parts.bollardList.push(post);
          }
          parts.bollards = bollards;
          // Recess plates in the road.
          box(grp, g.bollardX, 0.5, (lane.y0 + lane.y1) / 2, 7, 0.2, span - 6, B.steel);
          // Sliding palisade gate: slides into the pocket between the fences.
          // Built round its own centre so a burst gate can topple about its foot.
          const slide = new Three.Group(),
            half = span / 2;
          slide.position.set(g.slideX, 0, (lane.y0 + lane.y1) / 2);
          baseDynamic.add(slide);
          box(slide, 0, 2, 0, 3, 1.6, span, B.oliveDark);
          box(slide, 0, 19, 0, 3, 1.6, span, B.oliveDark);
          for (let z = -half + 3; z < half; z += 4.2) {
            box(slide, 0, 11, z, 1, 21, 1.4, B.oliveDark);
            const tip = box(slide, 0, 22, z, 0.6, 2.6, 0.6, B.oliveDark);
            tip.rotation.y = Math.PI / 4;
          }
          rodTo(slide, 0, 2, -half + 2, 0, 19, half - 2, 0.5, B.oliveDark);
          box(slide, 0, 12, 0, 0.2, 6, 18, plateMaterial(['RESTRICTED'], { bg: '#b8322a', fg: '#ffffff', w: 256, h: 64 }));
          parts.slide = slide;
          parts.slideBase = slide.position.clone();
          parts.slideOpenOffset = (lane.out ? -1 : 1) * (span + 6);
          box(grp, g.slideX, 0.5, lane.out ? lane.y0 - span / 2 : lane.y1 + span / 2, 5, 0.3, span + 10, B.steel);
          gateParts.push(parts);
        }
        // Sandbag nests (two inside the gate, two outside) and the other posts.
        for (const n of SENTINEL.nests) {
          const nest = new Three.Group();
          nest.position.set(n.x, 0, n.y);
          nest.rotation.y = -n.a;
          grp.add(nest);
          for (let course = 0; course < 3; course++) {
            const y = 1.3 + course * 2.5,
              off = course % 2 ? 3 : 0;
            for (let z = -9 + off; z <= 9; z += 6) box(nest, 15, y, z, 4, 2.4, 5.6, B.sandbag);
            for (let x = -12 + off; x < 14; x += 6) {
              box(nest, x, y, -10, 5.6, 2.4, 4, B.sandbag);
              box(nest, x, y, 10, 5.6, 2.4, 4, B.sandbag);
            }
          }
          // Machine gun on its tripod.
          rodTo(nest, 10, 0, -3, 12, 8.5, 0, 0.35, B.black);
          rodTo(nest, 10, 0, 3, 12, 8.5, 0, 0.35, B.black);
          rodTo(nest, 15, 0, 0, 12, 8.5, 0, 0.35, B.black);
          box(nest, 13, 9.3, 0, 7, 1.6, 1.4, B.black);
          rodTo(nest, 16, 9.4, 0, 23, 9.4, 0, 0.35, B.black);
          box(nest, 12, 8.6, 1.4, 2, 2, 1.2, B.olive);
          if (n.net) {
            for (const [x, z] of [
              [-14, -13],
              [-14, 13],
              [18, -13],
              [18, 13],
            ])
              box(nest, x, 8, z, 0.8, 16, 0.8, B.wood);
            const net = new Three.Mesh(new Three.PlaneGeometry(40, 34, 4, 4), B.net);
            const p = net.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) p.setZ(i, -Math.abs(p.getX(i)) * 0.12 - Math.abs(p.getY(i)) * 0.1 + 1.5 * Math.sin(i));
            net.geometry.computeVertexNormals();
            net.rotation.x = -Math.PI / 2;
            net.position.set(2, 16.5, 0);
            nest.add(net);
          }
        }
      }
      // ---- Floodlight masts ------------------------------------------------------------
      for (const [x, z] of SENTINEL.floods) {
        box(baseGroup, x, 25, z, 1.8, 50, 1.8, B.galv);
        box(baseGroup, x, 1, z, 5, 2, 5, B.concreteLight);
        box(baseGroup, x, 50, z, 14, 1, 1.4, B.galv);
        for (const dx of [-5.5, -1.8, 1.8, 5.5]) {
          box(baseGroup, x + dx, 48.6, z, 3.2, 2.4, 3, B.oliveDark);
          const lamp = box(baseGroup, x + dx, 47.3, z, 2.6, 0.3, 2.5, B.lamp);
          lamp.castShadow = false;
        }
        baseHalo(x, 48, z, 42, '#fff1d2');
        glowPool(x, z, 150, '#ffe6bb', 0.9);
      }
