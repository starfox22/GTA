// The actual new records/sky lift entry functions must release both pointer buttons.
import fs from 'node:fs';
import vm from 'node:vm';

export default async function(t) {
  const read = name => fs.readFileSync(new URL('../../src/' + name, import.meta.url), 'utf8'),
    fort = read('fort-cover-records.js'), sky = read('skyline-lift.js'),
    fortStart = fort.slice(fort.indexOf('    function startFortRecords()'), fort.indexOf('    // The beats')),
    skyStart = sky.slice(sky.indexOf('    function startSkyLift('), sky.indexOf('    /* The ride:'));
  for (const kind of ['records', 'lift']) {
    const mouse = { down: true, alt: true },
      scope = vm.createContext({ mouse, gameMode: 'play', keys: { KeyW: true }, fortRecords: null, skyLift: null,
        fortCover: { suspicion: 20 }, FORT_RECORDS: { tailAbove: 60 },
        getElement: () => ({ style: {}, classList: { remove() {} } }),
        noise() {}, tone() {}, skyMeetingRideStart() {} }),
      start = vm.runInContext(fortStart + skyStart + (kind === 'records' ? 'startFortRecords' : 'startSkyLift'), scope);
    t.assert(start({ name: 'CIRRUS', venue: 'BAR', floors: 30 }, true), kind + ': initial modal entry rejected');
    t.assert(!mouse.down && !mouse.alt && Object.keys(scope.keys).length === 0, kind + ': aiming/firing/movement stuck across modal');
    t.assert(scope.gameMode === 'elevator', kind + ': modal mode not entered');
    mouse.alt = true;
    t.assert(start({}, true) === false && mouse.alt, kind + ': rejected duplicate entry mutates active input');
  }
}
