    // BEGIN SUBSYSTEM: src/game-console-leisure.js — DeadEndCity console, leisure: swim, beach, sea life, Marea club and pool, volleyball, Sunset Pier (+ sports, sportsbook consoles)
    // Beach, sea and leisure: swimming, the beach, sea life, the Marea club and pool,
    // beach volleyball, Sunset Pier rides; the sports and sportsbook consoles.
    addConsoleMethods('leisure', {
      // The player and the water: swimming, wading, stamina, shore type and the
      // nearest way out (see water.js).
      swim: () => swimStatus(),
      // Every ladder out of the sea: foot in the water, top on the quay.
      ladders: () =>
        ladderList().map((l) => ({
          kind: l.kind,
          x: Math.round(l.x),
          y: Math.round(l.y),
          top: { x: Math.round(l.top.x), y: Math.round(l.top.y) },
        })),
      // Palm Keys Beach: how busy it is and what everyone is doing (beach.js).
      beach: () => beachStatus(),
      // Sea life (sealife.js): dolphin pods, gull flocks, the shark, the encounter
      // (phase, interest, cooldown, way out, outcomes), the beach alarm, the log
      // and the renderer's counts and cost.
      sealife: () => sealifeReport(),
      // Start the shark encounter (puts the player in deep water off Palm Keys
      // Beach first if needed); stage 'approach' (default), 'circle', 'breach',
      // 'fin' (the fin up nearby, no encounter) or 'beach' (a pass along the buoys).
      sharkAttack: (stage) => sharkAttackConsole(stage),
      // A pod of dolphins near the player (or at x, y) that starts leaping.
      spawnDolphins: (count, x, y, leap) => spawnDolphinsConsole(count, x, y, leap),
      // The Marea pool (clubpool.js): the water, the player's phase in it (dive,
      // swim, out), whether SWIM / GET OUT are offered, breath, club swimmers.
      clubPool: () => clubPoolReport(),
      // Stand on the deck at the pool's south edge (then interact() dives in).
      clubPoolEdge: () => clubPoolEdge(),
      // Club conversations (clubtalk.js): the script count by personality, the one
      // running (lines, pose), the candidate and stand timer, the bubbles on screen.
      clubTalk: () => clubTalkReport(),
      // Stand beside the nearest club-goer who can talk (standing still starts it).
      clubTalkApproach: () => clubTalkApproach(),
      // Beach volleyball (beachvolley.js): court, phase, score, ball, players, the
      // player in the match, rallies and the recent log.
      volley: () => volleyReport(),
      // Step onto the court on a side (0 west, 1 east) and join the match.
      volleyJoin: (team = 0) => volleyJoinConsole(team),
      // Lob the ball from across the net to the player in the match.
      volleyLob: () => volleyLobToPlayer(),
      // The court against the beach plan: anything laid on it or its clear zone.
      volleyCourtCheck: () => volleyCourtCheck(),
      // Marea Beach Club: phase, levels, who is where, the queue and the door,
      // the music (beachclub.js). `beachClub('trouble')` raises gunfire on its
      // dance floor as if someone fired there, for tests of the evacuation.
      beachClub(action) {
        if (action === 'trouble') {
          const p = mareaPoint(205, 140);
          notifyViolence(p, 'gunfire', null);
        }
        return beachClubReport();
      },
      // Sunset Pier: ride states, the coaster's numbers, shows, guests and an overlap check.
      themePark: () => parkReport(),
      // Board the Falcon ('coaster') or the Sunset Eye ('wheel') from its platform.
      boardRide(kind = 'coaster') {
        rideAttraction(kind);
        return parkReport().riding;
      },
      // The Falcon riders' scream cues (track position, height, vertical speed, g) and lines; `reset` clears the log.
      coasterVoices: (reset = false) => falconVoicesReport(!!reset),
    });
    // Match day: match(), ballState(), matchDay(), fixtures(), ballToPlayer()
    // (see sports.js sportsConsole).
    addConsoleMethods('sports', sportsConsole());
    // GOALLINE, the betting shop by the stadium: markets, odds, bets (sportsbook.js).
    addConsoleMethods('sportsbook', sportsbookConsole());
    // END SUBSYSTEM: src/game-console-leisure.js
