// Render the shipped Web Audio graph on a CPU, without a browser or an audio device.
// Optional tool dependency only; see docs/audit/police-aviation-review-2026-10-15/audio.md.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { aircraftAudioFixture } from './fixtures/aircraft-audio.mjs';

const require = createRequire(import.meta.url);
const { OfflineAudioContext } = require(process.env.DEC_WEB_AUDIO_ENGINE || '/tmp/dec-aircraft-audio/node_modules/web-audio-engine');
const out = path.resolve(process.argv[2] || 'dist/review16/audio');
fs.mkdirSync(out, { recursive: true });
const rate = 24000, seconds = 8.5, results = [];

function wav(channels) {
  const frames = channels[0].length, bytes = frames * channels.length * 2, b = Buffer.alloc(44 + bytes);
  b.write('RIFF'); b.writeUInt32LE(36 + bytes, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(channels.length, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * channels.length * 2, 28);
  b.writeUInt16LE(channels.length * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(bytes, 40);
  for (let i = 0; i < frames; i++) for (let ch = 0; ch < channels.length; ch++)
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[ch][i])) * 32767), 44 + (i * channels.length + ch) * 2);
  return b;
}
function rms(channels, from, to) {
  let sum = 0, n = 0;
  for (const ch of channels) for (let i = Math.floor(from * rate); i < Math.floor(to * rate); i++) { sum += ch[i] * ch[i]; n++; }
  return Math.sqrt(sum / n);
}
for (const [airframe, ramp, moving] of [['skyhawk', 1 / 1.1, false], ['courier', 1 / 0.9, false], ['jet', 1 / 0.38, false], ['airliner', 1 / 0.3, false], ['skyhawk', 1 / 1.1, true]]) {
  if (moving && process.env.DEC_ENGINE_AUDIO_SOURCE) continue; // the old own-engine graph had no exterior placement
  const audio = new OfflineAudioContext(2, rate * seconds, rate),
    math = Object.create(Math);
  let seed = 74017;
  math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const f = aircraftAudioFixture(audio, { Math: math }), c = f.context,
    car = { type: 'plane', airframe, x: moving ? -900 : 0, y: moving ? 160 : 0, altitude: moving ? 80 : 0,
      hp: 100, power: 0, throttle: 0, airspeed: 0, abandonedFlight: moving, vx: moving ? 240 : 0 };
  if (!moving) c.player.car = car;
  const legacy = !f.buildAircraftVoice,
    state = { noise: f.engineNoiseBuffer() },
    voice = legacy ? f.buildJetVoice(state) : f.buildAircraftVoice(state.noise);
  for (let frame = 0; frame <= seconds * 30; frame++) {
    const now = frame / 30;
    car.throttle = now >= 1.5 ? 1 : 0;
    car.power = Math.max(0, Math.min(1, (now - 1.5) / ramp));
    car.airspeed = 520 * Math.max(0, Math.min(1, (now - 2) / 3));
    if (moving) car.x = -900 + 240 * now;
    if (legacy) f.updateJetVoice(state, car, f.engineKind(car), now < 6.2, now);
    else f.updateAircraftVoice(voice, car, now < 6.2, now);
  }
  const rendered = await audio.startRendering(), channels = [rendered.getChannelData(0), rendered.getChannelData(1)],
    buffer = wav(channels), name = airframe + (moving ? '-flyby' : '-idle-takeoff-cutoff') + '.wav';
  fs.writeFileSync(path.join(out, name), buffer);
  let peak = 0;
  for (const ch of channels) for (const v of ch) peak = Math.max(peak, Math.abs(v));
  const result = { file: name, bytes: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    seconds, rate, channels: 2, peak, idleRms: rms(channels, 0.7, 1.4), takeoffRms: rms(channels, 4.8, 5.8), cutoffRms: rms(channels, 7.5, 8.4) };
  // The frozen old graph used 0.3–0.4 s release constants; the new graph releases at 0.12 s.
  if (peak >= 1 || result.cutoffRms > (legacy ? 0.003 : 0.0001) || result.takeoffRms <= 0) throw new Error('invalid rendered audio: ' + JSON.stringify(result));
  results.push(result);
  console.log(name + ': peak ' + peak.toFixed(3) + ', idle RMS ' + result.idleRms.toFixed(3) + ', takeoff RMS ' + result.takeoffRms.toFixed(3));
}
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify({ renderer: 'web-audio-engine@0.13.4 OfflineAudioContext (CPU)',
  sources: { 'engine-audio.js': hash(process.env.DEC_ENGINE_AUDIO_SOURCE || new URL('../src/engine-audio.js', import.meta.url)),
    'aircraft-audio.js': process.env.DEC_ENGINE_AUDIO_SOURCE ? null : hash(new URL('../src/aircraft-audio.js', import.meta.url)) },
  timing: '0–1.5 s idle; 1.5 s throttle advanced; actual power ramps at profile spool rate; 6.2 s output cut (old graph 0.3–0.4 s release, new graph 0.12 s). New graph only: flyby left→right at 240 units/s, 160 units offset, 80 units elevation.',
  scope: 'Actual shipped Web Audio graph, dry engineBus at unity; excludes global limiter/mix makeup, radio, ambient scene, runway/wind layers and cabin convolution. It is an isolated sound fixture, not gameplay recording.', results }, null, 2) + '\n');
