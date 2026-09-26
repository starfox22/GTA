    // Crowd appearance: palettes, role weights, dressPerson() and ensureLook().
    const CROWD_SKIN = ['#f3d6c1', '#eac0a0', '#dcaa85', '#c99169', '#b27a52', '#95603e', '#7a4b31', '#5e3825', '#452a1d'];
    const CROWD_HAIR = ['#16110e', '#231a15', '#33241b', '#4b3424', '#6a4a30', '#8c6a42', '#b89060', '#d8bd84', '#9c3f26', '#6f6f6f', '#b9b8b2'];
    const CROWD_TOPS = [
      '#2f3e57', '#6b2f36', '#d8d2c4', '#3c5b47', '#8a6d4a', '#1f2327', '#c6b99a', '#5a6f86', '#a4462f', '#e3c35a',
      '#6e5a7d', '#3a7a7a', '#b8563f', '#f0ebe0', '#44505c', '#7f8f5a', '#c78da1', '#2d6a93', '#8b8f96', '#e07b4f',
    ];
    const CROWD_PANTS = ['#2a3444', '#34465e', '#1d2126', '#4a4a4f', '#6e6553', '#8c7f63', '#23303f', '#565d66', '#3c2f2a', '#7a8290'];
    const CROWD_SHOES = ['#141414', '#1e1a18', '#f0eee8', '#5a3b28', '#2b2f3a', '#8a8d93'];
    const CROWD_UMBRELLAS = ['#1b1d22', '#8e1f2a', '#23355e', '#2f5d44', '#d9b43c', '#6d3f76', '#e5e1d6'];
    const CROWD_DOGS = ['#6b4a2e', '#1c1a18', '#d8c9a8', '#b98845', '#8a8d93', '#f1ece2', '#4a3526'];

    /**
     * ROLES
     * Who is out depends on the hour: commuters with briefcases and coffee in
     * the rush, shoppers and tourists through the day, dog walkers morning and
     * evening, joggers at the edges of the day, revellers after dark. A role sets
     * pace, clothes and props; the behaviour below reads it.
     */
    function crowdRoleWeights(hour) {
      if (hour < 5) return { reveller: 5, casual: 3, worker: 2, texter: 1, dogWalker: 0.4 };
      if (hour < 6.5) return { jogger: 3, worker: 3, commuter: 2, dogWalker: 2, casual: 1 };
      if (hour < 9.5) return { commuter: 7, jogger: 1.2, dogWalker: 1.4, texter: 2, casual: 2, family: 0.8, worker: 1 };
      if (hour < 11.5) return { shopper: 3, tourist: 2, casual: 3, texter: 1.5, dogWalker: 1, family: 1, elder: 1.4 };
      if (hour < 14.5) return { commuter: 3, shopper: 3, tourist: 2, casual: 3, texter: 2, couple: 1, elder: 1 };
      if (hour < 17.5) return { shopper: 4, tourist: 2.5, casual: 3, texter: 2, family: 1.6, elder: 1.2, dogWalker: 0.8 };
      if (hour < 19.5) return { commuter: 6, jogger: 1.3, dogWalker: 1.4, texter: 2, casual: 2, shopper: 1 };
      if (hour < 23) return { couple: 3, casual: 3, reveller: 2.5, dogWalker: 1, texter: 1.5, tourist: 1 };
      return { reveller: 4, casual: 2.5, couple: 1.5, texter: 1 };
    }
    function pickWeighted(weights) {
      let total = 0;
      for (const k in weights) total += weights[k];
      let r = seededRandom() * total;
      for (const k in weights) {
        r -= weights[k];
        if (r <= 0) return k;
      }
      return 'casual';
    }
    function crowdHour() {
      return (worldMinutes / 60) % 24;
    }
    /* Give a person a look, a temperament and (optionally) a role. Safe to call again. */
    function dressPerson(p, role = p.role) {
      const hour = crowdHour(),
        pick = randomChoice;
      p.role = role || 'casual';
      const old = p.role === 'elder',
        kid = p.role === 'kid',
        night = hour > 20 || hour < 5;
      let top = p.color || pick(CROWD_TOPS),
        pants = pick(CROWD_PANTS),
        shoes = pick(CROWD_SHOES),
        hairStyle = pick([0, 1, 1, 1, 2, 2, 3, 4]),
        skirt = seededRandom() < 0.18,
        hat = seededRandom() < 0.1 ? 1 : 0,
        backpack = seededRandom() < 0.14,
        carry = null,
        sleeves = seededRandom() < 0.55,
        build = randomBetween(0.86, 1.2),
        height = randomBetween(0.93, 1.07);
      // Hair style: 0 bald or shaved, 1 short, 2 long, 3 bun, 4 curly/volume.
      if (p.role === 'commuter') {
        top = pick(['#23272e', '#2f3e57', '#44505c', '#3a3230', '#5a6f86', '#e8e4da']);
        pants = pick(['#1d2126', '#23303f', '#2a3444', '#3a3a3f']);
        shoes = pick(['#141414', '#1e1a18', '#3a2618']);
        carry = pick(['briefcase', 'briefcase', 'coffee', 'coffee', null]);
        sleeves = true;
        skirt = seededRandom() < 0.22;
        backpack = seededRandom() < 0.18;
      } else if (p.role === 'shopper') carry = pick(['shopping', 'shopping', 'shopping', 'handbag']);
      else if (p.role === 'tourist') {
        top = pick(['#e3c35a', '#e07b4f', '#f0ebe0', '#3a7a7a', '#c78da1', '#2d6a93']);
        pants = pick(['#c2b089', '#8c7f63', '#34465e']);
        hat = seededRandom() < 0.45 ? 1 : 0;
        backpack = seededRandom() < 0.55;
        carry = seededRandom() < 0.3 ? 'camera' : null;
        sleeves = false;
      } else if (p.role === 'jogger') {
        top = pick(['#e24a3b', '#2fa3c7', '#f2f2ec', '#1f2327', '#9ad14b', '#f08bb0']);
        pants = pick(['#1d2126', '#23303f', '#2a3444']);
        shoes = pick(['#f0eee8', '#e24a3b', '#2fa3c7']);
        sleeves = false;
        skirt = false;
        backpack = false;
        hairStyle = pick([0, 1, 3]);
      } else if (p.role === 'worker') {
        top = pick(['#e8761e', '#d8c93a', '#6b5638', '#3d4c5c']);
        pants = pick(['#34465e', '#3c2f2a', '#565d66']);
        shoes = '#3a2618';
        hat = seededRandom() < 0.4 ? 1 : 0;
        skirt = false;
      } else if (p.role === 'reveller' || (night && seededRandom() < 0.4)) {
        top = pick(['#1d1f24', '#8e1f2a', '#6d3f76', '#d4b24a', '#e5e1d6', '#1f5f7a', '#c23b6b']);
        pants = pick(['#1d2126', '#141414', '#2a3444']);
        skirt = seededRandom() < 0.4;
      } else if (p.role === 'texter') carry = null;
      else if (old) {
        hairStyle = pick([0, 1, 1, 3]);
        top = pick(['#8a6d4a', '#6b2f36', '#c6b99a', '#3c5b47', '#44505c']);
        pants = pick(['#6e6553', '#4a4a4f', '#23303f']);
        hat = seededRandom() < 0.3 ? 1 : 0;
        carry = seededRandom() < 0.3 ? 'shopping' : null;
      }
      if (kid) {
        backpack = seededRandom() < 0.6;
        carry = null;
        height = randomBetween(0.58, 0.7);
        build = randomBetween(0.9, 1.05);
        top = pick(['#e24a3b', '#2fa3c7', '#e3c35a', '#9ad14b', '#f08bb0', '#f0ebe0']);
      }
      if (p.role === 'bouncer') {
        top = '#16181c';
        pants = '#16181c';
        build = randomBetween(1.3, 1.45);
        height = randomBetween(1.04, 1.1);
        hairStyle = 0;
        skirt = false;
        hat = 0;
        carry = null;
        backpack = false;
      }
      p.color = top;
      p.look = {
        skin: pick(CROWD_SKIN),
        hair: old ? pick(['#9a9a96', '#c9c8c2', '#e2e0d8', '#6f6f6f']) : pick(CROWD_HAIR),
        hairStyle,
        top,
        pants,
        shoes,
        skirt,
        sleeves,
        hat,
        hatColor: pick(['#23272e', '#8e1f2a', '#2d6a93', '#d8d2c4', '#3c5b47', '#e3c35a']),
        backpack,
        bagColor: pick(['#2b2f3a', '#6b2f36', '#3c5b47', '#8a6d4a', '#1d1f24', '#d9b43c']),
        build,
        height,
        stoop: old ? randomBetween(0.12, 0.22) : 0,
        umbrella: seededRandom() < 0.65 ? pick(CROWD_UMBRELLAS) : null,
      };
      p.carry = carry;
      p.texting = p.role === 'texter';
      p.pace =
        {
          commuter: 1.18,
          jogger: 2.1,
          tourist: 0.8,
          elder: 0.68,
          texter: 0.82,
          shopper: 0.92,
          reveller: 0.9,
          kid: 1.05,
          worker: 1,
        }[p.role] || randomBetween(0.9, 1.08);
      // Temperament: how likely to film, shout or call instead of running.
      p.nerve = kid ? 0.1 : clamp(seededRandom() * (p.role === 'worker' ? 1.1 : 1) + (old ? -0.2 : 0), 0, 1);
      p.lane = randomBetween(3, 9);
      if (p.role === 'dogWalker' && !p.dog)
        p.dog = { x: p.x - 10, y: p.y + 6, a: p.a || 0, color: pick(CROWD_DOGS), size: randomBetween(0.75, 1.25), sniff: 0 };
      return p;
    }
    function ensureLook(p) {
      if (!p.look) dressPerson(p, p.role || (p.jogger ? 'jogger' : p.gymStation ? 'jogger' : 'casual'));
      return p.look;
    }
