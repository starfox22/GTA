// The player's own body (player-body3d*.js), built in node from the sources: realistic proportions (stature, head
// to height, shoulders, arm reach, legs), every vertex skinned to valid bones with its part, the mesh closed and
// facing out, and through a pose set (walk, run, aim, rifle, hands up, phone, seated, kneel, crawl, freefall, swim,
// lying, carjack, twists, a turned wrist) no joint tears, collapses or opens a gap at the head, hands or shoes
// (CPU dual quaternion skinning, the shader's own formula). On a rendered page: the player uses it in both views.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = ['src/player-body3d-mesher.js', 'src/player-body3d-anatomy.js', 'src/player-body3d-head.js', 'src/player-body3d-extremities.js', 'src/player-body3d-build.js', 'src/player-body3d-shader.js', 'src/player-body3d-grips.js'];

function load(Three) {
  const rig = fs.readFileSync(path.join(ROOT, 'src/character-rig3d.js'), 'utf8').match(/const RIG = \{[\s\S]*?\n {6}\};/)[0];
  const near = fs.readFileSync(path.join(ROOT, 'src/character-near3d-shader.js'), 'utf8').match(/const RIG_LAMBERT_DIRECT = [^\n]*/)[0];
  const source = FILES.map((f) =>
    fs
      .readFileSync(path.join(ROOT, f), 'utf8')
      .split('\n')
      .filter((line) => !/@include/.test(line))
      .join('\n'),
  ).join('\n');
  const prelude = `const TAU = Math.PI * 2, PERSON_HEIGHT = 14; const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    function cityMaterialPatch() {} const playerRim = { value: null }; const pbUniforms = {};\n${rig}\n${near}`;
  return new Function('Three', prelude + '\n' + source + '\nreturn { pbClock, pbBuildSteps, pbMaterialPatch, pbDepthPatch, pbGripsFor, PB_GRIPS, PB_UNITS, PB_BONES, PB_WIDTH, RIG };')(Three);
}

