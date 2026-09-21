    // BEGIN SUBSYSTEM: src/renewal.js — Parks and recreation
    /**
     * Parks and recreation
     * Source: src/renewal.js
     * Scope: shared game closure.
     * Distinct park layouts, ponds, boardwalks, walkers, joggers and bicycles.
     */
    /* Shared park plans drive scenery, recreation, traffic exclusions and the city map. */
    const CENTRAL_PARK = {
      id: 'commons',
      name: 'CENTRAL COMMONS',
      kind: 'commons',
      x: 1735,
      y: 710,
      w: 370,
      h: 1395,
    };
    const CITY_PARKS = [
      CENTRAL_PARK,
      ...PARKS.filter(([bx, by]) => bx !== 3 || ![1, 2, 3].includes(by))
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
      return x > 1664 && x < 2176 && (Math.abs(y - 1152) < 70 || Math.abs(y - 1664) < 70);
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
            [1960, 800],
            [2010, 1075],
            [1840, 1220],
            [1830, 1510],
            [2000, 1680],
            [2000, 1995],
            [1820, 2025],
            [1790, 1780],
            [1800, 1510],
            [1810, 1210],
            [1780, 1000],
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
        if (p.kind === 'commons') {
          drawingContext.fillStyle = '#487f89';
          drawingContext.beginPath();
          drawingContext.ellipse(1902, 965, 67, 133, 0.16, 0, TAU);
          drawingContext.fill();
          drawingContext.strokeStyle = '#a5b49b';
          drawingContext.lineWidth = 9;
          drawingContext.stroke();
          drawingContext.fillStyle = '#aa8560';
          drawingContext.fillRect(1830, 977, 148, 16);
          drawingContext.strokeStyle = '#d4bc91';
          drawingContext.lineWidth = 2;
          drawingContext.strokeRect(1830, 977, 148, 16);
          strokeRoad(
            drawingContext,
            [
              [1735, 1400],
              [1900, 1400],
              [2105, 1400],
            ],
            16,
            '#d1c5a2',
          );
          drawingContext.fillStyle = '#98aa76';
          drawingContext.beginPath();
          drawingContext.ellipse(1920, 1530, 82, 100, 0, 0, TAU);
          drawingContext.fill();
        }
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
            drawingContext.font = 'bold 15px Arial';
            drawingContext.fillText('WALK · RIDE · UNWIND', 1920, 1440);
          }
        }
      }
    }
    function seedParkTrees() {
      for (const [i, p] of CITY_PARKS.entries()) {
        for (let j = 0; j < (p.kind === 'commons' ? 55 : 9 + (i % 8)); j++) {
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
      if (inside(1902, 965, 67, 133, 0.16) && !(x > 1825 && x < 1983 && Math.abs(y - 985) + r < 8))
        return true;
      return CITY_PARKS.some(
        (p) =>
          ['pond', 'botanic'].includes(p.kind) &&
          inside(p.x + p.w * 0.5, p.y + p.h * 0.5, p.w * 0.17, p.h * 0.23, 0.25),
      );
    }
    // END SUBSYSTEM: src/renewal.js
