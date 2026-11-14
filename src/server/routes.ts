import { Router } from 'express';
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, ne, notInArray, or, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../db/index.ts';
import {
  auctionPlayers,
  auctions,
  bids,
  directMessages,
  fixtures,
  friendships,
  leagueMembers,
  leagueMessages,
  leagueNews,
  leagues,
  lineups,
  managerProfiles,
  matches,
  notifications,
  playerContracts,
  players,
  teams,
  tradeOffers,
  users,
  type PressConferenceData,
} from '../db/schema.ts';
import { getManagerProfile, getOrCreateUser, upsertManagerProfile } from '../db/users.ts';
import { type AuthRequest, requireAuth } from '../middleware/auth.ts';
import {
  COACH_CATALOG,
  FRANCHISE_CATALOG,
  MARQUEE_SET_ORDER,
  SCOUT_CATALOG,
  buildRealCricketPlayerPool,
  shuffleAuctionPoolByMarqueeSet,
} from './seedData.ts';
import {
  autoSimulateFullAuction,
  enforceMinimumSquadCompletion,
  formatLakhsServer,
  getAuctionSnapshot,
  resolveSkippedLotWithValuation,
  settleLotAtomic,
} from './auctionEngine.ts';
import {
  buildBalancedXI,
  computeTeamRatings,
  computeWinChance,
  getPlayerOverallRating,
  pickPitchCondition,
  selectExhibitionClubPool,
  simulateCricketMatch,
} from './matchEngine.ts';
import {
  computeLeagueCalendar,
  computeLeagueStandings,
  ensureLeagueScheduleExists,
  maybeAdvancePlayoffs,
  processDueAiFixtures,
  simulateScheduledFixtureWithSavedTactics,
  startPvpMatchLiveState,
} from './scheduleEngine.ts';
import { applyPostMatchProgression } from './postMatchService.ts';
import {
  buildPressQuoteText,
  generatePressConferenceQuestions,
  scheduleBackgroundPressConference,
} from './geminiService.ts';
import {
  analyzeTeamNeeds,
  evaluateAiTradeProposal,
  generateSmartAiTradeOffer,
} from './tradeService.ts';
import { wsHub } from './wsHub.ts';

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export const apiRouter = Router();
apiRouter.use(requireAuth);

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function assertLeagueMember(leagueId: number, userUid: string) {
  const [membership] = await db
    .select()
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userUid, userUid)))
    .limit(1);
  return membership ?? null;
}

async function buildLeagueState(leagueId: number, viewerUid: string) {
  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return null;

  const memberRows = await db
    .select({
      id: leagueMembers.id,
      userUid: leagueMembers.userUid,
      role: leagueMembers.role,
      joinedAt: leagueMembers.joinedAt,
      managerName: managerProfiles.managerName,
      country: managerProfiles.country,
      favoriteFormat: managerProfiles.favoriteFormat,
      avatarUrl: managerProfiles.avatarUrl,
      reputation: managerProfiles.reputation,
    })
    .from(leagueMembers)
    .leftJoin(managerProfiles, eq(leagueMembers.userUid, managerProfiles.userUid))
    .where(eq(leagueMembers.leagueId, leagueId))
    .orderBy(asc(leagueMembers.joinedAt));

  const onlineUids = new Set(wsHub.getOnlineUids(leagueId));

  const teamRows = await db
    .select()
    .from(teams)
    .where(eq(teams.leagueId, leagueId))
    .orderBy(asc(teams.id));

  const contracts = await db
    .select({
      contractId: playerContracts.id,
      teamId: playerContracts.teamId,
      playerId: playerContracts.playerId,
      purchasePrice: playerContracts.purchasePrice,
      salary: playerContracts.salary,
      contractYears: playerContracts.contractYears,
      acquiredVia: playerContracts.acquiredVia,
      isOverseas: players.isOverseas,
      primaryRole: players.primaryRole,
      name: players.name,
      battingRating: players.battingRating,
      bowlingRating: players.bowlingRating,
      fieldingRating: players.fieldingRating,
    })
    .from(playerContracts)
    .innerJoin(players, eq(playerContracts.playerId, players.id))
    .where(eq(playerContracts.leagueId, leagueId));

  const contractsByTeam = new Map<number, typeof contracts>();
  for (const c of contracts) {
    if (!contractsByTeam.has(c.teamId)) contractsByTeam.set(c.teamId, []);
    contractsByTeam.get(c.teamId)!.push(c);
  }

  const enrichedTeams = teamRows.map((t) => {
    const teamContracts = contractsByTeam.get(t.id) ?? [];
    const overseasCount = teamContracts.filter((c) => c.isOverseas).length;
    const ownerMember = memberRows.find((m) => m.userUid === t.ownerUid);
    return {
      ...t,
      squadCount: teamContracts.length,
      overseasCount,
      ownerName: ownerMember?.managerName ?? null,
      ownerOnline: t.ownerUid ? onlineUids.has(t.ownerUid) : false,
    };
  });

  const auctionSnapshot = await getAuctionSnapshot(leagueId);

  const messages = await db
    .select({
      id: leagueMessages.id,
      leagueId: leagueMessages.leagueId,
      userUid: leagueMessages.userUid,
      teamShortCode: leagueMessages.teamShortCode,
      body: leagueMessages.body,
      messageType: leagueMessages.messageType,
      createdAt: leagueMessages.createdAt,
      managerName: managerProfiles.managerName,
      avatarUrl: managerProfiles.avatarUrl,
    })
    .from(leagueMessages)
    .leftJoin(managerProfiles, eq(leagueMessages.userUid, managerProfiles.userUid))
    .where(eq(leagueMessages.leagueId, leagueId))
    .orderBy(desc(leagueMessages.createdAt))
    .limit(60);

  const notifRows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.leagueId, leagueId),
        or(isNull(notifications.targetUid), eq(notifications.targetUid, viewerUid))
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(40);

  await ensureLeagueScheduleExists(leagueId);
  const calendar = computeLeagueCalendar(league);
  await processDueAiFixtures(leagueId, calendar.currentGameDay);

  const matchRows = await db
    .select()
    .from(matches)
    .where(eq(matches.leagueId, leagueId))
    .orderBy(desc(matches.createdAt))
    .limit(60);

  const fixtureRows = await db
    .select()
    .from(fixtures)
    .where(eq(fixtures.leagueId, leagueId))
    .orderBy(asc(fixtures.scheduledDay), asc(fixtures.matchNumber));

  const memberNameMap = new Map<string, string | null>(
    memberRows.map((m) => [m.userUid, m.managerName ?? null])
  );
  const standings = computeLeagueStandings(teamRows, fixtureRows, matchRows, memberNameMap);

  const newsRows = await db
    .select()
    .from(leagueNews)
    .where(eq(leagueNews.leagueId, leagueId))
    .orderBy(desc(leagueNews.createdAt))
    .limit(40);

  const teamByIdMap = new Map(enrichedTeams.map((t) => [t.id, t]));
  const rawTrades = await db
    .select()
    .from(tradeOffers)
    .where(eq(tradeOffers.leagueId, leagueId))
    .orderBy(desc(tradeOffers.createdAt))
    .limit(35);

  const tradePlayerIdSet = new Set<number>();
  for (const tr of rawTrades) {
    for (const pid of tr.offeredPlayerIdsJson || []) tradePlayerIdSet.add(pid);
    for (const pid of tr.requestedPlayerIdsJson || []) tradePlayerIdSet.add(pid);
  }
  const newsPlayerIdSet = new Set<number>();
  for (const n of newsRows) {
    if (n.playerId) newsPlayerIdSet.add(n.playerId);
  }
  const neededPids = Array.from(new Set([...tradePlayerIdSet, ...newsPlayerIdSet]));
  const extraPlayersMap = new Map<number, typeof players.$inferSelect>();
  if (neededPids.length > 0) {
    const pRows = await db
      .select()
      .from(players)
      .where(and(eq(players.leagueId, leagueId), inArray(players.id, neededPids)));
    for (const p of pRows) extraPlayersMap.set(p.id, p);
  }

  const enrichedNews = newsRows.map((n) => {
    const tm = n.teamId ? teamByIdMap.get(n.teamId) : null;
    const pl = n.playerId ? extraPlayersMap.get(n.playerId) : null;
    return {
      ...n,
      teamName: tm?.name ?? null,
      teamShortCode: tm?.shortCode ?? null,
      playerName: pl?.name ?? null,
    };
  });

  const enrichedTrades = rawTrades.map((tr) => {
    const pt = teamByIdMap.get(tr.proposerTeamId);
    const rt = teamByIdMap.get(tr.recipientTeamId);
    return {
      ...tr,
      proposerTeam: pt
        ? { id: pt.id, name: pt.name, shortCode: pt.shortCode, ownerName: pt.ownerName }
        : undefined,
      recipientTeam: rt
        ? { id: rt.id, name: rt.name, shortCode: rt.shortCode, ownerName: rt.ownerName }
        : undefined,
      offeredPlayers: (tr.offeredPlayerIdsJson || [])
        .map((id) => extraPlayersMap.get(id))
        .filter(Boolean),
      requestedPlayers: (tr.requestedPlayerIdsJson || [])
        .map((id) => extraPlayersMap.get(id))
        .filter(Boolean),
    };
  });

  return {
    league: {
      ...league,
      currentGameDay: calendar.currentGameDay,
      nextDayInSec: calendar.nextDayInSec,
    },
    members: memberRows.map((m) => ({
      ...m,
      isOnline: onlineUids.has(m.userUid),
    })),
    teams: enrichedTeams,
    myTeam: enrichedTeams.find((t) => t.ownerUid === viewerUid) ?? null,
    auctionSnapshot,
    messages: messages.reverse(),
    notifications: notifRows,
    matches: matchRows,
    fixtures: fixtureRows,
    standings,
    newsFeed: enrichedNews,
    tradeOffers: enrichedTrades,
    currentGameDay: calendar.currentGameDay,
    nextDayInSec: calendar.nextDayInSec,
    onlineUids: Array.from(onlineUids),
  };
}

// 1. Auth & Profile
apiRouter.post('/auth/sync', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const userRow = isDatabaseConfigured
      ? (await db.select().from(users).where(eq(users.uid, uid)).limit(1))[0]
      : await getOrCreateUser(uid, req.user?.email || '');
    const profile = await getManagerProfile(uid);
    res.json({
      user: userRow,
      profile,
      suggestedName: req.user?.name || '',
    });
  } catch (error: any) {
    console.error('Auth sync error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync session' });
  }
});

apiRouter.put('/profile', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const {
      managerName,
      firstName,
      lastName,
      preferredName,
      country,
      preferredCurrency,
      birthYear,
      birthMonth,
      birthDay,
      coachExperience,
      coachBackground,
      coachingStyle,
      favoriteFormat,
      avatarUrl,
      bio,
    } = req.body;

    const computedName =
      (typeof managerName === 'string' && managerName.trim()) ||
      (typeof preferredName === 'string' && preferredName.trim()) ||
      [firstName, lastName].filter((v) => typeof v === 'string' && v.trim()).join(' ').trim();

    if (!computedName || computedName.length < 2) {
      return res.status(400).json({ error: 'Manager or preferred name must be at least 2 characters.' });
    }
    if (!country || typeof country !== 'string') {
      return res.status(400).json({ error: 'Nationality / country is required.' });
    }
    const validFormats = ['T20', 'ODI', 'Test'];
    const fmt = validFormats.includes(favoriteFormat) ? favoriteFormat : 'T20';
    const validCurrencies = ['INR', 'GBP', 'USD', 'AUD'];
    const currency = validCurrencies.includes(preferredCurrency) ? preferredCurrency : 'INR';

    const profile = await upsertManagerProfile({
      userUid: uid,
      managerName: computedName,
      firstName: typeof firstName === 'string' ? firstName : '',
      lastName: typeof lastName === 'string' ? lastName : '',
      preferredName: typeof preferredName === 'string' ? preferredName : computedName,
      country,
      preferredCurrency: currency,
      birthYear: Number(birthYear) || 1993,
      birthMonth: typeof birthMonth === 'string' ? birthMonth : 'MAY',
      birthDay: Number(birthDay) || 7,
      coachExperience: typeof coachExperience === 'string' ? coachExperience : 'Regional Experience',
      coachBackground: typeof coachBackground === 'string' ? coachBackground : 'Tactical Analyst',
      coachingStyle: typeof coachingStyle === 'string' ? coachingStyle : 'Balanced Tactical',
      favoriteFormat: fmt,
      avatarUrl: avatarUrl || 'crest:emerald',
      bio: typeof bio === 'string' ? bio : '',
    });

    res.json({ profile });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to save manager profile' });
  }
});

// 2. Leagues
apiRouter.get('/leagues', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const myMemberships = await db
      .select({
        league: leagues,
        role: leagueMembers.role,
        joinedAt: leagueMembers.joinedAt,
      })
      .from(leagueMembers)
      .innerJoin(leagues, eq(leagueMembers.leagueId, leagues.id))
      .where(eq(leagueMembers.userUid, uid))
      .orderBy(desc(leagues.createdAt));

    const enriched = await Promise.all(
      myMemberships.map(async (m) => {
        const members = await db
          .select({ userUid: leagueMembers.userUid })
          .from(leagueMembers)
          .where(eq(leagueMembers.leagueId, m.league.id));
        const [myTeam] = await db
          .select()
          .from(teams)
          .where(and(eq(teams.leagueId, m.league.id), eq(teams.ownerUid, uid)))
          .limit(1);

        return {
          ...m.league,
          myRole: m.role,
          memberCount: members.length,
          onlineCount: wsHub.getOnlineUids(m.league.id).length,
          myTeam: myTeam ?? null,
        };
      })
    );

    res.json({ leagues: enriched });
  } catch (error: any) {
    console.error('List leagues error:', error);
    res.status(500).json({ error: error.message || 'Failed to list leagues' });
  }
});

apiRouter.post('/leagues', async (req: AuthRequest, res) => {
  try {
    if (!isDatabaseConfigured) {
      return res.status(503).json({
        error: 'Cloud SQL database is not connected yet. Provision AI Studio Cloud SQL from the integrations menu to create and persist leagues.',
      });
    }
    const uid = req.user!.uid;
    const {
      name,
      primaryCompetition = 'IPL',
      competitionFormat = 'League',
      maxManagers = 10,
      allowCustomTeams = true,
      startingBudget = 10000,
      maxSquadSize = 25,
      maxOverseas = 8,
      defaultBasePrice = 50,
      bidIncrement = 25,
      auctionDurationSec = 20,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({ error: 'League name must be at least 3 characters.' });
    }

    const validCompetitions = [
      'IPL',
      'PSL',
      'SA20',
      'BBL',
      'The Hundred',
      'International',
    ] as const;
    const chosenCompetition = validCompetitions.includes(primaryCompetition)
      ? (primaryCompetition as (typeof validCompetitions)[number])
      : 'IPL';

    const competitionTemplates = FRANCHISE_CATALOG.filter(
      (tpl) => tpl.leagueCategory === chosenCompetition
    );
    const seededTemplates =
      competitionTemplates.length > 0 ? competitionTemplates : FRANCHISE_CATALOG;

    const clampedManagers = Math.max(2, Math.min(12, Number(maxManagers) || 10));
    const clampedBudget = Math.max(2000, Math.min(25000, Number(startingBudget) || 10000));
    const clampedSquad = Math.max(22, Math.min(30, Number(maxSquadSize) || 25));
    const clampedOverseas = Math.max(0, Math.min(11, Number(maxOverseas) || 8));
    const clampedBase = Math.max(10, Math.min(500, Number(defaultBasePrice) || 50));
    const clampedIncrement = Math.max(5, Math.min(200, Number(bidIncrement) || 25));
    const clampedDuration = Math.max(8, Math.min(60, Number(auctionDurationSec) || 20));

    const createdLeague = await db.transaction(async (tx) => {
      let inviteCode = generateInviteCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await tx
          .select({ id: leagues.id })
          .from(leagues)
          .where(eq(leagues.inviteCode, inviteCode))
          .limit(1);
        if (!existing.length) break;
        inviteCode = generateInviteCode();
      }

      const [league] = await tx
        .insert(leagues)
        .values({
          name: name.trim(),
          inviteCode,
          hostUid: uid,
          primaryCompetition: chosenCompetition,
          competitionFormat,
          maxManagers: clampedManagers,
          allowCustomTeams: Boolean(allowCustomTeams),
          startingBudget: clampedBudget,
          maxSquadSize: clampedSquad,
          minSquadSize: 22,
          maxOverseas: clampedOverseas,
          defaultBasePrice: clampedBase,
          bidIncrement: clampedIncrement,
          auctionDurationSec: clampedDuration,
          status: 'setup',
        })
        .returning();

      await tx.insert(leagueMembers).values({
        leagueId: league.id,
        userUid: uid,
        role: 'host',
      });

      // Seed clubs belonging exclusively to the selected competition
      await tx.insert(teams).values(
        seededTemplates.map((tpl) => ({
          leagueId: league.id,
          templateKey: tpl.templateKey,
          ownerUid: null,
          name: tpl.name,
          shortCode: tpl.shortCode,
          leagueCategory: tpl.leagueCategory,
          homeGround: tpl.homeGround,
          foundedYear: tpl.foundedYear,
          boardValue: tpl.boardValue,
          fanbaseDevotion: tpl.fanbaseDevotion,
          youthFacilities: tpl.youthFacilities,
          primaryColor: tpl.primaryColor,
          secondaryColor: tpl.secondaryColor,
          coachName: tpl.coachName,
          coachingSpecialty: tpl.coachingSpecialty,
          startingBudget: clampedBudget,
          remainingBudget: clampedBudget,
          reputation: tpl.reputation,
          trophiesCount: tpl.trophiesCount,
          historicalTitlesJson: tpl.historicalTitles,
          isCustom: false,
        }))
      );

      // Seed competition-eligible real cricket players (e.g., Pakistan players excluded from IPL)
      const realPlayersPool = buildRealCricketPlayerPool(
        league.id,
        clampedBase,
        chosenCompetition
      );
      const insertedPlayers: (typeof players.$inferSelect)[] = [];
      for (const batch of chunkArray(realPlayersPool, 250)) {
        const resBatch = await tx.insert(players).values(batch).returning();
        insertedPlayers.push(...resBatch);
      }

      // Randomize auction order INSIDE Marquee Sets
      const shuffledAuctionOrder = shuffleAuctionPoolByMarqueeSet(insertedPlayers);

      // Create auction in lobby state with chance-shuffled Marquee Set lots
      const [auction] = await tx
        .insert(auctions)
        .values({
          leagueId: league.id,
          status: 'lobby',
          currentBid: 0,
          autoAdvance: true,
          currentSetName: shuffledAuctionOrder[0]?.marqueeSet || 'Marquee Stars',
        })
        .returning();

      const auctionLotsPayload = shuffledAuctionOrder.map((p, index) => ({
        auctionId: auction.id,
        leagueId: league.id,
        playerId: p.id,
        lotOrder: index + 1,
        basePrice: p.basePrice,
        status: 'pending' as const,
      }));

      for (const lotBatch of chunkArray(auctionLotsPayload, 250)) {
        await tx.insert(auctionPlayers).values(lotBatch);
      }

      const formatNoticeLabel =
        chosenCompetition === 'International'
          ? 'T20, ODI & Test formats'
          : chosenCompetition === 'The Hundred'
            ? '100-Ball format'
            : 'T20 format';

      await tx.insert(notifications).values([
        {
          leagueId: league.id,
          category: 'Club Board',
          title: 'Season 2026/27 — Year Ahead & Board Mandate',
          body: `Gaffer,\n\nWelcome to ${league.name} (${chosenCompetition} · ${formatNoticeLabel}). Franchise ownership expects a disciplined auction strategy balancing marquee stars with domestic core depth ahead of the round-robin campaign.\n\nShare league invite code ${league.inviteCode} with fellow managers, claim your club in Teams, and review your starting purse before the gavel drops.\n\nBoard of Directors`,
        },
        {
          leagueId: league.id,
          category: 'Director of Cricket',
          title: 'Squad Operations & Match-Day Lineups',
          body: `Gaffer,\n\nOpen Squad to inspect your coaching slots, scout network, and player contracts. Under Lineups, lock your preferred Playing XI (${formatNoticeLabel}) — that XI carries straight into Matchday and any scheduled fixture simulations.\n\nMaintaining rotation and stamina management across back-to-back rounds will be decisive once the playoff race tightens.\n\nDirector of Cricket`,
        },
        {
          leagueId: league.id,
          category: 'Chief Executive',
          title: 'Coaching Staff & Global Scouting Desk',
          body: `Football Operations,\n\nBoard approval is active for up to 10 backroom coaching appointments and 6 regional scouts across global domestic circuits. Bookmark key targets in Scouting to trigger auction room alerts when they walk out.\n\nEarly investments in batting and death-bowling specialists pay measurable dividends in high-leverage chase overs.\n\nChief Executive`,
        },
        {
          leagueId: league.id,
          category: 'Medical Team',
          title: 'Pre-Season Baseline Fitness Audit',
          body: `Medical Department Report,\n\nAll ${insertedPlayers.length} registered players in the league database have cleared pre-season baseline cardiovascular and workload assessments and enter the auction pool 100% fit for selection.\n\nKeep an eye on cumulative match workloads once the schedule gets underway — consecutive outings below 45% stamina carry elevated strain risk.\n\nHead Physio`,
        },
      ]);

      await tx.insert(leagueMessages).values({
        leagueId: league.id,
        userUid: uid,
        teamShortCode: 'HQ',
        body: `League "${league.name}" (${chosenCompetition}) initialized with ${seededTemplates.length} clubs and ${insertedPlayers.length} real players. Invite code: ${league.inviteCode}`,
        messageType: 'system',
      });

      await ensureLeagueScheduleExists(league.id, tx);

      return league;
    });

    res.status(201).json({ league: createdLeague });
  } catch (error: any) {
    console.error('Create league error:', error);
    res.status(500).json({ error: error.message || 'Failed to create league' });
  }
});

apiRouter.post('/leagues/join', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const rawCode = String(req.body.inviteCode || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ error: 'Invite code is required.' });
    }

    const profile = await getManagerProfile(uid);

    const joined = await db.transaction(async (tx) => {
      const [league] = await tx
        .select()
        .from(leagues)
        .where(eq(leagues.inviteCode, rawCode))
        .limit(1);

      if (!league) {
        throw new Error('NOT_FOUND:No league found with that invite code.');
      }

      const existing = await tx
        .select()
        .from(leagueMembers)
        .where(and(eq(leagueMembers.leagueId, league.id), eq(leagueMembers.userUid, uid)))
        .limit(1);

      if (existing.length) {
        return { league, alreadyMember: true };
      }

      const members = await tx
        .select({ id: leagueMembers.id })
        .from(leagueMembers)
        .where(eq(leagueMembers.leagueId, league.id));

      if (members.length >= league.maxManagers) {
        throw new Error('FULL:This league has reached its maximum manager capacity.');
      }

      await tx.insert(leagueMembers).values({
        leagueId: league.id,
        userUid: uid,
        role: 'member',
      });

      const managerLabel = profile?.managerName || 'A new manager';
      const [notif] = await tx
        .insert(notifications)
        .values({
          leagueId: league.id,
          category: 'League Notice',
          title: `${managerLabel} joined ${league.name}`,
          body: `League Operations Desk,\n\n${managerLabel} has officially registered as a competing manager inside ${league.name} (${members.length + 1}/${league.maxManagers} seats filled).\n\nExpect an immediate franchise takeover in Teams before live auction bidding and human-vs-human PvP fixtures kick off.`,
        })
        .returning();

      const [sysMsg] = await tx
        .insert(leagueMessages)
        .values({
          leagueId: league.id,
          userUid: uid,
          teamShortCode: 'HQ',
          body: `${managerLabel} joined the league.`,
          messageType: 'system',
        })
        .returning();

      return { league, alreadyMember: false, notif, sysMsg };
    });

    if (!joined.alreadyMember) {
      const fullState = await buildLeagueState(joined.league.id, uid);
      wsHub.broadcastToLeague(joined.league.id, 'league:updated', {
        members: fullState?.members,
      });
      if (joined.notif) wsHub.broadcastToLeague(joined.league.id, 'notification:new', joined.notif);
      if (joined.sysMsg) wsHub.broadcastToLeague(joined.league.id, 'chat:message', joined.sysMsg);
    }

    res.json({ league: joined.league });
  } catch (error: any) {
    const msg = error.message || 'Failed to join league';
    if (msg.startsWith('NOT_FOUND:')) return res.status(404).json({ error: msg.slice(10) });
    if (msg.startsWith('FULL:')) return res.status(409).json({ error: msg.slice(5) });
    console.error('Join league error:', error);
    res.status(500).json({ error: 'Failed to join league' });
  }
});

