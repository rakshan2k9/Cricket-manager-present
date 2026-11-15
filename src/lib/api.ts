import { auth } from './firebase';
import {
  DEMO_ALL_PLAYERS,
  DEMO_COACH_CATALOG,
  DEMO_LEAGUE_STATE,
  DEMO_SCOUT_CATALOG,
  DEMO_SQUAD,
  isAutostartDemo,
} from '../utils/demoLeagueState';

export async function getFreshIdToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    if (isAutostartDemo()) {
      return 'demo-showcase-token';
    }
    throw new Error('Authentication required.');
  }
  return user.getIdToken(forceRefresh);
}

function handleAutostartDemoRequest<T>(path: string, options: RequestInit = {}): T {
  const cleanPath = path.split('?')[0];
  const queryStr = path.includes('?') ? path.split('?')[1] : '';
  const params = new URLSearchParams(queryStr);

  if (cleanPath.endsWith('/catalogs')) {
    return {
      scouts: DEMO_SCOUT_CATALOG,
      coaches: DEMO_COACH_CATALOG,
    } as T;
  }

  if (cleanPath.includes('/teams/') && cleanPath.endsWith('/squad')) {
    const teamIdMatch = cleanPath.match(/\/teams\/(\d+)\/squad/);
    const reqTeamId = teamIdMatch ? Number(teamIdMatch[1]) : 1;
    const team =
      DEMO_LEAGUE_STATE.teams.find((t) => t.id === reqTeamId) ||
      DEMO_LEAGUE_STATE.myTeam ||
      DEMO_LEAGUE_STATE.teams[0];
    const teamPlayers = DEMO_ALL_PLAYERS.filter((p) => p.ownedByTeamId === team.id);
    const squadSource = teamPlayers.length > 0 ? teamPlayers : DEMO_SQUAD;
    const squad = squadSource.map((p, idx) => ({
      ...p,
      contract: {
        id: 700 + idx,
        leagueId: 1,
        teamId: team.id,
        playerId: p.id,
        purchasePrice: p.purchasePrice || p.basePrice,
        salary: p.purchasePrice || p.basePrice,
        contractYears: 3,
        acquiredVia: 'auction',
        createdAt: new Date().toISOString(),
      },
    }));
    return {
      team,
      squad,
      lineups: [
        {
          id: 1,
          leagueId: 1,
          teamId: team.id,
          format: 'T20',
          captainPlayerId: squad[0]?.id ?? null,
          viceCaptainPlayerId: squad[1]?.id ?? null,
          wicketkeeperPlayerId: squad.find((p) => p.primaryRole === 'Wicketkeeper')?.id ?? null,
          battingOrderJson: squad.slice(0, 11).map((p) => p.id),
          updatedAt: new Date().toISOString(),
        },
      ],
    } as T;
  }

  if (cleanPath.endsWith('/players')) {
    const q = (params.get('q') || '').toLowerCase().trim();
    const role = params.get('role') || 'ALL';
    const leagueOrigin = params.get('leagueOrigin') || 'ALL';
    const country = params.get('country') || 'ALL';

    const filtered = DEMO_ALL_PLAYERS.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.country.toLowerCase().includes(q)) {
        return false;
      }
      if (role !== 'ALL' && p.primaryRole !== role) return false;
      if (leagueOrigin !== 'ALL' && p.leagueOrigin !== leagueOrigin) return false;
      if (country !== 'ALL' && p.country !== country) return false;
      return true;
    });

    const countries = Array.from(new Set(DEMO_ALL_PLAYERS.map((p) => p.country))).sort();
    return {
      players: filtered,
      total: filtered.length,
      totalPages: 1,
      countries,
    } as T;
  }

  if (cleanPath.endsWith('/scouts/assign')) {
    let targetRole = 'ALL';
    try {
      const parsed = options.body ? JSON.parse(String(options.body)) : {};
      targetRole = parsed.targetRole || 'ALL';
    } catch {
      // ignore
    }
    const matches = DEMO_ALL_PLAYERS.filter(
      (p) => targetRole === 'ALL' || p.primaryRole === targetRole
    );
    return { scoutedPlayers: matches.length ? matches : DEMO_ALL_PLAYERS.slice(0, 4) } as T;
  }

  if (cleanPath.endsWith('/bookmarks/toggle')) {
    return { bookmarked: true, playerName: 'Scout Target' } as T;
  }

  if (cleanPath.endsWith('/development')) {
    return { ok: true } as T;
  }

  if (cleanPath.endsWith('/notifications/read')) {
    return { ok: true } as T;
  }

  if (cleanPath.endsWith('/matches/preview')) {
    const homeTeamId = Number(params.get('homeTeamId') || 1);
    const awayTeamId = Number(params.get('awayTeamId') || 2);
    const reqFormat = (params.get('format') || 'T20') as 'T20' | 'ODI' | 'Test' | 'Hundred';
    const homeTeam =
      DEMO_LEAGUE_STATE.teams.find((t) => t.id === homeTeamId) ||
      DEMO_LEAGUE_STATE.myTeam ||
      DEMO_LEAGUE_STATE.teams[0];
    const awayTeam =
      DEMO_LEAGUE_STATE.teams.find((t) => t.id === awayTeamId) ||
      DEMO_LEAGUE_STATE.teams.find((t) => t.id !== homeTeam.id) ||
      DEMO_LEAGUE_STATE.teams[1];

    const buildTeamSquad = (team: typeof homeTeam, seedOffset: number) => {
      const owned = DEMO_ALL_PLAYERS.filter((p) => p.ownedByTeamId === team.id);
      const templates = [
        { name: 'Harry Brook', role: 'Batsman' as const, bat: 88, bowl: 28, field: 86, batHand: 'Right-hand', bowlStyle: 'Right-arm medium', traits: ['Powerplay Blaster'] },
        { name: 'Adil Rashid', role: 'Bowler' as const, bat: 48, bowl: 87, field: 80, batHand: 'Right-hand', bowlStyle: 'Right-arm leg-break', traits: ['Middle-Overs Wizard'] },
        { name: 'Ben Stokes', role: 'All-Rounder' as const, bat: 86, bowl: 82, field: 89, batHand: 'Left-hand', bowlStyle: 'Right-arm fast-medium', traits: ['Clutch Finisher'] },
        { name: 'Jofra Archer', role: 'Bowler' as const, bat: 42, bowl: 89, field: 82, batHand: 'Right-hand', bowlStyle: 'Right-arm fast', traits: ['Express Pace'] },
        { name: 'Jos Buttler', role: 'Wicketkeeper' as const, bat: 90, bowl: 15, field: 88, batHand: 'Right-hand', bowlStyle: 'None', traits: ['360 Striker'] },
        { name: 'Mark Wood', role: 'Bowler' as const, bat: 34, bowl: 86, field: 79, batHand: 'Right-hand', bowlStyle: 'Right-arm fast', traits: ['High Velocity'] },
        { name: 'Dawid Malan', role: 'Batsman' as const, bat: 84, bowl: 30, field: 81, batHand: 'Left-hand', bowlStyle: 'Right-arm leg-break', traits: ['Anchor'] },
        { name: 'Sam Curran', role: 'All-Rounder' as const, bat: 76, bowl: 81, field: 83, batHand: 'Left-hand', bowlStyle: 'Left-arm medium-fast', traits: ['Swing Specialist'] },
        { name: 'Liam Livingstone', role: 'All-Rounder' as const, bat: 83, bowl: 74, field: 85, batHand: 'Right-hand', bowlStyle: 'Right-arm off-break', traits: ['Clean Striker'] },
        { name: 'Reece Topley', role: 'Bowler' as const, bat: 28, bowl: 82, field: 76, batHand: 'Right-hand', bowlStyle: 'Left-arm fast-medium', traits: ['Left-Arm Angle'] },
        { name: 'Phil Salt', role: 'Wicketkeeper' as const, bat: 85, bowl: 14, field: 84, batHand: 'Right-hand', bowlStyle: 'None', traits: ['Powerplay Blaster'] },
        { name: 'Gus Atkinson', role: 'Bowler' as const, bat: 45, bowl: 83, field: 80, batHand: 'Right-hand', bowlStyle: 'Right-arm fast', traits: ['Seam Movement'] },
        { name: 'Will Jacks', role: 'All-Rounder' as const, bat: 81, bowl: 72, field: 83, batHand: 'Right-hand', bowlStyle: 'Right-arm off-break', traits: ['Strike Rotator'] },
      ];
      const baseSample = DEMO_ALL_PLAYERS[0];
      const list = [...owned];
      let i = 0;
      while (list.length < 13 && i < templates.length) {
        const tpl = templates[(i + seedOffset) % templates.length];
        if (!list.some((p) => p.name === tpl.name)) {
          list.push({
            ...baseSample,
            id: 5000 + seedOffset * 100 + i,
            name: tpl.name,
            country: 'England',
            leagueOrigin: 'The Hundred',
            isOverseas: false,
            age: 24 + ((i + seedOffset) % 8),
            battingHand: tpl.batHand,
            bowlingStyle: tpl.bowlStyle,
            primaryRole: tpl.role,
            battingRating: tpl.bat - (seedOffset % 3),
            bowlingRating: tpl.bowl - (seedOffset % 3),
            fieldingRating: tpl.field,
            fitness: 90,
            consistency: 82,
            temperament: 83,
            potential: 88,
            currentForm: 81 + (i % 7),
            morale: 84,
            basePrice: 80,
            marketValue: 640,
            formDelta: i % 3 === 0 ? 1 : 0,
            traitsJson: tpl.traits,
            ownedByTeamId: team.id,
            ownedByTeamName: team.name,
            ownedByTeamShortCode: team.shortCode,
            ownedByTeamColor: team.primaryColor,
          });
        }
        i++;
      }
      return list;
    };

    const homeSquadAll = buildTeamSquad(homeTeam, 0);
    const awaySquadAll = buildTeamSquad(awayTeam, 4);
    const homeXI = homeSquadAll.slice(0, 11);
    const awayXI = awaySquadAll.slice(0, 11);
    const calcRatings = (xi: typeof homeXI) => {
      const bat = Math.round(xi.slice(0, 7).reduce((s, p) => s + p.battingRating, 0) / Math.max(1, Math.min(7, xi.length)));
      const bowl = Math.round(
        [...xi].sort((a, b) => b.bowlingRating - a.bowlingRating).slice(0, 5).reduce((s, p) => s + p.bowlingRating, 0) /
          Math.max(1, Math.min(5, xi.length))
      );
      const field = Math.round(xi.reduce((s, p) => s + p.fieldingRating, 0) / Math.max(1, xi.length));
      const overall = Math.round(bat * 0.44 + bowl * 0.42 + field * 0.14);
      return { bat, bowl, field, overall };
    };
    const homeRatings = calcRatings(homeXI);
    const awayRatings = calcRatings(awayXI);
    const diff = homeRatings.overall - awayRatings.overall;
    const homePct = Math.max(24, Math.min(74, Math.round(50 + diff * 1.9)));
    const tiePct = reqFormat === 'Test' ? 14 : 4;
    const awayPct = 100 - tiePct - homePct;

    return {
      format: reqFormat,
      competitionLabel: 'English Premier T20',
      venue: homeTeam.homeGround,
      pitchCondition: 'Balanced Pace & Bounce',
      homeTeam,
      awayTeam,
      homeSquadSource: 'contracted',
      awaySquadSource: 'contracted',
      homeXI,
      awayXI,
      homeSquadAll,
      homeRatings,
      awayRatings,
      homeForm: ['W', 'W', 'L', 'W', 'W'],
      awayForm: ['L', 'W', 'W', 'L', 'W'],
      winChance: { homePct, tiePct, awayPct },
      headToHead: {
        played: 2,
        homeWins: 2,
        awayWins: 0,
        ties: 0,
        recent: DEMO_LEAGUE_STATE.matches,
      },
    } as T;
  }

  if (cleanPath.endsWith('/matches/play')) {
    let payload: any = {};
    try {
      payload = options.body ? JSON.parse(String(options.body)) : {};
    } catch {
      payload = {};
    }
    const homeTeam =
      DEMO_LEAGUE_STATE.teams.find((t) => t.id === Number(payload.homeTeamId)) ||
      DEMO_LEAGUE_STATE.myTeam ||
      DEMO_LEAGUE_STATE.teams[0];
    const awayTeam =
      DEMO_LEAGUE_STATE.teams.find((t) => t.id === Number(payload.awayTeamId)) ||
      DEMO_LEAGUE_STATE.teams[1];
    const fmt = payload.format || 'T20';
    return {
      match: {
        id: 950,
        leagueId: 1,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        format: fmt,
        competitionLabel: 'English Premier T20',
        venue: homeTeam.homeGround,
        pitchCondition: 'Balanced Pace & Bounce',
        status: 'completed',
        homeLineupIdsJson: payload.homeLineupIds || [101, 102, 103, 104, 105, 106],
        awayLineupIdsJson: [107],
        tossWinnerTeamId: homeTeam.id,
        tossDecision: 'bat',
        winnerTeamId: homeTeam.id,
        marginText: `${homeTeam.name} won by 18 runs`,
        pressConferenceCompleted: false,
        createdByUid: 'demo-manager-uid',
        createdAt: new Date().toISOString(),
        resultSummaryJson: {
          winnerTeamId: homeTeam.id,
          winnerShortCode: homeTeam.shortCode,
          marginText: `${homeTeam.name} won by 18 runs`,
          manOfTheMatch: 'Virat Kohli (74* off 46b)',
          turningPoint: 'Jasprit Bumrah death-over double strike in the 18th over.',
          highlights: [
            'Virat Kohli anchored the innings with 74* off 46 balls',
            'Jasprit Bumrah closed with 3/22 from 4 overs',
          ],
          innings: [
            {
              battingTeamId: homeTeam.id,
              battingTeamName: homeTeam.name,
              battingTeamShortCode: homeTeam.shortCode,
              bowlingTeamId: awayTeam.id,
              runs: 184,
              wickets: 5,
              oversText: '20.0',
              runRate: 9.2,
              batters: [
                { playerId: 101, name: 'Virat Kohli', role: 'Batsman', runs: 74, balls: 46, fours: 7, sixes: 2, strikeRate: 160.9, dismissal: 'not out' },
                { playerId: 102, name: 'Joe Root', role: 'Batsman', runs: 48, balls: 34, fours: 5, sixes: 0, strikeRate: 141.2, dismissal: 'c Williamson b Wood' },
                { playerId: 104, name: 'Jonny Bairstow', role: 'Wicketkeeper', runs: 31, balls: 18, fours: 3, sixes: 2, strikeRate: 172.2, dismissal: 'b Rashid' },
              ],
              bowlers: [
                { playerId: 5001, name: 'Mark Wood', oversText: '4.0', maidens: 0, runs: 34, wickets: 2, economy: 8.5 },
                { playerId: 5002, name: 'Adil Rashid', oversText: '4.0', maidens: 0, runs: 29, wickets: 2, economy: 7.25 },
              ],
            },
            {
              battingTeamId: awayTeam.id,
              battingTeamName: awayTeam.name,
              battingTeamShortCode: awayTeam.shortCode,
              bowlingTeamId: homeTeam.id,
              runs: 166,
              wickets: 8,
              oversText: '20.0',
              runRate: 8.3,
              batters: [
                { playerId: 107, name: 'Kane Williamson', role: 'Batsman', runs: 62, balls: 44, fours: 6, sixes: 1, strikeRate: 140.9, dismissal: 'c Root b Bumrah' },
              ],
              bowlers: [
                { playerId: 103, name: 'Jasprit Bumrah', oversText: '4.0', maidens: 0, runs: 22, wickets: 3, economy: 5.5 },
                { playerId: 105, name: 'M. Ali', oversText: '4.0', maidens: 0, runs: 31, wickets: 2, economy: 7.75 },
              ],
            },
          ],
        },
      },
    } as T;
  }

  if (cleanPath.endsWith('/settings') && options.method === 'PATCH') {
    const body = options.body ? JSON.parse(String(options.body)) : {};
    const nextSec = Number(body.autoSimIntervalSec ?? body.dayDurationSec) || DEMO_LEAGUE_STATE.league.dayDurationSec || 600;
    const nowMs = Date.now();
    const nextAutoIso = new Date(nowMs + nextSec * 1000).toISOString();
    DEMO_LEAGUE_STATE.league.dayDurationSec = nextSec;
    DEMO_LEAGUE_STATE.league.nextAutoSimAt = nextAutoIso;
    DEMO_LEAGUE_STATE.league.nextDayInSec = nextSec;
    if (body.inactivitySimEnabled !== undefined) {
      DEMO_LEAGUE_STATE.league.inactivitySimEnabled = Boolean(body.inactivitySimEnabled);
      DEMO_LEAGUE_STATE.inactivitySimEnabled = Boolean(body.inactivitySimEnabled);
    }
    if (body.inactivityTimeoutSec !== undefined) {
      DEMO_LEAGUE_STATE.league.inactivityTimeoutSec = Number(body.inactivityTimeoutSec) || 86400;
      DEMO_LEAGUE_STATE.inactivityTimeoutSec = Number(body.inactivityTimeoutSec) || 86400;
    }
    DEMO_LEAGUE_STATE.nextAutoSimAt = nextAutoIso;
    DEMO_LEAGUE_STATE.nextDayInSec = nextSec;
    return { ok: true, league: DEMO_LEAGUE_STATE.league, state: DEMO_LEAGUE_STATE } as T;
  }

  if (cleanPath.endsWith('/advance-day')) {
    return {
      ok: true,
      currentGameDay: DEMO_LEAGUE_STATE.currentGameDay || 1,
      nextAutoSimAt: DEMO_LEAGUE_STATE.nextAutoSimAt,
      state: DEMO_LEAGUE_STATE,
    } as T;
  }

  if (cleanPath.endsWith('/auction/stop-buying')) {
    return { ok: true, stopBuyingAfterMin: true } as T;
  }

  if (cleanPath.endsWith('/state')) {
    return DEMO_LEAGUE_STATE as T;
  }

  return { ok: true } as T;
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (isAutostartDemo() && !auth.currentUser) {
    return handleAutostartDemoRequest<T>(path, options);
  }

  const token = await getFreshIdToken(false);
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    // Attempt one forced refresh in case the short-lived token expired
    const refreshedToken = await getFreshIdToken(true);
    const retry = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshedToken}`,
        ...(options.headers || {}),
      },
    });
    const retryData = await retry.json().catch(() => ({}));
    if (!retry.ok) {
      throw new Error(retryData.error || `Request failed (${retry.status})`);
    }
    return retryData as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}
