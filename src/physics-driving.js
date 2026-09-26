    const noStatics = [];
    // Broadphase containers reused from step to step (see physicsStep).
    const broadphaseCells = Array.from({ length: 4096 }, () => Object.assign([], { stamp: 0 })),
      broadphasePairA = [],
      broadphasePairB = [],
      broadphaseBarrierCars = [],
      broadphaseBarrierBodies = [];
    let broadphaseStamp = 0;
    // One vehicle's controls and integration for a physics step (player input,
    // pursuit, traffic, boats and aircraft).
    // Reverse gear tops out at about 25 km/h; steering reaches full lock by 30 km/h.
    // Set only while the console's turnTest runs on the open strip by the runway,
    // so the measurement is of the tyres on tarmac, not of the grass's drag.
    let handlingTestPaved = false;
    // STEER_LOCK: a game's allowance over the real lock (13% tighter: a sedan turns
    // in 9.5 m kerb to kerb instead of 10.5); the tank pivots on its tracks.
    // TYRE_PEAK_SLIP: the slip angle (radians) at which a tyre's sideways force
    // peaks. PLAYER_YAW_RESPONSE: how fast the player's car takes up the yaw the
    // wheel asks for (1/s).
    const REVERSE_TOP = 25 * KMH,
      STEER_FULL_SPEED = 30 * KMH,
      STEER_LOCK = 1.13,
      TYRE_PEAK_SLIP = 0.12,
      PLAYER_YAW_RESPONSE = 8.5;
    /* The yaw rate (radians a second) the tyres' sideways grip allows at `along`:
       lateral acceleration is speed times yaw rate, capped at cornerG. */
    function corneringLimit(spec, along) {
      return ((spec.cornerG || 1.2) * GRAVITY) / Math.max(Math.abs(along), 20 * KMH);
    }
    /* Coulomb friction for a vehicle nobody is driving: `mu` along the wheels
       (locked brakes 0.8, a parked car in gear 0.35), 0.85 of the road across
       them (tyres scrubbing sideways), scaled by the wet. Unlike an exponential
       drag this is a constant deceleration, so a cruiser shoved at 40 km/h slides
       a few metres, and one merely leant on does not creep. The spin is braked by
       the same friction acting about the middle of the footprint. */
    function parkedFriction(c, spec, mu, stepSeconds) {
      const surface = wetGrip(),
        headingCosine = Math.cos(c.a),
        headingSine = Math.sin(c.a);
      let along = c.vx * headingCosine + c.vy * headingSine,
        lateral = -c.vx * headingSine + c.vy * headingCosine;
      const alongStep = mu * surface * GRAVITY * stepSeconds,
        lateralStep = 0.85 * surface * GRAVITY * stepSeconds;
      along -= Math.sign(along) * Math.min(Math.abs(along), alongStep);
      lateral -= Math.sign(lateral) * Math.min(Math.abs(lateral), lateralStep);
      c.vx = along * headingCosine - lateral * headingSine;
      c.vy = along * headingSine + lateral * headingCosine;
      // Friction spread over the footprint brakes the yaw: about mu g over the
      // radius of gyration.
      const spinStep = ((Math.max(mu, 0.6) * surface * GRAVITY) / (Math.hypot(spec.l, spec.w) * 0.29)) * stepSeconds;
      c.av -= Math.sign(c.av) * Math.min(Math.abs(c.av), spinStep);
      // A shoved car leaves rubber on the road.
      const sliding = Math.hypot(c.vx, c.vy);
      if (sliding > 45 && Math.floor(physicsClock * 20) !== c.lastSkid && Math.abs(c.x - player.x) < 900 && Math.abs(c.y - player.y) < 900) {
        c.lastSkid = Math.floor(physicsClock * 20);
        skids.push({ x: c.x, y: c.y, a: Math.atan2(c.vy, c.vx), len: sliding / 40 + 2, life: 35 });
      }
    }
    /* Kerb strike (the player's car): mounting or dropping off a kerb at speed
       jolts the body, scrubs a little speed and, hard enough, knocks the wheel
       out of line. */
    function kerbStrike(c, along) {
      const spec = vehicleSpec(c);
      if (spec.bicycle || spec.tank || isAircraft(c) || isBoat(c)) return;
      const onTarmac = onRoad(c.x, c.y);
      if (c.onTarmac === onTarmac) return;
      const was = c.onTarmac;
      c.onTarmac = onTarmac;
      const speed = Math.abs(along);
      if (was === null || was === undefined || speed < 25 * KMH) return;
      const scrub = clamp(speed / (400 * KMH), 0.01, 0.05) * (spec.offroad ? 0.5 : 1);
      c.vx *= 1 - scrub;
      c.vy *= 1 - scrub;
      if (!c.hop) c.hop = { z: 0, vz: clamp(speed * 0.18, 14, 45), pitch: 0, vp: (onTarmac ? -1 : 1) * 1.2, roll: 0, vr: (Math.random() - 0.5) * 1.6 };
      if (speed > 110 * KMH && !spec.offroad && Math.random() < 0.35) {
        const damage = ensureDamage(c);
        damage.pull = clamp(damage.pull + (Math.random() < 0.5 ? -1 : 1) * 0.04, -0.6, 0.6);
        c.damageVersion = (c.damageVersion || 0) + 1;
      }
      if (c === player.car) shake = Math.max(shake, clamp(speed / 120, 0.6, 2.2));
    }
    /* Tyre and surface (the player's vehicle): knobbly dirt tyres (`dirt`, the
       KR 500) squirm on tarmac once the speed is up, down to 0.8 of their grip
       by 120 km/h for braking, drive and cornering alike; on dirt, grass and the
       trails they have it all (roadVehicleTerrain gives them full traction).
       Every other tyre is 1 here. */
    function tyreSurfaceGrip(c, spec, along) {
      if (!spec.dirt) return 1;
      if (!onRoad(c.x, c.y) && !onCountyRoad(c.x, c.y)) return 1;
      return 1 - 0.2 * clamp((Math.abs(along) - 50 * KMH) / (70 * KMH), 0, 1);
    }
    function controlVehicle(c, pc, stepSeconds, active) {
      const vehicleDefinition = vehicleSpec(c);
      c.stepStartX = c.x;
      c.stepStartY = c.y;
      c.stepStartA = c.a;
      // A parked car a long way off with nothing driving it has nothing to
      // integrate: skipping its control and integration is what keeps a city
      // with hundreds of kerbside vehicles and bicycles affordable.
      // Parked roadblock and deployed cruisers and burnt-out wrecks sleep the same way.
      if (
        c.resting &&
        c !== pc &&
        !c.ai &&
        !c.isleBoat &&
        !c.taxiHire &&
        (!c.cop || c.crewDeployed || c.hp <= 0) &&
        (c.hp > 0 || !c.damage?.burning)
      )
        return;
      // Not moved by the physics yet (makeCar starts vx/vy as NaN): take the
      // velocity from the heading and whatever speed the vehicle was given.
      if (c.vx !== c.vx) {
        c.vx = Math.cos(c.a) * c.speed;
        c.vy = Math.sin(c.a) * c.speed;
      }
      c.av = c.av || 0;
      if (repairJob?.car === c) {
        c.vx = c.vy = c.av = c.speed = 0;
      } else if (c.type === 'plane') {
        planeControl(c, stepSeconds, active);
      } else if (isBoat(c)) {
        boatControl(c, stepSeconds, active);
      } else if (c.type === 'helicopter') {
        helicopterControl(c, stepSeconds, active);
      } else if (c.deckAir) {
        // Off the tip of a drawbridge leaf: ballistic until drawbridgeSettle lands it.
        drawbridgeFlight(c, stepSeconds);
      } else {
        if (
          c.cop &&
          !c.crewDeployed &&
          !c.blockade &&
          active &&
          (!player.car || isAircraft(player.car)) &&
          wantedStars > 0
        ) {
          const d = distanceBetween(c, player),
            toward = (player.x - c.x) * c.vx + (player.y - c.y) * c.vy;
          if (d < 140 && toward > 0) {
            const speed = Math.hypot(c.vx, c.vy),
              limit = clamp((d - 48) * 1.2, 0, 80);
            if (speed > limit) {
              const f = limit / Math.max(1, speed);
              c.vx *= f;
              c.vy *= f;
              c.speed = limit;
            }
          }
        }
        const headingCosine = Math.cos(c.a),
          headingSine = Math.sin(c.a),
          along = c.vx * headingCosine + c.vy * headingSine,
          lateral = -c.vx * headingSine + c.vy * headingCosine;
        let acceleration = 0,
          steer = 0,
          grip = 7,
          drag = 0.72,
          // The share of the tyres' sideways hold available (rain, power, braking).
          lateralScale = 1,
          // Nobody driving: the vehicle slides on locked or parked wheels (parkedFriction).
          unattended = 0,
          // Brake lights (render3d.js): the player's brake pedal, or a driver
          // slowing hard or holding the car at a stop.
          braking = false;
        c.counterSteer = false;
        c.handbrakeTurn = false;
        if (c.hp > 0 && c === pc && active) {
          const up = keys.KeyW || keys.ArrowUp,
            down = keys.KeyS || keys.ArrowDown,
            brake = keys.Space,
            turnKey = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
          // A bicycle has no engine: holding W pedals, and the push the rider's
          // legs give tapers off toward the top speed (pedalDrive, cycles.js).
          const pedalled = !!vehicleDefinition.bicycle,
            sprint = pedalled && cycleSprinting(),
            topSpeed = vehicleDefinition.max * (sprint ? CYCLE_SPRINT_TOP : 1),
            // A hurt engine pulls weaker, flat tyres and a bent front end cap the
            // speed and drag the car to one side (damage.js vehicleHandling).
            handling = vehicleHandling(c);
          // Wet tarmac: every tyre force (drive, brakes, cornering) shrinks together.
          const surface = pedalled ? 1 : wetGrip() * tyreSurfaceGrip(c, vehicleDefinition, along),
            wet = pedalled ? 0 : weather.wet || 0;
          /* TYRES, BRAKES AND ASSISTS (driving.js): every motor vehicle but the
             tank goes through the tyre model: the steering ramp, the brake pedal
             and each axle's slip (ABS), traction control and stability control. */
          const modelled = !pedalled && !vehicleDefinition.tank,
            tyres = tyreState(c),
            character = modelled ? drivingCharacter(c) : null,
            assists = modelled ? drivingAssists(c) : null,
            turn = modelled ? steeringRamp(tyres, turnKey, along, !!brake, stepSeconds) : turnKey,
            // Last step's yaw: the share of the grip the corner is using.
            cornerG = (vehicleDefinition.cornerG || 1.2) * GRAVITY * surface * handling.grip,
            lateralUse = pedalled ? 0 : clamp(Math.abs(along * c.av) / cornerG, 0, 1);
          if (brake) tyres.handbrakeAt = physicsClock;
          // The brake pedal ramps in (a tap is gentle, a hold is full), and each
          // axle gives what its slip allows (ABS keeps it near the peak).
          const pedal = modelled ? brakePedal(tyres, !!down && !up && along > 10, stepSeconds) : down && along > 10 ? 1 : 0;
          let brakeDecel = 0;
          if (modelled && pedal > 0 && along > 10) {
            const mu = ((vehicleDefinition.brakeG || 1) / ABS_EFFICIENCY) * surface * handling.brake;
            brakeDecel = brakeStep(c, tyres, character, assists.abs, pedal, mu, wet, lateralUse, along, stepSeconds);
          } else if (modelled) brakesOff(tyres);
          braking = pedal > 0.05 && along > 10;
          // The engine's pull at this speed (game.js ROAD PERFORMANCE); a bicycle's
          // push comes from the rider's legs instead.
          const engineAsk = up && !pedalled ? (engineAcceleration(vehicleDefinition, along) * handling.power) / (1 + (c.cargoCount || 0) * 0.1) : 0,
            tractionLimit = vehicleDefinition.acc * surface;
          acceleration =
            up && !pedalled
              ? Math.min(engineAsk, tractionLimit)
              : modelled && brakeDecel > 0
                ? -brakeDecel
                : down
                  ? along > 10
                    ? -(vehicleDefinition.brake || GRAVITY) * surface * handling.brake
                    : -vehicleDefinition.acc * 0.5 * surface
                  : pedalled
                    ? pedalDrive(along, topSpeed)
                    : 0;
          if (
            (along > vehicleDefinition.max * (0.65 + (0.35 * c.hp) / c.maxhp) * handling.top &&
              up &&
              !pedalled) ||
            (along < -(pedalled ? CYCLE_REVERSE_MAX : REVERSE_TOP) && down)
          )
            acceleration = 0;
          // Rolling with nothing pressed (or pedalling): air, tyres and engine braking.
          if (!up && !down) acceleration -= Math.sign(along) * Math.min(Math.abs(along) / stepSeconds, coastDeceleration(vehicleDefinition, along));
          // The handbrake locks the rear wheels: a sliding stop at about half a g.
          if (brake) acceleration -= Math.sign(along) * Math.min(Math.abs(along) / stepSeconds, 0.45 * GRAVITY * surface);
          // Off the tarmac (verges, lawns, dirt): more rolling resistance.
          if ((up || down) && !pedalled && !handlingTestPaved && !onRoad(c.x, c.y))
            acceleration -= Math.sign(along) * Math.min(Math.abs(along) / stepSeconds, (vehicleDefinition.dirt ? 0.02 : vehicleDefinition.offroad ? 0.05 : 0.14) * GRAVITY);
          grip = brake ? 1.9 : (vehicleDefinition.grip || 7) * handling.grip;
          // Resistance is in engineAcceleration / coastDeceleration; drag here only
          // scrubs a handbrake slide (and a bicycle's brake).
          drag = pedalled ? (brake ? 0.6 : 0.03) : brake ? 0.25 : 0;
          /* FRICTION CIRCLE AND BALANCE
             A tyre has one budget of grip for driving, braking and cornering
             together. Cornering at the limit leaves nothing to accelerate or brake
             with, and braking flat out leaves little to turn with (the car ploughs
             on: understeer). Last step's yaw says how much of the budget the
             corner is using. Weight moves too: braking loads the nose (it turns
             in harder) and lightens the tail; power loads the tail. `balance`
             (VEHICLE_DEFINITIONS) is the class's character: trucks, vans and SUVs
             push wide at the limit (negative), muscle cars and roadsters step the
             tail out under power (positive). The brakes' share of it is worked
             out per axle in brakeStep (driving.js). */
          const balance = vehicleDefinition.balance || 0,
            longLimit = acceleration > 0 ? vehicleDefinition.acc : vehicleDefinition.brake || GRAVITY;
          if (!pedalled && acceleration && !(brakeDecel > 0)) acceleration *= Math.sqrt(Math.max(0.2, 1 - lateralUse * lateralUse));
          /* TRACTION CONTROL
             The engine's pull in the low gears (power over the speed, from 35 km/h
             down held at its torque) against what the driven tyres can put down
             with the corner's share taken. With TCS the throttle is trimmed to the
             tyres' peak (the lamp flickers); without it the wheels spin: they give
             their sliding grip, rev the engine, lay rubber and, driven at the
             back, let the tail step out (yawStability). */
          let spinAsk = 0;
          if (modelled && up && acceleration > 0 && along > -2 * KMH && !c.offroadState) {
            const pull = ((vehicleDefinition.power || 0) / Math.max(Math.max(along, 0), 35 * KMH)) * handling.power,
              put = tractionLimit * Math.sqrt(Math.max(0.2, 1 - lateralUse * lateralUse)),
              excess = pull / Math.max(1, put) - 1;
            if (excess > 0.04) {
              if (assists.tcs) tyres.tcsAt = physicsClock;
              else spinAsk = clamp(excess / 0.4, 0, 1);
            }
          }
          if (modelled) {
            tyres.spin += (spinAsk - tyres.spin) * Math.min(1, stepSeconds * (spinAsk > tyres.spin ? 14 : 5));
            if (tyres.spin > 0.01) {
              acceleration *= 1 - (1 - (SLIDE_DRY + (SLIDE_WET - SLIDE_DRY) * wet)) * tyres.spin;
              // The engine revs and the wheels turn ahead of the road (engine-audio.js, offroad.js).
              c.wheelSpin = Math.max(c.wheelSpin || 0, tyres.spin * 0.9);
            }
          }
          const longUse = pedalled ? 0 : clamp(Math.abs(acceleration) / Math.max(1, longLimit), 0, 1),
            slowing = acceleration < 0 && along > 10,
            // How hard the driver is asking the driven wheels to push (a strong
            // engine at low speed asks for more than the tyres can give).
            throttle =
              up && !pedalled && acceleration > 0
                ? clamp((engineAcceleration(vehicleDefinition, along) * handling.power) / Math.max(1, vehicleDefinition.acc), 0, 1)
                : 0;
          let cornerShare = Math.sqrt(Math.max(0.3, 1 - longUse * longUse));
          // Under the brakes the front tyres keep what brakeStep left them: about
          // half with ABS, next to nothing locked (the car goes straight on).
          if (brakeDecel > 0) cornerShare = Math.max(0.02, tyres.lateral[0]);
          if (slowing) cornerShare *= 1 + 0.12 * longUse;
          if (balance < 0) cornerShare *= 1 + balance * 0.15 * lateralUse;
          if (balance > 0) cornerShare *= 1 + balance * 0.25 * lateralUse * throttle;
          // Spinning front wheels push wide.
          if (character?.drive === 'fwd') cornerShare *= 1 - 0.45 * tyres.spin;
          // Sideways hold: the tail lets go under power in a tail-happy car, and
          // lightens under braking in anything that is not a push-wide truck.
          lateralScale =
            surface *
            (1 - (balance > 0 ? balance * 0.4 * lateralUse * throttle : 0)) *
            (1 - (slowing ? Math.max(0, balance + 0.5) * 0.12 * longUse * lateralUse : 0));
          // Locked tyres slide on whichever way the car is going.
          if (brakeDecel > 0) lateralScale *= 0.3 + 0.7 * clamp(Math.min(tyres.lateral[0], tyres.lateral[1]) / 0.5, 0, 1);
          // Full lock at walking pace; above that the tyres' sideways grip is the
          // limit (cornerG): the yaw rate a speed allows is grip / speed, so a car
          // takes a city corner at 30-40 km/h and sweeps a wide bend at 150. The
          // handbrake swings the tail past that limit.
          steer =
            turn *
            vehicleDefinition.turn *
            (vehicleDefinition.tank ? 1 : STEER_LOCK) *
            handling.steer *
            // On the handbrake the locked rear slides out, so the car pivots about
            // its front wheels and reaches full swing by 15 km/h, not 30.
            clamp(Math.abs(along) / (brake && !pedalled ? STEER_FULL_SPEED / 2 : STEER_FULL_SPEED), vehicleDefinition.tank ? 0.72 : 0, 1) *
            Math.sign(along || 1) *
            (brake ? 1.35 : 1);
          c.handbrakeTurn = !!brake && !pedalled && Math.abs(along) > 8 * KMH;
          const cornerLimit =
            corneringLimit(vehicleDefinition, along) * handling.grip * surface * (pedalled ? 1 : cornerShare) * (brake ? 1.6 : 1);
          /* UNDERSTEER SKID
             The key asks for full lock; the tyres give what grip allows (the clamp
             below), which is a clean line for a tap, a lane change or a sweeping bend.
             Held against the limit for a while (going in too fast for how tight the
             driver wants to turn), the front tyres start to scrub: they howl, leave
             marks and bleed off up to an eighth of a g, so the line tightens as the car
             slows, the way a real car washes wide and then bites. */
          const overLimit = !pedalled && !brake && Math.abs(steer) > cornerLimit * 1.05 && Math.abs(along) > 28 * KMH;
          c.skidHold = overLimit ? Math.min(1.4, c.skidHold + stepSeconds) : Math.max(0, c.skidHold - stepSeconds * 3);
          c.skid = clamp((c.skidHold - 0.5) / 0.8, 0, 1);
          if (c.skid > 0 && !down)
            acceleration -= Math.sign(along) * Math.min(Math.abs(along) / stepSeconds, c.skid * 0.12 * GRAVITY * surface);
          steer = clamp(steer, -cornerLimit, cornerLimit);
          kerbStrike(c, along);
          // Steering toward where the car is sliding (lateral and the key agree).
          c.counterSteer = !!turnKey && Math.sign(turnKey) === Math.sign(lateral) && Math.abs(lateral) > Math.max(10, Math.abs(along) * 0.12);
          /* STABILITY (driving.js yawStability): the yaw the tyres add beyond what
             the wheel asks (lift-off and power oversteer, locked rears), and ESC
             trimming it with a wheel's brake and a throttle cut. */
          if (modelled) {
            const stability = yawStability(c, tyres, character, assists, {
              along,
              lateral,
              steer,
              turnKey,
              up: !!up,
              handbrake: !!brake,
              lateralUse,
              slowing,
              longUse,
              balance,
              surface,
              lockRear: brakeDecel > 0 ? tyres.lock[1] : 0,
              lockFront: brakeDecel > 0 ? tyres.lock[0] : 0,
              skid: c.skid,
              stepSeconds,
            });
            if (acceleration > 0) acceleration *= 1 - stability.cut;
            if (stability.brake > 0 && along > 5 * KMH) acceleration -= Math.min(along / stepSeconds, stability.brake);
            lateralScale *= stability.hold;
            steer += tyres.yawSlide;
            if (assists.esc && stability.cut + stability.brake > 0) braking = braking || stability.brake > 0.1 * GRAVITY;
            // A pulse in the brake lamps while ABS works (render3d.js reads c.braking).
            c.absActive = brakeDecel > 0 && physicsClock - tyres.absAt < 0.1;
            if (c.absActive) braking = (physicsClock * 7) % 1 < 0.62;
            // How loud the tyres are (audio.js): a slide, a lock, wheelspin, a scrub.
            const speed = Math.hypot(c.vx, c.vy),
              slideAngle = Math.abs(lateral) / Math.max(Math.abs(along), 20);
            c.tyreSlip =
              speed < 15 * KMH
                ? 0
                : Math.max(
                    clamp((slideAngle - 0.1) / 0.3, 0, 1),
                    brakeDecel > 0 ? Math.max(tyres.lock[0], tyres.lock[1]) : 0,
                    tyres.spin * 0.9,
                    c.skid * 0.75,
                    brake && Math.abs(along) > 70 ? 0.8 : 0,
                    c.absActive ? 0.3 : 0,
                  );
          } else c.tyreSlip = brake && Math.abs(along) > 70 && !pedalled ? 0.8 : 0;
          steer += handling.pull * clamp(Math.abs(along) / 160, 0, 1) * Math.sign(along || 1) * 0.45;
          // Rubber on the road: the rear tyres under the handbrake, the front ones
          // scrubbing wide, any tyre in a slide past about ten degrees, locked
          // wheels and spinning driven ones.
          const sliding = Math.abs(lateral) > Math.max(12, Math.abs(along) * 0.17),
            lockedFront = brakeDecel > 0 && tyres.lock[0] > 0.5 && along > 30,
            lockedRear = brakeDecel > 0 && tyres.lock[1] > 0.5 && along > 30,
            spinning = modelled && tyres.spin > 0.35 && Math.abs(along) > 5;
          if (
            ((brake && Math.abs(along) > 80) || (c.skid > 0.3 && !pedalled) || (sliding && !pedalled && Math.abs(along) > 60) || lockedFront || lockedRear || spinning) &&
            Math.floor(physicsClock * 40) !== c.lastSkid
          ) {
            c.lastSkid = Math.floor(physicsClock * 40);
            // Axles and track from the vehicle's size; a motorbike lays one line.
            const rearMarks = brake || sliding || lockedRear || (spinning && character.drive !== 'fwd'),
              frontMarks = (c.skid > 0.3 && !brake && !sliding) || lockedFront || (spinning && character.drive !== 'rwd'),
              track = vehicleDefinition.bike ? 0 : vehicleDefinition.w * 0.4;
            for (const axle of [frontMarks ? 0.3 * vehicleDefinition.l : null, rearMarks || !frontMarks ? -0.3 * vehicleDefinition.l : null])
              if (axle !== null)
                for (const side of vehicleDefinition.bike ? [0] : [-1, 1])
                  skids.push({
                    x: c.x + headingCosine * axle - headingSine * side * track,
                    y: c.y + headingSine * axle + headingCosine * side * track,
                    a: Math.atan2(c.vy, c.vx),
                    len: Math.abs(along) / 40 + 2,
                    life: 35,
                  });
          }
          // A locked front wheel on a motorbike: the bike tucks and goes down (a lowside).
          if (character?.bike && brakeDecel > 0 && tyres.lock[0] > 0.8 && along > 25 * KMH) {
            tyres.frontLockTime += stepSeconds;
            if (tyres.frontLockTime > (Math.abs(c.av) > 0.3 ? 0.25 : 0.5)) {
              tyres.frontLockTime = 0;
              throwRider(c, c.vx * 0.9, c.vy * 0.9, 'lowside');
            }
          } else tyres.frontLockTime = 0;
        } else if (
          c.hp > 0 &&
          !c.pursuitTarget &&
          c.gangTarget?.hp > 0 &&
          lawVehicle(c) &&
          !c.crewLost &&
          !c.crewDeployed &&
          active
        ) {
          const target = c.gangTarget,
            d = distanceBetween(c, target),
            da = normalizeAngle(headingBetween(c, target) - c.a),
            surface = wetGrip();
          const desired = clamp((d - 150) * 1.5, 0, 80 * KMH) * Math.sqrt(surface),
            corner = corneringLimit(vehicleDefinition, along) * surface;
          steer = clamp(da * 2.5, -Math.min(1.8, corner), Math.min(1.8, corner));
          acceleration = clamp(
            (desired - along) * 4,
            -vehicleDefinition.brake * 1.1 * surface,
            Math.min(engineAcceleration(vehicleDefinition, along), vehicleDefinition.acc * surface),
          );
          lateralScale = surface;
          drag = 0.05;
        } else if (
          c.hp > 0 &&
          c.cop &&
          !c.crewDeployed &&
          active &&
          wantedStars > 0 &&
          !harborPoliceProtected(player.x, player.y, 30)
        ) {
          // Intercepts, PIT and boxing, search sweeps and stuck recovery (pursuit.js).
          /* RAIN (every driver's tyres, weather.js wetGrip): a pursuit driver takes
             corners a tenth past the dry limit and eases off only a little in the
             wet, so on a soaked road a cruiser thrown into a corner asks more of
             its tyres than they have and can slide wide or spin; its brakes and
             traction shrink like everyone's, so it runs long into junctions. */
          const surface = wetGrip(),
            control = pursuitControl(c, stepSeconds, along, vehicleDefinition),
            corner = corneringLimit(vehicleDefinition, along) * 1.1 * (0.7 + 0.3 * surface);
          steer = clamp(control.steer, -corner, corner);
          acceleration = clamp(
            control.acceleration,
            -vehicleDefinition.brake * 1.2 * surface,
            vehicleDefinition.acc * surface,
          );
          // Pursuit brakes are ABS brakes (spec.brake is an ABS stop). A cruiser
          // lining up a PIT drives with its stability control off: shoved into
          // the runner's quarter panel it can slide as well (driving.js ESC).
          lateralScale = surface * (c.pursuitPlan?.mode === 'pit' ? 0.8 : 1);
          drag = control.drag;
        } else if (c.hp > 0 && c.ai && !c.crewDeployed) {
          // Traffic decisions are cached: 20 Hz near the player, 4 Hz for distant cars.
          const ai =
            c.aiControl && physicsClock < (c.aiControlAt || 0)
              ? c.aiControl
              : ((c.aiControl = c.isle
                  ? isleTrafficControl(c)
                  : c.countyRoute
                    ? countyRouteControl(c)
                    : trafficControl(c, stepSeconds)),
                (c.aiControlAt = physicsClock + (c.farFromPlayer ? 0.25 : 0.05)),
                c.aiControl);
          /* Traffic in the rain keeps inside what its tyres now give (cornering,
             brakes and traction all shrink with wetGrip) and drives slower by the
             square root of the grip: 15% off every speed on a soaked road, which is
             also a stop and a following distance allowed for braking at 72% (the
             stopping formulas in trafficControl turn a speed into a distance through
             its square). One driver in eleven keeps their dry-road habits and is
             the one who, now and then, runs into the car ahead. */
          const handling = vehicleHandling(c),
            surface = wetGrip(),
            rainPace = c.id % 11 === 0 ? 1 : Math.sqrt(surface),
            corner = corneringLimit(vehicleDefinition, along) * surface;
          steer = clamp(ai.steer, -corner, corner);
          acceleration = clamp(
            (ai.desired * rainPace * handling.top - along) * 5,
            -vehicleDefinition.brake * surface,
            Math.min(engineAcceleration(vehicleDefinition, along) * handling.power, vehicleDefinition.acc * surface),
          );
          lateralScale = surface;
          drag = 0;
        } else {
          // Nobody driving: a roadblock or deployed cruiser sits on locked brakes,
          // a parked car in gear with the handbrake on, a wreck on burst tyres.
          // Shoved, it slides against that friction (parkedFriction) instead of
          // being an immovable post or gliding on.
          // A bike down on its side slides on its bodywork (riders.js).
          unattended = c.fallen ? 0.55 : c.blockade ? 0.8 : c.crewDeployed ? 0.75 : c.hp <= 0 ? 0.6 : 0.35;
          if (c.fallen) updateFallenBike(c, stepSeconds);
          drag = 0;
          grip = 0;
        }
        if (c !== pc && c.hp > 0 && (c.ai || c.cop) && !c.crewDeployed) {
          braking = along > 2 * KMH ? acceleration < -0.12 * GRAVITY : along > -2 * KMH && acceleration <= 0;
          // A slide (driverStats): counted once until the car is straight again.
          const sliding = along > 40 * KMH && Math.abs(lateral) > along * 0.27;
          if (sliding && !c.sliding) driverStats[c.cop ? 'policeSlides' : 'trafficSlides']++;
          c.sliding = sliding || (c.sliding && Math.abs(lateral) > along * 0.1);
        }
        c.braking = braking;
        // OFF-ROAD (offroad.js): on the range the tyres give what the surface and
        // the driven wheels allow (wheelspin past it), gravity pulls down the slope,
        // mud drags, rough ground bounces; off it the wheels roll with the ground.
        const terrain = roadVehicleTerrain(c);
        if (terrain) {
          const ground = offroadDrive(c, vehicleDefinition, terrain, acceleration, along, stepSeconds);
          acceleration = ground.acceleration;
          if (Math.abs(along) > terrain.limit && acceleration * along > 0) acceleration = 0;
          grip *= ground.grip;
          lateralScale *= ground.lateral;
        } else if (c.wheelSpin || c.surfaceMud) offroadRoll(c, stepSeconds);
        // On a raised drawbridge leaf: gravity down the slope, grip up to ~40 degrees.
        if (c.deckLeaf) acceleration = drawbridgeSlopeDrive(c, acceleration, stepSeconds);
        c.vx += headingCosine * acceleration * stepSeconds;
        c.vy += headingSine * acceleration * stepSeconds;
        // Tyres cancel sideways slip, but only up to what they can grip: a little
        // past the cornering grip (cornerG) at full grip. Normal cornering never
        // reaches the limit; a car punted sideways by a T-bone or a blast skates
        // across the lane and scrubs off instead of stopping dead as if glued to the road.
        /* TYRE STIFFNESS
           Below the limit a tyre's sideways force grows with its slip angle and
           peaks at about seven degrees (TYRE_PEAK_SLIP), whatever the speed. The old
           fixed rate (`grip` a second) let the body slip 13 degrees through a 30 km/h
           corner, so the car drifted wide of where it pointed and a tight turn felt
           like steering a boat. The rate is now at least what reaches the full
           cornering force at the peak slip angle, so the car follows its nose at town
           speeds; `grip` still rules at speed and in a slide, and the handbrake's
           low grip is left alone. */
        const specGrip = vehicleDefinition.grip || 7,
          tyreRate =
            grip >= 3
              ? Math.max(
                  grip,
                  (((vehicleDefinition.cornerG || 1.2) * GRAVITY) / (Math.max(Math.abs(along), 12 * KMH) * TYRE_PEAK_SLIP)) *
                    (grip / specGrip) *
                    // Steering into a slide (counter-steer) lets the fronts bite: the slide is caught.
                    (c.counterSteer ? 1.5 : 1),
                )
              : grip,
          lateralLimit =
            (((vehicleDefinition.cornerG || 1.2) * 1.25 * GRAVITY * Math.max(grip, 5)) / Math.max(specGrip, 5)) *
            lateralScale *
            stepSeconds,
          traction = clamp(lateral * (1 - Math.exp(-tyreRate * stepSeconds)), -lateralLimit, lateralLimit);
        c.vx += headingSine * traction;
        c.vy -= headingCosine * traction;
        c.vx *= Math.exp(-drag * stepSeconds);
        c.vy *= Math.exp(-drag * stepSeconds);
        if (unattended) parkedFriction(c, vehicleDefinition, unattended, stepSeconds);
        // A car just spun by an off-centre hit keeps its spin a moment: the driver
        // cannot cancel it at once (resolveContact sets spinUntil). With nobody at
        // the wheel only the tyres' friction slows the spin (parkedFriction).
        else {
          // The player's car answers the wheel in about a tenth of a second (a
          // keyboard has no half-lock to feed in); drivers' cars more gently.
          // In a handbrake turn the body's own rotation carries it on (the tail is
          // sliding), so the yaw follows the wheel more lazily and a swing started
          // at 30 km/h goes on round as the car slows.
          const yawAuthority =
            physicsClock < (c.spinUntil || 0) ? 1.1 : c === pc ? (c.handbrakeTurn ? 2.6 : PLAYER_YAW_RESPONSE) : 5;
          c.av += (steer - c.av) * (1 - Math.exp(-yawAuthority * stepSeconds));
        }
        c.a = normalizeAngle(c.a + c.av * stepSeconds);
        c.moveA = Math.atan2(c.vy, c.vx);
        c.speed = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
      }
      if (isBoat(c)) {
        const nx = c.x + c.vx * stepSeconds,
          ny = c.y + c.vy * stepSeconds;
        if (boatFits(c, nx, ny)) {
          c.x = nx;
          c.y = ny;
        } else {
          const speed = Math.hypot(c.vx, c.vy);
          if (speed > 45 && physicsClock - (c.bankHit || -100) > 0.4) {
            damageVehicle(c, (speed - 40) * 0.035, nx, ny);
            c.bankHit = physicsClock;
          }
          if (boatFits(c, nx, c.y)) {
            c.x = nx;
            c.vy = 0;
          } else if (boatFits(c, c.x, ny)) {
            c.y = ny;
            c.vx = 0;
          } else {
            c.vx *= -0.12;
            c.vy *= -0.12;
          }
        }
      } else {
        c.x += c.vx * stepSeconds;
        c.y += c.vy * stepSeconds;
      }
      if (isAircraft(c) && c.altitude < terrainHeight(c.x, c.y)) {
        if (c.type === 'plane') {
          const slope = terrainSlope(c.x, c.y),
            sink = Math.max(2.9 * UNITS_PER_METRE, slope.x * c.vx + slope.y * c.vy - (c.vz || 0));
          planeTouchdown(c, sink);
        } else {
          const slope = terrainSlope(c.x, c.y),
            m = Math.hypot(slope.x, slope.y);
          c.x = c.stepStartX;
          c.y = c.stepStartY;
          if (m > 0.001) {
            const nx = slope.x / m,
              ny = slope.y / m,
              inward = Math.max(0, c.vx * nx + c.vy * ny);
            // Flown into the hillside (AIRCRAFT STRIKES): the speed into the slope.
            if (inward > AIRCRAFT_CRASH_SPEED || Math.hypot(c.vx, c.vy) > AIRCRAFT_CRASH_SPEED * 1.5) destroyAircraft(c, 'terrain', Math.max(inward, Math.hypot(c.vx, c.vy)));
            c.vx -= nx * inward;
            c.vy -= ny * inward;
          }
          c.altitude = Math.max(c.altitude, terrainHeight(c.x, c.y));
        }
      }
    }
