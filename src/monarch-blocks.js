    function planIsleBlock(plan, random) {
      const B = plan.block,
        push = (x, y, w, h, height, extra = {}) => {
          const b = isleBuilding(Math.round(x), Math.round(y), Math.round(w), Math.round(h), Math.round(height), { block: plan.key, ...extra });
          plan.parts.push(b);
          return b;
        },
        frontDepth = 150;
      // Blocks at a roundabout lose the corner the ring's pavement needs.
      const circleCorner = ISLE_CIRCLES.map((c) => ({
        c,
        corner: [
          [B.x, B.y],
          [B.x + B.w, B.y],
          [B.x, B.y + B.h],
          [B.x + B.w, B.y + B.h],
        ].find(([x, y]) => Math.hypot(x - c.x, y - c.y) < c.walk + 60),
      })).find((o) => o.corner);
      plan.circleCorner = circleCorner ? { x: circleCorner.corner[0], y: circleCorner.corner[1], circle: circleCorner.c } : null;
      const keepCorner = (x, y, w, h) => {
        // Trim a rectangle away from a roundabout corner (keeps 70 clear of the ring's pavement).
        if (!plan.circleCorner) return { x, y, w, h };
        const k = plan.circleCorner,
          clearance = k.circle.walk + 24;
        const cx = Math.max(x, Math.min(k.circle.x, x + w)),
          cy = Math.max(y, Math.min(k.circle.y, y + h));
        if (Math.hypot(cx - k.circle.x, cy - k.circle.y) >= clearance) return { x, y, w, h };
        // Shrink along the side facing the ring.
        const dx = k.x === B.x ? 1 : -1,
          dy = k.y === B.y ? 1 : -1,
          cut = clearance - Math.hypot(cx - k.circle.x, cy - k.circle.y) + 12;
        return dx > 0 ? { x: x + cut, y, w: w - cut, h } : { x, y, w: w - cut, h };
      };
      const frontage = (units, height, options = {}) => {
        // Shop units along the south face, west to east, each its own building.
        const y = B.y + B.h - frontDepth;
        let x = B.x + (options.inset || 0);
        const out = [];
        for (const u of units) {
          let r = keepCorner(x, y, u.width, frontDepth);
          const b = push(r.x, r.y, r.w, r.h, height + (u.extraHeight || 0), { shop: u.name, trade: u.trade, archetype: 'stucco', front: 'south', facade: options.facade || 'limestone' });
          u.building = b;
          u.door = { x: r.x + r.w / 2, y: r.y + r.h + 10 };
          monarchPlan.shops.push(u);
          out.push(b);
          x += u.width + (options.gap || 0);
        }
        return out;
      };
      const shopsIn = (key) => MONARCH_BUSINESSES.filter((s) => s.block[0] + ',' + s.block[1] === key).sort((a, b) => a.slot - b.slot);
      const mansionRow = (x0, x1, y, depth, count, height, extra = {}) => {
        // A terrace of town houses (one building each), south fronts.
        const w = (x1 - x0) / count;
        for (let k = 0; k < count; k++) push(x0 + k * w + 2, y, w - 4, depth, height + (k % 3) * 6, { archetype: 'stucco', facade: extra.facade || 'townhouse', front: 'south', ...extra });
      };
      switch (plan.use) {
        case 'countryclub': {
          // The clubhouse on Crown Avenue; courts, a pool and the putting green behind.
          const club = shopsIn(plan.key)[0];
          club.building = push(B.x + 120, B.y + B.h - 190, 380, 150, 44, { shop: club.name, trade: club.trade, facade: 'clubhouse', front: 'south' });
          club.door = { x: B.x + 310, y: B.y + B.h - 30 };
          monarchPlan.shops.push(club);
          plan.courts = [
            { x: B.x + 30, y: B.y + 40, w: 110, h: 200 },
            { x: B.x + 160, y: B.y + 40, w: 110, h: 200 },
          ];
          for (const t of plan.courts) {
            isleSolid(t.x - 6, t.y - 6, t.w + 12, 2, 14, 'fence');
            isleSolid(t.x - 6, t.y + t.h + 4, t.w + 12, 2, 14, 'fence');
            isleSolid(t.x - 6, t.y - 6, 2, t.h + 12, 14, 'fence');
            isleSolid(t.x + t.w + 4, t.y - 6, 2, t.h + 12, 14, 'fence');
          }
          plan.pool = { x: B.x + 320, y: B.y + 60, w: 180, h: 70 };
          isleSolid(plan.pool.x, plan.pool.y, plan.pool.w, plan.pool.h, 2, 'pool');
          plan.green = { x: B.x + 300, y: B.y + 190, w: 300, h: 210 };
          break;
        }
        case 'arcade': {
          frontage(shopsIn(plan.key), isleFloors(3), { facade: 'arcade' });
          // St Aldric's Chapel behind, on its own green; its door faces south down the green.
          plan.chapel = { x: B.x + 190, y: B.y + 60, w: 120, h: 210 };
          push(plan.chapel.x, plan.chapel.y, plan.chapel.w, plan.chapel.h, 58, { chapel: true, style: 2, facade: 'chapel', front: 'south' });
          plan.residence = push(B.x + 400, B.y + 40, 190, 230, isleFloors(4), { facade: 'mansion', front: 'south' });
          break;
        }
        case 'towerSovereign': {
          frontage(shopsIn(plan.key), isleFloors(2), { facade: 'podium', inset: 150 });
          plan.tower = MONARCH_TOWERS[0];
          planIslePlaza(plan);
          break;
        }
        case 'towerMonarch': {
          const bank = shopsIn(plan.key)[0];
          frontage([bank], isleFloors(2), { facade: 'bank', inset: 170 });
          plan.tower = MONARCH_TOWERS[1];
          planIslePlaza(plan);
          break;
        }
        case 'provisions': {
          frontage(shopsIn(plan.key), isleFloors(3), { facade: 'arcade', inset: 8 });
          // A courtyard of apartments behind.
          push(B.x + 40, B.y + 50, 250, 150, isleFloors(5), { facade: 'mansion', front: 'south' });
          push(B.x + 340, B.y + 50, 250, 150, isleFloors(5), { facade: 'mansion', front: 'south' });
          break;
        }
        case 'clinic': {
          const [clinic, spa] = shopsIn(plan.key);
          clinic.building = push(B.x + 20, B.y + B.h - 210, clinic.width, 190, isleFloors(4), { shop: clinic.name, trade: clinic.trade, facade: 'clinic', front: 'south' });
          clinic.door = { x: B.x + 20 + clinic.width / 2, y: B.y + B.h - 10 };
          spa.building = push(B.x + 364, B.y + B.h - 170, spa.width, 150, isleFloors(2), { shop: spa.name, trade: spa.trade, facade: 'spa', front: 'south' });
          spa.door = { x: B.x + 364 + spa.width / 2, y: B.y + B.h - 10 };
          monarchPlan.shops.push(clinic, spa);
          plan.garden = { x: B.x + 364, y: B.y + 60, w: 240, h: 300 };
          push(B.x + 20, B.y + 40, 300, 150, isleFloors(3), { facade: 'mansion', front: 'south' });
          break;
        }
        case 'motors': {
          // MONARCH MOTORS, the flagship dealership, takes the whole block (dealership.js).
          planDealership(plan, B);
          break;
        }
        case 'academy': {
          const school = shopsIn(plan.key)[0];
          school.building = push(B.x + 40, B.y + B.h - 190, 360, 170, isleFloors(3), { shop: school.name, trade: school.trade, facade: 'academy', front: 'south', style: 2 });
          school.door = { x: B.x + 220, y: B.y + B.h - 10 };
          monarchPlan.shops.push(school);
          plan.field = { x: B.x + 40, y: B.y + 36, w: 360, h: 220 };
          plan.hall = push(B.x + 440, B.y + 40, 150, 380, isleFloors(2), { facade: 'academy', front: 'south', style: 2 });
          break;
        }
        case 'etoile': {
          const [etoile, hotel] = shopsIn(plan.key);
          etoile.building = push(B.x + 20, B.y + B.h - 150, etoile.width, 130, isleFloors(2), { shop: etoile.name, trade: etoile.trade, facade: 'restaurant', front: 'south' });
          etoile.door = { x: B.x + 20 + etoile.width / 2, y: B.y + B.h - 10 };
          hotel.building = push(B.x + 300, B.y + B.h - 250, hotel.width, 230, isleFloors(7), { shop: hotel.name, trade: hotel.trade, facade: 'hotel', front: 'south' });
          hotel.door = { x: B.x + 300 + hotel.width / 2, y: B.y + B.h - 10 };
          monarchPlan.shops.push(etoile, hotel);
          plan.courtyard = { x: B.x + 20, y: B.y + 40, w: 250, h: 260 };
          push(B.x + 300, B.y + 40, 300, 150, isleFloors(4), { facade: 'mansion', front: 'south' });
          break;
        }
        case 'townhouses':
          mansionRow(B.x + 10, B.x + B.w - 10, B.y + B.h - 160, 140, 6, isleFloors(3));
          mansionRow(B.x + 10, B.x + B.w - 10, B.y + 60, 140, 5, isleFloors(3), { facade: 'townhouseBrick' });
          plan.gardens = { x: B.x + 10, y: B.y + 220, w: B.w - 20, h: B.h - 400 };
          break;
        case 'residences':
          push(B.x + 30, B.y + B.h - 190, 250, 170, isleFloors(6), { facade: 'mansion', front: 'south' });
          push(B.x + 340, B.y + B.h - 190, 250, 170, isleFloors(5), { facade: 'mansionLight', front: 'south' });
          push(B.x + 30, B.y + 40, 560, 140, isleFloors(4), { facade: 'mansion', front: 'south' });
          plan.garden = { x: B.x + 30, y: B.y + 210, w: 560, h: 190 };
          break;
        case 'residencesCircle': {
          const r1 = keepCorner(B.x, B.y + B.h - 200, 280, 180);
          push(r1.x, r1.y, r1.w, r1.h, isleFloors(5), { facade: 'mansionLight', front: 'south' });
          push(B.x + 320, B.y + B.h - 200, 270, 180, isleFloors(6), { facade: 'mansion', front: 'south' });
          push(B.x + 30, B.y + 40, 560, 150, isleFloors(4), { facade: 'mansionLight', front: 'south' });
          plan.garden = { x: B.x + 30, y: B.y + 220, w: 560, h: 170 };
          break;
        }
        case 'harbourfront':
          frontage(shopsIn(plan.key), isleFloors(5), { facade: 'harbour' });
          push(B.x + 20, B.y + 40, 280, 240, isleFloors(6), { facade: 'mansionLight', front: 'south' });
          push(B.x + 330, B.y + 40, 270, 240, isleFloors(7), { facade: 'mansion', front: 'south' });
          break;
        case 'chandlery':
          frontage(shopsIn(plan.key), isleFloors(4), { facade: 'harbour', inset: 12, gap: 8 });
          push(B.x + 20, B.y + 40, 580, 200, isleFloors(5), { facade: 'mansionLight', front: 'south' });
          break;
        case 'harbourEast': {
          const police = shopsIn(plan.key)[0];
          police.building = push(B.x + B.w - 170, B.y + B.h - 150, 150, 130, isleFloors(2), { shop: police.name, trade: police.trade, facade: 'police', front: 'south' });
          police.door = { x: B.x + B.w - 95, y: B.y + B.h - 10 };
          monarchPlan.shops.push(police);
          plan.policeYard = { x: B.x + B.w - 170, y: B.y + B.h - 290, w: 150, h: 120 };
          push(B.x + 20, B.y + B.h - 200, 400, 180, isleFloors(6), { facade: 'harbour', front: 'south' });
          push(B.x + 20, B.y + 40, 580, 170, isleFloors(5), { facade: 'mansionLight', front: 'south' });
          break;
        }
      }
    }
    /**
     * STREETSCAPE: street trees down every pavement (London planes on the
     * streets, palms along the waterfront, clipped limes on the boulevards'
     * medians), lamp standards, and the Regency Gardens and marina quay planting.
     */
    function planIsleStreetscape(random) {
      const onAnyRoad = (x, y, pad) =>
        MONARCH_ROADS.some((r) => r.points.some((p, i) => i && segmentDistance(x, y, r.points[i - 1], p) < r.width / 2 + pad));
      const blocked = (x, y, pad) =>
        !landAt(x, y) ||
        onAnyRoad(x, y, pad) ||
        isleCircleAt(x, y, 4) ||
        buildings.some((b) => b.monarch && x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) ||
        monarchSolidList.some((b) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) ||
        monarchPlan.shops.some((s) => s.door && Math.hypot(s.door.x - x, s.door.y - y) < 26) ||
        monarchPlan.villas.some((v) => Math.hypot(v.gateAt.x - x, v.gateAt.y - y) < 44) ||
        dealershipKeepOut(x, y);
      const tree = (x, y, r, kind) => {
        if (blocked(x, y, 6)) return false;
        if (monarchTrees.some((t) => Math.abs(t.x - x) < 16 && Math.abs(t.y - y) < 16)) return false;
        const t = { x, y, r, isle: kind, tropical: kind === 'palm', county: true, blossom: kind === 'cherry', pine: kind === 'cypress' };
        monarchTrees.push(t);
        trees.push(t);
        return true;
      };
      const lamp = (x, y, kind = 'lantern') => {
        if (!landAt(x, y) || onAnyRoad(x, y, 3) || isleCircleAt(x, y, -4) === null ? false : false) return;
        if (onAnyRoad(x, y, 3) || dealershipKeepOut(x, y)) return;
        // Nor on a bridge's deck at its landing.
        if (MONARCH_BRIDGES.some((B) => segmentDistance(x, y, B.a, B.b) < B.width / 2 + 4)) return;
        monarchLamps.push({ x, y, kind });
      };
      // Street trees and lamps down both pavements of every street, every 80.
      for (const s of ISLE_STREETS) {
        const kerb = isleKerbHalf(s.at, s.vertical),
          off = kerb + 14;
        for (let v = s.from + 60; v <= s.to - 60; v += 80) {
          for (const side of [-1, 1]) {
            const x = s.vertical ? s.at + side * off : v,
              y = s.vertical ? v : s.at + side * off;
            // Not in a junction's corner, where the crossing is.
            if (ISLE_STREETS.some((o) => o.vertical !== s.vertical && Math.abs((s.vertical ? y : x) - o.at) < isleKerbHalf(o.at, o.vertical) + 46 && (s.vertical ? x : y) > o.from - 60 && (s.vertical ? x : y) < o.to + 60))
              continue;
            const waterfront = s.name === 'MARINA DRIVE' || s.name === 'WESTGATE' || s.name === 'OCEAN CRESCENT',
              phase = Math.round((v - s.from) / 80) % 2;
            if (phase === 0) tree(x, y, waterfront ? 17 : 19 + random() * 3, waterfront ? 'palm' : 'plane');
            else lamp(x, y, 'lantern');
          }
        }
        // Clipped limes down the boulevards' medians.
        if (s.divided)
          for (let v = s.from + 110; v <= s.to - 110; v += 56) {
            const x = s.vertical ? s.at : v,
              y = s.vertical ? v : s.at;
            if (ISLE_STREETS.some((o) => o.vertical !== s.vertical && Math.abs((s.vertical ? y : x) - o.at) < isleKerbHalf(o.at, o.vertical) + 40)) continue;
            if (isleCircleAt(x, y, 30)) continue;
            monarchTrees.push({ x, y, r: 11, isle: 'lime', median: true });
          }
      }
      // Regency Gardens (between Marina Drive and the south sea wall, west of the headland).
      for (let x = 5700; x < 7380; x += 110)
        for (const y of [-1180, -1090]) {
          const px = x + (y === -1090 ? 55 : 0);
          if (Math.abs(px - 6400) < 170) continue;
          tree(px, y + (random() - 0.5) * 16, 18, y === -1090 ? 'palm' : 'plane');
        }
      // Tower plazas: plane trees round each lawn, inside its edge.
      for (const plan of monarchPlan.blocks)
        for (const l of plan.lawns || []) {
          for (let x = l.x + 18; x <= l.x + l.w - 18; x += 52) for (const y of [l.y + 18, l.y + l.h - 18]) tree(x, y, 16 + random() * 3, 'plane');
          for (let y = l.y + 70; y <= l.y + l.h - 70; y += 52) for (const x of [l.x + 18, l.x + l.w - 18]) tree(x, y, 16 + random() * 3, 'plane');
        }
      // Lighthouse Park: a grove of pines and planes on the clifftop south of
      // the east villas, above the marina.
      for (let x = 9700; x <= 10040; x += 64)
        for (let y = -2180; y <= -1270; y += 64) if (random() < 0.62) {
            const pine = random() < 0.5;
            tree(x + (random() - 0.5) * 30, y + (random() - 0.5) * 30, pine ? 9 : 17 + random() * 4, pine ? 'cypress' : 'plane');
          }
      // The garden's flowering cherries along the south lawn.
      for (const c of MONARCH_GARDEN.cherries) tree(c.x, c.y, 17, 'cherry');
      // Villa gardens: specimen trees 18 inside the boundary, cypresses for the
      // Mediterranean houses, limes and copper beeches elsewhere, clear of the
      // house, the pool, the court and the drive.
      for (const plan of monarchPlan.villas) {
        const L = plan.villa.lot,
          kind = plan.villa.style === 'mediterranean' || plan.villa.style === 'spanish' ? 'cypress' : 'plane',
          keepOff = [plan.house, plan.garage, ...plan.wings, plan.pool, plan.tennis, plan.terrace].filter(Boolean),
          clear = (x, y) =>
            keepOff.every((k) => x < k.x - 22 || x > k.x + k.w + 22 || y < k.y - 22 || y > k.y + k.h + 22) &&
            Math.hypot(x - plan.gateAt.x, y - plan.gateAt.y) > 60 &&
            (plan.gateAxis === 'y' ? Math.abs(x - plan.gateAt.x) > 26 : Math.abs(y - plan.gateAt.y) > 26);
        const step = kind === 'cypress' ? 34 : 56;
        for (let x = L.x + 20; x < L.x + L.w - 18; x += step)
          for (const y of [L.y + 20, L.y + L.h - 20]) if (clear(x, y)) tree(x, y, kind === 'cypress' ? 9 : 17 + random() * 4, kind);
        for (let y = L.y + 20 + step; y < L.y + L.h - 18 - step; y += step)
          for (const x of [L.x + 20, L.x + L.w - 20]) if (clear(x, y)) tree(x, y, kind === 'cypress' ? 9 : 17 + random() * 4, kind);
      }
      // The east cliff walk and the mole.
      for (let y = -2140; y < -1300; y += 90) tree(9760, y, 16, 'palm');
      for (let x = 8200; x < 10000; x += 160) monarchLamps.push({ x, y: MONARCH_MARINA.mole.y, kind: 'mole' });
      void lamp;
    }
    /* Everything low the island adds to solid(): walls, fences, pools, fountains, parapets. */
    function monarchBlocked(x, y, r = 0) {
      if (!nearMonarchIsle(x, y, r + 20)) return false;
      if (rectListBlocked(monarchSolidList, x, y, r)) return true;
      // Moored hulls (people cannot walk onto them from a pontoon).
      if (y > MONARCH_MARINA.basin.y - 10 && y < -440 && x > 7600)
        for (const h of isleMooredHulls()) {
          const dx = x - h.x,
            dy = y - h.y,
            c = Math.cos(h.a),
            s = Math.sin(h.a),
            u = dx * c + dy * s,
            v = -dx * s + dy * c;
          if (Math.abs(u) < h.hx + r - 2 && Math.abs(v) < h.hy + r - 2) return true;
        }
      return false;
    }
    function monarchSolids() {
      return monarchSolidList;
    }
    /**
     * DISTRICTS (districtAt): the HUD's name for where the player is.
     */
    function monarchDistrictAt(x, y) {
      if (!nearMonarchIsle(x, y, 700)) return null;
      if (!landAt(x, y)) {
        const deck = MONARCH_BRIDGES.find((b) => segmentDistance(x, y, b.a, b.b) <= b.width / 2);
        if (deck) return deck.name;
        const basin = MONARCH_MARINA.basin;
        if (x > basin.x && x < basin.x + basin.w && y > basin.y && y < basin.y + basin.h + 20) return 'MONARCH HARBOUR';
        if (onIslePontoon(x, y)) return 'MONARCH HARBOUR';
        if (x < 5460 && y > -5000) return 'SOVEREIGN SOUND';
        if (y > -990) return 'REGENCY CHANNEL';
        return y < -5060 ? 'MONARCH BEACH' : null;
      }
      if (!onMonarchIsle(x, y)) return null;
      const g = MONARCH_GARDEN;
      if (x > g.x - 10 && x < g.x + g.w + 10 && y > g.y - 10 && y < g.y + g.h + 10) return 'ROYAL BOTANIC GARDEN';
      if (y < -4990) return 'MONARCH BEACH';
      if (y < -3700 || x > 9660) return 'THE CRESCENT';
      if (y > -1256 && x > 7400) return 'MONARCH HARBOUR';
      if (y > -1256) return 'REGENCY GARDENS';
      if (y > -2100) return 'MONARCH HARBOUR';
      if (x < 5700 && y > -3100 && y < -2800) return 'WESTGATE';
      return 'CROWN AVENUE';
    }
    /* The island's shores: sand on Monarch Beach, rocks on the north-east point
       and the east cliffs, a quay everywhere else. */
    function monarchShoreStyle(e) {
      if (e.region !== 'monarch') return null;
      if (e.y < -5080 && e.x > 5700 && e.x < 9640) return 'beach';
      if (e.x > 9620 && e.y < -1150) return 'rock';
      if (e.y > -600 || (e.x > 9890 && e.y > -1170)) return 'rock';
      return 'quay';
    }
    /* Shores that carry no esplanade: the rocks, the mole, the basin's east side. */
    function monarchEsplanadeGivesWay(e) {
      if (e.region !== 'monarch') return false;
      const style = monarchShoreStyle(e);
      if (style === 'rock') return true;
      // The headland's basin side and the yacht club's own terrace.
      if (e.x > 7440 && e.x < 7720 && e.y > -1200 && e.y < -900) return true;
      return false;
    }
    // Gaps in the sea railing where the pontoons meet the quay.
    function monarchRailGaps() {
      const gaps = MONARCH_MARINA.fingers.map((f) => ({ x: f.x + f.w / 2, y: -1210, half: f.w / 2 + 6 }));
      const f = MONARCH_MARINA.fuel;
      gaps.push({ x: f.x + f.w / 2, y: -1210, half: f.w / 2 + 6 });
      return gaps;
    }
