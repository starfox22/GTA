  // BEGIN SUBSYSTEM: src/game.js — Game orchestration and shared state
  /**
   * Game orchestration and shared state
   * Source: src/game.js
   * Scope: shared game closure.
   * DOM references, units, entity registries, world population, combat, fallback drawing, UI, input and frame loop.
   */
  (() => {
    'use strict';

    // @include src/game-state.js
    // @include src/game-vehicles.js
    // @include src/game-weapons.js
    // @include src/audio.js
    // @include src/voices.js
    // @include src/footwork.js
    // @include src/camera-feel.js
    // @include src/camera-drive.js
    // @include src/camera-comfort.js
    // @include src/hud-notify.js
    // A line in the notification feed (hud-notify.js): `options` { id, tone }.
    function tell(text, duration = 3, options) {
      notify(text, duration, options);
    }
    function announce(small, big, t = 3) {
      getElement('announceSmall').textContent = small;
      getElement('announceBig').textContent = big;
      getElement('announcement').classList.add('show');
      freshAnnouncement();
      announceTime = t;
    }
    // @include src/heat.js
    // @include src/witnesses.js
    // @include src/game-collision.js
    // @include src/game-car-spawn.js
    // @include src/game-worldgen.js
    // @include src/game-populate.js
    // @include src/game-player-actions.js
    // @include src/game-cops.js
    // @include src/physics.js
    // @include src/game-people.js
    // @include src/game-combat.js
    // @include src/game-update.js
    // @include src/world-edge.js
    // @include src/game-draw2d.js
    // @include src/game-minimap.js
    // @include src/map-view.js
    // @include src/game-ui.js
    // @include src/game-menus.js
    // @include src/god-splash.js
    // @include src/game-input.js
    // @include src/controls.js
    // @include src/geography.js
    // @include src/drawbridge.js
    // @include src/harbor.js
    // @include src/police-feedback.js
    // @include src/arsenal.js
    // @include src/ammo-supply.js
    // @include src/citylife.js
    // @include src/pursuit.js
    // @include src/swat.js
    // @include src/wounds.js
    // @include src/story.js
    // @include src/campaign.js
    // @include src/chase.js
    // @include src/roadblocks.js
    // @include src/carjack.js
    // @include src/carjack-struggle.js
    // @include src/riders.js
    // @include src/wheelie.js
    // @include src/themepark.js
    // @include src/marina.js
    // @include src/taxi.js
    // @include src/cycles.js
    // @include src/weather.js
    // @include src/weather-audio.js
    // @include src/clouds.js
    // @include src/clouds-audio.js
    // @include src/clouds-console.js
    // @include src/water.js
    // @include src/water-audio.js
    // @include src/beachvolley.js
    // @include src/beach.js
    // @include src/roofmission.js
    // @include src/rooftops.js
    // @include src/air-cover.js
    // @include src/combat-rules.js
    // @include src/driveby.js
    // @include src/damage.js
    // @include src/crash-audio.js
    // @include src/engine-audio.js
    // @include src/county.js
    // @include src/monarch.js
    // @include src/airfields.js
    // @include src/military.js
    // @include src/armor.js
    // @include src/apache.js
    // @include src/aviation.js
    // @include src/challenges.js
    // @include src/sidejobs.js
    // @include src/streets.js
    // @include src/terrain.js
    // @include src/offroad.js
    // @include src/hypercars.js
    // @include src/mountain-village.js
    // @include src/casino.js
    // @include src/skyline.js
    // @include src/renewal.js
    // @include src/sports-fixtures.js
    // @include src/sportsbook-odds.js
    // @include src/sports.js
    // @include src/sports-world.js
    // @include src/sportsbook.js
    // @include src/sportsbook-ui.js
    // @include src/sports-audio.js
    // @include src/transit.js
    // @include src/ride-skip.js
    // @include src/ecology.js
    // @include src/sealife.js
    // @include src/sealife-audio.js
    // @include src/navigation.js
    // @include src/parachute.js
    // @include src/deck-landing.js
    // @include src/falls.js
    // @include src/mobile.js
    // @include src/input-hints.js
    // @include src/gamepad.js
    // @include src/world-view.js
    // @include src/car-radio.js
    // @include src/garages.js
    // @include src/crowd.js
    // @include src/livingcity.js
    // @include src/monarch-life.js
    // @include src/dealership.js
    // @include src/dealership-people.js
    // @include src/beachclub.js
    // @include src/beachclub-audio.js
    // @include src/clubpool.js
    // @include src/clubtalk.js
    // @include src/leisure.js
    // @include src/ambience.js
    // @include src/ambience-beds.js
    // @include src/acoustics-audio.js
    // @include src/footsteps-audio.js
    // @include src/vehicle-foley-audio.js
    // @include src/bullets-audio.js
    // @include src/runover-audio.js
    // @include src/quality.js
    // @include src/settings.js
    // @include src/markers.js
    // @include src/foliage-cutaway.js
    // @include src/god-panel.js
    // @include src/driving.js
    // @include src/tyre-effects.js
    // @include src/hud.js
    // @include src/render3d.js
    // STARTUP ORDER: geometry -> collision -> entities -> saved progression -> UI -> graphics.
    bootMark('game-start');
    buildWorld();
    bootMark('world');
    buildBuildingGrid();
    buildColliders();
    bootMark('colliders');
    populate();
    populateStoryWorld();
    populateCounty();
    chooseRoofHelipads();
    addMonarchHelipads();
    bootMark('populated');
    load();
    resize();
    drawWeapon();
    updateUI();
    updateTitleMenu();
    bootMark('title-menu');
    loadVisuals();
    bootMark('visuals-queued');
    // @include src/frame-trace.js
    // @include src/game-loop.js
    requestAnimationFrame(frame);
    bootMark('loop-ready');
    // @include src/game-console.js
    // @include src/game-agent-tools.js
    bootMark('console-ready');
  })();
  // END SUBSYSTEM: src/game.js
