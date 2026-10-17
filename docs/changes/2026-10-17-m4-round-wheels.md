Corrected the M4 Utility’s mildly oval source tyre and rim geometry around its
already calibrated axles. All four wheels retain their source triangles, UVs and
profile; split normals follow the bounded measured affine fit. Body and fixed
running gear remain unchanged. No extra draw calls or per-frame geometry work.

New world-space checks cover six actual wheel rings through forward/reverse spin,
steering, body LOD and the real puncture/repair matrices. Intentional flat-tyre
squash remains vertical while rolling, and repair restores circular tyres.
