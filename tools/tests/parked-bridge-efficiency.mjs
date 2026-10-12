// A raised drawbridge must not disable parked-car settling shortcuts across the entire city.
// The audit compares every skipped vehicle with the full physics settle, including all its fields.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  try {
    await t.call('teleport', 748, 584);
    await t.call('drawbridge', 'snap', 0, 'all');
    await t.wait(0.5);
    const shut = await t.call('settleAudit', 20);
    t.assert(shut.checked > 1000 && shut.changed === 0, 'closed-bridge settle audit: ' + JSON.stringify(shut));
    await t.call('drawbridge', 'snap', 45, 'all');
    t.assert((await t.call('drawbridges')).anyOpen, 'the bridge test did not raise the spans');
    const open = await t.call('settleAudit', 20);
    t.note(JSON.stringify({ shut, open }));
    t.assert(open.checked > 1000, 'raised bridges disabled the parked-car shortcut: ' + JSON.stringify(open));
    t.assert(open.changed === 0, 'the shortcut changed physics beside an open bridge: ' + JSON.stringify(open));
  } finally {
    await t.call('drawbridge', 'close', 0, 'all');
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
