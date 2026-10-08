    // Wreck limit: wrecks and abandoned cars nobody can see go after a timeout, with a hard cap on each (retireWrecks, wreckReport).
    /**
     * Only AI traffic is streamed out, so every wreck and every car the player left behind used to stay for
     * ever and cost physics time (a 30-minute rampage: 283 -> 353 vehicles, 5.5 -> 8.2 ms a frame). Once a
     * second a pass looks at the vehicles that are WRECKS (hp 0) or ABANDONED (the player drove it, nobody is in
     * it, it is not driven by an AI) and removes the ones nobody will miss. A candidate is never touched while it
     * is on screen (the camera footprint plus WRECK_LIMITS.viewMargin; in the chase view the chase camera's frustum
     * grown by it, CHASE_WRECK_REACH deep: chase-rules.js) or within WRECK_LIMITS.safeDistance of the
     * player, and never when it is protected: the player's own car, a mission car, an intact owned car, a car in
     * a garage job, a taxi or ride, a police crew's, anything a person is still using. The rest leave when they
     * have gone unseen for their timeout, and the hard caps (all of the kind, protected and seen included)
     * send the longest-lived unseen ones first whatever their timeout. Removal is the traffic streamer's path
     * (splice from `vehicles`; the renderer prunes its model and the stain set drops it on its own pass) plus
     * `clearCarStains` and the references that outlive a vehicle (a car's pursuit or air target).
     */
    const WRECK_LIMITS = {
      period: 1, // seconds between passes
      wreckSeconds: 50, // a wreck unseen this long goes
      abandonedSeconds: 180, // an abandoned car unseen this long goes
      wreckCap: 16, // most wrecks in the world
      abandonedCap: 24, // most abandoned cars in the world
      safeDistance: 1200, // units from the player: never touched inside it (2,600 in an aircraft)
      viewMargin: 450, // units added to the camera footprint
    };
    const wreckPass = { timer: 0, wrecks: 0, abandoned: 0, protectedCount: 0, seen: 0, retired: 0, retiredWrecks: 0, retiredAbandoned: 0, byTimeout: 0, byCap: 0, ms: 0, last: [], pool: [], poolN: 0 };
    // 0 an ordinary vehicle, 1 a wreck, 2 an abandoned car.
    function wreckKind(c) {
      if (c.hp <= 0) return isApache(c) || c.roofSite ? 0 : 1;
      if (c.drivenAt === undefined || c.occupied || c.ai || c.driverOut || isAircraft(c) || isBoat(c)) return 0;
      return 2;
    }
    // Vehicles something still depends on: never retired, whatever their age.
    function wreckProtected(c) {
      return (
        c === player.car ||
        c.mission ||
        c.failedMission ||
        c.missionTag ||
        c === mission?.car ||
        (c.owned && c.hp > 0) ||
        c === repairJob?.car ||
        c === taxiRide?.car ||
        c === dealer?.test?.car ||
        c === player.carjack?.c ||
        c.taxiHire ||
        c.deliveryScene ||
        c.crewDeployed ||
        c.blockade ||
        c.carjackTest ||
        c.rideTarget ||
        // Something still in its trunk (vehicle-trunk.js: a mission's).
        (c.trunkLoot && !c.trunkOpen) ||
        (c.hp > 0 && (c.lawUnit || c.airUnit || c.cop))
      );
    }
    // Something still points at it: a police crew on foot with the cruiser, a person walking back to a car.
    function wreckInUse(c) {
      for (let i = 0; i < officers.length; i++) if (officers[i].car === c && officers[i].hp > 0) return true;
      return false;
    }
    function retireVehicle(c, kind, why, now) {
      const index = vehicles.indexOf(c);
      if (index < 0) return false;
      vehicles.splice(index, 1);
      clearCarStains(c);
      for (let i = officers.length - 1; i >= 0; i--) if (officers[i].car === c) officers.splice(i, 1);
      for (let i = 0; i < vehicles.length; i++) {
        const o = vehicles[i];
        if (o.pursuitTarget === c) o.pursuitTarget = null;
        if (o.airTarget === c) o.airTarget = null;
        if (o.rammedBy === c) o.rammedBy = null;
      }
      wreckPass.retired++;
      if (kind === 1) wreckPass.retiredWrecks++;
      else wreckPass.retiredAbandoned++;
      if (why === 'cap') wreckPass.byCap++;
      else wreckPass.byTimeout++;
      const log = wreckPass.last;
      log.push({ id: c.id, type: c.type, kind: kind === 1 ? 'wreck' : 'abandoned', why, at: +now.toFixed(1), unseen: +(now - c.retireSeen).toFixed(1), age: +(now - c.retireBorn).toFixed(1), x: Math.round(c.x), y: Math.round(c.y) });
      if (log.length > 12) log.shift();
      return true;
    }
    // The pool slot (kind, oldest first) of a candidate the cap may take next: the longest-lived unseen one.
    function wreckOldest(kind) {
      const pool = wreckPass.pool;
      let best = -1;
      for (let i = 0; i < wreckPass.poolN; i++) {
        const c = pool[i];
        if (c && wreckKind(c) === kind && (best < 0 || c.retireBorn < pool[best].retireBorn)) best = i;
      }
      return best;
    }
    function retireWrecks(deltaSeconds) {
      wreckPass.timer -= deltaSeconds;
      if (wreckPass.timer > 0) return;
      wreckPass.timer = WRECK_LIMITS.period;
      const started = performance.now(),
        now = gameTime,
        pool = wreckPass.pool,
        view = screenViewHalf(),
        flying = isAircraft(player.car) || !!player.parachute,
        safe = flying ? WRECK_LIMITS.safeDistance * 2.2 : WRECK_LIMITS.safeDistance,
        mx = view.w + WRECK_LIMITS.viewMargin,
        my = view.h + WRECK_LIMITS.viewMargin,
        // The chase view: the chase camera's frustum, the margin a world radius, twice the sight reach deep
        // (a wreck is big and burns; chase-rules.js).
        chase = chaseCameraLive();
      let wrecks = 0,
        abandoned = 0,
        shielded = 0,
        seen = 0;
      wreckPass.poolN = 0;
      for (let i = 0; i < vehicles.length; i++) {
        const c = vehicles[i];
        if (c === player.car) c.drivenAt = now;
        const kind = wreckKind(c);
        if (kind === 0) continue;
        if (kind === 1) wrecks++;
        else abandoned++;
        if (c.retireBorn === undefined) {
          c.retireBorn = now;
          c.retireSeen = now;
        }
        if (wreckProtected(c)) {
          shielded++;
          c.retireBorn = c.retireSeen = now;
          continue;
        }
        if (
          hypot2(c.x - player.x, c.y - player.y) < safe ||
          (chase ? chaseInView(c.x, c.y, WRECK_LIMITS.viewMargin, CHASE_WRECK_REACH) : Math.abs(c.x - cameraTarget.x) < mx && Math.abs(c.y - cameraTarget.y) < my)
        ) {
          seen++;
          c.retireSeen = now;
          continue;
        }
        pool[wreckPass.poolN++] = c;
      }
      // Gone unseen for their timeout.
      for (let i = 0; i < wreckPass.poolN; i++) {
        const c = pool[i],
          kind = wreckKind(c);
        if (now - c.retireSeen < (kind === 1 ? WRECK_LIMITS.wreckSeconds : WRECK_LIMITS.abandonedSeconds) || wreckInUse(c)) continue;
        if (retireVehicle(c, kind, 'timeout', now)) {
          pool[i] = null;
          if (kind === 1) wrecks--;
          else abandoned--;
        }
      }
      // Over the cap: the longest-lived unseen ones go first, whatever their timeout.
      for (const [kind, cap] of [[1, WRECK_LIMITS.wreckCap], [2, WRECK_LIMITS.abandonedCap]]) {
        let count = kind === 1 ? wrecks : abandoned;
        while (count > cap) {
          const slot = wreckOldest(kind);
          if (slot < 0) break;
          const c = pool[slot];
          pool[slot] = null;
          if (wreckInUse(c)) continue;
          if (retireVehicle(c, kind, 'cap', now)) count--;
        }
        if (kind === 1) wrecks = count;
        else abandoned = count;
      }
      for (let i = 0; i < wreckPass.poolN; i++) pool[i] = null;
      wreckPass.wrecks = wrecks;
      wreckPass.abandoned = abandoned;
      wreckPass.protectedCount = shielded;
      wreckPass.seen = seen;
      wreckPass.ms = performance.now() - started;
    }
    // Read-only: what the pass sees now (counts against the caps, every candidate's age and why it stays) and what it retired.
    function wreckReportRun() {
      const now = gameTime,
        list = [];
      let wrecks = 0,
        abandoned = 0;
      for (const c of vehicles) {
        const kind = wreckKind(c);
        if (!kind) continue;
        if (kind === 1) wrecks++;
        else abandoned++;
        if (list.length < 60)
          list.push({
            id: c.id,
            type: c.type,
            kind: kind === 1 ? 'wreck' : 'abandoned',
            age: c.retireBorn === undefined ? null : +(now - c.retireBorn).toFixed(1),
            unseen: c.retireSeen === undefined ? null : +(now - c.retireSeen).toFixed(1),
            holds: wreckProtected(c) ? 'protected' : c.retireSeen === now ? 'near or on screen' : hypot2(c.x - player.x, c.y - player.y) < WRECK_LIMITS.safeDistance ? 'near' : 'counting',
            x: Math.round(c.x),
            y: Math.round(c.y),
          });
      }
      return {
        limits: { ...WRECK_LIMITS },
        wrecks,
        abandoned,
        vehicles: vehicles.length,
        lastPass: { protected: wreckPass.protectedCount, seen: wreckPass.seen, ms: +wreckPass.ms.toFixed(3) },
        retired: { total: wreckPass.retired, wrecks: wreckPass.retiredWrecks, abandoned: wreckPass.retiredAbandoned, byTimeout: wreckPass.byTimeout, byCap: wreckPass.byCap },
        candidates: list,
        last: wreckPass.last.slice(),
      };
    }
