// The mission card's sentence is lower case with the story's names capitalised, but a key's own name
// in the stage text stays as it reads ("· E to load", "· P"): lower-cased it looked like a typo.
export const fresh = true;
export default async function (t) {
  // Mission 1 at the loading bay: "PARK IN THE LOADING BAY · E TO LOAD".
  await t.call('startMission', 0);
  await t.call('boardMissionVehicle');
  await t.call('placeVehicle', 2300, 1664, 0);
  await t.call('steerTo', 2760, 1664, 25, 40);
  let m = await t.call('missionState');
  t.assert(m.stage === 2, 'not at the bay stage: ' + JSON.stringify(m));
  let card = await t.call('missionCard');
  t.assert(/^Vinny gave you a mission: park in the loading bay · E to load\.$/.test(card.text), 'M1 card: ' + card.text);

  // Mission 2: the outfit ("· E") and the glass ("· P"), Vescari and the motel capitalised.
  await t.call('startMission', 1);
  card = await t.call('missionCard');
  t.assert(/^Vinny gave you a mission: collect guest clothes at Sunset Motel · E\.$/.test(card.text), 'M2 stage 0 card: ' + card.text);
  await t.call('roofPlace', 150, 250);
  m = await t.call('missionState');
  t.assert(m.stage === 2, 'not on the terrace stage: ' + JSON.stringify(m));
  card = await t.call('missionCard');
  t.assert(/^Vinny gave you a mission: spike Vescari’s glass unseen · P\.$/.test(card.text), 'M2 stage 2 card: ' + card.text);
  t.assert(/^OBJECTIVE · /.test(card.distance), 'distance pill: ' + card.distance);

  // A gamepad's interact button is "A": kept behind the "·", but the article in "AS A GUEST" is not a key.
  await t.call('inputHints', 'gamepad');
  await t.call('retryMission');
  card = await t.call('missionCard');
  t.assert(/^Vinny gave you a mission: collect guest clothes at Sunset Motel · A\.$/.test(card.text), 'gamepad stage 0 card: ' + card.text);
  await t.call('teleport', 882, 1990);
  await t.call('interact');
  m = await t.call('missionState');
  t.assert(m.stage === 1, 'outfit not collected: ' + JSON.stringify(m));
  card = await t.call('missionCard');
  t.assert(/^Vinny gave you a mission: enter the Blue Hour as a guest\.$/.test(card.text), 'gamepad stage 1 card: ' + card.text);
  await t.call('inputHints', 'auto');
}
