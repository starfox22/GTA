// Mission 4 (Borrowed Stripes) both ways to the uniform and on to the end. Messy: Kessler shot crossing the road,
// his keys taken off him and his trunk opened with them, even with the lockpick in hand (the real interact key).
// Quiet: the trunk picked once he is inside, the bag taken, the change made by sitting in a parked car, the papers
// shown at the gate, the records office, the walk out, then the consul at EVOLUTION and the handover at CIRRUS: won,
// and the player keeps the uniform on.
export const fresh = true;
const E = (t) => t.keys('KeyE', 0.2, { real: true });
export default async function (t) {
  const tc = t.call;
  t.call = async (name, ...args) => {
    try {
      return await tc(name, ...args);
    } catch (e) {
      throw new Error(name + '(' + args.join(',') + '): ' + e.message);
    }
  };
  // Messy: shoot him on his way to the door.
  let r = await t.call('fortSkip', 'parked');
  await t.wait(0.5);
  await t.call('arm', 0);
  for (let i = 0; i < 6; i++) {
    r = await t.call('fortJob');
    if (!r.kessler || r.kessler.hp <= 0) break;
    await t.call('teleport', r.kessler.x - 60, r.kessler.y);
    await t.call('fireShot', r.kessler.x, r.kessler.y);
    await t.wait(0.6);
  }
  r = await t.call('fortJob');
  t.assert(r.killed && /TAKE KESSLER’S KEYS/.test(r.instruction), 'his keys are the next thing: ' + JSON.stringify(r));
  await t.call('teleport', r.kessler.x + 12, r.kessler.y);
  await t.call('lockpick', true, true);
  await t.wait(0.3);
  await E(t);
  await t.wait(0.5);
  r = await t.call('fortJob');
  t.assert(r.keys && /OPEN KESSLER’S TRUNK/.test(r.instruction), 'keys taken: ' + JSON.stringify(r));
  await t.call('teleport', r.target.x, r.target.y);
  await t.wait(0.3);
  await E(t);
  await t.wait(0.5);
  r = await t.call('fortJob');
  t.assert(r.stage === 4 && r.car.trunkOpen && r.car.trunkPick === 0, 'opened with the keys, not the pick: ' + JSON.stringify(r));

  // Quiet: the trunk picked with nobody about.
  r = await t.call('fortSkip', 'inside');
  t.assert(r.stage === 3 && r.inside, 'inside: ' + JSON.stringify(r));
  await t.call('lockpick', true, true);
  await t.wait(0.3);
  // A passer-by looking pauses the pick (lockpickWatcher): keep at it until it gives.
  for (let i = 0; i < 4; i++) {
    await t.keys('KeyE', 5.8, { real: true });
    await t.wait(0.5);
    r = await t.call('fortJob');
    if (r.car.trunkOpen) break;
  }
  t.assert(r.stage === 4 && r.car.trunkOpen, 'trunk picked open: ' + JSON.stringify(r));
  await E(t);
  await t.wait(0.5);
  r = await t.call('fortJob');
  t.assert(r.stage === 5 && /CHANGE INTO THE UNIFORM/.test(r.instruction), 'bag taken: ' + JSON.stringify(r));
  // In a parked car the change happens by itself.
  await t.call('drive', 'sedan');
  await t.wait(4);
  r = await t.call('fortJob');
  t.assert(r.stage === 6 && r.uniform, 'changed in the car: ' + JSON.stringify(r));
  let cover = await t.call('fortCover');
  t.assert(cover.active && cover.uniform === 'army', 'cover on: ' + JSON.stringify(cover));

  // The base (any stars from the street first cleared: the gate turns a wanted man away).
  await t.call('wanted', 0);
  await t.call('fortSkip', 'changed');
  await t.call('teleport', 9236, 8182);
  await t.wait(1);
  await E(t);
  // The sergeant reads the ID, the roster, the cover story, the photo: about sixteen seconds.
  await t.wait(8);
  cover = await t.call('fortCover');
  t.assert(cover.inspecting > 5 && !cover.cleared, 'the papers are being read: ' + JSON.stringify(cover));
  await t.wait(10);
  r = await t.call('fortJob');
  t.assert(r.stage === 7 && /RECORDS/.test(r.instruction), 'cleared at the gate: ' + JSON.stringify(r));
  await t.call('teleport', 9624, 8052);
  await t.wait(1);
  await E(t);
  await t.wait(10);
  r = await t.call('fortJob');
  t.assert(r.stage === 8 && /MAIN GATE/.test(r.instruction), 'papers in hand: ' + JSON.stringify(r));
  cover = await t.call('fortCover');
  t.assert(cover.papers && !cover.alarmed && cover.suspicion < 30, 'quietly: ' + JSON.stringify(cover));
  await t.call('teleport', 9240, 8182);
  await t.wait(0.5);
  await t.call('teleport', 9150, 8180);
  await t.wait(1.5);
  r = await t.call('fortJob');
  t.assert(r.stage === 9 && /VARGA/.test(r.instruction), 'the consul next: ' + JSON.stringify(r));

  // The consul.
  await t.call('skyMeetingSkip', 'waiting');
  await t.wait(0.5);
  await E(t);
  await t.wait(1);
  r = await t.call('fortJob');
  t.assert(/ELEVATOR/.test(r.instruction), 'greeted, up to CIRRUS: ' + JSON.stringify(r));
  await t.call('skyMeetingSkip', 'handover');
  await t.wait(1);
  r = await t.call('fortJob');
  t.assert(/HAND OVER THE PAPERS/.test(r.instruction), 'handover stage: ' + JSON.stringify(r));
  await E(t);
  let m;
  for (let i = 0; i < 30; i++) {
    await t.wait(1);
    m = await t.call('missionState');
    if (m.mission === null) break;
  }
  t.assert(m.last?.result === 'won' && m.last.index === 3, 'mission 4 not won: ' + JSON.stringify(m));
  cover = await t.call('fortCover');
  t.assert(cover.uniform === 'army' && !cover.active, 'the uniform stays on after the win, the cover off: ' + JSON.stringify(cover));
}
