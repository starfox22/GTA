    // HUD clearance: the mission card never covers the player (and the dialogue line and the waypoint pill fade if they
    // would). The player's box on screen (the street camera's projection) against the HUD's boxes, read at a frame start.
    /**
     * MISSION CARD CLEARANCE
     * The driving camera keeps a fast vehicle centre-low (camera-drive.js leadShare), so on
     * a small window (960x600) the open mission card (the INCOMING CALL banner) reached
     * up over a bus or a fast car. Now, in every HUD pass:
     *   - hudPlayerBox() puts the player on screen: the vehicle's footprint and roof (or a
     *     standing person) through the street camera (orthographic, pitched as in
     *     flight-view3d.js; worldZoom in force; the 2D view's scale without a renderer), or
     *     in the chase view the box's eight corners through the chase camera;
     *   - while the open card would come within CLEAR_MARGIN px of that box, the card
     *     yields: it shows its one-line strip and its six seconds of reading time wait
     *     (missionCardUntil and the INCOMING CALL notice are held), so it opens for the rest
     *     of them once the spot has been clear for CLEAR_HOLD s; opened on purpose (O, a tap
     *     on the strip: missionCardAsked) it stays open;
     *   - (on a short window a dialogue line folds the card too: game-ui.js missionCardYields,
     *     and the line sits above the strip, radio.css;)
     *   - if even the strip, the dialogue line or the waypoint pill would cover the player,
     *     that one fades (.yield-fade) until the player has been clear for CLEAR_HOLD s.
     * The card's boxes are read at the start of the next frame (runFrame, with the dock line),
     * never after a pass's writes (no forced layout): the open box is remembered from the last
     * time the card stood open. Touch mode keeps the card
     * at the top (touch-hud.css) and only the yield applies there.
     */
    const CLEAR_MARGIN = 18,
      CLEAR_MARGIN_BACK = 30,
      CLEAR_HOLD = 0.6,
      CLEAR_MEASURE_EVERY = 0.3,
      CLEAR_SIN = 680 / Math.hypot(680, 560),
      CLEAR_COS = 560 / Math.hypot(680, 560);
    const cardClear = {
      // The open card and the folded strip where they stood when last measured (screen px), and when.
      open: { l: 0, t: 0, r: 0, b: 0, ok: false },
      strip: { l: 0, t: 0, r: 0, b: 0, ok: false },
      story: { l: 0, t: 0, r: 0, b: 0, ok: false },
      // The waypoint pill (top centre): a long vehicle heading down the screen reaches up to it.
      nav: { l: 0, t: 0, r: 0, b: 0, ok: false },
      fadeNav: false,
      fadeNavAt: -1e9,
      vw: 0,
      vh: 0,
      chaseLayout: false,
      measuredAt: -1,
      want: true,
      key: '',
      // The card is folded for the player's sake (and since when the spot has been clear).
      yielding: false,
      clearSince: 0,
      heldAt: 0,
      fadeCard: false,
      fadeStory: false,
      fadeCardAt: -1e9,
      fadeStoryAt: -1e9,
      player: { l: 0, t: 0, r: 0, b: 0, ok: false },
    };
    /* The player on screen (vehicle or person) as a box in CSS px, written into `out`;
       out.ok false when the view is not the street camera (aircraft, parachute, rides).
       In the chase view: the box's corners through the chase camera (chase-rules.js
       chasePlayerBox), aircraft and parachute included (the chase camera frames them too). */
    function hudPlayerBox(out) {
      const c = player.car;
      out.ok = false;
      if (chaseCameraLive()) return transitRide ? out : chasePlayerBox(out);
      if ((c && isAircraft(c)) || player.parachute || player.coaster || transitRide) return out;
      const body = c || player,
        spec = c ? vehicleSpec(c) : null,
        half = (spec ? spec.l : 14) / 2,
        side = (spec ? spec.w : 10) / 2,
        a = c ? c.a : 0,
        ex = Math.abs(Math.cos(a)) * half + Math.abs(Math.sin(a)) * side,
        ey = Math.abs(Math.sin(a)) * half + Math.abs(Math.cos(a)) * side,
        tall = c ? vehicleCollisionHeight(c) : PERSON_HEIGHT;
      if (!(Number.isFinite(body.x) && Number.isFinite(body.y))) return out;
      if (city3D || NO_RENDER) {
        // The street camera: orthographic, looking north down STREET_PITCH (flight-view3d.js).
        const scale = viewportHeight / (clamp(viewportHeight * 0.68, 430, 630) / Math.max(0.05, worldZoom)),
          lift = (c && isBoat(c) ? 0 : entityElevation(body)) - streetCameraAltitude(),
          cx = viewportWidth / 2 + (body.x - cameraTarget.x) * scale,
          cy = viewportHeight / 2 + ((body.y - cameraTarget.y) * CLEAR_SIN - lift * CLEAR_COS) * scale;
        out.l = cx - ex * scale;
        out.r = cx + ex * scale;
        out.t = cy - (ey * CLEAR_SIN + tall * CLEAR_COS) * scale;
        out.b = cy + ey * CLEAR_SIN * scale;
      } else {
        // The 2D fallback: straight down at canvasScale.
        const cx = (body.x - cameraTarget.x) * canvasScale + viewportWidth / 2,
          cy = (body.y - cameraTarget.y) * canvasScale + viewportHeight / 2;
        out.l = cx - ex * canvasScale;
        out.r = cx + ex * canvasScale;
        out.t = cy - ey * canvasScale;
        out.b = cy + ey * canvasScale;
      }
      out.ok = Number.isFinite(out.l + out.t + out.r + out.b);
      return out;
    }
    function clearBoxesMeet(p, l, t, r, b, margin) {
      return p.ok && p.r + margin > l && p.l - margin < r && p.b + margin > t && p.t - margin < b;
    }
    /* At the start of a frame (runFrame, beside measureDockLine), before anything is written, while the
       last layout is still valid: where the card stands, open or folded, the waypoint pill, and how tall
       the dialogue line is. A few times a second, or at once after the card changed state or the window
       its size. */
    function measureMissionCard() {
      const C = cardClear,
        now = hudNow();
      // A new window size, or a switch between the street and the chase view's layouts (chase-view.css), moves
      // the card: what was measured no longer holds.
      const chaseLayout = document.body.classList.contains('chase-view');
      if (C.vw !== viewportWidth || C.vh !== viewportHeight || C.chaseLayout !== chaseLayout) {
        C.vw = viewportWidth;
        C.vh = viewportHeight;
        C.chaseLayout = chaseLayout;
        C.open.ok = C.strip.ok = C.story.ok = false;
        C.measuredAt = -1;
      }
      if (C.measuredAt >= 0 && now - C.measuredAt < CLEAR_MEASURE_EVERY) return;
      C.measuredAt = now;
      const pager = getElement('pager');
      if (!pager.classList.contains('hidden')) {
        const box = pager.getBoundingClientRect();
        if (box.height > 0) {
          const into = pager.classList.contains('compact') ? C.strip : C.open;
          into.l = box.left;
          into.t = box.top;
          into.r = box.right;
          into.b = box.bottom;
          into.ok = true;
        }
      }
      const nav = getElement('navigation');
      C.nav.ok = false;
      if (nav.style.display !== 'none') {
        const box = nav.getBoundingClientRect();
        if (box.height > 0) {
          C.nav.l = box.left;
          C.nav.t = box.top;
          C.nav.r = box.right;
          C.nav.b = box.bottom;
          C.nav.ok = true;
        }
      }
      const story = getElement('storyLine');
      if (story.classList.contains('show')) {
        const box = story.getBoundingClientRect();
        if (box.height > 0) {
          C.story.l = box.left;
          C.story.t = box.top;
          C.story.r = box.right;
          C.story.b = box.bottom;
          C.story.ok = true;
        }
      } else C.story.ok = false;
    }
    /* The card's state changed: measure again at the next frame start. */
    function remeasureMissionCard() {
      cardClear.measuredAt = -1;
    }
    /* updateMissionCard (game-ui.js): whether the card shows folded. `timerOpen` is its reading time running. */
    function missionCardFolded(timerOpen) {
      const C = cardClear;
      // Opened or folded, or new words on it (a new call, job or objective): its boxes change.
      if (timerOpen !== C.want || missionCardKey !== C.key) {
        C.want = timerOpen;
        C.key = missionCardKey;
        remeasureMissionCard();
      }
      const p = hudPlayerBox(C.player),
        o = C.open,
        covers =
          timerOpen &&
          !missionCardAsked &&
          o.ok &&
          p.ok &&
          gameMode === 'play' &&
          !getElement('pager').classList.contains('hidden') &&
          clearBoxesMeet(p, o.l, o.t, o.r, o.b, C.yielding ? CLEAR_MARGIN_BACK : CLEAR_MARGIN);
      if (covers) {
        if (!C.yielding) remeasureMissionCard();
        C.yielding = true;
        C.clearSince = gameTime;
      } else if (C.yielding && (!timerOpen || missionCardAsked || gameTime - C.clearSince >= CLEAR_HOLD)) {
        C.yielding = false;
        remeasureMissionCard();
      }
      // Hold the reading time while the card yields, so it opens for the rest of it (and the
      // INCOMING CALL notice that keeps the pager up with no job running).
      if (C.yielding && timerOpen) {
        const held = clamp(gameTime - C.heldAt, 0, 0.25);
        missionCardUntil += held;
        if (incomingCallRemaining > 0) incomingCallRemaining += held;
      }
      C.heldAt = gameTime;
      return !timerOpen || C.yielding;
    }
    /* updateHud(): the last-resort fades of the folded card, the dialogue line and the waypoint pill. */
    function placeHudClearance() {
      const C = cardClear,
        pager = getElement('pager'),
        story = getElement('storyLine'),
        hidden = pager.classList.contains('hidden'),
        folded = pager.classList.contains('compact'),
        p = C.player;
      // A fade comes at once and goes CLEAR_HOLD after the player has moved clear (no flicker at the edge).
      if (!hidden && folded && C.strip.ok && gameMode === 'play' && clearBoxesMeet(p, C.strip.l, C.strip.t, C.strip.r, C.strip.b, 2))
        C.fadeCardAt = gameTime;
      if (C.story.ok && story.classList.contains('show') && gameMode === 'play' && clearBoxesMeet(p, C.story.l, C.story.t, C.story.r, C.story.b, 2))
        C.fadeStoryAt = gameTime;
      const fadeCard = !hidden && folded && gameTime - C.fadeCardAt < CLEAR_HOLD,
        fadeStory = story.classList.contains('show') && gameTime - C.fadeStoryAt < CLEAR_HOLD;
      if (fadeCard !== C.fadeCard) {
        C.fadeCard = fadeCard;
        pager.classList.toggle('yield-fade', fadeCard);
      }
      if (fadeStory !== C.fadeStory) {
        C.fadeStory = fadeStory;
        story.classList.toggle('yield-fade', fadeStory);
      }
      // The waypoint pill fades while it would sit over the player (the minimap and the arrow still point the way).
      if (C.nav.ok && gameMode === 'play' && clearBoxesMeet(p, C.nav.l, C.nav.t, C.nav.r, C.nav.b, 2)) C.fadeNavAt = gameTime;
      const fadeNav = C.nav.ok && gameTime - C.fadeNavAt < CLEAR_HOLD;
      if (fadeNav !== C.fadeNav) {
        C.fadeNav = fadeNav;
        getElement('navigation').classList.toggle('yield-fade', fadeNav);
      }
    }
    /* DeadEndCity.hudClearance(): the player's box on screen, the card's boxes and what yields. */
    function hudClearanceReport(action) {
      const C = cardClear,
        r = (b) => (b.ok ? { l: Math.round(b.l), t: Math.round(b.t), r: Math.round(b.r), b: Math.round(b.b) } : null);
      // 'read': the card opens for a fresh read, as a new call or objective opens it (updateMissionCard).
      if (action === 'read') {
        newCallNotice();
        missionCardKey = '';
        updateUI();
      }
      hudPlayerBox(C.player);
      return {
        viewport: [viewportWidth, viewportHeight],
        player: r(C.player),
        open: r(C.open),
        strip: r(C.strip),
        story: r(C.story),
        folded: getElement('pager').classList.contains('compact'),
        hidden: getElement('pager').classList.contains('hidden'),
        yielding: C.yielding,
        asked: missionCardAsked,
        fadeCard: C.fadeCard,
        fadeStory: C.fadeStory,
        nav: r(C.nav),
        fadeNav: C.fadeNav,
        readLeft: +Math.max(0, missionCardUntil - gameTime).toFixed(2),
      };
    }
    /* DeadEndCity.hudOverlaps(slack): the HUD boxes on screen and the pairs that overlap. A box counts when it is
       drawn (size, display, visibility, opacity over 0.05); nested boxes (a chip inside its column) are not pairs. */
    const HUD_OVERLAP_IDS = [
      'hudLocation', 'cash', 'stars', 'worldClock', 'pauseBtn', 'navigation', 'terrainStatus', 'policeStatusPanel',
      'policeNotice', 'arrestStatus', 'stealthStatus', 'storyLine', 'carRadio', 'radioCaption', 'toast',
      'announcement', 'interaction', 'freefallCue', 'worldEdgeCue', 'minimapBox', 'pager', 'quickKeys',
      'vehicleStats', 'weaponButton', 'moveStick', 'aimStick', 'fpsCounter', 'driveByCross',
    ];
    function hudOverlapReport(slack = 2) {
      const shown = [];
      const drawn = (el) => {
        for (let e = el; e && e !== document.body; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false;
        }
        return true;
      };
      const add = (id, el, words = false) => {
        if (!el) return;
        let b = el.getBoundingClientRect();
        if (words) {
          // The text itself (a centred line in a full-width block).
          const range = document.createRange();
          range.selectNodeContents(el);
          b = range.getBoundingClientRect();
        }
        if (b.width < 1 || b.height < 1 || !drawn(el)) return;
        if (b.right <= 0 || b.bottom <= 0 || b.left >= viewportWidth || b.top >= viewportHeight) return;
        shown.push({ id, el, l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) });
      };
      // The headline card spans the window: its words are what show.
      for (const id of HUD_OVERLAP_IDS) if (id !== 'announcement') add(id, document.getElementById(id));
      add('announceSmall', document.getElementById('announceSmall'), true);
      add('announceBig', document.getElementById('announceBig'), true);
      for (const el of document.querySelectorAll('.touch-utility, .touch-actions')) add(el.className, el);
      const pairs = [];
      for (let i = 0; i < shown.length; i++)
        for (let j = i + 1; j < shown.length; j++) {
          const a = shown[i],
            b = shown[j];
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
          const w = Math.min(a.r, b.r) - Math.max(a.l, b.l),
            h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
          if (w > slack && h > slack) pairs.push([a.id, b.id, w, h]);
        }
      const p = hudPlayerBox(cardClear.player),
        overPlayer = p.ok
          ? shown.filter((s) => s.id !== 'driveByCross' && s.r > p.l && s.l < p.r && s.b > p.t && s.t < p.b).map((s) => s.id)
          : null;
      return {
        viewport: [viewportWidth, viewportHeight],
        touch: document.body.classList.contains('touch-mode'),
        boxes: shown.map(({ id, l, t, r, b }) => ({ id, l, t, r, b })),
        overlaps: pairs,
        overPlayer,
      };
    }
