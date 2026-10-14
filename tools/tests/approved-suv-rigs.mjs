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
  const glass = new Three.MeshStandardMaterial(), trim = new Three.MeshStandardMaterial(),
    materials = { trim, rubber: trim, rim: trim, glass, glassFar: glass },
    lamps = Object.fromEntries(['headOff', 'tailOff', 'headOn', 'tailOn', 'brake'].map(name => [name, new Three.MeshStandardMaterial()])),
    player = { car: null }, scope = vm.createContext({ Three, fixture: { header, arrays }, materials, lamps, player, Uint8Array, Uint16Array, Uint32Array, Float32Array,
      UNITS_PER_METRE: 8, PERSON_HEIGHT: 14, CAR_M: 8, TAU: Math.PI * 2, performance, gameTime: 10, vehicleGlassBand: () => null, CAR_SWATCH: { paint: 0, black: 2 }, CITY_SIZE: 4096,
      crackedGlassTexture: new Three.Texture(), fixtureTexture: new Three.Texture(), cityMaterialPatch() {}, approvedVehicleAtlasPatch() {}, carGlassMaterial: () => glass, bodyPools: new Map(), carModels: new Map(), BODY_POOL_CAPACITY: 160, bodyPaint: trim, impostorBeaconMaterial: trim, impostorColor: new Three.Color(), boxGeo: new Three.BoxGeometry(), scene: new Three.Scene(), sharedGeometries: new Set(), sharedMaterials: new Set(),
      clamp: (value, lo, hi) => Math.max(lo, Math.min(hi, value)), lerpNumber: (a, b, t) => a + (b - a) * t,
      vehicleSpec: c => c.type === 'police' ? { l: 5.1 * 8, w: 2.18 * 8 } : c.policeLook ? { l: 4.95 * 8, w: 2.24 * 8 } : { l: header.models[['s1_jimny', 's2_suv', 's3_offroad'][(c.id >>> 0) % 3]].dims[0] * 8, w: header.models[['s1_jimny', 's2_suv', 's3_offroad'][(c.id >>> 0) % 3]].dims[2] * 8 }, drivenAxle: () => 'rear',
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
    finishPatch = materialSource.slice(materialSource.indexOf('      function trimCellRect('), materialSource.indexOf('      let civMaterials'));
  const flightSource = read('flight-view3d'), poolSource = flightSource.slice(flightSource.indexOf('      function bodyPoolFor('), flightSource.indexOf('      function bodyImpostor('));
  const approvedSource = read('approved-vehicle-assets3d'), approvedPatch = approvedSource.slice(approvedSource.indexOf('      function approvedVehicleMaterialPatch('), approvedSource.indexOf('      let approvedVehicleMaterialSet;')),
    approvedMaterials = approvedSource.slice(approvedSource.indexOf('      let approvedVehicleMaterialSet;'), approvedSource.indexOf('      function approvedVehiclePaint(')),
    approvedPaint = approvedSource.slice(approvedSource.indexOf('      function approvedVehiclePaint('), approvedSource.indexOf('      const approvedVehicleImpostorPaints'));
  const api = vm.runInContext(materialHeader + finishPatch + dirtSource + approvedPatch + approvedMaterials + approvedPaint + read('cars3d-geometry') + read('character-rig3d') + read('character-near3d') + read('character-near3d-head') + read('driveby-seats') + read('vehicle-assets3d') + read('approved-suv3d') +
    read('police3d-looks') + read('police3d-cabins') + read('cars3d-interior') + read('cars3d-headroom') + read('police3d-asset') + read('damage-crumple') + read('damage3d-crumple') + read('damage3d-bodies') + poolSource + `
      const BODY_CLOSE = { head: { mesh: { geometry: rigHeadGeometry() } } };
      for (const [name, geometry] of Object.entries({ ...rigHairGeometries(), ...rigHatGeometries() })) BODY_CLOSE[name] = { mesh: { geometry } };
      const BODY_NEAR = { head: { mesh: { geometry: nearHeadGeometry() } } };
      function approvedVehicleData() { return fixture; }
      function approvedVehicleModel(key) { return fixture.header.models[key] || null; }
      civSharedMaterials = () => materials;
      function approvedVehicleTexture() { return fixtureTexture; }
      function approvedVehicleImpostorPaint() { return materials.trim; }
      policeLiveryTexture = () => new Three.Texture();
      policeGlyphs = () => ({ material: materials.trim });
      policeDecalGeometry = () => new Three.BoxGeometry(.01, .01, .01);
      ({ makeAssetCar, makeAssetPoliceVehicle, approvedSuvKey, approvedSuvGlassBand, vaGeometry, policeApprovedPanels, animateApprovedSuvWheels, vehicleAssetModel, bodyPoolFor, vehicleDoor, doorPanelGeometries, carBodyDamage, cabinClearance, cabinSeatClouds, DRIVEBY_SEATS })`, scope);
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
    t.assert(expectedAttributes.every(name => door.panel.geometry.attributes[name]), key + ': actual door loses approved material attributes');
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
    rows.push({ key, nearTriangles, farTriangles, seat: seatLine, clearance, pivots: model.wheels.map(wheel => [wheel.wheel.position.x, wheel.wheel.position.y, wheel.wheel.position.z, wheel.radius]) });
  }
  t.assert(seen.size === 3, 'all three approved SUV styles are not accessible from stable IDs');
  for (const [type, body, equipment] of [['police', 'utility', 'marked'], ['police', 'utility', 'unmarked'], ['suv', 'tahoe', 'unmarked']]) {
    const look = { body, livery: equipment === 'marked' ? 'sheriff' : 'unmarked', equipment, unmarked: equipment === 'unmarked', paint: equipment === 'marked' ? '#ffffff' : '#1c2026', unit: '27' },
      vehicle = { type, id: 40, color: '#123014', policeLook: { body, livery: look.livery } }, model = api.makeAssetPoliceVehicle(vehicle, look);
    t.assert(model.paint.color.equals(new Three.Color(look.paint)), equipment + ': patrol paint incorrectly inherits dark gameplay vehicle colour');
    t.assert(model.paint.map === scope.fixtureTexture && model.paint.userData.approvedPaint, equipment + ': actual approved source paint material was not constructed');
    if (equipment === 'marked') {
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
    t.assert(model.approvedAsset === 's2_suv' && model.police && model.wheels.length === 4, equipment + ': full-size patrol SUV missing');
    t.assert(model.shell.geometry.attributes.liveryUv?.count === model.shell.geometry.attributes.position.count, equipment + ': projected livery missing');
    const source = api.vaGeometry(header.models.s2_suv, { header, arrays }, 'shell', model.kit.k), uv = model.shell.geometry.attributes.uv;
    t.assert(uv.array.every((value, index) => value === source.attributes.uv.array[index]), equipment + ': livery overwrites authored atlas UVs');
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
    }
  }
  t.note(JSON.stringify({ approvedSUVs: rows, lawRows, policeSource: 's2_suv', headroom: 'actual production head geometry and fit; rendered check separate' }));
}
