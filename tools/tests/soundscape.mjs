// The free-roam soundscape: the ground under a step at known places (footSurfaceAt), a
// building muffling a sound behind it, a shotgun's strikes on a wall within the impact budget,
// the ambience ducking under the shot, the ear's zone downtown against up the range, footsteps while running, and a truck's air
// horn and its doors.
const GROUND = [
  [128, 128, 'asphalt', 'a Northbank junction'],
  [1730, 2432, 'pavement', 'a Midtown sidewalk'],
  [2000, 3000, 'grass', 'Central Garden'],
  [-2000, 5450, 'sand', 'Palm Keys Beach'],
  [-2000, 5326, 'wood', 'the boardwalk'],
  [-1710, 5800, 'wood', 'the beach pier'],
  [3410, 1827, 'wood', 'a harbour dock'],
  [4100, -3500, 'tile', 'North Point Key'],
  [7600, 1900, 'dirt', 'the Mount Ascent trailhead'],
  [7760, 1090, 'snow', 'Mount Ascent'],
  [7000, 3000, 'grass', 'county grass'],
];
const SIDEWALK = [1730, 2432],
  SUMMIT = [7760, 1090];
export default async function (t) {
  try {
    for (const [x, y, want, label] of GROUND) {
      const r = await t.call('footsteps', x, y);
      t.assert(r.surface === want, `${label} (${x}, ${y}): ${r.surface}, expected ${want}`);
    }
    const mix = await t.call('audioMix');
    if (mix.context !== 'running') {
      t.note(`audio context ${mix.context}: only the ground was checked`);
      return;
    }
    await t.call('teleport', ...SIDEWALK);
    await t.call('holdSimulation', true);
    await t.wait(2.5);
    // A shot across the block is behind buildings; one up the avenue is in the open.
    const across = (await t.call('acoustics', 2176, 2432)).at,
      along = (await t.call('acoustics', 1730, 2100)).at;
    t.assert(across.occluded && across.cutoff < 3000, `across the block: ${JSON.stringify(across)}`);
    t.assert(!along.occluded && along.cutoff > 8000, `up the avenue: ${JSON.stringify(along)}`);
    // A shotgun load into the wall across the street: each pellet strikes, within the budget.
    const struck = (await t.call('acoustics')).bullets;
    await t.call('shootAt', 2000, 2432, 2);
    await t.wait(0.3);
    const strikes = (await t.call('acoustics')).bullets;
    t.assert(strikes.impacts > struck.impacts && strikes.impacts - struck.impacts <= 6 && strikes.last === 'wall', `strikes: ${JSON.stringify(strikes)}`);
    const town = await t.call('acoustics');
    t.assert(town.zone.city === 1 && town.zone.country === 0, `Midtown zone: ${JSON.stringify(town.zone)}`);
    t.near(town.probe.enclosure, 0.3, 1, 'Midtown street enclosure');
    // Running along the sidewalk: about four steps a second.
    const before = (await t.call('footsteps')).steps;
    await t.keys('KeyW', 2);
    const run = await t.call('footsteps');
    t.near(run.steps - before, 6, 12, 'steps in 2 s of running');
    t.assert(['pavement', 'asphalt'].includes(run.surface), `running on ${run.surface}`);
    // Up the range: open, hilly, windy, and the county's echo rather than a street's slap.
    await t.call('teleport', ...SUMMIT);
    await t.wait(3);
    const peak = await t.call('acoustics'),
      beds = await t.call('soundscape');
    t.assert(peak.probe.enclosure === 0 && peak.probe.relief > 0.5 && peak.probe.county === 1, `summit probe: ${JSON.stringify(peak.probe)}`);
    t.assert(beds.weights.mountain > 0.6 && beds.weights.city < 0.2, `summit weights: ${JSON.stringify(beds.weights)}`);
    t.assert(beds.exposure > 0.9, `summit exposure ${beds.exposure}`);
    // A truck: the door on the way in, the air horn while H is held, the cabin dulls the street.
    await t.call('teleport', ...SIDEWALK);
    await t.call('drive', 'truck');
    await t.wait(0.5);
    let foley = await t.call('vehicleFoley');
    t.assert(foley.doors.some((d) => d.action === 'enter' && d.kind === 'heavy'), `doors: ${JSON.stringify(foley.doors)}`);
    t.assert(foley.horn.kind === 'air', `truck horn: ${foley.horn.kind}`);
    const honks = foley.horn.honks;
    await t.keys('KeyH', 0.4);
    await t.wait(0.1); // the release is read on the next frame
    foley = await t.call('vehicleFoley');
    t.assert(foley.horn.honks === honks + 1 && !foley.horn.held, `horn: ${JSON.stringify(foley.horn)}`);
    t.assert(foley.ground && ['asphalt', 'pavement'].includes(foley.ground.kind) && !foley.ground.loose, `tyre ground: ${JSON.stringify(foley.ground)}`);
    await t.call('interact');
    foley = await t.call('vehicleFoley');
    t.assert(foley.doors.some((d) => d.action === 'exit'), `no door on the way out: ${JSON.stringify(foley.doors)}`);
    // A shotgun fired on foot ducks the ambience under it.
    await t.call('arm', 2);
    const ducks = (await t.call('audioMix')).loudDuck.events;
    await t.keys('KeyF', 0.05);
    const ducked = (await t.call('audioMix')).loudDuck;
    t.assert(ducked.events > ducks && ducked.depth > 0.2, `the shotgun did not duck the ambience: ${JSON.stringify(ducked)}`);
    await t.call('wanted', 0);
    t.finite(await t.call('soundscape'), 'soundscape');
    t.finite(foley.thumps + foley.passBys, 'thumps and pass-bys');
    t.note(`Midtown enclosure ${town.probe.enclosure}, summit echo ${peak.returns.echo}, ${run.steps - before} steps in 2 s`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
