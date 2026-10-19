// Production fixed-wing dynamics at 30/60/120 Hz. These host checks exercise
// aerodynamics and controls; they do not claim native rendering or hardware FPS.
import { flightFixture } from './aircraft-flight-model.mjs';

const FRAMES = ['skyhawk', 'courier', 'jet', 'airliner'];
const CRUISE = { skyhawk: 200, courier: 300, jet: 520, airliner: 600 };
const GLIDE_ENTRY = { skyhawk: 165, courier: 250, jet: 430, airliner: 450 };
const course = c => Math.atan2(c.vy, c.vx);
const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
const kmh = c => c.airspeed * 3.6 / 8;
const energy = c => 9.81 * c.altitude / 8 + 0.5 * (Math.hypot(c.vx, c.vy, c.vz) / 8) ** 2;

function airborne(f, frame, speed, power = 0, altitude = 680) {
  const c = f.plane(frame, 3000, 9000, 0);
  c.altitude = altitude * 8;
  c.vx = speed * 8 / 3.6;
  c.vy = c.vz = 0;
  c.throttle = c.power = power;
  c.gearDown = false;
  c.gearPos = 0;
  return c;
}

export async function checkDynamics(t, fixture = flightFixture) {
  const receipt = { glides: [], turns: [], stalls: [], approaches: [] };
  for (const hz of [30, 60, 120]) {
    for (const frame of FRAMES) {
      const f = fixture(hz), c = airborne(f, frame, GLIDE_ENTRY[frame]);
      let stallSeconds = 0, warningSeconds = 0, minSpeed = Infinity, finite = true;
      const initialEnergy = energy(c);
      let previousEnergy = initialEnergy, maxEnergyGain = -Infinity;
      const terminal = [];
      for (let i = 0; i < 1200; i++) {
        f.step(c, 0.1);
        stallSeconds += c.stalled ? 0.1 : 0;
        warningSeconds += c.stallWarning ? 0.1 : 0;
        minSpeed = Math.min(minSpeed, kmh(c));
        if (i >= 1100) terminal.push(kmh(c));
        finite &&= Number.isFinite(c.altitude + c.vx + c.vy + c.vz + c.pitch + c.bank);
        const nextEnergy = energy(c);
        maxEnergyGain = Math.max(maxEnergyGain, nextEnergy - previousEnergy);
        previousEnergy = nextEnergy;
      }
      t.assert(finite, `${frame}/${hz}: idle glide produced non-finite motion`);
      t.assert(maxEnergyGain <= 0.01 && previousEnergy < initialEnergy,
        `${frame}/${hz}: idle trim must not create mechanical energy (${maxEnergyGain} J/kg gain)`);
      t.assert(stallSeconds === 0 && warningSeconds === 0,
        `${frame}/${hz}: released-stick idle glide repeatedly stalls/warns (${stallSeconds}/${warningSeconds} s)`);
      t.assert(c.altitude > 200 * 8 && c.hp === c.maxhp,
        `${frame}/${hz}: idle glide must retain a controllable, intact airframe`);
      t.near(c.airspeed / c.stallSpeed, 1.2, 1.5, `${frame}/${hz}: settled glide margin`);
      t.near(c.vz / 8, -6.5, -2.5, `${frame}/${hz}: settled glide sink m/s`);
      t.assert(Math.max(...terminal) - Math.min(...terminal) < 1,
        `${frame}/${hz}: neutral glide must settle rather than hunt around a stall`);
      receipt.glides.push({ frame, hz, speedKmh: kmh(c), minKmh: minSpeed,
        altitudeM: c.altitude / 8, sinkMps: c.vz / 8, stallSeconds, warningSeconds,
        initialEnergyJperKg: initialEnergy, finalEnergyJperKg: previousEnergy, maxEnergyGainJperKg: maxEnergyGain });

      // A coordinated, nearly level turn obeys omega = g*tan(bank)/speed.
      // This catches a hidden yaw multiplier that tightens a turn without
      // supplying its corresponding bank/load/lateral force.
      const turn = airborne(f, frame, CRUISE[frame], 0.8, 450);
      f.step(turn, 35, ['KeyD']);
      const startCourse = course(turn), speedMps = turn.airspeed / 8, bank = turn.bank;
      f.step(turn, 0.1, ['KeyD']);
      const measuredYaw = angle(course(turn) - startCourse) / 0.1,
        physicalYaw = 9.81 * Math.tan(bank) / speedMps;
      t.near(measuredYaw / physicalYaw, 0.94, 1.06, `${frame}/${hz}: coordinated-turn rate ratio`);
      t.near(turn.gLoad, 1 / Math.cos(bank) - 0.12, 1 / Math.cos(bank) + 0.12,
        `${frame}/${hz}: supported bank load`);
      t.near(turn.altitude / 8, 445, 455, `${frame}/${hz}: assisted turn altitude m`);
      t.assert(!turn.stalled && turn.hp === turn.maxhp,
        `${frame}/${hz}: a powered coordinated turn must remain flyable`);
      receipt.turns.push({ frame, hz, speedKmh: kmh(turn), bankRad: bank,
        altitudeM: turn.altitude / 8, measuredYaw, physicalYaw, gLoad: turn.gLoad });
      f.step(turn, 4);
      t.assert(Math.abs(turn.bank) < 0.015 && Math.abs(turn.bankRate) < 0.035,
        `${frame}/${hz}: released bank must settle smoothly to wings level`);

      // Flaps and gear remain deliberate drag/lift choices. A low-power,
      // full-flap approach must not be held nose-high into a stall by trim.
      const approach = airborne(f, frame, f.api.AIRFRAME_SPECS[frame].stall * 3.6 / 8 * 1.5, 0.2);
      approach.flaps = 3;
      approach.flapPos = 1;
      approach.gearDown = true;
      approach.gearPos = 1;
      let approachStalls = 0;
      for (let i = 0; i < 400; i++) {
        f.step(approach, 0.1);
        approachStalls += approach.stalled ? 1 : 0;
      }
      t.assert(approachStalls === 0 && approach.hp === approach.maxhp && approach.altitude > 0,
        `${frame}/${hz}: a released-stick configured approach must stay controllable`);
      t.assert(approach.vz < 0 && approach.airspeed > approach.stallSpeed * 1.1,
        `${frame}/${hz}: approach must descend with a stall margin`);
      receipt.approaches.push({ frame, hz, speedKmh: kmh(approach), sinkMps: approach.vz / 8,
        altitudeM: approach.altitude / 8, stallMargin: approach.airspeed / approach.stallSpeed });
    }
  }

  for (const frame of FRAMES) {
    const f = fixture(), reference = f.api.AIRFRAME_SPECS[frame].stall;
    // A fast descent with attached flow is not a stall just because its
    // horizontal component is small. This is a staged aerodynamic state.
    const dive = airborne(f, frame, 3.6, 0, 500);
    dive.vz = -100 * 8;
    dive.pitch = Math.atan2(dive.vz, dive.vx) - 0.04;
    f.step(dive, 1 / 60);
    t.assert(!dive.stalled && !dive.stallWarning && dive.airspeed > reference * 1.5,
      `${frame}: fast, attached-flow descent must not falsely report a low-speed stall`);

    // Banking moves the caution band before the critical angle is reached;
    // merely being slow/banked is not itself an aerodynamic stall.
    const loaded = airborne(f, frame, reference * 3.6 / 8 * 1.1);
    loaded.bank = 0.9;
    f.step(loaded, 1 / 60, ['KeyD']);
    t.assert(loaded.stallSpeed > reference * 1.2 && loaded.stallWarning && !loaded.stalled,
      `${frame}: bank loading must raise the early warning without inventing a stalled wing`);

    // Assistance may not make excessive back pressure or an idle engine safe.
    const stall = airborne(f, frame, reference * 3.6 / 8 * 1.3, 0, 650);
    let sawStall = false, sawWarning = false;
    for (let i = 0; i < 80; i++) {
      f.step(stall, 0.1, ['KeyT']);
      sawStall ||= stall.stalled;
      sawWarning ||= stall.stallWarning;
    }
    t.assert(sawWarning && sawStall, `${frame}: deliberate idle back pressure must still warn and stall`);
    f.step(stall, 8, ['KeyW', 'KeyG']);
    t.assert(!stall.stalled && stall.hp === stall.maxhp && stall.altitude > 200 * 8,
      `${frame}: power and lowering the nose must recover with altitude available`);
    receipt.stalls.push({ frame, recoveredAltitudeM: stall.altitude / 8,
      recoveredKmh: kmh(stall), recoveredAngleOfAttack: stall.angleOfAttack });

    // Zero-time calls must be inert, including fresh state (no av = 0/0).
    const paused = f.plane(frame);
    const before = JSON.stringify(paused);
    for (const dt of [0, -1, NaN]) f.api.planeControl(paused, dt, true);
    t.assert(JSON.stringify(paused) === before, `${frame}: a non-positive/invalid step must not alter aircraft state`);

    const outcomes = receipt.glides.filter(r => r.frame === frame),
      speeds = outcomes.map(r => r.speedKmh), heights = outcomes.map(r => r.altitudeM);
    t.assert(Math.max(...speeds) - Math.min(...speeds) < 0.5,
      `${frame}: glide speed changed materially between 30/60/120 Hz`);
    t.assert(Math.max(...heights) - Math.min(...heights) < 3,
      `${frame}: glide altitude changed materially between 30/60/120 Hz`);
  }
  t.note('fixed-wing dynamics: ' + JSON.stringify(receipt));
  return receipt;
}

export default async function (t) { await checkDynamics(t); }
