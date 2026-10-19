// CPU production trail pilot/terrain/controls/suspension. Excludes generated scenery, actors and static contacts;
// the unchanged hillclimb-physics/falls browser modules remain the complete-game acceptance checks.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { terrainFallsFixture } from './terrain-falls.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function terrainTrailFixture({ sourceRoot = ROOT, clubSource } = {}) {
  const fixture = terrainFallsFixture({ sourceRoot });
  // Initialize the existing falls fixture's event collector without advancing time.
  fixture.drive({ seconds: 0 });
  const { scope: s, context: ctx } = fixture, fallsUpdate = s.update;
  Object.assign(s, { tone: () => {}, announce: () => {}, city3D: null,
    localStorage: { getItem: () => null, setItem: () => {} }, cash: 0 });
  vm.runInContext(clubSource ?? fs.readFileSync(path.join(sourceRoot, 'src/offroad-club.js'), 'utf8'), ctx);
  const geometry = vm.runInContext('({path:MOUNTAIN_TRAILS[0].path,pads:MOUNTAIN_TRAILS[0].turns,width:MOUNTAIN_TRAILS[0].width,pad:HAIRPIN_PAD})', ctx);
  let trace = [], route, accumulator = 0;
  s.update = dt => {
    s.gameTime += dt;
    accumulator = Math.min(accumulator + dt, 0.1);
    while (accumulator >= 1 / 120) {
      accumulator -= 1 / 120;
      const c = s.player.car;
      s.physicsClock += 1 / 120;
      ctx.controlVehicle(c, c, 1 / 120, true);
      ctx.terrainVehiclePose(c, 1 / 120);
      ctx.cliffSettle(c, 1 / 120);
      c.speed = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
      Object.assign(s.player, { x: c.x, y: c.y, a: c.a });
    }
    ctx.updateHillClimb();
    if (!route) return;
    const c = s.player.car;
    // Independent geometric corridor: polyline carriageway union the authored turning pads.
    // Surface raster 'across' alone overstates departure at hairpins, whose pads are wider.
    let outside = Infinity;
    for (let j = 0; j < geometry.path.length - 1; j++) {
      const [x, y] = geometry.path[j], [x1, y1] = geometry.path[j + 1], dx = x1 - x, dy = y1 - y,
        u = Math.max(0, Math.min(1, ((c.x - x) * dx + (c.y - y) * dy) / (dx * dx + dy * dy)));
      outside = Math.min(outside, Math.hypot(c.x - x - dx * u, c.y - y - dy * u) - geometry.width / 2);
    }
    for (const p of geometry.pads) outside = Math.min(outside, Math.hypot(c.x - p.x, c.y - p.y) - geometry.pad);
    if (outside > 0) route.outsideS += dt;
    route.maxOutside = Math.max(route.maxOutside, outside);
    if (!trace.length || s.gameTime - trace.at(-1).time >= 0.25)
      trace.push({ time: s.gameTime, x: c.x, y: c.y, kmh: c.speed / s.KMH, a: c.a, outside, keys: { ...s.keys } });
  };
  function place(action, fresh) {
    if (fresh) vm.runInContext("player.car=makeCar('crawler',7520,1950,0,false);", ctx);
    s.trailFixtureAction = action;
    // Exactly the production hillClimbConsole placement; its unrelated offroadReport needs scenery/DOM.
    vm.runInContext(`(() => {
      const path=MOUNTAIN_TRAILS[0].path, course=trailCourse(0), top=path.length-24,
        p=trailFixtureAction==='top'?{x:path[top][0],y:path[top][1],i:top}:course.from,
        next=trailFixtureAction==='top'?path[top-2]:path[p.i+2], c=player.car;
      c.x=p.x; c.y=p.y; c.a=Math.atan2(next[1]-p.y,next[0]-p.x); c.vx=c.vy=c.av=c.speed=0;
      Object.assign(player,{x:c.x,y:c.y}); clubState.climb=null; clubState.last=null;
    })()`, ctx);
  }
  function run(frame, { fresh = false, down = false } = {}) {
    place(down ? 'top' : 'gate', fresh);
    trace = []; route = { outsideS: 0, maxOutside: 0 };
    const result = ctx.trailPilot(240, down ? 35 : 45, 0, frame, down ? 'down' : 'up');
    const out = { result, route: { ...route }, trace };
    route = null;
    return out;
  }
  const falls = Object.fromEntries(['drive', 'cliff'].map(name => [name, args => {
    const trailUpdate = s.update;
    s.update = fallsUpdate;
    try { return fixture[name](args); }
    finally { s.update = trailUpdate; }
  }]));
  return { run, falls, context: ctx, scope: s };
}
