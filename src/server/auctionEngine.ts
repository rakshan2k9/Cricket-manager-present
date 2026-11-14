import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  auctionPlayers,
  auctions,
  bids,
  leagueMessages,
  leagues,
  notifications,
  playerContracts,
  players,
  teams,
} from '../db/schema.ts';
import { getPlayerOverallRating } from './matchEngine.ts';
import { shuffleAuctionPoolByMarqueeSet } from './realCricketData.ts';
import { wsHub } from './wsHub.ts';

function deterministicHash(a: number, b: number): number {
  let x = (a * 374761393 + b * 668265263) ^ 0x5bf03635;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export interface PlayerMarketValuation {
  minVal: number;
  maxVal: number;
  targetBidRange: [number, number];
  maxFairValue: number;
  ovr: number;
  tier: 'marquee' | 'proven_domestic' | 'overseas_starter' | 'squad_role' | 'uncapped_emerging';
  isFringe: boolean;
}

export function calculatePlayerMarketValuation(
  player: {
    name: string;
    primaryRole: string;
    battingRating: number;
    bowlingRating: number;
    age?: number;
    isOverseas?: boolean;
    currentForm?: number;
    formDelta?: number;
    potential?: number;
    marqueeSet?: string | null;
    statsJson?: {
      t20?: {
        matches?: number;
        runs?: number;
        battingAvg?: number;
        strikeRate?: number;
        wickets?: number;
        economy?: number;
      };
    } | null;
  },
  basePrice: number,
  budgetScale = 1
): PlayerMarketValuation {
  const ovr = getPlayerOverallRating(player);
  const age = player.age ?? 27;
  const isMarquee = player.marqueeSet === 'Marquee Stars';
  const t20 = player.statsJson?.t20;
  const matches = t20?.matches || 0;
  const runs = t20?.runs || 0;
  const wickets = t20?.wickets || 0;
  const strikeRate = t20?.strikeRate || 124;
  const battingAvg = t20?.battingAvg || 22;
  const economy = t20?.economy || 8.1;
  const isOverseas = Boolean(player.isOverseas);

  const isUncappedOrEmerging =
    !isMarquee && ovr < 68 && matches < 45 && runs < 900 && wickets < 35;

  let tier: PlayerMarketValuation['tier'] = 'squad_role';
  let anchorMin = 150;
  let anchorMax = 450;
  let maxCapBase = 550;

  if ((isMarquee && (ovr >= 78 || runs >= 2200 || wickets >= 80)) || ovr >= 82) {
    tier = 'marquee';
    anchorMin = 1200;
    anchorMax = 1800;
    maxCapBase = 1950;
  } else if (!isUncappedOrEmerging && !isOverseas && (ovr >= 73 || (matches >= 65 && ovr >= 70))) {
    tier = 'proven_domestic';
    anchorMin = 800;
    anchorMax = 1350;
    maxCapBase = 1450;
  } else if (!isUncappedOrEmerging && isOverseas && ovr >= 72) {
    tier = 'overseas_starter';
    anchorMin = 400;
    anchorMax = 880;
    maxCapBase = 950;
  } else if (!isUncappedOrEmerging && ovr >= 66) {
    tier = 'squad_role';
    anchorMin = 150;
    anchorMax = 450;
    maxCapBase = 525;
  } else {
    tier = 'uncapped_emerging';
    anchorMin = Math.max(30, Math.min(90, basePrice));
    anchorMax = 195;
    maxCapBase = 220;
  }

  // Career stats & form multiplier
  const currentForm = player.currentForm ?? 70;
  const formMult = Math.max(0.88, Math.min(1.12, 1 + ((currentForm - 70) / 100) * 0.32));

  let statsMult = 1.0;
  if (player.primaryRole !== 'Bowler') {
    if (strikeRate >= 145 && battingAvg >= 30) statsMult += 0.08;
    else if (strikeRate < 115 && battingAvg < 20) statsMult -= 0.08;
  }
  if (player.primaryRole === 'Bowler' || player.primaryRole === 'All-Rounder') {
    if (wickets >= 60 && economy <= 7.35) statsMult += 0.08;
    else if (economy >= 9.0 && wickets < 35) statsMult -= 0.08;
  }
  if (tier !== 'uncapped_emerging' && age <= 24 && (player.potential ?? ovr) >= ovr + 5) {
    statsMult += 0.06;
  }

  // Age depreciation curve (protects against ₹14+ Cr bids on 37+ veterans like MS Dhoni)
  let ageMult = 1.0;
  if (age >= 40) ageMult = 0.42;
  else if (age >= 37) ageMult = 0.56;
  else if (age >= 35) ageMult = 0.80;
  else if (age >= 32) ageMult = 0.94;

  const combinedMult = formMult * statsMult * ageMult;

  let rawMin = Math.round(anchorMin * combinedMult * budgetScale);
  let rawMax = Math.round(anchorMax * combinedMult * budgetScale);
  let maxFairValue = Math.round(maxCapBase * Math.min(1.05, formMult * statsMult) * ageMult * budgetScale);

  // Strict real-world benchmark clamps
  if (age >= 37) {
    if (isMarquee || ovr >= 80) {
      // Iconic veterans (e.g., MS Dhoni) sit cleanly in ₹4 Cr - ₹6.5 Cr with ₹7 Cr ceiling
      rawMin = Math.max(Math.round(400 * budgetScale), Math.min(Math.round(525 * budgetScale), rawMin));
      rawMax = Math.max(rawMin + 75, Math.min(Math.round(650 * budgetScale), Math.max(Math.round(575 * budgetScale), rawMax)));
      maxFairValue = Math.max(rawMax, Math.min(Math.round(700 * budgetScale), maxFairValue));
    } else {
      rawMax = Math.min(Math.round(400 * budgetScale), rawMax);
      maxFairValue = Math.min(Math.round(425 * budgetScale), maxFairValue);
    }
  } else if (tier === 'uncapped_emerging') {
    // Uncapped domestic / emerging players (e.g., Gurnoor Brar) strictly ₹30L - ₹2.2 Cr max
    const uncappedMax = Math.max(basePrice, Math.round(220 * budgetScale));
    rawMin = Math.max(basePrice, Math.min(Math.round(120 * budgetScale), rawMin));
    rawMax = Math.max(rawMin + 25, Math.min(Math.round(195 * budgetScale), rawMax));
    maxFairValue = Math.max(rawMax, Math.min(uncappedMax, maxFairValue));
  } else if (tier === 'marquee') {
    // Prime marquee stars stay in realistic ₹12-18 Cr band (up to ~₹19.5 Cr peak)
    rawMin = Math.max(Math.round(1200 * budgetScale), rawMin);
    rawMax = Math.max(rawMin + 200, Math.min(Math.round(1800 * budgetScale), rawMax));
    maxFairValue = Math.max(rawMax, Math.min(Math.round(1950 * budgetScale), maxFairValue));
  } else if (tier === 'proven_domestic') {
    rawMin = Math.max(Math.round(800 * budgetScale), rawMin);
    rawMax = Math.max(rawMin + 150, Math.min(Math.round(1400 * budgetScale), rawMax));
    maxFairValue = Math.max(rawMax, Math.min(Math.round(1475 * budgetScale), maxFairValue));
  } else if (tier === 'overseas_starter') {
    rawMin = Math.max(Math.round(400 * budgetScale), rawMin);
    rawMax = Math.max(rawMin + 100, Math.min(Math.round(900 * budgetScale), rawMax));
    maxFairValue = Math.max(rawMax, Math.min(Math.round(950 * budgetScale), maxFairValue));
  }

  const minVal = Math.max(basePrice, rawMin);
  const maxVal = Math.max(minVal + 25, rawMax);
  maxFairValue = Math.max(maxVal, maxFairValue);

  return {
    minVal,
    maxVal,
    targetBidRange: [minVal, maxVal],
    maxFairValue,
    ovr,
    tier,
    isFringe: tier === 'uncapped_emerging',
  };
}

function getAiTeamTargets(
  leagueId: number,
  teamId: number,
  isHuman: boolean,
  requiredMinSquad: number,
  effectiveMaxSquad: number,
  budgetScale: number
) {
  const minSquad = Math.max(22, requiredMinSquad);
  const maxSquad = Math.max(minSquad, Math.min(25, effectiveMaxSquad));
  if (isHuman) {
    return {
      targetSquadSize: minSquad,
      carryOverReserve: Math.round(150 * budgetScale),
    };
  }
  const span = Math.max(0, maxSquad - minSquad);
  const targetSquadSize =
    minSquad + Math.min(span, Math.floor(deterministicHash(leagueId * 53, teamId * 29) * (span + 1)));
  // Realistic carry-over purse between ₹1.5 Cr (150L) and ₹4.5 Cr (450L)
  const carryOverReserve = Math.round(
    (150 + deterministicHash(teamId * 71, leagueId * 37) * 300) * budgetScale
  );
  return { targetSquadSize, carryOverReserve };
}

export async function getAuctionSnapshot(leagueId: number) {
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.leagueId, leagueId))
    .limit(1);

  if (!auction) return null;

  let currentLot = null;
  let currentPlayer = null;
  let lotBids: Array<{
    id: number;
    amount: number;
    teamId: number;
    teamName: string;
    teamShortCode: string;
    teamColor: string;
    userUid: string;
    createdAt: Date;
  }> = [];

  if (auction.currentLotId) {
    const [lot] = await db
      .select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.id, auction.currentLotId))
      .limit(1);

    if (lot) {
      currentLot = lot;
      const [player] = await db
        .select()
        .from(players)
        .where(eq(players.id, lot.playerId))
        .limit(1);
      currentPlayer = player ?? null;

      const rawBids = await db
        .select({
          id: bids.id,
          amount: bids.amount,
          teamId: bids.teamId,
          teamName: teams.name,
          teamShortCode: teams.shortCode,
          teamColor: teams.primaryColor,
          userUid: bids.userUid,
          createdAt: bids.createdAt,
        })
        .from(bids)
        .innerJoin(teams, eq(bids.teamId, teams.id))
        .where(eq(bids.auctionPlayerId, lot.id))
        .orderBy(desc(bids.createdAt))
        .limit(20);

      lotBids = rawBids;
    }
  }

  const allLots = await db
    .select({
      status: auctionPlayers.status,
    })
    .from(auctionPlayers)
    .where(eq(auctionPlayers.auctionId, auction.id));

  const counts = {
    total: allLots.length,
    pending: allLots.filter((l) => l.status === 'pending').length,
    sold: allLots.filter((l) => l.status === 'sold').length,
    unsold: allLots.filter((l) => l.status === 'unsold').length,
  };

  return {
    auction,
    currentLot,
    currentPlayer,
    recentBids: lotBids,
    counts,
    serverTime: Date.now(),
  };
}

