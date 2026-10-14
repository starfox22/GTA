#!/usr/bin/env python3
"""Build all five user-approved replacement vehicles without touching the legacy pack.

Usage: python3 tools/approved_vehicle_models.py /tmp/GTA-asset-research
Requires numpy, Pillow and Blender. Download locations, licences, rigid
normalisation, measured rolling axles and every reduction are written to a receipt.
The DECVM001 output is a separate pack; the old 23-model pack is never rewritten.
"""
import argparse
import copy
import hashlib
import io
import json
import math
import os
import subprocess
import struct
from pathlib import Path

import numpy as np
from PIL import Image

import vehicle_models as legacy

ROOT = Path(__file__).resolve().parent.parent
ATLAS = 4096
IDS = ('m1_enduro', 'm2_sport', 's1_jimny', 's2_suv', 's3_offroad')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_source(path):
    g = legacy.Gltf(str(path))
    # The decoded Jimny uses standard WebP texture-source extensions.
    for texture in g.js.get('textures', []):
        if 'source' not in texture:
            texture['source'] = texture['extensions']['EXT_texture_webp']['source']
    prims = legacy.load_primitives(g)
    at = 0
    def walk(ni, parent):
        nonlocal at
        node = g.js['nodes'][ni]
        matrix = parent @ legacy.node_matrix(node)
        if 'mesh' in node:
            for primitive in g.js['meshes'][node['mesh']]['primitives']:
                if primitive.get('mode', 4) != 4:
                    continue
                prims[at]['sourcePivot'] = matrix[:3, 3].copy()
                prims[at]['sourceAxle'] = matrix[:3, 0] / np.linalg.norm(matrix[:3, 0])
                at += 1
        for child in node.get('children', []):
            walk(child, matrix)
    for node in g.js['scenes'][g.js.get('scene', 0)]['nodes']:
        walk(node, np.eye(4))
    if at != len(prims):
        raise RuntimeError('source primitive transform traversal mismatch')
    return g, prims


def rotate(prims, matrix):
    for p in prims:
        p['P'] = p['P'] @ matrix.T
        p['N'] = p['N'] @ matrix.T
        p['sourcePivot'] = matrix @ p['sourcePivot']
        p['sourceAxle'] = matrix @ p['sourceAxle']


def vertices(prims):
    return np.concatenate([p['P'][np.unique(p['index'])] for p in prims])


def material_image(g, material, field):
    m = g.js['materials'][material]
    t = m.get('pbrMetallicRoughness', {}).get(field)
    return g.image(t['index'])[1].convert('RGBA') if t else None


def sampled(g, p, field):
    image = material_image(g, p['material'], field)
    uv = p.get('UV')
    if image is None or uv is None:
        return np.ones((len(p['index']), 4)) * 255
    a = np.asarray(image)
    q = uv[p['index']].mean(1) % 1
    xy = np.floor(q * np.array(image.size)).astype(int)
    return a[np.clip(xy[:, 1], 0, image.height - 1), np.clip(xy[:, 0], 0, image.width - 1)]


def circle(points, normals=None):
    """Axle from the tyre's thinnest principal dimension; circular hub fit.

    Radius is the authored outside radius, not an unrounded bounding-box centre.
    A fixed axle carrier in the runtime preserves tiny authored display lean.
    """
    unique = np.unique(np.round(points, 6), axis=0)
    center = unique.mean(0)
    covariance = np.cov((unique - center).T)
    _, vectors = np.linalg.eigh(covariance)
    axle = vectors[:, 0]
    if axle[2] < 0:
        axle = -axle
    if normals is not None:
        side = normals.copy()
        side[(side @ axle) < 0] *= -1
        side = side[(side @ axle) > .985]
        if len(side):
            candidates, counts = np.unique(np.round(side, 5), axis=0, return_counts=True)
            best = candidates[np.argmax(counts)]
            if counts.max() >= 5:
                axle = best / np.linalg.norm(best)
    horizontal = np.cross(axle, [0, 1, 0])
    horizontal /= np.linalg.norm(horizontal)
    vertical = np.cross(horizontal, axle)
    q = np.c_[(unique - center) @ horizontal, (unique - center) @ vertical]
    rhs = np.sum(q * q, axis=1)
    fit = np.linalg.lstsq(np.c_[2 * q, np.ones(len(q))], rhs, rcond=None)[0]
    # The outer authored tread determines the rolling hub. A hub, disc or tyre
    # inner bead may be tessellated asymmetrically and bias a whole-mesh fit.
    radial = np.linalg.norm(q - fit[:2], axis=1)
    ring = q[radial > np.percentile(radial, 80)]
    if len(ring) >= 16:
        fit = np.linalg.lstsq(np.c_[2 * ring, np.ones(len(ring))], np.sum(ring * ring, axis=1), rcond=None)[0]
    center += horizontal * fit[0] + vertical * fit[1]
    radius = np.linalg.norm(q - fit[:2], axis=1)
    width = float(np.ptp((unique - center) @ axle))
    return center, float(np.percentile(radius, 99.8)), width, axle


def flatten(prims, g, kind):
    T = legacy.triangles(prims, g.js['materials'], {})
    pi = np.concatenate([np.full(len(t['idx']), t['prim'], dtype=np.int32) for t in T])
    indices = np.concatenate([t['idx'] for t in T])
    points = np.concatenate([p['P'][p['index']] for p in prims])
    return dict(prims=prims, g=g, tri_prim=pi, tri_idx=indices,
                cen=points.mean(1), fn=legacy.cat(T, 'fn'), area=legacy.cat(T, 'area'), parts={}, kind=kind)


def add_part(r, name, mask, origin=None, panes=None):
    ids = np.flatnonzero(mask) if getattr(mask, 'dtype', None) == bool else np.asarray(mask, dtype=np.int32)
    if not len(ids):
        return
    r['parts'][name] = {'tris': ids.tolist(), 'origin': list(origin) if origin is not None else [0, 0, 0]}
    if panes is not None:
        r['parts'][name]['panes'] = list(panes)


def normalize(prims, wheel_prims):
    p = vertices(prims)
    tyre = vertices(wheel_prims)
    shift = np.array([-(p[:, 0].min() + p[:, 0].max()) / 2, -tyre[:, 1].min(), -(p[:, 2].min() + p[:, 2].max()) / 2])
    for part in prims:
        part['P'] += shift
        part['sourcePivot'] += shift
    return shift


def seat_contact(r, prim, x):
    """Driver hip contact on the actual upper saddle, from a vertical ray.

    `x` selects the front usable driver saddle, not the raised rear/pillion pad.
    The upper face's barycentric interpolation supplies the exact height.
    """
    p = r['prims'][prim]
    candidates = []
    for ti, tri in enumerate(p['index']):
        q = p['P'][tri]
        a, b, c = q[:, [0, 2]]
        matrix = np.c_[b - a, c - a]
        if abs(np.linalg.det(matrix)) < 1e-10:
            continue
        u, v = np.linalg.solve(matrix, np.array([x, 0.]) - a)
        if u < -1e-6 or v < -1e-6 or u + v > 1 + 1e-6:
            continue
        weights = np.array([1 - u - v, u, v])
        y = float(weights @ q[:, 1])
        face = np.cross(q[1] - q[0], q[2] - q[0])
        if face[1] <= 0:
            continue
        candidates.append((y, ti, weights.tolist()))
    if not candidates:
        raise RuntimeError(r['kind'] + ': no source saddle under driver')
    y, face, weights = max(candidates)
    return [x, y], {'primitive': prim, 'node': p['node'], 'material': r['g'].js['materials'][p['material']]['name'], 'triangle': face, 'barycentric': weights, 'driverContact': [x, y, 0.]}


