      // Fort Sentinel geometry helpers: rodTo, strip, coil, vault and arch walls, gableRoof, cylinder, mergeUnder.
      const rodTo = (parent, ax, ay, az, bx, by, bz, r, material) =>
        rod(parent, new Three.Vector3(ax, ay, az), new Three.Vector3(bx, by, bz), r, material);
      // A vertical strip between two map points with its texture repeated every `period`.
      function strip(parent, ax, az, bx, bz, y0, height, material, period = 16) {
        const length = Math.hypot(bx - ax, bz - az),
          geo = new Three.PlaneGeometry(length, height),
          uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * length) / period, (uv.getY(i) * height) / period);
        const m = new Three.Mesh(geo, material);
        m.position.set((ax + bx) / 2, y0 + height / 2, (az + bz) / 2);
        m.rotation.y = -Math.atan2(bz - az, bx - ax);
        m.receiveShadow = true;
        parent.add(m);
        return m;
      }
      // A concertina coil along a line (an open tube with a looped wire texture).
      function coil(parent, ax, az, bx, bz, y, r) {
        const length = Math.hypot(bx - ax, bz - az),
          geo = new Three.CylinderGeometry(r, r, length, 7, 1, true),
          uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, (uv.getY(i) * length) / (r * 2.2));
        const m = new Three.Mesh(geo, B.wire);
        m.position.set((ax + bx) / 2, y, (az + bz) / 2);
        m.rotation.set(0, -Math.atan2(bz - az, bx - ax), Math.PI / 2);
        parent.add(m);
        return m;
      }
      // Half-elliptic barrel vault: `width` across x, `height` up, `depth` along z.
      function vaultGeometry(width, height, depth, segments = 20) {
        const positions = [],
          indices = [],
          uvs = [];
        for (let i = 0; i <= segments; i++) {
          const a = (Math.PI * i) / segments,
            x = -Math.cos(a) * width * 0.5,
            y = Math.sin(a) * height;
          for (const z of [-depth / 2, depth / 2]) {
            positions.push(x, y, z);
            uvs.push((i / segments) * width * 0.08, (z + depth / 2) * 0.02);
          }
          if (i) {
            const k = i * 2;
            // Wound so the outside faces out (earth mounds are single-sided).
            indices.push(k - 2, k - 1, k, k - 1, k + 1, k);
          }
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
      }
      // Half-ellipse end wall, optionally with a rectangular door opening.
      function archWallGeometry(width, height, doorWidth = 0, doorHeight = 0) {
        const s = new Three.Shape();
        s.moveTo(-width / 2, 0);
        if (doorWidth) {
          s.lineTo(-doorWidth / 2, 0);
          s.lineTo(-doorWidth / 2, doorHeight);
          s.lineTo(doorWidth / 2, doorHeight);
          s.lineTo(doorWidth / 2, 0);
        }
        s.lineTo(width / 2, 0);
        s.absellipse(0, 0, width / 2, height, 0, Math.PI, false);
        const geo = new Three.ShapeGeometry(s, 16),
          uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.08, uv.getY(i) * 0.08);
        return geo;
      }
      // A gable roof: ridge along x, `length` long, `width` across z, rising `rise`.
      function gableRoof(parent, cx, y, cz, length, width, rise, material) {
        const s = new Three.Shape();
        s.moveTo(-width / 2, 0);
        s.lineTo(width / 2, 0);
        s.lineTo(0, rise);
        s.lineTo(-width / 2, 0);
        const geo = new Three.ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
        geo.translate(0, 0, -length / 2);
        geo.rotateY(Math.PI / 2);
        const m = new Three.Mesh(geo, material);
        m.position.set(cx, y, cz);
        m.castShadow = m.receiveShadow = true;
        parent.add(m);
        return m;
      }
      function cylinder(parent, x, y, z, r, h, material, segments = 16, rTop = r) {
        const m = new Three.Mesh(new Three.CylinderGeometry(rTop, r, h, segments), material);
        m.position.set(x, y, z);
        m.castShadow = m.receiveShadow = true;
        parent.add(m);
        return m;
      }
      /* Merge every mesh under `root` (except those under a node in `keep`) into one
         mesh per material in root's frame: a vehicle model of forty boxes becomes a
         handful of draw calls. */
      function mergeUnder(root, keep = new Set()) {
        root.updateMatrixWorld(true);
        const inverse = new Three.Matrix4().copy(root.matrixWorld).invert(),
          buckets = new Map(),
          taken = [],
          v = new Three.Vector3(),
          n3 = new Three.Matrix3(),
          local = new Three.Matrix4();
        root.traverse((o) => {
          if (!o.isMesh || o.isSprite || Array.isArray(o.material) || o === root) return;
          for (let p = o; p && p !== root; p = p.parent) if (keep.has(p)) return;
          if (!buckets.has(o.material)) buckets.set(o.material, []);
          buckets.get(o.material).push(o);
          taken.push(o);
        });
        for (const [material, meshes] of buckets) {
          if (meshes.length < 2) continue;
          let vertices = 0,
            count = 0;
          for (const o of meshes) {
            vertices += o.geometry.attributes.position.count;
            count += o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
          }
          const positions = new Float32Array(vertices * 3),
            normals = new Float32Array(vertices * 3),
            uvs = new Float32Array(vertices * 2),
            indices = new Uint32Array(count);
          let vo = 0,
            io = 0;
          for (const o of meshes) {
            const geo = o.geometry,
              pos = geo.attributes.position,
              nor = geo.attributes.normal,
              uv = geo.attributes.uv;
            local.multiplyMatrices(inverse, o.matrixWorld);
            n3.getNormalMatrix(local);
            for (let i = 0; i < pos.count; i++) {
              v.fromBufferAttribute(pos, i).applyMatrix4(local);
              positions.set([v.x, v.y, v.z], (vo + i) * 3);
              if (nor) v.fromBufferAttribute(nor, i).applyMatrix3(n3).normalize();
              else v.set(0, 1, 0);
              normals.set([v.x, v.y, v.z], (vo + i) * 3);
              if (uv) uvs.set([uv.getX(i), uv.getY(i)], (vo + i) * 2);
            }
            if (geo.index) for (let i = 0; i < geo.index.count; i++) indices[io++] = geo.index.getX(i) + vo;
            else for (let i = 0; i < pos.count; i++) indices[io++] = vo + i;
            vo += pos.count;
            o.parent.remove(o);
          }
          const merged = new Three.BufferGeometry();
          merged.setAttribute('position', new Three.BufferAttribute(positions, 3));
          merged.setAttribute('normal', new Three.BufferAttribute(normals, 3));
          merged.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
          merged.setIndex(new Three.BufferAttribute(indices, 1));
          merged.computeBoundingSphere();
          const m = new Three.Mesh(merged, material);
          m.castShadow = m.receiveShadow = true;
          root.add(m);
        }
      }
