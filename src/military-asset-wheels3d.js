      // Downloaded M4 wheels: split the source tyre circle from fixed running gear,
      // recover its true axle and circularize its slightly oval source tyre/rim.
      // This runs once per cached kit; all other models retain their exact original geometry.
      function militaryWheelCircularize(geo, radius, ringTriangles) {
        const p = geo.attributes.position, n = geo.attributes.normal, index = geo.index,
          source = geo.userData.sourceTriangles, vertices = new Set(), bins = new Array(24),
          matrix = new Three.Matrix3(), rhs = new Three.Vector3(), sums = new Float64Array(9);
        for (let triangle = 0; triangle < source.length; triangle++) if (ringTriangles.has(source[triangle]))
          for (let corner = 0; corner < 3; corner++) vertices.add(index.getX(triangle * 3 + corner));
        for (const i of vertices) {
          const x = p.getX(i) / radius, y = p.getY(i) / radius, r2 = x * x + y * y,
            angle = (Math.round(Math.atan2(y, x) / (Math.PI * 2) * 24) + 24) % 24;
          if (!bins[angle] || r2 > bins[angle].r2) bins[angle] = { x, y, r2 };
        }
        // The shipped tyre has 24 source tread stations. All must be present;
        // uncertain new geometry must not receive a guessed shape correction.
        if (bins.some(point => !point) || bins.filter(Boolean).length !== 24) return null;
        for (const { x, y } of bins) {
          const v = [x * x, 2 * x * y, y * y];
          rhs.x += v[0]; rhs.y += v[1]; rhs.z += v[2];
          for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) sums[row * 3 + column] += v[row] * v[column];
        }
        matrix.set(...sums);
        if (Math.abs(matrix.determinant()) < 1e-8) return null;
        rhs.applyMatrix3(matrix.invert());
        const a = rhs.x, b = rhs.y, c = rhs.z, det = a * c - b * b;
        if (!(a > 0 && c > 0 && det > 0)) return null;
        const root = Math.sqrt(det), divisor = Math.sqrt(a + c + 2 * root),
          xx = (a + root) / divisor, xy = b / divisor, yy = (c + root) / divisor,
          spread = Math.hypot(a - c, 2 * b),
          stretch = Math.sqrt((a + c + spread) * .5), shrink = Math.sqrt((a + c - spread) * .5),
          residual = Math.max(...bins.map(({ x, y }) => Math.abs(Math.sqrt(a * x * x + 2 * b * x * y + c * y * y) - 1)));
        // This is a measured mild ellipse correction, never a replacement wheel.
        // Bound both principal stretches to 5% and require a clean source fit.
        if (!Number.isFinite(stretch) || !Number.isFinite(shrink) || stretch > 1.05 || shrink < .95 || residual > .001) return null;
        const inverse = 1 / (xx * yy - xy * xy);
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i);
          p.setXY(i, xx * x + xy * y, xy * x + yy * y);
          if (n) {
            const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i),
              tx = (yy * nx - xy * ny) * inverse, ty = (xx * ny - xy * nx) * inverse,
              length = Math.hypot(tx, ty, nz) || 1;
            // Preserve authored split normals through the affine inverse transpose;
            // recomputing smooth normals would erase the tyre/rim surface breaks.
            n.setXYZ(i, tx / length, ty / length, nz / length);
          }
        }
        geo.computeBoundingBox(); geo.computeBoundingSphere();
        const before = bins.map(point => Math.sqrt(point.r2) * radius),
          after = bins.map(({ x, y }) => Math.hypot(xx * x + xy * y, xy * x + yy * y) * radius);
        return { transform: [xx, xy, xy, yy], treadStations: bins.length, fitResidual: residual * radius,
          radialBefore: [Math.min(...before), Math.max(...before)], radialAfter: [Math.min(...after), Math.max(...after)] };
      }
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
          body = subset(fixed, fallback.at),
          roundness = militaryWheelCircularize(wheel, radius, new Set(ring.triangles));
        // Both subsets own compact attribute buffers; the unuploaded input is no
        // longer drawn or shared by any kit, so it need not stay in the warm set.
        sharedGeometries.delete(geo);
        geo.dispose();
        return { wheel, fixed: body, at: fallback.at.map((v, axis) => v + center[axis]), r: radius, calibrated: true,
          sourceTriangles: index.length / 3, rollingTriangles: moving.length, fixedTriangles: fixed.length,
          ringTriangles: ring.triangles.length, sourceCenter: center, components: pieces.size, roundness };
      }
