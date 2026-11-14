import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Award,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coins,
  Crown,
  FastForward,
  Gauge,
  GripVertical,
  Mic,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import type {
  KeyMomentChoice,
  KeyMomentDilemma,
  LeagueFixture,
  LeagueStateSnapshot,
  Lineup,
  MatchBatterLine,
  MatchBowlerLine,
  MatchInningsSummary,
  MatchPreviewData,
  MatchRecord,
  MatchResultSummary,
  Player,
} from '../types/game';
import { apiFetch } from '../lib/api';
import {
  formatOvrWithDelta,
  formatTimeAgo,
  getCompetitionDisplayLabel,
  getFormatDisplayLabel,
  getLeagueFormats,
  getPlayerOverall,
  type MatchFormatCode,
} from '../utils/format';
import { TeamCrest } from '../components/TeamCrest';
import { CyanPlayerCard } from '../components/CyanPlayerCard';
import { PressConferenceModal } from '../components/PressConferenceModal';
import type { ActiveTab } from '../components/AppShell';
import {
  buildKeyMomentDilemma,
  clampMomentum,
  computeBallProbabilities,
  getFormatParamsShared,
  pickBowlingAttackPool,
  selectNextBowlerIndex,
  shouldDropCatch,
  type ActiveMatchModifiers,
  type EngineBowlerSlot,
  type EngineStrategy,
} from '../utils/cricketEngine';

type MatchStage = 'lineup' | 'compare' | 'toss' | 'sim';
type MatchHubView = 'match' | 'schedule' | 'standings' | 'pvp';
type SimPace = 'slow' | 'medium' | 'quick';
type MatchStrategy = EngineStrategy;

interface LiveBatterState {
  player: Player;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissal: string;
}

interface LiveBowlerState {
  player: Player;
  balls: number;
  runs: number;
  wickets: number;
}

interface LiveInningsEngineState {
  battingTeamId: number;
  battingTeamName: string;
  battingTeamShortCode: string;
  bowlingTeamId: number;
  runs: number;
  wickets: number;
  balls: number;
  batters: LiveBatterState[];
  bowlers: LiveBowlerState[];
  strikerIdx: number;
  nonStrikerIdx: number;
  nextBatterIdx: number;
  currentBowlerIdx: number;
  lastBowlerIdx: number;
  thisOverBalls: string[];
  partnershipRuns: number;
  partnershipBalls: number;
  last10Balls: string[];
}

interface LiveMatchEngineState {
  inningsNumber: 1 | 2;
  targetRuns: number | null;
  maxBallsPerInnings: number;
  ballsPerOver: number;
  innings1: LiveInningsEngineState;
  innings2: LiveInningsEngineState | null;
  completedInnings1Summary: MatchInningsSummary | null;
  commentary: Array<{ id: number; over: string; text: string; tone: 'wicket' | 'boundary' | 'normal' }>;
  highlights: string[];
  droppedCatches: string[];
  turningPoints: string[];
  momentum: number; // -100 opponent advantage, +100 user advantage
  activeModifiers: ActiveMatchModifiers | null;
  triggeredMomentIds: string[];
  forcedNextBowlerIdx: number | null;
  finished: boolean;
}

function getBowlStyleShort(bowlingStyle: string): string {
  const s = (bowlingStyle || '').toLowerCase();
  if (!s || s === 'none' || s.includes('wicket')) return 'NON';
  if (s.includes('left-arm') && s.includes('fast')) return 'LF';
  if (s.includes('fast-medium') || s.includes('medium-fast')) return s.includes('left') ? 'LM' : 'RM';
  if (s.includes('fast')) return 'RF';
  if (s.includes('medium')) return s.includes('left') ? 'LM' : 'RM';
  if (s.includes('chinaman') || s.includes('unorthodox')) return 'LC';
  if (s.includes('orthodox') || (s.includes('left') && s.includes('spin'))) return 'SLA';
  if (s.includes('leg-break') || s.includes('leg break') || s.includes('leg-spin')) return 'LS';
  if (s.includes('off-break') || s.includes('off break') || s.includes('off-spin')) return 'OS';
  return 'OS';
}

function getPrefPositionLabel(role: string, battingRating: number): string {
  if (role === 'Batsman' || role === 'Wicketkeeper') {
    return battingRating >= 75 ? 'Top' : 'Mid';
  }
  if (role === 'All-Rounder') return 'Mid';
  return 'Low';
}

function getRoleAbbr(role: string): string {
  if (role === 'Batsman') return 'BAT';
  if (role === 'Wicketkeeper') return 'WK';
  if (role === 'All-Rounder') return 'AR';
  return 'BWL';
}

function formatOvers(balls: number, ballsPerOver: number): string {
  const ov = Math.floor(balls / ballsPerOver);
  const rem = balls % ballsPerOver;
  return `${ov}.${rem}`;
}

function createInningsState(
  battingTeam: { id: number; name: string; shortCode: string },
  bowlingTeamId: number,
  battingXI: Player[],
  bowlingXI: Player[]
): LiveInningsEngineState {
  const finalBowlers = pickBowlingAttackPool(bowlingXI);

  return {
    battingTeamId: battingTeam.id,
    battingTeamName: battingTeam.name,
    battingTeamShortCode: battingTeam.shortCode,
    bowlingTeamId,
    runs: 0,
    wickets: 0,
    balls: 0,
    batters: battingXI.map((p, idx) => ({
      player: p,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      dismissal: idx < 2 ? 'not out' : 'yet to bat',
    })),
    bowlers: finalBowlers.map((p) => ({
      player: p,
      balls: 0,
      runs: 0,
      wickets: 0,
    })),
    strikerIdx: 0,
    nonStrikerIdx: 1,
    nextBatterIdx: 2,
    currentBowlerIdx: 0,
    lastBowlerIdx: -1,
    thisOverBalls: [],
    partnershipRuns: 0,
    partnershipBalls: 0,
    last10Balls: [],
  };
}

type TacticSegmentPreset = 'Defensive' | 'Normal' | 'Rotate' | 'Aggressive' | 'Boundaries';

const TACTIC_SEGMENTS: Array<{
  id: TacticSegmentPreset;
  engineStrategy: MatchStrategy;
  hint: string;
}> = [
  { id: 'Defensive', engineStrategy: 'Defensive', hint: 'Protect wickets — tight leave discipline.' },
  { id: 'Normal', engineStrategy: 'Normal', hint: 'Balanced — no strong lean either way.' },
  { id: 'Rotate', engineStrategy: 'Normal', hint: 'Work the gaps — prioritize strike rotation.' },
  { id: 'Aggressive', engineStrategy: 'Aggressive', hint: 'Positive intent — target loose lengths.' },
  { id: 'Boundaries', engineStrategy: 'Ultra-Attacking', hint: 'Clear the ropes — maximum attacking risk.' },
];

function getBatterArchetypeLabel(p: Player): string {
  if (p.primaryRole === 'Wicketkeeper') return 'Keeper-Batter';
  if (p.primaryRole === 'All-Rounder') {
    return p.battingRating >= 75 ? 'Attacking All-Rounder' : 'Bowling All-Rounder';
  }
  if (p.primaryRole === 'Bowler') return p.battingRating >= 45 ? 'Lower-Order Hitter' : 'Tail-Ender';
  if (p.battingRating >= 84 && p.consistency >= 80) return 'Anchor & Finisher';
  if (p.battingRating >= 76) return 'Aggressive Batter';
  return 'Top-Order Batter';
}

function getBowlerArchetypeLabel(p: Player): string {
  const s = (p.bowlingStyle || '').toLowerCase();
  if (s.includes('fast')) return 'Strike Pace Bowler';
  if (s.includes('spin') || s.includes('break') || s.includes('orthodox') || s.includes('chinaman')) {
    return 'Tactical Spin Option';
  }
  return 'Seam & Variation';
}

function computeLiveWinSplit(params: {
  battingTeamId: number;
  bowlingTeamId: number;
  runs: number;
  wickets: number;
  balls: number;
  maxBalls: number;
  inningsNumber: 1 | 2;
  targetRuns: number | null;
  momentum: number;
  userTeamId: number;
}): { battingPct: number; bowlingPct: number } {
  const {
    battingTeamId,
    runs,
    wickets,
    balls,
    maxBalls,
    inningsNumber,
    targetRuns,
    momentum,
    userTeamId,
  } = params;
  const oversPlayed = Math.max(0.5, balls / 6);
  const crr = runs / oversPlayed;
  let batPct = 50;

  if (inningsNumber === 1) {
    const projected = crr * (maxBalls / 6) - wickets * 6;
    const par = maxBalls >= 250 ? 275 : maxBalls >= 120 ? 168 : 145;
    batPct = 50 + (projected - par) * 0.35 - wickets * 2.1;
  } else if (targetRuns !== null) {
    const runsNeeded = Math.max(0, targetRuns - runs);
    const ballsLeft = Math.max(1, maxBalls - balls);
    const rrr = (runsNeeded / ballsLeft) * 6;
    const wicketsInHand = Math.max(0, 10 - wickets);
    if (runsNeeded <= 0) batPct = 97;
    else if (wickets >= 10) batPct = 3;
    else {
      const rateDiff = crr - rrr;
      batPct = 52 + rateDiff * 7 + (wicketsInHand - 5) * 4.5 - (runsNeeded > ballsLeft * 2.1 ? 22 : 0);
    }
  }

  const userShift = battingTeamId === userTeamId ? momentum * 0.12 : -momentum * 0.12;
  batPct = Math.max(6, Math.min(94, Math.round(batPct + userShift)));
  return { battingPct: batPct, bowlingPct: 100 - batPct };
}

function toInningsSummary(
  inn: LiveInningsEngineState,
  ballsPerOver: number
): MatchInningsSummary {
  const batters: MatchBatterLine[] = inn.batters
    .filter((b) => b.balls > 0 || b.out || b.dismissal === 'not out')
    .map((b) => ({
      playerId: b.player.id,
      name: b.player.name,
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      dismissal: b.dismissal,
    }));

  const bowlers: MatchBowlerLine[] = inn.bowlers
    .filter((bw) => bw.balls > 0)
    .map((bw) => {
      const ov = formatOvers(bw.balls, ballsPerOver);
      const econ = bw.balls > 0 ? Number(((bw.runs / bw.balls) * ballsPerOver).toFixed(2)) : 0;
      return {
        playerId: bw.player.id,
        name: bw.player.name,
        overs: ov,
        runs: bw.runs,
        wickets: bw.wickets,
        econ,
      };
    });

  const bestBat = [...batters].sort((a, b) => b.runs - a.runs)[0];
  const bestBowl = [...bowlers].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];

  return {
    teamId: inn.battingTeamId,
    teamName: inn.battingTeamName,
    teamShortCode: inn.battingTeamShortCode,
    runs: inn.runs,
    wickets: inn.wickets,
    overs: formatOvers(inn.balls, ballsPerOver),
    topScorer: bestBat ? `${bestBat.name} ${bestBat.runs}(${bestBat.balls})` : '—',
    topBowler: bestBowl ? `${bestBowl.name} ${bestBowl.wickets}/${bestBowl.runs}` : '—',
    batters,
    bowlers,
  };
}

function stepOneBall(
  prev: LiveMatchEngineState,
  format: MatchFormatCode,
  pitchCondition: string,
  userTeamId: number,
  strategy: MatchStrategy,
  secondInningsBatTeam: { id: number; name: string; shortCode: string },
  secondInningsBatXI: Player[],
  secondInningsBowlXI: Player[],
  firstInningsBowlTeamId: number
): LiveMatchEngineState {
  if (prev.finished) return prev;

  const isInn1 = prev.inningsNumber === 1;
  const activeInnSrc = isInn1 ? prev.innings1 : prev.innings2!;
  const inn: LiveInningsEngineState = {
    ...activeInnSrc,
    batters: activeInnSrc.batters.map((b) => ({ ...b })),
    bowlers: activeInnSrc.bowlers.map((bw) => ({ ...bw })),
    thisOverBalls: [...activeInnSrc.thisOverBalls],
  };

  const { maxBowlerQuota } = getFormatParamsShared(format);
  let nextForcedBowlerIdx = prev.forcedNextBowlerIdx;
  if (inn.balls % prev.ballsPerOver === 0) {
    if (
      nextForcedBowlerIdx !== null &&
      nextForcedBowlerIdx >= 0 &&
      nextForcedBowlerIdx < inn.bowlers.length &&
      nextForcedBowlerIdx !== inn.lastBowlerIdx &&
      inn.bowlers[nextForcedBowlerIdx].balls < maxBowlerQuota
    ) {
      inn.currentBowlerIdx = nextForcedBowlerIdx;
      nextForcedBowlerIdx = null;
    } else {
      const bowlerSlots: EngineBowlerSlot[] = inn.bowlers.map((bw) => ({
        playerId: bw.player.id,
        name: bw.player.name,
        balls: bw.balls,
        runs: bw.runs,
        wickets: bw.wickets,
        bowlingRating: bw.player.bowlingRating,
        bowlingStyle: bw.player.bowlingStyle,
        primaryRole: bw.player.primaryRole,
        consistency: bw.player.consistency,
        temperament: bw.player.temperament,
        fitness: bw.player.fitness,
        stamina: bw.player.stamina,
        consecutiveMatches: bw.player.consecutiveMatches,
        traitsJson: bw.player.traitsJson,
        currentForm: bw.player.currentForm,
        morale: bw.player.morale,
      }));
      inn.currentBowlerIdx = selectNextBowlerIndex(
        bowlerSlots,
        inn.lastBowlerIdx ?? -1,
        inn.balls,
        prev.maxBallsPerInnings,
        prev.ballsPerOver,
        maxBowlerQuota,
        format,
        pitchCondition,
        Math.random
      );
      nextForcedBowlerIdx = null;
    }
  }

  const striker = inn.batters[inn.strikerIdx];
  const bowler = inn.bowlers[inn.currentBowlerIdx];
  const userIsBatting = inn.battingTeamId === userTeamId;

  const probs = computeBallProbabilities({
    batter: {
      playerId: striker.player.id,
      name: striker.player.name,
      runs: striker.runs,
      balls: striker.balls,
      battingRating: striker.player.battingRating,
      form: striker.player.currentForm,
      primaryRole: striker.player.primaryRole,
      consistency: striker.player.consistency,
      temperament: striker.player.temperament,
      fitness: striker.player.fitness,
      stamina: striker.player.stamina,
      consecutiveMatches: striker.player.consecutiveMatches,
      traitsJson: striker.player.traitsJson,
      morale: striker.player.morale,
      battingSlot: inn.strikerIdx,
    },
    bowler: {
      playerId: bowler.player.id,
      name: bowler.player.name,
      balls: bowler.balls,
      runs: bowler.runs,
      wickets: bowler.wickets,
      bowlingRating: bowler.player.bowlingRating,
      bowlingStyle: bowler.player.bowlingStyle,
      primaryRole: bowler.player.primaryRole,
      consistency: bowler.player.consistency,
      temperament: bowler.player.temperament,
      fitness: bowler.player.fitness,
      stamina: bowler.player.stamina,
      consecutiveMatches: bowler.player.consecutiveMatches,
      traitsJson: bowler.player.traitsJson,
      currentForm: bowler.player.currentForm,
      morale: bowler.player.morale,
    },
    battingStrategy: userIsBatting ? strategy : 'Normal',
    bowlingStrategy: userIsBatting ? 'Normal' : strategy,
    format,
    pitchCondition,
    ballsBowled: inn.balls,
    maxBalls: prev.maxBallsPerInnings,
    inningsNumber: prev.inningsNumber,
    runsScored: inn.runs,
    wicketsLost: inn.wickets,
    targetRuns: prev.targetRuns,
    tacticalModifiers: prev.activeModifiers,
  });

  const roll = Math.random();
  inn.balls += 1;
  striker.balls += 1;
  bowler.balls += 1;

  const overLabel = formatOvers(inn.balls, prev.ballsPerOver);
  let ballPill = '0';
  let commText = `${bowler.player.name} to ${striker.player.name}, dot ball.`;
  let tone: 'wicket' | 'boundary' | 'normal' = 'normal';
  const nextHighlights = [...prev.highlights];
  const nextDroppedCatches = [...prev.droppedCatches];
  let momentumDelta = 0;

  const c1 = probs.wicketProb + probs.dotProb;
  const c2 = c1 + probs.oneProb;
  const c3 = c2 + probs.twoProb;
  const c4 = c3 + probs.threeProb;
  const c5 = c4 + probs.fourProb;

  if (roll < probs.wicketProb) {
    const catchChance = Math.random() < 0.56;
    if (
      catchChance &&
      shouldDropCatch(
        inn.bowlers.map((b) => b.player),
        Math.random
      )
    ) {
      inn.runs += 1;
      striker.runs += 1;
      bowler.runs += 1;
      ballPill = '1';
      tone = 'boundary';
      commText = `DROPPED CATCH! ${striker.player.name} skies ${bowler.player.name} — put down in the deep! Batters scamper 1 run.`;
      nextDroppedCatches.push(
        `${inn.battingTeamShortCode} ${overLabel} ov: ${striker.player.name} dropped on ${striker.runs - 1} off ${bowler.player.name}`
      );
      nextHighlights.push(
        `DROPPED CATCH (${overLabel} ov): ${striker.player.name} given a huge life off ${bowler.player.name}`
      );
      momentumDelta = userIsBatting ? 10 : -10;
      const tmp = inn.strikerIdx;
      inn.strikerIdx = inn.nonStrikerIdx;
      inn.nonStrikerIdx = tmp;
    } else {
      inn.wickets += 1;
      bowler.wickets += 1;
      striker.out = true;
      const modes = [
        `c & b ${bowler.player.name}`,
        `b ${bowler.player.name}`,
        `lbw b ${bowler.player.name}`,
        `c Keeper b ${bowler.player.name}`,
      ];
      striker.dismissal = modes[Math.floor(Math.random() * modes.length)];
      ballPill = 'W';
      tone = 'wicket';
      commText = `WICKET! ${striker.player.name} (${striker.runs} off ${striker.balls}b) — ${striker.dismissal}!`;
      momentumDelta = userIsBatting ? -14 : 14;
      inn.partnershipRuns = 0;
      inn.partnershipBalls = 0;
      if (striker.runs >= 35 || inn.wickets <= 2) {
        nextHighlights.push(`${overLabel} ov: ${bowler.player.name} dismisses ${striker.player.name} (${striker.runs})`);
      }
      if (inn.nextBatterIdx < inn.batters.length) {
        inn.strikerIdx = inn.nextBatterIdx;
        inn.batters[inn.strikerIdx].dismissal = 'not out';
        inn.nextBatterIdx += 1;
      }
    }
  } else if (roll < c1) {
    ballPill = '0';
    commText = `${bowler.player.name} hits a tight length, ${striker.player.name} defends cleanly.`;
    momentumDelta = userIsBatting ? -1 : 1;
  } else if (roll < c2) {
    inn.runs += 1;
    striker.runs += 1;
    bowler.runs += 1;
    ballPill = '1';
    commText = `1 run, ${striker.player.name} nudges into the gap and rotates strike.`;
    const tmp = inn.strikerIdx;
    inn.strikerIdx = inn.nonStrikerIdx;
    inn.nonStrikerIdx = tmp;
  } else if (roll < c3) {
    inn.runs += 2;
    striker.runs += 2;
    bowler.runs += 2;
    ballPill = '2';
    commText = `2 runs! Hard running between the wickets by ${striker.player.name}.`;
    momentumDelta = userIsBatting ? 2 : -2;
  } else if (roll < c4) {
    inn.runs += 3;
    striker.runs += 3;
    bowler.runs += 3;
    ballPill = '3';
    commText = `3 runs! Deep outfield chase keeps ${striker.player.name} to three.`;
    momentumDelta = userIsBatting ? 3 : -3;
    const tmp = inn.strikerIdx;
    inn.strikerIdx = inn.nonStrikerIdx;
    inn.nonStrikerIdx = tmp;
  } else if (roll < c5) {
    inn.runs += 4;
    striker.runs += 4;
    striker.fours += 1;
    bowler.runs += 4;
    ballPill = '4';
    tone = 'boundary';
    commText = `BOUNDARY FOUR! Crisp timing from ${striker.player.name} past the infield.`;
    momentumDelta = userIsBatting ? 6 : -6;
  } else {
    inn.runs += 6;
    striker.runs += 6;
    striker.sixes += 1;
    bowler.runs += 6;
    ballPill = '6';
    tone = 'boundary';
    commText = `MAXIMUM SIX! ${striker.player.name} launches ${bowler.player.name} deep over the rope!`;
    momentumDelta = userIsBatting ? 9 : -9;
  }

  // Milestone highlight
  const extraComm: Array<{
    id: number;
    over: string;
    text: string;
    tone: 'wicket' | 'boundary' | 'normal';
  }> = [];
  const runsThisBall = ballPill === 'W' ? 0 : Number(ballPill) || 0;
  if (!striker.out && striker.runs >= 50 && striker.runs - runsThisBall < 50) {
    const msText = `MILESTONE! ${striker.player.name} raises his bat for a gritty half-century (${striker.runs} off ${striker.balls}b)!`;
    nextHighlights.push(`${inn.battingTeamShortCode} ${overLabel} ov: ${striker.player.name} reaches 50!`);
    extraComm.push({ id: Date.now() + Math.random() + 0.1, over: overLabel, text: msText, tone: 'boundary' });
    momentumDelta += userIsBatting ? 7 : -7;
  }
  if (!striker.out && striker.runs >= 100 && striker.runs - runsThisBall < 100) {
    const msText = `MILESTONE CENTURY! ${striker.player.name} storms to 100 (${striker.runs} off ${striker.balls}b)!`;
    nextHighlights.push(`${inn.battingTeamShortCode} ${overLabel} ov: CENTURY for ${striker.player.name}!`);
    extraComm.push({ id: Date.now() + Math.random() + 0.2, over: overLabel, text: msText, tone: 'boundary' });
    momentumDelta += userIsBatting ? 12 : -12;
  }

  let nextModifiers = prev.activeModifiers;
  if (nextModifiers && typeof nextModifiers.remainingBalls === 'number') {
    const rem = nextModifiers.remainingBalls - 1;
    nextModifiers = rem > 0 ? { ...nextModifiers, remainingBalls: rem } : null;
  }

  const nextMomentum = clampMomentum(prev.momentum + momentumDelta);

  if (ballPill !== 'W') {
    inn.partnershipRuns += runsThisBall;
    inn.partnershipBalls += 1;
  }
  inn.thisOverBalls.push(ballPill);
  inn.last10Balls = [...inn.last10Balls, ballPill === '0' ? '•' : ballPill].slice(-10);

  // End of over check
  if (inn.balls % prev.ballsPerOver === 0) {
    inn.lastBowlerIdx = inn.currentBowlerIdx;
    const tmp = inn.strikerIdx;
    inn.strikerIdx = inn.nonStrikerIdx;
    inn.nonStrikerIdx = tmp;
    inn.thisOverBalls = [];
  }

  const nextCommentary: Array<{
    id: number;
    over: string;
    text: string;
    tone: 'wicket' | 'boundary' | 'normal';
  }> = [
    ...extraComm,
    { id: Date.now() + Math.random(), over: overLabel, text: commText, tone },
    ...prev.commentary,
  ].slice(0, 50);

  const inningsEnded =
    inn.wickets >= 10 ||
    inn.balls >= prev.maxBallsPerInnings ||
    (!isInn1 && prev.targetRuns !== null && inn.runs >= prev.targetRuns);

  if (isInn1 && inningsEnded) {
    const inn1Sum = toInningsSummary(inn, prev.ballsPerOver);
    const inn2Init = createInningsState(
      secondInningsBatTeam,
      firstInningsBowlTeamId,
      secondInningsBatXI,
      secondInningsBowlXI
    );
    return {
      ...prev,
      inningsNumber: 2,
      targetRuns: inn.runs + 1,
      innings1: inn,
      innings2: inn2Init,
      completedInnings1Summary: inn1Sum,
      droppedCatches: nextDroppedCatches,
      momentum: nextMomentum,
      activeModifiers: null,
      forcedNextBowlerIdx: null,
      commentary: [
        {
          id: Date.now() + 99,
          over: 'BRK',
          text: `INNINGS BREAK: ${inn.battingTeamShortCode} finished ${inn.runs}/${inn.wickets} (${overLabel} ov). ${secondInningsBatTeam.shortCode} need ${inn.runs + 1} to win.`,
          tone: 'boundary' as const,
        },
        ...nextCommentary,
      ].slice(0, 50),
      highlights: [
        `${inn.battingTeamShortCode} posted ${inn.runs}/${inn.wickets} (${overLabel} ov)`,
        ...nextHighlights,
      ].slice(0, 10),
    };
  }

  if (!isInn1 && inningsEnded) {
    return {
      ...prev,
      innings2: inn,
      droppedCatches: nextDroppedCatches,
      momentum: nextMomentum,
      activeModifiers: nextModifiers,
      forcedNextBowlerIdx: nextForcedBowlerIdx,
      commentary: nextCommentary,
      highlights: nextHighlights.slice(0, 10),
      finished: true,
    };
  }

  return isInn1
    ? {
        ...prev,
        innings1: inn,
        droppedCatches: nextDroppedCatches,
        momentum: nextMomentum,
        activeModifiers: nextModifiers,
        forcedNextBowlerIdx: nextForcedBowlerIdx,
        commentary: nextCommentary,
        highlights: nextHighlights.slice(0, 10),
      }
    : {
        ...prev,
        innings2: inn,
        droppedCatches: nextDroppedCatches,
        momentum: nextMomentum,
        activeModifiers: nextModifiers,
        forcedNextBowlerIdx: nextForcedBowlerIdx,
        commentary: nextCommentary,
        highlights: nextHighlights.slice(0, 10),
      };
}

