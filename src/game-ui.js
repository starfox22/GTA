    // Weapon chip, mission card and updateUI() (HUD text refresh).
    function drawWeapon() {
      // In a tank the chip shows the main gun or the MG (armor.js tankHud), in the
      // Apache its gun and rockets (apache.js apacheHud).
      if (player.car?.type === 'tank' || isApache(player.car)) {
        delete getElement('weaponArt').dataset.tankIcon;
        return;
      }
      drawWeaponIcon(getElement('weaponArt'), selectedWeaponIndex);
    }
    /* No weapon: a clenched fist seen from the side, knuckles forward (the way the
       gun icons point), drawn procedurally at any canvas size. */
    function drawFistIcon(targetCanvas) {
      const g = targetCanvas.getContext('2d');
      g.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      g.save();
      const scale = Math.min(targetCanvas.width / 130, targetCanvas.height / 74);
      g.translate(targetCanvas.width / 2, targetCanvas.height / 2);
      g.scale(scale, scale);
      g.lineJoin = 'round';
      const block = (x, y, w, h, r, fill, line = '#2b1f17', width = 2.6) => {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
        g.fillStyle = fill;
        g.fill();
        if (line) {
          g.strokeStyle = line;
          g.lineWidth = width;
          g.stroke();
        }
      };
      // Jacket cuff and wrist.
      block(-60, -16, 20, 34, 3, '#3d4a57');
      block(-44, -13, 14, 28, 5, '#c9a07a');
      // Back of the hand.
      block(-34, -24, 42, 46, 12, '#d8b08a');
      // Four curled fingers, the little finger a little shorter.
      for (let i = 0; i < 4; i++) block(2, -24 + i * 11.5, i === 3 ? 27 : 31, 11.5, 5.5, '#e6c29c');
      // Knuckle highlights.
      g.fillStyle = '#f6dcbd';
      for (let i = 0; i < 4; i++) g.fillRect(i === 3 ? 21 : 25, -21 + i * 11.5, 5, 3);
      // Thumb folded across the fingers.
      block(-22, 8, 36, 13, 6.5, '#cfa47d');
      g.fillStyle = '#f0d3b4';
      g.fillRect(6, 11, 5, 3);
      g.restore();
    }
    function drawWeaponIcon(targetCanvas, weaponIndex) {
      if (weaponIndex === FISTS_INDEX) {
        drawFistIcon(targetCanvas);
        return;
      }
      const atlas = visualAssets.arsenal;
      if (atlas && atlas.width > 0 && atlas.height > 0) {
        const context = targetCanvas.getContext('2d');
        // Explicit sprite bounds avoid neighboring icons and trim transparent atlas margins.
        // Coordinates refer to the original 1254 x 1254 artwork; the source PNG is unchanged.
        const spriteBounds = [
          [163, 81, 304, 212],
          [755, 45, 395, 279],
          [23, 425, 593, 153],
          [645, 394, 588, 213],
          [18, 702, 600, 205],
          [642, 693, 595, 184],
          [75, 1030, 506, 123],
        ];
        const [sourceX, sourceY, sourceWidth, sourceHeight] = spriteBounds[weaponIndex];
        const scale = Math.min(
          (targetCanvas.width * 0.88) / sourceWidth,
          (targetCanvas.height * 0.84) / sourceHeight,
        );
        const width = sourceWidth * scale,
          height = sourceHeight * scale;
        context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
        context.imageSmoothingEnabled = true;
        context.drawImage(
          atlas,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          (targetCanvas.width - width) / 2,
          (targetCanvas.height - height) / 2,
          width,
          height,
        );
        return;
      }
      // Existing readable geometry remains available while artwork loads or in reduced mode.
      const drawingContext = targetCanvas.getContext('2d');
      drawingContext.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      drawingContext.save();
      const iconScale = Math.min(targetCanvas.width / 328, targetCanvas.height / 116);
      drawingContext.translate(targetCanvas.width / 2, targetCanvas.height / 2);
      drawingContext.scale(iconScale, iconScale);
      drawingContext.scale(4, 4);
      const r = (x, y, w, h, c) => {
        drawingContext.fillStyle = c;
        drawingContext.fillRect(x, y, w, h);
      };
      const c = '#becbb1',
        dark = '#6f806b';
      if (weaponIndex === KNIFE_INDEX) {
        r(-26, -3, 16, 6, '#665c4c');
        r(-11, -7, 3, 14, '#adb8bf');
        drawingContext.fillStyle = '#e3ebed';
        drawingContext.beginPath();
        drawingContext.moveTo(-8, -4);
        drawingContext.lineTo(30, -4);
        drawingContext.lineTo(20, 4);
        drawingContext.lineTo(-8, 4);
        drawingContext.closePath();
        drawingContext.fill();
      }
      if (weaponIndex === 0) {
        r(-14, -7, 31, 5, c);
        r(-14, -2, 19, 4, dark);
        r(-10, 2, 7, 10, c);
        r(-8, 3, 3, 8, dark);
        r(-2, 2, 8, 1, c);
        r(5, 1, 1, 5, c);
        r(-2, 5, 7, 1, c);
        r(16, -6, 3, 3, dark);
        r(-11, -9, 2, 2, c);
      }
      if (weaponIndex === 1) {
        r(-22, -6, 37, 8, c);
        r(14, -4, 15, 3, dark);
        r(-15, 2, 7, 11, dark);
        r(1, 2, 6, 11, c);
        r(-27, -5, 5, 14, dark);
        r(-12, -9, 19, 2, c);
        r(6, -9, 2, 3, c);
      }
      if (weaponIndex === 2) {
        r(-29, -2, 49, 4, c);
        r(18, -3, 16, 2, c);
        r(-12, -5, 15, 3, dark);
        r(-8, 2, 19, 3, dark);
        r(-28, 2, 13, 7, '#ae9e77');
        r(-15, 1, 8, 4, '#ae9e77');
        r(13, -5, 2, 3, c);
      }
      if (weaponIndex === 4 || weaponIndex === 5) {
        r(-23, -4, 33, 7, c);
        r(9, -2, weaponIndex === 5 ? 27 : 18, 2, dark);
        r(-32, -2, 11, 7, weaponIndex === 5 ? '#af936a' : dark);
        r(-17, 3, 4, 10, dark);
        r(-4, 3, 4, 9, c);
        r(2, -6, 7, 2, dark);
        if (weaponIndex === 5) {
          r(-11, -9, 22, 4, c);
          r(-13, -10, 3, 6, dark);
          r(10, -10, 3, 6, dark);
          r(-5, -5, 2, 2, dark);
        } else for (let x = 2; x < 13; x += 3) r(x, -3, 1, 4, dark);
      }
      if (weaponIndex === 3) {
        r(-30, -6, 61, 11, dark);
        r(-26, -5, 44, 7, c);
        r(29, -8, 3, 15, c);
        r(-31, -8, 3, 15, c);
        r(-4, 5, 6, 9, c);
        r(12, -10, 4, 4, c);
        r(14, -12, 10, 2, dark);
      }
      drawingContext.restore();
    }
    /**
     * MISSION CARD
     * The pager card is read once, not stared at: it opens for
     * MISSION_CARD_SECONDS whenever the job or its objective changes, then folds
     * into a one-line objective strip. O (or a click/tap on the strip) opens it
     * again. Game time drives it, so a pause or phone call does not eat the read.
     */
    const MISSION_CARD_SECONDS = 6;
    let missionCardKey = '',
      missionCardUntil = 0;
    function updateMissionCard(objectiveLine) {
      const key =
        getElement('pagerLabel').textContent +
        '|' +
        getElement('missionTitle').textContent +
        '|' +
        objectiveLine;
      if (key !== missionCardKey) {
        missionCardKey = key;
        missionCardUntil = gameTime + MISSION_CARD_SECONDS;
      }
      getElement('missionObjective').textContent = objectiveLine;
      getElement('pager').classList.toggle('compact', gameTime >= missionCardUntil);
    }
    function toggleMissionCard() {
      missionCardUntil = gameTime < missionCardUntil ? 0 : gameTime + MISSION_CARD_SECONDS;
      updateUI();
    }
    // HUD AND CONTEXT PROMPTS: presentation derived from shared simulation state.
    function updateUI() {
      enforceVehicleHandgun();
      // Every system offers its prompt during the pass; hud.js commitPrompt() shows one.
      clearPromptOffer();
      const d = district(),
        w = currentWeapon(),
        c = player.car;
      getElement('district').textContent = d;
      getElement('mapDistrict').textContent = d;
      getElement('streetName').textContent = streetNameAt(player.x, player.y);
      getElement('cash').textContent = '$' + String(Math.floor(visibleCash())).padStart(6, '0');
      // Stars, the pending star, heat meter and body count (heat.js, hud.js).
      heatUI();
      getElement('healthValue').textContent = Math.max(0, Math.ceil(player.hp));
      getElement('healthFill').style.width = clamp(player.hp, 0, 100) + '%';
      getElement('armorFill').style.width = clamp(player.armor, 0, 100) + '%';
      getElement('healthbox').classList.toggle('low', player.hp < 30);
      getElement('healthbox').classList.toggle('armored', player.armor > 0);
      getElement('armorLabel').textContent =
        player.armor > 0
          ? 'ARMOR ' + Math.ceil(player.armor)
          : wantedStars > 0
            ? searchActive
              ? 'HIDE UNTIL THE TIMER ENDS'
              : 'POLICE PURSUIT'
            : 'NO ARMOR';
      getElement('weaponSlot').textContent = w.fists
        ? 'UNARMED · WEAPONS AWAY'
        : w.melee
        ? 'KNIFE · ALWAYS CARRIED'
        : 'EQUIPPED · ' + equippedWeaponIndices().length + ' WEAPONS';
      getElement('weaponName').textContent = w.name;
      getElement('ammo').textContent = w.fists
        ? '—'
        : w.melee
        ? '∞'
        : reloadSecondsRemaining > 0
          ? '··'
          : String(w.ammo).padStart(2, '0');
      getElement('reserve').textContent = w.fists ? 'PUNCH' : w.melee ? 'NO AMMO NEEDED' : '/ ' + w.reserve;
      getElement('reloadHint').textContent = w.melee
        ? keyName('fire')
        : reloadSecondsRemaining > 0
          ? 'LOADING'
          : keyName('reload');
      // The speed box: vehicles, on foot, swimming and falling (hud.js SPEED BOX).
      updateSpeedBox();
      const target = objective(),
        m = mission;
      getElement('pager').classList.toggle('hidden', !m && incomingCallRemaining <= 0 && !demoStoryOver());
      // Numbered the same way as the mission-start headline: story missions out
      // of the story, contracts out of the contracts.
      const shownIndex = Math.min(mission?.index ?? missionIndex, missions.length - 1);
      getElement('missionCounter').textContent = !m && demoStoryOver()
        ? 'DEMO COMPLETE'
        : shownIndex >= SIDE_JOB_FIRST
          ? 'CONTRACT ' + (shownIndex + 1 - SIDE_JOB_FIRST) + ' / ' + (missions.length - SIDE_JOB_FIRST)
          : 'MISSION ' +
            String(shownIndex + 1).padStart(2, '0') +
            ' / ' +
            String(SIDE_JOB_FIRST).padStart(2, '0');
      getElement('missionTimer').textContent = m?.timeLimit
        ? Math.floor(Math.ceil(m.timer) / 60) + ':' + String(Math.ceil(m.timer) % 60).padStart(2, '0')
        : '';
      if (m) {
        getElement('pagerLabel').textContent =
          CHARACTERS[missions[m.index].contact].name.toUpperCase();
        getElement('missionTitle').textContent = missions[m.index].title;
        getElement('missionText').textContent = missionSummary(m);
      } else if (demoStoryOver()) {
        // PUBLIC DEMO (campaign.js): the story stops here; the city does not.
        getElement('pagerLabel').textContent = 'DEAD END CITY · DEMO';
        getElement('missionTitle').textContent = 'Thanks for playing the demo!';
        getElement('missionText').textContent = 'If you liked it, please buy the full game. Until then the city is yours to explore.';
      } else if (missionIndex >= missions.length) {
        getElement('pagerLabel').textContent = 'THE SOUTH COAST LEDGER';
        getElement('missionTitle').textContent = 'One clean exit.';
        getElement('missionText').textContent =
          'Elena made it out. The Keys, rooftops and gang districts are yours to explore.';
      } else {
        getElement('pagerLabel').textContent = 'INCOMING CALL';
        getElement('missionTitle').textContent =
          missionIndex === 0 ? 'Every city has an opening.' : 'Another call. Another score.';
        getElement('missionText').textContent =
          'Find the ringing payphone and press ' + keyName('interact') + ' to take a job.';
      }
      getElement('missionDistance').textContent = target
        ? (m ? 'OBJECTIVE' : 'PAYPHONE') + ' · ' + distanceLabel(distanceBetween(player, target))
        : demoStoryOver()
          ? 'FREE ROAM · DEMO COMPLETE'
          : 'FREE ROAM · ' + completed + ' JOBS COMPLETE';
      updateMissionCard(
        m
          ? m.instruction || missions[m.index].brief
          : demoStoryOver()
            ? 'FREE ROAM · DEMO COMPLETE'
            : missionIndex >= missions.length
              ? 'FREE ROAM · ' + completed + ' JOBS COMPLETE'
              : 'ANSWER THE RINGING PAYPHONE',
      );
      let prompt = '',
        promptId,
        promptKey = 'interact';
      // A bike-share station in reach: RENT BIKE on foot, DOCK BIKE on a share bike.
      const bikeShare = gameMode === 'play' && !rideSkipActive() ? bikeShareOffer() : null;
      // A passenger ride that can be skipped offers that first (ride-skip.js).
      const skip = gameMode === 'play' && !c ? rideSkipPrompt() : null;
      // Thrown off a bike (riders.js): nothing to offer until back on their feet.
      if (gameMode === 'play' && (rideSkipActive() || player.thrown)) prompt = '';
      else if (skip) {
        prompt = skip.prompt;
        promptId = skip.id;
        promptKey = 'skipRide';
      } else if (gameMode === 'play' && player.coaster) {
        // Aboard a Sunset Pier ride (the Falcon, the Sunset Eye...): E cycles the view.
        prompt = 'CHANGE VIEW';
        promptId = 'ride-view';
      } else if (gameMode === 'play') {
        if (c) {
          // The flight HUD shows power, speed and the warnings; the prompt only
          // says what to do about a stall, or how to get off the ground.
          // One identity per vehicle kind: its hints change text, not pop in anew.
          promptId = c.type === 'plane' || c.type === 'helicopter' ? c.type : 'garage';
          if (c.type === 'plane')
            prompt = c.stalled
              ? 'STALL · ' + keyName('descend') + ' NOSE DOWN + ' + keyName('forward') + ' THROTTLE'
              : aircraftClearance(c) < 1 && Math.abs(c.speed) < 40
                ? keyName('forward') + ' THROTTLE · ' + keyName('ascend') + ' ROTATE · ' + keyName('flapsDown') + ' FLAPS · ' +
                  keyName('interact') + ' EXIT'
                : '';
          else if (c.type === 'helicopter')
            prompt =
              aircraftClearance(c) > 1
                ? keyName('ascend') + ' RISE · ' + keyName('descend') + ' DESCEND · ' + moveKeysName() + ' FLY'
                : keyName('ascend') + ' TAKE OFF · ' + keyName('interact') + ' EXIT';
          else if (bikeShare) {
            prompt = bikeShare.text;
            promptId = 'bikeshare';
            promptKey = bikeShare.key;
          } else if (dealershipPrompt()) {
            // A test drive's clock (dealership.js).
            prompt = dealershipPrompt().text;
            promptId = 'dealer-test';
          } else if (garagePrompt(c) !== null)
            // The price at the door (garages.js PRICE LIST); E skips the show.
            prompt = garagePrompt(c);
        } else if (taxiRide) prompt = taxiRide.arrival > 0 ? '' : 'STOP HERE · $' + taxiRide.fare;
        else if (hailableTaxi()) prompt = 'HAIL THIS CAB';
        else if (player.deck)
          prompt = deckExitNear() ? 'GO ASHORE · ' + player.deck.name : '';
        else if (boardableLiner()) prompt = 'BOARD ' + boardableLiner().name;
        else if (transitRide) prompt = 'REQUEST NEXT RAIL STOP';
        else if (nearestStation()) prompt = 'CITY RAIL · CHOOSE DESTINATION';
        else if (payphoneInReach() && !m && storyCallWaiting()) prompt = 'ANSWER PAYPHONE';
        else if (monarchPrompt()) prompt = monarchPrompt();
        // MONARCH MOTORS: the car on display and its price, the concierge (dealership.js).
        else if (dealershipPrompt()) {
          prompt = dealershipPrompt().text;
          promptId = dealershipPrompt().id;
        }
        else if (bikeShare) {
          prompt = bikeShare.text;
          promptId = 'bikeshare';
          promptKey = bikeShare.key;
        } else if (sportsbookPrompt()) {
          // Inside GOALLINE by the stadium (sportsbook.js).
          prompt = sportsbookPrompt();
          promptId = 'sportsbook';
        } else if (sportsKickPrompt()) prompt = sportsKickPrompt();
        else if (leisurePrompt()) {
          const leisure = leisurePrompt();
          prompt = leisure.text;
          promptId = leisure.id;
        } else {
          const n = nearestCar();
          promptId = 'vehicle';
          if (n)
            prompt = vehicleIsLocked(n)
              ? 'LOCKED · BREAK THE WINDOW'
              : (n.occupied ? 'PULL OUT THE DRIVER · ' : 'ENTER ') + vehicleSpec(n).name;
        }
      }
      // Aircraft prompts name their own keys; passing cars share one identity so
      // walking along a row of them changes the name without a new pop-in.
      offerPrompt(prompt, {
        key: isAircraft(c) ? null : promptKey,
        id: promptId,
      });
      if (!hudState.minimapFolded) drawMap(minimapContext, getElement('minimap').width, getElement('minimap').height);
      if (mapOpen) drawMap(cityMapContext, 800, 660, true);
      drawWeapon();
      civicUI();
      challengeMissionUI();
      updateCarRadioUI();
      updateExplorationUI();
      updateTouchUI();
      updateHud();
      // In a tank the weapon chip shows the main gun and the MG (armor.js).
      if (c?.type === 'tank') tankHud(c);
      else if (isApache(c)) apacheHud(c);
      else if (getElement('weaponArt').dataset.tankIcon) {
        delete getElement('weaponArt').dataset.tankIcon;
        drawWeapon();
      }
    }
