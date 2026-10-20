# Apache armament

`apache.js` owns Fort Sentinel's player-only attack helicopter and its loadout;
`apache-guided.js` owns acquisition and missile guidance. The downloaded model reads
the same hardpoints, attitude and ammunition state; it never selects targets or deals damage.

## Controls and ammunition

The visible, remappable **Next aircraft weapon** action defaults to Q. It cycles
30 mm cannon → rocket pods → Hellfire anti-armour → Stinger air targets → cannon.
Its `AircraftWeapon` virtual code is independent of the on-foot/driving `cycleWeapon`
action. Context handling keeps the latter's tank, mounted-gun and personal-weapon
behaviour. A key must be released before another aircraft switch; held keys,
OS repeats and duplicate keydown events do not advance it again. Saved personal
weapon bindings remain intact; aircraft bindings are saved independently.
Older saved controls keep their existing keys. If the new Q default conflicts
with a saved aircraft action, only the new aircraft slot starts unbound; it can
be assigned in Controls. Fresh profiles retain Q.
Swaps are planned before mutation: if displacing another action would create a
third action conflict in another mode, Settings explains the conflict and rejects
the whole swap. Clear a conflicting slot or choose another key; no partial swap
is saved.

Fire/left click releases the selected weapon. Space/right click remains a direct
rocket-pod shortcut regardless of selection. With a gamepad, LB selects the next weapon,
RB fires and B releases rockets; the plane's existing LB/B flap actions coexist in
its own aircraft mode. Touch exposes WEAPON alongside FIRE, and tapping the weapon
chip selects the next aircraft weapon. Hints use the active device and bindings.

| Weapon | Initial rounds | Fire rule | Pad replenishment |
| --- | ---: | --- | --- |
| 30 mm chin gun | 320 | 0.1 s between rounds; traversing turret | 25 rounds/s |
| Rocket pods | 38 | Four-round ripple, 0.13 s apart; cooldown after salvo | One rocket/0.45 s |
| Hellfire anti-armour | 8 | Visible ground vehicle lock, 0.65 s dwell; 1.8 s cooldown | One missile/2.5 s |
| Stinger air targets | 4 | Airborne aircraft lock, 0.45 s dwell; 1.3 s cooldown | One missile/3 s |

The HUD names the selected weapon and its own remaining/capacity count. The
Apache chip wraps long names and lock/cooldown states at compact widths; hover
expands its normal name and binding rows. READY,
WAIT, SEEK TARGET, LOCKING, LOCK, EMPTY and REARMING describe its actual state.
The reticle follows an acquired aircraft's elevation; its pip is green only when
the guided weapon has a lock and ammunition. Land still on any Fort Sentinel pad
to replenish every store. Leaving the pad, moving or climbing pauses replenishment;
rearming blocks firing and clears a pending salvo/lock. The hostile base and finite
stock remain the balance constraints. No AI receives this loadout.

## Target and projectile contracts

Guided selection checks vehicles at most ten times per game second. Acquisition
requires the reticle (or touch aim), forward launch arc, 65–1,400-unit range and a
clear path. Ground mode excludes boats/aircraft; air mode requires an aircraft more
than 20 game units above its landing surface. The lock ray samples `shotBlocked`
at the same seven-unit resolution as the common projectile sweep, including
elevation, overhead cover and Fort walls. Moving the aim or obscuring/removing a
target clears the dwell; holding Fire during acquisition does not restart it.

Every launch consumes its own store and cooldown. Cannon rounds retain
`heavyRound` and explicitly use the existing rifle armour class/heavy gore detail;
rockets/missiles retain `rocket`, `shell`, ownership and crime
reporting. Hellfires also set `antiTank`. `updateBullets` calls the guidance helper
once before its existing swept collision pass. Actual hits therefore retain the
shared `vehicleRoundDamage`, `vehicleArmorShare`, person armour, facade and
`explode` contracts. Another vehicle or wall can intercept a missile.

Guidance turns at a finite rate, checks its existing target's sight every 0.12 s,
and permanently drops that reference on obstruction, death, retirement or excess
range. It never searches for another target during flight. A lost missile follows
its last velocity until collision/expiry. Ground/air missiles expire after at most
4/3.5 seconds; they keep updating after bailout or destruction of the launcher.
Smoke shares this lifetime and is throttled per projectile. Idle/wrecked Apache
locks are cleared by the existing ten-second maintenance check and on boarding.

`APACHE_HARDPOINTS` records downloaded source gun pivot/muzzle, pod fronts and
eight/four missile release slots in nose/right/up game units. Missile slots release
in alternating-side source order. A renderer store is present when its slot index
is at least capacity minus remaining ammunition. `apacheHardpoint` applies the same
pure body pitch/roll/yaw that the renderer reads; `apacheGunMuzzle` also applies the
gun articulation. Source bore rest pitch/yaw are compensated at the hinge, preserving
the source mesh and the shot's muzzle position.

`apache()` reports the selected weapon, all ammunition, lock state and active
Apache projectiles. `apacheAim(x,y)` remains a fixed ground-aim fixture. Switch
weapons through an actual bound key, touch/chip or pad event; holding a virtual
cycle code in `simulate` does not synthesize a fresh key press.

`tools/tests/apache-weapons.mjs` executes the production gameplay, control, settings,
HUD and shared bullet/vehicle-damage functions in a CPU-only host. Run
`node tools/apache-weapons-host-check.mjs --out work/military-combat-review/apache-weapons/host`.
The fixture executes actual blast falloff, visibility and damage dispatch while
isolating effect/audio recipes and mutation callbacks. Rendered appearance, real
device delivery and full-world side effects need the lead's browser QA.

## Downloaded aircraft

Andrew Swihart’s CC BY 4.0 AH-64 replaces the procedural shell.
[Source, pinned download and conversion](../sources/apache/README.md) record the
220,711 retained aircraft triangles, PBR materials and derived air-defense stores.
Only distant/shadow geometry is reduced. Near geometry, articulated hardpoints,
rotor blur, shared resources and BVH raycasts live in `apache-assets3d.js`;
`apache3d.js` reads the same gameplay pose and ammunition state.
