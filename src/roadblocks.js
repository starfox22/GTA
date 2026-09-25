    // BEGIN SUBSYSTEM: src/roadblocks.js — Police containment and roadblocks
    /**
     * Police containment and roadblocks
     * Source: src/roadblocks.js
     * Scope: shared game closure.
     * Chokepoint catalogue, blockade planning, braced cruisers, cones and officer posts.
     */
    /**
     * CONTAINMENT
     * Dispatch does not only follow: once the alert is serious it starts closing
     * the map. The bridge approaches and the wide avenues are the only places
     * worth cutting, so those are the catalogue. A blockade is placed ahead of
     * the runner and out of sight, never in front of their bumper, which is what
     * makes it read as police getting somewhere first rather than spawning in.
     *
     * A cut is cruisers and cones, nothing else. Two cruisers park across the
     * carriageway in a staggered V and one more sits on each pavement, so no gap
     * is wide enough for a car. The parked cruisers are braced: brakes locked,
     * wheels turned, nobody inside. They are ordinary 1.6 t bodies in the contact
     * physics (resolveContact), held only by the friction of their locked tyres
     * (parkedFriction, 0.8 g along and 0.85 g across), so momentum decides what a
     * ram does. A box truck (6.8 t) at 50 km/h keeps about 80% of its speed
     * through the first cruiser and shoves it aside; a bus or the tank (55 t)
     * barely slows. A sedan (1.45 t) shares its momentum half and half, crumples
     * and has to keep pushing a locked car with an engine that cannot out-pull
     * the brakes, so it stalls in the V unless it came in very fast. A cruiser
     * shoved more than a metre or so is no longer braced (updateRoadblocks):
     * the cut is breached. Cones are loose props that scatter when anything
     * drives through them.
     */
    const ROADBLOCK_LIFETIME = 165,
      // A braced cruiser moved this far from where it was parked, or sliding this
      // fast, has been knocked loose (units, units/s).
      ROADBLOCK_SHOVE_DISTANCE = 1.2 * UNITS_PER_METRE,
      ROADBLOCK_SHOVE_SPEED = 8 * KMH;
    const roadblocks = [];
    let roadblockSiteCache = null,
      containmentTimer = 3,
      roadblockNotice = 0;
    function roadblockSiteUsable(x, y) {
      return (
        groundAt(x, y, 46) &&
        cityStreetAt(x, y, 10) &&
        !inHarbor(x, y, 130) &&
        !parkStreetClosed(x, y) &&
        !inAirport(x, y) &&
        !depotOverlap(x - 60, y - 60, 120, 120)
      );
    }
    function roadblockSites() {
      if (roadblockSiteCache) return roadblockSiteCache;
      const sites = [];
      // Bridge approaches. Cutting these separates the islands: Palm Keys from
      // Northbank, Northbank from Ridgeline or the Sunset Pier island. The block
      // goes on the approach road just off the deck: a bridge is walled by its own
      // railings and there is no room to park two cars across it. Only ends on a
      // city street qualify (county ends are left to the county patrols).
      for (const bridge of BRIDGES) {
        const f = bridgeFrame(bridge),
          horizontal = Math.abs(f.ux) > 0.9,
          vertical = Math.abs(f.uy) > 0.9;
        if (!horizontal && !vertical) continue;
        for (const [end, dir] of [
          [bridge.a, -1],
          [bridge.b, 1],
        ]) {
          const x = end[0] + f.ux * dir * 74,
            y = end[1] + f.uy * dir * 74,
            side = horizontal ? ((f.ux * dir > 0) ? 'EAST' : 'WEST') : f.uy * dir > 0 ? 'SOUTH' : 'NORTH';
          if (roadblockSiteUsable(x, y))
            sites.push({
              x,
              y,
              axis: horizontal ? 'x' : 'y',
              bridge: true,
              name: bridge.name + ' · ' + side + ' APPROACH',
            });
        }
      }
      // Mid-block cuts on the wide avenues: a junction block is simply driven around.
      for (let i = 0; i < ROAD_CENTERS.length - 1; i++) {
        const mid = (ROAD_CENTERS[i] + ROAD_CENTERS[i + 1]) / 2;
        for (const avenue of WIDE_ROWS)
          if (roadblockSiteUsable(mid, avenue))
            sites.push({
              x: mid,
              y: avenue,
              axis: 'x',
              name: streetNameAt(mid, avenue),
            });
      }
      for (let i = 0; i < ROAD_ROWS.length - 1; i++) {
        const mid = (ROAD_ROWS[i] + ROAD_ROWS[i + 1]) / 2;
        for (const avenue of WIDE_COLUMNS)
          if (roadblockSiteUsable(avenue, mid))
            sites.push({
              x: avenue,
              y: mid,
              axis: 'y',
              name: streetNameAt(avenue, mid),
            });
      }
      roadblockSiteCache = sites;
      return sites;
    }
    function roadblockAt(site) {
      return roadblocks.find((r) => r.site === site) || null;
    }
    function roadblockCrewAlive(block) {
      return block.crew.filter((o) => o.hp > 0).length;
    }
    function buildRoadblock(site, tag = 'wanted') {
      if (roadblockAt(site)) return null;
      // `across` points a car over the carriageway; `lane` runs across the road and
      // `along` down it. A cruiser turned across a road is nearly as long as the
      // road is wide, so the pair is staggered down the road as well as across it —
      // parked side by side they would simply be inside one another.
      const across = site.axis === 'x' ? Math.PI / 2 : 0,
        lane = site.axis === 'x' ? { x: 0, y: 1 } : { x: 1, y: 0 },
        along = site.axis === 'x' ? { x: 1, y: 0 } : { x: 0, y: 1 };
      const block = {
        site,
        x: site.x,
        y: site.y,
        a: across,
        axis: site.axis,
        tag,
        created: gameTime,
        expires: gameTime + ROADBLOCK_LIFETIME,
        cars: [],
        crew: [],
        cones: [],
        announced: false,
        breached: false,
        // Which side of the line the player's car is on (-1, 1), to see them
        // come through it (updateRoadblocks).
        playerSide: 0,
      };
      const park = (x, y, a) => {
        if (!canSpawnCar('police', x, y, a, 2)) return false;
        const c = makeCar('police', x, y, a, false, '#e8eef1');
        Object.assign(c, {
          cop: true,
          ai: false,
          blockade: block,
          // Parked across the carriageway: the cop driving branch must leave these alone.
          crewDeployed: true,
          // Parked on locked brakes until shoved loose (updateRoadblocks).
          braced: true,
          parkX: x,
          parkY: y,
          vx: 0,
          vy: 0,
          speed: 0,
          av: 0,
        });
        block.cars.push(c);
        return true;
      };
      // Both carriageway cruisers reach well past the centre line (they overlap
      // by about six units seen down the road), so the V has no slot to thread
      // and a rammer aimed at the middle meets a flank, not two nose tips that
      // pivot out of the way; the along-road stagger keeps them out of each other.
      for (const offset of [-22, 22])
        park(
          site.x + lane.x * offset + along.x * offset,
          site.y + lane.y * offset + along.y * offset,
          across + (offset < 0 ? -0.34 : 0.34),
        );
      // A site can be tight for the pair but fine for one car on the centre line.
      if (!block.cars.length) park(site.x, site.y, across);
      if (!block.cars.length) return null;
      // One more cruiser parked along each pavement closes the kerb run; a few
      // inward positions are tried because street furniture can be in the way.
      for (const side of [-1, 1])
        for (const offset of [72, 68, 64])
          if (
            park(
              site.x + lane.x * side * offset,
              site.y + lane.y * side * offset,
              site.axis === 'x' ? 0 : Math.PI / 2,
            )
          )
            break;
      // Officers stand behind the line, on the side away from the runner.
      const runner = containmentTarget(),
        behind = (site.x - runner.x) * along.x + (site.y - runner.y) * along.y >= 0 ? 1 : -1;
      for (const offset of [-36, 36]) {
        const x = site.x + lane.x * offset + along.x * behind * 54,
          y = site.y + lane.y * offset + along.y * behind * 54;
        if (solid(x, y, 8)) continue;
        // From four stars the cut is held by a SWAT team with rifles (pursuit.js).
        const o = makeOfficer(x, y, headingBetween({ x, y }, site), wantedStars >= 4 ? 'swat' : 'road', {
          car: block.cars[0],
          blockade: block,
          post: {
            x,
            y,
          },
          timer: 0.9,
        });
        officers.push(o);
        block.crew.push(o);
      }
      block.cars[0].crew = block.crew;
      // A row of cones across each approach. They mark the cut; they stop nothing.
      block.cones = [];
      for (const end of [-1, 1])
        for (const offset of [-42, -14, 14, 42])
          block.cones.push({
            x: site.x + lane.x * offset + along.x * end * 64,
            y: site.y + lane.y * offset + along.y * end * 64,
            a: across,
            vx: 0,
            vy: 0,
            av: 0,
            tipped: false,
          });
      roadblocks.push(block);
      return block;
    }
    function removeRoadblock(block, index = roadblocks.indexOf(block)) {
      for (let i = vehicles.length - 1; i >= 0; i--) {
        const c = vehicles[i];
        if (c.blockade !== block) continue;
        if (c === player.car) {
          // A cruiser the player stole stays in the world as an ordinary vehicle.
          c.blockade = null;
          c.crewDeployed = false;
          c.cop = false;
          continue;
        }
        vehicles.splice(i, 1);
      }
      for (let i = officers.length - 1; i >= 0; i--)
        if (officers[i].blockade === block) officers.splice(i, 1);
      for (let i = bullets.length - 1; i >= 0; i--)
        if (bullets[i].owner?.blockade === block) bullets.splice(i, 1);
      if (index >= 0) roadblocks.splice(index, 1);
    }
    function clearRoadblocks() {
      for (let i = roadblocks.length - 1; i >= 0; i--) removeRoadblock(roadblocks[i], i);
    }
    function containmentTarget() {
      const cargo = cargoChase();
      return cargo?.policeArrived && cargo.car?.hp > 0 ? cargo.car : player.car || player;
    }
    function containmentBudget() {
      const cargo = cargoChase();
      if (cargo?.policeArrived) return 2;
      return wantedStars > 0 ? policeTier().roadblocks : 0;
    }
    function planPoliceContainment(deltaSeconds) {
      containmentTimer -= deltaSeconds;
      if (containmentTimer > 0) return;
      containmentTimer = 7;
      const budget = containmentBudget();
      if (budget <= 0) {
        clearRoadblocks();
        return;
      }
      if (roadblocks.length >= budget) return;
      const target = containmentTarget(),
        heading =
          Math.hypot(target.vx || 0, target.vy || 0) > 25
            ? Math.atan2(target.vy, target.vx)
            : target.a || 0;
      const ranked = [];
      for (const site of roadblockSites()) {
        if (roadblockAt(site)) continue;
        const d = distanceBetween(site, target);
        if (d < 430 || d > 2200) continue;
        // Never build one the runner can watch being built.
        if (d < 950 && clearSight(site, target)) continue;
        if (roadblocks.some((r) => distanceBetween(r, site) < 700)) continue;
        const ahead = Math.cos(normalizeAngle(headingBetween(target, site) - heading)),
          score = ahead * 1.7 + (site.bridge ? 1.5 : 0) + 1 - d / 2300;
        if (score > 0.05) ranked.push({ site, score });
      }
      if (!ranked.length) return;
      ranked.sort((a, b) => b.score - a.score);
      // A site can turn out to have no room for two cars across it; try the next.
      let block = null,
        chosen = null;
      for (const entry of ranked.slice(0, 8)) {
        block = buildRoadblock(entry.site, cargoChase() ? 'cargo' : 'wanted');
        if (block) {
          chosen = entry.site;
          break;
        }
      }
      if (!block) {
        // Nowhere usable right now; come back sooner than the normal cadence.
        containmentTimer = 2.5;
        return;
      }
      if (gameTime - roadblockNotice > 12) {
        roadblockNotice = gameTime;
        tell('POLICE ROADBLOCK · ' + chosen.name + ' · find another way', 5);
        radio('call-backup');
      }
    }
    /* A braced cruiser that a rammer has shoved out of its place is knocked
       loose: the cut is open. The shove itself (momentum shared, the cruiser
       slewing round on its locked wheels, both crumpled) is ordinary contact
       physics; this only notices it and tells the player. */
    function roadblockShoved(cruiser) {
      cruiser.braced = false;
      cruiser.rammedAt = gameTime;
      const rammer = cruiser.rammedBy;
      if (distanceBetween(cruiser, player) < 650) {
        particle(cruiser.x, cruiser.y, '#ddd1b4', 14, 110, 3);
        playSample('tires', 0.45, 0.8, cruiser);
      }
      if (rammer && rammer === player.car) {
        shake = Math.max(shake, 5);
        crime(0.4);
      }
    }
    /* The cut counts as busted once the player's car, having shoved a cruiser
       out of its place, comes out on the far side of the line. A car that
       shoves a cruiser a metre and stalls against it has not got through. */
    function watchRoadblockBreach(block) {
      const car = player.car;
      if (!car || block.breached) return;
      const alongX = block.axis === 'x' ? 1 : 0,
        alongY = 1 - alongX,
        down = (car.x - block.x) * alongX + (car.y - block.y) * alongY,
        across = Math.abs((car.x - block.x) * alongY - (car.y - block.y) * alongX),
        side = Math.abs(down) < 50 ? block.playerSide : Math.sign(down);
      if (
        block.playerSide &&
        side !== block.playerSide &&
        across < 110 &&
        block.cars.some((c) => !c.braced && c.rammedBy === car)
      ) {
        block.breached = true;
        tell('ROADBLOCK BUSTED · ' + block.site.name, 3);
        radio('look-out');
      }
      block.playerSide = side;
    }
    /* Cones are loose: whatever drives through one flicks it ahead and to the
       side, where it tumbles over and slides to a stop. */
    function updateRoadblockCones(block, deltaSeconds) {
      for (const cone of block.cones) {
        for (const c of vehicles) {
          if (Math.abs(c.x - cone.x) > 60 || Math.abs(c.y - cone.y) > 60) continue;
          if (isBoat(c) || (isAircraft(c) && (c.altitude || 0) > 8)) continue;
          const speed = Math.hypot(c.vx || 0, c.vy || 0);
          if (speed < 6 || !pointInCar(cone.x, cone.y, c, 4)) continue;
          const side =
              Math.sign(-(cone.x - c.x) * Math.sin(c.a) + (cone.y - c.y) * Math.cos(c.a)) || 1,
            kick = Math.max(30, speed * 1.2);
          cone.vx = Math.cos(c.a) * kick - Math.sin(c.a) * side * kick * 0.45;
          cone.vy = Math.sin(c.a) * kick + Math.cos(c.a) * side * kick * 0.45;
          cone.av = side * (5 + speed * 0.03);
          if (!cone.tipped && distanceBetween(cone, player) < 500) noise(0.05, 0.08, 1300);
          cone.tipped = true;
          break;
        }
        if (!cone.vx && !cone.vy) continue;
        const nx = cone.x + cone.vx * deltaSeconds,
          ny = cone.y + cone.vy * deltaSeconds;
        if (solid(nx, ny, 3)) cone.vx = cone.vy = 0;
        else {
          cone.x = nx;
          cone.y = ny;
        }
        cone.a += cone.av * deltaSeconds;
        const friction = Math.exp(-3.2 * deltaSeconds);
        cone.vx *= friction;
        cone.vy *= friction;
        cone.av *= friction;
        if (Math.hypot(cone.vx, cone.vy) < 2) cone.vx = cone.vy = 0;
      }
    }
    function updateRoadblocks(deltaSeconds) {
      if (gameMode !== 'play') return;
      planPoliceContainment(deltaSeconds);
      for (let i = roadblocks.length - 1; i >= 0; i--) {
        const block = roadblocks[i],
          far = distanceBetween(block, containmentTarget()) > 2600;
        if (
          gameTime > block.expires ||
          (far && gameTime - block.created > 25) ||
          (!roadblockCrewAlive(block) && !block.cars.some((c) => c.hp > 0))
        ) {
          removeRoadblock(block, i);
          continue;
        }
        for (const c of block.cars) {
          // A cruiser the player climbs into is theirs to drive, not parked.
          if (c === player.car) c.braced = false;
          if (c.hp <= 0 || c === player.car) continue;
          c.cop = true;
          if (
            c.braced &&
            (Math.hypot(c.x - c.parkX, c.y - c.parkY) > ROADBLOCK_SHOVE_DISTANCE ||
              Math.hypot(c.vx || 0, c.vy || 0) > ROADBLOCK_SHOVE_SPEED)
          )
            roadblockShoved(c);
        }
        watchRoadblockBreach(block);
        updateRoadblockCones(block, deltaSeconds);
        if (!block.announced && distanceBetween(block, player) < 320) {
          block.announced = true;
          radio(randomChoice(['police-drop-weapon', 'police-get-down', 'police-under-arrest']), block);
        }
      }
    }
    function drawRoadblocks2D() {
      for (const block of roadblocks) {
        if (!visible(block, 220)) continue;
        const ca = Math.cos(block.a),
          sa = Math.sin(block.a);
        worldContext.strokeStyle = '#e9c76a';
        worldContext.lineWidth = 6;
        worldContext.setLineDash([14, 10]);
        worldContext.beginPath();
        worldContext.moveTo(block.x - ca * 72, block.y - sa * 72);
        worldContext.lineTo(block.x + ca * 72, block.y + sa * 72);
        worldContext.stroke();
        worldContext.setLineDash([]);
        worldContext.fillStyle = '#e07a4a';
        for (const cone of block.cones) {
          const r = cone.tipped ? 3 : 4;
          worldContext.fillRect(cone.x - r, cone.y - r, r * 2, r * 2);
        }
      }
    }
    // END SUBSYSTEM: src/roadblocks.js
