# A big TELEPORT map
- Settings · GOD MODE · PICK ON MAP now opens the map as big as the window allows (about 90 % of its height); the
  hint banner floats over the map's top edge. It used to sit in the map's grid cell and push the map itself into
  the narrow side column, which is why the teleport map looked tiny.
- In pick mode the GO TO list, filters, legend and route buttons step aside; the map's own help line says CLICK TO
  TELEPORT. The mouse wheel now zooms toward the cursor on every city map (back out to the whole world it
  re-centres).
- Internals: god-panel.css pick-mode layout, `godMapToggled` refits the canvas after the class change, navigation.js
  `zoomMap(factor, at)`; console `godTeleportPick()`, `mapView().bigmap.shown`. Test: tools/tests/god-teleport-map.mjs
  (a real click on the big map teleports the player there).
