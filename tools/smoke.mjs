// Headless smoke test: boots the built HTML in Chromium, starts a game, drives
// the player for a few seconds and reports console errors plus screenshots.
//   node tools/smoke.mjs [dead-end-city.html] [outdir]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';

const file = path.resolve(process.argv[2] || 'dead-end-city.html');
const out = path.resolve(process.argv[3] || 'dist/smoke');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
const logs = [];
page.on('console', (m) => { const t = m.type(); const s = `[${t}] ${m.text()}`; logs.push(s); if (t === 'error' || t === 'warning') errors.push(s); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '')));

// The built page is a single ~15MB file; waiting on the load event is flaky at
// that size, so commit the navigation and wait for the game's own API instead.
await page.goto('file://' + file, { timeout: 300000, waitUntil: 'commit' });
// Poll for the game's own API rather than waiting on a frame-driven predicate:
// under a software renderer the page can take minutes of wall time to settle.
for (let i = 0; ; i++) {
  if (await page.evaluate(() => !!window.DeadEndCity).catch(() => false)) break;
  if (i > 120) throw new Error('game never booted');
  await page.waitForTimeout(3000);
}
await page.waitForTimeout(2500);
await page.screenshot({ timeout: 120000, path: path.join(out, '01-menu.png') });
await page.click('#startBtn');
await page.waitForTimeout(3000);
await page.screenshot({ timeout: 120000, path: path.join(out, '02-start.png') });

// Walk around, then steal a car and drive.
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
await hold('KeyW', 1500);
await hold('KeyD', 600);
await page.screenshot({ timeout: 120000, path: path.join(out, '03-walk.png') });
await page.keyboard.press('KeyE');
await page.waitForTimeout(800);
await hold('KeyW', 3000);
await page.screenshot({ timeout: 120000, path: path.join(out, '04-drive.png') });
await page.keyboard.press('Tab');
await page.waitForTimeout(800);
await page.screenshot({ timeout: 120000, path: path.join(out, '05-map.png') });
await page.keyboard.press('Tab');

const stats = await page.evaluate(() => ({
  ua: navigator.userAgent,
  webgl: (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })(),
  badge: document.getElementById('renderBadge')?.textContent,
  district: document.getElementById('district')?.textContent,
}));
fs.writeFileSync(path.join(out, 'console.log'), logs.join('\n'));
console.log(JSON.stringify(stats, null, 2));
console.log(`console lines: ${logs.length}, errors/warnings: ${errors.length}`);
for (const e of errors.slice(0, 40)) console.log(e);
await browser.close();
