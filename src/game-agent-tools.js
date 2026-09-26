    // Optional browser agent access uses exactly the same actions as the controls.
    if (document.modelContext?.registerTool) {
      const noArgs = {
        type: 'object',
        properties: {},
        additionalProperties: false,
      };
      const validate = (x) => {
        if (!x || typeof x !== 'object' || Array.isArray(x) || Object.keys(x).length)
          throw Error('This action takes an empty object.');
      };
      for (const tool of [
        {
          name: 'read_game_status',
          title: 'Read game status',
          description: 'Read the current mission, health, cash, wanted level and vehicle.',
          inputSchema: noArgs,
          annotations: {
            readOnlyHint: true,
          },
          execute(input) {
            validate(input);
            return {
              mode: gameMode,
              mission: mission ? missions[mission.index].title : null,
              jobsCompleted: completed,
              health: Math.ceil(player.hp),
              cash,
              wanted: Math.ceil(wantedStars),
              vehicle: player.car ? VEHICLE_DEFINITIONS[player.car.type].name : null,
            };
          },
        },
        {
          name: 'start_game',
          title: 'Start game',
          description: 'Enter the city from the start screen.',
          inputSchema: noArgs,
          annotations: {
            readOnlyHint: false,
          },
          execute(input) {
            validate(input);
            if (gameMode !== 'menu') throw Error('The game has already started.');
            begin();
            return {
              mode: gameMode,
            };
          },
        },
        {
          name: 'pause_game',
          title: 'Pause game',
          description: 'Pause an active game and show its pause menu.',
          inputSchema: noArgs,
          annotations: {
            readOnlyHint: false,
          },
          execute(input) {
            validate(input);
            if (gameMode !== 'play') throw Error('The game is not running.');
            togglePause();
            return {
              mode: gameMode,
            };
          },
        },
      ])
        try {
          Promise.resolve(document.modelContext.registerTool(tool)).catch(() => {});
        } catch {}
    }
