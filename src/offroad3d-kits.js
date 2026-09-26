      // Off-road 3D kits: makeOffroadVehicle() and animateOffroadVehicle().
      // ---- Kits ------------------------------------------------------------------------------
      const offroadKits = new Map();
      function offroadKit(type, def, l, w, specW) {
        const key = [type, l, w].join(':');
        if (offroadKits.has(key)) return offroadKits.get(key);
        const S = policeShapeKit(),
          g = def.glass,
          paint = policeSet(),
          trim = policeSet(),
          bright = policeSet(),
          lens = policeSet(),
          anchors = [],
          spares = [],
          swatch = (name) => ({ uv: swatchUv(POLICE_SWATCH[name]) }),
          black = '#141517',
          steel = '#26292d',
          alu = '#b3b8bc',
          topAt = (x) => profileAt(def.profile, x / l)[1],
          halfAt = (x, y) => policeShellAt(def, l, w, x, y).half,
          r = def.wheel.r,
          zWheel = specW / 2 - def.wheel.width / 2 - def.wheel.inset,
          nose = 0.5 * l,
          tail = -0.5 * l,
          kit = {
            shell: policeShellGeometry(def, l, w),
            cabin: def.open ? null : policeCabinGeometry(def, l, w),
            hood: policeSwatchBox(POLICE_SWATCH.hood),
            door: policeSwatchBox(POLICE_SWATCH.door),
            trunk: policeSwatchBox(POLICE_SWATCH.trunk),
            tyre: offroadTyreGeometry(r, def.wheel.width, def.wheel.tread, !!def.wheel.letters),
            rims: [-1, 1].map((side) => offroadRimGeometry(r, def.wheel.width, def.wheel.style, def.wheel.rim, side)),
            zWheel,
            anchors,
            spares,
          };
        const lightPod = (x, y, z, radius, facing = 0) => {
          policeAdd(trim, S.cylinder, x, y, z, radius, 0.9, radius, black, null, 0, 0, Math.PI / 2 + facing);
          policeAdd(lens, S.disc, x + 0.46 * Math.cos(facing), y + 0.46 * Math.sin(facing), z, radius * 0.86, radius * 0.86, 1, '#f4f2e8', null, 0, Math.PI / 2, facing);
          anchors.push({ x: x + 0.8, y, z, size: radius * 7 });
        };
        const lightBar = (x, y, width, z = 0) => {
          policeAdd(trim, roundedBar(width, 1.1, 1.0, 0.3), x, y, z, 1, 1, 1, black);
          policeAdd(lens, boxGeo, x + 0.52, y, z, 0.08, 0.7, width * 0.94, '#f4f2e8');
          for (const t of [-0.3, 0, 0.3]) anchors.push({ x: x + 0.9, y, z: z + t * width, size: width * 0.45 });
        };
        const jerryCan = (x, y, z, color, ry = 0) => {
          policeAdd(trim, roundedBar(0.95, 3.6, 2.6, 0.25), x, y + 1.8, z, 1, 1, 1, color, null, 0, ry, 0);
          policeAdd(trim, boxGeo, x, y + 3.75, z, 0.5, 0.35, 1.3, color, null, 0, ry, 0);
        };
        const roofRack = (x0, x1, y, half) => {
          for (const side of [-1, 1]) kitTube(trim, [x0, y, side * half], [x1, y, side * half], 0.18, black);
          kitTube(trim, [x0, y, -half], [x0, y, half], 0.18, black);
          kitTube(trim, [x1, y, -half], [x1, y, half], 0.18, black);
          for (let x = x0 + 2.2; x < x1 - 1; x += 2.4) policeAdd(trim, boxGeo, x, y - 0.05, 0, 0.5, 0.1, half * 2, '#2b2d30');
          for (const side of [-1, 1])
            for (const x of [x0 + 1, x1 - 1, (x0 + x1) / 2]) kitTube(trim, [x, g.roof + g.arch, side * half * 0.95], [x, y, side * half], 0.12, black);
        };
        const snorkel = (side) => {
          const x0 = g.xf * l + 2.2,
            z = side * (halfAt(g.xf * l, def.h - 1) + 0.45),
            top = g.roof + 1.4;
          kitTube(trim, [x0, def.h - 2.2, z], [x0, def.h + 0.2, z], 0.42, black);
          kitTube(trim, [x0, def.h + 0.2, z], [lerpNumber(g.xf, g.rf, 0.92) * l - 0.3, top, z], 0.42, black);
          policeAdd(trim, roundedBar(1.6, 1.0, 1.2, 0.35), lerpNumber(g.xf, g.rf, 0.92) * l, top + 0.3, z, 1, 1, 1, black);
        };
        const steelBumper = (front, winch, bull) => {
          const x = front ? nose + 0.7 : tail - 0.6,
            y = def.bumpers[front ? 0 : 1][1],
            half = w * 0.5;
          policeAdd(trim, roundedBar(w * 1.0, 1.9, 1.3, 0.2), x, y, 0, 1, 1, 1, steel);
          for (const side of [-1, 1]) policeAdd(trim, boxGeo, x + (front ? 0.3 : -0.3), y - 0.6, side * half * 0.92, 1.2, 1.1, 1.6, steel);
          // D-ring shackles.
          for (const side of [-1, 1]) policeAdd(bright, S.arch, x + (front ? 0.85 : -0.85), y + 0.2, side * half * 0.55, 0.55, 0.55, 3, '#c43a22', null, 0, Math.PI / 2, Math.PI / 2 * (front ? -1 : 1));
          if (winch) {
            policeAdd(trim, S.cylinder, x + 0.4, y + 0.15, 0, 0.8, w * 0.42, 0.8, '#1a1b1d', null, Math.PI / 2, 0, 0);
            policeAdd(trim, S.cylinderLow, x + 0.4, y + 0.15, 0, 0.62, w * 0.3, 0.62, '#3b3f44', null, Math.PI / 2, 0, 0);
            policeAdd(bright, boxGeo, x + 0.85, y + 0.1, 0, 0.3, 0.9, 1.8, alu);
            policeAdd(bright, S.arch, x + 1.35, y - 0.35, 0, 0.45, 0.45, 3, '#c9ccce', null, 0, Math.PI / 2, Math.PI);
          }
          if (bull) {
            const top = topAt(nose - 1) + 0.6;
            for (const side of [-1, 1]) {
              kitTube(trim, [x, y + 0.9, side * w * 0.33], [x - 0.3, top, side * w * 0.3], 0.3, steel);
              kitTube(trim, [x - 0.3, top, side * w * 0.3], [x - 0.4, top, 0], 0.3, steel);
            }
          }
          if (!front) policeAdd(trim, boxGeo, x - 0.6, y - 0.4, 0, 1.2, 0.6, 0.8, steel);
        };
        const rockSliders = () => {
          const x0 = def.wheel.xs[def.wheel.xs.length - 1] * l + r * 1.15,
            x1 = def.wheel.xs[0] * l - r * 1.15,
            y = def.yb + 0.3;
          for (const side of [-1, 1]) {
            const z = side * (halfAt(0, def.yb + 1) + 0.55);
            kitTube(trim, [x0, y, z], [x1, y, z], 0.34, steel);
            for (const x of [x0 + 1, (x0 + x1) / 2, x1 - 1]) kitTube(trim, [x, y, z], [x, y + 0.2, side * (halfAt(0, def.yb + 1) - 0.4)], 0.22, steel);
          }
        };
        const mirrors = (tall = false) => {
          for (const side of [-1, 1]) {
            const mx = g.xf * l - 1.4,
              my = g.base + (tall ? 1.8 : 1.2),
              mz = side * (g.wb * w + 1.3);
            policeAdd(trim, roundedBar(0.5, tall ? 1.8 : 1.2, 1.2, 0.25), mx, my, mz, 1, 1, 1, black);
            policeBeam(trim, boxGeo, [mx + 0.2, my - 0.6, side * g.wb * w], [mx + 0.2, my - 0.4, mz - side * 0.5], 0.3, 0.4, black);
          }
        };
        const handles = (xs) => {
          for (const side of [-1, 1]) for (const hx of xs) policeAdd(trim, boxGeo, hx * l, def.h - 1.2, side * (halfAt(hx * l, def.h - 1.2) + 0.05), 1.1, 0.25, 0.16, black);
        };
        const spareOnBack = (y, facing = -1) => spares.push({ x: tail - 0.3 - def.wheel.width / 2 - 0.4, y, z: 0, ry: facing * Math.PI / 2 });
        // ---- Every truck: arches and flares, wells, sills, grille, plates.
        for (const fx of def.wheel.xs)
          for (const side of [-1, 1]) {
            const x = fx * l,
              half = halfAt(x, r + 1.5),
              reach = zWheel + def.wheel.width / 2 + 0.25 - half;
            policeAdd(trim, S.halfDisc, x, r * 0.98, side * (half + 0.03), r * 1.14, r * 1.14, 1, '#060607', null, 0, side < 0 ? Math.PI : 0, 0);
            if (type === 'crawler') {
              // Tube-style flat fenders on the rock crawler.
              policeAdd(trim, flareGeometry(r, Math.max(1.2, reach)), x, r * 1.02, side * (half + Math.max(1.2, reach) / 2 - 0.3), 1.05, 0.9, 1, black);
            } else if (type !== 'series') policeAdd(trim, flareGeometry(r, Math.max(0.7, reach)), x, r * 0.98, side * (half + Math.max(0.7, reach) / 2 - 0.2), 1, 1, 1, type === 'bronco' ? '#2b7f85' : black);
            else policeAdd(trim, S.arch, x, r * 0.98, side * (half + 0.05), r * 1.16, r * 1.16, 4, '#15161a');
          }
        for (const side of [-1, 1]) policeAdd(trim, boxGeo, 0, def.yb + 0.6, side * (halfAt(0, def.yb + 0.6) + 0.03), l * 0.35, 0.8, 0.12, '#1d1f22');
        policeAdd(trim, boxGeo, tail - 0.1, def.bumpers[1][1] + 1.6, 0, 0.12, 1.2, 2.8, '#dcd6c4');
        // ---- The glasshouse's frame: roof panel, pillars, mirrors (closed bodies).
        if (!def.open) {
          const roofPoint = (s, t, lift = 0.14) => [lerpNumber(g.rb * l - 0.25, g.rf * l + 0.25, t), g.roof + lift + g.arch * (1 - s * s), s * g.wt * w * 1.03];
          const roofGeo = gridGeometry(6, 4, (u, v) => roofPoint(u * 2 - 1, v), (p, out) => out.set(p.x, p.y - 5, 0));
          policeAddMatrix(paint, roofGeo, policeIdentity, '#ffffff', swatch('roof'));
          roofGeo.dispose();
          for (const side of [-1, 1]) {
            const skirt = gridGeometry(6, 1, (u, v) => {
              const p = roofPoint(side, u, 0.14 - (1 - v) * 0.4);
              return [p[0], p[1], p[2] + side * 0.02];
            }, (p, out) => out.set(p.x, p.y, 0));
            policeAddMatrix(paint, skirt, policeIdentity, '#ffffff', swatch('roof'));
            skirt.dispose();
            for (const [s, width, kind] of [[1, 1.05, 'paint'], ...g.pillars]) {
              const set = kind === 'paint' ? paint : trim,
                options = kind === 'paint' ? swatch('pillar') : null,
                shift = s === 1 ? -width * 0.35 : s === 0 ? width * 0.45 : 0,
                points = [0, 0.5, 1].map((t) => {
                  const p = glassPoint(g, l, w, 'side', s, t, side);
                  return [p[0] + shift, p[1], p[2] + side * 0.14];
                });
              for (let k = 0; k < 2; k++) policeBeam(set, boxGeo, points[k], points[k + 1], 0.32, width, kind === 'paint' ? '#ffffff' : '#07080a', options, [0, 0, side]);
            }
            policeBeam(trim, boxGeo, glassPoint(g, l, w, 'side', 0, 0.03, side), glassPoint(g, l, w, 'side', 1, 0.03, side), 0.28, 0.3, '#0b0c0e');
          }
          mirrors(type === 'sixbysix' || type === 'expedition');
        }
        // ---- Per truck.
        if (type === 'series') {
          // Land Rover-style: flat grille panel with the headlamps in it, bonnet
          // spare, exposed hinges, safari double roof and alpine lights, rear ladder.
          policeAdd(trim, boxGeo, nose + 0.05, 7.4, 0, 0.3, 3.6, w * 0.62, '#1a1b1d');
          for (let i = -3; i <= 3; i++) policeAdd(bright, boxGeo, nose + 0.22, 7.4, i * w * 0.07, 0.1, 3.0, 0.22, '#9aa0a4');
          spares.push({ x: 0.36 * l, y: topAt(0.36 * l) + def.wheel.width / 2 + 0.1, z: 0, rx: Math.PI / 2 });
          for (const side of [-1, 1]) {
            for (const hx of [0.2, 0.02, -0.14]) policeAdd(bright, boxGeo, hx * l + 0.3, def.h - 1.6, side * (halfAt(hx * l, def.h - 1.6) + 0.1), 0.8, 0.35, 0.2, '#8b9094');
            // Alpine light windows along the roof edge (the safari roof's hallmark).
            for (let k = 0; k < 4; k++) policeAdd(trim, boxGeo, (-0.36 + k * 0.1) * l, g.roof - 0.35, side * (g.wt * w + 0.05), 2.4, 0.7, 0.1, '#1b2833');
          }
          // Safari roof: a second white skin on spacers, raised off the first.
          policeAdd(paint, boxGeo, (g.rb + g.rf) * 0.5 * l, g.roof + g.arch + 0.95, 0, (g.rf - g.rb) * l * 0.94, 0.28, g.wt * w * 2.08, '#ffffff', swatch('roof'));
          for (const x of [-0.4, -0.15, 0.1]) for (const side of [-1, 1]) policeAdd(trim, boxGeo, x * l, g.roof + g.arch + 0.55, side * g.wt * w * 0.9, 0.6, 0.6, 0.6, '#d8d3c4');
          roofRack(g.rb * l + 1, g.rf * l - 1.5, g.roof + g.arch + 1.9, g.wt * w * 0.98);
          jerryCan(-0.3 * l, g.roof + g.arch + 2.0, -3.5, '#56603a', Math.PI / 2);
          jerryCan(-0.3 * l, g.roof + g.arch + 2.0, -0.5, '#56603a', Math.PI / 2);
          policeAdd(trim, boxGeo, -0.05 * l, g.roof + g.arch + 2.6, 2.2, 8, 1.4, 3, '#5b4a34');
          for (let k = 0; k < 6; k++) kitTube(trim, [tail - 0.25, def.yb + 1 + k * 1.9, -w * 0.3], [tail - 0.25, def.yb + 1 + k * 1.9, -w * 0.15], 0.14, alu);
          for (const z of [-w * 0.3, -w * 0.15]) kitTube(trim, [tail - 0.25, def.yb, z], [tail - 0.25, g.roof + g.arch + 1.9, z], 0.16, alu);
          policeAdd(trim, boxGeo, nose + 0.6, def.bumpers[0][1], 0, 1.2, 1.4, w * 1.04, '#1a1b1d');
          lightPod(nose + 0.8, def.bumpers[0][1] + 1.6, -w * 0.28, 0.9);
          lightPod(nose + 0.8, def.bumpers[0][1] + 1.6, w * 0.28, 0.9);
          handles([0.16, -0.02]);
        } else if (type === 'crawler') {
          // Seven-slot grille, winch bumper, windscreen frame and sport cage, soft
          // bikini top, visible seats, rear spare, sliders, a light bar on the screen.
          const grilleY = topAt(nose - 0.5) - 3.2;
          policeAdd(trim, boxGeo, nose + 0.05, grilleY, 0, 0.25, 4.2, w * 0.7, '#121315');
          for (let i = -3; i <= 3; i++) policeAdd(paint, roundedBar(0.3, 3.4, w * 0.075, 0.2), nose + 0.2, grilleY, i * w * 0.1, 1, 1, 1, '#ffffff', swatch('hood'));
          const screenFoot = [g.xf * l, g.base, 0],
            screenTop = [g.rf * l, g.roof, 0];
          for (const side of [-1, 1]) {
            kitTube(trim, [screenFoot[0], screenFoot[1], side * g.wb * w], [screenTop[0], screenTop[1], side * g.wb * w], 0.4, black);
            // Sport cage: hoops over the seats, bars back to the tub.
            kitTube(trim, [screenTop[0], screenTop[1], side * g.wb * w], [-0.12 * l, g.roof, side * g.wb * w], 0.38, black);
            kitTube(trim, [-0.12 * l, g.roof, side * g.wb * w], [-0.12 * l, def.h, side * g.wb * w], 0.38, black);
            kitTube(trim, [-0.12 * l, g.roof, side * g.wb * w], [-0.44 * l, g.roof - 0.4, side * g.wb * w], 0.34, black);
            kitTube(trim, [-0.44 * l, g.roof - 0.4, side * g.wb * w], [-0.44 * l, def.h, side * g.wb * w], 0.34, black);
            // Seats, front and rear, with headrests.
            for (const sx of [0.02, -0.26]) {
              policeAdd(trim, roundedBar(2.6, 1.0, 3.2, 0.4), sx * l, def.h + 0.2, side * w * 0.2, 1, 1, 1, '#1f2023', null, 0, Math.PI / 2, 0);
              policeAdd(trim, roundedBar(0.9, 4.2, 3.2, 0.4), sx * l - 1.4, def.h + 2.2, side * w * 0.2, 1, 1, 1, '#1f2023', null, 0, Math.PI / 2, 0.12);
            }
          }
          kitTube(trim, [screenTop[0], screenTop[1], -g.wb * w], [screenTop[0], screenTop[1], g.wb * w], 0.4, black);
          kitTube(trim, [-0.12 * l, g.roof, -g.wb * w], [-0.12 * l, g.roof, g.wb * w], 0.38, black);
          // Bikini top over the front seats.
          policeAdd(trim, boxGeo, (screenTop[0] - 0.12 * l) / 2, g.roof + 0.45, 0, screenTop[0] + 0.12 * l, 0.25, g.wb * w * 2.1, '#18191b');
          lightBar(screenTop[0] - 0.2, g.roof + 1.2, g.wb * w * 1.8);
          for (const side of [-1, 1]) lightPod(screenFoot[0] + 0.5, g.base + 0.8, side * (g.wb * w + 0.6), 0.55);
          policeAdd(trim, boxGeo, -0.2 * l, def.h - 0.1, 0, 0.3 * l, 0.2, w * 0.3, '#1f2023');
          // Steering wheel.
          policeAdd(trim, S.cylinderLow, 0.1 * l, def.h + 2.2, -w * 0.2, 1.1, 0.2, 1.1, '#111', null, 0, 0, 1.1);
          spareOnBack(def.yb + 5.2);
          steelBumper(true, true, false);
          steelBumper(false, false, false);
          rockSliders();
        } else if (type === 'bronco') {
          // Classic: white grille surround and letters, round lamps, chrome bumpers,
          // swing-away spare, a white hardtop.
          const grilleY = topAt(nose - 0.5) - 2.3;
          policeAdd(paint, boxGeo, nose + 0.05, grilleY, 0, 0.35, 3.0, w * 0.86, '#ffffff', swatch('roof'));
          policeAdd(trim, boxGeo, nose + 0.2, grilleY, 0, 0.12, 2.2, w * 0.5, '#101113');
          for (let i = 0; i < 6; i++) policeAdd(trim, boxGeo, nose + 0.28, grilleY + 0.1, (i - 2.5) * w * 0.075, 0.05, 1.0, 0.9, '#e4e2da');
          policeAdd(bright, roundedBar(w * 1.0, 1.1, 1.0, 0.3), nose + 0.6, def.bumpers[0][1], 0, 1, 1, 1, '#d9dde0');
          policeAdd(bright, roundedBar(w * 1.0, 1.1, 1.0, 0.3), tail - 0.5, def.bumpers[1][1], 0, 1, 1, 1, '#d9dde0');
          spareOnBack(def.yb + 5.0);
          kitTube(trim, [tail - 0.8, def.bumpers[1][1], w * 0.42], [tail - 0.8, def.yb + 7.5, w * 0.42], 0.3, steel);
          handles([0.14]);
          for (const side of [-1, 1]) policeAdd(bright, boxGeo, 0.02 * l, def.h - 1.0, side * (halfAt(0, def.h - 1) + 0.08), 0.4 * l, 0.12, 0.1, '#d9dde0');
          roofRack(g.rb * l + 1.5, g.rf * l - 2, g.roof + g.arch + 1.1, g.wt * w * 0.92);
          policeAdd(trim, boxGeo, -0.18 * l, g.roof + g.arch + 1.5, 0, 6, 1.2, 4.5, '#3a3f2f');
          jerryCan(-0.36 * l, g.roof + g.arch + 1.2, -2.5, '#b22a1e', Math.PI / 2);
        } else if (type === 'expedition') {
          // Overland wagon: bull bar and winch, snorkel, full rack with a roof tent,
          // jerry cans and sand ladders, rear ladder and spare, light bar, sliders.
          const grilleY = topAt(nose - 0.5) - 2.0;
          policeAdd(trim, boxGeo, nose + 0.05, grilleY, 0, 0.3, 2.6, w * 0.58, '#15161a');
          for (let i = 0; i < 5; i++) policeAdd(bright, boxGeo, nose + 0.2, grilleY - 1 + i * 0.5, 0, 0.08, 0.18, w * 0.56, '#aeb3b7');
          steelBumper(true, true, true);
          steelBumper(false, false, false);
          snorkel(1);
          rockSliders();
          const rackY = g.roof + g.arch + 1.4,
            x0 = g.rb * l + 0.5,
            x1 = g.rf * l - 0.4;
          roofRack(x0, x1, rackY, g.wt * w * 1.0);
          // Roof tent: a folded shell with its grey cover over the front two-thirds.
          policeAdd(trim, roundedBar(g.wt * w * 2.0, 1.7, (x1 - x0) * 0.58, 0.4), x1 - (x1 - x0) * 0.32, rackY + 1.0, 0, 1, 1, 1, '#4b4f52', null, 0, Math.PI / 2, 0);
          policeAdd(trim, boxGeo, x1 - (x1 - x0) * 0.32, rackY + 0.2, 0, (x1 - x0) * 0.6, 0.35, g.wt * w * 2.04, '#1b1c1e');
          policeAdd(trim, boxGeo, x1 - (x1 - x0) * 0.32, rackY + 1.9, g.wt * w * 0.2, (x1 - x0) * 0.5, 0.1, 0.4, '#d9a441');
          for (const k of [0, 1, 2]) jerryCan(x0 + 1.4, rackY, -g.wt * w * 0.7 + k * 1.2, k === 2 ? '#2f5d9a' : '#b22a1e', Math.PI / 2);
          for (const side of [-1, 1]) policeAdd(trim, boxGeo, x0 + (x1 - x0) * 0.25, rackY + 0.5, side * (g.wt * w + 0.3), (x1 - x0) * 0.45, 0.22, 3.2, '#e2721f', null, Math.PI / 2 - 0.12 * side, 0, 0);
          lightBar(x1 - 0.2, rackY + 0.6, g.wt * w * 1.7);
          spareOnBack(def.yb + 4.6);
          for (let k = 0; k < 7; k++) kitTube(trim, [tail - 0.25, def.yb + 2.2 + k * 1.75, w * 0.18], [tail - 0.25, def.yb + 2.2 + k * 1.75, w * 0.36], 0.14, black);
          for (const z of [w * 0.18, w * 0.36]) kitTube(trim, [tail - 0.25, def.yb + 1.5, z], [tail - 0.25, rackY, z], 0.16, black);
          handles([0.16, -0.02, -0.2]);
        } else if (type === 'hilux') {
          // Arctic-style pickup: flares, snorkel, roof light bar, sports bar and a
          // loaded bed (cases, jerry cans, a spare), bull bar with pods.
          const grilleY = topAt(nose - 0.5) - 1.9;
          policeAdd(trim, roundedBar(w * 0.62, 2.4, 0.5, 0.4), nose - 0.1, grilleY, 0, 1, 1, 1, '#111214');
          policeAdd(bright, boxGeo, nose + 0.15, grilleY + 0.9, 0, 0.1, 0.25, w * 0.6, '#c9ccce');
          policeAdd(bright, roundedBar(1.8, 1.1, 0.2, 0.3), nose + 0.2, grilleY, 0, 1, 1, 1, '#c9ccce');
          steelBumper(true, true, true);
          for (const side of [-1, 1]) lightPod(nose + 1.2, topAt(nose - 1) + 0.1, side * w * 0.26, 0.8);
          steelBumper(false, false, false);
          snorkel(1);
          lightBar(g.rf * l - 1.2, g.roof + g.arch + 0.9, g.wt * w * 1.8);
          for (const side of [-1, 1]) policeAdd(trim, boxGeo, g.rf * l - 1.2, g.roof + g.arch + 0.35, side * g.wt * w * 0.8, 0.8, 0.6, 0.6, black);
          const [bx, floor, wall] = def.bed;
          for (const side of [-1, 1]) {
            const z = side * (halfAt(bx * l - 2, floor + 1) - 0.25);
            policeAdd(paint, boxGeo, (bx * l + tail) / 2, (floor + wall) / 2, z, bx * l - tail, wall - floor, 0.5, '#ffffff', swatch('door'));
            policeAdd(trim, boxGeo, (bx * l + tail) / 2, wall + 0.1, z, bx * l - tail, 0.2, 0.7, black);
            // Sports bar behind the cab.
            kitTube(trim, [bx * l - 1.2, wall, z * 0.95], [bx * l - 1.6, wall + 3.4, z * 0.8], 0.38, black);
          }
          kitTube(trim, [bx * l - 1.6, wall + 3.4, -w * 0.38], [bx * l - 1.6, wall + 3.4, w * 0.38], 0.38, black);
          policeAdd(paint, boxGeo, tail + 0.25, (floor + wall) / 2, 0, 0.5, wall - floor, w * 0.92, '#ffffff', swatch('trunk'));
          policeAdd(trim, boxGeo, tail + 0.2, wall - 0.5, 0, 0.1, 0.6, w * 0.4, '#17181a');
          policeAdd(trim, boxGeo, bx * l - 0.5, (floor + g.base) / 2, 0, 0.5, g.base - floor, w * 0.9, '#eeeeea');
          policeAdd(trim, roundedBar(4.0, 2.6, 3.0, 0.3), -0.28 * l, floor + 1.3, -2.4, 1, 1, 1, '#2b2d31');
          policeAdd(trim, roundedBar(3.0, 2.2, 2.4, 0.3), -0.4 * l, floor + 1.1, -2.6, 1, 1, 1, '#c77a1e');
          jerryCan(-0.3 * l, floor, 3.0, '#b22a1e', 0);
          jerryCan(-0.36 * l, floor, 3.0, '#b22a1e', 0);
          spares.push({ x: -0.43 * l, y: floor + 1.9, z: 2.6, rx: 0, ry: 0, lie: true });
          handles([0.14, -0.04]);
          rockSliders();
        } else if (type === 'sixbysix') {
          // Portal-axled 6x6 wagon-pickup: square grille, big flares, rack with a
          // light bar, a rollbar in the bed with pods, a spare in the bed, side pipes.
          const grilleY = topAt(nose - 0.5) - 2.3;
          policeAdd(trim, boxGeo, nose + 0.05, grilleY, 0, 0.3, 2.6, w * 0.5, '#101113');
          for (let i = 0; i < 4; i++) policeAdd(paint, boxGeo, nose + 0.2, grilleY - 0.9 + i * 0.6, 0, 0.12, 0.28, w * 0.48, '#ffffff', swatch('hood'));
          steelBumper(true, true, false);
          steelBumper(false, false, false);
          for (const side of [-1, 1]) {
            // Indicator pods on the wings, the G-wagen's signature.
            policeAdd(trim, roundedBar(1.2, 0.8, 1.2, 0.3), 0.44 * l, topAt(0.44 * l) + 0.4, side * w * 0.44, 1, 1, 1, '#d98a1a');
            // Side exhausts ahead of the rear axles.
            kitTube(bright, [-0.02 * l, def.yb + 0.6, side * (halfAt(0, def.yb + 1) + 0.3)], [0.04 * l, def.yb + 0.6, side * (halfAt(0, def.yb + 1) + 0.3)], 0.45, '#9aa0a4');
          }
          roofRack(g.rb * l + 0.8, g.rf * l - 0.6, g.roof + g.arch + 1.2, g.wt * w * 0.98);
          lightBar(g.rf * l - 0.8, g.roof + g.arch + 1.9, g.wt * w * 1.8);
          const [bx, floor, wall] = def.bed;
          for (const side of [-1, 1]) {
            const z = side * (halfAt(bx * l - 2, floor + 1) - 0.25);
            policeAdd(paint, boxGeo, (bx * l + tail) / 2, (floor + wall) / 2, z, bx * l - tail, wall - floor, 0.5, '#ffffff', swatch('door'));
            policeAdd(trim, boxGeo, (bx * l + tail) / 2, wall + 0.1, z, bx * l - tail, 0.25, 0.8, black);
            kitTube(trim, [bx * l - 1.0, wall, z * 0.95], [bx * l - 1.0, wall + 4.2, z * 0.8], 0.4, black);
          }
          kitTube(trim, [bx * l - 1.0, wall + 4.2, -w * 0.38], [bx * l - 1.0, wall + 4.2, w * 0.38], 0.4, black);
          for (const side of [-1, 1]) lightPod(bx * l - 0.6, wall + 4.9, side * w * 0.2, 0.7);
          policeAdd(paint, boxGeo, tail + 0.25, (floor + wall) / 2, 0, 0.5, wall - floor, w * 0.92, '#ffffff', swatch('trunk'));
          policeAdd(trim, boxGeo, bx * l - 0.5, (floor + g.base) / 2, 0, 0.5, g.base - floor, w * 0.9, '#7d7556');
          spares.push({ x: -0.3 * l, y: floor + 1.7, z: 0, rx: 0, ry: 0, lie: true });
          handles([0.14, -0.02]);
        } else if (type === 'trophy') {
          // Baja trophy truck: long nose with a louvered hood, roof scoop and pods,
          // an open bed of cage tubes over two spares, the rear coilovers and bypass
          // shocks, a front light bar, number plates on the roof.
          const grilleY = topAt(nose - 0.5) - 1.5;
          policeAdd(trim, roundedBar(w * 0.7, 1.4, 0.4, 0.4), nose - 0.05, grilleY, 0, 1, 1, 1, '#101113');
          for (let k = 0; k < 6; k++) policeAdd(trim, boxGeo, (0.34 - k * 0.025) * l, topAt((0.34 - k * 0.025) * l) + 0.05, 0, 0.4, 0.1, w * 0.4, '#151618');
          lightBar(0.3 * l, topAt(0.3 * l) + 1.4, w * 0.8);
          for (const side of [-1, 1]) kitTube(trim, [0.3 * l, topAt(0.3 * l), side * w * 0.3], [0.3 * l, topAt(0.3 * l) + 1.0, side * w * 0.3], 0.2, black);
          policeAdd(paint, roundedBar(2.2, 1.2, 3.4, 0.4), (g.rb + g.rf) * 0.5 * l, g.roof + g.arch + 0.6, 0, 1, 1, 1, '#ffffff', swatch('roof'));
          for (const side of [-1, 1]) lightPod(g.rf * l - 0.4, g.roof + g.arch + 0.9, side * w * 0.22, 0.6);
          const [bx, floor] = def.bed,
            cage = floor + 5.6;
          for (const side of [-1, 1]) {
            const z = side * w * 0.46;
            kitTube(trim, [bx * l - 0.5, g.roof - 0.5, side * w * 0.3], [tail + 1, cage, z], 0.3, '#1b1c1e');
            kitTube(trim, [tail + 1, cage, z], [tail + 0.6, floor, z], 0.3, '#1b1c1e');
            kitTube(trim, [bx * l - 1, floor + 0.2, z], [tail + 0.6, floor + 0.2, z], 0.28, '#1b1c1e');
            // Rear coilover and bypass shocks leaning in from the axle to the cage.
            const ax = def.wheel.xs[1] * l;
            kitTube(bright, [ax + 1.4, r + 0.6, side * (zWheel - 1.2)], [ax + 3.8, cage - 0.4, side * w * 0.36], 0.55, '#c9a227');
            kitTube(trim, [ax + 1.0, r + 0.6, side * (zWheel - 1.4)], [ax + 3.2, cage - 0.6, side * w * 0.3], 0.45, '#2b2d30');
            kitTube(bright, [ax - 1.2, r + 0.6, side * (zWheel - 1.3)], [ax - 0.6, cage - 1.0, side * w * 0.38], 0.4, '#b8292a');
            // Front shock towers through the hood.
            kitTube(bright, [def.wheel.xs[0] * l, r + 0.5, side * (zWheel - 1.1)], [def.wheel.xs[0] * l - 1, topAt(def.wheel.xs[0] * l) + 1.2, side * w * 0.34], 0.5, '#c9a227');
          }
          kitTube(trim, [tail + 1, cage, -w * 0.46], [tail + 1, cage, w * 0.46], 0.3, '#1b1c1e');
          kitTube(trim, [bx * l - 0.5, g.roof - 0.5, -w * 0.3], [bx * l - 0.5, g.roof - 0.5, w * 0.3], 0.3, '#1b1c1e');
          spares.push({ x: -0.35 * l, y: floor + 3.2, z: -w * 0.18, ry: 0, rx: 0, lean: 0.35 });
          spares.push({ x: -0.35 * l, y: floor + 3.2, z: w * 0.18, ry: 0, rx: 0, lean: -0.35 });
          policeAdd(trim, roundedBar(w * 0.9, 1.6, 1.2, 0.3), -0.36 * l, floor + 1.0, 0, 1, 1, 1, '#2b2d30');
          policeAdd(trim, boxGeo, tail + 0.3, floor + 2.0, 0, 0.3, 2.4, w * 0.5, '#151618');
          policeAdd(paint, boxGeo, tail + 0.4, floor + 2.0, 0, 0.1, 1.6, 3.2, '#ffffff', swatch('base'));
          mirrors(false);
        }
        kit.paint = policeGeometry(paint);
        kit.trim = policeGeometry(trim);
        kit.bright = bright.count ? policeGeometry(bright) : null;
        kit.lens = lens.count ? policeGeometry(lens) : null;
        offroadKits.set(key, kit);
        return kit;
      }
      // ---- The model ----------------------------------------------------------------------------
      const offroadLensMaterial = new Three.MeshStandardMaterial({ color: '#f2f1ea', emissive: '#fff4dc', emissiveIntensity: 0, roughness: 0.1, metalness: 0.6 }),
        offroadHalo = new Three.SpriteMaterial({ color: '#fff1d6' });
      let offroadClaimed = false;
      /*
       * A club truck, on makeVehicle's contract (render3d.js): shell / cabin for the
       * crumple and the panes, hood, bumpers, wheels, lamps, nightLights in lampOut
       * order, dims. `offroad` marks it for animateOffroadVehicle.
       */
      function makeOffroadVehicle(vehicle) {
        claimPoliceResources();
        if (!offroadClaimed) {
          offroadClaimed = true;
          sharedMaterials.add(offroadLensMaterial);
          sharedMaterials.add(offroadHalo);
        }
        const spec = vehicleSpec(vehicle),
          type = spec.clubModel,
          def = OFFROAD_BODIES[type],
          l = spec.l,
          w = spec.w * def.bodyW,
          kit = offroadKit(type, def, l, w, spec.w),
          g = def.glass,
          group = new Three.Group(),
          body = new Three.Group(),
          uniforms = mudUniforms();
        group.add(body);
        scene.add(group);
        const livery = offroadLiveryTexture(type, def, l, w),
          finish = type === 'sixbysix' ? { roughness: 0.62, metalness: 0.05 } : type === 'series' ? { roughness: 0.5, metalness: 0.05 } : { roughness: 0.32, metalness: 0.1 },
          paint = vehicleMudPatch(
            new Three.MeshPhysicalMaterial({ color: '#ffffff', map: livery, roughness: finish.roughness, metalness: finish.metalness, clearcoat: type === 'sixbysix' ? 0.1 : 1, clearcoatRoughness: 0.08 }),
            uniforms,
          ),
          trimMaterial = vehicleMudPatch(new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 }), uniforms),
          tyreMaterial = vehicleMudPatch(new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }), uniforms, true);
        const shell = mesh(kit.shell, paint, body, 0, 0, 0),
          cabin = kit.cabin
            ? mesh(kit.cabin, policeGlass, body, 0, 0, 0)
            : box(body, g.xf * l + 0.2, (g.base + g.roof) / 2, 0, 0.25, g.roof - g.base - 0.6, g.wb * w * 1.9, policeGlass),
          hood = mesh(kit.hood, paint, body, l * 0.34, def.hood[0], 0, l * 0.25, 0.4, w * def.hood[1]);
        if (!kit.cabin) cabin.rotation.z = -Math.atan2((g.xf - g.rf) * l, g.roof - g.base);
        mesh(kit.paint, paint, body, 0, 0, 0);
        mesh(kit.trim, trimMaterial, body, 0, 0, 0);
        if (kit.bright) mesh(kit.bright, policeBrightMaterial, body, 0, 0, 0);
        if (kit.lens) mesh(kit.lens, offroadLensMaterial, body, 0, 0, 0).castShadow = false;
        const bumpers = def.bumpers.map(([x, y, sx, sy, sz]) => box(body, x * l, y, 0, sx, sy, sz * w, policeBumperMaterial));
        const wheels = [],
          knuckles = [],
          r = def.wheel.r;
        for (const fx of def.wheel.xs)
          for (const side of [-1, 1]) {
            const knuckle = new Three.Group(),
              wheel = new Three.Group();
            knuckle.position.set(fx * l, r, side * kit.zWheel);
            body.add(knuckle);
            // A hair off centre so damage3d.js files it as front or rear.
            wheel.position.set(fx > 0 ? 0.01 : -0.01, 0, 0);
            knuckle.add(wheel);
            // The tyre stays the wheel's first child (hidden on a burnt wreck).
            mesh(kit.tyre, tyreMaterial, wheel, 0, 0, 0);
            mesh(kit.rims[side < 0 ? 0 : 1], policeWheelMaterial, wheel, 0, 0, 0);
            wheels.push({ wheel, side });
            knuckles.push({ knuckle, x: fx * l, z: side * kit.zWheel, front: fx > 0, driven: spec.drive !== 'rwd' || fx < 0, baseY: r, offset: 0 });
          }
        for (const s of kit.spares) {
          const holder = new Three.Group();
          holder.position.set(s.x, s.y, s.z);
          holder.rotation.set(s.rx || 0, s.ry || 0, s.lean || 0);
          if (s.lie) holder.rotation.x = Math.PI / 2;
          body.add(holder);
          mesh(kit.tyre, tyreMaterial, holder, 0, 0, 0);
          mesh(kit.rims[1], policeWheelMaterial, holder, 0, 0, 0);
        }
        const lamps = [],
          nightLights = [],
          [hx, hy, hz, hsx, hsy, hsz, round] = def.head,
          [tx, ty, tz, tsx, tsy, tsz] = def.tail,
          S = policeShapeKit();
        for (const side of [-1, 1]) {
          const head = round
            ? mesh(S.cylinder, warmLamp, body, hx * l, hy, side * hz * w, hsy / 2, 0.35, hsy / 2)
            : box(body, hx * l, hy, side * hz * w, hsx, hsy, hsz * w, warmLamp);
          if (round) head.rotation.z = Math.PI / 2;
          lamps.push(
            { mesh: head, key: side < 0 ? 'headLeft' : 'headRight', lit: warmLamp },
            { mesh: box(body, tx * l, ty, side * tz * w, tsx, tsy, tsz * w, tailLamp), key: side < 0 ? 'tailLeft' : 'tailRight', lit: tailLamp },
          );
          nightLights.push(halo(body, hx * l + 0.5, hy, side * hz * w, 11, '#ffe9bd'), halo(body, tx * l - 0.5, ty, side * tz * w, 7, '#ff5a44'));
        }
        const extraHalos = kit.anchors.map((a) => {
          const sprite = new Three.Sprite(offroadHalo);
          sprite.position.set(a.x, a.y, a.z);
          sprite.scale.set(a.size, a.size, 1);
          sprite.visible = false;
          body.add(sprite);
          return sprite;
        });
        const wiperHost = {};
        if (!def.open) addWipers(wiperHost, body, g.xf * l, g.base + 0.4, lerpNumber(g.xf, g.rf, 0.55) * l, lerpNumber(g.base, g.roof, 0.55), g.wb * w * 0.92);
        return {
          wipers: wiperHost.wipers,
          group,
          body,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          car: true,
          offroad: true,
          dims: { l, w, h: def.h, roof: g.roof, van: true },
          shell,
          shellBase: shell.geometry.attributes.position.array,
          cabin,
          cabinBase: kit.cabin ? cabin.geometry.attributes.position.array : null,
          wheels,
          knuckles,
          wheelRadius: r,
          spin: 0,
          bumpers,
          bumperOrigins: bumpers.map((b) => b.position.clone()),
          hood,
          hoodBaseY: def.hood[0],
          lamps,
          damageVersion: -1,
          nightLights,
          extraHalos,
          rearDoors: null,
          liveryMap: livery,
          liveryColor: '#ffffff',
          finish,
          bumperMaterial: policeBumperMaterial,
          glass: policeGlass,
          panelGeometry: kit.door,
          trunkGeometry: kit.trunk,
          mudUniforms: uniforms,
        };
      }
      /*
       * Per frame, for a club truck in view: the wheels turn at the wheel speed
       * (ahead of the ground when spinning), the fronts steer, every wheel follows
       * the ground under it within the suspension's travel, the light bars glow at
       * night, and the mud uniforms follow the truck.
       */
      function animateOffroadVehicle(c, m, deltaSeconds) {
        const spec = vehicleSpec(c),
          along = c.speed || 0,
          roll = along * deltaSeconds,
          spinExtra = (c.spinSpeed || 0) * (along < -2 ? -1 : 1) * deltaSeconds,
          r = m.wheelRadius;
        m.spin -= (roll + spinExtra) / r;
        m.rollOnly = (m.rollOnly || 0) - roll / r;
        const steer = clamp(Math.atan(((c.av || 0) * spec.l * 0.62) / Math.max(Math.abs(along), 12)) * Math.sign(along || 1), -0.62, 0.62),
          cos = Math.cos(c.a),
          sin = Math.sin(c.a),
          onGround = !!c.offroadState,
          travel = r * 0.45 * (spec.travel || 1),
          pitch = Math.sin(c.slopePitch || 0),
          rollSlope = Math.sin(c.slopeRoll || 0),
          centre = c.groundHeight || 0,
          ease = 1 - Math.exp(-deltaSeconds * 18),
          rough = onGround ? (c.surfaceRock > 0.5 ? 1.1 : 0.35 + 0.4 * c.surfaceMud) : 0;
        for (let i = 0; i < m.knuckles.length; i++) {
          const k = m.knuckles[i],
            wheel = m.wheels[i].wheel;
          wheel.rotation.z = k.driven ? m.spin : m.rollOnly;
          if (k.front) k.knuckle.rotation.y = -steer;
          let target = 0;
          if (onGround) {
            const wx = c.x + cos * k.x - sin * k.z,
              wy = c.y + sin * k.x + cos * k.z,
              ground = terrainHeight(wx, wy) + (terrainNoise(wx / 9, wy / 9, 71) * 0.5) * rough;
            target = clamp(ground - (centre + k.x * pitch - k.z * rollSlope), -travel, travel);
          }
          k.offset += (target - k.offset) * ease;
          k.knuckle.position.y = k.baseY + k.offset;
        }
        applyVehicleMud(c, m);
        // Light bars and pods at night on a driven truck.
        const lampsOn = vehicleLampAmount();
        if (lampsOn > 0.25 && c.hp > 0 && (c === player.car || c.ai)) for (const sprite of m.extraHalos) queueVehicleHalo(sprite, 0.7 * lampsOn);
        const glow = c.hp > 0 && c === player.car ? lampsOn * 2.4 : 0;
        if (offroadLensMaterial.emissiveIntensity !== glow && c === player.car) offroadLensMaterial.emissiveIntensity = glow;
      }
