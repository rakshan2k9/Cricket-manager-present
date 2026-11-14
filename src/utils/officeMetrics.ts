import type {
  LeagueFixture as Fixture,
  LeagueStandingRow as StandingRow,
  MatchRecord,
  Player,
  Team,
} from '../types/game';
import { getPlayerOverall } from './format';

export interface BoardObjectiveSummary {
  progressPct: number;
  statusLabel: 'ON TRACK' | 'AT RISK' | 'OFF TRACK';
  rank: number;
  totalTeams: number;
  targetRank: number;
  placesOff: number;
  headline: string;
  detail: string;
}

export function computeBoardObjectives(
  standings: StandingRow[],
  myTeamId: number | null | undefined,
  totalTeamsFallback = 8
): BoardObjectiveSummary {
  const totalTeams = Math.max(2, standings.length || totalTeamsFallback);
  const idx = myTeamId ? standings.findIndex((s) => s.teamId === myTeamId) : -1;
  const rank = idx >= 0 ? idx + 1 : Math.min(totalTeams, Math.ceil(totalTeams / 2));
  const targetRank = 1;
  const placesOff = Math.max(0, rank - targetRank);
  const myRow = idx >= 0 ? standings[idx] : null;
  const played = myRow?.played ?? 0;

  let progressPct: number;
  if (played === 0) {
    progressPct = 78;
  } else {
    const rankScore = Math.max(15, Math.round(((totalTeams - rank + 1) / totalTeams) * 100));
    const winRatio = myRow ? myRow.won / Math.max(1, myRow.played) : 0.5;
    progressPct = Math.max(18, Math.min(99, Math.round(rankScore * 0.65 + winRatio * 35)));
  }

  const statusLabel: 'ON TRACK' | 'AT RISK' | 'OFF TRACK' =
    progressPct >= 70 ? 'ON TRACK' : progressPct >= 45 ? 'AT RISK' : 'OFF TRACK';

  return {
    progressPct,
    statusLabel,
    rank,
    totalTeams,
    targetRank,
    placesOff,
    headline: 'Defend Domestic & League Supremacy',
    detail:
      placesOff === 0
        ? 'Currently sitting top of the table — keep momentum through the playoffs.'
        : `Sitting ${rank}${rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} — ${placesOff} place${placesOff === 1 ? '' : 's'} off 1st. Exhibition matches do not count toward this brief.`,
  };
}

export interface BudgetBreakdown {
  startingBudget: number;
  remainingBudget: number;
  spentBudget: number;
  spentPct: number;
  remainingPct: number;
  ringCircumference: number;
  spentStrokeLength: number;
  remainingStrokeLength: number;
}

export function computeBudgetBreakdown(
  startingBudget: number,
  remainingBudget: number,
  radius = 44
): BudgetBreakdown {
  const safeStart = Math.max(1, startingBudget || 1);
  const safeRemaining = Math.max(0, Math.min(safeStart, remainingBudget ?? safeStart));
  const spentBudget = Math.max(0, safeStart - safeRemaining);
  const spentPct = Math.round((spentBudget / safeStart) * 100);
  const remainingPct = 100 - spentPct;
  const ringCircumference = Number((2 * Math.PI * radius).toFixed(2));
  const remainingStrokeLength = Number(((remainingPct / 100) * ringCircumference).toFixed(2));
  const spentStrokeLength = Number((ringCircumference - remainingStrokeLength).toFixed(2));

  return {
    startingBudget: safeStart,
    remainingBudget: safeRemaining,
    spentBudget,
    spentPct,
    remainingPct,
    ringCircumference,
    spentStrokeLength,
    remainingStrokeLength,
  };
}

export interface CalendarDayCell {
  day: number;
  isToday: boolean;
  fixture: Fixture | null;
  opponent: Team | null;
  isHome: boolean;
}

