    // Sound of a wheel going over someone already on the ground (runover.js): a low thud and a short crack, heavier with weight and speed.
    function runOverSound(person, harm, mortal) {
      if (!audio || !soundOn || gameMode !== 'play' || distanceBetween(person, player) > 520) return;
      const heavy = clamp(harm / 45, 0.35, 1.2);
      // A body under a tyre: the dull bump sample pitched down, and the bone-and-gravel crack of the debris one pitched up.
      playSample(crashPick('bump') || 'crash-bump-2', 0.34 + 0.3 * heavy, sfxRandom(0.6, 0.76), person);
      playSample('crash-debris', 0.1 + 0.12 * heavy + (mortal ? 0.04 : 0), sfxRandom(1.35, 1.6), person, master, 0.04);
    }
