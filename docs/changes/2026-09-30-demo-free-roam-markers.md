# No story pointer after the demo ends
- After the demo's DEMO COMPLETE card and free roam, picking a job to replay from the pause menu or title picker and hanging up (or failing it) no longer leaves the payphone ringing with the floating arrow, ground ring, navigation pill and "PAYPHONE" distance line for that job. A save made in that state heals on load. A replay you accept still shows its pointer.
- Cause: `missionIndex` is the story frontier and also the job a replay picked; `storyCallWaiting()` read it, so a declined replay of job 1 or 2 looked like a story call waiting. `settleDemoStoryIndex()` (campaign.js) puts it back on the frontier on HANG UP, on a failed job and on load, once the demo is complete.
- A failed replay in the finished demo now says "Replay it from the pause menu."
- New console method `pointers()` (every story pointer: objective, navigation pill, pager line, bearing, payphone); test tools/tests/demo-free-roam-markers.mjs.
