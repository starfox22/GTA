    // BEGIN SUBSYSTEM: src/terrain.js — Mountains and off-road contact
    /**
     * Mountains and off-road contact
     * Source: src/terrain.js
     * Scope: shared game closure.
     * Shared triangulated elevation, snowy summits, trails, slope handling and services.
     */
    /* One height surface drives mountain scenery, vehicle grip, foot elevation and aircraft clearance. */
    COUNTY_PEAKS.splice(
      0,
      8,
      {
        name: 'MOUNT ASCENT',
        x: 7760,
        y: 1090,
        rx: 1010,
        ry: 690,
        r: 1010,
        h: 1180,
      },
      {
        name: 'NEEDLE RIDGE',
        x: 9760,
        y: 1230,
        rx: 760,
        ry: 680,
        r: 760,
        h: 980,
      },
    );
    countyStaticSolids.length = 0;
    const MOUNTAIN_TRAILS = COUNTY_PEAKS.slice(0, 2).map((p, i) => {
      const points = Array.from(
        {
          length: 73,
        },
        (_, j) => {
          const q = 1 - j / 72,
            a = Math.PI / 2 + q * 4 * Math.PI;
          return [p.x + Math.cos(a) * (p.rx || p.r) * q, p.y + Math.sin(a) * (p.ry || p.r) * q];
        },
      );
      points.unshift(i ? [9500, 2860] : [7510, 1970]);
      return {
        name: p.name + ' TRAIL',
        width: 42,
        points,
        peak: p,
        trail: true,
      };
    });
    function mountainAt(x, y) {
      return COUNTY_PEAKS.find(
        (p) => ((x - p.x) / (p.rx || p.r)) ** 2 + ((y - p.y) / (p.ry || p.r)) ** 2 < 1,
      );
    }
    function terrainBaseHeight(x, y) {
      if (COUNTY_LAKES.some((r) => regionContains(r, x, y))) return 0;
      let z = 0;
      for (const p of COUNTY_PEAKS) {
        const dx = (x - p.x) / (p.rx || p.r),
          dy = (y - p.y) / (p.ry || p.r),
          d = dx * dx + dy * dy;
        if (d < 1) z = Math.max(z, p.h * (1 - d) ** 2);
      }
      return z;
    }
    for (const trail of MOUNTAIN_TRAILS)
      trail.heights = trail.points.map((p) => terrainBaseHeight(...p));
    function terrainAnalyticHeight(x, y) {
      const base = terrainBaseHeight(x, y);
      if (base < 0.001) return 0;
      let nearest = 34,
        height = base;
      for (const t of MOUNTAIN_TRAILS) {
        if (
          Math.abs(x - t.peak.x) > (t.peak.rx || t.peak.r) + 40 ||
          Math.abs(y - t.peak.y) > (t.peak.ry || t.peak.r) + 40
        )
          continue;
        for (let i = 1; i < t.points.length; i++) {
          const a = t.points[i - 1],
            b = t.points[i],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            u = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1),
            d = Math.hypot(x - a[0] - dx * u, y - a[1] - dy * u);
          if (d < nearest) {
            nearest = d;
            height = t.heights[i - 1] + (t.heights[i] - t.heights[i - 1]) * u;
          }
        }
      }
      const t = clamp((34 - nearest) / 20, 0, 1),
        blend = t * t * (3 - 2 * t);
      return base + (height - base) * blend;
    }
    // Rendering and contact heights use these exact Float32 vertices and the same diagonal.
    // The analytical surface is only a construction source, never a second collision surface.
    const mountainSurfaceCache = new Map(),
      TERRAIN_CELL = 10;
    function mountainSurface(peak) {
      if (mountainSurfaceCache.has(peak)) return mountainSurfaceCache.get(peak);
      const rx = peak.rx || peak.r,
        ry = peak.ry || peak.r,
        nx = Math.ceil((rx * 2) / TERRAIN_CELL),
        ny = Math.ceil((ry * 2) / TERRAIN_CELL),
        stride = nx + 1;
      const xs = new Float32Array(stride),
        zs = new Float32Array(ny + 1),
        positions = new Float32Array(stride * (ny + 1) * 3),
        uvs = new Float32Array(stride * (ny + 1) * 2),
        land = new Uint8Array(stride * (ny + 1)),
        triangles = new Uint8Array(nx * ny * 2),
        indices = [];
      for (let x = 0; x <= nx; x++) xs[x] = -rx + (x * rx * 2) / nx;
      for (let z = 0; z <= ny; z++) zs[z] = -ry + (z * ry * 2) / ny;
      for (let z = 0; z <= ny; z++)
        for (let x = 0; x <= nx; x++) {
          const i = z * stride + x,
            wx = peak.x + xs[x],
            wz = peak.y + zs[z];
          positions[i * 3] = xs[x];
          positions[i * 3 + 1] = terrainAnalyticHeight(wx, wz);
          positions[i * 3 + 2] = zs[z];
          uvs[i * 2] = x / nx;
          uvs[i * 2 + 1] = 1 - z / ny;
          land[i] = landAt(wx, wz) ? 1 : 0;
        }
      for (let z = 0; z < ny; z++)
        for (let x = 0; x < nx; x++) {
          const a = z * stride + x,
            b = a + stride,
            c = b + 1,
            d = a + 1;
          for (const [side, ids] of [
            [0, [a, b, d]],
            [1, [b, c, d]],
          ])
            if (ids.every((i) => land[i]) && ids.some((i) => positions[i * 3 + 1] > 0.001)) {
              triangles[(z * nx + x) * 2 + side] = 1;
              indices.push(...ids);
            }
        }
      const surface = {
        peak,
        rx,
        ry,
        nx,
        ny,
        stride,
        xs,
        zs,
        positions,
        uvs,
        triangles,
        indices: new Uint32Array(indices),
      };
      mountainSurfaceCache.set(peak, surface);
      return surface;
    }
    function sampleMountainSurface(surface, x, y) {
      const { peak, rx, ry, nx, ny, stride, xs, zs, positions, triangles } = surface,
        lx = x - peak.x,
        lz = y - peak.y;
      if (lx < -rx || lx > rx || lz < -ry || lz > ry) return 0;
      let ix = Math.min(nx - 1, Math.max(0, Math.floor(((lx + rx) / (rx * 2)) * nx))),
        iz = Math.min(ny - 1, Math.max(0, Math.floor(((lz + ry) / (ry * 2)) * ny)));
      // Account for rounded Float32 grid coordinates at cell boundaries.
      if (ix > 0 && lx < xs[ix]) ix--;
      else if (ix < nx - 1 && lx > xs[ix + 1]) ix++;
      if (iz > 0 && lz < zs[iz]) iz--;
      else if (iz < ny - 1 && lz > zs[iz + 1]) iz++;
      const u = clamp((lx - xs[ix]) / (xs[ix + 1] - xs[ix]), 0, 1),
        v = clamp((lz - zs[iz]) / (zs[iz + 1] - zs[iz]), 0, 1),
        side = u + v <= 1 ? 0 : 1;
      if (!triangles[(iz * nx + ix) * 2 + side]) return 0;
      const a = iz * stride + ix,
        h00 = positions[a * 3 + 1],
        h10 = positions[(a + 1) * 3 + 1],
        h01 = positions[(a + stride) * 3 + 1],
        h11 = positions[(a + stride + 1) * 3 + 1];
      return side === 0
        ? h00 * (1 - u - v) + h10 * u + h01 * v
        : h11 * (u + v - 1) + h01 * (1 - u) + h10 * (1 - v);
    }
    function terrainHeight(x, y) {
      let z = 0;
      for (const peak of COUNTY_PEAKS)
        if (Math.abs(x - peak.x) <= (peak.rx || peak.r) && Math.abs(y - peak.y) <= (peak.ry || peak.r))
          z = Math.max(z, sampleMountainSurface(mountainSurface(peak), x, y));
      return z;
    }
    function terrainSlope(x, y) {
      return {
        x: (terrainHeight(x + 3, y) - terrainHeight(x - 3, y)) / 6,
        y: (terrainHeight(x, y + 3) - terrainHeight(x, y - 3)) / 6,
      };
    }
    function onMountainTrail(x, y) {
      return MOUNTAIN_TRAILS.some((t) =>
        t.points.some((p, i) => i && segmentDistance(x, y, t.points[i - 1], p) < t.width / 2),
      );
    }
    function roadVehicleTerrain(vehicle) {
      const z = terrainHeight(vehicle.x, vehicle.y);
      if (z < 0.2 && !mountainAt(vehicle.x, vehicle.y)) return null;
      const slope = terrainSlope(vehicle.x, vehicle.y),
        along = slope.x * Math.cos(vehicle.a) + slope.y * Math.sin(vehicle.a),
        cross = -slope.x * Math.sin(vehicle.a) + slope.y * Math.cos(vehicle.a),
        trail = onMountainTrail(vehicle.x, vehicle.y),
        offroadCapable = !!vehicleSpec(vehicle).offroad;
      return {
        z,
        slope,
        along,
        cross,
        trail,
        four: offroadCapable,
        traction: offroadCapable ? (trail ? 0.92 : 0.68) : trail ? 0.26 : 0.12,
        limit: offroadCapable ? (trail ? 110 : 65) : trail ? 48 : 25,
      };
    }
    function terrainVehiclePose(vehicle, h) {
      if (isAircraft(vehicle) || isBoat(vehicle)) return;
      const t = roadVehicleTerrain(vehicle);
      vehicle.groundHeight = t?.z || 0;
      vehicle.slopePitch = Math.atan(t?.along || 0);
      vehicle.slopeRoll = -Math.atan(t?.cross || 0);
      vehicle.offroadState = t;
      if (vehicle === player.car && t?.z > 10) {
        const peak = mountainAt(vehicle.x, vehicle.y);
        if (
          peak?.name &&
          distanceBetween(vehicle, peak) < 48 &&
          !vehicle.summits?.includes(peak.name)
        ) {
          vehicle.summits = vehicle.summits || [];
          vehicle.summits.push(peak.name);
          announce('SUMMIT REACHED', peak.name, 4);
        }
      }
    }
    /**
     * FOOT TRAVEL ON THE MOUNTAIN
     * The trail is graded: you walk it up or down at close to normal pace. Off the
     * trail the slope decides. A moderate face can be traversed slowly and slips
     * you sideways; a steep face cannot be climbed at all; and stepping off the
     * lip of a steep face means going down it on your back, which hurts and which
     * you do not steer. Gradients are height change per unit of ground, so 0.5 is
     * about twenty-seven degrees.
     */
    const TRAIL_GRADE = 0.32,
      SLIP_GRADE = 0.34,
      TUMBLE_GRADE = 0.52,
      UNCLIMBABLE_GRADE = 0.66;
    function endTumble(landed = true) {
      if (!player.tumble) return;
      const fast = player.tumble.peak > 190;
      player.tumble = null;
      player.tumbleRoll = 0;
      if (landed)
        tell(fast ? 'You slide to a stop. Use the trail next time.' : 'Back on your feet.', 2.5);
    }
    function startTumble(downhill, grade) {
      if (player.tumble) return;
      player.tumble = {
        vx: downhill.x * (40 + grade * 90),
        vy: downhill.y * (40 + grade * 90),
        time: 0,
        peak: 0,
        hurtClock: 0.35,
      };
      player.tumbleRoll = 0;
      tell('You lose your footing on the scree.', 2.2);
      noise(0.22, 0.14, 700);
    }
    function updateMountainFooting(deltaSeconds) {
      if (player.car || player.roof || player.parachute || transitRide || gameMode !== 'play') {
        endTumble(false);
        return false;
      }
      const z = terrainHeight(player.x, player.y);
      if (z < 4) {
        endTumble(!!player.tumble);
        player.mountainGrade = 0;
        return false;
      }
      const slope = terrainSlope(player.x, player.y),
        grade = Math.hypot(slope.x, slope.y),
        trail = onMountainTrail(player.x, player.y),
        downhill = grade > 1e-4 ? { x: -slope.x / grade, y: -slope.y / grade } : { x: 0, y: 0 };
      player.mountainGrade = grade;
      player.onMountainTrail = trail;
      if (player.tumble) {
        const t = player.tumble;
        t.time += deltaSeconds;
        t.vx -= slope.x * 900 * deltaSeconds;
        t.vy -= slope.y * 900 * deltaSeconds;
        const drag = Math.exp(-1.5 * deltaSeconds);
        t.vx *= drag;
        t.vy *= drag;
        const speed = Math.hypot(t.vx, t.vy);
        t.peak = Math.max(t.peak, speed);
        player.a = speed > 4 ? Math.atan2(t.vy, t.vx) : player.a;
        player.tumbleRoll = (player.tumbleRoll || 0) + speed * deltaSeconds * 0.05;
        const blocked = moveBody(player, t.vx * deltaSeconds, t.vy * deltaSeconds, 8);
        t.hurtClock -= deltaSeconds;
        if (t.hurtClock <= 0 && speed > 120) {
          t.hurtClock = 0.8;
          hurt(3 + speed * 0.022, 'impact');
          particle(player.x, player.y, '#a59a7e', 5, 60, 3);
        }
        if (blocked && speed > 220) hurt(speed * 0.03, 'impact');
        if ((grade < 0.3 && speed < 55) || t.time > 14 || (blocked && speed < 90)) endTumble();
        return true;
      }
      const right = keys.KeyD || keys.ArrowRight,
        left = keys.KeyA || keys.ArrowLeft,
        back = keys.KeyS || keys.ArrowDown,
        forward = keys.KeyW || keys.ArrowUp,
        ix = (right ? 1 : 0) - (left ? 1 : 0),
        iy = (back ? 1 : 0) - (forward ? 1 : 0);
      if (!trail && grade > TUMBLE_GRADE) {
        const heading = ix || iy ? Math.atan2(iy, ix) : null,
          intoDescent =
            heading !== null && Math.cos(heading) * downhill.x + Math.sin(heading) * downhill.y > 0.3;
        if (intoDescent || grade > UNCLIMBABLE_GRADE + 0.12) {
          startTumble(downhill, grade);
          return true;
        }
      }
      if (!ix && !iy) {
        // Standing on a loose face still costs ground.
        if (!trail && grade > SLIP_GRADE)
          moveBody(
            player,
            downhill.x * (grade - SLIP_GRADE) * 130 * deltaSeconds,
            downhill.y * (grade - SLIP_GRADE) * 130 * deltaSeconds,
            8,
          );
        return true;
      }
      const a = Math.atan2(iy, ix),
        climb = Math.cos(a) * slope.x + Math.sin(a) * slope.y;
      let speed = keys.ShiftLeft || keys.ShiftRight ? 158 : 100;
      if (trail) {
        // A graded path: steady going, uphill a little slower than down.
        speed *= clamp(1 - Math.max(0, climb) * TRAIL_GRADE * 2.2, 0.46, 1);
      } else {
        if (climb > 0.02) {
          if (grade > UNCLIMBABLE_GRADE) {
            if (gameTime - (player.climbTold || -10) > 4) {
              player.climbTold = gameTime;
              tell('Too steep to climb here. Find the trail.', 2.6);
            }
            speed = 0;
          } else speed *= clamp(1 - Math.max(0, grade - SLIP_GRADE) * 3.1, 0, 1);
        } else speed *= clamp(1 - grade * 0.45, 0.4, 1);
        if (grade > SLIP_GRADE) {
          moveBody(
            player,
            downhill.x * (grade - SLIP_GRADE) * 150 * deltaSeconds,
            downhill.y * (grade - SLIP_GRADE) * 150 * deltaSeconds,
            8,
          );
        }
      }
      player.a = a;
      if (speed > 0) {
        player.walk += deltaSeconds * (keys.ShiftLeft ? 15 : 10) * clamp(speed / 100, 0.3, 1.6);
        moveBody(
          player,
          (ix / Math.hypot(ix, iy)) * speed * deltaSeconds,
          (iy / Math.hypot(ix, iy)) * speed * deltaSeconds,
          8,
        );
      }
      return true;
    }
    function paintMountainTrails(g) {
      for (const t of MOUNTAIN_TRAILS) {
        strokeRoad(g, t.points, t.width + 8, '#71674c');
        strokeRoad(g, t.points, t.width, '#b29a73');
        g.setLineDash([9, 13]);
        strokeRoad(g, t.points, 1.5, '#786b50');
        g.setLineDash([]);
      }
    }
    function snowAmount(peak, x, y, height, slope = 0) {
      if (peak.h < 600) return 0;
      const drift = Math.sin(x * 0.018 + y * 0.011) * 0.025 + Math.sin(y * 0.034 - x * 0.006) * 0.025;
      return clamp((height / peak.h - 0.56 - drift) / 0.17, 0, 1) * clamp(1 - slope * 0.85, 0.24, 1);
    }
    function paintMountainTexture(drawingContext, peak, size = 1024) {
      const rx = peak.rx || peak.r,
        ry = peak.ry || peak.r;
      drawingContext.fillStyle = '#b8bca6';
      drawingContext.fillRect(0, 0, size, size);
      let randomSeed = Math.round(peak.x * 13 + peak.y * 7);
      const random = () => {
        randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
        return randomSeed / 4294967296;
      };
      for (let y = 0; y < size; y += 8)
        for (let x = 0; x < size; x += 8) {
          const wx = peak.x - rx + (x / size) * rx * 2,
            wy = peak.y - ry + (y / size) * ry * 2,
            s = snowAmount(peak, wx, wy, terrainHeight(wx, wy));
          if (s > 0.01) {
            drawingContext.fillStyle = 'rgba(240,247,248,' + s + ')';
            drawingContext.fillRect(x, y, 9, 9);
          }
        }
      // Fine rock grain and broken strata prevent smooth hills from looking like molded cones.
      for (let i = 0; i < 8000; i++) {
        const x = random() * size,
          y = random() * size;
        drawingContext.fillStyle = i % 3 ? '#edf0d319' : '#24332824';
        drawingContext.fillRect(x, y, 1 + random() * 5, 0.6 + random() * 2);
      }
      drawingContext.save();
      drawingContext.scale(size / (rx * 2), size / (ry * 2));
      drawingContext.translate(rx - peak.x, ry - peak.y);
      for (let i = 0; i < 95; i++) {
        const a = random() * TAU,
          r = 0.2 + random() * 0.7,
          x = peak.x + Math.cos(a) * rx * r,
          y = peak.y + Math.sin(a) * ry * r;
        drawingContext.strokeStyle = i % 2 ? '#e4dfc329' : '#34463b35';
        drawingContext.lineWidth = 1.3 + random() * 3;
        drawingContext.beginPath();
        drawingContext.moveTo(x, y);
        drawingContext.lineTo(x + 8 + random() * 32, y - 6 - random() * 20);
        drawingContext.stroke();
      }
      for (const t of MOUNTAIN_TRAILS)
        if (t.peak === peak) {
          strokeRoad(drawingContext, t.points, t.width + 5, '#726c4f');
          strokeRoad(drawingContext, t.points, t.width, '#c2a67e');
          for (const side of [-1, 1]) {
            const points = t.points.map((p, i) => {
              const q = t.points[Math.min(i + 1, t.points.length - 1)],
                r = i ? q : t.points[1],
                a =
                  i === t.points.length - 1
                    ? Math.atan2(p[1] - t.points[i - 1][1], p[0] - t.points[i - 1][0])
                    : Math.atan2(r[1] - p[1], r[0] - p[0]);
              return [p[0] - Math.sin(a) * side * 7, p[1] + Math.cos(a) * side * 7];
            });
            strokeRoad(drawingContext, points, 2.5, '#907b5b66');
          }
        }
      drawingContext.restore();
    }
    const mountainGroundCache = new Map();
    function paintMountainGround(drawingContext) {
      for (const peak of COUNTY_PEAKS) {
        const surface = mountainSurface(peak),
          { rx, ry, positions, indices } = surface;
        let canvas = mountainGroundCache.get(peak);
        if (!canvas) {
          // Rasterized straight into pixels: filling tens of thousands of tiny
          // canvas paths one by one took minutes on software-rendered canvases.
          const size = 768,
            sx = size / (rx * 2),
            sy = size / (ry * 2);
          canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          const c = canvas.getContext('2d'),
            image = c.createImageData(size, size),
            pixels = image.data;
          for (let j = 0; j < indices.length; j += 3) {
            const a = indices[j] * 3,
              b = indices[j + 1] * 3,
              d = indices[j + 2] * 3,
              ux = positions[b] - positions[a],
              uy = positions[b + 1] - positions[a + 1],
              uz = positions[b + 2] - positions[a + 2],
              vx = positions[d] - positions[a],
              vy = positions[d + 1] - positions[a + 1],
              vz = positions[d + 2] - positions[a + 2],
              nx = uy * vz - uz * vy,
              ny = uz * vx - ux * vz,
              nz = ux * vy - uy * vx,
              n = Math.hypot(nx, ny, nz) || 1;
            const elevation = (positions[a + 1] + positions[b + 1] + positions[d + 1]) / (3 * peak.h),
              slope = 1 - Math.abs(ny / n),
              stone = clamp(slope * 1.5 + (elevation - 0.35) * 0.8, 0, 1),
              mottle =
                Math.sin((positions[a] + peak.x) * 0.027 + (positions[a + 2] + peak.y) * 0.011) * 4 +
                Math.sin((positions[a] + peak.x) * 0.061 - (positions[a + 2] + peak.y) * 0.039) * 3,
              shade = clamp(
                0.86 + ((nx / n) * -0.4 + Math.abs(ny / n) * 0.8 + (nz / n) * -0.3) * 0.22,
                0.6,
                1.1,
              );
            const snow = snowAmount(
              peak,
              positions[a] + peak.x,
              positions[a + 2] + peak.y,
              elevation * peak.h,
              slope,
            );
            const base = [81 + stone * 87, 107 + stone * 60, 72 + stone * 82],
              rgb = [0, 1, 2].map((k) =>
                Math.round(clamp(((base[k] + mottle) * (1 - snow) + [222, 237, 242][k] * snow) * shade, 0, 255)),
              );
            // Triangle corners in pixel space, then a bounding-box scan with edge
            // functions. The half-pixel slack closes hairline seams between faces.
            const x0 = (positions[a] + rx) * sx,
              y0 = (positions[a + 2] + ry) * sy,
              x1 = (positions[b] + rx) * sx,
              y1 = (positions[b + 2] + ry) * sy,
              x2 = (positions[d] + rx) * sx,
              y2 = (positions[d + 2] + ry) * sy,
              area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
            if (Math.abs(area) < 1e-9) continue;
            const sign = area > 0 ? 1 : -1,
              slack = 0.5 * Math.hypot(1, 1),
              e0 = Math.hypot(x2 - x1, y2 - y1) * slack,
              e1 = Math.hypot(x0 - x2, y0 - y2) * slack,
              e2 = Math.hypot(x1 - x0, y1 - y0) * slack,
              minX = Math.max(0, Math.floor(Math.min(x0, x1, x2) - 1)),
              maxX = Math.min(size - 1, Math.ceil(Math.max(x0, x1, x2) + 1)),
              minY = Math.max(0, Math.floor(Math.min(y0, y1, y2) - 1)),
              maxY = Math.min(size - 1, Math.ceil(Math.max(y0, y1, y2) + 1));
            for (let py = minY; py <= maxY; py++)
              for (let px = minX; px <= maxX; px++) {
                const cx = px + 0.5,
                  cy = py + 0.5,
                  w0 = sign * ((x2 - x1) * (cy - y1) - (y2 - y1) * (cx - x1)),
                  w1 = sign * ((x0 - x2) * (cy - y2) - (y0 - y2) * (cx - x2)),
                  w2 = sign * ((x1 - x0) * (cy - y0) - (y1 - y0) * (cx - x0));
                if (w0 < -e0 || w1 < -e1 || w2 < -e2) continue;
                const o = (py * size + px) * 4;
                pixels[o] = rgb[0];
                pixels[o + 1] = rgb[1];
                pixels[o + 2] = rgb[2];
                pixels[o + 3] = 255;
              }
          }
          c.putImageData(image, 0, 0);
          mountainGroundCache.set(peak, canvas);
        }
        drawingContext.drawImage(canvas, peak.x - rx, peak.y - ry, rx * 2, ry * 2);
      }
    }
    const MOUNTAIN_OUTCROPS = [
      {
        x: 8400,
        y: 1100,
        w: 34,
        h: 30,
        rise: 25,
      },
      {
        x: 7500,
        y: 750,
        w: 38,
        h: 30,
        rise: 31,
      },
      {
        x: 7090,
        y: 1250,
        w: 30,
        h: 34,
        rise: 23,
      },
      {
        x: 10200,
        y: 1450,
        w: 34,
        h: 30,
        rise: 28,
      },
    ];
    for (const rock of MOUNTAIN_OUTCROPS)
      countyStaticSolids.push({
        x: rock.x - rock.w / 2,
        y: rock.y - rock.h / 2,
        w: rock.w,
        h: rock.h,
        height: terrainHeight(rock.x, rock.y) + rock.rise,
        kind: 'rock',
      });
    function paintServiceForecourts(drawingContext, cityOnly = false) {
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      for (const r of SERVICE_ROADS)
        if (!cityOnly || r.name.startsWith('SOUTHPORT '))
          strokeRoad(drawingContext, r.points, r.width, '#606664');
      for (const p of PLACES) {
        if (
          !/^(county-|southport-|sentinel-|keys-guns)/.test(p.id) ||
          (cityOnly && (p.x >= CITY_SIZE || p.y >= CITY_SIZE))
        )
          continue;
        const y = p.y + p.h;
        drawingContext.fillStyle = '#a6a597';
        drawingContext.fillRect(p.x - 9, y + 1, p.w + 18, 13);
        drawingContext.fillStyle = '#666d65';
        drawingContext.fillRect(p.x - 9, y + 14, p.w + 18, 36);
        drawingContext.strokeStyle = '#d6d2bb';
        drawingContext.lineWidth = 1.4;
        for (let x = p.x + 12; x < p.x + p.w - 15; x += 31) {
          if (Math.abs(x - p.door.x) < 24) continue;
          drawingContext.beginPath();
          drawingContext.moveTo(x, y + 22);
          drawingContext.lineTo(x, y + 45);
          drawingContext.stroke();
        }
        drawingContext.fillStyle = '#c7c0a7';
        drawingContext.fillRect(p.door.x - 11, y + 1, 22, 32);
        drawingContext.fillStyle = '#e8dfc3';
        drawingContext.font = 'bold 8px Arial';
        drawingContext.textAlign = 'center';
        drawingContext.fillText(
          p.kind === 'guns' ? 'OUTFITTERS' : 'GUEST PARKING',
          p.x + p.w / 2,
          y + 48,
        );
      }
      drawingContext.restore();
    }
    function installCountyServices() {
      const add = (id, kind, name, b, door) => {
        if (PLACES.some((p) => p.id === id)) return;
        let building = buildings.find((o) => o.x === b.x && o.y === b.y);
        if (!building) {
          makeBuilding(b.x, b.y, b.w, b.h, 0, true);
          building = buildings.at(-1);
        }
        Object.assign(building, {
          place: id,
          county: building.county || b.x > CITY_SIZE || b.y > CITY_SIZE,
          height: building.height || 35,
        });
        PLACES.push({
          ...b,
          id,
          kind,
          name,
          height: building.height,
          door,
          color: kind === 'guns' ? '#d6ba80' : '#95d2cb',
          symbol: kind === 'guns' ? 'GUN' : 'ZZ',
        });
      };
      for (const [i, t] of COUNTY_TOWNS.entries()) {
        add(
          'county-guns-' + i,
          'guns',
          t.name + ' OUTFITTERS',
          {
            x: t.x + 82,
            y: t.y + 82,
            w: 132,
            h: 125,
          },
          {
            x: t.x + 148,
            y: t.y + 229,
          },
        );
        add(
          'county-sleep-' + i,
          'sleep',
          t.name + ' LODGE',
          {
            x: t.x + 295,
            y: t.y + 82,
            w: 130,
            h: 122,
          },
          {
            x: t.x + 360,
            y: t.y + 226,
          },
        );
      }
      add(
        'keys-guns',
        'guns',
        'PALM KEYS ARMORY',
        {
          x: 4853,
          y: 1271,
          w: 262,
          h: 108,
        },
        {
          x: 4984,
          y: 1401,
        },
      );
      add(
        'sentinel-guns',
        'guns',
        'SENTINEL SURPLUS',
        {
          x: 9000,
          y: 7880,
          w: 160,
          h: 110,
        },
        {
          x: 9080,
          y: 8012,
        },
      );
      add(
        'sentinel-sleep',
        'sleep',
        'CAUSEWAY INN',
        {
          x: 8990,
          y: 8260,
          w: 175,
          h: 110,
        },
        {
          x: 9077.5,
          y: 8392,
        },
      );
      add(
        'southport-guns',
        'guns',
        'SOUTH BANK OUTFITTERS',
        {
          x: 1760,
          y: 4492,
          w: 155,
          h: 143,
        },
        {
          x: 1837.5,
          y: 4657,
        },
      );
      add(
        'southport-sleep',
        'sleep',
        'SOUTHPORT LODGE',
        {
          x: 780,
          y: 4330,
          w: 160,
          h: 100,
        },
        {
          x: 860,
          y: 4452,
        },
      );
    }
    function spawnTrailVehicles() {
      for (const t of MOUNTAIN_TRAILS) {
        const [x, y] = t.points[0],
          p = findStreetPoint(x + 65, y, 20);
        if (canSpawnCar('suv', p.x, p.y, headingBetween(p, t.peak), 8))
          makeCar('suv', p.x, p.y, headingBetween(p, t.peak), false, '#bc9762');
      }
    }
    const SERVICE_ROADS = [
      {
        name: 'SOUTHPORT SHOPS',
        width: 36,
        points: [
          [1837.5, 4666],
          [1837.5, 4736],
        ],
      },
      {
        name: 'SOUTHPORT LODGE ACCESS',
        width: 48,
        points: [
          [1000, 4560],
          [860, 4560],
          [860, 4452],
        ],
      },
      {
        name: 'CAUSEWAY INN ACCESS',
        width: 42,
        points: [
          [9200, 8150],
          [9200, 8392],
          [9077.5, 8392],
        ],
      },
    ];
    for (const town of COUNTY_TOWNS)
      SERVICE_ROADS.push({
        name: town.name + ' MARKET STREET',
        width: 36,
        points: [
          [town.x, town.y + 240],
          [town.x + BLOCK_SIZE, town.y + 240],
        ],
      });
    // END SUBSYSTEM: src/terrain.js
