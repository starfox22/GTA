    // North Point towers: SKYLINE_TOWERS (three on North Point Key, the rest in reserve), the retired cluster blocks and the offices that replaced them.
    /**
     * North Point towers
     * Source: src/skyline-towers.js
     * Scope: game closure (data and world build; the towers are drawn by src/skyline3d.js).
     *
     * The financial district on the north-east point of the reclamation was one
     * planned cluster of eighteen named towers, block by block. Standing in a
     * row across the camera's view they hid everything north of them, so the
     * cluster was retired: three towers (MERCURY, FEDERATION EAST, EVOLUTION)
     * moved onto North Point Key, the islet off the point (skyline-islet.js),
     * where only water lies behind them, and the district's blocks became
     * ordinary mid-rise offices (buildNorthPointBlock).
     *
     * Every tower keeps its old grid address (bx, by) and lot. A lot is
     * [dx, dy, w, h] from the block's inner corner (blockX(bx) + 89,
     * blockY(by) + 89; blocks are 334 square) and is the building's collision
     * rectangle: the podium fills it and the shaft stays inside it, so what stops
     * a car, a bullet or a helicopter is what the eye sees. `height` is the main
     * roof (collision and roof walking) in plan units; crowns, masts and spires
     * rise above it and are drawn only.
     *
     * - `reserve`: kept (design, name, lot) but not built. Clearing it puts the
     *   tower back on its block (skylineBlockTowers).
     * - `site` [x, y, w, h]: a world lot the tower stands on instead (the Key).
     * - `roof`: 'helipad' (a landing deck with the lift, skyline-lift.js) or
     *   'bar' (the CIRRUS sky bar, skyline-bar.js); `twist` overrides a design's
     *   twist (radians, EVOLUTION: its top lies east-west for the bar).
     */
    const SKYLINE_TOWERS = [
      // The old cluster's order (each tower's dressing is seeded by its index).
      // On North Point Key: FEDERATION EAST (helipad), MERCURY and EVOLUTION (the sky bar).
      { id: 'federation-east', name: 'FEDERATION EAST', design: 'federation', bx: 5, by: -6, lot: [16, 18, 170, 214], height: 1150, site: [3998, -3946, 184, 214], roof: 'helipad' },
      { id: 'federation-west', name: 'FEDERATION WEST', design: 'federationWest', bx: 5, by: -6, lot: [204, 56, 112, 176], height: 760, reserve: true },
      { id: 'mercury', name: 'MERCURY TOWER', design: 'mercury', bx: 4, by: -6, lot: [58, 22, 220, 214], height: 1000, site: [3806, -3924, 176, 190] },
      { id: 'capitals-north', name: 'CAPITAL NORTH', design: 'capitals', bx: 5, by: -5, lot: [20, 20, 154, 196], height: 900, reserve: true },
      { id: 'capitals-bay', name: 'CAPITAL BAY', design: 'capitalsBay', bx: 5, by: -5, lot: [192, 64, 124, 160], height: 610, reserve: true },
      { id: 'evolution', name: 'EVOLUTION', design: 'evolution', bx: 4, by: -5, lot: [64, 26, 206, 206], height: 820, site: [4200, -3924, 204, 204], roof: 'bar', twist: Math.PI },
      { id: 'embankment', name: 'EMBANKMENT TOWER', design: 'embankment', bx: 5, by: -7, lot: [24, 24, 168, 200], height: 860, reserve: true },
      { id: 'embankment-low', name: 'EMBANKMENT HOUSE', design: 'embankmentLow', bx: 5, by: -7, lot: [208, 64, 104, 160], height: 520, reserve: true },
      { id: 'imperial', name: 'IMPERIAL SAIL', design: 'sail', bx: 4, by: -7, lot: [60, 30, 214, 196], height: 700, reserve: true },
      { id: 'neva-north', name: 'NEVA ONE', design: 'neva', bx: 3, by: -6, lot: [24, 26, 136, 200], height: 700, reserve: true },
      { id: 'neva-south', name: 'NEVA TWO', design: 'nevaTwo', bx: 3, by: -6, lot: [178, 26, 136, 200], height: 650, reserve: true },
      { id: 'oko', name: 'OKO', design: 'oko', bx: 3, by: -5, lot: [68, 28, 198, 198], height: 560, reserve: true },
      { id: 'needle', name: 'NORTH POINT NEEDLE', design: 'needle', bx: 5, by: -8, lot: [80, 36, 174, 174], height: 600, reserve: true },
      { id: 'crown', name: 'CROWN EXCHANGE', design: 'crown', bx: 5, by: -4, lot: [62, 26, 210, 210], height: 600, reserve: true },
      { id: 'rotunda', name: 'EXCHANGE ROTUNDA', design: 'rotunda', bx: 3, by: -7, lot: [84, 34, 166, 166], height: 440, reserve: true },
      { id: 'meridian', name: 'MERIDIAN', design: 'meridian', bx: 4, by: -8, lot: [66, 30, 202, 190], height: 470, reserve: true },
      { id: 'terraces', name: 'THE TERRACES', design: 'terraces', bx: 3, by: -8, lot: [30, 24, 274, 184], height: 300, reserve: true },
      // Its roof was the cluster's helipad; the Key's is FEDERATION EAST's.
      { id: 'diagrid', name: 'NORTH POINT TRUST', design: 'diagrid', bx: 3, by: -4, lot: [44, 26, 246, 192], height: 340, reserve: true },
    ];
    // Towers still planned on a grid block (none while the cluster is retired).
    const skylineBlockTowers = (bx, by) => SKYLINE_TOWERS.filter((t) => !t.reserve && !t.site && t.bx === bx && t.by === by);
    // Every tower the old cluster plan put on a block, built or not.
    const retiredSkylineTowers = (bx, by) => SKYLINE_TOWERS.filter((t) => t.bx === bx && t.by === by);
    // The towers that stand somewhere (a block or a site).
    const activeSkylineTowers = () => SKYLINE_TOWERS.filter((t) => !t.reserve);
    /**
     * Plaza ground under a cluster block (both ground canvases call this: the
     * game's 2D/minimap canvas and the renderer's ground texture): granite paving
     * with a joint grid and darker banding across the south plaza. Trees come from
     * buildSkylineBlock, the fountain and benches from skyline3d.js.
     */
    function paintSkylinePlaza(g, x, y, w, h) {
      g.fillStyle = '#b9b5a9';
      g.fillRect(x, y, w, h);
      g.strokeStyle = '#a29e92';
      g.lineWidth = 1;
      g.beginPath();
      for (let k = 12; k < w; k += 16) {
        g.moveTo(x + k, y);
        g.lineTo(x + k, y + h);
      }
      for (let k = 12; k < h; k += 16) {
        g.moveTo(x, y + k);
        g.lineTo(x + w, y + k);
      }
      g.stroke();
      // Darker granite banding along the south plaza.
      g.fillStyle = '#8f8c83';
      for (let k = 0; k < w; k += 64) g.fillRect(x + k, y + h - 70, 32, 70);
    }
    // Lays out one cluster block: the tower lots, the plaza and its planting.
    function buildSkylineBlock(bx, by, x, y, w, h, list = skylineBlockTowers(bx, by)) {
      paintSkylinePlaza(groundContext, x + 4, y + 4, w - 8, h - 8);
      const lots = [];
      for (const t of list) {
        const [dx, dy, lw, lh] = t.lot;
        makeBuilding(x + dx, y + dy, lw, lh, 0, true);
        const b = buildings[buildings.length - 1];
        b.height = t.height;
        b.skyline = t;
        lots.push(b);
      }
      // Trees in the side strips and along the south plaza, clear of every lot.
      const clear = (px, py, r) => !lots.some((b) => px > b.x - r && px < b.x + b.w + r && py > b.y - r && py < b.y + b.h + r);
      for (let py = y + 40; py < y + h - 20; py += 46)
        for (const px of [x + 22, x + w - 22]) if (clear(px, py, 16)) drawTree(px, py, 11);
      // The middle of the south plaza is left open for the fountain (skyline3d.js).
      for (const px of [x + 50, x + 108, x + w - 108, x + w - 50]) if (clear(px, y + h - 24, 16)) drawTree(px, y + h - 24, 10);
    }
    /**
     * THE OFFICES THAT REPLACED THE CLUSTER
     * One ordinary mid-rise building for each retired tower on the block (so
     * the buildings after them keep their index in `buildings`, and with it
     * their zoned height and facade), 5-10 storeys, with the block's car park
     * behind. One building: a slab set back on a granite forecourt between two
     * planted strips. Two: a pair along the front with a service lane between.
     */
    const NORTH_POINT_OFFICE_HEIGHTS = [96, 118, 84, 132, 104, 90, 124, 110];
    function northPointOfficeLots(bx, by, x, y, w) {
      return retiredSkylineTowers(bx, by).length === 1
        ? [[x + 52, y + 12, w - 104, 140]]
        : [
            [x + 7, y + 7, 150, 146],
            [x + 172, y + 7, w - 179, 146],
          ];
    }
    // The forecourt, strips or lane (both ground canvases; the renderer adds its own car park).
    function paintNorthPointOffices(g, bx, by, x, y, w) {
      if (retiredSkylineTowers(bx, by).length === 1) {
        paintSkylinePlaza(g, x + 4, y + 4, w - 8, 158);
        g.fillStyle = '#5f7a52';
        g.fillRect(x + 8, y + 10, 38, 146);
        g.fillRect(x + w - 46, y + 10, 38, 146);
      } else {
        g.fillStyle = '#3d423f';
        g.fillRect(x + 157, y + 7, 15, 146);
      }
    }
    /**
     * A retired cluster block. First the old plan is replayed unseen (painted
     * through an empty clip, its buildings and trees dropped again) only for its
     * draws of the seeded random stream: every block built after it keeps the
     * layout it always had. The offices then draw from a stream of their own.
     */
    function buildNorthPointBlock(bx, by, x, y, w, h) {
      const count = buildings.length,
        planted = trees.length;
      groundContext.save();
      groundContext.beginPath();
      groundContext.rect(x, y, 0, 0);
      groundContext.clip();
      buildSkylineBlock(bx, by, x, y, w, h, retiredSkylineTowers(bx, by));
      groundContext.restore();
      const resume = randomSeed;
      buildings.length = count;
      trees.length = planted;
      randomSeed = (Math.imul(bx + 97, 7919) ^ Math.imul(by + 211, 104729)) >>> 0;
      const lots = northPointOfficeLots(bx, by, x, y, w);
      paintNorthPointOffices(groundContext, bx, by, x, y, w);
      lots.forEach(([lx, ly, lw, lh], k) => {
        makeBuilding(lx, ly, lw, lh, 0, true);
        buildings[buildings.length - 1].height = NORTH_POINT_OFFICE_HEIGHTS[(k + bx * 3 + by * 5 + 64) % 8];
      });
      if (lots.length === 1) for (let py = y + 34; py < y + 150; py += 38) for (const px of [x + 27, x + w - 27]) drawTree(px, py, 11);
      // The car park behind, as on any other block (the renderer paints its own).
      rect(x + 8, y + 164, w - 16, h - 172, '#4b524b');
      for (let p = 0; p < 11; p++) {
        rect(x + 22 + p * 27, y + 170, 1, 44, '#d3d1a26b');
        rect(x + 22 + p * 27, y + 278, 1, 44, '#d3d1a26b');
      }
      label('P', x + w / 2, y + 256, 19, '#9aa08a');
      randomSeed = resume;
    }