apiRouter.post('/leagues/:leagueId/leave', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const profile = await getManagerProfile(uid);

    const result = await db.transaction(async (tx) => {
      const allMembers = await tx
        .select()
        .from(leagueMembers)
        .where(eq(leagueMembers.leagueId, leagueId))
        .orderBy(asc(leagueMembers.joinedAt));

      if (allMembers.length <= 1) {
        await tx.delete(leagues).where(eq(leagues.id, leagueId));
        return { deletedLeague: true };
      }

      // Release team ownership back to open franchise pool
      await tx
        .update(teams)
        .set({ ownerUid: null })
        .where(and(eq(teams.leagueId, leagueId), eq(teams.ownerUid, uid)));

      await tx
        .delete(leagueMembers)
        .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userUid, uid)));

      // Transfer host if leaving user was host
      if (member.role === 'host') {
        const nextHost = allMembers.find((m) => m.userUid !== uid);
        if (nextHost) {
          await tx
            .update(leagues)
            .set({ hostUid: nextHost.userUid })
            .where(eq(leagues.id, leagueId));
          await tx
            .update(leagueMembers)
            .set({ role: 'host' })
            .where(eq(leagueMembers.id, nextHost.id));
        }
      }

      const [sysMsg] = await tx
        .insert(leagueMessages)
        .values({
          leagueId,
          userUid: member.userUid,
          teamShortCode: 'HQ',
          body: `${profile?.managerName || 'A manager'} left the league.`,
          messageType: 'system',
        })
        .returning();

      return { deletedLeague: false, sysMsg };
    });

    if (!result.deletedLeague) {
      const state = await buildLeagueState(leagueId, uid);
      wsHub.broadcastToLeague(leagueId, 'league:updated', {
        members: state?.members,
        teams: state?.teams,
        league: state?.league,
      });
      if (result.sysMsg) wsHub.broadcastToLeague(leagueId, 'chat:message', result.sysMsg);
    }

    res.json({ ok: true, deletedLeague: result.deletedLeague });
  } catch (error: any) {
    console.error('Leave league error:', error);
    res.status(500).json({ error: error.message || 'Failed to leave league' });
  }
});

apiRouter.delete('/leagues/:leagueId', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!league) return res.status(404).json({ error: 'League not found.' });

    if (league.hostUid !== uid && member.role !== 'host') {
      return res.status(403).json({ error: 'Only the league host can delete this league.' });
    }

    const memberRows = await db
      .select({ userUid: leagueMembers.userUid })
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, leagueId));
    const memberUids = memberRows.map((m) => m.userUid);

    await db.transaction(async (tx) => {
      await tx.delete(leagues).where(eq(leagues.id, leagueId));
    });

    wsHub.broadcastToLeague(leagueId, 'league:deleted', {
      leagueId,
      leagueName: league.name,
      deletedByUid: uid,
    });
    for (const mUid of memberUids) {
      wsHub.sendToUser(mUid, 'league:deleted', {
        leagueId,
        leagueName: league.name,
        deletedByUid: uid,
      });
    }

    res.json({ ok: true, leagueId });
  } catch (error: any) {
    console.error('Delete league error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete league' });
  }
});

apiRouter.get('/leagues/:leagueId/state', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const state = await buildLeagueState(leagueId, uid);
    if (!state) return res.status(404).json({ error: 'League not found.' });
    res.json(state);
  } catch (error: any) {
    console.error('Get league state error:', error);
    res.status(500).json({ error: error.message || 'Failed to load league state' });
  }
});

// 3. Teams
apiRouter.post('/leagues/:leagueId/teams/claim', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const teamId = Number(req.body.teamId);
    const uid = req.user!.uid;

    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const profile = await getManagerProfile(uid);

    const updated = await db.transaction(async (tx) => {
      const lockedRes = await tx.execute(
        sql`SELECT * FROM teams WHERE id = ${teamId} AND league_id = ${leagueId} FOR UPDATE`
      );
      const targetTeam = lockedRes.rows[0] as
        | { id: number; owner_uid: string | null; name: string; short_code: string }
        | undefined;

      if (!targetTeam) {
        throw new Error('NOT_FOUND:Franchise not found in this league.');
      }
      if (targetTeam.owner_uid && targetTeam.owner_uid !== uid) {
        throw new Error('TAKEN:This franchise has already been claimed by another manager.');
      }

      // Check if user currently owns another team in this league
      const [currentOwned] = await tx
        .select()
        .from(teams)
        .where(and(eq(teams.leagueId, leagueId), eq(teams.ownerUid, uid)))
        .limit(1);

      if (currentOwned && currentOwned.id !== teamId) {
        const existingContracts = await tx
          .select({ id: playerContracts.id })
          .from(playerContracts)
          .where(eq(playerContracts.teamId, currentOwned.id))
          .limit(1);
        if (existingContracts.length > 0) {
          throw new Error(
            'CONFLICT:You cannot switch franchises once your current squad holds player contracts.'
          );
        }
        await tx.update(teams).set({ ownerUid: null }).where(eq(teams.id, currentOwned.id));
      }

      const [claimed] = await tx
        .update(teams)
        .set({ ownerUid: uid })
        .where(eq(teams.id, teamId))
        .returning();

      const managerLabel = profile?.managerName || 'Manager';
      const [notif] = await tx
        .insert(notifications)
        .values({
          leagueId,
          category: 'League Notice',
          title: `${managerLabel} appointed Head Coach of ${claimed.name}`,
          body: `Franchise Takeover Bulletin,\n\n${managerLabel} has officially assumed operational control of ${claimed.name} (${claimed.shortCode}), inheriting a war chest of ${formatLakhsServer(claimed.remainingBudget)} and home turf at ${claimed.homeGround}.\n\nAll league fixtures involving ${claimed.shortCode} are now scheduled for human tactical control and live PvP head-to-heads.`,
        })
        .returning();

      return { claimed, notif };
    });

    const state = await buildLeagueState(leagueId, uid);
    wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });
    if (updated.notif) wsHub.broadcastToLeague(leagueId, 'notification:new', updated.notif);

    res.json({ team: updated.claimed });
  } catch (error: any) {
    const msg = error.message || 'Failed to claim franchise';
    if (msg.startsWith('NOT_FOUND:')) return res.status(404).json({ error: msg.slice(10) });
    if (msg.startsWith('TAKEN:')) return res.status(409).json({ error: msg.slice(6) });
    if (msg.startsWith('CONFLICT:')) return res.status(409).json({ error: msg.slice(9) });
    console.error('Claim team error:', error);
    res.status(500).json({ error: 'Failed to claim franchise' });
  }
});

apiRouter.post('/leagues/:leagueId/teams/custom', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const { name, shortCode, homeGround, primaryColor, coachName, coachingSpecialty } = req.body;
    if (!name || String(name).trim().length < 3) {
      return res.status(400).json({ error: 'Franchise name must be at least 3 characters.' });
    }
    const cleanShort = String(shortCode || name.slice(0, 3))
      .trim()
      .toUpperCase()
      .slice(0, 4);

    const profile = await getManagerProfile(uid);

    const created = await db.transaction(async (tx) => {
      const [league] = await tx.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
      if (!league) throw new Error('NOT_FOUND:League not found.');
      if (!league.allowCustomTeams) {
        throw new Error('FORBIDDEN:Custom franchises are disabled in this league.');
      }

      const [existingOwned] = await tx
        .select()
        .from(teams)
        .where(and(eq(teams.leagueId, leagueId), eq(teams.ownerUid, uid)))
        .limit(1);

      if (existingOwned) {
        const existingContracts = await tx
          .select({ id: playerContracts.id })
          .from(playerContracts)
          .where(eq(playerContracts.teamId, existingOwned.id))
          .limit(1);
        if (existingContracts.length > 0) {
          throw new Error('CONFLICT:Cannot create a new franchise after signing players.');
        }
        await tx.update(teams).set({ ownerUid: null }).where(eq(teams.id, existingOwned.id));
      }

      const [team] = await tx
        .insert(teams)
        .values({
          leagueId,
          templateKey: null,
          ownerUid: uid,
          name: String(name).trim(),
          shortCode: cleanShort,
          leagueCategory: league.primaryCompetition || 'IPL',
          homeGround: String(homeGround || 'Dynasty Cricket Ground').trim(),
          primaryColor: String(primaryColor || '#D97706'),
          secondaryColor: '#1E293B',
          coachName: String(coachName || 'Director of Cricket').trim(),
          coachingSpecialty: String(coachingSpecialty || 'Custom Strategy').trim(),
          startingBudget: league.startingBudget,
          remainingBudget: league.startingBudget,
          reputation: 70,
          trophiesCount: 0,
          historicalTitlesJson: [],
          isCustom: true,
        })
        .returning();

      const [notif] = await tx
        .insert(notifications)
        .values({
          leagueId,
          category: 'League Notice',
          title: `Expansion Franchise ${team.name} (${team.shortCode}) Admitted`,
          body: `League Expansion Desk,\n\n${profile?.managerName || 'Manager'} has founded custom expansion franchise ${team.name} (${team.shortCode}) based at ${team.homeGround}.\n\n${team.shortCode} enters the competition with ${formatLakhsServer(team.startingBudget)} purse parity and full auction eligibility.`,
        })
        .returning();

      return { team, notif };
    });

    const state = await buildLeagueState(leagueId, uid);
    wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });
    if (created.notif) wsHub.broadcastToLeague(leagueId, 'notification:new', created.notif);

    res.status(201).json({ team: created.team });
  } catch (error: any) {
    const msg = error.message || 'Failed to create custom franchise';
    if (msg.startsWith('FORBIDDEN:')) return res.status(403).json({ error: msg.slice(10) });
    if (msg.startsWith('CONFLICT:')) return res.status(409).json({ error: msg.slice(9) });
    console.error('Create custom team error:', error);
    res.status(500).json({ error: 'Failed to create custom franchise' });
  }
});

// 4. Player Database & Import
apiRouter.get('/leagues/:leagueId/players', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(10, Math.min(50, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const q = String(req.query.q || '').trim();
    const role = String(req.query.role || 'ALL');
    const country = String(req.query.country || 'ALL');
    const leagueOrigin = String(req.query.leagueOrigin || 'ALL');
    const minBat = Number(req.query.minBat) || 0;
    const minBowl = Number(req.query.minBowl) || 0;
    const maxAge = Number(req.query.maxAge) || 99;
    const maxVal = Number(req.query.maxValue) || 999999;
    const availability = String(req.query.availability || 'all'); // all | available | owned
    const sortBy = String(req.query.sortBy || 'overall');
    const sortDir = String(req.query.sortDir || 'desc') === 'asc' ? 'asc' : 'desc';

    const conditions = [eq(players.leagueId, leagueId)];
    if (q) conditions.push(ilike(players.name, `%${q}%`));
    if (role !== 'ALL') conditions.push(eq(players.primaryRole, role));
    if (country !== 'ALL') conditions.push(eq(players.country, country));
    if (leagueOrigin !== 'ALL') conditions.push(eq(players.leagueOrigin, leagueOrigin));
    if (minBat > 0) conditions.push(gte(players.battingRating, minBat));
    if (minBowl > 0) conditions.push(gte(players.bowlingRating, minBowl));
    if (maxAge < 99) conditions.push(lte(players.age, maxAge));
    if (maxVal < 999999) conditions.push(lte(players.marketValue, maxVal));

    // Fetch filtered players joined with contracts/teams
    const allMatched = await db
      .select({
        player: players,
        contractTeamId: playerContracts.teamId,
        purchasePrice: playerContracts.purchasePrice,
        teamName: teams.name,
        teamShortCode: teams.shortCode,
        teamColor: teams.primaryColor,
      })
      .from(players)
      .leftJoin(playerContracts, eq(players.id, playerContracts.playerId))
      .leftJoin(teams, eq(playerContracts.teamId, teams.id))
      .where(and(...conditions));

    let filtered = allMatched;
    if (availability === 'available') {
      filtered = allMatched.filter((r) => r.contractTeamId === null);
    } else if (availability === 'owned') {
      filtered = allMatched.filter((r) => r.contractTeamId !== null);
    }

    filtered.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const pa = a.player;
      const pb = b.player;
      switch (sortBy) {
        case 'name':
          return pa.name.localeCompare(pb.name) * dir;
        case 'age':
          return (pa.age - pb.age) * dir;
        case 'batting':
          return (pa.battingRating - pb.battingRating) * dir;
        case 'bowling':
          return (pa.bowlingRating - pb.bowlingRating) * dir;
        case 'value':
          return (pa.marketValue - pb.marketValue) * dir;
        case 'potential':
          return (pa.potential - pb.potential) * dir;
        default: {
          const oa = Math.max(pa.battingRating, pa.bowlingRating);
          const ob = Math.max(pb.battingRating, pb.bowlingRating);
          return (oa - ob) * dir;
        }
      }
    });

    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit).map((row) => ({
      ...row.player,
      ownedByTeamId: row.contractTeamId,
      ownedByTeamName: row.teamName,
      ownedByTeamShortCode: row.teamShortCode,
      ownedByTeamColor: row.teamColor,
      purchasePrice: row.purchasePrice,
    }));

    const countryRows = await db
      .selectDistinct({ country: players.country })
      .from(players)
      .where(eq(players.leagueId, leagueId))
      .orderBy(asc(players.country));

    res.json({
      players: items,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      countries: countryRows.map((c) => c.country),
    });
  } catch (error: any) {
    console.error('List players error:', error);
    res.status(500).json({ error: error.message || 'Failed to load players' });
  }
});

apiRouter.post('/leagues/:leagueId/players/import', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });
    if (member.role !== 'host') {
      return res.status(403).json({ error: 'Only the league host can import player datasets.' });
    }

    const rawRows = req.body.players;
    const sourceLabel = String(req.body.sourceLabel || 'Custom Imported Dataset').trim();
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.status(400).json({ error: 'Provide at least one player record to import.' });
    }
    if (rawRows.length > 250) {
      return res.status(400).json({ error: 'Maximum 250 players per import batch.' });
    }

    const clampRating = (val: unknown, fallback = 65) =>
      Math.max(10, Math.min(99, Math.round(Number(val) || fallback)));

    const validRoles = ['Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'];

    const normalized = rawRows.map((r: any, idx: number) => {
      const name = String(r.name || '').trim();
      if (!name) throw new Error(`Row ${idx + 1}: Player name is required.`);
      const country = String(r.country || 'India').trim();
      const primaryRole = validRoles.includes(r.primaryRole) ? r.primaryRole : 'Batsman';
      const bat = clampRating(r.battingRating, 68);
      const bowl = clampRating(r.bowlingRating, 55);
      const field = clampRating(r.fieldingRating, 70);
      const basePrice = Math.max(10, Math.min(500, Math.round(Number(r.basePrice) || 50)));
      const marketValue = Math.max(basePrice, Math.round(Number(r.marketValue) || basePrice * 2));

      const defaultFormatStats = {
        matches: Number(r.matches) || 0,
        runs: Number(r.runs) || 0,
        battingAvg: Number(r.battingAvg) || 0,
        strikeRate: Number(r.strikeRate) || 0,
        hundreds: Number(r.hundreds) || 0,
        fifties: Number(r.fifties) || 0,
        wickets: Number(r.wickets) || 0,
        economy: Number(r.economy) || 0,
        bowlingAvg: Number(r.bowlingAvg) || 0,
        bestBowling: String(r.bestBowling || '-'),
      };

      return {
        leagueId,
        name,
        country,
        isOverseas: r.isOverseas !== undefined ? Boolean(r.isOverseas) : country !== 'India',
        age: Math.max(16, Math.min(45, Math.round(Number(r.age) || 25))),
        battingHand: r.battingHand === 'Left-hand' ? 'Left-hand' : 'Right-hand',
        bowlingStyle: String(r.bowlingStyle || (primaryRole === 'Bowler' ? 'Right-arm fast' : 'None')),
        primaryRole,
        battingRating: bat,
        bowlingRating: bowl,
        fieldingRating: field,
        fitness: clampRating(r.fitness, 80),
        consistency: clampRating(r.consistency, 72),
        temperament: clampRating(r.temperament, 72),
        potential: clampRating(r.potential, Math.max(bat, bowl) + 5),
        currentForm: clampRating(r.currentForm, 70),
        morale: clampRating(r.morale, 75),
        basePrice,
        marketValue,
        isGenerated: false,
        sourceLabel,
        injuryStatus: 'Fit',
        statsJson: r.statsJson || {
          t20: defaultFormatStats,
          odi: defaultFormatStats,
          test: defaultFormatStats,
        },
      };
    });

    const inserted = await db.transaction(async (tx) => {
      const createdPlayers = await tx.insert(players).values(normalized).returning();

      const [auction] = await tx
        .select()
        .from(auctions)
        .where(eq(auctions.leagueId, leagueId))
        .limit(1);

      if (auction && auction.status !== 'completed') {
        const maxOrderRes = await tx
          .select({ maxOrder: sql<number>`COALESCE(MAX(${auctionPlayers.lotOrder}), 0)` })
          .from(auctionPlayers)
          .where(eq(auctionPlayers.auctionId, auction.id));
        const startOrder = Number(maxOrderRes[0]?.maxOrder || 0);

        await tx.insert(auctionPlayers).values(
          createdPlayers.map((p, idx) => ({
            auctionId: auction.id,
            leagueId,
            playerId: p.id,
            lotOrder: startOrder + idx + 1,
            basePrice: p.basePrice,
            status: 'pending',
          }))
        );
      }

      const [notif] = await tx
        .insert(notifications)
        .values({
          leagueId,
          category: 'League Notice',
          title: `${createdPlayers.length} Custom Players Added to Auction Registry`,
          body: `Registry Operations,\n\nThe league commissioner imported ${createdPlayers.length} custom-registered players from "${sourceLabel}" into the active auction pool.\n\nScouts have updated player cards in Scouting ahead of upcoming marquee sets.`,
        })
        .returning();

      return { createdPlayers, notif };
    });

    wsHub.broadcastToLeague(leagueId, 'players:imported', {
      count: inserted.createdPlayers.length,
    });
    if (inserted.notif) wsHub.broadcastToLeague(leagueId, 'notification:new', inserted.notif);

    res.status(201).json({ importedCount: inserted.createdPlayers.length });
  } catch (error: any) {
    console.error('Import players error:', error);
    res.status(400).json({ error: error.message || 'Failed to import players' });
  }
});

// 5. Squad & Lineups
apiRouter.get('/leagues/:leagueId/teams/:teamId/squad', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const teamId = Number(req.params.teamId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
      .limit(1);

    if (!team) return res.status(404).json({ error: 'Team not found.' });

    const squadRows = await db
      .select({
        contract: playerContracts,
        player: players,
      })
      .from(playerContracts)
      .innerJoin(players, eq(playerContracts.playerId, players.id))
      .where(and(eq(playerContracts.teamId, teamId), eq(playerContracts.leagueId, leagueId)))
      .orderBy(desc(playerContracts.purchasePrice));

    const teamLineups = await db
      .select()
      .from(lineups)
      .where(and(eq(lineups.teamId, teamId), eq(lineups.leagueId, leagueId)));

    res.json({
      team,
      squad: squadRows.map((r) => ({
        ...r.player,
        contract: r.contract,
      })),
      lineups: teamLineups,
    });
  } catch (error: any) {
    console.error('Get squad error:', error);
    res.status(500).json({ error: error.message || 'Failed to load squad' });
  }
});

apiRouter.put('/leagues/:leagueId/teams/:teamId/lineup', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const teamId = Number(req.params.teamId);
    const uid = req.user!.uid;

    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
      .limit(1);

    if (!team) return res.status(404).json({ error: 'Team not found.' });
    if (team.ownerUid !== uid) {
      return res.status(403).json({ error: 'Only the franchise manager can update this lineup.' });
    }

    const { format, battingOrder, captainPlayerId, viceCaptainPlayerId, wicketkeeperPlayerId } =
      req.body;
    const allowedFormats =
      team.leagueCategory === 'International'
        ? ['T20', 'ODI', 'Test']
        : team.leagueCategory === 'The Hundred'
          ? ['Hundred']
          : ['T20'];
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({
        error: `${team.name} (${team.leagueCategory}) only competes in ${allowedFormats.join(', ')} format.`,
      });
    }
    if (!Array.isArray(battingOrder) || battingOrder.length > 11) {
      return res.status(400).json({ error: 'Playing XI cannot exceed 11 players.' });
    }

    const uniqueIds = Array.from(new Set(battingOrder.map(Number)));
    if (uniqueIds.length !== battingOrder.length) {
      return res.status(400).json({ error: 'Duplicate players are not permitted in Playing XI.' });
    }

    const totalContracts = await db
      .select({ playerId: playerContracts.playerId })
      .from(playerContracts)
      .where(and(eq(playerContracts.leagueId, leagueId), eq(playerContracts.teamId, teamId)));

    if (uniqueIds.length > 0) {
      if (totalContracts.length >= 11) {
        const contractedSet = new Set(totalContracts.map((c) => c.playerId));
        if (!uniqueIds.every((id) => contractedSet.has(id))) {
          return res.status(400).json({ error: 'All lineup players must belong to your contracted squad.' });
        }
      } else {
        // Allow saving exhibition/pre-auction XI from league pool while squad contracts < 11
        const validLeaguePlayers = await db
          .select({ id: players.id })
          .from(players)
          .where(and(eq(players.leagueId, leagueId), inArray(players.id, uniqueIds)));
        if (validLeaguePlayers.length !== uniqueIds.length) {
          return res.status(400).json({ error: 'Lineup includes invalid league players.' });
        }
      }
    }

    const wkId = wicketkeeperPlayerId ? Number(wicketkeeperPlayerId) : null;
    if (wkId) {
      const [wkPlayer] = await db
        .select({ primaryRole: players.primaryRole, name: players.name })
        .from(players)
        .where(and(eq(players.leagueId, leagueId), eq(players.id, wkId)))
        .limit(1);
      if (!wkPlayer || wkPlayer.primaryRole !== 'Wicketkeeper') {
        return res.status(400).json({
          error: `${wkPlayer?.name || 'Selected player'} is not a natural wicketkeeper. Only Wicketkeepers can be assigned as WK.`,
        });
      }
    }

    const [saved] = await db
      .insert(lineups)
      .values({
        leagueId,
        teamId,
        format,
        captainPlayerId: captainPlayerId ? Number(captainPlayerId) : null,
        viceCaptainPlayerId: viceCaptainPlayerId ? Number(viceCaptainPlayerId) : null,
        wicketkeeperPlayerId: wicketkeeperPlayerId ? Number(wicketkeeperPlayerId) : null,
        battingOrderJson: uniqueIds,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [lineups.teamId, lineups.format],
        set: {
          captainPlayerId: captainPlayerId ? Number(captainPlayerId) : null,
          viceCaptainPlayerId: viceCaptainPlayerId ? Number(viceCaptainPlayerId) : null,
          wicketkeeperPlayerId: wicketkeeperPlayerId ? Number(wicketkeeperPlayerId) : null,
          battingOrderJson: uniqueIds,
          updatedAt: new Date(),
        },
      })
      .returning();

    wsHub.broadcastToLeague(leagueId, 'squad:updated', {
      teamId,
      teamName: team.name,
      format,
    });

    res.json({ lineup: saved });
  } catch (error: any) {
    console.error('Save lineup error:', error);
    res.status(500).json({ error: error.message || 'Failed to save lineup' });
  }
});

