      // BEGIN SUBSYSTEM: src/garage3d.js — Garage meshes
      /**
       * Garage meshes
       * Source: src/garage3d.js
       * Scope: createCityRenderer() closure.
       * Garage buildings, shutters, lights and service details.
       */
      const garageRoofs = [],
        // Ribbed steel sheet (cityscape3d.js) rather than a flat grey slab, which
        // read as a hole in the block from the street camera.
        garageRoofMaterial = (() => {
          const tx = ROOF_TEXTURES.metal.clone();
          tx.repeat.set(3, 3);
          tx.needsUpdate = true;
          return new Three.MeshStandardMaterial({ map: tx, color: '#9aa6a8', roughness: 0.5, metalness: 0.45 });
        })();
      for (const s of GARAGES) {
        const group = new Three.Group();
        scene.add(group);
        // Merged by the static batcher; the roof (hidden while you are inside) stays live.
        batchGroups.push(group);
        const wall = staticMat('#aaa999', 0.86),
          trim = mat(s.color, 0.5, 0.3),
          bayFloor = staticMat('#717b78', 0.8);
        box(
          group,
          s.x,
          0.24,
          (s.y - 98 + s.roadY - 56) / 2,
          216,
          0.4,
          s.roadY - 56 - (s.y - 98),
          staticMat('#505d60'),
        );
        box(group, s.x, 0.6, s.y, 172, 0.6, 157, bayFloor);
        for (const b of garageWalls().filter(
          (b) => Math.abs(b.x - s.x) < 110 && Math.abs(b.y - s.y) < 100,
        ))
          box(group, b.x + b.w / 2, b.height / 2, b.y + b.h / 2, b.w, b.height, b.h, wall);
        for (const side of [-1, 1]) {
          box(group, s.x + side * 87, 22, s.y + 79, 4, 44, 6, trim);
          box(group, s.x + side * 76, 7, s.y - 59, 12, 14, 24, staticMat('#a75544'));
          for (let i = 0; i < 3; i++)
            box(group, s.x + side * 76, 4 + i * 4, s.y - 45.8, 10, 0.7, 0.6, chrome);
        }
        box(group, s.x, 44, s.y + 82, 190, 8, 10, trim);
        box(group, s.x, 48, s.y + 65, 180, 2, 28, darkMetal);
        // Raised shutter and bright, steady strips. The open bay is physically clear.
        for (let i = 0; i < 5; i++) box(group, s.x, 43 + i * 1.2, s.y + 77 - i * 2, 172, 0.65, 2, chrome);
        for (const side of [-1, 1])
          box(
            group,
            s.x + side * 55,
            39,
            s.y,
            2,
            1,
            115,
            new Three.MeshBasicMaterial({
              color: '#e0e4d8',
              toneMapped: false,
            }),
          );
        const roof = box(group, s.x, 49, s.y, 196, 3, 176, garageRoofMaterial);
        roof.userData.dynamic = true;
        garageRoofs.push({
          shop: s,
          roof,
        });
        for (const side of [-1, 1]) box(group, s.x + side * 67, 1, s.y, 2, 0.2, 122, staticMat('#d7bd7e'));
        box(group, s.x, 1, s.y - 61, 134, 0.2, 2, staticMat('#d7bd7e'));
        const title = sign(s.name, s.x, s.y + 88, 182, s.color);
        title.position.y = title.userData.backing.position.y = 57;
        statics.push({
          x: s.x,
          y: s.y,
          group,
          radius: 210,
        });
      }
      function updateGarageVisuals() {
        for (const { shop, roof } of garageRoofs)
          roof.visible = !(
            Math.abs(player.x - shop.x) < 125 &&
            player.y > shop.y - 100 &&
            player.y < shop.roadY
          );
      }
      for (const p of [FLIGHT.heli, FLIGHT.pickup]) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 256;
        const drawingContext2 = cv.getContext('2d');
        drawingContext2.fillStyle = '#56656a';
        drawingContext2.fillRect(0, 0, 256, 256);
        drawingContext2.strokeStyle = '#e6d5a0';
        drawingContext2.lineWidth = 6;
        drawingContext2.beginPath();
        drawingContext2.arc(128, 128, 104, 0, TAU);
        drawingContext2.stroke();
        drawingContext2.fillStyle = '#f0dfb3';
        drawingContext2.font = 'bold 126px Arial';
        drawingContext2.textAlign = 'center';
        drawingContext2.fillText('H', 128, 172);
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        const pad = new Three.Mesh(
          new Three.PlaneGeometry(114, 114),
          new Three.MeshStandardMaterial({
            map: tx,
            roughness: 0.8,
          }),
        );
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(p.x, 0.4, p.y);
        scene.add(pad);
      }
      // END SUBSYSTEM: src/garage3d.js
