export type EngineFormat = 'T20' | 'ODI' | 'Test' | 'Hundred';
export type EngineStrategy = 'Defensive' | 'Normal' | 'Aggressive' | 'Ultra-Attacking';

export interface EnginePlayerProfile {
  id: number;
  name: string;
  primaryRole: string;
  battingHand?: string;
  bowlingStyle?: string;
  battingRating: number;
  bowlingRating: number;
  fieldingRating: number;
  fitness?: number;
  stamina?: number;
  consecutiveMatches?: number;
  traitsJson?: string[];
  consistency?: number;
  temperament?: number;
  currentForm?: number;
  morale?: number;
}

export interface EngineBowlerSlot {
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

export interface EngineBatterSlot {
  playerId: number;
  name: string;
  runs: number;
  balls: number;
  battingRating: number;
  form?: number;
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

export interface ActiveMatchModifiers {
  wicketMultDelta?: number;
  boundaryShiftDelta?: number;
  dotShiftDelta?: number;
  remainingBalls?: number;
  label?: string;
}

export function getFormatParamsShared(format: string) {
  switch (format) {
    case 'Hundred':
      return { maxBalls: 100, ballsPerOver: 5, baseRunRate: 1.5, maxBowlerQuota: 20 };
    case 'ODI':
      return { maxBalls: 300, ballsPerOver: 6, baseRunRate: 0.96, maxBowlerQuota: 60 };
    case 'Test':
      return { maxBalls: 540, ballsPerOver: 6, baseRunRate: 0.62, maxBowlerQuota: 132 };
    case 'T20':
    default:
      return { maxBalls: 120, ballsPerOver: 6, baseRunRate: 1.48, maxBowlerQuota: 24 };
  }
}

export function classifyBowlingCategory(bowlingStyle?: string): 'pace' | 'spin' {
  const s = (bowlingStyle || '').toLowerCase();
  if (!s || s === 'none' || s.includes('wicket')) return 'pace';
  if (
    s.includes('spin') ||
    s.includes('break') ||
    s.includes('orthodox') ||
    s.includes('wrist') ||
    s.includes('chinaman') ||
    s.includes('slow')
  ) {
    return 'spin';
  }
  return 'pace';
}

export type MatchPhase = 'powerplay' | 'middle' | 'death';

export function getMatchPhase(ballsBowled: number, maxBalls: number, format: string): MatchPhase {
  const progress = ballsBowled / Math.max(1, maxBalls);
  if (format === 'Test') {
    if (progress < 0.28) return 'powerplay';
    if (progress < 0.78) return 'middle';
    return 'death';
  }
  if (format === 'ODI') {
    if (progress < 0.2) return 'powerplay';
    if (progress < 0.8) return 'middle';
    return 'death';
  }
  if (format === 'Hundred') {
    if (ballsBowled < 25) return 'powerplay';
    if (ballsBowled < 75) return 'middle';
    return 'death';
  }
  if (ballsBowled < 36) return 'powerplay';
  if (ballsBowled < 90) return 'middle';
  return 'death';
}

export function selectNextBowlerIndex(
  bowlers: EngineBowlerSlot[],
  lastBowlerIdx: number,
  ballsBowled: number,
  maxBalls: number,
  ballsPerOver: number,
  maxBowlerQuota: number,
  format: string,
  pitchCondition: string,
  rng: () => number
): number {
  if (bowlers.length === 0) return 0;
  if (bowlers.length === 1) return 0;

  const phase = getMatchPhase(ballsBowled, maxBalls, format);
  const oversRemainingTotal = Math.max(1, Math.ceil((maxBalls - ballsBowled) / ballsPerOver));
  const pLower = pitchCondition.toLowerCase();
  const dryPitch = pLower.includes('dry') || pLower.includes('dusty') || pLower.includes('turner') || pLower.includes('spin');
  const seamPitch = pLower.includes('green') || pLower.includes('seam') || pLower.includes('humid');

  const rankedByBowl = bowlers
    .map((b, i) => ({ idx: i, rating: b.bowlingRating, cat: classifyBowlingCategory(b.bowlingStyle) }))
    .sort((a, b) => b.rating - a.rating);
  const topDeathSet = new Set(rankedByBowl.slice(0, 2).map((x) => x.idx));

  let eligibleIndices = bowlers
    .map((_, idx) => idx)
    .filter((idx) => idx !== lastBowlerIdx && bowlers[idx].balls < maxBowlerQuota);

  if (eligibleIndices.length === 0) {
    eligibleIndices = bowlers.map((_, idx) => idx).filter((idx) => bowlers[idx].balls < maxBowlerQuota);
  }
  if (eligibleIndices.length === 0) {
    eligibleIndices = bowlers.map((_, idx) => idx).filter((idx) => idx !== lastBowlerIdx);
  }
  if (eligibleIndices.length === 0) return 0;

  const othersWithQuota = eligibleIndices.filter((idx) => {
    const b = bowlers[idx];
    const oversUsed = b.balls / ballsPerOver;
    const econ = oversUsed >= 2 ? b.runs / oversUsed : 7.5;
    return econ < 11.5;
  });

  let bestIdx = eligibleIndices[0];
  let bestScore = -Infinity;

  for (const idx of eligibleIndices) {
    const b = bowlers[idx];
    const cat = classifyBowlingCategory(b.bowlingStyle);
    const oversUsed = b.balls / ballsPerOver;
    const maxOversAllowed = maxBowlerQuota / ballsPerOver;
    const oversLeftForBowler = Math.max(0, maxOversAllowed - oversUsed);
    const econ = oversUsed >= 1.5 ? b.runs / oversUsed : 7.5;
    const fitness = b.fitness ?? 82;
    const stamina = b.stamina ?? 100;
    const traits = b.traitsJson || [];

    let score = b.bowlingRating * 0.65;

    if (phase === 'powerplay') {
      score += cat === 'pace' ? 14 : -4;
      if (seamPitch && cat === 'pace') score += 6;
      if (traits.includes('Powerplay Enforcer')) score += 6;
      if (b.balls === 0 && idx <= 2) score += 8;
    } else if (phase === 'middle') {
      score += cat === 'spin' ? 13 : 1;
      if (dryPitch && cat === 'spin') score += 7;
      if (traits.includes('Partnership Breaker')) score += 5;
      if (b.primaryRole === 'All-Rounder') score += 4;
      if ((format === 'T20' || format === 'Hundred') && topDeathSet.has(idx) && oversUsed >= 2 && oversRemainingTotal >= 5) {
        score -= 10;
      }
    } else {
      score += cat === 'pace' ? 10 : 2;
      if (topDeathSet.has(idx)) score += 11;
      if (traits.includes('Death Specialist')) score += 9;
      if (b.bowlingRating >= 78) score += 6;
      if (dryPitch && cat === 'spin') score += 3;
    }

    if (oversUsed >= 2 && econ >= 11.5 && othersWithQuota.length > 0) {
      score -= Math.min(20, (econ - 10.5) * 3.5);
    } else if (oversUsed >= 1 && econ <= 6.2) {
      score += 4.5;
    }

    score += Math.min(6, oversLeftForBowler * 1.4);
    if (fitness < 72 && oversUsed >= 2) score -= 4;
    if (stamina < 55) score -= (55 - stamina) * 0.16;

    score += rng() * 5.5;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  return bestIdx;
}

export function pickBowlingAttackPool<T extends EnginePlayerProfile>(bowlingXI: T[]): T[] {
  const scored = [...bowlingXI].sort((a, b) => {
    const roleBonusA = a.primaryRole === 'Bowler' ? 12 : a.primaryRole === 'All-Rounder' ? 8 : 0;
    const roleBonusB = b.primaryRole === 'Bowler' ? 12 : b.primaryRole === 'All-Rounder' ? 8 : 0;
    return b.bowlingRating + roleBonusB - (a.bowlingRating + roleBonusA);
  });

  const genuineOptions = scored.filter(
    (p) => p.primaryRole === 'Bowler' || p.primaryRole === 'All-Rounder' || p.bowlingRating >= 55
  );
  const pool = genuineOptions.length >= 5 ? genuineOptions : scored;
  if (pool.length >= 6 && pool[5].bowlingRating >= 58) {
    return pool.slice(0, 6);
  }
  return pool.slice(0, Math.min(5, pool.length));
}

export interface BallOutcomeProbabilities {
  wicketProb: number;
  dotProb: number;
  oneProb: number;
  twoProb: number;
  threeProb: number;
  fourProb: number;
  sixProb: number;
}

export function computeBallProbabilities(params: {
  batter: EngineBatterSlot;
  bowler: EngineBowlerSlot;
  battingStrategy: EngineStrategy;
  bowlingStrategy: EngineStrategy;
  format: string;
  pitchCondition: string;
  ballsBowled: number;
  maxBalls: number;
  inningsNumber: 1 | 2;
  runsScored: number;
  wicketsLost: number;
  targetRuns: number | null;
  batCoachBonus?: number;
  bowlCoachBonus?: number;
  batRivalryBoost?: number;
  bowlRivalryBoost?: number;
  tacticalModifiers?: ActiveMatchModifiers | null;
}): BallOutcomeProbabilities {
  const {
    batter,
    bowler,
    battingStrategy,
    bowlingStrategy,
    format,
    pitchCondition,
    ballsBowled,
    maxBalls,
    inningsNumber,
    runsScored,
    wicketsLost,
    targetRuns,
    batCoachBonus = 0,
    bowlCoachBonus = 0,
    batRivalryBoost = 0,
    bowlRivalryBoost = 0,
    tacticalModifiers = null,
  } = params;

  const phase = getMatchPhase(ballsBowled, maxBalls, format);
  const bowlerCat = classifyBowlingCategory(bowler.bowlingStyle);
  const pitchLower = pitchCondition.toLowerCase();
  const isFlat = pitchLower.includes('flat');
  const isDry = pitchLower.includes('dry') || pitchLower.includes('dusty') || pitchLower.includes('turner') || pitchLower.includes('spin');
  const isSeam = pitchLower.includes('green') || pitchLower.includes('seam') || pitchLower.includes('humid');
  const isDew = pitchLower.includes('dew');
  const isTwoPaced = pitchLower.includes('two-paced') || pitchLower.includes('varied');

  const slot = batter.battingSlot ?? 3;
  const role = batter.primaryRole || 'Batsman';
  const isExtremeTail = (slot >= 9 && batter.battingRating < 45) || batter.battingRating < 28;
  const isPureTailender =
    isExtremeTail ||
    batter.battingRating < 35 ||
    (role === 'Bowler' && batter.battingRating < 46) ||
    (slot >= 7 && batter.battingRating < 48);
  const isTailender =
    isPureTailender ||
    (role === 'Bowler' && batter.battingRating < 64) ||
    (slot >= 7 && batter.battingRating < 60);
  const isBowlingAllRounder =
    !isPureTailender &&
    (role === 'All-Rounder' || (role === 'Bowler' && batter.battingRating >= 50)) &&
    slot >= 6 &&
    slot <= 8;
  const isLowerAllRounder = slot >= 6 && !isTailender;

  const batStamina = batter.stamina ?? 100;
  const batFatiguePenalty = batStamina < 65 ? -((65 - batStamina) * 0.14) : 0;
  const batTraits = batter.traitsJson || [];
  const batTraitBonus = isPureTailender
    ? 0
    : (phase === 'death' && batTraits.includes('Finisher') ? 3.5 : 0) +
      (phase === 'powerplay' && batTraits.includes('Powerplay Blaster') ? 2.5 : 0) +
      (wicketsLost >= 3 && batTraits.includes('Clutch Anchor') ? 2.5 : 0);

  const formBatDelta = (((batter.form ?? 70) - 70) / 30) * (isPureTailender ? 1.5 : 3.5);
  const moraleBatDelta = (((batter.morale ?? 70) - 70) / 30) * (isPureTailender ? 0.8 : 1.8);
  const consistencyBat = batter.consistency ?? 72;
  const temperamentBat = batter.temperament ?? 72;

  let effBatSkill =
    batter.battingRating +
    batCoachBonus +
    formBatDelta +
    moraleBatDelta +
    batFatiguePenalty +
    batTraitBonus +
    batRivalryBoost;
  if (isExtremeTail) {
    effBatSkill = Math.min(34, effBatSkill * 0.54);
  } else if (isPureTailender) {
    effBatSkill = Math.min(42, effBatSkill * 0.62);
  } else if (isTailender) {
    effBatSkill = Math.min(52, effBatSkill * 0.72);
  } else if (isLowerAllRounder && batter.battingRating < 70) {
    effBatSkill -= 3;
  }

  const batterBalls = batter.balls || 0;
  let settledWicketMult = 1.0;
  let settledShotBoost = 0;
  if (batterBalls < 5 && !isTailender) {
    settledWicketMult = format === 'Test' ? 1.15 : 1.09 - ((temperamentBat - 70) / 100) * 0.14;
    settledShotBoost = -0.012;
  } else if (batterBalls >= 16 && !isTailender) {
    settledWicketMult = 0.87;
    settledShotBoost = 0.018;
  } else if (isPureTailender && batterBalls < 6) {
    // Pure tail-enders are acutely vulnerable immediately on arrival
    settledWicketMult = 1.18;
  }

  const bowlStamina = bowler.stamina ?? 100;
  const bowlFatiguePenalty = bowlStamina < 68 ? -((68 - bowlStamina) * 0.18) : 0;
  const bowlWorkloadPenalty = (bowler.consecutiveMatches ?? 0) >= 4 ? -2.2 : 0;
  const bowlTraits = bowler.traitsJson || [];
  const bowlTraitBonus =
    (phase === 'death' && bowlTraits.includes('Death Specialist') ? 4.2 : 0) +
    (phase === 'middle' && bowlTraits.includes('Partnership Breaker') ? 3.0 : 0) +
    (phase === 'powerplay' && bowlTraits.includes('Powerplay Enforcer') ? 3.2 : 0) +
    (bowlTraits.includes('Spin Maestro') && bowlerCat === 'spin' ? 3.0 : 0);

  const formBowlDelta = (((bowler.currentForm ?? 70) - 70) / 30) * 3.5;
  const fitnessBowlPenalty = (bowler.fitness ?? 82) < 68 ? -2.5 : 0;
  let effBowlSkill =
    bowler.bowlingRating +
    bowlCoachBonus +
    formBowlDelta +
    fitnessBowlPenalty +
    bowlFatiguePenalty +
    bowlWorkloadPenalty +
    bowlTraitBonus +
    bowlRivalryBoost;

  let pitchBoundaryShift = 0;
  let pitchWicketMult = 1.0;
  let pitchDotShift = 0;

  if (isFlat) {
    effBatSkill += isPureTailender ? 1.0 : 3.8;
    pitchBoundaryShift += isPureTailender ? 0.008 : 0.034;
    pitchDotShift -= isPureTailender ? 0.006 : 0.025;
    pitchWicketMult *= 0.89;
  } else if (isDry) {
    if (bowlerCat === 'spin') effBowlSkill += 4.6;
    pitchBoundaryShift -= 0.019;
    pitchDotShift += 0.02;
    pitchWicketMult *= bowlerCat === 'spin' ? 1.12 : 1.02;
  } else if (isSeam) {
    if (bowlerCat === 'pace' && phase === 'powerplay') effBowlSkill += 5.4;
    else if (bowlerCat === 'pace') effBowlSkill += 2.5;
    pitchBoundaryShift -= 0.022;
    pitchDotShift += 0.024;
    pitchWicketMult *= phase === 'powerplay' ? 1.16 : 1.05;
  } else if (isTwoPaced) {
    if (phase !== 'powerplay') {
      pitchBoundaryShift -= 0.020;
      pitchDotShift += 0.016;
    }
    if (bowlerCat === 'spin' || phase === 'death') effBowlSkill += 2.6;
  }

  // Dew factor or 2nd innings chase wetness makes ball skid onto the bat and hampers spinners
  if (inningsNumber === 2 && (isDew || format === 'T20' || format === 'Hundred')) {
    const dewStrength = isDew ? 1.0 : 0.45;
    effBatSkill += (isPureTailender ? 0.6 : 1.6) * dewStrength;
    if (bowlerCat === 'spin') effBowlSkill -= 2.4 * dewStrength;
    pitchBoundaryShift += (isPureTailender ? 0.004 : 0.014) * dewStrength;
    pitchDotShift -= (isPureTailender ? 0.004 : 0.012) * dewStrength;
  }

  const rawEdge = effBatSkill - effBowlSkill;
  const consistencyDampen = 0.88 + (consistencyBat / 100) * 0.24;
  const skillEdge = Math.max(-0.44, Math.min(0.36, (rawEdge / 100) * consistencyDampen));

  let baseWicket = 0.044;
  let baseDot = 0.34;
  let baseFour = 0.132;
  let baseSix = 0.064;

  if (format === 'Test') {
    baseWicket = 0.019;
    baseDot = 0.62;
    baseFour = 0.072;
    baseSix = 0.008;
  } else if (format === 'ODI') {
    if (phase === 'powerplay') {
      baseWicket = 0.029;
      baseDot = 0.48;
      baseFour = 0.118;
      baseSix = 0.024;
    } else if (phase === 'middle') {
      baseWicket = 0.024;
      baseDot = 0.42;
      baseFour = 0.078;
      baseSix = 0.022;
    } else {
      baseWicket = 0.045;
      baseDot = 0.31;
      baseFour = 0.135;
      baseSix = 0.068;
    }
  } else {
    if (phase === 'powerplay') {
      baseWicket = 0.041;
      baseDot = 0.38;
      baseFour = 0.158;
      baseSix = 0.056;
    } else if (phase === 'middle') {
      baseWicket = 0.039;
      baseDot = 0.32;
      baseFour = 0.106;
      baseSix = 0.056;
    } else {
      baseWicket = 0.065;
      baseDot = 0.25;
      baseFour = 0.152;
      baseSix = 0.108;
    }
    if (format === 'Hundred') {
      baseFour += 0.006;
      baseSix += 0.005;
    }
  }

  let situationWicketMult = 1.0;
  let situationBoundaryShift = 0;
  let situationDotShift = 0;

  const ballsLeft = Math.max(1, maxBalls - ballsBowled);
  const progress = ballsBowled / Math.max(1, maxBalls);

  if (isExtremeTail) {
    const paceDeathMult =
      (bowlerCat === 'pace' ? 1.32 : 1.14) * (phase === 'death' ? 1.32 : 1.12);
    situationWicketMult *= 1.95 * paceDeathMult;
    situationBoundaryShift -= 0.13;
    situationDotShift += 0.24;
  } else if (isPureTailender) {
    const paceDeathMult =
      (bowlerCat === 'pace' ? 1.26 : 1.10) * (phase === 'death' ? 1.24 : 1.08);
    situationWicketMult *= 1.75 * paceDeathMult;
    situationBoundaryShift -= 0.105;
    situationDotShift += 0.18;
  } else if (isTailender) {
    situationWicketMult *= bowlerCat === 'pace' && phase === 'death' ? 1.65 : 1.48;
    situationBoundaryShift -= 0.072;
    situationDotShift += 0.11;
  } else if (wicketsLost >= 3 && progress < 0.55 && !isTailender) {
    const anchorFactor = 0.85 - ((temperamentBat - 70) / 100) * 0.12;
    situationWicketMult *= Math.max(0.72, anchorFactor);
    situationBoundaryShift -= 0.025;
    situationDotShift -= 0.015;
  }

  if (inningsNumber === 2 && targetRuns !== null && (format === 'T20' || format === 'Hundred' || format === 'ODI')) {
    const runsNeeded = Math.max(0, targetRuns - runsScored);
    const reqRpo = (runsNeeded / ballsLeft) * (format === 'Hundred' ? 5 : 6);
    const parRpo = format === 'ODI' ? 5.6 : 8.5;

    if (reqRpo > parRpo + 3.2 && runsNeeded > 12) {
      const pressure = Math.min(1, (reqRpo - (parRpo + 3.0)) / 5.5);
      situationBoundaryShift += (isPureTailender ? 0.008 : 0.036) * pressure;
      situationDotShift -= (isPureTailender ? 0.006 : 0.030) * pressure;
      const compResilience = Math.max(0.85, 1.06 - (temperamentBat - 70) / 180);
      situationWicketMult *= (1 + (isPureTailender ? 0.34 : 0.16) * pressure) * compResilience;
    } else if (reqRpo < parRpo - 2.0 && wicketsLost <= 4) {
      situationWicketMult *= 0.84;
      situationBoundaryShift -= 0.012;
      situationDotShift -= 0.02;
    }
  }

  let tacticBoundaryShift = 0;
  let tacticDotShift = 0;
  let tacticWicketMult = 1.0;

  // Minimal tactical nudge (~30% of prior swing) so wickets, 4s, and 6s remain chance-driven
  if (battingStrategy === 'Defensive') {
    tacticBoundaryShift -= 0.011;
    tacticDotShift += 0.010;
    tacticWicketMult *= 0.93;
  } else if (battingStrategy === 'Aggressive') {
    tacticBoundaryShift += isPureTailender ? 0.002 : 0.008;
    tacticDotShift -= isPureTailender ? 0.003 : 0.007;
    tacticWicketMult *= isPureTailender ? 1.07 : 1.04;
  } else if (battingStrategy === 'Ultra-Attacking') {
    tacticBoundaryShift += isPureTailender ? 0.003 : 0.014;
    tacticDotShift -= isPureTailender ? 0.004 : 0.012;
    tacticWicketMult *= isPureTailender ? 1.12 : wicketsLost >= 6 ? 1.04 : 1.09;
  }

  if (bowlingStrategy === 'Defensive') {
    tacticBoundaryShift -= 0.008;
    tacticDotShift += 0.007;
    tacticWicketMult *= 0.96;
  } else if (bowlingStrategy === 'Aggressive') {
    tacticBoundaryShift += 0.005;
    tacticDotShift -= 0.004;
    tacticWicketMult *= 1.03;
  } else if (bowlingStrategy === 'Ultra-Attacking') {
    tacticBoundaryShift += isPureTailender ? 0.002 : 0.010;
    tacticDotShift -= 0.006;
    tacticWicketMult *= isPureTailender ? 1.07 : wicketsLost >= 6 ? 1.02 : 1.06;
  }

  // Apply active Key Moment tactical decision modifiers
  if (tacticalModifiers) {
    tacticWicketMult *= 1 + (tacticalModifiers.wicketMultDelta || 0) * 0.45;
    tacticBoundaryShift +=
      (isPureTailender
        ? (tacticalModifiers.boundaryShiftDelta || 0) * 0.25
        : tacticalModifiers.boundaryShiftDelta || 0) * 0.45;
    tacticDotShift += (tacticalModifiers.dotShiftDelta || 0) * 0.45;
  }

  const maxWicketCap =
    format === 'T20' || format === 'Hundred'
      ? isExtremeTail
        ? 0.28
        : isPureTailender
          ? 0.24
          : isTailender
            ? 0.165
            : 0.098
      : format === 'ODI'
        ? isExtremeTail
          ? 0.21
          : isPureTailender
            ? 0.18
            : isTailender
              ? 0.125
              : 0.068
        : isExtremeTail
          ? 0.15
          : isPureTailender
            ? 0.12
            : 0.055;

  const rawWicket =
    (baseWicket - skillEdge * 0.045) *
    pitchWicketMult *
    settledWicketMult *
    situationWicketMult *
    tacticWicketMult;

  const wicketProb = Math.max(0.008, Math.min(maxWicketCap, rawWicket));

  const totalBoundaryShift =
    pitchBoundaryShift +
    settledShotBoost +
    situationBoundaryShift +
    tacticBoundaryShift +
    skillEdge * 0.15;

  const sixShare = phase === 'death' ? 0.44 : 0.34;
  // Rare <2% cameo probability strictly reserved for genuine bowling all-rounders at the death
  const bowlingAllRounderCameoBonus =
    isBowlingAllRounder && phase === 'death' && batter.battingRating >= 52 ? 0.012 : 0;

  let sixProb: number;
  let fourProb: number;

  if (isExtremeTail || batter.battingRating < 35) {
    // Pure #10/#11 or <35 batting rating: remove all boundary floors and impose strict tail-ender caps
    sixProb = Math.max(
      0.001,
      Math.min(format === 'Test' ? 0.002 : 0.007, baseSix * 0.14 + Math.max(-0.02, totalBoundaryShift) * 0.12)
    );
    fourProb = Math.max(
      0.006,
      Math.min(format === 'Test' ? 0.014 : 0.028, baseFour * 0.22 + Math.max(-0.04, totalBoundaryShift) * 0.24)
    );
  } else if (isPureTailender) {
    sixProb = Math.max(
      0.002,
      Math.min(format === 'Test' ? 0.003 : 0.014, baseSix * 0.26 + Math.max(-0.03, totalBoundaryShift) * 0.18)
    );
    fourProb = Math.max(
      0.012,
      Math.min(format === 'Test' ? 0.022 : 0.048, baseFour * 0.36 + Math.max(-0.05, totalBoundaryShift) * 0.34)
    );
  } else if (isTailender) {
    const sixMax = format === 'Test' ? 0.006 : isBowlingAllRounder && phase === 'death' ? 0.036 : 0.024;
    const fourMax = format === 'Test' ? 0.036 : 0.072;
    sixProb = Math.max(
      0.004,
      Math.min(sixMax, baseSix * 0.45 + totalBoundaryShift * sixShare * 0.55 + bowlingAllRounderCameoBonus)
    );
    fourProb = Math.max(
      0.018,
      Math.min(fourMax, baseFour * 0.55 + totalBoundaryShift * (1 - sixShare) * 0.65)
    );
  } else {
    sixProb = Math.max(
      format === 'Test' ? 0.003 : 0.012,
      Math.min(0.22, baseSix + totalBoundaryShift * sixShare + bowlingAllRounderCameoBonus)
    );
    fourProb = Math.max(
      0.032,
      Math.min(0.28, baseFour + totalBoundaryShift * (1 - sixShare))
    );
  }

  const dotProbRaw =
    baseDot +
    pitchDotShift +
    situationDotShift +
    tacticDotShift -
    skillEdge * 0.20 -
    settledShotBoost * 0.5;
  const dotProb = isExtremeTail
    ? Math.max(0.58, Math.min(0.76, dotProbRaw))
    : isPureTailender
      ? Math.max(0.52, Math.min(0.72, dotProbRaw))
      : Math.max(0.14, Math.min(0.72, dotProbRaw));

  const remaining = Math.max(isPureTailender ? 0.06 : 0.08, 1 - wicketProb - sixProb - fourProb - dotProb);
  const nonScoreSum = wicketProb + sixProb + fourProb + dotProb;
  let finalWicket = wicketProb;
  let finalSix = sixProb;
  let finalFour = fourProb;
  let finalDot = dotProb;
  let runningPool = remaining;

  const maxNonScore = isPureTailender ? 0.94 : 0.92;
  if (nonScoreSum > maxNonScore) {
    const scale = maxNonScore / nonScoreSum;
    finalWicket *= scale;
    finalSix *= scale;
    finalFour *= scale;
    finalDot *= scale;
    runningPool = 1 - maxNonScore;
  }

  const oneProb = runningPool * (isPureTailender ? 0.88 : 0.77);
  const twoProb = runningPool * (isPureTailender ? 0.11 : 0.19);
  const threeProb = runningPool * (isPureTailender ? 0.01 : 0.04);

  return {
    wicketProb: finalWicket,
    dotProb: finalDot,
    oneProb,
    twoProb,
    threeProb,
    fourProb: finalFour,
    sixProb: finalSix,
  };
}

export function shouldDropCatch(
  bowlingXI: Array<{ fieldingRating?: number; traitsJson?: string[] }>,
  rng: () => number
): boolean {
  if (!bowlingXI.length) return rng() < 0.09;
  const avgFielding =
    bowlingXI.reduce((s, p) => s + (p.fieldingRating ?? 70), 0) / bowlingXI.length;
  const hasElectricFielder = bowlingXI.some((p) =>
    (p.traitsJson || []).includes('Electric Fielder')
  );
  // 4% to 13% chance on a caught opportunity depending on fielding quality
  const dropProb = Math.max(
    0.035,
    Math.min(0.14, 0.135 - ((avgFielding - 60) / 40) * 0.07 - (hasElectricFielder ? 0.025 : 0))
  );
  return rng() < dropProb;
}

export function clampMomentum(val: number): number {
  return Math.max(-100, Math.min(100, Math.round(val)));
}

export function buildKeyMomentDilemma(params: {
  trigger: 'powerplay_collapse' | 'partnership_threat' | 'death_finish';
  overLabel: string;
  userIsBatting: boolean;
  battingShortCode: string;
  bowlingShortCode: string;
  strikerName: string;
  bowlerName: string;
  runs: number;
  wickets: number;
  runsNeeded: number | null;
  ballsRemaining: number;
}) {
  const {
    trigger,
    overLabel,
    userIsBatting,
    battingShortCode,
    runs,
    wickets,
    runsNeeded,
    ballsRemaining,
  } = params;

  if (trigger === 'powerplay_collapse') {
    if (userIsBatting) {
      return {
        id: `km-pp-${overLabel}`,
        title: 'KEY MOMENT: POWERPLAY CRISIS',
        situation: `${battingShortCode} have stumbled to ${runs}/${wickets} in the Powerplay. Your dressing room awaits a tactical call.`,
        overLabel,
        choices: [
          {
            id: 'pinch_hitter',
            label: 'Send Aggressive Counter-Attacker',
            detail: 'Promote an attacking hitter to disrupt the opening spell and seize back momentum.',
            effectSummary: '+Boundary Threat · +High Risk · +12 Momentum on strike',
            boundaryShiftDelta: 0.045,
            dotShiftDelta: -0.035,
            wicketMultDelta: 0.16,
            momentumShift: 10,
            promotePinchHitter: true,
          },
          {
            id: 'consolidate',
            label: 'Consolidate & Protect Wickets',
            detail: 'Instruct crease batters to leave hard lengths and rotate strike safely for 3 overs.',
            effectSummary: '-24% Wicket Risk · Steady Strike Rotation',
            boundaryShiftDelta: -0.028,
            dotShiftDelta: 0.015,
            wicketMultDelta: -0.24,
            momentumShift: 6,
          },
          {
            id: 'matchup_target',
            label: 'Target Shorter Boundary',
            detail: 'Back your set batter to manufacture lofted drives only into the short pocket.',
            effectSummary: '+2.5% Boundaries · Slight Wicket Edge',
            boundaryShiftDelta: 0.024,
            dotShiftDelta: -0.018,
            wicketMultDelta: 0.05,
            momentumShift: 8,
          },
        ] as [any, any, any],
      };
    }
    return {
      id: `km-pp-bowl-${overLabel}`,
      title: 'KEY MOMENT: SMELL BLOOD IN POWERPLAY',
      situation: `You have ${battingShortCode} rattled at ${runs}/${wickets}. Push for a knockout blow or tighten the noose?`,
      overLabel,
      choices: [
        {
          id: 'slip_attack',
          label: 'Bring Strike Paceman & Extra Slip',
          detail: 'Keep an aggressive ring with a slip in place to hunt one more top-order scalp.',
          effectSummary: '+22% Wicket Chance · +Boundary Leakage Risk',
          wicketMultDelta: 0.22,
          boundaryShiftDelta: 0.025,
          dotShiftDelta: -0.015,
          momentumShift: 12,
          bringStrikeBowler: true,
        },
        {
          id: 'tight_stumps',
          label: 'Attack the Stumps & Build Dots',
          detail: 'Bowl back-of-a-length into the hip and starve the new batter of room.',
          effectSummary: '+Dots · -Boundaries · Moderate Wicket Pressure',
          wicketMultDelta: 0.08,
          boundaryShiftDelta: -0.03,
          dotShiftDelta: 0.032,
          momentumShift: 8,
        },
        {
          id: 'early_spin',
          label: 'Surprise Early Spin Change',
          detail: 'Introduce spin inside the Powerplay to break the batters’ pace rhythm.',
          effectSummary: '+12% Wicket Chance · Balanced Economy',
          wicketMultDelta: 0.12,
          boundaryShiftDelta: -0.01,
          dotShiftDelta: 0.01,
          momentumShift: 7,
        },
      ] as [any, any, any],
    };
  }

  if (trigger === 'partnership_threat') {
    if (userIsBatting) {
      return {
        id: `km-mid-bat-${overLabel}`,
        title: 'KEY MOMENT: PLATFORM SET IN MIDDLE OVERS',
        situation: `${battingShortCode} stand at ${runs}/${wickets} with momentum building. Dictate the tempo into the back ten.`,
        overLabel,
        choices: [
          {
            id: 'accelerate_spin',
            label: 'Attack Middle-Over Spinners',
            detail: 'Use footwork to target the straight boundary before death specialists return.',
            effectSummary: '+4% Boundary Rate · +10% Wicket Risk',
            boundaryShiftDelta: 0.04,
            dotShiftDelta: -0.035,
            wicketMultDelta: 0.1,
            momentumShift: 10,
          },
          {
            id: 'rotate_deep',
            label: 'Milk Gaps & Preserve Launchpad',
            detail: 'Prioritize twos and singles to carry set batters into the final 5 overs.',
            effectSummary: '-18% Wicket Risk · High Strike Rotation',
            boundaryShiftDelta: -0.015,
            dotShiftDelta: -0.025,
            wicketMultDelta: -0.18,
            momentumShift: 7,
          },
          {
            id: 'tactical_hold',
            label: 'Hold Lower-Order Hitters Back',
            detail: 'Keep balanced tempo until the 16th over before unleashing power.',
            effectSummary: '-10% Wicket Risk · Controlled Tempo',
            boundaryShiftDelta: 0.008,
            dotShiftDelta: 0.005,
            wicketMultDelta: -0.1,
            momentumShift: 5,
          },
        ] as [any, any, any],
      };
    }
    return {
      id: `km-mid-bowl-${overLabel}`,
      title: 'KEY MOMENT: PARTNERSHIP BUILDING',
      situation: `${battingShortCode} are accelerating smoothly at ${runs}/${wickets}. Break the stand before it takes the game away.`,
      overLabel,
      choices: [
        {
          id: 'strike_breaker',
          label: 'Unleash Strike Bowler Mid-Innings',
          detail: 'Recall your premier wicket-taker for a sharp 1-over burst right now.',
          effectSummary: '+20% Wicket Chance · Uses 1 Strike Over Early',
          wicketMultDelta: 0.2,
          boundaryShiftDelta: 0.01,
          dotShiftDelta: 0.01,
          momentumShift: 10,
          bringStrikeBowler: true,
        },
        {
          id: 'defensive_ring',
          label: 'Switch to Defensive Boundary Ring',
          detail: 'Push 5 fielders to the rope and bowl wide slowers outside off stump.',
          effectSummary: '-3.5% Boundary Rate · +Dots · -12% Wicket Chance',
          wicketMultDelta: -0.12,
          boundaryShiftDelta: -0.035,
          dotShiftDelta: 0.025,
          momentumShift: 6,
        },
        {
          id: 'bouncer_plan',
          label: 'Bodyline Hard-Length Trap',
          detail: 'Squeeze the pull shot with deep square leg and fine leg patrolling.',
          effectSummary: '+12% Wicket Chance · -1.5% Boundaries',
          wicketMultDelta: 0.12,
          boundaryShiftDelta: -0.015,
          dotShiftDelta: 0.012,
          momentumShift: 7,
        },
      ] as [any, any, any],
    };
  }

  // Death finish
  const chaseDesc =
    runsNeeded !== null
      ? `Needing ${runsNeeded} from ${ballsRemaining} balls.`
      : `${battingShortCode} at ${runs}/${wickets} entering the final stretch.`;

  if (userIsBatting) {
    return {
      id: `km-death-bat-${overLabel}`,
      title: 'KEY MOMENT: FINAL DEATH SHOWDOWN',
      situation: `${chaseDesc} Set the finishing mandate for your batters.`,
      overLabel,
      choices: [
        {
          id: 'clear_rope',
          label: 'Full-Throttle Boundary Hunt',
          detail: 'Clear the front leg and back power hitting against death yorkers.',
          effectSummary: '+5.5% Boundaries · +22% Wicket Risk',
          boundaryShiftDelta: 0.055,
          dotShiftDelta: -0.045,
          wicketMultDelta: 0.22,
          momentumShift: 12,
        },
        {
          id: 'calculated_gaps',
          label: 'Calculated 2s & Late Scoop Innovation',
          detail: 'Manipulate fine third-man & deep backward square while keeping wickets intact.',
          effectSummary: '+2.5% Boundaries · -Dots · Balanced Risk',
          boundaryShiftDelta: 0.025,
          dotShiftDelta: -0.03,
          wicketMultDelta: -0.05,
          momentumShift: 9,
        },
        {
          id: 'take_deep',
          label: 'Take It to the Final Over',
          detail: 'Avoid reckless slogs on good yorkers and cash in on loose deliveries.',
          effectSummary: '-20% Wicket Risk · Steady Scoring',
          boundaryShiftDelta: 0.005,
          dotShiftDelta: -0.01,
          wicketMultDelta: -0.2,
          momentumShift: 6,
        },
      ] as [any, any, any],
    };
  }

  return {
    id: `km-death-bowl-${overLabel}`,
    title: 'KEY MOMENT: DEATH OVERS EXECUTION',
    situation: `${chaseDesc} Call your bowling & field strategy for the climax.`,
    overLabel,
    choices: [
      {
        id: 'hold_strike_19',
        label: 'Hold Back Strike Bowler & Yorker Plan',
        detail: 'Summon your top death bowler with fine leg up and deep mid-wicket back.',
        effectSummary: '-3.5% Boundary Leakage · +16% Wicket Chance',
        wicketMultDelta: 0.16,
        boundaryShiftDelta: -0.035,
        dotShiftDelta: 0.025,
        momentumShift: 12,
        bringStrikeBowler: true,
      },
      {
        id: 'wide_off_ring',
        label: 'Defensive Ring · Wide Off-Side Cutters',
        detail: 'Force batters to hit across the line to the longest boundary.',
        effectSummary: '-4.2% Boundary Rate · Low Risk Containment',
        wicketMultDelta: -0.06,
        boundaryShiftDelta: -0.042,
        dotShiftDelta: 0.03,
        momentumShift: 8,
      },
      {
        id: 'surprise_bouncer',
        label: 'Bluff With Hard Slower Bouncers',
        detail: 'Mix pace-off deliveries into the pitch to force miscues to the deep.',
        effectSummary: '+20% Wicket Chance · Moderate Boundary Risk',
        wicketMultDelta: 0.2,
        boundaryShiftDelta: -0.01,
        dotShiftDelta: 0.01,
        momentumShift: 9,
      },
    ] as [any, any, any],
  };
}

