#!/usr/bin/env python3
"""Convert ROY's pinned CC-BY Panigale into an independent Dolcati motorcycle pack.

python3 tools/dolcati_vehicle_models.py SOURCE.glb --out assets --work work/dolcati-convert
Use --download to retrieve the pinned GitHub mirror. Near geometry keeps every
source triangle and authored corner normal; only the separate far LOD is reduced.
"""
import argparse
import hashlib
import json
import subprocess
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

import vehicle_models as legacy
import approved_vehicle_models as approved
import sports_vehicle_models as sports

ROOT = Path(__file__).resolve().parent.parent
KEY = 'dolcati_roy'
COMMIT = 'aae5834e3ab3139529e1bf8267e449d28e77d915'
SOURCE_URL = 'https://raw.githubusercontent.com/NormanFxxkingRockwell/moframe/' + COMMIT + '/public/models/ducati/ducati_panigale_v4.glb'
SOURCE_SHA = '83f555ed9ac013feb319c582e0fb2bb09e8094e0f9835f7a616c4796afb92370'
SIZE = 2048


def source_model(path):
    if sports.sha(path) != SOURCE_SHA:
        raise RuntimeError('Unexpected source; use the pinned CC-BY ROY GLB')
    g = legacy.Gltf(str(path))
    credit = g.js['asset']['extras']
    if credit.get('license') != 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)':
        raise RuntimeError('Model-specific source licence missing')
    prims = legacy.load_primitives(g)
    legacy.to_game_frame(prims, '-z')
    tyres = [96, 99]
    whole = np.concatenate([p['P'] for p in prims])
    rubber = np.concatenate([prims[i]['P'] for i in tyres])
    shift = np.array([-(whole[:, 0].min() + whole[:, 0].max()) / 2, -rubber[:, 1].min(), 0.])
    for p in prims:
        p['P'] += shift
    wheels = []
    for i, pi in enumerate(tyres):
        center, radius, width, axle = approved.circle(prims[pi]['P'], prims[pi]['N'])
        wheels.append(dict(x=float(center[0]), y=float(center[1]), z=float(center[2]),
                           r=radius, width=width, axle=axle.tolist(), front=i == 0, side=1,
                           sourceNode=prims[pi]['node']))
    # Identified source wheel components: tyre, circular hub/disc and black rim.
    # Calipers, spindle, fender, fork legs and chain remain fixed to the chassis/fork.
    front = {92, 93, 94, 95, 96, 97}
    rear = set(range(99, 107))
    steering = {59, 60, 61, 62, 63, 64, 65, 67, 68, 69, 70, 71, 72, 73, 74, 75, 98}
    head, tail = {33, 47}, {2, 4, 18}
    paint_materials = {6, 7, 10, 19}
    glass = {3, 32, 46, 81}
    parts = {}
    for pi, p in enumerate(prims):
        if pi in front or pi in rear:
            index = 0 if pi in front else 1
            name = 'wheel%d.%s' % (index, 'tyre' if pi in tyres else 'rim')
        elif pi in head:
            name = 'head'
        elif pi in tail:
            name = 'tail'
        elif pi in glass:
            name = 'glass'
        else:
            name = ('steer.' if pi in steering else '') + ('paint' if p['material'] in paint_materials else 'trim')
        parts.setdefault(name, []).extend((pi, ti) for ti in range(len(p['index'])))
    count = sum(len(p['index']) for p in prims)
    if count != 372664 or sum(map(len, parts.values())) != count:
        raise RuntimeError('Every original source face must have exactly one owner')
    # Vertical barycentric ray onto Object_14, the actual front driver saddle.
    r = dict(prims=prims, g=g, kind='moto')
    seat, seat_proof = approved.seat_contact(r, 6, -.22 + shift[0])
    # Paired rubber grips on Object_111; the authored transverse driver footrests
    # are Object_64. Values are measured in the original GLB frame after rotation.
    grips = (np.array([[.536, .288, -.313], [.536, .288, .313]]) + shift).tolist()
    peg = (np.array([-.08, -.178, .152]) + shift).tolist()
    # Project the two gold fork tubes (Object_109) into XY and fit their shared
    # longitudinal axis. This avoids mistaking the offset top yoke for the stem.
    fork = prims[59]['P'][:, :2]
    _, vectors = np.linalg.eigh(np.cov(fork.T))
    fork_axis = vectors[:, -1]
    fork_axis *= np.sign(fork_axis[1])
    top_y = .350 + shift[1]
    top = fork.mean(0) + fork_axis * ((top_y - fork[:, 1].mean()) / fork_axis[1])
    wf = wheels[0]
    rake = float(np.arctan2(wf['x'] - top[0], top[1] - wf['y']))
    whole = np.concatenate([p['P'] for p in prims]); lo, hi = whole.min(0), whole.max(0)
    # glass.004 is an opaque exporter placeholder over the actual tail lens;
    # give that cover the same optical treatment as the authored transmission glass.
    g.js['materials'][3]['alphaMode'] = 'BLEND'
    g.js['materials'][3]['pbrMetallicRoughness'] = dict(baseColorFactor=[1., 1., 1., .22], metallicFactor=0., roughnessFactor=.08)
    meta = dict(type=KEY, kind='moto', title='Ducati Panigale V4', author='ROY',
                source=credit['source'], license='CC BY 4.0', dims=(hi - lo).tolist(),
                wheels=wheels, axis=[wf['x'], wf['y'], *top.tolist()], rake=rake,
                seat=seat, seatProof=seat_proof, grips=grips,
                grip=[grips[0][0], grips[0][1], abs(grips[0][2])], peg=peg, lean=-1.1,
                gripProof=dict(primitive=60, node=prims[60]['node'], source='paired rubber handlebar grip axes'),
                pegProof=dict(primitive=34, node=prims[34]['node'], source='transverse driver footrest upper contact'),
                steeringProof=dict(primitive=59, node=prims[59]['node'], method='source fork-tube XY principal-axis fit', direction=fork_axis.tolist()),
                headSteers=False, x0=float(lo[0]), x1=float(hi[0]),
                paintTexture=True, paintColor='#ffffff', normalScale=32767,
                sourceTriangles=count, sourceShift=shift.tolist(), sourceUniformScale=1.,
                roleParts={'glass': ['glass']}, sourceNearGeometry='All original source triangles, split normals and UVs retained',
                sourceWheelPartition=dict(front=sorted(front), rear=sorted(rear), fixedSteering=sorted(steering)))
    return dict(g=g, prims=prims, parts=parts, pane_ids={}, meta=meta)


