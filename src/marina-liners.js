    // Harbor Point marina: berths, liners and their voyages (MARINA, LINERS, linerVoyage).
    /**
     * HARBOR POINT
     * The reclamation's north-west shore is cut open into a yacht basin: four
     * finger pontoons off the south quay, sixteen one-of-a-kind boats moored either
     * side, and a club house on the east quay. The superyacht AURELIA lies
     * stern-to the west quay across the head of the basin, with a passerelle down
     * onto her swim platform. East of the basin the cruise terminal takes the whole
     * north apron, with a liner alongside.
     *
     * A liner or the superyacht is a walkable surface rather than scenery.
     * `deckLocal()` puts a world point into a ship's frame (u forward, v to
     * starboard) and while `player.deck` is set the player moves inside that frame
     * instead of on the street grid. Elevation comes from the deck the player is
     * on, so bullets, sight-lines and the renderer all place people on board
     * correctly. Ship dimensions are world units, where 512 units is 100 metres.
     */
    const MARINA = {
      basin: { x: 672, y: -4128, w: 856, h: 828 },
      quay: { x: 640, y: -3300, w: 928, h: 46 },
      club: { x: 1560, y: -3742, w: 148, h: 128 },
      // North of the club: at y -3486 the fuel berth stood in the y -3456 street.
      fuel: { x: 1556, y: -3890, w: 96, h: 54 },
      terminal: { x: 1900, y: -4160, w: 724, h: 128 },
      terminalDoor: { x: 2262, y: -4024 },
      fingers: [760, 960, 1160, 1360].map((x) => ({ x, y: -3760, w: 17, h: 442 })),
      // The east quay between the basin and Commons St is pedestrian: the club,
      // the fuel berth and the jetties stand on it, so no street is laid there
      // (Commons St used to run straight through the club house).
      eastQuay: { x: 1518, y: -4150, w: 198, h: 646 },
    };
    /**
     * HULL FORM
     * One description of a hull's plan shape is shared by the walkable decks and
     * the renderer's lofted hulls, so the rail you walk along is the rail you see.
     * `t` runs from -0.5 (transom) to 0.5 (stem); the result is the deck-edge
     * half-beam as a fraction of the maximum.
     *   transom     stern half-beam as a fraction of the maximum (0 = canoe stern)
     *   maxAt       where along the length the beam is greatest
     *   entry       bow fullness: 1.5 is a fine yacht bow, 3 a bluff freighter
     *   bowShape    1 draws a knife-edge stem in plan, 0.5 a rounded one
     *   sternCurve  how late the quarters start to pull in toward the transom
     */
    function hullPlanFraction(form, t) {
      const m = form.maxAt ?? -0.05;
      if (t <= m) {
        const s = Math.min(1, (m - t) / (m + 0.5));
        return 1 - (1 - (form.transom ?? 0.85)) * Math.pow(s, form.sternCurve ?? 2.4);
      }
      const s = Math.min(1, (t - m) / (0.5 - m));
      return Math.pow(Math.max(0, 1 - Math.pow(s, form.entry ?? 1.8)), form.bowShape ?? 0.75);
    }
    /**
     * Plan outline of a deck level or deckhouse in ship-local (u, v) units: a
     * chamfered aft end, straight sides and a nose `nose` units long shaped as a
     * superellipse (exponent 2 is round, 1.2 is a pointed vee, 4 nearly square).
     * Points go aft-port, aft-starboard, forward along starboard, round the nose
     * and back down the port side.
     */
    function deckOutline(aft, fwd, hw, nose = 0, e = 2, segments = 12, corner = 3) {
      const c = Math.min(corner, hw * 0.4, (fwd - aft) * 0.2),
        pts = [
          [aft, -hw + c],
          [aft, hw - c],
          [aft + c, hw],
        ];
      if (nose <= 0) pts.push([fwd - c, hw], [fwd, hw - c], [fwd, -hw + c], [fwd - c, -hw]);
      else
        for (let i = 0; i <= segments; i++) {
          const th = (i / segments) * Math.PI,
            s = Math.sin(th),
            k = Math.cos(th);
          pts.push([fwd - nose + nose * Math.pow(s, 2 / e), hw * Math.sign(k) * Math.pow(Math.abs(k), 2 / e)]);
        }
      pts.push([aft + c, -hw]);
      return pts;
    }
    function circleOutline(cu, cv, r, segments = 28) {
      return Array.from({ length: segments }, (_, i) => {
        const th = (i / segments) * TAU;
        return [cu + Math.cos(th) * r, cv + Math.sin(th) * r];
      });
    }
    function marinaQuayAt(x, y) {
      const q = MARINA.eastQuay;
      return x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h;
    }
    // Moored boats: [finger index, side, distance along the finger, design]. Every
    // boat is one of a kind; `type` picks its builder in marina3d.js.
    const MARINA_BERTHS = [
      [0, -1, 72, { type: 'sloop', name: 'SEA WHISPER', len: 100, beam: 30, hull: '#f4f2ea', accent: '#1d3f6e' }],
      [0, -1, 284, { type: 'trawler', name: 'SLOW TIDE', len: 102, beam: 32, hull: '#27503f', accent: '#e7dcc0' }],
      [0, 1, 90, { type: 'flybridge', name: 'LA DOLCE VITA', len: 136, beam: 36, hull: '#f5f5f1', accent: '#23364d' }],
      [0, 1, 330, { type: 'launch', name: 'MISS ELEANOR', len: 70, beam: 22, hull: '#7a3f22', accent: '#efe6d0' }],
      [1, -1, 88, { type: 'explorer', name: 'NORTHERN STAR', len: 150, beam: 40, hull: '#2b3136', accent: '#e07a2e' }],
      [1, -1, 300, { type: 'dayCruiser', name: 'SUNCHASER', len: 76, beam: 26, hull: '#f2f2ee', accent: '#c7392f' }],
      [1, 1, 96, { type: 'catamaran', name: 'TWIN TIDES', len: 96, beam: 48, hull: '#f4f4f0', accent: '#2c8a9a' }],
      [1, 1, 300, { type: 'sportfisher', name: 'REEL DEAL', len: 112, beam: 34, hull: '#f3f4f2', accent: '#2a5d8f' }],
      [2, -1, 82, { type: 'ketch', name: 'ALBATROSS', len: 132, beam: 34, hull: '#1b2c4a', accent: '#c8a45a' }],
      [2, -1, 290, { type: 'centerConsole', name: 'BAIT & SWITCH', len: 74, beam: 26, hull: '#dce8ee', accent: '#1f2b33' }],
      [2, 1, 118, { type: 'megayacht', name: 'ORION', len: 180, beam: 44, hull: '#8e979e', accent: '#ecece8' }],
      [2, 1, 330, { type: 'sportYacht', name: 'VELOCE', len: 112, beam: 32, hull: '#17191c', accent: '#dcdcd8' }],
      [3, -1, 86, { type: 'gulet', name: 'ANATOLIA', len: 138, beam: 36, hull: '#7b4628', accent: '#f0e6cc' }],
      [3, -1, 300, { type: 'racer', name: 'BLUE MOON', len: 112, beam: 30, hull: '#2d5f9a', accent: '#e6e6e6' }],
      [3, 1, 92, { type: 'commuter', name: 'GATSBY', len: 112, beam: 28, hull: '#1f3d33', accent: '#b8864f' }],
      [3, 1, 296, { type: 'runabout', name: 'KIWI', len: 66, beam: 24, hull: '#f2c230', accent: '#233040' }],
    ];
    /**
     * Two ships of the same class. The Coral Dawn lies alongside the terminal and
     * is boarded down the gangway. The Meridian Star is under way: she calls at
     * the anchorage off the terminal, where she is boarded from the water by her
     * stern platform, then sails a circuit of the open sea (LINER_VOYAGE).
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
        // Her anchorage in North Sound, clear of the Sunset Pier Bridge (x 3200)
        // to her east; sailLiner() moves her from here.
        x: 2150,
        y: -5000,
        a: 0,
        l: 1360,
        w: 186,
        deck: 44,
        berthed: false,
        // Boarding platform off the stern, at the waterline.
        board: null,
        voyage: true,
      },
    ];
    // @include src/marina-voyage.js
    // A cruise ship's plan: broad transom stern, long parallel body, fine bow.
    const LINER_FORM = { transom: 0.8, maxAt: -0.06, entry: 2.3, bowShape: 0.8, sternCurve: 3.2 };
    const LINER_DECKHOUSES = [
      // [along, across, length, width, height] in ship-local units.
      [-430, 0, 300, 150, 86],
      [-140, 0, 360, 158, 104],
      [210, 0, 250, 146, 78],
      [398, 0, 110, 96, 52],
    ];
    /**
     * THE SUPERYACHT
     * M/Y AURELIA, about 66 metres (aft to fwd), moored stern-to the west quay. Five walkable
     * levels plus the helipad; `levels[i].z` is the deck surface height. Walkable
     * area is each level's outline (the main deck follows the hull plan inside
     * the bulwarks) minus deckhouses, furniture and stair wells. A stair is a
     * rectangle climbing forward from level `lo` at u0 to level `hi` at u1; level
     * -1 is the quay, which makes the passerelle a stair like any other.
     * Furniture drives the renderer, the collisions and where guests sit.
     */
    const SUPERYACHT = {
      id: 'aurelia',
      name: 'M/Y AURELIA',
      x: 970,
      y: -3950,
      a: 0,
      aft: -265,
      fwd: 265,
      beam: 100,
      form: { transom: 0.9, maxAt: -0.08, entry: 1.9, bowShape: 0.78, sternCurve: 2.6 },
      bulwark: 3,
      board: { x: 660, y: -3950 },
      levels: [
        { name: 'SWIM PLATFORM', z: 7, outline: [-282, -238, 42, 0, 2] },
        { name: 'MAIN DECK', z: 26, hull: [-238, 250] },
        { name: 'UPPER DECK', z: 52, outline: [-186, 118, 46, 70, 1.9] },
        { name: 'BRIDGE DECK', z: 78, outline: [-150, 88, 42, 52, 1.8] },
        { name: 'SUN DECK', z: 104, outline: [-110, 52, 38, 34, 1.8] },
        { name: 'HELIPAD', z: 35, circle: [172, 0, 31] },
      ],
      // Deckhouses: solid, except the main saloon whose walls alone are solid and
      // whose aft doors stand open. `rake` pulls the top of the front back.
      houses: [
        { level: 1, outline: [-150, 108, 32, 64, 1.6], open: true, rake: 6, doors: [[-156, -144, -13, 13]] },
        { level: 2, outline: [-112, 90, 34, 50, 1.8], rake: 10 },
        { level: 3, outline: [-72, 80, 30, 44, 1.6], rake: 12, bridge: true },
      ],
      stairs: [
        { lo: -1, hi: 0, u0: -306, u1: -282, v0: -6, v1: 6, gangway: true },
        { lo: 0, hi: 1, u0: -246, u1: -218, v0: 30, v1: 40 },
        { lo: 0, hi: 1, u0: -246, u1: -218, v0: -40, v1: -30 },
        { lo: 1, hi: 2, u0: -182, u1: -156, v0: 21, v1: 31 },
        { lo: 1, hi: 2, u0: -182, u1: -156, v0: -31, v1: -21 },
        { lo: 2, hi: 3, u0: -144, u1: -118, v0: -6, v1: 6 },
        { lo: 3, hi: 4, u0: -104, u1: -80, v0: -28, v1: -18 },
        { lo: 1, hi: 5, u0: 116, u1: 141, v0: -6, v1: 6 },
      ],
      // [level, type, u, v, length along u, width across]
      furniture: [
        [0, 'lounger', -272, -24, 18, 8],
        [0, 'lounger', -272, 24, 18, 8],
        [1, 'pool', -206, 0, 30, 30],
        [1, 'lounger', -206, 22, 20, 8],
        [1, 'lounger', -206, -22, 20, 8],
        [1, 'sofa', -176, 0, 9, 30],
        [1, 'table', -163, 0, 8, 18],
        [1, 'sofa', -128, -24, 26, 8],
        [1, 'sofa', -128, 24, 26, 8],
        [1, 'table', -128, 0, 14, 12],
        [1, 'dining', -70, 0, 40, 26],
        [1, 'bar', 4, -22, 30, 7],
        [1, 'piano', 40, 16, 16, 12],
        [1, 'windlass', 232, 0, 20, 16],
        [2, 'sofa', -178, 0, 8, 36],
        [2, 'table', -165, 0, 10, 20],
        [2, 'lounger', -128, 30, 18, 8],
        [2, 'lounger', -128, -30, 18, 8],
        [3, 'dining', -128, -18, 24, 18],
        [3, 'sofa', -140, 26, 16, 8],
        [3, 'lounger', -92, 26, 18, 8],
        [4, 'jacuzzi', -50, 0, 26, 26],
        [4, 'sunpad', -92, 20, 18, 18],
        [4, 'lounger', -50, 28, 18, 8],
        [4, 'lounger', -50, -28, 18, 8],
        [4, 'lounger', -18, 28, 18, 8],
        [4, 'lounger', -18, -28, 18, 8],
        [4, 'bar', 18, 0, 8, 30],
        [4, 'mast', 40, 0, 10, 12],
      ],
    };
    const SUPERYACHT_GANGWAY = SUPERYACHT.stairs[0];
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
      return (ship.w / 2) * hullPlanFraction(LINER_FORM, clamp(u / ship.l, -0.5, 0.5));
    }
    function superyachtHalfBeam(u) {
      const s = SUPERYACHT,
        length = s.fwd - s.aft,
        t = (u - (s.aft + s.fwd) / 2) / length;
      if (t < -0.5 || t > 0.5) return 0;
      return (s.beam / 2) * hullPlanFraction(s.form, t);
    }
    function shipHull(ship) {
      return { x: ship.x, y: ship.y, hx: ship.l / 2, hy: ship.w / 2, a: ship.a };
    }
    // Sterns carry a boarding platform at the waterline; that is the way aboard.
    function shipPlatform(ship) {
      return deckWorld(ship, -ship.l / 2 - 22, 0);
    }
    function deckPointFree(ship, x, y, r = 7) {
      const { u, v } = deckLocal(ship, x, y);
      return linerDeckFree(ship, u, v, r);
    }
    function moveOnDeck(dx, dy, r) {
      const ship = player.deck;
      if (ship === SUPERYACHT) return moveOnYacht(dx, dy);
      let blocked = false;
      if (deckPointFree(ship, player.x + dx, player.y, r)) player.x += dx;
      else blocked = true;
      if (deckPointFree(ship, player.x, player.y + dy, r)) player.y += dy;
      else blocked = true;
      return blocked;
    }
