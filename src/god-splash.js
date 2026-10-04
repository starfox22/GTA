    /**
     * GOD MODE SPLASH: the full-screen card and fanfare when a cheat code toggles god mode
     * (game-input.js godModeCheat): gold "GOD MODE ACTIVATED!" with a light burst, or a cool "GOD MODE DEACTIVATED".
     */
    const GOD_SPLASH_TEXT = {
      on: {
        kicker: 'CHEAT CODE ACCEPTED',
        title: 'GOD MODE ACTIVATED!',
        detail: 'INVINCIBLE · EVERY WEAPON · EVERY JOB UNLOCKED',
      },
      off: {
        kicker: 'CHEAT CODE ACCEPTED',
        title: 'GOD MODE DEACTIVATED',
        detail: 'MORTAL AGAIN · PLAY IT STRAIGHT',
      },
    };
    let godSplashKind = null,
      godSplashCount = 0;
    // CSS runs the whole card (god-splash.css); the class comes off when its animation ends, so it plays out
    // the same over play, the pause menu, Settings or the title screen.
    function showGodSplash(on) {
      const el = getElement('godSplash'),
        text = GOD_SPLASH_TEXT[on ? 'on' : 'off'];
      getElement('godSplashKicker').textContent = text.kicker;
      getElement('godSplashTitle').textContent = text.title;
      getElement('godSplashDetail').textContent = text.detail;
      el.classList.remove('show', 'on', 'off', 'still');
      void getComputedStyle(el).animationName;
      el.classList.add('show', on ? 'on' : 'off');
      godSplashKind = on ? 'on' : 'off';
      godSplashCount++;
      godFanfare(on);
    }
    function godSplashEnded(event) {
      if (event.target !== event.currentTarget) return;
      event.currentTarget.classList.remove('show', 'on', 'off');
      godSplashKind = null;
    }
    getElement('godSplash').addEventListener('animationend', godSplashEnded);
    // A rising brass-ish major arpeggio and a held chord for ON, a falling minor line for OFF.
    function godFanfare(on) {
      if (!audio || !soundOn) return;
      const t0 = audio.currentTime + 0.02,
        notes = on
          ? [
              [523.25, 0, 0.16],
              [659.25, 0.12, 0.16],
              [783.99, 0.24, 0.16],
              [1046.5, 0.36, 1.3],
              [659.25, 0.36, 1.3],
              [783.99, 0.36, 1.3],
              [261.63, 0.36, 1.4],
              // Sparkle over the held chord.
              [2093.0, 0.42, 0.35, 1],
              [2637.0, 0.5, 0.35, 1],
              [3136.0, 0.58, 0.35, 1],
              [4186.0, 0.66, 0.5, 1],
            ]
          : [
              [587.33, 0, 0.22],
              [466.16, 0.18, 0.22],
              [392.0, 0.36, 0.22],
              [293.66, 0.54, 0.9],
              [196.0, 0.54, 0.9],
            ],
        level = on ? 0.09 : 0.07;
      for (let i = 0; i < notes.length; i++) {
        const f = notes[i][0],
          at = t0 + notes[i][1],
          d = notes[i][2],
          o = audio.createOscillator(),
          shape = audio.createBiquadFilter(),
          g = audio.createGain();
        o.type = notes[i][3] ? 'sine' : 'sawtooth';
        o.frequency.setValueAtTime(f, at);
        // A slow, slight vibrato on the held notes.
        if (d > 0.5) {
          o.detune.setValueAtTime(0, at);
          o.detune.linearRampToValueAtTime(on ? 6 : -30, at + d);
        }
        shape.type = 'lowpass';
        shape.frequency.setValueAtTime(on ? 2600 : 1400, at);
        shape.Q.value = 0.7;
        g.gain.setValueAtTime(0.0001, at);
        const peak = notes[i][3] ? level * 0.45 : level;
        g.gain.linearRampToValueAtTime(peak, at + 0.02);
        g.gain.setValueAtTime(peak, at + d * 0.55);
        g.gain.exponentialRampToValueAtTime(0.0008, at + d);
        o.connect(shape).connect(g).connect(master);
        if (reverbSend) g.connect(reverbSend);
        o.start(at);
        o.stop(at + d + 0.02);
        o.onended = () => {
          o.disconnect();
          shape.disconnect();
          g.disconnect();
        };
      }
    }
    function godSplashConsole() {
      return {
        // The god mode splash: on screen, which card, its title and how many have played.
        godSplash: () => ({
          shown: getElement('godSplash').classList.contains('show'),
          kind: godSplashKind,
          title: getElement('godSplashTitle').textContent,
          count: godSplashCount,
        }),
        // Show a splash held at its settled look, no animation (for stills); godSplashHide() takes it off.
        godSplashStill(on = true) {
          showGodSplash(!!on);
          getElement('godSplash').classList.add('still');
          return this.godSplash();
        },
        godSplashHide() {
          getElement('godSplash').classList.remove('show', 'on', 'off', 'still');
          godSplashKind = null;
          return true;
        },
      };
    }
