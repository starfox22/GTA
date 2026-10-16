// Continuous wheelie metres and actual shipped HUD at 0/99/101/201; no browser required.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { wheelieScoreFixture } from '../fixtures/wheelie-score.mjs';

export default async function wheelieScoreTest(t) {
  const f = wheelieScoreFixture(), car = f.bike(), stages = [];
  const near = (got, want, label) => t.assert(Math.abs(got - want) < 1e-6, label + ': ' + got);
  f.step(car, 0, 0);
  stages.push(f.view());
  t.assert(!stages[0].shown && stages[0].score.metres === 0, 'grounded 0 m shows a wheelie');
  f.travel(car, 99);
  stages.push(f.view());
  t.assert(stages[1].shown && stages[1].distance === '99' && stages[1].score.tier === 0 && !stages[1].score.milestone, '99 m stage/early milestone');
  near(+stages[1].progress, 0.99, 'first progress targets 100 m');
  f.travel(car, 1);
  t.assert(f.view().score.grade === 0, '100 m awards before surpassing the threshold');
  f.travel(car, 1);
  stages.push(f.view());
  t.assert(stages[2].distance === '101' && stages[2].grade === 'GREAT!' && stages[2].celebrate && stages[2].score.milestonePulses === 1, '101 m stage missing exact GREAT! celebration');
  near(+stages[2].progress, 0.01, 'second progress targets 200 m');
  f.travel(car, 99);
  t.assert(f.view().score.grade === 1, '200 m awards before surpassing the threshold');
  f.travel(car, 1);
  stages.push(f.view());
  t.assert(stages[3].distance === '201' && stages[3].grade === 'Amazing!' && stages[3].celebrate && stages[3].score.milestonePulses === 2, '201 m stage missing exact Amazing! celebration');
  t.assert(f.tones.length === 4 && f.tones[0][0] !== f.tones[2][0], 'milestone chimes absent, repeated or identical');
  near(stages[3].score.distanceM, 201, 'console alias distance');
  const pulses = stages[3].score.milestonePulses;
  // Five ground frames contribute no metres; a short touchdown stays one run.
  for (let i = 0; i < 5; i++) f.step(car, 0.5, 0);
  near(f.view().score.metres, 201, 'touchdown grace added ground travel');
  f.step(car, 0.5, 0.35);
  near(f.view().score.metres, 201.5, 'brief touchdown broke the continuous run');
  t.assert(f.view().score.milestonePulses === pulses, 'touchdown repeats achievements');
  for (let i = 0; i < 8; i++) f.step(car, 0.5, 0);
  let v = f.view();
  t.assert(v.score.phase === 'result' && v.score.reason === 'landed' && !v.score.tracking && v.next === 'FINAL DISTANCE', 'landing did not finalize/release bike');
  near(v.score.metres, 201.5, 'landing result includes ground distance');
  const remaining = v.score.resultSeconds;
  f.c.gameMode = 'pause';
  f.f.updateWheelieScore(10);
  near(f.f.wheelieScoreReport().resultSeconds, remaining, 'pause consumed result time');
  f.c.gameMode = 'play';
  for (let i = 0; i < 39; i++) f.f.updateWheelieScore(0.1);
  t.assert(f.f.wheelieScoreReport().phase === 'result', 'result disappeared before four seconds');
  f.f.updateWheelieScore(0.1); f.f.updateWheelieScoreHud();
  t.assert(f.view().score.phase === 'idle' && !f.view().shown, 'result never retires');

  f.f.resetWheelieScore();
  // High apparent velocity with no displacement is never distance.
  car.wheelie = 0.35; car.vx = 400;
  for (let i = 0; i < 100; i++) { f.f.wheelieScoreStep(car, 1 / 60, car.x, car.y); f.f.updateWheelieScore(1 / 60); }
  t.assert(f.view().score.metres === 0 && !f.view().score.tracking, 'stationary front lift scored');
  // Fork chatter stays below the visual threshold, then two short hops remain unconfirmed.
  for (let i = 0; i < 20; i++) f.step(car, 0.2, 0.04);
  t.assert(f.view().score.phase === 'idle', 'fork chatter starts a score');
  for (let j = 0; j < 2; j++) { for (let i = 0; i < 3; i++) f.step(car, 0.2, 0.2); f.step(car, 0.2, 0); }
  t.assert(f.view().score.phase !== 'active', 'separate tiny hops add up to a wheelie');
  f.f.resetWheelieScore();
  f.travel(car, 5);
  for (let i = 0; i < 11; i++) f.step(car, 0);
  t.assert(f.view().score.reason === 'stopped' && !f.view().score.tracking, 'stopping does not end a run');
  const stopped = f.view().score.metres;
  f.travel(car, 4);
  near(f.view().score.metres, stopped, 'still-raised restart scores another run');
  f.step(car, 0.1, 0); f.travel(car, 5);
  t.assert(f.view().score.phase === 'active' && f.view().score.metres === 5, 'touchdown does not rearm next wheelie');
  // A bend and return count the travelled path, not straight displacement.
  for (let i = 0; i < 5; i++) f.step(car, 1, 0.35, 0.02, Math.PI);
  near(f.view().score.metres, 10, 'path back toward start lost its distance');
  car.hp--;
  f.f.updateWheelieScore(0.01);
  t.assert(f.view().score.reason === 'crashed' && !f.view().score.tracking, 'damage does not finish the score');

  for (const flag of ['rideAir', 'cliffAir', 'deckAir', 'overturned']) {
    f.f.resetWheelieScore(); f.travel(car, 5); car[flag] = {};
    f.step(car, 1);
    t.assert(f.view().score.reason === 'airborne' && f.view().score.metres === 5, flag + ' counts a whole-bike jump');
    car[flag] = null;
  }
  f.f.resetWheelieScore(); f.travel(car, 5); car.x += 800;
  f.step(car, 1);
  t.assert(f.view().score.reason === 'relocated' && f.view().score.metres === 5 && !f.view().score.tracking, 'repositioned step origin bridges a teleport');
  f.f.resetWheelieScore(); f.travel(car, 5); f.step(car, 1000);
  t.assert(f.view().score.reason === 'relocated' && f.view().score.metres === 5, 'matching bogus speed allows an implausible teleport segment');
  f.f.resetWheelieScore(); f.travel(car, 5); f.c.player.car = null;
  f.f.updateWheelieScore(0.01);
  t.assert(f.view().score.reason === 'exited' && !f.view().score.tracking, 'exit retains old vehicle');
  f.c.player.car = car; f.f.resetWheelieScore(); f.travel(car, 5); car.fallen = {};
  f.f.updateWheelieScore(0.01);
  t.assert(f.view().score.reason === 'crashed' && !f.view().score.tracking, 'fallen bike retains live score');
  car.fallen = null;
  f.f.resetWheelieScore();
  t.assert(f.view().score.phase === 'idle' && f.view().score.metres === 0 && !f.view().score.tracking && !f.view().shown, 'world reset retains score/vehicle/HUD');
  const sedan = f.bike('sedan'); f.travel(sedan, 10);
  t.assert(f.view().score.phase === 'idle', 'non-bike scores a wheelie');
  t.assert(f.measureRequests > 0, 'visibility changes do not queue frame-start layout');
  t.note('production HUD snapshots ' + JSON.stringify(stages));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let checks = 0;
  await wheelieScoreTest({ assert(v, msg) { checks++; assert.ok(v, msg); }, note: console.log });
  console.log('PASS wheelie-score: ' + checks + ' host assertions');
}
