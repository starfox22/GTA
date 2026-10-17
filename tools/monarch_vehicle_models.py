#!/usr/bin/env python3
"""Convert licensed downloaded car recipes into one independent Monarch pack.

python3 tools/monarch_vehicle_models.py recipes.json --out work/monarch-assets --work work/monarch-convert
python3 tools/monarch_vehicle_models.py --inspect decoded.glb --forward +z

Recipes select original scene-traversal primitives, material/path regexes and
optional triangle-centroid bounds. Every source face has exactly one owner.
Near geometry is never simplified. Only Far parts use the existing Blender
source-normal transfer helper. All paths and source hashes are recorded.
"""
import argparse
import copy
import hashlib
import json
import re
import struct
import subprocess
from urllib.parse import unquote
from pathlib import Path

import numpy as np
from PIL import Image

import vehicle_models as legacy
import approved_vehicle_models as approved
import sports_vehicle_models as sports

ROOT = Path(__file__).resolve().parent.parent
CHANNELS = ('albedo', 'orm', 'emissive', 'normal')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class SourceGltf(legacy.Gltf):
    def accessor(self, index):
        # glTF signed normalized integers clamp their minimum to -1.
        out = super().accessor(index)
        a = self.js['accessors'][index]
        if a.get('normalized') and a['componentType'] in (5120, 5122):
            out = np.maximum(out, -1.)
        return out


def read_source(path, forward='+z'):
    g = SourceGltf(str(path))
    if 'EXT_meshopt_compression' in g.js.get('extensionsRequired', []):
        raise RuntimeError('Decode the native GLB first with monarch_vehicle_decode.cjs; retain its receipt')
    for texture in g.js.get('textures', []):
        if 'source' not in texture:
            extension = texture.get('extensions', {}).get('EXT_texture_webp')
            if not extension:
                raise RuntimeError('Unsupported compressed texture; prepare an explicit decoded source')
            texture['source'] = extension['source']
    prims = legacy.load_primitives(g)
    at = 0
    def walk(index, parent):
        nonlocal at
        node = g.js['nodes'][index]
        matrix = parent @ legacy.node_matrix(node)
        if any(abs(value) > 1e-10 for value in node.get('weights', [])):
            raise RuntimeError('A nonzero authored morph pose requires explicit source preparation')
        if 'mesh' in node:
            mesh = g.js['meshes'][node['mesh']]
            if any(abs(value) > 1e-10 for value in mesh.get('weights', [])):
                raise RuntimeError('A nonzero authored morph pose requires explicit source preparation')
            for primitive in mesh['primitives']:
                if primitive.get('mode', 4) != 4:
                    raise RuntimeError('Non-triangle source primitive must be reviewed explicitly')
                attributes = primitive['attributes']
                p = prims[at]
                p['sourceNode'] = index
                p['COLOR'] = g.accessor(attributes['COLOR_0']) if 'COLOR_0' in attributes else None
                p['UV1'] = g.accessor(attributes['TEXCOORD_1']) if 'TEXCOORD_1' in attributes else None
                p['sourcePivot'] = matrix[:3, 3].copy()
                p['authoredNormals'] = 'NORMAL' in attributes
                at += 1
        for child in node.get('children', []):
            walk(child, matrix)
    for index in g.js['scenes'][g.js.get('scene', 0)]['nodes']:
        walk(index, np.eye(4))
    if at != len(prims) or not prims:
        raise RuntimeError('Source scene traversal mismatch or empty source')
    legacy.to_game_frame(prims, forward)
    for p in prims:
        if p['material'] is None:
            g.js.setdefault('materials', []).append({})
            p['material'] = len(g.js['materials']) - 1
    return g, prims


def selected(p, pi, selector, materials):
    if isinstance(selector, list):
        return np.logical_or.reduce([selected(p, pi, item, materials) for item in selector])
    selector = selector or {}
    ids = selector.get('primitives')
    if ids is not None and pi not in (ids if isinstance(ids, list) else [ids]):
        return np.zeros(len(p['index']), dtype=bool)
    for key, value in [('path', p['path']), ('material', materials[p['material']].get('name', ''))]:
        if selector.get(key) and not re.search(selector[key], value, re.I):
            return np.zeros(len(p['index']), dtype=bool)
    out = np.ones(len(p['index']), dtype=bool)
    centres = p['P'][p['index']].mean(1)
    for axis, limits in selector.get('bounds', {}).items():
        values = centres[:, 'xyz'.index(axis)]
        if limits[0] is not None: out &= values >= limits[0]
        if limits[1] is not None: out &= values <= limits[1]
    return out


