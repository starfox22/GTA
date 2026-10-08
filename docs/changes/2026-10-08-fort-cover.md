# Borrowed stripes: Fort Sentinel cover
- A borrowed army field uniform for the player (camo, belt, boots, patrol cap on his own face and build; 2D too).
- Under cover at Fort Sentinel's gate, on foot with no stars, the guard asks "HALT. ID, PLEASE."; SHOW YOUR PAPERS
  runs a short inspection and clears him through. Inside, cleared, the base leaves him alone and soldiers watch him
  with forward cones: running, restricted spots (bunkers, fuel depot, control tower, flight line, the HQ doorway),
  hanging about in a soldier's face or climbing fill a suspicion meter (the Blue Hour's); a weapon in hand or a
  blow seen, or any shot, blows the cover; at 100 the whole base turns on him. Walking is the default under cover.
- Any military vehicle taken under cover (or on the base) raises the alarm at once.
- The HQ has a RECORDS side door west of the portico: a fade inside, a timed search for the weapons file, and
  out with the papers (followed by a duty officer if he walked in under a heavy look). Out past the checkpoint
  with them, calm, the gate waves him off.
- Internals: fort-cover.js, fort-cover-watch.js, fort-cover-records.js; API `wearUniform`, `fortCoverBegin`,
  `fortCoverEnd`, `fortCoverReport`, state `fortCover`. Console `fortCover()`, `fortCoverTest(step, suspicion)`;
  test tools/tests/fort-cover.mjs.
