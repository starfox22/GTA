    // resetMissionState(), spawnCop(), copRoute(): mission reset and patrol spawning.
    function resetMissionState() {
      if (transitRide) leaveTransit(transitRide.from, true);
      if (taxiRide) endTaxiRide(false);
      player.deck = null;
      if (player.coaster) {
        player.coaster = null;
        coasterTrain.running = false;
        coasterTrain.t = 0;
      }
      player.tumble = null;
      player.tumbleRoll = 0;
      player.thrown = null;
      cleanupMissionExtras();
      clearDepotFloor();
      cancelGarageJob();
      player.parachute = null;
      for (let i = storyActors.length - 1; i >= 0; i--)
        if (storyActors[i].name === 'ELENA CRUZ') storyActors.splice(i, 1);
      if (player.roof) {
        player.roof = false;
        player.altitude = 0;
        player.x = ROOFTOP.door.x;
        player.y = ROOFTOP.door.y;
      }
      leaveBuildingRoof();
      enemies.length = 0;
      bullets.length = 0;
      clearPolice();
      // A chip left over from before the job (a "POLICE CLEARED!" from a chase
      // that ended as the payphone was answered) must not sit over its headline.
      hidePoliceNotice();
      resetOfficerCrews();
      player.hp = 100;
      player.armor = Math.max(player.armor, 50);
      player.inv = 2;
      reloadSecondsRemaining = 0;
      for (const w of weapons) {
        if (!w.owned) continue;
        w.ammo = w.clip;
        w.reserve = Math.max(w.reserve, w.clip * 5);
      }
      vehicles
        .filter((c) => c.mission || c.failedMission)
        .forEach((c) => {
          const i = vehicles.indexOf(c);
          if (player.car === c) player.car = null;
          if (i >= 0) vehicles.splice(i, 1);
        });
      vehicles
        .filter((c) => c.cop)
        .forEach((c) => {
          c.cop = false;
          c.ai = true;
        });
    }
    function aheadOf(t, seconds) {
      return {
        x: clamp(t.x + (t.vx || 0) * seconds, WORLD_LEFT + 40, WORLD_SIZE - 40),
        y: clamp(t.y + (t.vy || 0) * seconds, WORLD_TOP + 40, WORLD_SIZE - 40),
      };
    }
    function copRoute(c, destination = null) {
      // An interceptor routes to where the runner will be, not to where they are:
      // half the patrol chases, the other half tries to be there first. A search
      // passes its own destination (pursuit.js).
      const quarry = c.pursuitTarget || player.car || player,
        chaseTarget =
          destination || (c.interceptor ? aheadOf(quarry, 3.4) : c.pursuitTarget || player);
      if (offCityStreets(c.x, c.y) || offCityStreets(chaseTarget.x, chaseTarget.y)) return policeNavRoute(c, chaseTarget);
      const start = {
          x: ROAD_CENTERS.indexOf(roadNear(c.x)),
          y: ROAD_ROWS.indexOf(rowNear(c.y)),
        },
        target = {
          x: ROAD_CENTERS.indexOf(roadNear(chaseTarget.x)),
          y: ROAD_ROWS.indexOf(rowNear(chaseTarget.y)),
        },
        key = (p) => p.x + ',' + p.y,
        queue = [start],
        visited = new Set([key(start)]),
        parents = new Map();
      let end = start;
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i];
        if (
          Math.hypot(p.x - target.x, p.y - target.y) < Math.hypot(end.x - target.x, end.y - target.y)
        )
          end = p;
        if (key(p) === key(target)) {
          end = p;
          break;
        }
        for (const [d, e] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const n = {
            x: p.x + d,
            y: p.y + e,
          };
          if (
            n.x < 0 ||
            n.x >= ROAD_CENTERS.length ||
            n.y < 0 ||
            n.y >= ROAD_ROWS.length ||
            visited.has(key(n))
          )
            continue;
          const nx = ROAD_CENTERS[n.x],
            ny = ROAD_ROWS[n.y],
            mx = (ROAD_CENTERS[p.x] + nx) / 2,
            my = (ROAD_ROWS[p.y] + ny) / 2;
          if (
            harborPoliceProtected(nx, ny, 45) ||
            harborPoliceProtected(mx, my, 45) ||
            !groundAt(nx, ny, 10) ||
            !groundAt(mx, my, 10) ||
            !cityStreetAt(mx, my)
          )
            continue;
          visited.add(key(n));
          parents.set(key(n), p);
          queue.push(n);
        }
      }
      const route = [];
      for (let p = end; p; p = parents.get(key(p)))
        route.unshift({
          x: ROAD_CENTERS[p.x],
          y: ROAD_ROWS[p.y],
        });
      if (route.length && distanceBetween(c, route[0]) < 55) route.shift();
      return route;
    }
    function spawnCop() {
      if (harborPoliceProtected(player.x, player.y, 120)) return;
      const occupied = vehicles.filter((c) => c.cop && c.hp > 0);
      if (occupied.length >= Math.ceil(wantedStars) * 2 + 1) return;
      if (offCityStreets(player.x, player.y)) {
        spawnCountyCop();
        return;
      }
      let points = [];
      for (const x of ROAD_CENTERS)
        for (const y of ROAD_ROWS) {
          const d = Math.hypot(x - player.x, y - player.y);
          if (
            d > 550 &&
            d < 1050 &&
            !inHarbor(x, y, 100) &&
            !solid(x, y, 30) &&
            !vehicles.some((c) => Math.hypot(c.x - x, c.y - y) < 70)
          )
            points.push({
              x,
              y,
            });
        }
      if (!points.length) return;
      const p = randomChoice(points),
        c = makeCar('police', p.x, p.y, headingBetween(p, player), true);
      c.speed = 140;
      c.interceptor = occupied.length % 2 === 1;
      c.route = copRoute(c);
      c.routeTime = 2;
    }
