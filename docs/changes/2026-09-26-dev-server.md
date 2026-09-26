# Dev server, no-render mode and regression tests
- No player-visible change.
- `tools/dev.mjs`: one persistent headless page (`start`, `call <method> [json args]`, `keys`,
  `wait`, `shot` as a small JPEG, `errors`, `reload` after edits, `stop`); calls named console
  methods only.
- No-render dev mode: `?dev&norender` (or `?test&norender`) boots without the WebGL renderer
  and skips `drawWorld()` (`NO_RENDER`, render3d.js / game-loop.js): boot ~7-10 s instead of
  30-40 s, ~55 fps instead of ~1 fps under SwiftShader. Ignored without `?dev` / `?test`.
- `node tools/test.mjs`: regression tests, one per file in `tools/tests/` (boot status, brake
  distances, driving without NaN, sportsbook bets and settlement, mission 1 depot drop, demo
  gating).
