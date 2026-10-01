// Car blood (car-stains.js; carblood3d.js draws it): a fatal run-over stains the nose and the airflow
// drags it the whole length of the bonnet while the car runs (a car that stops at once stops the
// streaks short, and its gravity runs creep once it is still), a slow bump and a bump that lets the
// person live at walking pace leave nothing, a survivor's is small and short, a flank hit stains the
// flank, the stain dries over ~2 min, repeated hits stop at three, rain washes it, a repair or a
// garage respray clears it, and with the blood setting off nothing stains.
export const fresh = true;
const SPOT = { x: 420, y: 4600 }; // the airport's open ground, nobody about
async function arrange(t, type = 'sedan') {
  await t.call('teleport', SPOT.x, SPOT.y);
  await t.call('drive', type, 0, 0);
  await t.call('repair');
  await t.call('wanted', 0);
}
// A bystander on the car's nose (or flank) and the car launched into them at `ms` m/s.
async function hit(t, ms, along, lateral, expect = false) {
  // Ambient people and cars wander onto the spot: a run that met someone else is tried again.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await arrange(t);
    await t.call('carBloodVictim', along, lateral);
    await t.call('launch', ms);
    await t.wait(1.2);
    const r = await t.call('carBloodReport');
    if (!expect || r.stains.length) return r;
  }
  return t.call('carBloodReport');
}
// The same, but the car stops dead a moment after the hit.
async function hitAndStop(t) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await arrange(t);
    await t.call('carBloodVictim', 31, 0);
    await t.call('launch', 19);
    await t.wait(0.13);
    await t.call('launch', 0);
    const r = await t.call('carBloodReport');
    if (r.stains.length) return r;
  }
  return t.call('carBloodReport');
}
export default async function (t) {
  await t.call('god', true);
  await t.call('sky', 'clear');
  await t.call('holdSimulation', true);
  try {
    await arrange(t);
    const spec = await t.call('drivingState');
    t.assert(spec.type === 'sedan', 'no sedan: ' + JSON.stringify(spec));
    const half = 19; // the sedan's half length in units (19.4 on the nose)

    // A slow bump (11 km/h): no stain.
    let r = await hit(t, 3, half + 14, 0);
    t.assert(r.stains.length === 0, 'a slow bump stained the car: ' + JSON.stringify(r.stains));

    // A fatal run-over at 79 km/h on the nose: a front stain, a proper splatter.
    await arrange(t);
    r = await hit(t, 22, half + 40, 4, true);
    t.assert(r.stains.length === 1, 'a run-over left ' + r.stains.length + ' stains: ' + JSON.stringify(r.stains));
    const s = r.stains[0];
    t.assert(s.face === 'front', 'the nose was not stained: ' + s.face);
    t.assert(s.sev >= 0.55, 'a fatal hit left a small stain: ' + s.sev);
    t.assert(s.x > half * 0.8 && Math.abs(s.z) < 9, 'stain off the nose: ' + JSON.stringify(s));
    t.assert(s.dry < 0.2, 'a fresh stain is dry already: ' + s.dry);
    // Bloody: the airflow can drag it from the bumper to the windscreen's base and over (2.5 m and more), and the
    // car that ran on for a second has dragged all of it; its runs have not crept (the car never stopped).
    t.assert(s.sev >= 0.9, 'a fatal hit at speed is not heavy: ' + s.sev);
    t.assert(s.reach >= 2.5, 'the streaks cannot run the length of the bonnet: ' + s.reach + ' m');
    t.assert(s.flow >= 0.95, 'the airflow has not dragged it back: flow ' + s.flow);
    t.assert(s.creep < 0.2, 'gravity runs crept on a moving car: ' + s.creep);
    if (r.skin && r.skin.skins > 0) t.assert(r.skin.triangles > 0, 'the renderer fitted nothing: ' + JSON.stringify(r.skin));
    t.note(`fatal run-over: sev ${s.sev} at (${s.x}, ${s.z}) ${s.kph} km/h`);

    // It dries: wet at first, dry after about two minutes (and is still there).
    await t.wait(40);
    const mid = (await t.call('carBloodReport')).stains[0];
    await t.wait(80);
    const late = (await t.call('carBloodReport')).stains[0];
    t.assert(mid.dry > s.dry && mid.dry < 1, `not drying: ${s.dry} -> ${mid.dry}`);
    t.assert(late.dry >= 0.99 && late.sev === s.sev, 'dried stain changed or went: ' + JSON.stringify(late));

    // A second car's hit on the flank stains the flank (the right side, z > 0).
    await arrange(t);
    r = await hit(t, 20, 0, 6, true);
    t.assert(r.stains.length === 1 && r.stains[0].face === 'right', 'a flank hit did not stain the flank: ' + JSON.stringify(r.stains));
    t.assert(r.stains[0].z > 6, 'flank stain not on the side: ' + JSON.stringify(r.stains[0]));

    // A survivor hit at 40 km/h: a small stain, smaller than the fatal one.
    await arrange(t);
    r = await hit(t, 11, half + 14, 0);
    if (r.stains.length) {
      t.assert(r.stains[0].sev < s.sev, 'a survivor stained as much as a death: ' + JSON.stringify(r.stains[0]));
      t.assert(r.stains[0].sev <= 0.45 && r.stains[0].reach < s.reach - 0.8, 'a survivor\'s stain is not modest: ' + JSON.stringify(r.stains[0]));
    }

    // A fatal hit and the car stopping dead: the streaks stop short, and the gravity runs creep once it is still.
    await arrange(t);
    r = await hitAndStop(t);
    t.assert(r.stains.length === 1 && r.stains[0].sev >= 0.8, 'the stop-after-hit run left no heavy stain: ' + JSON.stringify(r.stains));
    const stopped = r.stains[0];
    t.assert(stopped.flow < 0.45, 'streaks ran on although the car stopped: flow ' + stopped.flow);
    await t.wait(24);
    const rested = (await t.call('carBloodReport')).stains[0];
    t.assert(rested.creep >= 0.99, 'the runs did not creep on a stopped car: ' + rested.creep);
    t.assert(rested.flow <= stopped.flow + 0.02, 'streaks grew on a stopped car: ' + stopped.flow + ' -> ' + rested.flow);
    t.note(`stopped at once: flow ${stopped.flow}, creep ${rested.creep} after 24 s`);

    // Repeated hits accumulate up to three.
    await arrange(t);
    for (let i = 0; i < 6; i++) await t.call('carBloodMark', i % 2 ? 'front' : 'left', 70, true, 0);
    r = await t.call('carBloodReport');
    t.assert(r.stains.length === 3, 'stains not capped at three: ' + r.stains.length);
    t.assert(r.stains[2].id > r.stains[0].id, 'oldest not first');

    // Rain washes them off in a storm.
    await t.call('sky', 'storm');
    await t.wait(30);
    r = await t.call('carBloodReport');
    t.assert(r.stains.length === 0 || r.stains.every((x) => x.wash > 0.3), 'the storm washed nothing: ' + JSON.stringify(r.stains));
    await t.wait(40);
    r = await t.call('carBloodReport');
    t.assert(r.stains.length === 0, 'stains survived a minute of storm: ' + JSON.stringify(r.stains));
    await t.call('sky', 'clear');

    // A repair clears them.
    await arrange(t);
    await t.call('carBloodMark', 'front', 80, true, 0);
    t.assert((await t.call('carBloodReport')).stains.length === 1, 'no stain to repair');
    await t.call('repair');
    t.assert((await t.call('carBloodReport')).stains.length === 0, 'repair left the stain');

    // With the blood setting off nothing stains; on again, it does.
    await t.call('bloodEnabled', false);
    await arrange(t);
    r = await hit(t, 22, half + 40, 0);
    t.assert(r.stains.length === 0, 'stained with blood off: ' + JSON.stringify(r.stains));
    await t.call('bloodEnabled', true);
    await arrange(t);
    r = await hit(t, 22, half + 40, 0, true);
    t.assert(r.stains.length === 1, 'no stain with blood back on: ' + JSON.stringify(r));

    // A garage respray and repair at MONARCH COACHWORKS clears the car.
    const shop = (await t.call('garage')).garages.find((g) => g.id === 'monarch');
    await t.call('setCash', 5000);
    await t.call('teleport', shop.apron.x - 40, shop.apron.y + 30);
    await t.call('drive', 'sedan', 0, -Math.PI / 2);
    await t.call('carBloodMark', 'front', 80, true, 0);
    await t.call('placeVehicle', shop.door.x0 + 24, shop.apron.y + 10, -Math.PI / 2);
    t.assert((await t.call('carBloodReport')).stains.length === 1, 'stain gone before the garage');
    await t.call('interact');
    await t.wait(16);
    t.assert(!(await t.call('garage')).job, 'the garage job is still running');
    t.assert((await t.call('carBloodReport')).stains.length === 0, 'the respray left the stain');
  } finally {
    await t.call('bloodEnabled', true);
    await t.call('sky');
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
