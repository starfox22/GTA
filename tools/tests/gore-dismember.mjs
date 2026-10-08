// Gore (gore.js, gore-props.js): a point-blank shotgun load takes the limb or the head it lands on, and the state
// says so (goreLost, severed pieces that come to rest); the same load from 12-20 m takes nothing, nor does a pistol;
// a .50 round takes the head; a survivor who loses a leg goes down and bleeds out; the reduced setting severs
// nothing; the lists stay within their caps.
export const fresh = true;
const SPOTS = [
  [420, 4600],
  [720, 4600],
  [420, 4900],
  [720, 4900],
  [560, 4750],
]; // the airport's open ground, nobody about
const legGone = (o) => o.lost.some((n) => n.startsWith('leg') || n.startsWith('shin'));
export default async function (t) {
  await t.call('god', true);
  await t.call('holdSimulation', true);
  try {
    await t.call('goreSeed', 7);
    // Point blank (1.5 m), shotgun, a leg: it comes off and is thrown.
    await t.call('teleport', ...SPOTS[0]);
    const leg = await t.call('goreShot', 'gang', 2, 1.5, 'leg');
    t.note(`shotgun 1.5 m leg: ${JSON.stringify(leg)}`);
    t.assert(legGone(leg) && leg.pieces === 1, `a point-blank load left the leg on: ${JSON.stringify(leg)}`);
    t.assert(leg.hit.cls === 'buck' && leg.hit.close === 1, `the load was not counted point blank: ${JSON.stringify(leg.hit)}`);

    // The head: destroyed, dead, nothing thrown whole.
    const head = await t.call('goreShot', 'civilian', 2, 1.5, 'head');
    t.assert(head.dead && head.lost.includes('head') && head.pieces === 0, `point-blank head: ${JSON.stringify(head)}`);

    // The chest: a destroyed chest kills, nobody left crawling.
    await t.call('teleport', ...SPOTS[1]);
    const chest = await t.call('goreShot', 'gang', 2, 1.5, 'torso');
    // (A torso load may catch the arm held in front instead: GORE_ARM_SHARE.)
    t.assert(chest.dead && (chest.lost.length > 0 || !chest.down), `a point-blank chest load: ${JSON.stringify(chest)}`);

    // Range: the same load from 12 and 20 m takes nothing; nor does a pistol at 1.5 m.
    for (const metres of [12, 20])
      for (const zone of ['leg', 'head']) {
        const far = await t.call('goreShot', 'gang', 2, metres, zone);
        t.assert(far.lost.length === 0 && far.thrown === 0, `shotgun at ${metres} m took the ${zone}: ${JSON.stringify(far)}`);
      }
    for (const zone of ['leg', 'head']) {
      const pistol = await t.call('goreShot', 'gang', 0, 1.5, zone);
      t.assert(pistol.lost.length === 0, `a 9mm took the ${zone}: ${JSON.stringify(pistol)}`);
    }

    // A .50 round takes the head at 30 m.
    await t.call('teleport', ...SPOTS[2]);
    const heavy = await t.call('goreShot', 'gang', 4, 30, 'head', true);
    t.assert(heavy.lost.includes('head') && heavy.hit.cls === 'heavy', `a .50 to the head: ${JSON.stringify(heavy)}`);

    // The pieces fall, tumble and come to rest on the ground.
    await t.wait(3);
    let r = await t.call('goreReport');
    t.note(`severed: ${JSON.stringify(r.severed.map((s) => [s.kind, s.rest, s.z]))}`);
    t.assert(r.severed.length >= 1 && r.severed.every((s) => s.rest && s.z < 1.5), `pieces not at rest on the ground: ${JSON.stringify(r.severed)}`);

    // A survivor: a .50 into a gang member's leg (70 of 80 hp) takes it often; down, then bled out.
    await t.call('teleport', ...SPOTS[3]);
    let survivor = null;
    for (let i = 0; i < 10 && !survivor; i++) {
      const o = await t.call('goreShot', 'gang', 4, 30, 'leg', true);
      if (legGone(o) && !o.dead) survivor = o;
    }
    t.assert(survivor, 'ten .50 rounds into a leg never took it off a survivor');
    t.assert(survivor.down && survivor.bleedOut >= 6 && survivor.bleedOut <= 14, `the maimed survivor: ${JSON.stringify(survivor)}`);
    await t.wait(15);
    r = await t.call('goreReport');
    const after = r.people.find((p) => Math.abs(p.x - survivor.x) < 16 && Math.abs(p.y - survivor.y) < 16 && p.lost.length);
    t.assert(after && after.dead, `the maimed survivor did not bleed out: ${JSON.stringify(after)}`);
    const bled = await t.call('bloodReport', survivor.x, survivor.y, 30);
    t.assert(bled.pools.length >= 1, `no pool where the maimed survivor bled out: ${JSON.stringify(bled)}`);

    // Reduced gore: nothing comes off, and a point-blank load lets out far less blood.
    await t.call('settings', { gore: 'reduced' });
    await t.call('teleport', ...SPOTS[4]);
    const reduced = await t.call('goreShot', 'gang', 2, 1.5, 'leg');
    t.assert(reduced.lost.length === 0 && reduced.thrown === 0, `reduced gore severed: ${JSON.stringify(reduced)}`);
    const plan = await t.call('bloodPlanTable');
    t.assert(plan['shotgun 1.5 m head'].scale <= 1.2, `reduced blood scale ${plan['shotgun 1.5 m head'].scale}`);
    await t.call('settings', { gore: 'full' });

    // Caps: thirty point-blank leg loads.
    for (let i = 0; i < 30; i++) {
      await t.call('teleport', SPOTS[i % 4][0] + (i % 5) * 40, SPOTS[i % 4][1] + 60);
      await t.call('goreShot', 'gang', 2, 1.5, 'leg');
    }
    await t.wait(1);
    r = await t.call('goreReport');
    const soak = await t.call('soakReport');
    t.note(`after 30 loads: ${r.severed.length} pieces, ${r.stumps} stumps, ${r.tracked} tracked; decals ${soak.lists?.bloodPools}`);
    t.assert(r.severed.length <= r.caps.severed && r.stumps <= r.caps.stumps && r.tracked <= r.caps.tracked, `gore over its caps: ${JSON.stringify(r.caps)} ${r.severed.length}/${r.stumps}/${r.tracked}`);
    t.assert((soak.lists?.bloodPools ?? 0) <= r.caps.decals, `blood decals over the cap: ${soak.lists?.bloodPools}`);
  } finally {
    await t.call('settings', { gore: 'full' });
    await t.call('holdSimulation', false);
  }
}
