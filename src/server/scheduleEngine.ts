import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  fixtures,
  leagues,
  leagueMessages,
  lineups,
  matches,
  notifications,
  playerContracts,
  players,
  teams,
  type MatchInningsSummary,
  type MatchResultSummary,
  type PvpLiveMatchState,
} from '../db/schema.ts';
import {
  buildBalancedXI,
  getFormatParams,
  pickPitchCondition,
  selectExhibitionClubPool,
  simulateCricketMatch,
  stepLiveBallEngine,
  toLiveInningsSummary,
  createLiveInningsState,
  type LiveStrategy,
} from './matchEngine.ts';
import { applyPostMatchProgression } from './postMatchService.ts';
import { scheduleBackgroundPressConference } from './geminiService.ts';
import { wsHub } from './wsHub.ts';

function deterministicRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function computeLeagueCalendar(league: {
  seasonStartedAt: Date | string;
  dayDurationSec: number;
  currentGameDay?: number;
  dayStartedAt?: Date | string;
  nextAutoSimAt?: Date | string | null;
}) {
  const dayDurationSec = Math.max(60, league.dayDurationSec || 600);
  const currentGameDay = Math.max(1, league.currentGameDay || 1);
  const startDate = new Date(league.dayStartedAt || league.seasonStartedAt || Date.now());
  const startMs = Number.isFinite(startDate.getTime()) ? startDate.getTime() : Date.now();
  const nextAutoRaw = league.nextAutoSimAt ? new Date(league.nextAutoSimAt).getTime() : NaN;
  const nextAutoSimAtMs = Number.isFinite(nextAutoRaw)
    ? nextAutoRaw
    : startMs + dayDurationSec * 1000;
  const nextDayInSec = Math.max(0, Math.ceil((nextAutoSimAtMs - Date.now()) / 1000));
  return {
    dayDurationSec,
    currentGameDay,
    nextDayInSec,
    dayStartedAt: new Date(startMs).toISOString(),
    nextAutoSimAt: new Date(nextAutoSimAtMs).toISOString(),
  };
}

export function recalculateNextAutoSimAt(params: {
  nowMs: number;
  dayStartedAtMs: number;
  newIntervalSec: number;
}): number {
  const intervalMs = Math.max(60, params.newIntervalSec || 600) * 1000;
  const startMs = Number.isFinite(params.dayStartedAtMs) ? params.dayStartedAtMs : params.nowMs;
  const candidate = startMs + intervalMs;
  return candidate > params.nowMs ? candidate : params.nowMs + intervalMs;
}

export interface CalendarFixtureInput {
  id: number;
  scheduledDay: number;
  status: string;
  isHumanInvolved: boolean;
}

export interface CalendarAdvancePlan {
  nextGameDay: number;
  nextDayStartedAtMs: number;
  nextAutoSimAtMs: number;
  nextDayInSec: number;
  dayAdvanced: boolean;
  pausedForHumanMatch: boolean;
  aiToSimulateIds: number[];
  overdueHumanToSimulateIds: number[];
}

/**
 * Global League Calendar state machine:
 * - Global League Day (`currentGameDay`) advances strictly +1 day per elapsed real-world interval (`dayDurationSec`),
 *   persisted via `nextAutoSimAt`. It never fast-forwards idle AI days and never stalls for offline managers.
 * - AI vs AI fixtures simulate ONLY up to `nextGameDay` (`scheduledDay <= nextGameDay`), never ahead of the clock.
 * - Human fixtures remain pending/accessible across days and are NEVER auto-simulated unless the league's
 *   explicit inactivity rule (`inactivitySimEnabled`) is enabled and `inactivityTimeoutSec` has elapsed.
 */
export function evaluateGlobalCalendarTick(params: {
  status: string;
  currentGameDay: number;
  dayStartedAtMs: number;
  nextAutoSimAtMs?: number | null;
  dayDurationSec: number;
  inactivitySimEnabled?: boolean;
  inactivityTimeoutSec?: number;
  nowMs: number;
  fixtures: CalendarFixtureInput[];
}): CalendarAdvancePlan {
  const dayDurationSec = Math.max(60, params.dayDurationSec || 600);
  const intervalMs = dayDurationSec * 1000;
  const initialDay = Math.max(1, params.currentGameDay || 1);
  const initialStartMs = Number.isFinite(params.dayStartedAtMs)
    ? params.dayStartedAtMs
    : params.nowMs;
  const rawNextMs =
    params.nextAutoSimAtMs != null && Number.isFinite(params.nextAutoSimAtMs)
      ? params.nextAutoSimAtMs
      : initialStartMs + intervalMs;

  if (params.status !== 'active') {
    const nextDayInSec = Math.max(0, Math.ceil((rawNextMs - params.nowMs) / 1000));
    return {
      nextGameDay: initialDay,
      nextDayStartedAtMs: initialStartMs,
      nextAutoSimAtMs: rawNextMs,
      nextDayInSec,
      dayAdvanced: false,
      pausedForHumanMatch: false,
      aiToSimulateIds: [],
      overdueHumanToSimulateIds: [],
    };
  }

  let nextGameDay = initialDay;
  let nextDayStartedAtMs = initialStartMs;
  let nextAutoSimAtMs = rawNextMs;
  let dayAdvanced = false;

  if (params.nowMs >= rawNextMs) {
    const stepsElapsed = Math.floor((params.nowMs - rawNextMs) / intervalMs) + 1;
    nextGameDay = initialDay + stepsElapsed;
    nextDayStartedAtMs = rawNextMs + (stepsElapsed - 1) * intervalMs;
    nextAutoSimAtMs = rawNextMs + stepsElapsed * intervalMs;
    dayAdvanced = true;
  }

  // Simulate ONLY AI-vs-AI fixtures whose scheduledDay <= Global League Day
  const aiToSimulateIds = params.fixtures
    .filter(
      (f) =>
        f.status === 'scheduled' &&
        !f.isHumanInvolved &&
        f.scheduledDay <= nextGameDay
    )
    .map((f) => f.id);

  // Optional abandoned-fixture auto-sim only when league explicitly enables it
  const overdueHumanToSimulateIds: number[] = [];
  if (params.inactivitySimEnabled) {
    const inactivityTimeoutMs = Math.max(3600, params.inactivityTimeoutSec || 86400) * 1000;
    for (const f of params.fixtures) {
      if (f.status === 'completed' || !f.isHumanInvolved) continue;
      if (f.scheduledDay >= nextGameDay) continue;
      const daysPast = nextGameDay - f.scheduledDay;
      // When Day `scheduledDay` ended and `scheduledDay + 1` began:
      const dueAtDayEndMs = nextDayStartedAtMs - (daysPast - 1) * intervalMs;
      if (params.nowMs - dueAtDayEndMs >= inactivityTimeoutMs) {
        overdueHumanToSimulateIds.push(f.id);
      }
    }
  }

  const nextDayInSec = Math.max(1, Math.ceil((nextAutoSimAtMs - params.nowMs) / 1000));
  return {
    nextGameDay,
    nextDayStartedAtMs,
    nextAutoSimAtMs,
    nextDayInSec,
    dayAdvanced,
    pausedForHumanMatch: false,
    aiToSimulateIds,
    overdueHumanToSimulateIds,
  };
}

