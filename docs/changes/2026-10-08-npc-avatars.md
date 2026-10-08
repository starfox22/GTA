# Rocketbox avatars for the street's people

- The people nearest the camera are now drawn as real character models from the same library as the player
  (Microsoft Rocketbox, MIT): 32 avatars cast by role and sex: men, women, elders and children on the street,
  commuters in suits, joggers, beachgoers, revellers, gangs, construction workers, police officers (a woman officer
  too), SWAT, soldiers and military police, paramedics. In the chase view they are the near set; in the street view
  the nearest people round the player once zoomed in. Up to 4 (LOW), 6 (MEDIUM) or 8 (HIGH, ULTRA) at a time.
- Further off everyone stays on the light instanced rig, now dressed in their avatar's colours and cut, so a person
  walking up to the camera keeps their clothes.
- Gore works on them as on the rig: a lost limb or head folds onto its stump, wounds soak their clothes.
- Internals: tools/npc_models.py (batch converter; assets/npc-models.bin 5.7 MB, assets/npc-skin.webp 0.9 MB);
  npc-avatar3d.js slots (one draw and one shadow draw each, one program each), fitted behind the title;
  npc-avatar-cast.js casting; `pbAssetHands` shared with the player's model; `pbBindSkeleton(width, female)`.
- Console: `npcAvatars(on)`; `crowdStats().avatars`.
