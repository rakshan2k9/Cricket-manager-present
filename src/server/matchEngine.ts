import type {
  MatchBatterLine,
  MatchBowlerLine,
  MatchInningsSummary,
  MatchResultSummary,
  TeamTacticsConfig,
} from '../db/schema.ts';

export interface SimPlayerInput {
  id: number;
  name: string;
  country: string;
  leagueOrigin: string;
  primaryRole: string;
  battingHand: string;
  bowlingStyle: string;
  battingRating: number;
  bowlingRating: number;
  fieldingRating: number;
  fitness: number;
  consistency: number;
  temperament: number;
  potential: number;
  currentForm: number;
  morale: number;
  basePrice?: number;
  marketValue?: number;
  stamina?: number;
  consecutiveMatches?: number;
  traitsJson?: string[];
  injuryGamesRemaining?: number;
}

export interface SimTeamInput {
  id: number;
  name: string;
  shortCode: string;
  leagueCategory: string;
  homeGround: string;
  reputation: number;
  tacticsJson: TeamTacticsConfig;
  hiredStaffJson: Array<{ batStars?: number; bowlStars?: number; fieldStars?: number }>;
  rivalryBuffJson?: { vsTeamId?: number; aggressionBoost: number; moraleBoost: number } | null;
  pressMoraleBuff?: number;
}

const PITCH_CONDITIONS = [
  'Dusty Turner · Spin Dominance',
  'Flat Batting Track · High Scoring',
  'Green Seam · Early Pacers Assistance',
  'Dew Factor · Chasing Advantage',
  'Two-Paced · Tactical Varied Pace',
];

export function pickPitchCondition(seed: number): string {
  return PITCH_CONDITIONS[Math.abs(seed) % PITCH_CONDITIONS.length];
}

export function getPlayerOverallRating(p: {
  primaryRole: string;
  battingRating: number;
  bowlingRating: number;
  currentForm?: number;
  formDelta?: number;
}): number {
  const baseRaw =
    p.primaryRole === 'All-Rounder'
      ? Math.round(
          Math.max(p.battingRating, p.bowlingRating) * 0.6 +
            Math.min(p.battingRating, p.bowlingRating) * 0.4 +
            2
        )
      : Math.max(p.battingRating, p.bowlingRating);
  const base = Math.max(48, Math.min(89, baseRaw));
  const delta =
    typeof p.formDelta === 'number'
      ? Math.max(-4, Math.min(4, Math.round(p.formDelta)))
      : typeof p.currentForm === 'number'
        ? Math.max(-4, Math.min(4, Math.round((p.currentForm - 70) / 8)))
        : 0;
  return Math.max(48, Math.min(90, base + delta));
}

export function computeTeamRatings(xi: SimPlayerInput[]) {
  if (!xi.length) return { bat: 68, bowl: 68, field: 68, overall: 68 };
  const batSorted = [...xi].sort((a, b) => b.battingRating - a.battingRating).slice(0, 7);
  const bowlSorted = [...xi].sort((a, b) => b.bowlingRating - a.bowlingRating).slice(0, 5);
  const bat = Math.round(batSorted.reduce((s, p) => s + p.battingRating, 0) / batSorted.length);
  const bowl = Math.round(bowlSorted.reduce((s, p) => s + p.bowlingRating, 0) / bowlSorted.length);
  const field = Math.round(xi.reduce((s, p) => s + p.fieldingRating, 0) / xi.length);
  const overall = Math.round(
    xi.reduce((s, p) => s + getPlayerOverallRating(p), 0) / xi.length
  );
  return { bat, bowl, field, overall };
}

export function computeWinChance(
  homeRatings: { bat: number; bowl: number; field: number; overall: number },
  awayRatings: { bat: number; bowl: number; field: number; overall: number },
  format: string
) {
  const tiePct = format === 'Test' ? 14 : format === 'ODI' ? 3 : 4;
  const remaining = 100 - tiePct;
  const homePower = homeRatings.bat * 0.42 + homeRatings.bowl * 0.42 + homeRatings.field * 0.16 + 1.2; // slight home advantage
  const awayPower = awayRatings.bat * 0.42 + awayRatings.bowl * 0.42 + awayRatings.field * 0.16;
  const diff = homePower - awayPower;
  // logistic curve around 50%
  const rawHomeShare = 1 / (1 + Math.exp(-diff / 6.5));
  const homePct = Math.max(12, Math.min(remaining - 12, Math.round(rawHomeShare * remaining)));
  const awayPct = remaining - homePct;
  return { homePct, tiePct, awayPct };
}

/**
 * Selects a deterministic balanced XI from a pool when a club hasn't completed auction/contracting yet
 */
