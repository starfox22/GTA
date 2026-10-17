# Reusable downloaded Monarch car pipeline

- Added an independent, source-pinned glTF/GLB converter for the licensed Monarch collection. Whole source near faces, split normals, RGBA colour seams, per-channel UVs, wheel geometry and measured door/cabin fits survive conversion; Far alone is reduced.
- Added lossless meshopt preparation with a pinned official decoder and recorded view/source hashes. Existing vehicle packs remain protected.
- Bounded texture allocation with compact per-source atlases, explicit documented resampling and Low/Medium1024 defaults. Source sidedness, mask cutoffs, normal scale and emissive strength accompany the source material maps.
- Added all-corner original-source verification and host regressions for semantic seams, wheel frames, material ownership and texture budgets. Native rendering and collection source credits are verified separately during integration.
