#!/usr/bin/env node
// Lossless preparation of the approved Jimny source with Google Draco 1.5.6.
// Usage: node tools/approved_vehicle_models_decode.cjs INPUT.glb OUTPUT.glb DECODER_DIR
// DECODER_DIR contains the official glTF wrapper/wasm under the filenames below.
// The helper writes only the requested decoded source and its JSON receipt.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const INPUT_SHA = '0f70478e347b1bf19410e45ade6f0b1037041df5417b7bc8da4d9739bdb5f6ce';
const OUTPUT_SHA = '5e9062ad80993b33b716a003de8f0a766299daadfa36ba7caeef99c26b13c2d7';
const DECODERS = {
  'draco_wasm_wrapper.js': {
    sha256: '8bb2952d2ba7d67e1414f8df819410cb0434a666be53f671fff75f68843d76f6',
    url: 'https://raw.githubusercontent.com/google/draco/1.5.6/javascript/draco_wasm_wrapper_gltf.js',
  },
  'draco_decoder.wasm': {
    sha256: 'a680d927bed9cb864ddbd63521868891af2bfbe755092761b4837487618df8ac',
    url: 'https://raw.githubusercontent.com/google/draco/1.5.6/javascript/draco_decoder_gltf.wasm',
  },
};
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const check = (value, message) => { if (!value) throw new Error(message); };

(async () => {
  const [inputArg, outputArg, directoryArg, ...extra] = process.argv.slice(2);
  check(inputArg && outputArg && directoryArg && !extra.length,
    'Usage: node tools/approved_vehicle_models_decode.cjs INPUT.glb OUTPUT.glb DECODER_DIR');
  const input = path.resolve(inputArg), output = path.resolve(outputArg), directory = path.resolve(directoryArg);
  check(input !== output, 'Decoded source must use a separate output path');
  const source = fs.readFileSync(input);
  check(hash(source) === INPUT_SHA, 'Unexpected Jimny input; compare the pinned source-inputs.json');
  for (const [name, decoder] of Object.entries(DECODERS))
    check(hash(fs.readFileSync(path.join(directory, name))) === decoder.sha256, 'Unexpected Draco 1.5.6 decoder: ' + name);
  check(source.readUInt32LE(0) === 0x46546c67 && source.readUInt32LE(4) === 2 &&
    source.readUInt32LE(8) === source.length, 'Invalid GLB 2 header');
  const jsonLength = source.readUInt32LE(12), binHeader = 20 + jsonLength;
  check(source.readUInt32LE(16) === 0x4e4f534a && source.readUInt32LE(binHeader + 4) === 0x004e4942,
    'Expected GLB JSON and BIN chunks');
  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString('utf8'));
  const bin = source.subarray(binHeader + 8);
  check(source.readUInt32LE(binHeader) === bin.length && json.buffers.length === 1, 'Unexpected source buffer layout');
  const chunks = [bin];
  let length = bin.length;
  function append(data, target) {
    const pad = (4 - length % 4) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
    const index = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.length, ...(target ? { target } : {}) });
    chunks.push(data); length += data.length;
    return index;
  }
  // Validate the wrapper hash before loading executable third-party code.
  const DracoDecoderModule = require(path.join(directory, 'draco_wasm_wrapper.js'));
  const draco = await DracoDecoderModule({ wasmBinary: fs.readFileSync(path.join(directory, 'draco_decoder.wasm')) });
  const decoder = new draco.Decoder();
  let primitives = 0, triangles = 0, points = 0;
  for (const model of json.meshes) for (const primitive of model.primitives) {
    const extension = primitive.extensions?.KHR_draco_mesh_compression;
    if (!extension) continue;
    const view = json.bufferViews[extension.bufferView];
    const compressed = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const buffer = new draco.DecoderBuffer(); buffer.Init(compressed, compressed.length);
    check(decoder.GetEncodedGeometryType(buffer) === draco.TRIANGULAR_MESH, 'Unexpected point cloud');
    const mesh = new draco.Mesh(), status = decoder.DecodeBufferToMesh(buffer, mesh);
    check(status.ok(), status.error_msg());
    for (const [semantic, id] of Object.entries(extension.attributes)) {
      const accessor = json.accessors[primitive.attributes[semantic]];
      const attribute = decoder.GetAttributeByUniqueId(mesh, id);
      check(accessor.componentType === 5126 && !accessor.normalized, 'Unsupported source attribute: ' + semantic);
      check(accessor.count === mesh.num_points(), 'Decoded vertex count changed');
      const values = new draco.DracoFloat32Array();
      decoder.GetAttributeFloatForAllPoints(mesh, attribute, values);
      const array = new Float32Array(values.size());
      for (let i = 0; i < array.length; i++) array[i] = values.GetValue(i);
      accessor.bufferView = append(Buffer.from(array.buffer), 34962); accessor.byteOffset = 0; delete accessor.sparse;
      draco.destroy(values);
    }
    const accessor = json.accessors[primitive.indices];
    check(accessor.count === mesh.num_faces() * 3 && accessor.componentType === 5123, 'Decoded triangle count/type changed');
    const indices = new Uint16Array(accessor.count), face = new draco.DracoInt32Array();
    for (let f = 0; f < mesh.num_faces(); f++) {
      decoder.GetFaceFromMesh(mesh, f, face);
      for (let k = 0; k < 3; k++) indices[f * 3 + k] = face.GetValue(k);
    }
    accessor.bufferView = append(Buffer.from(indices.buffer), 34963); accessor.byteOffset = 0;
    delete primitive.extensions.KHR_draco_mesh_compression;
    if (!Object.keys(primitive.extensions).length) delete primitive.extensions;
    primitives++; triangles += mesh.num_faces(); points += mesh.num_points();
    draco.destroy(face); draco.destroy(mesh); draco.destroy(buffer);
  }
  draco.destroy(decoder);
  check(primitives === 146 && triangles === 456991 && points === 1203752, 'Unexpected decoded Jimny geometry');
  json.extensionsUsed = json.extensionsUsed.filter(x => x !== 'KHR_draco_mesh_compression');
  json.extensionsRequired = json.extensionsRequired.filter(x => x !== 'KHR_draco_mesh_compression');
  json.buffers[0].byteLength = length;
  const text = Buffer.from(JSON.stringify(json));
  const outputJson = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 32)]);
  const outputBin = Buffer.concat(chunks), paddedBin = Buffer.concat([outputBin, Buffer.alloc((4 - outputBin.length % 4) % 4)]);
  const header = Buffer.alloc(20), binChunk = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + outputJson.length + paddedBin.length, 8);
  header.writeUInt32LE(outputJson.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binChunk.writeUInt32LE(paddedBin.length, 0); binChunk.writeUInt32LE(0x004e4942, 4);
  const decoded = Buffer.concat([header, outputJson, binChunk, paddedBin]);
  check(hash(decoded) === OUTPUT_SHA, 'Decoded bytes differ from the audited source');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, decoded);
  const receipt = {
    input: { path: input, bytes: source.length, sha256: INPUT_SHA },
    output: { path: output, bytes: decoded.length, sha256: OUTPUT_SHA },
    primitives, triangles, points, decoder: { version: 'Google Draco 1.5.6 glTF build', files: DECODERS },
    geometryOperation: 'Official Draco decompression only; no simplification or modelling edits.',
    materialsOperation: 'None; original embedded texture bytes and material metadata retained.',
  };
  fs.writeFileSync(output + '.decode-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
})().catch(error => { console.error(error.message); process.exit(1); });
