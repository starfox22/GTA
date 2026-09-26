      // BEGIN SUBSYSTEM: src/helicopter3d.js — Helicopter models
      /**
       * Helicopter models
       * Source: src/helicopter3d.js
       * Scope: createCityRenderer() closure (included before vehicles3d.js, police3d.js
       * and plane3d.js; nothing here runs before the closure has initialised, so it
       * uses their helpers: the police merging kit, glyph atlas and light shader).
       *
       * Every helicopter except Fort Sentinel's Apache (apache3d.js) is built here, at
       * game scale (8 units to the metre, x forward, y up, z to starboard, the skids or
       * wheels on y = 0). The collision footprint stays the vehicle type's own
       * (vehicleSpec 86 x 34); only the model changed.
       *
       * LOOKS (pickHelicopterLook, cached per vehicle in a WeakMap):
       *   - police: the air unit (c.airUnit) and the machine on the POLICE HQ pad. An
       *     EC120 / H130 class light single (the `colibri` airframe): big bubble
       *     canopy, egg-shaped cabin, the engine cowl behind the three-blade rotor,
       *     a shrouded fenestron fan in the fin and a stabiliser with tall endplates.
       *     Gloss navy-black with a deep blue band edged in gold pinstripes from the
       *     nose along the cabin and the boom; POLICE in big white letters outlined
       *     in blue on both sides, SOUTH COAST over it, the department seal on the
       *     rear doors, N-7SC on the cowl, AIR ONE on the fin, and for the camera
       *     above AIR 1 across the cowl and POLICE along the boom. FLIR ball under
       *     the nose, the Nightsun under the belly (HELI_SEARCHLIGHT_MOUNT), wire
       *     cutters, antennas, red / blue LED strobes on the cabin, nose, boom and
       *     fin tip;
       *   - civil: a Robinson R44 / R66 class four-seater (the `robin` airframe):
       *     a teardrop cabin with a big glazed bubble and roof window, the tall mast
       *     fairing with a two-blade teetering rotor, a slim boom with a two-blade
       *     tail rotor on the left and the V tail (upper and lower fins), tubular
       *     skids. Schemes (HELI_CIVIL_SCHEMES): white with red and blue stripes,
       *     yellow, metallic grey, black with gold; a respray's colour on its own;
       *   - news: the same small airframe in CH 7 NEWS white, red and navy with a
       *     gyro-stabilised camera ball on the chin (the RIVERSIDE pad's, and one
       *     civilian machine in four);
       *   - executive: the small airframe in deep metallic paint with double gold
       *     pinstripes, tan leather and polished skids (one civilian in four);
       *   - military: Fort Sentinel's machines (c.military). A UH-60 Black Hawk class
       *     utility helicopter, scaled into the same footprint: boxy cabin with a
       *     sliding door and gunner windows (M240s on their mounts), twin engines
       *     each side of the rotor pylon with turned-out exhausts, the canted tail
       *     rotor on the starboard side of the tall pylon, the big stabilator,
       *     wheeled main gear and tail wheel, flat olive drab with a black
       *     anti-glare panel, low-visibility U.S. ARMY and serial.
       *
       * CONSTRUCTION (heliKit, once per look; heliPlans for the three airframes):
       *   - the fuselage is one lofted surface (monotone-cubic stations of keel,
       *     crown, widest height, half width and two superellipse exponents). Its
       *     quads are split by the plan's window field (`windows(x, y, z)`, a
       *     signed distance) into painted skin and the flush, transparent canopy:
       *     the bubble, roof and door windows are the fuselage itself;
       *   - the livery is one canvas per look (2048 wide for the police and news)
       *     painted per pixel from the same surface (heliLiveryTexture): paint
       *     scheme, pinstripes, black window seals over the glass edge, door seams,
       *     belly grime and exhaust soot. The bottom quarter holds both faces of the
       *     fin, the cowl (lofted and painted like the fuselage) and flat swatches.
       *     Words, registrations and seals are canvas text and art warped onto the
       *     surface strip by strip (heliPaintWord), so they follow its curves, read
       *     forwards on both sides and char with the paint on a wreck. Only the
       *     Black Hawk's stencils still use glyph quads (heliText);
       *   - inside: a dark liner and floor seen through the glass, instrument
       *     panel with lit screens, seats, sticks, and the crew (pilot on the
       *     right, observer on the left) shown only while somebody flies it;
       *   - trim (skids and arched cross tubes, steps, exhaust, grilles, antennas,
       *     sensors, gear), interior and every lamp lens are each merged into one
       *     vertex-coloured mesh: 10 to 14 draw calls for a whole helicopter.
       *
       * ROTORS: three (police), two (civil) or four (military) blades with twist,
       *   taper, tip paint and droop at rest, on a hub with grips, pitch links and a
       *   swashplate. Spinning up (~4 s) and coasting down (~9 s) follow `m.rpm`; past
       *   half speed the solid blades give way to a translucent disc shaded with
       *   blade ghosts that trail round it (HELI DISC shader), and the blades keep
       *   casting their shadow (a depth-only material), so a faint flicker of blades
       *   crosses the ground. The tail rotor (or the fenestron fan) blurs the same way.
       *
       * LIGHTS: every lens is one mesh on the police light shader with its own
       *   eight channel levels (HELI_CH): red / green / white navigation, double-
       *   flash white strobes, the red anti-collision beacons, landing lights and
       *   the Nightsun lens, the police red / blue pattern (policeLightLevels). Lit
       *   channels queue halos (VEHICLE HALOS) from hidden anchor sprites.
       *
       * ANIMATION (animateHelicopter, from the render3d.js vehicle pass): rotor and
       *   tail spin with the spool, the body pitches with speed and acceleration
       *   (a flare on braking) and banks with the turn rate, a fine vibration rides
       *   on top, the crew appear with a pilot, the Nightsun head turns towards
       *   what the crew are looking at, glass sooting with wear; a wreck's rotor
       *   stops, its disc is gone and its hub sits askew.
       *   helicopterSearchlightMount(c, out) gives the searchlight's lens position in
       *   world space for searchlight3d.js.
       */
      // @include src/helicopter3d-looks.js
      // @include src/helicopter3d-plans.js
      // @include src/helicopter3d-geometry.js
      // @include src/helicopter3d-livery.js
      // @include src/helicopter3d-kit.js
      // @include src/helicopter3d-equipment.js
      // @include src/helicopter3d-model.js
      // @include src/helicopter3d-animate.js
      // END SUBSYSTEM: src/helicopter3d.js
