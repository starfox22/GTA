    // BEGIN SUBSYSTEM: src/skyline.js — North Point financial cluster plan
    /**
     * North Point financial cluster plan
     * Source: src/skyline.js
     * Scope: game closure (data and world build; the towers are drawn by src/skyline3d.js).
     *
     * The financial district on the north-east point of the reclamation is laid
     * out as one planned cluster in the manner of Moscow's international business
     * centre: every block carries its own named tower (or pair) on a plaza, each
     * with its own silhouette, and the heights rise toward the core on the wide
     * avenue at x 2688. Blocks are addressed by grid index (bx, by) like the rest
     * of the plan, so the cluster moves with the grid.
     *
     * A lot is [dx, dy, w, h] from the block's inner corner (blockX(bx) + 89,
     * blockY(by) + 89; blocks are 334 square). The lot is the building's collision
     * rectangle: every tower keeps its podium on the full lot and its shaft inside
     * it, so what stops a car, a bullet or a helicopter is what the eye sees.
     * `height` is the main roof (collision and roof walking); crowns, masts and
     * spires rise above it and are drawn only.
     */
    const SKYLINE_TOWERS = [
      // Core, east of Harbor Ave: the twin sail towers on one podium.
      { id: 'federation-east', name: 'FEDERATION EAST', design: 'federation', bx: 5, by: -6, lot: [16, 18, 170, 214], height: 1150 },
      { id: 'federation-west', name: 'FEDERATION WEST', design: 'federationWest', bx: 5, by: -6, lot: [204, 56, 112, 176], height: 760 },
      // Core, west of Harbor Ave: stepped copper tower with a spire.
      { id: 'mercury', name: 'MERCURY TOWER', design: 'mercury', bx: 4, by: -6, lot: [58, 22, 220, 214], height: 1000 },
      // South of the core: stacked-block pair, twisted tower.
      { id: 'capitals-north', name: 'CAPITAL NORTH', design: 'capitals', bx: 5, by: -5, lot: [20, 20, 154, 196], height: 900 },
      { id: 'capitals-bay', name: 'CAPITAL BAY', design: 'capitalsBay', bx: 5, by: -5, lot: [192, 64, 124, 160], height: 610 },
      { id: 'evolution', name: 'EVOLUTION', design: 'evolution', bx: 4, by: -5, lot: [64, 26, 206, 206], height: 820 },
      // North of the core: the curved-facade pair and the sail.
      { id: 'embankment', name: 'EMBANKMENT TOWER', design: 'embankment', bx: 5, by: -7, lot: [24, 24, 168, 200], height: 860 },
      { id: 'embankment-low', name: 'EMBANKMENT HOUSE', design: 'embankmentLow', bx: 5, by: -7, lot: [208, 64, 104, 160], height: 520 },
      { id: 'imperial', name: 'IMPERIAL SAIL', design: 'sail', bx: 4, by: -7, lot: [60, 30, 214, 196], height: 700 },
      // West row: chevron twins, banded tower.
      { id: 'neva-north', name: 'NEVA ONE', design: 'neva', bx: 3, by: -6, lot: [24, 26, 136, 200], height: 700 },
      { id: 'neva-south', name: 'NEVA TWO', design: 'nevaTwo', bx: 3, by: -6, lot: [178, 26, 136, 200], height: 650 },
      { id: 'oko', name: 'OKO', design: 'oko', bx: 3, by: -5, lot: [68, 28, 198, 198], height: 560 },
      // Outer ring: lower and quieter, each still its own. The block between Crown
      // Exchange and North Point Trust is Reclamation Green (a park).
      { id: 'needle', name: 'NORTH POINT NEEDLE', design: 'needle', bx: 5, by: -8, lot: [80, 36, 174, 174], height: 600 },
      { id: 'crown', name: 'CROWN EXCHANGE', design: 'crown', bx: 5, by: -4, lot: [62, 26, 210, 210], height: 600 },
      { id: 'rotunda', name: 'EXCHANGE ROTUNDA', design: 'rotunda', bx: 3, by: -7, lot: [84, 34, 166, 166], height: 440 },
      { id: 'meridian', name: 'MERIDIAN', design: 'meridian', bx: 4, by: -8, lot: [66, 30, 202, 190], height: 470 },
      { id: 'terraces', name: 'THE TERRACES', design: 'terraces', bx: 3, by: -8, lot: [30, 24, 274, 184], height: 300 },
      // Its roof is the cluster's helipad (rooftops.js).
      { id: 'diagrid', name: 'NORTH POINT TRUST', design: 'diagrid', bx: 3, by: -4, lot: [44, 26, 246, 192], height: 340, helipad: true },
    ];
    const skylineBlockTowers = (bx, by) => SKYLINE_TOWERS.filter((t) => t.bx === bx && t.by === by);
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
    function buildSkylineBlock(bx, by, x, y, w, h) {
      paintSkylinePlaza(groundContext, x + 4, y + 4, w - 8, h - 8);
      const lots = [];
      for (const t of skylineBlockTowers(bx, by)) {
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
    // END SUBSYSTEM: src/skyline.js
