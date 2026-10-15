// Real production aircraft audio classification, power/frequency plans, routing, placement and bounded voice reuse.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { aircraftAudioFixture, recordingAudio } from '../fixtures/aircraft-audio.mjs';

export default async function aircraftAudioTest(t) {
  const audio = recordingAudio(), f = aircraftAudioFixture(audio), c = f.context;
  const plane = (airframe, extra = {}) => ({ type: 'plane', airframe, hp: 100, maxhp: 100, x: 0, y: 0, a: 0, altitude: 0, throttle: 0, power: 0, ...extra });
  const near = (actual, expected, label) => t.assert(Math.abs(actual - expected) < 1e-8, label + ': ' + actual + ' != ' + expected);
  // This assertion fails on the frozen pre-change production function: every named
  // airframe other than courier used to be a turbofan, including the Cessna 172.
  t.assert(f.engineKind(plane('skyhawk')) === 'piston', 'SKYLARK/Cessna 172 is classified as a jet');
  for (const [frame, kind, engines, blades] of [['skyhawk', 'piston', 1, 2], ['courier', 'turboprop', 1, 4], ['jet', 'turbofan', 2, 0], ['airliner', 'turbofan', 2, 0]]) {
    const car = plane(frame), profile = f.aircraftEngineProfile(car), idle = f.aircraftSoundPlan(car);
    t.assert(f.engineKind(car) === kind && profile.engines === engines && profile.blades === blades, frame + ' model/engine mismatch');
    c.player.car = car;
    const voice = f.buildAircraftVoice(f.engineNoiseBuffer());
    f.updateAircraftVoice(voice, car, true, 0);
    t.assert(voice.out.outputs[0] === c.engineBus, frame + ' bypasses saved engine volume');
    t.assert(voice.nodes.length + 3 === 15, 'voice node count changed');
    const full = f.aircraftSoundPlan({ ...car, throttle: 1, power: 1, airspeed: 520 });
    const partial = { ...car, throttle: 1, power: 0.63, airspeed: 240 };
    near(f.aircraftPropellerRpm(partial), f.aircraftSoundPlan(partial).rpm, frame + ' shared visual/audio RPM');
    t.assert(full.aHz > idle.aHz && full.bHz > idle.bHz && full.roarGain > idle.roarGain, frame + ' power does not change pitch/load');
    if (blades) near(full.bladeHz, profile.maxRpm * blades / 60, frame + ' blade passing');
    if (kind === 'piston') {
      near(idle.firingHz, 700 * 4 / 120, 'four-stroke idle firing');
      near(full.firingHz, 2700 * 4 / 120, 'four-stroke max firing');
      near(full.hissGain, 0, 'piston turbine hiss');
      t.assert(idle.waveA === 'combustion' && idle.waveB === 'propeller', 'piston lost pulse spectrum');
    }
    // The lever moves ahead of power; audio follows actual power rather than shortcutting spool.
    const lag = f.aircraftSoundPlan({ ...car, throttle: 1, power: 0.2 });
    t.assert(lag.power === 0.2 && lag.aHz < full.aHz, frame + ' ignores engine spool');
    f.updateAircraftVoice(voice, { ...car, hp: 0 }, true, 1);
    near(voice.out.gain.value, 0, frame + ' wreck did not cut off');
    f.updateAircraftVoice(voice, car, false, 2);
    near(voice.out.gain.value, 0, frame + ' mute/pause did not silence');
  }
  t.assert(f.engineKind(plane(undefined)) === 'turboprop' && f.engineKind(plane('unknown')) === 'turboprop', 'courier fallback changed');
  t.assert(f.engineKind({ type: 'helicopter' }) === null && f.engineKind({ type: 'sedan' }) === 'compact', 'unrelated engine classification changed');
  t.assert(f.aircraftSoundPlan(plane('airliner')).aHz < f.aircraftSoundPlan(plane('jet')).aHz, 'larger airliner has the same turbine pitch as business jet');
  c.player.car = null;
  const flying = plane('skyhawk', { x: 300, y: 0, altitude: 100, vx: -250, abandonedFlight: true });
  const close = f.aircraftSoundPlacement(flying), far = f.aircraftSoundPlacement({ ...flying, x: 1200 });
  t.assert(close.level > far.level && close.cutoff > far.cutoff, 'distance loses neither level nor high frequencies');
  near(close.distance, Math.hypot(300, 100), 'elevation missing from attenuation');
  t.assert(close.doppler > 1 && f.aircraftSoundPlacement({ ...flying, vx: 250 }).doppler < 1, 'approach/recede Doppler reversed');
  c.player.vx = -250;
  near(f.aircraftSoundPlacement(flying).doppler, 1, 'listener motion omitted');
  c.player.vx = 0;
  c.soundRight = (dx, dy) => -dx;
  near(f.aircraftSoundPlacement(flying).pan, -close.pan, 'camera-right pan bypassed');
  const level = close.level;
  near(f.aircraftSoundPlacement(flying).level, level, 'camera rotation changes distance gain');
  c.soundShade = () => ({ gain: 0.55, cutoff: 1200 });
  near(f.aircraftSoundPlacement(flying).level, level * 0.55, 'occlusion gain ignored');
  near(f.aircraftSoundPlacement(flying).cutoff, 1200, 'occlusion lowpass ignored');
  c.soundShade = () => ({ gain: 1, cutoff: 20000 });
  const own = c.player.car = plane('skyhawk'), state = { aircraft: [], aircraftClock: 0, noise: f.engineNoiseBuffer() };
  c.vehicles = [own, ...Array.from({ length: 9 }, (_, i) => plane(['courier', 'jet', 'airliner'][i % 3], { x: 200 + i * 80, altitude: 100, abandonedFlight: true })), plane('skyhawk', { x: 10 })];
  f.updateAircraftAudio(state, own, true, 0, 0.1);
  t.assert(state.aircraft.length === 4, 'aircraft voice cap exceeded');
  t.assert(state.aircraft[0].car === own && state.aircraft.slice(1).every(v => v.car !== own && v.car.abandonedFlight), 'parked aircraft hum or own aircraft doubled');
  const nodes = audio.nodes.length;
  for (let i = 0; i < 80; i++) {
    own.airframe = ['skyhawk', 'courier', 'jet', 'airliner'][i % 4];
    f.updateAircraftAudio(state, own, true, i * 0.1, 0.1);
  }
  t.assert(audio.nodes.length === nodes, 'changing families allocates unbounded sources');
  c.vehicles = [own];
  f.updateAircraftAudio(state, own, true, 9, 0.3);
  t.assert(state.aircraft.slice(1).every(v => v.car === null && v.out.gain.value === 0), 'retired planes remain audible');
  f.updateAircraftAudio(state, own, false, 9.1, 0.1);
  t.assert(state.aircraft.every(v => v.out.gain.value === 0), 'muted voices remain audible');
  // Drive the production caller too: ground roll must stop on lift-off and the
  // engine must reach its graph even though planes have no recorded road-engine set.
  c.player.car = plane('skyhawk', { speed: 200, power: 0.8 });
  c.vehicles = [c.player.car];
  f.updateEngineAudio(0.1);
  let report = f.engineReport();
  t.assert(report.kind === 'piston' && report.aircraft[0].kind === 'piston' && report.aircraft[0].gain > 0, 'production update did not start the piston graph');
  t.assert(report.road > 0 && report.tracks === 0, 'runway roll missing or incorrectly plays off-road tracks');
  c.player.car.altitude = 100;
  f.updateEngineAudio(0.1);
  near(f.engineReport().road, 0, 'runway rumble continues after lift-off');
  c.player.car = { type: 'sedan', hp: 100 };
  f.updateEngineAudio(0.1); // recorded car buffers deliberately have not decoded
  t.assert(f.engineReport().aircraft.every(v => !v || v.gain === 0), 'previous aircraft continues while road-engine buffers are pending');
  c.soundOn = false;
  f.updateEngineAudio(0.1);
  t.assert(f.engineReport().aircraft.every(v => !v || v.gain === 0), 'production mute did not reach aircraft output');
  t.note('4 model families; four-stroke/blade rates; actual power/spool; cutoff/mute; distance/elevation/occlusion; camera pan/Doppler; 4 reusable voices');
}

// The same regression can run without tools/test.mjs and its browser fixture.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let checks = 0;
  await aircraftAudioTest({ assert(value, msg) { checks++; assert.ok(value, msg); }, note: console.log });
  console.log('PASS aircraft-audio: ' + checks + ' host assertions');
}
