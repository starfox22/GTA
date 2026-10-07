      // Rear badges: every car's model name in its maker's lettering on the tail (CAR_BADGES), glyphs painted into the
      // trim atlas's lower half (civBadgeGlyphs) and laid letter by letter on the rear surface into the kit's trim
      // (civRearBadges): no texture, material or draw call of their own.
      /**
       * REAR BADGES
       * Bright metal (or gold) letters on the boot lid, tailgate or engine cover, a little bigger than real badges (4-6
       * cm capitals, the pickup's tailgate 8.5) so the chase camera behind the car reads which car it is. Three lettering styles share the trim
       * atlas's lower half: 'block' (bold condensed capitals), 'wide' (spaced capitals across the tail, as exotic and
       * luxury makers do) and 'italic' (a sporting slant). Each letter is one quad on the tail's own surface (its point
       * and normal: the letters follow the curve), merged into the trim before the cabin, so the body impostors carry
       * them too; the trim material alpha-tests the atlas (only the glyph cells have transparent pixels), and at
       * distance the glyphs' coverage falls under the test on the small mips and the letters simply go.
       *
       * CAR_BADGES per type: `text` (the game's name for the car, vehicles' `name`, shortened as the maker would
       * badge it), `style`, `y` (metres over the ground of the letters' middle), `z` (metres right of the centre line
       * of the text's middle; 0 centred), `h` (capital height, metres), `color`, `finish`, `lift` (metres off the
       * surface, past any trim panel under the letters; 1.2 cm by default), and optional `sub` (a
       * second badge: [text, y, z, h]) and `emblem` ([y, z, r, color]: a round maker's badge). Types not listed get
       * the last word of their name, centred just above the plate.
       */
      const BADGE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-&.',
        BADGE_STYLES = ['block', 'wide', 'italic'],
        // Cells of 40 x 44 pixels, twelve to a row, from half way down the 512 x 1024 atlas (the trim cells fill the top
        // half): capitals 30 pixels tall on a baseline 37 down the cell.
        BADGE_CELL_W = 40,
        BADGE_CELL_H = 44,
        BADGE_COLS = 12,
        BADGE_TOP = 512,
        BADGE_CAP = 30,
        BADGE_BASE = 37,
        BADGE_CHROME = '#e1e5e9',
        CAR_BADGES = {
          sedan: { text: 'REGENT', y: 0.745, z: 0.5, h: 0.055 },
          taxi: { text: 'CITY CAB', y: 0.73, z: 0, h: 0.045 },
          coupe: { text: 'VOLT', style: 'wide', y: 0.645, z: 0, h: 0.05, spacing: 0.9 },
          muscle: { text: 'DUKE', y: 0.72, z: 0.5, h: 0.055, sub: ['V8', 0.72, -0.5, 0.05] },
          sport: { text: 'COMET', style: 'wide', y: 0.68, z: 0, h: 0.038, spacing: 0.8, lift: 0.024, sub: ['GT', 0.6, 0.48, 0.045] },
          roadster: { text: 'SOLSTICE', style: 'italic', y: 0.6, z: 0.42, h: 0.045 },
          rally: { text: 'KODIAK', y: 0.7, z: 0.48, h: 0.05, sub: ['RS', 0.7, -0.48, 0.05] },
          hotrod: { text: 'HELLFIRE', style: 'italic', y: 0.66, z: 0, h: 0.05, color: '#e9c46a', finish: 'gloss' },
          supercar: { text: 'TEMPEST', style: 'wide', y: 0.585, z: 0, h: 0.04, spacing: 0.7, sub: ['V12', 0.585, 0.62, 0.04] },
          luxury: { text: 'MONARCH', style: 'wide', y: 0.86, z: 0, h: 0.05, spacing: 0.9 },
          limousine: { text: 'SOVEREIGN', style: 'italic', y: 0.71, z: 0.5, h: 0.042 },
          suv: { text: 'RANGER', style: 'wide', y: 1.0, z: 0, h: 0.05, spacing: 1.1, lift: 0.022 },
          van: { text: 'MULE', y: 0.82, z: 0.42, h: 0.06 },
          pickup: { text: 'WORKHORSE', y: 0.92, z: 0, h: 0.085 },
          chevette: { text: 'CHEVETTE', style: 'wide', y: 0.705, z: 0, h: 0.045, spacing: 0.75, sub: ['Z06', 0.705, 0.64, 0.042] },
          brutini: { text: 'BRUTINI', style: 'wide', y: 0.745, z: 0, h: 0.04, spacing: 0.6, color: '#d9b14a', finish: 'gloss' },
          cavalino: { text: 'CAVALINO', style: 'italic', y: 0.6, z: 0, h: 0.04, sub: ['458', 0.62, 0.62, 0.042] },
          valkyrie: { text: 'VALKYRIE', style: 'wide', y: 0.62, z: 0, h: 0.038, spacing: 0.7 },
          dbs: { text: 'WALTER MARTIN', style: 'wide', y: 0.74, z: 0, h: 0.034, spacing: 0.55, sub: ['DBS', 0.6, 0.62, 0.04] },
          zr1x: { text: 'CHEVETTE', style: 'wide', y: 0.665, z: 0, h: 0.045, spacing: 0.75, sub: ['ZR1X', 0.57, 0.6, 0.045] },
          chevetteSE: { text: 'CHEVETTE', style: 'wide', y: 0.705, z: 0, h: 0.045, spacing: 0.75, sub: ['Z06', 0.705, 0.64, 0.042] },
          wayron: { text: 'MUGATTI', style: 'wide', y: 0.69, z: 0, h: 0.042, spacing: 0.8 },
          tourbillon: { text: 'MUGATTI', style: 'wide', y: 0.6, z: 0, h: 0.042, spacing: 0.8 },
          jasko: { text: 'KONIGSBERG', style: 'wide', y: 0.62, z: 0, h: 0.036, spacing: 0.55 },
          sirocco: { text: 'PAGANO', style: 'wide', y: 0.62, z: 0, h: 0.042, spacing: 0.7 },
          novera: { text: 'RIMAK', style: 'wide', y: 0.64, z: 0, h: 0.042, spacing: 0.9 },
          w1: { text: 'McLOWEN', style: 'wide', y: 0.675, z: 0, h: 0.038, spacing: 0.7, sub: ['W1', 0.56, 0.6, 0.042] },
          lafera: { text: 'LA FERA', style: 'italic', y: 0.6, z: 0, h: 0.045 },
        };
      // Glyph metrics, filled while the atlas paints: per style, per character, [u0, u1, v0, v1, width / cap height].
      const badgeGlyphs = {};
      /* Paint the glyph rows into the trim atlas's canvas (`g`, 512 x 1024; civTrimAtlas). */
      function civBadgeGlyphs(g) {
        const fonts = {
          block: `bold ${BADGE_CAP * 1.4}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`,
          wide: `600 ${BADGE_CAP * 1.4}px "Helvetica Neue", Arial, sans-serif`,
          italic: `italic bold ${BADGE_CAP * 1.4}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`,
        };
        BADGE_STYLES.forEach((style, si) => {
          const metrics = (badgeGlyphs[style] = {});
          g.font = fonts[style];
          g.textBaseline = 'alphabetic';
          g.textAlign = 'left';
          [...BADGE_CHARS].forEach((ch, ci) => {
            const slot = si * 40 + ci,
              cx = (slot % BADGE_COLS) * BADGE_CELL_W,
              cy = BADGE_TOP + Math.floor(slot / BADGE_COLS) * BADGE_CELL_H,
              ink = g.measureText(ch).width,
              room = BADGE_CELL_W - 6,
              squeeze = Math.min(1, room / Math.max(1, ink)),
              drawn = ink * squeeze,
              x0 = cx + (BADGE_CELL_W - drawn) / 2;
            g.save();
            g.beginPath();
            g.rect(cx, cy, BADGE_CELL_W, BADGE_CELL_H);
            g.clip();
            g.translate(x0, cy + BADGE_BASE);
            g.scale(squeeze, 1);
            // A dark edge under the bright letter: it reads on any paint.
            g.lineJoin = 'round';
            g.lineWidth = 2;
            g.strokeStyle = '#1c1d20';
            g.strokeText(ch, 0, 0);
            g.fillStyle = '#ffffff';
            g.fillText(ch, 0, 0);
            g.restore();
            // UVs (flipY: the canvas's top row is v 1), the glyph's ink box across, the whole cell up.
            metrics[ch] = [(x0 - 1) / 512, (x0 + drawn + 1) / 512, 1 - (cy + BADGE_CELL_H) / 1024, 1 - cy / 1024, (drawn + 2) / BADGE_CAP];
          });
        });
      }
      // What a type's tail says (CAR_BADGES, else the last word of the game's name for it, centred over the plate).
      function civBadgeSpec(body) {
        const own = CAR_BADGES[body.name];
        if (own) return own;
        const name = String(VEHICLE_DEFINITIONS[body.name]?.name || body.name).toUpperCase(),
          words = name.split(/\s+/);
        return { text: words[words.length - 1], y: (body.plateRear ?? 0.5) + 0.11, z: 0, h: 0.036 };
      }
      const badgeRight = new Three.Vector3(),
        badgeUp = new Three.Vector3();
      /*
       * One line of glyph quads (model units): `text` in `style`, capitals `cap` tall, `gap` between letters, centred on
       * 0 along the line. `frame(along, out)` writes where a letter's middle `along` the line sits: out.p (point), out.n
       * (outward normal), out.r (the reading direction); the letter stands up the surface. Returns { geometry, letters }
       * (null when nothing was laid); the caller merges it into its set and disposes of it.
       */
      const badgeFrame = { p: new Three.Vector3(), n: new Three.Vector3(), r: new Three.Vector3() };
      function badgeGlyphGeometry(text, style, cap, gap, frame) {
        if (!badgeGlyphs.block) civTrimAtlas();
        const glyphs = badgeGlyphs[style] || badgeGlyphs.block,
          // Lower-case letters in a name (McLOWEN) are badged as capitals.
          chars = [...String(text).toUpperCase()],
          advance = (ch) => (ch === ' ' ? 0.55 * cap : glyphs[ch] ? glyphs[ch][4] * cap : 0);
        let total = -gap;
        for (const ch of chars) if (ch === ' ' || glyphs[ch]) total += advance(ch) + gap;
        let cursor = -total / 2;
        const position = [],
          normal = [],
          uv = [],
          index = [],
          // The quads from the line's middle: the baseline half a capital under it, the glyph cell's foot and top round it.
          bottom = -cap / 2 - ((BADGE_CELL_H - BADGE_BASE) / BADGE_CAP) * cap,
          top = -cap / 2 + (BADGE_BASE / BADGE_CAP) * cap;
        for (const ch of chars) {
          const width = advance(ch);
          if (ch !== ' ' && glyphs[ch]) {
            const [u0, u1, v0, v1] = glyphs[ch];
            frame(cursor + width / 2, badgeFrame);
            const { p, n } = badgeFrame;
            // Across (the reading direction kept in the surface), then up the surface.
            badgeRight.copy(badgeFrame.r).addScaledVector(n, -badgeFrame.r.dot(n)).normalize();
            badgeUp.crossVectors(n, badgeRight).normalize();
            const base = position.length / 3,
              corner = (sx, sy, u, v) => {
                position.push(p.x + badgeRight.x * sx + badgeUp.x * sy, p.y + badgeRight.y * sx + badgeUp.y * sy, p.z + badgeRight.z * sx + badgeUp.z * sy);
                normal.push(n.x, n.y, n.z);
                uv.push(u, v);
              };
            corner(-width / 2, bottom, u0, v0);
            corner(width / 2, bottom, u1, v0);
            corner(width / 2, top, u1, v1);
            corner(-width / 2, top, u0, v1);
            index.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
          cursor += width + gap;
        }
        if (!index.length) return null;
        const geometry = new Three.BufferGeometry();
        geometry.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        geometry.setAttribute('normal', new Three.Float32BufferAttribute(normal, 3));
        geometry.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
        geometry.setIndex(index);
        return { geometry, letters: index.length / 6 };
      }
      // The gap between letters for a style (`spacing` a share of a capital; 'wide' spaces them).
      function badgeGap(style, cap, spacing) {
        return (spacing ?? (style === 'wide' ? 0.5 : 0.08)) * cap;
      }
      /*
       * A flat line of letters (model units): centred at `origin`, facing `normal`, reading along `right` (the letters'
       * up is normal x right). For bodies without a lofted tail (police, motorbikes, the 4x4 club, the flatbed).
       */
      function badgeFlatGeometry(text, style, cap, spacing, origin, normal, right) {
        return badgeGlyphGeometry(text, style, cap, badgeGap(style, cap, spacing), (along, out) => {
          out.n.set(normal[0], normal[1], normal[2]).normalize();
          out.r.set(right[0], right[1], right[2]).normalize();
          out.p.set(origin[0] + out.r.x * along, origin[1] + out.r.y * along, origin[2] + out.r.z * along);
        });
      }
      /*
       * One line of letters on a civilian tail: `text` centred at (z, y) metres (z across, from the centre line),
       * capitals `h` metres tall, in `style`, following the tail's surface (k.surf / k.normalAt).
       */
      function civBadgeLine(k, text, y, z, h, style, options) {
        const M = k.M,
          cap = h * M,
          // Proud of the paint, and of any trim panel they sit on (`lift`, metres: the sport's black bar, the SUV's band).
          lift = (options.lift ?? 0.012) * M,
          laid = badgeGlyphGeometry(text, style, cap, badgeGap(style, cap, options.spacing), (along, out) => {
            const p = k.surf('rear', z * M + along, y * M, lift),
              n = k.normalAt('rear', z * M + along, y * M);
            out.p.set(p[0], p[1], p[2]);
            out.n.set(n[0], n[1], n[2]);
            // Across the tail: the car's right, as read from behind.
            out.r.set(0, 0, 1);
          });
        if (!laid) return 0;
        // Satin-bright metal: polished chrome mirrors the dark street and reads as a dark smudge from the chase camera.
        civAddMatrix(k.sets.trim, laid.geometry, civIdentity, { color: options.color || BADGE_CHROME, finish: options.finish || 'alloy', rawUv: true });
        laid.geometry.dispose();
        return laid.letters;
      }
      /* The tail's badges for `body` (civKit, before the cabin): { text, sub, letters } for the kit (carModels `badge`). */
      function civRearBadges(k, body) {
        if (!badgeGlyphs.block) civTrimAtlas();
        const spec = civBadgeSpec(body);
        if (!spec || !spec.text) return null;
        const style = spec.style || 'block';
        let letters = civBadgeLine(k, spec.text, spec.y, spec.z ?? 0, spec.h ?? 0.036, style, spec);
        if (spec.sub) {
          const [text, y, z, h] = spec.sub;
          letters += civBadgeLine(k, text, y, z, h, style === 'wide' ? 'block' : style, { color: spec.color, finish: spec.finish });
        }
        if (spec.emblem) {
          const [y, z, r, color] = spec.emblem;
          badge(k, 'rear', z, y, r, color);
        }
        return { text: spec.text, sub: spec.sub ? spec.sub[0] : null, style, letters };
      }
      /*
       * POLICE BADGES
       * The police kits' trim reads the same atlas (police3d-kits.js: policeSolidUv sends every other trim vertex to the
       * solid cell): a marked car carries POLICE (SHERIFF in the county livery) across its trunk between the plate and
       * the lamps, every patrol body its model name right of the plate (POLICE_MODEL_BADGES), in light metal.
       */
      const POLICE_MODEL_BADGES = { charger: 'PURSUIT', crownvic: 'INTERCEPTOR', utility: 'UTILITY', tahoe: 'COMMAND' },
        badgeIdentity = new Three.Matrix4();
      policeTrimMaterial.map = civTrimAtlas();
      policeTrimMaterial.alphaTest = 0.5;
      // The word across a law car's tail for its look (part of its kit's key), or null.
      function policeRearWord(look) {
        return look.equipment !== 'marked' ? null : look.livery === 'sheriff' ? 'SHERIFF' : 'POLICE';
      }
      // Every vertex of `set` from `from` on samples the atlas's solid (white) cell.
      function policeSolidUv(set, from) {
        const r = trimCellRect('solid'),
          u = (r[0] + r[2]) / 2,
          v = (r[1] + r[3]) / 2;
        for (let i = from * 2; i < set.uv.length; i += 2) {
          set.uv[i] = u;
          set.uv[i + 1] = v;
        }
      }
      /* The tail's badges for a police body (design units): { text, sub, letters } for the kit, null for none. */
      function policeRearBadges(trim, body, look, l, w, topAt) {
        if (body.kind === 'bearcat') return null;
        const plateY = body.yb + 3.1,
          [, ty, tz, , tsy, tsz] = body.tail,
          // Lamps across the middle (the Charger's bar) cap the band; corner lamps leave it to the deck or the glass.
          central = tz - tsz / 2 < 0.05,
          top = central ? ty - tsy / 2 : Math.min(topAt(-0.49 * l), body.glass.base),
          lo = plateY + 0.625 + 0.12,
          hi = top - 0.12,
          // The tail's face at height y: the rearmost station that stands that high, a little behind it.
          rearAt = (y) => {
            let x = -0.5 * l;
            while (topAt(x) < y && x < -0.4 * l) x += 0.05;
            return x - 0.06;
          },
          lay = (text, cap, y, z, align) => {
            const laid = badgeFlatGeometry(text, 'block', cap, 0.22, [0, 0, 0], [-1, 0, 0], [0, 0, 1]);
            if (!laid) return 0;
            laid.geometry.computeBoundingBox();
            const b = laid.geometry.boundingBox,
              shift = align ? z + (b.max.z - b.min.z) / 2 : z;
            laid.geometry.translate(rearAt(y + cap / 2), y, shift);
            policeAddMatrix(trim, laid.geometry, badgeIdentity, '#e4e7ea');
            laid.geometry.dispose();
            return laid.letters;
          };
        const word = policeRearWord(look),
          model = POLICE_MODEL_BADGES[body.name] || null;
        let letters = 0;
        if (word && hi - lo > 0.3) letters += lay(word, clamp((hi - lo) * 0.75, 0.35, 0.75), (lo + hi) / 2, 0, false);
        // The model name right of the plate, over the bumper.
        if (model) letters += lay(model, 0.38, plateY + 0.15, 1.45 + 0.3, true);
        return { text: word, sub: model, style: 'block', letters };
      }
      /*
       * MOTORBIKE BADGES
       * The maker's name on both sides of a motorbike's tank (or its fairing's flank on the sports bikes, the radiator
       * shrouds on the dirt bike), reading front to back on the left and back to front on the right as real tank
       * badges do: MOTO_BADGES [text, style, x, y, half width there (metres), capital height], into the bike's trim.
       */
      const MOTO_BADGES = {
        bike: ['VORTEX', 'italic', 0.22, 1.0, 0.168, 0.034],
        cruiser: ['NOMAD', 'wide', 0.14, 0.93, 0.192, 0.036],
        dolcati: ['DOLCATI', 'block', 0.4, 0.84, 0.196, 0.034],
        yamasaki: ['YAMASAKI', 'italic', 0.32, 0.87, 0.186, 0.032],
        kr500: ['KR 500', 'block', 0.3, 0.99, 0.158, 0.036],
      };
      function motoBadges(trim, type) {
        const spec = MOTO_BADGES[type];
        if (!spec) return null;
        const [text, style, x, y, half, h] = spec,
          M = CAR_M;
        let letters = 0;
        for (const side of [-1, 1]) {
          const laid = badgeFlatGeometry(text, style, h * M, style === 'wide' ? 0.5 : 0.1, [x * M, y * M, side * (half + 0.004) * M], [0, 0, side], [side, 0, 0]);
          if (!laid) continue;
          civAddMatrix(trim, laid.geometry, civIdentity, { color: BADGE_CHROME, finish: 'alloy', rawUv: true });
          laid.geometry.dispose();
          letters += laid.letters;
        }
        return { text, sub: null, style, letters };
      }
      /*
       * BADGE PANELS
       * The box-built trucks (vehicles3d.js makeTruck) carry their names on a panel that was already one of their
       * meshes (the box truck's and the ambulance's rear doors; the bus's tail, whose cream flank bands became one box
       * to pay for it): one canvas per panel kind, painted once (bakedCanvases), its rear face facing back.
       * A box's -x face maps the whole texture with u along +z (the viewer's right from behind), v up.
       */
      const BADGE_PANELS = {
        truck: { bg: '#c3c9cd', ribs: '#a9b0b5', lines: [['ATLAS', '#1d3f73', 0.34, 0.3], ['BOX TRUCK', '#2a2d31', 0.11, 0.47]] },
        ambulance: { bg: '#ecebe6', ribs: '#d8d6cf', band: '#b12a32', lines: [['PARAMEDIC', '#b12a32', 0.15, 0.32], ['EMERGENCY', '#1d3f73', 0.09, 0.47]] },
        bus: { bg: '#15171a', glass: '#1f2830', lines: [['METRO', '#ffb23a', 0.2, 0.22], ['12  HARBOR', '#ffb23a', 0.12, 0.36]], hatch: '#2b2f34' },
      };
      const badgePanelMaterials = {};
      function badgePanelMaterial(kind) {
        if (badgePanelMaterials[kind]) return badgePanelMaterials[kind];
        const spec = BADGE_PANELS[kind],
          canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const g = canvas.getContext('2d');
        g.fillStyle = spec.bg;
        g.fillRect(0, 0, 256, 256);
        if (spec.ribs) for (let x = 6; x < 256; x += 18) {
          g.fillStyle = spec.ribs;
          g.fillRect(x, 0, 3, 256);
        }
        // The door split down the middle, the band across, the bus's rear window over its sign.
        if (kind !== 'bus') {
          g.fillStyle = 'rgba(20,22,25,0.6)';
          g.fillRect(127, 0, 2, 256);
        }
        if (spec.band) {
          g.fillStyle = spec.band;
          g.fillRect(0, 150, 256, 22);
        }
        if (spec.glass) {
          g.fillStyle = spec.glass;
          g.fillRect(14, 120, 228, 100);
          g.fillStyle = spec.hatch;
          g.fillRect(0, 226, 256, 30);
        }
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        for (const [text, color, size, y] of spec.lines) {
          g.font = `bold ${Math.round(size * 256)}px "Arial Narrow", Arial, sans-serif`;
          g.fillStyle = color;
          g.fillText(text, 128, y * 256, 236);
        }
        const map = new Three.CanvasTexture(canvas);
        map.colorSpace = Three.SRGBColorSpace;
        map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        bakedCanvases.push(map);
        const material = new Three.MeshStandardMaterial({ map, roughness: kind === 'bus' ? 0.3 : 0.45, metalness: kind === 'truck' ? 0.55 : 0.1 });
        // The bus's amber sign glows (a destination display).
        if (kind === 'bus') {
          material.emissiveMap = map;
          material.emissive = new Three.Color('#ffffff');
          material.emissiveIntensity = 0.35;
        }
        sharedMaterials.add(material);
        badgePanelMaterials[kind] = material;
        return material;
      }
      /*
       * CLUB BADGES
       * The 4x4 club trucks (offroad3d-kits.js) carry their name (CLUB_BADGES: ROVER, BADGER, BRONCO, TAURO...) in light
       * metal on the tailgate's right corner at the plate's height, smaller and further out past a spare wheel hung in
       * the middle.
       */
      // The name each club truck's tail carries (its maker, or the model where the maker's name is not on the tail).
      const CLUB_BADGES = { series: 'ROVER', crawler: 'BADGER', bronco: 'BRONCO', expedition: 'HIGHLANDER', hilux: 'TAURO', sixbysix: 'OKTAV', trophy: 'SIDEWINDER' };
      function offroadRearBadge(trim, type, def, l, w, tail, spares = []) {
        const text = CLUB_BADGES[type] || String(VEHICLE_DEFINITIONS[type]?.name || type).split(/\s+/)[0],
          // A spare hung on the tailgate takes its middle: the name goes smaller, into the corner past it.
          spare = spares.some((s) => s.z === 0 && s.ry),
          y = def.bumpers[1][1] + 1.6,
          right = w * (spare ? 0.45 : 0.42),
          // Between the plate's edge (1.4 off the centre line) and the corner: a long name (SIDEWINDER) goes smaller.
          room = right - 1.7;
        let cap = spare ? 0.42 : 0.5,
          laid = badgeFlatGeometry(text, 'block', cap, 0.18, [0, 0, 0], [-1, 0, 0], [0, 0, 1]);
        if (!laid) return null;
        laid.geometry.computeBoundingBox();
        let b = laid.geometry.boundingBox;
        if (b.max.z - b.min.z > room) {
          laid.geometry.dispose();
          cap *= room / (b.max.z - b.min.z);
          laid = badgeFlatGeometry(text, 'block', cap, 0.18, [0, 0, 0], [-1, 0, 0], [0, 0, 1]);
          laid.geometry.computeBoundingBox();
          b = laid.geometry.boundingBox;
        }
        laid.geometry.translate(tail - 0.06, y, right - (b.max.z - b.min.z) / 2);
        policeAddMatrix(trim, laid.geometry, badgeIdentity, '#e4e7ea');
        laid.geometry.dispose();
        return { text, sub: null, style: 'block', letters: laid.letters };
      }