export function buildBalancedXI<T extends SimPlayerInput>(
  candidates: T[],
  preferredOrderIds: number[] = []
): T[] {
  const byId = new Map(candidates.map((p) => [p.id, p]));
  const picked: T[] = [];
  const used = new Set<number>();

  for (const id of preferredOrderIds) {
    const p = byId.get(id);
    if (p && !used.has(p.id) && picked.length < 11) {
      picked.push(p);
      used.add(p.id);
    }
  }

  if (picked.length === 11) return picked;

  const sorted = [...candidates]
    .filter((p) => !used.has(p.id))
    .sort((a, b) => getPlayerOverallRating(b) - getPlayerOverallRating(a));

  const wk = sorted.find((p) => p.primaryRole === 'Wicketkeeper');
  const bowlers = sorted.filter((p) => p.primaryRole === 'Bowler').slice(0, 4);
  const allRounders = sorted.filter((p) => p.primaryRole === 'All-Rounder').slice(0, 2);
  const batters = sorted.filter((p) => p.primaryRole === 'Batsman').slice(0, 4);

  const orderedSeeds = [...batters, ...allRounders, ...(wk ? [wk] : []), ...bowlers];
  for (const p of orderedSeeds) {
    if (!used.has(p.id) && picked.length < 11) {
      picked.push(p);
      used.add(p.id);
    }
  }

  for (const p of sorted) {
    if (!used.has(p.id) && picked.length < 11) {
      picked.push(p);
      used.add(p.id);
    }
  }

  // Sort batters top-order -> keeper/all-rounders -> bowlers if built from scratch
  if (preferredOrderIds.length === 0) {
    const roleWeight = (role: string) => {
      if (role === 'Batsman') return 1;
      if (role === 'Wicketkeeper') return 2;
      if (role === 'All-Rounder') return 3;
      return 4;
    };
    picked.sort((a, b) => {
      const rw = roleWeight(a.primaryRole) - roleWeight(b.primaryRole);
      if (rw !== 0) return rw;
      return b.battingRating - a.battingRating;
    });
  }

  return picked;
}

const TEAM_NATIONAL_COUNTRY_MAP: Record<string, string> = {
  ind: 'India',
  eng: 'England',
  aus: 'Australia',
  sa: 'South Africa',
  nz: 'New Zealand',
  pak: 'Pakistan',
  sl: 'Sri Lanka',
  wi: 'West Indies',
  ban: 'Bangladesh',
  afg: 'Afghanistan',
};

export function selectExhibitionClubPool<T extends SimPlayerInput>(
  allPool: T[],
  team: { templateKey?: string | null; leagueCategory: string; id: number }
): T[] {
  const key = (team.templateKey || '').toLowerCase();
  if (team.leagueCategory === 'International' && TEAM_NATIONAL_COUNTRY_MAP[key]) {
    const country = TEAM_NATIONAL_COUNTRY_MAP[key];
    const nationals = allPool.filter((p) => p.country === country);
    if (nationals.length >= 11) return nationals;
  }

  const originFiltered = allPool.filter((p) => p.leagueOrigin === team.leagueCategory);
  const sourcePool = originFiltered.length >= 22 ? originFiltered : allPool;

  // Deterministic team slice so each club fields a distinct, authentic XI even pre-auction
  const sortedByOvr = [...sourcePool].sort(
    (a, b) => getPlayerOverallRating(b) - getPlayerOverallRating(a)
  );
  const offset = (team.id * 7) % Math.max(1, sortedByOvr.length - 20);
  const clubCandidates: T[] = [];
  for (let i = 0; i < sortedByOvr.length && clubCandidates.length < 18; i++) {
    const idx = (offset + i * 3) % sortedByOvr.length;
    const candidate = sortedByOvr[idx];
    if (!clubCandidates.some((c) => c.id === candidate.id)) {
      clubCandidates.push(candidate);
    }
  }
  return clubCandidates;
}

import {
  computeBallProbabilities,
  getFormatParamsShared,
  pickBowlingAttackPool,
  selectNextBowlerIndex,
  shouldDropCatch,
  type EngineBatterSlot,
  type EngineBowlerSlot,
  type EngineStrategy,
} from '../utils/cricketEngine.ts';

export type LiveStrategy = EngineStrategy;

export function getFormatParams(format: string) {
  return getFormatParamsShared(format);
}

function formatOversCount(balls: number, ballsPerOver: number): string {
  const whole = Math.floor(balls / ballsPerOver);
  const rem = balls % ballsPerOver;
  return rem === 0 ? `${whole}` : `${whole}.${rem}`;
}

