// Real browser layout of the frozen build's CSS, HUD markup and measurement function.
// This is a DOM fixture; the final native game capture separately proves the in-game result.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('Usage: node tools/hud-dialogue-layout-review.mjs BUILD.html OUT.json');
const html = fs.readFileSync(input, 'utf8'),
  sha = text => crypto.createHash('sha256').update(text).digest('hex'),
  css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n'),
  start = html.indexOf('    const CLEAR_MARGIN = '),
  end = html.indexOf('    /* The player on screen', start),
  functionStart = html.indexOf('    function measureMissionCard() {'),
  functionEnd = html.indexOf('\n    }', functionStart) + 6,
  hudStart = html.indexOf('    <!-- HUD. Layout and motion'),
  hudEnd = html.indexOf('    <div class="overlay" id="menu">', hudStart);
if (start < 0 || end < start || functionStart < 0 || hudStart < 0 || hudEnd < hudStart) throw Error('Frozen production fragments missing');
// The shell's HUD includes all its children before the menus start.
const hud = html.slice(hudStart, hudEnd),
  measurement = html.slice(start, end) + '\n' + html.slice(functionStart, functionEnd),
  report = { pass: false, fixture: 'Frozen production stylesheet, HUD markup and measureMissionCard in a native DOM fixture; no world rendering or gameplay.',
    htmlSha256: sha(html), recorderSha256: sha(fs.readFileSync(new URL(import.meta.url))), cases: [], failures: [] };
const { browser } = await launchBrowser({ label: 'hud-dialogue-layout' });
try {
  for (const [width, height] of [[960, 600], [1000, 700], [1280, 720], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    try {
      await page.setContent('<style>' + css + '\n*,*::before,*::after{animation:none!important;transition:none!important}</style><body>' + hud + '</body>');
      await page.addScriptTag({ content: `(() => {
        const getElement = id => document.getElementById(id), hudNow = () => performance.now() / 1000;
        let viewportWidth = innerWidth, viewportHeight = innerHeight;
        ${measurement}
        window.measureDialogue = () => { cardClear.measuredAt = -1; measureMissionCard(); };
      })();` });
      for (const mode of ['open', 'compact', 'folded-map']) {
        await page.evaluate(({ mode, height }) => {
          const el = id => document.getElementById(id);
          el('pagerLabel').textContent = 'VINNY MORETTI';
          el('missionTitle').textContent = 'Dockside Favor';
          el('missionText').textContent = 'Vinny gave you a mission: pick up Vinny’s marked cargo truck.';
          el('cargoStatus').style.display = '';
          el('missionObjective').textContent = 'PICK UP VINNY’S MARKED CARGO TRUCK';
          el('pager').classList.toggle('compact', mode !== 'open' || height <= 620);
          el('minimapBox').classList.toggle('folded', mode === 'folded-map');
          el('storyLine').textContent = 'Vinny: Take the truck, load three harbor crates, and drive them into the warehouse. Keep the cargo safe and bring it back in one piece.';
          el('storyLine').classList.add('show');
          window.measureDialogue();
        }, { mode, height });
        const result = await page.evaluate(() => {
          const box = id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, l: r.left, t: r.top, r: r.right, b: r.bottom }; },
            subtitle = box('storyLine'), lower = ['pager', 'minimapBox', 'vehicleStats', 'weaponButton'].map(box),
            overlaps = lower.filter(b => Math.min(b.r, subtitle.r) - Math.max(b.l, subtitle.l) > 2 && Math.min(b.b, subtitle.b) - Math.max(b.t, subtitle.t) > 2);
          return { subtitle, lower, overlaps: overlaps.map(b => b.id), onscreen: subtitle.l >= 0 && subtitle.r <= innerWidth && subtitle.t >= 0 && subtitle.b <= innerHeight };
        });
        report.cases.push({ width, height, mode, ...result });
        if (result.overlaps.length || !result.onscreen) report.failures.push({ width, height, mode, ...result });
      }
    } finally { await page.close(); }
  }
  report.pass = report.failures.length === 0;
  console.log(JSON.stringify({ pass: report.pass, cases: report.cases.length, failures: report.failures.length }));
  if (!report.pass) process.exitCode = 1;
} finally {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
