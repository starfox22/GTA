// Production flight/ground model at 60/120 Hz, with real airport land polygons and full-wing collision boxes.
// This host fixture complements the normal-key parked-aircraft test; it does not stand in for a rendered flight.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { taxiKeys, takeoffKeys } from './aircraft-taxi-takeoff.mjs';
const read = file => fs.readFileSync(new URL('../../src/' + file + '.js', import.meta.url), 'utf8');
const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
function proceduralBounds() {
  const context = vm.createContext({
    Three, Math, Float32Array, Uint32Array, Map, TAU: Math.PI * 2,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    mat: (color, roughness = 0.5, metalness = 0) => new Three.MeshStandardMaterial({ color, roughness, metalness }),
    boxGeo: new Three.BoxGeometry(1, 1, 1), sphereGeo: new Three.SphereGeometry(1, 12, 8),
    cylinderGeo: new Three.CylinderGeometry(1, 1, 1, 10), wheelGeo: new Three.CylinderGeometry(1, 1, 1, 20),
    rubber: new Three.MeshStandardMaterial(), chrome: new Three.MeshStandardMaterial(),
    halo: parent => { const sprite = new Three.Sprite(); parent.add(sprite); return sprite; },
    mesh: (geometry, material, parent, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const mesh = new Three.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
    },
  });
  vm.runInContext(read('plane3d-shapes') + '\n' + read('plane3d-build') +
    '\naircraftLivery = () => ({map:null,finishMap:null}); aircraftLabel = () => null;', context);
  const output = {};
  for (const kind of ['courier', 'airliner']) {
    const group = new Three.Group(), bounds = new Three.Box3(), point = new Three.Vector3();
    context.buildAircraft(kind, group); group.updateMatrixWorld(true);
    let vertices = 0;
    group.traverse(mesh => {
      // Solid source meshes only; labels, halos, light lenses and invisible prop blur do not stop a vehicle.
      if (!mesh.isMesh || !mesh.visible || mesh.material.isMeshBasicMaterial) return;
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) bounds.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld));
      vertices += positions.count;
    });
    output[kind] = { min: bounds.min.toArray(), max: bounds.max.toArray(), vertices };
  }
  return output;
}
export function flightFixture(hz = 60) {
  const scope = vm.createContext({
    Math, UNITS_PER_METRE: 8, METERS_PER_UNIT: 1 / 8, GRAVITY: 9.81 * 8, KMH: 8 / 3.6,
    SENTINEL: { runway: { x: 9000, y: 8000, w: 1000, h: 120 } }, missions: [], vehicles: [],
    keys: {}, player: { car: null }, clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    normalizeAngle: a => Math.atan2(Math.sin(a), Math.cos(a)), terrainHeight: () => 0,
    worldMeters: n => n / 8, entityElevation: c => c.altitude || 0,
    distanceBetween: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    aircraftClearance: c => c.altitude || 0, vehicleCollisionHeight: c => api.AIRFRAME_SPECS[c.airframe || 'courier'].height || 32,
    damageVehicle: (c, damage) => { c.hp -= damage; }, tell: () => {}, keyName: s => s, planeWarnings: () => {},
    actionHeld: id => !!scope.keys[{ forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', ascend: 'KeyT', descend: 'KeyG' }[id]],
    makeCar: (type, x, y, a) => { const c = { id: scope.vehicles.length + 1, type, x, y, a, av: 0, speed: 0, altitude: 0, hp: 250, maxhp: 250 }; scope.vehicles.push(c); return c; },
  });
  const county = read('county-map');
  const api = vm.runInContext(read('geography-regions') + '\n' + county.slice(0, county.indexOf('    // The bridges (county')) + '\n' +
    read('airfields') + '\n' + read('physics-shapes') + '\n' + read('aviation-flight') + '\n' + read('game-player-actions') + '\n' +
    '({ AIRFRAME_SPECS, AIRCRAFT_STANDS, FLIGHT, planeControl, flightSetup, togglePlaneGear, setPlaneFlaps, aircraftClear, aircraftTaxiReport, populateAircraft, addStatic, AIRPORT, AIRPORT_SCENERY_SOLIDS, landAtExact, nearestCar, pointInCar })', scope);
  scope.vehicleSpec = c => api.AIRFRAME_SPECS[c.airframe || 'courier'];
  scope.landAt = api.landAtExact;
  // The same authored airport building footprints used by world generation.
  for (const b of [api.AIRPORT, api.AIRPORT.hangar,
    { x: 3880, y: 8420, w: 670, h: 220 }, { x: 4790, y: 9000, w: 230, h: 200 }, { x: 5310, y: 9000, w: 250, h: 200 }, ...api.AIRPORT_SCENERY_SOLIDS]) {
    api.addStatic(b.x, b.y, b.w, b.h, b.height || 60, b.kind || 'airport building');
  }
  function plane(airframe, x = 418, y = 4420, a = Math.PI / 2) {
    const c = scope.makeCar('plane', x, y, a);
    c.airframe = airframe; c.hp = c.maxhp = api.AIRFRAME_SPECS[airframe].hp;
    scope.player.car = c;
    return c;
  }
  function step(c, seconds, keys = []) {
    scope.player.car = c; scope.keys = Object.fromEntries(keys.map(k => [k, true]));
    for (let i = 0; i < Math.round(seconds * hz); i++) {
      api.planeControl(c, 1 / hz, true);
      c.x += c.vx / hz; c.y += c.vy / hz;
    }
    return c;
  }
  return { scope, api, plane, step, hz };
}
export default async function (t) {
  const performance = [];
  const modelBounds = proceduralBounds(), envelopeFixture = flightFixture();
  const basePlane = vm.runInContext('(' + read('game-vehicles').match(/      plane: ({[\s\S]*?\n      }),/)[1] + ')', envelopeFixture.scope);
  for (const [frame, bounds] of Object.entries(modelBounds)) {
    const spec = envelopeFixture.api.AIRFRAME_SPECS[frame];
    t.assert(bounds.vertices > 10000, frame + ': production solid mesh measurement did not run');
    for (const envelope of frame === 'courier' ? [spec, basePlane] : [spec]) {
      t.assert(bounds.min[0] >= -envelope.l / 2 && bounds.max[0] <= envelope.l / 2 &&
        bounds.min[2] >= -envelope.w / 2 && bounds.max[2] <= envelope.w / 2 &&
        bounds.min[1] >= -1e-6 && bounds.max[1] <= envelope.height,
      `${frame}: a production fin/winglet/solid mesh extends outside its collision envelope: ${JSON.stringify(bounds)}`);
    }
  }
  t.note('actual procedural solid-mesh bounds: ' + JSON.stringify(modelBounds));
  for (const frame of ['skyhawk', 'courier', 'jet', 'airliner']) {
    const entry = flightFixture(), c = entry.plane(frame, 3000, 9000, 0.71), spec = entry.api.AIRFRAME_SPECS[frame];
    entry.scope.player.car = null;
    function beside(gap) {
      const side = spec.w / 2 + gap;
      entry.scope.player.x = c.x - Math.sin(c.a) * side;
      entry.scope.player.y = c.y + Math.cos(c.a) * side;
    }
    beside(18);
    t.assert(!entry.api.pointInCar(entry.scope.player.x, entry.scope.player.y, c, 8), frame + ': entry point must be outside the collision box plus foot radius');
    t.assert(entry.api.nearestCar() === c, frame + ': plane must be reachable from outside the wing collision box');
    beside(24.1);
    t.assert(entry.api.nearestCar() === null, frame + ': plane must not be reachable more than 3 m from its edge');
    beside(18); c.altitude = 3;
    t.assert(entry.api.nearestCar() === null, frame + ': airborne plane must not be reachable from the ground');
    c.altitude = 40;
    t.assert(entry.api.nearestCar() === null, frame + ': elevated plane must not be reachable from a different floor');
    c.altitude = 0; entry.scope.player.parachute = {};
    t.assert(entry.api.nearestCar() === null, 'a parachute must prevent plane boarding');
    entry.scope.player.parachute = null; entry.scope.player.roof = {};
    t.assert(entry.api.nearestCar() === null, 'a roof must retain its boarding restriction');
    entry.scope.player.roof = null;
    for (const type of ['sedan', 'speedboat', 'helicopter']) {
      c.type = type; entry.scope.player.x = c.x + 63; entry.scope.player.y = c.y;
      t.assert(entry.api.nearestCar() === c, type + ': original 64-unit centre reach changed');
      entry.scope.player.x = c.x + 65;
      t.assert(entry.api.nearestCar() === null, type + ': original reach must not expand');
    }
  }
  for (const hz of [60, 120]) {
    const f = flightFixture(hz);
    for (const frame of ['skyhawk', 'courier', 'jet', 'airliner']) {
      // Oceanview is long enough for every frame; this isolates the model's take-off roll.
      const c = f.plane(frame, 5900, 9884, Math.PI);
      let seconds = 0;
      while (!c.altitude && seconds < 50) { f.step(c, 0.1, ['KeyW', 'KeyT']); seconds += 0.1; }
      const roll = (5900 - c.x) / 8, kmh = c.airspeed / (8 / 3.6);
      t.assert(c.altitude > 0 && c.hp === c.maxhp, `${frame}/${hz}: failed to rotate undamaged`);
      const bounds = { skyhawk: [290, 350, 96, 108], courier: [260, 310, 110, 125], jet: [570, 660, 173, 190], airliner: [990, 1110, 203, 220] }[frame];
      t.near(roll, bounds[0], bounds[1], `${frame}/${hz} roll m`);
      t.near(kmh, bounds[2], bounds[3], `${frame}/${hz} rotation km/h`);
      performance.push({ frame, hz, rollM: +roll.toFixed(1), kmh: +kmh.toFixed(1) });
      // A released pitch input trims; holding full back pressure can still stall.
      f.step(c, 5, ['KeyW']);
      t.assert(c.altitude > 0 && Number.isFinite(c.vz), `${frame}: no controlled flight after rotation`);
    }
    f.scope.vehicles.length = 0;
    const trainer = f.plane('skyhawk');
    f.step(trainer, 2, ['KeyD']);
    t.near(trainer.a, Math.PI / 2, Math.PI / 2, 'stationary nosewheel cannot pivot');
    trainer.throttle = trainer.power = 0.15;
    f.step(trainer, 20); const before = trainer.a;
    f.step(trainer, 3, ['KeyD']);
    t.near(trainer.a - before, 1.2, 1.6, 'trainer taxi turn radians');
    f.step(trainer, 10, ['KeyS']);
    t.assert(trainer.speed === 0 && trainer.throttle === 0, 'brake must stop without reversing');
    trainer.altitude = 100; trainer.throttle = trainer.power = 0.7;
    t.assert(f.api.togglePlaneGear(trainer) === false && trainer.gearPos === 1, 'fixed gear must stay down in flight');
    t.assert(f.api.setPlaneFlaps(trainer, 1), 'flaps must extend');
    f.step(trainer, 0.5);
    t.near(trainer.flapPos, 0.19, 0.21, 'flaps move at finite speed');
  }
  const f = flightFixture();
  const trainer = f.plane('skyhawk', 5900, 9884, Math.PI);
  while (!trainer.altitude) f.step(trainer, 0.1, ['KeyW', 'KeyT']);
  f.step(trainer, 200, ['KeyW']);
  t.near(trainer.airspeed / (8 / 3.6), 215, 235, 'piston prop full-power level speed km/h');
  const stall = f.plane('skyhawk', 418, 6000, 0);
  stall.altitude = 500 * 8; stall.vx = 135 * (8 / 3.6); stall.vy = 0; stall.throttle = stall.power = 0;
  let stalled = false;
  for (let i = 0; i < 80; i++) { f.step(stall, 0.1, ['KeyT']); stalled ||= stall.stalled; }
  t.assert(stalled && stall.stallWarning, 'holding the nose up at idle must produce a warned stall');
  f.step(stall, 8, ['KeyW', 'KeyG']);
  t.assert(!stall.stalled && stall.hp === stall.maxhp && stall.altitude > 0, 'lowering the nose must recover a stall with altitude available');
  f.scope.vehicles.length = 0;
  const parkedCourier = f.plane('courier', f.api.FLIGHT.parked.x, f.api.FLIGHT.parked.y, f.api.FLIGHT.parked.a);
  delete parkedCourier.airframe; // county-build creates the base courier without an override.
  f.api.populateAircraft();
  t.assert(f.scope.vehicles.length === 7, 'free-roam planes must restore once each');
  for (const c of f.scope.vehicles) {
    const p = f.api.aircraftTaxiReport(c.id);
    t.assert(p.clear && p.dry && p.taxi.length > 1, `parked full-wing clearance: ${JSON.stringify(p)}`);
  }
  parkedCourier.x = f.api.AIRPORT.hangar.x + 100; parkedCourier.y = f.api.AIRPORT.hangar.y + 50;
  t.assert(!f.api.aircraftClear(parkedCourier), 'clearance fixture must catch a full-wing/building collision');
  const wingProbe = f.plane('skyhawk', 4200, 9160, 0);
  t.assert(!f.api.aircraftClear(wingProbe), 'the parked 737 wingtip must stop an aircraft outside its fuselage');
  wingProbe.y = 9050;
  t.assert(f.api.aircraftClear(wingProbe), 'the empty apron corner ahead of a parked wing must remain open');
  for (let i = 0; i < 7; i++) {
    const routeFixture = flightFixture();
    const { FLIGHT } = routeFixture.api;
    routeFixture.scope.makeCar('plane', FLIGHT.parked.x, FLIGHT.parked.y, FLIGHT.parked.a);
    routeFixture.api.populateAircraft();
    const c = routeFixture.scope.vehicles[i];
    let p = routeFixture.api.aircraftTaxiReport(c.id), seconds = 0;
    for (const target of p.taxi) while (Math.hypot(p.x - target.x, p.y - target.y) > 20 && seconds < 180) {
      routeFixture.step(c, 0.2, taxiKeys(p, target)); seconds += 0.2;
      p = routeFixture.api.aircraftTaxiReport(c.id);
      t.assert(p.clear && p.dry && p.hp === p.maxhp, `${c.parkingStand}: collision footprint left clear dry ground at ${p.x},${p.y}`);
    }
    t.assert(seconds < 180 && p.runway, c.parkingStand + ': failed to taxi onto runway');
    t.note(`${c.parkingStand}: ${seconds.toFixed(1)} s taxi, ${p.runway.remainingM.toFixed(1)} m runway remaining`);
    const start = { x: p.x, y: p.y }, remaining = p.runway.remainingM,
      end = c.airframe === 'skyhawk' ? { x: 418, y: 7800 } : { x: -3900, y: 9884 };
    let rollSeconds = 0;
    while (p.aglM < 3 && rollSeconds < 50) {
      routeFixture.step(c, 0.1, takeoffKeys(p, end)); rollSeconds += 0.1;
      p = routeFixture.api.aircraftTaxiReport(c.id);
      t.assert(p.hp === p.maxhp, c.parkingStand + ': damaged after starting the take-off roll');
    }
    const roll = Math.hypot(p.x - start.x, p.y - start.y) / 8;
    t.assert(p.aglM >= 3 && roll < remaining, `${c.parkingStand}: did not reach 3 m AGL within the runway (${roll}/${remaining} m)`);
    routeFixture.step(c, 2, ['KeyW']);
    t.assert(c.altitude > 16 && !c.stalled && c.hp === c.maxhp, c.parkingStand + ': did not sustain flight after releasing the pitch input');
  }
  t.note('take-off model: ' + JSON.stringify(performance));
}
