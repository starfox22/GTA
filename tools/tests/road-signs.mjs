// Stray signs and rings: no free-standing county board (guide, scenic-view, town, trailhead) stands on
// or across asphalt, no service place is a bare point in the road (every one has a building and a door
// on the pavement), the service rings and the free safehouse sign are gone from the source, and sleeping
// still works at the SUNSET MOTEL, where YOUR SAFEHOUSE (the mission's GO HOME) now lives.
import { readFileSync } from 'node:fs';
export const fresh = true;
const clockHours = (s) => {
  const [h, m] = String(s.clock).split(':').map(Number);
  return h + m / 60;
};
export default async function (t) {
  // 1. Boards clear of every carriageway (guideSigns places each through signSpot()).
  const boards = await t.call('guideSigns').catch(() => null);
  t.assert(Array.isArray(boards) && boards.length >= 10, 'guideSigns() reported no boards');
  for (const b of boards) {
    t.assert(!b.onAsphalt, `${b.kind} board ${b.text} stands on asphalt at ${Math.round(b.x)},${Math.round(b.y)}`);
    t.assert(b.clearance >= 12, `${b.kind} board ${b.text} is only ${b.clearance} units off the road (${Math.round(b.x)},${Math.round(b.y)})`);
    t.assert(b.width <= 72, `${b.kind} board ${b.text} is ${b.width} units wide: a guide board is 3-9 m`);
  }
  t.assert(boards.some((b) => b.text.includes('EAGLE PASS')), 'the EAGLE PASS guide sign is gone');
  t.note(`${boards.length} boards, nearest to a road: ${Math.min(...boards.map((b) => b.clearance))} units`);

  // 2. Every service place has a building and a door off the carriageway.
  const places = await t.call('places');
  t.assert(!places.some((p) => /SAFEHOUSE/.test(p.name)), 'a bare YOUR SAFEHOUSE place is back');
  const layout = await t.call('layout');
  const footprints = new Set(layout.places.map((p) => p.name));
  for (const p of places) {
    const door = await t.call('probe', p.door.x, p.door.y, 2);
    // (The casino's door ends its own drive, GOLDEN TIDE APPROACH.)
    if (p.kind !== 'casino') t.assert(!door.road, `${p.name}: the door (${p.door.x},${p.door.y}) is on the carriageway`);
    if (p.kind === 'sleep') t.assert(footprints.has(p.name) || /LODGE|REGENT/.test(p.name), `${p.name}: a sleep place without a building`);
  }

  // 3. The rings and the free-standing safehouse sign are not drawn any more.
  const civic = readFileSync(new URL('../../src/civic3d.js', import.meta.url), 'utf8');
  t.assert(!/serviceRings|SAFEHOUSE · ROOMS/.test(civic), 'civic3d.js still draws service rings or the safehouse sign');
  t.assert(!/RingGeometry\(p\.kind/.test(civic), 'civic3d.js still draws a ring at a service door');

  // 4. Sleeping works at the motel's real door.
  await t.call('holdSimulation', true);
  try {
    const motel = places.find((p) => p.name === 'SUNSET MOTEL');
    t.assert(motel, 'no SUNSET MOTEL');
    await t.call('god', false);
    await t.call('wanted', 0);
    await t.call('teleport', motel.door.x, motel.door.y);
    await t.wait(0.3);
    const before = clockHours(await t.call('status'));
    await t.call('interact');
    let s = await t.call('status');
    t.assert(s.mode === 'service', `the motel door did not open the counter: ${s.mode}`);
    await t.keys('Digit1', 0.15, { real: true });
    await t.realWait(0.5);
    s = await t.call('status');
    t.assert(s.mode === 'play', `still at the counter after sleeping: ${s.mode}`);
    const slept = (clockHours(s) - before + 24) % 24;
    t.assert(Math.abs(slept - 6) < 0.3, `sleep skipped ${slept.toFixed(2)} h, not 6`);
    t.assert(s.hp === 100, `sleep left hp ${s.hp}`);
    t.note(`slept ${slept.toFixed(1)} h at the SUNSET MOTEL door`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
