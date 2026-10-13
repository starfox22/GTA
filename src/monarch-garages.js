    // Monarch villa garages: a hollow garage with a roll-up door that opens as the player comes near (on foot or at the
    // wheel), a car parked inside nose to the door, and the drive from the door out through the gate to the street.
    /**
     * VILLA GARAGES
     * Source: src/monarch-garages.js
     * Scope: game closure; monarch-villas3d.js draws the shell, the interior and the door from `plan.garageDoor`.
     *
     * - The garage (planVilla `plan.garage`, 64 x 70, 3.4 m) is no longer one solid block: its walls are thin
     *   buildings (`villaGarageWalls`, like the 4x4 club's rooms) with a 52-unit opening on the drive side (south,
     *   north, or west for the villas gated on Lighthouse Road), so a car fits in and drives out.
     * - The door, `plan.garageDoor`: `open` 0 shut .. 1 up is live game state. `updateVillaGarages` raises it while
     *   the player is within VILLA_GARAGE_REACH of it (on foot, or driving anything but an aircraft or a boat) and
     *   keeps it up while a vehicle or the player stands in the doorway; it rolls down again behind them. People meet
     *   it through `villaGarageBlocked` (monarchBlocked) while it is under VILLA_GARAGE_PASS open, vehicles through its
     *   static body (`addVillaGarageDoorBodies`, physics-shapes.js), lifted out of reach (minHeight) once it is up.
     * - Inside: one parked car per garage (`populateVillaGarageCars`, after the island's other parked cars; types and
     *   paint by index, no random draws), an ordinary vehicle the player gets into and drives out.
     * - The drive, `plan.garageDrive`: the door's width from the door to the gate and 40 units on across the pavement,
     *   kept clear of anything parked (vehicle-entrances.js). Console `villaGarages()`; tools/tests/monarch-garages.mjs.
     */
    const VILLA_GARAGE_WALL = 4,
      VILLA_GARAGE_DOOR_WIDTH = 52,
      VILLA_GARAGE_DOOR_HEIGHT = 22,
      VILLA_GARAGE_REACH = 72,
      VILLA_GARAGE_PASS = 0.8,
      VILLA_GARAGE_CARS = ['supercar', 'luxury', 'roadster', 'suv', 'sport', 'coupe'];
    /* The door, the drive and the wall pieces of a villa's garage (buildMonarchIsle, before its buildings). */
    function planVillaGarage(plan) {
      const G = plan.garage,
        gate = plan.gateAt,
        t = VILLA_GARAGE_WALL,
        half = VILLA_GARAGE_DOOR_WIDTH / 2,
        side = plan.gateAxis === 'x' ? 'west' : gate.y > G.y + G.h / 2 ? 'south' : 'north',
        cx = side === 'west' ? G.x : G.x + G.w / 2,
        cy = side === 'west' ? G.y + G.h / 2 : side === 'south' ? G.y + G.h : G.y,
        nx = side === 'west' ? -1 : 0,
        ny = side === 'south' ? 1 : side === 'north' ? -1 : 0;
      plan.garageDoor = {
        side,
        cx,
        cy,
        nx,
        ny,
        // The door's slab in the wall line (map rectangle), what blocks while it is down.
        slab: side === 'west' ? { x: G.x, y: cy - half, w: t, h: VILLA_GARAGE_DOOR_WIDTH } : { x: cx - half, y: side === 'south' ? cy - t : cy, w: VILLA_GARAGE_DOOR_WIDTH, h: t },
        width: VILLA_GARAGE_DOOR_WIDTH,
        height: VILLA_GARAGE_DOOR_HEIGHT,
        open: 0,
        want: false,
        body: null,
      };
      plan.garageDrive =
        side === 'west'
          ? { x: gate.x - 40, y: cy - half, w: G.x - gate.x + 40, h: VILLA_GARAGE_DOOR_WIDTH }
          : side === 'south'
            ? { x: cx - half, y: cy, w: VILLA_GARAGE_DOOR_WIDTH, h: gate.y + 40 - cy }
            : { x: cx - half, y: gate.y - 40, w: VILLA_GARAGE_DOOR_WIDTH, h: cy - gate.y + 40 };
      // The walls: four sides, the door side as two piers either side of the opening.
      const walls = [],
        x0 = G.x,
        y0 = G.y,
        x1 = G.x + G.w,
        y1 = G.y + G.h;
      const add = (x, y, w, h) => w > 0.5 && h > 0.5 && walls.push({ x, y, w, h });
      if (side === 'south' || side === 'north') {
        const wy = side === 'south' ? y1 - t : y0,
          by = side === 'south' ? y0 : y1 - t;
        add(x0, by, G.w, t);
        add(x0, y0 + t, t, G.h - 2 * t);
        add(x1 - t, y0 + t, t, G.h - 2 * t);
        add(x0, wy, cx - half - x0, t);
        add(cx + half, wy, x1 - cx - half, t);
      } else {
        add(x1 - t, y0, t, G.h);
        add(x0, y0, G.w - t, t);
        add(x0, y1 - t, G.w - t, t);
        add(x0, y0 + t, t, cy - half - y0 - t);
        add(x0, cy + half, t, y1 - t - cy - half);
      }
      return walls;
    }
    /* A garage built forward, just inside the gate (a narrow lot), stands across the drive: the cars on the forecourt
       before the house could not get out. Those villas get a side gate in the frontage wall beside the garage, on the
       house's side, with its own drive (`sideDrive`, a kept vehicle entrance). Null for every other villa. */
    function villaSideGate(plan) {
      const G = plan.garage,
        gate = plan.gateAt,
        H = plan.house,
        L = plan.villa.lot;
      if (plan.gateAxis !== 'y') return null;
      const south = gate.y > G.y + G.h / 2,
        gap = south ? gate.y - (G.y + G.h) : G.y - gate.y;
      if (gap > 40) return null;
      const width = 48,
        houseSide = H.x + H.w / 2 < G.x + G.w / 2 ? -1 : 1,
        x0 = houseSide < 0 ? G.x - 10 - width : G.x + G.w + 10,
        x1 = x0 + width;
      if (x0 < L.x + 10 || x1 > L.x + L.w - 10) return null;
      const front = south ? H.y + H.h + 16 : H.y - 16;
      // From beside the garage's middle (the forecourt's cars stand just before it) out across the pavement.
      plan.sideDrive = south ? { x: x0, y: G.y + G.h / 2, w: width, h: gate.y + 40 - G.y - G.h / 2 } : { x: x0, y: gate.y - 40, w: width, h: G.y + G.h / 2 - gate.y + 40 };
      return { x0, x1, x: (x0 + x1) / 2, y: gate.y, front };
    }
    // People: the door while it is down (monarchBlocked).
    function villaGarageBlocked(x, y, r) {
      for (let i = 0; i < monarchPlan.villas.length; i++) {
        const d = monarchPlan.villas[i].garageDoor;
        if (!d || d.open >= VILLA_GARAGE_PASS) continue;
        const s = d.slab;
        if (x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) return true;
      }
      return false;
    }
    // Vehicles: one static body per door, out of reach while the door is up (physics-shapes.js, with monarchSolids).
    function addVillaGarageDoorBodies() {
      for (const plan of monarchPlan.villas) {
        const d = plan.garageDoor;
        if (!d) continue;
        d.body = addStatic(d.slab.x, d.slab.y, d.slab.w, d.slab.h, d.height, 'villa garage door');
        d.body.minHeight = d.open > 0.9 ? 1e9 : undefined;
      }
    }
    // A vehicle (or the player) in the doorway: the door stays up over it.
    function villaGarageDoorwayBusy(d) {
      const s = d.slab;
      if (player.x > s.x - 10 && player.x < s.x + s.w + 10 && player.y > s.y - 10 && player.y < s.y + s.h + 10) return true;
      const along = d.side === 'west' ? 0 : 1;
      for (let i = 0; i < vehicles.length; i++) {
        const c = vehicles[i];
        if (Math.abs(c.x - d.cx) > 60 || Math.abs(c.y - d.cy) > 60 || (c.altitude || 0) > 20) continue;
        // Any of five points along the door line inside the vehicle.
        for (let k = -2; k <= 2; k++) {
          const off = k * (d.width / 5);
          if (pointInCar(d.cx + along * off, d.cy + (1 - along) * off, c, 2)) return true;
        }
      }
      return false;
    }
    /* Each frame near the island (updateMonarchIsle): the doors follow the player. */
    function updateVillaGarages(deltaSeconds) {
      if (!nearMonarchIsle(player.x, player.y, 300)) return;
      const c = player.car,
        onGround = c ? !isAircraft(c) && !isBoat(c) && (c.altitude || 0) < 20 : !player.buildingRoof && !player.parachute && (player.altitude || 0) < 12,
        px = c ? c.x : player.x,
        py = c ? c.y : player.y;
      for (let i = 0; i < monarchPlan.villas.length; i++) {
        const d = monarchPlan.villas[i].garageDoor;
        if (!d) continue;
        const dx = px - d.cx,
          dy = py - d.cy;
        let want = onGround && dx * dx + dy * dy < VILLA_GARAGE_REACH * VILLA_GARAGE_REACH;
        if (!want && d.open > 0) want = villaGarageDoorwayBusy(d);
        if (want !== d.want) d.want = want;
        const open = clamp(d.open + (want ? deltaSeconds / 1.3 : -deltaSeconds / 2.4), 0, 1);
        if (open !== d.open) {
          d.open = open;
          if (d.body) d.body.minHeight = open > 0.9 ? 1e9 : undefined;
        }
      }
    }
    // Any door left up is rolled down on a new world (populateMonarchIsle).
    function resetVillaGarages() {
      for (const plan of monarchPlan.villas) {
        const d = plan.garageDoor;
        if (!d) continue;
        d.open = 0;
        d.want = false;
        if (d.body) d.body.minHeight = undefined;
      }
    }
    /* A car in every garage, nose to the door (populateMonarchIsle, last: no random draws). */
    function populateVillaGarageCars(park) {
      resetVillaGarages();
      monarchPlan.villas.forEach((plan, i) => {
        const d = plan.garageDoor,
          G = plan.garage;
        if (!d) return;
        const a = Math.atan2(d.ny, d.nx),
          // A little back from the middle, so the nose has room before the door.
          x = G.x + G.w / 2 - d.nx * 3,
          y = G.y + G.h / 2 - d.ny * 3;
        park(VILLA_GARAGE_CARS[i % VILLA_GARAGE_CARS.length], x, y, a, ISLE_CAR_PAINT[(i * 3 + 1) % ISLE_CAR_PAINT.length]);
      });
    }
    // Console villaGarages(): each garage's door, the car inside and its drive.
    function villaGarageReport() {
      return monarchPlan.villas.map((plan) => {
        const d = plan.garageDoor,
          G = plan.garage,
          inside = vehicles.filter((c) => c.hp > 0 && c.x > G.x && c.x < G.x + G.w && c.y > G.y && c.y < G.y + G.h);
        return {
          villa: plan.villa.name,
          garage: { x: G.x, y: G.y, w: G.w, h: G.h },
          door: d ? { side: d.side, x: Math.round(d.cx), y: Math.round(d.cy), open: +d.open.toFixed(2), want: d.want } : null,
          gate: { x: Math.round(plan.gateAt.x), y: Math.round(plan.gateAt.y) },
          sideGate: plan.sideGate ? { x: Math.round(plan.sideGate.x), y: Math.round(plan.sideGate.y), width: Math.round(plan.sideGate.x1 - plan.sideGate.x0) } : null,
          forecourt: vehicles
            .filter((c) => c.hp > 0 && !c.ai && !inside.includes(c) && !isAircraft(c) && !isBoat(c) && c.x > plan.villa.lot.x && c.x < plan.villa.lot.x + plan.villa.lot.w && c.y > plan.villa.lot.y && c.y < plan.villa.lot.y + plan.villa.lot.h)
            .map((c) => ({ id: c.id, type: c.type, x: Math.round(c.x), y: Math.round(c.y), player: c === player.car })),
          drive: plan.garageDrive ? { x: Math.round(plan.garageDrive.x), y: Math.round(plan.garageDrive.y), w: Math.round(plan.garageDrive.w), h: Math.round(plan.garageDrive.h) } : null,
          cars: inside.map((c) => ({ id: c.id, type: c.type, x: Math.round(c.x), y: Math.round(c.y), a: +c.a.toFixed(2), player: c === player.car })),
        };
      });
    }
