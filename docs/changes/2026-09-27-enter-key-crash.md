# Action key no longer freezes the game

- Fixed: pressing the action key (getting into a car, the phone, doors) stopped the game. A leftover check from the removed silent takedown called a function that no longer existed, every frame the key was held.
- Tests: new `enter-key` presses the real key through the page (in, drive, out); `t.keys(codes, s, { real: true })` and `t.realWait(s)` in the test API.