export function buildCalendarMonthGrid(
  fixtures: Fixture[],
  teams: Team[],
  currentGameDay: number,
  myTeamId: number | null | undefined,
  totalDays = 30
): CalendarDayCell[] {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const fixtureByDay = new Map<number, Fixture>();

  for (const fx of fixtures) {
    const involvesMe = myTeamId ? fx.homeTeamId === myTeamId || fx.awayTeamId === myTeamId : true;
    const existing = fixtureByDay.get(fx.scheduledDay);
    if (!existing || involvesMe) {
      fixtureByDay.set(fx.scheduledDay, fx);
    }
  }

  const cells: CalendarDayCell[] = [];
  for (let day = 1; day <= totalDays; day++) {
    const fx = fixtureByDay.get(day) || null;
    let opponent: Team | null = null;
    let isHome = true;
    if (fx) {
      if (myTeamId && fx.homeTeamId === myTeamId) {
        opponent = teamMap.get(fx.awayTeamId) || null;
        isHome = true;
      } else if (myTeamId && fx.awayTeamId === myTeamId) {
        opponent = teamMap.get(fx.homeTeamId) || null;
        isHome = false;
      } else {
        opponent = teamMap.get(fx.awayTeamId) || teamMap.get(fx.homeTeamId) || null;
      }
    }
    cells.push({
      day,
      isToday: day === currentGameDay,
      fixture: fx,
      opponent,
      isHome,
    });
  }
  return cells;
}

export interface DevPlanAttributeCard {
  label: string;
  shortName: string;
  val: number;
  delta: number;
  barPct: number;
}

export interface DevelopmentPlanMetrics {
  planTitle: string;
  isBowlingFocus: boolean;
  ovr: number;
  potentialMin: number;
  potentialMax: number;
  coachingPct: number;
  matchXpPct: number;
  levelUpWeeks: number;
  roleGrowthLabel: string;
  attributes: DevPlanAttributeCard[];
}

export function computeDevelopmentPlanAttributes(
  player: Player | null,
  trajectory: string,
  intensity: 'Light' | 'Standard' | 'Intensive'
): DevelopmentPlanMetrics {
  const planTitle = (trajectory.includes('|') ? trajectory.split('|')[1] : trajectory)
    .trim()
    .toUpperCase();
  const isBowlingFocus =
    trajectory.includes('BOWL') ||
    (trajectory === 'Balanced' && player?.primaryRole === 'Bowler');

  const ovr = player ? getPlayerOverall(player) : 72;
  const potMax = Math.max(ovr, player?.potential ?? ovr + 6);
  const potMin = Math.max(ovr, potMax - 4);
  const coachingPct = intensity === 'Intensive' ? 84 : intensity === 'Standard' ? 65 : 48;
  const matchXpPct = Math.min(95, Math.max(25, Math.round((player?.currentForm ?? 65) * 0.85)));
  const levelUpWeeks = intensity === 'Intensive' ? 2 : intensity === 'Standard' ? 3 : 5;
  const roleGrowthLabel =
    trajectory === 'Balanced' || trajectory === 'Dynamic' ? trajectory : planTitle;

  if (!player) {
    return {
      planTitle,
      isBowlingFocus,
      ovr,
      potentialMin: potMin,
      potentialMax: potMax,
      coachingPct,
      matchXpPct,
      levelUpWeeks,
      roleGrowthLabel,
      attributes: [],
    };
  }

  const boost = intensity === 'Intensive' ? 1 : 0;
  const isBalanced = trajectory === 'Balanced' || trajectory === 'Dynamic';

  const rawAttrs = isBowlingFocus
    ? [
        {
          label: 'PACE / REVS',
          shortName: 'Pace / Revs',
          val: Math.min(98, player.bowlingRating),
          delta: trajectory.includes('New-ball') || isBalanced ? 1 + boost : 0,
        },
        {
          label: 'ACCURACY',
          shortName: 'Accuracy',
          val: Math.min(98, Math.round((player.bowlingRating + player.consistency) / 2)),
          delta: trajectory.includes('Containment') || isBalanced ? 1 + boost : 1,
        },
        {
          label: 'SWING / DRIFT',
          shortName: 'Swing / Drift',
          val: Math.min(97, Math.round(player.bowlingRating * 0.65 + player.temperament * 0.35)),
          delta: trajectory.includes('New-ball') || isBalanced ? 1 : 0,
        },
        {
          label: 'VARIATION',
          shortName: 'Variation',
          val: Math.min(96, Math.max(46, player.bowlingRating - 2)),
          delta: trajectory.includes('Death') || isBalanced ? 1 : 0,
        },
        {
          label: 'CONTROL',
          shortName: 'Control',
          val: Math.min(97, Math.round((player.consistency + player.temperament) / 2)),
          delta: trajectory.includes('Containment') || isBalanced ? 1 + boost : 0,
        },
        {
          label: 'YORKER / DEATH',
          shortName: 'Yorker / Death',
          val: Math.min(98, Math.round(player.bowlingRating * 0.72 + player.currentForm * 0.28)),
          delta: trajectory.includes('Death') ? 2 : isBalanced ? 1 : 0,
        },
      ]
    : [
        {
          label: 'TIMING',
          shortName: 'Timing',
          val: Math.min(98, player.battingRating),
          delta: trajectory.includes('Aggressor') || isBalanced ? 1 + boost : 1,
        },
        {
          label: 'TECHNIQUE',
          shortName: 'Technique',
          val: Math.min(97, player.consistency),
          delta: trajectory.includes('Anchor') || isBalanced ? 1 + boost : 0,
        },
        {
          label: 'POWER HITTING',
          shortName: 'Power Hitting',
          val: Math.min(99, Math.round(player.battingRating * 0.72 + player.currentForm * 0.32)),
          delta: trajectory.includes('Aggressor') || trajectory.includes('Finisher') ? 2 : isBalanced ? 1 : 0,
        },
        {
          label: 'PLACEMENT',
          shortName: 'Placement',
          val: Math.min(96, Math.round(player.battingRating * 0.65 + player.temperament * 0.35)),
          delta: trajectory.includes('Anchor') ? 1 + boost : 0,
        },
        {
          label: 'STRIKE ROTATION',
          shortName: 'Strike Rotation',
          val: Math.min(96, Math.round(player.fitness * 0.5 + player.temperament * 0.5)),
          delta: trajectory.includes('Finisher') || isBalanced ? 1 : 0,
        },
        {
          label: 'DEATH HITTING',
          shortName: 'Death Hitting',
          val: Math.min(97, Math.round(player.battingRating * 0.6 + player.currentForm * 0.4)),
          delta: trajectory.includes('Aggressor') || trajectory.includes('Finisher') || isBalanced ? 1 : 0,
        },
      ];

  return {
    planTitle,
    isBowlingFocus,
    ovr,
    potentialMin: potMin,
    potentialMax: potMax,
    coachingPct,
    matchXpPct,
    levelUpWeeks,
    roleGrowthLabel,
    attributes: rawAttrs.map((a) => ({
      ...a,
      barPct: Math.max(18, Math.min(100, a.val)),
    })),
  };
}