/**
 * Ensures EVERY club in the league finishes the auction with at least 22+ players
 * before the auction closes. Uses remaining unsold/pending pool fairly.
 */
export async function enforceMinimumSquadCompletion(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  league: typeof leagues.$inferSelect,
  auctionId: number,
  now: Date
): Promise<{ assignedCount: number; systemMsg: typeof leagueMessages.$inferSelect | null }> {
  const requiredMinSquad = Math.max(22, league.minSquadSize || 22);
  const effectiveMaxSquad = Math.max(requiredMinSquad, league.maxSquadSize || 25);
  const budgetScale = Math.max(0.4, (league.startingBudget || 10000) / 10000);

  const allTeams = await tx
    .select()
    .from(teams)
    .where(eq(teams.leagueId, league.id));

  if (allTeams.length === 0) {
    return { assignedCount: 0, systemMsg: null };
  }

  const existingContracts = await tx
    .select({
      teamId: playerContracts.teamId,
      isOverseas: players.isOverseas,
      primaryRole: players.primaryRole,
    })
    .from(playerContracts)
    .innerJoin(players, eq(playerContracts.playerId, players.id))
    .where(eq(playerContracts.leagueId, league.id));

  const remainingPool = await tx
    .select({
      lot: auctionPlayers,
      player: players,
    })
    .from(auctionPlayers)
    .innerJoin(players, eq(auctionPlayers.playerId, players.id))
    .where(
      and(
        eq(auctionPlayers.auctionId, auctionId),
        inArray(auctionPlayers.status, ['pending', 'unsold'])
      )
    );

  // Sort unassigned pool by OVR descending so quality players are distributed fairly first
  const sortedPool = remainingPool
    .map((entry) => ({
      ...entry,
      ovr: getPlayerOverallRating(entry.player),
      valuation: calculatePlayerMarketValuation(entry.player, entry.lot.basePrice, budgetScale),
      assigned: false,
    }))
    .sort((a, b) => b.ovr - a.ovr);

  const teamStates = allTeams.map((t) => {
    const tContracts = existingContracts.filter((c) => c.teamId === t.id);
    const roleCounts: Record<string, number> = {
      Batsman: 0,
      Bowler: 0,
      'All-Rounder': 0,
      Wicketkeeper: 0,
    };
    for (const c of tContracts) {
      roleCounts[c.primaryRole] = (roleCounts[c.primaryRole] || 0) + 1;
    }
    const { targetSquadSize, carryOverReserve } = getAiTeamTargets(
      league.id,
      t.id,
      Boolean(t.ownerUid),
      requiredMinSquad,
      effectiveMaxSquad,
      budgetScale
    );
    return {
      team: t,
      isHuman: Boolean(t.ownerUid),
      targetSquadSize,
      carryOverReserve,
      remainingBudget: t.remainingBudget,
      squadCount: tContracts.length,
      overseasCount: tContracts.filter((c) => c.isOverseas).length,
      roleCounts,
      dirtyBudget: false,
    };
  });

  const newContracts: Array<typeof playerContracts.$inferInsert> = [];
  const soldUpdates: Array<{ lotId: number; teamId: number; soldPrice: number }> = [];

  while (true) {
    const needyTeams = teamStates
      .filter((ts) => ts.squadCount < ts.targetSquadSize)
      .sort((a, b) => a.squadCount - b.squadCount || b.remainingBudget - a.remainingBudget);

    if (needyTeams.length === 0) break;

    let assignedInRound = false;
    for (const ts of needyTeams) {
      const slotsNeededForMin = Math.max(0, requiredMinSquad - ts.squadCount);
      const slotsNeededForTarget = ts.targetSquadSize - ts.squadCount;
      if (slotsNeededForTarget <= 0) continue;

      const available = sortedPool.filter((p) => !p.assigned);
      if (available.length === 0) break;

      const needsWk = (ts.roleCounts['Wicketkeeper'] || 0) < 2;
      const needsBowler = (ts.roleCounts['Bowler'] || 0) < 6;
      const needsBatter = (ts.roleCounts['Batsman'] || 0) < 6;

      let eligible = available.filter(
        (entry) => !entry.player.isOverseas || ts.overseasCount < league.maxOverseas
      );
      if (eligible.length === 0) {
        if (ts.squadCount < requiredMinSquad) {
          eligible = available;
        } else {
          continue;
        }
      }

      // Preserve carry-over purse (₹1.5 Cr - ₹4.5 Cr) once mandatory 22 floor is safe
      const minFutureReserve =
        slotsNeededForMin > 0
          ? Math.max(0, slotsNeededForMin - 1) * 15
          : ts.carryOverReserve;
      const spendableAboveCarryOver = ts.remainingBudget - ts.carryOverReserve - Math.max(0, slotsNeededForTarget - 1) * 20;
      const maxForThisSlot =
        ts.squadCount < requiredMinSquad
          ? Math.max(10, Math.max(spendableAboveCarryOver, ts.remainingBudget - minFutureReserve))
          : spendableAboveCarryOver;

      if (ts.squadCount >= requiredMinSquad && maxForThisSlot < 20) {
        // Already at 22+ and hit carry-over purse reserve — stop adding optional slots
        ts.targetSquadSize = ts.squadCount;
        continue;
      }

      eligible.sort((a, b) => {
        const aAff = a.lot.basePrice <= maxForThisSlot ? 1 : 0;
        const bAff = b.lot.basePrice <= maxForThisSlot ? 1 : 0;
        if (aAff !== bAff) return bAff - aAff;

        const scoreRole = (role: string) =>
          (needsWk && role === 'Wicketkeeper' ? 12 : 0) +
          (needsBowler && role === 'Bowler' ? 7 : 0) +
          (needsBatter && role === 'Batsman' ? 6 : 0);

        return b.ovr + scoreRole(b.player.primaryRole) - (a.ovr + scoreRole(a.player.primaryRole));
      });

      const pick = eligible[0];
      if (!pick) continue;

      const targetFee = Math.min(
        pick.valuation.maxFairValue,
        Math.max(pick.lot.basePrice, Math.round(pick.valuation.targetBidRange[0] * 0.85))
      );
      const fee = Math.min(
        ts.remainingBudget,
        Math.max(10, Math.min(targetFee, maxForThisSlot))
      );

      pick.assigned = true;
      ts.squadCount += 1;
      if (pick.player.isOverseas) ts.overseasCount += 1;
      ts.roleCounts[pick.player.primaryRole] =
        (ts.roleCounts[pick.player.primaryRole] || 0) + 1;
      ts.remainingBudget = Math.max(0, ts.remainingBudget - fee);
      ts.dirtyBudget = true;

      newContracts.push({
        leagueId: league.id,
        teamId: ts.team.id,
        playerId: pick.player.id,
        purchasePrice: fee,
        salary: fee,
        contractYears: 3,
        acquiredVia: 'auction',
      });
      soldUpdates.push({
        lotId: pick.lot.id,
        teamId: ts.team.id,
        soldPrice: fee,
      });
      assignedInRound = true;
    }

    if (!assignedInRound) break;
  }

  for (let i = 0; i < newContracts.length; i += 200) {
    await tx.insert(playerContracts).values(newContracts.slice(i, i + 200));
  }

  for (const upd of soldUpdates) {
    await tx
      .update(auctionPlayers)
      .set({
        status: 'sold',
        soldPrice: upd.soldPrice,
        winningTeamId: upd.teamId,
        updatedAt: now,
      })
      .where(eq(auctionPlayers.id, upd.lotId));
  }

  for (const ts of teamStates) {
    if (ts.dirtyBudget) {
      await tx
        .update(teams)
        .set({ remainingBudget: ts.remainingBudget })
        .where(eq(teams.id, ts.team.id));
    }
  }

  let systemMsg: typeof leagueMessages.$inferSelect | null = null;
  if (newContracts.length > 0) {
    const [msg] = await tx
      .insert(leagueMessages)
      .values({
        leagueId: league.id,
        userUid: league.hostUid,
        teamShortCode: 'AUC',
        body: `Squad Completion Desk: Assigned ${newContracts.length} pool players across franchises (22–25 squad range with carry-over purses preserved).`,
        messageType: 'system',
      })
      .returning();
    systemMsg = msg ?? null;
  }

  return { assignedCount: newContracts.length, systemMsg };
}