def source_model(recipe):
    source = Path(recipe['source'])
    if sha(source) != recipe['sourceSHA256']:
        raise RuntimeError('Unexpected pinned source: ' + str(source))
    if source.suffix.lower() == '.gltf':
        document = json.loads(source.read_text())
        external = {entry['uri'] for entry in document.get('buffers', []) + document.get('images', []) if entry.get('uri') and not entry['uri'].startswith('data:')}
        expected = recipe.get('sourceFilesSHA256', {})
        for uri in external:
            if uri not in expected or sha(source.parent / unquote(uri)) != expected[uri]:
                raise RuntimeError('Unexpected or unpinned glTF companion: ' + uri)
    if not recipe.get('license') or not recipe.get('author') or not recipe.get('sourceUrl'):
        raise RuntimeError('Source-specific attribution is mandatory')
    key = recipe['key']
    if not key.startswith('monarch_'):
        raise RuntimeError('Monarch source keys must use monarch_ prefix')
    if recipe.get('sourceRecipe') == 'hari_c8':
        # Reuse the audited source identities/parts/pivots, not its reduced game
        # pack. The Monarch pair receives the full original 263,683 near faces.
        r = sports.source_model(source)
        for p in r['prims']: p['COLOR'] = None; p['UV1'] = None
        for wheel in r['meta']['wheels']:
            wheel.update(sourceCenter=[wheel['x'], wheel['y'], wheel['z']], sourceRotation=np.eye(3).tolist())
        r['meta'].update(type=key, gameTypes=recipe['gameTypes'], sourceSHA256=recipe['sourceSHA256'], nearReachMetres=recipe.get('nearReachMetres', 18),
                         seats=recipe.get('seats', dict(hip=[.035, .23, -.464], wheel=[.31392, .72501, -.358883], radius=.165, tilt=.25284)))
        r.update(recipe=recipe, scale=1., shift=np.zeros(3))
        return r
    prepared = Path(recipe.get('preparedSource', source))
    if prepared != source and sha(prepared) != recipe.get('preparedSHA256'):
        raise RuntimeError('Unexpected losslessly decoded source: ' + str(prepared))
    g, prims = read_source(prepared, recipe.get('forward', '+z'))
    yaw = float(recipe.get('sourceYawRadians', 0))
    rotation = np.asarray(recipe.get('sourceRotation', [[np.cos(yaw), 0, np.sin(yaw)], [0, 1, 0], [-np.sin(yaw), 0, np.cos(yaw)]]), dtype=float)
    if not np.allclose(rotation @ rotation.T, np.eye(3), atol=1e-6) or np.linalg.det(rotation) < .99999:
        raise RuntimeError('Source orientation must be one rigid rotation')
    for p in prims:
        p['P'] = p['P'] @ rotation.T; p['N'] = p['N'] @ rotation.T
    parts, pane_ids, wheel_meta = {}, {}, []
    owned = [np.zeros(len(p['index']), dtype=bool) for p in prims]
    excluded = set(recipe.get('excludePrimitives', []))
    for pi in excluded: owned[pi][:] = True
    def claim(name, pi, mask, pane=None):
        if np.any(owned[pi] & mask):
            raise RuntimeError('Source triangle claimed twice: ' + name + ' primitive ' + str(pi))
        ids = np.flatnonzero(mask)
        if not len(ids): return
        owned[pi] |= mask
        parts.setdefault(name, []).extend((pi, int(ti)) for ti in ids)
        if pane is not None:
            for ti in ids: pane_ids[pi, int(ti)] = pane
    wheels = recipe.get('wheels', [])
    if len(wheels) != 4 or {(bool(w['front']), int(w['side'])) for w in wheels} != {(True, -1), (True, 1), (False, -1), (False, 1)}:
        raise RuntimeError('Exactly four independently identified source wheel positions are required')
    for wi, wheel in enumerate(wheels):
        choices = {}
        for role in ('tyre', 'rim', 'caliper'):
            if role not in wheel: continue
            choices[role] = [(pi, selected(p, pi, wheel[role], g.js['materials'])) for pi, p in enumerate(prims)]
        tyre_faces = [(pi, mask) for pi, mask in choices.get('tyre', []) if mask.any()]
        if not tyre_faces:
            raise RuntimeError('Missing source tyre geometry for wheel ' + str(wi))
        points = np.concatenate([prims[pi]['P'][np.unique(prims[pi]['index'][mask])] for pi, mask in tyre_faces])
        normals = np.concatenate([prims[pi]['N'][np.unique(prims[pi]['index'][mask])] for pi, mask in tyre_faces])
        center, radius, width, axle = approved.circle(points, normals)
        center = np.asarray(wheel.get('center', center), dtype=float)
        axle = np.asarray(wheel.get('axle', axle), dtype=float); axle /= np.linalg.norm(axle)
        if axle[2] < 0: axle *= -1
        radius = float(wheel.get('r', radius)); width = float(wheel.get('width', width))
        if not np.isfinite(center).all() or radius <= 0 or not np.isfinite(radius) or abs(axle[2]) < .7:
            raise RuntimeError('Invalid source hub/circle/axle for wheel ' + str(wi))
        cross = np.cross(axle, [0., 0., 1.]); cosine = float(axle[2])
        skew = np.array([[0., -cross[2], cross[1]], [cross[2], 0., -cross[0]], [-cross[1], cross[0], 0.]])
        rotation = np.eye(3) + skew + skew @ skew / max(1e-12, 1 + cosine) if wheel.get('neutralize', True) else np.eye(3)
        # Duplicate only a selected source primitive subset for its rigid wheel
        # frame; shared body vertices never move with a display-steered wheel.
        for role, choices_for_role in choices.items():
            for pi, mask in choices_for_role:
                claim('wheel%d.%s' % (wi, role), pi, mask)
        wheel_meta.append(dict(x=float(center[0]), y=float(center[1]), z=float(center[2]), r=radius, width=width,
                               front=bool(wheel['front']), side=int(wheel['side']), axle=[0., 0., 1.], sourceAxle=axle.tolist(),
                               sourceCenter=center.tolist(), sourceRotation=rotation.tolist(),
                               sourceNode=wheel.get('sourceNode', ''), axleEvidence=wheel.get('axleEvidence', ''),
                               caliper='wheel%d.caliper' % wi if 'caliper' in choices else None))
    for rule in recipe.get('rules', []):
        for pi, p in enumerate(prims):
            mask = selected(p, pi, rule.get('select'), g.js['materials']) & ~owned[pi]
            claim(rule['part'], pi, mask, rule.get('pane'))
    for pi, p in enumerate(prims): claim('trim', pi, ~owned[pi])
    total = sum(len(p['index']) for pi, p in enumerate(prims) if pi not in excluded)
    if sum(map(len, parts.values())) != total or not all(mask.all() for mask in owned):
        raise RuntimeError('Source face ownership is incomplete')
    source_parts = []
    for name, faces in parts.items():
        rows = np.concatenate([prims[pi]['P'][prims[pi]['index'][ti]] for pi, ti in faces])
        if name.startswith('wheel'):
            wheel = wheel_meta[int(name[5:name.index('.')])]; center = np.asarray(wheel['sourceCenter'])
            rows = (rows - center) @ np.asarray(wheel['sourceRotation']).T + center
        source_parts.append(rows)
    whole = np.concatenate(source_parts)
    scale = float(recipe['lengthMetres']) / float(np.ptp(whole[:, 0]))
    tyre_low = min(w['y'] - w['r'] for w in wheel_meta)
    shift = np.array([-(whole[:, 0].min() + whole[:, 0].max()) / 2, -tyre_low, -(whole[:, 2].min() + whole[:, 2].max()) / 2])
    # Geometry remains in source-frame arrays; build_part applies each wheel's
    # one rigid transform, then this shared uniform fit, without editing source.
    lo = (whole.min(0) + shift) * scale; hi = (whole.max(0) + shift) * scale
    for wheel in wheel_meta:
        for field, value in zip(('x', 'y', 'z'), (np.array(wheel['sourceCenter']) + shift) * scale): wheel[field] = float(value)
        wheel['r'] *= scale; wheel['width'] *= scale
    def fitted_points(names):
        rows = [prims[pi]['P'][prims[pi]['index'][ti]] for name in names for pi, ti in parts.get(name, [])]
        return (np.asarray(rows).reshape(-1, 3) + shift) * scale if rows else np.empty((0, 3))
    glass_names = [name for name in parts if name == 'glass' or name.endswith('.glass')]
    glazing = fitted_points(glass_names)
    if recipe.get('glass'):
        glass = recipe['glass']
    elif len(glazing):
        a, b = glazing.min(0), glazing.max(0); height = b[1] - a[1]
        lower = glazing[glazing[:, 1] < a[1] + .35 * height]; upper = glazing[glazing[:, 1] > a[1] + .7 * height]
        glass = dict(base=float(a[1]), roof=float(b[1]), xf=float(a[0] if not len(lower) else lower[:, 0].max()),
                     xb=float(a[0] if not len(lower) else lower[:, 0].min()), rf=float(b[0] if not len(upper) else upper[:, 0].max()),
                     rb=float(a[0] if not len(upper) else upper[:, 0].min()), halfBase=float(np.max(np.abs(glazing[:, 2]))),
                     halfTop=float(np.max(np.abs(upper[:, 2]))) if len(upper) else float(np.max(np.abs(glazing[:, 2]))), crown=0.)
    else:
        raise RuntimeError('Explicit measured glass/cabin metadata required when source panes cannot be identified')
    if 'openTop' in recipe: glass = dict(glass, open=bool(recipe['openTop']))
    roles = {role: [] for role in ('shell', 'panels', 'hood', 'trim', 'cabin', 'glass', 'opticalGlass')}
    for name in parts:
        if name.startswith('wheel') or name.startswith(('head', 'tail')): continue
        role = 'panels' if name.endswith('.paint') else 'glass' if name.endswith('.glass') else 'trim' if name.endswith('.trim') else name
        if role in roles: roles[role].append(name)
    if not roles['shell']:
        if roles['panels']:
            roles['shell'] = roles['panels']; roles['panels'] = []
        else: raise RuntimeError('No verified paint shell selected; do not replace a real car by a fallback box')
    profile, section = [], []
    for x in np.linspace(lo[0], hi[0], 41):
        q = (whole + shift) * scale; near = q[np.abs(q[:, 0] - x) < .12]
        if not len(near): near = q[np.argsort(np.abs(q[:, 0] - x))[:20]]
        profile.append(float(near[:, 1].max())); section.append([float(near[:, 1].min()), float(near[:, 1].max()), float(np.abs(near[:, 2]).max())])
    lamps = {}
    for name in ('headLeft', 'headRight', 'tailLeft', 'tailRight'):
        points = fitted_points([name])
        if len(points):
            center = (points.min(0) + points.max(0)) * .5
            lamps[name] = dict(zip(('x', 'y', 'z'), map(float, center)), size=float(max(np.ptp(points[:, 1]), np.ptp(points[:, 2])) * .35))
    meta = dict(type=key, kind='car', gameTypes=recipe['gameTypes'], title=recipe['title'], author=recipe['author'],
                source=recipe.get('originalSourceUrl', recipe['sourceUrl']), license=recipe['license'], dims=(hi - lo).tolist(), x0=float(lo[0]), x1=float(hi[0]),
                wheels=wheel_meta, glass=glass, lamps=lamps, hinge=recipe.get('hinge', [glass['xf'] + .1, glass['base']]),
                sill=recipe.get('sill', .2), profile=profile, section=section, hasInterior=bool(recipe.get('hasInterior', False)),
                seats=recipe.get('seats'), doors=recipe.get('doors', {}), roleParts=roles, paintTexture=True, paintColor='#ffffff',
                normalScale=32767, sourceTriangles=total, nearReachMetres=recipe.get('nearReachMetres', 18),
                sourceUniformScale=scale, sourceShift=shift.tolist(), sourceSHA256=recipe['sourceSHA256'])
    meta['excludedSceneTriangles'] = sum(len(prims[pi]['index']) for pi in excluded)
    return dict(g=g, prims=prims, parts=parts, pane_ids=pane_ids, meta=meta, recipe=recipe, scale=scale, shift=shift)


