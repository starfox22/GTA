// Actual renderer animation versus the shared sound RPM rule, including stop/coast-down and jet preservation.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { aircraftAudioFixture, recordingAudio } from '../fixtures/aircraft-audio.mjs';

export default async function aircraftPropellerSyncTest(t) {
  const source = fs.readFileSync(process.env.DEC_PLANE_ANIMATION_SOURCE || new URL('../../src/plane3d-build.js', import.meta.url), 'utf8'),
    match = source.match(/^      function animateAircraft\([^]*?^      \}/m);
  if (!match) throw new Error('production animateAircraft function missing');
  const fixture = aircraftAudioFixture(recordingAudio(), {
    jetAssetPlaneLod() {}, setSurfaceAngle() {}, nightAmount: 0,
  }), c = fixture.context;
  vm.runInContext(match[0], c);
  const model = prop => ({
    paint: { color: {}, emissive: {}, roughness: 0.5, metalness: 0.2 },
    wingPaint: { color: { copy() {} }, emissive: { copy() {} } },
    surfaces: { aileron: [], elevator: [], rudder: [], flap: [] }, gears: [],
    body: { position: { y: 0 }, rotation: { set() {} } }, bellyDrop: 0,
    propSpeed: 0, prop: prop ? { rotation: { x: 0 } } : null,
    disc: prop ? { visible: false, material: { opacity: 0 } } : null,
    fans: prop ? [] : [{ rotation: { x: 0 } }, { rotation: { x: 0 } }],
    lights: { nav: [], strobes: [], beacons: [], landing: [] },
  });
  const near = (got, want, tolerance, label) => t.assert(Math.abs(got - want) < tolerance, label + ': ' + got + ' != ' + want);
  const step = (car, m, seconds) => { for (let i = 0; i < seconds * 60; i++) c.animateAircraft(car, m, 1 / 60); };
  const idleBlur = {};
  for (const airframe of ['skyhawk', 'courier']) {
    const car = { type: 'plane', airframe, hp: 100, x: 0, y: 0, altitude: 0, power: 0, throttle: 0, airspeed: 0 }, m = model(true);
    c.player.car = car;
    step(car, m, 12);
    near(m.propSpeed * 30 / Math.PI, fixture.aircraftSoundPlan(car).rpm, 0.0001, airframe + ' idle visual/audio RPM');
    idleBlur[airframe] = m.disc.material.opacity;
    const idleSpeed = m.propSpeed;
    car.power = car.throttle = 1;
    car.airspeed = 520;
    c.animateAircraft(car, m, 1 / 60);
    t.assert(m.propSpeed > idleSpeed && m.propSpeed < fixture.aircraftPropellerRpm(car) * Math.PI / 30, airframe + ' acceleration lost smoothing');
    step(car, m, 12);
    const plan = fixture.aircraftSoundPlan(car);
    near(m.propSpeed * 30 / Math.PI, plan.rpm, 0.0001, airframe + ' full-power visual/audio RPM');
    near(m.propSpeed * fixture.aircraftEngineProfile(car).blades / (2 * Math.PI), plan.bladeHz, 0.00001, airframe + ' visual blade passages disagree with sound');
    t.assert(m.disc.visible && m.disc.material.opacity > idleBlur[airframe], airframe + ' blur does not increase with blade speed');
    const powered = m.propSpeed;
    c.player.car = null;
    c.animateAircraft(car, m, 1 / 60);
    t.assert(m.propSpeed < powered && m.propSpeed > 0, airframe + ' parked engine did not coast down');
    step(car, m, 35);
    t.assert(m.propSpeed < 0.00001 && !m.disc.visible, airframe + ' uncrewed parked prop continues spinning');
    c.player.car = car;
    step(car, m, 12);
    car.hp = 0;
    step(car, m, 35);
    t.assert(m.propSpeed < 0.00001 && !m.disc.visible, airframe + ' destroyed prop does not stop');
    car.hp = 100; car.altitude = 100; car.abandonedFlight = true;
    c.player.car = null;
    step(car, m, 12);
    t.assert(m.propSpeed > 100 && m.disc.visible, airframe + ' abandoned airborne engine no longer spins');
  }
  t.assert(idleBlur.courier > idleBlur.skyhawk, 'four-blade courier does not blur more than C172 at idle');
  const jet = { type: 'plane', airframe: 'jet', hp: 100, x: 0, y: 0, altitude: 0, power: 0.7 }, m = model(false);
  c.player.car = jet;
  c.animateAircraft(jet, m, 0.1); // null prop/disc is a real turbofan model, never dereferenced
  const oldSpeed = (14 + 0.7 * 70) * (1 - Math.exp(-0.1 * 1.6));
  near(m.propSpeed, oldSpeed, 1e-12, 'turbofan animation target changed');
  near(m.fans[0].rotation.x, 0.1 * oldSpeed * 1.4, 1e-12, 'turbofan rotation changed');
  near(m.fans[1].rotation.x, m.fans[0].rotation.x, 1e-12, 'second turbofan no longer animates');
  t.note('Production animateAircraft: C172/PC12 idle+full audio/RPM match, blade-count blur, smooth acceleration/coast-down, parked/destroyed/abandoned states, null prop and unchanged twin-fan behavior');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let checks = 0;
  await aircraftPropellerSyncTest({ assert(value, message) { checks++; assert.ok(value, message); }, note: console.log });
  console.log('PASS aircraft-propeller-sync: ' + checks + ' host assertions');
}
