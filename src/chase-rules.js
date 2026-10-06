    // Chase rules: what the player can see in the chase view, for the game's rules (who may fire, spawning and
    // recycling out of sight, the HUD's player box, the aim): the sight and fire reaches, the frustum test on the
    // ground, the building march, the streams' lean toward the camera's heading and the reticle's aim.
    /**
     * CHASE RULES
     * The street view's rules ask a box round `cameraTarget` (the overhead camera's ground footprint:
     * crowdInView, screenViewHalf). In the chase view (chase-camera.js) the camera stands behind the player
     * at street level and sees a wedge of ground far down the street, so while chaseCameraLive() those rules
     * ask the chase camera's pinhole instead, through the helpers here; with the street view on nothing here
     * runs and the street rules give exactly what they always gave.
     *  - IN VIEW (crowdInView, beachInView, the wreck rule): inside the frustum, the caller's margin taken as a
     *    world radius round a point CHASE_BODY_LIFT over the ground (plus CHASE_BODY_RADIUS for the body), no
     *    deeper than CHASE_SIGHT_REACH from the camera (the haze closes over what lies beyond). Behind the
     *    camera, outside the frustum or beyond the reach is unseen. Asked per entity and per frame: no march.
     *    Before the camera has placed itself (a teleport, a switch of view) everything within the reach of the
     *    player counts as seen.
     *  - SPAWN SPOTS (spotUnseen): off the frustum turned out by CHASE_SPAWN_TURN either side (the camera turns
     *    as fast as the mouse moves: a fresh spawn must not show the next frame), or hidden: a building hides it
     *    from everywhere the camera can swing to, by one march through the building grid (with heights) from
     *    the pivot the camera turns about, the buildings shrunk by the thing's radius plus the boom and their
     *    roofs lowered by the boom, so neither the camera's swing nor the thing's own size shows it.
     *  - FIRE (shooterInView): the shooter's chest inside the frustum (with the caller's inset in px), no deeper
     *    than CHASE_FIRE_REACH, and not hidden from the camera itself behind a building.
     *  - LEAN (chaseStreamCentre): the crowd and the traffic are counted and spawned round a centre leaned
     *    toward the camera's heading, so the street ahead fills and spawn spots beyond the sight reach lie on it.
     *  - AIM: the reticle (or the cursor while the pointer is free: CURSOR LOOK) is the aim for every input
     *    device; chaseAim() is chaseAimHeading() kept for the simulation step.
     */
    const CHASE_SIGHT_REACH = 200 * UNITS_PER_METRE,
      CHASE_FIRE_REACH = 150 * UNITS_PER_METRE,
      // Wrecks are big and burn: they count as seen twice as deep.
      CHASE_WRECK_REACH = 2 * CHASE_SIGHT_REACH,
      CHASE_BODY_LIFT = 1 * UNITS_PER_METRE,
      CHASE_BODY_RADIUS = 1.2 * UNITS_PER_METRE,
      // How far the camera may turn between a spawn and the next frame (radians either side): spawn checks
      // widen the frustum by it (a fast flick of the mouse, about 600 degrees a second at 30 steps a second).
      CHASE_SPAWN_TURN = 0.35,
      // The share of each stream's ring its centre leans toward the camera's heading.
      CHASE_CROWD_LEAN = 0.4,
      CHASE_TRAFFIC_LEAN = 0.7,
      // The player's box for the HUD on foot: half the shoulders' width (arms out with a gun).
      CHASE_PERSON_HALF = 0.4 * UNITS_PER_METRE,
      // The soft lock's reach on screen round the aim point (CSS px), as the street view's mouse aim.
      CHASE_LOCK_PX = 38;
    /* What a spawn spot must hide, by kind: a radius round the spot and a height over the ground (spotUnseen). */
    const SPOT_PERSON = { r: 1.5 * UNITS_PER_METRE, top: 2.1 * UNITS_PER_METRE },
      SPOT_CAR = { r: 3.5 * UNITS_PER_METRE, top: 4 * UNITS_PER_METRE },
      SPOT_AMBULANCE = { r: 4 * UNITS_PER_METRE, top: 3.4 * UNITS_PER_METRE };
    /* The lens's axes (chaseFrame, chase-camera.js) and the frustum's sides for the sphere tests, kept (as a
       copy) while the heading, the pitch, the lens and the screen stay as they were. */
    const chaseView = { yaw: NaN, pitch: NaN, fov: NaN, w: -1, h: -1, fx: 1, fy: 0, fz: 0, rx: 0, ry: 1, ux: 0, uy: 0, uz: 1, tan: 0.5, tanH: 0, tanV: 0, slackH: 0, slackV: 0, tanSpawn: 0, slackSpawn: 0 };
    function chaseViewSides() {
      const v = chaseView,
        yaw = chaseCam.viewYaw ?? chaseCam.yaw,
        pitch = chaseCam.viewPitch ?? chaseCam.pitch;
      if (yaw !== v.yaw || pitch !== v.pitch || chaseCam.fov !== v.fov || viewportWidth !== v.w || viewportHeight !== v.h) {
        // The same numbers as chaseSees (chase-camera.js) with no inset, so the answers are the same.
        const b = chaseFrame(),
          half = viewportHeight / 2;
        v.fx = b.fx;
        v.fy = b.fy;
        v.fz = b.fz;
        v.rx = b.rx;
        v.ry = b.ry;
        v.ux = b.ux;
        v.uy = b.uy;
        v.uz = b.uz;
        v.tan = b.tan;
        v.tanV = b.tan * (1 - 0 / half);
        v.tanH = b.tan * ((viewportWidth / 2 - 0) / half);
        v.slackH = Math.hypot(1, v.tanH);
        v.slackV = Math.hypot(1, v.tanV);
        // The spawn frustum: as wide again as a quick turn of the camera (CHASE_SPAWN_TURN either side).
        v.tanSpawn = Math.tan(Math.min(1.45, Math.atan(v.tanH) + CHASE_SPAWN_TURN));
        v.slackSpawn = Math.hypot(1, v.tanSpawn);
        v.yaw = yaw;
        v.pitch = pitch;
        v.fov = chaseCam.fov;
        v.w = viewportWidth;
        v.h = viewportHeight;
      }
      return v;
    }
    /* chaseSees(x, y, z, r, 0, reach) without working out the lens again: the per-entity test. */
    function chaseFrustumHas(x, y, z, r, reach) {
      const v = chaseViewSides(),
        dx = x - chaseCam.x,
        dy = y - chaseCam.y,
        dz = z - chaseCam.z,
        depth = dx * v.fx + dy * v.fy + dz * v.fz;
      if (depth < CHASE_NEAR - r || depth > reach + r) return false;
      const across = dx * v.rx + dy * v.ry,
        up = dx * v.ux + dy * v.uy + dz * v.uz;
      return Math.abs(across) <= depth * v.tanH + r * v.slackH && Math.abs(up) <= depth * v.tanV + r * v.slackV;
    }
    /* chaseFrustumHas with the sides turned out by CHASE_SPAWN_TURN (spotUnseen: the camera may turn that far
       between a spawn and the next frame; the reach is the same, and turning toward a point only deepens it). */
    function chaseSpawnFrustumHas(x, y, z, r, reach) {
      const v = chaseViewSides(),
        dx = x - chaseCam.x,
        dy = y - chaseCam.y,
        dz = z - chaseCam.z,
        depth = dx * v.fx + dy * v.fy + dz * v.fz;
      if (depth < CHASE_NEAR - r || depth > reach + r) return false;
      const across = dx * v.rx + dy * v.ry,
        up = dx * v.ux + dy * v.uy + dz * v.uz;
      return Math.abs(across) <= depth * v.tanSpawn + r * v.slackSpawn && Math.abs(up) <= depth * v.tanV + r * v.slackV;
    }
    /* In the chase view: whether something standing on the ground at map (x, y) is on screen or about to be:
       `margin` a world radius (negative: well inside), `reach` how deep the view counts (crowdInView). */
    function chaseInView(x, y, margin = 0, reach = CHASE_SIGHT_REACH) {
      if (!chaseCam.ready) return hypot2(x - player.x, y - player.y) < reach + margin;
      return chaseFrustumHas(x, y, terrainHeight(x, y) + CHASE_BODY_LIFT, margin + CHASE_BODY_RADIUS, reach);
    }
    /**
     * Whether a building stands between (ax, ay, az) and (x, y, z): the segment marched through the building
     * grid's cells (BUILDING_CELL, game-collision.js) and tested against each footprint shrunk by `shrink`,
     * below its roof less `lower`. A building the start stands in (a camera pulled against a wall, a roof under
     * it) does not hide anything.
     */
    function chaseHiddenFrom(ax, ay, az, x, y, z, shrink = 0, lower = 0) {
      if (!buildingGrid.size) return false;
      const C = BUILDING_CELL,
        dx = x - ax,
        dy = y - ay,
        dz = z - az,
        i1 = Math.floor(x / C),
        j1 = Math.floor(y / C),
        si = dx > 0 ? 1 : -1,
        sj = dy > 0 ? 1 : -1,
        ti = dx !== 0 ? C / Math.abs(dx) : Infinity,
        tj = dy !== 0 ? C / Math.abs(dy) : Infinity;
      let i = Math.floor(ax / C),
        j = Math.floor(ay / C),
        ni = dx !== 0 ? ((dx > 0 ? i + 1 : i) * C - ax) / dx : Infinity,
        nj = dy !== 0 ? ((dy > 0 ? j + 1 : j) * C - ay) / dy : Infinity;
      for (let n = Math.abs(i1 - i) + Math.abs(j1 - j); n >= 0; n--) {
        if (chaseCellBlocks(i, j, ax, ay, az, dx, dy, dz, shrink, lower)) return true;
        if (n === 0) break;
        if (ni < nj) {
          ni += ti;
          i += si;
        } else {
          nj += tj;
          j += sj;
        }
      }
      // (A tie in the rounding can end the walk a cell aside: the end's own cell is always asked.)
      return (i !== i1 || j !== j1) && chaseCellBlocks(i1, j1, ax, ay, az, dx, dy, dz, shrink, lower);
    }
    function chaseCellBlocks(i, j, ax, ay, az, dx, dy, dz, shrink, lower) {
      const cell = buildingGrid.get(i * 4096 + j);
      if (cell) for (let k = 0; k < cell.length; k++) if (chaseBlockedBy(cell[k], ax, ay, az, dx, dy, dz, shrink, lower)) return true;
      return false;
    }
    /* One building against the segment from (ax, ay, az) along (dx, dy, dz) (chaseHiddenFrom): a slab test. */
    function chaseBlockedBy(b, ax, ay, az, dx, dy, dz, shrink, lower) {
      const roof = b.height || 0;
      if (!(roof > 0)) return false;
      // The start inside it: not a wall between.
      if (ax > b.x && ax < b.x + b.w && ay > b.y && ay < b.y + b.h && az < roof) return false;
      const x0 = b.x + shrink,
        x1 = b.x + b.w - shrink,
        y0 = b.y + shrink,
        y1 = b.y + b.h - shrink,
        top = roof - lower;
      if (x0 >= x1 || y0 >= y1 || !(top > 0)) return false;
      let lo = 0,
        hi = 1;
      if (dx === 0) {
        if (ax <= x0 || ax >= x1) return false;
      } else {
        let t0 = (x0 - ax) / dx,
          t1 = (x1 - ax) / dx;
        if (t0 > t1) {
          const s = t0;
          t0 = t1;
          t1 = s;
        }
        if (t0 > lo) lo = t0;
        if (t1 < hi) hi = t1;
        if (lo >= hi) return false;
      }
      if (dy === 0) {
        if (ay <= y0 || ay >= y1) return false;
      } else {
        let t0 = (y0 - ay) / dy,
          t1 = (y1 - ay) / dy;
        if (t0 > t1) {
          const s = t0;
          t0 = t1;
          t1 = s;
        }
        if (t0 > lo) lo = t0;
        if (t1 < hi) hi = t1;
        if (lo >= hi) return false;
      }
      // Below the roof: z(t) = az + dz t < top.
      if (dz === 0) return az < top;
      const t = (top - az) / dz;
      if (dz > 0) {
        if (t < hi) hi = t;
      } else if (t > lo) lo = t;
      return lo < hi;
    }
    /**
     * A spawn spot nobody can see: off screen (crowdInView with `margin`); in the chase view off the frustum
     * turned out by CHASE_SPAWN_TURN either side (a flick of the mouse cannot show it the next frame), or hidden
     * behind a building from everywhere the camera can swing to (CHASE RULES, HIDDEN). `spot` is what must hide
     * there (SPOT_PERSON, SPOT_CAR, SPOT_AMBULANCE). In the street view this is exactly !crowdInView(x, y, margin).
     */
    function spotUnseen(x, y, margin = 0, spot = SPOT_PERSON) {
      if (!chaseCameraLive()) return !crowdInView(x, y, margin);
      if (!chaseCam.ready) return !chaseInView(x, y, margin);
      const ground = terrainHeight(x, y);
      if (!chaseSpawnFrustumHas(x, y, ground + CHASE_BODY_LIFT, margin + CHASE_BODY_RADIUS, CHASE_SIGHT_REACH)) return true;
      const sx = chaseCam.x - chaseCam.px,
        sy = chaseCam.y - chaseCam.py,
        sz = chaseCam.z - chaseCam.pz,
        swing = Math.sqrt(sx * sx + sy * sy + sz * sz);
      return chaseHiddenFrom(chaseCam.px, chaseCam.py, chaseCam.pz, x, y, ground + spot.top, spot.r + swing, swing);
    }
    /* shooterInView in the chase view: the chest on screen, near enough, and not behind a building. */
    function chaseShooterInView(shooter, inset) {
      if (!chaseCam.ready) return false;
      const z = chaseChestHeight(shooter);
      if (!chaseSees(shooter.x, shooter.y, z, 0, inset, CHASE_FIRE_REACH)) return false;
      return !chaseHiddenFrom(chaseCam.x, chaseCam.y, chaseCam.z, shooter.x, shooter.y, z);
    }
    /* Where a shooter's gun is: a person's chest, a vehicle's turret or window. */
    function chaseChestHeight(e) {
      const ground = entityElevation(e);
      return e.type && vehicleSpec(e) ? ground + vehicleCollisionHeight(e) * 0.6 : ground + PERSON_HEIGHT * 0.72;
    }
    /* The centre a stream (crowd, traffic) counts and spawns round in the chase view: the player, leaned `lean`
       units toward the camera's heading (crowd-streaming.js, livingcity-traffic.js), into `out`. */
    function chaseStreamCentre(out, lean) {
      out.x = player.x;
      out.y = player.y;
      if (chaseCam.ready) {
        const yaw = chaseCam.viewYaw ?? chaseCam.yaw;
        out.x += Math.cos(yaw) * lean;
        out.y += Math.sin(yaw) * lean;
      }
      return out;
    }
    /* ---- Aim ------------------------------------------------------------------------------- */
    /* The screen point the aim goes through: the reticle, or the cursor while the pointer is not captured and
       the mouse is in use (CURSOR LOOK: the same choice as chaseAimHeading). */
    const chaseAimAt = { x: 0, y: 0 };
    function chaseAimScreen() {
      if (chaseCam.locked || !mouse.active) {
        chaseAimAt.x = viewportWidth * CHASE_RETICLE.x;
        chaseAimAt.y = viewportHeight * CHASE_RETICLE.y;
      } else {
        chaseAimAt.x = mouse.x;
        chaseAimAt.y = mouse.y;
      }
      return chaseAimAt;
    }
    /* chaseAimHeading(from), worked out once a simulation step (aim() is asked by the footwork, the police's
       aim at the player's pace, the drive-by and more): kept while nothing it reads has moved. */
    const chaseAimMemo = { at: NaN, from: null, fx: NaN, fy: NaN, cx: NaN, cy: NaN, cz: NaN, yaw: NaN, pitch: NaN, fov: NaN, mx: NaN, my: NaN, how: -1, w: -1, h: -1, a: 0 };
    function chaseAim(from = player.car || player) {
      if (!chaseCam.ready) return from.a ?? player.a;
      const m = chaseAimMemo,
        how = (chaseCam.locked ? 1 : 0) + (mouse.active ? 2 : 0);
      if (
        m.at !== gameTime ||
        m.from !== from ||
        m.fx !== from.x ||
        m.fy !== from.y ||
        m.cx !== chaseCam.x ||
        m.cy !== chaseCam.y ||
        m.cz !== chaseCam.z ||
        m.yaw !== chaseCam.viewYaw ||
        m.pitch !== chaseCam.viewPitch ||
        m.fov !== chaseCam.fov ||
        m.mx !== mouse.x ||
        m.my !== mouse.y ||
        m.how !== how ||
        m.w !== viewportWidth ||
        m.h !== viewportHeight
      ) {
        m.a = chaseAimHeading(from);
        m.at = gameTime;
        m.from = from;
        m.fx = from.x;
        m.fy = from.y;
        m.cx = chaseCam.x;
        m.cy = chaseCam.y;
        m.cz = chaseCam.z;
        m.yaw = chaseCam.viewYaw;
        m.pitch = chaseCam.viewPitch;
        m.fov = chaseCam.fov;
        m.mx = mouse.x;
        m.my = mouse.y;
        m.how = how;
        m.w = viewportWidth;
        m.h = viewportHeight;
      }
      return m.a;
    }
    /* The map point under the aim on a level plane at `elevation` (the Apache's and the door guns' aim, the
       volleyball's hit), into `out`; null when the ray never comes down to it. */
    const chaseGroundRay = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0 },
      chaseGroundOut = { x: 0, y: 0 };
    function chaseGroundPoint(elevation, out = chaseGroundOut) {
      if (!chaseCam.ready) return null;
      const s = chaseAimScreen(),
        r = chaseRay(s.x, s.y, chaseGroundRay);
      if (!(r.dz < -1e-4)) return null;
      const t = (elevation - r.oz) / r.dz;
      if (!(t > 0)) return null;
      out.x = r.ox + r.dx * t;
      out.y = r.oy + r.dy * t;
      return out;
    }
    /* How far a ground vehicle's gun is laid: to the point under the reticle (the tank's and the mounted guns'
       reticle range), 60..900 units. */
    function chaseAimRange(c) {
      const s = chaseAimScreen(),
        p = chaseAimPoint(undefined, s.x, s.y);
      return clamp(Math.hypot(p.x - c.x, p.y - c.y), 60, 900);
    }
    /* The soft lock in the chase view (playerShotTarget): whoever is within CHASE_LOCK_PX of the aim point on
       screen, nearest it first, in reach (440 units) and in sight; the same lists as the street view's mouse aim. */
    const chaseLockAt = { x: 0, y: 0, depth: 0, behind: false },
      chaseLock = { best: 0, target: null, sx: 0, sy: 0 };
    function chaseShotTarget() {
      const s = chaseAimScreen(),
        L = chaseLock;
      L.best = CHASE_LOCK_PX;
      L.target = null;
      L.sx = s.x;
      L.sy = s.y;
      for (let i = 0; i < wildlife.length; i++) chaseLockTry(wildlife[i]);
      for (let i = 0; i < enemies.length; i++) chaseLockTry(enemies[i]);
      for (let i = 0; i < gangMembers.length; i++) chaseLockTry(gangMembers[i]);
      for (let i = 0; i < officers.length; i++) chaseLockTry(officers[i]);
      for (let i = 0; i < vehicles.length; i++) if (vehicles[i].cop || vehicles[i].airUnit) chaseLockTry(vehicles[i]);
      for (let i = 0; i < pedestrians.length; i++) chaseLockTry(pedestrians[i]);
      return L.target;
    }
    function chaseLockTry(p) {
      if (p.hp <= 0 || p === player.car || combatDistance(player, p) > 440) return;
      const q = chaseProject(p.x, p.y, entityElevation(p) + 10, chaseLockAt);
      if (q.behind) return;
      const score = hypot2(q.x - chaseLock.sx, q.y - chaseLock.sy);
      if (score > chaseLock.best || (score === chaseLock.best && chaseLock.target) || !clearSight(player, p)) return;
      chaseLock.best = score;
      chaseLock.target = p;
    }
    /* ---- HUD -------------------------------------------------------------------------------- */
    /* hudPlayerBox in the chase view: the corners of the player's (or their vehicle's) box through the chase
       camera, in CSS px; a corner behind the near plane counts as on it. */
    const chaseBoxAt = { x: 0, y: 0 };
    function chasePlayerBox(out) {
      out.ok = false;
      if (!chaseCam.ready) return out;
      const c = player.car,
        body = c || player;
      if (!(Number.isFinite(body.x) && Number.isFinite(body.y))) return out;
      let half, side, a, z0, tall;
      if (c) {
        const spec = vehicleSpec(c);
        half = spec.l / 2;
        side = spec.w / 2;
        a = c.a;
        z0 = isBoat(c) ? Math.max(0, entityElevation(c)) : entityElevation(c);
        tall = vehicleCollisionHeight(c);
      } else {
        half = side = CHASE_PERSON_HALF;
        a = player.a || 0;
        z0 = entityElevation(player);
        tall = PERSON_HEIGHT;
      }
      const ca = Math.cos(a),
        sa = Math.sin(a);
      let l = Infinity,
        t = Infinity,
        r = -Infinity,
        bottom = -Infinity;
      for (let k = 0; k < 8; k++) {
        const u = k & 1 ? half : -half,
          v = k & 2 ? side : -side,
          p = chaseProjectNear(body.x + u * ca - v * sa, body.y + u * sa + v * ca, k & 4 ? z0 + tall : z0, chaseBoxAt);
        if (p.x < l) l = p.x;
        if (p.x > r) r = p.x;
        if (p.y < t) t = p.y;
        if (p.y > bottom) bottom = p.y;
      }
      out.l = l;
      out.t = t;
      out.r = r;
      out.b = bottom;
      out.ok = Number.isFinite(l + t + r + bottom);
      return out;
    }
    /* chaseProject with the depth held at the near plane or beyond (a point behind the camera lands at the
       screen's edge side it lies on, never mirrored), into `out` { x, y }. */
    function chaseProjectNear(x, y, z, out) {
      const b = chaseViewSides(),
        dx = x - chaseCam.x,
        dy = y - chaseCam.y,
        dz = z - chaseCam.z,
        depth = Math.max(CHASE_NEAR, dx * b.fx + dy * b.fy + dz * b.fz),
        half = viewportHeight / 2;
      out.x = viewportWidth / 2 + ((dx * b.rx + dy * b.ry) / depth / b.tan) * half;
      out.y = half - ((dx * b.ux + dy * b.uy + dz * b.uz) / depth / b.tan) * half;
      return out;
    }
    /* ---- Console ---------------------------------------------------------------------------- */
    /* DeadEndCity.viewRules(x, y, margin): what the rules that depend on the view say (CHASE RULES above). */
    function viewRulesReport(x, y, margin = 0) {
      const live = chaseCameraLive(),
        M = UNITS_PER_METRE,
        r = (v, d = 1) => (Number.isFinite(v) ? +v.toFixed(d) : null),
        deg = (v) => (Number.isFinite(v) ? Math.round((normalizeAngle(v) * 180) / Math.PI) : null),
        box = hudPlayerBox({ l: 0, t: 0, r: 0, b: 0, ok: false }),
        facing = player.car ? null : playerAimFacing(),
        out = {
          view: live ? 'chase' : 'street',
          ready: live ? chaseCam.ready : null,
          sightReachMetres: CHASE_SIGHT_REACH / M,
          fireReachMetres: CHASE_FIRE_REACH / M,
          aimDeg: deg(aim()),
          chaseAimDeg: live && chaseCam.ready ? deg(chaseAimHeading()) : null,
          facingDeg: facing === null ? null : deg(facing),
          lock: null,
          playerBox: box.ok ? { l: r(box.l), t: r(box.t), r: r(box.r), b: r(box.b) } : null,
          playerScreen: null,
          crowdCentre: null,
          trafficCentre: null,
          seen: null,
          point: null,
        };
      const lock = playerShotTarget(aim());
      if (lock) out.lock = { kind: lock.type || lock.role || lock.faction || lock.species || 'person', x: Math.round(lock.x), y: Math.round(lock.y) };
      if (live && chaseCam.ready) {
        const body = player.car || player,
          q = chaseProject(body.x, body.y, entityElevation(body) + (player.car ? vehicleCollisionHeight(player.car) : PERSON_HEIGHT) / 2, { x: 0, y: 0, depth: 0, behind: false });
        out.playerScreen = { x: r(q.x), y: r(q.y), depth: r(q.depth) };
        const cc = chaseStreamCentre({ x: 0, y: 0 }, CROWD_RING * CHASE_CROWD_LEAN),
          tc = chaseStreamCentre({ x: 0, y: 0 }, TRAFFIC_RING * CHASE_TRAFFIC_LEAN);
        out.crowdCentre = [Math.round(cc.x), Math.round(cc.y)];
        out.trafficCentre = [Math.round(tc.x), Math.round(tc.y)];
        // Who the player can see now: on screen within the sight reach and not behind a building.
        const seen = { people: 0, cars: 0, peopleInFrustum: 0, carsInFrustum: 0 };
        for (const p of pedestrians) {
          if (p.hp <= 0 || !chaseFrustumHas(p.x, p.y, entityElevation(p) + CHASE_BODY_LIFT, 0, CHASE_SIGHT_REACH)) continue;
          seen.peopleInFrustum++;
          if (!chaseHiddenFrom(chaseCam.x, chaseCam.y, chaseCam.z, p.x, p.y, entityElevation(p) + PERSON_HEIGHT * 0.9)) seen.people++;
        }
        for (const c of vehicles) {
          if (c === player.car || isAircraft(c) || isBoat(c) || !chaseFrustumHas(c.x, c.y, entityElevation(c) + CHASE_BODY_LIFT, 0, CHASE_SIGHT_REACH)) continue;
          seen.carsInFrustum++;
          if (!chaseHiddenFrom(chaseCam.x, chaseCam.y, chaseCam.z, c.x, c.y, entityElevation(c) + vehicleCollisionHeight(c) * 0.8)) seen.cars++;
        }
        out.seen = seen;
      }
      if (Number.isFinite(x) && Number.isFinite(y)) {
        const ground = terrainHeight(x, y),
          who = { x, y };
        out.point = {
          inView: crowdInView(x, y, margin),
          unseenSpot: spotUnseen(x, y, margin),
          unseenCarSpot: spotUnseen(x, y, margin, SPOT_CAR),
          shooter: shooterInView(who, 0),
          shooterInset: shooterInView(who),
        };
        if (live && chaseCam.ready) {
          const q = chaseProject(x, y, ground + CHASE_BODY_LIFT, { x: 0, y: 0, depth: 0, behind: false }),
            chest = chaseChestHeight(who);
          Object.assign(out.point, {
            // The same sphere crowdInView asks, through chaseSees (chase-camera.js).
            sees: chaseSees(x, y, ground + CHASE_BODY_LIFT, margin + CHASE_BODY_RADIUS, 0, CHASE_SIGHT_REACH),
            screen: { x: r(q.x), y: r(q.y), depth: r(q.depth), behind: q.behind },
            hiddenFromCamera: chaseHiddenFrom(chaseCam.x, chaseCam.y, chaseCam.z, x, y, chest),
            metres: r(Math.hypot(x - chaseCam.x, y - chaseCam.y) / M),
          });
        } else {
          // The street rules' own numbers: the camera's target, crowdViewHalf and screenViewHalf (unrounded).
          const v = crowdViewHalf(),
            s = screenViewHalf();
          Object.assign(out.point, { cameraTarget: [cameraTarget.x, cameraTarget.y], zoom: worldZoom, half: [v.w, v.h], screenHalf: [s.w, s.h] });
        }
      }
      return out;
    }
    /**
     * DeadEndCity.viewPopAudit(seconds, keys, turn): steps the simulation (as simulate(), 1/30 s, holding `keys`,
     * turning the camera `turn` degrees a second as the mouse would) in the chase view and counts what appears in view (on screen within the sight reach, not behind a building)
     * where it was not the step before: made there (popIn) or moved there by a jump of 6 m or more; and what
     * vanishes or jumps away while in view (popOut). People going into or coming out of a door are not counted
     * (crowd.indoors). Split into people and vehicles, with up to eight examples.
     */
    function viewPopAudit(seconds = 20, held = [], turn = 0) {
      if (!chaseCameraLive()) throw Error("the chase view is off: viewMode('chase') first");
      const steps = Math.round(clamp(seconds, 0, 120) * 30),
        jump = 6 * UNITS_PER_METRE,
        out = { seconds: 0, people: { popIn: 0, popOut: 0, seen: 0 }, vehicles: { popIn: 0, popOut: 0, seen: 0 }, examples: [] },
        indoors = new Set(),
        snapshot = () => {
          const now = new Map();
          for (const p of pedestrians) now.set(p, chasePopState(p, false));
          for (const c of vehicles) if (c !== player.car) now.set(c, chasePopState(c, true));
          return now;
        },
        note = (kind, e, s, how) => {
          out[kind][how]++;
          if (out.examples.length < 8)
            out.examples.push({ kind, how, what: e.type || e.role || 'person', x: Math.round(s.x), y: Math.round(s.y), metres: Math.round(hypot2(s.x - chaseCam.x, s.y - chaseCam.y) / UNITS_PER_METRE) });
        };
      for (const code of held) keys[code] = true;
      let prev = snapshot(),
        seenPeople = 0,
        seenCars = 0,
        n = 0;
      for (let i = 0; i < steps && gameMode === 'play'; i++) {
        const before = indoors.size ? new Set(indoors) : null;
        if (turn) chaseTurn((turn * Math.PI) / 180 / 30, 0);
        update(1 / 30);
        hudClockOffset += 1 / 30;
        indoors.clear();
        for (const stay of crowd.indoors) for (const p of stay.party) indoors.add(p);
        const now = snapshot();
        for (const [e, s] of now) {
          if (!s.vis) continue;
          if (e.type) seenCars++;
          else seenPeople++;
          const was = prev.get(e);
          if ((!was && !(before && before.has(e))) || (was && hypot2(s.x - was.x, s.y - was.y) > jump)) note(e.type ? 'vehicles' : 'people', e, s, 'popIn');
        }
        for (const [e, s] of prev) {
          if (!s.vis) continue;
          const after = now.get(e);
          if ((!after && !indoors.has(e)) || (after && hypot2(after.x - s.x, after.y - s.y) > jump)) note(e.type ? 'vehicles' : 'people', e, s, 'popOut');
        }
        prev = now;
        n++;
      }
      for (const code of held) keys[code] = false;
      out.seconds = +(n / 30).toFixed(1);
      out.people.seen = n ? +(seenPeople / n).toFixed(1) : 0;
      out.vehicles.seen = n ? +(seenCars / n).toFixed(1) : 0;
      return out;
    }
    /* Where something stands and whether the player sees it (viewPopAudit). */
    function chasePopState(e, vehicle) {
      const ground = entityElevation(e),
        top = ground + (vehicle ? vehicleCollisionHeight(e) : PERSON_HEIGHT),
        vis =
          !e.hidden &&
          chaseCam.ready &&
          chaseFrustumHas(e.x, e.y, ground + CHASE_BODY_LIFT, 0, CHASE_SIGHT_REACH) &&
          !chaseHiddenFrom(chaseCam.x, chaseCam.y, chaseCam.z, e.x, e.y, top);
      return { x: e.x, y: e.y, vis };
    }
    function chaseRulesConsole() {
      return {
        // What the rules that depend on the view say (chase-rules.js CHASE RULES): the view, the aim (aim(),
        // chaseAimHeading, the body's facing, the soft lock), the HUD's player box and (chase view) the player's
        // point on screen, the streams' centres and who the player can see; with a map point (x, y): crowdInView
        // with `margin`, spotUnseen for a person and a car, shooterInView (no inset, and the usual 20 px) for
        // someone standing there, and (chase view) chaseSees on the same sphere, its screen point and whether a
        // building hides it from the camera.
        viewRules: (x, y, margin = 0) => viewRulesReport(x, y, margin),
        // Step the simulation `seconds` (20) in the chase view holding `keys` and turning the camera `turn`
        // degrees a second, counting people and vehicles that appear in view where they were not (made there
        // or jumped there) or vanish from it.
        viewPopAudit: (seconds = 20, held = [], turn = 0) => viewPopAudit(seconds, Array.isArray(held) ? held : [], Number(turn) || 0),
      };
    }
