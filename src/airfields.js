    // BEGIN SUBSYSTEM: src/airfields.js — Runways, taxiways and the reclaimed runway piers
    /**
     * Runways, taxiways and the reclaimed runway piers
     * Source: src/airfields.js
     * Scope: shared game closure (after county.js, before aviation.js).
     *
     * RUNWAYS is the one plan of every runway the planes use: aviation.js reads
     * its landing rectangles (AIRFIELDS), the ground painters (paintAirfieldGround)
     * draw the flat version for the 2D view and the maps, and airfields3d.js
     * builds the lit 3D version (markings in a shader, lights in the glow field).
     *
     * The lengths come from the aircraft (aviation.js, AIRFRAME PERFORMANCE,
     * measured headless at the real scale): each runway is 1.3-1.5 times the
     * longest take-off roll of what uses it, with a blast pad at each end.
     *   SOUTHPORT 18/36   460 m x 29.5 m  GA strip for the Serrano courier
     *                                     (roll 230-300 m). Most of it runs out
     *                                     over the sea on a reclaimed pier.
     *   OCEANVIEW 09/27  1280 m x 30 m    the regional runway for the Aurelia jet
     *                                     (roll 500-600 m) and the Meridian
     *                                     airliner (800-950 m). The island only
     *                                     has room for 550 m, so the runway runs
     *                                     west over a reclaimed pier into the
     *                                     open sea, Kai Tak style.
     * A full 1,800-2,500 m airliner runway does not fit anywhere: the whole map
     * is about 2 km across.
     *
     * Units: map units (UNITS_PER_METRE = 8). A runway runs along `axis` on the
     * centre line `line`, from the paved end `from` to `to` (from < to); `ends`
     * are the designations of the thresholds at `from` and at `to` (the landing
     * heading / 10: a plane landing on 36 flies north and touches down at the
     * south end). Markings follow ICAO Annex 14 for the runway's length:
     * threshold stripes, designation, centre line, aiming point and touchdown
     * zone bars (`aim`, `touchdown`, in metres from the threshold).
     */
    const RUNWAYS = [
      {
        id: 'southport',
        name: 'SOUTHPORT',
        airport: 'SOUTHPORT AIRPORT',
        axis: 'y',
        line: 418,
        from: 4280,
        to: 7960,
        width: 236,
        ends: ['18', '36'],
        blast: [120, 240],
        // Metres from each threshold; a short runway has its aiming point at 150 m.
        aim: 150,
        aimLength: 30,
        touchdown: [],
        centreLine: 0.45,
        approachLights: [false, false],
        // PAPI boxes to the left of each landing direction (compact: 3 m apart).
        papi: [true, true],
        windsocks: [{ x: 214, y: 4640 }],
      },
      {
        id: 'oceanview',
        name: 'OCEANVIEW',
        airport: 'OCEANVIEW INTERNATIONAL',
        axis: 'x',
        line: 9884,
        from: -4040,
        to: 6200,
        width: 240,
        ends: ['09', '27'],
        blast: [240, 240],
        aim: 300,
        aimLength: 45,
        touchdown: [150, 450, 600],
        centreLine: 0.9,
        approachLights: [true, true],
        papi: [true, true],
        windsocks: [
          { x: 5420, y: 10160 },
          { x: -3500, y: 10050 },
        ],
      },
    ];
    // Reclaimed land under the runway extensions: a rock revetment (shoreStyle
    // 'rock') round a grass and concrete apron. They join LAND_REGIONS, so the
    // coast, the water shader, the maps and landAt() all know them.
    const RUNWAY_PIERS = [
      {
        id: 'southport-pier',
        name: 'SOUTHPORT AIRPORT',
        airport: 'SOUTHPORT AIRPORT',
        color: '#77847e',
        ground: '#8a9386',
        polygon: [
          [196, 5300],
          [760, 5300],
          [760, 8240],
          [196, 8240],
        ],
      },
      {
        id: 'oceanview-pier',
        name: 'OCEANVIEW INTERNATIONAL',
        airport: 'OCEANVIEW INTERNATIONAL',
        color: '#7f8b7a',
        ground: '#7e9068',
        polygon: [
          [-4320, 9620],
          [-4040, 9620],
          [-4040, 9600],
          [-3780, 9600],
          [-3780, 9620],
          [2250, 9620],
          [2250, 10080],
          [-4320, 10080],
        ],
      },
      {
        id: 'oceanview-pier-east',
        name: 'OCEANVIEW INTERNATIONAL',
        airport: 'OCEANVIEW INTERNATIONAL',
        color: '#7f8b7a',
        ground: '#748071',
        polygon: [
          [6000, 9690],
          [6480, 9690],
          [6480, 10080],
          [6000, 10080],
        ],
      },
    ];
    LAND_REGIONS.push(...RUNWAY_PIERS);
    /**
     * Taxiways: straight segments `from` -> `to` (map points) `width` wide, with
     * a yellow centre line; `hold` is the runway-holding position (distance in
     * units from `from`) whose solid lines face the runway at the `to` end.
     */
    const TAXIWAYS = [
      // Southport: a parallel taxiway down the pier and four connectors.
      { airport: 'SOUTHPORT', from: [700, 4300], to: [700, 7940], width: 80 },
      { airport: 'SOUTHPORT', from: [740, 4340], to: [536, 4340], width: 80, hold: 140 },
      { airport: 'SOUTHPORT', from: [1060, 5330], to: [740, 5330], width: 80 },
      { airport: 'SOUTHPORT', from: [740, 6120], to: [536, 6120], width: 80, hold: 140 },
      { airport: 'SOUTHPORT', from: [740, 7900], to: [536, 7900], width: 80, hold: 140 },
      // Oceanview: stubs from the apron down to the runway.
      ...[3750, 4500, 5260, 5910].map((x) => ({ airport: 'OCEANVIEW', from: [x, 9400], to: [x, 9764], width: 90, hold: 214 })),
      // The turn pad at the west end.
      { airport: 'OCEANVIEW', from: [-4040, 9690], to: [-3780, 9690], width: 150 },
    ];
    // A runway's paved rectangle (without the blast pads).
    function runwayRect(r) {
      const half = r.width / 2;
      return r.axis === 'x'
        ? { x: r.from, y: r.line - half, w: r.to - r.from, h: r.width }
        : { x: r.line - half, y: r.from, w: r.width, h: r.to - r.from };
    }
    // A map point `along` units from the `from` end and `across` units to the
    // side (+x for a north-south runway, +y for an east-west one).
    function runwayPoint(r, along, across = 0) {
      return r.axis === 'x' ? { x: r.from + along, y: r.line + across } : { x: r.line + across, y: r.from + along };
    }
    function runwayLength(r) {
      return r.to - r.from;
    }
    /* The runway under a point and which way along it `heading` points: the
       designation for that direction and how much runway is left ahead (units).
       The flight HUD shows it on the ground (RWY 27 · 1070 M LEFT). */
    function runwayUnder(x, y, heading) {
      for (const r of RUNWAYS) {
        const rect = runwayRect(r);
        if (x < rect.x || x > rect.x + rect.w || y < rect.y || y > rect.y + rect.h) continue;
        const along = r.axis === 'x' ? x - r.from : y - r.from,
          forward = (r.axis === 'x' ? Math.cos(heading) : Math.sin(heading)) >= 0;
        return { runway: r, designation: forward ? r.ends[0] : r.ends[1], remaining: forward ? runwayLength(r) - along : along };
      }
      return null;
    }
    // The runway pier (reclaimed land) under a point, if any.
    function runwayPierAt(x, y) {
      return RUNWAY_PIERS.find((p) => regionContains(p, x, y)) || null;
    }
    /**
     * PAPI units: four boxes beside the aiming point, left of the landing
     * direction, 2.5 m apart from 4 m off the edge (a compact layout for the
     * narrow piers; ICAO spaces them 9 m apart from 15 m out). Each shows white
     * above its angle and red below: 3.5, 3.17, 2.83 and 2.5 degrees from the
     * one nearest the runway outwards, so on a 3 degree glide path the pilot
     * sees two red (inside) and two white (outside).
     */
    const PAPI_ANGLES = [3.5, 3.17, 2.83, 2.5];
    function papiUnits(r) {
      const units = [];
      const L = runwayLength(r),
        half = r.width / 2;
      r.ends.forEach((designation, end) => {
        if (!r.papi[end]) return;
        const along = end === 0 ? r.aim * UNITS_PER_METRE : L - r.aim * UNITS_PER_METRE,
          // Facing the landing direction, left is north on 09 and south on 27,
          // east on 18 and west on 36 (map y grows southwards).
          leftSide = r.axis === 'x' ? (end === 0 ? -1 : 1) : end === 0 ? 1 : -1,
          threshold = runwayPoint(r, end === 0 ? 0 : L);
        PAPI_ANGLES.forEach((angle, k) => {
          const p = runwayPoint(r, along, leftSide * (half + 32 + k * 20));
          units.push({ runway: r, end, designation, angle, k, x: p.x, y: p.y, threshold });
        });
      });
      return units;
    }
    const PAPI_UNITS = RUNWAYS.flatMap(papiUnits);
    // The aircraft the PAPIs are read from: the player's plane in the air.
    function papiObserver() {
      const c = player.car;
      return c && c.type === 'plane' && aircraftClearance(c) > 1 ? c : null;
    }
    // Whether a PAPI unit shows white to `observer` (red below its angle). From
    // behind the runway end, or with nobody flying, it shows on-slope.
    function papiShowsWhite(unit, observer) {
      if (!observer) return unit.k >= 2;
      const distance = Math.hypot(observer.x - unit.x, observer.y - unit.y),
        onApproach =
          (observer.x - unit.threshold.x) * (unit.threshold.x - unit.x) + (observer.y - unit.threshold.y) * (unit.threshold.y - unit.y) > 0;
      if (!onApproach && distance > 400) return unit.k >= 2;
      return (Math.atan2(entityElevation(observer) - 1.3, distance) * 180) / Math.PI > unit.angle;
    }
    /* The plan and its state for DeadEndCity.airfields(): each runway in metres
       with its thresholds, blast pads, lights and what its PAPIs show the
       player's aircraft ('W' white, 'R' red, nearest the runway first). */
    function airfieldReport() {
      const observer = papiObserver();
      return {
        runways: RUNWAYS.map((r) => {
          const L = runwayLength(r);
          return {
            name: r.name,
            airport: r.airport,
            designations: r.ends.join('/'),
            lengthM: Math.round(worldMeters(L)),
            widthM: +worldMeters(r.width).toFixed(1),
            blastPadsM: r.blast.map((b) => Math.round(worldMeters(b))),
            thresholds: r.ends.map((designation, end) => ({ designation, ...runwayPoint(r, end === 0 ? 0 : L) })),
            aimingPointM: r.aim,
            touchdownZoneM: r.touchdown,
            approachLights: r.ends.filter((d, end) => r.approachLights[end]),
            papi: Object.fromEntries(
              r.ends.map((designation, end) => [
                designation,
                PAPI_UNITS.filter((u) => u.runway === r && u.end === end)
                  .map((u) => (papiShowsWhite(u, observer) ? 'W' : 'R'))
                  .join(''),
              ]),
            ),
          };
        }),
        piers: RUNWAY_PIERS.map((p) => p.id),
        taxiways: TAXIWAYS.length,
        aircraft: vehicles
          .filter((c) => c.type === 'plane')
          .map((c) => ({ airframe: c.airframe || 'courier', x: Math.round(c.x), y: Math.round(c.y), district: districtAt(c.x, c.y), hp: Math.round(c.hp) })),
      };
    }
    /* ---- Flat ground (2D view, the maps, the baked 3D ground sheets) ---------------------- */
    function paintAirfieldGround(drawingContext, detail = true) {
      const d = drawingContext;
      d.save();
      for (const pier of RUNWAY_PIERS) {
        regionPath(d, pier);
        d.fillStyle = pier.ground;
        d.fill();
      }
      for (const t of TAXIWAYS) {
        strokeTaxiway(d, t, detail);
      }
      for (const r of RUNWAYS) paintRunway(d, r, detail);
      d.restore();
    }
    function strokeTaxiway(d, t, detail) {
      d.lineCap = 'square';
      d.strokeStyle = '#4b5359';
      d.lineWidth = t.width;
      d.beginPath();
      d.moveTo(t.from[0], t.from[1]);
      d.lineTo(t.to[0], t.to[1]);
      d.stroke();
      if (!detail) return;
      d.strokeStyle = '#d1ac3c';
      d.lineWidth = 3;
      d.beginPath();
      d.moveTo(t.from[0], t.from[1]);
      d.lineTo(t.to[0], t.to[1]);
      d.stroke();
      if (t.hold !== undefined) {
        const len = Math.hypot(t.to[0] - t.from[0], t.to[1] - t.from[1]),
          ux = (t.to[0] - t.from[0]) / len,
          uy = (t.to[1] - t.from[1]) / len;
        d.fillStyle = '#d1ac3c';
        for (let k = 0; k < 4; k++) {
          const s = t.hold + k * 5,
            cx = t.from[0] + ux * s,
            cy = t.from[1] + uy * s;
          d.save();
          d.translate(cx, cy);
          d.rotate(Math.atan2(uy, ux));
          if (k < 2) d.fillRect(-1.2, -t.width / 2, 2.4, t.width);
          else for (let y = -t.width / 2; y < t.width / 2; y += 16) d.fillRect(-1.2, y, 2.4, 9);
          d.restore();
        }
      }
    }
    function paintRunway(d, r, detail) {
      const L = runwayLength(r),
        half = r.width / 2,
        M = UNITS_PER_METRE;
      // Work in runway space: x along (units from `from`), y across.
      d.save();
      if (r.axis === 'x') d.translate(r.from, r.line);
      else {
        d.translate(r.line, r.from);
        d.rotate(Math.PI / 2);
        d.scale(1, -1);
      }
      // Blast pads, then the runway.
      d.fillStyle = '#3f464a';
      d.fillRect(-r.blast[0], -half, r.blast[0], r.width);
      d.fillRect(L, -half, r.blast[1], r.width);
      d.fillStyle = '#343c43';
      d.fillRect(0, -half, L, r.width);
      if (detail) {
        // Yellow chevrons on the blast pads, pointing at the runway.
        d.strokeStyle = '#cfa93e';
        d.lineWidth = 0.9 * M;
        for (const [end, sign] of [
          [0, -1],
          [L, 1],
        ]) {
          const pad = r.blast[end === 0 ? 0 : 1];
          for (let p = 10 * M; p < pad; p += 10 * M) {
            d.beginPath();
            d.moveTo(end + sign * (p + half * 0.9), -half * 0.9);
            d.lineTo(end + sign * p, 0);
            d.lineTo(end + sign * (p + half * 0.9), half * 0.9);
            d.stroke();
          }
        }
        d.fillStyle = '#e6e3d6';
        // Side stripes.
        d.fillRect(0, -half + 0.6 * M, L, 0.9 * M);
        d.fillRect(0, half - 1.5 * M, L, 0.9 * M);
        for (const [end, dir] of [
          [0, 1],
          [L, -1],
        ]) {
          const at = (m) => end + dir * m * M;
          // Threshold stripes: 30 m long from 6 m in, 1.8 m wide, 1.8 m apart.
          for (let k = 0; k < 4; k++)
            for (const side of [-1, 1]) {
              const inner = (1.8 + k * 3.6) * M;
              d.fillRect(Math.min(at(6), at(36)), side > 0 ? inner : -inner - 1.8 * M, 30 * M, 1.8 * M);
            }
          // Aiming point and touchdown zone bars.
          const bar = (m, length, inner, width, count = 1) => {
            for (let k = 0; k < count; k++)
              for (const side of [-1, 1]) {
                const offset = (inner + k * (width + 1.2)) * M;
                d.fillRect(Math.min(at(m), at(m + length)), side > 0 ? offset : -offset - width * M, length * M, width * M);
              }
          };
          bar(r.aim, r.aimLength, r.width > 238 ? 9 : 6, r.width > 238 ? 4 : 3);
          r.touchdown.forEach((m, i) => bar(m, 22.5, 6, 1.5, i === 0 ? 3 : 2));
        }
        // Centre line: 30 m stripes, 20 m gaps, between the designations.
        for (let m = 60; m + 30 < L / M - 60; m += 50) d.fillRect(m * M, (-r.centreLine / 2) * M, 30 * M, r.centreLine * M);
      }
      d.restore();
      if (detail) {
        // Designations, 9 m tall, read from the approach.
        d.fillStyle = '#e6e3d6';
        d.font = 'bold ' + 9 * M + 'px monospace';
        d.textAlign = 'center';
        d.textBaseline = 'middle';
        r.ends.forEach((designation, end) => {
          const p = runwayPoint(r, end === 0 ? 52 * M : L - 52 * M),
            // The top of the digits points along the landing direction.
            landing = r.axis === 'x' ? (end === 0 ? 0 : Math.PI) : end === 0 ? Math.PI / 2 : -Math.PI / 2;
          d.save();
          d.translate(p.x, p.y);
          d.rotate(landing + Math.PI / 2);
          d.fillText(designation, 0, 0);
          d.restore();
        });
      }
    }
    // END SUBSYSTEM: src/airfields.js