export function computeTeamProgressions(
  leagueTeams: Array<{ id: number }>,
  leagueFixtures: Array<{
    homeTeamId: number;
    awayTeamId: number;
    scheduledDay: number;
    status: string;
  }>,
  currentGameDay: number
) {
  const safeGlobalDay = Math.max(1, currentGameDay || 1);
  return leagueTeams.map((team) => {
    const teamFixtures = leagueFixtures.filter(
      (fx) => fx.homeTeamId === team.id || fx.awayTeamId === team.id
    );
    let playedCount = 0;
    let pendingCount = 0;
    let playedThroughDay = 0;
    let nextPendingFixtureDay: number | null = null;

    for (const fx of teamFixtures) {
      if (fx.status === 'completed') {
        playedCount += 1;
        if (fx.scheduledDay > playedThroughDay) playedThroughDay = fx.scheduledDay;
      } else {
        pendingCount += 1;
        if (nextPendingFixtureDay === null || fx.scheduledDay < nextPendingFixtureDay) {
          nextPendingFixtureDay = fx.scheduledDay;
        }
      }
    }

    return {
      teamId: team.id,
      playedCount,
      pendingCount,
      playedThroughDay,
      nextPendingFixtureDay,
      daysAheadOfGlobal: Math.max(0, playedThroughDay - safeGlobalDay),
    };
  });
}

export function getCompetitionDefaultFormat(
  primaryCompetition?: string | null
): 'T20' | 'ODI' | 'Test' | 'Hundred' {
  if (primaryCompetition === 'The Hundred') return 'Hundred';
  return 'T20';
}

export function getCompetitionDisplayLabelServer(comp?: string | null): string {
  switch (comp) {
    case 'IPL':
      return 'Indian Premier League';
    case 'PSL':
      return 'Pakistan Super League';
    case 'SA20':
      return 'SA20';
    case 'BBL':
      return 'Big Bash League';
    case 'The Hundred':
      return 'The Hundred';
    case 'International':
      return 'International Cricket';
    default:
      return comp || 'Indian Premier League';
  }
}

/**
 * Generates an IPL-style asymmetric tournament schedule:
 * - Each franchise faces ~4 designated rivals TWICE (home + away) and the remaining rivals ONCE.
 * - Schedules 1-2 matches per Game Day so every team gets proper spacing.
 */
export function buildIplScheduleDraft(
  leagueId: number,
  leagueTeams: Array<{ id: number; homeGround: string }>,
  defaultFormat: 'T20' | 'ODI' | 'Test' | 'Hundred'
) {
  const n = leagueTeams.length;
  if (n < 2) return [];

  const rng = deterministicRand(leagueId * 7919 + n * 101);
  const ordered = [...leagueTeams];
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }

  // Circulant pairing: for N >= 6, distances d=1,2 (4 distinct opponents per team) are played TWICE (Home & Away).
  // Remaining distances are played ONCE with balanced home/away parity.
  const doubleRadius = n >= 6 ? 2 : n >= 4 ? 1 : 1;

  interface MatchPairing {
    homeTeamId: number;
    awayTeamId: number;
    venue: string;
    roundBucket: number;
  }

  const allPairings: MatchPairing[] = [];
  let bucket = 1;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = Math.min(j - i, n - (j - i));
      const a = ordered[i];
      const b = ordered[j];

      if (dist <= doubleRadius) {
        allPairings.push({
          homeTeamId: a.id,
          awayTeamId: b.id,
          venue: a.homeGround,
          roundBucket: bucket++,
        });
        allPairings.push({
          homeTeamId: b.id,
          awayTeamId: a.id,
          venue: b.homeGround,
          roundBucket: bucket++,
        });
      } else {
        const aHosts = (i + j) % 2 === 0;
        const home = aHosts ? a : b;
        const away = aHosts ? b : a;
        allPairings.push({
          homeTeamId: home.id,
          awayTeamId: away.id,
          venue: home.homeGround,
          roundBucket: bucket++,
        });
      }
    }
  }

  // Shuffle pairings deterministically then pack into days so no team plays twice on the same day
  for (let i = allPairings.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [allPairings[i], allPairings[j]] = [allPairings[j], allPairings[i]];
  }

  const maxMatchesPerDay = n >= 8 ? 2 : 1;
  const remaining = [...allPairings];
  const scheduled: Array<{
    roundNumber: number;
    matchNumber: number;
    scheduledDay: number;
    stage: 'league';
    homeTeamId: number;
    awayTeamId: number;
    format: string;
    venue: string;
    pitchCondition: string;
  }> = [];

  let day = 1;
  let matchNo = 1;
  const recentTeams = new Set<number>();

  while (remaining.length > 0) {
    const todayTeams = new Set<number>();
    let placedToday = 0;

    // First pass: prefer teams that didn't play yesterday
    for (let pass = 0; pass < 2 && placedToday < maxMatchesPerDay; pass++) {
      for (let i = 0; i < remaining.length && placedToday < maxMatchesPerDay; i++) {
        const candidate = remaining[i];
        if (todayTeams.has(candidate.homeTeamId) || todayTeams.has(candidate.awayTeamId)) {
          continue;
        }
        if (pass === 0 && (recentTeams.has(candidate.homeTeamId) || recentTeams.has(candidate.awayTeamId))) {
          continue;
        }

        remaining.splice(i, 1);
        i--;
        todayTeams.add(candidate.homeTeamId);
        todayTeams.add(candidate.awayTeamId);
        placedToday++;

        scheduled.push({
          roundNumber: Math.ceil(day / 3),
          matchNumber: matchNo,
          scheduledDay: day,
          stage: 'league',
          homeTeamId: candidate.homeTeamId,
          awayTeamId: candidate.awayTeamId,
          format: defaultFormat,
          venue: candidate.venue,
          pitchCondition: pickPitchCondition(leagueId * 17 + matchNo * 13),
        });
        matchNo++;
      }
    }

    recentTeams.clear();
    for (const id of todayTeams) recentTeams.add(id);
    day++;
  }

  return scheduled;
}

