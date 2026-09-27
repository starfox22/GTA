# People and crowd

Behaviour: crowd.js and crowd-*.js (looks, speech, streaming, walking, perception,
reactions, scenes, transit, traffic life), game-people.js (everyday chatter), wounds.js,
riders.js, venue files that staff their own people (beachclub, dealership-people,
sportsbook, monarch-life, themepark-crowd). Drawing: character-rig3d.js and crowd3d-*.js.
Animals: ecology.js / ecology3d.js, sealife (world-and-map.md).

## The split

- **The renderer never decides behaviour.** Everything it needs is on the person: `look`
  (appearance), `pose` (what the body does), `carry`, `dog`, and the movement itself, from
  which crowd3d derives stride and speed.
- Venue people are ordinary pedestrians with an extra record (`club`, `dealer`, stadium
  `match.people`) updated by their venue before the crowd update; they carry the fields
  `strikePerson()` / `bleed()` read (`hp`, `threat`, `killedBy`, `knockedFor`).

## Crowd life (crowd.js)

- Streaming (`streamCrowd`): people exist around the camera so visible streets are always
  busy; density follows the hour (`cityTempo`) and the district. `crowd.settledAt = null`
  asks the streamer to resettle (after a teleport or a ride skip).
- Walking: right-hand side of the sidewalk, corners, signals, doors; `strideCycle(speed)` /
  `strideRate(speed)` keep legs in step with the ground (one stride = 10 units + 0.3 s).
  Pedestrians walk 4-6 km/h, flee at 17-21; officers run 16-19.
- Perception: an incident (shot, blast, crash, body) spreads outward with distance and line
  of sight (`crowdAlarm`, `decideReaction`, `updateReaction`), so a shot sends a ripple, not
  a switch. Reactions chain (`then`: cover → run). Quiet incidents (melee, knock, `crime`,
  `theft`) need the field of view (`witnessFacing`: 100° either side, 46° on a phone) or
  55 units; gunfire and blasts turn heads. A runner 40 m clear of the player stops early.
- Witnesses (crowd-witnesses.js): everyone who perceived something the player did keeps
  `witnessOf` / `witnessSaw`; `witnessDirector` (4 Hz) hands each unreported incident's
  phone to the best placed calm witness (a sighting of a serious crime always calls; heard
  only, about half). The `call` reaction (`callStep`): phone out, the 911 line, a detail,
  then `crowdReport` (police side: docs/areas/police-and-combat.md). The player within 100
  units, a gun on them (`witnessThreatened`: most then stay silent 3 min) or death drops it.
  Someone sheltering in a shop may call from inside (`offstageCalls`). A person reacts to a
  given body once (`bodySeen`); with an armed player standing over it they run.
  Onlookers at a body comfort each other (`comfortStep`).
  `notifyViolence` (harbor.js) fans out to venues (`beachHearsViolence`,
  `dealershipHearsViolence`, `beachClubHearsViolence`).
- Street scenes (`makeScene`): small set pieces staged off screen near the player (carts,
  cafes, buskers, the drawbridge onlookers, the 4x4 club members); anything that frightens
  them breaks the scene.
- Traffic life: crash drivers argue or leave (`crowdCrash`, `updateTrafficLife`); taxis and
  buses pick people up at the kerb (`curbsideStop`, a speed cap the traffic AI obeys).
- Rain: remarks before a shower, umbrellas, sheltering (`rainReaction`).
- Neighbour grid: rebuilt once a frame at 64 units; perception, panic, yielding, car contacts,
  bullet targets and near misses all query `forEachPedestrianNear` instead of scanning.

## Voices (voices.js)

