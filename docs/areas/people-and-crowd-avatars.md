# People: the street avatars

Every NPC with an avatar is drawn as a Microsoft Rocketbox avatar (MIT; docs/THIRD_PARTY_CREDITS.txt) when close enough,
skinned on the rig's skeleton the way the player's own body is (people-and-crowd-player.md); further off the instanced
rig (people-and-crowd-rig.md), painted in their avatar's colours. Files: npc-avatar3d.js (levels, near slots, choosing,
flush, gore, console), npc-avatar3d-mid.js (mid batches), npc-avatar3d-fit.js (decode and fit), npc-avatar3d-shader.js,
npc-avatar-cast.js (casting, the rig's palette), tools/npc_models.py (converter, CAST) and tools/mesh_decimate.py.

## Levels of detail (npcAvatarChoose, once a frame, nothing allocated)

| Level | Mesh | Chase view (from the camera) | Street view (from the player, zoom >= 1.3 x lodBias) | Cap LOW / MEDIUM / HIGH / ULTRA |
| --- | --- | --- | --- | --- |
| near | the avatar decimated to ~4k triangles, a slot each (uniform bones, wound soaks) | within 16 m | within 14 m | 4 / 6 / 8 / 8 |
| mid | the same avatar's ~1k-triangle index over the same vertices, instanced, one batch per avatar | within 45 m | within 30 m | 8 / 16 / 40 / 48 (6 / 10 / 16 / 16 avatars) |
| far | the rig, in the avatar's palette and cut | beyond | beyond, or zoomed out | - |

- Hysteresis: someone at a level last frame ranks and keeps it as if `NPC_KEEP` (0.86) nearer, so the bands are
  16-18.6 m and 45-52 m (chase), 14-16.3 m and 30-35 m (street); a level whose cap is full passes the next people down.
- The near and mid meshes share their vertices and atlas (tools/npc_models.py: quadric half-edge collapses that keep the
  asset's own vertices, UV charts and weights), so face and clothes are the same at both levels; the far rig wears the
  avatar's colours and cut, so nobody changes clothes on the way in.
- Never an avatar: the player (his own body), a disguise, story characters, waiters, riders, athletes, beachgoers drawn
  by the beach, cars' occupants and the drive-by ghost: no avatar (`R.avatar` -1) or drawn elsewhere.
- NO DOWNGRADES (the owner's rule): where no avatar carries what the rig shows, the rig stays: gangs (their colours),
  traffic officers (hi-vis), agents (FED windbreakers), children (the adult skeleton would draw small adults); a
  wounded person at mid distance (the mid mesh has no wound soak); severed pieces and occupants are the rig's as before.
- A person is an avatar only while `crowdState.avatarFrame` is this frame (`avatarLevel` 1 near, 2 mid) and a slot or a
  batch is free (`npcAvatarTake`, `npcMidTake`: at most `NPC_MID_BATCHES` 16 different avatars at mid); otherwise the rig,
  so a full level never hides anyone.

## Mid batches (npc-avatar3d-mid.js)

- `NPC_MID_BATCHES` meshes in the scene from the start (placeholder; the prewarm compiles `npc-avatar-mid` and its depth
  program); each frame a batch takes one avatar's InstancedBufferGeometry and draws its people as instances.
- Bones: `npcBoneTexture` (32 x 48 RGBA float, nearest), one row per mid person grouped by batch (`npcBase` +
  gl_InstanceID): 15 rotation quaternions, 15 duals, then (scale, grips, lost bones); 24 KB uploaded a frame while any
  mid person is drawn. A lost part folds onto its own joint; no wound soak at this distance (decals and pools show).

## Casting (npc-avatar-cast.js; compileLook, once per look)

- By role and sex: `npcAvatarPick(look, p, female, kid, role, ...)` takes compileLook's `female` (lookFemale, the rule
  voices.js shares, so `personFemale()` and the body agree) and picks from the CAST's role tags with the look's hash.
  Uniformed roles get only their uniforms: patrol officers (Police_Male_03, Security_Female_01), SWAT
  (Police_Male_02), soldiers (Military_Male_01), the gate's MPs (Military_Male_02), paramedics (`cityRole.kind` medic:
  Medical_Male_01, Medical_Female_01); mobsters, party guests, joggers, workers, elders, commuters, revellers, tourists
  and beachgoers their own tags, with the general street cast mixed in.
- A street look with an avatar takes its clothes for the rig (`npcAvatarLookTraits`: palette and cut from the
  converter, traits from CAST), so the far figure and the near avatar are the same person. Outfits keep the rig's own
  uniforms far off.
- Casting table (tags in tools/npc_models.py CAST):

| Role | Men | Women |
| --- | --- | --- |
| street | Male_Adult_01, 04, 06, 08, 12, 17 | Female_Adult_01, 02, 03, 04, 11, 15 |
| summer, tourist | Male_Adult_01, 17 | Female_Adult_01, 03 |
| commuter | Male_Adult_08, Business_Male_01 | Female_Adult_02, 15, Business_Female_01, 03 |
| reveller | Male_Adult_04, 06 | Female_Adult_03, 04, 11, Female_Party_02 |
| party guest (the Marea) | Male_Adult_08, Business_Male_01 | Female_Adult_11, Female_Party_02 |
| texter, bouncer | Male_Adult_12, 17; Male_Adult_04 | Female_Adult_04 |
| elder | Male_Adult_14 | Female_Adult_14 |
| worker | Construction_Male_07 | (street cast) |
| jogger | Sports_Male_04 | Sports_Female_02 |
| beach | Sports_Male_01 | Sports_Female_01 |
| kid | (the rig: Male_Child_01, Female_Child_01 are in the file, unused) | |
| gang | (the rig: their colours) | |
| mobster; agent | Business_Male_01; (the rig: FED windbreaker) | |
| police; traffic | Police_Male_03; (the rig: hi-vis) | Security_Female_01; (the rig) |
| SWAT, soldier, MP | Police_Male_02, Military_Male_01, Military_Male_02 | (none: those outfits are men) |
| paramedic | Medical_Male_01 | Medical_Female_01 |

## Fitting and drawing

- Each avatar is fitted once (`npcAvatarFitOne`, one a slice behind the title, ~1.1 s of work in all) onto
  `pbBindSkeleton(width, female)` at its own shoulder width: trunk by height (hips and shoulders onto the rig's, the head
  scaled by the same stretch), limbs rigidly onto the rig's bones, the hands' gripping shape from its finger segments
  (`pbAssetHands`, shared with the player). Geometry is uploaded off-screen (`uploadMeshes`) as it is made.
- drawCrowdPerson poses an avatar person like anyone else at the avatar's width; with `BODY_AVATAR` (every rig body part
  and clothing kit empty) only weapons, props and gore stumps are emitted; `skinBone` hands the 15 joints to the slot.
  `npcAvatarFlush` (finishCrowd3D) turns them into dual quaternions and shows a slot only when all 15 were posed.
