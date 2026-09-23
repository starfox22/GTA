// Dead-code report for the assembled game script.
//
//   sh tools/check.sh dead && node tools/dead-code.mjs dist/check/dead.js
//
// The game is one closure, so a name that is never mentioned outside its own
// declaration is dead. Lists three kinds of candidates (read each one before
// deleting it: a name built at runtime, or only used from the browser console,
// does not show up here):
//   1. functions never called outside their own body (repeated until stable, so
//      a function only called by dead functions is listed too),
//   2. const/let bindings mentioned only once (the declaration),
//   3. bindings that are only ever assigned, never read.
import fs from 'node:fs';

const src = fs.readFileSync(process.argv[2] || 'dist/check/dead.js', 'utf8');

// Blank out comments and string contents, keeping offsets and line breaks.
function stripped(text) {
  let out = '';
  for (let i = 0; i < text.length; ) {
    const c = text[i],
      d = text[i + 1];
    if (c === '/' && d === '/') {
      while (i < text.length && text[i] !== '\n') (out += ' '), i++;
    } else if (c === '/' && d === '*') {
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) (out += text[i] === '\n' ? '\n' : ' '), i++;
      out += '  ';
      i += 2;
    } else if (c === "'" || c === '"') {
      out += c;
      for (i++; i < text.length && text[i] !== c; i++) {
        if (text[i] === '\\') (out += ' '), i++;
        out += text[i] === '\n' ? '\n' : ' ';
      }
      out += c;
      i++;
    } else (out += c), i++;
  }
  return out;
}
// Spread operators become blanks so `...name` counts as a use of `name`.
const code = stripped(src).replace(/\.\.\./g, '   ');
const lineOf = (p) => src.slice(0, p).split('\n').length;
const nameRx = (name) => new RegExp('(?<![\\w$.])' + name.replace(/\$/g, '\\$') + '(?![\\w$])', 'g');
const ROOTS = new Set(['startDeadEndCity', 'createCityRenderer']);

// 1. Functions.
const fns = [];
for (const m of code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
  let k = m.index + m[0].length,
    depth = 1;
  for (; k < code.length && depth; k++) depth += code[k] === '(' ? 1 : code[k] === ')' ? -1 : 0;
  let e = code.indexOf('{', k);
  for (depth = 0; e < code.length; e++) {
    if (code[e] === '{') depth++;
    else if (code[e] === '}' && !--depth) break;
  }
  fns.push({ name: m[1], start: m.index, end: e });
}
const dead = new Set();
for (let changed = true; changed; ) {
  changed = false;
  for (const f of fns) {
    if (dead.has(f) || ROOTS.has(f.name)) continue;
    let live = false;
    for (const m of code.matchAll(nameRx(f.name))) {
      const p = m.index;
      if ((p >= f.start && p <= f.end) || [...dead].some((x) => p >= x.start && p <= x.end)) continue;
      live = true;
      break;
    }
    if (!live && new RegExp('\\.' + f.name + '\\b').test(code)) live = true;
    if (!live) {
      dead.add(f);
      changed = true;
    }
  }
}

// 2 and 3. Bindings.
const bindings = new Map();
for (const rx of [/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g, /,\s*\n\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g])
  for (const m of code.matchAll(rx)) if (!bindings.has(m[1])) bindings.set(m[1], m.index);
const once = [],
  writeOnly = [];
for (const [name, at] of bindings) {
  let total = 0,
    reads = 0;
  for (const m of code.matchAll(nameRx(name))) {
    total++;
    // A plain assignment, `x += ...` or a statement `x++;` writes without reading
    // anything back; `x ||= ...` and `a[x++]` read it.
    const after = code.slice(m.index + name.length, m.index + name.length + 6),
      before = code.slice(Math.max(0, m.index - 3), m.index);
    if (!/^\s*(=(?!=)|[-+*/]=|(\+\+|--)\s*;)/.test(after) && !/(\+\+|--)$/.test(before)) reads++;
  }
  if (total <= 1) once.push(`${name} (line ${lineOf(at)})`);
  else if (!reads) writeOnly.push(`${name} (line ${lineOf(at)})`);
}

console.log(`Functions never called (${dead.size}):`);
for (const f of dead) console.log(`  ${f.name} (line ${lineOf(f.start)}, ${lineOf(f.end) - lineOf(f.start) + 1} lines)`);
console.log(`Bindings never used (${once.length}):` + once.map((s) => '\n  ' + s).join(''));
console.log(`Bindings only assigned (${writeOnly.length}; check each one):\n  ${writeOnly.join('\n  ')}`);