function simulateInnings(
  battingTeam: SimTeamInput,
  battingXI: SimPlayerInput[],
  bowlingTeam: SimTeamInput,
  bowlingXI: SimPlayerInput[],
  format: string,
  pitchCondition: string,
  targetRuns: number | null,
  inningsNumber: 1 | 2,
  rng: () => number
): { summary: MatchInningsSummary; droppedCatches: string[]; turningPoints: string[] } {
  const { maxBalls, ballsPerOver, maxBowlerQuota } = getFormatParamsShared(format);

  // Pick 5-6 bowlers with realistic pace/spin attack coverage
  const bowlers = pickBowlingAttackPool(bowlingXI);

  const batCoachBonus =
    (battingTeam.hiredStaffJson || []).reduce((acc, s) => acc + (s.batStars || 0), 0) * 0.35;
  const bowlCoachBonus =
    (bowlingTeam.hiredStaffJson || []).reduce((acc, s) => acc + (s.bowlStars || 0), 0) * 0.35;

  const batStrategy: LiveStrategy =
    battingTeam.tacticsJson?.t20Tempo === 'Ultra-Attacking'
      ? 'Ultra-Attacking'
      : battingTeam.tacticsJson?.t20Tempo === 'Aggressive'
        ? 'Aggressive'
        : battingTeam.tacticsJson?.t20Tempo === 'Anchor-Led'
          ? 'Defensive'
          : 'Normal';

  const bowlStrategy: LiveStrategy =
    bowlingTeam.tacticsJson?.powerplayAggression === 'High'
      ? 'Aggressive'
      : bowlingTeam.tacticsJson?.powerplayAggression === 'Cautious'
        ? 'Defensive'
        : 'Normal';

  const droppedCatches: string[] = [];
  const batterStats: Array<EngineBatterSlot & { fours: number; sixes: number; dismissal: string }> =
    battingXI.map((p, slot) => ({
      playerId: p.id,
      name: p.name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      dismissal: 'yet to bat',
      battingRating: p.battingRating,
      form: p.currentForm,
      primaryRole: p.primaryRole,
      consistency: p.consistency,
      temperament: p.temperament,
      fitness: p.fitness,
      stamina: p.stamina ?? 100,
      consecutiveMatches: p.consecutiveMatches ?? 0,
      traitsJson: p.traitsJson || [],
      morale: p.morale,
      battingSlot: slot,
    }));

  const bowlerStats: EngineBowlerSlot[] = bowlers.map((p) => ({
    playerId: p.id,
    name: p.name,
    balls: 0,
    runs: 0,
    wickets: 0,
    bowlingRating: p.bowlingRating,
    bowlingStyle: p.bowlingStyle,
    primaryRole: p.primaryRole,
    consistency: p.consistency,
    temperament: p.temperament,
    fitness: p.fitness,
    stamina: p.stamina ?? 100,
    consecutiveMatches: p.consecutiveMatches ?? 0,
    traitsJson: p.traitsJson || [],
    currentForm: p.currentForm,
    morale: p.morale,
  }));

  const batRivalryBoost =
    (battingTeam.rivalryBuffJson?.aggressionBoost || 0) + (battingTeam.pressMoraleBuff || 0) * 0.25;
  const bowlRivalryBoost =
    (bowlingTeam.rivalryBuffJson?.aggressionBoost || 0) + (bowlingTeam.pressMoraleBuff || 0) * 0.25;

  let totalRuns = 0;
  let wickets = 0;
  let ballsBowled = 0;
  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let nextBatterIdx = 2;
  let currentBowlerIdx = 0;
  let lastBowlerIdx = -1;

  batterStats[0].dismissal = 'not out';
  if (batterStats[1]) batterStats[1].dismissal = 'not out';

  const keeper = bowlingXI.find((p) => p.primaryRole === 'Wicketkeeper') || bowlingXI[0];

  while (ballsBowled < maxBalls && wickets < 10) {
    if (targetRuns !== null && totalRuns >= targetRuns) break;

    if (ballsBowled % ballsPerOver === 0) {
      currentBowlerIdx = selectNextBowlerIndex(
        bowlerStats,
        lastBowlerIdx,
        ballsBowled,
        maxBalls,
        ballsPerOver,
        maxBowlerQuota,
        format,
        pitchCondition,
        rng
      );
    }

    const bowler = bowlerStats[currentBowlerIdx];
    const batter = batterStats[strikerIdx];

    const probs = computeBallProbabilities({
      batter,
      bowler,
      battingStrategy: batStrategy,
      bowlingStrategy: bowlStrategy,
      format,
      pitchCondition,
      ballsBowled,
      maxBalls,
      inningsNumber,
      runsScored: totalRuns,
      wicketsLost: wickets,
      targetRuns,
      batCoachBonus,
      bowlCoachBonus,
      batRivalryBoost,
      bowlRivalryBoost,
    });

    ballsBowled += 1;
    batter.balls += 1;
    bowler.balls += 1;

    const roll = rng();
    if (roll < probs.wicketProb) {
      const dismissalRoll = rng();
      const isCatchOpportunity = dismissalRoll >= 0.36;
      if (isCatchOpportunity && shouldDropCatch(bowlingXI, rng)) {
        const fielder = bowlingXI[Math.floor(rng() * bowlingXI.length)];
        droppedCatches.push(`${fielder.name} dropped ${batter.name} (${batter.runs}) off ${bowler.name}`);
        // Batter survives with 1 run scramble
        totalRuns += 1;
        batter.runs += 1;
        bowler.runs += 1;
        const tmp = strikerIdx;
        strikerIdx = nonStrikerIdx;
        nonStrikerIdx = tmp;
      } else {
        wickets += 1;
        bowler.wickets += 1;
        const bowlerLast = bowler.name.split(' ').slice(-1)[0];
        if (dismissalRoll < 0.24) {
          batter.dismissal = `b ${bowlerLast}`;
        } else if (dismissalRoll < 0.36) {
          batter.dismissal = `lbw b ${bowlerLast}`;
        } else if (dismissalRoll < 0.54) {
          batter.dismissal = `c †${keeper.name.split(' ').slice(-1)[0]} b ${bowlerLast}`;
        } else {
          const fielder = bowlingXI[Math.floor(rng() * bowlingXI.length)];
          batter.dismissal = `c ${fielder.name.split(' ').slice(-1)[0]} b ${bowlerLast}`;
        }

        if (nextBatterIdx < batterStats.length) {
          strikerIdx = nextBatterIdx;
          batterStats[strikerIdx].dismissal = 'not out';
          nextBatterIdx += 1;
        }
      }
    } else {
      const c1 = probs.wicketProb + probs.dotProb;
      const c2 = c1 + probs.oneProb;
      const c3 = c2 + probs.twoProb;
      const c4 = c3 + probs.threeProb;
      const c5 = c4 + probs.fourProb;

      let ballRuns = 0;
      if (roll < c1) {
        ballRuns = 0;
      } else if (roll < c2) {
        ballRuns = 1;
      } else if (roll < c3) {
        ballRuns = 2;
      } else if (roll < c4) {
        ballRuns = 3;
      } else if (roll < c5) {
        ballRuns = 4;
        batter.fours += 1;
      } else {
        ballRuns = 6;
        batter.sixes += 1;
      }

      totalRuns += ballRuns;
      batter.runs += ballRuns;
      bowler.runs += ballRuns;

      if (ballRuns % 2 === 1) {
        const tmp = strikerIdx;
        strikerIdx = nonStrikerIdx;
        nonStrikerIdx = tmp;
      }
    }

    if (ballsBowled % ballsPerOver === 0) {
      lastBowlerIdx = currentBowlerIdx;
      const tmp = strikerIdx;
      strikerIdx = nonStrikerIdx;
      nonStrikerIdx = tmp;
    }
  }

  const cleanBatters: MatchBatterLine[] = batterStats
    .filter((b) => b.balls > 0 || b.dismissal === 'not out')
    .map((b) => ({
      playerId: b.playerId,
      name: b.name,
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      dismissal: b.dismissal,
    }));

  const cleanBowlers: MatchBowlerLine[] = bowlerStats
    .filter((b) => b.balls > 0)
    .map((b) => {
      const oversFloat = b.balls / ballsPerOver;
      return {
        playerId: b.playerId,
        name: b.name,
        overs: formatOversCount(b.balls, ballsPerOver),
        runs: b.runs,
        wickets: b.wickets,
        econ: Number((b.runs / Math.max(0.2, oversFloat)).toFixed(2)),
      };
    });

  const bestBat = [...cleanBatters].sort((a, b) => b.runs - a.runs)[0];
  const bestBowl = [...cleanBowlers].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];

  const turningPoints: string[] = [];
  if (bestBat && bestBat.runs >= 45) {
    turningPoints.push(`${bestBat.name} anchored ${battingTeam.shortCode} with ${bestBat.runs} (${bestBat.balls}b)`);
  }
  if (bestBowl && bestBowl.wickets >= 3) {
    turningPoints.push(`${bestBowl.name} struck ${bestBowl.wickets}/${bestBowl.runs} in ${bestBowl.overs} overs`);
  }
  if (droppedCatches.length > 0) {
    turningPoints.push(droppedCatches[0]);
  }

  return {
    summary: {
      teamId: battingTeam.id,
      teamName: battingTeam.name,
      teamShortCode: battingTeam.shortCode,
      runs: totalRuns,
      wickets,
      overs: formatOversCount(ballsBowled, ballsPerOver),
      topScorer: bestBat ? `${bestBat.name} ${bestBat.runs} (${bestBat.balls})` : 'N/A',
      topBowler: bestBowl
        ? `${bestBowl.name} ${bestBowl.wickets}/${bestBowl.runs} (${bestBowl.overs})`
        : 'N/A',
      batters: cleanBatters,
      bowlers: cleanBowlers,
    },
    droppedCatches,
    turningPoints,
  };
}

