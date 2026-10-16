// Frozen traces from the published controller before the roll/29-degree balance change.
// Full production engine/tyre/brake/steering/pitch paths must retain that feel at 30/60/120 Hz.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { terrainFallsFixture } from '../fixtures/terrain-falls.mjs';
export default async function previousMotorcycleFeel(t) {
  const reference = JSON.parse(fs.readFileSync(new URL('../fixtures/motorcycle-previous-feel.json', import.meta.url))),
    f = terrainFallsFixture();
  f.scope.riderAboard = () => false;
  f.scope.onRoad = () => true;
  for (const expected of reference.results) {
    const scene = reference.cases.find(s => s.name === expected.case);
    f.scope.keys = Object.fromEntries(scene.keys.map(k => [k === 'UP' ? 'WheelieUp' : k, true]));
    f.scope.pose = scene;
    const car = vm.runInContext("var probe=makeCar('bike',420,4600,0,false);player.car=probe;Object.assign(probe,{vx:pose.kmh*KMH,vy:0,speed:pose.kmh*KMH,wheelie:pose.angle,wheelieRate:0,wheelieLean:pose.lean});probe;", f.context);
    for (let n = 0; n < Math.round(scene.seconds * expected.rate); n++) {
      f.context.controlVehicle(car, car, 1 / expected.rate, true);
      f.scope.physicsClock += 1 / expected.rate; f.scope.gameTime += 1 / expected.rate;
      t.assert(Math.abs(car.bikeRoll - Math.max(-.28, Math.min(.28, car.av * .13))) < 1e-12 && car.bikeRollRate === 0,
        scene.name + ': bank no longer follows the previous immediate yaw response');
    }
    for (const [key, value] of Object.entries(expected.state)) t.assert(Math.abs(car[key] - value) < 1e-8,
      scene.name + ' at' + expected.rate + 'Hz changed previous ' + key + ': ' + car[key] + ' vs ' + value);
  }
  t.note('18 full-controller traces match published ' + reference.baseline + ': turn, lift, release, coast, brake, rear brake at 30/60/120 Hz.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let checks = 0;
  await previousMotorcycleFeel({ assert(v, m) { checks++; assert.ok(v, m); }, note: console.log });
  console.log('PASS motorcycle-previous-feel: ' + checks + ' host assertions');
}
