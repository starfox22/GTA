      // Chase view console report: the last frame's camera and shadow draw calls by kind and distance band.
      /* Console only: the last frame's draw calls by kind and by distance from the camera (metres
         to the nearest point of each object's bounding sphere), for the camera pass (its render
         list) and the sun's shadow pass (the casters three.js would draw into the map). */
      function chaseDrawBands() {
        const BANDS = [50, 100, 150, 200, 300, 400, 600, Infinity],
          bandName = (d) => (d === Infinity ? 'whole' : '<' + BANDS.find((b) => d < b) + 'm'),
          sphere = new Three.Sphere(),
          vehicleGroups = new Set(),
          view = {},
          shadow = {},
          shadowFrustum = new Three.Frustum(),
          shadowMatrix = new Three.Matrix4();
        for (const m of carModels.values()) vehicleGroups.add(m.group);
        const kindOf = (o) => {
          if (o.name === 'static batch') return 'batch';
          if (o.name === 'far scenery') return 'far';
          if (o.isSprite) return 'sprite';
          if (o.name && o.name.startsWith('crowd')) return 'crowd';
          for (let p = o; p; p = p.parent) {
            if (vehicleGroups.has(p)) return 'vehicle';
            if (p.name === 'static cell') return 'static';
          }
          if (o.isInstancedMesh) return 'instanced';
          return 'other';
        };
        const bandOf = (o) => {
          if (o.isSprite) sphere.set(o.getWorldPosition(new Three.Vector3()), 1);
          else {
            // (An instanced mesh's own sphere, as three.js culls it.)
            if (o.boundingSphere === null) o.computeBoundingSphere();
            const bounds = o.boundingSphere || null;
            if (bounds) sphere.copy(bounds).applyMatrix4(o.matrixWorld);
            else {
              if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
              sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
            }
          }
          if (sphere.radius > 2400 || !o.frustumCulled) return 'whole';
          return bandName(Math.max(0, sphere.center.distanceTo(camera.position) - sphere.radius) / UNITS_PER_METRE);
        };
        const nameOf = (o) => {
          let named = o;
          while (named && !named.name && named.parent && named.parent !== scene && !named.parent.userData.cellContainer) named = named.parent;
          const material = Array.isArray(o.material) ? o.material[0] : o.material;
          const look = ' ' + (o.geometry?.type || '') + ' ' + material.type + (material.color ? ' #' + material.color.getHexString() : '') + (material.map ? ' map' : '') + (material.emissiveMap ? ' lit' : '');
          // Loose scenery (no name, outside the cells) by the map cell of its root.
          let root = o;
          while (root.parent && root.parent !== scene && !root.parent.userData.cellContainer) root = root.parent;
          const where = !named.name && root.parent === scene ? o.getWorldPosition(new Three.Vector3()) : null,
            at = where ? ' @' + Math.round(where.x / 256) * 256 + ',' + Math.round(where.z / 256) * 256 : '';
          return (named.name || o.type) + (o.name === 'static batch' || !named.name ? look : '') + at;
        };
        const add = (table, o, triangles) => {
          const kind = kindOf(o),
            band = bandOf(o),
            row = table[kind] || (table[kind] = { calls: 0, triangles: 0, names: {} });
          row.calls++;
          row.triangles += triangles;
          row[band] = (row[band] || 0) + 1;
          const name = nameOf(o);
          const entry = row.names[name] || (row.names[name] = [0, 0]);
          entry[0]++;
          entry[1] += triangles;
        };
        const trianglesOf = (o, group) => {
          const g = o.geometry;
          if (!g || !o.isMesh) return 0;
          let count = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0;
          if (group) count = Math.min(count, group.count);
          count = Math.min(count, g.drawRange.count);
          return (count / 3) * (o.isInstancedMesh ? o.count : g.isInstancedBufferGeometry ? g.instanceCount : 1);
        };
        const list = renderer.renderLists.get(scene, 0);
        for (const items of [list.opaque, list.transmissive, list.transparent])
          for (const item of items) add(view, item.object, trianglesOf(item.object, item.group));
        // The shadow pass: casters inside the sun's shadow box (WebGLShadowMap renderObject's test).
        const shadowCamera = sun.shadow.camera;
        shadowCamera.updateMatrixWorld(true);
        shadowFrustum.setFromProjectionMatrix(shadowMatrix.multiplyMatrices(shadowCamera.projectionMatrix, shadowCamera.matrixWorldInverse));
        const visit = (o) => {
          if (!o.visible) return;
          if (o.layers.test(camera.layers) && (o.isMesh || o.isLine || o.isPoints) && o.castShadow && (!o.frustumCulled || shadowFrustum.intersectsObject(o))) {
            const materials = Array.isArray(o.material) ? o.material : null;
            if (materials) {
              for (const group of o.geometry.groups) if (materials[group.materialIndex]?.visible) add(shadow, o, trianglesOf(o, group));
            } else if (o.material.visible) add(shadow, o, trianglesOf(o, null));
          }
          for (const c of o.children) visit(c);
        };
        if (renderer.shadowMap.enabled && sun.castShadow) {
          // As the pass runs: without the casters CHASE SHADOW CASTERS leaves out.
          if (camera === chaseCamera) chaseShadowCasters(true);
          try {
            visit(scene);
          } finally {
            chaseShadowCasters(false);
          }
        }
        const total = (table) => {
          let calls = 0,
            triangles = 0;
          for (const row of Object.values(table)) {
            calls += row.calls;
            triangles += row.triangles;
            row.triangles = Math.round(row.triangles);
            // [name, calls, thousand triangles], the most calls first, then the most triangles.
            const named = Object.entries(row.names).map(([name, [n, t]]) => [name, n, Math.round(t / 1000)]);
            row.names = [...named.sort((a, b) => b[1] - a[1]).slice(0, 12), ...named.sort((a, b) => b[2] - a[2]).slice(0, 8).map((e) => [...e])];
          }
          return { calls, triangles: Math.round(triangles) };
        };
        return { view: { ...total(view), kinds: view }, shadow: { ...total(shadow), kinds: shadow } };
      }
