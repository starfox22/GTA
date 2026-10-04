// Bullet hits on people (combat-rules.js NPC BODY ARMOUR, wounds.js, blood.js): a round
// never moves the person it hits (no knock-back, alive or killed); the exit spray lands
// beyond the victim, away from the shooter; and torso shots to put someone down follow
// their armour and the weapon's calibre (soft vest vs plate, handgun vs rifle).
export const fresh = true;
const SPOTS = [
  [420, 4600],
  [720, 4600],
  [420, 4900],
  [720, 4900],
]; // the airport's open ground, nobody about
export default async function (t) {
  await t.call('god', true);
  await t.call('holdSimulation', true);
  try {
    // Shots to kill, torso hits (arithmetic through the same ballisticDamage).
    const k = await t.call('shotsToKill');
    const pistol = k['9MM PISTOL'],
      rifle = k['ASSAULT RIFLE'],
      smg = k['MACHINE PISTOL'];
    t.note(`9mm: ${JSON.stringify(pistol)}`);
    t.note(`rifle: ${JSON.stringify(rifle)}`);
    t.assert(pistol.civilian === 1 && pistol.gang >= 1 && pistol.gang <= 3, `unarmoured, 9mm: ${JSON.stringify(pistol)}`);
    t.assert(rifle.civilian === 1 && rifle.gang <= pistol.gang, `unarmoured, rifle: ${JSON.stringify(rifle)}`);
    t.assert(pistol.patrol > pistol.gang && pistol.patrol >= 3, `a patrol vest does not stop the 9mm: ${JSON.stringify(pistol)}`);
    for (const role of ['swat', 'fed', 'soldier'])
      t.near(pistol[role], 4, 7, `${role}: 9mm torso hits`);
    for (const role of ['swat', 'fed', 'soldier'])
      t.near(rifle[role], 2, 4, `${role}: rifle torso hits`);
    // A soft vest barely slows a rifle round; a plate does.
    t.assert(rifle.patrol <= 2 && rifle.patrol < pistol.patrol, `a soft vest stops rifle rounds: ${rifle.patrol} vs ${pistol.patrol}`);
    t.assert(rifle.swat > rifle.patrol, `plates no better than soft vests against rifles: ${JSON.stringify(rifle)}`);
    t.assert(smg.swat > pistol.swat, `a machine pistol beats plates: ${JSON.stringify(smg)}`);
    // The demo's mission targets stay where they were: Vescari (mission 2) three 9mm rounds.
    t.assert(pistol.vescari === 3, `Vescari takes ${pistol.vescari} 9mm rounds`);

    // Real hits through strikePerson: counts match, nobody is moved.
    await t.call('teleport', ...SPOTS[0]);
    const swat = await t.call('strikeTest', 'swat', 0, 50, 'torso');
    t.assert(swat.down && swat.hits === pistol.swat, `SWAT live hits ${JSON.stringify(swat)} vs table ${pistol.swat}`);
    t.assert(swat.moved < 0.01, `a round moved the SWAT officer ${swat.moved} units`);
    await t.call('teleport', ...SPOTS[2]);
    const gang = await t.call('strikeTest', 'gang', 0, 50, 'torso');
    t.assert(gang.down && gang.hits === pistol.gang && gang.moved < 0.01, `gang member: ${JSON.stringify(gang)}`);
    // Legs are outside the vest: fewer hits on a plate carrier.
    await t.call('teleport', ...SPOTS[3]);
    const legs = await t.call('strikeTest', 'swat', 0, 50, 'leg');
    t.assert(legs.hits < swat.hits && legs.moved < 0.01, `leg hits on SWAT: ${JSON.stringify(legs)}`);
    t.note(`live: swat ${swat.hits} torso / ${legs.hits} leg, gang ${gang.hits}`);

    // The exit spray: drops and spatter land beyond the victim, none toward the shooter.
    await t.call('teleport', ...SPOTS[1]);
    const v = await t.call('strikeTest', 'gang', 4, 50, 'torso');
    t.assert(v.down && v.moved < 0.01, `gang member, rifle: ${JSON.stringify(v)}`);
    await t.wait(1.5); // the drops land
    const sides = await t.call('bloodSides', v.x, v.y, v.a, 60);
    t.note(`exit spray: ${JSON.stringify(sides)}`);
    t.assert(sides.downrange >= 8, `too little exit spray: ${JSON.stringify(sides)}`);
    t.assert(sides.uprange === 0, `blood toward the shooter: ${JSON.stringify(sides)}`);
    t.assert(sides.farthest >= 10 && sides.farthest <= 45, `the spray's reach: ${JSON.stringify(sides)}`);
    const r = await t.call('bloodReport', v.x, v.y, 60);
    t.assert(r.pools.length === 1, `one pool under the body: ${JSON.stringify(r.pools)}`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
