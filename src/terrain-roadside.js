    // Scenic roads' roadside: guard rails and viewpoint walls (drawn and solid), reflector posts, the report (mountainRoad) and a test autopilot (mountainRoadDrive).
    /**
     * ROADSIDE FURNITURE
     * Worked out once from the finished surface (scenicRoadFurniture):
     *   rails   a W-beam wherever the ground falls away more than ~1.1 m within
     *           four metres of the shoulder, run on past the drop and never
     *           across a junction mouth, a trailhead or a town street; along a
     *           viewpoint's lay-by it is a low stone wall instead. Both are
     *           oriented static bodies (addScenicRoadColliders), so a car glances
     *           off them; a wall also stops people.
     *   posts   white reflector posts on the shoulder's outer edge, 6 m apart on
     *           the straights and 4 m through the bends, where there is no rail.
     *   views   the viewpoints (terrain-grading.js SCENIC_VIEWPOINTS): a bench,
     *           a coin telescope and a sign on the lay-by.
     * The renderer (county3d-roads.js) draws exactly these lists.
     */
    // Samples a road draws no rural furniture or ribbon on: inside a town (its streets are the
    // town's), on a bridge deck or on Monarch Isle's own streets.
    function scenicRoadSkip(road) {
      if (road.skip) return road.skip;
      const skip = (road.skip = new Uint8Array(road.n)),
        decks = COUNTY_ROADS.filter((o) => o.bridge || o.isle),
        d = road.dense;
      for (let k = 0; k < road.n; k++) {
        const x = d[k * 2],
          y = d[k * 2 + 1];
        if (COUNTY_TOWNS.some((t) => x > t.x - 30 && x < t.x + BLOCK_SIZE * 2 + 30 && y > t.y - 30 && y < t.y + BLOCK_SIZE * 2 + 30)) skip[k] = 1;
        else if (decks.some((o) => o.points.some((p, i) => i && segmentDistance(x, y, o.points[i - 1], p) < o.width / 2 + 6))) skip[k] = 1;
      }
      return skip;
    }
    let scenicFurnitureCache = null;
    function scenicRoadFurniture() {
      if (scenicFurnitureCache) return scenicFurnitureCache;
      for (const f of TERRAIN_FIELDS) terrainField(f);
      scenicJunctions();
      const rails = [],
        posts = [],
        p = {},
        q = {};
      for (const road of SCENIC_ROADS) {
        const n = road.n,
          skip = scenicRoadSkip(road),
          blocked = (k) => skip[k] || road.junction[k] > 0.02;
        for (const side of [1, -1]) {
          const need = new Uint8Array(n);
          for (let k = 0; k < n; k++) {
            if (blocked(k)) continue;
            const edge = road.half + scenicBayWidth(road, k, side);
            if (scenicBayWidth(road, k, side) > SCENIC_BAY.width * 0.5) {
              need[k] = 2;
              continue;
            }
            scenicPointAt(road, k, side * (edge + 5.5), p);
            const z = terrainHeight(p.x, p.y);
            scenicPointAt(road, k, side * (edge + 20), q);
            const z1 = terrainHeight(q.x, q.y);
            scenicPointAt(road, k, side * (edge + 34), q);
            if (z - Math.min(z1, terrainHeight(q.x, q.y)) > 9) need[k] = 1;
          }
          // Close short gaps, drop short runs, and carry each rail 20 units past its drop.
          const runs = [];
          for (let k = 0; k < n; ) {
            if (!need[k]) {
              k++;
              continue;
            }
            let end = k;
            while (end + 1 < n && (need[end + 1] || (!blocked(end + 1) && need.slice(end + 1, end + 11).some((v) => v)))) end++;
            runs.push([k, end]);
            k = end + 1;
          }
          for (let [a, b] of runs) {
            if (b - a < 7) continue;
            for (let e = 0; e < 5 && a > 0 && !blocked(a - 1); e++) a--;
            for (let e = 0; e < 5 && b < n - 1 && !blocked(b + 1); e++) b++;
            // A lay-by's stretch is a stone wall; the rail either side of it stays a rail.
            let piece = null;
            for (let k = a; k <= b; k += 2) {
              const kind = need[k] === 2 ? 'wall' : 'rail',
                edge = road.half + scenicBayWidth(road, k, side);
              scenicPointAt(road, k, side * (edge + (kind === 'wall' ? 4 : 5.5)), p);
              const point = [p.x, p.y, terrainHeight(p.x, p.y)];
              if (!piece || piece.kind !== kind) {
                if (piece) piece.points.push(point);
                piece = { road: road.name, side, kind, from: k, points: [point] };
                rails.push(piece);
              } else piece.points.push(point);
              piece.to = k;
            }
          }
          // Reflector posts on the shoulder's edge, closer together through the bends.
          for (let k = 8; k < n - 8; ) {
            const tight = Math.abs(road.curvature[k]) > 1 / 550;
            let clear = !blocked(k);
            for (let j = Math.max(0, k - 4); j <= Math.min(n - 1, k + 4) && clear; j++) clear = !need[j] && !blocked(j);
            if (clear) {
              scenicPointAt(road, k, side * (road.half + scenicBayWidth(road, k, side) + SCENIC_SHOULDER - 1), p);
              posts.push([p.x, p.y, terrainHeight(p.x, p.y), p.a, side]);
            }
            k += tight ? 8 : 12;
          }
        }
      }
      const views = SCENIC_VIEWPOINTS.map((v) => {
        const road = v.road,
          at = scenicPointAt(road, v.k, v.side * (road.half + SCENIC_BAY.width - 6), {}),
          sign = scenicPointAt(road, v.k - (SCENIC_BAY.length / 2 + SCENIC_BAY.taper * 0.6) / SCENIC_SAMPLE, v.side * (road.half + SCENIC_SHOULDER + 6), {});
        return {
          road: road.name,
          side: v.side,
          x: at.x,
          y: at.y,
          ground: terrainHeight(at.x, at.y),
          // Facing out over the drop.
          a: Math.atan2(at.ny * v.side, at.nx * v.side),
          along: at.a,
          sign: { x: sign.x, y: sign.y, ground: terrainHeight(sign.x, sign.y) },
          drop: v.drop,
        };
      });
      return (scenicFurnitureCache = { rails, posts, views });
    }
    // The rails and walls as oriented static bodies (county-build.js addCountyColliders); the walls and benches stop people too.
    function addScenicRoadColliders() {
      const { rails, views } = scenicRoadFurniture();
      for (const rail of rails)
        for (let j = 0; j < rail.points.length - 1; j += 4) {
          const a = rail.points[j],
            b = rail.points[Math.min(j + 4, rail.points.length - 1)],
            length = Math.hypot(b[0] - a[0], b[1] - a[1]),
            angle = Math.atan2(b[1] - a[1], b[0] - a[0]),
            wall = rail.kind === 'wall';
          if (length < 1) continue;
          addBridgeBody({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, hx: length / 2 + 0.6, hy: wall ? 2.4 : 1.3, a: angle, height: Math.max(a[2], b[2]) + 7, kind: wall ? 'viewpoint wall' : 'guardrail' });
          if (wall && !addScenicRoadColliders.feet) registerFootObstacle((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, length / 2 + 0.6, 2.4, angle);
        }
      if (!addScenicRoadColliders.feet) for (const v of views) registerFootObstacle(v.x, v.y, 9, 3, v.a + Math.PI / 2);
      addScenicRoadColliders.feet = true;
    }
    /* ---- Report ------------------------------------------------------------------------- */
    function scenicRoadReport(name, every = 20, near = null) {
      for (const f of TERRAIN_FIELDS) terrainField(f);
      const { rails, posts, views } = scenicRoadFurniture(),
        m = (u) => +(u / UNITS_PER_METRE).toFixed(1),
        p = {};
      const roads = SCENIC_ROADS.map((road) => {
        const n = road.n,
          skip = scenicRoadSkip(road);
        let minR = Infinity,
          minAt = null,
          top = 0,
          grade = 0,
          vertical = Infinity,
          verticalAt = null,
          deviationAt = null,
          bumpAt = null,
          bank = 0,
          deviation = 0,
          step = 0,
          bump = 0,
          nan = 0;
        const bend = scenicSmooth(road.curvature, 3);
        for (let k = 0; k < n; k++) {
          const r = 1 / Math.max(1e-9, Math.abs(bend[k]));
          if (r < minR && !skip[k]) {
            minR = r;
            minAt = [Math.round(road.dense[k * 2]), Math.round(road.dense[k * 2 + 1])];
          }
          top = Math.max(top, road.profile[k]);
          bank = Math.max(bank, Math.abs(road.fall[k * 2]), Math.abs(road.fall[k * 2 + 1]));
          if (k) grade = Math.max(grade, Math.abs(road.profile[k] - road.profile[k - 1]) / Math.max(1e-6, road.along[k] - road.along[k - 1]));
          if (k > 0 && k < n - 1) {
            const second = Math.abs(road.profile[k + 1] - 2 * road.profile[k] + road.profile[k - 1]) / (SCENIC_SAMPLE * SCENIC_SAMPLE);
            if (second > 1e-7 && 1 / second < vertical) {
              vertical = 1 / second;
              verticalAt = [Math.round(road.dense[k * 2]), Math.round(road.dense[k * 2 + 1])];
            }
          }
        }
        // Contact: the ground under both lanes against the designed surface, and how
        // it runs along (a bump: the change of its rise from one sample to the next;
        // junction mouths, where two surfaces are blended, are counted apart).
        const last = [null, null],
          lastStep = [0, 0];
        let junctionBump = 0;
        for (let k = 0; k < n; k += 1) {
          if (skip[k]) {
            last[0] = last[1] = null;
            continue;
          }
          [-0.5, 0.5].forEach((lane, l) => {
            const t = lane * road.half;
            scenicPointAt(road, k, t, p);
            const ground = terrainHeight(p.x, p.y),
              want = scenicSurface(road, k, t);
            if (!Number.isFinite(ground)) nan++;
            const mouth = road.junction && road.junction[k] > 0.05;
            if (!mouth && (ground > 0.01 || want > 0.3) && Math.abs(ground - want) > deviation) {
              deviation = Math.abs(ground - want);
              deviationAt = [Math.round(p.x), Math.round(p.y)];
            }
            if (last[l] !== null) {
              const s = ground - last[l],
                change = Math.abs(s - lastStep[l]);
              step = Math.max(step, Math.abs(s));
              if (mouth) junctionBump = Math.max(junctionBump, change);
              else if (change > bump) {
                bump = change;
                bumpAt = [Math.round(p.x), Math.round(p.y)];
              }
              lastStep[l] = s;
            }
            last[l] = ground;
          });
        }
        const mine = rails.filter((r) => r.road === road.name),
          railLength = mine.reduce((sum, r) => sum + (r.to - r.from) * SCENIC_SAMPLE, 0);
        return {
          name: road.name,
          widthM: m(road.width),
          lengthM: Math.round(road.length / UNITS_PER_METRE),
          points: road.points.length,
          samples: n,
          graded: !!road.gradedIn,
          minRadiusM: Math.round(minR / UNITS_PER_METRE),
          minRadiusAt: minAt,
          topM: m(top),
          maxGradePct: +(grade * 100).toFixed(1),
          minVerticalCurveM: vertical === Infinity ? null : Math.round(vertical / UNITS_PER_METRE),
          minVerticalCurveAt: verticalAt,
          maxBankPct: +(bank * 100).toFixed(1),
          // Metres: largest gap between the ground and the designed surface on a lane, and the
          // largest change in height (and in that change) between samples 4 units apart.
          contactErrorM: +(deviation / UNITS_PER_METRE).toFixed(3),
          contactErrorAt: deviationAt,
          maxStepM: +(step / UNITS_PER_METRE).toFixed(3),
          maxBumpM: +(bump / UNITS_PER_METRE).toFixed(4),
          // That bump as a car at 100 km/h feels it (g): speed squared times the
          // change of slope per metre; and the worst in a junction mouth.
          bumpG100: +((((100 / 3.6) ** 2 * (bump / SCENIC_SAMPLE)) / (SCENIC_SAMPLE / UNITS_PER_METRE)) / 9.81).toFixed(2),
          junctionBumpG100: +((((100 / 3.6) ** 2 * (junctionBump / SCENIC_SAMPLE)) / (SCENIC_SAMPLE / UNITS_PER_METRE)) / 9.81).toFixed(2),
          maxBumpAt: bumpAt,
          nan,
          rails: mine.filter((r) => r.kind === 'rail').length,
          walls: mine.filter((r) => r.kind === 'wall').length,
          railM: Math.round(railLength / UNITS_PER_METRE),
          posts: posts.filter((q) => scenicRoadNear(q[0], q[1], {}, road)).length,
          profile:
            name && name === road.name
              ? Array.from({ length: Math.ceil(n / every) }, (_, j) => {
                  const k = Math.min(n - 1, Math.round(j * every));
                  return [Math.round(road.dense[k * 2]), Math.round(road.dense[k * 2 + 1]), +road.profile[k].toFixed(1), +(road.fall[k * 2] * 100).toFixed(1), +(road.fall[k * 2 + 1] * 100).toFixed(1), road.relief ? Math.round(road.relief[k]) : null, road.anchor && !isNaN(road.anchor[k]) ? +road.anchor[k].toFixed(1) : null];
                })
              : undefined,
        };
      });
      return {
        roads: name ? roads.filter((r) => r.name === name) : roads,
        // With a map point: the right lane's ground every 2 units within 60 of it (debugging bumps).
        lane:
          name && near
            ? (() => {
                const road = SCENIC_ROADS.find((r) => r.name === name),
                  hit = scenicRoadNear(near[0], near[1], {}, road),
                  q = {},
                  out = [];
                if (!hit) return null;
                for (let kf = hit.k - 15; kf <= hit.k + 15; kf += 0.5) {
                  scenicPointAt(road, kf, -road.half * 0.5, q);
                  out.push([+kf.toFixed(1), +terrainHeight(q.x, q.y).toFixed(3), +scenicSurface(road, kf, -road.half * 0.5).toFixed(3)]);
                }
                return out;
              })()
            : undefined,
        viewpoints: views.map((v) => ({ road: v.road, x: Math.round(v.x), y: Math.round(v.y), heightM: m(v.ground), dropM: m(v.drop) })),
        rails: rails.length,
        posts: posts.length,
      };
    }
    /* ---- Autopilot (tests) ---------------------------------------------------------------
       Put the player in a car on `name` at `from` (a share of its length), in the
       right-hand lane heading along it (backwards with `reverse`), and drive it
       through the simulation for up to `seconds`: steering to a point ahead on
       the lane, holding `kmh` but no more than ~0.75 g of cornering allows. Reports
       how far it got, how closely it held the lane, whether it ever left the
       paved road, the largest vertical acceleration of the car's ground height
       (g), the largest height step per frame, knocks (speed lost in a step
       without braking), damage and any non-finite telemetry. */
    function scenicRoadDrive(name = 'EAGLE PASS', kmh = 100, from = 0, seconds = 60, reverse = false, type = 'supercar') {
      const road = SCENIC_ROADS.find((r) => r.name === name);
      if (!road) return { error: 'no scenic road ' + name };
      for (const f of TERRAIN_FIELDS) terrainField(f);
      const dir = reverse ? -1 : 1,
        lane = -dir * road.half * 0.5,
        skip = scenicRoadSkip(road);
      let k = clamp(Math.round(from * (road.n - 1)), 0, road.n - 1);
      while (skip[k] && k > 0 && k < road.n - 1) k += dir;
      const start = scenicPointAt(road, k, lane, {});
      if (player.car) exitCar();
      teleportPlayer(start.x, start.y);
      const heading = reverse ? start.a + Math.PI : start.a,
        car = makeCar(type, start.x, start.y, heading, false);
      car.authorized = true;
      enterVehicle(car);
      car.vx = Math.cos(heading) * kmh * KMH;
      car.vy = Math.sin(heading) * kmh * KMH;
      car.speed = kmh * KMH;
      const dt = 1 / 30,
        near = {},
        aim = {},
        hp0 = car.hp,
        out = { road: name, from: Math.round(k), reverse, laneOffsetMax: 0, offRoad: 0, maxVerticalG: 0, maxStepM: 0, knocks: 0, hops: 0, nan: false, maxKmh: 0 };
      let z = entityElevation(car),
        vz = 0,
        lastDs = 0,
        travelled = 0,
        steps = 0,
        speedSum = 0;
      const codes = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
      for (; steps < seconds / dt; steps++) {
        if (gameMode !== 'play' || player.car !== car) break;
        const hit = scenicRoadNear(car.x, car.y, near, road);
        if (!hit) {
          out.lost = [Math.round(car.x), Math.round(car.y)];
          break;
        }
        if ((dir > 0 && hit.k > road.n - 12) || (dir < 0 && hit.k < 11)) break;
        const speed = Math.hypot(car.vx, car.vy),
          ahead = clamp(speed * 0.5, 40, 150) / SCENIC_SAMPLE,
          target = scenicPointAt(road, clamp(hit.k + dir * ahead, 0, road.n - 1), lane, aim),
          error = normalizeAngle(Math.atan2(target.y - car.y, target.x - car.x) - car.a);
        // The tightest bend in the next ~2 seconds sets the speed.
        let bend = 0;
        for (let j = 0; j < speed * 2.2; j += SCENIC_SAMPLE * 3) bend = Math.max(bend, Math.abs(lerpSample(road.curvature, clamp(hit.k + (dir * j) / SCENIC_SAMPLE, 0, road.n - 1), road.n)));
        const along = car.vx * Math.cos(car.a) + car.vy * Math.sin(car.a),
          want = Math.min(kmh * KMH, bend > 1e-5 ? Math.sqrt((0.75 * GRAVITY) / bend) : Infinity);
        for (const c of codes) keys[c] = false;
        if (along < want - 2 * KMH) keys.KeyW = true;
        else if (along > want + 8 * KMH) keys.KeyS = true;
        if (error > 0.015) keys.KeyD = true;
        else if (error < -0.015) keys.KeyA = true;
        const hadHop = !!car.hop,
          x0 = car.x,
          y0 = car.y;
        update(dt);
        if (!Number.isFinite(car.x) || !Number.isFinite(car.y) || !Number.isFinite(car.vx) || !Number.isFinite(car.vy)) {
          out.nan = true;
          break;
        }
        if (car.hop && !hadHop) out.hops++;
        const after = Math.hypot(car.vx, car.vy);
        if (after < speed - 5 * KMH && !keys.KeyS && !out.knocks++) out.knockAt = [Math.round(car.x), Math.round(car.y), Math.round(speed / KMH), Math.round(after / KMH)];
        travelled += Math.hypot(car.x - x0, car.y - y0);
        speedSum += after;
        out.maxKmh = Math.max(out.maxKmh, Math.round(after / KMH));
        // Vertical acceleration from the ground's slope along the path (per unit
        // travelled, so the physics' 3-or-5 substeps a frame cannot fake a jolt):
        // speed squared times the change in slope per unit of path.
        const nz = entityElevation(car),
          ds = Math.hypot(car.x - x0, car.y - y0),
          slope = ds > 0.5 ? (nz - z) / ds : vz;
        if (!Number.isFinite(nz)) out.nan = true;
        if (steps > 3 && ds > 0.5 && lastDs > 0.5) {
          const g = (Math.abs(slope - vz) / ((ds + lastDs) / 2)) * after * after / GRAVITY;
          if (g > out.maxVerticalG) {
            out.maxVerticalG = g;
            out.jerkAt = [Math.round(car.x), Math.round(car.y), Math.round(after / KMH)];
          }
        }
        out.maxStepM = Math.max(out.maxStepM, Math.abs(nz - z) / UNITS_PER_METRE);
        z = nz;
        vz = slope;
        lastDs = ds;
        const now = scenicRoadNear(car.x, car.y, near, road);
        if (now) out.laneOffsetMax = Math.max(out.laneOffsetMax, Math.abs(now.t - lane));
        if (!countyPavedAt(car.x, car.y) && !out.offRoad++) out.offAt = [Math.round(car.x), Math.round(car.y), Math.round(Math.hypot(car.vx, car.vy) / KMH)];
      }
      for (const c of codes) keys[c] = false;
      return {
        ...out,
        seconds: +(steps * dt).toFixed(1),
        distanceM: Math.round(travelled / UNITS_PER_METRE),
        averageKmh: steps ? Math.round(speedSum / steps / KMH) : 0,
        laneOffsetMax: +(out.laneOffsetMax / UNITS_PER_METRE).toFixed(2),
        maxVerticalG: +out.maxVerticalG.toFixed(2),
        maxStepM: +out.maxStepM.toFixed(3),
        damage: Math.round(hp0 - car.hp),
        end: [Math.round(car.x), Math.round(car.y)],
        heightM: +(entityElevation(car) / UNITS_PER_METRE).toFixed(1),
      };
    }
    // The mountain roads take their final shape now the trails exist (terrain-roads.js).
    buildScenicRoads();
