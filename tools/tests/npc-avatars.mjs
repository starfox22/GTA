// The street avatars (npc-avatar3d*.js, npc-avatar-cast.js), fitted in node from the shipped cast: every avatar fits the
// rig's bind skeleton at its own shoulders with a believable stature, valid bones and parts and a closed index, a walk
// pose skins without tearing (the shader's dual quaternions), every role the game dresses has avatars of the sexes it
// uses, and the shader patches find their anchors. On a rendered page: the lineup is drawn as avatars of the right sex.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = ['src/player-body3d-anatomy.js', 'src/player-body3d-extremities.js', 'src/player-body3d-asset.js', 'src/npc-avatar3d-fit.js', 'src/npc-avatar3d-shader.js', 'src/npc-avatar-cast.js'];
const MODELS = 'data:application/octet-stream;base64,' + fs.readFileSync(path.join(ROOT, 'assets/npc-models.bin')).toString('base64');

function load(Three) {
  const rig = fs.readFileSync(path.join(ROOT, 'src/character-rig3d.js'), 'utf8').match(/const RIG = \{[\s\S]*?\n {6}\};/)[0];
  const source = FILES.map((f) =>
    fs
      .readFileSync(path.join(ROOT, f), 'utf8')
      .split('\n')
      .filter((line) => !/@include/.test(line))
      .join('\n'),
  ).join('\n');
  const prelude = `const TAU = Math.PI * 2, PERSON_HEIGHT = 14; const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    function cityMaterialPatch() {} const ASSETS = { npcModels: ${JSON.stringify(MODELS)} };\n${rig}`;
  return new Function('Three', prelude + '\n' + source + '\nreturn { npcAvatarAsset, npcAvatarCast, npcAvatarFitOne, npcAvatarPick, npcAvatarLookTraits, npcMaterialPatch, npcDepthPatch, PB_UNITS, PB_BONES, RIG };')(Three);
}

// CPU dual quaternion skinning, the shader's formula, with bones turned about their own joints (a stride, arms down).
function skinPose(Three, fit, turns) {
  const B = fit.bones,

    qr = [],
    qd = [],
    world = [];
  // Bind frames (rig units) and posed frames: each bone's frame turned by its own turn, children carried by parents.
  const parent = [-1, 0, 1, 1, 1, 3, 4, 5, 6, 0, 0, 9, 10, 11, 12];
  const bindM = B.map((b) => {
    const R = b.R;
    return new Three.Matrix4().set(R[0], R[3], R[6], b.o[0] * 14 / 1.8, R[1], R[4], R[7], b.o[1] * 14 / 1.8, R[2], R[5], R[8], b.o[2] * 14 / 1.8, 0, 0, 0, 1);
  });
  for (let i = 0; i < 15; i++) {
    const local = parent[i] < 0 ? bindM[i].clone() : new Three.Matrix4().copy(bindM[parent[i]]).invert().multiply(bindM[i]);
    const turn = turns[i];
    if (turn) local.multiply(new Three.Matrix4().makeRotationZ(turn));
    world[i] = parent[i] < 0 ? local : new Three.Matrix4().multiplyMatrices(world[parent[i]], local);
  }
  for (let i = 0; i < 15; i++) {
    const delta = new Three.Matrix4().multiplyMatrices(world[i], new Three.Matrix4().copy(bindM[i]).invert()),
      q = new Three.Quaternion().setFromRotationMatrix(delta),
      t = new Three.Vector3().setFromMatrixPosition(delta);
    qr[i] = q;
    qd[i] = [0.5 * (t.x * q.w + t.y * q.z - t.z * q.y), 0.5 * (-t.x * q.z + t.y * q.w + t.z * q.x), 0.5 * (t.x * q.y - t.y * q.x + t.z * q.w), -0.5 * (t.x * q.x + t.y * q.y + t.z * q.z)];
  }
  const P = fit.attributes.position,
    S = fit.attributes.npcSkin,
    n = fit.vertices,
    out = new Float32Array(n * 3),
    rot = (q, v) => {
      const cx = q.y * v[2] - q.z * v[1] + q.w * v[0],
        cy = q.z * v[0] - q.x * v[2] + q.w * v[1],
        cz = q.x * v[1] - q.y * v[0] + q.w * v[2];
      return [v[0] + 2 * (q.y * cz - q.z * cy), v[1] + 2 * (q.z * cx - q.x * cz), v[2] + 2 * (q.x * cy - q.y * cx)];
    };
  for (let v = 0; v < n; v++) {
    const a = S[v * 4],
      b = S[v * 4 + 1],
      wb = S[v * 4 + 2];
    let ra = [qr[a].x, qr[a].y, qr[a].z, qr[a].w],
      rb = [qr[b].x, qr[b].y, qr[b].z, qr[b].w],
      da = qd[a],
      db = qd[b];
    if (ra[0] * rb[0] + ra[1] * rb[1] + ra[2] * rb[2] + ra[3] * rb[3] < 0) (rb = rb.map((x) => -x)), (db = db.map((x) => -x));
    const R = ra.map((x, k) => x * (1 - wb) + rb[k] * wb),
      D = da.map((x, k) => x * (1 - wb) + db[k] * wb),
      len = Math.hypot(...R),
      r = { x: R[0] / len, y: R[1] / len, z: R[2] / len, w: R[3] / len },
      d = D.map((x) => x / len),
      p = rot(r, [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]),
      // 2 (r.w d.xyz - d.w r.xyz + r.xyz x d.xyz)
      tx = 2 * (r.w * d[0] - d[3] * r.x + (r.y * d[2] - r.z * d[1])),
      ty = 2 * (r.w * d[1] - d[3] * r.y + (r.z * d[0] - r.x * d[2])),
      tz = 2 * (r.w * d[2] - d[3] * r.z + (r.x * d[1] - r.y * d[0]));
    out[v * 3] = p[0] + tx;
    out[v * 3 + 1] = p[1] + ty;
    out[v * 3 + 2] = p[2] + tz;
  }
  return out;
}

