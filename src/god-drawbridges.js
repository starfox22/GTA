    // God mode settings · DRAWBRIDGES: raise or lower every drawbridge or one at a time, through each bridge's own opening (godDrawbridges).
    /**
     * A row on the GOD MODE tab (god-panel.js SETTING_ROWS.god): a chip for ALL
     * and one per drawbridge (drawbridgeList), RAISE NOW and LOWER. Raising goes
     * through the drawbridge's own sequence (drawbridgeOpenNow: horn and bells,
     * the gates come down, the span is cleared, the locks draw, then the leaves
     * swing up; its ship sails if she is at anchor); lowering brings the leaves
     * down, seats and locks them and lifts the gates (drawbridgeCloseNow). Nothing
     * jumps: the world behind the menu moves on when play resumes. The status line
     * says what each one is doing.
     */
    let godBridgePick = 'all',
      godBridgeFlash = 0,
      godBridgeLast = null;
    // Short names for the chips.
    function godBridgeShortName(d) {
      return (d.plan.title || d.bridge.name).toUpperCase().replace(/ (CAUSEWAY|BRIDGE|VIADUCT)$/, '');
    }
    function godBridgeTargets(pick = godBridgePick) {
      const list = drawbridgeList();
      return pick === 'all' ? list : list.filter((d) => d.id === pick);
    }
    // 'raise' or 'lower' the picked drawbridges ('all' or a bridge id): what each is doing after.
    function godDrawbridges(action, pick = godBridgePick) {
      const targets = godBridgeTargets(pick);
      for (const d of targets) {
        drawbridgeArms(d);
        if (action === 'raise') drawbridgeOpenNow(d, 'god');
        else if (action === 'lower') drawbridgeCloseNow(d);
      }
      godBridgeLast = { action, pick, at: Math.round(gameTime * 10) / 10, bridges: targets.map((d) => ({ id: d.id, phase: d.phase })) };
      return godBridgeLast;
    }
    function godBridgeStatus() {
      const list = drawbridgeList(),
        up = list.filter(drawbridgeSpanClosed),
        working = list.filter((d) => d.phase !== 'idle' && !drawbridgeSpanClosed(d));
      if (!up.length && !working.length) return 'All ' + list.length + ' are down and open to traffic.';
      const say = (d) => godBridgeShortName(d).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) + ' ' + (d.phase === 'open' ? 'up' : d.phase);
      return [...up, ...working].map(say).join(' · ') + '.';
    }
    function renderGodDrawbridgeRow(body) {
      const row = godRow('godBridges', 'god-action-row god-bridges-row'),
        list = drawbridgeList(),
        options = [['all', 'ALL'], ...list.map((d) => [d.id, godBridgeShortName(d)])],
        group = settingsElement('div', 'settings-choice god-choice god-bridge-choice'),
        side = settingsElement('div', 'god-action-side'),
        done = settingsElement('span', 'god-done', godBridgeLast?.action === 'lower' ? 'LOWERING' : 'RAISING');
      if (!options.some(([id]) => id === godBridgePick)) godBridgePick = 'all';
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-label', 'Which drawbridge');
      options.forEach(([id, label]) => {
        const b = settingsElement('button', '', label);
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(id === godBridgePick));
        b.dataset.bridge = id;
        b.tabIndex = id === godBridgePick ? 0 : -1;
        if (id === godBridgePick) {
          b.dataset.focus = 'godBridges';
          b.dataset.nav = '';
        }
        b.onclick = () => {
          godBridgePick = id;
          renderSettings('godBridges');
        };
        b.onkeydown = (e) => {
          const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          e.stopPropagation();
          const at = options.findIndex(([o]) => o === godBridgePick);
          godBridgePick = options[(at + step + options.length) % options.length][0];
          renderSettings('godBridges');
        };
        group.append(b);
      });
      done.setAttribute('role', 'status');
      if (godBridgeFlash && performance.now() - godBridgeFlash < 2600) done.classList.add('show');
      const act = (action) => () => {
          godDrawbridges(action);
          godBridgeFlash = performance.now();
          renderSettings('godBridges');
        },
        raise = godActionButton('godBridgesRaise', 'RAISE NOW', act('raise')),
        lower = godActionButton('godBridgesLower', 'LOWER', act('lower'));
      raise.dataset.action = 'raise';
      lower.dataset.action = 'lower';
      lower.classList.add('god-action-lower');
      side.append(done, raise, lower);
      row.append(godLabel('Drawbridges', 'Open one or all now: bells, gates, the span cleared, then the leaves rise. ' + godBridgeStatus()), group, side);
      body.append(row);
    }
    // Console (game-console-core.js): the panel's buttons, and what it shows.
    function godDrawbridgeConsole() {
      return {
        // 'raise' / 'lower' the picked drawbridges ('all' or a bridge id), as the panel's buttons do.
        godDrawbridges(action = 'status', pick = 'all') {
          if (action !== 'status') {
            if (!player.godMode) throw Error('godDrawbridges needs god mode');
            if (action !== 'raise' && action !== 'lower') throw Error("godDrawbridges action is 'raise', 'lower' or 'status'");
            godDrawbridges(action, pick);
          }
          return { pick: godBridgePick, last: godBridgeLast, status: godBridgeStatus(), bridges: drawbridgeList().map((d) => ({ id: d.id, chip: godBridgeShortName(d), phase: d.phase, angle: +((d.angle * 180) / Math.PI).toFixed(1) })) };
        },
        /* Open Settings on the GOD MODE tab from play (as typing the cheat in play
           does), the drawbridge row scrolled into view: its chips and buttons as
           client-pixel centres for tests that click them. `close` goes back to play. */
        godDrawbridgePanel(close = false) {
          if (close) {
            if (gameMode === 'settings') closeSettings();
            if (gameMode === 'pause') togglePause();
            return { mode: gameMode };
          }
          if (!player.godMode) throw Error('godDrawbridgePanel needs god mode');
          if (gameMode === 'play') togglePause();
          if (gameMode === 'pause') openSettings('god');
          const row = getElement('settingsBody').querySelector('[data-row="godBridges"]');
          if (!row) return { mode: gameMode, row: false };
          row.scrollIntoView({ block: 'center' });
          const centre = (el) => {
            const r = el.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) };
          };
          return {
            mode: gameMode,
            row: true,
            chips: [...row.querySelectorAll('[data-bridge]')].map((b) => ({ id: b.dataset.bridge, label: b.textContent, checked: b.getAttribute('aria-checked') === 'true', ...centre(b) })),
            buttons: [...row.querySelectorAll('[data-action]')].map((b) => ({ action: b.dataset.action, label: b.textContent, ...centre(b) })),
            status: row.querySelector('.settings-label small')?.textContent || '',
          };
        },
      };
    }
