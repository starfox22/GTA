      // Player body grips: where the player's own hands go on each weapon (weapon space): the firing hand round the
      // grip with the trigger finger along the guard, the support hand cupped under a pistol or under the handguard.
      /**
       * GRIPS (weapon space: the firing grip at the origin, the muzzle +x, up +y, right +z; rig units, the weapons'
       * WEAPON_SCALE included). The hand's gripping shape (pbGripShape) closes round a cylinder along the hand's x
       * (the knuckle line) at PB_FIST in hand space: so a grip is that cylinder's axis and a point on it, and the
       * hand's frame follows: x up the grip (index finger at the top), the palm against the grip from its side,
       * the fingers round its front. `fire` is the firing grip (angle from vertical, raked back; `at` the grip's
       * middle, `along` how far up it the fist sits), `support` the other hand: `cup` (round the firing hand, a
       * two-handed pistol), `under` (palm up under a handguard, thumb forward), `vertical` (a front grip).
       */
      const PB_FIST = [0, -0.088, -0.03];
      const PB_GRIPS = {
        pistol: { fire: { angle: 0.28, at: [-0.12, -0.408], along: 0.12 }, support: { kind: 'cup' }, trigger: true },
        smg: { fire: { angle: 0.26, at: [-0.06, -0.408], along: 0.12 }, support: { kind: 'under', at: [1.62, 0.096] }, trigger: true },
        shotgun: { fire: { angle: -1.0, at: [-0.62, 0.02], along: 0 }, support: { kind: 'under', at: [3.36, 0.1] }, trigger: true },
        rifle: { fire: { angle: 0.3, at: [-0.06, -0.36], along: 0.12 }, support: { kind: 'under', at: [3.0, 0.27] }, trigger: true },
        sniper: { fire: { angle: 0.3, at: [-0.096, -0.36], along: 0.12 }, support: { kind: 'under', at: [2.28, 0.04] }, trigger: true },
        rocket: { fire: { angle: 0.25, at: [-0.06, -0.12], along: 0.1 }, support: { kind: 'vertical', at: [2.16, -0.1] }, trigger: true },
        knife: { fire: { angle: -Math.PI / 2, at: [0.02, 0], along: 0 }, support: null, trigger: false },
      };
      /* A hand's frame (weapon space) gripping round `axis` through `centre`, its palm normal along -side·zAxis. */
      function pbGripMatrix(out, axis, zAxis, centre, side) {
        const x = axis,
          z = zAxis,
          y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]],
          // The fist's centre in this hand's space (the left hand is the right one mirrored across z).
          fy = PB_FIST[1] * PB_UNITS,
          fz = (side ? PB_FIST[2] : -PB_FIST[2]) * PB_UNITS,
          w = [0, 1, 2].map((k) => centre[k] - y[k] * fy - z[k] * fz);
        return out.set(x[0], y[0], z[0], w[0], x[1], y[1], z[1], w[1], x[2], y[2], z[2], w[2], 0, 0, 0, 1);
      }
      const pbGripCache = new Map();
      /* { fire: [left hand, right hand] frames, support: the left hand's frame or null, inverse: of the right's } */
      function pbGripsFor(weapon) {
        let g = pbGripCache.get(weapon);
        if (g) return g;
        const spec = PB_GRIPS[weapon] || PB_GRIPS.pistol,
          f = spec.fire,
          axis = [-Math.sin(f.angle), Math.cos(f.angle), 0],
          centre = [f.at[0] + axis[0] * f.along, f.at[1] + axis[1] * f.along, 0],
          up = [0, 0, 1];
        g = {
          fire: [pbGripMatrix(new Three.Matrix4(), axis, up, centre, 0), pbGripMatrix(new Three.Matrix4(), axis, up, centre, 1)],
          support: null,
          inverse: null,
          trigger: spec.trigger,
        };
        const s = spec.support;
        if (s?.kind === 'cup')
          // Over the firing hand's fingers from the left, a little forward and lower.
          g.support = pbGripMatrix(new Three.Matrix4(), axis, up, [centre[0] + 0.06, centre[1] - 0.07, -0.27], 0);
        else if (s?.kind === 'under') g.support = pbGripMatrix(new Three.Matrix4(), [1, 0, 0], [0, 1, 0], [s.at[0], s.at[1], 0], 0);
        else if (s?.kind === 'vertical') g.support = pbGripMatrix(new Three.Matrix4(), [0, 1, 0], up, [s.at[0], s.at[1], 0], 0);
        g.inverse = g.fire[1].clone().invert();
        pbGripCache.set(weapon, g);
        return g;
      }
