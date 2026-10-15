#!/usr/bin/env python3
"""Audit actual packed police meshes without a browser, WebGL, or GPU.

Run from any directory with Python 3 + numpy and Node installed. Writes the
sibling police-uv-before-after-measurements.json. The old UV algorithm is held
at BEFORE_COMMIT; the candidate functions are evaluated directly from src/.
No mesh, source attribute, source file, or asset is changed by this audit.
"""

import hashlib
import json
from pathlib import Path
import struct
import subprocess

import numpy as np


ROOT = Path(__file__).resolve().parents[4]
BEFORE_COMMIT = "d75acc1ebc3c56a6c62434512d72d2fde632200d"
OUT = Path(__file__).with_name("police-uv-before-after-measurements.json")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_at_commit(path):
    return subprocess.check_output(
        ["git", "show", f"{BEFORE_COMMIT}:{path}"], cwd=ROOT, text=True
    )


def pack(path):
    raw = (ROOT / path).read_bytes()
    size = struct.unpack_from("<I", raw, 8)[0]
    header = json.loads(raw[12 : 12 + size])
    types = {"f4": "<f4", "i1": "i1", "u1": "u1", "i2": "<i2", "u2": "<u2", "u4": "<u4"}
    arrays = {
        key: np.frombuffer(raw, dtype=types[t], count=count, offset=12 + size + offset)
        for key, (t, offset, count) in header["arrays"].items()
    }
    return header, arrays, sha(raw)


# These are the actual production functions, using a tiny BufferAttribute
# implementation rather than loading Three.js or creating a renderer. UV writes
# use Float32Array, just as vaGeometry's production BufferAttributes do.
NODE = r"""
const fs = require('node:fs');
const vm = require('node:vm');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
function extract(source, name) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing function ' + name);
  let depth = 0, began = false;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    // None of the audited functions contain braces in strings or comments.
    if (source[i] === '{') { depth++; began = true; }
    if (source[i] === '}' && --depth === 0 && began) return source.slice(start, i + 1);
  }
  throw new Error('unterminated ' + name);
}
class Attr {
  constructor(array, itemSize) { this.array = new Float32Array(array); this.itemSize = itemSize; this.count = this.array.length / itemSize; }
  getX(i) { return this.array[i * this.itemSize]; }
  getY(i) { return this.array[i * this.itemSize + 1]; }
  getZ(i) { return this.array[i * this.itemSize + 2]; }
  setXY(i, x, y) { this.array[i * this.itemSize] = x; this.array[i * this.itemSize + 1] = y; }
}
function evaluate(sources, before) {
  const ctx = vm.createContext({ Math, Float32Array });
  const bodies = sources.looks.slice(sources.looks.indexOf('const POLICE_BODIES ='), sources.looks.indexOf('const POLICE_LIVERIES ='));
  const functions = [['looks', 'policeRing'], ['looks', 'policeRingV'], ['cabins', 'liveryFrame'], ['asset', 'policeAssetLiveryUv']]
    .map(([file, name]) => extract(sources[file], name));
  vm.runInContext('const POLICE_SWATCH_BAND = .125, LIVERY_W = 1024, LIVERY_H = 512; const clamp = (x,a,b) => Math.max(a,Math.min(b,x)); const lerpNumber = (a,b,t) => a+(b-a)*t; ' + bodies + '\n' + functions.join('\n'), ctx);
  ctx.geo = { attributes: {position: new Attr(input.position, 3), uv: new Attr(input.position.length / 3 * 2, 2)} };
  ctx.params = input;
  if (before) {
    vm.runInContext(`const model = params.model, sec = model.section, k = params.k;
      const station = x => {
        const t=clamp(((x/k-model.x0)/(model.x1-model.x0))*(sec.length-1),0,sec.length-1), i=Math.min(sec.length-2,Math.floor(t)), f=t-i;
        return {yb:lerpNumber(sec[i][0],sec[i+1][0],f)*k, top:lerpNumber(sec[i][1],sec[i+1][1],f)*k, half:lerpNumber(sec[i][2],sec[i+1][2],f)*k};
      };
      policeAssetLiveryUv(geo, POLICE_BODIES[params.body], params.l, params.w, station);`, ctx);
  } else {
    vm.runInContext(`const model = params.model;
      policeAssetLiveryUv(geo, POLICE_BODIES[params.body], params.l, params.w,
        {yb:model.sill*params.k, top:model.glass.base*params.k, half:model.glass.halfBase*params.k});`, ctx);
  }
  return {uv:Array.from(ctx.geo.attributes.uv.array), position:Array.from(ctx.geo.attributes.position.array), functions};
}
const before = evaluate(input.before, true), after = evaluate(input.after, false);
process.stdout.write(JSON.stringify({before, after}));
"""