export interface ManagerCareerMetrics {
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  homeWins: number;
  homeMatches: number;
  homeWinPct: number;
  awayWins: number;
  awayMatches: number;
  awayWinPct: number;
}

export function computeManagerCareerStats(
  matches: MatchRecord[],
  myTeamId: number | null | undefined
): ManagerCareerMetrics {
  if (!myTeamId) {
    return {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      winPct: 0,
      homeWins: 0,
      homeMatches: 0,
      homeWinPct: 0,
      awayWins: 0,
      awayMatches: 0,
      awayWinPct: 0,
    };
  }

  let matchesPlayed = 0;
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let homeWins = 0;
  let homeMatches = 0;
  let awayWins = 0;
  let awayMatches = 0;

  for (const m of matches) {
    const isHome = m.homeTeamId === myTeamId;
    const isAway = m.awayTeamId === myTeamId;
    if (!isHome && !isAway) continue;
    matchesPlayed += 1;
    if (isHome) homeMatches += 1;
    if (isAway) awayMatches += 1;

    if (m.winnerTeamId === myTeamId) {
      wins += 1;
      if (isHome) homeWins += 1;
      else awayWins += 1;
    } else if (m.winnerTeamId) {
      losses += 1;
    } else {
      ties += 1;
    }
  }

  return {
    matchesPlayed,
    wins,
    losses,
    ties,
    winPct: matchesPlayed ? Math.round((wins / matchesPlayed) * 100) : 0,
    homeWins,
    homeMatches,
    homeWinPct: homeMatches ? Math.round((homeWins / homeMatches) * 100) : 0,
    awayWins,
    awayMatches,
    awayWinPct: awayMatches ? Math.round((awayWins / awayMatches) * 100) : 0,
  };
}
