    // BEGIN SUBSYSTEM: src/cycles.js — City bicycles
    /**
     * City bicycles
     * Source: src/cycles.js
     * Scope: shared game closure.
     * South Coast Cycle bike share (docked stations, renting, docking,
     * restocking, the map icons) and the rider's legs.
     */
    /**
     * RIDING
     * Riding has legs: holding Shift while pedalling stands you on the pedals for
     * a faster, harder gear that drains stamina, and easing off gets it back.
     * Stamina only applies to the player's own bicycle; nothing else in traffic
     * is affected.
     */
    /**
     * PEDALLING
     * Hold W (or the PEDAL touch button) and the rider pedals; let go and the
     * bike freewheels. The legs are not a throttle, though: effort spins up over
     * a fraction of a second, and the push they give fades as the bike nears
     * its top speed (a square-root taper), so a bicycle leaps off the line,
     * builds briskly through the middle and settles gently at the top instead of
     * hitting a wall. Cadence is derived from speed and effort for the HUD and
     * the crank animation; riding makes no engine note, crank tick or tyre
     * squeal. S brakes, then creeps backwards slowly.
     */
    const CYCLE_STAMINA_MAX = 7.5,
      // Standing on the pedals: about 38 km/h against a 22 km/h cruise.
      CYCLE_SPRINT_TOP = 1.73,
      CYCLE_SPRINT_PUSH = 1.7,
      // Forward push at a standstill (about 2 m/s²), world units per second squared.
      CYCLE_PUSH = 0.2 * GRAVITY,
      // How quickly the legs come up to full effort, and let go of it, per second.
      CYCLE_SPIN_UP = 3.2,
      CYCLE_SPIN_DOWN = 6,
      // Crank revolutions per second at top speed in the normal gear (~95 rpm).
      CYCLE_CADENCE_TOP = 1.6,
      // Reverse is a walk-it-backwards shuffle, not a gear.
      CYCLE_REVERSE_MAX = 5 * KMH;
    let cycleStamina = CYCLE_STAMINA_MAX;
    const pedal = { effort: 0, cadence: 0 };
    function ridingBicycle() {
      return !!player.car && vehicleSpec(player.car).bicycle;
    }
    function cycleSprinting() {
      // Standing on the pedals only counts while actually pedalling.
      return (
        ridingBicycle() &&
        !!(keys.KeyW || keys.ArrowUp) &&
        !!(keys.ShiftLeft || keys.ShiftRight) &&
        cycleStamina > 0.05
      );
    }
    function pedalCadence() {
      return pedal.cadence;
    }
    function pedalEffort() {
      return pedal.effort;
    }
    /* Forward acceleration the rider's legs give at speed `along` against a top
       speed of `topSpeed` (physics.js adds it to the bike's own drag and brakes). */
    function pedalDrive(along, topSpeed) {
      if (pedal.effort <= 0 || along >= topSpeed) return 0;
      const room = 1 - Math.max(0, along) / topSpeed;
      return CYCLE_PUSH * pedal.effort * (cycleSprinting() ? CYCLE_SPRINT_PUSH : 1) * Math.sqrt(room);
    }
    function updateCycling(deltaSeconds) {
      const riding = ridingBicycle(),
        pressed = riding && !!(keys.KeyW || keys.ArrowUp);
      if (!riding) {
        pedal.effort = pedal.cadence = 0;
      } else {
        pedal.effort = pressed
          ? Math.min(1, pedal.effort + CYCLE_SPIN_UP * deltaSeconds)
          : Math.max(0, pedal.effort - CYCLE_SPIN_DOWN * deltaSeconds);
        // Cadence follows road speed while pedalling and drops away when coasting.
        const speedShare = clamp((player.car.speed || 0) / vehicleSpec(player.car).max, 0, 1.5),
          target = pressed ? CYCLE_CADENCE_TOP * (0.35 + 0.65 * speedShare) : 0;
        pedal.cadence += (target - pedal.cadence) * Math.min(1, deltaSeconds * (pressed ? 4 : 2.5));
        // No crank sound: the old per-revolution tick replayed the tyre-skid
        // sample sped up, which read as a squeak. A bicycle is near silent.
      }
      if (cycleSprinting()) cycleStamina = Math.max(0, cycleStamina - deltaSeconds);
      else cycleStamina = Math.min(CYCLE_STAMINA_MAX, cycleStamina + deltaSeconds * (riding ? 0.55 : 3));
      updateBikeShare(deltaSeconds);
    }
    /**
     * BIKE SHARE: SOUTH COAST CYCLE
     * Docked stations: a steel rack of four to eight docks, each holding a city
     * bike in the teal and white livery, and a payment totem with a backlit map
     * at its west end (cycles3d.js draws them). They stand beside the payphone,
     * at every place a job first sends you (MISSION_STARTS), at the transit hubs
     * (the rail stations and Southport's terminal) and where the old free racks
     * were: park gates, the marina, Sunset Pier, along the esplanade.
     *
     * PLACEMENT (bikeStationPlan): for each anchor, candidate spots are tried
     * nearest first: along the pavements of the streets round it (the dock posts
     * on the kerb side, the bikes' tails toward the buildings, a walkway left
     * behind them) and then open ground in rings. A spot fits when its whole
     * footprint is dry pavement or plaza (no carriageway, rail, building,
     * collider, quay railing, street end, beach, harbor or airport), when the
     * walkway behind it is clear, and when it keeps off crosswalks, doors, rail
     * entrances, the payphone, trees, lamps and benches. An anchor with a station
     * close by is served by that one. The renderer then settles each station
     * against the street furniture it placed (settleBikeStations), moving it to
     * its next candidate where a piece is in the way.
     *
     * RENT AND DOCK: on foot at a station, RENT BIKE · $5 (the ordinary prompt,
     * offerPrompt) undocks the nearest bike and puts the player on it: an
     * ordinary bicycle with `shareBike` set (the livery, vehicles3d.js). Riding a
     * share bike slowly up to any station with a free dock offers DOCK BIKE,
     * which racks it and hands $2 back. A station restocks one bike every
     * BIKE_SHARE.restock seconds or so while nobody is standing at it.
     *
     * KNOCKED OVER: the rack, the totem and every docked bike are breakable street
     * props (damage.js `bikerack`, `biketotem`, `sharebike`): a car shoves bikes
     * over at walking pace, bends the rack from about 25 km/h and the totem from
     * about 33, and the city stands them up again with its other furniture. A
     * rack that goes down takes its bikes with it. An empty dock's bike prop is
     * laid down and hidden, so it neither blocks nor draws; docking stands it up.
     *
     * SIZE: everything a station measures follows the bicycle, whose model is
     * drawn to its collider length (SHARE_BIKE_LENGTH = VEHICLE_DEFINITIONS
     * .bicycle.l): the dock pitch, where the bikes stand, the footprint and the
     * props' boxes. The rack and the totem are sized in metres (UNITS_PER_METRE),
     * so a rescale of the bicycle or of the world carries the stations with it.
     */
    const SHARE_BIKE_LENGTH = VEHICLE_DEFINITIONS.bicycle.l,
      SHARE_BIKE_METRE = UNITS_PER_METRE;
    const BIKE_SHARE = {
        brand: 'SOUTH COAST CYCLE',
        rent: 5,
        refund: 2,
        // Handlebar width (a third of the bike's length, as on a real city bike),
        // and the dock pitch: the bars plus a hand's gap.
        bikeWidth: SHARE_BIKE_LENGTH * 0.3,
        pitch: SHARE_BIKE_LENGTH * 0.36,
        // Across the station (local v): the dock posts at 0 (a post's depth
        // behind), the bikes nose in from a quarter metre out, tails toward the
        // walkway.
        back: -0.45 * SHARE_BIKE_METRE,
        bikeV: 0.25 * SHARE_BIKE_METRE + SHARE_BIKE_LENGTH / 2,
        front: 0.35 * SHARE_BIKE_METRE + SHARE_BIKE_LENGTH,
        // The totem: its centre this far west of the rack's end, its half width.
        totemGap: 0.9 * SHARE_BIKE_METRE,
        totemHalf: 0.45 * SHARE_BIKE_METRE,
        // The dock posts stand this far back from the kerb.
        kerbGap: 1.1 * SHARE_BIKE_METRE,
        // The walkway kept clear behind the bikes.
        walkway: 1.8 * SHARE_BIKE_METRE,
        // One bike back in a station about every this many seconds (while nobody is at it).
        restock: 150,
        // Prompt ranges from the footprint (hysteresis, hud.js withinRange).
        rentReach: [3.2 * SHARE_BIKE_METRE, 4.5 * SHARE_BIKE_METRE],
        dockReach: [4.2 * SHARE_BIKE_METRE, 5.8 * SHARE_BIKE_METRE],
        dockSpeed: 12 * KMH,
        // Two stations are never nearer than this; an anchor this close to one is served by it.
        spacing: 21 * SHARE_BIKE_METRE,
      },
      BIKE_SHARE_TEAL = '#12948f',
      // Where each job first sends you, for jobs whose `missions[i]` entry has
      // no `start` point of its own: the setStage(0) target of its start
      // function (harbor.js, roofmission.js, challenges.js, aviation.js,
      // sidejobs.js). A new job only needs `start: { x, y }` on its entry.
      MISSION_STARTS = () => [
        [0, HARBOR.truck],
        [1, ROOF_HIT.outfit],
        [2, { x: 1000, y: 666 }],
        [3, { x: 2715, y: 1570 }],
        [4, LOC.cinema],
        [5, { x: 1420, y: 1664 }],
        [6, ROOFTOP.door],
        [7, DOCKS.find((d) => d.type === 'jetski')],
        [8, LOC.terminal],
        [9, FLIGHT.heli],
        [10, FLIGHT.plane],
        [11, { x: phone.x + 90, y: phone.y + 120 }],
        [12, BOMB_SITES[0]],
        [13, SUBSTATIONS[0]],
        [14, { x: 418, y: 7820 }],
        [15, { x: REPO_TARGETS[0][1], y: REPO_TARGETS[0][2] }],
      ];
    let bikeStationCache = null,
      bikeStationGrid = null,
      bikeStationsSettled = false,
      // Bumped whenever a dock empties or fills (cycles3d.js redraws on a change).
      bikeShareVersion = 0;
    const bikeShareLog = { rented: 0, docked: 0, spent: 0, refunded: 0, skipped: [] },
      // Places other systems ask for a station at (addBikeShareAnchor).
      bikeShareExtraAnchors = [];
    /* The station network is data-driven: every payphone and every job's start
       gets one. Payphones are the ringing `phone`, any `PAYPHONES` list a
       district declares, and PLACES of kind 'payphone'; a job's start is its
       `missions[i].start`, else MISSION_STARTS. Anything else (a new district's
       plaza, a ferry pier) can call addBikeShareAnchor before the city is
       populated. */
    function addBikeShareAnchor(point) {
      bikeShareExtraAnchors.push({ kind: 'place', n: 6, label: 'STATION', ...point });
      if (bikeStationCache && !bikeStationsSettled) bikeStationCache = null;
    }
    function payphoneAnchors() {
      const list = [{ x: phone.x, y: phone.y, label: 'PAYPHONE' }];
      try {
        // eslint-disable-next-line no-undef
        if (typeof PAYPHONES !== 'undefined' && Array.isArray(PAYPHONES))
          PAYPHONES.forEach((p, i) => list.push({ x: p.x, y: p.y, label: p.name || p.label || 'PAYPHONE ' + (i + 2) }));
      } catch {}
      for (const p of PLACES)
        if (p.kind === 'payphone' || p.payphone) list.push({ x: (p.door || p).x, y: (p.door || p).y, label: p.name || 'PAYPHONE' });
      return list.filter((p, i) => Number.isFinite(p.x) && list.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 4) === i);
    }
    function missionStartAnchors() {
      const known = new Map(MISSION_STARTS());
      return missions
        .map((m, index) => {
          const p = m.start || known.get(index);
          return p ? { x: p.boatX ?? p.x, y: p.boatY ?? p.y, label: missionStartLabel(index), title: m.title } : null;
        })
        .filter(Boolean);
    }
    function missionStartLabel(index) {
      return index >= SIDE_JOB_FIRST ? 'CONTRACT ' + (index + 1 - SIDE_JOB_FIRST) : 'MISSION ' + (index + 1);
    }
    /* Station frame: +u along the rack (heading `a`), +v across it toward the
       walkway (a + 90 degrees). */
    function stationPoint(st, u, v) {
      const c = Math.cos(st.a),
        s = Math.sin(st.a);
      return { x: st.x + c * u - s * v, y: st.y + s * u + c * v };
    }
    function stationLocal(st, x, y) {
      const dx = x - st.x,
        dy = y - st.y,
        c = Math.cos(st.a),
        s = Math.sin(st.a);
      return { u: dx * c + dy * s, v: -dx * s + dy * c };
    }
    function stationExtent(n) {
      const half = (n * BIKE_SHARE.pitch) / 2;
      return { u0: -half - BIKE_SHARE.totemGap - BIKE_SHARE.totemHalf - 0.1 * SHARE_BIKE_METRE, u1: half + 0.2 * SHARE_BIKE_METRE, half };
    }
    // Distance from a point to the station's footprint (0 inside it).
    function stationDistance(st, x, y) {
      const p = stationLocal(st, x, y),
        e = stationExtent(st.n);
      return Math.hypot(Math.max(e.u0 - p.u, 0, p.u - e.u1), Math.max(BIKE_SHARE.back - p.v, 0, p.v - BIKE_SHARE.front));
    }
    // A vehicle collider (bus shelter, kiosk, barrier...) under a point.
    function staticBodyAt(x, y, margin) {
      const list = staticGrid.get(Math.floor(x / 256) * 4096 + Math.floor(y / 256));
      if (list)
        for (const b of list) {
          if (b.kind === 'coast') continue;
          const dx = x - b.x,
            dy = y - b.y,
            c = Math.cos(b.a || 0),
            s = Math.sin(b.a || 0);
          if (Math.abs(dx * c + dy * s) < b.hx + margin && Math.abs(-dx * s + dy * c) < b.hy + margin) return true;
        }
      return false;
    }
    // Runways, taxiways and helipads (with a margin): never a place for a rack.
    function onAirfieldPavement(x, y) {
      for (const r of RUNWAYS) {
        const rect = runwayRect(r);
        if (x > rect.x - 60 && x < rect.x + rect.w + 60 && y > rect.y - 60 && y < rect.y + rect.h + 60) return true;
      }
      for (const t of TAXIWAYS) if (segmentDistance(x, y, t.from, t.to) < t.width / 2 + 30) return true;
      for (const pad of HELIPADS) if (Math.abs(x - pad.x) < 70 && Math.abs(y - pad.y) < 70) return true;
      return false;
    }
    /* The per-point tests every candidate repeats (candidates overlap), cached
       on a 2-unit lattice while a plan is being made. */
    let bikePointCache = null;
    function bikePavementAt(x, y) {
      const key = Math.round(x / 2) * 65536 + Math.round(y / 2);
      let ok = bikePointCache.get(key);
      if (ok === undefined) {
        ok =
          groundAt(x, y) && !solid(x, y, 2) && !cityStreetAt(x, y, 4) && !onBeach(x, y) &&
          !inHarbor(x, y, 12) && !staticBodyAt(x, y, 2) && !onAirfieldPavement(x, y);
        bikePointCache.set(key, ok);
      }
      return ok;
    }
    /* Does a station of `st.n` docks fit at (st.x, st.y) facing `st.a`? `near`
       holds what it must keep off, gathered once per anchor. */
    function bikeStationFits(st, near) {
      const e = stationExtent(st.n),
        uStep = (e.u1 - e.u0) / Math.ceil((e.u1 - e.u0) / 6);
      // Most candidates fail at a corner: try the corners and the middle first.
      for (const [u, v] of [[e.u0, BIKE_SHARE.back], [e.u1, BIKE_SHARE.back], [e.u0, BIKE_SHARE.front], [e.u1, BIKE_SHARE.front], [0, BIKE_SHARE.bikeV]]) {
        const p = stationPoint(st, u, v);
        if (!bikePavementAt(p.x, p.y)) return false;
      }
      // The footprint: dry, open pavement.
      for (let u = e.u0; u <= e.u1 + 0.1; u += uStep)
        for (let v = BIKE_SHARE.back; v <= BIKE_SHARE.front + 0.1; v += 6.4) {
          const p = stationPoint(st, u, v);
          if (!bikePavementAt(p.x, p.y)) return false;
          for (const c of near.parked) if (pointInCar(p.x, p.y, c, 8)) return false;
          for (const c of near.crosswalks)
            if (p.x > c.x - 16 && p.x < c.x + c.w + 16 && p.y > c.y - 16 && p.y < c.y + c.h + 16) return false;
          for (const t of near.trees) if (Math.hypot(p.x - t.x, p.y - t.y) < 7) return false;
          for (const l of near.lamps) if (Math.hypot(p.x - l.x, p.y - l.y) < 6) return false;
          for (const b of near.benches) if (Math.hypot(p.x - b.x, p.y - b.y) < 14) return false;
        }
      // The walkway behind the bikes stays open (not a wall, not the road).
      for (let u = e.u0; u <= e.u1 + 0.1; u += 8)
        for (const v of [BIKE_SHARE.front + 5, BIKE_SHARE.front + BIKE_SHARE.walkway]) {
          const p = stationPoint(st, u, v);
          if (!groundAt(p.x, p.y) || solid(p.x, p.y, 2) || cityStreetAt(p.x, p.y, 0)) return false;
        }
      // Keep-outs: doors, rail entrances (their prompts), the payphone, other stations.
      for (const d of near.doors) if (stationDistance(st, d.x, d.y) < 26) return false;
      for (const s of near.entries) if (stationDistance(st, s.x, s.y) < 50) return false;
      // Off the payphone's own reach (its prompt wins there), and clear of the
      // vehicle a job spawns on its start point.
      for (const p of near.payphones) if (stationDistance(st, p.x, p.y) < 88) return false;
      if (near.spawn && stationDistance(st, near.spawn.x, near.spawn.y) < 48) return false;
      for (const other of near.stations) if (Math.hypot(other.x - st.x, other.y - st.y) < BIKE_SHARE.spacing) return false;
      return true;
    }
    /* Candidate spots round an anchor, nearest first: on the pavements of the
       streets within reach (kerb side down), then open ground in rings. */
    function bikeStationCandidates(anchor) {
      const out = [],
        reach = 320;
      for (const r of cityStreets()) {
        const along = r.vertical ? anchor.y : anchor.x,
          across = r.vertical ? anchor.x : anchor.y;
        if (Math.abs(across - r.r) > reach || along < r.start - reach || along > r.end + reach) continue;
        for (const side of [-1, 1]) {
          // The dock posts just back from the kerb; +v (the bikes, the walkway)
          // points away from the street.
          const spine = r.r + side * (r.width / 2 + BIKE_SHARE.kerbGap),
            a = r.vertical ? -side * (Math.PI / 2) : side > 0 ? 0 : Math.PI;
          for (let t = -reach; t <= reach; t += 12) {
            const at = Math.round(along / 12) * 12 + t;
            if (at < r.start + 70 || at > r.end - 70) continue;
            const x = r.vertical ? spine : at,
              y = r.vertical ? at : spine;
            out.push({ x, y, a, d: Math.hypot(x - anchor.x, y - anchor.y) });
          }
        }
      }
      for (let radius = 0; radius <= 260; radius += 20)
        for (let k = 0, count = Math.max(1, Math.round(radius / 12)); k < count; k++) {
          const t = (k / count) * TAU,
            x = anchor.x + Math.cos(t) * radius,
            y = anchor.y + Math.sin(t) * radius;
          for (const a of new Set([anchor.a ?? 0, 0, Math.PI / 2, Math.PI, -Math.PI / 2])) out.push({ x, y, a, d: radius + 25 });
        }
      out.sort((p, q) => p.d - q.d);
      return out;
    }
    function bikeStationPlan() {
      if (bikeStationCache) return bikeStationCache;
      const stations = [],
        near = {
          stations,
          crosswalks: [],
          doors: PLACES.filter((p) => p.door).map((p) => p.door),
          entries: RAIL_STATIONS.map((s) => s.entry),
          trees: [],
          lamps: [],
          benches: [],
          parked: [],
          spawn: null,
          payphones: payphoneAnchors(),
        };
      const started = performance.now(),
        crosswalks = cityCrosswalks();
      bikePointCache = new Map();
      const anchors = payphoneAnchors().map((p) => ({ ...p, kind: 'payphone', n: 8 }));
      for (const p of missionStartAnchors()) anchors.push({ ...p, kind: 'mission', n: 6 });
      for (const s of RAIL_STATIONS) anchors.push({ x: s.entry.x, y: s.entry.y, kind: 'transit', label: s.name + ' STATION', n: 8 });
      anchors.push({ x: LOC.terminal.x, y: LOC.terminal.y, kind: 'transit', label: 'SOUTHPORT TERMINAL', n: 8 });
      // Where the old free racks stood: park gates, the marina, the pier, the esplanade.
      for (const p of CITY_PARKS) {
        const gate = parkLoop(p, 4)[0];
        if (gate) anchors.push({ x: gate[0] + 26, y: gate[1] + 18, kind: 'park', label: p.name, n: 5 });
      }
      for (const [x, y, label] of [
        [1596, -3320, 'HARBOR POINT MARINA'],
        [1240, -3290, 'MARINA QUAY'],
        [3960, -5960, 'SUNSET PIER'],
        [2300, 2686, 'EXCHANGE'],
      ])
        anchors.push({ x, y, kind: 'place', label, n: 6 });
      anchors.push(...bikeShareExtraAnchors);
      const walk = promenadeSpots();
      for (let i = 5; i < walk.length; i += 44)
        anchors.push({ x: walk[i].x, y: walk[i].y, a: walk[i].a, kind: 'esplanade', label: 'ESPLANADE', n: 4 });
      for (const anchor of anchors) {
        if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) continue;
        const served = stations.find((st) => Math.hypot(st.x - anchor.x, st.y - anchor.y) < BIKE_SHARE.spacing + 40);
        if (served) {
          served.serves.push(anchor.label);
          continue;
        }
        // What to keep off round this anchor.
        const close = (p) => Math.abs(p.x - anchor.x) < 700 && Math.abs(p.y - anchor.y) < 700;
        near.trees = trees.filter(close);
        near.crosswalks = crosswalks.filter(close);
        near.lamps = lamps.filter(close);
        near.benches = benchSpots().filter(close);
        // Parked vehicles (not traffic), and a job's own spawn point.
        near.parked = vehicles.filter((c) => !c.ai && close(c));
        near.spawn = anchor.kind === 'mission' ? anchor : null;
        const alternatives = [];
        for (const c of bikeStationCandidates(anchor)) {
          if (alternatives.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < 30)) continue;
          const st = { x: c.x, y: c.y, a: c.a, n: anchor.n };
          if (!bikeStationFits(st, near)) continue;
          alternatives.push(st);
          if (alternatives.length >= 6) break;
        }
        if (!alternatives.length) {
          bikeShareLog.skipped.push(anchor.label);
          continue;
        }
        stations.push({
          id: stations.length,
          kind: anchor.kind,
          label: anchor.label,
          serves: [anchor.label],
          x: alternatives[0].x,
          y: alternatives[0].y,
          a: alternatives[0].a,
          n: anchor.n,
          alternatives,
          slots: [],
          rack: null,
          totem: null,
          restockAt: 0,
        });
      }
      for (const st of stations) layBikeStation(st);
      bikeShareLog.planMs = Math.round(performance.now() - started);
      bikePointCache = null;
      bikeStationCache = stations;
      indexBikeStations();
      resetBikeShare();
      return stations;
    }
    // Docks and their bikes in map space (once the station is placed or moved).
    function layBikeStation(st) {
      const e = stationExtent(st.n);
      st.slots = [];
      for (let i = 0; i < st.n; i++) {
        const u = -e.half + (i + 0.5) * BIKE_SHARE.pitch,
          p = stationPoint(st, u, BIKE_SHARE.bikeV);
        // The bike faces into its dock (toward -v); `bike` says whether one is racked.
        st.slots.push({ u, x: p.x, y: p.y, a: st.a - Math.PI / 2, bike: true, prop: null });
      }
      st.totemAt = stationPoint(st, -e.half - BIKE_SHARE.totemGap, 0.5 * SHARE_BIKE_METRE);
      st.street = streetNameAt(st.x, st.y);
    }
    function indexBikeStations() {
      bikeStationGrid = new Map();
      for (const st of bikeStationCache) {
        const key = Math.floor(st.x / 256) * 4096 + Math.floor(st.y / 256);
        if (!bikeStationGrid.has(key)) bikeStationGrid.set(key, []);
        bikeStationGrid.get(key).push(st);
      }
    }
    /* The renderer calls this once its street furniture is placed: a station
       whose footprint or walkway a lamp, bin, hydrant or fixture stands in moves
       to its next candidate; with none left it is dropped. */
    function settleBikeStations() {
      const stations = bikeStationPlan();
      if (bikeStationsSettled) return stations;
      bikeStationsSettled = true;
      const blocked = (st) => {
        const e = stationExtent(st.n);
        let hit = false;
        propsNear(st.x, st.y, 80, (prop) => {
          if (hit || prop.down) return;
          const p = stationLocal(st, prop.x, prop.y),
            r = Math.hypot(prop.hx, prop.hy);
          hit = p.u > e.u0 - r - 3 && p.u < e.u1 + r + 3 && p.v > BIKE_SHARE.back - r - 3 && p.v < BIKE_SHARE.front + 8 + r;
        });
        if (hit) return true;
        for (let u = e.u0; u <= e.u1; u += 6)
          for (let v = BIKE_SHARE.back; v <= BIKE_SHARE.front + 8; v += 6) {
            const p = stationPoint(st, u, v);
            if (footObstacleBlocked(p.x, p.y, 2)) return true;
          }
        return false;
      };
      for (let i = stations.length - 1; i >= 0; i--) {
        const st = stations[i],
          spot = st.alternatives.find(
            (q) => !blocked({ ...q, n: st.n }) && !stations.some((o) => o !== st && Math.hypot(o.x - q.x, o.y - q.y) < BIKE_SHARE.spacing),
          );
        if (!spot) {
          bikeShareLog.skipped.push(st.label + ' (street furniture)');
          stations.splice(i, 1);
          continue;
        }
        if (spot.x !== st.x || spot.y !== st.y || spot.a !== st.a) {
          Object.assign(st, { x: spot.x, y: spot.y, a: spot.a });
          layBikeStation(st);
        }
      }
      stations.forEach((st, i) => (st.id = i));
      indexBikeStations();
      resetBikeShare();
      return stations;
    }
    // The network restocked, with a few docks left free in each for returns.
    function resetBikeShare() {
      if (!bikeStationCache) return;
      for (const st of bikeStationCache) {
        const free = Math.floor(seededRandom() * (st.n > 4 ? 3 : 2));
        st.slots.forEach((slot, i) => setDockBike(slot, i >= free));
        st.restockAt = 0;
      }
    }
    function populateCycles() {
      bikeStationPlan();
      resetBikeShare();
    }
    /* A dock gains or loses its bike: the prop stands (solid, drawn) or is laid
       down and hidden (cycles3d.js zeroes its instances). A bike a car knocked
       over is the city's to stand up again (damage.js restoreStreetProps). */
    function setDockBike(slot, racked) {
      slot.bike = racked;
      const prop = slot.prop;
      if (prop && !knockedProps.includes(prop)) {
        prop.down = !racked;
        prop.strain = 0;
      }
      bikeShareVersion++;
    }
    function bikeStationsNear(x, y, reach, visit) {
      if (!bikeStationGrid) bikeStationPlan();
      for (let i = Math.floor((x - reach) / 256); i <= Math.floor((x + reach) / 256); i++)
        for (let j = Math.floor((y - reach) / 256); j <= Math.floor((y + reach) / 256); j++) {
          const list = bikeStationGrid.get(i * 4096 + j);
          if (list) for (const st of list) visit(st);
        }
    }
    // The station whose footprint is nearest, within `reach` of its centre cell.
    function nearestBikeStation(x, y, reach = 160) {
      let best = null,
        bestDistance = Infinity;
      bikeStationsNear(x, y, reach, (st) => {
        const d = stationDistance(st, x, y);
        if (d < bestDistance) {
          best = st;
          bestDistance = d;
        }
      });
      return best ? { station: best, distance: bestDistance } : null;
    }
    const slotReady = (slot) => slot.bike && !(slot.prop && slot.prop.down);
    function dockedBikes(st) {
      let n = 0;
      for (const slot of st.slots) if (slotReady(slot)) n++;
      return n;
    }
    function rackStanding(st) {
      return !(st.rack && st.rack.down);
    }
    function onShareBike() {
      return ridingBicycle() && !!player.car.shareBike;
    }
    /* What the station in reach offers this pass, or null: the prompt and what
       the action key would do. updateUI() asks for the prompt and interact()
       for the key, through the same ranges, so the two always agree. */
    function bikeShareOffer() {
      if (gameMode !== 'play') return null;
      const c = player.car;
      if (c) {
        if (!onShareBike()) return null;
        const found = nearestBikeStation(c.x, c.y);
        // Just rented: no DOCK BIKE at that station until the bike has been ridden away.
        if (!c.shareAway && (!found || found.station.id !== c.shareFrom || found.distance > BIKE_SHARE.dockReach[1] * 1.5))
          c.shareAway = true;
        if (!c.shareAway || !found || !withinRange('bike-dock', found.distance, ...BIKE_SHARE.dockReach)) return null;
        const st = found.station;
        if (!rackStanding(st)) return { text: 'DOCKS DOWN · TRY ANOTHER STATION', key: null, station: st };
        if (!st.slots.some((s) => !s.bike)) return { text: 'STATION FULL · NO FREE DOCK', key: null, station: st };
        if (Math.abs(c.speed || 0) > BIKE_SHARE.dockSpeed) return { text: 'SLOW DOWN TO DOCK', key: null, station: st };
        return { text: 'DOCK BIKE · $' + BIKE_SHARE.refund + ' BACK', key: 'interact', station: st, action: 'dock' };
      }
      if (player.swimming || player.wading || player.parachute || player.deck || player.roof || player.buildingRoof) return null;
      if (transitRide || taxiRide || player.coaster) return null;
      const found = nearestBikeStation(player.x, player.y);
      if (!found || !withinRange('bike-rent', found.distance, ...BIKE_SHARE.rentReach)) return null;
      const st = found.station;
      if (!rackStanding(st) || !dockedBikes(st))
        return { text: BIKE_SHARE.brand + ' · NO BIKES DOCKED · RESTOCKING', key: null, station: st };
      return { text: 'RENT BIKE · $' + BIKE_SHARE.rent, key: 'interact', station: st, action: 'rent' };
    }
    /* The action key at a station; true when it did something. */
    function bikeShareInteract() {
      const offer = bikeShareOffer();
      if (!offer?.action) return false;
      return offer.action === 'rent' ? rentShareBike(offer.station) : dockShareBike(offer.station);
    }
    function rentShareBike(st) {
      if (cash < BIKE_SHARE.rent) {
        tell(BIKE_SHARE.brand + ' · $' + BIKE_SHARE.rent + ' to rent · not enough cash', 2.5);
        tone(140, 0.07, 0.2, 'square');
        return true;
      }
      let slot = null,
        best = Infinity;
      for (const s of st.slots)
        if (slotReady(s) && distanceBetween(player, s) < best) {
          best = distanceBetween(player, s);
          slot = s;
        }
      if (!slot) return false;
      setDockBike(slot, false);
      // Rolled out of its dock facing the walkway, clear of the posts.
      const out = stationPoint(st, slot.u, BIKE_SHARE.bikeV + 0.2 * SHARE_BIKE_METRE),
        bike = makeCar('bicycle', out.x, out.y, st.a + Math.PI / 2, false, BIKE_SHARE_TEAL);
      bike.shareBike = true;
      bike.shareFrom = st.id;
      cash -= BIKE_SHARE.rent;
      bikeShareLog.rented++;
      bikeShareLog.spent += BIKE_SHARE.rent;
      enterVehicle(bike);
      tell(BIKE_SHARE.brand + ' · $' + BIKE_SHARE.rent + ' · dock at any station for $' + BIKE_SHARE.refund + ' back', 4);
      tone(660, 0.08, 0.12, 'triangle');
      return true;
    }
    function dockShareBike(st) {
      const bike = player.car;
      let slot = null,
        best = Infinity;
      for (const s of st.slots)
        if (!s.bike && distanceBetween(bike, s) < best) {
          best = distanceBetween(bike, s);
          slot = s;
        }
      if (!slot) return false;
      exitCar();
      if (player.car) return true;
      const i = vehicles.indexOf(bike);
      if (i >= 0) vehicles.splice(i, 1);
      setDockBike(slot, true);
      cash += BIKE_SHARE.refund;
      bikeShareLog.docked++;
      bikeShareLog.refunded += BIKE_SHARE.refund;
      tell('BIKE DOCKED · $' + BIKE_SHARE.refund + ' BACK · ' + BIKE_SHARE.brand, 3);
      tone(780, 0.08, 0.1, 'triangle');
      return true;
    }
    /* Every step (from updateCycling): a station near the player whose rack goes
       down sheds its bikes; any station restocks slowly while nobody is at it. */
    let bikeShareClock = 0;
    function updateBikeShare(deltaSeconds) {
      if (!bikeStationCache) return;
      bikeStationsNear(player.x, player.y, 1400, (st) => {
        if (!st.rack?.down) return;
        for (const slot of st.slots)
          if (slot.bike && slot.prop && !slot.prop.down)
            topple(slot.prop, st.rack.fallA + (seededRandom() - 0.5) * 0.6, (st.rack.fallSpeed || 60) * 0.6);
      });
      bikeShareClock -= deltaSeconds;
      if (bikeShareClock > 0) return;
      bikeShareClock = 1;
      for (const st of bikeStationCache) {
        const empty = st.slots.find((s) => !s.bike);
        if (!empty) {
          st.restockAt = 0;
          continue;
        }
        if (!st.restockAt) st.restockAt = gameTime + BIKE_SHARE.restock * (0.8 + seededRandom() * 0.4);
        if (gameTime < st.restockAt || !rackStanding(st)) continue;
        // Not while the player is at it: the rebalancing van comes once they have gone.
        if (Math.hypot(player.x - st.x, player.y - st.y) < 260) {
          st.restockAt = gameTime + 10;
          continue;
        }
        setDockBike(empty, true);
        st.restockAt = 0;
      }
    }
    /* Map and minimap: a white bicycle on a teal chip at each station (grey-teal
       when it has no bikes). Sizes are in screen pixels. */
    function drawBikeShareMap(g, scale, big) {
      if (!bikeStationCache) return;
      const size = (big ? 6 : 5.5) / scale,
        view = big ? Infinity : 700 / minimapZoom();
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const st of bikeStationCache) {
        if (Math.abs(st.x - player.x) > view || Math.abs(st.y - player.y) > view) continue;
        const x = st.x,
          y = st.y;
        g.fillStyle = dockedBikes(st) ? BIKE_SHARE_TEAL : '#4b6664';
        g.strokeStyle = '#0b2427';
        g.lineWidth = 1.2 / scale;
        g.fillRect(x - size * 1.55, y - size * 1.05, size * 3.1, size * 2.1);
        g.strokeRect(x - size * 1.55, y - size * 1.05, size * 3.1, size * 2.1);
        g.strokeStyle = '#f2f7f4';
        g.lineWidth = 1.1 / scale;
        g.beginPath();
        g.arc(x - size * 0.78, y + size * 0.3, size * 0.5, 0, TAU);
        g.moveTo(x + size * 1.28, y + size * 0.3);
        g.arc(x + size * 0.78, y + size * 0.3, size * 0.5, 0, TAU);
        g.moveTo(x - size * 0.78, y + size * 0.3);
        g.lineTo(x - size * 0.2, y - size * 0.4);
        g.lineTo(x + size * 0.45, y - size * 0.4);
        g.lineTo(x + size * 0.78, y + size * 0.3);
        g.moveTo(x - size * 0.2, y - size * 0.4);
        g.lineTo(x + size * 0.05, y + size * 0.3);
        g.lineTo(x - size * 0.78, y + size * 0.3);
        g.moveTo(x + size * 0.45, y - size * 0.4);
        g.lineTo(x + size * 0.35, y - size * 0.7);
        g.stroke();
      }
      g.restore();
    }
    /* DeadEndCity.bikeShare(): the network, and what the player is next to. */
    function bikeShareReport() {
      const stations = bikeStationPlan(),
        near = nearestBikeStation(player.x, player.y, 600);
      return {
        brand: BIKE_SHARE.brand,
        rent: BIKE_SHARE.rent,
        refund: BIKE_SHARE.refund,
        settled: bikeStationsSettled,
        stations: stations.length,
        docks: stations.reduce((n, st) => n + st.n, 0),
        docked: stations.reduce((n, st) => n + dockedBikes(st), 0),
        byKind: stations.reduce((o, st) => ((o[st.kind] = (o[st.kind] || 0) + 1), o), {}),
        skipped: bikeShareLog.skipped.slice(),
        log: { ...bikeShareLog, skipped: undefined },
        cash,
        riding: onShareBike(),
        offer: bikeShareOffer()?.text || null,
        nearest: near
          ? {
              id: near.station.id,
              label: near.station.label,
              metres: Math.round(worldMeters(near.distance)),
              docked: dockedBikes(near.station),
              free: near.station.slots.filter((s) => !s.bike).length,
            }
          : null,
        list: stations.map((st) => ({
          id: st.id,
          kind: st.kind,
          label: st.label,
          serves: st.serves,
          street: st.street,
          x: Math.round(st.x),
          y: Math.round(st.y),
          a: +st.a.toFixed(3),
          docks: st.n,
          docked: dockedBikes(st),
          rack: rackStanding(st),
        })),
      };
    }
    /* Stand the player on a station's walkway, facing the bikes (console, tests). */
    function goToBikeStation(id) {
      const st = bikeStationPlan()[id];
      if (!st) return null;
      if (player.car) exitCar();
      const p = stationPoint(st, 0, BIKE_SHARE.front + 1.2 * SHARE_BIKE_METRE);
      teleportPlayer(p.x, p.y);
      player.a = st.a - Math.PI / 2;
      cameraTarget.x = player.x;
      cameraTarget.y = player.y;
      return { id: st.id, label: st.label, x: Math.round(p.x), y: Math.round(p.y) };
    }
    // END SUBSYSTEM: src/cycles.js
