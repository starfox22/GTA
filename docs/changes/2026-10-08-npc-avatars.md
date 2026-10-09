# Rocketbox avatars for the street's people

- The street's people are now real character models from the same library as the player (Microsoft Rocketbox, MIT):
  32 avatars cast by role and sex: men, women and elders, commuters in suits, joggers, beachgoers,
  revellers, construction workers, police officers (a woman officer too), SWAT, soldiers and military police,
  paramedics.
- Three levels of detail: close by the full avatar (about 4,000 triangles; chase view 16 m, street view 14 m), further
  out a 1,000-triangle version of the same avatar (to 45 m / 30 m), beyond that the light instanced rig dressed in the
  avatar's colours. Each level is kept a little past its edge, so nobody pops back and forth. Up to 4 / 6 / 8 / 8 near
  and 8 / 16 / 40 / 48 mid people on LOW / MEDIUM / HIGH / ULTRA. Gangs, traffic officers, agents and children keep
  their current look (no avatar carries their colours, hi-vis, windbreakers or proportions).
- Gore works on them: a lost limb or head folds onto its stump; close up, wounds soak their clothes.
- Internals: tools/npc_models.py (batch converter) and tools/mesh_decimate.py (quadric decimation keeping the asset's
  vertices, UVs and weights); assets/npc-models.bin 3.2 MB, assets/npc-skin.webp 0.9 MB; npc-avatar3d.js near slots
  (a draw and a shadow draw each), npc-avatar3d-mid.js instanced mid batches (bones in a float texture, one draw per
  avatar in view); fitted behind the title; npc-avatar-cast.js casting; `pbAssetHands` shared with the player's
  model; `pbBindSkeleton(width, female)`.
- Console: `npcAvatars(on, level)`; `crowdStats().avatars`, `.avatarsMid`; tools/tests/npc-avatars.mjs.
