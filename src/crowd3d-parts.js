      // Crowd 3D instanced parts: capacity, body material, limbs, weapon and far-figure geometries (crowdParts, rigPart).
      const CROWD_CAPACITY = 900;
      const crowdBodyMaterial = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82 }),
        crowdClothDouble = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, side: Three.DoubleSide }),
        crowdPropMaterial = new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
        crowdPhoneMaterial = new Three.MeshStandardMaterial({ color: '#15171b', emissive: '#86b8ff', emissiveIntensity: 0.55, roughness: 0.3 }),
        crowdEmberMaterial = new Three.MeshBasicMaterial({ color: '#ff8a3a' }),
        crowdLeashMaterial = new Three.MeshStandardMaterial({ color: '#2a2320', roughness: 0.7 });
      /* Limb geometry hangs down from its joint at the origin (dogs). */
      function crowdLimb(rTop, rBottom, length, segments = 7) {
        const g = new Three.CylinderGeometry(rTop, rBottom, length, segments, 1);
        g.translate(0, -length / 2, 0);
        return g;
      }
      /* Merge small geometries, optionally painting each a vertex colour (props). */
      function crowdMerge(list) {
        const parts = list.map(({ geo, color }) => {
          const g = geo.index ? geo.toNonIndexed() : geo;
          if (color) {
            const c = new Three.Color(color),
              n = g.attributes.position.count,
              colors = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
              colors[i * 3] = c.r;
              colors[i * 3 + 1] = c.g;
              colors[i * 3 + 2] = c.b;
            }
            g.setAttribute('color', new Three.BufferAttribute(colors, 3));
          }
          return g;
        });
        const total = parts.reduce((n, g) => n + g.attributes.position.count, 0),
          position = new Float32Array(total * 3),
          normal = new Float32Array(total * 3),
          color = list.some((p) => p.color) ? new Float32Array(total * 3) : null;
        let o = 0;
        for (const g of parts) {
          const n = g.attributes.position.count;
          position.set(g.attributes.position.array, o * 3);
          normal.set(g.attributes.normal.array, o * 3);
          if (color && g.attributes.color) color.set(g.attributes.color.array, o * 3);
          o += n;
        }
        const merged = new Three.BufferGeometry();
        merged.setAttribute('position', new Three.BufferAttribute(position, 3));
        merged.setAttribute('normal', new Three.BufferAttribute(normal, 3));
        if (color) merged.setAttribute('color', new Three.BufferAttribute(color, 3));
        merged.computeBoundingSphere();
        return merged;
      }
      const at = (geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
        const g = geo.clone();
        g.scale(sx, sy, sz);
        g.rotateX(rx);
        g.rotateY(ry);
        g.rotateZ(rz);
        g.translate(x, y, z);
        return g;
      };
      const unitBox = new Three.BoxGeometry(1, 1, 1),
        unitCylinder = new Three.CylinderGeometry(1, 1, 1, 10);
      const crowdParts = {};
      function crowdPart(name, geometry, material, capacity, shadow = true, colored = true) {
        const mesh = new Three.InstancedMesh(geometry, material, capacity);
        mesh.instanceMatrix.setUsage(Three.DynamicDrawUsage);
        if (colored) {
          mesh.instanceColor = new Three.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
          mesh.instanceColor.setUsage(Three.DynamicDrawUsage);
        }
        mesh.count = 0;
        // Instances move every frame, so the mesh-level bounds are meaningless.
        mesh.frustumCulled = false;
        mesh.castShadow = shadow;
        mesh.receiveShadow = true;
        mesh.name = 'crowd ' + name;
        mesh.userData.dynamic = true;
        scene.add(mesh);
        crowdParts[name] = { mesh, n: 0, capacity };
        return crowdParts[name];
      }
      /* A painted body part (character-rig3d.js PAINT SHADER): per-instance paint and mask. */
      function rigPart(name, geometry, material, capacity, shadow = false) {
        const paintAttribute = new Three.InstancedBufferAttribute(new Float32Array(capacity * 4), 4),
          metaAttribute = new Three.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
        paintAttribute.setUsage(Three.DynamicDrawUsage);
        metaAttribute.setUsage(Three.DynamicDrawUsage);
        geometry.setAttribute('crowdPaint', paintAttribute);
        geometry.setAttribute('crowdMeta', metaAttribute);
        const part = crowdPart(name, geometry, material, capacity, shadow, false);
        part.paint = paintAttribute;
        part.meta = metaAttribute;
        return part;
      }
      const weaponGeometries = rigWeaponGeometries();
      /* The figure far away: body and one leg, each a single low mesh. */
      function farFigureGeometries() {
        const region = (g, r) => rigRegion(g, r);
        const body = rigMerge([
          region(
            rigLoft(
              [
                { y: RIG.hip - 0.85, fx: 0.7, bx: 0.8, w: 1.15 },
                { y: RIG.hip + 0.6, fx: 0.85, bx: 0.85, w: 1.2 },
                { y: RIG.hip + 2.4, fx: 1.02, bx: 0.94, w: 1.5 },
                { y: RIG.hip + 3.6, fx: 0.95, bx: 0.95, w: 1.72 },
                { y: RIG.hip + 4.25, fx: 0.55, bx: 0.6, w: 1.1 },
              ],
              8,
            ),
            0,
          ),
          region(rigLoft([{ y: RIG.hip - 0.85, fx: 0.72, bx: 0.82, w: 1.2 }, { y: RIG.hip + 0.8, fx: 0.86, bx: 0.86, w: 1.22 }], 8, null), 1),
          rigBall(0.8, 0.95, 0.66, 3, 0.05, RIG.hip + RIG.waist + RIG.neck + 1.4, 0, 8, 6),
          rigBall(0.86, 0.72, 0.72, 2, -0.08, RIG.hip + RIG.waist + RIG.neck + 1.85, 0, 8, 5),
          ...[-1, 1].map((s) => region(rigPlace(new Three.CylinderGeometry(0.46, 0.3, 4.4, 6, 1), 0, RIG.hip + RIG.waist + RIG.shoulderY - 2.2, s * 1.62, s * 0.08, 0, 0), 0)),
          ...[-1, 1].map((s) => rigBall(0.24, 0.5, 0.16, 3, 0.05, RIG.hip + RIG.waist + RIG.shoulderY - 4.9, s * 1.7, 5, 4)),
        ]);
        const leg = rigMerge([
          region(
            rigLoft(
              [
                { y: 0.3, fx: 0.66, w: 0.66 },
                { y: -RIG.thigh, fx: 0.42, w: 0.4 },
                { y: -RIG.thigh - RIG.shin + 0.2, fx: 0.25, w: 0.24 },
              ],
              6,
            ),
            0,
          ),
          region(rigPlace(new Three.BoxGeometry(2.0, 0.55, 0.74), 0.5, -RIG.thigh - RIG.shin - 0.27, 0), 1),
        ]);
        return { body, leg };
      }
      const farFigure = farFigureGeometries();
