#!/usr/bin/env node
// Lossless EXT_meshopt_compression preparation; native input is never rewritten.
// node tools/monarch_vehicle_decode.cjs INPUT.glb OUTPUT.glb DECODER_DIR
// Fetch the pinned official decoder below into DECODER_DIR/meshopt_decoder.js.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const EXT = 'EXT_meshopt_compression';
const DECODER = {
  version: 'meshoptimizer 0.22',
  file: 'meshopt_decoder.js',
  url: 'https://raw.githubusercontent.com/zeux/meshoptimizer/v0.22/js/meshopt_decoder.js',
  sha256: '2cc4d9d42473e2243c3d2cf9e6b66ec778fd1fa0fa60ed81b2c9f57434133802',
};
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const check = (ok, message) => { if (!ok) throw new Error(message); };
const uint = (n, label, positive = false) => {
  check(Number.isSafeInteger(n) && n >= (positive ? 1 : 0), 'Invalid ' + label);
  return n;
};
const align = n => Math.ceil(n / 4) * 4;

function readGlb(source) {
  check(source.length >= 28 && source.readUInt32LE(0) === 0x46546c67 &&
    source.readUInt32LE(4) === 2 && source.readUInt32LE(8) === source.length, 'Invalid GLB 2 header');
  let offset = 12, json, bin;
  while (offset < source.length) {
    check(offset + 8 <= source.length, 'Truncated GLB chunk');
    const length = source.readUInt32LE(offset), type = source.readUInt32LE(offset + 4);
    check(length % 4 === 0 && offset + 8 + length <= source.length, 'Invalid GLB chunk length');
    const bytes = source.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) {
      check(offset === 12 && !json, 'GLB must start with one JSON chunk');
      json = JSON.parse(bytes.toString('utf8'));
    } else if (type === 0x004e4942) {
      check(json && !bin, 'Expected one BIN after JSON');
      bin = bytes;
    } else throw new Error('Unsupported GLB chunk type: ' + type);
    offset += 8 + length;
  }
  check(json && bin && json.asset?.version === '2.0', 'Expected GLB 2 JSON and BIN chunks');
  check(json.buffers?.length && !json.buffers[0].uri, 'Expected embedded buffer zero');
  const length = uint(json.buffers[0].byteLength, 'embedded buffer length');
  check(length <= bin.length && bin.length - length <= 3, 'BIN length differs from embedded buffer length');
  return { json, bin: bin.subarray(0, length) };
}

function accessorLayout(accessor) {
  const componentBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType];
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }[accessor.type];
  check(componentBytes && components, 'Unsupported accessor component type or shape');
  const matrix = /^MAT/.test(accessor.type), columns = matrix ? Number(accessor.type.slice(3)) : 1;
  return { componentBytes, size: matrix ? align(columns * componentBytes) * columns : components * componentBytes };
}

function validateAccessors(json) {
  for (let index = 0; index < (json.accessors || []).length; index++) {
    const accessor = json.accessors[index], { componentBytes, size } = accessorLayout(accessor);
    const count = uint(accessor.count, 'accessor count', true);
    if (accessor.bufferView !== undefined) {
      const view = json.bufferViews[accessor.bufferView];
      check(view, 'Missing accessor buffer view: ' + index);
      const offset = uint(accessor.byteOffset || 0, 'accessor byte offset');
      const stride = view.byteStride === undefined ? size : uint(view.byteStride, 'accessor stride', true);
      check(stride >= size && stride % componentBytes === 0 && offset % componentBytes === 0 &&
        offset + (count - 1) * stride + size <= view.byteLength, 'Accessor exceeds decoded view: ' + index);
    } else check(accessor.sparse, 'Accessor has neither buffer view nor sparse data: ' + index);
    if (accessor.sparse) {
      const sparse = accessor.sparse, sparseCount = uint(sparse.count, 'sparse count', true);
      check(sparseCount <= count, 'Sparse count exceeds accessor count');
      const indexBytes = { 5121: 1, 5123: 2, 5125: 4 }[sparse.indices.componentType];
      check(indexBytes, 'Unsupported sparse index component type');
      for (const [part, width] of [[sparse.indices, indexBytes], [sparse.values, size]]) {
        const view = json.bufferViews[part.bufferView], offset = uint(part.byteOffset || 0, 'sparse byte offset');
        check(view && offset + sparseCount * width <= view.byteLength, 'Sparse data exceeds decoded view');
      }
    }
  }
}

