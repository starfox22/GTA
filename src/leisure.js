    // BEGIN SUBSYSTEM: src/leisure.js — Beach and club leisure: prompt and action key
    /**
     * Beach and club leisure
     * Source: src/leisure.js
     * Scope: shared game closure.
     *
     * One place that decides what the action key (E) means for the leisure
     * activities, so the prompt and the key always agree: beach volleyball
     * (beachvolley.js: JOIN MATCH, SERVE, HIT, LEAVE MATCH), the Marea pool
     * (clubpool.js: SWIM, GET OUT) and the club conversations (clubtalk.js: TALK).
     * `leisurePrompt()` is offered from updateUI (game.js) through the HUD's
     * single prompt owner (hud.js offerPrompt); `leisureInteract()` runs from
     * interact(); `updateLeisure()` steps the conversations and the drips.
     */
    function leisurePrompt() {
      if (gameMode !== 'play' || player.car) return null;
      const game = volleyPrompt();
      if (game || volleyPlayerInMatch()) return game;
      // By the pool (or in it) the pool comes first; standing still next to someone
      // still starts a conversation on its own (clubtalk.js).
      return clubPoolPrompt() || clubTalkPrompt();
    }
    function leisureInteract() {
      if (gameMode !== 'play' || player.car) return false;
      if (volleyPlayerInMatch()) return volleyInteract();
      const offer = leisurePrompt();
      if (offer?.id === 'volley-join') return volleyInteract();
      if (offer?.id?.startsWith('marea-pool')) return clubPoolInteract();
      if (offer?.id === 'marea-talk' || clubTalk.active) return clubTalkInteract();
      if (player.pool) return clubPoolInteract();
      return false;
    }
    function updateLeisure(deltaSeconds) {
      if (!marea.near && !clubTalk.active && gameTime > poolState.wetUntil) return;
      updateClubTalk(deltaSeconds);
      updatePoolDrips(deltaSeconds);
    }
    // END SUBSYSTEM: src/leisure.js