- Slots: `NPC_AVATAR_SLOTS` meshes, each with its own material and depth material (one program each between them; the
  uniforms are per material), on a placeholder in the scene from the start so the title prewarm compiles them.
  Hair cards (zone 5) are cut out by the atlas' alpha in both programs; the materials are double-sided.
- Gore (gore.js state, read only): `p.goreLost` folds the lost bones onto their cut (`PB_GORE_CUTS`) where the crowd's
  stump is drawn; the newest four wound spots soak cloth or skin (`npcAvatarGore`). Severed pieces stay the rig's, in
  the avatar's colours.

## Cost (A/B against the build before, software GL, Broadway at 17:00 with characterLineup at the player)

- Per level: near 4k triangles, a camera and a shadow draw each; mid 1k triangles a person, a camera and a shadow draw
  per avatar in view (at most 16), 24 KB of bones a frame; far: the rig as before.
- Whole frame, before -> after: HIGH street 334 -> 312 draws, 1.47M -> 1.50M triangles (8 near, 9 mid); HIGH chase
  1357 -> 1344 draws, 2.66M -> 2.38M triangles (the near rig's 17k a person replaced); LOW street 164 -> 170 draws,
  750k -> 769k triangles (4 near, 12 mid); LOW chase 737 -> 719 draws, 1.74M -> 1.53M triangles. Programs +2
  (near and mid; their depth programs on shadow tiers). CPU: choosing and flushing ~0.05 ms a frame (profiled);
  `crowdBenchmark` noise (0.6-2.6 ms) was the same on both builds.
- Media: npc-models.bin 3.2 MB, npc-skin.webp 0.9 MB (2880x1920 RGBA, ~29 MB on the GPU with mipmaps); geometry
  ~64 bytes a vertex (~6 MB for the cast); fitting ~0.6-0.8 s of work behind the title in slices.

## Console

`npcAvatars(on, level)`: `ready`, `fitted`, `workMs`, this frame's near `cap`, `chosen`, `shown`, `triangles`, `mid`
(`cap`, `chosen`, `shown`, `batches`, `triangles`, `wrongSex`), `drawCalls`, the near slots (avatar, sex against
`personFemale`, width, lost bones, wounds), programs (and at first draw); `on` false/true switches the avatars off and on
(an A/B; the rig's palette stays), `level` 'near' / 'mid' holds everyone in reach at one level, 'auto' releases it.
`crowdStats().avatars` / `.avatarsMid` count them; tools/tests/npc-avatars.mjs.
