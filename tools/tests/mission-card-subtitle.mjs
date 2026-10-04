// A short window (the test page is 960x600): the story line (film subtitle) and the open mission
// card do not fit one above the other, so while a line is up the card stays a one-line strip
// (game-ui.js missionCardYields; the line sits above the strip, radio.css). O still opens it; a new
// objective with no line opens the card as ever.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('startMission', 0);
    let card = await t.call('missionCard');
    if (card.viewport[1] > 620 || card.viewport[0] <= 700) {
      t.note('not a short desktop window: ' + card.viewport);
      return;
    }
    t.assert(card.line && /^Vinny: /.test(card.line), 'no story line at the start: ' + JSON.stringify(card));
    t.assert(!card.open, 'the card opened under the story line: ' + JSON.stringify(card));
    card = await t.call('toggleMissionCard');
    t.assert(card.open, 'O did not open the card: ' + JSON.stringify(card));
    card = await t.call('toggleMissionCard');
    t.assert(!card.open, 'O did not fold the card: ' + JSON.stringify(card));
    // The line ends; boarding the truck is a new objective without a line: the card opens.
    await t.wait(11);
    card = await t.call('missionCard');
    t.assert(!card.line, 'the line outlived its 10 s: ' + JSON.stringify(card));
    await t.call('boardMissionVehicle');
    await t.wait(0.5);
    const m = await t.call('missionState');
    t.assert(m.stage === 1, 'not on the drive stage: ' + JSON.stringify(m));
    card = await t.call('missionCard');
    t.assert(card.open && !card.line, 'a new objective did not open the card: ' + JSON.stringify(card));
  } finally {
    await t.call('holdSimulation', false);
  }
}
