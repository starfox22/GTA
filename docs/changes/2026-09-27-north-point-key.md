# North Point Key: the towers on their own islet
- The wall of skyscrapers on Northbank's north-east point is gone: MERCURY, FEDERATION EAST
  and EVOLUTION now stand in a row on North Point Key, a landscaped islet off the corner
  with only open water behind them, reached over a short white twin-arch bridge.
- The Key: a drop-off circle round a fountain with a gilt armillary sphere, a limestone
  forecourt, palm avenue, lawns, a sea-wall promenade and a beach with loungers.
- FEDERATION EAST carries a helideck with a helicopter parked on it; EVOLUTION's roof is
  CIRRUS, a sky bar with couples on dates and business pairs talking, a bartender, a
  waiter, a fire-pit lounge and lounge music. Drinks $45 at the bar.
- Lobby lifts (E at the tower door) ride up to the helideck or CIRRUS and back down with a
  fade; land a helicopter on the deck and take the lift down to the street.
- The old cluster blocks are ordinary 5-10 storey offices; the other 15 towers are kept in
  reserve (`reserve: true`). The rest of the city is unchanged (seeded stream replayed).
- Internals: skyline-towers/islet/lift/bar/plans/console.js, geography-key.js, roof decks in
  rooftops.js (`b.roofDeck`, `b.deckKeepOuts`, `b.noLanding`), bridge style `key`.
- Console: `skyline()`, `skylineVisit(spot)`. Test: `node tools/test.mjs north-point`.
