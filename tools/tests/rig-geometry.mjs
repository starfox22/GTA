// The character rig's geometry, built in node from the sources (no page needed): every closed part of the close,
// street and near sets faces outwards (a positive signed volume; limbs lofted downwards were once inside out), a
// near part's second shape (a woman's) has the same vertices as the first, every hair style, footwear and hand side
// is in its mesh, and the near paint patch finds every anchor in three.js's standard shader.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = ['src/character-rig3d.js', 'src/character-rig3d-kit.js', 'src/character-near3d.js', 'src/character-near3d-head.js', 'src/character-near3d-shader.js'];
const BUILDERS = [
  'rigHeadGeometry',
  'rigUpperArmGeometry',
  'rigForearmGeometry',
  'rigHandGeometry',
  'rigShinGeometry',
  'rigBackpackGeometry',
  'nearHeadGeometry',
  'nearHairGeometry',
  'nearTorsoGeometry',
  'nearPelvisGeometry',
  'nearUpperArmGeometry',
  'nearForearmGeometry',
  'nearHandGeometry',
  'nearThighGeometry',
  'nearShinGeometry',
  'nearFootGeometry',
];

function signedVolume(g, variant = null) {
  const p = g.attributes.position.array,
    idx = g.index.array,
    v = g.attributes.rigVariant ? g.attributes.rigVariant.array : null;
  let vol = 0;
  for (let i = 0; i < idx.length; i += 3) {
    if (v && variant !== null && v[idx[i]] !== variant) continue;
    const a = idx[i] * 3,
      b = idx[i + 1] * 3,
      c = idx[i + 2] * 3;
    vol += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  return vol;
}

export default async function (t) {
  const Three = createRequire(import.meta.url)(path.join(ROOT, 'vendor/three.r160.js'));
  const source = FILES.map((f) =>
    fs
      .readFileSync(path.join(ROOT, f), 'utf8')
      .split('\n')
      .filter((line) => !/@include/.test(line))
      .join('\n'),
  ).join('\n');
  // What the rig reads from the rest of the renderer closure.
  const prelude = 'const TAU = Math.PI * 2, PERSON_HEIGHT = 14; const clamp = (v, a, b) => Math.min(b, Math.max(a, v)); function cityMaterialPatch() {}';
  const api = new Function('Three', prelude + '\n' + source + `\nreturn { ${BUILDERS.join(', ')}, rigTorsoGeometry, rigThighGeometry, rigPelvisGeometry, rigNearPatch, NEAR_HAIR, NEAR_FOOT };`)(Three);
  const geometries = BUILDERS.map((name) => [name, api[name]()]);
  for (const female of [false, true]) for (const name of ['rigTorsoGeometry', 'rigThighGeometry', 'rigPelvisGeometry']) geometries.push([name + (female ? ' (f)' : ''), api[name](female)]);
  for (const [name, g] of geometries) {
    const variants = g.attributes.rigVariant ? [...new Set(g.attributes.rigVariant.array)] : [null];
    for (const v of variants) t.assert(signedVolume(g, v) > 0, `${name}${v === null ? '' : ' variant ' + v} faces inwards (volume ${signedVolume(g, v).toFixed(3)})`);
    for (const x of g.attributes.position.array) t.assert(Number.isFinite(x), `${name}: a position is not finite`);
    if (!name.startsWith('near')) continue;
    for (const attribute of ['normal', 'crowdRegion', 'rigAltPos', 'rigAltNormal', 'rigVariant', 'rigKind'])
      t.assert(g.attributes[attribute] && g.attributes[attribute].count === g.attributes.position.count, `${name}: ${attribute} missing or short`);
  }
  const near = Object.fromEntries(geometries.filter(([n]) => n.startsWith('near')));
  const variantsOf = (g) => [...new Set(g.attributes.rigVariant.array)].sort((a, b) => a - b).join(',');
  t.assert(variantsOf(near.nearHairGeometry) === api.NEAR_HAIR.map((_, i) => i).join(','), 'every hair style is in the near hair: ' + variantsOf(near.nearHairGeometry));
  t.assert(variantsOf(near.nearFootGeometry) === Object.values(api.NEAR_FOOT).join(','), 'shoe, boot and bare foot are in the near feet: ' + variantsOf(near.nearFootGeometry));
  t.assert(variantsOf(near.nearHandGeometry) === '0,1', 'both hands are in the near hand: ' + variantsOf(near.nearHandGeometry));
  // A woman's shape differs where it should (and nowhere for the parts that have none).
  const altSpan = (g) => {
    const a = g.attributes.position.array,
      b = g.attributes.rigAltPos.array;
    let d = 0;
    for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
    return d;
  };
  for (const name of ['nearHeadGeometry', 'nearTorsoGeometry', 'nearPelvisGeometry', 'nearThighGeometry']) t.near(+altSpan(near[name]).toFixed(3), 0.01, 0.5, `${name} woman's shape (units)`);
  t.assert(altSpan(near.nearShinGeometry) === 0, 'a shin has no second shape');
  let triangles = 0;
  for (const [name, g] of geometries) if (name.startsWith('near')) triangles += g.index.count / 3;
  t.near(triangles, 10000, 40000, 'near set triangles, every variant');
  // The patch's anchors.
  const shader = { uniforms: {}, vertexShader: Three.ShaderLib.standard.vertexShader, fragmentShader: Three.ShaderLib.standard.fragmentShader };
  api.rigNearPatch(shader);
  for (const [key, where] of [
    ['objectNormal = rigLocalN', 'vertexShader'],
    ['transformed = rigLocal', 'vertexShader'],
    ['rigFace( vCrowdLocal', 'fragmentShader'],
    ['rigCloth( rigK', 'fragmentShader'],
    ['rigSkinWrap * vec3', 'fragmentShader'],
    ['roughnessFactor = rigRough', 'fragmentShader'],
    ['vec2 rigDH', 'fragmentShader'],
  ])
    t.assert(shader[where].includes(key), `near paint patch: "${key}" missing from the ${where}`);
}
