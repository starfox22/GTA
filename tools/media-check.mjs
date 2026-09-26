// Streamed-media check for a split build (build.py --split-media or --zip):
// opens the page from file:// and plays every streamed track (the radio music,
// media/*.mp3) through an <audio> element until it fires `canplay`.
//   node tools/media-check.mjs <dir>/index.html
// Exits 1 if any track fails to load. Only needs the page's media blocks, so it
// does not wait for the game to boot.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';

const file = path.resolve(process.argv[2] || 'dist/publish/index.html');
if (!fs.existsSync(file)) { console.error('missing ' + file + ': build it first (python3 tools/build.py --split-media DIR)'); process.exit(1); }
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.goto('file://' + file, { timeout: 300000, waitUntil: 'domcontentloaded' });
const results = await page.evaluate(async () => {
  const blocks = [...document.querySelectorAll('script[data-src]')];
  const one = (src) => new Promise((resolve) => {
    const a = new Audio();
    const done = (ok, why) => { a.removeAttribute('src'); a.load(); resolve({ src, ok, why }); };
    a.addEventListener('canplay', () => done(true, 'canplay (' + a.duration.toFixed(0) + ' s)'), { once: true });
    a.addEventListener('error', () => done(false, 'error ' + (a.error && a.error.code)), { once: true });
    setTimeout(() => done(false, 'timeout'), 20000);
    a.src = src;
  });
  const out = [];
  for (const b of blocks) out.push(await one(b.dataset.src));
  return { href: location.href, out };
});
await browser.close();
console.log('page', results.href);
for (const r of results.out) console.log((r.ok ? 'ok   ' : 'FAIL ') + r.src + '  ' + r.why);
const bad = results.out.filter((r) => !r.ok).length;
console.log(`${results.out.length} streamed tracks, ${bad} failed`);
process.exit(bad || !results.out.length ? 1 : 0);
