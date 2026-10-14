# Less CPU work in crowd queries and moving gate collisions

- Nearby crowd queries avoid most cell hash lookups while preserving every visitor, range, cap and encounter order. The moving lookup mirror uses 1,849 pointers; distant and outside-range queries keep their previous path.
- The 120 Hz vehicle collision pass reads only Fort Sentinel's current gate pieces, without copying all fixed sight solids for each nearby car. Depot, base and harbor contact body records are refreshed and reused across steps.
- Production-function audit: 31,684 ordered query comparisons, 240 encounter-order frames and 4,360 current ordered gate contacts passed. Migration, negative coordinates, cell borders, broken/open gate parts, altitude/boat exclusions and depot/harbor transitions are covered.
- A host 120-query batch reduced nearby-grid Map lookups from 4,581 to 182. Six alternating 300-frame host samples gave 724 → 522 ms median for that query/build workload; this measures these kernels, not full-game FPS or laptop GPU speed. Separate seeded LOW/ULTRA ABBA integration runs passed 48 stage-hash observations over 21,600 stepped frames (walking, driving, county, city pursuit and both Fort Sentinel views). Full-frame timing was mixed on the shared cloud machine; no GPU/FPS claim.
- Tools: `node tools/performance-kernels-check.mjs [--bench]`; regression `performance-kernels`.
