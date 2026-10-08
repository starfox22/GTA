// The sun and its shadows move gradually (sun-path.js): over a day the shadow light never turns faster than a couple
// of degrees per game minute (the old twilight handover to the moon swung it ~100 degrees in 16 game minutes, 11.7
// deg/min), it never drops under 15 degrees, and a time skip is drawn over a few seconds of frames, not at once.
export const fresh = true;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const angle = (a, b) => (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;
export default async function (t) {
  // The path over a day and a sleep (six hours) drawn from noon.
  await t.call('setClock', 12);
  await sleep(300);
  let r = await t.call('sunReport', 360);
  t.note(`day: max ${r.dayMaxDegPerMin} deg/min (seen ${r.dayMaxSeenDegPerMin} at ${r.dayMaxSeenAt}), lowest ${r.minElevationDeg} deg; sleep: ${JSON.stringify(r.skip)}`);
  t.assert(r.dayMaxDegPerMin < 2.5, `the shadow light turns at most 2.5 deg a game minute: ${r.dayMaxDegPerMin}`);
  t.assert(r.dayMaxSeenDegPerMin < 1.2, `weighted by its strength, at most 1.2 deg a game minute: ${r.dayMaxSeenDegPerMin}`);
  t.assert(r.minElevationDeg >= 15, `the shadow light stays above 15 deg: ${r.minElevationDeg}`);
  t.near(r.skip.seconds, 2, 6.5, 'a six-hour skip is drawn over seconds');
  t.assert(r.skip.maxDegPerFrame < 3, `six-hour skip: under 3 deg a frame: ${r.skip.maxDegPerFrame}`);
  // A skip through the dawn handover (03:00 to 07:00) and a meal's ten minutes.
  await t.call('setClock', 3);
  await sleep(300);
  r = await t.call('sunReport', 240);
  t.note(`dawn skip: ${JSON.stringify(r.skip)}`);
  t.assert(r.skip.maxDegPerFrame < 5, `a skip through dawn: under 5 deg a frame: ${r.skip.maxDegPerFrame}`);
  r = await t.call('sunReport', 10);
  t.assert(r.skip.seconds >= 1.9 && r.skip.maxDegPerFrame < 0.5, `a ten-minute skip blends: ${JSON.stringify(r.skip)}`);
  // Live: wait for the light to settle, jump the clock, and the light holds, then eases over to the new hour.
  await t.call('setClock', 9);
  await sleep(200);
  for (let i = 0; i < 60 && (await t.call('sunReport', 0)).blending; i++) await sleep(500);
  await sleep(300);
  const before = await t.call('sunReport', 0);
  t.assert(!before.blending, `settled before the jump: ${JSON.stringify(before)}`);
  await t.call('setClock', 16);
  await sleep(200); // a few frames (the light clock steps on the frame clock)
  const jumped = await t.call('sunReport', 0);
  t.assert(jumped.blending, `a jump of the clock blends: ${JSON.stringify(jumped)}`);
  t.assert(angle(before.light, jumped.light) < 6, `the light does not jump with the clock: ${before.light} -> ${jumped.light}`);
  let settled = jumped;
  for (let i = 0; i < 60 && settled.blending; i++) {
    await sleep(500);
    settled = await t.call('sunReport', 0);
  }
  t.assert(!settled.blending, `the blend ends: ${JSON.stringify(settled)}`);
  const [hh, mm] = settled.clock.split(':').map(Number);
  t.assert(settled.skipOffset === 0 && Math.abs((settled.litMinutes % 1440) - (hh * 60 + mm)) < 2 && hh === 16, `and lands on the clock: ${settled.litMinutes} at ${settled.clock}`);
  t.assert(angle(before.light, settled.light) > 30, `the light moved to the afternoon: ${before.light} -> ${settled.light}`);
}