export async function ensureLeagueScheduleExists(leagueId: number, txOrDb: any = db) {
  const existing = await txOrDb
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(eq(fixtures.leagueId, leagueId))
    .limit(1);

  if (existing.length > 0) return false;

  const [league] = await txOrDb.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return false;

  const leagueTeams = await txOrDb
    .select()
    .from(teams)
    .where(eq(teams.leagueId, leagueId))
    .orderBy(asc(teams.id));

  if (leagueTeams.length < 2) return false;

  const defaultFormat = getCompetitionDefaultFormat(league.primaryCompetition);
  const draft = buildIplScheduleDraft(leagueId, leagueTeams, defaultFormat);
  if (draft.length === 0) return false;

  await txOrDb.insert(fixtures).values(
    draft.map((d) => ({
      leagueId,
      roundNumber: d.roundNumber,
      matchNumber: d.matchNumber,
      scheduledDay: d.scheduledDay,
      stage: d.stage,
      homeTeamId: d.homeTeamId,
      awayTeamId: d.awayTeamId,
      format: d.format,
      venue: d.venue,
      pitchCondition: d.pitchCondition,
      status: 'scheduled',
    }))
  );

  return true;
}

function parseOversToDecimal(oversStr: string, ballsPerOver: number): number {
  const parts = String(oversStr || '0').split('.');
  const whole = Number(parts[0]) || 0;
  const rem = Number(parts[1]) || 0;
  return whole + rem / ballsPerOver;
}

export function computeLeagueStandings(
  leagueTeams: Array<typeof teams.$inferSelect>,
  leagueFixtures: Array<typeof fixtures.$inferSelect>,
  leagueMatches: Array<typeof matches.$inferSelect>,
  memberNamesByUid: Map<string, string | null>
) {
  const matchById = new Map(leagueMatches.map((m) => [m.id, m]));
  const rowsMap = new Map<
    number,
    {
      teamId: number;
      teamName: string;
      shortCode: string;
      primaryColor: string;
      secondaryColor: string;
      templateKey: string | null;
      ownerUid: string | null;
      ownerName: string | null;
      played: number;
      won: number;
      lost: number;
      tied: number;
      points: number;
      nrr: number;
      runsFor: number;
      oversFor: number;
      runsAgainst: number;
      oversAgainst: number;
    }
  >();

  for (const t of leagueTeams) {
    rowsMap.set(t.id, {
      teamId: t.id,
      teamName: t.name,
      shortCode: t.shortCode,
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      templateKey: t.templateKey,
      ownerUid: t.ownerUid,
      ownerName: t.ownerUid ? memberNamesByUid.get(t.ownerUid) ?? null : null,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      points: 0,
      nrr: 0,
      runsFor: 0,
      oversFor: 0,
      runsAgainst: 0,
      oversAgainst: 0,
    });
  }

  for (const fx of leagueFixtures) {
    if (fx.stage !== 'league' || fx.status !== 'completed' || !fx.matchId) continue;
    const m = matchById.get(fx.matchId);
    const sum = m?.resultSummaryJson;
    if (!m || !sum) continue;

    const bpo = m.format === 'Hundred' ? 5 : 6;
    const maxOv = m.format === 'ODI' ? 50 : m.format === 'Test' ? 90 : 20;

    for (const [batInn, bowlInn] of [
      [sum.innings1, sum.innings2],
      [sum.innings2, sum.innings1],
    ]) {
      const row = rowsMap.get(batInn.teamId);
      if (!row) continue;

      row.played += 1;
      if (m.winnerTeamId === batInn.teamId) {
        row.won += 1;
        row.points += 2;
      } else if (m.winnerTeamId === null) {
        row.tied += 1;
        row.points += 1;
      } else {
        row.lost += 1;
      }

      const ovBat =
        batInn.wickets >= 10 ? maxOv : Math.max(0.2, parseOversToDecimal(batInn.overs, bpo));
      const ovBowl =
        bowlInn.wickets >= 10 ? maxOv : Math.max(0.2, parseOversToDecimal(bowlInn.overs, bpo));

      row.runsFor += batInn.runs;
      row.oversFor += ovBat;
      row.runsAgainst += bowlInn.runs;
      row.oversAgainst += ovBowl;
    }
  }

  const standings = Array.from(rowsMap.values()).map((r) => {
    const forRate = r.oversFor > 0 ? r.runsFor / r.oversFor : 0;
    const againstRate = r.oversAgainst > 0 ? r.runsAgainst / r.oversAgainst : 0;
    return {
      ...r,
      oversFor: Number(r.oversFor.toFixed(2)),
      oversAgainst: Number(r.oversAgainst.toFixed(2)),
      nrr: Number((forRate - againstRate).toFixed(3)),
    };
  });

  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.nrr !== a.nrr) return b.nrr - a.nrr;
    if (b.won !== a.won) return b.won - a.won;
    return a.teamName.localeCompare(b.teamName);
  });

  return standings;
}

export async function resolveFixtureTeamXI(
  leagueId: number,
  team: typeof teams.$inferSelect,
  allLeaguePlayers: Array<typeof players.$inferSelect>,
  overrideIds?: number[],
  format: string = 'T20'
) {
  let effectiveOverride = overrideIds && overrideIds.length > 0 ? overrideIds : [];
  if (effectiveOverride.length === 0) {
    const teamLineups = await db
      .select()
      .from(lineups)
      .where(and(eq(lineups.leagueId, leagueId), eq(lineups.teamId, team.id)));
    const matched =
      teamLineups.find((l) => l.format === format) || teamLineups[0] || null;
    if (matched?.battingOrderJson?.length) {
      effectiveOverride = matched.battingOrderJson;
    }
  }

  const contractedRows = await db
    .select({ player: players })
    .from(playerContracts)
    .innerJoin(players, eq(playerContracts.playerId, players.id))
    .where(and(eq(playerContracts.teamId, team.id), eq(playerContracts.leagueId, leagueId)));

  const contracted = contractedRows.map((r) => r.player);
  if (contracted.length >= 11) {
    return buildBalancedXI(contracted, effectiveOverride);
  }

  const exhibitionPool = selectExhibitionClubPool(allLeaguePlayers, team);
  const combined = [...contracted];
  for (const p of exhibitionPool) {
    if (!combined.some((c) => c.id === p.id)) combined.push(p);
  }
  return buildBalancedXI(combined, effectiveOverride);
}

