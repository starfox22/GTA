// The hot-path rewrites of the simulation pass keep their answers: hypot2 equals Math.hypot bit for bit, the promenade
// grid's cell mask is exactly the nine-cell neighbourhood of the grid, the solid() helpers rewritten without closures
// (rail, underpass, county, pond ellipse), the rectangle-list cell index and the dense vehicle grid agree with the code
// they replaced, and the long-session report is finite. (The console's audits hold the reference implementations.)
export default async function (t) {
  await t.call('teleport', 748, 584);
  const h = await t.call('hypotAudit', 100000);
  t.assert(h.checked > 100000 && h.bad === 0, 'hypot2 differs from Math.hypot: ' + JSON.stringify(h));
  t.assert(h.msPerMillionHypot2 < h.msPerMillionHypot * 1.5, `hypot2 is not faster: ${h.msPerMillionHypot2} against ${h.msPerMillionHypot} ms per million`);
  const m = await t.call('cellMaskAudit');
  t.assert(m.grid && m.cells > 50 && m.checked > 10000 && m.mismatches === 0, 'cell mask: ' + JSON.stringify(m));
  const s = await t.call('solidAudit', 40000);
  t.assert(s.checked > 100000 && s.bad === 0, 'solid helpers: ' + JSON.stringify(s));
  // A stretch of walking through the real collision code, then the report.
  await t.call('god', true);
  await t.call('walk', 0.7, 400);
  await t.wait(3);
  const r = await t.call('soakReport');
  t.finite(r, 'soakReport');
  t.assert(r.bad.count === 0, 'non-finite positions: ' + JSON.stringify(r.bad));
  t.assert(r.lists.vehicles > 100 && r.lists.pedestrians > 100 && r.lists.staticBodies > 1000, 'lists look empty: ' + JSON.stringify(r.lists).slice(0, 300));
  const a = await t.call('stateHash');
  t.assert(/^[0-9a-f]{16}$/.test(a), 'stateHash: ' + a);
  t.assert((await t.call('seedRandom', 5)) === 5, 'seedRandom');
}