export function simulateCricketMatch(params: {
  homeTeam: SimTeamInput;
  awayTeam: SimTeamInput;
  homeXI: SimPlayerInput[];
  awayXI: SimPlayerInput[];
  format: 'T20' | 'ODI' | 'Test' | 'Hundred';
  pitchCondition: string;
  userCall: 'heads' | 'tails';
  userDecisionIfWon: 'bat' | 'bowl';
  seed?: number;
}): MatchResultSummary {
  const { homeTeam, awayTeam, homeXI, awayXI, format, pitchCondition, userCall, userDecisionIfWon } =
    params;

  let seed =
    typeof params.seed === 'number'
      ? params.seed >>> 0
      : (Date.now() ^ (homeTeam.id * 7919) ^ (awayTeam.id * 104729)) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const coinResult: 'heads' | 'tails' = rng() < 0.5 ? 'heads' : 'tails';
  const userWonToss = coinResult === userCall;
  const tossWinnerTeamId = userWonToss ? homeTeam.id : awayTeam.id;
  const oppDecision: 'bat' | 'bowl' =
    pitchCondition.includes('Seam') || pitchCondition.includes('Humid') || format === 'T20'
      ? rng() < 0.62
        ? 'bowl'
        : 'bat'
      : rng() < 0.55
        ? 'bat'
        : 'bowl';
  const tossDecision = userWonToss ? userDecisionIfWon : oppDecision;

  const homeBatsFirst =
    (tossWinnerTeamId === homeTeam.id && tossDecision === 'bat') ||
    (tossWinnerTeamId === awayTeam.id && tossDecision === 'bowl');

  const firstTeam = homeBatsFirst ? homeTeam : awayTeam;
  const firstXI = homeBatsFirst ? homeXI : awayXI;
  const secondTeam = homeBatsFirst ? awayTeam : homeTeam;
  const secondXI = homeBatsFirst ? awayXI : homeXI;

  const inn1Res = simulateInnings(
    firstTeam,
    firstXI,
    secondTeam,
    secondXI,
    format,
    pitchCondition,
    null,
    1,
    rng
  );
  const innings1 = inn1Res.summary;

  const inn2Res = simulateInnings(
    secondTeam,
    secondXI,
    firstTeam,
    firstXI,
    format,
    pitchCondition,
    innings1.runs + 1,
    2,
    rng
  );
  const innings2 = inn2Res.summary;

  let winnerTeamId: number | null = null;
  let marginText = 'Match Tied';

  if (innings1.runs > innings2.runs) {
    winnerTeamId = firstTeam.id;
    marginText = `${firstTeam.shortCode} won by ${innings1.runs - innings2.runs} runs`;
  } else if (innings2.runs > innings1.runs) {
    winnerTeamId = secondTeam.id;
    const wktsRemaining = Math.max(1, 10 - innings2.wickets);
    marginText = `${secondTeam.shortCode} won by ${wktsRemaining} wicket${wktsRemaining === 1 ? '' : 's'}`;
  }

  const impactScores = new Map<string, number>();
  for (const inn of [innings1, innings2]) {
    for (const b of inn.batters) {
      const pts = b.runs + b.sixes * 2 + (b.runs >= 50 ? 15 : 0);
      impactScores.set(b.name, (impactScores.get(b.name) || 0) + pts);
    }
    for (const bw of inn.bowlers) {
      const pts = bw.wickets * 24 + (bw.econ < 7 ? 8 : 0);
      impactScores.set(bw.name, (impactScores.get(bw.name) || 0) + pts);
    }
  }
  const momEntry = Array.from(impactScores.entries()).sort((a, b) => b[1] - a[1])[0];
  const manOfTheMatch = momEntry ? momEntry[0] : innings1.topScorer.split(' ')[0];

  const tossWinnerName = tossWinnerTeamId === homeTeam.id ? homeTeam.shortCode : awayTeam.shortCode;
  const droppedCatches = [...inn1Res.droppedCatches, ...inn2Res.droppedCatches];
  const turningPoints = [...inn1Res.turningPoints, ...inn2Res.turningPoints].slice(0, 6);
  const highlights = [
    `${tossWinnerName} won the toss and elected to ${tossDecision}.`,
    `${innings1.teamShortCode}: ${innings1.runs}/${innings1.wickets} (${innings1.overs} ov) — ${innings1.topScorer}`,
    `${innings2.teamShortCode}: ${innings2.runs}/${innings2.wickets} (${innings2.overs} ov) — ${innings2.topScorer}`,
    `${marginText} · Player of the Match: ${manOfTheMatch}`,
  ];

  return {
    tossWinnerTeamId,
    tossDecision,
    coinResult,
    userCall,
    innings1,
    innings2,
    winnerTeamId,
    marginText,
    manOfTheMatch,
    venue: homeTeam.homeGround,
    pitchCondition,
    highlights,
    droppedCatches,
    turningPoints,
  };
}

