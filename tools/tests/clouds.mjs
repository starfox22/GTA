// Cloud layer (clouds.js): the base by weather (fair at or under ~420 m, overcast about 300 m)
// and by area (lower over the sea and, in the wet, down to the Ridgeline's summits), the
// in-cloud amount (the heart of a cloud, above the tops, under a fair base), and a jump into
// a cloud (cloudJump) putting the jumper in cloud on the way down. With WebGL (render page)
// the camera's in-cloud state engages too.
const CITY = [748, 584],
  SEA = [-4600, -7600],
  ASCENT = [7760, 1090];
export default async function (t) {
  try {
    await t.call('holdSimulation', true);
    await t.call('sky', 'fair');
    const fair = await t.call('cloudLayer', ...CITY);
    t.near(fair.baseM, 340, 420, 'fair base over the city (m)');
    t.near(fair.topM - fair.baseM, 250, 550, 'fair cumulus depth (m)');
    const fairSea = await t.call('cloudLayer', ...SEA);
    t.assert(fairSea.baseM < fair.baseM - 15, `fair: sea base ${fairSea.baseM} m not under the city's ${fair.baseM} m`);
    await t.call('sky', 'overcast');
    const overcast = await t.call('cloudLayer', ...CITY);
    t.near(overcast.weatherBaseM, 290, 310, 'overcast base, weather alone (m)');
    t.near(overcast.baseM, 285, 320, 'overcast base over the city (m)');
    const peak = await t.call('cloudLayer', ...ASCENT);
    t.near(peak.baseM - peak.area.groundM, -40, 60, 'overcast base over MOUNT ASCENT against its summit (m)');
    t.note(`fair ${fair.baseM}-${fair.topM} m (sea ${fairSea.baseM} m), overcast ${overcast.baseM}-${overcast.topM} m, Mount Ascent ${peak.baseM} m`);
    // In and out of a cloud.
    await t.call('sky', 'cloudy');
    const spot = await t.call('cloudSpot', 'cloud');
    const layer = await t.call('cloudLayer', spot.x, spot.y);
    const inside = await t.call('cloudLayer', spot.x, spot.y, layer.baseM + (layer.topM - layer.baseM) * 0.25);
    t.assert(inside.amount > 0.5, `in the heart of a cloud: amount ${inside.amount} (cover ${inside.cover})`);
    const above = await t.call('cloudLayer', spot.x, spot.y, layer.topM + 30);
    t.assert(above.amount === 0, `above the tops: amount ${above.amount}`);
    await t.call('sky', 'fair');
    const under = await t.call('cloudLayer', spot.x, spot.y, fair.baseM - 40);
    t.assert(under.amount === 0, `under a fair base: amount ${under.amount}`);
    // A jump into a cloud: in cloud somewhere between the top and the base.
    await t.call('teleport', ...CITY);
    const jump = await t.call('cloudJump', 820, 'cloud');
    t.assert(jump && jump.parachute && jump.parachute.stage === 'freefall', `cloudJump: ${JSON.stringify(jump?.parachute)}`);
    let deepest = 0,
      view = null;
    for (let i = 0; i < 26; i++) {
      await t.wait(0.5);
      const r = await t.call('cloudLayer');
      deepest = Math.max(deepest, r.immersion);
      if (r.view && r.view.inCloud > (view?.inCloud ?? -1)) view = r.view;
      if (r.altitudeM < r.baseM - 30) break;
    }
    t.assert(deepest > 0.3, `the jumper never got into the cloud (immersion ${deepest})`);
    if (view) t.assert(view.inCloud > 0.3 && view.veil.cap > 0, `camera in cloud: ${JSON.stringify(view)}`);
    t.note(`jump over (${jump.spot.x}, ${jump.spot.y}): immersion ${deepest.toFixed(2)}${view ? `, camera in cloud ${view.inCloud}` : ''}`);
  } finally {
    await t.call('holdSimulation', false);
    await t.call('teleport', ...CITY);
    await t.call('sky');
  }
}