export async function settleLotAtomic(auctionId: number, forceSettle = false) {
  const info = await db.transaction(async (tx) => {
    const lockedAuctionRes = await tx.execute(
      sql`SELECT * FROM auctions WHERE id = ${auctionId} FOR UPDATE`
    );
    const auctionRow = lockedAuctionRes.rows[0] as
      | {
          id: number;
          league_id: number;
          status: string;
          current_lot_id: number | null;
          current_bid: number;
          highest_bidder_team_id: number | null;
          highest_bidder_uid: string | null;
          lot_ends_at: Date | null;
          auto_advance: boolean;
          accelerated_round: boolean;
        }
      | undefined;

    if (!auctionRow || !auctionRow.current_lot_id) {
      return null;
    }
    const canForcePaused = forceSettle && auctionRow.status === 'paused';
    if (!canForcePaused && auctionRow.status !== 'live') {
      return null;
    }

    const now = new Date();
    if (!forceSettle && auctionRow.lot_ends_at && new Date(auctionRow.lot_ends_at) > now) {
      return null;
    }

    const [lot] = await tx
      .select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.id, auctionRow.current_lot_id))
      .limit(1);

    if (!lot || lot.status !== 'active') {
      return null;
    }

    const [league] = await tx
      .select()
      .from(leagues)
      .where(eq(leagues.id, auctionRow.league_id))
      .limit(1);

    const [player] = await tx
      .select()
      .from(players)
      .where(eq(players.id, lot.playerId))
      .limit(1);

    if (!league || !player) return null;

    let outcome: 'sold' | 'unsold' = 'unsold';
    let winningTeamId: number | null = null;
    let winningTeamOwnerUid: string | null = null;
    let winningTeamName: string | null = null;
    let winningTeamShortCode: string | null = null;
    let winningTeamNewBudget = 0;
    let soldPrice: number | null = null;

    if (auctionRow.highest_bidder_team_id && auctionRow.current_bid > 0) {
      const lockedTeamRes = await tx.execute(
        sql`SELECT * FROM teams WHERE id = ${auctionRow.highest_bidder_team_id} FOR UPDATE`
      );
      const winningTeam = lockedTeamRes.rows[0] as
        | {
            id: number;
            owner_uid: string | null;
            name: string;
            short_code: string;
            remaining_budget: number;
          }
        | undefined;

      if (winningTeam && winningTeam.remaining_budget >= auctionRow.current_bid) {
        outcome = 'sold';
        soldPrice = auctionRow.current_bid;
        winningTeamId = winningTeam.id;
        winningTeamOwnerUid = winningTeam.owner_uid;
        winningTeamName = winningTeam.name;
        winningTeamShortCode = winningTeam.short_code;
        winningTeamNewBudget = winningTeam.remaining_budget - soldPrice;

        await tx
          .update(teams)
          .set({
            remainingBudget: winningTeamNewBudget,
          })
          .where(eq(teams.id, winningTeam.id));

        await tx.insert(playerContracts).values({
          leagueId: league.id,
          teamId: winningTeam.id,
          playerId: player.id,
          purchasePrice: soldPrice,
          salary: soldPrice,
          contractYears: 3,
          acquiredVia: 'auction',
        });

        await tx
          .update(auctionPlayers)
          .set({
            status: 'sold',
            soldPrice,
            winningTeamId: winningTeam.id,
            updatedAt: now,
          })
          .where(eq(auctionPlayers.id, lot.id));
      } else {
        await tx
          .update(auctionPlayers)
          .set({
            status: 'unsold',
            updatedAt: now,
          })
          .where(eq(auctionPlayers.id, lot.id));
      }
    } else {
      await tx
        .update(auctionPlayers)
        .set({
          status: 'unsold',
          updatedAt: now,
        })
        .where(eq(auctionPlayers.id, lot.id));
    }

    const playerOvr = getPlayerOverallRating(player);
    const createdNotifs: Array<typeof notifications.$inferSelect> = [];

    // Selective Inbox Dispatches: ONLY notify buyers (if human) and managers who bookmarked this player
    const leagueHumanTeams = await tx
      .select({
        id: teams.id,
        ownerUid: teams.ownerUid,
        name: teams.name,
        shortCode: teams.shortCode,
        bookmarkedPlayerIdsJson: teams.bookmarkedPlayerIdsJson,
      })
      .from(teams)
      .where(eq(teams.leagueId, league.id));

    if (outcome === 'sold' && winningTeamOwnerUid) {
      const [buyerNotif] = await tx
        .insert(notifications)
        .values({
          leagueId: league.id,
          targetUid: winningTeamOwnerUid,
          category: 'Auction Desk',
          title: `${player.name} signed by ${winningTeamShortCode} for ${formatLakhsServer(soldPrice!)}`,
          body: `Board Recruitment Desk,\n\nWe have completed the signing of ${player.name} (${player.primaryRole}, ${player.country}, OVR ${playerOvr}) from the ${player.marqueeSet} set for ${formatLakhsServer(soldPrice!)} on a 3-season franchise contract.\n\nYour remaining auction purse now stands at ${formatLakhsServer(winningTeamNewBudget)}. Head to Squad -> Lineups whenever you are ready to integrate them into your starting XI.\n\nChief Executive`,
        })
        .returning();
      if (buyerNotif) createdNotifs.push(buyerNotif);
    }

    for (const hTeam of leagueHumanTeams) {
      if (!hTeam.ownerUid) continue;
      if (outcome === 'sold' && hTeam.id === winningTeamId) continue;
      const bookmarks = Array.isArray(hTeam.bookmarkedPlayerIdsJson)
        ? hTeam.bookmarkedPlayerIdsJson
        : [];
      if (!bookmarks.includes(player.id)) continue;

      if (outcome === 'sold') {
        const [watchNotif] = await tx
          .insert(notifications)
          .values({
            leagueId: league.id,
            targetUid: hTeam.ownerUid,
            category: 'Transfer Watchlist',
            title: `Watchlist alert: ${player.name} signed by ${winningTeamShortCode}`,
            body: `Scouting Network Report,\n\nYour shortlisted ${player.primaryRole.toLowerCase()} target ${player.name} (${player.country}, OVR ${playerOvr}) was acquired by ${winningTeamName} for ${formatLakhsServer(soldPrice!)} during the ${player.marqueeSet} set.\n\nReview alternative options in Scouting and update your priority watchlist before the upcoming sets resume.\n\nHead of Recruitment`,
          })
          .returning();
        if (watchNotif) createdNotifs.push(watchNotif);
      } else {
        const [unsoldWatchNotif] = await tx
          .insert(notifications)
          .values({
            leagueId: league.id,
            targetUid: hTeam.ownerUid,
            category: 'Transfer Watchlist',
            title: `Watchlist alert: ${player.name} went unsold`,
            body: `Scouting Network Report,\n\nYour bookmarked ${player.primaryRole.toLowerCase()} target ${player.name} (${player.country}, OVR ${playerOvr}) went unsold at the base reserve of ${formatLakhsServer(lot.basePrice)} in the ${player.marqueeSet} set.\n\n${!auctionRow.accelerated_round ? `${player.name} will automatically return in the Accelerated Unsold Round after the primary sets conclude, giving your franchise a second chance to secure them.` : 'The accelerated round has concluded for this lot.'}\n\nHead of Recruitment`,
          })
          .returning();
        if (unsoldWatchNotif) createdNotifs.push(unsoldWatchNotif);
      }
    }

    const chatBody =
      outcome === 'sold'
        ? `SOLD: ${winningTeamName} (${winningTeamShortCode}) signed ${player.name} (${player.primaryRole}) for ${formatLakhsServer(soldPrice!)}.`
        : `UNSOLD: ${player.name} passed at base price ${formatLakhsServer(lot.basePrice)}.`;

    const [createdMsg] = await tx
      .insert(leagueMessages)
      .values({
        leagueId: league.id,
        userUid: league.hostUid,
        teamShortCode: outcome === 'sold' ? winningTeamShortCode : 'AUC',
        body: chatBody,
        messageType: 'system',
      })
      .returning();

    // Advance to next pending lot if autoAdvance
    let nextLotId: number | null = null;
    let nextStatus = auctionRow.status;
    let nextEndsAt: Date | null = null;
    let nextSetName = player.marqueeSet || 'Marquee Stars';
    let nextAccelerated = Boolean(auctionRow.accelerated_round);
    let extraSystemMsg: typeof leagueMessages.$inferSelect | null = null;
    let completionSystemMsg: typeof leagueMessages.$inferSelect | null = null;

    if (auctionRow.auto_advance) {
      let [nextLot] = await tx
        .select()
        .from(auctionPlayers)
        .where(and(eq(auctionPlayers.auctionId, auctionId), eq(auctionPlayers.status, 'pending')))
        .orderBy(asc(auctionPlayers.lotOrder))
        .limit(1);

      // If primary sets finished and unsold players exist, launch Accelerated Unsold Round automatically!
      if (!nextLot && !nextAccelerated) {
        const unsoldLots = await tx
          .select({
            lot: auctionPlayers,
            player: players,
          })
          .from(auctionPlayers)
          .innerJoin(players, eq(auctionPlayers.playerId, players.id))
          .where(and(eq(auctionPlayers.auctionId, auctionId), eq(auctionPlayers.status, 'unsold')));

        if (unsoldLots.length > 0) {
          nextAccelerated = true;
          const shuffledUnsold = shuffleAuctionPoolByMarqueeSet(
            unsoldLots.map((u) => u.player)
          );
          const lotByPlayerId = new Map(unsoldLots.map((u) => [u.player.id, u.lot.id]));

          const maxOrderRes = await tx
            .select({ maxOrder: sql<number>`COALESCE(MAX(${auctionPlayers.lotOrder}), 0)` })
            .from(auctionPlayers)
            .where(eq(auctionPlayers.auctionId, auctionId));
          const baseOrder = Number(maxOrderRes[0]?.maxOrder || 0);

          for (let i = 0; i < shuffledUnsold.length; i++) {
            const p = shuffledUnsold[i];
            const lotId = lotByPlayerId.get(p.id);
            if (!lotId) continue;
            await tx
              .update(auctionPlayers)
              .set({
                status: 'pending',
                lotOrder: baseOrder + i + 1,
                updatedAt: now,
              })
              .where(eq(auctionPlayers.id, lotId));
          }

          [nextLot] = await tx
            .select()
            .from(auctionPlayers)
            .where(and(eq(auctionPlayers.auctionId, auctionId), eq(auctionPlayers.status, 'pending')))
            .orderBy(asc(auctionPlayers.lotOrder))
            .limit(1);

          const [accelMsg] = await tx
            .insert(leagueMessages)
            .values({
              leagueId: league.id,
              userUid: league.hostUid,
              teamShortCode: 'AUC',
              body: `Primary marquee sets complete! ${unsoldLots.length} unsold players are returning in the Accelerated Unsold Round.`,
              messageType: 'system',
            })
            .returning();
          extraSystemMsg = accelMsg ?? null;
        }
      }

      if (nextLot) {
        nextLotId = nextLot.id;
        nextEndsAt =
          auctionRow.status === 'paused'
            ? null
            : new Date(now.getTime() + league.auctionDurationSec * 1000);
        const [nextPlayer] = await tx
          .select({ marqueeSet: players.marqueeSet })
          .from(players)
          .where(eq(players.id, nextLot.playerId))
          .limit(1);
        nextSetName = nextAccelerated
          ? `Accelerated · ${nextPlayer?.marqueeSet || 'Unsold Pool'}`
          : nextPlayer?.marqueeSet || 'Marquee Stars';

        await tx
          .update(auctionPlayers)
          .set({ status: 'active', updatedAt: now })
          .where(eq(auctionPlayers.id, nextLot.id));
      } else {
        // Guarantee all clubs finish with 22+ players before marking auction completed
        const compRes = await enforceMinimumSquadCompletion(tx, league, auctionId, now);
        completionSystemMsg = compRes.systemMsg;

        nextStatus = 'completed';
        nextSetName = 'Completed';
        await tx
          .update(leagues)
          .set({ status: 'active' })
          .where(eq(leagues.id, league.id));
      }
    }

    await tx
      .update(auctions)
      .set({
        status: nextStatus,
        currentLotId: nextLotId,
        currentBid: 0,
        highestBidderTeamId: null,
        highestBidderUid: null,
        lotEndsAt: nextEndsAt,
        remainingSecondsOnPause:
          nextStatus === 'paused' && nextLotId ? league.auctionDurationSec : null,
        currentSetName: nextSetName,
        acceleratedRound: nextAccelerated,
        skipVotesJson: [],
        ...(nextStatus === 'completed' ? { autoSimVotesJson: [] } : {}),
        updatedAt: now,
      })
      .where(eq(auctions.id, auctionId));

    return {
      leagueId: league.id,
      outcome,
      playerName: player.name,
      winningTeamName,
      winningTeamShortCode,
      soldPrice,
      nextStatus,
      notifications: createdNotifs,
      systemMessage: createdMsg ?? null,
      extraSystemMessage: extraSystemMsg,
      completionSystemMessage: completionSystemMsg,
    };
  });

  if (info) {
    const snapshot = await getAuctionSnapshot(info.leagueId);
    wsHub.broadcastToLeague(info.leagueId, 'auction:lot_settled', {
      outcome: info.outcome,
      playerName: info.playerName,
      winningTeamName: info.winningTeamName,
      winningTeamShortCode: info.winningTeamShortCode,
      soldPrice: info.soldPrice,
      snapshot,
    });
    for (const notif of info.notifications) {
      if (notif.targetUid) {
        wsHub.sendToUser(notif.targetUid, 'notification:new', notif);
      } else {
        wsHub.broadcastToLeague(info.leagueId, 'notification:new', notif);
      }
    }
    if (info.systemMessage) {
      wsHub.broadcastToLeague(info.leagueId, 'chat:message', info.systemMessage);
    }
    if (info.extraSystemMessage) {
      wsHub.broadcastToLeague(info.leagueId, 'chat:message', info.extraSystemMessage);
    }
    if (info.completionSystemMessage) {
      wsHub.broadcastToLeague(info.leagueId, 'chat:message', info.completionSystemMessage);
    }
    if (info.nextStatus === 'completed') {
      wsHub.broadcastToLeague(info.leagueId, 'league:updated', { leagueId: info.leagueId });
    }
  }
}