function geometryCounts(json) {
  let primitives = 0, triangles = 0, vertices = 0;
  const modes = {};
  for (const mesh of json.meshes || []) for (const primitive of mesh.primitives) {
    check(!primitive.extensions?.KHR_draco_mesh_compression, 'Draco compression is unsupported by this meshopt helper');
    const position = json.accessors[primitive.attributes.POSITION];
    check(position, 'Primitive has no POSITION accessor');
    const count = primitive.indices === undefined ? position.count : json.accessors[primitive.indices]?.count;
    check(Number.isSafeInteger(count), 'Primitive has invalid index accessor');
    const mode = primitive.mode === undefined ? 4 : primitive.mode;
    check(Number.isInteger(mode) && mode >= 0 && mode <= 6, 'Invalid primitive mode');
    modes[mode] = (modes[mode] || 0) + 1;
    if (mode === 4) { check(count % 3 === 0, 'Incomplete triangle primitive'); triangles += count / 3; }
    if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
    primitives++; vertices += position.count;
  }
  return { primitives, triangles, vertices, primitiveModes: modes };
}

async function prepare(inputArg, outputArg, decoderArg) {
  const input = path.resolve(inputArg), output = path.resolve(outputArg), directory = path.resolve(decoderArg);
  check(input !== output, 'Decoded source must use a separate output path');
  check(!fs.existsSync(output) || fs.realpathSync(input) !== fs.realpathSync(output), 'Output aliases native source');
  const source = fs.readFileSync(input), { json, bin } = readGlb(source);
  const nativeMetadata = JSON.stringify({ ...json, buffers: undefined, bufferViews: undefined,
    extensionsUsed: undefined, extensionsRequired: undefined });
  const geometry = geometryCounts(json);
  const decoderPath = path.join(directory, DECODER.file), decoderBytes = fs.readFileSync(decoderPath);
  check(hash(decoderBytes) === DECODER.sha256, 'Unexpected official meshoptimizer decoder bytes');
  // Validate downloaded executable code before requiring it. WASM is embedded in this official build.
  const decoder = require(decoderPath);
  check(decoder.supported, 'WebAssembly meshopt decoding is unavailable');
  await decoder.ready;
  const chunks = [bin], decodedViews = [];
  let length = bin.length;
  for (let index = 0; index < (json.bufferViews || []).length; index++) {
    const view = json.bufferViews[index], extension = view.extensions?.[EXT];
    if (!extension) continue;
    check(extension.buffer === 0, 'Compressed input must refer to embedded BIN zero');
    const offset = uint(extension.byteOffset || 0, 'compressed offset');
    const bytes = uint(extension.byteLength, 'compressed byte length', true);
    const count = uint(extension.count, 'compressed count', true);
    const stride = uint(extension.byteStride, 'compressed stride', true);
    const mode = extension.mode, filter = extension.filter || 'NONE';
    check(offset + bytes <= bin.length, 'Compressed view exceeds native BIN: ' + index);
    check(['ATTRIBUTES', 'TRIANGLES', 'INDICES'].includes(mode), 'Unsupported meshopt mode: ' + mode);
    check(['NONE', 'OCTAHEDRAL', 'QUATERNION', 'EXPONENTIAL'].includes(filter), 'Unsupported meshopt filter: ' + filter);
    check(mode === 'ATTRIBUTES' ? stride >= 4 && stride <= 256 && stride % 4 === 0 :
      (stride === 2 || stride === 4) && filter === 'NONE', 'Invalid mode/stride/filter combination');
    check(mode !== 'TRIANGLES' || count % 3 === 0, 'Incomplete compressed triangle list');
    check(view.byteStride === undefined || view.byteStride === stride, 'View and compressed strides differ');
    const decodedLength = count * stride;
    check(Number.isSafeInteger(decodedLength) && decodedLength <= 512 * 1024 * 1024 &&
      decodedLength === view.byteLength, 'Decoded byte length differs from source view: ' + index);
    const compressed = bin.subarray(offset, offset + bytes), decoded = Buffer.alloc(decodedLength);
    decoder.decodeGltfBuffer(decoded, count, stride, compressed, mode, filter);
    const padding = align(length) - length;
    if (padding) { chunks.push(Buffer.alloc(padding)); length += padding; }
    view.buffer = 0; view.byteOffset = length;
    chunks.push(decoded); length += decoded.length;
    delete view.extensions[EXT];
    if (!Object.keys(view.extensions).length) delete view.extensions;
    decodedViews.push({ index, mode, filter, count, stride, compressedBytes: bytes, decodedBytes: decoded.length,
      compressedSha256: hash(compressed), decodedSha256: hash(decoded) });
  }
  check(decodedViews.length, 'Source contains no EXT_meshopt_compression views');
  for (const view of json.bufferViews) {
    check(view.buffer === 0 && uint(view.byteOffset || 0, 'view offset') +
      uint(view.byteLength, 'view length') <= length, 'Unsupported external or unresolved fallback buffer');
  }
  for (let i = 1; i < json.buffers.length; i++)
    check(!json.buffers[i].uri && json.buffers[i].extensions?.[EXT]?.fallback === true,
      'Unsupported additional non-fallback buffer: ' + i);
  json.buffers = [{ ...json.buffers[0], byteLength: length }];
  for (const field of ['extensionsUsed', 'extensionsRequired']) if (json[field]) {
    json[field] = json[field].filter(name => name !== EXT);
    if (!json[field].length) delete json[field];
  }
  validateAccessors(json);
  check(JSON.stringify({ ...json, buffers: undefined, bufferViews: undefined,
    extensionsUsed: undefined, extensionsRequired: undefined }) === nativeMetadata,
  'Source accessor, transform, material, texture or other metadata changed');
  const jsonBytes = Buffer.from(JSON.stringify(json)), text = Buffer.alloc(align(jsonBytes.length), 32);
  jsonBytes.copy(text);
  const binary = Buffer.concat(chunks, length), paddedBin = Buffer.alloc(align(length)); binary.copy(paddedBin);
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + text.length + paddedBin.length, 8);
  header.writeUInt32LE(text.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(paddedBin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  const prepared = Buffer.concat([header, text, binHeader, paddedBin]);
  const roundTrip = readGlb(prepared);
  validateAccessors(roundTrip.json);
  check(roundTrip.bin.subarray(0, bin.length).equals(bin), 'Native embedded bytes changed');
  for (const view of decodedViews) {
    const offset = roundTrip.json.bufferViews[view.index].byteOffset;
    check(hash(roundTrip.bin.subarray(offset, offset + view.decodedBytes)) === view.decodedSha256,
      'Decoded buffer view changed during GLB serialization');
  }
  const receipt = {
    input: { path: input, bytes: source.length, sha256: hash(source) },
    output: { path: output, bytes: prepared.length, sha256: hash(prepared) },
    decoder: DECODER, ...geometry, decodedBufferViews: decodedViews.length,
    accessors: json.accessors?.length || 0, normalizedAccessors: (json.accessors || []).filter(a => a.normalized).length,
    quantizationPreserved: (json.extensionsUsed || []).includes('KHR_mesh_quantization'),
    unchangedMetadataSha256: hash(nativeMetadata), nativeEmbeddedBytesSha256: hash(bin),
    geometryOperation: 'Official meshopt decompression/filter decoding only; source accessor component types, normalized flags, quantization and transforms retained. No simplification or modelling edits.',
    materialsOperation: 'None; original material/texture metadata and embedded image bytes retained.',
    views: decodedViews,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, prepared);
  fs.writeFileSync(output + '.decode-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

if (require.main === module) {
  const [input, output, directory, ...extra] = process.argv.slice(2);
  Promise.resolve().then(() => {
    check(input && output && directory && !extra.length,
      'Usage: node tools/monarch_vehicle_decode.cjs INPUT.glb OUTPUT.glb DECODER_DIR');
    return prepare(input, output, directory);
  }).then(({ views, ...receipt }) => console.log(JSON.stringify(receipt, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { prepare, readGlb, DECODER };
