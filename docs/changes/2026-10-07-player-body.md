# The player's own body
- The player is a new man: in his forties, 1.80 m with real adult proportions (about 7.4 heads, real shoulders,
  a little belly), short brown hair with a receding hairline and grey at the temples, light stubble, age lines,
  hazel eyes; a plain black crew-neck tee, mid-wash jeans breaking over dark brown leather shoes.
- He is one smooth skinned body in both views (no seams at the shoulders, elbows, hips or knees: dual quaternion
  skinning on the rig's own skeleton), his hands close round a gun, the wheel or the bars, and he keeps every
  pose (walking, aiming each weapon, driving, drive-bys, carjacks, swimming, freefall, falls, dying, the phone).
- The crowd sets and the 2D fallback use his new colours and build; mission 2's suit still uses the rig.
- Internals: player-body3d*.js (signed distance fields meshed by surface nets in slices behind the title, baked
  occlusion, two bones per vertex with a part id, one draw and one shadow draw); drawCrowdPerson hands the
  player's joints to it (BODY_PLAYER); he no longer takes a place in the chase view's near set.
- Console `playerModel(finish)`, `crowdStats().playerBody`. Test: player-body.
