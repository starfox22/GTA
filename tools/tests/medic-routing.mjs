// Actual city graph/collision-field check. The host suite also covers retries, protected roles,
// unsafe approaches, and the emergency branch's drawbridge speed limit.
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    const r = await t.call('medicRoutingAudit');
    t.assert(r.result?.baselineBlocked, 'fixture blocks the direct road: ' + JSON.stringify(r));
    t.assert(r.result?.avoidsBlocker && r.result.detours === 1 && r.result.tries === 1, 'one successful detour avoids the blocked road: ' + JSON.stringify(r));
    t.assert(r.result.positionUnchanged && r.stateBefore === r.stateAfter, 'route planning moved vehicles or changed the live simulation: ' + JSON.stringify(r));
  } finally {
    await t.call('holdSimulation', false);
  }
}
