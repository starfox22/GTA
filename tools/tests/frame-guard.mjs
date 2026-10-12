// The frame guard (frame-guard.js): a fault thrown in the live frame's simulation step is caught and logged
// once, and the loop keeps running (requestAnimationFrame used to be booked only after a clean frame).
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', false);
  // How far game time runs in 3 s of real time on this page, before any fault.
  const b0 = (await t.call('frameFaults')).gameTime;
  await t.realWait(3);
  const f0 = await t.call('frameFaults');
  const base = f0.gameTime - b0;
  await t.call('frameFaultDrill', 'update');
  await t.realWait(1.5);
  const f1 = await t.call('frameFaults');
  t.note(JSON.stringify(f1));
  t.assert(f1.count === f0.count + 1 && f1.kinds.some((k) => k.where === 'update' && /drill/.test(k.message)), 'the update drill was not caught once: ' + JSON.stringify(f1));
  // The live loop still runs after the fault: game time moves in real time.
  await t.realWait(3);
  const f2 = await t.call('frameFaults');
  const after = f2.gameTime - f1.gameTime;
  t.note(`game time in 3 s: ${base.toFixed(2)} before, ${after.toFixed(2)} after the fault`);
  t.assert(after > 0.5 * base && after > 0.05, 'the frame loop stopped after a caught fault: ' + base + ' → ' + after);
  t.assert(f2.count === f1.count, 'faults kept coming after the drill');
  // The no-render page never draws, so a draw drill stays armed: disarm it again.
  t.assert((await t.call('frameFaultDrill', 'none')) === null, 'drill not disarmed');
}
