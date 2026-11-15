import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCalendarAdvanceStep } from './scheduleEngine.ts';
import { computeBallProbabilities } from '../utils/cricketEngine.ts';
import {
  computeFormScore,
  computeWinChance,
  getPlayerOverallRating,
  simulateCricketMatch,
  type SimPlayerInput,
  type SimTeamInput,
} from './matchEngine.ts';
import { getAiTeamTargets, shouldSkipLotForTeam } from './auctionEngine.ts';
import { buildRealCricketPlayerPool } from './realCricketData.ts';

function makePlayer(id: number, name: string, rating: number, role: string): SimPlayerInput {
  const isBowler = role === 'Bowler';
  const isAr = role === 'All-Rounder';
  return {
    id,
    name,
    country: 'India',
    leagueOrigin: 'IPL',
    primaryRole: role,
    battingHand: 'Right-hand',
    bowlingStyle: isBowler || isAr ? 'Right-arm fast' : 'None',
    battingRating: isBowler ? 32 : rating,
    bowlingRating: isBowler ? rating : isAr ? Math.max(60, rating - 4) : 25,
    fieldingRating: 75,
    fitness: 88,
    consistency: 76,
    temperament: 76,
    potential: rating,
    currentForm: 70,
    morale: 75,
    stamina: 95,
  };
}

function makeXI(baseId: number, rating: number): SimPlayerInput[] {
  return [
    makePlayer(baseId + 1, `Bat1_${baseId}`, rating, 'Batsman'),
    makePlayer(baseId + 2, `Bat2_${baseId}`, rating, 'Batsman'),
    makePlayer(baseId + 3, `Bat3_${baseId}`, rating, 'Batsman'),
    makePlayer(baseId + 4, `WK_${baseId}`, rating, 'Wicketkeeper'),
    makePlayer(baseId + 5, `Bat4_${baseId}`, rating, 'Batsman'),
    makePlayer(baseId + 6, `AR1_${baseId}`, rating, 'All-Rounder'),
    makePlayer(baseId + 7, `AR2_${baseId}`, rating, 'All-Rounder'),
    makePlayer(baseId + 8, `Bwl1_${baseId}`, rating, 'Bowler'),
    makePlayer(baseId + 9, `Bwl2_${baseId}`, rating, 'Bowler'),
    makePlayer(baseId + 10, `Bwl3_${baseId}`, rating, 'Bowler'),
    makePlayer(baseId + 11, `Bwl4_${baseId}`, rating, 'Bowler'),
  ];
}

function makeTeam(id: number, code: string): SimTeamInput {
  return {
    id,
    name: `${code} Club`,
    shortCode: code,
    leagueCategory: 'IPL',
    homeGround: 'Wankhede Stadium',
    reputation: 80,
    tacticsJson: {
      t20Tempo: 'Balanced',
      odiTempo: 'Balanced',
      testTempo: 'Measured',
      aimRpo: 8.8,
      powerplayAggression: 'Balanced',
      deathPlan: 'Yorker Focus',
    },
    hiredStaffJson: [],
  };
}

