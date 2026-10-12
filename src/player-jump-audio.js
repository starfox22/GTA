    // The player's jump effort: a short voiced "huh" at take-off (player-jump.js calls jumpEffortSound when the
    // crouch ends), a recorded adult male grunt (assets/audio/player-jump-grunt.ogg, arther1974, CC0) varied per jump.
    /**
     * JUMP EFFORT
     * One sample, two deliveries: a full "huh" (most jumps) and a softer, quicker breath (a standing hop, or one jump
     * in four), each pitched by sfxRandom so no two sound the same. It plays on the effects bus at the player's own
     * position (no distance loss, centred), at JUMP_EFFORT_LEVEL: under a footstep's landing and well under
     * gunfire. Never in a vehicle, swimming or dead (the jump cannot start there anyway). `jumpEffortLog` counts what
     * was asked and what played (console jumpReport().effort, tools/tests/player-jump.mjs).
     */
    const JUMP_EFFORT_SAMPLE = 'player-jump-grunt',
      JUMP_EFFORT_LEVEL = 0.3,
      JUMP_EFFORT_SOFT = 0.62,
      jumpEffortLog = { asked: 0, played: 0, soft: 0, last: null };
    function jumpEffortSound(pace) {
      jumpEffortLog.asked++;
      if (!audio || !soundOn || gameMode !== 'play' || player.car || player.swimming || player.hp <= 0) return false;
      if (!audioBuffers[JUMP_EFFORT_SAMPLE]) return false;
      // A standing hop is a lighter breath; a running jump the full effort, a touch higher when it is quick.
      const soft = pace <= 0 || sfxRandom(0, 1) < 0.25,
        rate = soft ? sfxRandom(1.02, 1.12) : sfxRandom(0.9, 1.04),
        level = JUMP_EFFORT_LEVEL * (soft ? JUMP_EFFORT_SOFT : 1) * sfxRandom(0.85, 1);
      playSample(JUMP_EFFORT_SAMPLE, level, rate, player);
      jumpEffortLog.played++;
      if (soft) jumpEffortLog.soft++;
      jumpEffortLog.last = { soft, rate: +rate.toFixed(3), level: +level.toFixed(3), at: +gameTime.toFixed(2) };
      return true;
    }
    function jumpEffortReport() {
      return { sample: JUMP_EFFORT_SAMPLE, loaded: !!audioBuffers[JUMP_EFFORT_SAMPLE], sound: !!(audio && soundOn), ...jumpEffortLog };
    }