apiRouter.post('/leagues/:leagueId/teams/:teamId/release', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const teamId = Number(req.params.teamId);
    const playerId = Number(req.body.playerId);
    const uid = req.user!.uid;

    const releaseRes = await db.transaction(async (tx) => {
      const lockedTeam = await tx.execute(
        sql`SELECT * FROM teams WHERE id = ${teamId} AND league_id = ${leagueId} FOR UPDATE`
      );
      const teamRow = lockedTeam.rows[0] as
        | { id: number; owner_uid: string | null; name: string; short_code: string; remaining_budget: number }
        | undefined;

      if (!teamRow) throw new Error('NOT_FOUND:Team not found.');
      if (teamRow.owner_uid !== uid) throw new Error('FORBIDDEN:Not your franchise.');

      const [contract] = await tx
        .select()
        .from(playerContracts)
        .where(and(eq(playerContracts.teamId, teamId), eq(playerContracts.playerId, playerId)))
        .limit(1);

      if (!contract) throw new Error('NOT_FOUND:Player contract not found.');

      const [player] = await tx.select().from(players).where(eq(players.id, playerId)).limit(1);

      const refund = Math.round(contract.purchasePrice * 0.5);
      await tx
        .update(teams)
        .set({ remainingBudget: teamRow.remaining_budget + refund })
        .where(eq(teams.id, teamId));

      await tx.delete(playerContracts).where(eq(playerContracts.id, contract.id));

      // Remove player from saved lineups for this team
      const teamLineups = await tx.select().from(lineups).where(eq(lineups.teamId, teamId));
      for (const l of teamLineups) {
        const filteredOrder = (l.battingOrderJson || []).filter((id) => id !== playerId);
        await tx
          .update(lineups)
          .set({
            battingOrderJson: filteredOrder,
            captainPlayerId: l.captainPlayerId === playerId ? null : l.captainPlayerId,
            viceCaptainPlayerId: l.viceCaptainPlayerId === playerId ? null : l.viceCaptainPlayerId,
            wicketkeeperPlayerId: l.wicketkeeperPlayerId === playerId ? null : l.wicketkeeperPlayerId,
          })
          .where(eq(lineups.id, l.id));
      }

      // Make player available again in pending auction pool if auction isn't completed
      const [auction] = await tx
        .select()
        .from(auctions)
        .where(eq(auctions.leagueId, leagueId))
        .limit(1);
      if (auction && auction.status !== 'completed') {
        await tx
          .update(auctionPlayers)
          .set({ status: 'pending', soldPrice: null, winningTeamId: null })
          .where(and(eq(auctionPlayers.auctionId, auction.id), eq(auctionPlayers.playerId, playerId)));
      }

      const [notif] = await tx
        .insert(notifications)
        .values({
          leagueId,
          targetUid: teamRow.owner_uid,
          category: 'Director of Cricket',
          title: `${player?.name || 'Player'} released from ${teamRow.short_code} roster`,
          body: `Contract Settlement Notice,\n\n${teamRow.name} (${teamRow.short_code}) has formally waived ${player?.name || 'player'}, crediting ${formatLakhsServer(refund)} (50% contract rebate) back into the active salary purse.\n\nLineup sheets have been automatically adjusted to remove any stale batting-order references.`,
        })
        .returning();

      return { refund, notif };
    });

    const state = await buildLeagueState(leagueId, uid);
    wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });
    wsHub.broadcastToLeague(leagueId, 'squad:updated', { teamId });
    if (releaseRes.notif) wsHub.broadcastToLeague(leagueId, 'notification:new', releaseRes.notif);

    res.json({ ok: true, refund: releaseRes.refund });
  } catch (error: any) {
    const msg = error.message || 'Failed to release player';
    if (msg.startsWith('NOT_FOUND:')) return res.status(404).json({ error: msg.slice(10) });
    if (msg.startsWith('FORBIDDEN:')) return res.status(403).json({ error: msg.slice(10) });
    console.error('Release player error:', error);
    res.status(500).json({ error: 'Failed to release player' });
  }
});

// 5b. Catalogs, Coaching Staff, Scouting Network, Development Plans, Tactics & Real Pool Sync
apiRouter.get('/leagues/:leagueId/catalogs', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    res.json({
      coaches: COACH_CATALOG,
      scouts: SCOUT_CATALOG,
      franchises: FRANCHISE_CATALOG,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load catalogs' });
  }
});

apiRouter.post('/leagues/:leagueId/upgrade-real-pool', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const upgradeStats = await db.transaction(async (tx) => {
      const [league] = await tx.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
      if (!league) throw new Error('League not found.');

      const allowedCategories = [
        'IPL',
        'PSL',
        'SA20',
        'BBL',
        'The Hundred',
        'International',
      ];
      const targetComp = allowedCategories.includes(league.primaryCompetition)
        ? league.primaryCompetition
        : 'IPL';

      // Remove unowned legacy franchises outside the league's primary competition
      await tx
        .delete(teams)
        .where(
          and(
            eq(teams.leagueId, leagueId),
            eq(teams.isCustom, false),
            isNull(teams.ownerUid),
            ne(teams.leagueCategory, targetComp)
          )
        );

      const existingTeams = await tx.select().from(teams).where(eq(teams.leagueId, leagueId));
      const existingKeys = new Set(existingTeams.map((t) => t.templateKey).filter(Boolean));
      const missingTeams = FRANCHISE_CATALOG.filter(
        (tpl) => tpl.leagueCategory === targetComp && !existingKeys.has(tpl.templateKey)
      );

      if (missingTeams.length > 0) {
        await tx.insert(teams).values(
          missingTeams.map((tpl) => ({
            leagueId,
            templateKey: tpl.templateKey,
            ownerUid: null,
            name: tpl.name,
            shortCode: tpl.shortCode,
            leagueCategory: tpl.leagueCategory,
            homeGround: tpl.homeGround,
            foundedYear: tpl.foundedYear,
            boardValue: tpl.boardValue,
            fanbaseDevotion: tpl.fanbaseDevotion,
            youthFacilities: tpl.youthFacilities,
            primaryColor: tpl.primaryColor,
            secondaryColor: tpl.secondaryColor,
            coachName: tpl.coachName,
            coachingSpecialty: tpl.coachingSpecialty,
            startingBudget: league.startingBudget,
            remainingBudget: league.startingBudget,
            reputation: tpl.reputation,
            trophiesCount: tpl.trophiesCount,
            historicalTitlesJson: tpl.historicalTitles,
            isCustom: false,
          }))
        );
      }

      // Sync existing template metadata on existing teams
      for (const tpl of FRANCHISE_CATALOG) {
        await tx
          .update(teams)
          .set({
            name: tpl.name,
            shortCode: tpl.shortCode,
            leagueCategory: tpl.leagueCategory,
            homeGround: tpl.homeGround,
            foundedYear: tpl.foundedYear,
            boardValue: tpl.boardValue,
            fanbaseDevotion: tpl.fanbaseDevotion,
            youthFacilities: tpl.youthFacilities,
            primaryColor: tpl.primaryColor,
            secondaryColor: tpl.secondaryColor,
          })
          .where(and(eq(teams.leagueId, leagueId), eq(teams.templateKey, tpl.templateKey)));
      }

      const fullPool = buildRealCricketPlayerPool(leagueId, league.defaultBasePrice, targetComp);
      const poolByName = new Map(fullPool.map((p) => [p.name.trim().toLowerCase(), p]));

      const contractedIds = (
        await tx
          .select({ playerId: playerContracts.playerId })
          .from(playerContracts)
          .where(eq(playerContracts.leagueId, leagueId))
      ).map((c) => c.playerId);

      const [auction] = await tx
        .select()
        .from(auctions)
        .where(eq(auctions.leagueId, leagueId))
        .limit(1);

      let activeLotPlayerId: number | null = null;
      if (auction?.currentLotId) {
        const [activeLot] = await tx
          .select({ playerId: auctionPlayers.playerId })
          .from(auctionPlayers)
          .where(eq(auctionPlayers.id, auction.currentLotId))
          .limit(1);
        activeLotPlayerId = activeLot?.playerId ?? null;
      }

      const protectedIds = new Set<number>([
        ...contractedIds,
        ...(activeLotPlayerId ? [activeLotPlayerId] : []),
      ]);

      const allExistingPlayers = await tx
        .select({
          id: players.id,
          name: players.name,
          leagueOrigin: players.leagueOrigin,
          isGenerated: players.isGenerated,
          sourceLabel: players.sourceLabel,
        })
        .from(players)
        .where(eq(players.leagueId, leagueId));

      const stalePlayerIds = allExistingPlayers
        .filter((p) => {
          if (protectedIds.has(p.id)) return false;
          if (
            !p.isGenerated &&
            p.sourceLabel !== 'CM27 Verified Global Registry' &&
            p.sourceLabel !== 'Core International Registry' &&
            !p.sourceLabel.includes('Registry')
          ) {
            return false;
          }
          return p.isGenerated || !poolByName.has(p.name.trim().toLowerCase());
        })
        .map((p) => p.id);

      let removedPlayersCount = 0;
      for (const batchIds of chunkArray(stalePlayerIds, 250)) {
        await tx.delete(players).where(inArray(players.id, batchIds));
        removedPlayersCount += batchIds.length;
      }

      // Sync realistic OVR ratings, formDelta, marqueeSet, and stats onto remaining registry players
      const remainingPlayers = await tx
        .select({ id: players.id, name: players.name })
        .from(players)
        .where(eq(players.leagueId, leagueId));

      for (const existing of remainingPlayers) {
        const ref = poolByName.get(existing.name.trim().toLowerCase());
        if (!ref) continue;
        await tx
          .update(players)
          .set({
            leagueOrigin: ref.leagueOrigin,
            isOverseas: ref.isOverseas,
            battingRating: ref.battingRating,
            bowlingRating: ref.bowlingRating,
            fieldingRating: ref.fieldingRating,
            fitness: ref.fitness,
            consistency: ref.consistency,
            temperament: ref.temperament,
            potential: ref.potential,
            currentForm: ref.currentForm,
            morale: ref.morale,
            basePrice: ref.basePrice,
            marketValue: ref.marketValue,
            marqueeSet: ref.marqueeSet,
            formDelta: ref.formDelta,
            statsJson: ref.statsJson,
          })
          .where(eq(players.id, existing.id));
      }

      const remainingNames = new Set(remainingPlayers.map((p) => p.name.trim().toLowerCase()));
      const missingPlayers = fullPool.filter(
        (p) => !remainingNames.has(p.name.trim().toLowerCase())
      );

      let addedPlayersCount = 0;
      if (missingPlayers.length > 0) {
        const inserted: (typeof players.$inferSelect)[] = [];
        for (const batch of chunkArray(missingPlayers, 250)) {
          const resBatch = await tx.insert(players).values(batch).returning();
          inserted.push(...resBatch);
        }
        addedPlayersCount = inserted.length;

        if (auction && auction.status !== 'completed') {
          const maxOrderRes = await tx
            .select({ maxOrder: sql<number>`COALESCE(MAX(${auctionPlayers.lotOrder}), 0)` })
            .from(auctionPlayers)
            .where(eq(auctionPlayers.auctionId, auction.id));
          const startOrder = Number(maxOrderRes[0]?.maxOrder || 0);

          const shuffledInserted = shuffleAuctionPoolByMarqueeSet(inserted);
          const lotRows = shuffledInserted.map((p, idx) => ({
            auctionId: auction.id,
            leagueId,
            playerId: p.id,
            lotOrder: startOrder + idx + 1,
            basePrice: p.basePrice,
            status: 'pending' as const,
          }));

          for (const lotBatch of chunkArray(lotRows, 250)) {
            await tx.insert(auctionPlayers).values(lotBatch);
          }
        }
      }

      return {
        addedTeams: missingTeams.length,
        addedPlayers: addedPlayersCount,
        removedPlayers: removedPlayersCount,
      };
    });

    const state = await buildLeagueState(leagueId, uid);
    wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });
    wsHub.broadcastToLeague(leagueId, 'players:imported', {
      count: upgradeStats.addedPlayers,
    });
    res.json({ ok: true, ...upgradeStats, teams: state?.teams });
  } catch (error: any) {
    console.error('Upgrade real pool error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync global cricket registry' });
  }
});

apiRouter.post('/leagues/:leagueId/teams/:teamId/staff/hire', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const teamId = Number(req.params.teamId);
    const coachId = String(req.body.coachId || '');
    const uid = req.user!.uid;

    const coach = COACH_CATALOG.find((c) => c.id === coachId);
    if (!coach) return res.status(404).json({ error: 'Coach not found in registry.' });

    const result = await db.transaction(async (tx) => {
      const [team] = await tx
        .select()
        .from(teams)
        .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
        .limit(1);
      if (!team) throw new Error('NOT_FOUND:Team not found.');
      if (team.ownerUid !== uid) throw new Error('FORBIDDEN:Only the franchise manager can hire staff.');

      const currentStaff = Array.isArray(team.hiredStaffJson) ? team.hiredStaffJson : [];
      if (currentStaff.some((s) => s.id === coach.id)) {
        throw new Error('CONFLICT:This coach is already on your staff.');
      }
      if (currentStaff.length >= 10) {
        throw new Error('CONFLICT:Staff capacity (10/10) reached. Release a coach first.');
      }
      if (team.remainingBudget < coach.signingFeeLakhs) {
        throw new Error(
          `INVALID:Insufficient purse. Signing fee is ${formatLakhsServer(coach.signingFeeLakhs)}.`
        );
      }

      const nextStaff = [
        ...currentStaff,
        {
          id: coach.id,
          name: coach.name,
          role: coach.role,
          knowledge: coach.knowledge,
          batStars: coach.batStars,
          bowlStars: coach.bowlStars,
          fieldStars: coach.fieldStars,
          wkStars: coach.wkStars,
          signingFeeLakhs: coach.signingFeeLakhs,
          weeklyWageLakhs: coach.weeklyWageLakhs,
          legacyNote: coach.legacyNote,
          hiredAt: new Date().toISOString(),
        },
      ];

      const updateValues: Record<string, any> = {
        hiredStaffJson: nextStaff,
        remainingBudget: team.remainingBudget - coach.signingFeeLakhs,
      };
      if (coach.role === 'Head Coach') {
        updateValues.coachName = coach.name;
        updateValues.coachingSpecialty = coach.legacyNote;
      }

      const [updatedTeam] = await tx
        .update(teams)
        .set(updateValues)
        .where(eq(teams.id, teamId))
        .returning();

      const [notif] = await tx
        .insert(notifications)
        .values({
          leagueId,
          targetUid: team.ownerUid,
          category: 'Chief Executive',
          title: `${coach.name} appointed ${coach.role}`,
          body: `Backroom Appointment Confirmed,\n\n${team.name} (${team.shortCode}) finalized terms with ${coach.name} (${coach.knowledge} tier · ${coach.role}) on a ${formatLakhsServer(coach.signingFeeLakhs)} signing package.\n\nSpecialty Note: ${coach.legacyNote}. Tactical coaching modifiers are now live across Squad & Matchday.`,
        })
        .returning();

      return { updatedTeam, notif };
    });

    const state = await buildLeagueState(leagueId, uid);
    wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });
    if (result.notif) wsHub.broadcastToLeague(leagueId, 'notification:new', result.notif);

    res.json({ team: result.updatedTeam });
  } catch (error: any) {
    const msg = error.message || 'Failed to hire coach';
    if (msg.startsWith('NOT_FOUND:')) return res.status(404).json({ error: msg.slice(10) });
    if (msg.startsWith('FORBIDDEN:')) return res.status(403).json({ error: msg.slice(10) });
    if (msg.startsWith('CONFLICT:')) return res.status(409).json({ error: msg.slice(9) });
    if (msg.startsWith('INVALID:')) return res.status(400).json({ error: msg.slice(8) });
    res.status(500).json({ error: msg });
  }
});

apiRouter.post('/leagues/:leagueId/teams/:teamId/staff/release', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const teamId = Number(req.params.teamId);
    const coachId = String(req.body.coachId || '');
    const uid = req.user!.uid;

    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
      .limit(1);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    if (team.ownerUid !== uid) return res.status(403).json({ error: 'Not your franchise.' });

    const currentStaff = Array.isArray(team.hiredStaffJson) ? team.hiredStaffJson : [];
    const nextStaff = currentStaff.filter((s) => s.id !== coachId);

    const [updatedTeam] = await db
      .update(teams)
      .set({ hiredStaffJson: nextStaff })
      .where(eq(teams.id, teamId))
      .returning();

    const state = await buildLeagueState(leagueId, uid);
    wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });
    res.json({ team: updatedTeam });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to release coach' });
  }
});

apiRouter.post('/leagues/:leagueId/teams/:teamId/scouts/hire', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const teamId = Number(req.params.teamId);
    const scoutId = String(req.body.scoutId || '');
    const uid = req.user!.uid;

    const scout = SCOUT_CATALOG.find((s) => s.id === scoutId);
    if (!scout) return res.status(404).json({ error: 'Scout not found in registry.' });

    const result = await db.transaction(async (tx) => {
      const [team] = await tx
        .select()
        .from(teams)
        .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
        .limit(1);
      if (!team) throw new Error('NOT_FOUND:Team not found.');
      if (team.ownerUid !== uid) throw new Error('FORBIDDEN:Only the franchise manager can hire scouts.');

      const currentScouts = Array.isArray(team.hiredScoutsJson) ? team.hiredScoutsJson : [];
      if (currentScouts.some((s) => s.id === scout.id)) {
        throw new Error('CONFLICT:This scout is already contracted to your club.');
      }
      if (currentScouts.length >= 6) {
        throw new Error('CONFLICT:Maximum 6 active scouts allowed per franchise.');
      }
      if (team.remainingBudget < scout.networkCostLakhs) {
        throw new Error(
          `INVALID:Insufficient purse. Network cost is ${formatLakhsServer(scout.networkCostLakhs)}.`
        );
      }

      const nextScouts = [
        ...currentScouts,
        {
          id: scout.id,
          name: scout.name,
          country: scout.country,
          experienceStars: scout.experienceStars,
          judgementStars: scout.judgementStars,
          networkCostLakhs: scout.networkCostLakhs,
          specialtyRegion: scout.specialtyRegion,
          hiredAt: new Date().toISOString(),
          activeMission: null,
        },
      ];

      const [updatedTeam] = await tx
        .update(teams)
        .set({
          hiredScoutsJson: nextScouts,
          remainingBudget: team.remainingBudget - scout.networkCostLakhs,
        })
        .where(eq(teams.id, teamId))
        .returning();

      const [notif] = await tx
        .insert(notifications)
        .values({
          leagueId,
          targetUid: team.ownerUid,
          category: 'Academy Director',
          title: `Scout ${scout.name} joined ${team.shortCode} recruitment network`,
          body: `Scouting Operations Brief,\n\n${team.name} (${team.shortCode}) contracted ${scout.name} (${scout.specialtyRegion}) for ${formatLakhsServer(scout.networkCostLakhs)} to expand regional coverage.\n\nAssign a targeted scouting mission in Scouting to uncover undervalued uncapped talent and overseas finishers.`,
        })
        .returning();

      return { updatedTeam, notif };
    });

    const state = await buildLeagueState(leagueId, uid);
    wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });
    if (result.notif) wsHub.broadcastToLeague(leagueId, 'notification:new', result.notif);
    res.json({ team: result.updatedTeam });
  } catch (error: any) {
    const msg = error.message || 'Failed to hire scout';
    if (msg.startsWith('NOT_FOUND:')) return res.status(404).json({ error: msg.slice(10) });
    if (msg.startsWith('FORBIDDEN:')) return res.status(403).json({ error: msg.slice(10) });
    if (msg.startsWith('CONFLICT:')) return res.status(409).json({ error: msg.slice(9) });
    if (msg.startsWith('INVALID:')) return res.status(400).json({ error: msg.slice(8) });
    res.status(500).json({ error: msg });
  }
});

apiRouter.post('/leagues/:leagueId/teams/:teamId/scouts/release', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const teamId = Number(req.params.teamId);
    const scoutId = String(req.body.scoutId || '');
    const uid = req.user!.uid;

    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
      .limit(1);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    if (team.ownerUid !== uid) return res.status(403).json({ error: 'Not your franchise.' });

    const currentScouts = Array.isArray(team.hiredScoutsJson) ? team.hiredScoutsJson : [];
    const [updatedTeam] = await db
      .update(teams)
      .set({ hiredScoutsJson: currentScouts.filter((s) => s.id !== scoutId) })
      .where(eq(teams.id, teamId))
      .returning();

    const state = await buildLeagueState(leagueId, uid);
    wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });
    res.json({ team: updatedTeam });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to release scout' });
  }
});

apiRouter.post('/leagues/:leagueId/teams/:teamId/scouts/assign', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const teamId = Number(req.params.teamId);
    const scoutId = String(req.body.scoutId || '');
    const targetRegion = String(req.body.targetRegion || 'ALL');
    const targetRole = String(req.body.targetRole || 'ALL');
    const targetLeague = String(req.body.targetLeague || 'ALL');
    const minPotential = Math.max(60, Math.min(95, Number(req.body.minPotential) || 76));
    const uid = req.user!.uid;

    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
      .limit(1);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    if (team.ownerUid !== uid) return res.status(403).json({ error: 'Not your franchise.' });

    const currentScouts = Array.isArray(team.hiredScoutsJson) ? team.hiredScoutsJson : [];
    const scout = currentScouts.find((s) => s.id === scoutId);
    if (!scout) return res.status(404).json({ error: 'Scout not hired by your club.' });

    const archetypes: string[] = Array.isArray(req.body.archetypes)
      ? req.body.archetypes.map((a: any) => String(a)).slice(0, 3)
      : [];

    const conditions = [eq(players.leagueId, leagueId), gte(players.potential, minPotential)];
    if (targetRegion !== 'ALL') conditions.push(eq(players.country, targetRegion));
    if (targetRole !== 'ALL') conditions.push(eq(players.primaryRole, targetRole));
    if (targetLeague !== 'ALL') conditions.push(eq(players.leagueOrigin, targetLeague));

    const limitCount = Math.min(18, Math.max(6, scout.experienceStars * 3));
    const rawCandidates = await db
      .select()
      .from(players)
      .where(and(...conditions))
      .orderBy(desc(players.potential), desc(players.battingRating))
      .limit(archetypes.length > 0 ? limitCount * 5 : limitCount);

    const scoreByArchetypes = (p: typeof rawCandidates[number]) => {
      if (archetypes.length === 0) return p.potential;
      let score = p.potential * 0.4;
      const t20 = p.statsJson?.t20;
      const sr = t20?.strikeRate || 120;
      const econ = t20?.economy || 7.8;
      const bAvg = t20?.battingAvg || 22;
      const style = (p.bowlingStyle || '').toLowerCase();
      const isSpin = style.includes('break') || style.includes('orthodox') || style.includes('spin') || style.includes('wrist');
      const isPace = style.includes('fast') || style.includes('medium');

      for (const arch of archetypes) {
        switch (arch) {
          case 'Aggressor':
          case 'Power hitter':
            score += p.battingRating * 0.5 + Math.max(0, sr - 125) * 0.8;
            break;
          case 'Finisher':
            score += p.battingRating * 0.4 + p.temperament * 0.35 + Math.max(0, sr - 130) * 0.6;
            break;
          case 'Strike rotator':
          case 'Finesse':
            score += p.consistency * 0.45 + p.battingRating * 0.35;
            break;
          case 'Defensive wall':
          case 'Anchor':
            score += p.temperament * 0.5 + p.consistency * 0.4 + Math.max(0, bAvg - 24) * 0.7;
            break;
          case 'New-ball':
            score += (isPace ? 20 : 0) + p.bowlingRating * 0.5;
            break;
          case 'Death overs':
            score += (isPace ? 14 : 4) + p.bowlingRating * 0.4 + p.temperament * 0.3;
            break;
          case 'Control spinner':
            score += (isSpin ? 24 : -10) + p.bowlingRating * 0.5;
            break;
          case 'Containment':
            score += p.bowlingRating * 0.4 + Math.max(0, 8.8 - econ) * 8;
            break;
          case 'Wicket-taker':
            score += p.bowlingRating * 0.55 + ((t20?.wickets || 0) >= 60 ? 12 : 0);
            break;
          case 'Enforcer':
            score += p.bowlingRating * 0.4 + p.fitness * 0.35;
            break;
        }
      }
      return score;
    };

    const candidates =
      archetypes.length > 0
        ? [...rawCandidates].sort((a, b) => scoreByArchetypes(b) - scoreByArchetypes(a)).slice(0, limitCount)
        : rawCandidates;

    const nextScouts = currentScouts.map((s) =>
      s.id === scoutId
        ? {
            ...s,
            activeMission: {
              targetRegion,
              targetRole,
              targetLeague,
              archetypes,
              minPotential,
              completedAt: new Date().toISOString(),
              recommendedPlayerIds: candidates.map((c) => c.id),
            },
          }
        : s
    );

    const [updatedTeam] = await db
      .update(teams)
      .set({ hiredScoutsJson: nextScouts })
      .where(eq(teams.id, teamId))
      .returning();

    const state = await buildLeagueState(leagueId, uid);
    wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });

    res.json({ team: updatedTeam, scoutedPlayers: candidates });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to run scouting mission' });
  }
});

