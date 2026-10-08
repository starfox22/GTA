    // BEGIN SUBSYSTEM: src/summitjob.js — Mission 3, High Ground: the package buried at the top of Mount Ascent
    /**
     * Mission 3: High Ground (Vinny)
     * Source: src/summitjob.js
     * Scope: shared game closure.
     * One of Vinny's men buried a package under a cairn at the very top of Mount
     * Ascent, where the 4x4 trail ends. The player gets up there however they can
     * (a club truck up the trail; a helicopter set down on the platform; a jump,
     * landed on the ten metres of level rock: anywhere else the scree takes them
     * down the face), digs it up (held interact, `summitJob.dig`), stows it in the
     * vehicle they came in or carries it in a backpack, and hands it to Vinny in
     * his warehouse (chase.js VINNY_DEPOT). The renderer (summitjob3d.js) only
     * reads `summitCacheView()`.
     */
    const SUMMIT_JOB = {
      // At the foot of the summit cairn (offroad3d-trail.js, top + (12, -10)), on its east
      // side, clear of the SUMMIT · FINISH gate (terrain-field.js levels the ground within
      // ~40 units of COUNTY_PEAKS[0]; the trail arrives from the west).
      cache: { x: 7791, y: 1082 },
      peak: { x: 7760, y: 1090 },
      trailhead: { x: 7510, y: 1970 },
      // The RIDGELINE 4X4 CLUB's gate in Northridge (offroad-trails.js OFFROAD_CLUB).
      club: { x: 8590, y: 3070 },
      // Vinny waits inside his warehouse, by the crates on the east wall, facing the shutter.
      vinny: { x: -1606, y: 4505 },
      arrive: 75,
      digReach: 26,
      digSeconds: 7.5,
      loadReach: 44,
      handReach: 46,
    };
    function summitJob() {
      return mission?.index === 2 ? mission : null;
    }
    /* A word for the vehicle the package rides in, for the stage texts. */
    function summitVehicleWord(c) {
      if (!c) return 'VEHICLE';
      if (c.type === 'helicopter') return 'HELICOPTER';
      if (isAircraft(c)) return 'PLANE';
      if (vehicleSpec(c).bike) return 'BIKE';
      if (OFFROAD_TYPES[c.type] || ['pickup', 'flatbed', 'van', 'armytruck', 'suv'].includes(c.type)) return 'TRUCK';
      return 'CAR';
    }
    /* Whether the player is down on the summit: on foot on the rock, or in a vehicle
       standing on it (a helicopter set down counts; one hovering does not). */
    function summitArrived() {
      if (player.parachute || player.fall || player.thrown || distanceBetween(player, SUMMIT_JOB.peak) > SUMMIT_JOB.arrive) return false;
      const c = player.car;
      if (!c) return !player.tumble;
      if (isAircraft(c)) return aircraftClearance(c) < 3 * UNITS_PER_METRE;
      return Math.abs(c.speed || 0) < 40;
    }
    function startSummitJob(m) {
      const cache = SUMMIT_JOB.cache;
      m.cache = { x: cache.x, y: cache.y, altitude: terrainHeight(cache.x, cache.y) };
      m.summit = { x: SUMMIT_JOB.peak.x, y: SUMMIT_JOB.peak.y, altitude: terrainHeight(SUMMIT_JOB.peak.x, SUMMIT_JOB.peak.y) };
      m.dig = 0;
      m.digSound = 0;
      m.digKnock = false;
      m.carrier = null;
      m.carryCar = null;
      m.lastCar = null;
      m.beats = {};
      m.ownOpening = true;
      setStage(
        0,
        m.summit,
        'REACH THE SUMMIT OF MOUNT ASCENT · A 4X4 MAKES THE CLIMB',
        'vinny',
        'Before the Feds picked him up, Tommy Russo buried something of mine on top of Mount Ascent. Under the cairn at the summit. Go get it, and don’t open it.',
      );
      missionBrief(
        'Vinny asked you to collect a buried package from the very top of Mount Ascent. Get up there, with a 4x4 up the trail or a parachute onto the summit, and dig it up for him.',
        { kicker: 'THE JOB' },
      );
    }
    /* Vinny in his warehouse, for the handover; the Vinny who stands at his usual
       corner (story.js populateStoryWorld) steps out of sight meanwhile. */
    function summitVinny(m) {
      if (m.vinny) return m.vinny;
      for (const p of storyActors) if (p.name === 'VINNY MORETTI' && !p.missionTag) p.hidden = true;
      const v = actor('VINNY MORETTI', SUMMIT_JOB.vinny.x, SUMMIT_JOB.vinny.y, '#bb9b6e');
      v.a = -Math.PI * 0.62;
      v.missionTag = 'summit-job';
      storyActors.push(v);
      return (m.vinny = v);
    }
    function summitCleanup() {
      for (let i = storyActors.length - 1; i >= 0; i--) {
        const p = storyActors[i];
        if (p.missionTag === 'summit-job') storyActors.splice(i, 1);
        else if (p.name === 'VINNY MORETTI') p.hidden = false;
      }
      player.digUntil = 0;
    }
    /* Once a stage: a line from Vinny on the radio. */
    function summitBeat(m, id, text, speaker = 'vinny') {
      if (m.beats[id]) return;
      m.beats[id] = true;
      missionLine(speaker, text);
    }
    /* The player is crouched over the hole this frame (the dig pose; the feet stay put). */
    function summitDigging() {
      return (player.digUntil || 0) > gameTime && !player.car;
    }
    function summitDeliveryTarget(m) {
      if (m.carrier === 'car' && player.car !== m.carryCar && !(insideDepot(m.carryCar.x, m.carryCar.y) && insideDepot(player.x, player.y)))
        return { target: m.carryCar, text: 'THE PACKAGE IS IN THE ' + summitVehicleWord(m.carryCar) + ' · GET BACK IN' };
      if (wantedStars > 0) return { target: VINNY_DEPOT.door, text: 'LOSE THE POLICE · VINNY WANTS NO HEAT AT HIS DOOR' };
      if (!insideDepot(player.x, player.y)) return { target: VINNY_DEPOT.inside, text: 'BRING THE PACKAGE TO VINNY’S WAREHOUSE' };
      if (player.car) return { target: m.vinny, text: 'GET OUT · HAND VINNY THE PACKAGE' };
      return { target: m.vinny, text: 'HAND VINNY THE PACKAGE · ' + keyName('interact') };
    }
    function updateSummitJob(m, deltaSeconds) {
      const c = player.car;
      if (c && c.hp > 0) m.lastCar = c;
      if (m.carrier === 'car' && m.carryCar.hp <= 0) {
        failMission('The package burned with the ' + summitVehicleWord(m.carryCar).toLowerCase() + '.');
        return;
      }
      if (m.stage === 0) {
        if (distanceBetween(player, SUMMIT_JOB.trailhead) < 260) {
          if (c && !isAircraft(c) && !OFFROAD_TYPES[c.type])
            summitBeat(m, 'roadcar', 'In that? Road tyres on that trail... you’ll be pushing it the last half. The club trucks are built for it.');
          else summitBeat(m, 'trailhead', 'That’s the trailhead. Low gear, steady on the throttle, and keep off the edge on the traverse.');
        }
        if (player.parachute && distanceBetween(player, SUMMIT_JOB.peak) < 1400)
          summitBeat(m, 'jump', 'You jumped? It’s ten metres of flat rock up there and a long way down on every side. Aim for the cairn.');
        if (player.tumble && distanceBetween(player, SUMMIT_JOB.peak) < 700) summitBeat(m, 'scree', 'The scree’s loose. Stay on the trail, or on the rock at the very top.');
        if (summitArrived()) {
          setStage(
            1,
            m.cache,
            c ? 'GET OUT · DIG UP THE PACKAGE AT THE CAIRN' : 'DIG UP THE PACKAGE AT THE CAIRN · HOLD ' + keyName('interact'),
            'vinny',
            'Tommy said the foot of the big cairn, the side facing the sea. Stones on top, a foot of grit under them. Dig.',
          );
          missionBrief('You made it to the summit. The package is buried under the stone cairn: ' + (c ? 'get out and ' : '') + 'hold ' + keyName('interact') + ' to dig it up.');
          tell('THE SUMMIT · Mount Ascent', 3);
        }
        return;
      }
      if (m.stage === 1) {
        const at = !c && !player.tumble && !player.parachute && distanceBetween(player, m.cache) < SUMMIT_JOB.digReach;
        if (c && m.instruction.indexOf('GET OUT') !== 0) m.instruction = 'GET OUT · DIG UP THE PACKAGE AT THE CAIRN';
        if (!c && m.instruction.indexOf('GET OUT') === 0) m.instruction = 'DIG UP THE PACKAGE AT THE CAIRN · HOLD ' + keyName('interact');
        if (at && actionHeld('interact')) {
          player.digUntil = gameTime + 0.2;
          player.digFacing = headingBetween(player, m.cache);
          player.a = player.digFacing;
          m.dig = Math.min(1, m.dig + deltaSeconds / SUMMIT_JOB.digSeconds);
          m.digSound -= deltaSeconds;
          if (m.digSound <= 0) {
            // Stones lifted aside, then a hand trowel in packed grit.
            m.digSound = sfxRandom(0.38, 0.56);
            noise(sfxRandom(0.1, 0.16), m.dig < 0.25 ? 0.13 : 0.09, m.dig < 0.25 ? 900 : sfxRandom(480, 740));
            // Grit thrown aside (a stand-in for the renderer's dust; no draw from the game's random stream).
            particle(m.cache.x + Math.sin(m.dig * 91) * 3, m.cache.y + Math.cos(m.dig * 57) * 3, '#7b6a54', 2, 45, 2, true);
          }
          if (m.dig > 0.62 && !m.digKnock) {
            m.digKnock = true;
            tone(118, 0.09, 0.16, 'square');
            tell('Something hard under the grit. A case, wrapped in plastic.', 3);
          }
          if (m.dig >= 1) {
            player.digUntil = 0;
            summitPackageOut(m);
          }
        }
        return;
      }
      if (m.stage === 2) {
        // Load it into the vehicle: E at its back (summitJobInteract), or just get in.
        const car = m.lastCar;
        if (c && c.hp > 0) {
          summitStow(m, c);
          return;
        }
        if (!car || car.hp <= 0 || distanceBetween(player, car) > 320) {
          m.carrier = 'backpack';
          summitDeliverStage(m, 'In the backpack, then. Don’t drop it.');
        } else summitRearPoint(car, m.target);
        return;
      }
      if (m.stage === 3) {
        // With the police on him: told once each time, Vinny will not open the door.
        if (wantedStars > 0 && !m.heatBriefed) {
          m.heatBriefed = true;
          missionBrief('Vinny won’t open his door with the police on your tail. Lose them before you go to the warehouse.', { tone: 'alert' });
        } else if (wantedStars === 0) m.heatBriefed = false;
        // Driven into the warehouse with it in the vehicle: getting out takes it along.
        if (m.carrier === 'car' && !c && insideDepot(player.x, player.y) && distanceBetween(player, m.carryCar) < 120) m.carrier = 'hand';
        if (insideDepot(player.x, player.y)) summitVinny(m);
        const d = summitDeliveryTarget(m);
        if (d.target !== m.target || d.text !== m.instruction) {
          m.target = d.target;
          m.instruction = d.text;
          updateUI();
        }
        if (insideDepot(player.x, player.y) && wantedStars === 0)
          summitBeat(m, 'inside', 'In here. Bring it over.');
        return;
      }
      if (m.stage === 4) {
        m.handover -= deltaSeconds;
        if (m.vinny) m.vinny.a = headingBetween(m.vinny, player);
        if (m.handoverLine && gameTime > m.handoverLine) {
          m.handoverLine = 0;
          missionLine('vinny', 'Go home, get some sleep. Next one’s bigger: I’ve got a buyer for something the army owns.');
        }
        if (m.handover <= 0) winMission();
      }
    }
    function summitRearPoint(c, out = { x: 0, y: 0 }) {
      const back = vehicleSpec(c).l / 2 + 10;
      out.x = c.x - Math.cos(c.a) * back;
      out.y = c.y - Math.sin(c.a) * back;
      return out;
    }
    function summitPackageOut(m) {
      m.dig = 1;
      tone(220, 0.07, 0.1, 'triangle');
      announce('HIGH GROUND', 'PACKAGE RECOVERED', 2.6);
      const car = m.lastCar;
      if (car && car.hp > 0 && distanceBetween(player, car) < 320) {
        m.carrier = 'hand';
        setStage(
          2,
          summitRearPoint(car),
          'LOAD IT INTO THE ' + summitVehicleWord(car) + ' · ' + keyName('interact') + ' AT THE BACK',
          'vinny',
          'Got it? Don’t open it. What you don’t know, nobody can beat out of you. Put it in the ' + summitVehicleWord(car).toLowerCase() + '.',
        );
        missionBrief('Package recovered. Load it into your ' + summitVehicleWord(car).toLowerCase() + ': ' + keyName('interact') + ' at the back, or just get in.');
      } else {
        m.carrier = 'backpack';
        summitDeliverStage(m, 'Got it? Don’t open it. What you don’t know, nobody can beat out of you. Zip it in the backpack and come down slow.');
        missionBrief('Package recovered and zipped into your backpack. Take it down the mountain to Vinny’s warehouse.');
      }
    }
    function summitStow(m, c) {
      m.carrier = 'car';
      m.carryCar = c;
      c.mission = true;
      tone(160, 0.06, 0.12, 'triangle');
      summitDeliverStage(m, 'Good. Bring it to the warehouse. Easy on the way down, the mountain doesn’t forgive.');
      missionBrief('The package is loaded. Drive it down the mountain to Vinny’s warehouse, carefully.');
      tell('PACKAGE LOADED · ' + summitVehicleWord(c), 2.6);
    }
    function summitDeliverStage(m, line) {
      const d = summitDeliveryTarget(m);
      setStage(3, d.target, d.text, 'vinny', line);
    }
    function summitJobInteract() {
      const m = summitJob();
      if (!m) return false;
      // Stage 1: E is held to dig (updateSummitJob); a press at the cairn is taken here.
      if (m.stage === 1 && !player.car && distanceBetween(player, m.cache) < SUMMIT_JOB.digReach) return true;
      if (m.stage === 2 && !player.car && m.lastCar && distanceBetween(player, summitRearPoint(m.lastCar)) < SUMMIT_JOB.loadReach) {
        player.lootUntil = gameTime + LOOT_CROUCH;
        player.lootFacing = headingBetween(player, m.lastCar);
        summitStow(m, m.lastCar);
        return true;
      }
      if (m.stage === 3 && !player.car && m.vinny && m.carrier !== 'car' && wantedStars === 0 && insideDepot(player.x, player.y) && distanceBetween(player, m.vinny) < SUMMIT_JOB.handReach) {
        m.stage = 4;
        m.handover = 6.5;
        m.target = m.vinny;
        m.instruction = 'HAND VINNY THE PACKAGE';
        player.lootUntil = gameTime + LOOT_CROUCH;
        player.lootFacing = headingBetween(player, m.vinny);
        missionLine('vinny', 'Tommy said the mountain would keep it. He was right. Nobody goes up there... except you, now.');
        m.handoverLine = gameTime + 3.4;
        return true;
      }
      return false;
    }
    function summitJobUI() {
      const m = summitJob();
      if (!m) return;
      if (m.stage === 1 && !player.car && distanceBetween(player, m.cache) < SUMMIT_JOB.digReach + 6) {
        if (m.dig > 0 && summitDigging())
          offerPrompt('DIGGING TO RETRIEVE PACKAGE · ' + Math.floor(m.dig * 100) + ' %', { hold: true, id: 'summit-dig' });
        else offerPrompt(m.dig > 0 ? 'KEEP DIGGING · ' + Math.floor(m.dig * 100) + ' %' : 'DIG UP THE PACKAGE', { hold: true, id: 'summit-dig' });
      }
      if (m.stage === 2 && !player.car && m.lastCar && distanceBetween(player, summitRearPoint(m.lastCar)) < SUMMIT_JOB.loadReach)
        offerPrompt('LOAD THE PACKAGE', { id: 'summit-load' });
      if (m.stage === 3 && !player.car && m.vinny && insideDepot(player.x, player.y) && distanceBetween(player, m.vinny) < SUMMIT_JOB.handReach && m.carrier !== 'car')
        offerPrompt(wantedStars > 0 ? 'LOSE THE POLICE FIRST' : 'HAND OVER THE PACKAGE', { key: wantedStars > 0 ? null : 'interact', id: 'summit-hand' });
    }
    /* What the renderer draws at the summit (summitjob3d.js): the cairn, the hole as
       it is dug and the case until it is lifted out. Null when no job needs it. */
    function summitCacheView() {
      const m = summitJob();
      if (!m || !m.cache) return null;
      return { x: m.cache.x, y: m.cache.y, z: m.cache.altitude, dig: m.dig, taken: m.stage >= 2 };
    }
    function summitJobReport() {
      const m = summitJob();
      if (!m) return null;
      const pt = (p) => (p ? { x: Math.round(p.x), y: Math.round(p.y) } : null);
      return {
        stage: m.stage,
        instruction: m.instruction,
        target: pt(m.target),
        dig: Math.round(m.dig * 100) / 100,
        digging: summitDigging(),
        carrier: m.carrier,
        carryCar: m.carryCar ? { type: m.carryCar.type, hp: Math.round(m.carryCar.hp) } : null,
        lastCar: m.lastCar ? m.lastCar.type : null,
        arrived: summitArrived(),
        cache: m.cache,
        summit: m.summit,
        vinny: pt(m.vinny),
        insideDepot: insideDepot(player.x, player.y),
        beats: Object.keys(m.beats),
      };
    }
    // END SUBSYSTEM: src/summitjob.js
