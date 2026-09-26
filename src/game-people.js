    /**
     * PEDESTRIAN LIFE
     * Everyday chatter lives here; how people walk, what they do and how they
     * react to danger is in src/crowd.js, which also has the reaction lines.
     * All timers are seconds.
     */
    const PED_LINES = {
      panic: ['Get down!', 'Run!', 'He’s got a gun!', 'Call the cops!', 'Oh my god!', 'Somebody help!'],
      nearMiss: ['Hey! Watch it!', 'Slow down!', 'Are you crazy?!', 'I’ve got your plate!', 'Sidewalk, pal!'],
      bump: ['Watch it.', 'Excuse me!', 'Hey!', 'Do you mind?', 'Careful, buddy.'],
      idle: [
        'Nice night.',
        'Bus is late again.',
        'Did you see the game?',
        'I need a coffee.',
        'This city...',
        'Rent’s due Friday.',
        'Neon 88.7 all night.',
        'Kola tastes like pennies.',
        'Ferry’s cancelled. Again.',
        'Heard shots by the docks.',
      ],
      wanted: ['It’s him!', 'That’s the guy from the news!', 'Don’t look at him.', 'Cops are everywhere tonight.'],
      gym: [
        'Three more. Three.',
        'Control the negative, don’t drop.',
        'Elbows in on the dip.',
        'That set was clean.',
        'Thirty seconds rest, then again.',
        'You’re kipping. Strict or it doesn’t count.',
        'Grip goes before the back does.',
        'Chalk’s in my bag if you want it.',
        'Muscle-up by summer. I mean it this time.',
        'Legs tomorrow. Always tomorrow.',
        'Full range or it’s half a rep.',
        'Breathe out on the way up.',
        'Rings are wet, go easy.',
        'Twelve. New best.',
      ],
      vendor: [
        'Two tacos, no onion, coming up.',
        'Coffee’s fresh, five minutes old.',
        'Cash only, friend.',
        'Noodles are ready in a minute.',
        'Best lunch in the Garden.',
      ],
      shore: [
        'Best view in the city, right here.',
        'Ferry horn. Must be six already.',
        'Look at that liner.',
        'Smell that? Rain coming.',
        'Same walk every evening. Never gets old.',
        'Careful, the rail is wet.',
        'One more lap, then coffee.',
      ],
      deck: [
        'The whole skyline from up here!',
        'Sailing sets at six, they said.',
        'Is that the tower district?',
        'I am never getting off this boat.',
        'Photo by the rail, come on.',
        'The buffet reopens at four.',
        'Look how small the taxis are.',
        'Sea air. Finally.',
      ],
    };
    function pedSay(p, kind, chance = 1) {
      if ((p.speechUntil || 0) > gameTime || seededRandom() > chance) return;
      p.speech = randomChoice(PED_LINES[kind]);
      p.speechUntil = gameTime + 2.6;
    }
    function shopfrontNear(p) {
      // Standing on a south sidewalk directly in front of a building's street face.
      return buildingsNear(p.x, p.y - 14).some(
        (b) => !b.depotWall && p.x > b.x + 8 && p.x < b.x + b.w - 8 && Math.abs(p.y - (b.y + b.h + 14)) < 9,
      );
    }
    function nearestFreeBench(p, range) {
      let best = null,
        bestDistance = range;
      for (const spot of benchSpots()) {
        if (spot.taken && spot.taken.hp > 0 && spot.taken !== p) continue;
        const d = distanceBetween(p, spot);
        if (d < bestDistance) {
          best = spot;
          bestDistance = d;
        }
      }
      return best;
    }
    let peopleFrame = 0;
    /**
     * The per-frame pass over pedestrians. Special populations (ship decks,
     * promenade strollers, theme-park guests, carjacked drivers, gym regulars,
     * park walkers) run their own routines first; everyone else is handed to the
     * crowd (src/crowd.js): perception and reactions, street scenes, and the
     * ordinary walk along the sidewalk grid.
     */
    function updatePeople(frameDelta) {
      peopleFrame++;
      updateCrowd(frameDelta);
      const playerMoving = !player.car && (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight);
      for (let index = 0; index < pedestrians.length; index++) {
        const p = pedestrians[index];
        if (
          p.hp <= 0 ||
          personIncapacitated(p) ||
          Math.abs(p.x - player.x) > 1500 ||
          Math.abs(p.y - player.y) > 1500
        )
          continue;
        // Out of sight, people think and move every fourth frame (every sixth
        // beyond ~900 units); nobody can see the coarser steps.
        let deltaSeconds = frameDelta;
        if (!crowdInView(p.x, p.y, 140)) {
          const every = Math.abs(p.x - player.x) > 900 || Math.abs(p.y - player.y) > 900 ? 6 : 4;
          if ((peopleFrame + index) % every) continue;
          deltaSeconds = frameDelta * every;
        }
        if (p.onDeck) {
          updateDeckWalker(p, deltaSeconds);
          continue;
        }
        if (!p.look) ensureLook(p);
        // MONARCH MOTORS' staff and visitors (dealership-people.js).
        if (updateDealerPerson(p, deltaSeconds)) continue;
        if (updateStroller(p, deltaSeconds)) continue;
        if (updateParkGuest(p, deltaSeconds)) continue;
        if (updateIsleWalker(p, deltaSeconds)) continue;
        if (updateCarjackReactions(p, deltaSeconds)) continue;
        if (updateClubGoer(p, deltaSeconds)) continue;
        if (updateCrowdPerson(p, deltaSeconds)) continue;
        if (updateGymGoer(p, deltaSeconds)) continue;
        if (updateParkWalker(p, deltaSeconds)) continue;
        // Everyday remarks to the player: bumped into, or recognised while wanted.
        const playerDistance = distanceBetween(p, player);
        if (playerDistance < 140) {
          if (playerMoving && playerDistance < 9) pedSay(p, 'bump', 0.5);
          else if (wantedStars >= 2 && seededRandom() < deltaSeconds * 0.25) {
            pedSay(p, 'wanted');
            p.sawPlayerAt = gameTime;
          }
        }
        updateStreetWalker(p, deltaSeconds);
      }
      updateGangFights(frameDelta);
    }
