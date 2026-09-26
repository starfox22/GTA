      // ---- LIVERY ------------------------------------------------------------------------
      /*
       * A body's decal layer (see LIVERY above): transparent over the paint, with
       * the shut lines, the body's own graphics (`body.livery(g, f, k)`: stripes,
       * checkers, lettering, cladding) and the swatch band. Premultiplied, so the
       * mipmaps do not darken the edges of light lettering.
       */
      const civLiveries = new Map();
      function civLiveryTexture(body, l, w) {
        const key = body.name + ':' + l.toFixed(2) + ':' + w.toFixed(2);
        if (civLiveries.has(key)) return civLiveries.get(key);
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const g = canvas.getContext('2d'),
          f = liveryFrame(body, l, w),
          M = CAR_M,
          seam = 'rgba(8,9,10,0.62)',
          seamWidth = 0.006 * M;
        g.clearRect(0, 0, 1024, 512);
        // Shut lines: door fronts and backs from the sill to the belt, with the
        // door tops and the fuel flap, from the body's `doors` ([front, back] pairs, fractions of l).
        const sill = body.yb + 0.08 * M,
          belt = body.h - 0.02 * M;
        for (const [front, back] of body.doors || []) {
          liveryBand(g, f, front * l - seamWidth, front * l + seamWidth, sill, belt, seam);
          liveryBand(g, f, back * l - seamWidth, back * l + seamWidth, sill, belt, seam);
          liveryBand(g, f, back * l, front * l, sill - seamWidth, sill + seamWidth, 'rgba(8,9,10,0.35)');
        }
        if (body.fuel) {
          const [x, y] = body.fuel;
          g.strokeStyle = 'rgba(8,9,10,0.5)';
          g.lineWidth = 2;
          g.strokeRect(f.X(x * l - 0.09 * M), f.Y(y * M + 0.09 * M, 1), f.X(0.18 * M) - f.X(0), f.Y(y * M - 0.09 * M, 1) - f.Y(y * M + 0.09 * M, 1));
        }
        // The top of the car in canvas rows: z across the roof and hood (the
        // kit's top projection, which the reference section's UVs agree with).
        const ringV = policeRingV(body, w),
          vMid = ringV[(ringV.length - 1) / 2],
          ring = civRing(body.section),
          topRef = body.uvTop || body.h;
        let ringTotal = 0;
        for (let j = 1; j < ring.length; j++) ringTotal += Math.hypot((ring[j][0] - ring[j - 1][0]) * (topRef - body.yb), ((ring[j][1] - ring[j - 1][1]) * w) / 2);
        const topRow = (z) => (1 - (vMid + (z / ringTotal) * (1 - POLICE_SWATCH_BAND))) * 512;
        if (body.livery)
          body.livery(g, f, {
            l,
            w,
            M,
            band: liveryBand,
            polygon: liveryPolygon,
            text: liveryText,
            draw: liveryDraw,
            top: liveryTop,
            seams: liverySeams,
            topRow,
            // A stripe along the top between x0 and x1, z0..z1 across (metres from the centre line).
            stripe(x0, x1, z0, z1, color) {
              g.fillStyle = color;
              const a = topRow(z0 * M),
                b = topRow(z1 * M);
              g.fillRect(f.X(x0), Math.min(a, b), f.X(x1) - f.X(x0), Math.abs(b - a));
            },
          });
        // The swatch band: paint (clear), roof, black, lower cladding, accent, silver, dark, white.
        const swatches = ['rgba(0,0,0,0)', body.roofColor || 'rgba(0,0,0,0)', '#0c0d0f', body.lowerColor || '#1b1d20', body.accentColor || '#0c0d0f', '#b9bec3', '#1c1e21', '#eeeeea'];
        swatches.forEach((color, i) => {
          g.clearRect((i * 1024) / 8, 512 * (1 - POLICE_SWATCH_BAND), 1024 / 8, 512 * POLICE_SWATCH_BAND);
          g.fillStyle = color;
          g.fillRect((i * 1024) / 8, 512 * (1 - POLICE_SWATCH_BAND), 1024 / 8, 512 * POLICE_SWATCH_BAND);
        });
        const texture = policeCanvasTexture(canvas);
        texture.premultiplyAlpha = true;
        civLiveries.set(key, texture);
        return texture;
      }
      const civLetterings = new Map();
      function civLettering(body, l, w) {
        const key = body.name + ':' + l.toFixed(2);
        if (civLetterings.has(key)) return civLetterings.get(key);
        const set = policeSet();
        for (const [text, origin, right, up, height, color] of body.lettering(l, w, CAR_M)) decalText(set, text, origin, right, up, height, color);
        const geo = policeGeometry(set);
        civLetterings.set(key, geo);
        return geo;
      }
      // What DeadEndCity.carModels reports for one model.
      function civilianModelReport(c, m) {
        let draws = 0,
          casters = 0,
          triangles = 0;
        const parts = [];
        m.group.traverse((o) => {
          if (!o.isMesh || !o.visible) return;
          const g = o.geometry,
            tris = Math.round((g.index ? g.index.count : g.attributes.position.count) / 3);
          draws += Array.isArray(o.material) ? g.groups.length || 1 : 1;
          if (o.castShadow) casters++;
          triangles += tris;
          parts.push([o.material?.name || o.material?.type || '?', tris]);
        });
        parts.sort((a, b) => b[1] - a[1]);
        return { id: c.id, type: c.type, draws, casters, triangles, heaviest: parts.slice(0, 6) };
      }
      // ---- The model -----------------------------------------------------------------------
      const civLampMaterials = {};
      function civLampSet() {
        if (civLampMaterials.headOn) return civLampMaterials;
        Object.assign(civLampMaterials, {
          // Lit: the lamp's own colours, past the bloom threshold.
          headOn: new Three.MeshBasicMaterial({ vertexColors: true, color: new Three.Color(2.6, 2.5, 2.3) }),
          // Off: clear lenses over chrome reflectors and dark projectors.
          headOff: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.85, envMapIntensity: 1.5 }),
          tailOn: new Three.MeshBasicMaterial({ vertexColors: true, color: new Three.Color(1.5, 1.2, 1.2) }),
          tailOff: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.2, color: new Three.Color(1, 0.85, 0.85), emissive: new Three.Color(0.16, 0.01, 0.01), envMapIntensity: 1.2 }),
          brake: new Three.MeshBasicMaterial({ vertexColors: true, color: new Three.Color(3.4, 1.6, 1.5) }),
        });
        for (const m of Object.values(civLampMaterials)) sharedMaterials.add(m);
        return civLampMaterials;
      }
      /*
       * A civilian car on the damage contract (render3d.js makeVehicle, damage3d.js):
       * shell / cabin crumple and crack pane by pane, hood, bumpers, wheels, lamps
       * (headLeft, headRight, tailLeft, tailRight; `lit` is the lamp's resting
       * material, animateCivilianCar lights it), nightLights in lampOut order.
       */
      function makeCivilianCar(vehicle) {
        const body = CAR_BODIES[vehicle.type],
          spec = vehicleSpec(vehicle),
          l = spec.l,
          w = spec.w * 0.87,
          materials = civSharedMaterials(),
          lampMaterials = civLampSet(),
          kit = civKit(body, l, w),
          group = new Three.Group(),
          bodyGroup = new Three.Group();
        group.add(bodyGroup);
        scene.add(group);
        const livery = civLiveryTexture(body, l, w),
          finish = body.finish ? { ...body.finish } : civFinish(vehicle.color, vehicle.id),
          paint = civPaintMaterial(vehicle.color, livery, finish);
        const shell = mesh(kit.shell, paint, bodyGroup, 0, 0, 0),
          cabin = kit.cabin ? mesh(kit.cabin, materials.glass, bodyGroup, 0, 0, 0) : null,
          hood = mesh(kit.hood, paint, bodyGroup, 0.34 * l, kit.hoodBaseY, 0, 0.25 * l, 1, 1),
          panels = mesh(kit.paint, paint, bodyGroup, 0, 0, 0),
          trim = mesh(kit.trim, materials.trim, bodyGroup, 0, 0, 0),
          drl = kit.drl ? mesh(kit.drl, materials.drlOff, bodyGroup, 0, 0, 0) : null;
        if (drl) drl.castShadow = false;
        // The shell, glass and trim cast the car's shadow; the hood and panels lie on them.
        hood.castShadow = panels.castShadow = false;
        const bumperMaterial = { paint, black: materials.bumperBlack, chrome: materials.bumperChrome },
          bumpers = kit.bumpers.map((b) => {
            const m = mesh(b.geo, bumperMaterial[b.material] || paint, bodyGroup, b.centre.x, b.centre.y, b.centre.z, b.size.x, b.size.y, b.size.z);
            m.castShadow = false;
            return m;
          });
        const wheels = [];
        for (const [i, wh] of kit.wheels.entries())
          for (const side of [-1, 1]) {
            const wheel = new Three.Group();
            wheel.position.set(wh.x, wh.r, side * wh.z);
            bodyGroup.add(wheel);
            wheels.push({ wheel, side, front: wh.front, radius: wh.r });
            // The tyre stays the wheel's first child (hidden on a burnt wreck).
            const tire = mesh(kit.tyre, materials.rubber, wheel, 0, 0, 0, wh.r, wh.width, wh.r);
            tire.rotation.x = Math.PI / 2;
            mesh(kit.rims[i][side < 0 ? 0 : 1], materials.wheel, wheel, 0, 0, 0);
          }
        const lamps = [],
          nightLights = [];
        for (const side of [-1, 1])
          for (const kind of ['head', 'tail']) {
            const key = kind + (side < 0 ? 'Left' : 'Right'),
              geo = kit.lamps[key],
              lit = kind === 'head' ? lampMaterials.headOff : lampMaterials.tailOff;
            if (geo) {
              const lamp = mesh(geo, lit, bodyGroup, 0, 0, 0);
              lamp.castShadow = false;
              lamps.push({ mesh: lamp, key, lit, kind });
            }
            const h = kit.halos[key] || { x: (kind === 'head' ? 0.49 : -0.49) * l, y: body.h * 0.8, z: side * w * 0.33, size: 1 };
            // Head, tail per side: the order lampOut expects (damage3d.js).
            nightLights.push(halo(bodyGroup, h.x + (kind === 'head' ? 0.4 : -0.4), h.y, h.z, (kind === 'head' ? 11 : 7) * (h.size || 1), kind === 'head' ? '#ffe9bd' : '#ff5a44'));
          }
        const bumperOrigins = bumpers.map((b) => b.position.clone());
        const wiperHost = {},
          g = body.glass;
        if (g && !g.open && !body.noWipers) addWipers(wiperHost, bodyGroup, g.xf * l, g.base + 0.03 * CAR_M, lerpNumber(g.xf, g.rf, 0.55) * l, lerpNumber(g.base, g.roof, 0.55), g.wb * w * 0.9);
        const extra = body.extras ? body.extras(bodyGroup, vehicle, paint) : null;
        // Lettering from the police glyph atlas (the cab's roof sign).
        if (body.lettering) {
          const decals = mesh(civLettering(body, l, w), policeGlyphs().material, bodyGroup, 0, 0, 0);
          decals.castShadow = false;
        }
        return {
          wipers: wiperHost.wipers,
          group,
          body: bodyGroup,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          car: true,
          civilian: true,
          realSize: true,
          dims: { l, w, h: body.h, roof: g ? g.roof : body.h, van: !!body.hatch, sill: body.yb + 0.1 * CAR_M },
          shell,
          shellBase: shell.geometry.attributes.position.array,
          cabin,
          cabinBase: cabin ? cabin.geometry.attributes.position.array : null,
          wheels,
          bumpers,
          bumperOrigins,
          hood,
          hoodBaseY: kit.hoodBaseY,
          lamps,
          damageVersion: -1,
          nightLights,
          rearDoors: null,
          drl,
          extra,
          liveryMap: livery,
          liveryColor: null,
          finish,
          bumperMaterial: bumpers.length ? bumpers[0].material : null,
          bumperMaterials: bumpers.map((b) => b.material),
          glass: materials.glass,
          panelGeometry: kit.door,
          trunkGeometry: kit.trunk,
          impostorParts: [
            { mesh: shell, material: civImpostorPaint(livery), tint: true, shadow: true },
            ...(cabin ? [{ mesh: cabin, material: materials.glass, shadow: true }] : []),
            { mesh: hood, material: civImpostorPaint(livery), tint: true },
            { mesh: panels, material: civImpostorPaint(livery), tint: true },
            { mesh: trim, material: materials.trim },
          ],
        };
      }
      /*
       * Once a frame for a civilian car in view (render3d.js vehicle pass): lamps
       * lit with the headlights, brake lights, DRLs while driven, the wheels
       * turning and the front ones steering, a body's own animation (`extras`).
       */
      function animateCivilianCar(c, m, deltaSeconds, driven, lampsOn, braking) {
        const lamps = civLampMaterials,
          broken = c.damage?.lights;
        for (const lamp of m.lamps) {
          const material = broken?.[lamp.key]
            ? lamp.mesh.material
            : lamp.kind === 'head'
              ? driven && lampsOn > 0.25
                ? lamps.headOn
                : lamps.headOff
              : braking
                ? lamps.brake
                : driven && lampsOn > 0.25
                  ? lamps.tailOn
                  : lamps.tailOff;
          if (lamp.mesh.material !== material) lamp.mesh.material = material;
        }
        if (m.drl) {
          const material = driven ? civSharedMaterials().drlOn : civSharedMaterials().drlOff;
          if (m.drl.material !== material) m.drl.material = material;
        }
        // Wheels roll with the road speed; the fronts follow the turn.
        const steer = c === player.car ? clamp(c.tyres ? c.tyres.steer : (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), -1, 1) * 0.42 : clamp(c.av * 0.5, -0.4, 0.4);
        m.steer = (m.steer || 0) + (steer - (m.steer || 0)) * Math.min(1, deltaSeconds * 8);
        // Locked wheels stop turning (driving.js: the brakes' lock, the handbrake's rears).
        const locks = c === player.car ? c.tyres?.lock : null;
        for (const wheel of m.wheels) {
          const lock = locks ? (wheel.front ? locks[0] : Math.max(locks[1], c.handbrakeTurn ? 1 : 0)) : 0;
          wheel.wheel.rotation.z -= ((c.speed * deltaSeconds) / wheel.radius) * (1 - lock);
          if (wheel.front) wheel.wheel.rotation.y = -m.steer;
        }
        if (m.extra?.animate) m.extra.animate(c, m, deltaSeconds, driven, lampsOn);
      }
