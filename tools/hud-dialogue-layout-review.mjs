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
  remeasureStart = html.indexOf('    function remeasureMissionCard() {'),
  remeasureEnd = html.indexOf('\n    }', remeasureStart) + 6,
  meetStart = html.indexOf('    function clearBoxesMeet('),
  meetEnd = html.indexOf('\n    }', meetStart) + 6,
  promptStart = html.indexOf('    const PROMPT_MIN_SHOW = '),
  promptEnd = html.indexOf('\n    }', html.indexOf('    function watchDockLine() {', promptStart)) + 6,
  hudStart = html.indexOf('    <!-- HUD. Layout and motion'),
  hudEnd = html.indexOf('    <div class="overlay" id="menu">', hudStart);
if (start < 0 || end < start || functionStart < 0 || hudStart < 0 || hudEnd < hudStart) throw Error('Frozen production fragments missing');
// The shell's HUD includes all its children before the menus start.
const hud = html.slice(hudStart, hudEnd),
  measurement = html.slice(start, end) + '\n' + html.slice(meetStart, meetEnd) + '\n' + html.slice(functionStart, functionEnd) + '\n' + html.slice(remeasureStart, remeasureEnd),
  prompts = html.slice(promptStart, promptEnd),
  report = { pass: false, fixture: 'Frozen production stylesheet, HUD markup and measureMissionCard in a native DOM fixture; no world rendering or gameplay.',
    htmlSha256: sha(html), recorderSha256: sha(fs.readFileSync(new URL(import.meta.url))), cases: [], failures: [] };
