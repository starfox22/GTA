      // Police 3D kits: makePoliceVehicle(), animatePoliceVehicle(), rims, rear doors, beacons and road glow.
      // ---- The kit: merged parts for one body and equipment ----------------------------------
      const policeKits = new Map();
      function policeKit(look, body, l, w) {
        const key = [body.name, look.equipment, l, w].join(':');
        if (policeKits.has(key)) return policeKits.get(key);
        const S = policeShapeKit(),
          g = body.glass,
          marked = look.equipment === 'marked',
          bearcat = body.kind === 'bearcat',
          paint = policeSet(),
          trim = policeSet(),
          bright = policeSet(),
          lights = policeSet(),
          beaconLeft = policeSet(),
          beaconRight = policeSet(),
          anchors = [],
          swatch = (name) => ({ uv: swatchUv(POLICE_SWATCH[name]) }),
          black = '#101215',
          gloss = '#07080a',
          plastic = '#1d2024',
          chrome = '#d7dde1',
          light = (set, geo, x, y, z, sx, sy, sz, color, channel, rx, ry, rz) => policeAdd(set, geo, x, y, z, sx, sy, sz, color, { channel }, rx, ry, rz),
          anchor = (x, y, z, color, size, channels, strength = 1) => anchors.push({ x, y, z, color, size, channels, strength }),
          topAt = (x) => profileAt(body.profile, x / l)[1],
          halfAt = (x, y) => policeShellAt(body, l, w, x, y).half,
          kit = {
            shell: policeShellGeometry(body, l, w),
            cabin: policeCabinGeometry(body, l, w),
            hood: policeSwatchBox(POLICE_SWATCH.hood),
            door: policeSwatchBox(POLICE_SWATCH.door),
            trunk: policeSwatchBox(POLICE_SWATCH.trunk),
            wheel: body.wheel,
            rims: [-1, 1].map((side) => policeRimGeometry(bearcat ? 'truck' : look.body === 'tahoe' || (look.unmarked && look.body === 'charger') ? 'alloy' : 'steel', side, body.wheel)),
            anchors,
          };
        // Wheel arches: a dark well behind each tyre and a black flare round it.
        for (const side of [-1, 1])
          for (const fx of [-body.wheel.x, body.wheel.x]) {
            const x = fx * l,
              r = body.wheel.r,
              half = halfAt(x, body.wheel.r + 1.5);
            policeAdd(trim, S.halfDisc, x, r * 0.98, side * (half + 0.03), r * 1.13, r * 1.13, 1, '#060607', null, 0, side < 0 ? Math.PI : 0, 0);
            policeAdd(trim, S.arch, x, r * 0.98, side * (half + 0.05), r * 1.16, r * 1.16, bearcat ? 7 : 4, bearcat ? plastic : black);
          }
        if (!bearcat) {
          // ---- Roof panel over the glass roof, with a short skirt.
          const roofPoint = (s, t, lift = 0.14) => [lerpNumber(g.rb * l - 0.25, g.rf * l + 0.25, t), g.roof + lift + g.arch * (1 - s * s), s * g.wt * w * 1.03];
          const roofGeo = gridGeometry(6, 4, (u, v) => roofPoint(u * 2 - 1, v), (p, out) => out.set(p.x, p.y - 5, 0));
          policeAddMatrix(paint, roofGeo, policeIdentity, '#ffffff', swatch('roof'));
          roofGeo.dispose();
          for (const side of [-1, 1]) {
            const skirt = gridGeometry(6, 1, (u, v) => {
              const p = roofPoint(side, u, 0.14 - (1 - v) * 0.34);
              return [p[0], p[1], p[2] + side * 0.02];
            }, (p, out) => out.set(p.x, p.y, 0));
            policeAddMatrix(paint, skirt, policeIdentity, '#ffffff', swatch('roof'));
            skirt.dispose();
          }
          // ---- Pillars: A (and the rear) in the body colour, B/C in gloss black.
          const pillarPoint = (s, t, side, out) => {
            const p = glassPoint(g, l, w, 'side', s, t, side);
            return [p[0], p[1], p[2] + side * out];
          };
          for (const side of [-1, 1]) {
            const up = [0, 0, side];
            for (const [s, width, kind] of [[1, 1.05, 'paint'], ...g.pillars]) {
              const set = kind === 'paint' ? paint : trim,
                options = kind === 'paint' ? swatch('pillar') : null,
                offset = s === 1 ? 0.2 : 0.12,
                shift = s === 1 ? -width * 0.35 : s === 0 ? width * 0.45 : 0,
                points = [0, 0.5, 1].map((t) => {
                  const p = pillarPoint(s, t, side, offset);
                  return [p[0] + shift, p[1], p[2]];
                });
              for (let k = 0; k < 2; k++) policeBeam(set, boxGeo, points[k], points[k + 1], 0.32, width, kind === 'paint' ? '#ffffff' : gloss, options, up);
            }
            // Waist line along the foot of the side glass.
            policeBeam(body.chrome ? bright : trim, boxGeo, pillarPoint(0, 0.03, side, 0.14), pillarPoint(1, 0.03, side, 0.14), 0.3, 0.28, body.chrome ? chrome : gloss, null, [0, 1, 0]);
            // Mirrors on the door tops, black caps.
            const mx = g.xf * l - 1.6,
              my = g.base + 1.3,
              mz = side * (g.wb * w + 1.3);
            policeAdd(trim, roundedBar(1.6, 1.15, 0.9, 0.3), mx, my, mz, 1, 1, 1, black);
            policeBeam(trim, boxGeo, [mx + 0.2, my - 0.4, side * g.wb * w], [mx + 0.2, my - 0.3, mz - side * 0.5], 0.35, 0.5, black);
            // Door handles.
            for (const hx of [0.08, -0.115]) policeAdd(body.chrome ? bright : trim, boxGeo, hx * l, body.h - 1.4, side * (halfAt(hx * l, body.h - 1.4) + 0.04), 1.1, 0.28, 0.16, body.chrome ? chrome : black);
            // Black sill (rocker) trim between the arches.
            const sillY = body.yb + 0.75;
            policeAdd(trim, boxGeo, 0, sillY, side * (halfAt(0, sillY) + 0.02), l * (2 * body.wheel.x) - body.wheel.r * 2.3, 0.7, 0.12, plastic);
          }
          if (body.rails)
            for (const side of [-1, 1]) {
              const z = side * g.wt * w * 0.82,
                y = g.roof + g.arch * (1 - 0.82 * 0.82) + 0.6;
              policeAdd(trim, roundedBar(g.rf * l - g.rb * l - 4, 0.4, 0.45, 0.15), (g.rb * l + g.rf * l - 1) / 2, y, z, 1, 1, 1, black, null, 0, Math.PI / 2, 0);
              for (const t of [0.1, 0.9]) policeAdd(trim, boxGeo, lerpNumber(g.rb * l + 1.5, g.rf * l - 2.5, t), y - 0.3, z, 0.8, 0.5, 0.4, black);
            }
          // Charger: a lip spoiler on the trunk.
          if (body.spoiler) {
            const x = body.spoiler * l;
            policeAdd(paint, roundedBar(w * 0.82, 0.32, 1.1, 0.14), x, topAt(x) + 0.22, 0, 1, 1, 1, '#ffffff', swatch('trunk'));
          }
          if (body.kind === 'suv') {
            // Tailgate spoiler over the rear glass.
            policeAdd(paint, roundedBar(g.wt * w * 1.9, 0.4, 1.6, 0.18), g.rb * l - 0.35, g.roof + 0.25, 0, 1, 1, 1, '#ffffff', swatch('roof'));
          }
          // Grille between the headlamps.
          const nose = 0.5 * l,
            noseTop = topAt(nose - 0.6),
            grilleY = noseTop - 1.25;
          policeAdd(trim, roundedBar(w * 0.44, 1.5, 0.5, 0.2), nose - 0.35, grilleY, 0, 1, 1, 1, gloss);
          if (body.chrome) policeAdd(bright, roundedBar(w * 0.47, 1.75, 0.3, 0.2), nose - 0.3, grilleY, 0, 1, 1, 1, chrome);
          // Lower intake and licence plate.
          policeAdd(trim, roundedBar(w * 0.52, 0.9, 0.4, 0.3), nose + 0.05, 3.95, 0, 1, 1, 1, gloss);
          policeAdd(trim, boxGeo, -0.5 * l - 0.12, body.yb + 3.1, 0, 0.12, 1.25, 2.9, '#dcd6c4');
          // Exhaust tips.
          for (const z of [-0.26, 0.26]) policeAdd(bright, S.cylinderLow, -0.5 * l - 0.2, 3.5, z * w, 0.32, 1.1, 0.32, '#9aa1a6', null, 0, 0, Math.PI / 2);
          // Antennas on the roof and trunk.
          for (const [x, y, z, h] of [[g.rb * l + 2.2, g.roof + g.arch + 0.1, -2.0, 3.6], [g.rb * l + 3.4, g.roof + g.arch + 0.1, 1.6, 2.6]]) {
            policeAdd(trim, S.cylinderLow, x, y + h / 2, z, 0.09, h, 0.09, black);
            policeAdd(trim, S.cylinderLow, x, y + 0.08, z, 0.35, 0.16, 0.35, black);
          }
          if (body.kind === 'sedan') policeAdd(trim, S.cylinderLow, -0.45 * l, topAt(-0.45 * l) + 1.6, -w * 0.28, 0.08, 3.2, 0.08, black);
          // Spotlight on the driver's A-pillar.
          const spot = glassPoint(g, l, w, 'side', 1, 0.08, -1);
          policeAdd(bright, S.cylinder, spot[0] - 0.4, spot[1] + 0.35, spot[2] - 0.55, 0.52, 1.5, 0.52, '#c9cfd3', null, 0, 0, Math.PI / 2);
          policeAdd(bright, S.disc, spot[0] + 0.36, spot[1] + 0.35, spot[2] - 0.55, 0.44, 0.44, 1, '#eef2f4', null, 0, Math.PI / 2, 0);
          policeAdd(trim, S.cylinderLow, spot[0] - 0.4, spot[1] - 0.2, spot[2] - 0.3, 0.12, 1.1, 0.12, black);
          // Running lights (channel 7): LED strips over the headlamps, amber side markers.
          const [hx, hy, hz] = body.head;
          for (const side of [-1, 1]) {
            light(lights, boxGeo, hx * l + 0.1, hy + 0.62, side * hz * w, 0.5, 0.16, w * 0.2, '#fdf6ea', 7);
            light(lights, boxGeo, 0.44 * l, body.yb + 2.6, side * (halfAt(0.44 * l, body.yb + 2.6) + 0.03), 1.1, 0.35, 0.1, POLICE_AMBER, 7);
          }
          if (marked) policeMarkedEquipment();
          else policeUnmarkedEquipment();
          // Roof number over the rear of the roof panel, behind the lightbar.
          const numberFront = marked ? kit.lightbarX - kit.lightbarDepth / 2 - 0.5 : g.rf * l - 1,
            numberRear = g.rb * l + (body.kind === 'suv' ? 1.6 : 0.6);
          kit.roofDecal = {
            x: (numberFront + numberRear) / 2,
            y: g.roof + 0.14 + g.arch + 0.03,
            length: numberFront - numberRear,
            width: 2 * g.wt * w * 0.84,
            lift: (x, z) => -g.arch * Math.min(1, (z / (g.wt * w)) ** 2),
          };
          if (look.unmarked) kit.roofDecal = null;
        } else policeBearcatEquipment();
        function policeMarkedEquipment() {
          // ---- Low-profile LED lightbar: red segments left, blue right, white takedowns in the middle, alley lights at the ends.
          const length = 2 * g.wt * w * 0.97,
            x = g.rf * l - (body.kind === 'suv' ? 2.6 : 1.9),
            roofTop = g.roof + 0.14 + g.arch,
            y = roofTop + 0.8;
          kit.lightbarX = x;
          kit.lightbarDepth = 3.1;
          policeAdd(trim, roundedBar(length, 0.8, 3.1, 0.36), x, y - 0.14, 0, 1, 1, 1, '#15171a');
          for (const z of [-length * 0.36, length * 0.36]) policeAdd(trim, boxGeo, x, roofTop + 0.18, z, 1.5, 0.5, 0.5, black);
          const segments = [
              [POLICE_RED, 0],
              [POLICE_RED, 0],
              [POLICE_RED, 1],
              [POLICE_WHITE, 4],
              [POLICE_WHITE, 4],
              [POLICE_BLUE, 2],
              [POLICE_BLUE, 3],
              [POLICE_BLUE, 3],
            ],
            seg = (length * 0.97) / segments.length;
          segments.forEach(([color, channel], i) => {
            const z = -length * 0.485 + seg * (i + 0.5),
              lens = roundedBar(seg * 0.94, 0.62, 2.8, 0.26);
            light(lights, lens, x, y + 0.26, z, 1, 1, 1, color, channel);
            if (color !== POLICE_WHITE) policeAdd(i < 3 ? beaconLeft : beaconRight, lens, x, y + 0.26, z, 1, 1, 1, color);
          });
          for (const side of [-1, 1]) light(lights, boxGeo, x, y + 0.05, side * (length / 2 + 0.03), 1.0, 0.36, 0.12, POLICE_WHITE, 4);
          anchor(x, y + 0.7, -length * 0.3, 'red', 22, [0, 1]);
          anchor(x, y + 0.7, length * 0.3, 'blue', 22, [2, 3]);
          anchor(x + 1.2, y + 0.3, 0, 'white', 12, [4], 0.45);
          // ---- Push bar: two uprights, two cross bars, rubber pads, red and blue LEDs.
          const nose = 0.5 * l,
            px = nose + 0.55,
            top = topAt(nose) + 0.9;
          for (const side of [-1, 1]) {
            const z = side * w * 0.19;
            policeAdd(trim, roundedBar(0.9, top - 3.6, 0.8, 0.2), px, (top + 3.6) / 2, z, 1, 1, 1, black, null, 0, Math.PI / 2, 0);
            policeAdd(trim, boxGeo, px + 0.42, (top + 3.6) / 2, z, 0.12, top - 4.4, 0.62, '#26292d');
            light(lights, boxGeo, px + 0.5, top - 1.3, z, 0.1, 1.2, 0.5, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
            policeBeam(trim, boxGeo, [px - 0.3, 5.2, z], [nose - 2.2, 5.2, z], 0.5, 0.5, black);
            anchor(px + 0.6, top - 1.3, z, side < 0 ? 'red' : 'blue', 11, [side < 0 ? 5 : 6], 0.8);
          }
          for (const y of [top - 0.35, 5.4]) policeAdd(trim, roundedBar(w * 0.46, 0.55, 0.6, 0.25), px + 0.05, y, 0, 1, 1, 1, black);
          // Grille LEDs.
          const grilleY = topAt(nose - 0.6) - 1.25;
          for (const side of [-1, 1]) light(lights, boxGeo, nose - 0.02, grilleY, side * w * 0.1, 0.12, 0.55, 0.9, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
          // Rear window light bar along the top of the rear glass.
          const rearTop = glassPoint(g, l, w, 'rear', 0, 0.86);
          for (const side of [-1, 1]) {
            light(lights, boxGeo, rearTop[0] - 0.12, rearTop[1] - 0.1, side * g.wt * w * 0.45, 0.14, 0.4, g.wt * w * 0.7, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6, 0, 0, 0);
            anchor(rearTop[0] - 0.4, rearTop[1], side * g.wt * w * 0.45, side < 0 ? 'red' : 'blue', 12, [side < 0 ? 5 : 6], 0.7);
          }
        }
        function policeUnmarkedEquipment() {
          // Dash light behind the top of the windscreen, grille, rear deck and mirror LEDs.
          const dash = [
            [-0.62, POLICE_RED, 0],
            [-0.3, POLICE_RED, 1],
            [0.3, POLICE_BLUE, 2],
            [0.62, POLICE_BLUE, 3],
          ];
          for (const [s, color, channel] of dash) {
            const p = glassPoint(g, l, w, 'front', s, 0.9),
              q = glassPoint(g, l, w, 'front', s, 0.8);
            const nx = p[1] - q[1],
              ny = q[0] - p[0],
              n = Math.hypot(nx, ny);
            policeAdd(lights, boxGeo, p[0] + (nx / n) * 0.07, p[1] + (ny / n) * 0.07, p[2], 0.14, 0.45, 1.5, color, { channel }, 0, 0, Math.atan2(ny, nx));
            policeAdd(s < 0 ? beaconLeft : beaconRight, boxGeo, p[0] + 0.1, p[1] + 0.1, p[2], 0.3, 0.5, 1.5, color);
          }
          anchor(glassPoint(g, l, w, 'front', -0.45, 0.9)[0], g.roof - 0.4, -2.2, 'red', 12, [0, 1], 0.8);
          anchor(glassPoint(g, l, w, 'front', 0.45, 0.9)[0], g.roof - 0.4, 2.2, 'blue', 12, [2, 3], 0.8);
          const nose = 0.5 * l,
            grilleY = topAt(nose - 0.6) - 1.25;
          for (const side of [-1, 1]) {
            light(lights, boxGeo, nose - 0.02, grilleY, side * w * 0.11, 0.12, 0.5, 1.2, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
            anchor(nose + 0.4, grilleY, side * w * 0.11, side < 0 ? 'red' : 'blue', 10, [side < 0 ? 5 : 6], 0.8);
            const deck = glassPoint(g, l, w, 'rear', side * 0.45, 0.12);
            light(lights, boxGeo, deck[0] - 0.1, deck[1], deck[2], 0.14, 0.4, 2.4, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
            anchor(deck[0] - 0.4, deck[1], deck[2], side < 0 ? 'red' : 'blue', 10, [side < 0 ? 5 : 6], 0.7);
          }
        }
        function policeBearcatEquipment() {
          const roofY = 23,
            nose = 0.5 * l,
            half = w / 2;
          // Roof: hatch and turret ring with three shield plates, rails, scene lights.
          const hx = -0.13 * l;
          policeAdd(trim, S.cylinder, hx, roofY + 0.45, 0, 3.3, 0.9, 3.3, '#1b2027');
          policeAdd(paint, S.cylinder, hx, roofY + 1.0, 0, 2.7, 0.3, 2.7, '#ffffff', swatch('roof'));
          policeAdd(trim, boxGeo, hx - 2.4, roofY + 1.15, 0, 0.6, 0.35, 1.8, '#20262e');
          for (const a of [-0.9, 0, 0.9]) {
            const cx = hx + Math.cos(a) * 3.6,
              cz = Math.sin(a) * 3.6;
            policeAdd(paint, boxGeo, cx, roofY + 2.2, cz, 0.45, 3.2, 3.0, '#ffffff', swatch('roof'), 0, -a, 0);
            policeAdd(trim, boxGeo, cx + Math.cos(a) * 0.25, roofY + 2.8, cz + Math.sin(a) * 0.25, 0.1, 0.5, 1.0, '#0a0c10', null, 0, -a, 0);
          }
          for (const side of [-1, 1]) {
            policeAdd(trim, roundedBar(0.56 * l, 0.35, 0.4, 0.12), -0.2 * l, roofY + 0.55, side * half * 0.86, 1, 1, 1, '#1b2027', null, 0, Math.PI / 2, 0);
            for (const t of [0, 0.5, 1]) policeAdd(trim, boxGeo, lerpNumber(-0.48 * l, 0.08 * l, t), roofY + 0.25, side * half * 0.86, 0.5, 0.5, 0.4, '#1b2027');
            // Scene lights on the roof corners, white, facing out.
            policeAdd(trim, boxGeo, -0.47 * l, roofY + 0.7, side * half * 0.92, 1.2, 0.9, 0.5, '#1b2027');
            light(lights, boxGeo, -0.47 * l, roofY + 0.7, side * (half * 0.92 + 0.28), 0.9, 0.6, 0.06, POLICE_WHITE, 4);
          }
          // Lightbar across the front of the roof.
          const length = w * 0.84,
            x = 0.085 * l,
            y = roofY + 0.85;
          kit.lightbarX = x;
          policeAdd(trim, roundedBar(length, 0.8, 2.4, 0.3), x, y - 0.1, 0, 1, 1, 1, '#15171a');
          const segments = [POLICE_RED, POLICE_RED, POLICE_RED, POLICE_WHITE, POLICE_WHITE, POLICE_BLUE, POLICE_BLUE, POLICE_BLUE],
            channels = [0, 0, 1, 4, 4, 2, 3, 3],
            seg = (length * 0.97) / 8;
          segments.forEach((color, i) => {
            const z = -length * 0.485 + seg * (i + 0.5),
              lens = roundedBar(seg * 0.93, 0.55, 2.1, 0.2);
            light(lights, lens, x, y + 0.25, z, 1, 1, 1, color, channels[i]);
            if (color !== POLICE_WHITE) policeAdd(i < 3 ? beaconLeft : beaconRight, lens, x, y + 0.25, z, 1, 1, 1, color);
          });
          anchor(x, y + 0.8, -length * 0.3, 'red', 26, [0, 1]);
          anchor(x, y + 0.8, length * 0.3, 'blue', 26, [2, 3]);
          anchor(x + 1.3, y + 0.3, 0, 'white', 18, [4], 0.55);
          // Rear light bar over the doors.
          for (const side of [-1, 1]) {
            light(lights, boxGeo, -0.5 * l - 0.08, 22.3, side * half * 0.62, 0.14, 0.6, half * 0.55, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
            anchor(-0.5 * l - 0.6, 22.3, side * half * 0.62, side < 0 ? 'red' : 'blue', 14, [side < 0 ? 5 : 6], 0.7);
          }
          // Window frames round the armoured glass, gun ports, grab rails and steps.
          for (const side of [-1, 1]) {
            const z = side * (half + 0.12);
            for (const [x0, x1] of [[0.02, 0.118], [-0.085, -0.005]]) {
              for (const yy of [15.0, 20.6]) policeAdd(trim, boxGeo, ((x0 + x1) / 2) * l, yy, z, (x1 - x0) * l + 0.8, 0.45, 0.2, '#0c0f14');
              for (const xx of [x0, x1]) policeAdd(trim, boxGeo, xx * l, 17.8, z, 0.45, 6.0, 0.2, '#0c0f14');
            }
            for (const xx of [-0.2, -0.3, -0.4]) {
              policeAdd(trim, S.cylinderLow, xx * l, 16.5, side * (half + 0.08), 0.75, 0.25, 0.75, '#0c0f14', null, Math.PI / 2, 0, 0);
              policeAdd(trim, S.cylinderLow, xx * l, 16.5, side * (half + 0.2), 0.35, 0.1, 0.35, '#030304', null, Math.PI / 2, 0, 0);
            }
            policeBeam(trim, boxGeo, [-0.46 * l, 19.8, side * (half + 0.45)], [-0.14 * l, 19.8, side * (half + 0.45)], 0.22, 0.22, '#2a3038');
            policeAdd(trim, boxGeo, 0.0 * l, 4.4, side * (half + 0.4), 0.26 * l, 0.5, 1.2, '#1c2128');
            // Front flares over the narrower bonnet and a big truck mirror.
            policeAdd(trim, roundedBar(0.24 * l, 0.8, 1.4, 0.3), 0.3 * l, 11.6, side * (half * 0.93 + 0.2), 1, 1, 1, '#161a20', null, 0, Math.PI / 2, 0);
            policeAdd(trim, roundedBar(0.7, 3.0, 1.8, 0.25), 0.16 * l, 17.0, side * (half + 2.0), 1, 1, 1, '#161a20');
            policeBeam(trim, boxGeo, [0.16 * l, 16.0, side * half], [0.16 * l, 16.4, side * (half + 1.3)], 0.3, 0.3, '#2a3038');
          }
          // Windscreen centre post.
          const [, topFront] = profileAt(body.profile, 0.135),
            [, footFront] = profileAt(body.profile, 0.205);
          policeBeam(trim, boxGeo, [0.205 * l + 0.1, footFront + 0.6, 0], [0.135 * l + 0.1, topFront - 0.6, 0], 1.1, 0.3, '#0c0f14', null, [0, 0, 1]);
          // Ram bumper: a heavy plate, two uprights, a winch and tow hooks.
          policeAdd(trim, roundedBar(w * 0.9, 3.4, 1.6, 0.3), nose + 0.9, 7.2, 0, 1, 1, 1, '#12161b');
          for (const side of [-1, 1]) {
            policeAdd(trim, roundedBar(1.1, 5.6, 1.2, 0.25), nose + 1.1, 9.5, side * w * 0.26, 1, 1, 1, '#12161b');
            policeAdd(bright, S.cylinderLow, nose + 1.6, 6.6, side * w * 0.33, 0.5, 1.0, 0.5, '#8d949a', null, Math.PI / 2, 0, 0);
          }
          policeAdd(trim, roundedBar(w * 0.46, 0.7, 0.9, 0.25), nose + 1.2, 11.8, 0, 1, 1, 1, '#12161b');
          policeAdd(trim, S.cylinder, nose + 0.7, 8.2, 0, 1.0, w * 0.34, 1.0, '#2b3036', null, Math.PI / 2, 0, 0);
          // Grille and its LEDs; push-bar LEDs.
          policeAdd(trim, boxGeo, nose - 0.1, 10.4, 0, 0.3, 2.2, w * 0.5, '#0b0d10');
          for (const side of [-1, 1]) {
            light(lights, boxGeo, nose + 0.08, 10.4, side * w * 0.12, 0.1, 0.6, 1.2, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
            light(lights, boxGeo, nose + 1.72, 10.6, side * w * 0.26, 0.1, 1.5, 0.6, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
            anchor(nose + 2.1, 10.6, side * w * 0.26, side < 0 ? 'red' : 'blue', 12, [side < 0 ? 5 : 6], 0.8);
            light(lights, boxGeo, body.head[0] * l + 0.05, body.head[1] + 1.3, side * body.head[2] * w, 0.4, 0.2, 2.4, '#fdf6ea', 7);
          }
          // Antennas.
          for (const [ax, az, ah] of [[-0.4, -0.5, 5], [-0.36, -0.5, 4], [-0.42, 0.55, 4.5]]) policeAdd(trim, S.cylinderLow, ax * l, roofY + ah / 2, az * half, 0.1, ah, 0.1, '#0a0b0d');
          kit.roofDecal = { x: -0.33 * l, y: roofY + 0.04, length: 0.3 * l, width: w * 0.7, lift: null };
          // Rear doors hinged at the outer edges (their meshes are built per model).
          kit.doorHeight = 14;
          kit.doorY = 12.9;
        }
        kit.paint = policeGeometry(paint);
        kit.trim = policeGeometry(trim);
        kit.bright = bright.count ? policeGeometry(bright) : null;
        kit.lights = policeGeometry(lights, { channels: true });
        kit.beaconLeft = beaconLeft.count ? policeGeometry(beaconLeft) : null;
        kit.beaconRight = beaconRight.count ? policeGeometry(beaconRight) : null;
        policeKits.set(key, kit);
        return kit;
      }
      // Steel wheels with a chrome dog-dish hubcap (marked cars), black five-spoke
      // alloys (unmarked), a heavy eight-stud truck wheel (the BearCat).
      const policeRims = new Map();
      function policeRimGeometry(style, side, wheel) {
        const key = [style, side, wheel.r, wheel.width].join(':');
        if (policeRims.has(key)) return policeRims.get(key);
        const S = policeShapeKit(),
          set = policeSet(),
          r = wheel.r,
          face = side * (wheel.width / 2),
          across = Math.PI / 2;
        policeAdd(set, S.cylinder, 0, 0, face - side * 0.05, r * 0.72, 0.22, r * 0.72, '#202327', null, across, 0, 0);
        if (style === 'steel') {
          policeAdd(set, S.cylinder, 0, 0, face + side * 0.02, r * 0.64, 0.12, r * 0.64, '#16181b', null, across, 0, 0);
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            policeAdd(set, S.cylinderLow, Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46, face + side * 0.09, r * 0.07, 0.05, r * 0.07, '#050506', null, across, 0, 0);
          }
          policeAdd(set, S.dome, 0, 0, face + side * 0.08, r * 0.37, 0.42, r * 0.37, '#dfe4e7', null, side * across, 0, 0);
        } else if (style === 'alloy') {
          policeAdd(set, S.cylinder, 0, 0, face + side * 0.02, r * 0.66, 0.1, r * 0.66, '#101113', null, across, 0, 0);
          for (let i = 0; i < 5; i++)
            policeAdd(set, boxGeo, 0, 0, face + side * 0.1, r * 0.13, r * 1.26, 0.14, '#3a3e44', null, 0, 0, (i * Math.PI) / 5);
          policeAdd(set, S.cylinderLow, 0, 0, face + side * 0.16, r * 0.17, 0.1, r * 0.17, '#1a1c1f', null, across, 0, 0);
        } else {
          policeAdd(set, S.cylinder, 0, 0, face + side * 0.02, r * 0.64, 0.14, r * 0.64, '#1d2126', null, across, 0, 0);
          policeAdd(set, S.cylinder, 0, 0, face + side * 0.12, r * 0.3, 0.3, r * 0.3, '#3a4047', null, across, 0, 0);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            policeAdd(set, S.cylinderLow, Math.cos(a) * r * 0.22, Math.sin(a) * r * 0.22, face + side * 0.3, r * 0.04, 0.22, r * 0.04, '#9aa1a8', null, across, 0, 0);
          }
        }
        const geo = policeGeometry(set);
        policeRims.set(key, geo);
        return geo;
      }
      // ---- The model -----------------------------------------------------------------------
      /*
       * Builds a police vehicle with the same contract as makeVehicle's cars
       * (render3d.js): shell / cabin for the crumple and the panes, hood, bumpers,
       * wheels, lamps (headLeft, headRight, tailLeft, tailRight), nightLights in
       * lampOut order, dims for the door and trunk panels, rearDoors for the SWAT
       * team. `police` marks it for animatePoliceVehicle().
       */
      function makePoliceVehicle(vehicle, look) {
        claimPoliceResources();
        // The bodies are authored for a drawn scale of 0.8 (the patrol type's);
        // the agents' 'suv' and the SWAT 'van' are real-size types (cars3d.js), so
        // the scale is the model's own (`drawScale`, render3d.js makeVehicle).
        const spec = vehicleSpec(vehicle),
          l = spec.l / POLICE_DRAW_SCALE,
          w = (spec.w / POLICE_DRAW_SCALE) * 0.87,
          body = POLICE_BODIES[look.body],
          kit = policeKit(look, body, l, w),
          g = body.glass,
          group = new Three.Group(),
          bodyGroup = new Three.Group();
        group.add(bodyGroup);
        scene.add(group);
        const livery = look.unmarked ? null : policeLiveryTexture(look.livery, body, l, w),
          finish = look.unmarked ? { roughness: 0.3, metalness: 0.45 } : { roughness: 0.3, metalness: 0.06 },
          paint = new Three.MeshPhysicalMaterial({
            color: look.paint,
            map: livery,
            emissive: '#000000',
            emissiveMap: livery,
            roughness: finish.roughness,
            metalness: finish.metalness,
            clearcoat: 1,
            clearcoatRoughness: 0.06,
            envMapIntensity: 1,
          });
        const shell = mesh(kit.shell, paint, bodyGroup, 0, 0, 0),
          cabin = mesh(kit.cabin, policeGlass, bodyGroup, 0, 0, 0),
          hood = mesh(kit.hood, paint, bodyGroup, l * 0.34, body.h + 0.05, 0, l * 0.25, 0.4, w * (body.kind === 'bearcat' ? 0.82 : 0.7));
        hood.rotation.z = body.hoodTilt || 0;
        const panels = mesh(kit.paint, paint, bodyGroup, 0, 0, 0),
          trim = mesh(kit.trim, policeTrimMaterial, bodyGroup, 0, 0, 0);
        if (kit.bright) mesh(kit.bright, policeBrightMaterial, bodyGroup, 0, 0, 0);
        const lightMaterial = policeLightMaterial(),
          lights = mesh(kit.lights, lightMaterial, bodyGroup, 0, 0, 0);
        lights.castShadow = lights.receiveShadow = false;
        if (!look.unmarked) {
          const decals = mesh(policeDecalGeometry(look, body, l, w, kit), policeGlyphs().material, bodyGroup, 0, 0, 0);
          decals.castShadow = false;
        }
        const bumpers = body.bumpers.map(([x, y, sx, sy, sz]) => box(bodyGroup, x * l, y, 0, sx, sy, sz * w, policeBumperMaterial));
        const wheels = [];
        for (const side of [-1, 1])
          for (const fx of [-body.wheel.x, body.wheel.x]) {
            const wheel = new Three.Group(),
              r = body.wheel.r;
            wheel.position.set(fx * l, r, side * w * body.wheel.z);
            bodyGroup.add(wheel);
            wheels.push({ wheel, side });
            // The tyre stays the wheel's first child (hidden on a burnt wreck).
            const tire = mesh(wheelGeo, rubber, wheel, 0, 0, 0, r, body.wheel.width, r);
            tire.rotation.x = Math.PI / 2;
            mesh(kit.rims[side < 0 ? 0 : 1], policeWheelMaterial, wheel, 0, 0, 0);
          }
        const lamps = [],
          nightLights = [],
          [hx, hy, hz, hsx, hsy, hsz] = body.head,
          [tx, ty, tz, tsx, tsy, tsz] = body.tail;
        for (const side of [-1, 1]) {
          lamps.push(
            { mesh: box(bodyGroup, hx * l, hy, side * hz * w, hsx, hsy, hsz * w, warmLamp), key: side < 0 ? 'headLeft' : 'headRight', lit: warmLamp },
            { mesh: box(bodyGroup, tx * l, ty, side * tz * w, tsx, tsy, tsz * w, tailLamp), key: side < 0 ? 'tailLeft' : 'tailRight', lit: tailLamp },
          );
          // Head, tail per side: the order lampOut expects (damage3d.js).
          nightLights.push(halo(bodyGroup, hx * l + 0.5, hy, side * hz * w, 11, '#ffe9bd'), halo(bodyGroup, tx * l - 0.5, ty, side * tz * w, 7, '#ff5a44'));
        }
        const policeHalos = kit.anchors.map((a) => {
          const sprite = new Three.Sprite(policeHaloMaterials[a.color]);
          sprite.position.set(a.x, a.y, a.z);
          sprite.scale.set(a.size, a.size, 1);
          sprite.visible = false;
          bodyGroup.add(sprite);
          return { sprite, channels: a.channels, strength: a.strength };
        });
        const rearDoors = body.kind === 'bearcat' ? policeRearDoors(bodyGroup, l, w, kit, paint, look) : null;
        const bumperOrigins = bumpers.map((b) => b.position.clone());
        const wiperHost = {};
        if (body.kind === 'bearcat') addWipers(wiperHost, bodyGroup, 0.205 * l, 13.6, 0.16 * l, 19.5, w * 0.4);
        else addWipers(wiperHost, bodyGroup, g.xf * l, g.base + 0.4, lerpNumber(g.xf, g.rf, 0.55) * l, lerpNumber(g.base, g.roof, 0.55), g.wb * w * 0.92);
        const livePaint = livery ? policeImpostorPaint(livery) : null;
        return {
          wipers: wiperHost.wipers,
          group,
          body: bodyGroup,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          car: true,
          police: true,
          drawScale: POLICE_DRAW_SCALE,
          look,
          dims: { l, w, h: body.h, roof: g.roof, van: body.kind !== 'sedan' },
          shell,
          shellBase: shell.geometry.attributes.position.array,
          cabin,
          cabinBase: cabin.geometry.attributes.position.array,
          wheels,
          bumpers,
          bumperOrigins,
          hood,
          hoodBaseY: body.h + 0.05,
          lamps,
          damageVersion: -1,
          nightLights,
          rearDoors,
          // damage3d.js hooks: livery restored after the soot, satin (not metallic)
          // paint, black plastic bumpers, door and trunk panels in the livery's colours.
          liveryMap: livery,
          liveryColor: look.paint,
          finish,
          bumperMaterial: policeBumperMaterial,
          glass: policeGlass,
          panelGeometry: kit.door,
          trunkGeometry: kit.trunk,
          lightMaterial,
          levels: lightMaterial.uniforms.levels.value,
          policeHalos,
          wigwag: 0,
          reflective: -1,
          impostorParts: [
            { mesh: shell, material: livePaint || null, tint: true, shadow: true },
            { mesh: cabin, material: policeGlass, shadow: true },
            { mesh: hood, material: livePaint || null, tint: true },
            { mesh: panels, material: livePaint || null, tint: true },
            { mesh: trim, material: policeTrimMaterial },
            ...(kit.beaconLeft ? [{ geometry: kit.beaconLeft, beacon: 'left' }, { geometry: kit.beaconRight, beacon: 'right' }] : []),
          ],
        };
      }
      // The BearCat's rear doors: armour plate, a small window, hinges, SWAT.
      function policeRearDoors(bodyGroup, l, w, kit, paint, look) {
        const half = (w / 2) * 0.97,
          doors = [],
          frame = policeSet();
        // One door's trim, built once per size (the right door is the left turned round).
        const S = policeShapeKit();
        policeAdd(frame, boxGeo, -0.45, 2.6, 0, 0.12, 3.6, half * 0.55, '#0c0f14');
        policeAdd(frame, boxGeo, -0.5, 2.6, 0, 0.1, 3.0, half * 0.45, '#111b27');
        for (const y of [-5.0, 4.6]) policeAdd(frame, S.cylinderLow, -0.1, y, -half * 0.48, 0.35, 1.4, 0.35, '#2a3038');
        policeAdd(frame, boxGeo, -0.45, -1.5, half * 0.3, 0.3, 0.3, 1.8, '#9aa1a8');
        const trimGeo = policeGeometry(frame),
          text = policeSet();
        decalText(text, 'SWAT', [-0.46, -3.6, 0], [0, 0, 1], [0, 1, 0], 2.2, '#eef0ec');
        const textGeo = policeGeometry(text);
        for (const s of [-1, 1]) {
          const pivot = new Three.Group();
          pivot.position.set(-0.5 * l - 0.4, kit.doorY, s * half);
          bodyGroup.add(pivot);
          const panel = mesh(kit.door, paint, pivot, 0, 0, (-s * half) / 2, 0.7, kit.doorHeight, half * 0.98);
          panel.castShadow = true;
          const inner = new Three.Group();
          inner.position.set(0, 0, (-s * half) / 2);
          // The trim was built for the left door; the right one is its mirror image.
          if (s > 0) inner.scale.z = -1;
          pivot.add(inner);
          mesh(trimGeo, policeTrimMaterial, inner, 0, 0, 0).castShadow = false;
          const words = mesh(textGeo, policeGlyphs().material, pivot, 0, 0, (-s * half) / 2);
          words.castShadow = false;
          doors.push({ pivot, side: s });
        }
        return doors;
      }
      // ---- Per frame -----------------------------------------------------------------------
      /*
       * Flash pattern, wig-wag headlamps, night halos and the livery's reflective
       * glow, once a frame for each police model in view (render3d.js vehicle pass).
       */
      function animatePoliceVehicle(c, m) {
        const lampsOn = vehicleLampAmount(),
          mode = policeLightLevels(c, m.levels, gameTime),
          levels = m.levels;
        policeLightGain.value = 3.4 + lampsOn * 2.6;
        levels[7] = c.hp > 0 ? 0.35 + lampsOn * 0.65 : 0;
        // Wig-wag: the headlamps alternate while running hot.
        const wig = mode === 1 ? ((gameTime + c.id * 0.13) * 2.6) % 1 < 0.5 ? 1 : 2 : 0;
        if (wig || m.wigwag) {
          policeWigwagLamp.color.setScalar(policeLightGain.value * 0.55);
          const lights = c.damage?.lights;
          for (const lamp of m.lamps)
            if (lamp.lit === warmLamp && !lights?.[lamp.key])
              lamp.mesh.material = !wig ? warmLamp : (lamp.key === 'headLeft') === (wig === 1) ? policeWigwagLamp : policeLampOff;
          m.wigwag = wig;
        }
        // Halos over the lit segments: faint by day, blooming at night.
        if (mode) {
          const scale = 0.25 + lampsOn * 0.5;
          for (const h of m.policeHalos) {
            let level = 0;
            for (const k of h.channels) level = Math.max(level, levels[k]);
            if (level > 0.05) queueVehicleHalo(h.sprite, level * h.strength * scale);
          }
        }
        // Reflective livery: the white panels catch light at night (the burnt
        // shell's embers own the emissive while it is charred).
        if (m.liveryMap) {
          const glow = m.charred ? -1 : Math.round(lampsOn * 20) / 20;
          if (m.reflective !== glow) {
            m.reflective = glow;
            if (glow >= 0) m.paint.emissive.setScalar(glow * 0.07);
          }
        }
      }
      // The pools of red and blue light a flashing car throws on the road at night
      // (lighting3d.js); returns 0 for any other vehicle.
      function policeRoadGlow(m, side) {
        if (!m?.police) return 0;
        const l = m.levels;
        return side < 0 ? Math.max(l[0], l[1], l[5]) : Math.max(l[2], l[3], l[6]);
      }
      // Beacon levels for the body impostors (no model needed): left, right.
      const policeScratchLevels = new Float32Array(8),
        policeBeacon = { left: 0, right: 0 };
      function policeBeaconLevels(c) {
        policeLightLevels(c, policeScratchLevels, gameTime);
        const l = policeScratchLevels;
        policeBeacon.left = Math.max(l[0], l[1]);
        policeBeacon.right = Math.max(l[2], l[3]);
        return policeBeacon;
      }