def moto(source, key, assembled):
    path = assembled if key == 'm1_enduro' else source / 'motorcycles/nonplanar/assets--motorcycle.glb'
    g, prims = read_source(path)
    if key == 'm2_sport':
        rotate(prims, np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]]))
    m1 = key == 'm1_enduro'
    if m1:
        wheel_groups = [[i for i, p in enumerate(prims) if p['node'] == name] for name in ('FrontWheel', 'BackWheel')]
        tyre_groups = [[i for i in group if 'ScooterPlastic' in g.js['materials'][prims[i]['material']]['name']] for group in wheel_groups]
        steer = [i for i, p in enumerate(prims) if p['node'] == 'HandleBar']
    else:
        wheel_groups = [[33, 34, 35, 36], [38, 39, 40, 41]]
        tyre_groups = [[35], [40]]
        steer = list(range(42, 51))
    shift = normalize(prims, [prims[i] for group in tyre_groups for i in group])
    r = flatten(prims, g, 'moto')
    pi, cen = r['tri_prim'], r['cen']
    wheel_mask = np.isin(pi, sum(wheel_groups, []))
    steer_mask = np.isin(pi, steer)
    names = [g.js['materials'][p['material']].get('name', '') for p in prims]
    paint_prims = [i for i, name in enumerate(names) if (name.endswith('--Motorbike') if m1 else 'Car_Paint' in name)]
    paint = np.isin(pi, paint_prims)
    glass = np.isin(pi, [23]) if not m1 else np.zeros(len(pi), bool)
    head = np.isin(pi, [5, 32]) if not m1 else (pi == 3) & (r['fn'][:, 0] > .85) & (np.abs(cen[:, 2]) < .075) & (cen[:, 1] > 1.085) & (cen[:, 1] < 1.14)
    tail = np.isin(pi, [i for i, name in enumerate(names) if 'MotorbikeLights' in name]) if m1 else np.isin(pi, [6, 31])
    remaining = ~wheel_mask & ~head & ~tail
    for steering, prefix in ((False, ''), (True, 'steer.')):
        chosen = remaining & (steer_mask == steering)
        add_part(r, prefix + 'paint', chosen & paint & ~glass)
        add_part(r, prefix + 'glass', chosen & glass)
        add_part(r, prefix + 'trim', chosen & ~paint & ~glass)
    add_part(r, 'head', head)
    add_part(r, 'tail', tail)
    wheels = []
    for i, group in enumerate(wheel_groups):
        center, radius, width, axle = circle(vertices([prims[j] for j in tyre_groups[i]]), np.concatenate([prims[j]['N'] for j in tyre_groups[i]]))
        tyre_mask = np.isin(pi, tyre_groups[i])
        rim_mask = np.isin(pi, group) & ~tyre_mask
        add_part(r, 'wheel%d.tyre' % i, tyre_mask, center)
        add_part(r, 'wheel%d.rim' % i, rim_mask, center)
        wheels.append(dict(x=float(center[0]), y=float(center[1]), z=float(center[2]), r=radius, width=width, side=1, front=i == 0, axle=axle.tolist()))
    p = vertices(prims)
    lo, hi = p.min(0), p.max(0)
    if m1:
        grips = [[.30415, 1.15185, -.3329], [.30415, 1.15185, .3329]]
        seat = [-.36, .9852]
        peg = [-.04, .43, .17]
        top = [.43, .98]
        title = 'Real Motorbike 02'
        author = 'jsa201077'
        head_steers = True
    else:
        grips = [[.3752, 1.00255, -.3087], [.3752, 1.00255, .3087]]
        seat = [-.52, 1.004]
        peg = [-.24, .45, .22]
        top = [.444, 1.096]
        title = 'Sport motorcycle (SRAD 750)'
        author = 'nouter2077'
        head_steers = False
    grips = (np.asarray(grips) + shift).tolist()
    seat = (np.asarray(seat) + shift[:2]).tolist()
    peg = (np.asarray(peg) + shift).tolist()
    if not m1:
        # Actual transverse driver peg cylinders on aluminium primitive 9;
        # avoid the previously generic anchor in front of the source rearsets.
        peg = [-.3305, .488, .263]
    top = np.asarray(top) + shift[:2]
    wf = wheels[0]
    rake = math.atan2(-(top[0] - wf['x']), top[1] - wf['y'])
    seat, seat_proof = seat_contact(r, 0 if m1 else 37, -.22 if m1 else -.26)
    if np.any(head):
        head_points = np.concatenate([prims[int(pi[k])]['P'][r['tri_idx'][k]] for k in np.flatnonzero(head)])
        headlight = ((head_points.min(0) + head_points.max(0)) / 2).tolist()
    else:
        headlight = None
    r['meta'] = dict(type=key, kind='moto', title=title, author=author,
                     dims=(hi - lo).tolist(), wheels=wheels, axis=[wf['x'], wf['y'], *top.tolist()], rake=rake,
                     seat=seat, grips=grips, grip=[float(np.mean(np.asarray(grips)[:, 0])), float(np.mean(np.asarray(grips)[:, 1])), float(np.mean(np.abs(np.asarray(grips)[:, 2])))],
                     peg=peg, lean=-.10 if m1 else -.95, headSteers=head_steers, headlight=headlight, seatProof=seat_proof,
                     x0=float(lo[0]), x1=float(hi[0]), paintTexture=True, paintColor='#ffffff', sourceShift=shift.tolist())
    if not m1:
        r['meta']['pegProof'] = {'primitive': 9, 'source': 'aluminium__spec transverse driver rearset cylinders', 'leftBounds': [[-.3308, .4666, -.279], [-.3111, .4863, -.2049]], 'rightBounds': [[-.3502, .4572, .2049], [-.3299, .4878, .3214]], 'contactConvention': 'average X / top sole Y / outer footrest Z'}
    return r


