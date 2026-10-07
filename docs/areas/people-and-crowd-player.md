# People: the player's own body

The player (in his own clothes) is not drawn from the crowd's instanced parts but from one skinned mesh of his
own: player-body3d.js and its pieces (mesher, anatomy, head, extremities, build, shader, grips). Everyone else, and the
player in a disguise (mission 2's suit), stays on the rig (people-and-crowd-rig.md).

## Who he is

A handsome, athletic man in his forties, 1.80 m to the scalp (about 7.6 heads), the rig's joints at `PB_WIDTH`
0.92: about 0.53 m across the deltoids, a defined chest and arms filling the sleeves, a flat stomach and a V to
the waist; a strong jaw and chin, cheekbones, a straight nose, neat short brown hair with a slightly receded M
and a little grey over the ears, light stubble, a few fine lines, hazel eyes; a plain black crew-neck tee,
mid-wash straight jeans breaking over dark brown leather derbies. `outfitLook(p, 'player')` (crowd3d-looks.js)
carries the same colours and width (`widthAbsolute`) for the crowd sets (the disguise, the 2D fallback).

## How it is built

- Signed distance fields in bind space (metres): the clothed body as layered groups (tee, collar, neck, arms,
  jeans: `pbBodyField`), the head with the face and the hair as a thickness inside the hairline
  (`pbHeadField`, `pbHairline`, `pbHairDepth`), a right hand and a right shoe (`pbHandField`, `pbShoeField`,
  mirrored for the left), the eyeballs as spheres. Surface nets (`pbMeshSteps`) mesh each at its own spacing
  (`PB_SPACINGS`: fine on HIGH/ULTRA, body 13 mm, head 3.2, hands 3.4, shoes 5.5, ~56k vertices; coarse on
  LOW/MEDIUM, 17.5 / 5.2 / 4.8 / 7.5 mm, about half) and project the vertices onto the surface; normals
  come from the field's gradient, occlusion is baked from it (`pbOcclusionSteps`).
- The bind skeleton is the rig's own joints (`pbBindSkeleton`, RIG and the look's width) with the arms out in
  an A pose (`PB_BIND_ARM` 0.7 rad: between hanging and raised, so neither stretches the armpit far). The
  shoulder's cap follows the arm most of the way (the rig has no collarbone). Weights come from where a vertex is
  along each limb, then
  are spread over the surface (`pbSmoothWeights`) and cut to two bones; each vertex keeps its part (the bone
  it mostly follows: head, torso, hips, upper/lower arms and legs, hands, feet: `pbSkin.w`) for anything that
  must tell parts apart (wounds, a severed limb).
- The paint never needs UVs: everything is placed in bind space. Per vertex `pbZone` holds the material
  (body, head, eye, hand, shoe) and signed distances (how much nearer the tee's, the skin's or the jeans'
  operations are, so the tee's hem and sleeves are crisp lines; inside the hairline; the nails; the sole).
- About a second of work (2-3 s on the loaded cloud box), so `pbBuildSteps` is a generator run a few ms at a
  time from the renderer's start (12 ms slices behind the title, 4 ms in play). If play starts first,
  `playerBodyStart` (updateCrowd3D) finishes it at once on the first frame of play (`finishedAtStart`), so the
  player is never seen in the crowd's body. A tier change across LOW/MEDIUM and HIGH/ULTRA rebuilds in slices
  behind the old mesh. `playerModel(true)` finishes a build at once (tests). The material
  is on the scene from the start on a placeholder triangle with every attribute, so the title prewarm compiles
  the program and its shadow depth program; the finished buffers are uploaded off-screen (`uploadMeshes`).

## Posing it

- Weapons (player-body3d-grips.js `PB_GRIPS`, `pbGripsFor`): the hand closes round a cylinder along its knuckle
  line (`PB_FIST`), so a grip is that cylinder's axis and a point on it in weapon space. The firing hand wraps the
  grip with the trigger finger laid along the guard (a second gripping shape, `pbTrig`, by `pbTrigger`); the
  other hand cups the firing hand on a pistol, holds the handguard from below on long guns, or a front grip.
  drawHold and the drive-by take these frames for the player (the IK reaches their wrists); a gun carried at
  the side sits in his fist (`inverse`). A new weapon adds its grip there.
- Eyes (`pbEyes`, shader `pbEye`): they lead the head to where he aims (the chase camera's pitch in the chase
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

Skin wraps the light further in red (subsurface hint); cloth and hair reflect little (`pbSpec`, `pbSpecF90`)
and cloth adds a Charlie sheen (black jersey reads as fabric); hair has two highlights along its strands. Face:
warm cheeks, nose and ears, lash lines, brows, lips, stubble that greys the skin (dots up close, down the
throat on the neck), forehead lines, crow's feet. Tee: knit, bunching above the hem, armpit folds, hem bands,
the collar's rib. Jeans: twill, fades on the thighs and knees, whiskers, creases behind the knee, out- and
inseams with tan stitching, back pockets, the hem stacked over the shoe. Shoes: grain, rubber sole, socks.
Fine detail fades below a pixel (`pbPx`).

## Checks and console

- tools/tests/player-body.mjs builds it in node: proportions (stature, heads tall, shoulders, chest, reach),
  bones and parts, a closed outward mesh, and a pose set (walk, run, aim, rifle, hands up, phone, seated,
  kneel, crawl, freefall, swim, lying, carjack, twists, wrists) through the shader's skinning: no tearing
  stretch, no collapse, no folding in a twist, no gap at the neck, wrists or ankles. On a rendered page it
  checks the player is drawn from it in both views.
- Console `playerModel(finish)`: ready, build and work ms, vertices, triangles, vertices by part, whether it
  drew this frame; `crowdStats().playerBody`.
- Cost: one camera and one shadow draw; HIGH/ULTRA ~56k vertices / 112k triangles, LOW/MEDIUM about half; the
  near set's player slot is freed. `playerModel().programsAtFirstDraw` says whether the prewarm had compiled both
  programs before he was first drawn.