- `personFemale(p)` is the one answer to "man or woman", and the rig uses the same rule:
  street looks via `lookFemale` (compileLook calls it), outfits via `outfitFemale` with the
  per-person `personLookSeed` (specialLook's seed), beachgoers and coaster riders by their
  own `female`, athletes male. Change a look's sex rule there, not in crowd3d-looks.js.
- `playPersonScream(p)` plays their take (a fixed one of two, pitch per person; kids use the
  women's takes higher, elders lower); `scream()` (citylife-civic.js) goes through it.
  Crowd screams pick real people (stadium fans, the beach's shouters, Falcon seats).
- The police recordings are all male: a woman officer's line is said by a male colleague
  within ~40 m (`maleVoiceNear`) or only captioned. `voiceReport()` checks all of it.

## Speech bubbles

- `crowdSay` queues a line; `speechBubbles` shows at most two on screen, ranked:
  conversations (`inConversation`), Falcon riders with the player, soldiers, police and
  mission characters, lines aimed at the player, then the nearest.
- SPEECH SEEN FROM ABOVE: every bubble fades from 40 to 50 m of height between view and
  speaker (`speechHeightFade`, `speechViewHeight`); a hidden line takes no slot.
- Settings · Gameplay · NPC chatter off hides street bubbles; mission dialogue (`#storyLine`,
  the Blue Hour) is unaffected.
- Lines (crowd-chatter.js): every street line goes through `crowdSay` → `pickLine` (never the
  same line twice running per person); idle kinds (`AMBIENT_KINDS`) are spaced 1.6 s apart on
  screen. `chatterKind(p)` picks the idle remark by the hour, rain, district
  (`DISTRICT_TALK`), a recent incident or a chase; `playerRemarks` (one every 6 s at most)
  reacts to a gun or knife on show, a hurt player, a showy or stolen police car, a wreck,
  the stars. 911 lines: `call911Opening` / `call911Detail` (street by `spokenStreet`,
  colour and kind of the player's car, compass direction). Keep lines PG-13, no slurs.

## One character rig for everyone (character-rig3d.js, crowd3d-*.js)

- Everyone on foot (pedestrians, the player, officers, SWAT, agents, soldiers, gangs, guests,
  beachgoers, athletes, riders) is drawn from one InstancedMesh per body part: about 30 draw
  calls for all of them. A part's colours are four packed floats plus a per-region mask per
  instance (`rigPaintPatch`), so outfits cost no draw calls.
- Modelled at real height (`PERSON_HEIGHT` 1.75 m at look height 1, ~7.5 heads); adults
  1.6-1.9 m, the player 1.80 m; nothing scales it again.
- Looks are compiled once (`compileLook`, crowd3d-looks.js); `OUTFITS` / `outfitLook` dress
  special roles; `specialLook` / `specialSpec` (crowd3d-special.js) say what the player,
  officers and mission characters wear and hold, from game state.
- Skeleton: root → hips → torso → head / shoulders → elbows → hands; hips → thighs → knees →
  ankles. Poses are layered: a base pose from `person.pose`, eased per joint; a gait layer
  driven by the distance actually moved (planted feet, two-bone IK, `solveLeg`); weapon holds
  in an aim frame reached by IK (`HOLD_POSES`, `ikArm`) with recoil and reload.
- LOD: close-up body set above zoom 2.4, a street set below, hands and props dropped below
  1.3, a three-instance figure below 0.34 for walkers (the tier's `lodBias` scales these).
- Gait by direction (crowd3d-draw.js BACKPEDAL): the chest faces `facing`, the hips lead
  along the travel line (forwards) or its reverse (`s.backing`, with hysteresis), and the
  stride runs along the travel direction in the hips' frame (`solveLeg` plus a per-leg
  abduction), so backing off steps backwards and strafing side-steps without crossing the
  feet. The phase always advances with distance; never flip its sign (that plays a forward
  run in reverse: the old moonwalk bug).
- The player's facing (footwork.js `playerAimFacing`): the aim in a fight or standing
  still, else the way they run; `footPace()` includes the backpedal (0.6) and side-step
  (0.8) shares, so anything reading the pace agrees with the legs.
- Venue drawing hooks: `queueAthlete` (sports3d), BEACHGOERS poses (beach3d), RIDERS (seat
  from the vehicle model's `riderSeat`), `poseParachutist` (parachute3d poses a stand-in whose
  angles the rig applies).
- Console: `crowdStats(byPart)`, `crowdBenchmark(frames)` (draw cost of the crowd),
  `scaleReport()` for statures, `closeUp()` for a look.
