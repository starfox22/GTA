    // DeadEndCity console methods for North Point Key: skyline() report and skylineVisit(spot) (registered by game-console-world.js).
    /* skyline(): the towers (standing and in reserve), the islet, its bridge and
       street, the lifts and roof decks, the helicopter on the pad, CIRRUS's
       people and who is talking, the offices on the old cluster blocks, and where
       the player is. skylineVisit(spot): stand at a named spot (on a roof, on
       its carrier, as the lift would leave you). */
    function skylineReport() {
      const K = NORTH_POINT_KEY,
        round = (v) => Math.round(v),
        pt = (p) => (p ? { x: round(p.x), y: round(p.y) } : null),
        bridge = BRIDGES.find((b) => b.id === 'north-point-key'),
        s = bridge && bridgeStructure(bridge),
        street = cityStreets().find((r) => !r.vertical && r.r === K.row && r.end > 3712),
        pad = SKY_LIFTS.find((l) => l.id === 'helipad'),
        heli = pad && vehicles.find((c) => c.type === 'helicopter' && c.hp > 0 && c.roofSite === pad.b),
        barLift = SKY_LIFTS.find((l) => l.id === 'bar'),
        offices = [];
      for (let bx = 3; bx <= 5; bx++)
        for (let by = -8; by <= -4; by++) {
          const n = retiredSkylineTowers(bx, by).length;
          if (!n) continue;
          const x = blockX(bx) + 89,
            y = blockY(by) + 89,
            here = buildings.filter((b) => b.x >= x && b.x < x + 334 && b.y >= y && b.y < y + 334);
          offices.push({ bx, by, retired: n, built: here.length, maxHeight: round(worldMeters(Math.max(0, ...here.map((b) => b.height)))) });
        }
      return {
        towers: activeSkylineTowers().map((t) => {
          const b = buildings.find((o) => o.skyline === t);
          return { id: t.id, name: t.name, roof: t.roof || null, lot: b ? [round(b.x), round(b.y), round(b.w), round(b.h)] : null, height: b ? round(worldMeters(b.height)) : null, helipad: !!b?.helipad, deck: b?.roofDeck ? b.roofDeck.length : 0 };
        }),
        reserve: SKYLINE_TOWERS.filter((t) => t.reserve).map((t) => t.id),
        islet: {
          land: LAND_REGIONS.includes(K) && landAt(4100, -3600),
          district: districtAt(4100, -3600),
          bounds: [K.tile.x, K.tile.y, K.tile.w, K.tile.h],
          street: street ? [round(street.start), round(street.end)] : null,
          bridge: s ? { id: bridge.id, style: bridge.style, water: s.water.map(round), channels: s.channels.length, footings: s.footings.length } : null,
          palms: trees.filter((t) => t.islet).length,
          solids: NORTH_POINT_KEY_SOLIDS.length,
        },
        lifts: SKY_LIFTS.map((l) => ({ id: l.id, tower: l.tower.name, venue: l.venue, lobby: pt(l.lobby), door: pt(l.door), floors: l.floors })),
        helicopter: heli ? { x: round(heli.x), y: round(heli.y), altitude: round(heli.altitude), onPad: Math.hypot(heli.x - pad.b.keyPad.x, heli.y - pad.b.keyPad.y) < 4 } : null,
        bar: barLift
          ? {
              live: skyBar.live,
              people: skyBar.people.filter((p) => p.hp > 0).length,
              seatsOnDeck: skyBar.people.every((p) => roofInside(barLift.b, p.x, p.y, 0)),
              talking: skyBar.talker ? skyBar.talker.kind : null,
              lines: skyBar.people.filter((p) => p.speech && p.speechUntil > gameTime).map((p) => p.speech),
              keepOuts: barLift.b.deckKeepOuts.length,
            }
          : null,
        offices,
        player: {
          x: round(player.x),
          y: round(player.y),
          altitude: round(entityElevation(player)),
          roof: player.buildingRoof?.skyline?.id || (player.buildingRoof ? 'other' : null),
          // Standing on the roof's deck (skyline-lift.js), not past its edge.
          onDeck: player.buildingRoof ? roofInside(player.buildingRoof, player.x, player.y, 0) : null,
          district: districtAt(player.x, player.y),
          lift: skyLift ? { id: skyLift.lift.id, up: skyLift.up, t: +skyLift.t.toFixed(2) } : null,
          mode: gameMode,
        },
      };
    }
    // Named spots on and over the Key; 'helipad', 'bar' and 'bar-counter' stand on a roof.
    function skylineVisit(spot = 'circle') {
      const K = NORTH_POINT_KEY,
        C = K.circle,
        lift = (id) => SKY_LIFTS.find((l) => l.id === id),
        ground = {
          bridge: { x: 3560, y: K.row + 24 },
          gate: { x: 3840, y: K.row + 24 },
          circle: { x: C.x, y: C.y + C.r },
          forecourt: { x: 4100, y: K.forecourt.y0 + 60 },
          beach: { x: 4300, y: -3330 },
          overview: { x: 4100, y: -3560 },
          'lobby-helipad': lift('helipad') && { x: lift('helipad').lobby.x, y: lift('helipad').lobby.y + 6 },
          'lobby-bar': lift('bar') && { x: lift('bar').lobby.x, y: lift('bar').lobby.y + 6 },
        },
        roof = { helipad: lift('helipad'), bar: lift('bar'), 'bar-counter': lift('bar') };
      if (ground[spot]) {
        teleportPlayer(ground[spot].x, ground[spot].y);
        player.a = -Math.PI / 2;
      } else if (roof[spot]) {
        const l = roof[spot],
          c = l.bar?.counter,
          at = spot === 'bar-counter' ? { x: c.x + c.hx + 10, y: c.y + 6 } : l.arrive;
        teleportPlayer(at.x, at.y);
        player.buildingRoof = l.b;
        player.altitude = l.b.height;
        player.a = spot === 'bar-counter' ? Math.PI : Math.PI / 2;
        if (l.id === 'bar') skyBarArrive();
      } else throw Error('skylineVisit: unknown spot ' + spot + ' (' + [...Object.keys(ground), ...Object.keys(roof)].join(', ') + ')');
      return skylineReport().player;
    }
    function skylineConsole() {
      return {
        skyline: () => skylineReport(),
        skylineVisit: (spot) => skylineVisit(spot),
      };
    }
