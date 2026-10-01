# Stray road signs and rings gone, real motels

- The glowing rings on the street at every shop, hospital and motel door are gone (the map and minimap blips stay), and so is the free-standing "SAFEHOUSE · ROOMS" sign in the middle of the east boulevard. Home is now a room at the SUNSET MOTEL: sleeping, and mission 4's GO HOME, use its door.
- The huge brown EAGLE PASS board across the Ridgeline Highway junction (and the other giant floating boards) are replaced by real guide signs on two posts on the verge: EAGLE PASS, OCEANVIEW / AIRPORT, CORAL COAST, the SCENIC VIEW lay-by signs, the town name boards and the trailhead boards. NEEDLE RIDGE's trailhead board is dropped (its trail starts on a junction).
- Motels, inns and county lodges get a proper entrance: lit glazed lobby, porte-cochere on slender columns, paved forecourt, planters and palms, a covered walkway of numbered room doors with lit windows and air-conditioners, a vending alcove and the VACANCY pylon. Motel trees now flank the building instead of hiding the room doors.
- Internals: `civic3d-hotels.js` (`dressHotel`), `county-guide-signs.js` (`COUNTY_GUIDE_SIGNS`, `signSpot`, `guideSignReport`), `county3d-signs.js` (`roadsideSign`); the 'home' place and the 'SAFEHOUSE · ROOMS' sign design are removed.
- New console method `guideSigns()` (every county board with `onAsphalt`/`clearance`); new test `road-signs.mjs`.
