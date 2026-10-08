# Cheats and the respray arrow

- Typing HELICOPTER during play parks a helicopter of your own on clear ground beside you (no theft to take it).
- GODMODE now also puts $1,000,000 in your pocket each time it is switched on.
- The pad-style AAAAXBBBBYXXXXAYYYYB code is switched off for now; GODMODE is the only god mode code.
- In a police chase, driving near a respray garage shows a blue arrow over its door and a RESPRAY line; out of a
  chase the shops are not marked (the 2D fallback's R marker follows the same rule).
- Internals: `helicopterCheat`, `GOD_MODE_CASH`, garages.js RESPRAY BEACON (`garageBeacon()`, read by the
  renderers). Console: `vehiclesNear(metres)`, `garage().beacon`, `markers().respray`.
- Tests: cheat-helicopter, respray-beacon, view-remembered (the overhead view starts a new profile and the last
  view is remembered); god-mode-codes now types GODMODE only.
