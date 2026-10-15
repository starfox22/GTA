// Real packed police panels: typography has an affine exterior projection, with intact source data and tier parity.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

export default function(t) {
  const Three = createRequire(import.meta.url)('../../vendor/three.r160.js'),
    read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'),
    asset = name => 'data:application/octet-stream;base64,' + fs.readFileSync(new URL('../../assets/' + name, import.meta.url)).toString('base64'),
    texts = [], context = {
      matrix: [1, 1, 0, 0], stack: [], letterSpacing: '0px',
      save() { this.stack.push(this.matrix.slice()); }, restore() { this.matrix = this.stack.pop(); },
      translate(x, y) { this.matrix[2] += this.matrix[0] * x; this.matrix[3] += this.matrix[1] * y; },
      scale(x, y) { this.matrix[0] *= x; this.matrix[1] *= y; },
      fillText(text) { texts.push({ text, matrix: this.matrix.slice(), font: this.font }); },
    },
    canvas = () => ({ width: 0, height: 0, getContext: () => new Proxy(context, { get: (o, k) => k in o ? o[k] : () => {} }) }),
    scope = vm.createContext({ Three, Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Float32Array,
      DataView, TextDecoder, console, atob: value => Buffer.from(value, 'base64').toString('binary'),
      sharedGeometries: new Set(), sharedMaterials: new Set(), TAU: Math.PI * 2,
      document: { createElement: canvas }, renderer: { capabilities: { getMaxAnisotropy: () => 8 } },
      clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)), lerpNumber: (a, b, f) => a + (b - a) * f,
      ASSETS: { vehicleModels: asset('vehicle-models.bin'), approvedVehicleModels: asset('approved-vehicle-models.bin') } }),
    api = vm.runInContext(read('vehicle-assets3d') + read('approved-vehicle-assets3d') + read('police3d-looks') +
      read('police3d-cabins') + read('police3d-asset') +
      '\n({ vaData, approvedVehicleData, vaGeometry, policeAssetLiveryUv, policeLiveryTexture, bodies: POLICE_BODIES })', scope),
    rows = [];
  for (const [bodyKey, modelKey, approved] of [['crownvic', 'police', false], ['charger', 'police_charger', false],
    ['utility', 'police_suv', false], ['tahoe', 'police_suv', false], ['utility', 's2_suv', true], ['tahoe', 's2_suv', true]]) {
    const data = approved ? api.approvedVehicleData() : api.vaData(), model = data.header.models[modelKey],
      body = api.bodies[bodyKey], k = 10, l = model.dims[0] * k, w = model.dims[2] * k * .87,
      section = { yb: model.sill * k, top: model.glass.base * k, half: model.glass.halfBase * k };
    for (const part of approved ? ['shell', 'shellFar'] : ['shell']) {
      const geometry = api.vaGeometry(model, data, part, k), original = Object.fromEntries(Object.entries(geometry.attributes)
        .map(([name, attribute]) => [name, attribute.array.slice()])), indices = geometry.index.array.slice();
      geometry.setAttribute('liveryUv', geometry.attributes.uv.clone());
      api.policeAssetLiveryUv(geometry, body, l, w, section, 'liveryUv');
      for (const [name, values] of Object.entries(original)) t.assert(values.every((v, i) => v === geometry.attributes[name].array[i]),
        modelKey + '.' + part + ': source ' + name + ' was changed by livery projection');
      t.assert(indices.every((v, i) => v === geometry.index.array[i]), modelKey + '.' + part + ': source triangle ownership changed');
      const positions = geometry.attributes.position, uv = geometry.attributes.liveryUv,
        a = new Three.Vector3(), b = new Three.Vector3(), c = new Three.Vector3(), normal = new Three.Vector3(),
        gradients = { '-1': [], '1': [] };
      let tested = 0;
      for (let i = 0; i < uv.count; i++) t.assert(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)) &&
        uv.getX(i) >= 0 && uv.getX(i) <= 1 && uv.getY(i) >= .125 - 1e-6 && uv.getY(i) <= 1,
      modelKey + '.' + part + ': livery UV escaped its atlas');
      for (let i = 0; i < indices.length; i += 3) {
        const ids = [indices[i], indices[i + 1], indices[i + 2]], points = [a, b, c];
        points.forEach((p, j) => p.fromBufferAttribute(positions, ids[j]));
        normal.subVectors(b, a).cross(new Three.Vector3().subVectors(c, a)).normalize();
        // The actual written doors, away from the central cap and sill/shoulder clamps.
        if (Math.abs(normal.z) < .6 || !points.every(p => Math.abs(p.x) < .25 * l &&
          Math.abs(p.z) > section.half * .7 && p.y > section.yb + .01 && p.y < section.top - .01) ||
          !points.every(p => Math.sign(p.z) === Math.sign(a.z))) continue;
        const dx1 = b.x - a.x, dy1 = b.y - a.y, dx2 = c.x - a.x, dy2 = c.y - a.y,
          determinant = dx1 * dy2 - dx2 * dy1;
        if (Math.abs(determinant) < 1e-6) continue;
        const du1 = uv.getX(ids[1]) - uv.getX(ids[0]), du2 = uv.getX(ids[2]) - uv.getX(ids[0]),
          dv1 = uv.getY(ids[1]) - uv.getY(ids[0]), dv2 = uv.getY(ids[2]) - uv.getY(ids[0]),
          dudx = (du1 * dy2 - du2 * dy1) / determinant,
          dudy = (du2 * dx1 - du1 * dx2) / determinant,
          dvdx = (dv1 * dy2 - dv2 * dy1) / determinant,
          dvdy = (dv2 * dx1 - dv1 * dx2) / determinant;
        t.assert(Math.abs(dudx - 1 / l) < 2e-5 && Math.abs(dudy) < 2e-5 && Math.abs(dvdx) < 2e-5,
          modelKey + '.' + part + ': straight letters acquire shear/folds on a source door triangle ' + i / 3);
        t.assert(Math.sign(dvdy) === -Math.sign(a.z), modelKey + '.' + part + ': lettering is upside down on exterior side ' + Math.sign(a.z));
        gradients[Math.sign(a.z)].push(dvdy); tested++;
      }
      t.assert(tested > 8 && gradients['-1'].length && gradients['1'].length, modelKey + '.' + part + ': real source door coverage missing');
      for (const values of Object.values(gradients)) t.assert(Math.max(...values) - Math.min(...values) < 4e-5,
        modelKey + '.' + part + ': letter height varies across source door triangles');
      rows.push({ body: bodyKey, model: modelKey, part, triangles: indices.length / 3, doorTrianglesChecked: tested,
        sourceAttributesPreserved: Object.keys(original), dvdy: Object.fromEntries(Object.entries(gradients).map(([side, values]) =>
          [side, [Math.min(...values), Math.max(...values)]])) });
    }
    for (const livery of ['bw', 'modern', 'sheriff']) {
      texts.length = 0;
      const texture = api.policeLiveryTexture(livery, body, l, w, true), word = livery === 'sheriff' ? 'SHERIFF' : 'POLICE',
        labels = texts.filter(row => row.text === word);
      t.assert(labels.length === 2, bodyKey + ': missing both ' + word + ' labels');
      t.assert(labels[0].matrix[0] < 0 && labels[1].matrix[0] > 0 && labels[0].matrix[1] > 0 && labels[1].matrix[1] < 0,
        bodyKey + ': exterior labels do not read left to right and upright from each side');
      t.assert(texture.image.width === 1024 && texture.image.height === 512, bodyKey + ': livery texture budget changed');
      t.assert(api.policeLiveryTexture(livery, body, l, w, true) === texture, bodyKey + ': livery canvas no longer shared');
    }
  }
  t.note(JSON.stringify({ policeProjection: rows, texture: '1024x512 RGBA, shared per body/livery/dimensions; no geometry or draw-call increase' }));
}
