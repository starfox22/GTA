// Render the actual shipped motorcycle caller/graph with the shipped OGG buffers.
// CPU OfflineAudioContext, no browser/device. Optional dependency: web-audio-engine@0.13.4.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { sportbikeAudioFixture } from './fixtures/sportbike-audio.mjs';
const require = createRequire(import.meta.url),
  { OfflineAudioContext } = require(process.env.DEC_WEB_AUDIO_ENGINE || '../work/audio-tools/node_modules/web-audio-engine'),
  out = path.resolve(process.argv[2] || 'dist/sportbike-audio'), rate = 48000, seconds = 24;
fs.mkdirSync(out, { recursive: true });
const offline = new OfflineAudioContext(2, rate * seconds, rate), math = Object.create(Math);
let seed = 10077, now = 0;
math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
// The production caller reads audio.currentTime: schedule it on the offline clock.
const audio = { sampleRate: rate, destination: offline.destination, get currentTime() { return now; } };
for (const name of ['createGain', 'createBiquadFilter', 'createBufferSource', 'createStereoPanner', 'createBuffer', 'createPeriodicWave', 'createOscillator']) audio[name] = offline[name].bind(offline);
const f = sportbikeAudioFixture(audio, { Math: math }), c = f.context,
  car = { type: 'bike', x: 0, y: 0, a: 0, hp: 100, maxhp: 100, speed: 0, vx: 0, vy: 0 };
for (const [id] of f.ENGINE_SETS.inline4.layers) {
  const bytes = execFileSync('ffmpeg', ['-v', 'error', '-i', new URL('../assets/' + id + '.ogg', import.meta.url).pathname, '-f', 'f32le', '-ar', String(rate), '-ac', '1', '-']),
    values = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4),
    buffer = offline.createBuffer(1, values.length, rate);
  buffer.getChannelData(0).set(values);
  c.audioBuffers[id] = buffer;
}
c.player.car = car;
const trace = [];
for (let frame = 0; frame < seconds * 60; frame++) {
  now = frame / 60;
  c.gameTime = now;
  c.keys.KeyW = now >= 1.8 && now < 17;
  car.speed = car.vx = now < 1.8 ? 0 : now < 15.5 ? (now - 1.8) / 13.7 * 500 : now < 17 ? 500 : now < 21 ? 500 * (1 - (now - 17) / 4) : 0;
  c.soundOn = now < 22;
  f.updateEngineAudio(1 / 60);
  if (frame % 6 === 0) {
    const r = f.engineReport();
    trace.push({ t: now, rpm: r.rpm, gear: r.gear, throttle: r.throttle, load: r.load, limiter: r.limiter, shiftCut: r.shiftCut, layers: r.layers.map(({ name, rate, weight }) => ({ name, rate, weight })) });
  }
}
const rendered = await offline.startRendering(), channels = [rendered.getChannelData(0), rendered.getChannelData(1)],
  bytes = channels[0].length * 4, wav = Buffer.alloc(44 + bytes);
wav.write('RIFF'); wav.writeUInt32LE(36 + bytes, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28);
wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(bytes, 40);
let peak = 0;
for (let i = 0; i < channels[0].length; i++) for (let ch = 0; ch < 2; ch++) {
  const v = channels[ch][i]; peak = Math.max(peak, Math.abs(v));
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + (i * 2 + ch) * 2);
}
const rms = (from, to) => { let sum = 0, n = 0; for (let i = Math.floor(from * rate); i < to * rate; i++) { sum += channels[0][i] ** 2; n++; } return Math.sqrt(sum / n); },
  result = { file: 'kuzuki600r-idle-six-gears-limiter-overrun.wav', bytes: wav.length, sha256: crypto.createHash('sha256').update(wav).digest('hex'), rate, seconds, channels: 2, peak,
    idleRms: rms(0.8, 1.6), loadedRms: rms(14, 15), limiterRms: rms(16, 16.8), overrunRms: rms(17.6, 18.5), mutedRms: rms(23.5, 24) };
if (!Number.isFinite(peak) || !Object.values(result).filter(v => typeof v === 'number').every(Number.isFinite) || peak >= 0.9 || result.idleRms <= 0.005 || result.loadedRms <= result.idleRms || result.mutedRms > 0.0005) throw new Error('invalid production audio render ' + JSON.stringify(result));
fs.writeFileSync(path.join(out, result.file), wav);
const mp3 = result.file.replace(/\.wav$/, '.mp3');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(out, result.file), '-c:a', 'libmp3lame', '-q:a', '3', path.join(out, mp3)]);
result.listeningMp3 = { file: mp3, bytes: fs.statSync(path.join(out, mp3)).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(out, mp3))).digest('hex') };
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(new URL('../' + file, import.meta.url))).digest('hex');
fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify({ renderer: 'web-audio-engine@0.13.4 OfflineAudioContext',
  scope: 'Actual shipped updateEngineAudio() caller, OGG recordings, loop boundaries, intake/gear detail, limiter, road and wind; dry engineBus at unity. Excludes global limiter/makeup, radio, ambience and cabin acoustics; isolated listening fixture, not a gameplay capture.',
  timeline: '0–1.8s idle; 1.8–15.5s full-throttle six-gear pull; 15.5–17s sixth-gear limiter; 17–21s closed-throttle engine braking to stop; 21–22s idle; 22s mute.',
  sha256: Object.fromEntries(['src/engine-audio.js', 'src/audio.js', 'assets/engine-inline4-idle.ogg', 'assets/engine-inline4-high.ogg'].map(file => [file, hash(file)])), result, trace }, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