const { browser } = await launchBrowser({ label: 'hud-dialogue-layout' });
try {
  for (const [width, height] of [[960, 600], [1000, 700], [1280, 720], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    try {
      await page.setContent('<style>' + css + '\n*,*::before,*::after{animation:none!important;transition:none!important}</style><body>' + hud + '</body>');
      await page.addScriptTag({ content: `(() => {
        let hudTime = 0;
        const getElement = id => document.getElementById(id), hudNow = () => hudTime,
          keyName = () => 'E', flightHud = {shown: false}, gameMode = 'play';
        let viewportWidth = innerWidth, viewportHeight = innerHeight;
        ${measurement}
        ${prompts}
        window.measureDialogue = (active, terrain, timed) => {
          hudTime = 0;
          const el = getElement('interaction');
          promptView.id = null;
          promptView.docked = promptView.clearanceDock = false;
          el.classList.remove('show', 'docked', 'clearance-dock');
          getElement('terrainStatus').style.display = terrain ? 'block' : 'none';
          getElement('terrainStatus').textContent = 'SUMMIT RIDGE · TREKKING';
          clearPromptOffer();
          if (active) offerPrompt('DIG AT THE MARK · 28%', {hold: true});
          commitPrompt();
          if (timed) hudTime = 4;
          for (let i = 0; i < 4; i++) {
            cardClear.measuredAt = -1;
            measureMissionCard();
            commitPrompt();
            watchDockLine();
            measureDockLine();
          }
          return {docked: promptView.docked, age: hudNow() - promptView.freshAt};
        };
      })();` });
      for (const view of ['street', 'chase']) for (const scene of ['opening', 'package', 'gate', 'records'])
        for (const mode of ['open', 'compact', 'folded-map']) for (const prompt of ['none', 'fresh', 'terrain', 'docked-terrain']) {
        const promptState = await page.evaluate(({ mode, height, prompt, view, scene }) => {
          const el = id => document.getElementById(id);
          document.body.classList.toggle('chase-view', view === 'chase');
          el('district').textContent = scene === 'gate' || scene === 'records' ? 'FORT SENTINEL · RESTRICTED' : 'RIDGELINE COUNTY';
          el('streetName').textContent = '';
          el('navigation').style.display = '';
          el('navTitle').textContent = scene === 'gate' || scene === 'records' ? 'WALK UP TO FORT SENTINEL’S GATE · SHOW YOUR ID' : 'BRING THE PACKAGE TO VINNY’S WAREHOUSE';
          el('navDistance').textContent = 'OBJECTIVE · 1252 m';
          const hints = scene === 'gate' || scene === 'records'
            ? [['WASD', 'WALK'], ['SHIFT', 'RUN'], ['E', 'INTERACT'], ['?', 'CONTROLS']]
            : [['WASD', 'RUN'], ['SHIFT', 'WALK'], ['SPACE', 'JUMP'], ['E', 'INTERACT'], ['F', 'FIRE'], ['?', 'CONTROLS']];
          el('quickKeys').replaceChildren(...hints.map(([binding, label]) => {
            const item = document.createElement('span'), key = document.createElement('kbd');
            key.textContent = binding;
            item.append(key, ' ' + label);
            return item;
          }));
          el('pagerLabel').textContent = 'VINNY MORETTI';
          el('missionTitle').textContent = 'Dockside Favor';
          el('missionText').textContent = 'Vinny gave you a mission: pick up Vinny’s marked cargo truck.';
          el('cargoStatus').style.display = scene === 'opening' ? '' : 'none';
          el('missionObjective').textContent = 'PICK UP VINNY’S MARKED CARGO TRUCK';
          el('pager').classList.toggle('compact', mode !== 'open' || height <= 620);
          el('minimapBox').classList.toggle('folded', mode === 'folded-map');
          el('storyLine').textContent = scene === 'package'
            ? 'Vinny: Got the case? Good. Leave the vehicle if you have to. Just bring me the package.'
            : scene === 'gate' ? 'GATE SERGEANT: Sir, ID, please.'
            : scene === 'records' ? 'Vinny: You’re in. Walk like you’ve been there two years. Side door at the far end of headquarters, not the main entrance. And don’t touch their trucks: you take one, you’ve got the whole army on you.'
            : 'Vinny: Take the truck, load three harbor crates, and drive them into the warehouse. Keep the cargo safe and bring it back in one piece.';
          el('storyLine').classList.add('show');
          return window.measureDialogue(prompt !== 'none', prompt.includes('terrain'), prompt === 'docked-terrain');
        }, { mode, height, prompt, view, scene });
        const result = await page.evaluate(({prompt}) => {
          const box = id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, l: r.left, t: r.top, r: r.right, b: r.bottom }; },
            subtitle = box('storyLine'), lower = ['pager', 'quickKeys', 'minimapBox', 'vehicleStats', 'weaponButton'].map(box),
            overlaps = lower.filter(b => Math.min(b.r, subtitle.r) - Math.max(b.l, subtitle.l) > 2 && Math.min(b.b, subtitle.b) - Math.max(b.t, subtitle.t) > 2);
          const interaction = box('interaction'), terrain = box('terrainStatus'),
            meet = (a,b) => Math.min(a.r,b.r)-Math.max(a.l,b.l)>2 && Math.min(a.b,b.b)-Math.max(a.t,b.t)>2;
          if (prompt !== 'none' && meet(interaction, subtitle)) overlaps.push(interaction);
          if (prompt.includes('terrain') && meet(interaction, terrain)) overlaps.push(terrain);
          const location = box('hudLocation'), navigation = box('navigation'), district = box('district'),
            name = document.getElementById('district');
          if (meet(location, navigation)) overlaps.push(location);
          const visible = id => { const e = document.getElementById(id), c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0; },
            textFits = name.scrollWidth <= name.clientWidth + 1 && name.scrollHeight <= name.clientHeight + 1;
          return { subtitle, lower, interaction, terrain, location, navigation, district, textFits,
            visible: ['storyLine', 'quickKeys', 'hudLocation', 'navigation'].every(visible), overlaps: overlaps.map(b => b.id), onscreen: subtitle.l >= 0 && subtitle.r <= innerWidth && subtitle.t >= 0 && subtitle.b <= innerHeight };
        }, {prompt});
        report.cases.push({ width, height, view, scene, mode, prompt, promptState, ...result });
        if (result.overlaps.length || !result.onscreen || !result.visible || !result.textFits) report.failures.push({ width, height, view, scene, mode, prompt, ...result });
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
