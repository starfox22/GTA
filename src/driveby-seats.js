    // Drive-by seats: the model's seat for every car the renderer seats people in (DRIVEBY_SEATS, recorded from
    // cars3d-interior.js carSeatPlan and checked against it), the police body a law car is drawn as (policeLookChoice)
    // and the reach that keeps a drive-by grip in the hand (driveByReachClamp).
    /**
     * DRIVE-BY SEATS
     * The renderer fits every closed cabin's seat round the drawn head (cars3d-headroom.js CABIN HEADROOM) and draws
     * the drive-by pose in that seat; the game fires from a grip it sizes from its own seat (driveby.js driveBySeat).
     * So that the bullet leaves from the gun that is drawn, the game takes the model's seat from DRIVEBY_SEATS: per car
     * type (or 'law:<body>' for a police body) [hip x ahead of the middle, hip height, hip's offset from the centre
     * line, the torso's lean back (radians), the belt (the glass's foot)], world metres. The table is recorded from the
     * renderer's plans (DeadEndCity.cabinHeadroom() `seat`; tools/tests/cabin-headroom.mjs fails when an entry drifts
     * past 2 cm, and prints the line to paste). A body change that moves a seat re-records its line.
     *
     * The grip then stays within the arm's reach of the shoulder on its side (driveByReachClamp: the player's rig
     * proportions below, the torso at the seat's lean and the pose's twist, never its roll toward the window, which
     * only brings the shoulder closer): out of reach it comes in across the sill at the same height, so the hand holds
     * the gun where the muzzle is (crowd3d-driveby.js `driveByArm.gap` stays 0).
     */
    const DRIVEBY_SEATS = {
      coupe: [-0.282, 0.362, 0.414, 0.35, 0.882],
      sedan: [-0.318, 0.275, 0.426, 0.25, 0.846],
      suv: [-0.311, 0.73, 0.448, 0.25, 1.15],
      taxi: [-0.058, 0.561, 0.426, 0.25, 1.07],
      muscle: [-0.75, 0.457, 0.44, 0.25, 1],
      sport: [0.029, 0.202, 0.426, 0.61, 0.8],
      rally: [-0.487, 0.505, 0.414, 0.25, 0.95],
      hotrod: [-0.442, 0.401, 0.414, 0.57, 1.02],
      supercar: [-0.268, 0.214, 0.46, 0.47, 0.83],
      luxury: [-0.286, 0.491, 0.448, 0.25, 1.025],
      limousine: [1.24, 0.499, 0.46, 0.25, 0.98],
      van: [0.919, 0.68, 0.46, 0.25, 1.1],
      pickup: [0, 0.85, 0.446, 0.25, 1.27],
      chevette: [-0.79, 0.261, 0.464, 0.41, 0.88],
      brutini: [-0.412, 0.202, 0.482, 0.61, 0.82],
      cavalino: [-0.675, 0.242, 0.446, 0.53, 0.86],
      valkyrie: [-0.226, 0.205, 0.289, 0.83, 0.72],
      dbs: [-0.929, 0.312, 0.452, 0.49, 0.93],
      zr1x: [-0.74, 0.261, 0.464, 0.55, 0.88],
      chevetteSE: [-0.79, 0.261, 0.464, 0.41, 0.88],
      wayron: [-0.145, 0.242, 0.46, 0.53, 0.86],
      tourbillon: [-0.252, 0.244, 0.472, 0.55, 0.86],
      jasko: [-0.208, 0.24, 0.466, 0.43, 0.86],
      sirocco: [-0.178, 0.222, 0.468, 0.57, 0.84],
      novera: [-0.256, 0.261, 0.456, 0.53, 0.88],
      w1: [-0.242, 0.221, 0.468, 0.51, 0.84],
      lafera: [-0.076, 0.203, 0.458, 0.65, 0.82],
      'law:charger': [-0.125, 0.425, 0.436, 0.25, 0.845],
      'law:utility': [-0.074, 0.555, 0.436, 0.25, 0.975],
      'law:crownvic': [-0.352, 0.379, 0.436, 0.25, 0.939],
      'law:tahoe': [-0.138, 0.635, 0.448, 0.25, 1.055],
    };
    // The player's rig in drive-bys (character-rig3d.js RIG, crowd3d-looks.js 'player': 1.8 m, build 1.2): rig units
    // to world units, the torso joint over the hip, the shoulder up the torso and out to its side, the arm.
    const DRIVEBY_RIG = {
      unit: (1.8 / 1.75) * (PERSON_HEIGHT / 14),
      waist: 0.95,
      shoulderY: 3.06,
      shoulderZ: 1.56 * 1.1 * 1.08,
      arm: 2.55 + 2.05,
      // Of the arm, how far the gun's grip may lie from the shoulder (the wrist sits a hand's width off the grip).
      reach: 0.86,
    };
    const policeLookChoices = new WeakMap();
    /*
     * The police body and livery a law vehicle is drawn as (police3d-looks.js pickPoliceLook takes them from here),
     * made once per vehicle; null for a vehicle that is not one.
     */
    function policeLookChoice(vehicle) {
      // DeadEndCity.policeLineup() names the model and livery outright.
      if (vehicle.policeLook) return vehicle.policeLook;
      let choice = policeLookChoices.get(vehicle);
      if (choice !== undefined) return choice;
      const hash = Math.imul((vehicle.id | 0) + 0x9e37, 0x85ebca6b) >>> 0,
        pick = (list, shift) => list[((hash >>> shift) & 0xffff) % list.length];
      if (vehicle.lawUnit === 'swat') choice = { body: 'bearcat', livery: 'swat' };
      else if (vehicle.lawUnit === 'fed') choice = { body: 'tahoe', livery: 'unmarked' };
      else if (vehicle.type === 'police') {
        const county = vehicle.x > CITY_SIZE || vehicle.y > CITY_SIZE,
          livery = county ? 'sheriff' : !vehicle.blockade && ((hash >>> 19) & 0xff) % 9 === 0 ? 'unmarked' : (hash >>> 11) & 1 ? 'bw' : 'modern';
        let body = pick(['charger', 'charger', 'utility', 'utility', 'crownvic'], 3);
        if (livery === 'unmarked' && body === 'utility') body = 'charger';
        choice = { body, livery };
      } else choice = null;
      policeLookChoices.set(vehicle, choice);
      return choice;
    }
    // The DRIVEBY_SEATS key of a vehicle: its type, or its police body.
    function driveBySeatKey(vehicle) {
      const law = vehicle.policeLook || vehicle.lawUnit || vehicle.type === 'police' ? policeLookChoice(vehicle) : null;
      return law ? 'law:' + law.body : vehicle.type;
    }
    const driveByShoulderOut = { x: 0, y: 0, z: 0 };
    /*
     * Brings a grip (vehicle space, world units: x ahead, y across, z up; in `out`) within the arm's reach of the
     * shoulder of `hand` (0 left, 1 right) for a body at `seat` twisted `twist` radians: keeping its height when it can,
     * moving in across and along toward the shoulder.
     */
    function driveByReachClamp(seat, hand, twist, out) {
      const r = DRIVEBY_RIG,
        u = r.unit,
        lean = seat.lean,
        sy = r.shoulderY * u,
        sz = (hand ? 1 : -1) * r.shoulderZ * u,
        // Up the torso lying back `lean`, then turned `twist` about the upright.
        bx = -sy * Math.sin(lean),
        bz = sz,
        sx = seat.x + bx * Math.cos(twist) + bz * Math.sin(twist),
        sAcross = seat.y + (-bx * Math.sin(twist) + bz * Math.cos(twist)),
        sUp = seat.z + r.waist * u + sy * Math.cos(lean),
        reach = r.arm * u * r.reach,
        dx = out.x - sx,
        dy = out.y - sAcross,
        dz = out.z - sUp,
        d = Math.hypot(dx, dy, dz);
      driveByShoulderOut.x = sx;
      driveByShoulderOut.y = sAcross;
      driveByShoulderOut.z = sUp;
      if (d <= reach) return out;
      if (Math.abs(dz) < reach * 0.98) {
        const flat = Math.hypot(dx, dy) || 1,
          keep = Math.sqrt(reach * reach - dz * dz) / flat;
        out.x = sx + dx * keep;
        out.y = sAcross + dy * keep;
      } else {
        const k = reach / d;
        out.x = sx + dx * k;
        out.y = sAcross + dy * k;
        out.z = sUp + dz * k;
      }
      return out;
    }