def summarize(position, index, uv, model, k, l, strict):
    tri = position[index]
    centre = tri.mean(axis=1)
    face = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    double_area = np.linalg.norm(face, axis=1)
    face /= np.maximum(1e-12, double_area[:, None])
    # Broad diagnosis region: central half of the car, exterior-facing side
    # triangles, middle half of model height, beyond half the model half-width.
    selected = (
        (np.abs(centre[:, 0]) < 0.25 * l)
        & (np.abs(face[:, 2]) > 0.6)
        & (centre[:, 1] > 0.25 * model["dims"][1] * k)
        & (centre[:, 1] < 0.75 * model["dims"][1] * k)
        & (np.abs(centre[:, 2]) > 0.25 * model["dims"][2] * k)
        & (double_area > 1e-4)
    )
    if strict:
        # The writing domain excludes the hidden cap blend, rocker/belt clamps,
        # and cross-centre triangles. All three vertices must be on the side.
        selected &= (
            (tri[:, :, 1].min(axis=1) >= model["sill"] * k)
            & (tri[:, :, 1].max(axis=1) <= model["glass"]["base"] * k)
            & (np.abs(tri[:, :, 2]).min(axis=1) >= model["glass"]["halfBase"] * k * 0.7)
            & ((tri[:, :, 2] > 0).all(axis=1) | (tri[:, :, 2] < 0).all(axis=1))
        )
    triuv = uv[index]
    a = np.stack([tri[:, 1, :2] - tri[:, 0, :2], tri[:, 2, :2] - tri[:, 0, :2]], axis=1)
    b = np.stack([triuv[:, 1] - triuv[:, 0], triuv[:, 2] - triuv[:, 0]], axis=1)
    selected &= np.abs(np.linalg.det(a)) > 1e-7
    jac = np.linalg.solve(a[selected], b[selected])
    # u always increases along +x. v must increase with y on -z and decrease
    # with y on +z. Reversal or collapse indicates folded/flat painted writing.
    signed_height = -np.sign(centre[selected, 2]) * jac[:, 1, 1]
    pixel_jac = jac * np.array([1024, 512])[None, None, :]
    singular = np.linalg.svd(pixel_jac, compute_uv=False)
    condition = singular[:, 0] / np.maximum(1e-12, singular[:, 1])
    shear = np.abs(jac[:, 0, 1] * 512 / (jac[:, 0, 0] * 1024))
    quantiles = lambda values: dict(zip(["p50", "p95", "max"], np.quantile(values, [.5, .95, 1]).tolist()))
    # Area weighted results keep tiny nearly degenerate faces from dominating.
    area = double_area[selected] / 2
    folds = signed_height <= 1e-9
    return {
        "triangles": int(selected.sum()),
        "fold_or_flat_triangles": int(folds.sum()),
        "fold_or_flat_area_fraction": float(area[folds].sum() / area.sum()),
        "pixel_jacobian_condition": quantiles(condition),
        "vertical_shear_pixels_per_horizontal_pixel": quantiles(shear),
        "minimum_signed_dv_dy": float(signed_height.min()),
    }


