"""Quadric edge-collapse decimation for the street avatars (tools/npc_models.py), no third-party packages but numpy.

decimate(P, cp, tris, targets, part, mat) -> [index arrays], one per target triangle count (descending): each a subset
of the input vertices, so every level shares one vertex buffer.

    P      (n, 3) unique-vertex positions (vertices split by UV, normal or material share a control point)
    cp     (n,)   each vertex's control point (welded position)
    tris   (m, 3) triangles over the unique vertices
    part   (n,)   each vertex's main bone (a collapse across bones costs more: joints keep their loops)
    mat    (n,)   each vertex's material code (edges between materials and open edges are kept by boundary planes)

Half-edge collapses on the welded mesh (Garland and Heckbert quadrics, the survivor's own position, so UVs and skin
weights stay the asset's): a collapse u -> v is allowed only when every split vertex of u has exactly one partner of v
across a shared triangle (the UV chart carries over), the link condition holds and no triangle flips.
"""
import heapq

import numpy as np


def decimate(P, cp, tris, targets, part, mat, boundary_weight=40.0, part_weight=4.0):
    tris = np.asarray(tris, dtype=np.int64).copy()
    ncp = int(cp.max()) + 1
    cpP = np.zeros((ncp, 3))
    cpP[cp] = P
    cpart = np.zeros(ncp, dtype=np.int64)
    cpart[cp] = part
    alive = np.ones(len(tris), dtype=bool)
    tri_cp = cp[tris]
    # Control point -> triangles, and -> its split vertices.
    vt = [set() for _ in range(ncp)]
    for t, (a, b, c) in enumerate(tri_cp):
        vt[a].add(t)
        vt[b].add(t)
        vt[c].add(t)
    # Quadrics: area-weighted face planes, plus boundary planes on open edges and material borders.
    Q = np.zeros((ncp, 4, 4))
    e1 = P[tris[:, 1]] - P[tris[:, 0]]
    e2 = P[tris[:, 2]] - P[tris[:, 0]]
    nrm = np.cross(e1, e2)
    area = np.linalg.norm(nrm, axis=1)
    nn = nrm / np.maximum(area, 1e-12)[:, None]
    dd = -np.einsum('ij,ij->i', nn, P[tris[:, 0]])
    planes = np.concatenate([nn, dd[:, None]], 1)
    K = planes[:, :, None] * planes[:, None, :] * (area / 2)[:, None, None]
    for k in range(3):
        np.add.at(Q, tri_cp[:, k], K)
    edges = {}
    for t, tc in enumerate(tri_cp):
        for k in range(3):
            a, b = int(tc[k]), int(tc[(k + 1) % 3])
            key = (a, b) if a < b else (b, a)
            edges.setdefault(key, []).append(t)
    tmat = mat[tris[:, 0]]
    for (a, b), ts in edges.items():
        if len(ts) == 1 or (len(ts) == 2 and tmat[ts[0]] != tmat[ts[1]]):
            t = ts[0]
            d = cpP[b] - cpP[a]
            L = np.linalg.norm(d)
            if L < 1e-9:
                continue
            bn = np.cross(d / L, nn[t])
            bl = np.linalg.norm(bn)
            if bl < 1e-9:
                continue
            bn /= bl
            pl = np.append(bn, -bn @ cpP[a])
            Kb = np.outer(pl, pl) * boundary_weight * L * L
            Q[a] += Kb
            Q[b] += Kb
    stamp = np.zeros(ncp, dtype=np.int64)
    gone = np.zeros(ncp, dtype=bool)

    def neighbours(u):
        out = set()
        for t in vt[u]:
            out.update(int(x) for x in tri_cp[t])
        out.discard(u)
        return out

    def cost(u, v):
        p = np.append(cpP[v], 1.0)
        c = p @ (Q[u] + Q[v]) @ p
        if cpart[u] != cpart[v]:
            c += part_weight * np.sum((cpP[u] - cpP[v]) ** 2) * 1e-2
        return max(c, 0.0)

    def push(a, b):
        cu, cv = cost(a, b), cost(b, a)
        if cu <= cv:
            heapq.heappush(heap, (cu, a, b, stamp[a], stamp[b]))
        else:
            heapq.heappush(heap, (cv, b, a, stamp[b], stamp[a]))

    def plan(u, v):
        """The split-vertex map for u -> v, or None when the collapse is not allowed."""
        shared = [t for t in vt[u] if t in vt[v]]
        if not shared or len(shared) > 2:
            return None
        common = neighbours(u) & neighbours(v)
        if len(common) != len(shared):
            return None
        M = {}
        for t in shared:
            tu = [int(tris[t][k]) for k in range(3) if tri_cp[t][k] == u][0]
            tv = [int(tris[t][k]) for k in range(3) if tri_cp[t][k] == v][0]
            if M.get(tu, tv) != tv:
                return None
            M[tu] = tv
        # Every split vertex of u in its other triangles must carry over.
        for t in vt[u]:
            if t in shared:
                continue
            for k in range(3):
                if tri_cp[t][k] == u and int(tris[t][k]) not in M:
                    return None
        # No flips, no slivers.
        for t in vt[u]:
            if t in shared:
                continue
            q = [cpP[x] for x in tri_cp[t]]
            n0 = np.cross(q[1] - q[0], q[2] - q[0])
            q = [cpP[v] if x == u else cpP[x] for x in tri_cp[t]]
            n1 = np.cross(q[1] - q[0], q[2] - q[0])
            l0, l1 = np.linalg.norm(n0), np.linalg.norm(n1)
            if l1 < 1e-12 or (n0 @ n1) < 0.2 * l0 * l1:
                return None
        return M, shared

    heap = []
    for (a, b) in edges:
        push(a, b)
    count = int(alive.sum())
    results = []
    goals = sorted(targets, reverse=True)
    gi = 0
    while gi < len(goals) and heap:
        if count <= goals[gi]:
            results.append(tris[alive].copy())
            gi += 1
            continue
        c, u, v, su, sv = heapq.heappop(heap)
        if gone[u] or gone[v] or stamp[u] != su or stamp[v] != sv:
            continue
        r = plan(u, v)
        if r is None:
            continue
        M, shared = r
        for t in shared:
            alive[t] = False
            for x in tri_cp[t]:
                vt[int(x)].discard(t)
            count -= 1
        for t in list(vt[u]):
            for k in range(3):
                if tri_cp[t][k] == u:
                    tris[t][k] = M[int(tris[t][k])]
                    tri_cp[t][k] = v
            vt[v].add(t)
        vt[u] = set()
        gone[u] = True
        Q[v] += Q[u]
        stamp[v] += 1
        for w in neighbours(v):
            push(v, w)
    while gi < len(goals):
        results.append(tris[alive].copy())
        gi += 1
    return results
