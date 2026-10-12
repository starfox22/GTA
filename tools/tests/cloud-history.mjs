// Execute production temporal-history state: wind compensation, discontinuities and bounded targets.
import fs from 'node:fs';
import vm from 'node:vm';
export default async function (t) {
  const source = fs.readFileSync(new URL('../../src/clouds3d-sky-history.js', import.meta.url), 'utf8');
  const vector = () => ({ x: 0, y: 0, z: 0, copy(v) { Object.assign(this, { x: v.x, y: v.y, z: v.z }); return this; }, set(x, y) { this.x = x; this.y = y; return this; } });
  const matrix = () => ({ copy() { return this; }, invert() { return this; }, multiplyMatrices() { return this; } });
  const target = () => ({ width: 4, height: 4, texture: {}, setSize(w, h) { this.width = w; this.height = h; } });
  const c = vm.createContext({
    Math, SKY_HISTORY_KEEP: 0.88, SKY_HISTORY_JUMP: 400,
    skyHistory: { read: 0, valid: false, frame: 0, lastFrame: -2, since: 0, x: 0, y: 0, z: 0, windX: 0, windY: 0, coverage: -1, quality: -1, base: 0 },
    skyHistoryTargets: [target(), target()], skyHistoryView: matrix(),
    skyHistoryUniforms: { tHistory: {}, uKeep: {}, uTexel: { value: vector() }, uWindDelta: { value: vector() },
      uInverseProjection: { value: matrix() }, uCameraWorld: { value: matrix() }, uCameraPosition: { value: vector() }, uBase: {}, uPrevViewProjection: { value: matrix() } },
    camera: { position: { x: 0, y: 12, z: 0 }, projectionMatrixInverse: {}, matrixWorld: {}, projectionMatrix: {} },
    cloudLayer: { coverage: 0.4, windX: 0, windY: 0 }, marchUniforms: { uBelowQuality: { value: 0 } },
    renderer: { setRenderTarget() {}, render() {} }, skyHistoryScene: {}, fullScreenCamera: {},
  });
  const start = source.indexOf('      function resolveSkyCloudHistory(');
  vm.runInContext(source.slice(start, source.indexOf('      /* Console skyCloudBench', start)), c);
  const draw = (w = 240, h = 150, base = 3000) => { c.skyHistory.frame++; c.resolveSkyCloudHistory(w, h, base); return c.skyHistoryUniforms.uKeep.value; };
  t.assert(draw() === 0, 'first cloud frame reads uninitialized history');
  t.assert(draw() === 0.88, 'continuous cloud history is discarded');
  c.cloudLayer.windX = 10; c.cloudLayer.windY = -20;
  t.assert(draw() === 0.88, 'normal wind motion resets history');
  t.assert(c.skyHistoryUniforms.uWindDelta.value.x === 10 && c.skyHistoryUniforms.uWindDelta.value.y === -20, 'wind motion has wrong reprojection offset');
  c.cloudLayer.coverage = 0.9;
  t.assert(draw() === 0 && draw() === 0.88, 'new weather retains stale clouds or never converges');
  c.marchUniforms.uBelowQuality.value = 3;
  t.assert(draw() === 0 && draw() === 0.88, 'quality change retains old lighting/history');
  c.camera.position.x = 800;
  t.assert(draw() === 0, 'camera teleport trails old cloud silhouettes');
  t.assert(draw(480, 300) === 0, 'resized target retains incompatible history');
  t.assert(c.skyHistoryTargets.every(v => v.width === 480 && v.height === 300), 'history targets disagree after resize');
  t.assert(draw(480, 300, 2600) === 0, 'new cloud altitude retains wrong reprojection');
  c.skyHistory.frame += 2;
  t.assert(draw(480, 300, 2600) === 0, 'a gap without drawing retains stale history');
  const benchStart = source.indexOf('      function skyCloudBench(');
  vm.runInContext(source.slice(benchStart), c);
  c.chaseCameraLive = () => false;
  c.skyCloudView = { march: true };
  t.assert(!!c.skyCloudBench(2).error, 'bench runs stale chase frame after switching to street');
  c.chaseCameraLive = () => true;
  c.skyCloudView.march = false;
  t.assert(!!c.skyCloudBench(2).error, 'bench runs before chase clouds have been drawn');
  t.note('first frame, continuous wind, weather, tier, teleport, resize, altitude and skipped draws');
}
