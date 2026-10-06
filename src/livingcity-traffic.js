    // Traffic streaming: the city's traffic pool kept round the player (streamTraffic), how busy by
    // hour and district (trafficTarget), which cars by district and hour (TRAFFIC_MIX), trafficReport().
    /* The pool is small and bounded (populate() lays ~30 cars over the whole
       grid, the streamer adds up to the target, TRAFFIC_POOL_CAP caps it); mostly
       only where the cars are changes. A car that is
       far away, out of sight and untouched is taken off the street and a car of a
       type that suits the district and the hour comes onto a lane just beyond the
       edge of the screen instead, so the streets in view are as busy as the hour
       says. Buses, taxis on a fare, delivery vans, crashed, damaged, stolen or
       mission cars, and anything the player touched are never moved. Only cars
       marked `streamed` (populate()'s traffic and the streamer's) are ever moved
       or sent home. */
    const TRAFFIC_RING = 1050,
      TRAFFIC_BASE = 34,
      TRAFFIC_POOL_CAP = 150,
      // Cars kept beyond the target (out of the ring) before any go home.
      TRAFFIC_SPARE = 14,
      // A car standing this long out of sight is in a jam that will not clear.
      TRAFFIC_JAM_SECONDS = 45;
    const trafficStream = {
      enabled: true,
      timer: 0,
      settledAt: null,
      // Ticks left of a settle (a teleport or a new world): 20 cars a tick, 0.1 s
      // apart, so the fill never costs one long frame.
      settling: 0,
      recycled: 0,
      added: 0,
      retired: 0,
      lastMs: 0,
      target: 0,
      near: 0,
    };
    /* Everyday cars dominate; the exotic ones belong to the districts that have them. */
    const TRAFFIC_TYPES = {
      sedan: 11,
      taxi: 5,
      coupe: 5,
      muscle: 3,
      van: 5,
      sport: 3,
      luxury: 3,
      suv: 5,
      pickup: 4,
      truck: 2,
      bike: 2,
      cruiser: 2,
      supercar: 1.2,
      roadster: 2,
      rally: 1,
      hotrod: 1,
      limousine: 0.6,
    };
    const TRAFFIC_DISTRICT_MIX = {
      'NORTH POINT · FINANCIAL': { luxury: 3, limousine: 4, sedan: 1.3, taxi: 2, supercar: 2, pickup: 0.3, truck: 0.4, hotrod: 0.3, rally: 0.4 },
      'EXCHANGE DISTRICT': { luxury: 2.5, limousine: 3, sedan: 1.3, taxi: 2, supercar: 1.5, pickup: 0.4, truck: 0.5, hotrod: 0.4 },
      MIDTOWN: { taxi: 3, sedan: 1.2, limousine: 1.6, van: 1.3 },
      BROADWAY: { taxi: 3.5, limousine: 2, sedan: 1.1, van: 1.2 },
      'IRONWORKS DOCKS': { truck: 5, pickup: 3, van: 3, luxury: 0.2, supercar: 0.1, limousine: 0, taxi: 0.3, roadster: 0.2, sport: 0.4 },
      'OCEAN DRIVE': { roadster: 3, cruiser: 3, supercar: 3, sport: 2, hotrod: 1.5, taxi: 1.5, truck: 0.3, van: 0.6, pickup: 0.5 },
      'PALM KEYS · ART DECO': { roadster: 2.5, cruiser: 2, supercar: 2, sport: 1.6, hotrod: 1.5, truck: 0.4 },
      'LITTLE HAVANA': { hotrod: 3, muscle: 2.5, cruiser: 2, pickup: 1.5, luxury: 0.5, supercar: 0.5 },
      'CORAL MARINA': { luxury: 2, suv: 2, roadster: 1.5, truck: 0.5 },
      'THE RECLAMATION': { truck: 2.5, pickup: 2, van: 2, limousine: 0.2 },
      'BATTERY POINT': { sedan: 1.3, luxury: 1.4, taxi: 1.4 },
    };
    const TRAFFIC_HOUR_MIX = {
      night: { taxi: 3, truck: 0.4, van: 0.4, pickup: 0.6, sport: 1.6, muscle: 1.6, supercar: 1.6, hotrod: 1.6, bike: 1.3, limousine: 1.5 },
      rush: { van: 2, truck: 1.5, sedan: 1.5, pickup: 1.3, suv: 1.3, supercar: 0.5, limousine: 0.6 },
      evening: { taxi: 2, limousine: 2, supercar: 1.4, van: 0.5, truck: 0.5 },
    };
    /* How much traffic the hour carries (1 = a normal weekday afternoon). */
    function trafficHourFactor(hour = crowdHour()) {
      if (hour < 2) return 0.45;
      if (hour < 5.5) return 0.25;
      if (hour < 7) return 0.7;
      if (hour < 9.5) return 1.2;
      if (hour < 16) return 0.9;
      if (hour < 19.5) return 1.15;
      if (hour < 23) return 0.8;
      return 0.55;
    }
    function trafficHourMix(hour = crowdHour()) {
      if (hour < 5.5 || hour >= 23) return TRAFFIC_HOUR_MIX.night;
      if ((hour >= 7 && hour < 9.5) || (hour >= 16.5 && hour < 19)) return TRAFFIC_HOUR_MIX.rush;
      if (hour >= 19.5) return TRAFFIC_HOUR_MIX.evening;
      return null;
    }
    /* The cars wanted round the player now; 0 off the city grid (the county and
       Monarch Isle have their own traffic). */
    function trafficTarget() {
      const bustle = districtBustle(player.x, player.y);
      if (bustle <= 0) return 0;
      return Math.round(TRAFFIC_BASE * trafficHourFactor() * (0.6 + 0.4 * bustle));
    }
    /* One type for a car coming onto the street at (x, y), by district and hour;
       one in forty is a flagship (twice that where the money is). */
    function pickTrafficType(x, y) {
      const district = TRAFFIC_DISTRICT_MIX[districtAt(x, y)],
        hour = trafficHourMix(),
        rich = district && (district.luxury || 1) >= 2;
      if (seededRandom() < (rich ? 0.05 : 0.025)) return randomChoice(FLAGSHIP_TYPES);
      const weights = {};
      for (const type in TRAFFIC_TYPES)
        weights[type] = TRAFFIC_TYPES[type] * (district?.[type] ?? 1) * (hour?.[type] ?? 1);
      return pickWeighted(weights);
    }
    /* Ordinary city traffic nobody depends on: the streamer may take it off the
       street. Anything with a story (a fare, a bus route, a crash, a mission, a
       scrape from the player) stays where it is. */
    function streamableTraffic(c) {
      return (
        // Only the city's own traffic (populate() and the streamer): a beach club
        // cab or a drawbridge queue has somebody still counting on it.
        c.streamed &&
        c.ai &&
        c.occupied &&
        c.hp > 0 &&
        c.hp >= c.maxhp &&
        c !== player.car &&
        !c.cop &&
        !c.lawUnit &&
        !c.mission &&
        !c.isle &&
        !c.countyRoute &&
        !c.stolen &&
        !c.emergency &&
        !c.missionAmbulance &&
        !c.deliveryScene &&
        !c.curbStop &&
        !c.crashStop &&
        !c.driverOut &&
        !c.taxiHire &&
        !(c.fareUntil > gameTime) &&
        !(c.ramUntil > gameTime) &&
        !c.lastAttacker &&
        !c.gangTarget &&
        c.type !== 'bus' &&
        c.type !== 'police' &&
        !c.damageVersion &&
        !isBoat(c) &&
        !isAircraft(c)
      );
    }
    function trafficRing() {
      // The chase view sees down the street, not a footprint that grows with the street zoom.
      if (chaseCameraLive()) return TRAFFIC_RING;
      const v = crowdViewHalf();
      return Math.max(TRAFFIC_RING, v.w + 450, v.h + 450);
    }
    /* Where the traffic is counted and spawned round: the player, or in the chase view the player leaned
       toward the camera's heading, so the street ahead fills and spots beyond the sight reach lie on it
       (chase-rules.js CHASE RULES, LEAN). */
    const trafficCentreAt = { x: 0, y: 0 };
    function trafficStreamCentre(ring) {
      return chaseCameraLive() ? chaseStreamCentre(trafficCentreAt, ring * CHASE_TRAFFIC_LEAN) : player;
    }
    /* A lane spot just beyond the edge of the screen (anywhere in the ring on a
       settle), clear of junctions and other cars. When the player drives fast the
       spots lean ahead of them, so they meet the traffic rather than trail it (in the
       chase view the whole ring leans the camera's way instead, and a spot hidden
       behind a building will do). */
    function trafficSpawnSpot(settle, ring) {
      const car = player.car,
        vx = car ? car.vx || 0 : 0,
        vy = car ? car.vy || 0 : 0,
        chase = chaseCameraLive(),
        fast = !chase && Math.hypot(vx, vy) > 30 * KMH,
        centre = trafficStreamCentre(ring);
      for (let attempt = 0; attempt < 24; attempt++) {
        let cx = centre.x,
          cy = centre.y;
        if (fast && seededRandom() < 0.6) {
          const s = Math.hypot(vx, vy);
          cx += (vx / s) * ring * 0.55;
          cy += (vy / s) * ring * 0.55;
        }
        const vertical = seededRandom() < 0.5,
          road = vertical ? roadNear(cx + randomBetween(-ring, ring)) : rowNear(cy + randomBetween(-ring, ring)),
          along = (vertical ? cy : cx) + randomBetween(-ring, ring),
          cross = vertical ? rowNear(along) : roadNear(along);
        // Mid-block: planJunction needs room to plan the next junction.
        if (Math.abs(along - cross) < 150) continue;
        const dir = seededRandom() < 0.5 ? 1 : -1,
          x = vertical ? road - dir * 25 : along,
          y = vertical ? along : road + dir * 25,
          a = vertical ? (dir * Math.PI) / 2 : dir > 0 ? 0 : Math.PI;
        if (Math.abs(x - centre.x) > ring + 200 || Math.abs(y - centre.y) > ring + 200) continue;
        if (!inCityGrid(x, y) || (!settle && !spotUnseen(x, y, 150, SPOT_CAR))) continue;
        if (inHarbor(x, y, 70) || !landAt(x, y) || !cityStreetAt(x, y)) continue;
        let crowded = false;
        for (const o of vehicles)
          if (Math.abs(o.x - x) < 80 && Math.abs(o.y - y) < 80) {
            crowded = true;
            break;
          }
        if (crowded || !trafficSpawnValid(x, y, a)) continue;
        const type = pickTrafficType(x, y);
        if (!canSpawnCar(type, x, y, a, 12)) continue;
        return { x, y, a, type };
      }
      return null;
    }
    /* A new car on the spot, rolling at a town pace so it never pulls away from a
       standstill in the middle of a block. */
    function trafficCarAt(spot) {
      const c = makeCar(spot.type, spot.x, spot.y, spot.a, true, vehiclePaint(spot.type));
      c.speed = 30 * KMH;
      c.streamed = true;
      return c;
    }
    function streamTraffic(deltaSeconds) {
      trafficStream.timer -= deltaSeconds;
      if (trafficStream.timer > 0 || !trafficStream.enabled) return;
      trafficStream.timer = 0.5;
      const started = performance.now(),
        target = trafficTarget();
      trafficStream.target = target;
      if (target <= 0) return;
      const ring = trafficRing(),
        jump =
          trafficStream.settledAt === null ||
          Math.hypot(player.x - trafficStream.settledAt.x, player.y - trafficStream.settledAt.y) > 2600;
      if (jump) {
        trafficStream.settledAt = { x: player.x, y: player.y };
        trafficStream.settling = 5;
      }
      const settle = trafficStream.settling > 0;
      if (settle) {
        trafficStream.settling--;
        trafficStream.timer = 0.1;
      }
      let near = 0,
        pool = 0;
      const far = [],
        since = clamp(gameTime - (trafficStream.lastTick ?? gameTime), 0, 1),
        centre = trafficStreamCentre(ring);
      trafficStream.lastTick = gameTime;
      for (const c of vehicles) {
        if (!c.ai || c.cop || c.isle || c.countyRoute || isBoat(c) || isAircraft(c)) continue;
        if (c.streamed) pool++;
        // How long it has stood still (a deadlock nobody is watching is cleared).
        c.trafficIdle = Math.abs(c.speed || 0) < 3 * KMH ? (c.trafficIdle || 0) + since : 0;
        const dx = Math.abs(c.x - centre.x),
          dy = Math.abs(c.y - centre.y),
          outside = dx > ring + 250 || dy > ring + 250,
          jammed = c.trafficIdle > TRAFFIC_JAM_SECONDS;
        if (dx < ring && dy < ring && !jammed) near++;
        if ((outside || jammed) && streamableTraffic(c) && !crowdInView(c.x, c.y, 220)) far.push(c);
      }
      trafficStream.near = near;
      // The farthest goes first: it is the least likely to be missed.
      far.sort((a, b) => Math.abs(b.x - centre.x) + Math.abs(b.y - centre.y) - Math.abs(a.x - centre.x) - Math.abs(a.y - centre.y));
      let taken = 0;
      const retire = (c) => {
        const index = vehicles.indexOf(c);
        if (index >= 0) vehicles.splice(index, 1);
      };
      if (near < target) {
        const want = Math.min(target - near, settle ? 20 : 3);
        for (let placed = 0; placed < want; placed++) {
          const spot = trafficSpawnSpot(settle, ring);
          if (!spot) break;
          if (taken < far.length) {
            retire(far[taken++]);
            trafficStream.recycled++;
          } else if (pool < TRAFFIC_POOL_CAP) {
            pool++;
            trafficStream.added++;
          } else break;
          trafficCarAt(spot);
        }
      } else {
        // Enough round the player: cars far away that nobody will meet go home,
        // so the pool (and what the physics steps) stays near the target.
        for (let remove = Math.min(4, pool - target - TRAFFIC_SPARE); remove > 0 && taken < far.length; remove--) {
          retire(far[taken++]);
          pool--;
          trafficStream.retired++;
        }
      }
      trafficStream.lastMs = performance.now() - started;
    }
    /* Why a stopped traffic car is standing (trafficReport): at a light, in a
       queue behind another car, a person in the road, a stop at the kerb, no road
       ahead, or none of those. */
    function trafficHoldReason(c) {
      const j = c.junction;
      if (c.curbStop || c.crashStop) return 'kerb';
      if (gameTime - (c.sirenYield ?? -9) < 1) return 'siren';
      if (j && !j.committed) {
        const vertical = Math.abs(Math.sin(c.navAngle ?? c.a)) > 0.5,
          progress = (j.x - c.x) * Math.cos(c.navAngle ?? c.a) + (j.y - c.y) * Math.sin(c.navAngle ?? c.a);
        if (progress < 130 && trafficSignal(j.x, j.y)[vertical ? 'vertical' : 'horizontal'] !== 'green') return 'signal';
      }
      const ca = Math.cos(c.a),
        sa = Math.sin(c.a);
      for (const o of vehicles) {
        if (o === c) continue;
        const dx = o.x - c.x,
          dy = o.y - c.y;
        if (Math.abs(dx) > 120 || Math.abs(dy) > 120) continue;
        const along = dx * ca + dy * sa;
        if (along > 0 && along < 90 && Math.abs(-dx * sa + dy * ca) < 20) return o.ai ? 'queue' : 'blocked';
      }
      if (j && j.committed) return 'junction';
      return 'other';
    }
    /* A new world (populate()): the next tick settles the traffic round the
       player at once instead of trickling it in. */
    function resetTrafficStream() {
      trafficStream.settledAt = null;
      trafficStream.timer = 0;
    }
    /* Developer console: the traffic round the player. */
    function trafficReport() {
      const ring = trafficRing(),
        // The box the streamer counts (round the player; leaned the camera's way in the chase view).
        centre = trafficStreamCentre(ring),
        types = {},
        out = {
          enabled: trafficStream.enabled,
          district: districtAt(player.x, player.y),
          hour: +crowdHour().toFixed(2),
          hourFactor: trafficHourFactor(),
          target: trafficTarget(),
          ring: Math.round(ring),
          vehicles: vehicles.length,
          pool: 0,
          near: 0,
          inView: 0,
          movingInView: 0,
          moving: 0,
          stopped: 0,
          held: {},
          yielding: 0,
          idle30: 0,
          streamable: 0,
          recycled: trafficStream.recycled,
          added: trafficStream.added,
          retired: trafficStream.retired,
          streamMs: +trafficStream.lastMs.toFixed(3),
          types,
        };
      for (const c of vehicles) {
        if (!c.ai || c.cop || c.isle || c.countyRoute || isBoat(c) || isAircraft(c)) continue;
        if (c.streamed) out.pool++;
        if (streamableTraffic(c)) out.streamable++;
        if (Math.abs(c.x - centre.x) >= ring || Math.abs(c.y - centre.y) >= ring) continue;
        out.near++;
        types[c.type] = (types[c.type] || 0) + 1;
        const moving = Math.abs(c.speed || 0) > 3 * KMH;
        if (moving) out.moving++;
        else {
          out.stopped++;
          const why = trafficHoldReason(c);
          out.held[why] = (out.held[why] || 0) + 1;
        }
        if (gameTime - (c.sirenYield ?? -9) < 1) out.yielding++;
        if ((c.trafficIdle || 0) > 30) out.idle30++;
        if (crowdInView(c.x, c.y, 0)) {
          out.inView++;
          if (moving) out.movingInView++;
        }
      }
      return out;
    }