// The rig's joint chain as drawCrowdPerson builds it (crowdJoint: parent · T · Ry · Rx · Rz), for a pose.
function poseFrames(Three, RIG, H, pose, w) {
  const e = new Three.Euler(0, 0, 0, 'YXZ'),
    joint = (parent, x, y, z, rz = 0, rx = 0, ry = 0) => {
      e.set(rx, ry, rz, 'YXZ');
      const m = new Three.Matrix4().makeRotationFromEuler(e);
      m.elements[12] = x;
      m.elements[13] = y;
      m.elements[14] = z;
      return new Three.Matrix4().multiplyMatrices(parent, m);
    };
  const fall = pose.fall || 0,
    root = joint(new Three.Matrix4(), 0, fall * 1.2 * H * 14 * 0, 0, ((pose.fallSign ?? 1) * fall * Math.PI) / 2).scale(new Three.Vector3(H, H, H)),
    hips = joint(root, 0, RIG.hip + (pose.drop || 0), 0, 0, (pose.roll || 0) * 0.4, 0),
    torso = joint(hips, 0, RIG.waist, 0, pose.lean || 0, pose.roll || 0, pose.twist || 0),
    head = joint(torso, 0.04, RIG.neck, 0, -(pose.headPitch || 0) - (pose.lean || 0) * 0.3, 0, pose.headYaw || 0),
    F = [hips, torso, head];
  for (let side = 0; side < 2; side++) {
    const sign = side ? 1 : -1,
      [swing, abduct, elbow] = pose.arms[side];
    F[3 + side] = joint(torso, 0, RIG.shoulderY, sign * RIG.shoulderZ[0] * w, swing, -sign * abduct);
    F[5 + side] = joint(F[3 + side], 0, -RIG.upperArm, 0, elbow);
    F[7 + side] = joint(F[5 + side], 0, -RIG.forearm, 0, 0.1, (pose.wrist || [0, 0])[side], (pose.wristTwist || [0, 0])[side]);
  }
  for (let side = 0; side < 2; side++) {
    const sign = side ? 1 : -1,
      [hip, knee, spread] = pose.legs[side];
    F[9 + side] = joint(hips, 0, 0, sign * RIG.hipZ[0] * w, hip, -sign * spread);
    F[11 + side] = joint(F[9 + side], 0, -RIG.thigh, 0, knee);
    F[13 + side] = joint(F[11 + side], 0, -RIG.shin, 0, -(hip + knee) * (fall > 0.5 ? 0.3 : 1));
  }
  return F;
}
const stand = { arms: [[0.02, 0.12, 0.16], [0.02, 0.12, 0.16]], legs: [[0, -0.04, 0], [0, -0.04, 0]] };
const POSES = {
  stand,
  walk: { arms: [[0.45, 0.12, 0.3], [-0.4, 0.12, 0.25]], legs: [[-0.35, -0.15, 0], [0.45, -0.25, 0]] },
  run: { lean: 0.15, arms: [[0.8, 0.1, 1.5], [-0.7, 0.1, 1.3]], legs: [[-0.5, -0.4, 0], [0.9, -1.6, 0]] },
  pistolAim: { twist: -0.1, arms: [[1.45, 0.3, 0.2], [1.5, 0.1, 0.15]], legs: stand.legs, wrist: [0.4, -0.4] },
  rifle: { twist: -0.45, headYaw: 0.28, arms: [[1.1, 0.25, 1.5], [1.25, 0.75, 1.7]], legs: [[0.15, -0.2, 0.1], [-0.1, -0.1, 0.1]] },
  handsUp: { arms: [[2.9, 0.35, 0.4], [2.9, 0.35, 0.4]], legs: stand.legs },
  phone: { headPitch: 0.15, arms: [[0.02, 0.12, 0.2], [0.35, 0.3, 2.45]], legs: stand.legs },
  seated: { lean: 0.15, arms: [[0.9, 0.15, 0.7], [0.9, 0.15, 0.7]], legs: [[1.5, -1.3, 0.12], [1.5, -1.3, 0.12]] },
  kneel: { arms: [[0.3, 0.2, 0.6], [0.3, 0.2, 0.6]], legs: [[1.6, -2.4, 0.05], [0.2, -1.6, 0.05]], drop: -3 },
  crawl: { fall: 1, fallSign: -1, arms: [[2.4, 0.4, 0.5], [1.6, 0.4, 0.4]], legs: [[0.6, -1.2, 0.2], [0.1, -0.4, 0.2]] },
  freefall: { fall: 1, fallSign: -1, arms: [[0.4, 1.35, 0.6], [0.4, 1.35, 0.6]], legs: [[-0.2, -0.7, 0.4], [-0.2, -0.7, 0.4]] },
  swim: { fall: 1, fallSign: -1, arms: [[3.0, 0.4, 0.2], [-0.6, 0.3, 0.3]], legs: [[0.3, -0.2, 0.05], [-0.3, -0.2, 0.05]] },
  deadBack: { fall: 1, headYaw: 0.6, arms: [[0.4, 1.7, 0.3], [-0.2, 1.3, 0.6]], legs: [[0.3, -0.7, 0.25], [0, -0.5, 0.25]] },
  carjack: { lean: 0.6, twist: 0.5, arms: [[1.1, 0.4, 1.2], [1.0, 0.6, 1.3]], legs: [[0.6, -0.9, 0.3], [-0.2, -0.3, 0.2]] },
  twistLeft: { twist: 1.1, headYaw: 1.2, arms: stand.arms, legs: stand.legs },
  twistRight: { twist: -1.1, headYaw: -1.2, headPitch: -0.5, arms: stand.arms, legs: stand.legs },
  wristBent: { arms: [[1.4, 0.2, 0.4], [1.4, 0.2, 0.4]], legs: stand.legs, wrist: [0.9, -0.9] },
  wristTwisted: { arms: stand.arms, legs: stand.legs, wristTwist: [1.5, -1.5] },
};

