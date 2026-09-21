      // BEGIN SUBSYSTEM: src/sidejobs3d.js — Contract mission meshes
      /**
       * Contract mission meshes
       * Source: src/sidejobs3d.js
       * Scope: createCityRenderer() closure.
       * Sky rings for the Ring Run time-trial, blinking devices for bombs and
       * substations, and the per-frame update that shows only the live contract.
       */
      const ringPool = Array.from({ length: 8 }, () => {
        const ring = new Three.Mesh(
          new Three.TorusGeometry(52, 4, 10, 40),
          new Three.MeshStandardMaterial({
            color: '#ffd27a',
            emissive: '#ffb347',
            emissiveIntensity: 1.2,
            roughness: 0.4,
            metalness: 0.3,
          }),
        );
        ring.visible = false;
        scene.add(ring);
        const glow = halo(ring, 0, 0, 0, 150, '#ffd48a');
        glow.material.opacity = 0.35;
        return ring;
      });
      const devicePool = Array.from({ length: 3 }, () => {
        const g = new Three.Group();
        g.visible = false;
        g.scale.setScalar(1.7);
        scene.add(g);
        box(g, 0, 4, 0, 12, 8, 9, mat('#3a4a3f', 0.6, 0.4));
        box(g, 0, 8.6, 0, 10, 1.2, 7, darkMetal);
        const lamp = box(g, 0, 9.8, 2, 1.6, 1.6, 1.6, new Three.MeshBasicMaterial({ color: '#ff4a3a' }));
        const glow = halo(g, 0, 10, 2, 22, '#ff5a3a');
        for (const dx of [-4, 4]) box(g, dx, 4, 4.6, 0.6, 5, 0.3, mat('#9aa3a6', 0.4, 0.6));
        return { g, lamp, glow };
      });
      function updateSideJobVisuals() {
        const rings = sideJobRings();
        ringPool.forEach((ring, i) => {
          const data = rings && rings[i];
          ring.visible = !!data && !data.passed;
          if (!ring.visible) return;
          ring.position.set(data.x, data.altitude, data.y);
          ring.rotation.y = gameTime * 0.4;
          const current = rings.findIndex((r) => !r.passed) === i;
          ring.material.emissiveIntensity = current ? 1.6 + Math.sin(gameTime * 6) * 0.5 : 0.5;
          ring.material.color.set(current ? '#ffd27a' : '#8fa4b0');
        });
        const devices = sideJobDevices();
        devicePool.forEach((d, i) => {
          const data = devices && devices[i];
          d.g.visible = !!data && !data.defused;
          if (!d.g.visible) return;
          d.g.position.set(data.x, terrainHeight(data.x, data.y), data.y);
          const blink = Math.sin(gameTime * 8 + i) > 0;
          d.lamp.material.color.set(blink ? '#ff4a3a' : '#4a1512');
          d.glow.material.opacity = blink ? 0.9 : 0.1;
        });
      }
      // END SUBSYSTEM: src/sidejobs3d.js
