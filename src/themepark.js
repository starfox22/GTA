    // BEGIN SUBSYSTEM: src/themepark.js — Sunset Pier amusement park
    /**
     * Sunset Pier amusement park
     * Source: src/themepark.js
     * Scope: shared game closure.
     * Island layout, ride footprints, the rideable coaster and the park crowd.
     */
    /**
     * SUNSET PIER
     * A pleasure pier built on a sand bar in the lower bay, reached by the Palm
     * Ave causeway off the Stadium Way crossing. The park is laid out around a
     * midway: the coaster wraps the eastern half, the wheel anchors the west, and
     * the carousel, games row and food court fill the middle.
     *
     * The coaster is ridden, not watched. `COASTER_TRACK` is a closed list of
     * [x, y, altitude] control points; a ride interpolates along it with a real
     * gravity model (the train trades height for speed and is dragged up the lift
     * hill by the chain), and the player is carried with the train. Track height
     * is authored in world units, where 512 units is 100 metres.
     */
    const PIER = {
      gate: { x: 3712, y: 4960 },
      midway: { x: 3760, y: 5130 },
      wheel: { x: 3580, y: 5230, r: 66 },
      carousel: { x: 3690, y: 5330, r: 42 },
      arcade: { x: 3570, y: 5090, w: 96, h: 64 },
      gamesRow: { x: 3640, y: 5420, w: 220, h: 54 },
      foodCourt: { x: 3840, y: 5386, w: 170, h: 60 },
      station: { x: 3862, y: 5006 },
      dropTower: { x: 3590, y: 5372 },
      teacups: { x: 3960, y: 5230, r: 38 },
    };
    const COASTER_TRACK = [
      [3862, 5006, 16],
      [3930, 5000, 18],
      [3990, 5016, 70],
      [4046, 5044, 180],
      [4086, 5090, 300],
      [4092, 5150, 282],
      [4066, 5218, 96],
      [4020, 5262, 34],
      [3962, 5290, 146],
      [3900, 5312, 52],
      // Vertical loop: the plan position runs west, doubles back over the top and
      // returns to the entry, so the circle lives in the vertical plane. Radius 84,
      // entry and exit are the same point on the ground, and the crest is low
      // enough that the train still carries about two and a half g over the top.
      [3860, 5318, 24],
      [3801, 5318, 49],
      [3776, 5318, 108],
      [3801, 5318, 167],
      [3860, 5318, 192],
      [3919, 5318, 167],
      [3944, 5318, 108],
      [3919, 5318, 49],
      [3860, 5318, 24],
      [3790, 5300, 40],
      [3722, 5262, 118],
      [3672, 5206, 34],
      [3652, 5140, 104],
      [3676, 5082, 32],
      [3730, 5044, 96],
      [3796, 5030, 30],
      [3856, 5052, 84],
      [3888, 5108, 28],
      [3872, 5178, 72],
      [3812, 5218, 26],
      [3746, 5206, 58],
      [3700, 5152, 24],
      [3706, 5090, 44],
      [3752, 5040, 22],
      [3812, 5014, 18],
      [3838, 5008, 16],
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
      player.x = PIER.station.x - 58;
      player.y = PIER.station.y + 12;
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
    /* Paint the island: midway paving, ride pads, the pier boards and the beach. */
    function paintSunsetPier(g) {
      g.save();
      g.fillStyle = '#b7ab8c';
      g.beginPath();
      SUNSET_ISLE.polygon.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fill();
      g.clip();
      g.fillStyle = '#8f9a83';
      g.fillRect(3470, 4900, 720, 640);
      // Midway: a wide paved spine from the gate to the far end.
      g.fillStyle = '#cdc4ab';
      g.fillRect(3676, 4900, 76, 560);
      g.fillRect(3540, 5140, 560, 62);
      g.fillRect(3540, 5340, 520, 56);
      g.strokeStyle = '#b0a58c';
      g.lineWidth = 1.5;
      for (let x = 3540; x < 4110; x += 24) {
        g.beginPath();
        g.moveTo(x, 5140);
        g.lineTo(x, 5202);
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
      g.fillText('SUNSET PIER', 3800, 4960);
      g.font = 'bold 15px monospace';
      g.fillText('THE SCREAMER', PIER.station.x, PIER.station.y - 30);
      g.fillText('BIG WHEEL', PIER.wheel.x, PIER.wheel.y - 80);
      g.fillText('MIDWAY GAMES', PIER.gamesRow.x + 110, PIER.gamesRow.y - 10);
      g.fillText('FOOD COURT', PIER.foodCourt.x + 100, PIER.foodCourt.y - 10);
      g.restore();
    }
    function buildSunsetPier() {
      paintSunsetPier(groundContext);
      for (let i = trees.length - 1; i >= 0; i--)
        if (onSunsetIsle(trees[i].x, trees[i].y)) trees.splice(i, 1);
      for (let i = 0; i < 26; i++) {
        const a = (i * 2.399) % TAU,
          x = 3820 + Math.cos(a) * (200 + ((i * 53) % 130)),
          y = 5180 + Math.sin(a) * (190 + ((i * 71) % 120));
        if (onSunsetIsle(x, y) && !parkBlocked(x, y, 14)) drawTree(x, y, 12 + (i % 4) * 2);
      }
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
        [PIER.station.x - 54, PIER.station.y + 20],
        [PIER.station.x - 40, PIER.station.y + 34],
        [PIER.carousel.x + 52, PIER.carousel.y],
        [PIER.carousel.x - 48, PIER.carousel.y + 16],
        [PIER.wheel.x + 80, PIER.wheel.y - 10],
        [PIER.wheel.x + 66, PIER.wheel.y + 30],
        [PIER.gamesRow.x + 40, PIER.gamesRow.y - 22],
        [PIER.gamesRow.x + 140, PIER.gamesRow.y - 22],
        [PIER.foodCourt.x + 60, PIER.foodCourt.y - 24],
        [PIER.foodCourt.x + 150, PIER.foodCourt.y - 24],
        [PIER.midway.x, PIER.midway.y + 40],
        [PIER.midway.x + 60, PIER.midway.y - 30],
        [PIER.teacups.x - 56, PIER.teacups.y],
        [3700, 5020],
        [3740, 5060],
        [3660, 5180],
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
            y: (target.y || 0) + randomBetween(-50, 50) + (target.h ? target.h + 24 : 0),
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
