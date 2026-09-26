    // BEGIN SUBSYSTEM: src/sports-world.js — City sports venue layout
    /**
     * Sports venues in the city
     * Source: src/sports-world.js
     * Scope: shared game closure.
     * The stadium lot, collision, road exclusions, ground painting and map destinations.
     * Match rules live in sports.js; three-dimensional models live in sports3d.js.
     */
    const STADIUM_LOT = { x: 2250, y: 4288, w: 875, h: 620 };
    // The paved forecourt south of the lot: entrance plaza, parking bays and the
    // dead-end stub of the north-south street that stops in front of the gates.
    const STADIUM_FORECOURT = { x: 2290, y: 4885, w: 800, h: 91 };
    /**
     * ENCLOSURE MODEL (shared by sportsBlocked, buildColliders and sports3d.js)
     * - STADIUM_STANDS, ground-level SPORTS_FIXTURES and STADIUM_ENCLOSURE stop
     *   people (solid -> sportsBlocked) and vehicles (physics static bodies).
     * - STADIUM_VEHICLE_BARRIERS (the bollard row and the turnstile span) stop
     *   vehicles only: people walk between the bollards and through the two gates.
     * The pitch is fenced four units outside the touchlines with advertising
     * boards, leaving a 26-unit concourse between the boards and every stand.
     * Two 26-unit openings cross the boards: the players' tunnel mouth in the
     * middle of the north side and, straight ahead of the turnstiles, the middle
     * of the south side, so anyone who comes through the gates can walk on to
     * the pitch. At each end the boards step back round the goal to make room
     * for the net (which closes the concourse behind the goals).
     */
    const PITCH_FENCE = (() => {
      const pitch = SPORTS_VENUES.soccer,
        inset = 4,
        thickness = 2,
        height = 10,
        left = pitch.x - inset - thickness,
        right = pitch.x + pitch.w + inset,
        top = pitch.y - inset - thickness,
        bottom = pitch.y + pitch.h + inset,
        centerX = pitch.x + pitch.w / 2,
        centerY = pitch.y + pitch.h / 2,
        gapHalf = 13,
        netHalf = pitch.goalWidth / 2 + 5,
        netBack = pitch.goalDepth + 3,
        segments = [];
      const run = (id, x, y, w, h) => {
        if (w > 0 && h > 0) segments.push({ id, x, y, w, h, height });
      };
      for (const [id, y] of [
        ['fence-north', top],
        ['fence-south', bottom],
      ]) {
        run(id, left, y, centerX - gapHalf - left, thickness);
        run(id, centerX + gapHalf, y, right + thickness - centerX - gapHalf, thickness);
      }
      for (const [id, x, back] of [
        ['fence-west', left, pitch.x - netBack - thickness],
        ['fence-east', right, pitch.x + pitch.w + netBack],
      ]) {
        run(id, x, top, thickness, centerY - netHalf - top);
        run(id, x, centerY + netHalf, thickness, bottom + thickness - centerY - netHalf);
        // The notch: a back board behind the net and two short returns.
        run(id, back, centerY - netHalf, thickness, netHalf * 2 + thickness);
        run(id, Math.min(x, back), centerY - netHalf, Math.abs(x - back) + thickness, thickness);
        run(id, Math.min(x, back), centerY + netHalf, Math.abs(x - back) + thickness, thickness);
      }
      return {
        inset,
        thickness,
        height,
        left,
        right,
        top,
        bottom,
        gaps: [
          { id: 'tunnel', x: centerX - gapHalf, y: top, w: gapHalf * 2 },
          { id: 'turnstiles', x: centerX - gapHalf, y: bottom, w: gapHalf * 2 },
        ],
        segments,
      };
    })();
    /**
     * BIG SCREENS: live scoreboards (drawn by sports3d.js). `z` is the height of
     * the screen's centre, `w` its width (screens are 2:1), `yaw` turns it about
     * the vertical (0 faces south, the way the street camera looks) and `tilt`
     * leans the top back so the elevated camera reads it square on. `base` is
     * where its two legs stand (0 the ground, 86 the entrance beam; null for a
     * screen fixed flat to a wall).
     * Only where a real ground has them and the camera, which looks down from the
     * south, can read them: inside, the big screen over the north stand facing
     * the pitch; outside, the display board on the entrance beam and a screen on
     * each half of the south facade, facing the plaza and the street. Each leans
     * back no more than a real wall-hung screen (0.12-0.3 rad). No screens stand
     * at the ends: they would face the pitch sideways and read edge-on from above.
     */
    const STADIUM_SCREENS = [
      { id: 'north', inside: true, x: 2689, y: 4319, z: 119, w: 130, yaw: 0, tilt: 0.3 },
      { id: 'entrance', inside: false, x: 2689, y: 4880, z: 121, w: 88, yaw: 0, tilt: 0.25, base: 86 },
      { id: 'facade-west', inside: false, x: 2462, y: 4890, z: 56, w: 118, yaw: 0, tilt: 0.12, base: null },
      { id: 'facade-east', inside: false, x: 2916, y: 4890, z: 56, w: 118, yaw: 0, tilt: 0.12, base: null },
    ];
    // The sixty-unit gap between the south stands (x 2659..2719, y 4785..4885).
    const STADIUM_ENTRANCE = {
      x: 2659,
      y: 4785,
      w: 60,
      h: 100,
      // Three turnstile posts with two 21-unit gates between them; a person is 16 wide.
      turnstiles: { y: 4845, depth: 4, height: 12 },
      posts: [2659, 2686, 2713].map((x) => ({ x, w: 6 })),
      gates: [
        { id: 'A', x: 2665, w: 21 },
        { id: 'B', x: 2692, w: 21 },
      ],
      // Nine bollards 7.5 apart across the mouth of the gap: narrower than a bicycle.
      bollards: { y: 4891, height: 9, xs: Array.from({ length: 9 }, (_, index) => 2659 + index * 7.5) },
      pylons: [
        { id: 'arch-pylon', x: 2651, y: 4885, w: 8, h: 5, height: 82 },
        { id: 'arch-pylon', x: 2719, y: 4885, w: 8, h: 5, height: 82 },
      ],
      booths: [
        { id: 'ticket-booth', x: 2612, y: 4886, w: 34, h: 14, height: 16 },
        { id: 'ticket-booth', x: 2732, y: 4886, w: 34, h: 14, height: 16 },
      ],
      flagPoles: [2540, 2566, 2592, 2786, 2812, 2838].map((x) => ({ x, y: 4899 })),
      // Team dugouts stand against the front of the north stand, facing the pitch.
      dugouts: [
        { id: 'dugout', team: 0, x: 2555, y: 4373, w: 34, h: 7, height: 12 },
        { id: 'dugout', team: 1, x: 2789, y: 4373, w: 34, h: 7, height: 12 },
      ],
    };
    const STADIUM_ENCLOSURE = [
      ...PITCH_FENCE.segments,
      ...STADIUM_ENTRANCE.posts.map((post) => ({
        id: 'turnstile-post',
        x: post.x,
        y: STADIUM_ENTRANCE.turnstiles.y,
        w: post.w,
        h: STADIUM_ENTRANCE.turnstiles.depth,
        height: STADIUM_ENTRANCE.turnstiles.height,
      })),
      ...STADIUM_ENTRANCE.pylons,
      ...STADIUM_ENTRANCE.booths,
      ...STADIUM_ENTRANCE.flagPoles.map((pole) => ({
        id: 'flag-pole',
        x: pole.x - 1.5,
        y: pole.y - 1.5,
        w: 3,
        h: 3,
        height: 62,
      })),
      ...STADIUM_ENTRANCE.dugouts,
    ];
    const STADIUM_VEHICLE_BARRIERS = [
      { id: 'bollard-row', x: 2653, y: 4889.5, w: 72, h: 3, height: STADIUM_ENTRANCE.bollards.height },
      {
        id: 'turnstile-span',
        x: STADIUM_ENTRANCE.x,
        y: STADIUM_ENTRANCE.turnstiles.y,
        w: STADIUM_ENTRANCE.w,
        h: STADIUM_ENTRANCE.turnstiles.depth,
        height: STADIUM_ENTRANCE.turnstiles.height,
      },
    ];
    // Everything vehicles must collide with that is not already a stand or fixture.
    const SPORTS_VEHICLE_BARRIERS = [...STADIUM_ENCLOSURE, ...STADIUM_VEHICLE_BARRIERS];
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
      // The big screens: aircraft hit them, people walk beneath.
      ...STADIUM_SCREENS.map((screen) => {
        const reach = (screen.w / 2) * Math.abs(Math.cos(screen.yaw)) + 3,
          depth = (screen.w / 2) * Math.abs(Math.sin(screen.yaw)) + 3;
        return {
          x: screen.x - reach,
          y: screen.y - depth,
          w: reach * 2,
          h: depth * 2,
          minHeight: screen.z - screen.w / 4 - 3,
          height: screen.z + screen.w / 4 + 3,
        };
      }),
      { x: 2651, y: 4861, w: 4, h: 4, height: 86 },
      { x: 2723, y: 4861, w: 4, h: 4, height: 86 },
      { x: 2650.5, y: 4860.5, w: 77, h: 5, minHeight: 84, height: 88 },
    ];
    const SPORTS_GROUND_SOLIDS = [
      ...STADIUM_STANDS,
      ...SPORTS_FIXTURES.filter((fixture) => !fixture.minHeight),
      ...STADIUM_ENCLOSURE,
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
      // GOALLINE, the betting shop beside the plaza (sportsbook.js).
      if (!inStadiumLot(x, y, radius)) return sportsbookBlocked(x, y, radius);
      return SPORTS_GROUND_SOLIDS.some(
        (stand) =>
          x + radius > stand.x &&
          x - radius < stand.x + stand.w &&
          y + radius > stand.y &&
          y - radius < stand.y + stand.h,
      );
    }

    function inStadiumForecourt(x, y) {
      return (
        x > STADIUM_FORECOURT.x &&
        x < STADIUM_FORECOURT.x + STADIUM_FORECOURT.w &&
        y > STADIUM_FORECOURT.y &&
        y < STADIUM_FORECOURT.y + STADIUM_FORECOURT.h
      );
    }

    function prepareSportsGround() {
      // Generic city scenery must not reappear inside the reserved stadium block
      // or on the paved forecourt in front of the turnstiles.
      for (const scenery of [trees, lamps]) {
        for (let index = scenery.length - 1; index >= 0; index--) {
          const item = scenery[index];
          if (inStadiumLot(item.x, item.y, 12) || inStadiumForecourt(item.x, item.y))
            scenery.splice(index, 1);
        }
      }
      prepareSportsbookShop();
    }

    function paintPavers(context, x, y, width, height, step = 12) {
      context.fillStyle = '#b1aa9a';
      context.fillRect(x, y, width, height);
      context.strokeStyle = '#968f80';
      context.lineWidth = 0.9;
      context.beginPath();
      for (let column = x + step; column < x + width; column += step) {
        context.moveTo(column, y);
        context.lineTo(column, y + height);
      }
      for (let row = y + step; row < y + height; row += step) {
        context.moveTo(x, row);
        context.lineTo(x + width, row);
      }
      context.stroke();
    }

    function paintParkingRow(context, x, y, width, height, bayWidth = 22) {
      context.fillStyle = '#4f5559';
      context.fillRect(x, y, width, height);
      context.strokeStyle = '#d9d6ca';
      context.lineWidth = 1.4;
      context.beginPath();
      for (let line = x; line <= x + width; line += bayWidth) {
        context.moveTo(line, y + 4);
        context.lineTo(line, y + height - 6);
      }
      context.moveTo(x, y + 4);
      context.lineTo(x + width, y + 4);
      context.stroke();
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
      // Concourse ring between the stands' front rows and the advertising boards.
      context.fillStyle = '#a29e90';
      context.fillRect(2388, 4373, 602, 412);
      context.fillStyle = '#4b7f48';
      context.fillRect(
        PITCH_FENCE.left,
        PITCH_FENCE.top,
        PITCH_FENCE.right + PITCH_FENCE.thickness - PITCH_FENCE.left,
        PITCH_FENCE.bottom + PITCH_FENCE.thickness - PITCH_FENCE.top,
      );
      // Grass inside the notches behind each goal.
      const netHalf = pitch.goalWidth / 2 + 5;
      context.fillRect(pitch.x - pitch.goalDepth - 5, pitch.y + pitch.h / 2 - netHalf, pitch.goalDepth + 5, netHalf * 2);
      context.fillRect(pitch.x + pitch.w, pitch.y + pitch.h / 2 - netHalf, pitch.goalDepth + 5, netHalf * 2);
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
      // Perimeter boards around the pitch, with their openings.
      context.fillStyle = '#1c2a36';
      for (const segment of PITCH_FENCE.segments) context.fillRect(segment.x, segment.y, segment.w, segment.h);
      for (const stand of STADIUM_STANDS) {
        context.fillStyle = '#263a4c';
        context.fillRect(stand.x, stand.y, stand.w, stand.h);
        if (detail) {
          context.strokeStyle = '#718997';
          context.lineWidth = 2;
          context.strokeRect(stand.x + 4, stand.y + 4, stand.w - 8, stand.h - 8);
        }
      }
      // Entrance corridor, plaza and the forecourt south of the lot.
      const entrance = STADIUM_ENTRANCE;
      if (detail) {
        paintPavers(context, entrance.x, entrance.y, entrance.w, entrance.h);
        paintPavers(context, 2590, STADIUM_FORECOURT.y, 198, STADIUM_FORECOURT.h, 14);
        paintParkingRow(context, 2300, 4914, 286, 50);
        paintParkingRow(context, 2790, 4914, 286, 50);
        context.fillStyle = '#e0b545';
        for (const x of entrance.bollards.xs) {
          context.beginPath();
          context.arc(x, entrance.bollards.y, 1.9, 0, TAU);
          context.fill();
        }
        context.fillStyle = '#1c2a36';
        for (const post of entrance.posts)
          context.fillRect(post.x, entrance.turnstiles.y, post.w, entrance.turnstiles.depth);
        for (const booth of entrance.booths) context.fillRect(booth.x, booth.y, booth.w, booth.h);
        for (const dugout of entrance.dugouts) context.fillRect(dugout.x, dugout.y, dugout.w, dugout.h);
      } else {
        context.fillStyle = '#b1aa9a';
        context.fillRect(entrance.x, entrance.y, entrance.w, entrance.h);
        context.fillRect(2590, STADIUM_FORECOURT.y, 198, STADIUM_FORECOURT.h);
      }
      if (detail) {
        context.fillStyle = '#f0eddb';
        context.font = 'bold 17px Arial';
        context.textAlign = 'center';
        context.fillText('SOUTH COAST STADIUM', pitch.x + pitch.w / 2, STADIUM_LOT.y + 37);
        context.font = 'bold 10px Arial';
        context.fillStyle = '#283e48';
        context.fillText('MAIN ENTRANCE', SPORTS_ENTRANCES.soccer.x, 4930);
        context.fillStyle = '#d9d6ca';
        context.font = 'bold 12px Arial';
        context.fillText('P', 2443, 4948);
        context.fillText('P', 2933, 4948);
      }
      paintSportsbookGround(context, detail);
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
      drawSportsbookMap(context, scale, big);
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
