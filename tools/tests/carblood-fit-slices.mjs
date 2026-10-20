// CPU-only car-blood fit: immutable baseline geometry hashes, interleaved jobs and bounded expired-deadline work.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { militaryMarkFixture } from '../m4-marks-bench.mjs';

const Three = createRequire(import.meta.url)('../../vendor/three.r160.js'),
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  sourcePath = path.join(root, 'src/carblood3d-fit.js'),
  BASELINE_SOURCE_SHA256 = '15753d716c9ed72c3472a347f1c7336d252941f5ad9c2e29eebdff58e8ac9a73';
// Generated from f350b4be's original fitting source, before adding any cooperative checkpoints.
// The hash contains every used position/normal/UV/blood byte and the ordered event ranges/layouts.
const EXPECTED = {
  "synthetic-indexed": {
    "sha256": "cd88a5a9df98eb7fc5386db1baca1f856193994a7a1e3dd5f81942520761b62d",
    "vertices": 1911,
    "triangles": 637,
    "sourceTriangles": 1400,
    "ranges": [
      {
        "index": 0,
        "start": 0,
        "end": 1032
      },
      {
        "index": 1,
        "start": 1032,
        "end": 1347
      },
      {
        "index": 2,
        "start": 1347,
        "end": 1911
      }
    ],
    "panels": [
      [
        {
          "kind": "top",
          "slot": 0
        },
        {
          "kind": "face",
          "slot": 1
        }
      ],
      [
        {
          "kind": "face",
          "slot": 3
        }
      ],
      [
        {
          "kind": "top",
          "slot": 4
        },
        {
          "kind": "face",
          "slot": 5
        }
      ]
    ]
  },
  "synthetic-dense": {
    "sha256": "600d309b59a8c553a9f83a8cf1d502dbc188adfacb5a68571669ecf52fcac16e",
    "vertices": 14286,
    "triangles": 4762,
    "sourceTriangles": 12024,
    "ranges": [
      {
        "index": 0,
        "start": 0,
        "end": 8112
      },
      {
        "index": 1,
        "start": 8112,
        "end": 10128
      },
      {
        "index": 2,
        "start": 10128,
        "end": 14286
      }
    ],
    "panels": [
      [
        {
          "kind": "top",
          "slot": 0
        },
        {
          "kind": "face",
          "slot": 1
        }
      ],
      [
        {
          "kind": "face",
          "slot": 3
        }
      ],
      [
        {
          "kind": "top",
          "slot": 4
        },
        {
          "kind": "face",
          "slot": 5
        }
      ]
    ]
  },
  "synthetic-transformed": {
    "sha256": "2eca603313811af9470ead773999b8df3b397e804b8ffd3a01b73ec6c52afbe8",
    "vertices": 1911,
    "triangles": 637,
    "sourceTriangles": 1400,
    "ranges": [
      {
        "index": 0,
        "start": 0,
        "end": 1032
      },
      {
        "index": 1,
        "start": 1032,
        "end": 1347
      },
      {
        "index": 2,
        "start": 1347,
        "end": 1911
      }
    ],
    "panels": [
      [
        {
          "kind": "top",
          "slot": 0
        },
        {
          "kind": "face",
          "slot": 1
        }
      ],
      [
        {
          "kind": "face",
          "slot": 3
        }
      ],
      [
        {
          "kind": "top",
          "slot": 4
        },
        {
          "kind": "face",
          "slot": 5
        }
      ]
    ]
  },
  "packed-m4": {
    "sha256": "8fecaf72a3b2a169397912a465940df895e6c1c32643a027013d291fbc141b6c",
    "vertices": 7422,
    "triangles": 2474,
    "sourceTriangles": 22161,
    "ranges": [
      {
        "index": 0,
        "start": 0,
        "end": 4425
      },
      {
        "index": 1,
        "start": 4425,
        "end": 5526
      },
      {
        "index": 2,
        "start": 5526,
        "end": 7422
      }
    ],
    "panels": [
      [
        {
          "kind": "top",
          "slot": 0
        },
        {
          "kind": "face",
          "slot": 1
        }
      ],
      [
        {
          "kind": "face",
          "slot": 3
        }
      ],
      [
        {
          "kind": "face",
          "slot": 5
        }
      ]
    ]
  }
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function countedArray(array, count) {
  return new Proxy(array, {
    get(target, key) {
      if (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)) count.ops++;
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      if (key === 'set') return (source, at) => { count.ops += source.length * 2; return target.set(source, at); };
      if (key === 'slice') return (a = 0, b = target.length) => { count.ops += Math.max(0, b - a) * 2; return countedArray(target.slice(a, b), count); };
      if (key === 'subarray') return (a, b) => countedArray(target.subarray(a, b), count);
      return value.bind(target);
    },
    set(target, key, value) {
      if (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)) count.ops++;
      return Reflect.set(target, key, value, target);
    },
  });
}

