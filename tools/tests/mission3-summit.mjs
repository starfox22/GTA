// Mission 3 (High Ground, summitjob.js): arriving on the summit platform, digging up the cache with the
// interact key held (progress kept across a release), the package stowed in the vehicle parked beside
// the cairn (E at its back) or carried in a backpack, and the handover to Vinny inside his warehouse winning it.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    let s = await t.call('startMission', 2);
    t.assert(s.mission === 'High Ground', 'mission 3 is not High Ground: ' + JSON.stringify(s));
    let m = await t.call('summitJob');
    t.assert(m.stage === 0 && /SUMMIT OF MOUNT ASCENT/.test(m.instruction), 'stage 0: ' + JSON.stringify(m));
    t.near(m.target.x, 7759, 7761, 'stage 0 points at the summit');

    // On foot by the cairn: the arrival, then the dig (held key; a release keeps the progress).
    m = await t.call('summitSkip', 'summit');
    t.assert(m.stage === 1 && m.arrived, 'not at the summit: ' + JSON.stringify(m));
    await t.keys('KeyE', 3);
    m = await t.call('summitJob');
    t.assert(m.dig > 0.3 && m.dig < 0.5 && m.digging, 'dig progress after 3 s: ' + JSON.stringify(m));
    await t.wait(1);
    m = await t.call('summitJob');
    t.assert(m.dig > 0.3 && !m.digging, 'a release lost the dig or kept the pose: ' + JSON.stringify(m));
    await t.keys('KeyE', 5);
    m = await t.call('summitJob');
    t.assert(m.stage === 3 && m.carrier === 'backpack' && m.dig === 1, 'no vehicle near: the package goes in the backpack: ' + JSON.stringify(m));
    const card = await t.call('missionCard');
    t.assert(/warehouse/i.test(card.text), 'the card should send the player to the warehouse: ' + card.text);

    // Again with a truck parked on the platform: the package is loaded at its back.
    await t.call('startMission', 2);
    await t.call('teleport', 7738, 1092);
    await t.call('drive', 'hilux', 0, Math.PI);
    await t.wait(0.5);
    await t.call('placeVehicle', 7738, 1092, Math.PI);
    await t.keys('KeyE', 0.2, { real: true });
    await t.wait(1);
    s = await t.call('status');
    t.assert(!s.vehicle, 'could not get out on the summit: ' + JSON.stringify(s));
    m = await t.call('summitJob');
    t.assert(m.stage === 1 && m.lastCar === 'hilux', 'stage 1 with the truck: ' + JSON.stringify(m));
    await t.call('teleport', 7768, 1074);
    await t.keys('KeyE', 8);
    m = await t.call('summitJob');
    t.assert(m.stage === 2 && m.carrier === 'hand' && /TRUCK/.test(m.instruction), 'load stage: ' + JSON.stringify(m));
    await t.call('teleport', m.target.x, m.target.y);
    await t.keys('KeyE', 0.2, { real: true });
    await t.wait(0.5);
    m = await t.call('summitJob');
    t.assert(m.stage === 3 && m.carrier === 'car' && m.carryCar?.type === 'hilux', 'not loaded into the truck: ' + JSON.stringify(m));
    t.assert(/GET BACK IN/.test(m.instruction), 'on foot away from the truck the card points at it: ' + m.instruction);
    // The handover: in through the shutter, E beside Vinny, the payday.
    await t.call('summitSkip', 'deliver');
    await t.call('teleport', -1630, 4480);
    await t.wait(0.5);
    m = await t.call('summitJob');
    t.assert(m.insideDepot && m.vinny && /HAND VINNY/.test(m.instruction), 'inside the warehouse: ' + JSON.stringify(m));
    await t.call('teleport', -1625, 4497);
    await t.keys('KeyE', 0.2, { real: true });
    await t.wait(0.5);
    m = await t.call('summitJob');
    t.assert(m.stage === 4, 'handover not started: ' + JSON.stringify(m));
    await t.wait(7);
    const done = await t.call('missionState');
    t.assert(!done.mission && done.last?.result === 'won' && done.last.index === 2, 'mission 3 not won: ' + JSON.stringify(done));
  } finally {
    await t.call('holdSimulation', false);
  }
}
