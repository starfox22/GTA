    // Drive-bys: the arcs a gun can point out of each vehicle (per window, from the driver's seat),
    // the lean-out before the first shot, the panes it breaks and the cross for a blocked aim
    // (driveByProfile, driveByAim, driveByGrip, updateDriveBy, breakDriveByPane).
    /**
     * DRIVE-BYS
     * The driver sits on the left (left-hand drive: South Coast traffic keeps
     * right) and fires the pistol one-handed. Where the gun can point is the
     * glass round the seat, per vehicle body (`spec.driveBy`, set below by body
     * type; a definition may carry its own):
     *   front        through the windscreen, 35 deg either side of the nose;
     *   left / right out of the driver's window, or across the passenger seat
     *                and out of the far window, from 35 deg off the nose back
     *                to 145 deg (a car with a rear screen) or 135 deg (a body
     *                with none);
     *   rear         turned round in the seat, through the rear screen, 35 deg
     *                either side of straight back, for a cabin that has one
     *                (sedans, coupes, hatchbacks, SUVs, pickups, taxis,
     *                limousines, the front-engined GTs, the 4x4s), or over the
     *                deck of an open roadster.
     * So a car shoots all round, and a body with nothing to see through behind
     * the seats (box trucks, the ambulance and the bus, the panel van's
     * bulkhead, the flatbed's cab wall, a police car's prisoner cage, a
     * mid-engined car's engine) has about 270 deg: the 90 deg straight back
     * are blocked. The first shot through the windscreen or the rear screen
     * shatters it (damage.glass[pane] = 2, glass sound and crumbs; a repair
     * puts it back). The side window is wound down before the arm goes out.
     * Riders (motorbikes, bicycles, the jet ski) hold the bars with the right
     * hand and shoot with the left: all round but the right rear quarter
     * (never back through their own body). A boat's helm is open all round.
     * Aircraft: out of the side windows only. Tanks, the Apache and the
     * mounted guns (mounted-guns.js: LAV-8, gun jeep, Black Hawk) keep their own.
     *
     * A BLOCKED AIM holds fire and shows a small cross along the aim for a
     * moment (driveByShot, updateDriveByCross): no line, no ring, no message.
     * The arm takes DRIVE_BY_EXTEND seconds to come out of the window before the
     * first shot, and goes back in (DRIVE_BY_RETRACT) to change windows or
     * DRIVE_BY_HOLD seconds after the last trigger pull; the window it leaves
     * through is wound down first and stays down until a repair
     * (`vehicle.windowsDown`, read by damage3d-bodies.js). The renderer draws
     * the pose from `driveBy` (crowd3d-driveby.js); the bullet leaves from the
     * same muzzle (driveByGrip). There are no NPC drive-bys: any future shooter
     * in a vehicle goes through driveByAim with its own vehicle. In the chase view
     * the aim is the camera's reticle for every device (aim() is chaseAimHeading
     * from the vehicle: chase-rules.js), through the same arcs, and the cross is
     * placed by the chase camera (none while it lies behind the camera).
     */
    const DRIVE_BY_DEG = Math.PI / 180,
      DRIVE_BY_EXTEND = 0.26,
      DRIVE_BY_RETRACT = 0.22,
      DRIVE_BY_HOLD = 2.2,
      // The blocked-aim cross: how long it shows, and how far past the body it sits.
      DRIVE_BY_CROSS_LIFE = 0.5,
      DRIVE_BY_CROSS_REACH = 3 * UNITS_PER_METRE,
      // How each body's cabin ends behind the seats. Types registered later
      // (hypercars.js, offroad-trails.js) are listed too: their profile is made
      // the first time one is driven (driveByProfile).
      DRIVE_BY_BODIES = {
        sedan: 'cabin', taxi: 'cabin', coupe: 'cabin', muscle: 'cabin', sport: 'cabin', rally: 'cabin',
        hotrod: 'cabin', luxury: 'cabin', limousine: 'cabin', suv: 'cabin', pickup: 'cabin', chevette: 'cabin',
        dbs: 'cabin', novera: 'cabin',
        series: 'cabin', crawler: 'cabin', bronco: 'cabin', expedition: 'cabin', hilux: 'cabin', trophy: 'cabin',
        supercar: 'engine', brutini: 'engine', cavalino: 'engine',
        valkyrie: 'engine', zr1x: 'engine', wayron: 'engine', tourbillon: 'engine', jasko: 'engine', sirocco: 'engine', w1: 'engine', lafera: 'engine',
        roadster: 'open',
        van: 'bulkhead', truck: 'box', bus: 'box', ambulance: 'box', sixbysix: 'box', flatbed: 'cabWall', police: 'partition',
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
    // Degrees off the nose: the side windows run from `sides[0]` to `sides[1]` on each side.
    function driveByDefaults(spec, type) {
      if (spec.driveBy !== undefined) return;
      let body = DRIVE_BY_BODIES[type] || null;
      if (!body) body = spec.bike || spec.bicycle || type === 'jetski' ? 'rider' : spec.boat ? 'deck' : null;
      if (type === 'tank') body = null;
      if (!body) {
        spec.driveBy = null;
        return;
      }
      const helm = body === 'rider' || body === 'deck',
        // 'glass': a screen that breaks; 'open': over an open deck; null: blocked.
        rear = body === 'cabin' ? 'glass' : body === 'open' ? 'open' : null;
      spec.driveBy = Object.freeze({
        body,
        // -1: the driver sits on the left; 0: centred (riders, a helm).
        seat: helm ? 0 : -1,
        sides: helm ? null : body === 'cockpit' ? [30, 150] : rear ? [35, 145] : [35, 135],
        front: helm || body === 'cockpit' ? null : 'glass',
        rear,
      });
    }
    Object.entries(VEHICLE_DEFINITIONS).forEach(([type, spec]) => driveByDefaults(spec, type));
    // A vehicle's profile: its type's, with the police cage in a law unit's body.
    function driveByProfile(vehicle) {
      const spec = vehicleSpec(vehicle);
      if (spec && spec.driveBy === undefined) driveByDefaults(spec, vehicle.type);
      const profile = spec?.driveBy || null;
      if (profile && profile.rear && (vehicle.policeLook || vehicle.lawUnit)) return driveByPoliceProfile(profile);
      return profile;
    }
    const policeProfiles = new Map();
    function driveByPoliceProfile(profile) {
      let caged = policeProfiles.get(profile);
      if (!caged) policeProfiles.set(profile, (caged = Object.freeze({ ...profile, body: 'partition', rear: null, sides: [35, 135] })));
      return caged;
    }
    /* The arcs as [from, to, window] in radians off the nose (from < to; `to` may pass PI). */
    const arcCache = new Map();
    function driveByArcs(vehicle) {
      const profile = driveByProfile(vehicle);
      if (!profile) return null;
      let arcs = arcCache.get(profile);
      if (arcs) return arcs;
      const D = DRIVE_BY_DEG;
      if (profile.body === 'rider') arcs = [[-180 * D, 90 * D, 'open']];
      else if (profile.body === 'deck') arcs = [[-180 * D, 180 * D, 'open']];
      else {
        const [near, far] = profile.sides;
        arcs = [
          [-far * D, -near * D, 'left'],
          [near * D, far * D, 'right'],
        ];
        if (profile.front) arcs.push([-near * D, near * D, 'front']);
        if (profile.rear) arcs.push([far * D, (360 - far) * D, 'rear']);
      }
      arcCache.set(profile, arcs);
      return arcs;
    }
    const driveBySolution = { ok: false, blocked: true, a: 0, rel: 0, off: 0, window: null, why: null };
    /**
     * Where a gun aimed at world heading `a` can fire from `vehicle`: `ok`
     * inside an arc (`a`/`rel` the heading, world and off the nose, `window`
     * the opening it goes through: 'left', 'right', 'rear', 'front', 'open'),
     * else `blocked` with `window`/`rel` the nearest edge (where the gun is
     * held), `off` how far outside it was and `why`. One shared result object:
     * read it before the next call.
     */
    function driveByAim(vehicle, a, out = driveBySolution) {
      const arcs = driveByArcs(vehicle),
        rel = normalizeAngle(a - vehicle.a);
      out.why = null;
      if (!arcs) {
        Object.assign(out, { ok: false, blocked: true, a, rel, off: Math.PI, window: null });
        return out;
      }
      let best = null,
        bestOff = Infinity,
        bestRel = rel;
      for (const arc of arcs) {
        const span = arc[1] - arc[0],
          into = (((rel - arc[0]) % TAU) + TAU) % TAU;
        if (into <= span + 1e-9) {
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
      out.blocked = bestOff > 0;
      out.ok = !out.blocked;
      if (out.blocked) out.why = driveByRefusal(vehicle, rel);
      return out;
    }
    // Why an aim is refused (console and tests; the player sees only the cross).
    function driveByRefusal(vehicle, rel) {
      const profile = driveByProfile(vehicle);
      if (!profile) return 'No firing from this seat.';
      if (profile.body === 'rider') return 'Not back through yourself: aim to the left, ahead or behind on the left.';
      if (Math.abs(rel) < 40 * DRIVE_BY_DEG) return 'No window ahead: aim out of a side window.';
      if (Math.abs(rel) > 120 * DRIVE_BY_DEG && !profile.rear) return DRIVE_BY_NO_REAR[profile.body] || DRIVE_BY_NO_REAR.cockpit;
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
    const driveByOrigin = { x: 0, y: 0, height: 0 };
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
     * `rel` the aim off the nose it points along, `aim` 'clear' / 'blocked',
     * `wantAt` the last trigger pull that could fire, `crossAt`/`crossRel` the
     * last pull into a blocked sector (the cross, updateDriveByCross).
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
      crossAt: -100,
      crossRel: 0,
      // Console only (driveByAim): an aim held off the nose, the trigger held, the arm held out.
      holdRel: null,
      holdFire: false,
      raised: false,
      stats: { shots: 0, refused: 0, rearScreens: 0, windscreens: 0, windowsDown: 0 },
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
    // The window goes down before the arm goes out (it stays down until a repair).
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
        d.wantAt = d.crossAt = -100;
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
      const wanted = d.pending || d.raised || d.holdFire || gameTime - d.wantAt < DRIVE_BY_HOLD;
      if (!wanted && d.out <= 0) {
        d.window = null;
        return;
      }
      const sol = driveByAim(c, aim());
      d.aim = sol.blocked ? 'blocked' : 'clear';
      // A blocked aim keeps the arm where it is (held at that window's edge) and brings none out.
      const target = !wanted || sol.blocked ? d.window : sol.window;
      if (!wanted || !target) d.out = Math.max(0, d.out - deltaSeconds / DRIVE_BY_RETRACT);
      else if (target !== d.window) {
        // Back in through one window before going out of another.
        if (d.out > 0) d.out = Math.max(0, d.out - deltaSeconds / DRIVE_BY_RETRACT);
        if (d.out <= 0) {
          d.window = target;
          lowerWindow(c, target);
        }
      } else d.out = Math.min(1, d.out + deltaSeconds / DRIVE_BY_EXTEND);
      if (d.out <= 0 && (!wanted || !target)) d.window = null;
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
     * fire (a blocked aim: the cross shows; or the arm is still on its way out).
     */
    function driveByShot(c, a, origin) {
      const d = driveBy,
        sol = driveByAim(c, a);
      if (sol.blocked) {
        d.pending = false;
        d.aim = 'blocked';
        d.stats.refused++;
        d.crossAt = gameTime;
        d.crossRel = normalizeAngle(a - c.a);
        return null;
      }
      d.wantAt = gameTime;
      if (d.out < 1 || d.window !== sol.window) {
        d.pending = true;
        return null;
      }
      d.pending = false;
      d.stats.shots++;
      d.rel = sol.rel;
      d.a = sol.a;
      const g = driveByGrip(c, sol.window, sol.rel),
        w = vehicleWorldPoint(c, g.mx, g.my);
      origin.x = w.x;
      origin.y = w.y;
      origin.height = g.mz;
      const profile = driveByProfile(c);
      if (sol.window === 'rear' && profile.rear === 'glass') breakDriveByPane(c, 'rear');
      else if (sol.window === 'front' && profile.front === 'glass') breakDriveByPane(c, 'front');
      return sol.a;
    }
    /* The first shot through the rear screen or the windscreen bursts it (a repair puts it back). */
    function breakDriveByPane(c, pane) {
      const damage = ensureDamage(c);
      if (damage.glass[pane] >= 2) return false;
      shatterPane(damage, pane);
      damage.glassHits[pane]++;
      c.damageVersion = (c.damageVersion || 0) + 1;
      driveBy.stats[pane === 'rear' ? 'rearScreens' : 'windscreens']++;
      const seat = driveBySeat(c),
        p = vehicleWorldPoint(c, pane === 'rear' ? seat.back * 0.92 : seat.front, 0),
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
          if (!sol.ok) continue;
          const score = d + (sol.window === 'left' || sol.window === 'open' ? 0 : 60);
          if (score < bestScore && clearSight(player, t)) {
            bestScore = score;
            best = t;
          }
        }
      if (best) return headingBetween(c, best);
      return normalizeAngle(c.a - Math.PI / 2);
    }
    /* A map point (x, y, height) on screen: the 3D camera's projection, else the 2D view's; in the chase view
       the chase camera's (with or without a renderer; `behind` when it lies behind the camera). */
    function driveByScreenPoint(x, y, height) {
      if (chaseCameraLive()) return chaseProject(x, y, height, { x: 0, y: 0, depth: 0, behind: false });
      if (city3D) return city3D.project(x, y, height);
      return { x: (x - cameraTarget.x) * canvasScale + viewportWidth / 2, y: (y - cameraTarget.y) * canvasScale + viewportHeight / 2 };
    }
    /* Where the blocked-aim cross sits: along the aim, a few metres past the body, at the sill. */
    function driveByCrossPoint(c, rel) {
      const spec = vehicleSpec(c),
        reach = Math.abs(Math.cos(rel)) * spec.l * 0.5 + Math.abs(Math.sin(rel)) * spec.w * 0.5 + DRIVE_BY_CROSS_REACH,
        a = c.a + rel;
      return { x: c.x + Math.cos(a) * reach, y: c.y + Math.sin(a) * reach, height: entityElevation(c) + driveBySeat(c).belt };
    }
    /* The blocked-aim cross (HUD, game-loop.js; 2D and 3D): a moment after each pull into a blocked sector. */
    function updateDriveByCross() {
      const el = getElement('driveByCross'),
        d = driveBy,
        c = player.car;
      if (!el) return;
      const age = gameTime - d.crossAt,
        live = !!c && d.car === c && gameMode === 'play' && age >= 0 && age < DRIVE_BY_CROSS_LIFE,
        p = live ? driveByCrossPoint(c, d.crossRel) : null,
        s = live ? driveByScreenPoint(p.x, p.y, p.height) : null,
        // (The chase camera can look away from it: none behind the camera.)
        show = live && !(chaseCameraLive() && s.behind);
      el.classList.toggle('hidden', !show);
      if (!show) return;
      el.style.transform = 'translate(' + s.x.toFixed(0) + 'px,' + s.y.toFixed(0) + 'px)';
      el.style.opacity = (1 - (age / DRIVE_BY_CROSS_LIFE) ** 2).toFixed(2);
    }
    function driveByReport() {
      const c = player.car,
        d = driveBy,
        profile = c ? driveByProfile(c) : null,
        deg = (r) => Math.round(r / DRIVE_BY_DEG);
      return {
        vehicle: c?.type || null,
        body: profile?.body || null,
        front: profile ? profile.front : null,
        rear: profile ? profile.rear : null,
        arcs: c && profile ? driveByArcs(c).map(([a, b, w]) => ({ window: w, from: deg(a), to: deg(b) })) : [],
        // Why no arm comes out: the first of the conditions driveByArmed needs that fails.
        armed: !c ? 'no vehicle' : c.hp <= 0 ? 'wrecked' : !profile ? 'no profile' : isApache(c) ? 'apache' : transitRide || taxiRide ? 'riding' : gameMode !== 'play' ? gameMode : selectedWeaponIndex !== 0 || !weaponIsEquipped(0) ? 'no pistol' : 'yes',
        out: +d.out.toFixed(2),
        window: d.window,
        relDeg: deg(d.rel),
        aim: d.aim,
        pending: d.pending,
        // The blocked-aim cross: showing now, and where (degrees off the nose).
        cross: gameTime - d.crossAt < DRIVE_BY_CROSS_LIFE,
        crossDeg: deg(d.crossRel),
        frontGlass: c?.damage?.glass?.front ?? null,
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
          const probe = { type, a: 0, damage: null },
            profile = driveByProfile(probe);
          return { type, profile, arcs: (driveByArcs(probe) || []).map(([a, b, w]) => ({ window: w, from: Math.round(a / DRIVE_BY_DEG), to: Math.round(b / DRIVE_BY_DEG) })) };
        },
        // Where an aim `relDegrees` off the nose would fire from the current vehicle (no shot).
        driveByCheck(relDegrees) {
          if (!player.car) throw Error('Not in a vehicle');
          const sol = driveByAim(player.car, player.car.a + relDegrees * DRIVE_BY_DEG);
          return { ok: sol.ok, blocked: sol.blocked, window: sol.window, relDeg: Math.round(sol.rel / DRIVE_BY_DEG), offDeg: Math.round(sol.off / DRIVE_BY_DEG), why: sol.why };
        },
        // The viewport pixel of the point `metres` from the current vehicle, `relDegrees` off
        // its nose, at the gun's height: where a test puts the real mouse to aim there.
        driveByScreenPoint(relDegrees, metres = 20) {
          const c = player.car;
          if (!c) throw Error('Not in a vehicle');
          const a = c.a + relDegrees * DRIVE_BY_DEG,
            r = metres * UNITS_PER_METRE,
            s = driveByScreenPoint(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, entityElevation(c) + 0.8 * PERSON_HEIGHT);
          return { x: Math.round(s.x), y: Math.round(s.y), viewport: [viewportWidth, viewportHeight] };
        },
        // Hold the aim `relDegrees` off the vehicle's nose (as the aim stick does), null lets
        // it go; `fire` true also holds the trigger, 'raise' holds the arm out without firing
        // (for pictures). Step with simulate()/wait to see the arm come out.
        driveByAim(relDegrees = null, fire = false) {
          driveBy.raised = driveBy.holdFire = false;
          driveBy.holdRel = null;
          if (relDegrees === null || !player.car) touchAim = null;
          else {
            // Empty-handed at the wheel: draw the pistol as the fire key does (shoot()).
            if (selectedWeaponIndex === FISTS_INDEX && weapons[0]?.owned) selectWeapon(0);
            driveBy.holdRel = relDegrees * DRIVE_BY_DEG;
            touchAim = normalizeAngle(player.car.a + driveBy.holdRel);
            driveBy.holdFire = fire === true;
            driveBy.raised = fire === 'raise';
          }
          return driveByReport();
        },
      };
    }
