#!/usr/bin/env python3
"""Convert the licensed Hari C8 source into its own source-preserving sports pack.

Usage: python3 tools/sports_vehicle_models.py SOURCE/scene.gltf --out /tmp/c8/assets --work /tmp/c8/work
Requires Python/NumPy/Pillow and Blender. Existing vehicle packs are never written.
"""
import argparse
import copy
import hashlib
import json
import struct
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

import vehicle_models as legacy

ROOT = Path(__file__).resolve().parent.parent
KEY = 'c8_hari'
SIZE = 4096
SOURCE_SHA = '840aac54739d1c18b3996eebcdfbbc66bc4d9531a5a578b80c30e5923053699b'
SOURCE_BIN_SHA = '50bd85f55741f7135783f8c0b3d9fa0422b16dbaef78836bbb15dd831574fd14'
FRAME = np.array([[0., 0., -1.], [0., 1., 0.], [1., 0., 0.]])


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def source_model(path):
    if sha(path) != SOURCE_SHA or sha(path.parent / 'scene.bin') != SOURCE_BIN_SHA:
        raise RuntimeError('Unexpected source version; use the pinned Hari source')
    g = legacy.Gltf(str(path))
    prims = legacy.load_primitives(g)
    legacy.to_game_frame(prims, '-z')
    whole = np.concatenate([p['P'][np.unique(p['index'])] for p in prims])
    tyre = np.concatenate([p['P'] for p in prims if 'Tire Treads' in p['node'] or 'Tire Sidewall' in p['node']])
    scale = 4.69 / np.ptp(whole[:, 0])
    shift = np.array([-(whole[:, 0].min() + whole[:, 0].max()) / 2, -tyre[:, 1].min(), -(whole[:, 2].min() + whole[:, 2].max()) / 2])
    for p in prims:
        p['P'] = (p['P'] + shift) * scale
    matrices = {}
    def walk(i, parent):
        node = g.js['nodes'][i]
        matrix = parent @ legacy.node_matrix(node)
        matrices[node.get('name', '')] = matrix
        for child in node.get('children', []):
            walk(child, matrix)
    for node in g.js['scenes'][g.js.get('scene', 0)]['nodes']:
        walk(node, np.eye(4))
    def pivot(name):
        return (FRAME @ matrices[name][:3, 3] + shift) * scale
    def axis(name, column):
        value = FRAME @ matrices[name][:3, column]
        return value / np.linalg.norm(value)
    parts, owners, pane_ids = {}, [], {}
    def add(name, pi, ti, pane=None):
        parts.setdefault(name, []).append((pi, ti))
        if pane is not None:
            pane_ids[(pi, ti)] = pane
        owners.append((pi, ti))
    wheel_names = ['Front Left Wheel', 'Front Right Wheel', 'Rear Left Wheel', 'Rear Right Wheel']
    wheels = []
    for i, name in enumerate(wheel_names):
        center = pivot(name)
        axle = axis(name, 0)
        if axle[2] < 0:
            axle *= -1
        rubber = np.concatenate([p['P'] for p in prims if '/' + name + '/' in p['path'] and ('Tire Treads' in p['node'] or 'Tire Sidewall' in p['node'])])
        delta = rubber - center
        radial = np.sqrt(np.maximum(0, np.sum(delta * delta, axis=1) - (delta @ axle) ** 2))
        wheels.append(dict(x=float(center[0]), y=float(center[1]), z=float(center[2]), r=float(np.percentile(radial, 99.8)),
                           width=float(np.ptp(delta @ axle)), axle=axle.tolist(), side=-1 if center[2] < 0 else 1,
                           front='Front' in name, caliper='wheel%d.caliper' % i, sourceNode=name))
    door_records = {}
    for label, name, side in [('left', 'Left Door', -1), ('right', 'Right Door', 1)]:
        door_axis = axis(name, 2)
        if door_axis[1] < 0:
            door_axis *= -1
        door_records[label] = dict(side=side, hinge=pivot(name).tolist(), axis=door_axis.tolist(),
                                  sourceNode=name, pivotEvidence='Authored GLTF parent translation near the front door seam, not body centre', parts={})
    for pi, p in enumerate(prims):
        material = g.js['materials'][p['material']]
        mi, node, path = p['material'], p['node'], p['path']
        triangle_points = p['P'][p['index']]
        centers = triangle_points.mean(1)
        normals = np.cross(triangle_points[:, 1] - triangle_points[:, 0], triangle_points[:, 2] - triangle_points[:, 0])
        wheel = next((i for i, name in enumerate(wheel_names) if '/' + name + '/' in path), None)
        caliper = next((i for i, name in enumerate(wheel_names) if '/' + name.replace(' Wheel', ' Brake Caliper') + '/' in path), None)
        door = 'left' if '/Left Door/' in path else 'right' if '/Right Door/' in path else None
        for ti, tri in enumerate(p['index']):
            center = centers[ti]
            normal = normals[ti]
            if wheel is not None:
                add('wheel%d.%s' % (wheel, 'tyre' if mi in (39, 40) else 'rim'), pi, ti)
            elif caliper is not None:
                add('wheel%d.caliper' % caliper, pi, ti)
            elif door:
                prefix = 'doorLeft' if door == 'left' else 'doorRight'
                # The author's door-glass objects also contain the outboard
                # mirror/indicator covers. They remain on the native door,
                # but are not breakable cabin window panes.
                transparent_role = 'opticalGlass' if abs(center[2]) > .9 else 'glass'
                role = 'paint' if mi == 0 else transparent_role if material.get('alphaMode') == 'BLEND' else 'indicator' if mi in (14, 15) else 'cabin' if mi in (20, 23, 27, 28, 31, 34, 44, 46) else 'trim'
                name = prefix + '.' + role
                add(name, pi, ti, (0 if door == 'left' else 2) if role == 'glass' else None)
                door_records[door]['parts'][role] = [name]
            elif mi in (12, 13, 16, 17, 18):
                kind = 'head' if mi in (12, 13) else 'tail'
                add(kind + ('Left' if center[2] < 0 else 'Right'), pi, ti)
            elif mi in (14, 15):
                add('indicatorLeft' if center[2] < 0 else 'indicatorRight', pi, ti)
            elif material.get('alphaMode') == 'BLEND':
                cabin = mi == 36 or mi == 37 and center[1] > .78 and -.9 < center[0] < 1.16 and abs(center[2]) < .9
                if cabin:
                    pane = 1 if mi == 36 else 4 if abs(normal[1]) > np.linalg.norm(normal) * .93 else (0 if center[2] < 0 else 2) if abs(normal[2]) > abs(normal[0]) else 1 if center[0] > .2 else 3
                    add('glass', pi, ti, pane)
                else:
                    add('trunk.glass' if mi == 45 else 'opticalGlass', pi, ti)
            elif '/Trunk [or Hood]/' in path:
                add('trunk.paint' if mi == 0 else 'trunk.trim', pi, ti)
            elif '/Frunk/' in path:
                add('hood' if mi == 0 else 'hood.trim', pi, ti)
            elif mi == 0:
                add('panels' if center[1] > .75 else 'shell', pi, ti)
            elif mi == 30:
                add('cabin.seats', pi, ti)
            elif '/Interior' in path or '/Steering Wheel' in path or '/Speedo Needle' in path or node.startswith('Roof_Interior'):
                add('cabin.controls' if '/Steering Wheel' in path or '/Interior Digitals' in path or '/Speedo Needle' in path else 'cabin', pi, ti)
            else:
                add('trim', pi, ti)
    source_count = sum(len(p['index']) for p in prims)
    if len(owners) != source_count or len(set(owners)) != source_count or source_count != 263683:
        raise RuntimeError('Every original source face must belong to one part')
    for label, door in door_records.items():
        points = np.concatenate([prims[pi]['P'][prims[pi]['index'][ti]] for names in door['parts'].values() for name in names for pi, ti in parts[name]])
        lo, hi = points.min(0), points.max(0)
        door['bounds'] = dict(x0=float(lo[0]), x1=float(hi[0]), y0=float(lo[1]), y1=float(hi[1]), z0=float(lo[2]), z1=float(hi[2]))
    roles = dict(shell=['shell'], panels=['panels', 'doorLeft.paint', 'doorRight.paint', 'trunk.paint'],
                 hood=['hood'], glass=['glass', 'doorLeft.glass', 'doorRight.glass'],
                 trim=['trim', 'hood.trim', 'trunk.trim', 'doorLeft.trim', 'doorRight.trim', 'indicatorLeft', 'indicatorRight', 'doorLeft.indicator', 'doorRight.indicator'],
                 cabin=['cabin', 'cabin.seats', 'cabin.controls', 'doorLeft.cabin', 'doorRight.cabin'],
                 opticalGlass=['opticalGlass', 'trunk.glass', 'doorLeft.opticalGlass', 'doorRight.opticalGlass'])
    for role in roles:
        roles[role] = [name for name in roles[role] if name in parts]
    glass_points = np.concatenate([prims[pi]['P'][prims[pi]['index'][ti]] for name in roles['glass'] for pi, ti in parts[name]])
    glass_points = glass_points.reshape(-1, 3)
    all_points = np.concatenate([p['P'][np.unique(p['index'])] for p in prims])
    lo, hi = all_points.min(0), all_points.max(0)
    belt = float(np.percentile(glass_points[:, 1], 2)); roof = float(np.percentile(glass_points[:, 1], 99))
    pane_points = lambda pane: np.concatenate([prims[pi]['P'][prims[pi]['index'][ti]] for name in roles['glass'] for pi, ti in parts[name] if pane_ids[(pi, ti)] == pane]).reshape(-1, 3)
    def ends(pane, fallback):
        p = pane_points(pane)
        a, b = p[:, 1].min(), p[:, 1].max()
        return float(np.median(p[p[:, 1] < a + .15 * (b - a), 0])), float(np.median(p[p[:, 1] > b - .15 * (b - a), 0]))
    xf, rf = ends(1, 0); xb, rb = ends(3, 0)
    body = np.concatenate([p['P'] for p in prims if p['material'] == 0])
    profile, sections = [], []
    for x in np.linspace(lo[0], hi[0], 41):
        near = body[np.abs(body[:, 0] - x) < .12]
        if not len(near): near = body[np.argsort(np.abs(body[:, 0] - x))[:20]]
        profile.append(float(near[:, 1].max()))
        sections.append([float(near[:, 1].min()), float(near[:, 1].max()), float(np.abs(near[:, 2]).max())])
    front_hinge = pivot('Frunk')
    lamps = {}
    for name in ('headLeft', 'headRight', 'tailLeft', 'tailRight'):
        triangles = np.asarray([prims[pi]['P'][prims[pi]['index'][ti]] for pi, ti in parts[name]])
        areas = np.linalg.norm(np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]), axis=1)
        point = np.average(triangles.mean(1), axis=0, weights=np.maximum(areas, 1e-12))
        span = np.ptp(triangles.reshape(-1, 3), axis=0)
        lamps[name] = dict(x=float(point[0]), y=float(point[1]), z=float(point[2]), size=float(max(span[1], span[2]) * .4))
    metadata = dict(type=KEY, kind='car', title='2019 Chevrolet Corvette C8 Stingray', author='Hari (Hari31)',
                    dims=(hi - lo).tolist(), x0=float(lo[0]), x1=float(hi[0]), wheels=wheels, lamps=lamps,
                    glass=dict(base=belt, roof=roof, xf=xf, rf=rf, xb=xb, rb=rb,
                               halfBase=float(np.percentile(np.abs(glass_points[glass_points[:, 1] < belt + .1, 2]), 85)),
                               halfTop=float(np.percentile(np.abs(glass_points[glass_points[:, 1] > roof - .1, 2]), 85)), crown=max(0, float(hi[1]) - roof - .015)),
                    hinge=front_hinge[:2].tolist(), sill=float(np.percentile(body[:, 1], 2)), profile=profile, section=sections,
                    hasInterior=True, doors=door_records, roleParts=roles, paintTexture=True, paintColor='#ffffff',
                    normalScale=32767, sourceTriangles=source_count, sourceUniformScale=scale, sourceShift=shift.tolist(),
                    hasEmissiveAtlas=True, lampVertexColorsBaked=False,
                    source='https://sketchfab.com/3d-models/2019-chevrolet-corvette-c8-stingray-790c40ccff6843eab0b7b4bd18421ff8',
                    license='CC BY 4.0', sourceNodePivots='Authored door/wheel node transforms retained; all vertices rigidly rotated and uniformly fitted to4.69m')
    return dict(g=g, prims=prims, parts=parts, pane_ids=pane_ids, meta=metadata)


