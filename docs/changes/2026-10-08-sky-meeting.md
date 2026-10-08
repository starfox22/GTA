# The meeting at CIRRUS
- A scripted scene for story jobs: a diplomat in a charcoal suit waits outside EVOLUTION's lobby door (smoking,
  checking his watch), talks, rides the lift up with the player and leads him to his reserved table by the glass.
- The player sits facing him; CIRRUS's waiter takes the order, fetches two cocktails from the bar and serves them;
  both drink (the player raises the glass, sips and lowers it, on his own body or the crowd rig) while they talk.
- HAND OVER THE PAPERS: a manila folder across the table, an envelope slid back, a nod, and he leaves for the lift;
  any movement key stands the player up. Other tables hush while the player sits.
- Internals: skyline-meeting.js (`skyMeetingBegin/End/Report/Target`, `skyMeeting.stage`), `player.sceneSeat`,
  `keyPerson.errand`, crowd parts `folder`, `envelope`, `tableCard`, poses `watchCheck` and the seated drink.
- Console: `skyMeeting(action)`, `skyMeetingSkip(stage)`; test tools/tests/sky-meeting.mjs.
