# Realistic blood

- A gunshot no longer drops a pool at once: a round throws a brief dark-red mist and a few
  fine drops out of the exit side, leaves one directional spatter behind the body and a
  drop at its feet.
- A pool only forms under a body on the ground, starting small under the chest and
  spreading over tens of seconds as it bleeds out; more wounds make a larger pool. A blast
  pools at once with a spray all round; a car at speed or a fatal fall pools larger.
- Blood is dark venous red, near black where thick, without the old pink highlight; drops
  are small and scalloped, drawn out by their flight; blood darkens as it dries. Tyres now
  pick blood up only from real pools.
- Internals: new src/blood.js (moved out of citylife-civic.js): `bleed(entity, severity,
  heading, kind)`, `bodyPool()`, `addBloodDrop/Spatter`, growth in `updateBlood`; renderers
  only read `r`/`stretch`. Console `bloodReport()`, `bloodVictim()`; test
  tools/tests/blood-wounds.mjs; doc docs/areas/police-and-combat-blood.md.