def material_image(g, material, field):
    item = material.get('pbrMetallicRoughness', {}).get(field) if field != 'emissiveTexture' else material.get(field)
    return g.image(item['index'])[1].convert('RGBA') if item else None


def multiplied(image, factor):
    values = np.asarray(image).astype(float)
    if not np.all(np.asarray(factor[:3]) == 1):
        rgb = values[:, :, :3] / 255
        linear = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4) * np.asarray(factor[:3])
        values[:, :, :3] = np.where(linear <= .0031308, linear * 12.92, 1.055 * np.power(linear, 1 / 2.4) - .055) * 255
    values[:, :, 3] *= factor[3]
    return Image.fromarray(np.uint8(np.clip(np.round(values), 0, 255)), 'RGBA')


def atlas(r, output):
    tiles, by_material = {}, {}
    for mi, material in enumerate(r['g'].js['materials']):
        pbr = material.get('pbrMetallicRoughness', {})
        factor = list(pbr.get('baseColorFactor', [1, 1, 1, 1]))
        if material.get('alphaMode') not in ('BLEND', 'MASK'): factor[3] = 1
        # Only the untextured authored body pigment becomes a respray template.
        if mi == 0: factor[:3] = [1, 1, 1]
        albedo = material_image(r['g'], material, 'baseColorTexture')
        orm = material_image(r['g'], material, 'metallicRoughnessTexture')
        emission = material_image(r['g'], material, 'emissiveTexture')
        images = [im for im in (albedo, orm, emission) if im]
        size = (max(im.width for im in images), max(im.height for im in images)) if images else (8, 8)
        albedo = multiplied(albedo or Image.new('RGBA', size, (255, 255, 255, 255)), factor)
        orm = (orm or Image.new('RGBA', size, (255, 255, 255, 255))).convert('RGB')
        emission = multiplied(emission or Image.new('RGBA', size, (255, 255, 255, 255)), material.get('emissiveFactor', [0, 0, 0]) + [1]).convert('RGB')
        albedo = albedo.resize(size, Image.Resampling.LANCZOS); orm = orm.resize(size, Image.Resampling.LANCZOS); emission = emission.resize(size, Image.Resampling.LANCZOS)
        key = hashlib.sha256(albedo.tobytes() + orm.tobytes() + emission.tobytes() + str(size).encode()).hexdigest()
        tiles.setdefault(key, dict(albedo=albedo, orm=orm, emissive=emission, users=[]))['users'].append(mi)
        by_material[mi] = dict(hash=key, finish=[pbr.get('roughnessFactor', 1), pbr.get('metallicFactor', 1)])
    white = Image.new('RGBA', (8, 8), (255, 255, 255, 255)); neutral_orm = Image.new('RGB', (8, 8), (255, 255, 255)); black = Image.new('RGB', (8, 8), (0, 0, 0))
    white_key = hashlib.sha256(white.tobytes() + neutral_orm.tobytes() + black.tobytes() + str(white.size).encode()).hexdigest()
    tiles.setdefault(white_key, dict(albedo=white, orm=neutral_orm, emissive=black, users=[]))
    rects = legacy.shelf_pack({k: t['albedo'].size for k, t in tiles.items()}, SIZE, SIZE)
    if rects is None: raise RuntimeError('Native source tiles do not fit4096; do not silently downsample')
    for channel, mode, background in [('albedo', 'RGBA', (0, 0, 0, 0)), ('orm', 'RGB', (255, 255, 255)), ('emissive', 'RGB', (0, 0, 0))]:
        image = Image.new(mode, (SIZE, SIZE), background)
        for key, (x, y) in rects.items():
            tile = tiles[key][channel]; w, h = tile.size
            padded = tile.resize((w + 4, h + 4), Image.Resampling.NEAREST); padded.paste(tile, (2, 2)); image.paste(padded, (x - 2, y - 2))
            tiles[key]['rect'] = [x, y, w, h]
        image.save(output / ('sports-vehicle-' + channel + '.webp'), format='WEBP', lossless=True, method=6)
        image.resize((2048, 2048), Image.Resampling.LANCZOS).save(output / ('sports-vehicle-' + channel + '-low.webp'), format='WEBP', lossless=True, method=6)
    r['meta']['paintUv'] = [(rects[white_key][0] + 4) / SIZE, (rects[white_key][1] + 4) / SIZE]
    return tiles, by_material


