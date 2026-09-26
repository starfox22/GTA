      // BEGIN SUBSYSTEM: src/police3d.js — Police vehicle models
      /**
       * Police vehicle models
       * Source: src/police3d.js
       * Scope: createCityRenderer() closure (included after vehicles3d.js, before makeVehicle).
       *
       * Every police vehicle is built here: patrol cars (`type === 'police'`, the
       * roadblock cruisers included), the SWAT truck (`lawUnit === 'swat'`, a 'van'
       * underneath) and the agents' SUVs (`lawUnit === 'fed'`, a 'suv'). The
       * collision sizes are the vehicle types' own (vehicleSpec); nothing here
       * changes the physics.
       *
       * Bodies (POLICE_BODIES), modern US police vehicles:
       *  - charger: a pursuit sedan after the Dodge Charger Pursuit (long hood,
       *    fastback glass, full-width LED tail lamps, spoiler lip);
       *  - utility: the Police Interceptor Utility (Ford Explorer): tall glass,
       *    upright tailgate, roof rails;
       *  - crownvic: a Crown Victoria style notchback: upright glass, long trunk,
       *    chrome trim, dog-dish hubcaps;
       *  - tahoe: the agents' full-size SUV;
       *  - bearcat: the SWAT unit's armoured truck after a Lenco BearCat: slab
       *    armour, small thick windows, roof hatch with a turret ring and shield
       *    plates, a ram bumper, gun ports and hinged rear doors.
       * Each body has its own lofted shell (POLICE SHELL: bevelled sections along a
       * profile, flared over the wheels, the same deformable contract as the
       * generic car shell: damage3d.js crumples it) and a curved glasshouse
       * (panes in PANE_ORDER, so each pane still cracks and bursts on its own).
       *
       * Liveries (policeLiveryTexture) are one canvas per livery and body, painted
       * in the shell's UV space (u along the car, v round the section; the bottom
       * eighth holds solid swatches that the hood, roof, pillars, door and trunk
       * panels sample): 'bw' (black and white, SOUTH COAST POLICE, gold star),
       * 'modern' (white with a navy and sky-blue swoosh and a reflective line),
       * 'sheriff' (the county's green and white, SHERIFF) and 'swat' (navy). The
       * unit number is painted big on the roof, as real aerial ID numbers are, and
       * small on the trunk and rear fenders, from one glyph atlas (POLICE DECALS).
       * One in nine city patrol units is an unmarked car in a dark colour with
       * dash, grille and rear-deck lights only; agents' SUVs are unmarked too.
       *
       * Draw calls: each model is merged per material (livery paint, trim, bright
       * metal, lights, number decals) on top of the parts the damage model moves
       * (shell, glasshouse, hood, bumpers, four lamps, four wheels): about 22
       * draws, against 26 for the old box-built cruiser. Zoomed out, all police
       * vehicles of one body and livery share instanced body impostors, lightbar
       * beacons included (flight-view3d.js BODY IMPOSTORS).
       *
       * Lights (POLICE LIGHTS): every emitter of a model (lightbar segments,
       * takedowns and alley lights, push-bar and grille LEDs, the rear window bar,
       * dash lights, running lights) is one mesh with a light channel per vertex;
       * a small shader looks its level up in the model's eight channel levels.
       * policeLightLevels() writes those levels from the flash pattern: side to side
       * quad flashes, criss-cross double flashes and a sweep, cycling every few
       * seconds in a pursuit; a slow alternation with steady white takedowns when
       * parked at a scene (a roadblock). Responding cars wig-wag their headlamps.
       * At night the lit segments add halos (VEHICLE HALOS) and red and blue pools
       * on the road (lighting3d.js DRIVE LIGHT MAP). Nothing allocates per frame.
       */
      const POLICE_FONT = '"Arial Narrow", "Liberation Sans Narrow", Arial, "Liberation Sans", Helvetica, sans-serif',
        // Share of the livery canvas (from the bottom) kept for the panel swatches.
        POLICE_SWATCH_BAND = 0.125,
        POLICE_SWATCH = { hood: 0, roof: 1, door: 2, trunk: 3, pillar: 4, base: 5, black: 6, accent: 7 },
        POLICE_RED = '#ff2d22',
        POLICE_BLUE = '#2f62ff',
        POLICE_WHITE = '#fff3e2',
        POLICE_AMBER = '#ffa42a';
      /*
       * Bodies. Lengths along the car are fractions of its length l (x forward),
       * widths fractions of the body width w (0.87 of the collider's, as every car),
       * heights in world units. `section` is half the cross-section from the
       * underside to the roof line centre as [height fraction, width fraction];
       * `profile` scales it along the car: [t, width factor, top height].
       * `glass` is the glasshouse: base and roof heights, the windscreen foot (xf)
       * and top (rf), the rear glass foot (xb) and top (rb), half widths at the
       * base (wb) and roof (wt), outward bow of the side glass, forward bulge of
       * the windscreen foot, roof arch and the side pillars ([s, width, 'paint' or
       * 'black'], s = 0 at the rear glass, 1 at the windscreen).
       */
      const POLICE_DRAW_SCALE = 0.8;
      const POLICE_BODIES = {
        charger: {
          name: 'charger',
          kind: 'sedan',
          yb: 3.4,
          h: 9.1,
          section: [[0, 0.8], [0.14, 0.95], [0.34, 1], [0.64, 1], [0.8, 0.98], [0.9, 0.93], [0.96, 0.8], [0.99, 0.56], [1, 0.28], [1, 0]],
          profile: [
            [-0.5, 0.7, 7.5], [-0.49, 0.83, 8.3], [-0.47, 0.915, 8.85], [-0.44, 0.96, 9.08], [-0.39, 0.99, 9.16], [-0.3, 1.028, 9.16],
            [-0.23, 1, 9.12], [0.19, 1, 9.1], [0.26, 1.028, 9.06], [0.34, 1.015, 9.0], [0.4, 0.985, 8.88], [0.45, 0.94, 8.6],
            [0.475, 0.885, 8.2], [0.49, 0.815, 7.8], [0.5, 0.69, 7.1],
          ],
          glass: { base: 8.45, roof: 14.1, xf: 0.25, xb: -0.36, rf: 0.04, rb: -0.2, wb: 0.415, wt: 0.315, bow: 0.018, bulge: 0.9, arch: 0.55, pillars: [[0.47, 1.1, 'black'], [0, 2.6, 'paint']] },
          wheel: { r: 4.3, width: 2.7, x: 0.3, z: 0.46 },
          hoodTilt: -0.028,
          head: [0.48, 7.85, 0.33, 1.1, 0.95, 0.24],
          tail: [-0.492, 8.15, 0.215, 0.5, 0.75, 0.43],
          bumpers: [[0.488, 4.95, 1.2, 2.1, 0.84], [-0.494, 5.25, 1.0, 2.0, 0.86]],
          spoiler: -0.468,
          trunk: -0.43,
        },
        crownvic: {
          name: 'crownvic',
          kind: 'sedan',
          yb: 3.5,
          h: 9.3,
          section: [[0, 0.84], [0.12, 0.97], [0.3, 1], [0.74, 1], [0.87, 0.975], [0.94, 0.91], [0.98, 0.76], [1, 0.5], [1, 0.25], [1, 0]],
          profile: [
            [-0.5, 0.8, 8.5], [-0.49, 0.9, 9.05], [-0.47, 0.96, 9.28], [-0.42, 0.99, 9.32], [-0.3, 1.022, 9.34], [-0.22, 1, 9.3], [0.2, 1, 9.3],
            [0.3, 1.022, 9.26], [0.42, 0.985, 9.08], [0.47, 0.94, 8.8], [0.49, 0.88, 8.45], [0.5, 0.8, 8.0],
          ],
          glass: { base: 8.75, roof: 14.6, xf: 0.24, xb: -0.265, rf: 0.085, rb: -0.17, wb: 0.415, wt: 0.335, bow: 0.012, bulge: 0.6, arch: 0.42, pillars: [[0.5, 1.2, 'black'], [0, 1.9, 'paint']] },
          wheel: { r: 4.3, width: 2.7, x: 0.3, z: 0.46 },
          hoodTilt: -0.012,
          head: [0.488, 7.75, 0.325, 0.7, 1.45, 0.22],
          tail: [-0.494, 8.25, 0.33, 0.5, 1.55, 0.2],
          bumpers: [[0.49, 5.0, 1.2, 2.2, 0.86], [-0.494, 5.2, 1.1, 2.1, 0.88]],
          chrome: true,
          trunk: -0.4,
        },
        utility: {
          name: 'utility',
          kind: 'suv',
          yb: 3.8,
          h: 10.3,
          section: [[0, 0.82], [0.12, 0.95], [0.3, 1], [0.72, 1], [0.86, 0.975], [0.94, 0.92], [0.98, 0.8], [1, 0.55], [1, 0.25], [1, 0]],
          profile: [
            [-0.5, 0.82, 9.7], [-0.49, 0.92, 10.15], [-0.47, 0.97, 10.32], [-0.4, 0.995, 10.36], [-0.3, 1.03, 10.36], [-0.2, 1, 10.3],
            [0.2, 1, 10.3], [0.3, 1.03, 10.24], [0.38, 1.005, 10.1], [0.44, 0.97, 9.7], [0.475, 0.915, 9.2], [0.49, 0.86, 8.85], [0.5, 0.76, 8.4],
          ],
          glass: { base: 9.75, roof: 17.9, xf: 0.26, xb: -0.478, rf: 0.065, rb: -0.445, wb: 0.425, wt: 0.345, bow: 0.014, bulge: 0.8, arch: 0.42, pillars: [[0.53, 1.1, 'black'], [0.2, 1.3, 'black'], [0, 2.2, 'paint']] },
          wheel: { r: 4.6, width: 2.9, x: 0.3, z: 0.455 },
          hoodTilt: -0.05,
          head: [0.474, 9.0, 0.33, 1.1, 1.0, 0.23],
          tail: [-0.494, 9.55, 0.36, 0.5, 1.15, 0.2],
          bumpers: [[0.487, 5.3, 1.3, 2.4, 0.86], [-0.494, 5.5, 1.1, 2.4, 0.88]],
          rails: true,
        },
        tahoe: {
          name: 'tahoe',
          kind: 'suv',
          yb: 4.2,
          h: 11.1,
          section: [[0, 0.86], [0.1, 0.97], [0.28, 1], [0.78, 1], [0.9, 0.975], [0.95, 0.93], [0.985, 0.82], [1, 0.58], [1, 0.26], [1, 0]],
          profile: [
            [-0.5, 0.86, 10.6], [-0.49, 0.94, 11.0], [-0.47, 0.98, 11.12], [-0.3, 1.025, 11.15], [-0.2, 1, 11.1], [0.2, 1, 11.1],
            [0.3, 1.025, 11.05], [0.42, 0.995, 10.9], [0.47, 0.95, 10.4], [0.49, 0.9, 10.0], [0.5, 0.82, 9.6],
          ],
          glass: { base: 10.55, roof: 19.2, xf: 0.255, xb: -0.482, rf: 0.07, rb: -0.458, wb: 0.44, wt: 0.38, bow: 0.012, bulge: 0.55, arch: 0.35, pillars: [[0.55, 1.2, 'black'], [0.22, 1.3, 'black'], [0, 2.4, 'paint']] },
          wheel: { r: 4.9, width: 3.0, x: 0.31, z: 0.45 },
          hoodTilt: -0.02,
          head: [0.488, 9.5, 0.33, 0.8, 1.4, 0.24],
          tail: [-0.494, 10.3, 0.4, 0.5, 2.6, 0.12],
          bumpers: [[0.49, 5.8, 1.3, 2.6, 0.9], [-0.494, 5.9, 1.2, 2.4, 0.9]],
          rails: true,
        },
        bearcat: {
          name: 'bearcat',
          kind: 'bearcat',
          yb: 4.4,
          h: 12.4,
          uvTop: 23,
          section: [[0, 0.88], [0.05, 0.97], [0.12, 1], [0.9, 1], [0.955, 0.95], [0.985, 0.85], [1, 0.62], [1, 0.3], [1, 0]],
          profile: [
            [-0.5, 0.97, 22.5], [-0.49, 1, 23], [0.12, 1, 23], [0.135, 0.985, 22.6], [0.205, 0.935, 13.1], [0.215, 0.93, 12.7],
            [0.44, 0.93, 12.3], [0.48, 0.905, 11.5], [0.5, 0.87, 10.3],
          ],
          // The armoured windows sit on the slab (policeBearcatGlass); these
          // numbers only place the wipers and the lightbar.
          glass: { base: 14, roof: 21.6, xf: 0.198, xb: -0.1, rf: 0.142, rb: -0.1, wb: 0.42, wt: 0.42, bow: 0, bulge: 0, arch: 0 },
          wheel: { r: 5.4, width: 3.6, x: 0.29, z: 0.44 },
          hoodTilt: -0.018,
          head: [0.494, 9.9, 0.35, 0.6, 1.7, 0.14],
          tail: [-0.521, 5.0, 0.39, 0.4, 1.1, 0.1],
          bumpers: [[0.5, 6.4, 1.6, 2.8, 0.96], [-0.5, 5.0, 1.0, 2.2, 0.96]],
        },
      };
      const POLICE_LIVERIES = {
        bw: {
          // Black and white: black body, white doors and roof, SOUTH COAST POLICE and a gold star.
          base: '#0d0e11',
          swatches: ['#0d0e11', '#f1f2ef', '#f1f2ef', '#0d0e11', '#f1f2ef', '#0d0e11', '#0a0b0d', '#c9a44a'],
          roofDigits: '#0c0d10',
          sideDigits: '#eeeeea',
        },
        modern: {
          // White with a navy and sky-blue swoosh edged with reflective silver, black pillars.
          base: '#eff1f2',
          swatches: ['#eff1f2', '#eff1f2', '#eff1f2', '#eff1f2', '#0d0e11', '#eff1f2', '#0a0b0d', '#13295c'],
          roofDigits: '#12275a',
          sideDigits: '#12275a',
        },
        sheriff: {
          // The county's green and white, a gold stripe and star: SHERIFF.
          base: '#f0f0ec',
          swatches: ['#1d4a33', '#f0f0ec', '#f0f0ec', '#1d4a33', '#f0f0ec', '#f0f0ec', '#0a0b0d', '#c9a44a'],
          roofDigits: '#173d2a',
          sideDigits: '#173d2a',
        },
        swat: {
          // Navy armour with a grey reflective band: POLICE, SWAT.
          base: '#18202c',
          swatches: ['#18202c', '#18202c', '#18202c', '#18202c', '#141a24', '#18202c', '#0a0b0d', '#8d98a6'],
          roofDigits: '#eef0ec',
          sideDigits: '#eef0ec',
        },
      };
      const POLICE_PATROL_BODIES = ['charger', 'charger', 'utility', 'utility', 'crownvic'],
        UNMARKED_PAINTS = ['#2a2f35', '#1e2227', '#3b3f3c', '#41454d', '#252f3c', '#4a2a2c'];
      // ---- Which model ---------------------------------------------------------------
      // Looks are cached per vehicle (never stored on the vehicle object: the
      // physics keeps every vehicle one object layout).
      const policeLooks = new WeakMap();
      function policeLookFor(vehicle) {
        let look = policeLooks.get(vehicle);
        if (look === undefined) {
          look = pickPoliceLook(vehicle);
          policeLooks.set(vehicle, look);
        }
        return look;
      }
      function pickPoliceLook(vehicle) {
        const hash = Math.imul((vehicle.id | 0) + 0x9e37, 0x85ebca6b) >>> 0,
          pick = (list, shift) => list[((hash >>> shift) & 0xffff) % list.length];
        let body, livery;
        // DeadEndCity.policeLineup() names the model and livery outright.
        if (vehicle.policeLook) ({ body, livery } = vehicle.policeLook);
        else if (vehicle.lawUnit === 'swat') [body, livery] = ['bearcat', 'swat'];
        else if (vehicle.lawUnit === 'fed') [body, livery] = ['tahoe', 'unmarked'];
        else if (vehicle.type === 'police') {
          const county = vehicle.x > CITY_SIZE || vehicle.y > CITY_SIZE;
          body = pick(POLICE_PATROL_BODIES, 3);
          livery = county ? 'sheriff' : !vehicle.blockade && ((hash >>> 19) & 0xff) % 9 === 0 ? 'unmarked' : (hash >>> 11) & 1 ? 'bw' : 'modern';
          if (livery === 'unmarked' && body === 'utility') body = 'charger';
        } else return null;
        if (!POLICE_BODIES[body]) body = 'charger';
        const unmarked = livery === 'unmarked' || !POLICE_LIVERIES[livery];
        return {
          body,
          livery: unmarked ? 'unmarked' : livery,
          unmarked,
          equipment: livery === 'swat' ? 'swat' : unmarked ? 'unmarked' : 'marked',
          paint: unmarked ? (body === 'tahoe' ? '#1c2026' : pick(UNMARKED_PAINTS, 7)) : '#ffffff',
          unit: livery === 'swat' ? 'S' + (1 + (hash % 9)) : String((livery === 'sheriff' ? 20 : 10) + (hash % 79)),
          key: 'police:' + body + ':' + (unmarked ? 'unmarked' : livery),
        };
      }
      // The body-impostor pool a vehicle belongs to (flight-view3d.js), or null.
      function policeImpostorKey(c) {
        if (c.type !== 'police' && !c.lawUnit && !c.policeLook) return null;
        const look = policeLookFor(c);
        return look ? look.key : null;
      }
      // ---- Shared materials and shapes ---------------------------------------------
      const policeTrimMaterial = new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.52, metalness: 0.25 }),
        policeBrightMaterial = new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.9 }),
        policeWheelMaterial = new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.72 }),
        policeBumperMaterial = new Three.MeshStandardMaterial({ color: '#16181b', roughness: 0.62, metalness: 0.15 }),
        // Dark tinted glass with a strong sky reflection (damage3d.js falls back to it
        // for an intact pane through the model's `glass`).
        policeGlass = new Three.MeshStandardMaterial({ color: '#141f29', roughness: 0.05, metalness: 0.88, envMapIntensity: 1.6 }),
        // A headlamp lens with the lamp off (the dark half of the wig-wag).
        policeLampOff = new Three.MeshStandardMaterial({ color: '#b9bec2', roughness: 0.12, metalness: 0.7 }),
        // The bright half of the wig-wag: white, scaled with the light gain each frame.
        policeWigwagLamp = new Three.MeshBasicMaterial({ color: '#ffffff' }),
        // Halo colours for the flashing lights (anchor sprites are never drawn).
        policeHaloMaterials = {
          red: new Three.SpriteMaterial({ color: '#ff3a2c' }),
          blue: new Three.SpriteMaterial({ color: '#3f6cff' }),
          white: new Three.SpriteMaterial({ color: '#fff0dc' }),
        },
        // Scene light of a fully lit segment (bloom threshold 1.6); raised at night.
        policeLightGain = { value: 3.4 };
      let policeResourcesClaimed = false,
        policeShapes = null;
      // Shared resources must survive pruneModels(); registered on first use
      // (sharedMaterials is declared after this file).
      function claimPoliceResources() {
        if (policeResourcesClaimed) return;
        policeResourcesClaimed = true;
        for (const m of [policeTrimMaterial, policeBrightMaterial, policeWheelMaterial, policeBumperMaterial, policeGlass, policeLampOff, policeWigwagLamp, ...Object.values(policeHaloMaterials)])
          sharedMaterials.add(m);
      }
      function policeShapeKit() {
        if (policeShapes) return policeShapes;
        policeShapes = {
          cylinder: new Three.CylinderGeometry(1, 1, 1, 16),
          cylinderLow: new Three.CylinderGeometry(1, 1, 1, 8),
          sphere: new Three.SphereGeometry(1, 12, 8),
          dome: new Three.SphereGeometry(1, 16, 5, 0, TAU, 0, Math.PI / 2),
          arch: new Three.TorusGeometry(1, 0.075, 6, 18, Math.PI),
          halfDisc: new Three.CircleGeometry(1, 18, 0, Math.PI),
          disc: new Three.CircleGeometry(1, 12),
        };
        return policeShapes;
      }
      // A bar with rounded long edges: a `depth` × `height` rounded rectangle
      // extruded `length` along z, centred on the origin (merge input only).
      const policeBars = new Map();
      function roundedBar(length, height, depth, radius) {
        const key = [length, height, depth, radius].map((v) => v.toFixed(3)).join(':');
        let geo = policeBars.get(key);
        if (geo) return geo;
        const bevel = Math.min(radius, length / 4, height / 3, depth / 3),
          grow = bevel * 0.8,
          x = depth / 2 - grow,
          y = height / 2 - grow,
          r = Math.max(0.01, Math.min(radius - grow, x * 0.9, y * 0.9)),
          shape = new Three.Shape();
        shape.moveTo(-x + r, -y);
        shape.lineTo(x - r, -y);
        shape.quadraticCurveTo(x, -y, x, -y + r);
        shape.lineTo(x, y - r);
        shape.quadraticCurveTo(x, y, x - r, y);
        shape.lineTo(-x + r, y);
        shape.quadraticCurveTo(-x, y, -x, y - r);
        shape.lineTo(-x, -y + r);
        shape.quadraticCurveTo(-x, -y, -x + r, -y);
        geo = new Three.ExtrudeGeometry(shape, {
          depth: Math.max(0.01, length - bevel * 2),
          bevelEnabled: true,
          bevelSize: grow,
          bevelThickness: bevel,
          bevelSegments: 2,
          curveSegments: 3,
        });
        geo.translate(0, 0, -Math.max(0.01, length - bevel * 2) / 2);
        policeBars.set(key, geo);
        return geo;
      }
      // ---- Merging kit -----------------------------------------------------------------
      /*
       * Static parts are accumulated into one vertex set per material (position,
       * normal, uv, colour, light channel) and built once per body and equipment.
       */
      const policeMatrix = new Three.Matrix4(),
        policeNormalMatrix = new Three.Matrix3(),
        policeVector = new Three.Vector3(),
        policeQuaternion = new Three.Quaternion(),
        policeEuler = new Three.Euler(),
        policeScale = new Three.Vector3(),
        policePosition = new Three.Vector3(),
        policeColor = new Three.Color(),
        policeAxisX = new Three.Vector3(),
        policeAxisY = new Three.Vector3(),
        policeAxisZ = new Three.Vector3(),
        policeUp = new Three.Vector3();
      function policeSet() {
        return { position: [], normal: [], uv: [], color: [], channel: [], index: [], count: 0 };
      }
      function policeAddMatrix(set, geo, matrix, color, options) {
        policeNormalMatrix.getNormalMatrix(matrix);
        policeColor.set(color);
        const pos = geo.attributes.position,
          nor = geo.attributes.normal,
          uv = geo.attributes.uv,
          base = set.count,
          fixedUv = options?.uv,
          channel = options?.channel || 0;
        for (let i = 0; i < pos.count; i++) {
          policeVector.fromBufferAttribute(pos, i).applyMatrix4(matrix);
          set.position.push(policeVector.x, policeVector.y, policeVector.z);
          policeVector.fromBufferAttribute(nor, i).applyMatrix3(policeNormalMatrix).normalize();
          set.normal.push(policeVector.x, policeVector.y, policeVector.z);
          if (fixedUv) set.uv.push(fixedUv[0], fixedUv[1]);
          else set.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
          set.color.push(policeColor.r, policeColor.g, policeColor.b);
          set.channel.push(channel);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) set.index.push(base + geo.index.getX(i));
        else for (let i = 0; i < pos.count; i++) set.index.push(base + i);
        set.count += pos.count;
      }
      function policeAdd(set, geo, x, y, z, sx, sy, sz, color, options, rx = 0, ry = 0, rz = 0) {
        policeMatrix.compose(policePosition.set(x, y, z), policeQuaternion.setFromEuler(policeEuler.set(rx, ry, rz)), policeScale.set(sx, sy, sz));
        policeAddMatrix(set, geo, policeMatrix, color, options);
      }
      // A box (or any unit shape) from a to b: `height` along the side of `up`,
      // `depth` across both.
      function policeBeam(set, geo, a, b, height, depth, color, options, up = [0, 1, 0]) {
        policeAxisX.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const length = policeAxisX.length();
        if (length < 1e-4) return;
        policeAxisX.divideScalar(length);
        policeUp.set(up[0], up[1], up[2]);
        policeAxisZ.crossVectors(policeAxisX, policeUp);
        if (policeAxisZ.lengthSq() < 1e-8) policeAxisZ.set(0, 0, 1);
        policeAxisZ.normalize();
        policeAxisY.crossVectors(policeAxisZ, policeAxisX).normalize();
        policeMatrix.makeBasis(policeAxisX.multiplyScalar(length), policeAxisY.multiplyScalar(height), policeAxisZ.multiplyScalar(depth));
        policeMatrix.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        policeAddMatrix(set, geo, policeMatrix, color, options);
      }
      function policeGeometry(set, { colors = true, channels = false } = {}) {
        const g = new Three.BufferGeometry();
        g.setAttribute('position', new Three.Float32BufferAttribute(set.position, 3));
        g.setAttribute('normal', new Three.Float32BufferAttribute(set.normal, 3));
        g.setAttribute('uv', new Three.Float32BufferAttribute(set.uv, 2));
        if (colors) g.setAttribute('color', new Three.Float32BufferAttribute(set.color, 3));
        if (channels) g.setAttribute('lightChannel', new Three.Float32BufferAttribute(set.channel, 1));
        g.setIndex(set.index);
        g.computeBoundingSphere();
        sharedGeometries.add(g);
        return g;
      }
      // Flips any triangle whose normal faces `inward(centroid)` (a point inside the
      // surface), so lofted surfaces face out whatever order they were built in.
      function orientOutward(position, index, inside) {
        const a = new Three.Vector3(),
          b = new Three.Vector3(),
          c = new Three.Vector3(),
          centroid = new Three.Vector3(),
          centre = new Three.Vector3();
        for (let i = 0; i < index.length; i += 3) {
          a.fromArray(position, index[i] * 3);
          b.fromArray(position, index[i + 1] * 3);
          c.fromArray(position, index[i + 2] * 3);
          centroid.copy(a).add(b).add(c).divideScalar(3);
          inside(centroid, centre);
          b.sub(a);
          c.sub(a);
          b.cross(c);
          if (b.dot(centroid.sub(centre)) < 0) {
            const t = index[i + 1];
            index[i + 1] = index[i + 2];
            index[i + 2] = t;
          }
        }
      }
      // A (cols × rows) grid over fn(u, v) -> [x, y, z], u and v in 0..1, with its own
      // vertices and smooth normals, facing away from `inside`.
      function gridGeometry(cols, rows, fn, inside) {
        const position = [],
          uv = [],
          index = [];
        for (let j = 0; j <= rows; j++)
          for (let i = 0; i <= cols; i++) {
            position.push(...fn(i / cols, j / rows));
            uv.push(i / cols, j / rows);
          }
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols; i++) {
            const p = j * (cols + 1) + i,
              q = p + cols + 1;
            index.push(p, p + 1, q, p + 1, q + 1, q);
          }
        orientOutward(position, index, inside);
        const g = new Three.BufferGeometry();
        g.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        g.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
        g.setIndex(index);
        g.computeVertexNormals();
        return g;
      }
      const policeIdentity = new Three.Matrix4();
      // ---- POLICE SHELL ------------------------------------------------------------------
      function policeRing(body) {
        const side = body.section.slice(0, -1);
        return [...side.map(([n, z]) => [n, -z]), [1, 0], ...side.slice().reverse().map(([n, z]) => [n, z])];
      }
      function profileAt(profile, t) {
        if (t <= profile[0][0]) return [profile[0][1], profile[0][2]];
        for (let k = 0; k < profile.length - 1; k++) {
          const a = profile[k],
            b = profile[k + 1];
          if (t <= b[0]) {
            const f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
            return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
          }
        }
        const last = profile[profile.length - 1];
        return [last[1], last[2]];
      }
      // v round the section (arc length at the reference section), above the swatch band.
      function policeRingV(body, w) {
        const ring = policeRing(body),
          top = body.uvTop || body.h,
          points = ring.map(([nh, zf]) => [body.yb + nh * (top - body.yb), (zf * w) / 2]),
          v = [0];
        for (let j = 1; j < points.length; j++)
          v.push(v[j - 1] + Math.hypot(points[j][0] - points[j - 1][0], points[j][1] - points[j - 1][1]));
        const total = v[v.length - 1];
        return v.map((d) => POLICE_SWATCH_BAND + (1 - POLICE_SWATCH_BAND) * (d / total));
      }
      const policeShells = new Map();
      /*
       * The body: the section lofted along the profile (slices closer together at
       * the ends, where cars crumple, and at every profile break), capped at both
       * ends, smooth-shaded, UVs for the livery. Shared until dented, like
       * carShellGeometry().
       */
      function policeShellGeometry(body, l, w) {
        const key = body.name + ':' + l + ':' + w;
        if (policeShells.has(key)) return policeShells.get(key);
        const ring = policeRing(body),
          n = ring.length,
          vs = policeRingV(body, w),
          ts = [];
        for (let i = 0; i <= 30; i++) ts.push(-0.5 * Math.cos((i / 30) * Math.PI));
        for (const p of body.profile) ts.push(p[0]);
        ts.sort((a, b) => a - b);
        const slices = ts.filter((t, i) => i === 0 || t - ts[i - 1] > 0.004);
        const position = [],
          uv = [],
          index = [];
        for (const t of slices) {
          const [wf, top] = profileAt(body.profile, t);
          for (let j = 0; j < n; j++) {
            const [nh, zf] = ring[j];
            position.push(t * l, body.yb + nh * (top - body.yb), (zf * wf * w) / 2);
            uv.push(t + 0.5, vs[j]);
          }
        }
        const count = slices.length;
        for (let k = 0; k < count - 1; k++)
          for (let j = 0; j < n; j++) {
            const a = k * n + j,
              b = k * n + ((j + 1) % n),
              c = (k + 1) * n + ((j + 1) % n),
              d = (k + 1) * n + j;
            index.push(a, b, d, b, c, d);
          }
        // End caps round a centre point.
        for (const [k, u] of [[0, 0], [count - 1, 1]]) {
          const centre = position.length / 3;
          let y = 0;
          for (let j = 0; j < n; j++) y += position[(k * n + j) * 3 + 1];
          position.push(slices[k] * l, y / n, 0);
          uv.push(u, (POLICE_SWATCH_BAND + 1) / 2);
          for (let j = 0; j < n; j++) index.push(centre, k * n + ((j + 1) % n), k * n + j);
        }
        const middle = (body.yb + body.h) / 2;
        orientOutward(position, index, (p, out) => out.set(clamp(p.x, -0.46 * l, 0.46 * l), middle, 0));
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
        geo.setIndex(index);
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        sharedGeometries.add(geo);
        policeShells.set(key, geo);
        return geo;
      }
      // The body's outer half width and top at a point along it (reference section).
      function policeShellAt(body, l, w, x, y) {
        const [wf, top] = profileAt(body.profile, x / l),
          nh = clamp((y - body.yb) / (top - body.yb), 0, 1),
          section = body.section;
        let zf = section[section.length - 1][1];
        for (let k = 0; k < section.length - 1; k++) {
          const [n0, z0] = section[k],
            [n1, z1] = section[k + 1];
          if (nh <= n1) {
            zf = n1 > n0 ? lerpNumber(z0, z1, (nh - n0) / (n1 - n0)) : z1;
            break;
          }
        }
        return { half: (zf * wf * w) / 2, top };
      }
      function lerpNumber(a, b, f) {
        return a + (b - a) * f;
      }
      // ---- Glasshouse ------------------------------------------------------------------
      // A point on a pane: 'side' (s 0 rear..1 front, t 0 base..1 roof, `side` ±1),
      // 'front' / 'rear' (s -1..1 across), 'roof' (s across, t rear..front).
      function glassPoint(g, l, w, pane, s, t, side = 1) {
        const half = (tt) => lerpNumber(g.wb, g.wt, tt) * w + g.bow * w * Math.sin(Math.PI * tt);
        if (pane === 'side') {
          const xb = lerpNumber(g.xb, g.xf, s) * l,
            xt = lerpNumber(g.rb, g.rf, s) * l;
          return [lerpNumber(xb, xt, t), lerpNumber(g.base, g.roof, t), side * half(t)];
        }
        if (pane === 'front' || pane === 'rear') {
          const front = pane === 'front',
            x = lerpNumber(front ? g.xf : g.xb, front ? g.rf : g.rb, t) * l + (front ? 1 : -0.5) * g.bulge * (1 - s * s) * (1 - t);
          return [x, lerpNumber(g.base, g.roof, t) + g.arch * (1 - s * s) * t * t, s * half(t)];
        }
        return [lerpNumber(g.rb, g.rf, t) * l, g.roof + g.arch * (1 - s * s), s * g.wt * w];
      }
      const policeCabins = new Map();
      // Five panes in PANE_ORDER (left, front, right, rear, roof), each its own
      // grid and material group, so damage3d.js cracks and bursts them one by one.
      function policeCabinGeometry(body, l, w) {
        const key = body.name + ':' + l + ':' + w;
        if (policeCabins.has(key)) return policeCabins.get(key);
        const g = body.glass,
          centreX = ((g.xf + g.xb + g.rf + g.rb) / 4) * l,
          inside = (p, out) => out.set(centreX, g.base, 0),
          panes =
            body.kind === 'bearcat'
              ? policeBearcatGlass(body, l, w)
              : [
                  gridGeometry(4, 2, (u, v) => glassPoint(g, l, w, 'side', u, v, -1), inside),
                  gridGeometry(6, 3, (u, v) => glassPoint(g, l, w, 'front', u * 2 - 1, v), inside),
                  gridGeometry(4, 2, (u, v) => glassPoint(g, l, w, 'side', u, v, 1), inside),
                  gridGeometry(6, 2, (u, v) => glassPoint(g, l, w, 'rear', u * 2 - 1, v), inside),
                  gridGeometry(4, 4, (u, v) => glassPoint(g, l, w, 'roof', u * 2 - 1, v), inside),
                ];
        const position = [],
          normal = [],
          uv = [],
          index = [],
          geo = new Three.BufferGeometry();
        panes.forEach((pane, i) => {
          const base = position.length / 3,
            start = index.length;
          position.push(...pane.attributes.position.array);
          normal.push(...pane.attributes.normal.array);
          uv.push(...pane.attributes.uv.array);
          for (const k of pane.index.array) index.push(base + k);
          geo.addGroup(start, index.length - start, i);
          pane.dispose();
        });
        geo.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        geo.setAttribute('normal', new Three.Float32BufferAttribute(normal, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
        geo.setIndex(index);
        geo.computeBoundingSphere();
        sharedGeometries.add(geo);
        policeCabins.set(key, geo);
        return geo;
      }
      /*
       * The BearCat's armoured glass on its slab body: two cab windows a side, the
       * split windscreen on the raked front, a vision slot over the rear doors and
       * the hatch's vision block, a hair outside the armour.
       */
      function policeBearcatGlass(body, l, w) {
        const slab = (w / 2) * 1.0 + 0.07,
          outwardX = (p, out) => out.set(p.x - 3, p.y, 0),
          sideWindows = (side) => {
            const parts = [];
            for (const [x0, x1] of [[0.02, 0.118], [-0.085, -0.005]]) parts.push([x0 * l, x1 * l]);
            // One grid spanning both windows would glaze the pillar: two thin grids joined in one pane.
            const grids = parts.map(([a, b]) => gridGeometry(1, 1, (u, v) => [lerpNumber(a, b, u), lerpNumber(15.2, 20.4, v), side * slab], (p, out) => out.set(p.x, p.y, 0)));
            return mergePaneGrids(grids);
          },
          [, topFront] = profileAt(body.profile, 0.135),
          [, footFront] = profileAt(body.profile, 0.205),
          front = [0.135 * l, topFront],
          foot = [0.205 * l, footFront],
          // Outward (forward and up) normal of the raked front.
          nx = front[1] - foot[1],
          ny = foot[0] - front[0],
          nl = Math.hypot(nx, ny),
          off = 0.07,
          windscreen = mergePaneGrids(
            [-1, 1].map((side) =>
              gridGeometry(
                1,
                1,
                (u, v) => {
                  const t = lerpNumber(0.12, 0.85, v),
                    x = lerpNumber(foot[0], front[0], t) + (nx / nl) * off,
                    y = lerpNumber(foot[1], front[1], t) + (ny / nl) * off;
                  return [x, y, side * lerpNumber(0.6, (w / 2) * 0.93 * 0.86, u)];
                },
                outwardX,
              ),
            ),
          ),
          rear = gridGeometry(1, 1, (u, v) => [-0.5 * l - 0.06, lerpNumber(20.3, 21.5, v), lerpNumber(-w * 0.34, w * 0.34, u)], (p, out) => out.set(p.x + 3, p.y, 0)),
          roof = gridGeometry(1, 1, (u, v) => [-0.13 * l + lerpNumber(-1.1, 1.1, u), 24.22, lerpNumber(-0.8, 0.8, v)], (p, out) => out.set(p.x, p.y - 3, 0));
        return [sideWindows(-1), windscreen, sideWindows(1), rear, roof];
      }
      function mergePaneGrids(grids) {
        const position = [],
          normal = [],
          uv = [],
          index = [];
        for (const g of grids) {
          const base = position.length / 3;
          position.push(...g.attributes.position.array);
          normal.push(...g.attributes.normal.array);
          uv.push(...g.attributes.uv.array);
          for (const k of g.index.array) index.push(base + k);
          g.dispose();
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        geo.setAttribute('normal', new Three.Float32BufferAttribute(normal, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
        geo.setIndex(index);
        return geo;
      }
      // ---- Swatch geometry -----------------------------------------------------------
      // A unit box sampling one solid swatch of the livery (hood, door, trunk lids).
      const policeSwatchBoxes = new Map();
      function swatchUv(index) {
        return [(index + 0.5) / 8, POLICE_SWATCH_BAND / 2];
      }
      function policeSwatchBox(index) {
        let geo = policeSwatchBoxes.get(index);
        if (geo) return geo;
        geo = boxGeo.clone();
        const uv = geo.attributes.uv,
          [u, v] = swatchUv(index);
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
        sharedGeometries.add(geo);
        policeSwatchBoxes.set(index, geo);
        return geo;
      }
      // ---- Livery textures ---------------------------------------------------------------
      const policeLiveryTextures = new Map(),
        LIVERY_W = 1024,
        LIVERY_H = 512;
      function policeCanvasTexture(canvas) {
        const tx = new Three.CanvasTexture(canvas);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      /*
       * The livery painter's frame: canvas x along the car, canvas y for a height on
       * either side (the reference section's ring, so painted lines follow the body
       * as it tapers to the bumpers).
       */
      function liveryFrame(body, l, w) {
        const ring = policeRing(body),
          v = policeRingV(body, w),
          top = body.uvTop || body.h,
          heights = ring.map(([nh]) => body.yb + nh * (top - body.yb)),
          centre = (ring.length - 1) / 2,
          vSide = (y, side) => {
            const at = (j) => v[side < 0 ? j : ring.length - 1 - j];
            if (y <= heights[0]) return at(0);
            for (let j = 0; j < centre - 1; j++)
              if (y <= heights[j + 1]) return lerpNumber(at(j), at(j + 1), (y - heights[j]) / Math.max(1e-6, heights[j + 1] - heights[j]));
            return at(centre - 1);
          };
        const frame = {
          l,
          X: (x) => (x / l + 0.5) * LIVERY_W,
          Y: (y, side) => (1 - vSide(y, side)) * LIVERY_H,
          sides: [-1, 1],
        };
        // Canvas pixels per world unit along the car and up the side.
        frame.pxU = LIVERY_W / l;
        frame.pxV = Math.abs(frame.Y(7, 1) - frame.Y(6, 1));
        return frame;
      }
      function liveryBand(g, f, x0, x1, y0, y1, color) {
        g.fillStyle = color;
        for (const side of f.sides) {
          const ya = f.Y(y0, side),
            yb = f.Y(y1, side);
          g.fillRect(f.X(x0), Math.min(ya, yb), f.X(x1) - f.X(x0), Math.abs(yb - ya));
        }
      }
      // The top of the body between the shoulders at height y (hood, deck, trunk).
      function liveryTop(g, f, x0, x1, y, color) {
        const ya = f.Y(y, 1),
          yb = f.Y(y, -1);
        g.fillStyle = color;
        g.fillRect(f.X(x0), Math.min(ya, yb), f.X(x1) - f.X(x0), Math.abs(yb - ya));
      }
      function liveryPolygon(g, f, points, color) {
        g.fillStyle = color;
        for (const side of f.sides) {
          g.beginPath();
          points.forEach(([x, y], i) => (i ? g.lineTo(f.X(x), f.Y(y, side)) : g.moveTo(f.X(x), f.Y(y, side))));
          g.closePath();
          g.fill();
        }
      }
      // Draws `paint(g, pxPerUnit)` at (x, y) on both sides, upright and reading
      // front to back on the right and back to front on the left, as a sign writer would.
      function liveryDraw(g, f, x, y, paint) {
        for (const side of f.sides) {
          g.save();
          g.translate(f.X(x), f.Y(y, side));
          g.scale((side < 0 ? -1 : 1) * (f.pxU / f.pxV), side < 0 ? 1 : -1);
          paint(g, f.pxV);
          g.restore();
        }
      }
      function liveryText(g, f, text, x, y, height, color, { weight = 'bold', stretch = 1, spacing = 0, stroke = null } = {}) {
        liveryDraw(g, f, x, y, (c, px) => {
          c.scale(stretch, 1);
          c.font = `${weight} ${Math.round(height * px * 1.36)}px ${POLICE_FONT}`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          if (spacing && 'letterSpacing' in c) c.letterSpacing = `${Math.round(spacing * px)}px`;
          if (stroke) {
            c.lineWidth = stroke[1] * px;
            c.strokeStyle = stroke[0];
            c.lineJoin = 'round';
            c.strokeText(text, 0, 0);
          }
          c.fillStyle = color;
          c.fillText(text, 0, 0);
        });
      }
      function starPath(c, radius, points, inner) {
        c.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / points,
            r = i % 2 ? radius * inner : radius;
          if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          else c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        c.closePath();
      }
      // A police star: gold points with a ball on each, a dark ring with the city seal.
      function liveryBadge(g, f, x, y, size, points, ring) {
        liveryDraw(g, f, x, y, (c, px) => {
          const r = (size / 2) * px;
          starPath(c, r, points, 0.52);
          c.fillStyle = '#b98f2f';
          c.fill();
          c.lineWidth = r * 0.06;
          c.strokeStyle = '#6d5418';
          c.stroke();
          starPath(c, r * 0.86, points, 0.52);
          c.fillStyle = '#e1bf5c';
          c.fill();
          for (let i = 0; i < points; i++) {
            const a = -Math.PI / 2 + (i * TAU) / points;
            c.beginPath();
            c.arc(Math.cos(a) * r, Math.sin(a) * r, r * 0.09, 0, TAU);
            c.fillStyle = '#e1bf5c';
            c.fill();
          }
          c.beginPath();
          c.arc(0, 0, r * 0.4, 0, TAU);
          c.fillStyle = ring;
          c.fill();
          c.beginPath();
          c.arc(0, 0, r * 0.26, 0, TAU);
          c.fillStyle = '#e1bf5c';
          c.fill();
          c.beginPath();
          c.arc(0, 0, r * 0.16, 0, TAU);
          c.fillStyle = ring;
          c.fill();
        });
      }
      // Door shut lines: thin dark seams from the sill to the waist.
      function liverySeams(g, f, xs, y0, y1, color = 'rgba(0,0,0,0.55)') {
        for (const x of xs) liveryBand(g, f, x - 0.045, x + 0.045, y0, y1, color);
      }
      function policeLiveryTexture(livery, body, l, w) {
        const key = livery + ':' + body.name + ':' + l + ':' + w;
        let tx = policeLiveryTextures.get(key);
        if (tx) return tx;
        const canvas = document.createElement('canvas');
        canvas.width = LIVERY_W;
        canvas.height = LIVERY_H;
        const g = canvas.getContext('2d'),
          spec = POLICE_LIVERIES[livery],
          f = liveryFrame(body, l, w),
          top = body.h + 2,
          sill = body.yb + 0.9,
          waist = body.yb + (body.h - body.yb) * 0.66;
        g.fillStyle = spec.base;
        g.fillRect(0, 0, LIVERY_W, LIVERY_H);
        if (livery === 'bw') {
          // White doors from the sill to the glass, cut by the wheel arches.
          liveryBand(g, f, -0.19 * l, 0.19 * l, 0, top, '#f1f2ef');
          liverySeams(g, f, [-0.19 * l, -0.005 * l, 0.19 * l], sill, body.h - 0.4);
          liveryText(g, f, 'POLICE', -0.035 * l, body.yb + 3.05, 1.8, '#0b0c0f', { stretch: 1.12, spacing: 0.12 });
          liveryText(g, f, 'SOUTH COAST', -0.035 * l, body.yb + 4.55, 0.62, '#0b0c0f', { stretch: 1.1, spacing: 0.1 });
          liveryBadge(g, f, 0.125 * l, body.yb + 3.35, 2.7, 7, '#1c2a55');
          liveryText(g, f, 'DIAL 911', -0.335 * l, waist, 0.55, '#e8e8e4', { stretch: 1.1 });
          liveryText(g, f, 'TO PROTECT AND TO SERVE', 0.31 * l, waist + 0.2, 0.42, '#e8e8e4', { weight: 'italic bold' });
        } else if (livery === 'modern') {
          const lo = body.yb + 0.9,
            hi = body.yb + 1.7;
          // A navy swoosh rising towards the tail, a sky-blue band and a reflective line.
          liveryPolygon(g, f, [[0.52 * l, lo], [-0.52 * l, lo + 0.6], [-0.52 * l, hi + 2.3], [0.52 * l, hi]], '#13295c');
          liveryPolygon(g, f, [[0.52 * l, hi], [-0.52 * l, hi + 2.3], [-0.52 * l, hi + 2.75], [0.52 * l, hi + 0.35]], '#3f8fd9');
          liveryPolygon(g, f, [[0.52 * l, hi + 0.35], [-0.52 * l, hi + 2.75], [-0.52 * l, hi + 2.98], [0.52 * l, hi + 0.52]], '#dfe6ec');
          liverySeams(g, f, [-0.19 * l, -0.005 * l, 0.19 * l], sill, body.h - 0.4, 'rgba(20,30,50,0.45)');
          liveryText(g, f, 'POLICE', -0.05 * l, body.yb + 4.05, 1.75, '#13295c', { stretch: 1.14, spacing: 0.14 });
          liveryText(g, f, 'SOUTH COAST', -0.03 * l, body.yb + 1.95, 0.6, '#f2f4f6', { stretch: 1.1, spacing: 0.1 });
          liveryBadge(g, f, 0.14 * l, body.yb + 4.0, 2.1, 7, '#13295c');
          liveryText(g, f, '911', -0.36 * l, body.yb + 4.1, 0.9, '#13295c', { stretch: 1.1 });
        } else if (livery === 'sheriff') {
          const band = body.yb + 2.75;
          liveryBand(g, f, -0.6 * l, 0.6 * l, 0, band, '#1d4a33');
          liveryTop(g, f, -0.6 * l, -0.29 * l, body.h - 0.6, '#1d4a33');
          liveryTop(g, f, 0.23 * l, 0.6 * l, body.h - 0.6, '#1d4a33');
          liveryBand(g, f, -0.6 * l, 0.6 * l, band, band + 0.24, '#c9a44a');
          liverySeams(g, f, [-0.19 * l, -0.005 * l, 0.19 * l], sill, body.h - 0.4, 'rgba(10,30,20,0.5)');
          liveryText(g, f, 'SHERIFF', -0.05 * l, body.yb + 4.0, 1.7, '#1d4a33', { stretch: 1.1, spacing: 0.14 });
          liveryText(g, f, 'SOUTH COAST COUNTY', -0.03 * l, body.yb + 1.55, 0.58, '#eef0ea', { stretch: 1.08, spacing: 0.08 });
          liveryBadge(g, f, 0.14 * l, body.yb + 4.0, 2.3, 6, '#1d4a33');
        } else if (livery === 'swat') {
          // Blacked armour low down, a grey reflective band, POLICE and SWAT on the box.
          liveryBand(g, f, -0.6 * l, 0.6 * l, 0, body.yb + 1.3, '#0f1319');
          liveryBand(g, f, -0.6 * l, 0.6 * l, 9.2, 10.0, '#98a2ae');
          liveryBand(g, f, -0.6 * l, 0.6 * l, 10.0, 10.12, '#5d6773');
          liveryText(g, f, 'POLICE', -0.19 * l, 17.0, 2.5, '#eef0ec', { stretch: 1.08, spacing: 0.2 });
          liveryText(g, f, 'S.W.A.T.', -0.2 * l, 13.2, 1.7, '#eef0ec', { stretch: 1.1, spacing: 0.2 });
          liveryText(g, f, 'SPECIAL WEAPONS AND TACTICS', -0.2 * l, 11.3, 0.62, '#b9c2cc', { stretch: 1.05 });
          liverySeams(g, f, [0.125 * l, 0.012 * l, -0.095 * l], 9.2, 21.5, 'rgba(0,0,0,0.6)');
          liveryBadge(g, f, 0.07 * l, 12.4, 2.4, 7, '#18202c');
        }
        // Panel swatches along the bottom band.
        spec.swatches.forEach((color, i) => {
          g.fillStyle = color;
          g.fillRect((i * LIVERY_W) / 8, LIVERY_H * (1 - POLICE_SWATCH_BAND), LIVERY_W / 8, LIVERY_H * POLICE_SWATCH_BAND);
        });
        tx = policeCanvasTexture(canvas);
        policeLiveryTextures.set(key, tx);
        return tx;
      }
      // Clear-coated livery paint shared by a body impostor pool (flight-view3d.js).
      const policeImpostorPaints = new Map();
      function policeImpostorPaint(texture) {
        let m = policeImpostorPaints.get(texture);
        if (!m) {
          m = new Three.MeshPhysicalMaterial({ map: texture, color: '#ffffff', roughness: 0.34, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.08 });
          sharedMaterials.add(m);
          policeImpostorPaints.set(texture, m);
        }
        return m;
      }
      // ---- POLICE DECALS: unit numbers and words from one glyph atlas ---------------------
      // Letters in atlas order: the police set first, then the rest of the alphabet the
      // aircraft liveries use (helicopter3d.js: CH 7 NEWS, U.S. ARMY, registrations).
      const POLICE_GLYPHS = '0123456789ABCEFHIKLNOPRSTUW-.DGJMQVXYZ',
        GLYPH_CELL_W = 72,
        GLYPH_CELL_H = 128,
        GLYPHS_PER_ROW = 14;
      let policeGlyphAtlas = null;
      function policeGlyphs() {
        if (policeGlyphAtlas) return policeGlyphAtlas;
        const rows = Math.ceil(POLICE_GLYPHS.length / GLYPHS_PER_ROW),
          canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 128 * Math.pow(2, Math.ceil(Math.log2(rows)));
        const g = canvas.getContext('2d'),
          advance = {};
        g.fillStyle = '#ffffff';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = `bold 118px ${POLICE_FONT}`;
        [...POLICE_GLYPHS].forEach((ch, i) => {
          const cx = (i % GLYPHS_PER_ROW) * GLYPH_CELL_W + GLYPH_CELL_W / 2,
            cy = Math.floor(i / GLYPHS_PER_ROW) * GLYPH_CELL_H + GLYPH_CELL_H / 2 + 4;
          g.save();
          g.translate(cx, cy);
          g.scale(0.74, 1);
          g.fillText(ch, 0, 0);
          g.restore();
          advance[ch] = (g.measureText(ch).width * 0.74) / GLYPH_CELL_H;
        });
        const texture = policeCanvasTexture(canvas),
          material = new Three.MeshStandardMaterial({
            map: texture,
            vertexColors: true,
            alphaTest: 0.5,
            roughness: 0.42,
            metalness: 0.05,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -4,
          });
        sharedMaterials.add(material);
        policeGlyphAtlas = { advance, material, height: canvas.height };
        return policeGlyphAtlas;
      }
      // Writes `text` into a decal set: centred on `origin`, running along `right`,
      // glyphs standing along `up` (cell height `height`); `lift(x, z)` follows a curve.
      function decalText(set, text, origin, right, up, height, color, lift) {
        const atlas = policeGlyphs(),
          spacing = height * 0.06,
          chars = [...text].filter((ch) => POLICE_GLYPHS.includes(ch)),
          advance = (ch) => atlas.advance[ch] * height;
        let total = -spacing;
        for (const ch of chars) total += advance(ch) + spacing;
        let cursor = -total / 2;
        const quad = (GLYPH_CELL_W / GLYPH_CELL_H) * height,
          nx = right[1] * up[2] - right[2] * up[1],
          ny = right[2] * up[0] - right[0] * up[2],
          nz = right[0] * up[1] - right[1] * up[0];
        policeColor.set(color);
        for (const ch of chars) {
          const i = POLICE_GLYPHS.indexOf(ch),
            u0 = ((i % GLYPHS_PER_ROW) * GLYPH_CELL_W) / 1024,
            u1 = u0 + GLYPH_CELL_W / 1024,
            v1 = 1 - (Math.floor(i / GLYPHS_PER_ROW) * GLYPH_CELL_H) / atlas.height,
            v0 = v1 - GLYPH_CELL_H / atlas.height,
            centre = cursor + advance(ch) / 2,
            base = set.count;
          for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
            const along = centre + a * quad,
              x = origin[0] + right[0] * along + up[0] * b * height,
              z = origin[2] + right[2] * along + up[2] * b * height;
            let y = origin[1] + right[1] * along + up[1] * b * height;
            if (lift) y += lift(x, z);
            set.position.push(x, y, z);
            set.normal.push(nx, ny, nz);
            set.uv.push(a < 0 ? u0 : u1, b < 0 ? v0 : v1);
            set.color.push(policeColor.r, policeColor.g, policeColor.b);
            set.channel.push(0);
          }
          set.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
          set.count += 4;
          cursor += advance(ch) + spacing;
        }
      }
      // A text's run per unit of glyph cell height (decalText's layout).
      function decalLength(text) {
        const atlas = policeGlyphs(),
          chars = [...text].filter((ch) => POLICE_GLYPHS.includes(ch));
        return chars.reduce((sum, ch) => sum + atlas.advance[ch] + 0.06, -0.06);
      }
      const policeDecalGeometries = new Map();
      // Roof number (aerial ID), trunk and rear-fender numbers for one unit.
      function policeDecalGeometry(look, body, l, w, kit) {
        const key = look.key + ':' + look.unit + ':' + l + ':' + w;
        if (policeDecalGeometries.has(key)) return policeDecalGeometries.get(key);
        const set = policeSet(),
          spec = POLICE_LIVERIES[look.livery],
          roof = kit.roofDecal;
        if (roof) {
          // Read along the car, glyphs standing towards its left: a car heading east
          // reads upright. As tall as the roof allows for the text's length.
          const text = body.kind === 'bearcat' ? 'SWAT' : look.unit,
            ratio = decalLength(text);
          decalText(set, text, [roof.x, roof.y, 0], [1, 0, 0], [0, 0, -1], Math.min(roof.width, roof.length / ratio), spec.roofDigits, roof.lift);
        }
        if (body.trunk) {
          const x = body.trunk * l,
            top = profileAt(body.profile, body.trunk)[1];
          decalText(set, look.unit, [x, top + 0.04, 0], [0, 0, 1], [1, 0, 0], 3.1, spec.roofDigits);
        }
        if (body.kind !== 'bearcat')
          for (const side of [-1, 1]) {
            const x = -0.365 * l,
              y = body.yb + (body.h - body.yb) * 0.6,
              { half } = policeShellAt(body, l, w, x, y);
            decalText(set, look.unit, [x, y, side * (half + 0.06)], [side, 0, 0], [0, 1, 0], 1.7, spec.sideDigits);
          }
        const geo = policeGeometry(set);
        policeDecalGeometries.set(key, geo);
        return geo;
      }
      // ---- POLICE LIGHTS ------------------------------------------------------------------
      const POLICE_LIGHT_VERTEX = `
        #include <common>
        #include <fog_pars_vertex>
        attribute float lightChannel;
        uniform float levels[ 8 ];
        varying vec3 vLens;
        varying float vLevel;
        void main() {
          #ifdef USE_COLOR
            vLens = color;
          #else
            vLens = vec3( 1.0 );
          #endif
          float level = 0.0;
          for ( int i = 0; i < 8; i++ ) if ( float( i ) == lightChannel ) level = levels[ i ];
          vLevel = level;
          vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
        POLICE_LIGHT_FRAGMENT = `
        #include <common>
        #include <fog_pars_fragment>
        uniform float gain;
        varying vec3 vLens;
        varying float vLevel;
        void main() {
          // Unlit: the tinted lens under clear plastic. Lit: the LED at scene
          // brightness well past the bloom threshold.
          vec3 off = vLens * 0.32 + vec3( 0.05 );
          gl_FragColor = vec4( mix( off, vLens * gain, vLevel ), 1.0 );
          #include <fog_fragment>
        }`;
      // One per model: its own channel levels; the gain is shared by all.
      function policeLightMaterial() {
        return new Three.ShaderMaterial({
          uniforms: { ...Three.UniformsUtils.clone(Three.UniformsLib.fog), levels: { value: new Float32Array(8) }, gain: policeLightGain },
          vertexShader: POLICE_LIGHT_VERTEX,
          fragmentShader: POLICE_LIGHT_FRAGMENT,
          vertexColors: true,
          fog: true,
        });
      }
      /*
       * Light channels: 0 left outer (red), 1 left inner (red), 2 right inner
       * (blue), 3 right outer (blue), 4 white takedowns and alley lights, 5 left
       * push-bar / grille / rear LEDs (red), 6 the right ones (blue), 7 running
       * lights. Returns 0 (off), 1 (pursuit) or 2 (parked at a scene).
       */
      function policeLightMode(c) {
        if (c.hp <= 0) return 0;
        const responding = (c.cop && wantedStars > 0) || c.airUnit || c.gangTarget || c.showLights;
        if (!responding) return 0;
        if (c.showLights === 'pursuit') return 1;
        return c.blockade || c.crewDeployed || c.showLights || Math.abs(c.speed || 0) < 12 ? 2 : 1;
      }
      function pulses(p, count, on, gap) {
        if (p < 0) return 0;
        const period = on + gap,
          k = Math.floor(p / period);
        return k < count && p - k * period < on ? 1 : 0;
      }
      const POLICE_SWEEP = [0, 1, 2, 3, 2, 1];
      function policeLightLevels(c, out, time) {
        out.fill(0);
        out[7] = c.hp > 0 ? 1 : 0;
        const mode = policeLightMode(c);
        if (!mode) return 0;
        const t = time + (c.id % 17) * 0.37;
        if (mode === 2) {
          // Parked: slow side-to-side double flashes, takedowns lighting the scene.
          const p = t % 1.2,
            left = pulses(p, 2, 0.14, 0.1),
            right = pulses(p - 0.6, 2, 0.14, 0.1);
          out[0] = out[1] = out[6] = left;
          out[2] = out[3] = out[5] = right;
          out[4] = 0.55;
          return 2;
        }
        const pattern = Math.floor(t / 4.2) % 3;
        if (pattern === 0) {
          // Quad flashes, side to side.
          const p = t % 0.56,
            left = pulses(p, 3, 0.05, 0.043),
            right = pulses(p - 0.28, 3, 0.05, 0.043);
          out[0] = out[1] = out[6] = left;
          out[2] = out[3] = out[5] = right;
        } else if (pattern === 1) {
          // Double flashes, criss-cross: outer pair, then inner pair.
          const p = t % 0.72,
            outer = pulses(p, 2, 0.07, 0.05),
            inner = pulses(p - 0.36, 2, 0.07, 0.05);
          out[0] = out[3] = out[5] = outer;
          out[1] = out[2] = out[6] = inner;
        } else {
          // A sweep out and back across the bar, the LEDs below alternating.
          const step = Math.floor((t % 0.9) / 0.15),
            lit = POLICE_SWEEP[step];
          out[lit] = 1;
          if (lit > 0) out[lit - 1] = Math.max(out[lit - 1], 0.3);
          if (lit < 3) out[lit + 1] = Math.max(out[lit + 1], 0.3);
          out[5] = step < 3 ? 1 : 0;
          out[6] = 1 - out[5];
        }
        // White takedowns pop in on the beat.
        out[4] = pulses(t % 1.1, 2, 0.04, 0.05) * 0.85;
        return 1;
      }
      // ---- The kit: merged parts for one body and equipment ----------------------------------
      const policeKits = new Map();
      function policeKit(look, body, l, w) {
        const key = [body.name, look.equipment, l, w].join(':');
        if (policeKits.has(key)) return policeKits.get(key);
        const S = policeShapeKit(),
          g = body.glass,
          marked = look.equipment === 'marked',
          bearcat = body.kind === 'bearcat',
          paint = policeSet(),
          trim = policeSet(),
          bright = policeSet(),
          lights = policeSet(),
          beaconLeft = policeSet(),
          beaconRight = policeSet(),
          anchors = [],
          swatch = (name) => ({ uv: swatchUv(POLICE_SWATCH[name]) }),
          black = '#101215',
          gloss = '#07080a',
          plastic = '#1d2024',
          chrome = '#d7dde1',
          light = (set, geo, x, y, z, sx, sy, sz, color, channel, rx, ry, rz) => policeAdd(set, geo, x, y, z, sx, sy, sz, color, { channel }, rx, ry, rz),
          anchor = (x, y, z, color, size, channels, strength = 1) => anchors.push({ x, y, z, color, size, channels, strength }),
          topAt = (x) => profileAt(body.profile, x / l)[1],
          halfAt = (x, y) => policeShellAt(body, l, w, x, y).half,
          kit = {
            shell: policeShellGeometry(body, l, w),
            cabin: policeCabinGeometry(body, l, w),
            hood: policeSwatchBox(POLICE_SWATCH.hood),
            door: policeSwatchBox(POLICE_SWATCH.door),
            trunk: policeSwatchBox(POLICE_SWATCH.trunk),
            wheel: body.wheel,
            rims: [-1, 1].map((side) => policeRimGeometry(bearcat ? 'truck' : look.body === 'tahoe' || (look.unmarked && look.body === 'charger') ? 'alloy' : 'steel', side, body.wheel)),
            anchors,
          };
        // Wheel arches: a dark well behind each tyre and a black flare round it.
        for (const side of [-1, 1])
          for (const fx of [-body.wheel.x, body.wheel.x]) {
            const x = fx * l,
              r = body.wheel.r,
              half = halfAt(x, body.wheel.r + 1.5);
            policeAdd(trim, S.halfDisc, x, r * 0.98, side * (half + 0.03), r * 1.13, r * 1.13, 1, '#060607', null, 0, side < 0 ? Math.PI : 0, 0);
            policeAdd(trim, S.arch, x, r * 0.98, side * (half + 0.05), r * 1.16, r * 1.16, bearcat ? 7 : 4, bearcat ? plastic : black);
          }
        if (!bearcat) {
          // ---- Roof panel over the glass roof, with a short skirt.
          const roofPoint = (s, t, lift = 0.14) => [lerpNumber(g.rb * l - 0.25, g.rf * l + 0.25, t), g.roof + lift + g.arch * (1 - s * s), s * g.wt * w * 1.03];
          const roofGeo = gridGeometry(6, 4, (u, v) => roofPoint(u * 2 - 1, v), (p, out) => out.set(p.x, p.y - 5, 0));
          policeAddMatrix(paint, roofGeo, policeIdentity, '#ffffff', swatch('roof'));
          roofGeo.dispose();
          for (const side of [-1, 1]) {
            const skirt = gridGeometry(6, 1, (u, v) => {
              const p = roofPoint(side, u, 0.14 - (1 - v) * 0.34);
              return [p[0], p[1], p[2] + side * 0.02];
            }, (p, out) => out.set(p.x, p.y, 0));
            policeAddMatrix(paint, skirt, policeIdentity, '#ffffff', swatch('roof'));
            skirt.dispose();
          }
          // ---- Pillars: A (and the rear) in the body colour, B/C in gloss black.
          const pillarPoint = (s, t, side, out) => {
            const p = glassPoint(g, l, w, 'side', s, t, side);
            return [p[0], p[1], p[2] + side * out];
          };
          for (const side of [-1, 1]) {
            const up = [0, 0, side];
            for (const [s, width, kind] of [[1, 1.05, 'paint'], ...g.pillars]) {
              const set = kind === 'paint' ? paint : trim,
                options = kind === 'paint' ? swatch('pillar') : null,
                offset = s === 1 ? 0.2 : 0.12,
                shift = s === 1 ? -width * 0.35 : s === 0 ? width * 0.45 : 0,
                points = [0, 0.5, 1].map((t) => {
                  const p = pillarPoint(s, t, side, offset);
                  return [p[0] + shift, p[1], p[2]];
                });
              for (let k = 0; k < 2; k++) policeBeam(set, boxGeo, points[k], points[k + 1], 0.32, width, kind === 'paint' ? '#ffffff' : gloss, options, up);
            }
            // Waist line along the foot of the side glass.
            policeBeam(body.chrome ? bright : trim, boxGeo, pillarPoint(0, 0.03, side, 0.14), pillarPoint(1, 0.03, side, 0.14), 0.3, 0.28, body.chrome ? chrome : gloss, null, [0, 1, 0]);
            // Mirrors on the door tops, black caps.
            const mx = g.xf * l - 1.6,
              my = g.base + 1.3,
              mz = side * (g.wb * w + 1.3);
            policeAdd(trim, roundedBar(1.6, 1.15, 0.9, 0.3), mx, my, mz, 1, 1, 1, black);
            policeBeam(trim, boxGeo, [mx + 0.2, my - 0.4, side * g.wb * w], [mx + 0.2, my - 0.3, mz - side * 0.5], 0.35, 0.5, black);
            // Door handles.
            for (const hx of [0.08, -0.115]) policeAdd(body.chrome ? bright : trim, boxGeo, hx * l, body.h - 1.4, side * (halfAt(hx * l, body.h - 1.4) + 0.04), 1.1, 0.28, 0.16, body.chrome ? chrome : black);
            // Black sill (rocker) trim between the arches.
            const sillY = body.yb + 0.75;
            policeAdd(trim, boxGeo, 0, sillY, side * (halfAt(0, sillY) + 0.02), l * (2 * body.wheel.x) - body.wheel.r * 2.3, 0.7, 0.12, plastic);
          }
          if (body.rails)
            for (const side of [-1, 1]) {
              const z = side * g.wt * w * 0.82,
                y = g.roof + g.arch * (1 - 0.82 * 0.82) + 0.6;
              policeAdd(trim, roundedBar(g.rf * l - g.rb * l - 4, 0.4, 0.45, 0.15), (g.rb * l + g.rf * l - 1) / 2, y, z, 1, 1, 1, black, null, 0, Math.PI / 2, 0);
              for (const t of [0.1, 0.9]) policeAdd(trim, boxGeo, lerpNumber(g.rb * l + 1.5, g.rf * l - 2.5, t), y - 0.3, z, 0.8, 0.5, 0.4, black);
            }
          // Charger: a lip spoiler on the trunk.
          if (body.spoiler) {
            const x = body.spoiler * l;
            policeAdd(paint, roundedBar(w * 0.82, 0.32, 1.1, 0.14), x, topAt(x) + 0.22, 0, 1, 1, 1, '#ffffff', swatch('trunk'));
          }
          if (body.kind === 'suv') {
            // Tailgate spoiler over the rear glass.
            policeAdd(paint, roundedBar(g.wt * w * 1.9, 0.4, 1.6, 0.18), g.rb * l - 0.35, g.roof + 0.25, 0, 1, 1, 1, '#ffffff', swatch('roof'));
          }
          // Grille between the headlamps.
          const nose = 0.5 * l,
            noseTop = topAt(nose - 0.6),
            grilleY = noseTop - 1.25;
          policeAdd(trim, roundedBar(w * 0.44, 1.5, 0.5, 0.2), nose - 0.35, grilleY, 0, 1, 1, 1, gloss);
          if (body.chrome) policeAdd(bright, roundedBar(w * 0.47, 1.75, 0.3, 0.2), nose - 0.3, grilleY, 0, 1, 1, 1, chrome);
          // Lower intake and licence plate.
          policeAdd(trim, roundedBar(w * 0.52, 0.9, 0.4, 0.3), nose + 0.05, 3.95, 0, 1, 1, 1, gloss);
          policeAdd(trim, boxGeo, -0.5 * l - 0.12, body.yb + 3.1, 0, 0.12, 1.25, 2.9, '#dcd6c4');
          // Exhaust tips.
          for (const z of [-0.26, 0.26]) policeAdd(bright, S.cylinderLow, -0.5 * l - 0.2, 3.5, z * w, 0.32, 1.1, 0.32, '#9aa1a6', null, 0, 0, Math.PI / 2);
          // Antennas on the roof and trunk.
          for (const [x, y, z, h] of [[g.rb * l + 2.2, g.roof + g.arch + 0.1, -2.0, 3.6], [g.rb * l + 3.4, g.roof + g.arch + 0.1, 1.6, 2.6]]) {
            policeAdd(trim, S.cylinderLow, x, y + h / 2, z, 0.09, h, 0.09, black);
            policeAdd(trim, S.cylinderLow, x, y + 0.08, z, 0.35, 0.16, 0.35, black);
          }
          if (body.kind === 'sedan') policeAdd(trim, S.cylinderLow, -0.45 * l, topAt(-0.45 * l) + 1.6, -w * 0.28, 0.08, 3.2, 0.08, black);
          // Spotlight on the driver's A-pillar.
          const spot = glassPoint(g, l, w, 'side', 1, 0.08, -1);
          policeAdd(bright, S.cylinder, spot[0] - 0.4, spot[1] + 0.35, spot[2] - 0.55, 0.52, 1.5, 0.52, '#c9cfd3', null, 0, 0, Math.PI / 2);
          policeAdd(bright, S.disc, spot[0] + 0.36, spot[1] + 0.35, spot[2] - 0.55, 0.44, 0.44, 1, '#eef2f4', null, 0, Math.PI / 2, 0);
          policeAdd(trim, S.cylinderLow, spot[0] - 0.4, spot[1] - 0.2, spot[2] - 0.3, 0.12, 1.1, 0.12, black);
          // Running lights (channel 7): LED strips over the headlamps, amber side markers.
          const [hx, hy, hz] = body.head;
          for (const side of [-1, 1]) {
            light(lights, boxGeo, hx * l + 0.1, hy + 0.62, side * hz * w, 0.5, 0.16, w * 0.2, '#fdf6ea', 7);
            light(lights, boxGeo, 0.44 * l, body.yb + 2.6, side * (halfAt(0.44 * l, body.yb + 2.6) + 0.03), 1.1, 0.35, 0.1, POLICE_AMBER, 7);
          }
          if (marked) policeMarkedEquipment();
          else policeUnmarkedEquipment();
          // Roof number over the rear of the roof panel, behind the lightbar.
          const numberFront = marked ? kit.lightbarX - kit.lightbarDepth / 2 - 0.5 : g.rf * l - 1,
            numberRear = g.rb * l + (body.kind === 'suv' ? 1.6 : 0.6);
          kit.roofDecal = {
            x: (numberFront + numberRear) / 2,
            y: g.roof + 0.14 + g.arch + 0.03,
            length: numberFront - numberRear,
            width: 2 * g.wt * w * 0.84,
            lift: (x, z) => -g.arch * Math.min(1, (z / (g.wt * w)) ** 2),
          };
          if (look.unmarked) kit.roofDecal = null;
        } else policeBearcatEquipment();
        function policeMarkedEquipment() {
          // ---- Low-profile LED lightbar: red segments left, blue right, white takedowns in the middle, alley lights at the ends.
          const length = 2 * g.wt * w * 0.97,
            x = g.rf * l - (body.kind === 'suv' ? 2.6 : 1.9),
            roofTop = g.roof + 0.14 + g.arch,
            y = roofTop + 0.8;
          kit.lightbarX = x;
          kit.lightbarDepth = 3.1;
          policeAdd(trim, roundedBar(length, 0.8, 3.1, 0.36), x, y - 0.14, 0, 1, 1, 1, '#15171a');
          for (const z of [-length * 0.36, length * 0.36]) policeAdd(trim, boxGeo, x, roofTop + 0.18, z, 1.5, 0.5, 0.5, black);
          const segments = [
              [POLICE_RED, 0],
              [POLICE_RED, 0],
              [POLICE_RED, 1],
              [POLICE_WHITE, 4],
              [POLICE_WHITE, 4],
              [POLICE_BLUE, 2],
              [POLICE_BLUE, 3],
              [POLICE_BLUE, 3],
            ],
            seg = (length * 0.97) / segments.length;
          segments.forEach(([color, channel], i) => {
            const z = -length * 0.485 + seg * (i + 0.5),
              lens = roundedBar(seg * 0.94, 0.62, 2.8, 0.26);
            light(lights, lens, x, y + 0.26, z, 1, 1, 1, color, channel);
            if (color !== POLICE_WHITE) policeAdd(i < 3 ? beaconLeft : beaconRight, lens, x, y + 0.26, z, 1, 1, 1, color);
          });
          for (const side of [-1, 1]) light(lights, boxGeo, x, y + 0.05, side * (length / 2 + 0.03), 1.0, 0.36, 0.12, POLICE_WHITE, 4);
          anchor(x, y + 0.7, -length * 0.3, 'red', 22, [0, 1]);
          anchor(x, y + 0.7, length * 0.3, 'blue', 22, [2, 3]);
          anchor(x + 1.2, y + 0.3, 0, 'white', 12, [4], 0.45);
          // ---- Push bar: two uprights, two cross bars, rubber pads, red and blue LEDs.
          const nose = 0.5 * l,
            px = nose + 0.55,
            top = topAt(nose) + 0.9;
          for (const side of [-1, 1]) {
            const z = side * w * 0.19;
            policeAdd(trim, roundedBar(0.9, top - 3.6, 0.8, 0.2), px, (top + 3.6) / 2, z, 1, 1, 1, black, null, 0, Math.PI / 2, 0);
            policeAdd(trim, boxGeo, px + 0.42, (top + 3.6) / 2, z, 0.12, top - 4.4, 0.62, '#26292d');
            light(lights, boxGeo, px + 0.5, top - 1.3, z, 0.1, 1.2, 0.5, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
            policeBeam(trim, boxGeo, [px - 0.3, 5.2, z], [nose - 2.2, 5.2, z], 0.5, 0.5, black);
            anchor(px + 0.6, top - 1.3, z, side < 0 ? 'red' : 'blue', 11, [side < 0 ? 5 : 6], 0.8);
          }
          for (const y of [top - 0.35, 5.4]) policeAdd(trim, roundedBar(w * 0.46, 0.55, 0.6, 0.25), px + 0.05, y, 0, 1, 1, 1, black);
          // Grille LEDs.
          const grilleY = topAt(nose - 0.6) - 1.25;
          for (const side of [-1, 1]) light(lights, boxGeo, nose - 0.02, grilleY, side * w * 0.1, 0.12, 0.55, 0.9, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
          // Rear window light bar along the top of the rear glass.
          const rearTop = glassPoint(g, l, w, 'rear', 0, 0.86);
          for (const side of [-1, 1]) {
            light(lights, boxGeo, rearTop[0] - 0.12, rearTop[1] - 0.1, side * g.wt * w * 0.45, 0.14, 0.4, g.wt * w * 0.7, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6, 0, 0, 0);
            anchor(rearTop[0] - 0.4, rearTop[1], side * g.wt * w * 0.45, side < 0 ? 'red' : 'blue', 12, [side < 0 ? 5 : 6], 0.7);
          }
        }
        function policeUnmarkedEquipment() {
          // Dash light behind the top of the windscreen, grille, rear deck and mirror LEDs.
          const dash = [
            [-0.62, POLICE_RED, 0],
            [-0.3, POLICE_RED, 1],
            [0.3, POLICE_BLUE, 2],
            [0.62, POLICE_BLUE, 3],
          ];
          for (const [s, color, channel] of dash) {
            const p = glassPoint(g, l, w, 'front', s, 0.9),
              q = glassPoint(g, l, w, 'front', s, 0.8);
            const nx = p[1] - q[1],
              ny = q[0] - p[0],
              n = Math.hypot(nx, ny);
            policeAdd(lights, boxGeo, p[0] + (nx / n) * 0.07, p[1] + (ny / n) * 0.07, p[2], 0.14, 0.45, 1.5, color, { channel }, 0, 0, Math.atan2(ny, nx));
            policeAdd(s < 0 ? beaconLeft : beaconRight, boxGeo, p[0] + 0.1, p[1] + 0.1, p[2], 0.3, 0.5, 1.5, color);
          }
          anchor(glassPoint(g, l, w, 'front', -0.45, 0.9)[0], g.roof - 0.4, -2.2, 'red', 12, [0, 1], 0.8);
          anchor(glassPoint(g, l, w, 'front', 0.45, 0.9)[0], g.roof - 0.4, 2.2, 'blue', 12, [2, 3], 0.8);
          const nose = 0.5 * l,
            grilleY = topAt(nose - 0.6) - 1.25;
          for (const side of [-1, 1]) {
            light(lights, boxGeo, nose - 0.02, grilleY, side * w * 0.11, 0.12, 0.5, 1.2, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
            anchor(nose + 0.4, grilleY, side * w * 0.11, side < 0 ? 'red' : 'blue', 10, [side < 0 ? 5 : 6], 0.8);
            const deck = glassPoint(g, l, w, 'rear', side * 0.45, 0.12);
            light(lights, boxGeo, deck[0] - 0.1, deck[1], deck[2], 0.14, 0.4, 2.4, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
            anchor(deck[0] - 0.4, deck[1], deck[2], side < 0 ? 'red' : 'blue', 10, [side < 0 ? 5 : 6], 0.7);
          }
        }
        function policeBearcatEquipment() {
          const roofY = 23,
            nose = 0.5 * l,
            half = w / 2;
          // Roof: hatch and turret ring with three shield plates, rails, scene lights.
          const hx = -0.13 * l;
          policeAdd(trim, S.cylinder, hx, roofY + 0.45, 0, 3.3, 0.9, 3.3, '#1b2027');
          policeAdd(paint, S.cylinder, hx, roofY + 1.0, 0, 2.7, 0.3, 2.7, '#ffffff', swatch('roof'));
          policeAdd(trim, boxGeo, hx - 2.4, roofY + 1.15, 0, 0.6, 0.35, 1.8, '#20262e');
          for (const a of [-0.9, 0, 0.9]) {
            const cx = hx + Math.cos(a) * 3.6,
              cz = Math.sin(a) * 3.6;
            policeAdd(paint, boxGeo, cx, roofY + 2.2, cz, 0.45, 3.2, 3.0, '#ffffff', swatch('roof'), 0, -a, 0);
            policeAdd(trim, boxGeo, cx + Math.cos(a) * 0.25, roofY + 2.8, cz + Math.sin(a) * 0.25, 0.1, 0.5, 1.0, '#0a0c10', null, 0, -a, 0);
          }
          for (const side of [-1, 1]) {
            policeAdd(trim, roundedBar(0.56 * l, 0.35, 0.4, 0.12), -0.2 * l, roofY + 0.55, side * half * 0.86, 1, 1, 1, '#1b2027', null, 0, Math.PI / 2, 0);
            for (const t of [0, 0.5, 1]) policeAdd(trim, boxGeo, lerpNumber(-0.48 * l, 0.08 * l, t), roofY + 0.25, side * half * 0.86, 0.5, 0.5, 0.4, '#1b2027');
            // Scene lights on the roof corners, white, facing out.
            policeAdd(trim, boxGeo, -0.47 * l, roofY + 0.7, side * half * 0.92, 1.2, 0.9, 0.5, '#1b2027');
            light(lights, boxGeo, -0.47 * l, roofY + 0.7, side * (half * 0.92 + 0.28), 0.9, 0.6, 0.06, POLICE_WHITE, 4);
          }
          // Lightbar across the front of the roof.
          const length = w * 0.84,
            x = 0.085 * l,
            y = roofY + 0.85;
          kit.lightbarX = x;
          policeAdd(trim, roundedBar(length, 0.8, 2.4, 0.3), x, y - 0.1, 0, 1, 1, 1, '#15171a');
          const segments = [POLICE_RED, POLICE_RED, POLICE_RED, POLICE_WHITE, POLICE_WHITE, POLICE_BLUE, POLICE_BLUE, POLICE_BLUE],
            channels = [0, 0, 1, 4, 4, 2, 3, 3],
            seg = (length * 0.97) / 8;
          segments.forEach((color, i) => {
            const z = -length * 0.485 + seg * (i + 0.5),
              lens = roundedBar(seg * 0.93, 0.55, 2.1, 0.2);
            light(lights, lens, x, y + 0.25, z, 1, 1, 1, color, channels[i]);
            if (color !== POLICE_WHITE) policeAdd(i < 3 ? beaconLeft : beaconRight, lens, x, y + 0.25, z, 1, 1, 1, color);
          });
          anchor(x, y + 0.8, -length * 0.3, 'red', 26, [0, 1]);
          anchor(x, y + 0.8, length * 0.3, 'blue', 26, [2, 3]);
          anchor(x + 1.3, y + 0.3, 0, 'white', 18, [4], 0.55);
          // Rear light bar over the doors.
          for (const side of [-1, 1]) {
            light(lights, boxGeo, -0.5 * l - 0.08, 22.3, side * half * 0.62, 0.14, 0.6, half * 0.55, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
            anchor(-0.5 * l - 0.6, 22.3, side * half * 0.62, side < 0 ? 'red' : 'blue', 14, [side < 0 ? 5 : 6], 0.7);
          }
          // Window frames round the armoured glass, gun ports, grab rails and steps.
          for (const side of [-1, 1]) {
            const z = side * (half + 0.12);
            for (const [x0, x1] of [[0.02, 0.118], [-0.085, -0.005]]) {
              for (const yy of [15.0, 20.6]) policeAdd(trim, boxGeo, ((x0 + x1) / 2) * l, yy, z, (x1 - x0) * l + 0.8, 0.45, 0.2, '#0c0f14');
              for (const xx of [x0, x1]) policeAdd(trim, boxGeo, xx * l, 17.8, z, 0.45, 6.0, 0.2, '#0c0f14');
            }
            for (const xx of [-0.2, -0.3, -0.4]) {
              policeAdd(trim, S.cylinderLow, xx * l, 16.5, side * (half + 0.08), 0.75, 0.25, 0.75, '#0c0f14', null, Math.PI / 2, 0, 0);
              policeAdd(trim, S.cylinderLow, xx * l, 16.5, side * (half + 0.2), 0.35, 0.1, 0.35, '#030304', null, Math.PI / 2, 0, 0);
            }
            policeBeam(trim, boxGeo, [-0.46 * l, 19.8, side * (half + 0.45)], [-0.14 * l, 19.8, side * (half + 0.45)], 0.22, 0.22, '#2a3038');
            policeAdd(trim, boxGeo, 0.0 * l, 4.4, side * (half + 0.4), 0.26 * l, 0.5, 1.2, '#1c2128');
            // Front flares over the narrower bonnet and a big truck mirror.
            policeAdd(trim, roundedBar(0.24 * l, 0.8, 1.4, 0.3), 0.3 * l, 11.6, side * (half * 0.93 + 0.2), 1, 1, 1, '#161a20', null, 0, Math.PI / 2, 0);
            policeAdd(trim, roundedBar(0.7, 3.0, 1.8, 0.25), 0.16 * l, 17.0, side * (half + 2.0), 1, 1, 1, '#161a20');
            policeBeam(trim, boxGeo, [0.16 * l, 16.0, side * half], [0.16 * l, 16.4, side * (half + 1.3)], 0.3, 0.3, '#2a3038');
          }
          // Windscreen centre post.
          const [, topFront] = profileAt(body.profile, 0.135),
            [, footFront] = profileAt(body.profile, 0.205);
          policeBeam(trim, boxGeo, [0.205 * l + 0.1, footFront + 0.6, 0], [0.135 * l + 0.1, topFront - 0.6, 0], 1.1, 0.3, '#0c0f14', null, [0, 0, 1]);
          // Ram bumper: a heavy plate, two uprights, a winch and tow hooks.
          policeAdd(trim, roundedBar(w * 0.9, 3.4, 1.6, 0.3), nose + 0.9, 7.2, 0, 1, 1, 1, '#12161b');
          for (const side of [-1, 1]) {
            policeAdd(trim, roundedBar(1.1, 5.6, 1.2, 0.25), nose + 1.1, 9.5, side * w * 0.26, 1, 1, 1, '#12161b');
            policeAdd(bright, S.cylinderLow, nose + 1.6, 6.6, side * w * 0.33, 0.5, 1.0, 0.5, '#8d949a', null, Math.PI / 2, 0, 0);
          }
          policeAdd(trim, roundedBar(w * 0.46, 0.7, 0.9, 0.25), nose + 1.2, 11.8, 0, 1, 1, 1, '#12161b');
          policeAdd(trim, S.cylinder, nose + 0.7, 8.2, 0, 1.0, w * 0.34, 1.0, '#2b3036', null, Math.PI / 2, 0, 0);
          // Grille and its LEDs; push-bar LEDs.
          policeAdd(trim, boxGeo, nose - 0.1, 10.4, 0, 0.3, 2.2, w * 0.5, '#0b0d10');
          for (const side of [-1, 1]) {
            light(lights, boxGeo, nose + 0.08, 10.4, side * w * 0.12, 0.1, 0.6, 1.2, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
            light(lights, boxGeo, nose + 1.72, 10.6, side * w * 0.26, 0.1, 1.5, 0.6, side < 0 ? POLICE_RED : POLICE_BLUE, side < 0 ? 5 : 6);
            anchor(nose + 2.1, 10.6, side * w * 0.26, side < 0 ? 'red' : 'blue', 12, [side < 0 ? 5 : 6], 0.8);
            light(lights, boxGeo, body.head[0] * l + 0.05, body.head[1] + 1.3, side * body.head[2] * w, 0.4, 0.2, 2.4, '#fdf6ea', 7);
          }
          // Antennas.
          for (const [ax, az, ah] of [[-0.4, -0.5, 5], [-0.36, -0.5, 4], [-0.42, 0.55, 4.5]]) policeAdd(trim, S.cylinderLow, ax * l, roofY + ah / 2, az * half, 0.1, ah, 0.1, '#0a0b0d');
          kit.roofDecal = { x: -0.33 * l, y: roofY + 0.04, length: 0.3 * l, width: w * 0.7, lift: null };
          // Rear doors hinged at the outer edges (their meshes are built per model).
          kit.doorHeight = 14;
          kit.doorY = 12.9;
        }
        kit.paint = policeGeometry(paint);
        kit.trim = policeGeometry(trim);
        kit.bright = bright.count ? policeGeometry(bright) : null;
        kit.lights = policeGeometry(lights, { channels: true });
        kit.beaconLeft = beaconLeft.count ? policeGeometry(beaconLeft) : null;
        kit.beaconRight = beaconRight.count ? policeGeometry(beaconRight) : null;
        policeKits.set(key, kit);
        return kit;
      }
      // Steel wheels with a chrome dog-dish hubcap (marked cars), black five-spoke
      // alloys (unmarked), a heavy eight-stud truck wheel (the BearCat).
      const policeRims = new Map();
      function policeRimGeometry(style, side, wheel) {
        const key = [style, side, wheel.r, wheel.width].join(':');
        if (policeRims.has(key)) return policeRims.get(key);
        const S = policeShapeKit(),
          set = policeSet(),
          r = wheel.r,
          face = side * (wheel.width / 2),
          across = Math.PI / 2;
        policeAdd(set, S.cylinder, 0, 0, face - side * 0.05, r * 0.72, 0.22, r * 0.72, '#202327', null, across, 0, 0);
        if (style === 'steel') {
          policeAdd(set, S.cylinder, 0, 0, face + side * 0.02, r * 0.64, 0.12, r * 0.64, '#16181b', null, across, 0, 0);
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            policeAdd(set, S.cylinderLow, Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46, face + side * 0.09, r * 0.07, 0.05, r * 0.07, '#050506', null, across, 0, 0);
          }
          policeAdd(set, S.dome, 0, 0, face + side * 0.08, r * 0.37, 0.42, r * 0.37, '#dfe4e7', null, side * across, 0, 0);
        } else if (style === 'alloy') {
          policeAdd(set, S.cylinder, 0, 0, face + side * 0.02, r * 0.66, 0.1, r * 0.66, '#101113', null, across, 0, 0);
          for (let i = 0; i < 5; i++)
            policeAdd(set, boxGeo, 0, 0, face + side * 0.1, r * 0.13, r * 1.26, 0.14, '#3a3e44', null, 0, 0, (i * Math.PI) / 5);
          policeAdd(set, S.cylinderLow, 0, 0, face + side * 0.16, r * 0.17, 0.1, r * 0.17, '#1a1c1f', null, across, 0, 0);
        } else {
          policeAdd(set, S.cylinder, 0, 0, face + side * 0.02, r * 0.64, 0.14, r * 0.64, '#1d2126', null, across, 0, 0);
          policeAdd(set, S.cylinder, 0, 0, face + side * 0.12, r * 0.3, 0.3, r * 0.3, '#3a4047', null, across, 0, 0);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            policeAdd(set, S.cylinderLow, Math.cos(a) * r * 0.22, Math.sin(a) * r * 0.22, face + side * 0.3, r * 0.04, 0.22, r * 0.04, '#9aa1a8', null, across, 0, 0);
          }
        }
        const geo = policeGeometry(set);
        policeRims.set(key, geo);
        return geo;
      }
      // ---- The model -----------------------------------------------------------------------
      /*
       * Builds a police vehicle with the same contract as makeVehicle's cars
       * (render3d.js): shell / cabin for the crumple and the panes, hood, bumpers,
       * wheels, lamps (headLeft, headRight, tailLeft, tailRight), nightLights in
       * lampOut order, dims for the door and trunk panels, rearDoors for the SWAT
       * team. `police` marks it for animatePoliceVehicle().
       */
      function makePoliceVehicle(vehicle, look) {
        claimPoliceResources();
        // The bodies are authored for a drawn scale of 0.8 (the patrol type's);
        // the agents' 'suv' and the SWAT 'van' are real-size types (cars3d.js), so
        // the scale is the model's own (`drawScale`, render3d.js makeVehicle).
        const spec = vehicleSpec(vehicle),
          l = spec.l / POLICE_DRAW_SCALE,
          w = (spec.w / POLICE_DRAW_SCALE) * 0.87,
          body = POLICE_BODIES[look.body],
          kit = policeKit(look, body, l, w),
          g = body.glass,
          group = new Three.Group(),
          bodyGroup = new Three.Group();
        group.add(bodyGroup);
        scene.add(group);
        const livery = look.unmarked ? null : policeLiveryTexture(look.livery, body, l, w),
          finish = look.unmarked ? { roughness: 0.3, metalness: 0.45 } : { roughness: 0.3, metalness: 0.06 },
          paint = new Three.MeshPhysicalMaterial({
            color: look.paint,
            map: livery,
            emissive: '#000000',
            emissiveMap: livery,
            roughness: finish.roughness,
            metalness: finish.metalness,
            clearcoat: 1,
            clearcoatRoughness: 0.06,
            envMapIntensity: 1,
          });
        const shell = mesh(kit.shell, paint, bodyGroup, 0, 0, 0),
          cabin = mesh(kit.cabin, policeGlass, bodyGroup, 0, 0, 0),
          hood = mesh(kit.hood, paint, bodyGroup, l * 0.34, body.h + 0.05, 0, l * 0.25, 0.4, w * (body.kind === 'bearcat' ? 0.82 : 0.7));
        hood.rotation.z = body.hoodTilt || 0;
        const panels = mesh(kit.paint, paint, bodyGroup, 0, 0, 0),
          trim = mesh(kit.trim, policeTrimMaterial, bodyGroup, 0, 0, 0);
        if (kit.bright) mesh(kit.bright, policeBrightMaterial, bodyGroup, 0, 0, 0);
        const lightMaterial = policeLightMaterial(),
          lights = mesh(kit.lights, lightMaterial, bodyGroup, 0, 0, 0);
        lights.castShadow = lights.receiveShadow = false;
        if (!look.unmarked) {
          const decals = mesh(policeDecalGeometry(look, body, l, w, kit), policeGlyphs().material, bodyGroup, 0, 0, 0);
          decals.castShadow = false;
        }
        const bumpers = body.bumpers.map(([x, y, sx, sy, sz]) => box(bodyGroup, x * l, y, 0, sx, sy, sz * w, policeBumperMaterial));
        const wheels = [];
        for (const side of [-1, 1])
          for (const fx of [-body.wheel.x, body.wheel.x]) {
            const wheel = new Three.Group(),
              r = body.wheel.r;
            wheel.position.set(fx * l, r, side * w * body.wheel.z);
            bodyGroup.add(wheel);
            wheels.push({ wheel, side });
            // The tyre stays the wheel's first child (hidden on a burnt wreck).
            const tire = mesh(wheelGeo, rubber, wheel, 0, 0, 0, r, body.wheel.width, r);
            tire.rotation.x = Math.PI / 2;
            mesh(kit.rims[side < 0 ? 0 : 1], policeWheelMaterial, wheel, 0, 0, 0);
          }
        const lamps = [],
          nightLights = [],
          [hx, hy, hz, hsx, hsy, hsz] = body.head,
          [tx, ty, tz, tsx, tsy, tsz] = body.tail;
        for (const side of [-1, 1]) {
          lamps.push(
            { mesh: box(bodyGroup, hx * l, hy, side * hz * w, hsx, hsy, hsz * w, warmLamp), key: side < 0 ? 'headLeft' : 'headRight', lit: warmLamp },
            { mesh: box(bodyGroup, tx * l, ty, side * tz * w, tsx, tsy, tsz * w, tailLamp), key: side < 0 ? 'tailLeft' : 'tailRight', lit: tailLamp },
          );
          // Head, tail per side: the order lampOut expects (damage3d.js).
          nightLights.push(halo(bodyGroup, hx * l + 0.5, hy, side * hz * w, 11, '#ffe9bd'), halo(bodyGroup, tx * l - 0.5, ty, side * tz * w, 7, '#ff5a44'));
        }
        const policeHalos = kit.anchors.map((a) => {
          const sprite = new Three.Sprite(policeHaloMaterials[a.color]);
          sprite.position.set(a.x, a.y, a.z);
          sprite.scale.set(a.size, a.size, 1);
          sprite.visible = false;
          bodyGroup.add(sprite);
          return { sprite, channels: a.channels, strength: a.strength };
        });
        const rearDoors = body.kind === 'bearcat' ? policeRearDoors(bodyGroup, l, w, kit, paint, look) : null;
        const bumperOrigins = bumpers.map((b) => b.position.clone());
        const wiperHost = {};
        if (body.kind === 'bearcat') addWipers(wiperHost, bodyGroup, 0.205 * l, 13.6, 0.16 * l, 19.5, w * 0.4);
        else addWipers(wiperHost, bodyGroup, g.xf * l, g.base + 0.4, lerpNumber(g.xf, g.rf, 0.55) * l, lerpNumber(g.base, g.roof, 0.55), g.wb * w * 0.92);
        const livePaint = livery ? policeImpostorPaint(livery) : null;
        return {
          wipers: wiperHost.wipers,
          group,
          body: bodyGroup,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          car: true,
          police: true,
          drawScale: POLICE_DRAW_SCALE,
          look,
          dims: { l, w, h: body.h, roof: g.roof, van: body.kind !== 'sedan' },
          shell,
          shellBase: shell.geometry.attributes.position.array,
          cabin,
          cabinBase: cabin.geometry.attributes.position.array,
          wheels,
          bumpers,
          bumperOrigins,
          hood,
          hoodBaseY: body.h + 0.05,
          lamps,
          damageVersion: -1,
          nightLights,
          rearDoors,
          // damage3d.js hooks: livery restored after the soot, satin (not metallic)
          // paint, black plastic bumpers, door and trunk panels in the livery's colours.
          liveryMap: livery,
          liveryColor: look.paint,
          finish,
          bumperMaterial: policeBumperMaterial,
          glass: policeGlass,
          panelGeometry: kit.door,
          trunkGeometry: kit.trunk,
          lightMaterial,
          levels: lightMaterial.uniforms.levels.value,
          policeHalos,
          wigwag: 0,
          reflective: -1,
          impostorParts: [
            { mesh: shell, material: livePaint || null, tint: true, shadow: true },
            { mesh: cabin, material: policeGlass, shadow: true },
            { mesh: hood, material: livePaint || null, tint: true },
            { mesh: panels, material: livePaint || null, tint: true },
            { mesh: trim, material: policeTrimMaterial },
            ...(kit.beaconLeft ? [{ geometry: kit.beaconLeft, beacon: 'left' }, { geometry: kit.beaconRight, beacon: 'right' }] : []),
          ],
        };
      }
      // The BearCat's rear doors: armour plate, a small window, hinges, SWAT.
      function policeRearDoors(bodyGroup, l, w, kit, paint, look) {
        const half = (w / 2) * 0.97,
          doors = [],
          frame = policeSet();
        // One door's trim, built once per size (the right door is the left turned round).
        const S = policeShapeKit();
        policeAdd(frame, boxGeo, -0.45, 2.6, 0, 0.12, 3.6, half * 0.55, '#0c0f14');
        policeAdd(frame, boxGeo, -0.5, 2.6, 0, 0.1, 3.0, half * 0.45, '#111b27');
        for (const y of [-5.0, 4.6]) policeAdd(frame, S.cylinderLow, -0.1, y, -half * 0.48, 0.35, 1.4, 0.35, '#2a3038');
        policeAdd(frame, boxGeo, -0.45, -1.5, half * 0.3, 0.3, 0.3, 1.8, '#9aa1a8');
        const trimGeo = policeGeometry(frame),
          text = policeSet();
        decalText(text, 'SWAT', [-0.46, -3.6, 0], [0, 0, 1], [0, 1, 0], 2.2, '#eef0ec');
        const textGeo = policeGeometry(text);
        for (const s of [-1, 1]) {
          const pivot = new Three.Group();
          pivot.position.set(-0.5 * l - 0.4, kit.doorY, s * half);
          bodyGroup.add(pivot);
          const panel = mesh(kit.door, paint, pivot, 0, 0, (-s * half) / 2, 0.7, kit.doorHeight, half * 0.98);
          panel.castShadow = true;
          const inner = new Three.Group();
          inner.position.set(0, 0, (-s * half) / 2);
          // The trim was built for the left door; the right one is its mirror image.
          if (s > 0) inner.scale.z = -1;
          pivot.add(inner);
          mesh(trimGeo, policeTrimMaterial, inner, 0, 0, 0).castShadow = false;
          const words = mesh(textGeo, policeGlyphs().material, pivot, 0, 0, (-s * half) / 2);
          words.castShadow = false;
          doors.push({ pivot, side: s });
        }
        return doors;
      }
      // ---- Per frame -----------------------------------------------------------------------
      /*
       * Flash pattern, wig-wag headlamps, night halos and the livery's reflective
       * glow, once a frame for each police model in view (render3d.js vehicle pass).
       */
      function animatePoliceVehicle(c, m) {
        const lampsOn = vehicleLampAmount(),
          mode = policeLightLevels(c, m.levels, gameTime),
          levels = m.levels;
        policeLightGain.value = 3.4 + lampsOn * 2.6;
        levels[7] = c.hp > 0 ? 0.35 + lampsOn * 0.65 : 0;
        // Wig-wag: the headlamps alternate while running hot.
        const wig = mode === 1 ? ((gameTime + c.id * 0.13) * 2.6) % 1 < 0.5 ? 1 : 2 : 0;
        if (wig || m.wigwag) {
          policeWigwagLamp.color.setScalar(policeLightGain.value * 0.55);
          const lights = c.damage?.lights;
          for (const lamp of m.lamps)
            if (lamp.lit === warmLamp && !lights?.[lamp.key])
              lamp.mesh.material = !wig ? warmLamp : (lamp.key === 'headLeft') === (wig === 1) ? policeWigwagLamp : policeLampOff;
          m.wigwag = wig;
        }
        // Halos over the lit segments: faint by day, blooming at night.
        if (mode) {
          const scale = 0.25 + lampsOn * 0.5;
          for (const h of m.policeHalos) {
            let level = 0;
            for (const k of h.channels) level = Math.max(level, levels[k]);
            if (level > 0.05) queueVehicleHalo(h.sprite, level * h.strength * scale);
          }
        }
        // Reflective livery: the white panels catch light at night (the burnt
        // shell's embers own the emissive while it is charred).
        if (m.liveryMap) {
          const glow = m.charred ? -1 : Math.round(lampsOn * 20) / 20;
          if (m.reflective !== glow) {
            m.reflective = glow;
            if (glow >= 0) m.paint.emissive.setScalar(glow * 0.07);
          }
        }
      }
      // The pools of red and blue light a flashing car throws on the road at night
      // (lighting3d.js); returns 0 for any other vehicle.
      function policeRoadGlow(m, side) {
        if (!m?.police) return 0;
        const l = m.levels;
        return side < 0 ? Math.max(l[0], l[1], l[5]) : Math.max(l[2], l[3], l[6]);
      }
      // Beacon levels for the body impostors (no model needed): left, right.
      const policeScratchLevels = new Float32Array(8),
        policeBeacon = { left: 0, right: 0 };
      function policeBeaconLevels(c) {
        policeLightLevels(c, policeScratchLevels, gameTime);
        const l = policeScratchLevels;
        policeBeacon.left = Math.max(l[0], l[1]);
        policeBeacon.right = Math.max(l[2], l[3]);
        return policeBeacon;
      }
      // END SUBSYSTEM: src/police3d.js