export async function commitCompletedFixtureMatch(
  fx: typeof fixtures.$inferSelect,
  summary: MatchResultSummary,
  homeXIIds: number[],
  awayXIIds: number[],
  initiatedByUid: string,
  resolutionType: 'manual' | 'ai_vs_ai' | 'auto_inactivity' = 'manual'
) {
  if (fx.status === 'completed' && fx.matchId) return null;

  const [league] = await db.select().from(leagues).where(eq(leagues.id, fx.leagueId)).limit(1);
  if (!league) return null;

  const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, fx.leagueId));
  const homeTeam = leagueTeams.find((t) => t.id === fx.homeTeamId);
  const awayTeam = leagueTeams.find((t) => t.id === fx.awayTeamId);
  if (!homeTeam || !awayTeam) return null;

  const competitionLabel = getCompetitionDisplayLabelServer(league.primaryCompetition);

  const [savedMatch] = await db
    .insert(matches)
    .values({
      leagueId: fx.leagueId,
      homeTeamId: fx.homeTeamId,
      awayTeamId: fx.awayTeamId,
      format: fx.format,
      competitionLabel,
      venue: fx.venue,
      pitchCondition: fx.pitchCondition,
      status: 'completed',
      homeLineupIdsJson: homeXIIds,
      awayLineupIdsJson: awayXIIds,
      tossWinnerTeamId: summary.tossWinnerTeamId,
      tossDecision: summary.tossDecision,
      winnerTeamId: summary.winnerTeamId,
      marginText: summary.marginText,
      resultSummaryJson: summary,
      resolutionType,
      createdByUid: initiatedByUid,
    })
    .returning();

  await db
    .update(fixtures)
    .set({
      status: 'completed',
      matchId: savedMatch.id,
      resolutionType,
      tossWinnerTeamId: summary.tossWinnerTeamId,
      tossDecision: summary.tossDecision,
      coinResult: summary.coinResult,
      updatedAt: new Date(),
    })
    .where(eq(fixtures.id, fx.id));

  await db.insert(leagueMessages).values({
    leagueId: fx.leagueId,
    userUid: initiatedByUid,
    teamShortCode: 'MCH',
    body: `Match #${fx.matchNumber} (${fx.stage.toUpperCase()}): ${homeTeam.shortCode} vs ${awayTeam.shortCode} — ${summary.marginText}! (${summary.innings1.teamShortCode} ${summary.innings1.runs}/${summary.innings1.wickets} vs ${summary.innings2.teamShortCode} ${summary.innings2.runs}/${summary.innings2.wickets})`,
    messageType: 'system',
  });

  const inn1 = summary.innings1;
  const inn2 = summary.innings2;
  const pitchShort = fx.pitchCondition.split('·')[0].trim();
  const turningPointLine =
    summary.turningPoints && summary.turningPoints.length > 0
      ? summary.turningPoints[0]
      : `${summary.manOfTheMatch} delivered the decisive match-winning contribution`;
  const isAllAi = !homeTeam.ownerUid && !awayTeam.ownerUid;

  const editorialBody = [
    `${homeTeam.name} (${homeTeam.shortCode}) vs ${awayTeam.name} (${awayTeam.shortCode}) — Match #${fx.matchNumber} (${fx.stage.toUpperCase()}) at ${fx.venue} concluded with a decisive verdict: ${summary.marginText}. On a ${pitchShort.toLowerCase()} surface, ${inn1.teamShortCode} posted ${inn1.runs}/${inn1.wickets} (${inn1.overs} ov) before ${inn2.teamShortCode} replied with ${inn2.runs}/${inn2.wickets} (${inn2.overs} ov).`,
    `Key Scorecard Highlights: ${inn1.teamShortCode} leaned on ${inn1.topScorer} while ${inn1.topBowler} led the opposition reply; in the second half, ${inn2.topScorer} anchored the batting response against ${inn2.topBowler}.`,
    `Turning Point & Verdict: ${turningPointLine}. ${summary.manOfTheMatch} was named Player of the Match for shaping the critical overs under pressure.`,
  ].join('\n\n');

  const [notif] = await db
    .insert(notifications)
    .values({
      leagueId: fx.leagueId,
      category: isAllAi ? 'League Result' : 'Match Result',
      title: `M#${fx.matchNumber}: ${homeTeam.shortCode} vs ${awayTeam.shortCode} · ${summary.marginText}`,
      body: editorialBody,
    })
    .returning();

  wsHub.broadcastToLeague(fx.leagueId, 'match:completed', {
    match: savedMatch,
    fixtureId: fx.id,
    headline: `${homeTeam.shortCode} vs ${awayTeam.shortCode} · ${summary.marginText}`,
  });
  if (notif) wsHub.broadcastToLeague(fx.leagueId, 'notification:new', notif);

  await applyPostMatchProgression({
    leagueId: fx.leagueId,
    matchId: savedMatch.id,
    homeTeamId: fx.homeTeamId,
    awayTeamId: fx.awayTeamId,
    homeXIIds,
    awayXIIds,
    summary,
  });

  if (homeTeam.ownerUid || awayTeam.ownerUid) {
    scheduleBackgroundPressConference(fx.leagueId, savedMatch.id);
  }

  await maybeAdvancePlayoffs(fx.leagueId);
  return savedMatch;
}

