// Default visibility, persisted opt-out and real frame sampling (excluding loading/hidden time).
import fs from 'node:fs';
import vm from 'node:vm';

export const fresh = true;
export default async function (t) {
  const source = fs.readFileSync(new URL('../../src/game-loop.js', import.meta.url), 'utf8');
  const counterSource = source.slice(source.indexOf('    const fpsMeter'), source.indexOf('    /**\n     * FRAME LIMITER'));
  function fixture(saved, blocked = false) {
    const classes = new Set(['hidden']);
    const el = { textContent: '', classList: {
      toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
      remove(name) { classes.delete(name); },
    } };
    const listeners = {};
    const document = { hidden: false, addEventListener(name, fn) { listeners[name] = fn; } };
    const context = vm.createContext({ document, getElement: () => el, localStorage: {
      getItem() { if (blocked) throw new Error('storage blocked'); return saved; },
      setItem(key, value) { if (blocked) throw new Error('storage blocked'); saved = value; },
    } });
    const api = vm.runInContext(counterSource + '\n({ updateFpsCounter, toggleFpsCounter })', context);
    return { api, el, document, listeners, classes, saved: () => saved };
  }
  for (const saved of [null, 'on', 'invalid']) {
    const f = fixture(saved);
    t.assert(!f.classes.has('hidden'), `FPS default hidden with saved=${saved}`);
  }
  t.assert(fixture('off').classes.has('hidden'), 'explicit saved opt-out ignored');
  const blocked = fixture(null, true);
  t.assert(!blocked.classes.has('hidden'), 'blocked storage disabled FPS');
  blocked.api.toggleFpsCounter();
  t.assert(blocked.classes.has('hidden'), 'toggle failed with blocked storage');
  const f = fixture(null);
  // A minute of boot time must not look like a minute-long frame.
  f.api.updateFpsCounter(60000);
  t.assert(f.el.textContent === '-- FPS', 'boot time entered the first FPS sample');
  for (let n = 1; n <= 30; n++) f.api.updateFpsCounter(60000 + n * 1000 / 60);
  t.assert(f.el.textContent === '60 FPS · 16.7 ms', `wrong live frame sample: ${f.el.textContent}`);
  f.document.hidden = true;
  f.listeners.visibilitychange();
  f.api.updateFpsCounter(90000);
  f.document.hidden = false;
  f.listeners.visibilitychange();
  f.api.updateFpsCounter(120000);
  for (let n = 1; n <= 30; n++) f.api.updateFpsCounter(120000 + n * 1000 / 60);
  t.assert(f.el.textContent === '60 FPS · 16.7 ms', 'hidden-tab time entered FPS sample');
  f.api.toggleFpsCounter();
  t.assert(f.saved() === 'off' && f.classes.has('hidden'), 'FPS opt-out was not saved');
  f.api.toggleFpsCounter();
  t.assert(f.saved() === 'on' && !f.classes.has('hidden'), 'FPS opt-in was not saved');

  // Exercise the real game settings and localStorage across fresh boots too.
  t.assert((await t.call('settings')).fps === true, 'fresh game does not enable FPS');
  await t.call('settings', { fps: false });
  await t.reload({ keep: true });
  t.assert((await t.call('settings')).fps === false, 'saved FPS opt-out lost after reload');
  await t.call('settings', { fps: true });
  await t.reload({ keep: true });
  t.assert((await t.call('settings')).fps === true, 'saved FPS opt-in lost after reload');
}
