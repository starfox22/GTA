# Mission 3: High Ground

- New mission 3 (replaces Vinny's Favor), playable in the demo: Vinny's man buried a package under the stones at the
  foot of the cairn on the very top of Mount Ascent, where the 4x4 trail ends. Get up there by club truck (the
  RIDGELINE 4X4 CLUB in Northridge), set a helicopter down on the summit platform, or jump: the platform is about ten
  metres of level rock and the scree round it takes a bad landing down the face (the existing footing rules; the
  parachute is unchanged).
- Digging is a held interact: the player kneels and digs (`kneelDig` pose), the stones come off onto a pile, the
  hole and its spoil heap grow, grit flies and the trowel scrapes; a knock at ~60 % finds the taped case, and a
  release keeps the progress. The HUD reads DIGGING TO RETRIEVE PACKAGE · nn %.
- The package goes in the vehicle parked by the cairn (interact at its back, or just get in) or into a backpack
  when there is none. Left in a vehicle, the card points back at it. Vinny waits inside his warehouse (the mission 1
  depot) for the handover; he will not take it with police on the player.
- Vinny talks the player through it on the radio (the trailhead, a road car on the trail, a jump, the scree).
- Internals: `summitjob.js` (`SUMMIT_JOB`, `summitJob()`, `summitCacheView()`), `summitjob3d.js` (stones with no
  new shader program), mission entry `start` at the 4x4 club gate. Console `summitJob()`, `summitSkip(where)`;
  test tools/tests/mission3-summit.mjs.
