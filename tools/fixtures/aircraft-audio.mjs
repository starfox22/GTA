// Host fixture for the shipped engine/aircraft functions; no DOM, browser or GPU.
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../../src/' + file, import.meta.url), 'utf8');
export function aircraftAudioFixture(audio, extra = {}) {
  const bus = audio.createGain();
  if (audio.destination) bus.connect(audio.destination);
  const context = vm.createContext({
    Math, Float32Array, audio, master: bus, engineBus: bus,
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    sfxRandom: (lo, hi) => lo + (hi - lo) * 0.417,
    player: { x: 0, y: 0, altitude: 0, car: null }, vehicles: [],
    terrainHeight: () => 0,
    entityElevation: car => car.altitude || 0,
    soundRight: dx => dx,
    soundShade: () => ({ gain: 1, cutoff: 20000 }),
    distanceBetween: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    gameMode: 'play', soundOn: true, audioBuffers: {}, gameTime: 0, keys: {},
    vehicleSpec: () => ({ max: 500 }),
    isAircraft: car => car?.type === 'plane' || car?.type === 'helicopter',
    onRoad: () => false,
    glideParam: (param, value, now, time) => param.setTargetAtTime(value, now, time),
    ...extra,
  });
  const engine = process.env.DEC_ENGINE_AUDIO_SOURCE ? fs.readFileSync(process.env.DEC_ENGINE_AUDIO_SOURCE, 'utf8') : read('engine-audio.js');
  vm.runInContext(engine.replace('    // @include src/aircraft-audio.js', read('aircraft-audio.js')), context);
  vm.runInContext(`globalThis.fixture = {
    engineKind,
    ${engine.includes('src/aircraft-audio.js') ? 'aircraftEngineProfile, aircraftEngineRunning, aircraftPropellerRpm, aircraftSoundPlan, buildAircraftVoice, updateAircraftVoice, aircraftSoundPlacement, updateAircraftAudio, aircraftVoiceReport,' : 'buildJetVoice, updateJetVoice,'}
    engineNoiseBuffer, updateEngineAudio, engineReport,
  }`, context);
  return { context, ...context.fixture };
}

export function recordingAudio() {
  const nodes = [];
  const param = () => ({ value: 0, setTargetAtTime(v) { this.value = v; } });
  function node(kind) {
    const n = { kind, gain: param(), pan: param(), frequency: param(), Q: param(), playbackRate: param(),
      connect(to) { (this.outputs ||= []).push(to); return to; },
      start() { this.started = true; }, stop() { this.stopped = true; }, disconnect() {},
      setPeriodicWave(wave) { this.wave = wave; },
    };
    nodes.push(n);
    return n;
  }
  return {
    nodes, sampleRate: 8000, currentTime: 0,
    createGain: () => node('gain'), createStereoPanner: () => node('pan'),
    createBiquadFilter: () => node('filter'), createOscillator: () => node('oscillator'),
    createBufferSource: () => node('buffer-source'),
    createPeriodicWave: (real, imag) => ({ real, imag }),
    createBuffer: (channels, frames) => ({ getChannelData: () => new Float32Array(frames) }),
  };
}