def s2_exterior_paint(r, original_paint):
    """Verified outer roof/door shell, not all nonmetallic black materials.

    The author's main body is one connected primitive. Detached handles, roof
    rails and cabin equipment stay trim. First-surface tests reject its hidden
    inner surfaces; the existing metallic=93 coating remains unchanged.
    """
    prims, g = r['prims'], r['g']
    selected = [i for i, p in enumerate(prims) if p['node'] == 'SUV Body_Body_0'
                and g.js['materials'][p['material']]['name'] == 'Body_7']
    if len(selected) != 1:
        raise RuntimeError('S2 verified outer body primitive changed')
    pi = selected[0]
    points = np.concatenate([p['P'][p['index']] for p in prims])
    body_ids = np.flatnonzero(r['tri_prim'] == pi)
    _, inverse = np.unique(np.round(points[body_ids].reshape(-1, 3), 5), axis=0, return_inverse=True)
    faces = inverse.reshape(-1, 3)
    parents, edges = list(range(len(faces))), {}
    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    for i, face in enumerate(faces):
        for a, b in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
            edge = tuple(sorted((a, b)))
            if edge in edges:
                parents[find(i)] = find(edges[edge])
            else:
                edges[edge] = i
    components = {}
    for i in range(len(faces)):
        components.setdefault(find(i), []).append(i)
    main = max(components.values(), key=len)
    if len(main) != 3997:
        raise RuntimeError('S2 audited main body connectivity changed')
    body = np.zeros(len(points), bool)
    body[body_ids[main]] = True
    cen, normal = r['cen'], r['fn']
    # These bounds are in the normalized approved source frame. Cabin glass is
    # a different primitive; bumpers, grille, wheel arches and chrome lie outside
    # these roof/upper-door envelopes or fail the outward/first-surface checks.
    roof = body & (cen[:, 1] > 1.5971728180337601) & (normal[:, 1] > .5) & (np.abs(cen[:, 2]) < .7522370608801044) & (cen[:, 0] > -2.2600084589379414) & (cen[:, 0] < .577416480661085)
    doors = body & (cen[:, 1] > .69) & (cen[:, 1] < 1.1661036205989217) & (np.abs(cen[:, 2]) > .77) & (np.abs(normal[:, 2]) > .6) & (normal[:, 2] * cen[:, 2] > 0) & (cen[:, 0] > -1.50) & (cen[:, 0] < .90)
    projections = {}
    for axis in (1, 2):
        axes = [i for i in range(3) if i != axis]
        projected = points[:, :, axes]
        a, v, w = projected[:, 0], projected[:, 1] - projected[:, 0], projected[:, 2] - projected[:, 0]
        determinant = v[:, 0] * w[:, 1] - v[:, 1] * w[:, 0]
        valid = np.abs(determinant) > 1e-10
        projections[axis] = (axes, a, v, w, valid, np.where(valid, determinant, 1))
    def first_hit(axis, q, sign):
        axes, a, v, w, valid, determinant = projections[axis]
        delta = np.asarray(q) - a
        u = (delta[:, 0] * w[:, 1] - delta[:, 1] * w[:, 0]) / determinant
        t = (v[:, 0] * delta[:, 1] - v[:, 1] * delta[:, 0]) / determinant
        ids = np.flatnonzero(valid & (u >= -1e-8) & (t >= -1e-8) & (u + t <= 1 + 1e-8))
        if not len(ids):
            return None, None
        position = (1 - u - t) * points[:, 0, axis] + u * points[:, 1, axis] + t * points[:, 2, axis]
        face = int(ids[np.argmax(position[ids] * sign)])
        return face, float(position[face])
    outer = np.zeros(len(points), bool)
    for face in np.flatnonzero(roof | doors):
        axis = 1 if roof[face] else 2
        axes = projections[axis][0]
        sign = 1 if axis == 1 else -1 if cen[face, 2] < 0 else 1
        hit, position = first_hit(axis, cen[face, axes], sign)
        if hit is not None and abs(position - cen[face, axis]) < 1e-6:
            outer[face] = True
    extra = outer & ~original_paint
    if int(np.sum(extra)) != 840:
        raise RuntimeError('S2 audited exterior face selection changed')
    rays = []
    for region, axis, coordinates, sign in (
            ('roof', 1, [(x, z) for x in (-1.8, -1.3, -.8, -.3, .1) for z in (-.4, 0, .4)], 1),
            ('leftUpperDoor', 2, [(x, y) for x in (-1.1, -.85, -.4, .1, .6) for y in (.90, .95, 1.10)], -1),
            ('rightUpperDoor', 2, [(x, y) for x in (-1.1, -.85, -.4, .1, .6) for y in (.90, .95, 1.10)], 1)):
        for coordinates2 in coordinates:
            face, value = first_hit(axis, coordinates2, sign)
            if face is None or not (outer | original_paint)[face]:
                raise RuntimeError('S2 external livery surface ray misses paint')
            point = [0., 0., 0.]
            point[axis] = value
            for i, a in enumerate(projections[axis][0]):
                point[a] = coordinates2[i]
            rays.append(dict(region=region, axis=axis, sign=sign, coordinates=list(coordinates2), sourceFace=face, point=point))
    ids = np.flatnonzero(extra)
    proof = dict(sourcePrimitive='SUV Body_Body_0', sourceMaterial='Body_7', mainBodyFaces=3997,
                 movedFaces=840, roofFaces=int(np.sum(extra & roof)), upperDoorFaces=int(np.sum(extra & doors)),
                 sourceFacesSHA256=hashlib.sha256(ids.astype('<u4').tobytes()).hexdigest(),
                 sourceFaceIds=ids.tolist(), firstHitRays=rays,
                 operation='Role classification only; original positions, normals, RGB, ORM and source UV retained. Pigment normalization remains limited to original coating93.')
    return extra, proof


