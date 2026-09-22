      // BEGIN SUBSYSTEM: src/cycles3d.js — Bike-share stand meshes
      /**
       * Bike-share stand meshes
       * Source: src/cycles3d.js
       * Scope: createCityRenderer() closure.
       * The racks themselves; the bicycles in them are ordinary vehicles.
       */
      {
        const rackSteel = mat('#9aa3a2', 0.4, 0.6),
          rackBase = mat('#6f7472', 0.85),
          hoopGeo = new Three.TorusGeometry(6, 0.9, 5, 12);
        for (const stand of cycleStands()) {
          const group = new Three.Group();
          group.position.set(stand.x, terrainHeight(stand.x, stand.y), stand.y);
          group.rotation.y = -stand.a;
          scene.add(group);
          batchGroups.push(group);
          box(group, 0, 0.8, 0, 62, 1.6, 12, rackBase);
          for (let i = -2; i <= 2; i++) {
            const hoop = mesh(hoopGeo, rackSteel, group, i * 15, 6, 0);
            hoop.rotation.y = Math.PI / 2;
          }
          statics.push({ x: stand.x, y: stand.y, group, radius: 90 });
        }
      }
      // END SUBSYSTEM: src/cycles3d.js
