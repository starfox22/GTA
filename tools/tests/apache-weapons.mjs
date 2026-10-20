// Exercise the production Apache loadout, guidance and contextual controls in a CPU-only host.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');

const read = file => fs.readFileSync(new URL('../../src/' + file + '.js', import.meta.url), 'utf8');
const expand = file => read(file).replace(/^\s*\/\/ @include src\/([^\n]+)\.js\s*$/gm, (_, child) => expand(child));
function productionFunction(file, name) {
  const source = read(file), match = source.match(new RegExp('^([ \t]*)function ' + name + '\\(', 'm'));
  if (!match) throw Error('Missing production function ' + file + ':' + name);
  const end = source.indexOf('\n' + match[1] + '}', match.index);
  if (end < 0) throw Error('Missing end of production function ' + file + ':' + name);
  return source.slice(match.index, end + match[1].length + 2);
}
class Element {
  constructor(tag = 'div', text = '') {
    this.tagName = tag.toUpperCase(); this.textContent = text; this.children = []; this.dataset = {}; this.style = {}; this.classes = new Set();
    this.classList = {
      contains: value => this.classes.has(value), add: value => this.classes.add(value), remove: value => this.classes.delete(value),
      toggle: (value, on = !this.classes.has(value)) => on ? this.classes.add(value) : this.classes.delete(value),
    };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  getContext() { return new Proxy({}, { get: () => () => {} }); }
}
function fixture(saved = null) {
  const elements = new Map(), stored = new Map(saved ? [['dead-end-city-controls', JSON.stringify(saved)]] : []), listeners = new Map();
  const shots = [], blasts = [], crimes = [], notices = [], walls = [];
  const getElement = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const scope = vm.createContext({
    player: { x: 0, y: 0, a: 0, car: null }, vehicles: [], bullets: [], pedestrians: [], enemies: [], gangMembers: [], officers: [], wildlife: [], storyActors: [], mission: null,
    gameMode: 'play', gameTime: 10, fires: [], debris: [], flash: 0, keys: {}, mouse: { active: false, down: false, alt: false }, touchAim: null, city3D: null, shake: 0, cash: 0,
    SENTINEL: { helipads: [{ x: 1000, y: 1000, r: 30 }] }, HEAT_MAX: 100, wantedHeat: 0, CRIME_HEAT: 1, lastDispatchLine: 0,
    UNITS_PER_METRE: 8, TAU: Math.PI * 2, PERSON_HIT_RADIUS: 10, GORE_HEAVY_DETAIL: {}, BURN_THRESHOLD: .25,
    CITY_SIZE: 10000, BUILDING_CELL: 512, buildingGrid: new Map(), airCoverRay: () => false,
    roofCover: [], ROOFTOP: { height: 100 }, STADIUM_STANDS: [], countyStaticSolids: [], AIRPORT_SCENERY_SOLIDS: [], WILDLIFE_SPECIES: {},
    viewportWidth: 1000, viewportHeight: 700, chaseCam: { ready: true, locked: false, viewYaw: 0, yaw: 0 },
    hudSeen: { keys: '' }, settingsClash: null, settingsListen: null, sportsbook: { open: false }, transitRide: null, taxiRide: null,
    navigator: {}, performance,
    localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
    window: {
      addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
      dispatchEvent(event) { for (const fn of listeners.get(event.type) || []) fn(event); },
    },
    KeyboardEvent: class { constructor(type, values) { this.type = type; this.repeat = false; Object.assign(this, values); } preventDefault() {} },
    document: { body: new Element('body'), activeElement: null, createElement: tag => new Element(tag) }, getElement,
    isAircraft: c => c?.type === 'plane' || c?.type === 'helicopter', isBoat: () => false, boatSurfaceElevation: () => 0,
    terrainHeight: () => 0, worldMeters: value => value / 8, aircraftClearance: c => c.altitude || 0,
    vehicleSpec: c => ({ name: c?.type || '', hp: 640, l: 118, w: 42, bike: false }),
    vehicleShape: c => ({ ...c }), boxContact: () => false, militaryWalls: [], buildings: walls,
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)), normalizeAngle: value => Math.atan2(Math.sin(value), Math.cos(value)),
    distanceBetween: (a, b) => Math.hypot(a.x - b.x, a.y - b.y), hypot2: Math.hypot, headingBetween: (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
    randomBetween: (a, b) => (a + b) / 2, seededRandom: () => 1,
    chaseCameraLive: () => false, touchModeOn: () => false, chaseGroundPoint: () => null, chaseAimScreen: () => ({ x: 500, y: 350 }),
    chaseProject: (x, y, z, out) => Object.assign(out || {}, { x, y, depth: 1, behind: false }),
    traverseTurret: (c, target, dt, rate) => { c.turretA = (c.turretA || 0) + Math.max(-rate * dt, Math.min(rate * dt, target - (c.turretA || 0))); },
    tell: text => notices.push(text), tone() {}, noise() {}, playSample() {}, reloadSound() {}, particle() {},
    notifyViolence() {}, crime: value => crimes.push(value), militaryAlarm() {}, dispatchCaption() {}, crowdInView: () => false,
    strikePerson: (p, damage) => { p.hp -= damage; },
    airCoverStopsShot: () => false, landAt: () => true, inStadiumLot: () => false,
    garageWalls: () => [], harborSolids: () => [], depotSolids: () => [], militarySolids: () => [], garageDoorSolids: () => [], sportsbookWalls: () => [],
    rectListNear: list => list.length > 0, buildingsNear: () => walls,
    sportsTargets: () => [], forEachPedestrianNear() {},
    pointInCar: (x, y, c) => Math.abs(x - c.x) < 14 && Math.abs(y - c.y) < 14,
    bulletHitVehicle: (c, b) => { shots.push({ c, b }); return 'metal'; }, damageVehicle: (c, damage) => { c.hp -= damage; },
    damageClass: c => ['tank', 'helicopter', 'plane'].includes(c.type) ? c.type : 'car', bulletCalibre: b => b.cal || 'handgun', canBurn: () => true,
    missionCageShare: () => 1, lawVehicle: () => false, shieldBlocks: () => false, heavyRoundHitsBuilding: () => null,
    recordBlast: args => blasts.push(args), kickCamera() {}, blastEffects() {}, goreBlastDeath() {},
    explode: (...args) => blasts.push(args), bulletHitSurface: () => 'wall', bulletImpactSound() {}, bulletSpent() {},
    playerHitConfirm() {}, playerHitFeedback() {}, logHostileShot() {}, hurt() {}, shotLogHit() {},
    roofPartyPace: () => false, fortCoverPace: () => false, initAudio() {}, updateTouchUI() {}, renderSettings() {},
    settingsElement: (tag, cls, text = '') => new Element(tag, text), drawShellIcon() {},
    feedCheatBuffer: () => false, rideSkipActive: () => false, radioAboard: () => false, rideSkipKey: () => false,
    startReload() {}, poisonDrink() {}, toggleMap() {}, toggleCarRadio() {}, syncTouchInput() {}, touchEnabled: () => true, rideSkipPrompt: () => false,
    ridingBicycle: () => false, mountedGunKind: () => null, rooftopJob: () => null, toggleTankWeapon: () => false, toggleMountedWeapon: () => false, openArsenal() {},
    enforceVehicleHandgun() {}, cycleWeapon: () => { scope.genericCycles++; }, genericCycles: 0,
  });
  const input = read('game-input'), keyboardStart = input.indexOf("    window.addEventListener('keydown'"), keyboardEnd = input.indexOf('    /* weapon1', keyboardStart),
    keyupStart = input.indexOf("    window.addEventListener('keyup'"), keyupEnd = input.indexOf("    window.addEventListener('blur'", keyupStart);
  const mobile = read('mobile'), taps = mobile.slice(mobile.indexOf('    for (const [id, fn] of ['), mobile.indexOf("    /* Settings · Controls:")),
    arsenal = read('arsenal'), chipStart = arsenal.indexOf("    getElement('weaponButton').onclick"), chip = arsenal.slice(chipStart, arsenal.indexOf('\n', chipStart)),
    hud = read('hud-state'), hintStart = hud.indexOf('    function hudContext('), hintEnd = hud.indexOf('    /* HOW TO PLAY:', hintStart);
  const api = vm.runInContext(expand('apache') + '\n' + read('controls') + read('input-hints') + read('gamepad') +
    productionFunction('mobile', 'touchButtonLabel') + productionFunction('mobile', 'updateTouchUI') + taps + chip +
    hud.slice(hintStart, hintEnd) + productionFunction('settings', 'renderKeyBindings') +
    productionFunction('settings', 'bindingSlot') + productionFunction('settings', 'clashBanner') + productionFunction('settings', 'resolveClash') +
    productionFunction('hud-state', 'renderControlsHelp') +
    productionFunction('roofmission-layout', 'entityElevation') + productionFunction('roofmission-layout', 'sameFloor') +
    productionFunction('combat-rules', 'combatDistance') + productionFunction('combat-rules', 'shotVelocity') +
    productionFunction('combat-rules', 'bulletCalibre') + productionFunction('combat-rules', 'vehicleArmorShare') + productionFunction('combat-rules', 'bulletDamagesVehicle') +
    read('vehicle-gunfire') + read('game-combat') + productionFunction('citylife-police', 'sightBlockedBy') + 'let sightStamp = 0;\n' +
    productionFunction('citylife-police', 'clearSight') + productionFunction('game-player-actions', 'explode') +
    'const apacheHostExplode = explode; explode = (...args) => { recordBlast(args); return apacheHostExplode(...args); };\n' +
    productionFunction('game-player-actions', 'shoot') +
    input.slice(keyboardStart, keyboardEnd) + productionFunction('game-input', 'weaponSlotKey') + input.slice(keyupStart, keyupEnd) + `
      ({ arms: apacheArms, cycle: cycleApacheWeapon, fire: apacheGun, update: updatePlayerApache, rearm: updateApacheRearm,
        guidance: updateApacheGuidance, bullets: updateBullets, hud: apacheHud, report: apacheReport,
        lock: updateApacheLock, lineClear: apacheLineClear, weapon: apacheWeapon, hardpoint: apacheHardpoint, hardpoints: APACHE_HARDPOINTS, gunMuzzle: apacheGunMuzzle,
        bodyPitch: apacheBodyPitch, bodyRoll: apacheBodyRoll, gunYaw: apacheGunYaw, calibre: bulletCalibre,
        bind: bindControl, resetBindings: resetControlBindings, conflicts: controlConflicts, swapConflicts: controlSwapConflicts, banner: clashBanner, resolveClash, bindings: () => JSON.parse(JSON.stringify(controlBindings)), actions: CONTROL_ACTION,
        held: actionHeld, keyName, setDevice: setHintDevice, renderBindings: renderKeyBindings, renderHelp: renderControlsHelp,
        touchUI: updateTouchUI, quickKeys: renderQuickKeys, hudContext,
        pad: (button, down) => { const state = Array(16).fill(false); if (down) state[button] = true; padPlay(state, () => false, 0, 0, 0, 0); },
        aim: (x, y) => { apacheAimOverride = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null; },
        constants: () => ({ loadout: APACHE_LOADOUT, gun: APACHE_GUN_ROUNDS, rockets: APACHE_ROCKETS }),
        clearKeys: () => { keys = {}; releaseAllControlKeys(); } })`, scope);
  const key = (type, code, repeat = false) => scope.window.dispatchEvent(new scope.KeyboardEvent(type, { code, repeat, key: '' }));
  const c = { type: 'helicopter', airframe: 'apache', x: 0, y: 0, a: 0, altitude: 80, hp: 640, maxhp: 640, vx: 0, vy: 0, turretA: 0 };
  scope.player.car = c; scope.vehicles.push(c); api.arms(c);
  return { api, scope, c, walls, shots, blasts, crimes, notices, key, getElement, stored };
}

