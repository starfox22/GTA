    function buildCounty() {
      placeMountainOutcrops();
      const oldSeed = randomSeed;
      randomSeed = 94197;
      // Ridgeline's towns are mountain villages, laid out block by block
      // (mountain-village.js); the other islands' towns keep the city kit.
      buildMountainVillages();
      for (const t of COUNTY_TOWNS)
        for (let bx = 0; bx < 2 && !isMountainTown(t); bx++)
          for (let by = 0; by < 2; by++) {
            const x = t.x + bx * BLOCK_SIZE + 82,
              y = t.y + by * BLOCK_SIZE + 82;
            for (const [dx, dy, w, h] of [
              [0, 0, 132, 125],
              [213, 0, 130, 122],
              [0, 211, 138, 128],
              [218, 219, 121, 117],
            ]) {
              if (!landRect(x + dx, y + dy, w, h) || onCountyRoad(x + dx + w / 2, y + dy + h / 2, 85))
                continue;
              const before = buildings.length;
              makeBuilding(x + dx, y + dy, w, h, t.style === 'industrial' ? 2 : 0, true);
              if (buildings.length > before)
                Object.assign(buildings.at(-1), {
                  county: true,
                  tropical: ['coast', 'resort'].includes(t.style),
                  height:
                    t.style === 'industrial'
                      ? 38
                      : t.style === 'brick'
                        ? 65 + (bx + by) * 17
                        : 24 + (bx + by) * 11,
                });
            }
            for (const [dx, dy] of [
              [168, 26],
              [165, 300],
              [28, 168],
              [304, 168],
            ])
              if (landAt(x + dx, y + dy) && !onCountyRoad(x + dx, y + dy, 20)) {
                trees.push({
                  x: x + dx,
                  y: y + dy,
                  r: 18,
                  county: true,
                  tropical: ['coast', 'resort'].includes(t.style),
                });
              }
          }
      const ap = COUNTY_AIRPORT;
      for (const b of [
        ap.terminal,
        {
          x: 4790,
          y: 9000,
          w: 230,
          h: 200,
        },
        {
          x: 5310,
          y: 9000,
          w: 250,
          h: 200,
        },
      ]) {
        makeBuilding(b.x, b.y, b.w, b.h, 2, true);
        Object.assign(buildings.at(-1), {
          county: true,
          tropical: false,
          height: b === ap.terminal ? 48 : 59,
          airport: true,
        });
      }
      for (let i = 0; i < 530; i++) {
        const x = 5800 + seededRandom() * 5000,
          y = 500 + seededRandom() * 5700;
        if (
          !landAt(x, y) ||
          onCountyRoad(x, y, 95) ||
          terrainHeight(x, y) > 5 ||
          onMountainTrail(x, y) ||
          offroadClubBlocked(x, y, 45) ||
          mountainTownBlocked(x, y, 40) ||
          countyBlocked(x, y, 45) ||
          buildings.some(
            (b) => x > b.x - 35 && x < b.x + b.w + 35 && y > b.y - 35 && y < b.y + b.h + 35,
          )
        )
          continue;
        trees.push({
          x,
          y,
          r: 15 + seededRandom() * 13,
          county: true,
          pine: true,
          tropical: false,
        });
      }
      for (let i = 0; i < 100; i++) {
        const x = 1650 + seededRandom() * 6300,
          y = 6570 + seededRandom() * 3950;
        if (
          !countyRegionAt(x, y) ||
          onCountyRoad(x, y, 85) ||
          (x > 3400 && x < 6350 && y > 8320) ||
          // Clear of the runway strip and its approaches.
          (y > 9450 && y < 10250) ||
          buildings.some(
            (b) => x > b.x - 35 && x < b.x + b.w + 35 && y > b.y - 35 && y < b.y + b.h + 35,
          )
        )
          continue;
        trees.push({
          x,
          y,
          r: 15 + seededRandom() * 6,
          county: true,
          tropical: true,
        });
      }
      randomSeed = oldSeed;
      buildMilitary();
      installCountyServices();
      for (const [x, y] of [
        [5632, 0],
        [0, 5632],
        [5632, 5632],
      ]) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 2048;
        const drawingContext = canvas.getContext('2d');
        drawingContext.scale(2048 / CITY_SIZE, 2048 / CITY_SIZE);
        drawingContext.translate(-x, -y);
        paintCountyGround(drawingContext, true);
        for (const b of buildings.filter((b) => b.county)) {
          // Mountain buildings in their roof colours (shake, slate, painted metal).
          drawingContext.fillStyle = b.mapColor || (b.tropical ? '#c1ad91' : '#788080');
          drawingContext.fillRect(b.x, b.y, b.w, b.h);
          drawingContext.strokeStyle = '#424c48';
          drawingContext.lineWidth = 4;
          drawingContext.strokeRect(b.x, b.y, b.w, b.h);
        }
        countyGroundTiles.push({
          x,
          y,
          w: CITY_SIZE,
          h: CITY_SIZE,
          canvas,
        });
      }
      // The west half of Oceanview's runway pier lies out at sea, beyond every
      // county sheet: it gets a strip of its own at the same resolution.
      {
        const tile = { x: -4480, y: 9472, w: 4480, h: 768 },
          canvas = document.createElement('canvas'),
          pixelsPerUnit = 2048 / CITY_SIZE;
        canvas.width = Math.ceil(tile.w * pixelsPerUnit);
        canvas.height = Math.ceil(tile.h * pixelsPerUnit);
        const drawingContext = canvas.getContext('2d');
        drawingContext.scale(pixelsPerUnit, pixelsPerUnit);
        drawingContext.translate(-tile.x, -tile.y);
        paintAirfieldGround(drawingContext, true);
        countyGroundTiles.push({ ...tile, canvas });
      }
    }
    function countyRouteControl(c) {
      const route = c.countyRoute;
      let i = c.countyIndex || 0;
      if (distanceBetween(c, route[i]) < 65) {
        i = (i + 1) % route.length;
        c.countyIndex = i;
      }
      const target = route[i],
        da = normalizeAngle(headingBetween(c, target) - c.a);
      // County roads: about 60 km/h through the towns, 90 in a panic.
      let desired = (c.panicUntil > gameTime ? 90 : 60) * KMH;
      desired *= clamp(1 - Math.abs(da) * 0.55, 0.18, 1);
      const headingCosine = Math.cos(c.a),
        headingSine = Math.sin(c.a);
      for (const o of vehicles) {
        if (o === c || (o.altitude || 0) > 15) continue;
        const dx = o.x - c.x,
          dy = o.y - c.y;
        // Only what is within the 240-unit look-ahead can matter.
        if (dx > 280 || dx < -280 || dy > 280 || dy < -280) continue;
        const along = dx * headingCosine + dy * headingSine,
          side = Math.abs(-dx * headingSine + dy * headingCosine);
        if (along > 0 && along < 240 && side < (vehicleSpec(c).w + vehicleSpec(o).w) / 2 + 7) {
          const lead = Math.max(0, (o.vx || 0) * headingCosine + (o.vy || 0) * headingSine);
          desired = Math.min(
            desired,
            lead + Math.max(0, along - (vehicleSpec(c).l + vehicleSpec(o).l) / 2 - 28 - lead * 0.8) * 1.2,
          );
        }
      }
      // People within 100 units ahead (from the crowd's grid, not a copy of everyone).
      const yieldTo = (p) => {
        if (p.hp > 0 && distanceBetween(c, p) < 160) {
          const a = normalizeAngle(headingBetween(c, p) - c.a);
          if (Math.abs(a) < 0.45) desired = Math.min(desired, Math.sqrt(2 * 0.6 * GRAVITY * Math.max(0, distanceBetween(c, p) - 60)));
        }
      };
      forEachPedestrianNear(c.x, c.y, 160, yieldTo);
      if (!player.car) yieldTo(player);
      return {
        steer: clamp(da * 2.5, -1.6, 1.6),
        desired,
      };
    }
    function populateCounty() {
      for (const [j, t] of COUNTY_TOWNS.entries()) {
        const path = [
          {
            x: t.x + 130,
            y: t.y + 25,
          },
          {
            x: t.x + BLOCK_SIZE * 2 - 70,
            y: t.y + 25,
          },
          {
            x: t.x + BLOCK_SIZE * 2 - 25,
            y: t.y + 90,
          },
          {
            x: t.x + BLOCK_SIZE * 2 - 25,
            y: t.y + BLOCK_SIZE * 2 - 80,
          },
          {
            x: t.x + BLOCK_SIZE * 2 - 90,
            y: t.y + BLOCK_SIZE * 2 - 25,
          },
          {
            x: t.x + 80,
            y: t.y + BLOCK_SIZE * 2 - 25,
          },
          {
            x: t.x + 25,
            y: t.y + BLOCK_SIZE * 2 - 90,
          },
          {
            x: t.x + 25,
            y: t.y + 100,
          },
        ];
        for (const i of [0, 3, 5]) {
          const p = path[i],
            n = path[(i + 1) % path.length],
            type = ['sedan', 'pickup', 'luxury', 'rally', 'roadster'][j];
          if (canSpawnCar(type, p.x, p.y, headingBetween(p, n))) {
            const c = makeCar(type, p.x, p.y, headingBetween(p, n), true);
            c.countyRoute = path;
            c.countyIndex = (i + 1) % path.length;
          }
        }
        for (const [i, type] of ['suv', 'bike', 'sport'].entries()) {
          const x = t.x + 160 + i * 100,
            y = t.y - 66;
          if (canSpawnCar(type, x, y, 0)) makeCar(type, x, y, 0, false);
        }
        for (let i = 0; i < 12; i++) {
          const x = t.x + 100 + (i % 6) * 55,
            y = t.y + (i < 6 ? 66 : 216);
          if (!solid(x, y, 6))
            pedestrians.push({
              x,
              y,
              a: 0,
              color: i % 2 ? '#c3b092' : '#7095a0',
              hp: 30,
              flee: 0,
              timer: 5,
              walk: 0,
            });
        }
      }
      makeCar('helicopter', 3690, 8830, 0);
      makeCar('supercar', 4200, 8740, 0);
      makeCar('bus', 4400, 8760, 0);
      makeCar('plane', FLIGHT.parked.x, FLIGHT.parked.y, 0);
      populateMilitary();
      spawnTrailVehicles();
      populateOffroadClub();
      populateMountainVillages();
      populateRecreation();
      populateSunsetPier();
      populateMonarchIsle();
      populateLiners();
      populatePromenade();
      populateBeach();
      populateCycles();
      populateMarina();
      populateWildlife();
      resetTransit();
      populateAircraft();
    }
    function drawCounty2D() {
      for (const t of countyGroundTiles)
        if (
          Math.abs(t.x + t.w / 2 - cameraTarget.x) < t.w / 2 + viewportWidth / canvasScale &&
          Math.abs(t.y + t.h / 2 - cameraTarget.y) < t.h / 2 + viewportHeight / canvasScale
        )
          worldContext.drawImage(t.canvas, t.x, t.y, t.w, t.h);
      // Long bridges run over open water that no baked ground sheet covers.
      drawBridgeGround(worldContext, true);
      for (const b of buildings)
        if (
          b.county &&
          visible(
            {
              x: b.x + b.w / 2,
              y: b.y + b.h / 2,
            },
            Math.max(b.w, b.h),
          )
        ) {
          worldContext.fillStyle = '#161e2566';
          worldContext.fillRect(b.x + 10, b.y + 14, b.w, b.h);
          worldContext.fillStyle = b.mapColor || (b.tropical ? '#cab997' : '#87918d');
          worldContext.fillRect(b.x, b.y, b.w, b.h);
          worldContext.strokeStyle = '#3e514e';
          worldContext.lineWidth = 3;
          worldContext.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
        }
      for (const t of trees)
        if (t.county && visible(t, 45)) {
          worldContext.fillStyle = t.pine ? '#28563e' : '#44795a';
          worldContext.beginPath();
          worldContext.arc(t.x, t.y, t.r, 0, TAU);
          worldContext.fill();
        }
      drawMilitary2D();
    }
    function drawCountyMap(drawingContext, scale, big) {
      if (!big) return;
      drawingContext.save();
      for (const t of trees.filter((t) => t.county)) {
        drawingContext.fillStyle = t.pine ? '#2f583dcc' : '#446f4caa';
        drawingContext.beginPath();
        drawingContext.arc(t.x, t.y, t.r * 2, 0, TAU);
        drawingContext.fill();
      }
      // Relief (contours, hill shading, snow) is painted into the county sheets by paintMountainGround.
      drawingContext.font = 'bold ' + 10 / scale + 'px Arial';
      drawingContext.textAlign = 'center';
      drawingContext.lineWidth = 3 / scale;
      drawingContext.strokeStyle = '#15333de8';
      for (const [name, x, y] of [
        ...COUNTY_TOWNS.map((t) => [t.name, t.x + 512, t.y + 480]),
        ['RIDGELINE MOUNTAINS', 8020, 1050],
        ['EAGLE PASS', 7240, 1950],
        ['CLEARWATER', 9140, 1930],
        ['OCEANVIEW INTERNATIONAL ✈', 4770, 9630],
        ['FORT SENTINEL · RESTRICTED', 9810, 9570],
        ['CORAL SOUND', 5830, 5880],
        ['4X4 CLUB', OFFROAD_CLUB.lot.x + OFFROAD_CLUB.lot.w / 2, OFFROAD_CLUB.lot.y + OFFROAD_CLUB.lot.h / 2],
        ['RANGER STATION', MOUNTAIN_VILLAGE.helipad ? MOUNTAIN_VILLAGE.helipad.x + 110 : 8680, MOUNTAIN_VILLAGE.helipad ? MOUNTAIN_VILLAGE.helipad.y - 60 : 3400],
      ]) {
        drawingContext.strokeText(name, x, y);
        drawingContext.fillStyle = name.includes('SENTINEL') ? '#f0b49b' : '#e5e3ce';
        drawingContext.fillText(name, x, y);
      }
      // Helicopter pads: Oceanview's, and Mountain Rescue's at the Northridge ranger station.
      for (const [x, y] of [
        [3690, 8830],
        [FLIGHT.pickup.x, FLIGHT.pickup.y],
      ]) {
        drawingContext.fillStyle = '#e3d19c';
        drawingContext.fillText('H', x, y);
      }
      drawingContext.restore();
    }
    function addCountyColliders() {
      addBeachColliders();
      addBeachClubColliders();
      addOffroadClubColliders();
      addMountainColliders();
      for (const b of [...countySolids(), ...militaryWalls])
        addStatic(b.x, b.y, b.w, b.h, b.height, b.kind || 'military');
      // Towers, pylons, arches, trusses and cable fans (bridgeStructure,
      // geography.js): solid to aircraft. Whatever spans the carriageway starts
      // at BRIDGE_CLEARANCE, so road traffic passes underneath.
      for (const bridge of BRIDGES)
        for (const p of bridgePylons(bridge)) addBridgeBody({ ...p, kind: 'bridge ' + p.kind });
      for (const bridge of BRIDGES)
        for (const piece of countyBridgeRails(bridge)) addBridgeBody({ ...piece, kind: 'rail', height: 8 });
    }
    // An oriented static body, filed in every grid cell its corners reach.
    function addBridgeBody(piece) {
      const b = { ...piece, id: 'county' + staticBodies.length };
      if (!b.minHeight) delete b.minHeight;
      staticBodies.push(b);
      const cs = corners(b),
        minx = Math.min(...cs.map((p) => p.x)),
        maxx = Math.max(...cs.map((p) => p.x)),
        miny = Math.min(...cs.map((p) => p.y)),
        maxy = Math.max(...cs.map((p) => p.y));
      for (let x = Math.floor(minx / 256); x <= Math.floor(maxx / 256); x++)
        for (let y = Math.floor(miny / 256); y <= Math.floor(maxy / 256); y++) {
          // Numeric cell keys, as physics.js uses: string keys were never
          // looked up, so traffic drove through the bridge guard rails.
          const key = x * 4096 + y;
          if (!staticGrid.has(key)) staticGrid.set(key, []);
          staticGrid.get(key).push(b);
        }
    }
    function countyBridgeRails(bridge) {
      if (bridge.rails) return bridge.rails;
      const dx = bridge.b[0] - bridge.a[0],
        dy = bridge.b[1] - bridge.a[1],
        length = Math.hypot(dx, dy),
        a = Math.atan2(dy, dx),
        n = Math.ceil(length / 40),
        rails = [];
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n,
          cx = bridge.a[0] + dx * t,
          cy = bridge.a[1] + dy * t;
        if (landAt(cx, cy)) continue;
        for (const side of [-1, 1]) {
          const x = cx - Math.sin(a) * side * (bridge.width / 2 - 1),
            y = cy + Math.cos(a) * side * (bridge.width / 2 - 1),
            hx = length / n / 2;
          // Rails guard the edge over water only. The centre line can already be
          // over the sea where the edge is still quay: the Oceanview causeway's
          // first west rail stood in the Marina Rd junction, and buses turning
          // onto the causeway stuck on it with Riverbank Dr queued behind them.
          if ([-1, 0, 1].some((k) => landAt(x + Math.cos(a) * hx * k, y + Math.sin(a) * hx * k))) continue;
          rails.push({ x, y, hx, hy: 1.2, a, localX: (t - 0.5) * length, side });
        }
      }
      return (bridge.rails = rails);
    }
    function countyPatrolEdgeClear(a, b) {
      const steps = Math.ceil(distanceBetween(a, b) / 12),
        heading = headingBetween(a, b);
      for (let i = 0; i <= steps; i++) {
        const c = {
            type: 'police',
            a: heading,
            x: a.x + ((b.x - a.x) * i) / steps,
            y: a.y + ((b.y - a.y) * i) / steps,
          },
          shape = vehicleShape(c, 1);
        if (
          [...nearbyStatics(c)].some(
            (b) => (b.minHeight === undefined || 32 >= b.minHeight) && boxContact(shape, b),
          )
        )
          return false;
      }
      return true;
    }
    // County patrols use the same connected roads as the world; no spawning in water or inside the base.
    let countyPoliceGraph = null;
    function countyPoliceNodes() {
      if (countyPoliceGraph) return countyPoliceGraph;
      const nodes = [];
      const add = (x, y) => {
        if (!groundAt(x, y, 14) || solid(x, y, 12) || inMilitary(x, y, 170)) return;
        const old = nodes.find((p) => Math.hypot(p.x - x, p.y - y) < 20);
        if (!old)
          nodes.push({
            x,
            y,
            links: [],
          });
      };
      for (const r of COUNTY_ROADS)
        for (let i = 1; i < r.points.length; i++) {
          const a = r.points[i - 1],
            b = r.points[i],
            n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 130);
          for (let j = 0; j <= n; j++)
            add(a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n);
        }
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i],
            b = nodes[j];
          if (distanceBetween(a, b) > 185 || !clearSight(a, b) || !countyPatrolEdgeClear(a, b))
            continue;
          let valid = true;
          for (let k = 1; k < 5; k++)
            if (!groundAt(a.x + ((b.x - a.x) * k) / 5, a.y + ((b.y - a.y) * k) / 5, 12)) {
              valid = false;
              break;
            }
          if (valid) {
            a.links.push(j);
            b.links.push(i);
          }
        }
      return (countyPoliceGraph = nodes);
    }
    function spawnCountyCop() {
      const points = countyPoliceNodes().filter((p) => {
        const d = distanceBetween(p, player);
        return d > 550 && d < 1000 && canSpawnCar('police', p.x, p.y, 0, 10);
      });
      if (!points.length) return;
      const p = randomChoice(points),
        c = makeCar('police', p.x, p.y, 0, true);
      c.a = copRoute(c).length > 1 ? headingBetween(c, copRoute(c)[1]) : headingBetween(c, player);
      c.route = copRoute(c);
      c.routeTime = 2;
    }
