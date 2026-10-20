// Real Three.js Apache source decoder/rig/LOD/PBR and exact BVH parity, no browser or GPU.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
export default async function(t) {
  const pack = fs.readFileSync(new URL('../../assets/apache-model.bin', import.meta.url)),
    read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'),
    player = { x: 0, y: 0, car: null }, scene = new Three.Scene(), activeTier = { lodBias: 1 },
    scope = vm.createContext({ Three, Uint8Array, Uint32Array, Float32Array, DataView, TextDecoder,
      atob: s => Buffer.from(s, 'base64').toString('binary'), console, scene, player, activeTier, UNITS_PER_METRE: 8,
      ASSETS: { apacheModel: 'data:application/octet-stream;base64,' + pack.toString('base64') },
      sharedGeometries: new Set(), sharedMaterials: new Set(), gameTime: 10, TAU: Math.PI * 2,
      clamp: (x, a, b) => Math.max(a, Math.min(b, x)), normalizeAngle: a => Math.atan2(Math.sin(a), Math.cos(a)),
      terrainHeight: () => 0, entityElevation: c => c.altitude || 0,
      apacheBodyPitch: c => Math.max(-.13, Math.min(.13, -(c.speed || 0) * .00035)),
      apacheBodyRoll: c => Math.max(-.1, Math.min(.1, (c.av || 0) * .065)),
      halo(parent, x, y, z) { const sprite = new Three.Group(); sprite.position.set(x, y, z); parent.add(sprite); return sprite; } });
  const api = vm.runInContext(read('apache-assets3d') + read('apache3d') +
    '\n({apacheAssetData,apacheAssetKit,makeApache,animateApache,apacheAssetLod})', scope),
    data = api.apacheAssetData(), kit = api.apacheAssetKit(), model = data.header,
    c = { id: 7, hp: 100, maxhp: 100, color: '#456632', x: 0, y: 0, a: 0, speed: 0, av: 0, altitude: 40,
      arms: { missiles: 8, airMissiles: 4 } }, a = api.makeApache(c), b = api.makeApache({ ...c });
  t.assert(data === api.apacheAssetData() && a.apacheKit === b.apacheKit, 'separate pack and source kit decode only once');
  t.assert(Object.values(kit.parts).every(g => Array.from(g.attributes.position.array).every(Number.isFinite)), 'all source, Far and shadow positions are finite');
  t.assert(a.apacheLodParts.length === 7 && a.apacheLodParts.every((p, i) => p.mesh.geometry === b.apacheLodParts[i].mesh.geometry), 'all instances share exact source geometry');
  t.assert(a.paint !== b.paint && a.apacheLodParts.filter(p => p.name !== 'beacon').every(p => p.mesh.material === a.paint), 'one source PBR wear state per aircraft');
  const count = m => m.apacheLodParts.reduce((n, p) => n + p.mesh.geometry.index.count / 3, 0);
  t.assert(count(a) === 222647 && model.retainedSourceTriangles === 220711, 'all original source faces plus four derived wingtip rounds');
  t.assert(model.rotorRadius === 7.315 && Math.abs(a.rotor.parent.rotation.z + Math.PI / 18) < 1e-12, 'real 14.63m rotor and authored ten-degree mast tilt');
  let shadows = 0; a.group.traverse(o => { if (o.castShadow) { shadows++; t.assert(o.geometry.index.count / 3 <= 5000, 'shadow geometry bounded'); } });
  t.assert(shadows === 1 && a.apacheLodParts.every(p => !p.mesh.castShadow), 'heavy source faces never enter shadow pass');
  for (const p of a.apacheLodParts) {
    const g = p.mesh.geometry;
    for (const n of ['normal','uv','color','apacheFinish','apacheSlot']) t.assert(g.attributes[n].count === g.attributes.position.count, p.name + ' complete source attributes: ' + n);
  }
  const shader = { uniforms: {}, vertexShader: Three.ShaderLib.standard.vertexShader, fragmentShader: Three.ShaderLib.standard.fragmentShader };
  a.paint.onBeforeCompile(shader);
  t.assert(shader.vertexShader.includes('vApacheFinish=apacheFinish') && shader.fragmentShader.includes('roughnessFactor=mix') && shader.fragmentShader.includes('metalnessFactor=mix'), 'actual standard shader preserves source material factors');
  t.assert(shader.fragmentShader.includes('vApacheSlot<12.0') && shader.uniforms.uApacheSpent === a.paint.userData.apacheSource.spent, 'finite payload occupancy wired into source shader');
  t.assert(a.paint.side === Three.DoubleSide && !a.paint.transparent && model.materials[10].alphaMode === undefined, 'authored opaque double-sided glazing encloses cockpit');
  api.animateApache(c, a); a.group.updateMatrixWorld(true);
  const bounds = new Three.Box3();
  a.apacheLodParts.forEach(p => bounds.union(p.mesh.geometry.boundingBox.clone().applyMatrix4(p.mesh.matrixWorld)));
  t.assert(Math.abs(bounds.min.y) < .00001 && bounds.max.y > 59 && bounds.max.y < 60, 'source tyre contacts and tall authored whip antenna retained');
  c.arms.missiles = 5; c.arms.airMissiles = 2; c.speed = 180; c.av = .7; c.turretA = .4; c.gunPitch = -.2;
  api.animateApache(c, a);
  t.assert(a.paint.userData.apacheSource.spent.value.x === 3 && a.paint.userData.apacheSource.spent.value.y === 2, 'release order removes three rack and two wingtip occupants');
  t.assert(a.gunYaw.rotation.y === -.4 && a.gunPitch.rotation.z === -.2 && a.body.rotation.z === -.063 && a.body.rotation.x === .0455, 'source gun and body follow gameplay articulation');
  c.x = 1000; api.apacheAssetLod(c, a);
  t.assert(a.apacheLodFar && count(a) <= 15000, 'distant aircraft swaps every actual part to bounded Far geometry');
  player.car = c; api.apacheAssetLod(c, a);
  t.assert(!a.apacheLodFar && count(a) === 222647, 'player pins the complete source geometry');
  // Compare the custom cached tree against Three.Mesh.raycast over the SAME
  // production geometry, at many angles and at an articulated, banked pose.
  a.group.updateMatrixWorld(true);
  const mesh = a.apacheLodParts.find(p => p.name === 'body').mesh,
    reference = new Three.Mesh(mesh.geometry, mesh.material); reference.matrixAutoUpdate = false; reference.matrixWorld.copy(mesh.matrixWorld);
  const centre = new Three.Vector3(15, 16, 0).applyMatrix4(mesh.matrixWorld), ray = new Three.Raycaster();
  let parityRays = 0, hitRays = 0;
  for (let i = 0; i < 48; i++) {
    const angle = i / 48 * Math.PI * 2, origin = centre.clone().add(new Three.Vector3(Math.cos(angle) * 180, (i % 5 - 2) * 16, Math.sin(angle) * 180));
    ray.set(origin, centre.clone().sub(origin).normalize());
    const fast = ray.intersectObject(mesh, false), slow = ray.intersectObject(reference, false);
    t.assert(fast.length === slow.length, 'exact BVH intersection multiplicity ' + i);
    if (slow.length) { hitRays++; t.assert(Math.abs(fast[0].distance - slow[0].distance) < .00001 && fast[0].faceIndex === slow[0].faceIndex, 'exact BVH nearest source face ' + i); }
    parityRays++;
  }
  t.assert(hitRays > 25, 'BVH parity includes actual aircraft hits');
  const indices = kit.parts.body.index.array.slice(); c.hp = 0; api.animateApache(c, a); c.hp = 100; api.animateApache(c, a);
  t.assert(kit.parts.body.index.array.every((v, i) => v === indices[i]) && a.paint.userData.apacheSource.wear.value.y === 0, 'wreck and repair leave shared source buffers unchanged');
  t.note(JSON.stringify({ apacheAsset: { nearTriangles: 222647, retainedSourceTriangles: 220711,
    farTriangles: Object.entries(model.parts).filter(([k]) => k.endsWith('Far')).reduce((n, [,v]) => n + v.triangles, 0),
    shadowTriangles: model.parts.shadow.triangles, sourceMeshes: 7, parityRays, hitRays, packBytes: pack.length } }));
}
