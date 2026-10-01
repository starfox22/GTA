    // Console for the vehicle-awareness test (crowd-awareness.js): stage pedestrians in the player's car's path and run the passes.
    function awarenessConsole() {
      return {
        // Tests: run `samples` passes of the player's car (kept at `kmh`, heading east, from where it stands) at one
        // pedestrian each, standing `gap` units beyond its nose and `lateral` units off its centre line (spread
        // +-6 across the path), facing `facing` ('toward' the car, 'away', 'side'), with `attention` ('', 'phone',
        // 'text', 'chat', 'buds'), the horn held if `horn`, the dice seeded by `seed` (repeatable). Returns what they did: how many noticed it (by eye
        // or ear), `outcomes` (dodge, sidestep, back, freeze, late, passed, unaware, none), how many were hit
        // (`silent`: hit unaware, so no cry) and how many tried a dodge (dodge, sidestep or back) and got clear. Needs the player in a car.
        carAwarenessTrials(o = {}) {
          const c = player.car;
          if (!c) return null;
          const spec = vehicleSpec(c),
            kmh = o.kmh ?? 40,
            speed = kmh * KMH,
            gap = o.gap ?? 220,
            samples = o.samples ?? 10,
            home = { x: c.x, y: c.y },
            out = { kmh, gap, facing: o.facing || 'toward', attention: o.attention || '', horn: !!o.horn, samples, noticed: 0, byEyes: 0, byEars: 0, hit: 0, silent: 0, tried: 0, cleared: 0, outcomes: {} };
          for (let i = 0; i < samples; i++) {
            // Each pass is its own draw of the dice, so a case repeats exactly and one change does not move the others.
            if (o.seed !== undefined) randomSeed = (Math.imul(o.seed + 17, 2654435761) + i * 7919) >>> 0;
            c.x = home.x;
            c.y = home.y;
            c.a = 0;
            c.vx = speed;
            c.vy = 0;
            c.speed = speed;
            c.hornUntil = o.horn ? gameTime + 99 : 0;
            const facing = out.facing === 'toward' ? Math.PI : out.facing === 'away' ? 0 : i % 2 ? Math.PI / 2 : -Math.PI / 2,
              p = {
                x: c.x + spec.l / 2 + gap,
                y: c.y + (o.lateral ?? 0) + ((i % 5) - 2) * 3,
                a: facing,
                dir: facing,
                hp: 30,
                flee: 0,
                timer: 999,
                walk: 0,
                state: 'idle',
                stateTime: 900,
              };
            dressPerson(p, o.role || 'casual');
            const att = o.attention;
            if (att === 'phone') {
              p.state = 'phone';
              p.pose = 'phone';
            } else if (att === 'text') p.texting = true;
            else if (att === 'chat') p.state = 'chat';
            if (att === 'buds') p.carSense = { eyes: 1, ears: 0.15, react: 0.46, buds: true };
            pedestrians.push(p);
            const end = (gap + spec.l) / speed + 0.8;
            for (let t = 0; t < end; t += 1 / 30) {
              c.vx = speed;
              c.vy = 0;
              c.speed = speed;
              c.a = 0;
              update(1 / 30);
              hudClockOffset += 1 / 30;
              if (c.x > p.x + 30) break;
            }
            const w = p.carWatch,
              hit = !!p.carHit;
            if (w?.noticed >= 0) {
              out.noticed++;
              if (w.by === 'ears') out.byEars++;
              else out.byEyes++;
            }
            const outcome = w?.outcome || (w?.noticed >= 0 ? 'pending' : 'none');
            out.outcomes[outcome] = (out.outcomes[outcome] || 0) + 1;
            if (hit) out.hit++;
            if (hit && p.mutedUntil > 0) out.silent++;
            if (['dodge', 'sidestep', 'back'].includes(outcome)) {
              out.tried++;
              if (!hit) out.cleared++;
            }
            if (o.detail) (out.detail ||= []).push({ outcome, hit, by: w?.by || null, dx: Math.round(p.x - c.x), dy: Math.round(p.y - c.y), hp: Math.round(p.hp), react: p.react?.kind || null, tti: w?.tti ?? null });
            if (wantedStars > 0) clearPolice(true);
            const index = pedestrians.indexOf(p);
            if (index >= 0) pedestrians.splice(index, 1);
          }
          c.hornUntil = 0;
          c.x = home.x;
          c.y = home.y;
          c.vx = c.vy = c.speed = 0;
          return out;
        },
        // The awareness the nearest living pedestrian to a map point keeps for a car (aware / need, who noticed it and how, what they did).
        carWatch(x = player.x, y = player.y) {
          let best = null,
            bestD = 1e9;
          for (const p of pedestrians) {
            const d = Math.hypot(p.x - x, p.y - y);
            if (p.hp > 0 && d < bestD) {
              best = p;
              bestD = d;
            }
          }
          return best ? { d: Math.round(bestD), react: best.react?.kind || null, ...carWatchReport(best) } : null;
        },
      };
    }
