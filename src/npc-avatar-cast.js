      // Casting the street avatars: which Rocketbox avatar (tools/npc_models.py CAST, its role tags) a look is drawn as
      // near the camera, the tint its top garment wears, and the rig's colours to match it further off.
      /**
       * NPC CASTING (renderer only: looks, never rules)
       * compileLook asks npcAvatarPick once per look: the avatar is chosen from the cast by the role (a pedestrian's
       * role, a special's outfit, a paramedic's city role, a story character's name) and by the sex compileLook already
       * decided (lookFemale, the one rule voices.js shares), from the look's seed, so it never changes. Uniformed roles
       * only ever get their own uniforms (police, traffic officers in a painted hi-vis vest, SWAT, FED vests, soldiers,
       * the gate's MPs, paramedics, the player's borrowed uniform); children get the Rocketbox children; gangs, bikers,
       * kits and the player's suit wear a downloaded avatar whose top garment is tinted to the look's colour
       * (npcAvatarTint: the atlas' alpha marks it, tools/npc_paint.py); story characters are cast by name
       * (NPC_STORY_CAST). Only the player in his own clothes (his own body) gets none (-1). A street or story look with
       * an avatar takes its clothes' colours and cut (npcAvatarLookTraits), so the rig far off and the avatar close up
       * are the same person.
       */
      const NPC_OUTFIT_TAGS = {
          police: 'police',
          traffic: 'traffic',
          swat: 'swat',
          fed: 'fed',
          army: 'army',
          mp: 'mp',
          mobster: 'mobster',
          partyGuest: 'partyGuest',
          beach: 'beach',
          gang: 'gang',
          waiter: 'waiter',
          motorist: 'street',
          cyclist: 'street',
          motorcyclist: 'biker',
          jetskier: 'beach',
          playerArmy: 'playerArmy',
          playerDisguise: 'playerDisguise',
          diplomat: 'cast',
        },
        NPC_ROLE_TAGS = { commuter: 'commuter', jogger: 'jogger', worker: 'worker', reveller: 'reveller', elder: 'elder', tourist: 'tourist', texter: 'texter', bouncer: 'bouncer' },
        // Uniforms and children: never a civilian in their place (the other sex's uniform before that).
        NPC_UNIFORMS = new Set(['police', 'traffic', 'swat', 'army', 'mp', 'medic', 'fed', 'playerArmy', 'playerDisguise', 'steward', 'waiter', 'kid', 'football', 'basketball']),
        // Story characters by name (the avatar's name in tools/npc_models.py CAST; docs/areas/people-and-crowd-avatars.md);
        // the rest of the story cast by sex from the 'cast' tag.
        NPC_STORY_CAST = {
          'VINNY MORETTI': 'Male_Adult_03',
          'ELENA CRUZ': 'Female_Adult_07',
          'MARA VELEZ': 'Female_Adult_13',
          'RAFE SERRANO': 'Male_Adult_05',
          'DANIEL VEGA': 'Male_Adult_07',
          'ANTON VARGA': 'Business_Male_04',
          // Lieutenant Kessler off duty (fortjob.js: `missionDriver` 'kessler').
          kessler: 'Male_Adult_11',
        },
        NPC_STORY_TAGS = { 'PARTY GUEST': 'partyGuest', WAITER: 'waiter', BARTENDER: 'waiter', PARAMEDIC: 'medic' },
        // Outfits whose top garment is the look's colour on a tinted avatar.
        NPC_TINTED = new Set(['gang', 'motorcyclist', 'playerDisguise', 'athlete']);
      let npcPools = null,
        npcByName = null;
      /* Cast indices by tag and sex ('police|f'), children apart ('kid|m'), and by name. */
      function npcAvatarPools() {
        if (npcPools) return npcPools;
        npcPools = new Map();
        npcByName = new Map();
        const cast = npcAvatarCast();
        for (let i = 0; i < cast.length; i++) {
          const a = cast[i];
          npcByName.set(a.name, i);
          for (const tag of a.tags) {
            const key = tag + '|' + a.sex;
            if (!npcPools.has(key)) npcPools.set(key, []);
            npcPools.get(key).push(i);
          }
        }
        return npcPools;
      }
      /* The tag a look is cast from (null: none). */
      function npcAvatarTag(look, p, kid, role, summer, h) {
        if (p?.cityRole?.kind === 'medic' || p?.medic) return 'medic';
        // Children (on the street, at the beach) are only ever children.
        if (kid) return 'kid';
        const outfit = look.outfit;
        if (outfit === 'athlete') return p?.kind === 'steward' ? 'steward' : p?.sport === 'basketball' ? 'basketball' : 'football';
        if (outfit === 'mobster' && p?.boss) return 'boss';
        if (outfit === 'story') return NPC_STORY_TAGS[p?.name] || 'cast';
        if (outfit) return NPC_OUTFIT_TAGS[outfit] || 'cast';
        // Dressed for the beach on the street (shirtless or a bikini: the top is the skin): the beach's own avatars.
        if (look.top && look.top === look.skin) return 'beach';
        return NPC_ROLE_TAGS[role] || (summer && h(21) < 0.5 ? 'summer' : 'street');
      }
      /** The cast index a look is drawn as near the camera, or -1 (the player's own body). */
      function npcAvatarPick(look, p, female, kid, role, summer, h) {
        if (!npcAvatarCast().length || look.outfit === 'player') return -1;
        const pools = npcAvatarPools(),
          sex = female ? 'f' : 'm',
          storied = !look.outfit || look.outfit === 'story' || look.outfit === 'diplomat',
          named = storied ? (NPC_STORY_CAST[p?.missionDriver] ?? NPC_STORY_CAST[p?.name]) : undefined;
        if (named && npcByName.has(named) && !kid) return npcByName.get(named);
        const tag = npcAvatarTag(look, p, kid, role, summer, h);
        let pool = pools.get(tag + '|' + sex);
        if (!pool && NPC_UNIFORMS.has(tag)) pool = pools.get(tag + '|' + (female ? 'm' : 'f'));
        if (!pool) pool = pools.get((tag === 'biker' || tag === 'boss' ? (tag === 'boss' ? 'mobster' : 'gang') : 'cast') + '|' + sex) || pools.get('street|' + sex);
        if (!pool) return -1;
        // A street role mixes in the general street cast now and then.
        if (!look.outfit && tag !== 'street' && tag !== 'medic' && tag !== 'beach' && tag !== 'kid' && h(22) < 0.35) pool = pools.get('street|' + sex) || pool;
        return pool[Math.min(pool.length - 1, Math.floor(h(23) * pool.length))];
      }
      /**
       * The tint a look's avatar wears on its top garment, or null: (linear colour over the garment's mean luminance,
       * 1); the shader multiplies the texel's luminance by it. Gangs in their colours, bikers' jackets, kits, the
       * player's cream suit; a steward's vest in the kit's colour.
       */
      function npcAvatarTint(look, avatar) {
        const a = avatar >= 0 ? npcAvatarCast()[avatar] : null;
        if (!a || !(a.tint > 0)) return null;
        const steward = a.tags.includes('steward');
        if (!steward && !NPC_TINTED.has(look.outfit)) return null;
        const colour = new Three.Color(steward ? look.vest?.a || '#e6e23a' : look.top || '#808080');
        return new Three.Vector4(colour.r / a.tint, colour.g / a.tint, colour.b / a.tint, 1);
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
