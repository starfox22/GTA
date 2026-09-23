# Mission QA pass: all 16 missions after the world overhaul

Play-test of the 11 story missions and 5 contracts after the west-shore railway, Southport
Beach, superyacht/marina, damage, flight camera, crowd and roadblock passes. Each mission was
started from the developer console and driven stage by stage through the real update loop
(`simulate`, `steerTo`, `walk`, `interact`), skipping only long drives whose road connectivity
was checked separately (a taxi route across the same trip). Mission numbers below are the
in-game numbers (index + 1); contracts are C1..C5 (indices 11..15).

## Status

| # | Mission | Status |
| --- | --- | --- |
| 1 | Dockside Favor | Fixed (gang fire wrecked the truck while loading); harbor, bay, gate, police, depot drop, back door all verified |
| 2 | A Seat at the Table | Works: clothes, lift, silent takedown, lift down, on-foot escape to Coral Palms |
| 3 | Vinny's Favor | Works: coupe, Eastside Customs, tracker, delivery with no stars |
| 4 | Paper Trail | Works: three receipts (two inside the terminal), timer, safehouse |
| 5 | No Last Ferry | Works: cinema pickup, transfer sedan, Coral Palms |
| 6 | Both Sides of the Bay | Works: dock office, warehouse guards, Blue Hour |
| 7 | Above the Noise | Works: Mara, both sightlines with the launch, report, lift down |
| 8 | Saltwater Accounting | Fixed (two beacon gates on land); full water route, dock, Rafe verified |
| 9 | One Clean Exit | Works: Elena, hangar guards, flight papers, back to Rafe |
| 10 | The Last Witness | Works: helicopter, Northridge pad, guards, Daniel, Oceanview pad (follower fixed) |
| 11 | The Manifest | Fixed (Daniel soft-lock after the Oceanview divert); both landings, van, depot verified |
| C1 | Rush Hour | Works: eight checkpoints, depot |
| C2 | Fireworks Night | Works; objective labels fixed |
| C3 | Blackout | Works: three substations, night forced |
| C4 | Ring Run | Works: real takeoff through ring 1, all rings, Southport landing |
| C5 | Repo Man | Fixed (delivered cars blocked the warehouse; the bus could not get in) |

## Bugs found and fixed

### 1. Mission 8: beacon gates on land (unwinnable)
- Symptom: after salvaging the ledger the first gate is on Sunset Pier and the second on the
  beach sand; the jet ski can never reach them and the 150 s timer fails the job.
- Cause: `waterRoute` in `src/challenges.js` still used (3720, 5410) and (2250, 5750), which
  now sit on Sunset Pier and inside Southport Beach (`probe()` reports land for both).
- Fix: new route down Marlow Bay, through the Battery Point narrows (x 3380..3470), round the
  outside of the fishing pier head (south of y 5990) and up to the Southport dock; channel
  gates are 110 units wide (the dock stays 55).
- Verified: full run from the buoy to the dock with 135 s left, on foot to Rafe, mission won.

### 2. Mission vehicles: engine fire always destroyed them
- Symptom: any mission-critical vehicle below 25% health caught fire and exploded 11 s later,
  failing the job (Vinny's truck, the armored van, Elena's car, repo cars, the escape van).
- Cause: `updateDamage` in `src/damage.js` burns every burnable vehicle down to 0.
- Fix: a vehicle with `mission` set burns down to 8% health, then the fire goes out and does
  not relight (`damage.fireSpent`); bullets and crashes can still wreck it.
- Verified: the armored van blasted to 66 hp burned to 33 hp and went out; the job continued.

### 3. Mission 1: Harbor Kings wrecked the cargo truck before the third crate
- Symptom: the gang notices the truck at the loading bay and four gunmen take about
  50 hp/s off the 460 hp truck; it caught fire during loading and was always destroyed.
