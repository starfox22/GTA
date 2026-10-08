# People: the street avatars

The people nearest the camera are drawn as Microsoft Rocketbox avatars (MIT; docs/THIRD_PARTY_CREDITS.txt), skinned on
the rig's skeleton the way the player's own body is (people-and-crowd-player.md). Everyone else stays on the instanced
rig (people-and-crowd-rig.md), painted in their avatar's colours. Files: npc-avatar3d.js (slots, choosing, flush, gore,
console), npc-avatar3d-fit.js (decode and fit), npc-avatar3d-shader.js, npc-avatar-cast.js (casting, the rig's palette),
tools/npc_models.py (the converter and the CAST list).

## Who is an avatar

- Chase view: the NEAR PEOPLE (`chooseNearPeople`) other than the player; street view: the nearest to the player within
  `NPC_STREET_REACH` (22 m, kept to ~25 m) once the zoom is at detail 2 (`NPC_STREET_ZOOM` x the tier's lodBias), in
  view. At most `NPC_TIER_SLOTS` a frame: LOW 4, MEDIUM 6, HIGH and ULTRA 8 (`npcAvatarChoose`, nothing allocated).
- Never: the player (his own body), a disguise, story characters, waiters, riders, athletes, beachgoers drawn by the
  beach, cars' occupants and the drive-by ghost: they have no avatar (`R.avatar` -1) or are drawn elsewhere.
- A person is drawn as an avatar only while `crowdState.avatarFrame` is this frame and a slot is free
  (`npcAvatarTake`); otherwise the rig, so a full set of slots never hides anyone.

## Casting (npc-avatar-cast.js; compileLook, once per look)

- By role and sex: `npcAvatarPick(look, p, female, kid, role, ...)` takes compileLook's `female` (lookFemale, the rule
  voices.js shares, so `personFemale()` and the body agree) and picks from the CAST's role tags with the look's hash.
  Uniformed roles get only their uniforms: police and traffic officers (Police_Male_03, Security_Female_01), SWAT
  (Police_Male_02), soldiers (Military_Male_01), the gate's MPs (Military_Male_02), paramedics (`cityRole.kind` medic:
  Medical_Male_01, Medical_Female_01), agents (Business suits); gangs, mobsters, party guests, joggers, workers, elders,
  commuters, revellers, tourists, kids and beachgoers their own tags, with the general street cast mixed in.
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
| kid | Male_Child_01 | Female_Child_01 |
| gang | Male_Adult_04, 12, 17 | Female_Adult_04 |
| mobster, agent | Business_Male_01 | Business_Female_01 |
| police, traffic | Police_Male_03 | Security_Female_01 |
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

## Cost (dev page, software GL, HIGH, characterLineup in the chase view)

- Per avatar shown: one camera and one shadow draw, 6.7k-14.7k triangles (68.7k for the lineup's eight); the rig
  parts they replace are no longer packed. Media: npc-models.bin 5.7 MB, npc-skin.webp 0.9 MB (2880x1920 RGBA,
  ~29 MB on the GPU with mipmaps); geometry ~64 bytes a vertex (~11 MB for the cast).

## Console

`npcAvatars(on)`: `ready`, `fitted`, `workMs`, this frame's `cap`, `chosen`, `shown`, `triangles`, `drawCalls`, the
slots (avatar, sex, width, lost bones, wounds), `programs` and `programsAtFirstDraw`; `on` false/true switches the
avatars off and on (an A/B; the rig's palette stays). `crowdStats().avatars` counts them.
