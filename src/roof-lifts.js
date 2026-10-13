    // Roof lifts: every roof with a helipad or a parked helicopter has a lift from a door on the pavement to a door on
    // the roof (North Point Key's own are skyline-lift.js); the shared lift list, the prompt, the action and roofLifts().
    /**
     * ROOF LIFTS
     * Source: src/roof-lifts.js
     * Scope: game closure. The ride itself (fade, floor counter, teleportPlayer at the dark moment) is the Key's,
     * skyline-lift.js startSkyLift/updateSkyLift, which reads only the lift's own fields.
     *
     * - `ROOF_LIFTS`: every lift between the street and a helicopter roof. North Point Key's (SKY_LIFTS, the
     *   helideck and CIRRUS) join first and keep their own reach, prompt and wanted rule (northPointKeyInteract);
     *   `prepareRoofLifts()` (game.js, once the roof helipads are chosen) adds one for every other helipad roof
     *   (rooftops.js roofHelipads: the city's office, hospital and police roofs, Monarch One) as `b.roofLift`.
     * - The roof door: the stair bulkhead cityscape3d-roofs.js has always drawn in a helipad roof's north-west
     *   corner (ROOF_LIFT_HOUSE; on Monarch One's crown the corner opposite the mast) is the lift house. It is a
     *   game keep-out (`b.deckKeepOuts`), so it blocks walking and landing without WebGL too; its door faces south.
     * - The street door: the middle of the first street side (south, east, west, north) whose pavement is open,
     *   where the frontage draws its middle door (crowd-space.js buildingEntrances probes the same way); a place's
     *   building keeps its own door and takes the lift door 44 units along the wall from it; Monarch One's is the
     *   revolving door under its porte-cochere. `street` = { side, u } in the renderer's frontage face frame
     *   (cityscape3d-frontage.js frontageFace), drawn there as a lit HELIPAD sign over a steel lift door.
     * - Riding: on foot, E within reach of the lobby (street) or the roof door, wanted or not (going down is never
     *   refused; North Point Key's lobbies still ask to lose the police first). The renderer only reads `b.roofLift`.
     */
    const ROOF_LIFTS = [],
      // The bulkhead (cityscape3d-roofs.js roofHelipad): its middle from the roof's north-west corner, its size.
      ROOF_LIFT_HOUSE = { u: 20, v: 16, w: 18, d: 14, h: 11 },
      ROOF_LIFT_DOWN_PROMPT = { text: 'ELEVATOR TO THE STREET', id: 'roof-lift-down' };
    // Face frame of a building side, as the renderer's frontageFace: 0 south, 1 north, 2 west, 3 east.
    function roofLiftFace(b, side) {
      if (side === 0) return { ox: b.x, oy: b.y + b.h, rx: 1, ry: 0, nx: 0, ny: 1, length: b.w };
      if (side === 1) return { ox: b.x + b.w, oy: b.y, rx: -1, ry: 0, nx: 0, ny: -1, length: b.w };
      if (side === 2) return { ox: b.x, oy: b.y, rx: 0, ry: 1, nx: -1, ny: 0, length: b.h };
      return { ox: b.x + b.w, oy: b.y + b.h, rx: 0, ry: -1, nx: 1, ny: 0, length: b.h };
    }
    // Is the pavement in front of a wall point open: a street within reach, room to stand, no building or collider.
    function roofLiftPavementOpen(f, u) {
      const at = (out) => ({ x: f.ox + f.rx * u + f.nx * out, y: f.oy + f.ry * u + f.ny * out }),
        probe = at(60);
      if (!cityStreetAt(probe.x, probe.y, 12)) return false;
      for (const out of [8, 14, 22]) {
        const p = at(out);
        if (!landAt(p.x, p.y) || solid(p.x, p.y, 5) || cityStreetAt(p.x, p.y, 0)) return false;
      }
      return true;
    }
    // Where the lift door goes on a building's street side (null when no side has open pavement).
    function roofLiftStreetDoor(b) {
      const place = b.place ? PLACES.find((p) => p.id === b.place) : null,
        door = place?.door;
      for (const side of [0, 3, 2, 1]) {
        const f = roofLiftFace(b, side),
          L = f.length,
          tries = [L / 2, L / 2 - 44, L / 2 + 44, L * 0.25, L * 0.75];
        for (const u of tries) {
          if (u < 14 || u > L - 14) continue;
          const x = f.ox + f.rx * u,
            y = f.oy + f.ry * u;
          // A place's own door keeps its pavement (its prompt and its keep-clear, STREET FRONTAGE).
          if (door && Math.hypot(door.x - x, door.y - y) < 40) continue;
          if (!roofLiftPavementOpen(f, u)) continue;
          return { side, u, x, y, nx: f.nx, ny: f.ny };
        }
      }
      return null;
    }
    function roofLiftName(b, street) {
      if (b.monarchTower) return b.monarchTower.name;
      if (b.policeHQ) return 'POLICE HQ';
      const place = b.place ? PLACES.find((p) => p.id === b.place) : null;
      if (place?.name) return place.name;
      const name = streetNameAt(street.x + street.nx * 60, street.y + street.ny * 60);
      return name ? 'OFFICES · ' + name : 'OFFICE ROOF';
    }
    function planRoofLift(b, index) {
      const tower = b.monarchTower,
        H = ROOF_LIFT_HOUSE;
      let street;
      if (tower)
        // Monarch One: the revolving door on the south face, under the porte-cochere.
        street = { side: 0, u: b.w / 2, x: b.x + b.w / 2, y: b.y + b.h, nx: 0, ny: 1, lobbyDoor: true };
      else street = roofLiftStreetDoor(b);
      if (!street) return null;
      // On Monarch One's crown the house stands opposite the mast (monarch-one3d.js: centre +44, -44).
      const hx = tower ? b.x + b.w / 2 - 44 : b.x + H.u,
        hy = tower ? b.y + b.h / 2 - 44 : b.y + H.v,
        house = { x: hx, y: hy, hx: (H.w + 3) / 2, hy: (H.d + 3) / 2, a: 0, w: H.w, d: H.d, h: H.h },
        door = { x: hx, y: hy + house.hy + 4 },
        out = (d) => ({ x: street.x + street.nx * d, y: street.y + street.ny * d }),
        lift = {
          id: 'roof-' + index,
          kind: 'roof',
          b,
          name: roofLiftName(b, street),
          venue: 'THE HELIPAD',
          topLabel: 'HELIPAD',
          floors: Math.max(2, Math.round((b.height - SHOP_FLOOR) / STOREY) + 1),
          house,
          door,
          arrive: { x: door.x, y: door.y + 10 },
          arriveA: Math.PI / 2,
          street,
          lobby: out(10),
          exit: out(20),
          exitA: Math.atan2(street.ny, street.nx),
        };
      lift.reachUp = { lift, up: true };
      lift.reachDown = { lift, up: false };
      lift.promptUp = { text: 'ELEVATOR TO THE HELIPAD · ' + lift.name, id: 'roof-lift-up' };
      lift.upText = (key) => 'THE HELIPAD · ' + key + ' by the helicopter to fly · the lift is behind you.';
      lift.downText = lift.name + ' · Back at street level.';
      return lift;
    }
    /* Once the roof helipads exist (game.js, after chooseRoofHelipads and addMonarchHelipads). */
    function prepareRoofLifts() {
      ROOF_LIFTS.length = 0;
      for (const lift of SKY_LIFTS) ROOF_LIFTS.push(lift);
      for (const pad of roofHelipads) {
        const b = pad.building;
        if (!b || b.keyPad || b.islet || SKY_LIFTS.some((l) => l.b === b)) continue;
        if (!b.roofLift) {
          const lift = planRoofLift(b, ROOF_LIFTS.length);
          if (!lift) continue;
          b.roofLift = lift;
          // The lift house is the game's own keep-out (rooftops.js roofKeepOutList), with or without WebGL.
          b.deckKeepOuts = [...(b.deckKeepOuts || []), lift.house];
        }
        ROOF_LIFTS.push(b.roofLift);
      }
    }
    // The lift on a roof (its own or the Key's), for the audit and the roof's notice.
    function roofLiftFor(b) {
      return b ? b.roofLift || SKY_LIFTS.find((l) => l.b === b) || null : null;
    }
    // The roof lift the player can call from here (not the Key's: northPointKeyInteract has those).
    function roofLiftInReach() {
      if (skyLift || player.car || player.parachute || player.swimming || player.deck || player.roof || gameMode !== 'play') return null;
      const roof = player.buildingRoof;
      if (roof) {
        const lift = roof.roofLift;
        return lift && withinRange('roof-lift-roof-' + lift.id, distanceBetween(player, lift.door), 26) ? lift.reachDown : null;
      }
      if ((player.altitude || 0) > 20) return null;
      for (let i = 0; i < ROOF_LIFTS.length; i++) {
        const lift = ROOF_LIFTS[i];
        if (lift.kind !== 'roof') continue;
        const dx = player.x - lift.lobby.x,
          dy = player.y - lift.lobby.y;
        if (dx * dx + dy * dy > 3600) continue;
        if (withinRange('roof-lift-lobby-' + lift.id, distanceBetween(player, lift.lobby), 22)) return lift.reachUp;
      }
      return null;
    }
    // The prompt at a lift door (game-ui.js, after the Key's).
    function roofLiftPrompt() {
      const reach = roofLiftInReach();
      return reach ? (reach.up ? reach.lift.promptUp : ROOF_LIFT_DOWN_PROMPT) : null;
    }
    // The action key at a lift door: the ride (skyline-lift.js startSkyLift).
    function roofLiftInteract() {
      const reach = roofLiftInReach();
      return reach ? startSkyLift(reach.lift, reach.up) : false;
    }
    /* Console roofLifts(): every helipad roof and every roof a helicopter stands parked on, with its lift; `missing`
       counts the roofs without one (tools/tests/roof-lifts.mjs holds it at 0). */
    function roofLiftReport() {
      const pt = (p) => (p ? { x: Math.round(p.x), y: Math.round(p.y) } : null),
        roofs = new Map();
      for (const pad of roofHelipads) if (pad.building) roofs.set(pad.building, { helipad: true, helicopters: 0 });
      for (let i = 0; i < vehicles.length; i++) {
        const c = vehicles[i];
        if (c.type !== 'helicopter' || !c.roofSite || c === player.car || c.hp <= 0) continue;
        const r = roofs.get(c.roofSite) || { helipad: !!c.roofSite.helipad, helicopters: 0 };
        r.helicopters++;
        roofs.set(c.roofSite, r);
      }
      const list = [...roofs].map(([b, r]) => {
        const lift = roofLiftFor(b);
        return {
          roof: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), height: Math.round(b.height) },
          helipad: r.helipad,
          helicopters: r.helicopters,
          lift: lift ? lift.id : null,
          name: lift ? lift.name || lift.tower?.name : null,
          lobby: lift ? pt(lift.lobby) : null,
          door: lift ? pt(lift.door) : null,
          street: lift?.street ? { side: ['south', 'north', 'west', 'east'][lift.street.side], u: Math.round(lift.street.u) } : null,
        };
      });
      return {
        lifts: ROOF_LIFTS.length,
        roofs: list,
        missing: list.filter((r) => !r.lift).length,
        riding: skyLift ? { id: skyLift.lift.id, up: skyLift.up, t: +skyLift.t.toFixed(2) } : null,
        player: {
          roof: player.buildingRoof ? roofLiftFor(player.buildingRoof)?.id || 'roof' : null,
          altitude: Math.round(player.altitude || 0),
          x: Math.round(player.x),
          y: Math.round(player.y),
          mode: gameMode,
        },
      };
    }
    // Console roofLiftVisit(id, 'lobby' | 'roof'): stand at a lift's street door or on its roof by the door.
    function roofLiftVisit(id, where = 'lobby') {
      const lift = ROOF_LIFTS.find((l) => l.id === id);
      if (!lift) throw Error('roofLiftVisit: unknown lift ' + id + ' (' + ROOF_LIFTS.map((l) => l.id).join(', ') + ')');
      if (where === 'roof') {
        teleportPlayer(lift.arrive.x, lift.arrive.y);
        player.buildingRoof = lift.b;
        player.altitude = lift.b.height;
        player.a = -Math.PI / 2;
      } else {
        const at = lift.exit || { x: lift.lobby.x, y: lift.lobby.y + 18 };
        teleportPlayer(at.x, at.y);
        player.a = (lift.exitA ?? Math.PI / 2) + Math.PI;
      }
      return roofLiftReport().player;
    }
