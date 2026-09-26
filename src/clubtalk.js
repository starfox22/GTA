    // BEGIN SUBSYSTEM: src/clubtalk.js — Conversations with Marea club-goers
    /**
     * Conversations with Marea club-goers
     * Source: src/clubtalk.js
     * Scope: shared game closure.
     *
     * Stand next to someone at the Marea beach club for about a second (or
     * press E on TALK) and the two of you have a short conversation: alternating
     * speech bubbles over the player and the club-goer, four to six lines. The
     * club-goer turns to face the player and gestures while speaking.
     *
     * Every club-goer gets a personality from where they are (`clubPersona`):
     * the bar staff, the bouncers, the dancers (DJ fans), the VIP terrace
     * (businessmen and influencers), swimmers, and a mix of tourists,
     * influencers, businessmen and fans everywhere else. `CLUB_TALKS` holds the
     * scripts by personality and by day (day and sunset) or night (the nightclub
     * and closing). A line may offer alternatives (one is picked), and a script
     * may end in a `fork` of alternative endings, so the same conversation does
     * not always go the same way. Scripts are not repeated until every one that
     * fits has been heard (`clubTalk.used`).
     *
     * The bubbles go through the crowd's speech (crowd.js speechBubbles): the
     * player is offered as a speaker by `clubTalkSpeakers`, and both speakers are
     * marked `inConversation`, which ranks their lines first so the conversation
     * holds the two bubble slots while it runs. With Settings · Gameplay · NPC
     * chatter off there are no conversations. Walking away ends one politely: the
     * club-goer calls a goodbye after the player.
     */
    const CLUB_TALK = {
      // Reach of TALK and of the automatic start, and the distance that ends it.
      reach: 2.6 * UNITS_PER_METRE,
      leave: 5.5 * UNITS_PER_METRE,
      // Standing still next to someone this long starts a conversation.
      standSeconds: 1,
      // Pause between lines, after each one has had its reading time.
      gap: 0.35,
      // No automatic start with the same person again for this long, nor with anyone right after one.
      againAfter: 90,
      restAfter: 6,
    };
    const CLUB_FAREWELLS = {
      day: ['Catch you later!', 'Ciao!', 'Enjoy the sun!', 'See you around!', 'Don’t be a stranger!'],
      night: ['Catch you later!', 'Ciao, bello!', 'Enjoy the night!', 'See you on the floor!', 'Stay out of trouble!'],
    };
    /**
     * THE SCRIPTS
     * ['n', text] is the club-goer, ['p', text] the player; a text may be a list
     * of alternatives. `fork` holds alternative endings (one is chosen).
     */
    const CLUB_TALKS = [
      // ---- influencers, by day
      { id: 'inf-photo', persona: 'influencer', time: 'day', lines: [['n', 'Could you take my photo? The light is golden.'], ['p', 'Sure. Say “Marea”!'], ['n', 'Wait. My good side is the left.'], ['p', ['Got it. Stunning.', 'Both sides look good to me.']], ['n', 'You’re hired. Tag me!']] },
      { id: 'inf-warm', persona: 'influencer', time: 'day', lines: [['n', 'Two hundred thousand followers and my drink is warm.'], ['p', 'Tragic. Should I call someone?'], ['n', 'Ha! You’re funny. I’m posting you.']], fork: [[['p', 'Blur my face, please.'], ['n', 'Mysterious. Even better.']], [['p', 'Get my good side.'], ['n', 'Babe, it’s all good side.']]] },
      { id: 'inf-collab', persona: 'influencer', time: 'day', lines: [['n', 'Is this lounger free? I need the light.'], ['p', 'All yours.'], ['n', 'I’m shooting a sunscreen collab.'], ['p', 'Very glamorous.'], ['n', 'SPF fifty pays my rent, darling.']] },
      // ---- bar staff, by day
      { id: 'bar-paloma', persona: 'bartender', time: 'day', lines: [['n', 'What can I get you? Spritz is the house pour.'], ['p', 'Something cold, not too sweet.'], ['n', 'Paloma, extra lime. Trust me.'], ['p', 'Sold.'], ['n', 'Tip jar’s the pineapple.']] },
      { id: 'bar-mint', persona: 'bartender', time: 'day', lines: [['p', 'Busy day?'], ['n', 'Three hundred mojitos by noon.'], ['p', 'Your arms must be made of steel.'], ['n', 'Mint. My arms are made of mint.']] },
      { id: 'bar-yacht', persona: 'bartender', time: 'day', lines: [['n', 'See the yacht out there? Big tipper.'], ['p', 'Who owns her?'], ['n', 'Nobody says. Pays cash, every time.'], ['p', ['Interesting.', 'Lucky you.']], ['n', 'In this town you don’t ask twice.']] },
      // ---- tourists, by day
      { id: 'tour-sun', persona: 'tourist', time: 'day', lines: [['n', 'Excuse me, is it always this sunny?'], ['p', 'Three hundred days a year.'], ['n', 'Back home it’s raining. Again.'], ['p', 'So stay a while.'], ['n', 'Don’t tempt me!']] },
      { id: 'tour-fish', persona: 'tourist', time: 'day', lines: [['n', 'Do you know a good seafood place?'], ['p', 'The fish shack by the pier.'], ['n', 'Is it safe to walk there?']], fork: [[['p', 'In daylight, sure.'], ['n', 'Perfect, lunch it is!']], [['p', 'Mostly.'], ['n', 'Mostly? I’ll take a taxi.']]] },
      { id: 'tour-lobster', persona: 'tourist', time: 'day', lines: [['n', 'I got sunburnt in twenty minutes.'], ['p', 'The sea breeze fools you.'], ['n', 'My wife says I look like a lobster.'], ['p', 'A very distinguished lobster.'], ['n', 'Ha! I’m telling her that.']] },
      // ---- businessmen, by day
      { id: 'biz-sell', persona: 'businessman', time: 'day', lines: [['n', 'Sorry, on a call. No, sell. SELL.'], ['p', 'Rough morning?'], ['n', 'Nothing a spritz won’t fix.'], ['p', 'Business at a beach club?'], ['n', 'The best deals happen in flip-flops.']] },
      { id: 'biz-property', persona: 'businessman', time: 'day', lines: [['n', 'You look like you know this city.'], ['p', 'I get around.'], ['n', 'I’m buying waterfront property.'], ['p', 'Careful who you buy from.'], ['n', 'Cash buyers only, they tell me. Funny.']] },
      { id: 'biz-watch', persona: 'businessman', time: 'day', lines: [['p', 'Nice watch.'], ['n', 'A gift. From myself.'], ['p', 'Generous guy.'], ['n', 'I’m my own best client.']] },
      // ---- DJ fans, by day and at sunset
      { id: 'fan-sunset', persona: 'djfan', time: 'day', lines: [['n', 'The sunset set is going to be insane.'], ['p', 'Who’s playing?'], ['n', 'Kaito! Deep house till the sun drops.'], ['p', 'I’ll be here.'], ['n', 'Front row. Bring sunglasses.']] },
      { id: 'fan-balearic', persona: 'djfan', time: 'day', lines: [['n', 'Hear that bassline? Pure Balearic.'], ['p', 'Very chill.'], ['n', 'Chill now. At midnight it’s war.'], ['p', ['Can’t wait.', 'I’ll bring earplugs.']]] },
      // ---- the door and the floor staff, by day
      { id: 'bnc-quiet', persona: 'bouncer', time: 'day', lines: [['p', 'Quiet shift?'], ['n', 'By day, sure. Sunscreen disputes.'], ['p', 'Dangerous work.'], ['n', 'You’d be surprised. Enjoy the pool.']] },
      { id: 'bnc-glass', persona: 'bouncer', time: 'day', lines: [['n', 'No glass by the pool, pal.'], ['p', 'Wouldn’t dream of it.'], ['n', 'Good. Last guy tried it.'], ['p', 'What happened to him?'], ['n', 'He swam home.']] },
      // ---- swimmers in the pool
      { id: 'swim-perfect', persona: 'swimmer', time: 'day', lines: [['n', 'The water’s perfect today!'], ['p', 'Warmer than the sea.'], ['n', 'And no jellyfish.'], ['p', 'Best pool in Palm Keys.'], ['n', 'Race you to the end?']] },
      { id: 'swim-edge', persona: 'swimmer', time: 'any', lines: [['n', 'Have you tried the infinity edge?'], ['p', 'Feels like swimming off the world.'], ['n', 'Right? Straight into the sunset.'], ['p', ['Or the sea.', 'Poetic.']], ['n', 'Don’t ruin it.']] },
      // ---- influencers, at night
      { id: 'inf-famous', persona: 'influencer', time: 'night', lines: [['n', 'Are you somebody? You look like somebody.'], ['p', ['Just a guy.', 'Officially, I’m nobody.']], ['n', 'That’s what famous people say!'], ['p', 'Your secret’s safe.'], ['n', 'Selfie! Now, before the drop!']] },
      { id: 'inf-afterparty', persona: 'influencer', time: 'night', lines: [['n', 'The VIP terrace is SO last season.'], ['p', 'So where’s this season?'], ['n', 'The yacht after-party. Invite only.'], ['p', 'Who’s hosting?'], ['n', 'Someone who never uses his real name.']] },
      { id: 'inf-battery', persona: 'influencer', time: 'night', lines: [['n', 'My phone’s at two percent. I might die.'], ['p', 'You’ll survive.'], ['n', 'Film me dancing? Please?'], ['p', 'One take.'], ['n', 'One is all I need, babe.']] },
      // ---- bar staff, at night
      { id: 'bar-negroni', persona: 'bartender', time: 'night', lines: [['n', 'Last call’s at four. What’ll it be?'], ['p', 'Surprise me.'], ['n', 'Smoked negroni. On fire. Literally.'], ['p', 'Is that legal?'], ['n', 'Around here? Define legal.']] },
      { id: 'bar-chip', persona: 'bartender', time: 'night', lines: [['p', 'Crazy night?'], ['n', 'Somebody tipped with a gold chip.'], ['p', 'From the casino?'], ['n', 'Didn’t ask. Bought my mom a fridge.']] },
      { id: 'bar-van', persona: 'bartender', time: 'night', lines: [['n', 'You didn’t hear it from me…'], ['p', 'Hear what?'], ['n', 'Cops asking about a van at the harbor.'], ['p', 'Why tell me?'], ['n', 'You’ve got that look. Stay cool.']] },
      // ---- tourists, at night
      { id: 'tour-loud', persona: 'tourist', time: 'night', lines: [['n', 'Is it always this loud?'], ['p', 'Only after ten.'], ['n', 'My hotel is right there. I’ll never sleep.'], ['p', 'Then don’t.'], ['n', '…You know what? You’re right.']] },
      { id: 'tour-pancakes', persona: 'tourist', time: 'night', lines: [['n', 'Where do people go after this?'], ['p', 'The diner on Ocean Drive.'], ['n', 'Pancakes at five in the morning?'], ['p', 'It’s tradition.'], ['n', 'I love this city.']] },
      // ---- businessmen, at night
      { id: 'biz-containers', persona: 'businessman', time: 'night', lines: [['n', 'Three bottles. Put it on my tab.'], ['p', 'Celebrating?'], ['n', 'Closed a deal at the port. Containers.'], ['p', 'What’s in them?'], ['n', 'Opportunity, my friend. Opportunity.']] },
      { id: 'biz-network', persona: 'businessman', time: 'night', lines: [['p', 'Having fun?'], ['n', 'I don’t have fun. I network.'], ['p', 'In a nightclub?'], ['n', 'The mayor’s nephew is at the bar.'], ['p', 'Small world.'], ['n', 'Small town. Big money.']] },
      { id: 'biz-card', persona: 'businessman', time: 'night', lines: [['n', 'You look like you can keep a secret.'], ['p', 'Depends on the secret.'], ['n', 'Good answer. My card, if you want work.']], fork: [[['p', 'What kind of work?'], ['n', 'The well-paid kind.']], [['p', 'I’m retired.'], ['n', 'Nobody retires in this city.']]] },
      // ---- DJ fans, at night
      { id: 'fan-drop', persona: 'djfan', time: 'night', lines: [['n', 'THIS DROP! Did you FEEL that?!'], ['p', 'In my ribs!'], ['n', 'Kaito never misses!'], ['p', 'Best set of the summer.'], ['n', 'Hands up! HANDS UP!']] },
      { id: 'fan-drive', persona: 'djfan', time: 'night', lines: [['n', 'I drove four hours for this set.'], ['p', 'Worth it?'], ['n', 'Ask me after the encore!'], ['p', 'Save some energy.'], ['n', 'Energy? I AM energy!']] },
      { id: 'fan-track', persona: 'djfan', time: 'night', lines: [['n', 'Do you know this track?'], ['p', 'No idea. It’s good though.'], ['n', 'Unreleased. Probably.'], ['p', 'Very exclusive.'], ['n', 'Like us. Wooo!']] },
      // ---- the door, at night
      { id: 'bnc-bank', persona: 'bouncer', time: 'night', lines: [['p', 'Long night?'], ['n', 'Longer than the line.'], ['p', 'Anyone good inside?'], ['n', 'Two footballers and a guy who owns a bank.'], ['p', 'Which bank?'], ['n', 'The one you don’t want to rob.']] },
      { id: 'bnc-list', persona: 'bouncer', time: 'night', lines: [['n', 'You behaving in there?'], ['p', ['Like an angel.', 'Mostly.']], ['n', 'Keep it that way. I keep a list.'], ['p', 'Am I on it?'], ['n', 'Not yet.']] },
      { id: 'bnc-philosophy', persona: 'bouncer', time: 'night', lines: [['p', 'How do you get on the list?'], ['n', 'You don’t. The list gets on you.'], ['p', 'Very deep.'], ['n', 'Nights are long. I read.']] },
      // ---- anyone: flirting (kept friendly), the view, gossip
      { id: 'any-jacket', persona: 'any', time: 'night', lines: [['n', 'Love your jacket. Very… nineties.'], ['p', 'It’s vintage.'], ['n', 'So is my taste in music.'], ['p', 'Should I be flattered?'], ['n', 'Buy me a drink and find out.']] },
      { id: 'any-dance', persona: 'any', time: 'night', lines: [['n', 'Do you dance, or just look mysterious?'], ['p', 'Mostly the mysterious part.'], ['n', 'Shame. The floor could use you.']], fork: [[['p', 'Maybe one song.'], ['n', 'I’ll hold you to that.']], [['p', 'Next track, I promise.'], ['n', 'Liar. A cute one, though.']]] },
      { id: 'any-sky', persona: 'any', time: 'day', lines: [['n', 'Look at that sky. Pure gold.'], ['p', 'Best view in town.'], ['n', 'They say it’s the pollution.'], ['p', 'Don’t ruin it.'], ['n', 'Right. Pure gold.']] },
      { id: 'any-helicopter', persona: 'any', time: 'day', lines: [['n', 'Did you see that helicopter earlier?'], ['p', 'Which one?'], ['n', 'Low over the water. No lights.'], ['p', 'Probably the news.'], ['n', 'Sure. The news.']] },
      { id: 'any-blackhull', persona: 'any', time: 'any', lines: [['n', 'That black yacht? Old money, I heard.'], ['p', 'Or new money.'], ['n', 'Or the mayor’s money.'], ['p', 'Keep your voice down.'], ['n', 'Ha! Another round?']] },
      { id: 'any-cocktail', persona: 'any', time: 'any', lines: [['p', 'What are you drinking?'], ['n', 'The Marea Sunset. Mezcal and blood orange.'], ['p', 'Any good?'], ['n', 'Three of these and you’ll see two sunsets.']] },
    ];
    const CLUB_TALK_KINDS = {
      bartender: 'bartender',
      bouncer: 'bouncer',
      host: 'bouncer',
      dancer: 'djfan',
      vip: 'vip',
      bottleGirl: 'influencer',
    };
    const clubTalk = {
      active: null,
      used: new Set(),
      candidate: null,
      standFor: 0,
      last: { x: 0, y: 0 },
      restUntil: -100,
      count: 0,
      heard: [],
    };
    // The player as a speaker for speechBubbles (crowd.js): no allocation per frame.
    const CLUB_TALK_PLAYER = [player],
      CLUB_TALK_NOBODY = [];
    function clubTalkSpeakers() {
      return player.speech && player.speechUntil >= gameTime ? CLUB_TALK_PLAYER : CLUB_TALK_NOBODY;
    }
    /* Who a club-goer is, from where they are (fixed once chosen). */
    function clubPersona(p) {
      if (p.clubPersona) return p.clubPersona;
      const slot = p.club?.slot,
        kind = slot?.kind,
        roll = Math.random();
      let persona = CLUB_TALK_KINDS[kind];
      if (slot?.swim) persona = roll < 0.6 ? 'swimmer' : roll < 0.8 ? 'tourist' : 'influencer';
      else if (persona === 'vip') persona = roll < 0.5 ? 'businessman' : 'influencer';
      else if (kind === 'dancer' && marea.phase !== 'night') persona = roll < 0.6 ? 'djfan' : 'tourist';
      else if (!persona) persona = roll < 0.38 ? 'tourist' : roll < 0.62 ? 'influencer' : roll < 0.82 ? 'businessman' : 'djfan';
      return (p.clubPersona = persona);
    }
    function clubTalkTime() {
      return marea.phase === 'night' || marea.phase === 'closing' ? 'night' : 'day';
    }
    /* A script for this person and hour, not heard before while any are left. */
    function pickClubTalk(persona, time) {
      const fits = (t) => t.time === time || t.time === 'any';
      const unused = (t) => !clubTalk.used.has(t.id);
      let pool = CLUB_TALKS.filter((t) => t.persona === persona && fits(t) && unused(t));
      if (!pool.length) pool = CLUB_TALKS.filter((t) => t.persona === 'any' && fits(t) && unused(t));
      // Then another guest's (staff and swimmers' scripts only fit them).
      if (!pool.length) pool = CLUB_TALKS.filter((t) => fits(t) && unused(t) && !['swimmer', 'bouncer', 'bartender'].includes(t.persona));
      if (!pool.length) {
        // Everything for this hour has been heard: start the round again.
        for (const t of CLUB_TALKS) if (fits(t)) clubTalk.used.delete(t.id);
        pool = CLUB_TALKS.filter((t) => (t.persona === persona || t.persona === 'any') && fits(t));
      }
      const script = randomChoice(pool);
      clubTalk.used.add(script.id);
      const lines = [...script.lines, ...(script.fork ? randomChoice(script.fork) : [])];
      return { id: script.id, lines: lines.map(([who, text]) => [who, Array.isArray(text) ? randomChoice(text) : text]) };
    }
    /* The player can chat: on foot (or swimming in the pool) at the club, chatter on. */
    function clubTalkPlayerFree() {
      if (gameMode !== 'play' || !npcChatterOn() || !marea.built || player.car || player.climbing || player.wading) return false;
      if (player.swimming && player.pool?.phase !== 'swim') return false;
      if (player.swimming && !player.pool) return false;
      if (volleyPlayerInMatch() || gameTime < marea.spookedUntil || wantedStars >= 3) return false;
      return mareaDistance(player.x, player.y) < 12;
    }
    function clubTalkable(p) {
      const c = p.club,
        slot = c?.slot;
      if (!c || c.mode !== 'slot' || !slot || p.hp <= 0 || p.react || p.flee > 0 || personIncapacitated(p)) return false;
      if (['dj', 'mc', 'dancerBooth', 'waiter', 'crew', 'cleaner', 'smoker'].includes(slot.kind)) return false;
      // The head bouncer is busy while he is dealing with the line.
      if (slot.kind === 'bouncer' && (slot.head || slot.vipGuard) && marea.talk) return false;
      return true;
    }
    function clubTalkCandidate() {
      let best = null,
        bd = CLUB_TALK.reach;
      for (const p of marea.people) {
        const dx = p.x - player.x,
          dy = p.y - player.y;
        if (dx > bd || dx < -bd || dy > bd || dy < -bd) continue;
        const d = Math.hypot(dx, dy);
        if (d < bd && clubTalkable(p) && sameFloor(p, player)) {
          bd = d;
          best = p;
        }
      }
      return best;
    }
    function clubTalkSay(speaker, text) {
      speaker.speech = text;
      speaker.speechUntil = gameTime + speechReadSeconds(text);
      speaker.speechKind = 'clubTalk';
      speaker.speechKindText = text;
    }
    function startClubTalk(p) {
      const script = pickClubTalk(clubPersona(p), clubTalkTime());
      clubTalk.active = { npc: p, id: script.id, lines: script.lines, index: -1, next: gameTime + 0.15, startedAt: gameTime, waveUntil: gameTime + 1.2 };
      clubTalk.count++;
      clubTalk.heard.push(script.id);
      if (clubTalk.heard.length > 60) clubTalk.heard.shift();
      p.inConversation = true;
      player.inConversation = true;
      p.talkedAt = gameTime;
      p.speechUntil = 0;
      clubTalk.candidate = null;
      clubTalk.standFor = 0;
      // Turn to them if standing still.
      if (!playerDriving()) player.a = Math.atan2(p.y - player.y, p.x - player.x);
    }
    function endClubTalk(farewell) {
      const t = clubTalk.active;
      if (!t) return;
      clubTalk.active = null;
      const p = t.npc;
      p.inConversation = false;
      player.inConversation = false;
      clubTalk.restUntil = gameTime + CLUB_TALK.restAfter;
      if (farewell && p.hp > 0 && npcChatterOn()) {
        clubTalkSay(p, randomChoice(CLUB_FAREWELLS[clubTalkTime()]));
        p.clubWaveUntil = gameTime + 1.4;
      }
    }
    /* Per frame (updateLeisure, leisure.js). */
    function updateClubTalk(deltaSeconds) {
      const t = clubTalk.active;
      if (t) {
        const p = t.npc;
        // Something else took over: the club-goer left, ran or fell, or the player is busy.
        if (!clubTalkable(p) || !clubTalkPlayerFree()) {
          p.speechUntil = Math.min(p.speechUntil || 0, gameTime);
          player.speechUntil = Math.min(player.speechUntil || 0, gameTime);
          endClubTalk(false);
          return;
        }
        if (distanceBetween(p, player) > CLUB_TALK.leave) {
          player.speechUntil = Math.min(player.speechUntil || 0, gameTime);
          endClubTalk(true);
          return;
        }
        if (gameTime >= t.next) {
          t.index++;
          if (t.index >= t.lines.length) {
            endClubTalk(false);
            return;
          }
          const [who, text] = t.lines[t.index];
          clubTalkSay(who === 'p' ? player : p, text);
          t.speaker = who;
          t.next = gameTime + speechReadSeconds(text) + CLUB_TALK.gap;
        }
        return;
      }
      // Waiting: standing still next to someone for a moment starts one.
      const moved = Math.hypot(player.x - clubTalk.last.x, player.y - clubTalk.last.y);
      clubTalk.last.x = player.x;
      clubTalk.last.y = player.y;
      if (!clubTalkPlayerFree()) {
        clubTalk.candidate = null;
        clubTalk.standFor = 0;
        return;
      }
      const p = clubTalkCandidate(),
        still = moved < Math.max(0.5, deltaSeconds * 6);
      if (p !== clubTalk.candidate) clubTalk.standFor = 0;
      clubTalk.candidate = p;
      if (!p || !still) {
        clubTalk.standFor = 0;
        return;
      }
      clubTalk.standFor += deltaSeconds;
      if (clubTalk.standFor >= CLUB_TALK.standSeconds && gameTime > clubTalk.restUntil && (p.talkedAt ?? -1e9) < gameTime - CLUB_TALK.againAfter) startClubTalk(p);
    }
    function clubTalkPrompt() {
      // While talking, E moves the conversation on.
      if (clubTalk.active) return { text: 'NEXT LINE', id: 'marea-talk' };
      if (!clubTalkPlayerFree()) return null;
      const p = clubTalk.candidate && clubTalkable(clubTalk.candidate) && distanceBetween(clubTalk.candidate, player) < CLUB_TALK.reach ? clubTalk.candidate : clubTalkCandidate();
      return p ? { text: 'TALK', id: 'marea-talk' } : null;
    }
    /* E: start one with whoever is next to you, or move a running one on. */
    function clubTalkInteract() {
      if (clubTalk.active) {
        clubTalk.active.next = Math.min(clubTalk.active.next, gameTime);
        return true;
      }
      if (!clubTalkPlayerFree()) return false;
      const p = clubTalkCandidate();
      if (!p) return false;
      startClubTalk(p);
      return true;
    }
    /**
     * THE CLUB-GOER'S SIDE
     * Called from updateMareaSlotPerson (beachclub.js) before a slot's own
     * behaviour: someone in a conversation turns to the player and talks with
     * their hands; someone who just saw a dive claps. True when handled.
     */
    const CLUB_STANDING_POSES = ['drink', 'chat', 'dance', 'watch', 'wait', 'arms', 'sway', 'sparkler', 'bartend', null, undefined];
    function clubGoerOverride(p, slot, deltaSeconds) {
      const talking = clubTalk.active?.npc === p,
        waving = (p.clubWaveUntil || 0) > gameTime,
        cheering = (p.clubCheerUntil || 0) > gameTime;
      if (!talking && !waving && !cheering) return false;
      const standing = CLUB_STANDING_POSES.includes(slot.pose);
      if (slot.pose !== 'lounge') {
        const face = Math.atan2(player.y - p.y, player.x - p.x);
        p.a += normalizeAngle(face - p.a) * Math.min(1, deltaSeconds * 6);
      }
      if (slot.swim) {
        p.pose = 'swim';
        p.altitude = slot.z + Math.sin(gameTime * 1.7 + p.phase) * 0.35;
      } else if (standing) {
        const t = clubTalk.active,
          speaking = talking && t.speaker === 'n' && p.speechUntil > gameTime;
        if (cheering && !talking) p.pose = p.club.cheerPose || 'clap';
        else if (waving || (talking && gameTime < t.waveUntil)) p.pose = 'wave';
        else if (speaking) p.pose = 'chat';
        else p.pose = slot.pose === 'dance' ? 'sway' : slot.pose === 'bartend' ? 'wait' : slot.pose || 'wait';
      } else p.pose = slot.pose;
      return true;
    }
    /* Developer console: DeadEndCity.clubTalk(). */
    function clubTalkReport() {
      const t = clubTalk.active;
      const personas = {};
      for (const s of CLUB_TALKS) personas[s.persona] = (personas[s.persona] || 0) + 1;
      return {
        conversations: CLUB_TALKS.length,
        byPersona: personas,
        day: CLUB_TALKS.filter((s) => s.time !== 'night').length,
        night: CLUB_TALKS.filter((s) => s.time !== 'day').length,
        active: t
          ? {
              id: t.id,
              persona: t.npc.clubPersona,
              kind: t.npc.club?.slot?.kind,
              line: t.index,
              lines: t.lines.map(([who, text]) => (who === 'p' ? 'PLAYER: ' : 'NPC: ') + text),
              npcPose: t.npc.pose,
              distance: Math.round(distanceBetween(t.npc, player)),
            }
          : null,
        candidate: clubTalk.candidate ? { kind: clubTalk.candidate.club?.slot?.kind, distance: Math.round(distanceBetween(clubTalk.candidate, player)) } : null,
        standFor: +clubTalk.standFor.toFixed(2),
        started: clubTalk.count,
        heard: clubTalk.heard.slice(-10),
        used: clubTalk.used.size,
        playerSpeech: player.speech && player.speechUntil >= gameTime ? player.speech : null,
        bubbles: speechBubbles().map((p) => ({ who: p === player ? 'player' : p.club ? 'club-goer' : 'other', text: p.speech })),
      };
    }
    /* Developer console: stand beside someone at the club who can talk (the nearest with room beside them). */
    function clubTalkApproach() {
      const people = marea.people
        .filter((p) => clubTalkable(p) && !p.club.slot.swim && p.club.slot.pose !== 'lounge' && (p.talkedAt ?? -1e9) < gameTime - CLUB_TALK.againAfter)
        .sort((a, b) => distanceBetween(a, player) - distanceBetween(b, player));
      for (const p of people.slice(0, 40))
        for (const r of [14, 18])
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * TAU,
              x = p.x + Math.cos(a) * r,
              y = p.y + Math.sin(a) * r;
            if (solid(x, y, 8) || !mareaInside(x, y)) continue;
            teleportPlayer(x, y);
            player.a = Math.atan2(p.y - y, p.x - x);
            clubTalk.last.x = x;
            clubTalk.last.y = y;
            return { kind: p.club.slot.kind, x: Math.round(p.x), y: Math.round(p.y), persona: clubPersona(p) };
          }
      return null;
    }
    // END SUBSYSTEM: src/clubtalk.js
