// Mission 2 (A Seat at the Table) has two ways to kill Vescari: the poisoned glass
// (mission2-poison.mjs) and the gunfight. There is no silent takedown: interact beside him
// does nothing to him and no prompt or hint offers one. The gunfight path: draw, shoot him
// on the terrace, ride the lift down and reach Coral Palms once the police are shaken off.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true); // the whole detail opens fire
  try {
    // Beside Vescari, every bodyguard facing the balustrade.
    let s = await t.call('roofPlace', 300, 104);
    for (const [i, x, y, a] of [
      [0, 60, 130, Math.PI],
      [1, 330, 300, 0],
      [2, 160, 300, Math.PI / 2],
      [3, 160, 60, -Math.PI / 2],
    ])
      await t.call('roofGuard', i, x, y, a);
    await t.call('roofSuspicion', 0);
    await t.wait(0.5);
    s = await t.call('roofStealth');
    t.assert(s.boss && Math.hypot(s.boss.x - s.player.x, s.boss.y - s.player.y) < 36, 'not beside Vescari: ' + JSON.stringify({ boss: s.boss, player: s.player }));
    const prompt = await t.call('promptState');
    t.assert(prompt.id !== 'takedown' && !/TAKEDOWN/i.test(prompt.text + ' ' + prompt.offered), 'a takedown is still offered: ' + JSON.stringify(prompt));
    await t.call('interact');
    await t.wait(1);
    let p = await t.call('roofPoison');
    s = await t.call('roofStealth');
    t.assert(p.bossHp > 0 && !s.alarm, 'interact beside Vescari hurt him or raised the alarm: ' + JSON.stringify({ hp: p.bossHp, alarm: s.alarm }));
    const notes = JSON.stringify(await t.call('notices'));
    t.assert(!/takedown/i.test(notes), 'a hint still mentions a takedown: ' + notes);

    // The gunfight: step back, draw on him and keep firing until he is down.
    await t.call('roofPlace', 304, 150);
    for (let i = 0; i < 20 && p.bossHp > 0; i++) {
      s = await t.call('roofStealth');
      const aim = (Math.atan2(s.boss.y - s.player.y, s.boss.x - s.player.x) * 180) / Math.PI;
      await t.call('footwork', aim);
      await t.keys('KeyF', 0.6);
      p = await t.call('roofPoison');
    }
    await t.call('footwork', null);
    t.assert(p.bossHp <= 0 && !p.poisoned, 'Vescari not shot dead: ' + JSON.stringify(p));
    s = await t.call('roofStealth');
    t.assert(s.alarm, 'shooting him did not blow the cover');
    let m = await t.call('missionState');
    t.assert(m.stage === 3 && /ESCAPE VIA THE ELEVATOR/.test(m.instruction), 'no escape stage: ' + JSON.stringify(m));

    // Down the lift once security sends the car back up (9 s), then the run to Coral Palms.
    await t.wait(10);
    await t.call('roofPlace', 60, 290);
    await t.call('interact');
    await t.wait(3);
    m = await t.call('missionState');
    t.assert(m.stage === 4 && /CORAL PALMS/.test(m.instruction), 'no motel stage: ' + JSON.stringify(m));
    await t.call('wanted', 0);
    await t.call('teleport', -2183, 2000);
    await t.wait(1);
    m = await t.call('missionState');
    t.assert(m.last?.result === 'won' && m.last.index === 1, 'the gunfight did not win the job: ' + JSON.stringify(m));
  } finally {
    await t.call('footwork', null);
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
