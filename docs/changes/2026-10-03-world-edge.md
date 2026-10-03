# World edge: return to the city
- Flying or sailing past the edge of the map now starts a RETURN TO THE CITY card with a 10 second countdown (a tick each second, a pulse, a direction arrow and the distance past the edge). Back inside the line cancels it (ALL CLEAR); at zero the vehicle explodes and the player is WASTED. On foot, swimming or under a parachute the player simply dies at zero. God mode is warned only.
- Before the line a calm APPROACHING THE WORLD EDGE · TURN BACK card shows the distance and an arrow toward the city when an edge is within 25 s of travel at the current velocity (or 400 m) and the player is moving toward it; it goes when they turn. Never lethal.
- The line is 192 units (24 m) inside the world box, outside every piece of land. Planes, helicopters, the Apache, boats and jet skis count; AI aircraft, police and missions are untouched.
- Internals: src/world-edge.js (`updateWorldEdge`, `updateWorldEdgeCue`, `resetWorldEdge`, called from `update()`, `updateHud()` and `teleportPlayer()`), src/ui/world-edge.css, `#worldEdgeCue` in hud.html; state is derived from the player's position (nothing saved).
- Console: `worldEdge()`. Test: tools/tests/world-edge.mjs.