export async function maybeAdvancePlayoffs(leagueId: number) {
  const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
  if (leagueTeams.length < 4) return;

  const allFixtures = await db
    .select()
    .from(fixtures)
    .where(eq(fixtures.leagueId, leagueId))
    .orderBy(asc(fixtures.matchNumber));

  const leagueStage = allFixtures.filter((f) => f.stage === 'league');
  if (leagueStage.length === 0 || leagueStage.some((f) => f.status !== 'completed')) {
    return;
  }

  const allMatches = await db.select().from(matches).where(eq(matches.leagueId, leagueId));
  const standings = computeLeagueStandings(leagueTeams, allFixtures, allMatches, new Map());
  if (standings.length < 4) return;

  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  const format = getCompetitionDefaultFormat(league?.primaryCompetition);
  const maxDay = leagueStage.reduce((m, f) => Math.max(m, f.scheduledDay), 1);
  let nextMatchNum = allFixtures.reduce((m, f) => Math.max(m, f.matchNumber), 0) + 1;

  const hasQ1 = allFixtures.some((f) => f.stage === 'qualifier1');
  const hasElim = allFixtures.some((f) => f.stage === 'eliminator');
  const hasQ2 = allFixtures.some((f) => f.stage === 'qualifier2');
  const hasFinal = allFixtures.some((f) => f.stage === 'final');

  if (!hasQ1 && !hasElim) {
    const t1 = leagueTeams.find((t) => t.id === standings[0].teamId)!;
    const t2 = leagueTeams.find((t) => t.id === standings[1].teamId)!;
    const t3 = leagueTeams.find((t) => t.id === standings[2].teamId)!;
    const t4 = leagueTeams.find((t) => t.id === standings[3].teamId)!;

    await db.insert(fixtures).values([
      {
        leagueId,
        roundNumber: 99,
        matchNumber: nextMatchNum++,
        scheduledDay: maxDay + 2,
        stage: 'qualifier1',
        homeTeamId: t1.id,
        awayTeamId: t2.id,
        format,
        venue: t1.homeGround,
        pitchCondition: pickPitchCondition(leagueId * 31 + 1),
        status: 'scheduled',
      },
      {
        leagueId,
        roundNumber: 99,
        matchNumber: nextMatchNum++,
        scheduledDay: maxDay + 3,
        stage: 'eliminator',
        homeTeamId: t3.id,
        awayTeamId: t4.id,
        format,
        venue: t3.homeGround,
        pitchCondition: pickPitchCondition(leagueId * 31 + 2),
        status: 'scheduled',
      },
    ]);
    return;
  }

  const q1 = allFixtures.find((f) => f.stage === 'qualifier1');
  const elim = allFixtures.find((f) => f.stage === 'eliminator');
  if (q1?.status === 'completed' && elim?.status === 'completed' && !hasQ2 && q1.matchId && elim.matchId) {
    const mQ1 = allMatches.find((m) => m.id === q1.matchId);
    const mElim = allMatches.find((m) => m.id === elim.matchId);
    if (mQ1 && mElim) {
      const q1LoserId = mQ1.winnerTeamId === q1.homeTeamId ? q1.awayTeamId : q1.homeTeamId;
      const elimWinnerId = mElim.winnerTeamId || elim.homeTeamId;
      const home = leagueTeams.find((t) => t.id === q1LoserId)!;
      await db.insert(fixtures).values({
        leagueId,
        roundNumber: 100,
        matchNumber: nextMatchNum++,
        scheduledDay: maxDay + 4,
        stage: 'qualifier2',
        homeTeamId: q1LoserId,
        awayTeamId: elimWinnerId,
        format,
        venue: home?.homeGround || q1.venue,
        pitchCondition: pickPitchCondition(leagueId * 31 + 3),
        status: 'scheduled',
      });
    }
    return;
  }

  const q2 = allFixtures.find((f) => f.stage === 'qualifier2');
  if (q1?.status === 'completed' && q2?.status === 'completed' && !hasFinal && q1.matchId && q2.matchId) {
    const mQ1 = allMatches.find((m) => m.id === q1.matchId);
    const mQ2 = allMatches.find((m) => m.id === q2.matchId);
    if (mQ1 && mQ2) {
      const q1WinnerId = mQ1.winnerTeamId || q1.homeTeamId;
      const q2WinnerId = mQ2.winnerTeamId || q2.homeTeamId;
      const home = leagueTeams.find((t) => t.id === q1WinnerId)!;
      await db.insert(fixtures).values({
        leagueId,
        roundNumber: 101,
        matchNumber: nextMatchNum++,
        scheduledDay: maxDay + 6,
        stage: 'final',
        homeTeamId: q1WinnerId,
        awayTeamId: q2WinnerId,
        format,
        venue: home?.homeGround || q1.venue,
        pitchCondition: pickPitchCondition(leagueId * 31 + 4),
        status: 'scheduled',
      });
    }
  }
}

/**
 * Auto-simulates AI-vs-AI fixtures scheduled up to `currentGameDay` once the auction has completed
 * (or league status is active), while NEVER auto-simulating human-involved fixtures AND keeping
 * AI teams synchronized within 2 matches of unplayed human fixtures on the calendar.
 */
export async function getTeamRecentFormMap(
  leagueId: number
): Promise<Map<number, Array<'W' | 'L' | 'T'>>> {
  const allMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.leagueId, leagueId))
    .orderBy(asc(matches.createdAt));

  const map = new Map<number, Array<'W' | 'L' | 'T'>>();
  for (const m of allMatches) {
    if (m.status !== 'completed') continue;
    const hArr = map.get(m.homeTeamId) || [];
    const aArr = map.get(m.awayTeamId) || [];
    if (m.winnerTeamId === m.homeTeamId) {
      hArr.unshift('W');
      aArr.unshift('L');
    } else if (m.winnerTeamId === m.awayTeamId) {
      hArr.unshift('L');
      aArr.unshift('W');
    } else {
      hArr.unshift('T');
      aArr.unshift('T');
    }
    map.set(m.homeTeamId, hArr.slice(0, 5));
    map.set(m.awayTeamId, aArr.slice(0, 5));
  }
  return map;
}

const inProgressCalendarLeagues = new Set<number>();
let lastGlobalCalendarSweepMs = 0;

/**
 * Synchronizes a league's Global League Day using its persisted real-world auto-simulation interval:
 * - Advances Global League Day (+1 per elapsed interval) strictly by server clock (`nextAutoSimAt`).
 * - Simulates ONLY AI-vs-AI fixtures up to `currentGameDay` (never ahead of the global clock).
 * - Never overwrites completed matches or blocks other managers from playing ahead independently.
 */
