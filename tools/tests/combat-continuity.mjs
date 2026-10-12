// Real pose/transition/selection functions in a deterministic host fixture: aiming
// raises an unfired gun, world resets are not door exits, reselecting preserves reload.
import fs from 'node:fs';
import vm from 'node:vm';

export default async function (t) {
  const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
  const special = read('crowd3d-special'), frame = read('crowd3d-frame'), chase = read('chase-camera');
  const poses = Object.fromEntries(['pistolAim', 'pistolSide', 'smgAim', 'smgSide', 'longAim', 'longReady', 'rocket', 'knife', 'fists', 'lockpick'].map(id => [id, { id }]));
  class Part {}
  const context = vm.createContext({
    Three: { Vector3: Part, Euler: Part, Quaternion: Part, Matrix4: Part },
    worldResetSerial: 0, gameTime: 20,
    player: { hp: 100, a: 0, x: 100, y: 100, car: null },
    mouse: { alt: false }, gamepad: { aimHeld: false },
    transitRide: null, taxiRide: null, chaseOn: true,
    chaseCameraLive() { return context.chaseOn; },
    personIncapacitated: p => p.hp <= 0, specialLook: () => ({}), playerAimFacing: () => null,
    rooftopJob: () => null, lootCrouching: () => false, summitDigging: () => false, playerJumpPose: () => null,
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
    selectedWeaponIndex: 0, FISTS_INDEX: 7, LOCKPICK_INDEX: 8,
    weapons: Array.from({ length: 6 }, () => ({ load: 2, owned: true })),
    currentWeapon() { return context.weapons[context.selectedWeaponIndex] || { melee: true }; },
    PLAYER_WEAPONS: ['pistol', 'smg', 'shotgun', 'rocket', 'rifle', 'sniper', 'knife', null, 'lockpick'],
    HOLD_POSES: poses, reloadSecondsRemaining: 0,
    weaponIsEquipped: i => Number.isInteger(i) && i >= 0 && i < 8,
    tell() {}, drawWeapon() { context.draws++; }, save() { context.saves++; }, draws: 0, saves: 0,
  });
  const aimStart = chase.indexOf('    function chaseAiming()');
  vm.runInContext(chase.slice(aimStart, chase.indexOf('    /**', aimStart)), context);
  vm.runInContext(special.slice(0, special.indexOf('      /* The player in the water')), context);
  vm.runInContext(frame.slice(0, frame.indexOf('      // A stand-in')), context);
  const api = vm.runInContext('({ spec: () => specialSpec(player), trackCarTransition, transition: carTransition })', context);
  for (const [index, idle, aim] of [[0, 'pistolSide', 'pistolAim'], [1, 'smgSide', 'smgAim'], [2, 'longReady', 'longAim'], [4, 'longReady', 'longAim'], [5, 'longReady', 'longAim']]) {
    context.selectedWeaponIndex = index;
    t.assert(api.spec().hold === poses[idle], 'idle gun not carried normally: ' + index);
    context.mouse.alt = true;
    t.assert(api.spec().hold === poses[aim], 'unfired gun stays lowered with right aim: ' + index);
    context.mouse.alt = false;
    context.gamepad.aimHeld = true;
    t.assert(api.spec().hold === poses[aim], 'unfired gun stays lowered with controller aim: ' + index);
    context.gamepad.aimHeld = false;
    t.assert(api.spec().hold === poses[idle], 'aim pose survives releasing aim: ' + index);
    context.mouse.alt = true;
    context.chaseOn = false;
    t.assert(api.spec().hold === poses[idle], 'street view changed from chase-only aim input: ' + index);
    context.chaseOn = true;
    context.mouse.alt = false;
  }
  context.selectedWeaponIndex = 0;
  context.reloadSecondsRemaining = 1;
  t.assert(api.spec().hold === poses.pistolAim, 'reload pose lost');
  context.reloadSecondsRemaining = 0;
  context.player.lastShotAt = context.gameTime;
  t.assert(api.spec().hold === poses.pistolAim, 'recent-shot aim pose lost');
  delete context.player.lastShotAt;

  context.player.car = {};
  api.trackCarTransition();
  t.assert(api.transition.kind === 'enter', 'normal vehicle entry lost its pose');
  context.player.car = null;
  api.trackCarTransition();
  t.assert(api.transition.kind === 'exit', 'normal vehicle exit lost its pose');
  context.player.car = {};
  api.trackCarTransition();
  context.player.car = null;
  context.worldResetSerial++;
  api.trackCarTransition();
  t.assert(api.transition.kind === null && api.spec().pose !== 'exitCar', 'world reset plays a false door exit');
  // A reset can also place the player in a mission vehicle immediately.
  context.player.car = {};
  context.worldResetSerial++;
  api.trackCarTransition();
  t.assert(api.transition.kind === null && api.transition.car === context.player.car, 'world reset retained the previous car or plays a false entry');

  const selection = read('citylife-places');
  const start = selection.indexOf('    function selectWeapon(');
  vm.runInContext(selection.slice(start, selection.indexOf('    function cycleWeapon', start)), context);
  context.player.car = null;
  context.reloadSecondsRemaining = 1.25;
  t.assert(context.selectWeapon(0), 'reselect was rejected');
  t.assert(context.reloadSecondsRemaining === 1.25, 'reselect cancelled the reload');
  t.assert(context.saves === 0 && context.draws === 0, 'reselect rewrote inventory/UI');
  t.assert(context.selectWeapon(1) && context.reloadSecondsRemaining === 0, 'switching guns did not cancel the old reload');
  t.assert(context.saves === 1 && context.draws === 1, 'a real weapon switch was not saved/drawn');
  context.player.car = { type: 'sedan' };
  t.assert(!context.selectWeapon(1), 'vehicle restriction bypassed by same-slot selection');
  const actions = read('game-player-actions');
  vm.runInContext(actions.slice(actions.indexOf('    function shoot()')), context);
  Object.assign(context, {
    gameMode: 'play', selectedWeaponIndex: 0, shotCooldownSeconds: 0,
    enforceVehicleHandgun() {}, isApache: () => false, mountedGunKind: () => null,
    tone() {}, tell(text) { context.lastHint = text; },
  });
  context.player.car = null;
  context.weapons[0].ammo = context.weapons[0].reserve = 0;
  context.shoot();
  t.assert(/gun shop/i.test(context.lastHint) && !/crate|pickup/i.test(context.lastHint), 'empty gun directs the player to nonexistent ammunition pickups');
  t.note('five firearm poses for mouse/controller; normal/reset car transitions; reload-preserving reselect and real switch');
}
