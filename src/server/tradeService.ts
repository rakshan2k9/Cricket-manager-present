import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { playerContracts, players, teams, tradeOffers } from '../db/schema.ts';
import { getPlayerOverallRating } from './matchEngine.ts';

export interface SquadNeedProfile {
  count: number;
  overseasCount: number;
  batters: number;
  bowlers: number;
  allRounders: number;
  keepers: number;
  needsBatting: boolean;
  needsBowling: boolean;
  needsWK: boolean;
  avgOvr: number;
}

export function analyzeTeamNeeds(teamPlayers: Array<typeof players.$inferSelect>): SquadNeedProfile {
  const batters = teamPlayers.filter((p) => p.primaryRole === 'Batsman').length;
  const bowlers = teamPlayers.filter((p) => p.primaryRole === 'Bowler').length;
  const allRounders = teamPlayers.filter((p) => p.primaryRole === 'All-Rounder').length;
  const keepers = teamPlayers.filter((p) => p.primaryRole === 'Wicketkeeper').length;
  const overseasCount = teamPlayers.filter((p) => p.isOverseas).length;
  const avgOvr =
    teamPlayers.length > 0
      ? Math.round(
          teamPlayers.reduce((s, p) => s + getPlayerOverallRating(p), 0) / teamPlayers.length
        )
      : 70;

  return {
    count: teamPlayers.length,
    overseasCount,
    batters,
    bowlers,
    allRounders,
    keepers,
    needsBatting: batters + allRounders < 8,
    needsBowling: bowlers + allRounders < 8,
    needsWK: keepers < 2,
    avgOvr,
  };
}

export function computeTradePlayerValue(player: typeof players.$inferSelect): number {
  const ovr = getPlayerOverallRating(player);
  const ageFactor = player.age <= 24 ? 1.14 : player.age >= 34 ? 0.84 : 1.0;
  const potFactor = 1 + Math.max(0, player.potential - ovr) * 0.014;
  const roleScarcity =
    player.primaryRole === 'All-Rounder'
      ? 1.12
      : player.primaryRole === 'Wicketkeeper'
        ? 1.08
        : 1.0;
  const transferDiscount = player.transferRequested ? 0.85 : 1.0;
  const baseValuation = Math.max(45, Math.round(Math.pow(Math.max(1, ovr - 45), 1.62) * 3.1));
  return Math.round(baseValuation * ageFactor * potFactor * roleScarcity * transferDiscount);
}

export function evaluateAiTradeProposal(params: {
  aiTeam: typeof teams.$inferSelect;
  aiPlayers: Array<typeof players.$inferSelect>;
  offeredToAi: Array<typeof players.$inferSelect>;
  requestedFromAi: Array<typeof players.$inferSelect>;
  cashToAiLakhs: number; // positive = human pays AI, negative = AI pays human
  minSquadSize: number;
  maxSquadSize: number;
  maxOverseas: number;
}): { accepted: boolean; reason: string } {
  const {
    aiTeam,
    aiPlayers,
    offeredToAi,
    requestedFromAi,
    cashToAiLakhs,
    minSquadSize,
    maxSquadSize,
    maxOverseas,
  } = params;

  const needs = analyzeTeamNeeds(aiPlayers);
  const newSize = aiPlayers.length - requestedFromAi.length + offeredToAi.length;
  if (newSize > maxSquadSize) {
    return {
      accepted: false,
      reason: `${aiTeam.shortCode} Front Office: Roster would exceed the ${maxSquadSize}-player squad cap.`,
    };
  }
  if (aiPlayers.length >= minSquadSize && newSize < minSquadSize) {
    return {
      accepted: false,
      reason: `${aiTeam.shortCode} Front Office: Cannot drop below the ${minSquadSize}-player minimum roster.`,
    };
  }

  const newOverseas =
    needs.overseasCount -
    requestedFromAi.filter((p) => p.isOverseas).length +
    offeredToAi.filter((p) => p.isOverseas).length;
  if (newOverseas > maxOverseas) {
    return {
      accepted: false,
      reason: `${aiTeam.shortCode} Front Office: Deal breaches the ${maxOverseas} overseas player quota.`,
    };
  }

  if (aiTeam.remainingBudget + cashToAiLakhs < 0) {
    return {
      accepted: false,
      reason: `${aiTeam.shortCode} Front Office: Insufficient remaining purse to fund the cash component.`,
    };
  }

  // Protect sole wicketkeeper
  const remainingKeepers =
    needs.keepers -
    requestedFromAi.filter((p) => p.primaryRole === 'Wicketkeeper').length +
    offeredToAi.filter((p) => p.primaryRole === 'Wicketkeeper').length;
  if (remainingKeepers < 1) {
    return {
      accepted: false,
      reason: `${aiTeam.shortCode} GM: We cannot leave the club without a specialist wicketkeeper.`,
    };
  }

  const scorePlayerForAi = (p: typeof players.$inferSelect, incoming: boolean) => {
    let val = computeTradePlayerValue(p);
    if (incoming) {
      if (needs.needsWK && p.primaryRole === 'Wicketkeeper') val *= 1.18;
      if (needs.needsBatting && (p.primaryRole === 'Batsman' || p.primaryRole === 'All-Rounder')) {
        val *= 1.12;
      }
      if (needs.needsBowling && (p.primaryRole === 'Bowler' || p.primaryRole === 'All-Rounder')) {
        val *= 1.12;
      }
    } else {
      // Outgoing: if player requested trade, AI more willing to deal
      if (p.transferRequested) val *= 0.88;
      // Protect marquee core stars (>83 OVR)
      if (getPlayerOverallRating(p) >= 83) val *= 1.18;
    }
    return val;
  };

  const incomingValue =
    offeredToAi.reduce((s, p) => s + scorePlayerForAi(p, true), 0) + cashToAiLakhs * 0.92;
  const outgoingValue = requestedFromAi.reduce((s, p) => s + scorePlayerForAi(p, false), 0);

  if (incomingValue >= outgoingValue * 0.97) {
    return {
      accepted: true,
      reason: `${aiTeam.shortCode} GM approved: Valuation and squad balance match our targets.`,
    };
  }

  const shortfall = Math.round(outgoingValue - incomingValue);
  return {
    accepted: false,
    reason: `${aiTeam.shortCode} GM declined: Package falls short by roughly ₹${Math.max(25, shortfall)}L in player/role value.`,
  };
}

