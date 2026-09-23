      // BEGIN SUBSYSTEM: src/vehicles3d.js — Vehicle meshes
      /**
       * Vehicle meshes
       * Source: src/vehicles3d.js
       * Scope: createCityRenderer() closure.
       * Distinct road vehicles, bicycles, boats, riders and moving components.
       */
      // Each vehicle class has its own silhouette, wheelbase and moving parts.
      function specialVehicle(vehicle) {
        const group = new Three.Group(),
          body = new Three.Group();
        group.add(body);
        scene.add(group);
        const paint = mat(vehicle.color, 0.32, 0.58);
        return {
          group,
          body,
          paint,
          color: vehicle.color,
          strobes: [],
          wheels: [],
          lamps: [],
          special: true,
          dead: false,
        };
      }
      function tireAt(m, x, z, r = 4.7, width = 3) {
        const pivot = new Three.Group();
        pivot.position.set(x, r, z);
        m.body.add(pivot);
        const tire = mesh(wheelGeo, rubber, pivot, 0, 0, 0, r, width, r);
        tire.rotation.x = Math.PI / 2;
        for (const side of [-1, 1]) {
          const rim = mesh(wheelGeo, chrome, pivot, 0, 0, side * width * 0.52, r * 0.6, 0.3, r * 0.6);
          rim.rotation.x = Math.PI / 2;
          const hub = mesh(
            wheelGeo,
            darkMetal,
            pivot,
            0,
            0,
            side * width * 0.58,
            r * 0.22,
            0.4,
            r * 0.22,
          );
          hub.rotation.x = Math.PI / 2;
        }
        m.wheels.push({
          wheel: pivot,
          side: Math.sign(z) || 1,
        });
        return pivot;
      }
      function makeMotorcycle(vehicle) {
        const model = specialVehicle(vehicle),
          b = model.body,
          cruiser = vehicle.type === 'cruiser',
          l = vehicleSpec(vehicle).l;
        model.bike = true;
        tireAt(model, -l * 0.33, 0, 5.3, 3.2);
        tireAt(model, l * 0.34, 0, 5.3, 2.5);
        rod(b, new Three.Vector3(-l * 0.3, 5, 0), new Three.Vector3(3, 11, 0), 0.8, chrome);
        rod(b, new Three.Vector3(3, 11, 0), new Three.Vector3(l * 0.34, 5, 0), 0.7, chrome);
        box(b, -1, 7, 0, 9, 6, 5, darkMetal);
        for (let i = 0; i < 5; i++) box(b, -2, 6 + i * 0.65, 0, 6, 0.3, 5.6, chrome);
        mesh(sphereGeo, model.paint, b, 2, 11, 0, 6, 2.5, 3.4);
        box(b, -6, 11.5, 0, 7, 1.7, 4.8, rubber);
        box(b, -11, 9, 0, 5, 1.2, 4, model.paint);
        for (const side of [-1, 1]) {
          rod(
            b,
            new Three.Vector3(l * 0.34, 5, side * 1.7),
            new Three.Vector3(7, 14, side * 1.7),
            0.6,
            chrome,
          );
          box(b, -5, 5, side * 3.2, 13, 0.9, 1, chrome);
          box(b, 7, 14, side * 3, 1, 1, 4, rubber);
        }
        if (!cruiser) {
          mesh(sphereGeo, model.paint, b, 5, 9, 0, 5, 4, 4);
          box(b, 7, 15, 0, 0.8, 4, 5, glass);
        } else {
          box(b, -8, 8, 0, 7, 3, 7, rubber);
          rod(b, new Three.Vector3(7, 14, 0), new Three.Vector3(7, 17, 0), 0.5, chrome);
        }
        box(b, 10, 12, 0, 1.2, 2.4, 3, warmLamp);
        box(b, -13, 10, 0, 1, 1.4, 2, tailLamp);
        const rider = new Three.Group();
        b.add(rider);
        box(rider, -2, 17, 0, 4.5, 7, 6, mat('#343e47'));
        mesh(sphereGeo, mat('#222932', 0.25, 0.4), rider, 0, 23, 0, 2.4, 2.5, 2.4);
        box(rider, 2, 23, 0, 0.7, 1.7, 3.9, glass);
        for (const side of [-1, 1]) {
          rod(
            rider,
            new Three.Vector3(-2, 18, side * 3),
            new Three.Vector3(7, 14, side * 4),
            1,
            mat('#343e47'),
          );
          rod(
            rider,
            new Three.Vector3(-5, 13, side * 2),
            new Three.Vector3(0, 7, side * 4),
            1.2,
            mat('#4c5561'),
          );
        }
        model.rider = rider;
        return model;
      }
      /**
       * Drivable boats. Hulls are lofted by the boat kit (boats3d.js) and painted
       * in the vehicle's colour through `model.paint`, so wear and burn-out still
       * show; stripes, boot tops and trim are kit tints. A foam V-wake trails the
       * stern and a bow spray and planing trim come in with speed (boatUpdate).
       */
      const boatWakeTexture = wakeTexture(true),
        boatScreenGlass = new Three.MeshStandardMaterial({
          color: '#5d7c8c',
          roughness: 0.05,
          metalness: 0.5,
          transparent: true,
          opacity: 0.55,
        });
      function boatWake(model, length, width, sternX) {
        const wake = new Three.Group();
        wake.position.set(sternX, 0.35, 0);
        wake.userData.dynamic = true;
        model.body.add(wake);
        const trail = new Three.Mesh(
          new Three.PlaneGeometry(length * 2.2, width * 2.6),
          new Three.MeshBasicMaterial({ map: boatWakeTexture, transparent: true, opacity: 0.55, depthWrite: false }),
        );
        trail.rotation.x = -Math.PI / 2;
        // The texture's V opens toward -x; its apex sits near the stern.
        trail.position.x = -length * 0.3;
        trail.renderOrder = 7;
        wake.add(trail);
        const churn = new Three.Mesh(
          new Three.PlaneGeometry(width * 1.1, width * 0.9),
          new Three.MeshBasicMaterial({ map: haloTx, color: '#e9f6f4', transparent: true, opacity: 0.5, depthWrite: false }),
        );
        churn.rotation.x = -Math.PI / 2;
        churn.position.x = -width * 0.25;
        churn.renderOrder = 7;
        wake.add(churn);
        model.wake = wake;
        model.wakeMaterials = [trail.material, churn.material];
        return wake;
      }
      // White water thrown off either side of the bow once the boat is moving.
      function boatSpray(model, x, width) {
        const spray = new Three.Group();
        spray.userData.dynamic = true;
        model.body.add(spray);
        for (const side of [-1, 1]) {
          const m = new Three.Mesh(
            new Three.PlaneGeometry(width * 0.9, width * 0.5),
            new Three.MeshBasicMaterial({ map: haloTx, color: '#f4fbfa', transparent: true, opacity: 0.5, depthWrite: false }),
          );
          m.rotation.x = -Math.PI / 2;
          m.position.set(x, 0.6, side * width * 0.42);
          m.renderOrder = 7;
          spray.add(m);
        }
        model.spray = spray;
        return spray;
      }
      function boatDynamics(model, plane = 0.07) {
        model.boatUpdate = (c) => {
          const speed = Math.abs(c.speed || 0),
            max = vehicleSpec(c).max || 300,
            f = clamp(speed / max, 0, 1);
          // Planing: the bow lifts as she gets on the plane, then settles a little.
          model.body.rotation.z += plane * Math.sin(Math.min(1, f * 1.6) * Math.PI * 0.62);
          for (const m of model.wakeMaterials) m.opacity = 0.2 + f * 0.55;
          if (model.spray) {
            model.spray.visible = f > 0.18 && c.hp > 0;
            model.spray.scale.setScalar(0.6 + f * 0.9);
          }
        };
      }
      function makeBoat(vehicle) {
        const model = specialVehicle(vehicle),
          b = model.body,
          def = vehicleSpec(vehicle),
          l = def.l,
          w = def.w,
          work = vehicle.type === 'workboat';
        model.boat = true;
        const cream = tint('#efe9dc', 'matte'),
          navy = tint('#1e2f45', 'gloss'),
          bottom = tint('#1b1d20', 'satin');
        if (!work) {
          // STINGRAY: a deep-vee sport runabout with a wraparound screen.
          const spec = {
            length: l,
            beam: w,
            draft: 3.5,
            form: { transom: 0.86, maxAt: -0.12, entry: 1.6, bowShape: 0.7 },
            sheer: [
              [-0.5, 8.2],
              [0.15, 9.2],
              [0.5, 10.6],
            ],
            rake: 0.17,
            forefoot: 0.22,
            keelRise: 0.4,
            bilge: 1.1,
            flare: 0.38,
            colors: { bottom: '#ffffff', boot: '#ffffff', top: '#ffffff' },
            stations: 22,
          };
          mesh(loftHull(spec), model.paint, b, 0, 0, 0);
          hullBand(b, spec, -4, 0.8, bottom, 0.12);
          hullBand(b, spec, 5.2, 6.6, navy, 0.14, -0.5, 0.42);
          hullBand(b, spec, 3.6, 4.2, tint('#c7392f', 'gloss'), 0.14, -0.5, 0.35);
          // Foredeck and engine deck in gelcoat, a sunken teak cockpit between them.
          hullDeck(b, spec, 8.2, l * 0.06, l / 2 - 1, 0.6, tint('#e6e3da', 'matte'));
          hullDeck(b, spec, 8.2, -l / 2, -l * 0.34, 0.6, tint('#e6e3da', 'matte'));
          hullDeck(b, spec, 4.6, -l * 0.34, l * 0.06, 0.8, kitTeak);
          box(b, l * 0.06, 6.4, 0, 0.8, 3.6, hullBeamAt(spec, l * 0.06, 8) * 2 - 1, tint('#e6e3da', 'matte'));
          box(b, -l * 0.34, 6.4, 0, 0.8, 3.6, hullBeamAt(spec, -l * 0.34, 8) * 2 - 1, tint('#e6e3da', 'matte'));
          // Bucket seats at the helm, a bench across the back of the cockpit.
          for (const side of [-1, 1]) {
            box(b, -l * 0.04, 6.4, side * w * 0.17, 5.4, 3.6, 5.8, cream);
            box(b, -l * 0.04 - 2.7, 9.2, side * w * 0.17, 1.6, 5.6, 5.8, cream);
            box(b, -l * 0.04 - 2.7, 11.6, side * w * 0.17, 1.8, 0.8, 5.9, navy);
          }
          box(b, -l * 0.29, 6.4, 0, 6, 3.6, w * 0.66, cream);
          box(b, -l * 0.325, 9.4, 0, 1.8, 5, w * 0.66, cream);
          box(b, l * 0.035, 7.4, w * 0.17, 3.4, 5.6, 7, tint('#2a2f35', 'satin'));
          const helm = mesh(new Three.TorusGeometry(1.6, 0.3, 6, 14), tint('#1a1c1f', 'satin'), b, l * 0.015, 10.6, w * 0.17);
          helm.rotation.y = Math.PI / 2;
          helm.rotation.z = 0.5;
          // Wraparound windscreen: a raked band of smoked glass on a curved plan.
          const arc = [],
            top = [];
          for (let i = 0; i <= 10; i++) {
            const a = (i / 10 - 0.5) * Math.PI * 0.85,
              r = w * 0.4;
            arc.push([l * 0.08 + Math.cos(a) * r * 0.45, Math.sin(a) * r]);
            top.push([l * 0.08 + Math.cos(a) * r * 0.45 - 3.6, Math.sin(a) * r * 0.94]);
          }
          mesh(prismGeometry(arc, top, 8.4, 13, false), boatScreenGlass, b, 0, 0, 0);
          for (const p of [arc[0], arc[10]]) box(b, p[0] - 1.8, 10.7, p[1], 0.6, 4.6, 0.6, chrome);
          // Bow sun pad, engine hatch and swim platform aft.
          box(b, l * 0.3, 9.2, 0, l * 0.16, 1.4, w * 0.36, cream);
          box(b, l * 0.3, 10, 0, l * 0.02, 0.6, w * 0.36, navy);
          box(b, -l * 0.42, 9.1, 0, l * 0.12, 1.6, w * 0.62, cream);
          deckSlab(b, rectOutline(-l / 2 - 4, -l / 2 + 0.5, -w * 0.36, w * 0.36), 3.2, 1.2, kitTeak, tint('#f2f2ee'));
          box(b, -l / 2 - 1, -1.5, 0, 3, 5, 2.4, tint('#2a2d31', 'satin'));
          for (const side of [-1, 1]) {
            railing(b, [[l * 0.18, side * w * 0.34], [l * 0.42, side * w * 0.14], [l * 0.49, 0]], 8.2, 2.6, { spacing: 7, material: chrome });
            box(b, l * 0.22, 9, side * w * 0.36, 1.6, 0.6, 0.8, chrome);
          }
          box(b, l * 0.47, 11.2, 0, 0.8, 1, 1.6, warmLamp);
          boatWake(model, l, w, -l / 2);
          boatSpray(model, l * 0.22, w);
          boatDynamics(model, 0.075);
        } else {
          // HARBOR LAUNCH: round-bilged workboat, wheelhouse, tyre fenders, tow bitt.
          const spec = {
            length: l,
            beam: w,
            draft: 6,
            form: { transom: 0.8, maxAt: -0.05, entry: 1.9, bowShape: 0.72 },
            sheer: [
              [-0.5, 10],
              [0.1, 10.5],
              [0.5, 15],
            ],
            rake: 0.06,
            forefoot: 0.18,
            keelRise: 0.3,
            bilge: 2.3,
            flare: 0.25,
            colors: { bottom: '#ffffff', boot: '#ffffff', top: '#ffffff' },
            stations: 22,
          };
          mesh(loftHull(spec), model.paint, b, 0, 0, 0);
          hullBand(b, spec, -6, 0.8, tint('#7c2e28', 'satin'), 0.12);
          hullBand(b, spec, 8.4, 10.2, tint('#1b1d20', 'satin'), 0.5);
          hullDeck(b, spec, 9.6, -l / 2, l / 2 - 1, 0.8, kitTeakPale);
          const house = deckOutline(-l * 0.14, l * 0.16, w * 0.33, l * 0.07, 2.4);
          deckhouse(b, house, 9.6, 22, { paint: tint('#efe9dc'), rake: 2, glazing: kitBridgeGlass, glassFrom: 0.5, glassTo: 0.86 });
          deckSlab(b, offsetOutline(house, 1.5), 23.2, 1.2, tint('#efe9dc'), tint('#efe9dc'));
          box(b, l * 0.02, 29, 0, 0.8, 12, 0.8, tint('#d8d8d0', 'metal'));
          box(b, l * 0.02, 33, 0, 0.8, 0.8, 7, tint('#d8d8d0', 'metal'));
          box(b, l * 0.02, 35.4, 0, 1.2, 1.2, 1.2, warmLamp);
          mesh(cylinderGeo, tint('#2a2d31', 'satin'), b, -l * 0.06, 24.8, 0, 1.6, 2, 1.6);
          // Towing bitt and hook aft, tyre fenders all round.
          box(b, -l * 0.34, 12.5, 0, 2.4, 6, 2.4, tint('#2a2d31', 'satin'));
          box(b, -l * 0.34, 14.6, 0, 1.4, 1.4, 8, tint('#2a2d31', 'satin'));
          for (const f of [-0.36, -0.18, 0, 0.18, 0.34])
            for (const side of [-1, 1]) {
              const u = l * f,
                tyre = mesh(new Three.TorusGeometry(2.3, 1, 6, 12), rubber, b, u, 7.2, side * (hullBeamAt(spec, u, 8) + 1));
              tyre.rotation.y = Math.PI / 2;
            }
          for (const side of [-1, 1]) {
            const ring = mesh(new Three.TorusGeometry(2.8, 0.7, 6, 14), tint('#e46a2a', 'gloss'), b, -l * 0.02, 17, side * (w * 0.33 + 0.4));
            ring.rotation.y = 0;
            railing(b, hullEdge(spec, 9.6, -l * 0.46, -l * 0.16, 1, 8).map(([u, v]) => [u, side * v]), 9.6, 4, { spacing: 8 });
          }
          box(b, l * 0.46, 15, 0, 1, 1, 1.4, warmLamp);
          boatWake(model, l, w, -l / 2);
          boatSpray(model, l * 0.28, w);
          boatDynamics(model, 0.04);
        }
        kitMerge(b);
        return model;
      }
      function makeTruck(c) {
        const model = specialVehicle(c),
          b = model.body,
          vehicleDefinition = vehicleSpec(c),
          l = vehicleDefinition.l,
          w = vehicleDefinition.w * 0.91,
          bus = c.type === 'bus',
          pickup = c.type === 'pickup',
          flatbed = c.type === 'flatbed',
          ambulance = c.type === 'ambulance';
        box(b, 0, 6, 0, l * 0.94, 4, w * 0.87, darkMetal);
        if (bus) {
          box(b, 0, 17, 0, l * 0.92, 23, w, model.paint);
          box(b, 0, 30, 0, l * 0.91, 2, w * 0.96, mat('#c9c6b9'));
          box(b, l * 0.466, 23, 0, 0.6, 12, w * 0.88, glass);
          for (const side of [-1, 1]) {
            for (let x = -l * 0.38; x < l * 0.42; x += 12)
              box(b, x, 23, side * w * 0.507, 10, 10, 0.35, glass);
            box(b, 0, 13, side * w * 0.51, l * 0.87, 2, 0.4, mat('#e3d4af'));
            box(b, l * 0.27, 15, side * w * 0.515, 9, 19, 0.4, glass);
          }
        } else {
          const cab = l * 0.31;
          box(b, l * 0.29, 13, 0, cab, 17, w, model.paint);
          box(b, l * 0.29, 23, 0, cab * 0.91, 2, w * 0.94, model.paint);
          box(b, l * 0.447, 19, 0, 0.6, 7, w * 0.83, glass);
          for (const side of [-1, 1]) {
            box(b, l * 0.28, 19, side * w * 0.505, cab * 0.72, 7, 0.4, glass);
            box(b, l * 0.18, 12, side * w * 0.517, 3, 0.7, 0.5, chrome);
            box(b, l * 0.37, 17, side * w * 0.62, 2, 2.4, 3, darkMetal);
          }
          if (flatbed) {
            box(b, -l * 0.18, 8.5, 0, l * 0.63, 3, w * 0.98, wood);
            for (const side of [-1, 1]) {
              box(b, -l * 0.18, 10.6, side * w * 0.49, l * 0.65, 2, 1.5, chrome);
              for (const x of [-l * 0.48, -l * 0.22, l * 0.08])
                box(b, x, 13, side * w * 0.49, 1.5, 7, 1.5, model.paint);
            }
            box(b, -l * 0.49, 11, 0, 2, 5, w, model.paint);
          } else if (pickup) {
            box(b, -l * 0.2, 9, 0, l * 0.56, 2, w * 0.94, model.paint);
            for (const side of [-1, 1])
              box(b, -l * 0.2, 12, side * w * 0.46, l * 0.57, 6, 1.3, model.paint);
            box(b, -l * 0.48, 12, 0, 1.5, 6, w, model.paint);
            box(b, -l * 0.2, 10.2, 0, l * 0.5, 0.4, w * 0.8, darkMetal);
          } else {
            const cargo = mat(ambulance ? '#e7e3d9' : '#a5b5b9', 0.74, 0.15);
            box(b, -l * 0.16, 18, 0, l * 0.6, 24, w, cargo);
            box(b, -l * 0.46, 18, 0, 0.5, 22, w * 0.89, chrome);
            for (const side of [-1, 1]) {
              if (ambulance) {
                box(b, -l * 0.16, 17, side * w * 0.506, l * 0.6, 3, 0.4, mat('#a63038'));
                box(b, -l * 0.2, 23, side * w * 0.51, 2, 7, 0.45, mat('#b12a32'));
                box(b, -l * 0.2, 23, side * w * 0.512, 7, 2, 0.46, mat('#b12a32'));
              } else
                for (let x = -l * 0.43; x < l * 0.13; x += 4)
                  box(b, x, 18, side * w * 0.503, 0.6, 22, 0.3, mat('#7f9094'));
            }
          }
        }
        for (const side of [-1, 1]) {
          for (const x of [l * 0.32, -l * 0.31, ...(l > 75 ? [-l * 0.16] : [])])
            tireAt(model, x, side * w * 0.46, bus ? 5.5 : 5, 3.4);
          // Lamps a crash or a bullet can put out (damage3d.js).
          model.lamps.push(
            { mesh: box(b, l * 0.478, 10, side * w * 0.34, 1.2, 3, 4, warmLamp), key: side < 0 ? 'headLeft' : 'headRight', lit: warmLamp },
            { mesh: box(b, -l * 0.48, 9, side * w * 0.35, 0.7, 2, 3, tailLamp), key: side < 0 ? 'tailLeft' : 'tailRight', lit: tailLamp },
          );
        }
        box(b, l * 0.49, 6.5, 0, 2, 3, w * 0.9, chrome);
        box(b, l * 0.475, 11, 0, 1, 4, w * 0.43, darkMetal);
        if (ambulance)
          for (const side of [-1, 1])
            model.strobes.push(
              box(
                b,
                l * 0.29,
                25,
                side * 7,
                4,
                2.4,
                5,
                new Three.MeshBasicMaterial({
                  color: '#cf4545',
                }),
              ),
            );
        return model;
      }
      function makeJetSki(vehicle) {
        const model = specialVehicle(vehicle),
          b = model.body;
        model.boat = true;
        model.jetski = true;
        // RIPTIDE: a short, fat planing hull with a stepped seat and handlebar pod.
        const spec = {
          length: 29,
          beam: 12,
          draft: 1.8,
          form: { transom: 0.8, maxAt: -0.15, entry: 1.5, bowShape: 0.7 },
          sheer: [
            [-0.5, 4.2],
            [0.2, 5.2],
            [0.5, 5.8],
          ],
          rake: 0.26,
          forefoot: 0.2,
          keelRise: 0.3,
          bilge: 1.15,
          flare: 0.3,
          colors: { bottom: '#ffffff', boot: '#ffffff', top: '#ffffff' },
          stations: 16,
        };
        mesh(loftHull(spec), model.paint, b, 0, 0, 0);
        hullBand(b, spec, -2, 1.6, tint('#f2f2ee', 'gloss'), 0.1);
        hullBand(b, spec, 2.6, 3.2, tint('#1b1d20', 'gloss'), 0.12);
        hullDeck(b, spec, 4.3, -14.5, 14, 0.6, tint('#23272b', 'matte'));
        // Nose cowl sweeping up to the handlebar pod.
        mesh(sphereGeo, model.paint, b, 6, 6, 0, 8, 3.2, 5);
        box(b, 3.2, 8, 0, 3, 2.4, 4.2, model.paint);
        const screen = box(b, 5.4, 9.4, 0, 0.3, 2.2, 4, kitGlass);
        screen.rotation.z = 0.7;
        box(b, 2.6, 9.6, 0, 1, 0.8, 9, tint('#1b1d20', 'satin'));
        for (const side of [-1, 1]) box(b, 2.6, 9.6, side * 4.6, 1.4, 1.2, 1.4, tint('#1b1d20', 'matte'));
        // Seat and footwells.
        box(b, -5, 6.6, 0, 13, 2.2, 4.2, tint('#15181b', 'matte'));
        box(b, -5, 7.8, 0, 11, 0.6, 3.6, tint('#2c3136', 'matte'));
        box(b, -13.5, 3.9, 0, 3, 1, 9, tint('#2c3136', 'matte'));
        box(b, -14.8, 1.2, 0, 1.4, 1.6, 2.4, tint('#2a2d31', 'satin'));
        const rider = new Three.Group();
        rider.userData.dynamic = true;
        b.add(rider);
        box(rider, -2, 12, 0, 4, 7, 6, mat('#9f7545'));
        box(rider, -2, 12.5, 0, 4.4, 5, 6.4, mat('#e46a2a'));
        mesh(sphereGeo, mat('#b69880'), rider, 0, 18, 0, 2, 2.5, 2);
        for (const side of [-1, 1]) {
          rod(rider, new Three.Vector3(-1, 14, side * 3), new Three.Vector3(2.6, 9.8, side * 4), 0.9, mat('#b69880'));
          rod(rider, new Three.Vector3(-5, 9, side * 2), new Three.Vector3(-2, 5, side * 4), 1.1, mat('#28343f'));
        }
        model.rider = rider;
        boatWake(model, 34, 13, -14.5);
        boatSpray(model, 4, 13);
        // A rooster tail of spray kicked up astern at speed.
        const tail = new Three.Mesh(
          new Three.PlaneGeometry(22, 8),
          new Three.MeshBasicMaterial({ map: haloTx, color: '#f4fbfa', transparent: true, opacity: 0.55, depthWrite: false }),
        );
        tail.rotation.x = -Math.PI / 2;
        tail.position.set(-8, 1.4, 0);
        model.wake.add(tail);
        model.wakeMaterials.push(tail.material);
        boatDynamics(model, 0.06);
        kitMerge(b);
        return model;
      }

      // Coachwork shares the deformable chassis, but each model has a distinct upper body.
      function coachDetails(c, b, l, w, h, roof, paint) {
        if (c.type === 'roadster') {
          box(b, -l * 0.09, h + 0.3, 0, l * 0.4, 1, w * 0.72, rubber);
          for (const side of [-1, 1]) {
            const z = side * w * 0.2;
            box(b, -l * 0.1, h + 1, z, 7, 2, 5.5, mat('#ab8462'));
            box(b, -l * 0.17, h + 3, z, 1.5, 5, 5.5, mat('#ab8462'));
            const hoop = mesh(
              new Three.TorusGeometry(2.5, 0.5, 6, 12, Math.PI),
              chrome,
              b,
              -l * 0.23,
              h + 3.2,
              z,
            );
            hoop.rotation.y = Math.PI / 2;
            rod(
              b,
              new Three.Vector3(
                l * 0.14 + Math.sin(0.3) * 2.5,
                h + 2.4 - Math.cos(0.3) * 2.5,
                side * w * 0.365,
              ),
              new Three.Vector3(
                l * 0.14 - Math.sin(0.3) * 2.5,
                h + 2.4 + Math.cos(0.3) * 2.5,
                side * w * 0.365,
              ),
              0.5,
              chrome,
            );
            box(b, -l * 0.34, h + 1, z, 6, 0.7, 5, paint);
          }
          box(b, -l * 0.46, h + 0.7, 0, 1.3, 1, w * 0.77, chrome);
        }
        if (c.type === 'rally') {
          box(b, -l * 0.39, roof + 1, 0, 3, 1, w * 1.04, paint);
          for (const side of [-1, 1]) {
            box(b, -l * 0.39, roof - 1, side * w * 0.34, 1, 4, 1, darkMetal);
            box(b, 0, 4.8, side * w * 0.53, l * 0.35, 1.4, 1.6, paint);
            box(b, 0, h - 1, side * w * 0.535, l * 0.58, 2, 0.2, mat('#d6cebd'));
            box(b, -l * 0.1, roof + 0.6, side * 2, l * 0.34, 0.25, 1.8, mat('#d6cebd'));
          }
          box(b, l * 0.29, h + 0.6, 0, 6, 1.3, 7, darkMetal);
          for (const z of [-w * 0.33, -w * 0.11, w * 0.11, w * 0.33]) {
            const lamp = mesh(wheelGeo, warmLamp, b, l * 0.5, h - 1, z, 1.7, 1.1, 1.7);
            lamp.rotation.z = Math.PI / 2;
          }
          box(b, -l * 0.12, roof + 2, 0, 4, 2, 4, darkMetal);
        }
        if (c.type === 'limousine') {
          for (const side of [-1, 1]) {
            for (const x of [-l * 0.26, -l * 0.08, l * 0.11]) {
              rod(
                b,
                new Three.Vector3(x, h, side * w * 0.422),
                new Three.Vector3(x, roof, side * w * 0.35),
                0.5,
                paint,
              );
              box(b, x + 4, h - 1, side * w * 0.51, 3, 0.5, 0.5, chrome);
            }
            box(b, -l * 0.06, h - 2.2, side * w * 0.51, l * 0.76, 0.5, 0.5, chrome);
          }
          box(b, l * 0.49, 7, 0, 0.8, 4, w * 0.42, chrome);
          for (let z = -w * 0.18; z < w * 0.18; z += 1.5)
            box(b, l * 0.496, 7, z, 0.3, 3.4, 0.4, darkMetal);
          box(b, l * 0.43, h + 1.7, 0, 0.45, 3, 0.45, chrome);
        }
        if (c.type === 'hotrod') {
          box(b, l * 0.24, h + 1.7, 0, l * 0.2, 5, w * 0.46, chrome);
          for (let x = l * 0.17; x < l * 0.34; x += 2)
            box(b, x, h + 4.4, 0, 0.7, 0.6, w * 0.43, darkMetal);
          box(b, l * 0.22, h + 6, 0, 5, 3, 5, chrome);
          box(b, l * 0.3, h + 6, 0, 0.5, 2.4, 4, darkMetal);
          for (const side of [-1, 1]) {
            for (let i = 0; i < 3; i++)
              rod(
                b,
                new Three.Vector3(l * 0.15 + i * 2, h + 1, side * w * 0.23),
                new Three.Vector3(l * 0.2 + i * 2, 4, side * w * 0.52),
                0.7,
                chrome,
              );
            box(b, 0, 4, side * w * 0.54, l * 0.55, 1.2, 1.2, chrome);
            box(b, -l * 0.32, 7, side * w * 0.45, 12, 1, 5, paint);
            rod(
              b,
              new Three.Vector3(-l * 0.3, h, side * w * 0.36),
              new Three.Vector3(-l * 0.27, roof, side * w * 0.29),
              0.6,
              paint,
            );
            rod(
              b,
              new Three.Vector3(-l * 0.02, h, side * w * 0.36),
              new Three.Vector3(-l * 0.13, roof, side * w * 0.29),
              0.6,
              paint,
            );
          }
          box(b, l * 0.48, h - 1, 0, 1.3, 7, w * 0.47, chrome);
          for (let z = -w * 0.2; z < w * 0.2; z += 1.4)
            box(b, l * 0.496, h - 1, z, 0.4, 6, 0.45, darkMetal);
        }
      }
      function makeBicycle(vehicle) {
        const model = specialVehicle(vehicle),
          b = model.body;
        model.bike = true;
        model.bicycle = true;
        const frame = model.paint;
        const wheels = [];
        for (const x of [-10, 10]) {
          const wheel = mesh(new Three.TorusGeometry(5.5, 0.7, 7, 20), rubber, b, x, 5.5, 0);
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            rod(
              b,
              new Three.Vector3(x, 5.5, 0),
              new Three.Vector3(x + Math.cos(a) * 5, 5.5 + Math.sin(a) * 5, 0),
              0.13,
              chrome,
            );
          }
          wheels.push({
            wheel,
          });
        }
        for (const [a, d] of [
          [
            [-10, 5.5, 0],
            [-2, 13, 0],
          ],
          [
            [-2, 13, 0],
            [3, 5, 0],
          ],
          [
            [3, 5, 0],
            [-10, 5.5, 0],
          ],
          [
            [-2, 13, 0],
            [8, 14, 0],
          ],
          [
            [8, 14, 0],
            [3, 5, 0],
          ],
          [
            [8, 14, 0],
            [10, 5.5, 0],
          ],
        ])
          rod(b, new Three.Vector3(...a), new Three.Vector3(...d), 0.65, frame);
        box(b, -2, 14.5, 0, 6, 1.5, 3, rubber);
        rod(b, new Three.Vector3(8, 14, 0), new Three.Vector3(9, 18, 0), 0.55, chrome);
        box(b, 9, 18, 0, 1, 1, 9, chrome);
        const crank = new Three.Group();
        crank.position.set(3, 5, 0);
        b.add(crank);
        box(crank, 0, 0, 0, 1, 6, 1, chrome);
        box(crank, 0, 3, 2, 3, 0.8, 3, rubber);
        box(crank, 0, -3, -2, 3, 0.8, 3, rubber);
        const rider = new Three.Group();
        b.add(rider);
        box(rider, -1, 20, 0, 4, 8, 6, mat('#4d7782'));
        mesh(sphereGeo, mat('#c4a489'), rider, 2, 26, 0, 2.2, 2.7, 2.2);
        mesh(sphereGeo, frame, rider, 2, 28, 0, 2.5, 1.4, 2.5);
        for (const side of [-1, 1]) {
          rod(
            rider,
            new Three.Vector3(0, 22, side * 3),
            new Three.Vector3(9, 18, side * 4),
            0.8,
            mat('#c4a489'),
          );
          rod(
            rider,
            new Three.Vector3(-3, 16, side * 2),
            new Three.Vector3(3, 9, side * 3),
            1,
            mat('#334d59'),
          );
        }
        model.rider = rider;
        model.crank = crank;
        model.wheels = wheels;
        return model;
      }
      // END SUBSYSTEM: src/vehicles3d.js
