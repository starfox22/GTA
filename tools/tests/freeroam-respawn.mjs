// Free-roam safety nets: WASTED wakes the player at the nearest hospital (Palm Keys ->
// RIVERSIDE MEDICAL, Monarch Isle -> THE HALCYON CLINIC, the county -> SAINT MARLOW), the
// god-mode teleport never leaves someone on a mountain face they slide off, and places()
// reports finite coordinates for every place (YOUR SAFEHOUSE has only a door).
export const fresh = true;
const HOSPITALS = { 'RIVERSIDE MEDICAL': [-1670, 1972] };
async function dieAt(t, x, y) {
  await t.call('teleport', x, y);
  await t.wait(3.2); // past the respawn's 3 s of invulnerability
  await t.call('blast', x, y, 3);
  await t.wait(0.5);
  const s = await t.call('status');
  t.assert(s.mode === 'dead', `not killed at ${x},${y}: ${JSON.stringify(s)}`);
  await new Promise((r) => setTimeout(r, 4800)); // WASTED runs on the wall clock
  await t.wait(0.2);
  return t.call('status');
}
export default async function (t) {
  const places = await t.call('places');
  t.finite(places, 'places');
  const door = (name) => {
    const p = places.find((q) => q.name === name);
    t.assert(p, 'no place ' + name);
    return p;
  };
  await t.call('holdSimulation', true);
  try {
    await t.call('god', false);
    // Palm Keys: across the sound from Saint Marlow.
    let s = await dieAt(t, -1800, 1500);
    const [rx, ry] = HOSPITALS['RIVERSIDE MEDICAL'];
    t.assert(s.mode === 'play' && Math.hypot(s.x - rx, s.y - ry) < 40, 'Palm Keys death did not wake at RIVERSIDE MEDICAL: ' + JSON.stringify(s));
    // Monarch Isle: its own clinic.
    const clinic = door('THE HALCYON CLINIC');
    s = await dieAt(t, 7400, -3000);
    t.assert(s.mode === 'play' && Math.hypot(s.x - clinic.x, s.y - clinic.y) < 400, 'Monarch death did not wake at THE HALCYON CLINIC: ' + JSON.stringify(s));
    // The county: Saint Marlow, not the Monarch clinic across the water.
    s = await dieAt(t, 7000, 3282);
    t.assert(s.mode === 'play' && Math.hypot(s.x - 376, s.y - 948) < 40, 'county death did not wake at SAINT MARLOW: ' + JSON.stringify(s));
    // A god teleport onto a steep Ridgeline face lands on footing that holds.
    for (const [x, y] of [[8000, 1500], [7400, 1200]]) {
      const r = await t.call('godTeleport', x, y);
      t.assert(r.kind === 'foot', 'not on foot: ' + JSON.stringify(r));
      await t.wait(3);
      const f = await t.call('fallState');
      t.assert(f.hp === 100 && !f.falling && !f.tumbling && f.impacts.length === 0, `slid off the god teleport at ${x},${y}: ` + JSON.stringify(f));
      t.assert(Math.hypot(f.x - r.to.x, f.y - r.to.y) < 4, `moved ${Math.round(Math.hypot(f.x - r.to.x, f.y - r.to.y))} units standing still at ${JSON.stringify(r.to)}`);
    }
  } finally {
    await t.call('holdSimulation', false);
  }
}
