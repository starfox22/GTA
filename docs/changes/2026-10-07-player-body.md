# The player's own body
- The player is a new man: handsome and athletic for his forties, 1.80 m with real proportions (broad shoulders,
  a defined chest and arms filling the tee's sleeves, a flat stomach), a strong jaw and chin, cheekbones, a
  straight nose, neat short brown hair with a little grey at the temples, light stubble and a few fine lines,
  hazel eyes; a plain black crew-neck tee, mid-wash jeans breaking over dark brown leather shoes.
- He is one smooth skinned body in both views (no seams at the shoulders, elbows, hips or knees: dual quaternion
  skinning on the rig's own skeleton) and keeps every pose (walking, aiming, driving, drive-bys, carjacks,
  swimming, freefall, falls, dying, the phone); raised arms no longer leave the shoulders behind.
- His hands hold weapons properly: round the grip with the trigger finger along the guard, the other hand cupped
  under a pistol or holding the handguard of an SMG, shotgun or rifle; they close on the wheel and the bars.
- His eyes follow where he aims and glance about, and he blinks.
- The face is meshed finer on HIGH and ULTRA (crisper mouth, nose and eyes); LOW and MEDIUM build a lighter body.
  He is ready before play shows him (never the crowd's figure first).
- The crowd sets and the 2D fallback use his new colours and build; mission 2's suit still uses the rig.
- Internals: player-body3d*.js (signed distance fields meshed by surface nets in slices behind the title, baked
  occlusion, two bones per vertex with a part id, one draw and one shadow draw; grips in player-body3d-grips.js);
  drawCrowdPerson hands the player's joints to it (BODY_PLAYER); he no longer takes a place in the near set.
- Console `playerModel(finish)` (detail, grip, blink, gaze, programs at first draw), `crowdStats().playerBody`.
  Test: player-body.
