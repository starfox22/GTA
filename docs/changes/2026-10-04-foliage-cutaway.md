# See-through trees round the player
- Tree crowns, palm fronds and tall shrubs between the street camera and the player now dissolve
  round them (the same 4x4 screen door as the see-through roofs), on foot or in any vehicle: the
  Mount Ascent forest two-track and the creek ford, county forests, city street trees, Palm Keys and
  Monarch Isle palms, parks. The hole opens as a crown reaches the player's outline and closes after
  it has passed; trees behind or beside the player, grass and anything under 1.5 m stay whole, and the
  crowns' shade still falls on the player. It follows Settings · Character see-through.
- Internals: one tree material for every plant, so the test lives in its fragment shader from the start
  (three uniforms set once a frame, eased; no define, no new program, no extra draw call, no per-tree
  JS); the shadow pass never runs it. The plan is game logic (foliage-cutaway.js), the uniforms
  vegetation3d-cutaway.js.
- Console: `foliageCutaway()` (the plan, the line of sight, and on a drawn page the crowns it crosses
  and what is left of them). Test: tools/tests/foliage-cutaway.mjs.
