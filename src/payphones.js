    // Story payphones: PAYPHONES (the original `phone` first, at least two on every island incl. North Point Key, PAYPHONE_ISLANDS),
    // the one the job pointer guides to (nearest, with hysteresis), the one in reach, map icons and the console report.
    /**
     * STORY PAYPHONES
     * A waiting story call (storyCallWaiting) can be answered at any payphone:
     * E at the one in reach (payphoneInReach) takes it. The pointer (objective(),
     * so the arrow, the navigation pill, the minimap and the map) guides to
     * `storyPayphone()`, the nearest one, re-chosen as the player moves:
     * another phone takes over only when it is clearly nearer (PAYPHONE_SWITCH),
     * and one on another island counts as further (PAYPHONE_OTHER_ISLAND), so
     * the pointer neither flickers nor sends the player across a bridge.
     *
     * Every island (every land region maps to one in PAYPHONE_REGION_ISLAND:
     * the garage islands, garages-shops.js GARAGE_ISLANDS, and North Point Key)
     * has at least two, spread over it, on a pavement against a building or a
     * kerb, clear of roads, the Key's visitor lanes, doors (their prompt wins
     * inside PLACE_REACH), bus stops, bike stations, the Blue Hour's forecourt
     * and the garage lots (payphoneAudit(), tools/tests/payphones-islands.mjs).
     * `style` 'yellow' is the 1990s pedestal booth of payphone3d.js (facing
     * south, the street camera's way); 'isle' is one of Monarch Isle's green
     * booths (MONARCH_PAYPHONES, monarch-streets3d.js). Index 0 is the original
     * `phone` (game-state.js), where mission 1 starts and the opening shot
     * looks: code that names `phone` still means that one.
     */
    const PAYPHONE_SWITCH = 0.8,
      PAYPHONE_OTHER_ISLAND = 1.6,
      // Which island a land region belongs to (LAND_REGIONS ids; the garage islands' names).
      PAYPHONE_REGION_ISLAND = {
        northbank: 'northbank',
        airport: 'northbank',
        'southport-pier': 'northbank',
        palmkeys: 'palmkeys',
        ridgeline: 'ridgeline',
        monarch: 'monarch',
        oceanview: 'oceanview',
        'oceanview-pier': 'oceanview',
        'oceanview-pier-east': 'oceanview',
        coralcoast: 'coralcoast',
        sunsetisle: 'sunsetisle',
        sentinel: 'sentinel',
        northpointkey: 'northpointkey',
      };
    const PAYPHONES = [
      Object.assign(phone, { id: 'armory', island: 'northbank', name: 'ARMORY STREET', style: 'yellow' }),
      ...[
        // id, island, x, y, name: each on the north pavement of a street, its back to a building or a lot.
        ['harbor-north', 'northbank', 534, -3030, 'HARBOR NORTH'],
        ['cruise', 'northbank', 2374, -3540, 'CRUISE TERMINAL'],
        ['old-quarter', 'northbank', 1318, -1494, 'OLD QUARTER'],
        ['financial', 'northbank', 2886, -956, 'FINANCIAL DISTRICT'],
        ['midtown', 'northbank', 2854, 1080, 'MIDTOWN'],
        ['eastside', 'northbank', 774, 2594, 'EASTSIDE'],
        ['bayside', 'northbank', 2342, 3652, 'BAYSIDE'],
        ['southport', 'northbank', 2006, 4650, 'SOUTHPORT'],
        ['keys-north', 'palmkeys', -2154, 1080, 'PALM KEYS NORTH'],
        ['keys-sound', 'palmkeys', -1722, 3128, 'PALM SOUND'],
        ['keys-south', 'palmkeys', -2186, 4664, 'PALM KEYS SOUTH'],
        ['stonecreek', 'ridgeline', 7094, 3638, 'STONECREEK'],
        ['northridge', 'ridgeline', 9066, 3550, 'NORTHRIDGE'],
        ['eastgate', 'ridgeline', 9226, 5138, 'EASTGATE'],
        ['oceanview', 'oceanview', 2550, 7462, 'OCEANVIEW'],
        ['oceanview-east', 'oceanview', 5770, 7926, 'BEACH ROAD'],
        ['palmshore', 'coralcoast', 6836, 8052, 'PALMSHORE'],
        ['palmshore-south', 'coralcoast', 7684, 8564, 'PALMSHORE SOUTH'],
        ['pier-gate', 'sunsetisle', 3270, -5960, 'PIER GATE'],
        ['pier-drive', 'sunsetisle', 3814, -5960, 'PIER ISLAND DRIVE'],
        ['causeway', 'sentinel', 9342, 8071, 'SENTINEL CAUSEWAY'],
        ['causeway-west', 'sentinel', 8830, 8071, 'CAUSEWAY STRIP'],
        // North Point Key: on the forecourt, its back to MERCURY TOWER west of the entrance canopy, and on the
        // circle's outer pavement south of the drive, its back to the kerb (off the visitors' lanes).
        ['key-forecourt', 'northpointkey', 3828, -3690, 'KEY FORECOURT'],
        ['key-circle', 'northpointkey', 4135, -3350, 'KEY CIRCLE'],
      ].map(([id, island, x, y, name]) => ({ id, island, x, y, name, style: 'yellow' })),
      ...MONARCH_PAYPHONES.map((p, i) => ({ id: 'monarch-' + (i + 1), island: 'monarch', x: p.x, y: p.y, name: p.name, style: 'isle' })),
    ];
    for (const p of PAYPHONES) p.reachKey = p === phone ? 'payphone' : 'payphone-' + p.id;
    const PAYPHONE_ISLANDS = {};
    for (const p of PAYPHONES) (PAYPHONE_ISLANDS[p.island] ||= []).push(p.id);
    const storyPayphoneState = { index: 0, island: null, checkAt: -Infinity };
    /* The island a point stands on (PAYPHONE_REGION_ISLAND), or null at sea or on a bridge. */
    function payphoneIslandAt(x, y) {
      for (let i = 0; i < LAND_REGIONS.length; i++) {
        const r = LAND_REGIONS[i];
        if (PAYPHONE_REGION_ISLAND[r.id] && regionContains(r, x, y)) return PAYPHONE_REGION_ISLAND[r.id];
      }
      return null;
    }
    // How far a payphone counts from (x, y): one on another island counts further.
    function payphoneScore(p, x, y, island) {
      const d = hypot2(p.x - x, p.y - y);
      return island && p.island !== island ? d * PAYPHONE_OTHER_ISLAND : d;
    }
    function nearestPayphoneIndex(x, y, island) {
      let best = 0,
        bestScore = Infinity;
      for (let i = 0; i < PAYPHONES.length; i++) {
        const s = payphoneScore(PAYPHONES[i], x, y, island);
        if (s < bestScore) {
          bestScore = s;
          best = i;
        }
      }
      return best;
    }
    /* Per frame in play (game-update.js): keep the guided payphone the nearest one, with hysteresis. */
    function updateStoryPayphone() {
      const s = storyPayphoneState;
      if (gameTime >= s.checkAt || gameTime < s.checkAt - 1) {
        s.island = payphoneIslandAt(player.x, player.y);
        s.checkAt = gameTime + 0.5;
      }
      const best = nearestPayphoneIndex(player.x, player.y, s.island);
      if (best === s.index) return;
      const now = payphoneScore(PAYPHONES[s.index], player.x, player.y, s.island),
        next = payphoneScore(PAYPHONES[best], player.x, player.y, s.island);
      if (next < now * PAYPHONE_SWITCH - 40) s.index = best;
    }
    /* The payphone the job pointer guides to (objective() while a call waits). */
    function storyPayphone() {
      return PAYPHONES[storyPayphoneState.index];
    }
    /* The payphone in reach of the player (each keeps its own prompt hysteresis), or null. */
    function payphoneInReach() {
      let found = null;
      for (let i = 0; i < PAYPHONES.length; i++) {
        const p = PAYPHONES[i];
        if (withinRange(p.reachKey, distanceBetween(player, p), 68, 84) && !found) found = p;
      }
      return found;
    }
    /* The city map and the minimap: a yellow disc with a handset at every payphone. */
    function drawPayphoneMap(g, scale) {
      g.save();
      for (let i = 0; i < PAYPHONES.length; i++) {
        const p = PAYPHONES[i];
        if (!mapWindowHas(p.x, p.y, 40 / scale)) continue;
        const r = 7 / scale;
        g.fillStyle = '#e3b21f';
        g.strokeStyle = '#2a2410';
        g.lineWidth = 1.5 / scale;
        g.beginPath();
        g.arc(p.x, p.y, r, 0, TAU);
        g.fill();
        g.stroke();
        // The handset: a curved grip with an earpiece and a mouthpiece.
        g.lineWidth = 2 / scale;
        g.beginPath();
        g.arc(p.x, p.y + 2.6 / scale, 3.6 / scale, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
        g.fillStyle = '#2a2410';
        for (const s of [-1, 1]) g.fillRect(p.x + s * 3.6 / scale - 1.6 / scale, p.y - 0.4 / scale, 3.2 / scale, 2.4 / scale);
      }
      g.restore();
    }
    /* Each payphone's site against the rules it must keep (the console and the island test). */
    function payphoneAudit(p) {
      const near = (list, f = (q) => q) => {
          let best = Infinity;
          for (const q of list) {
            const o = f(q);
            if (o) best = Math.min(best, Math.hypot(o.x - p.x, o.y - p.y));
          }
          return Number.isFinite(best) ? Math.round(best) : null;
        },
        stations = typeof bikeStationCache !== 'undefined' && bikeStationCache ? bikeStationCache : [];
      return {
        land: !!landAt(p.x, p.y),
        island: payphoneIslandAt(p.x, p.y),
        road: !!onRoad(p.x, p.y) || cityStreetAt(p.x, p.y, 10),
        // The booth's footprint and the pavement in front where the caller stands.
        solid: p.style === 'yellow' ? solid(p.x, p.y + 14, 6) : false,
        door: near(PLACES, (q) => q.door),
        busStop: near(BUS_STOPS),
        bikeStation: near(stations),
        prop: near(streetProps.filter((q) => !q.down && q.kind !== 'sharebike')),
        otherPayphone: near(PAYPHONES.filter((q) => q !== p)),
        forecourt: blueHourForecourt(p.x, p.y, 20),
        garageLot: inGarageLot(p.x, p.y, 20),
        // North Point Key: units to the visitors' run (livingcity-key.js keyRunRoute, lane centres), else null.
        visitorLane: onNorthPointKey(p.x, p.y) ? payphoneLaneDistance(p, keyRunRoute().points) : null,
      };
    }
    function payphoneLaneDistance(p, points) {
      let best = Infinity;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          b = points[i];
        best = Math.min(best, segmentDistance(p.x, p.y, [a.x, a.y], [b.x, b.y]));
      }
      return Math.round(best);
    }
    function payphonesReport() {
      const chosen = storyPayphone(),
        reach = payphoneInReach();
      return {
        count: PAYPHONES.length,
        islands: PAYPHONE_ISLANDS,
        guided: chosen.id,
        inReach: reach ? reach.id : null,
        callWaiting: !mission && storyCallWaiting(),
        playerIsland: payphoneIslandAt(player.x, player.y),
        // Every land region and the island it counts as (null: unmapped, which the island test fails).
        regions: LAND_REGIONS.filter((r) => !r.lake).map((r) => ({ id: r.id, island: PAYPHONE_REGION_ISLAND[r.id] || null })),
        list: PAYPHONES.map((p) => ({
          id: p.id,
          island: p.island,
          name: p.name,
          style: p.style,
          x: p.x,
          y: p.y,
          metres: Math.round(worldMeters(distanceBetween(player, p))),
          audit: payphoneAudit(p),
        })),
      };
    }
