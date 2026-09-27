    // Blue Hour street entrance: the forecourt plan (canopy, carpet, planters, bollards, valet stand),
    // the pavement kept clear of street furniture, the doormen and the two limousines at the kerb.
    /* The camera looks north, so the hotel's south face is what a player walking or
       driving up sees. One plan serves the renderer (world3d-bluehour-entrance.js),
       the kept-clear pavement (cityscape3d-roofs.js clearSidewalk asks
       blueHourForecourt: no bus shelter, news boxes, bins or meters at the door) and
       the collision below. Only thin things stand on the 4 m pavement: the canopy
       is cantilevered from the facade (no posts), the planters and rope posts hug the
       wall and the bollards the kerb, so the walk along it stays open. */
    const BLUE_HOUR_ENTRANCE = (() => {
      const cx = ROOFTOP.door.x,
        face = ROOFTOP.y + ROOFTOP.h,
        kerb = face + 33,
        at = (dx, dy, extra) => ({ x: cx + dx, y: face + dy, ...extra });
      return {
        cx,
        face,
        kerb,
        // No street furniture here (a bus stop stood at the door before).
        forecourt: { x: cx - 84, y: face - 6, w: 168, h: 50 },
        // Glass canopy out to just short of the kerb, 3.5 m up.
        canopy: { x: cx - 50, w: 100, depth: 30, underside: 28 },
        carpet: { x: cx - 10, w: 20 },
        // Topiary in stone planters against the wall, either side of the door.
        planters: [at(-34, 6, { kind: 'spiral' }), at(34, 6, { kind: 'spiral' }), at(-58, 6, { kind: 'ball' }), at(58, 6, { kind: 'ball' })],
        // Brass rope posts funnel the last steps to the door.
        stanchions: [at(-12, 5), at(-12, 13), at(12, 5), at(12, 13)],
        // Brass bollards on the kerb edge, clear of the limousines' doors.
        bollards: [at(-26, 30), at(26, 30), at(-70, 30), at(70, 30)],
        // Lantern standards past the canopy's ends.
        lamps: [at(-60, 29), at(60, 29)],
        valetStand: at(40, 28),
        staff: [
          at(-19, 10, { a: Math.PI / 2, role: 'doorman' }),
          at(19, 10, { a: Math.PI / 2, role: 'doorman' }),
          at(40, 21, { a: Math.PI / 2, role: 'valet' }),
        ],
        /* Two parked limousines nose-to-tail west of the door (westbound kerb lane).
           East of the door stays free: mission 2's ambulance stops at x -1618. They
           are ordinary parked cars (stealing one is an ordinary theft); a missing one
           is parked again at a new game, and when mission 2 starts out of view. */
        limos: [at(-40, 44, { a: Math.PI, color: '#121316' }), at(-118, 44, { a: Math.PI, color: '#ece8de' })],
      };
    })();
    function blueHourForecourt(x, y, margin = 0) {
      const f = BLUE_HOUR_ENTRANCE.forecourt;
      return x > f.x - margin && x < f.x + f.w + margin && y > f.y - margin && y < f.y + f.h + margin;
    }
    // Park each limousine that is missing (none standing within 30 units of its spot).
    // `hidden`: only where the camera cannot see it appear.
    function parkBlueHourLimousines(hidden = false) {
      const out = [];
      for (const spot of BLUE_HOUR_ENTRANCE.limos) {
        let car = vehicles.find((c) => c.type === 'limousine' && c.blueHourLimo && Math.hypot(c.x - spot.x, c.y - spot.y) < 30);
        if (!car && !(hidden && crowdInView(spot.x, spot.y, 60))) {
          // A parked car left in the bay by populate() gives way to the hotel's car.
          for (let i = vehicles.length - 1; i >= 0; i--) {
            const c = vehicles[i];
            if (c !== player.car && !c.ai && !c.mission && !c.blueHourLimo && !isAircraft(c) && Math.hypot(c.x - spot.x, c.y - spot.y) < 50)
              vehicles.splice(i, 1);
          }
          for (let d = 0; d <= 9 && !car; d += 3)
            if (canSpawnCar('limousine', spot.x, spot.y + d, spot.a, 3)) {
              car = makeCar('limousine', spot.x, spot.y + d, spot.a, false, spot.color);
              car.blueHourLimo = true;
            }
        }
        if (car) out.push(car);
      }
      return out;
    }
    let blueHourFootDone = false;
    // populate(): the collision for the forecourt's fixtures (once), the limousines and the staff.
    function populateBlueHourEntrance() {
      const E = BLUE_HOUR_ENTRANCE;
      if (!blueHourFootDone) {
        blueHourFootDone = true;
        for (const p of E.planters) registerFootObstacle(p.x, p.y, 4.5, 4.5);
        for (const p of [...E.stanchions, ...E.bollards]) registerFootObstacle(p.x, p.y, 1.2);
        for (const p of E.lamps) registerFootObstacle(p.x, p.y, 1.6);
        registerFootObstacle(E.valetStand.x, E.valetStand.y, 3, 2.2);
      }
      parkBlueHourLimousines();
      for (const post of E.staff) {
        const p = spawnKeyStaff({ ...post });
        p.keyPerson.lines = post.role === 'doorman' ? 'blueHourDoor' : 'blueHourValet';
        p.blueHourStaff = true;
      }
    }
    /* Console (game-console-world.js blueHourEntrance): the plan and who stands there. */
    function blueHourEntranceReport() {
      const E = BLUE_HOUR_ENTRANCE,
        f = E.forecourt,
        r = (v) => Math.round(v);
      return {
        door: { x: ROOFTOP.door.x, y: ROOFTOP.door.y },
        forecourt: f,
        limos: vehicles
          .filter((c) => c.blueHourLimo)
          .map((c) => ({ x: r(c.x), y: r(c.y), heading: Math.round(c.a * 100) / 100, color: c.color, driven: c === player.car })),
        staff: pedestrians.filter((p) => p.blueHourStaff && p.hp > 0).map((p) => ({ role: p.keyPerson.role, x: r(p.x), y: r(p.y) })),
        // Street props (knockable furniture) and bus stops on the forecourt: none expected.
        props: blueHourForecourtProps(),
        busStops: BUS_STOPS.filter((s) => blueHourForecourt(s.x, s.y, 20)).length,
        // The walk along the pavement past the door, and the carpet: open.
        walkBlocked: [-70, -45, 0, 45, 70].some((dx) => footObstacleBlocked(E.cx + dx, E.face + 20, 4.5)),
      };
    }
    function blueHourForecourtProps() {
      const f = BLUE_HOUR_ENTRANCE.forecourt,
        found = [];
      propsNear(f.x + f.w / 2, f.y + f.h / 2, f.w / 2 + 10, (p) => {
        if (blueHourForecourt(p.x, p.y)) found.push(p.kind);
      });
      return found;
    }
