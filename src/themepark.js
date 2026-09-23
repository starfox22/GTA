    // BEGIN SUBSYSTEM: src/themepark.js — Sunset Pier amusement park
    /**
     * Sunset Pier amusement park
     * Source: src/themepark.js
     * Scope: shared game closure.
     * Island layout, ride footprints, the rideable coaster and the park crowd.
     */
    /**
     * SUNSET PIER
     * The amusement island north of the reclamation across North Sound, reached
     * by the Sunset Pier Bridge off the north end of Riverbank Dr and Pier Island
     * Drive to the gate on the south side. The rides stand in the island's east
     * half, laid out around a midway: the coaster wraps the western half of the
     * park, the wheel anchors the east, and the carousel, games row and food
     * court fill the middle. The west half of the island (THEME_PARK_RESERVE,
     * geography.js) is kept clear for the big attractions. (The park used to
     * stand on a sand bar in the lower bay; it was moved here whole and turned
     * round so the gate faces the bridge.)
     *
     * The coaster is ridden, not watched. `COASTER_TRACK` is a closed list of
     * [x, y, altitude] control points; a ride interpolates along it with a real
     * gravity model (the train trades height for speed and is dragged up the lift
     * hill by the chain), and the player is carried with the train. Track height
     * is authored in world units, where 512 units is 100 metres.
     */
    const PIER = {
      gate: { x: 3898, y: -6145 },
      midway: { x: 3850, y: -6315 },
      wheel: { x: 4030, y: -6415, r: 66 },
      carousel: { x: 3920, y: -6515, r: 42 },
      arcade: { x: 3944, y: -6339, w: 96, h: 64 },
      gamesRow: { x: 3750, y: -6659, w: 220, h: 54 },
      foodCourt: { x: 3600, y: -6631, w: 170, h: 60 },
      station: { x: 3748, y: -6191 },
      dropTower: { x: 4020, y: -6557 },
      teacups: { x: 3650, y: -6415, r: 38 },
    };
    const COASTER_TRACK = [
      [3748, -6191, 16],
      [3680, -6185, 18],
      [3620, -6201, 70],
      [3564, -6229, 180],
      [3524, -6275, 300],
      [3518, -6335, 282],
      [3544, -6403, 96],
      [3590, -6447, 34],
      [3648, -6475, 146],
      [3710, -6497, 52],
      // Vertical loop: the plan position runs east, doubles back over the top and
      // returns to the entry, so the circle lives in the vertical plane. Radius 84,
      // entry and exit are the same point on the ground, and the crest is low
      // enough that the train still carries about two and a half g over the top.
      [3750, -6503, 24],
      [3809, -6503, 49],
      [3834, -6503, 108],
      [3809, -6503, 167],
      [3750, -6503, 192],
      [3691, -6503, 167],
      [3666, -6503, 108],
      [3691, -6503, 49],
      [3750, -6503, 24],
      [3820, -6485, 40],
      [3888, -6447, 118],
      [3938, -6391, 34],
      [3958, -6325, 104],
      [3934, -6267, 32],
      [3880, -6229, 96],
      [3814, -6215, 30],
      [3754, -6237, 84],
      [3722, -6293, 28],
      [3738, -6363, 72],
      [3798, -6403, 26],
      [3864, -6391, 58],
      [3910, -6337, 24],
      [3904, -6275, 44],
      [3858, -6225, 22],
      [3798, -6199, 18],
      [3772, -6193, 16],
    ];
    const COASTER_LIFT_START = 1,
      COASTER_LIFT_END = 4,
      COASTER_BRAKE = 34,
      COASTER_GRAVITY = 52,
      COASTER_TOP_SPEED = 380;
    let coasterTrain = {
      t: 0,
      speed: 0,
      running: false,
      dwell: 3,
      riders: 0,
    };
    function coasterPoint(t) {
      const n = COASTER_TRACK.length,
        i = ((Math.floor(t) % n) + n) % n,
        f = t - Math.floor(t),
        a = COASTER_TRACK[i],
        b = COASTER_TRACK[(i + 1) % n];
      return {
        x: a[0] + (b[0] - a[0]) * f,
        y: a[1] + (b[1] - a[1]) * f,
        altitude: a[2] + (b[2] - a[2]) * f,
      };
    }
    function coasterSegmentLength(i) {
      const n = COASTER_TRACK.length,
        a = COASTER_TRACK[i % n],
        b = COASTER_TRACK[(i + 1) % n];
      return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
    }
    /* Ride structures are solid: the player walks the midway, not through the wheel.
       The coaster station is deliberately not here — its platform is walked onto. */
    function parkSolids() {
      return [
        { x: PIER.arcade.x, y: PIER.arcade.y, w: PIER.arcade.w, h: PIER.arcade.h, height: 46 },
        { x: PIER.gamesRow.x, y: PIER.gamesRow.y, w: PIER.gamesRow.w, h: PIER.gamesRow.h, height: 34 },
        { x: PIER.foodCourt.x, y: PIER.foodCourt.y, w: PIER.foodCourt.w, h: PIER.foodCourt.h, height: 30 },
      ];
    }
    function parkBlocked(x, y, r = 0) {
      if (!onSunsetIsle(x, y)) return false;
      if (Math.hypot(x - PIER.wheel.x, y - PIER.wheel.y) < 16 + r) return true;
      if (Math.hypot(x - PIER.carousel.x, y - PIER.carousel.y) < 12 + r) return true;
      return parkSolids().some(
        (b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h,
      );
    }
    function boardCoaster() {
      if (player.car || playerOnRoof() || player.parachute || transitRide) return false;
      if (player.coaster) return false;
      if (distanceBetween(player, PIER.station) > 52) return false;
      if (wantedStars > 0) {
        needToLosePolice();
        return true;
      }
      if (coasterTrain.running) {
        tell('The train is out on the circuit. Wait for it to come back in.', 3);
        return true;
      }
      player.coaster = {
        time: 0,
      };
      coasterTrain.t = 0;
      coasterTrain.speed = 26;
      coasterTrain.running = true;
      coasterTrain.dwell = 0;
      announce('SUNSET PIER', 'THE SCREAMER', 2.4);
      tell('Bars down. Hold on.', 3);
      playSample('tires', 0.35, 0.8);
      return true;
    }
    function leaveCoaster() {
      player.coaster = null;
      player.altitude = terrainHeight(PIER.station.x, PIER.station.y);
      player.x = PIER.station.x + 58;
      player.y = PIER.station.y - 12;
      tell('Mind the step. Again?', 3);
    }
    function updateCoaster(deltaSeconds) {
      if (gameMode !== 'play') return;
      const train = coasterTrain;
      if (!train.running) {
        train.dwell = Math.max(0, train.dwell - deltaSeconds);
        return;
      }
      const n = COASTER_TRACK.length,
        i = Math.floor(train.t) % n,
        onBoard = !!player.coaster,
        segment = coasterSegmentLength(i),
        a = COASTER_TRACK[i],
        b = COASTER_TRACK[(i + 1) % n],
        rise = (b[2] - a[2]) / segment;
      if (i >= COASTER_LIFT_START && i < COASTER_LIFT_END) {
        // Chain lift: constant haul up the first hill.
        train.speed += (52 - train.speed) * Math.min(1, deltaSeconds * 1.6);
      } else if (i >= COASTER_BRAKE) {
        train.speed += (34 - train.speed) * Math.min(1, deltaSeconds * 2.2);
      } else {
        // Height traded for speed. `rise` is metres of climb per metre of track,
        // so the acceleration along it is gravity times that gradient; at this
        // scale (512 units to 100 m) gravity is about 50 units per second squared.
        // Height traded for speed, less what rolling and air resistance take. The
        // old model shed speed as a fraction per second, which over a minute-long
        // circuit bled the train down to the floor of the clamp and made the whole
        // ride crawl; losses are now a small deceleration, so the energy budget of
        // the layout is what actually decides whether a crest gets taken.
        train.speed += -rise * COASTER_GRAVITY * deltaSeconds;
        train.speed -= (0.8 + train.speed * train.speed * 0.00001) * deltaSeconds;
        train.speed = clamp(train.speed, 8, COASTER_TOP_SPEED);
      }
      train.t += (train.speed * deltaSeconds) / segment;
      if (train.t >= n) {
        train.t = 0;
        train.running = false;
        train.speed = 0;
        train.dwell = 4;
        if (player.coaster) leaveCoaster();
        return;
      }
      if (!onBoard) {
        // Carried down to the midway: you hear the train before you see it.
        if (train.speed > 140 && seededRandom() < deltaSeconds * 1.4)
          scream(coasterPoint(train.t));
        return;
      }
      const p = coasterPoint(train.t),
        ahead = coasterPoint(train.t + 0.08);
      player.coaster.time += deltaSeconds;
      player.x = p.x;
      player.y = p.y;
      player.altitude = p.altitude;
      player.a = headingBetween(p, ahead);
      // Riders shout on the drops and through the loop, not on the brake run.
      const inverted = i >= 12 && i <= 16;
      if ((rise < -0.22 || inverted || train.speed > 210) && seededRandom() < deltaSeconds * 4)
        scream(player);
    }
    function coasterStatusText() {
      if (!player.coaster) return '';
      return (
        'THE SCREAMER · ' +
        Math.round(worldMeters(coasterTrain.speed) * 3.6) +
        ' KM/H · ' +
        Math.round(worldMeters(player.altitude)) +
        ' m'
      );
    }
    function parkInteract() {
      if (boardCoaster()) return true;
      if (player.coaster) {
        tell('Not while the train is moving.', 2);
        return true;
      }
      return false;
    }
    /* Paint the park: midway paving, ride pads and labels (paintParkIsland does the island). */
    function paintSunsetPier(g) {
      g.save();
      g.beginPath();
      SUNSET_ISLE.polygon.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.clip();
      g.fillStyle = '#8f9a83';
      g.fillRect(3420, -6725, 720, 640);
      // Midway: a wide paved spine from the gate to the far end.
      g.fillStyle = '#cdc4ab';
      g.fillRect(3858, -6645, 76, 560);
      g.fillRect(3510, -6387, 560, 62);
      g.fillRect(3550, -6581, 520, 56);
      g.strokeStyle = '#b0a58c';
      g.lineWidth = 1.5;
      for (let x = 3510; x < 4080; x += 24) {
        g.beginPath();
        g.moveTo(x, -6387);
        g.lineTo(x, -6325);
        g.stroke();
      }
      // Ride pads.
      g.fillStyle = '#9aa2a4';
      for (const [cx, cy, r] of [
        [PIER.wheel.x, PIER.wheel.y, 74],
        [PIER.carousel.x, PIER.carousel.y, 50],
        [PIER.teacups.x, PIER.teacups.y, 46],
      ]) {
        g.beginPath();
        g.arc(cx, cy, r, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#78807f';
      for (const b of parkSolids()) g.fillRect(b.x, b.y, b.w, b.h);
      // Coaster shadow line so the track reads from above even in the flat map.
      g.strokeStyle = '#5c5344';
      g.lineWidth = 7;
      g.beginPath();
      COASTER_TRACK.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.stroke();
      g.fillStyle = '#e4d6a6';
      g.font = 'bold 30px monospace';
      g.textAlign = 'center';
      g.fillText('SUNSET PIER', 3810, -6100);
      g.font = 'bold 15px monospace';
      g.fillText('THE SCREAMER', PIER.station.x, PIER.station.y - 30);
      g.fillText('BIG WHEEL', PIER.wheel.x, PIER.wheel.y - 80);
      g.fillText('MIDWAY GAMES', PIER.gamesRow.x + 110, PIER.gamesRow.y - 10);
      g.fillText('FOOD COURT', PIER.foodCourt.x + 100, PIER.foodCourt.y - 10);
      g.restore();
    }
    /**
     * THE ISLAND GROUND
     * The island lies north of the city frame's baked ground, so it has a ground
     * tile of its own (drawn like the county's: county3d.js in 3D, drawCounty2D
     * in the 2D view): lawns inside a paved rim, the island drive and the car
     * park by the gate, the reserved attraction ground (THEME_PARK_RESERVE)
     * marked out, then the Sunset Pier midway and ride pads.
     */
    const PARK_TILE = { x: 1792, y: -7168, w: 2560, h: 1536, pixelsPerUnit: 0.64 },
      PARK_CAR_PARK = { x: 3290, y: -5846, w: 520, h: 110 };
    function paintParkIsland(g) {
      g.save();
      g.beginPath();
      SUNSET_ISLE.polygon.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fillStyle = '#7f986b';
      g.fill();
      g.clip();
      g.lineJoin = 'round';
      g.strokeStyle = '#b3ad9c';
      g.lineWidth = 64;
      g.stroke();
      g.strokeStyle = '#929897';
      g.lineWidth = 22;
      g.stroke();
      const r = THEME_PARK_RESERVE;
      g.fillStyle = '#8aa476';
      g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeStyle = '#d9d2b4';
      g.lineWidth = 4;
      g.setLineDash([24, 16]);
      g.strokeRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16);
      g.setLineDash([]);
      const lot = PARK_CAR_PARK;
      g.fillStyle = '#4d565a';
      g.fillRect(lot.x, lot.y, lot.w, lot.h);
      g.fillStyle = '#d6d3c4';
      for (let x = lot.x + 8; x < lot.x + lot.w - 8; x += 26) {
        g.fillRect(x, lot.y + 4, 2, 38);
        g.fillRect(x, lot.y + lot.h - 42, 2, 38);
      }
      g.restore();
      paintCountyRoads(g, true);
      drawBridgeGround(g);
      paintSunsetPier(g);
    }
    function buildSunsetPier() {
      const t = PARK_TILE,
        canvas = document.createElement('canvas');
      canvas.width = Math.round(t.w * t.pixelsPerUnit);
      canvas.height = Math.round(t.h * t.pixelsPerUnit);
      const g = canvas.getContext('2d');
      g.scale(t.pixelsPerUnit, t.pixelsPerUnit);
      g.translate(-t.x, -t.y);
      paintParkIsland(g);
      countyGroundTiles.push({ x: t.x, y: t.y, w: t.w, h: t.h, canvas });
      for (let i = trees.length - 1; i >= 0; i--)
        if (onSunsetIsle(trees[i].x, trees[i].y)) trees.splice(i, 1);
      for (let i = 0; i < 26; i++) {
        const a = (i * 2.399) % TAU,
          x = 3790 + Math.cos(a) * (200 + ((i * 53) % 130)),
          y = -6365 + Math.sin(a) * (190 + ((i * 71) % 120));
        if (onSunsetIsle(x, y) && !parkBlocked(x, y, 14)) drawTree(x, y, 12 + (i % 4) * 2);
      }
      // A line of trees along the island drive, clear of the reserved ground.
      for (let x = 3260; x < 3860; x += 60) drawTree(x, -5978, 13);
    }
    const PARK_LINES = [
      'One more go on the Screamer.',
      'I am not going on that.',
      'Cotton candy first, rides after.',
      'The queue is forty minutes.',
      'Hold my hat.',
      'You can see the whole city from the wheel.',
      'Three tickets left.',
      'I felt my stomach leave.',
      'Best chips on the coast.',
      'Meet by the carousel at six.',
    ];
    function populateSunsetPier() {
      const spots = [
        [PIER.station.x + 54, PIER.station.y - 20],
        [PIER.station.x + 40, PIER.station.y - 34],
        [PIER.carousel.x - 52, PIER.carousel.y],
        [PIER.carousel.x + 48, PIER.carousel.y - 16],
        [PIER.wheel.x - 80, PIER.wheel.y + 10],
        [PIER.wheel.x - 66, PIER.wheel.y - 30],
        [PIER.gamesRow.x + PIER.gamesRow.w - 40, PIER.gamesRow.y + PIER.gamesRow.h + 22],
        [PIER.gamesRow.x + PIER.gamesRow.w - 140, PIER.gamesRow.y + PIER.gamesRow.h + 22],
        [PIER.foodCourt.x + PIER.foodCourt.w - 60, PIER.foodCourt.y + PIER.foodCourt.h + 24],
        [PIER.foodCourt.x + PIER.foodCourt.w - 150, PIER.foodCourt.y + PIER.foodCourt.h + 24],
        [PIER.midway.x, PIER.midway.y - 40],
        [PIER.midway.x - 60, PIER.midway.y + 30],
        [PIER.teacups.x + 56, PIER.teacups.y],
        [3910, -6205],
        [3870, -6245],
        [3950, -6365],
      ];
      for (const [x, y] of spots) {
        if (!onSunsetIsle(x, y) || parkBlocked(x, y, 7)) continue;
        pedestrians.push({
          x,
          y,
          a: randomBetween(0, TAU),
          hp: 30,
          color: randomChoice(DRIVER_COLORS),
          flee: 0,
          timer: randomBetween(1, 7),
          walk: seededRandom() * 5,
          state: 'walk',
          parkGuest: true,
        });
      }
    }
    function updateParkGuest(person, deltaSeconds) {
      if (!person.parkGuest || person.flee > 0 || person.hp <= 0) return false;
      person.timer -= deltaSeconds;
      if (person.timer <= 0) {
        person.timer = 4 + seededRandom() * 7;
        person.parkGoal = null;
        if (seededRandom() < 0.55) {
          const target = randomChoice([PIER.midway, PIER.carousel, PIER.wheel, PIER.station, PIER.foodCourt]);
          person.parkGoal = {
            x: (target.x || 0) + randomBetween(-60, 60) + (target.w ? target.w / 2 : 0),
            y: (target.y || 0) + randomBetween(-50, 50) - (target.h ? 24 : 0),
          };
        }
        if ((person.speechUntil || 0) <= gameTime && seededRandom() < 0.5) {
          person.speech = randomChoice(PARK_LINES);
          person.speechUntil = gameTime + 3;
        }
      }
      const goal = person.parkGoal;
      if (!goal) {
        person.walking = false;
        return true;
      }
      if (distanceBetween(person, goal) < 10) {
        person.parkGoal = null;
        person.walking = false;
        return true;
      }
      person.a = headingBetween(person, goal);
      person.walking = true;
      person.walk += deltaSeconds * 6;
      if (moveBody(person, Math.cos(person.a) * 26 * deltaSeconds, Math.sin(person.a) * 26 * deltaSeconds, 5))
        person.parkGoal = null;
      return true;
    }
    // END SUBSYSTEM: src/themepark.js