- Cause: full pistol damage against the mission truck, plus bug 2.
- Fix: gang (non-police) small-arms fire does 40% damage to mission vehicles (`src/game.js`
  bullet loop). Rockets and police fire are unchanged.
- Verified: truck finishes loading at ~285 hp; with a quick exit it leaves the terminal with
  enough health for the police chase. The flatbed also breaches a bridge roadblock.

### 4. Missions 10 and 11: Daniel stuck behind the plane (soft-lock)
- Symptom: after the Oceanview divert landing Daniel stayed pressed against the wing of the
  plane; "Keep Daniel close" forever, the escape van would not board.
- Cause: `followWitness` walked him straight at the player with `footStepTowards`, whose
  sidestep checks buildings only, not vehicles.
- Fix: he follows the player's breadcrumb trail and each step takes the smallest turn that
  actually moves him (`witnessStep` in `src/aviation.js`).
- Verified: divert run, Daniel reaches the van, stage 5 with two stars.

### 5. Repo Man: delivered cars block the warehouse (soft-lock)
- Symptom: each repo was left parked in Vinny's warehouse; after three the bus could not get
  within reach of the delivery point. The mission 1 truck and the Rush Hour car likewise
  stayed where The Manifest's van must park.
- Fix: `clearDepotFloor()` (`src/chase.js`) removes parked vehicles inside the warehouse when
  a repo is delivered and whenever a mission starts; the player's vehicle is never removed.
- Verified: all four repos delivered, including the bus.

### 6. "POLICE CLEARED!" chip
- Report: shown after `fireShot()` at the beach and still up after teleporting with no stars.
- Findings: firing is itself a crime (one star), so the chip after the escape was a real
  1 -> 0 drop; it stayed up because it timed out on the capped simulation step, so at headless
  frame rates four seconds lasted minutes. One path could show it with no stars: a respray
  between the gate camera and the first units (`evadeCargoPolice`).
- Fix: the banner times out on the wall clock (capped per frame); `evadeCargoPolice` only
  shows it when stars were actually cleared; a mission start hides a stale chip.
- Verified: `wanted(0)` at zero shows nothing; shot -> escape shows it; `startMission` hides it.

### 7. Copy
- Fireworks Night objectives read "BOMB 3 / 3 · BLUE" and "NEON": now "BLUE HOUR" and
  "NEON PALACE".
- The mission card lower-cased names it did not know ("fly to northridge", "daniel's"):
  every story name is capitalised wherever it appears.

## Checked and fine
- Every hard-coded objective, spawn and waypoint was probed with `probe(x, y)`: all on land
  or water as intended except the two mission 8 gates above.
- Mission 7's surveillance launch loop (x 3740, y 1930..2570) is clear water.
- Road routes exist from Southport and from Oceanview International to Vinny's warehouse
  (taxi route test), so The Manifest's two escapes can be driven.
- Swimming: diving off the jet ski and re-boarding works; retrying a mission while swimming
  resets the swim state.
- Restart from pause respawns the mission vehicle and moves the player to the payphone.

## Known issues (not changed)
- Mission 5: Elena steps out at a point beside the clean sedan that can be where the old car
  stopped (she appears to stand in it for a moment).
- Mission 2: the roof alarm raises two stars that expire in seconds while the player is on
  the roof (police cannot see up there); by design of the search timer.
- Mission 1: the gang still shoots hard; a slow three-point turn out of the bay can lose the
  truck. Players can also clear the gang on foot first.
- A plane overrunning the Southport runway northbound at low height hits something near
  (407, 3724) (street furniture on the Y 3712 street); not mission logic.

## Test helpers added to the developer console
`probe(x, y, r)`, `missionTargets()`, `steerTo(x, y, seconds, radius, passThrough)`,
`interact()`, `boardMissionVehicle()`, `placeVehicle(x, y, heading, altitudeMeters)`,
`defeatMissionGuards(tag)`; `missionState()` reports how the last mission ended;
`simulate()` also steps the Blue Hour elevator ride.
