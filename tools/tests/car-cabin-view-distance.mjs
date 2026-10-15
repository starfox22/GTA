// Actual Three.js camera setup, occupant queue and glass patch, without a WebGL context.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const read = name => fs.readFileSync(new URL('../../src/' + name, import.meta.url), 'utf8');

export function cabinDistanceFixture({ zoom = 11, ceiling = 402, inspect = null, queueSource, glassSource } = {}) {
  const cameraSource = read('flight-view3d.js'), crowd = queueSource || read('crowd3d-driveby.js'),
    glass = glassSource || read('cars3d-interior.js'), streetCamera = new Three.OrthographicCamera(-500, 500, 350, -350, 1, 7500);
  const scope = vm.createContext({
    Three, CAR_M: 8, UNITS_PER_METRE: 8, camera: streetCamera, streetCamera,
    viewportWidth: 1000, viewportHeight: 700, worldZoom: zoom, shadeHeight: ceiling - 60, allBuildings: [],
    cameraTarget: { x: 418, y: 7300 }, terrainHeight: () => 20, scene: { fog: {} },
    player: { car: null }, transitRide: false, taxiRide: false, gameTime: 0,
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)), isAircraft: () => false,
    motionComfortOn: () => true, STREET_FOG_DENSITY: 0.0001, cityMaterialPatch() {},
  });
  const prefix = cameraSource.slice(0, cameraSource.indexOf('      // Weather and time of day')),
    queue = crowd.slice(crowd.indexOf('      const OCCUPANT_REACH'), crowd.indexOf('      // The looks of the people')),
    patch = glass.slice(glass.indexOf('      const CAR_GLASS_CLEAR'));
  vm.runInContext(prefix + queue + patch + `
    globalThis.api = { updateFlightView, updateCarViewDistance, carViewEye, carViewSetBack, streetCamera, flightCamera,
      queueCarOccupants, carGlassMaterial, OCCUPANT_CAP, OCCUPANT_REACH,
      inspect(value) { inspectAngles = value; }, useCamera(value) { camera = value; },
      queued() { return occupantCars.slice(0, occupantCount); },
      resetQueue() { occupantCount = 0; },
    };`, scope);
  const api = scope.api;
  api.inspect(inspect);
  const frame = (altitude = 20, flying = false) => {
    api.updateFlightView(1 / 60, altitude, flying);
    scope.camera.updateMatrixWorld(true);
    api.updateCarViewDistance();
  };
  const compileGlass = () => {
    const material = api.carGlassMaterial('#8899aa', 0.35),
      shader = { uniforms: {}, fragmentShader: Three.ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader);
    material.dispose();
    return shader;
  };
  const queueAt = (point, id = 1, extra = {}) => {
    const car = { id, hp: 100, occupied: true, passengers: 0, x: point.x, y: point.z, ...extra },
      model = { group: { visible: true, position: { y: point.y } } };
    api.queueCarOccupants(car, model);
    return car;
  };
  frame();
  return { api, scope, frame, compileGlass, queueAt };
}

// Evaluate the distance term from the production patch, including the archived uncorrected form.
export function cabinGlassDistance(shader, camera, point) {
  const tint = shader.fragmentShader.split('\n').find(line => line.includes('float carGlassTint =')),
    view = point.clone().applyMatrix4(camera.matrixWorldInverse).negate();
  if (tint.includes('length( vViewPosition - vec3( 0.0, 0.0, carViewSetBack ) )'))
    view.z -= shader.uniforms.carViewSetBack.value;
  else assert.ok(tint.includes('length( vViewPosition )'), 'unrecognized production glass distance');
  return view.length();
}

