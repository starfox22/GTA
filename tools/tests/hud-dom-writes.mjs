// The HUD writes the DOM only when something changed (game-state.js HUD WRITE GUARD, hudAttr): standing still on foot
// after a drive, a HUD refresh (about 11 a second) queues no DOM mutation for the attributes it used to rewrite every
// pass (the context strip, the speed box's mode, the radio's pressed states, the contact portrait's title, the toast).
const STEADY = ['bottom [data-context]', 'vehicleStats [data-mode]', 'radioPower [aria-pressed]', 'radioPreset', 'missionPortrait [title]', 'toast .note [data-tone]'];
export default async function (t) {
  await t.call('god', true);
  await t.call('wanted', 0);
  await t.call('setClock', 12);
  await t.call('teleport', 748, 584);
  await t.call('drive', 'sedan', 0, 0);
  await t.call('simulate', 1, ['KeyW']);
  await t.call('interact');
  await t.call('simulate', 2);
  await t.call('hitchRun', 1);
  const r = await t.call('hitchRun', 3);
  const steady = (r.domTargets || []).filter(([target]) => STEADY.some((s) => target.startsWith(s)));
  t.assert(!steady.length, `unchanged HUD attributes rewritten: ${JSON.stringify(steady)}`);
  // The feed's class changes when a line comes or goes (a few times), not on every frame of a line's leave (~17).
  const toast = (r.domTargets || []).find(([target]) => target === 'toast [class]');
  t.assert(!toast || toast[1] <= 4, `the notice feed's class rewritten ${toast && toast[1]} times in ${r.seconds} s`);
  // What is left changes for real (the clock's minutes, a prompt coming and going): a few a second at most.
  t.assert((r.totals.dom || 0) / r.seconds < 6, `DOM mutations a second standing still: ${((r.totals.dom || 0) / r.seconds).toFixed(1)} ${JSON.stringify(r.domTargets)}`);
}
