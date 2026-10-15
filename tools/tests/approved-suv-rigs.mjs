// Actual approved packed SUV geometry/builders: isolated wheel pivots, immutable sharing, LOD and livery UVs.
// The host uses the real production head geometry/fit; WebGL and attachment appearance are reviewed separately.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

export default async function(t) {
  const Three = createRequire(import.meta.url)('../../vendor/three.r160.js'),
    read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'),
    bytes = fs.readFileSync(new URL('../../assets/approved-vehicle-models.bin', import.meta.url)),
    length = bytes.readUInt32LE(8), header = JSON.parse(bytes.subarray(12, 12 + length)),
    base = 12 + length, types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array }, arrays = {};
  for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
    const raw = bytes.subarray(base + offset, base + offset + count * types[type].BYTES_PER_ELEMENT);
    arrays[name] = new types[type](Uint8Array.from(raw).buffer);
  }
  for (const model of Object.values(header.models)) model.approved = true;
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
      UNITS_PER_METRE: 8, PERSON_HEIGHT: 14, CAR_M: 8, TAU: Math.PI * 2, performance, gameTime: 10, vehicleGlassBand: () => null, CAR_SWATCH: { paint: 0, black: 2 }, CITY_SIZE: 4096,
      crackedGlassTexture: new Three.Texture(), fixtureTexture: new Three.Texture(), cityMaterialPatch() {}, approvedVehicleAtlasPatch() {}, carGlassMaterial: () => glass, bodyPools: new Map(), carModels: new Map(), BODY_POOL_CAPACITY: 160, bodyPaint: trim, impostorBeaconMaterial: trim, impostorColor: new Three.Color(), boxGeo: new Three.BoxGeometry(), scene: new Three.Scene(), sharedGeometries: new Set(), sharedMaterials: new Set(),
      clamp: (value, lo, hi) => Math.max(lo, Math.min(hi, value)), lerpNumber: (a, b, t) => a + (b - a) * t,
      vehicleSpec: c => c.type === 'police' ? { l: 5.1 * 8, w: 2.18 * 8 } : c.policeLook ? { l: 4.95 * 8, w: 2.24 * 8 } : c.type === 'chevette' ? { l: 4.69 * 8, w: 2.32 * 8 } : c.type !== 'suv' ? { l: 4.7 * 8, w: 1.9 * 8 } : { l: header.models[['s1_jimny', 's2_suv', 's3_offroad'][(c.id >>> 0) % 3]].dims[0] * 8, w: header.models[['s1_jimny', 's2_suv', 's3_offroad'][(c.id >>> 0) % 3]].dims[2] * 8 }, drivenAxle: () => 'rear', spawnPanel() {},
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
  const api = vm.runInContext(materialHeader + finishPatch + dirtSource + legacyPaint + approvedPatch + approvedMaterials + approvedPaint + read('sports-vehicle-assets3d') + read('cars3d-geometry') + read('character-rig3d') + read('character-near3d') + read('character-near3d-head') + read('driveby-seats') + read('vehicle-assets3d') + read('approved-suv3d') +
    read('police3d-looks') + read('police3d-cabins') + read('cars3d-interior') + read('cars3d-headroom') + read('police3d-asset') + read('damage-crumple') + read('damage3d-crumple') + read('vehicle-doors3d') + read('vehicle-char3d') + read('damage3d-bodies') + read('carjack3d') + sourceMarkHook + poolSource + occupantDeclarations + actualSeatOccupant + `
      const BODY_CLOSE = { head: { mesh: { geometry: rigHeadGeometry() } } };
      for (const [name, geometry] of Object.entries({ ...rigHairGeometries(), ...rigHatGeometries() })) BODY_CLOSE[name] = { mesh: { geometry } };
      const BODY_NEAR = { head: { mesh: { geometry: nearHeadGeometry() } } };
      function approvedVehicleData() { return fixture; }
      function approvedVehicleModel(key) { return fixture.header.models[key] || null; }
      function vaData() { return fixtureLegacy; }
      function sportsVehicleData() { return fixtureSports; }
      function sportsVehicleTexture() { return fixtureTexture; }
      vaAtlas = () => fixtureTexture;
      vaLivery = () => fixtureTexture;
      civSharedMaterials = () => materials;
      function approvedVehicleTexture() { return fixtureTexture; }
      function approvedVehicleImpostorPaint() { return materials.trim; }
      policeLiveryTexture = () => new Three.Texture();
      // Exercise the actual glyph placement without depending on a host font rasterizer.
      policeGlyphs = () => ({ material: materials.trim, height: 512,
        advance: Object.fromEntries([...POLICE_GLYPHS].map(ch => [ch, .4])) });
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
      ({ makeAssetCar, makeAssetPoliceVehicle, approvedSuvKey, approvedSuvGlassBand, vaGeometry, policeApprovedPanels, policeApprovedDecalAnchors, policeDecalGeometry, bodies: POLICE_BODIES, animateApprovedSuvWheels, vehicleAssetModel, bodyPoolFor, vehicleDoor, vehicleDoorsReport, doorPanelGeometries, carBodyDamage, swingDriverDoor, markOntoDoor, crumpleSlices, crumplePending: () => crumpleQueue.size, assetCharSwap, assetCharRelease, seatOccupant, fixtureOccupantPose: () => fixturePose, carSeatPlan, cabinClearance, cabinSeatClouds, DRIVEBY_SEATS })`, scope);
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
    const pane = model.cabin.geometry.groups.find(group => group.materialIndex === 0);
    if (model.kit.nativeDoors) t.assert(model.cabin.geometry.index.count === originals[targets.indexOf(model.cabin)].index.count - door.glass.geometry.index.count, key + ': native front-window removal loses other panes');
    else t.assert(pane?.count > 0, key + ': opening a front door also removes all rear-quarter glass');
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
    t.note(JSON.stringify({ apertureProof: { key, actualRayOpenHits: 0, visibleInterior, sourceRestored: true, windowMoves: true, marksFollowSource: true, layers: door.layers.length } }));
  }
  t.assert(api.vehicleAssetModel('suv') === header.models.s1_jimny, 'makeVehicle availability gate does not select approved SUV builder');
  const rows = [], lawRows = [], seen = new Set();
  for (let id = 0; id < 3; id++) {
    const vehicle = { type: 'suv', id, color: '#719260' }, untouched = JSON.stringify(vehicle),
      model = api.makeAssetCar(vehicle), key = api.approvedSuvKey(vehicle), packed = header.models[key];
    seen.add(key);
    const band = api.approvedSuvGlassBand(vehicle);
    t.assert(Math.abs(band.belt - packed.glass.base) < 1e-8 && Math.abs(band.roof - packed.glass.roof - packed.glass.crown) < 1e-8 && band.back === packed.glass.xb && band.front === packed.glass.xf, key + ': gameplay glass band does not match native source');
    t.assert(model.impostorParts.filter(part => part.mesh === model.shell || part.mesh === model.hood || part.mesh === model.panels).every(part => part.tint), key + ': far traffic loses per-car paint colour');
    t.assert(model.approvedAsset === key && model.kit.asset === packed, key + ': wrong approved SUV selected');
    t.assert(JSON.stringify(vehicle) === untouched, key + ': builder mutates vehicle/simulation state');
    t.assert(model.wheels.map(wheel => (wheel.front ? 'front' : 'rear') + (wheel.side < 0 ? 'Left' : 'Right')).join(',') === 'frontLeft,frontRight,rearLeft,rearRight', key + ': measured submillimetre offsets reorder the tyre flags');
    t.assert(model.realSize && model.wheels.length === 4 && model.wheels.filter(wheel => wheel.front).length === 2, key + ': axle metadata/size lost');
    t.assert(Array.isArray(packed.paintUv) && packed.paintUv.length === 2, key + ': dynamic panel paint swatch missing');
    for (const geometry of [model.panelGeometry, model.trunkGeometry]) t.assert(['uv', 'finish', 'color', 'liveryUv', 'avSourceUv', 'avAtlasRect'].every(name => geometry.attributes[name]), key + ': dynamic panel lacks source PBR/livery attributes');
    t.assert(model.lamps.length === 4 && model.nightLights.length === 4, key + ': damageable lamps missing');
    if (packed.parts.opticalGlass) {
      const optical = model.opticalGlass, material = optical?.material;
      t.assert(optical?.geometry === model.kit.opticalGlass && optical.geometry.index.count > 0, key + ': source optical glass is absent from the actual builder');
      t.assert(material?.map === scope.fixtureTexture && material.roughnessMap === scope.fixtureTexture && material.metalnessMap === scope.fixtureTexture && material.userData.assetAtlas === 'approved', key + ': optical material loses source albedo/ORM/finish');
      t.assert(material.transparent && material.opacity === 1 && material.alphaTest === 0 && !material.depthWrite && material.side === Three.DoubleSide && material.forceSinglePass, key + ': authored BLEND optics became cut-out/opaque or two draw passes');
      t.assert(!optical.castShadow && !optical.receiveShadow, key + ': transparent lens adds an opaque shadow over its reflector');
      t.assert(model.approvedLodParts.some(part => part.mesh === optical && part.far === model.kit.far.opticalGlass), key + ': optical cover stays detailed at far LOD');
      t.assert(model.impostorParts.some(part => part.mesh === optical && part.geometry === model.kit.far.opticalGlass && part.material === material && !part.tint && !part.shadow), key + ': instanced far body loses transparent source optics');
    } else t.assert(model.opticalGlass === null, key + ': spurious optical geometry on a source without glass covers');
    const seat = model.seats, seatLine = [seat.x / seat.M, seat.y / seat.M, -seat.z / seat.M, seat.lean, model.kit.glass.base / seat.M];
    const recorded = api.DRIVEBY_SEATS[key];
    t.assert(Math.hypot(...seatLine.slice(0, 3).map((v, i) => v - recorded[i])) + Math.abs(seatLine[3] - recorded[3]) < .002, key + ': recorded drive-by seat drifts from actual fitted driver');
    const clearance = api.cabinClearance(model.kit.glass, model.kit.l, seat.glass.w, seat.M, api.cabinSeatClouds(), seat.x, seat.y, Math.abs(seat.z), seat.lean) / seat.M;
    t.assert(clearance >= 0, key + ': tallest driver head intersects source cabin');
    t.assert(seat.rear !== null && !seat.two, key + ': compact source loses four-seat gameplay capacity');
    t.assert(model.cabin.geometry.groups.length === 5, key + ': five-pane damage contract lost');
    if (key === 's2_suv') {
      const k = model.kit.k, ray = new Three.Raycaster(), surfaces = [model.shell, model.hood, model.panels, model.assetTrim].filter(Boolean);
      model.body.updateMatrixWorld(true);
      const probe = (origin, direction, name) => {
        ray.set(new Three.Vector3(...origin).multiplyScalar(k), new Three.Vector3(...direction));
        const hit = ray.intersectObjects(surfaces, false)[0];
        t.assert(!!hit && hit.object.material === model.paint, 'S2 ' + name + ': actual outer body is still opaque trim, so Sheriff livery/dents cannot reach it');
      };
      for (const x of [-1.8, -1.3, -.8, -.3, .1]) for (const z of [-.4, 0, .4]) probe([x, 4, z], [0, -1, 0], 'roof ' + [x, z]);
      for (const side of [-1, 1]) for (const x of [-1.1, -.85, -.4, .1, .6]) for (const y of [.90, .95, 1.10]) probe([x, y, side * 3], [0, 0, -side], 'upper door ' + [side, x, y]);
    }
    t.assert(key === 's1_jimny' ? model.approvedInterior === null : model.approvedInterior?.geometry.index.count > 0, key + ': source/cached fallback interior selection wrong');
    t.assert(model.approvedLodParts.length >= 7, key + ': body/wheel LOD parts missing');
    const size = scope.sharedGeometries.size, copy = api.makeAssetCar({ ...vehicle, id: id + 3 });
    t.assert(copy.kit === model.kit && copy.shell.geometry === model.shell.geometry, key + ': repeated spawn allocates geometry');
    t.assert(scope.sharedGeometries.size === size, key + ': repeated spawn retains buffers');
    t.assert(copy.wheels[0].wheel !== model.wheels[0].wheel, key + ': wheels share live pivot state');
    let nearTriangles = 0, farTriangles = 0;
    for (const part of model.approvedLodParts) {
      t.assert(part.near.attributes.finish?.count === part.near.attributes.position.count && part.far.attributes.finish?.count === part.far.attributes.position.count,
        key + ': authored vertex finish missing in near/far');
      t.assert(part.near.attributes.color?.count === part.near.attributes.position.count && part.far.attributes.color?.count === part.far.attributes.position.count, key + ': approved material samples missing vertex colour');
      t.assert(['avSourceUv', 'avAtlasRect'].every(name => part.near.attributes[name] && part.far.attributes[name]), key + ': source repeat UV/atlas rectangle missing in near/far');
      t.assert(part.near !== part.far && part.far.index.count <= part.near.index.count, key + ': LOD does not reduce original mesh');
      nearTriangles += part.near.index.count / 3; farTriangles += part.far.index.count / 3;
    }
    t.assert(farTriangles < nearTriangles * .6, key + ': distant triangle budget not substantially reduced');
    for (const wheel of model.wheels) {
      const tyre = wheel.wheel.children[0].geometry, bounds = tyre.boundingBox, centre = bounds.getCenter(new Three.Vector3());
      t.assert(Math.hypot(centre.x, centre.y) < wheel.radius * .1, key + ': tyre is eccentric about its rolling pivot');
      const scale = tyre.attributes.position.clone();
      for (const angle of [-Math.PI, -.71, 0, .71, Math.PI]) {
        wheel.wheel.rotation.z = angle;
        t.assert(tyre.attributes.position.array.every((value, index) => value === scale.array[index]), key + ': wheel animation changes shared source geometry');
      }
    }
    scope.carModels.set(vehicle, model); model.shell.geometry = model.kit.far.shell;
    const pool = api.bodyPoolFor(vehicle);
    t.assert(!!pool, key + ': immutable far LOD prevents creating instanced body pool');
    t.assert(pool.parts[0].mesh.geometry === model.kit.far.shell, key + ': distant pool still contains full near shell');
    if (model.opticalGlass) t.assert(pool.parts.some(part => part.mesh.geometry === model.kit.far.opticalGlass && part.mesh.material === model.opticalGlass.material), key + ': actual far-first pool dropped the source transparent lens');
    model.shell.geometry = model.kit.shell;
    const dentedCopy = model.shell.geometry.clone(); dentedCopy.attributes.position.setX(0, dentedCopy.attributes.position.getX(0) + .05);
    model.shell.geometry = dentedCopy; scope.bodyPools.delete(key);
    t.assert(api.bodyPoolFor(vehicle) === null, key + ': deformed near shell incorrectly seeds an instanced pool');
    model.shell.geometry = model.kit.shell; dentedCopy.dispose();
    const door = api.vehicleDoor(vehicle, model, -1);
    const shapedProbe = api.doorPanelGeometries(model, -1, -.5 * seat.M, .3 * seat.M, .70 * seat.M, .78 * seat.M, new Three.Vector3(.3 * seat.M, 0, -.5 * model.dims.w));
    const expectedAttributes = ['finish', 'color', 'avSourceUv', 'avAtlasRect', 'liveryUv'];
    t.assert(expectedAttributes.filter(name => model.shell.geometry.attributes[name]).every(name => door.panel.geometry.attributes[name]), key + ': actual door loses approved source material attributes');
    if (key === 's1_jimny') {
      t.assert(!!shapedProbe, 'Jimny actual source side-ray cut did not produce shaped geometry');
      for (const geometry of [shapedProbe.door, shapedProbe.opening]) for (const name of expectedAttributes.filter(name => model.shell.geometry.attributes[name])) {
        const attribute = geometry.attributes[name];
        t.assert(attribute?.count === geometry.attributes.position.count && attribute.array.every(Number.isFinite), 'Jimny successful shaped door/opening loses ' + name);
        if (name === 'color') t.assert(attribute.array.every(value => value > .99 && value < 1.01), 'normalized source white became black/255 on shaped door');
        if (name === 'avAtlasRect') t.assert(attribute.array.some(value => value > .01) && attribute.array.every(value => value >= -1e-6 && value <= 1.000001), 'shaped door has empty/out-of-range source atlas rectangle');
      }
      // Exercise the optional second UV on the same actual successful source ray cut. It is a data
      // attribute, independent of which patrol/body role the game gives that source geometry.
      model.shell.geometry.setAttribute('liveryUv', model.shell.geometry.attributes.uv.clone());
      const liveryProbe = api.doorPanelGeometries(model, -1, -.5 * seat.M, .3 * seat.M, .70 * seat.M, .78 * seat.M, new Three.Vector3(.3 * seat.M, 0, -.5 * model.dims.w));
      for (const geometry of [liveryProbe.door, liveryProbe.opening])
        t.assert(geometry.attributes.liveryUv?.array.every((value, i) => Math.abs(value - geometry.attributes.uv.array[i]) < 1e-6), 'successful shaped door loses separately interpolated police livery coordinates');
      model.shell.geometry.deleteAttribute('liveryUv');
      const approved = model.approvedAsset; model.approvedAsset = null;
      const legacy = api.doorPanelGeometries(model, -1, -.5 * seat.M, .3 * seat.M, .70 * seat.M, .78 * seat.M, new Three.Vector3(.3 * seat.M, 0, -.5 * model.dims.w));
      model.approvedAsset = approved;
      t.assert(legacy && !legacy.door.attributes.avAtlasRect && legacy.door.attributes.position.array.every((value, i) => value === shapedProbe.door.attributes.position.array[i]) && legacy.door.attributes.uv.array.every((value, i) => value === shapedProbe.door.attributes.uv.array[i]), 'approved material inheritance changes existing door position/UV contract');
    }
    t.note(JSON.stringify({ doorProof: { key, actualShaped: !!door.rect, actualAttributes: Object.keys(door.panel.geometry.attributes), probeShaped: !!shapedProbe, probeAttributes: shapedProbe ? Object.keys(shapedProbe.door.attributes) : [] } }));
    checkAperture(vehicle, model, key);
    rows.push({ key, nearTriangles, farTriangles, seat: seatLine, clearance, pivots: model.wheels.map(wheel => [wheel.wheel.position.x, wheel.wheel.position.y, wheel.wheel.position.z, wheel.radius]) });
  }
  t.assert(seen.size === 3, 'all three approved SUV styles are not accessible from stable IDs');
  for (const [type, body, equipment] of [['police', 'utility', 'marked'], ['police', 'utility', 'unmarked'], ['suv', 'tahoe', 'unmarked']]) {
    const look = { body, livery: equipment === 'marked' ? 'sheriff' : 'unmarked', equipment, unmarked: equipment === 'unmarked', paint: equipment === 'marked' ? '#ffffff' : '#1c2026', unit: '27' },
      vehicle = { type, id: 40, color: '#123014', policeLook: { body, livery: look.livery } }, model = api.makeAssetPoliceVehicle(vehicle, look);
    t.assert(model.paint.color.equals(new Three.Color(look.paint)), equipment + ': patrol paint incorrectly inherits dark gameplay vehicle colour');
    t.assert(model.paint.map === scope.fixtureTexture && model.paint.userData.approvedPaint, equipment + ': actual approved source paint material was not constructed');
    if (equipment === 'marked') {
      const ownership = model.kit.sideBodyLivery;
      t.assert(ownership?.[0].movedTriangles === 434 && ownership?.[1].movedTriangles === 213,
        'marked S2 must coat complete connected source door/quarter skins at both levels');
      const triangleKeys = geometries => geometries.flatMap(geometry => {
        const names = Object.keys(geometry.attributes).filter(name => name !== 'liveryUv').sort(), keys = [];
        for (let i = 0; i < geometry.index.count; i += 3) {
          const values = [];
          for (let j = 0; j < 3; j++) {
            const vi = geometry.index.getX(i + j);
            for (const name of names) {
              const attr = geometry.attributes[name];
              for (let component = 0; component < attr.itemSize; component++) values.push(Math.fround(attr.getComponent(vi, component)));
            }
          }
          keys.push(JSON.stringify(values));
        }
        return keys;
      }).sort();
      for (const [level, suffix, transfer] of [[model.kit, '', ownership[0]], [model.kit.far, 'Far', ownership[1]]]) {
        const original = ['shell', 'panels', 'hood', 'trim', 'cabin'].map(name => api.vaGeometry(header.models.s2_suv, { header, arrays }, name + suffix, model.kit.k)).filter(Boolean),
          before = triangleKeys(original), after = triangleKeys([level.shell, level.paint, level.hood, level.trim]);
        t.assert(before.length === after.length && before.every((value, i) => value === after[i]),
          'marked S2 ' + suffix + ': role transfer loses source corners, normals, UVs, finish, colour or winding');
        t.assert(transfer.before.shell + transfer.before.trim === transfer.after.shell + transfer.after.trim,
          'marked S2 ' + suffix + ': role transfer changes draw triangle total');
        t.assert(level.trimOuter.drawRange.count === (header.models.s2_suv.parts['trim' + suffix].triangles - transfer.movedTriangles) * 3,
          'marked S2 ' + suffix + ': exterior impostor prefix includes cabin after role transfer');
      }
      const ray = new Three.Raycaster(), targets = [model.shell, model.panels, model.assetTrim];
      model.body.updateMatrixWorld(true);
      const roof = model.kit.roofDecal, sideNumber = model.kit.sideDecal, scale = model.kit.k,
        glyphs = api.policeDecalGeometry(look, api.bodies[body], model.kit.l, model.dims.w, model.kit),
        glyphPosition = glyphs.attributes.position, glyphNormal = glyphs.attributes.normal;
      t.assert(model.kit.trunkDecal === null && glyphs.index.count / 3 === 12 && glyphPosition.count === 24,
        'marked S2 must have one roof number and two side numbers, without a sedan trunk duplicate');
      t.assert(sideNumber.y > header.models.s2_suv.sill * scale && sideNumber.y + .085 * scale < model.kit.glass.base - .03 * scale,
        'marked S2 side number sits beside upper glass/roof instead of the rear quarter');
      // Clip every real source triangle against the complete roof-number footprint.
      // Taking source centroids or just glyph corners misses a bowed roof or rail crossing.
      let top = -Infinity;
      for (const level of [model.kit, model.kit.far]) for (const geometry of [level.paint, level.trim]) {
        const pos = geometry.attributes.position;
        for (let i = 0; i < geometry.index.count; i += 3) {
          let polygon = [0, 1, 2].map(j => new Three.Vector3().fromBufferAttribute(pos, geometry.index.getX(i + j)).toArray());
          for (const [axis, boundary, sign] of [[0, roof.x - roof.length / 2, 1], [0, roof.x + roof.length / 2, -1],
            [2, -roof.width / 2, 1], [2, roof.width / 2, -1]]) {
            const clipped = [];
            for (let j = 0; j < polygon.length; j++) {
              const a = polygon[j], b = polygon[(j + 1) % polygon.length], da = sign * (a[axis] - boundary), db = sign * (b[axis] - boundary);
              if (da >= 0) clipped.push(a);
              if ((da >= 0) !== (db >= 0)) clipped.push(a.map((value, component) => value + (b[component] - value) * da / (da - db)));
            }
            polygon = clipped;
          }
          for (const point of polygon) top = Math.max(top, point[1]);
        }
      }
      t.assert(Number.isFinite(top) && roof.y - top >= .04 && roof.y - top < .15,
        'marked S2 roof number intersects the bowed roof/rails or floats above it at either LOD: ' + JSON.stringify({ top, roof }));
      for (let i = 0; i < glyphPosition.count; i++) if (glyphNormal.getY(i) > .9)
        t.assert(Math.abs(glyphPosition.getZ(i)) < .48 * scale && Math.abs(glyphPosition.getZ(i)) <= roof.width / 2 + 1e-5 &&
          Math.abs(glyphPosition.getX(i) - roof.x) <= roof.length / 2 && glyphPosition.getY(i) >= top + .04,
        'marked S2 aerial glyph touches a source roof rail or passes below the roof');
      for (const sign of [-1, 1]) {
        ray.set(new Three.Vector3(sideNumber.x, sideNumber.y, sign * 2 * scale), new Three.Vector3(0, 0, -sign));
        const hit = ray.intersectObjects(targets, false)[0];
        t.assert(hit && hit.object !== model.assetTrim && Math.abs(hit.point.z) < sideNumber.half + .06,
          'marked S2 quarter number has no painted source side behind its anchor');
      }
      const sideClearances = [];
      for (let base = 0; base < glyphPosition.count; base += 4) {
        if (Math.abs(glyphNormal.getZ(base)) < .9) continue;
        const sign = Math.sign(glyphNormal.getZ(base)), xs = [0, 1, 2, 3].map(j => glyphPosition.getX(base + j)),
          ys = [0, 1, 2, 3].map(j => glyphPosition.getY(base + j)), plane = Math.abs(glyphPosition.getZ(base));
        for (const tx of [0, .25, .5, .75, 1]) for (const ty of [0, .25, .5, .75, 1]) {
          const x = Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) * tx,
            y = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * ty;
          ray.set(new Three.Vector3(x, y, sign * 2 * scale), new Three.Vector3(0, 0, -sign));
          const hit = ray.intersectObjects(targets, false)[0], clearance = hit ? plane - Math.abs(hit.point.z) : -Infinity;
          t.assert(hit && hit.object !== model.assetTrim && hit.object.geometry.attributes.liveryUv && clearance > 0 && clearance < .12 * scale,
            'marked S2 side glyph clips, floats or overlaps glass/plastic/wheel void: ' + JSON.stringify({ x, y, sign, clearance }));
          sideClearances.push(clearance / scale);
        }
      }
      const unrelated = { approvedKey: 's1_jimny', trunkDecal: { x: 1, y: 2 } }, unrelatedBefore = JSON.stringify(unrelated);
      api.policeApprovedDecalAnchors(unrelated, {});
      t.assert(JSON.stringify(unrelated) === unrelatedBefore, 'S2 decal repair mutates an unrelated approved model');
      t.note(JSON.stringify({ sheriffDecals: { roof, side: sideNumber, trunk: model.kit.trunkDecal,
        maximumSourceRoofInFootprint: top, minimumClearanceMetres: (roof.y - top) / scale,
        sideGlyphSamples: sideClearances.length, sideClearanceMetres: [Math.min(...sideClearances), Math.max(...sideClearances)],
        glyphTriangles: glyphs.index.count / 3, sourceGeometryChanged: false } }));
      for (const side of [-1, 1]) for (const x of [-.7, -.25, .05, .5, .8]) for (const y of [.76, .82, .9, .94]) {
        ray.set(new Three.Vector3(x * model.kit.k, y * model.kit.k, side * 2 * model.kit.k), new Three.Vector3(0, 0, -side));
        const hit = ray.intersectObjects(targets, false)[0];
        t.assert(hit && hit.object !== model.assetTrim && hit.object.geometry.attributes.liveryUv,
          'marked S2 source door has an exposed dark trim triangle at ' + [side, x, y]);
      }
      const shader = { vertexShader: Three.ShaderLib.physical.vertexShader, fragmentShader: Three.ShaderLib.physical.fragmentShader, uniforms: {} };
      model.paint.onBeforeCompile(shader);
      t.assert(shader.uniforms.approvedLivery?.value === model.paint.userData.approvedLivery && /approvedDecal\.rgb\s*\*\s*diffuse/.test(shader.fragmentShader), 'marked sheriff shader does not sample the separate patrol decal with its actual paint palette');
      for (const part of [model.shell, model.hood, model.panels]) {
        const color = part.geometry.attributes.color;
        // Three applies source vertex/instance colours to the sampled decal too. A white marked
        // palette and white source vertices must keep an opaque white door/star legible; vehicle.color is dark.
        const minimum = [0, 1, 2].map(channel => {
          let value = 1;
          for (let i = 0; i < color.count; i++) value = Math.min(value, color.getComponent(i, channel));
          return value * model.paint.color.toArray()[channel];
        });
        t.assert(Math.min(...minimum) >= .95, 'opaque white sheriff livery is darkened by the actual paint/source vertex composition');
      }
    }
    else t.assert(!model.kit.sideBodyLivery, 'unmarked S2 unexpectedly inherits marked body face-role transfer');
    t.assert(model.approvedAsset === 's2_suv' && model.police && model.wheels.length === 4, equipment + ': full-size patrol SUV missing');
    t.assert(model.shell.geometry.attributes.liveryUv?.count === model.shell.geometry.attributes.position.count, equipment + ': projected livery missing');
    const source = api.vaGeometry(header.models.s2_suv, { header, arrays }, 'shell', model.kit.k), uv = model.shell.geometry.attributes.uv;
    t.assert(source.attributes.uv.array.every((value, index) => value === uv.array[index]), equipment + ': livery overwrites authored atlas UVs');
    for (const mesh of [model.hood, model.panels]) t.assert(mesh.geometry.attributes.liveryUv && mesh.geometry.attributes.finish, equipment + ': paint panel loses PBR/livery coordinates');
    t.assert(equipment !== 'marked' || !!model.kit.equipment && model.kit.anchors.length >= 5 && model.kit.beaconLeft && model.kit.beaconRight, 'sheriff source body has no fitted police equipment');
    const seat = model.seats; lawRows.push({ equipment, body, seat: [seat.x / seat.M, seat.y / seat.M, -seat.z / seat.M, seat.lean, model.kit.glass.base / seat.M], rear: seat.rear !== null });
    const recorded = api.DRIVEBY_SEATS['law:' + body], measured = [seat.x / seat.M, seat.y / seat.M, -seat.z / seat.M, seat.lean];
    t.assert(Math.hypot(...measured.slice(0, 3).map((v, i) => v - recorded[i])) + Math.abs(measured[3] - recorded[3]) < .002, body + ': law drive-by seat drifts from fitted driver');
    const running = { speed: 24, av: 0, spinSpeed: 0, tyres: { steer: .38, lock: [0, 0] } }, front = model.wheels.find(w => w.front), rear = model.wheels.find(w => !w.front);
    api.animateApprovedSuvWheels(running, model, .125);
    t.assert(Math.abs(front.wheel.rotation.y + .38) < 1e-9 && rear.wheel.rotation.y === 0, equipment + ': front does not follow physics steering');
    t.assert(front.wheel.rotation.z < 0 && rear.wheel.rotation.z < 0, equipment + ': patrol tyres remain static');
    running.speed = -24; api.animateApprovedSuvWheels(running, model, .125);
    t.assert(Math.abs(front.wheel.rotation.z) < 1e-9 && Math.abs(rear.wheel.rotation.z) < 1e-9, equipment + ': reverse wheel roll has wrong sign');
    running.speed = 24; running.tyres.lock = [1, 1]; api.animateApprovedSuvWheels(running, model, .125);
    t.assert(front.wheel.rotation.z === 0 && rear.wheel.rotation.z === 0, equipment + ': locked police tyres rotate');
    running.tyres.lock = [0, 0]; running.spinSpeed = 12; api.animateApprovedSuvWheels(running, model, .125);
    t.assert(Math.abs(rear.wheel.rotation.z + 36 * .125 / (rear.radius * model.drawScale)) < 1e-9, equipment + ': driven axle spin or model-scale radius lost');
    const snapshot = JSON.stringify(running); api.animateApprovedSuvWheels(running, model, 0); t.assert(snapshot === JSON.stringify(running), equipment + ': renderer changes physics state');
    t.assert(model.impostorParts.every(part => !part.geometry || part.geometry.attributes.position.count > 0), equipment + ': empty far impostor part');
    if (equipment === 'marked') {
      // Exercise the actual renderer damage function on the actual source-backed Sheriff.
      // A previously opened/sprung synthetic lid must disappear when the intact source hatch returns.
      vehicle.dents = [];
      const damage = vehicle.damage = { parts: { hood: 0, bumperFront: 0, bumperRear: 0, doorLeft: 0, doorRight: 0, trunk: 0 },
        glass: { front: 0, rear: 0, left: 0, right: 0 }, tires: {}, front: 0, left: 0, right: 0, burnt: false },
        sourceGlass = model.cabin.geometry, sourcePositions = sourceGlass.attributes.position.array.slice(), intactGlass = model.glass;
      api.carBodyDamage(vehicle, model, damage);
      t.assert(!model.trunk, 'pristine closed Sheriff creates a synthetic lid over its source rear window');
      vehicle.trunkOpen = true; vehicle.trunkOpenAt = 8;
      api.carBodyDamage(vehicle, model, damage);
      const lid = model.trunk;
      t.assert(lid?.visible && lid.children[0]?.geometry === model.trunkGeometry, 'actual open trunk does not create/show its approved paint lid');
      t.assert(lid.rotation.z < -.5 && model.trunkWell?.visible, 'actual open trunk loses its hinge/well animation');
      vehicle.trunkOpen = false;
      api.carBodyDamage(vehicle, model, damage);
      t.assert(model.trunk === lid && !lid.visible && lid.rotation.z === 0, 'closing a previously created lid leaves a paint slab across the source window');
      t.assert(!model.trunkWell.visible, 'closed trunk retains a visible synthetic well');
      damage.parts.trunk = 1;
      api.carBodyDamage(vehicle, model, damage);
      t.assert(lid.visible && lid.rotation.z < 0, 'sprung damage lid disappears despite damaged trunk state');
      damage.parts.trunk = 0;
      api.carBodyDamage(vehicle, model, damage);
      t.assert(!lid.visible && lid.rotation.z === 0, 'repaired sprung trunk retains its closed synthetic paint slab');
      t.assert(model.cabin.geometry === sourceGlass && model.cabin.material === intactGlass && model.cabin.visible, 'lid repair removes or replaces the source rear glass');
      t.assert(sourceGlass.attributes.position.array.every((value, index) => value === sourcePositions[index]), 'trunk open/damage/repair modifies shared source cabin geometry');
      t.assert(model.shell.visible && model.panels.visible, 'hidden repaired lid also hides the intact source closed hatch/body');
      t.note(JSON.stringify({ trunkVisibility: { source: 'production carBodyDamage + actual Generic SUV Sheriff', opened: true, closedHidden: true, sprung: true, repairedHidden: true, sourceGlassPreserved: true } }));
      checkAperture(vehicle, model, 'marked-sheriff');
    }
  }
  for (const type of ['sedan', 'coupe']) checkAperture({ type, id: 102, color: '#719260' }, api.makeAssetCar({ type, id: 102, color: '#719260' }), 'legacy-' + type);
  const oldPatrol = { type: 'police', id: 103, color: '#123014' }, oldLook = { body: 'crownvic', livery: 'sheriff', equipment: 'marked', unmarked: false, paint: '#ffffff', unit: '27' };
  checkAperture(oldPatrol, api.makeAssetPoliceVehicle(oldPatrol, oldLook), 'legacy-crownvic');
  const sportsVehicle = { type: 'chevette', id: 105, color: '#e9b82a' }, sportsModel = api.makeAssetCar(sportsVehicle), sports = sportsModel.kit.asset, seat = sportsModel.seats;
  t.assert(sports.type === 'c8_hari' && sportsModel.kit.nativeDoors[-1] && sportsModel.kit.nativeDoors[1], 'C8 native source doors not wired into actual builder');
  t.assert(sports.hasInterior === true && sports.parts['cabin.seats']?.triangles > 0 && !sportsModel.approvedInterior, 'C8 authored seats were lost or replaced by a fallback');
  checkAperture(sportsVehicle, sportsModel, 'native-c8');
  for (const side of [-1, 1]) {
    const door = sportsModel.doors[side], authored = sports.doors[side < 0 ? 'left' : 'right'];
    t.assert(door.native && door.layers.every(layer => !layer.userData.vehicleDoorInside), 'C8 genuine door card is covered by a procedural panel');
    t.assert(door.pivot.position.toArray().every((value, i) => Math.abs(value - authored.hinge[i] * sportsModel.kit.k) < .00001), 'C8 authored door hinge moved');
    t.assert(door.layers.some(layer => layer.userData.vehicleDoorSource === sportsModel.opticalGlass), 'C8 native mirror optical covers do not travel with door');
  }
  const sportsClearance = api.cabinClearance(sportsModel.kit.glass, sportsModel.kit.l, seat.glass.w, seat.M, api.cabinSeatClouds(), seat.x, seat.y, Math.abs(seat.z), seat.lean) / seat.M;
  const seatGeometry = api.vaGeometry(sports, scope.fixtureSports, 'cabin.seats', sportsModel.kit.k), seatMesh = new Three.Mesh(seatGeometry, new Three.MeshBasicMaterial({ side: Three.DoubleSide })), probes = [];
  seatMesh.updateMatrixWorld(true);
  // The pose's hip is a joint reference, not the cushion's top: procedural seatAt
  // places that top 2cm above the hip. Probe the actual authored cushions, not just
  // the analytic roof; a low generic fit could otherwise pass while inside a backrest.
  for (const side of [-1, 1]) for (const dz of [-.04, 0, .04]) {
    const plan = side > 0 ? seat.passenger : seat;
    t.assert(!!plan, 'C8 asymmetric authored passenger cushion has no independent seat plan');
    const z = side * Math.abs(plan.z) + dz * plan.M,
      ray = new Three.Raycaster(new Three.Vector3(plan.x, 2 * plan.M, z), new Three.Vector3(0, -1, 0)),
      hit = ray.intersectObject(seatMesh, false)[0], gap = hit ? (hit.point.y - plan.y) / plan.M : Infinity;
    // Lateral samples include the source's raised bolster; the joint itself must
    // be above the flatter cushion, not the higher inboard rim of that cushion.
    t.assert(hit && (dz !== 0 || hit.face.normal.y > .7 && gap >= 0 && gap < .035), 'C8 fitted hip misses its authored upward cushion or lies in the backrest: ' + JSON.stringify({ x: plan.x / plan.M, z: z / plan.M, hipY: plan.y / plan.M, hitY: hit?.point.y / plan.M, gap, upward: hit?.face.normal.y }));
    probes.push({ x: plan.x / plan.M, z: z / plan.M, hipY: plan.y / plan.M, cushionY: hit.point.y / plan.M, cushionAboveHip: gap, upward: hit.face.normal.y });
  }
  t.note(JSON.stringify({ sportsSeatProbe: { hipY: seat.y / seat.M, probes } }));
  const passenger = seat.passenger, passengerClearance = api.cabinClearance(sportsModel.kit.glass, sportsModel.kit.l, seat.glass.w, seat.M, api.cabinSeatClouds(), passenger.x, passenger.y, Math.abs(passenger.z), passenger.lean) / seat.M;
  t.assert(passengerClearance >= .02, 'C8 independent physical passenger fit pushes actual production heads through roof/glass');
  t.assert(sportsClearance >= .02, 'C8 physical cushion fit pushes actual production head geometry through roof/glass');
  const fittedSeat = [seat.x / seat.M, seat.y / seat.M, -seat.z / seat.M, seat.lean, sportsModel.kit.glass.base / seat.M];
  t.assert(fittedSeat.every((value, index) => Math.abs(value - api.DRIVEBY_SEATS.chevette[index]) < .002), 'C8 gameplay drive-by seat drifts from its real cushion/headroom fit');
  const occupantPoses = [];
  const wheel = seat.wheel, measuredWheel = [.31392, .72501, -.358883, .165, .25284];
  t.assert([wheel.x / seat.M, wheel.y / seat.M, wheel.z / seat.M, wheel.r / seat.M, wheel.tilt].every((v, i) => Math.abs(v - measuredWheel[i]) < .00001), 'C8 seat wheel targets drift from measured source steering rim');
  for (const index of [0, 1]) {
    const plan = index ? passenger : seat, expected = [plan.x, plan.y, index ? -plan.z : plan.z];
    t.assert(api.seatOccupant(sportsVehicle, sportsModel, index, 1 / 60, 0), 'C8 actual production occupant pose was not drawn');
    const pose = api.fixtureOccupantPose();
    t.assert(pose.hip.every((v, axis) => Math.abs(v - expected[axis]) < 1e-7) && pose.lean === plan.lean, 'C8 production occupant ignores its actual source-backed driver/passenger seat');
    t.assert(pose.feet.every(foot => Math.abs(foot[1] - plan.pedalY) < 1e-7), 'C8 occupant feet use a different seat plan than hips');
    if (index === 0) for (const hand of pose.hands) {
      const x = hand[0] - wheel.x, y = hand[1] - wheel.y, z = hand[2] - wheel.z;
      t.assert(Math.abs(Math.hypot(x, y, z) - wheel.r) < 1e-7 && Math.abs(x * Math.cos(wheel.tilt) - y * Math.sin(wheel.tilt)) < 1e-7, 'C8 actual driver hand misses the source steering rim');
    } else t.assert(pose.hands.every(hand => Math.abs(hand[0] - plan.x - .3 * plan.M) < 1e-7 && Math.abs(hand[1] - plan.y - .1 * plan.M) < 1e-7), 'C8 passenger hands use driver wheel targets instead of their actual lap');
    occupantPoses.push(pose);
  }
  t.note(JSON.stringify({ sportsPassengerSeat: { fitted: [passenger.x / passenger.M, passenger.y / passenger.M, -passenger.z / passenger.M, passenger.lean], clearanceMetres: passengerClearance, measuredWheel, actualProductionOccupantPoses: occupantPoses } }));
  t.note(JSON.stringify({ sportsSeat: { key: sports.type, M: seat.M, fitted: [seat.x / seat.M, seat.y / seat.M, -seat.z / seat.M, seat.lean, sportsModel.kit.glass.base / seat.M], clearanceMetres: sportsClearance, sourceSeats: sports.parts['cabin.seats'], glass: sports.glass } }));
  for (const [type, id] of [['chevette', 981], ['suv', 984], ['sedan', 985]]) {
    const vehicle = { type, id, color: '#e9b82a', hp: 0, maxhp: 100, dents: [], damage: clearDamage() }, model = api.makeAssetCar(vehicle),
      originals = new Map([model.shell, model.panels, model.assetTrim, model.opticalGlass].filter(Boolean).map(mesh => [mesh, mesh.material]));
    t.assert(!model.doors, type + ': late-door proof accidentally prebuilds a door');
    // Real frame order: paintVehicle swaps the closed body before applyVehicleDamage
    // builds its first sprung door. Test this without pre-opening review doors.
    api.assetCharSwap(vehicle, model, true);
    vehicle.damage.burnt = true; vehicle.damage.parts.doorLeft = 1;
    api.carBodyDamage(vehicle, model, vehicle.damage);
    const layers = model.doors[-1].layers.filter(layer => layer.userData.vehicleDoorSource && !layer.userData.doorGlass);
    t.assert(layers.some(layer => layer.material.userData.assetChar), type + ': newly created wreck door does not immediately share source char');
    t.assert(layers.filter(layer => layer.material.userData.assetChar).every(layer => model.assetChar.swaps.includes(layer)), type + ': late charred source door cannot restore its original material on repair');
    // A later shape-driven swap must neither lose that source nor add duplicate releases.
    if (type !== 'chevette') api.assetCharSwap(vehicle, model, true);
    const swappedMeshes = model.assetChar.swaps.filter((_, i) => !(i % 2));
    t.assert(swappedMeshes.length === new Set(swappedMeshes).size, type + ': late door registers duplicate char release records');
    api.assetCharRelease(model); vehicle.hp = 100; vehicle.damage = clearDamage();
    api.carBodyDamage(vehicle, model, vehicle.damage);
    vehicle.doorSwing = { openAt: 8, closeAt: 0 }; api.swingDriverDoor(vehicle, model);
    for (const layer of layers) {
      const original = originals.get(layer.userData.vehicleDoorSource);
      t.assert(layer.visible && original && layer.material === original && !layer.material.userData.assetChar, type + ': first door remains charred when reopened after repair');
      t.assert(layer.material.map === original.map && layer.material.roughnessMap === original.roughnessMap && layer.material.metalnessMap === original.metalnessMap && layer.material.emissiveMap === original.emissiveMap, type + ': late-door repair loses authored PBR/emission maps');
    }
    t.note(JSON.stringify({ lateDoorCharRepair: { type, builder: 'actual packed production builder', sourceLayers: layers.length, inheritedCharAdopted: true, reopenedSourceMaterials: true, shaderOrGeometryChange: false } }));
  }
  t.note(JSON.stringify({ approvedSUVs: rows, lawRows, policeSource: 's2_suv', headroom: 'actual production head geometry and fit; rendered check separate' }));
}
