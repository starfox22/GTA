# Clear view of the 4x4 trails; forest trunks are solid
- No tree can hide a vehicle on the Mount Ascent or Needle Ridge trail from the street camera any more: the forest
  keeps out of the camera's line to the carriageway (crowns, and tall trees on the camera's side, counted by their
  height and the camera's slant), and thins out just beyond, so the trails run through open woodland. No trunk
  stands within 2 m of a trail's edge or 12 m outside a hairpin (room to run wide). 437 forest trees came out and
  100 more were thinned (of about 13,000 on the range); low grass on the verges stays.
- The mountain forest's trees are solid: a vehicle driven into a trunk crashes against it (damage, sound of wood)
  instead of passing through. They used to be scenery only. The tank still flattens its way through.
- Internals: trail-trees.js `trailTreeClear()` (the one placement rule; the forest scatter and `planTreeProblem`
  'trail view' ask it), forest-trunks.js (per-field cell index from the same scenery lists the renderer plants,
  `forestTrunkContacts()` after `streetPropContacts()`); `terrainFieldScenery(field)` makes the forest per field.
- Console: `trailTreeAudit()`, `forestTrunks(x, y, radius)`. Test: tools/tests/trail-trees.mjs.
