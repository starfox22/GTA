      const J_DROP = 0,
        J_LEAN = 1,
        J_TWIST = 2,
        J_ROLL = 3,
        J_HEAD_PITCH = 4,
        J_HEAD_YAW = 5,
        J_SH = [6, 9],
        J_AB = [7, 10],
        J_EL = [8, 11],
        J_HIP = [12, 14],
        J_KNEE = [13, 15],
        J_FALL = 16,
        J_SPREAD = 17,
        J_LOCO = 18,
        J_ARMFREE = [19, 20],
        J_HOLD = 21, // how far the hands are on a weapon (IK) rather than posed
        J_COUNT = 22;
      const crowdState = new WeakMap(),
        poseTarget = new Float32Array(J_COUNT);
      function stateFor(p) {
        let s = crowdState.get(p);
        if (!s) {
          s = {
            joints: new Float32Array(J_COUNT),
            x: p.x,
            y: p.y,
            yaw: p.a || 0,
            hipYaw: p.a || 0,
            moveYaw: p.a || 0,
            speed: 0,
            phase: Math.random() * TAU,
            turnPhase: 0,
            turning: false,
            seed: Math.random() * 100,
            seen: false,
            holdKind: null,
          };
          s.joints[J_ARMFREE[0]] = s.joints[J_ARMFREE[1]] = 1;
          crowdState.set(p, s);
        }
        return s;
      }
      function setArm(T, side, swing, abduct, elbow) {
        T[J_SH[side]] = swing;
        T[J_AB[side]] = abduct;
        T[J_EL[side]] = elbow;
      }
      /**
       * DANCING
       * Club dancers move to the club's musical clock (`mareaGroove`, beachclub-
       * audio.js): one cycle per beat, a style per person, bigger with the set's
       * energy, and the whole floor jumps with its hands up for a few seconds when
       * the drop lands. Anyone else dancing (the rooftop party, the yacht deck)
       * keeps a steady 120 BPM of their own.
       */
      function crowdDancePose(p, s, T, seed) {
        const club = !!p.club,
          g = mareaGroove,
          beat = club ? g.beat + ((seed * 0.37) % 0.12) - 0.06 : gameTime * 2 + (p.phase || seed),
          ph = beat * TAU,
          e = club ? Math.max(0.2, g.energy) : 0.7,
          on = Math.max(0, Math.cos(ph)),
          half = Math.sin(ph / 2);
        let style = (p.danceStyle ?? Math.floor(seed)) % 7;
        // In a breakdown most people drop to a sway; after the drop, everyone jumps.
        if (club && g.section === 'break' && seed % 3 > 1) style = 3;
        const jump = club && gameTime - g.dropAt < 4 && (seed % 5 > 0.8 || gameTime - g.dropAt < 1.5);
        T[J_LOCO] = 0;
        T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
        // A bounce under everything: knees give on the beat.
        T[J_DROP] = -on * 0.45 * e;
        T[J_KNEE[0]] = T[J_KNEE[1]] = -0.12 - on * 0.4 * e;
        T[J_HIP[0]] = T[J_HIP[1]] = 0.06 + on * 0.2 * e;
        T[J_HEAD_PITCH] = 0.1 * on * e;
        if (jump) {
          const up = Math.max(0, Math.sin(ph));
          T[J_DROP] = up * 2.1 - on * 0.4;
          T[J_KNEE[0]] = T[J_KNEE[1]] = -0.2 - up * 0.5;
          setArm(T, 0, 2.85, 0.35 + up * 0.2, 0.2);
          setArm(T, 1, 2.85, 0.35 + up * 0.2, 0.2);
          T[J_HEAD_PITCH] = -0.3;
          return;
        }
        switch (style) {
          case 0: // bounce with forearms pumping
            setArm(T, 0, 0.55 + on * 0.25 * e, 0.3, 1.45 + on * 0.3);
            setArm(T, 1, 0.55 + on * 0.25 * e, 0.3, 1.45 + on * 0.3);
            break;
          case 1: // fist pump
            setArm(T, 1, 2.35 + Math.sin(ph) * 0.35 * e, 0.2, 0.35 + on * 0.6);
            setArm(T, 0, 0.3, 0.3, 1.3);
            T[J_LEAN] = -0.08;
            break;
          case 2: // hands up, swaying at half time
            setArm(T, 0, 2.7, 0.45 + half * 0.25, 0.35);
            setArm(T, 1, 2.7, 0.45 - half * 0.25, 0.35);
            T[J_ROLL] = half * 0.08;
            T[J_HEAD_PITCH] = -0.2;
            break;
          case 3: // hip sway, loose arms
            T[J_ROLL] = half * 0.1;
            T[J_TWIST] = half * 0.22;
            T[J_HIP[0]] = 0.1 + half * 0.2;
            T[J_HIP[1]] = 0.1 - half * 0.2;
            setArm(T, 0, 0.45 + half * 0.35, 0.35, 1.3);
            setArm(T, 1, 0.45 - half * 0.35, 0.35, 1.3);
            break;
          case 4: {
            // two-step: a step to each side on alternate beats
            const side = Math.floor(beat) % 2,
              lift = Math.max(0, Math.sin(ph)) * e;
            T[J_HIP[side]] = 0.15 + lift * 0.6;
            T[J_KNEE[side]] = -0.2 - lift * 1.0;
            T[J_ROLL] = (side ? 1 : -1) * 0.06;
            setArm(T, 0, 0.4 + (side ? 0.5 : -0.1), 0.35, 1.2);
            setArm(T, 1, 0.4 + (side ? -0.1 : 0.5), 0.35, 1.2);
            break;
          }
          case 5: // waving arms overhead, side to side
            setArm(T, 0, 2.35, 0.95 + half * 0.5, 0.55);
            setArm(T, 1, 2.35, 0.95 - half * 0.5, 0.55);
            T[J_ROLL] = half * 0.12;
            break;
          default: {
            // shuffle: quick alternating heel steps on the eighths
            const q = Math.sin(ph * 2);
            T[J_HIP[0]] = 0.1 + Math.max(0, q) * 0.55 * e;
            T[J_HIP[1]] = 0.1 + Math.max(0, -q) * 0.55 * e;
            T[J_KNEE[0]] = -0.15 - Math.max(0, q) * 0.9 * e;
            T[J_KNEE[1]] = -0.15 - Math.max(0, -q) * 0.9 * e;
            setArm(T, 0, 0.6 - q * 0.5, 0.25, 1.6);
            setArm(T, 1, 0.6 + q * 0.5, 0.25, 1.6);
            T[J_LEAN] = -0.1;
            break;
          }
        }
      }
