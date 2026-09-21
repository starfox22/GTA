# Audit report: missions, police, campaign, chase, challenges, rooftop, casino

## Fixed
- chase.js `updateCargoPursuit`: pursuit cars far from the cargo truck were removed from the world
  even when the player was driving one, leaving the player inside a ghost vehicle. Player's car is kept.
- chase.js `updateCargoPursuit`: every frame re-flagged all pursuit cars as police, including one the
  player had stolen, so cleanup later handed the player's own car back to the AI.
- chase.js `cleanupMissionExtras`: mission end removed the vehicle the player was sitting in.
  The player's vehicle now has its mission flags cleared instead.

## Noted, not changed
- story.js `retryMission` after a win starts the next chapter without the payphone dialogue.
- harbor.js `truckClearedHarborExit`: the first mission only registers the harbor exit westward.
- story.js `findStreetPoint` falls back to the player spawn if a guard cannot be placed.
- Mission timers on 4 and 7 run to the end by design.
- casino.js `visibleCash` can flash negative right after a death during a spin.
- Copy: Rafe calls the Oceanview helicopter his, the mission label calls it Elena's.
- game.js: digit keys only select missions 1 to 9 in the mission menu.
- story.js clears the whole `enemies` array on win/fail (design).

## Mission system summary (for new missions)
- `STORY` entries define title/contact/reward/phoneMessage/brief and are pushed onto `missions`
  (order = index). aviation.js appends the flight missions; `CHALLENGE_COPY` rewrites 2-8.
- Payphone interact -> `offerMission` -> `startMission`: `resetMissionState()`, build `mission`
  object, dispatch by index to a start function, save.
- Stages advance with `setStage(stage, target, instruction, speaker?, text?)`; `objective()` feeds
  the marker and navigation HUD. Interactions route through `interact()` and
  `policeBlocksMissionDelivery`.
- `winMission` pays and calls `finishCampaignMission`; `failMission` flags vehicles for removal.
- Save schema stores indices and cash only, so extra missions need no schema change; the mission
  menu unlocks `i <= completed`.
