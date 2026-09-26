      // BEGIN SUBSYSTEM: src/cars3d.js — Civilian car models
      /**
       * Civilian car models
       * Source: src/cars3d.js
       * Scope: createCityRenderer() closure (included after police3d.js, whose
       * lofting, glasshouse and livery-frame helpers it shares, and before
       * makeVehicle, which hands every civilian car type in CAR_BODIES here).
       *
       * Every car is built at its real size (VEHICLE_DEFINITIONS `l`, `w`, no
       * modelScale): 8 map units to the metre, the numbers below in metres.
       *
       * BODIES (CAR_BODIES, one per vehicle type) are real archetypes:
       *  - sedan REGENT: a mid-size saloon (Camry / Accord): swept LED lamps, a
       *    wide black grille, a fastback-ish roof, a light bar across the tail;
       *  - taxi CITY CAB: a boxy full-size cab (Crown Victoria), taxi yellow with
       *    a checker band, TAXI doors, a medallion number and the lit roof sign;
       *  - coupe VOLT COUPE: a compact electric fastback (Model 3 / Polestar 2):
       *    no grille, a glass roof, flush handles, aero wheels;
       *  - muscle DUKE V8: a Challenger-style muscle car: long hood with a power
       *    bulge and twin stripes, quad round lamps with halo rings, racetrack tails;
       *  - sport COMET GT: a rear-engined 911-style coupe: round lamps, wide hips,
       *    engine-lid slats, a ducktail and a full-width light bar;
       *  - roadster SOLSTICE SPIDER: an MX-5 / Solstice two-seater, top down:
       *    cockpit, bucket seats, roll hoops, a low screen;
       *  - rally KODIAK RS: a WRX / Focus RS rally hatch: scoop, wing, flares,
       *    a rally light pod and gold wheels;
       *  - hotrod HELLFIRE CUSTOM: a chopped '32 three-window coupe: exposed
       *    blown V8 and zoomies, cycle-free front wheels, whitewalls, flames;
       *  - supercar V12 TEMPEST: a front-mid V12 grand tourer (812 / DBS);
       *  - luxury MONARCH V12: a Phantom-style limousine saloon: the temple
       *    grille, chrome everywhere, coach doors;
       *  - limousine SOVEREIGN STRETCH: a stretched Town Car;
       *  - suv RANGER 4X4: a Range Rover style SUV with the floating black roof;
       *  - pickup WORKHORSE: a crew-cab F-150: open bed, chrome bar grille;
       *  - van MULE VAN: a high-roof Transit / Sprinter panel van;
       *  - chevette CHEVETTE Z06: a C8 Z06-style mid-engined supercar;
       *  - brutini BRUTINI SVJ: an Aventador SVJ-style V12 wedge: Y lamps,
       *    hexagons, a huge wing;
       *  - cavalino CAVALINO 458: a 458 Italia-style berlinetta: the smile,
       *    boomerang lamps, round tails, triple exhaust.
       *
       * A body is lofted like the police cars' (police3d.js POLICE SHELL) but its
       * cross-section may change along the car (`sections`) and its underside
       * rises at the overhangs (profile's fourth number); the glasshouse is the
       * same five-pane contract (PANE_ORDER) with a shorter side glass
       * (`sideFrom`, where a buttress or intake takes over) or an open top.
       * Everything else is built into four merged sets per body and size:
       *  - paint: panels in the car's paint (roof, pillars, mirror caps, lips,
       *    spoilers, bed walls), sampling the livery;
       *  - trim: every other part in one draw, vertex-coloured, each vertex
       *    carrying its own roughness and metalness (`finish`) and a cell of the
       *    shared TRIM ATLAS (honeycomb, slats, mesh, carbon, louvres, plates),
       *    so gloss black, satin plastic, chrome, carbon and rubber are one mesh;
       *  - drl: the daytime running lights and other LED graphics, lit while the
       *    car is driven (two shared materials swapped, no per-car material);
       *  - the four lamps (headLeft, headRight, tailLeft, tailRight), each its
       *    own mesh with the lamp contract (damage3d.js: broken lamps go dark,
       *    tail lamps swap to brakeLamp while braking, nightLights in head, tail
       *    pairs per side).
       * Tyres are a shared lathe with rounded shoulders (knobbly for the dirt
       * bike, whitewalls for the rod); rims are merged per style with the brake
       * disc; calipers sit in the trim so they do not spin with the wheel.
       *
       * LIVERY: one canvas per body (carLiveryTexture), painted in the shell's
       * UV space with the police livery frame. It is a decal layer over the
       * paint: transparent where the car shows its paint, opaque for shut
       * lines, stripes, cladding, checkers and lettering (premultiplied alpha,
       * composited in the paint shader: carPaintMaterial). Top surfaces (hood,
       * roof panel) sample it by a top projection so stripes run over them.
       * The paint is clear-coated; bright solid colours get a solid gloss,
       * darker and neutral ones a metallic flake (carFinish).
       *
       * Draw calls: shell, glass, hood, paint panels, trim, drl, four lamps, two
       * bumpers and four wheels (tyre + rim): about 21, against ~40 for the old
       * box-built cars. Zoomed out the cars pool per type (flight-view3d.js
       * BODY IMPOSTORS: shell, glass, hood, panels and trim, tinted per car).
       */
      const CAR_M = UNITS_PER_METRE,
        // Swatches along the livery's bottom band (police3d.js POLICE_SWATCH_BAND).
        CAR_SWATCH = { paint: 0, roof: 1, black: 2, lower: 3, accent: 4, silver: 5, dark: 6, white: 7 },
        // Finishes, [roughness, metalness], for the trim set.
        FINISH = {
          satin: [0.62, 0.12],
          plastic: [0.72, 0.05],
          gloss: [0.16, 0.2],
          chrome: [0.12, 0.98],
          alloy: [0.3, 0.85],
          rubber: [0.9, 0],
          carbon: [0.28, 0.35],
          lens: [0.06, 0.55],
          paintLike: [0.3, 0.2],
          leather: [0.55, 0.05],
          matte: [0.8, 0.1],
        };
      // ---- TRIM ATLAS ---------------------------------------------------------------
      /*
       * One 512 x 512 canvas of sixteen 128-pixel cells, painted in greys that the
       * trim's vertex colours tint: solid, honeycomb, slats, bars, mesh, carbon,
       * perforated, big hexagons, louvres, knurled tread, checker, lens facets,
       * LED dots, vents, a licence plate and a badge.
       */
      const TRIM_CELL = { solid: 0, honeycomb: 1, slats: 2, bars: 3, mesh: 4, carbon: 5, perforated: 6, hex: 7, louvre: 8, tread: 9, checker: 10, lens: 11, dots: 12, vents: 13, plate: 14, badge: 15 };
      let carTrimAtlasTexture = null;
      function carTrimAtlas() {
        if (carTrimAtlasTexture) return carTrimAtlasTexture;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const g = canvas.getContext('2d'),
          cell = (index, paint) => {
            g.save();
            g.translate((index % 4) * 128, Math.floor(index / 4) * 128);
            g.beginPath();
            g.rect(0, 0, 128, 128);
            g.clip();
            paint(g);
            g.restore();
          };
        cell(TRIM_CELL.solid, (c) => {
          c.fillStyle = '#ffffff';
          c.fillRect(0, 0, 128, 128);
        });
        cell(TRIM_CELL.honeycomb, (c) => {
          c.fillStyle = '#0c0c0c';
          c.fillRect(0, 0, 128, 128);
          c.strokeStyle = '#bdbdbd';
          c.lineWidth = 3.2;
          const r = 8;
          for (let row = -1; row < 11; row++)
            for (let col = -1; col < 10; col++) {
              const x = col * r * 1.5 * 1.155 + 4,
                y = row * r * 1.73 + (col % 2 ? r * 0.87 : 0);
              c.beginPath();
              for (let i = 0; i < 6; i++) {
                const a = (i * Math.PI) / 3;
                c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
              }
              c.closePath();
              c.stroke();
            }
        });
        cell(TRIM_CELL.slats, (c) => {
          c.fillStyle = '#080808';
          c.fillRect(0, 0, 128, 128);
          for (let y = 0; y < 128; y += 16) {
            const gradient = c.createLinearGradient(0, y, 0, y + 10);
            gradient.addColorStop(0, '#f0f0f0');
            gradient.addColorStop(1, '#7a7a7a');
            c.fillStyle = gradient;
            c.fillRect(0, y + 3, 128, 9);
          }
        });
        cell(TRIM_CELL.bars, (c) => {
          c.fillStyle = '#070707';
          c.fillRect(0, 0, 128, 128);
          for (let x = 0; x < 128; x += 12) {
            const gradient = c.createLinearGradient(x, 0, x + 8, 0);
            gradient.addColorStop(0, '#6d6d6d');
            gradient.addColorStop(0.45, '#ffffff');
            gradient.addColorStop(1, '#5a5a5a');
            c.fillStyle = gradient;
            c.fillRect(x + 2, 0, 7, 128);
          }
        });
        cell(TRIM_CELL.mesh, (c) => {
          c.fillStyle = '#090909';
          c.fillRect(0, 0, 128, 128);
          c.strokeStyle = '#c8c8c8';
          c.lineWidth = 2.6;
          for (let i = -128; i < 256; i += 14) {
            c.beginPath();
            c.moveTo(i, 0);
            c.lineTo(i + 128, 128);
            c.moveTo(i + 128, 0);
            c.lineTo(i, 128);
            c.stroke();
          }
        });
        cell(TRIM_CELL.carbon, (c) => {
          for (let y = 0; y < 128; y += 8)
            for (let x = 0; x < 128; x += 8) {
              const k = ((x >> 3) + (y >> 3)) % 4;
              c.fillStyle = ['#505050', '#2e2e2e', '#6a6a6a', '#262626'][k];
              c.fillRect(x, y, 8, 8);
              c.fillStyle = 'rgba(255,255,255,0.08)';
              c.fillRect(x, y, 8, 2);
            }
        });
        cell(TRIM_CELL.perforated, (c) => {
          c.fillStyle = '#9a9a9a';
          c.fillRect(0, 0, 128, 128);
          c.fillStyle = '#050505';
          for (let y = 4; y < 128; y += 9)
            for (let x = (y / 9) % 2 ? 4 : 8.5; x < 128; x += 9) {
              c.beginPath();
              c.arc(x, y, 3, 0, TAU);
              c.fill();
            }
        });
        cell(TRIM_CELL.hex, (c) => {
          c.fillStyle = '#060606';
          c.fillRect(0, 0, 128, 128);
          c.strokeStyle = '#d0d0d0';
          c.lineWidth = 5;
          const r = 20;
          for (let row = -1; row < 5; row++)
            for (let col = -1; col < 5; col++) {
              const x = col * r * 1.5 + 10,
                y = row * r * 1.73 + (col % 2 ? r * 0.87 : 0) + 6;
              c.beginPath();
              for (let i = 0; i < 6; i++) {
                const a = (i * Math.PI) / 3;
                c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
              }
              c.closePath();
              c.stroke();
            }
        });
        cell(TRIM_CELL.louvre, (c) => {
          for (let y = 0; y < 128; y += 16) {
            const gradient = c.createLinearGradient(0, y, 0, y + 16);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.55, '#8c8c8c');
            gradient.addColorStop(0.6, '#050505');
            gradient.addColorStop(1, '#141414');
            c.fillStyle = gradient;
            c.fillRect(0, y, 128, 16);
          }
        });
        cell(TRIM_CELL.tread, (c) => {
          c.fillStyle = '#6c6c6c';
          c.fillRect(0, 0, 128, 128);
          c.fillStyle = '#1b1b1b';
          for (let y = 0; y < 128; y += 16) {
            c.fillRect(0, y, 128, 3);
            for (let x = (y / 16) % 2 ? 0 : 16; x < 128; x += 32) c.fillRect(x, y, 3, 16);
          }
        });
        cell(TRIM_CELL.checker, (c) => {
          for (let y = 0; y < 128; y += 32)
            for (let x = 0; x < 128; x += 32) {
              c.fillStyle = ((x + y) / 32) % 2 ? '#101010' : '#f4f4f4';
              c.fillRect(x, y, 32, 32);
            }
        });
        cell(TRIM_CELL.lens, (c) => {
          const gradient = c.createRadialGradient(64, 64, 4, 64, 64, 90);
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(0.5, '#9c9c9c');
          gradient.addColorStop(1, '#2a2a2a');
          c.fillStyle = gradient;
          c.fillRect(0, 0, 128, 128);
          c.strokeStyle = 'rgba(255,255,255,0.45)';
          c.lineWidth = 2;
          for (let x = 8; x < 128; x += 16) {
            c.beginPath();
            c.moveTo(x, 0);
            c.lineTo(x, 128);
            c.stroke();
          }
        });
        cell(TRIM_CELL.dots, (c) => {
          c.fillStyle = '#101010';
          c.fillRect(0, 0, 128, 128);
          c.fillStyle = '#ffffff';
          for (let y = 8; y < 128; y += 16)
            for (let x = 8; x < 128; x += 16) {
              c.beginPath();
              c.arc(x, y, 4.5, 0, TAU);
              c.fill();
            }
        });
        cell(TRIM_CELL.vents, (c) => {
          c.fillStyle = '#9a9a9a';
          c.fillRect(0, 0, 128, 128);
          c.fillStyle = '#040404';
          for (let y = 10; y < 128; y += 20) c.fillRect(10, y, 108, 9);
        });
        cell(TRIM_CELL.plate, (c) => {
          // A licence plate: pale reflective sheet, dark border and characters.
          c.fillStyle = '#e9e6d6';
          c.fillRect(0, 32, 128, 64);
          c.strokeStyle = '#26303a';
          c.lineWidth = 4;
          c.strokeRect(3, 35, 122, 58);
          c.fillStyle = '#1d2a44';
          c.font = 'bold 34px "Arial Narrow", Arial, sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText('DEC 719', 64, 66);
          c.font = 'bold 10px Arial, sans-serif';
          c.fillStyle = '#9b2b2b';
          c.fillText('SOUTH COAST', 64, 44);
        });
        cell(TRIM_CELL.badge, (c) => {
          const gradient = c.createLinearGradient(0, 0, 128, 128);
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(0.5, '#8a8a8a');
          gradient.addColorStop(1, '#e0e0e0');
          c.fillStyle = gradient;
          c.fillRect(0, 0, 128, 128);
          c.strokeStyle = '#303030';
          c.lineWidth = 6;
          c.strokeRect(10, 10, 108, 108);
        });
        const texture = new Three.CanvasTexture(canvas);
        texture.colorSpace = Three.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        carTrimAtlasTexture = texture;
        return texture;
      }
      // A cell's UV rectangle, inset so mipmaps do not bleed from its neighbours.
      function trimCellRect(name) {
        const index = TRIM_CELL[name] ?? 0,
          inset = 5 / 512,
          u0 = (index % 4) / 4 + inset,
          v1 = 1 - Math.floor(index / 4) / 4 - inset;
        return [u0, v1 - 0.25 + inset * 2, u0 + 0.25 - inset * 2, v1];
      }
      // ---- Shared materials ---------------------------------------------------------
      /*
       * Trim: vertex colours times the atlas, roughness and metalness per vertex
       * (`finish` attribute), the city's night light (cityMaterialPatch).
       */
      function carFinishPatch(material, key) {
        material.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec2 finish;\nvarying vec2 vFinish;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFinish = finish;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vFinish;')
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vFinish.x;')
            .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vFinish.y;');
        };
        material.customProgramCacheKey = () => key;
        return material;
      }
      let carMaterials = null;
      function carSharedMaterials() {
        if (carMaterials) return carMaterials;
        const atlas = carTrimAtlas();
        carMaterials = {
          trim: carFinishPatch(new Three.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.5, metalness: 0.2, envMapIntensity: 1.1 }), 'car-trim'),
          // Tinted glass with a strong sky reflection; the damage model's cracked and
          // burst panes replace it pane by pane (damage3d.js, `m.glass`).
          glass: new Three.MeshStandardMaterial({ color: '#16222c', roughness: 0.04, metalness: 0.9, envMapIntensity: 1.7 }),
          // Daytime running lights and LED graphics: lit while driven, dark lenses parked.
          drlOn: new Three.MeshBasicMaterial({ vertexColors: true, color: new Three.Color(2.4, 2.4, 2.4) }),
          drlOff: new Three.MeshBasicMaterial({ vertexColors: true, color: new Three.Color(0.3, 0.3, 0.32) }),
          rubber: new Three.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.88, metalness: 0 }),
          wheel: carFinishPatch(new Three.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.3, metalness: 0.8 }), 'car-wheel'),
          bumperBlack: new Three.MeshStandardMaterial({ color: '#17191c', roughness: 0.66, metalness: 0.1 }),
          bumperChrome: new Three.MeshStandardMaterial({ color: '#dfe3e6', roughness: 0.1, metalness: 1 }),
        };
        for (const m of Object.values(carMaterials)) sharedMaterials.add(m);
        return carMaterials;
      }
      /*
       * Paint: clear coat over a solid or metallic base; the livery is a decal
       * layer composited over the paint colour (premultiplied alpha: transparent
       * shows the paint). The burnt shell's soot map is opaque, so it covers all.
       * Instance colours (the body impostors) tint the paint, not the decals.
       */
      function carLiveryPatch(material) {
        material.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <map_fragment>', '#ifdef USE_MAP\n  vec4 carLivery = texture2D( map, vMapUv );\n#endif')
            .replace(
              '#include <color_fragment>',
              '#include <color_fragment>\n#ifdef USE_MAP\n  diffuseColor.rgb = diffuseColor.rgb * ( 1.0 - carLivery.a ) + carLivery.rgb;\n#endif',
            );
        };
        material.customProgramCacheKey = () => 'car-livery';
        return material;
      }
      function carPaintMaterial(color, livery, finish) {
        return carLiveryPatch(
          new Three.MeshPhysicalMaterial({
            color,
            map: livery,
            roughness: finish.roughness,
            metalness: finish.metalness,
            clearcoat: 1,
            clearcoatRoughness: 0.05,
            envMapIntensity: 1,
          }),
        );
      }
      // The pooled impostor paint for a livery (flight-view3d.js BODY IMPOSTORS).
      const carImpostorPaints = new Map();
      function carImpostorPaint(livery) {
        let m = carImpostorPaints.get(livery);
        if (!m) {
          m = carLiveryPatch(new Three.MeshPhysicalMaterial({ map: livery, color: '#ffffff', roughness: 0.34, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 }));
          sharedMaterials.add(m);
          carImpostorPaints.set(livery, m);
        }
        return m;
      }
      // Bright solid colours are a solid gloss; neutrals and darks a metallic flake
      // (half of them solid, by the car's id).
      const carFinishColor = new Three.Color(),
        carFinishHsl = { h: 0, s: 0, l: 0 };
      function carFinish(color, id) {
        carFinishColor.set(color).getHSL(carFinishHsl);
        if (carFinishHsl.s > 0.5 && carFinishHsl.l > 0.2) return { roughness: 0.26, metalness: 0.06 };
        if (carFinishHsl.l > 0.8) return { roughness: 0.3, metalness: 0.18 };
        return (id * 2654435761) % 7 < 4 ? { roughness: 0.4, metalness: 0.62 } : { roughness: 0.28, metalness: 0.12 };
      }
      // ---- MERGING KIT ----------------------------------------------------------------
      /* Parts are accumulated into one vertex set per material, with a colour, a
         finish and an atlas UV per vertex (see police3d.js for the police kit). */
      const carMatrix = new Three.Matrix4(),
        carNormalMatrix = new Three.Matrix3(),
        carVector = new Three.Vector3(),
        carQuaternion = new Three.Quaternion(),
        carEuler = new Three.Euler(),
        carScale = new Three.Vector3(),
        carPosition = new Three.Vector3(),
        carColor = new Three.Color(),
        carAxisA = new Three.Vector3(),
        carAxisB = new Three.Vector3(),
        carAxisC = new Three.Vector3(),
        carUpVector = new Three.Vector3(),
        carIdentity = new Three.Matrix4();
      function carSet() {
        return { position: [], normal: [], uv: [], color: [], finish: [], index: [], count: 0 };
      }
      /* options: color, finish ([roughness, metalness] or a FINISH name), cell (an
         atlas cell: the geometry's own UVs map into it), uv (one fixed UV: a
         livery swatch), uvOf (x, y, z) -> [u, v] (a projection into the livery). */
      function carAddMatrix(set, geo, matrix, options = {}) {
        carNormalMatrix.getNormalMatrix(matrix);
        carColor.set(options.color || '#ffffff');
        const pos = geo.attributes.position,
          nor = geo.attributes.normal,
          uv = geo.attributes.uv,
          base = set.count,
          finish = typeof options.finish === 'string' ? FINISH[options.finish] : options.finish || FINISH.satin,
          rect = options.uv || options.uvOf ? null : trimCellRect(options.cell || 'solid'),
          solid = !options.cell;
        for (let i = 0; i < pos.count; i++) {
          carVector.fromBufferAttribute(pos, i).applyMatrix4(matrix);
          set.position.push(carVector.x, carVector.y, carVector.z);
          if (options.uvOf) set.uv.push(...options.uvOf(carVector.x, carVector.y, carVector.z));
          else if (options.uv) set.uv.push(options.uv[0], options.uv[1]);
          else if (solid) set.uv.push((rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2);
          else {
            const u = uv ? uv.getX(i) : 0,
              v = uv ? uv.getY(i) : 0;
            set.uv.push(rect[0] + (rect[2] - rect[0]) * (u - Math.floor(u === 1 ? 0 : u)), rect[1] + (rect[3] - rect[1]) * (v - Math.floor(v === 1 ? 0 : v)));
          }
          if (nor) {
            carVector.fromBufferAttribute(nor, i).applyMatrix3(carNormalMatrix).normalize();
            set.normal.push(carVector.x, carVector.y, carVector.z);
          } else set.normal.push(0, 1, 0);
          set.color.push(carColor.r, carColor.g, carColor.b);
          set.finish.push(finish[0], finish[1]);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) set.index.push(base + geo.index.getX(i));
        else for (let i = 0; i < pos.count; i++) set.index.push(base + i);
        set.count += pos.count;
      }
      function carAdd(set, geo, x, y, z, sx, sy, sz, options, rx = 0, ry = 0, rz = 0) {
        carMatrix.compose(carPosition.set(x, y, z), carQuaternion.setFromEuler(carEuler.set(rx, ry, rz)), carScale.set(sx, sy, sz));
        carAddMatrix(set, geo, carMatrix, options);
      }
      // A unit shape stretched from a to b: `height` along `up`, `depth` across both.
      function carBeam(set, geo, a, b, height, depth, options, up = [0, 1, 0]) {
        carAxisA.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const length = carAxisA.length();
        if (length < 1e-4) return;
        carAxisA.divideScalar(length);
        carUpVector.set(up[0], up[1], up[2]);
        carAxisC.crossVectors(carAxisA, carUpVector);
        if (carAxisC.lengthSq() < 1e-8) carAxisC.set(0, 0, 1);
        carAxisC.normalize();
        carAxisB.crossVectors(carAxisC, carAxisA).normalize();
        carMatrix.makeBasis(carAxisA.multiplyScalar(length), carAxisB.multiplyScalar(height), carAxisC.multiplyScalar(depth));
        carMatrix.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        carAddMatrix(set, geo, carMatrix, options);
      }
      // A bar with rounded edges from a to b (police3d.js roundedBar, which runs along z).
      function carBar(set, a, b, height, depth, radius, options, up = [0, 1, 0]) {
        carAxisA.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const length = carAxisA.length();
        if (length < 1e-3) return;
        carAxisA.divideScalar(length);
        carUpVector.set(up[0], up[1], up[2]);
        carAxisC.crossVectors(carUpVector, carAxisA);
        if (carAxisC.lengthSq() < 1e-8) carAxisC.set(1, 0, 0);
        carAxisC.normalize();
        carAxisB.crossVectors(carAxisA, carAxisC).normalize();
        const geo = roundedBar(+length.toFixed(2), +height.toFixed(2), +depth.toFixed(2), +Math.min(radius, height / 2, depth / 2).toFixed(2));
        carMatrix.makeBasis(carAxisC, carAxisB, carAxisA);
        carMatrix.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        carAddMatrix(set, geo, carMatrix, options);
      }
      // A disc-like unit cylinder at (x, y, z) facing `normal`: radius r, thickness t.
      const carFacing = new Three.Vector3(),
        carYAxis = new Three.Vector3(0, 1, 0);
      function carDisc(set, geo, x, y, z, r, t, normal, options, ry = 0) {
        carFacing.set(normal[0], normal[1], normal[2]).normalize();
        carQuaternion.setFromUnitVectors(carYAxis, carFacing);
        if (ry) carQuaternion.multiply(new Three.Quaternion().setFromAxisAngle(carYAxis, ry));
        carMatrix.compose(carPosition.set(x, y, z), carQuaternion, carScale.set(r, t, r));
        carAddMatrix(set, geo, carMatrix, options);
      }
      function carGeometry(set, { colors = true, finish = true } = {}) {
        const g = new Three.BufferGeometry();
        g.setAttribute('position', new Three.Float32BufferAttribute(set.position, 3));
        g.setAttribute('normal', new Three.Float32BufferAttribute(set.normal, 3));
        g.setAttribute('uv', new Three.Float32BufferAttribute(set.uv, 2));
        if (colors) g.setAttribute('color', new Three.Float32BufferAttribute(set.color, 3));
        if (finish) g.setAttribute('finish', new Three.Float32BufferAttribute(set.finish, 2));
        g.setIndex(set.count > 65535 ? new Three.Uint32BufferAttribute(set.index, 1) : set.index);
        g.computeBoundingSphere();
        sharedGeometries.add(g);
        return g;
      }
      // Shapes the kits share (unit sizes).
      let carShapes = null;
      function carShapeKit() {
        if (carShapes) return carShapes;
        const hexPrism = new Three.CylinderGeometry(1, 1, 1, 6);
        carShapes = {
          ...policeShapeKit(),
          cylinder24: new Three.CylinderGeometry(1, 1, 1, 24),
          hex: hexPrism,
          tube: new Three.CylinderGeometry(1, 1, 1, 10, 1, true),
          cone: new Three.CylinderGeometry(0.62, 1, 1, 16),
          torus: new Three.TorusGeometry(1, 0.12, 8, 28),
          ring: new Three.TorusGeometry(1, 0.06, 6, 28),
          halfTorus: new Three.TorusGeometry(1, 0.1, 6, 18, Math.PI),
          box: boxGeo,
          plane: new Three.PlaneGeometry(1, 1),
        };
        return carShapes;
      }
      // ---- LOFTED BODY ----------------------------------------------------------------------
      // Profile at t: [width factor, top, bottom] (bottom defaults to the body's underside).
      function carProfileAt(body, t) {
        const profile = body.profile;
        let a = profile[0],
          b = profile[profile.length - 1];
        if (t <= a[0]) b = a;
        else if (t >= b[0]) a = b;
        else
          for (let k = 0; k < profile.length - 1; k++)
            if (t <= profile[k + 1][0]) {
              a = profile[k];
              b = profile[k + 1];
              break;
            }
        const f = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0,
          bottomA = a[3] ?? body.yb,
          bottomB = b[3] ?? body.yb;
        return [lerpNumber(a[1], b[1], f), lerpNumber(a[2], b[2], f), lerpNumber(bottomA, bottomB, f)];
      }
      // The cross-section at t: `sections` ([t, section] keyframes) blended, or the one section.
      const carSectionScratch = [];
      function carSectionAt(body, t) {
        const keys = body.sections;
        if (!keys) return body.section;
        let a = keys[0],
          b = keys[keys.length - 1];
        if (t <= a[0]) b = a;
        else if (t >= b[0]) a = b;
        else
          for (let k = 0; k < keys.length - 1; k++)
            if (t <= keys[k + 1][0]) {
              a = keys[k];
              b = keys[k + 1];
              break;
            }
        const f = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0;
        carSectionScratch.length = a[1].length;
        for (let i = 0; i < a[1].length; i++) carSectionScratch[i] = [lerpNumber(a[1][i][0], b[1][i][0], f), lerpNumber(a[1][i][1], b[1][i][1], f)];
        return carSectionScratch;
      }
      function carRing(section) {
        const side = section.slice(0, -1);
        return [...side.map(([n, z]) => [n, -z]), [1, 0], ...side.slice().reverse().map(([n, z]) => [n, z])];
      }
      const carShells = new Map();
      /*
       * The shell: sections lofted along the profile (slices closer together at the
       * ends and at every profile break), capped, smooth-shaded, with the police
       * livery UVs (u along the car, v round the reference section).
       */
      function carShellGeometry(body, l, w) {
        const key = body.name + ':' + l + ':' + w;
        if (carShells.has(key)) return carShells.get(key);
        const vs = policeRingV(body, w),
          ts = [];
        for (let i = 0; i <= 40; i++) ts.push(-0.5 * Math.cos((i / 40) * Math.PI));
        for (const p of body.profile) ts.push(p[0]);
        for (const [t] of body.sections || []) ts.push(t);
        ts.sort((a, b) => a - b);
        const slices = ts.filter((t, i) => i === 0 || t - ts[i - 1] > 0.003),
          n = carRing(body.section).length,
          position = [],
          uv = [],
          index = [];
        for (const t of slices) {
          const [wf, top, bottom] = carProfileAt(body, t),
            ring = carRing(carSectionAt(body, t));
          for (let j = 0; j < n; j++) {
            const [nh, zf] = ring[j];
            position.push(t * l, bottom + nh * (top - bottom), (zf * wf * w) / 2);
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
        carShells.set(key, geo);
        return geo;
      }
      // The shell's half width, top and bottom at (x, y).
      function carShellAt(body, l, w, x, y) {
        const t = x / l,
          [wf, top, bottom] = carProfileAt(body, t),
          section = carSectionAt(body, t),
          nh = clamp((y - bottom) / Math.max(1e-6, top - bottom), 0, 1);
        let zf = section[section.length - 1][1];
        for (let k = 0; k < section.length - 1; k++) {
          const [n0, z0] = section[k],
            [n1, z1] = section[k + 1];
          if (nh <= n1) {
            zf = n1 > n0 ? lerpNumber(z0, z1, (nh - n0) / (n1 - n0)) : z1;
            break;
          }
        }
        return { half: (zf * wf * w) / 2, top, bottom, wf };
      }
      // ---- Glasshouse ----------------------------------------------------------------------
      const carCabins = new Map();
      /*
       * Five panes in PANE_ORDER (left, front, right, rear, roof), like the police
       * glasshouse, but the side glass may start part-way along (`sideFrom`, where a
       * buttress or an intake takes over) and an open car's rear and roof panes are
       * empty (a roadster's screen and door glass only).
       */
      function carCabinGeometry(body, l, w) {
        const key = body.name + ':' + l + ':' + w;
        if (carCabins.has(key)) return carCabins.get(key);
        const g = body.glass,
          from = g.sideFrom || 0,
          centreX = ((g.xf + g.xb + g.rf + g.rb) / 4) * l,
          inside = (p, out) => out.set(centreX, g.base - 2, 0),
          empty = () => gridGeometry(1, 1, () => [centreX, g.base, 0], inside),
          panes = [
            gridGeometry(5, 2, (u, v) => glassPoint(g, l, w, 'side', lerpNumber(from, 1, u), v, -1), inside),
            gridGeometry(8, 4, (u, v) => glassPoint(g, l, w, 'front', u * 2 - 1, v), inside),
            gridGeometry(5, 2, (u, v) => glassPoint(g, l, w, 'side', lerpNumber(from, 1, u), v, 1), inside),
            g.open ? empty() : gridGeometry(8, 3, (u, v) => glassPoint(g, l, w, 'rear', u * 2 - 1, v), inside),
            g.open ? empty() : gridGeometry(5, 4, (u, v) => glassPoint(g, l, w, 'roof', u * 2 - 1, v), inside),
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
        carCabins.set(key, geo);
        return geo;
      }
      // ---- Tyres and rims ----------------------------------------------------------------------
      /*
       * A unit tyre (radius 1, width 1, axis y like wheelGeo): tread, rounded
       * shoulders and sidewalls down to the bead. `kind`: 'road', 'whitewall'
       * (a white band on the sidewall, vertex colour), 'knobby' (blocks round the
       * tread and shoulders). The bead radius is the rim's (`bead`).
       */
      const carTyres = new Map();
      function carTyreGeometry(kind = 'road', bead = 0.68) {
        const key = kind + ':' + bead.toFixed(2);
        if (carTyres.has(key)) return carTyres.get(key);
        const profile = [
            [bead, -0.44],
            [bead + (0.9 - bead) * 0.5, -0.49],
            [0.9, -0.5],
            [0.96, -0.47],
            [0.995, -0.4],
            [1, -0.3],
            [1, 0.3],
            [0.995, 0.4],
            [0.96, 0.47],
            [0.9, 0.5],
            [bead + (0.9 - bead) * 0.5, 0.49],
            [bead, 0.44],
          ].map(([r, y]) => new Three.Vector2(r, y)),
          lathe = new Three.LatheGeometry(profile, kind === 'knobby' ? 20 : 28),
          set = carSet(),
          sidewall = (r) => (kind === 'whitewall' && r > bead + (0.9 - bead) * 0.25 && r < bead + (0.9 - bead) * 0.8 ? '#e8e6de' : '#26272a');
        // Colour the lathe by radius (whitewalls), tread darker.
        const pos = lathe.attributes.position,
          colors = [];
        lathe.computeVertexNormals();
        for (let i = 0; i < pos.count; i++) {
          const r = Math.hypot(pos.getX(i), pos.getZ(i));
          carColor.set(r > 0.985 ? '#1c1d1f' : sidewall(r));
          colors.push(carColor.r, carColor.g, carColor.b);
        }
        const tread = trimCellRect('tread'),
          solid = trimCellRect('solid');
        for (let i = 0; i < pos.count; i++) {
          carVector.fromBufferAttribute(pos, i);
          set.position.push(carVector.x, carVector.y, carVector.z);
          carVector.fromBufferAttribute(lathe.attributes.normal, i);
          set.normal.push(carVector.x, carVector.y, carVector.z);
          const r = Math.hypot(pos.getX(i), pos.getZ(i));
          if (r > 0.985) {
            // Tread blocks from the atlas round the circumference.
            const a = Math.atan2(pos.getZ(i), pos.getX(i));
            set.uv.push(tread[0] + ((a / TAU + 0.5) * 6 % 1) * (tread[2] - tread[0]), tread[1] + (pos.getY(i) + 0.5) * (tread[3] - tread[1]));
          } else set.uv.push((solid[0] + solid[2]) / 2, (solid[1] + solid[3]) / 2);
          set.color.push(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
          set.finish.push(0.9, 0);
        }
        for (let i = 0; i < lathe.index.count; i++) set.index.push(lathe.index.getX(i));
        set.count = pos.count;
        lathe.dispose();
        if (kind === 'knobby') {
          // Knobs: staggered blocks over the tread and down the shoulders.
          const S = carShapeKit(),
            blocks = 26;
          for (let i = 0; i < blocks; i++) {
            const a = (i / blocks) * TAU;
            for (const [y, r, s] of [[0, 1.04, 0.18], [i % 2 ? 0.3 : -0.3, 1.02, 0.15], [i % 2 ? -0.43 : 0.43, 0.97, 0.12]])
              carAdd(set, S.box, Math.cos(a) * r, y, Math.sin(a) * r, 0.12, s, 0.14, { color: '#222326', finish: 'rubber' }, 0, -a, 0);
          }
        }
        const geo = carGeometry(set);
        carTyres.set(key, geo);
        return geo;
      }
      /*
       * Rims, merged per style, side and size with the brake disc behind them.
       * style: spokes (count), shape ('straight', 'split', 'y', 'star', 'mesh',
       * 'aero', 'steel', 'smoothie', 'offroad', 'spider', 'dirt'), colour, lip.
       */
      const carRims = new Map();
      function carRimGeometry(rim, side, r, width) {
        const key = [rim.style, rim.spokes, rim.color, rim.lip, side, r.toFixed(2), width.toFixed(2), rim.frac].join(':');
        if (carRims.has(key)) return carRims.get(key);
        const S = carShapeKit(),
          set = carSet(),
          across = Math.PI / 2,
          face = side * (width / 2),
          R = r * (rim.frac || 0.7),
          color = rim.color || '#b9bec3',
          dark = '#1a1b1e',
          metal = rim.finish || 'alloy',
          out = (d) => face + side * d,
          disc = (radius, t, z, c, finish, geo = S.cylinder24) => carAdd(set, geo, 0, 0, z, radius, t, radius, { color: c, finish }, across, 0, 0);
        // Barrel (the inside of the rim) and the brake disc with its hat.
        carAdd(set, S.tube, 0, 0, face - side * width * 0.42, R * 0.99, width * 0.8, R * 0.99, { color: '#4a4d52', finish: 'satin' }, across, 0, 0);
        if (rim.style !== 'dirt') {
          disc(R * 0.86, 0.12, face - side * width * 0.32, '#6d7176', 'satin');
          disc(R * 0.36, 0.2, face - side * width * 0.28, '#2b2d31', 'satin');
        }
        // The lip: a bright ring round the face.
        const lipT = rim.lip ?? 0.06;
        carAdd(set, S.torus, 0, 0, out(0.01), R * 0.985, R * 0.985, 1.2, { color: rim.lipColor || color, finish: rim.lipColor ? 'chrome' : metal }, 0, 0, 0);
        if (lipT > 0.05) carAdd(set, S.ring, 0, 0, out(0.02), R * 0.93, R * 0.93, 1, { color: rim.lipColor || color, finish: 'chrome' });
        const spokes = rim.spokes || 5,
          hubR = R * 0.24,
          spokeZ = out(-0.02);
        if (rim.style === 'steel' || rim.style === 'smoothie' || rim.style === 'aero') {
          // A dished face: a steel wheel with a hubcap, a chrome smoothie, an aero cover.
          const capColor = rim.style === 'steel' ? rim.capColor || '#c3c7cb' : color;
          disc(R * 0.96, 0.08, out(-0.03), rim.style === 'steel' ? '#2e3136' : color, rim.style === 'smoothie' ? 'chrome' : metal);
          carAdd(set, S.dome, 0, 0, out(0.0), R * (rim.style === 'aero' ? 0.93 : 0.8), rim.style === 'aero' ? 0.12 : 0.28, R * (rim.style === 'aero' ? 0.93 : 0.8), { color: capColor, finish: rim.style === 'aero' ? 'satin' : 'chrome' }, side * across, 0, 0);
          if (rim.style === 'aero')
            for (let i = 0; i < spokes; i++) {
              const a = (i / spokes) * TAU;
              carBeam(set, S.box, [Math.cos(a) * R * 0.28, Math.sin(a) * R * 0.28, out(0.1)], [Math.cos(a + 0.5) * R * 0.86, Math.sin(a + 0.5) * R * 0.86, out(0.06)], R * 0.1, 0.06, { color: dark, finish: 'gloss' }, [0, 0, 1]);
            }
          if (rim.style === 'steel')
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * TAU;
              // The ventilation holes round the dish.
              carAdd(set, S.cylinderLow, Math.cos(a) * R * 0.68, Math.sin(a) * R * 0.68, out(0.0), R * 0.07, 0.06, R * 0.07, { color: '#15171a', finish: 'satin' }, across, 0, 0);
            }
        } else {
          // Spokes from the hub to the lip, in the style's shape.
          const spoke = (a, width2, reach = 0.96, lift = 0.05, c = color) =>
            carBeam(set, S.box, [Math.cos(a) * hubR * 0.9, Math.sin(a) * hubR * 0.9, out(lift)], [Math.cos(a) * R * reach, Math.sin(a) * R * reach, spokeZ], R * width2, 0.1, { color: c, finish: metal }, [0, 0, 1]);
          for (let i = 0; i < spokes; i++) {
            const a = (i / spokes) * TAU + (rim.twist || 0);
            if (rim.style === 'split') {
              spoke(a - 0.1, 0.09);
              spoke(a + 0.1, 0.09);
            } else if (rim.style === 'y') {
              spoke(a, 0.13, 0.6);
              for (const d of [-0.2, 0.2])
                carBeam(set, S.box, [Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, out(0.02)], [Math.cos(a + d) * R * 0.96, Math.sin(a + d) * R * 0.96, spokeZ], R * 0.09, 0.1, { color, finish: metal }, [0, 0, 1]);
            } else if (rim.style === 'star') {
              // Five-point star: wide at the hub, tapering out.
              spoke(a, 0.22, 0.55, 0.06);
              spoke(a, 0.12, 0.97, 0.04);
            } else if (rim.style === 'spider') {
              // Thin twin spokes twisting towards the lip.
              for (const d of [-0.06, 0.06])
                carBeam(set, S.box, [Math.cos(a + d) * hubR, Math.sin(a + d) * hubR, out(0.05)], [Math.cos(a + d * 3 + 0.18) * R * 0.96, Math.sin(a + d * 3 + 0.18) * R * 0.96, spokeZ], R * 0.06, 0.1, { color, finish: metal }, [0, 0, 1]);
            } else if (rim.style === 'mesh') {
              spoke(a, 0.05, 0.96, 0.03);
              carBeam(set, S.box, [Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, out(0.02)], [Math.cos(a + TAU / spokes) * R * 0.5, Math.sin(a + TAU / spokes) * R * 0.5, out(0.02)], R * 0.04, 0.08, { color, finish: metal }, [0, 0, 1]);
            } else if (rim.style === 'offroad') {
              spoke(a, 0.2, 0.96, 0.04);
              carAdd(set, S.cylinderLow, Math.cos(a + Math.PI / spokes) * R * 0.86, Math.sin(a + Math.PI / spokes) * R * 0.86, out(0.02), R * 0.06, 0.08, R * 0.06, { color: '#303236', finish: 'satin' }, across, 0, 0);
            } else if (rim.style === 'dirt') {
              // Wire spokes and a gold anodised hub.
              for (const d of [-1, 1])
                carBeam(set, S.box, [Math.cos(a) * hubR * 0.7, Math.sin(a) * hubR * 0.7, face - side * width * 0.3 * d], [Math.cos(a + 0.3) * R * 0.97, Math.sin(a + 0.3) * R * 0.97, face - side * width * 0.5], R * 0.018, 0.018, { color: '#c9ccd0', finish: 'chrome' }, [0, 0, 1]);
            } else spoke(a, rim.spokeWidth || 0.16);
          }
          if (rim.style === 'mesh' || rim.style === 'split' || rim.style === 'y') disc(R * 0.95, 0.03, out(-0.08), dark, 'satin');
          // Hub and centre cap (a centre-lock nut on the exotics).
          disc(hubR, 0.14, out(0.06), rim.hubColor || color, metal);
          disc(hubR * 0.6, 0.1, out(0.11), rim.capColor || '#2a2c30', rim.centreLock ? 'chrome' : 'gloss', rim.centreLock ? S.hex : S.cylinder24);
        }
        const geo = carGeometry(set);
        carRims.set(key, geo);
        return geo;
      }
      // ---- THE KIT: a body's merged parts for one size -----------------------------------
      /*
       * carKit(body, l, w) builds everything a body shares between cars: shell,
       * glasshouse, hood, bumpers, the paint / trim / drl sets, the four lamps,
       * the rims and tyres, halo anchors, wheel places. Bodies describe their own
       * details through `details(k)` with the surface-conforming helpers below
       * (k.surf, k.patch, k.strip, k.grille, k.round...), so a grille, an intake
       * or a light bar follows the nose it sits on.
       */
      const carKits = new Map();
      function carKit(body, l, w) {
        const key = body.name + ':' + l.toFixed(2) + ':' + w.toFixed(2);
        if (carKits.has(key)) return carKits.get(key);
        const M = CAR_M,
          S = carShapeKit(),
          g = body.glass,
          sets = { paint: carSet(), trim: carSet(), drl: carSet(), headLeft: carSet(), headRight: carSet(), tailLeft: carSet(), tailRight: carSet() },
          at = (x, y) => carShellAt(body, l, w, x, y),
          top = (x) => carProfileAt(body, x / l)[1],
          ringV = policeRingV(body, w),
          ringTotal = (() => {
            const ring = carRing(body.section),
              topRef = body.uvTop || body.h;
            let total = 0;
            for (let j = 1; j < ring.length; j++)
              total += Math.hypot((ring[j][0] - ring[j - 1][0]) * (topRef - body.yb), ((ring[j][1] - ring[j - 1][1]) * w) / 2);
            return total;
          })(),
          vMid = ringV[(ringV.length - 1) / 2];
        // The frontmost / rearmost x of the surface at lateral z and height y.
        function frontX(z, y) {
          const target = Math.abs(z);
          let previous = 0.5;
          for (let t = 0.5; t > -0.05; t -= 0.002) {
            if (at(t * l, y).half >= target) {
              if (t === 0.5) return t * l;
              const a = at(previous * l, y).half,
                b = at(t * l, y).half;
              return lerpNumber(previous, t, clamp((target - a) / Math.max(1e-6, b - a), 0, 1)) * l;
            }
            previous = t;
          }
          return 0;
        }
        function rearX(z, y) {
          const target = Math.abs(z);
          let previous = -0.5;
          for (let t = -0.5; t < 0.05; t += 0.002) {
            if (at(t * l, y).half >= target) {
              if (t === -0.5) return t * l;
              const a = at(previous * l, y).half,
                b = at(t * l, y).half;
              return lerpNumber(previous, t, clamp((target - a) / Math.max(1e-6, b - a), 0, 1)) * l;
            }
            previous = t;
          }
          return 0;
        }
        // The surface's height at (x, z) seen from above.
        function topY(x, z) {
          const s = at(x, top(x));
          if (Math.abs(z) <= s.half) return s.top;
          for (let i = 1; i <= 60; i++) {
            const y = s.top - (i / 60) * (s.top - s.bottom);
            if (at(x, y).half >= Math.abs(z)) return y;
          }
          return s.bottom;
        }
        // A point on the surface, `lift` out along the frame's outward direction.
        function surf(frame, u, v, lift = 0, side = 1) {
          if (frame === 'front') return [frontX(u, v) + lift, v, u];
          if (frame === 'rear') return [rearX(u, v) - lift, v, u];
          if (frame === 'top') return [u, topY(u, v) + lift, v];
          return [u, v, side * (at(u, v).half + lift)];
        }
        const insideOf = (frame, side) => (p, out) =>
          frame === 'front' ? out.set(p.x - 6, p.y, p.z) : frame === 'rear' ? out.set(p.x + 6, p.y, p.z) : frame === 'top' ? out.set(p.x, p.y - 6, p.z) : out.set(p.x, p.y, p.z - side * 6);
        // The livery's top projection: hood, roof panel and deck stripes line up.
        const topUv = (x, y, z) => [clamp(x / l + 0.5, 0.001, 0.999), clamp(vMid + (z / ringTotal) * (1 - POLICE_SWATCH_BAND), POLICE_SWATCH_BAND + 0.001, 0.999)];
        /*
         * A patch of the surface: u0..u1, v0..v1 in the frame's coordinates (front,
         * rear: z and y; top: x and z; side: x and y). With an atlas `cell` it is
         * cut into tiles about `tile` across, each showing the whole cell.
         */
        function patch(set, frame, u0, u1, v0, v1, options = {}) {
          const lift = options.lift ?? 0.012 * M,
            side = options.side || 1;
          if (options.cell && options.cell !== 'solid') {
            const tile = options.tile || 0.22 * M,
              cols = Math.max(1, Math.round(Math.abs(u1 - u0) / tile)),
              rows = Math.max(1, Math.round(Math.abs(v1 - v0) / tile)),
              position = [],
              uv = [],
              index = [];
            for (let j = 0; j < rows; j++)
              for (let i = 0; i < cols; i++) {
                const base = position.length / 3;
                for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
                  position.push(...surf(frame, lerpNumber(u0, u1, (i + a) / cols), lerpNumber(v0, v1, (j + b) / rows), lift, side));
                  uv.push(a, b);
                }
                index.push(base, base + 1, base + 2, base, base + 2, base + 3);
              }
            orientOutward(position, index, insideOf(frame, side));
            const geo = new Three.BufferGeometry();
            geo.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
            geo.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
            geo.setIndex(index);
            geo.computeVertexNormals();
            carAddMatrix(set, geo, carIdentity, options);
            geo.dispose();
            return;
          }
          const geo = gridGeometry(options.cols || 6, options.rows || 3, (u, v) => surf(frame, lerpNumber(u0, u1, u), lerpNumber(v0, v1, v), lift, side), insideOf(frame, side));
          carAddMatrix(set, geo, carIdentity, options);
          geo.dispose();
        }
        // A rounded bar following points on a frame (DRL strips, light bars, trim lines).
        function strip(set, frame, points, height, depth, options = {}, side = 1) {
          const lift = options.lift ?? depth * 0.35,
            p = points.map(([u, v]) => surf(frame, u, v, lift, side));
          for (let i = 0; i < p.length - 1; i++) carBar(set, p[i], p[i + 1], height, depth, Math.min(height, depth) * 0.45, options, options.up || [0, 1, 0]);
        }
        // Normal of the surface at a frame point (finite differences).
        function normalAt(frame, u, v, side = 1) {
          const e = 0.05 * M,
            p = new Three.Vector3(...surf(frame, u, v, 0, side)),
            du = new Three.Vector3(...surf(frame, u + e, v, 0, side)).sub(p),
            dv = new Three.Vector3(...surf(frame, u, v + e, 0, side)).sub(p),
            n = du.cross(dv).normalize(),
            out = frame === 'front' ? [1, 0, 0] : frame === 'rear' ? [-1, 0, 0] : frame === 'top' ? [0, 1, 0] : [0, 0, side];
          if (n.x * out[0] + n.y * out[1] + n.z * out[2] < 0) n.negate();
          return [n.x, n.y, n.z];
        }
        // A round element (lamp, ring, badge) sitting on the surface, facing out.
        function round(set, geo, frame, u, v, r, thickness, options = {}, side = 1) {
          const n = normalAt(frame, u, v, side),
            lift = options.lift ?? thickness / 2,
            p = surf(frame, u, v, 0, side);
          carDisc(set, geo, p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift, r, thickness, n, options, options.spin || 0);
          return [p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift];
        }
        // A grille: a patch in an atlas pattern with an optional bright or dark surround.
        function grille(frame, z0, z1, y0, y1, options = {}) {
          patch(sets.trim, frame, z0, z1, y0, y1, { cell: options.cell || 'honeycomb', color: options.color || '#2a2c30', finish: options.finish || 'gloss', tile: options.tile, lift: options.lift ?? 0.008 * M });
          if (options.frame) {
            const t = options.frameWidth || 0.025 * M,
              opts = { color: options.frame, finish: options.frameFinish || 'chrome', lift: options.lift ?? 0.012 * M };
            const edge = (a, b, fixed, along) => {
              const pts = [];
              for (let i = 0; i <= 6; i++) pts.push(along ? [lerpNumber(a, b, i / 6), fixed] : [fixed, lerpNumber(a, b, i / 6)]);
              strip(sets.trim, frame, pts, t, t * 1.2, opts);
            };
            edge(z0, z1, y1, true);
            edge(z0, z1, y0, true);
            edge(y0, y1, z0, false);
            edge(y0, y1, z1, false);
          }
        }
        const k = {
          body,
          l,
          w,
          M,
          S,
          g,
          sets,
          at,
          top,
          frontX,
          rearX,
          topY,
          surf,
          patch,
          strip,
          normalAt,
          round,
          grille,
          topUv,
          add: carAdd,
          beam: carBeam,
          bar: carBar,
          disc: carDisc,
          sw: (name) => ({ uv: swatchUv(CAR_SWATCH[name]) }),
          head: (side) => (side < 0 ? sets.headLeft : sets.headRight),
          tail: (side) => (side < 0 ? sets.tailLeft : sets.tailRight),
          halos: { headLeft: null, headRight: null, tailLeft: null, tailRight: null },
          halo(kind, side, p, size) {
            this.halos[kind + (side < 0 ? 'Left' : 'Right')] = { x: p[0], y: p[1], z: p[2], size };
          },
          wheels: [],
        };
        // ---- Wheels: places, arches, rims, calipers ----
        const wd = body.wheel;
        for (const [fx, r, width] of [[wd.xf, wd.r, wd.width], [wd.xr, wd.rr || wd.r, wd.wr || wd.width]]) {
          const x = fx * l,
            half = at(x, r).half,
            z = half + (wd.proud ?? 0.03 * M) - width / 2;
          k.wheels.push({ x, r, width, z, front: fx > 0 });
          for (const side of [-1, 1]) {
            // A dark wheel well behind the tyre, a lip over it.
            carAdd(sets.trim, S.halfDisc, x, r * 0.96, side * (half + 0.004 * M), r * 1.14, r * 1.14, 1, { color: '#050506', finish: 'matte' }, 0, side < 0 ? Math.PI : 0, 0);
            const lip = gridGeometry(16, 1, (u, v) => {
              const a = lerpNumber(0.04, Math.PI - 0.04, u),
                R = r * (1.13 + 0.03 * v),
                px = x + Math.cos(a) * R,
                py = r * 0.96 + Math.sin(a) * R,
                h = at(px, py).half;
              return [px, py - v * 0.012 * M, side * (h + lerpNumber(-0.01, wd.lip ?? 0.035, v) * M)];
            }, (p, out) => out.set(x, r, p.z - side * 3));
            carAddMatrix(body.flares ? sets.trim : sets.paint, lip, carIdentity, body.flares ? { color: body.flares, finish: 'plastic' } : k.sw('paint'));
            lip.dispose();
            if (body.flares) {
              // Black wheel-arch mouldings (SUVs, rally, pickups).
              const flare = gridGeometry(16, 1, (u, v) => {
                const a = lerpNumber(-0.05, Math.PI + 0.05, u),
                  R = r * lerpNumber(1.14, 1.3, v),
                  px = x + Math.cos(a) * R,
                  py = Math.max(r * 0.7, r * 0.96 + Math.sin(a) * R),
                  h = at(px, py).half;
                return [px, py, side * (h + 0.02 * M * (1 - v) + 0.005 * M)];
              }, (p, out) => out.set(x, r, p.z - side * 3));
              carAddMatrix(sets.trim, flare, carIdentity, { color: body.flares, finish: 'plastic' });
              flare.dispose();
            }
            // Brake caliper at the top rear of the disc (fixed to the body).
            if (wd.caliper) {
              const cz = side * (z + width * 0.5 - width * 0.34);
              carBar(sets.trim, [x - r * 0.42, r * 1.34, cz], [x - r * 0.18, r * 1.5, cz], r * 0.22, width * 0.16, 0.03 * M, { color: wd.caliper, finish: 'gloss' }, [0, 0, 1]);
            }
          }
        }
        // ---- Glasshouse furniture: roof panel, pillars, waist line, frames, mirrors ----
        if (g && !g.open) {
          if (!g.glassRoof) {
            const roofPoint = (s, t, lift = 0.018 * M) => [lerpNumber(g.rb * l - 0.03 * M, g.rf * l + 0.03 * M, t), g.roof + lift + g.arch * (1 - s * s), s * g.wt * w * 1.035];
            const roofGeo = gridGeometry(8, 6, (u, v) => roofPoint(u * 2 - 1, v), (p, out) => out.set(p.x, p.y - 5, 0));
            carAddMatrix(sets.paint, roofGeo, carIdentity, body.roofSwatch ? k.sw(body.roofSwatch) : { uvOf: topUv });
            roofGeo.dispose();
            for (const side of [-1, 1]) {
              const skirt = gridGeometry(8, 1, (u, v) => {
                const p = roofPoint(side, u, 0.018 * M - (1 - v) * 0.05 * M);
                return [p[0], p[1], p[2] + side * 0.003 * M];
              }, (p, out) => out.set(p.x, p.y, 0));
              carAddMatrix(sets.paint, skirt, carIdentity, k.sw(body.roofSwatch || 'paint'));
              skirt.dispose();
            }
          } else
            for (const side of [-1, 1])
              carBeam(sets.trim, S.box, glassPoint(g, l, w, 'roof', side * 0.99, 0), glassPoint(g, l, w, 'roof', side * 0.99, 1), 0.02 * M, 0.06 * M, { color: '#0e0f11', finish: 'gloss' });
          const pillarPoint = (s, t, side, out) => {
            const p = glassPoint(g, l, w, 'side', s, t, side);
            return [p[0], p[1], p[2] + side * out];
          };
          for (const side of [-1, 1]) {
            const up = [0, 0, side],
              from = g.sideFrom || 0;
            for (const [s, width, kind] of [[1, g.aWidth ?? 0.075 * M, g.aPillar || 'paint'], ...(g.pillars || [])]) {
              const paintKind = kind === 'paint' || kind === 'roof',
                options = paintKind ? k.sw(kind === 'roof' ? body.roofSwatch || 'paint' : 'paint') : { color: kind === 'chrome' ? '#dfe3e6' : '#0c0d0f', finish: kind === 'chrome' ? 'chrome' : 'gloss' },
                shift = s === 1 ? -width * 0.35 : s <= from ? width * 0.45 : 0,
                points = [0, 0.5, 1].map((t) => {
                  const p = pillarPoint(Math.max(s, from), t, side, s === 1 ? 0.022 * M : 0.014 * M);
                  return [p[0] + shift, p[1], p[2]];
                });
              for (let q = 0; q < 2; q++) carBeam(paintKind ? sets.paint : sets.trim, S.box, points[q], points[q + 1], 0.035 * M, width, options, up);
            }
            // Behind a short side glass: the buttress or intake panel in paint.
            if (from > 0.02) {
              const panel = gridGeometry(4, 2, (u, v) => {
                const p = glassPoint(g, l, w, 'side', lerpNumber(0, from, u), v, side);
                return [p[0], p[1], p[2] + side * 0.01 * M];
              }, (p, out) => out.set(p.x, p.y, 0));
              carAddMatrix(sets.paint, panel, carIdentity, k.sw(g.buttress || 'paint'));
              panel.dispose();
            }
            // Waist line along the foot of the glass, and the window frame over it.
            const frame = g.frame === 'chrome' ? { color: '#e2e6e9', finish: 'chrome' } : { color: '#0d0e10', finish: 'gloss' };
            carBeam(sets.trim, S.box, pillarPoint(from, 0.02, side, 0.016 * M), pillarPoint(1, 0.02, side, 0.016 * M), 0.035 * M, 0.03 * M, frame, [0, 1, 0]);
            if (g.frame)
              for (let q = 0; q < 6; q++)
                carBeam(sets.trim, S.box, pillarPoint(lerpNumber(from, 1, q / 6), 0.985, side, 0.014 * M), pillarPoint(lerpNumber(from, 1, (q + 1) / 6), 0.985, side, 0.014 * M), 0.025 * M, 0.02 * M, frame, [0, 0, side]);
            // Mirrors: a body-colour cap on a black arm at the door top.
            if (body.mirrors !== false) {
              const base = glassPoint(g, l, w, 'side', 0.97, 0.12, side),
                mx = base[0] - 0.14 * M,
                my = base[1] + 0.04 * M,
                mz = side * (Math.abs(base[2]) + 0.17 * M);
              carBar(sets.paint, [mx + 0.08 * M, my, mz], [mx - 0.06 * M, my, mz], 0.13 * M, 0.2 * M, 0.05 * M, k.sw(body.mirrorSwatch || 'paint'), [0, 1, 0]);
              carBeam(sets.trim, S.box, [mx + 0.06 * M, my - 0.03 * M, base[2]], [mx + 0.04 * M, my - 0.02 * M, mz - side * 0.06 * M], 0.04 * M, 0.06 * M, { color: '#0c0d0f', finish: 'satin' });
              carAdd(sets.trim, S.box, mx - 0.075 * M, my, mz, 0.01 * M, 0.1 * M, 0.17 * M, { color: '#3d4852', finish: 'lens' });
              if (body.mirrorRepeater !== false) carAdd(sets.drl, S.box, mx + 0.02 * M, my - 0.05 * M, mz + side * 0.07 * M, 0.08 * M, 0.012 * M, 0.02 * M, { color: '#ffae3a' });
            }
          }
          // Cowl under the windscreen.
          carBeam(sets.trim, S.box, glassPoint(g, l, w, 'front', -0.98, 0), glassPoint(g, l, w, 'front', 0.98, 0), 0.03 * M, 0.1 * M, { color: '#0e0f11', finish: 'plastic' }, [1, 1, 0]);
        }
        // ---- Doors: handles; the shut lines are in the livery ----
        for (const hx of body.handles || []) {
          const y = (body.handleY ?? body.h / M - 0.12) * M;
          for (const side of [-1, 1]) {
            const p = surf('side', hx * l, y, 0.006 * M, side),
              flush = body.handleStyle === 'flush';
            carBar(flush ? sets.trim : body.handleStyle === 'chrome' ? sets.trim : sets.paint, [p[0] - 0.1 * M, p[1], p[2]], [p[0] + 0.1 * M, p[1], p[2]], 0.035 * M, flush ? 0.012 * M : 0.03 * M, 0.012 * M, body.handleStyle === 'chrome' ? { color: '#e2e6e9', finish: 'chrome' } : flush ? { color: '#0d0e10', finish: 'gloss' } : k.sw('paint'));
          }
        }
        // Sills between the arches.
        if (body.sill) {
          const [front, rear] = k.wheels,
            y = body.yb + (body.sillHeight ?? 0.07) * M;
          for (const side of [-1, 1]) patch(sets.trim, 'side', rear.x + rear.r * 1.25, front.x - front.r * 1.25, body.yb + 0.01 * M, y, { side, color: body.sill, finish: 'plastic', lift: 0.006 * M, cols: 6, rows: 1 });
        }
        // Licence plates.
        if (body.plates !== false) {
          const rearY = (body.plateRear ?? 0.5) * M,
            frontY = (body.plateFront ?? 0.34) * M;
          patch(sets.trim, 'rear', -0.26 * M, 0.26 * M, rearY - 0.06 * M, rearY + 0.06 * M, { cell: 'plate', tile: 0.52 * M, color: '#ffffff', finish: 'satin', lift: 0.014 * M });
          if (body.frontPlate !== false) patch(sets.trim, 'front', -0.26 * M, 0.26 * M, frontY - 0.06 * M, frontY + 0.06 * M, { cell: 'plate', tile: 0.52 * M, color: '#ffffff', finish: 'satin', lift: 0.014 * M });
        }
        // ---- The body's own details ----
        body.details(k);
        // ---- Hood: a panel on the shell top from the hinge to the nose ----
        const hoodFrom = Math.max(0.215 * l, (g ? g.xf * l : 0) + (body.hoodGap ?? 0.12) * M),
          hoodTo = (0.5 - (body.hoodNose ?? 0.05)) * l,
          hoodBaseY = top(0.215 * l),
          hoodSet = carSet(),
          hoodHalf = (x) => at(x, top(x) - 0.004 * M).half * (body.hoodWidth ?? 0.93),
          hoodPoint = (u, v, lift) => {
            const x = lerpNumber(hoodFrom, hoodTo, u),
              z = v * hoodHalf(x);
            return [x, topY(x, z) + lift, z];
          };
        const hoodTop = gridGeometry(10, 8, (u, v) => hoodPoint(u, v * 2 - 1, 0.014 * M), (p, out) => out.set(p.x, p.y - 4, 0)),
          hoodUnder = gridGeometry(6, 4, (u, v) => hoodPoint(u, v * 2 - 1, -0.008 * M), (p, out) => out.set(p.x, p.y + 4, 0));
        carAddMatrix(hoodSet, hoodTop, carIdentity, { uvOf: topUv });
        carAddMatrix(hoodSet, hoodUnder, carIdentity, k.sw('dark'));
        for (const side of [-1, 1]) {
          const edge = gridGeometry(10, 1, (u, v) => hoodPoint(u, side, lerpNumber(-0.008, 0.014, v) * M), (p, out) => out.set(p.x, p.y, 0));
          carAddMatrix(hoodSet, edge, carIdentity, k.sw('paint'));
          edge.dispose();
        }
        hoodTop.dispose();
        hoodUnder.dispose();
        // Into the damage model's frame: unit length along x about 0.34 l, y from the hinge.
        for (let i = 0; i < hoodSet.position.length; i += 3) {
          hoodSet.position[i] = (hoodSet.position[i] - 0.34 * l) / (0.25 * l);
          hoodSet.position[i + 1] -= hoodBaseY;
        }
        for (let i = 0; i < hoodSet.normal.length; i += 3) {
          // Undo the x stretch in the normals (the mesh is scaled by 0.25 l again).
          hoodSet.normal[i] *= 0.25 * l;
          const n = Math.hypot(hoodSet.normal[i], hoodSet.normal[i + 1], hoodSet.normal[i + 2]) || 1;
          hoodSet.normal[i] /= n;
          hoodSet.normal[i + 1] /= n;
          hoodSet.normal[i + 2] /= n;
        }
        // ---- Bumpers (the damage model's two loose parts), normalised to a unit box ----
        const bumperGeometry = (front) => {
          const spec = body.bumpers?.[front ? 0 : 1] || {},
            y = (spec.y ?? (front ? 0.3 : 0.34)) * M,
            height = (spec.h ?? 0.14) * M,
            span = (spec.span ?? 0.86) * at(front ? 0.44 * l : -0.44 * l, y).half,
            set = carSet(),
            pts = [];
          for (let i = 0; i <= 10; i++) {
            const z = lerpNumber(-span, span, i / 10);
            pts.push([z, y]);
          }
          strip(set, front ? 'front' : 'rear', pts, height, (spec.d ?? 0.08) * M, { lift: (spec.lift ?? 0.02) * M, ...(spec.cell ? { cell: spec.cell } : {}), uv: swatchUv(CAR_SWATCH.paint) });
          const geo = carGeometry(set, { colors: false, finish: false });
          geo.computeBoundingBox();
          const box3 = geo.boundingBox,
            centre = new Three.Vector3(),
            size = new Three.Vector3();
          box3.getCenter(centre);
          box3.getSize(size);
          geo.translate(-centre.x, -centre.y, -centre.z);
          geo.scale(1 / size.x, 1 / size.y, 1 / size.z);
          geo.computeVertexNormals();
          geo.computeBoundingSphere();
          return { geo, centre: centre.clone(), size: size.clone(), material: spec.material || 'paint' };
        };
        const kit = {
          shell: carShellGeometry(body, l, w),
          cabin: g ? carCabinGeometry(body, l, w) : null,
          hood: carGeometry(hoodSet, { colors: false, finish: false }),
          hoodBaseY,
          paint: carGeometry(sets.paint, { colors: false, finish: false }),
          trim: carGeometry(sets.trim),
          drl: sets.drl.count ? carGeometry(sets.drl, { finish: false }) : null,
          lamps: {},
          halos: k.halos,
          bumpers: [bumperGeometry(true), bumperGeometry(false)],
          wheels: k.wheels,
          rims: k.wheels.map((wh) => [-1, 1].map((side) => carRimGeometry(body.rim, side, wh.r, wh.width))),
          tyre: carTyreGeometry(body.tyre || 'road', body.rim.frac ? body.rim.frac * 0.98 : 0.68),
          door: policeSwatchBox(CAR_SWATCH.paint),
          trunk: policeSwatchBox(CAR_SWATCH.paint),
        };
        for (const name of ['headLeft', 'headRight', 'tailLeft', 'tailRight'])
          kit.lamps[name] = sets[name].count ? carGeometry(sets[name], { colors: false, finish: false }) : null;
        carKits.set(key, kit);
        return kit;
      }
