// Boulder height and contact normal describe the same surface; all three civilian SUV styles remain on a graded descent.
import fs from 'node:fs';
import vm from 'node:vm';
import { terrainFallsFixture } from '../fixtures/terrain-falls.mjs';
export default async function (t) {
  const context = vm.createContext({ UNITS_PER_METRE: 8, GRAVITY: 9.81 * 8 });
  vm.runInContext(fs.readFileSync(new URL('../../src/terrain-suspension.js', import.meta.url), 'utf8'), context);
  // Analytic affine ground + rock: the production rounded tyre query must return both summed height and summed slope.
  let calls = 0;
  context.rideGroundAt = (x, y, out) => Object.assign(out, { h: 0.1 * x + 0.2 * y, gx: 0.1, gy: 0.2 });
  context.rideRelief = (x, y) => { calls++; return 2 + 0.4 * x - 0.3 * y; };
  const out = { h: 0, gx: 0, gy: 0 };
  t.assert(context.rideTyreGround(0, 0, 1, 0, 0, out) === out, 'contact query must reuse its caller record');
  t.near(out.h, 2, 2, 'summed contact height');
  t.near(out.gx, 0.499999999, 0.500000001, 'rock plus terrain x slope');
  t.near(out.gy, -0.100000001, -0.099999999, 'rock plus terrain y slope');
  t.assert(calls === 7, 'only the winning tyre sample may query four rock-gradient heights');
  calls = 0; context.rideRelief = () => { calls++; return 0; };
  context.rideTyreGround(0, 0, 1, 0, 3, out);
  t.assert(calls === 3 && out.gx === 0.1 && out.gy === 0.2, 'no-relief tyres must retain base normals and make no gradient samples');
  const fixture = terrainFallsFixture();
  for (const maxKmh of [15, 20, 28]) for (const id of [0, 1, 2]) {
    const r = fixture.drive({ id, maxKmh });
    t.assert(r.hp === r.maxhp && !r.overturned && !r.firstFlight && r.run.progress > 0.08,
      `SUV style ${id}, pilot ${maxKmh} km/h: ${JSON.stringify(r)}`);
    t.note(`SUV ${id}/${maxKmh}: progress ${r.run.progress}, max ${r.run.maxKmh} km/h, no flights/damage/overturn`);
  }
  const cliff = fixture.cliff();
  t.assert(cliff.hp <= 0 && cliff.firstFlight && !cliff.airborne, 'a real 60 m cliff drop must still wreck a sedan: ' + JSON.stringify(cliff));
  for (const type of ['sedan', 'bike']) {
    const r = fixture.drive({ type, maxKmh: 20, seconds: 20, road: true });
    t.assert(r.hp === r.maxhp && !r.overturned && !r.firstFlight && r.run.progress > 0.005,
      'ordinary road descent remains stable for ' + type + ': ' + JSON.stringify(r));
  }
}