// Which leg a vertex follows: 1 the left (thigh, shin, foot), 2 the right, 0 neither.
const legSide = (S, v) => {
  let side = 0;
  for (let k = 0; k < 2; k++) {
    const b = S[v * 4 + k];
    if (b >= 9) side |= b % 2 ? 1 : 2;
  }
  return side;
};

export default async function (t) {
  // A rendered page: the lineup near the camera is drawn as avatars, each the sex the game says the person is.
  const live = await t.call('npcAvatars');
  if (!live) t.note('no 3D renderer on this page: the in-game checks need a rendered page');
  else {
    t.assert(live.ready && !live.error, 'avatars not built: ' + JSON.stringify(live).slice(0, 300));
    await t.call('arm', 7);
    await t.call('characterLineup', 'stand', 12);
    await t.call('closeUp', 4);
    await t.wait(0.5);
    await t.call('crowdBenchmark', 1);
    const r = await t.call('npcAvatars');
    t.assert(r.shown > 0, 'nobody in the lineup is drawn as an avatar: ' + JSON.stringify(r).slice(0, 400));
    for (const s of r.slots) t.assert(s.female === s.personFemale, `an avatar of the wrong sex: ${JSON.stringify(s)}`);
    await t.call('closeUp', 2);
  }
  const Three = createRequire(import.meta.url)(path.join(ROOT, 'vendor/three.r160.js'));
  const api = load(Three),
    cast = api.npcAvatarCast(),
    asset = api.npcAvatarAsset();
  t.assert(cast.length >= 24, `the cast has ${cast.length} avatars`);
  const M = 1.8 / 14,
    report = [];
  for (let i = 0; i < cast.length; i++) {
    const a = cast[i],
      fit = api.npcAvatarFitOne(asset, i),
      P = fit.attributes.position,
      S = fit.attributes.npcSkin,
      n = fit.vertices;
    let top = -1e9,
      bottom = 1e9;
    for (let v = 0; v < n; v++) {
      top = Math.max(top, P[v * 3 + 1]);
      bottom = Math.min(bottom, P[v * 3 + 1]);
      t.assert(S[v * 4] < 15 && S[v * 4 + 1] < 15 && S[v * 4 + 3] < 15, `${a.name}: vertex ${v} has a bone out of range`);
    }
    for (let k = 0; k < fit.index.length; k++) if (fit.index[k] >= n) t.assert(false, `${a.name}: index out of range`);
    const stature = (top - bottom) * M;
    // A hat or a helmet stands a little higher than the crown.
    // (A child is fitted to the adult skeleton; the look's height, about 0.64, makes them a child.)
    if (a.kid) t.near(stature * 0.64, 1.1, 1.25, `${a.name}: stature at a child's look height (m)`);
    else t.near(stature, 1.76, 1.92, `${a.name}: stature (m)`);
    t.near(fit.width, a.kid ? 0.7 : 0.85, 1.2, `${a.name}: shoulder width (the rig's at 1)`);
    t.assert(fit.female === (a.sex === 'f'), `${a.name}: sex`);
    // A stride and the arms down: no triangle stretches to more than 3x its bind size.
    const turns = new Array(15).fill(0);
    turns[9] = 0.5;
    turns[10] = -0.4;
    turns[11] = -0.6;
    turns[3] = turns[4] = 0.35;
    turns[5] = turns[6] = 0.5;
    const out = skinPose(Three, fit, turns);
    let worst = 0,
      where = "";
    for (let k = 0; k < fit.index.length; k += 3) {
      const ids = [fit.index[k], fit.index[k + 1], fit.index[k + 2]];
      for (let e = 0; e < 3; e++) {
        const i0 = ids[e],
          i1 = ids[(e + 1) % 3],
          bind = Math.hypot(P[i0 * 3] - P[i1 * 3], P[i0 * 3 + 1] - P[i1 * 3 + 1], P[i0 * 3 + 2] - P[i1 * 3 + 2]),
          posed = Math.hypot(out[i0 * 3] - out[i1 * 3], out[i0 * 3 + 1] - out[i1 * 3 + 1], out[i0 * 3 + 2] - out[i1 * 3 + 2]);
        // (The web between the legs, a crotch seam or a skirt's hem, stretches with any stride: left out.)
        if ((legSide(S, i0) | legSide(S, i1)) === 3) continue;
        if (bind > 0.02 && posed / bind > worst) (worst = posed / bind), (where = [S[i0 * 4], S[i0 * 4 + 1], S[i1 * 4], S[i1 * 4 + 1], +bind.toFixed(3)].join(" "));
      }
    }
    t.assert(worst < 3.5, `${a.name}: a triangle stretches ${worst.toFixed(2)}x in a stride (bones ${where})`);
    report.push(`${a.name} ${stature.toFixed(2)} m w${fit.width.toFixed(2)} x${worst.toFixed(2)}`);
  }
  t.note(report.join('; '));
  // Casting: each role the game dresses has its avatars, of the sexes the game gives it (voices.js outfitFemale).
  const h = (k) => (Math.sin(k * 12.9898) * 43758.5453) % 1;
  const pick = (look, female, kid = false, role = 'casual', p = null) => api.npcAvatarPick(look, p, female, kid, role, false, (k) => Math.abs(h(k + (look.seed || 0))));
  const need = [
    [{ outfit: 'police' }, [false, true], 'police'],
    [{ outfit: 'traffic' }, [false, true], 'police'],
    [{ outfit: 'swat' }, [false], 'swat'],
    [{ outfit: 'army' }, [false], 'army'],
    [{ outfit: 'mp' }, [false], 'mp'],
    [{ outfit: 'fed' }, [false, true], 'fed'],
    [{ outfit: 'gang' }, [false, true], 'gang'],
    [{ outfit: 'mobster' }, [false], 'mobster'],
    [{ outfit: 'partyGuest' }, [false, true], 'partyGuest'],
    [{ outfit: 'beach' }, [false, true], 'beach'],
  ];
  for (const [look, sexes, tag] of need)
    for (const female of sexes) {
      const i = pick(look, female);
      t.assert(i >= 0 && cast[i].tags.includes(tag) && (cast[i].sex === 'f') === female, `${look.outfit} (${female ? 'woman' : 'man'}): cast ${i} ${cast[i]?.name}`);
    }
  for (const female of [false, true]) {
    const medic = pick({}, female, false, 'casual', { cityRole: { kind: 'medic' } });
    t.assert(medic >= 0 && cast[medic].tags.includes('medic') && (cast[medic].sex === 'f') === female, `paramedic (${female}): ${cast[medic]?.name}`);
    const kid = pick({}, female, true, 'kid');
    t.assert(kid >= 0 && cast[kid].kid && (cast[kid].sex === 'f') === female, `child (${female}): ${cast[kid]?.name}`);
    for (const role of ['casual', 'commuter', 'jogger', 'elder', 'reveller', 'worker', 'tourist'])
      for (let seed = 0; seed < 6; seed++) {
        const i = pick({ seed: seed * 7 }, female, false, role);
        t.assert(i >= 0 && !cast[i].kid && (cast[i].sex === 'f') === female, `${role} (${female ? 'woman' : 'man'}): cast ${i} ${cast[i]?.name}`);
      }
    // Story characters, waiters and the player's disguise stay on the rig.
    for (const outfit of ['story', 'waiter', 'playerDisguise', 'player', 'athlete']) t.assert(pick({ outfit }, female) === -1, `${outfit} has an avatar`);
  }
  for (let i = 0; i < cast.length; i++) t.assert(api.npcAvatarLookTraits(i)?.top, `${cast[i].name}: no rig palette`);
  // The shader patches' anchors in three.js's chunks.
  const shader = { uniforms: {}, vertexShader: Three.ShaderLib.standard.vertexShader, fragmentShader: Three.ShaderLib.standard.fragmentShader };
  api.npcMaterialPatch(shader, {});
  for (const [key, where] of [
    ['vec3 objectNormal = npcQRot', 'vertexShader'],
    ['vec3 transformed = npcQRot', 'vertexShader'],
    ['diffuseColor.rgb = npcC', 'fragmentShader'],
    ['roughnessFactor = npcRough', 'fragmentShader'],
  ])
    t.assert(shader[where].includes(key), `avatar patch: "${key}" missing from the ${where}`);
  const depth = { uniforms: {}, vertexShader: Three.ShaderLib.depth.vertexShader, fragmentShader: Three.ShaderLib.depth.fragmentShader };
  api.npcDepthPatch(depth, {});
  t.assert(depth.vertexShader.includes('vec3 transformed = npcQRot'), 'avatar depth patch: skinning missing');
  t.assert(depth.fragmentShader.includes('texture2D( npcMap, vNpcUv ).a < 0.5'), 'avatar depth patch: the hair cards cast square shadows');
}
