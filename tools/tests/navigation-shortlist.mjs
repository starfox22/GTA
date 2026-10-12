// The real generated road graph and its collision field agree with the prior full-sort selector,
// including probe order; an audit must leave the simulation unchanged.
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    const r = await t.call('navigationAudit', 120);
    t.assert(r.nodes > 1000 && r.queries === 120, 'audit covers the generated road network: ' + JSON.stringify(r));
    t.assert(r.mismatches === 0 && r.probeMismatches === 0, 'selected nodes and visibility order match: ' + JSON.stringify(r));
    t.assert(r.stateBefore === r.stateAfter, 'navigation audit changed simulation state: ' + JSON.stringify(r));
  } finally {
    await t.call('holdSimulation', false);
  }
}
