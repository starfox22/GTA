# Witnesses and 911 calls

witnesses.js (the police side), crowd-witnesses.js (who calls and the call), the `call`
reaction in crowd-reactions.js, bubbles in crowd-speech.js / render3d-frame.js. Console:
`witnesses()` (per incident `who`: distance, saw, reaction, `block` reason; per call the
`line` in the bubble and `phone`), `witnessStage` (docs/console/police.md). Tests:
tools/tests/police-witness.mjs, witnesses-monarch.mjs.

## Reaching the police (witnesses.js)

- With no stars up a crime only counts if the police know: a unit sees it
  (`policeEyesOnPlayer`: officers on foot, crewed cruisers on patrol or on a job, the
  helicopter, through `policeSees`) or hears it (gunfire / blasts within `POLICE_EARSHOT`
  480 units of a unit). Otherwise it is banked in `unreportedCrimes` (where, when, heat,
  victims; merged within 20 s / 420 units; kept `UNREPORTED_KEEP` 240 s). Officer and police
  vehicle kills are always known (the radio).
- A civilian who perceived it (below) phones 911: the call starts ~2-5 s after the shots and
  lasts 5-8 s. Its end (`crowdReport` → `reportIncidentToPolice`) sends the matching
  unreported heat (by time and place, or victim for a body) through
  `crime(amount, { x, y, … })` → `reportedCrime`: first star, "A WITNESS CALLED 911" toast
  and caption, the search on the reported spot (on the player if the caller sees them), the
  first unit after `policeResponseSeconds` (0.8-2.2 s everywhere) and a second right behind
  (`dispatchBurst` 1); the nearest cruising patrol is taken first. While `policeResponding()`
  units spawn at the nearest off-screen junctions (county: nearest nodes) round the search
  centre (`pursuitCentre`) and chase only on sight. Until one reaches the spot the search
  clock and escalation hold (`policeResponseHolding`).
- **Gotcha**: search points snap to the city grid (`roadNear`/`rowNear`) only inside
  `inCityGrid`; off it (county, Monarch Isle) the point is used as is and `copRoute` finds
  the road graph (snapping used to send Monarch searches to the city's corner).
- **Gotcha** (Monarch Isle responders): units spawn on either carriageway of the divided
  boulevards, so half drive against the one-way traffic, and most reach Crown Avenue through
  Crown Circus. A unit used to stall there for seconds: it aimed straight across the circus
  at the reported spot (a 70-80° turn at speed) into the fountain, took the ring too fast,
  caught the fountain collider's square corners (it is now boxes inside the round island),
  shoved an oncoming island car backwards at walking pace, or backed out nose away from the
  target. See the steering aids in police-and-combat.md; test tools/tests/police-circus.mjs
  (staged units, `respondingUnit`, `reportCall`).
- A body found more than 30 s after the killing with the player 630+ units away: the police
  investigate (caption, toast) but nobody is wanted.
- A unit that comes on the player within 15 s / 320 units of an unreported crime counts it
  as seen. `clearPolice` (`resetHeat` → `forgetWitnessedCrimes`) and the god panel's Lose
  police forget unreported crimes and void calls in progress.
- **API for other systems**: `witnessReport(person, kind, x, y, { delay, severity })` makes
  one person a certain caller about what the player just did at (x, y) (carjack, theft,
  gunfire, melee, body, crime). Used by the hijack paths (game-player-actions.js, taxi.js),
  the Trail Club and carjack.js. Non-crowd people (venue staff) call "off stage" with the
  same bubbles (`offstageCallSpeakers()` feeds them to `speechBubbles`).

## Who calls (crowd-witnesses.js)

- Everyone who perceived something the player did keeps `witnessOf` / `witnessSaw` (up to
  20 per incident, the nearest kept). **Gotcha**: perception is `p.pending` until
  `crowdPerceive` turns it into a reaction; updatePeople does that before the special
  routines (island walkers, strollers, park guests), which only step aside once `p.react` or
  `p.flee` is set. Before, Monarch Isle's walkers never reacted, so nobody there called.
- `witnessDirector` (4 Hz, after a 1 s lull in the shooting) is the only thing that hands
  out the phone for the player's incidents (decideReaction and endReaction start calls only
  about others). It picks the best placed witness (told by `witnessReport`, saw it, on
  screen, near 150 units, brave) that `witnessCallBlock` does not rule out (dead, gone from
  `pedestrians`, silenced, hands up, hurt, already calling, still shaken...). Gunfire,
  blasts, melee, knocks, bodies and carjacks are always called in, seen or only heard.
- `witnessTakesPhone`: within `CALL_SAFE_DISTANCE` (120) of the player they flee first with
  `then: 'call'` (fleeStep stops them once clear; `inc.callerDue` reserves the phone),
  otherwise straight into the `call` reaction (`callStep`): phone pose, the opening line and
  then a detail line back to back (`witnessCallLines`), the closing line when the report
  goes in. A `call` reaction gets its `callTime` in `startReaction` however it began (a flee
  or startle handing over to it used to show 0 s in `witnesses()` until its first step). The player within `CALL_CUT_DISTANCE` (60) cuts the call (they run and retry);
  death ends it; held at gunpoint 2.5 s (`witnessThreatened`) most stay silent 3 min.
- `inc.callers` is not given back when a caller dies or leaves the street, so the director
  counts live callers (`witnessCallUnderWay`), and only those on stage (in `pedestrians`,
  within 1,400 units: beyond that updatePeople freezes them mid-call). Someone sheltering in
  a shop may call from inside (`offstageCalls`, hidden, no bubble: it waits while a street
  caller is on it).
- **A told witness always gets through** (`witnessMust`, e.g. a carjacked driver):
  `noteWitness` never moves them to another incident while theirs is unreported (the
  player getting into the car raises a separate 'theft' incident that used to take the
  victim over, leaving the carjack with no caller); the crowd streamer never moves or
  redresses anyone who still owes a call (`witnessOwesCall` in `streamableWalker`); and a
  told witness or a frozen caller who is `gone` or `far` finishes the call off stage from
  where they were (`witnessCallsOffstage`). `witnessReport` marks its incident `direct`
  only when it created it (a merged crowd incident stays visible to `recentPlayerIncident`).
- Bubbles: a 911 line (`speechKind` 'call911') ranks with police lines, and the renderer
  never culls it: outside the bubble band (x 40..W-40, y 90..H-190, only ~50-100 units
  north/south of the player at the street zoom) it is held inside the frame with a red edge
  and a tail toward the caller.