test('evaluateCalendarAdvanceStep skips idle AI days, pauses on human matchday < 24h, and auto-sims after 24h', () => {
  const nowMs = 1_750_000_000_000;
  const dayDurationSec = 86400; // 24 real hours
  const fixtures = [
    { id: 1, scheduledDay: 1, status: 'scheduled', isHumanInvolved: false },
    { id: 2, scheduledDay: 2, status: 'scheduled', isHumanInvolved: false },
    { id: 3, scheduledDay: 3, status: 'scheduled', isHumanInvolved: false },
    { id: 4, scheduledDay: 4, status: 'scheduled', isHumanInvolved: false },
    { id: 5, scheduledDay: 5, status: 'scheduled', isHumanInvolved: true },
    { id: 6, scheduledDay: 6, status: 'scheduled', isHumanInvolved: false },
  ];

  // Fast-forward Days 1-4 AI fixtures and pause on Day 5 for human fixture
  const pausedPlan = evaluateCalendarAdvanceStep({
    status: 'active',
    currentGameDay: 1,
    dayStartedAtMs: nowMs - 3600_000, // 1 hour elapsed
    dayDurationSec,
    nowMs,
    fixtures,
  });
  assert.deepEqual(pausedPlan.aiToSimulateIds, [1, 2, 3, 4]);
  assert.deepEqual(pausedPlan.overdueHumanToSimulateIds, []);
  assert.equal(pausedPlan.nextGameDay, 5);
  assert.equal(pausedPlan.pausedForHumanMatch, true);

  // If paused on Day 5 and >= 24h real time elapsed, overdue human match auto-simulates and day advances
  const overduePlan = evaluateCalendarAdvanceStep({
    status: 'active',
    currentGameDay: 5,
    dayStartedAtMs: nowMs - 86401_000,
    dayDurationSec,
    nowMs,
    fixtures: fixtures.map((f) => (f.id <= 4 ? { ...f, status: 'completed' } : f)),
  });
  assert.deepEqual(overduePlan.overdueHumanToSimulateIds, [5]);
  assert.deepEqual(overduePlan.aiToSimulateIds, [6]);
  assert.equal(overduePlan.pausedForHumanMatch, false);
  assert.ok(overduePlan.nextGameDay >= 6);

  // Setup/Auction league never advances or simulates fixtures
  const setupPlan = evaluateCalendarAdvanceStep({
    status: 'auction',
    currentGameDay: 1,
    dayStartedAtMs: nowMs - 200_000_000,
    dayDurationSec,
    nowMs,
    fixtures,
  });
  assert.equal(setupPlan.nextGameDay, 1);
  assert.equal(setupPlan.aiToSimulateIds.length, 0);
  assert.equal(setupPlan.overdueHumanToSimulateIds.length, 0);
});

test('computeBallProbabilities applies subtle tactical influence (~30% swing, chance remains dominant)', () => {
  const batter = {
    playerId: 1,
    name: 'Test Batter',
    runs: 14,
    balls: 12,
    battingRating: 80,
    form: 70,
    primaryRole: 'Batsman',
    battingSlot: 2,
  };
  const bowler = {
    playerId: 2,
    name: 'Test Bowler',
    balls: 6,
    runs: 8,
    wickets: 0,
    bowlingRating: 80,
    bowlingStyle: 'Right-arm fast',
    primaryRole: 'Bowler',
  };

  const normal = computeBallProbabilities({
    batter,
    bowler,
    battingStrategy: 'Normal',
    bowlingStrategy: 'Normal',
    format: 'T20',
    pitchCondition: 'Flat Batting Track · High Scoring',
    ballsBowled: 30,
    maxBalls: 120,
    inningsNumber: 1,
    runsScored: 40,
    wicketsLost: 1,
    targetRuns: null,
  });
  const ultra = computeBallProbabilities({
    batter,
    bowler,
    battingStrategy: 'Ultra-Attacking',
    bowlingStrategy: 'Normal',
    format: 'T20',
    pitchCondition: 'Flat Batting Track · High Scoring',
    ballsBowled: 30,
    maxBalls: 120,
    inningsNumber: 1,
    runsScored: 40,
    wicketsLost: 1,
    targetRuns: null,
  });

  const normalBoundary = normal.fourProb + normal.sixProb;
  const ultraBoundary = ultra.fourProb + ultra.sixProb;
  assert.ok(ultraBoundary > normalBoundary, 'Ultra-attacking slightly raises boundary chance');
  assert.ok(
    ultraBoundary - normalBoundary < 0.09,
    `Boundary shift should stay subtle (< 0.09), got ${(ultraBoundary - normalBoundary).toFixed(4)}`
  );
  assert.ok(
    ultra.wicketProb / normal.wicketProb < 1.32,
    `Wicket multiplier should stay bounded (< 1.32x), got ${(ultra.wicketProb / normal.wicketProb).toFixed(3)}`
  );
});