def suv(source, key):
    jimny = key == 's1_jimny'
    path = source / ('suv/jimny-decoded.glb' if jimny else 'suv/carpack-4.glb')
    g, prims = read_source(path)
    wheel_groups = None
    if not jimny:
        ids = [56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66] if key == 's2_suv' else [28, 29, 30, 31, 32, 33, 34]
        prims = [prims[i] for i in ids]
        # Source pack arranges cars diagonally. Derive a rigid upright basis from
        # the four wheel centres, then choose the front by actual red tail texels.
        centers = np.array([(p['P'].min(0) + p['P'].max(0)) / 2 for p in prims if 'Wheel' in p['node'] and 'Body' not in p['node']])
        vals, vectors = np.linalg.eigh(np.cov(centers[:, [0, 2]].T))
        heading = vectors[:, np.argmax(vals)]
        matrix = np.array([[heading[0], 0, heading[1]], [0, 1, 0], [-heading[1], 0, heading[0]]])
        rotate(prims, matrix)
        lights = [(p, sampled(g, p, 'baseColorTexture')) for p in prims if 'Optics' in p['node']]
        red_ends = []
        for p, colors in lights:
            red = (colors[:, 0] > colors[:, 1] * 1.3) & (colors[:, 0] > colors[:, 2] * 1.3) & (colors[:, 0] > 60)
            red_ends.extend(p['P'][p['index']].mean(1)[red, 0].tolist())
        body_mid = np.mean(vertices(prims)[:, 0])
        if red_ends and np.mean(red_ends) > body_mid:
            rotate(prims, np.diag([-1, 1, -1]))
        wheel_groups = [[i] for i, p in enumerate(prims) if 'Wheel' in p['node'] and 'Body' not in p['node']]
        wheel_groups.sort(key=lambda group: (-float(prims[group[0]]['P'][:, 0].mean()), float(prims[group[0]]['P'][:, 2].mean())))
        normalize(prims, [prims[i] for group in wheel_groups for i in group])
    else:
        legacy.to_game_frame(prims, '+z')
        tyres = [p for p in prims if g.js['materials'][p['material']]['name'] == 'Carro_Pneu']
        normalize(prims, tyres)
    r = flatten(prims, g, 'car')
    pi, cen, fn = r['tri_prim'], r['cen'], r['fn']
    points = np.concatenate([p['P'][p['index']] for p in prims])
    names = np.array([g.js['materials'][prims[i]['material']].get('name', '') for i in pi], dtype=object)
    is_glass = np.array([('Carro_Vidros' == n) if jimny else n.startswith('Glass') for n in names])
    if jimny:
        # Exclude lamp covers assigned the same black transparent material;
        # keep the cabin glass, not low lenses at the bumpers.
        is_glass &= (cen[:, 1] > .84) & (cen[:, 0] < .95) & (cen[:, 0] > -1.60) & (np.abs(cen[:, 2]) < .74)
    # Authored transparent lamp covers are distinct from opaque reflectors and
    # breakable cabin panes. One merged source-lens draw retains their tint,
    # alpha and geometry without an opaque black cover hiding the optics.
    blended = np.array([g.js['materials'][prims[i]['material']].get('alphaMode') == 'BLEND' for i in pi])
    optical_glass = blended & ~is_glass if jimny else np.zeros(len(pi), bool)
    add_part(r, 'opticalGlass', optical_glass)
    pane = np.full(len(pi), -1, dtype=np.int8)
    glass_points = points[is_glass].reshape(-1, 3)
    if not len(glass_points):
        raise RuntimeError(key + ': no actual window glass')
    glass_mid = (glass_points[:, 0].min() + glass_points[:, 0].max()) / 2
    for i in np.flatnonzero(is_glass):
        n = fn[i]
        pane[i] = 4 if abs(n[1]) > .93 else (0 if cen[i, 2] < 0 else 2) if abs(n[2]) > abs(n[0]) else 1 if cen[i, 0] > glass_mid else 3
    glass_ids = sorted(np.flatnonzero(is_glass).tolist(), key=lambda i: pane[i])
    add_part(r, 'glass', glass_ids, panes=[int(np.sum(pane == j)) for j in range(5)])
    lo, hi = vertices(prims).min(0), vertices(prims).max(0)
    width, length = hi[2] - lo[2], hi[0] - lo[0]
    belt = float(np.percentile(glass_points[:, 1], 2))
    roof = float(np.percentile(glass_points[:, 1], 99))
    wheels = []
    wheel_mask = np.zeros(len(pi), bool)
    if jimny:
        # Four real road tyres. The vertical spare remains fixed to the rear door.
        tyre_mask = names == 'Carro_Pneu'
        for front in (True, False):
            for side in (-1, 1):
                selection = tyre_mask & (np.abs(cen[:, 2]) > width * .27) & (cen[:, 1] < .76) & ((cen[:, 0] > 0) == front) & ((cen[:, 2] < 0) == (side < 0))
                tp = points[selection].reshape(-1, 3)
                center, radius, tyre_width, axle = circle(tp)
                radial = np.linalg.norm(points[:, :, :2] - center[:2], axis=2)
                # Body suspension/calipers stay fixed. Only authored tyre and
                # circular chromed road-wheel faces inside the rubber turn.
                candidate = np.array([n in ('Carro_Cromado', 'Carro_Disco') for n in names])
                inside = (radial.max(1) < radius * .89) & (np.abs(points[:, :, 2] - center[2]).max(1) < tyre_width / 2 + .015)
                rim = candidate & inside
                index = len(wheels)
                add_part(r, 'wheel%d.tyre' % index, selection, center)
                add_part(r, 'wheel%d.rim' % index, rim, center)
                wheel_mask |= selection | rim
                wheels.append(dict(x=float(center[0]), y=float(center[1]), z=float(center[2]), r=radius, width=tyre_width, side=side, front=front, axle=axle.tolist()))
    else:
        for index, group in enumerate(wheel_groups):
            p = prims[group[0]]
            center, radius, tyre_width, axle = circle(p['P'], p['N'])
            ids = np.flatnonzero(np.isin(pi, group))
            colors = sampled(g, p, 'baseColorTexture')
            orm = sampled(g, p, 'metallicRoughnessTexture')
            # The source labels its black tyres as metallic in the ORM map.
            # Classify the actual rubber by its colour and position outside the
            # hub; do not let that authoring quirk turn every wheel into a rim.
            q = p['P'][p['index']]
            radial = np.linalg.norm(q[:, :, :2] - center[:2], axis=2).mean(1)
            rubber = (np.max(colors[:, :3], axis=1) < 85) & (radial > radius * .62)
            # This pack authors every road wheel around its local X axle. The
            # source parent transform is the exact hub, unlike whole-mesh PCA
            # which is biased by asymmetric spokes, valves and hub decoration.
            # Local Y/Z bounds are exactly ±402.399/422.971 source units.
            center = p['sourcePivot'].copy()
            axle = p['sourceAxle'].copy()
            if axle[2] < 0:
                axle = -axle
            delta = p['P'] - center
            radial = np.sqrt(np.maximum(0, np.sum(delta * delta, axis=1) - (delta @ axle) ** 2))
            radius = float(np.percentile(radial, 99.8))
            tyre_width = float(np.ptp(delta @ axle))
            add_part(r, 'wheel%d.tyre' % index, ids[rubber], center)
            add_part(r, 'wheel%d.rim' % index, ids[~rubber], center)
            wheel_mask[ids] = True
            wheels.append(dict(x=float(center[0]), y=float(center[1]), z=float(center[2]), r=radius, width=tyre_width, side=-1 if center[2] < 0 else 1, front=bool(center[0] > 0), axle=axle.tolist()))
    lamp_mask = np.array([('Refletor' in n or 'Vidro_Laranja' in n or 'Vidros_Vermelhos' in n or n in ('Carro_Reflect', 'Carro_Reflector', 'Carro_Ref', 'Carro_Refl')) if jimny else n.startswith('Optics') for n in names])
    lamp_mask &= ~optical_glass
    lamps = {}
    for side, suffix in ((-1, 'Left'), (1, 'Right')):
        for front, prefix in ((True, 'head'), (False, 'tail')):
            mask = lamp_mask & ~wheel_mask & ((cen[:, 0] > 0) == front) & ((cen[:, 2] < 0) == (side < 0))
            if not np.any(mask):
                continue
            name = prefix + suffix
            add_part(r, name, mask)
            p = points[mask].reshape(-1, 3)
            c = (p.min(0) + p.max(0)) / 2
            lamps[name] = dict(x=float(c[0]), y=float(c[1]), z=float(c[2]), size=.22)
    paint = np.zeros(len(pi), bool)
    if jimny:
        paint = names == 'Carro_Pintura'
    else:
        for j, p in enumerate(prims):
            if 'Body' not in p['node'] or 'Wheel' in p['node']:
                continue
            local = sampled(g, p, 'metallicRoughnessTexture')
            # Authored coating is the texture's metallic=93/255 region; plastic
            # is zero and chrome is full metal. Preserve the paint's actual UVs.
            paint[pi == j] = (local[:, 2] > 65) & (local[:, 2] < 125)
    if key == 's2_suv':
        extra, r['exteriorPaintProof'] = s2_exterior_paint(r, paint)
        paint |= extra
    remaining = ~is_glass & ~wheel_mask & ~lamp_mask & ~optical_glass
    hood = paint & remaining & (cen[:, 0] > glass_points[:, 0].max() - .03) & (fn[:, 1] > .45)
    panel = paint & remaining & ~hood & (cen[:, 1] > belt - .08)
    shell = paint & remaining & ~hood & ~panel
    add_part(r, 'shell', shell)
    add_part(r, 'panels', panel)
    add_part(r, 'hood', hood)
    interior = remaining & ~paint & (cen[:, 0] > glass_points[:, 0].min()) & (cen[:, 0] < glass_points[:, 0].max()) & (np.abs(cen[:, 2]) < width * .34) & (cen[:, 1] > .38) & (cen[:, 1] < roof)
    add_part(r, 'cabin', interior)
    add_part(r, 'trim', remaining & ~paint & ~interior)
    r['paint_mask'] = paint
    def pane_points(which):
        return points[pane == which].reshape(-1, 3)
    def ends(which, fallback):
        p = pane_points(which)
        if not len(p):
            return fallback, fallback
        a, b = p[:, 1].min(), p[:, 1].max()
        return float(np.median(p[p[:, 1] < a + .15 * (b - a), 0])), float(np.median(p[p[:, 1] > b - .15 * (b - a), 0]))
    xf, rf = ends(1, float(glass_points[:, 0].max()))
    xb, rb = ends(3, float(glass_points[:, 0].min()))
    half_base = float(np.percentile(np.abs(glass_points[glass_points[:, 1] < belt + .12, 2]), 90))
    highp = glass_points[glass_points[:, 1] > roof - .12]
    half_top = float(np.percentile(np.abs(highp[:, 2]), 90))
    body_points = points[paint].reshape(-1, 3)
    if not len(body_points):
        raise RuntimeError(key + ': no painted body')
    profiles, sections = [], []
    for x in np.linspace(lo[0], hi[0], 41):
        near = body_points[np.abs(body_points[:, 0] - x) < .10]
        profiles.append(float(near[:, 1].max()) if len(near) else None)
        sections.append([float(near[:, 1].min()), float(near[:, 1].max()), float(np.abs(near[:, 2]).max())] if len(near) else None)
    for rows in (profiles, sections):
        for i in range(len(rows)):
            if rows[i] is None:
                rows[i] = rows[i - 1] if i else next(x for x in rows if x is not None)
    sill = float(np.percentile(body_points[:, 1], 3))
    hinge_y = float(np.median(points[hood][:, :, 1])) if np.any(hood) else belt
    r['meta'] = dict(type=key, title='Suzuki Jimny 2023' if jimny else 'Generic SUV' if key == 's2_suv' else 'Generic Offroad',
                     author='tonielpro520' if jimny else 'Comrade1280', kind='car', dims=(hi - lo).tolist(), wheels=wheels,
                     glass=dict(base=belt, roof=roof, xf=xf, xb=xb, rf=rf, rb=rb, halfBase=half_base, halfTop=half_top, crown=max(0, float(hi[1]) - roof - .04)),
                     lamps=lamps, hinge=[float(glass_points[:, 0].max()), hinge_y], sill=sill, profile=profiles, section=sections,
                     x0=float(lo[0]), x1=float(hi[0]), paintTexture=True, paintColor='#ffffff', hasInterior=jimny)
    if not jimny:
        r['meta']['wheelPivotProof'] = 'Original Wheel_G / Wheel_E parent GLTF transforms; local wheel axle X and centred ±Y/Z authored tyre bounds'
        if key == 's2_suv':
            r['meta']['exteriorPaint'] = {k: v for k, v in r['exteriorPaintProof'].items() if k not in ('sourceFaceIds', 'firstHitRays')}
    else:
        r['meta']['opticalGlass'] = {
            'sourceTriangles': int(np.sum(optical_glass)),
            'sourceAlpha': 'BLEND opacity retained in albedo alpha; dedicated two-sided transparent draw',
            'materials': [{'index': mi, 'name': m['name'],
                           'opacity': m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])[3],
                           'triangles': int(np.sum(optical_glass & (names == m['name'])))}
                          for mi, m in enumerate(g.js['materials'])
                          if np.any(optical_glass & (names == m['name']))],
        }
    return r