def atlas(r, output):
    tiles, materials = {}, {}
    for mi, material in enumerate(r['g'].js['materials']):
        pbr = material.get('pbrMetallicRoughness', {})
        factor = list(pbr.get('baseColorFactor', [1, 1, 1, 1]))
        if material.get('alphaMode') not in ('BLEND', 'MASK'):
            factor[3] = 1.
        albedo = sports.material_image(r['g'], material, 'baseColorTexture')
        emission = sports.material_image(r['g'], material, 'emissiveTexture')
        images = [im for im in (albedo, emission) if im]
        size = (max(im.width for im in images), max(im.height for im in images)) if images else (8, 8)
        albedo = sports.multiplied(albedo or Image.new('RGBA', size, 'white'), factor).resize(size, Image.Resampling.LANCZOS)
        orm = Image.new('RGB', size, 'white')
        emission = sports.multiplied(emission or Image.new('RGBA', size, 'white'), material.get('emissiveFactor', [0, 0, 0]) + [1]).convert('RGB').resize(size, Image.Resampling.LANCZOS)
        key = hashlib.sha256(albedo.tobytes() + orm.tobytes() + emission.tobytes()).hexdigest()
        tiles.setdefault(key, dict(albedo=albedo, orm=orm, emissive=emission, users=[]))['users'].append(mi)
        materials[mi] = dict(hash=key, finish=[pbr.get('roughnessFactor', 1), pbr.get('metallicFactor', 1)])
    rects = legacy.shelf_pack({key: value['albedo'].size for key, value in tiles.items()}, SIZE, SIZE)
    if rects is None:
        raise RuntimeError('Full-resolution source textures must fit; never silently downsample')
    for channel, mode, bg in [('albedo', 'RGBA', (0, 0, 0, 0)), ('orm', 'RGB', (255, 255, 255)), ('emissive', 'RGB', (0, 0, 0))]:
        image = Image.new(mode, (SIZE, SIZE), bg)
        for key, (x, y) in rects.items():
            tile = tiles[key][channel]; w, h = tile.size
            padded = tile.resize((w + 4, h + 4), Image.Resampling.NEAREST)
            padded.paste(tile, (2, 2)); image.paste(padded, (x - 2, y - 2))
            tiles[key]['rect'] = [x, y, w, h]
        image.save(output / ('dolcati-vehicle-' + channel + '.webp'), lossless=True, method=6)
        image.resize((1024, 1024), Image.Resampling.LANCZOS).save(output / ('dolcati-vehicle-' + channel + '-low.webp'), lossless=True, method=6)
    return tiles, materials


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--out', type=Path, default=ROOT / 'assets')
    parser.add_argument('--work', type=Path, default=ROOT / 'work/dolcati-convert')
    args = parser.parse_args()
    if args.download:
        args.source.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(SOURCE_URL, args.source)
    args.work.mkdir(parents=True, exist_ok=True); args.out.mkdir(parents=True, exist_ok=True)
    protected = {name: sports.sha(ROOT / 'assets' / name) for name in ['vehicle-models.bin', 'approved-vehicle-models.bin']}
    r = source_model(args.source)
    (args.work / 'source-partition.json').write_text(json.dumps({name: dict(triangles=len(faces), sourceFaces=faces) for name, faces in r['parts'].items()}))
    tiles, materials = atlas(r, args.out)
    sports.KEY = KEY; sports.SIZE = SIZE
    lookup = sports.prepare_geometry(r, args.work)
    manifest = json.loads((args.work / 'parts-manifest.json').read_text())
    for name, info in manifest.items():
        info['ratio'] = (.12 if 'wheel' in name or 'glass' in name else .06) if name.endswith('Far') else 1.
        info['preserveSourceNormals'] = True
    (args.work / 'parts-manifest.json').write_text(json.dumps(manifest, indent=2))
    helper = ROOT / 'tools/approved_vehicle_models_prepare.py'
    subprocess.run(['blender', '-b', '--threads', '1', '-P', str(helper), '--', 'simplify', str(args.work / 'parts-input.npz'), str(args.work / 'parts-output.npz'), str(args.work / 'parts-manifest.json')], check=True)
    stage = args.work / 'pack-stage'; stage.mkdir(exist_ok=True)
    header = sports.pack(r, args.work, stage, tiles, materials, lookup)
    (stage / 'sports-vehicle-models.bin').replace(args.out / 'dolcati-vehicle-models.bin')
    if any(sports.sha(ROOT / 'assets' / name) != digest for name, digest in protected.items()):
        raise RuntimeError('Existing packs changed')
    meta = header['models'][KEY]
    receipt = dict(source=dict(url=SOURCE_URL, mirrorCommit=COMMIT, sha256=SOURCE_SHA, bytes=args.source.stat().st_size,
                               embeddedCredit=r['g'].js['asset']['extras']),
                   sourceTriangles=meta['sourceTriangles'], nearTriangles=meta['triangles'], farTriangles=meta['farTriangles'],
                   sourceNearGeometryExact=True, sourceTexturesNativeResolution=True,
                   changes='Rigid -Z to +X rotation and ground centering; source-measured animation pivots and rider contacts; separate decimated far LOD; tail cover optical correction. Respray neutralizes red pigment in shader while retaining source lettering.',
                   protectedPacks=protected, model=meta,
                   output={p.name: dict(bytes=p.stat().st_size, sha256=sports.sha(p)) for p in args.out.glob('dolcati-vehicle-*')},
                   converterSHA256=sports.sha(Path(__file__)), simplifierSHA256=sports.sha(helper))
    (args.work / 'dolcati-conversion-receipt.json').write_text(json.dumps(receipt, indent=2))
    print(json.dumps({key: meta[key] for key in ['triangles', 'farTriangles', 'dims', 'seat', 'grips', 'peg']}, indent=2))


if __name__ == '__main__':
    main()