def texture_info(g, material, channel):
    if channel in ('albedo', 'orm'):
        info = material.get('pbrMetallicRoughness', {}).get('baseColorTexture' if channel == 'albedo' else 'metallicRoughnessTexture')
    else: info = material.get('emissiveTexture' if channel == 'emissive' else 'normalTexture')
    if info:
        transform = info.get('extensions', {}).get('KHR_texture_transform', {})
        if transform.get('texCoord', info.get('texCoord', 0)) not in (0, 1): raise RuntimeError('Unsupported texture coordinate set')
        sampler = g.js.get('samplers', [{}])[g.js['textures'][info['index']].get('sampler', 0)] if g.js.get('samplers') else {}
        if sampler.get('wrapS', 10497) != 10497 or sampler.get('wrapT', 10497) != 10497:
            raise RuntimeError('Non-repeat sampler requires explicit source preparation; never silently change source sampling')
        return info, g.image(info['index'])[1].convert('RGBA')
    return None, None


def make_atlas(r, output):
    ceiling = int(r['recipe'].get('atlasSize', 4096))
    if ceiling > 8192 or ceiling < 32 or ceiling & (ceiling - 1):
        raise RuntimeError('Atlas ceiling must be a power of two between32 and8192')
    limit = r['recipe'].get('maxTextureSize')
    if limit is not None and (not isinstance(limit, int) or limit < 8):
        raise RuntimeError('Explicit maxTextureSize must be an integer >=8')
    tiles, materials = {}, {}
    resampled = []
    max_emission = max(1., *(float(m.get('extensions', {}).get('KHR_materials_emissive_strength', {}).get('emissiveStrength', 1.)) for m in r['g'].js['materials']))
    paint_ids = set(r['recipe'].get('paintMaterials', [r['prims'][pi]['material'] for role in ('shell', 'panels', 'hood') for name in r['meta']['roleParts'][role] for pi, _ in r['parts'][name]]))
    r['paint_ids'] = paint_ids
    for mi, material in enumerate(r['g'].js['materials']):
        pbr = material.get('pbrMetallicRoughness', {}); factor = list(pbr.get('baseColorFactor', [1, 1, 1, 1]))
        # Only verified paint pigment is neutralized. Existing source texture
        # detail, trim, leather, carbon and wheel colours remain in their tiles.
        infos, images = {}, {}
        for channel in CHANNELS: infos[channel], images[channel] = texture_info(r['g'], material, channel)
        native = [im for im in images.values() if im]
        shape = (max(im.width for im in native), max(im.height for im in native)) if native else (8, 8)
        if limit and max(shape) > limit:
            ratio = limit / max(shape); target = tuple(max(1, round(side * ratio)) for side in shape)
            resampled.append(dict(material=mi, native=list(shape), staged=list(target)))
            shape = target
        images['albedo'] = sports.multiplied(images['albedo'] or Image.new('RGBA', shape, 'white'), factor)
        images['orm'] = (images['orm'] or Image.new('RGBA', shape, 'white')).convert('RGB')
        strength = float(material.get('extensions', {}).get('KHR_materials_emissive_strength', {}).get('emissiveStrength', 1.))
        emission_factor = [value * strength / max_emission for value in material.get('emissiveFactor', [0, 0, 0])]
        images['emissive'] = sports.multiplied(images['emissive'] or Image.new('RGBA', shape, 'white'), emission_factor + [1]).convert('RGB')
        images['normal'] = (images['normal'] or Image.new('RGBA', shape, (128, 128, 255, 255))).convert('RGB')
        for channel in CHANNELS: images[channel] = images[channel].resize(shape, Image.Resampling.LANCZOS)
        digest = hashlib.sha256(b''.join(images[channel].tobytes() for channel in CHANNELS) + str(shape).encode()).hexdigest()
        tiles.setdefault(digest, dict(images=images, size=shape))
        materials[mi] = dict(hash=digest, finish=[pbr.get('roughnessFactor', 1), pbr.get('metallicFactor', 1)], infos=infos,
                             doubleSided=bool(material.get('doubleSided', False)), normalScale=material.get('normalTexture', {}).get('scale', 1.),
                             alphaCutoff=material.get('alphaCutoff', .5) if material.get('alphaMode') == 'MASK' else -2. if material.get('alphaMode') == 'BLEND' else -1.)
        if mi in paint_ids and r['recipe'].get('neutralizePaint', True):
            pigment = images.copy(); info, base_image = texture_info(r['g'], material, 'albedo')
            pigment['albedo'] = sports.multiplied(base_image or Image.new('RGBA', shape, 'white'), [1, 1, 1, factor[3]]).resize(shape, Image.Resampling.LANCZOS)
            paint_hash = hashlib.sha256(b''.join(pigment[channel].tobytes() for channel in CHANNELS) + str(shape).encode()).hexdigest()
            tiles.setdefault(paint_hash, dict(images=pigment, size=shape)); materials[mi]['paintHash'] = paint_hash
    neutral = dict(albedo=Image.new('RGBA', (8, 8), 'white'), orm=Image.new('RGB', (8, 8), 'white'),
                   emissive=Image.new('RGB', (8, 8), 'black'), normal=Image.new('RGB', (8, 8), (128, 128, 255)))
    neutral_hash = hashlib.sha256(b''.join(neutral[channel].tobytes() for channel in CHANNELS) + str((8, 8)).encode()).hexdigest()
    tiles.setdefault(neutral_hash, dict(images=neutral, size=(8, 8)))
    sizes = {key: tile['size'] for key, tile in tiles.items()}
    # Small untextured palettes must not allocate a4096²GPU texture. The recipe
    # sets a ceiling; fitting only shrinks empty atlas space, never source tiles.
    size, rects = 32, None
    while size <= ceiling:
        rects = legacy.shelf_pack(sizes, size, size)
        if rects is not None: break
        size *= 2
    if rects is None:
        raise RuntimeError(r['meta']['type'] + ': source tiles do not fit atlas ceiling; choose explicit maxTextureSize/atlasSize, never silently resample')
    low_size = min(size, int(r['recipe'].get('lowAtlasSize', 1024)))
    if low_size > 1024: raise RuntimeError('Low/Medium atlas budget is at most1024')
    prefix = r['meta']['type']; keys = {}
    for channel in CHANNELS:
        mode, background = ('RGBA', (0, 0, 0, 0)) if channel == 'albedo' else ('RGB', (128, 128, 255) if channel == 'normal' else (255, 255, 255) if channel == 'orm' else (0, 0, 0))
        image = Image.new(mode, (size, size), background)
        for key, (x, y) in rects.items():
            tile = tiles[key]['images'][channel]; width, height = tile.size
            padded = tile.resize((width + 4, height + 4), Image.Resampling.NEAREST); padded.paste(tile, (2, 2)); image.paste(padded, (x - 2, y - 2)); tiles[key]['rect'] = [x, y, width, height]
        filename = prefix.replace('_', '-', 1) + '-' + channel
        image.save(output / (filename + '.webp'), lossless=True, method=6)
        image.resize((low_size, low_size), Image.Resampling.LANCZOS).save(output / (filename + '-low.webp'), lossless=True, method=6)
        key = 'monarchVehicle' + ''.join(part.title() for part in prefix.removeprefix('monarch_').split('_')) + channel.title()
        keys[channel] = dict(high=key, low=key + 'Low', file=filename + '.webp', lowFile=filename + '-low.webp')
    normal_maps = any(m['infos']['normal'] for m in materials.values())
    channels = 4 if normal_maps else 3
    r['meta'].update(textureKeys=keys, atlas=[size, size], lowAtlas=[low_size, low_size], hasNormalMaps=normal_maps,
      emissiveIntensity=max_emission, sourceMaterialExtensions=sorted({extension for m in r['g'].js['materials'] for extension in m.get('extensions', {})}),
      textureBudget=dict(maxTextureSize=limit, resampledMaterials=resampled, uniqueTiles=len(tiles), tilePixels=sum(w*h for w,h in sizes.values()),
                         gpuRGBA8MipBytesHigh=round(size*size*4*4/3*channels), gpuRGBA8MipBytesLow=round(low_size*low_size*4*4/3*channels), allocatedChannels=channels))
    x, y = rects[neutral_hash]
    r['meta'].update(paintUv=[(x + 4) / size, (y + 4) / size], paintRect=[x / size, y / size, 8 / size, 8 / size])
    return tiles, materials


