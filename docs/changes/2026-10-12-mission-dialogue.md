# Mission dialogue you can read and move on

- Mission 3 opens with one sentence: "Vinny asked you to collect a package hidden at the top of the mountain." No
  route or parachute hints in the call, the brief or the mission card.
- Mission briefs read for less time (3-6.5 s). Escape folds the brief (or a job's title card) out of the middle of the
  screen at once instead of pausing; with nothing to clear it pauses as before (gamepad MENU too).
- The CIRRUS meeting: every line of Varga's and yours shows in a bubble over the speaker and in the subtitle; E (NEXT
  LINE) moves it on a line at a time, with a hint on the first line. Nobody in the game is voiced: the text carries it.
- After the meeting you can always walk away from the table (standing up put you inside the table's keep-out); the
  same on an abandoned, failed or ended meeting.
- Winning mission 4 in the demo brings up the DEMO COMPLETE card once per save (god mode too); a save that finished
  the demo before this fix shows it once after loading. Escape or CONTINUE FREE ROAM goes on in free roam.
- Conversations at the Marea and at Fort Sentinel's gate: talk lines take a bubble over the speaker, larger and edged
  (yours pale blue), held inside the frame in the street and chase views; your own Marea lines also read in the
  subtitle. In the chase view bubbles sit just over the head (they floated a metre up, off the top of the frame),
  people behind the camera no longer hold the bubble slots, and the subtitle no longer fades over your body.
- Internals: crowd-speech.js TALK LINES (`speechMarkTalk`, `speechIsTalk`, `speechInChaseFrame`), story.js
  `sceneLine`, mission-brief.js `dismissMissionCentre`, skyline-meeting.js `skyMeetingNextLine` /
  `skyMeetingStandSpot` / `skyMeetingRise`, campaign.js `demoCardSeen` / `demoCardOwed`. Console
  `storyProgress(n, cardSeen, owed)`; `skyMeeting()` reports `playerFree`, `clubTalk()` the `subtitle`.
- Tests: sky-meeting-talk, demo-complete-card, marea-talk (new); mission-brief and fort-gate-talk extended.
