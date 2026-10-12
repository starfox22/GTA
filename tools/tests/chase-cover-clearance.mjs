// The production boom sweep respects finite canopy/deck slabs, including grid-cell edges.
import fs from 'node:fs';
import vm from 'node:vm';
export default async function (t) {
  const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
  const buildings = [];
  const c = vm.createContext({ Math, Map, buildingsNear: () => buildings, airCoverVolumes: () => [], CHASE_WALL_MARGIN: 3 });
  const covers = read('air-cover');
  vm.runInContext(covers.slice(covers.indexOf('    const OVERHEAD_CELL'), covers.indexOf('    const buildingCover')), c);
  const camera = read('chase-camera');
  vm.runInContext(camera.slice(camera.indexOf('    function chaseBoomReach('), camera.indexOf('    /* A teleport', camera.indexOf('    function chaseBoomReach('))), c);
  t.assert(c.chaseBoomReach(100, 100, 8, 1, 0, 0, 80) === 80, 'open air boom shortened');
  c.registerOverheadCover(100, 100, 40, 40, 0, 16, 18);
  t.assert(c.chaseBoomReach(100, 100, 8, 1, 0, 0, 80) === 80, 'space below canopy treated as a wall');
  t.assert(c.chaseBoomReach(100, 100, 24, 1, 0, 0, 80) === 80, 'space above canopy treated as a wall');
  t.assert(c.chaseInsideBuilding(100, 100, 17), 'camera can enter the roof slab');
  t.assert(c.chaseBoomReach(100, 100, 8, 0, 0, 1, 30) <= 5, 'upward boom crosses canopy');
  t.assert(c.chaseBoomReach(100, 100, 30, 0, 0, -1, 30) <= 9, 'downward boom crosses canopy');
  c.registerOverheadCover(250, 100, 4, 10, 0, 20, 22);
  t.assert(c.chaseInsideBuilding(257, 100, 21, 4), 'camera margin crosses a grid edge without finding cover');
  c.registerOverheadCover(400, 400, 28, 4, Math.PI / 4, 30, 34);
  t.assert(c.chaseInsideBuilding(410, 410, 32), 'turned canopy along its long axis is missed');
  t.assert(!c.chaseInsideBuilding(392, 408, 32), 'turned canopy blocks open air beside its narrow axis');
  buildings.push({ x: 500, y: 500, w: 50, h: 50, base: 50, height: 30 });
  t.assert(!c.chaseInsideBuilding(520, 520, 20), 'raised building blocks empty space below its base');
  t.assert(c.chaseInsideBuilding(520, 520, 60), 'raised building is not solid at its actual height');
  t.assert(!c.chaseInsideBuilding(520, 520, 90), 'raised building blocks sky above its top');
  c.registerOverheadCover(700, 700, 40, 40, 0, 25, 27);
  const pivot = c.chaseCoverPivot(700, 700, 25.6, 0, 3.7018);
  t.assert(pivot < 25 - 3.7018, 'tall vehicle pivot remains inside canopy clearance');
  t.assert(!c.chaseInsideBuilding(700, 700, pivot, 3.7018), 'corrected sweep starts inside canopy');
  t.assert(c.chaseBoomReach(700, 700, pivot, 1, 0, 0, 80, 3.7018) === 80, 'corrected pivot cannot escape horizontally');
  t.assert(c.chaseCoverPivot(700, 700, 35, 27, 3.7018) === 35, 'subject on deck pulled under it');
  t.assert(c.chaseCoverPivot(800, 700, 25.6, 0, 3.7018) === 25.6, 'nearby open air pivot lowered');
  t.assert(c.chaseCoverPivot(257, 100, 21, 0, 4) < 16, 'pivot correction misses neighboring grid cell');
  t.note('18 finite-volume, rotated-cover, grid-edge, boom and start-overlap assertions');
}
