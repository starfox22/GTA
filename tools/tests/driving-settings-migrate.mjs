// Settings · Driving saved records (driving.js applySavedDrivingSettings), run on the shipped function without a
// browser: a record from before version 2 still at the old 150 % look-ahead default loads at the new 200 % default,
// any other look-ahead is kept (clamped to 0-300 %), a version 2 record keeps 150 %, and the walking camera distance
// loads (60-160 %) or stays at its 100 % default.
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../src/driving.js', import.meta.url), 'utf8');
export default async function (t) {
  const fn = source.match(/^    function applySavedDrivingSettings\([^]*?^    \}/m),
    defaults = source.match(/DRIVING_DEFAULTS = (\{[^}]*\})/),
    top = source.match(/DRIVING_LOOK_AHEAD_MAX = (\d+)/);
  t.assert(fn && defaults && top, 'applySavedDrivingSettings, DRIVING_DEFAULTS or DRIVING_LOOK_AHEAD_MAX not found in driving.js');
  const context = vm.createContext({ clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)) });
  vm.runInContext(`const DRIVING_DEFAULTS = ${defaults[1]}, DRIVING_LOOK_AHEAD_MAX = ${top[1]};\n${fn[0]}\nthis.load = (saved) => applySavedDrivingSettings(saved, { ...DRIVING_DEFAULTS });\nthis.defaults = DRIVING_DEFAULTS;`, context);
  const load = (saved) => context.load(saved);
  t.assert(context.defaults.lookAhead === 200 && context.defaults.walkDistance === 100, 'defaults: ' + JSON.stringify(context.defaults));
  const cases = [
    [{ lookAhead: 150 }, 200, 'an old record at the old default'],
    [{ lookAhead: 150, cameraDistance: 140 }, 200, 'an old record at the old default with another value changed'],
    [{ lookAhead: 120 }, 120, 'an old record at its own value'],
    [{ lookAhead: 0 }, 0, 'an old record with the lead off'],
    [{ lookAhead: 150, version: 2 }, 150, 'a version 2 record at 150 %'],
    [{ lookAhead: 280, version: 2 }, 280, 'a version 2 record at 280 %'],
    [{ lookAhead: 900, version: 2 }, 300, 'a record past the top'],
    [{}, 200, 'a record without a look-ahead'],
    [null, 200, 'no record'],
  ];
  for (const [saved, want, label] of cases) {
    const got = load(saved).lookAhead;
    t.assert(got === want, `${label}: look-ahead ${got}, expected ${want}`);
  }
  const kept = load({ lookAhead: 150, cameraDistance: 140, steering: 70, abs: false });
  t.assert(kept.cameraDistance === 140 && kept.steering === 70 && kept.abs === false, 'other values not kept: ' + JSON.stringify(kept));
  t.assert(load({}).walkDistance === 100, 'walking distance default');
  t.assert(load({ walkDistance: 130 }).walkDistance === 130, 'walking distance kept');
  t.assert(load({ walkDistance: 20 }).walkDistance === 60 && load({ walkDistance: 400 }).walkDistance === 160, 'walking distance clamped');
}
