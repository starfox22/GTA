#!/usr/bin/env python3
"""Source-exact SDC Aventador SVJ pack, independent of all existing vehicle packs.

python3 tools/svj_vehicle_models.py work/svj-source/original.glb --download --out assets --work work/svj-convert
Only the far LOD is reduced. Near preserves every source face, UV and split normal.
"""
import argparse
import hashlib
import json
import struct
import subprocess
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

import vehicle_models as legacy
import approved_vehicle_models as approved
import sports_vehicle_models as sports

ROOT = Path(__file__).resolve().parent.parent
KEY = 'svj_sdc'
COMMIT = 'e94085e40e5137ae1f9c35cc517024167e8711cb'
SOURCE_URL = 'https://raw.githubusercontent.com/pxlinspace/lambo/' + COMMIT + '/assets/models/lamborghini/lamborghini_aventador_svj_sdc__free.glb'
SOURCE_SHA = '4c56b1baafe861dcbb7438571d685ddb96709d3cc909f58b83bc58887e96fd16'
SIZE = 2048


def source_model(path):
    if sports.sha(path) != SOURCE_SHA:
        raise RuntimeError('Use the pinned full SDC source')
    g = legacy.Gltf(str(path))
    credit = g.js['asset']['extras']
    if credit.get('license') != 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)':
        raise RuntimeError('Missing asset-specific CC-BY source credit')
    prims = legacy.load_primitives(g)
    legacy.to_game_frame(prims, '+z')
    # Paired rear wheels share a source object; sides are disconnected, with no
    # source triangle crossing the centre plane. Split indices, never cut faces.
    wheel_sets = [([36, 37, 38, 39], 37, -1), ([57, 58, 59, 60], 58, 1),
                  ([42, 43, 44, 45, 46], 43, -1), ([42, 43, 44, 45, 46], 43, 1)]
    wheels, wheel_faces, adjustments = [], {}, []
    for wi, (indices, tyre_pi, side) in enumerate(wheel_sets):
        tyre = prims[tyre_pi]
        mask = tyre['P'][:, 2] * side > 0
        center, radius, width, axle = approved.circle(tyre['P'][mask], tyre['N'][mask])
        # Remove the source's static display steering/camber by one rigid wheel
        # transform. All authored positions, normals and UV seams survive it.
        target = np.array([0., 0., 1.])
        axis = np.cross(axle, target)
        cosine = float(axle @ target)
        cross = np.array([[0., -axis[2], axis[1]], [axis[2], 0., -axis[0]], [-axis[1], axis[0], 0.]])
        rotation = np.eye(3) + cross + cross @ cross / max(1e-12, 1 + cosine)
        for pi in indices:
            p = prims[pi]
            faces = np.flatnonzero(p['P'][p['index']].mean(1)[:, 2] * side > 0)
            vertices = np.unique(p['index'][faces])
            if np.any(p['P'][p['index'][faces], 2] * side <= 0):
                raise RuntimeError('A wheel triangle crosses the side partition')
            p['P'][vertices] = (p['P'][vertices] - center) @ rotation.T + center
            p['N'][vertices] = p['N'][vertices] @ rotation.T
            wheel_faces[pi, side] = (wi, faces)
        wheels.append(dict(x=float(center[0]), y=float(center[1]), z=float(center[2]), r=radius,
                           width=width, front=wi < 2, side=side, axle=[0., 0., 1.],
                           sourceNode=tyre['node'], caliper='wheel%d.caliper' % wi if wi in (0, 1, 2) else None))
        adjustments.append(dict(wheel=wi, sourceCenter=center.tolist(), sourceAxle=axle.tolist(), rotation=rotation.tolist()))
    whole = np.concatenate([p['P'] for p in prims])
    rubber = np.concatenate([prims[pi]['P'] for pi in (37, 58, 43)])
    scale = 4.94 / np.ptp(whole[:, 0])
    shift = np.array([-(whole[:, 0].min() + whole[:, 0].max()) / 2, -rubber[:, 1].min(),
                      -(whole[:, 2].min() + whole[:, 2].max()) / 2])
    for p in prims:
        p['P'] = (p['P'] + shift) * scale
    for wheel in wheels:
        for key, value in zip(('x', 'y', 'z'), (np.array([wheel[k] for k in ('x', 'y', 'z')]) + shift) * scale):
            wheel[key] = float(value)
        wheel['r'] *= scale; wheel['width'] *= scale
    parts, panes, owners = {}, {}, []
    def add(name, pi, ti, pane=None):
        parts.setdefault(name, []).append((pi, ti)); owners.append((pi, ti))
        if pane is not None: panes[pi, ti] = pane
    for pi, p in enumerate(prims):
        centers = p['P'][p['index']].mean(1)
        for ti, center in enumerate(centers):
            side = -1 if center[2] < 0 else 1
            if (pi, side) in wheel_faces:
                wi = wheel_faces[pi, side][0]
                add('wheel%d.%s' % (wi, 'tyre' if p['material'] == 21 else 'rim'), pi, ti)
            elif pi in (40, 41, 47):
                add('wheel%d.caliper' % {40: 0, 41: 1, 47: 2}[pi], pi, ti)
            elif pi in (18, 19, 20, 21):
                role = 'paint' if pi == 18 else 'glass' if pi == 21 else 'trim'
                add(('doorLeft.' if side < 0 else 'doorRight.') + role, pi, ti, (0 if side < 0 else 2) if role == 'glass' else None)
            elif pi == 17:
                # Body GLASS has a windscreen and rear quarter windows, plus a
                # small rear badge. Engine cover glazing has its own object.
                if center[0] < -1.5 * scale: add('trim', pi, ti)
                else: add('glass', pi, ti, 1 if center[0] > .30 * scale and abs(center[2]) < .74 * scale else 0 if side < 0 else 2)
            elif pi == 24: add('opticalGlass', pi, ti)
            elif pi in (7, 31, 52): add('opticalGlass', pi, ti)
            elif pi == 32: add('headLeft' if side < 0 else 'headRight', pi, ti)
            elif pi == 53: add('tailLeft' if side < 0 else 'tailRight', pi, ti)
            elif pi == 33: add('hood', pi, ti)
            elif p['material'] == 1: add('panels' if center[1] > .72 * scale else 'shell', pi, ti)
            else: add('trim', pi, ti)
    count = sum(len(p['index']) for p in prims)
    if count != 508324 or len(owners) != count or len(set(owners)) != count:
        raise RuntimeError('Every full-resolution source face must have one owner')
    roles = dict(shell=['shell'], panels=['panels', 'doorLeft.paint', 'doorRight.paint'], hood=['hood'],
                 trim=['trim', 'doorLeft.trim', 'doorRight.trim'], cabin=[],
                 glass=['glass', 'doorLeft.glass', 'doorRight.glass'], opticalGlass=['opticalGlass'])
    lo, hi = np.concatenate([p['P'] for p in prims]).min(0), np.concatenate([p['P'] for p in prims]).max(0)
    doors = {}
    for label, side in [('left', -1), ('right', 1)]:
        names = ['door' + label.title() + '.' + role for role in ('paint', 'trim', 'glass')]
        q = np.concatenate([prims[pi]['P'][prims[pi]['index'][ti]] for name in names for pi, ti in parts[name]]).reshape(-1, 3)
        a, b = q.min(0), q.max(0)
        doors[label] = dict(side=side, hinge=((np.array([.84, .68, side * .86]) + shift) * scale).tolist(),
                            axis=[0., .18 / np.hypot(1, .18), -side / np.hypot(1, .18)],
                            sourceNode='DoorFrLeft_1 (paired independent side geometry)',
                            pivotEvidence='Derived at the source forward door seam, not an authored hinge; slightly outward scissor axis',
                            bounds=dict(x0=float(a[0]), x1=float(b[0]), y0=float(a[1]), y1=float(b[1]), z0=float(a[2]), z1=float(b[2])),
                            parts={role: [name] for role, name in zip(('paint', 'trim', 'glass'), names)})
    body = np.concatenate([p['P'] for p in prims if p['material'] == 1])
    profile, section = [], []
    for x in np.linspace(lo[0], hi[0], 41):
        q = body[np.abs(body[:, 0] - x) < .12]
        if not len(q): q = body[np.argsort(np.abs(body[:, 0] - x))[:20]]
        profile.append(float(q[:, 1].max())); section.append([float(q[:, 1].min()), float(q[:, 1].max()), float(np.abs(q[:, 2]).max())])
    lamps = {}
    for name in ('headLeft', 'headRight', 'tailLeft', 'tailRight'):
        q = np.concatenate([prims[pi]['P'][prims[pi]['index'][ti]] for pi, ti in parts[name]]).reshape(-1, 3)
        center = (q.min(0) + q.max(0)) * .5
        lamps[name] = dict(x=float(center[0]), y=float(center[1]), z=float(center[2]), size=float(max(np.ptp(q[:, 1]), np.ptp(q[:, 2])) * .35))
    def fitted(value, axis): return float((value + shift[axis]) * scale)
    meta = dict(type=KEY, kind='car', title=credit['title'], author=credit['author'], source=credit['source'], license='CC BY 4.0',
                dims=(hi - lo).tolist(), x0=float(lo[0]), x1=float(hi[0]), wheels=wheels, lamps=lamps,
                glass=dict(base=fitted(.698, 1), roof=fitted(1.058, 1), xf=fitted(1.424, 0), rf=fitted(.378, 0),
                           xb=fitted(-.63, 0), rb=fitted(-.77, 0), halfBase=.85 * scale, halfTop=.60 * scale, crown=.063 * scale),
                hinge=[fitted(1.324, 0), fitted(.755, 1)], sill=fitted(.226, 1), profile=profile, section=section,
                hasInterior=False, roleParts=roles, doors=doors, paintTexture=True, paintColor='#ffffff', normalScale=32767,
                sourceTriangles=count, nearReachMetres=12, sourceShift=shift.tolist(), sourceUniformScale=scale, sourceWheelStraightening=adjustments,
                sourceNearGeometry='All original source triangles, split normals and UVs retained after rigid wheel neutralization and uniform metre fit',
                cabinAdaptation='Source has no seats/dashboard/steering wheel; fitted two-seat game cabin added and opaque source canopy made see-through')
    return dict(g=g, prims=prims, parts=parts, pane_ids=panes, meta=meta)


