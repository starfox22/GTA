    // Cloud console (registered by game-console-world.js as 'clouds'): cloudLayer() report, cloudSpot() and
    // cloudJump(), a freefall from a given altitude into (or beside) a cloud, for tests and screenshots.
    /* A spot near (x, y) where the layer is thickest ('cloud'), clear ('gap') or clear
       with cloud just north of it, where the camera looks ('edge'), `lead` seconds from
       now (the field drifts with the wind while the jumper falls). */
    function cloudSpot(kind = 'cloud', x = player.x, y = player.y, lead = 0, onLand = false) {
      setCloudLayer();
      const windSpeed = 30 + weather.wind * 70,
        ahead = windSpeed * lead,
        dx = Math.cos(weather.windAngle) * ahead,
        dy = Math.sin(weather.windAngle) * ahead,
        gap = kind === 'gap',
        edge = kind === 'edge';
      let best = null,
        bestScore = -Infinity;
      for (let ring = 0; ring <= 12; ring++)
        for (let k = 0, n = Math.max(1, ring * 8); k < n; k++) {
          const a = (k / n) * TAU,
            px = x + Math.cos(a) * ring * 240,
            py = y + Math.sin(a) * ring * 240;
          if (px < WORLD_LEFT || py < WORLD_TOP || px > WORLD_SIZE || py > WORLD_SIZE) continue;
          // (A jump starts from a helicopter spawned there: dry, open ground.)
          if (onLand && (!landAt(px, py) || solid(px, py, 40))) continue;
          // Where this point's cloud will be after `lead` seconds.
          const slab = cloudLayerAt(px, py),
            cover = smoothStep(1 - slab.cover, 1 - slab.cover + 0.28, cloudMapAt(px + cloudLayer.windX + dx, py + cloudLayer.windY + dy)),
            // Near the centre of a cell (its neighbours covered too) for a real cloud.
            around = [0, 1, 2, 3].reduce((s, q) => {
              const qx = px + Math.cos(q * 1.571) * 160,
                qy = py + Math.sin(q * 1.571) * 160;
              return s + smoothStep(1 - slab.cover, 1 - slab.cover + 0.28, cloudMapAt(qx + cloudLayer.windX + dx, qy + cloudLayer.windY + dy));
            }, 0) / 4,
            north = edge ? smoothStep(1 - slab.cover, 1 - slab.cover + 0.28, cloudMapAt(px + cloudLayer.windX + dx, py - 520 + cloudLayer.windY + dy)) : 0,
            score = (edge ? north * 2 - cover * 2 : gap ? -(cover + around) : cover + around) - ring * 0.01;
          if (score > bestScore) {
            bestScore = score;
            best = { x: Math.round(px), y: Math.round(py), cover: +cover.toFixed(2), around: +around.toFixed(2) };
          }
        }
      return best;
    }
    function cloudsConsole() {
      return {
        // The cloud layer over (x, y) (default: the player) in metres: base, top, cover, the area
        // weights (sea, mountain, city) and ground, how deep in cloud `altitudeM` is, the player's
        // immersion; with WebGL, the renderer's view of it (camera in cloud, veil, wisps).
        cloudLayer(x, y, altitudeM) {
          const report = cloudLayerReport(x ?? player.x, y ?? player.y, altitudeM ?? null);
          report.view = city3D?.cloudView?.() ?? null;
          return report;
        },
        // GPU time of the clouds from below (the chase view, HIGH or ULTRA) against the old even march.
        skyCloudBench: (rounds) => city3D?.skyCloudBench?.(rounds) ?? null,
        // A spot within ~3 km where the layer is thickest ('cloud') or clear ('gap') `lead` seconds on.
        cloudSpot: (kind, lead) => cloudSpot(kind, player.x, player.y, lead || 0),
        // Freefall from `metres` above the ground (default 700) over a thick cloud ('cloud') or a
        // gap ('gap'), aimed where the drifting cloud will be when the jumper reaches it.
        cloudJump(metres = 700, kind = 'cloud') {
          const fallSeconds = Math.max(0, metres - worldMeters(cloudBaseAt(player.x, player.y))) / worldMeters(PARACHUTE_TERMINAL) + 2,
            spot = cloudSpot(kind, player.x, player.y, fallSeconds, true);
          if (!spot) return null;
          const state = consoleBailOut(metres, spot.x, spot.y, player.a);
          return { spot, parachute: state, layer: cloudLayerReport(spot.x, spot.y) };
        },
      };
    }
