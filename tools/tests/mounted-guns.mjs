// Mounted guns (mounted-guns.js): in the LAV-8, the gun jeep and the Black Hawk the player fires
// the vehicle's own gun. The turret (or the door gun) traverses toward the aim at its rate rather than
// snapping, the belt goes down, a sedan and a bystander in the line of fire are hit; the LAV's weapon
// switch swaps to the coax; the Black Hawk fires the door gun on the aim's side, held at its stops.
export const fresh = true;
const DEG = Math.PI / 180;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  const cases = [
    // rate: the traverse limit (deg/s); swing: how long to watch it move; rest: where the gun starts.
    { kind: 'apc', at: [420, 5000], heading: 90 * DEG, rate: 60, swing: 0.6, rest: 0, targetDeg: 0 },
    { kind: 'jeep', at: [420, 5900], heading: 90 * DEG, rate: 90, swing: 0.4, rest: 0, targetDeg: 0 },
    { kind: 'heli', at: [420, 6800], heading: 0, rate: 150, swing: 0.2, rest: 25, targetDeg: 90 },
  ];
  for (const k of cases) {
    await t.call('teleport', ...k.at);
    let r = await t.call('driveArmed', k.kind, k.heading);
    t.assert(r.kind === k.kind, `${k.kind}: not in an armed vehicle: ` + JSON.stringify(r));
    // Lay the gun 80 deg off the nose (the right side): it swings at its rate, not at once.
    const pos = { x: r.x, y: r.y };
    const aimAt = (deg, range = 200) => {
      const a = k.heading + deg * DEG;
      return [pos.x + Math.cos(a) * range, pos.y + Math.sin(a) * range];
    };
    await t.call('mountedGunAim', ...aimAt(80));
    await t.wait(k.swing);
    r = await t.call('mountedGuns');
    const turned = k.kind === 'heli' ? r.doors[1] : r.turret;
    t.assert(turned > k.rest + 5 && turned < 75, `${k.kind}: the gun snapped or did not move in ${k.swing} s: ` + JSON.stringify(r));
    t.assert(turned <= k.rest + k.rate * k.swing + 3, `${k.kind}: traversed faster than ${k.rate} deg/s: ` + JSON.stringify(r));
    await t.wait(2);
    r = await t.call('mountedGuns');
    t.assert(r.laidError <= 2 && Math.abs(r.aim - 80) <= 3, `${k.kind}: the gun did not follow the aim: ` + JSON.stringify(r));
    if (k.kind === 'heli') {
      // Straight ahead is outside the door guns' windows: the right gun stops at 20 deg.
      await t.call('mountedGunAim', ...aimAt(2));
      await t.wait(1.5);
      r = await t.call('mountedGuns');
      t.assert(r.slot === 1 && r.doors[1] >= 18 && r.doors[1] <= 22, 'heli: right door gun not held at its forward stop: ' + JSON.stringify(r));
      // Aim left: the left gun takes over, the right one rests.
      await t.call('mountedGunAim', ...aimAt(-100));
      await t.wait(1.5);
      r = await t.call('mountedGuns');
      t.assert(r.slot === 0 && Math.abs(r.doors[0] + 100) <= 3 && r.doors[1] <= 30, 'heli: left door gun did not take the aim: ' + JSON.stringify(r));
    }
    // Targets in the line of fire: a sedan and, 30 units nearer, a bystander.
    const targets = await t.call('mountedGunTargets', 220, k.targetDeg);
    t.assert(targets.car && targets.person, `${k.kind}: no targets: ` + JSON.stringify(targets));
    await t.call('mountedGunAim', targets.car.x, targets.car.y);
    await t.wait(2.5);
    const before = await t.call('mountedGuns');
    t.assert(before.laidError <= 2, `${k.kind}: not laid on the target: ` + JSON.stringify(before));
    await t.keys('KeyF', 3);
    await t.wait(1);
    r = await t.call('mountedGuns');
    const slot = r.slot;
    t.assert(r.shots > before.shots + 5, `${k.kind}: did not fire: ` + JSON.stringify(r));
    t.assert(r.guns[slot].belt < before.guns[slot].belt, `${k.kind}: the belt did not go down: ` + JSON.stringify(r));
    t.assert(r.targets.person.hp < targets.person.hp, `${k.kind}: the bystander was not hit: ` + JSON.stringify(r.targets));
    t.assert(r.targets.car.hp < targets.car.hp, `${k.kind}: the sedan was not hit: ` + JSON.stringify(r.targets));
    if (k.kind === 'apc') {
      // The weapon switch: the coax fires from its own belt.
      await t.keys('KeyQ', 0.2, { real: true });
      await t.wait(0.2);
      const coax = await t.call('mountedGuns');
      t.assert(coax.weapon === 'coax', 'apc: the switch did not select the coax: ' + JSON.stringify(coax));
      await t.keys('KeyF', 1);
      const after = await t.call('mountedGuns');
      t.assert(after.guns[1].belt < coax.guns[1].belt && after.guns[0].belt === coax.guns[0].belt, 'apc: the coax did not fire: ' + JSON.stringify(after));
    }
    t.finite(r, k.kind);
  }
  await t.call('mountedGunAim');
  await t.call('holdSimulation', false);
}
