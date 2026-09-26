    // BEGIN SUBSYSTEM: src/renewal.js — Parks and recreation
    /**
     * Parks and recreation
     * Source: src/renewal.js
     * Scope: shared game closure.
     * Distinct park layouts, ponds, boardwalks, walkers, joggers and bicycles.
     */
    /* Shared park plans drive scenery, recreation, traffic exclusions and the city map. */
    /**
     * CENTRAL GARDEN
     * The city's great park, two blocks wide and two deep (x 1753..2599,
     * y 2824..3624), a block west and two blocks south of where it was first laid
     * out: hard against the Ironworks docks it read as the harbour's back garden,
     * and a city park needs its own quarter around it. No railway goes near it --
     * the Shore Line runs the west sea wall and Royal Ave. Central Ave (x = 2176) and
     * Linden St (y = 3200) cross inside the park and are closed to traffic.
     * Layout, west to east and north to south:
     *   Great Lawn (1808..2148, 2884..3214)     Garden Lake (ellipse at 2388,3034)
     *   Founders statue (2178,3154)             Boathouse and dock (2344,3224)
     *   Rose garden and pergola (1868,3314)     Garden Plaza and fountain (2158,3324)
     *   Playground (1828,3504)                  Bandshell and lawn seating (2448,3324)
     *   Calisthenics park (2048,3494)           Gazebo corner (2498,3544)
     *   Food trucks on the plaza apron and by the north gate.
     */
    const CENTRAL_PARK = {
      id: 'garden',
      name: 'CENTRAL GARDEN',
      kind: 'commons',
      x: 1753,
      y: 2824,
      w: 846,
      h: 800,
    };
    const COMMONS = {
      lake: { x: 2388, y: 3034, rx: 150, ry: 165, a: 0.15 },
      dock: { x: 2388, y: 3220, w: 24, h: 62 },
      boathouse: { x: 2344, y: 3224, w: 88, h: 50 },
      plaza: { x: 2008, y: 3254, w: 300, h: 140 },
      fountain: { x: 2158, y: 3324 },
      bandshell: { x: 2448, y: 3324 },
      roseGarden: { x: 1868, y: 3314 },
      playground: { x: 1828, y: 3504 },
      gazebo: { x: 2498, y: 3544 },
      statue: { x: 2178, y: 3154 },
      lawn: { x: 1808, y: 2884, w: 340, h: 330 },
      // Outdoor gym: pull-up and dip rig, parallel bars, rings and a rubber mat.
      calisthenics: { x: 2048, y: 3494, w: 176, h: 112 },
      // Street food on the plaza apron and by the north gate.
      foodTrucks: [
        { x: 1988, y: 3428, a: 0, menu: 'TACOS', color: '#d87a4a' },
        { x: 2100, y: 3428, a: 0, menu: 'COFFEE', color: '#5f8f86' },
        { x: 2200, y: 2892, a: Math.PI / 2, menu: 'NOODLES', color: '#b8556a' },
      ],
      kiosks: [
        { x: 2250, y: 3286, color: '#e8b1c2' },
        { x: 1788, y: 3164, color: '#4f8ab1' },
      ],
    };
    const CITY_PARKS = [
      CENTRAL_PARK,
      ...PARKS.filter(([bx, by]) => ![3, 4].includes(bx) || ![5, 6].includes(by))
        .map(([bx, by], i) => ({
          id: 'park-' + i,
          bx,
          by,
          name: [
            'PALM SQUARE',
            'SCULPTURE GARDEN',
            'WESTSIDE GREEN',
            'RIVERSIDE COURTS',
            'MEMORIAL GARDENS',
            'POCKET ORCHARD',
            'PALM BOTANIC GARDEN',
            'BLOSSOM GARDEN',
            'COASTAL MEADOW',
            'MARINA GARDEN',
            'WEST QUAY GREEN',
            'RECLAMATION GREEN',
            'LIBERTY SQUARE',
            'VIADUCT GREEN',
          ][i],
          kind: [
            'square',
            'sculpture',
            'meadow',
            'courts',
            'formal',
            'orchard',
            'botanic',
            'pond',
            'meadow',
            'botanic',
            'orchard',
          ][i],
          x: blockX(bx) + 89 + (i % 3) * 17,
          y: blockY(by) + 89 + (i % 2) * 23,
          w: [268, 334, 218, 292][i % 4],
          h: [245, 334, 192, 310][i % 4],
        }))
        .filter((p) => validCityBlock(p.x, p.y, p.w, p.h)),
    ];
    function parkStreetClosed(x, y) {
      // Linden St and Garden Ave run inside Central Garden and carry no traffic.
      return (
        (x > 1688 && x < 2668 && Math.abs(y - 3200) < 70) ||
        (Math.abs(x - 2176) < 70 && y > 2814 && y < 3634)
      );
    }
    function parkAt(x, y) {
      return CITY_PARKS.find((p) => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h);
    }
    function parkLoop(p, inset = 32) {
      return [
        [p.x + inset, p.y + inset],
        [p.x + p.w - inset, p.y + inset],
        [p.x + p.w - inset, p.y + p.h - inset],
        [p.x + inset, p.y + p.h - inset],
        [p.x + inset, p.y + inset],
      ];
    }
    function parkWalk(p) {
      return p.kind === 'commons'
        ? [
            [1808, 2884],
            [2128, 2884],
            [2200, 2954],
            [2218, 3254],
            [2398, 3324],
            [2538, 3254],
            [2550, 3404],
            [2448, 3564],
            [2248, 3524],
            [2108, 3474],
            [1958, 3464],
            [1808, 3484],
            [1818, 3584],
            [2188, 3599],
            [2498, 3584],
            [2538, 3454],
            [2348, 3394],
            [2188, 3334],
            [1988, 3234],
            [1788, 3084],
            [1808, 2884],
          ]
        : parkLoop(p, Math.min(p.w, p.h) * 0.25);
    }
    function paintParks(drawingContext, detail = true) {
      for (const p of CITY_PARKS) {
        drawingContext.fillStyle = '#b6bba0';
        drawingContext.fillRect(p.x - 8, p.y - 8, p.w + 16, p.h + 16);
        drawingContext.fillStyle =
          p.kind === 'square' ? '#c6bcaa' : p.kind === 'meadow' ? '#7f9a67' : '#6f8c5e';
        drawingContext.fillRect(p.x, p.y, p.w, p.h);
        strokeRoad(drawingContext, parkLoop(p, 15), p.kind === 'commons' ? 16 : 10, '#416f6c');
        strokeRoad(drawingContext, parkWalk(p), p.kind === 'commons' ? 20 : 12, '#d1c5a2');
        if (p.kind === 'commons') paintCommons(drawingContext);
        if (p.kind === 'pond' || p.kind === 'botanic') {
          drawingContext.fillStyle = '#568c8d';
          drawingContext.beginPath();
          drawingContext.ellipse(
            p.x + p.w * 0.5,
            p.y + p.h * 0.5,
            p.w * 0.17,
            p.h * 0.23,
            0.25,
            0,
            TAU,
          );
          drawingContext.fill();
        }
        if (p.kind === 'courts') {
          drawingContext.fillStyle = '#a77d61';
          drawingContext.fillRect(p.x + 65, p.y + 62, 145, 88);
          drawingContext.strokeStyle = '#efe6cc';
          drawingContext.lineWidth = 2;
          drawingContext.strokeRect(p.x + 70, p.y + 67, 135, 78);
          drawingContext.beginPath();
          drawingContext.arc(p.x + 137.5, p.y + 106, 16, 0, TAU);
          drawingContext.stroke();
        }
        if (detail) {
          drawingContext.font = 'bold 12px Arial';
          drawingContext.fillStyle = '#eff0cc';
          drawingContext.textAlign = 'center';
          drawingContext.fillText(p.name, p.x + p.w / 2, p.y + p.h - 35);
          if (p.kind === 'commons') {
            drawingContext.font = 'bold 13px Arial';
            drawingContext.fillStyle = '#e9ebc9';
            drawingContext.fillText('GREAT LAWN', 1978, 3054);
            drawingContext.fillText('GARDEN LAKE', 2388, 3044);
            drawingContext.fillText('BANDSHELL', 2448, 3504);
            drawingContext.fillText('ROSE GARDEN', 1868, 3389);
            drawingContext.fillText('OUTDOOR GYM', 2048, 3569);
          }
        }
      }
    }
    function ellipsePath(g, e) {
      g.beginPath();
      g.ellipse(e.x, e.y, e.rx, e.ry, e.a, 0, TAU);
    }
    function paintCommons(g) {
      const c = COMMONS;
      // Mown stripes on the Great Lawn.
      for (let y = c.lawn.y; y < c.lawn.y + c.lawn.h; y += 26) {
        g.fillStyle = (y / 26) % 2 ? '#789a63' : '#6f9059';
        g.fillRect(c.lawn.x, y, c.lawn.w, 26);
      }
      // Lake with a sandy shore, deeper centre and a boathouse dock.
      g.fillStyle = '#c2b28a';
      ellipsePath(g, { ...c.lake, rx: c.lake.rx + 14, ry: c.lake.ry + 14 });
      g.fill();
      g.fillStyle = '#3f7f8a';
      ellipsePath(g, c.lake);
      g.fill();
      g.fillStyle = '#2f6874';
      ellipsePath(g, { ...c.lake, rx: c.lake.rx * 0.55, ry: c.lake.ry * 0.6 });
      g.fill();
      g.fillStyle = '#7d6247';
      g.fillRect(c.dock.x - c.dock.w / 2, c.dock.y - c.dock.h, c.dock.w, c.dock.h + 10);
      g.fillStyle = '#5c4636';
      g.fillRect(c.boathouse.x, c.boathouse.y, c.boathouse.w, c.boathouse.h);
      // Station plaza with paver grid and the fountain basin.
      g.fillStyle = '#c3bfb2';
      g.fillRect(c.plaza.x, c.plaza.y, c.plaza.w, c.plaza.h);
      g.strokeStyle = '#a9a598';
      g.lineWidth = 1;
      for (let x = c.plaza.x; x <= c.plaza.x + c.plaza.w; x += 20) {
        g.beginPath();
        g.moveTo(x, c.plaza.y);
        g.lineTo(x, c.plaza.y + c.plaza.h);
        g.stroke();
      }
      g.fillStyle = '#5b8d95';
      g.beginPath();
      g.arc(c.fountain.x, c.fountain.y, 26, 0, TAU);
      g.fill();
      // Bandshell: paved fan of seating to the south of the stage.
      g.fillStyle = '#b9ae98';
      g.beginPath();
      g.arc(c.bandshell.x, c.bandshell.y, 150, 0.15, Math.PI - 0.15);
      g.lineTo(c.bandshell.x, c.bandshell.y);
      g.fill();
      g.fillStyle = '#8a7f6c';
      g.beginPath();
      g.arc(c.bandshell.x, c.bandshell.y, 46, Math.PI, TAU);
      g.fill();
      // Rose garden parterre.
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          g.fillStyle = (i + j) % 2 ? '#587a4b' : '#8b5c74';
          g.fillRect(c.roseGarden.x + i * 44 - 17, c.roseGarden.y + j * 44 - 17, 34, 34);
        }
      g.fillStyle = '#d1c5a2';
      g.fillRect(c.roseGarden.x - 66, c.roseGarden.y - 3, 132, 6);
      g.fillRect(c.roseGarden.x - 3, c.roseGarden.y - 66, 6, 132);
      // Playground safety surface and gazebo pad.
      g.fillStyle = '#9c6b5a';
      g.fillRect(c.playground.x - 70, c.playground.y - 45, 140, 90);
      g.fillStyle = '#c9c1a7';
      g.beginPath();
      g.arc(c.gazebo.x, c.gazebo.y, 34, 0, TAU);
      g.fill();
      // Statue plinth pad.
      g.fillStyle = '#bcb4a0';
      g.fillRect(c.statue.x - 22, c.statue.y - 22, 44, 44);
      // Outdoor gym: poured rubber safety surface with lane markings.
      const cal = c.calisthenics;
      g.fillStyle = '#4b4f52';
      g.fillRect(cal.x - cal.w / 2, cal.y - cal.h / 2, cal.w, cal.h);
      g.fillStyle = '#5c6367';
      g.fillRect(cal.x - cal.w / 2 + 6, cal.y - cal.h / 2 + 6, cal.w - 12, cal.h - 12);
      g.strokeStyle = '#d7cc9d';
      g.lineWidth = 2;
      g.strokeRect(cal.x - cal.w / 2 + 6, cal.y - cal.h / 2 + 6, cal.w - 12, cal.h - 12);
      g.fillStyle = '#8d8365';
      for (let i = -2; i <= 2; i++) g.fillRect(cal.x + i * 30 - 2, cal.y - cal.h / 2 + 12, 4, cal.h - 24);
      // Food truck aprons.
      g.fillStyle = '#b0a993';
      for (const t of c.foodTrucks) g.fillRect(t.x - 30, t.y - 22, 60, 44);
    }
    function seedCommonsTrees() {
      const p = CENTRAL_PARK,
        c = COMMONS,
        route = parkWalk(p);
      let planted = 0;
      for (let j = 0; j < 1100 && planted < 280; j++) {
        const x = p.x + 30 + ((j * 733 + 91) % (p.w - 60)),
          y = p.y + 30 + ((j * 1217 + 37) % (p.h - 60)),
          onLawn = x > c.lawn.x + 20 && x < c.lawn.x + c.lawn.w - 20 && y > c.lawn.y + 20 && y < c.lawn.y + c.lawn.h - 20,
          edge = Math.min(x - p.x, p.x + p.w - x, y - p.y, p.y + p.h - y),
          groveChance = edge < 90 ? 0.9 : 0.35;
        if (onLawn || parkPondBlocked(x, y, 16)) continue;
        if (
          x > c.calisthenics.x - c.calisthenics.w / 2 - 14 &&
          x < c.calisthenics.x + c.calisthenics.w / 2 + 14 &&
          y > c.calisthenics.y - c.calisthenics.h / 2 - 14 &&
          y < c.calisthenics.y + c.calisthenics.h / 2 + 14
        )
          continue;
        if (c.foodTrucks.some((t) => Math.hypot(t.x - x, t.y - y) < 46)) continue;
        if (Math.abs(x - c.bandshell.x) < 165 && y > c.bandshell.y - 60 && y < c.bandshell.y + 165) continue;
        if (Math.abs(x - c.playground.x) < 85 && Math.abs(y - c.playground.y) < 60) continue;
        if (Math.abs(x - c.roseGarden.x) < 80 && Math.abs(y - c.roseGarden.y) < 80) continue;
        if (x > c.plaza.x - 10 && x < c.plaza.x + c.plaza.w + 10 && y > c.plaza.y - 10 && y < c.plaza.y + c.plaza.h + 10) continue;
        if (Math.hypot(x - c.gazebo.x, y - c.gazebo.y) < 50 || Math.hypot(x - c.statue.x, y - c.statue.y) < 40) continue;
        if (route.some((q, k) => k && segmentDistance(x, y, route[k - 1], q) < 24)) continue;
        if (((j * 31) % 100) / 100 > groveChance) continue;
        if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < 26)) continue;
        // `park` and `nearPond` choose the species (vegetation3d.js: willows by the water).
        const t = { x, y, r: 13 + (j % 6) * 2, blossom: j % 4 === 0, park: 'commons', nearPond: parkPondBlocked(x, y, 70) };
        drawTree(x, y, t.r);
        Object.assign(trees[trees.length - 1], t);
        planted++;
      }
    }
    function seedParkTrees() {
      seedCommonsTrees();
      for (const [i, p] of CITY_PARKS.entries()) {
        if (p.kind === 'commons') continue;
        for (let j = 0; j < 9 + (i % 8); j++) {
          const x = p.x + 38 + ((j * 83 + i * 61) % (p.w - 76)),
            y = p.y + 40 + ((j * 137 + i * 43) % (p.h - 80));
          if (parkWalk(p).some((q, k) => k && segmentDistance(x, y, parkWalk(p)[k - 1], q) < 25))
            continue;
          if (
            parkPondBlocked(x, y, 12) ||
            (p.kind === 'courts' && x > p.x + 55 && x < p.x + 220 && y > p.y + 50 && y < p.y + 163)
          )
            continue;
          const t = {
            x,
            y,
            r: 12 + (j % 5) * 2,
            blossom: ['pond', 'orchard', 'commons'].includes(p.kind) && j % 3 === 0,
            tropical: p.kind === 'botanic',
            park: p.kind,
            nearPond: parkPondBlocked(x, y, 60),
          };
          drawTree(x, y, t.r);
          Object.assign(trees[trees.length - 1], t);
        }
      }
    }
    function populateRecreation() {
      populateGardenLife();
      for (const p of CITY_PARKS) {
        const route = parkWalk(p);
        for (let j = 0; j < (p.kind === 'commons' ? 22 : 4); j++) {
          const k = j % (route.length - 1),
            a = route[k],
            b = route[k + 1],
            t = (j * 0.37) % 1,
            x = a[0] + (b[0] - a[0]) * t,
            y = a[1] + (b[1] - a[1]) * t;
          if (!solid(x, y, 6))
            pedestrians.push({
              x,
              y,
              a: 0,
              hp: 30,
              color: randomChoice(['#dbbd9d', '#87ad9e', '#ca94a8', '#a0b8d1']),
              flee: 0,
              timer: 5,
              walk: 0,
              parkRoute: route,
              parkIndex: k + 1,
              jogger: j % 5 === 0,
            });
        }
        const [x, y] = parkLoop(p, 15)[0];
        if (canSpawnCar('bicycle', x, y + 22, Math.PI / 2, 2))
          makeCar(
            'bicycle',
            x,
            y + 22,
            Math.PI / 2,
            false,
            p.kind === 'commons' ? '#edbb65' : '#79c7ba',
          );
      }
      for (const t of MOUNTAIN_TRAILS) {
        const [x, y] = t.points[0];
        if (canSpawnCar('bicycle', x + 32, y + 34, 0, 2))
          makeCar('bicycle', x + 32, y + 34, 0, false, '#e0b76b');
      }
    }
    /**
     * OUTDOOR GYM
     * Regulars work a station in sets: a burst of reps, then a rest where they
     * shake out and talk. Stations are laid out along the rig from the shared
     * calisthenics plan so the meshes and the people agree.
     */
    function gymStations() {
      const cal = COMMONS.calisthenics;
      return [
        { x: cal.x - 62, y: cal.y - 24, kind: 'pullup' },
        { x: cal.x - 22, y: cal.y - 24, kind: 'pullup' },
        { x: cal.x + 22, y: cal.y - 26, kind: 'dip' },
        { x: cal.x + 62, y: cal.y - 10, kind: 'rings' },
        { x: cal.x - 46, y: cal.y + 28, kind: 'bars' },
        { x: cal.x + 6, y: cal.y + 30, kind: 'mat' },
        { x: cal.x + 56, y: cal.y + 30, kind: 'mat' },
      ];
    }
    function updateGymGoer(person, deltaSeconds) {
      if ((person.vendor || person.queueing) && person.flee <= 0 && person.hp > 0) {
        person.walking = false;
        person.sitting = false;
        if (person.vendor) pedSay(person, 'vendor', deltaSeconds * 0.09);
        else pedSay(person, 'idle', deltaSeconds * 0.06);
        return true;
      }
      const station = person.gymStation;
      if (!station || person.flee > 0 || person.hp <= 0) return false;
      person.walking = false;
      person.sitting = false;
      const d = distanceBetween(person, station);
      if (d > 5) {
        person.a = headingBetween(person, station);
        person.walking = true;
        person.walk += deltaSeconds * strideRate(5 * KMH);
        moveBody(person, Math.cos(person.a) * 5 * KMH * deltaSeconds, Math.sin(person.a) * 5 * KMH * deltaSeconds, 5);
        return true;
      }
      person.a = station.kind === 'mat' ? person.a : -Math.PI / 2;
      person.gymTimer = (person.gymTimer || 0) - deltaSeconds;
      if (person.gymTimer <= 0) {
        person.gymWorking = !person.gymWorking;
        person.gymTimer = person.gymWorking ? 7 + seededRandom() * 6 : 6 + seededRandom() * 7;
        if (!person.gymWorking) pedSay(person, 'gym', 0.8);
      }
      // `exercise` drives the rep animation in the renderer; 0 is a standing rest.
      person.exercise = person.gymWorking
        ? 0.5 + 0.5 * Math.sin(gameTime * (station.kind === 'mat' ? 3.1 : 2.3) + (person.gymPhase || 0))
        : null;
      person.exerciseKind = station.kind;
      if (!person.gymWorking && seededRandom() < deltaSeconds * 0.12) pedSay(person, 'gym', 1);
      return true;
    }
    function updateParkWalker(person, deltaSeconds) {
      if (!person.parkRoute || person.flee > 0) return false;
      const route = person.parkRoute,
        q = route[person.parkIndex % route.length],
        target = {
          x: q[0],
          y: q[1],
        };
      if (distanceBetween(person, target) < 12)
        person.parkIndex = (person.parkIndex + 1) % route.length;
      person.a = headingBetween(person, target);
      const speed = (person.jogger ? 10 : 4.5) * KMH;
      person.walk += deltaSeconds * strideRate(speed);
      if (
        moveBody(
          person,
          Math.cos(person.a) * speed * deltaSeconds,
          Math.sin(person.a) * speed * deltaSeconds,
          5,
        )
      )
        person.parkIndex = (person.parkIndex + 1) % route.length;
      return true;
    }
    /* The gym regulars and the food-truck staff who make the Garden feel used. */
    function populateGardenLife() {
      const stations = gymStations();
      for (let i = 0; i < stations.length; i++) {
        const s = stations[i],
          x = s.x + ((i % 3) - 1) * 6,
          y = s.y + 22;
        if (solid(x, y, 6)) continue;
        pedestrians.push({
          x,
          y,
          a: -Math.PI / 2,
          hp: 30,
          color: randomChoice(['#c9705f', '#4f7f8d', '#d3c07a', '#6f8f63', '#b07fa3']),
          flee: 0,
          timer: 6,
          walk: 0,
          gymStation: s,
          gymWorking: i % 2 === 0,
          gymTimer: 2 + i * 1.3,
          gymPhase: i * 0.9,
        });
      }
      for (const truck of COMMONS.foodTrucks) {
        const x = truck.x + Math.cos(truck.a + Math.PI / 2) * 26,
          y = truck.y + Math.sin(truck.a + Math.PI / 2) * 26;
        if (!solid(x, y, 6))
          pedestrians.push({
            x,
            y,
            a: truck.a - Math.PI / 2,
            hp: 30,
            color: '#e0d6bd',
            flee: 0,
            timer: 8,
            walk: 0,
            vendor: truck,
            state: 'idle',
          });
        // A short queue: people actually buy lunch here.
        for (let q = 0; q < 2; q++) {
          const qx = x + Math.cos(truck.a) * (20 + q * 15),
            qy = y + Math.sin(truck.a) * (20 + q * 15);
          if (solid(qx, qy, 6)) continue;
          pedestrians.push({
            x: qx,
            y: qy,
            a: truck.a + Math.PI,
            hp: 30,
            color: randomChoice(['#dbbd9d', '#87ad9e', '#ca94a8', '#a0b8d1']),
            flee: 0,
            timer: 9,
            walk: 0,
            queueing: truck,
            state: 'idle',
          });
        }
      }
    }
    // Boxes round every pond and the boathouse: a cheap "near any park water?"
    // test so the physics step only runs the ellipse tests beside a pond.
    let parkPondBoxes = null;
    function parkPondNear(x, y, reach = 0) {
      if (!parkPondBoxes) {
        const c = COMMONS,
          box = (cx, cy, r) => ({ x0: cx - r, x1: cx + r, y0: cy - r, y1: cy + r });
        parkPondBoxes = [
          box(c.lake.x, c.lake.y, Math.max(c.lake.rx, c.lake.ry)),
          { x0: c.boathouse.x, x1: c.boathouse.x + c.boathouse.w, y0: c.boathouse.y, y1: c.boathouse.y + c.boathouse.h },
          ...CITY_PARKS.filter((p) => ['pond', 'botanic'].includes(p.kind)).map((p) =>
            box(p.x + p.w * 0.5, p.y + p.h * 0.5, Math.max(p.w * 0.17, p.h * 0.23)),
          ),
        ];
      }
      for (let i = 0; i < parkPondBoxes.length; i++) {
        const b = parkPondBoxes[i];
        if (x > b.x0 - reach && x < b.x1 + reach && y > b.y0 - reach && y < b.y1 + reach) return true;
      }
      return false;
    }
    // Inside the rotated ellipse (centre cx, cy, radii rx, ry grown by r, turn a).
    function insidePondEllipse(x, y, r, cx, cy, rx, ry, a) {
      const dx = x - cx,
        dy = y - cy,
        headingCosine = Math.cos(a),
        headingSine = Math.sin(a);
      return (
        ((dx * headingCosine + dy * headingSine) / (rx + r)) ** 2 +
          ((-dx * headingSine + dy * headingCosine) / (ry + r)) ** 2 <
        1
      );
    }
    // The pond and botanic parks' ponds, with bounds (asked by solid() for every
    // step; the list of parks never changes once the city is laid out).
    let parkPondCache = null;
    function parkPondList() {
      if (parkPondCache && parkPondCache.parks === CITY_PARKS.length) return parkPondCache.ponds;
      const ponds = CITY_PARKS.filter((p) => p.kind === 'pond' || p.kind === 'botanic').map((p) => ({
        cx: p.x + p.w * 0.5,
        cy: p.y + p.h * 0.5,
        rx: p.w * 0.17,
        ry: p.h * 0.23,
        reach: Math.max(p.w * 0.17, p.h * 0.23),
      }));
      parkPondCache = { parks: CITY_PARKS.length, ponds };
      return ponds;
    }
    function parkPondBlocked(x, y, r = 0) {
      const c = COMMONS;
      if (
        insidePondEllipse(x, y, r, c.lake.x, c.lake.y, c.lake.rx, c.lake.ry, c.lake.a) &&
        !(Math.abs(x - c.dock.x) + r < c.dock.w / 2 && y > c.dock.y - c.dock.h && y < c.dock.y + 12)
      )
        return true;
      if (
        x + r > c.boathouse.x &&
        x - r < c.boathouse.x + c.boathouse.w &&
        y + r > c.boathouse.y &&
        y - r < c.boathouse.y + c.boathouse.h
      )
        return true;
      const ponds = parkPondList();
      for (let i = 0; i < ponds.length; i++) {
        const p = ponds[i];
        if (Math.abs(x - p.cx) > p.reach + r || Math.abs(y - p.cy) > p.reach + r) continue;
        if (insidePondEllipse(x, y, r, p.cx, p.cy, p.rx, p.ry, 0.25)) return true;
      }
      return false;
    }
    // END SUBSYSTEM: src/renewal.js
