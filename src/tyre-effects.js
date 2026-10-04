    // What the tyres leave behind: the burnout (forward and the handbrake held at a standstill),
    // skid marks, and the one rule for tyre smoke, dust and spray the renderers read (tyreEmission).
    /**
     * TYRE EFFECTS (game logic; tyresmoke3d.js and offroad3d-mud.js only draw what it says)
     *  - BURNOUT (burnoutStep, from the player's controls in physics-driving.js): forward
     *    and the handbrake held at walking pace or less, in a car (not a motorbike,
     *    bicycle or tank, not on the trails' own tyre model). The driven wheels spin
     *    (the rears on a rear-driven car, the fronts on a front-driven one, all four on a
     *    4x4) while the brakes hold the car; `c.burnout.heat` builds over
     *    BURNOUT_HEAT_TIME of spinning (the smoke thickens) and cools when it stops.
     *    Letting go of the handbrake launches the car on tyres still spinning.
     *  - SKID MARKS (layTyreMarks, `skids`): only when the tyres really slide: a slide
     *    past ~15 degrees, the handbrake's locked rears, wheels locked without ABS, a long
     *    understeer scrub (faint, the fronts), wheelspin, a burnout's patch. Each mark's
     *    `dark` (0..1) follows how hard the tyre slides; they fade as `life` runs out.
     *  - EMISSION (tyreEmission): tyre SMOKE only from a burnout on a hard surface (and
     *    the moment after it while the tyres cool). Cornering, drifting and braking on
     *    tarmac make marks and noise, never smoke. DUST on sand, lawns and dry dirt from
     *    wheels at speed or spinning (more for a 4x4, none on wet ground); SPRAY off
     *    every wheel on soaked tarmac at speed.
     */
    const BURNOUT_MAX_SPEED = 10 * KMH,
      // The brakes' hold on the car while its driven wheels spin (g).
      BURNOUT_HOLD = 0.9,
      BURNOUT_HEAT_TIME = 2.5,
      BURNOUT_COOL_TIME = 1.4,
      // How fast the spinning tyres' tread runs (units a second): the engine revs to it.
      BURNOUT_WHEEL_SPEED = 170,
      // Slide angle (lateral over along) past which the tyres lay rubber.
      MARK_SLIDE_ANGLE = 0.27,
      MARK_LIFE = 40,
      // How much dust each loose ground gives (footSurfaceAt kinds).
      TYRE_DUST_GROUND = { dirt: 1, gravel: 0.9, sand: 1, rock: 0.5, mud: 0.4, grass: 0.3, snow: 0.15 };
    const tyreEffectStats = { smoke: 0, dust: 0, spray: 0, marks: 0, distance: 0, burnoutSeconds: 0, burnoutMaxKmh: 0, since: 0 };
    const tyreGroundCache = new WeakMap();
    /* The ground under a vehicle (footSurfaceAt), looked up again after it moves 12
       units or half a second. */
    function tyreGroundKind(c) {
      let g = tyreGroundCache.get(c);
      if (!g) tyreGroundCache.set(c, (g = { kind: 'asphalt', x: NaN, y: NaN, at: -1 }));
      if (!(Math.abs(c.x - g.x) + Math.abs(c.y - g.y) < 12) || gameTime - g.at > 0.5 || gameTime < g.at) {
        g.kind = footSurfaceAt(c.x, c.y);
        // The runways are tarmac (footSurfaceAt only knows the old airport's apron).
        if (g.kind === 'grass' && runwayUnder(c.x, c.y, 0)) g.kind = 'asphalt';
        g.x = c.x;
        g.y = c.y;
        g.at = gameTime;
      }
      return g.kind;
    }
    /* The trails and the county's open land: offroad3d-mud.js throws their mud and dust. */
    function offroadGround(c) {
      if (c.offroadState) return !c.offroadState.paved;
      return c.x > CITY_SIZE - 200 && landAt(c.x, c.y) && !onRoad(c.x, c.y) && !onCountyRoad(c.x, c.y, 2);
    }
    // Which wheels an engine turns.
    function drivenAxle(c) {
      const drive = drivingCharacter(c).drive;
      return drive === 'fwd' ? 'front' : drive === '4x4' ? 'all' : 'rear';
    }
    /* One step of the burnout for the player's car: returns true while it holds the
       car with its driven wheels spinning. */
    function burnoutStep(c, spec, stepSeconds) {
      const b = c.burnout || (c.burnout = { active: false, heat: 0, time: 0, axle: 'rear' }),
        eligible = !spec.bike && !spec.bicycle && !spec.tank && !c.offroadState && !isAircraft(c) && !isBoat(c),
        held = eligible && actionHeld('forward') && actionHeld('handbrake') && !actionHeld('back'),
        // Once lit it holds a little past the start limit (the car shuffles on its tyres).
        slow = Math.hypot(c.vx || 0, c.vy || 0) < BURNOUT_MAX_SPEED * (b.active ? 1.5 : 1);
      b.active = held && slow;
      if (b.active) {
        b.axle = drivenAxle(c);
        b.time += stepSeconds;
        b.heat = Math.min(1, b.heat + stepSeconds / BURNOUT_HEAT_TIME);
      } else {
        b.time = 0;
        b.heat = Math.max(0, b.heat - stepSeconds / BURNOUT_COOL_TIME);
      }
      return b.active;
    }
    function pushTyreMark(c, spec, forward, side, a, len, dark, counted) {
      const cos = Math.cos(c.a),
        sin = Math.sin(c.a),
        track = spec.bike ? 0 : spec.w * 0.4,
        x = c.x + cos * forward - sin * side * track,
        y = c.y + sin * forward + cos * side * track;
      // h0 / h1: the ground under the mark's two ends, worked out once here (the renderer drew every mark from two
      // terrain lookups each frame, up to 2,200 a frame for marks that never move).
      skids.push({
        x,
        y,
        a,
        len,
        dark: clamp(dark, 0.05, 1),
        w: spec.bike ? 1.2 : clamp(spec.w * 0.11, 1.3, 3),
        life: MARK_LIFE,
        h0: terrainHeight(x, y) + 0.2,
        h1: terrainHeight(x + Math.cos(a) * len, y + Math.sin(a) * len) + 0.2,
      });
      if (counted) tyreEffectStats.marks++;
    }
    /* Rubber on the road from the player's vehicle (s: along, lateral, handbrake,
       brakeDecel, pedalled, burnout). Called every physics step; lays at 40 Hz. */
    function layTyreMarks(c, spec, tyres, s) {
      // Rubber marks only hard ground; loose ground takes tracks (offroad3d-mud.js) and dust.
      if (s.pedalled || spec.tank || !tyres || tyreGroundKind(c) in TYRE_DUST_GROUND) return;
      const speed = Math.hypot(c.vx || 0, c.vy || 0),
        slideAngle = Math.abs(s.lateral) / Math.max(Math.abs(s.along), 20),
        axle = drivenAxle(c);
      // A burnout: a black patch under the spinning tyres, a smudge five times a second.
      if (s.burnout) {
        if (tyres.spin > 0.5 && Math.floor(physicsClock * 5) !== c.lastSkid) {
          c.lastSkid = Math.floor(physicsClock * 5);
          const b = c.burnout;
          for (const forward of axle === 'all' ? [0.3, -0.3] : [axle === 'front' ? 0.3 : -0.3])
            for (const side of spec.bike ? [0] : [-1, 1]) pushTyreMark(c, spec, forward * spec.l - 1.8, side, c.a, 3.6, 0.12 + 0.3 * b.heat, true);
        }
        return;
      }
      if (Math.floor(physicsClock * 40) === c.lastSkid) return;
      let front = 0,
        rear = 0;
      // A real slide (past ~15 degrees): the rears, all four when well sideways.
      if (speed > 25 * KMH && slideAngle > MARK_SLIDE_ANGLE) {
        rear = 0.35 + 0.65 * clamp((slideAngle - MARK_SLIDE_ANGLE) / 0.5, 0, 1);
        if (slideAngle > 0.6) front = rear * 0.6;
      }
      // The handbrake's locked rears sliding.
      if (s.handbrake && Math.abs(s.along) > 25 * KMH) rear = Math.max(rear, 0.75);
      // Wheels locked by the brakes (ABS off, or none fitted): black lines.
      if (s.brakeDecel > 0 && s.along > 20 * KMH) {
        if (tyres.lock[0] > 0.6) front = Math.max(front, tyres.lock[0]);
        if (tyres.lock[1] > 0.6) rear = Math.max(rear, tyres.lock[1]);
      }
      // A long understeer scrub: faint lines from the fronts.
      if ((c.skid || 0) > 0.5) front = Math.max(front, 0.2 + 0.3 * c.skid);
      // Wheelspin pulling away (TCS off, or the moment after a burnout).
      if (tyres.spin > 0.4 && speed > 2 * KMH) {
        const d = 0.25 + 0.6 * tyres.spin;
        if (axle !== 'rear') front = Math.max(front, d);
        if (axle !== 'front') rear = Math.max(rear, d);
      }
      if (!front && !rear) return;
      c.lastSkid = Math.floor(physicsClock * 40);
      const a = speed > 1 ? Math.atan2(c.vy, c.vx) : c.a,
        len = speed / 40 + 1.5;
      for (const side of spec.bike ? [0] : [-1, 1]) {
        if (front && !spec.bike) pushTyreMark(c, spec, 0.3 * spec.l, side, a, len, front, true);
        if (rear || spec.bike) pushTyreMark(c, spec, -0.3 * spec.l, side, a, len, Math.max(rear, front), true);
      }
    }
    /* Dust puffs a second from one wheel on loose dry ground (offroad3d-mud.js on the
       trails and the county, tyresmoke3d.js on sand and lawns): with speed and
       wheelspin, more from a 4x4's wheels, none once the ground is wet. */
    function tyreDustRate(c, driven) {
      const spec = vehicleSpec(c),
        speed = Math.hypot(c.vx || 0, c.vy || 0),
        spin = spec.bicycle ? 0 : c.wheelSpin || 0,
        ground = TYRE_DUST_GROUND[tyreGroundKind(c)] ?? 0.3,
        dry = 1 - clamp(weather.wet || 0, 0, 1),
        four = spec.offroad || drivenAxle(c) === 'all' ? 1.6 : 1;
      return dry * ground * four * (clamp((speed - 8 * KMH) / (40 * KMH), 0, 1.6) * 7 + spin * 30) * (driven ? 1 : 0.5);
    }
    /* What one vehicle's tyres throw up now: `kind` 'smoke' (a burnout on a hard
       surface), 'sand', 'lawn' or 'dust' (loose city ground), 'offroad' (the trails and
       the county: offroad3d-mud.js), 'spray' (soaked tarmac) or null; `rate` in puffs a
       second per wheel of `axle` ('rear', 'front' or 'all'); `heat` the burnout's. */
    const tyreEmissionOut = { kind: null, rate: 0, axle: 'rear', heat: 0 };
    function tyreEmission(c) {
      const out = tyreEmissionOut;
      out.kind = null;
      out.rate = 0;
      out.axle = 'rear';
      out.heat = 0;
      const spec = vehicleSpec(c);
      if (spec.tank || isAircraft(c) || isBoat(c) || c.cliffAir || c.deckAir || c.overturned || c.fallen) return out;
      const speed = Math.hypot(c.vx || 0, c.vy || 0),
        spin = spec.bicycle ? 0 : c.wheelSpin || 0;
      if (!(speed > 4 * KMH) && !(spin > 0.3)) return out;
      const slip = c === player.car ? c.tyreSlip || 0 : c.sliding ? 0.7 : 0,
        dry = 1 - 0.85 * clamp(weather.wet || 0, 0, 1),
        spinAxle = spin > 0.3 ? drivenAxle(c) : 'rear';
      if (offroadGround(c)) {
        out.kind = 'offroad';
        if ((c.surfaceMud || 0) <= 0.1) out.rate = (tyreDustRate(c, true) + tyreDustRate(c, spinAxle === 'all')) / 2;
        out.axle = 'all';
        return out;
      }
      const ground = tyreGroundKind(c);
      if (ground === 'sand' || ground === 'grass') {
        out.kind = ground === 'sand' ? 'sand' : 'lawn';
        out.rate =
          dry *
          (ground === 'sand'
            ? clamp((speed - 12 * KMH) / (60 * KMH), 0, 1) * 16 + slip * 30 + spin * 20
            : clamp((speed - 30 * KMH) / (60 * KMH), 0, 1) * 3 + slip * 12 + spin * 14);
        out.axle = spinAxle;
        return out;
      }
      if (ground in TYRE_DUST_GROUND) {
        out.kind = 'dust';
        out.rate = tyreDustRate(c, true);
        out.axle = spinAxle;
        return out;
      }
      if (spec.bicycle) return out;
      // Hard ground: smoke only from a burnout, thickening with its heat, and while it cools.
      const heat = c.burnout ? c.burnout.heat : 0;
      if (heat > 0.02 && spin > 0.15) {
        out.kind = 'smoke';
        out.rate = (3 + 19 * heat) * Math.min(1, spin * 1.25);
        out.axle = c.burnout.axle;
        out.heat = heat;
        return out;
      }
      const wet = weather.wet || 0;
      if (wet > 0.25 && speed > 35 * KMH) {
        out.kind = 'spray';
        out.rate = clamp((speed - 35 * KMH) / (90 * KMH), 0, 1) * (wet - 0.2) * 34;
        out.axle = 'all';
      }
      return out;
    }
    /* Adds up, for DeadEndCity.tyreEffects(), what the player's tyres threw up (puffs
       per wheel of the axle, before the graphics tier's share) and how far the car went. */
    function tyreEffectsStep(c, stepSeconds) {
      const e = tyreEmission(c),
        wheels = e.axle === 'all' ? 4 : 2,
        speed = Math.hypot(c.vx || 0, c.vy || 0);
      if (e.kind === 'smoke') tyreEffectStats.smoke += e.rate * wheels * stepSeconds;
      else if (e.kind === 'spray') tyreEffectStats.spray += e.rate * wheels * stepSeconds;
      else if (e.kind) tyreEffectStats.dust += e.rate * wheels * stepSeconds;
      tyreEffectStats.distance += speed * stepSeconds;
      tyreEffectStats.since += stepSeconds;
      if (c.burnout?.active) {
        tyreEffectStats.burnoutSeconds += stepSeconds;
        tyreEffectStats.burnoutMaxKmh = Math.max(tyreEffectStats.burnoutMaxKmh, speed / KMH);
      }
    }
    /* DeadEndCity.tyreEffects(reset): the player's burnout, what the tyres throw up now
       and the totals since the last reset (smoke, dust and spray puffs, skid marks laid,
       metres driven, burnout seconds and its top speed). */
    function tyreEffectsReport(reset = false) {
      const round = (v, k = 10) => Math.round(v * k) / k;
      if (reset) for (const k in tyreEffectStats) tyreEffectStats[k] = 0;
      const c = player.car,
        e = c ? tyreEmission(c) : null,
        b = c?.burnout;
      return {
        car: c ? c.type : null,
        ground: c ? tyreGroundKind(c) : null,
        burnout: b ? { active: b.active, heat: round(b.heat, 100), seconds: round(b.time), axle: b.axle } : null,
        emitting: e ? { kind: e.kind, rate: round(e.rate), axle: e.axle } : null,
        wheelSpin: c ? round(c.wheelSpin || 0, 100) : 0,
        totals: {
          smoke: round(tyreEffectStats.smoke),
          dust: round(tyreEffectStats.dust),
          spray: round(tyreEffectStats.spray),
          marks: tyreEffectStats.marks,
          metres: round(worldMeters(tyreEffectStats.distance)),
          burnoutSeconds: round(tyreEffectStats.burnoutSeconds),
          burnoutMaxKmh: round(tyreEffectStats.burnoutMaxKmh),
          seconds: round(tyreEffectStats.since),
        },
        liveMarks: skids.length,
      };
    }
