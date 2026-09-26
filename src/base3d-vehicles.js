      const oliveTrim = mat('#3c4433', 0.8, 0.2),
        canvasMat = mat('#6b6c4c', 0.97);
      function starDecal(parent, x, y, z, size, facing, flat = false) {
        const m = plate(parent, x, y, z, size, size, B.star, facing);
        if (flat) m.rotation.set(-Math.PI / 2, 0, facing);
        return m;
      }
      function militaryLamps(model, b, x, y, halfWidth) {
        for (const side of [-1, 1])
          model.lamps.push(
            { mesh: box(b, x, y, side * halfWidth, 1, 2.4, 3, warmLamp), key: side < 0 ? 'headLeft' : 'headRight', lit: warmLamp },
            { mesh: box(b, -x, y - 1, side * halfWidth, 0.6, 1.8, 2.4, tailLamp), key: side < 0 ? 'tailLeft' : 'tailRight', lit: tailLamp },
          );
      }
      // One wheel as two meshes: tyre and hub.
      function militaryWheel(model, x, z, r, width) {
        const pivot = new Three.Group();
        pivot.position.set(x, r, z);
        model.body.add(pivot);
        const tire = mesh(wheelGeo, rubber, pivot, 0, 0, 0, r, width, r);
        tire.rotation.x = Math.PI / 2;
        const hub = mesh(wheelGeo, oliveTrim, pivot, 0, 0, Math.sign(z) * width * 0.1, r * 0.55, width * 0.9, r * 0.55);
        hub.rotation.x = Math.PI / 2;
        model.wheels.push({ wheel: pivot, side: Math.sign(z) || 1 });
        return pivot;
      }
      function makeMilitaryVehicle(vehicle) {
        const spec = vehicleSpec(vehicle),
          kind = spec.militaryModel,
          model = specialVehicle(vehicle),
          b = model.body,
          p = model.paint,
          l = designSize(vehicle).l,
          w = designSize(vehicle).w,
          keep = new Set();
        p.roughness = 0.78;
        p.metalness = 0.15;
        if (kind === 'jeep') {
          const r = 6.4;
          box(b, 0, 6, 0, l * 0.9, 3, w * 0.7, darkMetal);
          box(b, -1, 10.5, 0, l * 0.96, 7, w * 0.94, p);
          box(b, l * 0.3, 14.2, 0, l * 0.36, 1.6, w * 0.8, p);
          for (const s of [-1, 1]) {
            box(b, l * 0.3, 12.4, s * w * 0.44, l * 0.4, 4.6, w * 0.16, p);
            box(b, -l * 0.3, 12.4, s * w * 0.44, l * 0.4, 4.6, w * 0.16, p);
          }
          box(b, l * 0.43, 12.5, 0, 2, 3, w * 0.5, oliveTrim);
          for (let k = -3; k <= 3; k++) box(b, l * 0.435, 12.5, k * 1.8, 2.2, 2.6, 0.5, darkMetal);
          const screen = box(b, l * 0.1, 18, 0, 1, 7, w * 0.78, glass);
          screen.rotation.z = 0.25;
          box(b, -l * 0.08, 21.8, 0, l * 0.36, 1.2, w * 0.84, p);
          for (const s of [-1, 1]) {
            box(b, -l * 0.07, 18, s * w * 0.43, l * 0.3, 6, 0.5, glass);
            box(b, -l * 0.22, 17.5, s * w * 0.42, 1.6, 8.5, 1.6, p);
            box(b, l * 0.08, 17.5, s * w * 0.42, 1.6, 8.5, 1.6, p);
            box(b, -l * 0.07, 10.5, s * w * 0.475, 0.4, 6, 0.3, oliveTrim);
          }
          box(b, -l * 0.35, 15.5, 0, l * 0.26, 3, w * 0.86, p);
          box(b, -l * 0.35, 18.5, 0, l * 0.26, 5, w * 0.84, canvasMat);
          box(b, l * 0.49, 7, 0, 2.2, 3, w * 0.86, darkMetal);
          for (const s of [-1, 1]) rodTo(b, l * 0.5, 6, s * w * 0.3, l * 0.52, 14, s * w * 0.3, 0.6, darkMetal);
          const spare = mesh(wheelGeo, rubber, b, -l * 0.5, 13, w * 0.2, 5, 2.2, 5);
          spare.rotation.z = Math.PI / 2;
          rodTo(b, -l * 0.3, 22, -w * 0.38, -l * 0.34, 44, -w * 0.4, 0.2, darkMetal);
          starDecal(b, l * 0.28, 15.1, 0, 7, -Math.PI / 2, true);
          for (const s of [-1, 1]) starDecal(b, -l * 0.08, 11, s * (w * 0.47 + 0.05), 5, s > 0 ? 0 : Math.PI);
          militaryLamps(model, b, l * 0.485, 12.2, w * 0.36);
          for (const x of [l * 0.31, -l * 0.31]) for (const s of [-1, 1]) militaryWheel(model, x, s * w * 0.4, r, 4.6);
          if (vehicle.gunner) {
            const ring = cylinder(b, -l * 0.08, 23, 0, 6, 1.4, oliveTrim, 14);
            const turret = new Three.Group();
            turret.position.set(-l * 0.08, 23.5, 0);
            b.add(turret);
            box(turret, 3, 4.5, 0, 1.2, 7, 11, p);
            box(turret, 0, 3, 0, 5, 3, 3, darkMetal);
            const barrel = new Three.Group();
            turret.add(barrel);
            rodTo(barrel, 2, 3.5, 0, 16, 3.5, 0, 0.45, darkMetal);
            box(barrel, 3, 4.5, 2.2, 3, 3, 2, oliveTrim);
            model.tank = true;
            model.turret = turret;
            model.barrel = barrel;
            keep.add(turret);
            ring.castShadow = false;
          }
        } else if (kind === 'apc') {
          const r = 6.3;
          box(b, 0, 13, 0, l * 0.9, 12, w * 0.92, p);
          const glacis = box(b, l * 0.4, 16.5, 0, l * 0.22, 3, w * 0.9, p);
          glacis.rotation.z = -0.55;
          const nose = box(b, l * 0.45, 10, 0, l * 0.12, 7, w * 0.9, p);
          nose.rotation.z = 0.5;
          const rear = box(b, -l * 0.44, 15, 0, l * 0.1, 10, w * 0.9, p);
          rear.rotation.z = -0.2;
          box(b, -l * 0.06, 19.8, 0, l * 0.62, 1.6, w * 0.84, p);
          for (const s of [-1, 1]) {
            const skirt = box(b, 0, 16, s * w * 0.47, l * 0.8, 6, 1.2, p);
            skirt.rotation.x = s * 0.35;
            box(b, -l * 0.2, 17, s * w * 0.5, l * 0.3, 3, 1.4, oliveTrim);
            for (const x of [-l * 0.3, -l * 0.1, l * 0.1]) box(b, x, 21, s * w * 0.36, 3, 1.2, 3, darkMetal);
            starDecal(b, l * 0.18, 13, s * (w * 0.49 + 0.2), 6, s > 0 ? 0 : Math.PI);
          }
          for (const s of [-1, 1]) for (let k = 0; k < 3; k++) box(b, l * 0.3 - k * 2.5, 21.3, s * 3 + s * k * 1.5, 1.6, 1.2, 1.2, darkMetal);
          rodTo(b, -l * 0.35, 20, w * 0.3, -l * 0.38, 50, w * 0.32, 0.2, darkMetal);
          rodTo(b, -l * 0.35, 20, -w * 0.3, -l * 0.37, 42, -w * 0.32, 0.2, darkMetal);
          militaryLamps(model, b, l * 0.48, 12, w * 0.36);
          for (const x of [-l * 0.33, -l * 0.12, l * 0.12, l * 0.33]) for (const s of [-1, 1]) militaryWheel(model, x, s * w * 0.42, r, 4.4);
          const turret = new Three.Group();
          turret.position.set(l * 0.02, 20.6, 0);
          b.add(turret);
          cylinder(turret, 0, 1.6, 0, 8.5, 3.2, p, 10, 7.5);
          box(turret, 1, 5, 0, 12, 4.5, 11, p);
          box(turret, -3, 7.8, -3, 4, 1.2, 4, oliveTrim);
          const barrel = new Three.Group();
          turret.add(barrel);
          rodTo(barrel, 6, 5, 0, 34, 5, 0, 0.7, darkMetal);
          box(barrel, 7.5, 5, 0, 3, 3, 3.6, p);
          model.tank = true;
          model.turret = turret;
          model.barrel = barrel;
          keep.add(turret);
        } else {
          // Cargo truck (or the fuel bowser).
          const r = 6.2,
            bowser = !!vehicle.fuelBowser;
          box(b, -l * 0.02, 7.5, 0, l * 0.94, 3, w * 0.5, darkMetal);
          box(b, l * 0.36, 13.5, 0, l * 0.2, 8, w * 0.52, p);
          for (const s of [-1, 1]) {
            const fender = box(b, l * 0.36, 12, s * w * 0.38, l * 0.2, 1.4, w * 0.26, p);
            fender.rotation.x = s * -0.12;
          }
          box(b, l * 0.465, 13, 0, 1.2, 7, w * 0.44, darkMetal);
          box(b, l * 0.2, 16, 0, l * 0.14, 12, w * 0.9, p);
          box(b, l * 0.275, 19.5, 0, 0.6, 5.5, w * 0.8, glass);
          box(b, l * 0.2, 22.6, 0, l * 0.15, 1.2, w * 0.92, canvasMat);
          for (const s of [-1, 1]) {
            box(b, l * 0.2, 19.5, s * w * 0.455, l * 0.1, 4.5, 0.4, glass);
            box(b, l * 0.28, 19, s * w * 0.5, 0.8, 4, 2.5, darkMetal);
            starDecal(b, l * 0.2, 14, s * (w * 0.455 + 0.2), 5.5, s > 0 ? 0 : Math.PI);
          }
          if (bowser) {
            const tank = cylinder(b, -l * 0.2, 17, 0, w * 0.4, l * 0.52, p, 18);
            tank.rotation.z = Math.PI / 2;
            box(b, -l * 0.2, 25, 0, l * 0.3, 1, 5, darkMetal);
            for (const s of [-1, 1]) plate(b, -l * 0.2, 17, s * (w * 0.41 + 0.3), 18, 5, plateMaterial('FLAMMABLE', { bg: '#b8322a', fg: '#ffffff', w: 256, h: 64 }), s > 0 ? 0 : Math.PI);
          } else {
            box(b, -l * 0.2, 10.5, 0, l * 0.56, 2, w * 0.96, p);
            for (const s of [-1, 1]) box(b, -l * 0.2, 13.5, s * w * 0.47, l * 0.56, 5, 1, p);
            const cover = new Three.Mesh(vaultGeometry(w * 0.96, 12, l * 0.56, 10), canvasMat);
            cover.rotation.y = Math.PI / 2;
            cover.position.set(-l * 0.2, 15.5, 0);
            b.add(cover);
            for (const s of [-1, 1]) box(b, -l * 0.2, 15.5, s * w * 0.475, l * 0.56, 1.5, 0.6, canvasMat);
            const back = new Three.Mesh(archWallGeometry(w * 0.96, 12), canvasMat);
            back.position.set(-l * 0.48, 15.5, 0);
            back.rotation.y = -Math.PI / 2;
            b.add(back);
          }
          militaryLamps(model, b, l * 0.47, 12, w * 0.3);
          for (const x of [l * 0.34, -l * 0.18, -l * 0.34]) for (const s of [-1, 1]) militaryWheel(model, x, s * w * 0.4, r, 4.2);
        }
        for (const lamp of model.lamps) keep.add(lamp.mesh);
        for (const wheel of model.wheels) keep.add(wheel.wheel);
        mergeUnder(b, keep);
        if (model.turret) {
          const inner = new Set([model.barrel]);
          mergeUnder(model.turret, inner);
          mergeUnder(model.barrel);
        }
        return model;
      }
      // The tank (county3d.js) is ~60 meshes: merge its hull and turret the same way.
      function compactTank(model) {
        mergeUnder(model.body, new Set([model.turret, ...(model.lamps || []).map((l) => l.mesh)]));
        mergeUnder(model.turret, new Set([model.barrel]));
        mergeUnder(model.barrel);
        return model;
      }
