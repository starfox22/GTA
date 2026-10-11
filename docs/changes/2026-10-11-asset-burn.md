# Downloaded vehicles char and wipe
- A burnt-out downloaded car, police car, truck, bus, motorbike or army vehicle chars like the procedural ones: soot over
  the whole shell and trim (not just a flat dark paint, and the army's camouflage no longer survives the fire), embers
  glowing through it for the first seconds, matte with no clear coat. A repair or respray brings the normal look back.
- Army models (HMMWV, M35, tank) now dull with wear and darken while burning, as painted vehicles always did.
- The downloaded box truck, bus, ambulance and pickup have windscreen wipers again, swept in the rain.
- Internals: vehicle-char3d.js ASSET CHAR (per-car char materials swapped onto atlas and paint meshes, pooled, three
  programs warmed at the title); `addWipers` takes an optional arm `reach`.
- Console: `assetChar()` (graphics), `burnVehicle(id, ago, mend)` (damage).
