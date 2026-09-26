    /**
     * LAND CELL CACHE
     * landAt() is asked hundreds of thousands of times a second (four hull corners
     * per moving car per 1/120 s physics step, every footstep through solid(), the
     * sinking check), and the polygon test was over half of all simulation time.
     * The map is cut into LAND_CELL squares. Cells no coastline or lake edge passes
     * through are uniformly land or water, so their answer is computed once (at the
     * centre, on first use) and remembered; only cells an edge crosses still run the
     * exact polygon test. The coast never changes at runtime, but county.js appends
     * its regions after this file, so the grid is rebuilt if the region count moves.
     */
    const LAND_CELL = 16;
    const landCells = { regions: -1, x0: 0, y0: 0, cols: 0, rows: 0, state: null };
    // state per cell: 0 not yet known, 1 land, 2 water, 3 an edge crosses it (exact test).
    function buildLandCells() {
      const polygons = [...LAND_REGIONS, ...COUNTY_LAKES].map((r) => r.polygon);
      let minx = Infinity,
        miny = Infinity,
        maxx = -Infinity,
        maxy = -Infinity;
      for (const poly of polygons)
        for (const [x, y] of poly) {
          minx = Math.min(minx, x);
          miny = Math.min(miny, y);
          maxx = Math.max(maxx, x);
          maxy = Math.max(maxy, y);
        }
      const c = landCells;
      c.regions = LAND_REGIONS.length + COUNTY_LAKES.length;
      c.x0 = Math.floor(minx / LAND_CELL) - 2;
      c.y0 = Math.floor(miny / LAND_CELL) - 2;
      c.cols = Math.ceil(maxx / LAND_CELL) - c.x0 + 3;
      c.rows = Math.ceil(maxy / LAND_CELL) - c.y0 + 3;
      c.state = new Uint8Array(c.cols * c.rows);
      // Flag every cell an edge touches: test each cell in the edge's bounding box
      // (grown by a unit for rounding) against the segment with a separating-axis check.
      for (const poly of polygons)
        for (let i = 0; i < poly.length; i++) {
          const [ax, ay] = poly[i],
            [bx, by] = poly[(i + 1) % poly.length],
            nx = ay - by,
            ny = bx - ax,
            c0 = Math.floor((Math.min(ax, bx) - 1) / LAND_CELL),
            c1 = Math.floor((Math.max(ax, bx) + 1) / LAND_CELL),
            r0 = Math.floor((Math.min(ay, by) - 1) / LAND_CELL),
            r1 = Math.floor((Math.max(ay, by) + 1) / LAND_CELL);
          for (let col = c0; col <= c1; col++)
            for (let row = r0; row <= r1; row++) {
              // The segment's line crosses the (slightly grown) box when the box
              // corners do not all lie on one side of it.
              const x = col * LAND_CELL - 1,
                y = row * LAND_CELL - 1,
                size = LAND_CELL + 2;
              let above = 0,
                below = 0;
              for (const [px, py] of [
                [x, y],
                [x + size, y],
                [x, y + size],
                [x + size, y + size],
              ]) {
                const side = (px - ax) * nx + (py - ay) * ny;
                if (side >= 0) above++;
                if (side <= 0) below++;
              }
              if (above && below) c.state[(row - c.y0) * c.cols + col - c.x0] = 3;
            }
        }
    }
    function landAt(x, y) {
      const c = landCells;
      if (c.regions !== LAND_REGIONS.length + COUNTY_LAKES.length) buildLandCells();
      const col = Math.floor(x / LAND_CELL) - c.x0,
        row = Math.floor(y / LAND_CELL) - c.y0;
      // Outside every polygon's bounds there is only sea.
      if (col < 0 || row < 0 || col >= c.cols || row >= c.rows) return false;
      const i = row * c.cols + col,
        s = c.state[i];
      if (s === 1) return true;
      if (s === 2) return false;
      if (s === 3) return landAtExact(x, y);
      const land = landAtExact((col + c.x0 + 0.5) * LAND_CELL, (row + c.y0 + 0.5) * LAND_CELL);
      c.state[i] = land ? 1 : 2;
      return land;
    }
    function inAirport(x, y) {
      return (y > 4120 && y < 5632 && x > 40 && x < 1400) || (y >= 5632 && y < 8300 && x > 150 && x < 800);
    }
    function segmentDistance(x, y, a, b) {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
      return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
    }
    function onBoulevard(x, y, margin = 0) {
      return BOULEVARDS.some((r) =>
        r.points.some((p, i) => i && segmentDistance(x, y, r.points[i - 1], p) < r.width / 2 + margin),
      );
    }
    function landRect(x, y, w, h) {
      return [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x + w / 2, y + h / 2],
      ].every((p) => landAt(...p));
    }
    /**
     * BRIDGES
     * Every road bridge in the world, as a straight deck from `a` to `b`
     * (map points) `width` wide. Decks are at road level (`deck`: 0, the same
     * surface height as the quays they land on); boats pass under them and only
     * the pylons (bridgePylons) stand in the water. Guard rails line the deck
     * wherever it is over water (countyBridgeRails, county.js). A deck on a
     * city grid line carries that street across (cityStreets treats bridge
     * decks as ground), so Union St and Harbor Ave run on from Palm Keys to
     * Northbank; county roads join at the ends through the route graph.
     * `link` names the two shores; `id` is stable for other code and the docs.
     *
     * Palm Sound (Palm Keys - Northbank, ~1200 of water):
     *   keys-union   Union St at y 1152, x -1460..130
     *   keys-harbor  Harbor Ave at y 3200, x -1460..130
     * Marlow Bay (Northbank - Ridgeline, ~2400..2700 of water):
     *   east-bay     Harbor Ave at y 3200, x 3150..6580, onto the Ridgeline Hwy
     *   south-bay    Stadium Way at y 4736, x 3150..6420, onto Foothill Rd
     * North Sound (Northbank - Sunset Pier island, ~1700 of water):
     *   pier-bridge  Riverbank Dr at x 3200, y -3900..-5800
     * South channel and the county: oceanview (Northbank - Oceanview), coral
     * sound, ridgeline viaduct, sentinel causeway.
     *
     * `style` picks each bridge's architecture (BRIDGE_DESIGNS below): where its
     * piers, towers, cables and navigation channels are. The renderer
     * (bridges3d.js), aircraft collision (county.js) and the boats (boatFits)
     * all read that one description.
     */
    const BRIDGES = [
      {
        id: 'keys-union',
        style: 'truss',
        name: 'KEYS BRIDGE',
        link: 'PALM KEYS - NORTHBANK',
        width: 112,
        deck: 0,
        a: [-1460, 1152],
        b: [130, 1152],
      },
      {
        id: 'keys-harbor',
        style: 'bascule',
        // A working drawbridge: its leaves open on a timetable (drawbridge.js).
        movable: true,
        name: 'PALM SOUND CAUSEWAY',
        link: 'PALM KEYS - NORTHBANK',
        width: 112,
        deck: 0,
        a: [-1460, 3200],
        b: [130, 3200],
      },
      {
        id: 'east-bay',
        style: 'cablestay',
        name: 'EAST BAY CROSSING',
        link: 'NORTHBANK - RIDGELINE',
        width: 122,
        deck: 0,
        a: [3150, 3200],
        b: [6580, 3200],
      },
      {
        id: 'south-bay',
        style: 'suspension',
        name: 'SOUTH BAY BRIDGE',
        link: 'NORTHBANK - RIDGELINE',
        width: 112,
        deck: 0,
        a: [3150, 4736],
        b: [6420, 4736],
      },
      {
        id: 'pier-bridge',
        style: 'arch',
        name: 'SUNSET PIER BRIDGE',
        link: 'NORTHBANK - SUNSET PIER',
        width: 104,
        deck: 0,
        a: [3200, -3900],
        b: [3200, -5800],
      },
      {
        // Leaves Northbank from the south end of Riverbank Dr down the Battery
        // Point sea wall and lands on Oceanview's east avenue where Beach Road
        // starts.
        id: 'oceanview',
        style: 'segmental',
        name: 'OCEANVIEW CAUSEWAY',
        link: 'NORTHBANK - OCEANVIEW',
        width: 128,
        deck: 0,
        a: [3200, 5000],
        b: [3200, 7010],
      },
      {
        id: 'coral-sound',
        style: 'extradosed',
        name: 'CORAL SOUND BRIDGE',
        link: 'OCEANVIEW - CORAL COAST',
        width: 116,
        deck: 0,
        a: [5700, 8000],
        b: [6750, 8000],
      },
      {
        id: 'ridgeline',
        style: 'hpylon',
        name: 'RIDGELINE VIADUCT',
        link: 'RIDGELINE - CORAL COAST',
        width: 116,
        deck: 0,
        a: [7800, 5620],
        b: [7433.016, 7262.254],
      },
      {
        id: 'sentinel',
        style: 'swing',
        name: 'SENTINEL CAUSEWAY',
        link: 'CORAL COAST - FORT SENTINEL',
        width: 126,
        deck: 0,
        a: [7800, 8150],
        b: [9440, 8150],
      },
    ];
    function bridgeFrame(bridge) {
      if (bridge.frame) return bridge.frame;
      const dx = bridge.b[0] - bridge.a[0],
        dy = bridge.b[1] - bridge.a[1],
        length = Math.hypot(dx, dy);
      return (bridge.frame = { length, a: Math.atan2(dy, dx), ux: dx / length, uy: dy / length });
    }
    /**
     * BRIDGE ARCHITECTURE
     * bridgeStructure(bridge) lays out a bridge's design in its own frame:
     * `along` is the distance from the middle of the deck toward `b`, `across`
     * the offset to the right of a -> b (a map point is bridgePoint()). It is
     * built once from the style's rule in BRIDGE_DESIGNS and the stretch of the
     * deck that is over water, so a bridge follows its shores if they move.
     *   water     [from, to]: the longest run of the deck over water
     *   channels  [[from, to], ...]: navigation spans, clear of every footing
     *   footings  what stands in the water: piers under the deck, the bases of
     *             towers, arch feet, anchorages and fenders, as boxes
     *             {along, across, hx, hy} (half extents along and across the
     *             deck). Boats steer round them (they pass under the deck
     *             between them); the renderer draws them and their foam.
     *   solids    what rises from or spans over the deck: tower legs, portals,
     *             cable fans, arches and trusses, as boxes {along, across, hx,
     *             hy, minHeight, height} for aircraft. Anything over the
     *             carriageway starts at minHeight 46 or higher, clear of the
     *             tallest road vehicle (32).
     *   ...the style's own dimensions for the renderer (tower heights, cable
     *   anchor points, the arch rise, span lengths).
     * Heights are above the deck (road level, 0).
     */
    const BRIDGE_CLEARANCE = 46;
    function bridgePoint(bridge, along, across = 0) {
      const f = bridgeFrame(bridge),
        cx = (bridge.a[0] + bridge.b[0]) / 2 + f.ux * along,
        cy = (bridge.a[1] + bridge.b[1]) / 2 + f.uy * along;
      return { x: cx - f.uy * across, y: cy + f.ux * across };
    }
    // The longest stretch of the centre line over water, in `along` units.
    function bridgeWaterSpan(bridge) {
      const f = bridgeFrame(bridge);
      let best = [0, 0],
        start = null;
      for (let s = 0; s <= f.length + 8; s += 8) {
        const t = Math.min(s, f.length),
          wet = s <= f.length && !landAt(bridge.a[0] + f.ux * t, bridge.a[1] + f.uy * t);
        if (wet && start === null) start = t;
        if (!wet && start !== null) {
          if (t - 8 - start > best[1] - best[0]) best = [start, t - 8];
          start = null;
        }
      }
      return [best[0] - f.length / 2, best[1] - f.length / 2];
    }
    // Evenly spaced approach piers between a main structure at `from` and the
    // shore at `to` (exclusive of both ends: the shore end is an abutment).
    function approachPiers(from, to, spacing) {
      const n = Math.max(1, Math.round(Math.abs(to - from) / spacing)),
        step = (to - from) / n,
        list = [];
      for (let k = 1; k < n; k++) list.push(from + step * k);
      return list;
    }
    // A cable fan, arch or truss over the deck as a run of aircraft boxes, each
    // as tall as the highest point of the envelope along it.
    function spanSolids(list, from, to, heightAt, halfWidth, kind, step = 60) {
      const n = Math.max(1, Math.ceil(Math.abs(to - from) / step)),
        d = (to - from) / n;
      for (let k = 0; k < n; k++) {
        const s0 = from + d * k,
          s1 = s0 + d,
          height = Math.max(heightAt(s0), heightAt((s0 + s1) / 2), heightAt(s1));
        if (height > BRIDGE_CLEARANCE + 4)
          list.push({ along: (s0 + s1) / 2, across: 0, hx: Math.abs(d) / 2, hy: halfWidth, minHeight: BRIDGE_CLEARANCE, height, kind });
      }
    }
    const BRIDGE_DESIGNS = {
      /* Keys Bridge: a steel through-truss. A camel-back main span over the
         channel between two side spans on four river piers, concrete approach
         spans to the shores. */
      truss(bridge, [w0, w1], m, s) {
        const W = bridge.width,
          main = 200,
          side = 220;
        s.truss = { ends: [m - main - side, m + main + side], piers: [m - main - side, m - main, m + main, m + main + side], plane: W / 2 + 4 };
        // Top chord: 72 over the river piers rising to 112 mid-channel, 54 at the ends.
        s.chord = (along) => {
          const d = Math.abs(along - m);
          return d <= main ? 72 + 40 * (1 - (d / main) ** 2) : 72 - (18 * Math.min(side, d - main)) / side;
        };
        s.channels = [[m - main + 18, m + main - 18]];
        for (const p of s.truss.piers) s.footings.push({ along: p, across: 0, hx: 16, hy: W / 2 + 12, kind: 'river pier' });
        s.approach = [...approachPiers(s.truss.ends[0], w0, 140), ...approachPiers(s.truss.ends[1], w1, 140)];
        spanSolids(s.solids, s.truss.ends[0], s.truss.ends[1], s.chord, W / 2 + 7, 'truss');
        // The truss walls along both edges, from the deck up.
        for (const side2 of [-1, 1])
          s.solids.push({ along: m, across: side2 * s.truss.plane, hx: main + side, hy: 3, minHeight: 0, height: 56, kind: 'truss' });
      },
      /* Palm Sound Causeway: a low concrete causeway with a working double-leaf
         trunnion bascule over the channel (drawbridge.js opens it; drawbridge3d.js
         draws it). Two 44 m leaves (88 m trunnion to trunnion, on the scale of
         Chicago's longest double-leaf bascules) swing about trunnions `drop`
         below the road. Each stands on a massive pier: its nose (`toe`) runs
         under the leaf's heel, and behind the trunnion (`tail`) two open
         counterweight pits flank the fixed deck, one each side, where the
         counterweights on the leaf's outboard main girders swing down as it
         rises. Beyond the pits the platforms carry the tender's houses, the
         south-east one the control house. Timber fenders guard the channel up
         and down from the pier noses; the gate and stop lines stand on the
         approach spans behind the piers. */
      bascule(bridge, [w0, w1], m, s) {
        const W = bridge.width,
          half = W / 2,
          leaf = 44 * UNITS_PER_METRE,
          tail = 116,
          toe = 40,
          // Across: the fixed deck's edge (half + 2), the pit out to half + 72,
          // its outer wall, then the house platform out to `wide`.
          wide = half + 116,
          pier = tail + toe;
        s.bascule = {
          leaf,
          drop: 16,
          tail,
          toe,
          pier,
          wide,
          // The pits, from the trunnion: back and front walls along, inner and
          // outer walls across, the floor below the road.
          pit: { inner: half + 2, outer: half + 72, back: tail - 6, front: toe - 4, depth: 136 },
          trunnions: [m - leaf, m + leaf],
          piers: [m - leaf - (tail - toe) / 2, m + leaf + (tail - toe) / 2],
          gates: [m - leaf - tail - 26, m + leaf + tail + 26],
          stops: [m - leaf - tail - 44, m + leaf + tail + 44],
          houses: [],
          fenders: [],
        };
        s.channels = [[m - leaf + toe + 8, m + leaf - toe - 8]];
        s.bascule.piers.forEach((p, i) => {
          s.footings.push({ along: p, across: 0, hx: pier / 2 + 1, hy: wide, kind: 'bascule pier' });
          for (const side of [-1, 1]) {
            const main = i === 1 && side > 0;
            s.bascule.houses.push({ along: p, across: side * (half + 96), main });
            s.solids.push({ along: p, across: side * (half + 96), hx: main ? 17 : 12, hy: main ? 12 : 10, minHeight: 0, height: main ? 64 : 48, kind: main ? 'control house' : 'tender house' });
            const face = i ? m + leaf - toe + 4 : m - leaf + toe - 4;
            s.bascule.fenders.push({ along: face, across: side * (wide + 82) });
            s.footings.push({ along: face, across: side * (wide + 82), hx: 3, hy: 80, kind: 'fender' });
          }
        });
        s.approach = [...approachPiers(m - leaf - tail, w0, 110), ...approachPiers(m + leaf + tail, w1, 110)];
      },
      /* East Bay Crossing: a white cable-stayed bridge on a single A-pylon in
         mid-bay, two fans of stays to each edge of the deck, two navigation
         channels either side of the pylon. */
      cablestay(bridge, [w0, w1], m, s) {
        const W = bridge.width,
          reach = 780,
          height = 380;
        s.pylon = { along: m, height, legBase: W / 2 + 28, headFrom: 252, reach, first: 70, stays: 16 };
        s.channels = [
          [m - reach + 10, m - 52],
          [m + 52, m + reach - 10],
        ];
        s.footings.push({ along: m, across: 0, hx: 36, hy: W / 2 + 48, kind: 'pylon footing' });
        for (const dir of [-1, 1]) s.footings.push({ along: m + dir * (reach + 22), across: 0, hx: 12, hy: W / 2 + 6, kind: 'back pier' });
        s.approach = [...approachPiers(m - reach - 22, w0, 170), ...approachPiers(m + reach + 22, w1, 170)];
        for (const side of [-1, 1])
          s.solids.push({ along: m, across: side * s.pylon.legBase, hx: 14, hy: 14, minHeight: 0, height: 150, kind: 'pylon' });
        s.solids.push({ along: m, across: 0, hx: 14, hy: W / 2 + 30, minHeight: BRIDGE_CLEARANCE + 50, height: height + 12, kind: 'pylon' });
        const fan = (along) => 24 + (height - 16) * Math.max(0, 1 - Math.abs(along - m) / (reach + 10));
        spanSolids(s.solids, m - reach - 10, m - 16, fan, W / 2 + 4, 'stays');
        spanSolids(s.solids, m + 16, m + reach + 10, fan, W / 2 + 4, 'stays');
      },
      /* South Bay Bridge: a red suspension bridge. Two towers either side of the
         channel, main cables from anchorages at each shore sagging to just over
         the deck mid-span, hangers down to both edges. */
      suspension(bridge, [w0, w1], m, s) {
        const W = bridge.width,
          half = 560,
          top = 316,
          low = 16;
        s.towers = { at: [m - half, m + half], top, legs: W / 2 + 17, struts: [118, 206, 292] };
        s.anchorages = [w0 + 90, w1 - 90];
        s.cable = (along) => {
          const d = along - m;
          if (Math.abs(d) <= half) return low + (top - 6 - low) * (d / half) ** 2;
          const anchor = d < 0 ? s.anchorages[0] : s.anchorages[1],
            t = clamp((along - anchor) / (m + Math.sign(d) * half - anchor), 0, 1);
          return 24 + (top - 6 - 24) * t ** 1.5;
        };
        s.channels = [[m - half + 34, m + half - 34]];
        for (const at of s.towers.at) {
          s.footings.push({ along: at, across: 0, hx: 30, hy: W / 2 + 44, kind: 'tower caisson' });
          for (const side of [-1, 1])
            s.solids.push({ along: at, across: side * s.towers.legs, hx: 12, hy: 12, minHeight: 0, height: top + 6, kind: 'tower' });
          s.solids.push({ along: at, across: 0, hx: 9, hy: W / 2 + 18, minHeight: s.towers.struts[0] - 10, height: top + 6, kind: 'tower' });
        }
        for (const at of s.anchorages) {
          s.footings.push({ along: at, across: 0, hx: 60, hy: W / 2 + 44, kind: 'anchorage' });
          for (const side of [-1, 1])
            s.solids.push({ along: at, across: side * (W / 2 + 26), hx: 56, hy: 18, minHeight: 0, height: 46, kind: 'anchorage' });
        }
        s.approach = [...approachPiers(s.anchorages[0], w0, 150), ...approachPiers(s.anchorages[1], w1, 150)];
        spanSolids(s.solids, s.anchorages[0], s.anchorages[1], s.cable, W / 2 + 18, 'cables');
      },
      /* Sunset Pier Bridge: a sleek basket-handle steel arch, its two ribs leaning
         in to meet over the crown, hangers to both edges, LED-lit at night. */
      arch(bridge, [w0, w1], m, s) {
        const W = bridge.width,
          half = 520,
          rise = 244;
        s.arch = { from: m - half, to: m + half, rise, foot: W / 2 + 24, crown: 10 };
        s.archHeight = (along) => rise * Math.max(0, 1 - ((along - m) / half) ** 2);
        s.channels = [[m - half + 34, m + half - 34]];
        for (const dir of [-1, 1]) {
          s.footings.push({ along: m + dir * half, across: 0, hx: 40, hy: W / 2 + 54, kind: 'arch foot' });
          for (const side of [-1, 1])
            s.solids.push({ along: m + dir * (half - 30), across: side * s.arch.foot, hx: 34, hy: 14, minHeight: 0, height: 96, kind: 'arch' });
        }
        s.approach = [...approachPiers(m - half, w0, 150), ...approachPiers(m + half, w1, 150)];
        spanSolids(s.solids, m - half, m + half, (along) => s.archHeight(along) + 10, W / 2 + 26, 'arch');
      },
      /* Oceanview Causeway: a long, low precast viaduct on hammerhead piers with
         a deeper haunched girder over the navigation span. */
      segmental(bridge, [w0, w1], m, s) {
        const W = bridge.width,
          half = 150;
        s.navigation = [m - half, m + half];
        s.channels = [[m - half + 16, m + half - 16]];
        for (const p of s.navigation) s.footings.push({ along: p, across: 0, hx: 14, hy: W / 2 + 12, kind: 'main pier' });
        s.approach = [...approachPiers(m - half, w0, 130), ...approachPiers(m + half, w1, 130)];
      },
      /* Coral Sound Bridge: extradosed. Four short sail-shaped pylons at the deck
         edges and flat harps of stays fanning both ways. */
      extradosed(bridge, [w0, w1], m, s) {
        const W = bridge.width,
          half = 150,
          height = 116;
        s.sails = { at: [m - half, m + half], height, across: W / 2 + 9, reach: 150 };
        s.channels = [[m - half + 30, m + half - 30]];
        for (const at of s.sails.at) {
          s.footings.push({ along: at, across: 0, hx: 26, hy: W / 2 + 30, kind: 'pylon footing' });
          for (const side of [-1, 1])
            s.solids.push({ along: at, across: side * s.sails.across, hx: 10, hy: 7, minHeight: 0, height: height + 6, kind: 'pylon' });
        }
        s.approach = [...approachPiers(m - half, w0, 110), ...approachPiers(m + half, w1, 110)];
      },
      /* Ridgeline Viaduct: cable-stayed on two concrete H-pylons, semi-harp stays,
         a weathering-steel box girder. */
      hpylon(bridge, [w0, w1], m, s) {
        const W = bridge.width,
          half = 250,
          height = 250,
          reach = 230;
        s.hpylons = { at: [m - half, m + half], height, legs: W / 2 + 15, reach, first: 36, stays: 9, beam: 222 };
        s.channels = [[m - half + 30, m + half - 30]];
        for (const at of s.hpylons.at) {
          s.footings.push({ along: at, across: 0, hx: 26, hy: W / 2 + 36, kind: 'pylon footing' });
          for (const side of [-1, 1])
            s.solids.push({ along: at, across: side * s.hpylons.legs, hx: 11, hy: 11, minHeight: 0, height: height + 6, kind: 'pylon' });
          s.solids.push({ along: at, across: 0, hx: 9, hy: W / 2 + 16, minHeight: s.hpylons.beam - 12, height: s.hpylons.beam + 14, kind: 'pylon' });
          const fan = (along) => 22 + (height - 40) * Math.max(0, 1 - Math.abs(along - at) / (reach + 10));
          spanSolids(s.solids, at - reach - 10, at - 14, fan, W / 2 + 4, 'stays');
          spanSolids(s.solids, at + 14, at + reach + 10, fan, W / 2 + 4, 'stays');
        }
        s.approach = [...approachPiers(m - half, w0, 150), ...approachPiers(m + half, w1, 150)].filter(
          (p) => Math.abs(Math.abs(p - m) - half) > 40,
        );
      },
      /* Sentinel Causeway: an olive-drab military causeway of steel plate girders
         with a swing span on a pivot pier; its long fender guards the two
         channels either side, floodlight masts at the rest piers. */
      swing(bridge, [w0, w1], m, s) {
        const W = bridge.width,
          half = 130;
        s.swing = { pivot: m, half, rests: [m - half, m + half], fender: 132 };
        s.channels = [
          [m - half + 16, m - 34],
          [m + 34, m + half - 16],
        ];
        s.footings.push({ along: m, across: 0, hx: 26, hy: s.swing.fender, kind: 'pivot pier' });
        for (const p of s.swing.rests) {
          s.footings.push({ along: p, across: 0, hx: 12, hy: W / 2 + 8, kind: 'rest pier' });
          for (const side of [-1, 1])
            s.solids.push({ along: p, across: side * (W / 2 + 6), hx: 3, hy: 3, minHeight: 0, height: 96, kind: 'floodlight' });
        }
        s.solids.push({ along: m, across: -(W / 2 + 40), hx: 16, hy: 14, minHeight: 0, height: 54, kind: 'control house' });
        s.approach = [...approachPiers(m - half, w0, 100), ...approachPiers(m + half, w1, 100)];
      },
    };
    function bridgeStructure(bridge) {
      if (bridge.structure) return bridge.structure;
      const water = bridgeWaterSpan(bridge),
        m = Math.round((water[0] + water[1]) / 2),
        s = { style: bridge.style, water, middle: m, channels: [], footings: [], solids: [], approach: [] };
      BRIDGE_DESIGNS[bridge.style](bridge, water, m, s);
      // Approach piers are plain bents under the deck, wherever they stand in water.
      s.approach = s.approach.filter((along) => !landAt(bridgePoint(bridge, along).x, bridgePoint(bridge, along).y));
      for (const along of s.approach) s.footings.push({ along, across: 0, hx: 6, hy: bridge.width / 2 + 4, kind: 'approach pier' });
      return (bridge.structure = s);
    }
    // A structure box on the map: an oriented box with the bridge's heading.
    function bridgeBox(bridge, b) {
      const p = bridgePoint(bridge, b.along, b.across);
      return { ...b, x: p.x, y: p.y, a: bridgeFrame(bridge).a };
    }
