    // BEGIN SUBSYSTEM: src/themepark.js — Sunset Pier resort and theme park
    /**
     * Sunset Pier resort and theme park
     * Source: src/themepark.js
     * Scope: shared game closure.
     * Island layout, the Falcon coaster (circuit builder, gravity ride, boarding),
     * the Sunset Eye observation wheel (and riding it), ride and show schedules
     * (fountain, fireworks), colliders, the island ground, the park crowd and the
     * park's procedural sound.
     */
    /**
     * SUNSET PIER
     * A Gulf-style resort island north of the reclamation across North Sound,
     * reached by the Sunset Pier Bridge off the north end of Riverbank Dr. The
     * bridge lands at the main gate; behind it the Fountain Lagoon with the
     * Sunset Palace hotel beyond, the Falcon coaster filling the west half
     * (THEME_PARK_RESERVE) and running out over the shore, the Sunset Eye
     * observation wheel by the island drive, and the family rides, the log
     * flume, the dark ride and the midway in the east. The beach club sits on
     * the north shore behind the hotel.
     *
     * The rides are simulated here and only drawn by themepark3d.js, so what is
     * drawn is what the simulation believes: the coaster train's position and
     * speed, the Eye's rotation, the fountain show and the fireworks.
     */
    const PIER = {
      gate: { x: 3200, y: -6030 },
      plaza: { x: 3060, y: -6100, w: 280, h: 156 },
      eastGate: { x: 3898, y: -6140 },
      // The coaster station: the track runs west through it along y -6430; the
      // platform is on its south side, the queue hall south of that.
      station: { x: 2575, y: -6400 },
      // The Sunset Eye: rim in the plane y = wheel.y, facing the city.
      wheel: { x: 3600, y: -6050, r: 240, hub: 300 },
      terminal: { x: 3530, y: -6095, w: 140, h: 90, height: 30 },
      lagoon: { x: 3170, y: -6370, rx: 200, ry: 125 },
      hotel: { x: 3530, y: -6770, w: 440, d: 90, height: 240 },
      beachClub: { x: 3330, y: -7010, w: 480, h: 150 },
      carousel: { x: 3500, y: -6265, r: 42 },
      swing: { x: 3700, y: -6262, r: 30, reach: 62 },
      teacups: { x: 3505, y: -6610, r: 38 },
      dropTower: { x: 4085, y: -6225 },
      bumper: { x: 3445, y: -6495, w: 150, h: 100 },
      darkRide: { x: 3620, y: -6535, w: 200, h: 135 },
      foodCourt: { x: 3600, y: -6655, w: 220, h: 56 },
      flume: { x: 4090, y: -6480 },
      midway: { x: 3895, y: -6400 },
      busStop: { x: 3266, y: -5838 },
      // UNICORN STATUE (unicorn3d.js). Aurora, a monumental black unicorn, on
      // the lawn south of the drop tower between the island drive and the east
      // shore: a low octagonal granite plinth (circumradius r) in a paved ring
      // (apron). She rears towards the west and a little towards the street
      // camera (face, her heading), so it sees her in three-quarter profile.
      unicorn: { x: 4068, y: -6048, r: 26, apron: 46, face: Math.PI - 0.35 },
    };
    // @include src/themepark-falcon-track.js
    // @include src/themepark-falcon-train.js
    // @include src/themepark-rides.js
    // @include src/themepark-colliders.js
    // @include src/themepark-grounds.js
    // @include src/themepark-crowd.js
    // @include src/themepark-sound.js
    // END SUBSYSTEM: src/themepark.js
