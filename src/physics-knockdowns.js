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
      if (p.hp <= 0) return;
      if (p.ejected) stepEjection(p, deltaSeconds);
      if (p.knockedFor > 0) {
        p.aiming = false;
        p.knockedFor = Math.max(0, p.knockedFor - deltaSeconds);
        if (
          p.knockedFor < 0.55 &&
          vehicles.some((c) => sameFloor(c, p) && pointInCar(p.x, p.y, c, 6))
        )
          p.knockedFor = 0.6;
        if (p.knockedFor === 0) {
          p.dazedFor = 1.4;
          p.flee = 8;
        }
      } else if (p.dazedFor > 0) {
        p.aiming = false;
        p.dazedFor = Math.max(0, p.dazedFor - deltaSeconds);
      }
    }
    function knockPerson(person, c, speed) {
      const kph = worldMeters(speed) * 3.6;
      if (kph < 0.1 || (person.impactCooldown || 0) > 0 || (kph < 20 && personIncapacitated(person)))
        return;
      const a = Math.atan2(c.vy, c.vx),
        source = c === player.car ? player : c;
      // These are gameplay thresholds, not a prediction of real-world injury.
      const damage = kph < 20 ? 0 : Math.min(250, 36 * ((kph - 20) / 27) ** 2);
      person.impactCooldown = 0.9;
      person.threat = {
        x: c.x,
        y: c.y,
      };
      person.flee = 8;
      person.aiming = false;
      scream(person);
      if (damage > 0) {
        const fatal = damage >= person.hp;
        strikePerson(person, damage, a, source, fatal, 'impact');
        if (bloodOn && fatal) {
          c.bloodyUntil = gameTime + 14;
          c.bloodTrackRemaining = BLOOD_TRACK_DISTANCE;
          c.bloodTrackSides = [-1, 1];
        }
      } else if (person.faction && !person.military && source === player) alertGang(person.faction);
      if (person.hp > 0) {
        person.knockedFor = 3.5 + Math.min(1.5, kph / 30);
        person.dazedFor = 0;
      }
      const vehicleDefinition = vehicleSpec(c),
        headingCosine = Math.cos(c.a),
        headingSine = Math.sin(c.a),
        side = Math.sign(-(person.x - c.x) * headingSine + (person.y - c.y) * headingCosine) || 1;
      const candidates = [
        {
          x: person.x + Math.cos(a) * clamp(speed * 0.15, 12, 45),
          y: person.y + Math.sin(a) * clamp(speed * 0.15, 12, 45),
        },
        ...[side, -side].map((s) => ({
          x: person.x - headingSine * s * (vehicleDefinition.w / 2 + 14),
          y: person.y + headingCosine * s * (vehicleDefinition.w / 2 + 14),
        })),
      ];
      for (const q of candidates)
        if (
          !solid(q.x, q.y, 6) &&
          !vehicles.some((o) => sameFloor(o, q) && pointInCar(q.x, q.y, o, 6))
        ) {
          person.x = q.x;
          person.y = q.y;
          break;
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
      const distance = Math.hypot(c.x - from.x, c.y - from.y),
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
      prev.x = last ? last.x : c.x;
      prev.y = last ? last.y : c.y;
      prev.a = last ? last.a : c.a;
      if (!c.bloodTrackPoint) c.bloodTrackPoint = { x: 0, y: 0, a: 0 };
      c.bloodTrackPoint.x = c.x;
      c.bloodTrackPoint.y = c.y;
      c.bloodTrackPoint.a = c.a;
      if (!active || !bloodOn || isBoat(c) || isAircraft(c) || (c.altitude || 0) > 3) {
        if (!bloodOn) c.bloodTrackRemaining = 0;
        return;
      }
      const distance = Math.hypot(c.x - prev.x, c.y - prev.y);
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
