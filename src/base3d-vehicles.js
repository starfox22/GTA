      // Military vehicle models: makeMilitaryVehicle(), compactTank, wheels, lamps and star decals.
      const oliveTrim = mat('#3c4433', 0.8, 0.2),
        canvasMat = mat('#6b6c4c', 0.97);
      /*
       * MILITARY MARKS
       * The stars and the stencilled designations on the army's vehicles share one texture and one material
       * (`militaryMarks()`): a vehicle's star decals and its stencil merge into one mesh (mergeUnder), so the stencil adds
       * no draw call. Cream stencil capitals on a transparent ground (alpha-tested), the star in the first cell.
       */
      const MILITARY_STENCILS = { jeep: 'SENTINEL J4', apc: 'LAV-8  A12', truck: 'M35 CARGO', bowser: 'M49 FUEL' },
        // Made on the first army vehicle (sharedMaterials is declared after the scenery is set up).
        militaryMarksMade = () => {
          const rows = Object.keys(MILITARY_STENCILS),
            widths = {},
            tx = baseTexture(
              512,
              256,
              (g) => {
                g.clearRect(0, 0, 512, 256);
                // The star (as base3d-materials.js starTx draws it), in the 128 x 128 cell at the top left.
                g.fillStyle = '#e8e6d8';
                g.beginPath();
                for (let i = 0; i < 10; i++) {
                  const r = i % 2 ? 22 : 56,
                    a = -Math.PI / 2 + (i * Math.PI) / 5;
                  g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
                }
                g.fill();
                g.strokeStyle = '#e8e6d8';
                g.lineWidth = 6;
                g.beginPath();
                g.arc(64, 64, 60, 0, TAU);
                g.stroke();
                // A stencil per row to the right of it, 48 px capitals, the bridges of a stencil cut through them.
                g.font = 'bold 52px "Arial Narrow", Arial, sans-serif';
                g.textBaseline = 'middle';
                rows.forEach((kind, i) => {
                  const text = MILITARY_STENCILS[kind],
                    y = 32 + i * 64,
                    width = Math.min(370, g.measureText(text).width);
                  g.fillStyle = '#e8e6d8';
                  g.fillText(text, 136, y, 370);
                  g.clearRect(136, y - 2, width, 3);
                  widths[kind] = width + 8;
                });
              },
              false,
            );
          bakedCanvases.push(tx);
          const material = new Three.MeshStandardMaterial({ map: tx, alphaTest: 0.5, roughness: 0.8 });
          sharedMaterials.add(material);
          return { material, rows, widths };
        };
      let militaryMarksCache = null;
      function militaryMarks() {
        return militaryMarksCache || (militaryMarksCache = militaryMarksMade());
      }
      // A plate's UVs onto a cell of the marks: [u0, v0, u1, v1] in pixels of the 512 x 256 canvas (top-left origin).
      function militaryMarkUv(m, x0, y0, x1, y1) {
        const uv = m.geometry.attributes.uv;
        // PlaneGeometry's corners: (0,1) (1,1) (0,0) (1,0).
        const u = [x0 / 512, x1 / 512, x0 / 512, x1 / 512],
          v = [1 - y0 / 256, 1 - y0 / 256, 1 - y1 / 256, 1 - y1 / 256];
        for (let i = 0; i < 4; i++) uv.setXY(i, u[i], v[i]);
        uv.needsUpdate = true;
        return m;
      }
      function starDecal(parent, x, y, z, size, facing, flat = false) {
        const m = militaryMarkUv(plate(parent, x, y, z, size, size, militaryMarks().material, facing), 2, 2, 126, 126);
        if (flat) m.rotation.set(-Math.PI / 2, 0, facing);
        return m;
      }
      // The stencilled designation (MILITARY_STENCILS) on a vehicle's tail, `h` tall, centred at (x, y, z), facing back.
      function militaryStencil(parent, kind, x, y, z, h) {
        const marks = militaryMarks(),
          i = marks.rows.indexOf(kind),
          width = marks.widths[kind] || 200,
          m = plate(parent, x, y, z, (h * width) / 56, h, marks.material, -Math.PI / 2);
        return militaryMarkUv(m, 132, 4 + i * 64, 136 + width, 60 + i * 64);
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
          militaryStencil(b, 'jeep', -l * 0.48 - 1.15, 11, -w * 0.2, 1.1);
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
            // The M2 itself (mounted-guns.js fires it): receiver, the heavy barrel's
            // jacket, the flash hider and the spade grips back toward the gunner.
            box(barrel, 0.6, 3.6, 0, 4.2, 1.9, 1.7, darkMetal);
            rodTo(barrel, 2.6, 3.5, 0, 6.2, 3.5, 0, 0.8, darkMetal);
            rodTo(barrel, 15, 3.5, 0, 16.8, 3.5, 0, 0.66, darkMetal);
            for (const s of [-1, 1]) rodTo(barrel, -1.4, 3.6, s * 0.6, -2.6, 3.4, s * 0.95, 0.26, darkMetal);
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
          militaryStencil(b, 'apc', -l * 0.49 - 0.65, 12.5, w * 0.18, 1.2);
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
          // The 25 mm gun's muzzle brake, and the coaxial MG beside it on the right
          // (mounted-guns.js fires both).
          rodTo(barrel, 32, 5, 0, 35.4, 5, 0, 1.05, darkMetal);
          box(barrel, 7.8, 5, 3.4, 3, 2, 2, darkMetal);
          rodTo(barrel, 9, 5, 3.4, 19, 5, 3.4, 0.3, darkMetal);
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
            militaryStencil(b, 'bowser', -l * 0.46 - 0.15, 17, 0, 1.4);
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
            militaryStencil(b, 'truck', -l * 0.48 - 0.2, 11.5, w * 0.22, 1.3);
          }
          militaryLamps(model, b, l * 0.47, 12, w * 0.3);
          for (const x of [l * 0.34, -l * 0.18, -l * 0.34]) for (const s of [-1, 1]) militaryWheel(model, x, s * w * 0.4, r, 4.2);
        }
        // Its stencil (DeadEndCity.carBadges()).
        model.badge = { text: MILITARY_STENCILS[kind === 'truck' && vehicle.fuelBowser ? 'bowser' : kind] || null, stencil: true };
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