def transform_uv(uv, info):
    if not info: return np.asarray(uv)
    transform = info.get('extensions', {}).get('KHR_texture_transform', {})
    value = np.asarray(uv) * np.asarray(transform.get('scale', [1, 1]))
    angle = transform.get('rotation', 0); c, s = np.cos(angle), np.sin(angle)
    return value @ np.array([[c, s], [-s, c]]) + np.asarray(transform.get('offset', [0, 0]))


def prepare_parts(r, work):
    arrays, manifest, lookup = {}, {}, {}
    for name, faces in r['parts'].items():
        groups = {}
        for pi, ti in faces: groups.setdefault(r['pane_ids'].get((pi, ti)), []).append((pi, ti))
        wheel = r['meta']['wheels'][int(name[5:name.index('.')])] if name.startswith('wheel') else None
        for pane, items in groups.items():
            P, N, UV, I, M, C, UV1, vertex_material, remap = [], [], [], [], [], [], [], [], {}
            for pi, ti in items:
                p = r['prims'][pi]; tri = []
                for vi in p['index'][ti]:
                    token = pi, int(vi)
                    if token not in remap:
                        remap[token] = len(P); position, normal = p['P'][vi], p['N'][vi]
                        if wheel:
                            rotation = np.asarray(wheel['sourceRotation']); center = np.asarray(wheel['sourceCenter'])
                            position = (position - center) @ rotation.T + center; normal = normal @ rotation.T
                        P.append((position + r['shift']) * r['scale']); N.append(normal)
                        UV.append(p['UV'][vi] if p['UV'] is not None else [.5, .5]); UV1.append(p['UV1'][vi] if p['UV1'] is not None else UV[-1])
                        color = p['COLOR'][vi] if p['COLOR'] is not None else [1, 1, 1, 1]
                        C.append(list(color) + ([1] if len(color) == 3 else []))
                        vertex_material.append(p['material'])
                    tri.append(remap[token])
                I.append(tri); M.append(p['material'])
            for suffix in ('', 'Far'):
                ident = r['meta']['type'] + '.' + name + suffix + (':' + str(pane) if pane is not None else '')
                for field, values, dtype in [('p', P, np.float32), ('n', N, np.float32), ('uv', UV, np.float32), ('i', I, np.int32), ('m', M, np.uint16)]: arrays[ident + '.' + field] = np.asarray(values, dtype=dtype)
                manifest[ident] = dict(ratio=float(r['recipe'].get('farRatio', .08)) if suffix else 1., preserveSourceNormals=True)
                lookup[ident] = dict(part=name + suffix, pane=pane, colors=np.asarray(C), uv1=np.asarray(UV1), vertexMaterial=np.asarray(vertex_material))
    np.savez(work / 'parts-input.npz', **arrays)
    (work / 'parts-manifest.json').write_text(json.dumps(manifest, indent=2))
    return lookup


