// Headlights on slopes (terrain-headlights.js): a 4x4's beams aim with the body as it sits
// on the Mount Ascent trail (up a steady climb, short of a crest, down a far side), the road
// ahead lies in the lit band of the low beam where the old level frame put it out of the
// beam, the ground past a crest is hidden by it (terrain horizon), and on a city street
// the frame is level and matches the old one.
export const fresh = true;

/* Spots on the Mount Ascent trail, read off its graded path (trailProfile: [sample, x, y, height,
   grade, mud, rock]) so the test follows the trail when it is re-laid: a steady straight climb, the
   same climb from its top facing down, and a spot a few metres short of a crest, each where the path
   runs straight ahead (the probes are cast along the body) over no rock. Each is [x, y, heading]. */
async function trailSpots(t) {
  const p = await t.call('trailProfile', 0, 1),
    n = p.length,
    M = 8,
    dist = [0];
  for (let k = 1; k < n; k++) dist[k] = dist[k - 1] + Math.hypot(p[k][1] - p[k - 1][1], p[k][2] - p[k - 1][2]);
  const heading = (k) => Math.atan2(p[k + 1][2] - p[k][2], p[k + 1][1] - p[k][1]),
    spot = (k) => [p[k][1], p[k][2], heading(k)],
    ahead = (k, metres) => {
      let j = k;
      while (j < n - 1 && dist[j] - dist[k] < metres * M) j++;
      return j;
    };
  // The path from sample k runs within `slack` m of the line along its heading for `metres`, every
  // sample meeting `ok`, with no rock.
  function straightRun(k, metres, ok, slack = 1.5) {
    const h = heading(k),
      c = Math.cos(h),
      s = Math.sin(h),
      end = ahead(k, metres);
    if (dist[end] - dist[k] < metres * M) return false;
    for (let j = k; j <= end; j++) {
      if (!ok(p[j]) || p[j][6] !== 0) return false;
      if (Math.abs(-(p[j][1] - p[k][1]) * s + (p[j][2] - p[k][2]) * c) > slack * M) return false;
    }
    return true;
  }
  let uphill = null,
    downhill = null,
    crest = null;
  for (let k = 4; k < n - 4 && !(uphill && downhill && crest); k++) {
    if (!uphill && straightRun(k, 14, (q) => q[4] >= 0.18 && q[4] <= 0.32)) {
      uphill = spot(k);
      // Downhill: the same straight climb, from its top facing back down it (the hand-laid trail
      // winds, and its own steep descents are too short and too near their crests to probe 10 m).
      const top = ahead(k, 14);
      downhill = [p[top][1], p[top][2], heading(k) + Math.PI];
    }
    // Short of a crest: within 3 m of straight for 20 m, climbing to a top 3-6 m ahead, falling away by 15 m.
    if (!crest && straightRun(k, 20, () => true, 3) && p[k][4] > 0.12) {
      const top = ahead(k, 3);
      let c = top;
      while (c < ahead(k, 6) && p[c][4] > 0) c++;
      if (p[c][4] <= 0 && p[ahead(k, 15)][4] < -0.08) crest = spot(k);
    }
  }
  return { uphill, downhill, crest };
}

async function place(t, [x, y, heading]) {
  await t.call('placeVehicle', x, y, heading);
  // One physics step poses the body on the ground (terrainVehiclePose).
  await t.wait(0.05);
  const aim = await t.call('headlightAim', [5, 10, 20, 30, 40]);
  t.finite(aim, 'headlightAim');
  return aim;
}

export default async function (t) {
  await t.call('holdSimulation', true);
  const TRAIL = await trailSpots(t);
  t.note(`spots: ${JSON.stringify(TRAIL)}`);
  t.assert(TRAIL.uphill && TRAIL.downhill && TRAIL.crest, 'the trail has no steady climb, descent or crest: ' + JSON.stringify(TRAIL));
  await t.call('teleport', TRAIL.uphill[0], TRAIL.uphill[1]);
  await t.call('drive', 'expedition');
  const at = (aim, m) => aim.probes.find((p) => p.m === m);

  // Up the climb: pitched up, the aim follows the pitch, the road ahead is lit like a level road.
  const up = await place(t, TRAIL.uphill);
  t.note(`uphill: ${JSON.stringify(up)}`);
  t.near(up.pitchDeg, 10, 20, 'uphill pitch (deg)');
  t.near(up.aim[2], Math.sin((up.pitchDeg * Math.PI) / 180) - 0.02, Math.sin((up.pitchDeg * Math.PI) / 180) + 0.02, 'uphill aim follows the pitch');
  t.near(up.lampOverGroundM, 0.9, 1.4, 'uphill lamp height over the ground (m)');
  t.assert(up.horizon, 'uphill: the terrain horizon is on');
  for (const m of [5, 10]) {
    const p = at(up, m);
    t.near(p.v, -0.25, -0.012, `uphill ${m} m: ground below the cut-off in the body frame`);
    t.assert(p.vLevel > p.v + 0.08, `uphill ${m} m: the level frame aimed ${p.vLevel} (body ${p.v})`);
    t.near(p.lit, 0.9, 1, `uphill ${m} m: in the clear`);
  }

  // Down the far side: pitched down, the road ahead still in the lit band.
  const down = await place(t, TRAIL.downhill);
  t.note(`downhill: ${JSON.stringify(down)}`);
  t.near(down.pitchDeg, -20, -10, 'downhill pitch (deg)');
  t.near(down.aim[2], Math.sin((down.pitchDeg * Math.PI) / 180) - 0.02, Math.sin((down.pitchDeg * Math.PI) / 180) + 0.02, 'downhill aim follows the pitch');
  for (const m of [5, 10]) {
    const p = at(down, m);
    t.near(p.v, -0.25, -0.012, `downhill ${m} m: ground below the cut-off in the body frame`);
    t.assert(p.vLevel < p.v - 0.08, `downhill ${m} m: the level frame aimed ${p.vLevel} (body ${p.v})`);
    t.near(p.lit, 0.9, 1, `downhill ${m} m: in the clear`);
  }

  // Short of a crest: the near road is lit, the ground falling away beyond it is hidden.
  const crest = await place(t, TRAIL.crest);
  t.note(`crest: ${JSON.stringify(crest)}`);
  t.near(at(crest, 5).lit, 0.9, 1, 'crest: the near road is lit');
  t.assert(at(crest, 20).lit < 0.2, `crest: ground past the crest hidden (${at(crest, 20).lit} at 20 m)`);

  // A city street: level, no horizon, the same beam coordinates as the old frame.
  // (The god-mode teleport moves the car with its driver onto the nearest road.)
  const city = await t.call('godTeleport', 2300, 1800);
  t.assert(city.kind === 'road' && city.vehicle?.type === 'expedition', `city: ${JSON.stringify(city)}`);
  await t.wait(0.05);
  const flat = await t.call('headlightAim', [10, 20, 30]);
  t.finite(flat, 'headlightAim (city)');
  t.assert(flat.pitchDeg === 0 && flat.rollDeg === 0 && flat.aim[2] === 0, `city: level (${flat.pitchDeg}, ${flat.rollDeg}, ${flat.aim})`);
  t.assert(!flat.horizon, 'city: no terrain horizon');
  for (const p of flat.probes) t.assert(Math.abs(p.v - p.vLevel) < 0.002 && p.lit === 1, `city ${p.m} m: v ${p.v} vs ${p.vLevel}, lit ${p.lit}`);
  await t.call('holdSimulation', false);
}
