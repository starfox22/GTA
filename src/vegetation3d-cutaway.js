      // Vegetation 3D foliage cutaway: the tree material's see-through uniforms, set once a frame from
      // foliageCutawayPlan() (foliage-cutaway.js) and eased, and the console report of what they do (foliageHoleReport).
      const foliageHoleCamera = { rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, bx: 0, by: 0, bz: 1 },
        foliageHoleCentre = new Three.Vector3(),
        foliageHoleAim = { x: 0, y: 0 },
        // The hole as drawn: its open box (view units) and strength, eased towards the plan.
        foliageHoleNow = { x: 0, y: 0, strength: 0 };
      // How fast the hole opens, closes and follows a change of subject (per second, exponential: ~0.4 s), and the
      // steady part of the box's step (units a second) under which it simply follows.
      const FOLIAGE_HOLE_EASE = 7,
        FOLIAGE_HOLE_GROW = 60;
      // One step from `value` towards `aim`: the exponential share `ease`, at least `least`, never past it.
      function easeFoliageHole(value, aim, ease, least) {
        const gap = aim - value,
          step = Math.max(Math.abs(gap) * ease, least);
        return Math.abs(gap) <= step ? aim : value + Math.sign(gap) * step;
      }
      // The camera's right, up and back axes in world space (its matrix's columns).
      function readFoliageHoleCamera() {
        const e = camera.matrixWorld.elements,
          v = foliageHoleCamera;
        v.rx = e[0];
        v.ry = e[1];
        v.rz = e[2];
        v.ux = e[4];
        v.uy = e[5];
        v.uz = e[6];
        v.bx = e[8];
        v.by = e[9];
        v.bz = e[10];
        return v;
      }
      // Once a frame, after the camera is placed (render3d-frame.js): a few numbers, no per-tree work.
      function updateFoliageCutaway(deltaSeconds) {
        const plan = foliageCutawayPlan(),
          now = foliageHoleNow,
          hole = foliageHoleUniforms.foliageHole.value,
          aim = plan.on && characterCutaway ? 1 : 0,
          ease = 1 - Math.exp(-FOLIAGE_HOLE_EASE * deltaSeconds);
        now.strength = easeFoliageHole(now.strength, aim, ease, deltaSeconds * 1.5);
        if (now.strength <= 0) {
          // Closed: the next opening grows from nothing with the strength.
          now.x = now.y = 0;
          if (hole.w !== 0) hole.w = 0;
          return;
        }
        const v = readFoliageHoleCamera();
        foliageHoleBox(plan, v.rx, v.ry, v.rz, v.ux, v.uy, v.uz, foliageHoleAim);
        // Into or out of a vehicle the box grows or shrinks to the new subject instead of jumping; a turning car's
        // small changes are followed at once (the steady part of the step covers them).
        now.x = easeFoliageHole(now.x, foliageHoleAim.x, ease, deltaSeconds * FOLIAGE_HOLE_GROW);
        now.y = easeFoliageHole(now.y, foliageHoleAim.y, ease, deltaSeconds * FOLIAGE_HOLE_GROW);
        foliageHoleCentre.set(plan.x, plan.base + plan.height / 2, plan.y).applyMatrix4(camera.matrixWorldInverse);
        hole.set(foliageHoleCentre.x, foliageHoleCentre.y, foliageHoleCentre.z, now.strength);
        foliageHoleUniforms.foliageHoleShape.value.set(now.x, now.y, 1 / FOLIAGE_HOLE.fade, FOLIAGE_HOLE.margin);
        foliageHoleUniforms.foliageHoleFloor.value.set(plan.floor, camera.isPerspectiveCamera ? Math.max(1, -foliageHoleCentre.z) : 0);
      }
      /* DeadEndCity.foliageCutaway().renderer: the uniforms as set, and the crowns on the camera's line of sight to
         the subject's middle and top (each crown's ellipsoid, from every shown tree mesh within 60 m), with what the
         shader leaves of each where the line runs through it (foliageHoleCut: 1 = all gone). `uncovered`: every
         crossing fully dropped (or nothing crosses). Console only: the frame never walks the instances. */
      const foliageProbeMatrix = new Three.Matrix4(),
        foliageProbePoint = new Three.Vector3(),
        foliageProbeScale = new Three.Vector3(),
        foliageProbeTurn = new Three.Quaternion(),
        foliageProbeSphere = new Three.Sphere();
      function foliageHoleReport() {
        const plan = foliageCutawayPlan(),
          now = foliageHoleNow,
          u = foliageHoleUniforms,
          v = readFoliageHoleCamera(),
          axes = { right: [v.rx, v.ry, v.rz], up: [v.ux, v.uy, v.uz], back: [v.bx, v.by, v.bz] },
          box = { x: now.x, y: now.y },
          reach = 60 * UNITS_PER_METRE,
          crossings = [];
        for (const im of foliageMeshes) {
          let shown = im.visible && im.count > 0;
          for (let o = im.parent; shown && o; o = o.parent) shown = o.visible;
          const crown = shown && im.geometry.userData.foliage?.crown;
          if (!crown) continue;
          if (!im.boundingSphere) im.computeBoundingSphere();
          foliageProbeSphere.copy(im.boundingSphere).applyMatrix4(im.matrixWorld);
          if (Math.hypot(foliageProbeSphere.center.x - plan.x, foliageProbeSphere.center.z - plan.y) > reach + foliageProbeSphere.radius) continue;
          for (let i = 0; i < im.count; i++) {
            im.getMatrixAt(i, foliageProbeMatrix);
            foliageProbeMatrix.premultiply(im.matrixWorld);
            const e = foliageProbeMatrix.elements;
            if (Math.hypot(e[12] - plan.x, e[14] - plan.y) > reach) continue;
            foliageProbeMatrix.decompose(foliageProbePoint, foliageProbeTurn, foliageProbeScale);
            foliageProbePoint.set(0, crown.y, 0).applyMatrix4(foliageProbeMatrix);
            const rx = crown.r * foliageProbeScale.x,
              ry = crown.ry * foliageProbeScale.y;
            for (const from of [plan.height / 2, plan.height]) {
              // The line p(t) = start + t * back (towards the camera) against the crown's ellipsoid.
              const sx = (plan.x - foliageProbePoint.x) / rx,
                sy = (plan.base + from - foliageProbePoint.y) / ry,
                sz = (plan.y - foliageProbePoint.z) / rx,
                dx = v.bx / rx,
                dy = v.by / ry,
                dz = v.bz / rx,
                a = dx * dx + dy * dy + dz * dz,
                b = 2 * (sx * dx + sy * dy + sz * dz),
                c = sx * sx + sy * sy + sz * sz - 1,
                disc = b * b - 4 * a * c;
              if (disc <= 0) continue;
              const t0 = Math.max(0, (-b - Math.sqrt(disc)) / (2 * a)),
                t1 = (-b + Math.sqrt(disc)) / (2 * a);
              if (t1 <= 0) continue;
              // What is left where the line runs through the crown: the least dropped of five points along it.
              let least = 1;
              for (let k = 0; k <= 4; k++) {
                const t = t0 + ((t1 - t0) * k) / 4;
                least = Math.min(least, foliageHoleCut(plan, axes, box, now.strength, plan.x + t * v.bx, plan.y + t * v.bz, plan.base + from + t * v.by));
              }
              crossings.push({
                mesh: im.name,
                from: from === plan.height ? 'top' : 'middle',
                distanceM: +(t0 / UNITS_PER_METRE).toFixed(1),
                heightM: +((from + t0 * v.by) / UNITS_PER_METRE).toFixed(1),
                dropped: +least.toFixed(3),
              });
            }
          }
        }
        const r = (x) => +x.toFixed(2);
        return {
          strength: r(now.strength),
          camera: camera.isPerspectiveCamera ? 'perspective' : 'orthographic',
          uniforms: {
            centre: [r(u.foliageHole.value.x), r(u.foliageHole.value.y), r(u.foliageHole.value.z)],
            boxM: [r(u.foliageHoleShape.value.x / UNITS_PER_METRE), r(u.foliageHoleShape.value.y / UNITS_PER_METRE)],
            fadeM: r(1 / u.foliageHoleShape.value.z / UNITS_PER_METRE),
            marginM: r(u.foliageHoleShape.value.w / UNITS_PER_METRE),
            floor: r(u.foliageHoleFloor.value.x),
            perspectiveDepth: r(u.foliageHoleFloor.value.y),
          },
          crowns: crossings.length,
          uncovered: crossings.every((c) => c.dropped >= 0.99),
          crossings: crossings.sort((p, q) => p.distanceM - q.distanceM).slice(0, 10),
        };
      }