function apacheTransformProof(t, api, scope) {
  const bytes = fs.readFileSync(new URL('../../assets/apache-model.bin', import.meta.url)),
    header = JSON.parse(bytes.subarray(12, 12 + bytes.readUInt32LE(8)).toString());
  t.assert(JSON.stringify(header.hardpoints) === JSON.stringify(api.hardpoints), 'game hardpoints differ from measured downloaded source pack');
  const rs = vm.createContext({
    Three, clamp: scope.clamp, apacheBodyPitch: api.bodyPitch, apacheBodyRoll: api.bodyRoll, apacheGunYaw: api.gunYaw,
    entityElevation: scope.entityElevation, terrainHeight: scope.terrainHeight, normalizeAngle: scope.normalizeAngle,
    apacheAssetLod() {}, player: scope.player, gameTime: 100,
  });
  const animate = vm.runInContext(productionFunction('apache-assets3d', 'animateDownloadedApache') +
    productionFunction('apache3d', 'animateApache') + '\n animateApache', rs);
  const all = [...api.hardpoints.pods, ...api.hardpoints.antiarmor, ...api.hardpoints.air];
  let poses = 0, releases = 0, maximumError = 0;
  for (const heading of [-2.4, 0, 1.7]) for (const speed of [-500, 0, 430]) for (const av of [-2, 0, 2]) {
    const c = { ...scope.player.car, a: heading, turretA: heading + .6, speed, av, x: 125, y: -92, altitude: 150, gunPitch: -.35,
      arms: { missiles: 8, airMissiles: 4, gunReadyAt: 0 }, hp: 640, maxhp: 640 },
      group = new Three.Group(), body = new Three.Group(), gunYaw = new Three.Group(), gunPitch = new Three.Group(), barrel = new Three.Group();
    group.position.set(c.x, c.altitude, c.y); group.rotation.y = -c.a;
    group.add(body); body.add(gunYaw); gunYaw.position.fromArray(header.origins.gun).multiplyScalar(8); gunYaw.add(gunPitch); gunPitch.add(barrel);
    const sourceState = () => ({ spent: { value: new Three.Vector2() }, wear: { value: new Three.Vector2() } }),
      m = { group, body, gunYaw, gunPitch, barrel, apacheKit: {}, paint: { userData: { apacheSource: sourceState() } },
        apacheBeacon: { userData: { apacheSource: sourceState() } }, rotor: {}, disc: { visible: false }, lights: { nav: [], beacons: [] } };
    animate(c, m); group.updateMatrixWorld(true);
    for (const point of all) {
      const rendered = new Three.Vector3(point.x, point.z, point.y).applyMatrix4(body.matrixWorld), released = api.hardpoint(c, point),
        error = Math.hypot(rendered.x - released.x, rendered.z - released.y, rendered.y - released.altitude);
      maximumError = Math.max(maximumError, error); releases++;
      t.assert(error < 1e-7, 'source rack/pod release diverged from production Three body attitude: ' + error);
    }
    const pivot = api.hardpoints.gun.pivot, tip = api.hardpoints.gun.muzzle,
      local = new Three.Vector3(tip.x - pivot.x, tip.z - pivot.z, tip.y - pivot.y),
      rendered = local.applyMatrix4(barrel.matrixWorld), released = api.gunMuzzle(c, c.turretA),
      error = Math.hypot(rendered.x - released.x, rendered.z - released.y, rendered.y - released.altitude);
    maximumError = Math.max(maximumError, error); poses++;
    t.assert(error < 1e-7, 'source articulated barrel muzzle diverged from gameplay release: ' + error);
  }
  return { poses, hardpointReleases: releases, maximumError, method: 'downloaded pack source origins/hardpoints, real Three matrices, production animateDownloadedApache/animateApache, pure simulation release helpers' };
}