def main():
    sources = {"looks": "src/police3d-looks.js", "cabins": "src/police3d-cabins.js", "asset": "src/police3d-asset.js"}
    before = {key: source_at_commit(path) for key, path in sources.items()}
    after = {key: (ROOT / path).read_text() for key, path in sources.items()}
    report = {
        "before_commit": BEFORE_COMMIT,
        "source_sha256": {"before": {key: sha(text.encode()) for key, text in before.items()}, "after": {key: sha(text.encode()) for key, text in after.items()}},
        "method": "Packed Float32 positions, production JavaScript UV functions evaluated in Node vm, per-triangle xy-to-UV Jacobian; no browser/GPU. Broad sample uses central half length, |face.nz|>.6, middle half height, outer half half-width. Writing domain additionally requires all three vertices between fixed model.sill and glass.base and beyond .7*glass.halfBase on one side. Condition compares texture pixels to world xy units. Sign checks physical side orientation, not atlas image recognition.",
        "models": [],
    }
    for path, key, body in [("assets/vehicle-models.bin", "police", "crownvic"), ("assets/vehicle-models.bin", "police_charger", "charger"), ("assets/approved-vehicle-models.bin", "s2_suv", "utility")]:
        header, arrays, pack_hash = pack(path)
        model = header["models"][key]
        # Patrol vehicleSpec: 5.1m x 2.18m; draw scale .8; body width factor .87.
        l, w = 51.0, 21.8 * .87
        k = min(l / model["dims"][0], w / .87 / model["dims"][2], 10) if key == "s2_suv" else l / model["dims"][0]
        section = np.array(model["section"])
        entry = {"model": key, "body": body, "pack": path, "pack_sha256": pack_hash,
                 "l": l, "w": w, "scale": k,
                 "maximum_section_bottom_step_metres": float(np.abs(np.diff(section[:, 0])).max()),
                 "minimum_section_height_metres": float((section[:, 1] - section[:, 0]).min()), "parts": []}
        for part in ["shell", "shellFar"] if key == "s2_suv" else ["shell"]:
            prefix = key + "." + part
            q = arrays[prefix + ".p"].reshape(-1, 3).astype(float)
            position = ((q + 32767) / 65534 * np.array(model["quant"][3:]) + np.array(model["quant"][:3])) * k
            position = position.astype(np.float32).astype(float)
            index = arrays[prefix + ".i"].reshape(-1, 3)
            payload = {"before": before, "after": after, "body": body, "model": model, "l": l, "w": w, "k": k, "position": position.ravel().tolist()}
            result = json.loads(subprocess.check_output(["node", "-e", NODE], input=json.dumps(payload), text=True))
            assert np.array_equal(np.array(result["after"]["position"]).reshape(-1, 3), position)
            metrics = {"part": part, "source_triangles": len(index), "position_sha256": sha(position.astype("<f4").tobytes()),
                       "index_sha256": sha(index.tobytes()), "position_unchanged_by_uv_function": True}
            for name in ["before", "after"]:
                uv = np.array(result[name]["uv"]).reshape(-1, 2)
                metrics[name] = {"uv_sha256": sha(uv.astype("<f4").tobytes()),
                                 "broad_side_sample": summarize(position, index, uv, model, k, l, False),
                                 "writing_domain": summarize(position, index, uv, model, k, l, True),
                                 "shell_triangles_spanning_v_below_point3_to_above_point8": int(((uv[index, 1].min(axis=1) < .3) & (uv[index, 1].max(axis=1) > .8)).sum()),
                                 "evaluated_function_sha256": [sha(function.encode()) for function in result[name]["functions"]]}
            writing = metrics["after"]["writing_domain"]
            assert writing["fold_or_flat_triangles"] == 0, (key, part, "folded or collapsed writing")
            assert writing["vertical_shear_pixels_per_horizontal_pixel"]["max"] < 1e-3, (key, part, "non-affine writing")
            entry["parts"].append(metrics)
            print(key, part, json.dumps({name: metrics[name]["writing_domain"] for name in ["before", "after"]}, separators=(",", ":")))
        report["models"].append(entry)
    OUT.write_text(json.dumps(report, indent=2) + "\n")
    print(OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
