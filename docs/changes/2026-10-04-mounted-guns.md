# Military vehicles' mounted guns
- The LAV-8 armoured carrier fires its turret: a 25 mm cannon (200 rounds a minute, 210 ready + 420
  stowed, high-explosive rounds that burst where they strike) and a coaxial 7.62 mm MG (400-round
  belts, 1,600 in all); the weapon switch swaps them, the right mouse button fires the coax.
- Fort Sentinel's gun jeeps fire their ring-mounted M2 .50 cal (about 550 a minute, 100-round boxes, 600 in all).
- The Black Hawk's two M240H door guns fire, each through its own side window (20-160 deg off the
  nose), down to the ground point under the mouse; 200-round belts and 600 more per gun.
- As in the tank: the turret (or the door gun) traverses toward the aim at its real rate and the
  rounds go where the barrel points; the reticle, the weapon chip (rounds, stowage, LOADING), muzzle
  flash, tracers every fifth round (every 25 mm round), brass, barrel recoil and camera kick; an
  empty belt is changed by itself and the reload key changes a part-used one. Touch and pad fire
  through the FIRE button; the weapon button switches the LAV's guns.
- The jeep's M2 and the LAV's turret gained a little detail (receiver, grips, muzzle brake, the coax);
  the Black Hawk's door guns now swing on their mounts.
- Console: `mountedGuns()`, `driveArmed(kind)`, `mountedGunAim(x, y)`, `mountedGunTargets(distance, deg)`;
  test tools/tests/mounted-guns.mjs.
