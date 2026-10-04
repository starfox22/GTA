# A second god-mode code
- Typing AAAAXBBBBYXXXXAYYYYB during play (in capitals or not) toggles god mode exactly as GODMODE does.
- The four A's still steer or walk left while it is typed; the code takes over its keys from the X on (so B does
  not change the radio station and Y does not skip a ride). Shift and Caps Lock no longer break a code mid-way.
- Internals: game-input.js `CHEAT_CODES` maps both codes to `godModeCheat`; `CHEAT_SWALLOW_FROM`,
  `CHEAT_IGNORED_KEYS`; the ring holds the longest code. Test: tools/tests/god-mode-codes.mjs (real key presses).
