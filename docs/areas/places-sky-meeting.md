# The meeting at CIRRUS (skyline-meeting.js)

A scripted scene a story job drives: a diplomat waits at EVOLUTION's lobby door on North Point Key,
rides the lift up with the player, sits at his reserved table on CIRRUS, has the waiter bring two
cocktails, talks, takes the papers and leaves. The job owns the story; the scene owns the people,
the poses and the props.

## API (the mission polls, never moves anyone)

- `skyMeetingBegin(opts)`: `{ name, title, speaker, playerName, lines: { door, arrive, sit, order,
  bar, serve, talk, read, envelope, leave } }` (each `[[who, text]...]`, `who` = `'them'`, `'you'`,
  `'waiter'`, `'bartender'`). Default name ANTON VARGA, prompts use the last word.
- `skyMeeting.stage`: `waiting → greeted → lift → terrace → seated → drinks → handover → done`
  (`failed` if he is killed). Win on `'done'`.
- `skyMeetingTarget()`: where to send the player, `{x, y, altitude}` (roof altitude from `lift` on;
  the lobby door again if the player rides down early). `null` once done.
- `skyMeetingReport()`: stage, diplomat `{x, y, altitude, pose, sitting, hidden, hand}`,
  `playerSeated`, `seat` (`lift` 0-1, `hand`, `reach`), `service` phase, `drinks`, `talkLine`,
  `handedOver`, props, the line on screen, the target, story actors left.
- `skyMeetingEnd()`: removes everything. `cleanupMissionExtras` calls `skyMeetingWrapUp()` (a
  `done` meeting plays out and ends once the player has left the roof; anything else ends now);
  `resetMissionState` ends it outright.

## Contracts and gotchas

- The diplomat is a story actor (`missionTag: 'sky-meeting'`) in his own look (`p.ownLook`, which
  crowd3d-special.js `specialSpec` prefers to the outfit); `p.handProp` (`cocktail` / `folder`), `p.drinkLift` and `p.sitReach` drive his hand (crowd3d-poses.js
  `sit`). His speech bubble comes through `skyMeetingSpeakers()` (crowd-speech.js).
- The player in a chair is `player.sceneSeat` (`{x, y, a, lift, hand, reach}`): game-update.js holds
  his feet (`skyMeetingSeatHold`; a movement key stands him up, the stage falls back to `terrace`
  and resumes on sitting again), no firing while seated, the crowd does not see a gun.
  crowd3d-special.js poses him (`drinkLift`, `sitReach`, `handProp` spec fields), on both the crowd
  rig and his own body (player-body3d.js takes the same bones). `teleportPlayer` clears it.
- Lift: one ride. `startSkyLift` → `skyMeetingRideStart` hides him (stage `greeted` only),
  `skyMeetingRideMoved` puts him beside the player at the dark moment, `skyMeetingRideEnd`
  replaces the venue notice with his line. Wanted: the lift refuses as always, he waits.
- Prompts: `northPointKeyPrompt/Interact` ask `skyMeetingPrompt/Interact` first (TALK TO, SIT
  WITH, HAND OVER THE PAPERS; seated with nothing to do: an empty keyless prompt that swallows
  the key). Nothing is offered without an active meeting.
- The reserved table is `SKY_BAR.tables[SKY_MEETING_TABLE]` (the south-east date table by the
  glass): `skyBarArrive` seats no guests there; `skyMeetingBegin` empties a filled terrace so it
  refills without them. Other tables hush while the player sits (`skyMeetingBusy`).
- The drinks come from CIRRUS's waiter: `keyPerson.errand` (`skyMeetingErrandStep` from
  `updateKeyPerson`) sends him to the table, the bar and back; a missing or frightened waiter
  never stalls the scene (25 s per leg, then the drinks arrive anyway).
- Table props (`skyMeetingProps()`: RESERVED card, the envelope, glasses put down) and the folder
  are crowd prop parts (crowd3d-bodies.js `folder`, `envelope`, `tableCard`, the `cocktail`).

Console (missions group): `skyMeeting('begin' | 'end' | 'report', opts)`, `skyMeetingSkip(stage)`.
Test: tools/tests/sky-meeting.mjs.