function apacheSavedBindingProof(t) {
  const f = fixture({ fire: ['KeyQ', null], cycleWeapon: ['KeyF', null] }), a = f.api,
    bindings = a.bindings(), arms = a.arms(f.c);
  t.assert(bindings.fire[0] === 'KeyQ' && bindings.cycleWeapon[0] === 'KeyF', 'new action migration changed saved fire/personal cycle keys');
  t.assert(bindings.cycleAircraftWeapon.every(x => x === null), 'new aircraft default conflicts with saved Fire Q');
  f.key('keydown', 'KeyQ'); f.key('keyup', 'KeyQ');
  t.assert(arms.rounds === 319 && arms.weapon === 'cannon' && f.scope.bullets.length === 1, 'saved Fire Q also cycled aircraft weapons');
  f.scope.player.car = null; f.key('keydown', 'KeyF'); f.key('keyup', 'KeyF');
  t.assert(f.scope.genericCycles === 1, 'migration changed the saved on-foot cycle key');
  const rockets = fixture({ rockets: ['KeyQ', null] });
  t.assert(rockets.api.bindings().rockets[0] === 'KeyQ' && rockets.api.bindings().cycleAircraftWeapon.every(x => x === null), 'saved direct rocket Q conflicts with the new aircraft cycle');
  rockets.key('keydown', 'KeyQ'); rockets.api.update(.05); rockets.key('keyup', 'KeyQ');
  t.assert(rockets.api.arms(rockets.c).weapon === 'cannon' && rockets.scope.bullets.some(b => b.apacheRocket), 'saved rocket Q also selected another aircraft weapon');
  const custom = fixture({ fire: ['KeyQ', null], cycleWeapon: ['KeyF', null], cycleAircraftWeapon: ['KeyU', null] });
  t.assert(custom.api.bindings().cycleAircraftWeapon[0] === 'KeyU', 'explicit saved aircraft cycle was overwritten');
  custom.key('keydown', 'KeyU'); custom.key('keyup', 'KeyU');
  t.assert(custom.api.arms(custom.c).weapon === 'rockets' && custom.scope.bullets.length === 0, 'saved custom aircraft cycle does not dispatch independently');
  const empty = fixture({ cycleAircraftWeapon: [null, null] });
  t.assert(empty.api.bindings().cycleAircraftWeapon.every(x => x === null), 'explicitly unbound aircraft cycle was restored to default');
  const old = fixture({ cycleWeapon: ['KeyN', null] });
  t.assert(old.api.bindings().cycleAircraftWeapon[0] === 'KeyQ', 'safe old saved controls lost the default aircraft Q');
  return { absentAction: 'only conflicting new default slots are unbound; existing saved keys remain intact', explicitAction: 'saved custom and unbound slots preserved' };
}
function apacheSwapProof(t) {
  const f = fixture(), { api, scope, key, stored } = f;
  api.resetBindings(); key('keydown', 'KeyW');
  const before = JSON.stringify(api.bindings()), storage = stored.get('dead-end-city-controls');
  t.assert(api.swapConflicts('cycleAircraftWeapon', 0, 'KeyF').includes('cycleWeapon'), 'unsafe aircraft/fire swap omitted its third-action conflict');
  t.assert(!api.bind('cycleAircraftWeapon', 0, 'KeyF', true), 'unsafe aircraft/fire swap unexpectedly succeeded');
  t.assert(JSON.stringify(api.bindings()) === before && stored.get('dead-end-city-controls') === storage && api.held('forward'), 'rejected swap changed slots, saved controls or held input');
  scope.settingsClash = { id: 'cycleAircraftWeapon', slot: 0, code: 'KeyF', conflicts: ['fire'] };
  const banner = api.banner();
  t.assert(banner.children[0].textContent.includes('Cannot swap') && banner.children[0].textContent.includes('NEXT WEAPON') && banner.children[1].disabled,
    'Settings clash banner did not explain and disable the unsafe third-action swap');
  api.resolveClash();
  t.assert(scope.settingsClash && JSON.stringify(api.bindings()) === before && stored.get('dead-end-city-controls') === storage, 'blocked Settings resolution dismissed or mutated the rejected binding');
  key('keyup', 'KeyW'); scope.settingsClash = null;
  t.assert(api.bind('horn', 0, 'KeyN', true), 'a simple legitimate horn/radio swap was rejected');
  t.assert(api.bindings().horn[0] === 'KeyN' && api.bindings().radioPower[0] === 'KeyH', 'simple swap failed to preserve the displaced key');
  api.resetBindings();
  t.assert(api.bind('fire', 0, 'KeyQ', true), 'conflict-free multi-action contextual swap was rejected');
  const swapped = api.bindings();
  t.assert(swapped.fire[0] === 'KeyQ' && swapped.cycleWeapon[0] === 'KeyF' && swapped.cycleAircraftWeapon[0] === 'KeyF', 'contextual multi-action swap lost a displaced action');
  key('keydown', 'KeyF'); key('keyup', 'KeyF');
  t.assert(api.arms(scope.player.car).weapon === 'rockets' && scope.genericCycles === 0, 'swapped aircraft cycle leaked into generic cycling');
  scope.player.car = null; key('keydown', 'KeyF'); key('keyup', 'KeyF');
  t.assert(scope.genericCycles === 1, 'contextual multi-action swap lost the displaced on-foot cycle');
  return { unsafeSwap: 'aircraft Q → fire F rejected atomically with Settings explanation', acceptedSwap: 'fire F → shared contextual Q displaces both independent cycles to F; horn/radio simple swap preserved' };
}

