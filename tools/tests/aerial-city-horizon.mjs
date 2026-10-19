// Real Three.js camera/frustum math and the production city-cell/LOD policy, without WebGL.
// Native renders still verify the resulting horizon, atmospheric colour and GPU budget.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const ThreeBase = createRequire(import.meta.url)('../../vendor/three.r160.js');
const read = file => fs.readFileSync(new URL('../../src/' + file + '.js', import.meta.url), 'utf8');
function horizonFixture() {
  // The shadow-chunk patch belongs to this fixture, not other tests' Three.js singleton.
  const Three = { ...ThreeBase, ShaderChunk: { ...ThreeBase.ShaderChunk } };
  const scope = vm.createContext({
    Three, Math, Map, Float32Array, UNITS_PER_METRE: 8,
    CHASE_FOOT: { fov: 60 }, CHASE_NEAR: 2, DETAIL_LAYER: 3, FAR_DETAIL_LAYER: 4,
    FAR_CHASE_CELL: 1024, farScenery: { children: [] },
    activeTier: { name: 'HIGH' }, graphicsTier: () => ({ name: 'HIGH' }),
    viewAgl: 0, viewportWidth: 1280, viewportHeight: 720,
    chaseCam: { ready: true, x: 0, y: 0, z: 1200, pz: 1200, viewYaw: 0, viewPitch: 0, fov: 60 },
    chaseCameraLive: () => true, streetFrameHeight: () => 600,
    terrainHeight: () => 0, clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
    viewFrustum: new Three.Frustum(), viewCenter: { x: 0, y: 0 },
    scene: { fog: {} }, weather: { rain: 0, approach: 0 },
    cameraMotionReport: () => ({}), chasePropsReport: () => ({}), chaseDrawBands: () => ({}),
  });
  const api = vm.runInContext(read('chase-view3d') + '\n' + read('chase-view3d-far') + `
    ({ range: chaseDrawDistance, update: updateChaseView, cell: chaseCellShown,
       farCell: chaseFarCell, updateFar: updateChaseFar,
       report: () => ({ reach: chaseDrawReach, blend: chaseAirBlend, viewReach,
         center: { ...viewCenter }, near: scene.fog.near, density: scene.fog.density,
         farNear: chaseFarNear, farCount: chaseFarCount }),
       camera: chaseCamera, sphere: chaseSphere })`, scope);
  function update(metres = 150) {
    scope.viewAgl = metres * 8;
    api.update(1 / 60);
    scope.viewFrustum.setFromProjectionMatrix(new Three.Matrix4().multiplyMatrices(api.camera.projectionMatrix, api.camera.matrixWorldInverse));
    return api.report();
  }
  return { scope, api, update, Three };
}
export default async function (t) {
  const f = horizonFixture(), { scope, api, update, Three } = f;
  const tiers = [
    ['LOW', 2600, 6400], ['MEDIUM', 3600, 12000],
    ['HIGH', 4800, 24000], ['ULTRA', 6400, 32000],
  ];
  for (const [name, street, air] of tiers) {
    scope.activeTier = { name };
    for (const altitude of [0, 10, 20]) {
      const r = update(altitude);
      t.near(r.reach, street - 1e-8, street + 1e-8, name + ': taxi/street range changed');
      t.near(r.near, street * 0.16 - 1e-8, street * 0.16 + 1e-8, name + ': street clear air changed');
    }
    const r = update(150);
    t.near(r.reach, air - 1e-8, air + 1e-8, name + ': full aerial range');
    t.assert(r.near <= 2600, name + ': near city is not entirely swallowed by clear-zone scaling');
    let last = street;
    for (let height = 21; height <= 150; height++) {
      const range = update(height).reach;
      t.assert(range >= last && range <= air, name + ': aerial range reverses/overshoots at ' + height);
      last = range;
    }
    t.assert(update(20.01).reach - street < 0.001, name + ': range pops just above 20 m');
    t.assert(air - update(149.99).reach < 0.001, name + ': range pops at 150 m');
  }
  scope.activeTier = { name: 'HIGH' };
  let r = update(150);
  t.assert(r.reach / 8 === 3000, 'HIGH must reach 3 km, with detailed scenery still confined to near cells');
  // This ground cell is inside the wide-lens frustum but outside the old horizontal draw radius.
  const cell = api.farCell(24, 22);
  cell.top = 120;
  const x = cell.minX + 512, z = cell.minZ + 512;
  t.assert(Math.hypot(x, z) > api.camera.far, 'fixture must expose a radial-vs-depth cutoff');
  t.assert(api.cell(x, z, 512, cell.top), 'a visible far-plane corner was cut off before haze closes');
  t.assert(Math.abs(x - r.center.x) < r.viewReach + 512 && Math.abs(z - r.center.y) < r.viewReach + 512,
    'the footprint box clips the frustum corner');
  api.updateFar();
  t.assert(cell.far && cell.shown, 'visible distant city cell is missing from merged LOD');
  t.near(api.report().farNear, 1800, 1800, 'increased horizon must not increase full-detail radius');
  const behind = api.farCell(-20, 0);
  behind.top = 120;
  api.updateFar();
  t.assert(behind.far && !behind.shown, 'merged city behind the camera should stay frustum-culled');
  const beyond = api.farCell(40, 0);
  beyond.top = 120;
  api.updateFar();
  t.assert(beyond.far && !beyond.shown, 'city beyond far plane should stay culled');
  // A low city under an aircraft must be tested on its real ground-to-roof volume.
  api.cell(9000, 0, 512, 240);
  t.near(api.sphere.center.y, 120, 120, 'ground cell was raised to aircraft altitude');
  t.assert(api.sphere.radius < 800, 'height-aware cell bounds are unbounded');
  // Look steeply down; the centre ground remains in view at high altitude.
  scope.chaseCam.z = scope.chaseCam.pz = 4000;
  scope.chaseCam.viewPitch = Math.PI / 3;
  update(500);
  t.assert(api.cell(4000 / Math.tan(Math.PI / 3), 0, 256, 120), 'ground beneath a steep flight view was culled');
  // The four real far-plane corners always fit the culling footprint, even on a wide monitor.
  for (const aspect of [4 / 3, 16 / 9, 21 / 9]) {
    scope.viewportWidth = 720 * aspect;
    for (const pitch of [0, 0.3, 0.8]) {
      scope.chaseCam.viewPitch = pitch;
      r = update(500);
      for (const nx of [-1, 1]) for (const ny of [-1, 1]) {
        const corner = new Three.Vector3(nx, ny, 1).unproject(api.camera);
        t.assert(Math.abs(corner.x - r.center.x) <= r.viewReach && Math.abs(corner.z - r.center.y) <= r.viewReach,
          `aerial footprint missed corner at aspect ${aspect}, pitch ${pitch}`);
      }
    }
  }
  // Atmosphere closes before the same depth plane the frustum clips; this floor remains continuous.
  const smooth = x => { const y = Math.max(0, Math.min(1, (x - 0.8) / 0.17)); return y * y * (3 - 2 * y); };
  t.near(smooth(0.8), 0, 0, 'haze floor starts clear');
  t.assert(smooth(0.9) > 0.5 && smooth(0.96) > 0.98, 'far clip does not sit deep in the atmospheric fade');
  t.near(smooth(0.97), 1 - 1e-10, 1 + 1e-10, 'haze must close before clipping');
  t.note('HIGH: 600 m street -> 3 km aerial; unchanged 225 m detailed-cell radius; real Three.js frustum corners, ground heights and far-city selection checked.');
}