def atlas(results, output):
    entries = {}
    for r in results:
        g = r['g']
        r['material_tiles'] = {}
        r['paint_tiles'] = {}
        for mi in sorted(set(p['material'] for p in r['prims'])):
            material = g.js['materials'][mi]
            pbr = material.get('pbrMetallicRoughness', {})
            albedo = material_image(g, mi, 'baseColorTexture')
            orm = material_image(g, mi, 'metallicRoughnessTexture')
            factor = pbr.get('baseColorFactor', [1, 1, 1, 1])
            roughness = float(pbr.get('roughnessFactor', 1))
            metalness = float(pbr.get('metallicFactor', 1))
            if albedo is None and orm is None:
                alpha = int(round(np.clip(factor[3], 0, 1) * 255)) if material.get('alphaMode') in ('BLEND', 'MASK') else 255
                albedo = Image.new('RGBA', (8, 8), tuple(int(round(np.clip(c, 0, 1) ** (1 / 2.2) * 255)) for c in factor[:3]) + (alpha,))
            else:
                if albedo is None:
                    albedo = Image.new('RGBA', orm.size, (255, 255, 255, 255))
                a = np.asarray(albedo).astype(float)
                # BaseColorFactor is linear, texture RGB is sRGB.
                linear = np.where(a[:, :, :3] / 255 <= .04045, a[:, :, :3] / 255 / 12.92, ((a[:, :, :3] / 255 + .055) / 1.055) ** 2.4)
                linear *= np.array(factor[:3])
                a[:, :, :3] = np.where(linear <= .0031308, linear * 12.92, 1.055 * np.power(linear, 1 / 2.4) - .055) * 255
                if material.get('alphaMode') in ('BLEND', 'MASK'):
                    a[:, :, 3] *= factor[3]
                else:
                    a[:, :, 3] = 255
                albedo = Image.fromarray(np.uint8(np.clip(a, 0, 255)), 'RGBA')
            if orm is None:
                orm = Image.new('RGB', albedo.size, (255, 255, 255))
            elif orm.size != albedo.size:
                orm = orm.resize(albedo.size, Image.Resampling.LANCZOS)
            else:
                orm = orm.convert('RGB')
            h = hashlib.sha256(albedo.tobytes() + orm.tobytes() + str(albedo.size).encode()).hexdigest()
            entries.setdefault(h, {'albedo': albedo, 'orm': orm, 'users': []})['users'].append([r['meta']['type'], mi, material.get('name')])
            r['material_tiles'][mi] = {'hash': h, 'finish': [roughness, metalness]}
            if r['meta']['type'] in ('s2_suv', 's3_offroad') and 'Body' in material.get('name', ''):
                pixels = np.asarray(albedo).astype(float)
                mr_pixels = np.asarray(orm)
                coating = (mr_pixels[:, :, 2] > 65) & (mr_pixels[:, :, 2] < 125)
                rgb = pixels[:, :, :3]
                # Remove only the source's paint pigment. The relative baked
                # shading, trim, decals and fine surface texture remain. Actual
                # paint triangles receive this separate palette-neutral tile;
                # original trim samples the unchanged author texture.
                base = np.percentile(rgb[coating], 95, axis=0) if np.any(coating) else np.array([255., 255., 255.])
                neutral = np.clip(rgb / np.maximum(base, 1.) * 255., 0, 255)
                pixels[:, :, :3] = np.where(coating[:, :, None], neutral, rgb)
                neutral_image = Image.fromarray(np.uint8(pixels), 'RGBA')
                paint_hash = hashlib.sha256(neutral_image.tobytes() + orm.tobytes() + str(neutral_image.size).encode()).hexdigest()
                # Coating is an authored, distinct texture region. All noncoat
                # pixels are byte-identical, so trim samples remain unchanged.
                # One tile avoids duplicating two whole 1024 body textures.
                del entries[h]
                entries.setdefault(paint_hash, {'albedo': neutral_image, 'orm': orm, 'users': []})['users'].append([r['meta']['type'], mi, material.get('name') + ' (neutral coating; original trim texels)'])
                r['paint_tiles'][mi] = {'hash': paint_hash, 'finish': [roughness, metalness]}
                r['material_tiles'][mi] = r['paint_tiles'][mi]
                r['meta']['sourcePaintPalette'] = (base / 255).tolist()
    # Damage-created door/trunk panels use an actual neutral swatch in this
    # atlas rather than UVs from the legacy vehicle atlas's paint strip.
    white = Image.new('RGBA', (8, 8), (255, 255, 255, 255))
    white_orm = Image.new('RGB', (8, 8), (255, 255, 255))
    white_hash = hashlib.sha256(white.tobytes() + white_orm.tobytes() + str(white.size).encode()).hexdigest()
    entries.setdefault(white_hash, {'albedo': white, 'orm': white_orm, 'users': []})['users'].append(['damage-panels', -1, 'neutral white'])
    sizes = {h: e['albedo'].size for h, e in entries.items()}
    rects = legacy.shelf_pack(sizes, ATLAS, ATLAS)
    if rects is None:
        raise RuntimeError('all full-resolution source textures must fit the 4096 atlas')
    color = Image.new('RGBA', (ATLAS, ATLAS), (0, 0, 0, 0))
    finish = Image.new('RGB', (ATLAS, ATLAS), (255, 255, 255))
    for h, (x, y) in rects.items():
        entry = entries[h]
        w, height = entry['albedo'].size
        for destination, image in ((color, entry['albedo']), (finish, entry['orm'])):
            # Duplicate the edge texels; mip padding never changes source pixels.
            padded = image.resize((w + 4, height + 4), Image.Resampling.NEAREST)
            padded.paste(image, (2, 2))
            destination.paste(padded, (x - 2, y - 2))
        entry['rect'] = [x, y, w, height]
    color.save(output / 'approved-vehicle-albedo.webp', format='WEBP', lossless=True, method=6)
    finish.save(output / 'approved-vehicle-orm.webp', format='WEBP', lossless=True, method=6)
    color.resize((2048, 2048), Image.Resampling.LANCZOS).save(output / 'approved-vehicle-albedo-low.webp', format='WEBP', lossless=True, method=6)
    finish.resize((2048, 2048), Image.Resampling.LANCZOS).save(output / 'approved-vehicle-orm-low.webp', format='WEBP', lossless=True, method=6)
    wx, wy = rects[white_hash]
    for r in results:
        r['meta']['paintUv'] = [(wx + 4) / ATLAS, (wy + 4) / ATLAS]
    return rects, entries


