    // Floor-plan math shared by the game (roof decks, skyline-lift.js) and the renderer (lofted towers, skyline3d-kit.js).
    /* A plan is a closed outline [{x, z, c}] about (0, 0) in tower-local units
       (x east, z south); a section scales, twists and offsets it at a height.
       The game measures a tower's roof with the same numbers the renderer lofts
       its walls from, so a roof deck is walked exactly where it is drawn. */
    // A plan is a closed outline [{x, z, c}] about (0, 0); c marks a hard corner.
    function orientPlan(points) {
      let area = 0;
      for (let i = 0; i < points.length; i++) {
        const p = points[i],
          q = points[(i + 1) % points.length];
        area += p.x * q.z - q.x * p.z;
      }
      if (area < 0) points.reverse();
      return points;
    }
    function planSuper(w, d, n, segments = 44) {
      const points = [];
      for (let k = 0; k < segments; k++) {
        const a = (k / segments) * TAU,
          c = Math.cos(a),
          s = Math.sin(a);
        points.push({
          x: (w / 2) * Math.sign(c) * Math.pow(Math.abs(c), 2 / n),
          z: (d / 2) * Math.sign(s) * Math.pow(Math.abs(s), 2 / n),
          c: false,
        });
      }
      return orientPlan(points);
    }
    // Triangle with convex sides and sharp prows (the sail towers).
    function planSailTriangle(w, d, bulge = 0.09, perEdge = 7) {
      const v = [
          [-0.5, -0.46],
          [0.5, -0.46],
          [0.04, 0.54],
        ],
        points = [];
      for (let i = 0; i < 3; i++) {
        const a = v[i],
          b = v[(i + 1) % 3],
          mx = (a[0] + b[0]) / 2,
          mz = (a[1] + b[1]) / 2,
          // Push the edge's control point away from the centroid.
          len = Math.hypot(mx - 0.013, mz + 0.127) || 1,
          cx = mx + ((mx - 0.013) / len) * bulge,
          cz = mz + ((mz + 0.127) / len) * bulge;
        for (let k = 0; k < perEdge; k++) {
          const t = k / perEdge,
            x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0],
            z = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cz + t * t * b[1];
          points.push({ x: x * w, z: z * d, c: k === 0 });
        }
      }
      return orientPlan(points);
    }
    const scalePlan = (plan, f) => plan.map((p) => ({ x: p.x * f, z: p.z * (f.z ?? f), c: p.c }));
    // A section: {y, s, sx, sz, r (radians), ox, oz}. Returns the local point (x, z).
    function sectionPoint(p, sec, out) {
      const sx = sec.sx ?? sec.s ?? 1,
        sz = sec.sz ?? sec.s ?? 1,
        r = sec.r || 0,
        x = p.x * sx,
        z = p.z * sz,
        c = Math.cos(r),
        s = Math.sin(r);
      out.x = (sec.ox || 0) + x * c - z * s;
      out.z = (sec.oz || 0) + x * s + z * c;
      return out;
    }
    // Largest uniform scale of `plan` that keeps every section inside +-(hw, hd).
    function fitScale(plan, sections, hw, hd) {
      let f = Infinity;
      const q = { x: 0, z: 0 };
      for (const sec of sections)
        for (const p of plan) {
          const ox = sec.ox || 0,
            oz = sec.oz || 0;
          sectionPoint(p, { ...sec, ox: 0, oz: 0 }, q);
          if (q.x > 1e-6) f = Math.min(f, (hw - ox) / q.x);
          if (q.x < -1e-6) f = Math.min(f, (hw + ox) / -q.x);
          if (q.z > 1e-6) f = Math.min(f, (hd - oz) / q.z);
          if (q.z < -1e-6) f = Math.min(f, (hd + oz) / -q.z);
        }
      return f;
    }
