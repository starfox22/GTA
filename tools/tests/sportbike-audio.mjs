// Recorded Japanese four-cylinder sound, close-ratio shifts, overrun and audio-rate ignition limiter.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { sportbikeAudioFixture, recordingAudio } from '../fixtures/sportbike-audio.mjs';

export default async function sportbikeAudioTest(t) {
  const audio = recordingAudio(), f = sportbikeAudioFixture(audio), c = f.context,
    set = f.ENGINE_SETS.inline4,
    car = { type: 'bike', x: 0, y: 0, a: 0, hp: 100, maxhp: 100, speed: 0, vx: 0, vy: 0 };
  const near = (v, expected, label, tolerance = 1e-6) => t.assert(Math.abs(v - expected) < tolerance, label + ': ' + v);
  t.assert(f.engineKind(car) === 'inline4', 'sport bike still shares the twin/car bank');
  t.assert(f.engineKind({ type: 'dolcati' }) === 'bike' && f.engineKind({ type: 'yamasaki' }) === 'bike' && f.engineKind({ type: 'cruiser' }) === 'cruiser', 'unrelated motorcycle identities changed');
  t.assert(set.idle === 1300 && set.redline === 15500 && set.gears === 6 && set.shift > 14000, '600-class rev/gear range missing');
  t.assert(set.layers.every(([id]) => id.startsWith('engine-inline4-')), 'new bank falls back to car/twin recordings');
  for (const [id] of set.layers) c.audioBuffers[id] = { duration: 3 };
  c.audioBuffers['engine-start'] = {}; // Must not use a Ford V8 starter for this motorcycle.
  c.playSample = () => { throw new Error('sport bike played car starter'); };
  c.player.car = car;
  for (let i = 0; i < 180; i++) f.updateEngineAudio(1 / 60);
  let r = f.engineReport();
  near(r.rpm, set.idle, 'warm idle', 1);
  t.assert(r.cylinders === 4 && r.redline === 15500, 'report has no cylinder/redline evidence');
  near(r.firingHz, r.rpm / 30, 'even-fire four-stroke frequency', 0.01);
  t.assert(r.gain > 0 && r.layers[0].weight === 1 && r.layers[1].weight === 0, 'real idle not audible');
  const state = f.buildEngineAudio(), voice = state.inline4;
  t.assert(state.out.outputs[0] === c.engineBus, 'sport engine bypasses saved engine volume');
  t.assert(voice.limiter.outputs[0] === voice.limiterDepth && voice.limiterDepth.outputs[0] === state.pulseGate.gain, 'limiter runs per frame rather than at audio rate');
  c.keys.KeyW = true;
  let previousGear = 1, shifts = 0, cuts = 0, maxRpm = 0;
  for (let i = 0; i < 900; i++) {
    car.speed = car.vx = Math.min(500, i / 899 * 500);
    f.updateEngineAudio(1 / 60);
    r = f.engineReport();
    t.assert(r.rpm >= set.idle && r.rpm <= set.redline && r.gear >= 1 && r.gear <= 6, 'rev/gear range escaped');
    if (r.gear > previousGear) { shifts++; t.assert(r.gear === previousGear + 1, 'gear skipped'); }
    previousGear = r.gear;
    if (r.shiftCut > 0) cuts++;
    maxRpm = Math.max(maxRpm, r.rpm);
    if (r.rpm > 4000) t.assert(r.layers[0].weight === 0, 'tickover is pitched into a high-rev squeal');
  }
  t.assert(shifts === 5 && cuts >= 20 && maxRpm > 15000, 'missing six-gear pull/ignition cuts/high revs');
  t.assert(r.limiter && voice.limiterDepth.gain.value > 0 && state.pulseGate.gain.value < 1, 'redline has no ignition-cut envelope');
  near(voice.intake.frequency.value, r.rpm / 30, 'intake firing harmonics', 0.02);
  const loadedTone = r.tone, loadedGain = r.gain;
  c.keys.KeyW = false;
  for (let i = 0; i < 45; i++) f.updateEngineAudio(1 / 60);
  r = f.engineReport();
  t.assert(!r.limiter && voice.limiterDepth.gain.value === 0 && state.pulseGate.gain.value === 1, 'limiter stuck on after lifting');
  t.assert(r.tone < loadedTone * 0.6 && r.gain < loadedGain && r.rpm > 14000, 'overrun loses wheel-driven revs or does not unload');
  t.assert(state.burble === 0, 'stock inline-four inherits random V8 backfires');
  const nodes = audio.nodes.length;
  for (let i = 0; i < 300; i++) { car.speed = car.vx = 500 * (1 - i / 299); f.updateEngineAudio(1 / 60); }
  t.assert(audio.nodes.length === nodes, 'sport engine allocates new sources while driving');
  for (let i = 0; i < 90; i++) f.updateEngineAudio(1 / 60);
  r = f.engineReport();
  t.assert(r.gear === 1 && r.rpm < 1350, 'coasting to stop leaves a high gear/high revs');
  c.soundOn = false;
  f.updateEngineAudio(0.1);
  t.assert(f.engineReport().gain === 0 && voice.intakeGain.gain.value === 0, 'mute does not silence all sport layers');
  c.soundOn = true; car.hp = 0;
  f.updateEngineAudio(0.1);
  t.assert(f.engineReport().gain === 0, 'wreck still runs');
  // Changing to a set whose downloads are still pending must release this voice too.
  delete c.audioBuffers['engine-start'];
  c.player.car = { type: 'sedan', hp: 100 };
  f.updateEngineAudio(0.1);
  t.assert(f.engineReport().gain === 0 && voice.mechanicalGain.gain.value === 0, 'sport engine leaks while next bank loads');
  t.note('CC0 bike-only bank; 1,300–15,500 rpm; 6 close ratios; 5 shift cuts; four-stroke harmonic rate; overrun; audio-rate limiter; bounded sources; mute/wreck/buffer handover');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let checks = 0;
  await sportbikeAudioTest({ assert(v, msg) { checks++; assert.ok(v, msg); }, note: console.log });
  console.log('PASS sportbike-audio: ' + checks + ' host assertions');
}
