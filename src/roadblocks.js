    // BEGIN SUBSYSTEM: src/roadblocks.js — Police containment and roadblocks
    /**
     * Police containment and roadblocks
     * Source: src/roadblocks.js
     * Scope: shared game closure.
     * Chokepoint catalogue, blockade planning, spike strips and officer posts.
     */
    /**
     * CONTAINMENT
     * Dispatch does not only follow: once the alert is serious it starts closing
     * the map. The river bridges and the four wide avenues are the only places
     * worth cutting, so those are the catalogue. A blockade is placed ahead of
     * the runner and out of sight, never in front of their bumper, which is what
     * makes it read as police getting somewhere first rather than spawning in.
     * Two cruisers nose-to-nose leave one gap; a spike strip covers the gap.
     */
    const ROADBLOCK_LIFETIME = 165,
      ROADBLOCK_SPIKE_HALF = 52;
    const roadblocks = [];
    let roadblockSiteCache = null,
      containmentTimer = 3,
      roadblockNotice = 0;
    function bridgeName(y) {
      return y === BRIDGES[0] ? 'UNION ST' : y === BRIDGES[1] ? 'HARBOR AVE' : 'STADIUM WAY';
    }
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
      // Bridge approaches. Cutting one of these separates Northbank from the Keys.
      // The block goes on the approach road, clear of the deck: a causeway is walled
      // by its own railings and there is no room to park two cars across it.
      for (const y of BRIDGES) {
        const [west, east] = bridgeSpan(y);
        for (const [x, side] of [
          [west - 74, 'WEST'],
          [east + 74, 'EAST'],
        ])
          if (roadblockSiteUsable(x, y))
            sites.push({
              x,
              y,
              axis: 'x',
              bridge: true,
              name: bridgeName(y) + ' BRIDGE · ' + side + ' APPROACH',
            });
      }
      // Mid-block cuts on the four avenues: a junction block is simply driven around.
      const AVENUES = [1152, 2688, 3200, 4736];
      for (let i = 0; i < ROAD_CENTERS.length - 1; i++) {
        const mid = (ROAD_CENTERS[i] + ROAD_CENTERS[i + 1]) / 2;
        for (const avenue of AVENUES) {
          if (roadblockSiteUsable(mid, avenue))
            sites.push({
              x: mid,
              y: avenue,
              axis: 'x',
              name: streetNameAt(mid, avenue),
            });
          if (roadblockSiteUsable(avenue, mid))
            sites.push({
              x: avenue,
              y: mid,
              axis: 'y',
              name: streetNameAt(avenue, mid),
            });
        }
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
        props: [],
        announced: false,
      };
      for (const offset of [-30, 30]) {
        const x = site.x + lane.x * offset + along.x * offset * 1.5,
          y = site.y + lane.y * offset + along.y * offset * 1.5,
          a = across + (offset < 0 ? -0.34 : 0.34);
        if (!canSpawnCar('police', x, y, a, 2)) continue;
        const c = makeCar('police', x, y, a, false, '#e8eef1');
        Object.assign(c, {
          cop: true,
          ai: false,
          blockade: block,
          // Parked across the carriageway: the cop driving branch must leave these alone.
          crewDeployed: true,
          vx: 0,
          vy: 0,
          speed: 0,
          av: 0,
        });
        block.cars.push(c);
      }
      if (!block.cars.length) return null;
      // Two officers work from the kerb behind the cars, not out in the lane.
      for (const offset of [-64, 64]) {
        const x = site.x + lane.x * offset - along.x * 22,
          y = site.y + lane.y * offset - along.y * 22;
        if (solid(x, y, 8)) continue;
        const o = {
          x,
          y,
          a: headingBetween(
            {
              x,
              y,
            },
            site,
          ),
          hp: 85,
          vest: wantedStars >= 4 ? 90 : 55,
          color: '#2d455e',
          police: true,
          car: block.cars[0],
          blockade: block,
          post: {
            x,
            y,
          },
          state: 'pursue',
          walk: 0,
          timer: 0.9,
          engagedSaid: false,
          gangTarget: null,
        };
        officers.push(o);
        block.crew.push(o);
      }
      block.cars[0].crew = block.crew;
      // Cones and a flare either side mark the cut; the strip covers the centre gap.
      block.props = [-1, 1].map((s) => ({
        x: site.x + lane.x * s * 74,
        y: site.y + lane.y * s * 74,
      }));
      block.spike = {
        x: site.x,
        y: site.y,
        a: across,
        half: ROADBLOCK_SPIKE_HALF,
        lane,
        spent: false,
      };
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
      const stars = Math.ceil(wantedStars);
      return stars >= 5 ? 3 : stars >= 4 ? 1 : 0;
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
      for (const entry of ranked.slice(0, 5)) {
        block = buildRoadblock(entry.site, cargoChase() ? 'cargo' : 'wanted');
        if (block) {
          chosen = entry.site;
          break;
        }
      }
      if (!block) return;
      if (gameTime - roadblockNotice > 12) {
        roadblockNotice = gameTime;
        tell('POLICE ROADBLOCK · ' + chosen.name + ' · find another way', 5);
        radio('call-backup');
      }
    }
    function flattenTyres(vehicle) {
      if (vehicle.flatTyres || isAircraft(vehicle) || isBoat(vehicle)) return;
      vehicle.flatTyres = true;
      playSample('tires', 0.5, 0.7, vehicle);
      noise(0.3, 0.22, 900);
      for (let i = 0; i < 3; i++) particle(vehicle.x, vehicle.y, '#3a3a3c', 6, 90, 3);
      if (vehicle === player.car) tell('TYRES SHREDDED · the car will not hold the road now', 4.5);
    }
    function crossedSpikes(spike, from, to) {
      // Signed distance either side of the strip line, plus a span test along it.
      const nx = -Math.sin(spike.a),
        ny = Math.cos(spike.a),
        d0 = (from.x - spike.x) * nx + (from.y - spike.y) * ny,
        d1 = (to.x - spike.x) * nx + (to.y - spike.y) * ny;
      if (d0 * d1 > 0 && Math.abs(d1) > 6) return false;
      const along = (to.x - spike.x) * Math.cos(spike.a) + (to.y - spike.y) * Math.sin(spike.a);
      return Math.abs(along) < spike.half;
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
        for (const c of block.cars)
          if (c.hp > 0 && c !== player.car) {
            c.vx = c.vy = c.speed = c.av = 0;
            c.cop = true;
          }
        if (!block.announced && distanceBetween(block, player) < 320) {
          block.announced = true;
          radio(randomChoice(['police-drop-weapon', 'police-get-down', 'police-under-arrest']), block);
        }
        const spike = block.spike;
        if (!spike || spike.spent) continue;
        for (const c of vehicles) {
          if (c.blockade === block || c.flatTyres || isAircraft(c) || isBoat(c)) continue;
          if (Math.abs(c.x - spike.x) > 200 || Math.abs(c.y - spike.y) > 200) continue;
          if (Math.hypot(c.vx || 0, c.vy || 0) < 18) continue;
          const from = c.personSweepStart || c;
          if (crossedSpikes(spike, from, c)) flattenTyres(c);
        }
      }
    }
    /* Vehicles meet the barrier line itself, not only the parked cruisers. */
    function roadblockBarriers() {
      const list = [];
      for (const block of roadblocks) {
        if (Math.abs(block.x - player.x) > 900 || Math.abs(block.y - player.y) > 900) continue;
        for (const p of block.props)
          list.push({
            x: p.x - 13,
            y: p.y - 13,
            w: 26,
            h: 26,
            height: 30,
          });
      }
      return list;
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
        if (block.spike && !block.spike.spent) {
          worldContext.strokeStyle = '#d96a5a';
          worldContext.lineWidth = 3;
          worldContext.beginPath();
          worldContext.moveTo(block.x - ca * block.spike.half, block.y - sa * block.spike.half);
          worldContext.lineTo(block.x + ca * block.spike.half, block.y + sa * block.spike.half);
          worldContext.stroke();
        }
        for (const p of block.props) {
          worldContext.fillStyle = '#e07a4a';
          worldContext.fillRect(p.x - 7, p.y - 7, 14, 14);
        }
      }
    }
    // END SUBSYSTEM: src/roadblocks.js
