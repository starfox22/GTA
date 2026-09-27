// Mission 2 (A Seat at the Table), the poisoned glass end to end: Vescari toasts, sips,
// coughs and faints with no blood for him, a guest phones an ambulance that pulls up below
// the hotel, and the lift then a walk away from the hotel wins the job.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('roofPlace', 292, 152); // beside the VIP table
    // Every bodyguard facing the balustrade: nobody sees the glass being spiked.
    for (const [i, x, y, a] of [
      [0, 60, 130, Math.PI],
      [1, 330, 60, -Math.PI / 2],
      [2, 330, 300, 0],
      [3, 160, 60, -Math.PI / 2],
    ])
      await t.call('roofGuard', i, x, y, a);
    await t.call('roofSuspicion', 0);
    let p = await t.call('spikeGlass');
    t.assert(p.phase === 'approach', 'glass not spiked: ' + JSON.stringify(p));
    await t.call('roofPlace', 100, 260); // well away from the table, out of every cone

    const beats = new Set();
    for (let i = 0; i < 60 && p.phase !== 'dead'; i++) {
      await t.wait(0.4);
      p = await t.call('roofPoison');
      beats.add(p.phase);
      if (p.inHand) beats.add('glass in hand');
    }
    t.assert(p.phase === 'dead' && p.bossHp === 0 && p.poisoned, 'Vescari did not go down: ' + JSON.stringify(p));
    for (const beat of ['glass in hand', 'sip', 'cough', 'clutch', 'stagger', 'buckle', 'faint'])
      t.assert(beats.has(beat), `beat "${beat}" never played: ${[...beats].join(', ')}`);
    t.assert(p.glassTaken && !p.inHand, 'the glass should have left the table and his hand');
    t.assert(p.deathStyle?.poison && p.collapse === 1, 'not a poison collapse: ' + JSON.stringify(p.deathStyle));
    t.assert(p.bloodNearBoss === 0 && p.bloodDropsNearBoss === 0, `blood from a poisoning: ${p.bloodNearBoss} pools, ${p.bloodDropsNearBoss} drops`);
    let m = await t.call('missionState');
    t.assert(m.stage === 3 && /ELEVATOR/.test(m.instruction), 'no leave-calmly stage: ' + JSON.stringify(m));

    // The emergency: someone kneels, someone phones, a guard radios, the ambulance comes.
    await t.call('roofGuard', -1);
    for (let i = 0; i < 45 && !p.medical?.ambulance?.parked; i++) {
      await t.wait(1);
      p = await t.call('roofPoison');
    }
    const med = p.medical;
    t.assert(med && med.called && med.radioed, 'no ambulance call or radio: ' + JSON.stringify(med));
    t.assert(med.helper?.pose === 'help', 'nobody kneels beside him: ' + JSON.stringify(med.helper));
    t.assert(med.ambulance?.parked && med.ambulance.toDoor < 120, 'the ambulance did not pull up below: ' + JSON.stringify(med.ambulance));
    t.assert(p.bloodNearBoss === 0, 'blood near Vescari: ' + p.bloodNearBoss);
    const s = await t.call('roofStealth');
    t.assert(!s.alarm && s.suspicion < 100, 'cover blown while the guests watched: ' + JSON.stringify({ alarm: s.alarm, suspicion: s.suspicion }));

    // Walk out: the lift, then away from the hotel.
    await t.call('roofPlace', 60, 290);
    await t.call('interact');
    await t.wait(3);
    m = await t.call('missionState');
    t.assert(m.stage === 4 && /WALK AWAY/.test(m.instruction), 'no walk-away stage: ' + JSON.stringify(m));
    await t.call('teleport', -1450, 2624); // 214 units from the doors: not away yet
    await t.wait(1);
    m = await t.call('missionState');
    t.assert(m.stage === 4, 'won too close to the hotel: ' + JSON.stringify(m));
    await t.call('teleport', -1330, 2624);
    await t.wait(1);
    m = await t.call('missionState');
    t.assert(m.last?.result === 'won' && m.last.index === 1, 'mission not won: ' + JSON.stringify(m));
  } finally {
    await t.call('holdSimulation', false);
  }
}
