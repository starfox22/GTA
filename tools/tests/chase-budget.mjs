// The chase view's draw budget (chase-view3d-props.js CHASE PARTS, CHASE HAZE SIZES, CHASE VEHICLE PARTS;
// chase-view3d-casters.js per batch, pool and part): looking west down Royal Ave at MEDIUM, the static groups'
// small parts deep in the haze leave the view while the near ones stay, the budget draws fewer calls than
// lookSwitches({ chaseBudget: false }) (the old rules, same page), and the street view gets every part back. The
// no-render page has no renderer: there it only checks the chase view still switches on and off. (A clean page: Royal
// Ave at 15:00 rings the story payphone, which later tests must not inherit.)
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('setClock', 15);
    await t.call('viewMode', 'chase');
    await t.call('teleport', 1152, 1160);
    await t.wait(0.5);
    await t.call('chaseLook', 0, 0, 180, 2);
    await t.wait(1);
    const view = (await t.call('chaseCamera')).view;
    if (!view) return; // no renderer on the no-render page
    await t.call('graphics', 'medium');
    await t.realWait(12);
    const on = (await t.call('chaseCamera')).view;
    t.note('budget on: ' + JSON.stringify({ props: on.props, view: on.draws.view.calls, shadow: on.draws.shadow.calls }));
    t.assert(on.props.parts > 300, 'the static groups listed few parts: ' + on.props.parts);
    t.assert(on.props.partsHidden > 0 && on.props.partsHidden < on.props.parts, 'parts left out, but not all: ' + JSON.stringify(on.props));
    t.assert(on.props.signs > 0, 'no signs listed');
    await t.call('lookSwitches', { chaseBudget: false });
    await t.realWait(12);
    const off = (await t.call('chaseCamera')).view;
    t.note('budget off: ' + JSON.stringify({ props: off.props, view: off.draws.view.calls, shadow: off.draws.shadow.calls }));
    t.assert(off.props.partsHidden === 0 && off.props.signsHidden === 0, 'with the budget off a part or sign stays out: ' + JSON.stringify(off.props));
    const callsOn = on.draws.view.calls + on.draws.shadow.calls,
      callsOff = off.draws.view.calls + off.draws.shadow.calls;
    t.assert(callsOn < callsOff * 0.85, `the budget saves under 15% of the calls: ${callsOn} on, ${callsOff} off`);
    await t.call('lookSwitches', { chaseBudget: true });
    await t.call('viewMode', 'street');
    await t.realWait(8);
    const street = (await t.call('chaseCamera')).view;
    t.assert(street.props.detailHidden === 0 && street.props.partsHidden === 0 && street.props.signsHidden === 0, 'the street view did not get every prop back: ' + JSON.stringify(street.props));
  } finally {
    await t.call('lookSwitches', { chaseBudget: true });
    await t.call('viewMode', 'street');
    await t.call('holdSimulation', false);
  }
}
