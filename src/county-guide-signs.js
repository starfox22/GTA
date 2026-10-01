    // The county's roadside guide signs as a plan (verge, two posts, real size) and the audit that
    // no board of any kind stands on or across asphalt (console guideSigns()). Drawn by county3d-signs.js.
    /* A guide sign stands on the verge beside the road, never on it: boards are 4-5 m wide (width
       40) and face south like every sign() (the camera, and traffic heading north). `road` names
       the road it serves; the audit keeps every board clear of any carriageway. */
    const COUNTY_GUIDE_SIGNS = [
      { text: 'EAGLE PASS · SCENIC ROUTE', road: 'RIDGELINE HIGHWAY', x: 6735, y: 2590, width: 44, color: '#d5d6b9' },
      { text: 'OCEANVIEW / AIRPORT', road: 'OCEANVIEW AVENUE', x: 3322, y: 6760, width: 44, color: '#c3ded5' },
      { text: 'CORAL COAST', road: 'CORAL COAST DRIVE', x: 7342, y: 7400, width: 40, color: '#f2ccae' },
    ];
    const TRAILHEAD_SIGN_WIDTH = 44,
      SCENIC_SIGN_WIDTH = 44,
      TOWN_SIGN_WIDTH = 72;
    /* Where a mountain trail's head board stands: 80 units up the trail, 62 to its side. */
    function trailheadSignSpot(trail) {
      let [bx, by] = trail.points[0],
        left = 80,
        heading = 0;
      for (let i = 1; i < trail.points.length && left > 0; i++) {
        const [ax, ay] = trail.points[i - 1],
          [cx, cy] = trail.points[i],
          length = Math.hypot(cx - ax, cy - ay),
          f = Math.min(1, left / length);
        heading = Math.atan2(cy - ay, cx - ax);
        bx = ax + (cx - ax) * f;
        by = ay + (cy - ay) * f;
        left -= length;
      }
      return { x: bx + Math.sin(heading) * 62, y: by - Math.cos(heading) * 62 };
    }
    const SIGN_VERGE = 12;
    /* The board's footprint (its width along x, at y) clear of every carriageway by SIGN_VERGE. */
    function signSpotClear(x, y, width) {
      for (const f of [-0.5, -0.25, 0, 0.25, 0.5]) if (cityStreetAt(x + f * width, y, SIGN_VERGE)) return false;
      return true;
    }
    /* Where a board planned at (x, y) may stand: there if its footprint is clear of asphalt, else the
       nearest clear patch of dry ground within 60 units (boards all face south, so a board beside a
       north-south road needs room for its width), or null: then the board is left out. Every
       county board is placed through this. */
    function signSpot(x, y, width) {
      if (signSpotClear(x, y, width)) return { x, y };
      for (let r = 6; r <= 60; r += 6)
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2,
            px = x + Math.cos(a) * r,
            py = y + Math.sin(a) * r;
          if (signSpotClear(px, py, width) && landAt(px, py) && !solid(px, py, 6)) return { x: px, y: py };
        }
      return null;
    }
    /* Every free-standing board the county builders place, with its footprint checked against the
       roads: `onAsphalt` (any point of the board's width on a carriageway) and `clearance` (the
       smallest margin, in units, at which the board still touches one; 0 = touching). */
    function guideSignReport() {
      const boards = [],
        add = (kind, text, x, y, width) => {
          const at = signSpot(x, y, width);
          if (at) boards.push({ kind, text, x: at.x, y: at.y, width });
        };
      for (const s of COUNTY_GUIDE_SIGNS) add('guide', s.text, s.x, s.y, s.width);
      for (const v of scenicRoadFurniture().views) add('scenic-view', 'SCENIC VIEW', v.sign.x, v.sign.y, SCENIC_SIGN_WIDTH);
      for (const t of COUNTY_TOWNS) add('town', t.name, t.x + 200, t.y - 72, TOWN_SIGN_WIDTH);
      for (const trail of MOUNTAIN_TRAILS) {
        const head = trailheadSignSpot(trail);
        add('trailhead', trail.peak.name, head.x, head.y, TRAILHEAD_SIGN_WIDTH);
      }
      return boards.map((b) => {
        const samples = [-0.5, -0.25, 0, 0.25, 0.5].map((f) => [b.x + f * b.width, b.y]);
        let clearance = 40;
        for (let m = 0; m < 40; m += 2)
          if (samples.some(([x, y]) => cityStreetAt(x, y, m))) {
            clearance = m;
            break;
          }
        return { ...b, onAsphalt: samples.some(([x, y]) => onRoad(x, y)), clearance };
      });
    }
