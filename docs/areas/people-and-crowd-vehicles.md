# Pedestrians and vehicles

Who notices a car coming and what they do (crowd-awareness.js, driven by `nearMisses` in
crowd-reactions.js), and what a second pass does to someone already down (runover.js,
runover-audio.js; the first pass is `knockPerson`, physics-knockdowns.js). Part of
people-and-crowd.md. Tests: pedestrian-awareness, second-run-over.

## Seeing and hearing the car (crowd-awareness.js)

- `nearMisses` (every ~0.08 s) takes each car at `CAR_MIN_SPEED` (36 units/s, 16 km/h) for the
  player's car, `CAR_MIN_SPEED_TRAFFIC` (70) for traffic, within `CAR_REACH` (600) of the player,
  and looks `CAR_HORIZON` (2.4 s) ahead along its velocity, +-(half width + 18) across. Everyone
  in that lane gets `watchVehicle(p, c, o)`: nobody leaps on the spot any more.
- `p.carWatch` (per person and car): `aware` fills from sight and hearing; at `need` (0.55-1.4) they
  **notice** (`noticed`, `by` 'eyes' | 'ears'), wait their **reaction time** (`carSense(p).react`
  0.36-0.56 s + the attention lag + 0-0.2), then `carAct` decides from the time to impact `tti`.
  `outcome`: dodge, sidestep (calm, tti over 1.1 s), back, freeze, late (under 0.08 s: a flinch),
  passed (outside the wheel track, most just watch it), unaware (never noticed). `carNoticed(p, c)`.
- **Sight** (`carVisualRate(off)`, off = angle between `p.a` and the car): 4/s inside ~30 degrees,
  fading to 2 at 60, to 0.3 at 100, nothing past ~120. Someone who just looked both ways at a kerb
  (`p.glanceUntil`: crowd-walking.js sets it for everyone about to cross, not only those who waited)
  sees all round for ~3 s (`carScan`), then only where they walk. Buildings block (`crowdSight`).
- **Hearing** (`carHeard`): type (`CAR_NOISE`: bicycle 0.06, sedan 0.5, bikes and supercars ~1) x
  speed, +2 horn (`carHorn(c, ...)` sets `c.hornUntil`; the player's key is read directly), +2.5
  siren (`emergencyBeacons`), +1.4 a screech; half at ~7 m, masked by moving traffic round them and
  rain (`carDin`); earbuds (`carSense().buds`) cut it to 15%. Heard from behind they first turn
  (a `startle`, +0.28 s) before they can judge it.
- **Attention** (`carAttention`): texting (eyes x0.3, +0.3 s), phone, chat, a camera, a drink
  (`p.tipsy`), a companion; scared or fleeing people are sharper. Kids, elders, revellers are slower.
- Measured (`carAwarenessTrials`, 10 passes a case, +-10 points between runs), a sedan at 40 km/h
  from 27 m: facing it 100% notice, 80-90% clear (the rest freeze or take the wrong side); side on
  50-60% clear; back to it 0% clear, 10-30% hear it at the last moment (turn too late), 90% of those
  hit make no cry; back to it with the horn on 90% notice, 20-40% clear; at 80 km/h from 41 m facing
  it 90-100% clear; a car 5 m off at 40 or 12 m off at 80 km/h gives nobody time; at the same
  distance texting 0% clear where the alert clear 60-80%.
- A hit person who never noticed makes no cry (`p.mutedUntil`, read by `scream()`); one who did, or
  was only bumped (under 20 km/h), screams as before. Damage, crime and witness rules are unchanged
  (`p.sawPlayerAt` is now set for those who noticed the player's car).
- Dodge variants live in `updateReaction` ('dodge': `leapV`, `leapFor`, `calm` = a sidestep facing the car).

## Running over someone on the ground (runover.js)

- `knockPerson` hands anyone for whom `personOnGround(p)` (alive and knocked down, groaning or
  dying) to `runOverDowned`: at 4 km/h or more, and not the same car again within `RUNOVER_SAME_CAR`
  (2 s: its own first pass). Nothing else of the first-pass code runs for them.
- `runOverHarm`: `(10 + 0.8 kph) x weight(0.6..2.2 from spec.mass) x zone(legs 0.8, torso 1.05,
  head 1.35)`, judged against health (at most 40): under 40% an injury (stay down 4.5 s, limp),
  from 40% a maiming (health capped at 12, down 7+ s, then groaning: crowd-reactions adoptLegacyFlee),
  from 75% mortal: `p.dying` for 0.45-2.4 s (hp 2), `stepDying` then `finishDying` -> `strikePerson`
  (the normal death: kill, `killedBy`, witnesses, medics), the body kept as it lay, pool via
  `bodyPool`, +$25 for the player. Head or crushing harm is unconscious: no scream, no groan.
  A sedan at 30 km/h is always mortal, a crawl never; a truck at 8 km/h is; a bicycle at 20 is not.
- Blood: `bleed(p, sev, heading, 'impact')`, 2-3 streaks along the path, tyres laid with
  `c.bloodTrackRemaining`; a pool only under a body that has died. The car: `addCarStain(c, p,
  kph, mortal)` (nothing under 14 km/h: a crawl leaves the bonnet clean). Sound: `runOverSound` (a pitched-down bump and a crack). Heat: `crime()`
  0.35 for a mortal pass (0.08 otherwise or for a pass over someone already dying), `crowdAlarm('knock')`;
  the kill itself is `recordKill` once, at death.
- Console (docs/console/crowd.md): `runOverReport(type, kph, hp)` (the table), `runOverVictim`,
  `runOverState`, `carAwarenessTrials`, `carWatch`.