// The shader's skinning on the CPU: per bone R R0^T and the translation, blended as dual quaternions.
function skinner(Three, data, frames) {
  const U = data.unitsPerMetre,
    bones = data.bones.map((bone, b) => {
      const R = bone.R,
        q0 = new Three.Quaternion().setFromRotationMatrix(new Three.Matrix4().set(R[0], R[3], R[6], 0, R[1], R[4], R[7], 0, R[2], R[5], R[8], 0, 0, 0, 0, 1)),
        e = frames[b].elements,
        s = Math.hypot(e[0], e[1], e[2]),
        rot = new Three.Matrix4().set(e[0] / s, e[4] / s, e[8] / s, 0, e[1] / s, e[5] / s, e[9] / s, 0, e[2] / s, e[6] / s, e[10] / s, 0, 0, 0, 0, 1),
        q = new Three.Quaternion().setFromRotationMatrix(rot).multiply(q0.clone().invert()),
        o = new Three.Vector3(bone.o[0] * U, bone.o[1] * U, bone.o[2] * U).multiplyScalar(s).applyQuaternion(q),
        t = new Three.Vector3(e[12] - o.x, e[13] - o.y, e[14] - o.z),
        d = [0.5 * (t.x * q.w + t.y * q.z - t.z * q.y), 0.5 * (-t.x * q.z + t.y * q.w + t.z * q.x), 0.5 * (t.x * q.y - t.y * q.x + t.z * q.w), -0.5 * (t.x * q.x + t.y * q.y + t.z * q.z)];
      return { r: [q.x, q.y, q.z, q.w], d, s };
    });
  const scale = bones[0].s,
    out = [0, 0, 0];
  return (x, y, z, ia, ib, wb) => {
    let ra = bones[ia].r,
      da = bones[ia].d,
      rb = bones[ib].r,
      db = bones[ib].d;
    const sg = ra[0] * rb[0] + ra[1] * rb[1] + ra[2] * rb[2] + ra[3] * rb[3] < 0 ? -1 : 1;
    const r = [0, 1, 2, 3].map((k) => ra[k] * (1 - wb) + sg * rb[k] * wb),
      d = [0, 1, 2, 3].map((k) => da[k] * (1 - wb) + sg * db[k] * wb),
      l = Math.hypot(...r);
    for (let k = 0; k < 4; k++) {
      r[k] /= l;
      d[k] /= l;
    }
    const vx = x * scale,
      vy = y * scale,
      vz = z * scale,
      // v + 2 q × (q × v + w v)
      cx = r[1] * vz - r[2] * vy + r[3] * vx,
      cy = r[2] * vx - r[0] * vz + r[3] * vy,
      cz = r[0] * vy - r[1] * vx + r[3] * vz;
    out[0] = vx + 2 * (r[1] * cz - r[2] * cy) + 2 * (r[3] * d[0] - d[3] * r[0] + (r[1] * d[2] - r[2] * d[1]));
    out[1] = vy + 2 * (r[2] * cx - r[0] * cz) + 2 * (r[3] * d[1] - d[3] * r[1] + (r[2] * d[0] - r[0] * d[2]));
    out[2] = vz + 2 * (r[0] * cy - r[1] * cx) + 2 * (r[3] * d[2] - d[3] * r[2] + (r[0] * d[1] - r[1] * d[0]));
    return out;
  };
}

