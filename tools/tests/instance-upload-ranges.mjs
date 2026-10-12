// Real Three.js attributes and its shipped WebGLAttributes uploader: bounded traffic lights, partial uploads,
// and persistent decals surviving several skipped draws. No browser/GPU timing claims are made by this test.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const read = (file) => fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
function functionsFrom(file, names, env) {
  const source = read(file);
  const code = names.map(name => {
    const start = source.indexOf('      function ' + name + '(');
    if (start < 0) throw new Error('Missing production function: ' + name);
    const tail = source.slice(start);
    const end = tail.indexOf('\n      }');
    if (end < 0) throw new Error('Missing function end: ' + name);
    return tail.slice(0, end + 8);
  }).join('\n');
  return new Function(...Object.keys(env), code + '\nreturn {' + names.join(',') + '};')(...Object.values(env));
}
const threeSource = read('vendor/three.r160.js');
const uploaderSource = threeSource.slice(threeSource.indexOf('\tfunction WebGLAttributes('), threeSource.indexOf('\n\tclass PlaneGeometry'));
const WebGLAttributes = new Function(uploaderSource + '\nreturn WebGLAttributes;')();

function gpu(isWebGL2) {
  let bound, bytes = 0;
  const gl = {
    FLOAT: 5126,
    createBuffer: () => ({}),
    bindBuffer: (_, buffer) => { bound = buffer; },
    bufferData: (_, data) => { bound.data = data.slice(); },
    bufferSubData: (_, offset, data, start = 0, count = data.length) => {
      const changed = data.subarray(start, start + count);
      bound.data.set(changed, offset / data.BYTES_PER_ELEMENT);
      bytes += changed.byteLength;
    },
  };
  const attributes = WebGLAttributes(gl, { isWebGL2 });
  return {
    upload(list) {
      bytes = 0;
      for (const attribute of list) attributes.update(attribute, 34962);
      return bytes;
    },
    contents: attribute => attributes.get(attribute).buffer.data,
  };
}
const attributesOf = mesh => [mesh.instanceMatrix, mesh.instanceColor].filter(Boolean);
const mesh = (capacity, color = true) => {
  const m = new Three.InstancedMesh(new Three.BoxGeometry(), new Three.MeshBasicMaterial(), capacity);
  m.count = 0;
  if (color) m.setColorAt(0, new Three.Color());
  return m;
};

