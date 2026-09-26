    // BEGIN SUBSYSTEM: src/garages.js — Drive-in repair and respray
    /**
     * Drive-in repair and respray
     * Source: src/garages.js
     * Scope: shared game closure.
     * The respray and repair garages: their real-scale plan (walls, roll-up door,
     * bay, office), the price list, the drive-in sequence and the rule for the
     * police, the mechanics on duty and the map marks. garage3d.js draws them.
     *
     * THE BUILDING (GARAGE_PLAN, metres): a steel-framed brick workshop 10 m wide
     * inside and 15 m deep, eaves at 6.4 m, a sectional roll-up door 6 m wide and
     * 5 m high on the street side (the 12 m bus and the 10 m box truck fit with
     * a metre and a half at each end), a two-post lift at the middle of the bay
     * and a 6 x 8 m office beside it. The roof and the office are overhead cover
     * (air-cover.js): inside, the police helicopter has lost you, and with no
     * ground unit in sight the lose-police timer runs.
     *
     * THE PRICE LIST (garageOffer): a respray by the vehicle's class ($200 for a
     * motorcycle to $500 for a truck or bus), a repair by the damage ($100 for a
     * scuff to $1,500 for a wreck), both together 15% off. Short of the full
     * bill the shop offers the respray alone; short of that, "come back with
     * cash" and no service. Vinny covers the cargo truck on the first job.
     *
     * THE SEQUENCE (repairJob.phase), about 11 s, E skips to the bill:
     *   rollin    the car rolls in at walking pace to the lift
     *   doorDown  the door rattles down behind it
     *   work      the camera frames the bay: paint mist and the new colour
     *             creeping over the body, grinder sparks when there is damage
     *   fade      a dip to black with the bill: the service is applied here
     *   doorUp    the door rolls up
     *   driveout  the car rolls out onto the apron and the player has it back
     *
     * THE POLICE RULE: a respray clears the wanted level only when no police
     * unit (on the ground or in the air) had eyes on the player between the
     * order and the door shutting. Seen driving in, the paint fools nobody: the
     * stars stay (the roof still hides you, so the search timer keeps running).
     * The first mission's cargo truck is the exception its script needs.
     */
    const GARAGE_PLAN = {
      bayWidth: 10 * UNITS_PER_METRE, // inside faces of the side walls
      bayDepth: 15 * UNITS_PER_METRE, // door line to the back wall's inside face
      wall: 0.4 * UNITS_PER_METRE,
      eaves: 6.4 * UNITS_PER_METRE, // underside of the roof deck
      roof: 0.5 * UNITS_PER_METRE, // deck and parapet coping above the eaves
      doorWidth: 6 * UNITS_PER_METRE,
      doorHeight: 5 * UNITS_PER_METRE,
      officeWidth: 6 * UNITS_PER_METRE,
      officeDepth: 8 * UNITS_PER_METRE,
      officeHeight: SHOP_FLOOR,
      // Lift posts either side of the service spot (3.6 m apart inside).
      liftHalfSpan: 2.25 * UNITS_PER_METRE,
      // The facade stands this far south of the lot's centre (the apron in
      // front of the door is the rest of the lot, about 7.5 m), and the bay's
      // centre this far west of it (the office takes the east side).
      facadeOffset: 38,
      bayOffset: -24,
    };
    /* Physical repair bays: the same walls drive walking, vehicle contacts and rendering.
       Every shop's billboard carries the word MECHANICS (`tagline`). */
    const GARAGES = [
      {
        id: 'eastside',
        name: 'EASTSIDE GARAGE',
        tagline: 'MECHANICS · RESPRAY · REPAIR',
        x: 1320,
        y: 2022,
        roadY: 2176,
        color: '#83c5bd',
      },
      {
        id: 'palm',
        name: 'PALM KEYS AUTO',
        tagline: 'MECHANICS · RESPRAYS WHILE YOU WAIT',
        x: -2268,
        y: 2530,
        roadY: 2688,
        color: '#e5ab9d',
      },
      {
        id: 'south',
        name: 'SOUTH BANK MOTOR WORKS',
        tagline: 'MECHANICS · BODYWORK · PAINT',
        x: 2470,
        y: 3555,
        roadY: 3712,
        color: '#d9bc78',
      },
      {
        id: 'county',
        name: 'STONECREEK GARAGE',
        tagline: 'MECHANICS · TOWING · TYRES',
        x: 6950,
        y: 3555,
        roadY: 3712,
        color: '#8ebac8',
        // A mountain village's garage (mountain-village.js): fieldstone and
        // board-and-batten under a steep red metal gable, drawn by garage3d.js.
        rustic: true,
      },
    ];
    /* Each shop's plan in map units, worked out once: the bay (inside faces),
       the facade line, the door, the office, the service spot on the lift and
       the apron exit. The door's `open` (0 shut .. 1 up) is live state. */
    for (const s of GARAGES) {
      const P = GARAGE_PLAN,
        bayX = s.x + P.bayOffset,
        front = s.y + P.facadeOffset,
        inner = front - P.wall;
      s.bayX = bayX;
      s.front = front;
      s.bay = { x0: bayX - P.bayWidth / 2, x1: bayX + P.bayWidth / 2, y0: inner - P.bayDepth, y1: inner };
      s.back = s.bay.y0 - P.wall;
      s.door = { x0: bayX - P.doorWidth / 2, x1: bayX + P.doorWidth / 2, y: front - P.wall / 2 };
      s.office = { x: s.bay.x1 + P.wall, y: front - P.officeDepth, w: P.officeWidth, h: P.officeDepth };
      s.service = { x: bayX, y: inner - P.bayDepth / 2 };
      s.open = 1;
      s.lotY1 = s.roadY - 56;
    }
    let repairJob = null,
      garageWallCache = null,
      garageLastService = null,
      garageStaffTimer = 0;
    function garageWalls() {
      return garageWallCache || (garageWallCache = computeGarageWalls());
    }
    function computeGarageWalls() {
      const P = GARAGE_PLAN,
        high = P.eaves + P.roof;
      return GARAGES.flatMap((s) => {
        const { bay, door, office } = s,
          wallX0 = bay.x0 - P.wall,
          wallX1 = bay.x1 + P.wall;
        return [
          // Side walls and the back wall.
          { x: wallX0, y: s.back, w: P.wall, h: s.front - s.back, height: high, shop: s.id },
          { x: bay.x1, y: s.back, w: P.wall, h: s.front - s.back, height: high, shop: s.id },
          { x: wallX0, y: s.back, w: wallX1 - wallX0, h: P.wall, height: high, shop: s.id },
          // The facade either side of the door opening.
          { x: wallX0, y: s.front - P.wall, w: door.x0 - wallX0, h: P.wall, height: high, shop: s.id },
          { x: door.x1, y: s.front - P.wall, w: wallX1 - door.x1, h: P.wall, height: high, shop: s.id },
          // The two lift posts: 25 cm steel columns either side of the service spot.
          ...[-1, 1].map((side) => ({
            x: s.service.x + side * P.liftHalfSpan - (side < 0 ? 3.2 : 0),
            y: s.service.y - 2,
            w: 3.2,
            h: 4,
            height: 30,
            shop: s.id,
          })),
          // The office: a closed block (the counter is inside, out of play).
          { x: office.x, y: office.y, w: office.w, h: office.h, height: P.officeHeight + 3, shop: s.id },
        ];
      });
    }
    /* The door as a solid while it is down (people and sight lines; the physics
       has its own body per door, garageDoorBody). One reused list. */
    const garageShutDoors = [];
    function garageDoorSolids() {
      garageShutDoors.length = 0;
      for (const s of GARAGES)
        if (s.open < 0.95)
          garageShutDoors.push({
            x: s.door.x0,
            y: s.front - GARAGE_PLAN.wall,
            w: s.door.x1 - s.door.x0,
            h: GARAGE_PLAN.wall,
            height: GARAGE_PLAN.doorHeight * (1 - s.open) + 4,
          });
      return garageShutDoors;
    }
    function garageBlocked(x, y, r = 8) {
      if (rectListBlocked(garageWalls(), x, y, r)) return true;
      for (const s of GARAGES)
        if (
          s.open < 0.95 &&
          x + r > s.door.x0 &&
          x - r < s.door.x1 &&
          y + r > s.front - GARAGE_PLAN.wall &&
          y - r < s.front
        )
          return true;
      return false;
    }
    /* Vehicles (physics.js) meet a door only while it is down: the body's
       minHeight lifts it out of reach while the door is up. */
    function addGarageDoorBodies() {
      for (const s of GARAGES) {
        s.doorBody = addStatic(s.door.x0, s.front - GARAGE_PLAN.wall, s.door.x1 - s.door.x0, GARAGE_PLAN.wall, GARAGE_PLAN.doorHeight, 'garage door');
        s.doorBody.minHeight = 1e9;
      }
    }
    function setGarageDoor(s, open) {
      s.open = clamp(open, 0, 1);
      if (s.doorBody) s.doorBody.minHeight = s.open > 0.9 ? 1e9 : undefined;
    }
    function inGarageLot(x, y, r = 0) {
      return GARAGES.some(
        (s) => x > s.x - 108 - r && x < s.x + 108 + r && y > s.y - 98 - r && y < s.lotY1 + r,
      );
    }
    // Which vehicles a shop will take: road vehicles that are not wrecks, pushbikes or tanks.
    function garageServiceable(vehicle) {
      return (
        !!vehicle &&
        vehicle.hp > 0 &&
        vehicle.type !== 'bicycle' &&
        !isBoat(vehicle) &&
        !isAircraft(vehicle) &&
        !vehicleSpec(vehicle).tank
      );
    }
    // The shop whose bay holds the whole vehicle (behind the door line), or null.
    function garageForCar(vehicle) {
      if (!garageServiceable(vehicle)) return null;
      for (const s of GARAGES) {
        if (Math.abs(vehicle.x - s.bayX) > 120 || Math.abs(vehicle.y - s.service.y) > 140) continue;
        if (
          corners(vehicleShape(vehicle, 1)).every(
            (p) => p.x > s.bay.x0 + 1 && p.x < s.bay.x1 - 1 && p.y > s.bay.y0 + 1 && p.y < s.bay.y1 + 2,
          )
        )
          return s;
      }
      return null;
    }
    /* Lined up to drive in: in the bay, or on the apron in front of the door
       with the nose towards it and narrow enough to pass. Returns the shop. */
    function garageApproach(vehicle) {
      if (!garageServiceable(vehicle)) return null;
      const inside = garageForCar(vehicle);
      if (inside) return inside;
      for (const s of GARAGES) {
        const lateral = vehicle.x - s.bayX,
          ahead = vehicle.y - s.front;
        if (Math.abs(lateral) > GARAGE_PLAN.doorWidth / 2 || ahead < -GARAGE_PLAN.bayDepth || ahead > 150) continue;
        if (vehicleSpec(vehicle).w > GARAGE_PLAN.doorWidth - 8) continue;
        // Nose north (towards the door), within 50 degrees.
        if (Math.abs(normalizeAngle(vehicle.a + Math.PI / 2)) > 0.87) continue;
        return s;
      }
      return null;
    }
    /* THE PRICE LIST. Respray by class; repair by damage; together 15% off. */
    const GARAGE_RESPRAY_PRICES = [
      { id: 'motorcycle', label: 'MOTORCYCLE', price: 200 },
      { id: 'compact', label: 'COMPACT', price: 250 },
      { id: 'saloon', label: 'SALOON', price: 300 },
      { id: 'performance', label: 'PERFORMANCE', price: 400 },
      { id: 'utility', label: 'SUV / VAN', price: 400 },
      { id: 'heavy', label: 'TRUCK / BUS', price: 500 },
    ];
    const GARAGE_BUNDLE_DISCOUNT = 0.15;
    function garageVehicleClass(vehicle) {
      const spec = vehicleSpec(vehicle),
        type = vehicle.type,
        byId = (id) => GARAGE_RESPRAY_PRICES.find((c) => c.id === id);
      if (spec.bike && !spec.bicycle) return byId('motorcycle');
      if (spec.truck && spec.l > 8 * UNITS_PER_METRE) return byId('heavy');
      if (spec.flagship || ['supercar', 'luxury', 'limousine', 'sport', 'roadster', 'rally', 'muscle', 'hotrod'].includes(type)) return byId('performance');
      if (spec.truck || ['suv', 'pickup', 'van', 'ambulance'].includes(type)) return byId('utility');
      return byId(spec.l < 4.6 * UNITS_PER_METRE ? 'compact' : 'saloon');
    }
    // How badly the vehicle is hurt, 0 (showroom) .. 1 (a wreck on its wheels).
    function garageDamageShare(vehicle) {
      const damage = ensureDamage(vehicle),
        hpLoss = 1 - clamp(vehicle.hp / (vehicle.maxhp || 1), 0, 1),
        body = (damage.front + damage.rear + damage.left + damage.right) / 4,
        parts = Object.values(damage.parts).filter((v) => v > 0).length / 6,
        glass = Object.values(damage.glass).filter((v) => v > 0).length / 4,
        tyres = Object.values(damage.tires).filter(Boolean).length / 4,
        dents = Math.min(1, (vehicle.dents?.length || 0) / 12);
      return clamp(Math.max(hpLoss, body) * 0.75 + parts * 0.1 + glass * 0.05 + tyres * 0.05 + dents * 0.05, 0, 1);
    }
    const roundPrice = (dollars) => Math.round(dollars / 10) * 10;
    function garageRepairPrice(vehicle) {
      const share = garageDamageShare(vehicle);
      return share < 0.01 ? 0 : roundPrice(100 + share * 1400);
    }
    /* The offer at the door: what the shop will do and for how much. `service`
       is 'full' (respray + repair), 'respray' or null (refused, not enough cash). */
    function garageOffer(vehicle) {
      const cls = garageVehicleClass(vehicle),
        respray = cls.price,
        repair = garageRepairPrice(vehicle),
        bundle = repair ? roundPrice((respray + repair) * (1 - GARAGE_BUNDLE_DISCOUNT)) : respray,
        free = cargoChase()?.car === vehicle,
        offer = { vehicleClass: cls.label, respray, repair, bundle, free, service: null, total: 0, label: '' };
      if (free) Object.assign(offer, { service: 'full', total: 0, label: repair ? 'RESPRAY + REPAIR' : 'RESPRAY' });
      else if (cash >= bundle) Object.assign(offer, { service: 'full', total: bundle, label: repair ? 'RESPRAY + REPAIR' : 'RESPRAY' });
      else if (cash >= respray) Object.assign(offer, { service: 'respray', total: respray, label: 'RESPRAY ONLY' });
      else offer.label = 'COME BACK WITH CASH';
      return offer;
    }
    /* What the prompt says in a vehicle at or in a garage (null elsewhere). */
    function garagePrompt(vehicle) {
      if (repairJob) return repairJob.phase === 'driveout' ? '' : 'SKIP';
      // Vinny's coupe with its tracker (challenges.js): no respray until it is out.
      if (mission?.index === 2 && [1, 2].includes(mission.stage) && garageForCar(vehicle)) return 'GET OUT · REMOVE THE TRACKER';
      const s = garageApproach(vehicle);
      if (!s) {
        // Heading for a garage (nose within 90 degrees of its door): how to get served.
        if (
          garageServiceable(vehicle) &&
          Math.abs(normalizeAngle(vehicle.a + Math.PI / 2)) < Math.PI / 2 &&
          GARAGES.some((g) => distanceBetween(vehicle, g) < 220 && vehicle.y > g.front)
        )
          return 'LINE UP WITH THE DOOR · DRIVE IN';
        return null;
      }
      const offer = garageOffer(vehicle);
      if (offer.free) return offer.label + ' · VINNY PAYS';
      if (!offer.service) return 'RESPRAY $' + offer.respray + ' · COME BACK WITH CASH';
      return offer.label + ' · $' + offer.total;
    }
    /* Whether any police unit, on the ground or in the air, has eyes on the
       player this frame (the same test the search uses, citylife.js). */
    function garageWatched() {
      return wantedStars > 0 && policeHaveEyesOnPlayer();
    }
    function garageInteract() {
      const c = player.car;
      if (repairJob) {
        skipGarageJob();
        return true;
      }
      if (!c) return false;
      if (mission?.index === 2 && [1, 2].includes(mission.stage) && garageForCar(c)) {
        if (c === mission.car && garageForCar(c).id === 'eastside' && Math.abs(c.speed) < 8 && mission.stage === 1)
          setStage(2, c, 'GET OUT · HOLD E BESIDE THE COUPE TO REMOVE TRACKER');
        exitCar();
        if (!player.car)
          tell(
            mission.stage === 2
              ? 'Hold E beside the coupe to remove its transmitter before respraying.'
              : 'Take the marked coupe to Eastside Garage to remove its transmitter.',
            4,
          );
        return true;
      }
      const s = garageApproach(c);
      if (!s) return false;
      if (mission?.index === 10 && mission.stage === 5) {
        tell('They identified Daniel. Get him inside Vinny’s warehouse.', 4);
        return true;
      }
      if (cargoChase() && cargoChase().car !== c) {
        tell('They are tracking the cargo truck. Respray that truck to lose them.', 4);
        return true;
      }
      if (Math.abs(c.speed) > 30 * KMH) {
        tell('Slow down and roll in: the mechanics wave you in under 30 km/h.', 3);
        return true;
      }
      const offer = garageOffer(c);
      if (!offer.service) {
        announce(s.name, 'COME BACK WITH CASH', 2.6);
        tell('Sorry, friend: a respray on this one is $' + offer.respray + '. Come back with cash.', 4);
        tone(220, 0.18, 0.12, 'triangle', 180);
        garageLastService = { shop: s.id, refused: true, cash, offer };
        return true;
      }
      startGarageJob(c, s, offer);
      return true;
    }
    function startGarageJob(car, shop, offer) {
      // Nose in from the apron; a car already in the bay keeps the way it faces.
      const inside = garageForCar(car) === shop,
        facingOut = inside && Math.abs(normalizeAngle(car.a - Math.PI / 2)) < Math.PI / 2,
        heading = facingOut ? Math.PI / 2 : -Math.PI / 2,
        distance = Math.hypot(shop.service.x - car.x, shop.service.y - car.y);
      repairJob = {
        car,
        shop,
        offer,
        phase: 'rollin',
        t: 0,
        duration: clamp(distance / (9 * KMH), 0.8, 2.8),
        from: { x: car.x, y: car.y, a: car.a },
        heading,
        colorFrom: car.color,
        colorTo: pickNewPaint(car.color),
        seen: garageWatched(),
        wantedAtStart: wantedStars,
        cashBefore: cash,
        sound: 0,
        sparks: 0,
        skipped: false,
        applied: false,
      };
      car.vx = car.vy = car.speed = car.av = 0;
      keys = {};
      announce(shop.name, offer.label + (offer.free ? ' · VINNY PAYS' : ' · $' + offer.total), 2.4);
    }
    function pickNewPaint(current) {
      const options = VEHICLE_PAINT_COLORS.filter((c) => c !== current);
      return options[Math.floor(seededRandom() * options.length) % options.length];
    }
    // '#rrggbb' mix, for the new colour creeping over the body.
    function mixPaint(a, b, t) {
      const pa = /^#([0-9a-f]{6})$/i.exec(a || ''),
        pb = /^#([0-9a-f]{6})$/i.exec(b || '');
      if (!pa || !pb) return t < 0.5 ? a : b;
      const na = parseInt(pa[1], 16),
        nb = parseInt(pb[1], 16);
      let out = '#';
      for (const shift of [16, 8, 0]) {
        const va = (na >> shift) & 255,
          vb = (nb >> shift) & 255;
        out += Math.round(va + (vb - va) * t).toString(16).padStart(2, '0');
      }
      return out;
    }
    const GARAGE_PHASES = { doorDown: 1.5, work: 3.4, fade: 1.1, doorUp: 1.3, driveout: 1.7 };
    const smoothstep01 = (t) => {
      const u = clamp(t, 0, 1);
      return u * u * (3 - 2 * u);
    };
    function nextGaragePhase(job, phase) {
      job.phase = phase;
      job.t = 0;
      if (phase !== 'rollin') job.duration = GARAGE_PHASES[phase];
    }
    /* E during the show: straight to the bill (or, once it is paid, out). */
    function skipGarageJob() {
      const job = repairJob;
      if (!job || job.phase === 'driveout') return;
      job.skipped = true;
      if (['rollin', 'doorDown', 'work'].includes(job.phase)) {
        placeGarageCar(job, job.shop.service.x, job.shop.service.y, job.heading);
        setGarageDoor(job.shop, 0);
        nextGaragePhase(job, 'fade');
        job.duration = 0.7;
      } else if (job.phase === 'fade' || job.phase === 'doorUp') {
        if (!job.applied) applyGarageService(job);
        setGarageDoor(job.shop, 1);
        hideGarageFade();
        nextGaragePhase(job, 'driveout');
        job.duration = 0.6;
      }
    }
    function placeGarageCar(job, x, y, a) {
      const c = job.car;
      c.x = x;
      c.y = y;
      c.a = a;
      c.vx = c.vy = c.speed = c.av = 0;
      player.x = x;
      player.y = y;
      player.a = a;
    }
    function updateGarage(deltaSeconds) {
      staffGarages(deltaSeconds);
      const job = repairJob;
      if (!job) return;
      const { car, shop } = job;
      if (car !== player.car || car.hp <= 0) {
        endGarageJob(job, true);
        return;
      }
      player.inv = Math.max(player.inv, 0.15);
      job.t += deltaSeconds;
      const k = clamp(job.t / job.duration, 0, 1);
      // Anyone watching while the car goes in and the door comes down saw it go in.
      if ((job.phase === 'rollin' || job.phase === 'doorDown') && garageWatched()) job.seen = true;
      if (job.phase === 'rollin') {
        // Centre on the door first (the sides clear the jambs), then roll on to the lift.
        const side = smoothstep01(k / 0.55),
          along = smoothstep01(k);
        placeGarageCar(
          job,
          job.from.x + (shop.service.x - job.from.x) * side,
          job.from.y + (shop.service.y - job.from.y) * along,
          job.from.a + normalizeAngle(job.heading - job.from.a) * side,
        );
        garageSounds(job, deltaSeconds, 'engine');
        if (k >= 1) nextGaragePhase(job, 'doorDown');
      } else if (job.phase === 'doorDown') {
        placeGarageCar(job, shop.service.x, shop.service.y, job.heading);
        setGarageDoor(shop, 1 - smoothstep01(k));
        garageSounds(job, deltaSeconds, 'door');
        if (k >= 1) {
          garageSounds(job, 0, 'clunk');
          nextGaragePhase(job, 'work');
        }
      } else if (job.phase === 'work') {
        // The new colour goes on over the first two thirds; sparks for a repair after.
        car.color = mixPaint(job.colorFrom, job.colorTo, smoothstep01((k - 0.08) / 0.62));
        garageSounds(job, deltaSeconds, k < 0.7 || job.offer.service !== 'full' || !job.offer.repair ? 'spray' : 'grind');
        if (k >= 1) nextGaragePhase(job, 'fade');
      } else if (job.phase === 'fade') {
        // Down to black, the bill, back up.
        const opacity = k < 0.4 ? k / 0.4 : k < 0.62 ? 1 : 1 - (k - 0.62) / 0.38;
        showGarageFade(job, opacity);
        if (k >= 0.4 && !job.applied) applyGarageService(job);
        if (k >= 1) {
          hideGarageFade();
          nextGaragePhase(job, 'doorUp');
        }
      } else if (job.phase === 'doorUp') {
        setGarageDoor(shop, smoothstep01(k));
        garageSounds(job, deltaSeconds, 'door');
        if (k >= 1) nextGaragePhase(job, 'driveout');
      } else if (job.phase === 'driveout') {
        // Pull away from the lift and out past the door onto the apron.
        const exitY = shop.front + vehicleSpec(car).l / 2 + 10,
          travel = exitY - shop.service.y,
          eased = k * k * 0.6 + k * 0.4;
        placeGarageCar(job, shop.service.x, shop.service.y + travel * eased, Math.PI / 2);
        setGarageDoor(shop, 1);
        if (k >= 1) {
          // Rolling at walking pace onto the apron: the player takes it from there.
          const speed = 8 * KMH;
          car.speed = speed;
          car.vx = 0;
          car.vy = speed;
          endGarageJob(job, false);
        }
      }
    }
    /* Pay, paint, mend, and the police rule. Runs once, under the fade. */
    function applyGarageService(job) {
      const { car, shop, offer } = job;
      job.applied = true;
      cash -= offer.total;
      car.color = job.colorTo;
      if (offer.service === 'full') repairVehicle(car);
      car.bloodTrackRemaining = 0;
      car.bloodyUntil = 0;
      // The car comes out nose first.
      job.heading = Math.PI / 2;
      placeGarageCar(job, shop.service.x, shop.service.y, Math.PI / 2);
      const escaped = evadeCargoPolice(car);
      let cleared = false;
      if (!escaped && wantedStars > 0 && !job.seen) {
        clearPolice(true);
        cleared = true;
      }
      garageLastService = {
        shop: shop.id,
        name: shop.name,
        service: offer.service,
        label: offer.label,
        vehicleClass: offer.vehicleClass,
        respray: offer.respray,
        repair: offer.service === 'full' ? offer.repair : 0,
        charged: offer.total,
        cashBefore: job.cashBefore,
        cashAfter: cash,
        colorFrom: job.colorFrom,
        colorTo: job.colorTo,
        seenEntering: job.seen,
        starsBefore: job.wantedAtStart,
        starsAfter: wantedStars,
        cleared: cleared || escaped,
        skipped: job.skipped,
      };
      tell(
        escaped
          ? 'Cops lost · Vinny covered the paint · Deliver the crates'
          : job.seen && wantedStars > 0
            ? 'They saw you drive in: fresh paint won’t fool them. Lose them first.'
            : (offer.service === 'full' && offer.repair ? 'Fresh paint · Full repair' : 'Fresh paint') +
              (offer.total ? ' · $' + offer.total : '') +
              (cleared ? ' · Cops lost' : ''),
        5,
      );
      save();
      tone(1320, 0.08, 0.12, 'triangle');
      tone(1760, 0.14, 0.1, 'triangle');
    }
    function endGarageJob(job, aborted) {
      if (!job.applied && !aborted) applyGarageService(job);
      setGarageDoor(job.shop, 1);
      hideGarageFade();
      if (!aborted) announce(job.shop.name, 'THANKS · DRIVE SAFE', 2);
      repairJob = null;
    }
    // Cancel without charging (death, teleport, mission reset).
    function cancelGarageJob() {
      if (repairJob) endGarageJob(repairJob, true);
    }
    /* The dip to black borrows the ride-skip card (ride-skip.js): the shop and the bill. */
    function showGarageFade(job, opacity) {
      const el = getElement('rideSkip');
      if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        getElement('rideSkipKicker').textContent = job.shop.name;
        getElement('rideSkipTitle').textContent =
          job.offer.service === 'full' && job.offer.repair ? 'RESPRAYED · REPAIRED' : 'RESPRAYED';
        getElement('rideSkipDetail').textContent = job.offer.free
          ? 'On Vinny’s account'
          : job.offer.vehicleClass + ' · $' + job.offer.total + ' paid';
        getElement('rideSkipBar').style.transform = 'scaleX(1)';
      }
      el.style.opacity = opacity.toFixed(3);
      el.style.setProperty('--card', clamp(opacity * 1.4 - 0.2, 0, 1).toFixed(3));
    }
    function hideGarageFade() {
      if (rideSkipActive()) return;
      const el = getElement('rideSkip');
      if (el.classList.contains('hidden')) return;
      el.classList.add('hidden');
      el.style.opacity = '0';
      el.style.setProperty('--card', '0');
    }
    /* Workshop noises from the tone and noise voices (audio.js). */
    function garageSounds(job, deltaSeconds, kind) {
      job.sound -= deltaSeconds;
      if (kind === 'clunk') {
        noise(0.3, 0.3, 380);
        tone(58, 0.35, 0.25, 'sine', 40);
        return;
      }
      if (job.sound > 0) return;
      if (kind === 'door') {
        // Slats rattling over the drum.
        job.sound = 0.055;
        tone(randomBetween(70, 125), 0.045, 0.07, 'square');
        noise(0.04, 0.05, 1100);
      } else if (kind === 'spray') {
        job.sound = 0.12;
        noise(0.16, 0.07, 5200);
      } else if (kind === 'grind') {
        job.sound = 0.1;
        tone(randomBetween(2300, 2700), 0.11, 0.035, 'sawtooth', 2100);
        noise(0.09, 0.05, 6500);
      } else if (kind === 'engine') {
        job.sound = 0.3;
        tone(48, 0.28, 0.08, 'sawtooth', 44);
      }
    }
    /* The camera during the show (game.js camera follow and world-view.js zoom):
       from the door coming down it frames the bay, a little closer in. */
    function garageCameraFrame() {
      const job = repairJob;
      if (!job || job.phase === 'rollin' || job.phase === 'driveout') return null;
      return { x: job.shop.service.x, y: job.shop.service.y + 14, zoom: 1.75 };
    }
    /* Two mechanics in the nearest garage: ordinary worker pedestrians held in a
       crowd scene (crowd.js), one at the workbench, one by the paint cart. They
       scatter like anyone when there is shooting and come back after. */
    function staffGarages(deltaSeconds) {
      garageStaffTimer -= deltaSeconds;
      if (garageStaffTimer > 0) return;
      garageStaffTimer = 1.5;
      for (const s of GARAGES) {
        const near = Math.abs(player.x - s.x) < 900 && Math.abs(player.y - s.y) < 900;
        if (s.crew && (!crowd.scenes.includes(s.crew) || !near)) {
          if (crowd.scenes.includes(s.crew)) removeScene(s.crew);
          s.crew = null;
        }
        if (!near || s.crew) continue;
        const scene = makeScene('garage', s.service.x, s.service.y, { shop: s.id });
        const { bay } = s,
          spots = [
            // At the workbench on the west wall, facing it.
            { x: bay.x0 + 10.5, y: bay.y1 - 84, a: Math.PI, pose: 'serve' },
            // Kneeling by the lift's east post, facing the car.
            { x: bay.x1 - 12, y: bay.y1 - 48, a: Math.PI, pose: 'kneel' },
          ];
        for (const spot of spots) {
          const p = spawnSceneMember(scene, 'mechanic', spot, 'worker');
          if (p) {
            // Navy overalls, sleeves rolled, no umbrella or bag in the workshop.
            p.color = '#2d4466';
            Object.assign(p.look, { top: '#2d4466', pants: '#27364f', sleeves: false, umbrella: null, backpack: false, skirt: false });
            p.carry = null;
            p.mechanic = s.id;
          }
        }
        s.crew = scene;
      }
    }
    // Overhead cover for the police helicopter: every bay and office roof (air-cover.js).
    function registerGarageCover() {
      const P = GARAGE_PLAN;
      for (const s of GARAGES) {
        const x0 = s.bay.x0 - P.wall,
          x1 = s.bay.x1 + P.wall;
        registerOverheadCover((x0 + x1) / 2, (s.back + s.front) / 2, (x1 - x0) / 2, (s.front - s.back) / 2, 0, P.eaves, P.eaves + P.roof, 'garage');
        registerOverheadCover(s.office.x + s.office.w / 2, s.office.y + s.office.h / 2, s.office.w / 2, s.office.h / 2, 0, P.officeHeight, P.officeHeight + 3, 'garage office');
      }
    }
    function prepareGarages() {
      for (let i = buildings.length - 1; i >= 0; i--) {
        const b = buildings[i];
        if (
          GARAGES.some(
            (s) =>
              b.x < s.x + 110 && b.x + b.w > s.x - 110 && b.y < s.lotY1 && b.y + b.h > s.y - 100,
          )
        )
          buildings.splice(i, 1);
      }
      for (let i = trees.length - 1; i >= 0; i--)
        if (inGarageLot(trees[i].x, trees[i].y, 20)) trees.splice(i, 1);
      registerGarageCover();
    }
    /* The ground under a garage: the lot, the apron with its lead-in arrow and
       hatching, the bay's epoxy floor (drawn over by the 3D floor). */
    function paintGarages(drawingContext) {
      for (const s of GARAGES) {
        const { bay, door } = s;
        drawingContext.fillStyle = '#4f5a5c';
        drawingContext.fillRect(s.x - 108, s.y - 98, 216, s.lotY1 - (s.y - 98));
        // Concrete apron in front of the door.
        drawingContext.fillStyle = '#8d918b';
        drawingContext.fillRect(door.x0 - 14, s.front, door.x1 - door.x0 + 28, s.lotY1 - s.front);
        drawingContext.strokeStyle = '#e0c47e';
        drawingContext.lineWidth = 2;
        drawingContext.strokeRect(door.x0 - 10, s.front + 3, door.x1 - door.x0 + 20, s.lotY1 - s.front - 8);
        drawingContext.fillStyle = '#e0c47e';
        drawingContext.beginPath();
        drawingContext.moveTo(s.bayX, s.front + 10);
        drawingContext.lineTo(s.bayX - 9, s.front + 26);
        drawingContext.lineTo(s.bayX - 3, s.front + 26);
        drawingContext.lineTo(s.bayX - 3, s.front + 44);
        drawingContext.lineTo(s.bayX + 3, s.front + 44);
        drawingContext.lineTo(s.bayX + 3, s.front + 26);
        drawingContext.lineTo(s.bayX + 9, s.front + 26);
        drawingContext.fill();
        drawingContext.fillStyle = '#7c8784';
        drawingContext.fillRect(bay.x0, bay.y0, bay.x1 - bay.x0, bay.y1 - bay.y0);
        drawingContext.fillStyle = '#26343c';
        for (const b of garageWalls())
          if (b.shop === s.id) drawingContext.fillRect(b.x, b.y, b.w, b.h);
      }
    }
    // The 2D view also shows the shop's name on its facade.
    function paintGarageNames(drawingContext) {
      for (const s of GARAGES) {
        drawingContext.fillStyle = s.color;
        drawingContext.fillRect(s.bay.x0 - 4, s.front - 14, s.office.x + s.office.w - s.bay.x0 + 4, 14);
        drawingContext.fillStyle = '#13252c';
        drawingContext.textAlign = 'center';
        drawingContext.font = 'bold 10px Arial';
        drawingContext.fillText(s.name, (s.bay.x0 + s.office.x + s.office.w) / 2, s.front - 3);
      }
    }
    /* The city map: a spray-gun badge in the shop's colour and, zoomed in, its name. */
    function drawGarageMap(drawingContext, scale) {
      drawingContext.save();
      drawingContext.textAlign = 'center';
      for (const s of GARAGES) {
        const r = 10 / scale;
        drawingContext.fillStyle = '#122e38';
        drawingContext.beginPath();
        drawingContext.arc(s.x, s.y, r, 0, TAU);
        drawingContext.fill();
        drawingContext.strokeStyle = s.color;
        drawingContext.lineWidth = 2 / scale;
        drawingContext.stroke();
        drawingContext.fillStyle = s.color;
        drawingContext.font = 'bold ' + 11 / scale + 'px Arial';
        drawingContext.fillText('R', s.x, s.y + 4 / scale);
        if (scale > 0.09) {
          drawingContext.font = 'bold ' + 9 / scale + 'px Arial';
          drawingContext.fillStyle = '#e9f1ee';
          drawingContext.fillText(s.name, s.x, s.y + 22 / scale);
          drawingContext.fillStyle = s.color;
          drawingContext.font = 'bold ' + 7 / scale + 'px Arial';
          drawingContext.fillText('MECHANICS · RESPRAY', s.x, s.y + 31 / scale);
        }
      }
      drawingContext.restore();
    }
    /* Developer console (DeadEndCity.garage()): the shops, the offer for the
       player's vehicle, the job in progress and the last service or refusal. */
    function garageReport() {
      const c = player.car;
      return {
        garages: GARAGES.map((s) => ({
          id: s.id,
          name: s.name,
          tagline: s.tagline,
          door: { x0: s.door.x0, x1: s.door.x1, y: s.front, open: +s.open.toFixed(2) },
          bay: { ...s.bay, widthM: (s.bay.x1 - s.bay.x0) / UNITS_PER_METRE, depthM: (s.bay.y1 - s.bay.y0) / UNITS_PER_METRE },
          service: s.service,
          apron: { x: s.bayX, y: s.front + 60 },
          staffed: !!s.crew,
          mechanics: pedestrians.filter((p) => p.mechanic === s.id && p.hp > 0).length,
        })),
        plan: {
          doorWidthM: GARAGE_PLAN.doorWidth / UNITS_PER_METRE,
          doorHeightM: GARAGE_PLAN.doorHeight / UNITS_PER_METRE,
          eavesM: GARAGE_PLAN.eaves / UNITS_PER_METRE,
        },
        prices: { respray: GARAGE_RESPRAY_PRICES.map((p) => ({ class: p.label, price: p.price })), repair: '$100 + damage x $1,400 (to $1,500)', bundleDiscount: GARAGE_BUNDLE_DISCOUNT },
        cash,
        vehicle: c
          ? {
              type: c.type,
              color: c.color,
              inBay: garageForCar(c)?.id || null,
              approach: garageApproach(c)?.id || null,
              damage: +garageDamageShare(c).toFixed(3),
              offer: garageServiceable(c) ? garageOffer(c) : null,
              prompt: garagePrompt(c),
            }
          : null,
        job: repairJob
          ? { shop: repairJob.shop.id, phase: repairJob.phase, t: +repairJob.t.toFixed(2), seen: repairJob.seen, color: repairJob.car.color, applied: repairJob.applied }
          : null,
        last: garageLastService,
      };
    }
    // END SUBSYSTEM: src/garages.js
