# People and crowd

Behaviour: crowd.js and crowd-*.js (looks, speech, streaming, walking, perception,
reactions, scenes, transit, traffic life), game-people.js (everyday chatter), wounds.js,
riders.js, venue files that staff their own people (beachclub, dealership-people,
sportsbook, monarch-life, themepark-crowd). Drawing: character-rig3d.js and crowd3d-*.js
(people-and-crowd-rig.md).
Animals: ecology.js / ecology3d.js, sealife (world-county-and-sea.md).

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
  asks the streamer to resettle (after a teleport or a ride skip). In the chase view it counts
  and spawns round a centre leaned up the camera's heading, and a spot is out of sight off the
  chase camera's frustum or behind a building (`spotUnseen`; people-and-crowd-living-city.md).
- Walking: right-hand side of the sidewalk, corners, signals, doors; `strideCycle(speed)` /
  `strideRate(speed)` keep legs in step with the ground (one stride = 10 units + 0.3 s).
  Pedestrians walk 4-6 km/h, flee at 17-21; officers run 16-19.
- Perception: an incident (shot, blast, crash, body) spreads outward with distance and line
  of sight (`crowdAlarm`, `decideReaction`, `updateReaction`), so a shot sends a ripple, not
  a switch. Reactions chain (`then`: cover → run). Quiet incidents (melee, knock, `crime`,
  `theft`) need the field of view (`witnessFacing`: 100° either side, 46° on a phone) or
  55 units; gunfire and blasts turn heads. A runner 40 m clear of the player stops early.
  **Gotcha**: a pending perception (`p.pending`) is resolved by `crowdPerceive` in
  updatePeople *before* the special routines (island walkers, strollers, park guests), which
  only step aside once `p.react` or `p.flee` is set; without it they never react or call.
- Witnesses and 911 calls (crowd-witnesses.js): docs/areas/police-and-combat-witnesses.md.
- A person reacts to a given body once (`bodySeen`); with an armed player standing over it
  they run.
  Onlookers at a body comfort each other (`comfortStep`).
  `notifyViolence` (harbor.js) fans out to venues (`beachHearsViolence`,
  `dealershipHearsViolence`, `beachClubHearsViolence`).
- Street scenes (`makeScene`): small set pieces staged off screen near the player (carts,
  cafes, buskers, the drawbridge onlookers, the 4x4 club members); anything that frightens
  them breaks the scene.
- Traffic life: crash drivers argue or leave (`crowdCrash`, `updateTrafficLife`); taxis and
  buses pick people up at the kerb (`curbsideStop`, a speed cap the traffic AI obeys). The
  traffic round the player, sirens, ambulances and street events:
  people-and-crowd-living-city.md.
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
  conversations (`inConversation`), Falcon riders with the player, soldiers, police,
  mission characters and 911 callers (`speechKind` 'call911'), lines aimed at the player,
  then the nearest. The renderer culls bubbles outside x 40..W-40, y 90..H-190 (the HUD
  strip), which at the street zoom is only ~50-100 units north/south of the player; a 911
  bubble is instead held inside the frame (red edge, tail toward the caller).
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

## The character rig

How everyone on foot is drawn (one instanced rig, looks, skeleton and gait, the body sets and
the chase view's near set): people-and-crowd-rig.md.
