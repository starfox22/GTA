    // BEGIN SUBSYSTEM: src/hud.js — HUD behaviour and the title menu
    /**
     * HUD behaviour and the title menu
     * Source: src/hud.js
     * Scope: shared game closure.
     *
     * updateUI() (game.js) writes the numbers; this file decides what the HUD
     * shows and how it moves:
     *
     *   POP BOXES   The car radio and the weapon box rest as compact chips (the
     *               station name; the weapon icon and ammo). hudPop(el) opens one
     *               for a few seconds: a new station, a weapon change, firing,
     *               reloading. Hovering (or focusing) a chip opens it too, so the
     *               presets and the arsenal stay one click away. The motion is CSS
     *               (.hud-pop.open, .hud-more), cut under prefers-reduced-motion.
     *   MINIMAP     Stays up; its fold button tucks it into a small chip. The
     *               GPS setting draws the road route on it (navigation.js). The
     *               mouse wheel and a two-finger pinch zoom it (MINIMAP_ZOOM_MIN..MAX,
     *               never the street camera). Both are saved in localStorage
     *               under 'dead-end-city-hud'.
     *   FLIGHT HUD  Instruments framing the aircraft while flying (below).
     *   KEY HINTS   The strip under the mission card, the interaction prompt and
     *               the HOW TO PLAY grid name the player's own bindings
     *               (controls.js), and the strip follows what they are doing:
     *               on foot, driving, flying.
     *   TITLE MENU  CONTINUE / NEW GAME / CHOOSE MISSION / SETTINGS / HOW TO
     *               PLAY / CREDITS, arrow-key navigation, a caption for the
     *               focused item and a second press to confirm NEW GAME over a
     *               saved story.
     */
    // @include src/hud-state.js
    // @include src/hud-panels.js
    // END SUBSYSTEM: src/hud.js