def prepare_geometry(r, work):
    arrays, manifest, lookup = {}, {}, {}
    for name, faces in r['parts'].items():
        groups = {}
        for pi, ti in faces: groups.setdefault(r['pane_ids'].get((pi, ti)), []).append((pi, ti))
        for pane, items in groups.items():
            P, N, UV, I, M, ids = [], [], [], [], [], {}
            for pi, ti in items:
                p = r['prims'][pi]; tri = []
                for vi in p['index'][ti]:
                    token = (pi, int(vi))
                    if token not in ids:
                        ids[token] = len(P); P.append(p['P'][vi]); N.append(p['N'][vi]); UV.append(p['UV'][vi] if p['UV'] is not None else [.5, .5])
                    tri.append(ids[token])
                I.append(tri); M.append(p['material'])
            if name.endswith('.tyre'): near, far = .45, .06
            elif name.endswith('.rim'): near, far = .36, .055
            elif name == 'cabin.seats': near, far = 1., .08
            elif name == 'cabin.controls': near, far = .45, .05
            elif 'paint' in name or name in ('shell', 'panels', 'hood'): near, far = .65, .04
            elif 'glass' in name.lower(): near, far = .6, .08
            elif name.startswith(('head', 'tail', 'indicator')) or name.endswith('.indicator'): near, far = .6, .10
            elif 'cabin' in name: near, far = .28, .02
            else: near, far = .20, .025
            for suffix, ratio in [('', near), ('Far', far)]:
                key = KEY + '.' + name + suffix + (':' + str(pane) if pane is not None else '')
                for field, values, dtype in [('p', P, np.float32), ('n', N, np.float32), ('uv', UV, np.float32), ('i', I, np.int32), ('m', M, np.uint16)]: arrays[key + '.' + field] = np.asarray(values, dtype=dtype)
                manifest[key] = dict(ratio=ratio, preserveSourceNormals=True)
                lookup[key] = [name + suffix, pane]
    np.savez(work / 'parts-input.npz', **arrays)
    (work / 'parts-manifest.json').write_text(json.dumps(manifest, indent=2))
    (work / 'parts-lookup.json').write_text(json.dumps(lookup, indent=2))
    return lookup