def pack_model(r, work, tiles, materials, lookup, blob):
    reduced = np.load(work / 'parts-output.npz'); original = np.load(work / 'parts-input.npz'); meta = copy.deepcopy(r['meta']); size = meta['atlas'][0]
    whole = np.concatenate([reduced[ident + '.p'] for ident in lookup]); lo, hi = whole.min(0), whole.max(0); extent = np.maximum(hi - lo, 1e-8)
    meta['quant'] = lo.tolist() + extent.tolist(); meta['parts'] = {}
    groups, normal_repairs = {}, []
    for ident, record in lookup.items(): groups.setdefault(record['part'], {})[record['pane']] = ident
    for part, panes in groups.items():
        P, N, A, O, Q, E, T, F, C, S, D, L, V, I = [], [], [], [], [], [], [], [], [], [], [], [], [], []
        pane_counts = [0] * 5 if any(p is not None for p in panes) else None
        for pane, ident in sorted(panes.items(), key=lambda row: -1 if row[0] is None else row[0]):
            positions, normals, uv, indices, mi = [reduced[ident + '.' + field] for field in ('p', 'n', 'uv', 'i', 'm')]
            records = lookup[ident]; unique = {}; start_count = len(I)
            # Far UV/color transfer follows the closest authored source vertex.
            nearest = np.arange(len(positions))
            if part.endswith('Far'):
                from scipy.spatial import cKDTree
                source_p, source_uv = original[ident + '.p'], original[ident + '.uv']
                for material_id in np.unique(mi):
                    source_ids = np.flatnonzero(records['vertexMaterial'] == material_id)
                    query_ids = np.unique(indices[mi == material_id])
                    tree = cKDTree(np.c_[source_p[source_ids], source_uv[source_ids] * 1e-5])
                    nearest[query_ids] = source_ids[tree.query(np.c_[positions[query_ids], uv[query_ids] * 1e-5])[1]]
            for ti, tri in enumerate(indices):
                material_id = int(mi[ti]); material = materials[material_id]
                raw_part = part[:-3] if part.endswith('Far') else part
                paint = material_id in r['paint_ids'] and (raw_part in ('shell', 'panels', 'hood') or raw_part.endswith('.paint'))
                rect = tiles[material.get('paintHash', material['hash']) if paint else material['hash']]['rect']; x, y, width, height = rect; packed = []
                for vi in map(int, tri):
                    closest = int(nearest[vi])
                    token = (positions[vi].tobytes(), normals[vi].tobytes(), uv[vi].tobytes(), material_id,
                             closest, records['colors'][closest].tobytes(), records['uv1'][closest].tobytes())
                    if token not in unique:
                        unique[token] = len(P); P.append(positions[vi]); normal = normals[vi]; closest = int(nearest[vi])
                        if part.endswith('Far') and np.linalg.norm(normal) < 1e-8:
                            source_n = original[ident + '.n']; source_p = original[ident + '.p']
                            valid = np.flatnonzero((records['vertexMaterial'] == material_id) & (np.linalg.norm(source_n, axis=1) > .5))
                            if not len(valid): raise RuntimeError('No original same-material normal for collapsed far decoration')
                            which = valid[np.argmin(np.sum((source_p[valid] - positions[vi]) ** 2, axis=1))]
                            normal = source_n[which]
                            normal_repairs.append(dict(part=part, vertex=vi, sourceVertex=int(which), distance=float(np.linalg.norm(source_p[which] - positions[vi]))))
                        N.append(normal)
                        for channel, target in [('albedo', A), ('orm', O), ('normal', Q), ('emissive', E)]:
                            info = material['infos'][channel]; texcoord = info.get('extensions', {}).get('KHR_texture_transform', {}).get('texCoord', info.get('texCoord', 0)) if info else 0
                            target.append(transform_uv(records['uv1'][closest] if texcoord == 1 else uv[vi], info))
                        T.append([x / size, y / size, width / size, height / size]); F.append(material['finish']); C.append(records['colors'][closest]); S.append(255 if material['doubleSided'] else 0); D.append(255 if paint else 0); L.append(material['normalScale']); V.append(material['alphaCutoff'])
                    packed.append(unique[token])
                I.append(packed)
            if pane is not None: pane_counts[pane] = len(I) - start_count
        P, N = np.asarray(P), np.asarray(N); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
        raw_part = part[:-3] if part.endswith('Far') else part; origin = [0, 0, 0]
        if raw_part.startswith('wheel'):
            wheel = meta['wheels'][int(raw_part[5:raw_part.index('.')])]; origin = [wheel['x'], wheel['y'], wheel['z']]
        meta['parts'][part] = dict(origin=origin, vertices=len(P), triangles=len(I), colorSize=4)
        if pane_counts is not None: meta['parts'][part]['panes'] = pane_counts
        atlas_uv = np.asarray(T)[:, :2] + np.mod(A, 1) * np.asarray(T)[:, 2:]
        fields = [('p', np.round((P - lo) / extent * 65534 - 32767).astype(np.int16), 'i2'), ('n', np.round(N * 32767).astype(np.int16), 'i2'),
                  ('uv', np.round(atlas_uv * 65535).astype(np.uint16), 'u2'), ('a', np.asarray(A, dtype=np.float32), 'f4'),
                  ('o', np.asarray(O, dtype=np.float32), 'f4'), ('q', np.asarray(Q, dtype=np.float32), 'f4'), ('e', np.asarray(E, dtype=np.float32), 'f4'),
                  ('t', np.round(np.asarray(T) * 65535).astype(np.uint16), 'u2'), ('f', np.round(np.asarray(F) * 255).astype(np.uint8), 'u1'),
                  ('c', np.round(np.clip(C, 0, 1) * 255).astype(np.uint8), 'u1'), ('s', np.asarray(S, dtype=np.uint8), 'u1'), ('d', np.asarray(D, dtype=np.uint8), 'u1'),
                  ('l', np.asarray(L, dtype=np.float32), 'f4'), ('v', np.asarray(V, dtype=np.float32), 'f4'),
                  ('i', np.asarray(I, dtype=np.uint32 if len(P) > 65535 else np.uint16), 'u4' if len(P) > 65535 else 'u2')]
        for field, values, dtype in fields: blob.add(meta['type'] + '.' + part + '.' + field, values, dtype)
    meta['lodParts'] = {name: name + 'Far' for name in meta['parts'] if not name.endswith('Far')}
    meta['triangles'] = sum(p['triangles'] for name, p in meta['parts'].items() if not name.endswith('Far'))
    meta['farTriangles'] = sum(p['triangles'] for name, p in meta['parts'].items() if name.endswith('Far'))
    if meta['triangles'] != meta['sourceTriangles']: raise RuntimeError('Full near source triangle conservation failed')
    meta['rolePanes'] = {}
    for role, names in list(meta['roleParts'].items()):
        meta['roleParts'][role + 'Far'] = [name + 'Far' for name in names]; meta['lodParts'][role] = role + 'Far'
        if role == 'glass':
            for suffix in ('', 'Far'): meta['rolePanes']['glass' + suffix] = [sum(meta['parts'][name + suffix].get('panes', [0] * 5)[i] for name in names) for i in range(5)]
    (work / 'far-source-normal-repairs.json').write_text(json.dumps(normal_repairs, indent=2))
    meta['farSourceNormalRepairs'] = len(normal_repairs)
    return meta


