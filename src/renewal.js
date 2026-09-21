    // BEGIN SUBSYSTEM: src/renewal.js — Parks and recreation
    /**
     * Parks and recreation
     * Source: src/renewal.js
     * Scope: shared game closure.
     * Distinct park layouts, ponds, boardwalks, walkers, joggers and bicycles.
     */
    /* Shared park plans drive scenery, recreation, traffic exclusions and the city map. */
    /**
     * CENTRAL COMMONS
     * Two blocks wide and three deep (x 1735..2599, y 710..2105), the city's great
     * park. The elevated City Line crosses it north to south on x = 2176 with the
     * Central Commons station in the middle; the streets that used to cut the park
     * (Union St, Garden St and Cannery St inside it) are closed to traffic.
     * Layout, west to east and north to south:
     *   Great Lawn (1790..2110, 780..1330)     Commons Lake (ellipse at 2395,1010)
     *   Statue walk / station plaza (1380..1540 around the station)
     *   Rose garden and pergola (1900,1750)     Bandshell and lawn seating (2400,1700)
     *   Playground (1900,1980)                  Gazebo corner (2480,1900)
     */
    const CENTRAL_PARK = {
      id: 'commons',
      name: 'CENTRAL COMMONS',
      kind: 'commons',
      x: 1735,
      y: 710,
      w: 864,
      h: 1395,
    };
    const COMMONS = {
      lake: { x: 2395, y: 1010, rx: 150, ry: 215, a: 0.15 },
      dock: { x: 2395, y: 1215, w: 24, h: 70 },
      boathouse: { x: 2350, y: 1250, w: 90, h: 52 },
      plaza: { x: 2020, y: 1380, w: 310, h: 160 },
      fountain: { x: 2300, y: 1460 },
      bandshell: { x: 2400, y: 1690 },
      roseGarden: { x: 1900, y: 1760 },
      playground: { x: 1900, y: 1985 },
      gazebo: { x: 2480, y: 1905 },
      statue: { x: 1950, y: 1400 },
      lawn: { x: 1790, y: 780, w: 320, h: 550 },
    };
    const CITY_PARKS = [
      CENTRAL_PARK,
      ...PARKS.filter(([bx, by]) => ![3, 4].includes(bx) || ![1, 2, 3].includes(by))
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
          x: ROAD_CENTERS[bx] + 89 + (i % 3) * 17,
          y: ROAD_CENTERS[by] + 89 + (i % 2) * 23,
          w: [268, 334, 218, 292][i % 4],
          h: [245, 334, 192, 310][i % 4],
        }))
        .filter((p) => validCityBlock(p.x, p.y, p.w, p.h)),
    ];
    function parkStreetClosed(x, y) {
      return (
        (x > 1664 && x < 2688 && (Math.abs(y - 1152) < 70 || Math.abs(y - 1664) < 70)) ||
        (Math.abs(x - 2176) < 70 && y > 700 && y < 2115)
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
            [1800, 765],
            [2100, 770],
            [2230, 860],
            [2250, 1300],
            [2395, 1310],
            [2540, 1240],
            [2560, 1450],
            [2470, 1640],
            [2300, 1500],
            [2170, 1570],
            [2000, 1600],
            [1880, 1780],
            [1900, 1990],
            [2100, 2040],
            [2380, 2030],
            [2470, 1900],
            [2300, 1790],
            [2200, 1700],
            [1990, 1420],
            [1790, 1350],
            [1800, 765],
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
            drawingContext.fillText('GREAT LAWN', 1950, 1060);
            drawingContext.fillText('COMMONS LAKE', 2395, 1020);
            drawingContext.fillText('BANDSHELL', 2400, 1890);
            drawingContext.fillText('ROSE GARDEN', 1900, 1835);
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
    }
    function seedCommonsTrees() {
      const p = CENTRAL_PARK,
        c = COMMONS,
        route = parkWalk(p);
      let planted = 0;
      for (let j = 0; j < 400 && planted < 150; j++) {
        const x = p.x + 30 + ((j * 733 + 91) % (p.w - 60)),
          y = p.y + 30 + ((j * 1217 + 37) % (p.h - 60)),
          onLawn = x > c.lawn.x + 20 && x < c.lawn.x + c.lawn.w - 20 && y > c.lawn.y + 20 && y < c.lawn.y + c.lawn.h - 20,
          edge = Math.min(x - p.x, p.x + p.w - x, y - p.y, p.y + p.h - y),
          groveChance = edge < 90 ? 0.9 : 0.35;
        if (onLawn || Math.abs(x - 2176) < 34 || parkPondBlocked(x, y, 16)) continue;
        if (Math.abs(x - c.bandshell.x) < 165 && y > c.bandshell.y - 60 && y < c.bandshell.y + 165) continue;
        if (Math.abs(x - c.playground.x) < 85 && Math.abs(y - c.playground.y) < 60) continue;
        if (Math.abs(x - c.roseGarden.x) < 80 && Math.abs(y - c.roseGarden.y) < 80) continue;
        if (x > c.plaza.x - 10 && x < c.plaza.x + c.plaza.w + 10 && y > c.plaza.y - 10 && y < c.plaza.y + c.plaza.h + 10) continue;
        if (Math.hypot(x - c.gazebo.x, y - c.gazebo.y) < 50 || Math.hypot(x - c.statue.x, y - c.statue.y) < 40) continue;
        if (route.some((q, k) => k && segmentDistance(x, y, route[k - 1], q) < 24)) continue;
        if (((j * 31) % 100) / 100 > groveChance) continue;
        if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < 26)) continue;
        const t = { x, y, r: 13 + (j % 6) * 2, blossom: j % 4 === 0 };
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
          };
          drawTree(x, y, t.r);
          Object.assign(trees[trees.length - 1], t);
        }
      }
    }
    function populateRecreation() {
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
      const speed = person.jogger ? 52 : 22;
      person.walk += deltaSeconds * (person.jogger ? 13 : 6);
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
    function parkPondBlocked(x, y, r = 0) {
      const inside = (cx, cy, rx, ry, a) => {
        const dx = x - cx,
          dy = y - cy,
          headingCosine = Math.cos(a),
          headingSine = Math.sin(a);
        return (
          ((dx * headingCosine + dy * headingSine) / (rx + r)) ** 2 +
            ((-dx * headingSine + dy * headingCosine) / (ry + r)) ** 2 <
          1
        );
      };
      const c = COMMONS;
      if (
        inside(c.lake.x, c.lake.y, c.lake.rx, c.lake.ry, c.lake.a) &&
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
      return CITY_PARKS.some(
        (p) =>
          ['pond', 'botanic'].includes(p.kind) &&
          inside(p.x + p.w * 0.5, p.y + p.h * 0.5, p.w * 0.17, p.h * 0.23, 0.25),
      );
    }
    // END SUBSYSTEM: src/renewal.js
