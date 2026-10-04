# Mounted guns: the LAV-8, the gun jeep and the Black Hawk

`src/mounted-guns.js` (game logic). The tank keeps `armor.js` and the Apache `apache.js`; this file
covers every other military vehicle with a visible gun. Unarmed: the plain jeeps (no `c.gunner`),
the M35 trucks and the fuel bowser, the police helicopter.

## Which vehicle, which gun (`mountedGunKind(c)`, `MOUNTED_GUNS`)

| kind | vehicle | gun | rate | belt / stowed | damage |
| --- | --- | --- | --- | --- | --- |
| `apc` | every `apc` (the turret is always modelled) | 25 mm cannon, `heavyRound` (apacheRoundImpact splash) | 0.3 s | 210 / 420, 14 s reload | 40 |
| `apc` | | coax MG 7.62 | 0.085 s | 400 / 1200, 6 s | 20 |
| `jeep` | `jeep` with `c.gunner` (the ring mount) | M2 .50 cal | 0.109 s | 100 / 500, 6 s | 34 |
| `heli` | `helicopter` with `c.military`, not the Apache, not `airUnit` | M240H door gun, one per side | 0.08 s | 200 / 600 per gun, 5 s | 20 |

Traverse: LAV turret 60 deg/s (`traverseTurret`, armor.js), the jeep's hand-swung ring 90 deg/s, the
door guns 150 deg/s inside `DOOR_GUN_ARC` (20-160 deg off the nose each side; the other gun rests at
`DOOR_GUN_REST`). Rounds are tank-proof (`bulletDamagesVehicle`).

## Contracts and gotchas

- State lives on the vehicle: `c.arms` (`mounted: kind`, `weapon`, `guns[]` with belt, stowed, `loadAt`,
  `fired`; the door guns' `rel` angles off the nose and the active `side`), plus the tank's own fields
  `turretA`, `turretRate`, `turretAim`, `gunAim`, `cannonRecoilUntil`. No new vehicle fields.
- The renderer only reads: `render3d-frame.js` turns any model with `m.tank` (APC, gun jeep) by
  `c.turretA` and recoils `m.barrel` by `cannonRecoilUntil`; `animateHelicopter` swings
  `m.doorGuns[i]` by `c.arms.rel[i]` (the pivots come from `kit.doorGuns`, heliHawkEquipment).
- Muzzle offsets in `MOUNTED_GUNS` (`pivot`, `muzzle`, `side`, `height`) and `DOOR_GUN_MOUNT` match the
  models in base3d-vehicles.js (design units x `modelScale`) and helicopter3d-equipment.js: move
  them together.
- Bullets are drawn 9 units over their altitude, so a round leaves at `height - 9` and the flash
  (`city3D.fire(..., base, height)`) sits at the muzzle; the brass falls to that base.
- Hooks: `shoot()` and `startReload()` (game-player-actions.js), `cycleWeapon()` (citylife-places.js),
  the weapon button (arsenal.js), `updateUI`/`drawWeapon` (game-ui.js), `updateTankReticle`
  (armor.js), `enterVehicle` hints, god mode's refill (`mountedGunRearm`), the touch weapon button
  for the LAV only (mobile.js). Heat: `notifyViolence` + `crime(0.075)` every `heatEvery` rounds.
- Not drawn in the 2D fallback (only the tank's turret is).

Console: `mountedGuns()`, `driveArmed(kind)`, `mountedGunAim(x, y)`, `mountedGunTargets(distance, deg)`
(docs/console/police.md); test tools/tests/mounted-guns.mjs.
