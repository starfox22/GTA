# Sound check: louder mix, mute says so, sound wakes up again

- Pressing M (mute) now says SOUND OFF and how to turn it back on, then SOUND ON; the switch is saved, and
  starting play with the sound off (or the master volume at 0) says so too. M is the map key in other games,
  so a silent, remembered mute looked like the game had no sound.
- The whole mix is 6 dB louder (`MIX_MAKEUP` after the limiter; the ceiling still holds -1 dBFS): the street
  bed sat near -36 dBFS and the player's pistol peaked near -19 dBFS.
- If the browser suspends or interrupts the audio (a tab switch, a call, a new audio device, Safari's
  'interrupted'), the next click, tap or key brings it back; iOS plays through the silent switch
  (`navigator.audioSession.type = 'playback'`).
- Console: `audioLevel()` (the output meter after the ceiling); `audioMix()` adds `states`, `makeup` and
  `soundOffText`. Test: tools/tests/sound-output.mjs.
