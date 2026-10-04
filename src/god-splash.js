    /**
     * GOD MODE SPLASH: the full-screen card and fanfare when a cheat code toggles god mode
     * (game-input.js godModeCheat): ON charges up, slams a gold "GOD MODE ACTIVATED!" in with a shockwave and sparks;
     * OFF glitches a steel "GOD MODE DEACTIVATED" in and switches it off like an old TV. Sound: god-splash-audio.js.
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
      // The chromatic-split copies behind the title (god-splash.css .gs-ghost).
      getElement('godSplashGhostA').textContent = text.title;
      getElement('godSplashGhostB').textContent = text.title;
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
    // The spark burst: fixed angles on the golden angle, so every splash is the same and nothing is random.
    (function makeGodSparks() {
      const box = getElement('godSplashSparks');
      for (let i = 0; i < 36; i++) {
        const spark = document.createElement('i'),
          k = (i * 0.618034) % 1;
        spark.style.setProperty('--a', ((i * 137.508) % 360).toFixed(1) + 'deg');
        spark.style.setProperty('--d', (24 + k * 34).toFixed(1) + 'vmin');
        spark.style.setProperty('--t', (0.7 + ((i * 0.381966) % 1) * 0.6).toFixed(2) + 's');
        spark.style.setProperty('--w', (10 + k * 26).toFixed(0) + 'px');
        box.appendChild(spark);
      }
    })();
    // @include src/god-splash-audio.js
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
        // Show a splash as it looks `seconds` in, held there (for stills of the moving parts): each animation is
        // stepped to that time, its values written inline and the animation dropped. godSplashHide() clears it.
        godSplashScrub(on = true, seconds = 0.7) {
          showGodSplash(!!on);
          const el = getElement('godSplash'),
            at = clamp(Number(seconds) || 0, 0, 4.2) * 1000,
            list = el.getAnimations({ subtree: true });
          for (let i = 0; i < list.length; i++) {
            list[i].pause();
            list[i].currentTime = at;
            try {
              list[i].commitStyles();
            } catch {
              // A pseudo-element (the flash) cannot hold inline styles: it is simply left out of the still.
            }
            list[i].cancel();
          }
          return { animations: list.length, at };
        },
        godFanfareRender: (on = true) => godFanfareRender(!!on),
        godFanfareReport: () => godFanfareResult,
        godSplashHide() {
          const el = getElement('godSplash');
          el.classList.remove('show', 'on', 'off', 'still');
          el.removeAttribute('style');
          // Scrub leftovers; the sparks keep their own --a/--d/--t/--w.
          for (const node of el.querySelectorAll('[style]'))
            if (node.parentElement.id === 'godSplashSparks') {
              node.style.removeProperty('transform');
              node.style.removeProperty('opacity');
            } else node.removeAttribute('style');
          godSplashKind = null;
          return true;
        },
      };
    }