export async function syncLeagueDayProgression(leagueId: number) {
  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) {
    const now = Date.now();
    return {
      dayDurationSec: 600,
      currentGameDay: 1,
      nextDayInSec: 600,
      dayStartedAt: new Date(now).toISOString(),
      nextAutoSimAt: new Date(now + 600_000).toISOString(),
      inactivitySimEnabled: false,
      inactivityTimeoutSec: 86400,
      dayPausedForHumanMatch: false,
    };
  }

  const dayDurationSec = Math.max(60, league.dayDurationSec || 600);
  const currentDay = Math.max(1, (league as any).currentGameDay || 1);
  const dayStartedDate = new Date((league as any).dayStartedAt || league.seasonStartedAt || Date.now());
  const dayStartMs = Number.isFinite(dayStartedDate.getTime()) ? dayStartedDate.getTime() : Date.now();
  const nextAutoRaw = (league as any).nextAutoSimAt
    ? new Date((league as any).nextAutoSimAt).getTime()
    : NaN;
  const nextAutoAtMs = Number.isFinite(nextAutoRaw)
    ? nextAutoRaw
    : dayStartMs + dayDurationSec * 1000;
  const inactivitySimEnabled = Boolean((league as any).inactivitySimEnabled);
  const inactivityTimeoutSec = Math.max(3600, Number((league as any).inactivityTimeoutSec) || 86400);

  if (league.status !== 'active') {
    return {
      dayDurationSec,
      currentGameDay: currentDay,
      nextDayInSec: Math.max(0, Math.ceil((nextAutoAtMs - Date.now()) / 1000)),
      dayStartedAt: new Date(dayStartMs).toISOString(),
      nextAutoSimAt: new Date(nextAutoAtMs).toISOString(),
      inactivitySimEnabled,
      inactivityTimeoutSec,
      dayPausedForHumanMatch: false,
    };
  }

  // Prevent concurrent execution for the same league
  if (inProgressCalendarLeagues.has(leagueId)) {
    return {
      dayDurationSec,
      currentGameDay: currentDay,
      nextDayInSec: Math.max(0, Math.ceil((nextAutoAtMs - Date.now()) / 1000)),
      dayStartedAt: new Date(dayStartMs).toISOString(),
      nextAutoSimAt: new Date(nextAutoAtMs).toISOString(),
      inactivitySimEnabled,
      inactivityTimeoutSec,
      dayPausedForHumanMatch: false,
    };
  }

  inProgressCalendarLeagues.add(leagueId);
  try {
    const [freshLeague] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!freshLeague || freshLeague.status !== 'active') {
      return {
        dayDurationSec,
        currentGameDay: currentDay,
        nextDayInSec: Math.max(0, Math.ceil((nextAutoAtMs - Date.now()) / 1000)),
        dayStartedAt: new Date(dayStartMs).toISOString(),
        nextAutoSimAt: new Date(nextAutoAtMs).toISOString(),
        inactivitySimEnabled,
        inactivityTimeoutSec,
        dayPausedForHumanMatch: false,
      };
    }

    const freshDurationSec = Math.max(60, freshLeague.dayDurationSec || 600);
    const freshCurrentDay = Math.max(1, (freshLeague as any).currentGameDay || 1);
    const freshStartDate = new Date(
      (freshLeague as any).dayStartedAt || freshLeague.seasonStartedAt || Date.now()
    );
    const freshStartMs = Number.isFinite(freshStartDate.getTime())
      ? freshStartDate.getTime()
      : Date.now();
    const freshNextRaw = (freshLeague as any).nextAutoSimAt
      ? new Date((freshLeague as any).nextAutoSimAt).getTime()
      : NaN;
    const hadPersistedNextAuto = Number.isFinite(freshNextRaw);
    const freshNextAtMs = hadPersistedNextAuto
      ? freshNextRaw
      : freshStartMs + freshDurationSec * 1000;
    const freshInactivityEnabled = Boolean((freshLeague as any).inactivitySimEnabled);
    const freshInactivitySec = Math.max(
      3600,
      Number((freshLeague as any).inactivityTimeoutSec) || 86400
    );

    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
    const teamMap = new Map(leagueTeams.map((t) => [t.id, t]));
    const allLeagueFixtures = await db
      .select()
      .from(fixtures)
      .where(eq(fixtures.leagueId, leagueId))
      .orderBy(asc(fixtures.scheduledDay), asc(fixtures.matchNumber));

    const nowMs = Date.now();
    const plan = evaluateGlobalCalendarTick({
      status: freshLeague.status,
      currentGameDay: freshCurrentDay,
      dayStartedAtMs: freshStartMs,
      nextAutoSimAtMs: freshNextAtMs,
      dayDurationSec: freshDurationSec,
      inactivitySimEnabled: freshInactivityEnabled,
      inactivityTimeoutSec: freshInactivitySec,
      nowMs,
      fixtures: allLeagueFixtures.map((fx) => {
        const h = teamMap.get(fx.homeTeamId);
        const a = teamMap.get(fx.awayTeamId);
        return {
          id: fx.id,
          scheduledDay: fx.scheduledDay,
          status: fx.status,
          isHumanInvolved: Boolean(h?.ownerUid || a?.ownerUid),
        };
      }),
    });

    if (
      plan.nextGameDay !== freshCurrentDay ||
      !hadPersistedNextAuto ||
      Math.abs(plan.nextAutoSimAtMs - freshNextAtMs) > 1000 ||
      Math.abs(plan.nextDayStartedAtMs - freshStartMs) > 1000
    ) {
      await db
        .update(leagues)
        .set({
          currentGameDay: plan.nextGameDay,
          dayStartedAt: new Date(plan.nextDayStartedAtMs),
          nextAutoSimAt: new Date(plan.nextAutoSimAtMs),
        })
        .where(eq(leagues.id, leagueId));
    }

    let simulatedAny = false;
    if (plan.aiToSimulateIds.length > 0 || plan.overdueHumanToSimulateIds.length > 0) {
      const fixtureById = new Map(allLeagueFixtures.map((f) => [f.id, f]));
      const allLeaguePlayers = await db.select().from(players).where(eq(players.leagueId, leagueId));
      const formMap = await getTeamRecentFormMap(leagueId);

      for (const fxId of plan.aiToSimulateIds) {
        const fx = fixtureById.get(fxId);
        if (!fx || fx.status !== 'scheduled') continue;
        const homeTeam = teamMap.get(fx.homeTeamId);
        const awayTeam = teamMap.get(fx.awayTeamId);
        if (!homeTeam || !awayTeam) continue;

        const homeXI = await resolveFixtureTeamXI(leagueId, homeTeam, allLeaguePlayers, undefined, fx.format);
        const awayXI = await resolveFixtureTeamXI(leagueId, awayTeam, allLeaguePlayers, undefined, fx.format);
        const homeForm = formMap.get(homeTeam.id) || [];
        const awayForm = formMap.get(awayTeam.id) || [];

        const summary = simulateCricketMatch({
          homeTeam,
          awayTeam,
          homeXI,
          awayXI,
          format: (fx.format as any) || 'T20',
          pitchCondition: fx.pitchCondition,
          userCall: 'heads',
          userDecisionIfWon: 'bat',
          homeForm,
          awayForm,
        });

        await commitCompletedFixtureMatch(
          fx,
          summary,
          homeXI.map((p) => p.id),
          awayXI.map((p) => p.id),
          freshLeague.hostUid,
          'ai_vs_ai'
        );
        simulatedAny = true;

        if (summary.winnerTeamId === homeTeam.id) {
          formMap.set(homeTeam.id, (['W', ...homeForm] as ('W' | 'L' | 'T')[]).slice(0, 5));
          formMap.set(awayTeam.id, (['L', ...awayForm] as ('W' | 'L' | 'T')[]).slice(0, 5));
        } else if (summary.winnerTeamId === awayTeam.id) {
          formMap.set(homeTeam.id, (['L', ...homeForm] as ('W' | 'L' | 'T')[]).slice(0, 5));
          formMap.set(awayTeam.id, (['W', ...awayForm] as ('W' | 'L' | 'T')[]).slice(0, 5));
        } else {
          formMap.set(homeTeam.id, (['T', ...homeForm] as ('W' | 'L' | 'T')[]).slice(0, 5));
          formMap.set(awayTeam.id, (['T', ...awayForm] as ('W' | 'L' | 'T')[]).slice(0, 5));
        }
      }

      for (const fxId of plan.overdueHumanToSimulateIds) {
        const fx = fixtureById.get(fxId);
        if (!fx || fx.status === 'completed') continue;
        await simulateScheduledFixtureWithSavedTactics(
          fx,
          freshLeague.hostUid,
          formMap,
          'auto_inactivity'
        );
        simulatedAny = true;
      }
    }

    if (plan.dayAdvanced || simulatedAny) {
      wsHub.broadcastToLeague(leagueId, 'league:updated', {
        currentGameDay: plan.nextGameDay,
        dayStartedAt: new Date(plan.nextDayStartedAtMs).toISOString(),
        nextAutoSimAt: new Date(plan.nextAutoSimAtMs).toISOString(),
        dayDurationSec: freshDurationSec,
        nextDayInSec: plan.nextDayInSec,
        dayAdvanced: plan.dayAdvanced,
      });
    }

    return {
      dayDurationSec: freshDurationSec,
      currentGameDay: plan.nextGameDay,
      nextDayInSec: plan.nextDayInSec,
      dayStartedAt: new Date(plan.nextDayStartedAtMs).toISOString(),
      nextAutoSimAt: new Date(plan.nextAutoSimAtMs).toISOString(),
      inactivitySimEnabled: freshInactivityEnabled,
      inactivityTimeoutSec: freshInactivitySec,
      dayPausedForHumanMatch: false,
    };
  } finally {
    inProgressCalendarLeagues.delete(leagueId);
  }
}

