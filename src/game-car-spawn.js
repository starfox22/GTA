    // makeCar(), canSpawnCar(), spawnClearCar(): creating vehicles with one shared object layout.
    function makeCar(type, x, y, headingRadians = 0, autonomous = false, color) {
      const vehicleDefinition = VEHICLE_DEFINITIONS[type],
        vehicle = {
          id: nextVehicleId++,
          type,
          x,
          y,
          a: headingRadians,
          speed: 0,
          hp: vehicleDefinition.hp,
          maxhp: vehicleDefinition.hp,
          color: color || vehicleDefinition.color,
          ai: autonomous,
          cop: type === 'police' && autonomous,
          turnWait: 2,
          stuck: 0,
          hitWait: 0,
          deadTime: 0,
          mission: false,
          sprite: null,
          altitude: 0,
          vz: 0,
          av: 0,
          damage: freshDamage(),
          dents: [],
          damageVersion: 0,
          // Fields the physics step writes on every vehicle, declared up front in
          // one order so every vehicle shares one object layout (V8 keeps property
          // access fast and doubles unboxed). Each starts at the value its readers
          // already treat as "not set yet": vx/vy are NaN until the first step
          // derives them from the heading and speed (physicsStep).
          vx: NaN,
          vy: NaN,
          stepStartX: x,
          stepStartY: y,
          stepStartA: headingRadians,
          moveA: headingRadians,
          restSteps: 0,
          farFromPlayer: false,
          resting: false,
          contactPass: 0,
          impactSpeed: 0,
          broadCellX: 0,
          broadCellY: 0,
          contactStatics: null,
          stepStatics: null,
          contactBox: null,
          aiControl: null,
          aiControlAt: 0,
          personSweepStart: null,
          bloodTrackPoint: null,
          pedestrianContacts: null,
          spareContacts: null,
          poseX: NaN,
          poseY: NaN,
          poseA: NaN,
          groundHeight: 0,
          slopePitch: 0,
          slopeRoll: 0,
          offroadState: null,
          // The ride on the terrain (terrain-suspension.js): the springs' record,
          // still working, the body's lift over the ground (drawn only), the tyres'
          // load and the ground's push (per unit mass), off the ground, the last knock.
          ride: null,
          rideActive: false,
          rideLift: 0,
          rideLoad: 0,
          rideAx: 0,
          rideAy: 0,
          rideAir: false,
          rideThumpAt: -1,
          rideThumpVz: 0,
          // Off-road (offroad.js): the reused terrain record, how far the driven
          // wheels spin ahead of the ground (0..1 and in u/s), the mud and rock
          // under them, low range, the last rock ledge, the mud on the body (and
          // how wet it is), the 4x4 club slot it was parked in.
          terrainRecord: null,
          wheelSpin: 0,
          spinSpeed: 0,
          surfaceMud: 0,
          surfaceRock: 0,
          lowRange: false,
          ledge: -1,
          mudCoat: 0,
          mudWet: 0,
          clubSlot: -1,
          loadSpeed: null,
          loadPitch: 0,
          loadRoll: 0,
          junction: null,
          hazard: false,
          spinUntil: 0,
          // The player's front tyres held against the grip limit (seconds) and the
          // scrub that follows (0..1), and whether the driver is steering into a
          // slide (physics.js UNDERSTEER SKID, TYRE STIFFNESS).
          skidHold: 0,
          skid: 0,
          counterSteer: false,
          handbrakeTurn: false,
          // The velocity going into the last contact (resolveContact): a thrown
          // rider keeps it (riders.js). A two-wheeler down on its side (riders.js).
          impactVx: 0,
          impactVy: 0,
          fallen: null,
          // A driver's car more than 15 degrees off its way (physics.js driverStats).
          sliding: false,
          // Road or pavement under the middle last step (kerbStrike), and the
          // vehicle that last hit a braced roadblock cruiser (roadblocks.js).
          onTarmac: null,
          rammedBy: null,
          // Fields other systems set only on some vehicles (falls, the drawbridge, a
          // tow, police, traffic lanes, a flight), declared as `undefined`, which is what
          // their readers already get when the field is absent. Reading an absent property
          // off objects of many layouts is the slowest property read there is (about 60 ns
          // against 8), and the physics step and the traffic streamer read these on every
          // vehicle, most of them parked, every step.
          cliffAir: undefined,
          cliffLift: undefined,
          deckAir: undefined,
          deckLeaf: undefined,
          deckLift: undefined,
          sinkFor: undefined,
          overturned: undefined,
          fallZ: undefined,
          isleBoat: undefined,
          isle: undefined,
          countyRoute: undefined,
          streamed: undefined,
          trafficIdle: undefined,
          taxiHire: undefined,
          crewDeployed: undefined,
          crewLost: undefined,
          blockade: undefined,
          lawUnit: undefined,
          stolen: undefined,
          abandonedFlight: undefined,
          airframe: undefined,
          roofSite: undefined,
          hop: undefined,
          scrape: undefined,
          easePerson: undefined,
          panicUntil: undefined,
          ramUntil: undefined,
          navAngle: undefined,
          curbStop: undefined,
          crashStop: undefined,
          rotorSpeed: undefined,
          // Wreck limit (livingcity-wrecks.js): when the player last drove it, when it became a candidate and was last near or seen.
          drivenAt: undefined,
          retireBorn: undefined,
          retireSeen: undefined,
          // Everything else any system sets on some vehicles, also declared as `undefined` (what an absent field reads
          // as), so every vehicle keeps this one layout: with 25-41 layouts in a street (DeadEndCity.shapeReport()), every
          // read in the loops over all vehicles was megamorphic, and a megamorphic read of a number field allocates a
          // fresh boxed copy (~80 KB of garbage a physics step in the broadphase alone, 24 KB a trafficControl call).
          // The brake lamps and the surf a boat rides (set by the physics on most vehicles, not all).
          braking: undefined,
          surfing: undefined,
          // The driver and passengers (assignDriver), the lock, and the handling cache (damage.js vehicleHandling).
          locked: undefined,
          occupied: undefined,
          driverMood: undefined,
          driverColor: undefined,
          driverFemale: undefined,
          driverRole: undefined,
          passengers: undefined,
          handling: undefined,
          handlingVersion: undefined,
          handlingHp: undefined,
          // Traffic, roles and places: a blocked lane, a sinking boat, the army, gate passes, gangs, sirens, the county, the dealership.
          blockedFor: undefined,
          sinkDepth: undefined,
          military: undefined,
          turretA: undefined,
          authorized: undefined,
          gangTarget: undefined,
          sirenYield: undefined,
          countyIndex: undefined,
          dealerDisplay: undefined,
          lastWater: undefined,
          gunner: undefined,
          seesPlayer: undefined,
          crewed: undefined,
          targetAcquired: undefined,
          // Aircraft (aviation.js): the flight model's state.
          flightReady: undefined,
          flaps: undefined,
          flapPos: undefined,
          gearDown: undefined,
          gearPos: undefined,
          power: undefined,
          pitchRate: undefined,
          bankRate: undefined,
          gLoad: undefined,
          buffet: undefined,
          ctrlYaw: undefined,
          ctrlRoll: undefined,
          ctrlPitch: undefined,
          bank: undefined,
          pitch: undefined,
          throttle: undefined,
          stalled: undefined,
          stallWarning: undefined,
          angleOfAttack: undefined,
          stallSpeed: undefined,
          airspeed: undefined,
          gearWarning: undefined,
          // Police, army and air units (pursuit.js, police-air.js, military): dispatch, routes, plans, searches.
          pursuitUnit: undefined,
          dispatched: undefined,
          crewSize: undefined,
          armyUnit: undefined,
          interceptor: undefined,
          spawnedAt: undefined,
          role: undefined,
          routeTime: undefined,
          route: undefined,
          pursuitPlanAt: undefined,
          pursuitPlan: undefined,
          pinnedFor: undefined,
          stuckOffscreen: undefined,
          shortcut: undefined,
          braced: undefined,
          parkX: undefined,
          parkY: undefined,
          crew: undefined,
          searchFrom: undefined,
          searchPoint: undefined,
          searchUntil: undefined,
          routeFor: undefined,
          qrf: undefined,
          qrfHome: undefined,
          patrol: undefined,
          gangLastSeen: undefined,
          gangSeenAt: undefined,
          noCoax: undefined,
          gunPitch: undefined,
          arms: undefined,
          beachPatrol: undefined,
          airUnit: undefined,
          generalAirUnit: undefined,
          missionPursuit: undefined,
          airTarget: undefined,
          airLastSeen: undefined,
          pursuitTarget: undefined,
          airState: undefined,
          airOnScene: undefined,
          airArrival: undefined,
          airLostFor: undefined,
          airRetreat: undefined,
          airDown: undefined,
          // Damage, blood, tyres, horns and scenes.
          scrapeFxAt: undefined,
          scrapeMarkAt: undefined,
          bloodTrackRemaining: undefined,
          bloodTrackSpacing: undefined,
          bloodTrackSides: undefined,
          blueHourLimo: undefined,
          stains: undefined,
          lastDamagedAt: undefined,
          lastAttacker: undefined,
          fuelBowser: undefined,
          tyres: undefined,
          burnout: undefined,
          absActive: undefined,
          tyreSlip: undefined,
          lastSkid: undefined,
          hornUntil: undefined,
          nextHonk: undefined,
          honkAt: undefined,
          driverOut: undefined,
          doorsOpenAt: undefined,
          deliveryScene: undefined,
          // The static-body cache (physics-shapes.js nearbyStatics), where the driver looks, and a driver's shout.
          staticCacheKey: undefined,
          staticCache: undefined,
          staticCacheVersion: undefined,
          lookAt: undefined,
          speech: undefined,
          speechUntil: undefined,
        };
      vehicles.push(vehicle);
      if (autonomous) assignDriver(vehicle);
      return vehicle;
    }
    function canSpawnCar(type, x, y, a = 0, margin = 7, airframe) {
      if (inStadiumLot(x, y, 12)) return false;
      const vehicle = {
          type,
          x,
          y,
          a,
          airframe,
        },
        shape = vehicleShape(vehicle, margin);
      if (
        [...nearbyStatics(vehicle)].some(
          (b) =>
            (b.minHeight === undefined ||
              terrainHeight(x, y) + vehicleCollisionHeight(vehicle) >= b.minHeight) &&
            boxContact(shape, b),
        )
      )
        return false;
      if (
        corners(shape).some((p) => railBlocked(p.x, p.y, 3) || garageBlocked(p.x, p.y)) ||
        inGarageLot(x, y, 10) ||
        corners(shape).some((p) => !groundAt(p.x, p.y)) ||
        buildings.some((b) =>
          boxContact(shape, {
            x: b.x + b.w / 2,
            y: b.y + b.h / 2,
            hx: b.w / 2,
            hy: b.h / 2,
            a: 0,
          }),
        ) ||
        AIRPORT_SCENERY_SOLIDS.some((b) =>
          boxContact(shape, {
            x: b.x + b.w / 2,
            y: b.y + b.h / 2,
            hx: b.w / 2,
            hy: b.h / 2,
            a: 0,
          }),
        ) ||
        harborVehicleBlocked(vehicle) ||
        militaryVehicleBlocked(vehicle) ||
        corners(shape).some((p) => countyBlocked(p.x, p.y))
      )
        return false;
      return !vehicles.some(
        (o) => (o.altitude || 0) < 20 && boxContact(shape, vehicleShape(o, margin)),
      );
    }
    function spawnClearCar(type, x, y, a = 0, ai = false, color) {
      for (let r = 0; r < 330; r += 24)
        for (let i = 0; i < (r ? 24 : 1); i++) {
          const px = x + Math.cos((i * TAU) / 24) * r,
            py = y + Math.sin((i * TAU) / 24) * r;
          if (canSpawnCar(type, px, py, a)) return makeCar(type, px, py, a, ai, color);
        }
      throw Error('No clear vehicle spawn for ' + type);
    }
