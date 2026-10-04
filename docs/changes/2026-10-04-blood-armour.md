# Bloodier hits, faster pools, no knock-back, realistic body armour
- The pool under a body grows larger and faster: about 1.5 m across from one fatal round (up to 2.1 m after
  several), most of it in the first 10-15 s (one round: r 5.5 at 10 s, was 3.0). Someone wounded on the floor
  who lies still bleeds a small pool of their own.
- An explosion's fire and smoke now draw over the blood on the ground (the pool used to show through the fireball).
- People hit by a bullet stand their ground: no shove back, and a killed body drops where it stood. The blood
  goes instead: an exit spray of mist and fine drops away from the shooter, landing 1-4 m beyond the victim.
- Shooting is a little bloodier: more drops and a second spatter from heavy rounds.
- Body armour by calibre and hit zone: soft vests (patrol officers) stop handgun rounds, not rifle rounds; plates
  (SWAT, agents, soldiers) stop handgun rounds and most of a rifle round; legs and head are never covered. 9mm
  torso hits: gang 2, patrol 3 (was 2), SWAT 7 (was 5); assault rifle: patrol 2, SWAT 4. Agents wear a visible vest.
- Internals: `VEST_STOP`, `vestPlate`, `bulletCalibre`, weapon `cal`; `strikePerson(..., calibre)`; floor-blood
  render order fix (`FX_SPRITE_ORDER`); `bodyPoolPlan`. Console: `shotsToKill()`, `strikeTest()`, `bloodSides()`.
  Test: tools/tests/bullet-hits.mjs; blood-wounds.mjs holds the faster pool.
