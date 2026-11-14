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
}) {
  const dayDurationSec = Math.max(60, league.dayDurationSec || 600);
  const startMs = new Date(league.seasonStartedAt || Date.now()).getTime();
  const elapsedSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const currentGameDay = Math.floor(elapsedSec / dayDurationSec) + 1;
  const nextDayInSec = dayDurationSec - (elapsedSec % dayDurationSec);
  return {
    dayDurationSec,
    currentGameDay,
    nextDayInSec,
  };
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
  initiatedByUid: string
) {
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
      createdByUid: initiatedByUid,
    })
    .returning();

  await db
    .update(fixtures)
    .set({
      status: 'completed',
      matchId: savedMatch.id,
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
export async function processDueAiFixtures(leagueId: number, currentGameDay: number) {
  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league || league.status !== 'active') return;

  const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
  const teamMap = new Map(leagueTeams.map((t) => [t.id, t]));

  const allLeagueFixtures = await db
    .select()
    .from(fixtures)
    .where(eq(fixtures.leagueId, leagueId))
    .orderBy(asc(fixtures.scheduledDay), asc(fixtures.matchNumber));

  const playedCountByTeam = new Map<number, number>();
  for (const t of leagueTeams) playedCountByTeam.set(t.id, 0);

  let earliestUnplayedHumanDay: number | null = null;
  for (const fx of allLeagueFixtures) {
    if (fx.stage === 'league' && fx.status === 'completed') {
      playedCountByTeam.set(fx.homeTeamId, (playedCountByTeam.get(fx.homeTeamId) || 0) + 1);
      playedCountByTeam.set(fx.awayTeamId, (playedCountByTeam.get(fx.awayTeamId) || 0) + 1);
    } else if (fx.status !== 'completed') {
      const h = teamMap.get(fx.homeTeamId);
      const a = teamMap.get(fx.awayTeamId);
      if (h?.ownerUid || a?.ownerUid) {
        if (earliestUnplayedHumanDay === null || fx.scheduledDay < earliestUnplayedHumanDay) {
          earliestUnplayedHumanDay = fx.scheduledDay;
        }
      }
    }
  }

  const playedCounts = Array.from(playedCountByTeam.values());
  const minPlayedAcrossTeams = playedCounts.length > 0 ? Math.min(...playedCounts) : 0;

  const dueFixtures = allLeagueFixtures.filter((fx) => fx.status === 'scheduled');
  const aiDue = dueFixtures.filter((fx) => {
    if (fx.scheduledDay > currentGameDay) return false;
    const h = teamMap.get(fx.homeTeamId);
    const a = teamMap.get(fx.awayTeamId);
    if (!h || !a || h.ownerUid || a.ownerUid) return false;

    // Schedule Synchronization Guard: pause AI matches when lagging human fixtures would fall >2 matches behind
    if (earliestUnplayedHumanDay !== null && fx.scheduledDay > earliestUnplayedHumanDay + 2) {
      return false;
    }
    const hPlayed = playedCountByTeam.get(h.id) || 0;
    const aPlayed = playedCountByTeam.get(a.id) || 0;
    if (fx.stage === 'league' && (hPlayed >= minPlayedAcrossTeams + 2 || aPlayed >= minPlayedAcrossTeams + 2)) {
      return false;
    }
    return true;
  });

  if (aiDue.length === 0) return;

  const allLeaguePlayers = await db.select().from(players).where(eq(players.leagueId, leagueId));
  for (const fx of aiDue.slice(0, 3)) {
    const homeTeam = teamMap.get(fx.homeTeamId)!;
    const awayTeam = teamMap.get(fx.awayTeamId)!;
    const hPlayed = playedCountByTeam.get(homeTeam.id) || 0;
    const aPlayed = playedCountByTeam.get(awayTeam.id) || 0;
    if (fx.stage === 'league' && (hPlayed >= minPlayedAcrossTeams + 2 || aPlayed >= minPlayedAcrossTeams + 2)) {
      continue;
    }

    const homeXI = await resolveFixtureTeamXI(leagueId, homeTeam, allLeaguePlayers, undefined, fx.format);
    const awayXI = await resolveFixtureTeamXI(leagueId, awayTeam, allLeaguePlayers, undefined, fx.format);

    const summary = simulateCricketMatch({
      homeTeam,
      awayTeam,
      homeXI,
      awayXI,
      format: (fx.format as any) || 'T20',
      pitchCondition: fx.pitchCondition,
      userCall: 'heads',
      userDecisionIfWon: 'bat',
    });

    await commitCompletedFixtureMatch(
      fx,
      summary,
      homeXI.map((p) => p.id),
      awayXI.map((p) => p.id),
      league.hostUid
    );

    if (fx.stage === 'league') {
      playedCountByTeam.set(homeTeam.id, hPlayed + 1);
      playedCountByTeam.set(awayTeam.id, aPlayed + 1);
    }
  }
}

/**
 * Simulates a stalled/inactive scheduled fixture using both clubs' saved Playing XI (`lineups` table)
 * and saved `tacticsJson` when managers vote to advance an overdue human match.
 */
export async function simulateScheduledFixtureWithSavedTactics(
  fx: typeof fixtures.$inferSelect,
  initiatedByUid: string
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

  const summary = simulateCricketMatch({
    homeTeam,
    awayTeam,
    homeXI,
    awayXI,
    format: (fx.format as any) || 'T20',
    pitchCondition: fx.pitchCondition,
    userCall: 'heads',
    userDecisionIfWon: 'bat',
  });

  const savedMatch = await commitCompletedFixtureMatch(
    fx,
    summary,
    homeXI.map((p) => p.id),
    awayXI.map((p) => p.id),
    initiatedByUid
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