def geometry_parts(results, work):
    arrays, manifest, lookup = {}, {}, {}
    for r in results:
        key = r['meta']['type']
        near_ratio = .12 if key == 'm2_sport' else .13 if key == 's1_jimny' else 1.
        far_ratio = .022 if key in ('m2_sport', 's1_jimny') else .22 if key == 'm1_enduro' else .55
        r['meta']['lodParts'] = {}
        for name, part in r['parts'].items():
            groups = [(name, part['tris'], None)]
            if part.get('panes'):
                groups, at = [], 0
                for i, count in enumerate(part['panes']):
                    if count:
                        groups.append((name + ':' + str(i), part['tris'][at:at + count], i))
                    at += count
            for group_name, triangles, pane in groups:
                P, N, UV, I, M = [], [], [], [], []
                vertex_map = {}
                for ti in triangles:
                    pi = int(r['tri_prim'][ti])
                    p = r['prims'][pi]
                    tri = []
                    for vi in r['tri_idx'][ti]:
                        vi = int(vi)
                        token = (pi, vi)
                        if token not in vertex_map:
                            vertex_map[token] = len(P)
                            P.append(p['P'][vi])
                            N.append(p['N'][vi])
                            pbr = r['g'].js['materials'][p['material']].get('pbrMetallicRoughness', {})
                            textured = 'baseColorTexture' in pbr or 'metallicRoughnessTexture' in pbr
                            UV.append(p['UV'][vi] if textured and p['UV'] is not None else [0.5, 0.5])
                        tri.append(vertex_map[token])
                    I.append(tri)
                    M.append(p['material'])
                base = key + '.' + group_name
                for suffix, ratio in (('', near_ratio), ('Far', far_ratio)):
                    ident = base + suffix
                    for field, data, dtype in (('p', P, np.float32), ('n', N, np.float32), ('uv', UV, np.float32), ('i', I, np.int32), ('m', M, np.uint16)):
                        arrays[ident + '.' + field] = np.asarray(data, dtype=dtype)
                    # Keep authored simple lenses/windows intact in the close model.
                    # Curved lamp covers and windows were vastly oversampled in
                    # the two showcase sources. Edge-collapse keeps their shape
                    # while removing invisible subdivisions, without clustering.
                    delicate = name in ('glass', 'opticalGlass', 'head', 'tail') or name.startswith(('head', 'tail'))
                    chosen_ratio = (.30 if key in ('m2_sport', 's1_jimny') else 1.) if delicate and not suffix else ratio
                    manifest[ident] = {'ratio': chosen_ratio}
                    lookup[ident] = [key, name + suffix, pane]
            r['meta']['lodParts'][name] = name + 'Far'
    np.savez(work / 'parts-input.npz', **arrays)
    (work / 'parts-manifest.json').write_text(json.dumps(manifest, indent=2))
    (work / 'parts-lookup.json').write_text(json.dumps(lookup, indent=2))
    return lookup


