    // Notification feed behind tell(): lines stack in #toast, newest first, at most NOTICE_MAX
    // (two on a phone); a repeat refreshes its own line; readable durations; a tone per kind of news.
    /**
     * NOTIFICATIONS
     * tell(text, seconds, { id, tone }) (game.js) posts a line. Nothing
     * overwrites anything any more: a new line slides in on top and the older
     * ones stay below it, dimmed, until their own time is up; past the limit
     * the oldest goes first. A line whose identity is already up (the same
     * `id`, or the same words with the numbers taken out, as the prompt does)
     * only has its text and time refreshed, so a counter or a line posted every
     * frame never piles up or restarts its entry.
     * Every line stays at least long enough to read (noticeLife: about a quarter
     * second a word, 1.5 to 7 s), never less than the caller asked. The clock
     * is the HUD's (wall time plus DeadEndCity.simulate()'s steps), so a slow
     * frame rate cannot leave a line up for minutes.
     * Tones colour the edge: police (the law is involved), warn (refused, out
     * of something, danger), good (paid, done, gained), info. Callers may pass
     * one; otherwise noticeTone() reads it from the words.
     */
    const NOTICE_MAX = 3,
      NOTICE_MAX_PHONE = 2;
    const notices = [];
    function noticeNow() {
      try {
        return hudNow();
      } catch {
        // tell() during boot, before hud-state.js has run.
        return performance.now() / 1000;
      }
    }
    function noticeLife(text, seconds) {
      const words = String(text).trim().split(/\s+/).length;
      return Math.max(Number(seconds) || 3, clamp(1.1 + words * 0.24, 1.5, 7));
    }
    function noticeTone(text) {
      const t = String(text).toUpperCase();
      if (/POLICE|\b911\b|WITNESS|WANTED|AIR SUPPORT|HELICOPTER LOST|BUSTED|SWAT|ROADBLOCK|COPS\b/.test(t)) return 'police';
      if (/NOT ENOUGH|YOU NEED \$|NEED \$|CANNOT|CAN'T|CAN NOT|LOCKED|BANNED|CLOSED|OUT OF|EMPTY|\bFIRE\b|SINKING|DANGER|WARNING|STALL|DESTROYED|FAILED|TOO (STEEP|FAST|LOW|HIGH|FAR)|NOT WHILE|OUT OF BREATH/.test(t))
        return 'warn';
      if (/^\+\s?\$|\bCOMPLETE\b|REARMED|DOCKED|EQUIPPED|REPAIRED|UNLOCKED|PURCHASED|BOUGHT|COLLECTED|PICKED UP|REWARD|BONUS|\bPAID\b/.test(t)) return 'good';
      return 'info';
    }
    function noticeId(text) {
      return String(text).replace(/[\d.,:$%]+/g, '#');
    }
    function noticeLimit() {
      return document.body?.classList.contains('touch-mode') && innerWidth <= 600 ? NOTICE_MAX_PHONE : NOTICE_MAX;
    }
    function notify(text, seconds = 3, options = {}) {
      if (text === undefined || text === null || text === '') return;
      text = String(text);
      const box = getElement('toast'),
        now = noticeNow(),
        id = options.id || noticeId(text),
        life = noticeLife(text, seconds),
        tone = options.tone || noticeTone(text);
      let note = notices.find((n) => n.id === id && !n.leaving);
      if (note) {
        // The same line again: new words and a fresh clock, no new entry. Only a
        // real change (or a line nearly out of time) replays the timer bar.
        const changed = note.text !== text;
        note.text = text;
        note.tone = tone;
        note.until = Math.max(note.until, now + life);
        note.life = life;
        if (note.el.dataset.tone !== tone) note.el.dataset.tone = tone;
        if (changed) note.el.firstChild.textContent = text;
        if (changed || note.until - now < life * 0.5) restartNoticeTimer(note);
      } else {
        const el = document.createElement('div'),
          words = document.createElement('span'),
          timer = document.createElement('i');
        el.className = 'note';
        el.dataset.tone = tone;
        words.textContent = text;
        timer.className = 'note-timer';
        timer.setAttribute('aria-hidden', 'true');
        el.append(words, timer);
        note = { id, text, tone, life, until: now + life, at: now, el, leaving: false };
        notices.unshift(note);
        box.prepend(el);
        restartNoticeTimer(note);
      }
      // Raised while a full-screen panel is up (hud.js PANEL COVER): about the
      // panel, so it shows over it. (The class, not hudCovered(): tell() runs
      // during boot, before hud.js's constants exist.)
      box.classList.toggle('over-panel', document.body.classList.contains('panel-open'));
      // (add() rewrites the class attribute even when the class is there: a DOM mutation per repeated line.)
      if (!box.classList.contains('show')) box.classList.add('show');
      trimNotices();
      markOlderNotices();
      if (typeof freshToast === 'function')
        try {
          freshToast();
        } catch {}
    }
    function restartNoticeTimer(note) {
      const bar = note.el.lastChild;
      // The animation restarts once 'none' has been through a style pass: a computed-style read is that pass (it
      // used to be offsetWidth, which lays out the whole page as well).
      bar.style.animation = 'none';
      void getComputedStyle(bar).animationName;
      bar.style.animation = '';
      note.el.style.setProperty('--note-life', Math.max(0.1, note.until - noticeNow()).toFixed(2) + 's');
    }
    function markOlderNotices() {
      let first = true;
      for (const n of notices) {
        if (n.leaving) continue;
        n.el.classList.toggle('older', !first);
        first = false;
      }
    }
    function trimNotices() {
      const live = notices.filter((n) => !n.leaving);
      for (let i = live.length - 1; i >= noticeLimit(); i--) dismissNotice(live[i]);
    }
    function dismissNotice(note, at = noticeNow()) {
      if (note.leaving) return;
      note.leaving = true;
      note.goneAt = at + 0.28;
      note.el.classList.add('leaving');
    }
    /* Every frame (game-loop.js): lines past their time leave, then are removed. */
    function updateNotices() {
      if (!notices.length) return;
      const now = noticeNow();
      let changed = false;
      for (let i = notices.length - 1; i >= 0; i--) {
        const n = notices[i];
        if (!n.leaving && now >= n.until) {
          dismissNotice(n, now);
          changed = true;
        }
        if (n.leaving && now >= n.goneAt) {
          n.el.remove();
          notices.splice(i, 1);
          changed = true;
        }
      }
      if (changed) markOlderNotices();
      // (remove() rewrites the class attribute even when the class is gone: a DOM mutation every frame of a leave.)
      const box = getElement('toast');
      if (box.classList.contains('show') && !notices.some((n) => !n.leaving)) box.classList.remove('show');
    }
    /* Clear the feed at once (a teleport out of the water, a new game). */
    function clearNotices() {
      for (const n of notices) n.el.remove();
      notices.length = 0;
      getElement('toast').classList.remove('show');
    }
    /* DeadEndCity.notices(): what the feed shows, newest first. */
    function noticesReport() {
      const now = noticeNow();
      return notices.map((n) => ({
        text: n.text,
        tone: n.tone,
        left: +Math.max(0, n.until - now).toFixed(2),
        life: +n.life.toFixed(2),
        leaving: n.leaving,
      }));
    }
