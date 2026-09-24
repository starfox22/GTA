    // BEGIN SUBSYSTEM: src/arsenal.js — Arsenal and knife combat
    /**
     * Arsenal and knife combat
     * Source: src/arsenal.js
     * Scope: shared game closure. Firearm indices 0–5 remain stable for existing saves.
     * Every owned firearm is equipped; there is no separate storage or carrying limit.
     * The permanent knife is separate from the six firearm ammunition records.
     * FISTS (index 7) is no weapon at all: nothing in hand, a left-right punch.
     * With fists up the player looks harmless, so the crowd does not panic at the
     * sight of them (crowd.js); a punch is still assault (heat.js).
     */
    const KNIFE_INDEX = 6,
      FISTS_INDEX = 7;
    const KNIFE = { name: 'KNIFE', owned: true, melee: true, dmg: 42, rate: 0.48, range: 24 };
    const FISTS = { name: 'FISTS', owned: true, melee: true, fists: true, dmg: 7, rate: 0.36, range: 21 };
    const WEAPON_CATEGORIES = [
      'SIDEARM',
      'AUTOMATIC',
      'SHOTGUN',
      'HEAVY',
      'ASSAULT',
      'PRECISION',
      'MELEE',
      'UNARMED',
    ];

    function currentWeapon() {
      return selectedWeaponIndex === KNIFE_INDEX ? KNIFE : selectedWeaponIndex === FISTS_INDEX ? FISTS : weapons[selectedWeaponIndex];
    }
    function weaponIsEquipped(index) {
      return Number.isInteger(index) && (index === KNIFE_INDEX || index === FISTS_INDEX || !!weapons[index]?.owned);
    }
    /* No weapon in hand: fists (or nothing at all while driving). */
    function playerUnarmed() {
      return selectedWeaponIndex === FISTS_INDEX;
    }
    function equippedWeaponIndices() {
      return [
        ...weapons
          .map((weapon, index) => (weapon.owned ? index : null))
          .filter((index) => index !== null),
        KNIFE_INDEX,
        FISTS_INDEX,
      ];
    }
    function restoreWeaponSelection(savedSelection) {
      // Ignore obsolete v10 carried slots: ownership now makes every purchase available.
      selectedWeaponIndex = weaponIsEquipped(savedSelection)
        ? savedSelection
        : equippedWeaponIndices()[0];
      reloadSecondsRemaining = 0;
    }
    function openArsenal() {
      if (gameMode !== 'play') return;
      gameMode = 'arsenal';
      keys = {};
      mouse.down = false;
      clearTouchInput();
      renderArsenal();
      getElement('arsenalOverlay').classList.remove('hidden');
      getElement('closeArsenal').focus();
    }
    function closeArsenal() {
      if (gameMode !== 'arsenal') return;
      getElement('arsenalOverlay').classList.add('hidden');
      gameMode = 'play';
      keys = {};
      mouse.down = false;
      clearTouchInput();
      updateUI();
      canvas.focus();
    }
    // Unknown card data intentionally excludes names, categories, icons and statistics.
    function arsenalCardData(index) {
      if (!weaponIsEquipped(index)) return { index, owned: false, name: '???', status: 'UNDISCOVERED' };
      const weapon = index === KNIFE_INDEX ? KNIFE : index === FISTS_INDEX ? FISTS : weapons[index];
      return {
        index,
        owned: true,
        name: weapon.name,
        category: WEAPON_CATEGORIES[index],
        selected: index === selectedWeaponIndex,
        shortcut: index === KNIFE_INDEX ? 'K' : index === FISTS_INDEX ? keyName('fists') : String(index + 1),
        status: index === selectedWeaponIndex ? 'IN HAND' : 'EQUIPPED',
        supply: weapon.fists ? 'NO WEAPON' : weapon.melee ? 'NO AMMO NEEDED' : weapon.ammo + ' / ' + weapon.reserve,
      };
    }
    function arsenalText(className, text) {
      const element = document.createElement('span');
      element.className = className;
      element.textContent = text;
      return element;
    }
    function selectArsenalWeapon(index) {
      if (!weaponIsEquipped(index)) return;
      if (selectWeapon(index)) {
        updateUI();
        renderArsenal(index);
      } else {
        getElement('arsenalActiveDescription').textContent =
          'Only the 9mm pistol can be used from a vehicle. Get out to select another weapon.';
      }
    }
    function renderArsenal(focusIndex = null) {
      const active = currentWeapon();
      getElement('arsenalEquippedCount').textContent = equippedWeaponIndices().length + ' / 8 EQUIPPED';
      getElement('arsenalActiveName').textContent = active.name;
      getElement('arsenalActiveCategory').textContent = WEAPON_CATEGORIES[selectedWeaponIndex];
      getElement('arsenalActiveAmmo').textContent = active.melee
        ? '∞'
        : String(active.ammo).padStart(2, '0');
      getElement('arsenalActiveReserve').textContent = active.melee
        ? 'NO AMMO NEEDED'
        : '/ ' + active.reserve + ' RESERVE';
      getElement('arsenalActiveDescription').textContent = active.fists
        ? 'Weapons away. People on the street are not afraid of you; a punch is still assault.'
        : active.melee
        ? 'Close-range attacks. Always ready. No ammunition required.'
        : 'Ready to use. Select any equipped weapon below, or cycle with Q.';
      drawWeaponIcon(getElement('arsenalActiveArt'), selectedWeaponIndex);
      const collection = getElement('arsenalCollection');
      collection.replaceChildren();
      let focusTarget = null;
      // Stable order retains seven collectible positions; names appear only after acquisition.
      for (const index of [...weapons.keys(), KNIFE_INDEX, FISTS_INDEX]) {
        const data = arsenalCardData(index);
        const card = document.createElement('button');
        card.type = 'button';
        card.className =
          'arsenal-card' + (data.owned ? '' : ' mystery') + (data.selected ? ' selected' : '');
        card.disabled = !data.owned;
        card.setAttribute?.(
          'aria-label',
          data.owned ? data.name + ' · ' + data.status + ' · ' + data.supply : 'Unknown weapon · ???',
        );
        if (data.owned) card.setAttribute?.('aria-pressed', String(data.selected));
        const header = arsenalText('arsenal-card-top', '');
        header.appendChild(arsenalText('arsenal-card-status', data.status));
        header.appendChild(arsenalText('arsenal-shortcut', data.owned ? data.shortcut : '—'));
        card.appendChild(header);
        if (data.owned) {
          const icon = document.createElement('canvas');
          icon.width = 512;
          icon.height = 256;
          icon.className = 'arsenal-weapon-icon';
          icon.setAttribute?.('aria-hidden', 'true');
          drawWeaponIcon(icon, index);
          card.appendChild(icon);
        } else card.appendChild(arsenalText('arsenal-mystery-icon', '???'));
        card.appendChild(arsenalText('arsenal-weapon-name', data.name));
        const footer = arsenalText('arsenal-card-footer', '');
        footer.appendChild(
          arsenalText('arsenal-card-category', data.owned ? data.category : 'IDENTITY UNKNOWN'),
        );
        footer.appendChild(arsenalText('arsenal-card-supply', data.owned ? data.supply : 'LOCKED'));
        card.appendChild(footer);
        if (data.owned) card.onclick = () => selectArsenalWeapon(index);
        collection.appendChild(card);
        if (index === focusIndex) focusTarget = card;
      }
      focusTarget?.focus();
    }

    // A single close-range strike: no projectile, gunshot, ammo use, or reload.
    // The knife stabs; fists throw a left-right combination whose third punch
    // in quick succession is a haymaker that puts a civilian on the ground.
    function meleeAttack() {
      if (player.car || player.parachute || transitRide) return false;
      const weapon = currentWeapon(),
        fists = !!weapon.fists,
        heading = aim();
      player.a = heading;
      if (fists) {
        player.punchCombo = gameTime - (player.punchAt ?? -100) < 0.8 ? (player.punchCombo || 0) + 1 : 0;
        player.punchAt = gameTime;
        player.punchUntil = gameTime + 0.26;
        player.punchHand = player.punchHand === 1 ? -1 : 1;
      } else player.knifeSwingUntil = gameTime + 0.28;
      const haymaker = fists && player.punchCombo % 3 === 2;
      shotCooldownSeconds = weapon.rate * (haymaker ? 1.5 : 1);
      noise(0.05, 0.05, fists ? 520 : 850);
      const people = [
        ...enemies,
        ...gangMembers,
        ...officers,
        ...pedestrians,
        ...sportsTargets(),
        ...storyActors.filter(
          (person) => !person.hidden && ['rooftop-hit', 'flight-witness'].includes(person.missionTag),
        ),
      ];
      const candidates = [...people, ...wildlife].filter(
        (target) =>
          target.hp > 0 &&
          distanceBetween(player, target) <= weapon.range &&
          Math.abs(entityElevation(player) - entityElevation(target)) < 10 &&
          Math.abs(normalizeAngle(headingBetween(player, target) - heading)) <= 0.9 &&
          clearSight(player, target) &&
          (!player.roof || roofSight(player, target)),
      );
      candidates.sort(
        (first, second) => distanceBetween(player, first) - distanceBetween(player, second),
      );
      const target = candidates[0];
      if (!target) return false;
      player.lastStrikeAt = gameTime;
      const damage = weapon.dmg * (haymaker ? 1.8 : 1);
      if (player.roof && rooftopJob()) rooftopShot();
      if (wildlife.includes(target)) strikeWildlife(target, damage);
      else {
        // Fists draw no blood unless the blow kills.
        strikePerson(target, damage, heading, player, !fists || target.hp <= damage, fists ? 'punch' : 'melee');
        if (fists && target.hp > 0) punchReaction(target, heading, haymaker);
        // A stabbing or a punch is quiet, but everyone who sees it reacts.
        crowdAlarm('melee', target, player);
        // Assault: a punch is a smaller crime than a stabbing, but still a crime.
        crime(target.police ? (fists ? 0.5 : 0.6) : fists ? 0.12 : 0.2);
        if (target.hp <= 0) cash += enemies.includes(target) ? 100 : 10;
        playerHitMarker(target, target.hp <= 0, false);
      }
      if (fists) noise(0.05, 0.18, haymaker ? 160 : 230);
      else noise(0.06, 0.12, 360);
      return true;
    }
    /* A punch shoves the target back a step; a haymaker floors a civilian for a
       moment (the same knocked-down state a car leaves, physics.js). */
    function punchReaction(target, heading, haymaker) {
      const shove = haymaker ? 16 : 7;
      if (!solid(target.x + Math.cos(heading) * shove, target.y + Math.sin(heading) * shove, 6)) {
        target.x += Math.cos(heading) * shove;
        target.y += Math.sin(heading) * shove;
      }
      const civilian = pedestrians.includes(target);
      if (haymaker) {
        target.knockedFor = civilian ? 1.6 : 1.1;
        target.dazedFor = 0;
      } else if (civilian) target.dazedFor = Math.max(target.dazedFor || 0, 0.6);
      else target.staggerUntil = Math.max(target.staggerUntil || 0, gameTime + 0.45);
    }
    getElement('weaponButton').onclick = openArsenal;
    getElement('closeArsenal').onclick = closeArsenal;

    function trapArsenalFocus(event) {
      const buttons = getElement('arsenalOverlay').querySelectorAll?.('button:not([disabled])');
      if (!buttons?.length) return;
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    // END SUBSYSTEM: src/arsenal.js