/**
 * Persistent server-side auto-simulation ticker:
 * Checks all active leagues (throttled to every 2 seconds) and triggers auto-advancement
 * even when all human managers are offline. Safe across restarts & multi-step catch-ups.
 */
export async function tickGlobalLeagueCalendars(force = false) {
  const nowMs = Date.now();
  if (!force && nowMs - lastGlobalCalendarSweepMs < 2000) return;
  lastGlobalCalendarSweepMs = nowMs;

  const activeLeagues = await db
    .select()
    .from(leagues)
    .where(eq(leagues.status, 'active'));

  for (const league of activeLeagues) {
    const nextAutoAt = (league as any).nextAutoSimAt
      ? new Date((league as any).nextAutoSimAt).getTime()
      : NaN;
    if (force || !Number.isFinite(nextAutoAt) || nowMs >= nextAutoAt) {
      await ensureLeagueScheduleExists(league.id);
      await syncLeagueDayProgression(league.id);
    }
  }
}

/**
 * Legacy helper retained for direct calls; delegates to syncLeagueDayProgression.
 */
export async function processDueAiFixtures(leagueId: number, _currentGameDay?: number) {
  return syncLeagueDayProgression(leagueId);
}

/**
 * Simulates a stalled/inactive scheduled fixture using both clubs' saved Playing XI (`lineups` table),
 * saved `tacticsJson`, recent league form, and chance variance.
 */
export async function simulateScheduledFixtureWithSavedTactics(
  fx: typeof fixtures.$inferSelect,
  initiatedByUid: string,
  preloadedFormMap?: Map<number, Array<'W' | 'L' | 'T'>>,
  resolutionType: 'manual' | 'ai_vs_ai' | 'auto_inactivity' = 'auto_inactivity'
) {
  const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, fx.leagueId));
  const homeTeam = leagueTeams.find((t) => t.id === fx.homeTeamId);
  const awayTeam = leagueTeams.find((t) => t.id === fx.awayTeamId);
  if (!homeTeam || !awayTeam) return null;

  const allLeaguePlayers = await db
    .select()
    .from(players)
    .where(eq(players.leagueId, fx.leagueId));

  const homeXI = await resolveFixtureTeamXI(
    fx.leagueId,
    homeTeam,
    allLeaguePlayers,
    fx.homeLineupIdsJson,
    fx.format
  );
  const awayXI = await resolveFixtureTeamXI(
    fx.leagueId,
    awayTeam,
    allLeaguePlayers,
    fx.awayLineupIdsJson,
    fx.format
  );

  const formMap = preloadedFormMap || (await getTeamRecentFormMap(fx.leagueId));
  const homeForm = formMap.get(homeTeam.id) || [];
  const awayForm = formMap.get(awayTeam.id) || [];

  const summary = simulateCricketMatch({
    homeTeam,
    awayTeam,
    homeXI,
    awayXI,
    format: (fx.format as any) || 'T20',
    pitchCondition: fx.pitchCondition,
    userCall: 'heads',
    userDecisionIfWon: 'bat',
    homeForm,
    awayForm,
  });

  const savedMatch = await commitCompletedFixtureMatch(
    fx,
    summary,
    homeXI.map((p) => p.id),
    awayXI.map((p) => p.id),
    initiatedByUid,
    resolutionType
  );

  return { savedMatch, summary, homeTeam, awayTeam };
}

/**
 * Starts the live engine state after toss for a real-time PvP fixture between two human friends
 */
export async function startPvpMatchLiveState(fx: typeof fixtures.$inferSelect) {
  const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, fx.leagueId));
  const homeTeam = leagueTeams.find((t) => t.id === fx.homeTeamId);
  const awayTeam = leagueTeams.find((t) => t.id === fx.awayTeamId);
  if (!homeTeam || !awayTeam) return null;

  const allPlayers = await db.select().from(players).where(eq(players.leagueId, fx.leagueId));
  const homeXI = await resolveFixtureTeamXI(
    fx.leagueId,
    homeTeam,
    allPlayers,
    fx.homeLineupIdsJson
  );
  const awayXI = await resolveFixtureTeamXI(
    fx.leagueId,
    awayTeam,
    allPlayers,
    fx.awayLineupIdsJson
  );

  const coinResult: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
  const homeWonToss = Math.random() < 0.5;
  const tossWinnerTeamId = homeWonToss ? homeTeam.id : awayTeam.id;
  const tossDecision: 'bat' | 'bowl' =
    fx.pitchCondition.includes('Flat') || Math.random() < 0.5 ? 'bat' : 'bowl';

  const homeBatsFirst =
    (homeWonToss && tossDecision === 'bat') || (!homeWonToss && tossDecision === 'bowl');

  const firstBatTeam = homeBatsFirst ? homeTeam : awayTeam;
  const firstBatXI = homeBatsFirst ? homeXI : awayXI;
  const firstBowlTeam = homeBatsFirst ? awayTeam : homeTeam;
  const firstBowlXI = homeBatsFirst ? awayXI : homeXI;

  const { maxBalls, ballsPerOver } = getFormatParams(fx.format);
  const inn1 = createLiveInningsState(firstBatTeam, firstBowlTeam.id, firstBatXI, firstBowlXI);

  const liveState: PvpLiveMatchState = {
    inningsNumber: 1,
    targetRuns: null,
    maxBallsPerInnings: maxBalls,
    ballsPerOver,
    pitchCondition: fx.pitchCondition,
    format: fx.format,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    innings1: inn1,
    innings2: null,
    completedInnings1Summary: null,
    commentary: [
      {
        id: Date.now(),
        over: '0.0',
        text: `LIVE PVP MATCH: ${tossWinnerTeamId === homeTeam.id ? homeTeam.shortCode : awayTeam.shortCode} won the toss and elected to ${tossDecision} first at ${fx.venue}.`,
        tone: 'boundary',
      },
    ],
    highlights: [],
    finished: false,
    lastTickAt: Date.now(),
  };

  const [updated] = await db
    .update(fixtures)
    .set({
      status: 'live',
      tossWinnerTeamId,
      tossDecision,
      coinResult,
      homeLineupIdsJson: homeXI.map((p) => p.id),
      awayLineupIdsJson: awayXI.map((p) => p.id),
      liveStateJson: liveState,
      updatedAt: new Date(),
    })
    .where(eq(fixtures.id, fx.id))
    .returning();

  wsHub.broadcastToLeague(fx.leagueId, 'fixture:pvp_update', { fixture: updated });
  return updated;
}

