// The console ascent pilot follows the authored corridor at fresh/reused 30/60 Hz;
// production physics/timer bounds match hillclimb-physics. Complete-game browser checks are still required.
import { terrainTrailFixture } from '../fixtures/terrain-trail.mjs';
export default async function (t) {
  const f = terrainTrailFixture();
  for (const [label, frame, fresh] of [['fresh30', 1 / 30, true], ['reused60', 1 / 60, false], ['fresh60', 1 / 60, true], ['reused30', 1 / 30, false]]) {
    const { result: r, route } = f.run(frame, { fresh });
    t.finite(r, label);
    t.assert(r.reason === 'summit' && r.last?.clean, `${label}: must reach every checkpoint and the summit`);
    t.assert(r.last.time < 75, `${label}: unchanged 75 s challenge, got ${r.last.time}`);
    t.assert(!r.nan && !r.ride.nan && !r.overturned && r.hp === 240, `${label}: intact, finite crawler`);
    t.assert(!r.cliffFlights && !r.ride.flights && r.ride.airS < 0.5, `${label}: no flight or prolonged skip`);
    t.assert(r.ride.maxGapM < 0.3 && r.ride.maxUpMs < 6 && r.ride.maxBlowMs < 4.5, `${label}: unchanged suspension safety limits`);
    t.assert(route.outsideS === 0 && route.maxOutside === 0, `${label}: left the authored carriageway/turning-pad union: ${JSON.stringify(route)}`);
    t.note(`${label}: ${r.last.time} s, 240 hp, corridor departure 0, air ${r.ride.airS} s, max blow ${r.ride.maxBlowMs} m/s`);
  }
  const { result: d } = f.run(1 / 30, { down: true });
  t.assert(d.reason === 'trailhead', 'descent-35 still reaches the trailhead');
  t.assert(!d.cliffFlights && !d.ride.flights && d.ride.airS < 0.3, 'descent-35 retains its flight bounds');
  t.assert(d.ride.maxBlowMs < 4.5 && !d.overturned && d.hp >= 200, 'descent-35 remains safe');
  const cliff = f.falls.cliff();
  t.assert(cliff.hp <= 0 && cliff.firstFlight && !cliff.airborne, 'the unchanged real 60 m cliff drop still wrecks a sedan');
  for (const type of ['sedan', 'bike']) {
    const r = f.falls.drive({ type, maxKmh: 20, seconds: 20, road: true });
    t.assert(r.hp === r.maxhp && !r.overturned && !r.firstFlight && r.run.progress > 0.005, `${type}: unchanged graded-road control`);
  }
}
