// Blood in the air (blood.js bleed, BLOOD BLAST SPRAY): a round throws a visible spray of drops into the air,
// all flying on along the shot (none back at the shooter), and a blast beside someone drives the blood out of
// the far side of the body, away from the blast (a cone, not a burst round the body), landing beyond them.
export const fresh = true;
const SPOTS = [
  [420, 4600],
  [720, 4600],
  [420, 4900],
  [720, 4900],
]; // the airport's open ground, nobody about
export default async function (t) {
  await t.call('god', true);
  await t.call('goreSeed', 7);
  await t.call('holdSimulation', true);
  try {
    // A pistol round and a rifle round: drops in the air at once, along the shot, and still airborne a moment later.
    for (const [spot, weapon, name, least] of [[SPOTS[0], 0, '9mm', 10], [SPOTS[1], 4, 'rifle', 14]]) {
      await t.call('teleport', ...spot);
      const v = await t.call('goreShot', 'civilian', weapon, 6, 'torso');
      const f = await t.call('bloodFlight', v.x, v.y, v.a, 60);
      t.note(`${name}: ${JSON.stringify(f)}`);
      t.assert(f.flying >= least, `${name}: only ${f.flying} drops in the air`);
      t.assert(f.against === 0 && f.align > 0.8, `${name}: the spray does not fly on along the shot: ${JSON.stringify(f)}`);
      await t.wait(0.2);
      const later = await t.call('bloodFlight', v.x, v.y, v.a, 60);
      t.assert(later.flying >= Math.round(least / 3) && later.highest > 3, `${name}: the spray did not hang in the air: ${JSON.stringify(later)}`);
      await t.wait(1.5);
      const sides = await t.call('bloodSides', v.x, v.y, v.a, 60);
      t.assert(sides.uprange === 0 && sides.downrange >= 5, `${name}: landed blood ${JSON.stringify(sides)}`);
    }

    // A blast 2 m and 5 m beyond a bystander (on the far side from the player): the blood flies toward the player,
    // away from the blast, and the closer blast throws it harder and further.
    const results = [];
    for (const [spot, metres] of [[SPOTS[2], 2], [SPOTS[3], 5]]) {
      await t.call('teleport', ...spot);
      const v = await t.call('goreBlast', metres, 1),
        away = v.a + Math.PI;
      const f = await t.call('bloodFlight', v.x, v.y, away, 60);
      t.note(`blast ${metres} m: ${JSON.stringify(f)} lost ${v.lost.join(',') || 'nothing'}`);
      t.assert(v.dead, `the blast at ${metres} m did not kill: ${JSON.stringify(v)}`);
      t.assert(f.flying >= 12, `blast ${metres} m: only ${f.flying} drops in the air`);
      // Mean drop velocity points away from the blast; no drop flies back toward it.
      const off = Math.abs(Math.atan2(Math.sin(f.meanHeading - away), Math.cos(f.meanHeading - away)));
      t.assert(off < 0.3 && f.align > 0.75 && f.against === 0, `blast ${metres} m: blood not driven away from the blast: ${JSON.stringify(f)} (off ${off.toFixed(2)})`);
      await t.wait(1.6);
      const sides = await t.call('bloodSides', v.x, v.y, away, 80);
      t.note(`blast ${metres} m landed: ${JSON.stringify(sides)}`);
      t.assert(sides.downrange >= 6 && sides.uprange <= 1, `blast ${metres} m: landed blood not beyond the victim: ${JSON.stringify(sides)}`);
      results.push(sides);
    }
    t.assert(results[0].farthest > results[1].farthest, `the closer blast threw the blood no further: ${results[0].farthest} vs ${results[1].farthest}`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
