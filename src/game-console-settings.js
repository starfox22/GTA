    // BEGIN SUBSYSTEM: src/game-console-settings.js — DeadEndCity console, settings: settings, openSettings, bindings, radio (+ audioConsole)
    // Settings, key bindings and the car radio; the audio console.
    addConsoleMethods('settings', {
      // Everything on the settings screen (settings.js), and the HUD's saved
      // state. Pass an object to change some of it, e.g. { chatter: false,
      // masterVolume: 40, minimapZoom: 2, minimapFolded: true, touch: 'on' }.
      settings(changes) {
        if (changes && typeof changes === 'object') {
          for (const { key } of AUDIO_VOLUMES)
            if (Number.isFinite(changes[key])) settings[key] = clamp(Math.round(changes[key]), 0, 100);
          if (changes.audioReset === true) resetAudioVolumes();
          if (typeof changes.chatter === 'boolean') settings.npcChatter = changes.chatter;
          if (typeof changes.cutaway === 'boolean') setCharacterCutaway(changes.cutaway);
          if (typeof changes.playerOutline === 'boolean') settings.playerOutline = changes.playerOutline;
          // 'auto', 'off', 'low' or 'high' (quality.js SHADOWS).
          if (typeof changes.shadows === 'string') setShadowSetting(changes.shadows.toLowerCase());
          if (typeof changes.sound === 'boolean' && changes.sound !== soundOn) mute();
          if (typeof changes.voices === 'boolean' && changes.voices !== voicesOn) toggleVoices();
          if (typeof changes.fps === 'boolean' && changes.fps !== fpsMeter.shown) toggleFpsCounter();
          // 30, 60, 120, or 'unlimited' (0 also means unlimited).
          if (changes.frameLimit !== undefined) setFrameLimit(changes.frameLimit === 0 ? 'unlimited' : changes.frameLimit);
          if (typeof changes.minimapFolded === 'boolean') setMinimapFolded(changes.minimapFolded);
          if (typeof changes.keyHints === 'boolean') setKeyHints(changes.keyHints);
          if (typeof changes.flightHud === 'boolean') setFlightHud(changes.flightHud);
          if (typeof changes.gps === 'boolean') setGps(changes.gps);
          // 'kmh' or 'mph' (hud.js SPEED BOX); the speed box on foot.
          if (typeof changes.units === 'string') setSpeedUnits(changes.units.toLowerCase());
          if (typeof changes.footSpeed === 'boolean') setFootSpeed(changes.footSpeed);
          if (Number.isFinite(changes.minimapZoom)) setMinimapZoom(changes.minimapZoom);
          // Settings · Driving (driving.js): abs, esc, tcs (booleans), steering
          // (50-150 %), lookAhead (0-150 %); drivingReset: true restores them.
          for (const key of ['abs', 'esc', 'tcs']) if (typeof changes[key] === 'boolean') setDrivingSetting(key, changes[key]);
          for (const key of ['steering', 'lookAhead']) if (Number.isFinite(changes[key])) setDrivingSetting(key, changes[key]);
          if (changes.drivingReset === true) resetDrivingSettings();
          if (typeof changes.touch === 'string') setTouchMode(changes.touch);
          applyVolumes();
          saveSettings();
          if (gameMode === 'settings') renderSettings();
          updateUI();
        }
        return {
          graphics: graphicsSetting,
          shadows: shadowSetting,
          frameLimit: frameLimit() || 'unlimited',
          fps: fpsMeter.shown,
          cutaway: settings.cutaway,
          playerOutline: settings.playerOutline,
          sound: soundOn,
          // The volume sliders (settings.js AUDIO_VOLUMES): masterVolume,
          // radioVolume, engineVolume, soundVolume (effects), voiceVolume,
          // ambienceVolume, sirenVolume.
          ...Object.fromEntries(AUDIO_VOLUMES.map((v) => [v.key, settings[v.key]])),
          voices: voicesOn,
          chatter: settings.npcChatter,
          minimapFolded: hudState.minimapFolded,
          minimapZoom: +hudState.minimapZoom.toFixed(2),
          keyHints: hudState.keyHints,
          flightHud: hudState.flightHud,
          gps: hudState.gps,
          units: hudState.units,
          footSpeed: hudState.footSpeed,
          abs: drivingSettings.abs,
          esc: drivingSettings.esc,
          tcs: drivingSettings.tcs,
          steering: drivingSettings.steering,
          lookAhead: drivingSettings.lookAhead,
          gpsRoute: gpsRoute.points.length,
          touch: touchMode,
          screen: gameMode === 'settings' ? settingsTab : null,
        };
      },
      // The car radio and the radio box's volume row (car-radio.js RADIO VOLUME).
      radio: () => radioReport(),
      // Open the settings screen on a tab ('graphics', 'audio', 'gameplay',
      // 'driving', 'controls'); during play it opens over the pause menu. Screenshot tours use it.
      openSettings(tab = 'graphics') {
        if (gameMode === 'play') togglePause();
        syncGodSettingsTab(); // GOD PANEL: 'god' is a tab while god mode is on
        openSettings(SETTINGS_TABS.some((t) => t[0] === tab) ? tab : 'graphics');
        return gameMode;
      },
      // Key bindings (controls.js) as { action: [primary, secondary] }. Pass
      // { action: 'KeyX' } to bind a primary key (a clash swaps, as the settings
      // screen offers), or 'reset' for the defaults.
      bindings(changes) {
        if (changes === 'reset') resetControlBindings();
        else if (changes && typeof changes === 'object')
          for (const [id, code] of Object.entries(changes))
            if (!bindControl(id, 0, code, true)) throw Error('cannot bind ' + id + ' to ' + code);
        return JSON.parse(JSON.stringify(controlBindings));
      },
    });
    // Sound: audioMix(), engineSound(), rainSound() (see audio.js audioConsole).
    addConsoleMethods('audio', audioConsole());
    // END SUBSYSTEM: src/game-console-settings.js
