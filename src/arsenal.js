    // BEGIN SUBSYSTEM: src/arsenal.js — Arsenal and knife combat
    /**
     * Arsenal and knife combat
     * Scope: shared game closure. Firearm indices 0–5 remain stable for existing saves.
     * Every owned firearm is equipped; there is no separate storage or carrying limit.
     * The permanent knife is separate from the six firearm ammunition records.
     */
    const KNIFE_INDEX = 6;
    const KNIFE = { name: 'KNIFE', owned: true, melee: true, dmg: 42, rate: 0.48, range: 24 };
    const WEAPON_CATEGORIES = [
      'SIDEARM',
      'AUTOMATIC',
      'SHOTGUN',
      'HEAVY',
      'ASSAULT',
      'PRECISION',
      'MELEE',
    ];

    function currentWeapon() {
      return selectedWeaponIndex === KNIFE_INDEX ? KNIFE : weapons[selectedWeaponIndex];
    }
    function weaponIsEquipped(index) {
      return Number.isInteger(index) && (index === KNIFE_INDEX || !!weapons[index]?.owned);
    }
    function equippedWeaponIndices() {
      return [
        ...weapons
          .map((weapon, index) => (weapon.owned ? index : null))
          .filter((index) => index !== null),
        KNIFE_INDEX,
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
      const weapon = index === KNIFE_INDEX ? KNIFE : weapons[index];
      return {
        index,
        owned: true,
        name: weapon.name,
        category: WEAPON_CATEGORIES[index],
        selected: index === selectedWeaponIndex,
        shortcut: index === KNIFE_INDEX ? 'K' : String(index + 1),
        status: index === selectedWeaponIndex ? 'IN HAND' : 'EQUIPPED',
        supply: weapon.melee ? 'NO AMMO NEEDED' : weapon.ammo + ' / ' + weapon.reserve,
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
      getElement('arsenalEquippedCount').textContent = equippedWeaponIndices().length + ' / 7 EQUIPPED';
      getElement('arsenalActiveName').textContent = active.name;
      getElement('arsenalActiveCategory').textContent = WEAPON_CATEGORIES[selectedWeaponIndex];
      getElement('arsenalActiveAmmo').textContent = active.melee
        ? '∞'
        : String(active.ammo).padStart(2, '0');
      getElement('arsenalActiveReserve').textContent = active.melee
        ? 'NO AMMO NEEDED'
        : '/ ' + active.reserve + ' RESERVE';
      getElement('arsenalActiveDescription').textContent = active.melee
        ? 'Close-range attacks. Always ready. No ammunition required.'
        : 'Ready to use. Select any equipped weapon below, or cycle with Q.';
      drawWeaponIcon(getElement('arsenalActiveArt'), selectedWeaponIndex);
      const collection = getElement('arsenalCollection');
      collection.replaceChildren();
      let focusTarget = null;
      // Stable order retains seven collectible positions; names appear only after acquisition.
      for (const index of [...weapons.keys(), KNIFE_INDEX]) {
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
    function attackWithKnife() {
      if (player.car || player.parachute || transitRide) return false;
      const heading = aim();
      player.a = heading;
      player.knifeSwingUntil = gameTime + 0.28;
      shotCooldownSeconds = KNIFE.rate;
      noise(0.05, 0.05, 850);
      const people = [
        ...enemies,
        ...gangMembers,
        ...officers,
        ...pedestrians,
        ...storyActors.filter(
          (person) => !person.hidden && ['rooftop-hit', 'flight-witness'].includes(person.missionTag),
        ),
      ];
      const candidates = [...people, ...wildlife].filter(
        (target) =>
          target.hp > 0 &&
          distanceBetween(player, target) <= KNIFE.range &&
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
      if (player.roof && rooftopJob()) rooftopShot();
      if (wildlife.includes(target)) strikeWildlife(target, KNIFE.dmg);
      else {
        strikePerson(target, KNIFE.dmg, heading, player, true, 'melee');
        crime(target.police ? 0.6 : 0.2);
        if (target.hp <= 0) {
          cash += enemies.includes(target) ? 100 : 10;
          sessionKills++;
        }
      }
      noise(0.06, 0.12, 360);
      return true;
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
