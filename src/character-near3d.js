      // The near body set (chase view): smooth sculpted parts for the player and the few people nearest the camera,
      // with a woman's shape as a second shape of each part and every hair style, shoe and hand side in one mesh.
      /**
       * NEAR SET
       * The player and the few people nearest the chase camera (crowd3d-frame.js NEAR PEOPLE) are drawn from
       * these parts, one InstancedMesh each, with the near paint shader (character-near3d-shader.js). The
       * outlines are the close set's key rings (character-rig3d.js) sampled smoothly (a monotone cubic per
       * ring field, so nothing overshoots a key) with more rings and facets, then sculpted: a modelled face
       * and ears, a neck that slopes into the shoulders, chest, shoulder blades, glutes, knees and calves,
       * hands with a thumb and four fingers, shoes on a sole with a toe spring and a heel. A person crossing
       * the near range keeps their silhouette; only the facets and the detail change.
       *
       * Every near geometry carries, besides position, normal and crowdRegion:
       *   rigAltPos / rigAltNormal  a second shape: a woman's (head, torso, pelvis, thighs), chosen per
       *                             instance by the paint's female bit (32); the first shape elsewhere;
       *   rigVariant                -1 on every instance, else the variant a vertex belongs to: hair style
       *                             (NEAR_HAIR), footwear (NEAR_FOOT), hand side (0 left, 1 right). The other
       *                             variants' vertices fold to the joint, so one draw holds every style;
       *   rigKind                   the part (NEAR_KIND): what the shader paints and folds.
       * The paint's bits from 64 hold the variant and from 1024 a code (face, garment), rigNearBits.
       */
      const NEAR_KIND = { head: 0, hair: 1, torso: 2, pelvis: 3, upperArm: 4, forearm: 5, hand: 6, thigh: 7, shin: 8, foot: 9 };
      const NEAR_HAIR = ['hairShort', 'hairCrop', 'hairBuzz', 'hairLong', 'hairCurly', 'hairBun', 'hairPony'];
      const NEAR_FOOT = { shoe: 0, boot: 1, bare: 2 };
      /* Add the near bits to a paint (character-rig3d.js rigPaint): female shape, variant, code. */
      function rigNearBits(paint, female = false, variant = 0, code = 0) {
        paint[5] += (female ? 32 : 0) + 64 * variant + 1024 * code;
        return paint;
      }

      /* ---- Curves and lofts -------------------------------------------------------- */
      const NEAR_FIELDS = ['fx', 'bx', 'w', 'cx', 'cz', 'n'];
      const nearField = (r, f) => (f === 'bx' ? (r.bx ?? r.fx) : f === 'n' ? (r.n ?? 2) : (r[f] ?? 0));
      /* A smooth ring at any height through key rings (sorted along y either way): monotone cubic per field. */
      function nearCurve(keys) {
        const list = keys[0].y > keys[keys.length - 1].y ? [...keys].reverse() : keys,
          n = list.length,
          slopes = {};
        for (const f of NEAR_FIELDS) {
          const d = [],
            m = new Array(n).fill(0);
          for (let i = 0; i < n - 1; i++) d.push((nearField(list[i + 1], f) - nearField(list[i], f)) / Math.max(1e-6, list[i + 1].y - list[i].y));
          for (let i = 0; i < n; i++) m[i] = i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
          for (let i = 0; i < n - 1; i++) {
            if (Math.abs(d[i]) < 1e-9) {
              m[i] = m[i + 1] = 0;
              continue;
            }
            const a = m[i] / d[i],
              b = m[i + 1] / d[i],
              s = a * a + b * b;
            if (s > 9) {
              const t = 3 / Math.sqrt(s);
              m[i] = t * a * d[i];
              m[i + 1] = t * b * d[i];
            }
          }
          slopes[f] = m;
        }
        return (y) => {
          let i = 0;
          while (i < n - 2 && list[i + 1].y < y) i++;
          const a = list[i],
            b = list[i + 1],
            h = b.y - a.y,
            t = clamp((y - a.y) / (h || 1), 0, 1),
            t2 = t * t,
            t3 = t2 * t,
            ring = { y };
          for (const f of NEAR_FIELDS)
            ring[f] = (2 * t3 - 3 * t2 + 1) * nearField(a, f) + (t3 - 2 * t2 + t) * h * slopes[f][i] + (-2 * t3 + 3 * t2) * nearField(b, f) + (t3 - t2) * h * slopes[f][i + 1];
          return ring;
        };
      }
      /* Heights from a to b about `step` apart, ends included; joined spans drop the repeated ends. */
      function nearSpan(a, b, step) {
        const n = Math.max(1, Math.round(Math.abs(b - a) / step)),
          out = [];
        for (let i = 0; i <= n; i++) out.push(a + ((b - a) * i) / n);
        return out;
      }
      const nearJoin = (...spans) => spans.flat().filter((y, i, all) => i === 0 || Math.abs(y - all[i - 1]) > 1e-6);
      /* Rings through `keys` at the heights `ys`; the end rings keep the keys' domes. */
      function nearRings(keys, ys) {
        const at = nearCurve(keys),
          rings = ys.map(at),
          first = keys[0].y > keys[keys.length - 1].y === ys[0] > ys[ys.length - 1] ? keys[0] : keys[keys.length - 1],
          last = first === keys[0] ? keys[keys.length - 1] : keys[0];
        rings[0].dome = first.dome || 0;
        rings[rings.length - 1].dome = last.dome || 0;
        return rings;
      }
      /**
       * A loft through rings (as rigLoft) facing out whichever way the rings run, `segments` round with the
       * angles bunched towards the front by `warp` (0 even; 0.5 twice as dense at the front, where a face,
       * a fly or a placket wants the facets). `region(i, th, y, x, z)` paints each vertex.
       */
      function nearLoft(rings, segments, { warp = 0, region = null, capBottom = true, capTop = true } = {}) {
        const positions = [],
          regions = [],
          index = [],
          n = segments,
          down = rings[rings.length - 1].y < rings[0].y;
        for (let i = 0; i < rings.length; i++) {
          const r = rings[i],
            e = 2 / (r.n || 2);
          for (let k = 0; k < n; k++) {
            const a = (k / n) * TAU - Math.PI,
              th = a - warp * Math.sin(a),
              c = Math.cos(th),
              s = Math.sin(th),
              pc = Math.sign(c) * Math.pow(Math.abs(c), e),
              ps = Math.sign(s) * Math.pow(Math.abs(s), e),
              x = (r.cx || 0) + pc * (c >= 0 ? r.fx : (r.bx ?? r.fx)),
              z = (r.cz || 0) + ps * r.w;
            positions.push(x, r.y, z);
            regions.push(region ? region(i, th, r.y, x, z) : 0);
          }
        }
        for (let i = 0; i < rings.length - 1; i++)
          for (let k = 0; k < n; k++) {
            const a = i * n + k,
              b = i * n + ((k + 1) % n);
            if (down) index.push(a, b, a + n, b, b + n, a + n);
            else index.push(a, a + n, b, b, a + n, b + n);
          }
        const cap = (i, top) => {
          const r = rings[i],
            centre = positions.length / 3,
            up = top !== down;
          positions.push(r.cx || 0, r.y + (up ? 1 : -1) * (r.dome || 0), r.cz || 0);
          regions.push(region ? region(i, 0, r.y, r.cx || 0, r.cz || 0) : 0);
          for (let k = 0; k < n; k++) {
            const a = i * n + k,
              b = i * n + ((k + 1) % n);
            if (up) index.push(centre, b, a);
            else index.push(centre, a, b);
          }
        };
        if (capBottom) cap(0, false);
        if (capTop) cap(rings.length - 1, true);
        const g = new Three.BufferGeometry();
        g.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        g.setAttribute('crowdRegion', new Three.Float32BufferAttribute(regions, 1));
        g.setIndex(index);
        g.computeVertexNormals();
        return g;
      }
      /* Push every vertex along its normal by fn(x, y, z, nx, ny, nz) (positive outwards), then re-shade. */
      function nearSculpt(g, fn) {
        const p = g.attributes.position,
          nm = g.attributes.normal;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i),
            y = p.getY(i),
            z = p.getZ(i),
            nx = nm.getX(i),
            ny = nm.getY(i),
            nz = nm.getZ(i),
            d = fn(x, y, z, nx, ny, nz);
          if (d) p.setXYZ(i, x + nx * d, y + ny * d, z + nz * d);
        }
        g.computeVertexNormals();
        return g;
      }
      // A soft bump: 1 at the centre, by the distances over the radii.
      const nearBump = (dx, rx, dy, ry, dz = 0, rz = 1) => Math.exp(-(dx * dx) / (rx * rx) - (dy * dy) / (ry * ry) - (dz * dz) / (rz * rz));
      /* Mirror a geometry across z (left from right), keeping it facing out. */
      function nearMirror(g) {
        const m = g.clone();
        m.scale(1, 1, -1);
        const idx = m.index.array;
        for (let i = 0; i < idx.length; i += 3) {
          const t = idx[i + 1];
          idx[i + 1] = idx[i + 2];
          idx[i + 2] = t;
        }
        m.computeVertexNormals();
        return m;
      }
      /* Give a near geometry its attributes: the second shape (from `alt`, same topology), variant, kind. */
      function nearPack(g, kind, alt = null, variant = -1) {
        if (g.attributes.uv) g.deleteAttribute('uv');
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!g.attributes.crowdRegion) g.setAttribute('crowdRegion', new Three.Float32BufferAttribute(new Float32Array(g.attributes.position.count), 1));
        const count = g.attributes.position.count;
        if (alt && alt.attributes.position.count !== count) throw new Error('near shapes differ: ' + count + ' vs ' + alt.attributes.position.count);
        g.setAttribute('rigAltPos', new Three.BufferAttribute(Float32Array.from((alt || g).attributes.position.array), 3));
        g.setAttribute('rigAltNormal', new Three.BufferAttribute(Float32Array.from((alt || g).attributes.normal.array), 3));
        g.setAttribute('rigVariant', new Three.BufferAttribute(new Float32Array(count).fill(variant), 1));
        g.setAttribute('rigKind', new Three.BufferAttribute(new Float32Array(count).fill(kind), 1));
        return g;
      }
      const NEAR_ATTRIBUTES = [
        ['position', 3],
        ['normal', 3],
        ['crowdRegion', 1],
        ['rigAltPos', 3],
        ['rigAltNormal', 3],
        ['rigVariant', 1],
        ['rigKind', 1],
      ];
      /* Merge packed near geometries (indexed or not) into one indexed geometry. */
      function nearMerge(list) {
        let vertices = 0,
          indices = 0;
        for (const g of list) {
          vertices += g.attributes.position.count;
          indices += g.index ? g.index.count : g.attributes.position.count;
        }
        const arrays = NEAR_ATTRIBUTES.map(([, size]) => new Float32Array(vertices * size)),
          index = new Uint32Array(indices);
        let v = 0,
          ix = 0;
        for (const g of list) {
          const n = g.attributes.position.count;
          NEAR_ATTRIBUTES.forEach(([name, size], a) => arrays[a].set(g.attributes[name].array, v * size));
          if (g.index) for (let k = 0; k < g.index.count; k++) index[ix++] = g.index.array[k] + v;
          else for (let k = 0; k < n; k++) index[ix++] = k + v;
          v += n;
        }
        const merged = new Three.BufferGeometry();
        NEAR_ATTRIBUTES.forEach(([name, size], a) => merged.setAttribute(name, new Three.BufferAttribute(arrays[a], size)));
        merged.setIndex(new Three.BufferAttribute(index, 1));
        merged.computeBoundingSphere();
        return merged;
      }
      /* A tube along points (parallel-transported rings), radius per point, the far end domed. */
      function nearTube(points, radii, segments = 7, region = 0) {
        const positions = [],
          index = [],
          up = new Three.Vector3(),
          side = new Three.Vector3(),
          dir = new Three.Vector3(),
          prev = new Three.Vector3(),
          ref = new Three.Vector3(0, 0, 1);
        for (let i = 0; i < points.length; i++) {
          const a = points[Math.max(0, i - 1)],
            b = points[Math.min(points.length - 1, i + 1)];
          dir.subVectors(b, a).normalize();
          if (i === 0) {
            if (Math.abs(dir.dot(ref)) > 0.9) ref.set(1, 0, 0);
            side.crossVectors(dir, ref).normalize();
          } else side.sub(dir.clone().multiplyScalar(side.dot(dir))).normalize();
          up.crossVectors(side, dir).normalize();
          for (let k = 0; k < segments; k++) {
            const th = (k / segments) * TAU,
              r = radii[i];
            positions.push(points[i].x + (Math.cos(th) * side.x + Math.sin(th) * up.x) * r, points[i].y + (Math.cos(th) * side.y + Math.sin(th) * up.y) * r, points[i].z + (Math.cos(th) * side.z + Math.sin(th) * up.z) * r);
          }
          prev.copy(dir);
        }
        for (let i = 0; i < points.length - 1; i++)
          for (let k = 0; k < segments; k++) {
            const a = i * segments + k,
              b = i * segments + ((k + 1) % segments);
            index.push(a, b, a + segments, b, b + segments, a + segments);
          }
        // The tip: a small dome.
        const tip = points[points.length - 1],
          centre = positions.length / 3,
          last = (points.length - 1) * segments;
        positions.push(tip.x + prev.x * radii[radii.length - 1] * 0.8, tip.y + prev.y * radii[radii.length - 1] * 0.8, tip.z + prev.z * radii[radii.length - 1] * 0.8);
        for (let k = 0; k < segments; k++) index.push(centre, last + k, last + ((k + 1) % segments));
        const g = new Three.BufferGeometry();
        g.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        g.setAttribute('crowdRegion', new Three.Float32BufferAttribute(new Float32Array(positions.length / 3).fill(region), 1));
        g.setIndex(index);
        g.computeVertexNormals();
        // Wound so its outside faces out whichever way the frame turned.
        nearFaceOut(g, points);
        return g;
      }
      /* Flip a tube's winding if its normals point at its own axis (the frame's handedness decides it). */
      function nearFaceOut(g, points) {
        const p = g.attributes.position,
          nm = g.attributes.normal,
          c = points[Math.floor(points.length / 2)];
        let score = 0;
        for (let i = 0; i < p.count; i++) score += (p.getX(i) - c.x) * nm.getX(i) + (p.getY(i) - c.y) * nm.getY(i) + (p.getZ(i) - c.z) * nm.getZ(i);
        if (score >= 0) return g;
        const idx = g.index.array;
        for (let i = 0; i < idx.length; i += 3) {
          const t = idx[i + 1];
          idx[i + 1] = idx[i + 2];
          idx[i + 2] = t;
        }
        g.computeVertexNormals();
        return g;
      }

      /* ---- Body ---------------------------------------------------------------------- */
      // Torso heights: denser round the shoulders and neck, where the outline turns fastest.
      const NEAR_TORSO_YS = nearJoin(nearSpan(-0.3, 2.4, 0.135), nearSpan(2.4, 3.4, 0.07));
      /* Torso: the close keys with the neck sloping into the shoulders, then chest, blades, spine and collarbones. */
      function nearTorsoShape(female) {
        const keys = rigTorsoKeys(female).map((r) => ({ ...r })),
          top = keys.filter((r) => r.y >= 3.0);
        // The trapezius: a ring between the shoulder line and the neck so the slope runs smoothly.
        if (top.length) keys.splice(keys.indexOf(top[0]) + 1, 0, { y: 3.14, fx: female ? 0.62 : 0.69, bx: female ? 0.7 : 0.78, w: female ? 1.32 : 1.55, n: 2.25 });
        keys.sort((a, b) => a.y - b.y);
        const g = nearLoft(nearRings(keys, NEAR_TORSO_YS), 28, { warp: 0.3, region: (i, th, y, x, z) => torsoRegion(i, th, y, x, z) });
        return nearSculpt(g, (x, y, z) => {
          const az = Math.abs(z),
            front = x > 0 ? 1 : 0,
            back = x < 0 ? 1 : 0;
          let d = 0;
          if (female) {
            // Bust: two forms with a soft cleft between, the band above and below eased.
            d += front * (0.1 * nearBump(az - 0.5, 0.32, y - 1.62, 0.3) - 0.07 * nearBump(z, 0.16, y - 1.62, 0.32));
            d += back * 0.03 * nearBump(az - 0.62, 0.3, y - 2.3, 0.35);
          } else {
            // Pectorals and their lower edge, the sternum line between.
            d += front * (0.05 * nearBump(az - 0.55, 0.36, y - 2.42, 0.28) - 0.025 * nearBump(z, 0.12, y - 2.3, 0.6));
            d += back * 0.045 * nearBump(az - 0.7, 0.32, y - 2.35, 0.4);
          }
          // Collarbones, the spine's groove, the waist's soft sides.
          d += front * 0.025 * nearBump(y - 3.05 + az * 0.06, 0.06, az - 0.75, 0.42);
          d -= back * 0.03 * nearBump(z, 0.12, y - 1.6, 1.1);
          d -= 0.025 * nearBump(az - 1.3, 0.25, y - 1.0, 0.45);
          return d;
        });
      }
      function nearTorsoGeometry() {
        return nearPack(nearTorsoShape(false), NEAR_KIND.torso, nearTorsoShape(true));
      }
      /* Pelvis: the close rings, with glutes and their cleft behind; a woman's fuller. */
      function nearPelvisShape(female) {
        const ys = nearJoin(nearSpan(-0.88, -0.2, 0.1), nearSpan(-0.2, 1.22, 0.12));
        const g = nearLoft(nearRings(rigPelvisRings(female), ys), 28, {
          warp: 0.25,
          region: (i, th, y) => (y >= 0.66 && y <= 1.03 ? (Math.abs(th) < 14 * RIG_DEG ? 2 : 1) : 0),
        });
        return nearSculpt(g, (x, y, z) => {
          const az = Math.abs(z);
          let d = 0;
          if (x < 0) d += (female ? 0.12 : 0.08) * nearBump(az - 0.55, 0.38, y + 0.15, 0.42) - 0.05 * nearBump(z, 0.07, y + 0.25, 0.4);
          // The crotch narrows between the thighs.
          d -= 0.03 * nearBump(z, 0.3, y + 0.8, 0.15);
          return d;
        });
      }
      function nearPelvisGeometry() {
        return nearPack(nearPelvisShape(false), NEAR_KIND.pelvis, nearPelvisShape(true));
      }
      /* Upper arm: deltoid cap, biceps in front, triceps behind, the elbow's point. */
      function nearUpperArmGeometry() {
        const g = nearLoft(nearRings(RIG_UPPER_ARM_RINGS, nearSpan(0.3, -2.8, 0.16)), 16, { region: (i, th, y) => (y >= -1.12 ? 0 : 1) });
        nearSculpt(g, (x, y, z) => 0.035 * nearBump(y + 0.25, 0.4, 0, 1) + (x > 0 ? 0.035 : 0) * nearBump(y + 1.45, 0.45, z, 0.3) + (x < 0 ? 0.03 * nearBump(y + 1.1, 0.5, z, 0.35) + 0.035 * nearBump(y + 2.7, 0.12, z, 0.12) : 0));
        return nearPack(g, NEAR_KIND.upperArm);
      }
      /* Forearm: the muscle mass below the elbow tapering to a flat wrist. */
      function nearForearmGeometry() {
        const g = nearLoft(nearRings(RIG_FOREARM_RINGS, nearSpan(0.28, -2.12, 0.15)), 14, { region: (i, th, y) => (y <= -1.62 ? 1 : 0) });
        nearSculpt(g, (x, y, z) => 0.03 * nearBump(y + 0.45, 0.35, z, 0.35) - 0.025 * nearBump(y + 1.95, 0.2, x, 0.12));
        return nearPack(g, NEAR_KIND.forearm);
      }
      /* Thigh: quadriceps in front, the kneecap, hamstrings behind; a woman's fuller at the hip. */
      function nearThighShape(female) {
        const g = nearLoft(nearRings(rigThighRings(female), nearSpan(0.55, -3.55, 0.17)), 18, { region: (i, th, y) => (y >= -1.38 ? 0 : 1) });
        return nearSculpt(g, (x, y, z) => {
          let d = 0;
          if (x > 0) d += (female ? 0.02 : 0.04) * nearBump(y + 1.6, 0.8, z, 0.35) + 0.04 * nearBump(y + 3.3, 0.16, z, 0.16);
          else d += 0.025 * nearBump(y + 1.2, 0.9, z, 0.4);
          if (female) d += 0.035 * nearBump(y - 0.1, 0.5, 0, 1);
          return d;
        });
      }
      function nearThighGeometry() {
        return nearPack(nearThighShape(false), NEAR_KIND.thigh, nearThighShape(true));
      }
      /* Shin: the calf's two heads behind, the shinbone's edge, the ankle bones. */
      function nearShinGeometry() {
        const g = nearLoft(nearRings(RIG_SHIN_RINGS, nearSpan(0.32, -3.62, 0.16)), 16, { region: (i, th, y) => (y >= -0.24 ? 2 : y <= -2.83 ? 1 : 0) });
        nearSculpt(g, (x, y, z) => (x < 0 ? 0.03 * nearBump(y + 1.15, 0.45, Math.abs(z) - 0.18, 0.2) : 0.012 * nearBump(z, 0.08, y + 1.5, 1.2)) + 0.03 * nearBump(y + 3.36, 0.1, Math.abs(z) - 0.22, 0.08));
        return nearPack(g, NEAR_KIND.shin);
      }

      /* ---- Hands --------------------------------------------------------------------- */
      /**
       * HANDS
       * From the wrist, hanging down (-y), the thumb forward (+x). The right hand's palm faces -z (towards
       * the body), its fingers curling that way; the left hand is its mirror. Both live in one mesh
       * (variants 0 left, 1 right); the shader picks each instance's side by its order (drawCrowdPerson
       * packs the hands left, right, person by person).
       */
      function nearRightHand() {
        const palm = nearLoft(
          nearRings(
            [
              { y: 0.08, fx: 0.17, bx: 0.17, w: 0.13 },
              { y: -0.12, fx: 0.25, bx: 0.23, w: 0.145 },
              { y: -0.4, fx: 0.3, bx: 0.27, w: 0.15 },
              { y: -0.66, fx: 0.3, bx: 0.26, w: 0.135 },
              { y: -0.78, fx: 0.27, bx: 0.24, w: 0.11, dome: 0.02 },
            ],
            nearSpan(0.08, -0.78, 0.11),
          ),
          12,
        );
        // A cupped palm, the knuckles proud on the back, the heel of the thumb.
        nearSculpt(palm, (x, y, z) => (z < 0 ? -0.03 * nearBump(y + 0.45, 0.22, x, 0.2) + 0.04 * nearBump(y + 0.2, 0.18, x - 0.18, 0.12) : 0.015 * nearBump(y + 0.74, 0.06, 0, 1)));
        const fingers = [
          // x at the knuckle, length, radius, curl per joint (rad, towards -z), spread (rad, along x)
          [0.19, 0.6, 0.066, 0.18, 0.06],
          [0.065, 0.68, 0.068, 0.22, 0.0],
          [-0.06, 0.63, 0.064, 0.26, -0.04],
          [-0.17, 0.5, 0.056, 0.3, -0.1],
        ].map(([x0, length, r, curl, spread]) => {
          const points = [],
            radii = [],
            parts = [0.46, 0.31, 0.23],
            p = new Three.Vector3(x0, -0.7, -0.01),
            dir = new Three.Vector3(Math.sin(spread), -Math.cos(spread), 0);
          points.push(p.clone());
          radii.push(r);
          let angle = 0;
          for (let j = 0; j < 3; j++) {
            angle += curl * (j === 0 ? 0.6 : 0.9);
            const d = new Three.Vector3(dir.x, dir.y * Math.cos(angle), -Math.sin(angle)).normalize(),
              steps = 2;
            for (let s = 1; s <= steps; s++) {
              p.addScaledVector(d, (length * parts[j]) / steps);
              points.push(p.clone());
              radii.push(r * (1 - 0.22 * ((j * steps + s) / (3 * steps))) * (s === steps && j < 2 ? 1.04 : 1));
            }
          }
          return nearTube(points, radii, 6);
        });
        // The thumb: forward and down from the heel of the hand, curling across the palm.
        const thumbPoints = [],
          thumbRadii = [],
          tp = new Three.Vector3(0.2, -0.14, -0.06);
        let td = new Three.Vector3(0.62, -0.7, -0.35).normalize();
        thumbPoints.push(tp.clone());
        thumbRadii.push(0.095);
        for (let j = 0; j < 3; j++) {
          td = new Three.Vector3(td.x * 0.9 - 0.05, td.y, td.z - 0.12).normalize();
          for (let s = 1; s <= 2; s++) {
            tp.addScaledVector(td, [0.24, 0.2, 0.15][j] / 2);
            thumbPoints.push(tp.clone());
            thumbRadii.push(0.088 - 0.009 * (j * 2 + s));
          }
        }
        const thumb = nearTube(thumbPoints, thumbRadii, 6);
        return [palm, ...fingers, thumb].map((g) => nearPack(g, NEAR_KIND.hand, null, 1));
      }
      function nearHandGeometry() {
        const right = nearRightHand(),
          left = right.map((g) => {
            const m = nearMirror(g);
            m.deleteAttribute('rigAltPos');
            m.deleteAttribute('rigAltNormal');
            return nearPack(m, NEAR_KIND.hand, null, 0);
          });
        return nearMerge([...left, ...right]);
      }

      /* ---- Feet ---------------------------------------------------------------------- */
      /**
       * FEET
       * From the ankle joint, the sole at -RIG.ankle, toes towards +x. Lofted along the foot (loft y is
       * forward, loft x down) and turned like rigShoeGeometry. Stations: [x along the foot, bottom, top,
       * half width, squareness], in foot space. Regions: 0 upper, 1 sole, 2 collar.
       */
      function nearFootLoft(stations, segments, region) {
        const rings = stations.map(([x, bottom, top, w, n = 2.4]) => ({ y: x, cx: -(bottom + top) / 2, fx: (top - bottom) / 2, bx: (top - bottom) / 2, w, n }));
        const keyed = nearRings(rings, nearJoin(...stations.slice(1).map((s, i) => nearSpan(stations[i][0], s[0], 0.15))));
        keyed[0].dome = 0.04;
        keyed[keyed.length - 1].dome = 0.04;
        const g = nearLoft(keyed, segments, { region: (i, th, y, x) => region(y, -x) });
        g.rotateZ(-Math.PI / 2);
        g.computeVertexNormals();
        return g;
      }
      function nearShoe(boot) {
        const shaft = boot ? 1.25 : 0.42,
          upper = nearFootLoft(
            [
              [-0.6, -0.44, shaft - 0.25, 0.2],
              [-0.52, -0.45, shaft, 0.28],
              [-0.3, -0.45, shaft + 0.04, 0.33],
              [-0.05, -0.45, boot ? shaft : 0.36, 0.35],
              [0.25, -0.45, boot ? 0.2 : 0.06, 0.37],
              [0.65, -0.45, -0.1, 0.39],
              [1.0, -0.45, -0.2, 0.4],
              [1.3, -0.45, -0.25, 0.37],
              [1.5, -0.43, -0.3, 0.3],
              [1.62, -0.41, -0.33, 0.17],
            ],
            14,
            (x, y) => (y > (boot ? 0.95 : 0.12) && x < 0.1 ? 2 : 0),
          ),
          heel = boot ? -0.36 : -0.4,
          sole = nearFootLoft(
            [
              [-0.64, -0.55, heel, 0.22, 4],
              [-0.55, -0.55, heel, 0.3, 4],
              [-0.25, -0.55, heel, 0.33, 4],
              [0.05, -0.55, -0.44, 0.31, 4],
              [0.45, -0.55, -0.44, 0.36, 4],
              [1.0, -0.55, -0.43, 0.42, 4],
              [1.35, -0.53, -0.41, 0.39, 4],
              [1.55, -0.49, -0.38, 0.31, 4],
              [1.67, -0.44, -0.36, 0.17, 4],
            ],
            12,
            () => 1,
          );
        return [upper, sole];
      }
      /* A bare foot: heel, arch, the ball and five toes. */
      function nearBareFoot() {
        const foot = nearFootLoft(
          [
            [-0.55, -0.53, -0.25, 0.2],
            [-0.45, -0.55, 0.05, 0.27],
            [-0.2, -0.55, 0.12, 0.28],
            [0.2, -0.5, -0.08, 0.29],
            [0.7, -0.55, -0.25, 0.34],
            [1.05, -0.55, -0.33, 0.36],
            [1.2, -0.55, -0.37, 0.33],
          ],
          14,
          () => 0,
        );
        const toes = [
          [0.27, 0.32, 0.085],
          [0.12, 0.27, 0.065],
          [-0.02, 0.24, 0.06],
          [-0.15, 0.21, 0.056],
          [-0.27, 0.17, 0.05],
        ].map(([z, length, r]) => {
          const points = [new Three.Vector3(1.08, -0.47, z), new Three.Vector3(1.08 + length * 0.55, -0.47, z * 1.04), new Three.Vector3(1.08 + length, -0.5, z * 1.06)];
          return nearTube(points, [r, r * 0.95, r * 0.85], 6);
        });
        return [foot, ...toes];
      }
      function nearFootGeometry() {
        return nearMerge([
          ...nearShoe(false).map((g) => nearPack(g, NEAR_KIND.foot, null, NEAR_FOOT.shoe)),
          ...nearShoe(true).map((g) => nearPack(g, NEAR_KIND.foot, null, NEAR_FOOT.boot)),
          ...nearBareFoot().map((g) => nearPack(g, NEAR_KIND.foot, null, NEAR_FOOT.bare)),
        ]);
      }
      // @include src/character-near3d-head.js
      // @include src/character-near3d-shader.js
