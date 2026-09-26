    // Contact resolution, crash severity, damage and injury (resolveContact, damageVehicle, repairVehicle).
    // `detail` says what did the damage so damage.js can shape it: a crash crumples
    // along the contact normal, a blast dishes in the face toward it, a bullet only
    // holes the skin. Without a detail the hit dents toward the centre as before.
    function damageVehicle(vehicle, amount, x = vehicle.x, y = vehicle.y, source = null, detail = null) {
      if (vehicle.hp <= 0 || amount <= 0) return;
      if (source) {
        vehicle.lastDamagedAt = gameTime;
        vehicle.lastAttacker = source;
        if (vehicle.ai && vehicle.type !== 'police') {
          vehicle.panicUntil = gameTime + 9;
          vehicle.threat = {
            x: source.x,
            y: source.y,
          };
        }
      }
      if (vehicle.locked && !vehicle.lockBroken && source) breakVehicleLock(vehicle, source);
      vehicle.hp = Math.max(0, vehicle.hp - amount);
      vehicle.damageVersion = (vehicle.damageVersion || 0) + 1;
      vehicle.sprite = null;
      recordVehicleDamage(vehicle, amount, x, y, detail);
    }
    function repairVehicle(vehicle) {
      vehicle.hp = vehicle.maxhp;
      vehicle.damage = freshDamage();
      vehicle.dents = [];
      vehicle.hop = null;
      vehicle.damageVersion = (vehicle.damageVersion || 0) + 1;
      vehicle.deadTime = 0;
      vehicle.sprite = null;
    }
    // Closing speed (about 55 km/h) above which the player ramming an occupied
    // car is a reported crime (collisionImpact here, crowdCrash in crowd.js).
    const RECKLESS_CRASH_SPEED = 55 * KMH;
    /**
     * CRASH SEVERITY
     * What a crash costs each body follows the speed change it suffers (delta-v,
     * the measure accident investigators use), not the closing speed: in a
     * perfectly plastic collision a body of mass m hit by one of mass M changes
     * speed by closing x M / (m + M). A wall or anything immovable is M = infinity,
     * so the car loses all of it; two equal cars each lose half (a head-on at a
     * 100 km/h closing speed is two 50 km/h wall crashes); a sedan struck by a box
     * truck takes nearly the whole closing speed while the truck barely notices,
     * and a tank shrugs off what flattens the car. The share of the vehicle's hit
     * points is ((delta-v - 10 km/h) / 190 km/h)^1.5: a sedan into a wall loses
     * about 10% at 50 km/h, a quarter at 80, half at 120 and is burning by 160.
     */
    const CRASH_DAMAGE_FLOOR = 10 * KMH,
      CRASH_DAMAGE_SCALE = 190 * KMH;
    function crashDeltaV(self, other, closing) {
      if (!other) return closing;
      const m = vehicleSpec(self).mass || 1.25,
        otherMass = vehicleSpec(other).mass || 1.25;
      return (closing * otherMass) / (m + otherMass);
    }
    function crashSeverity(vehicle, deltaV) {
      if (deltaV <= CRASH_DAMAGE_FLOOR) return 0;
      const share = Math.min(1.2, Math.pow((deltaV - CRASH_DAMAGE_FLOOR) / CRASH_DAMAGE_SCALE, 1.5)),
        spec = vehicleSpec(vehicle);
      // Armour: a tank's crash damage is a tenth of a car's share.
      return share * (vehicle.maxhp || spec.hp || 150) * (spec.tank ? 0.1 : 1);
    }
    // What a crash does to the driver: belted and airbagged, a 50 km/h delta-v is a
    // few points and 120 km/h about a third of a life; a rider takes twice that,
    // a truck cab or bus seat less, a tank's crew next to nothing.
    function crashInjury(vehicle, deltaV) {
      const kmh = deltaV / KMH;
      if (kmh <= 25) return 0;
      const spec = vehicleSpec(vehicle) || {};
      return Math.pow(kmh - 25, 1.5) * 0.03 * (spec.bike ? 2 : spec.tank ? 0.1 : spec.mass >= 4 ? 0.6 : 1);
    }
    /* DRIVERS' CRASHES AND SLIDES (the developer console's aiDriving()): crashes
       with a driver at the wheel that the player's car took no part in, and
       slides (the body more than 15 degrees off the way it is going above
       40 km/h), counted for traffic and police, dry or wet. */
    const driverStats = { since: 0, wetTime: 0, trafficCrashes: 0, policeCrashes: 0, trafficSlides: 0, policeSlides: 0, closings: [] };
    function noteDriverCrash(a, b, closing) {
      if (a === player.car || b === player.car || closing < 19 * KMH) return;
      const driven = (v) => v && v.hp > 0 && (v.ai || (v.cop && !v.crewDeployed && !v.blockade));
      if (!driven(a) && !driven(b)) return;
      if ((a.cop && driven(a)) || (b?.cop && driven(b))) driverStats.policeCrashes++;
      else driverStats.trafficCrashes++;
      driverStats.closings.push(Math.round(closing / KMH));
      if (driverStats.closings.length > 30) driverStats.closings.shift();
    }
    function collisionImpact(a, b, hit, closing, key, staticBody = null) {
      // Below about 19 km/h nothing bends.
      if (closing < 19 * KMH) {
        // Too soft to damage anything, but a parking knock is still heard (quietly).
        const heavier = Math.max(vehicleSpec(a).mass || 1.25, b ? vehicleSpec(b).mass || 1.25 : 0);
        if (closing >= 12)
          crashSound({
            x: hit.x,
            y: hit.y,
            closing,
            mass: heavier,
            other: b ? (heavier < 0.6 ? 'prop' : 'car') : 'wall',
            glass: 0,
            sliding: 0,
            key,
          });
        return;
      }
      const last = impactContacts.get(key);
      if (last && physicsClock - last.time < 0.24) return;
      impactContacts.set(key, {
        time: physicsClock,
      });
      crowdCrash(a, b, hit, closing);
      noteDriverCrash(a, b, closing);
      // The contact normal points from a to b, so each body is crushed back along it
      // toward its own middle; how far depends on the closing speed and on how heavy
      // the other side is (a wall counts as immovable).
      const crash = (self, other, sign) => ({
        kind: 'crash',
        nx: -hit.n.x * sign,
        ny: -hit.n.y * sign,
        closing,
        otherMass: other ? vehicleSpec(other).mass || 1.25 : 0,
      });
      // Panes already broken, so the crash sound knows whether this hit broke glass.
      const brokenGlass = () =>
        [a, b].reduce(
          (n, v) => n + (v?.damage?.glass ? Object.values(v.damage.glass).filter((g) => g === 2).length : 0),
          0,
        ),
        glassBefore = brokenGlass();
      for (const [self, other, sign] of b ? [[a, b, 1], [b, a, -1]] : [[a, null, 1]]) {
        let severity = crashSeverity(self, crashDeltaV(self, other, closing));
        // Under a tank's tracks a car is crushed, not merely dented.
        if (other && vehicleSpec(other).tank && !vehicleSpec(self).tank) severity *= 2.5;
        const amount =
          self.type === 'plane' && self.altitude > 2 ? Math.max(severity, closing * 0.9) : severity;
        if (self.hp > 0) damageVehicle(self, amount, hit.x, hit.y, null, crash(self, other, sign));
        else crumpleWreck(self, hit.x, hit.y, crash(self, other, sign));
      }
      if (!b && staticBody) structureImpact(a, hit, closing, staticBody);
      if (distanceBetween(a, player) < 650) {
        particle(hit.x, hit.y, '#ddd1b4', clamp(closing / 18, 3, 16), 85, 3);
        if (city3D) city3D.impact(hit.x, hit.y, 'metal');
        // Bark and splinters off a trunk that held, chips off a concrete planter.
        if (city3D && staticBody?.material && staticBody.material !== 'metal')
          city3D.impact(hit.x, hit.y, 'dust', entityElevation(a));
      }
      const massA = vehicleSpec(a).mass || 1.25,
        massB = b ? vehicleSpec(b).mass || 1.25 : 0;
      crashSound({
        x: hit.x,
        y: hit.y,
        closing,
        mass: Math.max(massA, massB),
        // Two bicycles or motorbikes knocking together are not a car crash.
        other: b ? (Math.max(massA, massB) < 0.6 ? 'prop' : 'car') : staticBody?.building || staticBody?.kind === 'building' ? 'building' : 'wall',
        // A tree, bollard or planter that held (damage.js): the crash is the car's,
        // the settle is splintered wood or stone.
        material: staticBody?.material || null,
        glass: brokenGlass() - glassBefore,
        sliding: Math.abs(((b?.vx || 0) - a.vx) * -hit.n.y + ((b?.vy || 0) - a.vy) * hit.n.x),
        key,
      });
      if (a === player.car || b === player.car) {
        const own = player.car;
        if (own) {
          const deltaV = crashDeltaV(own, own === a ? b : a, closing);
          shake = Math.min(10, deltaV * 0.03);
          hurt(crashInjury(own, deltaV), 'impact');
        }
        if (closing > 130) radio('look-out');
        // Whoever was going faster did the ramming: the wreck is theirs, and
        // ramming a police car is assault on an officer (heat.js).
        const other = a === player.car ? b : a,
          playerFaster =
            !!other && (player.car?.impactSpeed || 0) > (other.impactSpeed || 0);
        // Only a reckless crash is a crime: the player rammed an occupied car hard.
        // Scrapes, parking knocks and being hit by someone else are not
        // (a light bump never brings the police, heat.js).
        if (other && playerFaster && closing > RECKLESS_CRASH_SPEED && (other.occupied || other.ai) && !other.cop)
          crime(0.06);
        // Contact from a chasing unit (PIT, box, ram): counted for policeReport().
        if (other?.cop && other.pursuitPlan && !other.blockade) {
          pursuitStats.contacts++;
          if (other.pursuitPlan.mode === 'pit') pursuitStats.pits++;
        }
        // A nudge in traffic does not make the other car the player's to answer
        // for (its later fire, a soldier's truck, a cruiser).
        if (other && playerFaster && closing > 90) {
          other.lastAttacker = player;
          other.lastDamagedAt = gameTime;
          if (
            (other.type === 'police' || other.lawUnit) &&
            !other.stolen &&
            closing > 110 &&
            gameTime - (other.rammedByPlayerAt ?? -100) > 4
          ) {
            other.rammedByPlayerAt = gameTime;
            crime(wantedStars > 0 ? 0.35 : 0.6);
          }
        }
      }
      // An airframe flown into something breaks up (AIRCRAFT STRIKES).
      aircraftImpact(a, b, closing, staticBody);
      if (b) aircraftImpact(b, a, closing, null);
      // A rider on a two-wheeler that stopped this hard goes over the bars (riders.js).
      riderCrash(a, crashDeltaV(a, b, closing), b);
      if (b) riderCrash(b, crashDeltaV(b, a, closing), a);
    }
    // Which contact pass last touched a body: passes after the first only revisit
    // bodies a contact moved in the pass before (physicsStep).
    let contactPass = 0;
    function resolveContact(a, b, hit, staticBody = null, record = true) {
      const n = hit.n;
      a.contactPass = contactPass;
      if (b) b.contactPass = contactPass;
      // Every vehicle is a body of its real mass, roadblock cruisers included: a
      // braced cruiser resists through its locked wheels (parkedFriction), not by
      // being immovable, so the rammer's momentum decides (roadblocks.js).
      const inverseMassA = 1 / (vehicleSpec(a).mass || 1.25),
        inverseMassB = b ? 1 / (vehicleSpec(b).mass || 1.25) : 0;
      if (record && b && (a.braced || b.braced)) {
        if (a.braced) a.rammedBy = b;
        if (b.braced) b.rammedBy = a;
      }
      const inverseInertiaA = (inverseMassA * 12) / (vehicleSpec(a).l ** 2 + vehicleSpec(a).w ** 2),
        inverseInertiaB = b ? (inverseMassB * 12) / (vehicleSpec(b).l ** 2 + vehicleSpec(b).w ** 2) : 0;
      const contactOffsetA = {
          x: hit.x - a.x,
          y: hit.y - a.y,
        },
        contactOffsetB = b
          ? {
              x: hit.x - b.x,
              y: hit.y - b.y,
            }
          : {
              x: 0,
              y: 0,
            };
      const ax = (a.vx || 0) - (a.av || 0) * contactOffsetA.y,
        ay = (a.vy || 0) + (a.av || 0) * contactOffsetA.x,
        bx = b ? (b.vx || 0) - (b.av || 0) * contactOffsetB.y : 0,
        by = b ? (b.vy || 0) + (b.av || 0) * contactOffsetB.x : 0,
        rvx = bx - ax,
        rvy = by - ay,
        normal = rvx * n.x + rvy * n.y;
      if (normal < 0) {
        const normalTorqueArmA = contactOffsetA.x * n.y - contactOffsetA.y * n.x,
          normalTorqueArmB = contactOffsetB.x * n.y - contactOffsetB.y * n.x,
          denom =
            inverseMassA +
            inverseMassB +
            normalTorqueArmA * normalTorqueArmA * inverseInertiaA +
            normalTorqueArmB * normalTorqueArmB * inverseInertiaB,
          // Bumpers spring back from a parking knock (about 0.3 at 10 km/h); a real
          // crash is nearly plastic (0.08 from 55 km/h). Nothing bounces from a
          // resting touch, so stacked contacts do not jitter.
          closingKmh = -normal / KMH,
          restitution = closingKmh < 2 ? 0 : clamp(0.36 - closingKmh * 0.005, 0.08, 0.3),
          impulse = (-(1 + restitution) * normal) / denom;
        // Speeds going in, so collisionImpact can tell who rammed whom.
        if (record) {
          a.impactSpeed = Math.hypot(a.vx, a.vy);
          a.impactVx = a.vx;
          a.impactVy = a.vy;
          if (b) {
            b.impactSpeed = Math.hypot(b.vx, b.vy);
            b.impactVx = b.vx;
            b.impactVy = b.vy;
          }
        }
        a.vx -= n.x * impulse * inverseMassA;
        a.vy -= n.y * impulse * inverseMassA;
        a.av -= normalTorqueArmA * impulse * inverseInertiaA;
        if (b) {
          b.vx += n.x * impulse * inverseMassB;
          b.vy += n.y * impulse * inverseMassB;
          b.av += normalTorqueArmB * impulse * inverseInertiaB;
        }
        // An off-centre hit leaves the car yawing. Nobody's steering input can
        // cancel that at once, so the driver loses authority for a moment and the
        // car spins out instead of snapping back to its heading (physicsStep).
        const kickA = Math.abs(normalTorqueArmA * impulse * inverseInertiaA),
          kickB = Math.abs(normalTorqueArmB * impulse * inverseInertiaB);
        if (kickA > 0.55) a.spinUntil = physicsClock + clamp(kickA * 0.32, 0.25, 1.1);
        if (b && kickB > 0.55) b.spinUntil = physicsClock + clamp(kickB * 0.32, 0.25, 1.1);
        // A chasing cruiser that spun the player's car out: a PIT (policeReport()).
        if (b && player.car && (a === player.car ? b : b === player.car ? a : null)?.pursuitPlan) {
          const runner = a === player.car ? a : b,
            kick = a === player.car ? kickA : kickB;
          if (kick > 0.55 && physicsClock - (runner.pitCountedAt ?? -100) > 2) {
            runner.pitCountedAt = physicsClock;
            pursuitStats.spinouts++;
            contactHoldUntil = gameTime + 3.5;
          }
        }
        // Sheet metal on sheet metal grips harder than a tyre-scuffed wall face.
        const friction = b ? 0.3 : 0.23,
          tx = -n.y,
          ty = n.x,
          ta = contactOffsetA.x * ty - contactOffsetA.y * tx,
          tb = contactOffsetB.x * ty - contactOffsetB.y * tx,
          sliding = rvx * tx + rvy * ty,
          tangentImpulse = clamp(
            -sliding /
              (inverseMassA + inverseMassB + ta * ta * inverseInertiaA + tb * tb * inverseInertiaB),
            -impulse * friction,
            impulse * friction,
          );
        // Grinding along a wall or another car: damage.js throws sparks and scores the paint.
        if (record && Math.abs(sliding) > 70) {
          const scrape = { x: hit.x, y: hit.y, t: physicsClock, speed: Math.abs(sliding), nx: n.x, ny: n.y };
          a.scrape = scrape;
          if (b) b.scrape = { ...scrape, nx: -n.x, ny: -n.y };
        }
        a.vx -= tx * tangentImpulse * inverseMassA;
        a.vy -= ty * tangentImpulse * inverseMassA;
        a.av -= ta * tangentImpulse * inverseInertiaA;
        if (b) {
          b.vx += tx * tangentImpulse * inverseMassB;
          b.vy += ty * tangentImpulse * inverseMassB;
          b.av += tb * tangentImpulse * inverseInertiaB;
        }
        if (record)
          collisionImpact(
            a,
            b,
            hit,
            -normal,
            b ? 'c' + Math.min(a.id, b.id) + ':' + Math.max(a.id, b.id) : a.id + ':' + staticBody.id,
            staticBody,
          );
      }
      const correction = (Math.max(0, hit.depth - 0.015) * 0.9) / (inverseMassA + inverseMassB);
      a.x -= n.x * correction * inverseMassA;
      a.y -= n.y * correction * inverseMassA;
      if (b) {
        b.x += n.x * correction * inverseMassB;
        b.y += n.y * correction * inverseMassB;
      }
      // A hard off-centre hit can spin a car at nearly a turn a second.
      a.av = clamp(a.av, -5, 5);
      if (b) b.av = clamp(b.av, -5, 5);
    }
