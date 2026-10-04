    // Landing on a ship from the sky: canopy touchdowns and freefall impacts on the liners' and the superyacht's decks (deckSurfaceAt, deckLandingStep), and splashdowns beside boats.
    /**
     * DECK LANDINGS
     * A walkable ship (both liners, LINERS, and the superyacht AURELIA) is a landing
     * surface for a parachutist, as a roof is. deckSurfaceAt(x, y) is what lies
     * under a point: the topmost deck there and its height (a liner's promenade
     * deck or the open roof of one of her deckhouses, the yacht's highest level),
     * and deckSpotFree() whether a person can stand on it (railings, pools,
     * funnels, the bridge, furniture and stair wells are not). parachute.js asks
     * deckLandingStep() every step of a jump, before the ground:
     *   - an open canopy coming down onto a free spot touches down there: the
     *     player stands on that deck (player.deck, deckLevel, altitude) and the
     *     ship carries them from then on (carryLinerDeck). The landing is one
     *     impact through playerImpact(): the descent rate, plus the speed across
     *     the deck beyond what a canopy's run-out takes on the feet (DECK_RUNOUT,
     *     riderInjury 'tumble'), both relative to the deck, which may be moving;
     *   - over something nobody can stand on, the canopy settles on the nearest
     *     free spot of that deck within a few metres, or glides on down to the
     *     nearest free spot of a lower one (off a liner's deckhouse roof onto her
     *     promenade), or, failing both, off her side and into the sea;
     *   - freefall, or a canopy still opening, meets a deck as hard as the ground
     *     (playerImpact); a survivor is put on the nearest spot to stand;
     *   - a jumper below a deck inside her plan (she sailed into a low canopy) is
     *     pushed out of the superstructure or off her side.
     * A boat (vehicle) has no deck to walk: a canopy that comes down on one puts
     * the jumper in the water beside her, swimming, whatever the distance to the
     * shore (E climbs aboard as from any swim), and a jumper coming down on a
     * moored hull, a pontoon, a footing or the freighter is set down clear of it.
     */
    // A canopy's own forward speed (trimmed), which a landing runs out on the feet; faster across the deck is a tumble.
    const DECK_RUNOUT = 31 * KMH;
    /* What stands on a liner's deckhouse roofs, as marina3d-shore.js builds them:
       [house, u0, u1, v0, v1] in the ship's frame. */
    const LINER_ROOF_BLOCKS = [
      [0, -516, -424, -31, 31], // the fenced sports court
      [0, -390, -310, -30, 30], // the glass solarium
      [1, -240, -165, -25, 25], // the aft pool and funnel
      [1, -128, -112, -15, 15], // the bar kiosk
      [1, -92, -30, -20, 20], // the forward pool and funnel
      [1, -257, -228, 19, 33], // the hot tubs
      [1, -294, -286, -34, -26], // the water slide's tower
      [2, 124, 196, -23, 23], // the basketball court
      [2, 275, 327, -100, 100], // the bridge and its wings
    ];
    const LINER_LEVEL_NAMES = ['PROMENADE DECK', 'SPORTS DECK', 'LIDO DECK', 'UPPER DECK', 'FORWARD SUN DECK'];
    /* A liner's walkable levels: 0 her promenade deck (ship.deck high), then the open
       roof of each deckhouse (LINER_DECKHOUSES): `outline` its plan, `walk` the part
       inside its railing, `blocks` what stands on it. */
    function linerLevels(ship) {
      if (ship.deckLevels) return ship.deckLevels;
      const levels = [{ z: ship.deck, name: LINER_LEVEL_NAMES[0] }];
      LINER_DECKHOUSES.forEach(([u, , len, wide, high], index) => {
        const nose = index === LINER_DECKHOUSES.length - 1 || index === 2 ? Math.min(60, len * 0.4) : 0;
        levels.push({
          z: ship.deck + high + 3.8,
          name: LINER_LEVEL_NAMES[index + 1],
          outline: deckOutline(u - len / 2, u + len / 2, wide / 2, nose, 2.2, 12, 6),
          walk: deckOutline(u - len / 2 + 6, u + len / 2 - 6, wide / 2 - 6, Math.max(0, nose - 6), 2.2, 12, 6),
          blocks: LINER_ROOF_BLOCKS.filter((b) => b[0] === index),
        });
      });
      return (ship.deckLevels = levels);
    }
    // Can a person (radius r) stand at (u, v) on level `level` of a liner?
    function linerPointFree(ship, level, u, v, r = 7) {
      if (!level) return linerDeckFree(ship, u, v, r);
      const L = linerLevels(ship)[level];
      if (!L) return false;
      for (const [du, dv] of [
        [0, 0],
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
      ])
        if (!pointInPolygon(u + du, v + dv, L.walk)) return false;
      return !L.blocks.some(([, u0, u1, v0, v1]) => u > u0 - r && u < u1 + r && v > v0 - r && v < v1 + r);
    }
    function deckLevelHeight(ship, level) {
      return ship === SUPERYACHT ? ship.levels[level].z : linerLevels(ship)[level].z;
    }
    function deckLevelName(ship, level) {
      return ship === SUPERYACHT ? ship.levels[level].name : linerLevels(ship)[level].name;
    }
    /* The topmost deck under (x, y): { ship, level, z, u, v }, or null over no
       walkable ship. Inside a liner's hull plan it is the roof of the deckhouse
       there, else her promenade deck; on the yacht, the highest level whose
       outline holds the point. */
    function deckSurfaceAt(x, y) {
      for (const ship of LINERS) {
        if (Math.abs(x - ship.x) > ship.l / 2 + 10 || Math.abs(y - ship.y) > ship.l / 2 + 10) continue;
        const { u, v } = deckLocal(ship, x, y);
        if (Math.abs(u) > ship.l / 2 || Math.abs(v) > hullHalfBeam(ship, u)) continue;
        const levels = linerLevels(ship);
        for (let i = levels.length - 1; i >= 1; i--) if (pointInPolygon(u, v, levels[i].outline)) return { ship, level: i, z: levels[i].z, u, v };
        return { ship, level: 0, z: ship.deck, u, v };
      }
      const s = SUPERYACHT;
      if (Math.abs(x - s.x) < 330 && Math.abs(y - s.y) < 330) {
        const { u, v } = deckLocal(s, x, y);
        let best = null;
        for (const level of superyachtPlan().levels) if ((!best || level.z > best.z) && superyachtLevelContains(level, u, v)) best = level;
        if (best) return { ship: s, level: best.index, z: best.z, u, v };
      }
      return null;
    }
    // Can a person stand at (u, v) on this ship's level?
    function deckSpotFree(ship, level, u, v) {
      return ship === SUPERYACHT ? yachtPointFree(level, u, v) : linerPointFree(ship, level, u, v);
    }
    // The nearest spot within `reach` of (u, v) on one level a person can stand on, in the ship's frame.
    function deckSpotNear(ship, level, u, v, reach) {
      if (deckSpotFree(ship, level, u, v)) return { u, v, level };
      for (let r = 6; r <= reach; r += 6)
        for (let i = 0; i < 24; i++) {
          const a = (i * TAU) / 24,
            q = { u: u + Math.cos(a) * r, v: v + Math.sin(a) * r, level };
          if (deckSpotFree(ship, level, q.u, q.v)) return q;
        }
      return null;
    }
    // The nearest free spot on a deck lower than `z` (highest first): where a canopy over a roof glides down to.
    function deckSpotBelow(ship, z, u, v, reach) {
      const levels = (ship === SUPERYACHT ? superyachtPlan().levels : linerLevels(ship).map((L, index) => ({ ...L, index })))
        .filter((L) => L.z < z - 1)
        .sort((a, b) => b.z - a.z);
      for (const L of levels) {
        const spot = deckSpotNear(ship, L.index, u, v, reach);
        if (spot) return spot;
      }
      return null;
    }
    // The ship's velocity over the ground (map units a second): only the liner under way moves.
    function shipVelocity(ship) {
      const speed = ship.voyage ? ship.speed || 0 : 0;
      return { x: Math.cos(ship.a) * speed, y: Math.sin(ship.a) * speed };
    }
    // Stand the player on a ship's level at (u, v): from here the ship carries them (marina-voyage.js carryLinerDeck).
    function standOnDeck(ship, level, u, v) {
      const w = deckWorld(ship, u, v);
      player.x = w.x;
      player.y = w.y;
      player.deck = ship;
      player.deckLevel = level;
      player.deckStair = null;
      player.deckHeading = ship.a;
      player.altitude = deckLevelHeight(ship, level);
      player.swimming = false;
      player.roof = false;
      player.buildingRoof = null;
    }
    // Off her side: out over the water abeam, a body's width clear of the hull.
    function pushOffShip(ship, u, v) {
      const half = ship === SUPERYACHT ? superyachtHalfBeam(u) : hullHalfBeam(ship, u),
        w = deckWorld(ship, u, (v >= 0 ? 1 : -1) * (half + 14));
      player.x = w.x;
      player.y = w.y;
    }
    // The last deck landing, for the console's deckLanding() and the tests.
    let lastDeckLanding = null;
    /* Touching down on a deck at (spot.u, spot.v): one impact (the descent, and the
       speed across the deck past a run-out), then standing there, carried. */
    function touchDownOnDeck(p, surface, spot) {
      const ship = surface.ship,
        sv = shipVelocity(ship),
        across = Math.hypot(p.vx - sv.x, p.vy - sv.y),
        into = Math.max(0, -p.vz),
        extra = riderInjury(Math.max(0, across - DECK_RUNOUT), 'tumble'),
        stage = p.stage;
      standOnDeck(ship, spot.level, spot.u, spot.v);
      player.parachute = null;
      clearTouchInput();
      keys = {};
      const outcome = playerImpact(into, player.altitude, stage, false, true, extra);
      lastDeckLanding = {
        ship: ship.name,
        deck: deckLevelName(ship, spot.level),
        level: spot.level,
        stage,
        descentMs: +worldMeters(into).toFixed(1),
        acrossMs: +worldMeters(across).toFixed(1),
        shipKnots: Math.round((Math.hypot(sv.x, sv.y) / KNOTS) * 10) / 10,
        outcome,
        at: +gameTime.toFixed(1),
      };
      if (outcome === 'dead') return;
      player.inv = 1;
      if (outcome === 'safe') announce(ship.name.replace(/^(MS|M\/Y) /, ''), 'DECK LANDING', 2.6);
      tell('ABOARD THE ' + ship.name.replace(/^(MS|M\/Y) /, '') + ' · ' + deckLevelName(ship, spot.level) + deckWayOffHint(), 4.5);
    }
    // How to get off from where the player stands aboard (the tell after a landing).
    function deckWayOffHint() {
      if (deckExitNear()) return ' · ' + pressKey('interact') + ' to go ashore';
      if (linerStairsAvailable()) return ' · ' + pressKey('interact') + ' for the stairs to the aft deck';
      return '';
    }
    /**
     * One step of a jump over the ships (updateParachute, after the move): returns
     * true when the jump ended on a deck (landed, or died there), false to fly on.
     * `wasAltitude` is the height before this step, `flying` whether the canopy is
     * open and flying.
     */
    function deckLandingStep(p, wasAltitude, flying) {
      const surface = deckSurfaceAt(player.x, player.y);
      if (!surface || player.altitude > surface.z) return false;
      const ship = surface.ship;
      // Already below this surface last step: inside a deckhouse (glide out onto the
      // deck below) or under the deck beside her hull (off her side).
      if (wasAltitude < surface.z - 14) {
        const below = deckSpotBelow(ship, Math.min(surface.z, wasAltitude + 1), surface.u, surface.v, 400);
        if (below && deckLevelHeight(ship, below.level) <= player.altitude) {
          const w = deckWorld(ship, below.u, below.v);
          player.x = w.x;
          player.y = w.y;
        } else pushOffShip(ship, surface.u, surface.v);
        return false;
      }
      const spot = deckSpotNear(ship, surface.level, surface.u, surface.v, flying ? 30 : 80);
      if (flying) {
        if (spot) {
          touchDownOnDeck(p, surface, spot);
          return true;
        }
        // Nowhere to put a foot up here: glide on down to a lower deck, or off her side.
        const below = deckSpotBelow(ship, surface.z, surface.u, surface.v, 400);
        if (below) {
          const w = deckWorld(ship, below.u, below.v);
          player.x = w.x;
          player.y = w.y;
          player.altitude = surface.z + 1;
        } else pushOffShip(ship, surface.u, surface.v);
        p.vx *= 0.6;
        p.vy *= 0.6;
        return false;
      }
      // Freefall, or a canopy still opening: the deck is the ground as far as the body is concerned.
      touchDownOnDeck(p, surface, spot || deckSpotBelow(ship, surface.z + 2, surface.u, surface.v, 400) || { u: surface.u, v: surface.v, level: surface.level });
      return true;
    }
    /* A canopy down on the water: on a boat (vehicle) the jumper comes down in the
       water beside her and swims (true: the landing is done); on a moored hull, a
       pontoon, a footing or the freighter, they are set down clear of it and the
       ordinary water landing goes on (false). */
    function splashBesideHull(into, stage) {
      const boat = vehicles.find((c) => isBoat(c) && c.hp > 0 && pointInCar(player.x, player.y, c, 10));
      if (boat) {
        const spec = vehicleSpec(boat),
          side = Math.sin(boat.a) * (player.x - boat.x) - Math.cos(boat.a) * (player.y - boat.y) >= 0 ? 1 : -1,
          out = spec.w / 2 + 14;
        player.x = boat.x + Math.sin(boat.a) * out * side;
        player.y = boat.y - Math.cos(boat.a) * out * side;
        player.parachute = null;
        clearTouchInput();
        keys = {};
        player.inv = 1;
        player.altitude = SWIM_ALTITUDE;
        player.swimming = true;
        player.swimStroke = 0;
        player.swimDrive = 0;
        splashAt(player.x, player.y, 1.8);
        lastDeckLanding = { boat: boat.type, stage, descentMs: +worldMeters(into).toFixed(1), outcome: 'water', at: +gameTime.toFixed(1) };
        if (playerImpact(into, 0, stage, true) === 'dead') return true;
        tell('SPLASHDOWN beside the ' + (spec.name || boat.type).toUpperCase() + ' · ' + pressKey('interact') + ' to climb aboard', 4);
        return true;
      }
      for (const hull of [...boatObstacles(), ...drawbridgeVesselHulls()]) {
        if (Math.abs(player.x - hull.x) > hull.hx + hull.hy + 20 || Math.abs(player.y - hull.y) > hull.hx + hull.hy + 20) continue;
        const c = Math.cos(-hull.a),
          s = Math.sin(-hull.a),
          dx = player.x - hull.x,
          dy = player.y - hull.y,
          u = dx * c - dy * s,
          v = dx * s + dy * c;
        if (Math.abs(u) > hull.hx + 8 || Math.abs(v) > hull.hy + 8) continue;
        // Out across the nearer side.
        const toU = hull.hx + 12 - Math.abs(u),
          toV = hull.hy + 12 - Math.abs(v),
          nu = toU < toV ? (u >= 0 ? 1 : -1) * (hull.hx + 12) : u,
          nv = toU < toV ? v : (v >= 0 ? 1 : -1) * (hull.hy + 12),
          ca = Math.cos(hull.a),
          sa = Math.sin(hull.a);
        player.x = hull.x + nu * ca - nv * sa;
        player.y = hull.y + nu * sa + nv * ca;
        break;
      }
      return false;
    }
    /* Aboard a liner, anywhere but her aft deck (a roof, the foredeck, the gap
       amidships): the ship's own stairs lead aft, through the superstructure, to
       the aft deck by the stern platform. */
    function linerStairsAvailable() {
      const ship = player.deck;
      return !!ship && ship !== SUPERYACHT && LINERS.includes(ship) && !deckExitNear();
    }
    function linerStairsAft() {
      if (!linerStairsAvailable()) return false;
      const ship = player.deck,
        spot = deckSpotNear(ship, 0, -ship.l / 2 + 58, 0, 40) || { u: -ship.l / 2 + 58, v: 0, level: 0 };
      standOnDeck(ship, 0, spot.u, spot.v);
      tell(ship.name.replace(/^MS /, '') + ' · AFT DECK · ' + pressKey('interact') + ' to go ashore by the stern platform', 3.5);
      return true;
    }
    /* Console (registered as 'decks' by game-console-rides.js): what is under a
       point, the last deck landing, and a jump onto a ship for the tests. */
    function deckLandingReport(x = player.x, y = player.y) {
      const s = deckSurfaceAt(x, y);
      return {
        under: s
          ? { ship: s.ship.name, level: s.level, deck: deckLevelName(s.ship, s.level), heightM: +worldMeters(s.z).toFixed(1), u: Math.round(s.u), v: Math.round(s.v), free: deckSpotFree(s.ship, s.level, s.u, s.v) }
          : null,
        aboard: player.deck ? { ship: player.deck.name, level: player.deckLevel ?? 0, ...deckLocalRounded(player.deck) } : null,
        swimming: !!player.swimming,
        parachute: player.parachute ? player.parachute.stage : null,
        last: lastDeckLanding,
      };
    }
    function deckLocalRounded(ship) {
      const { u, v } = deckLocal(ship, player.x, player.y);
      return { u: Math.round(u), v: Math.round(v), heightM: +worldMeters(player.altitude).toFixed(1) };
    }
    function deckShipById(id) {
      const key = String(id).toLowerCase();
      return key === 'aurelia' || key === 'yacht' ? SUPERYACHT : LINERS.find((s) => s.id === key) || sailingLiner();
    }
    /* Put the player `metres` above the deck at (u, v) of ship `id` ('meridian',
       'coraldawn', 'aurelia'), falling: under a canopy already flying (open, the
       toggles unstowed, trimmed along `heading`, default hers) or, with
       open = false, in freefall at `fall` m/s. */
    function deckJump(id = 'meridian', metres = 30, u = 0, v = 0, open = true, heading = null, fall = 50) {
      const ship = deckShipById(id),
        w = deckWorld(ship, u, v),
        sv = shipVelocity(ship);
      jumpAt(w.x, w.y, metres, open, heading ?? ship.a, fall, sv);
      return deckLandingReport();
    }
    // A jumper `metres` above whatever is under (x, y): a canopy flying along `heading`, or freefall at `fall` m/s moving with `drift`.
    function jumpAt(x, y, metres, open, heading, fall = 50, drift = { x: 0, y: 0 }) {
      const a = heading ?? player.a,
        speed = 31 * KMH;
      stagePlayer(x, y);
      player.altitude = parachuteFloor(x, y) + metres * UNITS_PER_METRE;
      player.a = a;
      player.parachute = open
        ? { stage: 'canopy', elapsed: 20, opening: 1, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, vz: -3.5 * UNITS_PER_METRE, heading: a, armed: true, from: metres, deploy: 20, phase: 'open', phaseK: 1, pullRate: 40 * UNITS_PER_METRE, load: 1, peakLoad: 3, flown: 10, brakesSet: false, pullAltitude: player.altitude + 200 * UNITS_PER_METRE }
        : { stage: 'freefall', elapsed: 8, opening: 0, vx: drift.x, vy: drift.y, vz: -fall * UNITS_PER_METRE, heading: a, armed: false, from: metres };
    }
    function deckLandingConsole() {
      return {
        // What deck is under (x, y) (default the player) and whether it is free to stand on; where the player stands aboard; the last deck landing.
        deckLanding: (x, y) => deckLandingReport(x, y),
        // Put the player `metres` above a ship's deck at (u, v), under a flying canopy (open) or in freefall: deckJump('meridian', 30, -140, 0).
        deckJump: (id, metres, u, v, open, heading, fall) => deckJump(id, metres, u, v, open, heading, fall),
        // The same over any map point (a boat, the sea): a canopy flying along `heading` `metres` above what is there.
        canopyOver: (x, y, metres = 10, heading) => (jumpAt(x, y, metres, true, heading), deckLandingReport()),
      };
    }
