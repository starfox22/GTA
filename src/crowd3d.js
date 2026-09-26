      // BEGIN SUBSYSTEM: src/crowd3d.js — Instanced people: skeleton, gait, poses, weapons and street props
      /**
       * Instanced people: skeleton, gait, poses, weapons and street props
       * Source: src/crowd3d.js
       * Scope: renderer closure (inside createCityRenderer).
       *
       * Everyone on foot is drawn here from the shared body parts of
       * character-rig3d.js: pedestrians, and (`updateCrowd3D`'s `specials`) the
       * player, officers, SWAT, agents, soldiers, gangs, guards and mission
       * characters, each with an outfit (`specialLook`) and what they hold
       * (`specialSpec`). A street of a hundred people costs the same few dozen
       * draw calls as a street of five. Each frame the visible people are
       * packed into the instance buffers with a matrix per part, built from a
       * small skeleton:
       *
       *   root (feet, heading, fall) → hips → torso → head
       *                                        ↘ shoulders → elbows → hands
       *                  hips → thighs → knees → ankles
       *
       * Poses are layered. The base pose (standing, cowering, hands up, on the
       * phone, sitting, dancing...) comes from `person.pose` and is eased joint
       * by joint. The gait layer is driven by how far the person actually moved:
       * each foot is planted for the stance part of its cycle and carried
       * forward in an arc for the swing (two-bone IK for hip and knee), the
       * pelvis rises and falls over the planted leg, the arms swing against the
       * legs, and the body leans into a run. The upper body turns to where the
       * person faces while the hips follow the direction of travel (strafing,
       * backing away); standing, the feet step round in place when the body
       * turns far enough. Weapon holds are placed in an aim frame and both hands
       * reach them by IK: a pistol in a two-hand grip, a rifle shouldered, a
       * rocket tube on the shoulder, with recoil and a reload.
       *
       * Level of detail: hands, props and the face read only up close; zoomed
       * far out, someone simply standing or walking becomes a three-instance
       * figure (body and two legs).
       */
      // @include src/crowd3d-parts.js
      /**
       * BODY SETS
       * The body parts are built twice: a close-up set at full detail and a
       * street set with about half the facets (for the zooms people are played
       * at, where a head is a few pixels across). Only one set is drawn in a
       * frame, so the draw calls do not double.
       */
      // @include src/crowd3d-bodies.js

      /**
       * LOOKS
       * A look (crowd.js dressPerson, or `specialLook` below) is compiled once
       * into parts and paints: body shape (female / male, kid), height and
       * build, the garment on each part, hair, hat, footwear and kit. Fields
       * the game changes later (a fan's shirt turning into the team kit, a
       * vendor's hat) recompile it.
       */
      // @include src/crowd3d-looks.js

      /**
       * JOINTS
       * Index into a person's joint array. Swings are about the body's lateral
       * axis (positive brings a limb forward), abductions lift an arm out to the
       * side, knees and elbows bend (knees negative, elbows positive).
       */
      // @include src/crowd3d-joints.js
      /* Base pose targets. `side` 0 is left, 1 is right. */
      // @include src/crowd3d-poses.js

      /**
       * HOLDS
       * Where a weapon sits in the aim frame (origin at the hips, x along the aim,
       * y up, z to the right; reference-person units) for each stance, and how
       * the upper body turns for it.
       */
      // @include src/crowd3d-draw.js

      /**
       * SPECIAL CHARACTERS
       * What the player, officers, soldiers, gangs and mission characters hold
       * and how, from game state; read by drawCrowdPerson. One scratch spec,
       * filled per person just before they are packed.
       */
      // @include src/crowd3d-special.js
      // @include src/crowd3d-frame.js
      // END SUBSYSTEM: src/crowd3d.js
