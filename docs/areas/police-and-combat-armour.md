# NPC body armour and shots to kill

How many rounds put someone down (combat-rules.js NPC BODY ARMOUR, `ballisticDamage`). Part of
police-and-combat.md. The player's own armour (`player.armor`) is not this: it keeps `VEST_SHARE`.

## The rule

- Damage is `dmg × BALLISTIC_LETHALITY` (2.05). Unarmoured: civilians (30 hp) drop to any round,
  gang members and guards (80-85 hp) to two 9mm or rifle rounds, three from the machine pistol.
- A vest covers the **torso only**: the hit zone is chosen in `strikePerson` first
  (wounds.js `pickHitZone`: head 12 %, torso 58 %, legs 30 %) and a head or leg round goes round it.
  gore.js `goreHit` may change it: a point-blank load keeps its first pellet's zone, and a torso
  load within ~5 m (or a .50) catches the arm held in front 30 % of the time (zone `arm`, no vest).
- `vest` points are the vest's integrity; `vestPlate` says what it is. Soft (concealable: patrol
  and road officers, Vescari) or plate (SWAT, agents, soldiers, marksmen, the Fort Sentinel garrison).
  `VEST_STOP[class][calibre]`: `stop` is the share of a torso round the vest takes (the rest is the
  blunt hit through it), `wear` the vest points each absorbed point costs.
  Soft: handgun 0.85, buckshot 0.9, rifle 0.2. Plate: handgun 0.9, buckshot 0.92, rifle 0.75.
- Calibre (`bulletCalibre(b)`): the player's weapon table `cal` (9mm and machine pistol
  `handgun`, shotgun `buck`, assault and precision rifles `rifle`); officers with `rifle`,
  soldiers and marksmen fire rifle rounds; everyone else handgun rounds. `strikePerson(person,
  damage, a, source, showBlood, kind, calibre)` takes it as its last argument.
- A round the vest took 60 % or more of (`VEST_STOPPED`) sparks and opens no wound: no blood,
  no limp, no trail; it still flinches and staggers.
- No knock-back: a round never moves anyone (`strikePerson` shoves only for a blast;
  `chooseDeathFall` takes no step for a round and slumps only against a wall within 9 units).
  The blood goes instead: the exit spray (police-and-combat-blood.md).

## Torso hits to put someone down (`shotsToKill()`)

| Weapon | civilian | gang | patrol (soft 40) | patrol 4★ (soft 60) | SWAT (plate 120) | fed / soldier (plate 90) | garrison (plate 110) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 9mm pistol | 1 | 2 | 3 (was 2) | 4 (was 3) | 7 (was 5) | 5 (was 4) | 6 (was 4) |
| machine pistol | 1 | 3 | 5 (4) | 6 (5) | 11 (7) | 8-9 (6) | 10 (7) |
| pump shotgun (load) | 1 | 1 | 2 (1) | 2 (1) | 3 (1) | 2 (1) | 3 (1) |
| assault rifle | 1 | 2 | 2 (2) | 2 (3) | 4 (4) | 3 (3) | 4 (4) |
| precision rifle | 1 | 1 | 1 | 1 | 2 | 1 | 2 |

Leg and head rounds skip the vest, so in play an armoured target takes fewer than the table on
average. Mission 2's Vescari (84 hp, soft 40) stays at three 9mm torso rounds, two from a rifle.
Mission 1's warehouse officers are patrol officers (three torso rounds, two in the legs).

## Gotchas

- `vestStoppedShare` is what the last `ballisticDamage` call's vest took; read it straight after.
- A new armoured NPC sets `vest` (and `vestPlate: true` for plates) where it is made; a new
  weapon sets `cal`; a new NPC gun with rifle rounds sets `cal: 'rifle'` on its bullets or `rifle` on the owner.
- Console: `shotsToKill()`, `strikeTest(role, weaponIndex, distance, zone)` (docs/console/police.md).
  Test: tools/tests/bullet-hits.mjs.
