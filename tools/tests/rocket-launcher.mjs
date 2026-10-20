// Host-only checks for the downloaded RPG: source identity/materials, physical size, fitted hands,
// shared instanced near/far selection and the real drawHold/arm IK through aim, recoil and reload.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

export default async function (t) {
  const Three = createRequire(import.meta.url)(path.join(ROOT, 'vendor/three.r160.js'));
  const bin = fs.readFileSync(path.join(ROOT, 'assets/rocket-launcher-model.bin'));
  const ASSETS = { rocketLauncherModel: 'data:application/octet-stream;base64,' + bin.toString('base64') };
  const source = read('src/rocket-launcher3d.js');
  const rig = read('src/character-rig3d.js').match(/const RIG = \{[\s\S]*?\n {6}\};/)[0];
  const weapons = read('src/character-rig3d-weapons.js').match(/const WEAPON_HOLDS = \{[\s\S]*?\n {6}\};/)[0];
  const draw = read('src/crowd3d-draw.js');
  const holds = draw.match(/const HOLD_POSES = \{[\s\S]*?\n {6}\};/)[0];
  const drawHold = draw.slice(draw.indexOf('function drawHold('), draw.indexOf('      /**\n       * How far the player'));
  const ik = read('src/crowd3d-poses.js');
  const ikArm = ik.slice(ik.indexOf('const ikS ='), ik.indexOf('      /* Leg IK'));
  const api = new Function('Three', 'ASSETS', `
    const PB_UNITS = 8, WEAPON_SCALE = 1.2, clamp = (x,a,b) => Math.max(a,Math.min(b,x));
    function cityMaterialPatch() {} ${rig} ${weapons} ${holds}
    const BODY_STREET = {}, BODY_CLOSE = {}; let BODY = BODY_STREET;
    const WEAPON_SCALE_OF = weapon => weapon === 'shield' ? 1 : WEAPON_SCALE;
    const P = { rocket: {}, rocketFar: {}, pistol: {} }, WEAPON_PAINTS = {rocket: [],pistol:[]};
    ${source} ${read('src/player-body3d-grips.js')}
    const mAim = new Three.Matrix4(), mIdentity = new Three.Matrix4(), mGun = new Three.Matrix4(), mOut = new Three.Matrix4();
    const crowdScale = new Three.Vector3(), crowdEuler = new Three.Euler(0,0,0,'YXZ'), local = new Three.Matrix4();
    const mShoulder = [new Three.Matrix4(), new Three.Matrix4()], mElbow = mShoulder.map(() => new Three.Matrix4()), mHand = mShoulder.map(() => new Three.Matrix4());
    const shoulderWorld = [new Three.Vector3(),new Three.Vector3()], armTargets = shoulderWorld.map(() => new Three.Vector3());
    const handFrames = mShoulder.map(() => new Three.Matrix4()), holdVec2 = new Three.Vector3(), holdPole = new Three.Vector3();
    function rigEmit() {}
    function crowdJoint(out,parent,x,y,z,rz=0,rx=0,ry=0) {
      crowdEuler.set(rx,ry,rz,'YXZ'); local.makeRotationFromEuler(crowdEuler); local.setPosition(x,y,z); return out.multiplyMatrices(parent,local);
    }
    ${ikArm} ${drawHold}
    return { rocketLauncherData, rocketLauncherGeometry, rocketLauncherMaterial, pbGripsFor, PB_FIST, P,
      select: (hero,near) => { BODY=near?BODY_CLOSE:BODY_STREET; return rigWeaponPart('rocket',hero); },
      pose: (height,yaw,recoil,reload) => {
        const hold=HOLD_POSES.rocket, H=height/1.75;
        const aim=new Three.Matrix4().makeRotationY(-yaw).scale(new Three.Vector3(H,H,H));
        const hips=new Three.Matrix4().makeTranslation(0,RIG.hip*H,0);
        const torso=crowdJoint(new Three.Matrix4(),hips,0,RIG.waist*H,0,hold.lean,0,hold.twist);
        for(let side=0;side<2;side++) crowdJoint(mShoulder[side],torso,0,RIG.shoulderY*H,(side?1:-1)*RIG.shoulderZ[0]*1.04*H);
        // Compare poses in the same aim heading (the real shoulders turn with the body).
        for(let side=0;side<2;side++) mShoulder[side].premultiply(new Three.Matrix4().makeRotationY(-yaw));
        drawHold({x:0,y:0},{yaw},{weapon:'rocket',rim:true,recoil,reload},hold,H,0,RIG.hip,1,true);
        return {gun:mGun.clone(),hands:mHand.map(m=>m.clone()),elbows:mElbow.map(m=>m.clone()),shoulders:shoulderWorld.map(v=>v.clone()),reach:(RIG.upperArm+RIG.forearm)*H};
      }
    };
  `)(Three, ASSETS);
  const data = api.rocketLauncherData(), header = data.header;
  t.assert(header.author === 'Polyte' && header.licence === 'CC-BY-4.0' && header.source.includes('de967b52c9794d2995d4606749fcdff7'), 'source and redistribution licence retained');
  const provenance = JSON.parse(read('docs/audit/military-combat-review-2026-10-20/bazooka-source.json'));
  t.assert(crypto.createHash('sha256').update(bin).digest('hex') === provenance.assetSHA256, 'shipped mesh matches provenance hash');
  const near = api.rocketLauncherGeometry(), far = api.rocketLauncherGeometry('far');
  t.assert(near.index.count / 3 === 3500 && near.attributes.position.count === 8814 && header.sourceMeshes === 22, 'every source near triangle and split-normal vertex retained');
  t.assert(far.index.count / 3 <= 700 && far.index.count < near.index.count / 4, 'far source-derived mesh has a bounded small triangle budget');
  t.assert(near.attributes.position.array !== far.attributes.position.array, 'far LOD has separate immutable source storage');
  for (const geometry of [near, far]) {
    for (const name of ['position', 'normal', 'color', 'rocketFinish']) {
      const attr = geometry.attributes[name];
      t.assert(attr.count === geometry.attributes.position.count, name + ' length matches positions');
      t.assert(attr.array.every(Number.isFinite), name + ' finite');
    }
    t.assert(geometry.index.array.every(v => v < geometry.attributes.position.count), 'all triangle indices in bounds');
    for (let i = 0; i < geometry.attributes.normal.count; i++) {
      const normal = new Three.Vector3().fromBufferAttribute(geometry.attributes.normal, i);
      t.assert(Math.abs(normal.length() - 1) < 0.001, 'authored source unit normal');
    }
    // No palette approximation: source glTF material factors survive as linear vertex fields.
    for (let i = 0; i < geometry.attributes.color.count; i++) {
      const color = new Three.Vector3().fromBufferAttribute(geometry.attributes.color, i);
      const finish = new Three.Vector2().fromBufferAttribute(geometry.attributes.rocketFinish, i);
      const matches = header.materials.some(m => {
        const p = m.pbrMetallicRoughness;
        return color.distanceTo(new Three.Vector3(...p.baseColorFactor)) < 1e-6 && Math.abs(finish.x - (p.roughnessFactor ?? 1)) < 1e-6 && Math.abs(finish.y - (p.metallicFactor ?? 1)) < 1e-6;
      });
      t.assert(matches, 'exact source PBR material retained');
    }
  }
  const anchors = header.anchors;
  t.assert(Math.abs((anchors.tubeExit[0] - anchors.backblast[0]) / 8 - 0.95) < 1e-6, 'unloaded tube is real-size 0.95 m');
  t.assert((anchors.roundTip[0] - anchors.backblast[0]) / 8 > 1.25 && (anchors.roundTip[0] - anchors.backblast[0]) / 8 < 1.31, 'loaded model has adult scale');
  t.assert(anchors.roundTip[0] > anchors.tubeExit[0] && anchors.backblast[0] < 0 && anchors.tubeExit[1] > 0, 'loaded round and muzzle face +x; venturi faces rear -x above the grip');
  const grips = api.pbGripsFor('rocket');
  for (const [frame, anchor, side] of [[grips.fire[1], anchors.fire, 1], [grips.support, anchors.support, 0]]) {
    const fist = new Three.Vector3(0, api.PB_FIST[1] * 8, (side ? 1 : -1) * api.PB_FIST[2] * 8).applyMatrix4(frame);
    t.assert(fist.distanceTo(new Three.Vector3(...anchor)) < 1e-6, 'actual closed fist lands on source grip axis');
    t.assert(Math.abs(frame.determinant() - 1) < 1e-6, 'hand frame has no scale or reflection');
    let distance = Infinity;
    const a = new Three.Vector3(), b = a.clone(), c = a.clone(), closest = a.clone(), triangle = new Three.Triangle();
    const wood = header.materials[5].pbrMetallicRoughness.baseColorFactor;
    for (let i = 0; i < near.index.count; i += 3) {
      const ia = near.index.getX(i);
      if (Math.abs(near.attributes.color.getX(ia) - wood[0]) > 1e-6) continue;
      triangle.set(a.fromBufferAttribute(near.attributes.position, ia), b.fromBufferAttribute(near.attributes.position, near.index.getX(i+1)), c.fromBufferAttribute(near.attributes.position, near.index.getX(i+2)));
      triangle.closestPointToPoint(fist, closest);
      distance = Math.min(distance, closest.distanceTo(fist));
    }
    t.assert(distance > 0.03 && distance < 0.22, 'fist encloses the authored wooden grip (surface within a human grip radius)');
  }
  for (const height of [1.6, 1.81, 1.9]) for (const yaw of [0, 0.7, 3.1]) for (const [recoil,reload] of [[0,-1], [1,-1], [0,0.25], [0,0.5], [0,0.75], [0,1]]) {
    const pose = api.pose(height,yaw,recoil,reload);
    for (let side=0;side<2;side++) {
      const wrist = new Three.Vector3().setFromMatrixPosition(pose.hands[side]);
      t.assert(wrist.distanceTo(pose.shoulders[side]) < pose.reach, 'adult arms reach both grips through aim/recoil/reload');
      t.assert(pose.hands[side].elements.every(Number.isFinite), 'held hand pose finite');
    }
  }
  t.assert(api.select(true,false) === api.P.rocket && api.select(false,true) === api.P.rocket && api.select(false,false) === api.P.rocketFar, 'hero full source; near and far crowd each use one shared batch');
  const shader = {uniforms:{}, vertexShader:Three.ShaderLib.standard.vertexShader, fragmentShader:Three.ShaderLib.standard.fragmentShader};
  api.rocketLauncherMaterial.onBeforeCompile(shader);
  t.assert(shader.vertexShader.includes('vRocketFinish = rocketFinish;') && shader.fragmentShader.includes('roughnessFactor *= vRocketFinish.x;') && shader.fragmentShader.includes('metalnessFactor *= vRocketFinish.y;'), 'standard shader applies source finishes');
}
