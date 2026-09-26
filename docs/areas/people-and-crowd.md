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
  a switch. Reactions chain (`then`: cover → run). Witnesses call the police (`crowdReport`).
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

## Speech bubbles

- `crowdSay` queues a line; `speechBubbles` shows at most two on screen, ranked:
  conversations (`inConversation`), Falcon riders with the player, soldiers, police and
  mission characters, lines aimed at the player, then the nearest.
- SPEECH SEEN FROM ABOVE: every bubble fades from 40 to 50 m of height between view and
  speaker (`speechHeightFade`, `speechViewHeight`); a hidden line takes no slot.
- Settings · Gameplay · NPC chatter off hides street bubbles; mission dialogue (`#storyLine`,
  the Blue Hour) is unaffected.

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
- Venue drawing hooks: `queueAthlete` (sports3d), BEACHGOERS poses (beach3d), RIDERS (seat
  from the vehicle model's `riderSeat`), `poseParachutist` (parachute3d poses a stand-in whose
  angles the rig applies).
- Console: `crowdStats(byPart)`, `crowdBenchmark(frames)` (draw cost of the crowd),
  `scaleReport()` for statures, `closeUp()` for a look.
