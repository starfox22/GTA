// A second pass over someone already on the ground (runover.js): the first pass at low speed leaves them down and alive
// with no blood; a second pass at 30+ km/h kills them within a second or two through the normal death path (one kill,
// one reward, a pool, a stain on the car); a slow second pass hurts and maims but need not kill; a heavy vehicle
// kills even slowly; the pass cannot repeat while the car is still over them.
export const fresh = true;
const SPOT = { x: 420, y: 4600 }; // the airport's open ground, nobody about
async function arrange(t, type = 'sedan') {
  await t.call('teleport', SPOT.x, SPOT.y);
  await t.call('drive', type, 0, 0);
  await t.call('repair');
  await t.call('wanted', 0);
}
const blood = (t, v) => t.call('bloodReport', v.x, v.y, 140);
export default async function (t) {
  await t.call('god', true);
  await t.call('sky', 'clear');
  await t.call('bloodEnabled', true);
  await t.call('holdSimulation', true);
  try {
    // The rule's table: weight and speed decide, and a crawl never kills a healthy person.
    const crawl = await t.call('runOverReport', 'sedan', 6, 30);
    t.assert(Object.values(crawl.zones).every((z) => !z.mortal), `a crawl killed: ${JSON.stringify(crawl.zones)}`);
    t.assert(crawl.zones.torso.maiming && crawl.zones.head.maiming, `a crawl over the torso did not maim: ${JSON.stringify(crawl.zones)}`);
    const fast = await t.call('runOverReport', 'sedan', 30, 29);
    t.assert(Object.values(fast.zones).every((z) => z.mortal), `30 km/h was survivable: ${JSON.stringify(fast.zones)}`);
    const lorry = await t.call('runOverReport', 'truck', 8, 30);
    t.assert(Object.values(lorry.zones).every((z) => z.mortal), `a lorry at 8 km/h was survivable: ${JSON.stringify(lorry.zones)}`);
    const cycle = await t.call('runOverReport', 'bicycle', 20, 30);
    t.assert(!cycle.zones.legs.mortal && !cycle.zones.torso.mortal, `a bicycle killed outright: ${JSON.stringify(cycle.zones)}`);
    t.note(`harm: sedan 6 km/h ${crawl.zones.legs.harm}/${crawl.zones.torso.harm}/${crawl.zones.head.harm}, 30 km/h ${fast.zones.legs.harm}/${fast.zones.torso.harm}/${fast.zones.head.harm}; truck 8 km/h ${lorry.zones.torso.harm}; bicycle 20 km/h ${cycle.zones.torso.harm}`);

    // 1. Two real passes. First: 25 km/h, a bystander 50 units ahead.
    await arrange(t);
    const v = await t.call('runOverVictim', 50, 0, 30, 0);
    const base = await t.call('runOverState');
    await t.call('launch', 7);
    await t.wait(1);
    let s = await t.call('runOverState');
    t.assert(s.hp > 0 && !s.dead && s.hp < 30, `the first pass: ${JSON.stringify(s)}`);
    t.assert(s.down > 0, `the first pass did not leave them down: ${JSON.stringify(s)}`);
    t.assert(s.hit && !s.hit.second && s.overruns === 0, `the first pass counted as a second: ${JSON.stringify(s)}`);
    let b = await blood(t, v);
    t.assert(b.near.pool === 0 && b.near.spatter === 0 && b.near.drop === 0, `blood from a non-fatal first pass: ${JSON.stringify(b.near)}`);
    // The car goes on over them in the same pass: that is not a second one.
    await t.wait(0.7);
    s = await t.call('runOverState');
    t.assert(s.overruns === 0 && s.hp > 0, `the same pass hit twice: ${JSON.stringify(s)}`);

    // Second: reverse back over them at 29 km/h, 2+ seconds after the first.
    await t.wait(0.2);
    await t.call('launch', -8);
    let second = null;
    for (let i = 0; i < 14 && !second; i++) {
      await t.wait(0.1);
      s = await t.call('runOverState');
      if (s.overruns > 0) second = s;
    }
    t.assert(second, `the reversing car never ran them over: ${JSON.stringify(s)}`);
    t.assert(second.hit.second, `the pass was not recorded as a second: ${JSON.stringify(second)}`);
    t.assert(second.dying !== null || second.dead, `a 29 km/h second pass left them well: ${JSON.stringify(second)}`);
    b = await blood(t, v);
    t.assert(b.near.spatter + b.near.drop >= 2, `no splash from the second pass: ${JSON.stringify(b.near)}`);
    // They die within a second or two, through the normal death path.
    await t.wait(2.6);
    s = await t.call('runOverState');
    t.assert(s.dead, `still alive 2.6 s after a fatal second pass: ${JSON.stringify(s)}`);
    t.assert(s.kills === base.kills + 1, `kills counted ${s.kills - base.kills} times`);
    t.assert(s.cash === base.cash + 25, `the kill paid ${s.cash - base.cash}`);
    t.assert(s.pool, `no pool formed under the body: ${JSON.stringify(s)}`);
    await t.wait(2);
    b = await blood(t, v);
    t.assert(b.near.pool >= 1, `no pool in the street: ${JSON.stringify(b.near)}`);
    t.assert(b.near.track >= 1, `the tyres laid no tracks: ${JSON.stringify(b.near)}`);
    const stains = (await t.call('carBloodReport')).stains;
    t.assert(stains.some((x) => x.sev >= 0.55), `no fatal stain on the car: ${JSON.stringify(stains)}`);
    // Drive over the body again and again: nothing more happens.
    await t.call('launch', 8);
    await t.wait(1.5);
    await t.call('launch', -8);
    await t.wait(1.5);
    const after = await t.call('runOverState');
    t.assert(after.kills === s.kills && after.cash === s.cash && after.overruns === second.overruns, `a body was run over again and counted: ${JSON.stringify(after)}`);
    t.note(`two passes: dying ${second.dying} s after the second at 29 km/h, ${stains.length} stains on the car`);

    // 2. A slow second pass (6 km/h) over someone already down hurts, maims, but does not kill.
    await arrange(t);
    await t.call('runOverVictim', 27, 0, 30, 9);
    const before = await t.call('runOverState');
    await t.call('launch', 1.5);
    await t.wait(2.2);
    s = await t.call('runOverState');
    t.assert(s.overruns === 1, `the slow pass was not a second pass: ${JSON.stringify(s)}`);
    t.assert(!s.dead && s.dying === null && s.hp > 0, `a crawl killed them: ${JSON.stringify(s)}`);
    t.assert(s.hp <= before.hp - 6, `a car rolled over them and they lost only ${before.hp - s.hp}: ${JSON.stringify(s)}`);
    t.assert(!s.pool, `a pool under someone alive: ${JSON.stringify(s)}`);
    await t.wait(4);
    s = await t.call('runOverState');
    t.assert(!s.dead && s.hp > 0, `they died of a slow pass: ${JSON.stringify(s)}`);
    t.note(`6 km/h over someone down: hp ${before.hp} -> ${s.hp}, still down ${s.down}`);

    // 3. A heavy vehicle kills at a crawl.
    await arrange(t, 'truck');
    await t.call('runOverVictim', 46, 0, 30, 9);
    await t.call('launch', 2.2);
    await t.wait(2.2);
    s = await t.call('runOverState');
    t.assert(s.overruns === 1 && (s.dead || s.dying !== null), `a truck at 8 km/h left them well: ${JSON.stringify(s)}`);
    await t.wait(3);
    s = await t.call('runOverState');
    t.assert(s.dead, `a truck over them and they lived: ${JSON.stringify(s)}`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
