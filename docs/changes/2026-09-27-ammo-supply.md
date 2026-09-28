# Guns come from shops, bodies and police cars
- No more ammunition, armour or weapon pickups on the street; health pickups stay.
- Gun shops (SOUTH COAST ARMORY in Northbank, the county OUTFITTERS) are where ammo and body armour are bought: the door prompt says GUNS, AMMO & ARMOR.
- Stand over the body of someone who carried a gun and press the action key: a short crouch takes their weapon and what they had (a cop's 9 mm and a magazine or two, a gangster's SMG with what is left, a SWAT rifle). Once per body; nothing lies on the ground.
- Getting into a police car takes its box of 9 mm; a SWAT van or FBI SUV its rifle or SMG magazines and shotgun shells. Once per vehicle, with a line saying what you got.
- Gang members, mission gunmen and the rooftop guards no longer shoot you from off screen: like the police and the army, they close in but fire only once they are in view.
- The on-foot camera starts one zoom step further out; vehicles frame as before.
- The mission card and start headline read MISSION 1, MISSION 2 (no total).
- Internals: ammo-supply.js; `shooterInView` uses the camera's exact ground footprint (`screenViewHalf`) round `cameraTarget` in a vehicle too.
- Console: `ammoSupply()`, `setAmmo`, `armedBody`, `parkLawVehicle`, `hostileGunman`, `missionCard()`. Test: tools/tests/ammo-supply.mjs.
