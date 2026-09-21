    // BEGIN SUBSYSTEM: src/sports-world.js — City sports venue layout
    /**
     * Sports venues in the city
     * Source: src/sports-world.js
     * Scope: shared game closure.
     * The stadium lot, collision, road exclusions, ground painting and map destinations.
     * Match rules live in sports.js; three-dimensional models live in sports3d.js.
     */
    const STADIUM_LOT = { x: 2250, y: 4288, w: 875, h: 620 };
    // Tall fixtures have separate height bands so aircraft hit the lights/boards,
    // while people can still walk beneath the entrance beam and elevated displays.
    const SPORTS_FIXTURES = [
      ...[
        [2265, 4301],
        [3110, 4301],
        [2265, 4890],
        [3110, 4890],
      ].flatMap(([x, y]) => [
        { x: x - 4.5, y: y - 4.5, w: 9, h: 9, height: 144 },
        { x: x - 12.5, y: y - 12.5, w: 25, h: 25, minHeight: 140, height: 156 },
      ]),
      { x: 2621.5, y: 4315.5, w: 135, h: 4, minHeight: 84, height: 154 },
      { x: 2643.5, y: 4874.5, w: 91, h: 4, minHeight: 95, height: 143 },
      { x: 2651, y: 4861, w: 4, h: 4, height: 86 },
      { x: 2723, y: 4861, w: 4, h: 4, height: 86 },
      { x: 2650.5, y: 4860.5, w: 77, h: 5, minHeight: 84, height: 88 },
    ];
    const SPORTS_GROUND_SOLIDS = [
      ...STADIUM_STANDS,
      ...SPORTS_FIXTURES.filter((fixture) => !fixture.minHeight),
    ];
    const SPORTS_ENTRANCES = {
      basketball: { x: 1378.5, y: 2972 },
      soccer: { x: 2689, y: 4897 },
    };

    function inStadiumLot(x, y, margin = 0) {
      return (
        x > STADIUM_LOT.x - margin &&
        x < STADIUM_LOT.x + STADIUM_LOT.w + margin &&
        y > STADIUM_LOT.y - margin &&
        y < STADIUM_LOT.y + STADIUM_LOT.h + margin
      );
    }

    function stadiumOverlap(x, y, width, height) {
      return (
        x + width > STADIUM_LOT.x &&
        x < STADIUM_LOT.x + STADIUM_LOT.w &&
        y + height > STADIUM_LOT.y &&
        y < STADIUM_LOT.y + STADIUM_LOT.h
      );
    }

    function sportsBlocked(x, y, radius = 0) {
      if (!inStadiumLot(x, y, radius)) return false;
      return SPORTS_GROUND_SOLIDS.some(
        (stand) =>
          x + radius > stand.x &&
          x - radius < stand.x + stand.w &&
          y + radius > stand.y &&
          y - radius < stand.y + stand.h,
      );
    }

    function prepareSportsGround() {
      // Generic city scenery must not reappear inside the reserved stadium block.
      for (const scenery of [trees, lamps]) {
        for (let index = scenery.length - 1; index >= 0; index--) {
          if (inStadiumLot(scenery[index].x, scenery[index].y, 12)) scenery.splice(index, 1);
        }
      }
    }

    function paintSportsGround(context, detail = true) {
      context.save();
      const court = SPORTS_VENUES.basketball;
      context.fillStyle = '#244f62';
      context.fillRect(court.x - 7, court.y - 7, court.w + 14, court.h + 14);
      context.fillStyle = '#b36c48';
      context.fillRect(court.x, court.y, court.w, court.h);
      context.strokeStyle = '#fff1d3';
      context.lineWidth = 1.6;
      context.strokeRect(court.x, court.y, court.w, court.h);
      context.beginPath();
      context.moveTo(court.x + court.w / 2, court.y);
      context.lineTo(court.x + court.w / 2, court.y + court.h);
      context.stroke();
      context.beginPath();
      context.arc(court.x + court.w / 2, court.y + court.h / 2, 12, 0, TAU);
      context.stroke();
      for (const side of [0, 1]) {
        const baseline = court.x + side * court.w;
        context.fillStyle = '#357b87';
        context.fillRect(baseline - (side ? 28 : 0), court.y + court.h / 2 - 16, 28, 32);
        context.strokeRect(baseline - (side ? 28 : 0), court.y + court.h / 2 - 16, 28, 32);
        context.beginPath();
        context.arc(
          baseline + (side ? -court.hoopInset : court.hoopInset),
          court.y + court.h / 2,
          court.threePointRadius,
          side ? Math.PI / 2 : -Math.PI / 2,
          side ? Math.PI * 1.5 : Math.PI / 2,
        );
        context.stroke();
      }

      const pitch = SPORTS_VENUES.soccer;
      context.fillStyle = '#bdbaa4';
      context.fillRect(STADIUM_LOT.x, STADIUM_LOT.y, STADIUM_LOT.w, STADIUM_LOT.h);
      context.fillStyle = '#446967';
      context.fillRect(pitch.x - 32, pitch.y - 32, pitch.w + 64, pitch.h + 64);
      for (let stripe = 0; stripe < 12; stripe++) {
        context.fillStyle = stripe % 2 ? '#478344' : '#55984e';
        context.fillRect(pitch.x + (stripe * pitch.w) / 12, pitch.y, pitch.w / 12, pitch.h);
      }
      context.strokeStyle = '#f4f1df';
      context.lineWidth = 2;
      context.strokeRect(pitch.x, pitch.y, pitch.w, pitch.h);
      context.beginPath();
      context.moveTo(pitch.x + pitch.w / 2, pitch.y);
      context.lineTo(pitch.x + pitch.w / 2, pitch.y + pitch.h);
      context.stroke();
      context.beginPath();
      context.arc(pitch.x + pitch.w / 2, pitch.y + pitch.h / 2, 45, 0, TAU);
      context.stroke();
      for (const side of [0, 1]) {
        const baseline = pitch.x + side * pitch.w;
        context.strokeRect(baseline - (side ? 84 : 0), pitch.y + pitch.h / 2 - 104, 84, 208);
        context.strokeRect(baseline - (side ? 28 : 0), pitch.y + pitch.h / 2 - 58, 28, 116);
        context.strokeRect(
          baseline - (side ? 0 : pitch.goalDepth),
          pitch.y + pitch.h / 2 - pitch.goalWidth / 2,
          pitch.goalDepth,
          pitch.goalWidth,
        );
      }
      for (const stand of STADIUM_STANDS) {
        context.fillStyle = '#263a4c';
        context.fillRect(stand.x, stand.y, stand.w, stand.h);
        if (detail) {
          context.strokeStyle = '#718997';
          context.lineWidth = 2;
          context.strokeRect(stand.x + 4, stand.y + 4, stand.w - 8, stand.h - 8);
        }
      }
      if (detail) {
        context.fillStyle = '#f0eddb';
        context.font = 'bold 17px Arial';
        context.textAlign = 'center';
        context.fillText('SOUTH COAST STADIUM', pitch.x + pitch.w / 2, STADIUM_LOT.y + 37);
        context.font = 'bold 10px Arial';
        context.fillStyle = '#283e48';
        context.fillText('MAIN ENTRANCE', SPORTS_ENTRANCES.soccer.x, 4905);
      }
      context.restore();
    }

    function drawSportsMap(context, scale, big) {
      context.save();
      for (const [sport, entrance] of Object.entries(SPORTS_ENTRANCES)) {
        context.fillStyle = sport === 'basketball' ? '#f6ae62' : '#c7ee82';
        context.beginPath();
        context.arc(entrance.x, entrance.y, (big ? 5 : 3.5) / scale, 0, TAU);
        context.fill();
        if (big) {
          context.font = 'bold ' + 11 / scale + 'px Arial';
          context.textAlign = 'center';
          context.strokeStyle = '#152731';
          context.lineWidth = 3 / scale;
          const title = sport === 'basketball' ? 'BASKETBALL' : 'SOCCER STADIUM';
          context.strokeText(title, entrance.x, entrance.y + 18 / scale);
          context.fillText(title, entrance.x, entrance.y + 18 / scale);
        }
      }
      context.restore();
    }

    function showSportsDestination(sport) {
      const entrance = SPORTS_ENTRANCES[sport];
      mapCenter = { ...entrance };
      mapZoom = Math.max(mapZoom, 3.4);
      setWaypoint(entrance.x, entrance.y);
    }

    getElement('mapBasketball').onclick = () => showSportsDestination('basketball');
    getElement('mapStadium').onclick = () => showSportsDestination('soccer');
    // END SUBSYSTEM: src/sports-world.js
