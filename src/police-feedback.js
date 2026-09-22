    // BEGIN SUBSYSTEM: src/police-feedback.js — Police action feedback
    /**
     * Police action feedback
     * Source: src/police-feedback.js
     * Scope: shared game closure.
     * Police notices use their own banner layer so mission and respray messages
     * cannot overwrite them, and vice versa.
     */
    let policeNoticeSeconds = 0;
    function showPoliceNotice(message, cleared = false) {
      const banner = getElement('policeNotice');
      banner.textContent = message;
      banner.classList.toggle('cleared', cleared);
      banner.classList.add('show');
      document.body?.classList.add('police-notice-visible');
      policeNoticeSeconds = 4;
    }
    function needToLosePolice() {
      showPoliceNotice('NEED TO LOSE POLICE FIRST');
      return false;
    }
    function policeClearedNotice() {
      showPoliceNotice('POLICE CLEARED!', true);
    }
    function updatePoliceNotice(deltaSeconds) {
      if (policeNoticeSeconds <= 0) return;
      const cleared = getElement('policeNotice').classList.contains('cleared');
      if ((cleared && wantedStars > 0) || (!cleared && wantedStars <= 0)) policeNoticeSeconds = 0;
      policeNoticeSeconds = Math.max(0, policeNoticeSeconds - deltaSeconds);
      if (policeNoticeSeconds === 0) {
        getElement('policeNotice').classList.remove('show');
        document.body?.classList.remove('police-notice-visible');
      }
    }

    // Report explicit delivery attempts that are waiting for a clean wanted level.
    // This does not intercept ordinary movement, combat, vehicle exits, or resprays.
    function policeBlocksMissionDelivery() {
      if (wantedStars <= 0 || !mission?.target || player.roof || player.parachute) return false;
      const stage = { 1: 4, 2: 3, 3: 3, 4: 3, 5: 4, 8: 3 }[mission.index];
      if (mission.stage !== stage || distanceBetween(player, mission.target) >= 60) return false;
      if (player.car && Math.abs(player.car.speed) >= 15) return false;
      if ([2, 5].includes(mission.index) && player.car !== mission.car) return false;
      if ([4, 8].includes(mission.index) && player.car !== mission.passengerCar) return false;
      if (mission.index === 1 && player.car) return false;
      needToLosePolice();
      // The same key must still let a driver exit and hide on foot.
      return !player.car;
    }
    // END SUBSYSTEM: src/police-feedback.js
