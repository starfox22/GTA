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
          brutini: { text: 'BRUTINI', style: 'wide', y: 0.62, z: 0, h: 0.04, spacing: 0.6, color: '#d9b14a', finish: 'gloss' },
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
          w1: { text: 'McLOWEN', style: 'wide', y: 0.62, z: 0, h: 0.038, spacing: 0.7, sub: ['W1', 0.56, 0.6, 0.042] },
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
        badgeUp = new Three.Vector3(),
        badgeNormal = new Three.Vector3(),
        badgeAxisZ = new Three.Vector3(0, 0, 1);
      /*
       * One line of letters on the tail: `text` centred at (z, y) metres (z across, from the centre line), capitals
       * `h` metres tall, in `style`; `spacing` adds that share of a capital between letters ('wide' spaces them).
       */
      function civBadgeLine(k, text, y, z, h, style, options) {
        const M = k.M,
          glyphs = badgeGlyphs[style] || badgeGlyphs.block,
          cap = h * M,
          gap = (options.spacing ?? (style === 'wide' ? 0.5 : 0.08)) * cap,
          chars = [...text.toUpperCase()],
          advance = (ch) => (ch === ' ' ? 0.55 * cap : glyphs[ch] ? glyphs[ch][4] * cap : 0);
        // Lower-case letters in a name (McLOWEN) are badged as capitals.
        let total = -gap;
        for (const ch of chars) if (ch === ' ' || glyphs[ch]) total += advance(ch) + gap;
        let cursor = z * M - total / 2;
        // Proud of the paint, and of any trim panel they sit on (`lift`, metres: the sport's black bar, the SUV's band).
        const lift = (options.lift ?? 0.012) * M,
          // Satin-bright metal: polished chrome mirrors the dark street and reads as a dark smudge from the chase camera.
          finish = options.finish || 'alloy',
          color = options.color || BADGE_CHROME,
          position = [],
          normal = [],
          uv = [],
          index = [];
        // The quads from the line's middle: the baseline half a capital under it, the glyph cell's foot and top round it.
        const bottom = -cap / 2 - ((BADGE_CELL_H - BADGE_BASE) / BADGE_CAP) * cap,
          top = -cap / 2 + (BADGE_BASE / BADGE_CAP) * cap;
        for (const ch of chars) {
          const width = advance(ch);
          if (ch !== ' ' && glyphs[ch]) {
            const [u0, u1, v0, v1] = glyphs[ch],
              mid = cursor + width / 2,
              p = k.surf('rear', mid, y * M, lift),
              n = k.normalAt('rear', mid, y * M);
            badgeNormal.set(n[0], n[1], n[2]);
            // Across the tail (the car's right, as read from behind), then up the surface.
            badgeRight.copy(badgeAxisZ).addScaledVector(badgeNormal, -badgeNormal.z).normalize();
            badgeUp.crossVectors(badgeNormal, badgeRight).normalize();
            const base = position.length / 3,
              corner = (sx, sy, u, v) => {
                position.push(p[0] + badgeRight.x * sx + badgeUp.x * sy, p[1] + badgeRight.y * sx + badgeUp.y * sy, p[2] + badgeRight.z * sx + badgeUp.z * sy);
                normal.push(badgeNormal.x, badgeNormal.y, badgeNormal.z);
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
        if (!index.length) return 0;
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        geo.setAttribute('normal', new Three.Float32BufferAttribute(normal, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
        geo.setIndex(index);
        civAddMatrix(k.sets.trim, geo, civIdentity, { color, finish, rawUv: true });
        geo.dispose();
        return index.length / 6;
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
