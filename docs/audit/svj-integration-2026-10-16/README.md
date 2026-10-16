# Downloaded SVJ source and integration proof

Pinned original GLB, model-specific CC-BY credit and source intake: `source-credit.json`
and `source-intake.json`. Conversion outputs, source wheel/door adaptations and all
output SHA-256 hashes: `conversion-receipt.json`. Bounded source partition counts:
`source-partition-counts.json`.

`source-corner-proof.json` compares every packed near triangle corner against the
pinned original after its documented rigid/uniform transform. All 508,324 triangles
retain their source positions, authored split normals and original UVs, with no
smoothing or welding. Only the independent 20,133-triangle far level is reduced.

`host-tests.json` records 2,870 assertions across seven actual production host
regression modules, including the final 231 focused SVJ checks. They exercise the
actual media loader, pack decoder, real builder/headroom, source scissor door
partition, wheels, complete far draw, PBR hooks, texture tier race handling and
char/repair restoration. `tools/quick-check.sh svj-ready` passed.

Rebuild commands, source limitations, changed game glass/cabin and runtime API
assertions: [SVJ integration](../../areas/vehicles-and-driving-models-svj.md).
These CPU proofs are separate from the parent review’s final native game captures;
they do not establish shader compilation, transparent sorting or hardware FPS.


Original downloaded source previews (not gameplay screenshots):

- [Front three-quarter](source-front-three-quarter.png)
- [Rear three-quarter](source-rear-three-quarter.png)

`source-preview.py` imports the untouched pinned GLB and adds only a neutral
studio floor, lights and cameras. `source-preview-receipt.json` records the source,
script and image hashes, original geometry count and CPU Cycles render settings.
Both retain the source’s purple paint, opaque canopy and static wheel steering.
They provide independent silhouette/material reference for the final game views;
render lighting, respray colour and gameplay glazing deliberately differ.

```sh
blender -b --threads 4 -P docs/audit/svj-integration-2026-10-16/source-preview.py -- \
  work/svj-source/original.glb work/svj-source-preview
```
