      // Vescari's table on the Blue Hour terrace (mission 2): linen to the floor, place settings in china, crystal and
      // brass, flowers, hurricane candles, champagne on ice, velvet chairs, and the reserved glass (the job's target).
      /* Real sizes: a 1.85 m round table 0.78 m high (top at y 9.2 over the deck at
         2.8), chairs with 0.5 m seats; only the reserved glass is drawn a little large
         (a big Burgundy bowl) so it reads from the street camera as the thing to spike.
         Its place is ROOF_HIT.drink; the table stays inside its 2 m roofCover square,
         the chairs' backs just past it. Vescari's side (east) is left open: he stands
         there to lift the glass (crowd3d-roofparty.js). */
      const vipCover = roofCover.find((p) => p.kind === 'table'),
        tx = vipCover.x - ROOFTOP.x + vipCover.w / 2,
        tz = vipCover.y - ROOFTOP.y + vipCover.h / 2,
        tableTop = 9.2,
        linen = staticMat('#f4f0e7', 0.92),
        china = staticMat('#f8f5ef', 0.35),
        silver = staticMat('#d4d8da', 0.2, 0.9),
        wine = staticMat('#5e0f22', 0.15, 0.1),
        champagne = staticMat('#e8d28c', 0.18, 0.1),
        bottleGreen = staticMat('#173a2a', 0.15, 0.2);
      // Cloth: a flared drape to the deck, the top a touch wider, a navy runner.
      mesh(new Three.CylinderGeometry(7.3, 7.9, tableTop - 3.1, 32), linen, roofGroup, tx, (tableTop + 2.9) / 2, tz);
      mesh(new Three.CylinderGeometry(7.5, 7.45, 0.3, 32), linen, roofGroup, tx, tableTop - 0.15, tz);
      box(roofGroup, tx, tableTop + 0.02, tz, 2.4, 0.04, 14.6, navy);
      // Crystal: a foot, a stem and an open bowl with the drink showing inside.
      function stemware(x, z, flute) {
        round(roofGroup, x, tableTop + 0.05, z, flute ? 0.32 : 0.4, 0.1, crystal);
        round(roofGroup, x, tableTop + 0.7, z, 0.07, 1.2, crystal);
        if (flute) {
          mesh(bowlGeo, crystal, roofGroup, x, tableTop + 2.1, z, 0.34, 1.6, 0.34);
          round(roofGroup, x, tableTop + 1.95, z, 0.26, 1.2, champagne);
        } else {
          mesh(bowlGeo, crystal, roofGroup, x, tableTop + 1.85, z, 0.62, 1.1, 0.62);
          round(roofGroup, x, tableTop + 1.62, z, 0.5, 0.45, wine);
        }
      }
      // Place settings round the table (offsets from its centre, laid out so nothing
      // touches): brass charger, china plate, folded napkin, silver either side, a
      // wine glass and a flute at the diner's right. Vescari's (east-north-east) has
      // only a flute: his wine is the reserved glass.
      for (const [a, glasses] of [
        [-Math.PI / 2, [[-1.7, -3.5, false], [-2.8, -3.9, true]]],
        [Math.PI / 2, [[1.7, 3.6, false], [2.8, 3.9, true]]],
        [Math.PI, [[-3.6, 1.6, false], [-4, 2.7, true]]],
        [-0.75, [[1.6, -3.2, true]]],
      ]) {
        const ca = Math.cos(a),
          sa = Math.sin(a),
          px = tx + ca * 5.3,
          pz = tz + sa * 5.3,
          yaw = Math.PI / 2 - a;
        round(roofGroup, px, tableTop + 0.05, pz, 1.4, 0.1, brass);
        round(roofGroup, px, tableTop + 0.16, pz, 1.1, 0.12, china);
        const napkin = box(roofGroup, px, tableTop + 0.45, pz, 1.3, 0.5, 0.75, navy);
        napkin.rotation.y = yaw + Math.PI / 2;
        for (const side of [-1, 1]) {
          const piece = box(roofGroup, px - sa * side * 1.8, tableTop + 0.05, pz + ca * side * 1.8, 0.22, 0.06, 1.6, silver);
          piece.rotation.y = yaw;
        }
        for (const [dx, dz, flute] of glasses) stemware(tx + dx, tz + dz, flute);
      }
      // Centrepiece: a low brass bowl of roses and ranunculus in white, blush and deep red.
      mesh(new Three.CylinderGeometry(1.7, 1.1, 0.8, 20), brass, roofGroup, tx, tableTop + 0.4, tz);
      for (let k = 0; k < 7; k++) {
        const a = (k * TAU) / 7;
        mesh(sphereGeo, k % 2 ? boxwoodLight : boxwood, roofGroup, tx + Math.cos(a) * 1.5, tableTop + 0.95, tz + Math.sin(a) * 1.5, 0.75, 0.35, 0.5).rotation.y = -a;
      }
      for (const [dx, dz, dy, r, color] of [
        [0, 0, 1.95, 0.72, '#f4efe9'],
        [0.9, 0.45, 1.55, 0.6, '#e8b4b8'],
        [-0.8, 0.55, 1.6, 0.6, '#8e1f2a'],
        [0.3, -0.9, 1.55, 0.6, '#e8b4b8'],
        [-0.55, -0.7, 1.65, 0.55, '#f4efe9'],
        [1.1, -0.5, 1.35, 0.5, '#8e1f2a'],
        [-1.2, -0.1, 1.35, 0.5, '#f4efe9'],
      ])
        mesh(sphereGeo, staticMat(color, 0.75), roofGroup, tx + dx, tableTop + dy, tz + dz, r, r * 0.8, r);
      // Hurricane candles: a pillar in a crystal chimney on a brass base.
      for (const [dx, dz] of [
        [2.6, 1.6],
        [-2.4, -1.8],
      ]) {
        round(roofGroup, tx + dx, tableTop + 0.1, tz + dz, 0.75, 0.2, brass);
        round(roofGroup, tx + dx, tableTop + 0.8, tz + dz, 0.38, 1.2, cushion);
        mesh(sphereGeo, warmLamp, roofGroup, tx + dx, tableTop + 1.6, tz + dz, 0.16, 0.34, 0.16);
        mesh(new Three.CylinderGeometry(0.7, 0.62, 2.4, 16, 1, true), crystal, roofGroup, tx + dx, tableTop + 1.4, tz + dz);
      }
      halo(roofGroup, tx, tableTop + 2.4, tz, 10, '#ffdca8');
      // Champagne on ice: a silver bucket, the bottle at a lean, a white napkin on the rim.
      const bucketX = tx - 2.6,
        bucketZ = tz + 3.2;
      mesh(new Three.CylinderGeometry(1.05, 0.85, 1.9, 18), silver, roofGroup, bucketX, tableTop + 0.95, bucketZ);
      round(roofGroup, bucketX, tableTop + 1.88, bucketZ, 0.95, 0.06, staticMat('#dfeef2', 0.1, 0.2));
      for (let k = 0; k < 5; k++) {
        const a = k * 1.3;
        box(roofGroup, bucketX + Math.cos(a) * 0.55, tableTop + 1.95, bucketZ + Math.sin(a) * 0.55, 0.35, 0.3, 0.35, staticMat('#eef6f8', 0.1));
      }
      const bottle = new Three.Group();
      bottle.position.set(bucketX, tableTop + 0.4, bucketZ);
      bottle.rotation.z = 0.28;
      roofGroup.add(bottle);
      round(bottle, 0, 1.5, 0, 0.42, 2.6, bottleGreen);
      mesh(new Three.CylinderGeometry(0.18, 0.42, 0.7, 12), bottleGreen, bottle, 0, 3.15, 0);
      round(bottle, 0, 3.8, 0, 0.19, 0.7, gold);
      box(bottle, 0, 2.1, 0.42, 0.5, 0.7, 0.05, cushion);
      box(roofGroup, bucketX + 0.2, tableTop + 1.3, bucketZ + 0.95, 1.1, 1.4, 0.12, linen);
      // A RESERVED card by the host's place.
      for (const tilt of [-0.4, 0.4]) {
        const card = box(roofGroup, tx + 6.1, tableTop + 0.35, tz + 2.4 + tilt * 0.35, 1.2, 0.8, 0.05, china);
        card.rotation.x = tilt;
      }
      // Velvet chairs with gilt frames: north, south, west and one turned in at the south-east.
      function vipChair(x, z, a) {
        const g = new Three.Group();
        g.position.set(x, 2.8, z);
        g.rotation.y = -a;
        roofGroup.add(g);
        for (const lx of [-1.5, 1.5]) for (const lz of [-1.6, 1.6]) box(g, lx, 1.6, lz, 0.3, 3.2, 0.3, brass);
        box(g, 0, 3.3, 0, 3.8, 0.3, 4, brass);
        box(g, 0.1, 3.9, 0, 3.6, 0.9, 3.8, navy);
        const back = new Three.Group();
        back.position.set(-1.75, 3.6, 0);
        back.rotation.z = 0.12;
        g.add(back);
        box(back, 0, 2.6, 0, 0.5, 4.8, 3.8, navy);
        box(back, 0, 5.1, 0, 0.6, 0.35, 4, brass);
        for (const lz of [-1.95, 1.95]) box(back, 0, 2.5, lz, 0.4, 5, 0.3, brass);
      }
      vipChair(tx, tz - 9.6, Math.PI / 2);
      vipChair(tx, tz + 9.6, -Math.PI / 2);
      vipChair(tx - 9.6, tz, 0);
      vipChair(tx + 6.3, tz + 7.4, Math.atan2(-7.4, -6.3));
      // The reserved glass: live (it leaves the table in Vescari's hand), on a gold
      // coaster; the RESERVED label shows while it is the job's target (no ring on the cloth).
      const reservedGlass = new Three.Group();
      reservedGlass.userData.dynamic = true;
      roofGroup.add(reservedGlass);
      reservedGlass.position.set(ROOF_HIT.drink.x - ROOFTOP.x, tableTop, ROOF_HIT.drink.y - ROOFTOP.y);
      round(reservedGlass, 0, 0.06, 0, 1.1, 0.12, gold);
      round(reservedGlass, 0, 0.2, 0, 0.8, 0.16, crystal);
      round(reservedGlass, 0, 1, 0, 0.14, 1.5, crystal);
      mesh(new Three.CylinderGeometry(1.1, 0.78, 1.8, 20, 1, true), crystal, reservedGlass, 0, 2.6, 0);
      mesh(new Three.CylinderGeometry(0.98, 0.8, 0.8, 20), wine, reservedGlass, 0, 2.1, 0);
      const drinkLabel = sign('RESERVED', ROOF_HIT.drink.x, ROOF_HIT.drink.y - 12, 44, '#f2d491');
      drinkLabel.position.y = ROOFTOP.height + 25;
      drinkLabel.userData.backing.position.y = ROOFTOP.height + 25;
      function updateBlueHourTable(hit) {
        // Vescari picks it up mid-toast (roofmission-poison.js glassTaken).
        reservedGlass.visible = !hit?.glassTaken;
        // Down once the glass is spiked: the toast plays out in the open.
        const target = !!hit && player.roof && !hit.poisonUsed && !hit.killRegistered;
        drinkLabel.visible = drinkLabel.userData.backing.visible = target;
      }
