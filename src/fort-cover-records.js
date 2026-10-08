    // Fort Sentinel's HQ records office: its side door (FORT_RECORDS), the fade inside, the timed search for the
    // weapons file on a card (#fortRecords) and stepping back out with the papers (fortCover.papers).
    /* The door is on the HQ's south front, west of the portico and away from its sentries (base3d-buildings.js
       draws it). In uniform, cleared and not alarmed the action key goes in: the screen fades to black (gameMode
       'elevator', as North Point Key's lifts), the search runs on the card, and he steps back out of the same door
       (teleportPlayer) holding the papers. Walked in under a heavy look (suspicion over FORT_RECORDS.tailAbove), a duty
       officer follows him in: the alarm on the way out. */
    const FORT_RECORDS = {
      door: { x: 9624, y: 8035 },
      // Where he stands to go in and where he comes out, on the pavement in front of the door.
      spot: { x: 9624, y: 8050 },
      reach: 24,
      seconds: 7.4,
      tailAbove: 60,
    };
    let fortRecords = null;
    function fortRecordsReady() {
      return (
        fortCover.active &&
        !fortCover.papers &&
        fortCoverShielded() &&
        !fortRecords &&
        withinRange('fort-records', distanceBetween(player, FORT_RECORDS.spot), FORT_RECORDS.reach)
      );
    }
    function fortRecordsInteract() {
      if (!fortRecordsReady()) return false;
      return startFortRecords();
    }
    function startFortRecords() {
      if (gameMode !== 'play' || fortRecords) return false;
      fortRecords = { t: 0, followed: fortCover.suspicion > FORT_RECORDS.tailAbove, step: -1, out: false };
      gameMode = 'elevator';
      keys = {};
      mouse.down = false;
      const el = getElement('fortRecords');
      el.style.opacity = '0';
      el.classList.remove('hidden');
      getElement('fortRecordsLine').textContent = 'RECORDS OFFICE';
      getElement('fortRecordsNote').textContent = 'THE DUTY CLERK IS ON HIS BREAK';
      noise(0.12, 0.08, 900);
      return true;
    }
    // The beats on the card: [from second, heading, note, sound].
    const FORT_RECORDS_BEATS = [
      [0, 'RECORDS OFFICE', 'THE DUTY CLERK IS ON HIS BREAK', null],
      [1.4, 'CABINET 7', 'PERSONNEL · LOGISTICS · RESTRICTED', 'drawer'],
      [3.0, 'FILE 7-ALPHA · HAWTHORN', 'RESTRICTED · WEAPONS DEVELOPMENT', 'paper'],
      [4.6, 'PAPERS TAKEN', 'FOLDED INSIDE THE TUNIC', 'drawer'],
    ];
    function fortRecordsSound(kind) {
      if (kind === 'drawer') {
        noise(0.28, 0.16, 420);
        tone(140, 0.12, 0.06, 'triangle', 90);
      } else if (kind === 'paper') {
        noise(0.07, 0.07, 4600);
        noise(0.05, 0.05, 5200);
      }
    }
    /* The search: 0.45 s to black, the beats, the step back out at the dark moment, 0.5 s back.
       Wall time capped per frame (frame clock, game-loop.js), so a stall cannot skip the move. */
    function updateFortRecords(deltaSeconds) {
      const R = fortRecords;
      if (!R) return;
      const t0 = R.t;
      R.t += Math.min(0.1, Math.max(0, deltaSeconds));
      const t = R.t,
        end = FORT_RECORDS.seconds,
        fade = t < 0.45 ? t / 0.45 : t > end - 0.5 ? Math.max(0, (end - t) / 0.5) : 1;
      getElement('fortRecords').style.opacity = fade.toFixed(3);
      let step = 0;
      for (let i = 0; i < FORT_RECORDS_BEATS.length; i++) if (t >= FORT_RECORDS_BEATS[i][0]) step = i;
      if (step !== R.step) {
        R.step = step;
        const beat = FORT_RECORDS_BEATS[step];
        getElement('fortRecordsLine').textContent = beat[1];
        getElement('fortRecordsNote').textContent = beat[2];
        if (beat[3]) fortRecordsSound(beat[3]);
      }
      // Something rustles between the beats.
      if (t0 < 3.6 && t >= 3.6) fortRecordsSound('paper');
      if (R.followed && t0 < 5.6 && t >= 5.6) {
        getElement('fortRecordsLine').textContent = 'FOOTSTEPS IN THE HALL';
        getElement('fortRecordsNote').textContent = 'A DUTY OFFICER · “LIEUTENANT? WHO SIGNED YOU INTO RECORDS?”';
        tone(220, 0.2, 0.08, 'square', 200);
      }
      if (!R.out && t >= end - 0.55) {
        R.out = true;
        teleportPlayer(FORT_RECORDS.spot.x, FORT_RECORDS.spot.y);
        player.a = Math.PI / 2;
        fortCover.papers = true;
        // Out of everyone's sight while inside: the meter had time to settle.
        if (!R.followed) fortCover.suspicion = Math.max(0, fortCover.suspicion - 25);
        if (fortCover.lastSpot) {
          fortCover.lastSpot.x = player.x;
          fortCover.lastSpot.y = player.y;
        }
      }
      if (t >= end) {
        fortRecords = null;
        getElement('fortRecords').classList.add('hidden');
        if (gameMode === 'elevator') gameMode = 'play';
        canvas.focus();
        if (R.followed) fortCoverBlow('records', null);
        else if (!mission) tell('RECORDS OFFICE · The weapons file is inside your tunic. Walk out the way you came in.', 4.5, { id: 'fort-cover' });
      }
    }
    // A new game, WASTED / BUSTED: drop any search under way.
    function resetFortRecords() {
      if (!fortRecords) return;
      fortRecords = null;
      getElement('fortRecords').classList.add('hidden');
      if (gameMode === 'elevator' && !liftTravel && !skyLift) gameMode = 'play';
    }
    function fortRecordsUI() {
      if (fortRecordsReady()) offerPrompt('RECORDS OFFICE · ENTER', { id: 'fort-records' });
    }
