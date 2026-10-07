    // BEGIN SUBSYSTEM: src/game-console-graphics.js — DeadEndCity console, graphics: graphics tier, stats, render probes, scaleReport, car, police and helicopter lineups
    // Graphics and render probes: quality tier, render scale, frame stats, post views,
    // shadow and draw-call probes, the world-scale audit and the vehicle/tree model lineups.
    addConsoleMethods('graphics', {
      // Tyre smoke, dust and road spray (tyresmoke3d.js): puffs alive, the graphics
      // tier's cap, the pool's capacity, puffs emitted since boot and the peak alive.
      tyreSmoke: () => (city3D ? city3D.tyreSmokeInfo() : null),
      // The effect particles (fx3d-particles.js): live, waiting on a delay, drawn last frame (and of them the
      // game's particles), capacity, peak, emitted, dropped, the tier's share and the draw calls (null without WebGL).
      effectParticles: () => (city3D ? city3D.effectParticles() : null),
      chimneySmoke: (options) => (city3D?.chimneySmoke ? city3D.chimneySmoke(options) : null),
      // The rain and the wet street as drawn (weather3d-chase.js): both boxes of rain, the near box at
      // street level, the splashes, the haze, the wet reflections' street-level terms (null without WebGL).
      rainView: () => (city3D?.rainView ? city3D.rainView() : null),
      wetGlints: (options) => (city3D?.wetGlints ? city3D.wetGlints(options) : null),
      // World-scale audit, everything in metres: each road vehicle's spec
      // (length, width), the built models within `radius` of the player measured
      // from their meshes (length, width, height), the player's model, the crowd
      // rig's stature range and the city's building heights.
      scaleReport(radius = 400) {
        const m = (units) => Math.round(worldMeters(units) * 100) / 100,
          near = vehicles.filter((c) => distanceBetween(c, player) < radius),
          extents = city3D?.modelExtents?.([...near, player]) || [],
          size = (e) => (e ? { l: m(e.l), w: m(e.w), h: m(e.h) } : null),
          rig = city3D?.crowdRigHeight?.() || 0,
          statures = pedestrians
            .filter((p) => p.look && p.role !== 'kid')
            .map((p) => city3D?.personStature?.(p) || 0)
            .filter(Boolean),
          heights = buildings.map((b) => b.height).sort((a, b) => a - b),
          pick = (list, q) => (list.length ? m(list[Math.min(list.length - 1, Math.floor(q * list.length))]) : null);
        return {
          unitsPerMetre: UNITS_PER_METRE,
          specs: Object.fromEntries(Object.entries(VEHICLE_DEFINITIONS).map(([type, s]) => [type, { l: m(s.l), w: m(s.w) }])),
          models: near
            .map((c, i) => ({ id: c.id, type: c.type, look: c.policeLook?.body || c.lawUnit || null, ...size(extents[i]) }))
            .filter((row) => row.l),
          player: size(extents[near.length]),
          crowd: {
            rig: m(rig),
            player: m(city3D?.personStature?.(player) || 0),
            shortest: pick(statures.sort((a, b) => a - b), 0),
            average: statures.length ? m(statures.reduce((s, v) => s + v, 0) / statures.length) : null,
            tallest: pick(statures.sort((a, b) => a - b), 1),
          },
          buildings: { count: heights.length, lowest: pick(heights, 0), median: pick(heights, 0.5), p90: pick(heights, 0.9), tallest: pick(heights, 1) },
        };
      },
      // Inspection only: look at the street from bearing `yaw` (0 = from the south,
      // as the game camera does; 90 = from the east) and `pitch` degrees above the
      // horizon, aimed `lift` units up; no arguments restores the game camera.
      inspectView: (yaw, pitch, lift) => city3D?.inspectView?.(yaw, pitch, lift),
      vegetation: () => city3D?.vegetation?.() ?? null,
      // The see-through hole in tree crowns round the player (foliage-cutaway.js): the plan, the line of sight, the renderer's state.
      foliageCutaway: () => foliageCutawayReport(),
      treeLineup: (x = player.x, y = player.y, spacing, lod, perRow) => city3D?.treeLineup?.(x, y, spacing, lod, perRow) ?? null,
      // Graphics quality: 'auto', 'low', 'medium', 'high' or 'ultra' (saved like the
      // Settings choice); returns what the renderer is now using.
      graphics(tier) {
        if (tier !== undefined) cycleGraphicsSetting(String(tier).toLowerCase());
        return {
          setting: graphicsSetting,
          ...(city3D?.quality?.() || {}),
          // Sun shadows in force ('off', 'low', 'high') and the setting behind them.
          shadows: shadowQuality(),
          shadowSetting,
          // AUTO's frame-rate adaptation (quality.js ADAPTIVE QUALITY).
          adaptive: { averageFrameMs: +adaptive.average.toFixed(1), tierDrops: adaptive.tierDrops, ceiling: adaptive.ceiling, holdSeconds: Math.round(adaptive.hold / 1000) },
        };
      },
      // Police vehicle review (police3d.js): parks every police model and livery in
      // a column from (x, y), `spacing` apart, facing `heading`, with their lights
      // on (`lights`: true parked at a scene, 'pursuit' running hot, false off).
      // Parked, empty and unarmed; returns the ids and looks.
      policeLineup(x = player.x + 60, y = player.y - 160, heading = 0, lights = true, spacing = 40) {
        const LOOKS = [
          ['police', 'charger', 'bw'],
          ['police', 'utility', 'bw'],
          ['police', 'crownvic', 'bw'],
          ['police', 'charger', 'modern'],
          ['police', 'utility', 'modern'],
          ['police', 'crownvic', 'sheriff'],
          ['police', 'charger', 'unmarked'],
          ['suv', 'tahoe', 'unmarked'],
          ['van', 'bearcat', 'swat'],
        ];
        return LOOKS.map(([type, body, livery], i) => {
          const c = makeCar(type, x - Math.sin(heading) * i * spacing, y + Math.cos(heading) * i * spacing, heading, false, type === 'suv' ? '#121417' : undefined);
          Object.assign(c, { policeLook: { body, livery }, showLights: lights });
          return { id: c.id, type, body, livery };
        });
      },
      // Civilian vehicle review (cars3d.js, vehicles3d.js): parks one of each type
      // in `types` (default: every civilian car and motorbike) in a column from
      // (x, y), `spacing` apart, facing `heading`, each in its own colour (or
      // `color` for all). `lamps` true turns their lamps on as if driven
      // (`showLamps`), 'brake' holds the brake lights too. Returns ids and types.
      carLineup(types, x = player.x + 60, y = player.y - 160, heading = 0, spacing = 44, color, lamps = false) {
        const list = Array.isArray(types) && types.length ? types : CIVILIAN_LINEUP;
        let along = 0;
        return list.map((type) => {
          if (!VEHICLE_DEFINITIONS[type]) throw Error('Unknown vehicle type ' + type);
          const spec = VEHICLE_DEFINITIONS[type],
            gap = Math.max(spacing, spec.w + 14),
            c = makeCar(type, x - Math.sin(heading) * along, y + Math.cos(heading) * along, heading, false, color || spec.color);
          along += gap;
          if (lamps) c.showLamps = lamps;
          return { id: c.id, type, name: spec.name };
        });
      },
      // Helicopter review (helicopter3d.js): parks one helicopter of each look
      // ('police', 'news', 'executive', the civil schemes 'civil:classic', 'civil:yellow',
      // 'civil:silver', 'civil:noir', and 'military', or the `looks` given) in a row east
      // from (x, y), `spacing` apart, facing `heading`; `rotors` true spins them up (with
      // the police lights running). Returns the ids and looks.
      helicopterLineup(x = player.x + 120, y = player.y - 200, heading = 0, rotors = false, spacing = 110, looks = null) {
        const list = Array.isArray(looks) ? looks : ['police', 'news', 'executive', 'civil:classic', 'civil:yellow', 'civil:silver', 'civil:noir', 'military'];
        return list.map((heliLook, i) => {
          const c = makeCar('helicopter', x + i * spacing, y, heading, false);
          Object.assign(c, { heliLook, showRotor: !!rotors, showLights: rotors ? 'pursuit' : false });
          return { id: c.id, look: heliLook };
        });
      },
      // Every helicopter model built: look, rotor spool, draw calls, shadow casters,
      // triangles, crew shown (helicopter3d.js).
      helicopterModels: () => city3D?.helicopterModels?.() ?? null,
      // Every civilian car and motorbike model built: draw calls, shadow casters,
      // triangles and the heaviest parts (cars3d.js, motorbikes3d.js).
      carModels: () => city3D?.carModels?.() ?? null,
      // Dynamic resolution by hand (0.5..1 of the canvas; tests of the scaled scene
      // pass). On AUTO the adaptive controller may change it again.
      renderScale(scale) {
        return city3D?.setRenderScale?.(Number(scale) || 1) ?? null;
      },
      // Feed AUTO's dynamic-resolution controller (quality.js ADAPTIVE QUALITY) a synthetic run of frames, for tests:
      // `plan` is [[seconds, frameMs, cpuMs], ...] on a clock of its own; returns the render scale after the run
      // and every change as [seconds, scale] (each is a reallocation of the post targets). Needs the 3D
      // renderer and the AUTO setting; it moves the real adaptive state (use graphics('auto') to reset it).
      adaptiveSim(plan = []) {
        if (!city3D?.setRenderScale || graphicsSetting !== 'auto') return null;
        const changes = [];
        let t = 1e6,
          last = adaptive.scale;
        for (const [seconds, frameMs, cpuMs] of plan)
          for (let n = Math.round((seconds * 1000) / frameMs); n-- > 0; ) {
            t += frameMs;
            adaptGraphics(frameMs, cpuMs ?? frameMs * 0.3, t);
            if (adaptive.scale !== last) changes.push([+((t - 1e6) / 1000).toFixed(1), (last = adaptive.scale)]);
          }
        return { scale: adaptive.scale, tier: graphicsTierId(), tierDrops: adaptive.tierDrops, ceiling: adaptive.ceiling, changes };
      },
      // Show the ambient-occlusion or bloom buffer instead of the image ('ao',
      // 'bloom'; nothing for the image) to tune the post-processing.
      postView: (mode) => city3D?.postView?.(mode) ?? null,
      groundDetail: () => city3D?.groundReport?.() ?? null,
      // The helicopter searchlight's state, screen points and shaft / pool switches.
      searchlight: (options) => city3D?.searchlight?.(options) ?? null,
      // Vehicle lights: the cars lighting the world as real lights, drive-map beams, tails, reversing, haze.
      headlights: () => city3D?.headlights?.() ?? null,
      // The player's lamps on a slope: pose, aim, and beam coordinates and the terrain horizon at points ahead (terrain-headlights.js).
      headlightAim: (metres) => headlightAimReport(metres),
      // The light a level road takes from low beams through the VEHICLE LIGHT BUDGET (headlight-beam.js; no
      // renderer needed): `lamps` [[x, y, heading], ...] lamp points, `points` [[x, y], ...].
      headlightBudget(lamps = [], points = []) {
        const list = lamps.map(([x, y, a]) => ({ x: Number(x), y: Number(y), a: Number(a) })),
          round = (v) => Math.round(v * 1000) / 1000;
        return {
          cap: CAR_LAMP_ROAD_CAP,
          reachM: CAR_LAMP_REACH,
          points: points.map(([x, y]) => {
            const r = headlightRoadLight(list, Number(x), Number(y));
            return { x, y, total: round(r.total), brightest: round(Math.max(0, ...r.beams)), sum: round(r.sum), beams: r.beams.map(round) };
          }),
        };
      },
      // A/B switches for the look: { pixelLock, fxaa, vibrance, carLamps, groundSlopeCap, terrainBeams, lightBar,
      // foliageCoverage, vehicleLights, stagedSwitch, vehicleMerge, roofSkin, groundWear, chaseBudget, wetGlints, wetReflections } (true = as in play).
      lookSwitches: (options) => city3D?.lookSwitches?.(options) ?? null,
      // Scene draw calls in view by object name and by map cell (render3d.js).
      drawProfile: (top) => city3D?.drawProfile?.(top) ?? null,
      // Civilian car models drawn merged while pristine (vehicle-merge3d.js): merged, split, kits, draw calls saved now.
      vehicleMerges: () => city3D?.vehicleMerges?.() ?? null,
      // Every merged mesh against the hidden parts it replaces, vertex by vertex in world space: maxError ~0 (rendered pages).
      vehicleMergeAudit: () => city3D?.vehicleMergeAudit?.() ?? null,
      // What casts the sun's shadow onto the ground point (x, y).
      shadowProbe: (x, y) => city3D?.shadowProbe?.(Number(x), Number(y)) ?? null,
      // Shadow casters near the view that the camera pass does not show.
      // With `everywhere`, every see-through caster in the scene.
      shadowCasters: (limit, everywhere) => city3D?.shadowCasters?.(limit, !!everywhere) ?? null,
      // Shader programs, textures and geometries created in play (first uses) and the slowest
      // frames' renderer CPU split; `reset` starts a fresh log.
      renderHiccups: (reset) => city3D?.hiccups?.(!!reset) ?? null,
      // The boot timeline: ms since navigation start of each start-up stage (User Timing marks set by
      // bootMark()), the step before it, and the page's load timings (read-only; docs/areas/boot-and-memory.md).
      bootTimings() {
        const nav = performance.getEntriesByType?.('navigation')?.[0],
          marks = performance.getEntriesByType('mark').filter((m) => m.name.startsWith('dec:'));
        let last = nav ? nav.responseEnd : 0;
        return {
          page: nav
            ? { responseEnd: Math.round(nav.responseEnd), domInteractive: Math.round(nav.domInteractive), domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) }
            : null,
          marks: marks.map((m) => {
            const row = [m.name.slice(4), Math.round(m.startTime), Math.round(m.startTime - last)];
            last = m.startTime;
            return row;
          }),
        };
      },
      // Average CPU milliseconds per frame since the last call, plus renderer counters.
      stats() {
        const n = Math.max(1, profile.frames),
          info = city3D?.info?.() || null,
          out = {
            frames: profile.frames,
            updateMs: +(profile.update / n).toFixed(2),
            drawMs: +(profile.draw / n).toFixed(2),
            frameMs: +(profile.frameGap / n).toFixed(1),
            drawCalls: info?.calls ?? null,
            triangles: info?.triangles ?? null,
            // Whether the shadow map was redrawn (its calls included) in that frame,
            // and calls including the post-processing passes.
            shadowFrame: info?.shadowFrame ?? null,
            // Camera-only calls, and the shadow map's calls on its last refresh.
            viewCalls: info?.viewCalls ?? null,
            shadowCalls: info?.shadowCalls ?? null,
            frameCalls: info?.frameCalls ?? null,
            renderScale: city3D?.quality?.().renderScale ?? null,
            sceneObjects: info?.objects ?? null,
            programs: info?.programs ?? null,
            byType: info?.byType ?? null,
            vehicles: vehicles.length,
            pedestrians: pedestrians.length,
            parts: Object.fromEntries(
              Object.entries(profile.parts)
                .map(([k, v]) => [k, +(v / n).toFixed(2)])
                .sort((a, b) => b[1] - a[1]),
            ),
          };
        profile.frames = profile.update = profile.draw = profile.frameGap = 0;
        profile.parts = {};
        return out;
      },
    });
    // END SUBSYSTEM: src/game-console-graphics.js
