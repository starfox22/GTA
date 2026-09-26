      // Crowd 3D pose targets and IK for arms and legs (crowdPoseTargets, solveLeg).
      function crowdPoseTargets(p, s, T, t, spec) {
        T.fill(0);
        const seed = s.seed,
          stoop = p.look?.stoop || 0;
        T[J_LEAN] = -stoop;
        T[J_HEAD_PITCH] = stoop * 0.6;
        setArm(T, 0, 0.02, 0.12, 0.16);
        setArm(T, 1, 0.02, 0.12, 0.16);
        T[J_KNEE[0]] = T[J_KNEE[1]] = -0.04;
        T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 1;
        T[J_LOCO] = 1;
        // Idle life: weight shifts and the odd look around.
        const sway = Math.sin(t * 0.55 + seed);
        T[J_ROLL] = sway * 0.025;
        T[J_HIP[0]] = sway * 0.04;
        T[J_HIP[1]] = -sway * 0.04;
        T[J_KNEE[sway > 0 ? 1 : 0]] = -0.04 - Math.abs(sway) * 0.1;
        T[J_HEAD_YAW] = Math.sin(t * 0.31 + seed * 2) * Math.max(0, Math.sin(t * 0.13 + seed)) * 0.7;
        if (p.hp <= 0) {
          // The dead lie still: none of the idle life above.
          T.fill(0);
          T[J_LOCO] = 0;
          T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
          T[J_HEAD_YAW] = 0;
          const k = seed % 1;
          if (p.deathStyle?.slump) {
            // Slid down a wall: sitting, legs out, head dropped, arms slack.
            T[J_FALL] = 0;
            T[J_DROP] = -5.2;
            T[J_HIP[0]] = T[J_HIP[1]] = 1.45;
            T[J_KNEE[0]] = -0.25 - k * 0.5;
            T[J_KNEE[1]] = -0.1;
            T[J_SPREAD] = 0.3;
            T[J_LEAN] = 0.35;
            T[J_ROLL] = (k - 0.5) * 0.4;
            T[J_HEAD_PITCH] = 0.75;
            setArm(T, 0, 0.15, 0.4, 0.2);
            setArm(T, 1, 0.3, 0.2 + k * 0.4, 0.4);
            return;
          }
          T[J_FALL] = 1;
          if ((p.deathStyle?.sign ?? 1) < 0) {
            // Face down: arms thrown forward, one leg drawn up.
            setArm(T, 0, 2.6 - k * 0.6, 0.5, 0.3);
            setArm(T, 1, 1.6 + k * 0.8, 0.9, 0.6);
            T[J_HIP[1]] = 0.7 * k;
            T[J_KNEE[1]] = -1.1 * k;
          } else {
            // On the back: arms flung, a knee bent, the head rolled aside.
            setArm(T, 0, 0.4, 1.1 + k * 0.6, 0.3);
            setArm(T, 1, -0.2, 0.3 + k, 0.6);
            T[J_HIP[0]] = 0.3 * k;
            T[J_KNEE[0]] = -0.7 * k;
            T[J_KNEE[1]] = -0.5 * k;
          }
          T[J_SPREAD] = 0.25;
          T[J_HEAD_YAW] = (k - 0.5) * 1.2;
          return;
        }
        let pose = spec?.pose || p.pose;
        if (p.ejected) pose = 'thrown';
        else if (p.exercise != null) pose = 'exercise';
        else if (p.dancing) pose = 'dance';
        else if (p.onPhone && !pose) pose = 'phone';
        else if (p.sitting && !pose) pose = 'sit';
        if (p.glanceUntil > gameTime) T[J_HEAD_YAW] = Math.sin((p.glanceUntil - gameTime) * 7) * 0.8;
        // Carried things decide what the right arm does while walking.
        const carry = p.carry;
        if (carry === 'briefcase' || carry === 'shopping' || carry === 'handbag') {
          setArm(T, 1, 0, 0.14, 0.08);
          T[J_ARMFREE[1]] = 0.35;
        } else if (carry === 'coffee' || carry === 'food') {
          setArm(T, 1, 0.35, 0.15, 1.55);
          T[J_ARMFREE[1]] = 0.1;
        } else if (carry === 'camera') {
          setArm(T, 1, 0.3, 0.1, 1.2);
          T[J_ARMFREE[1]] = 0.2;
        }
        if (s.umbrella) {
          setArm(T, 1, 0.75, 0.05, 1.7);
          T[J_ARMFREE[1]] = 0;
        }
        const shiver = Math.sin(t * 31 + seed);
        switch (pose) {
          case 'run':
            T[J_LEAN] = -0.2 - stoop;
            setArm(T, 0, 0.1, 0.12, 1.4);
            setArm(T, 1, 0.1, 0.12, 1.4);
            T[J_HEAD_PITCH] = 0.1;
            break;
          case 'limp':
            T[J_ROLL] = 0.08;
            setArm(T, 1, 0.45, 0.25, 1.7);
            T[J_ARMFREE[1]] = 0;
            T[J_LEAN] = -0.18;
            break;
          case 'text':
            T[J_HEAD_PITCH] = 0.45;
            setArm(T, 0, 0.55, -0.12, 1.55);
            setArm(T, 1, 0.6, -0.15, 1.5);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'phone':
            setArm(T, 1, 0.75, 0.55, 2.55);
            T[J_ARMFREE[1]] = 0;
            T[J_HEAD_YAW] = 0.15 + Math.sin(t * 0.7 + seed) * 0.2;
            T[J_HEAD_PITCH] = 0.1;
            setArm(T, 0, -0.1, 0.45, 1.3);
            break;
          case 'film':
            // Phone held up in both hands at eye height, filming.
            setArm(T, 0, 1.3, -0.25, 0.45);
            setArm(T, 1, 1.35, -0.2, 0.35);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_HEAD_PITCH] = 0.05;
            T[J_LEAN] = 0.05;
            break;
          case 'cower':
            T[J_LOCO] = 0;
            T[J_DROP] = -3.1;
            T[J_LEAN] = -0.9 + shiver * 0.03;
            T[J_HIP[0]] = T[J_HIP[1]] = 1.45;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -2.3;
            T[J_SPREAD] = 0.18;
            setArm(T, 0, 2.55, 0.55, 2.2);
            setArm(T, 1, 2.55, 0.55, 2.2);
            T[J_HEAD_PITCH] = 0.55;
            T[J_HEAD_YAW] = 0;
            break;
          case 'freeze':
            T[J_LOCO] = 0;
            T[J_LEAN] = 0.06 + shiver * 0.02;
            setArm(T, 0, 0.55, 0.3, 1.35);
            setArm(T, 1, 0.55, 0.3, 1.35);
            T[J_HEAD_YAW] = 0;
            break;
          case 'handsUp':
            T[J_LOCO] = 0;
            T[J_LEAN] = 0.05 + shiver * 0.012;
            setArm(T, 0, 2.8, 0.5, 0.3);
            setArm(T, 1, 2.8, 0.5, 0.3);
            T[J_HEAD_PITCH] = -0.12;
            T[J_HEAD_YAW] = 0;
            break;
          case 'kneel':
            T[J_LOCO] = 0;
            T[J_DROP] = -3.05;
            T[J_HIP[0]] = T[J_HIP[1]] = 0.05;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -1.5;
            T[J_SPREAD] = 0.12;
            T[J_LEAN] = -0.08 + Math.sin(t * 3.2) * 0.05;
            setArm(T, 0, 1.15, -0.5, 1.95);
            setArm(T, 1, 1.15, -0.5, 1.95);
            T[J_HEAD_PITCH] = 0.2;
            T[J_HEAD_YAW] = 0;
            break;
          case 'startle':
            T[J_LOCO] = 0;
            T[J_LEAN] = 0.14;
            setArm(T, 0, 0.7, 0.55, 1.3);
            setArm(T, 1, 0.7, 0.55, 1.3);
            T[J_HEAD_PITCH] = -0.12;
            T[J_HEAD_YAW] = 0;
            break;
          case 'gasp':
            T[J_LEAN] = 0.1;
            setArm(T, 0, 1.25, -0.4, 2.35);
            setArm(T, 1, 1.25, -0.4, 2.35);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_HEAD_YAW] = 0;
            break;
          case 'despair':
            T[J_LOCO] = 0;
            setArm(T, 0, 2.25, 0.85, 2.3);
            setArm(T, 1, 2.25, 0.85, 2.3);
            T[J_HEAD_PITCH] = 0.25;
            break;
          case 'watch':
          case 'arms':
            if (pose === 'arms' || seed % 3 < 1.6) {
              setArm(T, 0, 0.8, -0.4, 1.95);
              setArm(T, 1, 0.75, -0.35, 1.9);
            } else {
              setArm(T, 0, -0.25, 0.75, 1.45);
              setArm(T, 1, -0.25, 0.75, 1.45);
            }
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0.2;
            if (pose === 'arms') T[J_HEAD_YAW] *= 0.4;
            break;
          case 'shout':
            T[J_LOCO] = 0;
            T[J_LEAN] = -0.1 + Math.sin(t * 9) * 0.04;
            setArm(T, 0, 0.9, 0.65, 0.5 + Math.sin(t * 9) * 0.2);
            setArm(T, 1, 0.9, 0.65, 0.5 - Math.sin(t * 9) * 0.2);
            T[J_HEAD_PITCH] = -0.15;
            T[J_HEAD_YAW] = 0;
            break;
          case 'fist':
            T[J_LOCO] = 0;
            T[J_LEAN] = -0.1;
            setArm(T, 1, 2.45 + Math.sin(t * 15) * 0.25, 0.25, 1.25 + Math.sin(t * 15) * 0.35);
            setArm(T, 0, 0.25, 0.3, 0.6);
            T[J_HEAD_YAW] = 0;
            break;
          case 'point':
            T[J_LOCO] = 0;
            setArm(T, 1, 1.52, 0.12, 0.03);
            setArm(T, 0, 0.05, 0.12, 0.2);
            T[J_HEAD_YAW] = 0;
            break;
          case 'dodge':
            T[J_LOCO] = 0;
            T[J_ROLL] = 0.35;
            T[J_LEAN] = 0.2;
            setArm(T, 0, 1.3, 1.2, 0.6);
            setArm(T, 1, 1.5, 1.1, 0.5);
            T[J_HIP[0]] = 0.9;
            T[J_KNEE[0]] = -1.2;
            break;
          case 'sit':
            T[J_LOCO] = 0;
            T[J_DROP] = -2.65;
            T[J_HIP[0]] = T[J_HIP[1]] = 1.5;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -1.35;
            T[J_SPREAD] = 0.06;
            T[J_LEAN] = 0.05;
            setArm(T, 0, 0.5, 0.05, 0.95);
            setArm(T, 1, 0.5, 0.05, 0.95);
            if (p.sipping) setArm(T, 1, 1.0, 0.25, 2.45);
            else if (carry === 'coffee') setArm(T, 1, 0.75, 0.1, 1.5);
            break;
          case 'crawl': {
            // Prone, hauling themselves along on alternate elbows, legs dragging.
            const c = Math.sin(t * 5 + seed);
            T[J_LOCO] = 0;
            T[J_FALL] = 1;
            setArm(T, 0, 2.5 + c * 0.45, 0.35, 1.2 - c * 0.5);
            setArm(T, 1, 2.5 - c * 0.45, 0.35, 1.2 + c * 0.5);
            T[J_HIP[0]] = 0.15 + Math.max(0, c) * 0.45;
            T[J_KNEE[0]] = -0.3 - Math.max(0, c) * 0.9;
            T[J_HIP[1]] = 0.05;
            T[J_KNEE[1]] = -0.15;
            T[J_ROLL] = c * 0.1;
            T[J_HEAD_PITCH] = -0.5;
            break;
          }
          case 'lie':
            T[J_LOCO] = 0;
            T[J_FALL] = 1;
            T[J_HIP[1]] = 0.9 + Math.sin(t * 1.3 + seed) * 0.15;
            T[J_KNEE[1]] = -1.6;
            setArm(T, 1, 1.0, 0.1, 1.6);
            setArm(T, 0, 0.3 + Math.sin(t * 0.9) * 0.2, 0.7, 0.8);
            T[J_ROLL] = Math.sin(t * 1.1 + seed) * 0.08;
            break;
          case 'help':
            T[J_LOCO] = 0;
            T[J_DROP] = -2.95;
            T[J_HIP[0]] = 1.5;
            T[J_KNEE[0]] = -1.6;
            T[J_HIP[1]] = 0.05;
            T[J_KNEE[1]] = -1.5;
            T[J_LEAN] = -0.5;
            setArm(T, 0, 1.0, 0.1, 0.5 + Math.sin(t * 2) * 0.2);
            setArm(T, 1, 1.1, 0.1, 0.4);
            T[J_HEAD_PITCH] = 0.4;
            break;
          case 'serve': {
            const gesture = Math.sin(t * 0.8 + seed) > 0.6;
            setArm(T, 0, 0.75, 0.1, 0.8);
            setArm(T, 1, gesture ? 1.3 : 0.75, 0.15, gesture ? 0.4 : 0.8);
            T[J_LEAN] = -0.08;
            break;
          }
          case 'strum':
            T[J_LOCO] = 0;
            setArm(T, 0, 1.0, 0.95, 0.95);
            setArm(T, 1, 0.75, -0.5, 1.45 + Math.sin(t * 9.5) * 0.25);
            T[J_HEAD_PITCH] = 0.2 + Math.sin(t * 4.2) * 0.06;
            T[J_ROLL] = Math.sin(t * 2.1) * 0.04;
            s.guitar = true;
            break;
          case 'clap':
            setArm(T, 0, 1.2, -0.3 + Math.sin(t * 14) * 0.22, 1.35);
            setArm(T, 1, 1.2, -0.3 + Math.sin(t * 14) * 0.22, 1.35);
            break;
          case 'smoke': {
            const drag = (t + seed) % 5.5 < 1.3;
            setArm(T, 1, drag ? 1.0 : 0.45, drag ? 0.3 : 0.2, drag ? 2.55 : 1.85);
            setArm(T, 0, 0.35, -0.35, 1.45);
            T[J_HEAD_PITCH] = drag ? -0.1 : 0;
            s.ember = true;
            break;
          }
          case 'sway':
            T[J_ROLL] = Math.sin(t * 2.2 + seed) * 0.06;
            T[J_DROP] = -Math.abs(Math.sin(t * 2.2 + seed)) * 0.2;
            if (seed % 2 < 1) setArm(T, 1, -0.2, 0.7, 1.4);
            break;
          case 'wave':
            T[J_LOCO] = 0;
            setArm(T, 1, 2.85, 0.35 + Math.sin(t * 8) * 0.25, 0.3);
            T[J_LEAN] = 0.04;
            break;
          case 'carry':
            setArm(T, 0, 1.0, -0.12, 1.1);
            setArm(T, 1, 1.0, -0.12, 1.1);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_LEAN] = 0.04;
            break;
          case 'leash':
            setArm(T, 1, 0.55, 0.15, 0.45);
            T[J_ARMFREE[1]] = 0.1;
            break;
          case 'chat': {
            const talk = Math.sin(t * 1.7 + seed);
            setArm(T, 1, 0.55 + talk * 0.35, 0.2, 1.4 + Math.sin(t * 3.1) * 0.3);
            setArm(T, 0, -0.2, 0.7, 1.4);
            T[J_HEAD_PITCH] = Math.sin(t * 3 + seed) * 0.07;
            break;
          }
          case 'wait':
            T[J_HEAD_YAW] = Math.sin(t * 0.9 + seed) * 0.5;
            break;
          case 'thrown': {
            // Limbs flung out in the air, gathered once sliding or down.
            const flying = (spec?.thrown || p.ejected)?.phase === 'down' ? 0 : 1;
            T[J_LOCO] = 0;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            setArm(T, 0, 1.9 + flying * 0.4, 0.6 + flying * 0.3, 0.3);
            setArm(T, 1, 2.3 - flying * 0.9, 0.6 + flying * 0.2, 0.3 + flying * 0.4);
            T[J_HIP[0]] = 0.35 + flying * 0.4;
            T[J_HIP[1]] = -0.25 - flying * 0.3;
            T[J_KNEE[0]] = -0.3 - flying * 0.6;
            T[J_KNEE[1]] = -0.2;
            T[J_SPREAD] = 0.15 + flying * 0.15;
            break;
          }
          case 'dance':
            crowdDancePose(p, s, T, seed);
            break;
          case 'swim': {
            // Treading water: arms sculling at the surface, a slow kick.
            T[J_LOCO] = 0;
            const scull = Math.sin(t * 2.6 + seed);
            setArm(T, 0, 1.35, 0.75 + scull * 0.35, 0.35);
            setArm(T, 1, 1.35, 0.75 - scull * 0.35, 0.35);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_HIP[0]] = 0.35 + Math.sin(t * 3.1 + seed) * 0.3;
            T[J_HIP[1]] = 0.35 - Math.sin(t * 3.1 + seed) * 0.3;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.6;
            T[J_LEAN] = 0.15;
            T[J_HEAD_PITCH] = -0.2;
            break;
          }
          case 'lounge': {
            // Stretched out on a daybed: one arm behind the head, a knee up.
            T[J_LOCO] = 0;
            T[J_FALL] = 0.94;
            T[J_HEAD_PITCH] = -0.35;
            T[J_HEAD_YAW] = Math.sin(t * 0.2 + seed) * 0.3;
            const knee = seed % 2 < 1,
              both = seed % 3 < 1.5;
            T[J_HIP[knee ? 0 : 1]] = 0.75;
            T[J_KNEE[knee ? 0 : 1]] = -1.5;
            setArm(T, 0, 2.7, 0.7, 2.3);
            setArm(T, 1, both ? 2.7 : 0.35, both ? 0.7 : 0.35, both ? 2.3 : 0.6);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          }
          case 'dj': {
            // Hands on the decks, head nodding on the beat; a hand to the
            // headphones now and then, a fist in the air on the drop.
            const g = mareaGroove,
              ph = g.beat * TAU,
              bar = Math.floor(g.beat / 4);
            T[J_LOCO] = 0;
            T[J_LEAN] = 0.22;
            T[J_HEAD_PITCH] = 0.25 + Math.max(0, Math.cos(ph)) * 0.25;
            T[J_DROP] = -Math.max(0, Math.cos(ph)) * 0.3;
            setArm(T, 0, 0.95, 0.15, 1.1 + Math.sin(t * 1.3) * 0.2);
            setArm(T, 1, 0.95, 0.15, 1.1 + Math.sin(t * 1.7 + 1) * 0.2);
            if (bar % 4 === 1) setArm(T, 1, 0.75, 0.55, 2.55);
            if (gameTime - g.dropAt < 3 || (g.section === 'drop' && bar % 8 === 0)) setArm(T, 0, 2.75 + Math.sin(ph) * 0.2, 0.2, 0.3);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          }
          case 'bartend': {
            // Shaking a cocktail at chest height, then pouring.
            const pour = (t + seed) % 9 > 6.5;
            setArm(T, 1, pour ? 1.3 : 1.0 + Math.sin(t * 19) * 0.22, pour ? 0.3 : 0.25, pour ? 0.6 : 1.9);
            setArm(T, 0, pour ? 0.9 : 1.0 + Math.sin(t * 19) * 0.22, pour ? 0.1 : 0.25, pour ? 1.3 : 1.9);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_HEAD_PITCH] = pour ? 0.3 : 0.05;
            break;
          }
          case 'tray':
            // A waiter's tray held flat at the shoulder; the other arm swings.
            setArm(T, 1, 0.3, 0.7, 2.25);
            T[J_ARMFREE[1]] = 0;
            break;
          case 'drink':
            setArm(T, 1, p.sipping || spec?.sip ? 1.0 : 0.45, 0.2, p.sipping || spec?.sip ? 2.45 : 1.55);
            T[J_ARMFREE[1]] = 0.1;
            if (seed % 2 < 1) setArm(T, 0, -0.15, 0.55, 1.35);
            T[J_ROLL] = Math.sin(mareaGroove.beat * Math.PI + seed) * 0.03;
            break;
          case 'sparkler':
            setArm(T, 1, 2.75, 0.3, 0.35);
            setArm(T, 0, 0.4, 0.2, 1.2);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_HEAD_PITCH] = -0.15;
            break;
          case 'sweep': {
            const stroke = Math.sin(t * 2.2 + seed);
            setArm(T, 1, 0.8 + stroke * 0.3, -0.25, 0.6);
            setArm(T, 0, 1.1 + stroke * 0.3, -0.35, 1.1);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_LEAN] = 0.2;
            T[J_TWIST] = stroke * 0.15;
            break;
          }
          case 'stop':
            // The bouncer's flat palm: nobody in.
            T[J_LOCO] = 0;
            setArm(T, 1, 1.5, 0.05, 0.1);
            setArm(T, 0, -0.1, 0.6, 1.5);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_HEAD_YAW] = 0;
            break;
          case 'shove':
            T[J_LOCO] = 0;
            T[J_LEAN] = 0.25;
            setArm(T, 0, 1.5, 0.1, 0.05);
            setArm(T, 1, 1.5, 0.1, 0.05);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'exercise': {
            const e = p.exercise;
            T[J_LOCO] = 0;
            if (p.exerciseKind === 'mat') {
              T[J_DROP] = -5.4;
              T[J_HIP[0]] = T[J_HIP[1]] = 1.3;
              T[J_LEAN] = -0.15 - e * 0.85;
              setArm(T, 0, 2.4, 0.2, 1.8);
              setArm(T, 1, 2.4, 0.2, 1.8);
            } else if (p.exerciseKind === 'dip' || p.exerciseKind === 'bars') {
              // Hands on the bars: the drop keeps them at the bars' height.
              T[J_DROP] = 4.75 + e * 5;
              setArm(T, 0, -0.12, 0.3, 0.1);
              setArm(T, 1, -0.12, 0.3, 0.1);
              T[J_HIP[0]] = 0.5;
              T[J_HIP[1]] = 0.34;
            } else {
              // Hanging from the pull-up bar (hands at its height).
              T[J_DROP] = 9.5 + e * 6;
              setArm(T, 0, 2.75 - e * 0.45, 0.35, 0.2 + e * 0.9);
              setArm(T, 1, 2.75 - e * 0.45, 0.35, 0.2 + e * 0.9);
              T[J_HIP[0]] = 0.35;
              T[J_KNEE[0]] = T[J_KNEE[1]] = -0.5;
            }
            break;
          }
          // ---- The player and officers (specialSpec) ----
          case 'exitCar': {
            // Rising out of the driver's seat: from a crouch with a hand up on the
            // door frame to standing (spec.transition 0 → 1).
            const k = 1 - (spec?.transition ?? 1);
            T[J_LOCO] = 1 - k;
            T[J_DROP] = -3.1 * k;
            T[J_HIP[0]] = 1.2 * k;
            T[J_HIP[1]] = 0.7 * k;
            T[J_KNEE[0]] = -1.9 * k;
            T[J_KNEE[1]] = -1.2 * k;
            T[J_LEAN] = -0.45 * k;
            setArm(T, 0, 0.9 + 1.1 * k, 0.6 * k + 0.1, 0.6 + 0.6 * k);
            T[J_HEAD_PITCH] = 0.3 * k;
            break;
          }
          case 'enterCar': {
            // Ducking into the seat (spec.transition 0 → 1).
            const k = spec?.transition ?? 0;
            T[J_LOCO] = 0;
            T[J_DROP] = -3.2 * k;
            T[J_HIP[0]] = 1.3 * k;
            T[J_HIP[1]] = 0.5 * k;
            T[J_KNEE[0]] = -1.8 * k;
            T[J_KNEE[1]] = -1.0 * k;
            T[J_LEAN] = -0.55 * k;
            setArm(T, 0, 1.2 + 0.9 * k, 0.5, 0.7);
            setArm(T, 1, 0.7, 0.3, 1.0);
            T[J_HEAD_PITCH] = 0.4 * k;
            break;
          }
          // ---- Match day (sports.js): football and basketball ----
          case 'kick': {
            // Planted support foot, the kicking leg through the ball, the opposite arm out.
            const k = Math.sin(clamp(spec?.progress ?? 0, 0, 1) * Math.PI);
            T[J_LOCO] = 0.2;
            T[J_HIP[1]] = -0.55 + k * 1.8;
            T[J_KNEE[1]] = -1.1 + k * 0.9;
            T[J_HIP[0]] = -0.18;
            T[J_KNEE[0]] = -0.25;
            setArm(T, 1, -0.55, 0.45, 0.4);
            setArm(T, 0, 0.8, 0.55, 0.5);
            T[J_LEAN] = -0.15 + k * 0.1;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          }
          case 'save':
            // The keeper spread for the shot.
            T[J_LOCO] = 0.3;
            T[J_DROP] = -0.8;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.8;
            T[J_HIP[0]] = T[J_HIP[1]] = 0.4;
            T[J_SPREAD] = 0.25;
            setArm(T, 0, 1.7, 0.6, 0.1);
            setArm(T, 1, 1.7, 0.6, 0.1);
            T[J_ROLL] = Math.sin(t * 5) * 0.23;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'bbDribble': {
            const bounce = spec?.bounce ?? 0;
            setArm(T, 1, 0.45 + bounce * 0.55, 0.3, 0.6 - bounce * 0.4);
            setArm(T, 0, 0.35, 0.35, 1.0);
            T[J_LEAN] = -0.12;
            T[J_DROP] = -0.4;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.45;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0.1;
            break;
          }
          case 'bbShoot': {
            const k = clamp(spec?.progress ?? 0, 0, 1),
              up = Math.sin(k * Math.PI);
            T[J_LOCO] = 0;
            setArm(T, 1, 2.25 + up * 0.45, 0.15, 1.4 * (1 - k) + 0.1);
            setArm(T, 0, 2.05 + up * 0.5, 0.25, 1.2 * (1 - k) + 0.2);
            T[J_HIP[0]] = 0.15;
            T[J_HIP[1]] = -0.15;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.4 * (1 - up);
            T[J_HEAD_PITCH] = -0.35;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          }
          case 'bbPass': {
            const k = clamp(spec?.progress ?? 0, 0, 1),
              out = Math.sin(k * Math.PI);
            setArm(T, 0, 1.2 + out * 0.3, -0.25, 1.4 * (1 - out) + 0.1);
            setArm(T, 1, 1.2 + out * 0.3, -0.25, 1.4 * (1 - out) + 0.1);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          }
          case 'bbRebound':
            setArm(T, 1, 2.75, 0.2, 0.3);
            setArm(T, 0, 2.55, 0.25, 0.3);
            T[J_HEAD_PITCH] = -0.4;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'bbDefend':
            // Arms wide, low, on the balls of the feet.
            setArm(T, 1, 0.95, 0.85, 0.35);
            setArm(T, 0, 0.85, 0.85, 0.35);
            T[J_LEAN] = -0.18;
            T[J_DROP] = -0.7;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.75;
            T[J_HIP[0]] = T[J_HIP[1]] = 0.35;
            T[J_SPREAD] = 0.14;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0.15;
            break;
          case 'flagUp':
            setArm(T, 1, 2.8, 0.25, 0.1);
            T[J_ARMFREE[1]] = 0;
            break;
          case 'riding':
            // On a bicycle, motorbike or jet ski (RIDERS): seated, leaning to the bars.
            T[J_LOCO] = 0;
            T[J_LEAN] = spec?.riderLean ?? -0.3;
            T[J_HEAD_PITCH] = -0.2;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_ROLL] = 0;
            break;
          // ---- The beach (beach.js poses) ----
          case 'sitGround':
          case 'ride':
            // On the sand (or a pedalo seat): legs out in front, leaning back on the hands.
            T[J_LOCO] = 0;
            T[J_ROLL] = T[J_HEAD_YAW] = 0;
            T[J_DROP] = -6.3;
            T[J_HIP[0]] = 1.45;
            T[J_HIP[1]] = 1.3;
            T[J_KNEE[0]] = -0.35;
            T[J_KNEE[1]] = -0.9;
            T[J_SPREAD] = 0.1;
            T[J_LEAN] = pose === 'ride' ? -0.1 : 0.22;
            if (pose === 'ride') {
              setArm(T, 0, 1.25, 0.1, 0.3);
              setArm(T, 1, 1.25, 0.1, 0.3);
            } else {
              setArm(T, 0, -0.5, 0.35, 0.1);
              setArm(T, 1, seed % 2 < 1 ? -0.5 : 0.9, 0.35, seed % 2 < 1 ? 0.1 : 1.3);
            }
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'recline':
            // On a lounger: back raised, legs out.
            T[J_LOCO] = 0;
            T[J_ROLL] = T[J_HEAD_YAW] = 0;
            T[J_HIP[0]] = T[J_HIP[1]] = 0;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.04;
            T[J_DROP] = -6.4;
            T[J_HIP[0]] = T[J_HIP[1]] = 1.5;
            T[J_KNEE[0]] = -0.1;
            T[J_KNEE[1]] = -0.35;
            T[J_LEAN] = 0.95;
            T[J_HEAD_PITCH] = 0.5;
            setArm(T, 0, seed % 2 < 1 ? 2.7 : 0.1, 0.5, seed % 2 < 1 ? 2.3 : 0.2);
            setArm(T, 1, seed % 2 < 1 ? 2.7 : 0.1, 0.5, seed % 2 < 1 ? 2.3 : 0.2);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'kneelDig':
            // A child building in the sand: kneeling, hands scooping in turn.
            T[J_LOCO] = 0;
            T[J_DROP] = -3.05;
            T[J_HIP[0]] = T[J_HIP[1]] = 0.2;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -1.9;
            T[J_SPREAD] = 0.15;
            T[J_LEAN] = -0.45;
            setArm(T, 0, 0.9 + Math.sin(t * 5) * 0.5, 0.15, 0.4);
            setArm(T, 1, 0.9 + Math.sin(t * 5 + 1.6) * 0.5, 0.15, 0.4);
            T[J_HEAD_PITCH] = 0.4;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'lieBack':
            // Sunbathing on the back: hands behind the head for some, a knee up for others.
            T[J_LOCO] = 0;
            T[J_ROLL] = T[J_HEAD_YAW] = 0;
            T[J_HIP[0]] = T[J_HIP[1]] = 0;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.04;
            T[J_FALL] = 1;
            if ((p.threshold ?? seed % 1) > 0.5) {
              setArm(T, 0, 2.75, 0.6, 2.4);
              setArm(T, 1, 2.75, 0.6, 2.4);
            } else {
              setArm(T, 0, 0.1, 0.25, 0.1);
              setArm(T, 1, 0.1, 0.25, 0.1);
            }
            if ((p.threshold ?? 0) > 0.75) {
              T[J_HIP[1]] = 0.8;
              T[J_KNEE[1]] = -1.5;
            }
            T[J_SPREAD] = 0.08;
            T[J_HEAD_PITCH] = -0.1;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'lieFront':
            // On the front, head on the folded arms.
            T[J_LOCO] = 0;
            T[J_ROLL] = T[J_HEAD_YAW] = 0;
            T[J_HIP[0]] = T[J_HIP[1]] = 0;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.04;
            T[J_FALL] = 1;
            setArm(T, 0, 2.7, 0.55, 2.2);
            setArm(T, 1, 2.7, 0.55, 2.2);
            T[J_SPREAD] = 0.1;
            T[J_HEAD_PITCH] = -0.3;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'wade':
            // In the shallows: arms held out of the water.
            T[J_AB[0]] = T[J_AB[1]] = 0.42 + Math.sin(t * 0.8 + seed) * 0.08;
            T[J_EL[0]] = T[J_EL[1]] = 0.5;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0.4;
            break;
          case 'vbReady':
            // Volleyball (beachvolley.js): the ready crouch, forearms out.
            T[J_LOCO] = 0.6;
            T[J_DROP] = -0.9;
            T[J_HIP[0]] = T[J_HIP[1]] = 0.5;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.9;
            T[J_SPREAD] = 0.16;
            T[J_LEAN] = -0.35;
            setArm(T, 0, 0.75, 0.25, 0.9);
            setArm(T, 1, 0.75, 0.25, 0.9);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0.2;
            break;
          case 'vbBump':
            // Forearm pass: arms straight and together, platform out in front.
            T[J_LOCO] = 0.4;
            T[J_DROP] = -1.3;
            T[J_HIP[0]] = T[J_HIP[1]] = 0.7;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -1.2;
            T[J_SPREAD] = 0.18;
            T[J_LEAN] = -0.35;
            setArm(T, 0, 1.05, -0.28, 0.05);
            setArm(T, 1, 1.05, -0.28, 0.05);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'vbDig':
            // A dive for the ball: a long lunge, arms reaching low.
            T[J_LOCO] = 0;
            T[J_DROP] = -3.0;
            T[J_HIP[0]] = 1.3;
            T[J_KNEE[0]] = -1.5;
            T[J_HIP[1]] = -0.5;
            T[J_KNEE[1]] = -0.4;
            T[J_LEAN] = -0.7;
            setArm(T, 0, 1.2, -0.2, 0.05);
            setArm(T, 1, 1.2, -0.2, 0.05);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'vbSet':
            // Hands up over the forehead.
            T[J_LOCO] = 0.5;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.3;
            T[J_DROP] = -0.25;
            setArm(T, 0, 2.55, 0.35, 1.2);
            setArm(T, 1, 2.55, 0.35, 1.2);
            T[J_HEAD_PITCH] = -0.45;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'vbSpike':
            // In the air: the hitting arm cocked high, the other reaching.
            T[J_LOCO] = 0;
            T[J_HIP[0]] = T[J_HIP[1]] = 0.5;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -1.1;
            T[J_LEAN] = 0.12;
            setArm(T, 1, 3.0 + Math.sin(t * 9) * 0.3, 0.2, 0.6);
            setArm(T, 0, 2.2, 0.2, 0.3);
            T[J_HEAD_PITCH] = -0.35;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'vbServe':
            T[J_LOCO] = 0.3;
            setArm(T, 0, 2.4, 0.1, 0.2);
            setArm(T, 1, 2.9, 0.3, 1.2);
            T[J_LEAN] = 0.08;
            T[J_HIP[0]] = 0.25;
            T[J_HEAD_PITCH] = -0.4;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'vbHit':
          case 'cheer':
            // Arms up: a block at the net, or celebrating a point.
            T[J_LOCO] = pose === 'cheer' ? 0 : 0.3;
            setArm(T, 0, 2.8 + (pose === 'cheer' ? Math.sin(t * 8) * 0.15 : 0), pose === 'cheer' ? 0.55 : 0.12, 0.2);
            setArm(T, 1, 2.8 + (pose === 'cheer' ? Math.sin(t * 8 + 1) * 0.15 : 0), pose === 'cheer' ? 0.55 : 0.12, 0.2);
            T[J_HEAD_PITCH] = -0.3;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'throw':
            T[J_LOCO] = 0;
            setArm(T, 1, 1.5, 0.1, 0.2);
            setArm(T, 0, -0.4, 0.2, 0.3);
            T[J_LEAN] = -0.1;
            T[J_TWIST] = -0.3;
            T[J_HIP[0]] = 0.3;
            T[J_HIP[1]] = -0.2;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'tumble':
            T[J_LOCO] = 0;
            setArm(T, 0, 2.1, 0.8, 0.6);
            setArm(T, 1, 1.7, 0.9, 0.9);
            T[J_HIP[0]] = -0.4;
            T[J_HIP[1]] = 0.7;
            T[J_KNEE[0]] = -0.6;
            T[J_KNEE[1]] = -1.3;
            T[J_SPREAD] = 0.3;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          default:
            break;
        }
        if (p.illness) {
          T[J_LEAN] -= p.illness * 0.3;
          setArm(T, 0, 0.85, 0.2, 1.2);
        }
        if (spec?.dazed) T[J_ROLL] += Math.sin(gameTime * 8) * 0.06;
        // Weapon stances turn the upper body: blading for a shouldered long gun,
        // square for a pistol, a lean into the aim.
        const hold = spec?.hold;
        if (hold?.inHand) {
          // The firing arm hangs a little forward and less free.
          T[J_ARMFREE[1]] = 0.55;
          T[J_SH[1]] = Math.max(T[J_SH[1]], 0.08);
          T[J_EL[1]] = Math.max(T[J_EL[1]], 0.3);
        } else if (hold) {
          T[J_HOLD] = 1;
          T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
          T[J_TWIST] += hold.twist || 0;
          T[J_LEAN] += hold.lean || 0;
          T[J_HEAD_PITCH] += hold.headPitch || 0;
          T[J_HEAD_YAW] = hold.headYaw || 0;
          if (hold.aiming) T[J_ROLL] *= 0.3;
        }
        // A fresh hit (wounds.js): the torso snaps away from the round, a head
        // hit throws the head back, a leg hit buckles that knee.
        const flinch = hitFlinch(p);
        if (flinch > 0) {
          const rel = normalizeAngle((p.hitDir || 0) - (p.a || 0)),
            along = Math.cos(rel),
            across = Math.sin(rel);
          T[J_LEAN] += -along * 0.5 * flinch;
          T[J_ROLL] += across * 0.3 * flinch;
          if (p.hitZone === 'head') T[J_HEAD_PITCH] -= 0.8 * flinch;
          else if (p.hitZone === 'leg') {
            const side = across > 0 ? 1 : 0;
            T[J_DROP] -= 1.1 * flinch;
            T[J_KNEE[side]] -= 1.1 * flinch;
          } else if (!hold) {
            setArm(T, 0, 0.9 * flinch, 0.5, 1.6 * flinch);
            setArm(T, 1, 0.9 * flinch, 0.5, 1.6 * flinch);
          }
        }
        const fall = p.poisonCollapse ?? personFallAmount(p);
        if (fall > 0) {
          T[J_FALL] = Math.max(T[J_FALL], fall);
          T[J_LOCO] = 0;
        }
      }

      /**
       * IK
       * Two-bone limbs placed in the world: `ikArm` puts an upper arm, forearm and
       * hand so the wrist reaches `target` with the elbow towards `pole`.
       */
      const ikS = new Three.Vector3(),
        ikT = new Three.Vector3(),
        ikE = new Three.Vector3(),
        ikDir = new Three.Vector3(),
        ikPole = new Three.Vector3(),
        ikX = new Three.Vector3(),
        ikY = new Three.Vector3(),
        ikZ = new Three.Vector3();
      function boneMatrix(out, origin, x, y, z, scale) {
        out.set(x.x * scale, y.x * scale, z.x * scale, origin.x, x.y * scale, y.y * scale, z.y * scale, origin.y, x.z * scale, y.z * scale, z.z * scale, origin.z, 0, 0, 0, 1);
        return out;
      }
      function ikArm(upper, lower, hand, shoulder, target, pole, L1, L2, scale) {
        ikS.copy(shoulder);
        ikDir.subVectors(target, ikS);
        let d = ikDir.length();
        const reach = (L1 + L2) * 0.998;
        if (d < 1e-4) ikDir.set(1, 0, 0), (d = 1e-4);
        ikDir.divideScalar(d);
        d = clamp(d, Math.abs(L1 - L2) + 0.05, reach);
        ikT.copy(ikS).addScaledVector(ikDir, d);
        const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d),
          hgt = Math.sqrt(Math.max(0, L1 * L1 - a * a));
        ikPole.copy(pole).addScaledVector(ikDir, -pole.dot(ikDir));
        if (ikPole.lengthSq() < 1e-6) ikPole.set(0, -1, 0).addScaledVector(ikDir, ikDir.y);
        ikPole.normalize();
        ikE.copy(ikS).addScaledVector(ikDir, a).addScaledVector(ikPole, hgt);
        // Upper arm: +y from the elbow back up to the shoulder; +x the way the forearm bends.
        ikY.subVectors(ikS, ikE).normalize();
        ikX.subVectors(ikT, ikE);
        ikX.addScaledVector(ikY, -ikX.dot(ikY));
        if (ikX.lengthSq() < 1e-6) ikX.copy(ikPole).negate();
        ikX.normalize();
        ikZ.crossVectors(ikX, ikY);
        boneMatrix(upper, ikS, ikX, ikY, ikZ, scale);
        // Forearm: same bending plane.
        ikY.subVectors(ikE, ikT).normalize();
        ikX.crossVectors(ikY, ikZ).normalize();
        boneMatrix(lower, ikE, ikX, ikY, ikZ, scale);
        boneMatrix(hand, ikT, ikX, ikY, ikZ, scale);
      }
      /* Leg IK in the hip's sagittal plane: hip swing and knee bend for an ankle at (fx, fy). */
      const legSolve = { hip: 0, knee: 0 };
      function solveLeg(fx, fy, L1, L2) {
        let d = Math.hypot(fx, fy);
        d = clamp(d, 0.5, (L1 + L2) * 0.999);
        const cosHip = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1),
          cosKnee = clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1);
        legSolve.hip = Math.atan2(fx, -fy) + Math.acos(cosHip);
        legSolve.knee = -(Math.PI - Math.acos(cosKnee));
        return legSolve;
      }
