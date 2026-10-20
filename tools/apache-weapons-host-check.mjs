// Reproduce the production Apache armament/control receipt without a browser or GPU.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import apacheWeapons from './tests/apache-weapons.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), evidence = [];
let assertions = 0;
await apacheWeapons({
  assert(value, message) { assertions++; if (!value) throw Error(message); },
  note(value) { try { evidence.push(JSON.parse(value)); } catch { evidence.push(value); } },
});
const files = new Set([
  'src/apache.js', 'src/apache-guided.js', 'src/apache3d.js', 'src/apache-assets3d.js', 'assets/apache-model.bin', 'vendor/three.r160.js', 'src/controls.js', 'src/game-input.js', 'src/gamepad.js', 'src/input-hints.js',
  'src/mobile.js', 'src/arsenal.js', 'src/hud-state.js', 'src/game-combat.js', 'src/game-player-actions.js',
  'src/combat-rules.js', 'src/citylife-police.js', 'src/vehicle-gunfire.js', 'src/roofmission-layout.js', 'src/settings.js',
  'tools/tests/apache-weapons.mjs', 'tools/apache-weapons-host-check.mjs',
]);
function includeInputs(name) {
  files.add(name);
  for (const match of fs.readFileSync(path.join(root, name), 'utf8').matchAll(/^\s*\/\/ @include (src\/[^\n]+)\s*$/gm)) includeInputs(match[1]);
}
includeInputs('src/apache.js');
const inputs = Object.fromEntries([...files].sort().map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex')]));
const report = { passed: true, assertions, evidence, inputs, method: 'CPU-only VM, production source functions and registered input handlers; no browser/GPU performance claims' };
const outAt = process.argv.indexOf('--out');
if (outAt >= 0) {
  const out = path.resolve(process.argv[outAt + 1]);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, assertions, out }));
} else console.log(JSON.stringify(report, null, 2));
