      // Street frontage on every side of a building: which sides face a street, an alley or a yard, and their ground floors (shops, lobbies, stoops, loading bays, service doors, fire escapes).
      /**
       * STREET FRONTAGE
       * The street view looks north, so the city was first dressed on its south faces
       * only; the chase view stands in the street and sees every side. Each side of a
       * building is classed (frontageKind):
       *  - 'street': a street within reach of its middle. The probe is the crowd's
       *    (crowd-space.js buildingEntrances: 60 units out from the door, 12 margin), so
       *    the door drawn in the middle of a street side is the door people walk into;
       *  - 'alley': another building's wall within FRONT_ALLEY in front of it;
       *  - 'yard': the rest (parking courts, back lots).
       * A street side gets a ground floor by the building's style (frontageStyle: seeded
       * per building from its archetype): a row of shops either side of a stair door
       * (display window on a stall riser, a glazed door, the fascia and a sign from the
       * shop atlas, some shuttered; an awning on a north side, a hanging sign on a side
       * street), an office lobby, a residential stoop or a warehouse's loading bays.
       * Alleys and yards get a plinth, a service door, a downpipe and (east alleys of
       * brick and stucco) a fire escape; side streets get the odd fire escape too. The
       * south side keeps its classic shopfront (cityscape3d-roofs.js shopfront) where it
       * has one.
       *
       * Decoration only: no collision, no overhead cover, no shop panes for the damage
       * code (b.shopPanes is the south shopfront's), no street props. So nothing may hide
       * the player from the street camera (north and down at STREET_PITCH): no awning
       * east, west or south, where a player under it would be covered and only overhead
       * cover is cut away; on a north side nothing stands more than 3 units off the wall,
       * inside the cutaway round a player hidden behind the building (its box plus 3):
       * shallow valance awnings, no canopy, no fire escape. Few shared materials, so a cell's
       * frontage costs a handful of batches (batchStaticGroups merges per material and cell):
       * every plain-painted part in FRONT PAINT (vertex colours), the glass in the shop window
       * material, signs from the shop atlas (neonBoard, neonCutout), and the building's trim,
       * darkMetal and concrete, which every cell already draws.
       * Its own seeded random (frontRandom), reseeded per building and side: never
       * cityRandom, whose stream after the buildings places the roof plant
       * (b.roofKeepOuts) and the bus stops, both read by game rules. The pavement in front
       * of a place's entrance, the payphone, the Blue Hour's forecourt, the betting shop
       * and the garage lots stays clear (frontKeepClear).
       */
      const FRONT_PROBE = 63,
        FRONT_MARGIN = 12,
        FRONT_ALLEY = 34,
        FRONT_GLASS_TOP = SHOP_FLOOR * 0.8,
        FRONT_STONE = staticMat('#cbbfae'),
        /* FRONT PAINT: one material for every plain-painted part of a shopfront (panels, doors, shutters,
           fascias, frames, awnings), its colour a vertex colour, so a cell's shopfronts of every colour are one
           batch, not one per colour. Made like the facades (sharedFacade: vertex colours and `cityLit`, here
           dark), so the far copy keeps it (farMaterialUsable). Colours are sRGB like staticMat's. */
        FRONT_PAINT = sharedFacade('frontPaint', () => new Three.MeshStandardMaterial({ roughness: 0.72, metalness: 0.08 })),
        FRONT_COLORS = {
          panel: '#2b3033',
          steel: '#5b5f63',
          door: '#3f2f28',
          fasciaLight: '#d9c8a8',
          fasciaDark: '#4a4d50',
          chrome: '#b8c0c3',
          stripe: '#efe6d3',
        },
        // The awning canvases (the classic south shopfront draws one with cityPick: keep the list's length).
        FRONT_AWNING_COLORS = ['#b7413a', '#2d6a5e', '#26426d', '#c99a2e', '#6d3f76', '#d86d4a'],
        frontPaintGeometries = new Map(),
        frontFrom = new Three.Vector3(),
        frontTo = new Three.Vector3();
      let frontState = 1,
        frontLastName = '';
      // Each side draws from its own stream: a change on one side never reshuffles another.
      function frontSeed(i, side) {
        frontState = (Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(side + 3, 0x85ebca6b)) >>> 0;
        frontLastName = '';
      }
      function frontRandom() {
        frontState = (frontState + 0x6d2b79f5) >>> 0;
        let t = frontState;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      }
      const frontPick = (list) => list[Math.floor(frontRandom() * list.length)];
      // A business for a shop: one per shopfront, never the same twice running on a side.
      function frontShopName() {
        let name = frontPick(SHOP_NAMES);
        if (name === frontLastName) name = SHOP_NAMES[(SHOP_NAMES.indexOf(name) + 1 + Math.floor(frontRandom() * 7)) % SHOP_NAMES.length];
        return (frontLastName = name);
      }
      // A side's frame in the building group's space: `u` runs along the wall, left to right as
      // seen from the street, `out` away from it; `yaw` turns a plane facing +z to face out.
      function frontageFace(b, side) {
        if (side === 0) return { side, ox: 0, oz: b.h, rx: 1, rz: 0, nx: 0, nz: 1, yaw: 0, length: b.w };
        if (side === 1) return { side, ox: b.w, oz: 0, rx: -1, rz: 0, nx: 0, nz: -1, yaw: Math.PI, length: b.w };
        if (side === 2) return { side, ox: 0, oz: 0, rx: 0, rz: 1, nx: -1, nz: 0, yaw: -Math.PI / 2, length: b.h };
        return { side, ox: b.w, oz: b.h, rx: 0, rz: -1, nx: 1, nz: 0, yaw: Math.PI / 2, length: b.h };
      }
      const faceX = (f, u, out) => f.ox + f.rx * u + f.nx * out,
        faceZ = (f, u, out) => f.oz + f.rz * u + f.nz * out;
      // A box on a side, `width` along the wall and `depth` out from it. The plain finishes have no
      // grain, so a box on an east or west side swaps its sizes instead of turning.
      function faceBox(group, f, u, y, out, width, height, depth, material) {
        const x = faceX(f, u, out),
          z = faceZ(f, u, out);
        return f.rx ? box(group, x, y, z, width, height, depth, material) : box(group, x, y, z, depth, height, width, material);
      }
      // A unit box in FRONT PAINT of one colour (shared by every part of that colour).
      function frontPaintGeometry(color) {
        let geometry = frontPaintGeometries.get(color);
        if (geometry) return geometry;
        geometry = boxGeo.clone();
        const count = geometry.attributes.position.count,
          tint = new Three.Color(color),
          colors = new Float32Array(count * 3);
        for (let k = 0; k < count; k++) {
          colors[k * 3] = tint.r;
          colors[k * 3 + 1] = tint.g;
          colors[k * 3 + 2] = tint.b;
        }
        geometry.setAttribute('color', new Three.BufferAttribute(colors, 3));
        geometry.setAttribute('cityLit', new Three.BufferAttribute(new Float32Array(count * 2), 2));
        frontPaintGeometries.set(color, geometry);
        return geometry;
      }
      // A painted box in the building group's space, and one on a side (as faceBox).
      function paintBox(group, x, y, z, width, height, depth, color) {
        return mesh(frontPaintGeometry(color), FRONT_PAINT, group, x, y, z, width, height, depth);
      }
      function facePaint(group, f, u, y, out, width, height, depth, color) {
        const x = faceX(f, u, out),
          z = faceZ(f, u, out);
        return f.rx ? paintBox(group, x, y, z, width, height, depth, color) : paintBox(group, x, y, z, depth, height, width, color);
      }
      // A display window on a side: a pane of shop interior `cell` (cityscape3d-shopwindows.js).
      function shopPane(group, f, u, y, out, width, height, cell, lit, phase) {
        const geometry = shopPaneGeometry(cell, width / height, frontRandom(), lit, phase, Math.floor(frontRandom() * 3)),
          m = new Three.Mesh(geometry, shopWindowMaterial);
        m.position.set(faceX(f, u, out), y, faceZ(f, u, out));
        m.rotation.y = f.yaw;
        m.scale.set(width, height, 1);
        m.receiveShadow = true;
        group.add(m);
        return m;
      }
      // A plinth (base course) along part of a side.
      function frontPlinth(group, f, from, to, material) {
        if (to - from > 1) faceBox(group, f, (from + to) / 2, 2.5, 0.8, to - from, 5, 2, material);
      }
      // Pavement a building's dressing keeps off (a map point): a place's entrance, the story
      // payphone, the Blue Hour's forecourt, the betting shop and the garage lots.
      function frontKeepClear(x, y) {
        if (Math.abs(x - phone.x) < 20 && Math.abs(y - phone.y) < 20) return true;
        for (let k = 0; k < PLACES.length; k++) {
          const door = PLACES[k].door;
          if (door && Math.abs(x - door.x) < 56 && Math.abs(y - door.y) < 56) return true;
        }
        return blueHourForecourt(x, y, 10) || sportsbookNearShop(x, y, 24) || inGarageLot(x, y, 12);
      }
      // Whether the pavement in front of a span of a side (u0..u1) is free to dress.
      function frontSpanClear(b, f, u0, u1) {
        for (let k = 0; k <= 2; k++) {
          const u = u0 + ((u1 - u0) * k) / 2;
          if (frontKeepClear(b.x + faceX(f, u, 12), b.y + faceZ(f, u, 12))) return false;
        }
        return true;
      }
      // 'street', 'alley' or 'yard' (STREET FRONTAGE).
      function frontageKind(b, f) {
        const L = f.length,
          onStreet = (u) => cityStreetAt(b.x + faceX(f, u, FRONT_PROBE), b.y + faceZ(f, u, FRONT_PROBE), FRONT_MARGIN);
        if (onStreet(L / 2) || (onStreet(L * 0.2) && onStreet(L * 0.8))) return 'street';
        for (const out of [6, 18, FRONT_ALLEY]) {
          const x = b.x + faceX(f, L / 2, out),
            y = b.y + faceZ(f, L / 2, out),
            near = buildingsNear(x, y);
          for (let k = 0; k < near.length; k++) {
            const o = near[k];
            if (o !== b && x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) return 'alley';
          }
        }
        return 'yard';
      }
      // What a building's street sides are, by archetype and seed.
      function frontageStyle(kind, b, classicSouth) {
        if (b.place || b.policeHQ || b.height < SHOP_FLOOR + 12) return 'civic';
        if (kind === 'warehouse') return 'loading';
        if (kind === 'tower' || kind === 'decoTower' || kind === 'hotel') return 'lobby';
        if (classicSouth) return 'shops';
        const r = frontRandom();
        if (kind === 'office') return r < 0.5 ? 'shops' : 'lobby';
        if (kind === 'deco') return r < 0.75 ? 'shops' : 'lobby';
        if (kind === 'stucco') return r < 0.6 ? 'shops' : 'stoop';
        return r < 0.72 ? 'shops' : 'stoop';
      }
      /**
       * Dresses the sides of building `b` (its group's space): every side but a south side
       * that has the classic shopfront, which keeps its plinth. Draws only.
       */
      function dressFrontage(group, b, kind, i, trim, classicSouth) {
        frontSeed(i, 7);
        const style = frontageStyle(kind, b, classicSouth),
          plinth = kind === 'stucco' || kind === 'deco' ? FRONT_STONE : trim,
          podium = kind === 'tower' && b.height > realBuildingHeight(260) ? 11 : 0,
          fascia = kind === 'stucco' || kind === 'deco' ? FRONT_COLORS.fasciaLight : FRONT_COLORS.fasciaDark;
        for (let side = 0; side < 4; side++) {
          const f = frontageFace(b, side);
          frontSeed(i, side);
          if (side === 0 && classicSouth) {
            if (kind !== 'tower') frontPlinth(group, f, -1.5, f.length + 1.5, plinth);
            continue;
          }
          const where = f.length < 30 ? 'yard' : frontageKind(b, f);
          if (where !== 'street' || style === 'civic') {
            frontServiceSide(group, b, f, kind, where, plinth);
            continue;
          }
          if (style === 'shops') frontShopRow(group, b, f, kind, trim, plinth, fascia);
          else if (style === 'lobby') frontLobby(group, b, f, kind, trim, plinth, podium);
          else if (style === 'stoop') frontStoop(group, b, f, trim, plinth);
          else frontLoading(group, b, f);
          // The odd fire escape over a side street (never on a north side: see frontAwning).
          if (kind === 'brick' && !f.rx && b.height > SHOP_FLOOR + 2 * STOREY && frontRandom() < 0.3) frontFireEscape(group, b, f, f.length / 2);
        }
      }
      // ---- Street sides -----------------------------------------------------------------
      // Shop units either side of the stair door in the middle (the crowd's door).
      function frontShopRow(group, b, f, kind, trim, plinth, fascia) {
        const L = f.length,
          mid = L / 2;
        for (const u of [2.5, L - 2.5]) faceBox(group, f, u, SHOP_FLOOR / 2, 0.9, 5, SHOP_FLOOR, 2.2, trim);
        if (frontSpanClear(b, f, mid - 8, mid + 8)) frontStairDoor(group, f, mid, trim, fascia);
        else frontPlinth(group, f, mid - 8, mid + 8, plinth);
        for (const [a, z] of [
          [5, mid - 8],
          [mid + 8, L - 5],
        ]) {
          const room = z - a;
          if (room < 20) {
            frontPlinth(group, f, a, z, plinth);
            continue;
          }
          const n = Math.max(1, Math.round(room / 56)),
            w = room / n;
          for (let k = 0; k < n; k++) {
            const u0 = a + k * w,
              u1 = u0 + w;
            if (k) faceBox(group, f, u0, SHOP_FLOOR / 2, 0.9, 3, SHOP_FLOOR, 2, trim);
            if (frontSpanClear(b, f, u0, u1)) frontShop(group, b, f, k ? u0 + 1.5 : u0, k < n - 1 ? u1 - 1.5 : u1, fascia);
            else frontPlinth(group, f, u0, u1, plinth);
          }
        }
      }
      // The door to the floors above, between the shops: where people go in (crowd-space.js DOORS).
      function frontStairDoor(group, f, u, trim, fascia) {
        facePaint(group, f, u, SHOP_FLOOR / 2, 0.4, 16, SHOP_FLOOR, 1.2, FRONT_COLORS.panel);
        facePaint(group, f, u, DOOR_HEIGHT / 2, 1, 9, DOOR_HEIGHT, 0.6, FRONT_COLORS.door);
        facePaint(group, f, u + 2.9, DOOR_HEIGHT * 0.48, 1.45, 0.6, 2.6, 0.5, FRONT_COLORS.chrome);
        shopPane(group, f, u, (DOOR_HEIGHT + 1 + FRONT_GLASS_TOP) / 2, 1.05, 9, FRONT_GLASS_TOP - DOOR_HEIGHT - 1, SHOP_INTERIOR.lobby, 0.45 + frontRandom() * 0.4, frontRandom() * 9);
        for (const du of [-6.5, 6.5]) faceBox(group, f, u + du, SHOP_FLOOR / 2, 1, 3, SHOP_FLOOR, 2, trim);
        facePaint(group, f, u, SHOP_FLOOR + 0.6, 1.2, 17, 1.4, 2.6, fascia);
      }
      /**
       * One shop, u0..u1 along a side: a display window on a stall riser (or a roller shutter
       * down), a glazed door, the fascia and one sign from the shop atlas; on a north side an
       * awning, on a side street a hanging sign; its light on the pavement after dark.
       */
      function frontShop(group, b, f, u0, u1, fascia) {
        const w = u1 - u0,
          mid = (u0 + u1) / 2,
          name = frontShopName(),
          cell = shopInteriorFor(name),
          shut = frontRandom() < 0.12,
          lit = shut || frontRandom() < 0.18 ? 0 : 0.55 + frontRandom() * 0.45,
          phase = frontRandom() * 9,
          hasDoor = w >= 28,
          doorLeft = frontRandom() < 0.5,
          doorU = doorLeft ? u0 + 6.5 : u1 - 6.5,
          winA = hasDoor && doorLeft ? u0 + 12 : u0 + 1.5,
          winB = hasDoor && !doorLeft ? u1 - 12 : u1 - 1.5,
          winW = winB - winA,
          winU = (winA + winB) / 2,
          glassH = FRONT_GLASS_TOP - 3,
          glassY = 3 + glassH / 2;
        facePaint(group, f, mid, SHOP_FLOOR / 2, 0.4, w, SHOP_FLOOR, 1.2, FRONT_COLORS.panel);
        facePaint(group, f, mid, SHOP_FLOOR + 0.6, 1.2, w + 1, 1.4, 2.6, fascia);
        facePaint(group, f, winU, 1.5, 1.2, winW, 3, 1.2, FRONT_COLORS.steel);
        if (shut) {
          // A roller shutter down over the window, under its barrel housing.
          facePaint(group, f, winU, glassY, 1.25, winW, glassH, 0.3, FRONT_COLORS.steel);
          for (const y of [9, 16, 23]) faceBox(group, f, winU, y, 1.45, winW, 0.35, 0.2, darkMetal);
          facePaint(group, f, winU, FRONT_GLASS_TOP + 1.3, 1.7, winW + 1, 2.6, 2.2, FRONT_COLORS.steel);
        } else {
          shopPane(group, f, winU, glassY, 1.05, winW, glassH, cell, lit, phase);
          if (winW > 34) faceBox(group, f, winU, glassY, 1.25, 0.9, glassH, 0.5, darkMetal);
          faceBox(group, f, winU, FRONT_GLASS_TOP + 0.5, 1.25, winW + 1, 1, 0.6, darkMetal);
        }
        if (hasDoor) {
          // A glazed door in a dark frame, a transom light over it.
          faceBox(group, f, doorU, (DOOR_HEIGHT + 0.6) / 2, 0.9, 9, DOOR_HEIGHT + 0.6, 0.6, darkMetal);
          shopPane(group, f, doorU, DOOR_HEIGHT / 2 + 0.6, 1.25, 6.4, DOOR_HEIGHT - 2, cell, lit, phase);
          shopPane(group, f, doorU, (DOOR_HEIGHT + 1 + FRONT_GLASS_TOP) / 2, 1.05, 9, FRONT_GLASS_TOP - DOOR_HEIGHT - 1, cell, lit, phase);
        }
        // The sign on the wall over the fascia, clear of a fire escape's lowest landing.
        const signW = Math.min(w - 6, 60, (b.height - SHOP_FLOOR - 6) * 4),
          signH = signW / 4,
          signY = SHOP_FLOOR + 1.8 + signH / 2,
          neon = shopSignIsNeon(name);
        if (signW >= 18) {
          atlasSign(group, shopSignCell(name), faceX(f, mid, 1.9), signY, faceZ(f, mid, 1.9), signW, signH, neonBoard, f.yaw);
          faceBox(group, f, mid, signY, 1.2, signW + 2, signH + 2, 0.8, darkMetal);
          // Its colour on the pavement; on a south side also down the wet road (the streaks run
          // south). The streak's phase is given: left out, addStreak would draw it from cityRandom.
          const streak = f.side === 0 ? { width: signW * 0.8, length: 70, strength: neon ? 1.1 : 0.7, mode: 'steady', phase: frontRandom() } : null;
          signSpill(b.x + faceX(f, mid, 14), b.y + faceZ(f, mid, 14), signW * 0.8, shopSignLight(name), neon ? 0.4 : 0.3, streak);
        }
        if (lit) signLightPools.push({ x: b.x + faceX(f, winU, 10), y: b.y + faceZ(f, winU, 10), r: Math.max(22, winW * 0.8), color: [1, 0.84, 0.63], strength: 0.4 * lit });
        if (lit && frontRandom() < 0.3) {
          const size = Math.min(14, winW - 12);
          if (size >= 8) atlasSign(group, windowNeonCell(frontPick(WINDOW_NEONS)), faceX(f, winU, 1.4), 14, faceZ(f, winU, 1.4), size, size / 2, neonCutout, f.yaw);
        }
        if (f.side === 1) {
          if (!shut && frontRandom() < 0.55) frontAwning(group, f, mid, w - 4);
        } else if (!f.rx && b.height > SHOP_FLOOR + 14 && frontRandom() < 0.5) frontBladeSign(group, f, doorLeft ? u1 - 5 : u0 + 5, name);
      }
      // A striped valance awning over a north shopfront, steep and shallow: it stays inside the
      // street camera's cutaway round a hidden player (the building's box plus 3 units).
      function frontAwning(group, f, u, width) {
        const awning = facePaint(group, f, u, FRONT_GLASS_TOP + 1, 1.1, width, 0.6, 4, frontPick(FRONT_AWNING_COLORS));
        awning.rotation.x = -0.55;
        for (const s of [-0.25, 0.25]) {
          const stripe = facePaint(group, f, u + s * width, FRONT_GLASS_TOP + 1, 1.1, width / 8, 0.65, 4, FRONT_COLORS.stripe);
          stripe.rotation.x = -0.55;
        }
      }
      // A sign hung edge-on from the wall over a side street: readable along the street.
      function frontBladeSign(group, f, u, name) {
        const cell = shopSignCell(name),
          width = 15,
          height = width / 4,
          y = SHOP_FLOOR + 7,
          out = 2.2 + width / 2,
          yaw = Math.atan2(f.rx, f.rz);
        faceBox(group, f, u, y, out, 0.5, height + 0.8, width + 0.8, darkMetal);
        faceBox(group, f, u, y + height / 2 + 1.3, out, 0.35, 0.35, width + 2.2, darkMetal);
        for (const s of [1, -1]) atlasSign(group, cell, faceX(f, u + s * 0.3, out), y, faceZ(f, u + s * 0.3, out), width, height, neonBoard, s > 0 ? yaw : yaw + Math.PI);
      }
      // An office or tower lobby: a glazed entrance in a stone surround on a dark base.
      function frontLobby(group, b, f, kind, trim, plinth, podium) {
        const L = f.length,
          u = L / 2,
          out = podium,
          w = Math.min(L - 30, 64),
          glassH = 30;
        if (w < 20 || b.height < SHOP_FLOOR + 8 || !frontSpanClear(b, f, u - w / 2, u + w / 2)) {
          if (kind !== 'tower') frontPlinth(group, f, -1.5, L + 1.5, plinth);
          return;
        }
        if (!podium)
          for (const [a, z] of [
            [0, u - w / 2 - 5],
            [u + w / 2 + 5, L],
          ])
            if (z - a > 2) facePaint(group, f, (a + z) / 2, 4, 0.7, z - a, 8, 1.6, FRONT_COLORS.panel);
        const lit = 0.6 + frontRandom() * 0.4,
          phase = frontRandom() * 9,
          bays = Math.max(2, Math.round(w / 14));
        shopPane(group, f, u, 0.5 + glassH / 2, out + 1.05, w, glassH, SHOP_INTERIOR.lobby, lit, phase);
        for (let k = 1; k < bays; k++) faceBox(group, f, u - w / 2 + (k * w) / bays, 0.5 + glassH / 2, out + 1.3, 0.8, glassH, 0.6, darkMetal);
        facePaint(group, f, u, DOOR_HEIGHT + 0.5, out + 1.35, 18, 0.6, 0.5, FRONT_COLORS.chrome);
        facePaint(group, f, u, DOOR_HEIGHT / 2, out + 1.35, 0.6, DOOR_HEIGHT, 0.5, FRONT_COLORS.chrome);
        for (const du of [-(w / 2 + 2.5), w / 2 + 2.5]) faceBox(group, f, u + du, 17, out + 1.2, 5, 34, 2.4, trim);
        faceBox(group, f, u, 33.5, out + 1.2, w + 10, 3, 2.4, trim);
        signLightPools.push({ x: b.x + faceX(f, u, out + 12), y: b.y + faceZ(f, u, out + 12), r: Math.max(26, w * 0.7), color: [1, 0.86, 0.68], strength: 0.4 * lit });
      }
      // A house door up two steps in a stone surround, on the plinth.
      function frontStoop(group, b, f, trim, plinth) {
        const L = f.length,
          u = L / 2;
        if (!frontSpanClear(b, f, u - 8, u + 8)) {
          frontPlinth(group, f, -1.5, L + 1.5, plinth);
          return;
        }
        frontPlinth(group, f, -1.5, u - 7.5, plinth);
        frontPlinth(group, f, u + 7.5, L + 1.5, plinth);
        facePaint(group, f, u, 5 + DOOR_HEIGHT / 2, 1, 9, DOOR_HEIGHT, 0.6, FRONT_COLORS.door);
        facePaint(group, f, u + 2.9, 5 + DOOR_HEIGHT * 0.48, 1.45, 0.6, 2.6, 0.5, FRONT_COLORS.chrome);
        shopPane(group, f, u, 5 + DOOR_HEIGHT + 3.2, 1.05, 9, 4.4, SHOP_INTERIOR.lobby, 0.3 + frontRandom() * 0.4, frontRandom() * 9);
        for (const du of [-6.3, 6.3]) faceBox(group, f, u + du, 5 + (DOOR_HEIGHT + 7) / 2, 1.2, 3.4, DOOR_HEIGHT + 7, 2.4, trim);
        faceBox(group, f, u, 5 + DOOR_HEIGHT + 8, 1.9, 17, 2, 2.2, trim);
        faceBox(group, f, u, 3.75, 2.1, 15, 2.5, 2.2, concrete);
        faceBox(group, f, u, 1.25, 3, 15, 2.5, 4, concrete);
      }
      // A warehouse's street side: loading bays behind roller shutters and a door in the middle.
      function frontLoading(group, b, f) {
        const L = f.length,
          u = L / 2,
          top = Math.min(29, b.height - 8);
        if (frontSpanClear(b, f, u - 7, u + 7)) frontServiceDoor(group, f, u);
        if (top < 18) return;
        for (const [a, z] of [
          [6, u - 10],
          [u + 10, L - 6],
        ]) {
          const room = z - a;
          if (room < 36) continue;
          const n = Math.max(1, Math.min(2, Math.floor(room / 46))),
            w = Math.min(30, room / n - 10);
          for (let k = 0; k < n; k++) {
            const c = a + (room * (k + 0.5)) / n;
            if (!frontSpanClear(b, f, c - w / 2, c + w / 2)) continue;
            facePaint(group, f, c, top / 2, 0.7, w, top, 0.6, FRONT_COLORS.steel);
            for (let y = 6; y < top - 2; y += 6) faceBox(group, f, c, y, 1.05, w, 0.4, 0.2, darkMetal);
            faceBox(group, f, c, top + 1.5, 1.5, w + 3, 3, 2.6, darkMetal);
            for (const s of [-1, 1]) {
              faceBox(group, f, c + s * (w / 2 + 0.9), top / 2, 0.9, 1.6, top, 1.6, darkMetal);
              faceBox(group, f, c + s * (w / 2 - 3), 2, 1.9, 2.6, 4, 2.6, darkMetal);
            }
          }
        }
      }
      // ---- Alleys, yards and plain sides ----------------------------------------------------
      // A steel service door under a hood.
      function frontServiceDoor(group, f, u) {
        facePaint(group, f, u, DOOR_HEIGHT / 2, 0.45, 9, DOOR_HEIGHT, 0.7, FRONT_COLORS.steel);
        faceBox(group, f, u, DOOR_HEIGHT + 0.6, 0.6, 10.6, 1.2, 1, darkMetal);
        faceBox(group, f, u, DOOR_HEIGHT + 3.4, 1.5, 12, 0.6, 3, darkMetal);
      }
      // The plinth on any side without a street front; on a back (alley or yard) a service
      // door, a downpipe and on an east alley of brick or stucco a fire escape.
      function frontServiceSide(group, b, f, kind, where, plinth) {
        const L = f.length,
          tall = kind === 'tower' || kind === 'decoTower',
          back = where !== 'street',
          door = back && L > 40 && frontRandom() < 0.6 ? L * (0.25 + frontRandom() * 0.5) : -1,
          doorClear = door > 0 && frontSpanClear(b, f, door - 7, door + 7);
        if (!tall) {
          if (doorClear) {
            frontPlinth(group, f, -1.5, door - 6, plinth);
            frontPlinth(group, f, door + 6, L + 1.5, plinth);
          } else frontPlinth(group, f, -1.5, L + 1.5, plinth);
        }
        if (!back) return;
        if (doorClear) frontServiceDoor(group, f, door);
        if (!tall && b.height < realBuildingHeight(80)) faceBox(group, f, frontRandom() < 0.5 ? 4 : L - 4, b.height / 2, 1.1, 1.3, b.height - 2, 1.3, darkMetal);
        if (where === 'alley' && f.side === 3 && (kind === 'brick' || kind === 'stucco') && b.height > SHOP_FLOOR + 2 * STOREY && frontRandom() < 0.55)
          frontFireEscape(group, b, f, L / 2);
      }
      // A fire escape on any side, centred at `u`: a landing and railing a storey apart from the
      // first floor up, a stair between each (as cityscape3d-roofs.js fireEscape on the south).
      function frontFireEscape(group, b, f, u) {
        const floors = Math.floor((b.height - SHOP_FLOOR) / STOREY);
        for (let k = 1; k <= floors; k++) {
          const y = SHOP_FLOOR + (k - 1) * STOREY;
          faceBox(group, f, u, y, 3.2, 24, 0.6, 6, darkMetal);
          for (const du of [-11, 11]) faceBox(group, f, u + du, y + 3, 6, 0.5, 6, 0.5, darkMetal);
          faceBox(group, f, u, y + 6, 6.2, 24, 0.5, 0.5, darkMetal);
          if (k < floors) {
            const s = k % 2 ? 1 : -1;
            frontFrom.set(faceX(f, u - s * 11, 4), y + 0.5, faceZ(f, u - s * 11, 4));
            frontTo.set(faceX(f, u + s * 11, 4), y + STOREY - 0.5, faceZ(f, u + s * 11, 4));
            rod(group, frontFrom, frontTo, 0.4, darkMetal);
          }
        }
      }