apiRouter.put('/leagues/:leagueId/teams/:teamId/development', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const teamId = Number(req.params.teamId);
    const uid = req.user!.uid;
    const { playerId, trajectory, focusAttribute, weeklyIntensity } = req.body;

    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
      .limit(1);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    if (team.ownerUid !== uid) return res.status(403).json({ error: 'Not your franchise.' });

    const currentPlans = team.developmentPlansJson || {};
    const nextPlans = {
      ...currentPlans,
      [String(playerId)]: {
        trajectory: String(trajectory || 'Dynamic'),
        focusAttribute: String(focusAttribute || 'Overall Balance'),
        weeklyIntensity: (['Light', 'Standard', 'Intensive'].includes(weeklyIntensity)
          ? weeklyIntensity
          : 'Standard') as 'Light' | 'Standard' | 'Intensive',
        updatedAt: new Date().toISOString(),
      },
    };

    const [updatedTeam] = await db
      .update(teams)
      .set({ developmentPlansJson: nextPlans })
      .where(eq(teams.id, teamId))
      .returning();

    const state = await buildLeagueState(leagueId, uid);
    wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });
    res.json({ team: updatedTeam });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save development plan' });
  }
});

apiRouter.put('/leagues/:leagueId/teams/:teamId/tactics', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const teamId = Number(req.params.teamId);
    const uid = req.user!.uid;
    const { t20Tempo, odiTempo, testTempo, aimRpo, powerplayAggression, deathPlan } = req.body;

    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
      .limit(1);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    if (team.ownerUid !== uid) return res.status(403).json({ error: 'Not your franchise.' });

    const nextTactics = {
      t20Tempo: t20Tempo || 'Aggressive',
      odiTempo: odiTempo || 'Balanced',
      testTempo: testTempo || 'Measured',
      aimRpo: Math.max(4, Math.min(14, Number(aimRpo) || 9.2)),
      powerplayAggression: powerplayAggression || 'High',
      deathPlan: deathPlan || 'Yorker Focus',
    };

    const [updatedTeam] = await db
      .update(teams)
      .set({ tacticsJson: nextTactics })
      .where(eq(teams.id, teamId))
      .returning();

    const state = await buildLeagueState(leagueId, uid);
    wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });
    res.json({ team: updatedTeam });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save tactics' });
  }
});

// Toggle Scouted/Bookmarked Auction Target Players
apiRouter.post(
  '/leagues/:leagueId/teams/:teamId/bookmarks/toggle',
  async (req: AuthRequest, res) => {
    try {
      const leagueId = Number(req.params.leagueId);
      const teamId = Number(req.params.teamId);
      const playerId = Number(req.body.playerId);
      const uid = req.user!.uid;

      if (!playerId) {
        return res.status(400).json({ error: 'Valid playerId is required.' });
      }

      const [team] = await db
        .select()
        .from(teams)
        .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
        .limit(1);

      if (!team) return res.status(404).json({ error: 'Team not found.' });
      if (team.ownerUid !== uid) {
        return res.status(403).json({ error: 'Only the franchise manager can bookmark targets.' });
      }

      const [player] = await db
        .select({ id: players.id, name: players.name })
        .from(players)
        .where(and(eq(players.id, playerId), eq(players.leagueId, leagueId)))
        .limit(1);
      if (!player) return res.status(404).json({ error: 'Player not found in league.' });

      const current = Array.isArray(team.bookmarkedPlayerIdsJson)
        ? team.bookmarkedPlayerIdsJson
        : [];
      const exists = current.includes(playerId);
      const nextBookmarks = exists
        ? current.filter((id) => id !== playerId)
        : [...current, playerId];

      const [updatedTeam] = await db
        .update(teams)
        .set({ bookmarkedPlayerIdsJson: nextBookmarks })
        .where(eq(teams.id, teamId))
        .returning();

      const state = await buildLeagueState(leagueId, uid);
      wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });
      res.json({
        team: updatedTeam,
        bookmarked: !exists,
        bookmarkedPlayerIds: nextBookmarks,
        playerName: player.name,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update bookmark' });
    }
  }
);

// Matchday Preview & Simulation Endpoints
async function resolveTeamMatchXI(
  leagueId: number,
  team: typeof teams.$inferSelect,
  format: string,
  allLeaguePlayers: (typeof players.$inferSelect)[],
  overrideIds?: number[]
) {
  const contractedRows = await db
    .select({ player: players })
    .from(playerContracts)
    .innerJoin(players, eq(playerContracts.playerId, players.id))
    .where(and(eq(playerContracts.teamId, team.id), eq(playerContracts.leagueId, leagueId)));

  const contractedPlayers = contractedRows.map((r) => r.player);
  const [savedLineup] = await db
    .select()
    .from(lineups)
    .where(and(eq(lineups.teamId, team.id), eq(lineups.format, format)))
    .limit(1);

  const preferredIds =
    Array.isArray(overrideIds) && overrideIds.length === 11
      ? overrideIds
      : savedLineup?.battingOrderJson || [];

  if (contractedPlayers.length >= 11) {
    const xi = buildBalancedXI(contractedPlayers, preferredIds);
    return {
      source: 'contracted' as const,
      xi,
      squadAll: contractedPlayers,
    };
  }

  // Fallback exhibition XI derived deterministically from real club/league pool if auction incomplete
  const clubPool = selectExhibitionClubPool(allLeaguePlayers, team);
  const combinedPool = [...contractedPlayers];
  for (const p of clubPool) {
    if (!combinedPool.some((c) => c.id === p.id)) combinedPool.push(p);
  }
  const xi = buildBalancedXI(combinedPool, preferredIds);
  return {
    source: 'club_exhibition' as const,
    xi,
    squadAll: combinedPool,
  };
}

apiRouter.get('/leagues/:leagueId/matches/preview', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const homeTeamId = Number(req.query.homeTeamId);
    const awayTeamId = Number(req.query.awayTeamId);
    const requestedFormat = String(req.query.format || '');

    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
      return res.status(400).json({ error: 'Select two distinct clubs for match preview.' });
    }

    const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
    const homeTeam = leagueTeams.find((t) => t.id === homeTeamId);
    const awayTeam = leagueTeams.find((t) => t.id === awayTeamId);
    if (!league || !homeTeam || !awayTeam) {
      return res.status(404).json({ error: 'Match clubs not found in league.' });
    }

    const allowedFormats =
      homeTeam.leagueCategory === 'International'
        ? ['T20', 'ODI', 'Test']
        : homeTeam.leagueCategory === 'The Hundred'
          ? ['Hundred']
          : ['T20'];
    const format = (allowedFormats.includes(requestedFormat)
      ? requestedFormat
      : allowedFormats[0]) as 'T20' | 'ODI' | 'Test' | 'Hundred';

    const allLeaguePlayers = await db
      .select()
      .from(players)
      .where(eq(players.leagueId, leagueId));

    const homeResolved = await resolveTeamMatchXI(leagueId, homeTeam, format, allLeaguePlayers);
    const awayResolved = await resolveTeamMatchXI(leagueId, awayTeam, format, allLeaguePlayers);

    const homeRatings = computeTeamRatings(homeResolved.xi);
    const awayRatings = computeTeamRatings(awayResolved.xi);
    const winChance = computeWinChance(homeRatings, awayRatings, format);

    const pastMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.leagueId, leagueId),
          or(
            and(eq(matches.homeTeamId, homeTeamId), eq(matches.awayTeamId, awayTeamId)),
            and(eq(matches.homeTeamId, awayTeamId), eq(matches.awayTeamId, homeTeamId))
          )
        )
      )
      .orderBy(desc(matches.createdAt))
      .limit(10);

    let homeWins = 0;
    let awayWins = 0;
    let ties = 0;
    for (const m of pastMatches) {
      if (m.winnerTeamId === homeTeamId) homeWins++;
      else if (m.winnerTeamId === awayTeamId) awayWins++;
      else ties++;
    }

    const pitchCondition = pickPitchCondition(homeTeam.id * 13 + awayTeam.id * 7);
    const competitionLabel =
      homeTeam.leagueCategory === 'IPL'
        ? 'Indian Premier League'
        : homeTeam.leagueCategory === 'PSL'
          ? 'Pakistan Super League'
          : homeTeam.leagueCategory === 'SA20'
            ? 'SA20'
            : homeTeam.leagueCategory === 'BBL'
              ? 'Big Bash League'
              : homeTeam.leagueCategory === 'The Hundred'
                ? 'The Hundred'
                : 'International Series';

    res.json({
      format,
      competitionLabel,
      venue: homeTeam.homeGround,
      pitchCondition,
      homeTeam,
      awayTeam,
      homeSquadSource: homeResolved.source,
      awaySquadSource: awayResolved.source,
      homeXI: homeResolved.xi,
      awayXI: awayResolved.xi,
      homeSquadAll: homeResolved.squadAll,
      homeRatings,
      awayRatings,
      winChance,
      headToHead: {
        played: pastMatches.length,
        homeWins,
        awayWins,
        ties,
        recent: pastMatches,
      },
    });
  } catch (error: any) {
    console.error('Match preview error:', error);
    res.status(500).json({ error: error.message || 'Failed to build match preview' });
  }
});

apiRouter.post('/leagues/:leagueId/matches/play', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const {
      homeTeamId,
      awayTeamId,
      fixtureId,
      format: requestedFormat,
      homeLineupIds,
      userCall = 'heads',
      userDecisionIfWon = 'bat',
      completedSummary,
    } = req.body;

    const hId = Number(homeTeamId);
    const aId = Number(awayTeamId);
    if (!hId || !aId || hId === aId) {
      return res.status(400).json({ error: 'Choose two distinct clubs to play a match.' });
    }

    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
    const homeTeam = leagueTeams.find((t) => t.id === hId);
    const awayTeam = leagueTeams.find((t) => t.id === aId);
    if (!homeTeam || !awayTeam) {
      return res.status(404).json({ error: 'Teams not found in league.' });
    }
    if (homeTeam.ownerUid && homeTeam.ownerUid !== uid) {
      return res.status(403).json({ error: 'You can only initiate matches for your own club.' });
    }
    if (homeTeam.ownerUid && awayTeam.ownerUid) {
      return res.status(403).json({
        error:
          'Matches against another human manager cannot be simulated solo. Enter the Live PvP Fixture Room together from your schedule.',
      });
    }

    const allowedFormats =
      homeTeam.leagueCategory === 'International'
        ? ['T20', 'ODI', 'Test']
        : homeTeam.leagueCategory === 'The Hundred'
          ? ['Hundred']
          : ['T20'];
    const format = (allowedFormats.includes(requestedFormat)
      ? requestedFormat
      : allowedFormats[0]) as 'T20' | 'ODI' | 'Test' | 'Hundred';

    const allLeaguePlayers = await db
      .select()
      .from(players)
      .where(eq(players.leagueId, leagueId));

    const cleanHomeIds = Array.isArray(homeLineupIds) ? homeLineupIds.map(Number) : undefined;
    const homeResolved = await resolveTeamMatchXI(
      leagueId,
      homeTeam,
      format,
      allLeaguePlayers,
      cleanHomeIds
    );
    const awayResolved = await resolveTeamMatchXI(leagueId, awayTeam, format, allLeaguePlayers);

    const pitchCondition =
      completedSummary?.pitchCondition ||
      pickPitchCondition(homeTeam.id * 13 + awayTeam.id * 7 + Date.now());
    const competitionLabel =
      homeTeam.leagueCategory === 'IPL'
        ? 'Indian Premier League'
        : homeTeam.leagueCategory === 'PSL'
          ? 'Pakistan Super League'
          : homeTeam.leagueCategory === 'SA20'
            ? 'SA20'
            : homeTeam.leagueCategory === 'BBL'
              ? 'Big Bash League'
              : homeTeam.leagueCategory === 'The Hundred'
                ? 'The Hundred'
                : 'International Series';

    const cleanCall: 'heads' | 'tails' = userCall === 'tails' ? 'tails' : 'heads';
    const cleanDecision: 'bat' | 'bowl' = userDecisionIfWon === 'bowl' ? 'bowl' : 'bat';

    const summary =
      completedSummary &&
      typeof completedSummary === 'object' &&
      completedSummary.innings1 &&
      completedSummary.innings2 &&
      typeof completedSummary.marginText === 'string'
        ? completedSummary
        : simulateCricketMatch({
            homeTeam,
            awayTeam,
            homeXI: homeResolved.xi,
            awayXI: awayResolved.xi,
            format,
            pitchCondition,
            userCall: cleanCall,
            userDecisionIfWon: cleanDecision,
          });

    const [savedMatch] = await db
      .insert(matches)
      .values({
        leagueId,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        format,
        competitionLabel,
        venue: homeTeam.homeGround,
        pitchCondition,
        status: 'completed',
        homeLineupIdsJson: homeResolved.xi.map((p) => p.id),
        awayLineupIdsJson: awayResolved.xi.map((p) => p.id),
        tossWinnerTeamId: summary.tossWinnerTeamId,
        tossDecision: summary.tossDecision,
        winnerTeamId: summary.winnerTeamId,
        marginText: summary.marginText,
        resultSummaryJson: summary,
        createdByUid: uid,
      })
      .returning();

    const fId = Number(fixtureId);
    if (Number.isFinite(fId) && fId > 0) {
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
        .where(and(eq(fixtures.id, fId), eq(fixtures.leagueId, leagueId)));
      await maybeAdvancePlayoffs(leagueId);
    }

    await db.insert(leagueMessages).values({
      leagueId,
      userUid: uid,
      teamShortCode: 'MCH',
      body: `${homeTeam.shortCode} vs ${awayTeam.shortCode} (${format === 'Hundred' ? '100-Ball' : format}): ${summary.marginText}! (${summary.innings1.teamShortCode} ${summary.innings1.runs}/${summary.innings1.wickets} vs ${summary.innings2.teamShortCode} ${summary.innings2.runs}/${summary.innings2.wickets})`,
      messageType: 'system',
    });

    const inn1 = summary.innings1;
    const inn2 = summary.innings2;
    const pitchShort = pitchCondition.split('·')[0].trim();
    const turningPointLine =
      summary.turningPoints && summary.turningPoints.length > 0
        ? summary.turningPoints[0]
        : `${summary.manOfTheMatch} delivered the decisive performance across key overs`;

    const editorialMatchBody = [
      `${homeTeam.name} (${homeTeam.shortCode}) vs ${awayTeam.name} (${awayTeam.shortCode}) — ${competitionLabel} at ${homeTeam.homeGround}: ${summary.marginText}. On a ${pitchShort.toLowerCase()} surface, ${inn1.teamShortCode} compiled ${inn1.runs}/${inn1.wickets} (${inn1.overs} ov) before ${inn2.teamShortCode} replied with ${inn2.runs}/${inn2.wickets} (${inn2.overs} ov).`,
      `Key Scorecard Highlights: ${inn1.teamShortCode} built around ${inn1.topScorer} against ${inn1.topBowler}, while the reply featured ${inn2.topScorer} confronting ${inn2.topBowler}.`,
      `Turning Point & Press Status: ${turningPointLine}. ${summary.manOfTheMatch} earned Player of the Match honors. Post-match media correspondents are compiling press briefing questions in the Gazette now.`,
    ].join('\n\n');

    const [notif] = await db
      .insert(notifications)
      .values({
        leagueId,
        category: homeTeam.ownerUid || awayTeam.ownerUid ? 'Match Result' : 'League Result',
        title: `${homeTeam.shortCode} vs ${awayTeam.shortCode} · ${summary.marginText}`,
        body: editorialMatchBody,
      })
      .returning();

    await applyPostMatchProgression({
      leagueId,
      matchId: savedMatch.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeXIIds: homeResolved.xi.map((p) => p.id),
      awayXIIds: awayResolved.xi.map((p) => p.id),
      summary,
    });

    // Generate press conference asynchronously so match finish returns immediately
    scheduleBackgroundPressConference(leagueId, savedMatch.id);

    wsHub.broadcastToLeague(leagueId, 'match:completed', {
      match: savedMatch,
      fixtureId: Number.isFinite(fId) && fId > 0 ? fId : undefined,
      headline: `${homeTeam.shortCode} vs ${awayTeam.shortCode} · ${summary.marginText}`,
    });
    if (notif) wsHub.broadcastToLeague(leagueId, 'notification:new', notif);

    res.status(201).json({ match: savedMatch });
  } catch (error: any) {
    console.error('Play match error:', error);
    res.status(500).json({ error: error.message || 'Failed to simulate match' });
  }
});

// 5B. Real-Time PvP Fixture Room Endpoints
apiRouter.post('/leagues/:leagueId/fixtures/:fixtureId/enter', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const fixtureId = Number(req.params.fixtureId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const [fx] = await db
      .select()
      .from(fixtures)
      .where(and(eq(fixtures.id, fixtureId), eq(fixtures.leagueId, leagueId)))
      .limit(1);
    if (!fx) return res.status(404).json({ error: 'Fixture not found.' });

    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
    const homeTeam = leagueTeams.find((t) => t.id === fx.homeTeamId);
    const awayTeam = leagueTeams.find((t) => t.id === fx.awayTeamId);
    if (!homeTeam || !awayTeam) return res.status(404).json({ error: 'Clubs not found.' });

    if (homeTeam.ownerUid !== uid && awayTeam.ownerUid !== uid) {
      return res.status(403).json({ error: 'Only participating managers can enter this PvP match room.' });
    }

    let nextFx = fx;
    if (fx.status === 'scheduled') {
      const [updated] = await db
        .update(fixtures)
        .set({ status: 'lobby', updatedAt: new Date() })
        .where(eq(fixtures.id, fx.id))
        .returning();
      nextFx = updated;
      wsHub.broadcastToLeague(leagueId, 'fixture:pvp_update', { fixture: updated });
    }

    res.json({ fixture: nextFx });
  } catch (error: any) {
    console.error('Enter PvP fixture error:', error);
    res.status(500).json({ error: error.message || 'Failed to enter PvP match room' });
  }
});

apiRouter.post('/leagues/:leagueId/fixtures/:fixtureId/ready', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const fixtureId = Number(req.params.fixtureId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const [fx] = await db
      .select()
      .from(fixtures)
      .where(and(eq(fixtures.id, fixtureId), eq(fixtures.leagueId, leagueId)))
      .limit(1);
    if (!fx) return res.status(404).json({ error: 'Fixture not found.' });
    if (fx.status === 'completed' || fx.status === 'live') {
      return res.json({ fixture: fx });
    }

    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
    const homeTeam = leagueTeams.find((t) => t.id === fx.homeTeamId);
    const awayTeam = leagueTeams.find((t) => t.id === fx.awayTeamId);
    if (!homeTeam || !awayTeam) return res.status(404).json({ error: 'Clubs not found.' });

    const isHome = homeTeam.ownerUid === uid;
    const isAway = awayTeam.ownerUid === uid;
    if (!isHome && !isAway) {
      return res.status(403).json({ error: 'You do not control either club in this fixture.' });
    }

    const ready = req.body.ready !== undefined ? Boolean(req.body.ready) : true;
    const lineupIds = Array.isArray(req.body.lineupIds) ? req.body.lineupIds.map(Number) : undefined;

    const patch: Record<string, any> = {
      status: fx.status === 'scheduled' ? 'lobby' : fx.status,
      updatedAt: new Date(),
    };
    if (isHome) {
      patch.homeReady = ready;
      if (lineupIds && lineupIds.length === 11) patch.homeLineupIdsJson = lineupIds;
    } else {
      patch.awayReady = ready;
      if (lineupIds && lineupIds.length === 11) patch.awayLineupIdsJson = lineupIds;
    }

    const [updated] = await db
      .update(fixtures)
      .set(patch)
      .where(eq(fixtures.id, fx.id))
      .returning();

    // If BOTH managers are ready, automatically run the toss and launch real-time ball-by-ball PvP simulation
    if (updated.homeReady && updated.awayReady) {
      const started = await startPvpMatchLiveState(updated);
      return res.json({ fixture: started || updated });
    }

    wsHub.broadcastToLeague(leagueId, 'fixture:pvp_update', { fixture: updated });
    res.json({ fixture: updated });
  } catch (error: any) {
    console.error('PvP ready error:', error);
    res.status(500).json({ error: error.message || 'Failed to update ready state' });
  }
});

apiRouter.post('/leagues/:leagueId/fixtures/:fixtureId/tactics', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const fixtureId = Number(req.params.fixtureId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const validStrats = ['Defensive', 'Normal', 'Aggressive', 'Ultra-Attacking'];
    const strategy = validStrats.includes(req.body.strategy) ? req.body.strategy : 'Normal';

    const [fx] = await db
      .select()
      .from(fixtures)
      .where(and(eq(fixtures.id, fixtureId), eq(fixtures.leagueId, leagueId)))
      .limit(1);
    if (!fx) return res.status(404).json({ error: 'Fixture not found.' });

    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
    const homeTeam = leagueTeams.find((t) => t.id === fx.homeTeamId);
    const awayTeam = leagueTeams.find((t) => t.id === fx.awayTeamId);
    const isHome = homeTeam?.ownerUid === uid;
    const isAway = awayTeam?.ownerUid === uid;
    if (!isHome && !isAway) {
      return res.status(403).json({ error: 'Only participating managers can set match tactics.' });
    }

    const patch: Record<string, any> = { updatedAt: new Date() };
    if (isHome) patch.homeStrategy = strategy;
    else patch.awayStrategy = strategy;

    const [updated] = await db
      .update(fixtures)
      .set(patch)
      .where(eq(fixtures.id, fx.id))
      .returning();

    wsHub.broadcastToLeague(leagueId, 'fixture:pvp_update', { fixture: updated });
    res.json({ fixture: updated });
  } catch (error: any) {
    console.error('PvP tactics error:', error);
    res.status(500).json({ error: error.message || 'Failed to update strategy' });
  }
});

apiRouter.post('/leagues/:leagueId/fixtures/:fixtureId/pace', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const fixtureId = Number(req.params.fixtureId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const [fx] = await db
      .select()
      .from(fixtures)
      .where(and(eq(fixtures.id, fixtureId), eq(fixtures.leagueId, leagueId)))
      .limit(1);
    if (!fx) return res.status(404).json({ error: 'Fixture not found.' });

    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
    const homeTeam = leagueTeams.find((t) => t.id === fx.homeTeamId);
    const awayTeam = leagueTeams.find((t) => t.id === fx.awayTeamId);
    if (homeTeam?.ownerUid !== uid && awayTeam?.ownerUid !== uid) {
      return res.status(403).json({ error: 'Only participating managers can control match pace.' });
    }

    const patch: Record<string, any> = { updatedAt: new Date() };
    if (['slow', 'medium', 'quick'].includes(req.body.simPace)) {
      patch.simPace = req.body.simPace;
    }
    if (typeof req.body.paused === 'boolean' && (fx.status === 'live' || fx.status === 'paused')) {
      patch.status = req.body.paused ? 'paused' : 'live';
    }

    const [updated] = await db
      .update(fixtures)
      .set(patch)
      .where(eq(fixtures.id, fx.id))
      .returning();

    wsHub.broadcastToLeague(leagueId, 'fixture:pvp_update', { fixture: updated });
    res.json({ fixture: updated });
  } catch (error: any) {
    console.error('PvP pace error:', error);
    res.status(500).json({ error: error.message || 'Failed to update match pace' });
  }
});

