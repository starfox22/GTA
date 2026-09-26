    // BEGIN SUBSYSTEM: src/rooftops.js — Building roofs: helipads, helicopter landings, walking on a roof
    /**
     * Building roofs
     * Source: src/rooftops.js
     * Scope: shared game closure.
     *
     * A helicopter can set down on a flat roof and the player can climb out onto it,
     * walk about and take off again.
     *
     * - `roofLandable(b)`: flat roofs only. Warehouses (sawtooth skylights), the
     *   Blue Hour terrace (its own roof system, roofmission.js) and Vinny's depot
     *   walls are not.
     * - `helicopterRoofSite(c)`: the building whose roof lies under the whole of the
     *   helicopter (inside the parapet) while it is above that roof. helicopterControl
     *   (physics.js) uses its height as the floor, keeps it in `c.roofSite`, and the
     *   static contact pass skips that building's collider (which reaches 22 units
     *   above the roof and used to push a descending helicopter off into the street).
     *   `aircraftClearance()` measures from the roof while `c.roofSite` is set.
     * - `b.roofKeepOuts`: boxes `{x, y, hx, hy, a}` the renderer registers for roof
     *   plant it draws (bulkheads, water towers, AC, billboards, a tower's setback
     *   tiers); a helicopter will not land on them and the player cannot walk through
     *   them. Without WebGL there are none and any flat roof is clear.
     * - Rooftop helipads (`b.helipad`, `roofHelipads`): the Police HQ, the hospital and
     *   a spread of large flat office roofs; cityscape3d.js draws the pad instead of the
     *   usual roof clutter.
     * - `player.buildingRoof` is the carrier: the building whose roof the player stands
     *   on (`player.altitude` is its height). It is set by exitCar() beside a
     *   helicopter parked on a roof and cleared by entering a vehicle, teleportPlayer()
     *   and death. moveBody() keeps the player inside the parapet. The Blue Hour
     *   terrace keeps its own carrier, `player.roof`; `playerOnRoof()` is either.
     */
    const ROOF_PARAPET = 4;
    const roofHelipads = [];
    function playerOnRoof() {
      return !!(player.roof || player.buildingRoof);
    }
    function roofLandable(b) {
      return !!b && !b.depotWall && !b.roofBar && b.style !== 2;
    }
    // The highest building whose footprint contains the point.
    function buildingRoofAt(x, y) {
      let best = null;
      for (const b of buildingsNear(x, y))
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h && (!best || b.height > best.height)) best = b;
      return best;
    }
    function roofInside(b, x, y, inset) {
      return x >= b.x + inset && x <= b.x + b.w - inset && y >= b.y + inset && y <= b.y + b.h - inset;
    }
    function helicopterRoofSite(c) {
      if (c.type !== 'helicopter') return null;
      const b = buildingRoofAt(c.x, c.y);
      if (!roofLandable(b) || (c.altitude || 0) < b.height - 1) return null;
      return corners(vehicleShape(c)).every((p) => roofInside(b, p.x, p.y, ROOF_PARAPET)) ? b : null;
    }
    // Slow enough, clear of roof plant and of any other aircraft parked up there.
    function roofLandingClear(c, b) {
      if (Math.hypot(c.vx || 0, c.vy || 0) > 36) return false;
      const shape = vehicleShape(c, 2);
      if ((b.roofKeepOuts || []).some((k) => boxContact(shape, k))) return false;
      return !vehicles.some(
        (o) => o !== c && o.hp > 0 && Math.abs(entityElevation(o) - b.height) < 20 && boxContact(shape, vehicleShape(o, 3)),
      );
    }
    function roofPointFreeOn(b, x, y, r = 8) {
      if (!roofInside(b, x, y, ROOF_PARAPET + r)) return false;
      if ((b.roofKeepOuts || []).some((k) => Math.abs(x - k.x) < k.hx + r && Math.abs(y - k.y) < k.hy + r)) return false;
      return !vehicles.some((o) => Math.abs(entityElevation(o) - b.height) < 20 && pointInCar(x, y, o, r));
    }
    function moveOnBuildingRoof(dx, dy, r) {
      const b = player.buildingRoof;
      let blocked = false;
      if (roofPointFreeOn(b, player.x + dx, player.y, r)) player.x += dx;
      else blocked = true;
      if (roofPointFreeOn(b, player.x, player.y + dy, r)) player.y += dy;
      else blocked = true;
      return blocked;
    }
    // Step out beside a helicopter parked on a roof; false if there is no room.
    function exitOntoRoof(vehicle, b) {
      const spec = vehicleSpec(vehicle);
      for (const extra of [0, 12, 24, 40])
        for (const turn of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
          const r = (Math.abs(Math.sin(turn)) > 0.5 ? spec.w : spec.l) / 2 + 14 + extra,
            x = vehicle.x + Math.cos(vehicle.a + turn) * r,
            y = vehicle.y + Math.sin(vehicle.a + turn) * r;
          if (!roofPointFreeOn(b, x, y, 8)) continue;
          player.x = x;
          player.y = y;
          player.altitude = b.height;
          player.buildingRoof = b;
          return true;
        }
      return false;
    }
    function leaveBuildingRoof() {
      if (!player.buildingRoof) return;
      player.buildingRoof = null;
      player.altitude = terrainHeight(player.x, player.y);
    }
    /* Rooftop helipads: the Police HQ and the hospital, then the largest flat city
       roofs of mid-rise height, at least ~1100 units apart. Never a tower (their
       setbacks leave no room) and never a business with its own roof dressing. */
    function chooseRoofHelipads() {
      roofHelipads.length = 0;
      const hospital = PLACES.find((p) => p.kind === 'hospital'),
        fits = (b) => roofLandable(b) && Math.min(b.w, b.h) >= 130 && b.height >= realBuildingHeight(40) && b.height < realBuildingHeight(68),
        // A financial-cluster tower planned with a pad (src/skyline.js) always keeps it.
        chosen = buildings.filter(
          (b) => (fits(b) && (b.policeHQ || (hospital && b.place === hospital.id))) || (b.skyline && b.skyline.helipad),
        );
      const rest = buildings
        .filter((b) => fits(b) && !b.place && !b.policeHQ && b.x < CITY_SIZE && b.y < CITY_SIZE)
        .sort((a, b) => b.w * b.h - a.w * a.h || a.x - b.x || a.y - b.y);
      for (const b of rest) {
        if (chosen.length >= 8) break;
        const cx = b.x + b.w / 2,
          cy = b.y + b.h / 2;
        if (chosen.every((o) => Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy) > 1100)) chosen.push(b);
      }
      for (const b of chosen) {
        b.helipad = {
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          r: Math.min(46, Math.min(b.w, b.h) / 2 - 12),
        };
        roofHelipads.push({ ...b.helipad, z: b.height, building: b });
        // The 2D view and the minimap draw roofs from the ground canvas.
        groundContext.strokeStyle = '#e1d8ac';
        groundContext.lineWidth = 3;
        groundContext.beginPath();
        groundContext.arc(b.helipad.x, b.helipad.y, b.helipad.r - 6, 0, TAU);
        groundContext.stroke();
        label('H', b.helipad.x, b.helipad.y + 12, 34, '#e5dcbb');
      }
    }
    // END SUBSYSTEM: src/rooftops.js
