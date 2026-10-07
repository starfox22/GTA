      // Damage 3D vehicle marks: bullet holes, glass stars and scrapes pinned to the triangle of the body part they hit
      // (they bend, swing and tear off with it), sized for the view (drawVehicleMarks); vehicleDamageShape report.
      /*
       * VEHICLE MARKS
       * A mark (damage.marks: vehicle space x, y, z, the round's heading dx, dy, size; damage-vehicles.js) is found on
       * the model once: a ray along the round's line from outside the body, in design units (render3d.js DESIGN SIZE),
       * stops at the first surface the mark may sit on before the body's middle: a hole or a scrape on paint, bumpers,
       * lamps or outer trim (never the glass, the cabin seen through it or the inside of the far side), a star only on
       * its own pane. A ray that meets nothing tries lower (holes) or the pane's middle (stars); a mark that still meets
       * nothing is not drawn: no mark is ever left in the air.
       * The anchor keeps the triangle and the point's barycentric weights, so after a crumple, a hinge swing or a
       * pristine-merge split (m.shapeVersion) it is re-read where that triangle now is: the hole moves with the panel,
       * and goes with a part that is hidden (a torn-off hood or bumper). The decal is posed on the triangle's own
       * (interpolated) normal.
       * Size: the street camera draws marks large enough to read from above (unchanged); in the chase view a hole is a
       * few centimetres across (MARK_SIZES), so the flat decal stays on a curved panel at 3-4 m.
       */
      const MARK_TILES = { hole: DECAL.hole, star: DECAL.star, scrape: DECAL.scrape },
        // Decal width and height per unit of a mark's `size`, street view then chase view.
        MARK_SIZES = {
          hole: [4.2, 4.2, 0.85, 0.85],
          star: [1, 1, 0.5, 0.5],
          scrape: [1.8, 0.45, 1.1, 0.3],
        },
        MARK_LIFT = 0.07,
        PANE_OUT = { left: [0, -1], right: [0, 1], front: [1, 0], rear: [-1, 0] },
        markAnchors = new WeakMap(),
        markRay = new Three.Raycaster(),
        markOrigin = new Three.Vector3(),
        markWorldDirection = new Three.Vector3(),
        markInverse = new Three.Matrix4(),
        markRel = new Three.Matrix4(),
        markNormalMatrix = new Three.Matrix3(),
        markPoint = new Three.Vector3(),
        markNormal = new Three.Vector3(),
        markCorner = new Three.Vector3(),
        markTriangle = new Three.Triangle(),
        bodyWorld = new Three.Matrix4(),
        markWorld = new Three.Matrix4();
      function rayTargets(m) {
        const wheelParts = new Set();
        for (const { wheel } of m.wheels || []) wheel?.traverse?.((o) => wheelParts.add(o));
        const list = [];
        m.body.traverse((o) => {
          if (!o.isMesh || o.isInstancedMesh || wheelParts.has(o)) return;
          for (let p = o; p && p !== m.body; p = p.parent) if (!p.visible) return;
          list.push(o);
        });
        return list;
      }
      function markTargets(m) {
        if (!m.rayTargets || m.rayTargetsVersion !== m.shapeVersion) {
          m.rayTargets = rayTargets(m);
          m.rayTargetsVersion = m.shapeVersion;
        }
        return m.rayTargets;
      }
      // 1 shown, 0 hidden (it or a parent), -1 no longer part of the body (a pristine-merge mesh taken away).
      function markShown(object, m) {
        let shown = 1;
        for (let o = object; o; o = o.parent) {
          if (!o.visible) shown = 0;
          if (o === m.body) return shown;
        }
        return -1;
      }
      // The pane (PANE_ORDER index) a face of the glasshouse belongs to.
      function markPaneOf(geometry, faceIndex) {
        const at = faceIndex * 3;
        for (const g of geometry.groups) if (at >= g.start && at < g.start + g.count) return g.materialIndex;
        return -1;
      }
      // Whether a mark may sit where a ray met the model: holes and scrapes on the outside of the body, stars on their pane.
      function markSurfaceOk(m, hit, mark) {
        const o = hit.object;
        if (!hit.face) return false;
        if (mark.kind === 'star') return o === m.cabin && markPaneOf(o.geometry, hit.faceIndex) === PANE_ORDER.indexOf(mark.pane);
        if (m.cabin && o === m.cabin) return false;
        // The trim's cabin share (seats, dash) is seen through the glass: never a place for a hole.
        const trim = m.kit?.trim;
        if (trim && (o.userData.crumpleSource || o.geometry) === trim) {
          const outer = m.kit.trimOuter,
            count = outer && outer !== trim ? Math.min(outer.drawRange.count, trim.index ? trim.index.count : Infinity) : Infinity;
          if (hit.faceIndex * 3 >= count) return false;
        }
        return true;
      }
      // A ray in body space (design units) from outside, along the round's heading (dx, dy), through (x, height, y).
      function markCast(m, mark, x, height, y, dx, dy, targets) {
        markOrigin.set(x - dx * 18, height, y - dy * 18).applyMatrix4(m.body.matrixWorld);
        markWorldDirection.set(dx, 0, dy).transformDirection(m.body.matrixWorld);
        markRay.set(markOrigin, markWorldDirection);
        markRay.far = 120;
        // Nothing past the body's middle along the ray: that is the inside of the far side.
        markPoint.set(0, height, 0).applyMatrix4(m.body.matrixWorld).sub(markOrigin);
        const middle = markPoint.dot(markWorldDirection),
          hits = markRay.intersectObjects(targets, false);
        for (let i = 0; i < hits.length; i++) {
          if (hits[i].distance > middle) break;
          if (markSurfaceOk(m, hits[i], mark) && (mark.kind === 'star' || markCovered(m, hits[i], targets))) return hits[i];
        }
        return null;
      }
      // Whether the surface round a hit holds a chase-view hole's bare-metal ring (four points a hole's ring out, each
      // within 4 cm of the hit's plane): a round that clips a mirror's edge or a trim strip goes on to the panel behind.
      const coverNormal = new Three.Vector3(),
        coverU = new Three.Vector3(),
        coverV = new Three.Vector3(),
        coverRay = new Three.Raycaster();
      function markCovered(m, hit, targets) {
        coverNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
        coverU.set(0, 1, 0);
        if (Math.abs(coverNormal.dot(coverU)) > 0.9) coverU.set(1, 0, 0);
        coverU.cross(coverNormal).normalize();
        coverV.crossVectors(coverNormal, coverU);
        const scale = m.modelScale || 1,
          ring = MARK_SIZES.hole[2] * 1.4 * 0.26 * scale,
          slack = 0.32 * scale;
        let covered = 0;
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2;
          markCorner
            .copy(hit.point)
            .addScaledVector(coverU, Math.cos(a) * ring)
            .addScaledVector(coverV, Math.sin(a) * ring)
            .addScaledVector(coverNormal, 1);
          coverRay.set(markCorner, coverNormal.clone().negate());
          coverRay.far = 1 + slack;
          const under = coverRay.intersectObjects(targets, false);
          for (const u of under)
            if (u.object !== m.cabin && Math.abs(u.distance - 1) <= slack) {
              covered++;
              break;
            }
        }
        return covered >= 3;
      }
      // A star the round's line misses the model's pane with (the glass band's numbers are the game's): aim at the
      // pane itself, as near as it allows to where the round went in.
      function markPaneCast(m, mark, x, height, y) {
        const geometry = m.cabin.geometry,
          pane = PANE_ORDER.indexOf(mark.pane),
          group = geometry.groups.find((g) => g.materialIndex === pane),
          out = PANE_OUT[mark.pane];
        if (!group || !out) return null;
        const position = geometry.attributes.position,
          index = geometry.index;
        markRel.copy(markInverse).multiply(m.cabin.matrixWorld);
        const lo = [Infinity, Infinity, Infinity],
          hi = [-Infinity, -Infinity, -Infinity];
        for (let i = group.start; i < Math.min(group.start + group.count, index ? index.count : position.count); i++) {
          markCorner.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(markRel);
          for (let a = 0; a < 3; a++) {
            const v = markCorner.getComponent(a);
            if (v < lo[a]) lo[a] = v;
            if (v > hi[a]) hi[a] = v;
          }
        }
        if (!(hi[0] > lo[0])) return null;
        const inside = (v, a) => clamp(v, lo[a] + (hi[a] - lo[a]) * 0.2, hi[a] - (hi[a] - lo[a]) * 0.2),
          px = out[0] ? (lo[0] + hi[0]) / 2 : inside(x, 0),
          pz = out[1] ? (lo[2] + hi[2]) / 2 : inside(y, 2),
          py = inside(height, 1);
        return markCast(m, mark, px + out[0] * 0.5, py, pz + out[1] * 0.5, -out[0], -out[1], [m.cabin]);
      }
      // Finds where a mark sits on the model and keeps that triangle (null object: nowhere, so not drawn).
      function anchorMark(c, m, mark, anchor) {
        const k = 1 / (m.modelScale || 1),
          x = mark.x * k,
          y = mark.y * k,
          z = mark.z * k;
        let dx = mark.dx,
          dy = mark.dy,
          length = Math.hypot(dx, dy);
        if (length < 1e-6) {
          dx = -x;
          dy = -y;
          length = Math.hypot(dx, dy) || 1;
        }
        dx /= length;
        dy /= length;
        let hit = null;
        if (mark.kind === 'star') {
          if (m.cabin && markShown(m.cabin, m) === 1) hit = markCast(m, mark, x, z, y, dx, dy, [m.cabin]) || markPaneCast(m, mark, x, z, y);
        } else {
          const targets = markTargets(m);
          for (const share of [1, 0.8, 0.62, 0.45]) if ((hit = markCast(m, mark, x, z * share, y, dx, dy, targets))) break;
        }
        anchor = anchor || { model: m, object: null, a: 0, b: 0, c: 0, u: 0, v: 0, w: 0, dx: 0, dy: 0, version: -1, view: -1, hidden: false, matrix: new Three.Matrix4() };
        anchor.model = m;
        anchor.object = null;
        anchor.dx = dx;
        anchor.dy = dy;
        if (hit) {
          const object = hit.object,
            position = object.geometry.attributes.position;
          markPoint.copy(hit.point);
          object.worldToLocal(markPoint);
          markTriangle.setFromAttributeAndIndices(position, hit.face.a, hit.face.b, hit.face.c);
          markTriangle.getBarycoord(markPoint, markCorner);
          anchor.object = object;
          anchor.a = hit.face.a;
          anchor.b = hit.face.b;
          anchor.c = hit.face.c;
          anchor.u = markCorner.x;
          anchor.v = markCorner.y;
          anchor.w = markCorner.z;
        }
        markAnchors.set(mark, anchor);
        return anchor;
      }
      // Re-reads the anchor's triangle where it now is and poses the decal on it, sized for the view.
      function poseMark(m, mark, anchor, view) {
        const object = anchor.object,
          shown = markShown(object, m);
        anchor.view = view;
        anchor.hidden = shown !== 1;
        if (shown !== 1) return shown;
        const geometry = object.geometry,
          position = geometry.attributes.position,
          normal = geometry.attributes.normal,
          { a, b, c, u, v, w } = anchor;
        markRel.copy(markInverse).multiply(object.matrixWorld);
        markPoint.set(
          position.getX(a) * u + position.getX(b) * v + position.getX(c) * w,
          position.getY(a) * u + position.getY(b) * v + position.getY(c) * w,
          position.getZ(a) * u + position.getZ(b) * v + position.getZ(c) * w,
        );
        if (normal)
          markNormal.set(
            normal.getX(a) * u + normal.getX(b) * v + normal.getX(c) * w,
            normal.getY(a) * u + normal.getY(b) * v + normal.getY(c) * w,
            normal.getZ(a) * u + normal.getZ(b) * v + normal.getZ(c) * w,
          );
        if (!normal || markNormal.lengthSq() < 1e-10) {
          markTriangle.setFromAttributeAndIndices(position, a, b, c);
          markTriangle.getNormal(markNormal);
        }
        markPoint.applyMatrix4(markRel);
        markNormal.applyMatrix3(markNormalMatrix.getNormalMatrix(markRel)).normalize();
        // Facing the shooter (the side the round came from).
        if (markNormal.x * anchor.dx + markNormal.z * anchor.dy > 0) markNormal.negate();
        const size = MARK_SIZES[mark.kind] || MARK_SIZES.hole,
          k = 1 / (m.modelScale || 1),
          sx = mark.size * size[view ? 2 : 0] * k,
          sy = mark.size * size[view ? 3 : 1] * k;
        decalPose(anchor.matrix, markPoint.x, markPoint.y, markPoint.z, markNormal.x, markNormal.y, markNormal.z, sx, sy, mark.kind === 'scrape' ? 0 : (mark.id * 2.39996) % TAU, MARK_LIFT);
        return 1;
      }
      // The world matrices and the body's inverse, once per car when an anchor needs them.
      function markPrepare(m) {
        m.group.updateMatrixWorld(true);
        markInverse.copy(m.body.matrixWorld).invert();
      }
      function drawVehicleMarks() {
        const layer = vehicleDecals,
          view = chaseViewActive ? 1 : 0;
        let n = 0,
          budget = 8;
        for (let v = 0; v < vehicles.length; v++) {
          const c = vehicles[v],
            marks = c.damage?.marks;
          if (!marks || !marks.length) continue;
          const m = carModels.get(c);
          if (!m || !m.group.visible) continue;
          // Body to world as it stands this frame (the vehicle loop has posed the body).
          m.group.updateMatrix();
          m.body.updateMatrix();
          if (m.body.parent === m.group) bodyWorld.multiplyMatrices(m.group.matrix, m.body.matrix);
          else {
            m.group.updateMatrixWorld(true);
            bodyWorld.copy(m.body.matrixWorld);
          }
          let prepared = false;
          for (let i = 0; i < marks.length && n < layer.capacity; i++) {
            const mark = marks[i];
            if (mark.kind === 'star' && (c.damage.glass[mark.pane] === 2 || c.windowsDown?.[mark.pane])) continue;
            let anchor = markAnchors.get(mark);
            if (anchor && anchor.model !== m) anchor = null;
            const stale = !anchor || anchor.version !== m.shapeVersion;
            if (stale || anchor.view !== view) {
              if (!prepared) {
                markPrepare(m);
                prepared = true;
              }
              if (stale) {
                // Cast (a few a frame) when there is no surface yet or its part has left the body; else re-read the triangle.
                if (!anchor || !anchor.object || markShown(anchor.object, m) === -1) {
                  if (budget <= 0) continue;
                  budget--;
                  anchor = anchorMark(c, m, mark, anchor);
                }
                anchor.version = m.shapeVersion;
              }
              if (anchor.object) poseMark(m, mark, anchor, view);
              else anchor.view = view;
            }
            if (!anchor.object || anchor.hidden) continue;
            writeDecal(layer, n++, markWorld.multiplyMatrices(bodyWorld, anchor.matrix), MARK_TILES[mark.kind], mark.kind === 'scrape' ? 0.85 : 1, null);
          }
        }
        layer.mesh.count = n;
        if (n) layer.dirty = true;
      }

      // ---- Report (console vehicleDamageShape) -------------------------------------------------------------------------
      // How far a decal's plane stands off the surface under it at a point (world units; + above, - sunk), or null when
      // nothing is under it within 3 units.
      function markGapAt(m, point, normal, targets, mark) {
        markOrigin.copy(point).addScaledVector(normal, 3);
        markWorldDirection.copy(normal).negate();
        markRay.set(markOrigin, markWorldDirection);
        markRay.far = 6;
        const hits = markRay.intersectObjects(targets, false);
        for (const hit of hits) if (mark.kind === 'star' ? hit.object === m.cabin : hit.object !== m.cabin) return hit.distance - 3;
        return null;
      }
      function vehicleDamageShape(c, rebend) {
        const m = carModels.get(c);
        if (!m) return null;
        // `rebend`: bend every part again now, in one go (to time a full bend: crumpleMs, slowest).
        if (rebend && m.crumple && m.designDents) {
          crumpleStart(c, m, m.designDents, true);
          crumpleStep(m, Infinity, true);
          crumpleQueue.delete(m);
        }
        markPrepare(m);
        const scale = m.modelScale || 1,
          cm = (units) => Math.round(((units * 100) / UNITS_PER_METRE) * 10) / 10,
          view = chaseViewActive ? 1 : 0,
          targets = rayTargets(m),
          marks = [];
        for (const mark of c.damage?.marks || []) {
          const anchor = markAnchors.get(mark),
            // A star on a pane that has since burst (or is wound down) is not drawn.
            gone = mark.kind === 'star' && (c.damage.glass[mark.pane] === 2 || !!c.windowsDown?.[mark.pane]),
            entry = { kind: mark.kind, pane: mark.pane, anchored: !!anchor?.object, hidden: !!anchor?.hidden, drawn: !gone && !!anchor?.object && !anchor.hidden, on: null, gapCm: null, ringGapCm: null, sizeCm: null };
          marks.push(entry);
          if (!anchor?.object || anchor.model !== m) continue;
          const o = anchor.object;
          entry.on = o === m.shell ? 'shell' : o === m.cabin ? 'glass' : o === m.hood ? 'hood' : m.bumpers?.includes(o) ? 'bumper' : o === m.panels ? 'panels' : m.lamps?.some((lamp) => lamp.mesh === o) ? 'lamp' : (o.userData.crumpleSource || o.geometry) === m.kit?.trim ? 'trim' : 'other';
          if (!entry.drawn || anchor.view !== view) continue;
          markWorld.multiplyMatrices(m.body.matrixWorld, anchor.matrix);
          const e = markWorld.elements,
            centre = new Three.Vector3(e[12], e[13], e[14]),
            axisX = new Three.Vector3(e[0], e[1], e[2]),
            axisY = new Three.Vector3(e[4], e[5], e[6]),
            normal = new Three.Vector3(e[8], e[9], e[10]).normalize(),
            gap = markGapAt(m, centre, normal, targets, mark);
          entry.sizeCm = cm(axisX.length());
          entry.gapCm = gap === null ? null : cm(gap);
          // The ring of bare metal round the hole (a quarter of the decal out from its middle), or a star's inner cracks.
          let ring = 0;
          for (const [fx, fy] of [[0.26, 0], [-0.26, 0], [0, 0.26], [0, -0.26]]) {
            const point = centre.clone().addScaledVector(axisX, fx).addScaledVector(axisY, fy),
              g = markGapAt(m, point, normal, targets, mark);
            ring = g === null ? Infinity : Math.max(ring, Math.abs(g));
          }
          entry.ringGapCm = ring === Infinity ? null : cm(ring);
        }
        const record = m.crumple,
          parts = record?.parts || [],
          dents = m.designDents || c.dents || [];
        let missed = 0,
          bent = 0,
          vertices = 0;
        for (const part of parts) {
          if (part.own) vertices += part.mesh.geometry.attributes.position.count;
          if (part.bent) bent++;
          else if (!part.own && part.mesh.visible && dents.length && crumpleReaches(part.box, dents)) missed++;
        }
        const shell = parts.find((p) => p.mesh === m.shell);
        let shellReport = null;
        if (shell && shell.own) {
          const now = m.shell.geometry.attributes.position.array,
            base = shell.base,
            index = m.shell.geometry.index,
            half = m.dims.w / 2,
            band = vehicleGlassBand(c),
            k = 1 / scale;
          let maxMove = 0,
            crossed = 0,
            intoCabin = 0,
            flipped = 0,
            faces = 0,
            stretch = 0;
          // The occupant cell: between the crush limit planes (crumpleLimits), the middle of the width, floor to belt.
          const lim = record.limits || crumpleLimits(c, k),
            inCabin = (x, y, z) => band && x > lim.rear + 2 && x < lim.front - 2 && Math.abs(z) < Math.min(half * 0.4, lim.side * 0.9),
            cellHeight = (y) => y > (m.dims.sill ?? 4.8) + 1 && y < band.belt * k - 1;
          for (let i = 0; i < now.length; i += 3) {
            maxMove = Math.max(maxMove, Math.hypot(now[i] - base[i], now[i + 1] - base[i + 1], now[i + 2] - base[i + 2]));
            if (Math.abs(base[i + 2]) > half * 0.05 && Math.sign(now[i + 2]) !== Math.sign(base[i + 2])) crossed++;
            // Across the plan into the occupant cell (by where it is, at a height inside the cell).
            if (cellHeight(base[i + 1]) && !inCabin(base[i], base[i + 1], base[i + 2]) && inCabin(now[i], now[i + 1], now[i + 2])) intoCabin++;
          }
          if (index) {
            const a = new Three.Vector3(),
              b = new Three.Vector3(),
              d = new Three.Vector3(),
              n0 = new Three.Vector3(),
              n1 = new Three.Vector3(),
              edge = (arr, i, j) => Math.hypot(arr[i * 3] - arr[j * 3], arr[i * 3 + 1] - arr[j * 3 + 1], arr[i * 3 + 2] - arr[j * 3 + 2]),
              normalOf = (arr, i, j, l, out) => {
                a.fromArray(arr, i * 3);
                b.fromArray(arr, j * 3).sub(a);
                d.fromArray(arr, l * 3).sub(a);
                return out.crossVectors(b, d);
              };
            for (let f = 0; f < index.count; f += 3) {
              const i = index.getX(f),
                j = index.getX(f + 1),
                l = index.getX(f + 2);
              normalOf(base, i, j, l, n0);
              normalOf(now, i, j, l, n1);
              if (n0.lengthSq() < 1e-8) continue;
              faces++;
              if (n1.lengthSq() > 1e-10 && n0.normalize().dot(n1.normalize()) < -0.2) flipped++;
              for (const [p, q] of [[i, j], [j, l], [l, i]]) {
                const rest = edge(base, p, q);
                if (rest > 0.2) stretch = Math.max(stretch, edge(now, p, q) / rest);
              }
            }
          }
          shellReport = { maxMoveM: Math.round((maxMove * scale * 1000) / UNITS_PER_METRE) / 1000, crossed, intoCabin, flippedShare: faces ? Math.round((flipped / faces) * 10000) / 10000 : 0, maxStretch: Math.round(stretch * 100) / 100 };
        }
        let wheelMove = 0;
        for (const point of record?.points || []) if (point.level) wheelMove = Math.max(wheelMove, Math.hypot(point.object.position.x - point.rest.x, point.object.position.z - point.rest.z));
        return {
          id: c.id,
          type: c.type,
          view: view ? 'chase' : 'street',
          dents: dents.length,
          shapeVersion: m.shapeVersion || 0,
          parts: parts.length,
          bent,
          missed,
          vertices,
          crumpleMs: record ? Math.round((record.lastMs || 0) * 100) / 100 : null,
          // The slowest parts of the last bend (ms, vertices).
          slowest: parts
            .filter((p) => p.ms)
            .sort((p, q) => q.ms - p.ms)
            .slice(0, 4)
            .map((p) => [p.mesh === m.shell ? 'shell' : p.mesh === m.cabin ? 'glass' : (p.mesh.userData.crumpleSource || p.mesh.geometry) === m.kit?.trim ? 'trim' : p.mesh.name || 'part', Math.round(p.ms * 100) / 100, p.base.length / 3]),
          wheelMoveM: Math.round((wheelMove * scale * 1000) / UNITS_PER_METRE) / 1000,
          shell: shellReport,
          drawnMarks: marks.filter((e) => e.drawn).length,
          // Still to come: a bend queued (crumpleSlices) or marks not yet looked for on the model (a few a frame).
          bending: crumpleQueue.has(m),
          waiting: (c.damage?.marks || []).filter((mark) => {
            const anchor = markAnchors.get(mark);
            return !anchor || anchor.model !== m || anchor.version !== m.shapeVersion || anchor.view !== view;
          }).length,
          marks,
        };
      }