// 5C. Multiplayer Vote-Skip Inactive/Overdue Human Fixture Using Saved Lineups & Tactics
apiRouter.post('/leagues/:leagueId/fixtures/:fixtureId/vote-skip', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const fixtureId = Number(req.params.fixtureId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const [fx] = await db
      .select()
      .from(fixtures)
      .where(and(eq(fixtures.id, fixtureId), eq(fixtures.leagueId, leagueId)))
      .limit(1);
    if (!fx) return res.status(404).json({ error: 'Fixture not found.' });
    if (fx.status === 'completed') {
      return res.json({ ok: true, simulated: true, fixture: fx });
    }

    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
    const homeTeam = leagueTeams.find((t) => t.id === fx.homeTeamId);
    const awayTeam = leagueTeams.find((t) => t.id === fx.awayTeamId);
    if (!homeTeam || !awayTeam) return res.status(404).json({ error: 'Clubs not found.' });
    if (!homeTeam.ownerUid && !awayTeam.ownerUid) {
      return res.status(400).json({ error: 'AI vs AI fixtures auto-resolve automatically.' });
    }

    const allMembers = await db
      .select({ userUid: leagueMembers.userUid })
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, leagueId));
    const validUids = new Set(allMembers.map((m) => m.userUid));
    // Require strict majority of active managers for 3+ manager leagues; allow 1 active vote in 1-2 player leagues so an offline friend never deadlocks the calendar
    const threshold = validUids.size <= 2 ? 1 : Math.floor(validUids.size / 2) + 1;

    const [profile] = await db
      .select({ managerName: managerProfiles.managerName })
      .from(managerProfiles)
      .where(eq(managerProfiles.userUid, uid))
      .limit(1);
    const myTeam = leagueTeams.find((t) => t.ownerUid === uid);
    const managerName = profile?.managerName || 'Manager';

    const existingVotes = Array.isArray(fx.skipVotesJson)
      ? fx.skipVotesJson.filter((v) => validUids.has(v.uid))
      : [];
    const alreadyVoted = existingVotes.some((v) => v.uid === uid);
    const agree = req.body?.agree !== undefined ? Boolean(req.body.agree) : !alreadyVoted;

    const nextVotes = agree
      ? [
          ...existingVotes.filter((v) => v.uid !== uid),
          {
            uid,
            managerName,
            teamShortCode: myTeam?.shortCode || undefined,
            votedAt: new Date().toISOString(),
          },
        ]
      : existingVotes.filter((v) => v.uid !== uid);

    const [updatedFx] = await db
      .update(fixtures)
      .set({
        skipVotesJson: nextVotes,
        updatedAt: new Date(),
      })
      .where(eq(fixtures.id, fx.id))
      .returning();

    if (nextVotes.length >= threshold) {
      const simRes = await simulateScheduledFixtureWithSavedTactics(updatedFx || fx, uid);
      const [completedFx] = await db
        .select()
        .from(fixtures)
        .where(eq(fixtures.id, fx.id))
        .limit(1);

      const [sysMsg] = await db
        .insert(leagueMessages)
        .values({
          leagueId,
          userUid: uid,
          teamShortCode: 'MCH',
          body: `Vote-Sim Passed (${nextVotes.length}/${threshold}): Match #${fx.matchNumber} (${homeTeam.shortCode} vs ${awayTeam.shortCode}) resolved via saved XIs & tactics — ${simRes?.summary.marginText || 'Completed'}.`,
          messageType: 'system',
        })
        .returning();

      const state = await buildLeagueState(leagueId, uid);
      wsHub.broadcastToLeague(leagueId, 'fixture:pvp_update', { fixture: completedFx || updatedFx });
      wsHub.broadcastToLeague(leagueId, 'league:updated', {
        teams: state?.teams,
        standings: state?.standings,
        fixtures: state?.fixtures,
      });
      if (sysMsg) wsHub.broadcastToLeague(leagueId, 'chat:message', sysMsg);

      return res.json({
        ok: true,
        simulated: true,
        votes: nextVotes,
        threshold,
        fixture: completedFx || updatedFx,
        match: simRes?.savedMatch || null,
      });
    }

    const [voteMsg] = await db
      .insert(leagueMessages)
      .values({
        leagueId,
        userUid: uid,
        teamShortCode: myTeam?.shortCode || 'MCH',
        body: agree
          ? `${managerName} voted to sim overdue Match #${fx.matchNumber} (${homeTeam.shortCode} vs ${awayTeam.shortCode}) (${nextVotes.length}/${threshold}).`
          : `${managerName} withdrew vote to sim Match #${fx.matchNumber} (${nextVotes.length}/${threshold}).`,
        messageType: 'system',
      })
      .returning();

    wsHub.broadcastToLeague(leagueId, 'fixture:pvp_update', { fixture: updatedFx });
    if (voteMsg) wsHub.broadcastToLeague(leagueId, 'chat:message', voteMsg);

    res.json({
      ok: true,
      simulated: false,
      votes: nextVotes,
      threshold,
      fixture: updatedFx,
    });
  } catch (error: any) {
    console.error('Fixture vote-skip error:', error);
    res.status(500).json({ error: error.message || 'Failed to record vote-skip' });
  }
});

// 6. Live Auction Endpoints
apiRouter.patch('/leagues/:leagueId/auction/settings', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member || member.role !== 'host') {
      return res.status(403).json({ error: 'Only the league host can modify auction rules.' });
    }

    const {
      startingBudget,
      maxSquadSize,
      maxOverseas,
      defaultBasePrice,
      bidIncrement,
      auctionDurationSec,
      autoAdvance,
    } = req.body;

    await db.transaction(async (tx) => {
      const [auction] = await tx
        .select()
        .from(auctions)
        .where(eq(auctions.leagueId, leagueId))
        .limit(1);

      if (!auction) throw new Error('Auction not initialized.');

      const updateFields: Record<string, any> = {};
      if (maxSquadSize !== undefined) {
        updateFields.maxSquadSize = Math.max(22, Math.min(30, Number(maxSquadSize)));
        updateFields.minSquadSize = 22;
      }
      if (maxOverseas !== undefined)
        updateFields.maxOverseas = Math.max(0, Math.min(11, Number(maxOverseas)));
      if (defaultBasePrice !== undefined)
        updateFields.defaultBasePrice = Math.max(10, Math.min(500, Number(defaultBasePrice)));
      if (bidIncrement !== undefined)
        updateFields.bidIncrement = Math.max(5, Math.min(200, Number(bidIncrement)));
      if (auctionDurationSec !== undefined)
        updateFields.auctionDurationSec = Math.max(8, Math.min(60, Number(auctionDurationSec)));

      if (startingBudget !== undefined && auction.status === 'lobby') {
        const cleanBudget = Math.max(2000, Math.min(25000, Number(startingBudget)));
        updateFields.startingBudget = cleanBudget;
        await tx
          .update(teams)
          .set({ startingBudget: cleanBudget, remainingBudget: cleanBudget })
          .where(eq(teams.leagueId, leagueId));
      }

      if (Object.keys(updateFields).length > 0) {
        await tx.update(leagues).set(updateFields).where(eq(leagues.id, leagueId));
      }

      if (autoAdvance !== undefined) {
        await tx
          .update(auctions)
          .set({ autoAdvance: Boolean(autoAdvance) })
          .where(eq(auctions.id, auction.id));
      }
    });

    const state = await buildLeagueState(leagueId, uid);
    wsHub.broadcastToLeague(leagueId, 'league:updated', {
      league: state?.league,
      teams: state?.teams,
    });
    wsHub.broadcastToLeague(leagueId, 'auction:state', state?.auctionSnapshot);

    res.json({ league: state?.league, auctionSnapshot: state?.auctionSnapshot });
  } catch (error: any) {
    console.error('Update auction settings error:', error);
    res.status(400).json({ error: error.message || 'Failed to update auction settings' });
  }
});

apiRouter.post('/leagues/:leagueId/auction/start', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member || member.role !== 'host') {
      return res.status(403).json({ error: 'Only the league host can start the auction.' });
    }

    await db.transaction(async (tx) => {
      const [league] = await tx.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
      const [auction] = await tx
        .select()
        .from(auctions)
        .where(eq(auctions.leagueId, leagueId))
        .limit(1);
      if (!league || !auction) throw new Error('Auction not found.');

      const claimedTeams = await tx
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.leagueId, leagueId), sql`owner_uid IS NOT NULL`));
      if (claimedTeams.length === 0) {
        throw new Error('At least one manager must claim a franchise before starting the auction.');
      }

      // Fresh chance-based shuffle inside Marquee Sets before drawing Lot #1
      const pendingLotsWithPlayers = await tx
        .select({
          lot: auctionPlayers,
          player: players,
        })
        .from(auctionPlayers)
        .innerJoin(players, eq(auctionPlayers.playerId, players.id))
        .where(and(eq(auctionPlayers.auctionId, auction.id), eq(auctionPlayers.status, 'pending')));

      if (pendingLotsWithPlayers.length === 0) {
        throw new Error('No pending players remain in the auction pool.');
      }

      const shuffledPlayers = shuffleAuctionPoolByMarqueeSet(
        pendingLotsWithPlayers.map((row) => row.player)
      );
      const lotIdByPlayerId = new Map(
        pendingLotsWithPlayers.map((row) => [row.player.id, row.lot.id])
      );

      for (let i = 0; i < shuffledPlayers.length; i++) {
        const lid = lotIdByPlayerId.get(shuffledPlayers[i].id);
        if (!lid) continue;
        await tx
          .update(auctionPlayers)
          .set({ lotOrder: i + 1 })
          .where(eq(auctionPlayers.id, lid));
      }

      const firstPlayer = shuffledPlayers[0];
      const firstLotId = lotIdByPlayerId.get(firstPlayer.id)!;

      const now = new Date();
      const endsAt = new Date(now.getTime() + league.auctionDurationSec * 1000);

      await tx
        .update(auctionPlayers)
        .set({ status: 'active', updatedAt: now })
        .where(eq(auctionPlayers.id, firstLotId));

      await tx
        .update(auctions)
        .set({
          status: 'live',
          currentLotId: firstLotId,
          currentBid: 0,
          highestBidderTeamId: null,
          highestBidderUid: null,
          lotEndsAt: endsAt,
          remainingSecondsOnPause: null,
          currentSetName: firstPlayer.marqueeSet || 'Marquee Stars',
          pauseRequestsJson: [],
          autoSimVotesJson: [],
          skipVotesJson: [],
          updatedAt: now,
        })
        .where(eq(auctions.id, auction.id));

      await tx.update(leagues).set({ status: 'auction' }).where(eq(leagues.id, leagueId));

      await tx.insert(leagueMessages).values({
        leagueId,
        userUid: uid,
        teamShortCode: 'AUC',
        body: `Live Player Auction started! Set #1: ${firstPlayer.marqueeSet || 'Marquee Stars'} — Unclaimed clubs will compete automatically alongside human managers.`,
        messageType: 'system',
      });
    });

    const snapshot = await getAuctionSnapshot(leagueId);
    wsHub.broadcastToLeague(leagueId, 'auction:state', snapshot);
    res.json({ auctionSnapshot: snapshot });
  } catch (error: any) {
    console.error('Start auction error:', error);
    res.status(400).json({ error: error.message || 'Failed to start auction' });
  }
});

apiRouter.post('/leagues/:leagueId/auction/pause', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this league.' });
    }

    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.leagueId, leagueId))
      .limit(1);

    if (!auction || auction.status !== 'live') {
      return res.status(400).json({ error: 'Auction is not currently live.' });
    }

    const [profile] = await db
      .select({ managerName: managerProfiles.managerName })
      .from(managerProfiles)
      .where(eq(managerProfiles.userUid, uid))
      .limit(1);
    const [team] = await db
      .select({ shortCode: teams.shortCode })
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), eq(teams.ownerUid, uid)))
      .limit(1);

    const pauserLabel = team?.shortCode
      ? `${profile?.managerName || 'Manager'} (${team.shortCode})`
      : profile?.managerName || 'Manager';

    const now = Date.now();
    const remaining = auction.lotEndsAt
      ? Math.max(5, Math.ceil((new Date(auction.lotEndsAt).getTime() - now) / 1000))
      : 15;

    await db
      .update(auctions)
      .set({
        status: 'paused',
        remainingSecondsOnPause: remaining,
        lotEndsAt: null,
        pauseRequestsJson: [],
        pausedByUid: uid,
        pausedByName: pauserLabel,
        updatedAt: new Date(),
      })
      .where(eq(auctions.id, auction.id));

    await db.insert(leagueMessages).values({
      leagueId,
      userUid: uid,
      teamShortCode: team?.shortCode || 'AUC',
      body: `Auction paused by ${pauserLabel}. Bidding is frozen until someone resumes.`,
      messageType: 'system',
    });

    const snapshot = await getAuctionSnapshot(leagueId);
    wsHub.broadcastToLeague(leagueId, 'auction:paused', { pausedByName: pauserLabel, pausedByUid: uid });
    wsHub.broadcastToLeague(leagueId, 'auction:state', snapshot);
    res.json({ auctionSnapshot: snapshot });
  } catch (error: any) {
    console.error('Pause auction error:', error);
    res.status(500).json({ error: error.message || 'Failed to pause auction' });
  }
});

apiRouter.post('/leagues/:leagueId/auction/resume', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this league.' });
    }

    const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.leagueId, leagueId))
      .limit(1);

    if (!league || !auction || auction.status !== 'paused') {
      return res.status(400).json({ error: 'Auction is not paused.' });
    }

    const [profile] = await db
      .select({ managerName: managerProfiles.managerName })
      .from(managerProfiles)
      .where(eq(managerProfiles.userUid, uid))
      .limit(1);
    const [team] = await db
      .select({ shortCode: teams.shortCode })
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), eq(teams.ownerUid, uid)))
      .limit(1);
    const resumerLabel = team?.shortCode
      ? `${profile?.managerName || 'Manager'} (${team.shortCode})`
      : profile?.managerName || 'Manager';

    const secs = auction.remainingSecondsOnPause || league.auctionDurationSec;
    const endsAt = new Date(Date.now() + secs * 1000);

    await db
      .update(auctions)
      .set({
        status: 'live',
        lotEndsAt: endsAt,
        remainingSecondsOnPause: null,
        pauseRequestsJson: [],
        pausedByUid: null,
        pausedByName: null,
        updatedAt: new Date(),
      })
      .where(eq(auctions.id, auction.id));

    await db.insert(leagueMessages).values({
      leagueId,
      userUid: uid,
      teamShortCode: team?.shortCode || 'AUC',
      body: `Auction resumed by ${resumerLabel}.`,
      messageType: 'system',
    });

    const snapshot = await getAuctionSnapshot(leagueId);
    wsHub.broadcastToLeague(leagueId, 'auction:resumed', { resumedByName: resumerLabel });
    wsHub.broadcastToLeague(leagueId, 'auction:state', snapshot);
    res.json({ auctionSnapshot: snapshot });
  } catch (error: any) {
    console.error('Resume auction error:', error);
    res.status(500).json({ error: error.message || 'Failed to resume auction' });
  }
});

apiRouter.post('/leagues/:leagueId/auction/request-pause', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.leagueId, leagueId))
      .limit(1);

    if (!auction || auction.status !== 'live') {
      return res.status(400).json({ error: 'Pause requests can only be sent while auction is live.' });
    }

    const [profile] = await db
      .select({ managerName: managerProfiles.managerName })
      .from(managerProfiles)
      .where(eq(managerProfiles.userUid, uid))
      .limit(1);
    const [team] = await db
      .select({ shortCode: teams.shortCode })
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), eq(teams.ownerUid, uid)))
      .limit(1);

    const existingReqs = Array.isArray(auction.pauseRequestsJson) ? auction.pauseRequestsJson : [];
    const managerName = profile?.managerName || 'League Manager';
    const nextEntry = {
      uid,
      managerName,
      teamShortCode: team?.shortCode || undefined,
      requestedAt: new Date().toISOString(),
    };
    const deduped = [...existingReqs.filter((r) => r.uid !== uid), nextEntry];

    await db
      .update(auctions)
      .set({
        pauseRequestsJson: deduped,
        updatedAt: new Date(),
      })
      .where(eq(auctions.id, auction.id));

    await db.insert(leagueMessages).values({
      leagueId,
      userUid: uid,
      teamShortCode: team?.shortCode || 'REQ',
      body: `${managerName}${team?.shortCode ? ` (${team.shortCode})` : ''} requested a tactical pause in the auction.`,
      messageType: 'system',
    });

    const snapshot = await getAuctionSnapshot(leagueId);
    wsHub.broadcastToLeague(leagueId, 'auction:pause_requested', nextEntry);
    wsHub.broadcastToLeague(leagueId, 'auction:state', snapshot);
    res.json({ ok: true, auctionSnapshot: snapshot });
  } catch (error: any) {
    console.error('Request auction pause error:', error);
    res.status(500).json({ error: error.message || 'Failed to send pause request' });
  }
});

apiRouter.post('/leagues/:leagueId/auction/dismiss-pause-requests', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member || member.role !== 'host') {
      return res.status(403).json({ error: 'Only the league host can dismiss pause requests.' });
    }

    await db
      .update(auctions)
      .set({ pauseRequestsJson: [], updatedAt: new Date() })
      .where(eq(auctions.leagueId, leagueId));

    const snapshot = await getAuctionSnapshot(leagueId);
    wsHub.broadcastToLeague(leagueId, 'auction:state', snapshot);
    res.json({ ok: true, auctionSnapshot: snapshot });
  } catch (error: any) {
    console.error('Dismiss pause requests error:', error);
    res.status(500).json({ error: error.message || 'Failed to dismiss pause requests' });
  }
});

apiRouter.post('/leagues/:leagueId/auction/next', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member || member.role !== 'host') {
      return res.status(403).json({ error: 'Only the league host can advance the lot.' });
    }

    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.leagueId, leagueId))
      .limit(1);

    if (!auction) return res.status(404).json({ error: 'Auction not found.' });

    if (auction.currentLotId && auction.status === 'live') {
      await settleLotAtomic(auction.id, true);
    }

    const [fresh] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.leagueId, leagueId))
      .limit(1);

    if (fresh && !fresh.currentLotId && fresh.status !== 'completed') {
      const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
      const [nextLot] = await db
        .select()
        .from(auctionPlayers)
        .where(and(eq(auctionPlayers.auctionId, fresh.id), eq(auctionPlayers.status, 'pending')))
        .orderBy(asc(auctionPlayers.lotOrder))
        .limit(1);

      if (nextLot && league) {
        const [nextPlayer] = await db
          .select({ marqueeSet: players.marqueeSet })
          .from(players)
          .where(eq(players.id, nextLot.playerId))
          .limit(1);
        const now = new Date();
        await db
          .update(auctionPlayers)
          .set({ status: 'active', updatedAt: now })
          .where(eq(auctionPlayers.id, nextLot.id));
        await db
          .update(auctions)
          .set({
            status: 'live',
            currentLotId: nextLot.id,
            currentBid: 0,
            highestBidderTeamId: null,
            highestBidderUid: null,
            lotEndsAt: new Date(now.getTime() + league.auctionDurationSec * 1000),
            currentSetName: nextPlayer?.marqueeSet || 'Marquee Stars',
            skipVotesJson: [],
            updatedAt: now,
          })
          .where(eq(auctions.id, fresh.id));
      } else {
        if (league) {
          await db.transaction(async (tx) => {
            await enforceMinimumSquadCompletion(tx, league, fresh.id, new Date());
            await tx
              .update(auctions)
              .set({
                status: 'completed',
                currentSetName: 'Completed',
                autoSimVotesJson: [],
                skipVotesJson: [],
                updatedAt: new Date(),
              })
              .where(eq(auctions.id, fresh.id));
            await tx.update(leagues).set({ status: 'active' }).where(eq(leagues.id, leagueId));
          });
        } else {
          await db
            .update(auctions)
            .set({
              status: 'completed',
              currentSetName: 'Completed',
              autoSimVotesJson: [],
              skipVotesJson: [],
              updatedAt: new Date(),
            })
            .where(eq(auctions.id, fresh.id));
          await db.update(leagues).set({ status: 'active' }).where(eq(leagues.id, leagueId));
        }
      }
    }

    const snapshot = await getAuctionSnapshot(leagueId);
    const state = await buildLeagueState(leagueId, uid);
    wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });
    wsHub.broadcastToLeague(leagueId, 'auction:state', snapshot);
    res.json({ auctionSnapshot: snapshot });
  } catch (error: any) {
    console.error('Next lot error:', error);
    res.status(500).json({ error: error.message || 'Failed to advance lot' });
  }
});

