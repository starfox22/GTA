// Read-only production VM reproduction of the CIRRUS test's speech/sip phase coupling.
// Run from the repository root: node work/sky-sip-fixture-proof.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourcePath = 'src/skyline-meeting.js';
const baselineCommit = '7f45832a';
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sources = Object.fromEntries([sourcePath, 'src/crowd-speech.js', 'src/skyline-bar.js'].map((p) => [p, fs.readFileSync(p, 'utf8')]));
const functionSource = (source, name) => {
  const start = source.indexOf(`    function ${name}(`);
  if (start < 0) throw Error(`missing function ${name}`);
  let end = source.indexOf('{', start), depth = 1;
  while (depth && ++end < source.length) {
    if (source[end] === '{') depth++;
    else if (source[end] === '}') depth--;
  }
  return source.slice(start, end + 1);
};
const ctx = vm.createContext({
  Math, player: {}, storyActors: [], skyBar: { people: [] },
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  speechMarkTalk: () => {}, missionLine: () => {}, tell: () => {}, pressKey: () => '', normalizeAngle: (x) => x,
});
vm.runInContext(sources[sourcePath] + '\n' + functionSource(sources['src/crowd-speech.js'], 'speechReadSeconds') + '\n' + functionSource(sources['src/skyline-bar.js'], 'keySay') + `
let gameTime = 0;
// The participant is already sitting; geometry and the waiter cannot affect this check.
skyMeetingPlaces = () => ({ his: { a: 0 } });
let oldFailures = 0, quietFailures = 0, quietMin = Infinity, oldSevenPhase = null;
for (let phase = 0; phase < 850; phase++) {
  for (const quiet of [false, true]) {
    gameTime = 850 + phase / 100;
    const d = { hp: 100, sitting: true, speechUntil: 0 };
    storyActors = [d]; player.sceneSeat = {}; player.speechUntil = 0;
    Object.assign(skyMeeting, {
      active: true, diplomat: d, stage: quiet ? 'handover' : 'drinks', drinks: 2,
      script: null, service: null, talkLine: quiet ? 7 : 0, talkDone: quiet,
      hand: null, closing: false, hurry: false, hinted: true,
    });
    let lifted = 0;
    // simulate(seconds) uses round(seconds*30): .25 seconds means eight frames.
    const every = quiet ? 8 : 15, count = quiet ? 40 : 20;
    for (let sample = 0; sample < count; sample++) {
      for (let frame = 0; frame < every; frame++) { gameTime += 1 / 30; updateSkyMeeting(1 / 30); }
      lifted = Math.max(lifted, Math.round(player.sceneSeat.lift * 10) / 10);
    }
    if (quiet) {
      quietMin = Math.min(quietMin, lifted);
      if (!(lifted > .9)) quietFailures++;
    } else {
      if (!(lifted > .9)) oldFailures++;
      if (lifted === .7 && oldSevenPhase === null) oldSevenPhase = phase / 100;
    }
  }
}
globalThis.proofResult = { phases: 850, phaseStepSeconds: .01, oldFailures, oldSevenPhase, quietFailures, quietMin, quietSamples: 40, quietFramesPerSample: 8 };
`, ctx);
const scriptPath = fileURLToPath(import.meta.url);
const result = {
  scenario: 'Production CIRRUS update/script/talk/sip functions: dialogue-time ten-second check versus full quiet cycle at handover; geometry, HUD and speech rendering stubbed.',
  baselineCommit,
  currentCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sources: Object.entries(sources).map(([path, source]) => {
    const baseline = execFileSync('git', ['show', `${baselineCommit}:${path}`]);
    return { path, baselineSHA256: sha256(baseline), currentSHA256: sha256(source), byteIdentical: baseline.equals(Buffer.from(source)) };
  }),
  reproduction: { scriptPath: 'work/sky-sip-fixture-proof.mjs', scriptSHA256: sha256(fs.readFileSync(scriptPath)), command: 'node work/sky-sip-fixture-proof.mjs' },
  ...ctx.proofResult,
};
if (result.oldFailures !== 252 || result.quietFailures !== 0 || result.quietMin !== 1) throw Error('unexpected phase sweep result');
fs.writeFileSync('work/sky-sip-fixture-proof.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
