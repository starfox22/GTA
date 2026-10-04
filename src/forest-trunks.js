    // The Ridgeline forest's trunks as vehicle obstacles: a cell index per terrain field built from the
    // same scenery lists the renderer plants (forestTrunks), forestTrunkContacts() each physics step, forestTrunkReport().
    /**
     * FOREST TRUNKS
     * Every tree of the mountain forest (terrainFieldScenery: what county3d-forest.js
     * draws, after the 4x4 trails' view corridor took its share) has a trunk that
     * stops a vehicle: a square post FOREST_TRUNK_HALF-sized by the tree's size
     * (25-40 cm across, the drawn trunk's girth), resolved like any wall
     * (boxContact, resolveContact: the crash, the damage, the sound of wood).
     * Forest trees are old and rooted: unlike the street trees (damage-upkeep.js
     * treeProp) nothing short of the tank knocks one down, and the tank, which
     * flattens whatever it leans on, drives through them as before.
     * Per field the trunks are filed once in a flat cell index (counting sort into
     * `order`, `start` per FOREST_TRUNK_CELL cell), built on the first vehicle that
     * needs it, so the contact pass is a few array reads per vehicle and allocates
     * nothing unless something is hit. Like the street furniture, only vehicles
     * within 1400 units of the player are tested.
     */
    const FOREST_TRUNK_CELL = 32,
      // A trunk is solid this far up from its foot (a truck flying higher clears it).
      FOREST_TRUNK_REACH_UP = 60;
    function forestTrunkHalf(size) {
      return clamp(size * FOREST_TREE_SCALE * 2.2, 1.5, 2.6);
    }
    function forestTrunks(field) {
      if (field.trunks) return field.trunks;
      const { conifers, broadleaf } = terrainFieldScenery(field),
        n = (conifers.length + broadleaf.length) / 6,
        data = new Float32Array(n * 4),
        cols = Math.ceil((field.x1 - field.x0) / FOREST_TRUNK_CELL) + 1,
        rows = Math.ceil((field.y1 - field.y0) / FOREST_TRUNK_CELL) + 1,
        start = new Int32Array(cols * rows + 1),
        order = new Int32Array(n),
        cellOf = new Int32Array(n);
      let t = 0;
      for (const list of [conifers, broadleaf])
        for (let k = 0; k < list.length; k += 6, t++) {
          data[t * 4] = list[k];
          data[t * 4 + 1] = list[k + 1];
          data[t * 4 + 2] = list[k + 2];
          data[t * 4 + 3] = forestTrunkHalf(list[k + 3]);
          const c = clamp(Math.floor((list[k] - field.x0) / FOREST_TRUNK_CELL), 0, cols - 1),
            r = clamp(Math.floor((list[k + 1] - field.y0) / FOREST_TRUNK_CELL), 0, rows - 1);
          cellOf[t] = r * cols + c;
          start[cellOf[t] + 1]++;
        }
      for (let i = 1; i <= cols * rows; i++) start[i] += start[i - 1];
      const fill = start.slice(0, cols * rows);
      for (let i = 0; i < n; i++) order[fill[cellOf[i]]++] = i;
      return (field.trunks = { n, data, start, order, cols, rows, x0: field.x0, y0: field.y0, fieldIndex: TERRAIN_FIELDS.indexOf(field) });
    }
    // The one static body every trunk contact borrows (boxContact and resolveContact are done with it at once).
    const forestTrunkBody = { x: 0, y: 0, hx: 2, hy: 2, a: 0, id: '', kind: 'prop', material: 'wood' },
      // Contacts since the start (forestTrunks() reports them): how many, and the last.
      forestTrunkHits = { n: 0, last: null };
    // Once per physics step, after streetPropContacts: moving vehicles near the player against the trunks.
    function forestTrunkContacts() {
      for (let v = 0; v < vehicles.length; v++) {
        const c = vehicles[v];
        if (c.resting || isBoat(c) || (isAircraft(c) && aircraftClearance(c) > 4)) continue;
        if (Math.abs(c.vx || 0) + Math.abs(c.vy || 0) < 0.6 && Math.abs(c.av || 0) < 0.02) continue;
        if (Math.abs(c.x - player.x) > 1400 || Math.abs(c.y - player.y) > 1400) continue;
        let field = null;
        for (let f = 0; f < TERRAIN_FIELDS.length; f++) {
          const F = TERRAIN_FIELDS[f];
          if (c.x >= F.x0 && c.x <= F.x1 && c.y >= F.y0 && c.y <= F.y1) {
            field = F;
            break;
          }
        }
        if (!field || !field.ready) continue;
        const spec = vehicleSpec(c);
        if (spec.tank) continue;
        const T = field.trunks || forestTrunks(field);
        if (!T.n) continue;
        const reach = (spec.l + spec.w) / 2 + 4,
          i0 = Math.max(0, Math.floor((c.x - reach - T.x0) / FOREST_TRUNK_CELL)),
          i1 = Math.min(T.cols - 1, Math.floor((c.x + reach - T.x0) / FOREST_TRUNK_CELL)),
          j0 = Math.max(0, Math.floor((c.y - reach - T.y0) / FOREST_TRUNK_CELL)),
          j1 = Math.min(T.rows - 1, Math.floor((c.y + reach - T.y0) / FOREST_TRUNK_CELL)),
          data = T.data;
        let elevation = NaN;
        for (let j = j0; j <= j1; j++)
          for (let i = i0; i <= i1; i++) {
            const cell = j * T.cols + i;
            for (let q = T.start[cell]; q < T.start[cell + 1]; q++) {
              const k = T.order[q] * 4,
                half = data[k + 3];
              if (Math.abs(data[k] - c.x) > reach + half || Math.abs(data[k + 1] - c.y) > reach + half) continue;
              if (elevation !== elevation) elevation = entityElevation(c);
              if (elevation > data[k + 2] + FOREST_TRUNK_REACH_UP) continue;
              const body = forestTrunkBody;
              if (body.x !== data[k]) body.x = data[k];
              if (body.y !== data[k + 1]) body.y = data[k + 1];
              if (body.hx !== half) body.hx = body.hy = half;
              const hit = boxContact(contactShape(c), body);
              if (!hit) continue;
              body.id = 'f' + T.fieldIndex + '.' + T.order[q];
              forestTrunkHits.n++;
              forestTrunkHits.last = { vehicle: c.id, type: c.type, player: c === player.car, x: Math.round(body.x), y: Math.round(body.y), kmh: Math.round(Math.hypot(c.vx, c.vy) / KMH), at: +physicsClock.toFixed(2) };
              resolveContact(c, null, hit, body, true);
            }
          }
      }
    }
    /* DeadEndCity.forestTrunks(x, y, radius): the trunks round a point, nearest first
       ([x, y, ground, half] in map units, at most 40), and how many the field holds.
       With no point: every field's count, and the trunks that stand on or within 6
       units of a carriageway (county and scenic roads) or on a 4x4 trail (all 0), and
       the contacts so far (`hits`: count and the last). */
    function forestTrunkReport(x, y, radius = 120) {
      if (x === undefined || x === null) {
        const out = { fields: {}, nearRoad: [], onTrail: [], hits: forestTrunkHits },
          near = {};
        for (const f of TERRAIN_FIELDS) {
          const T = forestTrunks(terrainField(f));
          out.fields[f.name] = T.n;
          for (let t = 0; t < T.n; t++) {
            const tx = T.data[t * 4],
              ty = T.data[t * 4 + 1],
              road = scenicRoadNear(tx, ty, near),
              spot = [Math.round(tx), Math.round(ty)];
            if (onCountyRoad(tx, ty, 6) || (road && road.d - road.road.half < 6)) out.nearRoad.push(spot);
            if (onMountainTrail(tx, ty)) out.onTrail.push(spot);
          }
        }
        out.nearRoad = { count: out.nearRoad.length, first: out.nearRoad.slice(0, 10) };
        out.onTrail = { count: out.onTrail.length, first: out.onTrail.slice(0, 10) };
        return out;
      }
      const field = terrainFieldAt(x, y);
      if (!field) return { field: null, trunks: [] };
      const T = forestTrunks(terrainField(field)),
        found = [];
      for (let t = 0; t < T.n; t++) {
        const d = Math.hypot(T.data[t * 4] - x, T.data[t * 4 + 1] - y);
        if (d <= radius) found.push([d, t]);
      }
      found.sort((a, b) => a[0] - b[0]);
      return {
        field: field.name,
        total: T.n,
        within: found.length,
        trunks: found.slice(0, 40).map(([, t]) => [0, 1, 2, 3].map((o) => +T.data[t * 4 + o].toFixed(1))),
      };
    }
