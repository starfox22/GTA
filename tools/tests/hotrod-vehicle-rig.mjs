// Actual licensed hotrod geometry/builders: isolated wheel pivots, immutable sharing, LOD and livery UVs.
// The host uses the real production head geometry/fit; WebGL and attachment appearance are reviewed separately.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

export default async function(t) {
  // Read the production hotrod dimensions: a narrower copied fixture changes native-scale seat fitting.
  const specSource = fs.readFileSync(new URL('../../src/game-vehicles.js', import.meta.url), 'utf8'),
    specBlock = specSource.match(/\bhotrod:\s*\{([\s\S]*?)\n\s*\},/)[1],
    hotrodSpec = vm.runInNewContext('({' + ['l', 'w'].map(key => key + ':' + specBlock.match(new RegExp('^\\s*' + key + ':\\s*([^,]+),', 'm'))[1]).join(',') + '})', { UNITS_PER_METRE: 8 });
  const Three = createRequire(import.meta.url)('../../vendor/three.r160.js'),
    read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'),
    bytes = fs.readFileSync(new URL('../../assets/hotrod-vehicle-models.bin', import.meta.url)),
    length = bytes.readUInt32LE(8), header = JSON.parse(bytes.subarray(12, 12 + length)),
    base = 12 + length, types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array }, arrays = {};
  for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
    const raw = bytes.subarray(base + offset, base + offset + count * types[type].BYTES_PER_ELEMENT);
    arrays[name] = new types[type](Uint8Array.from(raw).buffer);
  }
  for (const model of Object.values(header.models)) { model.approved = true; model.assetPack = 'hotrod'; }
  const legacyBytes = fs.readFileSync(new URL('../../assets/vehicle-models.bin', import.meta.url)),
    legacyLength = legacyBytes.readUInt32LE(8), legacyHeader = JSON.parse(legacyBytes.subarray(12, 12 + legacyLength)), legacyArrays = {};
  for (const [name, [type, offset, count]] of Object.entries(legacyHeader.arrays)) {
    const raw = legacyBytes.subarray(12 + legacyLength + offset, 12 + legacyLength + offset + count * types[type].BYTES_PER_ELEMENT);
    legacyArrays[name] = new types[type](Uint8Array.from(raw).buffer);
  }
  const sportsBytes = fs.readFileSync(process.env.GTA_SPORTS_PACK || new URL('../../assets/sports-vehicle-models.bin', import.meta.url)),
    sportsLength = sportsBytes.readUInt32LE(8), sportsHeader = JSON.parse(sportsBytes.subarray(12, 12 + sportsLength)), sportsArrays = {};
  for (const [name, [type, offset, count]] of Object.entries(sportsHeader.arrays)) {
    const raw = sportsBytes.subarray(12 + sportsLength + offset, 12 + sportsLength + offset + count * types[type].BYTES_PER_ELEMENT);
    sportsArrays[name] = new types[type](Uint8Array.from(raw).buffer);
  }
  for (const model of Object.values(sportsHeader.models)) { model.approved = true; model.assetPack = 'sports'; }
  const glass = new Three.MeshStandardMaterial(), trim = new Three.MeshStandardMaterial(),
    materials = { trim, rubber: trim, rim: trim, glass, glassFar: glass },
    lamps = Object.fromEntries(['headOff', 'tailOff', 'headOn', 'tailOn', 'brake'].map(name => [name, new Three.MeshStandardMaterial()])),
    player = { car: null }, scope = vm.createContext({ Three, fixture: { header, arrays }, fixtureLegacy: { header: legacyHeader, arrays: legacyArrays }, fixtureSports: { header: sportsHeader, arrays: sportsArrays }, materials, lamps, player, carTransition: {}, Uint8Array, Uint16Array, Uint32Array, Float32Array,
      UNITS_PER_METRE: 8, PERSON_HEIGHT: 14, renderer: { capabilities: { getMaxAnisotropy: () => 4 } }, activeTier: { lodBias: 1 }, CAR_M: 8, TAU: Math.PI * 2, performance, gameTime: 10, vehicleGlassBand: () => null, CAR_SWATCH: { paint: 0, black: 2 }, CITY_SIZE: 4096,
      crackedGlassTexture: new Three.Texture(), fixtureTexture: new Three.Texture(), cityMaterialPatch() {}, approvedVehicleAtlasPatch() {}, carGlassMaterial: () => glass, bodyPools: new Map(), carModels: new Map(), BODY_POOL_CAPACITY: 160, bodyPaint: trim, impostorBeaconMaterial: trim, impostorColor: new Three.Color(), boxGeo: new Three.BoxGeometry(), scene: new Three.Scene(), sharedGeometries: new Set(), sharedMaterials: new Set(),
      clamp: (value, lo, hi) => Math.max(lo, Math.min(hi, value)), lerpNumber: (a, b, t) => a + (b - a) * t,
      vehicleSpec: c => c.type === 'hotrod' ? hotrodSpec : c.type === 'police' ? { l: 5.1 * 8, w: 2.18 * 8 } : c.policeLook ? { l: 4.95 * 8, w: 2.24 * 8 } : c.type === 'chevette' ? { l: 4.69 * 8, w: 2.32 * 8 } : c.type !== 'suv' ? { l: 4.7 * 8, w: 1.9 * 8 } : { l: header.models[['s1_jimny', 's2_suv', 's3_offroad'][(c.id >>> 0) % 3]].dims[0] * 8, w: header.models[['s1_jimny', 's2_suv', 's3_offroad'][(c.id >>> 0) % 3]].dims[2] * 8 }, drivenAxle: () => 'rear', spawnPanel() {},
      civDrawRange(geometry, count) { const far = geometry.clone(); far.setDrawRange(0, count); return far; },
      civSharedMaterials: () => materials, civLampSet: () => lamps, civFinish: () => ({ roughness: .3, metalness: .06 }),
      civImpostorPaint: () => trim, policeCabinGlass: () => glass, policeImpostorPaint: () => trim,
      policeLightMaterial: () => { const material = new Three.MeshBasicMaterial(); material.uniforms = { levels: { value: new Float32Array(8) } }; return material; },
      policeDecalGeometry: () => new Three.BoxGeometry(.01, .01, .01), policeGlyphs: () => ({ material: trim }),
      warmLamp: lamps.headOn, tailLamp: lamps.tailOff,
      box(parent, x, y, z, sx, sy, sz, material) { const object = new Three.Mesh(new Three.BoxGeometry(), material); object.position.set(x, y, z); object.scale.set(sx, sy, sz); parent.add(object); return object; },
      mesh(geometry, material, parent, x = 0, y = 0, z = 0) { const object = new Three.Mesh(geometry, material); object.position.set(x, y, z); parent.add(object); return object; },
      halo(parent, x, y, z) { const object = new Three.Group(); object.position.set(x, y, z); parent.add(object); return object; },
    });
  const materialSource = read('cars3d-materials'), materialHeader = materialSource.slice(0, materialSource.indexOf('      let civTrimAtlasTexture')),
    dirtSource = materialSource.slice(materialSource.indexOf('      const CIV_NO_DIRT'), materialSource.indexOf('      function civLiveryPatch')),
    finishPatch = materialSource.slice(materialSource.indexOf('      function trimCellRect('), materialSource.indexOf('      let civMaterials')),
    legacyPaint = materialSource.slice(materialSource.indexOf('      function civLiveryPatch('), materialSource.indexOf('      // The pooled impostor paint')),
    markSource = read('damage3d-marks'), sourceMarkHook = markSource.slice(markSource.indexOf('      function markOntoDoor('), markSource.indexOf('      // The normal at an anchor:'));
  const flightSource = read('flight-view3d'), poolSource = flightSource.slice(flightSource.indexOf('      function bodyPoolFor('), flightSource.indexOf('      function bodyImpostor('));
  const approvedSource = read('approved-vehicle-assets3d'), approvedPatch = approvedSource.slice(approvedSource.indexOf('      function approvedVehicleMaterialPatch('), approvedSource.indexOf('      let approvedVehicleMaterialSet;')),
    approvedMaterials = approvedSource.slice(approvedSource.indexOf('      let approvedVehicleMaterialSet;'), approvedSource.indexOf('      function approvedVehiclePaint(')),
    approvedPaint = approvedSource.slice(approvedSource.indexOf('      function approvedVehiclePaint('), approvedSource.indexOf('      const approvedVehicleImpostorPaints')),
    occupantSource = read('crowd3d-driveby'), occupantDeclarations = occupantSource.slice(occupantSource.indexOf('      const OCCUPANT_REACH'), occupantSource.indexOf('      let occupantCount')),
    actualSeatOccupant = occupantSource.slice(occupantSource.indexOf('      function seatOccupant('));
  const damageSource = read('damage-vehicles'), glassBands = damageSource.slice(damageSource.indexOf('    const CAR_GLASS_BANDS'), damageSource.indexOf('    // Where the glass is'));
  const api = vm.runInContext(glassBands + materialHeader + finishPatch + dirtSource + legacyPaint + approvedPatch + approvedMaterials + approvedPaint + read('sports-vehicle-assets3d') + read('hotrod-vehicle-assets3d') + read('cars3d-geometry') + read('character-rig3d') + read('character-near3d') + read('character-near3d-head') + read('driveby-seats') + read('vehicle-assets3d') + read('approved-suv3d') +
    read('police3d-looks') + read('police3d-cabins') + read('cars3d-interior') + read('cars3d-headroom') + read('police3d-asset') + read('damage-crumple') + read('damage3d-crumple') + read('vehicle-doors3d') + read('vehicle-char3d') + read('damage3d-bodies') + read('carjack3d') + sourceMarkHook + poolSource + occupantDeclarations + actualSeatOccupant + `
      const BODY_CLOSE = { head: { mesh: { geometry: rigHeadGeometry() } } };
      for (const [name, geometry] of Object.entries({ ...rigHairGeometries(), ...rigHatGeometries() })) BODY_CLOSE[name] = { mesh: { geometry } };
      const BODY_NEAR = { head: { mesh: { geometry: nearHeadGeometry() } } };
      function approvedVehicleData() { return fixture; }
      function approvedVehicleModel(key) { return fixture.header.models[key] || null; }
      function vaData() { return fixtureLegacy; }
      function hotrodVehicleData() { return fixture; }
      function hotrodVehicleTexture() { return fixtureTexture; }
      function sportsVehicleData() { return fixtureSports; }
      function sportsVehicleTexture() { return fixtureTexture; }
      vaAtlas = () => fixtureTexture;
      vaLivery = () => fixtureTexture;
      civSharedMaterials = () => materials;
      function approvedVehicleTexture() { return fixtureTexture; }
      function approvedVehicleImpostorPaint() { return materials.trim; }
      policeLiveryTexture = () => new Three.Texture();
      policeGlyphs = () => ({ material: materials.trim });
      policeDecalGeometry = () => new Three.BoxGeometry(.01, .01, .01);
      let fixturePose = null;
      const chaseViewActive = false, specScratch = {};
      function occupantLooksFor() { return { proxies: [{}, {}], looks: [{}, {}] }; }
      function resetSpec() { return {}; }
      function compiledLook() { return { height: 1 }; }
      function stateFor() { return {}; }
      function drawCrowdPerson(proxy, state, dt, detail, sp) {
        fixturePose = { hip: new Three.Vector3(0, RIG.hip * RIG_UNIT, 0).applyMatrix4(sp.rootOverride).toArray(),
          lean: sp.riderLean, hands: sp.handTargets.map(v => v.toArray()), feet: sp.legTargets.map(v => v.toArray()) };
      }
      ({ makeAssetCar, makeAssetPoliceVehicle, approvedSuvKey, approvedSuvGlassBand, vaGeometry, policeApprovedPanels, animateApprovedSuvWheels, vehicleAssetModel, bodyPoolFor, vehicleDoor, vehicleDoorsReport, doorPanelGeometries, carBodyDamage, swingDriverDoor, markOntoDoor, crumpleSlices, crumplePending: () => crumpleQueue.size, assetCharSwap, assetCharRelease, seatOccupant, fixtureOccupantPose: () => fixturePose, carSeatPlan, cabinClearance, cabinSeatClouds, DRIVEBY_SEATS, CAR_GLASS_BANDS, vehicleDoorPartition })`, scope);
  const clearDamage = () => ({ parts: { hood: 0, bumperFront: 0, bumperRear: 0, doorLeft: 0, doorRight: 0, trunk: 0 }, glass: { front: 0, rear: 0, left: 0, right: 0 }, tires: {}, front: 0, rear: 0, left: 0, right: 0, burnt: false });
  function checkAperture(vehicle, model, key) {
    const drainCrumple = () => { for (let i = 0; i < 500 && api.crumplePending(); i++) api.crumpleSlices(); t.assert(!api.crumplePending(), key + ': actual crumple budget queue did not drain'); };
    vehicle.dents = []; vehicle.damage = clearDamage();
    api.carBodyDamage(vehicle, model, vehicle.damage);
    const door = api.vehicleDoor(vehicle, model, -1), rect = door.rect,
      targets = [...model.doorBodySources.keys()], originals = targets.map(mesh => mesh.geometry),
      pristineAttributes = originals.map(geometry => Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, Array.from({ length: attribute.count * attribute.itemSize }, (_, i) => attribute.getComponent(Math.floor(i / attribute.itemSize), i % attribute.itemSize))]))),
      pristineIndices = originals.map(geometry => geometry.index ? Array.from(geometry.index.array) : null),
      x = (rect.x0 + rect.x1) / 2, y = (rect.y0 + model.dims.h) / 2,
      origin = new Three.Vector3(x, y, -model.dims.w), direction = new Three.Vector3(0, 0, 1),
      ray = new Three.Raycaster(origin, direction, 0, model.dims.w - door.volume.z0 - .001),
      sourceProbe = () => { model.body.updateMatrixWorld(true); return ray.intersectObjects(targets, false); },
      prefix = model.shell.geometry.attributes.position.array.slice(), cacheSize = scope.sharedGeometries.size;
    t.assert(sourceProbe().length > 0, key + ': closed-source door proof ray misses the actual body');
    vehicle.doorSwing = { openAt: 8, closeAt: 0 };
    api.swingDriverDoor(vehicle, model);
    t.assert(model.doorBodyMask === 1 && door.panel.visible && Math.abs(door.pivot.rotation.y) > .8, key + ': actual carjack draw does not open source door');
    scope.carModels.set(vehicle, model);
    const reported = api.vehicleDoorsReport(vehicle.id).cars[0];
    t.assert(reported?.mask === 1 && reported.doors['-1'].layers.filter(layer => layer.visible).length === door.layers.filter(layer => layer.visible).length, key + ': named door report does not reflect actual rendered layers');
    if (door.native) {
      const axis = door.native.axis[0], part = door.native.partNames[0];
      reported.doors['-1'].axis[0] = 99; reported.doors['-1'].sourceParts[0] = 'changed';
      t.assert(door.native.axis[0] === axis && door.native.partNames[0] === part, key + ': read-only door report exposes mutable source metadata');
    }
    scope.carModels.delete(vehicle);
    t.assert(door.opening.children.length === 0 && !door.opening.geometry, key + ': upholstery/engine-bay wall still fills doorway');
    t.assert(sourceProbe().length === 0, key + ': fixed closed body/trim still occludes actual open doorway');
    const interiorTargets = [...targets, model.approvedInterior].filter(Boolean), visibleInterior = [];
    for (const forward of [-.2, -.1, .15, .5]) for (const up of [0, .2, .45]) {
      const start = new Three.Vector3(rect.x0 + .25 * model.seats.M, Math.max(rect.y0 + .12 * model.seats.M, model.seats.y + .4 * model.seats.M), -model.dims.w),
        end = new Three.Vector3(model.seats.x + forward * model.seats.M, model.seats.y + up * model.seats.M, model.seats.z * .5),
        probe = new Three.Raycaster(start, end.clone().sub(start).normalize(), 0, end.distanceTo(start) + .2 * model.seats.M),
        hits = probe.intersectObjects(interiorTargets, false).filter(hit => hit.object !== model.cabin);
      if (!hits.length) continue;
      const hit = hits[0], source = model.doorBodySources.get(hit.object),
        sourceFace = hit.object.geometry.userData.vehicleSourceFaces?.[hit.faceIndex] ?? hit.faceIndex,
        authored = source === model.kit.trim && sourceFace * 3 >= model.kit.trimOuter.drawRange.count;
      if (hit.object === model.approvedInterior || authored) visibleInterior.push({ part: hit.object === model.approvedInterior ? 'production seats/dashboard fallback' : 'authored source cabin', face: sourceFace });
    }
    t.assert(visibleInterior.length > 0, key + ': real source/fitted seats or dashboard cannot be seen through actual doorway');
    t.assert(model.shell.geometry.attributes.position.array.slice(0, prefix.length).every((value, i) => value === prefix[i]), key + ': aperture changes original vertex IDs/positions used by bullet anchors');
    t.assert(door.glass?.visible && door.glass.material.side === Three.DoubleSide && door.glass.material.forceSinglePass, key + ': intact front window does not ride with door in one two-sided pass');
    // Clipping can increase triangle counts. Test actual window coverage instead of a count decrease.
    const glassMaterial = new Three.MeshBasicMaterial({ side: Three.DoubleSide }),
      closedWindow = new Three.Mesh(originals[targets.indexOf(model.cabin)], glassMaterial),
      fixedWindow = new Three.Mesh(model.cabin.geometry, glassMaterial),
      gp = door.glass.geometry.attributes.position, gi = door.glass.geometry.index,
      point = new Three.Vector3(), a = new Three.Vector3(), b = new Three.Vector3(), c = new Three.Vector3();
    closedWindow.updateMatrixWorld(true); fixedWindow.updateMatrixWorld(true);
    let windowRays = 0, fixedWindowHits = 0;
    for (let at = 0; at < gi.count; at += 3) {
      a.fromBufferAttribute(gp, gi.getX(at)); b.fromBufferAttribute(gp, gi.getX(at + 1)); c.fromBufferAttribute(gp, gi.getX(at + 2));
      if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() < 1e-10) continue;
      point.copy(a).add(b).add(c).multiplyScalar(1 / 3).add(door.pivot.position);
      const windowRay = new Three.Raycaster(point.clone().add(new Three.Vector3(0, 0, -.2 * model.seats.M)), new Three.Vector3(0, 0, 1), 0, .2 * model.seats.M + 1e-5);
      if (!windowRay.intersectObject(closedWindow, false).length) continue;
      windowRays++; fixedWindowHits += windowRay.intersectObject(fixedWindow, false).length;
    }
    glassMaterial.dispose();
    t.assert(windowRays > 0 && fixedWindowHits === 0, key + ': source front window remains fixed across its open doorway');
    if (model.kit.nativeDoors) t.assert(model.cabin.geometry.index.count === originals[targets.indexOf(model.cabin)].index.count - door.glass.geometry.index.count, key + ': native front-window removal loses other panes');
    const sourceLayer = door.layers.find(layer => layer.userData.vehicleDoorSource && !layer.userData.doorGlass), sourceMesh = sourceLayer.userData.vehicleDoorSource,
      p = sourceLayer.geometry.attributes.position, ix = sourceLayer.geometry.index;
    let anchor;
    for (let at = 0; at < ix.count && !anchor; at += 3) {
      const a = ix.getX(at), b = ix.getX(at + 1), c = ix.getX(at + 2),
        px = (p.getX(a) + p.getX(b) + p.getX(c)) / 3 + door.pivot.position.x,
        py = (p.getY(a) + p.getY(b) + p.getY(c)) / 3 + door.pivot.position.y;
      if (px > rect.x0 + .05 && px < rect.x1 - .05 && py > rect.y0 + .05 && py < model.dims.h - .05)
        anchor = { object: sourceMesh, a, b, c, u: 1 / 3, v: 1 / 3, w: 1 / 3, sign: 1 };
    }
    t.assert(!!anchor, key + ': source door skin has no interior triangle for mark transfer proof');
    api.markOntoDoor(model, anchor);
    t.assert(anchor.object === sourceLayer, key + ': production mark hook does not transfer source triangle to moving door');
    vehicle.windowsDown = { left: true }; api.swingDriverDoor(vehicle, model);
    t.assert(!door.glass.visible, key + ': lowered window reappears on open door');
    vehicle.windowsDown = null; vehicle.damage.glass.left = 2; api.swingDriverDoor(vehicle, model);
    t.assert(!door.glass.visible, key + ': shattered window reappears on open door');
    vehicle.damage.glass.left = 0;
    delete vehicle.doorSwing; api.swingDriverDoor(vehicle, model);
    t.assert(!model.doorBodyMask && !door.panel.visible && !door.glass.visible, key + ': closure leaves source door/window duplicate visible');
    t.assert(targets.every((mesh, i) => mesh.geometry === originals[i]), key + ': closure fails to restore exact original geometry references');
    api.markOntoDoor(model, anchor);
    t.assert(anchor.object === sourceMesh, key + ': closing door fails to return source bullet anchor');
    t.assert(sourceProbe().length > 0, key + ': closed-source body no longer fills doorway');
    vehicle.damage.parts.doorLeft = 1; api.carBodyDamage(vehicle, model, vehicle.damage);
    t.assert(model.doorBodyMask === 1 && sourceProbe().length === 0, key + ': sprung damage door lacks genuine body aperture');
    vehicle.damage.parts.doorLeft = 2; api.carBodyDamage(vehicle, model, vehicle.damage);
    t.assert(model.doorBodyMask === 1 && door.layers.every(layer => !layer.visible), key + ': torn door leaves a duplicate skin or closes its hole');
    vehicle.damage.parts.doorLeft = 0; api.carBodyDamage(vehicle, model, vehicle.damage);
    t.assert(!model.doorBodyMask && targets.every((mesh, i) => mesh.geometry === originals[i]), key + ': repair does not restore original body/window');
    vehicle.doorSwing = { openAt: 8, closeAt: 0 }; api.swingDriverDoor(vehicle, model);
    delete vehicle.doorSwing; api.swingDriverDoor(vehicle, model);
    t.assert(scope.sharedGeometries.size <= cacheSize + targets.length * 2, key + ': repeating door animation allocates new source clipping geometry');
    Object.assign(scope.carTransition, { door: vehicle, kind: 'enter', at: 9.8, doorSide: -1 });
    api.swingDriverDoor(vehicle, model);
    t.assert(model.doorBodyMask === 1 && door.glass.visible, key + ': player boarding does not use the same real doorway');
    Object.assign(scope.carTransition, { kind: 'exit', doorSide: 1 }); api.swingDriverDoor(vehicle, model);
    t.assert(model.doorBodyMask === 2 && model.doors[1].glass.visible && !door.panel.visible, key + ': passenger-side exit leaves wrong window or body open');
    vehicle.doorSwing = { openAt: 8, closeAt: 0 }; api.swingDriverDoor(vehicle, model);
    t.assert(model.doorBodyMask === 3 && door.panel.visible && model.doors[1].panel.visible, key + ': simultaneous front doors do not preserve both apertures');
    const rightRay = new Three.Raycaster(new Three.Vector3(x, y, model.dims.w), new Three.Vector3(0, 0, -1), 0, model.dims.w - door.volume.z0 - .001);
    model.body.updateMatrixWorld(true);
    t.assert(sourceProbe().length === 0 && rightRay.intersectObjects(targets, false).length === 0, key + ': one source side reappears when both doors open');
    delete vehicle.doorSwing; scope.carTransition.at = 8; api.swingDriverDoor(vehicle, model); scope.carTransition.kind = null;
    t.assert(!model.doorBodyMask && targets.every((mesh, i) => mesh.geometry === originals[i]), key + ': final entry/exit closure leaves a clipped source variant');
    scope.carModels.set(vehicle, model);
    const repaired = api.vehicleDoorsReport(vehicle.id).cars[0];
    scope.carModels.delete(vehicle);
    t.assert(Object.values(repaired.closedSourceGeometry).every(Boolean) && repaired.materials.shell.uuid === model.shell.material.uuid && repaired.materials.shell.map === (model.shell.material.map?.uuid || null), key + ': named repair report loses actual source geometry/material/map references');
    let nearest = 0, distance = Infinity;
    for (let i = 0; i < prefix.length; i += 3) {
      const d = Math.hypot(prefix[i] - x, prefix[i + 1] - y, prefix[i + 2] + model.dims.w * .45);
      if (d < distance) { nearest = i; distance = d; }
    }
    vehicle.dents = [{ x: prefix[nearest], y: prefix[nearest + 2], z: prefix[nearest + 1], r: 3, depth: .9, nx: 0, ny: prefix[nearest + 2] < 0 ? 1 : -1 }];
    api.carBodyDamage(vehicle, model, vehicle.damage); drainCrumple();
    const deformed = model.shell.geometry.attributes.position.array.slice(0, prefix.length);
    t.assert(deformed.some((value, i) => Math.abs(value - prefix[i]) > .001), key + ': crumple proof did not reach the actual source shell');
    vehicle.doorSwing = { openAt: 8, closeAt: 0 }; api.swingDriverDoor(vehicle, model);
    t.assert(deformed.every((value, i) => Math.abs(value - model.shell.geometry.attributes.position.array[i]) < .00001), key + ': opening dented door flashes a pristine source body');
    drainCrumple();
    delete vehicle.doorSwing; api.swingDriverDoor(vehicle, model);
    t.assert(deformed.every((value, i) => Math.abs(value - model.shell.geometry.attributes.position.array[i]) < .00001), key + ': closing dented door discards its current deformation');
    drainCrumple();
    vehicle.dents = []; api.carBodyDamage(vehicle, model, vehicle.damage); drainCrumple();
    t.assert(prefix.every((value, i) => Math.abs(value - model.shell.geometry.attributes.position.array[i]) < .00001), key + ': repair after aperture/crumple fails to restore source positions');
    for (const [index, mesh] of targets.entries()) {
      const geometry = mesh.geometry;
      t.assert(Object.entries(pristineAttributes[index]).every(([name, values]) => geometry.attributes[name]?.count * geometry.attributes[name].itemSize === values.length && values.every((value, i) => geometry.attributes[name].getComponent(Math.floor(i / geometry.attributes[name].itemSize), i % geometry.attributes[name].itemSize) === value)), key + ': dent/door repair loses authored source normals, UVs or other attributes');
      t.assert(JSON.stringify(geometry.index ? Array.from(geometry.index.array) : null) === JSON.stringify(pristineIndices[index]), key + ': dent/door repair changes original triangle indices');
    }
    scope.carModels.set(vehicle, model);
    const pristineReport = api.vehicleDoorsReport(vehicle.id).cars[0];
    scope.carModels.delete(vehicle);
    t.assert(Object.values(pristineReport.sourceGeometryRestored).every(Boolean), key + ': repaired owned clone no longer exactly matches its authored source geometry');
    t.note(JSON.stringify({ apertureProof: { key, actualRayOpenHits: 0, windowRays, fixedWindowHits, visibleInterior, sourceRestored: true, windowMoves: true, marksFollowSource: true, layers: door.layers.length } }));
  }
  const vehicle = { type: 'hotrod', id: 701, color: '#8b1925', hp: 100, maxhp: 100, damageVersion: 0, dents: [], damage: clearDamage() },
    model = api.makeAssetCar(vehicle), seat = model.seats;
  const clearance = api.cabinClearance(model.kit.glass, model.kit.l, seat.glass.w, seat.M, api.cabinSeatClouds(), seat.x, seat.y, Math.abs(seat.z), seat.lean) / seat.M;
  t.note(JSON.stringify({ seat: [seat.x / seat.M, seat.y / seat.M, -seat.z / seat.M, seat.lean, model.kit.glass.base / seat.M], clearance, k: model.kit.k, steering: seat.wheel }));
  t.assert(clearance >= 0, 'full-scale tallest production head fits the source hotrod cabin');
  t.assert(seat.y / model.kit.k >= .66499, 'actor hip remains on measured original seat cushion');
  const recorded = api.DRIVEBY_SEATS.hotrod, fitted = [seat.x / seat.M, seat.y / seat.M, -seat.z / seat.M, seat.lean, model.kit.glass.base / seat.M];
  t.assert(fitted.every((v, i) => Math.abs(v - recorded[i]) < .000001), 'gameplay drive-by origin matches actual fitted source hip');
  const g = model.kit.glass, expectedGlass = [g.base / seat.M, (g.roof + g.crown) / seat.M, g.xb, g.xf],
    recordedGlass = Array.from(api.CAR_GLASS_BANDS.hotrod);
  t.assert(expectedGlass.every((v, i) => Math.abs(v - recordedGlass[i]) < .000000001), 'gameplay glass band matches production-size source body');
  t.note(JSON.stringify({ gameplayGlassProof: { sourceExpected: expectedGlass, CAR_GLASS_BANDS_hotrod: recordedGlass, uniformRuntimeScale: model.kit.k, productionSpecMetres: { l: hotrodSpec.l / seat.M, w: hotrodSpec.w / seat.M }, passed: true } }));
  const cabin = new Three.Mesh(model.kit.trim, new Three.MeshBasicMaterial({ side: Three.DoubleSide })); cabin.updateMatrixWorld(true);
  const probes = [];
  for (const index of [0, 1]) {
    const z = index ? -seat.z : seat.z, ray = new Three.Raycaster(new Three.Vector3(seat.x, seat.y + .2 * seat.M, z), new Three.Vector3(0, -1, 0)),
      hits = ray.intersectObject(cabin, false), hit = hits[0], gap = hit ? (hit.point.y - seat.y) / seat.M : Infinity;
    t.assert(hit && hit.face.normal.y > .7 && gap > 0 && gap < .035, 'source cushion ray supports full-size occupant hip');
    t.assert(api.seatOccupant(vehicle, model, index, 1 / 60, 0), 'actual production occupant draws in source seat');
    const pose = api.fixtureOccupantPose(), expected = [seat.x, seat.y, z];
    t.assert(pose.hip.every((v, i) => Math.abs(v - expected[i]) < 1e-7), 'production occupant hip remains on source cushion');
    if (!index) for (const hand of pose.hands) {
      const dx = hand[0] - seat.wheel.x, dy = hand[1] - seat.wheel.y, dz = hand[2] - seat.wheel.z;
      t.assert(Math.abs(Math.hypot(dx, dy, dz) - seat.wheel.r) < 1e-7 && Math.abs(dx * Math.cos(seat.wheel.tilt) - dy * Math.sin(seat.wheel.tilt)) < 1e-7, 'actual driver hand target lies on measured original steering rim');
    }
    probes.push({ index, hip: expected.map(v => v / seat.M), cushionY: hit.point.y / seat.M, cushionAboveHip: gap });
  }
  t.note(JSON.stringify({ sourceOccupantProof: { fullSize: true, probes, clearance, steeringWorldMetres: [seat.wheel.x / seat.M, seat.wheel.y / seat.M, seat.wheel.z / seat.M, seat.wheel.r / seat.M, seat.wheel.tilt] } }));
  for (const geometry of [model.panelGeometry, model.trunkGeometry]) t.assert(geometry.attributes.avOrmSourceUv?.count === geometry.attributes.position.count, 'generated hotrod paint panels carry independent ORM UV');
  const shapedProbe = api.doorPanelGeometries(model, -1, -.3 * seat.M, .3 * seat.M, .6 * seat.M, .85 * seat.M, new Three.Vector3(.3 * seat.M, 0, -.5 * model.dims.w));
  t.assert(shapedProbe && shapedProbe.door.attributes.avOrmSourceUv?.count === shapedProbe.door.attributes.position.count, 'source ray-shaped fallback door interpolates independent ORM UV');
  checkAperture(vehicle, model, 'hotrod');
  for (const side of [-1, 1]) for (const layer of model.doors[side].layers) {
    if (layer.userData.vehicleDoorInside) continue;
    t.assert(layer.geometry.attributes.avOrmSourceUv?.count === layer.geometry.attributes.position.count, 'actual clipped source door retains independent ORM UV');
  }
  const paint = model.paint, before = model.shell.geometry.attributes.position.array.slice();
  const fresh = api.makeAssetCar({ ...vehicle, id: 702 }), freshCar = { ...vehicle, id: 702, damage: clearDamage(), dents: [] };
  api.assetCharSwap(freshCar, fresh, true);
  const burntDoor = api.vehicleDoor(freshCar, fresh, -1);
  t.assert(burntDoor.layers.filter(layer => layer.userData.vehicleDoorSource).every(layer => layer.material.userData.assetChar), 'burn-before-first-door adopts every new source layer into burnt pool');
  api.assetCharRelease(fresh);
  t.assert(fresh.paint === paint || fresh.paint.userData.approvedPaint, 'repair restores native hotrod paint material kind');
  t.assert(burntDoor.layers.filter(layer => layer.userData.vehicleDoorSource).every(layer => layer.material.userData.assetAtlas === 'approved' && !layer.material.userData.assetChar), 'repair after burn-before-first-door restores source door materials');
  api.assetCharSwap(freshCar, fresh, true); api.assetCharRelease(fresh);
  t.assert(fresh.shell.geometry.attributes.position.array.every((value, i) => value === before[i]), 'char/repair pool leaves cached source geometry unchanged');
  t.note(JSON.stringify({ hotrodRigProof: { clearance, sourceSeat: [seat.x / model.kit.k, seat.y / model.kit.k, seat.z / model.kit.k], fullSizeCharacter: true, sourceDoorAttributes: Object.keys(model.doors[-1].panel.geometry.attributes), burnBeforeFirstDoor: true, repaired: true } }));
}
