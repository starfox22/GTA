// Gunfire on vehicles (vehicle-gunfire.js VEHICLE GUNFIRE): real rounds into a parked sedan. A pistol needs a
// couple of magazines in the engine bay to set it on fire and never blows it up by itself: it smokes, smokes
// harder, burns, and the fire sets off the tank after a countdown. A rifle needs fewer; doors and boot mostly
// dent and break; a rocket destroys it.
export default async function (t) {
  await t.call('god', true);
  try {
    const table = await t.call('vehicleDurability', 'sedan');
    t.near(table.handgun.engine.toFire, 20, 32, 'table: pistol engine-bay hits to fire');
    t.assert(table.handgun.engine.toExplode === 'fire only', 'table: a pistol explodes the car: ' + JSON.stringify(table.handgun));
    t.assert(table.rifle.engine.toFire < table.handgun.engine.toFire, 'table: a rifle is no stronger than a pistol');

    const pistol = await t.call('gunfireTest', 'sedan', 0, 'engine');
    t.note('pistol, engine bay: ' + JSON.stringify(pistol));
    t.assert(!pistol.instant, 'pistol rounds blew the car up without a fire: ' + JSON.stringify(pistol));
    t.near(pistol.fire, 20, 32, 'pistol rounds into the engine bay to set it on fire');
    t.assert(pistol.smoke > 0 && pistol.smoke < pistol.heavySmoke && pistol.heavySmoke < pistol.fire, 'stages out of order: ' + JSON.stringify(pistol));
    t.assert(pistol.exploded, 'the engine fire never set off the tank: ' + JSON.stringify(pistol));
    t.near(pistol.fireToExplosion, 5, 12, 'seconds from the engine fire to the explosion');

    const rifle = await t.call('gunfireTest', 'sedan', 4, 'engine');
    t.note('rifle, engine bay: ' + JSON.stringify(rifle));
    t.assert(!rifle.instant && rifle.fire > 0 && rifle.fire < pistol.fire, 'a rifle needs fewer rounds than a pistol: ' + JSON.stringify(rifle));

    // Two magazines into the doors and glass: holes and broken windows, the engine barely hurt.
    const doors = await t.call('gunfireTest', 'sedan', 0, 'body', { maxShots: 34 });
    t.note('pistol, doors: ' + JSON.stringify(doors));
    t.assert(doors.fire === null && !doors.exploded && doors.hpLeft >= 0.8 * doors.hp, 'door hits wrecked the engine: ' + JSON.stringify(doors));

    // A gang's pistol rounds follow the same rules.
    const gang = await t.call('gunfireTest', 'sedan', 0, 'engine', { enemy: true, maxShots: 15 });
    t.assert(gang.fire === null && !gang.exploded, 'fifteen gang pistol rounds set the car on fire: ' + JSON.stringify(gang));

    const rocket = await t.call('gunfireTest', 'sedan', 3, 'body', { maxShots: 1, gap: 1.5 });
    t.assert(rocket.exploded, 'a rocket did not destroy the car: ' + JSON.stringify(rocket));
  } finally {
    await t.call('god', false);
  }
}
