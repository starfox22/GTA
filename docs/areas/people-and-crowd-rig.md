# People: the character rig

Drawing everyone on foot: character-rig3d.js (parts, paint shader; kit and weapons in
character-rig3d-kit.js / -weapons.js), character-near3d*.js (the near set), crowd3d.js and
crowd3d-*.js (packing, poses, looks). Behaviour is in people-and-crowd.md.

## One rig for everyone

(The player in his own clothes is drawn from a body of his own, posed by this same skeleton:
people-and-crowd-player.md; the few people nearest the camera are drawn as skinned avatars on it, the rig painting
everyone else in their avatar's colours: people-and-crowd-avatars.md.)

- Everyone on foot (pedestrians, the player, officers, SWAT, agents, soldiers, gangs, guests,
  beachgoers, athletes, riders) is drawn from one InstancedMesh per body part. A part's colours
  are four packed floats plus a per-region mask per instance (`rigPaintPatch`), so outfits cost
  no draw calls. Slot D of every body part's paint is the skin (the near shader relies on it;
  gloves are `rigPaint(gloves, gloves, gloves, skin)`).
- Modelled at real height (`PERSON_HEIGHT` 1.75 m at look height 1, ~7.5 heads); adults
  1.6-1.9 m, the player 1.80 m; nothing scales it again.
- Outlines are key rings (`RIG_HEAD_RINGS`, `rigTorsoKeys`, `rigPelvisRings`,
  `RIG_UPPER_ARM_RINGS`, `RIG_FOREARM_RINGS`, `rigThighRings`, `RIG_SHIN_RINGS`,
  `rigHairRingLists`): every set is lofted from the same keys, so a person changing set keeps
  their silhouette. `rigLoft` (and `nearLoft`) wind a loft outwards whichever way its rings run:
  limbs hang down from their joint, and lofts stacked downwards used to be inside out (lit from
  the wrong side, shaded by their own near wall). tools/tests/rig-geometry.mjs holds every
  closed part to a positive volume.
- Looks are compiled once (`compileLook`, crowd3d-looks.js) from the look's seed: nobody changes
  outfit, and every set paints the same look. `outfitLook` dresses special roles;
  `specialLook` / `specialSpec` (crowd3d-special.js) say what the player, officers and mission
  characters wear and hold, from game state.
- Skeleton: root → hips → torso → head / shoulders → elbows → hands; hips → thighs → knees →
  ankles. Poses are layered: a base pose from `person.pose`, eased per joint; a gait layer
  driven by the distance actually moved (planted feet, two-bone IK, `solveLeg`); weapon holds
  in an aim frame reached by IK (`HOLD_POSES`, `ikArm`) with recoil and reload.
- Gait by direction (crowd3d-draw.js BACKPEDAL): the chest faces `facing`, the hips lead along
  the travel line or its reverse (`s.backing`, with hysteresis), and the stride runs along the
  travel direction in the hips' frame, so backing off steps backwards and strafing side-steps.
  The phase always advances with distance; never flip its sign (the old moonwalk bug).
- The player's facing (footwork.js `playerAimFacing`): the aim in a fight or standing still,
  else the way they run; `footPace()` includes the backpedal (0.6) and side-step (0.8) shares.
