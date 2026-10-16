// Execute the shipped scorer and HUD against a small DOM/vehicle contract; no alternate scoring formula.
import fs from 'node:fs';
import vm from 'node:vm';

export function wheelieScoreFixture() {
  const nodes = new Map(), tones = [];
  let measureRequests = 0;
  const node = (id) => {
    if (!nodes.has(id)) {
      const classes = new Set(), attrs = new Map(), styles = new Map();
      nodes.set(id, {
        textContent: '', attrs, styles,
        classList: { contains: (k) => classes.has(k), toggle(k, on) { if (on) classes.add(k); else classes.delete(k); } },
        getAttribute: (k) => attrs.get(k), setAttribute: (k, v) => attrs.set(k, String(v)),
        style: { setProperty: (k, v) => styles.set(k, v) },
      });
    }
    return nodes.get(id);
  };
  const c = vm.createContext({
    gameMode: 'play', gameTime: 0, UNITS_PER_METRE: 8,
    player: { hp: 100, car: null, thrown: null },
    vehicleSpec: (car) => ({ bike: ['bike', 'dolcati', 'yamasaki', 'kr500', 'cruiser', 'bicycle'].includes(car.type) }),
    getElement: node,
    hudAttr(el, name, value) { const v = String(value); if (el.getAttribute(name) !== v) el.setAttribute(name, v); },
    remeasureMissionCard() { measureRequests++; },
    cardClear: { player: { ok: false }, wheelie: { ok: false } },
    hudPlayerBox: (out) => out,
    clearBoxesMeet: () => false,
    CLEAR_MARGIN: 18, CLEAR_MARGIN_BACK: 30, CLEAR_HOLD: 0.6,
    tone: (...args) => tones.push(args),
  });
  const source = fs.readFileSync(new URL('../../src/wheelie-score.js', import.meta.url), 'utf8');
  vm.runInContext(source + '\nglobalThis.fixture = { wheelieScoreStep, updateWheelieScore, updateWheelieScoreHud, wheelieScoreReport, resetWheelieScore };', c);
  const f = c.fixture;
  let nextId = 1;
  function bike(type = 'bike') {
    const car = { id: nextId++, type, hp: 100, x: 0, y: 0, vx: 0, vy: 0, wheelie: 0, fallen: null };
    c.player.car = car;
    return car;
  }
  function step(car, metres = 0, angle = 0.35, dt = 1 / 60, heading = 0) {
    const x = car.x, y = car.y;
    car.x += Math.cos(heading) * metres * 8;
    car.y += Math.sin(heading) * metres * 8;
    car.vx = Math.cos(heading) * metres * 8 / dt;
    car.vy = Math.sin(heading) * metres * 8 / dt;
    car.wheelie = angle;
    f.wheelieScoreStep(car, dt, x, y);
    f.updateWheelieScore(dt);
    if (c.gameMode === 'play') c.gameTime += dt;
    f.updateWheelieScoreHud();
    return f.wheelieScoreReport();
  }
  function travel(car, metres, angle = 0.35) {
    for (let i = 0; i < metres; i++) step(car, 1, angle, 0.02);
    return f.wheelieScoreReport();
  }
  function view() {
    return {
      score: f.wheelieScoreReport(), shown: node('wheelieScore').classList.contains('on'),
      distance: node('wheelieScoreDistance').textContent,
      grade: node('wheelieScoreGrade').textContent,
      next: node('wheelieScoreNext').textContent,
      progress: node('wheelieScore').styles.get('--wheelie-progress'),
      celebrate: node('wheelieScore').attrs.get('data-celebrate'),
    };
  }
  return { c, f, bike, step, travel, view, tones, get measureRequests() { return measureRequests; } };
}