def atlas(r, output):
    tiles, materials = {}, {}
    for mi, material in enumerate(r['g'].js['materials']):
        pbr = material.get('pbrMetallicRoughness', {})
        factor = list(pbr.get('baseColorFactor', [1., 1., 1., 1.]))
        if mi == 1: factor[:3] = [1., 1., 1.]  # only original body pigment is neutralized for resprays
        if mi == 6: factor = [.20, .25, .30, .30]  # source's opaque canopy becomes gameplay glass
        albedo = sports.material_image(r['g'], material, 'baseColorTexture')
        size = albedo.size if albedo else (8, 8)
        albedo = sports.multiplied(albedo or Image.new('RGBA', size, 'white'), factor)
        orm = Image.new('RGBA', size, (255, 255, 255, round(material.get('extensions', {}).get('KHR_materials_specular', {}).get('specularFactor', 1.) * 255)))
        # Day/night intensity is driven by the existing head/brake state; retain
        # the original emission colours without its studio-only strength boost.
        emission = sports.multiplied(Image.new('RGBA', size, 'white'), material.get('emissiveFactor', [0., 0., 0.]) + [1.]).convert('RGB')
        key = hashlib.sha256(albedo.tobytes() + orm.tobytes() + emission.tobytes()).hexdigest()
        tiles.setdefault(key, dict(albedo=albedo, orm=orm, emissive=emission, users=[]))['users'].append(mi)
        materials[mi] = dict(hash=key, finish=[pbr.get('roughnessFactor', 1.), 0.05 if mi == 6 else pbr.get('metallicFactor', 1.)])
    rects = legacy.shelf_pack({key: tile['albedo'].size for key, tile in tiles.items()}, SIZE, SIZE)
    if rects is None: raise RuntimeError('Native source carbon texture must fit without downsampling')
    for channel, mode, bg in [('albedo', 'RGBA', (0, 0, 0, 0)), ('orm', 'RGBA', (255, 255, 255, 255)), ('emissive', 'RGB', (0, 0, 0))]:
        image = Image.new(mode, (SIZE, SIZE), bg)
        for key, (x, y) in rects.items():
            tile = tiles[key][channel]; w, h = tile.size
            padded = tile.resize((w + 4, h + 4), Image.Resampling.NEAREST); padded.paste(tile, (2, 2)); image.paste(padded, (x - 2, y - 2))
            tiles[key]['rect'] = [x, y, w, h]
        image.save(output / ('svj-vehicle-' + channel + '.webp'), lossless=True, method=6)
        image.resize((1024, 1024), Image.Resampling.LANCZOS).save(output / ('svj-vehicle-' + channel + '-low.webp'), lossless=True, method=6)
    return tiles, materials


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path); parser.add_argument('--download', action='store_true')
    parser.add_argument('--out', type=Path, default=ROOT / 'assets'); parser.add_argument('--work', type=Path, default=ROOT / 'work/svj-convert')
    args = parser.parse_args()
    if args.download:
        args.source.parent.mkdir(parents=True, exist_ok=True); urllib.request.urlretrieve(SOURCE_URL, args.source)
    args.out.mkdir(parents=True, exist_ok=True); args.work.mkdir(parents=True, exist_ok=True)
    protected = {p.name: sports.sha(p) for p in (ROOT / 'assets').glob('*vehicle*') if p.is_file() and not p.name.startswith('svj-')}
    r = source_model(args.source)
    (args.work / 'source-partition.json').write_text(json.dumps({name: dict(triangles=len(faces), sourceFaces=faces) for name, faces in r['parts'].items()}))
    tiles, materials = atlas(r, args.out)
    sports.KEY = KEY; sports.SIZE = SIZE
    lookup = sports.prepare_geometry(r, args.work)
    manifest = json.loads((args.work / 'parts-manifest.json').read_text())
    for name, record in manifest.items():
        record['ratio'] = (.055 if 'wheel' in name or 'glass' in name.lower() else .035) if 'Far' in name else 1.
        record['preserveSourceNormals'] = True
    (args.work / 'parts-manifest.json').write_text(json.dumps(manifest, indent=2))
    helper = ROOT / 'tools/approved_vehicle_models_prepare.py'
    subprocess.run(['blender', '-b', '--threads', '1', '-P', str(helper), '--', 'simplify', str(args.work / 'parts-input.npz'), str(args.work / 'parts-output.npz'), str(args.work / 'parts-manifest.json')], check=True)
    stage = args.work / 'pack-stage'; stage.mkdir(exist_ok=True)
    header = sports.pack(r, args.work, stage, tiles, materials, lookup)
    packed = (stage / 'sports-vehicle-models.bin').read_bytes()
    old_size = struct.unpack_from('<I', packed, 8)[0]
    x, y, w, h = tiles[materials[1]['hash']]['rect']
    header['models'][KEY]['paintUv'] = [(x + w / 2) / SIZE, (y + h / 2) / SIZE]
    encoded = json.dumps(header, separators=(',', ':')).encode(); encoded += b' ' * (-(12 + len(encoded)) % 4)
    (args.out / 'svj-vehicle-models.bin').write_bytes(b'DECVM001' + struct.pack('<I', len(encoded)) + encoded + packed[12 + old_size:])
    (stage / 'sports-vehicle-models.bin').unlink()
    if any(sports.sha(ROOT / 'assets' / name) != digest for name, digest in protected.items()): raise RuntimeError('An existing pack changed')
    meta = header['models'][KEY]
    receipt = dict(source=dict(url=SOURCE_URL, mirrorCommit=COMMIT, sha256=SOURCE_SHA, bytes=args.source.stat().st_size, embeddedCredit=r['g'].js['asset']['extras']),
                   nearSourceExact=True, sourceTriangles=meta['sourceTriangles'], model=meta, protectedPacks=protected,
                   changes='Uniform metre fit; rigid neutral wheel pose; separate paired wheels/doors by source side; fitted game cabin and see-through canopy; body pigment neutralized for resprays; far LOD only decimated',
                   output={p.name: dict(bytes=p.stat().st_size, sha256=sports.sha(p)) for p in args.out.glob('svj-vehicle-*')},
                   converterSHA256=sports.sha(Path(__file__)), helperSHA256=sports.sha(helper))
    (args.work / 'svj-conversion-receipt.json').write_text(json.dumps(receipt, indent=2))
    print(json.dumps({key: meta[key] for key in ('triangles', 'farTriangles', 'dims')}, indent=2))


if __name__ == '__main__': main()
