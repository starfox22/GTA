      // Police 3D asset body: the 'crownvic' patrol body drawn from the downloaded police sedan (vehicle-assets3d.js ASSET
      // CARS) in the game's own liveries, unit numbers and light channels, on makePoliceVehicle's contract.
      /**
       * POLICE ASSET BODY
       * The body and livery stay the game's choice (driveby-seats.js policeLookChoice, pickPoliceLook): only the
       * 'crownvic' body is drawn from the model (`look.asset`, set in pickPoliceLook while vehicleAssetModel('police')
       * has one), every livery on it. The livery canvas is the procedural crownvic's (policeLiveryTexture, painted in
       * the lofted shell's UV space: u along the car, v round its section); the model's shell gets UVs in that space by
       * projecting each vertex on the crownvic's section ring scaled to the model's own section at that station
       * (`section`, measured by tools/vehicle_models.py), so the doors, stripes, POLICE and the star land where they
       * land on the procedural body. Pillars and roof sample the livery's pillar and roof swatches, the hood its hood
       * swatch. The model's light bar lenses are the light mesh (red left, white takedowns, blue right on the police
       * light channels, with beacons for the body impostors and halo anchors); its housing joins the trim. Unmarked cars
       * leave the bar off and get the dash, grille and rear-deck lights. Wheels, lamps, glass and the cabin are the
       * model's; the rear badges are the model's own.
       */
      const policeAssetKits = new Map();
      function policeAssetKit(look, body, l, w) {
        const marked = look.equipment === 'marked',
          key = [body.name, look.equipment, l, w].join(':');
        if (policeAssetKits.has(key)) return policeAssetKits.get(key);
        const data = vaData(),
          model = data.header.models.police,
          M = UNITS_PER_METRE / POLICE_DRAW_SCALE,
          k = l / model.dims[0],
          gm = model.glass,
          g = {
            base: gm.base * k,
            roof: gm.roof * k,
            xf: (gm.xf * k) / l,
            xb: (gm.xb * k) / l,
            rf: (gm.rf * k) / l,
            rb: (gm.rb * k) / l,
            wb: (gm.halfBase * k) / w,
            wt: (gm.halfTop * k) / w,
            bow: 0,
            bulge: 0,
            arch: 0,
            crown: (gm.crown || 0) * k,
            screenCurve: 0,
            backCurve: 0,
          },
          // The model's section at x (model units): bottom, top and half width of the body below the belt.
          station = (x) => {
            const sec = model.section,
              t = clamp(((x / k - model.x0) / (model.x1 - model.x0)) * (sec.length - 1), 0, sec.length - 1),
              i = Math.min(sec.length - 2, Math.floor(t)),
              f = t - i;
            return { yb: lerpNumber(sec[i][0], sec[i + 1][0], f) * k, top: lerpNumber(sec[i][1], sec[i + 1][1], f) * k, half: lerpNumber(sec[i][2], sec[i + 1][2], f) * k };
          },
          shell = vaGeometry(model, data, 'shell', k);
        policeAssetLiveryUv(shell, body, l, w, station);
        const trimParts = marked ? ['trim', 'lightbar', 'cabin'] : ['trim', 'cabin'],
          trim = vaGeometry(model, data, trimParts, k),
          outer = trimParts.slice(0, -1).reduce((n, part) => n + (model.parts[part]?.triangles || 0), 0) * 3,
          kit = {
            asset: model,
            type: 'police',
            l,
            k,
            glass: g,
            shell,
            cabin: vaGeometry(model, data, 'glass', k, swatchUv(POLICE_SWATCH.black)),
            hood: vaGeometry(model, data, 'hood', k, swatchUv(POLICE_SWATCH.hood)) || policeSwatchBox(POLICE_SWATCH.hood),
            hoodBaseY: model.hinge[1] * k,
            hoodHinge: model.hinge[0] * k,
            paint: policeAssetPanels(vaGeometry(model, data, 'panels', k)),
            door: policeSwatchBox(POLICE_SWATCH.door),
            trunk: policeSwatchBox(POLICE_SWATCH.trunk),
            wheel: body.wheel,
            trim,
            trimOuter: trim ? civDrawRange(trim, outer) : null,
            sill: model.sill * k,
            anchors: [],
            lamps: {},
            halos: {},
            assetWheels: [],
            badge: null,
            roofDecal: null,
            seats: carSeatPlan(g, l, w, M, body.name, { hipX: ((gm.xf - 1.15) * k) / l }),
          };
        const tailX = -0.48 * l,
          hingeX = Math.max(g.xb * l + 0.02 * M, tailX + 0.06 * l);
        kit.trunkDeck = { hingeX, hingeY: station(hingeX).top, tailX, tailY: station(tailX).top };
        for (const name of ['headLeft', 'headRight', 'tailLeft', 'tailRight']) {
          kit.lamps[name] = vaGeometry(model, data, name, k);
          const h = model.lamps[name];
          if (h) kit.halos[name] = { x: h.x * k, y: h.y * k, z: h.z * k, size: clamp(h.size / 0.22, 0.6, 1.4) };
        }
        model.wheels.forEach((wh, i) => {
          kit.assetWheels.push({ x: wh.x * k, y: wh.y * k, z: wh.z * k, r: wh.r * k, side: wh.side, front: wh.front, tyre: vaGeometry(model, data, 'wheel' + i + '.tyre', k), rim: vaGeometry(model, data, 'wheel' + i + '.rim', k) });
        });
        kit.assetWheels.sort((a, b) => b.x - a.x || a.side - b.side);
        // ---- Lights: the bar's lenses (marked) or the dash, grille and deck lights (unmarked), and the rear window bar.
        const lights = policeSet(),
          beaconLeft = policeSet(),
          beaconRight = policeSet(),
          anchor = (x, y, z, color, size, channels, strength = 1) => kit.anchors.push({ x, y, z, color, size, channels, strength }),
          roofTop = g.roof + g.crown;
        const lens = marked ? vaGeometry(model, data, 'beacon', k) : null;
        if (lens) {
          const box = new Three.Box3().setFromBufferAttribute(lens.attributes.position),
            length = box.max.z - box.min.z,
            segments = [
              [POLICE_RED, 0],
              [POLICE_RED, 0],
              [POLICE_RED, 1],
              [POLICE_WHITE, 4],
              [POLICE_WHITE, 4],
              [POLICE_BLUE, 2],
              [POLICE_BLUE, 3],
              [POLICE_BLUE, 3],
            ],
            x = (box.min.x + box.max.x) / 2,
            y = box.max.y;
          policeAssetLens(lens, (zc) => segments[clamp(Math.floor(((zc - box.min.z) / Math.max(1e-6, length)) * 8), 0, 7)], lights, beaconLeft, beaconRight);
          anchor(x, y + 0.4, -length * 0.3, 'red', 22, [0, 1]);
          anchor(x, y + 0.4, length * 0.3, 'blue', 22, [2, 3]);
          anchor(box.max.x + 0.6, (box.min.y + y) / 2, 0, 'white', 12, [4], 0.45);
          kit.lightbarX = x;
          kit.lightbarDepth = box.max.x - box.min.x;
          // Rear window light bar along the top of the rear glass (channels 5 and 6).
          const rearTop = glassPoint(g, l, w, 'rear', 0, 0.86);
          for (const side of [-1, 1]) {
            policeAdd(lights, boxGeo, rearTop[0] - 0.12, rearTop[1] - 0.1, side * g.wt * w * 0.45, 0.14, 0.4, g.wt * w * 0.7, side < 0 ? POLICE_RED : POLICE_BLUE, { channel: side < 0 ? 5 : 6 });
            anchor(rearTop[0] - 0.4, rearTop[1], side * g.wt * w * 0.45, side < 0 ? 'red' : 'blue', 12, [side < 0 ? 5 : 6], 0.7);
          }
          // The unit number on the roof behind the bar (cars read upright heading east).
          // Its height: the roof's top line (the model's centre-line profile) over the number's length.
          const front = box.min.x - 0.5,
            rear = g.rb * l + 0.6,
            profile = model.profile,
            span = model.x1 - model.x0;
          let top = roofTop;
          for (let i = 0; i < profile.length; i++) {
            const x = (model.x0 + (span * i) / (profile.length - 1)) * k;
            if (x >= rear - 0.5 && x <= front + 0.5) top = Math.max(top, profile[i] * k);
          }
          kit.roofDecal = { x: (front + rear) / 2, y: top + 0.05, length: front - rear, width: 2 * g.wt * w * 0.84, lift: null };
        } else {
          for (const [s, color, channel] of [[-0.62, POLICE_RED, 0], [-0.3, POLICE_RED, 1], [0.3, POLICE_BLUE, 2], [0.62, POLICE_BLUE, 3]]) {
            const p = glassPoint(g, l, w, 'front', s, 0.9),
              q = glassPoint(g, l, w, 'front', s, 0.8),
              nx = p[1] - q[1],
              ny = q[0] - p[0],
              n = Math.hypot(nx, ny);
            policeAdd(lights, boxGeo, p[0] + (nx / n) * 0.07, p[1] + (ny / n) * 0.07, p[2], 0.14, 0.45, 1.5, color, { channel }, 0, 0, Math.atan2(ny, nx));
            policeAdd(s < 0 ? beaconLeft : beaconRight, boxGeo, p[0] + 0.1, p[1] + 0.1, p[2], 0.3, 0.5, 1.5, color);
          }
          anchor(glassPoint(g, l, w, 'front', -0.45, 0.9)[0], g.roof - 0.4, -2.2, 'red', 12, [0, 1], 0.8);
          anchor(glassPoint(g, l, w, 'front', 0.45, 0.9)[0], g.roof - 0.4, 2.2, 'blue', 12, [2, 3], 0.8);
          const head = kit.halos.headLeft,
            nose = model.x1 * k,
            grilleY = head ? head.y : g.base * 0.75;
          for (const side of [-1, 1]) {
            policeAdd(lights, boxGeo, nose - 0.02, grilleY, side * w * 0.11, 0.12, 0.5, 1.2, side < 0 ? POLICE_RED : POLICE_BLUE, { channel: side < 0 ? 5 : 6 });
            anchor(nose + 0.4, grilleY, side * w * 0.11, side < 0 ? 'red' : 'blue', 10, [side < 0 ? 5 : 6], 0.8);
            const deck = glassPoint(g, l, w, 'rear', side * 0.45, 0.12);
            policeAdd(lights, boxGeo, deck[0] - 0.1, deck[1], deck[2], 0.14, 0.4, 2.4, side < 0 ? POLICE_RED : POLICE_BLUE, { channel: side < 0 ? 5 : 6 });
            anchor(deck[0] - 0.4, deck[1], deck[2], side < 0 ? 'red' : 'blue', 10, [side < 0 ? 5 : 6], 0.7);
          }
        }
        kit.lights = policeGeometry(lights, { channels: true });
        kit.beaconLeft = beaconLeft.count ? policeGeometry(beaconLeft) : null;
        kit.beaconRight = beaconRight.count ? policeGeometry(beaconRight) : null;
        // Small numbers on the trunk lid and the rear fenders (policeDecalGeometry), on the model's own surfaces.
        const trunkX = (body.trunk || -0.4) * l,
          sideX = -0.365 * l,
          side = station(sideX),
          sideY = side.yb + (side.top - side.yb) * 0.6;
        kit.trunkDecal = { x: trunkX, y: station(trunkX).top + 0.04 };
        kit.sideDecal = { x: sideX, y: sideY, half: policeAssetHalf(shell, sideX, sideY, 0.15 * M, 0.1 * M) || side.half };
        policeAssetKits.set(key, kit);
        return kit;
      }
      /*
       * The livery's UVs on the model's shell: u along the car as the lofted shell's, v the point of the crownvic's
       * section ring (policeRing / policeRingV) nearest the vertex, the ring scaled to the model's section there.
       */
      function policeAssetLiveryUv(geo, body, l, w, station) {
        const ring = policeRing(body),
          vs = policeRingV(body, w),
          n = ring.length,
          pos = geo.attributes.position,
          uv = geo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i),
            s = station(x),
            H = Math.max(1e-3, s.top - s.yb),
            py = pos.getY(i) - s.yb,
            pz = pos.getZ(i);
          let best = Infinity,
            v = vs[0];
          for (let r = 0; r < n - 1; r++) {
            const ay = ring[r][0] * H,
              az = ring[r][1] * s.half,
              dy = ring[r + 1][0] * H - ay,
              dz = ring[r + 1][1] * s.half - az,
              len2 = dy * dy + dz * dz,
              t = len2 > 0 ? clamp(((py - ay) * dy + (pz - az) * dz) / len2, 0, 1) : 0,
              ey = ay + dy * t - py,
              ez = az + dz * t - pz,
              d = ey * ey + ez * ez;
            if (d < best) {
              best = d;
              v = vs[r] + (vs[r + 1] - vs[r]) * t;
            }
          }
          uv.setXY(i, clamp(x / l + 0.5, 0, 1), v);
        }
        uv.needsUpdate = true;
      }
      // Pillars and roof: each triangle on the livery's roof swatch (facing up) or its pillar swatch, vertices unshared
      // where the two meet (a triangle never blends across the swatch band).
      function policeAssetPanels(geo) {
        if (!geo) return policeSwatchBox(POLICE_SWATCH.roof);
        const pos = geo.attributes.position,
          nor = geo.attributes.normal,
          index = geo.index.array,
          roofUv = swatchUv(POLICE_SWATCH.roof),
          pillarUv = swatchUv(POLICE_SWATCH.pillar),
          remap = new Map(),
          position = [],
          normal = [],
          uvs = [],
          out = [],
          a = new Three.Vector3(),
          b = new Three.Vector3(),
          c = new Three.Vector3();
        for (let t = 0; t < index.length; t += 3) {
          a.fromBufferAttribute(pos, index[t]);
          b.fromBufferAttribute(pos, index[t + 1]);
          c.fromBufferAttribute(pos, index[t + 2]);
          b.sub(a);
          c.sub(a);
          const face = b.cross(c).normalize(),
            roof = face.y > 0.7 ? 1 : 0,
            uvAt = roof ? roofUv : pillarUv;
          for (let j = 0; j < 3; j++) {
            const vi = index[t + j],
              key = vi * 2 + roof;
            let ni = remap.get(key);
            if (ni === undefined) {
              ni = position.length / 3;
              remap.set(key, ni);
              position.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
              normal.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi));
              uvs.push(uvAt[0], uvAt[1]);
            }
            out.push(ni);
          }
        }
        const split = new Three.BufferGeometry();
        split.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        split.setAttribute('normal', new Three.Float32BufferAttribute(normal, 3));
        split.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
        split.setIndex(out);
        split.computeBoundingSphere();
        split.computeBoundingBox();
        sharedGeometries.delete(geo);
        sharedGeometries.add(split);
        return split;
      }
      // The light bar's lens triangles into the light mesh (colour and channel by the segment across the car), the
      // coloured ones also into the impostors' beacons.
      function policeAssetLens(lens, segmentAt, lights, beaconLeft, beaconRight) {
        const pos = lens.attributes.position,
          nor = lens.attributes.normal,
          index = lens.index.array,
          colour = new Three.Color();
        for (let t = 0; t < index.length; t += 3) {
          const zc = (pos.getZ(index[t]) + pos.getZ(index[t + 1]) + pos.getZ(index[t + 2])) / 3,
            [color, channel] = segmentAt(zc);
          colour.set(color);
          for (const set of [lights, color === POLICE_RED ? beaconLeft : color === POLICE_BLUE ? beaconRight : null]) {
            if (!set) continue;
            for (let j = 0; j < 3; j++) {
              const vi = index[t + j];
              set.position.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
              set.normal.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi));
              set.uv.push(0, 0);
              set.color.push(colour.r, colour.g, colour.b);
              set.channel.push(channel);
              set.index.push(set.count + j);
            }
            set.count += 3;
          }
        }
        sharedGeometries.delete(lens);
        lens.dispose();
      }
      // The shell's outer half width round (x, y), within `dx` along and `dy` up.
      function policeAssetHalf(geo, x, y, dx, dy) {
        const pos = geo.attributes.position;
        let half = 0;
        for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getX(i) - x) < dx && Math.abs(pos.getY(i) - y) < dy) half = Math.max(half, Math.abs(pos.getZ(i)));
        return half;
      }
      /*
       * A patrol car on the asset body: makePoliceVehicle's model (damage3d.js, vehicle-merge3d.js vmPolicePlan,
       * flight-view3d.js impostors, animatePoliceVehicle) with the model's shell, glass, trim, lamps and wheels.
       */
      function makeAssetPoliceVehicle(vehicle, look) {
        claimPoliceResources();
        const spec = vehicleSpec(vehicle),
          l = spec.l / POLICE_DRAW_SCALE,
          w = (spec.w / POLICE_DRAW_SCALE) * 0.87,
          body = POLICE_BODIES[look.body],
          kit = policeAssetKit(look, body, l, w),
          g = kit.glass,
          M = UNITS_PER_METRE / POLICE_DRAW_SCALE,
          assetMaterials = vaMaterials(),
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
          cabin = mesh(kit.cabin, policeCabinGlass(), bodyGroup, 0, 0, 0),
          hood = mesh(kit.hood, paint, bodyGroup, 0, 0, 0),
          panels = mesh(kit.paint, paint, bodyGroup, 0, 0, 0);
        hood.castShadow = false;
        cabin.castShadow = false;
        panels.castShadow = true;
        if (kit.trim) mesh(kit.trim, assetMaterials.trim, bodyGroup, 0, 0, 0);
        const lightMaterial = policeLightMaterial(),
          lights = mesh(kit.lights, lightMaterial, bodyGroup, 0, 0, 0);
        lights.castShadow = lights.receiveShadow = false;
        if (!look.unmarked) mesh(policeDecalGeometry(look, body, l, w, kit), policeGlyphs().material, bodyGroup, 0, 0, 0).castShadow = false;
        const wheels = [];
        for (const wh of kit.assetWheels) {
          const wheel = new Three.Group();
          wheel.position.set(wh.x, wh.y, wh.z);
          bodyGroup.add(wheel);
          wheels.push({ wheel, side: wh.side, front: wh.front, radius: wh.r });
          // The tyre stays the wheel's first child (hidden on a burnt wreck).
          mesh(wh.tyre || policeSwatchBox(POLICE_SWATCH.black), assetMaterials.rubber, wheel, 0, 0, 0).castShadow = false;
          if (wh.rim) mesh(wh.rim, assetMaterials.rim, wheel, 0, 0, 0).castShadow = false;
        }
        const lamps = [],
          nightLights = [];
        for (const side of [-1, 1])
          for (const kind of ['head', 'tail']) {
            const key = kind + (side < 0 ? 'Left' : 'Right'),
              geo = kit.lamps[key],
              lit = kind === 'head' ? warmLamp : tailLamp,
              h = kit.halos[key] || { x: (kind === 'head' ? 0.49 : -0.49) * l, y: g.base * 0.75, z: side * w * 0.33, size: 1 };
            if (geo) {
              const lamp = mesh(geo, lit, bodyGroup, 0, 0, 0);
              lamp.castShadow = false;
              lamps.push({ mesh: lamp, key, lit });
            }
            // Head, tail per side: the order lampOut expects (damage3d.js).
            nightLights.push(halo(bodyGroup, h.x + (kind === 'head' ? 0.5 : -0.5), h.y, h.z, (kind === 'head' ? 11 : 7) * (h.size || 1), kind === 'head' ? '#ffe9bd' : '#ff5a44'));
          }
        const policeHalos = kit.anchors.map((a) => {
          const sprite = new Three.Sprite(policeHaloMaterials[a.color]);
          sprite.position.set(a.x, a.y, a.z);
          sprite.scale.set(a.size, a.size, 1);
          sprite.visible = false;
          bodyGroup.add(sprite);
          return { sprite, channels: a.channels, strength: a.strength };
        });
        const livePaint = livery ? policeImpostorPaint(livery) : null;
        return {
          wipers: undefined,
          group,
          body: bodyGroup,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          car: true,
          police: true,
          asset: kit.asset.title,
          drawScale: POLICE_DRAW_SCALE,
          look,
          dims: { l, w, h: g.base, roof: g.roof, van: false, sill: kit.sill + 0.1 * M },
          shell,
          shellBase: shell.geometry.attributes.position.array,
          kit,
          panels,
          cabin,
          cabinBase: cabin.geometry.attributes.position.array,
          wheels,
          bumpers: [],
          bumperOrigins: [],
          hood,
          hoodBaseY: kit.hoodBaseY,
          hoodHinge: kit.hoodHinge,
          lamps,
          damageVersion: -1,
          nightLights,
          rearDoors: null,
          liveryMap: livery,
          liveryColor: look.paint,
          finish,
          bumperMaterial: null,
          bumperMaterials: [],
          glass: cabin.material,
          panelGeometry: kit.door,
          trunkGeometry: kit.trunk,
          trunkDeck: kit.trunkDeck,
          seats: kit.seats,
          seated: 0,
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
            ...(kit.trimOuter ? [{ geometry: kit.trimOuter, material: assetMaterials.trim }] : []),
            ...(kit.beaconLeft ? [{ geometry: kit.beaconLeft, beacon: 'left' }, { geometry: kit.beaconRight, beacon: 'right' }] : []),
          ],
        };
      }
