    // BEGIN SUBSYSTEM: src/livingcity.js — The living city in free roam
    /**
     * The living city in free roam
     * Source: src/livingcity.js
     * Scope: shared game closure.
     * What keeps the streets round the player alive between missions: the traffic
     * pool streamed round the camera with the hour and the district deciding how
     * busy and which cars (livingcity-traffic.js), drivers pulling over for a
     * siren (livingcity-sirens.js), ambulances answering a body in the street
     * (livingcity-medics.js) and small street events the player can step into
     * (livingcity-events.js). Game logic only: the renderer reads what it needs
     * from the vehicles and people as ever.
     */
    // @include src/livingcity-traffic.js
    // @include src/livingcity-sirens.js
    // @include src/livingcity-medics.js
    // @include src/livingcity-events.js
    // @include src/livingcity-console.js
    /* Once a frame from updateCivic, after the crowd streamer. */
    function updateLivingCity(deltaSeconds) {
      streamTraffic(deltaSeconds);
      gatherSirenUnits();
      updateMedics(deltaSeconds);
      updateStreetEvents(deltaSeconds);
    }
    // END SUBSYSTEM: src/livingcity.js
