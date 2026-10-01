// Pedestrians and oncoming cars (crowd-awareness.js): a person reacts to a car only if they could perceive it.
// Facing the car at 40 km/h most step or leap clear; with their back to it most never notice, and the few who
// hear it (more with the horn on) mostly turn too late; a car that appears close or fast gives nobody time;
// a phone in hand slows them; a pedestrian hit unaware does not cry out. Each pass seeds its own dice, but the world
// round it is live, so a rate moves by about 10 points between runs: the limits below leave room for that.
export const fresh = true;
const SPOT = { x: 420, y: 4600 }; // the airport's open ground, nobody about
const N = 10;
const rates = {};
async function runCase(t, name, options) {
  const r = await t.call('carAwarenessTrials', { samples: N, seed: 4242, ...options });
  t.assert(r && r.samples === N, `${name}: no trial result`);
  const rate = { noticed: r.noticed / N, tried: r.tried / N, cleared: r.cleared / N, hit: r.hit / N, silent: r.silent / N, outcomes: r.outcomes };
  rates[name] = rate;
  t.note(`${name}: noticed ${(rate.noticed * 100).toFixed(0)}% (eyes ${r.byEyes}, ears ${r.byEars}), dodged ${(rate.tried * 100).toFixed(0)}% (cleared ${(rate.cleared * 100).toFixed(0)}%), hit ${(rate.hit * 100).toFixed(0)}% (${r.silent} without a cry) ${JSON.stringify(r.outcomes)}`);
  return rate;
}
export default async function (t) {
  await t.call('god', true);
  await t.call('sky', 'clear');
  await t.call('holdSimulation', true);
  try {
    await t.call('teleport', SPOT.x, SPOT.y);
    await t.call('drive', 'sedan', 0, 0);
    await t.call('repair');
    await t.call('wanted', 0);

    const toward = await runCase(t, 'toward 40 km/h, 27 m', { facing: 'toward', kmh: 40, gap: 220 });
    const away = await runCase(t, 'away 40 km/h, 27 m', { facing: 'away', kmh: 40, gap: 220 });
    const horn = await runCase(t, 'away 40 km/h, 27 m, horn', { facing: 'away', kmh: 40, gap: 220, horn: true });
    const side = await runCase(t, 'side 40 km/h, 27 m', { facing: 'side', kmh: 40, gap: 220 });
    const farFast = await runCase(t, 'toward 80 km/h, 41 m', { facing: 'toward', kmh: 80, gap: 330 });
    const closeToward = await runCase(t, 'toward 40 km/h, 5 m', { facing: 'toward', kmh: 40, gap: 40 });
    const fastToward = await runCase(t, 'toward 80 km/h, 12 m', { facing: 'toward', kmh: 80, gap: 100 });
    const phone = await runCase(t, 'toward 40 km/h, texting', { facing: 'toward', kmh: 40, gap: 130, attention: 'text' });
    const alert = await runCase(t, 'toward 40 km/h, same gap', { facing: 'toward', kmh: 40, gap: 130 });

    // Facing the car: nearly all notice, and most dodge clear.
    t.assert(toward.noticed >= 0.9, `facing the car, only ${toward.noticed} noticed it`);
    t.assert(toward.tried >= 0.55 && toward.cleared >= 0.5, `facing the car at 40 km/h: ${toward.tried} dodged, ${toward.cleared} cleared`);
    t.assert(farFast.tried >= 0.6 && farFast.cleared >= 0.6, `facing a car at 80 km/h from 41 m: ${farFast.tried} dodged, ${farFast.cleared} cleared`);
    // Their back to it: most never see it coming, so most are hit, and hardly any dodge.
    t.assert(away.tried <= 0.2, `with their back to the car ${away.tried} dodged`);
    t.assert(away.hit >= 0.8, `with their back to the car only ${away.hit} were hit`);
    t.assert(away.noticed <= 0.5, `the car from behind was noticed by ${away.noticed} (some hear it at the last moment, not most)`);
    // Hit unaware, no cry; those who saw it coming were hit crying out.
    t.assert(away.silent >= 0.4 && toward.silent === 0, `cries: ${away.silent} of those hit from behind were silent, ${toward.silent} facing it`);
    // A horn from behind wakes some of them (a few get clear), but not everyone, and it does not undo the rest.
    t.assert(horn.noticed > away.noticed + 0.3, `the horn from behind changed little: ${horn.noticed} vs ${away.noticed}`);
    t.assert(horn.tried > away.tried && horn.cleared <= toward.cleared, `horn from behind: ${horn.tried} dodged, ${horn.cleared} cleared (back to it ${away.tried}, facing it ${toward.cleared})`);
    // Side on: in between.
    t.assert(side.tried >= away.tried + 0.2 && side.cleared <= toward.cleared + 0.2, `side on: ${side.tried} dodged (behind ${away.tried}, facing ${toward.tried})`);
    // Close and fast: nobody has the time, however well they see it.
    t.assert(closeToward.tried <= 0.15 && closeToward.cleared <= 0.15, `a car 5 m off at 40 km/h gave ${closeToward.tried} the time to dodge`);
    t.assert(fastToward.tried <= 0.2 && fastToward.cleared <= 0.15, `a car 12 m off at 80 km/h gave ${fastToward.tried} the time to dodge`);
    // Attention: a phone costs them time they do not have.
    t.assert(phone.cleared <= alert.cleared, `texting did not hurt: ${phone.cleared} cleared vs ${alert.cleared}`);
    t.note('rates: ' + JSON.stringify(rates));
  } finally {
    await t.call('holdSimulation', false);
  }
}