function fixture(source, { expired = false, tracked = false, period = 1 } = {}) {
  const count = { ops: 0, checks: 0, yields: 0, steps: 0, maxStepOps: 0 }, targets = [];
  const scope = vm.createContext({
    Three, UNITS_PER_METRE: 8, CB_TILE: 512, CB_COLS: 3, CB_ROWS: 2, CB_LIFT: .1, clamp,
    cbSmooth: (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); },
    cbOver: () => { count.checks++; return expired && count.checks % period === 0; },
    rayTargets: m => { targets.splice(0); m.body.traverse(o => { if (o.isMesh && o.visible) targets.push(o); }); return targets; },
  });
  if (tracked) for (const [name, Type] of Object.entries({ Float32Array, Float64Array, Int32Array })) {
    const ProxyType = function(...args) { return countedArray(new Type(...args), count); };
    ProxyType.prototype = Type.prototype;
    scope[name] = ProxyType;
  }
  const api = vm.runInContext(source + `\n({ output: cbOutput, fit: cbFitJob, gather: cbGatherJob, panel: cbFitPanel,
    top: typeof cbTopHeightJob === 'function' ? cbTopHeightJob : null,
    grid: typeof cbCoverGridJob === 'function' ? cbCoverGridJob : null,
    covered: typeof cbCoveredJob === 'function' ? cbCoveredJob : null,
    grow: typeof cbOutputGrowJob === 'function' ? cbOutputGrowJob : null,
    copy: typeof cbCopyJob === 'function' ? cbCopyJob : null,
    cache: () => ({ hits: cbGatherHits, misses: cbGatherMisses, size: cbGatherCache.size }) })`, scope);
  const step = gen => {
    const before = count.ops, result = gen.next();
    count.steps++; count.maxStepOps = Math.max(count.maxStepOps, count.ops - before);
    if (!result.done) count.yields++;
    return result;
  };
  const drain = gen => { for (let i = 0; i < 1000000; i++) { const result = step(gen); if (result.done) return result.value; } throw Error('fit generator failed to finish'); };
  return { api, scope, count, step, drain };
}

function synthetic(name = 'synthetic', density = 1, transform = 0) {
  const group = new Three.Group(), body = new Three.Group(), material = new Three.MeshBasicMaterial();
  group.add(body); group.position.set(130 * transform, -18 * transform, 73 * transform);
  group.rotation.set(.03 * transform, .2 * transform, -.07 * transform); body.rotation.set(-.04 * transform, .06 * transform, .02 * transform);
  const add = (geometry, x, y, z, rotation = 0) => { const mesh = new Three.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.rotation.z = rotation; body.add(mesh); return mesh; };
  add(new Three.BoxGeometry(30, 6, 14, 12 * density, 3 * density, 6 * density), 0, 3, 0);
  add(new Three.BoxGeometry(13, .4, 12, 9 * density, 1, 8 * density), 8, 6.4, 0);
  add(new Three.BoxGeometry(11, 7, 12, 7 * density, 4 * density, 8 * density), -3, 9.5, 0);
  add(new Three.BoxGeometry(.6, 5, 6, 1, 3 * density, 4 * density), 15.1, 3, 0, -.04);
  const hidden = add(new Three.BoxGeometry(30, 20, 20), 0, 0, 0); hidden.visible = false;
  const existingDecal = add(new Three.BoxGeometry(1, 1, 1), 0, 50, 0); existingDecal.userData.carBloodSkin = true;
  return { model: { group, body, car: true, modelScale: 1 }, car: { type: name }, name };
}

