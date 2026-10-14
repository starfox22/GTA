// A dispatch message must remain readable below the touch mission card, in both camera modes.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  try {
    await t.call('settings', { touch: 'on' });
    // An actual job keeps the card available while the browser is busy; the no-job incoming-call
    // notice lasts only eight wall seconds and is not the layout this regression needs to exercise.
    await t.call('startMission', 0);
    await t.call('teleport', 420, 4400);
    await t.call('drive', 'bus', 0, Math.PI / 2);
    for (const view of ['street', 'chase']) {
      await t.call('viewMode', view);
      await t.call('wanted', 0);
      // Settle the camera/layout before opening the dispatch message. The caption lasts 4.2
      // wall seconds; a costly stepped physics call must not consume its lifetime before measurement.
      await t.wait(0.2);
      await t.realWait(0.9);
      // Explicitly open the card if the clearance system folded it for the bus. A folded strip is too short
      // to reproduce the original overlap; the dispatch must also clear a card the player asks to read.
      if ((await t.call('missionCard')).open) await t.keys('KeyO', 0.1, { real: true });
      await t.keys('KeyO', 0.1, { real: true });
      await t.call('wanted', 3);
      // Observe the first visible card/caption pair, then test its geometry once. Never poll until
      // the gap happens to pass, and never retrigger or extend the production dispatch timer.
      let r, visible = false;
      const deadline = Date.now() + 3000;
      do {
        await t.realWait(0.1);
        r = await t.call('hudOverlaps');
        visible = r.boxes.some(b => b.id === 'pager') && r.boxes.some(b => b.id === 'radioCaption');
      } while (!visible && Date.now() < deadline);
      const card = r.boxes.find(b => b.id === 'pager');
      const caption = r.boxes.find(b => b.id === 'radioCaption');
      t.assert(card && caption, `${view}: missing mission card or dispatch caption: ${JSON.stringify(r.boxes)}`);
      t.note(`${view}: ${JSON.stringify({ card, caption })}`);
      t.assert(card.b - card.t > 50, `${view}: the mission card was folded, so the overlap was not tested`);
      t.assert(caption.t >= card.b + 6, `${view}: dispatch overlaps the mission card: ${JSON.stringify({ card, caption })}`);
    }
  } finally {
    await t.call('wanted', 0);
    await t.call('settings', { touch: 'auto', cameraView: 'street' });
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
