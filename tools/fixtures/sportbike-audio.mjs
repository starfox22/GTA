// Load the shipped engine caller and looping-source implementation without a browser.
import fs from 'node:fs';
import vm from 'node:vm';
import { aircraftAudioFixture, recordingAudio } from './aircraft-audio.mjs';
export { recordingAudio };
export function sportbikeAudioFixture(audio, extra = {}) {
  const f = aircraftAudioFixture(audio, extra), c = f.context,
    source = fs.readFileSync(new URL('../../src/audio.js', import.meta.url), 'utf8'),
    loops = source.slice(source.indexOf('    const LOOP_SECONDS ='), source.indexOf('    // A category bus'));
  vm.runInContext(loops + '\nglobalThis.sportFixture = { ENGINE_SETS, ENGINE_OF_TYPE, engineSimulate, buildEngineAudio };', c);
  return { ...f, ...c.sportFixture };
}
