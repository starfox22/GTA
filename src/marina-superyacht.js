    /* ---- Superyacht deck plan ------------------------------------------------ */
    let superyachtPlanCache = null;
    const inStairRect = (s, u, v) => u >= s.u0 && u <= s.u1 && v >= s.v0 && v <= s.v1;
    // Outlines and blockers for each level, derived once from SUPERYACHT.
    function superyachtPlan() {
      if (superyachtPlanCache) return superyachtPlanCache;
      const ship = SUPERYACHT;
      const levels = ship.levels.map((level, index) => {
        let outline;
        if (level.hull) {
          const [from, to] = level.hull,
            side = [];
          for (let u = from; u <= to; u += 6) side.push([u, Math.max(1, superyachtHalfBeam(u) - ship.bulwark)]);
          outline = [...side.map(([u, v]) => [u, -v]), ...side.reverse()];
        } else if (level.circle) outline = circleOutline(...level.circle);
        else outline = deckOutline(...level.outline);
        const blocks = [];
        for (const house of ship.houses)
          if (house.level === index) {
            const [aft, fwd, hw, nose, e] = house.outline;
            blocks.push({
              outer: deckOutline(aft, fwd, hw, nose, e),
              inner: house.open ? deckOutline(aft + 3, fwd - 3, hw - 3, Math.max(0, nose - 3), e) : null,
              doors: house.doors || [],
            });
          }
        // Stand-alone furniture blocks; the mast and bar stand under the hardtop.
        const furniture = ship.furniture
          .filter((f) => f[0] === index)
          .map(([, type, u, v, l, w]) => ({ type, u, v, l, w }));
        // The raised helipad stands over the foredeck on legs.
        if (index === 1) blocks.push({ outer: circleOutline(172, 0, 32), inner: null, doors: [] });
        return { ...level, index, outline, blocks, furniture, stairs: ship.stairs.filter((s) => s.lo === index || s.hi === index) };
      });
      superyachtPlanCache = { levels };
      return superyachtPlanCache;
    }
    function superyachtLevelContains(level, u, v) {
      return pointInPolygon(u, v, level.outline) || level.stairs.some((s) => inStairRect(s, u, v));
    }
    function superyachtBlockHit(block, u, v) {
      if (!pointInPolygon(u, v, block.outer)) return false;
      if (!block.inner) return true;
      if (pointInPolygon(u, v, block.inner)) return false;
      return !block.doors.some((d) => u >= d[0] && u <= d[1] && v >= d[2] && v <= d[3]);
    }
    /* A point is free on a level when it and four points around it are on that
       level's deck (or its stair landings), clear of houses and furniture, and
       the centre itself is not over a stair well. */
    function yachtPointFree(levelIndex, u, v, r = 4) {
      const level = superyachtPlan().levels[levelIndex];
      if (!level) return false;
      const probes = [
        [0, 0],
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
      ];
      for (const [du, dv] of probes) {
        if (!superyachtLevelContains(level, u + du, v + dv)) return false;
        for (const block of level.blocks) if (superyachtBlockHit(block, u + du, v + dv)) return false;
      }
      for (const f of level.furniture)
        if (Math.abs(u - f.u) < f.l / 2 + r * 0.6 && Math.abs(v - f.v) < f.w / 2 + r * 0.6) return false;
      return !level.stairs.some((s) => inStairRect(s, u, v));
    }
    function stairHeight(stair, u) {
      const levels = SUPERYACHT.levels,
        lo = stair.lo < 0 ? 0 : levels[stair.lo].z,
        hi = levels[stair.hi].z;
      return lo + (hi - lo) * clamp((u - stair.u0) / (stair.u1 - stair.u0), 0, 1);
    }
    function moveOnYacht(dx, dy) {
      let blocked = false;
      if (dx && !yachtStep(player.x + dx, player.y)) blocked = true;
      if (player.deck && dy && !yachtStep(player.x, player.y + dy)) blocked = true;
      return blocked;
    }
    // One axis of movement aboard: along a stair, onto a stair, or across a level.
    function yachtStep(x, y) {
      const ship = SUPERYACHT,
        from = deckLocal(ship, player.x, player.y),
        to = deckLocal(ship, x, y),
        stair = player.deckStair;
      const accept = (z) => {
        player.x = x;
        player.y = y;
        player.altitude = z;
        return true;
      };
      if (stair) {
        if (to.v < stair.v0 - 1 || to.v > stair.v1 + 1) return false;
        if (to.u >= stair.u0 && to.u <= stair.u1) return accept(stairHeight(stair, to.u));
        const target = to.u > stair.u1 ? stair.hi : stair.lo;
        if (target < 0) {
          // Off the end of the passerelle and onto the quay.
          leaveSuperyacht(x, y);
          return true;
        }
        if (!yachtPointFree(target, to.u, to.v, 3)) return false;
        player.deckLevel = target;
        player.deckStair = null;
        return accept(ship.levels[target].z);
      }
      const level = player.deckLevel;
      if (yachtPointFree(level, to.u, to.v)) return accept(ship.levels[level].z);
      const entry = ship.stairs.find(
        (s) =>
          inStairRect(s, to.u, to.v) &&
          ((s.lo === level && from.u <= s.u0 + 3) || (s.hi === level && from.u >= s.u1 - 3)),
      );
      if (!entry) return false;
      player.deckStair = entry;
      return accept(stairHeight(entry, to.u));
    }
    // Which deck the player stands on, for the HUD, tests and the renderer's cutaway.
    function superyachtDeckState() {
      if (player.deck !== SUPERYACHT) return null;
      const { u, v } = deckLocal(SUPERYACHT, player.x, player.y),
        level = player.deckStair ? null : SUPERYACHT.levels[player.deckLevel];
      return {
        ship: SUPERYACHT.name,
        deck: player.deckStair ? (player.deckStair.gangway ? 'PASSERELLE' : 'STAIRS') : level.name,
        level: player.deckStair ? -1 : player.deckLevel,
        elevation: Math.round(player.altitude),
        u: Math.round(u),
        v: Math.round(v),
      };
    }
    /* The renderer lifts away every deck above the player that would hide them:
       returns the lowest deck height above the player whose outline covers the
       player's position, or Infinity when nothing overhead is in the way. */
    function superyachtCoverHeight() {
      if (player.deck !== SUPERYACHT) return Infinity;
      const { u, v } = deckLocal(SUPERYACHT, player.x, player.y),
        z = player.altitude;
      let cover = Infinity;
      for (const level of superyachtPlan().levels)
        if (level.z > z + 12 && level.z < cover && !level.circle && pointInPolygon(u, v, level.outline))
          cover = level.z;
      return cover;
    }
    function boardSuperyachtFromGangway() {
      player.deck = SUPERYACHT;
      player.deckLevel = 0;
      player.deckStair = SUPERYACHT_GANGWAY;
      const { u } = deckLocal(SUPERYACHT, player.x, player.y);
      player.altitude = stairHeight(SUPERYACHT_GANGWAY, u);
      tell('WELCOME ABOARD ' + SUPERYACHT.name.replace('M/Y ', ''), 2.4);
    }
    function leaveSuperyacht(x, y) {
      player.deck = null;
      player.deckStair = null;
      player.x = x;
      player.y = y;
      player.altitude = terrainHeight(x, y);
    }
    function onSuperyachtGangway(x, y, r = 0) {
      const { u, v } = deckLocal(SUPERYACHT, x, y),
        g = SUPERYACHT_GANGWAY;
      return u >= g.u0 - r && u <= g.u1 + r && v >= g.v0 - r && v <= g.v1 + r;
    }
    /* Called every frame: walking onto the passerelle from the quay steps aboard. */
    function updateMarinaFooting() {
      if (player.deck || player.car || playerOnRoof() || player.parachute || player.swimming) return;
      if (transitRide || taxiRide || player.coaster) return;
      const { u, v } = deckLocal(SUPERYACHT, player.x, player.y),
        g = SUPERYACHT_GANGWAY;
      if (u > g.u0 + 1 && u < g.u1 && v > g.v0 && v < g.v1) {
        if (wantedStars > 0) {
          // Security will not let a wanted man aboard: back onto the quay.
          player.x = deckWorld(SUPERYACHT, g.u0 - 4, v).x;
          needToLosePolice();
          return;
        }
        boardSuperyachtFromGangway();
      }
    }
    // The club, fuel dock and terminal never move: the list is made once.
    let marinaSolidCache = null;
    function marinaSolids() {
      return (marinaSolidCache ||= [
        { ...MARINA.club, height: 44 },
        { ...MARINA.fuel, height: 20 },
        { ...MARINA.terminal, height: 56 },
      ]);
    }
    /* Pontoons are walkable, the basin around them is not, and hulls are solid. */
    function marinaBlocked(x, y, r = 0) {
      const b = MARINA.basin;
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) {
        const onFinger = MARINA.fingers.some(
          (f) => x + r > f.x - 3 && x - r < f.x + f.w + 3 && y + r > f.y && y - r < f.y + f.h,
        );
        // The boat jetties off the east quay (DOCKS) are walkable too.
        if (!onFinger && !onSuperyachtGangway(x, y, 1) && !onDock(x, y, r)) return true;
        if (berthedHullAt(x, y, r)) return true;
      }
      return rectListBlocked(marinaSolids(), x, y, r);
    }
    let berthCache = null;
    function marinaBoats() {
      if (berthCache) return berthCache;
      berthCache = MARINA_BERTHS.map(([fi, side, along, design], i) => {
        const f = MARINA.fingers[fi];
        return {
          id: 'yacht' + i,
          x: f.x + f.w / 2 + side * (design.beam / 2 + 13),
          y: f.y + f.h - along,
          len: design.len,
          beam: design.beam,
          hull: design.hull,
          house: design.accent,
          design,
          side,
          a: -Math.PI / 2,
          bob: i * 0.7,
        };
      });
      return berthCache;
    }
    function berthedHullAt(x, y, r = 0) {
      return marinaBoats().some(
        (b) =>
          Math.abs(x - b.x) < b.beam / 2 + r - 2 && Math.abs(y - b.y) < b.len / 2 + r - 4,
      );
    }
    /* Everything a boat must steer round in and near the basin, as oriented boxes
       for boatFits(): the liners, the moored boats, the superyacht and her
       tender, and the pontoons themselves. */
    let marinaObstacleCache = null;
    function marinaObstacles() {
      if (marinaObstacleCache) return marinaObstacleCache;
      const s = SUPERYACHT,
        centre = deckWorld(s, (s.aft - 20 + s.fwd) / 2, 0),
        tender = deckWorld(s, -196, 68);
      marinaObstacleCache = [
        ...LINERS.filter((ship) => !ship.voyage).map(shipHull),
        ...marinaBoats().map((m) => ({ x: m.x, y: m.y, hx: m.beam / 2, hy: m.len / 2, a: 0 })),
        { x: centre.x, y: centre.y, hx: (s.fwd - s.aft + 20) / 2, hy: s.beam / 2 + 4, a: s.a },
        { x: tender.x, y: tender.y, hx: 26, hy: 10, a: s.a },
        ...MARINA.fingers.map((f) => ({ x: f.x + f.w / 2, y: f.y + f.h / 2, hx: f.w / 2 + 3, hy: f.h / 2, a: 0 })),
      ];
      return marinaObstacleCache;
    }
    // The hull of a liner under way, where she is now (boats test it every step).
    function movingLinerHulls() {
      return LINERS.filter((ship) => ship.voyage).map(shipHull);
    }
    function paintMarina(drawingContext) {
      const fill = (x, y, w, h, c) => {
        drawingContext.fillStyle = c;
        drawingContext.fillRect(x, y, w, h);
      };
      // The basin itself is left unpainted so the water shader shows through it;
      // only the quay coping, the pontoons and the hulls are drawn.
      const b = MARINA.basin;
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      fill(b.x - 16, b.y, 16, b.h + 16, '#a9a495');
      fill(b.x + b.w, b.y, 16, b.h + 16, '#a9a495');
      fill(b.x - 16, b.y + b.h, b.w + 32, 16, '#a9a495');
      fill(1700, -4190, 1380, 168, '#8f8e83');
      drawingContext.fillStyle = '#d8cfa8';
      for (let x = 1740; x < 3040; x += 64) drawingContext.fillRect(x, -4104, 34, 3);
      drawingContext.restore();
      for (const f of MARINA.fingers) {
        fill(f.x, f.y, f.w, f.h, '#b6ad99');
        drawingContext.fillStyle = '#8d846f';
        for (let y = f.y + 6; y < f.y + f.h; y += 15) drawingContext.fillRect(f.x, y, f.w, 2);
      }
      // Moored boats as pointed hulls, bows to the north.
      for (const boat of marinaBoats()) {
        drawingContext.fillStyle = boat.hull;
        drawingContext.beginPath();
        drawingContext.moveTo(boat.x - boat.beam / 2, boat.y + boat.len / 2);
        drawingContext.lineTo(boat.x - boat.beam / 2, boat.y - boat.len * 0.15);
        drawingContext.quadraticCurveTo(boat.x - boat.beam * 0.4, boat.y - boat.len * 0.42, boat.x, boat.y - boat.len / 2);
        drawingContext.quadraticCurveTo(boat.x + boat.beam * 0.4, boat.y - boat.len * 0.42, boat.x + boat.beam / 2, boat.y - boat.len * 0.15);
        drawingContext.lineTo(boat.x + boat.beam / 2, boat.y + boat.len / 2);
        drawingContext.fill();
        fill(boat.x - boat.beam / 4, boat.y - boat.len / 8, boat.beam / 2, boat.len / 3, boat.house);
      }
      // The superyacht's hull in plan, and her deckhouse.
      const s = SUPERYACHT;
      drawingContext.fillStyle = '#1d2a3a';
      drawingContext.beginPath();
      for (let u = s.aft; u <= s.fwd; u += 8) {
        const p = deckWorld(s, u, superyachtHalfBeam(u));
        drawingContext.lineTo(p.x, p.y);
      }
      for (let u = s.fwd; u >= s.aft; u -= 8) {
        const p = deckWorld(s, u, -superyachtHalfBeam(u));
        drawingContext.lineTo(p.x, p.y);
      }
      drawingContext.fill();
      drawingContext.fillStyle = '#eeeeea';
      drawingContext.beginPath();
      for (const [u, v] of deckOutline(-186, 118, 46, 70, 1.9)) {
        const p = deckWorld(s, u, v);
        drawingContext.lineTo(p.x, p.y);
      }
      drawingContext.fill();
      const gangwayEnd = deckWorld(s, SUPERYACHT_GANGWAY.u0, -6);
      fill(gangwayEnd.x, gangwayEnd.y, SUPERYACHT_GANGWAY.u1 - SUPERYACHT_GANGWAY.u0, 12, '#c9c2ae');
      fill(MARINA.terminal.x, MARINA.terminal.y, MARINA.terminal.w, MARINA.terminal.h, '#6f7a7c');
      fill(MARINA.club.x, MARINA.club.y, MARINA.club.w, MARINA.club.h, '#77756a');
      fill(MARINA.fuel.x, MARINA.fuel.y, MARINA.fuel.w, MARINA.fuel.h, '#6a6f68');
      drawingContext.save();
      drawingContext.textAlign = 'center';
      drawingContext.fillStyle = '#e3dcc2';
      drawingContext.font = 'bold 15px monospace';
      drawingContext.fillText('CRUISE TERMINAL', MARINA.terminalDoor.x, MARINA.terminalDoor.y - 4);
      drawingContext.fillStyle = '#dcd6bd';
      drawingContext.font = 'bold 11px monospace';
      drawingContext.fillText('HARBOR POINT YACHT CLUB', 1634, -3736);
      drawingContext.restore();
    }
    function marinaInteract() {
      if (player.deck) {
        if (!deckExitNear()) return false;
        leaveLiner();
        return true;
      }
      const ship = boardableLiner();
      if (!ship) return false;
      if (wantedStars > 0) {
        needToLosePolice();
        return true;
      }
      boardLiner(ship);
      return true;
    }
    function boardableLiner() {
      if (player.car || playerOnRoof() || player.parachute || transitRide || player.coaster) return null;
      if (taxiRide) return null;
      if (player.deck) return null;
      if (distanceBetween(player, SUPERYACHT.board) < 40) return SUPERYACHT;
      return (
        LINERS.find((ship) => {
          const gate = ship.berthed ? ship.board : shipPlatform(ship);
          // Nobody climbs onto the platform of a ship making way.
          if (ship.voyage && Math.abs(ship.speed || 0) > 6) return false;
          return distanceBetween(player, gate) < 46;
        }) || null
      );
    }
    function boardLiner(ship) {
      if (ship === SUPERYACHT) {
        // Straight onto the swim platform at the foot of the passerelle.
        const p = deckWorld(ship, -268, 0);
        player.deck = ship;
        player.deckLevel = 0;
        player.deckStair = null;
        player.x = p.x;
        player.y = p.y;
        player.altitude = ship.levels[0].z;
        tell('WELCOME ABOARD ' + ship.name.replace('M/Y ', ''), 2.4);
        return;
      }
      const aft = deckWorld(ship, -ship.l / 2 + 58, 0);
      player.deck = ship;
      player.deckHeading = ship.a;
      player.x = aft.x;
      player.y = aft.y;
      player.altitude = ship.deck;
      tell('ABOARD THE ' + ship.name.replace('MS ', ''), 2.4);
    }
    function leaveLiner() {
      const ship = player.deck;
      if (!ship) return;
      const gate = ship.berthed || ship === SUPERYACHT ? ship.board : shipPlatform(ship);
      player.deck = null;
      player.deckStair = null;
      player.x = gate.x;
      player.y = gate.y;
      player.altitude = terrainHeight(gate.x, gate.y);
    }
    function deckExitNear() {
      const ship = player.deck;
      if (!ship) return false;
      const { u } = deckLocal(ship, player.x, player.y);
      if (ship === SUPERYACHT)
        return !!player.deckStair?.gangway || (player.deckLevel === 0 && !player.deckStair && u < -265);
      return u < -ship.l / 2 + 96;
    }
    /* Tourists stroll the promenade decks and lean on the rail; on the lido deck
       atop the midships house they lie on the loungers or stand about with a
       drink. Everyone keeps a ship-frame position (du, dv, heading da) so a ship
       under way carries them (carryLinerDeck). */
    function populateLiners() {
      for (const ship of LINERS) {
        ship.passengers = [];
        const board = (u, v, extra) => {
          const p = deckWorld(ship, u, v),
            da = randomBetween(0, TAU),
            person = {
              ...p,
              du: u,
              dv: v,
              da,
              a: ship.a + da,
              color: randomChoice(DRIVER_COLORS),
              hp: 30,
              flee: 0,
              timer: randomBetween(0, 7),
              walk: 0,
              altitude: ship.deck,
              onDeck: ship,
              tourist: true,
              ...extra,
            };
          person.a = ship.a + person.da;
          pedestrians.push(person);
          ship.passengers.push(person);
        };
        const crowd = ship.berthed ? 34 : 30;
        for (let i = 0; i < crowd; i++) {
          for (let tries = 0; tries < 24; tries++) {
            const u = randomBetween(-ship.l / 2 + 60, ship.l / 2 - 60),
              v = randomBetween(-1, 1) * (hullHalfBeam(ship, u) - 26);
            if (!linerDeckFree(ship, u, v, 8)) continue;
            board(u, v, { carry: seededRandom() < 0.25 ? 'camera' : undefined });
            break;
          }
        }
        // The lido: loungers down both sides of the pool deck, people at the pools.
        const [lu, , , wide, high] = LINER_DECKHOUSES[1],
          lido = ship.deck + high + 4;
        for (const side of [-1, 1])
          for (let k = 0; k < 9; k++)
            if (seededRandom() < 0.6)
              board(lu - 148 + k * 16, side * (wide / 2 - 14), { altitude: lido, lido: true, sitting: true, pose: 'rest', da: Math.PI });
        for (const [du, dv] of [
          [-60, 30],
          [-52, -31],
          [-100, 12],
          [70, 24],
          [72, -24],
          [20, 20],
          [26, -18],
          [-20, 44],
          [-18, -46],
          [120, 38],
        ])
          board(lu + du, dv, { altitude: lido, lido: true, pose: 'chat', drinking: seededRandom() < 0.5 });
      }
      populateSuperyacht();
    }
    // A free spot on a liner's promenade deck, in her own frame.
    function linerDeckFree(ship, u, v, r = 7) {
      if (Math.abs(u) > ship.l / 2 - 26 - r) return false;
      if (Math.abs(v) > hullHalfBeam(ship, u) - 12 - r) return false;
      return !LINER_DECKHOUSES.some((h) => Math.abs(u - h[0]) < h[2] / 2 + r && Math.abs(v - h[1]) < h[3] / 2 + r);
    }
    /* Aboard the AURELIA: guests stretched out on loungers or standing about with
       a drink, and crew in whites walking their rounds. Nobody here leaves their
       deck; the stairs are for the player. */
    const YACHT_GUEST_COLORS = ['#f1ede4', '#20324a', '#c9a27a', '#7d9fb8', '#b44b5a', '#e8d9b5', '#3e6b5d', '#d98b6a'];
    function populateSuperyacht() {
      const ship = SUPERYACHT,
        plan = superyachtPlan(),
        guest = (level, u, v, extra) => {
          const p = deckWorld(ship, u, v);
          pedestrians.push({
            ...p,
            a: ship.a,
            color: randomChoice(YACHT_GUEST_COLORS),
            hp: 30,
            flee: 0,
            timer: randomBetween(1, 8),
            walk: 0,
            altitude: ship.levels[level].z,
            onDeck: ship,
            deckLevel: level,
            yachtGuest: true,
            guest: true,
            ...extra,
          });
        };
      // Loungers and sun pads: a guest on most of them, lying along the cushion.
      for (const level of plan.levels)
        for (const f of level.furniture) {
          if ((f.type === 'lounger' || f.type === 'sunpad') && seededRandom() < 0.55)
            guest(level.index, f.u + 2, f.v, { sitting: true, a: ship.a + Math.PI, pose: 'rest', drinking: seededRandom() < 0.3 });
          if (f.type === 'sofa' && seededRandom() < 0.6) {
            const across = f.w > f.l;
            guest(level.index, f.u + (across ? 0 : 3), f.v + (across ? 4 : 0), {
              sitting: true,
              a: ship.a + (across ? 0 : f.v > 0 ? -Math.PI / 2 : Math.PI / 2),
              pose: 'rest',
              drinking: true,
            });
          }
        }
      // Standing guests with drinks at the rails and on the aft decks.
      const standing = [
        [1, -230, 12],
        [1, -228, -10],
        [2, -150, 30],
        [3, -104, 8],
        [4, -86, -6],
        [4, 4, 22],
        [4, 4, -20],
        [5, 172, 10],
      ];
      for (const [level, u, v] of standing)
        guest(level, u, v, { pose: 'chat', drinking: true, a: ship.a + randomBetween(0, TAU) });
      // Crew walking the side decks, the foredeck and the saloon.
      const crew = [
        [1, -60, 40],
        [1, 124, 24],
        [1, -100, 0],
        [0, -270, 8],
        [3, -110, -36],
      ];
      for (const [level, u, v] of crew)
        guest(level, u, v, { pose: 'walk', color: '#f4f4f0', crew: true, guest: false, drinking: false });
    }
    /* Quay life: people walking the pontoons, crews working on the boats and a
       queue of passengers waiting to board at the terminal. */
    function populateMarina() {
      const spots = [];
      for (const f of MARINA.fingers)
        for (let d = 40; d < f.h - 30; d += 74)
          spots.push({ x: f.x + f.w / 2, y: f.y + d, a: seededRandom() > 0.5 ? -Math.PI / 2 : Math.PI / 2 });
      for (let x = 1760; x < 3020; x += 58)
        spots.push({ x, y: -4116 + randomBetween(-16, 16), a: seededRandom() > 0.5 ? 0 : Math.PI });
      for (const spot of spots) {
        if (seededRandom() > 0.62) continue;
        if (solid(spot.x, spot.y, 6)) continue;
        pedestrians.push({
          x: spot.x,
          y: spot.y,
          a: spot.a,
          color: randomChoice(DRIVER_COLORS),
          hp: 30,
          flee: 0,
          timer: randomBetween(0, 8),
          walk: 0,
        });
      }
      // Two deckhands in whites keep the foot of the passerelle.
      for (const dv of [-16, 16]) {
        const p = deckWorld(SUPERYACHT, SUPERYACHT_GANGWAY.u0 - 10, dv);
        pedestrians.push({ ...p, a: Math.PI, color: '#f4f4f0', hp: 30, flee: 0, timer: 99, walk: 0, sentry: true });
      }
    }
    if (typeof PED_LINES !== 'undefined')
      PED_LINES.yacht = [
        'Another glass? It is only noon.',
        'The owner flies in by helicopter tonight.',
        'Mind the teak, please, no shoes.',
        'Captain says we sail for Monaco on Friday.',
        'Is that the cruise ship? How quaint.',
        'Best view in the harbor, darling.',
        'Crew only beyond this point, sir.',
        'The pool is heated, you know.',
      ];
    function updateDeckWalker(p, deltaSeconds) {
      const ship = p.onDeck;
      if (ship === SUPERYACHT) return updateYachtGuest(p, deltaSeconds);
      p.timer -= deltaSeconds;
      // Lido guests stay put: lying on a lounger or chatting by the pool.
      if (p.lido) {
        p.walking = false;
        if (p.timer <= 0) {
          p.timer = randomBetween(4, 10);
          if (!p.sitting) p.da += randomBetween(-1, 1);
        }
        return true;
      }
      p.altitude = ship.deck;
      if (p.timer <= 0) {
        p.timer = randomBetween(3, 9);
        p.da = randomBetween(0, TAU);
        pedSay(p, 'deck', 0.16);
      }
      // Walk in the ship's frame, so a moving deck carries the stroll with it.
      const speed = 4.5 * KMH,
        nu = p.du + Math.cos(p.da) * speed * deltaSeconds,
        nv = p.dv + Math.sin(p.da) * speed * deltaSeconds;
      if (linerDeckFree(ship, nu, nv, 7)) {
        p.du = nu;
        p.dv = nv;
        p.walk += deltaSeconds * 6;
        p.walking = true;
      } else {
        p.da += Math.PI * randomBetween(0.4, 1.6);
        p.timer = Math.min(p.timer, 1.2);
      }
      const w = deckWorld(ship, p.du, p.dv);
      p.x = w.x;
      p.y = w.y;
      p.a = ship.a + p.da;
      return true;
    }
    // The renderer lifts decks away over the player's head; the people on them go too.
    let yachtCoverFrame = { time: -1, height: Infinity };
    function yachtCoverNow() {
      if (yachtCoverFrame.time !== gameTime) yachtCoverFrame = { time: gameTime, height: superyachtCoverHeight() };
      return yachtCoverFrame.height;
    }
    function updateYachtGuest(p, deltaSeconds) {
      p.altitude = SUPERYACHT.levels[p.deckLevel].z;
      p.hidden = p.altitude >= yachtCoverNow() && p.deckLevel !== 5;
      p.timer -= deltaSeconds;
      const party = p.deckLevel === 4 && daylight() < 0.25;
      p.dancing = party && p.pose === 'chat';
      if (p.timer <= 0) {
        p.timer = randomBetween(4, 10);
        if (p.pose === 'chat') p.a += randomBetween(-1.2, 1.2);
        if (p.pose === 'walk') p.a = randomBetween(0, TAU);
        if (distanceBetween(p, player) < 120) pedSay(p, 'yacht', 0.3);
      }
      if (p.pose !== 'walk' && !(p.flee > 0)) {
        p.walking = false;
        return true;
      }
      p.walking = true;
      const speed = (p.flee > 0 ? 15 : 4.5) * KMH,
        nx = p.x + Math.cos(p.a) * speed * deltaSeconds,
        ny = p.y + Math.sin(p.a) * speed * deltaSeconds,
        { u, v } = deckLocal(SUPERYACHT, nx, ny);
      if (yachtPointFree(p.deckLevel, u, v, 6)) {
        p.x = nx;
        p.y = ny;
        p.walk += deltaSeconds * 6;
      } else {
        p.a += Math.PI * randomBetween(0.5, 1.5);
        p.timer = Math.min(p.timer, 1.5);
      }
      return true;
    }