/**
 * Resolves a skipped auction lot using the Market Valuation Engine:
 * assigns the player to an AI franchise that genuinely needs the role at a realistic price
 * randomized within ±15% of the calculated targetBidRange (or unsold if no AI can fit/afford them).
 */
export async function resolveSkippedLotWithValuation(auctionId: number) {
  const info = await db.transaction(async (tx) => {
    const lockedAuctionRes = await tx.execute(
      sql`SELECT * FROM auctions WHERE id = ${auctionId} FOR UPDATE`
    );
    const auctionRow = lockedAuctionRes.rows[0] as
      | {
          id: number;
          league_id: number;
          status: string;
          current_lot_id: number | null;
          current_bid: number;
          highest_bidder_team_id: number | null;
          auto_advance: boolean;
          accelerated_round: boolean;
        }
      | undefined;

    if (!auctionRow || !auctionRow.current_lot_id) return null;
    if (auctionRow.status !== 'live' && auctionRow.status !== 'paused') return null;

    const [lot] = await tx
      .select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.id, auctionRow.current_lot_id))
      .limit(1);
    if (!lot || lot.status !== 'active') return null;

    const [league] = await tx
      .select()
      .from(leagues)
      .where(eq(leagues.id, auctionRow.league_id))
      .limit(1);
    const [player] = await tx
      .select()
      .from(players)
      .where(eq(players.id, lot.playerId))
      .limit(1);
    if (!league || !player) return null;

    const now = new Date();
    const budgetScale = Math.max(0.4, (league.startingBudget || 10000) / 10000);
    const bidInc = Math.max(5, league.bidIncrement || 25);
    const requiredMinSquad = Math.max(22, league.minSquadSize || 22);
    const effectiveMaxSquad = Math.max(requiredMinSquad, league.maxSquadSize || 25);

    const valuation = calculatePlayerMarketValuation(player, lot.basePrice, budgetScale);
    const minFairFloor = Math.max(
      lot.basePrice,
      Math.round((valuation.targetBidRange[0] * 0.85) / bidInc) * bidInc
    );

    const allTeams = await tx.select().from(teams).where(eq(teams.leagueId, league.id));
    const leagueContracts = await tx
      .select({
        teamId: playerContracts.teamId,
        isOverseas: players.isOverseas,
        primaryRole: players.primaryRole,
      })
      .from(playerContracts)
      .innerJoin(players, eq(playerContracts.playerId, players.id))
      .where(eq(playerContracts.leagueId, league.id));

    let outcome: 'sold' | 'unsold' = 'unsold';
    let winningTeamId: number | null = null;
    let winningTeamOwnerUid: string | null = null;
    let winningTeamName: string | null = null;
    let winningTeamShortCode: string | null = null;
    let winningTeamNewBudget = 0;
    let soldPrice: number | null = null;

    const existingLeader = auctionRow.highest_bidder_team_id
      ? allTeams.find((t) => t.id === auctionRow.highest_bidder_team_id)
      : null;

    // If an active bid already meets or exceeds fair market valuation floor, honor it directly
    if (
      existingLeader &&
      auctionRow.current_bid >= minFairFloor &&
      existingLeader.remainingBudget >= auctionRow.current_bid
    ) {
      outcome = 'sold';
      soldPrice = Math.min(valuation.maxFairValue, auctionRow.current_bid);
      winningTeamId = existingLeader.id;
      winningTeamOwnerUid = existingLeader.ownerUid;
      winningTeamName = existingLeader.name;
      winningTeamShortCode = existingLeader.shortCode;
      winningTeamNewBudget = existingLeader.remainingBudget - soldPrice;
    } else {
      // Otherwise resolve to an AI franchise that genuinely needs the role at ±15% of targetBidRange
      const aiCandidates = allTeams
        .filter((t) => !t.ownerUid)
        .map((aiTeam) => {
          const tContracts = leagueContracts.filter((c) => c.teamId === aiTeam.id);
          const overseasCount = tContracts.filter((c) => c.isOverseas).length;
          const { targetSquadSize, carryOverReserve } = getAiTeamTargets(
            league.id,
            aiTeam.id,
            false,
            requiredMinSquad,
            effectiveMaxSquad,
            budgetScale
          );
          if (tContracts.length >= targetSquadSize) return null;
          if (player.isOverseas && overseasCount >= league.maxOverseas) return null;

          const roleCount = tContracts.filter((c) => c.primaryRole === player.primaryRole).length;
          const idealRoleTarget =
            player.primaryRole === 'Wicketkeeper'
              ? 3
              : player.primaryRole === 'All-Rounder'
                ? 5
                : 7;
          const roleDeficit = Math.max(0, idealRoleTarget - roleCount);
          const slotsLeftForMin = Math.max(0, requiredMinSquad - tContracts.length - 1);
          const effectiveReserve = Math.max(carryOverReserve, slotsLeftForMin * 25);
          const spendable = aiTeam.remainingBudget - effectiveReserve;

          if (spendable < lot.basePrice) return null;

          // Randomized realistic price within ±15% of targetBidRange
          const [rangeLow, rangeHigh] = valuation.targetBidRange;
          const rawMid = rangeLow + Math.random() * (rangeHigh - rangeLow);
          const jittered = rawMid * (0.85 + Math.random() * 0.30);
          let resolvedBid = Math.round(jittered / bidInc) * bidInc;
          resolvedBid = Math.max(lot.basePrice, Math.min(valuation.maxFairValue, resolvedBid));
          if (existingLeader && resolvedBid <= auctionRow.current_bid) {
            resolvedBid = Math.min(valuation.maxFairValue, Math.max(minFairFloor, auctionRow.current_bid + bidInc));
          }
          if (resolvedBid > spendable) {
            if (spendable >= minFairFloor) {
              resolvedBid = Math.floor(spendable / bidInc) * bidInc;
            } else if (valuation.tier === 'uncapped_emerging' && spendable >= lot.basePrice) {
              resolvedBid = Math.floor(spendable / bidInc) * bidInc;
            } else {
              return null;
            }
          }

          const needScore =
            roleDeficit * 3 +
            Math.max(0, targetSquadSize - tContracts.length) * 0.6 +
            Math.random() * 1.5;

          return { aiTeam, resolvedBid, needScore };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
        .sort((a, b) => b.needScore - a.needScore);

      const bestAi = aiCandidates[0];
      if (bestAi) {
        outcome = 'sold';
        soldPrice = bestAi.resolvedBid;
        winningTeamId = bestAi.aiTeam.id;
        winningTeamOwnerUid = null;
        winningTeamName = bestAi.aiTeam.name;
        winningTeamShortCode = bestAi.aiTeam.shortCode;
        winningTeamNewBudget = bestAi.aiTeam.remainingBudget - soldPrice;
      } else if (
        existingLeader &&
        auctionRow.current_bid > 0 &&
        existingLeader.remainingBudget >= auctionRow.current_bid &&
        valuation.tier !== 'marquee'
      ) {
        outcome = 'sold';
        soldPrice = auctionRow.current_bid;
        winningTeamId = existingLeader.id;
        winningTeamOwnerUid = existingLeader.ownerUid;
        winningTeamName = existingLeader.name;
        winningTeamShortCode = existingLeader.shortCode;
        winningTeamNewBudget = existingLeader.remainingBudget - soldPrice;
      }
    }

    if (outcome === 'sold' && winningTeamId && soldPrice !== null) {
      await tx
        .update(teams)
        .set({ remainingBudget: winningTeamNewBudget })
        .where(eq(teams.id, winningTeamId));

      await tx.insert(playerContracts).values({
        leagueId: league.id,
        teamId: winningTeamId,
        playerId: player.id,
        purchasePrice: soldPrice,
        salary: soldPrice,
        contractYears: 3,
        acquiredVia: 'auction',
      });

      await tx
        .update(auctionPlayers)
        .set({
          status: 'sold',
          soldPrice,
          winningTeamId,
          updatedAt: now,
        })
        .where(eq(auctionPlayers.id, lot.id));
    } else {
      await tx
        .update(auctionPlayers)
        .set({ status: 'unsold', updatedAt: now })
        .where(eq(auctionPlayers.id, lot.id));
    }

    const playerOvr = getPlayerOverallRating(player);
    const createdNotifs: Array<typeof notifications.$inferSelect> = [];
    if (outcome === 'sold' && winningTeamOwnerUid && soldPrice !== null) {
      const [buyerNotif] = await tx
        .insert(notifications)
        .values({
          leagueId: league.id,
          targetUid: winningTeamOwnerUid,
          category: 'Transfers & Banter · Auction Desk',
          title: `${player.name} signed by ${winningTeamShortCode} for ${formatLakhsServer(soldPrice)}`,
          body: `Recruitment Desk Briefing,\n\n${winningTeamName} (${winningTeamShortCode}) completed the acquisition of ${player.name} (${player.primaryRole}, ${player.country}, OVR ${playerOvr}) for ${formatLakhsServer(soldPrice)} on a three-season deal.\n\nYour remaining auction purse now stands at ${formatLakhsServer(winningTeamNewBudget)}. Check Squad -> Lineups to assign their matchday slot ahead of Round 1.`,
        })
        .returning();
      if (buyerNotif) createdNotifs.push(buyerNotif);
    }

    const chatBody =
      outcome === 'sold' && soldPrice !== null
        ? `SKIPPED TO MARKET: ${winningTeamName} (${winningTeamShortCode}) signed ${player.name} (${player.primaryRole}) at fair market value ${formatLakhsServer(soldPrice)}.`
        : `SKIPPED / UNSOLD: ${player.name} passed with no franchise matching reserve.`;

    const [createdMsg] = await tx
      .insert(leagueMessages)
      .values({
        leagueId: league.id,
        userUid: league.hostUid,
        teamShortCode: outcome === 'sold' ? winningTeamShortCode : 'AUC',
        body: chatBody,
        messageType: 'system',
      })
      .returning();

    // Advance to next pending lot
    let nextLotId: number | null = null;
    let nextStatus = auctionRow.status;
    let nextEndsAt: Date | null = null;
    let nextSetName = player.marqueeSet || 'Marquee Stars';
    let nextAccelerated = Boolean(auctionRow.accelerated_round);
    let completionSystemMsg: typeof leagueMessages.$inferSelect | null = null;

    if (auctionRow.auto_advance) {
      let [nextLot] = await tx
        .select()
        .from(auctionPlayers)
        .where(and(eq(auctionPlayers.auctionId, auctionId), eq(auctionPlayers.status, 'pending')))
        .orderBy(asc(auctionPlayers.lotOrder))
        .limit(1);

      if (!nextLot && !nextAccelerated) {
        const unsoldLots = await tx
          .select({ lot: auctionPlayers, player: players })
          .from(auctionPlayers)
          .innerJoin(players, eq(auctionPlayers.playerId, players.id))
          .where(and(eq(auctionPlayers.auctionId, auctionId), eq(auctionPlayers.status, 'unsold')));

        if (unsoldLots.length > 0) {
          nextAccelerated = true;
          const shuffledUnsold = shuffleAuctionPoolByMarqueeSet(unsoldLots.map((u) => u.player));
          const lotByPlayerId = new Map(unsoldLots.map((u) => [u.player.id, u.lot.id]));
          const maxOrderRes = await tx
            .select({ maxOrder: sql<number>`COALESCE(MAX(${auctionPlayers.lotOrder}), 0)` })
            .from(auctionPlayers)
            .where(eq(auctionPlayers.auctionId, auctionId));
          const baseOrder = Number(maxOrderRes[0]?.maxOrder || 0);

          for (let i = 0; i < shuffledUnsold.length; i++) {
            const p = shuffledUnsold[i];
            const lotId = lotByPlayerId.get(p.id);
            if (!lotId) continue;
            await tx
              .update(auctionPlayers)
              .set({ status: 'pending', lotOrder: baseOrder + i + 1, updatedAt: now })
              .where(eq(auctionPlayers.id, lotId));
          }
          [nextLot] = await tx
            .select()
            .from(auctionPlayers)
            .where(and(eq(auctionPlayers.auctionId, auctionId), eq(auctionPlayers.status, 'pending')))
            .orderBy(asc(auctionPlayers.lotOrder))
            .limit(1);
        }
      }

      if (nextLot) {
        nextLotId = nextLot.id;
        nextEndsAt =
          auctionRow.status === 'paused'
            ? null
            : new Date(now.getTime() + league.auctionDurationSec * 1000);
        const [nextPlayer] = await tx
          .select({ marqueeSet: players.marqueeSet })
          .from(players)
          .where(eq(players.id, nextLot.playerId))
          .limit(1);
        nextSetName = nextAccelerated
          ? `Accelerated · ${nextPlayer?.marqueeSet || 'Unsold Pool'}`
          : nextPlayer?.marqueeSet || 'Marquee Stars';
        await tx
          .update(auctionPlayers)
          .set({ status: 'active', updatedAt: now })
          .where(eq(auctionPlayers.id, nextLot.id));
      } else {
        const compRes = await enforceMinimumSquadCompletion(tx, league, auctionId, now);
        completionSystemMsg = compRes.systemMsg;
        nextStatus = 'completed';
        nextSetName = 'Completed';
        await tx.update(leagues).set({ status: 'active' }).where(eq(leagues.id, league.id));
      }
    }

    await tx
      .update(auctions)
      .set({
        status: nextStatus,
        currentLotId: nextLotId,
        currentBid: 0,
        highestBidderTeamId: null,
        highestBidderUid: null,
        lotEndsAt: nextEndsAt,
        remainingSecondsOnPause:
          nextStatus === 'paused' && nextLotId ? league.auctionDurationSec : null,
        currentSetName: nextSetName,
        acceleratedRound: nextAccelerated,
        skipVotesJson: [],
        ...(nextStatus === 'completed' ? { autoSimVotesJson: [] } : {}),
        updatedAt: now,
      })
      .where(eq(auctions.id, auctionId));

    return {
      leagueId: league.id,
      outcome,
      playerName: player.name,
      winningTeamName,
      winningTeamShortCode,
      soldPrice,
      nextStatus,
      notifications: createdNotifs,
      systemMessage: createdMsg ?? null,
      completionSystemMessage: completionSystemMsg,
    };
  });

  if (info) {
    const snapshot = await getAuctionSnapshot(info.leagueId);
    wsHub.broadcastToLeague(info.leagueId, 'auction:lot_settled', {
      outcome: info.outcome,
      playerName: info.playerName,
      winningTeamName: info.winningTeamName,
      winningTeamShortCode: info.winningTeamShortCode,
      soldPrice: info.soldPrice,
      snapshot,
    });
    for (const notif of info.notifications) {
      if (notif.targetUid) wsHub.sendToUser(notif.targetUid, 'notification:new', notif);
    }
    if (info.systemMessage) wsHub.broadcastToLeague(info.leagueId, 'chat:message', info.systemMessage);
    if (info.completionSystemMessage) wsHub.broadcastToLeague(info.leagueId, 'chat:message', info.completionSystemMessage);
    if (info.nextStatus === 'completed') {
      wsHub.broadcastToLeague(info.leagueId, 'league:updated', { leagueId: info.leagueId });
    }
  }
  return info;
}

