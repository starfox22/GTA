# Story payphones on every island

- A waiting job call can now be answered at any payphone: at least two on every island (27 in all: nine on
  Northbank, three each on Palm Keys and Ridgeline, two on Oceanview, Coral Coast, Sunset Pier, Sentinel, North
  Point Key (KEY FORECOURT in front of Mercury Tower, KEY CIRCLE south of the drop-off circle) and Monarch Isle,
  whose green booths now take the call too). Every yellow booth rings while a call waits.
- The NEXT JOB · PAYPHONE arrow, navigation pill, minimap and map guide to the nearest payphone, re-chosen as you
  move without flickering between two; the map has a PAYPHONES layer and GO TO lists the nearest payphone.
- Rush Hour, Fireworks Night and Repo Man give the extra drive from a farther payphone on top of their clocks.
- Internals: `PAYPHONES` / `PAYPHONE_ISLANDS` (src/payphones.js, the original `phone` first), `storyPayphone()`,
  `payphoneInReach()` returns the one in reach; payphone3d.js copies the booth for the others; bike-share
  stations keep off every payphone but anchor only on the original (unchanged).
- Every land region maps to an island (`PAYPHONE_REGION_ISLAND`); the audit adds `visitorLane` (the Key's visitor
  run). Console `payphones()` (`regions`); tools/tests/payphones-islands.mjs checks every island, not only the garage ones.
