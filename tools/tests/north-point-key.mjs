// North Point Key: three towers on the islet, the rest in reserve, offices on the old blocks, the
// bridge and GPS; the lobby lifts up to CIRRUS and the helideck and back, bounded roof walking,
// the parked helicopter, the bar's people and their talk, a drink at the bar.
export const fresh = true;
export default async function (t) {
  let s = await t.call('skyline');
  t.assert(s.towers.length === 3 && s.towers.every((o) => o.lot && o.lot[0] > 3712), 'three towers on the Key: ' + JSON.stringify(s.towers));
  t.assert(s.reserve.length === 15, 'reserve towers: ' + s.reserve.length);
  t.assert(s.islet.land && s.islet.district === 'NORTH POINT KEY', 'islet land: ' + JSON.stringify(s.islet));
  t.assert(s.islet.street && s.islet.street[1] > 3900 && s.islet.street[1] <= 3960, 'street onto the Key: ' + JSON.stringify(s.islet.street));
  t.assert(s.islet.bridge && s.islet.bridge.channels === 1, 'bridge: ' + JSON.stringify(s.islet.bridge));
  t.assert(s.helicopter && s.helicopter.onPad, 'helicopter parked on the helideck: ' + JSON.stringify(s.helicopter));
  t.assert(s.offices.length === 14 && s.offices.every((o) => o.built === o.retired && o.maxHeight <= 35), 'offices on the old cluster blocks: ' + JSON.stringify(s.offices));
  const route = await t.call('route', 4100, -3380);
  t.assert(route.bridges.includes('north-point-key'), 'GPS route over the Key bridge: ' + JSON.stringify(route));
  // Up to CIRRUS from EVOLUTION's lobby.
  await t.call('skylineVisit', 'lobby-bar');
  await t.wait(0.3);
  let prompt = await t.call('promptState');
  t.assert(/ELEVATOR TO CIRRUS/.test(prompt.offered || ''), 'lobby prompt: ' + JSON.stringify(prompt));
  await t.call('interact');
  await t.wait(3.2);
  s = await t.call('skyline');
  t.assert(s.player.roof === 'evolution' && s.player.onDeck && s.player.altitude > 1000 && s.player.mode === 'play', 'on the terrace: ' + JSON.stringify(s.player));
  t.assert(s.bar.live && s.bar.people >= 12 && s.bar.seatsOnDeck, 'the bar is full: ' + JSON.stringify(s.bar));
  // Nobody walks off the terrace, whichever way they head.
  for (let k = 0; k < 8; k++) {
    await t.call('skylineVisit', 'bar');
    await t.call('walk', (k / 8) * Math.PI * 2 + 0.2, 400);
    const p = (await t.call('skyline')).player;
    t.assert(p.roof === 'evolution' && p.onDeck && p.altitude > 1000, 'heading ' + k + ': ' + JSON.stringify(p));
  }
  // The tables talk, one at a time.
  let heard = [];
  for (let i = 0; i < 8 && heard.length < 2; i++) {
    await t.wait(2.5);
    heard = [...new Set(heard.concat((await t.call('skyline')).bar.lines))];
  }
  t.assert(heard.length >= 2, 'conversations on the terrace: ' + JSON.stringify(heard));
  t.note('heard: ' + heard.join(' | '));
  // A drink at the bar.
  await t.call('setCash', 100);
  await t.call('skylineVisit', 'bar-counter');
  await t.wait(0.3);
  prompt = await t.call('promptState');
  t.assert(/ORDER A DRINK/.test(prompt.offered || ''), 'bar prompt: ' + JSON.stringify(prompt));
  await t.call('interact');
  t.assert((await t.call('status')).cash === 55, 'the drink was paid for');
  // And down again.
  await t.call('skylineVisit', 'bar');
  await t.wait(0.3);
  prompt = await t.call('promptState');
  t.assert(/ELEVATOR TO THE STREET/.test(prompt.offered || ''), 'roof prompt: ' + JSON.stringify(prompt));
  await t.call('interact');
  await t.wait(3.2);
  s = await t.call('skyline');
  t.assert(!s.player.roof && s.player.altitude < 5 && s.player.district === 'NORTH POINT KEY', 'back at the lobby: ' + JSON.stringify(s.player));
  // The helideck: up, round the parked helicopter, in, off and back down on the pad.
  await t.call('skylineVisit', 'lobby-helipad');
  await t.wait(0.3);
  await t.call('interact');
  await t.wait(3.2);
  s = await t.call('skyline');
  t.assert(s.player.roof === 'federation-east' && s.player.onDeck, 'on the helideck: ' + JSON.stringify(s.player));
  for (const [heading, distance] of [[Math.PI / 2, 14], [Math.PI, 80], [1.9, 40], [Math.PI / 2, 60]]) await t.call('walk', heading, distance);
  s = await t.call('skyline');
  t.assert(s.player.onDeck && s.player.y > s.helicopter.y, 'walked round the helicopter: ' + JSON.stringify(s.player));
  await t.call('skylineVisit', 'helipad');
  await t.call('walk', Math.PI / 2, 30);
  await t.wait(0.3);
  await t.call('interact');
  let r = await t.call('rooftops');
  t.assert(r.helicopter && r.helicopter.clearance < 1, 'in the helicopter on the pad: ' + JSON.stringify(r.helicopter));
  await t.keys('KeyT', 3);
  r = await t.call('rooftops');
  t.assert(r.helicopter.clearance > 60, 'took off: ' + JSON.stringify(r.helicopter));
  await t.keys('KeyG', 10);
  r = await t.call('rooftops');
  t.assert(r.helicopter.clearance < 1 && r.helicopter.roof > 1900, 'landed back on the pad: ' + JSON.stringify(r.helicopter));
  await t.call('interact');
  s = await t.call('skyline');
  t.assert(s.player.roof === 'federation-east' && s.player.onDeck, 'stepped out onto the deck: ' + JSON.stringify(s.player));
}
