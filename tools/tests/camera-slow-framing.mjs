// SLOW FRAMING (world-view.js) and Settings · Driving · Walking camera distance: below 30 km/h a road vehicle or boat
// frames exactly like walking (boarding at rest keeps the walking zoom); from 31 km/h it eases out to the vehicle's
// framing (CAMERA CONTEXT × Vehicle camera distance × the speed pull-back), and comes back in only after a second held
// under 30 km/h. The walking distance is a factor on the on-foot framing (100 % = today's view exactly) and so on the
// slow vehicle's; Motion comfort keeps its one fixed vehicle zoom.
export const fresh = true;
const KMH = 1 / 3.6;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  await t.call('wanted', 0);
  try {
    const defaults = await t.call('settings');
    t.assert(defaults.walkDistance === 100, 'walking camera distance default: ' + defaults.walkDistance);
    await t.call('settings', { cameraDistance: 100 });
    await t.call('teleport', 420, 4400);
    await t.call('setZoom', 2);
    await t.wait(1);
    const foot = await t.call('cameraView');
    t.near(foot.context, 1, 1, 'on-foot context at 100 %');
    t.near(foot.aim, 2, 2, 'on-foot aim at 100 %');

    // Boarding at rest keeps the walking framing: no zoom change at all.
    await t.call('drive', 'sedan', 0, Math.PI / 2);
    await t.wait(2);
    const parked = await t.call('cameraView');
    t.assert(parked.slowFraming, 'a parked car is not framed like walking: ' + JSON.stringify(parked));
    t.near(parked.context, 1, 1, 'parked car context = on foot');
    t.near(parked.aim, foot.aim, foot.aim, 'parked car aim = on foot');
    t.near(parked.framed, foot.aim - 0.005, foot.aim + 0.005, 'parked car framed 2 s after boarding');
    t.near(parked.vehicleContext, 0.56, 0.56, 'the car share it eases to at speed');

    // Hold a speed (launch keeps the car at it) for some game seconds.
    const hold = async (kmh, seconds) => {
      for (let s = 0; s < seconds - 1e-6; s += 0.1) {
        await t.call('launch', kmh * KMH);
        await t.wait(0.1);
      }
      return t.call('cameraView');
    };
    // 20 km/h: still the walking framing (no pull-back either).
    const slow = await hold(20, 2);
    t.assert(slow.slowFraming, 'walking framing lost at 20 km/h: ' + JSON.stringify(slow));
    t.near(slow.aim, foot.aim, foot.aim, 'aim at 20 km/h = on foot');
    t.near(slow.speed, 1, 1, 'no pull-back at 20 km/h');

    // 40 km/h: the vehicle's framing, eased (no snap).
    const just = await hold(40, 0.1);
    const fast = await hold(40, 3);
    t.assert(!fast.slowFraming, 'still the walking framing at 40 km/h: ' + JSON.stringify(fast));
    t.near(fast.context, 0.56, 0.56, 'context at 40 km/h = the car share');
    t.near(fast.aim, 2 * 0.56 * fast.speed - 0.003, 2 * 0.56 * fast.speed + 0.003, 'aim at 40 km/h = vehicle framing × pull-back');
    t.assert(just.framed > 1.9, `the framing snapped out: ${just.framed} a tenth after passing 31 km/h`);
    t.assert(fast.framed < 1.9 && fast.framed > fast.aim, `the framing did not ease out: ${fast.framed} (aim ${fast.aim})`);

    // Between 30 and 31: no change either way (hysteresis); under 30 for less than a second: still out.
    const mid = await hold(30.5, 1.5);
    t.assert(!mid.slowFraming, 'the framing came back in at 30.5 km/h');
    const brief = await hold(20, 0.6);
    t.assert(!brief.slowFraming, 'the framing came back in after 0.6 s under 30 km/h');
    const back = await hold(20, 0.8);
    t.assert(back.slowFraming && back.aim === foot.aim, 'the framing did not come back in after 1.4 s under 30 km/h: ' + JSON.stringify(back));

    // Walking camera distance: a factor on the on-foot framing and the slow vehicle's.
    await t.call('settings', { walkDistance: 125 });
    const slowFar = await t.call('cameraView');
    t.near(slowFar.context, 0.8, 0.8, 'slow car context at 125 % walking distance');
    t.near(slowFar.aim, 1.6, 1.6, 'slow car aim at 125 % walking distance');
    await t.call('launch', 0);
    await t.wait(0.3);
    await t.call('interact');
    await t.wait(1);
    const footFar = await t.call('cameraView');
    t.assert(footFar.walkDistance === 125, 'walking distance reported: ' + footFar.walkDistance);
    t.near(footFar.context, 0.8, 0.8, 'on-foot context at 125 %');
    t.near(footFar.aim, 1.6, 1.6, 'on-foot aim at 125 %');
    await t.call('settings', { walkDistance: 60 });
    const footNear = await t.call('cameraView');
    t.near(footNear.aim, 2 / 0.6 - 0.002, 2 / 0.6 + 0.002, 'on-foot aim at 60 %');
    await t.call('settings', { walkDistance: 100 });
    const footBack = await t.call('cameraView');
    t.near(footBack.aim, 2, 2, 'on-foot aim back at 100 %');

    // Motion comfort: no slow framing, the vehicle holds its one fixed zoom from boarding.
    await t.call('settings', { motionComfort: true });
    await t.call('teleport', 420, 4400);
    await t.call('drive', 'sedan', 0, Math.PI / 2);
    await t.wait(0.5);
    const steady = await t.call('cameraView');
    t.assert(!steady.slowFraming, 'slow framing with motion comfort on');
    t.near(steady.context, 0.56, 0.56, 'motion comfort context at rest');
    t.near(steady.speed, 0.86, 0.86, 'motion comfort framing at rest');
    t.note(`foot ${foot.aim}; parked ${parked.aim}; 20 km/h ${slow.aim}; 40 km/h aim ${fast.aim} framed ${fast.framed} (0.1 s after the switch ${just.framed}); walk 125 % ${footFar.aim}, 60 % ${footNear.aim}`);
  } finally {
    await t.call('settings', { motionComfort: false, drivingReset: true });
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