def write_pack(results, work, output, rects, entries, lookup):
    geometry = np.load(work / 'parts-output.npz')
    blob = legacy.Blob()
    header = {'version': 1, 'atlas': [ATLAS, ATLAS], 'finish': 'roughnessMetalness', 'models': {}}
    for r in results:
        key = r['meta']['type']
        meta = copy.deepcopy(r['meta'])
        all_p = vertices(r['prims'])
        lo, hi = all_p.min(0), all_p.max(0)
        extent = np.maximum(hi - lo, 1e-5)
        meta['quant'] = lo.tolist() + extent.tolist()
        meta['parts'] = {}
        combined = {}
        for ident, (model, part, pane) in lookup.items():
            if model != key:
                continue
            group = combined.setdefault(part, {'points': [], 'normals': [], 'uv': [], 'sourceUV': [], 'atlasRect': [], 'finish': [], 'indices': [], 'colors': [], 'panes': [0] * 5 if pane is not None else None})
            p, n, uv = [geometry[ident + '.' + field] for field in ('p', 'n', 'uv')]
            indices, materials = geometry[ident + '.i'], geometry[ident + '.m']
            vertex_map = {}
            base = len(group['points'])
            old_to_new = {}
            for ti, tri in enumerate(indices):
                mi = int(materials[ti])
                paint_part = part in ('paint', 'paintFar', 'steer.paint', 'steer.paintFar', 'shell', 'shellFar', 'panels', 'panelsFar', 'hood', 'hoodFar')
                tile = r['paint_tiles'].get(mi, r['material_tiles'][mi]) if paint_part else r['material_tiles'][mi]
                x, y = rects[tile['hash']]
                image = entries[tile['hash']]['albedo']
                w, h = image.size
                new_tri = []
                for vi in tri:
                    vi = int(vi)
                    # Blender output has a loop per corner. Keep sharp normals,
                    # source UV seams and material changes exact when deduplicating.
                    token = (p[vi].tobytes(), n[vi].tobytes(), uv[vi].tobytes(), mi)
                    if token not in vertex_map:
                        vertex_map[token] = len(group['points'])
                        group['points'].append(p[vi])
                        group['normals'].append(n[vi])
                        raw_u, raw_v = uv[vi]
                        u, v = np.mod([raw_u, raw_v], 1)
                        group['uv'].append([(x + u * w) / ATLAS, (y + v * h) / ATLAS])
                        group['sourceUV'].append([raw_u, raw_v])
                        group['atlasRect'].append([x / ATLAS, y / ATLAS, w / ATLAS, h / ATLAS])
                        group['finish'].append(tile['finish'])
                        pixel = image.getpixel((min(w - 1, max(0, int(u * w))), min(h - 1, max(0, int(v * h)))))
                        group['colors'].append(pixel[:3])
                    new_tri.append(vertex_map[token])
                group['indices'].append(new_tri)
            if pane is not None:
                group['panes'][pane] = len(indices)
        for name, group in combined.items():
            count = len(group['points'])
            if count > 65535:
                raise RuntimeError('%s.%s exceeds uint16 vertex budget: %d' % (key, name, count))
            points = np.asarray(group['points'])
            q = np.round((points - lo) / extent * 65534 - 32767).astype(np.int16)
            norm = np.asarray(group['normals'])
            norm /= np.maximum(np.linalg.norm(norm, axis=1, keepdims=True), 1e-9)
            for field, arr, kind in (('p', q, 'i2'), ('n', np.round(norm * 127).astype(np.int8), 'i1'),
                                     ('uv', np.round(np.asarray(group['uv']) * 65535).astype(np.uint16), 'u2'),
                                     ('a', np.asarray(group['sourceUV'], dtype=np.float32), 'f4'),
                                     ('t', np.round(np.asarray(group['atlasRect']) * 65535).astype(np.uint16), 'u2'),
                                     ('f', np.round(np.asarray(group['finish']) * 255).astype(np.uint8), 'u1'),
                                     ('i', np.asarray(group['indices'], dtype=np.uint16), 'u2')):
                blob.add(key + '.' + name + '.' + field, arr, kind)
            if name.startswith(('head', 'tail')):
                blob.add(key + '.' + name + '.c', np.asarray(group['colors'], dtype=np.uint8), 'u1')
            original = name[:-3] if name.endswith('Far') else name
            info = dict(origin=r['parts'][original]['origin'], triangles=len(group['indices']), vertices=count)
            if group['panes'] is not None:
                info['panes'] = group['panes']
            meta['parts'][name] = info
        meta['triangles'] = sum(p['triangles'] for name, p in meta['parts'].items() if not name.endswith('Far'))
        meta['farTriangles'] = sum(p['triangles'] for name, p in meta['parts'].items() if name.endswith('Far'))
        # Derive the contract from the actual written parts on every path,
        # including --reuse-geometry metadata-only rebuilds.
        meta['lodParts'] = {name: name + 'Far' for name in meta['parts'] if not name.endswith('Far') and name + 'Far' in meta['parts']}
        meta['sourceTriangles'] = int(sum(len(p['index']) for p in r['prims']))
        header['models'][key] = meta
    header['arrays'] = blob.arrays
    encoded = json.dumps(header, separators=(',', ':')).encode()
    encoded += b' ' * (-(12 + len(encoded)) % 4)
    (output / 'approved-vehicle-models.bin').write_bytes(b'DECVM001' + struct.pack('<I', len(encoded)) + encoded + blob.data)
    (work / 'approved-models-header.json').write_text(json.dumps(header, indent=2))
    return header


