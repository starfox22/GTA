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
       *  - sedan REGENT: a mid-size saloon (Camry / Accord): swept CV_LED lamps, a
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
       *  - drl: the daytime running lights and other CV_LED graphics, lit while the
       *    car is driven (two shared materials swapped, no per-car material);
       *  - the four lamps (headLeft, headRight, tailLeft, tailRight), each its
       *    own mesh with the lamp contract (damage3d.js: broken lamps go dark,
       *    tail lamps swap to brakeLamp while braking, nightLights in head, tail
       *    pairs per side).
       * Tyres are a shared lathe with rounded shoulders (knobbly for the dirt
       * bike, whitewalls for the rod); rims are merged per style with the brake
       * disc; calipers sit in the trim so they do not spin with the wheel.
       *
       * LIVERY: one canvas per body (civLiveryTexture), painted in the shell's
       * UV space with the police livery frame. It is a decal layer over the
       * paint: transparent where the car shows its paint, opaque for shut
       * lines, stripes, cladding, checkers and lettering (premultiplied alpha,
       * composited in the paint shader: civPaintMaterial). Top surfaces (hood,
       * roof panel) sample it by a top projection so stripes run over them.
       * The paint is clear-coated; bright solid colours get a solid gloss,
       * darker and neutral ones a metallic flake (civFinish).
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
        CV_FINISH = {
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
       * CV_LED dots, vents, a licence plate and a badge.
       */
      const TRIM_CELL = { solid: 0, honeycomb: 1, slats: 2, bars: 3, mesh: 4, carbon: 5, perforated: 6, hex: 7, louvre: 8, tread: 9, checker: 10, lens: 11, dots: 12, vents: 13, plate: 14, badge: 15 };
      let civTrimAtlasTexture = null;
      function civTrimAtlas() {
        if (civTrimAtlasTexture) return civTrimAtlasTexture;
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
        civTrimAtlasTexture = texture;
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
      function civFinishPatch(material, key) {
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
      let civMaterials = null;
      function civSharedMaterials() {
        if (civMaterials) return civMaterials;
        const atlas = civTrimAtlas();
        civMaterials = {
          trim: civFinishPatch(new Three.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.5, metalness: 0.2, envMapIntensity: 1.1 }), 'car-trim'),
          // Tinted glass with a strong sky reflection; the damage model's cracked and
          // burst panes replace it pane by pane (damage3d.js, `m.glass`).
          glass: new Three.MeshStandardMaterial({ color: '#1a2128', roughness: 0.06, metalness: 0.7, envMapIntensity: 1.6 }),
          // Daytime running lights and CV_LED graphics: lit while driven, dark lenses parked.
          drlOn: new Three.MeshBasicMaterial({ vertexColors: true, color: new Three.Color(2.4, 2.4, 2.4) }),
          drlOff: new Three.MeshBasicMaterial({ vertexColors: true, color: new Three.Color(0.3, 0.3, 0.32) }),
          rubber: new Three.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.88, metalness: 0 }),
          wheel: civFinishPatch(new Three.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.3, metalness: 0.8 }), 'car-wheel'),
          bumperBlack: new Three.MeshStandardMaterial({ color: '#17191c', roughness: 0.66, metalness: 0.1 }),
          bumperChrome: new Three.MeshStandardMaterial({ color: '#dfe3e6', roughness: 0.1, metalness: 1 }),
        };
        for (const m of Object.values(civMaterials)) sharedMaterials.add(m);
        return civMaterials;
      }
      /*
       * Paint: clear coat over a solid or metallic base; the livery is a decal
       * layer composited over the paint colour (premultiplied alpha: transparent
       * shows the paint). The burnt shell's soot map is opaque, so it covers all.
       * Instance colours (the body impostors) tint the paint, not the decals.
       */
      function civLiveryPatch(material) {
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
      function civPaintMaterial(color, livery, finish) {
        return civLiveryPatch(
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
      const civImpostorPaints = new Map();
      function civImpostorPaint(livery) {
        let m = civImpostorPaints.get(livery);
        if (!m) {
          m = civLiveryPatch(new Three.MeshPhysicalMaterial({ map: livery, color: '#ffffff', roughness: 0.34, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 }));
          sharedMaterials.add(m);
          civImpostorPaints.set(livery, m);
        }
        return m;
      }
      // Bright solid colours are a solid gloss; neutrals and darks a metallic flake
      // (half of them solid, by the car's id).
      const civFinishColor = new Three.Color(),
        civFinishHsl = { h: 0, s: 0, l: 0 };
      function civFinish(color, id) {
        civFinishColor.set(color).getHSL(civFinishHsl);
        if (civFinishHsl.s > 0.5 && civFinishHsl.l > 0.2) return { roughness: 0.26, metalness: 0.06 };
        if (civFinishHsl.l > 0.8) return { roughness: 0.3, metalness: 0.18 };
        return (id * 2654435761) % 7 < 4 ? { roughness: 0.4, metalness: 0.62 } : { roughness: 0.28, metalness: 0.12 };
      }
      // ---- MERGING KIT ----------------------------------------------------------------
      /* Parts are accumulated into one vertex set per material, with a colour, a
         finish and an atlas UV per vertex (see police3d.js for the police kit). */
      const civMatrix = new Three.Matrix4(),
        civNormalMatrix = new Three.Matrix3(),
        civVector = new Three.Vector3(),
        civQuaternion = new Three.Quaternion(),
        civEuler = new Three.Euler(),
        civScale = new Three.Vector3(),
        civPosition = new Three.Vector3(),
        civColor = new Three.Color(),
        civAxisA = new Three.Vector3(),
        civAxisB = new Three.Vector3(),
        civAxisC = new Three.Vector3(),
        civUpVector = new Three.Vector3(),
        civIdentity = new Three.Matrix4();
      function civSet() {
        return { position: [], normal: [], uv: [], color: [], finish: [], index: [], count: 0 };
      }
      /* options: color, finish ([roughness, metalness] or a CV_FINISH name), cell (an
         atlas cell: the geometry's own UVs map into it), uv (one fixed UV: a
         livery swatch), uvOf (x, y, z) -> [u, v] (a projection into the livery). */
      function civAddMatrix(set, geo, matrix, options = {}) {
        civNormalMatrix.getNormalMatrix(matrix);
        civColor.set(options.color || '#ffffff');
        const pos = geo.attributes.position,
          nor = geo.attributes.normal,
          uv = geo.attributes.uv,
          base = set.count,
          finish = typeof options.finish === 'string' ? CV_FINISH[options.finish] : options.finish || CV_FINISH.satin,
          rect = options.uv || options.uvOf ? null : trimCellRect(options.cell || 'solid'),
          solid = !options.cell;
        for (let i = 0; i < pos.count; i++) {
          civVector.fromBufferAttribute(pos, i).applyMatrix4(matrix);
          set.position.push(civVector.x, civVector.y, civVector.z);
          if (options.uvOf) set.uv.push(...options.uvOf(civVector.x, civVector.y, civVector.z));
          else if (options.uv) set.uv.push(options.uv[0], options.uv[1]);
          else if (solid) set.uv.push((rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2);
          else {
            const u = uv ? uv.getX(i) : 0,
              v = uv ? uv.getY(i) : 0;
            set.uv.push(rect[0] + (rect[2] - rect[0]) * (u - Math.floor(u === 1 ? 0 : u)), rect[1] + (rect[3] - rect[1]) * (v - Math.floor(v === 1 ? 0 : v)));
          }
          if (nor) {
            civVector.fromBufferAttribute(nor, i).applyMatrix3(civNormalMatrix).normalize();
            set.normal.push(civVector.x, civVector.y, civVector.z);
          } else set.normal.push(0, 1, 0);
          set.color.push(civColor.r, civColor.g, civColor.b);
          set.finish.push(finish[0], finish[1]);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) set.index.push(base + geo.index.getX(i));
        else for (let i = 0; i < pos.count; i++) set.index.push(base + i);
        set.count += pos.count;
      }
      function civAdd(set, geo, x, y, z, sx, sy, sz, options, rx = 0, ry = 0, rz = 0) {
        civMatrix.compose(civPosition.set(x, y, z), civQuaternion.setFromEuler(civEuler.set(rx, ry, rz)), civScale.set(sx, sy, sz));
        civAddMatrix(set, geo, civMatrix, options);
      }
      // A unit shape stretched from a to b: `height` along `up`, `depth` across both.
      function civBeam(set, geo, a, b, height, depth, options, up = [0, 1, 0]) {
        civAxisA.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const length = civAxisA.length();
        if (length < 1e-4) return;
        civAxisA.divideScalar(length);
        civUpVector.set(up[0], up[1], up[2]);
        civAxisC.crossVectors(civAxisA, civUpVector);
        if (civAxisC.lengthSq() < 1e-8) civAxisC.set(0, 0, 1);
        civAxisC.normalize();
        civAxisB.crossVectors(civAxisC, civAxisA).normalize();
        civMatrix.makeBasis(civAxisA.multiplyScalar(length), civAxisB.multiplyScalar(height), civAxisC.multiplyScalar(depth));
        civMatrix.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        civAddMatrix(set, geo, civMatrix, options);
      }
      // A bar with rounded edges from a to b (police3d.js roundedBar, which runs along z).
      function civBar(set, a, b, height, depth, radius, options, up = [0, 1, 0]) {
        civAxisA.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const length = civAxisA.length();
        if (length < 1e-3) return;
        civAxisA.divideScalar(length);
        civUpVector.set(up[0], up[1], up[2]);
        civAxisC.crossVectors(civUpVector, civAxisA);
        if (civAxisC.lengthSq() < 1e-8) civAxisC.set(1, 0, 0);
        civAxisC.normalize();
        civAxisB.crossVectors(civAxisA, civAxisC).normalize();
        const geo = roundedBar(+length.toFixed(2), +height.toFixed(2), +depth.toFixed(2), +Math.min(radius, height / 2, depth / 2).toFixed(2));
        civMatrix.makeBasis(civAxisC, civAxisB, civAxisA);
        civMatrix.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        civAddMatrix(set, geo, civMatrix, options);
      }
      // A disc-like unit cylinder at (x, y, z) facing `normal`: radius r, thickness t.
      const civFacing = new Three.Vector3(),
        civYAxis = new Three.Vector3(0, 1, 0);
      function civDisc(set, geo, x, y, z, r, t, normal, options, ry = 0) {
        civFacing.set(normal[0], normal[1], normal[2]).normalize();
        civQuaternion.setFromUnitVectors(civYAxis, civFacing);
        if (ry) civQuaternion.multiply(new Three.Quaternion().setFromAxisAngle(civYAxis, ry));
        civMatrix.compose(civPosition.set(x, y, z), civQuaternion, civScale.set(r, t, r));
        civAddMatrix(set, geo, civMatrix, options);
      }
      function civGeometry(set, { colors = true, finish = true } = {}) {
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
      let civShapes = null;
      function civShapeKit() {
        if (civShapes) return civShapes;
        const hexPrism = new Three.CylinderGeometry(1, 1, 1, 6);
        civShapes = {
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
        return civShapes;
      }
      // ---- LOFTED BODY ----------------------------------------------------------------------
      // Profile at t: [width factor, top, bottom] (bottom defaults to the body's underside).
      function civProfileAt(body, t) {
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
        // Wheel-arch bulges: the body swells over each axle (`arches`, a share of
        // the width; `archSpan`, their half length as a share of the car's).
        let wf = lerpNumber(a[1], b[1], f);
        if (body.arches) {
          const span = body.archSpan || 0.09;
          for (const axle of [body.wheel.xf, body.wheel.xr]) {
            const d = Math.abs(t - axle) / span;
            if (d < 1) wf *= 1 + body.arches * (0.5 + 0.5 * Math.cos(d * Math.PI));
          }
        }
        return [wf, lerpNumber(a[2], b[2], f), lerpNumber(bottomA, bottomB, f)];
      }
      // The cross-section at t: `sections` ([t, section] keyframes) blended, or the one section.
      const civSectionScratch = [];
      function civSectionAt(body, t) {
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
        civSectionScratch.length = a[1].length;
        for (let i = 0; i < a[1].length; i++) civSectionScratch[i] = [lerpNumber(a[1][i][0], b[1][i][0], f), lerpNumber(a[1][i][1], b[1][i][1], f)];
        return civSectionScratch;
      }
      function civRing(section) {
        const side = section.slice(0, -1);
        return [...side.map(([n, z]) => [n, -z]), [1, 0], ...side.slice().reverse().map(([n, z]) => [n, z])];
      }
      const civShells = new Map();
      /*
       * The shell: sections lofted along the profile (slices closer together at the
       * ends and at every profile break), capped, smooth-shaded, with the police
       * livery UVs (u along the car, v round the reference section).
       */
      function civShellGeometry(body, l, w) {
        const key = body.name + ':' + l + ':' + w;
        if (civShells.has(key)) return civShells.get(key);
        const vs = policeRingV(body, w),
          ts = [];
        for (let i = 0; i <= 40; i++) ts.push(-0.5 * Math.cos((i / 40) * Math.PI));
        for (const p of body.profile) ts.push(p[0]);
        for (const [t] of body.sections || []) ts.push(t);
        ts.sort((a, b) => a - b);
        const slices = ts.filter((t, i) => i === 0 || t - ts[i - 1] > 0.003),
          n = civRing(body.section).length,
          position = [],
          uv = [],
          index = [];
        for (const t of slices) {
          const [wf, top, bottom] = civProfileAt(body, t),
            ring = civRing(civSectionAt(body, t));
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
        civShells.set(key, geo);
        return geo;
      }
      // The shell's half width, top and bottom at (x, y).
      function civShellAt(body, l, w, x, y) {
        const t = x / l,
          [wf, top, bottom] = civProfileAt(body, t),
          section = civSectionAt(body, t),
          nh = clamp((y - bottom) / Math.max(1e-6, top - bottom), 0, section.reduce((m, [n]) => Math.max(m, n), 1));
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
      const civCabins = new Map();
      /*
       * Five panes in PANE_ORDER (left, front, right, rear, roof), like the police
       * glasshouse, but the side glass may start part-way along (`sideFrom`, where a
       * buttress or an intake takes over) and an open car's rear and roof panes are
       * empty (a roadster's screen and door glass only).
       */
      function civCabinGeometry(body, l, w) {
        const key = body.name + ':' + l + ':' + w;
        if (civCabins.has(key)) return civCabins.get(key);
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
        civCabins.set(key, geo);
        return geo;
      }
      // ---- Tyres and rims ----------------------------------------------------------------------
      /*
       * A unit tyre (radius 1, width 1, axis y like wheelGeo): tread, rounded
       * shoulders and sidewalls down to the bead. `kind`: 'road', 'whitewall'
       * (a white band on the sidewall, vertex colour), 'knobby' (blocks round the
       * tread and shoulders). The bead radius is the rim's (`bead`).
       */
      const civTyres = new Map();
      function civTyreGeometry(kind = 'road', bead = 0.68) {
        const key = kind + ':' + bead.toFixed(2);
        if (civTyres.has(key)) return civTyres.get(key);
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
          set = civSet(),
          sidewall = (r) => (kind === 'whitewall' && r > bead + (0.9 - bead) * 0.25 && r < bead + (0.9 - bead) * 0.8 ? '#e8e6de' : '#26272a');
        // Colour the lathe by radius (whitewalls), tread darker.
        const pos = lathe.attributes.position,
          colors = [];
        lathe.computeVertexNormals();
        for (let i = 0; i < pos.count; i++) {
          const r = Math.hypot(pos.getX(i), pos.getZ(i));
          civColor.set(r > 0.985 ? '#1c1d1f' : sidewall(r));
          colors.push(civColor.r, civColor.g, civColor.b);
        }
        const tread = trimCellRect('tread'),
          solid = trimCellRect('solid');
        for (let i = 0; i < pos.count; i++) {
          civVector.fromBufferAttribute(pos, i);
          set.position.push(civVector.x, civVector.y, civVector.z);
          civVector.fromBufferAttribute(lathe.attributes.normal, i);
          set.normal.push(civVector.x, civVector.y, civVector.z);
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
          const S = civShapeKit(),
            blocks = 26;
          for (let i = 0; i < blocks; i++) {
            const a = (i / blocks) * TAU;
            for (const [y, r, s] of [[0, 1.04, 0.18], [i % 2 ? 0.3 : -0.3, 1.02, 0.15], [i % 2 ? -0.43 : 0.43, 0.97, 0.12]])
              civAdd(set, S.box, Math.cos(a) * r, y, Math.sin(a) * r, 0.12, s, 0.14, { color: '#222326', finish: 'rubber' }, 0, -a, 0);
          }
        }
        const geo = civGeometry(set);
        civTyres.set(key, geo);
        return geo;
      }
      /*
       * Rims, merged per style, side and size with the brake disc behind them.
       * style: spokes (count), shape ('straight', 'split', 'y', 'star', 'mesh',
       * 'aero', 'steel', 'smoothie', 'offroad', 'spider', 'dirt'), colour, lip.
       */
      const civRims = new Map();
      function civRimGeometry(rim, side, r, width) {
        const key = [rim.style, rim.spokes, rim.color, rim.lip, side, r.toFixed(2), width.toFixed(2), rim.frac].join(':');
        if (civRims.has(key)) return civRims.get(key);
        const S = civShapeKit(),
          set = civSet(),
          across = Math.PI / 2,
          face = side * (width / 2),
          R = r * (rim.frac || 0.7),
          color = rim.color || '#b9bec3',
          dark = '#1a1b1e',
          metal = rim.finish || 'alloy',
          out = (d) => face + side * d,
          disc = (radius, t, z, c, finish, geo = S.cylinder24) => civAdd(set, geo, 0, 0, z, radius, t, radius, { color: c, finish }, across, 0, 0);
        // Barrel (the inside of the rim) and the brake disc with its hat.
        civAdd(set, S.tube, 0, 0, face - side * width * 0.42, R * 0.99, width * 0.8, R * 0.99, { color: '#4a4d52', finish: 'satin' }, across, 0, 0);
        if (rim.style !== 'dirt') {
          disc(R * 0.86, 0.12, face - side * width * 0.32, '#6d7176', 'satin');
          disc(R * 0.36, 0.2, face - side * width * 0.28, '#2b2d31', 'satin');
        }
        // The lip: a bright ring round the face.
        const lipT = rim.lip ?? 0.06;
        civAdd(set, S.torus, 0, 0, out(0.01), R * 0.985, R * 0.985, 1.2, { color: rim.lipColor || color, finish: rim.lipColor ? 'chrome' : metal }, 0, 0, 0);
        if (lipT > 0.05) civAdd(set, S.ring, 0, 0, out(0.02), R * 0.93, R * 0.93, 1, { color: rim.lipColor || color, finish: 'chrome' });
        const spokes = rim.spokes || 5,
          hubR = R * 0.24,
          spokeZ = out(-0.02);
        if (rim.style === 'steel' || rim.style === 'smoothie' || rim.style === 'aero') {
          // A dished face: a steel wheel with a hubcap, a chrome smoothie, an aero cover.
          const capColor = rim.style === 'steel' ? rim.capColor || '#c3c7cb' : color;
          disc(R * 0.96, 0.08, out(-0.03), rim.style === 'steel' ? '#2e3136' : color, rim.style === 'smoothie' ? 'chrome' : metal);
          civAdd(set, S.dome, 0, 0, out(0.0), R * (rim.style === 'aero' ? 0.93 : 0.8), rim.style === 'aero' ? 0.12 : 0.28, R * (rim.style === 'aero' ? 0.93 : 0.8), { color: capColor, finish: rim.style === 'aero' ? 'satin' : 'chrome' }, side * across, 0, 0);
          if (rim.style === 'aero')
            for (let i = 0; i < spokes; i++) {
              const a = (i / spokes) * TAU;
              civBeam(set, S.box, [Math.cos(a) * R * 0.28, Math.sin(a) * R * 0.28, out(0.1)], [Math.cos(a + 0.5) * R * 0.86, Math.sin(a + 0.5) * R * 0.86, out(0.06)], R * 0.1, 0.06, { color: dark, finish: 'gloss' }, [0, 0, 1]);
            }
          if (rim.style === 'steel')
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * TAU;
              // The ventilation holes round the dish.
              civAdd(set, S.cylinderLow, Math.cos(a) * R * 0.68, Math.sin(a) * R * 0.68, out(0.0), R * 0.07, 0.06, R * 0.07, { color: '#15171a', finish: 'satin' }, across, 0, 0);
            }
        } else {
          // Spokes from the hub to the lip, in the style's shape.
          const spoke = (a, width2, reach = 0.96, lift = 0.05, c = color) =>
            civBeam(set, S.box, [Math.cos(a) * hubR * 0.9, Math.sin(a) * hubR * 0.9, out(lift)], [Math.cos(a) * R * reach, Math.sin(a) * R * reach, spokeZ], R * width2, 0.1, { color: c, finish: metal }, [0, 0, 1]);
          for (let i = 0; i < spokes; i++) {
            const a = (i / spokes) * TAU + (rim.twist || 0);
            if (rim.style === 'split') {
              spoke(a - 0.1, 0.09);
              spoke(a + 0.1, 0.09);
            } else if (rim.style === 'y') {
              spoke(a, 0.13, 0.6);
              for (const d of [-0.2, 0.2])
                civBeam(set, S.box, [Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, out(0.02)], [Math.cos(a + d) * R * 0.96, Math.sin(a + d) * R * 0.96, spokeZ], R * 0.09, 0.1, { color, finish: metal }, [0, 0, 1]);
            } else if (rim.style === 'star') {
              // Five-point star: wide at the hub, tapering out.
              spoke(a, 0.22, 0.55, 0.06);
              spoke(a, 0.12, 0.97, 0.04);
            } else if (rim.style === 'spider') {
              // Thin twin spokes twisting towards the lip.
              for (const d of [-0.06, 0.06])
                civBeam(set, S.box, [Math.cos(a + d) * hubR, Math.sin(a + d) * hubR, out(0.05)], [Math.cos(a + d * 3 + 0.18) * R * 0.96, Math.sin(a + d * 3 + 0.18) * R * 0.96, spokeZ], R * 0.06, 0.1, { color, finish: metal }, [0, 0, 1]);
            } else if (rim.style === 'mesh') {
              spoke(a, 0.05, 0.96, 0.03);
              civBeam(set, S.box, [Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, out(0.02)], [Math.cos(a + TAU / spokes) * R * 0.5, Math.sin(a + TAU / spokes) * R * 0.5, out(0.02)], R * 0.04, 0.08, { color, finish: metal }, [0, 0, 1]);
            } else if (rim.style === 'offroad') {
              spoke(a, 0.2, 0.96, 0.04);
              civAdd(set, S.cylinderLow, Math.cos(a + Math.PI / spokes) * R * 0.86, Math.sin(a + Math.PI / spokes) * R * 0.86, out(0.02), R * 0.06, 0.08, R * 0.06, { color: '#303236', finish: 'satin' }, across, 0, 0);
            } else if (rim.style === 'dirt') {
              // Wire spokes and a gold anodised hub.
              for (const d of [-1, 1])
                civBeam(set, S.box, [Math.cos(a) * hubR * 0.7, Math.sin(a) * hubR * 0.7, face - side * width * 0.3 * d], [Math.cos(a + 0.3) * R * 0.97, Math.sin(a + 0.3) * R * 0.97, face - side * width * 0.5], R * 0.018, 0.018, { color: '#c9ccd0', finish: 'chrome' }, [0, 0, 1]);
            } else spoke(a, rim.spokeWidth || 0.16);
          }
          if (rim.style === 'mesh' || rim.style === 'split' || rim.style === 'y') disc(R * 0.95, 0.03, out(-0.08), dark, 'satin');
          // Hub and centre cap (a centre-lock nut on the exotics).
          disc(hubR, 0.14, out(0.06), rim.hubColor || color, metal);
          disc(hubR * 0.6, 0.1, out(0.11), rim.capColor || '#2a2c30', rim.centreLock ? 'chrome' : 'gloss', rim.centreLock ? S.hex : S.cylinder24);
        }
        const geo = civGeometry(set);
        civRims.set(key, geo);
        return geo;
      }
      // ---- THE KIT: a body's merged parts for one size -----------------------------------
      /*
       * civKit(body, l, w) builds everything a body shares between cars: shell,
       * glasshouse, hood, bumpers, the paint / trim / drl sets, the four lamps,
       * the rims and tyres, halo anchors, wheel places. Bodies describe their own
       * details through `details(k)` with the surface-conforming helpers below
       * (k.surf, k.patch, k.strip, k.grille, k.round...), so a grille, an intake
       * or a light bar follows the nose it sits on.
       */
      const civKits = new Map();
      function civKit(body, l, w) {
        const key = body.name + ':' + l.toFixed(2) + ':' + w.toFixed(2);
        if (civKits.has(key)) return civKits.get(key);
        const M = CAR_M,
          S = civShapeKit(),
          g = body.glass,
          sets = { paint: civSet(), trim: civSet(), drl: civSet(), headLeft: civSet(), headRight: civSet(), tailLeft: civSet(), tailRight: civSet() },
          at = (x, y) => civShellAt(body, l, w, x, y),
          top = (x) => civProfileAt(body, x / l)[1],
          ringV = policeRingV(body, w),
          ringTotal = (() => {
            const ring = civRing(body.section),
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
        // The upper surface's height at (x, z) from the section itself, so a wing
        // standing above the bonnet's centre and the dip between them both count.
        function topY(x, z) {
          const [wf, tp, bt] = civProfileAt(body, x / l),
            sec = civSectionAt(body, x / l),
            zf = Math.abs(z) / Math.max(1e-6, (wf * w) / 2);
          let pk = 0;
          for (let i = 0; i < sec.length; i++) if (sec[i][0] > sec[pk][0] + 1e-6) pk = i;
          const at2 = (n) => bt + n * (tp - bt);
          if (zf <= sec[pk][1]) {
            for (let i = pk; i < sec.length - 1; i++) {
              const [n0, z0] = sec[i],
                [n1, z1] = sec[i + 1];
              if (zf <= z0 && zf >= z1) return at2(lerpNumber(n0, n1, (z0 - zf) / Math.max(1e-6, z0 - z1)));
            }
            return tp;
          }
          for (let i = pk; i > 0; i--) {
            const [n0, z0] = sec[i],
              [n1, z1] = sec[i - 1];
            if (zf >= z0 && zf <= z1) return at2(lerpNumber(n0, n1, (zf - z0) / Math.max(1e-6, z1 - z0)));
          }
          return bt;
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
            civAddMatrix(set, geo, civIdentity, options);
            geo.dispose();
            return;
          }
          // `span(u)` -> [v0, v1] shapes the patch (a swept lamp, a tapering intake).
          const span = options.span,
            geo = gridGeometry(options.cols || 6, options.rows || 3, (u, v) => {
              const uu = lerpNumber(u0, u1, u),
                [a, b] = span ? span(uu) : [v0, v1];
              return surf(frame, uu, lerpNumber(a, b, v), lift, side);
            }, insideOf(frame, side));
          civAddMatrix(set, geo, civIdentity, options);
          geo.dispose();
        }
        // A rounded bar following points on a frame (DRL strips, light bars, trim lines).
        function strip(set, frame, points, height, depth, options = {}, side = 1) {
          const lift = options.lift ?? depth * 0.35,
            p = points.map(([u, v]) => surf(frame, u, v, lift, side));
          for (let i = 0; i < p.length - 1; i++) civBar(set, p[i], p[i + 1], height, depth, Math.min(height, depth) * 0.45, options, options.up || [0, 1, 0]);
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
          civDisc(set, geo, p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift, r, thickness, n, options, options.spin || 0);
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
        // The highest point of the section at x (a wing can stand above the bonnet's centre).
        function peak(x) {
          const [, t, b] = civProfileAt(body, x / l);
          let most = 1;
          for (const [nh] of civSectionAt(body, x / l)) most = Math.max(most, nh);
          return b + most * (t - b);
        }
        const k = {
          body,
          l,
          w,
          peak,
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
          add: civAdd,
          beam: civBeam,
          bar: civBar,
          disc: civDisc,
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
        for (const [fx, r, width, track] of [[wd.xf, wd.r, wd.width, wd.zf], [wd.xr, wd.rr || wd.r, wd.wr || wd.width, wd.zr]]) {
          const x = fx * l,
            half = at(x, r).half,
            // `zf` / `zr`: an axle's own half track in metres (the rod's front wheels stand clear of its nose).
            z = track !== undefined ? track * M : half + (wd.proud ?? 0.03 * M) - width / 2;
          k.wheels.push({ x, r, width, z, front: fx > 0 });
          if (fx > 0 && wd.exposedFront) continue;
          // The arch never rises through a low bonnet: its radius stops under the top.
          const archR = Math.min(r * 1.12, peak(x) - r * 0.96 - 0.035 * M, peak(x - r) - r * 0.96 - 0.02 * M, peak(x + r) - r * 0.96 - 0.02 * M) / 1.14;
          const archRadius = Math.max(r * 0.93, archR);
          for (const side of [-1, 1]) {
            // A dark wheel well behind the tyre, a lip over it.
            civAdd(sets.trim, S.halfDisc, x, r * 0.96, side * (half + 0.004 * M), archRadius * 1.14, archRadius * 1.14, 1, { color: '#050506', finish: 'matte' }, 0, side < 0 ? Math.PI : 0, 0);
            const lip = gridGeometry(16, 1, (u, v) => {
              const a = lerpNumber(0.04, Math.PI - 0.04, u),
                R = archRadius * (1.13 + 0.03 * v),
                px = x + Math.cos(a) * R,
                py = r * 0.96 + Math.sin(a) * R,
                h = at(px, py).half;
              return [px, py - v * 0.012 * M, side * (h + lerpNumber(-0.01, wd.lip ?? 0.035, v) * M)];
            }, (p, out) => out.set(x, r, p.z - side * 3));
            civAddMatrix(body.flares ? sets.trim : sets.paint, lip, civIdentity, body.flares ? { color: body.flares, finish: 'plastic' } : k.sw('paint'));
            lip.dispose();
            if (body.flares) {
              // Black wheel-arch mouldings (SUVs, rally, pickups).
              const flare = gridGeometry(16, 1, (u, v) => {
                const a = lerpNumber(-0.05, Math.PI + 0.05, u),
                  R = archRadius * lerpNumber(1.14, 1.3, v),
                  px = x + Math.cos(a) * R,
                  py = Math.max(r * 0.7, r * 0.96 + Math.sin(a) * R),
                  h = at(px, py).half;
                return [px, py, side * (h + 0.02 * M * (1 - v) + 0.005 * M)];
              }, (p, out) => out.set(x, r, p.z - side * 3));
              civAddMatrix(sets.trim, flare, civIdentity, { color: body.flares, finish: 'plastic' });
              flare.dispose();
            }
            // Brake caliper at the top rear of the disc (fixed to the body).
            if (wd.caliper) {
              const cz = side * (z + width * 0.5 - width * 0.34);
              civBar(sets.trim, [x - r * 0.42, r * 1.34, cz], [x - r * 0.18, r * 1.5, cz], r * 0.22, width * 0.16, 0.03 * M, { color: wd.caliper, finish: 'gloss' }, [0, 0, 1]);
            }
          }
        }
        // ---- Glasshouse furniture: roof panel, pillars, waist line, frames, mirrors ----
        if (g && !g.open) {
          if (!g.glassRoof) {
            const roofPoint = (s, t, lift = 0.018 * M) => [lerpNumber(g.rb * l - 0.03 * M, g.rf * l + 0.03 * M, t), g.roof + lift + g.arch * (1 - s * s), s * g.wt * w * 1.035];
            const roofGeo = gridGeometry(8, 6, (u, v) => roofPoint(u * 2 - 1, v), (p, out) => out.set(p.x, p.y - 5, 0));
            civAddMatrix(sets.paint, roofGeo, civIdentity, body.roofSwatch ? k.sw(body.roofSwatch) : { uvOf: topUv });
            roofGeo.dispose();
            for (const side of [-1, 1]) {
              const skirt = gridGeometry(8, 1, (u, v) => {
                const p = roofPoint(side, u, 0.018 * M - (1 - v) * 0.05 * M);
                return [p[0], p[1], p[2] + side * 0.003 * M];
              }, (p, out) => out.set(p.x, p.y, 0));
              civAddMatrix(sets.paint, skirt, civIdentity, k.sw(body.roofSwatch || 'paint'));
              skirt.dispose();
            }
          } else
            for (const side of [-1, 1])
              civBeam(sets.trim, S.box, glassPoint(g, l, w, 'roof', side * 0.99, 0), glassPoint(g, l, w, 'roof', side * 0.99, 1), 0.02 * M, 0.06 * M, { color: '#0e0f11', finish: 'gloss' });
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
              for (let q = 0; q < 2; q++) civBeam(paintKind ? sets.paint : sets.trim, S.box, points[q], points[q + 1], 0.035 * M, width, options, up);
            }
            // Behind a short side glass: the buttress or intake panel in paint.
            if (from > 0.02) {
              const panel = gridGeometry(4, 2, (u, v) => {
                const p = glassPoint(g, l, w, 'side', lerpNumber(0, from, u), v, side);
                return [p[0], p[1], p[2] + side * 0.01 * M];
              }, (p, out) => out.set(p.x, p.y, 0));
              civAddMatrix(sets.paint, panel, civIdentity, k.sw(g.buttress || 'paint'));
              panel.dispose();
            }
            // Waist line along the foot of the glass, and the window frame over it.
            const frame = g.frame === 'chrome' ? { color: '#e2e6e9', finish: 'chrome' } : { color: '#0d0e10', finish: 'gloss' };
            civBeam(sets.trim, S.box, pillarPoint(from, 0.02, side, 0.016 * M), pillarPoint(1, 0.02, side, 0.016 * M), 0.035 * M, 0.03 * M, frame, [0, 1, 0]);
            if (g.frame)
              for (let q = 0; q < 6; q++)
                civBeam(sets.trim, S.box, pillarPoint(lerpNumber(from, 1, q / 6), 0.985, side, 0.014 * M), pillarPoint(lerpNumber(from, 1, (q + 1) / 6), 0.985, side, 0.014 * M), 0.025 * M, 0.02 * M, frame, [0, 0, side]);
            // Mirrors: a body-colour cap on a black arm at the door top.
            if (body.mirrors !== false) {
              const base = glassPoint(g, l, w, 'side', 0.97, 0.12, side),
                mx = base[0] - 0.14 * M,
                my = base[1] + 0.04 * M,
                mz = side * (Math.abs(base[2]) + 0.17 * M);
              civBar(sets.paint, [mx + 0.08 * M, my, mz], [mx - 0.06 * M, my, mz], 0.13 * M, 0.2 * M, 0.05 * M, k.sw(body.mirrorSwatch || 'paint'), [0, 1, 0]);
              civBeam(sets.trim, S.box, [mx + 0.06 * M, my - 0.03 * M, base[2]], [mx + 0.04 * M, my - 0.02 * M, mz - side * 0.06 * M], 0.04 * M, 0.06 * M, { color: '#0c0d0f', finish: 'satin' });
              civAdd(sets.trim, S.box, mx - 0.075 * M, my, mz, 0.01 * M, 0.1 * M, 0.17 * M, { color: '#3d4852', finish: 'lens' });
              if (body.mirrorRepeater !== false) civAdd(sets.drl, S.box, mx + 0.02 * M, my - 0.05 * M, mz + side * 0.07 * M, 0.08 * M, 0.012 * M, 0.02 * M, { color: '#ffae3a' });
            }
          }
          // Cowl under the windscreen.
          civBeam(sets.trim, S.box, glassPoint(g, l, w, 'front', -0.98, 0), glassPoint(g, l, w, 'front', 0.98, 0), 0.03 * M, 0.1 * M, { color: '#0e0f11', finish: 'plastic' }, [1, 1, 0]);
        }
        // ---- Doors: handles; the shut lines are in the livery ----
        for (const hx of body.handles || []) {
          const y = (body.handleY ?? body.h / M - 0.12) * M;
          for (const side of [-1, 1]) {
            const p = surf('side', hx * l, y, 0.006 * M, side),
              flush = body.handleStyle === 'flush';
            civBar(flush ? sets.trim : body.handleStyle === 'chrome' ? sets.trim : sets.paint, [p[0] - 0.1 * M, p[1], p[2]], [p[0] + 0.1 * M, p[1], p[2]], 0.035 * M, flush ? 0.012 * M : 0.03 * M, 0.012 * M, body.handleStyle === 'chrome' ? { color: '#e2e6e9', finish: 'chrome' } : flush ? { color: '#0d0e10', finish: 'gloss' } : k.sw('paint'));
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
          hoodSet = civSet(),
          hoodHalf = (x) => at(x, top(x) - 0.004 * M).half * (body.hoodWidth ?? 0.93),
          hoodPoint = (u, v, lift) => {
            const x = lerpNumber(hoodFrom, hoodTo, u),
              z = v * hoodHalf(x);
            return [x, topY(x, z) + lift, z];
          };
        const hoodTop = gridGeometry(10, 8, (u, v) => hoodPoint(u, v * 2 - 1, 0.014 * M), (p, out) => out.set(p.x, p.y - 4, 0)),
          hoodUnder = gridGeometry(6, 4, (u, v) => hoodPoint(u, v * 2 - 1, -0.008 * M), (p, out) => out.set(p.x, p.y + 4, 0));
        civAddMatrix(hoodSet, hoodTop, civIdentity, { uvOf: topUv });
        civAddMatrix(hoodSet, hoodUnder, civIdentity, k.sw('dark'));
        for (const side of [-1, 1]) {
          const edge = gridGeometry(10, 1, (u, v) => hoodPoint(u, side, lerpNumber(-0.008, 0.014, v) * M), (p, out) => out.set(p.x, p.y, 0));
          civAddMatrix(hoodSet, edge, civIdentity, k.sw('paint'));
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
            set = civSet(),
            pts = [];
          for (let i = 0; i <= 10; i++) {
            const z = lerpNumber(-span, span, i / 10);
            pts.push([z, y]);
          }
          strip(set, front ? 'front' : 'rear', pts, height, (spec.d ?? 0.08) * M, { lift: (spec.lift ?? 0.02) * M, ...(spec.cell ? { cell: spec.cell } : {}), uv: swatchUv(CAR_SWATCH.paint) });
          const geo = civGeometry(set, { colors: false, finish: false });
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
          shell: civShellGeometry(body, l, w),
          cabin: g ? civCabinGeometry(body, l, w) : null,
          hood: civGeometry(hoodSet, { colors: false, finish: false }),
          hoodBaseY,
          paint: civGeometry(sets.paint, { colors: false, finish: false }),
          trim: civGeometry(sets.trim),
          drl: sets.drl.count ? civGeometry(sets.drl, { finish: false }) : null,
          lamps: {},
          halos: k.halos,
          bumpers: [bumperGeometry(true), bumperGeometry(false)],
          wheels: k.wheels,
          rims: k.wheels.map((wh) => [-1, 1].map((side) => civRimGeometry(body.rim, side, wh.r, wh.width))),
          tyre: civTyreGeometry(body.tyre || 'road', body.rim.frac ? body.rim.frac * 0.98 : 0.68),
          door: policeSwatchBox(CAR_SWATCH.paint),
          trunk: policeSwatchBox(CAR_SWATCH.paint),
        };
        for (const name of ['headLeft', 'headRight', 'tailLeft', 'tailRight'])
          kit.lamps[name] = sets[name].count ? civGeometry(sets[name], { finish: false }) : null;
        civKits.set(key, kit);
        return kit;
      }
      // ---- LIVERY ------------------------------------------------------------------------
      /*
       * A body's decal layer (see LIVERY above): transparent over the paint, with
       * the shut lines, the body's own graphics (`body.livery(g, f, k)`: stripes,
       * checkers, lettering, cladding) and the swatch band. Premultiplied, so the
       * mipmaps do not darken the edges of light lettering.
       */
      const civLiveries = new Map();
      function civLiveryTexture(body, l, w) {
        const key = body.name + ':' + l.toFixed(2) + ':' + w.toFixed(2);
        if (civLiveries.has(key)) return civLiveries.get(key);
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const g = canvas.getContext('2d'),
          f = liveryFrame(body, l, w),
          M = CAR_M,
          seam = 'rgba(8,9,10,0.62)',
          seamWidth = 0.006 * M;
        g.clearRect(0, 0, 1024, 512);
        // Shut lines: door fronts and backs from the sill to the belt, with the
        // door tops and the fuel flap, from the body's `doors` ([front, back] pairs, fractions of l).
        const sill = body.yb + 0.08 * M,
          belt = body.h - 0.02 * M;
        for (const [front, back] of body.doors || []) {
          liveryBand(g, f, front * l - seamWidth, front * l + seamWidth, sill, belt, seam);
          liveryBand(g, f, back * l - seamWidth, back * l + seamWidth, sill, belt, seam);
          liveryBand(g, f, back * l, front * l, sill - seamWidth, sill + seamWidth, 'rgba(8,9,10,0.35)');
        }
        if (body.fuel) {
          const [x, y] = body.fuel;
          g.strokeStyle = 'rgba(8,9,10,0.5)';
          g.lineWidth = 2;
          g.strokeRect(f.X(x * l - 0.09 * M), f.Y(y * M + 0.09 * M, 1), f.X(0.18 * M) - f.X(0), f.Y(y * M - 0.09 * M, 1) - f.Y(y * M + 0.09 * M, 1));
        }
        // The top of the car in canvas rows: z across the roof and hood (the
        // kit's top projection, which the reference section's UVs agree with).
        const ringV = policeRingV(body, w),
          vMid = ringV[(ringV.length - 1) / 2],
          ring = civRing(body.section),
          topRef = body.uvTop || body.h;
        let ringTotal = 0;
        for (let j = 1; j < ring.length; j++) ringTotal += Math.hypot((ring[j][0] - ring[j - 1][0]) * (topRef - body.yb), ((ring[j][1] - ring[j - 1][1]) * w) / 2);
        const topRow = (z) => (1 - (vMid + (z / ringTotal) * (1 - POLICE_SWATCH_BAND))) * 512;
        if (body.livery)
          body.livery(g, f, {
            l,
            w,
            M,
            band: liveryBand,
            polygon: liveryPolygon,
            text: liveryText,
            draw: liveryDraw,
            top: liveryTop,
            seams: liverySeams,
            topRow,
            // A stripe along the top between x0 and x1, z0..z1 across (metres from the centre line).
            stripe(x0, x1, z0, z1, color) {
              g.fillStyle = color;
              const a = topRow(z0 * M),
                b = topRow(z1 * M);
              g.fillRect(f.X(x0), Math.min(a, b), f.X(x1) - f.X(x0), Math.abs(b - a));
            },
          });
        // The swatch band: paint (clear), roof, black, lower cladding, accent, silver, dark, white.
        const swatches = ['rgba(0,0,0,0)', body.roofColor || 'rgba(0,0,0,0)', '#0c0d0f', body.lowerColor || '#1b1d20', body.accentColor || '#0c0d0f', '#b9bec3', '#1c1e21', '#eeeeea'];
        swatches.forEach((color, i) => {
          g.clearRect((i * 1024) / 8, 512 * (1 - POLICE_SWATCH_BAND), 1024 / 8, 512 * POLICE_SWATCH_BAND);
          g.fillStyle = color;
          g.fillRect((i * 1024) / 8, 512 * (1 - POLICE_SWATCH_BAND), 1024 / 8, 512 * POLICE_SWATCH_BAND);
        });
        const texture = policeCanvasTexture(canvas);
        texture.premultiplyAlpha = true;
        civLiveries.set(key, texture);
        return texture;
      }
      const civLetterings = new Map();
      function civLettering(body, l, w) {
        const key = body.name + ':' + l.toFixed(2);
        if (civLetterings.has(key)) return civLetterings.get(key);
        const set = policeSet();
        for (const [text, origin, right, up, height, color] of body.lettering(l, w, CAR_M)) decalText(set, text, origin, right, up, height, color);
        const geo = policeGeometry(set);
        civLetterings.set(key, geo);
        return geo;
      }
      // ---- The model -----------------------------------------------------------------------
      const civLampMaterials = {};
      function civLampSet() {
        if (civLampMaterials.headOn) return civLampMaterials;
        Object.assign(civLampMaterials, {
          // Lit: the lamp's own colours, past the bloom threshold.
          headOn: new Three.MeshBasicMaterial({ vertexColors: true, color: new Three.Color(2.6, 2.5, 2.3) }),
          // Off: clear lenses over chrome reflectors and dark projectors.
          headOff: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.85, envMapIntensity: 1.5 }),
          tailOn: new Three.MeshBasicMaterial({ vertexColors: true, color: new Three.Color(1.5, 1.2, 1.2) }),
          tailOff: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.2, color: new Three.Color(1, 0.85, 0.85), emissive: new Three.Color(0.16, 0.01, 0.01), envMapIntensity: 1.2 }),
          brake: new Three.MeshBasicMaterial({ vertexColors: true, color: new Three.Color(3.4, 1.6, 1.5) }),
        });
        for (const m of Object.values(civLampMaterials)) sharedMaterials.add(m);
        return civLampMaterials;
      }
      /*
       * A civilian car on the damage contract (render3d.js makeVehicle, damage3d.js):
       * shell / cabin crumple and crack pane by pane, hood, bumpers, wheels, lamps
       * (headLeft, headRight, tailLeft, tailRight; `lit` is the lamp's resting
       * material, animateCivilianCar lights it), nightLights in lampOut order.
       */
      function makeCivilianCar(vehicle) {
        const body = CAR_BODIES[vehicle.type],
          spec = vehicleSpec(vehicle),
          l = spec.l,
          w = spec.w * 0.87,
          materials = civSharedMaterials(),
          lampMaterials = civLampSet(),
          kit = civKit(body, l, w),
          group = new Three.Group(),
          bodyGroup = new Three.Group();
        group.add(bodyGroup);
        scene.add(group);
        const livery = civLiveryTexture(body, l, w),
          finish = body.finish ? { ...body.finish } : civFinish(vehicle.color, vehicle.id),
          paint = civPaintMaterial(vehicle.color, livery, finish);
        const shell = mesh(kit.shell, paint, bodyGroup, 0, 0, 0),
          cabin = kit.cabin ? mesh(kit.cabin, materials.glass, bodyGroup, 0, 0, 0) : null,
          hood = mesh(kit.hood, paint, bodyGroup, 0.34 * l, kit.hoodBaseY, 0, 0.25 * l, 1, 1),
          panels = mesh(kit.paint, paint, bodyGroup, 0, 0, 0),
          trim = mesh(kit.trim, materials.trim, bodyGroup, 0, 0, 0),
          drl = kit.drl ? mesh(kit.drl, materials.drlOff, bodyGroup, 0, 0, 0) : null;
        if (drl) drl.castShadow = false;
        const bumperMaterial = { paint, black: materials.bumperBlack, chrome: materials.bumperChrome },
          bumpers = kit.bumpers.map((b) => {
            const m = mesh(b.geo, bumperMaterial[b.material] || paint, bodyGroup, b.centre.x, b.centre.y, b.centre.z, b.size.x, b.size.y, b.size.z);
            m.castShadow = false;
            return m;
          });
        const wheels = [];
        for (const [i, wh] of kit.wheels.entries())
          for (const side of [-1, 1]) {
            const wheel = new Three.Group();
            wheel.position.set(wh.x, wh.r, side * wh.z);
            bodyGroup.add(wheel);
            wheels.push({ wheel, side, front: wh.front, radius: wh.r });
            // The tyre stays the wheel's first child (hidden on a burnt wreck).
            const tire = mesh(kit.tyre, materials.rubber, wheel, 0, 0, 0, wh.r, wh.width, wh.r);
            tire.rotation.x = Math.PI / 2;
            mesh(kit.rims[i][side < 0 ? 0 : 1], materials.wheel, wheel, 0, 0, 0);
          }
        const lamps = [],
          nightLights = [];
        for (const side of [-1, 1])
          for (const kind of ['head', 'tail']) {
            const key = kind + (side < 0 ? 'Left' : 'Right'),
              geo = kit.lamps[key],
              lit = kind === 'head' ? lampMaterials.headOff : lampMaterials.tailOff;
            if (geo) {
              const lamp = mesh(geo, lit, bodyGroup, 0, 0, 0);
              lamp.castShadow = false;
              lamps.push({ mesh: lamp, key, lit, kind });
            }
            const h = kit.halos[key] || { x: (kind === 'head' ? 0.49 : -0.49) * l, y: body.h * 0.8, z: side * w * 0.33, size: 1 };
            // Head, tail per side: the order lampOut expects (damage3d.js).
            nightLights.push(halo(bodyGroup, h.x + (kind === 'head' ? 0.4 : -0.4), h.y, h.z, (kind === 'head' ? 11 : 7) * (h.size || 1), kind === 'head' ? '#ffe9bd' : '#ff5a44'));
          }
        const bumperOrigins = bumpers.map((b) => b.position.clone());
        const wiperHost = {},
          g = body.glass;
        if (g && !g.open && !body.noWipers) addWipers(wiperHost, bodyGroup, g.xf * l, g.base + 0.03 * CAR_M, lerpNumber(g.xf, g.rf, 0.55) * l, lerpNumber(g.base, g.roof, 0.55), g.wb * w * 0.9);
        const extra = body.extras ? body.extras(bodyGroup, vehicle, paint) : null;
        // Lettering from the police glyph atlas (the cab's roof sign).
        if (body.lettering) {
          const decals = mesh(civLettering(body, l, w), policeGlyphs().material, bodyGroup, 0, 0, 0);
          decals.castShadow = false;
        }
        return {
          wipers: wiperHost.wipers,
          group,
          body: bodyGroup,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          car: true,
          civilian: true,
          realSize: true,
          dims: { l, w, h: body.h, roof: g ? g.roof : body.h, van: !!body.hatch, sill: body.yb + 0.1 * CAR_M },
          shell,
          shellBase: shell.geometry.attributes.position.array,
          cabin,
          cabinBase: cabin ? cabin.geometry.attributes.position.array : null,
          wheels,
          bumpers,
          bumperOrigins,
          hood,
          hoodBaseY: kit.hoodBaseY,
          lamps,
          damageVersion: -1,
          nightLights,
          rearDoors: null,
          drl,
          extra,
          liveryMap: livery,
          liveryColor: null,
          finish,
          bumperMaterial: bumpers.length ? bumpers[0].material : null,
          bumperMaterials: bumpers.map((b) => b.material),
          glass: materials.glass,
          panelGeometry: kit.door,
          trunkGeometry: kit.trunk,
          impostorParts: [
            { mesh: shell, material: civImpostorPaint(livery), tint: true, shadow: true },
            ...(cabin ? [{ mesh: cabin, material: materials.glass, shadow: true }] : []),
            { mesh: hood, material: civImpostorPaint(livery), tint: true },
            { mesh: panels, material: civImpostorPaint(livery), tint: true },
            { mesh: trim, material: materials.trim },
          ],
        };
      }
      /*
       * Once a frame for a civilian car in view (render3d.js vehicle pass): lamps
       * lit with the headlights, brake lights, DRLs while driven, the wheels
       * turning and the front ones steering, a body's own animation (`extras`).
       */
      function animateCivilianCar(c, m, deltaSeconds, driven, lampsOn, braking) {
        const lamps = civLampMaterials,
          broken = c.damage?.lights;
        for (const lamp of m.lamps) {
          const material = broken?.[lamp.key]
            ? lamp.mesh.material
            : lamp.kind === 'head'
              ? driven && lampsOn > 0.25
                ? lamps.headOn
                : lamps.headOff
              : braking
                ? lamps.brake
                : driven && lampsOn > 0.25
                  ? lamps.tailOn
                  : lamps.tailOff;
          if (lamp.mesh.material !== material) lamp.mesh.material = material;
        }
        if (m.drl) {
          const material = driven ? civSharedMaterials().drlOn : civSharedMaterials().drlOff;
          if (m.drl.material !== material) m.drl.material = material;
        }
        // Wheels roll with the road speed; the fronts follow the turn.
        const steer = c === player.car ? clamp((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), -1, 1) * 0.42 : clamp(c.av * 0.5, -0.4, 0.4);
        m.steer = (m.steer || 0) + (steer - (m.steer || 0)) * Math.min(1, deltaSeconds * 8);
        for (const wheel of m.wheels) {
          wheel.wheel.rotation.z -= (c.speed * deltaSeconds) / wheel.radius;
          if (wheel.front) wheel.wheel.rotation.y = -m.steer;
        }
        if (m.extra?.animate) m.extra.animate(c, m, deltaSeconds, driven, lampsOn);
      }
      // ---- BODIES ------------------------------------------------------------------------------
      // Lengths along the car are fractions of l; heights, radii and offsets in metres
      // (civBody() turns them into map units). See the header for the archetypes.
      const CV_LENS = '#9aa3ab',
        CV_LENS_DARK = '#4a5057',
        CV_LED = '#f4f7ff',
        CV_AMBER = '#ffa227',
        CV_TAIL = '#b3121b',
        CV_TAIL_DARK = '#8e1016',
        CV_TAIL_BAR = '#ff3a2e',
        CV_REVERSE = '#e9e9e4',
        CV_CHROME = '#e3e7ea',
        CV_GLOSS = '#0b0c0e',
        CV_PLASTIC = '#1a1c1f';
      function civBody(name, spec) {
        const M = CAR_M,
          body = { ...spec, name };
        for (const key of ['yb', 'h', 'uvTop']) if (body[key] !== undefined) body[key] *= M;
        body.profile = spec.profile.map(([t, wf, top, bottom]) => (bottom === undefined ? [t, wf, top * M] : [t, wf, top * M, bottom * M]));
        if (spec.glass) {
          body.glass = { ...spec.glass };
          for (const key of ['base', 'roof', 'arch', 'bulge', 'aWidth']) if (body.glass[key] !== undefined) body.glass[key] *= M;
          if (body.glass.pillars) body.glass.pillars = body.glass.pillars.map(([s, width, kind]) => [s, width * M, kind]);
        }
        body.wheel = { ...spec.wheel };
        for (const key of ['r', 'rr', 'width', 'wr', 'proud']) if (body.wheel[key] !== undefined) body.wheel[key] *= M;
        return body;
      }
      /*
       * Helpers the bodies share. `lampPatch` puts a lens on the nose or tail in a
       * lamp's set, `ledLine` a lit strip in the DRL set, `projector` a round
       * projector with its chrome bezel.
       */
      function lampPatch(k, set, frame, z0, z1, span, color, options = {}) {
        k.patch(set, frame, z0, z1, 0, 0, { span, color, finish: 'lens', cols: 8, rows: 2, lift: 0.014 * k.M, ...options });
      }
      /*
       * A lamp on a corner: a lens across the nose or tail from `zIn` to `zOut`
       * (shares of the half width) whose height runs from `yIn` to `yOut`
       * ([bottom, top] in metres), wrapping `wrap` metres round onto the flank
       * (tapering to `wrapTip`). end 1 front, -1 rear. Returns the lamp's frame
       * and half width for the details that sit in it.
       */
      function cornerLamp(k, end, side, o) {
        const M = k.M,
          frame = end > 0 ? 'front' : 'rear',
          set = o.set || (end > 0 ? k.head(side) : k.tail(side)),
          yMid = ((o.yOut[0] + o.yOut[1]) / 2) * M,
          // The body's half width at the lamp's height near the end (below the top there).
          hw = Math.max(0.3 * M, k.at(end * 0.47 * k.l, Math.min(yMid, k.top(end * 0.47 * k.l) - 0.05 * M)).half),
          color = o.color || (end > 0 ? CV_LENS_DARK : CV_TAIL_DARK);
        lampPatch(k, set, frame, side * hw * o.zIn, side * hw * o.zOut, (z) => {
          const f = clamp((Math.abs(z) / hw - o.zIn) / Math.max(1e-6, o.zOut - o.zIn), 0, 1),
            curve = o.curve ? Math.sin(f * Math.PI) * o.curve : 0;
          return [lerpNumber(o.yIn[0], o.yOut[0], f) * M + curve * M, lerpNumber(o.yIn[1], o.yOut[1], f) * M + curve * M];
        }, color);
        if (o.wrap) {
          const edge = end > 0 ? k.frontX(hw * o.zOut, yMid) : k.rearX(hw * o.zOut, yMid),
            x0 = edge - end * o.wrap * M,
            tip = o.wrapTip ?? 0.4;
          k.patch(set, 'side', Math.min(x0, edge + end * 0.004 * M), Math.max(x0, edge + end * 0.004 * M), 0, 0, {
            side,
            color,
            finish: 'lens',
            cols: 5,
            rows: 1,
            lift: 0.012 * M,
            span: (x) => {
              const f = clamp((x - x0) / (edge - x0), 0, 1),
                h = lerpNumber(tip, 1, f),
                mid = (o.yOut[0] + o.yOut[1]) / 2,
                half = ((o.yOut[1] - o.yOut[0]) / 2) * h;
              return [(mid - half + (o.wrapRise || 0) * (1 - f)) * M, (mid + half + (o.wrapRise || 0) * (1 - f)) * M];
            },
          });
        }
        return { frame, hw, set };
      }
      function ledLine(k, set, frame, points, color = CV_LED, size = 0.018) {
        k.strip(set, frame, points, size * k.M, size * k.M, { color, finish: 'lens', lift: 0.02 * k.M });
      }
      function projector(k, set, frame, z, y, r, side = 1) {
        const S = k.S;
        k.round(set, S.cylinder24, frame, z, y, r * k.M, 0.03 * k.M, { color: '#dfe4ea', finish: 'chrome', lift: 0.018 * k.M }, side);
        k.round(set, S.dome, frame, z, y, r * 0.7 * k.M, 0.05 * k.M, { color: '#ffffff', finish: 'lens', lift: 0.03 * k.M }, side);
      }
      // Cross-sections from the underside (0) to the top (1): [height share, half-width share].
      const SEC_SALOON = [[0, 0.84], [0.1, 0.95], [0.3, 1], [0.6, 1], [0.76, 0.98], [0.87, 0.93], [0.94, 0.85], [0.98, 0.7], [1, 0.4], [1, 0]],
        SEC_BOXY = [[0, 0.9], [0.08, 0.98], [0.25, 1], [0.75, 1], [0.88, 0.985], [0.95, 0.95], [0.985, 0.87], [1, 0.62], [1, 0.3], [1, 0]],
        SEC_SPORT = [[0, 0.82], [0.12, 0.94], [0.32, 1], [0.55, 0.995], [0.7, 0.97], [0.82, 0.92], [0.91, 0.82], [0.97, 0.64], [1, 0.36], [1, 0]],
        SEC_WEDGE = [[0, 0.86], [0.1, 0.97], [0.26, 1], [0.46, 0.99], [0.6, 0.95], [0.72, 0.89], [0.83, 0.8], [0.92, 0.66], [0.98, 0.42], [1, 0]],
        // Wings standing above the bonnet and engine deck (height shares past 1 at the shoulders).
        SEC_FENDER = [[0, 0.86], [0.12, 0.97], [0.32, 1], [0.55, 0.985], [0.76, 0.95], [0.93, 0.88], [1.07, 0.77], [1.13, 0.62], [1.06, 0.4], [1, 0]],
        SEC_FENDER_SOFT = [[0, 0.84], [0.12, 0.95], [0.32, 1], [0.56, 0.99], [0.74, 0.96], [0.88, 0.9], [0.99, 0.8], [1.05, 0.64], [1.03, 0.4], [1, 0]],
        SEC_BRUTINI = [[0, 0.88], [0.1, 0.98], [0.28, 1], [0.5, 0.985], [0.64, 0.94], [0.76, 0.86], [0.86, 0.74], [0.93, 0.58], [0.98, 0.36], [1, 0]],
        SEC_TALL = [[0, 0.9], [0.06, 0.98], [0.2, 1], [0.8, 1], [0.9, 0.985], [0.955, 0.95], [0.985, 0.88], [1, 0.66], [1, 0.33], [1, 0]];
      // Shared bits of detailing.
      function plateLight(k, y) {
        k.patch(k.sets.drl, 'rear', -0.08 * k.M, 0.08 * k.M, (y + 0.075) * k.M, (y + 0.085) * k.M, { color: '#fff6e6', cols: 2, rows: 1, lift: 0.02 * k.M });
      }
      function exhaustTips(k, zs, y, r, color = CV_CHROME, shape = 'round') {
        const { M, S } = k;
        for (const z of zs) {
          const geo = shape === 'hex' ? S.hex : S.cylinder24;
          k.round(k.sets.trim, geo, 'rear', z * M, y * M, r * M, 0.12 * M, { color, finish: 'chrome', lift: 0.02 * M });
          k.round(k.sets.trim, geo, 'rear', z * M, y * M, r * 0.78 * M, 0.13 * M, { color: '#070707', finish: 'matte', lift: 0.03 * M });
        }
      }
      function badge(k, frame, z, y, r = 0.05, color = CV_CHROME) {
        k.round(k.sets.trim, k.S.cylinder24, frame, z * k.M, y * k.M, r * k.M, 0.018 * k.M, { color, finish: 'chrome' });
      }
      function roofFin(k, t = 0.12) {
        const g = k.g,
          x = lerpNumber(g.rb, g.rf, t) * k.l;
        k.add(k.sets.trim, k.S.box, x, g.roof + g.arch + 0.05 * k.M, 0, 0.16 * k.M, 0.06 * k.M, 0.04 * k.M, { color: CV_GLOSS, finish: 'gloss' }, 0, 0, 0.3);
      }
      function sideMarker(k, x, y, side, color = CV_AMBER, set = k.sets.drl) {
        k.patch(set, 'side', x - 0.04 * k.M, x + 0.04 * k.M, (y - 0.015) * k.M, (y + 0.015) * k.M, { side, color, cols: 2, rows: 1, lift: 0.012 * k.M });
      }
      // A roof rail pair along the roof (SUVs, the rally hatch).
      function roofRails(k, color = CV_GLOSS, inset = 0.86) {
        const g = k.g;
        for (const side of [-1, 1]) {
          const z = side * g.wt * k.w * inset,
            y = g.roof + g.arch * (1 - inset * inset) + 0.06 * k.M,
            a = [g.rb * k.l + 0.08 * k.M, y, z],
            b = [g.rf * k.l - 0.15 * k.M, y, z];
          k.bar(k.sets.trim, a, b, 0.035 * k.M, 0.04 * k.M, 0.015 * k.M, { color, finish: color === CV_CHROME ? 'chrome' : 'gloss' });
          for (const t of [0.04, 0.96]) k.add(k.sets.trim, k.S.box, lerpNumber(a[0], b[0], t), y - 0.03 * k.M, z, 0.08 * k.M, 0.06 * k.M, 0.03 * k.M, { color: CV_GLOSS, finish: 'gloss' });
        }
      }
      const CAR_BODIES = {
        /* REGENT: a mid-size saloon (Camry / Accord): a low nose with a wide black
           mouth, swept lamps with an LED brow, a fastback roof and a light bar
           across the lid. */
        sedan: civBody('sedan', {
          yb: 0.17,
          h: 0.98,
          arches: 0.012,
          section: SEC_SALOON,
          profile: [
            [-0.5, 0.74, 0.8, 0.36], [-0.493, 0.84, 0.9, 0.24], [-0.475, 0.92, 0.96, 0.19], [-0.45, 0.965, 0.99, 0.17], [-0.39, 0.99, 1.0], [-0.3, 1.0, 0.995],
            [-0.2, 1.0, 0.985], [0.1, 1.0, 0.95], [0.2, 1.0, 0.91], [0.3, 0.995, 0.87], [0.38, 0.985, 0.84], [0.44, 0.955, 0.8],
            [0.47, 0.91, 0.76, 0.19], [0.487, 0.85, 0.7, 0.23], [0.5, 0.74, 0.6, 0.3],
          ],
          glass: { base: 0.95, roof: 1.44, xf: 0.2, xb: -0.37, rf: -0.03, rb: -0.24, wb: 0.41, wt: 0.33, bow: 0.02, bulge: 0.05, arch: 0.05, frame: 'chrome', pillars: [[0.47, 0.07, 'black'], [0, 0.16, 'paint']] },
          wheel: { r: 0.335, width: 0.23, xf: 0.3, xr: -0.28, caliper: '#3a3d42' },
          rim: { style: 'split', spokes: 5, color: '#aeb4ba', frac: 0.7 },
          doors: [[0.2, -0.02], [-0.02, -0.22]],
          fuel: [-0.34, 0.86],
          handles: [0.06, -0.15],
          sill: CV_PLASTIC,
          bumpers: [{ y: 0.26, h: 0.08, span: 0.8, material: 'black' }, { y: 0.3, h: 0.08, span: 0.8, material: 'black' }],
          plateRear: 0.62,
          plateFront: 0.4,
          details(k) {
            const { M, S, sets, at } = k;
            for (const side of [-1, 1]) {
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.42, zOut: 0.99, yIn: [0.62, 0.69], yOut: [0.67, 0.76], wrap: 0.34, wrapTip: 0.3, wrapRise: 0.02 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.44, 0.7 * M], [side * hw * 0.7, 0.728 * M], [side * hw * 0.95, 0.765 * M]]);
              projector(k, k.head(side), 'front', side * hw * 0.62, 0.66 * M, 0.035, side);
              projector(k, k.head(side), 'front', side * hw * 0.8, 0.69 * M, 0.035, side);
              k.halo('head', side, k.surf('front', side * hw * 0.72, 0.69 * M, 0.05 * M), 1);
              k.patch(sets.trim, 'front', side * hw * 0.7, side * hw * 0.93, 0.3 * M, 0.42 * M, { color: CV_GLOSS, finish: 'gloss', cols: 4, rows: 1 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.74, 0.335 * M], [side * hw * 0.9, 0.345 * M]], CV_LED, 0.012);
              const tail = cornerLamp(k, -1, side, { zIn: 0.52, zOut: 0.99, yIn: [0.81, 0.89], yOut: [0.8, 0.91], wrap: 0.3, wrapTip: 0.35 });
              const tw = tail.hw;
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.04, 0.878 * M], [side * tw * 0.55, 0.88 * M], [side * tw * 0.8, 0.875 * M], [side * tw * 0.98, 0.865 * M]], CV_TAIL_BAR, 0.016);
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.62, 0.83 * M], [side * tw * 0.8, 0.826 * M]], CV_REVERSE, 0.022);
              k.halo('tail', side, k.surf('rear', side * tw * 0.78, 0.86 * M, 0.05 * M), 1);
            }
            exhaustTips(k, [-0.45, 0.45], 0.3, 0.035, CV_CHROME);
            const gw = at(0.49 * k.l, 0.5 * M).half;
            k.grille('front', -gw * 0.64, gw * 0.64, 0.33 * M, 0.58 * M, { cell: 'honeycomb', color: '#3a3d42', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.14 * M });
            k.grille('front', -gw * 0.42, gw * 0.42, 0.62 * M, 0.67 * M, { cell: 'slats', color: '#2a2d31', tile: 0.06 * M });
            badge(k, 'front', 0, 0.6);
            badge(k, 'rear', 0, 0.82);
            const tw = at(-0.48 * k.l, 0.84 * M).half;
            k.strip(sets.trim, 'rear', [[-tw * 0.5, 0.848 * M], [0, 0.85 * M], [tw * 0.5, 0.848 * M]], 0.012 * M, 0.012 * M, { color: CV_CHROME, finish: 'chrome' });
            k.patch(sets.trim, 'rear', -tw * 0.8, tw * 0.8, 0.2 * M, 0.3 * M, { color: CV_PLASTIC, finish: 'plastic', cols: 8, rows: 1, lift: 0.01 * M });
            plateLight(k, 0.62);
            roofFin(k);
          },
        }),
        /* CITY CAB: a body-on-frame full-size cab after the Crown Victoria: upright
           glass, a long trunk, chrome grille and bumpers, taxi yellow with the
           checker band, CITY CAB on the doors and the lit roof sign. */
        taxi: civBody('taxi', {
          yb: 0.2,
          h: 1.0,
          arches: 0.008,
          section: SEC_BOXY,
          profile: [
            [-0.5, 0.8, 0.86, 0.36], [-0.492, 0.9, 0.94, 0.26], [-0.47, 0.96, 0.99, 0.2], [-0.42, 0.99, 1.01], [-0.3, 1.0, 1.01], [-0.22, 1.0, 1.0],
            [0.2, 1.0, 1.0], [0.3, 1.0, 0.97], [0.42, 0.985, 0.93], [0.47, 0.95, 0.88, 0.2], [0.49, 0.89, 0.82, 0.24], [0.5, 0.8, 0.74, 0.3],
          ],
          glass: { base: 0.98, roof: 1.46, xf: 0.21, xb: -0.28, rf: 0.07, rb: -0.19, wb: 0.415, wt: 0.345, bow: 0.012, bulge: 0.04, arch: 0.035, frame: 'chrome', pillars: [[0.5, 0.08, 'black'], [0, 0.14, 'paint']] },
          wheel: { r: 0.34, width: 0.225, xf: 0.3, xr: -0.28 },
          rim: { style: 'steel', color: '#2e3136', capColor: '#dfe3e6', frac: 0.66 },
          finish: { roughness: 0.3, metalness: 0.05 },
          doors: [[0.2, -0.01], [-0.01, -0.2]],
          handles: [0.07, -0.13],
          handleStyle: 'chrome',
          fuel: [-0.3, 0.88],
          bumpers: [{ y: 0.35, h: 0.12, span: 0.86, material: 'chrome', d: 0.1 }, { y: 0.36, h: 0.12, span: 0.86, material: 'chrome', d: 0.1 }],
          plateRear: 0.62,
          livery(g, f, L) {
            const { l, M } = L;
            // The checker band from the front door to the tail, CITY CAB on the front
            // doors, the medallion number on the rear quarter.
            for (let i = 0; i < 44; i++) {
              const x0 = -0.44 * l + (i * 0.8 * l) / 44,
                x1 = x0 + (0.8 * l) / 44;
              for (let row = 0; row < 2; row++) if ((i + row) % 2 === 0) L.band(g, f, x0, x1, (0.73 + row * 0.045) * M, (0.775 + row * 0.045) * M, '#111214');
            }
            L.band(g, f, -0.44 * l, 0.36 * l, 0.724 * M, 0.73 * M, '#111214');
            L.band(g, f, -0.44 * l, 0.36 * l, 0.863 * M, 0.868 * M, '#111214');
            L.text(g, f, 'CITY CAB', 0.09 * l, 0.62 * M, 0.11 * M, '#111214', { stretch: 1.1, spacing: 0.02 * M });
            L.text(g, f, '4T19', -0.34 * l, 0.62 * M, 0.09 * M, '#111214', { stretch: 1.1 });
            L.text(g, f, 'LICENSED · SOUTH COAST TLC', -0.1 * l, 0.62 * M, 0.035 * M, '#111214', { stretch: 1.05 });
          },
          details(k) {
            const { M, S, sets, at } = k;
            for (const side of [-1, 1]) {
              const hw = at(0.49 * k.l, 0.66 * M).half;
              // Square composite lamps with the amber corner, a chrome bar grille between.
              lampPatch(k, k.head(side), 'front', side * hw * 0.5, side * hw * 0.9, () => [0.6 * M, 0.72 * M], '#b7bec5');
              k.patch(k.head(side), 'front', side * hw * 0.9, side * hw * 0.995, 0, 0, { span: () => [0.6 * M, 0.72 * M], color: CV_AMBER, finish: 'lens', cols: 2, rows: 1, lift: 0.016 * M });
              k.patch(k.head(side), 'side', 0.455 * k.l, 0.485 * k.l, 0.6 * M, 0.7 * M, { side, color: CV_AMBER, finish: 'lens', cols: 2, rows: 1 });
              projector(k, k.head(side), 'front', side * hw * 0.62, 0.66 * M, 0.04, side);
              k.halo('head', side, k.surf('front', side * hw * 0.68, 0.66 * M, 0.05 * M), 1);
              const tw = at(-0.49 * k.l, 0.8 * M).half;
              // Tall tail lamps on the corners, a red panel across the lid between them.
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.62, side * tw * 0.99, () => [0.66 * M, 0.9 * M], '#a8121a');
              k.patch(k.tail(side), 'rear', side * tw * 0.66, side * tw * 0.8, 0.7 * M, 0.76 * M, { color: CV_REVERSE, finish: 'lens', cols: 2, rows: 1, lift: 0.02 * M });
              k.halo('tail', side, k.surf('rear', side * tw * 0.8, 0.8 * M, 0.05 * M), 1);
              // Roof-sign mounts.
            }
            const gw = at(0.495 * k.l, 0.66 * M).half;
            k.grille('front', -gw * 0.48, gw * 0.48, 0.6 * M, 0.73 * M, { cell: 'bars', color: '#c9ced3', finish: 'chrome', frame: CV_CHROME, tile: 0.05 * M });
            badge(k, 'front', 0, 0.665, 0.045);
            const tw = at(-0.495 * k.l, 0.8 * M).half;
            k.patch(sets.trim, 'rear', -tw * 0.6, tw * 0.6, 0.78 * M, 0.88 * M, { color: '#6d0b10', finish: 'lens', cols: 6, rows: 1, lift: 0.012 * M });
            exhaustTips(k, [-0.55], 0.28, 0.03, '#9aa0a6');
            // The roof sign: a lit box with TAXI and the number, on two feet.
            const g = k.g,
              x = lerpNumber(g.rb, g.rf, 0.45) * k.l,
              y = g.roof + g.arch + 0.02 * M;
            for (const side of [-1, 1]) k.add(sets.trim, S.box, x, y + 0.03 * M, side * 0.3 * M, 0.5 * M, 0.05 * M, 0.06 * M, { color: '#16181b', finish: 'satin' });
            k.bar(sets.trim, [x - 0.5 * M, y + 0.07 * M, 0], [x + 0.5 * M, y + 0.07 * M, 0], 0.03 * M, 0.34 * M, 0.01 * M, { color: '#16181b', finish: 'satin' });
            k.bar(sets.drl, [x - 0.49 * M, y + 0.22 * M, 0], [x + 0.49 * M, y + 0.22 * M, 0], 0.26 * M, 0.26 * M, 0.04 * M, { color: '#fff1c4' });
            k.bar(sets.trim, [x - 0.5 * M, y + 0.36 * M, 0], [x + 0.5 * M, y + 0.36 * M, 0], 0.03 * M, 0.3 * M, 0.01 * M, { color: '#16181b', finish: 'satin' });
            plateLight(k, 0.62);
          },
          // TAXI and the medallion number on both faces of the roof sign.
          lettering(l, w, M) {
            const g = CAR_BODIES.taxi.glass,
              x = lerpNumber(g.rb, g.rf, 0.45) * l,
              y = g.roof + g.arch + 0.24 * M,
              out = [];
            for (const side of [-1, 1]) {
              out.push(['TAXI', [x - 0.1 * M, y + 0.01 * M, side * 0.135 * M], [side, 0, 0], [0, 1, 0], 0.2 * M, '#16181b']);
              out.push(['4T19', [x + 0.36 * M, y, side * 0.135 * M], [side, 0, 0], [0, 1, 0], 0.1 * M, '#16181b']);
            }
            return out;
          },
        }),
        /* VOLT COUPE: a compact electric fastback (Model 3 / Polestar 2): a smooth
           closed nose, slim lamps, one glass roof sweeping to the lid, flush
           handles, a ducktail lip and aero wheels. */
        coupe: civBody('coupe', {
          yb: 0.15,
          h: 0.96,
          arches: 0.01,
          section: SEC_SPORT,
          profile: [
            [-0.5, 0.76, 0.84, 0.36], [-0.492, 0.86, 0.93, 0.24], [-0.47, 0.94, 0.98, 0.17], [-0.43, 0.98, 1.0, 0.15], [-0.36, 1.0, 0.99], [-0.2, 1.0, 0.96],
            [0.1, 1.0, 0.92], [0.22, 0.995, 0.86], [0.32, 0.99, 0.79], [0.4, 0.975, 0.74], [0.45, 0.94, 0.7], [0.475, 0.89, 0.65, 0.17], [0.49, 0.82, 0.58, 0.2], [0.5, 0.72, 0.5, 0.26],
          ],
          glass: { base: 0.93, roof: 1.43, xf: 0.24, xb: -0.4, rf: 0.01, rb: -0.22, wb: 0.405, wt: 0.325, bow: 0.022, bulge: 0.06, arch: 0.06, glassRoof: true, pillars: [[0.5, 0.06, 'black'], [0, 0.12, 'black']], aPillar: 'black' },
          wheel: { r: 0.33, width: 0.235, xf: 0.305, xr: -0.29, caliper: '#2b2d31' },
          rim: { style: 'aero', spokes: 5, color: '#8d939a', frac: 0.72 },
          doors: [[0.22, 0.0], [0.0, -0.2]],
          handles: [0.05, -0.14],
          handleStyle: 'flush',
          mirrorSwatch: 'paint',
          bumpers: [{ y: 0.22, h: 0.06, span: 0.7, material: 'black' }, { y: 0.26, h: 0.08, span: 0.8, material: 'black' }],
          plateRear: 0.52,
          plateFront: 0.32,
          frontPlate: false,
          details(k) {
            const { M, S, sets, at } = k;
            for (const side of [-1, 1]) {
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.55, zOut: 0.99, yIn: [0.52, 0.575], yOut: [0.56, 0.63], wrap: 0.28, wrapTip: 0.25, wrapRise: 0.03 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.56, 0.565 * M], [side * hw * 0.8, 0.59 * M], [side * hw * 0.97, 0.625 * M]], CV_LED, 0.012);
              projector(k, k.head(side), 'front', side * hw * 0.74, 0.58 * M, 0.03, side);
              k.halo('head', side, k.surf('front', side * hw * 0.76, 0.58 * M, 0.05 * M), 1);
              // Slim tail lamps along the ducktail, joined by a thin bar.
              const tail = cornerLamp(k, -1, side, { zIn: 0.4, zOut: 0.99, yIn: [0.855, 0.895], yOut: [0.84, 0.9], wrap: 0.26, wrapTip: 0.4 });
              ledLine(k, k.tail(side), 'rear', [[side * tail.hw * 0.02, 0.885 * M], [side * tail.hw * 0.6, 0.884 * M], [side * tail.hw * 0.95, 0.875 * M]], CV_TAIL_BAR, 0.012);
              k.halo('tail', side, k.surf('rear', side * tail.hw * 0.75, 0.87 * M, 0.05 * M), 1);
              k.patch(sets.trim, 'front', side * hw * 0.62, side * hw * 0.9, 0.24 * M, 0.3 * M, { color: CV_GLOSS, finish: 'gloss', cols: 4, rows: 1 });
            }
            // No grille: a sensor panel and a slim lower intake.
            const gw = at(0.49 * k.l, 0.3 * M).half;
            k.grille('front', -gw * 0.55, gw * 0.55, 0.22 * M, 0.3 * M, { cell: 'mesh', color: '#2a2d31', tile: 0.06 * M });
            badge(k, 'front', 0, 0.48, 0.035, '#c9ced3');
            const tw = at(-0.49 * k.l, 0.4 * M).half;
            k.patch(sets.trim, 'rear', -tw * 0.75, tw * 0.75, 0.18 * M, 0.27 * M, { color: CV_PLASTIC, finish: 'plastic', cols: 8, rows: 1, lift: 0.01 * M });
            // The ducktail lip in the body colour.
            const x = -0.47 * k.l;
            k.bar(sets.paint, [x, k.top(x) + 0.012 * M, -tw * 0.85], [x, k.top(x) + 0.012 * M, tw * 0.85], 0.025 * M, 0.08 * M, 0.012 * M, k.sw('paint'), [0, 1, 0]);
            plateLight(k, 0.52);
          },
        }),
        /* DUKE V8: a Challenger-style muscle car: a long flat hood with a power
           bulge, a full-width grille framing quad round lamps with halo rings, a
           short deck, thick C pillars, racetrack tail lamps and twin stripes. */
        muscle: civBody('muscle', {
          yb: 0.16,
          h: 1.0,
          arches: 0.014,
          section: SEC_BOXY,
          profile: [
            [-0.5, 0.86, 0.94, 0.34], [-0.492, 0.94, 0.99, 0.24], [-0.47, 0.985, 1.02, 0.17], [-0.4, 1.0, 1.03], [-0.3, 1.0, 1.02], [-0.18, 1.0, 1.0],
            [0.12, 1.0, 0.99], [0.25, 1.0, 0.97], [0.38, 0.995, 0.93], [0.46, 0.975, 0.89], [0.485, 0.94, 0.86, 0.18], [0.5, 0.88, 0.8, 0.22],
          ],
          glass: { base: 1.0, roof: 1.42, xf: 0.13, xb: -0.29, rf: -0.06, rb: -0.21, wb: 0.405, wt: 0.33, bow: 0.012, bulge: 0.04, arch: 0.03, frame: 'gloss', sideFrom: 0.12, pillars: [[0.55, 0.05, 'black']], aPillar: 'paint' },
          wheel: { r: 0.36, width: 0.27, wr: 0.29, xf: 0.3, xr: -0.29, caliper: '#c8141c' },
          rim: { style: 'star', spokes: 5, color: '#3a3d42', frac: 0.74, lipColor: '#c9ced3' },
          doors: [[0.13, -0.12]],
          handles: [-0.08],
          fuel: [-0.26, 0.9],
          sill: CV_PLASTIC,
          bumpers: [{ y: 0.28, h: 0.1, span: 0.85, material: 'black' }, { y: 0.3, h: 0.1, span: 0.85, material: 'black' }],
          plateRear: 0.62,
          plateFront: 0.4,
          livery(g, f, L) {
            // Twin stripes nose to tail.
            for (const z of [-1, 1]) L.stripe(-0.52 * L.l, 0.52 * L.l, z * 0.08, z * 0.26, 'rgba(12,13,15,0.96)');
          },
          details(k) {
            const { M, S, sets, at } = k;
            const hw = at(0.495 * k.l, 0.7 * M).half;
            // The grille across the nose, with the quad lamps set in it.
            k.grille('front', -hw * 0.97, hw * 0.97, 0.6 * M, 0.82 * M, { cell: 'honeycomb', color: '#2f3236', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.12 * M });
            for (const side of [-1, 1]) {
              for (const [zf, r] of [[0.8, 0.075], [0.58, 0.07]]) {
                const p = k.round(k.head(side), S.cylinder24, 'front', side * hw * zf, 0.71 * M, r * M, 0.04 * M, { color: '#c9d0d6', finish: 'lens', lift: 0.03 * M }, side);
                k.round(sets.drl, S.torus, 'front', side * hw * zf, 0.71 * M, r * 0.88 * M, 0.06 * M, { color: CV_LED, lift: 0.045 * M, spin: 0 }, side);
              }
              k.halo('head', side, k.surf('front', side * hw * 0.7, 0.71 * M, 0.06 * M), 1.1);
              k.patch(sets.trim, 'front', side * hw * 0.62, side * hw * 0.92, 0.3 * M, 0.44 * M, { cell: 'honeycomb', color: '#2f3236', finish: 'gloss', tile: 0.1 * M });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.66, 0.46 * M], [side * hw * 0.9, 0.46 * M]], CV_AMBER, 0.014);
              // Hood vents beside the bulge.
              k.patch(sets.trim, 'top', 0.3 * k.l, 0.4 * k.l, side * 0.28 * M, side * 0.4 * M, { cell: 'louvre', color: '#2a2c30', finish: 'gloss', tile: 0.12 * M, lift: 0.02 * M });
              sideMarker(k, 0.46 * k.l, 0.72, side);
            }
            // The racetrack tail lamp across the whole tail, the badge in its middle.
            const tw = at(-0.495 * k.l, 0.84 * M).half;
            for (const side of [-1, 1]) {
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.02, side * tw * 0.985, () => [0.78 * M, 0.9 * M], '#2a0507');
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.05, 0.84 * M], [side * tw * 0.95, 0.84 * M]], CV_TAIL_BAR, 0.05);
              k.halo('tail', side, k.surf('rear', side * tw * 0.6, 0.84 * M, 0.05 * M), 1.1);
            }
            k.patch(sets.trim, 'rear', -tw * 0.12, tw * 0.12, 0.8 * M, 0.88 * M, { color: '#16181b', finish: 'gloss', cols: 2, rows: 1, lift: 0.025 * M });
            exhaustTips(k, [-0.62, -0.5, 0.5, 0.62], 0.29, 0.045, CV_CHROME);
            // The power bulge on the hood and the lip spoiler on the deck.
            k.bar(sets.paint, [0.2 * k.l, k.top(0.2 * k.l) + 0.02 * M, 0], [0.44 * k.l, k.top(0.44 * k.l) + 0.012 * M, 0], 0.07 * M, 0.5 * M, 0.035 * M, { uvOf: k.topUv }, [0, 1, 0]);
            const x = -0.465 * k.l;
            k.bar(sets.paint, [x, k.top(x) + 0.03 * M, -tw * 0.9], [x, k.top(x) + 0.03 * M, tw * 0.9], 0.05 * M, 0.1 * M, 0.02 * M, k.sw('paint'), [0, 1, 0]);
            plateLight(k, 0.62);
          },
        }),
        /* COMET GT: a rear-engined 911-style coupe: frog-eye round lamps on the
           front wings, a low bonnet, wide rear hips, a sloping roof into louvred
           engine lid with a ducktail, the full-width light bar. */
        sport: civBody('sport', {
          yb: 0.13,
          h: 0.88,
          arches: 0.035,
          archSpan: 0.11,
          section: SEC_SPORT,
          sections: [[-0.5, SEC_FENDER_SOFT], [-0.22, SEC_FENDER_SOFT], [-0.1, SEC_SPORT], [0.12, SEC_SPORT], [0.22, SEC_FENDER], [0.5, SEC_FENDER]],
          profile: [
            [-0.5, 0.78, 0.8, 0.32], [-0.492, 0.88, 0.87, 0.22], [-0.47, 0.95, 0.9, 0.15], [-0.42, 0.99, 0.91], [-0.3, 1.02, 0.9], [-0.18, 1.0, 0.88],
            [0.05, 0.97, 0.86], [0.2, 0.96, 0.8], [0.3, 0.965, 0.76], [0.38, 0.955, 0.72], [0.44, 0.93, 0.67], [0.475, 0.88, 0.6, 0.16], [0.49, 0.8, 0.52, 0.2], [0.5, 0.7, 0.44, 0.26],
          ],
          glass: { base: 0.86, roof: 1.29, xf: 0.21, xb: -0.36, rf: -0.02, rb: -0.19, wb: 0.39, wt: 0.3, bow: 0.02, bulge: 0.06, arch: 0.06, frame: 'gloss', pillars: [[0.5, 0.05, 'black']], aPillar: 'paint' },
          wheel: { r: 0.34, width: 0.25, wr: 0.3, xf: 0.3, xr: -0.29, caliper: '#c8141c' },
          rim: { style: 'y', spokes: 5, color: '#c3c8cd', frac: 0.74, centreLock: true },
          hatch: true,
          doors: [[0.2, -0.1]],
          handles: [-0.05],
          handleStyle: 'flush',
          bumpers: [{ y: 0.22, h: 0.06, span: 0.8, material: 'black' }, { y: 0.24, h: 0.07, span: 0.8, material: 'black' }],
          plateRear: 0.46,
          plateFront: 0.3,
          frontPlate: false,
          details(k) {
            const { M, S, sets, at } = k;
            for (const side of [-1, 1]) {
              // Frog-eye lamps on the tops of the wings, four-point DRLs inside.
              const x = 0.43 * k.l,
                z = side * 0.52 * M,
                y = k.topY(x, z);
              k.disc(k.head(side), S.dome, x + 0.02 * M, y - 0.03 * M, z, 0.12 * M, 0.08 * M, [0.55, 0.83, 0], { color: '#d7dde2', finish: 'lens' });
              k.disc(sets.trim, S.cylinder24, x, y - 0.05 * M, z, 0.14 * M, 0.04 * M, [0.55, 0.83, 0], { color: '#16181b', finish: 'gloss' });
              for (const a of [0.8, 2.37, 3.93, 5.5]) k.add(sets.drl, S.box, x + 0.02 * M + Math.cos(a) * 0.06 * M * 0.55, y + 0.02 * M, z + Math.sin(a) * 0.06 * M, 0.025 * M, 0.012 * M, 0.025 * M, { color: CV_LED });
              k.halo('head', side, [x + 0.1 * M, y, z], 1);
              const hw = at(0.49 * k.l, 0.35 * M).half;
              k.patch(sets.trim, 'front', side * hw * 0.35, side * hw * 0.9, 0.2 * M, 0.34 * M, { cell: 'mesh', color: '#2a2c30', finish: 'gloss', tile: 0.08 * M });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.5, 0.36 * M], [side * hw * 0.85, 0.37 * M]], CV_AMBER, 0.012);
              const tw = at(-0.495 * k.l, 0.74 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.02, side * tw * 0.99, (zz) => [(0.72 - 0.02 * Math.abs(zz) / tw) * M, (0.77 - 0.01 * Math.abs(zz) / tw) * M], '#300507');
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.03, 0.748 * M], [side * tw * 0.96, 0.738 * M]], CV_TAIL_BAR, 0.012);
              k.halo('tail', side, k.surf('rear', side * tw * 0.75, 0.74 * M, 0.05 * M), 1);
            }
            // The engine lid: louvres on the lid, the ducktail with its third brake light.
            k.patch(sets.trim, 'top', -0.46 * k.l, -0.38 * k.l, -0.36 * M, 0.36 * M, { cell: 'louvre', color: '#1f2124', finish: 'gloss', tile: 0.09 * M, lift: 0.012 * M });
            const x = -0.475 * k.l,
              tw = at(x, k.top(x)).half;
            k.bar(sets.paint, [x, k.top(x) + 0.03 * M, -tw * 0.82], [x, k.top(x) + 0.03 * M, tw * 0.82], 0.035 * M, 0.16 * M, 0.02 * M, k.sw('paint'), [0, 1, 0]);
            k.patch(sets.trim, 'rear', -0.34 * M, 0.34 * M, 0.66 * M, 0.7 * M, { color: '#16181b', finish: 'gloss', cols: 4, rows: 1, lift: 0.016 * M });
            exhaustTips(k, [-0.1, 0.1], 0.26, 0.05, '#c9ced3');
            k.round(sets.trim, S.cylinder24, 'top', 0.46 * k.l, 0, 0.035 * M, 0.018 * M, { color: '#d9b14a', finish: 'chrome' });
            plateLight(k, 0.46);
          },
        }),
        /* SOLSTICE SPIDER: a two-seat roadster (MX-5 / Solstice), top down: long
           nose, cockpit with two leather buckets and roll hoops, a raked screen,
           the soft top folded under its cover. */
        roadster: civBody('roadster', {
          yb: 0.13,
          h: 0.86,
          arches: 0.03,
          archSpan: 0.1,
          section: SEC_SPORT,
          sections: [[-0.5, SEC_FENDER_SOFT], [-0.22, SEC_FENDER_SOFT], [-0.1, SEC_SPORT], [0.12, SEC_SPORT], [0.22, SEC_FENDER_SOFT], [0.5, SEC_FENDER_SOFT]],
          profile: [
            [-0.5, 0.78, 0.8, 0.34], [-0.49, 0.88, 0.86, 0.22], [-0.46, 0.95, 0.9, 0.15], [-0.4, 0.99, 0.9], [-0.3, 1.0, 0.88], [-0.2, 0.99, 0.84],
            [0.1, 0.98, 0.84], [0.2, 0.985, 0.8], [0.32, 0.99, 0.75], [0.42, 0.97, 0.7], [0.47, 0.91, 0.63, 0.16], [0.49, 0.83, 0.56, 0.2], [0.5, 0.72, 0.48, 0.27],
          ],
          glass: { base: 0.82, roof: 1.2, xf: 0.19, xb: 0.02, rf: 0.07, rb: 0.02, wb: 0.4, wt: 0.37, bow: 0.01, bulge: 0.05, arch: 0.03, open: true, sideFrom: 0.8, aPillar: 'black', aWidth: 0.05 },
          wheel: { r: 0.31, width: 0.215, xf: 0.3, xr: -0.29, caliper: '#3a3d42' },
          rim: { style: 'straight', spokes: 7, color: '#b8bec4', frac: 0.72, spokeWidth: 0.1 },
          mirrors: true,
          noWipers: false,
          doors: [[0.18, -0.08]],
          handles: [-0.05],
          bumpers: [{ y: 0.24, h: 0.06, span: 0.7, material: 'black' }, { y: 0.28, h: 0.07, span: 0.8, material: 'black' }],
          plateRear: 0.5,
          plateFront: 0.32,
          details(k) {
            const { M, S, sets, at } = k;
            for (const side of [-1, 1]) {
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.5, zOut: 0.99, yIn: [0.52, 0.58], yOut: [0.58, 0.66], wrap: 0.3, wrapTip: 0.3, wrapRise: 0.03, curve: 0.01 });
              projector(k, k.head(side), 'front', side * hw * 0.75, 0.6 * M, 0.035, side);
              ledLine(k, sets.drl, 'front', [[side * hw * 0.52, 0.575 * M], [side * hw * 0.8, 0.615 * M], [side * hw * 0.97, 0.655 * M]], CV_LED, 0.012);
              k.halo('head', side, k.surf('front', side * hw * 0.75, 0.6 * M, 0.05 * M), 1);
              const tail = cornerLamp(k, -1, side, { zIn: 0.55, zOut: 0.99, yIn: [0.66, 0.77], yOut: [0.64, 0.78], wrap: 0.2, wrapTip: 0.5 });
              k.round(k.tail(side), S.cylinder24, 'rear', side * tail.hw * 0.74, 0.715 * M, 0.05 * M, 0.02 * M, { color: CV_TAIL_BAR, finish: 'lens', lift: 0.024 * M }, side);
              k.halo('tail', side, k.surf('rear', side * tail.hw * 0.75, 0.71 * M, 0.05 * M), 1);
              // Bucket seats, head restraints and a roll hoop behind each.
              const z = side * 0.3 * M,
                x = -0.08 * k.l;
              k.bar(sets.trim, [x - 0.05 * M, 0.62 * M, z], [x + 0.35 * M, 0.62 * M, z], 0.12 * M, 0.44 * M, 0.05 * M, { color: '#6e4a31', finish: 'leather' });
              k.bar(sets.trim, [x - 0.06 * M, 0.6 * M, z], [x - 0.14 * M, 1.02 * M, z], 0.12 * M, 0.44 * M, 0.05 * M, { color: '#6e4a31', finish: 'leather' });
              k.bar(sets.trim, [x - 0.15 * M, 1.03 * M, z], [x - 0.17 * M, 1.12 * M, z], 0.1 * M, 0.25 * M, 0.04 * M, { color: '#5a3a26', finish: 'leather' });
              k.add(sets.trim, S.halfTorus, x - 0.3 * M, 0.9 * M, z, 0.22 * M, 0.26 * M, 0.3 * M, { color: '#c9ced3', finish: 'chrome' }, 0, Math.PI / 2, 0);
            }
            // The cockpit floor and dash under the screen, the wheel, the folded top.
            const g = k.g;
            k.patch(sets.trim, 'top', -0.2 * k.l, g.xf * k.l - 0.02 * M, -0.62 * M, 0.62 * M, { color: '#151515', finish: 'matte', lift: 0.01 * M, cols: 4, rows: 3 });
            k.bar(sets.trim, [g.xf * k.l - 0.25 * M, 0.9 * M, -0.62 * M], [g.xf * k.l - 0.25 * M, 0.9 * M, 0.62 * M], 0.12 * M, 0.35 * M, 0.05 * M, { color: '#1c1c1d', finish: 'leather' });
            k.disc(sets.trim, S.torus, g.xf * k.l - 0.52 * M, 0.95 * M, -0.3 * M, 0.17 * M, 1, [0.6, 0.8, 0], { color: '#141414', finish: 'leather' });
            k.bar(sets.trim, [-0.3 * k.l, 0.9 * M, -0.62 * M], [-0.3 * k.l, 0.9 * M, 0.62 * M], 0.08 * M, 0.32 * M, 0.04 * M, { color: '#101112', finish: 'matte' });
            k.bar(sets.trim, [0.05 * k.l, 0.72 * M, 0], [-0.18 * k.l, 0.72 * M, 0], 0.18 * M, 0.2 * M, 0.04 * M, { color: '#1c1c1d', finish: 'leather' });
            const gw = at(0.49 * k.l, 0.35 * M).half;
            k.grille('front', -gw * 0.62, gw * 0.62, 0.22 * M, 0.42 * M, { cell: 'mesh', color: '#2a2d31', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.08 * M });
            badge(k, 'front', 0, 0.45, 0.035);
            exhaustTips(k, [-0.55, 0.55], 0.27, 0.035);
            plateLight(k, 0.5);
          },
        }),
        /* KODIAK RS: a WRX / Focus RS rally hatch: a bonnet scoop, a tall roof
           wing, black arch flares and sills, a light pod on the nose, gold mesh
           wheels and rally decals. */
        rally: civBody('rally', {
          yb: 0.16,
          h: 0.98,
          arches: 0.02,
          section: SEC_SALOON,
          profile: [
            [-0.5, 0.8, 0.96, 0.36], [-0.492, 0.9, 1.0, 0.24], [-0.47, 0.96, 1.01, 0.17], [-0.42, 0.99, 1.0], [-0.3, 1.0, 0.99], [0.1, 1.0, 0.95],
            [0.2, 1.0, 0.92], [0.3, 0.995, 0.88], [0.4, 0.98, 0.84], [0.46, 0.94, 0.79], [0.485, 0.88, 0.73, 0.19], [0.5, 0.78, 0.64, 0.26],
          ],
          glass: { base: 0.95, roof: 1.46, xf: 0.21, xb: -0.47, rf: 0.02, rb: -0.42, wb: 0.41, wt: 0.335, bow: 0.018, bulge: 0.05, arch: 0.04, frame: 'gloss', pillars: [[0.48, 0.07, 'black'], [0.14, 0.09, 'black'], [0, 0.1, 'paint']], aPillar: 'black' },
          wheel: { r: 0.33, width: 0.245, xf: 0.3, xr: -0.29, caliper: '#e3b62b' },
          rim: { style: 'mesh', spokes: 10, color: '#c9a24a', frac: 0.73 },
          flares: '#141517',
          hatch: true,
          doors: [[0.21, 0.0], [0.0, -0.21]],
          handles: [0.07, -0.14],
          sill: '#141517',
          sillHeight: 0.12,
          accentColor: '#c9a24a',
          bumpers: [{ y: 0.25, h: 0.08, span: 0.84, material: 'black' }, { y: 0.28, h: 0.08, span: 0.84, material: 'black' }],
          plateRear: 0.6,
          plateFront: 0.36,
          livery(g, f, L) {
            const { l, M } = L;
            // A white number panel on the front doors and a gold pinstripe.
            L.band(g, f, 0.03 * l, 0.17 * l, 0.5 * M, 0.78 * M, '#f2f2ee');
            L.text(g, f, '27', 0.1 * l, 0.64 * M, 0.2 * M, '#16181b', { stretch: 1.0 });
            L.band(g, f, -0.46 * l, 0.44 * l, 0.44 * M, 0.455 * M, '#c9a24a');
            L.text(g, f, 'KODIAK RS', -0.12 * l, 0.36 * M, 0.08 * M, '#c9a24a', { stretch: 1.2, spacing: 0.02 * M });
          },
          details(k) {
            const { M, S, sets, at } = k;
            for (const side of [-1, 1]) {
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.45, zOut: 0.99, yIn: [0.63, 0.71], yOut: [0.66, 0.78], wrap: 0.3, wrapTip: 0.3, wrapRise: 0.02 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.47, 0.645 * M], [side * hw * 0.62, 0.64 * M], [side * hw * 0.78, 0.7 * M], [side * hw * 0.96, 0.765 * M]], CV_LED, 0.014);
              projector(k, k.head(side), 'front', side * hw * 0.7, 0.7 * M, 0.04, side);
              k.halo('head', side, k.surf('front', side * hw * 0.7, 0.7 * M, 0.05 * M), 1);
              const tail = cornerLamp(k, -1, side, { zIn: 0.62, zOut: 0.99, yIn: [0.84, 0.98], yOut: [0.8, 0.99], wrap: 0.2, wrapTip: 0.6 });
              ledLine(k, k.tail(side), 'rear', [[side * tail.hw * 0.68, 0.9 * M], [side * tail.hw * 0.96, 0.89 * M]], CV_TAIL_BAR, 0.02);
              k.halo('tail', side, k.surf('rear', side * tail.hw * 0.8, 0.9 * M, 0.05 * M), 1);
              // Fog lamps in the bumper corners, vents behind the front wheels.
              k.round(sets.drl, S.cylinder24, 'front', side * hw * 0.8, 0.36 * M, 0.05 * M, 0.02 * M, { color: '#fff4dc', lift: 0.02 * M }, side);
              k.patch(sets.trim, 'side', 0.16 * k.l, 0.22 * k.l, 0.55 * M, 0.66 * M, { side, cell: 'slats', color: '#1a1c1f', finish: 'gloss', tile: 0.1 * M });
            }
            const gw = at(0.49 * k.l, 0.5 * M).half;
            k.grille('front', -gw * 0.5, gw * 0.5, 0.52 * M, 0.66 * M, { cell: 'hex', color: '#2c2f33', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.12 * M });
            k.grille('front', -gw * 0.62, gw * 0.62, 0.26 * M, 0.44 * M, { cell: 'honeycomb', color: '#2c2f33', tile: 0.12 * M });
            badge(k, 'front', 0, 0.59, 0.04);
            // The bonnet scoop, its black intake facing forward.
            const sx = 0.33 * k.l,
              sy = k.top(sx);
            k.bar(sets.paint, [0.25 * k.l, sy + 0.02 * M, 0], [0.4 * k.l, k.top(0.4 * k.l) + 0.045 * M, 0], 0.07 * M, 0.5 * M, 0.035 * M, { uvOf: k.topUv });
            k.add(sets.trim, S.box, 0.402 * k.l, k.top(0.4 * k.l) + 0.05 * M, 0, 0.01 * M, 0.05 * M, 0.44 * M, { cell: 'honeycomb', color: '#1a1b1d', finish: 'gloss' });
            // The rally light pod, four lamps across the nose.
            for (const z of [-0.45, -0.15, 0.15, 0.45]) {
              k.round(sets.trim, S.cylinder24, 'front', z * M, 0.83 * M, 0.075 * M, 0.08 * M, { color: '#15171a', finish: 'gloss', lift: 0.06 * M });
              k.round(sets.drl, S.dome, 'front', z * M, 0.83 * M, 0.06 * M, 0.03 * M, { color: '#fff4dc', lift: 0.11 * M });
            }
            // The roof wing on two stands.
            const g = k.g,
              wx = g.rb * k.l - 0.05 * M,
              wy = g.roof + 0.1 * M;
            k.bar(sets.paint, [wx, wy, -g.wt * k.w * 1.05], [wx, wy, g.wt * k.w * 1.05], 0.04 * M, 0.34 * M, 0.02 * M, k.sw('paint'), [0.3, 1, 0]);
            for (const side of [-1, 1]) k.bar(sets.trim, [wx + 0.05 * M, g.roof - 0.02 * M, side * 0.4 * M], [wx, wy, side * 0.4 * M], 0.03 * M, 0.12 * M, 0.01 * M, { color: '#141517', finish: 'gloss' });
            k.add(sets.drl, S.box, wx - 0.12 * M, wy + 0.01 * M, 0, 0.02 * M, 0.02 * M, 0.4 * M, { color: '#ff3a2e' });
            roofRails(k, '#141517', 0.8);
            exhaustTips(k, [-0.36, -0.24, 0.24, 0.36], 0.27, 0.04, '#b9bec3');
            k.patch(sets.trim, 'rear', -0.55 * M, 0.55 * M, 0.2 * M, 0.3 * M, { cell: 'slats', color: '#1a1c1f', finish: 'plastic', tile: 0.06 * M, lift: 0.012 * M });
            plateLight(k, 0.6);
          },
        }),
        /* HELLFIRE CUSTOM: a chopped '32 three-window coupe: the blown V8 through
           the hood, zoomie headers down the sides, a chrome grille shell and
           bucket headlamps, cycle-winged front wheels on a dropped axle, fat
           whitewalled rear tyres under the rear wings, flames down the flanks. */
        hotrod: civBody('hotrod', {
          yb: 0.22,
          h: 1.02,
          arches: 0.06,
          archSpan: 0.11,
          section: SEC_BOXY,
          sections: [
            [-0.5, SEC_BOXY],
            [0.13, SEC_BOXY],
            [0.2, [[0, 0.92], [0.1, 0.99], [0.3, 1], [0.7, 1], [0.85, 0.98], [0.93, 0.93], [0.975, 0.84], [1, 0.62], [1, 0.3], [1, 0]]],
          ],
          profile: [
            [-0.5, 0.74, 0.8, 0.42], [-0.485, 0.84, 0.92, 0.3], [-0.45, 0.9, 0.99, 0.22], [-0.32, 0.96, 1.02], [-0.2, 0.9, 1.03], [0.1, 0.9, 1.02],
            [0.15, 0.86, 1.0], [0.2, 0.47, 0.97], [0.3, 0.44, 0.96], [0.43, 0.43, 0.97], [0.47, 0.44, 0.99, 0.32], [0.49, 0.42, 0.97, 0.38], [0.5, 0.36, 0.9, 0.42],
          ],
          glass: { base: 1.02, roof: 1.33, xf: 0.13, xb: -0.25, rf: 0.1, rb: -0.22, wb: 0.36, wt: 0.33, bow: 0.005, bulge: 0.01, arch: 0.03, frame: 'chrome', pillars: [[0.58, 0.1, 'paint'], [0, 0.18, 'paint']], aPillar: 'paint', aWidth: 0.06 },
          wheel: { r: 0.32, rr: 0.39, width: 0.17, wr: 0.34, xf: 0.37, xr: -0.29, exposedFront: true, zf: 0.72 },
          rim: { style: 'smoothie', color: '#e3e7ea', frac: 0.62, finish: 'chrome' },
          tyre: 'whitewall',
          finish: { roughness: 0.18, metalness: 0.35 },
          hatch: true,
          mirrors: false,
          noWipers: true,
          doors: [[0.12, -0.14]],
          handles: [-0.12],
          handleStyle: 'chrome',
          plates: true,
          frontPlate: false,
          plateRear: 0.55,
          bumpers: [{ y: 0.42, h: 0.08, span: 1.6, material: 'chrome', d: 0.06 }, { y: 0.38, h: 0.08, span: 1.0, material: 'chrome', d: 0.06 }],
          livery(g, f, L) {
            const { l, M } = L;
            // Flames licking back from the grille along the hood sides and cowl.
            const tongues = [[0.12, 0.72, 0.16], [0.02, 0.8, 0.12], [0.08, 0.64, 0.1], [-0.04, 0.88, 0.07]];
            for (const [end, y, t] of tongues) {
              L.polygon(g, f, [[0.5 * l, (y - t * 0.8) * M], [0.5 * l, (y + t) * M], [(end + 0.1) * l, (y + t * 0.5) * M], [end * l, y * M], [(end + 0.1) * l, (y - t * 0.3) * M]], '#e8661a');
              L.polygon(g, f, [[0.5 * l, (y - t * 0.4) * M], [0.5 * l, (y + t * 0.6) * M], [(end + 0.18) * l, (y + t * 0.25) * M], [(end + 0.1) * l, y * M]], '#f3c43a');
            }
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            const nose = 0.5 * l;
            // The chrome grille shell standing at the nose.
            k.grille('front', -0.26 * M, 0.26 * M, 0.45 * M, 0.95 * M, { cell: 'bars', color: '#c9ced3', finish: 'chrome', frame: CV_CHROME, tile: 0.05 * M, lift: 0.02 * M });
            for (const side of [-1, 1]) {
              // Bucket headlamps on a bar ahead of the wheels.
              const hz = side * 0.52 * M;
              k.bar(sets.trim, [nose - 0.1 * M, 0.78 * M, 0], [nose - 0.1 * M, 0.78 * M, hz], 0.04 * M, 0.04 * M, 0.015 * M, { color: CV_CHROME, finish: 'chrome' });
              k.add(sets.trim, S.cone, nose - 0.02 * M, 0.84 * M, hz, 0.12 * M, 0.2 * M, 0.12 * M, { color: CV_CHROME, finish: 'chrome' }, 0, 0, -Math.PI / 2);
              k.add(k.head(side), S.dome, nose + 0.08 * M, 0.84 * M, hz, 0.1 * M, 0.05 * M, 0.1 * M, { color: '#f4f1e6', finish: 'lens' }, 0, 0, -Math.PI / 2);
              k.halo('head', side, [nose + 0.14 * M, 0.84 * M, hz], 1);
              // Front wings over the exposed wheels, the dropped axle, a spring.
              const [front] = k.wheels,
                wz = side * front.z;
              for (let q = 0; q < 6; q++) {
                const a0 = 0.35 + (q / 6) * 2.3,
                  a1 = 0.35 + ((q + 1) / 6) * 2.3,
                  R = front.r * 1.18;
                k.bar(sets.paint, [front.x + Math.cos(a0) * R, front.r + Math.sin(a0) * R, wz], [front.x + Math.cos(a1) * R, front.r + Math.sin(a1) * R, wz], 0.02 * M, front.width * 1.25, 0.008 * M, k.sw('paint'), [0, 0, 1]);
              }
              k.bar(sets.trim, [front.x, front.r * 0.9, 0], [front.x, front.r, wz], 0.06 * M, 0.06 * M, 0.02 * M, { color: '#c9ced3', finish: 'chrome' });
              // Zoomie headers: four chrome pipes up and back out of each bank.
              for (let i = 0; i < 4; i++) {
                const x = 0.22 * l + i * 0.1 * M,
                  z0 = side * 0.26 * M,
                  z1 = side * 0.46 * M;
                k.bar(sets.trim, [x, 0.8 * M, z0], [x - 0.08 * M, 0.9 * M, z1], 0.04 * M, 0.04 * M, 0.018 * M, { color: '#e8e2d6', finish: 'chrome' });
                k.bar(sets.trim, [x - 0.08 * M, 0.9 * M, z1], [x - 0.34 * M, 1.02 * M, z1 * 1.04], 0.045 * M, 0.045 * M, 0.02 * M, { color: '#e8e2d6', finish: 'chrome' });
              }
              // Rear lamps: little round teardrops on the wings.
              const tw = at(-0.46 * l, 0.8 * M).half;
              k.round(k.tail(side), S.cylinder24, 'rear', side * tw * 0.75, 0.78 * M, 0.06 * M, 0.04 * M, { color: '#d61e1e', finish: 'lens', lift: 0.03 * M }, side);
              k.halo('tail', side, k.surf('rear', side * tw * 0.75, 0.78 * M, 0.06 * M), 1);
              // Running board between the wings.
              k.patch(sets.trim, 'side', -0.2 * l, 0.12 * l, 0.28 * M, 0.34 * M, { side, cell: 'tread', color: '#2a2c2f', finish: 'rubber', tile: 0.2 * M, lift: 0.02 * M });
            }
            // The blown V8: block and rocker covers, the supercharger, its scoop.
            const ex = 0.3 * l;
            k.bar(sets.trim, [ex - 0.35 * M, 1.02 * M, 0], [ex + 0.35 * M, 1.02 * M, 0], 0.16 * M, 0.44 * M, 0.05 * M, { color: '#1c1d20', finish: 'satin' });
            for (const side of [-1, 1]) k.bar(sets.trim, [ex - 0.32 * M, 1.12 * M, side * 0.15 * M], [ex + 0.32 * M, 1.12 * M, side * 0.15 * M], 0.07 * M, 0.1 * M, 0.03 * M, { color: '#dfe3e6', finish: 'chrome' });
            k.bar(sets.trim, [ex - 0.25 * M, 1.22 * M, 0], [ex + 0.25 * M, 1.22 * M, 0], 0.18 * M, 0.26 * M, 0.06 * M, { color: '#c9ced3', finish: 'chrome' });
            k.bar(sets.trim, [ex - 0.12 * M, 1.4 * M, 0], [ex + 0.12 * M, 1.44 * M, 0], 0.16 * M, 0.3 * M, 0.04 * M, { color: '#16181b', finish: 'gloss' });
            k.add(sets.trim, S.box, ex + 0.125 * M, 1.42 * M, 0, 0.01 * M, 0.12 * M, 0.26 * M, { cell: 'mesh', color: '#9aa0a6', finish: 'chrome' });
            k.disc(sets.trim, S.cylinder24, ex + 0.32 * M, 1.0 * M, 0, 0.12 * M, 0.08 * M, [1, 0, 0], { color: '#3a3d41', finish: 'satin' });
            exhaustTips(k, [-0.3], 0.3, 0.04);
          },
        }),
        /* V12 TEMPEST: a front-mid V12 grand tourer (812 / DBS): a long bonnet with
           vents, a wide slatted grille, lamps swept up into the wings, a fastback
           roof, four round tail lamps and quad pipes in the diffuser. */
        supercar: civBody('supercar', {
          yb: 0.12,
          h: 0.86,
          arches: 0.03,
          archSpan: 0.1,
          section: SEC_WEDGE,
          sections: [[-0.5, SEC_FENDER_SOFT], [-0.25, SEC_FENDER_SOFT], [-0.12, SEC_WEDGE], [0.02, SEC_WEDGE], [0.14, SEC_FENDER], [0.5, SEC_FENDER]],
          profile: [
            [-0.5, 0.8, 0.82, 0.3], [-0.49, 0.9, 0.88, 0.2], [-0.47, 0.96, 0.9, 0.13], [-0.4, 1.0, 0.9], [-0.3, 1.02, 0.89], [-0.15, 1.0, 0.86],
            [0.0, 0.98, 0.84], [0.1, 0.985, 0.8], [0.25, 0.995, 0.75], [0.36, 0.985, 0.7], [0.44, 0.955, 0.63], [0.475, 0.9, 0.56, 0.14], [0.49, 0.82, 0.48, 0.18], [0.5, 0.72, 0.4, 0.24],
          ],
          glass: { base: 0.83, roof: 1.27, xf: 0.07, xb: -0.42, rf: -0.09, rb: -0.3, wb: 0.39, wt: 0.3, bow: 0.022, bulge: 0.06, arch: 0.05, frame: 'gloss', pillars: [[0.5, 0.05, 'black']], aPillar: 'black' },
          wheel: { r: 0.36, width: 0.27, wr: 0.32, xf: 0.3, xr: -0.29, caliper: '#e3b62b' },
          rim: { style: 'split', spokes: 5, color: '#2a2c30', frac: 0.76, centreLock: true, lipColor: '#9aa0a6' },
          hatch: true,
          doors: [[0.06, -0.14]],
          handles: [-0.08],
          handleStyle: 'flush',
          bumpers: [{ y: 0.18, h: 0.05, span: 0.85, material: 'black' }, { y: 0.2, h: 0.06, span: 0.85, material: 'black' }],
          plateRear: 0.46,
          plateFront: 0.28,
          frontPlate: false,
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.55, zOut: 0.995, yIn: [0.46, 0.5], yOut: [0.52, 0.6], wrap: 0.55, wrapTip: 0.2, wrapRise: 0.08 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.56, 0.49 * M], [side * hw * 0.8, 0.53 * M], [side * hw * 0.98, 0.585 * M]], CV_LED, 0.012);
              projector(k, k.head(side), 'front', side * hw * 0.76, 0.53 * M, 0.03, side);
              k.halo('head', side, k.surf('front', side * hw * 0.76, 0.53 * M, 0.05 * M), 1);
              // Twin round tail lamps each side on a dark panel.
              const tw = at(-0.495 * l, 0.72 * M).half;
              k.patch(sets.trim, 'rear', side * tw * 0.4, side * tw * 0.97, 0.66 * M, 0.78 * M, { color: '#101113', finish: 'gloss', cols: 4, rows: 1 });
              for (const zf of [0.56, 0.82]) {
                k.round(k.tail(side), S.cylinder24, 'rear', side * tw * zf, 0.72 * M, 0.055 * M, 0.03 * M, { color: '#a8121a', finish: 'lens', lift: 0.02 * M }, side);
                k.round(k.tail(side), S.torus, 'rear', side * tw * zf, 0.72 * M, 0.05 * M, 0.03 * M, { color: CV_TAIL_BAR, lift: 0.035 * M }, side);
              }
              k.halo('tail', side, k.surf('rear', side * tw * 0.7, 0.72 * M, 0.05 * M), 1);
              // Bonnet vents, side gills behind the front wheels.
              k.patch(sets.trim, 'top', 0.16 * l, 0.24 * l, side * 0.3 * M, side * 0.4 * M, { cell: 'louvre', color: '#3a3d42', finish: 'gloss', tile: 0.08 * M, lift: 0.012 * M });
              k.patch(sets.trim, 'side', 0.13 * l, 0.2 * l, 0.42 * M, 0.62 * M, { side, cell: 'slats', color: '#16171a', finish: 'gloss', tile: 0.08 * M });
            }
            const gw = at(0.495 * l, 0.3 * M).half;
            k.grille('front', -gw * 0.8, gw * 0.8, 0.2 * M, 0.4 * M, { cell: 'slats', color: '#26282c', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.05 * M });
            badge(k, 'front', 0, 0.44, 0.035, '#d9b14a');
            k.patch(sets.trim, 'rear', -0.7 * M, 0.7 * M, 0.14 * M, 0.3 * M, { cell: 'slats', color: '#16181b', finish: 'carbon', tile: 0.06 * M, lift: 0.012 * M });
            exhaustTips(k, [-0.46, -0.34, 0.34, 0.46], 0.24, 0.045, '#bfc4c9');
            const x = -0.48 * l,
              tw = at(x, k.top(x)).half;
            k.bar(sets.paint, [x, k.top(x) + 0.02 * M, -tw * 0.85], [x, k.top(x) + 0.02 * M, tw * 0.85], 0.025 * M, 0.1 * M, 0.012 * M, k.sw('paint'), [0, 1, 0]);
            plateLight(k, 0.46);
          },
        }),
        /* MONARCH V12: a Phantom-style limousine saloon: an upright stainless
           temple grille with the mascot, slim rectangular lamps, a long bonnet,
           coach doors, chrome everywhere, seven thin chrome spokes. */
        luxury: civBody('luxury', {
          yb: 0.2,
          h: 1.08,
          arches: 0.006,
          section: SEC_TALL,
          profile: [
            [-0.5, 0.82, 0.96, 0.34], [-0.492, 0.92, 1.03, 0.24], [-0.47, 0.975, 1.07, 0.2], [-0.42, 0.995, 1.08], [-0.3, 1.0, 1.08], [-0.2, 1.0, 1.08],
            [0.15, 1.0, 1.07], [0.25, 1.0, 1.06], [0.4, 0.995, 1.04], [0.47, 0.97, 1.0, 0.2], [0.49, 0.93, 0.95, 0.24], [0.5, 0.86, 0.88, 0.3],
          ],
          glass: { base: 1.07, roof: 1.62, xf: 0.19, xb: -0.33, rf: 0.04, rb: -0.25, wb: 0.41, wt: 0.345, bow: 0.012, bulge: 0.04, arch: 0.04, frame: 'chrome', pillars: [[0.47, 0.09, 'paint'], [0, 0.2, 'paint']] },
          wheel: { r: 0.39, width: 0.255, xf: 0.31, xr: -0.29 },
          rim: { style: 'spider', spokes: 7, color: '#e3e7ea', frac: 0.7, finish: 'chrome', capColor: '#e3e7ea' },
          doors: [[0.19, -0.02], [-0.02, -0.24]],
          handles: [0.1, -0.02],
          handleStyle: 'chrome',
          sill: '#9aa0a6',
          bumpers: [{ y: 0.36, h: 0.06, span: 0.85, material: 'chrome', d: 0.06 }, { y: 0.4, h: 0.06, span: 0.85, material: 'chrome', d: 0.06 }],
          plateRear: 0.68,
          plateFront: 0.4,
          details(k) {
            const { M, S, sets, at, l } = k;
            const hw = at(0.495 * l, 0.8 * M).half;
            // The temple grille: tall stainless vanes in a heavy surround, the mascot on top.
            k.grille('front', -hw * 0.33, hw * 0.33, 0.48 * M, 0.95 * M, { cell: 'bars', color: '#dfe3e6', finish: 'chrome', frame: CV_CHROME, frameWidth: 0.05 * M, tile: 0.04 * M, lift: 0.03 * M });
            const top = k.surf('front', 0, 0.96 * M, 0.04 * M);
            k.add(sets.trim, S.box, top[0] - 0.03 * M, top[1] + 0.07 * M, 0, 0.08 * M, 0.12 * M, 0.02 * M, { color: CV_CHROME, finish: 'chrome' }, 0, 0, 0.4);
            for (const side of [-1, 1]) {
              lampPatch(k, k.head(side), 'front', side * hw * 0.42, side * hw * 0.92, () => [0.78 * M, 0.9 * M], '#aeb5bc');
              ledLine(k, sets.drl, 'front', [[side * hw * 0.44, 0.905 * M], [side * hw * 0.9, 0.905 * M]], CV_LED, 0.014);
              projector(k, k.head(side), 'front', side * hw * 0.55, 0.84 * M, 0.035, side);
              projector(k, k.head(side), 'front', side * hw * 0.78, 0.84 * M, 0.035, side);
              k.halo('head', side, k.surf('front', side * hw * 0.66, 0.84 * M, 0.05 * M), 1.1);
              k.patch(sets.trim, 'front', side * hw * 0.5, side * hw * 0.9, 0.4 * M, 0.5 * M, { cell: 'bars', color: '#9aa0a6', finish: 'chrome', tile: 0.04 * M });
              const tw = at(-0.495 * l, 0.9 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.66, side * tw * 0.99, () => [0.74 * M, 1.02 * M], '#8e1016');
              k.patch(k.tail(side), 'rear', side * tw * 0.7, side * tw * 0.8, 0.8 * M, 0.86 * M, { color: CV_REVERSE, finish: 'lens', cols: 2, rows: 1, lift: 0.02 * M });
              k.halo('tail', side, k.surf('rear', side * tw * 0.82, 0.9 * M, 0.05 * M), 1.1);
            }
            // A chrome strip along the waist and across the tail.
            const tw = at(-0.495 * l, 0.9 * M).half;
            k.strip(sets.trim, 'rear', [[-tw * 0.62, 0.95 * M], [tw * 0.62, 0.95 * M]], 0.02 * M, 0.02 * M, { color: CV_CHROME, finish: 'chrome' });
            for (const side of [-1, 1])
              k.strip(sets.trim, 'side', [[-0.47 * l, 0.62 * M], [0.47 * l, 0.62 * M]], 0.02 * M, 0.015 * M, { color: CV_CHROME, finish: 'chrome' }, side);
            exhaustTips(k, [-0.55, 0.55], 0.3, 0.04);
            plateLight(k, 0.68);
          },
        }),
        /* SOVEREIGN STRETCH: a stretched Town Car: upright chrome grille, a long
           run of dark glass split by black pillars, chrome waist and bumpers. */
        limousine: civBody('limousine', {
          yb: 0.2,
          h: 1.0,
          arches: 0.004,
          archSpan: 0.05,
          section: SEC_BOXY,
          profile: [
            [-0.5, 0.82, 0.88, 0.36], [-0.495, 0.92, 0.95, 0.26], [-0.485, 0.97, 0.99, 0.2], [-0.46, 0.99, 1.0], [-0.3, 1.0, 1.0], [0.3, 1.0, 1.0],
            [0.38, 1.0, 0.98], [0.45, 0.99, 0.95], [0.48, 0.96, 0.9, 0.2], [0.493, 0.9, 0.84, 0.24], [0.5, 0.82, 0.76, 0.3],
          ],
          glass: { base: 0.98, roof: 1.47, xf: 0.3, xb: -0.4, rf: 0.24, rb: -0.36, wb: 0.415, wt: 0.35, bow: 0.012, bulge: 0.04, arch: 0.04, frame: 'chrome', pillars: [[0.9, 0.08, 'black'], [0.72, 0.06, 'black'], [0.5, 0.06, 'black'], [0.28, 0.06, 'black'], [0.1, 0.06, 'black'], [0, 0.14, 'paint']] },
          wheel: { r: 0.35, width: 0.235, xf: 0.4, xr: -0.36 },
          rim: { style: 'mesh', spokes: 12, color: '#e3e7ea', frac: 0.68, finish: 'chrome' },
          doors: [[0.3, 0.2], [0.2, 0.08], [-0.12, -0.24]],
          handles: [0.24, 0.12, -0.18],
          handleStyle: 'chrome',
          sill: '#9aa0a6',
          bumpers: [{ y: 0.35, h: 0.1, span: 0.86, material: 'chrome', d: 0.08 }, { y: 0.36, h: 0.1, span: 0.86, material: 'chrome', d: 0.08 }],
          plateRear: 0.62,
          details(k) {
            const { M, S, sets, at, l } = k;
            const hw = at(0.497 * l, 0.66 * M).half;
            k.grille('front', -hw * 0.4, hw * 0.4, 0.5 * M, 0.74 * M, { cell: 'bars', color: '#dfe3e6', finish: 'chrome', frame: CV_CHROME, frameWidth: 0.04 * M, tile: 0.035 * M, lift: 0.02 * M });
            badge(k, 'front', 0, 0.77, 0.04);
            for (const side of [-1, 1]) {
              lampPatch(k, k.head(side), 'front', side * hw * 0.44, side * hw * 0.97, () => [0.6 * M, 0.74 * M], '#b9c0c7');
              projector(k, k.head(side), 'front', side * hw * 0.6, 0.67 * M, 0.04, side);
              projector(k, k.head(side), 'front', side * hw * 0.82, 0.67 * M, 0.04, side);
              k.halo('head', side, k.surf('front', side * hw * 0.7, 0.67 * M, 0.05 * M), 1);
              const tw = at(-0.497 * l, 0.82 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.3, side * tw * 0.99, () => [0.74 * M, 0.9 * M], '#8e1016');
              k.halo('tail', side, k.surf('rear', side * tw * 0.75, 0.82 * M, 0.05 * M), 1);
              k.strip(sets.trim, 'side', [[-0.48 * l, 0.6 * M], [0.48 * l, 0.6 * M]], 0.025 * M, 0.015 * M, { color: CV_CHROME, finish: 'chrome' }, side);
            }
            exhaustTips(k, [-0.6, 0.6], 0.3, 0.035);
            plateLight(k, 0.62);
            roofFin(k, 0.1);
          },
        }),
        /* RANGER 4X4: a full-size luxury SUV after the Range Rover: a clamshell
           bonnet, slim lamps either side of a mesh grille, the floating black roof
           over blacked-out pillars, side vents, a flat tailgate with slim lamps. */
        suv: civBody('suv', {
          yb: 0.26,
          h: 1.16,
          arches: 0.01,
          section: SEC_TALL,
          profile: [
            [-0.5, 0.86, 1.12, 0.42], [-0.494, 0.95, 1.16, 0.32], [-0.48, 0.99, 1.17, 0.27], [-0.4, 1.0, 1.17], [-0.2, 1.0, 1.16], [0.2, 1.0, 1.14],
            [0.3, 1.0, 1.12], [0.42, 0.99, 1.09], [0.475, 0.965, 1.05, 0.28], [0.49, 0.93, 1.0, 0.32], [0.5, 0.86, 0.92, 0.38],
          ],
          glass: { base: 1.15, roof: 1.87, xf: 0.22, xb: -0.48, rf: 0.06, rb: -0.46, wb: 0.43, wt: 0.37, bow: 0.012, bulge: 0.04, arch: 0.03, frame: 'gloss', pillars: [[0.53, 0.08, 'black'], [0.2, 0.09, 'black'], [0, 0.12, 'black']], aPillar: 'black' },
          wheel: { r: 0.41, width: 0.265, xf: 0.3, xr: -0.29, caliper: '#2e3136' },
          rim: { style: 'split', spokes: 5, color: '#8d939a', frac: 0.7 },
          roofColor: '#0d0e10',
          roofSwatch: 'roof',
          mirrorSwatch: 'roof',
          hatch: true,
          flares: null,
          doors: [[0.22, -0.02], [-0.02, -0.23]],
          handles: [0.06, -0.16],
          handleStyle: 'flush',
          sill: '#16181b',
          sillHeight: 0.14,
          lowerColor: '#1b1d20',
          bumpers: [{ y: 0.42, h: 0.1, span: 0.8, material: 'black' }, { y: 0.44, h: 0.1, span: 0.82, material: 'black' }],
          plateRear: 0.8,
          plateFront: 0.5,
          livery(g, f, L) {
            // Dark lower cladding round the sills.
            L.band(g, f, -0.52 * L.l, 0.52 * L.l, 0, 0.42 * L.M, 'rgba(22,24,27,0.94)');
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            const hw = at(0.497 * l, 0.9 * M).half;
            k.grille('front', -hw * 0.46, hw * 0.46, 0.7 * M, 0.95 * M, { cell: 'mesh', color: '#2a2c30', frame: '#3d4146', frameFinish: 'satin', tile: 0.08 * M });
            k.grille('front', -hw * 0.55, hw * 0.55, 0.46 * M, 0.62 * M, { cell: 'mesh', color: '#2a2c30', tile: 0.08 * M });
            for (const side of [-1, 1]) {
              const { hw: lw } = cornerLamp(k, 1, side, { zIn: 0.5, zOut: 0.99, yIn: [0.86, 0.95], yOut: [0.88, 0.98], wrap: 0.22, wrapTip: 0.6 });
              ledLine(k, sets.drl, 'front', [[side * lw * 0.52, 0.87 * M], [side * lw * 0.98, 0.9 * M]], CV_LED, 0.014);
              projector(k, k.head(side), 'front', side * lw * 0.62, 0.925 * M, 0.03, side);
              projector(k, k.head(side), 'front', side * lw * 0.76, 0.93 * M, 0.03, side);
              projector(k, k.head(side), 'front', side * lw * 0.9, 0.935 * M, 0.03, side);
              k.halo('head', side, k.surf('front', side * lw * 0.75, 0.92 * M, 0.05 * M), 1.1);
              // Slim vertical-ish tail lamps wrapping onto the flanks.
              const tail = cornerLamp(k, -1, side, { zIn: 0.72, zOut: 0.995, yIn: [0.92, 1.1], yOut: [0.9, 1.12], wrap: 0.18, wrapTip: 0.7 });
              ledLine(k, k.tail(side), 'rear', [[side * tail.hw * 0.74, 1.0 * M], [side * tail.hw * 0.98, 1.0 * M]], CV_TAIL_BAR, 0.02);
              k.halo('tail', side, k.surf('rear', side * tail.hw * 0.85, 1.0 * M, 0.05 * M), 1.1);
              // The side vent on the front door.
              k.patch(sets.trim, 'side', 0.16 * l, 0.23 * l, 0.72 * M, 0.8 * M, { side, cell: 'slats', color: '#2a2c30', finish: 'gloss', tile: 0.06 * M });
            }
            // A dark band across the tailgate between the lamps, badge lettering.
            const tw = at(-0.497 * l, 1.0 * M).half;
            k.patch(sets.trim, 'rear', -tw * 0.72, tw * 0.72, 0.96 * M, 1.04 * M, { color: '#101113', finish: 'gloss', cols: 6, rows: 1, lift: 0.014 * M });
            k.patch(sets.trim, 'rear', -tw * 0.7, tw * 0.7, 0.3 * M, 0.42 * M, { color: '#9aa0a6', finish: 'satin', cols: 6, rows: 1, lift: 0.02 * M });
            exhaustTips(k, [-0.55, 0.55], 0.38, 0.04, '#b9bec3');
            plateLight(k, 0.8);
            roofFin(k, 0.1);
          },
        }),
        /* MULE VAN: a high-roof panel van (Transit / Sprinter): a short nose, a
           tall raked screen, slab sides with a sliding-door track, twin rear doors
           with small windows, plastic bumpers and steel wheels. */
        van: civBody('van', {
          yb: 0.24,
          h: 1.12,
          uvTop: 2.3,
          section: SEC_TALL,
          profile: [
            [-0.5, 0.95, 1.1, 0.34], [-0.496, 0.99, 1.12, 0.26], [0.26, 1.0, 1.12], [0.3, 0.99, 1.1], [0.38, 0.97, 1.02], [0.45, 0.94, 0.94], [0.48, 0.9, 0.88, 0.26], [0.495, 0.84, 0.8, 0.3], [0.5, 0.78, 0.72, 0.36],
          ],
          glass: { base: 1.1, roof: 2.5, xf: 0.3, xb: -0.498, rf: 0.16, rb: -0.494, wb: 0.47, wt: 0.455, bow: 0.004, bulge: 0.03, arch: 0.03, sideFrom: 0.83, frame: 'gloss', pillars: [[0.83, 0.06, 'black']], aPillar: 'black', buttress: 'paint' },
          wheel: { r: 0.37, width: 0.225, xf: 0.35, xr: -0.24 },
          rim: { style: 'steel', color: '#2e3136', capColor: '#1b1d20', frac: 0.64 },
          hatch: true,
          doors: [[0.3, 0.16], [0.08, -0.12]],
          handles: [0.2, 0.0],
          sill: '#1b1d20',
          sillHeight: 0.12,
          bumpers: [{ y: 0.4, h: 0.16, span: 0.9, material: 'black', d: 0.1 }, { y: 0.42, h: 0.14, span: 0.9, material: 'black', d: 0.1 }],
          plateRear: 0.62,
          plateFront: 0.44,
          livery(g, f, L) {
            const { l, M } = L;
            // The sliding door's rail and seams, the rear doors' centre seam.
            L.band(g, f, -0.2 * l, 0.1 * l, 2.02 * M, 2.03 * M, 'rgba(10,10,11,0.6)');
            L.band(g, f, -0.12 * l, 0.1 * l, 0.52 * M, 0.53 * M, 'rgba(10,10,11,0.5)');
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            const hw = at(0.497 * l, 0.8 * M).half,
              g = k.g;
            k.grille('front', -hw * 0.6, hw * 0.6, 0.6 * M, 0.82 * M, { cell: 'bars', color: '#2a2c30', frame: CV_GLOSS, frameFinish: 'plastic', tile: 0.06 * M });
            badge(k, 'front', 0, 0.72, 0.05, '#c9ced3');
            for (const side of [-1, 1]) {
              const { hw: lw } = cornerLamp(k, 1, side, { zIn: 0.62, zOut: 0.99, yIn: [0.72, 0.86], yOut: [0.74, 0.95], wrap: 0.26, wrapTip: 0.5, wrapRise: 0.03 });
              projector(k, k.head(side), 'front', side * lw * 0.8, 0.82 * M, 0.04, side);
              ledLine(k, sets.drl, 'front', [[side * lw * 0.64, 0.745 * M], [side * lw * 0.96, 0.78 * M]], CV_LED, 0.014);
              k.halo('head', side, k.surf('front', side * lw * 0.8, 0.82 * M, 0.05 * M), 1.1);
              // Tall tail lamps up the rear pillars.
              const tw = at(-0.498 * l, 1.0 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.86, side * tw * 0.995, () => [0.6 * M, 1.2 * M], '#8e1016');
              k.patch(k.tail(side), 'rear', side * tw * 0.88, side * tw * 0.98, 0.8 * M, 0.9 * M, { color: CV_REVERSE, finish: 'lens', cols: 1, rows: 1, lift: 0.02 * M });
              k.halo('tail', side, k.surf('rear', side * tw * 0.92, 0.95 * M, 0.05 * M), 1);
              // Sliding-door track on the right, plastic rubbing strip down both sides.
              k.patch(sets.trim, 'side', -0.46 * l, 0.28 * l, 0.5 * M, 0.58 * M, { side, color: '#1b1d20', finish: 'plastic', cols: 8, rows: 1, lift: 0.01 * M });
            }
            // Rear doors: paint over the lower glass and round the two small windows.
            const rear = (s, t) => {
              const p = glassPoint(g, l, k.w, 'rear', s, t);
              return [p[0] - 0.012 * M, p[1], p[2]];
            };
            const panel = (s0, s1, t0, t1) => {
              const geo = gridGeometry(2, 2, (u, v) => rear(lerpNumber(s0, s1, u), lerpNumber(t0, t1, v)), (p, out) => out.set(p.x + 3, p.y, p.z));
              civAddMatrix(sets.paint, geo, civIdentity, k.sw('paint'));
              geo.dispose();
            };
            panel(-1, 1, 0, 0.5);
            panel(-1, 1, 0.82, 1);
            panel(-1, -0.86, 0.5, 0.82);
            panel(0.86, 1, 0.5, 0.82);
            panel(-0.08, 0.08, 0.5, 0.82);
            k.bar(sets.trim, rear(0, 0.02), rear(0, 0.5), 0.01 * M, 0.012 * M, 0.004 * M, { color: '#0c0d0f', finish: 'gloss' });
            // A third brake light over the doors, roof rails.
            k.bar(sets.drl, rear(-0.25, 0.97), rear(0.25, 0.97), 0.03 * M, 0.02 * M, 0.01 * M, { color: '#ff3a2e' });
            k.patch(sets.trim, 'rear', -0.9 * M, 0.9 * M, 0.3 * M, 0.34 * M, { cell: 'tread', color: '#2a2c2f', finish: 'rubber', tile: 0.3 * M, lift: 0.08 * M });
            plateLight(k, 0.62);
          },
        }),
        /* WORKHORSE: a crew-cab full-size pickup after the F-150: a tall flat bonnet,
           a chrome bar grille between C-clamp lamps, four doors, an open bed with
           its liner, tie-down rails and a tailgate, black flares. */
        pickup: civBody('pickup', {
          yb: 0.34,
          h: 1.28,
          arches: 0.012,
          section: SEC_TALL,
          profile: [
            [-0.5, 0.97, 1.26, 0.52], [-0.495, 0.99, 1.27, 0.4], [-0.49, 1.0, 0.96], [-0.12, 1.0, 0.96], [-0.108, 1.0, 1.28], [0.2, 1.0, 1.28],
            [0.3, 1.0, 1.27], [0.42, 0.99, 1.25], [0.47, 0.975, 1.22, 0.34], [0.49, 0.95, 1.16, 0.38], [0.5, 0.9, 1.06, 0.44],
          ],
          glass: { base: 1.27, roof: 1.95, xf: 0.25, xb: -0.103, rf: 0.1, rb: -0.1, wb: 0.43, wt: 0.37, bow: 0.012, bulge: 0.04, arch: 0.03, frame: 'gloss', pillars: [[0.5, 0.08, 'black'], [0, 0.1, 'paint']] },
          wheel: { r: 0.42, width: 0.27, xf: 0.34, xr: -0.29, caliper: '#2e3136' },
          rim: { style: 'offroad', spokes: 6, color: '#8d939a', frac: 0.66 },
          flares: '#16181b',
          hatch: true,
          doors: [[0.25, 0.08], [0.08, -0.1]],
          handles: [0.13, -0.03],
          handleStyle: 'chrome',
          fuel: [-0.2, 1.1],
          bumpers: [{ y: 0.5, h: 0.2, span: 0.92, material: 'chrome', d: 0.12 }, { y: 0.52, h: 0.18, span: 0.95, material: 'chrome', d: 0.12 }],
          plateRear: 0.62,
          plateFront: 0.56,
          details(k) {
            const { M, S, sets, at, l } = k;
            const hw = at(0.497 * l, 1.0 * M).half;
            // The chrome bar grille filling the nose, the C-clamp lamps at its ends.
            k.grille('front', -hw * 0.66, hw * 0.66, 0.74 * M, 1.12 * M, { cell: 'bars', color: '#c9ced3', finish: 'chrome', frame: CV_CHROME, frameWidth: 0.05 * M, tile: 0.08 * M, lift: 0.02 * M });
            k.strip(sets.trim, 'front', [[-hw * 0.64, 0.93 * M], [hw * 0.64, 0.93 * M]], 0.03 * M, 0.05 * M, { color: CV_CHROME, finish: 'chrome', lift: 0.05 * M });
            badge(k, 'front', 0, 0.93, 0.08, '#1c2a55');
            for (const side of [-1, 1]) {
              lampPatch(k, k.head(side), 'front', side * hw * 0.68, side * hw * 0.99, () => [0.86 * M, 1.12 * M], '#a8b0b8');
              k.strip(sets.drl, 'front', [[side * hw * 0.7, 1.11 * M], [side * hw * 0.97, 1.11 * M], [side * hw * 0.97, 0.87 * M], [side * hw * 0.7, 0.87 * M]], 0.022 * M, 0.02 * M, { color: CV_LED, lift: 0.03 * M });
              projector(k, k.head(side), 'front', side * hw * 0.84, 1.0 * M, 0.05, side);
              k.halo('head', side, k.surf('front', side * hw * 0.84, 1.0 * M, 0.05 * M), 1.2);
              // Tall tail lamps on the bed's corners.
              const tw = at(-0.499 * l, 1.1 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.86, side * tw * 0.995, () => [0.8 * M, 1.24 * M], '#8e1016');
              k.patch(k.tail(side), 'rear', side * tw * 0.88, side * tw * 0.98, 0.9 * M, 0.98 * M, { color: CV_REVERSE, finish: 'lens', cols: 1, rows: 1, lift: 0.02 * M });
              k.halo('tail', side, k.surf('rear', side * tw * 0.92, 1.05 * M, 0.05 * M), 1.1);
              // The bed side walls and their caps, the running boards.
              const z = side * (at(-0.3 * l, 1.2 * M).half - 0.04 * M);
              k.bar(sets.paint, [-0.495 * l, 1.12 * M, z], [-0.118 * l, 1.12 * M, z], 0.33 * M, 0.08 * M, 0.02 * M, k.sw('paint'));
              k.bar(sets.trim, [-0.495 * l, 1.3 * M, z], [-0.118 * l, 1.3 * M, z], 0.03 * M, 0.1 * M, 0.012 * M, { color: '#16181b', finish: 'plastic' });
              k.patch(sets.trim, 'side', -0.18 * l, 0.22 * l, 0.36 * M, 0.42 * M, { side, cell: 'tread', color: '#2a2c2f', finish: 'rubber', tile: 0.25 * M, lift: 0.07 * M });
            }
            // The bed liner and the tailgate.
            const bz = at(-0.3 * l, 1.2 * M).half - 0.08 * M;
            k.patch(sets.trim, 'top', -0.49 * l, -0.12 * l, -bz, bz, { cell: 'slats', color: '#1b1c1e', finish: 'rubber', tile: 0.25 * M, lift: 0.01 * M });
            k.bar(sets.paint, [-0.497 * l, 1.12 * M, -bz], [-0.497 * l, 1.12 * M, bz], 0.33 * M, 0.06 * M, 0.02 * M, k.sw('paint'));
            k.bar(sets.trim, [-0.497 * l, 1.3 * M, -bz], [-0.497 * l, 1.3 * M, bz], 0.03 * M, 0.08 * M, 0.01 * M, { color: '#16181b', finish: 'plastic' });
            badge(k, 'rear', 0, 1.1, 0.07, '#1c2a55');
            k.bar(sets.drl, [-0.1 * l, 1.99 * M, -0.3 * M], [-0.1 * l, 1.99 * M, 0.3 * M], 0.03 * M, 0.03 * M, 0.01 * M, { color: '#ff3a2e' });
            exhaustTips(k, [0.7], 0.42, 0.045, '#b9bec3');
            plateLight(k, 0.62);
          },
        }),
        /* CHEVETTE Z06: a mid-engined flat-plane V8 supercar after the C8 Z06:
           a short sharp nose with angular lamps, the cab pushed forward, huge
           intakes in the flanks, a glass engine cover showing the V8, stacked
           angular tail lamps, four pipes in the middle and a tall wing. */
        chevette: civBody('chevette', {
          yb: 0.11,
          h: 0.9,
          arches: 0.035,
          archSpan: 0.1,
          section: SEC_WEDGE,
          sections: [[-0.5, SEC_FENDER], [-0.2, SEC_FENDER], [-0.09, SEC_WEDGE], [0.1, SEC_WEDGE], [0.2, SEC_FENDER], [0.5, SEC_FENDER]],
          profile: [
            [-0.5, 0.84, 0.86, 0.3], [-0.49, 0.93, 0.92, 0.2], [-0.47, 0.98, 0.95, 0.12], [-0.4, 1.02, 0.96], [-0.3, 1.04, 0.95], [-0.2, 1.0, 0.94],
            [-0.05, 0.96, 0.9], [0.08, 0.97, 0.86], [0.2, 0.99, 0.79], [0.3, 1.0, 0.74], [0.4, 0.98, 0.66], [0.46, 0.93, 0.56, 0.12], [0.49, 0.84, 0.47, 0.16], [0.5, 0.74, 0.38, 0.22],
          ],
          glass: { base: 0.88, roof: 1.22, xf: 0.13, xb: -0.42, rf: -0.06, rb: -0.17, wb: 0.39, wt: 0.3, bow: 0.022, bulge: 0.06, arch: 0.05, frame: 'gloss', sideFrom: 0.42, pillars: [[0.42, 0.06, 'black']], aPillar: 'black', buttress: 'paint' },
          wheel: { r: 0.345, rr: 0.365, width: 0.27, wr: 0.345, xf: 0.3, xr: -0.29, caliper: '#e3b62b' },
          rim: { style: 'spider', spokes: 10, color: '#1b1c1f', frac: 0.78, centreLock: false, lipColor: '#3a3d42' },
          hatch: true,
          doors: [[0.12, -0.08]],
          handles: [],
          plateFront: 0.3,
          frontPlate: false,
          plateRear: 0.42,
          bumpers: [{ y: 0.14, h: 0.04, span: 0.9, material: 'black', d: 0.1 }, { y: 0.18, h: 0.06, span: 0.9, material: 'black' }],
          livery(g, f, L) {
            // Twin stripes, thin, offset to the driver's side as the Z06's.
            L.stripe(-0.52 * L.l, 0.52 * L.l, -0.3, -0.18, 'rgba(12,13,15,0.92)');
            L.stripe(-0.52 * L.l, 0.52 * L.l, -0.14, -0.1, 'rgba(12,13,15,0.92)');
            // Carbon lower sills.
            L.band(g, f, -0.3 * L.l, 0.25 * L.l, 0, 0.22 * L.M, 'rgba(20,21,23,0.96)');
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              // Angular lamps: a sharp blade rising into the wing with an LED brow.
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.48, zOut: 0.995, yIn: [0.4, 0.46], yOut: [0.47, 0.56], wrap: 0.42, wrapTip: 0.15, wrapRise: 0.07 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.5, 0.458 * M], [side * hw * 0.7, 0.49 * M], [side * hw * 0.99, 0.56 * M]], CV_LED, 0.014);
              projector(k, k.head(side), 'front', side * hw * 0.64, 0.44 * M, 0.025, side);
              projector(k, k.head(side), 'front', side * hw * 0.78, 0.47 * M, 0.025, side);
              k.halo('head', side, k.surf('front', side * hw * 0.72, 0.46 * M, 0.05 * M), 1);
              // The flank intake ahead of the rear wheel, the brake duct in the nose.
              k.patch(sets.trim, 'side', -0.2 * l, -0.05 * l, 0.36 * M, 0.78 * M, { side, cell: 'honeycomb', color: '#1a1b1d', finish: 'gloss', tile: 0.1 * M, lift: 0.004 * M, span: (x) => { const f = (x + 0.2 * l) / (0.15 * l); return [(0.36 + 0.06 * f) * M, (0.66 + 0.12 * f) * M]; } });
              k.patch(sets.trim, 'front', side * hw * 0.55, side * hw * 0.92, 0.18 * M, 0.34 * M, { cell: 'honeycomb', color: '#1a1b1d', finish: 'gloss', tile: 0.08 * M });
              // Stacked angular tail lamps.
              const tw = at(-0.495 * l, 0.8 * M).half;
              lampPatch(k, k.tail(side), 'rear', side * tw * 0.42, side * tw * 0.99, (z) => { const f = (Math.abs(z) / tw - 0.42) / 0.57; return [(0.74 + f * 0.05) * M, (0.82 + f * 0.06) * M]; }, '#2a0508');
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.44, 0.76 * M], [side * tw * 0.97, 0.815 * M]], CV_TAIL_BAR, 0.014);
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.5, 0.8 * M], [side * tw * 0.97, 0.86 * M]], CV_TAIL_BAR, 0.012);
              k.halo('tail', side, k.surf('rear', side * tw * 0.72, 0.8 * M, 0.05 * M), 1);
              // Wing stands.
              k.bar(sets.trim, [-0.46 * l, k.top(-0.46 * l), side * 0.55 * M], [-0.49 * l, k.top(-0.46 * l) + 0.26 * M, side * 0.55 * M], 0.03 * M, 0.2 * M, 0.012 * M, { color: '#111214', finish: 'carbon', cell: 'carbon' });
            }
            // Front splitter and grille, the quad pipes in a square in the middle.
            const gw = at(0.495 * l, 0.25 * M).half;
            k.grille('front', -gw * 0.5, gw * 0.5, 0.16 * M, 0.3 * M, { cell: 'honeycomb', color: '#1f2023', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.08 * M });
            badge(k, 'front', 0, 0.36, 0.035, '#c9ced3');
            k.patch(sets.trim, 'rear', -0.2 * M, 0.2 * M, 0.2 * M, 0.44 * M, { color: '#0c0c0d', finish: 'gloss', cols: 2, rows: 2, lift: 0.012 * M });
            exhaustTips(k, [-0.1, 0.1], 0.26, 0.045, '#3a3d42');
            exhaustTips(k, [-0.1, 0.1], 0.38, 0.045, '#3a3d42');
            k.patch(sets.trim, 'rear', -0.8 * M, -0.24 * M, 0.14 * M, 0.3 * M, { cell: 'honeycomb', color: '#141517', finish: 'gloss', tile: 0.08 * M, lift: 0.01 * M });
            k.patch(sets.trim, 'rear', 0.24 * M, 0.8 * M, 0.14 * M, 0.3 * M, { cell: 'honeycomb', color: '#141517', finish: 'gloss', tile: 0.08 * M, lift: 0.01 * M });
            // The V8 under the engine glass: the plenum and its red covers.
            const ex = -0.3 * l,
              ey = 0.82 * M;
            k.bar(sets.trim, [ex - 0.3 * M, ey, 0], [ex + 0.25 * M, ey, 0], 0.08 * M, 0.5 * M, 0.03 * M, { color: '#1c1d1f', finish: 'satin' });
            for (const side of [-1, 1]) k.bar(sets.trim, [ex - 0.28 * M, ey + 0.06 * M, side * 0.18 * M], [ex + 0.22 * M, ey + 0.06 * M, side * 0.18 * M], 0.04 * M, 0.1 * M, 0.02 * M, { color: '#b3121b', finish: 'gloss' });
            // The wing.
            const wy = k.top(-0.46 * l) + 0.27 * M;
            k.bar(sets.trim, [-0.492 * l, wy, -0.78 * M], [-0.492 * l, wy, 0.78 * M], 0.035 * M, 0.3 * M, 0.015 * M, { color: '#111214', finish: 'carbon', cell: 'carbon' }, [0.2, 1, 0]);
            for (const side of [-1, 1]) k.add(sets.trim, S.box, -0.492 * l, wy - 0.03 * M, side * 0.79 * M, 0.34 * M, 0.12 * M, 0.02 * M, { color: '#111214', finish: 'carbon' });
            k.add(sets.drl, S.box, -0.5 * l + 0.04 * M, wy - 0.01 * M, 0, 0.02 * M, 0.015 * M, 0.5 * M, { color: '#ff3a2e' });
            plateLight(k, 0.42);
          },
        }),
        /* BRUTINI SVJ: a V12 wedge hypercar after the Aventador SVJ: one line from
           the nose to the roof, scissor-door cut lines, Y lamps and hexagons
           everywhere, huge flank intakes, a louvred engine cover, the big wing,
           twin hexagon pipes high in the tail. */
        brutini: civBody('brutini', {
          yb: 0.1,
          h: 0.84,
          arches: 0.03,
          archSpan: 0.1,
          section: SEC_BRUTINI,
          sections: [[-0.5, SEC_FENDER], [-0.2, SEC_FENDER], [-0.1, SEC_BRUTINI], [0.12, SEC_BRUTINI], [0.22, SEC_FENDER], [0.5, SEC_FENDER]],
          profile: [
            [-0.5, 0.86, 0.9, 0.28], [-0.49, 0.94, 0.95, 0.18], [-0.47, 0.99, 0.97, 0.11], [-0.4, 1.03, 0.97], [-0.3, 1.04, 0.95], [-0.22, 1.0, 0.92],
            [-0.08, 0.95, 0.86], [0.08, 0.97, 0.8], [0.2, 0.99, 0.73], [0.3, 1.0, 0.68], [0.4, 0.97, 0.6], [0.46, 0.9, 0.49, 0.1], [0.485, 0.78, 0.4, 0.12], [0.5, 0.56, 0.31, 0.17],
          ],
          glass: { base: 0.82, roof: 1.13, xf: 0.2, xb: -0.44, rf: -0.1, rb: -0.19, wb: 0.39, wt: 0.27, bow: 0.02, bulge: 0.04, arch: 0.03, frame: 'gloss', sideFrom: 0.45, pillars: [[0.45, 0.05, 'black']], aPillar: 'black', buttress: 'paint' },
          wheel: { r: 0.355, rr: 0.375, width: 0.29, wr: 0.36, xf: 0.3, xr: -0.285, caliper: '#e3b62b' },
          rim: { style: 'y', spokes: 5, color: '#262729', frac: 0.78, centreLock: true, twist: 0.2 },
          hatch: true,
          doors: [[0.19, -0.1]],
          handles: [],
          frontPlate: false,
          plateRear: 0.5,
          bumpers: [{ y: 0.13, h: 0.04, span: 0.92, material: 'black', d: 0.12 }, { y: 0.16, h: 0.06, span: 0.9, material: 'black' }],
          livery(g, f, L) {
            const { l, M } = L;
            // Carbon sills and a thin tricolour on the lower sill ahead of the rear wheels.
            L.band(g, f, -0.28 * l, 0.26 * l, 0, 0.24 * M, 'rgba(20,21,23,0.97)');
            L.band(g, f, -0.2 * l, -0.14 * l, 0.25 * M, 0.265 * M, '#1f8a3c');
            L.band(g, f, -0.14 * l, -0.08 * l, 0.25 * M, 0.265 * M, '#f0f0ec');
            L.band(g, f, -0.08 * l, -0.02 * l, 0.25 * M, 0.265 * M, '#c8141c');
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              // Hexagon-cut lamps with the Y of LEDs.
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.56, zOut: 0.995, yIn: [0.33, 0.38], yOut: [0.38, 0.47], wrap: 0.34, wrapTip: 0.15, wrapRise: 0.06 });
              const y0 = 0.375 * M;
              ledLine(k, sets.drl, 'front', [[side * hw * 0.58, y0], [side * hw * 0.74, 0.4 * M]], CV_LED, 0.014);
              ledLine(k, sets.drl, 'front', [[side * hw * 0.74, 0.4 * M], [side * hw * 0.92, 0.44 * M]], CV_LED, 0.014);
              ledLine(k, sets.drl, 'front', [[side * hw * 0.74, 0.4 * M], [side * hw * 0.86, 0.355 * M]], CV_LED, 0.014);
              projector(k, k.head(side), 'front', side * hw * 0.8, 0.41 * M, 0.024, side);
              k.halo('head', side, k.surf('front', side * hw * 0.76, 0.4 * M, 0.05 * M), 1);
              // Y-shaped intakes in the nose, the huge flank intakes, the scissor-door cut.
              k.patch(sets.trim, 'front', side * hw * 0.38, side * hw * 0.96, 0.14 * M, 0.3 * M, { cell: 'hex', color: '#141517', finish: 'gloss', tile: 0.1 * M });
              k.patch(sets.trim, 'side', -0.24 * l, -0.06 * l, 0.3 * M, 0.74 * M, { side, cell: 'hex', color: '#141517', finish: 'gloss', tile: 0.12 * M, lift: 0.004 * M, span: (x) => { const f = (x + 0.24 * l) / (0.18 * l); return [(0.3 + 0.1 * f) * M, (0.5 + 0.24 * f) * M]; } });
              k.patch(sets.trim, 'top', -0.2 * l, -0.07 * l, side * 0.58 * M, side * 0.8 * M, { cell: 'hex', color: '#141517', finish: 'gloss', tile: 0.1 * M, lift: 0.01 * M });
              // Y tail lamps floating in the black tail.
              const tw = at(-0.495 * l, 0.78 * M).half;
              k.patch(sets.trim, 'rear', side * tw * 0.3, side * tw * 0.99, 0.56 * M, 0.88 * M, { cell: 'hex', color: '#101113', finish: 'gloss', tile: 0.1 * M, lift: 0.006 * M });
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.5, 0.74 * M], [side * tw * 0.7, 0.76 * M]], CV_TAIL_BAR, 0.022);
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.7, 0.76 * M], [side * tw * 0.95, 0.84 * M]], CV_TAIL_BAR, 0.022);
              ledLine(k, k.tail(side), 'rear', [[side * tw * 0.7, 0.76 * M], [side * tw * 0.92, 0.68 * M]], CV_TAIL_BAR, 0.022);
              k.halo('tail', side, k.surf('rear', side * tw * 0.72, 0.76 * M, 0.05 * M), 1.1);
              // The wing's pillars.
              k.bar(sets.trim, [-0.44 * l, k.top(-0.44 * l), side * 0.4 * M], [-0.48 * l, k.top(-0.44 * l) + 0.3 * M, side * 0.4 * M], 0.04 * M, 0.2 * M, 0.015 * M, { color: '#111214', finish: 'carbon', cell: 'carbon' });
            }
            // A carbon splitter, the hexagon pipes high in the middle, the diffuser.
            k.patch(sets.trim, 'front', -0.8 * M, 0.8 * M, 0.1 * M, 0.15 * M, { cell: 'carbon', color: '#2a2b2e', finish: 'carbon', tile: 0.1 * M, lift: 0.03 * M });
            badge(k, 'front', 0, 0.34, 0.035, '#d9b14a');
            exhaustTips(k, [-0.08, 0.08], 0.62, 0.06, '#3a3d42', 'hex');
            k.patch(sets.trim, 'rear', -0.85 * M, 0.85 * M, 0.12 * M, 0.34 * M, { cell: 'carbon', color: '#2a2b2e', finish: 'carbon', tile: 0.1 * M, lift: 0.012 * M });
            // The louvred engine cover: hexagon glass over the V12.
            k.patch(sets.trim, 'top', -0.42 * l, -0.24 * l, -0.34 * M, 0.34 * M, { cell: 'hex', color: '#2a2c30', finish: 'gloss', tile: 0.12 * M, lift: 0.02 * M });
            const wy = k.top(-0.44 * l) + 0.31 * M;
            k.bar(sets.trim, [-0.485 * l, wy, -0.86 * M], [-0.485 * l, wy, 0.86 * M], 0.04 * M, 0.34 * M, 0.018 * M, { color: '#111214', finish: 'carbon', cell: 'carbon' }, [0.25, 1, 0]);
            for (const side of [-1, 1]) k.add(sets.trim, S.box, -0.485 * l, wy - 0.03 * M, side * 0.87 * M, 0.38 * M, 0.14 * M, 0.02 * M, { color: '#111214', finish: 'carbon' });
            plateLight(k, 0.5);
          },
        }),
        /* CAVALINO 458: a flowing mid-engined berlinetta after the 458 Italia: the
           single mouth with its winglets, lamps sweeping far up the wings, small
           flank gills, twin round tail lamps a side, a louvred engine cover and
           three pipes stacked in the middle of the diffuser. */
        cavalino: civBody('cavalino', {
          yb: 0.11,
          h: 0.88,
          arches: 0.045,
          archSpan: 0.11,
          section: SEC_SPORT,
          sections: [[-0.5, SEC_FENDER], [-0.2, SEC_FENDER], [-0.09, SEC_SPORT], [0.1, SEC_SPORT], [0.2, SEC_FENDER], [0.5, SEC_FENDER]],
          profile: [
            [-0.5, 0.82, 0.84, 0.3], [-0.49, 0.92, 0.9, 0.2], [-0.47, 0.98, 0.93, 0.12], [-0.4, 1.02, 0.94], [-0.3, 1.03, 0.93], [-0.2, 0.99, 0.92],
            [-0.05, 0.95, 0.88], [0.08, 0.96, 0.82], [0.2, 0.98, 0.73], [0.3, 0.99, 0.66], [0.4, 0.97, 0.6], [0.46, 0.92, 0.53, 0.12], [0.49, 0.82, 0.45, 0.16], [0.5, 0.7, 0.38, 0.22],
          ],
          glass: { base: 0.86, roof: 1.2, xf: 0.16, xb: -0.4, rf: -0.06, rb: -0.17, wb: 0.39, wt: 0.29, bow: 0.024, bulge: 0.07, arch: 0.05, frame: 'gloss', sideFrom: 0.34, pillars: [[0.34, 0.05, 'black']], aPillar: 'black', buttress: 'paint' },
          wheel: { r: 0.34, rr: 0.35, width: 0.25, wr: 0.3, xf: 0.3, xr: -0.29, caliper: '#e3b62b' },
          rim: { style: 'split', spokes: 5, color: '#c3c8cd', frac: 0.76, centreLock: false },
          hatch: true,
          doors: [[0.16, -0.1]],
          handles: [-0.06],
          handleStyle: 'flush',
          frontPlate: false,
          plateRear: 0.48,
          bumpers: [{ y: 0.14, h: 0.04, span: 0.8, material: 'black', d: 0.08 }, { y: 0.18, h: 0.05, span: 0.86, material: 'black' }],
          livery(g, f, L) {
            // The shield on each front wing: yellow with a black horse-ish mark.
            L.draw(g, f, 0.3 * L.l, 0.62 * L.M, (c, px) => {
              c.fillStyle = '#f2c500';
              c.beginPath();
              c.moveTo(-0.05 * px * L.M, 0.06 * px * L.M);
              c.lineTo(0.05 * px * L.M, 0.06 * px * L.M);
              c.lineTo(0.05 * px * L.M, -0.02 * px * L.M);
              c.quadraticCurveTo(0, -0.08 * px * L.M, -0.05 * px * L.M, -0.02 * px * L.M);
              c.closePath();
              c.fill();
              c.fillStyle = '#111';
              c.fillRect(-0.012 * px * L.M, -0.03 * px * L.M, 0.024 * px * L.M, 0.07 * px * L.M);
              for (const [color, x] of [['#1f8a3c', -0.05], ['#f0f0ec', -0.017], ['#c8141c', 0.017]]) {
                c.fillStyle = color;
                c.fillRect(x * px * L.M, 0.05 * px * L.M, 0.033 * px * L.M, 0.012 * px * L.M);
              }
            });
          },
          details(k) {
            const { M, S, sets, at, l } = k;
            for (const side of [-1, 1]) {
              // Boomerang lamps sweeping far back up the wings.
              const { hw } = cornerLamp(k, 1, side, { zIn: 0.6, zOut: 0.995, yIn: [0.4, 0.46], yOut: [0.48, 0.56], wrap: 0.72, wrapTip: 0.12, wrapRise: 0.12 });
              ledLine(k, sets.drl, 'front', [[side * hw * 0.62, 0.46 * M], [side * hw * 0.85, 0.5 * M], [side * hw * 0.99, 0.56 * M]], CV_LED, 0.014);
              projector(k, k.head(side), 'front', side * hw * 0.78, 0.47 * M, 0.028, side);
              k.halo('head', side, k.surf('front', side * hw * 0.78, 0.47 * M, 0.05 * M), 1);
              // The winglets in the mouth's corners, gills behind the doors.
              k.bar(sets.trim, k.surf('front', side * hw * 0.4, 0.28 * M, 0.04 * M), k.surf('front', side * hw * 0.62, 0.3 * M, 0.04 * M), 0.02 * M, 0.08 * M, 0.008 * M, { color: '#16171a', finish: 'gloss' });
              k.patch(sets.trim, 'side', -0.14 * l, -0.07 * l, 0.5 * M, 0.66 * M, { side, cell: 'slats', color: '#141517', finish: 'gloss', tile: 0.05 * M, lift: 0.004 * M });
              // Twin round tail lamps high on each side.
              const tw = at(-0.495 * l, 0.78 * M).half;
              for (const zf of [0.5, 0.78]) {
                k.round(k.tail(side), S.cylinder24, 'rear', side * tw * zf, 0.76 * M, 0.06 * M, 0.03 * M, { color: '#a8121a', finish: 'lens', lift: 0.02 * M }, side);
                k.round(k.tail(side), S.torus, 'rear', side * tw * zf, 0.76 * M, 0.052 * M, 0.03 * M, { color: CV_TAIL_BAR, lift: 0.035 * M }, side);
              }
              k.halo('tail', side, k.surf('rear', side * tw * 0.64, 0.76 * M, 0.05 * M), 1);
            }
            // The single mouth.
            const gw = at(0.495 * l, 0.25 * M).half;
            k.grille('front', -gw * 0.62, gw * 0.62, 0.16 * M, 0.32 * M, { cell: 'mesh', color: '#1f2023', frame: CV_GLOSS, frameFinish: 'gloss', tile: 0.06 * M });
            k.round(sets.trim, S.cylinder24, 'top', 0.45 * l, 0, 0.035 * M, 0.018 * M, { color: '#f2c500', finish: 'gloss' });
            // Three pipes stacked in a triangle in the diffuser.
            k.patch(sets.trim, 'rear', -0.75 * M, 0.75 * M, 0.14 * M, 0.34 * M, { cell: 'mesh', color: '#141517', finish: 'gloss', tile: 0.07 * M, lift: 0.012 * M });
            exhaustTips(k, [-0.12, 0.12], 0.26, 0.05, '#aeb4ba');
            exhaustTips(k, [0], 0.4, 0.05, '#aeb4ba');
            // The engine cover louvres and the integrated lip.
            k.patch(sets.trim, 'top', -0.46 * l, -0.4 * l, -0.4 * M, 0.4 * M, { cell: 'louvre', color: '#1a1b1d', finish: 'gloss', tile: 0.08 * M, lift: 0.012 * M });
            const ex = -0.3 * l;
            k.bar(sets.trim, [ex - 0.3 * M, 0.82 * M, 0], [ex + 0.25 * M, 0.82 * M, 0], 0.08 * M, 0.48 * M, 0.03 * M, { color: '#1c1d1f', finish: 'satin' });
            for (const side of [-1, 1]) k.bar(sets.trim, [ex - 0.28 * M, 0.87 * M, side * 0.17 * M], [ex + 0.22 * M, 0.87 * M, side * 0.17 * M], 0.04 * M, 0.1 * M, 0.02 * M, { color: '#b3121b', finish: 'gloss' });
            const x = -0.485 * l,
              tw = at(x, k.top(x)).half;
            k.bar(sets.paint, [x, k.top(x) + 0.02 * M, -tw * 0.8], [x, k.top(x) + 0.02 * M, tw * 0.8], 0.025 * M, 0.1 * M, 0.012 * M, k.sw('paint'), [0, 1, 0]);
            plateLight(k, 0.48);
          },
        }),
      };
