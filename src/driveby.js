    // Drive-bys: the arcs a gun can point out of each vehicle (per window, from the driver's seat),
    // the lean-out before the first shot, the rear window it breaks and the aim clamp
    // (driveByProfile, driveByAim, driveByGrip, updateDriveBy, breakRearWindow).
    /**
     * DRIVE-BYS
     * The driver sits on the left (left-hand drive: South Coast traffic keeps
     * right) and fires the pistol one-handed. Where the gun can point is
     * anatomy and glass, per vehicle body (`spec.driveBy`, set below by body
     * type; a definition may carry its own):
     *   own window   the left hand out of the driver's window, from 25 deg off
     *                the nose round to 155 deg (140 on a truck, whose cargo box
     *                or body runs back beside the cab);
     *   across       the right hand across the passenger seat and out of the
     *                passenger window: 52 to 125 deg on the right, the window's
     *                frame seen from the driver's seat (a truck: 55 to 120);
     *   rear         turned round in the seat, through the rear screen, the
     *                last 25 deg either side of straight back, only for a body
     *                whose cabin has one (sedans, coupes, hatchbacks, SUVs,
     *                pickups, taxis, limousines). The first shot bursts the
     *                screen (damage.glass.rear = 2, glass sound and crumbs).
     *                Box trucks, the ambulance and the bus (a cargo or
     *                passenger body behind the cab), the panel van (a steel
     *                bulkhead), the flatbed (the cab's back wall), a police
     *                car (the prisoner cage) and a mid-engine car (the engine
     *                behind the seats) cannot shoot straight back;
     *   windscreen   never forward through the car's own windscreen: a
     *                one-handed driver would be shooting through laminated
     *                glass at arm's length. Once the windscreen is shattered
     *                (damage.glass.front = 2) the hole is a window too (25 deg
     *                either side of the nose).
     * A roadster is open: a wider arc out over each door and straight back over
     * the rear deck, nothing to break. Riders (motorbikes, bicycles, the jet
     * ski) hold the bars with the right hand and shoot with the left, from 60
     * deg right of the nose round the front and the left to 170 deg: never back
     * through their own body. A boat's helm is open all round but for its
     * console screen ahead. Tanks and the Apache keep their own guns.
     *
     * AIM CLAMP: an aim within DRIVE_BY_SLACK of an arc's edge fires along the
     * edge; further out the gun holds fire and the reticle dims (driveByAim).
     * The arm takes DRIVE_BY_EXTEND seconds to come out of the window before the
     * first shot, and goes back in (DRIVE_BY_RETRACT) to change windows or
     * DRIVE_BY_HOLD seconds after the last trigger pull; the window it leaves
     * through is wound down first and stays down (`vehicle.windowsDown`, read by
     * damage3d-bodies.js). The renderer draws the pose from `driveBy`
     * (crowd3d-driveby.js); the bullet leaves from the same muzzle (driveByGrip).
     * There are no NPC drive-bys: any future shooter in a vehicle goes through
     * driveByAim with its own vehicle.
     */
    const DRIVE_BY_DEG = Math.PI / 180,
      DRIVE_BY_SLACK = 17 * DRIVE_BY_DEG,
      DRIVE_BY_EXTEND = 0.26,
      DRIVE_BY_RETRACT = 0.22,
      DRIVE_BY_HOLD = 2.2,
      // How each body's cabin ends behind the seats.
      DRIVE_BY_BODIES = {
        sedan: 'cabin', taxi: 'cabin', coupe: 'cabin', muscle: 'cabin', sport: 'cabin', rally: 'cabin',
        hotrod: 'cabin', luxury: 'cabin', limousine: 'cabin', suv: 'cabin', pickup: 'cabin', chevette: 'cabin',
        supercar: 'engine', brutini: 'engine', cavalino: 'engine',
        roadster: 'open',
        van: 'bulkhead', truck: 'box', bus: 'box', ambulance: 'box', flatbed: 'cabWall', police: 'partition',
        plane: 'cockpit', helicopter: 'cockpit',
      },
      DRIVE_BY_NO_REAR = {
        box: 'The body behind the cab: no shot straight back.',
        bulkhead: 'A steel bulkhead behind the seats: no shot straight back.',
        cabWall: "The cab's back wall: no shot straight back.",
        partition: 'The cage behind the seats: no shot straight back.',
        engine: 'The engine sits behind the seats: no shot straight back.',
        cockpit: 'No window behind the seats: aim out of a side window.',
      };
    // Degrees off the nose (negative left): [ownFrom, ownTo] on the driver's side, [acrossFrom, acrossTo] on the far side.
    function driveByDefaults(spec, type) {
      if (spec.driveBy !== undefined) return;
      let body = DRIVE_BY_BODIES[type] || null;
      if (!body) body = spec.bike || spec.bicycle || type === 'jetski' ? 'rider' : spec.boat ? 'deck' : null;
      if (type === 'tank') body = null;
      if (!body) {
        spec.driveBy = null;
        return;
      }
      const truckLike = body === 'box' || body === 'bulkhead' || body === 'cabWall';
      spec.driveBy = Object.freeze({
        body,
        // -1: the driver sits on the left; 0: centred (riders, a helm).
        seat: body === 'rider' || body === 'deck' ? 0 : -1,
        own: body === 'rider' || body === 'deck' ? null : body === 'open' ? [20, 165] : body === 'cockpit' ? [30, 150] : truckLike ? [25, 140] : [25, 155],
        across: body === 'rider' || body === 'deck' ? null : body === 'open' ? [35, 150] : body === 'cockpit' ? [60, 120] : truckLike ? [55, 120] : [52, 125],
        // 'glass': a rear screen that breaks; 'open': over an open deck; null: blocked.
        rear: body === 'cabin' ? 'glass' : body === 'open' ? 'open' : null,
      });
    }
    Object.entries(VEHICLE_DEFINITIONS).forEach(([type, spec]) => driveByDefaults(spec, type));
    // A vehicle's profile: its type's, with the police cage in a law unit's body.
    function driveByProfile(vehicle) {
      const profile = vehicleSpec(vehicle)?.driveBy || null;
      if (profile && profile.rear && (vehicle.policeLook || vehicle.lawUnit)) return driveByPoliceProfile(profile);
      return profile;
    }
    const policeProfiles = new Map();
    function driveByPoliceProfile(profile) {
      let caged = policeProfiles.get(profile);
      if (!caged) policeProfiles.set(profile, (caged = Object.freeze({ ...profile, body: 'partition', rear: null })));
      return caged;
    }
    /* The arcs as [from, to, window] in radians off the nose (from < to; `to` may pass PI). */
    const arcCache = new Map();
    function driveByArcs(vehicle) {
      const profile = driveByProfile(vehicle);
      if (!profile) return null;
      const screenGone = profile.body !== 'rider' && profile.body !== 'deck' && profile.body !== 'open' && vehicle.damage?.glass?.front === 2,
        key = profile.body + '|' + vehicle.type + '|' + (profile.rear || '-') + (screenGone ? '|front' : '');
      let arcs = arcCache.get(key);
      if (arcs) return arcs;
      if (profile.body === 'rider') arcs = [[-170 * DRIVE_BY_DEG, 60 * DRIVE_BY_DEG, 'open']];
      else if (profile.body === 'deck') arcs = [[20 * DRIVE_BY_DEG, 340 * DRIVE_BY_DEG, 'open']];
      else {
        arcs = [
          [-profile.own[1] * DRIVE_BY_DEG, -profile.own[0] * DRIVE_BY_DEG, 'left'],
          [profile.across[0] * DRIVE_BY_DEG, profile.across[1] * DRIVE_BY_DEG, 'right'],
        ];
        if (profile.rear) arcs.push([(180 - 25) * DRIVE_BY_DEG, (180 + 25) * DRIVE_BY_DEG, 'rear']);
        if (screenGone) arcs.push([-25 * DRIVE_BY_DEG, 25 * DRIVE_BY_DEG, 'front']);
      }
      arcCache.set(key, arcs);
      return arcs;
    }
    const driveBySolution = { ok: false, blocked: true, clamped: false, a: 0, rel: 0, off: 0, window: null, why: null };
    /**
     * Where a gun aimed at world heading `a` can fire from `vehicle`: `ok`
     * (inside an arc, or clamped to its edge), `a`/`rel` the heading it fires
     * along (world, and off the nose), `window` the opening it goes through
     * ('left', 'right', 'rear', 'front', 'open'), `off` how far the aim was
     * outside. One shared result object: read it before the next call.
     */
    function driveByAim(vehicle, a, out = driveBySolution) {
      const arcs = driveByArcs(vehicle),
        rel = normalizeAngle(a - vehicle.a);
      out.why = null;
      if (!arcs) {
        Object.assign(out, { ok: false, blocked: true, clamped: false, a, rel, off: Math.PI, window: null });
        return out;
      }
      let best = null,
        bestOff = Infinity,
        bestRel = rel;
      for (const arc of arcs) {
        const span = arc[1] - arc[0],
          into = (((rel - arc[0]) % TAU) + TAU) % TAU;
        if (into <= span) {
          best = arc;
          bestOff = 0;
          bestRel = rel;
          break;
        }
        // Outside: the nearer of its two edges.
        const pastEnd = into - span,
          beforeStart = TAU - into;
        if (pastEnd < bestOff) {
          bestOff = pastEnd;
          best = arc;
          bestRel = normalizeAngle(arc[1]);
        }
        if (beforeStart < bestOff) {
          bestOff = beforeStart;
          best = arc;
          bestRel = normalizeAngle(arc[0]);
        }
      }
      out.off = bestOff;
      out.window = best[2];
      out.rel = bestRel;
      out.a = normalizeAngle(vehicle.a + bestRel);
      out.clamped = bestOff > 0 && bestOff <= DRIVE_BY_SLACK;
      out.blocked = bestOff > DRIVE_BY_SLACK;
      out.ok = !out.blocked;
      if (out.blocked) out.why = driveByRefusal(vehicle, rel);
      return out;
    }
    // Why an aim is refused, for the hint.
    function driveByRefusal(vehicle, rel) {
      const profile = driveByProfile(vehicle);
      if (!profile) return 'No firing from this seat.';
      if (profile.body === 'rider') return 'Not back through yourself: aim to the left, ahead or behind on the left.';
      if (Math.abs(rel) < 40 * DRIVE_BY_DEG) return 'Not through your own windscreen: aim out of a side window.';
      if (Math.abs(rel) > 140 * DRIVE_BY_DEG && !profile.rear) return DRIVE_BY_NO_REAR[profile.body] || DRIVE_BY_NO_REAR.cockpit;
      return 'No line of fire through the bodywork: aim out of a window.';
    }
    /* The driver's hip in vehicle space (x ahead, y right, z up, world units) and the cabin round it. */
    const seatCache = new Map();
    function driveBySeat(vehicle) {
      const profile = driveByProfile(vehicle),
        spec = vehicleSpec(vehicle),
        key = vehicle.type + (vehicle.policeLook || vehicle.lawUnit ? '|law' : '');
      let seat = seatCache.get(key);
      if (seat) return seat;
      const M = UNITS_PER_METRE;
      if (!profile || profile.body === 'rider' || profile.body === 'deck') {
        const rider = profile?.body === 'rider',
          z = spec.bicycle ? 15.2 : vehicle.type === 'jetski' ? 8.1 : rider ? 12.3 : 9;
        seat = { x: -0.06 * spec.l, y: 0, z, half: spec.w / 2, belt: z, roof: z + 2 * M, back: -spec.l / 2, front: spec.l / 2, open: true };
      } else {
        const band = vehicleGlassBand(vehicle),
          // A truck's cab sits over the front axle; a car's driver a hand behind the middle.
          x = band.front - 1.4 * M;
        seat = {
          x,
          y: -0.2 * spec.w,
          z: band.belt - 0.42 * M,
          // The door skin: the collider's width includes the mirrors.
          half: spec.w * 0.44,
          belt: band.belt,
          roof: band.roof,
          back: band.back,
          front: band.front,
          open: band.open || profile.body === 'open',
        };
      }
      seatCache.set(key, seat);
      return seat;
    }
    // The muzzle of the last drive-by shot (world x, y; height over the vehicle).
    const driveByOrigin = { x: 0, y: 0, height: 0, clamped: false };
    const gripOut = { x: 0, y: 0, z: 0, mx: 0, my: 0, mz: 0, hand: 0 };
    /**
     * The gun for a shot through `window` along `rel` (radians off the nose),
     * fully out: the grip (x, y, z) and the muzzle (mx, my, mz) in vehicle
     * space, and the hand that holds it (0 left, 1 right). The renderer poses
     * the arm to the same grip; the bullet leaves from the muzzle.
     */
    function driveByGrip(vehicle, window, rel, out = gripOut) {
      const seat = driveBySeat(vehicle),
        M = UNITS_PER_METRE,
        ux = Math.cos(rel),
        uy = Math.sin(rel),
        shoulderZ = seat.z + 0.5 * M;
      let x, y, z, hand;
      if (window === 'left' || (window === 'open' && !seat.open)) {
        // Forearm on the sill, the hand past the door skin, the wrist turned to the aim.
        hand = 0;
        x = seat.x + 0.06 * M + clamp(ux * 0.42 * M, -0.34 * M, 0.4 * M);
        y = -(seat.half + 0.3 * M) + Math.min(0, uy) * 0.06 * M;
        z = seat.belt + 0.13 * M;
      } else if (window === 'right') {
        // Leaning across the passenger seat, the arm straight toward the far window.
        hand = 1;
        x = seat.x + ux * 0.45 * M;
        y = seat.y + 0.3 * M + uy * 0.45 * M;
        z = shoulderZ - 0.02 * M;
      } else if (window === 'rear') {
        // Turned round, the right arm back between the front seats.
        hand = 1;
        x = seat.x - 0.5 * M;
        y = seat.y * 0.25 + uy * 0.1 * M;
        z = shoulderZ + 0.06 * M;
      } else if (window === 'front') {
        // Through the hole where the windscreen was.
        hand = 0;
        x = seat.x + 0.62 * M;
        y = seat.y + 0.12 * M;
        z = seat.belt + 0.1 * M;
      } else {
        // Open: a rider or a helmsman, the left arm out from the shoulder.
        hand = 0;
        x = seat.x + 0.05 * M + ux * 0.5 * M;
        y = seat.y - 0.2 * M + uy * 0.5 * M;
        z = shoulderZ + 0.04 * M;
      }
      out.x = x;
      out.y = y;
      out.z = z;
      out.hand = hand;
      // The muzzle a pistol's length ahead of the grip.
      out.mx = x + ux * 0.21 * M;
      out.my = y + uy * 0.21 * M;
      out.mz = z + 0.045 * M;
      return out;
    }
    /**
     * The player's drive-by: `out` 0..1 how far the gun arm is out of `window`,
     * `rel` the aim off the nose it points along, `aim` 'clear' / 'clamped' /
     * 'blocked' for the reticle, `wantAt` the last trigger pull.
     */
    const driveBy = {
      car: null,
      out: 0,
      window: null,
      rel: 0,
      a: 0,
      aim: 'clear',
      wantAt: -100,
      pending: false,
      // Console only (driveByAim): an aim held off the nose, the trigger held, the arm held out.
      holdRel: null,
      holdFire: false,
      raised: false,
      refusedAt: -100,
      stats: { shots: 0, refused: 0, clamped: 0, rearScreens: 0, windowsDown: 0 },
    };
    function driveByArmed(c) {
      return (
        !!c &&
        c.hp > 0 &&
        !!driveByProfile(c) &&
        !isApache(c) &&
        !transitRide &&
        !taxiRide &&
        gameMode === 'play' &&
        selectedWeaponIndex === 0 &&
        weaponIsEquipped(0)
      );
    }
    // The window goes down before the arm goes out (it stays down).
    function lowerWindow(c, window) {
      if (window !== 'left' && window !== 'right') return;
      if (!c.windowsDown) c.windowsDown = { left: false, right: false };
      if (c.windowsDown[window]) return;
      c.windowsDown[window] = true;
      c.damageVersion = (c.damageVersion || 0) + 1;
      driveBy.stats.windowsDown++;
    }
    /* Each frame (game-update.js): the arm in and out, the aim, a shot waiting for the arm. */
    function updateDriveBy(deltaSeconds) {
      const d = driveBy,
        c = player.car;
      if (c !== d.car) {
        d.car = c;
        d.out = 0;
        d.window = null;
        d.pending = false;
        d.wantAt = -100;
        if (!c) d.raised = d.holdFire = false;
        if (!c) d.holdRel = null;
      }
      // The console's held aim follows the vehicle as it turns (and survives a focus change).
      if (c && d.holdRel !== null) touchAim = normalizeAngle(c.a + d.holdRel);
      if (!driveByArmed(c)) {
        d.out = Math.max(0, d.out - deltaSeconds / DRIVE_BY_RETRACT);
        d.pending = false;
        return;
      }
      const wanted = d.pending || d.raised || gameTime - d.wantAt < DRIVE_BY_HOLD;
      if (!wanted && d.out <= 0) {
        d.window = null;
        return;
      }
      const sol = driveByAim(c, aim());
      d.aim = sol.blocked ? 'blocked' : sol.clamped ? 'clamped' : 'clear';
      const target = wanted ? (sol.blocked ? d.window || sol.window : sol.window) : d.window;
      if (!wanted) d.out = Math.max(0, d.out - deltaSeconds / DRIVE_BY_RETRACT);
      else if (target !== d.window) {
        // Back in through one window before going out of another.
        if (d.out > 0) d.out = Math.max(0, d.out - deltaSeconds / DRIVE_BY_RETRACT);
        if (d.out <= 0) {
          d.window = target;
          lowerWindow(c, target);
        }
      } else d.out = Math.min(1, d.out + deltaSeconds / DRIVE_BY_EXTEND);
      if (d.out <= 0 && !wanted) d.window = null;
      // Aim within the window it is out of; blocked holds the gun at the nearest edge.
      if (d.window && (sol.window === d.window || !sol.ok)) {
        d.rel = sol.window === d.window ? sol.rel : d.rel;
        d.a = normalizeAngle(c.a + d.rel);
      }
      if (d.holdFire || (d.pending && d.out >= 1 && d.window === sol.window && sol.ok)) shoot();
    }
    /**
     * Called by shoot() for a shot from a vehicle with a drive-by profile, once
     * the aim is known: returns the heading to fire along and fills `origin`
     * with the muzzle (world x, y and height over the vehicle), or null to hold
     * fire (blocked, or the arm is still on its way out).
     */
    function driveByShot(c, a, origin) {
      const d = driveBy,
        sol = driveByAim(c, a);
      d.wantAt = gameTime;
      if (sol.blocked) {
        d.pending = false;
        d.aim = 'blocked';
        d.stats.refused++;
        if (gameTime - d.refusedAt > 4) {
          d.refusedAt = gameTime;
          tell(sol.why, 2.5, { id: 'driveby' });
        }
        return null;
      }
      if (d.out < 1 || d.window !== sol.window) {
        d.pending = true;
        return null;
      }
      d.pending = false;
      if (sol.clamped) d.stats.clamped++;
      d.stats.shots++;
      d.rel = sol.rel;
      d.a = sol.a;
      const g = driveByGrip(c, sol.window, sol.rel),
        w = vehicleWorldPoint(c, g.mx, g.my);
      origin.x = w.x;
      origin.y = w.y;
      origin.height = g.mz;
      origin.clamped = sol.clamped;
      if (sol.window === 'rear' && driveByProfile(c).rear === 'glass') breakRearWindow(c);
      return sol.a;
    }
    /* The first shot back through the rear screen bursts it. */
    function breakRearWindow(c) {
      const damage = ensureDamage(c);
      if (damage.glass.rear >= 2) return false;
      shatterPane(damage, 'rear');
      damage.glassHits.rear++;
      c.damageVersion = (c.damageVersion || 0) + 1;
      driveBy.stats.rearScreens++;
      const seat = driveBySeat(c),
        p = vehicleWorldPoint(c, seat.back * 0.92, 0),
        elevation = entityElevation(c);
      bulletImpactSound(p.x, p.y, 'glass', elevation);
      if (city3D) city3D.impact(p.x, p.y, 'glass', elevation);
      return true;
    }
    /**
     * Keyboard aim from a vehicle (aim(), no mouse or stick): the nearest
     * threat inside the arcs, else straight out of the driver's window.
     */
    function driveByAutoAim(c) {
      const arcs = driveByArcs(c);
      if (!arcs || isApache(c)) return null;
      let best = null,
        bestScore = Infinity;
      for (const list of [enemies, gangMembers, officers, vehicles])
        for (const t of list) {
          if (t.hp <= 0 || t === c || (list === vehicles && !t.cop)) continue;
          const d = combatDistance(t, c);
          if (d > 370 || d < 1) continue;
          const sol = driveByAim(c, headingBetween(c, t));
          if (!sol.ok || sol.clamped) continue;
          const score = d + (sol.window === 'left' || sol.window === 'open' ? 0 : 60);
          if (score < bestScore && clearSight(player, t)) {
            bestScore = score;
            best = t;
          }
        }
      if (best) return headingBetween(c, best);
      return normalizeAngle(c.a - Math.PI / 2);
    }
    /* The drive-by reticle (HUD, game-loop.js): the line of fire from the muzzle, dimmed when blocked. */
    function updateDriveByReticle() {
      const el = getElement('driveByReticle'),
        d = driveBy,
        c = player.car;
      if (!el) return;
      const show = !!city3D && gameMode === 'play' && d.out > 0 && !!d.window && d.car === c && driveByArmed(c);
      el.classList.toggle('hidden', !show);
      if (!show) return;
      const g = driveByGrip(c, d.window, d.rel),
        muzzle = vehicleWorldPoint(c, g.mx, g.my),
        height = entityElevation(c) + g.mz,
        from = city3D.project(muzzle.x, muzzle.y, height);
      // As far out as the cursor when aiming with the mouse, else a fixed 20 m.
      let range = 160;
      if (mouse.active && touchAim === null) {
        const ahead = city3D.project(muzzle.x + Math.cos(d.a) * 100, muzzle.y + Math.sin(d.a) * 100, height),
          perHundred = Math.hypot(ahead.x - from.x, ahead.y - from.y);
        if (perHundred > 1) range = clamp((100 * Math.hypot(mouse.x - from.x, mouse.y - from.y)) / perHundred, 40, 700);
      }
      const to = city3D.project(muzzle.x + Math.cos(d.a) * range, muzzle.y + Math.sin(d.a) * range, height),
        length = Math.hypot(to.x - from.x, to.y - from.y),
        line = getElement('driveByLine');
      getElement('driveByRing').style.transform = 'translate(' + to.x.toFixed(0) + 'px,' + to.y.toFixed(0) + 'px)';
      line.style.width = length.toFixed(0) + 'px';
      line.style.transform = 'translate(' + from.x.toFixed(0) + 'px,' + from.y.toFixed(0) + 'px) rotate(' + Math.atan2(to.y - from.y, to.x - from.x).toFixed(3) + 'rad)';
      el.classList.toggle('raising', d.out < 1);
      el.classList.toggle('clamped', d.aim === 'clamped');
      el.classList.toggle('blocked', d.aim === 'blocked');
    }
    function driveByReport() {
      const c = player.car,
        d = driveBy,
        profile = c ? driveByProfile(c) : null,
        deg = (r) => Math.round(r / DRIVE_BY_DEG);
      return {
        vehicle: c?.type || null,
        body: profile?.body || null,
        rear: profile ? profile.rear : null,
        arcs: c && profile ? driveByArcs(c).map(([a, b, w]) => ({ window: w, from: deg(a), to: deg(b) })) : [],
        out: +d.out.toFixed(2),
        window: d.window,
        relDeg: deg(d.rel),
        aim: d.aim,
        pending: d.pending,
        rearGlass: c?.damage?.glass?.rear ?? null,
        windowsDown: c?.windowsDown ? { ...c.windowsDown } : null,
        stats: { ...d.stats },
      };
    }
    function driveByConsole() {
      return {
        // Drive-bys (driveby.js): the current vehicle's arcs, the arm, the aim state and counts.
        driveBy: () => driveByReport(),
        // The drive-by arcs of a vehicle type in degrees off the nose (negative left).
        driveByArcs(type = player.car?.type || 'sedan') {
          const spec = VEHICLE_DEFINITIONS[type];
          if (!spec) throw Error('Unknown vehicle type ' + type);
          const probe = { type, a: 0, damage: null };
          return { type, profile: spec.driveBy, arcs: (driveByArcs(probe) || []).map(([a, b, w]) => ({ window: w, from: Math.round(a / DRIVE_BY_DEG), to: Math.round(b / DRIVE_BY_DEG) })) };
        },
        // Where an aim `relDegrees` off the nose would fire from the current vehicle (no shot).
        driveByCheck(relDegrees) {
          if (!player.car) throw Error('Not in a vehicle');
          const sol = driveByAim(player.car, player.car.a + relDegrees * DRIVE_BY_DEG);
          return { ok: sol.ok, blocked: sol.blocked, clamped: sol.clamped, window: sol.window, relDeg: Math.round(sol.rel / DRIVE_BY_DEG), offDeg: Math.round(sol.off / DRIVE_BY_DEG), why: sol.why };
        },
        // Hold the aim `relDegrees` off the vehicle's nose (as the aim stick does), null lets
        // it go; `fire` true also holds the trigger, 'raise' holds the arm out without firing
        // (for pictures). Step with simulate()/wait to see the arm come out.
        driveByAim(relDegrees = null, fire = false) {
          driveBy.raised = driveBy.holdFire = false;
          driveBy.holdRel = null;
          if (relDegrees === null || !player.car) touchAim = null;
          else {
            driveBy.holdRel = relDegrees * DRIVE_BY_DEG;
            touchAim = normalizeAngle(player.car.a + driveBy.holdRel);
            driveBy.holdFire = fire === true;
            driveBy.raised = fire === 'raise';
          }
          return driveByReport();
        },
      };
    }
