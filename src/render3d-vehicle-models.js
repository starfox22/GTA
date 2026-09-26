      // MakeVehicle()/buildVehicleModel(), modelScale, car rims, sniper sights.
      /**
       * A car wheel's chrome rim, hub and spokes merged into one geometry (per side,
       * shared by every car): a car was 50-odd draw calls, 32 of them its wheels.
       * The tyre stays the wheel's first child (damage3d.js hides it on a burnt
       * wreck) and the whole wheel group still turns, bends and sits down on a flat.
       */
      const carRims = new Map();
      function carRimGeometry(side) {
        if (carRims.has(side)) return carRims.get(side);
        const parts = [],
          place = (geo, x, y, z, rx, rz, sx, sy, sz) =>
            parts.push(
              geo.clone().applyMatrix4(
                new Three.Matrix4().compose(
                  new Three.Vector3(x, y, z),
                  new Three.Quaternion().setFromEuler(new Three.Euler(rx, 0, rz)),
                  new Three.Vector3(sx, sy, sz),
                ),
              ),
            );
        place(wheelGeo, 0, 0, side * 1.4, Math.PI / 2, 0, 2.8, 0.3, 2.8);
        for (let s = 0; s < 5; s++) place(boxGeo, 0, 0, side * 1.65, 0, (s * Math.PI) / 5, 0.55, 5, 0.2);
        let vertices = 0,
          indices = 0;
        for (const g of parts) {
          vertices += g.attributes.position.count;
          indices += g.index.count;
        }
        const position = new Float32Array(vertices * 3),
          normal = new Float32Array(vertices * 3),
          uv = new Float32Array(vertices * 2),
          index = new Uint16Array(indices);
        let vo = 0,
          io = 0;
        for (const g of parts) {
          position.set(g.attributes.position.array, vo * 3);
          normal.set(g.attributes.normal.array, vo * 3);
          uv.set(g.attributes.uv.array, vo * 2);
          for (let i = 0; i < g.index.count; i++) index[io++] = g.index.getX(i) + vo;
          vo += g.attributes.position.count;
          g.dispose();
        }
        const rim = new Three.BufferGeometry();
        rim.setAttribute('position', new Three.BufferAttribute(position, 3));
        rim.setAttribute('normal', new Three.BufferAttribute(normal, 3));
        rim.setAttribute('uv', new Three.BufferAttribute(uv, 2));
        rim.setIndex(new Three.BufferAttribute(index, 1));
        rim.computeBoundingSphere();
        // Shared by every car: never disposed with a retired model.
        sharedGeometries.add(rim);
        carRims.set(side, rim);
        return rim;
      }
      /**
       * DESIGN SIZE
       * A vehicle's model is built at its design size, the collider's length and
       * width over its `modelScale` (VEHICLE_DEFINITIONS), and the finished group
       * is drawn at modelScale. Its length and width so come out at the collider's,
       * and every part the builders size in fixed units (roof and beltline heights,
       * wheels, lamps, mirrors, lightbars, riders) at its real size. Anything that
       * places into a model by hand works in design units: `m.modelScale` (x) turns
       * world units into them (damage3d.js dents, glass and smoke).
       */
      function modelScaleOf(vehicle) {
        const s = vehicleSpec(vehicle)?.modelScale || 1;
        return Array.isArray(s) ? s : [s, s, s];
      }
      function designSize(vehicle) {
        const spec = vehicleSpec(vehicle),
          [sx, , sz] = modelScaleOf(vehicle);
        return { l: spec.l / sx, w: spec.w / sz };
      }
      function makeVehicle(vehicle) {
        const model = buildVehicleModel(vehicle);
        // A builder that already drew its model at the collider's size (the share
        // bike, cycles3d.js) sets `realSize`.
        if (model.realSize) {
          model.modelScale = 1;
          return model;
        }
        // A builder may draw at its own scale whatever the type's (`drawScale`: the
        // police bodies, authored for 0.8, also dress the 'suv' and 'van' types,
        // which cars3d.js builds at real size).
        const [sx, sy, sz] = model.drawScale ? [model.drawScale, model.drawScale, model.drawScale] : modelScaleOf(vehicle);
        model.group.scale.set(sx, sy, sz);
        model.modelScale = sx;
        return model;
      }
      function buildVehicleModel(vehicle) {
        if (vehicle.type === 'bicycle') return makeBicycle(vehicle);
        if (vehicle.type === 'plane') return makePlane(vehicle);
        if (vehicleSpec(vehicle).militaryModel) return makeMilitaryVehicle(vehicle);
        // The 4x4 club's trucks (offroad3d.js).
        if (vehicleSpec(vehicle).clubModel) return makeOffroadVehicle(vehicle);
        if (vehicleSpec(vehicle).tank) return compactTank(makeTank(vehicle));
        if (vehicle.type === 'helicopter') return vehicle.airframe === 'apache' ? makeApache(vehicle) : makeHelicopter(vehicle);
        // Motorbikes at real size (motorbikes3d.js).
        if (MOTO_BODIES[vehicle.type]) return makeMotorbike(vehicle);
        if (vehicleSpec(vehicle).jetski) return makeJetSki(vehicle);
        if (vehicleSpec(vehicle).boat) return makeBoat(vehicle);
        // Patrol cars, roadblock cruisers, the SWAT truck and agents' SUVs (police3d.js).
        if (vehicle.type === 'police' || vehicle.lawUnit === 'swat' || vehicle.lawUnit === 'fed' || vehicle.policeLook) {
          const look = policeLookFor(vehicle);
          if (look) return makePoliceVehicle(vehicle, look);
        }
        // Civilian cars at real size (cars3d.js).
        if (CAR_BODIES[vehicle.type]) return makeCivilianCar(vehicle);
        if (vehicleSpec(vehicle).truck) return makeTruck(vehicle);
        const group = new Three.Group(),
          body = new Three.Group();
        group.add(body);
        scene.add(group);
        const design = designSize(vehicle),
          l = design.l,
          w = design.w * 0.87,
          low = ['sport', 'supercar', 'roadster'].includes(vehicle.type),
          open = vehicle.type === 'roadster',
          rodCar = vehicle.type === 'hotrod',
          rally = vehicle.type === 'rally',
          limo = vehicle.type === 'limousine',
          van = ['van', 'suv'].includes(vehicle.type),
          roof = van ? 19 : rally ? 17 : rodCar ? 17 : low ? 11.7 : 14.5,
          h = low ? 7 : 9;
        // Metallic base coat under a glossy clear coat: the sky and street lights
        // slide over the paint as a sharp reflection on top of the coloured sheen.
        const paint = new Three.MeshPhysicalMaterial({
          color: vehicle.color,
          roughness: 0.42,
          metalness: 0.55,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          envMapIntensity: 1,
        });
        // The deformable shell and per-pane glasshouse (damage3d.js): shared while
        // pristine, copied the first time the car is dented.
        const shell = mesh(carShellGeometry(l, w, h), paint, body, 0, 0, 0),
          wheels = [],
          bumpers = [],
          nightLights = [],
          lamps = [];
        const cabin = open
          ? box(body, l * 0.14, h + 2.4, 0, 0.7, 5, w * 0.73, carGlass)
          : mesh(
              carCabinGeometry(
                l * (rodCar ? 0.55 : 1),
                w * (rodCar ? 0.88 : 1),
                h - 0.5,
                roof,
                van || rally || limo,
              ),
              carGlass,
              body,
              rodCar ? -l * 0.17 : 0,
              0,
              0,
            );
        if (open) cabin.rotation.z = 0.3;
        if (!open)
          box(
            body,
            l * (rodCar ? -0.19 : van || rally || limo ? -0.135 : -0.06),
            roof + 0.1,
            0,
            l * (rodCar ? 0.25 : van || rally || limo ? 0.55 : 0.26),
            0.7,
            w * 0.7,
            paint,
          );
        if (van) {
          box(body, -l * 0.18, (roof + h) / 2, 0, l * 0.51, roof - h, w * 0.83, paint);
          box(body, -l * 0.47, 11, 0, 0.7, 13, w * 0.74, chrome);
          box(body, -l * 0.482, 11, 0, 0.5, 12, 0.3, darkMetal);
        }
        for (const side of [-1, 1]) {
          const z = side * w * 0.423;
          if (!open && !rodCar) {
            rod(
              body,
              new Three.Vector3(-l * (van || rally || limo ? 0.41 : 0.32), h, z),
              new Three.Vector3(-l * (van || rally || limo ? 0.4 : 0.19), roof, side * w * 0.35),
              0.42,
              paint,
            );
            rod(
              body,
              new Three.Vector3(l * 0.27, h, z),
              new Three.Vector3(l * (van || rally || limo ? 0.13 : 0.07), roof, side * w * 0.35),
              0.45,
              paint,
            );
            rod(
              body,
              new Three.Vector3(-l * 0.055, h, z),
              new Three.Vector3(-l * 0.055, roof, side * w * 0.35),
              0.42,
              darkMetal,
            );
          }
          box(body, -l * 0.1, h - 0.8, side * w * 0.503, l * 0.35, 0.35, 0.25, darkMetal);
          box(body, -l * 0.14, h - 0.6, side * w * 0.515, 3, 0.45, 0.4, chrome);
          box(body, l * 0.09, h + 1.2, side * w * 0.52, 2.1, 1.3, 1.5, paint);
          box(body, -1, 4.7, side * w * 0.51, l * 0.75, 0.5, 0.3, chrome);
          for (const x of [-l * 0.31, l * 0.3]) {
            const wheel = new Three.Group();
            wheel.position.set(x, 4.2, side * (w * 0.46));
            body.add(wheel);
            wheels.push({
              wheel,
              side,
            });
            const tire = mesh(wheelGeo, rubber, wheel, 0, 0, 0, 4.2, 2.6, 4.2);
            tire.rotation.x = Math.PI / 2;
            // Hub and five spokes are one merged chrome rim (one draw, not six).
            mesh(carRimGeometry(side), chrome, wheel, 0, 0, 0);
            const center = mesh(wheelGeo, darkMetal, wheel, 0, 0, side * 1.61, 1, 0.4, 1);
            center.rotation.x = Math.PI / 2;
          }
          lamps.push(
            {
              mesh: box(body, l * 0.47, h - 2, side * w * 0.3, 1.5, 2.5, w * 0.24, warmLamp),
              key: side < 0 ? 'headLeft' : 'headRight',
              lit: warmLamp,
            },
            {
              mesh: box(body, -l * 0.47, h - 2, side * w * 0.3, 1.2, 2, w * 0.22, tailLamp),
              key: side < 0 ? 'tailLeft' : 'tailRight',
              lit: tailLamp,
            },
          );
          nightLights.push(
            halo(body, l * 0.5, h - 2, side * w * 0.3, 11, '#ffe9bd'),
            halo(body, -l * 0.5, h - 2, side * w * 0.3, 7, '#ff5a44'),
          );
        }
        bumpers.push(box(body, l * 0.48, 4.8, 0, 1.1, 1.4, w * 0.78, chrome));
        box(body, l * 0.489, 6.2, 0, 0.4, 2, w * 0.33, darkMetal);
        bumpers.push(box(body, -l * 0.49, 5, 0, 1, 1.4, w * 0.8, chrome));
        box(body, -l * 0.5, 6.5, 0, 0.5, 1.7, 4.5, mat('#dbd3b8'));
        box(body, -l * 0.46, 3.2, -w * 0.3, 2.6, 0.8, 1.3, chrome);
        if (vehicle.type === 'muscle') {
          box(body, l * 0.28, h + 0.45, 0, l * 0.18, 0.8, 4, darkMetal);
          box(body, -l * 0.4, h + 0.6, 0, 2, 1, w * 0.8, paint);
        }
        if (low && !open) {
          box(body, -l * 0.39, h + 3, 0, 3, 0.8, w * 0.97, paint);
          for (const side of [-1, 1])
            box(body, -l * 0.39, h + 1.7, side * w * 0.3, 0.7, 2, 0.7, darkMetal);
        }
        if (vehicle.type === 'taxi') box(body, -1, roof + 1.5, 0, 6, 2.2, 4, mat('#d1c5a2'));
        coachDetails(vehicle, body, l, w, h, roof, paint);
        const hood = box(body, l * 0.34, h + 0.05, 0, l * 0.25, 0.4, w * 0.67, paint);
        const bumperOrigins = bumpers.map((b) => b.position.clone());
        // Wipers along the foot of the windscreen (vehicles3d.js); the glass runs from
        // the cowl (0.27 l, h) up to the roof's leading edge.
        const wiperHost = {};
        if (!open && !rodCar) addWipers(wiperHost, body, l * 0.27, h - 0.5, l * (van || rally || limo ? 0.13 : 0.07), roof, w * 0.4);
        return {
          wipers: wiperHost.wipers,
          group,
          body,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          car: true,
          dims: { l, w, h, roof, van },
          shell,
          shellBase: shell.geometry.attributes.position.array,
          cabin,
          cabinBase: open ? null : cabin.geometry.attributes.position.array,
          wheels,
          bumpers,
          bumperOrigins,
          hood,
          hoodBaseY: h + 0.05,
          lamps,
          damageVersion: -1,
          nightLights,
          rearDoors: null,
        };
      }
      /**
       * SNIPER SIGHTS (swat.js): while a rooftop marksman lines up, a red laser runs
       * from his rifle to the player, brightening as the aim settles, and the scope
       * glints. Three beams and glints, made once and reused.
       */
      const sniperSights = [];
      function sniperSightPool() {
        if (sniperSights.length) return sniperSights;
        const glow = document.createElement('canvas');
        glow.width = glow.height = 64;
        const g = glow.getContext('2d'),
          gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.25, 'rgba(255,240,220,0.8)');
        gradient.addColorStop(1, 'rgba(255,200,160,0)');
        g.fillStyle = gradient;
        g.fillRect(0, 0, 64, 64);
        const glintTexture = new Three.CanvasTexture(glow);
        for (let i = 0; i < 3; i++) {
          const beam = new Three.Mesh(
            cylinderGeo,
            new Three.MeshBasicMaterial({ color: '#ff2020', transparent: true, opacity: 0.5, depthWrite: false, blending: Three.AdditiveBlending }),
          );
          beam.visible = false;
          beam.renderOrder = 5;
          scene.add(beam);
          const glint = new Three.Sprite(
            new Three.SpriteMaterial({ map: glintTexture, color: '#ffffff', transparent: true, depthWrite: false, blending: Three.AdditiveBlending }),
          );
          glint.visible = false;
          scene.add(glint);
          sharedMaterials.add(beam.material);
          sharedMaterials.add(glint.material);
          sniperSights.push({ beam, glint });
        }
        return sniperSights;
      }
      const sniperFrom = new Three.Vector3(),
        sniperTo = new Three.Vector3(),
        sniperAxis = new Three.Vector3(0, 1, 0);
      function updateSniperSights() {
        let n = 0;
        // No laser sights while the snipers are switched off (swat.js SNIPERS_ENABLED).
        const aiming = SNIPERS_ENABLED ? officers.filter((o) => o.roofSniper && o.hp > 0 && o.sniperAim > 0) : [];
        if (!aiming.length && !sniperSights.length) return;
        const pool = sniperSightPool();
        for (const o of aiming) {
          if (n >= pool.length) break;
          const { beam, glint } = pool[n++],
            muzzle = o.a || 0;
          sniperFrom.set(o.x + Math.cos(muzzle) * 9 * PERSON_SCALE, entityElevation(o) + 11 * PERSON_SCALE, o.y + Math.sin(muzzle) * 9 * PERSON_SCALE);
          sniperTo.set(player.x, entityElevation(player) + 9 * PERSON_SCALE, player.y);
          const length = sniperFrom.distanceTo(sniperTo);
          beam.position.copy(sniperFrom).add(sniperTo).multiplyScalar(0.5);
          beam.quaternion.setFromUnitVectors(sniperAxis, sniperTo.clone().sub(sniperFrom).normalize());
          const width = 0.6 + o.sniperAim * 0.7;
          beam.scale.set(width, length, width);
          beam.material.opacity = 0.25 + o.sniperAim * 0.55;
          beam.visible = true;
          glint.position.copy(sniperFrom);
          const flicker = 0.75 + 0.25 * Math.sin(gameTime * 23 + n);
          glint.scale.setScalar((10 + o.sniperAim * 12) * flicker);
          glint.visible = true;
        }
        for (let i = n; i < pool.length; i++) pool[i].beam.visible = pool[i].glint.visible = false;
      }