def deduplicate_arrays(arrays, data):
    """Alias only byte-identical same-type arrays/prefixes; immutable views."""
    widths = dict(u1=1, i1=1, i2=2, u2=2, u4=4, f4=4)
    output, result, exact, periodic = bytearray(), {}, {}, {}
    stats = dict(inputPayloadBytes=len(data), exactAliasArrays=0, periodicPrefixArrays=0)
    for name, (kind, offset, count) in sorted(arrays.items(), key=lambda row: -row[1][2] * widths[row[1][0]]):
        value = bytes(data[offset:offset + count * widths[kind]])
        digest = kind, hashlib.sha256(value).digest()
        pattern_key = None
        for size in (1, 2, 4, 8, 16):
            pattern = value[:size]
            if pattern and pattern * (len(value) // len(pattern)) + pattern[:len(value) % len(pattern)] == value:
                pattern_key = kind, pattern; break
        if digest in exact:
            stored = exact[digest]; stats['exactAliasArrays'] += 1
        elif pattern_key in periodic:
            stored = periodic[pattern_key]; stats['periodicPrefixArrays'] += 1
        else:
            output.extend(b'\0' * (-len(output) % 4)); stored = len(output); output.extend(value)
            if pattern_key: periodic[pattern_key] = stored
        # This also defends against a digest collision or periodic-token bug.
        if output[stored:stored + len(value)] != value: raise RuntimeError('Lossless array alias differs: ' + name)
        exact[digest] = stored; result[name] = [kind, stored, count]
    stats.update(outputPayloadBytes=len(output), savedBytes=len(data) - len(output))
    return result, output, stats


def deduplicate_pack(pack):
    raw = pack.read_bytes(); length = struct.unpack_from('<I', raw, 8)[0]
    if raw[:8] != b'DECVM001': raise RuntimeError('Invalid source pack')
    header = json.loads(raw[12:12 + length]); data = raw[12 + length:]
    arrays, payload, stats = deduplicate_arrays(header['arrays'], data)
    header.update(arrays=arrays, arrayStorage=stats)
    encoded = json.dumps(header, separators=(',', ':')).encode(); encoded += b' ' * (-(12 + len(encoded)) % 4)
    staged = pack.with_name(pack.name + '.tmp')
    staged.write_bytes(b'DECVM001' + struct.pack('<I', len(encoded)) + encoded + payload); staged.replace(pack)
    return stats


def update_seat_fits(pack, recipes):
    """Change measured seat metadata, proving geometry/index payload unchanged.

    A fit review often changes only hip/recline values. Rebuilding all source
    atlases/reducers for that would add no visual evidence and invites unrelated
    changes. This path can mark an explicitly open source roof, but cannot alter
    any glazing dimensions, door, part, texture or wheel.
    """
    raw = pack.read_bytes(); before = hashlib.sha256(raw).hexdigest()
    if raw[:8] != b'DECVM001': raise RuntimeError('Invalid source pack')
    length = struct.unpack_from('<I', raw, 8)[0]
    header = json.loads(raw[12:12 + length]); payload = raw[12 + length:]
    updates, roof_updates = {}, {}
    for recipe in recipes:
        if recipe.get('seats') is None and 'openTop' not in recipe: continue
        model = header['models'][recipe['key']]
        if model['sourceSHA256'] != recipe['sourceSHA256'] or sha(Path(recipe['source'])) != recipe['sourceSHA256']:
            raise RuntimeError('Seat fit source identity differs from existing geometry: ' + recipe['key'])
        if recipe.get('seats') is not None and model.get('seats') != recipe['seats']:
            updates[recipe['key']] = dict(before=model.get('seats'), after=copy.deepcopy(recipe['seats']))
            model['seats'] = copy.deepcopy(recipe['seats'])
        if 'openTop' in recipe and model.get('glass', {}).get('open', False) != bool(recipe['openTop']):
            roof_updates[recipe['key']] = dict(before=model.get('glass', {}).get('open', False), after=bool(recipe['openTop']))
            model.setdefault('glass', {})['open'] = bool(recipe['openTop'])
    encoded = json.dumps(header, separators=(',', ':')).encode(); encoded += b' ' * (-(12 + len(encoded)) % 4)
    output = b'DECVM001' + struct.pack('<I', len(encoded)) + encoded + payload
    staged = pack.with_name(pack.name + '.tmp'); staged.write_bytes(output); staged.replace(pack)
    check_length = struct.unpack_from('<I', output, 8)[0]
    if output[12 + check_length:] != payload: raise RuntimeError('Seat-only update changed source geometry')
    return dict(inputSHA256=before, outputSHA256=sha(pack), unchangedPayloadSHA256=hashlib.sha256(payload).hexdigest(),
                updates=updates, openTopUpdates=roof_updates, operation='Measured seats/open-roof fit metadata only; all array layouts and complete geometry/UV/material payload bytes unchanged')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('recipes', nargs='?', type=Path); parser.add_argument('--inspect', type=Path); parser.add_argument('--forward', default='+z')
    parser.add_argument('--out', type=Path, default=ROOT / 'work/monarch-assets'); parser.add_argument('--work', type=Path, default=ROOT / 'work/monarch-convert')
    parser.add_argument('--only', help='comma-separated source keys'); parser.add_argument('--reuse-prepared', action='store_true', help='reuse matching source/helper/part inputs, never stale Blender output')
    parser.add_argument('--update-seat-fits', action='store_true', help='update only existing pack seat metadata from identical pinned sources; all binary arrays retained')
    parser.add_argument('--deduplicate', action='store_true', help='losslessly alias identical arrays/prefixes in an existing generated pack')
    args = parser.parse_args()
    if args.inspect:
        g, prims = read_source(args.inspect, args.forward)
        print(json.dumps(dict(source=str(args.inspect), sha256=sha(args.inspect), triangles=sum(len(p['index']) for p in prims),
          primitives=[dict(id=i, node=p['node'], path=p['path'], material=p['material'], materialName=g.js['materials'][p['material']].get('name'),
                           triangles=len(p['index']), min=p['P'].min(0).tolist(), max=p['P'].max(0).tolist()) for i, p in enumerate(prims)]), indent=2)); return
    if not args.recipes: parser.error('recipes JSON or --inspect source required')
    config = json.loads(args.recipes.read_text()); recipes = config['models'] if isinstance(config, dict) else config
    if args.only: recipes = [recipe for recipe in recipes if recipe['key'] in args.only.split(',')]
    args.out.mkdir(parents=True, exist_ok=True); args.work.mkdir(parents=True, exist_ok=True)
    if args.deduplicate:
        pack = args.out / 'monarch-vehicle-models.bin'; stats = deduplicate_pack(pack)
        receipt_path = args.work / 'monarch-conversion-receipt.json'
        if receipt_path.exists():
            receipt = json.loads(receipt_path.read_text()); receipt['arrayStorage'] = stats
            receipt['output'][pack.name] = dict(bytes=pack.stat().st_size, sha256=sha(pack))
            receipt_path.write_text(json.dumps(receipt, indent=2))
        print(json.dumps(stats)); return
    if args.update_seat_fits:
        pack = args.out / 'monarch-vehicle-models.bin'; update = update_seat_fits(pack, recipes)
        update.update(sourceRecipesSHA256=sha(args.recipes), converterSHA256=sha(Path(__file__)))
        receipt_path = args.work / 'monarch-conversion-receipt.json'
        if receipt_path.exists():
            receipt = json.loads(receipt_path.read_text()); receipt.setdefault('seatFitUpdates', []).append(update)
            for entry in receipt['models']:
                if entry['model']['type'] in update['updates']:
                    entry['model']['seats'] = update['updates'][entry['model']['type']]['after']
                if entry['model']['type'] in update['openTopUpdates']:
                    entry['model']['glass']['open'] = update['openTopUpdates'][entry['model']['type']]['after']
            receipt['output'][pack.name] = dict(bytes=pack.stat().st_size, sha256=sha(pack))
            receipt_path.write_text(json.dumps(receipt, indent=2))
        (args.work / 'seat-fit-update.json').write_text(json.dumps(update, indent=2)); print(json.dumps(update)); return
    blob, models, receipts = legacy.Blob(), {}, []
    protected = {str(path): sha(path) for path in (ROOT / 'assets').glob('*') if path.is_file() and not path.name.startswith('monarch-')}
    for recipe in recipes:
        print('SOURCE', recipe['key'], flush=True)
        r = source_model(recipe); work = args.work / recipe['key']; work.mkdir(parents=True, exist_ok=True)
        tiles, materials = make_atlas(r, args.out); lookup = prepare_parts(r, work)
        helper = ROOT / 'tools/approved_vehicle_models_prepare.py'
        prepared_key = dict(input=sha(work / 'parts-input.npz'), manifest=sha(work / 'parts-manifest.json'), helper=sha(helper))
        cached_key = json.loads((work / 'prepared-key.json').read_text()) if (work / 'prepared-key.json').exists() else None
        if not (args.reuse_prepared and prepared_key == cached_key and (work / 'parts-output.npz').exists()):
            subprocess.run(['blender', '-b', '--threads', '1', '-P', str(helper), '--', 'simplify', str(work / 'parts-input.npz'), str(work / 'parts-output.npz'), str(work / 'parts-manifest.json')], check=True)
            (work / 'prepared-key.json').write_text(json.dumps(prepared_key, indent=2))
        model = pack_model(r, work, tiles, materials, lookup, blob); models[model['type']] = model
        print('PACKED', model['type'], model['triangles'], model['farTriangles'], model['atlas'], model['lowAtlas'], flush=True)
        (work / 'source-partition.json').write_text(json.dumps({name: faces for name, faces in r['parts'].items()}))
        receipts.append(dict(recipe=recipe, sourceSHA256=sha(Path(recipe['source'])), model=model))
    arrays, payload, storage = deduplicate_arrays(blob.arrays, blob.data)
    header = dict(version=1, normalScale=32767, models=models, arrays=arrays, arrayStorage=storage)
    encoded = json.dumps(header, separators=(',', ':')).encode(); encoded += b' ' * (-(12 + len(encoded)) % 4)
    (args.out / 'monarch-vehicle-models.bin').write_bytes(b'DECVM001' + struct.pack('<I', len(encoded)) + encoded + payload)
    if any(sha(Path(path)) != digest for path, digest in protected.items()): raise RuntimeError('An existing asset changed')
    receipt = dict(models=receipts, sourceRecipesSHA256=sha(args.recipes), converterSHA256=sha(Path(__file__)), protectedAssets=protected, arrayStorage=storage,
                   output={path.name: dict(bytes=path.stat().st_size, sha256=sha(path)) for path in args.out.glob('monarch-*')})
    (args.work / 'monarch-conversion-receipt.json').write_text(json.dumps(receipt, indent=2))
    print(json.dumps({key: [value['triangles'], value['farTriangles']] for key, value in models.items()}))


if __name__ == '__main__': main()