export default async function apacheWeapons(t) {
  const f = fixture(), { api, scope, c, key } = f;
  const arms = api.arms(c);
  t.assert(arms.weapon === 'cannon', 'Apache must board with its cannon selected');
  t.assert(arms.rounds === 320 && arms.rockets === 38 && arms.missiles === 8 && arms.airMissiles === 4, 'finite Apache loadout');
  t.assert(api.bindings().cycleAircraftWeapon[0] === 'KeyQ' && api.actions.cycleAircraftWeapon.ctx.join() === 'air', 'separate Q aircraft binding');
  t.assert(!api.actions.cycleWeapon.ctx.includes('air'), 'on-foot cycle still conflicts with aircraft Q');
  t.assert(api.conflicts('cycleAircraftWeapon', 'KeyQ').length === 0, 'default aircraft Q displays a false Settings binding conflict');
  key('keydown', 'KeyQ');
  t.assert(arms.weapon === 'rockets' && scope.genericCycles === 0, 'physical Q must select rockets in Apache');
  key('keydown', 'KeyQ', true); key('keydown', 'KeyQ');
  t.assert(arms.weapon === 'rockets', 'held Q or duplicate non-repeat keydown cycled again');
  key('keyup', 'KeyQ'); key('keydown', 'KeyQ'); key('keyup', 'KeyQ');
  t.assert(arms.weapon === 'hellfire', 'fresh Q must select guided armor missiles');
  key('keydown', 'KeyQ'); key('keyup', 'KeyQ');
  t.assert(arms.weapon === 'stinger', 'Q must include air-target missiles');
  key('keydown', 'KeyQ'); key('keyup', 'KeyQ');
  t.assert(arms.weapon === 'cannon', 'Q loadout must wrap back to cannon');
  scope.player.car = null; key('keydown', 'KeyQ'); key('keyup', 'KeyQ');
  t.assert(scope.genericCycles === 1, 'Q stopped cycling equipped weapons on foot');
  scope.player.car = { type: 'tank' }; key('keydown', 'KeyQ'); key('keyup', 'KeyQ');
  t.assert(scope.genericCycles === 2, 'Q stopped dispatching tank/mounted weapons');
  scope.player.car = c;
  t.assert(!api.bind('cycleAircraftWeapon', 0, 'KeyF'), 'aircraft cycle silently stole the fire binding');
  t.assert(api.bind('cycleAircraftWeapon', 0, 'KeyU'), 'aircraft weapon cycle cannot be remapped');
  key('keydown', 'KeyQ'); key('keyup', 'KeyQ');
  t.assert(arms.weapon === 'cannon' && scope.genericCycles === 2, 'unbound Q still switches Apache or personal weapon');
  key('keydown', 'KeyU'); key('keyup', 'KeyU');
  t.assert(arms.weapon === 'rockets', 'remapped aircraft cycle key did not dispatch');
  scope.player.car = null; key('keydown', 'KeyQ'); key('keyup', 'KeyQ');
  t.assert(scope.genericCycles === 3, 'aircraft remap changed the original on-foot Q binding');
  scope.player.car = c;
  api.setDevice('keyboard'); t.assert(api.keyName('cycleAircraftWeapon') === 'U', 'remapped key missing from hints');
  t.assert(fixture(JSON.parse(f.stored.get('dead-end-city-controls'))).api.bindings().cycleAircraftWeapon[0] === 'KeyU', 'aircraft cycle remap did not survive storage reload');
  api.setDevice('gamepad'); t.assert(api.keyName('cycleAircraftWeapon') === 'LB', 'gamepad aircraft cycle must name LB');
  api.pad(4, true); api.pad(4, true); api.pad(4, false);
  t.assert(arms.weapon === 'hellfire', 'gamepad LB must cycle once while held');
  api.setDevice('touch'); t.assert(api.keyName('cycleAircraftWeapon') === 'WEAPON', 'touch aircraft cycle does not name its button');
  api.setDevice('keyboard');
  api.touchUI();
  t.assert(!f.getElement('touchWeapon').classList.contains('hidden'), 'Apache weapon button hidden on touch');
  f.getElement('touchWeapon').onclick({ preventDefault() {} });
  t.assert(arms.weapon === 'stinger', 'touch weapon button does not select next Apache weapon');
  f.getElement('weaponButton').onclick();
  t.assert(arms.weapon === 'cannon', 'weapon chip does not cycle Apache armament');
  api.quickKeys();
  t.assert(api.hudContext() === 'apache' && f.getElement('cycleKeyHint').textContent === 'U', 'Apache HUD names generic or stale cycle binding');
  const body = new Element(); api.renderBindings(body);
  const row = body.children.find(el => el.dataset?.row === 'cycleAircraftWeapon');
  t.assert(row?.children[1]?.children.length === 2, 'aircraft cycle missing from Settings remapping slots');
  api.renderHelp();
  t.assert(JSON.stringify(f.getElement('controlGrid').children).includes('Apache'), 'controls card omits Apache weapon cycle');
  // Use the production swept projectile path, damage-class/armour rules and expiry/explosion path.
  const combat = fixture(), a = combat.api, sc = combat.scope, heli = combat.c, stores = a.arms(heli);
  const tick = (seconds, bullets = false, dt = .05) => {
    for (let elapsed = 0; elapsed < seconds - 1e-8; elapsed += dt) {
      const step = Math.min(dt, seconds - elapsed); sc.gameTime += step; a.update(step); if (bullets) a.bullets(step);
    }
  };
  const clearBullets = () => { sc.bullets.splice(0); combat.blasts.splice(0); combat.shots.splice(0); };
  const target = { type: 'sedan', x: 360, y: 0, a: 0, hp: 600, maxhp: 600, vx: 0, vy: 0 };
  sc.vehicles.push(target); a.aim(target.x, target.y); a.update(.05);
  combat.key('keydown', 'KeyF'); combat.key('keyup', 'KeyF');
  const cannon = sc.bullets[0];
  t.assert(cannon && cannon.heavyRound && cannon.cal === 'rifle' && cannon.goreCal === 'heavy' && a.calibre(cannon) === 'rifle' && !cannon.rocket && cannon.owner === sc.player, '30 mm must use the heavy-round/owner damage contract');
  t.assert(stores.rounds === 319 && stores.rockets === 38, 'cannon charged the wrong ammunition pool');
  const muzzle = a.gunMuzzle(heli, heli.turretA);
  t.assert(Math.hypot(cannon.x - muzzle.x, cannon.y - muzzle.y, cannon.altitude - muzzle.altitude) < 1e-7, 'cannon did not release from its rendered hardpoint');
  t.assert(!a.fire(heli) && stores.rounds === 319, 'cannon cooldown permits duplicate shots');
  tick(.8, true);
  t.assert(target.hp < 600 && combat.shots.some(hit => hit.b === cannon), '30 mm did not damage the vehicle through the shared swept hit path');
  t.assert(sc.bullets.length === 0, 'spent cannon round retained after impact');
  clearBullets(); target.hp = 600; combat.walls.push({ x: 150, y: -50, w: 20, h: 100, height: 200 });
  t.assert(a.fire(heli), 'cannon cover fixture could not fire'); tick(.6, true);
  t.assert(target.hp === 600 && sc.bullets.length === 0, 'cannon round passed through an occluding building');
  combat.walls.splice(0);
  stores.rounds = 0; sc.gameTime += 1;
  t.assert(!a.fire(heli) && sc.bullets.length === 0, 'empty cannon still released a projectile');
  clearBullets(); sc.vehicles.splice(1); stores.weapon = 'rockets';
  t.assert(a.fire(heli), 'selected rocket pods did not accept the fire trigger');
  t.assert(!a.fire(heli), 'rocket salvo re-triggered while already rippling');
  tick(.5);
  t.assert(sc.bullets.length === 4 && stores.rockets === 34 && stores.rounds === 0 && stores.salvoLeft === 0, 'rocket ripple must release four finite rounds from its own pool');
  for (let i = 0; i < sc.bullets.length; i++) {
    const b = sc.bullets[i], expected = a.hardpoint(heli, a.hardpoints.pods[i % 2]);
    t.assert(b.apacheRocket && b.rocket && b.shell && b.owner === sc.player && Number.isFinite(b.life) && b.life > 0 && b.life < 3, 'pod projectile lost shared rocket/shell/finite-flight contracts');
    t.assert(Math.hypot(b.x - expected.x, b.y - expected.y, b.altitude - expected.altitude) < 1e-7, 'rocket ripple did not alternate the actual pod mouths');
  }
  tick(2, true);
  t.assert(sc.bullets.length === 0 && combat.blasts.length === 4, 'pod rockets must expire through the common explosion path');
  clearBullets(); stores.rockets = 2; sc.gameTime += 2;
  t.assert(a.fire(heli), 'partial pod magazine could not fire'); tick(.5);
  t.assert(stores.rockets === 0 && sc.bullets.length === 2 && stores.salvoLeft === 0, 'partial rocket salvo over-drew ammunition');
  sc.gameTime += 2; t.assert(!a.fire(heli), 'empty pod magazine still accepted a salvo');
  clearBullets(); stores.weapon = 'cannon'; stores.rockets = 4; stores.salvoReadyAt = 0;
  combat.key('keydown', 'Space'); a.update(.05); combat.key('keyup', 'Space'); tick(.5);
  t.assert(stores.weapon === 'cannon' && stores.rockets === 0 && sc.bullets.length === 4, 'Space shortcut must fire rocket pods without silently changing the selected weapon');
  clearBullets(); stores.rockets = 4; stores.salvoReadyAt = 0; sc.mouse.alt = true; a.update(.05); sc.mouse.alt = false; tick(.5);
  t.assert(stores.weapon === 'cannon' && stores.rockets === 0 && sc.bullets.length === 4, 'right-click shortcut must use the finite rocket magazine');
  clearBullets(); stores.weapon = 'hellfire'; sc.vehicles.push(target); target.hp = 600;
  t.assert(!a.fire(heli) && stores.missiles === 8 && sc.bullets.length === 0, 'guided missile launched without a lock');
  tick(.5);
  t.assert(stores.lockTarget === target && !stores.lockReady, 'ground lock must acquire the reticle target then dwell');
  tick(.3);
  t.assert(stores.lockReady, 'ground target never achieved a usable lock');
  combat.walls.push({ x: 180, y: -30, w: 20, h: 60, height: 200 }); tick(.15);
  t.assert(stores.lockTarget === null && !stores.lockReady, 'occluding solid did not break the acquisition lock');
  combat.walls.splice(0); tick(.85);
  t.assert(stores.lockReady && a.fire(heli), 'ground missile could not launch after a clear reacquisition');
  const missile = sc.bullets[0], hardpoint = a.hardpoint(heli, a.hardpoints.antiarmor[0]);
  t.assert(stores.missiles === 7 && stores.airMissiles === 4 && missile.apacheGuided === 'hellfire' && missile.antiTank && missile.shell && missile.rocket && missile.owner === sc.player, 'anti-armour launch lost ammunition/damage ownership contracts');
  t.assert(Math.hypot(missile.x - hardpoint.x, missile.y - hardpoint.y, missile.altitude - hardpoint.altitude) < 1e-7, 'guided missile did not release from its occupied rack slot');
  t.assert(!a.fire(heli) && stores.missiles === 7, 'anti-armour cooldown permits duplicate missiles');
  target.y = 80; target.vy = 40;
  const initialHeading = Math.atan2(missile.vy, missile.vx); sc.gameTime += .05; a.guidance(missile, .05);
  const changedHeading = Math.atan2(missile.vy, missile.vx);
  t.assert(changedHeading > initialHeading && changedHeading - initialHeading <= missile.apacheTurn * .05 + 1e-8, 'missile did not turn toward the moving target at its bounded rate');
  t.assert(Math.abs(Math.hypot(missile.vx, missile.vy, missile.vz) - missile.apacheSpeed) < 1e-7, 'guidance changed projectile speed or generated non-finite flight');
  combat.walls.push({ x: 180, y: -80, w: 20, h: 200, height: 200 }); sc.gameTime += .2; a.guidance(missile, .05);
  t.assert(missile.apacheTarget === null, 'missile retained an occluded target');
  combat.walls.splice(0); target.y = 0; sc.gameTime += .2; a.guidance(missile, .05);
  t.assert(missile.apacheTarget === null, 'missile silently reacquired after losing sight');
  sc.player.car = null; heli.hp = 0;
  for (let i = 0; i < 90 && sc.bullets.length; i++) { sc.gameTime += .05; a.bullets(.05); }
  t.assert(sc.bullets.length === 0 && combat.blasts.length === 1, 'orphaned missile did not retire through finite shared flight/explosion after bailout or shooter loss');
  // The anti-armour projectile must actually damage tanks; the aircraft-only mode must hit aircraft.
  const impact = fixture(), ia = impact.api, is = impact.scope, ih = impact.c, inventory = ia.arms(ih);
  const tank = { type: 'tank', x: 420, y: 0, a: 0, hp: 1200, maxhp: 1200, vx: 0, vy: 0 };
  is.vehicles.push(tank); ia.aim(tank.x, tank.y); inventory.weapon = 'cannon';
  ia.update(.05); t.assert(ia.fire(ih), 'tank protection fixture could not fire cannon');
  for (let i = 0; i < 30 && is.bullets.length; i++) { is.gameTime += .05; ia.bullets(.05); }
  t.assert(tank.hp === 1200, '30 mm bypassed the existing tank anti-tank-only damage gate');
  const bystander = { x: 430, y: 20, hp: 100 }, covered = { x: 430, y: 80, hp: 100 };
  is.enemies.push(bystander, covered); impact.walls.push({ x: 410, y: 40, w: 40, h: 10, height: 200 });
  inventory.weapon = 'hellfire';
  for (let i = 0; i < 20; i++) { is.gameTime += .05; ia.update(.05); }
  t.assert(ia.fire(ih), 'anti-armour could not fire on a tank');
  for (let i = 0; i < 40 && is.bullets.length; i++) { is.gameTime += .05; ia.bullets(.05); }
  t.assert(tank.hp < 1200 && impact.blasts.length === 1, 'anti-armour did not damage a tank through shared damage/explosion rules');
  t.assert(bystander.hp < 100 && covered.hp === 100, 'real explode must apply collateral blast damage while preserving clearSight cover');
  impact.walls.splice(0); is.enemies.splice(0);
  const air = { type: 'helicopter', x: 450, y: 0, a: 0, altitude: 140, hp: 600, maxhp: 600, vx: 0, vy: 0 };
  is.vehicles.push(air); inventory.weapon = 'stinger'; ia.aim(air.x, air.y); inventory.lockNextAt = 0;
  for (let i = 0; i < 18; i++) { is.gameTime += .05; ia.update(.05); }
  t.assert(inventory.lockTarget === air && inventory.lockReady, 'air-target mode did not select the airborne aircraft over the ground tank');
  t.assert(ia.fire(ih) && inventory.airMissiles === 3 && inventory.missiles === 7, 'air-target missile consumed the wrong ammunition or failed to launch');
  const airMissile = is.bullets[0];
  t.assert(airMissile.apacheGuided === 'stinger' && !airMissile.antiTank && airMissile.life <= 4, 'air missile uses the wrong damage class or unbounded lifetime');
  for (let i = 0; i < 60 && is.bullets.length; i++) { is.gameTime += .05; ia.bullets(.05); }
  t.assert(air.hp < 600 && impact.blasts.length === 2, 'air-target missile failed to damage its airborne target through shared collision');
  inventory.weapon = 'hellfire'; inventory.lockNextAt = 0; tank.hp = 0;
  for (let i = 0; i < 20; i++) { is.gameTime += .05; ia.update(.05); }
  t.assert(inventory.lockTarget === null && !inventory.lockReady, 'anti-armour mode accepted a dead ground target or an aircraft');
  // A removed vehicle reference must be dropped by the missile's bounded sight check.
  inventory.weapon = 'stinger'; inventory.lockNextAt = 0; air.hp = 600;
  for (let i = 0; i < 18; i++) { is.gameTime += .05; ia.update(.05); }
  t.assert(ia.fire(ih), 'air missile lifecycle fixture could not launch');
  const detached = is.bullets[0]; is.vehicles.splice(is.vehicles.indexOf(air), 1); is.gameTime += .2; ia.guidance(detached, .05);
  t.assert(detached.apacheTarget === null, 'missile retained a retired world vehicle');
  // Air mode rejects aircraft on the ground; range/forward arc and the chase reticle still gate acquisition.
  inventory.lockNextAt = 0; is.vehicles.push(air); air.altitude = 0;
  for (let i = 0; i < 14; i++) { is.gameTime += .05; ia.update(.05); }
  t.assert(inventory.lockTarget === null, 'air-target mode acquired a landed aircraft');
  air.altitude = 140; air.x = 1800; ia.aim(air.x, air.y); inventory.lockNextAt = 0;
  for (let i = 0; i < 14; i++) { is.gameTime += .05; ia.update(.05); }
  t.assert(inventory.lockTarget === null, 'air-target lock acquired a vehicle outside its finite range');
  air.x = -450; ia.aim(air.x, air.y); inventory.lockNextAt = 0;
  for (let i = 0; i < 14; i++) { is.gameTime += .05; ia.update(.05); }
  t.assert(inventory.lockTarget === null, 'air-target lock acquired a target behind the launch arc');
  air.x = 450; ia.aim(); inventory.lockNextAt = 0;
  is.chaseCameraLive = () => true; is.chaseGroundPoint = () => ({ x: 450, y: 0 });
  is.chaseProject = (x, y, z, out) => Object.assign(out || {}, { x: 500, y: 350, depth: 200, behind: false });
  for (let i = 0; i < 14; i++) { is.gameTime += .05; ia.update(.05); }
  t.assert(inventory.lockTarget === air && inventory.lockReady, 'chase screen reticle did not acquire the elevated aircraft');
  is.chaseProject = (x, y, z, out) => Object.assign(out || {}, { x: 750, y: 350, depth: 200, behind: false });
  inventory.lockNextAt = 0; is.gameTime += .15; ia.update(.05);
  t.assert(inventory.lockTarget === null && !inventory.lockReady, 'chase target retained lock after leaving the screen reticle');
  inventory.weapon = 'hellfire'; inventory.missiles = 5; ia.hud(ih);
  t.assert(impact.getElement('weaponName').textContent.includes('HELLFIRE') && impact.getElement('ammo').textContent === '05' && impact.getElement('reserve').textContent.includes('SEEK TARGET'), 'weapon chip retained cannon ammunition or hid missile lock state');
  inventory.weapon = 'stinger'; inventory.airMissiles = 2; inventory.lockReady = true; inventory.stingerReadyAt = 0; ia.hud(ih);
  t.assert(impact.getElement('weaponName').textContent.includes('STINGER') && impact.getElement('ammo').textContent === '02' && impact.getElement('reserve').textContent.includes('LOCK'), 'weapon chip does not expose selected air-missile ammo and lock');
  inventory.stingerReadyAt = is.gameTime + 1; ia.hud(ih);
  t.assert(impact.getElement('reserve').textContent.includes('WAIT'), 'weapon chip omits the missile launch cooldown');
  is.chaseCameraLive = () => false; ia.aim(450, 0);
  // Pad rearm fills each separate magazine, never while flying or away from a Fort pad.
  is.bullets.splice(0); inventory.rounds = 0; inventory.rockets = 0; inventory.missiles = 0; inventory.airMissiles = 0;
  ih.x = 1000; ih.y = 1000; ih.altitude = 80;
  ia.rearm(ih, 10);
  t.assert(!inventory.rearming && inventory.rounds === 0 && inventory.missiles === 0, 'airborne aircraft was rearmed');
  ih.altitude = 0; ih.x = 1200; ia.rearm(ih, 10);
  t.assert(!inventory.rearming && inventory.rockets === 0, 'off-pad aircraft was rearmed');
  ih.x = 1000; ih.vx = 20; ia.rearm(ih, 10);
  t.assert(!inventory.rearming && inventory.airMissiles === 0, 'moving aircraft was rearmed');
  ih.vx = 0;
  for (let i = 0; i < 200; i++) { is.gameTime += .1; ia.rearm(ih, .1); }
  t.assert(inventory.rounds === 320 && inventory.rockets === 38 && inventory.missiles === 8 && inventory.airMissiles === 4 && !inventory.rearming, 'Fort pad did not restore all separate magazines to their caps');
  inventory.rounds--; ia.rearm(ih, .001); inventory.weapon = 'cannon';
  t.assert(inventory.rearming && !ia.fire(ih) && is.bullets.length === 0, 'Apache fired while the pad crew was actively rearming');
  inventory.weapon = 'rockets'; inventory.salvoReadyAt = 0;
  t.assert(!ia.fire(ih) && inventory.salvoLeft === 0, 'rocket salvo started during active rearm');
  const held = fixture(), ha = held.api, hs = held.scope, hc = held.c, heldStores = ha.arms(hc),
    heldTarget = { type: 'sedan', x: 400, y: 0, a: 0, hp: 1000, maxhp: 1000 };
  hs.vehicles.push(heldTarget); ha.aim(400, 0); heldStores.weapon = 'hellfire';
  let firstLaunch = 0, launches = 0;
  for (let i = 0; i < 20; i++) {
    hs.gameTime += .05; ha.update(.05);
    if (ha.fire(hc)) { if (!firstLaunch) firstLaunch = (i + 1) * .05; launches++; }
  }
  t.assert(launches === 1 && firstLaunch >= .65 && firstLaunch <= .9 && heldStores.missiles === 7, 'holding fire prevented lock acquisition or bypassed dwell/cooldown');
  const wall = fixture(), wa = wall.api, ws = wall.scope, wc = wall.c, wallStores = wa.arms(wc),
    wallTarget = { type: 'tank', x: 420, y: 0, a: 0, hp: 1200, maxhp: 1200 };
  ws.vehicles.push(wallTarget); wa.aim(420, 0); wallStores.weapon = 'hellfire';
  // A narrow wall in front of the rack leaves the chin sensor clear. The common sweep must stop the released missile.
  wall.walls.push({ x: 28, y: -25, w: 9, h: 20, height: 200 });
  for (let i = 0; i < 20; i++) { ws.gameTime += .05; wa.update(.05); }
  t.assert(wallStores.lockReady && wa.fire(wc), 'rack-wall fixture could not acquire from its clear chin sensor');
  ws.gameTime += .05; wa.bullets(.05);
  t.assert(ws.bullets.length === 0 && wall.blasts.length === 1 && wall.blasts[0][0] < 50 && wallTarget.hp === 1200, 'new missile tunneled through a wall immediately beyond its rack');
  // These armaments remain player-owned; an unoccupied/NPC aircraft never gains autonomous fire.
  inventory.rearming = false; inventory.weapon = 'hellfire'; ih.altitude = 80; ih.airUnit = true; is.player.car = null;
  const npcAmmo = [inventory.rounds, inventory.rockets, inventory.missiles, inventory.airMissiles].join();
  for (let i = 0; i < 60; i++) { is.gameTime += .05; ia.update(.05); }
  t.assert(is.bullets.length === 0 && [inventory.rounds, inventory.rockets, inventory.missiles, inventory.airMissiles].join() === npcAmmo, 'unoccupied/NPC Apache gained autonomous projectile fire');
  const savedBindings = apacheSavedBindingProof(t), swaps = apacheSwapProof(t);
  const transforms = apacheTransformProof(t, api, scope);
  t.note(JSON.stringify({ savedBindings, swaps, transforms, method: 'production-host', controls: 'actual registered keydown/keyup and pad handlers, mobile/chip callbacks, settings and help', combat: 'actual Apache emission, swept updateBullets, elevation, vehicle damage/armour, clearSight and explode damage/falloff; render/audio, detailed blast effects and damage mutation callbacks are isolated' , limits: 'No browser, native graphics, real GPU or hardware FPS evidence.' }));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let checks = 0;
  await apacheWeapons({ assert(value, message) { checks++; assert.ok(value, message); }, note: console.log });
  console.log('PASS apache-weapons: ' + checks + ' host assertions');
}