// ---------- Server-side Real-Time PvP Ball-by-Ball Engine ----------

export interface LiveBatterEntry {
  playerId: number;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissal: string;
  battingRating: number;
  form: number;
  primaryRole?: string;
  consistency?: number;
  temperament?: number;
  fitness?: number;
  stamina?: number;
  consecutiveMatches?: number;
  traitsJson?: string[];
  morale?: number;
  battingSlot?: number;
}

export interface LiveBowlerEntry {
  playerId: number;
  name: string;
  balls: number;
  runs: number;
  wickets: number;
  bowlingRating: number;
  bowlingStyle?: string;
  primaryRole?: string;
  consistency?: number;
  temperament?: number;
  fitness?: number;
  stamina?: number;
  consecutiveMatches?: number;
  traitsJson?: string[];
  currentForm?: number;
  morale?: number;
}

export interface LiveInningsStateData {
  battingTeamId: number;
  battingTeamName: string;
  battingShortCode: string;
  bowlingTeamId: number;
  runs: number;
  wickets: number;
  balls: number;
  strikerIdx: number;
  nonStrikerIdx: number;
  nextBatterIdx: number;
  currentBowlerIdx?: number;
  lastBowlerIdx?: number;
  batters: LiveBatterEntry[];
  bowlers: LiveBowlerEntry[];
  recentBalls: string[];
  keeperName: string;
  fielders: string[];
}

