    // Bullet sound: strikes by surface (concrete chips and ricochets, metal, glass, dirt) and
    // the crack and whizz of an enemy round passing close to the player.
    /**
     * BULLETS
     * bulletImpactSound(x, y, kind), from updateBullets (game-combat.js) wherever a round
     * strikes something that is not flesh (the hit kinds bulletHitSurface and
     * bulletHitVehicle return):
     *  - 'wall': a sharp chip off the concrete and a patter of grit; one in four sings
     *    off as a RICOCHET (a whine falling from about 3 kHz with a little vibrato);
     *  - 'metal' (a car's panel, a riot shield): a hollow knock and a short ring;
     *  - 'glass': a crack and a few tinkles;
     *  - 'dust' (the ground): a dull thud and a spray of grit.
     * Each is placed from the ear (pan, distance, occlusion: acoustics-audio.js
     * soundShade) within IMPACT_REACH, and a token bucket (IMPACT_BURST, refilled at
     * IMPACT_RATE a second) keeps a firefight or a shotgun's pellets from flooding the mix.
     * NEAR MISSES (updateBulletWhizz, from soundUpdate): an enemy round that went past the
     * ear this frame within WHIZZ_REACH makes a whizz (a band of noise falling in pitch, on
     * the side it passed), and a fast one (a rifle, a sniper) a supersonic crack first.
     * Each round whizzes once.
     */
    const IMPACT_REACH = 700,
      IMPACT_BURST = 6,
      IMPACT_RATE = 14,
      WHIZZ_REACH = 32;
    const bulletAudio = { tokens: IMPACT_BURST, at: 0, impacts: 0, dropped: 0, whizzes: 0, cracks: 0, last: null, whizzed: new WeakSet() },
      bulletPoint = { x: 0, y: 0, elevation: 0 };
    /* A placed bus for one strike: gain, the air and occlusion low-pass, pan; torn down later. */
    function bulletBus(x, y, altitude, base) {
      const point = bulletPoint;
      point.x = x;
      point.y = y;
      point.elevation = altitude;
      const d = Math.hypot(x - player.x, y - player.y),
        // One ray a strike (a fresh point each time: soundShade's cache would not help).
        occluded = d > 40 && earBlocked(point),
        g = audio.createGain(),
        f = audio.createBiquadFilter(),
        p = audio.createStereoPanner();
      acoustics.stats.placed++;
      if (occluded) acoustics.stats.occluded++;
      g.gain.value = base * (1 / (1 + d / 150)) * (occluded ? 0.55 : 1);
      f.type = 'lowpass';
      f.frequency.value = airCutoff(d) * (occluded ? 0.22 : 1);
      p.pan.value = clamp((x - player.x) / 450, -0.9, 0.9);
      g.connect(f).connect(p).connect(master);
      setTimeout(() => {
        g.disconnect();
        f.disconnect();
        p.disconnect();
      }, 1200);
      return g;
    }
    function bulletImpactSound(x, y, kind, altitude = 0) {
      if (!audio || !soundOn || gameMode !== 'play') return;
      const fa = foleyBuffers();
      if (!fa || Math.abs(x - player.x) > IMPACT_REACH || Math.abs(y - player.y) > IMPACT_REACH) return;
      const b = bulletAudio;
      b.tokens = Math.min(IMPACT_BURST, b.tokens + Math.max(0, gameTime - b.at) * IMPACT_RATE);
      b.at = gameTime;
      if (b.tokens < 1) {
        b.dropped++;
        return;
      }
      b.tokens--;
      b.impacts++;
      b.last = kind;
      const t = audio.currentTime,
        out = bulletBus(x, y, altitude, 1),
        pitch = sfxRandom(0.9, 1.1);
      switch (kind) {
        case 'metal':
          foleyTone(out, 'sine', 320 * pitch, 150, 0.1, t, 0.06);
          foleyNoise(out, fa.white, 'bandpass', 1300 * pitch, 1.5, 0.08, t, 0.002, 0.05);
          foleyTone(out, 'sine', 1900 * pitch, 0, 0.018, t + 0.004, 0.22);
          foleyTone(out, 'sine', 1900 * pitch * 2.71, 0, 0.008, t + 0.004, 0.14);
          break;
        case 'glass':
          foleyNoise(out, fa.white, 'highpass', 4800, 0.8, 0.09, t, 0.002, 0.04);
          for (let k = 0; k < 4; k++) foleyTone(out, 'sine', sfxRandom(3200, 6400), 0, 0.012, t + 0.03 + k * sfxRandom(0.03, 0.07), 0.08);
          break;
        case 'dust':
          foleyNoise(out, fa.white, 'lowpass', 650 * pitch, 0.8, 0.09, t, 0.003, 0.06);
          foleyNoise(out, fa.grit, 'bandpass', 1600 * pitch, 0.8, 0.05, t + 0.01, 0.005, 0.12);
          break;
        default:
          // Concrete and brick: the chip, the grit falling, and now and then the whine.
          foleyNoise(out, fa.white, 'bandpass', 3200 * pitch, 1.1, 0.11, t, 0.001, 0.03);
          foleyNoise(out, fa.grit, 'bandpass', 2400 * pitch, 0.9, 0.04, t + 0.012, 0.004, 0.14);
          if (Math.random() < 0.25) ricochet(out, t + 0.01, pitch);
      }
    }
    /* A round singing off: a whine falling in pitch with a little flutter. */
    function ricochet(out, t, pitch) {
      const o = audio.createOscillator(),
        wobble = audio.createOscillator(),
        depth = audio.createGain(),
        g = audio.createGain(),
        length = sfxRandom(0.28, 0.45);
      o.type = 'sine';
      o.frequency.setValueAtTime(3300 * pitch, t);
      o.frequency.exponentialRampToValueAtTime(1500 * pitch, t + length);
      wobble.frequency.value = sfxRandom(18, 30);
      depth.gain.value = 70;
      wobble.connect(depth).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + length);
      o.connect(g).connect(out);
      o.start(t);
      wobble.start(t);
      o.stop(t + length + 0.03);
      wobble.stop(t + length + 0.03);
      o.onended = () => {
        o.disconnect();
        wobble.disconnect();
        depth.disconnect();
        g.disconnect();
      };
    }
    /* A near miss panned to `side` (-1 left .. 1 right), `close` 0..1; `fast` rounds crack first. */
    function bulletWhizz(side, close, fast) {
      const fa = foleyBuffers();
      if (!fa) return;
      const t = audio.currentTime,
        out = foleyBus(1, side * 0.6, 0.6),
        s = audio.createBufferSource(),
        f = audio.createBiquadFilter(),
        g = audio.createGain(),
        length = fast ? 0.09 : 0.15;
      if (fast) {
        foleyNoise(out, fa.white, 'highpass', 2500, 0.7, 0.16 * (0.5 + 0.5 * close), t, 0.001, 0.012);
        bulletAudio.cracks++;
      }
      s.buffer = fa.white;
      f.type = 'bandpass';
      f.Q.value = 3;
      f.frequency.setValueAtTime(5200, t);
      f.frequency.exponentialRampToValueAtTime(1300, t + length);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.13 * (0.35 + 0.65 * close), t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + length);
      s.connect(f).connect(g).connect(out);
      s.start(t, Math.random() * 0.9);
      s.stop(t + length + 0.03);
      s.onended = () => {
        s.disconnect();
        f.disconnect();
        g.disconnect();
      };
      bulletAudio.whizzes++;
    }
    /* Per frame (audio.js soundUpdate): enemy rounds that passed the ear this frame. */
    function updateBulletWhizz(deltaSeconds, active) {
      if (!active || deltaSeconds <= 0 || !bullets.length) return;
      const ear = player.car || player,
        ez = entityElevation(player);
      for (let i = 0; i < bullets.length; i++) {
        const b = bullets[i];
        if (!b.enemy || b.rocket || bulletAudio.whizzed.has(b)) continue;
        const rx = ear.x - b.x,
          ry = ear.y - b.y;
        if (Math.abs(rx) > 400 || Math.abs(ry) > 400 || Math.abs((b.altitude || 0) - ez) > 40) continue;
        const speed = Math.hypot(b.vx, b.vy);
        if (speed < 1) continue;
        const along = (rx * b.vx + ry * b.vy) / speed,
          across = (b.vx * ry - b.vy * rx) / speed;
        // Past the ear, and only just: it went by during this frame.
        if (along > 0 || -along > speed * deltaSeconds * 1.3 || Math.abs(across) > WHIZZ_REACH) continue;
        bulletAudio.whizzed.add(b);
        // The side it passed on, as the screen shows it: the x of the line's nearest point.
        const nearX = b.x + (along * b.vx) / speed - ear.x;
        bulletWhizz(clamp(nearX / 16, -1, 1), 1 - Math.abs(across) / WHIZZ_REACH, speed > 1600 || b.damageKind === 'sniper');
      }
    }
    // Console (part of DeadEndCity.acoustics): strikes, dropped strikes, whizzes and cracks.
    function bulletAudioReport() {
      const b = bulletAudio;
      return { impacts: b.impacts, dropped: b.dropped, whizzes: b.whizzes, cracks: b.cracks, last: b.last, tokens: +b.tokens.toFixed(2) };
    }
