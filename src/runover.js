    // Second pass: a vehicle runs over someone already on the ground (knockPerson hands over): harm by speed and weight, blood, the car's stain, a death a second or two later.
    /**
     * RUNNING OVER THE DOWNED
     * The first pass is knockPerson's (a damage curve by speed, a knockdown, a throw clear). Someone
     * who is alive and still on the ground (knocked down, lying hurt, crawling, dying) and is run
     * over again takes a proper crush: `runOverHarm` weighs the vehicle (`spec.mass`, tonnes) and
     * its speed and where the wheel lands (legs, torso, head: a roll of the dice), in hit points:
     *   harm = (10 + 0.8 kph) x weight x zone      weight 0.6 (bicycle) .. 2.2 (bus, tank)
     * Judged against the person's health (at most 40 counts, so an officer is no sturdier than a
     * bystander under a wheel): under 40% a bruise and a broken limb (they stay down a while), from
     * 40% a maiming (health capped at 12: they lie there groaning and cannot rise), from 75% a
     * mortal injury: they die within a second or two (`p.dying`, finished by stepDying) through the
     * normal death path, so witnesses, heat, medics and corpses behave as for any other death. A
     * head blow, or a crushing one, takes consciousness: no scream, no groan. Anything at about
     * 30 km/h or more under a car's weight is mortal; a crawl (4 km/h) never kills a healthy person.
     * Blood goes through bleed() (a splash and streaks; a pool only once they are dead, bodyPool),
     * the tyres carry it on (c.bloodTrackRemaining), the car is stained (addCarStain), and the
     * pass is once per vehicle and person (RUNOVER_SAME_CAR, impactCooldown). Nothing here makes
     * heat except crime(), and the kill itself is strikePerson's (recordKill).
     */
    const RUNOVER_MIN_KPH = 4,
      // The same car cannot run over the same person again within this many seconds: its own
      // first pass (still going over them, or throwing them ahead) is not a second one.
      RUNOVER_SAME_CAR = 2,
      RUNOVER_ZONES = [
        { zone: 'legs', upTo: 0.4, k: 0.8 },
        { zone: 'torso', upTo: 0.85, k: 1.05 },
        { zone: 'head', upTo: 1, k: 1.35 },
      ];
    /* Alive and on the ground: a knockdown, someone hurt and lying or crawling, someone dying. */
    function personOnGround(p) {
      if (!p || !(p.hp > 0)) return false;
      if (p.dying) return true;
      const e = p.ejected;
      // Thrown clear of a bike or a car and still flying or sliding is not yet "down".
      if (e && e.phase !== 'down' && (e.rider || e.time < 0.6)) return false;
      return (p.knockedFor || 0) > 0.55 || p.react?.kind === 'groan' || (p.downed === true && p.state === 'downed');
    }
    /* What a wheel does to someone lying down: harm in hit points, where it landed and the verdict. */
    function runOverHarm(c, kph, hp, roll = 0.5, jitter = 1) {
      const spec = vehicleSpec(c),
        zone = RUNOVER_ZONES.find((z) => roll < z.upTo) || RUNOVER_ZONES[RUNOVER_ZONES.length - 1],
        weight = clamp(0.6 + (spec.mass || 1.2) * 0.3, 0.6, 2.2),
        harm = (10 + 0.8 * Math.min(kph, 100)) * weight * zone.k * jitter,
        ref = Math.max(1, Math.min(hp, 40));
      return {
        zone: zone.zone,
        harm,
        ratio: harm / ref,
        mortal: harm >= ref * 0.75,
        maiming: harm >= ref * 0.4,
        unconscious: harm >= ref * 1.6 || (zone.zone === 'head' && harm >= ref * 0.9),
      };
    }
    function runOverDowned(person, c, speed, kph) {
      // A car creeping up to a casualty (an ambulance edging in) is not a second blow.
      if (kph < RUNOVER_MIN_KPH) return false;
      const last = person.carHit;
      if (last && last.car === c && gameTime - last.at < RUNOVER_SAME_CAR) return false;
      const dying = !!person.dying,
        harm = runOverHarm(c, kph, person.hp, seededRandom(), randomBetween(0.92, 1.08)),
        heading = Math.atan2(c.vy, c.vx),
        source = c === player.car ? player : c,
        byPlayer = source === player,
        mortal = dying || harm.mortal,
        severity = clamp(0.8 + harm.harm / 28, 0.9, 2.3);
      person.impactCooldown = 0.9;
      person.carHit = { car: c, at: gameTime, second: true };
      person.overruns = (person.overruns || 0) + 1;
      person.threat = { x: c.x, y: c.y };
      person.flee = 8;
      person.aiming = false;
      // A head blow or a crushing one takes consciousness: no scream, no groan (scream() reads it).
      const conscious = !dying && !harm.unconscious;
      if (!conscious) person.mutedUntil = gameTime + 60;
      runOverSound(person, harm.harm, mortal);
      if (bloodOn) runOverBlood(person, c, heading, severity, mortal || harm.maiming);
      addCarStain(c, person, Math.max(kph, 22), mortal);
      if (dying) {
        // Already going: a second wheel finishes it.
        finishDying(person);
      } else if (mortal) {
        // The strike runs the wound's side effects (flinch, threat, a limp, the trail); what
        // is left of them goes with the dying, by one route (stepDying -> strikePerson).
        strikePerson(person, Math.max(0, Math.min(harm.harm, person.hp - 1)), heading, source, false, 'impact');
        person.hp = Math.min(person.hp, 2);
        const over = clamp(harm.ratio / 0.75, 1, 3),
          delay = clamp(3 - 1.1 * over, 0.45, 2.4) * (harm.unconscious ? 0.7 : 1) * randomBetween(0.85, 1.15),
          listed = pedestrians.includes(person) || enemies.includes(person) || gangMembers.includes(person) || officers.includes(person);
        person.dying = { die: gameTime + (listed ? delay : 0), a: heading, source, byPlayer, car: c, conscious, groaned: false };
        person.knockedFor = Math.max(person.knockedFor || 0, delay + 0.8);
        person.dazedFor = 0;
        if (!listed) finishDying(person);
      } else {
        strikePerson(person, harm.harm, heading, source, false, 'impact');
        person.injured = true;
        person.limping = true;
        if (harm.maiming) {
          // Maimed: a crushed limb or pelvis, no getting up for a long while (health under 13
          // sends them to groan on the ground, crowd-reactions.js adoptLegacyFlee).
          person.hp = clamp(Math.min(person.hp, 12), 1, 12);
          if (person.knockedFor > 0) person.knockedFor = Math.max(person.knockedFor, 7 + harm.harm / 10);
        } else if (person.knockedFor > 0) person.knockedFor = Math.max(person.knockedFor, 4.5);
      }
      // Everyone who saw it reacts, and the player is the culprit when it was their car (crime() is
      // the only heat source: a death adds the full 0.35 here, the kill itself is recorded at death).
      crowdAlarm('knock', person, byPlayer ? player : null, mortal ? 2 : 1.3);
      if (byPlayer) crime(mortal && !dying ? 0.35 : 0.08);
      runOvers.push({ at: +gameTime.toFixed(2), kph: Math.round(kph), zone: harm.zone, harm: +harm.harm.toFixed(1), mortal, conscious, car: c.type });
      if (runOvers.length > 12) runOvers.shift();
      return true;
    }
    const runOvers = [];
    /* The splash where the wheel meets them, streaks along the tyre path, and the blood the tyres take on. */
    function runOverBlood(person, c, heading, severity, heavy) {
      bleed(person, severity, heading, 'impact');
      const streaks = severity > 1.5 ? 3 : 2;
      for (let i = 0; i < streaks; i++) {
        const along = randomBetween(-20, 28),
          across = randomBetween(-4, 4),
          x = person.x + Math.cos(heading) * along - Math.sin(heading) * across,
          y = person.y + Math.sin(heading) * along + Math.cos(heading) * across;
        addBloodSpatter(x, y, randomBetween(1.8, 2.8) * (0.8 + severity * 0.2), heading + randomBetween(-0.12, 0.12), bloodSurface(x, y), 2.3);
      }
      // The tyres carry it down the road (physics-knockdowns.js updateBloodTracks lays the prints).
      if (!isBoat(c) && !isAircraft(c)) {
        c.bloodTrackRemaining = Math.max(c.bloodTrackRemaining || 0, BLOOD_TRACK_DISTANCE * (heavy ? 1 : 0.6));
        c.bloodTrackSides = [-1, 1];
      }
    }
    /* Their last second or two: a conscious one groans once; then the normal death, lying as they lay. */
    function stepDying(p, deltaSeconds) {
      const d = p.dying;
      if (!d.groaned && d.conscious && gameTime >= d.die - 1.2) {
        d.groaned = true;
        crowdSay(p, 'injured', 1);
      }
      p.knockedFor = Math.max(p.knockedFor || 0, d.die - gameTime + 0.5);
      if (gameTime >= d.die) finishDying(p);
    }
    function finishDying(p) {
      const d = p.dying;
      p.dying = null;
      if (!d || !(p.hp > 0)) return;
      const keepA = p.a,
        sign = p.pose === 'crawl' ? -1 : 1;
      // No cry at the very end: a conscious one groaned, the rest cannot.
      p.mutedUntil = gameTime + 5;
      strikePerson(p, p.hp + 1, d.a, d.source, false, 'impact');
      // Already on the ground, so no second fall: the body stays as it lay (wounds.js
      // chooseDeathFall would have turned it and dropped it again).
      p.a = keepA;
      p.deathStyle = { sign, turn: 0, slump: false };
      p.deadTime = gameTime - DEATH_FALL_SECONDS;
      p.knockedFor = 0;
      p.dazedFor = 0;
      bodyPool(p, 'impact', d.a);
      if (d.byPlayer && p.hp <= 0) cash += 25;
    }
    /* Console: the second-pass rule's table, a victim to run over, and what became of them. */
    let runOverVictimOf = null;
    function runOverConsole() {
      return {
        // The second-pass rule (runover.js): for a vehicle `type` at `kph` over someone with `hp`, the harm and
        // verdict for each place the wheel can land (`legs`, `torso`, `head`); `last` is the passes so far.
        runOverReport(type = 'sedan', kph = 30, hp = 30) {
          const c = { type, airframe: null },
            zones = {};
          for (const z of RUNOVER_ZONES) {
            const h = runOverHarm(c, kph, hp, z.upTo - 0.01);
            zones[z.zone] = { harm: +h.harm.toFixed(1), mortal: h.mortal, maiming: h.maiming, unconscious: h.unconscious };
          }
          return { type, kph, hp, zones, last: runOvers.slice() };
        },
        // Tests: stand a bystander on the player's car, `along` units ahead of its centre and `lateral` to its right;
        // `down` lays them on the ground already (knocked down for that many seconds), as if a first pass had left them.
        runOverVictim(along = 60, lateral = 0, hp = 30, down = 0) {
          const c = player.car;
          if (!c) return null;
          const ca = Math.cos(c.a),
            sa = Math.sin(c.a),
            p = {
              x: c.x + ca * along - sa * lateral,
              y: c.y + sa * along + ca * lateral,
              a: c.a + Math.PI,
              dir: c.a + Math.PI,
              hp,
              flee: 0,
              timer: 999,
              walk: 0,
              state: 'idle',
              stateTime: 900,
              knockedFor: down,
            };
          dressPerson(p, 'casual');
          pedestrians.push(p);
          runOverVictimOf = p;
          return { x: Math.round(p.x), y: Math.round(p.y), hp: p.hp };
        },
        // What became of the last victim: health, dead, down (seconds), dying (seconds to go), passes, the
        // mark of the last pass, kills recorded (rampage), cash, stars and the pool.
        runOverState() {
          const p = runOverVictimOf;
          if (!p) return null;
          return {
            hp: +p.hp.toFixed(1),
            dead: p.hp <= 0,
            down: +(p.knockedFor || 0).toFixed(1),
            dying: p.dying ? +(p.dying.die - gameTime).toFixed(2) : null,
            conscious: p.dying ? p.dying.conscious : !(p.mutedUntil > gameTime + 5),
            overruns: p.overruns || 0,
            hit: p.carHit ? { second: !!p.carHit.second, age: +(gameTime - p.carHit.at).toFixed(2) } : null,
            kills: rampage.civilians,
            cash,
            wanted: wantedStars,
            pool: !!p.bloodPool,
            bloodHits: p.bloodHits || 0,
            x: Math.round(p.x),
            y: Math.round(p.y),
          };
        },
      };
    }