def verify_pack(header, output):
    data = (output / 'approved-vehicle-models.bin').read_bytes()
    length = struct.unpack('<I', data[8:12])[0]
    base = 12 + length
    types = {'i2': '<i2', 'i1': 'i1', 'u2': '<u2', 'u1': 'u1', 'f4': '<f4'}
    checks = 0
    if tuple(header['models']) != IDS or base % 4:
        raise RuntimeError('complete five-model pack/alignment contract failed')
    budgets = dict(m1_enduro=15000, m2_sport=60000, s1_jimny=70000, s2_suv=10000, s3_offroad=10000)
    for key, model in header['models'].items():
        if model['triangles'] > budgets[key] or model['farTriangles'] >= model['triangles'] * .6:
            raise RuntimeError(key + ': laptop close/far triangle budget exceeded')
        checks += 1
        for part in model['parts']:
            if part.endswith('Far'):
                continue
            if model.get('lodParts', {}).get(part) != part + 'Far' or part + 'Far' not in model['parts']:
                raise RuntimeError(key + '.' + part + ': missing actual close/far mapping')
            checks += 1
        for part, info in model['parts'].items():
            arrays = {}
            for field in ('p', 'n', 'uv', 'f', 'a', 't', 'i'):
                kind, offset, count = header['arrays'][key + '.' + part + '.' + field]
                array = np.frombuffer(data, dtype=types[kind], count=count, offset=base + offset)
                if not np.all(np.isfinite(array)):
                    raise RuntimeError(key + '.' + part + ': nonfinite attribute')
                arrays[field] = array
                checks += 1
            count = info['vertices']
            expected = {'p': count * 3, 'n': count * 3, 'uv': count * 2, 'f': count * 2, 'a': count * 2, 't': count * 4, 'i': info['triangles'] * 3}
            if any(len(arrays[field]) != length for field, length in expected.items()) or int(arrays['i'].max()) >= count:
                raise RuntimeError(key + '.' + part + ': corrupt triangle/attribute ranges')
            if info.get('panes') and sum(info['panes']) != info['triangles']:
                raise RuntimeError(key + '.' + part + ': glass pane groups lost triangles')
            checks += 2
        for i, wheel in enumerate(model['wheels']):
            if 'wheel%d.tyre' % i not in model['parts'] or not .2 < wheel['r'] < .7:
                raise RuntimeError(key + ': missing rubber or invalid measured radius')
            if abs(np.linalg.norm(wheel['axle']) - 1) > 1e-5:
                raise RuntimeError(key + ': axle is not normalized')
            checks += 2
        if key == 's1_jimny':
            optics = model.get('opticalGlass', {})
            if optics.get('sourceTriangles') != 17818 or sum(m['triangles'] for m in optics.get('materials', [])) != 17818:
                raise RuntimeError('Jimny authored non-cabin optical glass ownership changed')
            if not all(name in model['parts'] for name in ('opticalGlass', 'opticalGlassFar', 'headLeft', 'headRight', 'tailLeft', 'tailRight')):
                raise RuntimeError('Jimny optical covers or opaque reflectors missing')
            checks += 2
    return checks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--out', type=Path, default=ROOT / 'assets')
    parser.add_argument('--work', type=Path, default=ROOT / 'dist/approved-vehicles-converter')
    parser.add_argument('--reuse-geometry', action='store_true', help='Reuse an existing identical part topology for metadata/material-only refinements')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    legacy_before = {name: sha(ROOT / 'assets' / name) for name in ('vehicle-models.bin', 'vehicle-atlas.webp')}
    assembled = args.work / 'm1-assembled.glb'
    prepare = ROOT / 'tools/approved_vehicle_models_prepare.py'
    if not assembled.exists():
        subprocess.run(['blender', '-b', '--threads', '2', '-P', str(prepare), '--', 'assemble-m1', str(args.source), str(assembled)], check=True)
    results = [moto(args.source, key, assembled) if key.startswith('m') else suv(args.source, key) for key in IDS]
    source_partition = {}
    for r in results:
        ownership = np.zeros(len(r['tri_prim']), dtype=np.uint8)
        for part in r['parts'].values():
            ownership[np.asarray(part['tris'], dtype=np.int32)] += 1
        if not np.all(ownership == 1):
            raise RuntimeError(r['meta']['type'] + ': source faces must belong to exactly one role')
        source_partition[r['meta']['type']] = {'triangles': len(ownership), 'allSourceFacesAssignedExactlyOnce': True}
    rects, entries = atlas(results, args.out)
    lookup = json.loads((args.work / 'parts-lookup.json').read_text()) if args.reuse_geometry else geometry_parts(results, args.work)
    if not args.reuse_geometry:
        subprocess.run(['blender', '-b', '--threads', '2', '-P', str(prepare), '--', 'simplify', str(args.work / 'parts-input.npz'), str(args.work / 'parts-output.npz'), str(args.work / 'parts-manifest.json')], check=True)
    header = write_pack(results, args.work, args.out, rects, entries, lookup)
    integrity_checks = verify_pack(header, args.out)
    legacy_after = {name: sha(ROOT / 'assets' / name) for name in legacy_before}
    if legacy_before != legacy_after:
        raise RuntimeError('legacy vehicle data changed')
    receipt = {'models': {key: {k: header['models'][key][k] for k in ('title', 'sourceTriangles', 'triangles', 'farTriangles', 'dims', 'wheels')} for key in IDS},
               'legacyUntouched': legacy_after, 'output': {name: {'sha256': sha(args.out / name), 'bytes': (args.out / name).stat().st_size} for name in ('approved-vehicle-models.bin', 'approved-vehicle-albedo.webp', 'approved-vehicle-orm.webp', 'approved-vehicle-albedo-low.webp', 'approved-vehicle-orm-low.webp')},
               'sourcePixelsDownsampled': False,
               'sourcePartition': source_partition,
               'authoredOpticalGlass': header['models']['s1_jimny']['opticalGlass'],
               'sourceExteriorPaint': header['models']['s2_suv']['exteriorPaint'],
               'integrityChecks': integrity_checks,
               'lowAtlas': {'size': [2048, 2048], 'purpose': 'LOW/MEDIUM GPU storage and upload reduction; HQ source texels retained'},
               'sourceUVRepeat': {'attributes': {'a': 'f4 source UV vec2', 't': 'u2 normalized atlas rectangle vec4'}, 'sampling': 'rect.xy + fract(sourceUV) * rect.zw', 'solidUV': 'constant 0.5 for materials without any image'},
               'atlasTiles': {h: {'rect': entry['rect'], 'users': entry['users']} for h, entry in entries.items()}}
    source_files = {
        'm1_enduro': ['motorcycles/vgframework/data--Meshes--Cars--Motorbike--motorbike.fbx', 'motorcycles/vgframework/data--Meshes--Cars--Motorbike--motorbike_fork.fbx', 'motorcycles/vgframework/data--Meshes--Cars--Motorbike--motorbike_wheel.fbx', 'motorcycles/vgframework/data--Textures--Cars--Motorbike--motorbike_albedo.png', 'motorcycles/vgframework/prefab.xml'],
        'm2_sport': ['motorcycles/nonplanar/assets--motorcycle.glb'],
        's1_jimny': ['suv/jimny-2023.glb', 'suv/jimny-decoded.glb'],
        's2_suv': ['suv/carpack-4.glb'], 's3_offroad': ['suv/carpack-4.glb'],
    }
    evidence = {
        'm1_enduro': {'author': 'jsa201077 (unityjsa7)', 'source': 'https://sketchfab.com/3d-models/real-motorbike-02-unity3d-f24e366933c54835b562e5210d93047f', 'license': 'CC BY 4.0', 'evidence': 'Asset-specific third-party credit, VGFramework README line 300', 'evidenceURL': 'https://github.com/vimontgames/vgframework/blob/b3173a3814790af7061f1949437a3c958b00000b/README.md', 'firstPartyVerification': 'not independently confirmed; creator page blocked in research session'},
        'm2_sport': {'author': 'nouter2077', 'source': 'https://skfb.ly/oIYFv', 'license': 'CC BY 4.0', 'evidence': 'Asset-specific third-party credit, Nonplanar-Vehicle-Control README lines 116–117', 'evidenceURL': 'https://github.com/thomasfork/Nonplanar-Vehicle-Control/blob/8cb0ee51e2cf5cf7b3abbf21d3bdadc538a6c672/README.md', 'firstPartyVerification': 'not independently confirmed; creator page blocked in research session'},
    }
    for key in ('s1_jimny', 's2_suv', 's3_offroad'):
        original = args.source / source_files[key][0]
        raw = original.read_bytes()
        json_length = struct.unpack('<I', raw[12:16])[0]
        source_header = json.loads(raw[20:20 + json_length])
        evidence[key] = {'embeddedAssetMetadata': source_header.get('asset', {}), 'evidence': 'Original downloaded GLB author, source and CC BY 4.0 licence metadata'}
    provenance = {'approved': ['M1', 'M2', 'S1', 'S2', 'S3'], 'freeAssetsOnly': True, 'evidence': evidence,
                  'files': {key: [{'path': name, 'bytes': (args.source / name).stat().st_size, 'sha256': sha(args.source / name)} for name in names] for key, names in source_files.items()},
                  'assembly': {'m1': 'Source prefab transforms applied to raw FBX vertex coordinates, matching the source UFBX importer', 'm2': 'Rigid source Z-up → game Y-up rotation', 's1': 'Rigid GLTF +Z front → game +X front rotation', 's2_s3': 'Vehicle selection from original passenger pack, whole-vehicle wheel-baseline rigid orientation and authored red-tail colour sign'},
                  'optimization': 'Blender edge collapse preserves mesh/material/UV surfaces; exact coincident vertices welded within 0.1 micrometre, no vertex clustering, no part removal',
                  'changes': 'Damage/render part partition, measured wheel origins/axes, driver seat/grip contacts, skin/trim paint palette separation, PBR atlas packing and close/far levels; Jimny authored non-cabin BLEND optical covers retain their exact source face ownership, tint and alpha in a dedicated transparent role; S2 verified outer roof and upper-door faces move from trim to paint roles without changing their source positions, normals, UVs, RGB or ORM'}
    (args.work / 'source-provenance.json').write_text(json.dumps(provenance, indent=2))
    (args.work / 'exterior-paint-proof.json').write_text(json.dumps(next(r['exteriorPaintProof'] for r in results if 'exteriorPaintProof' in r), indent=2))
    (args.work / 'approved-vehicle-conversion-receipt.json').write_text(json.dumps(receipt, indent=2))
    print(json.dumps(receipt['models'], indent=2), flush=True)


if __name__ == '__main__':
    main()
