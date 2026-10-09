# People: the street avatars

Every NPC with an avatar is drawn as a Microsoft Rocketbox avatar (MIT; docs/THIRD_PARTY_CREDITS.txt) when close enough,
skinned on the rig's skeleton the way the player's own body is (people-and-crowd-player.md); further off the instanced
rig (people-and-crowd-rig.md), painted in their avatar's colours. Files: npc-avatar3d.js (levels, near slots, choosing,
flush, gore, console), npc-avatar3d-mid.js (mid batches), npc-avatar3d-fit.js (decode and fit), npc-avatar3d-shader.js,
npc-avatar-cast.js (casting, tints, the rig's palette), tools/npc_models.py (converter, CAST), tools/npc_paint.py (texture
edits) and tools/mesh_decimate.py. The cast, painted variants and tints: people-and-crowd-avatars-cast.md.

## Levels of detail (npcAvatarChoose, once a frame, nothing allocated)

| Level | Mesh | Chase view (from the camera) | Street view (from the player, zoom >= 1.3 x lodBias) | Cap LOW / MEDIUM / HIGH / ULTRA |
| --- | --- | --- | --- | --- |
| near | the avatar decimated to ~4k triangles, a slot each (uniform bones, wound soaks) | within 16 m | within 14 m | 8 / 10 / 12 / 14, +4 / 6 / 8 / 10 late |
| mid | the same avatar's ~1k-triangle index over the same vertices, instanced, one batch per avatar | within 45 m | within 30 m | 16 / 24 / 40 / 48 (8 / 12 / 20 / 24 avatars) |
| far | the rig, in the avatar's palette and cut | beyond | beyond, or zoomed out | - |

- Hysteresis: someone at a level last frame ranks and keeps it as if `NPC_KEEP` (0.86) nearer, so the bands are
  16-18.6 m and 45-52 m (chase), 14-16.3 m and 30-35 m (street); a level whose cap is full passes the next people down.
- The near and mid meshes share their vertices and atlas (tools/npc_models.py: quadric half-edge collapses that keep the
  asset's own vertices, UV charts and weights), so face and clothes are the same at both levels; the far rig wears the
  avatar's colours and cut, so nobody changes clothes on the way in.
- Uniforms rank as if `NPC_UNIFORM_RANK` (0.6) of their distance (police, soldiers take the near mesh first).
- LATE TAKERS: riders, car occupants (crowd3d-driveby.js SEATED OCCUPANTS), athletes, beachgoers and the drive-by and
  car-entry stand-ins are drawn after the choice: `npcAvatarTake` gives them a near slot within the near reach while
  the tier's `NPC_TIER_LATE` last (from the same origin and reaches), else a mid record within the mid reach.
- THE PLAYER IN A DISGUISE (the borrowed uniform, the suit) has a slot of his own (`npcPlayerSlot`, `playerAvatarOn`)
  at any zoom and view: people-and-crowd-player.md. In his own clothes he is his own body.
- Everyone has an avatar now; the rig stays only beyond the reaches (or zoomed out in the street view), when a level's
  cap or the batches are full, for a wounded person at mid distance (the mid mesh has no wound soak), for severed
  pieces (the rig's parts in the avatar's colours), and for the 2D fallback.
- A person is an avatar only while `crowdState.avatarFrame` is this frame (`avatarLevel` 1 near, 2 mid) and a slot or a
  batch is free (`npcAvatarTake`, `npcMidTake`: at most `NPC_MID_BATCHES` 24 different avatars at mid); otherwise the rig,
  so a full level never hides anyone.

## Mid batches (npc-avatar3d-mid.js)

- `NPC_MID_BATCHES` meshes in the scene from the start (placeholder; the prewarm compiles `npc-avatar-mid` and its depth
  program); each frame a batch takes one avatar's InstancedBufferGeometry and draws its people as instances.
- Bones: `npcBoneTexture` (32 x 48 RGBA float, nearest), one row per mid person grouped by batch (`npcBase` +
  gl_InstanceID): 15 rotation quaternions, 15 duals, (scale, grips, lost bones), then the tint; 24 KB uploaded a frame while any
  mid person is drawn. A lost part folds onto its own joint; no wound soak at this distance (decals and pools show).

## Casting

npcAvatarPick (compileLook, once per look) by role, outfit, city role or name and sex; the full table, the painted
variants (traffic hi-vis, FED, stewards) and the tints (gangs, kits, bikers, the player's suit) are in
people-and-crowd-avatars-cast.md.

## Fitting and drawing

- Children are fitted at an adult's stature (`npcChildGrow`: the crown at NPC_CROWN, a child's head and build kept)
  and drawn at the look's child height, so they come out children, never small adults.
- Each avatar is fitted once (`npcAvatarFitOne`, one a slice behind the title, ~2 s of work for 64) onto
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
- Whole frame, before -> after (final caps; traffic and crowd differ run to run, so +-2 % is noise): HIGH street 334 ->
  333 draws, 1.47M -> 1.50M triangles (8 near, 9 mid); HIGH chase 1357 -> 1391 draws, 2.66M -> 2.46M triangles (the
  near rig's 17k a person replaced by 4k); LOW street 164 -> 165 draws, 750k -> 757k triangles (4 near, 8 mid); LOW
  chase 737 -> 754 draws, 1.74M -> 1.58M triangles. Programs +2 (near and mid; their depth programs on shadow tiers).
  CPU: choosing and flushing ~0.05 ms a frame (profiled); `crowdBenchmark` 2.99 -> 2.70 ms (noise on a shared machine).
- Media: npc-models.bin 3.2 MB, npc-skin.webp 0.9 MB (2880x1920 RGBA, ~29 MB on the GPU with mipmaps); geometry
  ~64 bytes a vertex (~6 MB for the cast); fitting ~0.6-0.8 s of work behind the title in slices.
- Avatars everywhere (October 2026, 64 cast entries; the same lineup, software GL on a shared machine): HIGH street
  333 -> 301 draws, 1.50M -> 1.52M triangles (12 near, 6 mid); HIGH chase 1388 -> 1340 draws, 2.49M -> 2.40M triangles
  (the rig's people 120k -> 50k); LOW chase 716 -> 721 draws, 1.62M -> 1.55M triangles (the rig's 157k -> 39k). No new
  programs (the tint is a uniform and a varying). `crowdBenchmark` 9.7 -> 8.7 ms (noise). Media: npc-models.bin 6.3 MB,
  npc-skin.webp 1.85 MB (3840x2560, ~52 MB on the GPU); fitting ~2 s of work behind the title.

## Console

`npcAvatars(on, level)`: `ready`, `fitted`, `workMs`, this frame's near `cap`, `chosen`, `shown`, `triangles`, `mid`
(`cap`, `chosen`, `shown`, `batches`, `triangles`, `wrongSex`: late takers left out), `late` (cap, near, mid), `player`
(the disguise's avatar, tint, gore), `drawCalls`, the near slots (avatar, sex against
`personFemale`, width, lost bones, wounds), programs (and at first draw); `on` false/true switches the avatars off and on
(an A/B; the rig's palette stays), `level` 'near' / 'mid' holds everyone in reach at one level, 'auto' releases it.
`crowdStats().avatars` / `.avatarsMid` count them; tools/tests/npc-avatars.mjs.
