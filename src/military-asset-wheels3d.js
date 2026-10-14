      // Downloaded M4 wheels: split the source tyre circle from fixed running gear,
      // recover its true axle and preserve every source triangle at its rest location.
      // This runs once per cached kit; all other models retain their exact original geometry.
      function militaryAssetWheelPartition(geo, wh, k, type) {
        const fallback = { wheel: geo, fixed: null, at: [wh.x * k, wh.y * k, wh.z * k], r: wh.r * k, calibrated: false };
        if (type !== 'army_jeep' || !geo?.index || !geo.attributes.position || !(k > 0) || !(wh.r > 0)) return fallback;
        const position = geo.attributes.position, index = geo.index.array, count = position.count,
          parent = new Int32Array(count), weld = new Map();
        // Coincident corners are split by normals/UV seams in the packed model.
        // Exact decoded Float32 positions reconnect them without joining nearby pieces.
        for (let i = 0; i < count; i++) {
          const key = position.getX(i) + ',' + position.getY(i) + ',' + position.getZ(i), known = weld.get(key);
          parent[i] = known === undefined ? i : known;
          if (known === undefined) weld.set(key, i);
        }
        const find = i => {
          while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
          return i;
        };
        for (let i = 0; i < index.length; i += 3) {
          const a = find(index[i]), b = find(index[i + 1]), c = find(index[i + 2]);
          parent[b] = parent[c] = a;
        }
        const pieces = new Map();
        for (let i = 0; i < index.length; i += 3) {
          const key = find(index[i]);
          let piece = pieces.get(key);
          if (!piece) { piece = { triangles: [], vertices: new Set() }; pieces.set(key, piece); }
          piece.triangles.push(i / 3);
          piece.vertices.add(index[i]); piece.vertices.add(index[i + 1]); piece.vertices.add(index[i + 2]);
        }
        let ring = null;
        for (const piece of pieces.values()) if (!ring || piece.triangles.length > ring.triangles.length) ring = piece;
        if (!ring || ring.triangles.length < 100 || ring.triangles.length * 2 < index.length / 3) return fallback;
        const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
        for (const i of ring.vertices) {
          const p = [position.getX(i), position.getY(i), position.getZ(i)];
          for (let axis = 0; axis < 3; axis++) { low[axis] = Math.min(low[axis], p[axis]); high[axis] = Math.max(high[axis], p[axis]); }
        }
        const center = low.map((v, axis) => (v + high[axis]) * .5),
          radius = (high[1] - low[1]) * .5, width = high[2] - low[2],
          aspect = (high[0] - low[0]) / (radius * 2), angles = new Set();
        let farthest = 0;
        for (const i of ring.vertices) {
          const x = position.getX(i) - center[0], y = position.getY(i) - center[1];
          farthest = Math.max(farthest, Math.hypot(x, y));
          angles.add(Math.floor((Math.atan2(y, x) + Math.PI) / (Math.PI * 2) * 36) % 36);
        }
        // The shipped HMMWV has one dominant complete tyre/rim circle per part.
        // Validate its round envelope before correcting a source pivot: uncertain/new
        // layouts fall back whole rather than deleting or guessing at any geometry.
        if (aspect < .95 || aspect > 1.05 || radius < wh.r * k * .8 || radius > wh.r * k * 1.15 ||
          width > radius || farthest > radius * 1.04 || angles.size < 20) return fallback;
        const rolling = new Set(ring.triangles);
        for (const piece of pieces.values()) {
          if (piece === ring) continue;
          const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
          let radial = 0, axial = 0;
          for (const i of piece.vertices) {
            const p = [position.getX(i) - center[0], position.getY(i) - center[1], position.getZ(i) - center[2]];
            radial = Math.max(radial, Math.hypot(p[0], p[1])); axial = Math.max(axial, Math.abs(p[2]));
            for (let axis = 0; axis < 3; axis++) { lo[axis] = Math.min(lo[axis], p[axis]); hi[axis] = Math.max(hi[axis], p[axis]); }
          }
          // Small coaxial hub nuts stay on the rolling wheel. Calipers, suspension,
          // linkages and fender fragments outside this hub envelope stay on the body.
          if (radial <= radius * .18 && axial <= width * .55 && Math.max(...hi.map((v, axis) => v - lo[axis])) <= radius * .2)
            for (const triangle of piece.triangles) rolling.add(triangle);
        }
        const moving = [], fixed = [];
        for (let triangle = 0; triangle < index.length / 3; triangle++) (rolling.has(triangle) ? moving : fixed).push(triangle);
        function subset(triangles, offset) {
          if (!triangles.length) return null;
          const vertices = new Map(), order = [], remapped = [];
          for (const triangle of triangles) for (let corner = 0; corner < 3; corner++) {
            const old = index[triangle * 3 + corner];
            let next = vertices.get(old);
            if (next === undefined) { next = order.length; vertices.set(old, next); order.push(old); }
            remapped.push(next);
          }
          const result = new Three.BufferGeometry();
          for (const [name, attribute] of Object.entries(geo.attributes)) {
            const array = new attribute.array.constructor(order.length * attribute.itemSize);
            for (let i = 0; i < order.length; i++) for (let component = 0; component < attribute.itemSize; component++)
              array[i * attribute.itemSize + component] = attribute.array[order[i] * attribute.itemSize + component];
            result.setAttribute(name, new Three.BufferAttribute(array, attribute.itemSize, attribute.normalized));
          }
          result.setIndex(remapped);
          // Translation needs only positions; keep packed normals/UVs/finish bytes
          // exact instead of renormalizing normals through applyMatrix4(identity).
          const points = result.attributes.position.array;
          for (let i = 0; i < points.length; i += 3) {
            points[i] += offset[0]; points[i + 1] += offset[1]; points[i + 2] += offset[2];
          }
          result.computeBoundingBox(); result.computeBoundingSphere();
          result.userData.sourceTriangles = triangles.slice();
          sharedGeometries.add(result);
          return result;
        }
        const wheel = subset(moving, center.map(v => -v)),
          body = subset(fixed, fallback.at);
        // Both subsets own compact attribute buffers; the unuploaded input is no
        // longer drawn or shared by any kit, so it need not stay in the warm set.
        sharedGeometries.delete(geo);
        geo.dispose();
        return { wheel, fixed: body, at: fallback.at.map((v, axis) => v + center[axis]), r: radius, calibrated: true,
          sourceTriangles: index.length / 3, rollingTriangles: moving.length, fixedTriangles: fixed.length,
          ringTriangles: ring.triangles.length, sourceCenter: center, components: pieces.size };
      }