function actualM4() {
  const fixture = militaryMarkFixture({ type: 'army_jeep' });
  return { model: fixture.model, car: fixture.car, name: 'packed-m4' };
}

function events() {
  return [
    { index: 0, slots: [0, 1], stain: { face: 'front', x: 14, z: 1.5, sx: -1, sz: .2, sev: .7, reach: 3.2 } },
    { index: 1, slots: [2, 3], stain: { face: 'right', x: 2, z: 7, sx: -.8, sz: -.2, sev: .4, reach: 2.3 } },
    { index: 2, slots: [4, 5], stain: { face: 'rear', x: -14, z: -2, sx: 1, sz: -.3, sev: .6, reach: 2.6 } },
  ];
}

function job(api, model, car) { return { skin: { c: car }, m: model, events: events(), out: api.output(24), sourceTriangles: 0 }; }
function geometryResult(job) {
  const hash = createHash('sha256'), sizes = { pos: 3, nor: 3, uv: 2, blood: 2 };
  for (const [name, size] of Object.entries(sizes)) {
    const array = job.out[name]; hash.update(name); hash.update(Buffer.from(array.buffer, array.byteOffset, job.out.n * size * array.BYTES_PER_ELEMENT));
  }
  const ranges = job.out.ranges.map(r => ({ index: r.event.index, start: r.start, end: r.end })),
    layouts = job.events.map(event => event.layout?.map(p => Object.fromEntries(Object.entries(p).filter(([name]) => name !== 'k'))) || null);
  hash.update(JSON.stringify({ ranges, layouts }));
  return { sha256: hash.digest('hex'), vertices: job.out.n, triangles: job.out.n / 3, sourceTriangles: job.sourceTriangles, ranges,
    panels: layouts.map(p => p?.map(v => ({ kind: v.kind, slot: v.slot }))) };
}

function boundedWork(source, assert) {
  const f = fixture(source, { expired: true, tracked: true }), count = f.count,
    panel = { hu: 1, hv: 1, k: 1, P: new Three.Vector3(), U: new Three.Vector3(1, 0, 0), V: new Three.Vector3(0, 0, 1), N: new Three.Vector3(0, 1, 0) },
    triangles = 4096, pos = new Float32Array(triangles * 9);
  for (let t = 0; t < triangles; t++) pos.set([0, t % 17 / 16, 0, 0, t % 17 / 16, 1, 1, t % 17 / 16, 0], t * 9);
  const infos = [{ id: 0, pos: countedArray(pos, count), count: pos.length / 3, min: [0, 0, 0], max: [1, 1, 1] }], rows = [];
  const measure = (name, gen, expect) => {
    const beforeYields = count.yields, beforeChecks = count.checks; count.maxStepOps = 0;
    const value = f.drain(gen), row = { name, maxStepOps: count.maxStepOps, yields: count.yields - beforeYields, checks: count.checks - beforeChecks };
    assert(expect(value), name + ': changed result while suspended');
    assert(row.yields > 1, name + ': work never cooperatively suspended');
    assert(row.maxStepOps <= 16384, name + ': unbounded work after an expired deadline: ' + JSON.stringify(row));
    rows.push(row); return value;
  };
  assert(f.api.top && f.api.grid && f.api.covered && f.api.copy && f.api.grow, 'fitting stages do not expose cooperative generator implementations');
  measure('top-height-4096-triangles', f.api.top(infos, .25, .25), value => value === 1);
  const candidates = 1024, cand = new Float64Array(candidates * 16);
  for (let i = 0; i < candidates; i++) cand.set([1, 1, 1, 2, 1, 1, 1, 1, 2, 1, -1, 1, -1, 1, 1, 0], i * 16);
  const trackedCand = countedArray(cand, count), grid = measure('dense-grid-147456-memberships', f.api.grid(trackedCand, candidates, panel), value => value.items.length === 1024 * 144 && value.start[144] === 1024 * 144);
  assert(Array.from(grid.items.subarray(grid.start[78], grid.start[79])).every((value, i) => value === i), 'cover-grid candidate order changed');
  measure('covered-point-1024-candidates', f.api.covered(trackedCand, grid, panel, 0, 0, 0, -1), value => value === false);
  const input = countedArray(Float32Array.from({ length: 65536 }, (_, i) => i / 8), count), output = countedArray(new Float32Array(65536), count);
  measure('copy-65536-elements', f.api.copy(output, input, input.length), () => Buffer.from(output.buffer).equals(Buffer.from(input.buffer)));
  const out = f.api.output(5000); out.n = 5000; out.pos.fill(7); out.nor.fill(3); out.uv.fill(5); out.blood.fill(6);
  const original = [out.pos, out.nor, out.uv, out.blood], grow = f.api.grow(out, 50); let result;
  for (let i = 0; i < 1000; i++) {
    result = f.step(grow); if (result.done) break;
    assert(out.pos === original[0] && out.nor === original[1] && out.uv === original[2] && out.blood === original[3] && out.cap === 5000,
      'a suspended output growth exposed only part of the new attributes');
  }
  assert(result?.done && out.cap === 10000, 'cooperative output growth did not finish at the original capacity');
  for (const [name, size, value] of [['pos', 3, 7], ['nor', 3, 3], ['uv', 2, 5], ['blood', 2, 6]])
    assert(Array.from(out[name].subarray(0, out.n * size)).every(v => v === value), name + ': output growth changed committed values');
  return rows;
}