- Venue drawing hooks: `queueAthlete` (sports3d), BEACHGOERS poses (beach3d), RIDERS (seat from
  the vehicle model's `riderSeat`), `poseParachutist` (parachute3d poses a stand-in).

## Gore on the rig (crowd3d-gore.js; police-and-combat-gore.md)

- A part in `p.goreLost` is left out and `P.stump` (one part on the body material: torn sleeve in the lost part's
  colour, slot D skin edge, flesh, bone) is packed at its joint; a severed piece is the owner's own parts at the
  piece's pose. Still figures re-record when `p.goreVersion` changes.
- Every rigPart carries `crowdWound` (vec4: the entry in the part's space, w = 2 + reach, +100 for an exit; under
  1.5 none) written by rigEmit from `rigWoundNow` (set by `goreWoundFor` before a body part, cleared after); the
  paint shader soaks the cloth or skin there (PAINT SHADER WOUNDS). Uploaded only while a part has a wounded
  instance (and the frame after).

## Body sets and level of detail

- Street view: the close set above zoom 2.4, the street set (half the facets, every other ring)
  below, hands and props dropped below 1.3, a three-instance figure below 0.34 for walkers (the
  tier's `lodBias` scales these).
- Chase view (crowd3d-frame.js `crowdChaseDetail`): each person by their own distance
  (rendering-chase.md), and the NEAR SET for the player and the few people nearest the camera.

## The near set (character-near3d*.js, chase view)

- Who: the player always (on foot, the car-entry ghost, seated at the wheel through
  `driveByGhost`, a drive-by at the window) and others nearest the camera, at most
  `CROWD_NEAR_CAP` (8) in all, from about 12 m (`CROWD_NEAR_ZOOM` 5.2 on the street frame) and
  kept to about 14 m once chosen (`CROWD_NEAR_KEEP`), in view only (`chooseNearPeople`, once a
  frame, no allocation). Riders, beachgoers and other cars' occupants stay on the close or street
  set by distance.
- Ten parts (`BODY_NEAR`, crowd3d-bodies.js), one draw each, plus six shadow draws (head,
  torso, pelvis, upper arms, thighs, shins): the close keys sampled by a monotone cubic
  (`nearCurve`) with about three times the rings and facets, then sculpted (`nearSculpt`):
  face (sockets, brow, nose, cheekbones, lips, chin, jaw) and ears, a sloped trapezius,
  chest or bust, shoulder blades, glutes, kneecaps, calves, ankle bones; hands with a thumb and
  four curled fingers; shoes and boots on a sole with a heel and toe spring; a bare foot with
  toes. Hats, kit (vest, belt, radio, labels, backpack), collars, hoods and skirts are the
  close set's parts, which fit the same outlines.
- One mesh holds alternatives: `rigAltPos` / `rigAltNormal` are a woman's shape (head, torso,
  pelvis, thighs; paint bit 32), `rigVariant` the hair style (`NEAR_HAIR`), footwear
  (`NEAR_FOOT`: shoe, boot, bare) or hand side, from the paint's bits 64+ (`rigNearBits`,
  compileLook); the other variants' vertices fold to the joint. The hand's side comes from its
  instance order (drawCrowdPerson packs left then right): keep the hands emitted in pairs.
  The shadow uses `rigNearDepthMaterial` (the same shape and variant).
- Near paint (character-near3d-shader.js, one program `crowd-paint-near`): the face is painted in
  head space where the sculpt put it (`NEAR_FACE`): eyes (sclera, iris from an 8-colour palette,
  pupil, upper lid line, lower lid, crease), brows (slot B), lips (slot D) with the mouth line,
  nostrils, warm cheeks, nose and ears, stubble or a beard in the jaw colour, make-up (liner,
  shadow, blush, lipstick from the seed: none, day, evening). Hair has strand streaks and a
  two-lobe highlight along the strands. Cloth gets a relief turned into the normal by screen
  derivatives (no tangents or textures): folds at the waist, armpits, elbows, knees and the
  ankle break, seams, plackets and buttons, uniform and hoodie pockets, lapels, jeans' pockets,
  fly, yoke, belt loops and tan stitching, a suit's crease and buttons, laces and welts; skin
  (any region painted slot D) wraps the light further in red than blue and is smoother.
  Everything fades below a pixel (`rigPx`).
- Codes (`rigNearBits`): face = iris + 8 x beard + 32 x make-up; torso and sleeves 0 knit,
  1 shirt, 2 suit, 3 jacket, 4 uniform, 5 hoodie, 6 sleeveless, 7 bare; legs 0 trousers, 1 jeans,
  2 suit, 3 uniform, 4 shorts, 5 under a skirt, 6 swimwear, 7 joggers; feet 0 shoe, 1 sneaker,
  2 boot. The other sets' shader ignores bits from 32 (the rim is bit 16).
- Cost (seeded A/B, chase view on Broadway at 17:00, HIGH, the player near): +8 camera and +6
  shadow draws (at most +10 and +6 however many are near: one draw per near part), crowd triangles
  122k to 148k (a near person draws about 17k; `crowdStats` counts every variant a mesh holds),
  scene triangles +1.7%, packing CPU unchanged; the street view identical. The near parts are in
  the scene from the start, so the title prewarm compiles their program, and the depth program
  with the shadow samples (render3d-prewarm-models.js finds the custom depth material).

## Console

`crowdStats(byPart)` (parts, camera and shadow calls, instances, triangles, `bodySet`, `near`:
people drawn from the near set; a near part's triangles count every variant it holds),
`crowdBenchmark(frames)`, `scaleReport()` for statures, `closeUp()` to look at a person past the
play zoom. `crowdStats` describes the last pack: after a view change on a slow page, call
`crowdBenchmark(1)` first (it packs at once). For close-ups, `characterLineup('stand', 12)` with
the player unarmed (`arm(7)`): an armed player sends the row running, backs to the camera.
