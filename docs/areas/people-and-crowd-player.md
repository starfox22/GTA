# People: the player's own body

The player (in his own clothes) is not drawn from the crowd's instanced parts but from one skinned mesh of his
own: player-body3d.js and its pieces (mesher, anatomy, head, extremities, build, shader, grips). Everyone else is an
avatar near the camera (people-and-crowd-avatars.md) and the rig further off (people-and-crowd-rig.md).

## In a disguise (an avatar)

In mission 4's borrowed uniform (`player.uniform`, outfit 'playerArmy') he is Military_Male_05, the avatar the gate's
MPs wear; in mission 2's suit ('playerDisguise') Business_Male_02 with its jacket tinted cream
(people-and-crowd-avatars-cast.md). `playerAvatarOn(look)` (npc-avatar3d.js) says so; drawCrowdPerson then skins him
into `npcPlayerSlot`, a near slot of his own at any zoom and in both views (`spec.rim`), so nothing else takes it;
taking the uniform off (wearUniform(false), a reset) brings his own body back the next frame. The contracts hold: all
15 bones posed or the slot is hidden (npcAvatarFlush), parts by `npcSkin.w` (the same bone codes as `pbSkin.w`) for
gore folds and wound soaks from `player.goreLost` / `goreWounds`, his weapons in PB_GRIPS (`pbHands` in
drawCrowdPerson: the avatar's hands are fitted by `pbAssetHands` to the same fist), and the same seats (the avatar's
crown stands at the player's). He takes no place in the chase view's near set then either.

## Who he is

A muscular man in his thirties, 1.81 m to the crown, after the owner's reference: short dark-brown hair, a trimmed
dark beard, a black tee with a white skull on the chest, dark indigo jeans, brown shoes, lightly tanned skin. He is
the Microsoft Rocketbox avatar Male_Adult_16 (MIT, docs/THIRD_PARTY_CREDITS.txt), restyled. The rig's joints are at
`PB_WIDTH` 1.04 (the model's shoulders); `outfitLook(p, 'player')` (crowd3d-looks.js) carries the same width
(`widthAbsolute`) and the clothes' colours for the crowd sets (the disguise, the 2D fallback).

## The model (player-body3d-asset.js; preferred whenever the build carries it)

- tools/player_model.py (offline, numpy + PIL; its own binary FBX reader) converts the avatar: the mesh in its rest
  pose (metres, x forward, y up, z right; 7,064 triangles), UVs into a two-page atlas (body left, head right), each
  vertex's two strongest of the 15 bones (Biped bones mapped by name: spine and clavicles to the torso, neck and face
  to the head, fingers to the hand), the hands' sub-bones (palm, three segments per finger and thumb) and the
  asset's joint frames. Textures: `player-skin.webp` (colour) and `player-detail.webp` (normal x/y, specular),
  1024 px pages. The restyle is painted in 3D: every texel's place on the body is baked from the mesh (`bake`), so the
  skull is projected on the chest, the beard follows the jaw by its angle round the head, hair is told from skin by a
  colour model fitted on the crown against the cheeks. Re-run it with the Rocketbox folder (see its docstring).
- At load `pbAssetBuildSteps` fits it to `pbBindSkeleton` (the rig stays the one source of joints): the trunk by
  one field of height (hip joint and shoulders onto the rig's, the head scaled `PB_ASSET_HEAD` round the neck so the
  crown is at `PB_ASSET_CROWN`, the chest broadened and the waist taken in: `PB_ASSET_CHEST`/`PB_ASSET_WAIST`),
  each limb rigidly onto its rig bone (frame: up the limb, the knuckle line forward) scaled along it to the rig's
  length and round it by `PB_ASSET_ARMS`; the shoe keeps its height (the shin ends `lift` above the rig's ankle).
- Hands: relaxed, gripping and trigger shapes come from the model's own finger segments turned to the field
  hand's curls (`PB_CURL`, `PB_THUMB`), blended by its finger weights; the fist lands near `PB_FIST`, so
  `PB_GRIPS` holds unchanged.
- `pbZone` is (material, skin share, 0, 0) with the field codes (0 clothes, 1 head, 2 eye, 3 hand, 4 shoe), so the
  tests and gore read it alike; `pbTextured` (on once the mesh and both images are in) switches the shader to the
  atlases. A model that fails to decode logs an error and the fields are built instead (`pbBodySteps`).

## The field body (fallback)

- Signed distance fields in bind space (metres): the clothed body (`pbBodyField`), the head with hair as a
  thickness (`pbHeadField`), a right hand and shoe mirrored, eyeballs. Surface nets (`pbMeshSteps`) mesh each at
  `PB_SPACINGS` (fine on HIGH/ULTRA ~56k vertices, coarse about half); weights from where a vertex is along each
  limb, spread over the surface (`pbSmoothWeights`), cut to two bones. Its paint (tee, denim, leather, face) needs no
  UVs. About a second of work: `pbBuildSteps` runs as a generator in slices.
- Both builds run behind the title (12 ms slices, 4 ms in play); `playerBodyStart` finishes one at once on the
  first frame of play (`finishedAtStart`); a tier change across LOW/MEDIUM and HIGH/ULTRA rebuilds behind the old
  mesh. The material is on the scene from the start on a placeholder with every attribute (the prewarm compiles
  both programs); finished buffers are uploaded off-screen (`uploadMeshes`), the textures by `initTexture`.

## Posing it

- Weapons (player-body3d-grips.js `PB_GRIPS`, `pbGripsFor`): the hand closes round a cylinder along its knuckle
  line (`PB_FIST`), so a grip is that cylinder's axis and a point on it in weapon space. The firing hand wraps the
  grip with the trigger finger laid along the guard (a second gripping shape, `pbTrig`, by `pbTrigger`); the
  other hand cups the firing hand on a pistol, holds the handguard from below on long guns, or a front grip.
  drawHold and the drive-by take these frames for the player (the IK reaches their wrists); a gun carried at
  the side sits in his fist (`inverse`). A new weapon adds its grip there.
- Eyes (`pbEyes`, shader `pbEye`; the field body only, the model's eyes are painted): they lead the head to where he aims (the chase camera's pitch in the chase
  view), else glance about in quick jumps; a blink every 2-6 s draws the upper lid down over the eyeball.

- Gore (gore.js; police-and-combat-gore.md): `pbLost` (a bit per bone) folds a lost part's vertices (their part
  `pbSkin.w`) onto its cut (`pbCut`: the bind origin of the lost chain's first bone), where the crowd's stump is
  drawn; `pbWound[4]` (bind metres, w = 2 + radius) soaks his tee, jeans or skin round a wound (and its exit).
  `playerBodyGore` sets them when `player.goreVersion` changes or a stain is still spreading. He loses parts only
  on death; WASTED's respawn restores him.
- drawCrowdPerson (crowd3d-draw.js) poses the player like anyone else; for him (`spec.rim` and `playerBodyOn`)
  the body set is `BODY_PLAYER` (the close set with its body parts empty), and the joint matrices go to
  `playerBodyBone(i, m)` (`PB_BONE_NAMES` order) and the hands' closing to `playerBodyGrip` (`playerHandGrip`:
  a weapon, fists, bars or a wheel, something carried). Weapons and props stay the crowd's parts.
- `playerBodyFlush` (finishCrowd3D) turns the bones into dual quaternions (rotation from bind to now, the
  translation that puts the bind joint on the posed one) and shows the mesh only on a frame that posed every
  bone. The shader blends two bones per vertex as dual quaternions (no candy-wrapping, elbows and knees keep
  their volume) and the hands from their relaxed to their gripping shape (`pbGripShape`, same vertices).
- He takes no place in the chase view's near set (`chooseNearPeople`), no still-figure recording and no far
  figure: he is always this mesh, in the street view too.

## Paint (player-body3d-shader.js)

The model: colour from the atlas (sRGB), its normal map in a frame from screen derivatives (no tangents), specular
from the detail page; skin (head and hands, hair left out by its darkness) takes the red wrap, cloth the sheen, hair a
soft strand highlight. The field body: skin with a subsurface wrap, face, stubble, tee knit, denim, leather, all from
bind-space position, fine detail fading below a pixel (`pbPx`). Wounds soak either the same way (`pbWound`).

## Checks and console

- tools/tests/player-body.mjs builds both bodies in node (the model and the fields): proportions (stature, heads tall, shoulders, chest, reach),
  bones and parts, a closed outward mesh, and a pose set (walk, run, aim, rifle, hands up, phone, seated,
  kneel, crawl, freefall, swim, lying, carjack, twists, wrists) through the shader's skinning: no tearing
  stretch, no collapse, no folding a twist adds, no gap at the neck, wrists or ankles (the fields) or between the
  model's welded vertices (split by UVs only). On a rendered page it
  checks the player is drawn from it in both views.
- Console `playerModel(finish)`: ready, build and work ms, `model` (the asset's name or 'fields'), `textured`,
  vertices, triangles, vertices by part, whether it drew this frame; `crowdStats().playerBody`.
- Cost: one camera and one shadow draw; the model 4.2k vertices / 7k triangles on every tier plus two 2048x1024
  textures (the fields: HIGH/ULTRA ~56k vertices / 112k triangles, LOW/MEDIUM about half); the near set's player
  slot is freed. `playerModel().programsAtFirstDraw` says whether the prewarm had compiled both
  programs before he was first drawn.