def pack(r, work, output, tiles, materials, lookup):
    reduced = np.load(work / 'parts-output.npz'); blob = legacy.Blob(); meta = copy.deepcopy(r['meta'])
    paint_x, paint_y, paint_w, paint_h = tiles[materials[0]['hash']]['rect']
    meta['paintUv'] = [(paint_x + paint_w / 2) / SIZE, (paint_y + paint_h / 2) / SIZE]
    whole = np.concatenate([p['P'] for p in r['prims']]); lo, hi = whole.min(0), whole.max(0); extent = hi - lo
    meta['quant'] = lo.tolist() + extent.tolist(); meta['parts'] = {}
    groups = {}
    for ident, (part, pane) in lookup.items():
        group = groups.setdefault(part, {})
        group[pane] = ident
    normal_repairs = []
    for part, panes in groups.items():
        P, N, UV, A, T, F, C, I = [], [], [], [], [], [], [], []
        pane_counts = [0] * 5 if any(p is not None for p in panes) else None
        for pane, ident in sorted(panes.items(), key=lambda row: -1 if row[0] is None else row[0]):
            positions, normals, uv, indices, mi = [reduced[ident + '.' + f] for f in ('p', 'n', 'uv', 'i', 'm')]
            unique = {}
            for ti, tri in enumerate(indices):
                material = materials[int(mi[ti])]; tile = tiles[material['hash']]; x, y, w, h = tile['rect']; packed = []
                for vi in tri:
                    vi = int(vi); token = (positions[vi].tobytes(), normals[vi].tobytes(), uv[vi].tobytes(), int(mi[ti]))
                    if token not in unique:
                        unique[token] = len(P); P.append(positions[vi]); normal = normals[vi]
                        if np.linalg.norm(normal) < 1e-8:
                            # Degenerate decorative source faces can yield a
                            # zero DataTransfer normal after collapse. Use the
                            # closest same-material authored vertex; never
                            # invent smooth body shading or a fixed up vector.
                            choices = []
                            for source in r['prims']:
                                if source['material'] != int(mi[ti]): continue
                                distance = np.linalg.norm(source['P'] - positions[vi], axis=1)
                                valid = np.linalg.norm(source['N'], axis=1) > .5
                                distance[~valid] = np.inf
                                which = int(np.argmin(distance))
                                choices.append((distance[which], source, which))
                            distance, source, which = min(choices, key=lambda row: row[0])
                            if distance > .01: raise RuntimeError('Missing close authored normal for collapsed trim')
                            normal = source['N'][which]
                            normal_repairs.append(dict(part=part, position=positions[vi].tolist(), material=int(mi[ti]), sourceNode=source['node'], sourceVertex=which, distance=float(distance)))
                        N.append(normal); raw = uv[vi]; wrapped = np.mod(raw, 1)
                        A.append(raw); T.append([x / SIZE, y / SIZE, w / SIZE, h / SIZE]); UV.append([(x + wrapped[0] * w) / SIZE, (y + wrapped[1] * h) / SIZE]); F.append(material['finish'])
                        # Source has no COLOR_0. Material maps already provide
                        # lamp colour; baking it here would multiply it twice.
                        C.append([255, 255, 255])
                    packed.append(unique[token])
                I.append(packed)
            if pane is not None: pane_counts[pane] = len(indices)
        positions = np.asarray(P); normals = np.asarray(N); normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
        count = len(P); normalised_part = part[:-3] if part.endswith('Far') else part
        origin = [0, 0, 0]
        if normalised_part.startswith('wheel') and normalised_part.endswith(('.tyre', '.rim', '.caliper')):
            wheel = meta['wheels'][int(normalised_part[5:normalised_part.index('.')])]; origin = [wheel['x'], wheel['y'], wheel['z']]
        meta['parts'][part] = dict(origin=origin, vertices=count, triangles=len(I))
        if pane_counts is not None: meta['parts'][part]['panes'] = pane_counts
        fields = [('p', np.round((positions - lo) / extent * 65534 - 32767).astype(np.int16), 'i2'), ('n', np.round(normals * 32767).astype(np.int16), 'i2'),
                  ('uv', np.round(np.asarray(UV) * 65535).astype(np.uint16), 'u2'), ('a', np.asarray(A, dtype=np.float32), 'f4'), ('t', np.round(np.asarray(T) * 65535).astype(np.uint16), 'u2'),
                  ('f', np.round(np.asarray(F) * 255).astype(np.uint8), 'u1'), ('i', np.asarray(I, dtype=np.uint32 if count > 65535 else np.uint16), 'u4' if count > 65535 else 'u2')]
        if part.startswith(('head', 'tail', 'indicator')) or '.indicator' in part: fields.append(('c', np.asarray(C, dtype=np.uint8), 'u1'))
        for field, values, kind in fields: blob.add(KEY + '.' + part + '.' + field, values, kind)
    meta['lodParts'] = {name: name + 'Far' for name in meta['parts'] if not name.endswith('Far')}
    meta['triangles'] = sum(p['triangles'] for n, p in meta['parts'].items() if not n.endswith('Far'))
    meta['farTriangles'] = sum(p['triangles'] for n, p in meta['parts'].items() if n.endswith('Far'))
    meta['rolePanes'] = {'glass': [sum(meta['parts'][p].get('panes', [0] * 5)[i] for p in meta['roleParts']['glass']) for i in range(5)]}
    meta['rolePanes']['glassFar'] = [sum(meta['parts'][p + 'Far'].get('panes', [0] * 5)[i] for p in meta['roleParts']['glass']) for i in range(5)]
    for role, names in list(meta['roleParts'].items()):
        meta['roleParts'][role + 'Far'] = [name + 'Far' for name in names]
        meta['lodParts'][role] = role + 'Far'
    header = dict(version=1, atlas=[SIZE, SIZE], normalScale=32767, finish='roughnessMetalness', models={KEY: meta}, arrays=blob.arrays)
    encoded = json.dumps(header, separators=(',', ':')).encode(); encoded += b' ' * (-(12 + len(encoded)) % 4)
    (output / 'sports-vehicle-models.bin').write_bytes(b'DECVM001' + struct.pack('<I', len(encoded)) + encoded + blob.data)
    (work / 'model-metadata.json').write_text(json.dumps(meta, indent=2))
    (work / 'sports-models-header.json').write_text(json.dumps(header, indent=2))
    (work / 'source-normal-repairs.json').write_text(json.dumps(normal_repairs, indent=2))
    return header


