      // Crowd 3D looks: compiling a look into parts and paints (compileLook, compiledLook, specialLooks).
      const compiledLooks = new WeakMap();
      const hashOf = (seed, k) => {
        const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
        return x - Math.floor(x);
      };
      const pickOf = (list, h) => list[Math.min(list.length - 1, Math.floor(h * list.length))];
      const mixColor = new Three.Color(),
        mixColor2 = new Three.Color();
      function mixHex(a, b, t) {
        return '#' + mixColor.set(a).lerp(mixColor2.set(b), t).getHexString();
      }
      const SUMMER_DISTRICTS = /BEACH|OCEAN DRIVE|PALM KEYS|SUNSET PIER|CORAL MARINA|LITTLE HAVANA|MAREA/;
      const DOWNTOWN_DISTRICTS = /DOWNTOWN|FINANCIAL|CIVIC|MIDTOWN|CENTRAL/;
      function lookChanged(c, look) {
        return (
          c.top !== look.top ||
          c.pants !== look.pants ||
          c.shoes !== look.shoes ||
          c.hat !== look.hat ||
          c.hatColor !== look.hatColor ||
          c.skirt !== look.skirt ||
          c.shorts !== look.shorts ||
          c.sleeves !== look.sleeves ||
          c.hairStyle !== look.hairStyle
        );
      }
      function compiledLook(look, p) {
        let c = compiledLooks.get(look);
        if (!c || lookChanged(c, look)) {
          c = compileLook(look, p);
          compiledLooks.set(look, c);
        }
        return c;
      }
      const SLEEVES = { long: [0, 0], short: [0, 3], bare: [3, 3] };
      function compileLook(look, p) {
        const seed = (look.build || 1) * 1000 + (look.height || 1) * 77,
          h = (k) => hashOf(seed, k),
          role = look.outfit ? null : p.role || 'casual',
          kid = role === 'kid' || !!look.kid,
          female = look.female ?? (look.skirt || look.hairStyle === 2 || look.hairStyle === 3 || (look.hairStyle === 4 && h(1) < 0.5)),
          skin = look.skin || '#c99169',
          hair = look.hair || '#231a15',
          district = look.outfit || !p ? '' : districtAt(p.x, p.y) || '',
          summer = SUMMER_DISTRICTS.test(district),
          downtown = DOWNTOWN_DISTRICTS.test(district);
        let top = look.top || '#44505c',
          pants = look.pants || '#2a3444',
          shoes = look.shoes || '#141414',
          garment = look.garment,
          inner = look.inner || pickOf(['#ecebe6', '#dad7cf', '#2a2c30', '#9aa3ad', '#c9d4dc'], h(2)),
          accent = look.accent || top,
          topPattern = look.topPattern || 0,
          pantsPattern = look.pantsPattern ?? 0,
          sleeves = look.sleeves ? 'long' : 'short',
          shorts = !!look.shorts,
          skirt = !!look.skirt,
          footwear = look.footwear || 'shoe',
          sole = look.sole || null,
          socks = look.socks || null,
          hatStyle = look.hatStyle || (look.hat ? 'cap' : null),
          vest = look.vest || null,
          beard = look.beard ?? (!female && !kid ? (h(3) < 0.1 ? 2 : h(3) < 0.32 ? 1 : 0) : 0),
          hairPart = null;
        const barefoot = shoes === skin;
        if (!garment) {
          if (top === skin) garment = 'shirtless';
          else if (female && shorts && barefoot && !look.sleeves) garment = 'bikini';
          else if (role === 'commuter') {
            garment = look.sleeves || downtown ? (h(4) < (female ? 0.45 : 0.62) ? 'suit' : female ? 'vneck' : 'jacket') : 'tee';
            if (garment === 'suit') {
              inner = pickOf(['#f1f2f4', '#e4ebf2', '#f4efe6', '#dfe4ea'], h(5));
              accent = female ? inner : pickOf(['#7a1f2a', '#1d2a44', '#2f3337', '#5a4a2a', '#23405c'], h(6));
            }
          } else if (role === 'jogger') {
            garment = female ? (h(4) < 0.5 ? 'crop' : 'tank') : h(4) < 0.5 ? 'tank' : 'tee';
            shorts = true;
            footwear = 'sneaker';
            socks = '#f2f1ec';
          } else if (role === 'worker') {
            const hiVis = /^#(e8761e|d8c93a)$/i.test(top);
            garment = 'tee';
            if (hiVis) {
              vest = { a: top, b: top, c: '#d9dde0' };
              top = pickOf(['#3d4c5c', '#2a2c30', '#6b5638', '#e8e4da'], h(5));
            }
            footwear = 'boot';
            if (look.hat) hatStyle = 'hardHat';
          } else if (role === 'reveller') garment = female ? (skirt ? (h(4) < 0.6 ? 'dress' : 'crop') : pickOf(['crop', 'tank', 'vneck', 'jacket'], h(4))) : pickOf(['tee', 'jacket', 'vneck', 'tee'], h(4));
          else if (role === 'tourist') {
            garment = 'tee';
            topPattern = h(4) < 0.3 ? PATTERN.floral : h(4) < 0.42 ? PATTERN.stripes : 0;
            if (look.hat && h(5) < 0.55) hatStyle = 'sunhat';
            if (look.shorts === undefined) shorts = h(6) < 0.6;
            footwear = 'sneaker';
          } else if (role === 'elder') garment = h(4) < 0.55 ? 'jacket' : 'tee';
          else if (role === 'texter') garment = h(4) < 0.6 ? 'hoodie' : 'tee';
          else if (role === 'bouncer') {
            garment = 'jacket';
            inner = '#141518';
          } else if (kid) garment = h(4) < 0.35 ? 'hoodie' : 'tee';
          else if (female) garment = skirt && h(4) < 0.4 ? 'dress' : pickOf(['tee', 'vneck', 'vneck', 'jacket', 'hoodie', 'tank', 'tee'], h(4));
          else {
            garment = pickOf(['tee', 'tee', 'jacket', 'hoodie', 'vneck', 'tee', 'tank'], h(4));
            if (garment === 'tee' && h(7) < 0.25) topPattern = PATTERN.check;
          }
          if (summer && !look.outfit) {
            if (garment === 'jacket' || garment === 'hoodie') garment = female ? 'tank' : 'tee';
            if (look.shorts === undefined && !skirt) shorts = h(8) < 0.7;
            if (garment === 'tee' && h(9) < 0.3) topPattern = PATTERN.floral;
            sleeves = 'short';
            if (look.hat && h(5) < 0.6) hatStyle = 'sunhat';
          }
          if (garment === 'dress') pants = top;
          if (garment === 'jacket' && h(10) < 0.3) topPattern = PATTERN.leather;
        }
        // Bluish trousers are jeans.
        if (look.pantsPattern === undefined && !skirt && (garment === 'tee' || garment === 'hoodie' || garment === 'jacket' || garment === 'vneck' || garment === 'tank')) {
          mixColor.set(pants);
          if (mixColor.b > mixColor.r * 1.25 && mixColor.b > 0.02) pantsPattern = PATTERN.denim;
        }
        if (footwear === 'shoe' && !look.outfit && /^#(f0eee8|e24a3b|2fa3c7)$/i.test(shoes)) footwear = 'sneaker';
        const torsoMask = TORSO_MASKS[garment] || TORSO_MASKS.tee,
          armCover =
            garment === 'jacket' || garment === 'accentJacket' || garment === 'suit' || garment === 'hoodie'
              ? 'long'
              : garment === 'tank' || garment === 'crop' || garment === 'bikini' || garment === 'shirtless' || garment === 'dress'
                ? 'bare'
                : look.sleevesStyle || sleeves;
        const gloves = look.gloves || null,
          legsCovered = !shorts && !skirt,
          kneePads = look.kneePads || null;
        if (!sole) sole = footwear === 'sneaker' ? '#eeede8' : footwear === 'boot' ? '#15120f' : barefoot ? skin : '#1b1816';
        // Hair: 0 shaved / bald, 1 short, 2 long, 3 bun, 4 curly (crowd.js); outfits may name a part.
        const style = look.hairStyle;
        if (typeof style === 'string') hairPart = BODY_CLOSE[style] ? style : null;
        else if (style === 1) hairPart = 'hairShort';
        else if (style === 2) hairPart = 'hairLong';
        else if (style === 3) hairPart = 'hairBun';
        else if (style === 4) hairPart = 'hairCurly';
        else if (style === 0) hairPart = female ? 'hairPony' : h(11) < 0.6 ? 'hairBuzz' : null;
        const hatPart = hatStyle ? (BODY_CLOSE[hatStyle] ? hatStyle : 'cap') : null,
          helmet = hatStyle === 'helmet' || hatStyle === 'hardHat';
        const height = look.heightAbsolute || (kid ? look.height || 0.64 : clamp((look.height || 1) * (female ? 0.965 : 1.015), 0.914, 1.086)),
          // A touch broader than the tape measure (8%) so figures read from the street camera.
          width = clamp(1 + ((look.build || 1) - 1) * 0.5, 0.9, 1.2) * (kid ? 0.9 : 1) * 1.08;
        const eyes = look.eyes || mixHex(hair, '#0d0b0a', 0.45),
          jaw = beard === 2 ? mixHex(hair, skin, 0.15) : beard === 1 ? mixHex(skin, hair, 0.38) : skin,
          lips = mixHex(skin, '#a4474a', female ? 0.38 : 0.2),
          collarColor = legsCovered ? pants : socks || skin;
        return {
          top: look.top,
          pants: look.pants,
          shoes: look.shoes,
          hat: look.hat,
          hatColor: look.hatColor,
          skirt: look.skirt,
          shorts: look.shorts,
          sleeves: look.sleeves,
          hairStyle: look.hairStyle,
          female,
          kid,
          height,
          width,
          garment,
          torso: female ? 'torsoF' : 'torsoM',
          pelvis: female ? 'pelvisF' : 'pelvisM',
          thigh: female ? 'thighF' : 'thighM',
          shoulderZ: RIG.shoulderZ[female ? 1 : 0],
          hipZ: RIG.hipZ[female ? 1 : 0],
          headScale: kid ? 1.22 : female ? 0.95 : 1,
          hairPart: helmet ? null : hairPart,
          hatPart,
          shoePart: footwear === 'boot' ? 'boot' : 'shoe',
          skirtOn: skirt || garment === 'dress',
          collar: !!look.collar || garment === 'jacket' || garment === 'accentJacket' || garment === 'suit',
          hood: garment === 'hoodie',
          vest: !!vest,
          belt: !!look.belt,
          label: look.label === 'POLICE' ? P.labelPolice : look.label === 'FED' ? P.labelFed : null,
          radio: !!look.radio,
          backpack: !!look.backpack,
          paints: {
            head: rigPaint(skin, eyes, jaw, lips, [0, 1, 2, 3]),
            hair: rigPaint(hair),
            hat: rigPaint(look.hatColor || '#23272e', look.brim || (hatStyle === 'sunhat' ? mixHex(look.hatColor || '#e9dcc0', '#6b4a2e', 0.35) : mixHex(look.hatColor || '#23272e', '#000000', 0.25)), look.hatBadge || '#d8b65a'),
            torso: rigPaint(top, inner, accent, skin, torsoMask, topPattern),
            collar: rigPaint(garment === 'suit' || garment === 'uniform' ? (look.collarColor || inner) : top, top, top, top, [0, 0, 0, 0], garment === 'suit' ? 0 : topPattern),
            hood: rigPaint(top, top, top, top, [0], topPattern),
            upperArm: rigPaint(top, top, accent, skin, SLEEVES[armCover], topPattern),
            forearm: rigPaint(top, look.cuff || top, top, skin, armCover === 'long' ? [0, 1] : [3, 3], topPattern),
            hand: gloves ? rigPaint(gloves) : rigPaint(skin),
            pelvis: rigPaint(pants, look.beltColor || '#1d1a18', look.buckle || '#b7b9bb', skin, look.belt || garment === 'bikini' || garment === 'dress' || garment === 'shirtless' || (shorts && !legsCovered && summer) ? [0, 0, 0] : [0, 1, 2], pantsPattern),
            skirt: rigPaint(pants, mixHex(pants, '#000000', 0.2), pants, pants, [0, 1]),
            thigh: rigPaint(pants, pants, pants, skin, skirt || garment === 'bikini' ? [3, 3] : shorts ? [0, 3] : [0, 0], pantsPattern),
            shin: rigPaint(pants, socks || skin, kneePads || pants, skin, legsCovered ? [0, 0, kneePads ? 2 : 0] : look.kneeSocks && socks ? [1, 1, 1] : [3, socks ? 1 : 3, 3], pantsPattern),
            shoe: rigPaint(barefoot ? skin : shoes, sole, collarColor, skin, footwear === 'boot' ? [0, 1, 0] : [0, 1, 2]),
            vest: vest ? rigPaint(vest.a, vest.b, vest.c) : null,
            belt: rigPaint(look.dutyBelt?.a || '#121315', look.dutyBelt?.b || '#18191b', look.dutyBelt?.c || '#b8bec4'),
            backpack: rigPaint(look.bagColor || '#2b2f3a', '#1b1c1f'),
            radio: rigPaint('#141517'),
            figure: rigPaint(top === skin || garment === 'bikini' ? skin : top, pants, hatPart ? look.hatColor || '#23272e' : hairPart ? hair : skin, skin, [0, 1, 2, 3]),
            figureLeg: rigPaint(legsCovered ? pants : skin, barefoot ? skin : shoes, pants, pants, [0, 1]),
          },
        };
      }
      /**
       * OUTFITS
       * The player and everyone who is not a pedestrian gets a look here, by
       * who they are: patrol officers in LAPD navy with a duty belt, badge and
       * shoulder radio (a peaked cap on some); traffic officers add a hi-vis
       * vest; SWAT in black with helmet, plate carrier and POLICE across the
       * back; agents in dark suits under a windbreaker with FED on the back;
       * soldiers in woodland camouflage with helmet and plate carrier; mobsters
       * in suits; gangs in their colours; party guests and staff.
       */
      const specialLooks = new WeakMap();
      const FEMALE_NAMES = /\b(MARA|ELENA|MARIA|SOFIA|ROSA|LUCIA|NINA|ANNA|CLAIRE|EVA)\b/;
      function outfitOf(p) {
        if (p === player) return player.disguised ? 'playerDisguise' : 'player';
        if (p.police) return { patrol: 'police', road: 'traffic', swat: 'swat', sniper: 'swat', fed: 'fed', soldier: 'army' }[p.unit] || 'police';
        if (p.military) return p.role === 'gate' ? 'mp' : 'army';
        if (p.guest) return p.staff ? 'waiter' : 'partyGuest';
        if (p.faction === 'vescari' || p.guard || p.boss) return 'mobster';
        if (p.faction) return 'gang';
        return 'story';
      }
      const PLAYER_GOLD = '#c9a14f'; // the HUD gold (shell.html --ui-gold #e2c897), deepened so it reads as gold on cloth
      function outfitLook(p, outfit, seed) {
        const h = (k) => hashOf(seed, k),
          skin = pickOf(['#e9c2a3', '#d9a886', '#c99169', '#b27a52', '#8f5b3c', '#6e4630', '#4e3223'], h(1)),
          hair = pickOf(['#16110e', '#231a15', '#33241b', '#4b3424', '#6a4a30', '#8c6a42', '#b89060'], h(2)),
          base = { outfit, skin, hair, hairStyle: 1, build: 1 + (h(3) - 0.5) * 0.3, height: 0.95 + h(4) * 0.12, female: false, sleeves: true };
        switch (outfit) {
          case 'player':
          case 'playerDisguise': {
            const disguise = outfit === 'playerDisguise';
            return {
              ...base,
              skin: '#c49270',
              hair: '#1a1411',
              hairStyle: 'hairCrop',
              beard: 1,
              build: 1.2,
              heightAbsolute: 1.8 / 1.75,
              garment: disguise ? 'suit' : 'accentJacket',
              top: disguise ? '#e3dac0' : '#2a221e',
              inner: disguise ? '#f6f4ee' : '#eeebe4',
              accent: disguise ? '#16171b' : PLAYER_GOLD,
              topPattern: disguise ? 0 : PATTERN.leather,
              cuff: disguise ? '#e3dac0' : '#1d1714',
              pants: disguise ? '#23272f' : '#2b3647',
              pantsPattern: disguise ? 0 : PATTERN.denim,
              belt: false,
              beltColor: '#2a1d15',
              buckle: '#c9a45a',
              shoes: disguise ? '#121214' : '#3b2b1f',
              footwear: disguise ? 'shoe' : 'boot',
            };
          }
          case 'police':
          case 'traffic': {
            const female = h(5) < 0.3,
              cap = outfit === 'traffic' || h(6) < 0.6;
            return {
              ...base,
              female,
              hairStyle: female ? 3 : h(7) < 0.5 ? 'hairBuzz' : 1,
              garment: 'uniform',
              top: '#253a5c',
              inner: '#172338',
              accent: '#d8b65a',
              sleevesStyle: h(8) < 0.5 ? 'long' : 'short',
              pants: '#1b2433',
              pantsPattern: 0,
              belt: true,
              collar: true,
              radio: true,
              shoes: '#111214',
              footwear: 'boot',
              hatStyle: cap ? 'patrolCap' : null,
              hatColor: outfit === 'traffic' ? '#e9e9e4' : '#1a2232',
              brim: '#0e0f11',
              hatBadge: '#d8b65a',
              vest: outfit === 'traffic' ? { a: '#cfe83a', b: '#cfe83a', c: '#c9ced3' } : null,
              beard: 0,
            };
          }
          case 'swat':
            return {
              ...base,
              hairStyle: 'hairBuzz',
              garment: 'tee',
              top: '#262a30',
              pants: '#262a30',
              pantsPattern: 0,
              belt: true,
              dutyBelt: { a: '#16181b', b: '#1f2226', c: '#2b2e33' },
              vest: { a: '#1b1e22', b: '#2c3036', c: '#1b1e22' },
              hatStyle: 'helmet',
              hatColor: '#1b1e22',
              brim: '#0f1012',
              hatBadge: '#2c2f34',
              gloves: '#141517',
              kneePads: '#16181b',
              shoes: '#121314',
              footwear: 'boot',
              label: 'POLICE',
              radio: true,
              beard: h(9) < 0.3 ? 1 : 0,
            };
          case 'fed':
            return {
              ...base,
              female: h(5) < 0.25,
              hairStyle: h(5) < 0.25 ? 3 : 1,
              garment: 'suit',
              top: '#1a2131',
              inner: '#eef0f2',
              accent: '#2b3140',
              pants: '#1b1e25',
              pantsPattern: 0,
              belt: false,
              shoes: '#0f0f10',
              footwear: 'shoe',
              label: 'FED',
              eyes: '#0a0a0b',
              beard: 0,
            };
          case 'army':
          case 'mp':
            return {
              ...base,
              hairStyle: 'hairBuzz',
              garment: 'tee',
              top: '#6f7552',
              topPattern: PATTERN.camo,
              pants: '#6f7552',
              pantsPattern: PATTERN.camo,
              belt: true,
              dutyBelt: { a: '#4d4a36', b: '#5a553d', c: '#3e3c2d' },
              vest: { a: '#6a6246', b: '#58513a', c: '#6a6246' },
              hatStyle: 'helmet',
              hatColor: '#5d6247',
              brim: outfit === 'mp' ? '#ebe8df' : '#3e4130',
              hatBadge: '#2d2f26',
              gloves: '#6a5e48',
              kneePads: '#55593f',
              shoes: '#6a553c',
              footwear: 'boot',
              beard: 0,
            };
          case 'mobster':
            return {
              ...base,
              hairStyle: h(5) < 0.5 ? 1 : 'hairBuzz',
              garment: 'suit',
              top: p.boss ? '#1c1c20' : p.color || '#293441',
              inner: p.boss ? '#1a1a1d' : '#e9e6df',
              accent: p.boss ? '#b8943e' : '#1a1a1d',
              pants: '#17181c',
              pantsPattern: 0,
              shoes: '#0f0f10',
              beard: h(6) < 0.4 ? 1 : 0,
              build: 1.15,
            };
          case 'waiter':
            return { ...base, garment: 'suit', top: '#efe7d2', inner: '#ffffff', accent: '#16171b', pants: '#17181b', pantsPattern: 0, shoes: '#111', beard: 0 };
          case 'partyGuest': {
            const female = h(5) < 0.5;
            return female
              ? { ...base, female, hairStyle: pickOf([2, 3, 2, 4], h(6)), garment: 'dress', skirt: true, top: p.color || '#c23b6b', pants: p.color || '#c23b6b', topPattern: PATTERN.satin, shoes: '#111' }
              : { ...base, garment: 'suit', top: h(6) < 0.5 ? '#1c1d22' : p.color || '#2a2d33', inner: h(7) < 0.5 ? '#f2f0ea' : p.color || '#eae4d8', accent: '#18191c', pants: '#18191c', pantsPattern: 0, shoes: '#111' };
          }
          case 'gang': {
            const female = h(5) < 0.2,
              garment = pickOf(['hoodie', 'jacket', 'tank', 'tee', 'hoodie'], h(6));
            return {
              ...base,
              female,
              hairStyle: female ? pickOf([2, 3, 0], h(7)) : pickOf([1, 'hairBuzz', 4, 1], h(7)),
              garment,
              top: p.color || '#6b2f36',
              inner: h(8) < 0.5 ? '#e8e6e0' : '#1a1b1d',
              pants: h(9) < 0.6 ? '#2a3446' : '#1b1c20',
              shoes: h(10) < 0.6 ? '#eeede8' : '#141414',
              footwear: h(10) < 0.6 ? 'sneaker' : 'shoe',
              hat: h(11) < 0.4 ? 1 : 0,
              hatColor: h(12) < 0.5 ? '#141414' : p.color || '#6b2f36',
            };
          }
          case 'cyclist':
          case 'motorcyclist':
          case 'jetskier': {
            const female = h(5) < 0.35;
            const base2 = { ...base, female, hairStyle: female ? pickOf([3, 'hairPony', 2], h(6)) : pickOf([1, 'hairBuzz', 4], h(6)) };
            if (outfit === 'motorcyclist')
              return { ...base2, garment: 'jacket', top: pickOf(['#1c1d20', '#2a2320', '#3a1d1d', '#1d2433'], h(7)), topPattern: PATTERN.leather, inner: '#2a2c30', pants: '#23282f', shoes: '#141414', footwear: 'boot', gloves: '#141414', hatStyle: 'helmet', hatColor: pickOf(['#e9e7e1', '#1b1c1f', '#b8322a', '#2c5ea8'], h(8)), brim: '#101114', hatBadge: '#101114' };
            if (outfit === 'jetskier') return { ...base2, garment: female ? 'bikini' : 'shirtless', top: female ? '#2a67b5' : base.skin, pants: pickOf(['#d8413a', '#2a67b5', '#15253f'], h(7)), shorts: true, shoes: base.skin };
            return { ...base2, garment: pickOf(['tee', 'hoodie', 'jacket', 'tee'], h(7)), top: pickOf(['#4d7782', '#e24a3b', '#f2f1ec', '#2f3e57', '#e3c35a'], h(8)), pants: pickOf(['#23303f', '#1d2126', '#6e6553'], h(9)), shorts: h(10) < 0.3, footwear: 'sneaker', shoes: '#f0eee8', hatStyle: 'cap', hatColor: pickOf(['#3fa9a6', '#23272e', '#e24a3b'], h(11)) };
          }
          case 'athlete': {
            // Match kit (sports.js): shirt in the club's colours and pattern, shorts, socks.
            const kit = p.kit || {},
              basketball = p.sport === 'basketball',
              official = p.kind === 'referee' || p.kind === 'assistant',
              steward = p.kind === 'steward',
              female = false;
            return {
              ...base,
              female,
              hairStyle: pickOf([1, 'hairBuzz', 4, 1, 0], h(6)),
              heightAbsolute: basketball && p.kind === 'athlete' ? 1.95 / 1.75 + (h(4) - 0.5) * 0.06 : (1.8 + (h(4) - 0.5) * 0.12) / 1.75,
              build: basketball ? 0.95 : 1 + (h(3) - 0.5) * 0.2,
              garment: steward ? 'tee' : basketball && !official ? 'tank' : 'tee',
              top: steward ? '#23282f' : kit.primary || '#3caae1',
              accent: kit.secondary || kit.primary || '#ffffff',
              topPattern: { stripes: PATTERN.kitStripes, hoops: PATTERN.kitHoops, halves: PATTERN.kitHalves, sash: PATTERN.kitSash }[kit.pattern] || 0,
              pants: kit.shorts || '#1b1b20',
              pantsPattern: 0,
              shorts: !steward,
              sleevesStyle: official ? 'short' : 'short',
              socks: basketball ? '#f2f1ec' : kit.socks || '#f2f1ec',
              kneeSocks: !basketball,
              shoes: basketball ? '#f0eee8' : '#18191c',
              footwear: basketball ? 'sneaker' : 'shoe',
              sole: basketball ? '#eeede8' : '#101010',
              vest: steward ? { a: kit.primary || '#e6e23a', b: kit.primary || '#e6e23a', c: '#c9ced3' } : null,
              beard: h(7) < 0.2 ? 1 : 0,
            };
          }
          case 'beach': {
            // Palm Keys Beach (beach.js): swimwear, a shirt for strollers and staff.
            const female = !!p.female,
              kid = (p.scale || 1) < 0.8,
              onePiece = female && !p.shirt && h(5) < 0.35;
            return {
              outfit,
              kid,
              female,
              skin: p.skin,
              hair: p.hair,
              hairStyle: female ? pickOf([2, 3, 'hairPony', 4, 2], h(6)) : pickOf([1, 'hairBuzz', 4, 1, 0], h(6)),
              beard: female || kid ? 0 : h(7) < 0.25 ? 1 : 0,
              build: 1 + (h(3) - 0.5) * 0.3,
              heightAbsolute: kid ? p.scale : clamp(p.scale || 1, 0.92, 1.08),
              garment: p.shirt ? 'tee' : female ? (onePiece ? 'tank' : 'bikini') : 'shirtless',
              top: p.shirt || (female ? p.suit : p.skin),
              topPattern: p.shirt && p.kind === 'stroller' && h(8) < 0.4 ? PATTERN.floral : 0,
              pants: p.suit,
              pantsPattern: 0,
              shorts: true,
              sleevesStyle: 'short',
              shoes: p.kind === 'vendor' || p.kind === 'patron' ? '#8a6d4a' : p.skin,
              footwear: 'shoe',
              hat: p.kind === 'lifeguard' || h(9) < 0.12 ? 1 : 0,
              hatStyle: p.kind === 'lifeguard' ? 'cap' : h(9) < 0.12 ? 'sunhat' : null,
              hatColor: p.kind === 'lifeguard' ? '#d9302c' : '#e9dcc0',
            };
          }
          default: {
            const female = FEMALE_NAMES.test(p.name || '') || (p.name ? false : h(5) < 0.5);
            return {
              ...base,
              female,
              hairStyle: female ? pickOf([2, 3, 4], h(6)) : pickOf([1, 1, 4, 'hairBuzz'], h(6)),
              garment: female ? 'jacket' : 'jacket',
              top: p.color || '#6b5965',
              inner: '#e8e4dc',
              pants: female ? '#1d2126' : '#343b44',
              shoes: '#1e1a18',
            };
          }
        }
      }
      function specialLook(p) {
        const outfit = outfitOf(p);
        let entry = specialLooks.get(p);
        if (!entry || entry.outfit !== outfit || entry.color !== p.color) {
          const seed = entry?.seed ?? Math.random() * 1000;
          entry = { outfit, color: p.color, seed, look: outfitLook(p, outfit, seed) };
          specialLooks.set(p, entry);
        }
        return entry.look;
      }
