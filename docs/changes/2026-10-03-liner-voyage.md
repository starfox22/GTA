# The cruise liner's grand tour, and parachute landings on ships
- MS MERIDIAN STAR is now drawn wherever she sails: she was filed under the scenery cell of her North Sound anchorage, so she only showed near it and seemed to stay in one spot.
- Her new tour (about 20 minutes a lap): a 50 s call off the cruise terminal, out north about Sunset Pier, east along Monarch Isle's north shore past MONARCH ONE and back, down past Ocean Drive, slow along Palm Keys' beach to a call where she swings round at anchor, then north offshore and home. 21 knots at sea, 19 along the islands, 8 off the beach, 7.6 in the sound; never under a bridge, well inside the world edge.
- Parachute onto a ship: a canopy touches down on the liners' decks (the lido and the other deckhouse roofs too) or the superyacht's, moving or not; the ship carries you, and E takes the stairs aft to the stern platform. Freefall onto a deck is as hard as the ground; the freefall cue counts down to the deck.
- A canopy coming down on a small boat lands you in the water beside her (E climbs aboard); moored hulls and bridge footings set you clear.
- The ride skip names the liner's next anchorage; no world-edge approach card while aboard.
- Internals: marina-voyage.js (split from marina-liners.js), deck-landing.js; static cull entries can be `moving`.
- Console: `linerChart()`, richer `linerVoyageCheck()` (lap time, passages, world-edge margin) and `liners()` (`area`, `call`); group `decks`: `deckLanding()`, `deckJump()`, `canopyOver()`.
- Tests: `liner-voyage`, `parachute-liner`.
