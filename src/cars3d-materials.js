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
