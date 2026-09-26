# Demo picker: locked jobs are a mystery

- The mission picker no longer names locked jobs: the full game's missions and contracts read
  `???` with the FULL GAME badge, like a story job not reached yet.
- Replaying mission 2 no longer brings the DEMO COMPLETE card back; it shows only the first
  time the story reaches the end of the demo.
- Internals: `missionPickerTitle(i)` (campaign.js); console `demo().picker` lists what the
  picker shows; tools/tests/demo-gating.mjs checks it.
