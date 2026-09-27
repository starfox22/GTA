// Headlights on slopes (terrain-headlights.js): a 4x4's beams aim with the body as it sits
// on the Mount Ascent trail (up a 28% climb, over a crest, down the far side), the road
// ahead lies in the lit band of the low beam where the old level frame put it out of the
// beam, the ground past a crest is hidden by it (terrain horizon), and on a city street
// the frame is level and matches the old one.
export const fresh = true;

const TRAIL = {
  uphill: [7709, 1799, -2.764],
  crest: [7590, 1657, 0.178],
  downhill: [7672, 1671, 0.134],
};

async function place(t, [x, y, heading]) {
  await t.call('placeVehicle', x, y, heading);
  // One physics step poses the body on the ground (terrainVehiclePose).
  await t.wait(0.05);
  const aim = await t.call('headlightAim', [5, 10, 20, 30, 40]);
  t.finite(aim, 'headlightAim');
  return aim;
}

export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('teleport', 7709, 1799);
  await t.call('drive', 'expedition');
  const at = (aim, m) => aim.probes.find((p) => p.m === m);

  // Up the climb: pitched up, the aim follows the pitch, the road ahead is lit like a level road.
  const up = await place(t, TRAIL.uphill);
  t.note(`uphill: ${JSON.stringify(up)}`);
  t.near(up.pitchDeg, 10, 20, 'uphill pitch (deg)');
  t.near(up.aim[2], Math.sin((up.pitchDeg * Math.PI) / 180) - 0.02, Math.sin((up.pitchDeg * Math.PI) / 180) + 0.02, 'uphill aim follows the pitch');
  t.near(up.lampOverGroundM, 0.9, 1.4, 'uphill lamp height over the ground (m)');
  t.assert(up.horizon, 'uphill: the terrain horizon is on');
  for (const m of [5, 10]) {
    const p = at(up, m);
    t.near(p.v, -0.25, -0.012, `uphill ${m} m: ground below the cut-off in the body frame`);
    t.assert(p.vLevel > p.v + 0.08, `uphill ${m} m: the level frame aimed ${p.vLevel} (body ${p.v})`);
    t.near(p.lit, 0.9, 1, `uphill ${m} m: in the clear`);
  }

  // Down the far side: pitched down, the road ahead still in the lit band.
  const down = await place(t, TRAIL.downhill);
  t.note(`downhill: ${JSON.stringify(down)}`);
  t.near(down.pitchDeg, -20, -10, 'downhill pitch (deg)');
  t.near(down.aim[2], Math.sin((down.pitchDeg * Math.PI) / 180) - 0.02, Math.sin((down.pitchDeg * Math.PI) / 180) + 0.02, 'downhill aim follows the pitch');
  for (const m of [5, 10, 20]) {
    const p = at(down, m);
    t.near(p.v, -0.25, -0.012, `downhill ${m} m: ground below the cut-off in the body frame`);
    t.assert(p.vLevel < p.v - 0.08, `downhill ${m} m: the level frame aimed ${p.vLevel} (body ${p.v})`);
    t.near(p.lit, 0.9, 1, `downhill ${m} m: in the clear`);
  }

  // Short of a crest: the near road is lit, the ground falling away beyond it is hidden.
  const crest = await place(t, TRAIL.crest);
  t.note(`crest: ${JSON.stringify(crest)}`);
  t.near(at(crest, 5).lit, 0.9, 1, 'crest: the near road is lit');
  t.assert(at(crest, 20).lit < 0.2 && at(crest, 30).lit < 0.2, `crest: ground past the crest hidden (${at(crest, 20).lit}, ${at(crest, 30).lit})`);

  // A city street: level, no horizon, the same beam coordinates as the old frame.
  // (The god-mode teleport moves the car with its driver onto the nearest road.)
  const city = await t.call('godTeleport', 2300, 1800);
  t.assert(city.kind === 'road' && city.vehicle?.type === 'expedition', `city: ${JSON.stringify(city)}`);
  await t.wait(0.05);
  const flat = await t.call('headlightAim', [10, 20, 30]);
  t.finite(flat, 'headlightAim (city)');
  t.assert(flat.pitchDeg === 0 && flat.rollDeg === 0 && flat.aim[2] === 0, `city: level (${flat.pitchDeg}, ${flat.rollDeg}, ${flat.aim})`);
  t.assert(!flat.horizon, 'city: no terrain horizon');
  for (const p of flat.probes) t.assert(Math.abs(p.v - p.vLevel) < 0.002 && p.lit === 1, `city ${p.m} m: v ${p.v} vs ${p.vLevel}, lit ${p.lit}`);
  await t.call('holdSimulation', false);
}