/**
 * Unanimous Instant Full Auction Simulator:
 * Resolves all active/pending/unsold lots in seconds across ALL franchises (human & AI)
 * respecting budgets, overseas limits, bookmarks, and compulsory 22+ squad completion.
 */
export async function autoSimulateFullAuction(leagueId: number) {
  const result = await db.transaction(async (tx) => {
    const lockedRes = await tx.execute(
      sql`SELECT * FROM auctions WHERE league_id = ${leagueId} FOR UPDATE`
    );
    const auctionRow = lockedRes.rows[0] as
      | {
          id: number;
          league_id: number;
          status: string;
          current_lot_id: number | null;
          current_bid: number;
          highest_bidder_team_id: number | null;
        }
      | undefined;

    if (!auctionRow) {
      throw new Error('Auction not found.');
    }

    const [league] = await tx
      .select()
      .from(leagues)
      .where(eq(leagues.id, leagueId))
      .limit(1);
    if (!league) {
      throw new Error('League not found.');
    }

    if (auctionRow.status === 'completed') {
      return {
        alreadyCompleted: true,
        leagueId,
        soldNow: 0,
        completionAssigned: 0,
        systemMsg: null,
        completionMsg: null,
        notifs: [] as Array<typeof notifications.$inferSelect>,
      };
    }

    const now = new Date();
    const requiredMinSquad = Math.max(22, league.minSquadSize || 22);
    const effectiveMaxSquad = Math.max(requiredMinSquad, league.maxSquadSize || 25);
    const budgetScale = Math.max(0.4, league.startingBudget / 10000);
    const bidInc = Math.max(5, league.bidIncrement || 25);

    const allTeams = await tx
      .select()
      .from(teams)
      .where(eq(teams.leagueId, leagueId));

    const existingContracts = await tx
      .select({
        teamId: playerContracts.teamId,
        isOverseas: players.isOverseas,
        primaryRole: players.primaryRole,
      })
      .from(playerContracts)
      .innerJoin(players, eq(playerContracts.playerId, players.id))
      .where(eq(playerContracts.leagueId, leagueId));

    const allLots = await tx
      .select({
        lot: auctionPlayers,
        player: players,
      })
      .from(auctionPlayers)
      .innerJoin(players, eq(auctionPlayers.playerId, players.id))
      .where(eq(auctionPlayers.auctionId, auctionRow.id))
      .orderBy(asc(auctionPlayers.lotOrder));

    const teamStates = allTeams.map((t) => {
      const tContracts = existingContracts.filter((c) => c.teamId === t.id);
      const roleCounts: Record<string, number> = {
        Batsman: 0,
        Bowler: 0,
        'All-Rounder': 0,
        Wicketkeeper: 0,
      };
      for (const c of tContracts) {
        roleCounts[c.primaryRole] = (roleCounts[c.primaryRole] || 0) + 1;
      }
      const { targetSquadSize, carryOverReserve } = getAiTeamTargets(
        league.id,
        t.id,
        Boolean(t.ownerUid),
        requiredMinSquad,
        effectiveMaxSquad,
        budgetScale
      );
      return {
        team: t,
        isHuman: Boolean(t.ownerUid),
        targetSquadSize,
        carryOverReserve,
        bookmarks: new Set<number>(
          Array.isArray(t.bookmarkedPlayerIdsJson) ? t.bookmarkedPlayerIdsJson : []
        ),
        remainingBudget: t.remainingBudget,
        squadCount: tContracts.length,
        overseasCount: tContracts.filter((c) => c.isOverseas).length,
        roleCounts,
        signedNames: [] as string[],
      };
    });

    const teamById = new Map(teamStates.map((ts) => [ts.team.id, ts]));

    // Separate active + pending first, then unsold
    const activeAndPending = allLots.filter(
      (item) => item.lot.status === 'active' || item.lot.status === 'pending'
    );
    const priorUnsold = allLots.filter((item) => item.lot.status === 'unsold');
    const lotsToSim = [...activeAndPending, ...priorUnsold];

    const newContracts: Array<typeof playerContracts.$inferInsert> = [];
    const lotUpdates: Array<{
      lotId: number;
      status: 'sold' | 'unsold';
      soldPrice: number | null;
      winningTeamId: number | null;
    }> = [];

    const runLotBidSim = (
      item: typeof lotsToSim[number],
      aggressiveFillMode: boolean
    ): boolean => {
      const { lot, player } = item;
      const valuation = calculatePlayerMarketValuation(player, lot.basePrice, budgetScale);
      const { minVal, maxVal, maxFairValue, ovr } = valuation;

      const totalContracts = teamStates.reduce((acc, s) => acc + s.squadCount, 0);
      const avgSquad = totalContracts / Math.max(1, teamStates.length);

      const isCurrentlyActiveWithBid =
        lot.id === auctionRow.current_lot_id &&
        auctionRow.current_bid > 0 &&
        auctionRow.highest_bidder_team_id !== null;

      const startingMinPrice = isCurrentlyActiveWithBid
        ? auctionRow.current_bid
        : lot.basePrice;

      const contenders: Array<{
        ts: (typeof teamStates)[number];
        score: number;
        cap: number;
      }> = [];

      for (const ts of teamStates) {
        if (ts.squadCount >= ts.targetSquadSize) continue;
        if (player.isOverseas && ts.overseasCount >= league.maxOverseas) continue;

        const slotsNeededAfterThis = Math.max(0, requiredMinSquad - ts.squadCount - 1);
        const reserveFloor = ts.isHuman
          ? slotsNeededAfterThis * 20
          : Math.max(ts.carryOverReserve, slotsNeededAfterThis * 25);
        const spendable = ts.remainingBudget - reserveFloor;
        if (spendable < lot.basePrice) continue;

        const roleCount = ts.roleCounts[player.primaryRole] || 0;
        const roleNeedMult =
          player.primaryRole === 'Wicketkeeper' && roleCount >= 2
            ? 0.6
            : roleCount >= 7
              ? 0.65
              : roleCount === 0 && ts.squadCount >= 4
                ? 1.18
                : 1.0;

        const isBookmarked = ts.bookmarks.has(player.id);
        const affinity = deterministicHash(lot.id * 37, ts.team.id * 19);
        const catchUp =
          (ts.squadCount < ts.targetSquadSize ? 0.35 : 0) +
          Math.max(0, avgSquad - ts.squadCount) * 0.14;

        if (ts.squadCount >= ts.targetSquadSize && !isBookmarked && !aggressiveFillMode) {
          continue;
        }

        const fierceBias = 0.2 + affinity * 0.8 + (isBookmarked ? 0.12 : 0);
        const rawCap =
          (minVal + fierceBias * (maxVal - minVal)) *
          roleNeedMult *
          (ts.squadCount < requiredMinSquad ? 1.02 : 0.85);

        let cap = Math.min(spendable, maxFairValue, Math.round(rawCap / bidInc) * bidInc);

        if (aggressiveFillMode && ts.squadCount < requiredMinSquad) {
          cap = Math.max(cap, Math.min(spendable, maxFairValue, lot.basePrice));
        } else if (ts.squadCount < requiredMinSquad && spendable >= lot.basePrice && cap < lot.basePrice) {
          cap = lot.basePrice;
        }

        if (cap >= lot.basePrice) {
          const priority =
            affinity * 0.65 +
            roleNeedMult * 0.4 +
            catchUp +
            (isBookmarked ? 1.25 : 0);
          contenders.push({ ts, score: priority, cap });
        }
      }

      // If an active lot already has a valid leader, ensure that leader is included
      if (isCurrentlyActiveWithBid && auctionRow.highest_bidder_team_id) {
        const leaderState = teamById.get(auctionRow.highest_bidder_team_id);
        if (
          leaderState &&
          leaderState.remainingBudget >= auctionRow.current_bid &&
          !contenders.some((c) => c.ts.team.id === leaderState.team.id)
        ) {
          contenders.push({
            ts: leaderState,
            score: 1.5,
            cap: Math.max(auctionRow.current_bid, lot.basePrice),
          });
        }
      }

      if (contenders.length === 0) {
        return false;
      }

      // Max 4 teams participate per lot
      contenders.sort((a, b) => b.score - a.score || b.cap - a.cap);
      const poolLimit = Math.min(4, Math.max(2, Math.floor(deterministicHash(lot.id, 409) * 3) + 2));
      const finalists = contenders.slice(0, poolLimit);
      finalists.sort((a, b) => b.cap - a.cap || b.score - a.score);

      const winner = finalists[0];
      let finalPrice = startingMinPrice;

      if (finalists.length >= 2) {
        const runnerUp = finalists[1];
        const contestedPrice = Math.min(
          winner.cap,
          Math.max(startingMinPrice, runnerUp.cap + (winner.cap > runnerUp.cap ? bidInc : 0))
        );
        finalPrice = Math.max(
          startingMinPrice,
          Math.min(winner.cap, Math.round(contestedPrice / bidInc) * bidInc)
        );
      }

      finalPrice = Math.min(winner.ts.remainingBudget, Math.max(lot.basePrice, finalPrice));

      winner.ts.squadCount += 1;
      if (player.isOverseas) winner.ts.overseasCount += 1;
      winner.ts.roleCounts[player.primaryRole] =
        (winner.ts.roleCounts[player.primaryRole] || 0) + 1;
      winner.ts.remainingBudget = Math.max(0, winner.ts.remainingBudget - finalPrice);
      winner.ts.signedNames.push(`${player.name} (${formatLakhsServer(finalPrice)})`);

      newContracts.push({
        leagueId,
        teamId: winner.ts.team.id,
        playerId: player.id,
        purchasePrice: finalPrice,
        salary: finalPrice,
        contractYears: 3,
        acquiredVia: 'auction',
      });

      lotUpdates.push({
        lotId: lot.id,
        status: 'sold',
        soldPrice: finalPrice,
        winningTeamId: winner.ts.team.id,
      });

      return true;
    };

    const secondChanceLots: Array<typeof lotsToSim[number]> = [];

    for (const item of lotsToSim) {
      const sold = runLotBidSim(item, false);
      if (!sold) {
        secondChanceLots.push(item);
      }
    }

    // Second pass over unsold items specifically for any team still below 22
    const stillUnsold: Array<typeof lotsToSim[number]> = [];
    for (const item of secondChanceLots) {
      const anyUnderMin = teamStates.some((ts) => ts.squadCount < requiredMinSquad);
      const sold = anyUnderMin ? runLotBidSim(item, true) : false;
      if (!sold) {
        stillUnsold.push(item);
      }
    }

    for (const item of stillUnsold) {
      lotUpdates.push({
        lotId: item.lot.id,
        status: 'unsold',
        soldPrice: null,
        winningTeamId: null,
      });
    }

    // Flush simulated contracts, lot outcomes, and team purses to DB
    for (let i = 0; i < newContracts.length; i += 200) {
      await tx.insert(playerContracts).values(newContracts.slice(i, i + 200));
    }

    for (const upd of lotUpdates) {
      await tx
        .update(auctionPlayers)
        .set({
          status: upd.status,
          soldPrice: upd.soldPrice,
          winningTeamId: upd.winningTeamId,
          updatedAt: now,
        })
        .where(eq(auctionPlayers.id, upd.lotId));
    }

    for (const ts of teamStates) {
      await tx
        .update(teams)
        .set({ remainingBudget: ts.remainingBudget })
        .where(eq(teams.id, ts.team.id));
    }

    // Guarantee EVERY franchise reaches 22+ contracted players
    const compRes = await enforceMinimumSquadCompletion(tx, league, auctionRow.id, now);

    // Refresh final squad counts for summaries
    const finalContracts = await tx
      .select({ teamId: playerContracts.teamId })
      .from(playerContracts)
      .where(eq(playerContracts.leagueId, leagueId));

    const finalTeamDocs = await tx
      .select()
      .from(teams)
      .where(eq(teams.leagueId, leagueId));

    const createdNotifs: Array<typeof notifications.$inferSelect> = [];
    for (const ft of finalTeamDocs) {
      if (!ft.ownerUid) continue;
      const count = finalContracts.filter((c) => c.teamId === ft.id).length;
      const ts = teamById.get(ft.id);
      const topSignings = (ts?.signedNames || []).slice(0, 6).join(', ');
      const [notif] = await tx
        .insert(notifications)
        .values({
          leagueId,
          targetUid: ft.ownerUid,
          category: 'Auction',
          title: `Instant Auction Complete · ${ft.shortCode} Squad (${count} Players)`,
          body: `Board Recruitment Desk,\n\nBy unanimous manager agreement, the player auction has been auto-simulated to completion.\n\n${ft.name} (${ft.shortCode}) finished with ${count} contracted players and ${formatLakhsServer(ft.remainingBudget)} remaining in the purse.${topSignings ? `\n\nKey auction acquisitions: ${topSignings}.` : ''}\n\nHead to Squad -> Lineups to set your starting XI, captain, and wicketkeeper for the upcoming schedule.\n\nChief Executive`,
        })
        .returning();
      if (notif) createdNotifs.push(notif);
    }

    const totalSoldCount = newContracts.length + compRes.assignedCount;
    const [systemMsg] = await tx
      .insert(leagueMessages)
      .values({
        leagueId,
        userUid: league.hostUid,
        teamShortCode: 'AUC',
        body: `Unanimous Auto-Sim Complete: ${totalSoldCount} players signed across ${finalTeamDocs.length} franchises. Every club has completed a ${requiredMinSquad}+ player squad!`,
        messageType: 'system',
      })
      .returning();

    await tx
      .update(auctions)
      .set({
        status: 'completed',
        currentLotId: null,
        currentBid: 0,
        highestBidderTeamId: null,
        highestBidderUid: null,
        lotEndsAt: null,
        remainingSecondsOnPause: null,
        currentSetName: 'Completed',
        pauseRequestsJson: [],
        pausedByUid: null,
        pausedByName: null,
        autoSimVotesJson: [],
        skipVotesJson: [],
        updatedAt: now,
      })
      .where(eq(auctions.id, auctionRow.id));

    await tx.update(leagues).set({ status: 'active' }).where(eq(leagues.id, leagueId));

    return {
      alreadyCompleted: false,
      leagueId,
      soldNow: totalSoldCount,
      completionAssigned: compRes.assignedCount,
      systemMsg: systemMsg ?? null,
      completionMsg: compRes.systemMsg,
      notifs: createdNotifs,
    };
  });

  const snapshot = await getAuctionSnapshot(leagueId);
  if (!result.alreadyCompleted) {
    wsHub.broadcastToLeague(leagueId, 'auction:auto_simulated', {
      soldCount: result.soldNow,
      snapshot,
    });
    wsHub.broadcastToLeague(leagueId, 'auction:state', snapshot);
    wsHub.broadcastToLeague(leagueId, 'league:updated', { leagueId });
    if (result.systemMsg) {
      wsHub.broadcastToLeague(leagueId, 'chat:message', result.systemMsg);
    }
    if (result.completionMsg) {
      wsHub.broadcastToLeague(leagueId, 'chat:message', result.completionMsg);
    }
    for (const notif of result.notifs) {
      if (notif.targetUid) {
        wsHub.sendToUser(notif.targetUid, 'notification:new', notif);
      }
    }
  }

  return snapshot;
}