export async function generateSmartAiTradeOffer(leagueId: number, humanTeamId: number) {
  const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
  const humanTeam = leagueTeams.find((t) => t.id === humanTeamId);
  if (!humanTeam) return null;

  const aiTeams = leagueTeams.filter((t) => !t.ownerUid && t.id !== humanTeamId);
  if (aiTeams.length === 0) return null;

  const existingPending = await db
    .select()
    .from(tradeOffers)
    .where(and(eq(tradeOffers.leagueId, leagueId), eq(tradeOffers.status, 'pending')));

  if (existingPending.filter((o) => o.recipientTeamId === humanTeamId && o.isAiInitiated).length >= 2) {
    return null;
  }

  const allContracts = await db
    .select({
      teamId: playerContracts.teamId,
      player: players,
    })
    .from(playerContracts)
    .innerJoin(players, eq(playerContracts.playerId, players.id))
    .where(eq(playerContracts.leagueId, leagueId));

  const byTeam = new Map<number, Array<typeof players.$inferSelect>>();
  for (const c of allContracts) {
    if (!byTeam.has(c.teamId)) byTeam.set(c.teamId, []);
    byTeam.get(c.teamId)!.push(c.player);
  }

  const humanRoster = byTeam.get(humanTeamId) || [];
  if (humanRoster.length < 2) return null;
  const humanNeeds = analyzeTeamNeeds(humanRoster);

  for (const aiTeam of aiTeams) {
    if (
      existingPending.some(
        (o) => o.proposerTeamId === aiTeam.id && o.recipientTeamId === humanTeamId
      )
    ) {
      continue;
    }

    const aiRoster = byTeam.get(aiTeam.id) || [];
    if (aiRoster.length < 4) continue;
    const aiNeeds = analyzeTeamNeeds(aiRoster);

    // Find a player AI can offer that fits human's weakest area (or strong squad depth)
    const desiredFromAiRole = humanNeeds.needsWK
      ? 'Wicketkeeper'
      : humanNeeds.needsBowling
        ? 'Bowler'
        : 'Batsman';
    const aiOfferCandidate =
      aiRoster
        .filter((p) => p.primaryRole === desiredFromAiRole && (p.injuryGamesRemaining ?? 0) === 0)
        .sort((a, b) => getPlayerOverallRating(b) - getPlayerOverallRating(a))[1] ||
      aiRoster
        .filter((p) => (p.injuryGamesRemaining ?? 0) === 0)
        .sort((a, b) => getPlayerOverallRating(b) - getPlayerOverallRating(a))[2];

    if (!aiOfferCandidate) continue;

    // Find a player on human roster matching AI needs & similar value
    const offerVal = computeTradePlayerValue(aiOfferCandidate);
    const desiredFromHumanRole = aiNeeds.needsBowling
      ? 'Bowler'
      : aiNeeds.needsBatting
        ? 'Batsman'
        : 'All-Rounder';

    const humanCandidate =
      humanRoster
        .filter(
          (p) =>
            p.isOverseas === aiOfferCandidate.isOverseas &&
            (p.primaryRole === desiredFromHumanRole || p.transferRequested)
        )
        .sort(
          (a, b) =>
            Math.abs(computeTradePlayerValue(a) - offerVal) -
            Math.abs(computeTradePlayerValue(b) - offerVal)
        )[0] ||
      humanRoster
        .filter((p) => p.isOverseas === aiOfferCandidate.isOverseas)
        .sort(
          (a, b) =>
            Math.abs(computeTradePlayerValue(a) - offerVal) -
            Math.abs(computeTradePlayerValue(b) - offerVal)
        )[0];

    if (!humanCandidate) continue;

    const valDiff = computeTradePlayerValue(humanCandidate) - offerVal;
    const cashSweetener =
      valDiff > 30 && aiTeam.remainingBudget >= Math.min(250, valDiff)
        ? Math.round(Math.min(250, valDiff) / 10) * 10
        : 0;

    const [created] = await db
      .insert(tradeOffers)
      .values({
        leagueId,
        proposerTeamId: aiTeam.id,
        recipientTeamId: humanTeamId,
        proposerUid: null,
        recipientUid: humanTeam.ownerUid,
        offeredPlayerIdsJson: [aiOfferCandidate.id],
        requestedPlayerIdsJson: [humanCandidate.id],
        cashDeltaLakhs: cashSweetener,
        status: 'pending',
        message: `${aiTeam.shortCode} GM Enquiry: We're targeting ${humanCandidate.name} (${humanCandidate.primaryRole}) and are prepared to send ${aiOfferCandidate.name}${cashSweetener > 0 ? ` plus ₹${cashSweetener}L` : ''} in exchange.`,
        aiEvaluationNote: `Targets ${desiredFromHumanRole.toLowerCase()} depth`,
        isAiInitiated: true,
      })
      .returning();

    return created;
  }

  return null;
}
