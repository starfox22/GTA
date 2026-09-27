      // Garage 3D styles: the island shops' looks (coachworks, seaside) and the lot slab the off-canvas shops stand on.
      /* A shop's `style` (garages.js GARAGES) swaps the wall finishes, the roof
         sheet and the fascia's colours, and adds its own dressing:
           coachworks  MONARCH COACHWORKS: white render with shadow-gap panels,
                       black steel, gold lettering, a glass canopy over the apron,
                       clipped bay cones in planters, no billboard (a gold name
                       along the parapet instead).
           seaside     PIER GARAGE and CORAL COAST GARAGE: white weatherboard and
                       pale sea-green render under a teal metal gable, a striped
                       awning over the office window, a life ring by the door.
         `slab` shops (off the city's ground canvas) get their lot and forecourt
         as a thin asphalt slab, the street shops have it painted. */
      const garagePanelTile = garageCanvas('panels', 256, 256, (g, w, h) => {
        g.fillStyle = '#eeebe3';
        g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(40,36,30,0.28)';
        for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 2, h);
        g.fillStyle = 'rgba(40,36,30,0.18)';
        for (let y = 0; y < h; y += 128) g.fillRect(0, y, w, 2);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        for (let x = 2; x < w; x += 64) g.fillRect(x, 0, 1, h);
      });
      garagePanelTile.wrapS = garagePanelTile.wrapT = Three.RepeatWrapping;
      const garageWeatherboardTile = garageCanvas('weatherboard', 256, 256, (g, w, h) => {
        for (let i = 0; i < 16; i++) {
          g.fillStyle = i % 2 ? '#f3f0e8' : '#eeebe2';
          g.fillRect(0, i * 16, w, 16);
          g.fillStyle = 'rgba(60,70,72,0.35)';
          g.fillRect(0, i * 16 + 14, w, 2);
          g.fillStyle = 'rgba(255,255,255,0.5)';
          g.fillRect(0, i * 16, w, 1);
        }
      });
      garageWeatherboardTile.wrapS = garageWeatherboardTile.wrapT = Three.RepeatWrapping;
      const garageStyleMats = {
        render: staticMat('#cfe6df', 0.85),
        black: staticMat('#141517', 0.4, 0.5),
        gold: staticMat('#c9a24e', 0.3, 0.9),
        glassCanopy: new Three.MeshStandardMaterial({ color: '#9fc3cc', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45, depthWrite: false }),
        planter: staticMat('#2b2d30', 0.6, 0.2),
        box: staticMat('#35582f', 0.9),
        awningA: staticMat('#e8e4d8', 0.85),
        awningB: staticMat('#2f7f86', 0.85),
        ring: staticMat('#e8452c', 0.6),
        asphalt: staticMat('#4f5a5c', 0.95),
        kerb: staticMat('#b9b8b0', 0.9),
      };
      const garagePanels = (w, h) => garageTiled('panels', w, h, garagePanelTile, { tile: 16 }),
        garageWeatherboard = (w, h) => garageTiled('weatherboard', w, h, garageWeatherboardTile, { tile: 16 }),
        garageTealRoof = (w, h) => garageTiled('tealroof', w, h, ROOF_TEXTURES.metal, { color: '#2f7f86', roughness: 0.5, metalness: 0.35, tile: 20 });
      /* The wall finishes by style: `brick` for the facade piers and the office,
         `clad` for the side and back walls. */
      function garageWallKit(s) {
        if (s.style === 'coachworks') return { brick: garagePanels, clad: garagePanels };
        if (s.style === 'seaside') return { brick: () => garageStyleMats.render, clad: garageWeatherboard };
        if (s.rustic) return { brick: garageStone, clad: garageBoards };
        return { brick: garageBrick, clad: garageCladding };
      }
      // The gabled roofs' sheet: red for the mountain shop, teal by the sea.
      const garageRoofSheet = (s) => (s.style === 'seaside' ? garageTealRoof : garageRedRoof);
      // The fascia's ground and letters.
      const garageFasciaColors = (s) => (s.style === 'coachworks' ? { ground: '#111214', ink: '#d9b25a', glow: '#ffe6b0' } : { ground: s.color, ink: '#10181c', glow: '#fff4d8' });
      /* Under a `slab` shop: its lot and forecourt in asphalt, a kerb along the
         lot's back and sides. */
      function garageLotSlab(s, group) {
        if (!s.slab) return;
        const half = Math.min(108, (s.clear || 110) - 2),
          y0 = s.y - 98,
          y1 = s.slabTo || s.lotY1;
        box(group, s.x, 0.12, (y0 + y1) / 2, half * 2, 0.24, y1 - y0, garageStyleMats.asphalt);
        box(group, s.x, 0.5, y0 + 1, half * 2, 1, 2, garageStyleMats.kerb);
        for (const side of [-1, 1]) box(group, s.x + side * (half - 1), 0.5, (y0 + y1) / 2, 2, 1, y1 - y0, garageStyleMats.kerb);
        const F = s.forecourt;
        if (F) box(group, F.x + F.w / 2, 0.1, F.y + F.h / 2, F.w, 0.2, F.h, garageStyleMats.asphalt);
      }
      /* The style's own dressing, after the shop is built. */
      function dressGarageStyle(s, parts) {
        const { group, upper, B, wallX0, wallX1, front, eaves } = parts,
          P = GARAGE_PLAN,
          M = garageStyleMats;
        if (s.style === 'coachworks') {
          // A glass canopy over the apron on two black steel arms, lit underneath.
          const w = s.door.x1 - s.door.x0 + 30,
            d = 3 * UNITS_PER_METRE,
            y = P.doorHeight + 1.2;
          B(s.bayX, y, front + d / 2, w, 0.6, d, M.glassCanopy, upper);
          B(s.bayX, y + 0.5, front + d, w + 1, 1, 1, M.black, upper);
          for (const x of [s.bayX - w / 2, s.bayX + w / 2]) {
            B(x, y + 0.5, front + d / 2, 1, 1, d, M.black, upper);
            rod(upper, new Three.Vector3(x, y + 0.6, front + d), new Three.Vector3(x, y + 12, front + 0.4), 0.3, M.black);
          }
          addGlow(s.bayX, y - 1, front + d / 2, 22, '#fff1d6', 0.6, { day: 0 });
          // Black steel frame round the door opening and a gold rule under the fascia.
          B(s.bayX, P.doorHeight + 3.4, front + 0.5, wallX1 - wallX0, 0.6, 0.8, M.gold, upper);
          // Clipped bay cones in square planters either side of the apron.
          for (const x of [s.door.x0 - 14, s.door.x1 + 14]) {
            B(x, 3, front + 10, 7, 6, 7, M.planter);
            const cone = mesh(new Three.ConeGeometry(3.4, 12, 10), M.box, group, x, 12, front + 10);
            cone.castShadow = true;
          }
          // The name in gold along the parapet (the city shops' billboard is not here).
          const title = sign(s.name, s.bayX, front + 1.3, 96, '#d9b25a');
          title.position.y = title.userData.backing.position.y = eaves + P.roof + 3.5;
          parts.roof.add(title, title.userData.backing);
          signSpill(s.bayX, front + 16, 60, '#ffe6b0', 0.3);
        } else if (s.style === 'seaside') {
          // A striped awning over the office window, a life ring by the door.
          const O = s.office,
            ox = O.x + O.w / 2 - 10,
            stripes = 6,
            aw = 26;
          for (let k = 0; k < stripes; k++) {
            const strip = B(ox - aw / 2 + (k + 0.5) * (aw / stripes), 22, front + 4, aw / stripes, 0.5, 8, k % 2 ? M.awningB : M.awningA);
            strip.rotation.x = 0.35;
          }
          const ring = mesh(new Three.TorusGeometry(2.4, 0.7, 8, 18), M.ring, group, s.door.x0 - 8, 20, front + 0.8);
          ring.castShadow = false;
        }
      }
