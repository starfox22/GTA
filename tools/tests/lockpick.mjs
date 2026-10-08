// The lockpick (arsenal.js) and trunks (vehicle-trunk.js): given and taken in hand, fire does nothing with it; the real
// action key held at a parked sedan's trunk picks it open pin by pin (never getting in), crouched at the bumper; a save
// keeps the lockpick across a reload.
export const fresh = true;
export default async function (t) {
  await t.call('teleport', 1000, 1000);
  let s = await t.call('status');
  let r = await t.call('trunkReport');
  t.assert(!r.lockpick.owned, 'a new game owns the lockpick: ' + JSON.stringify(r.lockpick));
  const k = await t.call('lockpick', true, true);
  t.assert(k.owned && k.equipped, 'lockpick not in hand: ' + JSON.stringify(k));
  s = await t.call('status');
  t.assert(s.weapon === 'LOCKPICK', 'weapon is ' + s.weapon);
  const target = await t.call('trunkTarget', 1100, 1000, 0, 'UNIFORM AND ID');
  t.assert(target?.trunkPoint, 'no trunk target: ' + JSON.stringify(target));
  // Out of reach (beside the car): nothing to pick.
  await t.call('teleport', target.x, target.y + 60);
  await t.wait(0.2);
  r = await t.call('trunkReport');
  t.assert(r.car && !r.car.inReach && !r.car.open, 'trunk in reach from the side: ' + JSON.stringify(r.car));
  // At the bumper, a step back from the kneeling spot: the hold steps in and works the pins.
  await t.call('teleport', target.trunkPoint.x - 6, target.trunkPoint.y);
  await t.wait(0.2);
  r = await t.call('trunkReport');
  t.assert(r.car.inReach, 'trunk not in reach at the bumper: ' + JSON.stringify(r.car));
  // Fire with the lockpick: nothing happens (no shot, no strike, still in hand).
  await t.call('fireShot', target.x, target.y);
  t.assert((await t.call('status')).weapon === 'LOCKPICK', 'fire changed the weapon');
  let crouched = false;
  for (let i = 0; i < 10; i++) {
    await t.keys('KeyE', 1.2, { real: true });
    r = await t.call('trunkReport');
    if (r.lockpick.working === 'trunk') crouched = true;
    t.note(`hold ${i}: progress ${r.car.progress} pins ${r.car.pins} working ${r.lockpick.working}`);
    if (r.car.open) break;
  }
  t.assert(r.car.open, 'trunk still shut after holding the action key: ' + JSON.stringify(r));
  t.assert(r.stats.pins >= 5 && r.stats.trunks === 1, 'pins/trunks: ' + JSON.stringify(r.stats));
  t.assert(crouched, 'never crouched at the lock');
  s = await t.call('status');
  t.assert(!s.vehicle, 'the action key got into the car: ' + JSON.stringify(s));
  // A locked car with its driver at the wheel: the hold at the driver's door unlocks it quietly (no window broken,
  // nobody hauled out yet).
  const locked = await t.call('lockedDoorTarget', 1000, 1300, 0);
  t.assert(locked.locked, 'door target not locked: ' + JSON.stringify(locked));
  await t.call('teleport', locked.door.x, locked.door.y - 4);
  await t.wait(0.2);
  let scan = null;
  for (let i = 0; i < 8; i++) {
    await t.keys('KeyE', 1.2, { real: true });
    scan = (await t.call('carjackScan', 120, 1))[0];
    t.note(`door hold ${i}: locked ${scan?.locked}`);
    if (scan && !scan.locked) break;
  }
  t.assert(scan && !scan.locked, 'driver door still locked: ' + JSON.stringify(scan));
  s = await t.call('status');
  t.assert(!s.vehicle, 'the door pick got into the car: ' + JSON.stringify(s));
  t.assert((await t.call('trunkReport')).stats.doors === 1, 'door unlock not counted');
  // Kept in the save: a reload with the same profile still owns it.
  await t.reload({ keep: true });
  r = await t.call('trunkReport');
  t.assert(r.lockpick.owned, 'the lockpick was lost on reload: ' + JSON.stringify(r.lockpick));
  // Taken away again: a new game's state.
  const off = await t.call('lockpick', false);
  t.assert(!off.owned && !off.equipped, 'lockpick not taken: ' + JSON.stringify(off));
}
