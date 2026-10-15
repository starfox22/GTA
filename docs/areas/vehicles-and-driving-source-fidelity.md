# Downloaded vehicle source fidelity

The October 15 correction keeps the approved motorcycle assets and the original
23-model pack intact. SUV paint looked dented because rebuilding and smoothing a
mesh changed its authored split normals, including at a decimation ratio of one.
The Jimny also lost broad painted detail through excessive reduction. Source
geometry is the reference; more gloss or double-sided rendering cannot fix this.

`tools/approved_vehicle_models_prepare.py` copies all attributes directly for
SUV parts at ratio one. Reduced SUV parts restore authored corner normals through
Blender's nearest-face interpolated custom-normal transfer after decimation.
Motorcycle preparation follows its unchanged path. The Jimny's near painted shell,
panels and hood retain full authored detail; trim is conservatively reduced.

`tools/approved_vehicle_models.py` writes signed 16-bit normals for near SUVs,
signed 8-bit for far levels and the unchanged motorcycles. The runtime normalizes
both. Index buffers select 32-bit only when needed. A zero normal left by collapsed
SUV trim/cabin geometry recovers from a nearby same-material authored vertex; each
repair is recorded with position and distance in model metadata. This preserves
positions, UVs and face ownership. Never replace such normals with an arbitrary
up vector or smooth the whole body again.

Current active budgets (near/far triangles, including wheels):

| Source model | Near | Far |
| --- | ---: | ---: |
| Jimny | 122,277 | 10,043 |
| Full-size SUV | 7,951 | 4,354 |
| Compact offroad | 6,502 | 3,563 |

The Jimny's close-view increase is deliberate. Shared cached kits and existing
distance/tier LOD keep distant traffic on its smaller level. Open/damaged doors
pin near geometry so a body cannot swap back over its doorway. Low/Medium retain
the shared 2048px albedo/ORM atlases; High/Ultra use 4096px. Texture files and all
302 motorcycle arrays are byte-identical to the October 14 integration. This is
a fidelity correction, not evidence of hardware frame rates.

Regeneration uses the same five source downloads documented in
[the approved integration](../audit/approved-vehicle-integration-2026-10-14/README.md):

```sh
python3 tools/approved_vehicle_models.py /tmp/GTA-asset-research \
  --out dist/suv-rebuild/assets --work dist/suv-rebuild/work
```

Use a new work directory after preparation changes. `--reuse-geometry` is only for
metadata/material changes on known identical topology. It must not conceal a
stale simplifier result. Preserve all five models on every rebuild.

`tools/tests/vehicle-source-fidelity.mjs` checks independent original-source body
positions and normals using the production decoder. `approved-suv-rigs.mjs`
checks actual builders, livery, windows, contacts, hinges, aperture/cabin rays,
damage/repair and shared LOD. Host tests cannot establish rendered appearance.
Matched native images and the exact input HTML hashes are in the
[October 15 audit](../audit/vehicle-fidelity-2026-10-15/README.md). The isolated
normal experiment uses the previous runtime and corrected asset data; it is
explicitly distinguished from the later integrated runtime.