def main():
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('source', type=Path); parser.add_argument('--out', type=Path, default=ROOT / 'assets'); parser.add_argument('--work', type=Path, default=ROOT / 'dist/sports-vehicle-converter'); parser.add_argument('--inspect-only', action='store_true')
    args = parser.parse_args(); args.work.mkdir(parents=True, exist_ok=True)
    r = source_model(args.source)
    (args.work / 'source-metadata.json').write_text(json.dumps(r['meta'], indent=2))
    (args.work / 'source-partition.json').write_text(json.dumps({name: dict(triangles=len(faces), sourceFaces=[list(p) for p in faces]) for name, faces in r['parts'].items()}, indent=2))
    if args.inspect_only:
        print(json.dumps({name: len(faces) for name, faces in r['parts'].items()}, indent=2)); return
    args.out.mkdir(parents=True, exist_ok=True)
    # Other agents may rebuild the separate approved pack concurrently. Only
    # the immutable original pack is asserted here; this converter writes
    # exclusively sports-vehicle-* files in the requested output directory.
    protected = {str(ROOT / 'assets' / name): sha(ROOT / 'assets' / name) for name in ('vehicle-models.bin', 'vehicle-atlas.webp')}
    tiles, materials = atlas(r, args.out); lookup = prepare_geometry(r, args.work)
    helper = ROOT / 'tools/approved_vehicle_models_prepare.py'
    subprocess.run(['blender', '-b', '--threads', '1', '-P', str(helper), '--', 'simplify', str(args.work / 'parts-input.npz'), str(args.work / 'parts-output.npz'), str(args.work / 'parts-manifest.json')], check=True)
    header = pack(r, args.work, args.out, tiles, materials, lookup)
    for path, before in protected.items():
        if sha(path) != before: raise RuntimeError('An existing vehicle pack/atlas changed')
    receipt = dict(source={name: sha(args.source.parent / name) for name in ('scene.gltf', 'scene.bin', 'license.txt')}, protectedFiles=protected,
                   sourceTriangles=r['meta']['sourceTriangles'], allSourceFacesOwnedExactlyOnce=True, models=header['models'],
                   output={p.name: dict(bytes=p.stat().st_size, sha256=sha(p)) for p in args.out.glob('sports-vehicle-*')},
                   normalPreservation='Original source normals; exact ratio1 bypass and custom-corner DataTransfer after reduction; 16-bit normal quantization',
                   sourceNormalRepairs=json.loads((args.work / 'source-normal-repairs.json').read_text()),
                   converterSHA256=sha(Path(__file__)), helperSHA256=sha(helper), atlasTiles={k: dict(rect=t['rect'], materials=t['users']) for k, t in tiles.items()}, sourcePixelsDownsampled=False)
    (args.work / 'sports-conversion-receipt.json').write_text(json.dumps(receipt, indent=2))
    print(json.dumps({k: header['models'][KEY][k] for k in ('triangles', 'farTriangles', 'dims', 'doors', 'rolePanes')}, indent=2))


if __name__ == '__main__': main()
