    // BEGIN SUBSYSTEM: src/game-console-police.js — DeadEndCity console, police: wanted, policeReport, shotLog, cover, Apache, arm, roadblocks, military
    // Police and combat: wanted level, the police report and shot log, overhead cover,
    // the Apache, weapons (arm), roadblocks and containment, Fort Sentinel.
    addConsoleMethods('police', {
      // Set the wanted level directly. Useful for looking at containment and air
      // support without having to earn them.
      wanted(stars = 5) {
        const n = clamp(Math.round(stars), 0, 5);
        // Clearing reports the escape exactly like losing them in play would.
        if (n <= 0) clearPolice(true);
        else {
          setWantedLevel(n);
          searchActive = false;
          searchRemaining = policeSearchSeconds(n);
          lastSeen = {
            x: player.x,
            y: player.y,
          };
        }
        return this.status();
      },
      // The police response as data: stars, heat and the next star's threshold,
      // the incident's body count, the search, arrest progress, the tier's
      // allowances and every unit (patrol, swat, fed, army, air) and officer.
      policeReport: () => policeReportData(),
      // Hostile rounds aimed at the player since the last reset, by source, with
      // the shooter's distance and whether it was on screen (combat-rules.js SHOT
      // LOG); `reset` clears the log after reading it.
      shotLog: (reset = false) => shotLogReport(reset),
      // Fort Sentinel's Apache (apache.js): position, pad, ammunition, turret, aim
      // and a clearance check of its parked footprint.
      apache: () => apacheReport(),
      // Overhead cover (air-cover.js OVERHEAD COVER) at a map point (default: the
      // player): the cover over it or null, whether the player is hidden from the
      // police helicopter, and how many covers of each kind are registered (with
      // one example point each, for tests).
      cover(x = player.x, y = player.y) {
        const elevation = x === player.x && y === player.y ? entityElevation(player.car || player) : terrainHeight(x, y),
          c = overheadCover(x, y, elevation),
          kinds = {};
        for (const k of overheadCovers) {
          const entry = (kinds[k.kind] ??= { count: 0, example: [Math.round(k.x), Math.round(k.y)] });
          entry.count++;
        }
        return {
          x: Math.round(x),
          y: Math.round(y),
          cover: c ? { kind: c.kind, bottom: Math.round(c.bottom), top: Math.round(c.top) } : null,
          // Where the helicopter's searchlight lands (air-cover.js overheadCoverHeight).
          roofHeight: overheadCoverHeight(x, y, elevation),
          playerHiddenFromAir: hiddenFromAir(player.car || player),
          air: airPursuitStatus(),
          registered: kinds,
        };
      },
      // Put a fresh Apache back on its pad (the old one, wrecked or not, is removed
      // unless the player is aboard). Returns apache().
      apacheReset() {
        for (let i = vehicles.length - 1; i >= 0; i--)
          if (isApache(vehicles[i]) && vehicles[i] !== player.car) vehicles.splice(i, 1);
        if (!isApache(player.car)) parkApache();
        return apacheReport();
      },
      // Fix the Apache's aim point on the ground (map x, y) as the mouse would;
      // no arguments hands the aim back to the mouse. Returns apache().
      apacheAim(x, y) {
        apacheAimOverride = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
        return apacheReport();
      },
      // Combat tests: own weapon `index` (0 pistol ... 5 precision rifle) with a
      // full clip and reserve, and select it. Returns its name.
      arm(index = 4) {
        // 6 the knife, 7 no weapon (fists): selected as they are.
        if (index === KNIFE_INDEX || index === FISTS_INDEX) {
          selectedWeaponIndex = index;
          reloadSecondsRemaining = 0;
          drawWeapon();
          return currentWeapon().name;
        }
        const w = weapons[index];
        if (!w) return null;
        w.owned = true;
        w.ammo = w.clip;
        w.reserve = Math.max(w.reserve, w.clip * 8);
        selectedWeaponIndex = index;
        reloadSecondsRemaining = 0;
        drawWeapon();
        return w.name;
      },
      // Fort Sentinel security: alert, lockdown, gate pieces, garrison and vehicles.
      military: () => militaryReport(),
      // The chokepoint catalogue and the state of the cordon.
      containment: () => ({
        sites: roadblockSites().length,
        budget: containmentBudget(),
        active: roadblocks.length,
        nextPlanIn: Math.round(Math.max(0, containmentTimer) * 10) / 10,
      }),
      // Where the police have cut the map right now.
      roadblocks: () =>
        roadblocks.map((b) => ({
          name: b.site.name,
          x: Math.round(b.x),
          y: Math.round(b.y),
          cars: b.cars.filter((c) => c.hp > 0).length,
          officers: b.crew.filter((o) => o.hp > 0).length,
          // Cruisers still anchored; a heavy rammer knocks them loose.
          braced: b.cars.filter((c) => c.hp > 0 && c.braced).length,
          conesKnocked: b.cones.filter((c) => c.tipped).length,
          breached: !!b.breached,
        })),
      // Build a police cut at chokepoint `siteIndex` (see containment().sites),
      // or at the one nearest the player, and describe it. Dispatch's next re-plan
      // is held off for a minute so the cut survives a clean wanted level.
      roadblock(siteIndex) {
        containmentTimer = 60;
        const sites = roadblockSites(),
          site =
            sites[siteIndex] ||
            sites.reduce((best, s) => (distanceBetween(s, player) < distanceBetween(best, player) ? s : best));
        const block = roadblockAt(site) || buildRoadblock(site);
        return block
          ? { name: site.name, x: site.x, y: site.y, axis: site.axis, cars: block.cars.length }
          : null;
      },
      // Take down every police cut at once (repeatable ram tests).
      clearRoadblocks() {
        clearRoadblocks();
        return roadblocks.length;
      },
    });
    // END SUBSYSTEM: src/game-console-police.js
