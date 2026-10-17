      // Exact CPU ray broadphase for immutable downloaded military bodies. The
      // renderer still draws the original geometry; Three still intersects each
      // selected original triangle and produces its usual normals, UVs and hits.
      const militaryMarkTrees = new WeakMap(),
        militaryMarkFullIntersections = Three.Mesh.prototype._computeIntersections;
      function militaryMarkTree(geometry) {
        const cached = militaryMarkTrees.get(geometry);
        if (cached) return cached;
        const position = geometry.attributes.position,
          index = geometry.index,
          triangles = index ? index.count / 3 : 0;
        if (!position || triangles < 256 || triangles % 1 || geometry.morphAttributes.position?.length) return null;
        const faces = new Uint32Array(triangles),
          centres = new Float64Array(triangles * 3),
          bounds = new Float64Array(triangles * 6), nodes = [];
        for (let i = 0; i < triangles; i++) {
          faces[i] = i;
          const a = index.getX(i * 3), b = index.getX(i * 3 + 1), c = index.getX(i * 3 + 2);
          centres[i * 3] = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
          centres[i * 3 + 1] = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
          centres[i * 3 + 2] = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
          const at = i * 6;
          bounds[at] = Math.min(position.getX(a), position.getX(b), position.getX(c));
          bounds[at + 1] = Math.min(position.getY(a), position.getY(b), position.getY(c));
          bounds[at + 2] = Math.min(position.getZ(a), position.getZ(b), position.getZ(c));
          bounds[at + 3] = Math.max(position.getX(a), position.getX(b), position.getX(c));
          bounds[at + 4] = Math.max(position.getY(a), position.getY(b), position.getY(c));
          bounds[at + 5] = Math.max(position.getZ(a), position.getZ(b), position.getZ(c));
          const pad = Math.max(1, bounds[at + 3] - bounds[at], bounds[at + 4] - bounds[at + 1], bounds[at + 5] - bounds[at + 2]) * 1e-7;
          for (let axis = 0; axis < 3; axis++) { bounds[at + axis] -= pad; bounds[at + axis + 3] += pad; }
        }
        function branch(first, count) {
          const at = nodes.length,
            box = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]),
            node = { box, first, count, left: -1, right: -1 };
          nodes.push(node);
          for (let i = first; i < first + count; i++)
            for (let axis = 0; axis < 3; axis++) {
              const at = faces[i] * 6;
              if (bounds[at + axis] < box[axis]) box[axis] = bounds[at + axis];
              if (bounds[at + axis + 3] > box[axis + 3]) box[axis + 3] = bounds[at + axis + 3];
            }
          const x = box[3] - box[0], y = box[4] - box[1], z = box[5] - box[2],
            axis = x >= y && x >= z ? 0 : y >= z ? 1 : 2;
          if (count > 32) {
            faces.subarray(first, first + count).sort((a, b) => centres[a * 3 + axis] - centres[b * 3 + axis] || a - b);
            const half = Math.floor(count / 2);
            node.left = branch(first, half);
            node.right = branch(first + half, count - half);
          }
          return at;
        }
        branch(0, triangles);
        // This geometry is CPU-only and never uploaded or added to a scene. Its
        // attributes alias the immutable source; only this private index changes.
        const subset = new Three.BufferGeometry(),
          selected = new Uint32Array(index.count),
          record = { geometry, position, index, pv: position.version, iv: index.version, faces, bounds, nodes, subset,
            selected, order: new Uint32Array(triangles), sort: new Uint32Array(triangles),
            bins: new Uint32Array(256), stack: new Int32Array(nodes.length), busy: false };
        subset.attributes = geometry.attributes;
        subset.setIndex(new Three.BufferAttribute(selected, 1));
        militaryMarkTrees.set(geometry, record);
        geometry.addEventListener('dispose', militaryMarkTreeDisposed);
        return record;
      }
      function militaryMarkTreeDisposed(event) {
        const geometry = event.target,
          record = militaryMarkTrees.get(geometry);
        if (record) record.subset.dispose();
        militaryMarkTrees.delete(geometry);
        geometry.removeEventListener('dispose', militaryMarkTreeDisposed);
      }
      function militaryMarkRayMesh(mesh) {
        if (mesh._computeIntersections === militaryMarkFullIntersections && !mesh.isSkinnedMesh && militaryMarkTree(mesh.geometry))
          mesh._computeIntersections = militaryMarkIntersections;
        return mesh;
      }
      function militaryMarkBoxHit(ray, box, at, near, far) {
        const o = ray.origin, d = ray.direction;
        if (d.x === 0) { if (o.x < box[at] || o.x > box[at + 3]) return false; }
        else {
          let a = (box[at] - o.x) / d.x, b = (box[at + 3] - o.x) / d.x;
          if (a > b) { const swap = a; a = b; b = swap; }
          if (a > near) near = a; if (b < far) far = b;
          if (far < near) return false;
        }
        if (d.y === 0) { if (o.y < box[at + 1] || o.y > box[at + 4]) return false; }
        else {
          let a = (box[at + 1] - o.y) / d.y, b = (box[at + 4] - o.y) / d.y;
          if (a > b) { const swap = a; a = b; b = swap; }
          if (a > near) near = a; if (b < far) far = b;
          if (far < near) return false;
        }
        if (d.z === 0) { if (o.z < box[at + 2] || o.z > box[at + 5]) return false; }
        else {
          let a = (box[at + 2] - o.z) / d.z, b = (box[at + 5] - o.z) / d.z;
          if (a > b) { const swap = a; a = b; b = swap; }
          if (a > near) near = a; if (b < far) far = b;
          if (far < near) return false;
        }
        return true;
      }
      function militaryMarkIntersections(raycaster, intersects, ray) {
        const geometry = this.geometry,
          tree = militaryMarkTrees.get(geometry),
          range = geometry.drawRange;
        // Only the declared immutable, ordinary indexed body path is accelerated.
        // A future deformation, morph, material group or partial draw keeps Three's
        // complete path rather than risking stale bounds or changing hit order.
        if (!tree || tree.busy || Array.isArray(this.material) || this.morphTargetInfluences?.length ||
            geometry.attributes.position !== tree.position || geometry.index !== tree.index ||
            tree.position.version !== tree.pv || tree.index.version !== tree.iv ||
            range.start !== 0 || range.count < tree.index.count)
          return militaryMarkFullIntersections.call(this, raycaster, intersects, ray);
        const nodes = tree.nodes, stack = tree.stack, order = tree.order,
          e = this.matrixWorld.elements, d = ray.direction,
          dx = e[0] * d.x + e[4] * d.y + e[8] * d.z,
          dy = e[1] * d.x + e[5] * d.y + e[9] * d.z,
          dz = e[2] * d.x + e[6] * d.y + e[10] * d.z,
          worldPerLocal = Math.sqrt(dx * dx + dy * dy + dz * dz),
          // Ring rays are only a few centimetres long. A segment broadphase
          // rejects the opposite panels too; nonuniform/negative model scales
          // keep the same world near/far distances as Three's final hit filter.
          near = Math.max(0, raycaster.near / worldPerLocal - 1e-6),
          far = raycaster.far / worldPerLocal + 1e-6;
        let pending = 1, count = 0;
        stack[0] = 0;
        while (pending) {
          const node = nodes[stack[--pending]];
          if (!militaryMarkBoxHit(ray, node.box, 0, near, far)) continue;
          if (node.left >= 0) {
            stack[pending++] = node.right;
            stack[pending++] = node.left;
          } else for (let i = node.first; i < node.first + node.count; i++) {
            const face = tree.faces[i];
            if (militaryMarkBoxHit(ray, tree.bounds, face * 6, near, far)) order[count++] = face;
          }
        }
        if (!count) return;
        // Radix order preserves vanilla's source-face order (including coincident
        // surfaces) without allocating a list or a sort callback for every ray.
        if (count <= 64) {
          for (let i = 1; i < count; i++) {
            const face = order[i];
            let at = i;
            while (at && order[at - 1] > face) { order[at] = order[at - 1]; at--; }
            order[at] = face;
          }
        } else {
          let from = order, to = tree.sort;
          const passes = tree.faces.length <= 65536 ? 2 : 4, bins = tree.bins;
          for (let pass = 0; pass < passes; pass++) {
            bins.fill(0);
            const shift = pass * 8;
            for (let i = 0; i < count; i++) bins[(from[i] >>> shift) & 255]++;
            let at = 0;
            for (let i = 0; i < 256; i++) { const n = bins[i]; bins[i] = at; at += n; }
            for (let i = 0; i < count; i++) { const face = from[i]; to[bins[(face >>> shift) & 255]++] = face; }
            const swap = from; from = to; to = swap;
          }
        }
        const source = tree.index, selected = tree.selected;
        for (let i = 0; i < count; i++) {
          const face = order[i] * 3;
          selected[i * 3] = source.getX(face);
          selected[i * 3 + 1] = source.getX(face + 1);
          selected[i * 3 + 2] = source.getX(face + 2);
        }
        tree.subset.drawRange.count = count * 3;
        const before = intersects.length;
        tree.busy = true;
        this.geometry = tree.subset;
        try {
          militaryMarkFullIntersections.call(this, raycaster, intersects, ray);
          for (let i = before; i < intersects.length; i++) intersects[i].faceIndex = order[intersects[i].faceIndex];
        } finally {
          this.geometry = geometry;
          tree.busy = false;
        }
      }
