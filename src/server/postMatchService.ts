import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  leagueNews,
  notifications,
  playerContracts,
  players,
  teams,
  type MatchResultSummary,
} from '../db/schema.ts';
import { getPlayerOverallRating } from './matchEngine.ts';
import { wsHub } from './wsHub.ts';

const INJURY_DIAGNOSES = [
  'Side Strain',
  'Hamstring Tightness',
  'Shoulder Soreness',
  'Groin Twinge',
  'Calf Fatigue',
];

export async function applyPostMatchProgression(params: {
  leagueId: number;
  matchId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeXIIds: number[];
  awayXIIds: number[];
  summary: MatchResultSummary;
}) {
  const { leagueId, matchId, homeTeamId, awayTeamId, homeXIIds, awayXIIds, summary } = params;

  const leagueTeams = await db
    .select()
    .from(teams)
    .where(and(eq(teams.leagueId, leagueId), inArray(teams.id, [homeTeamId, awayTeamId])));

  const homeTeam = leagueTeams.find((t) => t.id === homeTeamId);
  const awayTeam = leagueTeams.find((t) => t.id === awayTeamId);
  if (!homeTeam || !awayTeam) return;

  const contracts = await db
    .select({
      teamId: playerContracts.teamId,
      player: players,
    })
    .from(playerContracts)
    .innerJoin(players, eq(playerContracts.playerId, players.id))
    .where(
      and(
        eq(playerContracts.leagueId, leagueId),
        inArray(playerContracts.teamId, [homeTeamId, awayTeamId])
      )
    );

  // Also ensure XI players (in exhibition/pre-auction mode) get stamina/form updates
  const xiSet = new Set<number>([...homeXIIds, ...awayXIIds]);
  const contractedIds = new Set(contracts.map((c) => c.player.id));
  const extraXIIds = Array.from(xiSet).filter((id) => !contractedIds.has(id));
  const extraXIPlayers =
    extraXIIds.length > 0
      ? await db
          .select()
          .from(players)
          .where(and(eq(players.leagueId, leagueId), inArray(players.id, extraXIIds)))
      : [];

  const homeXISet = new Set(homeXIIds);
  const awayXISet = new Set(awayXIIds);

  // Build quick performance map from summary
  const batPerf = new Map<number, { runs: number; balls: number }>();
  const bowlPerf = new Map<number, { wickets: number; econ: number }>();
  for (const inn of [summary.innings1, summary.innings2]) {
    for (const b of inn.batters || []) {
      batPerf.set(b.playerId, { runs: b.runs, balls: b.balls });
    }
    for (const bw of inn.bowlers || []) {
      bowlPerf.set(bw.playerId, { wickets: bw.wickets, econ: bw.econ });
    }
  }

  const newsToInsert: Array<{
    leagueId: number;
    category: 'press' | 'upset' | 'injury' | 'training' | 'trade' | 'milestone';
    headline: string;
    summary: string;
    quote?: string | null;
    teamId?: number | null;
    playerId?: number | null;
    relatedMatchId?: number | null;
  }> = [];

  const handlePlayerRecord = async (p: typeof players.$inferSelect, team: typeof teams.$inferSelect, played: boolean) => {
    const teamWon = summary.winnerTeamId === team.id;
    const bat = batPerf.get(p.id);
    const bowl = bowlPerf.get(p.id);

    if (played) {
      const workloadCost =
        p.primaryRole === 'Bowler' || p.primaryRole === 'All-Rounder' ? 18 : 13;
      const nextStamina = Math.max(20, (p.stamina ?? 100) - workloadCost);
      const nextConsecutive = (p.consecutiveMatches ?? 0) + 1;

      let formShift = teamWon ? 1 : -1;
      let moraleShift = teamWon ? 3 : -2;
      if (bat && bat.runs >= 50) {
        formShift += 3;
        moraleShift += 5;
      } else if (bat && bat.runs >= 30) {
        formShift += 1;
        moraleShift += 2;
      } else if (bat && bat.runs <= 5 && bat.balls >= 3) {
        formShift -= 1;
        moraleShift -= 2;
      }
      if (bowl && bowl.wickets >= 3) {
        formShift += 3;
        moraleShift += 5;
      } else if (bowl && bowl.econ >= 11) {
        formShift -= 1;
        moraleShift -= 2;
      }

      const nextForm = Math.max(45, Math.min(96, p.currentForm + formShift));
      const nextMorale = Math.max(35, Math.min(98, p.morale + moraleShift));
      const nextFormDelta = Math.max(-4, Math.min(4, Math.round((nextForm - 70) / 8)));

      // Workload injury check (moderated frequency scaled by fatigue and base fitness)
      let nextInjuryGames = p.injuryGamesRemaining ?? 0;
      let nextInjuryStatus = p.injuryStatus || 'Fit';
      if (nextInjuryGames === 0 && (nextConsecutive >= 5 || nextStamina < 38)) {
        const baseRisk =
          (nextConsecutive >= 7 ? 0.055 : nextConsecutive >= 5 ? 0.025 : 0.015) +
          (nextStamina < 32 ? 0.045 : nextStamina < 38 ? 0.02 : 0);
        const fitnessFactor = (p.fitness ?? 75) >= 82 ? 0.65 : (p.fitness ?? 75) <= 60 ? 1.2 : 1.0;
        const risk = Math.min(0.11, baseRisk * fitnessFactor);
        if (Math.random() < risk) {
          nextInjuryGames = Math.random() < 0.72 ? 1 : 2; // mostly 1-game, occasional 2-game niggles
          nextInjuryStatus =
            INJURY_DIAGNOSES[Math.floor(Math.random() * INJURY_DIAGNOSES.length)];
          if (team.ownerUid) {
            const [injNotif] = await db
              .insert(notifications)
              .values({
                leagueId,
                targetUid: team.ownerUid,
                category: 'Medical Team',
                title: `Injury Report: ${p.name} ruled out (${nextInjuryGames} match${nextInjuryGames > 1 ? 'es' : ''})`,
                body: `Gaffer,\n\nOur physio staff assessed ${p.name} immediately after the match and confirmed a ${nextInjuryStatus.toLowerCase()} following ${nextConsecutive} consecutive heavy workloads (match stamina dropped to ${nextStamina}%).\n\n${p.name} will be unavailable for selection over the next ${nextInjuryGames} fixture${nextInjuryGames > 1 ? 's' : ''}. Resting him off the matchday sheet will restore fitness naturally; monitor replacement depth in Squad -> Lineups.\n\nClub Medical Desk`,
              })
              .returning();
            if (injNotif) wsHub.broadcastToLeague(leagueId, 'notification:new', injNotif);
          }
          if (team.ownerUid || Math.random() < 0.4) {
            newsToInsert.push({
              leagueId,
              category: 'injury',
              headline: `MEDICAL UPDATE: ${p.name} ruled out for ${nextInjuryGames} match${nextInjuryGames > 1 ? 'es' : ''}`,
              summary: `${team.name} medical staff confirmed ${p.name} sustained a ${nextInjuryStatus.toLowerCase()} after ${nextConsecutive} consecutive appearances (stamina dropped to ${nextStamina}%).`,
              teamId: team.id,
              playerId: p.id,
              relatedMatchId: matchId,
            });
          }
        }
      }

      await db
        .update(players)
        .set({
          stamina: nextStamina,
          consecutiveMatches: nextConsecutive,
          benchedStreak: 0,
          currentForm: nextForm,
          formDelta: nextFormDelta,
          morale: nextMorale,
          injuryGamesRemaining: nextInjuryGames,
          injuryStatus: nextInjuryStatus,
        })
        .where(eq(players.id, p.id));
    } else {
      // Rested on bench / recovering
      const nextStamina = Math.min(100, (p.stamina ?? 100) + 22);
      const curInj = p.injuryGamesRemaining ?? 0;
      let nextInjuryGames = curInj > 0 ? curInj - 1 : 0;
      let nextInjuryStatus = nextInjuryGames === 0 ? 'Fit' : p.injuryStatus;
      let nextBenched = curInj > 0 ? p.benchedStreak ?? 0 : (p.benchedStreak ?? 0) + 1;
      let nextMorale = p.morale;
      let nextTransferRequested = Boolean(p.transferRequested);

      const ovr = getPlayerOverallRating(p);
      if (ovr >= 74 && nextBenched >= 4 && !nextTransferRequested && curInj === 0) {
        nextTransferRequested = true;
        nextMorale = Math.max(35, p.morale - 12);
        newsToInsert.push({
          leagueId,
          category: 'trade',
          headline: `TRANSFER REQUEST: Unsettled ${p.name} seeks move away from ${team.shortCode}`,
          summary: `Rated ${ovr} OVR, ${p.name} has been left on the ${team.name} bench for ${nextBenched} straight matches and has submitted a formal trade request ahead of the next round.`,
          quote: `"At this stage of my career I need regular overs in the middle. If opportunities aren't here, I'm open to a trade." — ${p.name}`,
          teamId: team.id,
          playerId: p.id,
          relatedMatchId: matchId,
        });
        if (team.ownerUid) {
          const [trNotif] = await db
            .insert(notifications)
            .values({
              leagueId,
              targetUid: team.ownerUid,
              category: 'Transfer Request',
              title: `${p.name} requests transfer away from ${team.shortCode}`,
              body: `Player Liaison Briefing,\n\n${p.name} (OVR ${ovr}, ${p.primaryRole}) has formally approached football operations after spending ${nextBenched} consecutive fixtures unused on the ${team.name} bench. Dressing-room morale has dipped to ${nextMorale}.\n\n"At this stage of my career I need regular overs in the middle. If opportunities aren't here, I'm open to a trade." — ${p.name}\n\nYou can restore match minutes in Squad -> Lineups or explore an outgoing trade package in Transfers.`,
            })
            .returning();
          if (trNotif) wsHub.broadcastToLeague(leagueId, 'notification:new', trNotif);
        }
      }

      await db
        .update(players)
        .set({
          stamina: nextStamina,
          consecutiveMatches: 0,
          benchedStreak: nextBenched,
          injuryGamesRemaining: nextInjuryGames,
          injuryStatus: nextInjuryStatus,
          morale: nextMorale,
          transferRequested: nextTransferRequested,
        })
        .where(eq(players.id, p.id));
    }
  };

  for (const row of contracts) {
    const team = row.teamId === homeTeamId ? homeTeam : awayTeam;
    const played = row.teamId === homeTeamId ? homeXISet.has(row.player.id) : awayXISet.has(row.player.id);
    await handlePlayerRecord(row.player, team, played);
  }

  for (const p of extraXIPlayers) {
    const team = homeXISet.has(p.id) ? homeTeam : awayTeam;
    await handlePlayerRecord(p, team, true);
  }

  // Clear single-match press/rivalry buffs on participating teams after match completion
  await db
    .update(teams)
    .set({
      rivalryBuffJson: null,
      pressMoraleBuff: 0,
    })
    .where(and(eq(teams.leagueId, leagueId), inArray(teams.id, [homeTeamId, awayTeamId])));

  // Milestones & Upset detection for The League Gazette
  for (const inn of [summary.innings1, summary.innings2]) {
    for (const b of inn.batters || []) {
      if (b.runs >= 100) {
        newsToInsert.push({
          leagueId,
          category: 'milestone',
          headline: `CENTURY MASTERCLASS: ${b.name} blasts ${b.runs} (${b.balls}b) for ${inn.teamShortCode}`,
          summary: `A ruthless hundred featuring ${b.fours} fours and ${b.sixes} sixes lit up ${summary.venue}.`,
          teamId: inn.teamId,
          playerId: b.playerId,
          relatedMatchId: matchId,
        });
        break;
      }
    }
    for (const bw of inn.bowlers || []) {
      if (bw.wickets >= 5) {
        newsToInsert.push({
          leagueId,
          category: 'milestone',
          headline: `FIVE-FOR STATEMENT: ${bw.name} runs riot (${bw.wickets}/${bw.runs})`,
          summary: `Precision bowling dismantled the batting lineup in ${bw.overs} overs at ${summary.venue}.`,
          teamId: inn.teamId === homeTeamId ? awayTeamId : homeTeamId,
          playerId: bw.playerId,
          relatedMatchId: matchId,
        });
        break;
      }
    }
  }

  // Upset headline when underdog wins convincingly
  if (summary.winnerTeamId) {
    const winner = summary.winnerTeamId === homeTeam.id ? homeTeam : awayTeam;
    const loser = winner.id === homeTeam.id ? awayTeam : homeTeam;
    if (loser.reputation - winner.reputation >= 5 || Math.abs(summary.innings1.runs - summary.innings2.runs) >= 45) {
      newsToInsert.push({
        leagueId,
        category: 'upset',
        headline: `${winner.shortCode} stun ${loser.shortCode}: ${summary.marginText}`,
        summary: `${winner.name} controlled key moments on a ${summary.pitchCondition.split('·')[0].trim()} surface as ${summary.manOfTheMatch} earned Player of the Match.`,
        teamId: winner.id,
        relatedMatchId: matchId,
      });
    }
  }

  if (newsToInsert.length > 0) {
    const inserted = await db.insert(leagueNews).values(newsToInsert).returning();
    for (const story of inserted) {
      wsHub.broadcastToLeague(leagueId, 'gazette:new', story);
    }
  }
}
