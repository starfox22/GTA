      // Damage testing: park(), shootAt(), blast(), crashTest(), damageReport(),
      // streetProps(), damageStats() (see damage.js damageConsole).
      ...damageConsole(),
      // Handling: turnTest(), pose(), aiDriving(), riderReport(), rideInto(),
      // bridgeJump() (see physics.js handlingConsole).
      ...handlingConsole(),
      // Stop the frame loop's simulation (it still draws) so a screenshot sequence
      // can be stepped with simulate(); false lets it run again.
      holdSimulation(on = true) {
        simulationHeld = !!on;
        return simulationHeld;
      },
      // Sound: audioMix(), engineSound(), rainSound() (see audio.js audioConsole).
      ...audioConsole(),
      // Match day: match(), ballState(), matchDay(), fixtures(), ballToPlayer()
      // (see sports.js sportsConsole).
      ...sportsConsole(),
      // MONARCH MOTORS: dealership(), prestigeCatalog(), dealershipVisit(), dealerMenu(),
      // dealerBuy(), dealerAlarm(), dealerShatter(), dealerCalm(), dealerResetGarage()
      // (see dealership.js dealershipConsole).
      ...dealershipConsole(),
      // GOALLINE, the betting shop by the stadium: markets, odds, bets (sportsbook.js).
      ...sportsbookConsole(),
      // Graphics quality: 'auto', 'low', 'medium', 'high' or 'ultra' (saved like the
      // Settings choice); returns what the renderer is now using.
      graphics(tier) {
        if (tier !== undefined) cycleGraphicsSetting(String(tier).toLowerCase());
        return {
          setting: graphicsSetting,
          ...(city3D?.quality?.() || {}),
          // Sun shadows in force ('off', 'low', 'high') and the setting behind them.
          shadows: shadowQuality(),
          shadowSetting,
          // AUTO's frame-rate adaptation (quality.js ADAPTIVE QUALITY).
          adaptive: { averageFrameMs: +adaptive.average.toFixed(1), tierDrops: adaptive.tierDrops },
        };
      },
      // Police vehicle review (police3d.js): parks every police model and livery in
      // a column from (x, y), `spacing` apart, facing `heading`, with their lights
      // on (`lights`: true parked at a scene, 'pursuit' running hot, false off).
      // Parked, empty and unarmed; returns the ids and looks.
      policeLineup(x = player.x + 60, y = player.y - 160, heading = 0, lights = true, spacing = 40) {
        const LOOKS = [
          ['police', 'charger', 'bw'],
          ['police', 'utility', 'bw'],
          ['police', 'crownvic', 'bw'],
          ['police', 'charger', 'modern'],
          ['police', 'utility', 'modern'],
          ['police', 'crownvic', 'sheriff'],
          ['police', 'charger', 'unmarked'],
          ['suv', 'tahoe', 'unmarked'],
          ['van', 'bearcat', 'swat'],
        ];
        return LOOKS.map(([type, body, livery], i) => {
          const c = makeCar(type, x - Math.sin(heading) * i * spacing, y + Math.cos(heading) * i * spacing, heading, false, type === 'suv' ? '#121417' : undefined);
          Object.assign(c, { policeLook: { body, livery }, showLights: lights });
          return { id: c.id, type, body, livery };
        });
      },
      // The flagships and dirt bikes in the world (SHOWCASE PARKING and traffic):
      // id, type, where (x, y, district), the showcase place it stands at, driven or parked.
      showcase() {
        return vehicles
          .filter((c) => VEHICLE_DEFINITIONS[c.type]?.flagship || c.type === 'kr500')
          .map((c) => {
            const spot = SHOWCASE_PARKING.find((p) => Math.hypot(p.x - c.x, p.y - c.y) < 260);
            return { id: c.id, type: c.type, x: Math.round(c.x), y: Math.round(c.y), district: districtAt(c.x, c.y), place: spot ? spot.place : null, driven: !!c.ai };
          });
      },
      // Civilian vehicle review (cars3d.js, vehicles3d.js): parks one of each type
      // in `types` (default: every civilian car and motorbike) in a column from
      // (x, y), `spacing` apart, facing `heading`, each in its own colour (or
      // `color` for all). `lamps` true turns their lamps on as if driven
      // (`showLamps`), 'brake' holds the brake lights too. Returns ids and types.
      carLineup(types, x = player.x + 60, y = player.y - 160, heading = 0, spacing = 44, color, lamps = false) {
        const list = Array.isArray(types) && types.length ? types : CIVILIAN_LINEUP;
        let along = 0;
        return list.map((type) => {
          if (!VEHICLE_DEFINITIONS[type]) throw Error('Unknown vehicle type ' + type);
          const spec = VEHICLE_DEFINITIONS[type],
            gap = Math.max(spacing, spec.w + 14),
            c = makeCar(type, x - Math.sin(heading) * along, y + Math.cos(heading) * along, heading, false, color || spec.color);
          along += gap;
          if (lamps) c.showLamps = lamps;
          return { id: c.id, type, name: spec.name };
        });
      },
      // Helicopter review (helicopter3d.js): parks one helicopter of each look
      // ('police', 'news', 'executive', the civil schemes 'civil:classic', 'civil:yellow',
      // 'civil:silver', 'civil:noir', and 'military', or the `looks` given) in a row east
      // from (x, y), `spacing` apart, facing `heading`; `rotors` true spins them up (with
      // the police lights running). Returns the ids and looks.
      helicopterLineup(x = player.x + 120, y = player.y - 200, heading = 0, rotors = false, spacing = 110, looks = null) {
        const list = Array.isArray(looks) ? looks : ['police', 'news', 'executive', 'civil:classic', 'civil:yellow', 'civil:silver', 'civil:noir', 'military'];
        return list.map((heliLook, i) => {
          const c = makeCar('helicopter', x + i * spacing, y, heading, false);
          Object.assign(c, { heliLook, showRotor: !!rotors, showLights: rotors ? 'pursuit' : false });
          return { id: c.id, look: heliLook };
        });
      },
      // Every helicopter model built: look, rotor spool, draw calls, shadow casters,
      // triangles, crew shown (helicopter3d.js).
      helicopterModels: () => city3D?.helicopterModels?.() ?? null,
      // Every civilian car and motorbike model built: draw calls, shadow casters,
      // triangles and the heaviest parts (cars3d.js, motorbikes3d.js).
      carModels: () => city3D?.carModels?.() ?? null,
      // Dynamic resolution by hand (0.5..1 of the canvas; tests of the scaled scene
      // pass). On AUTO the adaptive controller may change it again.
      renderScale(scale) {
        return city3D?.setRenderScale?.(Number(scale) || 1) ?? null;
      },
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
      /* The player's road vehicle through the tyre model (driving.js): the
         assists it has and has switched on, the HUD lamps, the pedal and
         steering ramps, each axle's slip, lock, ABS pressure and sideways share,
         the wheelspin and the stability yaw. */
      drivingState() {
        const c = player.car;
        if (!c || isAircraft(c) || isBoat(c)) return null;
        const ch = drivingCharacter(c),
          t = c.tyres,
          round = (v) => +(+v).toFixed(3);
        return {
          type: c.type,
          fitted: { abs: ch.abs, esc: ch.esc, tcs: ch.tcs },
          lamps: drivingAssistStates(c),
          character: { front: ch.front, cgOverWheelbase: ch.hL, bias: round(ch.bias), drive: ch.drive, liftOff: round(ch.liftOff) },
          settings: { ...drivingSettings },
          tyres: t
            ? {
                pedal: round(t.pedal),
                steer: round(t.steer),
                slip: t.slip.map(round),
                lock: t.lock.map(round),
                pressure: t.pressure.map(round),
                lateral: t.lateral.map(round),
                spin: round(t.spin),
                yawSlide: round(t.yawSlide),
                decelG: round(t.lastDecel || 0),
              }
            : null,
          absActive: !!c.absActive,
          tyreSlip: round(c.tyreSlip || 0),
        };
      },
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
      // Show the ambient-occlusion or bloom buffer instead of the image ('ao',
      // 'bloom'; nothing for the image) to tune the post-processing.
      postView: (mode) => city3D?.postView?.(mode) ?? null,
      groundDetail: () => city3D?.groundReport?.() ?? null,
      // The helicopter searchlight's state, screen points and shaft / pool switches.
      searchlight: (options) => city3D?.searchlight?.(options) ?? null,
      // Scene draw calls in view by object name and by map cell (render3d.js).
      drawProfile: (top) => city3D?.drawProfile?.(top) ?? null,
      // Shadow casters near the view that the camera pass does not show.
      // What casts the sun's shadow onto the ground point (x, y).
      shadowProbe: (x, y) => city3D?.shadowProbe?.(Number(x), Number(y)) ?? null,
      // With `everywhere`, every see-through caster in the scene.
      shadowCasters: (limit, everywhere) => city3D?.shadowCasters?.(limit, !!everywhere) ?? null,
      // Average CPU milliseconds per frame since the last call, plus renderer counters.
      stats() {
        const n = Math.max(1, profile.frames),
          info = city3D?.info?.() || null,
          out = {
            frames: profile.frames,
            updateMs: +(profile.update / n).toFixed(2),
            drawMs: +(profile.draw / n).toFixed(2),
            frameMs: +(profile.frameGap / n).toFixed(1),
            drawCalls: info?.calls ?? null,
            triangles: info?.triangles ?? null,
            // Whether the shadow map was redrawn (its calls included) in that frame,
            // and calls including the post-processing passes.
            shadowFrame: info?.shadowFrame ?? null,
            // Camera-only calls, and the shadow map's calls on its last refresh.
            viewCalls: info?.viewCalls ?? null,
            shadowCalls: info?.shadowCalls ?? null,
            frameCalls: info?.frameCalls ?? null,
            renderScale: city3D?.quality?.().renderScale ?? null,
            sceneObjects: info?.objects ?? null,
            programs: info?.programs ?? null,
            byType: info?.byType ?? null,
            vehicles: vehicles.length,
            pedestrians: pedestrians.length,
            parts: Object.fromEntries(
              Object.entries(profile.parts)
                .map(([k, v]) => [k, +(v / n).toFixed(2)])
                .sort((a, b) => b[1] - a[1]),
            ),
          };
        profile.frames = profile.update = profile.draw = profile.frameGap = 0;
        profile.parts = {};
        return out;
      },
    });
