// Opening the canopy inside a cloud: a jump into a cumulus (cloudJump), the pull deep in
// the cloud, the deployment runs its stages there as anywhere (same timings, same forecast),
// the canopy flies out of the base (immersion falls away under it) and lands safely. With
// WebGL (render page) the camera goes from the freefall veil to the canopy's over the
// opening, never jumping from one to the other.
export const fresh = true;

const CITY = [748, 584];

export default async function (t) {
  await t.call('teleport', ...CITY);
  await t.call('holdSimulation', true);
  try {
    await t.call('sky', 'cloudy');
    const jump = await t.call('cloudJump', 950, 'cloud');
    t.assert(jump && jump.parachute && jump.parachute.stage === 'freefall', `cloudJump: ${JSON.stringify(jump)}`);
    // Fall until well inside the cloud (and fast), then pull.
    let layer = null;
    for (let i = 0; i < 80; i++) {
      await t.wait(0.25);
      layer = await t.call('cloudLayer');
      if (layer.immersion > 0.6 && layer.altitudeM < layer.topM - 40) break;
    }
    t.assert(layer.immersion > 0.6, `in the cloud before the pull: ${JSON.stringify(layer)}`);
    const pulled = await t.call('openParachute');
    t.assert(pulled.stage === 'canopy' && pulled.descentMs > 45, `pulled in cloud at speed: ${JSON.stringify(pulled)}`);
    const forecast = pulled.cue?.needM;
    t.note(`pulled at ${pulled.altitudeM} m in cloud ${layer.baseM}-${layer.topM} m (immersion ${layer.immersion})`);
    // The stages in order, inside the cloud; on the render page the veil blends over them.
    const caps = [];
    for (const phase of ['lines', 'snivel', 'snap', 'open']) {
      const s = await t.call('parachuteFallTo', phase);
      t.assert(s.phase === phase, `reached ${phase}: ${JSON.stringify(s)}`);
      const view = (await t.call('cloudLayer')).view;
      if (view && view.veil.cap) caps.push(view.veil.cap);
    }
    const open = await t.call('parachuteState');
    t.near(open.openTimeS, 4, 5, 'pull to fully open in cloud (s)');
    t.near(open.openLostM, 150, 250, 'height lost opening in cloud (m)');
    t.near(open.peakLoadG, 3, 4, 'opening shock in cloud (g)');
    const inside = await t.call('cloudLayer');
    t.note(`open at ${open.altitudeM} m, immersion ${inside.immersion}${caps.length ? `, veil caps ${caps.join(' ')}` : ''}`);
    for (let i = 1; i < caps.length; i++)
      t.assert(caps[i] <= caps[i - 1] + 0.001 && caps[i - 1] - caps[i] < 0.06, `the veil eases from freefall to canopy: ${caps.join(', ')}`);
    // Under the canopy it comes out of the base: the cloud falls away around the jumper.
    let out = inside;
    for (let i = 0; i < 60 && out.altitudeM > out.baseM - 30; i++) {
      await t.call('parachuteFallTo', Math.max(40, out.altitudeM - out.area.groundM - 20));
      out = await t.call('cloudLayer');
    }
    t.assert(out.altitudeM < out.baseM && out.immersion < 0.2, `out under the base: ${JSON.stringify(out)}`);
    // And down safely.
    for (let i = 0; i < 4; i++) if ((await t.call('parachuteFallTo', 0)).landed) break;
    const f = await t.call('fallState');
    t.assert(f.mode === 'play' && f.hp === 100, `landed safely after a cloud opening: ${f.mode} hp ${f.hp}`);
    if (forecast) t.note(`forecast at the pull ${forecast} m`);
  } finally {
    await t.call('holdSimulation', false);
    await t.call('teleport', ...CITY);
    await t.call('sky');
  }
}
