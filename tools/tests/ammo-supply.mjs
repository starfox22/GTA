// Ammunition supply (ammo-supply.js) and its neighbours: no street ammo, armour or weapon
// pickups; the armory sells them; a body's gun is taken once with the action key; a police
// car, a SWAT van and an FBI SUV restock once each; a gunman off screen holds fire and one
// on screen shoots (combat-rules.js ON-SCREEN RULE); the on-foot zoom starts one step out;
// the mission card reads MISSION 1, no total.
export const fresh = true;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The prompt is written by drawn frames: poll it while the loop runs.
async function promptOffered(t, needle) {
  let last = null;
  for (let i = 0; i < 20; i++) {
    last = (await t.call('promptState')).offered;
    if (last && last.includes(needle)) return last;
    await sleep(250);
  }
  return last;
}
const weapon = async (t, i) => (await t.call('ammoSupply')).weapons[i];

export default async function (t) {
  // The zoom and the mission card on a fresh page, before anything moves them.
  const view = await t.call('cameraView');
  t.near(view.defaultZoom, 2, 2, 'default on-foot zoom');
  t.near(view.target, 2, 2, 'on-foot zoom at start');
  let card = await t.call('missionCard');
  t.assert(card.counter === 'MISSION 1', `mission card before the first job: ${JSON.stringify(card)}`);

  // Street pickups: health only.
  let supply = await t.call('ammoSupply');
  t.assert(!supply.pickups.ammo && !supply.pickups.armor && Object.keys(supply.pickups).every((k) => k === 'health'), `street pickups: ${JSON.stringify(supply.pickups)}`);
  t.assert(supply.pickups.health >= 5, `health pickups: ${JSON.stringify(supply.pickups)}`);
  const armory = supply.shops.find((s) => s.name === 'SOUTH COAST ARMORY');
  t.assert(armory, `no armory in Northbank: ${JSON.stringify(supply.shops)}`);

  // The armory door offers guns, ammo and armour.
  await t.call('teleport', armory.x, armory.y + 20);
  const shopPrompt = await promptOffered(t, 'AMMO');
  t.assert(shopPrompt && shopPrompt.includes('ARMORY'), `armory prompt: ${shopPrompt}`);

  // Out on the airport runway: open ground, nobody about.
  await t.call('teleport', 420, 4600);
  await t.call('god', true);

  // A gang member's body: the prompt names the gun; the action key takes it once.
  await t.call('setAmmo', 1, 0, 0, false);
  const gangLoot = await t.call('armedBody', 'gang', 10, 0);
  t.assert(gangLoot && gangLoot.weapon === 'MACHINE PISTOL', `gang body carries: ${JSON.stringify(gangLoot)}`);
  t.assert(gangLoot.ammo + gangLoot.reserve > 0 && gangLoot.ammo + gangLoot.reserve <= 60, `gang rounds: ${JSON.stringify(gangLoot)}`);
  const lootPrompt = await promptOffered(t, 'TAKE MACHINE PISTOL');
  t.assert(lootPrompt && lootPrompt.includes('TAKE MACHINE PISTOL'), `loot prompt: ${lootPrompt}`);
  await t.call('holdSimulation', true);
  try {
    await t.call('interact');
    supply = await t.call('ammoSupply');
    const smg = supply.weapons[1];
    t.assert(smg.owned && smg.ammo + smg.reserve === gangLoot.ammo + gangLoot.reserve, `SMG after the loot: ${JSON.stringify(smg)} from ${JSON.stringify(gangLoot)}`);
    t.assert(supply.crouching, 'no crouch over the body');
    t.assert(!supply.body, `the body can be searched again: ${JSON.stringify(supply.body)}`);
    // Feet stay put in the crouch, then walk on.
    let s0 = await t.call('status');
    await t.keys('KeyW', 0.3);
    let s1 = await t.call('status');
    t.assert(Math.hypot(s1.x - s0.x, s1.y - s0.y) < 2, `moved in the crouch: ${JSON.stringify([s0.x, s0.y, s1.x, s1.y])}`);
    await t.wait(0.5);
    t.assert(!(await t.call('ammoSupply')).crouching, 'still crouching after the take');

    // A patrol officer's body: the duty pistol's rounds into the reserve, one or two magazines.
    await t.call('setAmmo', 0, 12, 0);
    const copLoot = await t.call('armedBody', 'patrol', 0, 10);
    t.assert(copLoot && copLoot.weapon === '9MM PISTOL' && copLoot.reserve >= 12 && copLoot.reserve <= 24, `officer carries: ${JSON.stringify(copLoot)}`);
    await t.call('interact');
    let pistol = await weapon(t, 0);
    t.assert(pistol.reserve === copLoot.ammo + copLoot.reserve, `pistol reserve after the officer: ${JSON.stringify(pistol)}`);
    await t.wait(0.7);
    await t.call('interact');
    t.assert((await weapon(t, 0)).reserve === pistol.reserve, 'the officer was searched twice');

    // A patrol car: a box of 9 mm, once.
    await t.call('setAmmo', 0, 12, 0);
    const cruiser = await t.call('parkLawVehicle', 'patrol', true);
    t.assert(cruiser.aboard && cruiser.armsTaken, `patrol car: ${JSON.stringify(cruiser)}`);
    pistol = await weapon(t, 0);
    t.assert(pistol.reserve === 48, `pistol reserve from the patrol car: ${JSON.stringify(pistol)}`);
    await t.call('wanted', 0);
    await t.call('interact'); // out
    await t.wait(0.5);
    await t.call('setAmmo', 0, 12, 0);
    await t.call('interact'); // back in, the same car
    const aboard = await t.call('status');
    t.assert(aboard.vehicle === 'police', `not back in the car: ${JSON.stringify(aboard)}`);
    t.assert((await weapon(t, 0)).reserve === 0, 'the patrol car restocked twice');
    await t.call('wanted', 0);

    // A SWAT van: a carbine with magazines when none is owned, shells for an owned shotgun.
    await t.call('setAmmo', 4, 0, 0, false);
    await t.call('setAmmo', 2, 6, 0, true);
    const van = await t.call('parkLawVehicle', 'swat', true);
    t.assert(van.aboard && van.armsTaken, `SWAT van: ${JSON.stringify(van)}`);
    supply = await t.call('ammoSupply');
    const rifle = supply.weapons[4],
      shotgun = supply.weapons[2];
    t.assert(rifle.owned && rifle.ammo + rifle.reserve === 150, `rifle from the SWAT van: ${JSON.stringify(rifle)}`);
    t.assert(shotgun.reserve === 24, `shells from the SWAT van: ${JSON.stringify(shotgun)}`);

    // An FBI SUV: SMG magazines.
    await t.call('setAmmo', 1, 30, 0, true);
    const suv = await t.call('parkLawVehicle', 'fed', true);
    t.assert(suv.aboard && suv.armsTaken && (await weapon(t, 1)).reserve === 90, `FBI SUV: ${JSON.stringify(suv)}`);
    await t.call('wanted', 0);
    await t.call('interact'); // out
    await t.wait(0.5);
    await t.call('wanted', 0);

    // ON-SCREEN RULE: a gunman beyond the top of the screen closes in but holds fire.
    const cam = await t.call('cameraView');
    const halfDepth = (cam.viewMetres * 8) / 2 / (680 / Math.hypot(680, 560));
    const off = Math.round(halfDepth + 110);
    t.assert(off < 330, `the screen reaches past gang range: half depth ${halfDepth}`);
    await t.call('teleport', 420, 4600);
    await t.wait(0.2);
    await t.call('shotLog', true);
    await t.call('hostileGunman', 0, -off);
    await t.wait(3);
    let log = await t.call('shotLog');
    const offShots = log.bySource?.['harbor-gunman']?.shots || 0;
    t.assert(offShots === 0, `the gunman fired from off screen (${off} units): ${JSON.stringify(log.bySource)}`);
    // On screen, close by: he fires.
    await t.call('hostileGunman', 40, -Math.round(halfDepth * 0.5));
    await t.wait(4);
    log = await t.call('shotLog');
    const src = log.bySource?.['harbor-gunman'] || {};
    t.assert(src.shots > 0, `the on-screen gunman held fire: ${JSON.stringify(log.bySource)}`);
    t.assert(!src.offscreen, `rounds logged from off screen: ${JSON.stringify(src)}`);
    t.note(`screen half depth ${Math.round(halfDepth)} units; on-screen gunman fired ${src.shots}`);
  } finally {
    await t.call('holdSimulation', false);
    await t.call('god', false);
  }

  // The mission card and the start headline: MISSION 2, no total.
  await t.call('startMission', 1);
  card = await t.call('missionCard');
  t.assert(card.counter === 'MISSION 2' && card.announce === 'MISSION 2', `mission 2 card: ${JSON.stringify(card)}`);
}
