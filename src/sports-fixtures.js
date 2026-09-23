    // BEGIN SUBSYSTEM: src/sports-fixtures.js — Teams, kits, crests and the fixture calendar
    /**
     * Teams, kits, crests and the fixture calendar
     * Source: src/sports-fixtures.js
     * Scope: shared game closure (included before sports.js).
     *
     * Who plays, when, and in what. Every in-game day has its own fixtures drawn
     * from a pool of fictional clubs; a fixture is a pure function of the day and
     * the kickoff slot, so a saved game, a clock jump or a new game all agree on
     * who is playing without storing anything.
     *
     * - SPORTS_TEAMS.<sport>: the club pool. `kit` is the home strip (primary,
     *   secondary, a pattern the athlete model paints, shorts, socks, keeper
     *   shirt); `crest` picks the badge shape drawSportsCrest() paints.
     * - SPORTS_CALENDAR.<sport>: kickoff slots (minutes after midnight), the
     *   number and length of periods in match minutes and in world seconds (one
     *   world minute passes per second of play), the breaks, the warm-up before
     *   kickoff and how long the result stays up afterwards.
     * - sportsFixtureFor(sport, day, slot): that fixture (teams, kickoff, crowd).
     * - sportsCurrentFixture(sport, minutes, abandonedDay): the fixture the venue
     *   is showing at that world time: the one being played, or the next one.
     * - sportsTimeline(fixture, minutes): where in the match that time falls
     *   (upcoming, warmup, live period n, break, fulltime, over) and the clock.
     */
    const SPORTS_TEAMS = {
      soccer: [
        { name: 'HARBOR ROVERS', short: 'HRV', crest: 'anchor', kit: { primary: '#1f3f8f', secondary: '#f2f2ee', pattern: 'hoops', shorts: '#f2f2ee', socks: '#1f3f8f', keeper: '#e8c547' } },
        { name: 'SOUTHPORT ATHLETIC', short: 'SPA', crest: 'shield', kit: { primary: '#c8242f', secondary: '#f4f1e8', pattern: 'stripes', shorts: '#1b1b20', socks: '#c8242f', keeper: '#52b36a' } },
        { name: 'NORTHBANK CITY', short: 'NBC', crest: 'round', kit: { primary: '#6cb4e8', secondary: '#f4f4f0', pattern: 'plain', shorts: '#f4f4f0', socks: '#6cb4e8', keeper: '#f08a2b' } },
        { name: 'CANNERY TOWN', short: 'CAN', crest: 'diamond', kit: { primary: '#2f8a3e', secondary: '#f2c230', pattern: 'halves', shorts: '#1f2a22', socks: '#f2c230', keeper: '#9b59c9' } },
        { name: 'EASTSIDE WANDERERS', short: 'EWA', crest: 'star', kit: { primary: '#1c1c1f', secondary: '#f07a1a', pattern: 'stripes', shorts: '#1c1c1f', socks: '#f07a1a', keeper: '#3fc4d8' } },
        { name: 'RIVERSIDE UNITED', short: 'RSU', crest: 'shield', kit: { primary: '#7d1e36', secondary: '#8cc6ea', pattern: 'sash', shorts: '#f4f4f0', socks: '#7d1e36', keeper: '#e8e04a' } },
        { name: 'KEYS ALBION', short: 'KEY', crest: 'round', kit: { primary: '#f1f0ea', secondary: '#1d2b57', pattern: 'chevron', shorts: '#1d2b57', socks: '#f1f0ea', keeper: '#2c2c2c' } },
        { name: 'AIRPORT RANGERS', short: 'APR', crest: 'star', kit: { primary: '#5b2d8c', secondary: '#e8b923', pattern: 'sash', shorts: '#5b2d8c', socks: '#e8b923', keeper: '#63c36b' } },
        { name: 'DOCKERS FC', short: 'DOC', crest: 'anchor', kit: { primary: '#e9772b', secondary: '#20325c', pattern: 'hoops', shorts: '#20325c', socks: '#e9772b', keeper: '#d4d4d4' } },
        { name: 'PALM BEACH FC', short: 'PBF', crest: 'diamond', kit: { primary: '#16a3a0', secondary: '#f28bb4', pattern: 'halves', shorts: '#f4f4f0', socks: '#16a3a0', keeper: '#f2d23c' } },
        { name: 'OLD TOWN HARRIERS', short: 'OTH', crest: 'shield', kit: { primary: '#f0cf2a', secondary: '#151515', pattern: 'stripes', shorts: '#151515', socks: '#f0cf2a', keeper: '#3d7be0' } },
      ],
      basketball: [
        { name: 'RIVERSIDE RAYS', short: 'RAY', crest: 'round', kit: { primary: '#ee854b', secondary: '#1d2b57', pattern: 'plain', shorts: '#ee854b', socks: '#f4f4f0' } },
        { name: 'DOWNTOWN DUKES', short: 'DUK', crest: 'shield', kit: { primary: '#537ee5', secondary: '#f4f4f0', pattern: 'plain', shorts: '#537ee5', socks: '#f4f4f0' } },
        { name: 'HARBOR HEAT', short: 'HHT', crest: 'star', kit: { primary: '#d12f2f', secondary: '#f2c230', pattern: 'sash', shorts: '#d12f2f', socks: '#f2c230' } },
        { name: 'KEYS KINGS', short: 'KGS', crest: 'diamond', kit: { primary: '#6d3f9e', secondary: '#f2c230', pattern: 'plain', shorts: '#6d3f9e', socks: '#f2c230' } },
        { name: 'NORTHBANK KNIGHTS', short: 'NKN', crest: 'shield', kit: { primary: '#2c2c34', secondary: '#c9ccd4', pattern: 'stripes', shorts: '#2c2c34', socks: '#c9ccd4' } },
        { name: 'CANNERY COBRAS', short: 'COB', crest: 'anchor', kit: { primary: '#2f8a3e', secondary: '#f4f4f0', pattern: 'hoops', shorts: '#2f8a3e', socks: '#f4f4f0' } },
      ],
    };

    const SPORTS_CALENDAR = {
      soccer: {
        // A lunchtime match and a floodlit evening match every day.
        slots: [12 * 60 + 30, 20 * 60],
        periods: 2,
        periodMinutes: 45,
        periodSeconds: 150,
        breakSeconds: 45,
        warmupSeconds: 40,
        afterSeconds: 45,
        periodNames: ['1ST HALF', '2ND HALF'],
        breakName: 'HALF TIME',
      },
      basketball: {
        slots: [10 * 60, 15 * 60, 20 * 60],
        periods: 4,
        periodMinutes: 10,
        periodSeconds: 45,
        breakSeconds: 15,
        warmupSeconds: 20,
        afterSeconds: 30,
        periodNames: ['Q1', 'Q2', 'Q3', 'Q4'],
        breakName: 'BREAK',
      },
    };

    // Deterministic 32-bit hash of a few integers (fixtures must not consume the
    // world's random stream, or the city would change with the fixture list).
    function sportsHash(...values) {
      let hash = 2166136261;
      for (const value of values) {
        hash = Math.imul(hash ^ (value | 0), 16777619);
        hash ^= hash >>> 13;
        hash = Math.imul(hash, 0x5bd1e995);
        hash ^= hash >>> 15;
      }
      return hash >>> 0;
    }

    function sportsColorDistance(first, second) {
      const a = parseInt(first.slice(1), 16),
        b = parseInt(second.slice(1), 16);
      return Math.hypot(
        ((a >> 16) & 255) - ((b >> 16) & 255),
        ((a >> 8) & 255) - ((b >> 8) & 255),
        (a & 255) - (b & 255),
      );
    }

    /* The away side changes strip (its colours swapped) when the shirts clash. */
    function sportsAwayKit(home, away) {
      const kit = away.kit;
      if (sportsColorDistance(home.kit.primary, kit.primary) > 150) return { ...kit, change: false };
      return {
        ...kit,
        primary: kit.secondary,
        secondary: kit.primary,
        shorts: kit.secondary,
        socks: kit.secondary,
        change: true,
      };
    }

    /* One fixture: a pure function of sport, day and slot. */
    function sportsFixtureFor(sport, day, slot) {
      const pool = SPORTS_TEAMS[sport],
        calendar = SPORTS_CALENDAR[sport],
        hash = sportsHash(day, slot, sport === 'soccer' ? 11 : 7),
        homeIndex = hash % pool.length,
        // Offset 1..n-1 so a club never plays itself.
        awayIndex = (homeIndex + 1 + ((hash >>> 8) % (pool.length - 1))) % pool.length,
        home = pool[homeIndex],
        away = pool[awayIndex];
      return {
        sport,
        id: sport + ':' + day + ':' + slot,
        day,
        slot,
        kickoff: day * 1440 + calendar.slots[slot],
        home,
        away,
        kits: [{ ...home.kit, change: false }, sportsAwayKit(home, away)],
        // Share of seats sold (the stands fill to this during the match).
        attendance: 0.62 + ((hash >>> 16) % 1000) / 1000 * 0.36,
        seed: hash,
      };
    }

    /* Minutes from kickoff to the final whistle. */
    function sportsMatchLength(sport) {
      const calendar = SPORTS_CALENDAR[sport];
      return calendar.periods * calendar.periodSeconds + (calendar.periods - 1) * calendar.breakSeconds;
    }

    /**
     * The fixture the venue shows at a world time: the match being played (from
     * the warm-up until the result comes down), otherwise the next one. A match
     * abandoned today stays the current fixture (its bodies stay down, its
     * boards say so) until the next day's first fixture warms up.
     */
    function sportsCurrentFixture(sport, minutes, abandoned = null) {
      const calendar = SPORTS_CALENDAR[sport],
        today = Math.floor(minutes / 1440),
        length = sportsMatchLength(sport),
        fixtures = [];
      for (let day = today - 1; day <= today + 2; day++)
        for (let slot = 0; slot < calendar.slots.length; slot++) {
          if (day < 0) continue;
          if (abandoned && abandoned.day === day && abandoned.slot !== slot) continue;
          fixtures.push(sportsFixtureFor(sport, day, slot));
        }
      let current = null;
      for (const fixture of fixtures) {
        if (fixture.kickoff - calendar.warmupSeconds > minutes) break;
        current = fixture;
      }
      if (current) {
        const over = current.kickoff + length + calendar.afterSeconds;
        if (minutes < over || (abandoned && abandoned.id === current.id)) return current;
      }
      return fixtures.find((fixture) => fixture.kickoff - calendar.warmupSeconds > minutes) || current;
    }

    /**
     * Where a world time falls in a fixture. `clock` is the match clock in match
     * minutes (0 at kickoff, periodMinutes per period); `remaining` is world
     * seconds left in the current stage.
     */
    function sportsTimeline(fixture, minutes) {
      const calendar = SPORTS_CALENDAR[fixture.sport],
        t = minutes - fixture.kickoff,
        stride = calendar.periodSeconds + calendar.breakSeconds;
      if (t < -calendar.warmupSeconds)
        return { stage: 'upcoming', period: 0, clock: 0, remaining: -calendar.warmupSeconds - t };
      if (t < 0) return { stage: 'warmup', period: 0, clock: 0, remaining: -t };
      const length = sportsMatchLength(fixture.sport);
      if (t >= length) {
        const after = t - length;
        return after < calendar.afterSeconds
          ? { stage: 'fulltime', period: calendar.periods - 1, clock: calendar.periods * calendar.periodMinutes, remaining: calendar.afterSeconds - after }
          : { stage: 'over', period: calendar.periods - 1, clock: calendar.periods * calendar.periodMinutes, remaining: 0 };
      }
      const period = Math.min(calendar.periods - 1, Math.floor(t / stride)),
        into = t - period * stride;
      if (into < calendar.periodSeconds)
        return {
          stage: 'live',
          period,
          clock: (period + into / calendar.periodSeconds) * calendar.periodMinutes,
          remaining: calendar.periodSeconds - into,
        };
      return {
        stage: 'break',
        period,
        clock: (period + 1) * calendar.periodMinutes,
        remaining: stride - into,
      };
    }

    /* "12:30", "20:00" for a kickoff in world minutes. */
    function sportsKickoffText(kickoff) {
      const minute = ((kickoff % 1440) + 1440) % 1440;
      return String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(Math.floor(minute % 60)).padStart(2, '0');
    }

    /**
     * A club badge on a 2D canvas (the scoreboards, the 2D map renderer): the
     * crest shape in the club's primary colour, a band of its secondary colour
     * and its three-letter code. `size` is the badge height in canvas pixels.
     */
    function drawSportsCrest(context, team, x, y, size) {
      const kit = team.kit,
        half = size / 2;
      context.save();
      context.translate(x, y);
      context.beginPath();
      if (team.crest === 'round') context.arc(0, 0, half, 0, TAU);
      else if (team.crest === 'diamond') {
        context.moveTo(0, -half);
        context.lineTo(half * 0.85, 0);
        context.lineTo(0, half);
        context.lineTo(-half * 0.85, 0);
        context.closePath();
      } else if (team.crest === 'star') {
        for (let point = 0; point < 10; point++) {
          const angle = -Math.PI / 2 + (point * Math.PI) / 5,
            radius = point % 2 ? half * 0.52 : half;
          context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        context.closePath();
      } else {
        // Shield (also the anchor badge's outline).
        context.moveTo(-half * 0.8, -half);
        context.lineTo(half * 0.8, -half);
        context.lineTo(half * 0.8, 0);
        context.quadraticCurveTo(half * 0.8, half * 0.7, 0, half);
        context.quadraticCurveTo(-half * 0.8, half * 0.7, -half * 0.8, 0);
        context.closePath();
      }
      context.fillStyle = kit.primary;
      context.fill();
      context.save();
      context.clip();
      context.fillStyle = kit.secondary;
      if (kit.pattern === 'stripes' || kit.pattern === 'halves')
        context.fillRect(-size * 0.12, -half, size * 0.24, size);
      else context.fillRect(-half, -size * 0.09, size, size * 0.18);
      context.restore();
      context.lineWidth = Math.max(2, size * 0.07);
      context.strokeStyle = kit.secondary;
      context.stroke();
      if (team.crest === 'anchor') {
        // A small anchor over the band for the harbour clubs.
        context.strokeStyle = sportsColorDistance(kit.primary, '#f4f4f0') > 200 ? '#f4f4f0' : '#1b1b20';
        context.lineWidth = Math.max(2, size * 0.06);
        context.beginPath();
        context.moveTo(0, -half * 0.55);
        context.lineTo(0, half * 0.5);
        context.moveTo(-half * 0.3, -half * 0.3);
        context.lineTo(half * 0.3, -half * 0.3);
        context.moveTo(-half * 0.45, half * 0.15);
        context.quadraticCurveTo(0, half * 0.75, half * 0.45, half * 0.15);
        context.stroke();
      } else {
        context.fillStyle = sportsColorDistance(kit.primary, '#f4f4f0') > 200 ? '#f4f4f0' : '#1b1b20';
        context.font = '800 ' + Math.round(size * 0.3) + 'px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(team.short, 0, size * 0.02, size * 0.8);
      }
      context.restore();
    }
    // END SUBSYSTEM: src/sports-fixtures.js
