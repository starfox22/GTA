    // BEGIN SUBSYSTEM: src/water.js — Swimming and sinking
    /**
     * Swimming and sinking
     * Source: src/water.js
     * Scope: shared game closure.
     * Going into the water on foot, getting out again, and what happens when a
     * car follows you in.
     */
    /**
     * WATER
     * The bay is a place you can be, but the shoreline decides how you get in.
     * Every coast segment has a style (`shoreStyle`: 'beach', 'quay' or 'rock'):
     *
     *   beach  Sand runs down into the sea. You can walk in, wade through the
     *          shallows (slower, deeper with every step) until your feet leave
     *          the bottom, and swim; and you can swim back in and walk out.
     *   quay   Sea walls, embankments, docks, piers and bridge decks are walls to
     *          someone on foot: nobody steps off them into the sea. From the
     *          water they are walls too, except at the ladders (`LADDERS`) set
     *          into quays, docks and the pier every few hundred units.
     *   rock   Natural rocky shore. You cannot walk off it into the sea, but a
     *          swimmer can haul themselves out onto it.
     *
     * `shoreStepBlocked()` applies those rules to each step the player takes on
     * foot (moveBody calls it), so the collision test itself stays one function.
     * People end up in the water in other ways too: a sinking car (E gets you
     * out), diving off a boat (J), a parachute coming down on the sea. None of
     * them can soft-lock the game: every quay has ladders, stamina lasts long
     * enough to reach one from most of the city's water, and a swimmer who is
     * spent for too long is fished out by the harbor patrol if the sea has not
     * already finished them.
     *
     * A road vehicle is stopped by the quay edge only while something sensible is
     * driving it; the player's own car is not, so you can put one in the bay. Once
     * it is over deep water it floods, settles under the surface and takes anyone
     * still inside with it. `SINK_SECONDS` is the window to get out. Beach
     * shallows only slow a car down: it takes deep water to drown one.
     */
    // Breaststroke and a hard crawl, about 3.5 and 5 km/h.
    const SWIM_SPEED = 3.5 * KMH,
      SWIM_SPRINT = 5 * KMH,
      SWIM_BREATH = 30,
      // Below this share of breath the default crawl eases into breaststroke.
      SWIM_EASE_BELOW = 0.3,
      SINK_SECONDS = 3.2,
      SINK_DEPTH = 42,
      // Distance out from a beach waterline where your feet leave the bottom.
      WADE_DEPTH = 58,
      // How deep in a beach car stops being slowed by the surf and starts to flood.
      CAR_SHALLOWS = 44,
      // Floating at the surface: the body rides just awash.
      SWIM_ALTITUDE = -4.6,
      // Seconds spent with no strength left before the harbor patrol pulls you out.
      RESCUE_AFTER = 14;
    let swimBreath = SWIM_BREATH,
      swimLast = { x: 0, y: 0 },
      spentFor = 0,
      wallHintAt = -99,
      ladderHintAt = -99;
    player.swimStroke = 0;
    player.swimDrive = 0;
    player.wading = 0;
    player.climbing = null;
    function deepWater(x, y, r = 4) {
      return !groundAt(x, y, r) && !onBridge(x, y, r) && !onDock(x, y, r);
    }
    /**
     * SHORE INDEX
     * The coast segments bucketed into 128-unit cells with their end points and
     * style, so "what kind of shore is this?" is a handful of distance tests.
     * Bridge and dock openings are left out: there the structure is the shore.
     */
    const SHORE_CELL = 128;
    let shoreGrid = null;
    function shoreIndex() {
      if (shoreGrid) return shoreGrid;
      shoreGrid = new Map();
      for (const e of coastSegments()) {
        if (e.opening) continue;
        const dx = (Math.cos(e.a) * e.length) / 2,
          dy = (Math.sin(e.a) * e.length) / 2,
          seg = { ax: e.x - dx, ay: e.y - dy, bx: e.x + dx, by: e.y + dy, style: shoreStyle(e), e };
        const x0 = Math.floor((Math.min(seg.ax, seg.bx) - 2) / SHORE_CELL),
          x1 = Math.floor((Math.max(seg.ax, seg.bx) + 2) / SHORE_CELL),
          y0 = Math.floor((Math.min(seg.ay, seg.by) - 2) / SHORE_CELL),
          y1 = Math.floor((Math.max(seg.ay, seg.by) + 2) / SHORE_CELL);
        for (let i = x0; i <= x1; i++)
          for (let j = y0; j <= y1; j++) {
            const key = i * 8192 + j;
            if (!shoreGrid.has(key)) shoreGrid.set(key, []);
            shoreGrid.get(key).push(seg);
          }
      }
      return shoreGrid;
    }
    /* The nearest coast segment within `reach` (at most one cell) of a point. */
    function nearestShore(x, y, reach = SHORE_CELL) {
      const grid = shoreIndex(),
        ci = Math.floor(x / SHORE_CELL),
        cj = Math.floor(y / SHORE_CELL);
      let best = null,
        bestD = reach;
      for (let i = ci - 1; i <= ci + 1; i++)
        for (let j = cj - 1; j <= cj + 1; j++) {
          const cell = grid.get(i * 8192 + j);
          if (!cell) continue;
          for (const s of cell) {
            const d = segmentDistance(x, y, [s.ax, s.ay], [s.bx, s.by]);
            if (d < bestD) {
              bestD = d;
              best = s;
            }
          }
        }
      return best ? { style: best.style, d: bestD, seg: best } : null;
    }
    /* 'beach', 'rock', 'quay' or null (no shore within reach). */
    function shoreAccess(x, y, reach = 90) {
      return nearestShore(x, y, reach)?.style || null;
    }
    /* How far out from a beach waterline a water point is; Infinity off any beach. */
    function beachShelfDistance(x, y) {
      const s = nearestShore(x, y, SHORE_CELL);
      return s && s.style === 'beach' ? s.d : Infinity;
    }
    /**
     * LADDERS
     * Steel ladders set into the quay walls every ~420 units of sea wall, at the
     * outer end of each dock, and either side of the fishing pier's head. Each
     * one knows its foot (in the water), the edge it hangs from and the top
     * (dry ground a few steps inland), and the direction you climb in.
     * beach3d.js draws them from this list, so what you see is what works.
     */
    let ladderCache = null;
    function ladderList() {
      if (ladderCache) return ladderCache;
      ladderCache = [];
      const add = (edge, a, kind, deck = 5.6) => {
        const foot = { x: edge.x - Math.cos(a) * 12, y: edge.y - Math.sin(a) * 12 },
          top = { x: edge.x + Math.cos(a) * 16, y: edge.y + Math.sin(a) * 16 };
        if (!groundAt(top.x, top.y, 8) || solid(top.x, top.y, 8)) return;
        if (groundAt(foot.x, foot.y, 4) || solid(foot.x, foot.y, 6, true)) return;
        // A swimmer (radius 8) has to be able to reach the foot head-on: a ladder
        // squeezed between a finger pontoon and a moored hull, boxed in by a dock
        // or hidden behind a dock's own boat was drawn but could not be climbed.
        for (const k of [0, 18, 36]) {
          const x = foot.x - Math.cos(a) * k,
            y = foot.y - Math.sin(a) * k;
          if (
            landAt(x, y) ||
            solid(x, y, 9, true) ||
            DOCKS.some(
              (d) =>
                (x + 9 > d.x && x - 9 < d.x + d.w && y + 9 > d.y && y - 9 < d.y + d.h) ||
                Math.hypot(x - d.boatX, y - d.boatY) < 40,
            )
          )
            return;
        }
        if (ladderCache.some((l) => Math.hypot(l.x - foot.x, l.y - foot.y) < 120)) return;
        ladderCache.push({ x: foot.x, y: foot.y, edge, top, a, kind, deck });
      };
      // Sea walls: walk each quay run and drop a ladder every so often.
      let run = 210;
      for (const e of coastSegments()) {
        if (e.opening || shoreStyle(e) !== 'quay') continue;
        run += e.length;
        if (run < 420) continue;
        const { nx, ny } = shoreNormal(e);
        const before = ladderCache.length;
        add({ x: e.x, y: e.y }, Math.atan2(-ny, -nx), 'quay');
        if (ladderCache.length > before) run = 0;
      }
      // Docks: a ladder off whichever end or side faces open water, farthest from land.
      for (const d of DOCKS) {
        const cx = d.x + d.w / 2,
          cy = d.y + d.h / 2,
          sides = [
            { x: d.x, y: cy, a: 0 },
            { x: d.x + d.w, y: cy, a: Math.PI },
            { x: cx, y: d.y, a: Math.PI / 2 },
            { x: cx, y: d.y + d.h, a: -Math.PI / 2 },
          ].sort((p, q) => Math.hypot(q.x - d.boatX, q.y - d.boatY) - Math.hypot(p.x - d.boatX, p.y - d.boatY));
        for (const s of sides.reverse()) {
          const before = ladderCache.length;
          add({ x: s.x, y: s.y }, s.a, 'dock', 2.2);
          if (ladderCache.length > before) break;
        }
      }
      // The fishing pier: one each side of the head.
      const head = BEACH.pier[1];
      add({ x: head.x, y: head.y + head.h / 2 }, 0, 'pier', 7.4);
      add({ x: head.x + head.w, y: head.y + head.h / 2 }, Math.PI, 'pier', 7.4);
      return ladderCache;
    }
    function nearestLadder(x, y, reach) {
      let best = null,
        bd = reach;
      for (const l of ladderList()) {
        const d = Math.hypot(l.x - x, l.y - y);
        if (d < bd) {
          bd = d;
          best = l;
        }
      }
      return best;
    }
    /* The closest way out of the water from a point: a ladder foot or a beach or rocky shore. */
    function nearestWaterExit(x, y) {
      let best = null,
        bd = Infinity;
      for (const l of ladderList()) {
        const d = Math.hypot(l.x - x, l.y - y);
        if (d < bd) {
          bd = d;
          best = { x: l.top.x, y: l.top.y, kind: 'ladder', d };
        }
      }
      for (const e of coastSegments()) {
        if (e.opening) continue;
        const style = shoreStyle(e);
        if (style === 'quay') continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < bd) {
          const { nx, ny } = shoreNormal(e);
          const p = { x: e.x - nx * 30, y: e.y - ny * 30 };
          if (!groundAt(p.x, p.y, 8) || solid(p.x, p.y, 8)) continue;
          bd = d;
          best = { ...p, kind: style, d };
        }
      }
      return best;
    }
    /**
     * THE SHORELINE RULE
     * Called by moveBody() for each axis of each step the player takes on foot
     * (walking, wading or swimming). Returns true when the shore forbids the step.
     * `r` is the collision radius moveBody uses.
     */
    function shoreStepBlocked(fromX, fromY, x, y, r) {
      if (player.climbing) return true;
      if (player.swimming) {
        // Docks are solid to a swimmer; bridges and the pier are overhead.
        if (DOCKS.some((d) => x + r > d.x && x - r < d.x + d.w && y + r > d.y && y - r < d.y + d.h)) return true;
        const touchesLand =
          landAt(x, y) || landAt(x - r, y - r) || landAt(x + r, y - r) || landAt(x - r, y + r) || landAt(x + r, y + r);
        if (!touchesLand) return false;
        const access = shoreAccess(x, y);
        if (access === 'beach' || access === 'rock') return false;
        wallHint();
        return true;
      }
      // The superyacht's passerelle is a walkway off the quay, not the sea: walking
      // east onto it is how you board (updateMarinaFooting), and the sea-wall rule
      // used to stop everyone at the quay edge in front of it.
      const targetDry = groundAt(x, y, r) || onSuperyachtGangway(x, y),
        fromDry = groundAt(fromX, fromY, r) || onSuperyachtGangway(fromX, fromY);
      if (targetDry) {
        if (fromDry) return false;
        // Wading out: only up onto sand or rocks, never onto a structure.
        if (onBridge(x, y, r) || onDock(x, y, r) || onBeachPier(x, y, r)) return true;
        const access = shoreAccess(x, y);
        return access !== 'beach' && access !== 'rock';
      }
      // Already standing in the shallows: deeper is allowed (you start to swim).
      if (!fromDry) return false;
      // Stepping off: only from natural ground, and only where the shore is a beach.
      if (onBridge(fromX, fromY, r) || onDock(fromX, fromY, r) || onBeachPier(fromX, fromY, r) || !landAt(fromX, fromY)) {
        wallHint();
        return true;
      }
      if (shoreAccess(x, y) === 'beach') return false;
      wallHint();
      return true;
    }
    function wallHint() {
      if (gameTime - wallHintAt < 6) return;
      wallHintAt = gameTime;
      tell(
        player.swimming
          ? 'SEA WALL · swim along to a ladder or a beach to get out'
          : 'SEA WALL · you can only walk into the sea from a beach',
        2.6,
      );
    }
    /* The swimmer crawls hard by default, like the run on land, and eases into
       breaststroke while the walk action (Shift) is held or once breath runs low
       (SWIM_EASE_BELOW), so the default never spends the last of it. */
    function swimHard() {
      return !actionHeld('walk') && breathFraction() > SWIM_EASE_BELOW;
    }
    function swimSpeed() {
      return (swimHard() ? SWIM_SPRINT : SWIM_SPEED) * (swimBreath > 0 ? 1 : 0.55);
    }
    /* Walking pace in the shallows: knee deep is a slog, waist deep a crawl. */
    function wadeFactor() {
      return 1 - 0.58 * clamp(player.wading, 0, 1);
    }
    function breathFraction() {
      return clamp(swimBreath / SWIM_BREATH, 0, 1);
    }
    function playerDriving() {
      return !!(
        keys.KeyW ||
        keys.KeyA ||
        keys.KeyS ||
        keys.KeyD ||
        keys.ArrowUp ||
        keys.ArrowDown ||
        keys.ArrowLeft ||
        keys.ArrowRight
      );
    }
    function leaveWater(message) {
      if (player.swimming || player.wading) tell(message, 2);
      player.swimming = false;
      player.wading = 0;
      spentFor = 0;
    }
    function updateSwimming(deltaSeconds) {
      if (
        player.car ||
        playerOnRoof() ||
        player.deck ||
        player.parachute ||
        transitRide ||
        taxiRide ||
        player.coaster
      ) {
        player.swimming = false;
        player.wading = 0;
        player.climbing = null;
        swimBreath = Math.min(SWIM_BREATH, swimBreath + deltaSeconds * 6);
        return;
      }
      // A jump across the map (respawn, teleport, rescue) is not swimming ashore.
      if (Math.hypot(player.x - swimLast.x, player.y - swimLast.y) > 150 && !player.climbing) {
        player.swimming = false;
        player.wading = 0;
        spentFor = 0;
      }
      swimLast.x = player.x;
      swimLast.y = player.y;
      if (player.climbing) {
        updateLadderClimb(deltaSeconds);
        return;
      }
      // A swimmer is in the water anywhere that is not land or a dock (a bridge
      // or the pier is overhead); someone on foot is in it once they are off
      // whatever they were standing on.
      const inWater = player.swimming
        ? !landAt(player.x, player.y) && !onDock(player.x, player.y)
        : !groundAt(player.x, player.y, 3);
      if (!inWater) {
        leaveWater(player.swimming ? 'You haul yourself out of the water.' : 'Back on dry sand.');
        swimBreath = Math.min(SWIM_BREATH, swimBreath + deltaSeconds * 5);
        return;
      }
      const shelf = beachShelfDistance(player.x, player.y),
        // Feet find the bottom a little closer in than they leave it.
        standing = shelf < (player.swimming ? WADE_DEPTH - 12 : WADE_DEPTH);
      if (standing) {
        if (player.swimming) tell('You find your feet.', 1.8);
        else if (!player.wading) waterEntrySound(0.35);
        player.swimming = false;
        player.wading = clamp(shelf / WADE_DEPTH, 0.08, 1);
        // Knee deep at the waterline, waist deep where swimming starts.
        player.altitude = -1.5 - player.wading * 6.5;
        swimBreath = Math.min(SWIM_BREATH, swimBreath + deltaSeconds * 2);
        spentFor = 0;
        return;
      }
      if (!player.swimming) {
        player.swimStroke = 0;
        player.swimDrive = 0;
        player.swimBeat = 0;
        // Pushing off from the shallows is a quiet start; everything else is a plunge.
        if (player.wading) waterEntrySound(0.6);
        else splashAt(player.x, player.y, 1.3);
        tell('SWIMMING · hold ' + keyName('walk') + ' for an easy stroke that saves breath · your weapons are no use here', 3.5);
      }
      player.wading = 0;
      player.swimming = true;
      // Riding the surface: the body floats just awash, the back clear of it.
      const driving = playerDriving(),
        hard = driving && swimHard();
      player.swimDrive += ((driving ? (hard ? 1 : 0.62) : 0) - player.swimDrive) * Math.min(1, deltaSeconds * 4);
      // One arm cycle per stroke: slow and long while floating, quick when driving.
      player.swimStroke += deltaSeconds * (1.5 + player.swimDrive * 5.2);
      player.altitude = SWIM_ALTITUDE + Math.sin(player.swimStroke) * 0.5 + Math.sin(gameTime * 1.3) * 0.4;
      // Treading water tires you slowly, breaststroke faster, the hard crawl fastest.
      swimBreath -= deltaSeconds * (hard ? 1.7 : driving ? 1 : 0.4);
      if (Math.floor(player.swimStroke / Math.PI) !== player.swimBeat) {
        player.swimBeat = Math.floor(player.swimStroke / Math.PI);
        if (player.swimDrive > 0.25) {
          const reach = player.a + (player.swimBeat % 2 ? 0.7 : -0.7);
          particle(
            player.x + Math.cos(reach) * 11,
            player.y + Math.sin(reach) * 11,
            '#e6f4f7',
            3,
            34 * player.swimDrive,
            3,
          );
        }
        swimStrokeSound(player.swimDrive, player.swimBeat % 2 ? 1 : -1);
        // A breath on every other stroke once it starts to hurt.
        if (breathFraction() < 0.35 && player.swimBeat % 2 === 0) swimGasp(1 - breathFraction() / 0.35);
      }
      // A ladder within reach: swim into it to climb out.
      const ladder = nearestLadder(player.x, player.y, 26);
      if (ladder) {
        const toward = Math.cos(player.a - ladder.a) > 0.2;
        if (driving && toward) startLadderClimb(ladder);
        else if (gameTime - ladderHintAt > 8) {
          ladderHintAt = gameTime;
          tell('LADDER · swim into it to climb out', 2.4);
        }
      }
      if (swimBreath <= 0) {
        swimBreath = 0;
        spentFor += deltaSeconds;
        hurt(8 * deltaSeconds, 'blast');
        if (Math.floor(gameTime * 2) % 4 === 0 && Math.random() < deltaSeconds * 4) splashAt(player.x, player.y, 0.5);
        if (spentFor > RESCUE_AFTER && gameMode === 'play') harborPatrolRescue();
      } else spentFor = 0;
    }
    /* Pulled from the sea by the harbor patrol: never left to tread water forever. */
    function harborPatrolRescue() {
      const exit = nearestWaterExit(player.x, player.y) || { x: spawn.x, y: spawn.y };
      player.swimming = false;
      player.wading = 0;
      player.x = exit.x;
      player.y = exit.y;
      player.altitude = terrainHeight(exit.x, exit.y);
      cameraTarget.x = player.x;
      cameraTarget.y = player.y;
      swimBreath = SWIM_BREATH * 0.5;
      spentFor = 0;
      cash = Math.max(0, cash - 100);
      tell('HARBOR PATROL fished you out · $100 for the call-out', 4);
    }
    /**
     * CLIMBING OUT
     * About a second on the rungs: along to the wall, up out of the water and a
     * step onto the quay. Movement is locked (shoreStepBlocked) while it runs.
     */
    function startLadderClimb(ladder) {
      player.climbing = { ladder, t: 0, from: { x: player.x, y: player.y }, rung: 0 };
      player.swimming = false;
      player.a = ladder.a;
    }
    function updateLadderClimb(deltaSeconds) {
      const c = player.climbing,
        l = c.ladder;
      c.t = Math.min(1, c.t + deltaSeconds / 1.2);
      player.a = l.a;
      player.walk += deltaSeconds * 8;
      if (c.t < 0.25) {
        // Across to the foot of the ladder.
        const k = c.t / 0.25;
        player.x = c.from.x + (l.edge.x - Math.cos(l.a) * 4 - c.from.x) * k;
        player.y = c.from.y + (l.edge.y - Math.sin(l.a) * 4 - c.from.y) * k;
        player.altitude = SWIM_ALTITUDE;
      } else if (c.t < 0.8) {
        // Up the rungs, streaming water.
        const k = (c.t - 0.25) / 0.55;
        player.altitude = SWIM_ALTITUDE + (l.deck - SWIM_ALTITUDE) * k - 1;
        const rung = Math.floor(k * 5);
        if (rung !== c.rung) {
          c.rung = rung;
          ladderRungSound(rung);
        }
      } else {
        // Over the edge and a step inland.
        const k = (c.t - 0.8) / 0.2;
        player.x = l.edge.x + (l.top.x - l.edge.x) * k;
        player.y = l.edge.y + (l.top.y - l.edge.y) * k;
        player.altitude = l.deck * (1 - k) + terrainHeight(player.x, player.y) * k;
      }
      if (c.t >= 1) {
        player.climbing = null;
        player.swimming = false;
        player.wading = 0;
        player.x = l.top.x;
        player.y = l.top.y;
        player.altitude = terrainHeight(player.x, player.y);
        tell('Out of the water.', 1.6);
      }
    }
    /* Somebody or something hits the water. */
    function splashAt(x, y, force = 1) {
      particle(x, y, '#cfe6ea', Math.round(6 * force) + 4, 70 * force, 4);
      waterSplashSound(force, { x, y });
    }
    /**
     * INTO THE WATER FROM A VEHICLE
     * `exitIntoWater` is exitCar's last resort: out of a flooding car, or off a
     * boat when J is pressed (`diveOverboard`), the player goes over the side
     * into the sea instead of being told there is no room.
     */
    function exitIntoWater(vehicle) {
      if (!vehicle || isAircraft(vehicle)) return false;
      const spec = vehicleSpec(vehicle);
      for (const extra of [14, 26, 40])
        for (const turn of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
          const a = vehicle.a + turn,
            r = (Math.abs(Math.sin(turn)) > 0.5 ? spec.w : spec.l) / 2 + extra,
            x = vehicle.x + Math.cos(a) * r,
            y = vehicle.y + Math.sin(a) * r;
          if (landAt(x, y) || onDock(x, y, 0) || solid(x, y, 8, true)) continue;
          if (vehicles.some((o) => o !== vehicle && pointInCar(x, y, o, 9))) continue;
          player.x = x;
          player.y = y;
          player.altitude = SWIM_ALTITUDE;
          player.a = a;
          return true;
        }
      return false;
    }
    function diveOverboard() {
      const c = player.car;
      if (gameMode !== 'play' || !c || !(isBoat(c) || c.sinkFor > 0)) return false;
      if (Math.abs(c.speed || 0) > 90) {
        tell('Too fast to go over the side. Ease off first.', 2.4);
        return false;
      }
      if (!exitIntoWater(c)) {
        tell('No clear water to dive into here.', 2.4);
        return false;
      }
      c.ai = false;
      c.speed *= 0.4;
      if (c.vx !== undefined) {
        c.vx *= 0.4;
        c.vy *= 0.4;
      }
      player.car = null;
      player.inv = 0.5;
      player.swimming = true;
      player.swimStroke = 0;
      player.swimDrive = 0;
      splashAt(player.x, player.y, 1.4);
      tell('OVER THE SIDE · swim back and press E to climb aboard', 3);
      return true;
    }
    /* A parachute that comes down on the sea: into the water, if there is a way out. */
    function parachuteSplashdown() {
      const exit = nearestWaterExit(player.x, player.y);
      if (!exit || exit.d > 1600) return false;
      player.parachute = null;
      clearTouchInput();
      keys = {};
      player.inv = 1;
      player.altitude = SWIM_ALTITUDE;
      player.swimming = true;
      player.swimStroke = 0;
      player.swimDrive = 0;
      splashAt(player.x, player.y, 1.8);
      tell(
        'SPLASHDOWN · ' + (exit.kind === 'ladder' ? 'nearest ladder' : 'nearest shore') + ' ' + Math.round(worldMeters(exit.d)) + ' m away',
        4,
      );
      return true;
    }
    /* A car in the bay floods, slows to a stop and settles under the surface. */
    function updateSinking(deltaSeconds) {
      for (const c of vehicles) {
        if (isBoat(c) || isAircraft(c)) {
          c.sinkFor = 0;
          c.sinkDepth = 0;
          continue;
        }
        // On a drawbridge leaf, or still in the air off one: not in the water yet.
        if (!deepWater(c.x, c.y, 6) || c.deckAir || c.deckLeaf) {
          if (c.sinkFor) {
            c.sinkFor = 0;
            c.sinkDepth = 0;
          }
          c.surfing = false;
          continue;
        }
        // Beach shallows: the surf drags at the wheels but the car stays afloat on the sand.
        if (beachShelfDistance(c.x, c.y) < CAR_SHALLOWS) {
          if (!c.surfing) {
            c.surfing = true;
            splashAt(c.x, c.y, 1.2);
          }
          const drag = Math.exp(-1.4 * deltaSeconds);
          c.vx = (c.vx || 0) * drag;
          c.vy = (c.vy || 0) * drag;
          c.speed = (c.speed || 0) * drag;
          if (Math.abs(c.speed) > 30 && Math.random() < deltaSeconds * 5) splashAt(c.x + randomBetween(-14, 14), c.y + randomBetween(-14, 14), 0.4);
          continue;
        }
        c.surfing = false;
        const first = !c.sinkFor;
        c.sinkFor = (c.sinkFor || 0) + deltaSeconds;
        if (first) {
          splashAt(c.x, c.y, 2.2);
          carFloodSound(c);
          if (c === player.car) tell('THE CAR IS GOING UNDER · E to get out', 3);
        }
        const drag = Math.exp(-2.6 * deltaSeconds);
        c.vx = (c.vx || 0) * drag;
        c.vy = (c.vy || 0) * drag;
        c.speed = (c.speed || 0) * drag;
        c.av = (c.av || 0) * drag;
        c.sinkDepth = Math.min(SINK_DEPTH, (c.sinkFor / SINK_SECONDS) * SINK_DEPTH);
        if (Math.random() < deltaSeconds * 3) {
          particle(c.x + randomBetween(-16, 16), c.y + randomBetween(-16, 16), '#cfe6ea', 3, 30, 3);
          if (c.sinkFor < SINK_SECONDS + 3) sinkingBubbles(c);
        }
        if (c === player.car) {
          if (c.sinkFor > SINK_SECONDS) {
            exitCar();
            player.car = null;
            player.inv = 0;
            player.swimming = true;
            swimBreath = 0;
            tell('You went down with the car.', 4);
            hurt(1000, 'blast');
          }
        } else if (c.sinkFor > SINK_SECONDS + 1.5 && c.hp > 0) {
          // Anything else that ends up in the bay is simply written off there. It
          // is marked dead here so updateCars does not treat the write-off as a
          // wreck going up (a flooded car on the seabed used to explode), and dated
          // well past the 12 s a fresh wreck burns for, so no flames are drawn on
          // the water above it.
          c.hp = 0;
          c.deadTime = Math.max(0.001, gameTime - 60);
          c.sunk = true;
          c.ai = false;
          c.cop = false;
          c.sprite = null;
          if (c.damage) {
            c.damage.burning = 0;
            c.damage.burnt = true;
            c.damage.wreckedAt = c.deadTime;
          }
        }
      }
    }
    /* Developer console readout: where the player stands with the water. */
    function swimStatus() {
      const exit = nearestWaterExit(player.x, player.y);
      return {
        swimming: !!player.swimming,
        wading: +(player.wading || 0).toFixed(2),
        climbing: !!player.climbing,
        breath: Math.round(breathFraction() * 100),
        altitude: +(player.altitude || 0).toFixed(1),
        shore: shoreAccess(player.x, player.y, SHORE_CELL),
        shelf: Number.isFinite(beachShelfDistance(player.x, player.y))
          ? Math.round(beachShelfDistance(player.x, player.y))
          : null,
        ladders: ladderList().length,
        nearestExit: exit ? { x: Math.round(exit.x), y: Math.round(exit.y), kind: exit.kind, d: Math.round(exit.d) } : null,
      };
    }
    // END SUBSYSTEM: src/water.js
