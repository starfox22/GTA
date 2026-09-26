      // Crowd 3D poses for mission 2 (the Blue Hour): Vescari's poisoned toast beat by beat, and the bodyguards' heads turning with their sight cones.
      /* Called from crowdPoseTargets for anyone tagged 'rooftop-hit', after the
         base pose and before holds, flinches and the fall. The beats and their
         lengths are roofmission-poison.js (POISON_BEATS): `p.poisonPose` is the
         beat and `p.poisonT` how far through it (0-1); `p.poisonCollapse` drives
         the fall itself (crowdPoseTargets' J_FALL). The right hand holds the
         glass while `p.drinking` (crowd3d-special.js adds the cocktail). */
      const partyEase = (x) => x * x * (3 - 2 * x),
        partyMix = (a, b, k) => a + (b - a) * k;
      function roofPartyPose(p, T, t) {
        if (p.guard) {
          // The head follows the cone (roofGuardView = heading + look); map angles
          // turn the other way to the rig's yaw.
          if (!p.aiming && p.pose !== 'phone') T[J_HEAD_YAW] = -clamp(p.look || 0, -1.1, 1.1);
          return;
        }
        if (!p.boss || !p.poisonPose) return;
        const k = clamp(p.poisonT || 0, 0, 1);
        T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
        switch (p.poisonPose) {
          case 'reach': {
            // Leaning over the table for the glass, then bringing it in to the chest.
            const out = partyEase(Math.min(1, k / 0.55)),
              back = partyEase(clamp((k - 0.55) / 0.45, 0, 1));
            setArm(T, 1, partyMix(partyMix(0.1, 1.2, out), 0.5, back), 0.12, partyMix(partyMix(0.2, 0.3, out), 1.55, back));
            T[J_LEAN] = -0.28 * out * (1 - back);
            T[J_HEAD_PITCH] = 0.35 * (1 - back);
            T[J_LOCO] = 0;
            break;
          }
          case 'toast': {
            // The glass raised to the table: out and up, a small lift at the top.
            const up = partyEase(Math.min(1, k / 0.45)),
              down = partyEase(clamp((k - 0.7) / 0.3, 0, 1));
            setArm(T, 1, partyMix(0.5, 1.6 + Math.sin(k * Math.PI) * 0.1, up) * (1 - down) + 1.0 * down, 0.15, partyMix(partyMix(1.55, 0.85, up), 2.3, down));
            setArm(T, 0, 0.35, 0.45, 0.7);
            T[J_HEAD_PITCH] = -0.1;
            T[J_LOCO] = 0;
            break;
          }
          case 'sip':
            // At the lips, the head tipping back as he drinks.
            setArm(T, 1, 1.05, 0.2, 2.45);
            setArm(T, 0, -0.1, 0.35, 1.2);
            T[J_HEAD_PITCH] = -0.32 * Math.sin(k * Math.PI);
            T[J_LEAN] = 0.06 * Math.sin(k * Math.PI);
            T[J_LOCO] = 0;
            break;
          case 'lower': {
            const e = partyEase(k);
            setArm(T, 1, partyMix(1.05, 0.45, e), 0.2, partyMix(2.45, 1.55, e));
            setArm(T, 0, -0.1, 0.35, 1.2);
            break;
          }
          case 'beat':
            // Talking again, the glass at his chest, the free hand making a point.
            setArm(T, 1, 0.45, 0.2, 1.55);
            setArm(T, 0, 0.45 + Math.sin(t * 2.2) * 0.12, 0.35, 1.1);
            break;
          case 'cough': {
            // Hacking coughs into his fist: a jolt forward with each.
            const beats = [0.05, 0.38, 0.62, 0.85];
            let jolt = 0;
            for (const at of beats) {
              const x = ((k - at) * POISON_BEATS.cough) / 0.09;
              jolt = Math.max(jolt, Math.exp(-x * x));
            }
            setArm(T, 0, 1.2, -0.45, 2.45);
            setArm(T, 1, 0.35, 0.25, 1.4);
            T[J_LEAN] = -0.18 - jolt * 0.28;
            T[J_HEAD_PITCH] = 0.2 + jolt * 0.25;
            T[J_LOCO] = 0;
            break;
          }
          case 'clutch': {
            // Both hands to the throat (the glass slips from the right at 0.3),
            // head back, trembling; the right hand moves to the chest.
            const grab = partyEase(Math.min(1, k / 0.3)),
              chest = partyEase(clamp((k - 0.6) / 0.4, 0, 1));
            setArm(T, 0, partyMix(1.2, 1.0, grab), partyMix(-0.45, -0.5, grab), partyMix(2.45, 2.55, grab));
            setArm(
              T,
              1,
              partyMix(partyMix(0.35, 1.0, grab), 0.65, chest),
              partyMix(partyMix(0.25, -0.5, grab), -0.55, chest),
              partyMix(partyMix(1.4, 2.5, grab), 1.9, chest),
            );
            T[J_HEAD_PITCH] = -0.35 * grab;
            T[J_LEAN] = -0.05;
            T[J_ROLL] = Math.sin(t * 23) * 0.03 * grab;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.12 * grab;
            T[J_LOCO] = 0;
            break;
          }
          case 'stagger':
            // Unsteady steps back, weaving, knees going.
            setArm(T, 0, 0.95, -0.5, 2.5);
            setArm(T, 1, 0.6, -0.55, 1.9);
            T[J_ROLL] = Math.sin(t * 5) * 0.14;
            T[J_LEAN] = -0.15 + Math.sin(t * 3.3) * 0.12;
            T[J_HEAD_PITCH] = 0.15 + Math.sin(t * 4.1) * 0.15;
            T[J_KNEE[0]] = -0.25 - Math.max(0, Math.sin(t * 5)) * 0.25 - k * 0.2;
            T[J_KNEE[1]] = -0.25 - Math.max(0, -Math.sin(t * 5)) * 0.25 - k * 0.2;
            T[J_DROP] = -0.5 - k * 0.6;
            break;
          case 'buckle': {
            // The knees give way; a hand goes out to the floor.
            const e = partyEase(k);
            T[J_DROP] = -3.05 * e;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.45 - 1.1 * e;
            T[J_HIP[0]] = T[J_HIP[1]] = 0.05 + 0.25 * e;
            T[J_SPREAD] = 0.1 * e;
            T[J_LEAN] = -0.15 - 0.3 * e;
            T[J_HEAD_PITCH] = 0.2 + 0.3 * e;
            T[J_ROLL] = Math.sin(t * 3) * 0.06 * (1 - e);
            setArm(T, 0, 0.6, -0.5, 1.9);
            setArm(T, 1, partyMix(0.6, 0.75, e), partyMix(-0.55, 0.3, e), partyMix(1.9, 0.25, e));
            T[J_LOCO] = 0;
            break;
          }
          case 'faint': {
            // Over he goes; the kneel unfolds into lying on his back, arms slack.
            const e = partyEase(k);
            T[J_DROP] = -3.05 * (1 - e);
            T[J_KNEE[0]] = partyMix(-1.55, -0.6, e);
            T[J_KNEE[1]] = partyMix(-1.55, -0.3, e);
            T[J_HIP[0]] = partyMix(0.3, 0.35, e);
            T[J_HIP[1]] = partyMix(0.3, 0.1, e);
            T[J_SPREAD] = 0.1 + 0.15 * e;
            T[J_LEAN] = -0.45 * (1 - e);
            T[J_HEAD_PITCH] = 0.5 * (1 - e);
            T[J_HEAD_YAW] = 0.4 * e;
            setArm(T, 0, partyMix(0.6, 0.35, e), partyMix(-0.5, 1.0, e), partyMix(1.9, 0.35, e));
            setArm(T, 1, partyMix(0.75, -0.15, e), partyMix(0.3, 0.55, e), partyMix(0.25, 0.5, e));
            T[J_LOCO] = 0;
            break;
          }
          default:
            break;
        }
      }