export default async function carCabinViewDistance(t) {
  const near = (a, b, label) => t.assert(Math.abs(a - b) < 1e-8, label + ': ' + a + ' / ' + b),
    point = new Three.Vector3(418, 32, 7300), inspect = { yaw: 65 * Math.PI / 180, pitch: 12 * Math.PI / 180, lift: 4 },
    f = cabinDistanceFixture({ inspect }), { api, scope } = f, shader = f.compileGlass();
  t.assert(shader.uniforms.carViewSetBack === api.carViewSetBack, 'glass must keep the shared per-view uniform object');
  t.assert(shader.fragmentShader.includes('uniform float carViewSetBack;'), 'glass uniform declaration missing');
  t.assert(scope.camera.position.distanceTo(point) > api.OCCUPANT_REACH, 'fixture must reproduce the old physical-eye cull');
  t.assert(api.carViewEye.distanceTo(point) < 24 * 8, 'close inspection must show the clear-glass cabin');
  f.queueAt(point);
  t.assert(api.queued().length === 1, 'the close street occupant must be queued outside the old physical-eye reach');
  near(cabinGlassDistance(shader, scope.camera, point), api.carViewEye.distanceTo(point), 'CPU and glass distance');

  const references = new Map();
  for (const zoom of [0.64, 3, 11]) for (const angles of [null, inspect, { yaw: Math.PI / 2, pitch: 0.35, lift: 18 }]) {
    const key = zoom + '/' + JSON.stringify(angles);
    for (const ceiling of [402, 1800]) {
      const g = cabinDistanceFixture({ zoom, ceiling, inspect: angles }), s = g.compileGlass(), camera = g.scope.camera,
        forward = camera.getWorldDirection(new Three.Vector3()),
        target = new Three.Vector3(418, 20 + (angles?.lift || 0), 7300),
        expected = target.clone().addScaledVector(forward, -Math.hypot(680, 560) / zoom),
        clips = [camera.near, camera.far, ...camera.projectionMatrix.elements];
      near(g.api.carViewEye.distanceTo(expected), 0, 'original street eye at every zoom/inspection');
      g.api.updateCarViewDistance();
      t.assert(JSON.stringify(clips) === JSON.stringify([camera.near, camera.far, ...camera.projectionMatrix.elements]),
        'visibility correction changed the actual clip/projection setup');
      for (const offset of [[0, 0, 0], [90, 6, -40], [0, 0, 500]]) {
        const sample = point.clone().add(new Three.Vector3(...offset)),
          distance = g.api.carViewEye.distanceTo(sample);
        near(cabinGlassDistance(s, camera, sample), distance, 'off-axis CPU/shader agreement');
        const ref = key + '/' + offset;
        if (references.has(ref)) near(distance, references.get(ref), 'roof-setback invariance');
        else references.set(ref, distance);
      }
      // Keep the final camera kick/pixel-lock translation in both consumers.
      camera.position.x += 3.25; camera.position.z -= 2.75; camera.updateMatrixWorld(true);
      g.api.updateCarViewDistance();
      near(cabinGlassDistance(s, camera, point), g.api.carViewEye.distanceTo(point), 'final-camera translation');
    }
  }

  const bounds = cabinDistanceFixture(), pane = bounds.compileGlass(), eye = bounds.api.carViewEye;
  const tintAt = distance => {
    const x = Math.min(1, Math.max(0, (distance - 24 * 8) / (12 * 8))), smooth = x * x * (3 - 2 * x);
    return 0.35 + (0.92 - 0.35) * smooth;
  };
  for (const [metres, queued, tint] of [[23, true, 0.35], [30, true, 0.635], [36.1, true, 0.92], [37.1, false, 0.92]]) {
    bounds.api.resetQueue();
    const sample = eye.clone().add(new Three.Vector3(metres * 8, 0, 0));
    bounds.queueAt(sample);
    t.assert((bounds.api.queued().length === 1) === queued, 'occupant range changed at ' + metres + ' m');
    near(tintAt(cabinGlassDistance(pane, bounds.scope.camera, sample)), tint, 'glass fade at ' + metres + ' m');
  }
  bounds.api.resetQueue();
  for (let i = 0; i < 32; i++) bounds.queueAt(eye.clone().add(new Three.Vector3((31 - i) * 8, 0, 0)), i + 1);
  t.assert(bounds.api.queued().length === 16 && bounds.api.OCCUPANT_CAP === 16, 'occupant cap changed');
  t.assert(bounds.api.queued().every(c => c.id >= 17), 'nearest sixteen cars were not retained');
  const own = { id: 100, hp: 100, x: eye.x + 30 * 8, y: eye.z };
  bounds.scope.player.car = own;
  bounds.api.queueCarOccupants(own, { group: { visible: true, position: { y: eye.y } } });
  t.assert(bounds.api.queued().includes(own) && bounds.api.queued().length === 16, 'player priority or cap changed');

  // Reuse an already-compiled pane while every perspective camera takes over.
  for (const mode of ['aircraft', 'chase', 'ride']) {
    f.frame();
    t.assert(api.carViewSetBack.value > 0, 'street correction must be active before ' + mode);
    if (mode === 'aircraft') f.frame(980, true);
    else {
      const camera = new Three.PerspectiveCamera(55, 1.4, 2, 9000);
      camera.position.set(400, 60, 7280); camera.lookAt(418, 32, 7300); camera.updateMatrixWorld(true);
      api.useCamera(camera); api.updateCarViewDistance();
    }
    t.assert(api.carViewSetBack.value === 0 && shader.uniforms.carViewSetBack.value === 0, mode + ' retained the street glass offset');
    near(api.carViewEye.distanceTo(scope.camera.position), 0, mode + ' changed the real distance eye');
    near(cabinGlassDistance(shader, scope.camera, point), scope.camera.position.distanceTo(point), mode + ' changed glass distance');
  }
  const frame = read('render3d-frame.js'), cameraEnd = frame.indexOf('camera.updateMatrixWorld(true);');
  t.assert(cameraEnd > frame.indexOf('updateParkCamera(') &&
    frame.indexOf('updateCarViewDistance();') > cameraEnd && frame.indexOf('updateCarViewDistance();') < frame.indexOf('updateSceneryPools();'),
    'shared distance must update after all camera overrides/kick/pixel lock and before rendering');
  t.note('Production street camera/occupant/glass: roof-setback invariance, inspection, final-camera translation, fade/range bounds, nearest16/player priority, and immediate aircraft/chase/ride reset');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let checks = 0;
  await carCabinViewDistance({ assert(value, message) { checks++; assert.ok(value, message); }, note: console.log });
  console.log('PASS car-cabin-view-distance: ' + checks + ' host assertions');
}
