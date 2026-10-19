// Real Three.js airport geometry against shared overhead/support collision plans.
// No image rendering or frame-rate claim; native appearance is checked separately.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const read = file => fs.readFileSync(new URL('../../src/' + file + '.js', import.meta.url), 'utf8');
export default async function airportArchitecture(t) {
  const noop = () => {}, paint = new Proxy({}, { get: (_, key) => key === 'measureText' ? () => ({ width: 100 }) : noop, set: () => true });
  const mats = new Map(), scope = vm.createContext({
    Three, Math, Map, Set, Float32Array, Uint32Array, UNITS_PER_METRE: 8, bakedCanvases: [], buildings: [],
    boxGeo: new Three.BoxGeometry(1, 1, 1), cylinderGeo: new Three.CylinderGeometry(1, 1, 1, 10),
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => paint }) },
    staticMat: (color, roughness = 0.7, metalness = 0) => {
      const key = color + '|' + roughness + '|' + metalness;
      if (!mats.has(key)) mats.set(key, new Three.MeshStandardMaterial({ color, roughness, metalness }));
      return mats.get(key);
    },
    BRIDGES: [], RAIL_STATIONS: [], railPiers: [], railDecks: () => [], railStationCovers: () => [],
    railLift: () => ({}), terrainHeight: () => 0, buildingsNear: () => [],
    drawbridgeOpenGap: () => false, landAt: () => true, entityElevation: p => p.altitude || 0,
  });
  scope.mesh = (geometry, material, parent, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new Three.Mesh(geometry, material);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m;
  };
  scope.box = (parent, x, y, z, w, h, d, material) => scope.mesh(scope.boxGeo, material, parent, x, y, z, w, h, d);
  const county = read('county-map');
  const api = vm.runInContext(read('geography-regions') + '\n' + county.slice(0, county.indexOf('    // The bridges (county')) + '\n' +
    read('physics-shapes') + '\n' + read('air-cover') + '\n' +
    read('airport-terminal3d') + '\n({AIRPORT_JETBRIDGES,AIRPORT_CANOPIES,AIRPORT_TOWERS,AIRPORT_SCENERY_SOLIDS,AIRPORT_APRONS,' +
    'airportBridgeSupports,airportOverheadVolumes,airportJetbridge,airportEntranceCanopy,airportTower,' +
    'airCoverVolumes,overheadCover,airCoverRay,airCoverStopsShot,addRailCoverColliders,staticBodies,staticGrid,landAtExact})', scope);
  const inVolume = (p, v, epsilon = 0.002) => {
    const dx = p.x - v.x, dz = p.z - v.y, ca = Math.cos(v.a || 0), sa = Math.sin(v.a || 0);
    return Math.abs(dx * ca + dz * sa) <= v.hx + epsilon && Math.abs(-dx * sa + dz * ca) <= v.hy + epsilon &&
      p.y >= v.minHeight - epsilon && p.y <= v.height + epsilon;
  };
  const supportVolume = p => ({ x: p.x + p.w / 2, y: p.y + p.h / 2, hx: p.w / 2, hy: p.h / 2, a: 0, minHeight: 0, height: p.height });
  const volumes = api.airportOverheadVolumes();
  let vertices = 0, meshes = 0;
  for (const bridge of api.AIRPORT_JETBRIDGES) {
    const group = new Three.Group(); api.airportJetbridge(group, bridge); group.updateMatrixWorld(true);
    const supports = api.airportBridgeSupports(bridge), bounds = [...volumes, ...supports.map(supportVolume)];
    let missed = null;
    group.traverse(m => {
      if (!m.isMesh) return;
      meshes++;
      const pos = m.geometry.getAttribute('position'), point = new Three.Vector3();
      for (let i = 0; i < pos.count; i++) {
        vertices++;
        point.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (!bounds.some(v => inVolume(point, v))) missed ||= point.toArray();
      }
    });
    t.assert(!missed, `${bridge.gate}: drawn bridge vertex outside overhead/support collision plan: ${missed}`);
    for (const support of supports)
      t.assert(api.AIRPORT_SCENERY_SOLIDS.some(p => p.x === support.x && p.y === support.y && p.w === support.w && p.h === support.h),
        bridge.gate + ': drawn column missing ground collision footprint');
    const y = bridge.from + 160;
    t.assert(api.overheadCover(bridge.x, y, 0)?.kind === 'airport jetbridge', bridge.gate + ': missing overhead cover');
    t.assert(!api.airCoverRay({ x: bridge.x - 30, y, altitude: 0 }, { x: bridge.x + 30, y, altitude: 0 }),
      bridge.gate + ': a pedestrian-height sight ray must pass under the bridge');
    t.assert(api.airCoverRay({ x: bridge.x - 30, y, altitude: 16 }, { x: bridge.x + 30, y, altitude: 16 }),
      bridge.gate + ': an elevated sight ray must meet the bridge');
    t.assert(!api.airCoverStopsShot(bridge.x, y, 0) && api.airCoverStopsShot(bridge.x, y, 20) && !api.airCoverStopsShot(bridge.x, y, 60),
      bridge.gate + ': shot coverage must respect actual slab height');
  }
  for (const canopy of api.AIRPORT_CANOPIES) {
    const group = new Three.Group(); api.airportEntranceCanopy(group, canopy); group.updateMatrixWorld(true);
    const bounds = [volumes.find(v => v.x === canopy.x && v.kind === 'airport entrance canopy'),
      ...canopy.posts.map(([x, y]) => ({ x, y, hx: 1.5, hy: 1.5, a: 0, minHeight: 0, height: canopy.bottom }))];
    let missed = null;
    group.traverse(m => {
      if (!m.isMesh) return;
      const pos = m.geometry.getAttribute('position'), point = new Three.Vector3();
      for (let i = 0; i < pos.count; i++) {
        point.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (!bounds.some(v => inVolume(point, v))) missed ||= point.toArray();
      }
    });
    t.assert(!missed, `${canopy.x}: drawn canopy/post outside its collision plan: ${missed}`);
    t.assert(api.overheadCover(canopy.x + 30, canopy.y, 0)?.kind === 'airport entrance canopy', canopy.x + ': missing entrance cover');
  }
  api.addRailCoverColliders();
  t.assert(api.staticBodies.length === volumes.length, 'every airport overhead volume must enter the actual aircraft collider grid');
  for (const body of api.staticBodies) {
    t.assert(body.minHeight >= 20 && body.height > body.minHeight, body.kind + ': overhead collider must leave the apron open');
    const key = Math.floor(body.x / 256) * 4096 + Math.floor(body.y / 256);
    t.assert(api.staticGrid.get(key)?.includes(body), body.kind + ': overhead collider missing its numeric grid cell');
  }
  for (const apron of api.AIRPORT_APRONS)
    t.assert([[apron.x, apron.y], [apron.x + apron.w, apron.y], [apron.x, apron.y + apron.h], [apron.x + apron.w, apron.y + apron.h]]
      .every(([x, y]) => api.landAtExact(x, y)), apron.airport + ': the concrete apron must remain on dry land');
  t.note(JSON.stringify({ bridges: api.AIRPORT_JETBRIDGES.length, overheadVolumes: volumes.length, bridgeMeshes: meshes,
    checkedBridgeVertices: vertices, mergedMaterials: mats.size, drawnSupportFootprints: api.AIRPORT_SCENERY_SOLIDS.filter(p => /column/.test(p.kind)).length }));
}
