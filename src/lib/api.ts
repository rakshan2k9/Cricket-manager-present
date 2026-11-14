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
