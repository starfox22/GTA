    // The Falcon coaster train: stepping, boarding and leaving, riders, screams and speakers (stepCoasterTrain).
    // ---- The Falcon: the train ------------------------------------------------------
    /**
     * One train of seven cars runs the circuit all day: it loads for a spell in
     * the station, is pushed out by the station tyres, hauled up the lift by the
     * chain, and from the crest runs on gravity alone (height traded for speed,
     * less rolling and air losses) until the magnetic brakes bring it home. `t`
     * is the front car's arc length; game.js resets `running` and `t` on death
     * and mission resets, which parks the train in the station.
     */
    let coasterTrain = {
      t: COASTER_STOP,
      speed: 0,
      running: false,
      dwell: 8,
      riders: 22,
      laps: 0,
    };
    function coasterParked() {
      return !coasterTrain.running;
    }
    function coasterSeat(car = 1, out = {}) {
      coasterFrame(coasterTrain.t - car * COASTER_CAR_GAP, out);
      return out;
    }
    function stepCoasterTrain(dt) {
      const train = coasterTrain,
        T = coasterCircuit();
      if (!train.running) {
        if (train.t !== COASTER_STOP) train.t = COASTER_STOP;
        train.speed = 0;
        train.dwell -= dt;
        if (train.dwell <= 0) {
          train.running = true;
          train.speed = 0.4 * UNITS_PER_METRE;
          train.riders = player.coaster?.kind === 'train' ? 27 : 18 + Math.floor(seededRandom() * 10);
          parkCrowdBoard('coaster', 6);
        }
        return;
      }
      const f = coasterFrame(train.t, parkScratch),
        ahead = coasterFrame(train.t + 3, parkScratch2),
        rise = (ahead.z - f.z) / 3,
        kind = f.kind;
      // The whole train feels gravity averaged over its length.
      let pull = 0;
      for (let c = 0; c < COASTER_CARS; c += 2) {
        const a = coasterFrame(train.t - c * COASTER_CAR_GAP, parkScratch3).z,
          b = coasterFrame(train.t - c * COASTER_CAR_GAP + 3, parkScratch3).z;
        pull += (b - a) / 3;
      }
      pull /= Math.ceil(COASTER_CARS / 2);
      const toStop = (COASTER_STOP - train.t + T.length) % T.length;
      if (kind === 1 && train.laps > 0 && toStop < 200) {
        // Home: the station tyres ease the train onto its mark.
        train.speed = Math.max(0.3 * UNITS_PER_METRE, Math.min(train.speed, Math.sqrt(2 * 1.76 * UNITS_PER_METRE * Math.max(0, toStop))));
        if (toStop < 0.8 || toStop > 190) {
          train.running = false;
          train.t = COASTER_STOP;
          train.speed = 0;
          train.dwell = 14;
          train.laps = 0;
          if (player.coaster?.kind === 'train') leaveCoaster();
          parkCrowdBoard('coaster', -6);
          return;
        }
      } else if (kind === 1) train.speed += (COASTER_STATION_SPEED - train.speed) * Math.min(1, dt * 2);
      else if (kind === 2) train.speed = Math.max(COASTER_LIFT_SPEED, train.speed + coasterAcceleration(train.speed, pull) * dt);
      else if (kind === 3) {
        // Magnetic trims above the brake pace, drive tyres below it.
        train.speed += coasterAcceleration(train.speed, pull) * dt;
        if (train.speed > COASTER_BRAKE_SPEED) train.speed = Math.max(COASTER_BRAKE_SPEED, train.speed - 13.7 * UNITS_PER_METRE * dt);
        else train.speed += (COASTER_BRAKE_SPEED - 4 - train.speed) * Math.min(1, dt * 1.2);
      } else train.speed = Math.max(0.78 * UNITS_PER_METRE, train.speed + coasterAcceleration(train.speed, pull) * dt);
      train.lastRise = rise;
      train.t += train.speed * dt;
      if (train.t >= T.length) {
        train.t -= T.length;
        train.laps++;
      }
    }
    const parkScratch = {},
      parkScratch2 = {},
      parkScratch3 = {};
    function boardCoaster() {
      if (player.car || playerOnRoof() || player.parachute || transitRide || player.coaster) return false;
      if (Math.abs(player.x - PIER.station.x) > 110 || Math.abs(player.y - PIER.station.y) > 70) return false;
      if (wantedStars > 0) {
        needToLosePolice();
        return true;
      }
      if (coasterTrain.running) {
        tell('The Falcon is out on the circuit. Wait for the next train.', 3);
        return true;
      }
      // `radio`: the Falcon's radio starts off on every ride; what the player
      // chooses holds for this ride only (car-radio.js radioSwitchedOn).
      player.coaster = { kind: 'train', time: 0, car: 0, view: 0, radio: false };
      coasterTrain.dwell = Math.min(coasterTrain.dwell, 3);
      announce('SUNSET PIER', 'THE FALCON', 2.4);
      tell('Bars down. ' + keyName('interact') + ' changes the view; radio off, ' + keyName('radioPower') + ' / ' + keyName('radioNext') + ' to play it. ' + coasterBanner() + '.', 4);
      return true;
    }
    function leaveCoaster() {
      const kind = player.coaster?.kind;
      player.coaster = null;
      player.hidden = false;
      if (kind === 'wheel') {
        player.x = PIER.terminal.x - 18;
        player.y = PIER.wheel.y;
        tell('Welcome back to the ground.', 3);
      } else {
        player.x = PIER.station.x + 20;
        player.y = PIER.station.y + 52;
        tell('Mind the step. Again?', 3);
      }
      player.altitude = terrainHeight(player.x, player.y);
    }
    // ---- The Falcon: the riders' voices ----------------------------------------------
    /**
     * RIDERS' VOICES
     * The riders scream and talk in time with the track. Every frame each of the
     * seven cars is read off the circuit where it is: its vertical speed (train
     * speed x the tangent's rise), the load on its seats straight up (from the
     * speed squared x the change of that rise along the track) and whether it
     * is upside down. A car that starts to fall faster than FALCON_FALLING m/s
     * has gone over a crest: the first time after the lift that is the first
     * drop, and its riders let out a chorus of the recorded screams the city's
     * pedestrians use (citylife.js scream()), two voices a car, each with its
     * own pitch, level and a fraction of a second's delay, placed on that car;
     * because each car tips over in turn the chorus rolls down the train. Later
     * drops, airtime crests (the seat pushing up at less than FALCON_AIRTIME g)
     * and inversions get a voice from some of the cars, quieter. The voices go
     * through the voices bus (the Voices slider and switch), attenuated by the
     * distance, height included, from the player, so they are heard on the
     * train and from the ground nearby. There is no recorded whoop, so the
     * cheering is left to the bubbles.
     *
     * The riders also talk, in speech bubbles over their heads (crowd.js
     * speechBubbles, so at most two at once, and the NPC chatter setting and the
     * height rule apply; they come first while the player rides): nervous on
     * the lift, screams over the first drop (cutting off whatever was being
     * said), excited or terrified through the elements, queasy or hooked on the
     * brake run. `falconRiders` are the speakers, one per seat, kept at the
     * seats themepark3d.js draws riders in (FALCON_SEATS, four to a car); the
     * player sits in the front car's seat FALCON_PLAYER_SEAT and does not speak.
     * DeadEndCity.coasterVoices() returns the log of every cue.
     */
    const FALCON_LINES = {
      lift: [
        'OMG I’m so scared!',
        'Why did I agree to this?',
        'Don’t look down…',
        'Is it supposed to click like that?',
        'We’re so high up!',
        'I changed my mind!',
        'Hold my hand.',
        'Oh no, oh no, oh no…',
      ],
      drop: ['AAAAHHH!', 'AAAAAAAHHH!!', 'WAAAAAH!', 'OH MY GOOOD!', 'NOOOOOO!'],
      ride: ['WOOOO!', 'Faster!', 'Mommy!', 'I can’t feel my face!', 'YEEEAH!', 'Best. Ride. Ever!', 'My stomach!', 'Hands up!'],
      loop: ['Upside dooown!', 'WOOOO!', 'Mommy!', 'AAAH!'],
      end: [
        'I’m going to throw up!',
        'Again! Again!',
        'My legs are jelly…',
        'I left my stomach up there.',
        'Never again. …Okay, once more.',
        'My hair!',
      ],
    };
    const FALCON_SCREAMS = ['civilian-scream-female-1', 'civilian-scream-female-2', 'civilian-scream-male-1', 'civilian-scream-male-2'],
      // [along the car, across it]: the rider layout of themepark3d.js updateCoasterTrain.
      FALCON_SEATS = [
        [-2.6, -1.5],
        [-2.6, 1.5],
        [2.4, -1.5],
        [2.4, 1.5],
      ],
      FALCON_PLAYER_SEAT = 2,
      // Metres a second of fall that mark a crest crossed, and back under which it is over.
      FALCON_FALLING = 4.5,
      FALCON_LEVEL = 1.5,
      // Seat load (g, straight up) under which a crest counts as airtime.
      FALCON_AIRTIME = 0.45,
      // A drop at least this many metres deep is a big one; shallower than the dip, nothing.
      FALCON_BIG_DROP = 12,
      FALCON_DIP = 5;
    const falconRiders = Array.from({ length: COASTER_CARS * 4 }, (_, r) => ({
        coasterRider: true,
        car: Math.floor(r / 4),
        seat: r % 4,
        x: 0,
        y: 0,
        altitude: 0,
        bubbleZ: 0,
        hp: 1,
        speech: '',
        speechUntil: 0,
      })),
      falconCars = Array.from({ length: COASTER_CARS }, () => ({})),
      falconTalk = { running: false, nextLineAt: 0, eventLineAt: 0, firstDrop: false, last: {}, log: [] },
      falconFrame = {},
      falconFrameB = {};
    /* The speakers crowd.js speechBubbles() considers alongside the street's. */
    function coasterSpeakers() {
      return falconRiders;
    }
    function falconSeatTaken(r) {
      if (r >= coasterTrain.riders) return false;
      return !(r === FALCON_PLAYER_SEAT && player.coaster?.kind === 'train');
    }
    /* Put a rider (the point over their head a bubble hangs from) on the train. */
    function placeFalconRider(rider) {
      const f = coasterFrame(coasterTrain.t - rider.car * COASTER_CAR_GAP, falconFrameB),
        dot = f.ux * f.tx + f.uy * f.ty + f.uz * f.tz;
      let ux = f.ux - f.tx * dot,
        uy = f.uy - f.ty * dot,
        uz = f.uz - f.tz * dot;
      const ul = Math.hypot(ux, uy, uz) || 1;
      ux /= ul;
      uy /= ul;
      uz /= ul;
      // Across the car: tangent x up in the renderer's axes (x, height, y), mapped back.
      const sx = f.tz * uy - f.ty * uz,
        sy = f.tx * uz - f.tz * ux,
        sz = f.ty * ux - f.tx * uy,
        [along, across] = FALCON_SEATS[rider.seat],
        headUp = 17;
      rider.x = f.x + f.tx * (along - 0.4) + ux * headUp + sx * across;
      rider.y = f.y + f.ty * (along - 0.4) + uy * headUp + sy * across;
      rider.bubbleZ = f.z + f.tz * (along - 0.4) + uz * headUp + sz * across;
      rider.altitude = f.z;
    }
    /* `count` riders not already talking say a line of `kind`; returns the lines.
       From the chase camera (view 0) the front car is out of frame and the back
       ones sit under the HUD, so the speakers come from cars 1 to 4. No line is
       said twice at once, nor twice running. */
    function falconSay(kind, count = 1) {
      const chase = player.coaster?.kind === 'train' && player.coaster.view === 0,
        free = [];
      for (let r = 0; r < falconRiders.length; r++)
        if (falconSeatTaken(r) && (falconRiders[r].speechUntil || 0) <= gameTime && (!chase || (falconRiders[r].car >= 1 && falconRiders[r].car <= 4)))
          free.push(falconRiders[r]);
      const said = [];
      for (let i = 0; i < count && free.length; i++) {
        const rider = free.splice(Math.floor(seededRandom() * free.length), 1)[0],
          lines = FALCON_LINES[kind].filter((line) => line !== falconTalk.last[kind] && !said.includes(line));
        placeFalconRider(rider);
        rider.speech = randomChoice(lines.length ? lines : FALCON_LINES[kind]);
        falconTalk.last[kind] = rider.speech;
        rider.speechUntil = gameTime + 2.6;
        rider.speechKind = 'falcon-' + kind;
        rider.speechKindText = rider.speech;
        said.push(rider.speech);
      }
      return said;
    }
    function falconHush() {
      for (const rider of falconRiders) if (rider.speechUntil > gameTime) rider.speechUntil = gameTime;
    }
    /* One rider's scream from car c, `delay` seconds from now. */
    function falconScream(c, loud, delay) {
      if (!voicesOn || !audio) return;
      const f = coasterFrame(coasterTrain.t - c * COASTER_CAR_GAP, falconFrameB);
      playSample(randomChoice(FALCON_SCREAMS), loud, randomBetween(0.9, 1.14), { x: f.x, y: f.y, elevation: f.z }, voiceBus, delay);
    }
    /* A cue from car c: up to `voices` screams (one per rider aboard), each with
       probability `chance`, logged with where the car is on the track. */
    function falconCue(kind, c, info, voices, chance, loud) {
      let played = 0;
      const seats = FALCON_SEATS.filter((_, k) => falconSeatTaken(c * 4 + k)).length;
      for (let v = 0; v < Math.min(voices, seats); v++)
        if (seededRandom() < chance) {
          falconScream(c, loud * randomBetween(0.75, 1.15), v * randomBetween(0.08, 0.3) + randomBetween(0, 0.12));
          played++;
        }
      const log = falconTalk.log;
      log.push({
        at: +gameTime.toFixed(2),
        kind,
        car: c,
        track: Math.round(worldMeters(info.s)),
        height: +worldMeters(info.z).toFixed(1),
        vz: +info.vz.toFixed(1),
        g: +info.g.toFixed(2),
        ...(info.depth === undefined ? {} : { depth: +info.depth.toFixed(1) }),
        voices: played,
      });
      if (log.length > 240) log.splice(0, log.length - 240);
      return played;
    }
    /* How far (world units) the track keeps falling from arc length s. */
    function falconDropDepth(s) {
      const T = coasterCircuit(),
        n = T.count;
      let i = Math.floor((((s % T.length) + T.length) % T.length) / T.ds) % n;
      const top = T.Z[i];
      let low = top;
      for (let k = 0; k < 400; k++) {
        const j = (i + 1) % n;
        if (T.Z[j] > low + 0.5) break;
        low = Math.min(low, T.Z[j]);
        i = j;
      }
      return top - low;
    }
    function updateFalconVoices() {
      const train = coasterTrain,
        talk = falconTalk;
      if (!train.running) {
        if (talk.running) {
          falconHush();
          talk.running = false;
        }
        return;
      }
      if (!talk.running) {
        // Dispatched: a new lap for every car.
        talk.running = true;
        talk.firstDrop = false;
        talk.nextLineAt = gameTime + randomBetween(1, 2.5);
        for (const car of falconCars) Object.assign(car, { falling: false, inverted: false, airtime: false, sinceLift: false, dropAt: -9 });
      }
      const riding = player.coaster?.kind === 'train',
        front = coasterFrame(train.t, falconFrame),
        frontKind = front.kind,
        frontZ = front.z,
        watcher = Math.min(Math.hypot(front.x - player.x, front.y - player.y), Math.hypot(front.x - cameraTarget.x, front.y - cameraTarget.y)),
        // Too far to hear or see: keep the lap's state, skip the rest.
        heard = riding || watcher < 2400,
        v = train.speed;
      let frontEvent = null;
      for (let c = 0; c < COASTER_CARS; c++) {
        const car = falconCars[c],
          s = train.t - c * COASTER_CAR_GAP,
          ahead = coasterFrame(s + 6, falconFrameB).tz,
          behind = coasterFrame(s - 6, falconFrameB).tz,
          f = coasterFrame(s, falconFrame);
        if (f.kind === 2) car.sinceLift = true;
        if (!heard) continue;
        // Vertical speed (m/s) and the seat's load straight up (g).
        const vz = worldMeters(v * f.tz),
          g = 1 + (v * v * (ahead - behind)) / 12 / COASTER_G,
          info = { s, z: f.z, vz, g };
        let event = null;
        // Upside down: the loop, the heartline roll, the corkscrew.
        if (!car.inverted && f.uz < -0.25) {
          car.inverted = true;
          event = 'loop';
          falconCue('inversion', c, info, 2, 0.35, 0.1);
        } else if (car.inverted && f.uz > 0.2) car.inverted = false;
        // Over a crest and falling.
        if (!car.falling && vz < -FALCON_FALLING) {
          car.falling = true;
          const depth = worldMeters(falconDropDepth(s));
          info.depth = depth;
          if (car.sinceLift) {
            // The big one: every rider in the car may join in.
            car.sinceLift = false;
            car.dropAt = gameTime;
            event = 'first';
            falconCue('first drop', c, info, 2, 0.88, 0.14);
          } else if (!car.inverted && depth >= FALCON_BIG_DROP) {
            car.dropAt = gameTime;
            event = event || 'drop';
            falconCue('drop', c, info, 1, 0.5, 0.1);
          } else if (!car.inverted && depth >= FALCON_DIP) {
            car.dropAt = gameTime;
            event = event || 'dip';
            falconCue('dip', c, info, 1, 0.25, 0.075);
          }
        } else if (car.falling && vz > -FALCON_LEVEL) car.falling = false;
        // Airtime: lifted out of the seat over a crest (not the drops just cued).
        if (!car.airtime && g < FALCON_AIRTIME && f.uz > 0.3 && v > 8 * UNITS_PER_METRE) {
          car.airtime = true;
          if (gameTime - car.dropAt > 1.5) {
            event = event || 'airtime';
            falconCue('airtime', c, info, 1, 0.3, 0.08);
          }
        } else if (car.airtime && g > FALCON_AIRTIME + 0.25) car.airtime = false;
        if (c === 0) frontEvent = event;
      }
      // What the riders say, to anyone close enough to read it.
      if (!riding && watcher > 900) return;
      const log = talk.log;
      if (frontEvent === 'first') {
        talk.firstDrop = true;
        falconHush();
        const said = falconSay('drop', 2);
        talk.eventLineAt = gameTime + 2.2;
        talk.nextLineAt = gameTime + 4;
        if (log.length) log[log.length - 1].said = said;
      } else if (frontEvent && talk.firstDrop && gameTime > talk.eventLineAt && seededRandom() < 0.65) {
        const said = falconSay(frontEvent === 'loop' ? 'loop' : 'ride');
        talk.eventLineAt = gameTime + randomBetween(2, 3.2);
        if (said.length && log.length) log[log.length - 1].said = said;
      }
      if (gameTime >= talk.nextLineAt) {
        // Nervous on the lift, queasy or hooked on the brake run home.
        const phase = frontKind === 2 && !talk.firstDrop ? 'lift' : frontKind === 3 && talk.firstDrop ? 'end' : null;
        if (phase) {
          const said = falconSay(phase);
          if (said.length)
            log.push({ at: +gameTime.toFixed(2), kind: 'say ' + phase, track: Math.round(worldMeters(train.t)), height: +worldMeters(frontZ).toFixed(1), said });
        }
        talk.nextLineAt = gameTime + randomBetween(2.2, 3.4);
      }
      // Keep the speaking riders on their seats.
      for (const rider of falconRiders) if (rider.speechUntil >= gameTime) placeFalconRider(rider);
    }
    /* DeadEndCity.coasterVoices(reset): the scream cues and lines of the ride so far. */
    function falconVoicesReport(reset = false) {
      const report = {
        running: coasterTrain.running,
        track: Math.round(worldMeters(coasterTrain.t)),
        firstDrop: falconTalk.firstDrop,
        speaking: falconRiders.filter((r) => r.speechUntil >= gameTime).map((r) => ({ car: r.car, seat: r.seat, text: r.speech })),
        log: falconTalk.log.slice(),
      };
      if (reset) falconTalk.log.length = 0;
      return report;
    }
