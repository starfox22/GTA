    // Mission briefs: the big centred sentence that says what a story step is about (missions 3-4), held a few
    // seconds, then folded down into the mission card's one-line strip at the bottom (missionBrief, updateMissionBrief).
    /**
     * MISSION BRIEF
     * A job's step opens with one plain sentence in the upper middle of the screen ("Vinny asked you to
     * collect a buried package..."), above the player and under the waypoint pill. After its reading time
     * (game time, so a pause holds it) it drops into the pager strip, which keeps the short objective
     * (setStage's instruction). One at a time: a brief asked for while another shows replaces it; one asked
     * for while a headline card (#announcement) is still centred waits for it, so a title card or COVER
     * BLOWN reads first. The mission card key (O) folds it early. Missions only: with no job it folds.
     */
    const MISSION_BRIEF_FOLD = 0.8;
    const missionBriefState = { text: '', kicker: '', tone: '', queued: null, phase: 'idle', until: 0, foldEnd: 0, shown: 0 };
    // Ask for a brief: `options` { kicker, tone: 'alert' | '' , seconds }.
    function missionBrief(text, options = {}) {
      if (!mission || !text) return;
      missionBriefState.queued = { text, kicker: options.kicker || 'NEW OBJECTIVE', tone: options.tone || '', seconds: options.seconds || 0 };
    }
    // Reading time: about a word every 0.28 s on top of two seconds, between 4.5 and 10.
    function missionBriefSeconds(text) {
      return clamp(2 + text.split(/\s+/).length * 0.28, 4.5, 10);
    }
    function missionBriefShowing() {
      return missionBriefState.phase === 'show';
    }
    function foldMissionBrief() {
      const B = missionBriefState;
      if (B.phase !== 'show') return false;
      B.phase = 'fold';
      B.foldEnd = gameTime + MISSION_BRIEF_FOLD;
      const el = getElement('missionBrief');
      el.classList.remove('show');
      el.classList.add('fold');
      // The strip it lands in glows as it arrives.
      const pager = getElement('pager');
      pager.classList.remove('brief-land');
      void getComputedStyle(pager).animationName;
      pager.classList.add('brief-land');
      return true;
    }
    function headlineCentred() {
      const card = getElement('announcement');
      return announceTime > 0 && card.classList.contains('show') && !card.classList.contains('docked');
    }
    // Every HUD pass (game-ui.js updateUI).
    function updateMissionBrief() {
      const B = missionBriefState,
        el = getElement('missionBrief');
      if (!mission) {
        B.queued = null;
        if (B.phase === 'show') foldMissionBrief();
      }
      // A headline card coming up in the middle (COVER BLOWN, PACKAGE RECOVERED) takes the brief's place.
      if (B.phase === 'show' && headlineCentred()) foldMissionBrief();
      if (B.queued && !headlineCentred()) {
        const q = B.queued;
        B.queued = null;
        B.text = q.text;
        B.kicker = q.kicker;
        B.tone = q.tone;
        B.phase = 'show';
        B.shown++;
        B.until = gameTime + (q.seconds || missionBriefSeconds(q.text));
        getElement('missionBriefKicker').textContent = q.kicker;
        getElement('missionBriefText').textContent = q.text;
        el.classList.toggle('alert', q.tone === 'alert');
        el.classList.remove('fold', 'show');
        void getComputedStyle(el).animationName;
        el.classList.add('show');
        if (q.tone === 'alert') {
          tone(330, 0.22, 0.07, 'square', 220);
          tone(247, 0.3, 0.06, 'square', 165);
        } else {
          tone(784, 0.09, 0.045, 'sine');
          tone(1175, 0.16, 0.035, 'sine');
        }
      }
      if (B.phase === 'show' && gameTime >= B.until) foldMissionBrief();
      if (B.phase === 'fold' && gameTime >= B.foldEnd) {
        B.phase = 'idle';
        el.classList.remove('fold');
      }
      // Held off screen outside play (menus, the records office's black, a lift).
      const held = gameMode !== 'play';
      if (el.classList.contains('held') !== held) el.classList.toggle('held', held);
    }
    function missionBriefReport() {
      const B = missionBriefState;
      return {
        phase: B.phase,
        text: B.phase === 'idle' ? null : B.text,
        kicker: B.phase === 'idle' ? null : B.kicker,
        tone: B.tone || null,
        left: B.phase === 'show' ? +(B.until - gameTime).toFixed(2) : 0,
        queued: B.queued ? B.queued.text : null,
        shown: B.shown,
      };
    }
