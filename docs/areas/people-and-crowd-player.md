# People: the player's own body

The player (in his own clothes) is not drawn from the crowd's instanced parts but from one skinned mesh of his
own: player-body3d.js and its pieces (mesher, anatomy, head, extremities, build, shader). Everyone else, and the
player in a disguise (mission 2's suit), stays on the rig (people-and-crowd-rig.md).

## Who he is

A man in his forties, 1.80 m to the scalp (about 7.4 heads), real shoulders (the rig's joints at `PB_WIDTH`
0.92: about 0.5 m across the deltoids), a little softness at the belly; short brown hair with a receding M at
the temples and grey creeping in over the ears, two days' stubble, hazel eyes; a plain black crew-neck tee,
mid-wash straight jeans breaking over dark brown leather derbies. `outfitLook(p, 'player')` (crowd3d-looks.js)
carries the same colours and width (`widthAbsolute`) for the crowd sets (the disguise, the 2D fallback).

## How it is built

- Signed distance fields in bind space (metres): the clothed body as layered groups (tee, collar, neck, arms,
  jeans: `pbBodyField`), the head with the face and the hair as a thickness inside the hairline
  (`pbHeadField`, `pbHairline`, `pbHairDepth`), a right hand and a right shoe (`pbHandField`, `pbShoeField`,
  mirrored for the left), the eyeballs as spheres. Surface nets (`pbMeshSteps`) mesh each at its own spacing
  (`PB_SPACING`: body 13 mm, head 4.1, hands 3.6, shoes 5.5) and project the vertices onto the surface; normals
  come from the field's gradient, occlusion is baked from it (`pbOcclusionSteps`).
- The bind skeleton is the rig's own joints (`pbBindSkeleton`, RIG and the look's width) with the arms out in
  an A pose (`PB_BIND_ARM`) so the armpits mesh open. Weights come from where a vertex is along each limb, then
  are spread over the surface (`pbSmoothWeights`) and cut to two bones; each vertex keeps its part (the bone
  it mostly follows: head, torso, hips, upper/lower arms and legs, hands, feet: `pbSkin.w`) for anything that
  must tell parts apart (wounds, a severed limb).
- The paint never needs UVs: everything is placed in bind space. Per vertex `pbZone` holds the material
  (body, head, eye, hand, shoe) and signed distances (how much nearer the tee's, the skin's or the jeans'
  operations are, so the tee's hem and sleeves are crisp lines; inside the hairline; the nails; the sole).
- About a second of work (2-3 s on the loaded cloud box), so `pbBuildSteps` is a generator run a few ms at a
  time from the renderer's start (9 ms slices behind the title, 4 ms in play); until it is done the player is
  drawn from the near set (`playerBodyOn` false). `playerModel(true)` finishes it at once (tests). The material
  is on the scene from the start on a placeholder triangle with every attribute, so the title prewarm compiles
  the program and its shadow depth program; the finished buffers are uploaded off-screen (`uploadMeshes`).

## Posing it

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
- Cost: one camera and one shadow draw, ~47k vertices / 93k triangles; the near set's player slot is freed.