/**
 * Server tick loop: advances live PvP fixtures ball-by-ball with real-time WebSocket broadcasts
 */
export async function tickLivePvpFixtures() {
  const liveFixtures = await db
    .select()
    .from(fixtures)
    .where(eq(fixtures.status, 'live'));

  if (liveFixtures.length === 0) return;

  const now = Date.now();
  for (const fx of liveFixtures) {
    const state = fx.liveStateJson;
    if (!state || state.finished) continue;

    const minDelayMs = fx.simPace === 'slow' ? 1600 : fx.simPace === 'quick' ? 400 : 950;
    if (now - (state.lastTickAt || 0) < minDelayMs) continue;

    const ballsPerStep = fx.simPace === 'quick' ? 2 : 1;

    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, fx.leagueId));
    const homeTeam = leagueTeams.find((t) => t.id === fx.homeTeamId);
    const awayTeam = leagueTeams.find((t) => t.id === fx.awayTeamId);
    if (!homeTeam || !awayTeam) continue;

    const allPlayers = await db.select().from(players).where(eq(players.leagueId, fx.leagueId));
    const homeXI = await resolveFixtureTeamXI(fx.leagueId, homeTeam, allPlayers, fx.homeLineupIdsJson);
    const awayXI = await resolveFixtureTeamXI(fx.leagueId, awayTeam, allPlayers, fx.awayLineupIdsJson);

    const inn1BatIsHome = state.innings1.battingTeamId === homeTeam.id;
    const secondBatTeam = inn1BatIsHome ? awayTeam : homeTeam;
    const secondBatXI = inn1BatIsHome ? awayXI : homeXI;
    const secondBowlXI = inn1BatIsHome ? homeXI : awayXI;

    let nextState = state;
    for (let i = 0; i < ballsPerStep && !nextState.finished; i++) {
      const activeInn = nextState.inningsNumber === 1 ? nextState.innings1 : nextState.innings2;
      const batIsHome = activeInn?.battingTeamId === homeTeam.id;
      const battingStrategy = (batIsHome ? fx.homeStrategy : fx.awayStrategy) as LiveStrategy;
      const bowlingStrategy = (batIsHome ? fx.awayStrategy : fx.homeStrategy) as LiveStrategy;

      nextState = stepLiveBallEngine(
        nextState,
        fx.format,
        fx.pitchCondition,
        battingStrategy,
        bowlingStrategy,
        secondBatTeam,
        secondBatXI,
        secondBowlXI,
        state.innings1.battingTeamId
      );
    }

    nextState.lastTickAt = now;

    if (nextState.finished && nextState.innings2) {
      const inn1Summary =
        nextState.completedInnings1Summary ||
        toLiveInningsSummary(nextState.innings1, nextState.ballsPerOver);
      const inn2Summary = toLiveInningsSummary(nextState.innings2, nextState.ballsPerOver);

      let winnerTeamId: number | null = null;
      let marginText = 'Match Tied';
      if (inn1Summary.runs > inn2Summary.runs) {
        winnerTeamId = inn1Summary.teamId;
        marginText = `${inn1Summary.teamShortCode} won by ${inn1Summary.runs - inn2Summary.runs} runs`;
      } else if (inn2Summary.runs > inn1Summary.runs) {
        winnerTeamId = inn2Summary.teamId;
        const wkts = Math.max(1, 10 - inn2Summary.wickets);
        marginText = `${inn2Summary.teamShortCode} won by ${wkts} wicket${wkts === 1 ? '' : 's'}`;
      }

      const motm = inn1Summary.topScorer.split('(')[0].trim() || homeTeam.shortCode;
      const summary: MatchResultSummary = {
        tossWinnerTeamId: fx.tossWinnerTeamId || fx.homeTeamId,
        tossDecision: (fx.tossDecision as 'bat' | 'bowl') || 'bat',
        coinResult: (fx.coinResult as 'heads' | 'tails') || 'heads',
        userCall: (fx.coinResult as 'heads' | 'tails') || 'heads',
        innings1: inn1Summary,
        innings2: inn2Summary,
        winnerTeamId,
        marginText,
        manOfTheMatch: motm,
        venue: fx.venue,
        pitchCondition: fx.pitchCondition,
        highlights: nextState.highlights.length > 0 ? nextState.highlights : [marginText],
      };

      const [updated] = await db
        .update(fixtures)
        .set({
          liveStateJson: nextState,
          updatedAt: new Date(),
        })
        .where(eq(fixtures.id, fx.id))
        .returning();

      await commitCompletedFixtureMatch(
        updated || fx,
        summary,
        fx.homeLineupIdsJson,
        fx.awayLineupIdsJson,
        homeTeam.ownerUid || awayTeam.ownerUid || fx.leagueId.toString()
      );
      wsHub.broadcastToLeague(fx.leagueId, 'fixture:pvp_update', { fixture: { ...updated, status: 'completed' } });
    } else {
      const [updated] = await db
        .update(fixtures)
        .set({
          liveStateJson: nextState,
          updatedAt: new Date(),
        })
        .where(eq(fixtures.id, fx.id))
        .returning();

      wsHub.broadcastToLeague(fx.leagueId, 'fixture:pvp_update', { fixture: updated });
    }
  }
}
