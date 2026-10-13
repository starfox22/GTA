# A cleaner minimap, and Sunset Pier's rides on the maps
- The minimap shows only what you act on: the job and its GPS road route, your waypoint, you, mission targets
  (Kessler's car, the harbour crates, a street thief), and a drawbridge only while it is up.
- Police appear on the minimap only while you are wanted (or when they are on a job of their own); while wanted the
  nearest respray is marked too, with an arrow on the rim when it is off the card.
- A waiting call shows only the payphone it wants you at. Shops, services, rail stations and bike docks show only
  when you are on foot close by, as small chips with no names; helipads, planes, sports badges, rail lines and place
  names stay on the city map, which keeps every layer and its filters.
- The district name no longer prints over the minimap (the top bar has it); the job's blip keeps one size at any zoom.
- Sunset Pier: the Falcon's real track outline and a Ferris wheel sign at the Sunset Eye on the minimap and the city map.
- Internals: minimap-rules.js (MINIMAP MARKS), park-map.js; the sports ground moved into the minimap's base layer; police
  markers are culled to the map window. Console `minimapReport(reset)`; tools/tests/minimap-clutter.mjs.