export default async function (t) {
  // On a rendered page (first: the node build below holds this process for seconds): the player is drawn from
  // it in the chase view and the street view.
  const model = await t.call('playerModel', true);
  if (!model) t.note('no 3D renderer on this page: the in-game checks need a rendered page');
  else {
    t.assert(model.ready && !model.error, 'player body not built: ' + JSON.stringify(model));
    for (const view of ['chase', 'street']) {
      await t.call('viewMode', view);
      await t.wait(0.5);
      await t.call('crowdBenchmark', 1);
      const stats = await t.call('crowdStats');
      t.assert(stats.playerBody === true, `${view} view: the player is not drawn from his own body`);
    }
    await t.call('viewMode', 'street');
  }
  const Three = createRequire(import.meta.url)(path.join(ROOT, 'vendor/three.r160.js'));
  const api = load(Three),
    started = Date.now(),
    build = api.pbBuildSteps(),
    // The build yields every 30 ms, so this process keeps answering the page between slices.
    tick = () => new Promise((resolve) => setImmediate(resolve));
  let step;
  api.pbClock.until = performance.now() + 30;
  while (!(step = build.next()).done) {
    await tick();
    api.pbClock.until = performance.now() + 30;
  }
  api.pbClock.until = Infinity;
  const data = step.value;
  data.unitsPerMetre = api.PB_UNITS;
  t.note(`built in ${Date.now() - started} ms: ${data.vertices} vertices, ${data.triangles} triangles`);
  t.near(data.triangles, 70000, 130000, 'player body triangles (HIGH and ULTRA)');
  // LOW and MEDIUM: the same body meshed coarser, about half the triangles, the same height.
  {
    const coarse = api.pbBuildSteps('coarse');
    let r;
    api.pbClock.until = performance.now() + 30;
    while (!(r = coarse.next()).done) {
      await tick();
      api.pbClock.until = performance.now() + 30;
    }
    api.pbClock.until = Infinity;
    t.near(+(r.value.triangles / data.triangles).toFixed(2), 0.3, 0.6, 'LOW/MEDIUM triangles over HIGH');
    let top = -1;
    const Q = r.value.attributes.position;
    for (let i = 1; i < Q.length; i += 3) top = Math.max(top, Q[i] / api.PB_UNITS);
    t.near(+top.toFixed(3), 1.8, 1.83, 'LOW/MEDIUM: top of the hair (m)');
  }
  const A = data.attributes,
    P = A.position,
    S = A.pbSkin,
    Z = A.pbZone,
    n = data.vertices,
    M = (v, k) => P[v * 3 + k] / api.PB_UNITS;
  for (const name of ['position', 'normal', 'pbSkin', 'pbGrip', 'pbGripN', 'pbTrig', 'pbTrigN', 'pbZone']) t.finite([...A[name].slice(0, 20000)], name);
  // Bones, weights and parts.
  let bad = 0;
  const parts = new Set();
  for (let v = 0; v < n; v++) {
    const a = S[v * 4],
      b = S[v * 4 + 1],
      w = S[v * 4 + 2],
      part = S[v * 4 + 3];
    if (!(a >= 0 && a < api.PB_BONES && b >= 0 && b < api.PB_BONES && w >= 0 && w <= 1 && Number.isInteger(a) && Number.isInteger(b))) bad++;
    parts.add(part);
  }
  t.assert(bad === 0, `${bad} vertices with bones or weights out of range`);
  t.assert(parts.size === api.PB_BONES, `every part has vertices (${parts.size} of ${api.PB_BONES}): ` + JSON.stringify(data.parts));
  // Closed and facing out: the whole body's signed volume, in litres (a 1.80 m man in clothes: ~70-110).
  let volume = 0;
  const I = data.index;
  for (let i = 0; i < I.length; i += 3) {
    const a = I[i] * 3,
      b = I[i + 1] * 3,
      c = I[i + 2] * 3;
    volume += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
  }
  t.near(+(volume / api.PB_UNITS ** 3 * 1000).toFixed(1), 60, 120, 'body volume (litres; positive = facing out)');
  // Proportions in the bind pose (metres).
  let crown = -1,
    scalp = -1,
    sole = 9,
    chin = 9;
  for (let v = 0; v < n; v++) {
    const x = M(v, 0),
      y = M(v, 1),
      z = M(v, 2),
      mat = Math.round(Z[v * 4]);
    crown = Math.max(crown, y);
    if (mat === 1) scalp = Math.max(scalp, y - Math.max(0, Z[v * 4 + 2]));
    sole = Math.min(sole, y);
    if (mat === 1 && x > 0.065 && Math.abs(z) < 0.012) chin = Math.min(chin, y);
  }
  const stature = scalp - sole,
    headHeight = scalp - chin;
  t.note(`hair ${crown.toFixed(3)} m, scalp ${scalp.toFixed(3)} m, soles ${sole.toFixed(3)} m, chin ${chin.toFixed(3)} m`);
  t.near(+stature.toFixed(3), 1.785, 1.815, 'stature, soles to the scalp (m)');
  t.near(+(crown - scalp).toFixed(3), 0.008, 0.02, 'hair on the crown (m)');
  t.near(+(stature / headHeight).toFixed(2), 7.2, 7.9, 'heads tall (chin to scalp)');
  // In the standing pose: shoulders across the deltoids, chest depth, the fingertips at mid-thigh, knee height.
  const H = 1.8 / 1.75,
    standing = skinner(Three, data, poseFrames(Three, api.RIG, H, stand, api.PB_WIDTH)),
    posed = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) posed.set(standing(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], S[v * 4], S[v * 4 + 1], S[v * 4 + 2]), v * 3);
  const W = 8; // world units per metre
  let shoulders = 0,
    chestFront = -9,
    chestBack = 9,
    chestWidth = 0,
    waistWidth = 0,
    bellyFront = -9,
    fingertips = 9;
  for (let v = 0; v < n; v++) {
    const x = posed[v * 3] / W,
      y = posed[v * 3 + 1] / W,
      z = posed[v * 3 + 2] / W,
      part = S[v * 4 + 3];
    if (y > 1.3 && y < 1.45 && (part === 3 || part === 4 || part === 1)) shoulders = Math.max(shoulders, Math.abs(z) * 2);
    if (y > 1.24 && y < 1.32 && Math.abs(z) < 0.08 && part === 1) {
      chestFront = Math.max(chestFront, x);
      chestBack = Math.min(chestBack, x);
    }
    if (part === 7 || part === 8) fingertips = Math.min(fingertips, y);
    if (part <= 1 && y > 1.24 && y < 1.32) chestWidth = Math.max(chestWidth, Math.abs(z) * 2);
    if (part <= 1 && y > 1.0 && y < 1.06) waistWidth = Math.max(waistWidth, Math.abs(z) * 2);
    if (part <= 1 && y > 1.02 && y < 1.14 && Math.abs(z) < 0.06) bellyFront = Math.max(bellyFront, x);
  }
  // Athletic for his age: broad shoulders, a V from the chest to the waist, a flat stomach.
  t.near(+shoulders.toFixed(3), 0.48, 0.56, 'shoulder breadth across the deltoids (m)');
  t.near(+(chestWidth / waistWidth).toFixed(3), 1.08, 1.4, 'chest over waist width (the V)');
  t.near(+((bellyFront - chestFront) * 1000).toFixed(1), -60, 5, 'belly forward of the chest (mm; flat stomach)');
  t.near(+(chestFront - chestBack).toFixed(3), 0.22, 0.31, 'chest depth (m)');
  t.near(+(fingertips / stature).toFixed(3), 0.34, 0.41, 'fingertips at mid-thigh (share of stature)');
  // The hands: the trigger shape differs from the grip only on the index finger; every weapon's grip frames are
  // proper rotations (no mirror, no scale) whose fist sits on the weapon's grip.
  {
    const G = A.pbGrip,
      T = A.pbTrig;
    let hand = 0,
      moved = 0;
    for (let v = 0; v < n; v++) {
      if (Math.round(Z[v * 4]) !== 3) continue;
      hand++;
      if (Math.hypot(G[v * 4] - T[v * 3], G[v * 4 + 1] - T[v * 3 + 1], G[v * 4 + 2] - T[v * 3 + 2]) > 0.01) moved++;
    }
    t.near(+(moved / hand).toFixed(3), 0.03, 0.3, 'share of the hands the trigger finger moves');
    for (const weapon of Object.keys(api.PB_GRIPS)) {
      const g = api.pbGripsFor(weapon);
      for (const m of [g.fire[0], g.fire[1], g.support].filter(Boolean)) {
        const e = m.elements,
          det = new Three.Matrix3().setFromMatrix4(m).determinant();
        t.assert(Math.abs(det - 1) < 1e-6 && Math.abs(Math.hypot(e[0], e[1], e[2]) - 1) < 1e-6, `${weapon}: a grip frame is not a rotation (det ${det})`);
      }
      // The firing fist's centre (hand space) lands on the grip's axis.
      const fist = new Three.Vector3(0, -0.088 * api.PB_UNITS, -0.03 * api.PB_UNITS).applyMatrix4(g.fire[1]),
        f = api.PB_GRIPS[weapon].fire,
        ax = -Math.sin(f.angle),
        ay = Math.cos(f.angle),
        dx = fist.x - f.at[0],
        dy = fist.y - f.at[1],
        off = Math.abs(dx * ay - dy * ax) + Math.abs(fist.z);
      t.assert(off < 1e-6, `${weapon}: the firing fist is ${off} off the grip's axis`);
    }
  }
  // The pose set: edges, triangles and the seams of the separate parts.
  const edgeLen = (Q, a, b) => Math.hypot(Q[a * 3] - Q[b * 3], Q[a * 3 + 1] - Q[b * 3 + 1], Q[a * 3 + 2] - Q[b * 3 + 2]);
  const area = (Q, a, b, c) => {
    const ux = Q[b * 3] - Q[a * 3],
      uy = Q[b * 3 + 1] - Q[a * 3 + 1],
      uz = Q[b * 3 + 2] - Q[a * 3 + 2],
      vx = Q[c * 3] - Q[a * 3],
      vy = Q[c * 3 + 1] - Q[a * 3 + 1],
      vz = Q[c * 3 + 2] - Q[a * 3 + 2];
    return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  };
  // A triangle folds over when its face turns against its vertices' (skinned) normals.
  let skinNormal = null;
  const faceFlipped = (a, b, c) => {
    const Q = posed,
      ux = Q[b * 3] - Q[a * 3],
      uy = Q[b * 3 + 1] - Q[a * 3 + 1],
      uz = Q[b * 3 + 2] - Q[a * 3 + 2],
      vx = Q[c * 3] - Q[a * 3],
      vy = Q[c * 3 + 1] - Q[a * 3 + 1],
      vz = Q[c * 3 + 2] - Q[a * 3 + 2],
      nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    let dot = 0;
    for (const v of [a, b, c]) dot += nx * skinNormal[v * 3] + ny * skinNormal[v * 3 + 1] + nz * skinNormal[v * 3 + 2];
    return dot < 0 && Math.hypot(nx, ny, nz) > 1e-6;
  };
  const bindH = new Float32Array(P.length);
  for (let i = 0; i < P.length; i++) bindH[i] = P[i] * H;
  // Seams: the inner part's rim against the part over it (bind metres, part ids).
  const seam = (innerTest, coverTest) => {
    const inner = [],
      cover = [];
    for (let v = 0; v < n; v++) {
      if (innerTest(v)) inner.push(v);
      else if (coverTest(v)) cover.push(v);
    }
    return { inner, cover };
  };
  const near = (v, c) => Math.hypot(M(v, 0) - c[0], M(v, 1) - c[1], M(v, 2) - c[2]),
    joint = (b) => data.bones[b].o;
  const SEAMS = {
    neck: seam(
      (v) => Math.round(Z[v * 4]) === 0 && M(v, 1) > 1.56 && M(v, 1) < 1.6 && Math.hypot(M(v, 0), M(v, 2)) < 0.08,
      (v) => Math.round(Z[v * 4]) === 1 && M(v, 1) < 1.6 && M(v, 0) < 0.06,
    ),
  };
  for (const side of [0, 1]) {
    SEAMS['wrist' + side] = seam(
      (v) => Math.round(Z[v * 4]) === 0 && S[v * 4 + 3] === 5 + side && near(v, joint(7 + side)) < 0.03,
      (v) => Math.round(Z[v * 4]) === 3 && S[v * 4 + 3] === 7 + side && near(v, joint(7 + side)) < 0.035,
    );
    SEAMS['ankle' + side] = seam(
      (v) => Math.round(Z[v * 4]) === 0 && S[v * 4 + 3] === 11 + side && near(v, joint(13 + side)) < 0.07,
      (v) => Math.round(Z[v * 4]) === 4 && S[v * 4 + 3] === 13 + side && near(v, joint(13 + side)) < 0.06,
    );
  }
  for (const [name, s] of Object.entries(SEAMS)) t.assert(s.inner.length > 10 && s.cover.length > 10, `seam ${name}: ${s.inner.length} inner, ${s.cover.length} covering vertices`);
  const gapOf = (Q, s) => {
    let worst = 0;
    for (const a of s.inner) {
      let best = 1e9;
      for (const b of s.cover) best = Math.min(best, edgeLen2(Q, a, b));
      worst = Math.max(worst, Math.sqrt(best));
    }
    return worst / W;
  };
  const edgeLen2 = (Q, a, b) => (Q[a * 3] - Q[b * 3]) ** 2 + (Q[a * 3 + 1] - Q[b * 3 + 1]) ** 2 + (Q[a * 3 + 2] - Q[b * 3 + 2]) ** 2;
  const bindGap = Object.fromEntries(Object.entries(SEAMS).map(([k, s]) => [k, gapOf(bindH, s)]));
  // Triangles already turned against their normals in the bind (surface nets' odd sliver) are not the pose's doing.
  const bindFlipped = new Uint8Array(I.length / 3);
  {
    const identity = skinner(Three, data, data.bones.map((bone) => {
      const R = bone.R,
        U = api.PB_UNITS;
      return new Three.Matrix4().set(R[0] * H, R[3] * H, R[6] * H, bone.o[0] * U * H, R[1] * H, R[4] * H, R[7] * H, bone.o[1] * U * H, R[2] * H, R[5] * H, R[8] * H, bone.o[2] * U * H, 0, 0, 0, 1);
    }));
    for (let v = 0; v < n; v++) posed.set(identity(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], S[v * 4], S[v * 4 + 1], S[v * 4 + 2]), v * 3);
    skinNormal = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) skinNormal[v * 3 + k] = A.normal[v * 3 + k];
    let count = 0;
    for (let i = 0; i < I.length; i += 3) if ((bindFlipped[i / 3] = faceFlipped(I[i], I[i + 1], I[i + 2]) ? 1 : 0)) count++;
    t.note(`${count} triangles face against their normals in the bind (${((count / (I.length / 3)) * 1000).toFixed(2)} per mille)`);
  }
  const report = {};
  for (const [name, pose] of Object.entries(POSES)) {
    await tick();
    const skin = skinner(Three, data, poseFrames(Three, api.RIG, H, pose, api.PB_WIDTH));
    for (let v = 0; v < n; v++) posed.set(skin(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], S[v * 4], S[v * 4 + 1], S[v * 4 + 2]), v * 3);
    // Skinned normals: the bind normal carried by the same blend (a point a little out along it, minus the point).
    skinNormal = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      const e = 0.05,
        q = skin(P[v * 3] + A.normal[v * 3] * e, P[v * 3 + 1] + A.normal[v * 3 + 1] * e, P[v * 3 + 2] + A.normal[v * 3 + 2] * e, S[v * 4], S[v * 4 + 1], S[v * 4 + 2]);
      for (let k = 0; k < 3; k++) skinNormal[v * 3 + k] = q[k] - posed[v * 3 + k];
    }
    let collapsed = 0,
      flipped = 0;
    const ratios = [];
    for (let i = 0; i < I.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const a = I[i + k],
          b = I[i + ((k + 1) % 3)],
          bind = edgeLen(bindH, a, b);
        // Edges over 3 mm (surface nets leave some far shorter, whose ratios mean nothing).
        if (bind > 0.003 * W && a < b) ratios.push(edgeLen(posed, a, b) / bind);
      }
      if (faceFlipped(I[i], I[i + 1], I[i + 2]) && !bindFlipped[i / 3]) flipped++;
      const before = area(bindH, I[i], I[i + 1], I[i + 2]);
      if (before > 1e-6 && area(posed, I[i], I[i + 1], I[i + 2]) < before * 0.08) collapsed++;
    }
    const gaps = {};
    for (const [k, s] of Object.entries(SEAMS)) gaps[k] = +((gapOf(posed, s) - bindGap[k]) * 1000).toFixed(1);
    const worstGap = Math.max(...Object.values(gaps));
    ratios.sort((a, b) => a - b);
    const stretch = ratios[Math.floor(ratios.length * 0.999)],
      triangles = I.length / 3;
    report[name] = { stretch: +stretch.toFixed(2), collapsedPerMille: +((collapsed / triangles) * 1000).toFixed(2), flippedPerMille: +((flipped / triangles) * 1000).toFixed(2), worstGapMm: worstGap };
    // Skin stretches over a raised arm or a drawn-up knee; edges that grow many times over are a joint
    // tearing open. Triangles folding inside a bent knee or elbow are skin meeting skin (allowed, bounded);
    // in a twist (the torso, the head, a turned wrist) they are candy-wrapping and must not happen.
    t.assert(stretch < 8, `${name}: the most stretched edges grow ${stretch.toFixed(2)}x (a joint tearing open)`);
    t.assert(collapsed / triangles < 0.001, `${name}: ${collapsed} triangles collapse (pinching at a joint)`);
    const twist = /twist/i.test(name);
    t.assert(flipped / triangles < (twist ? 0.001 : 0.015), `${name}: ${flipped} triangles fold over${twist ? ' (candy-wrapping)' : ''}`);
    t.assert(worstGap < 8, `${name}: a seam opens by ${worstGap} mm (${JSON.stringify(gaps)})`);
  }
  t.note('pose set: ' + JSON.stringify(report));
  // The shader patch's anchors in three.js's chunks.
  const shader = { uniforms: {}, vertexShader: Three.ShaderLib.standard.vertexShader, fragmentShader: Three.ShaderLib.standard.fragmentShader };
  api.pbMaterialPatch(shader);
  for (const [key, where] of [
    ['vec3 objectNormal = pbQRot', 'vertexShader'],
    ['vec3 transformed = pbQRot', 'vertexShader'],
    ['pbFace( vPbBind', 'fragmentShader'],
    ['pbDenim( vPbBind', 'fragmentShader'],
    ['pbSkinWrap * vPbAO', 'fragmentShader'],
    ['roughnessFactor = pbRough', 'fragmentShader'],
    ['vec2 dH = vec2', 'fragmentShader'],
    ['indirectDiffuse *= pbAO', 'fragmentShader'],
  ])
    t.assert(shader[where].includes(key), `player body patch: "${key}" missing from the ${where}`);
  const depth = { uniforms: {}, vertexShader: Three.ShaderLib.depth.vertexShader, fragmentShader: '' };
  api.pbDepthPatch(depth);
  t.assert(depth.vertexShader.includes('vec3 transformed = pbQRot'), 'player body depth patch: skinning missing');
}
