    // The lockpick's sounds (vehicle-trunk.js): the pick raking the pins, the soft click of a pin setting, the latch
    // giving (a trunk's clunk and the lid lifting, or a door's lock knob), all quiet foley close to the player; and a trunk
    // lid shutting (trunkSlamSound).
    function lockpickRakeSound() {
      const fa = foleyBuffers();
      if (!fa || !soundOn) return;
      const t = audio.currentTime,
        out = foleyBus(0.55, 0, 0.4);
      foleyNoise(out, fa.grit, 'bandpass', sfxRandom(5200, 6900), 6, 0.022, t, 0.002, 0.05);
      foleyNoise(out, fa.white, 'highpass', 7800, 0.7, 0.008, t + 0.01, 0.004, 0.06);
    }
    /* A pin setting at the shear line: a tiny tick, a touch higher each pin, and a dull tap through the housing. */
    function lockpickPinSound(pin = 1) {
      const fa = foleyBuffers();
      if (!fa || !soundOn) return;
      const t = audio.currentTime,
        out = foleyBus(0.7, 0, 0.4);
      foleyNoise(out, fa.white, 'bandpass', sfxRandom(3100, 3400) + pin * 140, 10, 0.075, t, 0.001, 0.018);
      foleyNoise(out, fa.white, 'lowpass', 820, 1, 0.035, t + 0.004, 0.001, 0.025);
    }
    /* The lock giving: the cylinder turning, then a trunk's latch and the lid rising on its springs, or a door's knob. */
    function lockpickLatchSound(kind = 'trunk') {
      const fa = foleyBuffers();
      if (!fa || !soundOn) return;
      const t = audio.currentTime,
        out = foleyBus(0.85, 0, 0.9);
      foleyNoise(out, fa.grit, 'bandpass', 2300, 5, 0.05, t, 0.002, 0.05);
      if (kind === 'trunk') {
        foleyNoise(out, fa.white, 'lowpass', 260, 1, 0.16, t + 0.06, 0.003, 0.12);
        foleyNoise(out, fa.white, 'bandpass', 1450, 4, 0.06, t + 0.065, 0.001, 0.03);
        // The lid lifting on its gas struts.
        foleyNoise(out, fa.white, 'bandpass', 620, 0.9, 0.025, t + 0.12, 0.12, 0.55);
      } else {
        foleyNoise(out, fa.white, 'bandpass', 1800, 5, 0.06, t + 0.05, 0.001, 0.025);
        foleyNoise(out, fa.white, 'lowpass', 420, 1, 0.07, t + 0.055, 0.002, 0.06);
      }
    }
    /* A trunk lid coming down (closed at the bumper, or slammed by the car moving off): the thump of the panel into its
       seal and the latch, fading with distance from the player. */
    function trunkSlamSound(c, level = 1) {
      const fa = foleyBuffers();
      if (!fa || !soundOn || !c) return;
      const d = distanceBetween(c, player);
      if (d > 320) return;
      const t = audio.currentTime,
        out = foleyBus(level * (1 - d / 360), clamp(soundRight(c.x - player.x, c.y - player.y) / 450, -0.8, 0.8), 1.2);
      foleyNoise(out, fa.grit, 'bandpass', 2100, 4, 0.03, t, 0.002, 0.03);
      doorThunk(out, fa, t + 0.02, false, 1);
    }
