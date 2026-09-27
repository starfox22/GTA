    // Witnesses and 911 calls, the police side: crimes nobody has reported yet, what the police see and hear
    // for themselves, and how a report brings them (to where it happened, searching, after a response time).
    /**
     * WHO KNOWS WHAT
     * With no stars up, a crime reaches the police one of three ways:
     *   - a unit sees it: an officer, a crewed cruiser or the helicopter with a
     *     clear line to the player (policeSees), and the stars rise at once;
     *   - a unit hears it: gunfire or a blast within earshot of one, the same;
     *   - somebody calls it in: a civilian who saw it, or heard the shots, runs
     *     a short way and phones 911 (crowd-witnesses.js). Only when that call
     *     ends does the first star come up, and dispatch sends the first units at
     *     once (policeResponseSeconds: a second or two) to the spot the caller
     *     gave: the player, if the caller can see them. They search there and
     *     take up the chase when one of them sees the player.
     * Anything else is banked as an unreported crime: where, when, how much heat
     * and who died. A later call about it (a passer-by who finds the body) reports
     * it then; a police unit that comes on the player at the scene while it is
     * fresh counts as seeing it. Unreported crimes are forgotten after
     * UNREPORTED_KEEP seconds, when the police are cleared, and by the god panel.
     *
     * witnessReport(person, kind, x, y, options) makes one particular person a
     * witness who phones it in (a carjacked driver, a club member watching their
     * truck go): see crowd-witnesses.js.
     */
    const UNREPORTED_KEEP = 240,
      // Crimes this close in time and place are one incident to whoever reports it.
      UNREPORTED_MERGE_SECONDS = 20,
      UNREPORTED_MERGE_DISTANCE = 420,
      // How far a unit hears a shot (about 60 m) and sees the scene of a fresh crime.
      POLICE_EARSHOT = 480,
      FRESH_SCENE_SECONDS = 15,
      FRESH_SCENE_DISTANCE = 320;
    const unreportedCrimes = [];
    // The response to the last report: where the units are going and when the first arrived.
    const policeResponse = { active: false, x: 0, y: 0, at: -100, eta: 0, arrivedAt: -100, kind: '', street: '' };
    const lawEyes = { at: -100, seen: false };
    const witnessStats = { banked: 0, reports: 0, calls: 0, dropped: 0, silenced: 0, seenByPolice: 0, heardByPolice: 0, stumbledOn: 0, bodiesFound: 0, venueCalls: 0 };
    let witnessTimer = 0;

    /* A police unit that could see anything: officers on their feet, crewed cruisers
       and law vans on patrol or on a job, the helicopter. Parked empty cruisers,
       stolen ones and units whose crew is out or dead see nothing. */
    function lawVehicleCrewed(c) {
      if (c.hp <= 0 || c === player.car || c.stolen || c.crewLost || c.crewDeployed) return false;
      if (c.airUnit) return true;
      if (!(c.cop || c.lawUnit || c.type === 'police')) return false;
      return !!(c.ai || c.cop || c.blockade || c.pursuitUnit);
    }
    function lawOfficerAlert(o) {
      return o.hp > 0 && !o.returned && !o.lineup && !o.downed && !o.roofSniper;
    }
    /* Does any police unit see the player right now? (0.15 s cache: an automatic
       weapon reports a crime every shot.) */
    function policeEyesOnPlayer() {
      if (Math.abs(gameTime - lawEyes.at) < 0.15) return lawEyes.seen;
      lawEyes.at = gameTime;
      lawEyes.seen = false;
      for (const o of officers) if (lawOfficerAlert(o) && policeSees(o)) return (lawEyes.seen = true);
      for (const c of vehicles) if (lawVehicleCrewed(c) && policeSees(c)) return (lawEyes.seen = true);
      return false;
    }
    /* Is a police unit within earshot of (x, y)? Gunfire and blasts carry. */
    function policeInEarshot(x, y, reach = POLICE_EARSHOT) {
      for (const o of officers)
        if (lawOfficerAlert(o) && Math.abs(o.x - x) < reach && Math.abs(o.y - y) < reach && Math.hypot(o.x - x, o.y - y) < reach) return true;
      for (const c of vehicles)
        if (Math.abs(c.x - x) < reach && Math.abs(c.y - y) < reach && lawVehicleCrewed(c) && Math.hypot(c.x - x, c.y - y) < reach) return true;
      return false;
    }
    /* crime() asks this with no stars up: do the police know already? */
    function policeWitnessCrime(how) {
      if (how === 'seen') return true;
      if (policeEyesOnPlayer()) {
        witnessStats.seenByPolice++;
        return true;
      }
      const loud = how === 'gunfire' || how === 'explosion' || gameTime - crowd.playerShotAt < 0.1;
      if (loud && policeInEarshot(player.x, player.y)) {
        witnessStats.heardByPolice++;
        return true;
      }
      return false;
    }

    /* A crime nobody in authority saw: kept for whoever reports it. */
    function bankUnreportedCrime(heat, kind = '', victim = null) {
      if (!(heat > 0) || gameMode !== 'play') return;
      const x = player.x,
        y = player.y;
      let rec = null;
      for (const r of unreportedCrimes)
        if (
          gameTime - r.at < UNREPORTED_MERGE_SECONDS &&
          Math.abs(r.x - x) < UNREPORTED_MERGE_DISTANCE &&
          Math.abs(r.y - y) < UNREPORTED_MERGE_DISTANCE
        ) {
          rec = r;
          break;
        }
      if (!rec) {
        rec = { x, y, start: gameTime, at: gameTime, heat: 0, kinds: [], victims: [], scanned: false };
        unreportedCrimes.push(rec);
        if (unreportedCrimes.length > 8) unreportedCrimes.shift();
      }
      rec.at = gameTime;
      // Where the player was for the latest of it (the crowd is asked about that spot).
      rec.px = x;
      rec.py = y;
      rec.heat = Math.min(HEAT_MAX, rec.heat + heat);
      if (kind && !rec.kinds.includes(kind)) rec.kinds.push(kind);
      if (victim && rec.victims.length < 8) rec.victims.push(victim);
      // A crime that raised no crowd incident of its own (a theft, a carjacking,
      // a rammed car) is looked for next update: whoever was watching saw it.
      rec.scanAt = gameTime + 0.05;
      rec.scanned = false;
      witnessStats.banked++;
      sumUnreportedHeat();
    }
    function sumUnreportedHeat() {
      let sum = 0;
      for (const r of unreportedCrimes) sum += r.heat;
      unreportedHeat = Math.min(HEAT_MAX, sum);
    }
    /* Crimes that happened between `from` and `to` near (x, y), or that killed
       `victim`: taken out of the bank and their heat returned. */
    function takeUnreportedCrimes(x, y, from, to, victim = null, reach = 800) {
      let heat = 0;
      for (let i = unreportedCrimes.length - 1; i >= 0; i--) {
        const r = unreportedCrimes[i],
          killed = victim && r.victims.includes(victim),
          matches = r.start <= to + 3 && r.at >= from - 3 && Math.abs(r.x - x) < reach && Math.abs(r.y - y) < reach;
        if (!killed && !matches) continue;
        heat += r.heat;
        unreportedCrimes.splice(i, 1);
      }
      sumUnreportedHeat();
      return heat;
    }
    /* Everything unreported is forgotten and calls in progress come to nothing:
       the police were cleared (heat.js resetHeat) or the god panel lost them. */
    function forgetWitnessedCrimes() {
      unreportedCrimes.length = 0;
      unreportedHeat = 0;
      policeResponse.active = false;
      for (const inc of crowd.incidents) if (inc.attacker === player) inc.reported = true;
      offstageCalls.length = 0;
    }

    /**
     * RESPONSE TIME
     * The chase starts right after the call: the first unit is sent within a
     * second or two, a little sooner downtown, wherever it is (Monarch Isle and
     * the county included). Like any dispatch it appears off screen round the
     * reported spot (pursuitCentre) and still has to drive in; the nearest
     * patrol already cruising is sent first (dispatchPolice).
     */
    function policeResponseSeconds(x, y) {
      return clamp(1.8 - districtBustle(x, y) * 0.8, 0.8, 1.8) + randomBetween(0, 0.4);
    }

    /* Title-cased street name for speech and captions ('OCEAN DR' → 'Ocean Drive'). */
    const STREET_WORDS = { DR: 'Drive', AVE: 'Avenue', ST: 'Street', BLVD: 'Boulevard', RD: 'Road', HWY: 'Highway', PL: 'Place', LN: 'Lane' };
    function spokenStreet(x, y) {
      const name = (streetNameAt(x, y) || '').split(' & ')[0];
      if (!name) return '';
      return name
        .split(' ')
        .map((w) => STREET_WORDS[w] || (w.length <= 2 && /^[A-Z]+$/.test(w) && w !== 'OF' ? w : w.charAt(0) + w.slice(1).toLowerCase()))
        .join(' ');
    }

    /**
     * A REPORT REACHES DISPATCH
     * crime(amount, { x, y, kind, caller }) lands here: the heat counts, and with
     * no stars up the first one comes on, the search is set on the reported spot
     * and the first unit is sent after the response time. With stars up already
     * the heat is simply added (the chase goes on as before).
     */
    const REPORT_CAPTIONS = {
      gunfire: 'SHOTS FIRED',
      explosion: 'EXPLOSION REPORTED',
      melee: 'ASSAULT IN PROGRESS',
      knock: 'HIT AND RUN',
      body: 'BODY FOUND',
      carjack: 'CARJACKING',
      theft: 'VEHICLE THEFT',
      crash: 'RECKLESS DRIVER',
      crime: 'DISTURBANCE',
    };
    function reportedCrime(heat, report) {
      const x = Number.isFinite(report.x) ? report.x : player.x,
        y = Number.isFinite(report.y) ? report.y : player.y;
      // Whatever else the player did round there in the last half minute is part
      // of the same call (more shots while the witness was on the phone).
      heat += takeUnreportedCrimes(x, y, gameTime - 30, gameTime, null, 500);
      if (heat > 0) addHeat(heat);
      if (wantedStars > 0) return;
      const eta = report.eta ?? policeResponseSeconds(x, y);
      wantedStars = 1;
      wantedLevel = 1;
      starElapsed = 0;
      escalateSeconds = 0;
      rampage.startedAt = gameTime;
      lastHeatAt = gameTime;
      // They know where it happened, not where the player is now.
      searchActive = true;
      searchRemaining = policeSearchSeconds(1);
      lastSeen = { x, y };
      Object.assign(policeResponse, {
        active: true,
        x,
        y,
        at: gameTime,
        eta,
        arrivedAt: -100,
        kind: report.kind || 'crime',
        street: spokenStreet(x, y),
      });
      witnessStats.reports++;
      // The first unit rolls after the response time and a second right behind
      // it; the rest on the tier's cadence.
      dispatchTimer = eta;
      dispatchBurst = 1;
      if (gameMode === 'play') {
        const what = REPORT_CAPTIONS[report.kind] || REPORT_CAPTIONS.crime,
          where = policeResponse.street ? ' · ' + policeResponse.street.toUpperCase() : '';
        dispatchCaption('911 CALL · ' + what + where + ' · UNITS RESPONDING', null);
        if (report.note !== false) tell('A WITNESS CALLED 911', 2.8);
      }
    }
    /* Units still on their way to a reported spot: dispatch sends them from the
       nearest places off screen (pursuitSpawnPoint, spawnCountyCop). */
    function policeResponding() {
      return policeResponse.active && policeResponse.arrivedAt < 0 && wantedStars > 0;
    }
    /* Until the first unit reaches the reported spot the search clock does not
       run: nobody has started looking yet (citylife-civic.js updateWanted). */
    function policeResponseHolding() {
      if (!policeResponse.active || wantedStars <= 0) return false;
      if (policeResponse.arrivedAt > 0) return false;
      // Give up holding a while after the unit should have been there.
      return gameTime - policeResponse.at < policeResponse.eta + 40;
    }
    function updatePoliceResponse() {
      if (!policeResponse.active) return;
      if (wantedStars <= 0 || policeHaveEyesOnPlayer()) {
        policeResponse.active = false;
        return;
      }
      if (policeResponse.arrivedAt > 0) return;
      const reach = policeSearchRadius();
      for (const c of vehicles)
        if (c.cop && c.hp > 0 && !c.airUnit && distanceBetween(c, lastSeen) < reach) {
          policeResponse.arrivedAt = gameTime;
          if (gameMode === 'play')
            dispatchCaption('UNIT ON SCENE' + (policeResponse.street ? ' · ' + policeResponse.street.toUpperCase() : '') + ' · SEARCHING THE AREA', null);
          return;
        }
    }

    /**
     * EVERY UPDATE (from updateWanted)
     * Old unreported crimes lapse; a fresh one is looked for by the crowd once;
     * a police unit that comes on the player at a fresh scene knows what happened.
     */
    function updateWitnesses(deltaSeconds) {
      updatePoliceResponse();
      witnessTimer -= deltaSeconds;
      if (witnessTimer > 0) return;
      witnessTimer = 0.2;
      let changed = false;
      for (let i = unreportedCrimes.length - 1; i >= 0; i--) {
        const r = unreportedCrimes[i];
        if (gameTime - r.at > UNREPORTED_KEEP || gameTime < r.start - 1) {
          unreportedCrimes.splice(i, 1);
          changed = true;
          continue;
        }
        if (!r.scanned && gameTime >= r.scanAt) {
          r.scanned = true;
          if (!recentPlayerIncident(r.px, r.py, r.at - 0.5) && distanceBetween(player, { x: r.px, y: r.py }) < 200)
            crowdAlarm(r.kinds.includes('carjack') || r.kinds.includes('theft') ? 'theft' : 'crime', player, player, clamp(r.heat / 4, 0.6, 2));
        }
      }
      if (changed) sumUnreportedHeat();
      updateOffstageCalls(0.2);
      if (gameMode !== 'play' || !unreportedCrimes.length) return;
      // A unit on the scene of something fresh with the player still there.
      let fresh = null;
      for (const r of unreportedCrimes)
        if (gameTime - r.at < FRESH_SCENE_SECONDS && distanceBetween(r, player) < FRESH_SCENE_DISTANCE) fresh = r;
      if (!fresh || !policeEyesOnPlayer()) return;
      witnessStats.stumbledOn++;
      const heat = takeUnreportedCrimes(player.x, player.y, gameTime - FRESH_SCENE_SECONDS, gameTime, null, FRESH_SCENE_DISTANCE + 200);
      if (wantedStars > 0) {
        addHeat(heat);
        return;
      }
      crime(heat / CRIME_HEAT, 'seen');
      tell('THE POLICE SAW YOU AT THE SCENE', 2.6);
    }
    /**
     * A WITNESS REPORT (the public API)
     * witnessReport(person, kind, x, y, options) makes `person` a witness to what
     * the player just did at (x, y) who phones 911 about it for certain, once they
     * can: up off the ground, done shouting after their car (carjack.js moods),
     * not held at gunpoint, a short run from the player first if they are close;
     * `options.delay` seconds at the soonest (default 2-4). The call takes 5-8 s
     * with a phone and speech bubbles, and only its end brings the police (to
     * (x, y), or the player if the caller can see them). It is lost if the person
     * dies or is threatened into silence; the player reaching them cuts it off
     * until they are clear again. `kind` picks the lines and the dispatch
     * caption: 'carjack', 'theft', 'gunfire', 'melee', 'body', 'crime' (anything
     * else). Crowd pedestrians do it through their 'call' reaction; anyone else
     * (venue staff) as an off-stage call with the same bubbles. Returns the
     * incident, or null.
     */
    const offstageCalls = [],
      // Off-stage callers just finished: their closing line still shows.
      offstageCallTails = [];
    function witnessReport(person, kind = 'crime', x = player.x, y = player.y, options = {}) {
      if (!person || !(person.hp > 0) || gameMode !== 'play') return null;
      const inc = crowdIncident(kind, { x, y }, player, options.severity ?? 1);
      // Told by this one person: bystanders still get asked what they saw. (Not
      // when it merged into what the street already saw, e.g. the carjack at the
      // door: a second incident about the same crime would take its witnesses.)
      if (inc.shots === 1 && inc.start === gameTime && !inc.witnesses?.length) inc.direct = true;
      if (!inc.witnesses) inc.witnesses = [];
      if (!inc.witnesses.includes(person)) inc.witnesses.push(person);
      person.witnessOf = inc;
      person.witnessSaw = true;
      person.witnessD = Math.hypot(person.x - x, person.y - y);
      person.witnessAt = gameTime;
      person.witnessReadyAt = gameTime + (options.delay ?? randomBetween(2, 4));
      person.witnessMust = inc;
      person.witnessDeclined = null;
      person.silencedUntil = 0;
      if (!pedestrians.includes(person) && !offstageCalls.some((c) => c.person === person))
        offstageCalls.push({ person, inc, readyAt: person.witnessReadyAt, startedAt: -1, callTime: randomBetween(CALL_SECONDS[0], CALL_SECONDS[1]) });
      return inc;
    }
    /* Calls made by people the crowd does not run (venue staff, someone inside a
       shop): the same lines as a street caller, unless out of sight indoors. A
       call from indoors waits while someone on the street is on the phone. */
    function updateOffstageCalls() {
      for (let i = offstageCalls.length - 1; i >= 0; i--) {
        const c = offstageCalls[i],
          p = c.person;
        if (p.hp <= 0 || c.inc.reported || gameTime - witnessCrimeTime(c.inc) > witnessWindow(c.inc)) {
          if (c.startedAt > 0) {
            if (!c.hidden) c.inc.callers = Math.max(0, c.inc.callers - 1);
            if (!c.inc.reported) witnessStats.dropped++;
          }
          p.onPhone = false;
          offstageCalls.splice(i, 1);
          continue;
        }
        const close = distanceBetween(p, player) < (c.hidden ? 60 : CALL_CUT_DISTANCE);
        if (c.startedAt < 0) {
          if (gameTime < c.readyAt || close || p.silencedUntil > gameTime || personIncapacitated(p)) continue;
          if (c.hidden ? witnessCallUnderWay(c.inc) : c.inc.callers > 0 && p.witnessMust !== c.inc) continue;
          c.startedAt = gameTime;
          c.lines = {};
          if (!c.hidden) c.inc.callers++;
          witnessStats.calls++;
          continue;
        }
        if (close || p.silencedUntil > gameTime) {
          // Cut off: they try again once the player has gone.
          c.startedAt = -1;
          c.readyAt = gameTime + randomBetween(4, 8);
          if (!c.hidden) c.inc.callers = Math.max(0, c.inc.callers - 1);
          p.onPhone = false;
          witnessStats.dropped++;
          continue;
        }
        const t = gameTime - c.startedAt;
        if (!c.hidden) {
          p.onPhone = true;
          witnessCallLines(p, c.inc, t, c.callTime, c.lines);
        }
        if (t >= c.callTime) {
          offstageCalls.splice(i, 1);
          if (!c.hidden) {
            c.inc.callers = Math.max(0, c.inc.callers - 1);
            p.onPhone = false;
            sayCallLine(p, randomChoice(CALL_CLOSING), 2.4);
            offstageCallTails.push({ person: p, until: gameTime + 2.4 });
          }
          crowdReport(p, c.inc);
        }
      }
    }
    /* Off-stage callers the speech bubbles would not otherwise find (crowd-speech.js). */
    function offstageCallSpeakers() {
      const out = [];
      for (const c of offstageCalls) if (!c.hidden && c.startedAt > 0 && !pedestrians.includes(c.person)) out.push(c.person);
      for (let i = offstageCallTails.length - 1; i >= 0; i--) {
        const tail = offstageCallTails[i];
        if (tail.until < gameTime) offstageCallTails.splice(i, 1);
        else if (!out.includes(tail.person) && !pedestrians.includes(tail.person)) out.push(tail.person);
      }
      return out;
    }
    /* crowdReport → dispatch: the heat of whatever the call is about. */
    const REPORT_BASE = { gunfire: 0.5, explosion: 0.6, melee: 0.4, knock: 0.45, carjack: 0.8, theft: 0.6, crime: 0.3 };
    function reportIncidentToPolice(inc, caller) {
      const body = inc.kind === 'body',
        from = body ? (inc.focus?.deadTime ?? inc.start) : inc.start,
        to = body ? from : inc.time;
      let heat = takeUnreportedCrimes(inc.x, inc.y, from, to, body ? inc.focus : null);
      // A body found long after, with the player nowhere near: the police have a
      // case, not a suspect to chase. They go and look; nobody is wanted.
      if (body && heat && wantedStars <= 0 && gameTime - from > 30 && distanceBetween(player, inc) > policeSearchRadius(1) * 1.5) {
        witnessStats.bodiesFound++;
        if (gameMode === 'play') {
          const street = spokenStreet(inc.x, inc.y);
          dispatchCaption('911 CALL · BODY FOUND' + (street ? ' · ' + street.toUpperCase() : '') + ' · UNIT RESPONDING', null);
          tell('A BODY HAS BEEN FOUND · THE POLICE ARE INVESTIGATING', 3);
        }
        return false;
      }
      if (!heat) {
        // Already known to the police (or an accident): the call changes nothing.
        if (wantedStars > 0 || !REPORT_BASE[inc.kind]) return false;
        heat = REPORT_BASE[inc.kind] * CRIME_HEAT;
      }
      // Where the units are sent: the scene, or the player if the caller is
      // watching them now; somebody who only heard it gives a rough spot.
      let x = inc.x,
        y = inc.y;
      if (caller && caller.hp > 0 && distanceBetween(caller, player) < 450 && crowdSight(caller, player)) {
        x = player.x + randomBetween(-40, 40);
        y = player.y + randomBetween(-40, 40);
      } else if (caller && caller.witnessOf === inc && !caller.witnessSaw && (caller.witnessD || 0) > 120) {
        x += randomBetween(-1, 1) * caller.witnessD * 0.25;
        y += randomBetween(-1, 1) * caller.witnessD * 0.25;
      }
      crime(heat / CRIME_HEAT, { x, y, kind: inc.kind, caller: caller?.police ? 'police' : 'witness' });
      return true;
    }
    /* Did the crowd already get an incident for what the player just did? */
    function recentPlayerIncident(x, y, since) {
      for (const inc of crowd.incidents)
        if (inc.attacker === player && !inc.direct && inc.time >= since && Math.abs(inc.x - x) < 300 && Math.abs(inc.y - y) < 300) return true;
      return false;
    }

    /* DeadEndCity.witnesses(): unreported crimes, 911 calls under way, the response. */
    function witnessReportData() {
      const round = (v) => Math.round(v);
      const calls = [];
      // (People further than 1,500 units are not simulated: their calls wait.)
      for (const p of pedestrians)
        if (p.hp > 0 && p.react?.kind === 'call' && distanceBetween(p, player) < 1500)
          calls.push({
            x: round(p.x),
            y: round(p.y),
            kind: p.react.inc?.kind || null,
            about: p.react.inc?.attacker === player ? 'player' : 'other',
            seconds: +p.react.t.toFixed(1),
            callSeconds: +(p.react.callTime || 0).toFixed(1),
            reported: !!p.react.reported,
            d: round(distanceBetween(p, player)),
            // The bubble the caller has up (null between lines).
            line: p.speechKind === 'call911' && p.speechUntil > gameTime ? p.speech : null,
            phone: p.pose === 'phone' || p.pose === 'text',
          });
      for (const c of offstageCalls)
        calls.push({
          x: round(c.person.x),
          y: round(c.person.y),
          kind: c.inc.kind,
          about: 'player',
          seconds: c.startedAt > 0 ? +(gameTime - c.startedAt).toFixed(1) : 0,
          callSeconds: +c.callTime.toFixed(1),
          reported: false,
          offstage: true,
          hidden: !!c.hidden,
          waiting: c.startedAt < 0,
          line: c.person.speechKind === 'call911' && c.person.speechUntil > gameTime ? c.person.speech : null,
          d: round(distanceBetween(c.person, player)),
        });
      const incidents = [];
      for (const inc of crowd.incidents)
        if (inc.attacker === player)
          incidents.push({
            kind: inc.kind,
            age: +(gameTime - inc.time).toFixed(1),
            witnesses: inc.witnesses ? inc.witnesses.filter((p) => p.hp > 0).length : 0,
            callers: inc.callers,
            reported: inc.reported,
            // Who could call and why not yet (crowd-witnesses.js witnessCallBlock).
            who: (inc.witnesses || []).map((p) => ({
              d: round(distanceBetween(p, player)),
              saw: !!p.witnessSaw,
              react: p.react?.kind || null,
              block: witnessCallBlock(p, inc) || null,
            })),
          });
      return {
        stars: Math.ceil(wantedStars),
        unreported: unreportedCrimes.map((r) => ({
          x: round(r.x),
          y: round(r.y),
          age: +(gameTime - r.at).toFixed(1),
          heat: +r.heat.toFixed(2),
          kinds: r.kinds,
          victims: r.victims.length,
        })),
        unreportedHeat: +unreportedHeat.toFixed(2),
        calls,
        incidents,
        response: policeResponse.active
          ? {
              x: round(policeResponse.x),
              y: round(policeResponse.y),
              kind: policeResponse.kind,
              street: policeResponse.street,
              eta: +policeResponse.eta.toFixed(1),
              since: +(gameTime - policeResponse.at).toFixed(1),
              arrived: policeResponse.arrivedAt > 0,
              holding: policeResponseHolding(),
            }
          : null,
        policeSeePlayer: policeEyesOnPlayer(),
        stats: { ...witnessStats, crowdReports: crowd.reports },
      };
    }
