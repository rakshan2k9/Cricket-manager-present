import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCalendarMonthGrid,
  computeBoardObjectives,
  computeBudgetBreakdown,
  computeDevelopmentPlanAttributes,
  computeManagerCareerStats,
} from './officeMetrics';
import type {
  LeagueFixture as Fixture,
  LeagueStandingRow as StandingRow,
  MatchRecord,
  Player,
  Team,
} from '../types/game';

test('computeBoardObjectives calculates pre-season and mid-season progress accurately', () => {
  const preSeason: StandingRow[] = [
    {
      teamId: 1,
      teamName: 'Yorkshire',
      shortCode: 'YOR',
      primaryColor: '#166534',
      secondaryColor: '#fff',
      templateKey: 'yorkshire',
      ownerUid: 'u1',
      ownerName: 'L.FM',
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
    },
    {
      teamId: 2,
      teamName: 'Durham',
      shortCode: 'DUR',
      primaryColor: '#1e3a8a',
      secondaryColor: '#fff',
      templateKey: 'durham',
      ownerUid: null,
      ownerName: null,
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
    },
  ];
  const objPre = computeBoardObjectives(preSeason, 1);
  assert.equal(objPre.rank, 1);
  assert.equal(objPre.statusLabel, 'ON TRACK');

  const trailing: StandingRow[] = [
    { ...preSeason[1], played: 4, won: 4, points: 8 },
    { ...preSeason[0], played: 4, won: 0, lost: 4, points: 0 },
  ];
  const objTrail = computeBoardObjectives(trailing, 1);
  assert.equal(objTrail.rank, 2);
  assert.equal(objTrail.placesOff, 1);
  assert.ok(objTrail.progressPct < 50);
});

test('computeBudgetBreakdown computes ring geometry and percentages cleanly', () => {
  const b = computeBudgetBreakdown(10000, 6000, 44);
  assert.equal(b.spentBudget, 4000);
  assert.equal(b.spentPct, 40);
  assert.equal(b.remainingPct, 60);
  assert.ok(Math.abs(b.spentStrokeLength + b.remainingStrokeLength - b.ringCircumference) < 0.05);
});

test('buildCalendarMonthGrid maps fixtures and current game day', () => {
  const teams = [
    { id: 1, shortCode: 'YOR', name: 'Yorkshire' },
    { id: 2, shortCode: 'DUR', name: 'Durham' },
  ] as Team[];
  const fixtures = [
    {
      id: 10,
      leagueId: 1,
      matchNumber: 1,
      scheduledDay: 4,
      homeTeamId: 2,
      awayTeamId: 1,
      format: 'T20',
      stage: 'league',
      venue: 'Riverside',
      status: 'scheduled',
      tossWinnerTeamId: null,
      matchId: null,
    },
  ] as unknown as Fixture[];

  const grid = buildCalendarMonthGrid(fixtures, teams, 1, 1, 30);
  assert.equal(grid.length, 30);
  assert.equal(grid[0].isToday, true);
  assert.equal(grid[3].fixture?.id, 10);
  assert.equal(grid[3].opponent?.shortCode, 'DUR');
  assert.equal(grid[3].isHome, false);
});

test('computeDevelopmentPlanAttributes generates 6 batting or bowling cards', () => {
  const player = {
    id: 1,
    name: 'M. Ali',
    primaryRole: 'Batsman',
    battingRating: 82,
    bowlingRating: 45,
    fieldingRating: 78,
    consistency: 79,
    temperament: 80,
    fitness: 86,
    currentForm: 76,
    potential: 89,
  } as Player;

  const batPlan = computeDevelopmentPlanAttributes(player, 'BAT | Aggressor', 'Intensive');
  assert.equal(batPlan.planTitle, 'AGGRESSOR');
  assert.equal(batPlan.attributes.length, 6);
  assert.equal(batPlan.attributes[0].label, 'TIMING');
  assert.equal(batPlan.levelUpWeeks, 2);

  const bowlPlan = computeDevelopmentPlanAttributes(player, 'BOWL | Death overs', 'Standard');
  assert.equal(bowlPlan.isBowlingFocus, true);
  assert.equal(bowlPlan.attributes[5].label, 'YORKER / DEATH');
  assert.equal(bowlPlan.attributes[5].delta, 2);
});

test('computeManagerCareerStats computes home and away win rates', () => {
  const matches = [
    { id: 1, homeTeamId: 1, awayTeamId: 2, winnerTeamId: 1 },
    { id: 2, homeTeamId: 2, awayTeamId: 1, winnerTeamId: 2 },
  ] as MatchRecord[];
  const stats = computeManagerCareerStats(matches, 1);
  assert.equal(stats.matchesPlayed, 2);
  assert.equal(stats.wins, 1);
  assert.equal(stats.losses, 1);
  assert.equal(stats.winPct, 50);
  assert.equal(stats.homeWinPct, 100);
  assert.equal(stats.awayWinPct, 0);
});