export default async function (t) {
  for (const webgl2 of [false, true]) {
    const upload = gpu(webgl2);
    const decal = functionsFrom('src/damage3d-decals.js', ['decalLayer', 'writeDecal', 'decalUploadRange', 'flushDecals', 'drawDebris'], {
      Three, scene: new Three.Scene(), decalMaterial: new Three.MeshBasicMaterial(), white: new Three.Color(), scratchColor: new Three.Color(),
      gameTime: 0, clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
      debrisPosition: new Three.Vector3(), debrisScale: new Three.Vector3(), debrisMatrix: new Three.Matrix4(),
    });
    const layer = decal.decalLayer(2400, 3);
    const decalAttributes = [...attributesOf(layer.mesh), layer.tiles, layer.alphas];
    upload.upload(decalAttributes); // First use allocates the full storage, as it should.
    const matrix = new Three.Matrix4().makeTranslation(11, 22, 33);
    decal.writeDecal(layer, 100, matrix, 3, 0.75, '#123456');
    decal.flushDecals(layer);
    t.assert(upload.upload(decalAttributes) === 84, 'one changed decal must upload 84 bytes, not 201,600');
    // Persistent data: flush several times without drawing (e.g. an off-screen/prewarm-skipped pass).
    for (let i = 101; i <= 105; i++) {
      decal.writeDecal(layer, i, matrix.makeTranslation(i, 4, 8), i, 0.5, '#654321');
      decal.flushDecals(layer);
      t.assert(decalAttributes.every(a => a.updateRanges.length === 1), 'skipped draws must keep one bounded pending span');
    }
    t.assert(upload.upload(decalAttributes) === 5 * 84, 'pending decal writes must merge into the changed span');
    for (let i = 100; i <= 105; i++) {
      t.assert(upload.contents(layer.mesh.instanceMatrix)[i * 16 + 12] === (i === 100 ? 11 : i), 'an earlier unrendered decal write was lost');
      t.assert(upload.contents(layer.tiles)[i] === (i === 100 ? 3 : i), 'a pending decal tile was lost');
    }
    // A circular decal pool may wrap while no pass draws it; both ends must survive.
    decal.writeDecal(layer, 2399, matrix.makeTranslation(2399, 0, 0), 9, 1, null);
    decal.flushDecals(layer);
    decal.writeDecal(layer, 0, matrix.makeTranslation(77, 0, 0), 7, 1, null);
    decal.flushDecals(layer);
    upload.upload(decalAttributes);
    t.assert(upload.contents(layer.tiles)[2399] === 9 && upload.contents(layer.tiles)[0] === 7, 'wrapped dirty ranges lost a decal');
    decal.flushDecals(layer);
    t.assert(upload.upload(decalAttributes) === 0, 'unchanged decals should not upload');

    const debris = mesh(700);
    upload.upload(attributesOf(debris));
    const piece = { born: 0, x: 1, y: 2, z: 3, size: 1, q: new Three.Quaternion(), color: new Three.Color('#ff0000') };
    decal.drawDebris(debris, [piece, { ...piece, x: 7 }], 75, false);
    t.assert(upload.upload(attributesOf(debris)) === 152, 'two debris pieces should upload 152 bytes, not 53,200');
    decal.drawDebris(debris, [], 75, false);
    t.assert(debris.count === 0 && upload.upload(attributesOf(debris)) === 0, 'empty debris must hide without uploading');

    const body = mesh(160), boxes = mesh(640), cabins = mesh(640, false);
    const pool = { count: 3, parts: [{ mesh: body }] };
    const impostors = functionsFrom('src/flight-view3d.js', ['endVehicleImpostors'], {
      bodyPools: new Map([['sedan', pool]]), impostorBodies: boxes, impostorCabins: cabins, impostorCount: 5,
    });
    const impAttributes = [...attributesOf(body), ...attributesOf(boxes), ...attributesOf(cabins)];
    upload.upload(impAttributes);
    impostors.endVehicleImpostors();
    t.assert(upload.upload(impAttributes) === 928, '3 body and 5 box impostors should upload 928 bytes, not 101,760');
    // Repacking repeatedly before the next GPU pass must not add another range for every frame.
    for (let frame = 0; frame < 100; frame++) { pool.count = 3; impostors.endVehicleImpostors(); }
    t.assert(impAttributes.every(a => a.updateRanges.length === 1), 'repacked impostor ranges grew while no draw consumed them');
    t.assert(upload.upload(impAttributes) === 928, 'deferred impostor draw uploads the current packed prefix once');

    // Dense traffic: the first four cars use analytic headlamps, but all cars still need tail glows.
    const headBeams = mesh(160), tailGlows = mesh(160), strobeGlows = mesh(160);
    const vehicles = Array.from({ length: 170 }, (_, i) => ({ x: i, y: 0, a: 0, ai: true, hp: 100, analytic: i < 4 }));
    const stats = {};
    const lampAttributes = [...attributesOf(headBeams), ...attributesOf(tailGlows), ...attributesOf(strobeGlows)];
    upload.upload(lampAttributes);
    const lighting = functionsFrom('src/lighting3d-vehicle-lights.js', ['updateHeadlightBeams', 'forwardSpeed'], {
      vehicles, headBeams, tailGlows, strobeGlows, BEAM_CAPACITY: 160, STROBE_GLOW_CAPACITY: 64, CAR_LAMP_SLOTS: 4,
      lookSwitchState: { vehicleLights: true, carLamps: true, terrainBeams: false }, weather: { wet: 0 },
      activeTier: { carLamps: 4 }, vehicleLampAmount: () => 1, pickCarLamps: () => {}, carLampCount: 4,
      carLampCars: vehicles.slice(0, 4), carLampFlood: [], slotFrames: Array.from({ length: 4 }, () => ({})),
      carLampA: Array.from({ length: 4 }, () => new Three.Vector4()), carLampB: Array.from({ length: 4 }, () => new Three.Vector4()),
      carLampC: Array.from({ length: 4 }, () => new Three.Vector4()), CAR_LAMP_STRENGTH: 1, LIGHT_BAR_SHARE: 1,
      horizonRefreshed: 0, horizonComputed: 0, modelLampMount: () => null,
      vehicleSpec: () => ({ w: 12, l: 24 }), isAircraft: () => false, player: { car: null },
      lowBeamShare: () => 1, entityInView: () => true, hasCarLamp: c => c.analytic,
      headlightFrame: () => ({ x: 0, y: 0, z: 0, height: 4, sinPitch: 0, sinRoll: 0, cosRoll: 1 }), driveFrame: {},
      setBodyMatrix: (m, c) => m.makeTranslation(c.x, 0, 0), beamMatrix: new Three.Matrix4(), beamColor: new Three.Color(),
      HEAD_BEAM_LENGTH: 100, HEAD_BEAM_WIDTH: 30, headBeamPeak: 1, DRIVE_LIGHT_POWER: 4.5,
      carLampStats: stats, updateBeamHaze: () => {}, updateBeamShadows: () => {},
      cityLightUniforms: { cityCarLampCount: {}, cityDrivePower: {}, cityDriveRect: { value: new Three.Vector4() } },
      viewReach: 400, viewCenter: { x: 0, y: 0 }, DRIVE_MAP_SIZE: 1024,
      driveCamera: new Three.OrthographicCamera(), driveClearColor: new Three.Color(), driveTarget: {}, driveScene: {},
      renderer: { getRenderTarget() {}, getClearAlpha: () => 1, getClearColor() {}, setClearColor() {}, setRenderTarget() {}, clear() {}, render() {} },
    });
    lighting.updateHeadlightBeams();
    t.assert(tailGlows.count === 160 && headBeams.count === 156, 'analytic lamps allowed the 160-instance tail buffer to overflow');
    t.assert([headBeams, tailGlows, strobeGlows].every(m => m.count <= m.instanceMatrix.count), 'an instanced lamp draw exceeds its GPU storage');
    t.assert(upload.upload(lampAttributes) === (160 + 156) * 76, 'lamp uploads must follow their active instance counts');
    t.assert(upload.contents(tailGlows.instanceMatrix)[159 * 16 + 12] === 159, 'the final valid tail glow lost its transform');
    vehicles.splice(3);
    lighting.updateHeadlightBeams();
    t.assert(upload.upload(lampAttributes) === 3 * 76, 'three analytic cars need only 228 bytes of tail uploads');
    t.assert(stats.tails === 3 && stats.driveHeads === 0, 'analytic headlamps lost their tail glow');

    const beamHaze = mesh(12);
    const haze = functionsFrom('src/lighting3d-vehicle-lights.js', ['updateBeamHaze'], {
      activeTier: { bloom: 6 }, weather: { rain: 0.8, cloud: 0, wet: 0 }, carLampCount: 2,
      carLampCars: vehicles, carLampC: [new Three.Vector4(), new Three.Vector4()], carLampFlood: [],
      slotFrames: [{ fwd: 1, height: 4 }, { fwd: 1, height: 4 }], MOUNTAIN_AIR: 0.5, LIGHT_BAR_SHARE: 1,
      clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)), hazePeak: 0, beamHaze,
      setBodyMatrix: (m, c) => m.makeTranslation(c.x, 0, 0), beamMatrix: new Three.Matrix4(), beamColor: new Three.Color(),
      HEAD_BEAM_LENGTH: 100, HEAD_BEAM_WIDTH: 30, lowBeamShare: () => 1,
      carLampStats: {}, hazeUniforms: { uTime: {} }, gameTime: 0,
    });
    upload.upload(attributesOf(beamHaze));
    haze.updateBeamHaze(1);
    t.assert(beamHaze.count === 2 && upload.upload(attributesOf(beamHaze)) === 152, 'two haze sheets should upload only their live prefix');
    haze.updateBeamHaze(0);
    t.assert(!beamHaze.visible && upload.upload(attributesOf(beamHaze)) === 0, 'unlit haze should hide without uploading');

    for (const m of [layer.mesh, debris, body, boxes, cabins, headBeams, tailGlows, strobeGlows, beamHaze]) {
      m.geometry.dispose();
      m.material.dispose();
    }
    t.note(`WebGL${webgl2 ? 2 : 1}: decal 201600 -> 84 B; debris 53200 -> 152 B; impostors 101760 -> 928 B; dense tail draw capped at 160`);
  }
}
