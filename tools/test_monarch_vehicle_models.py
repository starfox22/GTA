#!/usr/bin/env python3
"""Host regression for Monarch source ownership, rigid wheels and semantic seams.

Uses a tiny original glTF fixture created in work/, not any downloaded asset or
browser. Real-source/Blender conversion and native rendering are separate checks.
"""
import copy
import json
import struct
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

import monarch_vehicle_models as converter
import vehicle_models as legacy


class MonarchConverterTest(unittest.TestCase):
    def setUp(self):
        (converter.ROOT / 'work').mkdir(exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=converter.ROOT / 'work', prefix='monarch-test-')
        self.root = Path(self.temporary.name)
        self.recipe = self.fixture()

    def tearDown(self):
        self.temporary.cleanup()

    def fixture(self):
        data, accessors, views, meshes, nodes = bytearray(), [], [], [], []
        def accessor(array, kind, component=5126):
            array = np.asarray(array, dtype={5126: '<f4', 5123: '<u2'}[component])
            data.extend(b'\0' * (-len(data) % 4)); at = len(data); data.extend(array.tobytes())
            view = len(views); views.append(dict(buffer=0, byteOffset=at, byteLength=array.nbytes))
            accessors.append(dict(bufferView=view, componentType=component, type=kind, count=len(array)))
            return len(accessors) - 1
        def primitive(name, points, triangles, material=0, uv1=None, colors=None):
            points = np.asarray(points); normal = np.tile([0, 0, 1.], (len(points), 1)); uv = np.tile([.25, .5], (len(points), 1))
            attributes = dict(POSITION=accessor(points, 'VEC3'), NORMAL=accessor(normal, 'VEC3'), TEXCOORD_0=accessor(uv, 'VEC2'))
            if uv1 is not None: attributes['TEXCOORD_1'] = accessor(uv1, 'VEC2')
            if colors is not None: attributes['COLOR_0'] = accessor(colors, 'VEC4')
            triangles = np.asarray(triangles, dtype=np.uint16).reshape(-1, 1)
            meshes.append(dict(primitives=[dict(attributes=attributes, indices=accessor(triangles, 'SCALAR', 5123), material=material)]))
            nodes.append(dict(name=name, mesh=len(meshes) - 1)); return len(meshes) - 1
        # Two coincident source corners differ only in UV1 and COLOR_0. Welding
        # by position/normal/UV0/material would erase the second semantic seam.
        body = primitive('body', [[-2.25, .45, -.9], [2.25, .45, -.9], [0, 1.15, -.9],
                                   [-2.25, .45, -.9], [2.25, .45, -.9], [0, 1.15, -.9]], [[0, 1, 2], [3, 4, 5]],
                         uv1=[[.1, .2]] * 3 + [[.7, .8]] * 3, colors=[[1, .2, .3, .8]] * 3 + [[.2, 1, .4, .5]] * 3)
        hood = primitive('hood', [[1, .6, -.7], [2.1, .6, -.7], [2.1, .6, .7]], [[0, 1, 2]])
        glass = primitive('glass', [[-.7, .75, -.7], [.8, .75, -.7], [0, 1.15, -.55]], [[0, 1, 2]], 2)
        wheels = []
        for front, side in [(True, -1), (True, 1), (False, -1), (False, 1)]:
            center = np.array([1.35 if front else -1.35, .36, side * .82]); angle = .31 if front else 0
            rotation = np.array([[np.cos(angle), 0, np.sin(angle)], [0, 1, 0], [-np.sin(angle), 0, np.cos(angle)]])
            circle = np.array([[np.cos(t) * .36, np.sin(t) * .36, 0] for t in np.arange(16) * np.pi / 8])
            points = circle @ rotation.T + center
            tyre = primitive('tyre', points, [[0, i, i + 1] for i in range(1, 15)], 1)
            rim = primitive('rim', circle * .7 @ rotation.T + center, [[0, i, i + 1] for i in range(1, 15)], 0)
            wheels.append(dict(front=front, side=side, tyre=dict(primitives=[tyre]), rim=dict(primitives=[rim]),
                               center=center.tolist(), r=.36, axle=(rotation @ [0, 0, 1]).tolist(), neutralize=True))
        floor = primitive('studio floor', [[-40, -.1, -40], [40, -.1, -40], [0, -.1, 40]], [[0, 1, 2]], 0)
        Image.new('RGBA', (4, 4), (255, 255, 255, 255)).save(self.root / 'white.png')
        Image.new('RGB', (4, 4), (166, 141, 239)).save(self.root / 'normal.png')
        material = dict(name='pigmented paint', pbrMetallicRoughness=dict(baseColorFactor=[.4, .2, .1, 1], metallicFactor=.7,
                         roughnessFactor=.25, baseColorTexture=dict(index=0)), emissiveTexture=dict(index=0, texCoord=1),
                        emissiveFactor=[.1, .2, .3])
        source = dict(asset=dict(version='2.0'), buffers=[dict(uri='fixture.bin', byteLength=len(data))], bufferViews=views, accessors=accessors,
                      images=[dict(uri='white.png'), dict(uri='normal.png')], textures=[dict(source=0), dict(source=1)],
                      materials=[material, dict(name='rubber', doubleSided=True, normalTexture=dict(index=1, scale=.7)),
                                 dict(name='glass', alphaMode='BLEND', pbrMetallicRoughness=dict(baseColorFactor=[.1, .2, .3, .4]))],
                      meshes=meshes, nodes=nodes, scenes=[dict(nodes=list(range(len(nodes))))], scene=0)
        (self.root / 'fixture.bin').write_bytes(data); path = self.root / 'fixture.gltf'; path.write_text(json.dumps(source))
        return dict(key='monarch_test', gameTypes=['testcar'], source=str(path), sourceSHA256=converter.sha(path), sourceUrl='fixture://original',
                    sourceFilesSHA256={name: converter.sha(self.root / name) for name in ['fixture.bin', 'white.png', 'normal.png']},
                    author='Original regression fixture', license='CC0', title='Source semantic fixture', forward='+x', lengthMetres=4.5,
                    atlasSize=64, lowAtlasSize=32, excludePrimitives=[floor], wheels=wheels, paintMaterials=[0], hasInterior=False,
                    rules=[dict(part='shell', select=dict(primitives=[body])), dict(part='hood', select=dict(primitives=[hood])),
                           dict(part='glass', pane=0, select=dict(primitives=[glass]))])

    def convert(self):
        r = converter.source_model(self.recipe); tiles, materials = converter.make_atlas(r, self.root)
        lookup = converter.prepare_parts(r, self.root)
        # The reducer's exact ratio1 path is a copy. Unit tests exercise packing
        # independently of Blender availability; real conversion tests use it.
        (self.root / 'parts-output.npz').write_bytes((self.root / 'parts-input.npz').read_bytes())
        blob = legacy.Blob(); meta = converter.pack_model(r, self.root, tiles, materials, lookup, blob)
        types = dict(f4=np.float32, i1=np.int8, u1=np.uint8, i2=np.int16, u2=np.uint16, u4=np.uint32)
        def array(part, field):
            kind, offset, count = blob.arrays[meta['type'] + '.' + part + '.' + field]
            return np.frombuffer(blob.data, dtype=types[kind], count=count, offset=offset)
        return r, meta, array

    def test_semantic_seams_and_source_ownership(self):
        r, meta, array = self.convert()
        self.assertEqual(meta['triangles'], 116)
        self.assertEqual(meta['excludedSceneTriangles'], 1)
        self.assertEqual(meta['parts']['shell']['vertices'], 6)
        colors = array('shell', 'c').reshape(-1, 4)
        self.assertFalse(np.array_equal(colors[0], colors[3]))
        emission_uv = array('shell', 'e').reshape(-1, 2)
        np.testing.assert_allclose(emission_uv[0], [.1, .2], atol=1e-7)
        np.testing.assert_allclose(emission_uv[3], [.7, .8], atol=1e-7)
        self.assertTrue(np.all(array('shell', 'd') == 255))
        self.assertTrue(np.all(array('wheel0.rim', 'd') == 0))
        self.assertTrue(np.all(array('wheel0.tyre', 's') == 255))
        np.testing.assert_allclose(array('wheel0.tyre', 'l'), .7, atol=1e-6)
        self.assertEqual(meta['parts']['shell']['colorSize'], 4)
        # Same authored paint material on a rim keeps its original pigment tile;
        # only the verified body tile becomes the respray template.
        image = Image.open(self.root / meta['textureKeys']['albedo']['file'])
        def pixel(part):
            x, y, w, h = array(part, 't').reshape(-1, 4)[0] / 65535
            return image.getpixel((round((x + w * .5) * image.width), round((y + h * .5) * image.height)))
        self.assertEqual(pixel('shell'), (255, 255, 255, 255))
        self.assertNotEqual(pixel('wheel0.rim'), (255, 255, 255, 255))
        self.assertEqual(image.getpixel(tuple(round(v * image.width) for v in meta['paintUv'])), (255, 255, 255, 255))
        self.assertTrue(np.all(array('shell', 'v') == -1))
        self.assertTrue(np.all(array('glass', 'v') == -2))
        self.assertLessEqual(meta['atlas'][0], self.recipe['atlasSize'])
        self.assertLessEqual(meta['lowAtlas'][0], 1024)
        self.assertEqual(sum(len(faces) for faces in r['parts'].values()), meta['triangles'])

    def test_near_corners_and_rigid_wheel_neutralization(self):
        r, meta, array = self.convert(); lo = np.asarray(meta['quant'][:3]); extent = np.asarray(meta['quant'][3:])
        prepared = np.load(self.root / 'parts-input.npz')
        for part in ['shell', 'hood', 'wheel0.tyre', 'wheel1.rim']:
            packed = (array(part, 'p').reshape(-1, 3).astype(float) + 32767) / 65534 * extent + lo
            index = array(part, 'i').reshape(-1, 3)
            original_index = prepared['monarch_test.' + part + '.i']
            expected = prepared['monarch_test.' + part + '.p'][original_index]
            np.testing.assert_allclose(packed[index], expected, atol=float(extent.max()) / 65534 * .51 + 1e-7)
        p = (array('wheel0.tyre', 'p').reshape(-1, 3).astype(float) + 32767) / 65534 * extent + lo
        self.assertLess(np.ptp(p[:, 2]), 1e-4)
        self.assertAlmostEqual(meta['wheels'][0]['x'], 1.35)
        self.assertEqual(meta['dims'][0], 4.5)

    def test_fail_closed_for_missing_wheel_and_hash(self):
        recipe = copy.deepcopy(self.recipe); recipe['wheels'][0]['tyre'] = dict(primitives=[999])
        with self.assertRaisesRegex(RuntimeError, 'Missing source tyre'): converter.source_model(recipe)
        recipe = copy.deepcopy(self.recipe); recipe['sourceSHA256'] = '0' * 64
        with self.assertRaisesRegex(RuntimeError, 'Unexpected pinned source'): converter.source_model(recipe)

    def test_used_unsupported_uv_set_rejected(self):
        g, _ = converter.read_source(self.recipe['source'], '+x')
        bad = dict(pbrMetallicRoughness=dict(baseColorTexture=dict(index=0, texCoord=2)))
        with self.assertRaisesRegex(RuntimeError, 'texture coordinate'): converter.texture_info(g, bad, 'albedo')

    def test_explicit_texture_budget_and_native_alpha_cutoff(self):
        source = Path(self.recipe['source']); document = json.loads(source.read_text())
        document['materials'][0].update(alphaMode='MASK', alphaCutoff=.1534)
        source.write_text(json.dumps(document)); self.recipe['sourceSHA256'] = converter.sha(source)
        self.recipe['maxTextureSize'] = 8
        Image.new('RGBA', (32, 16), 'white').save(self.root / 'white.png')
        self.recipe['sourceFilesSHA256']['white.png'] = converter.sha(self.root / 'white.png')
        _, meta, array = self.convert()
        np.testing.assert_allclose(array('shell', 'v'), .1534, atol=1e-7)
        self.assertGreater(len(meta['textureBudget']['resampledMaterials']), 0)
        self.assertEqual(meta['textureBudget']['maxTextureSize'], 8)
        self.assertGreater(meta['textureBudget']['gpuRGBA8MipBytesHigh'], 0)

    def test_lossless_array_aliases_and_metadata_only_seat_fit(self):
        blob = legacy.Blob()
        for name, values in [('normalScale', np.ones(100, dtype=np.float32)), ('normalScaleShort', np.ones(17, dtype=np.float32)),
                             ('uvA', np.arange(40, dtype=np.float32)), ('uvO', np.arange(40, dtype=np.float32)),
                             ('different', np.full(17, .7, dtype=np.float32))]:
            blob.add(name, values, 'f4')
        arrays, payload, stats = converter.deduplicate_arrays(blob.arrays, blob.data)
        self.assertEqual(arrays['normalScale'][1], arrays['normalScaleShort'][1])
        self.assertEqual(arrays['uvA'][1], arrays['uvO'][1])
        self.assertNotEqual(arrays['different'][1], arrays['normalScale'][1])
        self.assertGreater(stats['savedBytes'], 0)
        for name, (kind, offset, count) in arrays.items():
            old = blob.arrays[name][1]
            self.assertEqual(payload[offset:offset + count * 4], blob.data[old:old + count * 4])
        model = dict(sourceSHA256=self.recipe['sourceSHA256'], seats=None)
        header = dict(models={self.recipe['key']: model}, arrays=arrays)
        encoded = json.dumps(header).encode(); encoded += b' ' * (-(12 + len(encoded)) % 4)
        pack = self.root / 'pack.bin'; pack.write_bytes(b'DECVM001' + struct.pack('<I', len(encoded)) + encoded + payload)
        recipe = copy.deepcopy(self.recipe); recipe['seats'] = dict(hip=[.1, .07, -.32], floor=.03, recline=.2)
        update = converter.update_seat_fits(pack, [recipe])
        self.assertEqual(update['updates'][recipe['key']]['after'], recipe['seats'])
        raw = pack.read_bytes(); length = struct.unpack_from('<I', raw, 8)[0]
        self.assertEqual(raw[12 + length:], payload)
        bad = copy.deepcopy(recipe); bad['sourceSHA256'] = '0' * 64
        before = pack.read_bytes()
        with self.assertRaisesRegex(RuntimeError, 'Seat fit source identity'): converter.update_seat_fits(pack, [bad])
        self.assertEqual(pack.read_bytes(), before)


if __name__ == '__main__': unittest.main()
