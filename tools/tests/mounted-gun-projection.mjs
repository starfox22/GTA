// Real mounted gun lay/fire and projectile velocity: the offset Black Hawk door
// barrels converge on ground targets without changing traverse, stops or ammunition.
import fs from 'node:fs';
import vm from 'node:vm';

export default async function (t) {
  let spread = 0, rangeJitter = 0, terrain = () => 0;
  const radians = Math.PI / 180, normalize = a => Math.atan2(Math.sin(a), Math.cos(a));
  const scope = vm.createContext({ Math,
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), normalizeAngle: normalize,
    distanceBetween: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    headingBetween: (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
    entityElevation: e => e.altitude || 0, terrainHeight: (x, y) => terrain(x, y),
    isApache: () => false, chaseCameraLive: () => false, touchAim: null,
    mouse: { active: false }, city3D: null, gameMode: 'play', gameTime: 0, shake: 0,
    player: { car: null }, bullets: [], aim: () => 0,
    randomBetween: (lo, hi) => hi < 1 ? spread : rangeJitter,
    sfxRandom: (lo, hi) => (lo + hi) / 2, playSample() {}, kickCamera() {},
    notifyViolence() {}, crime() {}, tone() {}, tell() {}, reloadSound() {},
  });
  const combat = fs.readFileSync(new URL('../../src/combat-rules.js', import.meta.url), 'utf8');
  const projectileFunctions = combat.slice(combat.indexOf('    function combatDistance('), combat.indexOf('    function playerShotTarget('));
  const api = vm.runInContext(projectileFunctions + '\n' +
    fs.readFileSync(new URL('../../src/mounted-guns.js', import.meta.url), 'utf8') +
    '\n({ mountedArms, mountedDoorMount, mountedDoorAim, updatePlayerMountedGun, mountedGunFire,' +
    ' aimAt: p => { mountedAimOverride = p; }, weapon: MOUNTED_GUNS.heli.weapons[0] })', scope);
  const car = (a = 0, altitude = 0) => ({ type: 'helicopter', military: true, hp: 400,
    x: 480, y: 6800, a, altitude, turretA: a });
  const point = (c, rel, range) => ({ x: c.x + Math.cos(c.a + rel) * range,
    y: c.y + Math.sin(c.a + rel) * range });
  const aim = (c, p, seconds = 2) => { scope.player.car = c; api.aimAt(p); api.updatePlayerMountedGun(seconds); };
  const fire = (c, slot) => { scope.gameTime += 1; t.assert(api.mountedGunFire(c, slot), 'production gun did not fire'); return scope.bullets.at(-1); };
  const project = (b, p) => {
    const duration = Math.hypot(p.x - b.x, p.y - b.y) / Math.hypot(b.vx, b.vy);
    return { x: b.x + b.vx * duration, y: b.y + b.vy * duration,
      altitude: b.altitude + b.vz * duration, duration };
  };
  const fixtures = [
    [0, 90, 220, 0], [90, -90, 220, 0], [-60, 35, 80, 80],
    [60, -140, 800, 100], [180, 110, 40, 0], [180, 40, 40, 0], [-60, -40, 500, 150],
  ];
  let maximumMiss = 0;
  for (const [heading, relative, range, altitude] of fixtures) {
    terrain = relative === 40 && range === 40 || heading === -60 && range === 500
      ? (x, y) => .01 * (x - 480) + .005 * (y - 6800) : () => 0;
    const c = car(heading * radians, altitude), p = point(c, relative * radians, range), slot = relative > 0 ? 1 : 0;
    aim(c, p);
    const mount = api.mountedDoorMount(c, slot, {}), shot = fire(c, slot), endpoint = project(shot, p);
    const miss = Math.hypot(endpoint.x - p.x, endpoint.y - p.y); maximumMiss = Math.max(maximumMiss, miss);
    t.assert(miss < 1e-8, 'offset barrel missed intended ground point: ' + JSON.stringify({ heading, relative, range, miss }));
    t.assert(Math.abs(endpoint.altitude - c.gunAim.altitude) < 1e-8, 'projectile changed target elevation');
    t.assert(Math.abs(Math.hypot(shot.vx, shot.vy, shot.vz) - api.weapon.speed) < 1e-8, 'projectile speed changed');
    t.assert(Math.abs(Math.hypot(shot.x - mount.x, shot.y - mount.y) - api.weapon.muzzle) < 1e-9 &&
      shot.altitude === mount.altitude - 9, 'projectile no longer leaves the measured muzzle');
    t.assert(Math.abs(shot.life - (endpoint.duration + .25)) < 1e-8, 'projectile flight lifetime changed');
    t.assert(c.arms.guns[slot].belt === api.weapon.belt - 1 && c.arms.shots === 1 && shot.dmg === api.weapon.dmg && !shot.enemy,
      'door projectile or ammunition contract changed');
  }
  terrain = () => 0;
  const c = car(), target = point(c, Math.PI / 2, 220); aim(c, target);
  const shot = fire(c, 1), person = point(c, Math.PI / 2, 195), crossing = project(shot, person);
  const personMiss = Math.hypot(crossing.x - person.x, crossing.y - person.y);
  t.assert(personMiss < 10 * (14 / 17.4), 'stationary bystander before target is outside production hit radius');
  t.assert(Math.abs(c.arms.rel[1] / radians - 90) < 1e-8 && Math.abs(c.arms.barrelRel[1] / radians - 90) > 5,
    'physical parallax correction changed the hull-referenced control angle');
  const previousPhysical = [...c.arms.barrelRel], previousControl = [...c.arms.rel];
  api.aimAt(point(c, -100 * radians, 220)); api.updatePlayerMountedGun(.02);
  for (let i = 0; i < 2; i++) {
    t.assert(Math.abs(c.arms.barrelRel[i] - previousPhysical[i]) <= 150 * radians * .02 + 1e-9,
      'physical barrel snapped or exceeded traverse speed');
    t.assert(Math.abs(c.arms.rel[i] - previousControl[i]) <= 150 * radians * .02 + 1e-9, 'control traverse changed');
  }
  const movingShot = fire(c, 0), movingAngle = normalize(Math.atan2(movingShot.vy, movingShot.vx) - c.a);
  t.assert(Math.abs(normalize(movingAngle - c.arms.barrelRel[0])) < 1e-9 &&
    Math.abs(normalize(movingAngle - api.mountedDoorAim(c, 0, c.gunAim))) > .1,
    'firing skipped unsettled physical traverse');
  for (const relative of [-178, -2, 2, 178]) {
    const v = car(), p = point(v, relative * radians, 220), slot = relative > 0 ? 1 : 0; aim(v, p);
    const barrel = v.arms.barrelRel[slot] * (slot ? 1 : -1) / radians;
    t.assert(barrel >= 20 - 1e-9 && barrel <= 160 + 1e-9, 'physical barrel crossed its door-gun stops');
    t.assert(Math.abs(barrel - (Math.abs(relative) < 20 ? 20 : 160)) < 1e-8, 'wrong physical forward/rear stop');
  }
  for (const scatter of [-.02, .02]) {
    spread = scatter; rangeJitter = scatter < 0 ? -8 : 8;
    const v = car(); aim(v, target); const b = fire(v, 1);
    t.assert(Math.abs(normalize(Math.atan2(b.vy, b.vx) - v.arms.barrelRel[1]) - scatter) < 1e-9,
      'existing projectile spread was lost');
    t.assert(Math.abs(Math.hypot(b.vx, b.vy, b.vz) - api.weapon.speed) < 1e-8, 'jitter changed projectile speed');
    t.assert(!api.mountedGunFire(v, 1), 'interval limiter allowed an immediate second shot');
  }
  spread = rangeJitter = 0;
  const restored = car(); api.mountedArms(restored); delete restored.arms.barrelRel;
  const control = restored.arms.rel; api.mountedArms(restored);
  t.assert(restored.arms.barrelRel !== control && restored.arms.barrelRel.every((x, i) => x === control[i]),
    'legacy saved arms did not initialize independent physical lay state');
  for (const kind of ['apc', 'jeep']) {
    const v = { ...car(), type: kind, gunner: kind === 'jeep', turretA: .4 }; api.mountedArms(v, kind);
    const b = fire(v, 0);
    t.assert(v.arms.barrelRel === null && Math.abs(normalize(Math.atan2(b.vy, b.vx) - .4)) < 1e-9,
      kind + ': ground mounted gun direction changed');
  }
  t.note(JSON.stringify({ maximumGroundMiss: maximumMiss, stationaryBystanderMiss: personMiss,
    oldParallelRayMiss: 21, physicalTraverseDegreesPerSecond: 150, physicalStopsDegrees: [20, 160] }));
}
