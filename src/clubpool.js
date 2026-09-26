    // BEGIN SUBSYSTEM: src/clubpool.js — Marea pool: in, swim, out
    /**
     * Marea pool
     * Source: src/clubpool.js
     * Scope: shared game closure.
     *
     * The infinity pool of the Marea beach club (MAREA.poolWater, beachclub.js)
     * is somewhere the player can swim, day or night (it is lit after dark by
     * beachclub3d.js). Only from inside the club: at night that means past the
     * bouncers with a band, as for everything else in there.
     *
     *   SWIM (E) at the pool edge: a short dive into the water, a splash and its
     *     sound, and a remark from the club-goers nearby.
     *   In the water the sea's stroke (water.js `swimStroke`) runs as it does in
     *     the bay: the hard crawl by default, the easy stroke with Walk (Shift),
     *     the breath gauge in the speed box and the swimmer's pose. Movement is
     *     held inside the water (`movePoolSwimmer`, called by moveBody). Running
     *     out of breath only slows you here (the edge is never far), and holding
     *     still at the edge gets it back quicker.
     *   GET OUT (E) near an edge with deck beyond it: a step up onto the deck,
     *     dripping for a while afterwards.
     *
     * `player.pool` is the carrier (water.js declares it): { phase: 'dive' |
     * 'swim' | 'out', ... }. teleportPlayer() and the carrier checks in
     * updateSwimming let go of it; a respawn far away does too (updatePoolSwim).
     */
    const POOL = {
      // The swimmer rides here: the water plane is at 1.0 and the prone rig lies
      // 2.6 above its altitude (render3d.js FRONT CRAWL).
      surface: -1.4,
      // Swimmers are kept this far inside the water's edge.
      margin: 5,
      // Reach of SWIM from the coping, and of GET OUT from the water's edge.
      enterReach: 1.8 * UNITS_PER_METRE,
      exitReach: 1.1 * UNITS_PER_METRE,
      // How far from the swimmer an exit spot on the deck may be.
      exitSpotReach: 4.5 * UNITS_PER_METRE,
      diveSeconds: 0.65,
      climbSeconds: 0.7,
      dripSeconds: 12,
    };
    const poolState = { wetUntil: -100, dripClock: 0, breathHintAt: -100, blockedHintAt: -100, exits: null };
    (function registerPoolLines() {
      CROWD_LINES.clubPoolDive = ['Nice dive!', 'Ten out of ten!', 'Cannonball!', 'Hey! My drink!', 'Show-off!', 'Whoa, splash!', 'The water’s perfect, right?', 'Somebody give him a medal.'];
      CROWD_LINES.clubPoolNight = ['Night swim! Love it.', 'Nice dive!', 'Is it warm in there?', 'Now that’s a party.', 'Whoa, splash!'];
      CROWD_LINES.clubPoolOut = ['Towel’s over there.', 'Looking refreshed!', 'You’re dripping on my shoes.', 'Feel better?'];
    })();
    function poolWaterRect() {
      return mareaRect(MAREA.poolWater, 'water', 0);
    }
    function poolCopingRect() {
      return mareaRect(MAREA.pool, 'pool', 5);
    }
    /* Distance from a point to a rectangle (0 inside). */
    function poolRectDistance(r, x, y) {
      const dx = Math.max(r.x0 - x, 0, x - r.x1),
        dy = Math.max(r.y0 - y, 0, y - r.y1);
      return Math.hypot(dx, dy);
    }
    /* Deck spots round the pool where someone can stand (checked once: the plan is fixed). */
    function poolExitSpots() {
      if (poolState.exits) return poolState.exits;
      const P = poolCopingRect(),
        out = 9,
        spots = [];
      for (let x = P.x0 + 6; x <= P.x1 - 6; x += 6) {
        spots.push({ x, y: P.y0 - out, nx: 0, ny: -1 });
        spots.push({ x, y: P.y1 + out, nx: 0, ny: 1 });
      }
      for (let y = P.y0 + 6; y <= P.y1 - 6; y += 6) {
        spots.push({ x: P.x0 - out, y, nx: -1, ny: 0 });
        spots.push({ x: P.x1 + out, y, nx: 1, ny: 0 });
      }
      poolState.exits = spots.filter((s) => !solid(s.x, s.y, 8) && !footObstacleBlocked(s.x, s.y, 4.5));
      return poolState.exits;
    }
    function nearestPoolExit(x, y) {
      let best = null,
        bd = POOL.exitSpotReach;
      for (const s of poolExitSpots()) {
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      return best;
    }
    /* Standing by the pool, inside the club, free to jump in. */
    function poolCanEnter() {
      if (gameMode !== 'play' || player.car || player.pool || player.swimming || player.wading || player.climbing) return false;
      if (player.parachute || player.deck || playerOnRoof() || transitRide || taxiRide || player.coaster) return false;
      if (!marea.built || !mareaInside(player.x, player.y) || gameTime < marea.spookedUntil) return false;
      if (volleyPlayerInMatch()) return false;
      return poolRectDistance(poolCopingRect(), player.x, player.y) < POOL.enterReach;
    }
    function poolCanLeave() {
      const pool = player.pool;
      if (!pool || pool.phase !== 'swim') return null;
      if (poolRectDistance(poolWaterRect(), player.x, player.y) > 0) return null;
      const W = poolWaterRect(),
        edge = Math.min(player.x - W.x0, W.x1 - player.x, player.y - W.y0, W.y1 - player.y);
      if (edge > POOL.margin + POOL.exitReach) return null;
      return nearestPoolExit(player.x, player.y);
    }
    function clubPoolPrompt() {
      if (player.pool) {
        if (poolCanLeave()) return { text: 'GET OUT', id: 'marea-pool-out' };
        return null;
      }
      if (poolCanEnter()) return { text: 'SWIM', id: 'marea-pool' };
      return null;
    }
    function clubPoolInteract() {
      if (player.pool) {
        const exit = poolCanLeave();
        if (exit) {
          poolClimbOut(exit);
          return true;
        }
        // At an edge with no deck beyond it: say where the way out is.
        if (player.pool.phase === 'swim' && gameTime - poolState.blockedHintAt > 3) {
          poolState.blockedHintAt = gameTime;
          tell('POOL · Swim to an open edge to get out: the south side or the steps at the east end.', 2.6);
        }
        return player.pool.phase === 'swim';
      }
      if (!poolCanEnter()) return false;
      poolDive();
      return true;
    }
    /* Off the edge: a short arc into the water. */
    function poolDive() {
      const W = poolWaterRect(),
        inset = POOL.margin + 6,
        tx = clamp(player.x, W.x0 + inset, W.x1 - inset),
        ty = clamp(player.y, W.y0 + inset, W.y1 - inset);
      player.pool = { phase: 'dive', t: 0, from: { x: player.x, y: player.y, z: player.altitude || 0 }, to: { x: tx, y: ty } };
      player.a = Math.atan2(ty - player.y, tx - player.x);
      // Prone from the take-off: the body stretches out into the dive.
      player.swimming = true;
      player.wading = 0;
      player.swimStroke = 0;
      player.swimDrive = 0;
      player.swimBeat = 0;
      player.inv = Math.max(player.inv || 0, 0.3);
      waterEntrySound(0.25);
    }
    function poolClimbOut(exit) {
      player.pool = { phase: 'out', t: 0, from: { x: player.x, y: player.y }, to: { x: exit.x, y: exit.y } };
      player.a = Math.atan2(exit.y - player.y, exit.x - player.x);
      player.swimming = false;
      waterEntrySound(0.5);
    }
    /* Someone nearby remarks on the dive (through the crowd's speech rules). */
    function poolReaction(kind) {
      if (!npcChatterOn()) return;
      let best = null,
        bd = 14 * UNITS_PER_METRE;
      for (const p of marea.people) {
        if (p.hp <= 0 || p.club?.mode !== 'slot' || p.inConversation || p.club.slot?.kind === 'dj') continue;
        const d = distanceBetween(p, player);
        if (d < bd && sameFloor(p, player)) {
          bd = d;
          best = p;
        }
      }
      if (!best) return;
      best.speechUntil = 0;
      crowdSay(best, kind, 1);
      if (kind !== 'clubPoolOut') {
        best.clubCheerUntil = gameTime + 1.6;
        best.club.cheerPose = 'clap';
      }
    }
    function updatePoolSwim(deltaSeconds) {
      const pool = player.pool,
        W = poolWaterRect();
      // Taken somewhere else (a respawn at the hospital, a console jump): let go.
      if (poolRectDistance(W, player.x, player.y) > 40) {
        player.pool = null;
        player.swimming = false;
        return;
      }
      if (pool.phase === 'dive') {
        pool.t = Math.min(1, pool.t + deltaSeconds / POOL.diveSeconds);
        const k = pool.t;
        player.x = pool.from.x + (pool.to.x - pool.from.x) * k;
        player.y = pool.from.y + (pool.to.y - pool.from.y) * k;
        player.altitude = pool.from.z + (POOL.surface - pool.from.z) * k + Math.sin(k * Math.PI) * 9;
        player.swimStroke = k * 1.2;
        if (k >= 1) {
          pool.phase = 'swim';
          splashAt(player.x, player.y, 1.25);
          particle(player.x, player.y, '#9fe8f5', 10, 60, 3);
          poolReaction(marea.phase === 'night' || marea.phase === 'closing' ? 'clubPoolNight' : 'clubPoolDive');
          tell('POOL · hold ' + keyName('walk') + ' for an easy stroke · ' + keyName('interact') + ' at the edge to get out', 3.5);
        }
        return;
      }
      if (pool.phase === 'out') {
        pool.t = Math.min(1, pool.t + deltaSeconds / POOL.climbSeconds);
        const k = pool.t;
        player.x = pool.from.x + (pool.to.x - pool.from.x) * k;
        player.y = pool.from.y + (pool.to.y - pool.from.y) * k;
        const deck = terrainHeight(player.x, player.y);
        player.altitude = POOL.surface + (deck - POOL.surface) * Math.min(1, k * 1.6) + Math.sin(k * Math.PI) * 1.5;
        player.walk += deltaSeconds * 8;
        if (k >= 1) {
          player.pool = null;
          player.swimming = false;
          player.altitude = deck;
          poolState.wetUntil = gameTime + POOL.dripSeconds;
          if (Math.random() < 0.5) poolReaction('clubPoolOut');
        }
        return;
      }
      const driving = swimStroke(deltaSeconds, POOL.surface),
        edge = Math.min(player.x - W.x0, W.x1 - player.x, player.y - W.y0, W.y1 - player.y);
      // Hanging on at the edge gets the breath back; nobody drowns in a club pool.
      if (!driving && edge < POOL.margin + 2) swimBreath = Math.min(SWIM_BREATH, swimBreath + deltaSeconds * 2.4);
      if (swimBreath <= 0) {
        swimBreath = 0;
        if (gameTime - poolState.breathHintAt > 8) {
          poolState.breathHintAt = gameTime;
          tell('Out of breath · hold on at the edge to rest', 2.4);
        }
      }
    }
    /* moveBody for a swimmer in the pool: inside the water, no other collisions. */
    function movePoolSwimmer(displacementX, displacementY) {
      if (player.pool.phase !== 'swim') return true;
      const W = poolWaterRect(),
        m = POOL.margin,
        wantX = player.x + displacementX,
        wantY = player.y + displacementY,
        x = clamp(wantX, W.x0 + m, W.x1 - m),
        y = clamp(wantY, W.y0 + m, W.y1 - m);
      player.x = x;
      player.y = y;
      return x !== wantX || y !== wantY;
    }
    /* Out of the pool: drips on the deck for a while (updateLeisure, leisure.js). */
    function updatePoolDrips(deltaSeconds) {
      if (gameTime > poolState.wetUntil || player.pool || player.car || player.swimming) return;
      poolState.dripClock -= deltaSeconds;
      if (poolState.dripClock > 0) return;
      const left = (poolState.wetUntil - gameTime) / POOL.dripSeconds;
      poolState.dripClock = 0.12 + (1 - left) * 0.35;
      particle(player.x + randomBetween(-3, 3), player.y + randomBetween(-3, 3), '#bfe9f3', 1 + Math.round(left * 2), 10, 1.6);
    }
    function playerWet() {
      return !!player.pool || gameTime < poolState.wetUntil;
    }
    /* Developer console: DeadEndCity.clubPool(). */
    function clubPoolReport() {
      const W = poolWaterRect(),
        swimmers = marea.people.filter((p) => p.club?.slot?.swim && p.club.mode === 'slot').length;
      return {
        water: { x0: W.x0, y0: W.y0, x1: W.x1, y1: W.y1 },
        phase: player.pool ? player.pool.phase : null,
        swimming: !!player.swimming,
        inClub: mareaInside(player.x, player.y),
        canEnter: poolCanEnter(),
        canLeave: !!poolCanLeave(),
        exits: poolExitSpots().length,
        breath: Math.round(breathFraction() * 100),
        altitude: +(player.altitude || 0).toFixed(1),
        wet: playerWet(),
        clubSwimmers: swimmers,
        clubPhase: marea.phase,
        position: { x: Math.round(player.x), y: Math.round(player.y) },
      };
    }
    /* Developer console: stand on the deck by the pool (a free spot on its south side). */
    function clubPoolEdge() {
      const P = poolCopingRect(),
        spots = poolExitSpots().filter((s) => s.ny === 1);
      const s = spots.reduce((best, q) => (!best || Math.abs(q.x - (P.x0 + P.x1) / 2) < Math.abs(best.x - (P.x0 + P.x1) / 2) ? q : best), null);
      if (!s) return null;
      teleportPlayer(s.x, s.y - 1);
      player.a = -Math.PI / 2;
      return { x: Math.round(player.x), y: Math.round(player.y) };
    }
    // END SUBSYSTEM: src/clubpool.js
