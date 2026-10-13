    // Minimap rules (MINIMAP MARKS): what the small map draws over its base layer (the job and its GPS route, the
    // player, police while wanted, the nearest respray while wanted, the waiting call's payphone, mission entities,
    // places only round the player on foot) and the count of marks per refresh (console minimapReport()).
    /**
     * MINIMAP MARKS
     * The minimap is a driving aid: roads, blocks and water from its base layer, and over them only what the player
     * acts on. Always: the job (a gold blip and its GPS road route), the map waypoint, the player, mission entities
     * (Kessler's car, the harbour crates, a street thief) and a drawbridge that is not down. While wanted: the police
     * units, their search circle and the nearest respray (with a rim arrow when off the card). Otherwise police show
     * only when they are on a job of their own (a mission pursuit, a gang fight). A waiting call shows its payphone
     * only. Shops, services, rail stations and bike docks show only on foot within MINIMAP_NEAR, as small marks with
     * no names; helipads, planes, sports grounds and every place name stay on the city map, whose filters (MAP
     * LAYERS) still hide whole kinds on both maps. The district name is the top bar's, not the minimap's.
     * Every painter counts what it draws (mapMarkCount: blips, and labels for text) so the clutter is measurable.
     */
    const MINIMAP_NEAR = 480,
      mapMarks = { blips: 0, labels: 0, route: false, waypoint: false },
      minimapMarks = { blips: 0, labels: 0, route: false, waypoint: false, refreshes: 0, peakBlips: 0, peakLabels: 0 };
    function mapMarkCount(blips, labels) {
      mapMarks.blips += blips;
      mapMarks.labels += labels;
    }
    function mapMarksBegin() {
      mapMarks.blips = 0;
      mapMarks.labels = 0;
      mapMarks.route = false;
      mapMarks.waypoint = false;
    }
    function mapMarksEnd(big) {
      if (big) return;
      const m = minimapMarks;
      m.blips = mapMarks.blips;
      m.labels = mapMarks.labels;
      m.route = mapMarks.route;
      m.waypoint = mapMarks.waypoint;
      m.refreshes++;
      if (m.blips > m.peakBlips) m.peakBlips = m.blips;
      if (m.labels > m.peakLabels) m.peakLabels = m.labels;
    }
    /* A place (shop, station, bike dock) on the minimap: on foot, within MINIMAP_NEAR of the player. */
    function minimapPlaceNear(x, y) {
      if (player.car) return false;
      const dx = x - player.x,
        dy = y - player.y;
      return dx * dx + dy * dy < MINIMAP_NEAR * MINIMAP_NEAR;
    }
    /* Police on the minimap: every unit while wanted, otherwise only units on a job of their own. */
    function minimapPoliceShown(alerted) {
      return wantedStars > 0 || alerted;
    }
    /* The respray the minimap shows: the nearest garage while the player is wanted, else null. */
    function minimapRespray() {
      if (wantedStars <= 0) return null;
      let best = null,
        bestD = Infinity;
      for (let i = 0; i < GARAGES.length; i++) {
        const s = GARAGES[i],
          dx = s.x - player.x,
          dy = s.y - player.y,
          d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      return best;
    }
    /* The payphone the minimap shows: the one the waiting call guides to, else null. */
    function minimapPayphone() {
      return !mission && storyCallWaiting() ? storyPayphone() : null;
    }
    /* Console minimapReport(reset): what the minimap drew on its last refresh, the most since the last reset (true
       starts a new peak) and the rules that chose it. */
    function minimapReport(reset) {
      const respray = minimapRespray(),
        phone = minimapPayphone(),
        target = objective(),
        out = {
          marks: { blips: minimapMarks.blips, labels: minimapMarks.labels },
          peak: { blips: minimapMarks.peakBlips, labels: minimapMarks.peakLabels },
          refreshes: minimapMarks.refreshes,
          objective: target ? { x: Math.round(target.x), y: Math.round(target.y) } : null,
          // The objective's GPS road route as the last refresh drew it.
          route: minimapMarks.route,
          // The map waypoint's road route (cyan).
          waypointRoute: minimapMarks.waypoint,
          routePoints: gpsRoute.points.length,
          highlight: mapHighlightVehicle() ? mapHighlight.label : null,
          respray: respray ? respray.name : null,
          payphone: phone ? { x: Math.round(phone.x), y: Math.round(phone.y) } : null,
          police: wantedStars > 0 ? 'all' : 'on a job only',
          placesNear: !player.car ? worldMeters(MINIMAP_NEAR) : 0,
          folded: !!hudState.minimapFolded,
        };
      if (reset === true) minimapMarks.peakBlips = minimapMarks.peakLabels = 0;
      return out;
    }
