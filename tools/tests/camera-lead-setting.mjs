// Settings · Driving · Camera look-ahead (driving.js, 0-300 %, default 200 %; camera-drive.js DRIVING FOLLOW): the
// steady lead at 100 km/h on a straight grows with the setting all the way to 300 % (the frame's share is capped at
// leadShareTop of the half height, so the car stays on screen); 0 % leads nothing. Notes the lead in metres and as a
// share of the half frame for each setting.
export const fresh = true;
const KMH = 1 / 3.6;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  await t.call('wanted', 0);
  try {
    const defaults = await t.call('settings');
    t.assert(defaults.lookAhead === 200, 'look-ahead default: ' + defaults.lookAhead);
    await t.call('setZoom', 2);
    const rows = {};
    for (const pct of [0, 100, 150, 200, 300]) {
      await t.call('settings', { lookAhead: pct });
      await t.call('teleport', 420, 4300);
      await t.call('drive', 'sport', 0, Math.PI / 2);
      // A steady 100 km/h south down the runway for six seconds.
      for (let s = 0; s < 6 - 1e-6; s += 0.1) {
        await t.call('launch', 100 * KMH);
        await t.wait(0.1);
      }
      const feel = await t.call('cameraFeel'),
        view = await t.call('cameraView'),
        frameH = Math.min(630, Math.max(430, view.viewport[1] * 0.68)),
        half = frameH / view.framed / 2 / (680 / Math.hypot(680, 560)) / 8,
        want = Math.hypot(feel.want[0], feel.want[1]) / 8;
      rows[pct] = { lead: feel.leadMetres, want: +want.toFixed(1), share: +(feel.leadMetres / half).toFixed(3), half: +half.toFixed(1) };
      t.note(`${pct} %: lead ${feel.leadMetres} m (aims at ${rows[pct].want} m), ${rows[pct].share} of the half frame (${rows[pct].half} m, framed ${view.framed}, ${view.kmh} km/h eased)`);
      await t.call('launch', 0);
      await t.wait(0.3);
      await t.call('interact');
      await t.wait(0.3);
    }
    // A 12 m bus heading up the screen at 300 %: its rear end (6 m behind the middle) stays within 0.7 of the half
    // frame, clear of the pager strip along the bottom (0.73 at 960x600; hud-clearance.mjs).
    await t.call('settings', { lookAhead: 300 });
    await t.call('teleport', 420, 5600);
    await t.call('drive', 'bus', 0, -Math.PI / 2);
    for (let s = 0; s < 6 - 1e-6; s += 0.1) {
      await t.call('launch', 100 * KMH);
      await t.wait(0.1);
    }
    const busFeel = await t.call('cameraFeel'),
      busView = await t.call('cameraView'),
      busHalf = Math.min(630, Math.max(430, busView.viewport[1] * 0.68)) / busView.framed / 2 / (680 / Math.hypot(680, 560)) / 8,
      busRear = +((busFeel.leadMetres + 6) / busHalf).toFixed(3);
    t.note(`bus north at 300 %: lead ${busFeel.leadMetres} m, rear end at ${busRear} of the half frame (${busHalf.toFixed(1)} m)`);
    t.assert(busRear <= 0.71 && busFeel.leadMetres > rows[100].lead, `the bus at 300 %: lead ${busFeel.leadMetres} m, rear at ${busRear}`);
    await t.call('launch', 0);

    t.near(rows[0].lead, 0, 0.3, 'lead at 0 %');
    // 0 % after a turn: the view keeps the vehicle centred whichever way it now drives (the follow's axis turns with
    // the travel; it used to stay on the boarding heading, so the car slid toward the edge it was driving at). Then
    // 200 %: the view stands ahead of the car, which sits back from the middle against the way it drives.
    for (const pct of [0, 200]) {
      await t.call('settings', { lookAhead: pct });
      await t.call('teleport', 420, 4300);
      await t.call('drive', 'sport', 0, Math.PI / 2);
      await t.keys('KeyW,KeyD', 1.2);
      await t.keys('KeyW', 3);
      const feel = await t.call('cameraFeel'),
        st = await t.call('status'),
        off = Math.hypot(feel.offset[0], feel.offset[1]) / 8;
      t.note(`${pct} % after a turn: view ${off.toFixed(1)} m from the car (offset ${feel.offset}, heading ${feel.driveHeading})`);
      if (pct === 0) t.assert(off < 2, `0 %: the car is off centre after a turn by ${off.toFixed(1)} m`);
      else {
        const h = (feel.driveHeading * Math.PI) / 180,
          ahead = (feel.offset[0] * Math.cos(h) + feel.offset[1] * Math.sin(h)) / 8;
        t.assert(ahead > 5, `200 %: the view is not ahead of the car after a turn: ${ahead.toFixed(1)} m`);
      }
      await t.call('interact');
      await t.wait(0.3);
    }
    for (const [a, b] of [
      [100, 150],
      [150, 200],
      [200, 300],
    ])
      t.assert(rows[b].lead > rows[a].lead * 1.15, `${b} % does not lead clearly further than ${a} %: ${rows[b].lead} vs ${rows[a].lead} m`);
    t.assert(rows[300].lead > rows[100].lead * 2.2, `300 % does not reach far: ${rows[300].lead} m vs ${rows[100].lead} m at 100 %`);
    for (const pct of [100, 150, 200, 300]) t.assert(rows[pct].share <= 0.72, `${pct} %: the car leaves the safe part of the frame: ${rows[pct].share}`);
  } finally {
    await t.call('settings', { drivingReset: true });
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