export function createLiveInningsState(
  batTeam: SimTeamInput,
  bowlTeamId: number,
  batXI: SimPlayerInput[],
  bowlXI: SimPlayerInput[]
): LiveInningsStateData {
  const bowlers = pickBowlingAttackPool(bowlXI);
  const keeper = bowlXI.find((p) => p.primaryRole === 'Wicketkeeper') || bowlXI[0];

  const batters: LiveBatterEntry[] = batXI.map((p, idx) => ({
    playerId: p.id,
    name: p.name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    dismissal: idx <= 1 ? 'not out' : 'yet to bat',
    battingRating: p.battingRating,
    form: p.currentForm,
    primaryRole: p.primaryRole,
    consistency: p.consistency,
    temperament: p.temperament,
    fitness: p.fitness,
    stamina: p.stamina ?? 100,
    consecutiveMatches: p.consecutiveMatches ?? 0,
    traitsJson: p.traitsJson || [],
    morale: p.morale,
    battingSlot: idx,
  }));

  return {
    battingTeamId: batTeam.id,
    battingTeamName: batTeam.name,
    battingShortCode: batTeam.shortCode,
    bowlingTeamId: bowlTeamId,
    runs: 0,
    wickets: 0,
    balls: 0,
    strikerIdx: 0,
    nonStrikerIdx: 1,
    nextBatterIdx: 2,
    currentBowlerIdx: 0,
    lastBowlerIdx: -1,
    batters,
    bowlers: bowlers.map((p) => ({
      playerId: p.id,
      name: p.name,
      balls: 0,
      runs: 0,
      wickets: 0,
      bowlingRating: p.bowlingRating,
      bowlingStyle: p.bowlingStyle,
      primaryRole: p.primaryRole,
      consistency: p.consistency,
      temperament: p.temperament,
      fitness: p.fitness,
      stamina: p.stamina ?? 100,
      consecutiveMatches: p.consecutiveMatches ?? 0,
      traitsJson: p.traitsJson || [],
      currentForm: p.currentForm,
      morale: p.morale,
    })),
    recentBalls: [],
    keeperName: keeper?.name || 'Keeper',
    fielders: bowlXI.map((p) => p.name),
  };
}

export function toLiveInningsSummary(
  inn: LiveInningsStateData,
  ballsPerOver: number
): MatchInningsSummary {
  const cleanBatters: MatchBatterLine[] = inn.batters
    .filter((b) => b.balls > 0 || b.dismissal === 'not out')
    .map((b) => ({
      playerId: b.playerId,
      name: b.name,
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      dismissal: b.dismissal,
    }));

  const cleanBowlers: MatchBowlerLine[] = inn.bowlers
    .filter((b) => b.balls > 0)
    .map((b) => ({
      playerId: b.playerId,
      name: b.name,
      overs: formatOversCount(b.balls, ballsPerOver),
      runs: b.runs,
      wickets: b.wickets,
      econ: Number((b.runs / Math.max(0.2, b.balls / ballsPerOver)).toFixed(2)),
    }));

  const bestBat = [...cleanBatters].sort((a, b) => b.runs - a.runs)[0];
  const bestBowl = [...cleanBowlers].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];

  return {
    teamId: inn.battingTeamId,
    teamName: inn.battingTeamName,
    teamShortCode: inn.battingShortCode,
    runs: inn.runs,
    wickets: inn.wickets,
    overs: formatOversCount(inn.balls, ballsPerOver),
    topScorer: bestBat ? `${bestBat.name} ${bestBat.runs} (${bestBat.balls})` : 'N/A',
    topBowler: bestBowl
      ? `${bestBowl.name} ${bestBowl.wickets}/${bestBowl.runs} (${bestBowl.overs})`
      : 'N/A',
    batters: cleanBatters,
    bowlers: cleanBowlers,
  };
}

