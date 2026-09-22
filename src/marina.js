    // BEGIN SUBSYSTEM: src/marina.js — Harbor Point marina and the cruise liners
    /**
     * Harbor Point marina and the cruise liners
     * Source: src/marina.js
     * Scope: shared game closure.
     * Yacht basin, cruise terminal, walkable liner decks and the crowds on them.
     */
    /**
     * HARBOR POINT
     * The reclamation's north-west shore is cut open into a yacht basin: four
     * finger pontoons off the south quay, boats moored either side, and a club
     * house on the east quay. East of it the cruise terminal takes the whole north
     * apron, with a liner alongside.
     *
     * A liner is a walkable surface rather than scenery. `LINERS` are oriented
     * boxes; `deckLocal()` puts a world point into a ship's frame, and while
     * `player.deck` is set the player moves inside that frame instead of on the
     * street grid. Elevation comes from the ship's deck height, so bullets,
     * sight-lines and the renderer all place people on board correctly.
     * Ship dimensions are world units, where 512 units is 100 metres.
     */
    const MARINA = {
      basin: { x: 672, y: -4128, w: 856, h: 828 },
      quay: { x: 640, y: -3300, w: 928, h: 46 },
      club: { x: 1560, y: -3742, w: 148, h: 128 },
      fuel: { x: 1556, y: -3486, w: 96, h: 54 },
      terminal: { x: 1900, y: -4160, w: 724, h: 128 },
      terminalDoor: { x: 2262, y: -4024 },
      fingers: [760, 960, 1160, 1360].map((x) => ({ x, y: -3760, w: 17, h: 442 })),
    };
    // Moored boats: [finger index, side, distance along the finger, length, beam, hull, house].
    const MARINA_BERTHS = [
      [0, -1, 60, 118, 34, '#e7e9e4', '#2f4a55'],
      [0, 1, 96, 86, 27, '#dfe3dd', '#4a5a52'],
      [0, -1, 250, 72, 24, '#e9e2d4', '#5a4e43'],
      [0, 1, 300, 132, 36, '#f0f2ee', '#26424e'],
      [1, -1, 74, 154, 40, '#eef0ec', '#1f3a48'],
      [1, 1, 130, 92, 28, '#e4e7e1', '#3d5a4e'],
      [1, -1, 286, 104, 30, '#ded9cb', '#60513f'],
      [1, 1, 330, 68, 22, '#e8ebe6', '#46545c'],
      [2, -1, 66, 96, 29, '#e2e5e0', '#334f5c'],
      [2, 1, 118, 176, 44, '#f2f3f0', '#1b3542'],
      [2, -1, 268, 82, 26, '#e6e0d2', '#574a3c'],
      [2, 1, 322, 110, 32, '#e9ece7', '#2b4650'],
      [3, -1, 82, 138, 37, '#f0f1ed', '#22404d'],
      [3, 1, 150, 74, 24, '#e3e6e0', '#42574f'],
      [3, -1, 292, 120, 34, '#eceee9', '#2e4956'],
      [3, 1, 336, 90, 28, '#e0dace', '#5c4f40'],
    ];
    /**
     * Two ships of the same class. The Coral Dawn lies alongside the terminal and
     * is boarded down the gangway; the Meridian Star rides at anchor out in the
     * bay and has to be reached by boat or jetski.
     */
    const LINERS = [
      {
        id: 'coraldawn',
        name: 'MS CORAL DAWN',
        x: 2380,
        y: -4292,
        a: 0,
        l: 1360,
        w: 186,
        deck: 44,
        berthed: true,
        // The gangway meets the quay here; boarding from the apron needs no boat.
        board: { x: 2380, y: -4188 },
      },
      {
        id: 'meridian',
        name: 'MS MERIDIAN STAR',
        x: 2460,
        y: -5136,
        a: 0.21,
        l: 1360,
        w: 186,
        deck: 44,
        berthed: false,
        // Boarding platform off the stern, at the waterline.
        board: null,
      },
    ];
    const LINER_DECKHOUSES = [
      // [along, across, length, width, height] in ship-local units.
      [-430, 0, 300, 150, 86],
      [-140, 0, 360, 158, 104],
      [220, 0, 250, 146, 78],
      [430, 0, 150, 120, 52],
    ];
    function deckLocal(ship, x, y) {
      const c = Math.cos(-ship.a),
        s = Math.sin(-ship.a),
        dx = x - ship.x,
        dy = y - ship.y;
      return { u: dx * c - dy * s, v: dx * s + dy * c };
    }
    function deckWorld(ship, u, v) {
      const c = Math.cos(ship.a),
        s = Math.sin(ship.a);
      return { x: ship.x + u * c - v * s, y: ship.y + u * s + v * c };
    }
    // The hull tapers at both ends, so the usable half-beam falls away fore and aft.
    function hullHalfBeam(ship, u) {
      const t = Math.min(1, Math.abs(u) / (ship.l / 2));
      return (ship.w / 2) * Math.sqrt(Math.max(0, 1 - Math.pow(t, 6)));
    }
    function shipHull(ship) {
      return { x: ship.x, y: ship.y, hx: ship.l / 2, hy: ship.w / 2, a: ship.a };
    }
    function shipAt(x, y, r = 0) {
      return LINERS.find((ship) => {
        const { u, v } = deckLocal(ship, x, y);
        return Math.abs(u) < ship.l / 2 + r && Math.abs(v) < hullHalfBeam(ship, u) + r;
      });
    }
    // Sterns carry a boarding platform at the waterline; that is the way aboard.
    function shipPlatform(ship) {
      return deckWorld(ship, -ship.l / 2 - 22, 0);
    }
    function deckPointFree(ship, x, y, r = 7) {
      const { u, v } = deckLocal(ship, x, y);
      if (Math.abs(u) > ship.l / 2 - 26 - r) return false;
      if (Math.abs(v) > hullHalfBeam(ship, u) - 12 - r) return false;
      return !LINER_DECKHOUSES.some(
        (h) => Math.abs(u - h[0]) < h[2] / 2 + r && Math.abs(v - h[1]) < h[3] / 2 + r,
      );
    }
    function moveOnDeck(dx, dy, r) {
      const ship = player.deck;
      let blocked = false;
      if (deckPointFree(ship, player.x + dx, player.y, r)) player.x += dx;
      else blocked = true;
      if (deckPointFree(ship, player.x, player.y + dy, r)) player.y += dy;
      else blocked = true;
      return blocked;
    }
    function marinaSolids() {
      return [
        { ...MARINA.club, height: 44 },
        { ...MARINA.fuel, height: 20 },
        { ...MARINA.terminal, height: 96 },
      ];
    }
    /* Pontoons are walkable, the basin around them is not, and hulls are solid. */
    function marinaBlocked(x, y, r = 0) {
      const b = MARINA.basin;
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) {
        const onFinger = MARINA.fingers.some(
          (f) => x + r > f.x - 3 && x - r < f.x + f.w + 3 && y + r > f.y && y - r < f.y + f.h,
        );
        if (!onFinger) return true;
        if (berthedHullAt(x, y, r)) return true;
      }
      return marinaSolids().some(
        (s) => x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h,
      );
    }
    let berthCache = null;
    function marinaBoats() {
      if (berthCache) return berthCache;
      berthCache = MARINA_BERTHS.map(([fi, side, along, len, beam, hull, house], i) => {
        const f = MARINA.fingers[fi];
        return {
          id: 'yacht' + i,
          x: f.x + f.w / 2 + side * (beam / 2 + 13),
          y: f.y + f.h - along,
          len,
          beam,
          hull,
          house,
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
      for (const boat of marinaBoats()) {
        fill(boat.x - boat.beam / 2, boat.y - boat.len / 2, boat.beam, boat.len, boat.hull);
        fill(boat.x - boat.beam / 4, boat.y - boat.len / 6, boat.beam / 2, boat.len / 3, boat.house);
      }
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
      if (player.car || player.roof || player.parachute || transitRide || player.coaster) return null;
      if (player.deck) return null;
      return (
        LINERS.find((ship) => {
          const gate = ship.berthed ? ship.board : shipPlatform(ship);
          return distanceBetween(player, gate) < 46;
        }) || null
      );
    }
    function boardLiner(ship) {
      const aft = deckWorld(ship, -ship.l / 2 + 58, 0);
      player.deck = ship;
      player.x = aft.x;
      player.y = aft.y;
      player.altitude = ship.deck;
      tell('ABOARD THE ' + ship.name.replace('MS ', ''), 2.4);
    }
    function leaveLiner() {
      const ship = player.deck;
      if (!ship) return;
      const gate = ship.berthed ? ship.board : shipPlatform(ship);
      player.deck = null;
      player.x = gate.x;
      player.y = gate.y;
      player.altitude = terrainHeight(gate.x, gate.y);
    }
    function deckExitNear() {
      const ship = player.deck;
      if (!ship) return false;
      const { u } = deckLocal(ship, player.x, player.y);
      return u < -ship.l / 2 + 96;
    }
    /* Tourists stroll the promenade decks; the ship never moves, so they simply
       patrol between waypoints and lean on the rail. */
    function populateLiners() {
      for (const ship of LINERS) {
        const crowd = ship.berthed ? 34 : 30;
        for (let i = 0; i < crowd; i++) {
          let placed = null;
          for (let tries = 0; tries < 24 && !placed; tries++) {
            const u = randomBetween(-ship.l / 2 + 60, ship.l / 2 - 60),
              v = randomBetween(-1, 1) * (hullHalfBeam(ship, u) - 26),
              p = deckWorld(ship, u, v);
            if (deckPointFree(ship, p.x, p.y, 8)) placed = p;
          }
          if (!placed) continue;
          pedestrians.push({
            ...placed,
            a: randomBetween(0, TAU),
            color: randomChoice(DRIVER_COLORS),
            hp: 30,
            flee: 0,
            timer: randomBetween(0, 7),
            walk: 0,
            altitude: ship.deck,
            onDeck: ship,
            tourist: true,
          });
        }
      }
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
    }
    function updateDeckWalker(p, deltaSeconds) {
      const ship = p.onDeck;
      p.altitude = ship.deck;
      p.timer -= deltaSeconds;
      if (p.timer <= 0) {
        p.timer = randomBetween(3, 9);
        p.a = randomBetween(0, TAU);
        pedSay(p, 'deck', 0.16);
      }
      const speed = 26,
        nx = p.x + Math.cos(p.a) * speed * deltaSeconds,
        ny = p.y + Math.sin(p.a) * speed * deltaSeconds;
      if (deckPointFree(ship, nx, ny, 7)) {
        p.x = nx;
        p.y = ny;
        p.walk += deltaSeconds * 6;
      } else {
        p.a += Math.PI * randomBetween(0.4, 1.6);
        p.timer = Math.min(p.timer, 1.2);
      }
      return true;
    }
    // END SUBSYSTEM: src/marina.js
