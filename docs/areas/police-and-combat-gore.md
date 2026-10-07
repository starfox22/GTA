# Gore: heavy hits, lost limbs, wounds on the clothes

What a hit does to a body beyond its health and the ground's blood (gore.js rules and state, gore-props.js severed
pieces, crowd3d-gore.js and player-body3d.js draw it). Part of police-and-combat.md; the blood on the ground is
police-and-combat-blood.md. Settings · Gameplay · Gore: FULL (default) or REDUCED (no dismemberment, about half the
blood, no bursts).

## Every hit: class, range, zone (goreHit)

- strikePerson asks `goreHit(person, zone, kind, calibre, source, detail, a, damage)` first. Class: `handgun`,
  `rifle` (rifle calibre or a precision headshot), `buck`, `heavy` (a .50 or 25 mm round: bullets carry `goreCal`,
  mounted-guns.js `gore: 'heavy'`), `blast`, `other` (impacts, falls, blades, punches). Range: the shooter's
  distance, or `detail.range` (explode passes it with `power`); none known is 15 m.
- `close` (0..1, smooth): buck 1 within 3 m to 0 at 7 m (GORE_BUCK_FULL / NONE); rifle 2-6 m; heavy 25-90 m; blast
  2.5-6 m x power; a pistol only at contact range (half weight).
- `scale` (bloodShotPlan's): pistol 1, rifle 1.6 (+40 % close), .50 2.8; a shotgun pellet 0.55, but the FIRST
  pellet of a load (pellets within 0.08 s from one shooter: `p.goreLoad`) carries the whole load at close range
  (0.55 x (1 + 5 close) x (1 + 0.5 close), ~5 at point blank) and later ones less (pellets after the target
  died never arrive: strikePerson ignores the dead). Head 1.3, a limb 0.8; past 40 m 0.85. REDUCED halves it, at
  most 1.2.
- A point-blank load keeps its first pellet's zone (the pattern is still one mass). A torso load within ~5 m
  or a heavy round catches the arm held in front 30 % of the time (GORE_ARM_SHARE): zone `arm`, outside the vest.

## What comes off (FULL only)

| Class | Takes | Chance |
| --- | --- | --- |
| buck | the head; a leg (shin 60 %, whole 40 %); an arm (forearm 60 %, whole 40 %), the side facing the shooter | 1 within 3 m, then 0.9 x close^1.5 |
| buck torso | nothing comes off; the chest is destroyed (fatal) within ~4 m (close > 0.6) | |
| heavy | the head always; a limb 60 % | any range |
| rifle | the head, only a precision round (damage 90+), chance = close (~6 m) | |
| blast | up to two limbs (0.45 x close^1.2 each), the head 0.18 x close^2 | |

- A head or a destroyed chest kills (`goreFatal`: nobody left crawling). A limb: a survivor goes down where they
  stand (`woundedDown`, hp 7, police `downed`) and bleeds out in 7-13 s (`goreBleedOut`), then dies as an impact
  (`strikePerson(..., 'impact')`, a bigger pool) and the kill is the shooter's (`goreSource`). Medics never revive
  anyone who lost a part.
- No knock-back: a round still never moves anyone (police-and-combat-armour.md); only a blast throws the body.
- The player loses parts only when a blast kills him (explode -> `goreBlastDeath`); WASTED's respawn
  (`goreRestore`) makes him whole and his clothes clean; bought health (hp 100) cleans them too.

## State and lists (game side; renderers only read)

- On a person: `goreLost` bits (GORE_HEAD 1, GORE_ARM [2, 4], GORE_FOREARM [8, 16], GORE_LEG [32, 64],
  GORE_SHIN [128, 256]; index 0 left, 1 right; a whole limb implies its lower part), `goreVersion` (bumped on any
  change and while a stain spreads: the still figures re-record), `goreWounds` (at most 6: `zone`, `h` 0..1 along
  it, `rel` the entry round the body, `side`, `size` rig units, `exit`, `t`).
- `goreStumps` (16): arterial spurts, a beat every 0.6-1.2 s that weakens, until the bleed-out or 3.5 s after
  death (`goreJointPoint`: the cut on a standing, falling or lying body). `goreTracked` (64), `goreEvents` (a ring
  of 16 the renderer turns into bone chips and a dark mist, fxBit/fxPuff), `severedParts` (24, gore-props.js:
  tumbling, bouncing off walls, at rest lying flat, a drop or two of blood; retired with their body (gone from its
  list), after BLOOD_LIFE, or when the owner is whole again). All listed in `soakReport()`; `resetGore()` on a
  new game (populate). People are not saved, so neither is any of this.
- Randomness: `goreRandom` (its own xorshift, `goreSeed`): blood and gore never draw on the seeded game stream.

## Drawing it (crowd3d-gore.js, player-body3d.js)

- drawCrowdPerson leaves out the lost parts and draws `P.stump` at the cut (neck, shoulder, elbow, hip, knee):
  one instanced part on the rig's body material (no new program): a ragged sleeve in the lost part's own colour,
  the skin's edge, raw flesh, torn lumps and the bone. Severed pieces are the owner's own parts at the piece's
  pose with a stump at the cut end (their look from the owner's last draw, `s.goreLook`). One draw call (and one
  shadow call) whenever any stump or piece is on screen; pieces add instances to the body parts' own draws.
- WOUNDS on the rig: `crowdWound` (vec4 per instance on every rigPart: the entry in the part's space, w = 2 + the
  stain's reach, +100 when it went through) soaks the cloth or skin dark red in the paint shader (PAINT SHADER
  WOUNDS; the near set inherits it). The attribute is uploaded only on frames a part has a wounded instance and
  the frame after.
- The player's own body: `pbLost` folds a lost part's vertices (by `pbSkin.w`) onto the cut (`pbCut`), where the
  crowd's stump stands; `pbWound[4]` (bind metres) soaks his tee, jeans or skin; wet blood is glossier.

## Checks

tools/tests/gore-dismember.mjs (point blank severs and the state says so, range and pistols do not, a .50 takes the
head, pieces come to rest, a maimed survivor bleeds out, REDUCED severs nothing, caps hold) and
tools/tests/blood-amounts.mjs (the plan grows by zone, calibre and closeness; walls and parked cars only within the
spray's reach). Console: docs/console/crowd.md (gore).
