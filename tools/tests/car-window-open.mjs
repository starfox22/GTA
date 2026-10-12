// Shattered and lowered windows leave an actual opening, and repair restores the pane.
export const fresh = true;
export default async function (t) {
  if ((await t.call('carModels')) === null) t.skip('Requires WebGL: run with --render');
  await t.call('holdSimulation', true);
  await t.call('god', true);
  try {
    await t.call('viewMode', 'chase');
    await t.call('teleport', 1152, 1160);
    await t.call('drive', 'sedan', 0, 0);
    await t.wait(0.5);
    await t.call('chaseLook', 0, 0, 90, 5);
    const id = (await t.call('damageReport')).id;
    const read = async () => {
      await t.call('hitchRun', 0.1, [], 4, false, true);
      const model = (await t.call('carModels')).find(c => c.id === id);
      t.assert(model?.panes, 'the sedan and its window panes were not rendered');
      return model.panes;
    };
    let panes = await read();
    t.assert(panes.left.drawn && panes.right.drawn, 'intact side windows are missing');
    await t.call('shootVehicle', id, 'left', 30);
    t.assert((await t.call('damageReport')).glass.left === 2, 'the left window did not break');
    panes = await read();
    t.assert(!panes.left.drawn && !panes.left.depthWrite, 'the shattered pane still hides the cabin');
    t.assert(panes.right.drawn, 'breaking the left pane also removed the right pane');
    await t.call('repair');
    panes = await read();
    t.assert(panes.left.drawn, 'repair did not restore the window');
    await t.call('driveByAim', -90, 'raise');
    await t.wait(0.8);
    panes = await read();
    t.assert(!panes.left.drawn, 'the window rolled down for a drive-by still hides the cabin');
  } finally {
    await t.call('driveByAim', null);
    await t.call('viewMode', 'street');
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
