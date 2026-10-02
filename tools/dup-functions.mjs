// Fails when two function declarations of the game closure share a name: every src fragment is pasted
// into one closure, so the later declaration silently replaces the earlier (livingcity-medics.js and
// taxi.js both declared `routeLength`, and the cab's fare notice called the wrong one).
// Usage: node tools/dup-functions.mjs dist/check/<tag>.js   (the assembled script; run by quick-check.sh)
import fs from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('usage: node tools/dup-functions.mjs <assembled game script>');
const seen = new Map();
const lines = fs.readFileSync(file, 'utf8').split('\n');
// The game closure's own declarations are indented four spaces (the renderer closure's are deeper).
const re = /^ {4}(?:async\s+)?function\s*\*?\s*([\w$]+)\s*\(/;
lines.forEach((line, i) => {
  const m = re.exec(line);
  if (!m) return;
  (seen.get(m[1]) || seen.set(m[1], []).get(m[1])).push(i + 1);
});
const dup = [...seen].filter(([, at]) => at.length > 1);
for (const [name, at] of dup) console.error(`duplicate function ${name}(): lines ${at.join(', ')} of ${file} (grep -n "function ${name}" src/*.js)`);
if (dup.length) process.exit(1);
console.log(`no duplicate function names (${seen.size} declarations)`);