test('computeWinChance & simulateCricketMatch allow realistic upsets and respond to form', () => {
  const strongRatings = { bat: 86, bowl: 85, field: 84, overall: 85 };
  const underdogRatings = { bat: 71, bowl: 70, field: 70, overall: 70 };

  const evenOdds = computeWinChance(strongRatings, underdogRatings, 'T20');
  assert.ok(evenOdds.awayPct >= 16, `Underdog should have real upset odds >=16%, got ${evenOdds.awayPct}`);

  const hotUnderdogOdds = computeWinChance(
    strongRatings,
    underdogRatings,
    'T20',
    ['L', 'L', 'L'],
    ['W', 'W', 'W', 'W']
  );
  assert.ok(
    hotUnderdogOdds.awayPct > evenOdds.awayPct,
    'Hot recent form should boost win probability'
  );
  assert.ok(computeFormScore(['W', 'W']) > computeFormScore(['L', 'L']));

  const homeTeam = makeTeam(1, 'STR');
  const awayTeam = makeTeam(2, 'UND');
  const homeXI = makeXI(100, 84);
  const awayXI = makeXI(200, 72);

  let awayWins = 0;
  for (let i = 0; i < 30; i++) {
    const res = simulateCricketMatch({
      homeTeam,
      awayTeam,
      homeXI,
      awayXI,
      format: 'T20',
      pitchCondition: 'Two-Paced · Tactical Varied Pace',
      userCall: 'heads',
      userDecisionIfWon: 'bat',
      homeForm: ['L', 'L'],
      awayForm: ['W', 'W', 'W'],
    });
    if (res.winnerTeamId === awayTeam.id) awayWins++;
  }
  assert.ok(awayWins >= 1, `Underdogs on hot form should win at least once in 30 T20s (won ${awayWins})`);
});

test('Auction AI keeps 6%-15% carry-over reserve and respects stopBuyingInAutoSim at >= 22 squad', () => {
  for (let teamId = 1; teamId <= 10; teamId++) {
    const target = getAiTeamTargets(7, teamId, false, 22, 25, 1.0);
    assert.ok(
      target.carryOverReserve >= 600 && target.carryOverReserve <= 1500,
      `AI carryOverReserve should be 600L-1500L, got ${target.carryOverReserve}`
    );
  }

  // Human team with stopBuyingInAutoSim = true stops once squad >= 22, but still buys if < 22
  assert.equal(
    shouldSkipLotForTeam({
      squadCount: 21,
      targetSquadSize: 22,
      requiredMinSquad: 22,
      stopBuyingInAutoSim: true,
      isOverseasLot: false,
      overseasCount: 4,
      maxOverseas: 8,
    }),
    false
  );
  assert.equal(
    shouldSkipLotForTeam({
      squadCount: 22,
      targetSquadSize: 22,
      requiredMinSquad: 22,
      stopBuyingInAutoSim: true,
      isOverseasLot: false,
      overseasCount: 4,
      maxOverseas: 8,
    }),
    true
  );
});

test('buildRealCricketPlayerPool calibrates IPL & marquee stars clearly above non-IPL domestic players', () => {
  const pool = buildRealCricketPlayerPool(1, 50, 'IPL');
  const findOvr = (name: string) => {
    const p = pool.find((r) => r.name.toLowerCase() === name.toLowerCase());
    assert.ok(p, `Expected player ${name} in IPL pool`);
    return getPlayerOverallRating(p);
  };

  const kohli = findOvr('Virat Kohli');
  const bumrah = findOvr('Jasprit Bumrah');
  assert.ok(kohli >= 83, `Expected Virat Kohli OVR >= 83, got ${kohli}`);
  assert.ok(bumrah >= 83, `Expected Jasprit Bumrah OVR >= 83, got ${bumrah}`);

  // In full multi-league pool, non-IPL non-marquee domestic players stay <= 79
  const allPool = buildRealCricketPlayerPool(1, 50);
  const nonIplTierM = allPool.filter(
    (p) => p.leagueOrigin !== 'IPL' && p.basePrice <= 150 && p.leagueOrigin !== 'International'
  );
  assert.ok(nonIplTierM.length > 0);
  const maxDomestic = Math.max(...nonIplTierM.map((p) => getPlayerOverallRating(p)));
  assert.ok(maxDomestic <= 83, `Expected non-IPL non-marquee cap respected, got ${maxDomestic}`);
});
