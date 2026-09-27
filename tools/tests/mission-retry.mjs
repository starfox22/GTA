// RESTART CURRENT JOB (retryMission): a failed mission 1 restarts clean (a fresh truck at
// its kerb, stage 0, no stars), and a helicopter the player was flying comes down instead
// of hanging pilotless in the air.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('startMission', 0);
    const first = (await t.call('missionTargets')).car;
    await t.call('boardMissionVehicle');
    await t.call('interact'); // out of the cab
    await t.wait(1);
    await t.call('teleport', first.x - 500, first.y - 30); // well clear of the blasts
    let m = null;
    for (let i = 0; i < 8 && !m?.last; i++) {
      await t.call('blast', first.x, first.y, 4);
      await t.wait(0.5);
      m = await t.call('missionState');
    }
    t.assert(m.last?.result === 'failed' && /destroyed/.test(m.last.reason), 'truck loss did not fail the job: ' + JSON.stringify(m));
    m = await t.call('retryMission');
    t.assert(m.mode === 'play' && m.index === 0 && m.stage === 0 && m.wanted === 0, 'retry did not restart clean: ' + JSON.stringify(m));
    const again = await t.call('missionTargets');
    t.assert(again.car && again.car.id !== first.id && again.car.hp === again.car.maxhp, 'no fresh truck: ' + JSON.stringify(again.car));
    t.assert(again.missionVehicles.length === 1 && !again.player.vehicle, 'leftovers after the retry: ' + JSON.stringify(again.missionVehicles));

    // Retry while flying: the helicopter is left to come down.
    await t.call('teleport', 1200, 900);
    await t.call('drive', 'helicopter', 60);
    await t.wait(0.5);
    const s = await t.call('status');
    const heli = await t.call('vehicleAt', s.x, s.y);
    t.assert(heli.type === 'helicopter' && heli.altitude > 300, 'not airborne: ' + JSON.stringify(heli));
    await t.call('retryMission');
    await t.wait(8);
    const after = await t.call('vehicleAt', heli.x, heli.y);
    t.assert(after.id === heli.id && after.altitude < heli.altitude - 200, 'the helicopter hangs in the air: ' + JSON.stringify(after));
  } finally {
    await t.call('holdSimulation', false);
  }
}