apiRouter.post('/leagues/:leagueId/auction/relist-unsold', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member || member.role !== 'host') {
      return res.status(403).json({ error: 'Only the league host can re-list unsold players.' });
    }

    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.leagueId, leagueId))
      .limit(1);
    if (!auction) return res.status(404).json({ error: 'Auction not found.' });

    const unsoldRows = await db
      .select({ lot: auctionPlayers, player: players })
      .from(auctionPlayers)
      .innerJoin(players, eq(auctionPlayers.playerId, players.id))
      .where(and(eq(auctionPlayers.auctionId, auction.id), eq(auctionPlayers.status, 'unsold')));

    if (unsoldRows.length > 0) {
      const shuffled = shuffleAuctionPoolByMarqueeSet(unsoldRows.map((u) => u.player));
      const lotByPlayerId = new Map(unsoldRows.map((u) => [u.player.id, u.lot.id]));
      const maxOrderRes = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${auctionPlayers.lotOrder}), 0)` })
        .from(auctionPlayers)
        .where(eq(auctionPlayers.auctionId, auction.id));
      const startOrder = Number(maxOrderRes[0]?.maxOrder || 0);

      for (let i = 0; i < shuffled.length; i++) {
        const lid = lotByPlayerId.get(shuffled[i].id);
        if (!lid) continue;
        await db
          .update(auctionPlayers)
          .set({ status: 'pending', lotOrder: startOrder + i + 1, updatedAt: new Date() })
          .where(eq(auctionPlayers.id, lid));
      }
    }

    if (auction.status === 'completed' && unsoldRows.length > 0) {
      await db
        .update(auctions)
        .set({ status: 'paused', acceleratedRound: true, updatedAt: new Date() })
        .where(eq(auctions.id, auction.id));
    }

    const snapshot = await getAuctionSnapshot(leagueId);
    wsHub.broadcastToLeague(leagueId, 'auction:state', snapshot);
    res.json({ relistedCount: unsoldRows.length, auctionSnapshot: snapshot });
  } catch (error: any) {
    console.error('Relist unsold error:', error);
    res.status(500).json({ error: error.message || 'Failed to re-list unsold players' });
  }
});

apiRouter.post('/leagues/:leagueId/auction/auto-sim/vote', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this league.' });
    }

    const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.leagueId, leagueId))
      .limit(1);
    if (!league || !auction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }
    if (auction.status === 'completed') {
      return res.status(400).json({ error: 'Auction is already completed.' });
    }

    const claimedTeams = await db
      .select({ id: teams.id, ownerUid: teams.ownerUid, shortCode: teams.shortCode })
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), sql`owner_uid IS NOT NULL`));

    if (claimedTeams.length === 0) {
      return res
        .status(400)
        .json({ error: 'At least one manager must claim a franchise before auto-simulating.' });
    }

    const allMembers = await db
      .select({ userUid: leagueMembers.userUid })
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, leagueId));

    const requiredUids = Array.from(new Set(allMembers.map((m) => m.userUid)));
    const requiredSet = new Set(requiredUids);

    const [profile] = await db
      .select({ managerName: managerProfiles.managerName })
      .from(managerProfiles)
      .where(eq(managerProfiles.userUid, uid))
      .limit(1);
    const myTeam = claimedTeams.find((t) => t.ownerUid === uid);
    const managerName = profile?.managerName || 'Manager';

    const existingVotes = Array.isArray(auction.autoSimVotesJson)
      ? auction.autoSimVotesJson.filter((v) => requiredSet.has(v.uid))
      : [];
    const alreadyVoted = existingVotes.some((v) => v.uid === uid);
    const wantAgree =
      req.body?.agree !== undefined ? Boolean(req.body.agree) : !alreadyVoted;

    const nextVotes = wantAgree
      ? [
          ...existingVotes.filter((v) => v.uid !== uid),
          {
            uid,
            managerName,
            teamShortCode: myTeam?.shortCode || undefined,
            votedAt: new Date().toISOString(),
          },
        ]
      : existingVotes.filter((v) => v.uid !== uid);

    await db
      .update(auctions)
      .set({
        autoSimVotesJson: nextVotes,
        updatedAt: new Date(),
      })
      .where(eq(auctions.id, auction.id));

    const allAgreed =
      requiredUids.length > 0 &&
      requiredUids.every((reqUid) => nextVotes.some((v) => v.uid === reqUid));

    if (allAgreed) {
      const snapshot = await autoSimulateFullAuction(leagueId);
      return res.json({
        ok: true,
        triggered: true,
        agreedCount: requiredUids.length,
        requiredCount: requiredUids.length,
        auctionSnapshot: snapshot,
      });
    }

    const [voteMsg] = await db
      .insert(leagueMessages)
      .values({
        leagueId,
        userUid: uid,
        teamShortCode: myTeam?.shortCode || 'AUC',
        body: wantAgree
          ? `${managerName}${myTeam?.shortCode ? ` (${myTeam.shortCode})` : ''} agreed to Auto-Simulate the auction (${nextVotes.length}/${requiredUids.length} managers).`
          : `${managerName}${myTeam?.shortCode ? ` (${myTeam.shortCode})` : ''} withdrew Auto-Simulate agreement (${nextVotes.length}/${requiredUids.length}).`,
        messageType: 'system',
      })
      .returning();

    const snapshot = await getAuctionSnapshot(leagueId);
    wsHub.broadcastToLeague(leagueId, 'auction:auto_sim_vote', {
      votes: nextVotes,
      agreedCount: nextVotes.length,
      requiredCount: requiredUids.length,
      managerName,
      agree: wantAgree,
    });
    wsHub.broadcastToLeague(leagueId, 'auction:state', snapshot);
    if (voteMsg) {
      wsHub.broadcastToLeague(leagueId, 'chat:message', voteMsg);
    }

    res.json({
      ok: true,
      triggered: false,
      agreedCount: nextVotes.length,
      requiredCount: requiredUids.length,
      auctionSnapshot: snapshot,
    });
  } catch (error: any) {
    console.error('Auto-sim vote error:', error);
    res.status(500).json({ error: error.message || 'Failed to record auto-sim agreement' });
  }
});

apiRouter.post('/leagues/:leagueId/auction/skip-vote', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this league.' });
    }

    const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.leagueId, leagueId))
      .limit(1);

    if (!league || !auction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }
    if ((auction.status !== 'live' && auction.status !== 'paused') || !auction.currentLotId) {
      return res.status(400).json({ error: 'No active auction player to skip right now.' });
    }

    const [lot] = await db
      .select({ playerId: auctionPlayers.playerId })
      .from(auctionPlayers)
      .where(eq(auctionPlayers.id, auction.currentLotId))
      .limit(1);
    const [lotPlayer] = lot
      ? await db.select({ name: players.name }).from(players).where(eq(players.id, lot.playerId)).limit(1)
      : [null];

    const allMembers = await db
      .select({ userUid: leagueMembers.userUid })
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, leagueId));
    const requiredUids = Array.from(new Set(allMembers.map((m) => m.userUid)));
    const requiredSet = new Set(requiredUids);

    const [profile] = await db
      .select({ managerName: managerProfiles.managerName })
      .from(managerProfiles)
      .where(eq(managerProfiles.userUid, uid))
      .limit(1);
    const [myTeam] = await db
      .select({ shortCode: teams.shortCode })
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), eq(teams.ownerUid, uid)))
      .limit(1);
    const managerName = profile?.managerName || 'Manager';

    const existingVotes = Array.isArray(auction.skipVotesJson)
      ? auction.skipVotesJson.filter((v) => requiredSet.has(v.uid))
      : [];
    const alreadyVoted = existingVotes.some((v) => v.uid === uid);
    const wantAgree = req.body?.agree !== undefined ? Boolean(req.body.agree) : !alreadyVoted;

    const nextVotes = wantAgree
      ? [
          ...existingVotes.filter((v) => v.uid !== uid),
          {
            uid,
            managerName,
            teamShortCode: myTeam?.shortCode || undefined,
            votedAt: new Date().toISOString(),
          },
        ]
      : existingVotes.filter((v) => v.uid !== uid);

    await db
      .update(auctions)
      .set({
        skipVotesJson: nextVotes,
        updatedAt: new Date(),
      })
      .where(eq(auctions.id, auction.id));

    const allAgreed =
      requiredUids.length > 0 &&
      requiredUids.every((reqUid) => nextVotes.some((v) => v.uid === reqUid));

    if (allAgreed) {
      const skipRes = await resolveSkippedLotWithValuation(auction.id);
      const resolutionSummary =
        skipRes && skipRes.outcome === 'sold' && skipRes.winningTeamShortCode && skipRes.soldPrice !== null
          ? `assigned to ${skipRes.winningTeamShortCode} at ${formatLakhsServer(skipRes.soldPrice)}`
          : 'passed as Unsold';
      const [skipPassedMsg] = await db
        .insert(leagueMessages)
        .values({
          leagueId,
          userUid: uid,
          teamShortCode: 'AUC',
          body: `Skip Vote Passed (${requiredUids.length}/${requiredUids.length}): ${lotPlayer?.name || 'Current player'} ${resolutionSummary}. Moving to next lot.`,
          messageType: 'system',
        })
        .returning();

      const snapshot = await getAuctionSnapshot(leagueId);
      const state = await buildLeagueState(leagueId, uid);
      wsHub.broadcastToLeague(leagueId, 'league:updated', { teams: state?.teams });
      wsHub.broadcastToLeague(leagueId, 'auction:state', snapshot);
      if (skipPassedMsg) {
        wsHub.broadcastToLeague(leagueId, 'chat:message', skipPassedMsg);
      }
      if (skipRes?.completionSystemMessage) {
        wsHub.broadcastToLeague(leagueId, 'chat:message', skipRes.completionSystemMessage);
      }
      if (skipRes?.notifications?.length) {
        for (const n of skipRes.notifications) {
          wsHub.broadcastToLeague(leagueId, 'notification:new', n);
        }
      }

      return res.json({
        ok: true,
        skipped: true,
        resolution: skipRes,
        agreedCount: requiredUids.length,
        requiredCount: requiredUids.length,
        auctionSnapshot: snapshot,
      });
    }

    const [voteMsg] = await db
      .insert(leagueMessages)
      .values({
        leagueId,
        userUid: uid,
        teamShortCode: myTeam?.shortCode || 'AUC',
        body: wantAgree
          ? `${managerName}${myTeam?.shortCode ? ` (${myTeam.shortCode})` : ''} voted to Skip ${lotPlayer?.name || 'current lot'} (${nextVotes.length}/${requiredUids.length}).`
          : `${managerName}${myTeam?.shortCode ? ` (${myTeam.shortCode})` : ''} withdrew Skip Vote (${nextVotes.length}/${requiredUids.length}).`,
        messageType: 'system',
      })
      .returning();

    const snapshot = await getAuctionSnapshot(leagueId);
    wsHub.broadcastToLeague(leagueId, 'auction:skip_vote', {
      votes: nextVotes,
      agreedCount: nextVotes.length,
      requiredCount: requiredUids.length,
      managerName,
      playerName: lotPlayer?.name || 'Current player',
      agree: wantAgree,
    });
    wsHub.broadcastToLeague(leagueId, 'auction:state', snapshot);
    if (voteMsg) {
      wsHub.broadcastToLeague(leagueId, 'chat:message', voteMsg);
    }

    res.json({
      ok: true,
      skipped: false,
      agreedCount: nextVotes.length,
      requiredCount: requiredUids.length,
      auctionSnapshot: snapshot,
    });
  } catch (error: any) {
    console.error('Skip vote error:', error);
    res.status(500).json({ error: error.message || 'Failed to record skip vote' });
  }
});

apiRouter.post('/leagues/:leagueId/auction/bid', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const requestedAmount = req.body.amount !== undefined ? Number(req.body.amount) : undefined;
    const expectedLotId = req.body.lotId !== undefined ? Number(req.body.lotId) : undefined;

    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const bidResult = await db.transaction(async (tx) => {
      const [league] = await tx.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
      if (!league) throw new Error('NOT_FOUND:League not found.');

      // Lock auction row first
      const lockedAuctionRes = await tx.execute(
        sql`SELECT * FROM auctions WHERE league_id = ${leagueId} FOR UPDATE`
      );
      const auctionRow = lockedAuctionRes.rows[0] as
        | {
            id: number;
            status: string;
            current_lot_id: number | null;
            current_bid: number;
            highest_bidder_team_id: number | null;
            lot_ends_at: Date | null;
          }
        | undefined;

      if (!auctionRow || auctionRow.status !== 'live' || !auctionRow.current_lot_id) {
        throw new Error('CONFLICT:Auction is not currently accepting live bids.');
      }

      if (expectedLotId && auctionRow.current_lot_id !== expectedLotId) {
        throw new Error('CONFLICT:This lot has already closed.');
      }

      const now = new Date();
      if (auctionRow.lot_ends_at && new Date(auctionRow.lot_ends_at) <= now) {
        throw new Error('CONFLICT:Timer expired for this lot.');
      }

      // Lock bidder's team row
      const lockedTeamRes = await tx.execute(
        sql`SELECT * FROM teams WHERE league_id = ${leagueId} AND owner_uid = ${uid} FOR UPDATE`
      );
      const bidderTeam = lockedTeamRes.rows[0] as
        | {
            id: number;
            name: string;
            short_code: string;
            primary_color: string;
            remaining_budget: number;
          }
        | undefined;

      if (!bidderTeam) {
        throw new Error('FORBIDDEN:You must claim a franchise before placing bids.');
      }

      if (auctionRow.highest_bidder_team_id === bidderTeam.id) {
        throw new Error('CONFLICT:Your franchise already holds the highest bid.');
      }

      const [lot] = await tx
        .select()
        .from(auctionPlayers)
        .where(eq(auctionPlayers.id, auctionRow.current_lot_id))
        .limit(1);

      if (!lot || lot.status !== 'active') {
        throw new Error('CONFLICT:Lot is no longer active.');
      }

      const [player] = await tx
        .select()
        .from(players)
        .where(eq(players.id, lot.playerId))
        .limit(1);
      if (!player) throw new Error('NOT_FOUND:Player not found.');

      const minRequiredBid =
        auctionRow.current_bid === 0
          ? lot.basePrice
          : auctionRow.current_bid + league.bidIncrement;

      const finalBid =
        requestedAmount !== undefined ? Math.round(requestedAmount) : minRequiredBid;

      if (!Number.isFinite(finalBid) || finalBid < minRequiredBid) {
        throw new Error(`INVALID:Minimum valid bid is ${formatLakhsServer(minRequiredBid)}.`);
      }

      if (bidderTeam.remaining_budget < finalBid) {
        throw new Error(
          `INVALID:Insufficient purse. Remaining budget is ${formatLakhsServer(bidderTeam.remaining_budget)}.`
        );
      }

      // Check squad size & overseas limits
      const teamContracts = await tx
        .select({
          isOverseas: players.isOverseas,
        })
        .from(playerContracts)
        .innerJoin(players, eq(playerContracts.playerId, players.id))
        .where(eq(playerContracts.teamId, bidderTeam.id));

      if (teamContracts.length >= league.maxSquadSize) {
        throw new Error(`INVALID:Squad is full (${league.maxSquadSize}/${league.maxSquadSize}).`);
      }

      if (player.isOverseas) {
        const overseasCount = teamContracts.filter((c) => c.isOverseas).length;
        if (overseasCount >= league.maxOverseas) {
          throw new Error(
            `INVALID:Overseas slot cap reached (${league.maxOverseas}/${league.maxOverseas}).`
          );
        }
      }

      // Anti-snipe extension: ensure at least 8 seconds remain after valid bid
      const minEnd = new Date(now.getTime() + 8000);
      const nextEndsAt =
        !auctionRow.lot_ends_at || new Date(auctionRow.lot_ends_at) < minEnd
          ? minEnd
          : new Date(auctionRow.lot_ends_at);

      await tx.insert(bids).values({
        auctionId: auctionRow.id,
        auctionPlayerId: lot.id,
        leagueId,
        teamId: bidderTeam.id,
        userUid: uid,
        amount: finalBid,
      });

      await tx
        .update(auctions)
        .set({
          currentBid: finalBid,
          highestBidderTeamId: bidderTeam.id,
          highestBidderUid: uid,
          lotEndsAt: nextEndsAt,
          skipVotesJson: [],
          updatedAt: now,
        })
        .where(eq(auctions.id, auctionRow.id));

      return {
        amount: finalBid,
        teamName: bidderTeam.name,
        teamShortCode: bidderTeam.short_code,
      };
    });

    const snapshot = await getAuctionSnapshot(leagueId);
    wsHub.broadcastToLeague(leagueId, 'auction:bid', {
      bid: bidResult,
      snapshot,
    });

    res.json({ ok: true, bid: bidResult, auctionSnapshot: snapshot });
  } catch (error: any) {
    const msg = error.message || 'Bid rejected';
    if (msg.startsWith('NOT_FOUND:')) return res.status(404).json({ error: msg.slice(10) });
    if (msg.startsWith('FORBIDDEN:')) return res.status(403).json({ error: msg.slice(10) });
    if (msg.startsWith('CONFLICT:')) return res.status(409).json({ error: msg.slice(9) });
    if (msg.startsWith('INVALID:')) return res.status(400).json({ error: msg.slice(8) });
    console.error('Place bid error:', error);
    res.status(500).json({ error: 'Failed to submit bid' });
  }
});

apiRouter.get('/leagues/:leagueId/auction/lots', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.leagueId, leagueId))
      .limit(1);
    if (!auction) return res.status(404).json({ error: 'Auction not found.' });

    const allLots = await db
      .select({
        lot: auctionPlayers,
        player: players,
        winningTeamName: teams.name,
        winningTeamShortCode: teams.shortCode,
        winningTeamColor: teams.primaryColor,
      })
      .from(auctionPlayers)
      .innerJoin(players, eq(auctionPlayers.playerId, players.id))
      .leftJoin(teams, eq(auctionPlayers.winningTeamId, teams.id))
      .where(eq(auctionPlayers.auctionId, auction.id))
      .orderBy(asc(auctionPlayers.lotOrder));

    // Hide upcoming pending queue sequence — only reveal sold, unsold, and active lots!
    const revealedLots = allLots.filter((row) => row.lot.status !== 'pending');

    // Aggregate marquee set progress without leaking player order
    const setBuckets = new Map<
      string,
      { setName: string; pendingCount: number; activeCount: number; soldCount: number; unsoldCount: number }
    >();
    for (const setName of MARQUEE_SET_ORDER) {
      setBuckets.set(setName, {
        setName,
        pendingCount: 0,
        activeCount: 0,
        soldCount: 0,
        unsoldCount: 0,
      });
    }
    for (const row of allLots) {
      const sName = row.player.marqueeSet || 'Marquee Stars';
      if (!setBuckets.has(sName)) {
        setBuckets.set(sName, {
          setName: sName,
          pendingCount: 0,
          activeCount: 0,
          soldCount: 0,
          unsoldCount: 0,
        });
      }
      const b = setBuckets.get(sName)!;
      if (row.lot.status === 'pending') b.pendingCount++;
      else if (row.lot.status === 'active') b.activeCount++;
      else if (row.lot.status === 'sold') b.soldCount++;
      else if (row.lot.status === 'unsold') b.unsoldCount++;
    }

    const [myTeam] = await db
      .select({ bookmarkedPlayerIdsJson: teams.bookmarkedPlayerIdsJson })
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), eq(teams.ownerUid, uid)))
      .limit(1);

    const bookmarkedIds = new Set(myTeam?.bookmarkedPlayerIdsJson || []);
    const bookmarkedStatuses = allLots
      .filter((row) => bookmarkedIds.has(row.player.id))
      .map((row) => ({
        playerId: row.player.id,
        name: row.player.name,
        country: row.player.country,
        primaryRole: row.player.primaryRole,
        marqueeSet: row.player.marqueeSet,
        battingRating: row.player.battingRating,
        bowlingRating: row.player.bowlingRating,
        currentForm: row.player.currentForm,
        formDelta: row.player.formDelta,
        basePrice: row.lot.basePrice,
        status: row.lot.status,
        soldPrice: row.lot.soldPrice,
        winningTeamShortCode: row.winningTeamShortCode,
      }));

    res.json({
      lots: revealedLots,
      setSummary: Array.from(setBuckets.values()).filter(
        (s) => s.pendingCount + s.activeCount + s.soldCount + s.unsoldCount > 0
      ),
      bookmarkedStatuses,
    });
  } catch (error: any) {
    console.error('Get auction lots error:', error);
    res.status(500).json({ error: error.message || 'Failed to load auction lots' });
  }
});

// 7. Chat & Notifications
apiRouter.post('/leagues/:leagueId/chat', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const body = String(req.body.body || '').trim();
    if (!body || body.length > 500) {
      return res.status(400).json({ error: 'Message must be between 1 and 500 characters.' });
    }

    const [profile] = await db
      .select()
      .from(managerProfiles)
      .where(eq(managerProfiles.userUid, uid))
      .limit(1);

    const [team] = await db
      .select({ shortCode: teams.shortCode })
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), eq(teams.ownerUid, uid)))
      .limit(1);

    const [saved] = await db
      .insert(leagueMessages)
      .values({
        leagueId,
        userUid: uid,
        teamShortCode: team?.shortCode ?? null,
        body,
        messageType: 'chat',
      })
      .returning();

    const enrichedMessage = {
      ...saved,
      managerName: profile?.managerName || 'Manager',
      avatarUrl: profile?.avatarUrl || 'crest:emerald',
    };

    wsHub.broadcastToLeague(leagueId, 'chat:message', enrichedMessage);
    res.status(201).json({ message: enrichedMessage });
  } catch (error: any) {
    console.error('Chat send error:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

apiRouter.post('/leagues/:leagueId/notifications/read', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const notificationId = req.body?.notificationId ? Number(req.body.notificationId) : null;
    const rows = notificationId
      ? await db
          .select()
          .from(notifications)
          .where(and(eq(notifications.leagueId, leagueId), eq(notifications.id, notificationId)))
      : await db
          .select()
          .from(notifications)
          .where(eq(notifications.leagueId, leagueId));

    for (const row of rows) {
      const list = row.readByUidsJson || [];
      if (!list.includes(uid)) {
        await db
          .update(notifications)
          .set({ readByUidsJson: [...list, uid] })
          .where(eq(notifications.id, row.id));
      }
    }

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Mark notifications read error:', error);
    res.status(500).json({ error: error.message || 'Failed to update notifications' });
  }
});

// 7B. High-Performance Training Ground, Press Conferences, Gazette & Transfer Market
const TRAINING_TRAIT_BY_DRILL: Record<string, string[]> = {
  relay_catching: ['Electric Fielder', 'Clutch Anchor'],
  yorker_lab: ['Death Specialist', 'Powerplay Enforcer'],
  pull_reaction: ['Finisher', 'Powerplay Blaster'],
  spin_control: ['Spin Maestro', 'Partnership Breaker'],
};

const ALL_BROADCAST_TRAITS = [
  'Finisher',
  'Death Specialist',
  'Electric Fielder',
  'Partnership Breaker',
  'Powerplay Enforcer',
  'Clutch Anchor',
  'Spin Maestro',
  'Powerplay Blaster',
];

apiRouter.post('/leagues/:leagueId/training/complete', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const playerId = Number(req.body.playerId);
    const drillType = String(req.body.drillType || '');
    const score = Number(req.body.score || 0);
    const success = Boolean(req.body.success);

    if (!playerId || !TRAINING_TRAIT_BY_DRILL[drillType]) {
      return res.status(400).json({ error: 'Valid playerId and drillType are required.' });
    }

    const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), eq(teams.ownerUid, uid)))
      .limit(1);

    if (!league || !team) {
      return res.status(404).json({ error: 'Claim a franchise before scheduling training.' });
    }

    const calendar = computeLeagueCalendar(league);
    const usedToday =
      team.trainingSlotsUsedDay === calendar.currentGameDay ? team.trainingSlotsUsedCount : 0;

    if (usedToday >= 2) {
      return res.status(400).json({
        error: `Daily limit reached: You have used all 2 training slots for Game Day ${calendar.currentGameDay}.`,
      });
    }

    const DRILL_COST_LAKHS = 20;
    if (team.remainingBudget < DRILL_COST_LAKHS) {
      return res.status(400).json({ error: 'Insufficient franchise purse (₹20L required per drill).' });
    }

    const [contract] = await db
      .select()
      .from(playerContracts)
      .where(
        and(
          eq(playerContracts.leagueId, leagueId),
          eq(playerContracts.teamId, team.id),
          eq(playerContracts.playerId, playerId)
        )
      )
      .limit(1);

    if (!contract) {
      return res.status(403).json({ error: 'You can only train players contracted to your franchise.' });
    }

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (!player) return res.status(404).json({ error: 'Player not found.' });
    if ((player.injuryGamesRemaining ?? 0) > 0) {
      return res.status(400).json({ error: `${player.name} is injured and unavailable for training.` });
    }
    if ((player.stamina ?? 100) < 15) {
      return res.status(400).json({ error: `${player.name} is too fatigued (stamina below 15%). Rest them first.` });
    }

    const nextSlotsUsed = usedToday + 1;
    const nextStamina = Math.max(5, (player.stamina ?? 100) - 10);
    const nextDrillsCompleted = (player.drillsCompleted ?? 0) + 1;

    const ageScale = player.age <= 25 ? 2 : player.age <= 31 ? 2 : 1;
    const gain = success ? ageScale : 0;

    let nextBat = player.battingRating;
    let nextBowl = player.bowlingRating;
    let nextField = player.fieldingRating;
    let nextTemp = player.temperament;
    let nextCons = player.consistency;
    const cap = Math.max(85, Math.min(94, player.potential));

    const statChanges: string[] = [];
    if (gain > 0) {
      if (drillType === 'relay_catching') {
        nextField = Math.min(95, nextField + gain);
        nextTemp = Math.min(95, nextTemp + 1);
        statChanges.push(`Fielding +${nextField - player.fieldingRating}`, `Temperament +${nextTemp - player.temperament}`);
      } else if (drillType === 'yorker_lab') {
        nextBowl = Math.min(cap, nextBowl + gain);
        nextCons = Math.min(95, nextCons + 1);
        statChanges.push(`Bowling +${nextBowl - player.bowlingRating}`, `Consistency +${nextCons - player.consistency}`);
      } else if (drillType === 'pull_reaction') {
        nextBat = Math.min(cap, nextBat + gain);
        nextTemp = Math.min(95, nextTemp + 1);
        statChanges.push(`Batting +${nextBat - player.battingRating}`, `Temperament +${nextTemp - player.temperament}`);
      } else if (drillType === 'spin_control') {
        nextBowl = Math.min(cap, nextBowl + gain);
        nextCons = Math.min(95, nextCons + 1);
        statChanges.push(`Bowling +${nextBowl - player.bowlingRating}`, `Consistency +${nextCons - player.consistency}`);
      }
    }

    const existingTraits = Array.isArray(player.traitsJson) ? [...player.traitsJson] : [];
    let unlockedTrait: string | null = null;
    if (success && nextDrillsCompleted % 3 === 0) {
      const preferred = TRAINING_TRAIT_BY_DRILL[drillType] || [];
      unlockedTrait =
        preferred.find((t) => !existingTraits.includes(t)) ||
        ALL_BROADCAST_TRAITS.find((t) => !existingTraits.includes(t)) ||
        null;
      if (unlockedTrait) existingTraits.push(unlockedTrait);
    }

    await db
      .update(teams)
      .set({
        remainingBudget: team.remainingBudget - DRILL_COST_LAKHS,
        trainingSlotsUsedDay: calendar.currentGameDay,
        trainingSlotsUsedCount: nextSlotsUsed,
      })
      .where(eq(teams.id, team.id));

    const [updatedPlayer] = await db
      .update(players)
      .set({
        stamina: nextStamina,
        drillsCompleted: nextDrillsCompleted,
        battingRating: nextBat,
        bowlingRating: nextBowl,
        fieldingRating: nextField,
        temperament: nextTemp,
        consistency: nextCons,
        traitsJson: existingTraits,
      })
      .where(eq(players.id, player.id))
      .returning();

    if (unlockedTrait) {
      const [news] = await db
        .insert(leagueNews)
        .values({
          leagueId,
          category: 'training',
          headline: `TRAINING BREAKTHROUGH: ${player.name} earns '${unlockedTrait}' badge`,
          summary: `After completing drill #${nextDrillsCompleted} at ${team.name}'s high-performance camp (score ${score}), ${player.name} unlocked the ${unlockedTrait} match trait.`,
          teamId: team.id,
          playerId: player.id,
        })
        .returning();
      if (news) wsHub.broadcastToLeague(leagueId, 'gazette:new', news);
    }

    const changeSummary =
      Object.entries(statChanges)
        .filter(([, v]) => Number(v) > 0)
        .map(([k, v]) => `${k} +${v}`)
        .join(', ') || 'sharpness maintained';
    const [trainNotif] = await db
      .insert(notifications)
      .values({
        leagueId,
        targetUid: uid,
        category: 'Training Camp',
        title: `Training Report: ${player.name} (${drillType || 'High-Performance Drill'})`,
        body: `High-Performance Coaching Desk,\n\n${player.name} completed scheduled camp drill #${nextDrillsCompleted} with a session evaluation score of ${score} (${changeSummary}). Stamina stands at ${nextStamina}% ahead of upcoming match selection.\n\n${unlockedTrait ? `Breakthrough Unlock: ${player.name} has permanently earned the '${unlockedTrait}' broadcast trait, boosting situational performance in high-pressure match overs.` : `Coaching staff recommend balancing recovery sessions in Squad before back-to-back fixtures.`}`,
      })
      .returning();
    if (trainNotif) wsHub.broadcastToLeague(leagueId, 'notification:new', trainNotif);

    wsHub.broadcastToLeague(leagueId, 'squad:updated', { teamId: team.id, playerId: player.id });
    wsHub.broadcastToLeague(leagueId, 'training:completed', {
      teamId: team.id,
      playerId: player.id,
      unlockedTrait,
    });

    res.json({
      player: updatedPlayer,
      remainingBudget: team.remainingBudget - DRILL_COST_LAKHS,
      slotsRemaining: Math.max(0, 2 - nextSlotsUsed),
      statChanges,
      unlockedTrait,
    });
  } catch (error: any) {
    console.error('Complete training error:', error);
    res.status(500).json({ error: error.message || 'Failed to complete training session' });
  }
});

