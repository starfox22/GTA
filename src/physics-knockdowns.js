    // People knocked down by vehicles, swept person contacts, blood tracks.
    function personIncapacitated(p) {
      return p.hp > 0 && ((p.knockedFor || 0) > 0 || (p.dazedFor || 0) > 0);
    }
    function personFallAmount(p) {
      // The dead go down over half a second (wounds.js); the knocked-down at once.
      return p.hp <= 0 ? deathFallAmount(p) : clamp((p.knockedFor || 0) / 0.55, 0, 1);
    }
    function updateKnockdowns(deltaSeconds) {
      // Walk the four lists in place rather than copying ~700 people every frame.
      for (const list of [pedestrians, enemies, gangMembers, officers])
        for (const p of list) updateKnockdown(p, deltaSeconds);
    }
    function updateKnockdown(p, deltaSeconds) {
      if (p.impactCooldown > 0) p.impactCooldown = Math.max(0, p.impactCooldown - deltaSeconds);
      // A fatal car strike keeps carrying the body through the same arc; death
      // must not freeze it beside the bumper or leave its pool at the take-off.
      if (p.ejected?.vehicleHit && (p.hp > 0 || p.ejected.phase !== 'down')) stepRiderEjection(p, p.ejected, deltaSeconds);
      if (p.hp <= 0) {
        p.dying = null;
        return;
      }
      if (p.dying) stepDying(p, deltaSeconds);
      if (p.hp <= 0) return;
      if (p.ejected && !p.ejected.vehicleHit) stepEjection(p, deltaSeconds);
      if (p.knockedFor > 0) {
        p.aiming = false;
        p.knockedFor = Math.max(0, p.knockedFor - deltaSeconds);
        if (p.knockedFor < 0.55) {
          const on = vehicles.find((c) => sameFloor(c, p) && pointInCar(p.x, p.y, c, 6));
          if (on) {
            p.knockedFor = 0.6;
            // Down against a car that has stopped (often one waiting for them to get
            // out of its way, like an ambulance): they crawl out from under it.
            if (Math.hypot(on.vx || 0, on.vy || 0) < 2 * KMH) stepClearOfCar(p, on, deltaSeconds);
          }
        }
        if (p.knockedFor === 0) {
          p.dazedFor = 1.4;
          p.flee = 8;
        }
      } else if (p.dazedFor > 0) {
        p.aiming = false;
        p.dazedFor = Math.max(0, p.dazedFor - deltaSeconds);
      }
    }
    /* Out from under (or inside the outline of) car `c` at `speed` (a crawl, about
       1.5 m/s, by default): to its nearer side, 12 units clear of it, or the other
       side, or past its nose or tail, whichever is open ground. moveBody cannot
       take anyone out of a car they overlap (every step collides). */
    function stepClearOfCar(p, c, deltaSeconds, speed = 12) {
      const spec = vehicleSpec(c),
        ca = Math.cos(c.a),
        sa = Math.sin(c.a),
        dx = p.x - c.x,
        dy = p.y - c.y,
        along = dx * ca + dy * sa,
        lateral = -dx * sa + dy * ca,
        side = Math.sign(lateral) || 1,
        end = Math.sign(along) || 1,
        inside = clamp(along, -spec.l / 2, spec.l / 2);
      for (const [a, l] of [
        [inside, side * (spec.w / 2 + 12)],
        [inside, -side * (spec.w / 2 + 12)],
        [end * (spec.l / 2 + 12), lateral],
        [-end * (spec.l / 2 + 12), lateral],
      ]) {
        const x = c.x + a * ca - l * sa,
          y = c.y + a * sa + l * ca;
        if (solid(x, y, 5)) continue;
        const d = hypot2(x - p.x, y - p.y),
          step = Math.min(d, speed * deltaSeconds);
        if (d > 0.01) {
          p.x += ((x - p.x) / d) * step;
          p.y += ((y - p.y) / d) * step;
        }
        return;
      }
    }
    // One launch rule for the player and everyone else. The bumper takes the
    // legs; a low bonnet wraps the body upwards, a tall flat front mostly pushes
    // it ahead. Edge strikes spill sideways. Units remain metres/seconds scaled
    // by UNITS_PER_METRE; GRAVITY, not an animation curve, determines the arc.
    function vehicleImpactState(person, c, speed) {
      const spec = vehicleSpec(c),
        a = Math.atan2(c.vy, c.vx),
        fx = Math.cos(a), fy = Math.sin(a),
        across = (-(person.x - c.x) * Math.sin(c.a) + (person.y - c.y) * Math.cos(c.a)) / (spec.w / 2 + 3),
        edge = clamp(Math.abs(across), 0, 1),
        front = Math.abs(Math.cos(a - c.a)),
        tall = riderObstacleTop(c) - entityElevation(c) > 1.75 * UNITS_PER_METRE,
        ramp = (tall ? 0.56 : spec.bike ? 0.72 : 1) * (0.65 + 0.35 * front),
        carry = clamp(speed, 0, 150 * KMH) * (0.72 - edge * 0.16),
        sideways = carry * Math.sign(across) * edge * 0.18,
        lift = clamp(speed * 0.29 * ramp, 1.4 * UNITS_PER_METRE, 7.8 * UNITS_PER_METRE),
        t = riderThrowState(fx * carry - fy * sideways, fy * carry + fx * sideways, RIDER_SEAT, lift, 'vehicle', [c, null], person);
      t.vehicleHit = true;
      t.rider = true;
      t.source = c === player.car ? player : c;
      t.ignoreUntil = 0.85;
      t.pitch = -0.12;
      t.spin = clamp(speed / UNITS_PER_METRE * 0.36, 2.2, 6.8) * (0.85 + edge * 0.15);
      t.bank = Math.sign(across) * edge * 0.18;
      t.bankSpin = Math.sign(across) * (0.3 + edge * 1.3);
      t.slideSpin = Math.sign(across) * edge * 1.2;
      t.rollShare = 0.65;
      t.crashHurt = 0;
      t.baseElevation = entityElevation(person);
      return t;
    }
    function vehicleImpactDamage(kph) {
      // These are gameplay thresholds, not a prediction of real-world injury.
      return kph < 20 ? 0 : Math.min(250, 36 * ((kph - 20) / 27) ** 2);
    }
    function hitPlayerWithVehicle(c, speed) {
      if (player.thrown || gameMode !== 'play') return false;
      cancelPlayerJump();
      cancelCarjack();
      player.sceneSeat = null;
      player.thrown = vehicleImpactState(player, c, speed);
      const t = player.thrown;
      t.crashHurt = vehicleImpactDamage(speed / KMH);
      hurt(t.crashHurt, 'impact', t.heading);
      // die() keeps this flight; invulnerability only prevents an immediate
      // second bumper hit, never the later contact with a wall or the road.
      if (player.hp > 0) player.inv = 0.6;
      addCarStain(c, player, speed / KMH, player.hp <= 0);
      shake = Math.max(shake, clamp(speed / 30, 2, 8));
      if (player.hp > 0) tell('STRUCK BY A VEHICLE', 2.2, { tone: 'warn' });
      return true;
    }
    function knockPerson(person, c, speed) {
      const kph = worldMeters(speed) * 3.6;
      if (kph < 0.1 || (person.impactCooldown || 0) > 0 || (person.ejected?.vehicleHit && !['down', 'recover'].includes(person.ejected.phase))) return;
      // Someone already on the ground is run over, not knocked down (runover.js).
      if (personOnGround(person)) return runOverDowned(person, c, speed, kph);
      if (kph < 20 && personIncapacitated(person)) return;
      const a = Math.atan2(c.vy, c.vx),
        source = c === player.car ? player : c;
      const damage = vehicleImpactDamage(kph);
      if (damage > 0) {
        person.ejected = vehicleImpactState(person, c, speed);
        person.ejected.crashHurt = damage;
      }
      person.impactCooldown = 0.9;
      person.carHit = { car: c, at: gameTime };
      person.threat = {
        x: c.x,
        y: c.y,
      };
      person.flee = 8;
      person.aiming = false;
      // A cry only from someone who saw it coming (crowd-awareness.js) or felt a bump; hit unaware
      // at speed, the breath goes out of them before any sound (scream() reads mutedUntil).
      if (carNoticed(person, c) || damage <= 0) scream(person);
      else person.mutedUntil = gameTime + 0.6;
      if (damage > 0) {
        const fatal = damage >= person.hp;
        strikePerson(person, damage, a, source, fatal, 'impact');
        // The bonnet, bumper or flank takes the blood (car-stains.js; carblood3d.js draws it).
        addCarStain(c, person, kph, fatal);
        if (bloodOn && fatal) {
          c.bloodTrackRemaining = BLOOD_TRACK_DISTANCE;
          c.bloodTrackSides = [-1, 1];
        }
      } else if (person.faction && !person.military && source === player) alertGang(person.faction);
      if (person.hp > 0) {
        person.knockedFor = 3.5 + Math.min(1.5, kph / 30);
        if (person.ejected?.vehicleHit) person.ejected.minDownTime = person.knockedFor;
        person.dazedFor = 0;
      }
      if (damage <= 0) {
        const vehicleDefinition = vehicleSpec(c),
          headingCosine = Math.cos(c.a),
          headingSine = Math.sin(c.a),
          side = Math.sign(-(person.x - c.x) * headingSine + (person.y - c.y) * headingCosine) || 1,
          ahead = {
            x: person.x + Math.cos(a) * clamp(speed * 0.15, 12, 45),
            y: person.y + Math.sin(a) * clamp(speed * 0.15, 12, 45),
          },
          beside = [side, -side].map((s) => ({
            x: person.x - headingSine * s * (vehicleDefinition.w / 2 + 14),
            y: person.y + headingCosine * s * (vehicleDefinition.w / 2 + 14),
          }));
        // Walking-pace nudges stay harmless and leave the person beside the
        // vehicle, clear of its next wheel pass (nudge-aside regression).
        for (const q of [...beside, ahead])
          if (!solid(q.x, q.y, 6) && !vehicles.some((o) => sameFloor(o, q) && pointInCar(q.x, q.y, o, 6))) {
            person.x = q.x;
            person.y = q.y;
            break;
          }
      }
      // Everyone who saw it reacts: gasps, onlookers, someone to help, a call.
      // Nudging someone at walking pace is an accident, not a crime: only a hit
      // that hurts (20 km/h and up) makes the player the culprit.
      const culpable = c === player.car && damage > 0;
      crowdAlarm('knock', person, culpable ? player : null, person.hp <= 0 ? 2 : 1.3);
      if (culpable) {
        crime(person.hp <= 0 ? 0.35 : 0.08);
        if (person.hp <= 0) cash += 25;
      }
      return true;
    }
    // The car at a point along its sweep: pointInCar only reads the type (for the
    // spec), position and heading, so one scratch record stands in for a copy of
    // the whole vehicle at every sub-step.
    const sweepProbe = { type: null, airframe: null, x: 0, y: 0, a: 0 };
    function sweptPersonContact(person, c, from) {
      const distance = hypot2(c.x - from.x, c.y - from.y),
        steps = Math.min(24, Math.max(1, Math.ceil(distance / 7)));
      if (distance > 170) return pointInCar(person.x, person.y, c, 3);
      sweepProbe.type = c.type;
      sweepProbe.airframe = c.airframe;
      const turn = normalizeAngle(c.a - from.a);
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        sweepProbe.x = from.x + (c.x - from.x) * f;
        sweepProbe.y = from.y + (c.y - from.y) * f;
        sweepProbe.a = from.a + turn * f;
        if (pointInCar(person.x, person.y, sweepProbe, 3)) return true;
      }
      return false;
    }
    // Pools a tyre can pick blood up from (not tracks themselves, under three
    // minutes old): gathered once a frame in updateCars(), not per car.
    const bloodTrackPrevious = { x: 0, y: 0, a: 0 },
      bloodTrackSources = [],
      bloodTrackCandidates = [];
    function updateBloodTracks(c, active) {
      // Where the car was last frame; the record is updated in place.
      const last = c.bloodTrackPoint || c.personSweepStart,
        prev = bloodTrackPrevious;
      // (Doubles are written only when they changed: a parked vehicle's frame stores nothing, where each store allocated a boxed number.)
      const lx = last ? last.x : c.x,
        ly = last ? last.y : c.y,
        la = last ? last.a : c.a;
      if (prev.x !== lx) prev.x = lx;
      if (prev.y !== ly) prev.y = ly;
      if (prev.a !== la) prev.a = la;
      if (!c.bloodTrackPoint) c.bloodTrackPoint = { x: 0, y: 0, a: 0 };
      const point = c.bloodTrackPoint;
      if (point.x !== c.x) point.x = c.x;
      if (point.y !== c.y) point.y = c.y;
      if (point.a !== c.a) point.a = c.a;
      if (!active || !bloodOn || isBoat(c) || isAircraft(c) || (c.altitude || 0) > 3) {
        if (!bloodOn) c.bloodTrackRemaining = 0;
        return;
      }
      const distance = hypot2(c.x - prev.x, c.y - prev.y);
      if (distance > 100) {
        c.bloodTrackRemaining = 0;
        return;
      }
      if (distance < 0.001) return;
      if (!bloodTrackCandidates.length && !(c.bloodTrackRemaining > 0)) return;
      // Cheap distance test first: the surface check samples the terrain, and
      // every moving car ran it for every pool in the city each frame.
      const near = distance + vehicleSpec(c).l + 30,
        sources = bloodTrackSources,
        pools = bloodTrackCandidates;
      sources.length = 0;
      for (let i = 0; i < pools.length; i++) {
        const b = pools[i];
        if (
          Math.abs(b.x - c.x) < near &&
          Math.abs(b.y - c.y) < near &&
          Math.abs((b.surface || 0) - bloodSurface(b.x, b.y)) < 3
        )
          sources.push(b);
      }
      if (!sources.length && !(c.bloodTrackRemaining > 0)) return;
      const steps = Math.ceil(distance / 2),
        ds = distance / steps,
        vehicleDefinition = vehicleSpec(c);
      for (let i = 1; i <= steps; i++) {
        const f = i / steps,
          x = prev.x + (c.x - prev.x) * f,
          y = prev.y + (c.y - prev.y) * f,
          a = (prev.a ?? c.a) + normalizeAngle(c.a - (prev.a ?? c.a)) * f,
          headingCosine = Math.cos(a),
          headingSine = Math.sin(a);
        const picked = [];
        for (const side of [-1, 1])
          if (
            [-1, 1].some((axle) => {
              const wx =
                  x +
                  headingCosine * axle * vehicleDefinition.l * 0.32 -
                  headingSine * side * vehicleDefinition.w * 0.4,
                wy =
                  y +
                  headingSine * axle * vehicleDefinition.l * 0.32 +
                  headingCosine * side * vehicleDefinition.w * 0.4;
              return sources.some(
                (b) => (wx - b.x) ** 2 + (wy - b.y) ** 2 < (b.r * (b.grow ? 1.28 : 1) + 1.8) ** 2,
              );
            })
          )
            picked.push(side);
        if (picked.length) {
          c.bloodTrackSides = [
            ...new Set([...(c.bloodTrackRemaining > 0 ? c.bloodTrackSides || [-1, 1] : []), ...picked]),
          ];
          c.bloodTrackRemaining = BLOOD_TRACK_DISTANCE;
        }
        const used = Math.min(ds, c.bloodTrackRemaining || 0);
        c.bloodTrackRemaining = Math.max(0, (c.bloodTrackRemaining || 0) - ds);
        c.bloodTrackSpacing = (c.bloodTrackSpacing || 0) + used;
        if (c.bloodTrackSpacing >= 3) {
          c.bloodTrackSpacing %= 3;
          const fade = c.bloodTrackRemaining / BLOOD_TRACK_DISTANCE;
          for (const side of c.bloodTrackSides || [-1, 1])
            addBloodPool(
              x -
                headingCosine * vehicleDefinition.l * 0.32 -
                headingSine * side * vehicleDefinition.w * 0.4,
              y -
                headingSine * vehicleDefinition.l * 0.32 +
                headingCosine * side * vehicleDefinition.w * 0.4,
              1.1 + fade * 1.6,
              a,
              {
                track: true,
                opacity: 0.25 + fade * 0.45,
              },
            );
        }
      }
    }
    // Bounded developer fixture: one staged vehicle/person pair, found in the
    // ordinary world lists (no retained entities survive a reset or teleport).
    function vehicleImpactConsole() {
      return {
        vehicleImpactScene(who = 'player', type = 'sedan', kph = 65, lateral = 0, hp = 100) {
          if (!['player', 'pedestrian'].includes(who) || !VEHICLE_DEFINITIONS[type]) return { error: 'Use player/pedestrian and a road vehicle type.' };
          for (let i = vehicles.length - 1; i >= 0; i--) if (vehicles[i].impactFixture) {
            clearCarStains(vehicles[i]);
            vehicles.splice(i, 1);
          }
          for (let i = bleeders.length - 1; i >= 0; i--) if (bleeders[i].p.impactFixture) bleeders.splice(i, 1);
          for (let i = pedestrians.length - 1; i >= 0; i--) if (pedestrians[i].impactFixture) pedestrians.splice(i, 1);
          teleportPlayer(420, 4600);
          player.hp = 100;
          player.bloodPool = null;
          player.inv = 0;
          if (gameMode === 'dead') gameMode = 'play';
          const a = 0,
            x = player.x + (who === 'pedestrian' ? 52 : 0),
            y = player.y + (who === 'pedestrian' ? -30 : 0),
            spec = vehicleSpec({ type }),
            side = clamp(Number(lateral) || 0, -1, 1) * spec.w * 0.42,
            c = makeCar(type, x - spec.l / 2 - 12, y - side, a, false, '#b52b27');
          if (isBoat(c) || isAircraft(c)) { vehicles.splice(vehicles.indexOf(c), 1); return { error: 'Use a road vehicle.' }; }
          c.vx = c.speed = clamp(Number(kph) || 0, 1, 180) * KMH;
          c.vy = c.av = 0;
          c.occupied = false;
          c.impactFixture = who;
          if (who === 'pedestrian') {
            const p = { x, y, a: Math.PI, hp: Math.max(1, Number(hp) || 30), timer: 999, state: 'idle', stateTime: 900, flee: 0, walk: 0, impactFixture: true };
            dressPerson(p, 'casual');
            pedestrians.push(p);
          }
          return this.vehicleImpactState();
        },
        // Step this scene through play or the fatal impact's WASTED screen in
        // exact physics seconds, without depending on the browser frame rate.
        vehicleImpactAdvance(seconds = 0.1) {
          if (!vehicles.some((c) => c.impactFixture)) return null;
          const steps = Math.round(clamp(Number(seconds) || 0, 0, 20) * 120);
          for (let i = 0; i < steps && (gameMode === 'play' || gameMode === 'dead'); i++) update(1 / 120);
          return this.vehicleImpactState();
        },
        vehicleImpactState() {
          const c = vehicles.find((o) => o.impactFixture),
            p = c?.impactFixture === 'player' ? player : pedestrians.find((o) => o.impactFixture);
          if (!c || !p) return null;
          const t = p === player ? p.thrown : p.ejected;
          if (t?.vehicleHit) c.impactFixtureFlight = t;
          const f = t || c.impactFixtureFlight,
            round = (v) => +v.toFixed(3);
          return {
            who: c.impactFixture, hp: round(Math.max(0, p.hp)), dead: p.hp <= 0,
            x: round(p.x), y: round(p.y), carX: round(c.x), carY: round(c.y),
            active: !!t, phase: t?.phase || (f ? 'standing' : 'waiting'),
            heightM: round(worldMeters(f?.z || 0)), peakM: round(worldMeters(f?.peak || 0)),
            vx: round(worldMeters(f?.vx || 0)), vy: round(worldMeters(f?.vy || 0)), vz: round(worldMeters(f?.vz || 0)),
            pitch: round(f?.pitch || 0), bank: round(f?.bank || 0), time: round(f?.time || 0),
            travelledM: f ? round(worldMeters(distanceBetween(p, f.from))) : 0,
            bounces: f?.bounces || 0, hits: f?.hits || 0, down: round(p.knockedFor || 0),
            recovery: round(f?.recovery || 0), pool: !!p.bloodPool,
            overruns: p.overruns || 0, gameMode,
          };
        },
      };
    }