/**
 * Evaluates unclaimed AI franchises on live lots and places realistic OVR-capped bids.
 */
async function triggerAiBiddingForAuction(auctionId: number) {
  const aiResult = await db.transaction(async (tx) => {
    const lockedRes = await tx.execute(
      sql`SELECT * FROM auctions WHERE id = ${auctionId} FOR UPDATE`
    );
    const auctionRow = lockedRes.rows[0] as
      | {
          id: number;
          league_id: number;
          status: string;
          current_lot_id: number | null;
          current_bid: number;
          highest_bidder_team_id: number | null;
          lot_ends_at: Date | null;
          updated_at: Date;
        }
      | undefined;

    if (!auctionRow || auctionRow.status !== 'live' || !auctionRow.current_lot_id) {
      return null;
    }

    const now = new Date();
    if (!auctionRow.lot_ends_at) return null;
    const msLeft = new Date(auctionRow.lot_ends_at).getTime() - now.getTime();
    const msSinceUpdate = now.getTime() - new Date(auctionRow.updated_at).getTime();

    // Give human managers natural breathing room (~1.6s pacing between bids)
    if (msLeft <= 1200 || msSinceUpdate < 1600) {
      return null;
    }

    const [league] = await tx
      .select()
      .from(leagues)
      .where(eq(leagues.id, auctionRow.league_id))
      .limit(1);
    if (!league) return null;

    const [lot] = await tx
      .select()
      .from(auctionPlayers)
      .where(eq(auctionPlayers.id, auctionRow.current_lot_id))
      .limit(1);
    if (!lot || lot.status !== 'active') return null;

    const [player] = await tx
      .select()
      .from(players)
      .where(eq(players.id, lot.playerId))
      .limit(1);
    if (!player) return null;

    const aiTeams = await tx
      .select()
      .from(teams)
      .where(and(eq(teams.leagueId, league.id), sql`owner_uid IS NULL`));
    if (aiTeams.length === 0) return null;

    const nextBid =
      auctionRow.current_bid === 0
        ? lot.basePrice
        : auctionRow.current_bid + league.bidIncrement;

    const existingBidsOnLot = await tx
      .select({ teamId: bids.teamId })
      .from(bids)
      .where(eq(bids.auctionPlayerId, lot.id));
    const participatingTeamIds = new Set<number>(existingBidsOnLot.map((b) => b.teamId));

    const leagueContracts = await tx
      .select({
        teamId: playerContracts.teamId,
        isOverseas: players.isOverseas,
        primaryRole: players.primaryRole,
      })
      .from(playerContracts)
      .innerJoin(players, eq(playerContracts.playerId, players.id))
      .where(eq(playerContracts.leagueId, league.id));

    const budgetScale = Math.max(0.4, (league.startingBudget || 10000) / 10000);
    const valuation = calculatePlayerMarketValuation(player, lot.basePrice, budgetScale);
    const { minVal, maxVal, maxFairValue, ovr } = valuation;

    const requiredMinSquad = Math.max(22, league.minSquadSize || 22);
    const effectiveMaxSquad = Math.max(requiredMinSquad, league.maxSquadSize || 25);
    const aiContractsTotal = leagueContracts.filter((c) =>
      aiTeams.some((a) => a.id === c.teamId)
    ).length;
    const avgAiContracts = aiContractsTotal / Math.max(1, aiTeams.length);

    const rankedAi = aiTeams
      .map((aiTeam) => {
        const tContracts = leagueContracts.filter((c) => c.teamId === aiTeam.id);
        const roleCount = tContracts.filter((c) => c.primaryRole === player.primaryRole).length;
        const overseasCount = tContracts.filter((c) => c.isOverseas).length;
        const { targetSquadSize, carryOverReserve } = getAiTeamTargets(
          league.id,
          aiTeam.id,
          false,
          requiredMinSquad,
          effectiveMaxSquad,
          budgetScale
        );
        const canFit =
          tContracts.length < targetSquadSize &&
          (!player.isOverseas || overseasCount < league.maxOverseas);

        const roleNeedMult =
          player.primaryRole === 'Wicketkeeper' && roleCount >= 2
            ? 0.6
            : roleCount >= 7
              ? 0.65
              : roleCount === 0 && tContracts.length >= 4
                ? 1.16
                : 1.0;

        const lotAffinity = deterministicHash(lot.id * 31, aiTeam.id * 17);
        const deficit = Math.max(0, targetSquadSize - tContracts.length);
        const catchUpBoost =
          Math.min(0.8, deficit * 0.03) +
          Math.max(0, avgAiContracts - tContracts.length) * 0.16;

        const priorityScore =
          (canFit ? 1 : -10) * (lotAffinity * 0.72 + roleNeedMult * 0.42 + catchUpBoost);
        return {
          aiTeam,
          tContracts,
          targetSquadSize,
          carryOverReserve,
          roleNeedMult,
          lotAffinity,
          priorityScore,
          canFit,
        };
      })
      .filter((entry) => entry.canFit)
      .sort((a, b) => b.priorityScore - a.priorityScore);

    if (rankedAi.length === 0) return null;

    const targetAiCount = deterministicHash(lot.id, 991) > 0.45 ? 3 : 2;
    const targetedAi = rankedAi.slice(0, targetAiCount);

    const candidates: Array<{ team: typeof aiTeams[number]; cap: number }> = [];

    for (const entry of targetedAi) {
      const { aiTeam, tContracts, targetSquadSize, carryOverReserve, roleNeedMult, lotAffinity } = entry;
      if (aiTeam.id === auctionRow.highest_bidder_team_id) continue;

      const isAlreadyInLot = participatingTeamIds.has(aiTeam.id);
      if (!isAlreadyInLot && participatingTeamIds.size >= 4) continue;

      const slotsNeededAfterThis = Math.max(0, requiredMinSquad - tContracts.length - 1);
      const reserveFloor = Math.max(
        carryOverReserve,
        slotsNeededAfterThis * Math.min(25, league.defaultBasePrice)
      );
      const spendable = aiTeam.remainingBudget - reserveFloor;
      if (spendable < nextBid) continue;

      if (
        ovr < 66 &&
        lotAffinity < 0.2 &&
        !isAlreadyInLot &&
        tContracts.length >= targetSquadSize - 4
      ) {
        continue;
      }

      const fierceBias = 0.25 + lotAffinity * 0.75;
      const rawCap = (minVal + fierceBias * (maxVal - minVal)) * roleNeedMult;
      const bidStep = Math.max(5, league.bidIncrement || 25);
      let cap = Math.min(spendable, maxFairValue, Math.round(rawCap / bidStep) * bidStep);

      if (auctionRow.current_bid === 0 && tContracts.length < requiredMinSquad) {
        cap = Math.max(cap, lot.basePrice);
      }

      if (nextBid <= cap) {
        candidates.push({ team: aiTeam, cap });
      }
    }

    // Guarantee that if a lot has 0 bids and any AI club under target can afford basePrice (or marquee floor), one opens
    if (candidates.length === 0 && auctionRow.current_bid === 0) {
      for (const entry of rankedAi) {
        const { aiTeam, tContracts, carryOverReserve } = entry;
        if (tContracts.length >= requiredMinSquad) continue;
        const slotsNeededAfterThis = Math.max(0, requiredMinSquad - tContracts.length - 1);
        const reserveFloor = Math.max(carryOverReserve, slotsNeededAfterThis * 15);
        if (aiTeam.remainingBudget - reserveFloor >= lot.basePrice) {
          candidates.push({ team: aiTeam, cap: lot.basePrice });
          break;
        }
      }
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.cap - a.cap);
    const pickIdx = Math.floor(Math.random() * Math.min(2, candidates.length));
    const chosen = candidates[pickIdx].team;

    const minEnd = new Date(now.getTime() + 7000);
    const nextEndsAt =
      new Date(auctionRow.lot_ends_at) < minEnd ? minEnd : new Date(auctionRow.lot_ends_at);

    await tx.insert(bids).values({
      auctionId: auctionRow.id,
      auctionPlayerId: lot.id,
      leagueId: league.id,
      teamId: chosen.id,
      userUid: league.hostUid,
      amount: nextBid,
    });

    await tx
      .update(auctions)
      .set({
        currentBid: nextBid,
        highestBidderTeamId: chosen.id,
        highestBidderUid: null,
        lotEndsAt: nextEndsAt,
        updatedAt: now,
      })
      .where(eq(auctions.id, auctionRow.id));

    return {
      leagueId: league.id,
      amount: nextBid,
      teamName: chosen.name,
      teamShortCode: chosen.shortCode,
    };
  });

  if (aiResult) {
    const snapshot = await getAuctionSnapshot(aiResult.leagueId);
    wsHub.broadcastToLeague(aiResult.leagueId, 'auction:bid', {
      bid: {
        amount: aiResult.amount,
        teamName: aiResult.teamName,
        teamShortCode: aiResult.teamShortCode,
        isAi: true,
      },
      snapshot,
    });
  }
}

export async function tickLiveAuctions() {
  const now = new Date();
  const expiredAuctions = await db
    .select({ id: auctions.id })
    .from(auctions)
    .where(and(eq(auctions.status, 'live'), lte(auctions.lotEndsAt, now)));

  for (const row of expiredAuctions) {
    await settleLotAtomic(row.id, false);
  }

  const liveAuctions = await db
    .select({ id: auctions.id })
    .from(auctions)
    .where(eq(auctions.status, 'live'));

  for (const row of liveAuctions) {
    await triggerAiBiddingForAuction(row.id);
  }
}

export function formatLakhsServer(lakhs: number): string {
  if (lakhs >= 100) {
    const cr = lakhs / 100;
    return `₹${Number.isInteger(cr) ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  }
  return `₹${lakhs} L`;
}