apiRouter.post('/leagues/:leagueId/matches/:matchId/press-conference', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const matchId = Number(req.params.matchId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const [matchRow] = await db
      .select()
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.leagueId, leagueId)))
      .limit(1);

    if (!matchRow || !matchRow.resultSummaryJson) {
      return res.status(404).json({ error: 'Completed match not found.' });
    }

    if (matchRow.pressConferenceJson?.questions?.length) {
      return res.json({
        pressConference: matchRow.pressConferenceJson,
        completed: matchRow.pressConferenceCompleted,
      });
    }

    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
    const myTeam = leagueTeams.find(
      (t) => t.ownerUid === uid && (t.id === matchRow.homeTeamId || t.id === matchRow.awayTeamId)
    );
    const humanTeam = myTeam || leagueTeams.find((t) => t.id === matchRow.homeTeamId)!;
    const oppTeam =
      leagueTeams.find(
        (t) => t.id === (humanTeam.id === matchRow.homeTeamId ? matchRow.awayTeamId : matchRow.homeTeamId)
      ) || leagueTeams[0];

    const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    const [profile] = await db
      .select()
      .from(managerProfiles)
      .where(eq(managerProfiles.userUid, uid))
      .limit(1);

    const questions = await generatePressConferenceQuestions({
      matchId: matchRow.id,
      leagueName: league?.name || 'CM27 League',
      competitionLabel: matchRow.competitionLabel,
      humanTeamId: humanTeam.id,
      humanTeamName: humanTeam.name,
      humanTeamShortCode: humanTeam.shortCode,
      oppTeamName: oppTeam.name,
      oppTeamShortCode: oppTeam.shortCode,
      managerName: profile?.managerName || 'Gaffer',
      summary: matchRow.resultSummaryJson,
    });

    const pcData: PressConferenceData = {
      questions,
      readyAt: new Date().toISOString(),
    };
    await db
      .update(matches)
      .set({ pressConferenceJson: pcData })
      .where(eq(matches.id, matchRow.id));

    res.json({ pressConference: pcData, completed: false });
  } catch (error: any) {
    console.error('Generate press conference error:', error);
    res.status(500).json({ error: error.message || 'Failed to prepare press conference' });
  }
});

apiRouter.post('/leagues/:leagueId/matches/:matchId/press-conference/answer', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const matchId = Number(req.params.matchId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const [matchRow] = await db
      .select()
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.leagueId, leagueId)))
      .limit(1);

    if (!matchRow) return res.status(404).json({ error: 'Match not found.' });
    if (matchRow.pressConferenceCompleted) {
      return res.json({
        pressConference: matchRow.pressConferenceJson,
        impactSummary: matchRow.pressConferenceJson?.overallImpactSummary || 'Already completed.',
      });
    }

    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
    const humanTeam = leagueTeams.find(
      (t) => t.ownerUid === uid && (t.id === matchRow.homeTeamId || t.id === matchRow.awayTeamId)
    );
    if (!humanTeam) {
      return res.status(403).json({ error: 'Only participating club managers can answer this presser.' });
    }
    const oppTeam = leagueTeams.find(
      (t) => t.id === (humanTeam.id === matchRow.homeTeamId ? matchRow.awayTeamId : matchRow.homeTeamId)
    );

    const [profile] = await db
      .select()
      .from(managerProfiles)
      .where(eq(managerProfiles.userUid, uid))
      .limit(1);
    const managerName = profile?.managerName || 'Gaffer';

    const pcData: PressConferenceData = matchRow.pressConferenceJson || { questions: [] };
    let squadMoraleDelta = 0;
    let repDelta = 0;
    let assertiveCount = 0;
    const critTargets: Array<{ id?: number | null; name?: string | null }> = [];
    const quotesForGazette: string[] = [];

    const updatedQuestions = pcData.questions.map((q) => {
      const found = answers.find((a: any) => a.questionId === q.id);
      const stance: 'measured' | 'assertive' | 'critical' =
        found?.stance === 'assertive' || found?.stance === 'critical' ? found.stance : 'measured';

      if (stance === 'measured') {
        squadMoraleDelta += 2;
        repDelta += 1;
      } else if (stance === 'assertive') {
        assertiveCount += 1;
        squadMoraleDelta += 1;
      } else {
        repDelta += 2;
        critTargets.push({ id: q.targetPlayerId, name: q.targetPlayerName });
      }

      const matchedOptionQuote =
        q.options?.find((opt) => opt.stance === stance)?.quote ||
        (typeof found?.quote === 'string' ? found.quote : null);

      const quote = buildPressQuoteText(
        stance,
        managerName,
        humanTeam.shortCode,
        oppTeam?.shortCode || 'OPP',
        q.targetPlayerName,
        matchedOptionQuote
      );
      quotesForGazette.push(quote);

      return { ...q, chosenStance: stance, chosenQuote: quote };
    });

    // Apply squad morale boost
    const contracts = await db
      .select({ player: players })
      .from(playerContracts)
      .innerJoin(players, eq(playerContracts.playerId, players.id))
      .where(and(eq(playerContracts.leagueId, leagueId), eq(playerContracts.teamId, humanTeam.id)));

    const critIdSet = new Set(critTargets.map((c) => c.id).filter(Boolean) as number[]);
    for (const c of contracts) {
      const p = c.player;
      const isCrit = critIdSet.has(p.id);
      const nextMorale = isCrit
        ? Math.max(35, p.morale - 8)
        : Math.min(98, p.morale + squadMoraleDelta);
      const nextForm = isCrit ? Math.max(45, p.currentForm - 4) : p.currentForm;
      await db
        .update(players)
        .set({ morale: nextMorale, currentForm: nextForm })
        .where(eq(players.id, p.id));
    }

    await db
      .update(teams)
      .set({
        reputation: Math.min(99, humanTeam.reputation + repDelta),
        pressMoraleBuff: assertiveCount > 0 ? Math.min(6, (humanTeam.pressMoraleBuff || 0) + 3) : humanTeam.pressMoraleBuff,
      })
      .where(eq(teams.id, humanTeam.id));

    // Assertive mind games spark rivalry buff on opposing human-controlled team
    let rivalryTriggered = false;
    if (assertiveCount > 0 && oppTeam && oppTeam.ownerUid) {
      rivalryTriggered = true;
      await db
        .update(teams)
        .set({
          rivalryBuffJson: {
            vsTeamId: humanTeam.id,
            vsTeamShortCode: humanTeam.shortCode,
            aggressionBoost: 2.5,
            moraleBoost: 4,
            sourceNote: `Fired up by ${humanTeam.shortCode} press remarks`,
          },
        })
        .where(eq(teams.id, oppTeam.id));
    }

    const impactParts = [
      squadMoraleDelta > 0 ? `Squad Morale +${squadMoraleDelta}` : null,
      repDelta > 0 ? `Board Reputation +${repDelta}` : null,
      assertiveCount > 0 ? `Next-Match Press Edge Active` : null,
      rivalryTriggered ? `${oppTeam?.shortCode} Rivalry Stoked` : null,
      critTargets.length > 0
        ? `Target Morale -8 (${critTargets.map((c) => c.name || 'Player').join(', ')})`
        : null,
    ].filter(Boolean);
    const overallImpactSummary = impactParts.join(' · ') || 'Press briefing recorded.';

    const finalPc: PressConferenceData = {
      questions: updatedQuestions,
      readyAt: pcData.readyAt,
      completedAt: new Date().toISOString(),
      overallImpactSummary,
    };

    await db
      .update(matches)
      .set({
        pressConferenceCompleted: true,
        pressConferenceJson: finalPc,
      })
      .where(eq(matches.id, matchRow.id));

    const headlinePrefix =
      assertiveCount >= 2
        ? `FIERY PRESSER: ${managerName} throws down gauntlet after ${humanTeam.shortCode} vs ${oppTeam?.shortCode || ''}`
        : critTargets.length > 0
          ? `DRESSING ROOM PRESSURE: ${managerName} demands sharper execution from ${humanTeam.shortCode}`
          : `POST-MATCH BRIEFING: ${managerName} reflects on ${matchRow.marginText}`;

    const [news] = await db
      .insert(leagueNews)
      .values({
        leagueId,
        category: 'press',
        headline: headlinePrefix,
        summary: `${matchRow.competitionLabel} (${matchRow.venue}): ${overallImpactSummary}.`,
        quote: quotesForGazette[quotesForGazette.length - 1] || quotesForGazette[0] || null,
        teamId: humanTeam.id,
        relatedMatchId: matchRow.id,
      })
      .returning();

    const [pressFalloutNotif] = await db
      .insert(notifications)
      .values({
        leagueId,
        targetUid: humanTeam.ownerUid,
        category: 'Press Fallout',
        title: `Media Reaction: ${headlinePrefix}`,
        body: `Communications Desk,\n\nYour post-match remarks following ${matchRow.marginText} at ${matchRow.venue} have hit the back pages across The League Gazette.\n\nHeadline Quote: ${quotesForGazette[0] || quotesForGazette[quotesForGazette.length - 1] || 'Statements logged.'}\n\nDressing Room & Board Assessment: ${overallImpactSummary}.`,
      })
      .returning();
    if (pressFalloutNotif) wsHub.broadcastToLeague(leagueId, 'notification:new', pressFalloutNotif);

    if (rivalryTriggered && oppTeam?.ownerUid) {
      const [banterNotif] = await db
        .insert(notifications)
        .values({
          leagueId,
          targetUid: oppTeam.ownerUid,
          category: 'Rivalry Banter',
          title: `${managerName} (${humanTeam.shortCode}) calls out ${oppTeam.shortCode} in presser`,
          body: `Media Wire Alert,\n\n${humanTeam.name} head coach ${managerName} used post-match media duties to take an assertive swipe at rival dugout ${oppTeam.shortCode}: ${quotesForGazette[quotesForGazette.length - 1] || 'We back ourselves to dominate.'}\n\nYour squad has taken note (+2.5 aggression & +4 morale rivalry buff primed for your next clash against ${humanTeam.shortCode}).`,
        })
        .returning();
      if (banterNotif) wsHub.broadcastToLeague(leagueId, 'notification:new', banterNotif);
    }

    if (news) wsHub.broadcastToLeague(leagueId, 'gazette:new', news);
    wsHub.broadcastToLeague(leagueId, 'squad:updated', { teamId: humanTeam.id });
    wsHub.broadcastToLeague(leagueId, 'press:completed', { matchId: matchRow.id });

    res.json({ pressConference: finalPc, impactSummary: overallImpactSummary, news });
  } catch (error: any) {
    console.error('Answer press conference error:', error);
    res.status(500).json({ error: error.message || 'Failed to save press conference answers' });
  }
});

apiRouter.get('/leagues/:leagueId/gazette', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const rows = await db
      .select()
      .from(leagueNews)
      .where(eq(leagueNews.leagueId, leagueId))
      .orderBy(desc(leagueNews.createdAt))
      .limit(60);

    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
    const teamMap = new Map(leagueTeams.map((t) => [t.id, t]));
    const pids = Array.from(new Set(rows.map((r) => r.playerId).filter(Boolean) as number[]));
    const pRows =
      pids.length > 0 ? await db.select().from(players).where(inArray(players.id, pids)) : [];
    const pMap = new Map(pRows.map((p) => [p.id, p]));

    res.json({
      news: rows.map((r) => ({
        ...r,
        teamName: r.teamId ? teamMap.get(r.teamId)?.name ?? null : null,
        teamShortCode: r.teamId ? teamMap.get(r.teamId)?.shortCode ?? null : null,
        playerName: r.playerId ? pMap.get(r.playerId)?.name ?? null : null,
      })),
    });
  } catch (error: any) {
    console.error('Get gazette error:', error);
    res.status(500).json({ error: error.message || 'Failed to load League Gazette' });
  }
});

apiRouter.get('/leagues/:leagueId/transfers/hub', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const [myTeam] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), eq(teams.ownerUid, uid)))
      .limit(1);

    const allContracts = await db
      .select({ teamId: playerContracts.teamId, player: players, contract: playerContracts })
      .from(playerContracts)
      .innerJoin(players, eq(playerContracts.playerId, players.id))
      .where(eq(playerContracts.leagueId, leagueId));

    const contractedIds = new Set(allContracts.map((c) => c.player.id));
    const allPlayers = await db.select().from(players).where(eq(players.leagueId, leagueId));
    const unsoldPool = allPlayers
      .filter((p) => !contractedIds.has(p.id) && (p.injuryGamesRemaining ?? 0) === 0)
      .sort((a, b) => getPlayerOverallRating(b) - getPlayerOverallRating(a))
      .slice(0, 60);

    const myRoster = myTeam
      ? allContracts.filter((c) => c.teamId === myTeam.id).map((c) => ({ ...c.player, purchasePrice: c.contract.purchasePrice }))
      : [];

    const teamRosters: Record<number, typeof myRoster> = {};
    for (const c of allContracts) {
      if (!teamRosters[c.teamId]) teamRosters[c.teamId] = [];
      teamRosters[c.teamId].push({ ...c.player, purchasePrice: c.contract.purchasePrice });
    }

    const myNeeds = analyzeTeamNeeds(myRoster);

    res.json({
      myNeeds,
      teamRosters,
      unsoldPool,
      transferRequestedPlayers: allContracts
        .filter((c) => c.player.transferRequested)
        .map((c) => ({ ...c.player, teamId: c.teamId })),
    });
  } catch (error: any) {
    console.error('Transfer hub error:', error);
    res.status(500).json({ error: error.message || 'Failed to load transfer hub' });
  }
});

apiRouter.post('/leagues/:leagueId/transfers/generate-ai-offer', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const [myTeam] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), eq(teams.ownerUid, uid)))
      .limit(1);
    if (!myTeam) return res.status(400).json({ error: 'Claim a franchise first.' });

    const offer = await generateSmartAiTradeOffer(leagueId, myTeam.id);
    if (!offer) {
      return res.json({ offer: null, message: 'No matching AI trade enquiries available right now.' });
    }

    wsHub.broadcastToLeague(leagueId, 'trade:updated', { offerId: offer.id });
    res.json({ offer });
  } catch (error: any) {
    console.error('Generate AI trade offer error:', error);
    res.status(500).json({ error: error.message || 'Failed to check AI trade market' });
  }
});

async function executeAtomicTradeSwap(params: {
  leagueId: number;
  proposerTeam: typeof teams.$inferSelect;
  recipientTeam: typeof teams.$inferSelect;
  offeredIds: number[];
  requestedIds: number[];
  cashDeltaLakhs: number; // positive = proposer pays recipient
}) {
  const { leagueId, proposerTeam, recipientTeam, offeredIds, requestedIds, cashDeltaLakhs } = params;

  if (offeredIds.length > 0) {
    await db
      .update(playerContracts)
      .set({ teamId: recipientTeam.id, acquiredVia: 'trade' })
      .where(
        and(
          eq(playerContracts.leagueId, leagueId),
          eq(playerContracts.teamId, proposerTeam.id),
          inArray(playerContracts.playerId, offeredIds)
        )
      );
  }
  if (requestedIds.length > 0) {
    await db
      .update(playerContracts)
      .set({ teamId: proposerTeam.id, acquiredVia: 'trade' })
      .where(
        and(
          eq(playerContracts.leagueId, leagueId),
          eq(playerContracts.teamId, recipientTeam.id),
          inArray(playerContracts.playerId, requestedIds)
        )
      );
  }

  const allMovedIds = [...offeredIds, ...requestedIds];
  if (allMovedIds.length > 0) {
    await db
      .update(players)
      .set({
        transferRequested: false,
        benchedStreak: 0,
        morale: 78,
      })
      .where(and(eq(players.leagueId, leagueId), inArray(players.id, allMovedIds)));
  }

  await db
    .update(teams)
    .set({ remainingBudget: proposerTeam.remainingBudget - cashDeltaLakhs })
    .where(eq(teams.id, proposerTeam.id));
  await db
    .update(teams)
    .set({ remainingBudget: recipientTeam.remainingBudget + cashDeltaLakhs })
    .where(eq(teams.id, recipientTeam.id));
}

apiRouter.post('/leagues/:leagueId/transfers/propose', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const member = await assertLeagueMember(leagueId, uid);
    if (!member) return res.status(403).json({ error: 'Not a member of this league.' });

    const recipientTeamId = Number(req.body.recipientTeamId);
    const offeredPlayerIds: number[] = Array.isArray(req.body.offeredPlayerIds)
      ? Array.from(new Set<number>(req.body.offeredPlayerIds.map(Number).filter(Boolean)))
      : [];
    const requestedPlayerIds: number[] = Array.isArray(req.body.requestedPlayerIds)
      ? Array.from(new Set<number>(req.body.requestedPlayerIds.map(Number).filter(Boolean)))
      : [];
    const cashDeltaLakhs = Math.round(Number(req.body.cashDeltaLakhs || 0));
    const message = String(req.body.message || '').trim().slice(0, 280);

    if (!recipientTeamId || (offeredPlayerIds.length === 0 && requestedPlayerIds.length === 0)) {
      return res.status(400).json({ error: 'Select players to include in the trade package.' });
    }

    const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
    const proposerTeam = leagueTeams.find((t) => t.ownerUid === uid);
    const recipientTeam = leagueTeams.find((t) => t.id === recipientTeamId);

    if (!league || !proposerTeam || !recipientTeam || proposerTeam.id === recipientTeam.id) {
      return res.status(400).json({ error: 'Invalid trade clubs.' });
    }

    if (proposerTeam.remainingBudget - cashDeltaLakhs < 0) {
      return res.status(400).json({ error: 'Your club lacks sufficient remaining purse for this cash offer.' });
    }
    if (recipientTeam.remainingBudget + cashDeltaLakhs < 0) {
      return res.status(400).json({ error: `${recipientTeam.shortCode} lacks purse for that cash request.` });
    }

    const allContracts = await db
      .select({ teamId: playerContracts.teamId, player: players })
      .from(playerContracts)
      .innerJoin(players, eq(playerContracts.playerId, players.id))
      .where(eq(playerContracts.leagueId, leagueId));

    const propRoster = allContracts.filter((c) => c.teamId === proposerTeam.id).map((c) => c.player);
    const recRoster = allContracts.filter((c) => c.teamId === recipientTeam.id).map((c) => c.player);

    const offeredPlayers = offeredPlayerIds
      .map((id) => propRoster.find((p) => p.id === id))
      .filter(Boolean) as Array<typeof players.$inferSelect>;
    const requestedPlayers = requestedPlayerIds
      .map((id) => recRoster.find((p) => p.id === id))
      .filter(Boolean) as Array<typeof players.$inferSelect>;

    if (offeredPlayers.length !== offeredPlayerIds.length || requestedPlayers.length !== requestedPlayerIds.length) {
      return res.status(400).json({ error: 'One or more players no longer belong to those franchises.' });
    }

    const propNewSize = propRoster.length - offeredPlayers.length + requestedPlayers.length;
    const propNewOverseas =
      propRoster.filter((p) => p.isOverseas).length -
      offeredPlayers.filter((p) => p.isOverseas).length +
      requestedPlayers.filter((p) => p.isOverseas).length;

    if (propNewSize > league.maxSquadSize) {
      return res.status(400).json({ error: `Your roster would exceed the ${league.maxSquadSize} squad cap.` });
    }
    if (propNewOverseas > league.maxOverseas) {
      return res.status(400).json({ error: `Deal breaches your ${league.maxOverseas} overseas quota.` });
    }

    // AI franchise evaluates immediately
    if (!recipientTeam.ownerUid) {
      const evalRes = evaluateAiTradeProposal({
        aiTeam: recipientTeam,
        aiPlayers: recRoster,
        offeredToAi: offeredPlayers,
        requestedFromAi: requestedPlayers,
        cashToAiLakhs: cashDeltaLakhs,
        minSquadSize: league.minSquadSize,
        maxSquadSize: league.maxSquadSize,
        maxOverseas: league.maxOverseas,
      });

      const [offer] = await db
        .insert(tradeOffers)
        .values({
          leagueId,
          proposerTeamId: proposerTeam.id,
          recipientTeamId: recipientTeam.id,
          proposerUid: uid,
          recipientUid: null,
          offeredPlayerIdsJson: offeredPlayerIds,
          requestedPlayerIdsJson: requestedPlayerIds,
          cashDeltaLakhs,
          status: evalRes.accepted ? 'accepted' : 'rejected',
          message: message || 'Transfer proposal submitted.',
          aiEvaluationNote: evalRes.reason,
          isAiInitiated: false,
          respondedAt: new Date(),
        })
        .returning();

      if (evalRes.accepted) {
        await executeAtomicTradeSwap({
          leagueId,
          proposerTeam,
          recipientTeam,
          offeredIds: offeredPlayerIds,
          requestedIds: requestedPlayerIds,
          cashDeltaLakhs,
        });

        const [news] = await db
          .insert(leagueNews)
          .values({
            leagueId,
            category: 'trade',
            headline: `DONE DEAL: ${proposerTeam.shortCode} & ${recipientTeam.shortCode} complete trade`,
            summary: `${proposerTeam.shortCode} acquire ${requestedPlayers.map((p) => p.name).join(', ') || 'Purse'} in exchange for ${offeredPlayers.map((p) => p.name).join(', ') || 'Purse'}${cashDeltaLakhs !== 0 ? ` (₹${Math.abs(cashDeltaLakhs)}L cash)` : ''}.`,
            teamId: proposerTeam.id,
          })
          .returning();
        if (news) wsHub.broadcastToLeague(leagueId, 'gazette:new', news);
        wsHub.broadcastToLeague(leagueId, 'squad:updated', { teamId: proposerTeam.id });
      }

      wsHub.broadcastToLeague(leagueId, 'trade:updated', { offerId: offer.id });
      return res.status(201).json({ offer, evaluation: evalRes });
    }

    // Human-to-Human pending trade offer
    const [offer] = await db
      .insert(tradeOffers)
      .values({
        leagueId,
        proposerTeamId: proposerTeam.id,
        recipientTeamId: recipientTeam.id,
        proposerUid: uid,
        recipientUid: recipientTeam.ownerUid,
        offeredPlayerIdsJson: offeredPlayerIds,
        requestedPlayerIdsJson: requestedPlayerIds,
        cashDeltaLakhs,
        status: 'pending',
        message: message || `${proposerTeam.shortCode} proposed a trade package.`,
        isAiInitiated: false,
      })
      .returning();

    const offeredList = offeredPlayers.map((p) => p.name).join(', ') || 'Cash Adjustment';
    const requestedList = requestedPlayers.map((p) => p.name).join(', ') || 'Cash Adjustment';
    const [notif] = await db
      .insert(notifications)
      .values({
        leagueId,
        targetUid: recipientTeam.ownerUid,
        category: 'Transfer Offer',
        title: `Trade Proposal from ${proposerTeam.shortCode}: ${offeredList}`,
        body: `Transfer Wire Dispatch,\n\n${proposerTeam.name} (${proposerTeam.shortCode}) has submitted a formal mid-season trade package offering ${offeredList} in exchange for ${requestedList}${offer.cashDeltaLakhs !== 0 ? ` alongside a ${formatLakhsServer(Math.abs(offer.cashDeltaLakhs))} purse adjustment` : ''}.\n\nManager Note: "${offer.message}"\n\nInspect full player stats and respond inside the Transfers hub before rival bids emerge.`,
      })
      .returning();

    wsHub.broadcastToLeague(leagueId, 'trade:updated', { offerId: offer.id });
    if (notif) wsHub.broadcastToLeague(leagueId, 'notification:new', notif);

    res.status(201).json({ offer });
  } catch (error: any) {
    console.error('Propose trade error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit trade proposal' });
  }
});

