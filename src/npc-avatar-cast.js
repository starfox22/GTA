      // Casting the street avatars: which Rocketbox avatar (tools/npc_models.py CAST, its role tags) a look is drawn as
      // near the camera, and the rig's colours to match it further off.
      /**
       * NPC CASTING (renderer only: looks, never rules)
       * compileLook asks npcAvatarPick once per look: the avatar is chosen from the cast by the role (a pedestrian's
       * role, a special's outfit, a paramedic's city role) and by the sex compileLook already decided (lookFemale, the
       * one rule voices.js shares), from the look's seed, so it never changes. Uniformed roles only ever get their own
       * uniforms (police, SWAT, soldiers, the gate's MPs, paramedics); outfits with no avatar (the player, a disguise,
       * story characters, waiters, riders, athletes) get none (-1) and stay on the rig. A street look with an avatar
       * takes its clothes' colours and cut (npcAvatarLookTraits), so the rig far off and the avatar close up are the
       * same person.
       */
      // (No downgrades: outfits whose look says who they are and no avatar carries stay on the rig: gangs' colours,
      // traffic officers' hi-vis, agents' FED windbreakers; and children, whom the adult skeleton would draw as small adults.)
      const NPC_OUTFIT_TAGS = { police: 'police', swat: 'swat', army: 'army', mp: 'mp', mobster: 'mobster', partyGuest: 'partyGuest', beach: 'beach' },
        NPC_ROLE_TAGS = { commuter: 'commuter', jogger: 'jogger', worker: 'worker', reveller: 'reveller', elder: 'elder', tourist: 'tourist', texter: 'texter', bouncer: 'bouncer' },
        NPC_UNIFORMS = new Set(['police', 'swat', 'army', 'mp', 'medic', 'fed']);
      let npcPools = null;
      /* Cast indices by tag and sex ('police|f'), children apart ('kid|m'). */
      function npcAvatarPools() {
        if (npcPools) return npcPools;
        npcPools = new Map();
        const cast = npcAvatarCast();
        for (let i = 0; i < cast.length; i++) {
          const a = cast[i];
          for (const tag of a.tags) {
            const key = tag + '|' + a.sex;
            if (!npcPools.has(key)) npcPools.set(key, []);
            npcPools.get(key).push(i);
          }
        }
        return npcPools;
      }
      /** The cast index a look is drawn as near the camera, or -1 (the rig). */
      function npcAvatarPick(look, p, female, kid, role, summer, h) {
        if (!npcAvatarCast().length) return -1;
        const pools = npcAvatarPools(),
          sex = female ? 'f' : 'm';
        let tag;
        if (p?.cityRole?.kind === 'medic') tag = 'medic';
        else if (look.outfit) tag = NPC_OUTFIT_TAGS[look.outfit];
        else if (kid) return -1;
        else tag = NPC_ROLE_TAGS[role] || (summer && h(21) < 0.5 ? 'summer' : 'street');
        if (!tag) return -1;
        let pool = pools.get(tag + '|' + sex);
        if (!pool && !NPC_UNIFORMS.has(tag) && tag !== 'kid') pool = pools.get('street|' + sex);
        if (!pool) return -1;
        // Uniforms, children and the role's own avatars; a street role mixes in the general street cast now and then.
        if (!look.outfit && !kid && tag !== 'street' && tag !== 'medic' && h(22) < 0.35) pool = pools.get('street|' + sex) || pool;
        return pool[Math.min(pool.length - 1, Math.floor(h(23) * pool.length))];
      }
      /** The avatar's clothes for the rig (cast entry's palette and traits), or null. */
      function npcAvatarLookTraits(index) {
        const a = index >= 0 ? npcAvatarCast()[index] : null;
        if (!a) return null;
        const t = a.traits,
          c = a.palette;
        return {
          top: t.garment === 'shirtless' || t.garment === 'bikini' ? c.skin : c.top,
          pants: c.pants,
          shoes: t.footwear === 'bare' ? c.skin : c.shoes,
          skin: c.skin,
          hair: c.hair,
          garment: t.garment === 'uniform' ? 'tee' : t.garment,
          sleeves: t.sleeves ? 'long' : 'short',
          shorts: !!t.shorts,
          skirt: !!t.skirt,
          footwear: t.footwear === 'bare' ? 'shoe' : t.footwear,
          hairStyle: t.hairStyle,
          hat: t.hat || null,
        };
      }
