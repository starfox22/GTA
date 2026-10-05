// Sound reaches the speakers (the output meter after the ceiling, with the 6 dB makeup), and M says what it did:
// SOUND OFF with how to turn it back on, then SOUND ON (a silent mute that is saved left players with no sound).
export default async function (t) {
  let mix = await t.call('audioMix');
  t.assert(mix.makeup === 2, 'mix makeup: ' + mix.makeup);
  if (!mix.soundOn) await t.call('settings', { sound: true });
  if (mix.context === 'running') {
    let peak = 0;
    for (let i = 0; i < 12 && peak < 0.004; i++) {
      await t.realWait(0.25);
      peak = Math.max(peak, (await t.call('audioLevel')).peak);
    }
    t.assert(peak >= 0.004, 'nothing reaches the output: peak ' + peak);
  } else t.note(`audio context ${mix.context}: the output meter was not checked`);
  await t.keys('KeyM', 0.1, { real: true });
  await t.realWait(0.6);
  mix = await t.call('audioMix');
  t.assert(mix.soundOn === false, 'M did not mute');
  t.assert(/^SOUND OFF · PRESS M TO TURN IT ON$/.test(mix.soundOffText), 'muted text: ' + mix.soundOffText);
  let notes = await t.call('notices');
  t.assert(notes.some((n) => n.text.startsWith('SOUND OFF')), 'no SOUND OFF notice: ' + JSON.stringify(notes.map((n) => n.text)));
  if (mix.buses) t.assert(mix.buses.mix < 0.05, 'mix bus still open while muted: ' + mix.buses.mix);
  await t.keys('KeyM', 0.1, { real: true });
  await t.realWait(0.6);
  mix = await t.call('audioMix');
  t.assert(mix.soundOn === true && mix.soundOffText === '', 'M did not unmute: ' + JSON.stringify({ on: mix.soundOn, text: mix.soundOffText }));
  notes = await t.call('notices');
  t.assert(notes.some((n) => n.text === 'SOUND ON'), 'no SOUND ON notice: ' + JSON.stringify(notes.map((n) => n.text)));
}