apiRouter.post('/leagues/:leagueId/transfers/:offerId/respond', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const offerId = Number(req.params.offerId);
    const uid = req.user!.uid;
    const action = String(req.body.action || 'reject');

    const [offer] = await db
      .select()
      .from(tradeOffers)
      .where(and(eq(tradeOffers.id, offerId), eq(tradeOffers.leagueId, leagueId)))
      .limit(1);

    if (!offer || offer.status !== 'pending') {
      return res.status(404).json({ error: 'Pending trade offer not found.' });
    }

    const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
    const myTeam = leagueTeams.find((t) => t.ownerUid === uid);
    if (!myTeam) return res.status(403).json({ error: 'Franchise required.' });

    if (action === 'cancel') {
      if (offer.proposerTeamId !== myTeam.id) {
        return res.status(403).json({ error: 'Only the proposing club can cancel.' });
      }
      const [updated] = await db
        .update(tradeOffers)
        .set({ status: 'cancelled', respondedAt: new Date() })
        .where(eq(tradeOffers.id, offer.id))
        .returning();
      wsHub.broadcastToLeague(leagueId, 'trade:updated', { offerId: offer.id });
      return res.json({ offer: updated });
    }

    if (offer.recipientTeamId !== myTeam.id) {
      return res.status(403).json({ error: 'Only the receiving manager can accept or decline.' });
    }

    if (action === 'reject') {
      const [updated] = await db
        .update(tradeOffers)
        .set({ status: 'rejected', respondedAt: new Date() })
        .where(eq(tradeOffers.id, offer.id))
        .returning();
      wsHub.broadcastToLeague(leagueId, 'trade:updated', { offerId: offer.id });
      return res.json({ offer: updated });
    }

    const proposerTeam = leagueTeams.find((t) => t.id === offer.proposerTeamId);
    const recipientTeam = leagueTeams.find((t) => t.id === offer.recipientTeamId);
    const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!proposerTeam || !recipientTeam || !league) {
      return res.status(404).json({ error: 'Trade clubs not found.' });
    }

    if (
      proposerTeam.remainingBudget - offer.cashDeltaLakhs < 0 ||
      recipientTeam.remainingBudget + offer.cashDeltaLakhs < 0
    ) {
      return res.status(400).json({ error: 'Franchise purse changed; deal can no longer be funded.' });
    }

    const offeredIds = offer.offeredPlayerIdsJson || [];
    const requestedIds = offer.requestedPlayerIdsJson || [];

    // Verify ownership still holds
    const currentContracts = await db
      .select({ teamId: playerContracts.teamId, player: players })
      .from(playerContracts)
      .innerJoin(players, eq(playerContracts.playerId, players.id))
      .where(eq(playerContracts.leagueId, leagueId));

    const propOwned = new Set(currentContracts.filter((c) => c.teamId === proposerTeam.id).map((c) => c.player.id));
    const recOwned = new Set(currentContracts.filter((c) => c.teamId === recipientTeam.id).map((c) => c.player.id));

    if (!offeredIds.every((id) => propOwned.has(id)) || !requestedIds.every((id) => recOwned.has(id))) {
      await db
        .update(tradeOffers)
        .set({ status: 'cancelled', respondedAt: new Date() })
        .where(eq(tradeOffers.id, offer.id));
      return res.status(409).json({ error: 'Players involved were already moved; offer cancelled.' });
    }

    await executeAtomicTradeSwap({
      leagueId,
      proposerTeam,
      recipientTeam,
      offeredIds,
      requestedIds,
      cashDeltaLakhs: offer.cashDeltaLakhs,
    });

    const [updated] = await db
      .update(tradeOffers)
      .set({ status: 'accepted', respondedAt: new Date() })
      .where(eq(tradeOffers.id, offer.id))
      .returning();

    const movedPlayers = currentContracts
      .filter((c) => offeredIds.includes(c.player.id) || requestedIds.includes(c.player.id))
      .map((c) => c.player);

    const [news] = await db
      .insert(leagueNews)
      .values({
        leagueId,
        category: 'trade',
        headline: `TRADE CONFIRMED: ${proposerTeam.shortCode} & ${recipientTeam.shortCode} complete player exchange`,
        summary: `Deal closed involving ${movedPlayers.map((p) => p.name).join(', ') || 'club assets'}${offer.cashDeltaLakhs !== 0 ? ` with ₹${Math.abs(offer.cashDeltaLakhs)}L cash adjustment` : ''}.`,
        teamId: recipientTeam.id,
      })
      .returning();

    const [tradeNotif] = await db
      .insert(notifications)
      .values({
        leagueId,
        category: 'Transfer Offer',
        title: `Deal Closed: ${proposerTeam.shortCode} & ${recipientTeam.shortCode} Complete Trade`,
        body: `League Transfer Registry,\n\n${proposerTeam.name} and ${recipientTeam.name} have ratified an official player swap involving ${movedPlayers.map((p) => p.name).join(', ') || 'club assets'}${offer.cashDeltaLakhs !== 0 ? ` plus a ${formatLakhsServer(Math.abs(offer.cashDeltaLakhs))} cash settlement` : ''}.\n\nContracts and salary purses have been updated immediately; check Squad -> Lineups to assign the newly acquired players.`,
      })
      .returning();

    if (news) wsHub.broadcastToLeague(leagueId, 'gazette:new', news);
    if (tradeNotif) wsHub.broadcastToLeague(leagueId, 'notification:new', tradeNotif);
    wsHub.broadcastToLeague(leagueId, 'trade:updated', { offerId: offer.id });
    wsHub.broadcastToLeague(leagueId, 'squad:updated', { teamId: recipientTeam.id });

    res.json({ offer: updated });
  } catch (error: any) {
    console.error('Respond trade error:', error);
    res.status(500).json({ error: error.message || 'Failed to respond to trade offer' });
  }
});

apiRouter.post('/leagues/:leagueId/transfers/injury-replacement', async (req: AuthRequest, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    const uid = req.user!.uid;
    const injuredPlayerId = Number(req.body.injuredPlayerId);
    const replacementPlayerId = Number(req.body.replacementPlayerId);

    const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.leagueId, leagueId), eq(teams.ownerUid, uid)))
      .limit(1);
    if (!league || !team) return res.status(404).json({ error: 'Franchise not found.' });

    const teamContracts = await db
      .select({ player: players })
      .from(playerContracts)
      .innerJoin(players, eq(playerContracts.playerId, players.id))
      .where(and(eq(playerContracts.leagueId, leagueId), eq(playerContracts.teamId, team.id)));

    const injured = teamContracts.find(
      (c) => c.player.id === injuredPlayerId && (c.player.injuryGamesRemaining ?? 0) > 0
    );
    if (!injured) {
      return res.status(400).json({ error: 'Select an injured contracted player from your squad.' });
    }

    const [existingReplacementContract] = await db
      .select()
      .from(playerContracts)
      .where(and(eq(playerContracts.leagueId, leagueId), eq(playerContracts.playerId, replacementPlayerId)))
      .limit(1);
    if (existingReplacementContract) {
      return res.status(400).json({ error: 'Replacement player is already contracted to another club.' });
    }

    const [repPlayer] = await db
      .select()
      .from(players)
      .where(and(eq(players.leagueId, leagueId), eq(players.id, replacementPlayerId)))
      .limit(1);
    if (!repPlayer) return res.status(404).json({ error: 'Replacement player not found.' });

    const overseasNow = teamContracts.filter((c) => c.player.isOverseas).length;
    if (repPlayer.isOverseas && overseasNow >= league.maxOverseas) {
      return res.status(400).json({ error: `Overseas limit (${league.maxOverseas}) reached.` });
    }

    const fee = Math.min(team.remainingBudget, Math.max(20, repPlayer.basePrice));
    if (team.remainingBudget < 20) {
      return res.status(400).json({ error: 'Insufficient purse (minimum ₹20L required).' });
    }

    await db.insert(playerContracts).values({
      leagueId,
      teamId: team.id,
      playerId: repPlayer.id,
      purchasePrice: fee,
      salary: fee,
      contractYears: 1,
      acquiredVia: 'injury_replacement',
    });

    await db
      .update(teams)
      .set({ remainingBudget: team.remainingBudget - fee })
      .where(eq(teams.id, team.id));

    const [news] = await db
      .insert(leagueNews)
      .values({
        leagueId,
        category: 'trade',
        headline: `INJURY COVER: ${team.shortCode} sign ${repPlayer.name} for injured ${injured.player.name}`,
        summary: `${team.name} drafted ${repPlayer.name} (${repPlayer.primaryRole}) from the replacement pool for ₹${fee}L while ${injured.player.name} recovers (${injured.player.injuryStatus}).`,
        teamId: team.id,
        playerId: repPlayer.id,
      })
      .returning();

    if (news) wsHub.broadcastToLeague(leagueId, 'gazette:new', news);
    wsHub.broadcastToLeague(leagueId, 'squad:updated', { teamId: team.id });

    res.status(201).json({ signedPlayer: repPlayer, fee });
  } catch (error: any) {
    console.error('Injury replacement error:', error);
    res.status(500).json({ error: error.message || 'Failed to sign injury replacement' });
  }
});

// 8. Global Friends & Direct 1-on-1 Chat (Works independently of leagues)
async function fetchUserSummaryMap(uids: string[]) {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  if (unique.length === 0) return new Map<string, any>();

  const rows = await db
    .select({
      uid: users.uid,
      email: users.email,
      managerName: managerProfiles.managerName,
      preferredName: managerProfiles.preferredName,
      country: managerProfiles.country,
      avatarUrl: managerProfiles.avatarUrl,
      coachExperience: managerProfiles.coachExperience,
      favoriteFormat: managerProfiles.favoriteFormat,
      reputation: managerProfiles.reputation,
    })
    .from(users)
    .leftJoin(managerProfiles, eq(users.uid, managerProfiles.userUid))
    .where(inArray(users.uid, unique));

  const onlineSet = new Set(wsHub.getOnlineUserUids());
  const map = new Map<string, any>();
  for (const r of rows) {
    map.set(r.uid, {
      uid: r.uid,
      email: r.email,
      managerName: r.managerName || r.preferredName || r.email?.split('@')[0] || 'CM27 Manager',
      preferredName: r.preferredName || r.managerName || r.email?.split('@')[0] || 'CM27 Manager',
      country: r.country || 'International',
      avatarUrl: r.avatarUrl || 'crest:emerald',
      coachExperience: r.coachExperience || 'Regional Experience',
      favoriteFormat: r.favoriteFormat || 'T20',
      reputation: r.reputation ?? 50,
      isOnline: onlineSet.has(r.uid),
    });
  }
  return map;
}

apiRouter.get('/friends', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const rows = await db
      .select()
      .from(friendships)
      .where(or(eq(friendships.requesterUid, uid), eq(friendships.addresseeUid, uid)))
      .orderBy(desc(friendships.updatedAt));

    const otherUids = rows.map((r) => (r.requesterUid === uid ? r.addresseeUid : r.requesterUid));
    const userMap = await fetchUserSummaryMap(otherUids);

    const dmRows = await db
      .select()
      .from(directMessages)
      .where(or(eq(directMessages.senderUid, uid), eq(directMessages.recipientUid, uid)))
      .orderBy(desc(directMessages.createdAt))
      .limit(500);

    const unreadByFriend = new Map<string, number>();
    const lastMsgByFriend = new Map<string, typeof directMessages.$inferSelect>();
    let totalUnread = 0;

    for (const dm of dmRows) {
      const friendUid = dm.senderUid === uid ? dm.recipientUid : dm.senderUid;
      if (!lastMsgByFriend.has(friendUid)) {
        lastMsgByFriend.set(friendUid, dm);
      }
      if (dm.recipientUid === uid && !dm.isRead) {
        unreadByFriend.set(friendUid, (unreadByFriend.get(friendUid) ?? 0) + 1);
        totalUnread += 1;
      }
    }

    const accepted: any[] = [];
    const incoming: any[] = [];
    const outgoing: any[] = [];

    for (const row of rows) {
      const otherUid = row.requesterUid === uid ? row.addresseeUid : row.requesterUid;
      const friend = userMap.get(otherUid);
      if (!friend) continue;

      if (row.status === 'accepted') {
        accepted.push({
          id: row.id,
          status: row.status,
          friend,
          unreadCount: unreadByFriend.get(otherUid) ?? 0,
          lastMessage: lastMsgByFriend.get(otherUid) ?? null,
          updatedAt: row.updatedAt,
        });
      } else if (row.addresseeUid === uid) {
        incoming.push({
          id: row.id,
          status: row.status,
          friend,
          createdAt: row.createdAt,
        });
      } else {
        outgoing.push({
          id: row.id,
          status: row.status,
          friend,
          createdAt: row.createdAt,
        });
      }
    }

    res.json({ accepted, incoming, outgoing, totalUnread });
  } catch (error: any) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: error.message || 'Failed to load friends' });
  }
});

apiRouter.get('/friends/search', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const q = String(req.query.q || '').trim();

    const conditions: any[] = [ne(users.uid, uid)];
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(managerProfiles.managerName, pattern),
          ilike(managerProfiles.preferredName, pattern),
          ilike(users.email, pattern),
          ilike(managerProfiles.country, pattern)
        )
      );
    }

    const candidates = await db
      .select({
        uid: users.uid,
        email: users.email,
        managerName: managerProfiles.managerName,
        preferredName: managerProfiles.preferredName,
        country: managerProfiles.country,
        avatarUrl: managerProfiles.avatarUrl,
        coachExperience: managerProfiles.coachExperience,
        favoriteFormat: managerProfiles.favoriteFormat,
        reputation: managerProfiles.reputation,
      })
      .from(users)
      .leftJoin(managerProfiles, eq(users.uid, managerProfiles.userUid))
      .where(and(...conditions))
      .orderBy(desc(users.createdAt))
      .limit(25);

    const relRows = await db
      .select()
      .from(friendships)
      .where(or(eq(friendships.requesterUid, uid), eq(friendships.addresseeUid, uid)));

    const relMap = new Map<string, { status: string; id: number }>();
    for (const r of relRows) {
      const otherUid = r.requesterUid === uid ? r.addresseeUid : r.requesterUid;
      if (r.status === 'accepted') {
        relMap.set(otherUid, { status: 'friends', id: r.id });
      } else if (r.addresseeUid === uid) {
        relMap.set(otherUid, { status: 'incoming_pending', id: r.id });
      } else {
        relMap.set(otherUid, { status: 'outgoing_pending', id: r.id });
      }
    }

    const onlineSet = new Set(wsHub.getOnlineUserUids());
    const results = candidates.map((c) => {
      const rel = relMap.get(c.uid);
      return {
        uid: c.uid,
        email: c.email,
        managerName: c.managerName || c.preferredName || c.email?.split('@')[0] || 'CM27 Manager',
        preferredName: c.preferredName || c.managerName || c.email?.split('@')[0] || 'CM27 Manager',
        country: c.country || 'International',
        avatarUrl: c.avatarUrl || 'crest:emerald',
        coachExperience: c.coachExperience || 'Regional Experience',
        favoriteFormat: c.favoriteFormat || 'T20',
        reputation: c.reputation ?? 50,
        isOnline: onlineSet.has(c.uid),
        relationStatus: rel?.status || 'none',
        friendshipId: rel?.id ?? null,
      };
    });

    res.json({ managers: results });
  } catch (error: any) {
    console.error('Friend search error:', error);
    res.status(500).json({ error: error.message || 'Failed to search managers' });
  }
});

apiRouter.post('/friends/request', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    let targetUid = typeof req.body.targetUid === 'string' ? req.body.targetUid.trim() : '';
    const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim() : '';

    if (!targetUid && identifier) {
      const [found] = await db
        .select({ uid: users.uid })
        .from(users)
        .leftJoin(managerProfiles, eq(users.uid, managerProfiles.userUid))
        .where(
          and(
            ne(users.uid, uid),
            or(
              ilike(users.email, identifier),
              ilike(managerProfiles.managerName, identifier),
              ilike(managerProfiles.preferredName, identifier)
            )
          )
        )
        .limit(1);
      if (found) targetUid = found.uid;
    }

    if (!targetUid) {
      return res.status(404).json({ error: 'No registered manager found matching that name or email.' });
    }
    if (targetUid === uid) {
      return res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
    }

    const [targetUser] = await db.select().from(users).where(eq(users.uid, targetUid)).limit(1);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target manager account not found.' });
    }

    const existing = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.requesterUid, uid), eq(friendships.addresseeUid, targetUid)),
          and(eq(friendships.requesterUid, targetUid), eq(friendships.addresseeUid, uid))
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      if (row.status === 'accepted') {
        return res.status(409).json({ error: 'You are already connected as friends.' });
      }
      if (row.requesterUid === uid) {
        return res.status(409).json({ error: 'Friend request already sent.' });
      }
      // Reciprocal incoming request exists -> auto-accept!
      const [accepted] = await db
        .update(friendships)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(friendships.id, row.id))
        .returning();

      const summaryMap = await fetchUserSummaryMap([uid, targetUid]);
      wsHub.sendToUser(targetUid, 'friend:updated', {
        action: 'accepted',
        byUid: uid,
        friend: summaryMap.get(uid),
      });
      wsHub.sendToUser(uid, 'friend:updated', {
        action: 'accepted',
        byUid: targetUid,
        friend: summaryMap.get(targetUid),
      });

      return res.status(200).json({ friendship: accepted, autoAccepted: true });
    }

    const [created] = await db
      .insert(friendships)
      .values({
        requesterUid: uid,
        addresseeUid: targetUid,
        status: 'pending',
      })
      .returning();

    const summaryMap = await fetchUserSummaryMap([uid]);
    wsHub.sendToUser(targetUid, 'friend:request', {
      friendshipId: created.id,
      from: summaryMap.get(uid),
    });

    res.status(201).json({ friendship: created, autoAccepted: false });
  } catch (error: any) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: error.message || 'Failed to send friend request' });
  }
});

apiRouter.post('/friends/respond', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const friendshipId = Number(req.body.friendshipId);
    const action = req.body.action === 'accept' ? 'accept' : 'decline';

    if (!friendshipId) {
      return res.status(400).json({ error: 'Valid friendshipId is required.' });
    }

    const [row] = await db
      .select()
      .from(friendships)
      .where(eq(friendships.id, friendshipId))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: 'Friend request not found.' });
    }

    if (action === 'accept') {
      if (row.addresseeUid !== uid) {
        return res.status(403).json({ error: 'Only the recipient can accept this request.' });
      }
      const [updated] = await db
        .update(friendships)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(friendships.id, friendshipId))
        .returning();

      const summaryMap = await fetchUserSummaryMap([uid, row.requesterUid]);
      wsHub.sendToUser(row.requesterUid, 'friend:updated', {
        action: 'accepted',
        friend: summaryMap.get(uid),
      });
      wsHub.sendToUser(uid, 'friend:updated', {
        action: 'accepted',
        friend: summaryMap.get(row.requesterUid),
      });

      return res.json({ friendship: updated });
    } else {
      if (row.addresseeUid !== uid && row.requesterUid !== uid) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
      await db.delete(friendships).where(eq(friendships.id, friendshipId));
      wsHub.sendToUser(row.requesterUid, 'friend:updated', { action: 'declined', friendshipId });
      wsHub.sendToUser(row.addresseeUid, 'friend:updated', { action: 'declined', friendshipId });
      return res.json({ ok: true });
    }
  } catch (error: any) {
    console.error('Respond friend request error:', error);
    res.status(500).json({ error: error.message || 'Failed to respond to friend request' });
  }
});

apiRouter.delete('/friends/:friendUid', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const friendUid = String(req.params.friendUid || '').trim();
    if (!friendUid) return res.status(400).json({ error: 'Friend UID is required.' });

    await db
      .delete(friendships)
      .where(
        or(
          and(eq(friendships.requesterUid, uid), eq(friendships.addresseeUid, friendUid)),
          and(eq(friendships.requesterUid, friendUid), eq(friendships.addresseeUid, uid))
        )
      );

    wsHub.sendToUser(friendUid, 'friend:updated', { action: 'removed', byUid: uid });
    wsHub.sendToUser(uid, 'friend:updated', { action: 'removed', byUid: friendUid });

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: error.message || 'Failed to remove friend' });
  }
});

apiRouter.get('/dm/:friendUid', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const friendUid = String(req.params.friendUid || '').trim();
    if (!friendUid) return res.status(400).json({ error: 'Friend UID required.' });

    const [rel] = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(
            and(eq(friendships.requesterUid, uid), eq(friendships.addresseeUid, friendUid)),
            and(eq(friendships.requesterUid, friendUid), eq(friendships.addresseeUid, uid))
          )
        )
      )
      .limit(1);

    if (!rel) {
      return res.status(403).json({ error: 'You must be friends to view this conversation.' });
    }

    await db
      .update(directMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(directMessages.senderUid, friendUid),
          eq(directMessages.recipientUid, uid),
          eq(directMessages.isRead, false)
        )
      );

    const rows = await db
      .select()
      .from(directMessages)
      .where(
        or(
          and(eq(directMessages.senderUid, uid), eq(directMessages.recipientUid, friendUid)),
          and(eq(directMessages.senderUid, friendUid), eq(directMessages.recipientUid, uid))
        )
      )
      .orderBy(desc(directMessages.createdAt))
      .limit(100);

    res.json({ messages: rows.reverse() });
  } catch (error: any) {
    console.error('Get DM conversation error:', error);
    res.status(500).json({ error: error.message || 'Failed to load messages' });
  }
});

apiRouter.post('/dm/:friendUid', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const friendUid = String(req.params.friendUid || '').trim();
    if (!friendUid) return res.status(400).json({ error: 'Friend UID required.' });

    const [rel] = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(
            and(eq(friendships.requesterUid, uid), eq(friendships.addresseeUid, friendUid)),
            and(eq(friendships.requesterUid, friendUid), eq(friendships.addresseeUid, uid))
          )
        )
      )
      .limit(1);

    if (!rel) {
      return res.status(403).json({ error: 'Add this manager as a friend before messaging.' });
    }

    let inviteCode: string | null = null;
    let inviteLeagueName: string | null = null;
    const leagueId = req.body.leagueId ? Number(req.body.leagueId) : null;

    if (leagueId) {
      const mem = await assertLeagueMember(leagueId, uid);
      if (mem) {
        const [lg] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
        if (lg) {
          inviteCode = lg.inviteCode;
          inviteLeagueName = lg.name;
        }
      }
    }

    const rawBody = String(req.body.body || '').trim();
    const body =
      rawBody || (inviteLeagueName ? `Invited you to join ${inviteLeagueName}!` : '');
    if (!body || body.length > 500) {
      return res.status(400).json({ error: 'Message must be between 1 and 500 characters.' });
    }

    const [saved] = await db
      .insert(directMessages)
      .values({
        senderUid: uid,
        recipientUid: friendUid,
        body,
        inviteCode,
        inviteLeagueName,
        isRead: false,
      })
      .returning();

    const senderMap = await fetchUserSummaryMap([uid]);
    const payload = {
      message: saved,
      sender: senderMap.get(uid) ?? null,
    };

    wsHub.sendToUser(friendUid, 'dm:message', payload);
    wsHub.sendToUser(uid, 'dm:message', payload);

    res.status(201).json({ message: saved });
  } catch (error: any) {
    console.error('Send DM error:', error);
    res.status(500).json({ error: error.message || 'Failed to send direct message' });
  }
});
