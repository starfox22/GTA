    // People's voices: whether someone is drawn as a woman or a man (personFemale) and the
    // recorded scream that fits them (screamVoice, playPersonScream, voiceReport).
    /**
     * VOICES MATCH FACES
     * There are two recorded screams for each sex (asset-loader.js). Which one a
     * person gets follows how the character rig draws them, through the same rule:
     * street people by their look (`lookFemale`, which crowd3d-looks.js compileLook
     * calls too), the player, officers, gangs, guests and story characters by their
     * outfit and a seed kept on the person (`outfitFemale`, `personLookSeed`, which
     * crowd3d-looks.js outfitLook uses), beachgoers and coaster riders by their own
     * `female`. Everyone keeps one of the two takes and a pitch of their own; children
     * shriek higher (the women's takes, sped up), the elderly a little lower. The
     * police recordings are all men (THIRD_PARTY_CREDITS): a line meant for a woman
     * officer is said by a male colleague near her (audio.js radio, `maleVoiceNear`).
     * A crowd that screams (the stands, the beach, the coaster) picks real people in it.
     * DeadEndCity.voiceReport() lists who is who and the last screams.
     */
    const FEMALE_NAMES = /\b(MARA|ELENA|MARIA|SOFIA|ROSA|LUCIA|NINA|ANNA|CLAIRE|EVA)\b/;
    /* The rig's hash (crowd3d-looks.js hashOf): deterministic 0..1 from a seed and a slot. */
    function lookHash(seed, k) {
      const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
      return x - Math.floor(x);
    }
    /* A street look's sex, exactly as compileLook decides it. */
    function lookFemale(look) {
      if (!look) return false;
      if (look.female != null) return !!look.female;
      if (look.skirt || look.hairStyle === 2 || look.hairStyle === 3) return true;
      return look.hairStyle === 4 && lookHash((look.build || 1) * 1000 + (look.height || 1) * 77, 1) < 0.5;
    }
    /* Which outfit the rig dresses a special character in (crowd3d-looks.js specialLook). */
    function personOutfit(p) {
      if (p === player) return player.disguised ? 'playerDisguise' : 'player';
      if (p.police) return { patrol: 'police', road: 'traffic', swat: 'swat', sniper: 'swat', fed: 'fed', soldier: 'army' }[p.unit] || 'police';
      if (p.military) return p.role === 'gate' ? 'mp' : 'army';
      if (p.guest) return p.staff ? 'waiter' : 'partyGuest';
      if (p.faction === 'vescari' || p.guard || p.boss) return 'mobster';
      if (p.faction) return 'gang';
      return 'story';
    }
    /* The seed an outfit is varied by (face, hair, build and sex): one per person, for good. */
    function personLookSeed(p) {
      if (p.lookSeed == null) p.lookSeed = Math.random() * 1000;
      return p.lookSeed;
    }
    /* An outfit's sex for a seed: the one rule outfitLook (crowd3d-looks.js) dresses by. */
    function outfitFemale(p, outfit, seed) {
      const h = lookHash(seed, 5);
      switch (outfit) {
        case 'police':
        case 'traffic':
          return h < 0.3;
        case 'fed':
          return h < 0.25;
        case 'partyGuest':
          return h < 0.5;
        case 'gang':
          return h < 0.2;
        case 'cyclist':
        case 'motorcyclist':
        case 'jetskier':
          return h < 0.35;
        case 'beach':
          return !!p.female;
        case 'player':
        case 'playerDisguise':
        case 'swat':
        case 'army':
        case 'mp':
        case 'mobster':
        case 'waiter':
        case 'athlete':
          return false;
        default:
          return FEMALE_NAMES.test(p.name || '') || (p.name ? false : h < 0.5);
      }
    }
    /* Drawn in an outfit (render3d-frame.js: enemies, gangs, officers, story actors). */
    function drawnInOutfit(p) {
      return !!(p.police || p.military) || officers.includes(p) || enemies.includes(p) || gangMembers.includes(p) || storyActors.includes(p);
    }
    function personFemale(p) {
      if (!p || p === player) return false;
      // Beachgoers (beach.js) and coaster riders carry it; so may anyone set up by hand.
      if (typeof p.female === 'boolean') return p.female;
      // Players and officials on match day wear the athlete kit (sports3d.js queueAthlete).
      if (p.sport && p.kit) return outfitFemale(p, 'athlete', 0);
      if (drawnInOutfit(p)) return outfitFemale(p, personOutfit(p), personLookSeed(p));
      return lookFemale(p.look || ensureLook(p));
    }
    function personIsKid(p) {
      return !!p && (p.role === 'kid' || p.kind === 'kid' || !!p.look?.kid || (typeof p.female === 'boolean' && (p.scale || 1) < 0.8));
    }
    /* One of the two takes and a pitch, the same for a person every time. */
    const screamScratch = { name: '', rate: 1, female: false, kid: false };
    function screamVoice(p) {
      if (p.voiceSeed == null) p.voiceSeed = Math.random();
      const female = personFemale(p),
        kid = personIsKid(p),
        v = p.voiceSeed;
      screamScratch.female = female;
      screamScratch.kid = kid;
      screamScratch.name = 'civilian-scream-' + (female || kid ? 'female-' : 'male-') + (v < 0.5 ? 1 : 2);
      screamScratch.rate = (kid ? 1.22 : p.role === 'elder' ? 0.9 : 1) * (0.95 + ((v * 7.31) % 1) * 0.1);
      return screamScratch;
    }
    const voiceLog = [];
    /* A person's scream, placed on them (volume before distance). Returns the take. */
    function playPersonScream(p, volume = 0.65, bus = null, delay = 0, at = p) {
      const v = screamVoice(p);
      voiceLog.push({ at: +gameTime.toFixed(2), who: voiceWho(p), female: v.female, kid: v.kid, sample: v.name });
      if (voiceLog.length > 12) voiceLog.shift();
      playSample(v.name, volume, v.rate * randomBetween(0.98, 1.02), at, bus || master, delay);
      return v.name;
    }
    /* For a line recorded by a man: `o` if he is one, else the nearest man in uniform
       within earshot of her, else null (the line is only captioned). */
    function maleVoiceNear(o) {
      if (!o || !personFemale(o)) return o;
      let best = null,
        bd = 320;
      for (const q of officers) {
        if (q === o || q.hp <= 0 || personFemale(q)) continue;
        const d = distanceBetween(q, o);
        if (d < bd) {
          best = q;
          bd = d;
        }
      }
      return best;
    }
    function voiceWho(p) {
      if (p === player) return 'player';
      if (p.police) return 'officer-' + (p.unit || 'patrol');
      if (p.military) return 'soldier';
      if (p.coasterRider) return 'coaster rider';
      if (typeof p.female === 'boolean' && p.kind) return 'beach ' + p.kind;
      if (p.faction) return 'gang';
      if (storyActors.includes(p) || enemies.includes(p)) return p.name || 'story';
      return p.role || 'pedestrian';
    }
    /* Console (DeadEndCity.voiceReport): people near the player with the sex the voices
       use and, with the 3D renderer, the one the rig drew (`drawn`); `mismatches` counts
       any disagreement; `screams` are the last dozen played, each with its sample. */
    function voiceReport(radius = 600) {
      const people = [];
      const add = (p) => {
        if (!p || p.hp <= 0 || distanceBetween(p, player) > radius) return;
        const v = screamVoice(p),
          drawn = city3D?.drawnFemale ? city3D.drawnFemale(p) : null,
          entry = { who: voiceWho(p), female: v.female, kid: v.kid, sample: v.name, drawn, x: Math.round(p.x), y: Math.round(p.y) };
        // Who voices this officer's recorded (male) lines: themselves, a colleague, nobody.
        if (p.police) {
          const voice = maleVoiceNear(p);
          entry.radio = voice === p ? 'self' : voice ? 'colleague' : 'caption';
        }
        people.push(entry);
      };
      add(player);
      for (const list of [officers, gangMembers, enemies, storyActors, pedestrians]) for (const p of list) add(p);
      const mismatches = people.filter((q) => q.drawn !== null && q.drawn !== undefined && q.drawn !== q.female).length,
        wrongTake = people.filter((q) => !q.kid && q.female !== q.sample.includes('female')).length;
      return {
        people: people.length,
        women: people.filter((q) => q.female).length,
        checkedAgainstRig: people.filter((q) => q.drawn !== null && q.drawn !== undefined).length,
        mismatches,
        wrongTake,
        womenOnRadio: people.filter((q) => q.female && q.radio === 'self').length,
        sample: people.slice(0, 40),
        screams: voiceLog.slice(),
      };
    }