export function stepLiveBallEngine<
  TState extends {
    inningsNumber: 1 | 2;
    targetRuns: number | null;
    maxBallsPerInnings: number;
    ballsPerOver: number;
    innings1: LiveInningsStateData;
    innings2: LiveInningsStateData | null;
    completedInnings1Summary: MatchInningsSummary | null;
    commentary: Array<{ id: number; over: string; text: string; tone: 'wicket' | 'boundary' | 'normal' }>;
    highlights: string[];
    finished: boolean;
  }
>(
  state: TState,
  format: string,
  pitchCondition: string,
  battingStrategy: LiveStrategy,
  bowlingStrategy: LiveStrategy,
  secondBatTeam: SimTeamInput,
  secondBatXI: SimPlayerInput[],
  secondBowlXI: SimPlayerInput[],
  firstBatTeamId: number
): TState {
  if (state.finished) return state;

  const isFirst = state.inningsNumber === 1;
  const inn = isFirst ? state.innings1 : state.innings2;
  if (!inn) return state;

  const clonedInn: LiveInningsStateData = {
    ...inn,
    batters: inn.batters.map((b, slot) => ({ ...b, battingSlot: b.battingSlot ?? slot })),
    bowlers: inn.bowlers.map((b) => ({ ...b })),
    recentBalls: [...inn.recentBalls],
  };

  const bpo = state.ballsPerOver;
  const maxBalls = state.maxBallsPerInnings;
  const { maxBowlerQuota } = getFormatParamsShared(format);

  if (clonedInn.balls % bpo === 0 || typeof clonedInn.currentBowlerIdx !== 'number') {
    clonedInn.currentBowlerIdx = selectNextBowlerIndex(
      clonedInn.bowlers,
      clonedInn.lastBowlerIdx ?? -1,
      clonedInn.balls,
      maxBalls,
      bpo,
      maxBowlerQuota,
      format,
      pitchCondition,
      Math.random
    );
  }

  const bowlerIdx = clonedInn.currentBowlerIdx ?? 0;
  const bowler = clonedInn.bowlers[bowlerIdx];
  const striker = clonedInn.batters[clonedInn.strikerIdx];

  const probs = computeBallProbabilities({
    batter: striker,
    bowler,
    battingStrategy,
    bowlingStrategy,
    format,
    pitchCondition,
    ballsBowled: clonedInn.balls,
    maxBalls,
    inningsNumber: state.inningsNumber,
    runsScored: clonedInn.runs,
    wicketsLost: clonedInn.wickets,
    targetRuns: state.targetRuns,
  });

  clonedInn.balls += 1;
  striker.balls += 1;
  bowler.balls += 1;

  const overStr = `${Math.floor((clonedInn.balls - 1) / bpo)}.${((clonedInn.balls - 1) % bpo) + 1}`;
  let eventText = '';
  let tone: 'wicket' | 'boundary' | 'normal' = 'normal';

  const roll = Math.random();
  if (roll < probs.wicketProb) {
    const dRoll = Math.random();
    const isCatchOpportunity = dRoll >= 0.44;
    if (isCatchOpportunity && Math.random() < 0.085) {
      const fld = clonedInn.fielders[Math.floor(Math.random() * clonedInn.fielders.length)] || 'Fielder';
      clonedInn.runs += 1;
      striker.runs += 1;
      bowler.runs += 1;
      clonedInn.recentBalls = [...clonedInn.recentBalls.slice(-11), '1'];
      tone = 'boundary';
      eventText = `DROPPED CATCH! ${fld} puts down ${striker.name} (${striker.runs}) off ${bowler.name} — 1 run taken!`;
      const tmp = clonedInn.strikerIdx;
      clonedInn.strikerIdx = clonedInn.nonStrikerIdx;
      clonedInn.nonStrikerIdx = tmp;
    } else {
      clonedInn.wickets += 1;
      bowler.wickets += 1;
      clonedInn.recentBalls = [...clonedInn.recentBalls.slice(-11), 'W'];
      tone = 'wicket';

      const bowlerLast = bowler.name.split(' ').slice(-1)[0];
      if (dRoll < 0.28) striker.dismissal = `b ${bowlerLast}`;
      else if (dRoll < 0.44) striker.dismissal = `lbw b ${bowlerLast}`;
      else if (dRoll < 0.62)
        striker.dismissal = `c †${clonedInn.keeperName.split(' ').slice(-1)[0]} b ${bowlerLast}`;
      else {
        const fld = clonedInn.fielders[Math.floor(Math.random() * clonedInn.fielders.length)] || 'Fielder';
        striker.dismissal = `c ${fld.split(' ').slice(-1)[0]} b ${bowlerLast}`;
      }

      eventText = `WICKET! ${bowler.name} dismisses ${striker.name} (${striker.runs} off ${striker.balls}b) — ${striker.dismissal}.`;
      if (clonedInn.nextBatterIdx < clonedInn.batters.length) {
        clonedInn.strikerIdx = clonedInn.nextBatterIdx;
        clonedInn.batters[clonedInn.strikerIdx].dismissal = 'not out';
        clonedInn.nextBatterIdx += 1;
      }
    }
  } else {
    const c1 = probs.wicketProb + probs.dotProb;
    const c2 = c1 + probs.oneProb;
    const c3 = c2 + probs.twoProb;
    const c4 = c3 + probs.threeProb;
    const c5 = c4 + probs.fourProb;

    let runs = 0;
    if (roll < c1) runs = 0;
    else if (roll < c2) runs = 1;
    else if (roll < c3) runs = 2;
    else if (roll < c4) runs = 3;
    else if (roll < c5) {
      runs = 4;
      striker.fours += 1;
    } else {
      runs = 6;
      striker.sixes += 1;
    }

    clonedInn.runs += runs;
    striker.runs += runs;
    bowler.runs += runs;
    clonedInn.recentBalls = [...clonedInn.recentBalls.slice(-11), runs === 0 ? '·' : String(runs)];

    if (runs === 6) {
      tone = 'boundary';
      eventText = `SIX! ${striker.name} deposits ${bowler.name} deep into the stands! (${battingStrategy})`;
    } else if (runs === 4) {
      tone = 'boundary';
      eventText = `FOUR! ${striker.name} crunches ${bowler.name} to the fence.`;
    } else if (runs === 0) {
      eventText = `${bowler.name} to ${striker.name}, dot ball.`;
    } else {
      eventText = `${bowler.name} to ${striker.name}, ${runs} run${runs > 1 ? 's' : ''}.`;
    }

    if (runs % 2 === 1) {
      const tmp = clonedInn.strikerIdx;
      clonedInn.strikerIdx = clonedInn.nonStrikerIdx;
      clonedInn.nonStrikerIdx = tmp;
    }
  }

  if (clonedInn.balls % bpo === 0) {
    clonedInn.lastBowlerIdx = bowlerIdx;
    const tmp = clonedInn.strikerIdx;
    clonedInn.strikerIdx = clonedInn.nonStrikerIdx;
    clonedInn.nonStrikerIdx = tmp;
  }

  const nextCommentary = [
    { id: Date.now() + Math.random(), over: overStr, text: eventText, tone },
    ...state.commentary,
  ].slice(0, 60);

  const innEnded =
    clonedInn.balls >= maxBalls ||
    clonedInn.wickets >= 10 ||
    (!isFirst && state.targetRuns !== null && clonedInn.runs >= state.targetRuns);

  if (isFirst && innEnded) {
    const summary1 = toLiveInningsSummary(clonedInn, bpo);
    const inn2 = createLiveInningsState(secondBatTeam, firstBatTeamId, secondBatXI, secondBowlXI);
    const target = clonedInn.runs + 1;

    return {
      ...state,
      inningsNumber: 2 as const,
      targetRuns: target,
      innings1: clonedInn,
      innings2: inn2,
      completedInnings1Summary: summary1,
      commentary: [
        {
          id: Date.now() + 99,
          over: 'INT',
          text: `Innings Break: ${summary1.teamShortCode} posted ${summary1.runs}/${summary1.wickets} (${summary1.overs}). ${secondBatTeam.shortCode} need ${target} to win.`,
          tone: 'boundary' as const,
        },
        ...nextCommentary,
      ].slice(0, 60),
      highlights: [
        ...state.highlights,
        `${summary1.teamShortCode}: ${summary1.runs}/${summary1.wickets} (${summary1.overs}) — ${summary1.topScorer}`,
      ],
    };
  }

  if (!isFirst && innEnded) {
    return {
      ...state,
      innings2: clonedInn,
      commentary: nextCommentary,
      finished: true,
    };
  }

  return {
    ...state,
    innings1: isFirst ? clonedInn : state.innings1,
    innings2: isFirst ? state.innings2 : clonedInn,
    commentary: nextCommentary,
  };
}