export function MatchdayView({
  state,
  onNavigate,
  onRefreshState,
  onToast,
}: {
  state: LeagueStateSnapshot;
  onNavigate: (tab: ActiveTab) => void;
  onRefreshState: () => Promise<void>;
  onToast: (t: {
    tone: 'success' | 'error' | 'info' | 'warning';
    title: string;
    body?: string;
  }) => void;
}) {
  const myTeam = state.myTeam;
  const opponents = useMemo(
    () => state.teams.filter((t) => t.id !== myTeam?.id),
    [state.teams, myTeam?.id]
  );

  const teamById = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);
  const fixturesList = state.fixtures || [];
  const standingsList = state.standings || [];

  const [hubView, setHubView] = useState<MatchHubView>(() =>
    fixturesList.some(
      (fx) =>
        myTeam &&
        (fx.homeTeamId === myTeam.id || fx.awayTeamId === myTeam.id) &&
        (fx.status === 'live' || fx.status === 'paused' || fx.status === 'lobby')
    )
      ? 'pvp'
      : fixturesList.length > 0
        ? 'schedule'
        : 'match'
  );
  const [scheduleFilter, setScheduleFilter] = useState<'mine' | 'all' | 'playoffs'>('mine');
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | null>(null);
  const [activePvpFixtureId, setActivePvpFixtureId] = useState<number | null>(() => {
    const liveMine = fixturesList.find(
      (fx) =>
        myTeam &&
        (fx.homeTeamId === myTeam.id || fx.awayTeamId === myTeam.id) &&
        (fx.status === 'live' || fx.status === 'paused' || fx.status === 'lobby')
    );
    return liveMine ? liveMine.id : null;
  });
  const [pvpBusy, setPvpBusy] = useState(false);

  // Live 10-minute Game Day clock
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const dayDurationSec = Math.max(60, state.league.dayDurationSec || 600);
  const { currentGameDay, nextDayInSec } = useMemo(() => {
    if (!state.league.seasonStartedAt) {
      return {
        currentGameDay: state.currentGameDay || 1,
        nextDayInSec: state.nextDayInSec || dayDurationSec,
      };
    }
    const startMs = new Date(state.league.seasonStartedAt).getTime();
    if (!Number.isFinite(startMs)) {
      return {
        currentGameDay: state.currentGameDay || 1,
        nextDayInSec: state.nextDayInSec || dayDurationSec,
      };
    }
    const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    return {
      currentGameDay: Math.floor(elapsedSec / dayDurationSec) + 1,
      nextDayInSec: dayDurationSec - (elapsedSec % dayDurationSec),
    };
  }, [nowMs, state.league.seasonStartedAt, dayDurationSec, state.currentGameDay, state.nextDayInSec]);

  const countdownLabel = `${String(Math.floor(nextDayInSec / 60)).padStart(2, '0')}:${String(
    nextDayInSec % 60
  ).padStart(2, '0')}`;

  const allowedFormats = useMemo(
    () => getLeagueFormats(myTeam?.leagueCategory, state.league.primaryCompetition),
    [myTeam?.leagueCategory, state.league.primaryCompetition]
  );

  const defaultCpuOpponent = useMemo(
    () => opponents.find((t) => !t.ownerUid) || opponents[0],
    [opponents]
  );

  const [awayTeamId, setAwayTeamId] = useState<number>(() => defaultCpuOpponent?.id || 0);
  const [format, setFormat] = useState<MatchFormatCode>(allowedFormats[0] || 'T20');
  const [stage, setStage] = useState<MatchStage>('lineup');

  const [preview, setPreview] = useState<MatchPreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Editable Playing XI IDs + Roles for Home team in Stage 1
  const [homeLineupIds, setHomeLineupIds] = useState<number[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [wicketkeeperId, setWicketkeeperId] = useState<number | null>(null);
  const [swapSourceId, setSwapSourceId] = useState<number | null>(null);
  const [dragPlayerId, setDragPlayerId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [spotlightPlayer, setSpotlightPlayer] = useState<Player | null>(null);

  // Automatic Toss State for Stage 3
  const [coinOutcome, setCoinOutcome] = useState<'heads' | 'tails' | null>(null);
  const [tossWinnerTeamId, setTossWinnerTeamId] = useState<number | null>(null);
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl'>('bat');
  const [flipping, setFlipping] = useState(false);

  // Interactive Live Simulation State for Stage 4
  const [simState, setSimState] = useState<LiveMatchEngineState | null>(null);
  const [simPace, setSimPace] = useState<SimPace>('medium');
  const [simPaused, setSimPaused] = useState(false);
  const [strategy, setStrategy] = useState<MatchStrategy>('Normal');
  const [tacticPreset, setTacticPreset] = useState<TacticSegmentPreset>('Normal');
  const [partnerTacticPreset, setPartnerTacticPreset] = useState<TacticSegmentPreset>('Normal');
  const [simRightTab, setSimRightTab] = useState<'tactics' | 'commentary'>('tactics');
  const [savingSim, setSavingSim] = useState(false);
  const [activeKeyMoment, setActiveKeyMoment] = useState<KeyMomentDilemma | null>(null);

  // Completed Scorecard & Press Conference State
  const [completedMatch, setCompletedMatch] = useState<MatchRecord | null>(null);
  const [activeScorecardInnings, setActiveScorecardInnings] = useState<1 | 2>(1);
  const [pressModalMatch, setPressModalMatch] = useState<MatchRecord | null>(null);
  const [voteSkipBusyId, setVoteSkipBusyId] = useState<number | null>(null);

  const savedSimTriggeredRef = useRef(false);

  useEffect(() => {
    if (!allowedFormats.includes(format)) {
      setFormat(allowedFormats[0]);
    }
  }, [allowedFormats, format]);

  useEffect(() => {
    if ((!awayTeamId || awayTeamId === myTeam?.id) && opponents.length > 0) {
      setAwayTeamId(opponents[0].id);
    }
  }, [awayTeamId, myTeam?.id, opponents]);

  const fetchPreview = useCallback(async () => {
    if (!myTeam || !awayTeamId || myTeam.id === awayTeamId) return;
    setLoadingPreview(true);
    try {
      const [previewRes, squadRes] = await Promise.all([
        apiFetch<MatchPreviewData>(
          `/api/leagues/${state.league.id}/matches/preview?homeTeamId=${myTeam.id}&awayTeamId=${awayTeamId}&format=${format}`
        ),
        apiFetch<{ lineups: Lineup[] }>(
          `/api/leagues/${state.league.id}/teams/${myTeam.id}/squad`
        ).catch(() => ({ lineups: [] })),
      ]);

      setPreview(previewRes);
      const ids = previewRes.homeXI.map((p) => p.id);
      setHomeLineupIds(ids);

      const savedLineup = (squadRes.lineups || []).find((l) => l.format === format);
      setCaptainId(
        savedLineup?.captainPlayerId && ids.includes(savedLineup.captainPlayerId)
          ? savedLineup.captainPlayerId
          : ids[0] ?? null
      );
      const naturalWkInXI = previewRes.homeXI.find((p) => p.primaryRole === 'Wicketkeeper');
      if (savedLineup?.wicketkeeperPlayerId) {
        const matchWk = previewRes.homeXI.find(
          (p) => p.id === savedLineup.wicketkeeperPlayerId && p.primaryRole === 'Wicketkeeper'
        );
        setWicketkeeperId(matchWk?.id ?? naturalWkInXI?.id ?? null);
      } else {
        setWicketkeeperId(naturalWkInXI?.id ?? null);
      }
      setSpotlightPlayer(previewRes.homeXI[0] || null);
      setSwapSourceId(null);
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Preview unavailable', body: err.message });
    } finally {
      setLoadingPreview(false);
    }
  }, [state.league.id, myTeam?.id, awayTeamId, format, onToast]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  // Derived editable Home XI + Dropped players
  const squadMap = useMemo(() => {
    const map = new Map<number, Player>();
    if (preview) {
      for (const p of preview.homeSquadAll) map.set(p.id, p);
      for (const p of preview.homeXI) map.set(p.id, p);
    }
    return map;
  }, [preview]);

  const activeHomeXI = useMemo(
    () => homeLineupIds.map((id) => squadMap.get(id)).filter((p): p is Player => Boolean(p)),
    [homeLineupIds, squadMap]
  );

  const droppedReserves = useMemo(() => {
    if (!preview) return [];
    const selectedSet = new Set(homeLineupIds);
    return preview.homeSquadAll.filter((p) => !selectedSet.has(p.id));
  }, [preview, homeLineupIds]);

  const persistHomeLineup = async (
    nextIds: number[],
    nextCap: number | null,
    nextWk: number | null
  ) => {
    if (!myTeam) return;
    try {
      await apiFetch(`/api/leagues/${state.league.id}/teams/${myTeam.id}/lineup`, {
        method: 'PUT',
        body: JSON.stringify({
          format,
          battingOrder: nextIds,
          captainPlayerId: nextCap,
          viceCaptainPlayerId: nextIds[1] ?? null,
          wicketkeeperPlayerId: nextWk,
        }),
      });
    } catch {
      // Allow exhibition changes locally even if squad size varies
    }
  };

  const liveHomeRatings = useMemo(() => {
    if (activeHomeXI.length === 0) return preview?.homeRatings || { bat: 68, bowl: 68, field: 68, overall: 68 };
    const bat = Math.round(
      activeHomeXI.slice(0, 7).reduce((s, p) => s + p.battingRating, 0) / Math.min(7, activeHomeXI.length)
    );
    const bowlSorted = [...activeHomeXI].sort((a, b) => b.bowlingRating - a.bowlingRating).slice(0, 5);
    const bowl = Math.round(
      bowlSorted.reduce((s, p) => s + p.bowlingRating, 0) / Math.max(1, bowlSorted.length)
    );
    const field = Math.round(
      activeHomeXI.reduce((s, p) => s + p.fieldingRating, 0) / activeHomeXI.length
    );
    const overall = Math.round(
      activeHomeXI.reduce((s, p) => s + getPlayerOverall(p), 0) / activeHomeXI.length
    );
    return { bat, bowl, field, overall };
  }, [activeHomeXI, preview?.homeRatings]);

  const liveWinChance = useMemo(() => {
    if (!preview) return { homePct: 48, tiePct: 4, awayPct: 48 };
    const tiePct = format === 'Test' ? 14 : 4;
    const diff = liveHomeRatings.overall - preview.awayRatings.overall;
    const rawHome = Math.round(50 + diff * 2.1);
    const clampedHome = Math.max(18, Math.min(82 - tiePct, rawHome));
    const awayPct = 100 - tiePct - clampedHome;
    return { homePct: clampedHome, tiePct, awayPct };
  }, [liveHomeRatings.overall, preview, format]);

  const handleToggleSwap = (player: Player) => {
    setSpotlightPlayer(player);
    const inXI = homeLineupIds.includes(player.id);
    if (inXI) {
      setSwapSourceId((prev) => (prev === player.id ? null : player.id));
    } else if (swapSourceId && homeLineupIds.includes(swapSourceId)) {
      const nextIds = homeLineupIds.map((id) => (id === swapSourceId ? player.id : id));
      const nextCap = captainId === swapSourceId ? player.id : captainId;
      const nextWk =
        wicketkeeperId === swapSourceId
          ? player.primaryRole === 'Wicketkeeper'
            ? player.id
            : null
          : wicketkeeperId;
      setHomeLineupIds(nextIds);
      setCaptainId(nextCap);
      setWicketkeeperId(nextWk);
      setSwapSourceId(null);
      void persistHomeLineup(nextIds, nextCap, nextWk);
    } else if (homeLineupIds.length < 11) {
      const nextIds = [...homeLineupIds, player.id];
      const nextCap = captainId ?? player.id;
      const nextWk =
        wicketkeeperId ?? (player.primaryRole === 'Wicketkeeper' ? player.id : null);
      setHomeLineupIds(nextIds);
      setCaptainId(nextCap);
      setWicketkeeperId(nextWk);
      void persistHomeLineup(nextIds, nextCap, nextWk);
    } else {
      onToast({
        tone: 'info',
        title: 'Playing XI Full (11/11)',
        body: 'Drag a reserve player onto any XI row, or click Swap first.',
      });
    }
  };

  const handleDropOnXI = (targetPlayerId: number) => {
    if (!dragPlayerId || dragPlayerId === targetPlayerId) {
      setDragPlayerId(null);
      setDragOverId(null);
      return;
    }

    const fromIdx = homeLineupIds.indexOf(dragPlayerId);
    const toIdx = homeLineupIds.indexOf(targetPlayerId);

    if (fromIdx !== -1 && toIdx !== -1) {
      const nextIds = [...homeLineupIds];
      const [moved] = nextIds.splice(fromIdx, 1);
      nextIds.splice(toIdx, 0, moved);
      setHomeLineupIds(nextIds);
      setDragPlayerId(null);
      setDragOverId(null);
      void persistHomeLineup(nextIds, captainId, wicketkeeperId);
      return;
    }

    if (fromIdx === -1 && toIdx !== -1) {
      const nextIds = homeLineupIds.map((id) => (id === targetPlayerId ? dragPlayerId : id));
      const incoming = squadMap.get(dragPlayerId);
      const nextCap = captainId === targetPlayerId ? dragPlayerId : captainId;
      const nextWk =
        wicketkeeperId === targetPlayerId
          ? incoming?.primaryRole === 'Wicketkeeper'
            ? dragPlayerId
            : null
          : wicketkeeperId;
      setHomeLineupIds(nextIds);
      setCaptainId(nextCap);
      setWicketkeeperId(nextWk);
      setDragPlayerId(null);
      setDragOverId(null);
      void persistHomeLineup(nextIds, nextCap, nextWk);
      return;
    }

    setDragPlayerId(null);
    setDragOverId(null);
  };

  const moveHomeOrder = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= homeLineupIds.length) return;
    const copy = [...homeLineupIds];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setHomeLineupIds(copy);
    void persistHomeLineup(copy, captainId, wicketkeeperId);
  };

  const handleAssignCaptain = (playerId: number) => {
    setCaptainId(playerId);
    void persistHomeLineup(homeLineupIds, playerId, wicketkeeperId);
    const name = squadMap.get(playerId)?.name || 'Player';
    onToast({ tone: 'success', title: `${name} named Captain (C)` });
  };

  const handleAssignWk = (player: Player) => {
    if (player.primaryRole !== 'Wicketkeeper') {
      onToast({
        tone: 'error',
        title: 'Natural Wicketkeeper Required',
        body: `${player.name} is a ${player.primaryRole}. Only natural Wicketkeepers can keep wicket.`,
      });
      return;
    }
    setWicketkeeperId(player.id);
    void persistHomeLineup(homeLineupIds, captainId, player.id);
    onToast({ tone: 'success', title: `${player.name} assigned Wicketkeeper (WK)` });
  };

  const handleAutoPickBalanced = () => {
    if (!preview) return;
    const all = [...preview.homeSquadAll].sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a));
    const wk = all.find((p) => p.primaryRole === 'Wicketkeeper');
    const bowlers = all.filter((p) => p.primaryRole === 'Bowler').slice(0, 4);
    const chosen: Player[] = [];
    if (wk) chosen.push(wk);
    for (const b of bowlers) {
      if (!chosen.some((c) => c.id === b.id)) chosen.push(b);
    }
    for (const p of all) {
      if (chosen.length >= 11) break;
      if (!chosen.some((c) => c.id === p.id)) chosen.push(p);
    }
    const rank: Record<string, number> = { Batsman: 1, Wicketkeeper: 2, 'All-Rounder': 3, Bowler: 4 };
    chosen.sort((a, b) => (rank[a.primaryRole] ?? 5) - (rank[b.primaryRole] ?? 5));
    const ids = chosen.map((p) => p.id);
    const nextCap = ids[0] ?? null;
    const nextWk = wk?.id ?? null;
    setHomeLineupIds(ids);
    setCaptainId(nextCap);
    setWicketkeeperId(nextWk);
    setSpotlightPlayer(chosen[0] || null);
    setSwapSourceId(null);
    void persistHomeLineup(ids, nextCap, nextWk);
  };

  // Automatic coin toss whenever entering Stage 3 (no heads/tails manual picker!)
  const runAutoToss = useCallback(() => {
    if (!preview || !myTeam) return;
    setFlipping(true);
    setCoinOutcome(null);
    setTossWinnerTeamId(null);
    setCompletedMatch(null);
    setSimState(null);
    savedSimTriggeredRef.current = false;

    setTimeout(() => {
      const coin: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
      const homeWon = Math.random() < 0.5;
      const winnerId = homeWon ? preview.homeTeam.id : preview.awayTeam.id;
      const pLower = preview.pitchCondition.toLowerCase();
      const batFirst =
        format === 'Test'
          ? !pLower.includes('green')
          : pLower.includes('flat') || pLower.includes('dry') || Math.random() < 0.48;
      setCoinOutcome(coin);
      setTossWinnerTeamId(winnerId);
      setTossDecision(batFirst ? 'bat' : 'bowl');
      setFlipping(false);
    }, 650);
  }, [preview, myTeam, format]);

  const enterTossStage = () => {
    setStage('toss');
    runAutoToss();
  };

  // Resolve batting order for Innings 1 & Innings 2 after auto toss
  const inningsOrderTeams = useMemo(() => {
    if (!preview || !tossWinnerTeamId) return null;
    const homeWonToss = tossWinnerTeamId === preview.homeTeam.id;
    const homeBatsFirst =
      (homeWonToss && tossDecision === 'bat') || (!homeWonToss && tossDecision === 'bowl');

    const firstBatTeam = homeBatsFirst ? preview.homeTeam : preview.awayTeam;
    const firstBatXI = homeBatsFirst ? activeHomeXI : preview.awayXI;
    const firstBowlTeam = homeBatsFirst ? preview.awayTeam : preview.homeTeam;
    const firstBowlXI = homeBatsFirst ? preview.awayXI : activeHomeXI;

    return {
      firstBatTeam,
      firstBatXI,
      firstBowlTeam,
      firstBowlXI,
    };
  }, [preview, tossWinnerTeamId, tossDecision, activeHomeXI]);

  const launchLiveSimulation = () => {
    if (!preview || !inningsOrderTeams) return;
    const ballsPerOver = format === 'Hundred' ? 5 : 6;
    const maxBallsPerInnings =
      format === 'Hundred' ? 100 : format === 'ODI' ? 300 : format === 'Test' ? 360 : 120;

    const inn1 = createInningsState(
      inningsOrderTeams.firstBatTeam,
      inningsOrderTeams.firstBowlTeam.id,
      inningsOrderTeams.firstBatXI,
      inningsOrderTeams.firstBowlXI
    );

    savedSimTriggeredRef.current = false;
    setSimPaused(false);
    setActiveKeyMoment(null);
    setStrategy('Normal');
    setTacticPreset('Normal');
    setPartnerTacticPreset('Normal');
    setSimRightTab('tactics');
    setCompletedMatch(null);
    setSimState({
      inningsNumber: 1,
      targetRuns: null,
      maxBallsPerInnings,
      ballsPerOver,
      innings1: inn1,
      innings2: null,
      completedInnings1Summary: null,
      commentary: [
        {
          id: Date.now(),
          over: '0.0',
          text: `Players take the field at ${preview.venue}. ${inningsOrderTeams.firstBatTeam.name} open the batting against ${inningsOrderTeams.firstBowlTeam.name}.`,
          tone: 'boundary',
        },
      ],
      highlights: [],
      droppedCatches: [],
      turningPoints: [],
      momentum: 0,
      activeModifiers: null,
      triggeredMomentIds: [],
      forcedNextBowlerIdx: null,
      finished: false,
    });
    setStage('sim');
  };

  // Interactive ball-by-ball simulation tick
  useEffect(() => {
    if (
      stage !== 'sim' ||
      !simState ||
      simState.finished ||
      simPaused ||
      activeKeyMoment ||
      !preview ||
      !inningsOrderTeams ||
      !myTeam
    ) {
      return;
    }

    const delayMs = simPace === 'slow' ? 1200 : simPace === 'medium' ? 520 : 110;
    const timer = setInterval(() => {
      setSimState((prev) => {
        if (!prev || prev.finished) return prev;
        return stepOneBall(
          prev,
          format,
          preview.pitchCondition,
          myTeam.id,
          strategy,
          inningsOrderTeams.firstBowlTeam,
          inningsOrderTeams.firstBowlXI,
          inningsOrderTeams.firstBatXI,
          inningsOrderTeams.firstBatTeam.id
        );
      });
    }, delayMs);

    return () => clearInterval(timer);
  }, [
    stage,
    simState?.finished,
    simPaused,
    activeKeyMoment,
    simPace,
    strategy,
    format,
    preview,
    inningsOrderTeams,
    myTeam,
  ]);

  // Detect 2-3 high-leverage Key Moments during human-controlled live matches
  useEffect(() => {
    if (
      stage !== 'sim' ||
      !simState ||
      simState.finished ||
      simPaused ||
      activeKeyMoment ||
      !preview ||
      !myTeam
    ) {
      return;
    }

    const liveInn = simState.inningsNumber === 1 ? simState.innings1 : simState.innings2;
    if (!liveInn) return;

    const maxBalls = simState.maxBallsPerInnings;
    const bpo = simState.ballsPerOver;
    const ppEnd = Math.round(maxBalls * 0.3);
    const midStart = Math.round(maxBalls * 0.42);
    const midEnd = Math.round(maxBalls * 0.68);
    const deathStart = Math.max(bpo * 2, maxBalls - bpo * 3);

    let trigger: 'powerplay_collapse' | 'partnership_threat' | 'death_finish' | null = null;
    if (
      liveInn.balls >= bpo &&
      liveInn.balls <= ppEnd &&
      liveInn.wickets >= 2 &&
      !simState.triggeredMomentIds.includes('powerplay_collapse')
    ) {
      trigger = 'powerplay_collapse';
    } else if (
      liveInn.balls >= midStart &&
      liveInn.balls <= midEnd &&
      !simState.triggeredMomentIds.includes('partnership_threat')
    ) {
      trigger = 'partnership_threat';
    } else if (
      liveInn.balls >= deathStart &&
      liveInn.balls < maxBalls - 3 &&
      !simState.triggeredMomentIds.includes('death_finish')
    ) {
      trigger = 'death_finish';
    }

    if (!trigger) return;

    const striker = liveInn.batters[liveInn.strikerIdx]?.player.name || 'Batter';
    const bowler = liveInn.bowlers[liveInn.currentBowlerIdx]?.player.name || 'Bowler';
    const runsNeeded =
      simState.targetRuns !== null ? Math.max(0, simState.targetRuns - liveInn.runs) : null;
    const ballsRemaining = Math.max(0, maxBalls - liveInn.balls);

    const dilemma = buildKeyMomentDilemma({
      trigger,
      overLabel: formatOvers(liveInn.balls, bpo),
      userIsBatting: liveInn.battingTeamId === myTeam.id,
      battingShortCode: liveInn.battingTeamShortCode,
      bowlingShortCode:
        liveInn.battingTeamId === preview.homeTeam.id
          ? preview.awayTeam.shortCode
          : preview.homeTeam.shortCode,
      strikerName: striker,
      bowlerName: bowler,
      runs: liveInn.runs,
      wickets: liveInn.wickets,
      runsNeeded,
      ballsRemaining,
    });

    setSimPaused(true);
    setActiveKeyMoment({ ...dilemma, id: trigger });
  }, [stage, simState, simPaused, activeKeyMoment, preview, myTeam]);

  const handleSelectKeyMomentChoice = (choice: KeyMomentChoice) => {
    if (!activeKeyMoment || !simState) return;
    const triggerKey = activeKeyMoment.id;
    const { maxBowlerQuota } = getFormatParamsShared(format);

    setSimState((prev) => {
      if (!prev) return prev;
      const isInn1 = prev.inningsNumber === 1;
      const activeInnSrc = isInn1 ? prev.innings1 : prev.innings2!;
      const inn: LiveInningsEngineState = {
        ...activeInnSrc,
        batters: activeInnSrc.batters.map((b) => ({ ...b })),
        bowlers: activeInnSrc.bowlers.map((bw) => ({ ...bw })),
      };

      let tacticalExtraNote = '';
      if (choice.promotePinchHitter && inn.nextBatterIdx < inn.batters.length) {
        let bestIdx = inn.nextBatterIdx;
        for (let i = inn.nextBatterIdx + 1; i < inn.batters.length; i++) {
          if (inn.batters[i].player.battingRating > inn.batters[bestIdx].player.battingRating) {
            bestIdx = i;
          }
        }
        if (bestIdx !== inn.nextBatterIdx) {
          const tmp = inn.batters[inn.nextBatterIdx];
          inn.batters[inn.nextBatterIdx] = inn.batters[bestIdx];
          inn.batters[bestIdx] = tmp;
          tacticalExtraNote = ` (${inn.batters[inn.nextBatterIdx].player.name} padded up at next)`;
        }
      }

      let nextForcedBowlerIdx = prev.forcedNextBowlerIdx;
      if (choice.bringStrikeBowler) {
        let bestBowlIdx = -1;
        let bestRating = -1;
        inn.bowlers.forEach((bw, idx) => {
          if (idx !== inn.lastBowlerIdx && bw.balls < maxBowlerQuota && bw.player.bowlingRating > bestRating) {
            bestRating = bw.player.bowlingRating;
            bestBowlIdx = idx;
          }
        });
        if (bestBowlIdx !== -1) {
          nextForcedBowlerIdx = bestBowlIdx;
          tacticalExtraNote = ` (${inn.bowlers[bestBowlIdx].player.name} summoned for next over)`;
        }
      }

      const nextMomentum = clampMomentum(prev.momentum + (choice.momentumShift || 0));
      const overLabel = formatOvers(inn.balls, prev.ballsPerOver);
      const tpText = `${overLabel} ov: Tactical Call — ${choice.label}${tacticalExtraNote}`;

      return {
        ...prev,
        innings1: isInn1 ? inn : prev.innings1,
        innings2: isInn1 ? prev.innings2 : inn,
        momentum: nextMomentum,
        triggeredMomentIds: [...prev.triggeredMomentIds, triggerKey],
        forcedNextBowlerIdx: nextForcedBowlerIdx,
        turningPoints: [...prev.turningPoints, tpText],
        activeModifiers: {
          wicketMultDelta: choice.wicketMultDelta || 0,
          boundaryShiftDelta: choice.boundaryShiftDelta || 0,
          dotShiftDelta: choice.dotShiftDelta || 0,
          remainingBalls: 18,
          label: choice.label,
        },
        commentary: [
          {
            id: Date.now() + Math.random(),
            over: overLabel,
            text: `KEY MOMENT CALL: ${choice.label}${tacticalExtraNote}`,
            tone: 'boundary' as const,
          },
          ...prev.commentary,
        ].slice(0, 50),
      };
    });

    setActiveKeyMoment(null);
    setSimPaused(false);
  };

  const handleFinishInstant = () => {
    if (!simState || simState.finished || !preview || !inningsOrderTeams || !myTeam) return;
    let cursor = simState;
    let guard = 0;
    while (!cursor.finished && guard < 900) {
      cursor = stepOneBall(
        cursor,
        format,
        preview.pitchCondition,
        myTeam.id,
        strategy,
        inningsOrderTeams.firstBowlTeam,
        inningsOrderTeams.firstBowlXI,
        inningsOrderTeams.firstBatXI,
        inningsOrderTeams.firstBatTeam.id
      );
      guard++;
    }
    setSimState(cursor);
  };

  // Save completed live match to Cloud SQL PostgreSQL automatically when Innings 2 ends
  useEffect(() => {
    if (
      stage !== 'sim' ||
      !simState?.finished ||
      !simState.innings2 ||
      !preview ||
      !myTeam ||
      !tossWinnerTeamId ||
      savedSimTriggeredRef.current
    ) {
      return;
    }

    savedSimTriggeredRef.current = true;
    setSavingSim(true);

    const inn1Summary =
      simState.completedInnings1Summary || toInningsSummary(simState.innings1, simState.ballsPerOver);
    const inn2Summary = toInningsSummary(simState.innings2, simState.ballsPerOver);

    let winnerTeamId: number | null = null;
    let marginText = '';

    if (inn1Summary.runs > inn2Summary.runs) {
      winnerTeamId = inn1Summary.teamId;
      marginText = `${inn1Summary.teamName} won by ${inn1Summary.runs - inn2Summary.runs} runs`;
    } else if (inn2Summary.runs > inn1Summary.runs) {
      winnerTeamId = inn2Summary.teamId;
      const wktsLeft = Math.max(1, 10 - inn2Summary.wickets);
      marginText = `${inn2Summary.teamName} won by ${wktsLeft} wickets`;
    } else {
      marginText = 'Match Tied';
    }

    // Pick Man of the Match
    const allBats = [...inn1Summary.batters, ...inn2Summary.batters];
    const allBowls = [...inn1Summary.bowlers, ...inn2Summary.bowlers];
    let motm = inn1Summary.topScorer.split(' ')[0] || 'Star Performer';
    let bestScore = -1;
    for (const b of allBats) {
      const val = b.runs + b.sixes * 2;
      if (val > bestScore) {
        bestScore = val;
        motm = `${b.name} (${b.runs} runs)`;
      }
    }
    for (const bw of allBowls) {
      const val = bw.wickets * 24 - Math.round(bw.runs * 0.3);
      if (val > bestScore) {
        bestScore = val;
        motm = `${bw.name} (${bw.wickets}/${bw.runs})`;
      }
    }

    const completedSummary: MatchResultSummary = {
      tossWinnerTeamId,
      tossDecision,
      coinResult: coinOutcome || 'heads',
      userCall: coinOutcome || 'heads',
      innings1: inn1Summary,
      innings2: inn2Summary,
      winnerTeamId,
      marginText,
      manOfTheMatch: motm,
      venue: preview.venue,
      pitchCondition: preview.pitchCondition,
      highlights: simState.highlights.length > 0 ? simState.highlights : [marginText],
      droppedCatches: simState.droppedCatches,
      turningPoints: simState.turningPoints,
    };

    apiFetch<{ match: MatchRecord }>(`/api/leagues/${state.league.id}/matches/play`, {
      method: 'POST',
      body: JSON.stringify({
        homeTeamId: myTeam.id,
        awayTeamId: preview.awayTeam.id,
        fixtureId: selectedFixtureId || undefined,
        format,
        homeLineupIds,
        userCall: coinOutcome || 'heads',
        userDecisionIfWon: tossDecision,
        completedSummary,
      }),
    })
      .then(async (res) => {
        setCompletedMatch(res.match);
        setActiveScorecardInnings(1);
        setSelectedFixtureId(null);
        await Promise.all([onRefreshState(), fetchPreview()]);
        onToast({
          tone: 'success',
          title: `${myTeam.shortCode} vs ${preview.awayTeam.shortCode} Completed`,
          body: `${res.match.marginText} · Press conference compiling in Gazette.`,
        });
      })
      .catch((err: any) => {
        onToast({ tone: 'error', title: 'Could not archive scorecard', body: err.message });
      })
      .finally(() => {
        setSavingSim(false);
      });
  }, [stage, simState?.finished, preview, myTeam, tossWinnerTeamId, tossDecision, coinOutcome, format, homeLineupIds, selectedFixtureId, state.league.id, onRefreshState, fetchPreview, onToast]);

  // Keyboard navigation for Lineup & Compare stages
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (hubView !== 'match' || (stage !== 'lineup' && stage !== 'compare')) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (activeHomeXI.length === 0) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const curIdx = spotlightPlayer
          ? activeHomeXI.findIndex((p) => p.id === spotlightPlayer.id)
          : -1;
        const nextIdx =
          e.key === 'ArrowDown'
            ? (curIdx + 1) % activeHomeXI.length
            : (curIdx - 1 + activeHomeXI.length) % activeHomeXI.length;
        setSpotlightPlayer(activeHomeXI[nextIdx]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hubView, stage, activeHomeXI, spotlightPlayer]);

  if (!myTeam) {
    return (
      <div className="cm27-panel p-10 text-center space-y-4 cm27-view-enter">
        <Swords className="w-10 h-10 text-[#EAB308] mx-auto" />
        <h1 className="font-condensed text-3xl font-extrabold uppercase text-white">
          Claim a Club to Play Matches
        </h1>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Select a club in the Teams hub to customize your Playing XI, compare lineups against league rivals, and play ball-by-ball matches.
        </p>
        <button
          onClick={() => onNavigate('franchises')}
          className="cm27-btn-3d px-5 py-2.5 rounded font-bold text-xs uppercase tracking-wider cursor-pointer"
        >
          Browse &amp; Claim Club →
        </button>
      </div>
    );
  }

  const recentMatches = state.matches || [];
  const activeSummary: MatchResultSummary | null = completedMatch?.resultSummaryJson || null;
  const displayedPlayer = spotlightPlayer || activeHomeXI[0] || preview?.awayXI[0] || null;
  const userWonToss = Boolean(tossWinnerTeamId && tossWinnerTeamId === myTeam.id);

  const renderFormatBadgeClass = () => {
    if (format === 'Test') return 'bg-gradient-to-b from-[#DC2626] to-[#991B1B] text-white border-rose-400/50';
    if (format === 'ODI') return 'bg-gradient-to-b from-[#0284C7] to-[#075985] text-white border-sky-400/50';
    if (format === 'Hundred') return 'bg-gradient-to-b from-[#7C3AED] to-[#4C1D95] text-white border-violet-400/50';
    return 'bg-gradient-to-b from-[#16A34A] to-[#14532D] text-white border-emerald-400/50';
  };

  const activePvpFixture = useMemo(
    () => fixturesList.find((fx) => fx.id === activePvpFixtureId) || null,
    [fixturesList, activePvpFixtureId]
  );

  const selectedOpponent = useMemo(
    () => teamById.get(awayTeamId) || null,
    [teamById, awayTeamId]
  );
  const selectedOpponentIsHuman = Boolean(selectedOpponent?.ownerUid);

  const myLiveOrNextPvpFixture = useMemo(() => {
    if (!myTeam) return null;
    return (
      fixturesList.find((fx) => {
        if (fx.status === 'completed') return false;
        const h = teamById.get(fx.homeTeamId);
        const a = teamById.get(fx.awayTeamId);
        const isMine = fx.homeTeamId === myTeam.id || fx.awayTeamId === myTeam.id;
        return Boolean(isMine && h?.ownerUid && a?.ownerUid);
      }) || null
    );
  }, [fixturesList, myTeam, teamById]);

  const enterPvpFixtureRoom = async (fx: LeagueFixture) => {
    setPvpBusy(true);
    try {
      await apiFetch(`/api/leagues/${state.league.id}/fixtures/${fx.id}/enter`, {
        method: 'POST',
      });
      setActivePvpFixtureId(fx.id);
      setHubView('pvp');
      await onRefreshState();
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Could not enter PvP Room', body: err.message });
    } finally {
      setPvpBusy(false);
    }
  };

  const handlePvpToggleReady = async (fx: LeagueFixture, nextReady: boolean) => {
    setPvpBusy(true);
    try {
      await apiFetch(`/api/leagues/${state.league.id}/fixtures/${fx.id}/ready`, {
        method: 'POST',
        body: JSON.stringify({
          ready: nextReady,
          lineupIds: homeLineupIds.length === 11 ? homeLineupIds : undefined,
        }),
      });
      await onRefreshState();
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Ready check failed', body: err.message });
    } finally {
      setPvpBusy(false);
    }
  };

  const handlePvpStrategy = async (fx: LeagueFixture, nextStrategy: MatchStrategy) => {
    setPvpBusy(true);
    try {
      await apiFetch(`/api/leagues/${state.league.id}/fixtures/${fx.id}/tactics`, {
        method: 'POST',
        body: JSON.stringify({ strategy: nextStrategy }),
      });
      await onRefreshState();
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Could not update plan', body: err.message });
    } finally {
      setPvpBusy(false);
    }
  };

  const voteSkipThreshold = useMemo(() => {
    const count = state.members?.length || 1;
    return count <= 2 ? 1 : Math.floor(count / 2) + 1;
  }, [state.members]);

  const handleVoteSkipFixture = async (fx: LeagueFixture) => {
    setVoteSkipBusyId(fx.id);
    try {
      const res = await apiFetch<{
        ok: boolean;
        simulated: boolean;
        votes: Array<{ uid: string }>;
        threshold: number;
      }>(`/api/leagues/${state.league.id}/fixtures/${fx.id}/vote-skip`, {
        method: 'POST',
      });
      await onRefreshState();
      if (res.simulated) {
        onToast({
          tone: 'success',
          title: `Match #${fx.matchNumber} Simulated`,
          body: 'Inactive human fixture resolved using saved Playing XIs and tactics.',
        });
      } else {
        onToast({
          tone: 'info',
          title: `Vote Recorded (${res.votes.length}/${res.threshold})`,
          body: `Waiting on ${Math.max(0, res.threshold - res.votes.length)} more manager vote(s) to resolve Match #${fx.matchNumber}.`,
        });
      }
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Vote-sim failed', body: err.message });
    } finally {
      setVoteSkipBusyId(null);
    }
  };

  const handlePvpPaceOrPause = async (
    fx: LeagueFixture,
    payload: { simPace?: SimPace; paused?: boolean }
  ) => {
    setPvpBusy(true);
    try {
      await apiFetch(`/api/leagues/${state.league.id}/fixtures/${fx.id}/pace`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await onRefreshState();
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Could not update pace', body: err.message });
    } finally {
      setPvpBusy(false);
    }
  };

  const handleLaunchScheduledFixture = (fx: LeagueFixture) => {
    const home = teamById.get(fx.homeTeamId);
    const away = teamById.get(fx.awayTeamId);
    const isPvp = Boolean(home?.ownerUid && away?.ownerUid);

    if (fx.status === 'completed' && fx.matchId) {
      const m = recentMatches.find((row) => row.id === fx.matchId);
      if (m) {
        setCompletedMatch(m);
        setActiveScorecardInnings(1);
        setSimState({
          inningsNumber: 2,
          targetRuns: null,
          maxBallsPerInnings: 120,
          ballsPerOver: fx.format === 'Hundred' ? 5 : 6,
          innings1: {} as any,
          innings2: {} as any,
          completedInnings1Summary: null,
          commentary: [],
          highlights: [],
          droppedCatches: [],
          turningPoints: [],
          momentum: 0,
          activeModifiers: null,
          triggeredMomentIds: [],
          forcedNextBowlerIdx: null,
          finished: true,
        });
        setHubView('match');
        setStage('sim');
        return;
      }
    }

    if (isPvp) {
      void enterPvpFixtureRoom(fx);
      return;
    }

    const oppId = fx.homeTeamId === myTeam.id ? fx.awayTeamId : fx.homeTeamId;
    setAwayTeamId(oppId);
    setSelectedFixtureId(fx.id);
    setCompletedMatch(null);
    setSimState(null);
    setStage('lineup');
    setHubView('match');
  };

  const visibleFixtures = useMemo(() => {
    if (scheduleFilter === 'playoffs') {
      return fixturesList.filter((fx) => fx.stage !== 'league');
    }
    if (scheduleFilter === 'mine') {
      return fixturesList.filter(
        (fx) => fx.homeTeamId === myTeam.id || fx.awayTeamId === myTeam.id
      );
    }
    return fixturesList;
  }, [fixturesList, scheduleFilter, myTeam.id]);

  const scheduleSyncStatus = useMemo(() => {
    let earliestHumanDay: number | null = null;
    for (const fx of fixturesList) {
      if (fx.status === 'completed') continue;
      const h = teamById.get(fx.homeTeamId);
      const a = teamById.get(fx.awayTeamId);
      if (h?.ownerUid || a?.ownerUid) {
        if (earliestHumanDay === null || fx.scheduledDay < earliestHumanDay) {
          earliestHumanDay = fx.scheduledDay;
        }
      }
    }
    const pausedAiFixtures =
      earliestHumanDay === null
        ? 0
        : fixturesList.filter((fx) => {
            if (fx.status === 'completed') return false;
            const h = teamById.get(fx.homeTeamId);
            const a = teamById.get(fx.awayTeamId);
            const isAiOnly = !h?.ownerUid && !a?.ownerUid;
            return (
              isAiOnly &&
              fx.scheduledDay <= currentGameDay &&
              fx.scheduledDay > earliestHumanDay + 2
            );
          }).length;

    return { earliestHumanDay, pausedAiFixtures };
  }, [fixturesList, teamById, currentGameDay]);

  return (
    <div className="space-y-5">
      {/* Top Matchday Calendar & Sub-View Switcher */}
      <div className="cm27-panel px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 cm27-panel-inset flex items-center gap-2 text-xs font-mono text-[#93E6EE] tabular-nums">
            <Clock className="w-3.5 h-3.5 text-[#EAB308]" />
            <span className="font-bold">SEASON 1 · DAY {currentGameDay}</span>
            <span className="text-slate-400">({countdownLabel} next day)</span>
          </div>

          {myLiveOrNextPvpFixture && (
            <button
              onClick={() => enterPvpFixtureRoom(myLiveOrNextPvpFixture)}
              className="cm27-btn-3d px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>
                {myLiveOrNextPvpFixture.status === 'live' ? 'Join Live PvP Match' : 'Enter Friend PvP Room'}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-5 border-b border-white/[0.08] overflow-x-auto">
          {(
            [
              { id: 'schedule', label: `Schedule (${fixturesList.length})`, icon: CalendarDays },
              { id: 'match', label: 'AI Match Center', icon: Swords },
              { id: 'pvp', label: 'Live PvP Room', icon: Users },
              { id: 'standings', label: 'Points & NRR', icon: Trophy },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = hubView === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setHubView(t.id)}
                className={`pb-2 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors border-b-2 -mb-[1px] ${
                  active
                    ? 'border-[#93E6EE] text-white'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= HUB VIEW: TOURNAMENT SCHEDULE ================= */}
      {hubView === 'schedule' && (
        <div className="cm27-panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-condensed text-3xl font-extrabold text-white uppercase">
                AUTOMATED IPL-FORMAT TOURNAMENT SCHEDULE
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Each club faces 4 seeded rivals twice and remaining rivals once · AI vs AI fixtures auto-resolve as fast calendar days pass (10 min/day) · Friend matches require real-time PvP.
              </p>
            </div>
            <div className="flex items-center gap-4 border-b border-white/[0.08]">
              {(
                [
                  { id: 'mine', label: `My Fixtures (${myTeam.shortCode})` },
                  { id: 'all', label: 'All Matches' },
                  { id: 'playoffs', label: 'Playoffs' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setScheduleFilter(f.id)}
                  className={`pb-2 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 border-b-2 -mb-[1px] transition-colors ${
                    scheduleFilter === f.id
                      ? 'border-[#93E6EE] text-white'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {scheduleSyncStatus.pausedAiFixtures > 0 && scheduleSyncStatus.earliestHumanDay !== null && (
            <div className="px-4 py-2.5 rounded bg-amber-500/10 border border-[#EAB308]/35 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-200">
                <Clock className="w-4 h-4 text-[#EAB308] shrink-0" />
                <span>
                  <strong className="text-white">Calendar Sync Guard:</strong>{' '}
                  <span className="tabular-nums">{scheduleSyncStatus.pausedAiFixtures}</span> AI fixture(s) paused until Day{' '}
                  <span className="tabular-nums">{scheduleSyncStatus.earliestHumanDay}</span> human match(es) complete or receive vote-sim majority.
                </span>
              </div>
              {scheduleFilter !== 'all' && (
                <button
                  onClick={() => setScheduleFilter('all')}
                  className="text-[11px] font-mono uppercase tracking-wider text-[#93E6EE] hover:text-white cursor-pointer whitespace-nowrap shrink-0"
                >
                  View Due Matches →
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleFixtures.map((fx) => {
              const home = teamById.get(fx.homeTeamId);
              const away = teamById.get(fx.awayTeamId);
              const isPvp = Boolean(home?.ownerUid && away?.ownerUid);
              const hasHuman = Boolean(home?.ownerUid || away?.ownerUid);
              const involvesMe = fx.homeTeamId === myTeam.id || fx.awayTeamId === myTeam.id;
              const matchRec = fx.matchId ? recentMatches.find((m) => m.id === fx.matchId) : null;
              const isDue = fx.scheduledDay <= currentGameDay;
              const skipVotes = Array.isArray(fx.skipVotesJson) ? fx.skipVotesJson : [];
              const iVotedSkip = Boolean(
                myTeam.ownerUid && skipVotes.some((v) => v.uid === myTeam.ownerUid)
              );
              const canVoteSkip = hasHuman && fx.status !== 'completed' && isDue;

              return (
                <div
                  key={fx.id}
                  className={`p-4 rounded border space-y-3 ${
                    fx.status === 'live'
                      ? 'cm27-card-focus'
                      : involvesMe
                        ? 'bg-[#131922] border-[#93E6EE]/35'
                        : 'cm27-panel-inset'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400 tabular-nums">
                      MATCH #{fx.matchNumber} · DAY {fx.scheduledDay}{' '}
                      {isDue && fx.status !== 'completed' && (
                        <strong className="text-[#EAB308]">· DUE NOW</strong>
                      )}
                    </span>
                    <span
                      className={`uppercase font-bold ${
                        fx.status === 'completed'
                          ? 'text-[#4ADE80]'
                          : fx.status === 'live'
                            ? 'text-[#EAB308]'
                            : isPvp
                              ? 'text-sky-300'
                              : 'text-slate-400'
                      }`}
                    >
                      {fx.status === 'completed'
                        ? 'COMPLETED'
                        : fx.status === 'live'
                          ? 'LIVE PVP'
                          : isPvp
                            ? 'HUMAN PVP'
                            : 'VS CPU'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamCrest
                        templateKey={home?.templateKey}
                        shortCode={home?.shortCode || 'TBD'}
                        primaryColor={home?.primaryColor}
                        secondaryColor={home?.secondaryColor}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{home?.shortCode || 'TBD'}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {home?.ownerName || 'AI Club'}
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-slate-500 uppercase">VS</span>

                    <div className="flex items-center gap-2 min-w-0 text-right">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{away?.shortCode || 'TBD'}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {away?.ownerName || 'AI Club'}
                        </div>
                      </div>
                      <TeamCrest
                        templateKey={away?.templateKey}
                        shortCode={away?.shortCode || 'TBD'}
                        primaryColor={away?.primaryColor}
                        secondaryColor={away?.secondaryColor}
                        size="sm"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 truncate">
                    {fx.stage.toUpperCase()} · {fx.venue}
                  </div>

                  {matchRec ? (
                    <button
                      onClick={() => handleLaunchScheduledFixture(fx)}
                      className="cm27-btn-dark-3d w-full py-2 px-3 rounded text-xs font-bold text-[#EAB308] cursor-pointer text-left truncate"
                    >
                      {matchRec.marginText} — View Card →
                    </button>
                  ) : involvesMe ? (
                    <div className="space-y-2">
                      <button
                        onClick={() => handleLaunchScheduledFixture(fx)}
                        disabled={pvpBusy}
                        className="cm27-btn-3d w-full py-2 px-3 rounded font-bold text-xs uppercase tracking-wider cursor-pointer"
                      >
                        {isPvp ? 'Enter Live PvP Room' : 'Play Fixture vs CPU'}
                      </button>
                      {canVoteSkip && (isPvp || skipVotes.length > 0) && (
                        <button
                          onClick={() => handleVoteSkipFixture(fx)}
                          disabled={voteSkipBusyId === fx.id}
                          className={`w-full py-1.5 px-3 rounded border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors tabular-nums disabled:opacity-50 ${
                            iVotedSkip
                              ? 'bg-[#4ADE80]/15 border-[#4ADE80]/45 text-[#4ADE80]'
                              : 'bg-[#0C1016] border-white/10 text-slate-300 hover:border-[#EAB308]/50 hover:text-white'
                          }`}
                        >
                          <FastForward className="w-3.5 h-3.5" />
                          <span>
                            {iVotedSkip ? 'Voted to Sim Inactive Match' : 'Vote to Sim Inactive Match'} ({skipVotes.length}/{voteSkipThreshold})
                          </span>
                        </button>
                      )}
                    </div>
                  ) : canVoteSkip ? (
                    <button
                      onClick={() => handleVoteSkipFixture(fx)}
                      disabled={voteSkipBusyId === fx.id}
                      className={`w-full py-2 px-3 rounded border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors tabular-nums disabled:opacity-50 ${
                        iVotedSkip
                          ? 'bg-[#4ADE80]/15 border-[#4ADE80]/45 text-[#4ADE80]'
                          : 'bg-[#101620] border-[#EAB308]/35 text-[#EAB308] hover:bg-[#EAB308]/15'
                      }`}
                    >
                      <FastForward className="w-3.5 h-3.5" />
                      <span>
                        {iVotedSkip ? 'Voted to Sim Inactive Match' : 'Vote to Sim Inactive Match'} ({skipVotes.length}/{voteSkipThreshold})
                      </span>
                    </button>
                  ) : (
                    <div className="py-2 px-3 rounded bg-[#0C1016] border border-white/[0.06] text-[11px] font-mono text-slate-400 text-center">
                      {isPvp ? 'Friend PvP Scheduled' : `Auto-sims on Day ${fx.scheduledDay}`}
                    </div>
                  )}
                </div>
              );
            })}
            {visibleFixtures.length === 0 && (
              <div className="col-span-full p-8 cm27-panel-inset text-center text-xs text-slate-400">
                No fixtures match this filter yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= HUB VIEW: POINTS TABLE & PLAYOFFS ================= */}
      {hubView === 'standings' && (
        <div className="cm27-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-condensed text-3xl font-extrabold text-white uppercase">
                TOURNAMENT POINTS TABLE &amp; NRR
              </h2>
              <p className="text-xs text-slate-400">
                Top 4 clubs qualify for Qualifier 1, Eliminator, Qualifier 2 &amp; Championship Final.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#0A1014] text-slate-400 font-mono text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">POS</th>
                  <th className="py-2.5 px-3">FRANCHISE</th>
                  <th className="py-2.5 px-3">MANAGER</th>
                  <th className="py-2.5 px-2 text-right">P</th>
                  <th className="py-2.5 px-2 text-right">W</th>
                  <th className="py-2.5 px-2 text-right">L</th>
                  <th className="py-2.5 px-2 text-right">T</th>
                  <th className="py-2.5 px-3 text-right">NRR</th>
                  <th className="py-2.5 px-3 text-right">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {standingsList.map((row, idx) => {
                  const isMine = row.teamId === myTeam.id;
                  return (
                    <tr
                      key={row.teamId}
                      className={`${isMine ? 'bg-[#142529]' : 'hover:bg-white/[0.02]'} ${
                        idx === 3 ? 'border-b-2 border-emerald-400/45' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold tabular-nums">
                        <span className={idx < 4 ? 'text-emerald-300' : 'text-slate-500'}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <TeamCrest
                            templateKey={row.templateKey}
                            shortCode={row.shortCode}
                            primaryColor={row.primaryColor}
                            secondaryColor={row.secondaryColor}
                            size="sm"
                          />
                          <span className="font-bold text-white">{row.teamName}</span>
                          <span className="text-[10px] font-mono text-slate-400">({row.shortCode})</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {row.ownerName ? (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono text-[10px]">
                            {row.ownerName}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">AI Managed</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums">{row.played}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-emerald-400 tabular-nums">
                        {row.won}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-rose-400 tabular-nums">
                        {row.lost}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-400 tabular-nums">
                        {row.tied}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {row.nrr >= 0 ? `+${row.nrr.toFixed(3)}` : row.nrr.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400 tabular-nums">
                        {row.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= HUB VIEW: REAL-TIME PVP FIXTURE ROOM ================= */}
      {hubView === 'pvp' && (
        <div className="space-y-4">
          {!activePvpFixture ? (
            <div className="cm27-panel p-8 text-center space-y-4">
              <Users className="w-10 h-10 text-[#93E6EE] mx-auto" />
              <h2 className="font-condensed text-3xl font-extrabold text-white uppercase">
                REAL-TIME FRIEND PVP MATCH ROOM
              </h2>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                Matches against clubs managed by friends in your league are played live in real time — never AI-simulated. Pick any human fixture from your tournament schedule to enter the lobby.
              </p>
              {myLiveOrNextPvpFixture ? (
                <button
                  onClick={() => enterPvpFixtureRoom(myLiveOrNextPvpFixture)}
                  className="cm27-btn-3d px-6 py-2.5 rounded font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Enter Scheduled PvP Fixture #{myLiveOrNextPvpFixture.matchNumber}
                </button>
              ) : (
                <button
                  onClick={() => setHubView('schedule')}
                  className="cm27-btn-dark-3d px-6 py-2.5 rounded text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Browse Tournament Schedule
                </button>
              )}
            </div>
          ) : (() => {
            const fx = activePvpFixture;
            const home = teamById.get(fx.homeTeamId);
            const away = teamById.get(fx.awayTeamId);
            const isHomeClub = fx.homeTeamId === myTeam.id;
            const myReady = isHomeClub ? fx.homeReady : fx.awayReady;
            const myStrategy = (isHomeClub ? fx.homeStrategy : fx.awayStrategy) as MatchStrategy;
            const oppStrategy = (isHomeClub ? fx.awayStrategy : fx.homeStrategy) as MatchStrategy;
            const liveState = fx.liveStateJson;
            const completedMatchRec =
              fx.status === 'completed' && fx.matchId
                ? recentMatches.find((m) => m.id === fx.matchId) || null
                : null;

            if (fx.status === 'completed' && completedMatchRec?.resultSummaryJson) {
              const sum = completedMatchRec.resultSummaryJson;
              const cardInn =
                activeScorecardInnings === 1 ? sum.innings1 : sum.innings2;
              return (
                <div className="space-y-4">
                  <div className="cm27-panel border-[#93E6EE]/40 bg-gradient-to-r from-[#181E27] via-[#12161E] to-[#0C1016] p-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-mono uppercase text-[#4ADE80]">
                        PVP FIXTURE #{fx.matchNumber} COMPLETED
                      </div>
                      <h2 className="font-condensed text-3xl font-extrabold text-white uppercase mt-0.5">
                        {sum.marginText}
                      </h2>
                      <p className="text-xs text-slate-300">
                        {sum.venue} · Player of the Match: {sum.manOfTheMatch}
                      </p>
                    </div>
                    <button
                      onClick={() => setHubView('schedule')}
                      className="cm27-btn-3d px-4 py-2 rounded font-bold text-xs uppercase cursor-pointer"
                    >
                      Back to Schedule
                    </button>
                  </div>

                  <div className="cm27-panel p-4 space-y-4">
                    <div className="flex items-center gap-5 border-b border-white/[0.08]">
                      {[1, 2].map((n) => {
                        const iSum = n === 1 ? sum.innings1 : sum.innings2;
                        return (
                          <button
                            key={n}
                            onClick={() => setActiveScorecardInnings(n as 1 | 2)}
                            className={`pb-2 text-xs font-bold cursor-pointer border-b-2 -mb-[1px] tabular-nums ${
                              activeScorecardInnings === n
                                ? 'border-[#93E6EE] text-white'
                                : 'border-transparent text-slate-400 hover:text-white'
                            }`}
                          >
                            {iSum.teamShortCode}: {iSum.runs}/{iSum.wickets} ({iSum.overs} ov)
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                      <div className="lg:col-span-7 overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-[#070B0D] text-slate-400 font-mono">
                            <tr>
                              <th className="py-2 px-3">Batter</th>
                              <th className="py-2 px-2">Out</th>
                              <th className="py-2 px-2 text-right">R</th>
                              <th className="py-2 px-2 text-right">B</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.05]">
                            {cardInn.batters.map((b) => (
                              <tr key={b.playerId}>
                                <td className="py-1.5 px-3 font-semibold text-white">{b.name}</td>
                                <td className="py-1.5 px-2 text-slate-400">{b.dismissal}</td>
                                <td className="py-1.5 px-2 text-right font-mono text-[#EAB308] font-bold tabular-nums">
                                  {b.runs}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-slate-300 tabular-nums">
                                  {b.balls}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="lg:col-span-5 overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-[#070B0D] text-slate-400 font-mono">
                            <tr>
                              <th className="py-2 px-3">Bowler</th>
                              <th className="py-2 px-2 text-right">O</th>
                              <th className="py-2 px-2 text-right">R</th>
                              <th className="py-2 px-2 text-right">W</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.05]">
                            {cardInn.bowlers.map((bw) => (
                              <tr key={bw.playerId}>
                                <td className="py-1.5 px-3 font-semibold text-white">{bw.name}</td>
                                <td className="py-1.5 px-2 text-right font-mono text-slate-300 tabular-nums">{bw.overs}</td>
                                <td className="py-1.5 px-2 text-right font-mono text-slate-300 tabular-nums">{bw.runs}</td>
                                <td className="py-1.5 px-2 text-right font-mono text-[#4ADE80] font-bold tabular-nums">
                                  {bw.wickets}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (fx.status === 'scheduled' || fx.status === 'lobby' || !liveState) {
              return (
                <div className="cm27-panel border-[#93E6EE]/35 p-6 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#93E6EE]">
                        REAL-TIME PVP MATCH LOBBY · MATCH #{fx.matchNumber} · {fx.stage.toUpperCase()}
                      </div>
                      <h2 className="font-condensed text-3xl font-extrabold text-white uppercase mt-1">
                        {home?.name || 'HOME'} vs {away?.name || 'AWAY'}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {fx.venue} · {fx.pitchCondition} · Automatic coin toss fires once BOTH friends lock in Ready
                      </p>
                    </div>
                    <button
                      onClick={() => setHubView('schedule')}
                      className="cm27-btn-dark-3d px-3.5 py-2 rounded text-xs font-semibold text-slate-200 cursor-pointer"
                    >
                      ← Schedule
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { team: home, ready: fx.homeReady, side: 'HOME' },
                      { team: away, ready: fx.awayReady, side: 'AWAY' },
                    ].map(({ team, ready, side }) => (
                      <div
                        key={side}
                        className={`p-5 rounded border flex items-center justify-between gap-4 ${
                          ready
                            ? 'cm27-card-focus'
                            : 'cm27-panel-inset'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <TeamCrest
                            templateKey={team?.templateKey}
                            shortCode={team?.shortCode || side}
                            primaryColor={team?.primaryColor}
                            secondaryColor={team?.secondaryColor}
                            size="md"
                          />
                          <div className="min-w-0">
                            <div className="text-[10px] font-mono text-slate-400">{side} MANAGER</div>
                            <div className="font-condensed text-2xl font-extrabold text-white uppercase truncate">
                              {team?.name}
                            </div>
                            <div className="text-xs text-[#93E6EE] truncate">
                              {team?.ownerName || 'Friend Manager'}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1.5 rounded text-xs font-mono font-bold uppercase shrink-0 border ${
                            ready
                              ? 'bg-[#4ADE80]/15 border-[#4ADE80]/50 text-[#4ADE80]'
                              : 'bg-amber-500/15 border-[#EAB308]/40 text-[#EAB308]'
                          }`}
                        >
                          {ready ? 'READY' : 'WAITING'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-slate-400">
                      Your saved {getFormatDisplayLabel(format)} XI ({homeLineupIds.length}/11) will be committed automatically when you ready up.
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {fx.scheduledDay <= currentGameDay && (
                        <button
                          onClick={() => handleVoteSkipFixture(fx)}
                          disabled={voteSkipBusyId === fx.id}
                          className={`px-4 py-3 rounded border font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors tabular-nums disabled:opacity-50 ${
                            Boolean(
                              myTeam.ownerUid &&
                                Array.isArray(fx.skipVotesJson) &&
                                fx.skipVotesJson.some((v) => v.uid === myTeam.ownerUid)
                            )
                              ? 'bg-[#4ADE80]/15 border-[#4ADE80]/45 text-[#4ADE80]'
                              : 'bg-[#101620] border-white/15 text-slate-200 hover:border-[#EAB308]/50 hover:text-white'
                          }`}
                        >
                          <FastForward className="w-3.5 h-3.5" />
                          <span>
                            Vote to Sim Inactive Match ({Array.isArray(fx.skipVotesJson) ? fx.skipVotesJson.length : 0}/{voteSkipThreshold})
                          </span>
                        </button>
                      )}
                      <button
                        onClick={() => handlePvpToggleReady(fx, !myReady)}
                        disabled={pvpBusy}
                        className={`px-7 py-3 rounded font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-50 ${
                          myReady
                            ? 'bg-amber-500/15 border border-[#EAB308]/50 text-amber-200 hover:bg-amber-500/25'
                            : 'cm27-btn-3d'
                        }`}
                      >
                        {myReady ? 'Cancel Ready Status' : 'Lock XI & Start PvP Match'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // LIVE / PAUSED REAL-TIME PVP MATCH VIEW
            const isInn1 = liveState.inningsNumber === 1;
            const liveInn = isInn1 ? liveState.innings1 : liveState.innings2;
            const bpo = liveState.ballsPerOver || 6;
            const maxBalls = liveState.maxBallsPerInnings || 120;
            const oversTxt = liveInn ? formatOvers(liveInn.balls || 0, bpo) : '0.0';
            const maxOvers = Math.round(maxBalls / bpo);
            const crr =
              liveInn && liveInn.balls > 0
                ? ((liveInn.runs / liveInn.balls) * bpo).toFixed(2)
                : '0.00';
            const runsNeeded =
              liveState.targetRuns !== null && liveInn
                ? Math.max(0, liveState.targetRuns - liveInn.runs)
                : null;
            const ballsRem = liveInn ? Math.max(0, maxBalls - liveInn.balls) : maxBalls;
            const amIBatting = liveInn ? liveInn.battingTeamId === myTeam.id : false;

            const striker = liveInn?.batters?.[liveInn.strikerIdx];
            const nonStriker = liveInn?.batters?.[liveInn.nonStrikerIdx];
            const bowlerIdx =
              liveInn && liveInn.bowlers?.length > 0
                ? Math.floor((liveInn.balls || 0) / bpo) % liveInn.bowlers.length
                : 0;
            const bowler = liveInn?.bowlers?.[bowlerIdx];

            return (
              <div className="space-y-4">
                <div className="cm27-panel border-[#93E6EE]/40 bg-gradient-to-r from-[#181E27] via-[#12161E] to-[#0C1016] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono text-[#4ADE80] uppercase font-bold">
                        {fx.status === 'paused'
                          ? 'PVP PAUSED'
                          : `LIVE PVP · INNINGS ${liveState.inningsNumber}`}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        · {fx.venue} · {fx.pitchCondition}
                      </span>
                    </div>
                    {liveInn && (
                      <div className="flex items-baseline gap-4 flex-wrap">
                        <h2 className="font-condensed text-4xl sm:text-5xl font-extrabold text-white uppercase tabular-nums">
                          {liveInn.battingShortCode} {liveInn.runs}/{liveInn.wickets}
                        </h2>
                        <span className="font-mono text-lg text-slate-300 tabular-nums">
                          ({oversTxt} / {maxOvers} ov)
                        </span>
                        <span className="font-mono text-xs text-[#93E6EE] tabular-nums">
                          CRR {crr}
                        </span>
                      </div>
                    )}
                    {liveState.targetRuns !== null && runsNeeded !== null && (
                      <div className="text-xs font-mono text-[#EAB308] tabular-nums">
                        Target {liveState.targetRuns} · Need {runsNeeded} runs from {ballsRem} balls
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() =>
                        handlePvpPaceOrPause(fx, { paused: fx.status !== 'paused' })
                      }
                      disabled={pvpBusy}
                      className="cm27-btn-dark-3d px-3.5 py-2 rounded text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      {fx.status === 'paused' ? (
                        <Play className="w-3.5 h-3.5 text-[#4ADE80]" />
                      ) : (
                        <Pause className="w-3.5 h-3.5 text-[#EAB308]" />
                      )}
                      <span>{fx.status === 'paused' ? 'Resume' : 'Pause'}</span>
                    </button>
                  </div>
                </div>

                {/* Live PvP Tactics & Shared Pace Controls */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="cm27-panel p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase text-slate-400">
                      <Gauge className="w-4 h-4 text-[#93E6EE]" />
                      <span>Shared Match Pace</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(['slow', 'medium', 'quick'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => handlePvpPaceOrPause(fx, { simPace: p })}
                          disabled={pvpBusy}
                          className={`px-3 py-1.5 rounded text-xs font-bold capitalize cursor-pointer ${
                            fx.simPace === p
                              ? 'cm27-btn-3d'
                              : 'cm27-btn-dark-3d text-slate-300'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="cm27-panel p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-mono uppercase text-[#EAB308] flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Your {amIBatting ? 'Batting' : 'Bowling'} Plan</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        Opponent active plan: {oppStrategy}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(['Defensive', 'Normal', 'Aggressive', 'Ultra-Attacking'] as const).map(
                        (st) => (
                          <button
                            key={st}
                            onClick={() => handlePvpStrategy(fx, st)}
                            disabled={pvpBusy}
                            className={`px-2.5 py-1.5 rounded text-xs font-bold cursor-pointer ${
                              myStrategy === st
                                ? 'bg-[#EAB308] text-[#0B1115]'
                                : 'cm27-btn-dark-3d text-slate-300'
                            }`}
                          >
                            {st}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Live PvP Crease + Commentary */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-6 space-y-4">
                    <div className="cm27-panel p-4 space-y-2.5">
                      <div className="text-[10px] font-mono uppercase text-slate-400">
                        AT THE CREASE
                      </div>
                      {[
                        { row: striker, onStrike: true },
                        { row: nonStriker, onStrike: false },
                      ].map(
                        ({ row, onStrike }) =>
                          row && (
                            <div
                              key={row.playerId}
                              className={`p-3 rounded border flex items-center justify-between ${
                                onStrike
                                  ? 'cm27-card-focus'
                                  : 'cm27-panel-inset'
                              }`}
                            >
                              <div>
                                <div className="text-sm font-bold text-white">
                                  {row.name} {onStrike && <span className="text-[#93E6EE]">*</span>}
                                </div>
                                <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                                  4s: {row.fours} · 6s: {row.sixes} · SR{' '}
                                  {row.balls > 0 ? ((row.runs / row.balls) * 100).toFixed(1) : '0.0'}
                                </div>
                              </div>
                              <div className="font-condensed text-3xl font-extrabold text-[#EAB308] tabular-nums">
                                {row.runs}
                                <span className="text-sm text-slate-400 font-mono ml-1">
                                  ({row.balls})
                                </span>
                              </div>
                            </div>
                          )
                      )}
                    </div>

                    {bowler && (
                      <div className="cm27-panel p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-mono uppercase text-slate-400">
                              BOWLING NOW
                            </div>
                            <div className="text-sm font-bold text-white mt-0.5">{bowler.name}</div>
                          </div>
                          <div className="font-mono text-sm font-bold text-[#93E6EE] tabular-nums">
                            {bowler.wickets}/{bowler.runs} ({formatOvers(bowler.balls, bpo)} ov)
                          </div>
                        </div>
                        <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono uppercase text-slate-400">
                            RECENT BALLS:
                          </span>
                          {(liveInn?.recentBalls || []).slice(-6).map((b: string, i: number) => (
                            <span
                              key={i}
                              className={`w-7 h-7 rounded font-mono text-xs font-bold flex items-center justify-center ${
                                b === 'W'
                                  ? 'bg-rose-500 text-white'
                                  : b === '6' || b === '4'
                                    ? 'bg-[#22C55E] text-[#05140B]'
                                    : 'bg-[#0C1016] border border-white/15 text-slate-200'
                              }`}
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-6 cm27-panel p-4 space-y-3">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      REAL-TIME PVP COMMENTARY
                    </div>
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                      {liveState.commentary.map((c) => (
                        <div
                          key={c.id}
                          className={`p-2.5 rounded border text-xs flex items-start gap-2.5 ${
                            c.tone === 'wicket'
                              ? 'bg-rose-500/10 border-rose-500/35 text-rose-200'
                              : c.tone === 'boundary'
                                ? 'bg-[#17202B] border-[#93E6EE]/45 text-slate-100'
                                : 'cm27-panel-inset text-slate-300'
                          }`}
                        >
                          <span className="font-mono text-[10px] text-slate-400 shrink-0 mt-0.5 tabular-nums">
                            {c.over}
                          </span>
                          <span>{c.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ================= HUB VIEW: AI MATCH CENTER (4-STAGE FLOW) ================= */}
      {hubView === 'match' && (
        <>
          {/* Top Matchday Control Bar & 4-Stage Stepper */}
          <div className="cm27-panel p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <TeamCrest
                templateKey={myTeam.templateKey}
                shortCode={myTeam.shortCode}
                primaryColor={myTeam.primaryColor}
                secondaryColor={myTeam.secondaryColor}
                size="md"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                  <span className="uppercase tracking-[0.2em] text-[#EAB308]">
                    MATCHDAY CENTRE
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-[#4ADE80]">
                    {getCompetitionDisplayLabel(myTeam.leagueCategory)} · {getFormatDisplayLabel(format)}
                  </span>
                  {selectedFixtureId && (
                    <>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-sky-300 uppercase">Scheduled Fixture</span>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2.5 mt-1">
                  <span className="font-condensed text-2xl font-extrabold uppercase text-white">
                    {myTeam.name}
                  </span>
                  <span className="text-xs font-mono text-slate-400">VS</span>
                  <select
                    value={awayTeamId}
                    onChange={(e) => {
                      setAwayTeamId(Number(e.target.value));
                      setSelectedFixtureId(null);
                      setCompletedMatch(null);
                      setSimState(null);
                      setStage('lineup');
                    }}
                    className="bg-[#0C0F14] border border-white/15 rounded px-3 py-1.5 text-sm font-bold text-white cursor-pointer focus:outline-none focus:border-[#93E6EE]"
                  >
                    {opponents.map((opp) => (
                      <option key={opp.id} value={opp.id}>
                        {opp.name} ({opp.shortCode}){opp.ownerName ? ` · ${opp.ownerName} (PvP Only)` : ' · CPU'}
                      </option>
                    ))}
                  </select>

                  {allowedFormats.length > 1 && (
                    <div className="flex items-center gap-1 p-0.5 rounded bg-[#0C0F14] border border-white/10">
                      {allowedFormats.map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => {
                            setFormat(fmt);
                            setCompletedMatch(null);
                            setSimState(null);
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                            format === fmt
                              ? 'cm27-btn-3d'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {getFormatDisplayLabel(fmt)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4-Stage Stepper */}
            <div className="flex items-center gap-1.5 cm27-panel-inset p-1 overflow-x-auto">
              {(
                [
                  { id: 'lineup', step: 1, label: 'Lineup Selection' },
                  { id: 'compare', step: 2, label: 'Team Compare' },
                  { id: 'toss', step: 3, label: 'Auto Toss' },
                  { id: 'sim', step: 4, label: 'Live Match' },
                ] as const
              ).map((s) => {
                const active = stage === s.id;
                const disabled =
                  selectedOpponentIsHuman ||
                  (s.id === 'sim' && !simState && !completedMatch);
                return (
                  <button
                    key={s.id}
                    disabled={disabled}
                    onClick={() => {
                      if (s.id === 'toss') {
                        enterTossStage();
                      } else {
                        setStage(s.id);
                      }
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors border ${
                      active
                        ? 'cm27-card-focus text-white cursor-pointer'
                        : disabled
                          ? 'border-transparent text-slate-600 cursor-not-allowed'
                          : 'border-transparent text-slate-400 hover:text-white cursor-pointer'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded text-[10px] font-mono flex items-center justify-center ${
                        active ? 'bg-[#93E6EE] text-[#090D12] font-bold' : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {s.step}
                    </span>
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedOpponentIsHuman ? (
            <div className="cm27-panel border-[#93E6EE]/40 p-8 text-center space-y-4">
              <ShieldAlert className="w-10 h-10 text-[#93E6EE] mx-auto" />
              <h2 className="font-condensed text-3xl font-extrabold text-white uppercase">
                LIVE PVP REQUIRED VS {selectedOpponent?.name}
              </h2>
              <p className="text-xs text-slate-300 max-w-lg mx-auto">
                {selectedOpponent?.name} is managed by <strong className="text-[#93E6EE]">{selectedOpponent?.ownerName || 'a human friend'}</strong>. Fixtures between two human managers cannot be simulated solo against AI — enter your scheduled PvP fixture room together so both managers lock XIs and control live tactics!
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {(() => {
                  const matchingFx = fixturesList.find(
                    (fx) =>
                      fx.status !== 'completed' &&
                      ((fx.homeTeamId === myTeam.id && fx.awayTeamId === selectedOpponent?.id) ||
                        (fx.awayTeamId === myTeam.id && fx.homeTeamId === selectedOpponent?.id))
                  );
                  if (matchingFx) {
                    return (
                      <button
                        onClick={() => enterPvpFixtureRoom(matchingFx)}
                        className="cm27-btn-3d px-6 py-2.5 rounded font-bold text-xs uppercase tracking-wider cursor-pointer"
                      >
                        Enter Live PvP Fixture #{matchingFx.matchNumber}
                      </button>
                    );
                  }
                  return null;
                })()}
                <button
                  onClick={() => setHubView('schedule')}
                  className="cm27-btn-dark-3d px-5 py-2.5 rounded text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  View Tournament Schedule
                </button>
              </div>
            </div>
          ) : loadingPreview && !preview ? (
            <div className="cm27-panel p-12 text-center text-xs font-mono text-slate-400">
              Assembling matchday squads, venue telemetry, and head-to-head history...
            </div>
          ) : !preview ? null : (
            <>
          {/* ================= STAGE 1: LINEUP SELECTION (Drag-and-Drop + Arrows + C/WK) ================= */}
          {stage === 'lineup' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-2 space-y-2.5">
                <button
                  onClick={handleAutoPickBalanced}
                  className="cm27-btn-dark-3d w-full p-4 rounded text-center space-y-1 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-[#93E6EE] mx-auto" />
                  <div className="text-xs font-bold text-white">Auto-Pick Best XI</div>
                  <div className="text-[10px] text-slate-400">Optimal balance</div>
                </button>

                <div className="cm27-card-focus p-3.5 rounded border text-white">
                  <div className="text-xs font-bold uppercase">
                    {allowedFormats.length === 1
                      ? 'Default Lineup'
                      : `${getFormatDisplayLabel(format)} Lineup`}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 tabular-nums">
                    XI ready · {activeHomeXI.length}/11
                  </div>
                </div>

                <div className="p-3 cm27-panel-inset text-[11px] text-slate-400 space-y-1">
                  <div className="text-white font-semibold">Squad Source</div>
                  <div className={preview.homeSquadSource === 'contracted' ? 'text-[#93E6EE]' : 'text-[#EAB308]'}>
                    {preview.homeSquadSource === 'contracted'
                      ? 'Contracted Auction Roster'
                      : 'Club Exhibition Pool'}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (activeHomeXI.length < 11) {
                      onToast({
                        tone: 'warning',
                        title: 'Select 11 Players',
                        body: `Currently ${activeHomeXI.length}/11 selected.`,
                      });
                      return;
                    }
                    setStage('compare');
                  }}
                  className="cm27-btn-3d w-full py-3 px-3 rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Compare Lineups</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Center Playing XI Table with Drag-and-Drop, Arrows, C, Natural WK */}
              <div className="lg:col-span-6 cm27-panel p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-condensed text-2xl font-extrabold text-white uppercase">
                      MATCHDAY LINEUP — {myTeam.name}
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {swapSourceId
                        ? 'Tap any Reserve below to swap into XI'
                        : 'Drag rows or use arrows to reorder · Assign C and natural WK'}
                    </p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-[#151D22] border border-white/15 font-mono text-sm font-bold text-white shrink-0 tabular-nums">
                    {activeHomeXI.length} <span className="text-slate-400">/ 11</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="px-2.5 py-1.5 grid grid-cols-12 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    <div className="col-span-1">ROLE</div>
                    <div className="col-span-4">NAME</div>
                    <div className="col-span-1 text-center">BAT</div>
                    <div className="col-span-1 text-center">BOWL</div>
                    <div className="col-span-1 text-center">PREF</div>
                    <div className="col-span-1 text-right">OVR</div>
                    <div className="col-span-3 text-right">C · WK · MOVE</div>
                  </div>
                  {activeHomeXI.map((p, idx) => {
                    const focused = displayedPlayer?.id === p.id;
                    const isSwapSource = swapSourceId === p.id;
                    const isDragOver = dragOverId === p.id && dragPlayerId !== p.id;
                    const { delta, label: ovrLabel } = formatOvrWithDelta(p);
                    const isNaturalWk = p.primaryRole === 'Wicketkeeper';
                    const isWkAssigned = wicketkeeperId === p.id;

                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={() => setDragPlayerId(p.id)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverId !== p.id) setDragOverId(p.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverId === p.id) setDragOverId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDropOnXI(p.id);
                        }}
                        onDragEnd={() => {
                          setDragPlayerId(null);
                          setDragOverId(null);
                        }}
                        onClick={() => setSpotlightPlayer(p)}
                        className={`px-2.5 py-2 rounded border grid grid-cols-12 items-center gap-1 cursor-pointer transition-colors ${
                          isDragOver
                            ? 'bg-[#1D2834] border-[#93E6EE] text-white'
                            : isSwapSource
                              ? 'bg-amber-500/15 border-[#EAB308] text-white'
                              : focused
                                ? 'cm27-card-focus text-white'
                                : 'bg-[#0E1219] border-white/[0.06] hover:bg-[#141A23] text-white'
                        }`}
                      >
                        <div className="col-span-1 flex items-center gap-1">
                          <GripVertical
                            className={`w-3 h-3 shrink-0 cursor-grab ${
                              focused && !isSwapSource ? 'text-[#93E6EE]' : 'text-slate-600'
                            }`}
                          />
                          <span
                            className={`w-3.5 text-[11px] font-mono tabular-nums ${
                              focused && !isSwapSource ? 'text-[#93E6EE] font-bold' : 'text-slate-400'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="w-5 h-5 rounded bg-[#0C1016] border border-white/15 text-[8px] font-mono font-bold text-slate-200 flex items-center justify-center shrink-0">
                            {getRoleAbbr(p.primaryRole)}
                          </span>
                        </div>

                        <div className="col-span-4 flex items-center gap-1 min-w-0 pr-1">
                          <span className="text-xs font-bold truncate">{p.name}</span>
                          {captainId === p.id && (
                            <span className="px-1 py-0.5 rounded bg-amber-500/20 text-[#EAB308] text-[9px] font-mono font-bold shrink-0">
                              C
                            </span>
                          )}
                          {isWkAssigned && (
                            <span className="px-1 py-0.5 rounded bg-[#22C55E]/20 text-[#4ADE80] text-[9px] font-mono font-bold shrink-0">
                              WK
                            </span>
                          )}
                          {(p.injuryGamesRemaining ?? 0) > 0 ? (
                            <span className="px-1 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-mono font-bold shrink-0">
                              OUT {p.injuryGamesRemaining}G
                            </span>
                          ) : (
                            <span
                              className={`text-[9px] font-mono shrink-0 tabular-nums ${
                                (p.stamina ?? 100) >= 75
                                  ? 'text-emerald-400'
                                  : (p.stamina ?? 100) >= 50
                                    ? 'text-[#EAB308]'
                                    : 'text-rose-400'
                              }`}
                              title="Match Stamina"
                            >
                              {p.stamina ?? 100}%
                            </span>
                          )}
                        </div>

                        <div className="col-span-1 text-center text-[10px] font-mono text-slate-400">
                          {p.battingHand === 'Left-hand' ? 'LHB' : 'RHB'}
                        </div>
                        <div className="col-span-1 text-center text-[10px] font-mono text-slate-400">
                          {getBowlStyleShort(p.bowlingStyle)}
                        </div>
                        <div className="col-span-1 text-center text-[10px] font-mono text-slate-400">
                          {getPrefPositionLabel(p.primaryRole, p.battingRating)}
                        </div>
                        <div
                          className={`col-span-1 text-right text-[11px] font-mono font-bold tabular-nums ${
                            delta < 0 ? 'text-rose-400' : 'text-[#4ADE80]'
                          }`}
                        >
                          {ovrLabel}
                        </div>

                        <div
                          className="col-span-3 flex items-center justify-end gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleAssignCaptain(p.id)}
                            className={`p-1 rounded cursor-pointer ${
                              captainId === p.id
                                ? 'text-[#EAB308] bg-amber-500/15'
                                : 'text-slate-400 hover:text-[#EAB308]'
                            }`}
                            title="Assign Captain (C)"
                          >
                            <Crown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleAssignWk(p)}
                            disabled={!isNaturalWk}
                            className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold ${
                              !isNaturalWk
                                ? 'opacity-25 cursor-not-allowed'
                                : isWkAssigned
                                  ? 'bg-[#22C55E]/20 text-[#4ADE80] cursor-pointer'
                                  : 'text-slate-400 hover:text-[#4ADE80] cursor-pointer'
                            }`}
                            title={
                              isNaturalWk
                                ? 'Assign Wicketkeeper (WK)'
                                : 'Only natural Wicketkeepers can be assigned WK'
                            }
                          >
                            WK
                          </button>
                          <button
                            onClick={() => handleToggleSwap(p)}
                            className={`p-1 cursor-pointer ${
                              isSwapSource ? 'text-[#EAB308]' : 'text-slate-400 hover:text-[#4ADE80]'
                            }`}
                            title="Select to Swap with Reserve"
                          >
                            <ArrowLeftRight className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveHomeOrder(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-[#4ADE80] cursor-pointer disabled:opacity-25"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveHomeOrder(idx, 1)}
                            disabled={idx === activeHomeXI.length - 1}
                            className="p-1 text-slate-400 hover:text-[#4ADE80] cursor-pointer disabled:opacity-25"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {droppedReserves.length > 0 && (
                  <div className="pt-3 border-t border-white/[0.07]">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                      Dropped / Bench ({droppedReserves.length}) — {swapSourceId ? 'Click a player to swap into XI' : 'Drag onto XI slot or tap Swap'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                      {droppedReserves.map((p) => {
                        const { label: rOvr, delta: rDelta } = formatOvrWithDelta(p);
                        return (
                          <button
                            key={p.id}
                            draggable
                            onDragStart={() => setDragPlayerId(p.id)}
                            onDragEnd={() => {
                              setDragPlayerId(null);
                              setDragOverId(null);
                            }}
                            onClick={() => handleToggleSwap(p)}
                            className={`px-3 py-1.5 rounded bg-[#070B0D] border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                              swapSourceId
                                ? 'border-[#EAB308]/60 text-amber-200 hover:bg-amber-500/10'
                                : 'border-white/10 text-slate-300 hover:border-white/25'
                            }`}
                          >
                            <span className="truncate flex items-center gap-1.5">
                              <GripVertical className="w-3 h-3 text-slate-600 shrink-0" />
                              <span className="truncate">{p.name}</span>
                              <span className="text-[10px] text-slate-500">({getRoleAbbr(p.primaryRole)})</span>
                            </span>
                            <span
                              className={`font-mono shrink-0 tabular-nums ${
                                rDelta < 0 ? 'text-rose-400' : 'text-[#4ADE80]'
                              }`}
                            >
                              {rOvr}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {displayedPlayer && (
                <div className="lg:col-span-4">
                  <CyanPlayerCard
                    player={displayedPlayer}
                    slotNumber={
                      homeLineupIds.indexOf(displayedPlayer.id) >= 0
                        ? homeLineupIds.indexOf(displayedPlayer.id) + 1
                        : undefined
                    }
                    isCaptain={captainId === displayedPlayer.id}
                    isWicketkeeper={wicketkeeperId === displayedPlayer.id}
                  />
                </div>
              )}
            </div>
          )}

          {/* ================= STAGE 2: PRE-MATCH COMPARISON (Reference Image 2) ================= */}
          {stage === 'compare' && (
            <div className="space-y-5">
              {/* Header Banner matching Image 2 */}
              <div className="cm27-panel bg-gradient-to-b from-[#171D26] to-[#0E1219] p-6 text-center space-y-4">
                <div className="flex flex-col items-center gap-2">
                  <span
                    className={`px-6 py-1.5 rounded border font-condensed text-2xl font-extrabold tracking-widest uppercase ${renderFormatBadgeClass()}`}
                  >
                    {getFormatDisplayLabel(format)}
                  </span>
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-300">
                    {preview.competitionLabel}
                  </span>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 pt-1">
                  <div className="flex items-center gap-3">
                    <TeamCrest
                      templateKey={preview.homeTeam.templateKey}
                      shortCode={preview.homeTeam.shortCode}
                      primaryColor={preview.homeTeam.primaryColor}
                      secondaryColor={preview.homeTeam.secondaryColor}
                      size="md"
                    />
                    <div className="text-left">
                      <div className="font-condensed text-2xl font-extrabold text-white uppercase">
                        {preview.homeTeam.name}
                      </div>
                      <div className="text-[11px] font-mono text-[#93E6EE] tabular-nums">
                        XI Rating {liveHomeRatings.overall}
                      </div>
                    </div>
                  </div>

                  <div className="text-center space-y-1">
                    <div className="font-condensed text-2xl font-extrabold text-white uppercase tabular-nums">
                      7:30 PM
                    </div>
                    <div className="text-xs text-slate-300">
                      {preview.venue} · {preview.pitchCondition}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-condensed text-2xl font-extrabold text-white uppercase">
                        {preview.awayTeam.name}
                      </div>
                      <div className="text-[11px] font-mono text-rose-400 tabular-nums">
                        XI Rating {preview.awayRatings.overall}
                      </div>
                    </div>
                    <TeamCrest
                      templateKey={preview.awayTeam.templateKey}
                      shortCode={preview.awayTeam.shortCode}
                      primaryColor={preview.awayTeam.primaryColor}
                      secondaryColor={preview.awayTeam.secondaryColor}
                      size="md"
                    />
                  </div>
                </div>
              </div>

              {/* 3-Column Comparison: Home XI | Center Spotlight + Team Bars | Opponent XI */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                {/* Left: Your XI */}
                <div className="xl:col-span-4 cm27-panel p-4 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <div>
                      <div className="font-condensed text-xl font-extrabold text-white uppercase">
                        {preview.homeTeam.name}
                      </div>
                      <div className="text-[10px] font-mono text-[#93E6EE]">
                        Selected 11/11 · Manage Lineup
                      </div>
                    </div>
                    <button
                      onClick={() => setStage('lineup')}
                      className="cm27-btn-dark-3d px-2.5 py-1 rounded text-[11px] text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Manage Lineup
                    </button>
                  </div>
                  <div className="space-y-1">
                    {activeHomeXI.map((p, idx) => {
                      const active = displayedPlayer?.id === p.id;
                      const { label: ovrLabel, delta } = formatOvrWithDelta(p);
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSpotlightPlayer(p)}
                          className={`w-full px-2.5 py-1.5 rounded border grid grid-cols-12 items-center text-left text-xs cursor-pointer transition-colors ${
                            active
                              ? 'cm27-card-focus text-white'
                              : 'bg-[#0E1219] border-transparent hover:bg-[#151B24] text-slate-200'
                          }`}
                        >
                          <span className="col-span-1 font-mono text-[11px] text-slate-400 tabular-nums">
                            {idx + 1}
                          </span>
                          <span className="col-span-5 font-semibold truncate pr-1 flex items-center gap-1">
                            <span className="truncate">{p.name}</span>
                            {captainId === p.id && (
                              <span className="text-[9px] font-mono text-[#EAB308] font-bold">C</span>
                            )}
                            {wicketkeeperId === p.id && (
                              <span className="text-[9px] font-mono text-[#4ADE80] font-bold">WK</span>
                            )}
                          </span>
                          <span className="col-span-2 text-[10px] font-mono text-slate-400">
                            {getRoleAbbr(p.primaryRole)}
                          </span>
                          <span className="col-span-2 text-[10px] font-mono text-slate-400">
                            {getBowlStyleShort(p.bowlingStyle)}
                          </span>
                          <span
                            className={`col-span-2 text-right font-mono font-bold tabular-nums ${
                              delta < 0 ? 'text-rose-400' : 'text-[#4ADE80]'
                            }`}
                          >
                            {ovrLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Center: Cyan Player Card + Comparison Bars */}
                <div className="xl:col-span-4 space-y-4">
                  {displayedPlayer && (
                    <CyanPlayerCard
                      player={displayedPlayer}
                      compact
                      isCaptain={captainId === displayedPlayer.id}
                      isWicketkeeper={wicketkeeperId === displayedPlayer.id}
                    />
                  )}

                  <div className="cm27-panel p-4 space-y-3">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 text-center">
                      LINEUP RATING COMPARISON
                    </div>
                    {[
                      { label: 'BATTING', home: liveHomeRatings.bat, away: preview.awayRatings.bat },
                      { label: 'BOWLING', home: liveHomeRatings.bowl, away: preview.awayRatings.bowl },
                      { label: 'FIELDING', home: liveHomeRatings.field, away: preview.awayRatings.field },
                      { label: 'XI OVERALL', home: liveHomeRatings.overall, away: preview.awayRatings.overall },
                    ].map((row) => (
                      <div key={row.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                          <span className="text-[#4ADE80] font-bold">{row.home}</span>
                          <span className="text-[10px] text-slate-400">{row.label}</span>
                          <span className="text-rose-400 font-bold">{row.away}</span>
                        </div>
                        <div className="h-1.5 bg-[#070B0D] overflow-hidden flex">
                          <div
                            className="h-full bg-[#22C55E]"
                            style={{
                              width: `${Math.round((row.home / Math.max(1, row.home + row.away)) * 100)}%`,
                            }}
                          />
                          <div
                            className="h-full bg-[#EF4444]"
                            style={{
                              width: `${Math.round((row.away / Math.max(1, row.home + row.away)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}

                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                      <span className="text-[#4ADE80]">Win {liveWinChance.homePct}%</span>
                      <span>
                        {format === 'Test' ? 'Draw' : 'Tie'} {liveWinChance.tiePct}%
                      </span>
                      <span className="text-rose-400">Win {liveWinChance.awayPct}%</span>
                    </div>
                  </div>
                </div>

                {/* Right: Opponent XI (view only) */}
                <div className="xl:col-span-4 cm27-panel p-4 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <div>
                      <div className="font-condensed text-xl font-extrabold text-white uppercase">
                        {preview.awayTeam.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        Opponent XI · view only
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-rose-300 tabular-nums">
                      OVR {preview.awayRatings.overall}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {preview.awayXI.map((p, idx) => {
                      const active = displayedPlayer?.id === p.id;
                      const { label: ovrLabel, delta } = formatOvrWithDelta(p);
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSpotlightPlayer(p)}
                          className={`w-full px-2.5 py-1.5 rounded border grid grid-cols-12 items-center text-left text-xs cursor-pointer transition-colors ${
                            active
                              ? 'bg-[#241217] border-rose-500/75 text-white'
                              : 'bg-[#0E1219] border-transparent hover:bg-[#151B24] text-slate-200'
                          }`}
                        >
                          <span className="col-span-1 font-mono text-[11px] text-slate-400 tabular-nums">
                            {idx + 1}
                          </span>
                          <span className="col-span-5 font-semibold truncate pr-1">{p.name}</span>
                          <span className="col-span-2 text-[10px] font-mono text-slate-400">
                            {getRoleAbbr(p.primaryRole)}
                          </span>
                          <span className="col-span-2 text-[10px] font-mono text-slate-400">
                            {getBowlStyleShort(p.bowlingStyle)}
                          </span>
                          <span
                            className={`col-span-2 text-right font-mono font-bold tabular-nums ${
                              delta < 0 ? 'text-rose-400' : 'text-[#4ADE80]'
                            }`}
                          >
                            {ovrLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Navigation Footer */}
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setStage('lineup')}
                  className="cm27-btn-dark-3d px-4 py-2.5 rounded text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Lineup</span>
                </button>
                <button
                  onClick={enterTossStage}
                  className="cm27-btn-3d px-10 py-3 rounded font-bold text-sm uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                >
                  <span>Play Match</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ================= STAGE 3: AUTOMATIC TOSS (Heads / Tails Auto-Resolved) ================= */}
          {stage === 'toss' && (
            <div className="space-y-5">
              <div className="cm27-panel p-8 md:p-12 text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded bg-[#EAB308]/12 border border-[#EAB308]/35 mx-auto">
                  <Coins className={`w-8 h-8 text-[#EAB308] ${flipping ? 'animate-spin' : ''}`} />
                </div>

                <div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-400">
                    {preview.competitionLabel} · {preview.venue}
                  </div>
                  <h2 className="font-condensed text-4xl font-extrabold text-white uppercase tracking-wide mt-1">
                    OFFICIAL MATCH TOSS
                  </h2>
                </div>

                {flipping || !coinOutcome || !tossWinnerTeamId ? (
                  <div className="space-y-3 py-4">
                    <div className="text-sm text-[#EAB308] font-mono">
                      Match referee flipping the coin between {preview.homeTeam.shortCode} and {preview.awayTeam.shortCode}...
                    </div>
                  </div>
                ) : (
                  <div className="max-w-lg mx-auto space-y-5">
                    <div className="cm27-panel-inset p-4 space-y-2">
                      <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                        Coin Landed <strong className="text-[#EAB308]">{coinOutcome.toUpperCase()}</strong>
                      </div>
                      <div className="font-condensed text-3xl font-extrabold text-[#93E6EE] uppercase">
                        {userWonToss ? `${preview.homeTeam.name} Won the Toss` : `${preview.awayTeam.name} Won the Toss`}
                      </div>
                      <div className="text-sm text-slate-200">
                        {userWonToss ? preview.homeTeam.shortCode : preview.awayTeam.shortCode} elected to{' '}
                        <strong className="text-white uppercase">{tossDecision} first</strong> on this{' '}
                        {preview.pitchCondition.toLowerCase()} surface.
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={() => setStage('compare')}
                        className="cm27-btn-dark-3d px-4 py-2.5 rounded text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                      >
                        ← Back to Compare
                      </button>
                      <button
                        onClick={launchLiveSimulation}
                        className="cm27-btn-3d px-10 py-3 rounded font-bold text-sm uppercase tracking-wider flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start Match</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STAGE 4: LIVE BALL-BY-BALL SIMULATION (IMAGE 1 BROADCAST LAYOUT) ================= */}
          {stage === 'sim' && simState && !activeSummary && (
            <div className="space-y-4">
              {(() => {
                const isInn1 = simState.inningsNumber === 1;
                const liveInn = isInn1 ? simState.innings1 : simState.innings2!;
                const striker = liveInn.batters[liveInn.strikerIdx];
                const nonStriker = liveInn.batters[liveInn.nonStrikerIdx];
                const bowler = liveInn.bowlers[liveInn.currentBowlerIdx];
                const bpo = simState.ballsPerOver;
                const oversTxt = formatOvers(liveInn.balls, bpo);
                const maxOvers = Math.round(simState.maxBallsPerInnings / bpo);
                const crr =
                  liveInn.balls > 0
                    ? ((liveInn.runs / liveInn.balls) * bpo).toFixed(1)
                    : '0.0';
                const ballsRemaining = Math.max(0, simState.maxBallsPerInnings - liveInn.balls);
                const runsNeeded =
                  simState.targetRuns !== null ? Math.max(0, simState.targetRuns - liveInn.runs) : null;
                const rrr =
                  runsNeeded !== null && ballsRemaining > 0
                    ? ((runsNeeded / ballsRemaining) * bpo).toFixed(1)
                    : null;
                const userIsBatting = liveInn.battingTeamId === myTeam.id;

                const battingTeam =
                  liveInn.battingTeamId === preview.homeTeam.id
                    ? preview.homeTeam
                    : preview.awayTeam;
                const bowlingTeam =
                  liveInn.battingTeamId === preview.homeTeam.id
                    ? preview.awayTeam
                    : preview.homeTeam;

                const winSplit = computeLiveWinSplit({
                  battingTeamId: liveInn.battingTeamId,
                  bowlingTeamId: liveInn.bowlingTeamId,
                  runs: liveInn.runs,
                  wickets: liveInn.wickets,
                  balls: liveInn.balls,
                  maxBalls: simState.maxBallsPerInnings,
                  inningsNumber: simState.inningsNumber,
                  targetRuns: simState.targetRuns,
                  momentum: simState.momentum,
                  userTeamId: myTeam.id,
                });

                const phaseLabel =
                  liveInn.balls < Math.round(simState.maxBallsPerInnings * 0.3)
                    ? 'Powerplay'
                    : liveInn.balls < Math.round(simState.maxBallsPerInnings * 0.72)
                      ? 'Middle Overs'
                      : 'Death Overs';

                const applyTacticPreset = (preset: TacticSegmentPreset, isPrimary: boolean) => {
                  const found = TACTIC_SEGMENTS.find((s) => s.id === preset);
                  if (isPrimary) {
                    setTacticPreset(preset);
                    if (found) setStrategy(found.engineStrategy);
                  } else {
                    setPartnerTacticPreset(preset);
                    if (found && !userIsBatting) setStrategy(found.engineStrategy);
                  }
                };

                const formatBadgeColor =
                  format === 'Test'
                    ? 'bg-[#B91C1C]'
                    : format === 'ODI'
                      ? 'bg-[#0369A1]'
                      : format === 'Hundred'
                        ? 'bg-[#6D28D9]'
                        : 'bg-[#15803D]';

                const strikerHint =
                  TACTIC_SEGMENTS.find((s) => s.id === tacticPreset)?.hint ||
                  'Balanced — no strong lean either way.';
                const partnerHint =
                  TACTIC_SEGMENTS.find((s) => s.id === partnerTacticPreset)?.hint ||
                  'Balanced — no strong lean either way.';

                const lastComment = simState.commentary[0];

                return (
                  <div className="space-y-4">
                    {/* 1. Centered Match Format & Competition Header (Image 1 Top) */}
                    <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs tracking-wide uppercase">
                      <span
                        className={`px-2.5 py-0.5 rounded font-condensed text-sm font-bold text-white tracking-wider ${formatBadgeColor}`}
                      >
                        {format.toUpperCase()}
                      </span>
                      <span className="font-semibold text-slate-300">
                        {preview.competitionLabel} · INNINGS {simState.inningsNumber} ({oversTxt}/{maxOvers} OV)
                      </span>
                    </div>

                    {/* 2. Full-Width Split Broadcast Scoreboard Strip */}
                    <div className="rounded-md overflow-hidden border border-white/[0.09] bg-[#0B0E14]/90 shadow-2xl">
                      <div className="grid grid-cols-1 sm:grid-cols-2">
                        {/* Bowling / First-Innings Side */}
                        <div className="px-5 py-3 flex items-center justify-between bg-[#0E1319]/95 border-b sm:border-b-0 sm:border-r border-white/[0.08]">
                          <span className="font-condensed text-lg font-bold text-slate-300 uppercase tracking-wider">
                            {bowlingTeam.shortCode}
                          </span>
                          <span className="font-condensed text-3xl font-bold text-slate-200 tabular-nums">
                            {simState.completedInnings1Summary
                              ? `${simState.completedInnings1Summary.runs}/${simState.completedInnings1Summary.wickets}`
                              : '—'}
                          </span>
                        </div>

                        {/* Batting / Live Side */}
                        <div className="px-5 py-3 flex items-center justify-between bg-gradient-to-r from-[#13291D]/95 to-[#1B3A29]/95">
                          <span className="font-condensed text-lg font-bold text-white uppercase tracking-wider">
                            {battingTeam.shortCode}
                          </span>
                          <span className="font-condensed text-3xl sm:text-4xl font-bold text-white tabular-nums">
                            {liveInn.runs}/{liveInn.wickets}
                          </span>
                        </div>
                      </div>

                      {/* Sub-Strip: Overs + Target + Live Indicator & Quick Controls */}
                      <div className="px-5 py-2 bg-[#080B0F]/95 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
                          <span className="text-white font-bold">
                            {battingTeam.shortCode} {liveInn.runs}/{liveInn.wickets}{' '}
                            <span className="text-slate-400 font-normal">({oversTxt})</span>
                          </span>
                          {simState.targetRuns !== null && runsNeeded !== null && (
                            <span className="text-[#EAB308]">
                              Target {simState.targetRuns} · Need {runsNeeded} from {ballsRemaining}b
                            </span>
                          )}
                          {simState.activeModifiers?.label && (
                            <span className="text-[#93E6EE]">
                              · {simState.activeModifiers.label} ({simState.activeModifiers.remainingBalls}b)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase tracking-wider ${
                              simState.finished
                                ? 'border-slate-500/40 text-slate-300'
                                : simPaused
                                  ? 'border-amber-400/50 text-[#EAB308]'
                                  : 'border-[#4ADE80]/50 text-[#4ADE80]'
                            }`}
                          >
                            {simState.finished
                              ? savingSim
                                ? 'SAVING'
                                : 'FINAL'
                              : simPaused
                                ? 'PAUSED'
                                : 'LIVE'}
                          </span>
                          <button
                            onClick={() => setSimPaused((p) => !p)}
                            disabled={simState.finished}
                            className="cm27-btn-dark-3d px-2.5 py-1 rounded text-[11px] font-semibold text-white flex items-center gap-1 cursor-pointer disabled:opacity-40 whitespace-nowrap"
                          >
                            {simPaused ? (
                              <Play className="w-3 h-3 text-[#4ADE80]" />
                            ) : (
                              <Pause className="w-3 h-3 text-[#EAB308]" />
                            )}
                            <span>{simPaused ? 'Resume' : 'Pause'}</span>
                          </button>
                          <button
                            onClick={handleFinishInstant}
                            disabled={simState.finished}
                            className="cm27-btn-3d px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40 whitespace-nowrap"
                          >
                            <FastForward className="w-3 h-3" />
                            <span>Instant Finish</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 3. Centered CRR / RRR Wide Broadcast Bar */}
                    <div className="rounded-md border border-white/[0.08] bg-[#0B0F15]/85 py-3 px-6 flex items-center justify-center gap-12">
                      <div className="text-center">
                        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                          CRR
                        </div>
                        <div className="font-condensed text-3xl sm:text-4xl font-bold text-white tabular-nums leading-tight">
                          {crr}
                        </div>
                      </div>
                      {rrr && (
                        <div className="text-center border-l border-white/10 pl-12">
                          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                            RRR
                          </div>
                          <div className="font-condensed text-3xl sm:text-4xl font-bold text-[#EAB308] tabular-nums leading-tight">
                            {rrr}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. Full-Width WIN % Split Meter */}
                    <div className="space-y-1.5 px-1">
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className="text-slate-200 font-bold">
                          {bowlingTeam.shortCode} {winSplit.bowlingPct}%
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                          WIN %
                        </span>
                        <span className="text-slate-200 font-bold">
                          {winSplit.battingPct}% {battingTeam.shortCode}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#1C1417] overflow-hidden flex">
                        <div
                          className="h-full bg-[#4ADE80] transition-all duration-300"
                          style={{ width: `${winSplit.bowlingPct}%` }}
                        />
                        <div
                          className="h-full bg-rose-500/80 transition-all duration-300"
                          style={{ width: `${winSplit.battingPct}%` }}
                        />
                      </div>
                    </div>

                    {/* 5. Main Two-Column Match Center (Left Batters/P'Ship/Bowler/Last10 | Right Tactical Control) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      {/* Left 6 Columns */}
                      <div className="lg:col-span-6 space-y-4">
                        <div className="rounded-md border border-white/[0.08] bg-[#0B0E14]/85 overflow-hidden">
                          {[
                            {
                              row: striker,
                              onStrike: true,
                              plan: userIsBatting ? tacticPreset : 'Normal',
                            },
                            {
                              row: nonStriker,
                              onStrike: false,
                              plan: userIsBatting ? partnerTacticPreset : 'Normal',
                            },
                          ].map(
                            ({ row, onStrike, plan }, idx) =>
                              row && (
                                <div
                                  key={row.player.id}
                                  className={`px-5 py-4 flex items-center justify-between gap-4 ${
                                    idx === 1 ? 'border-t border-white/[0.07]' : ''
                                  } ${
                                    onStrike
                                      ? 'bg-gradient-to-r from-[#282213]/75 via-[#181713]/70 to-[#0C1016]/90'
                                      : 'bg-[#0B0E14]/75'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      {onStrike && (
                                        <span className="text-[#EAB308] font-bold text-sm">*</span>
                                      )}
                                      <span
                                        className={`font-condensed text-xl sm:text-2xl font-bold uppercase tracking-wide truncate ${
                                          onStrike ? 'text-[#FDE68A]' : 'text-white'
                                        }`}
                                      >
                                        {row.player.name.split(' ').slice(-1)[0]}
                                      </span>
                                      <span className="text-xs text-slate-400 truncate hidden sm:inline">
                                        {row.player.name}
                                      </span>
                                    </div>
                                    <div className="text-[11px] font-mono uppercase tracking-wider text-amber-300/75 mt-1">
                                      {plan}
                                    </div>
                                  </div>

                                  <div className="flex items-baseline gap-2 shrink-0 tabular-nums">
                                    <span className="font-condensed text-3xl font-bold text-white">
                                      {row.runs}
                                    </span>
                                    <span className="text-xs font-mono text-slate-400">
                                      ({row.balls})
                                    </span>
                                    <span className="text-xs font-mono text-slate-400 ml-2">
                                      SR{' '}
                                      {row.balls > 0
                                        ? Math.round((row.runs / row.balls) * 100)
                                        : 0}
                                    </span>
                                  </div>
                                </div>
                              )
                          )}

                          {/* Footer: Partnership Left | Bowler Spell Right */}
                          <div className="px-5 py-3 bg-[#080B0F]/95 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
                            <div className="text-slate-400">
                              P&apos;SHIP{' '}
                              <span className="text-white font-bold ml-1.5">
                                {liveInn.partnershipRuns}
                              </span>{' '}
                              <span className="text-slate-500">({liveInn.partnershipBalls})</span>
                            </div>
                            {bowler && (
                              <div className="text-slate-300">
                                <span className="text-slate-500 mr-1.5">
                                  {bowlingTeam.shortCode}
                                </span>
                                <span className="font-bold text-white uppercase mr-2">
                                  {bowler.player.name.split(' ').slice(-1)[0]}
                                </span>
                                <span className="text-slate-300">
                                  {formatOvers(bowler.balls, bpo)}-{bowler.runs}-{bowler.wickets}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* LAST 10 Circular Ball History */}
                        <div className="flex items-center justify-center gap-2 flex-wrap py-1">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mr-1">
                            LAST 10
                          </span>
                          {liveInn.last10Balls.length === 0 ? (
                            <span className="text-xs font-mono text-slate-500">Ready for 1st ball</span>
                          ) : (
                            liveInn.last10Balls.map((b, i) => (
                              <span
                                key={i}
                                className={`w-7 h-7 rounded-full font-mono text-xs font-bold flex items-center justify-center border ${
                                  b === 'W'
                                    ? 'bg-rose-500/85 border-rose-400 text-white'
                                    : b === '6'
                                      ? 'bg-[#22C55E] border-[#4ADE80] text-[#05140B]'
                                      : b === '4'
                                        ? 'bg-[#93E6EE] border-cyan-200 text-[#071015]'
                                        : 'bg-[#121720] border-white/15 text-slate-200'
                                }`}
                              >
                                {b}
                              </span>
                            ))
                          )}
                        </div>

                        {/* Bottom Match Phase, Active Plan & Pace Selector */}
                        <div className="pt-2 text-center space-y-2">
                          <div className="text-xs text-slate-300">
                            Innings {simState.inningsNumber} · {phaseLabel} · {preview.venue}
                          </div>
                          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#EAB308]">
                            PLAN · {tacticPreset.toUpperCase()}
                          </div>
                          <div className="inline-flex items-center gap-1 p-0.5 rounded bg-[#080B10]/85 border border-white/[0.08]">
                            {(['slow', 'medium', 'quick'] as const).map((p) => (
                              <button
                                key={p}
                                onClick={() => setSimPace(p)}
                                className={`px-3 py-1 rounded text-[11px] font-semibold capitalize cursor-pointer transition-colors ${
                                  simPace === p
                                    ? 'bg-white/[0.14] text-white'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right 6 Columns: PAUSE TO CHANGE TACTICS + Live Commentary Tab */}
                      <div className="lg:col-span-6 cm27-panel p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-2.5">
                          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-400">
                            {simPaused ? 'TACTICS UNLOCKED (PAUSED)' : 'PAUSE TO CHANGE TACTICS'}
                          </div>
                          <div className="inline-flex items-center p-0.5 rounded bg-[#080B10]/85 border border-white/[0.08]">
                            <button
                              onClick={() => setSimRightTab('tactics')}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                                simRightTab === 'tactics'
                                  ? 'bg-white/[0.12] text-white'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Tactics
                            </button>
                            <button
                              onClick={() => setSimRightTab('commentary')}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                                simRightTab === 'commentary'
                                  ? 'bg-white/[0.12] text-white'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Commentary
                            </button>
                          </div>
                        </div>

                        {simRightTab === 'tactics' ? (
                          <div className="space-y-5">
                            {/* Player Tactical Panel 1: Striker (or Active Bowler when user is bowling) */}
                            {(() => {
                              const primaryPlayer = userIsBatting
                                ? striker?.player
                                : bowler?.player || striker?.player;
                              if (!primaryPlayer) return null;
                              const ovr = getPlayerOverall(primaryPlayer);
                              const archetype = userIsBatting
                                ? getBatterArchetypeLabel(primaryPlayer)
                                : getBowlerArchetypeLabel(primaryPlayer);
                              const metrics = userIsBatting
                                ? [
                                    { label: 'Timing', val: primaryPlayer.battingRating },
                                    { label: 'Technique', val: primaryPlayer.consistency },
                                    {
                                      label: 'Power',
                                      val: Math.min(99, Math.round(primaryPlayer.battingRating * 0.65 + primaryPlayer.temperament * 0.35)),
                                    },
                                    { label: 'Composure', val: primaryPlayer.temperament },
                                  ]
                                : [
                                    { label: 'Bowling', val: primaryPlayer.bowlingRating },
                                    { label: 'Accuracy', val: primaryPlayer.consistency },
                                    { label: 'Stamina', val: primaryPlayer.stamina ?? primaryPlayer.fitness },
                                    { label: 'Composure', val: primaryPlayer.temperament },
                                  ];

                              return (
                                <div className="space-y-2.5">
                                  <div className="flex items-baseline justify-between gap-3">
                                    <div className="flex items-baseline gap-2 min-w-0">
                                      <span className="font-condensed text-xl font-bold text-white uppercase truncate">
                                        {primaryPlayer.name.split(' ').slice(-1)[0]}
                                      </span>
                                      <span className="text-xs font-semibold text-[#EAB308]/90 truncate">
                                        {archetype}
                                      </span>
                                    </div>
                                    <span className="font-condensed text-xl font-bold text-slate-300 tabular-nums shrink-0">
                                      {ovr}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums">
                                    {metrics.map((m) => (
                                      <span key={m.label} className="text-slate-400">
                                        {m.label}{' '}
                                        <strong className="text-white font-mono ml-0.5">
                                          {m.val}
                                        </strong>
                                      </span>
                                    ))}
                                  </div>

                                  <div className="grid grid-cols-5 rounded overflow-hidden border border-white/[0.1] bg-[#0A0E14]">
                                    {TACTIC_SEGMENTS.map((seg) => {
                                      const active = tacticPreset === seg.id;
                                      return (
                                        <button
                                          key={seg.id}
                                          onClick={() => applyTacticPreset(seg.id, true)}
                                          className={`py-2 px-1 text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap truncate ${
                                            active
                                              ? 'bg-[#E2E8F0] text-[#090D12]'
                                              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                                          }`}
                                        >
                                          {seg.id}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="text-xs text-slate-400">{strikerHint}</div>
                                </div>
                              );
                            })()}

                            {/* Player Tactical Panel 2: Non-Striker (or Striker Threat when user is bowling) */}
                            {(() => {
                              const secondaryPlayer = userIsBatting
                                ? nonStriker?.player
                                : striker?.player;
                              if (!secondaryPlayer) return null;
                              const ovr = getPlayerOverall(secondaryPlayer);
                              const archetype = getBatterArchetypeLabel(secondaryPlayer);
                              const metrics = [
                                { label: 'Timing', val: secondaryPlayer.battingRating },
                                { label: 'Technique', val: secondaryPlayer.consistency },
                                {
                                  label: 'Power',
                                  val: Math.min(99, Math.round(secondaryPlayer.battingRating * 0.65 + secondaryPlayer.temperament * 0.35)),
                                },
                                { label: 'Composure', val: secondaryPlayer.temperament },
                              ];

                              return (
                                <div className="space-y-2.5 pt-3 border-t border-white/[0.07]">
                                  <div className="flex items-baseline justify-between gap-3">
                                    <div className="flex items-baseline gap-2 min-w-0">
                                      <span className="font-condensed text-xl font-bold text-white uppercase truncate">
                                        {secondaryPlayer.name.split(' ').slice(-1)[0]}
                                      </span>
                                      <span className="text-xs font-semibold text-[#EAB308]/90 truncate">
                                        {userIsBatting ? archetype : `Threat · ${archetype}`}
                                      </span>
                                    </div>
                                    <span className="font-condensed text-xl font-bold text-slate-300 tabular-nums shrink-0">
                                      {ovr}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums">
                                    {metrics.map((m) => (
                                      <span key={m.label} className="text-slate-400">
                                        {m.label}{' '}
                                        <strong className="text-white font-mono ml-0.5">
                                          {m.val}
                                        </strong>
                                      </span>
                                    ))}
                                  </div>

                                  <div className="grid grid-cols-5 rounded overflow-hidden border border-white/[0.1] bg-[#0A0E14]">
                                    {TACTIC_SEGMENTS.map((seg) => {
                                      const active = partnerTacticPreset === seg.id;
                                      return (
                                        <button
                                          key={seg.id}
                                          onClick={() => applyTacticPreset(seg.id, false)}
                                          className={`py-2 px-1 text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap truncate ${
                                            active
                                              ? 'bg-[#E2E8F0] text-[#090D12]'
                                              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                                          }`}
                                        >
                                          {seg.id}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="text-xs text-slate-400">{partnerHint}</div>
                                </div>
                              );
                            })()}

                            {/* Compact Live Ball Ticker Footer */}
                            {lastComment && (
                              <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between gap-3 text-xs">
                                <div className="text-slate-300 truncate">
                                  <span className="font-mono text-[#93E6EE] mr-2 tabular-nums">
                                    {lastComment.over}
                                  </span>
                                  <span>{lastComment.text}</span>
                                </div>
                                <button
                                  onClick={() => setSimRightTab('commentary')}
                                  className="text-[11px] font-mono text-[#93E6EE] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  All Commentary →
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                            {simState.commentary.map((c) => {
                              const upper = c.text.toUpperCase();
                              const badge = upper.startsWith('WICKET')
                                ? { label: 'WICKET', cls: 'bg-rose-500 text-white' }
                                : upper.startsWith('DROPPED CATCH')
                                  ? { label: 'DROPPED', cls: 'bg-amber-400 text-[#090C11]' }
                                  : upper.startsWith('MILESTONE')
                                    ? { label: 'MILESTONE', cls: 'bg-[#EAB308] text-[#090C11]' }
                                    : upper.startsWith('MAXIMUM SIX')
                                      ? { label: 'SIX', cls: 'bg-[#22C55E] text-[#05140B]' }
                                      : upper.startsWith('BOUNDARY FOUR')
                                        ? { label: 'FOUR', cls: 'bg-[#93E6EE] text-[#090C11]' }
                                        : null;
                              return (
                                <div
                                  key={c.id}
                                  className={`p-2.5 rounded border text-xs flex items-start gap-2.5 ${
                                    c.tone === 'wicket'
                                      ? 'bg-rose-500/10 border-rose-500/35 text-rose-200'
                                      : c.tone === 'boundary'
                                        ? 'bg-[#17202B] border-[#93E6EE]/45 text-slate-100'
                                        : 'bg-[#0C1016] border-white/[0.06] text-slate-300'
                                  }`}
                                >
                                  <span className="font-mono text-[10px] text-slate-400 shrink-0 mt-0.5 tabular-nums">
                                    {c.over}
                                  </span>
                                  {badge && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold shrink-0 ${badge.cls}`}
                                    >
                                      {badge.label}
                                    </span>
                                  )}
                                  <span>{c.text}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ================= COMPLETED MATCH SCORECARD ================= */}
          {stage === 'sim' && activeSummary && (
            <div className="space-y-5">
              <div className="cm27-panel border-[#93E6EE]/35 bg-gradient-to-r from-[#181E27] via-[#12161E] to-[#0C1016] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[#93E6EE]">
                    <Trophy className="w-4 h-4 text-[#EAB308]" />
                    <span>FINAL MATCH RESULT</span>
                  </div>
                  <h2 className="font-condensed text-3xl sm:text-4xl font-extrabold text-white uppercase">
                    {activeSummary.marginText}
                  </h2>
                  <p className="text-xs text-slate-300">
                    Coin: {activeSummary.coinResult} · Elected to {activeSummary.tossDecision} ·{' '}
                    {activeSummary.venue} ({activeSummary.pitchCondition})
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                  <div className="cm27-panel-inset px-4 py-2.5 border-[#EAB308]/35">
                    <div className="text-[10px] font-mono uppercase text-[#EAB308] flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      <span>Player of the Match</span>
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {activeSummary.manOfTheMatch}
                    </div>
                  </div>

                  {completedMatch && (
                    <button
                      onClick={() => setPressModalMatch(completedMatch)}
                      className="cm27-btn-dark-3d px-4 py-2.5 rounded font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 text-[#93E6EE]"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>
                        {completedMatch.pressConferenceCompleted
                          ? 'View Press Transcript'
                          : (completedMatch.pressConferenceJson?.questions?.length ?? 0) > 0
                            ? 'Address Press Conference'
                            : 'Press Briefing Compiling...'}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setCompletedMatch(null);
                      setSimState(null);
                      setStage('lineup');
                    }}
                    className="cm27-btn-3d px-4 py-2.5 rounded font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Play Another</span>
                  </button>
                </div>
              </div>

              {/* Scorecard Tabs */}
              <div className="cm27-panel overflow-hidden">
                <div className="px-4 pt-3 bg-[#0B0F15] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-5">
                    {[
                      { idx: 1 as const, inn: activeSummary.innings1 },
                      { idx: 2 as const, inn: activeSummary.innings2 },
                    ].map(({ idx, inn }) => (
                      <button
                        key={idx}
                        onClick={() => setActiveScorecardInnings(idx)}
                        className={`pb-3 text-xs font-semibold cursor-pointer transition-colors tabular-nums whitespace-nowrap shrink-0 border-b-2 ${
                          activeScorecardInnings === idx
                            ? 'border-[#93E6EE] text-white'
                            : 'border-transparent text-slate-400 hover:text-white'
                        }`}
                      >
                        {inn.teamShortCode}: {inn.runs}/{inn.wickets} ({inn.overs} ov)
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-mono text-slate-400 pb-2.5">
                    {activeScorecardInnings === 1
                      ? activeSummary.innings1.teamName
                      : activeSummary.innings2.teamName}{' '}
                    Innings
                  </span>
                </div>

                {(() => {
                  const inn =
                    activeScorecardInnings === 1
                      ? activeSummary.innings1
                      : activeSummary.innings2;
                  return (
                    <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-7 overflow-x-auto">
                        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                          Batting Card · Top: {inn.topScorer}
                        </div>
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#070B0D] text-slate-400 font-mono">
                            <tr>
                              <th className="py-2 px-3">Batter</th>
                              <th className="py-2 px-2">Dismissal</th>
                              <th className="py-2 px-2 text-right">R</th>
                              <th className="py-2 px-2 text-right">B</th>
                              <th className="py-2 px-2 text-right">4s</th>
                              <th className="py-2 px-2 text-right">6s</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.05]">
                            {inn.batters.map((b) => (
                              <tr key={b.playerId} className="hover:bg-white/[0.02]">
                                <td className="py-2 px-3 font-semibold text-white">{b.name}</td>
                                <td className="py-2 px-2 text-slate-400">{b.dismissal}</td>
                                <td className="py-2 px-2 text-right font-mono font-bold text-[#EAB308] tabular-nums">
                                  {b.runs}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-300 tabular-nums">
                                  {b.balls}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-400 tabular-nums">
                                  {b.fours}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-400 tabular-nums">
                                  {b.sixes}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="lg:col-span-5 overflow-x-auto">
                        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                          Bowling Attack · Best: {inn.topBowler}
                        </div>
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#070B0D] text-slate-400 font-mono">
                            <tr>
                              <th className="py-2 px-3">Bowler</th>
                              <th className="py-2 px-2 text-right">O</th>
                              <th className="py-2 px-2 text-right">R</th>
                              <th className="py-2 px-2 text-right">W</th>
                              <th className="py-2 px-2 text-right">Econ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.05]">
                            {inn.bowlers.map((bw) => (
                              <tr key={bw.playerId} className="hover:bg-white/[0.02]">
                                <td className="py-2 px-3 font-semibold text-white">{bw.name}</td>
                                <td className="py-2 px-2 text-right font-mono text-slate-300 tabular-nums">
                                  {bw.overs}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-300 tabular-nums">
                                  {bw.runs}
                                </td>
                                <td className="py-2 px-2 text-right font-mono font-bold text-[#4ADE80] tabular-nums">
                                  {bw.wickets}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-400 tabular-nums">
                                  {bw.econ}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {activeSummary.highlights?.length > 0 && (
                <div className="cm27-panel p-4 space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#EAB308]">
                    MATCH HIGHLIGHTS
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {activeSummary.highlights.map((hl, i) => (
                      <div
                        key={i}
                        className="cm27-panel-inset p-2.5 text-xs text-slate-300 flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80] shrink-0" />
                        <span>{hl}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
            </>
          )}
        </>
      )}

      {/* Recent League Match Results History */}
      {recentMatches.length > 0 && (
        <div className="cm27-panel p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-condensed text-2xl font-extrabold text-white uppercase">
              RECENT LEAGUE RESULTS ({recentMatches.length})
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Click any match to inspect full scorecard
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {recentMatches.slice(0, 9).map((m) => {
              const hTeam = state.teams.find((t) => t.id === m.homeTeamId);
              const aTeam = state.teams.find((t) => t.id === m.awayTeamId);
              const sum = m.resultSummaryJson;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setCompletedMatch(m);
                    setActiveScorecardInnings(1);
                    setSimState({
                      inningsNumber: 2,
                      targetRuns: null,
                      maxBallsPerInnings: 120,
                      ballsPerOver: 6,
                      innings1: {} as any,
                      innings2: {} as any,
                      completedInnings1Summary: null,
                      commentary: [],
                      highlights: [],
                      droppedCatches: [],
                      turningPoints: [],
                      momentum: 0,
                      activeModifiers: null,
                      triggeredMomentIds: [],
                      forcedNextBowlerIdx: null,
                      finished: true,
                    });
                    setHubView('match');
                    setStage('sim');
                  }}
                  className="cm27-hover-sweep cm27-panel-inset p-3.5 hover:border-[#93E6EE]/45 text-left cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-[#93E6EE] uppercase font-semibold">
                      {getFormatDisplayLabel(m.format)}
                    </span>
                    <span className="text-slate-500">{formatTimeAgo(m.createdAt)}</span>
                  </div>
                  <div className="text-xs font-bold text-white flex items-center justify-between">
                    <span>
                      {hTeam?.shortCode || 'HOME'} vs {aTeam?.shortCode || 'AWAY'}
                    </span>
                    {sum && (
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {sum.innings1.runs}/{sum.innings1.wickets} · {sum.innings2.runs}/
                        {sum.innings2.wickets}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#EAB308] truncate">{m.marginText}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Moment Tactical Decision Modal (Human-Controlled Live Simulation) */}
      {activeKeyMoment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl cm27-panel border-[#EAB308]/50 p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-3.5">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#EAB308] flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" />
                  <span>TACTICAL INTERVENTION · {activeKeyMoment.overLabel} OV</span>
                </div>
                <h3 className="font-condensed text-3xl font-extrabold text-white uppercase mt-1">
                  {activeKeyMoment.title}
                </h3>
                <p className="text-xs text-slate-300 mt-1">{activeKeyMoment.situation}</p>
              </div>
              <span className="px-2.5 py-1 rounded bg-[#EAB308]/15 border border-[#EAB308]/35 font-mono text-[10px] text-[#EAB308] uppercase shrink-0">
                SIM PAUSED
              </span>
            </div>

            <div className="space-y-2.5">
              {activeKeyMoment.choices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => handleSelectKeyMomentChoice(choice)}
                  className="cm27-hover-sweep w-full text-left p-4 rounded border border-white/10 bg-[#10151E] hover:border-[#93E6EE]/70 cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">{choice.label}</span>
                    <span className="text-[10px] font-mono text-[#93E6EE] shrink-0">
                      {choice.effectSummary}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{choice.detail}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Post-Match AI Press Conference Modal */}
      {pressModalMatch && (
        <PressConferenceModal
          leagueId={state.league.id}
          match={pressModalMatch}
          onClose={() => setPressModalMatch(null)}
          onCompleted={async () => {
            await onRefreshState();
          }}
          onToast={onToast}
        />
      )}
    </div>
  );
}
