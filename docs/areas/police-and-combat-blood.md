# Blood

What a wound leaves on the ground (blood.js; strikePerson in citylife-civic.js calls it).
Part of police-and-combat.md.

## The rule: a hit is not a pool

- One round: a short dark-red mist at the wound, 2-8 fine drops thrown out of the exit side
  (the shot's heading, a narrow cone), one directional **spatter** a step behind the body
  and a **drop** at its feet. Never a pool.
- A **pool** only under a body on the ground (`p.hp <= 0`): `bodyPool(p, kind, a)` starts it
  small (r 0.8) under the chest (4 units along the line of the shot, `deathStyle.turn`; at the
  wall's foot for a slump) and it spreads in `updateBlood` as a volume that flows out ever
  slower (`vol += (rMax² - vol)(1 - e^(-dt/tau))`, `r = √vol`). `rMax` grows with the number
  of wounds (`p.bloodHits`), not the damage: 4.2 units for one round, +1.1 a wound, 9 at most
  for gunfire; +2.2 for an impact or fall, +3.5 for a blast (11.5 at most). `tau` 14.5 s for
  one round, down to 7 s for many, 8 s for an impact or fall, 5 s for a blast (which also
  starts at r 3 and throws a radial spray). A later hit only raises `rMax`/lowers `tau`, never jumps the size.
- Anyone wounded who keeps moving drips a trail of small drops (wounds.js `updateWounds`).
- Wounded-down people (alive, crawling) do not pool; vest-stopped rounds do not bleed;
  poisoned bodies never bleed.

## Data and renderers

- `bloodPools` entries are decals: `{x, y, r, a, variant, stretch, surface, opacity}`, plus
  `rMax/tau/vol` for a spreading pool, `track` for tyre prints (physics-knockdowns.js; tyres
  pick blood up only from pools, r ≥ 2.5). `r` is the visible radius in world units
  (`bloodDecalScale`: 2.5 r across the stamp, × `stretch` along `a`).
- Stamps (`bloodStamp`): variants 0-3 pools (lobed, near black at the centre, a thin redder
  rim, no highlight), 4-7 spatters (a fan of drops along +x from the wound at the left:
  `addBloodSpatter` puts that origin on the point), 8-11 drops (scalloped edge). Landing
  flight drops become drops drawn out by their speed (game-update.js).
- The renderers only read: civic3d.js (size from `bloodDecalScale`, fade `bloodFade`, a
  slow darkening as blood dries) and `drawBlood2D`. The mist is a `mist` particle
  (render3d-frame.js draws it at its height, fading and spreading).
- Bounds: `BLOOD_LIMIT` 240 decals (the oldest non-pool goes first), `BLOOD_LIFE` 240 s.

## For other code

- `bleed(entity, severity, heading, kind)`: severity 0.25 a graze, ~0.5-1 a round, 2 a
  killing blast, max 2.5; `kind` 'ballistic' | 'headshot' | 'blast' | 'impact' | 'fall' |
  'melee'. It counts the wound and pools the body if it is dead. A thrown bike rider or a
  fall calls `bleed(rider, severity, heading, 'impact')`; a pool alone: `bodyPool(p, kind, a)`.
- Console: `bloodReport(x, y, radius)`, `bloodVictim(hits, damage, kind)` (docs/console/crowd.md).
  Test: tools/tests/blood-wounds.mjs.
