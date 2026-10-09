"""Vehicle models, boats: tools/vehicle_models.py's conversion for a downloaded boat (`kind='boat'`).

The boat in the game's frame (x ahead, y up, z to starboard; the waterline at y 0, `waterline` metres over the
keel), scaled to `length`: the hull, deck and fittings in one atlas-textured part (`body`), see-through panes
(`glass`: a blended material's triangles whose texture is mostly clear there), and the highest point (the mast
lamp). Brand names are painted over in the texture (`erase`, as the motorbikes'). src/boat-assets3d.js builds it.
"""
import numpy as np


def convert_boat(model, src_root, vm):
    import os
    from vehicle_models_moto import erase
    g = vm.Gltf(os.path.join(src_root, model['src']))
    mats = g.js.get('materials', [])
    prims = vm.load_primitives(g)
    images, image_keys = {}, {}
    for mi, m in enumerate(mats):
        t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if t is not None:
            key, img = g.image(t['index'])
            images[mi] = erase(img, key, model.get('erase', {}))
            image_keys[mi] = key
    if model.get('up') == '+z':
        for p in prims:
            for k in ('P', 'N'):
                v = p[k]
                p[k] = np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1)
    vm.to_game_frame(prims, model['front'])
    allP = np.concatenate([p['P'] for p in prims])
    lo, hi = allP.min(0), allP.max(0)
    s = model['length'] / (hi[0] - lo[0]) if model.get('length') else 1.0
    for p in prims:
        p['P'] = p['P'] * s
    lo, hi = lo * s, hi * s
    shift = np.array([-(lo[0] + hi[0]) / 2, -(lo[1] + model.get('waterline', 0.4)), -(lo[2] + hi[2]) / 2])
    for p in prims:
        p['P'] = p['P'] + shift
    T = vm.triangles(prims, mats, model)
    role = vm.cat(T, 'role')
    tri_prim = np.concatenate([np.full(len(t['idx']), t['prim']) for t in T])
    tri_idx = np.concatenate([t['idx'] for t in T])
    n = len(role)
    # Glass: a blended material's triangles where the texture is mostly see-through.
    glass = []
    rgba = {}
    for k in range(n):
        p = prims[tri_prim[k]]
        mi = p['material']
        if mi is None or mats[mi].get('alphaMode') != 'BLEND' or mi not in images or p['UV'] is None:
            continue
        if mi not in rgba:
            rgba[mi] = np.asarray(images[mi].convert('RGBA'))
        a = rgba[mi]
        uv = p['UV'][tri_idx[k]].mean(0)
        h, w = a.shape[:2]
        if a[int(min(h - 1, max(0, (uv[1] % 1) * h))), int(min(w - 1, max(0, (uv[0] % 1) * w))), 3] < 60:
            glass.append(k)
    glass_set = set(glass)
    keep = dict(vm.KEEP, **model.get('keep', {}))
    bc = model.get('borderCos', 0.985)
    body = [k for k in range(n) if role[k] != 'drop' and k not in glass_set]
    for k in glass:
        role[k] = 'glass'
    parts = {
        'body': dict(tris=body, keep=keep['trim'], borderCos=bc, minPiece=model.get('minPiece', 0)),
        'glass': dict(tris=glass, keep=keep.get('glass', 1.0), borderCos=bc),
    }
    allP = np.concatenate([p['P'] for p in prims])
    lo, hi = allP.min(0), allP.max(0)
    top = allP[np.argmax(allP[:, 1])]
    meta = dict(
        type=model['type'], title=model['title'], front=model['front'], kind='boat',
        dims=[round(float(hi[0] - lo[0]), 3), round(float(hi[1]), 3), round(float(hi[2] - lo[2]), 3)],
        draft=round(float(-lo[1]), 3), mast=[round(float(v), 3) for v in top], wheels=[],
        x0=round(float(lo[0]), 4), x1=round(float(hi[0]), 4), paintTexture=False, paintColor=None,
    )
    area = vm.cat(T, 'area')
    return dict(meta=meta, prims=prims, mats=mats, images=images, image_keys=image_keys, parts=parts, tri_prim=tri_prim,
                tri_idx=tri_idx, role=role, area=area)