export function carBloodFitAudit({ source = fs.readFileSync(sourcePath, 'utf8'), assert = (value, message) => { if (!value) throw Error(message); }, baseline = false } = {}) {
  const rows = [];
  for (const item of [synthetic('synthetic-indexed'), synthetic('synthetic-dense', 3), synthetic('synthetic-transformed', 1, 2), actualM4()]) {
    const f = fixture(source), pending = job(f.api, item.model, item.car);
    f.drain(f.api.fit(pending));
    const result = geometryResult(pending);
    if (!baseline) {
      assert(EXPECTED[item.name], 'missing immutable baseline receipt for ' + item.name);
      assert(JSON.stringify(result) === JSON.stringify(EXPECTED[item.name]), item.name + ': changed fitted attributes, clipping order, layout or event ranges: ' + JSON.stringify(result));
      const cacheBefore = f.api.cache(), repeat = job(f.api, item.model, item.car); f.drain(f.api.fit(repeat));
      assert(JSON.stringify(geometryResult(repeat)) === JSON.stringify(result), item.name + ': cache hit changed output geometry');
      if (item.model.car) assert(f.api.cache().hits === cacheBefore.hits + 1, item.name + ': repeated immutable source missed gather cache');
    }
    rows.push({ name: item.name, ...result, steps: f.count.steps, checks: f.count.checks });
  }
  if (baseline) return { baselineSourceSHA256: BASELINE_SOURCE_SHA256, rows };
  // Every deadline is expired: another fit is deliberately resumed between every two yields.
  const interleaved = fixture(source, { expired: true }), left = synthetic('interleave-a', 2, 1), right = synthetic('interleave-b', 1, -2),
    jobs = [job(interleaved.api, left.model, left.car), job(interleaved.api, right.model, right.car)],
    gens = jobs.map(j => interleaved.api.fit(j)), done = [false, false], references = [];
  for (const item of [left, right]) {
    const isolated = fixture(source), pending = job(isolated.api, item.model, item.car); isolated.drain(isolated.api.fit(pending)); references.push(geometryResult(pending));
  }
  for (let i = 0; i < 100000 && done.some(value => !value); i++) for (let k = 0; k < gens.length; k++) if (!done[k]) done[k] = interleaved.step(gens[k]).done;
  assert(done.every(Boolean), 'interleaved fit jobs did not finish');
  for (let i = 0; i < jobs.length; i++) assert(JSON.stringify(geometryResult(jobs[i])) === JSON.stringify(references[i]), 'interleaved fit ' + i + ' corrupted matrix/clip scratch or event geometry');
  assert(interleaved.count.yields > 20, 'interleaving fixture did not exercise cooperative suspension');
  return { baselineSourceSHA256: BASELINE_SOURCE_SHA256, rows, interleaved: { jobs: jobs.length, yields: interleaved.count.yields, exact: true },
    boundedWork: boundedWork(source, assert) };
}

export default async function (t) {
  const report = carBloodFitAudit({ assert: (ok, message) => t.assert(ok, message) });
  t.note(JSON.stringify(report));
}
