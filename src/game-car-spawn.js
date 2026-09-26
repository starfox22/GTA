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
