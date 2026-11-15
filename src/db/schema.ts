import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export interface FormatStats {
  matches: number;
  runs: number;
  battingAvg: number;
  strikeRate: number;
  hundreds: number;
  fifties: number;
  wickets: number;
  economy: number;
  bowlingAvg: number;
  bestBowling: string;
}

export interface PlayerStatsBundle {
  t20: FormatStats;
  odi: FormatStats;
  test: FormatStats;
}

export interface HiredStaffEntry {
  id: string;
  name: string;
  role: 'Head Coach' | 'Batting Coach' | 'Bowling Coach' | 'Fielding Coach' | 'Wicketkeeping Coach';
  knowledge: 'Expert' | 'Accomplished' | 'Competent' | 'Novice';
  batStars: number;
  bowlStars: number;
  fieldStars: number;
  wkStars: number;
  signingFeeLakhs: number;
  weeklyWageLakhs: number;
  legacyNote: string;
  hiredAt: string;
}

export interface HiredScoutEntry {
  id: string;
  name: string;
  country: string;
  experienceStars: number;
  judgementStars: number;
  networkCostLakhs: number;
  specialtyRegion: string;
  hiredAt: string;
  activeMission?: {
    targetRegion: string;
    targetRole: string;
    targetLeague: string;
    archetypes?: string[];
    minPotential: number;
    completedAt: string;
    recommendedPlayerIds: number[];
  } | null;
}

export interface PlayerDevPlan {
  trajectory: string;
  focusAttribute: string;
  weeklyIntensity: 'Light' | 'Standard' | 'Intensive';
  updatedAt: string;
}

export interface TeamTacticsConfig {
  t20Tempo: 'Balanced' | 'Aggressive' | 'Ultra-Attacking' | 'Anchor-Led';
  odiTempo: 'Balanced' | 'Aggressive' | 'Measured';
  testTempo: 'Measured' | 'Balanced' | 'Bazball Attack';
  aimRpo: number;
  powerplayAggression: 'High' | 'Balanced' | 'Cautious';
  deathPlan: 'Yorker Focus' | 'Wide Slowers' | 'Matchup Pace/Spin';
}

export const DEFAULT_TACTICS: TeamTacticsConfig = {
  t20Tempo: 'Aggressive',
  odiTempo: 'Balanced',
  testTempo: 'Measured',
  aimRpo: 9.2,
  powerplayAggression: 'High',
  deathPlan: 'Yorker Focus',
};

export interface RivalryBuff {
  vsTeamId?: number;
  vsTeamShortCode?: string;
  aggressionBoost: number;
  moraleBoost: number;
  expiresAfterMatchId?: number;
  sourceNote?: string;
}

export interface PressConferenceQuoteOption {
  stance: 'measured' | 'assertive' | 'critical';
  quote: string;
  impactTag: string;
}

export interface PressConferenceQuestion {
  id: string;
  journalist: string;
  outlet: string;
  question: string;
  targetPlayerId?: number | null;
  targetPlayerName?: string | null;
  options?: PressConferenceQuoteOption[];
  chosenStance?: 'measured' | 'assertive' | 'critical' | null;
  chosenQuote?: string | null;
}

export interface PressConferenceData {
  questions: PressConferenceQuestion[];
  readyAt?: string;
  completedAt?: string;
  overallImpactSummary?: string;
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const managerProfiles = pgTable('manager_profiles', {
  userUid: text('user_uid')
    .primaryKey()
    .references(() => users.uid, { onDelete: 'cascade' }),
  managerName: text('manager_name').notNull(),
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name').notNull().default(''),
  preferredName: text('preferred_name').notNull().default(''),
  country: text('country').notNull(),
  preferredCurrency: text('preferred_currency').notNull().default('INR'),
  birthYear: integer('birth_year').notNull().default(1993),
  birthMonth: text('birth_month').notNull().default('MAY'),
  birthDay: integer('birth_day').notNull().default(7),
  coachExperience: text('coach_experience').notNull().default('Regional Experience'),
  coachBackground: text('coach_background').notNull().default('Tactical Analyst'),
  coachingStyle: text('coaching_style').notNull().default('Balanced Tactical'),
  favoriteFormat: text('favorite_format').notNull().default('T20'),
  avatarUrl: text('avatar_url').notNull(),
  bio: text('bio').notNull().default(''),
  reputation: integer('reputation').notNull().default(50),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const leagues = pgTable('leagues', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  hostUid: text('host_uid')
    .notNull()
    .references(() => users.uid),
  primaryCompetition: text('primary_competition').notNull().default('IPL'), // IPL | PSL | SA20 | BBL | The Hundred | International
  competitionFormat: text('competition_format').notNull().default('League'),
  maxManagers: integer('max_managers').notNull().default(10),
  allowCustomTeams: boolean('allow_custom_teams').notNull().default(true),
  startingBudget: integer('starting_budget').notNull().default(10000), // Lakhs (10000L = 100 Cr)
  maxSquadSize: integer('max_squad_size').notNull().default(25),
  minSquadSize: integer('min_squad_size').notNull().default(22),
  maxOverseas: integer('max_overseas').notNull().default(8),
  defaultBasePrice: integer('default_base_price').notNull().default(50), // Lakhs
  bidIncrement: integer('bid_increment').notNull().default(25), // Lakhs
  auctionDurationSec: integer('auction_duration_sec').notNull().default(20),
  status: text('status').notNull().default('setup'), // setup | auction | active
  seasonStartedAt: timestamp('season_started_at').defaultNow().notNull(),
  dayDurationSec: integer('day_duration_sec').notNull().default(600), // default 10 minutes
  currentGameDay: integer('current_game_day').notNull().default(1),
  dayStartedAt: timestamp('day_started_at').defaultNow().notNull(),
  nextAutoSimAt: timestamp('next_auto_sim_at'),
  inactivitySimEnabled: boolean('inactivity_sim_enabled').notNull().default(false),
  inactivityTimeoutSec: integer('inactivity_timeout_sec').notNull().default(86400),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const leagueMembers = pgTable(
  'league_members',
  {
    id: serial('id').primaryKey(),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // host | member
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('league_members_league_user_idx').on(table.leagueId, table.userUid),
    index('league_members_user_idx').on(table.userUid),
  ]
);

export const teams = pgTable(
  'teams',
  {
    id: serial('id').primaryKey(),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    templateKey: text('template_key'),
    ownerUid: text('owner_uid').references(() => users.uid, { onDelete: 'set null' }),
    name: text('name').notNull(),
    shortCode: text('short_code').notNull(),
    leagueCategory: text('league_category').notNull().default('IPL'),
    homeGround: text('home_ground').notNull(),
    foundedYear: integer('founded_year').notNull().default(2008),
    boardValue: integer('board_value').notNull().default(125000),
    fanbaseDevotion: text('fanbase_devotion').notNull().default('HIGH'),
    youthFacilities: text('youth_facilities').notNull().default('HIGH'),
    primaryColor: text('primary_color').notNull().default('#D97706'),
    secondaryColor: text('secondary_color').notNull().default('#1E293B'),
    coachName: text('coach_name').notNull().default('Head Tactician'),
    coachingSpecialty: text('coaching_specialty').notNull().default('Balanced Analytics'),
    startingBudget: integer('starting_budget').notNull().default(10000),
    remainingBudget: integer('remaining_budget').notNull().default(10000),
    reputation: integer('reputation').notNull().default(75),
    trophiesCount: integer('trophies_count').notNull().default(0),
    historicalTitlesJson: jsonb('historical_titles_json').$type<string[]>().notNull().default([]),
    hiredStaffJson: jsonb('hired_staff_json').$type<HiredStaffEntry[]>().notNull().default([]),
    hiredScoutsJson: jsonb('hired_scouts_json').$type<HiredScoutEntry[]>().notNull().default([]),
    developmentPlansJson: jsonb('development_plans_json').$type<Record<string, PlayerDevPlan>>().notNull().default({}),
    tacticsJson: jsonb('tactics_json').$type<TeamTacticsConfig>().notNull().default(DEFAULT_TACTICS),
    bookmarkedPlayerIdsJson: jsonb('bookmarked_player_ids_json').$type<number[]>().notNull().default([]),
    trainingSlotsUsedDay: integer('training_slots_used_day').notNull().default(0),
    trainingSlotsUsedCount: integer('training_slots_used_count').notNull().default(0),
  rivalryBuffJson: jsonb('rivalry_buff_json').$type<RivalryBuff | null>(),
  pressMoraleBuff: integer('press_morale_buff').notNull().default(0),
  stopBuyingInAutoSim: boolean('stop_buying_in_auto_sim').notNull().default(false),
  isCustom: boolean('is_custom').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('teams_league_owner_idx').on(table.leagueId, table.ownerUid),
    index('teams_league_idx').on(table.leagueId),
  ]
);

export const players = pgTable(
  'players',
  {
    id: serial('id').primaryKey(),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    country: text('country').notNull(),
    leagueOrigin: text('league_origin').notNull().default('IPL'),
    isOverseas: boolean('is_overseas').notNull().default(false),
    age: integer('age').notNull(),
    battingHand: text('batting_hand').notNull(),
    bowlingStyle: text('bowling_style').notNull(),
    primaryRole: text('primary_role').notNull(), // Batsman | Bowler | All-Rounder | Wicketkeeper
    battingRating: integer('batting_rating').notNull(),
    bowlingRating: integer('bowling_rating').notNull(),
    fieldingRating: integer('fielding_rating').notNull(),
    fitness: integer('fitness').notNull(),
    consistency: integer('consistency').notNull(),
    temperament: integer('temperament').notNull(),
    potential: integer('potential').notNull(),
    currentForm: integer('current_form').notNull(),
    morale: integer('morale').notNull(),
    basePrice: integer('base_price').notNull().default(50),
    marketValue: integer('market_value').notNull().default(100),
    isGenerated: boolean('is_generated').notNull().default(false),
    sourceLabel: text('source_label').notNull().default('CM27 Global Registry'),
    injuryStatus: text('injury_status').notNull().default('Fit'),
    marqueeSet: text('marquee_set').notNull().default('Marquee Stars'),
    formDelta: integer('form_delta').notNull().default(0),
    stamina: integer('stamina').notNull().default(100),
    consecutiveMatches: integer('consecutive_matches').notNull().default(0),
    benchedStreak: integer('benched_streak').notNull().default(0),
    injuryGamesRemaining: integer('injury_games_remaining').notNull().default(0),
    drillsCompleted: integer('drills_completed').notNull().default(0),
    traitsJson: jsonb('traits_json').$type<string[]>().notNull().default([]),
    transferRequested: boolean('transfer_requested').notNull().default(false),
    statsJson: jsonb('stats_json').$type<PlayerStatsBundle>().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('players_league_role_idx').on(table.leagueId, table.primaryRole),
    index('players_league_name_idx').on(table.leagueId, table.name),
  ]
);

export const playerContracts = pgTable(
  'player_contracts',
  {
    id: serial('id').primaryKey(),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    purchasePrice: integer('purchase_price').notNull(),
    salary: integer('salary').notNull(),
    contractYears: integer('contract_years').notNull().default(3),
    acquiredVia: text('acquired_via').notNull().default('auction'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('contracts_league_player_idx').on(table.leagueId, table.playerId),
    index('contracts_team_idx').on(table.teamId),
  ]
);

export const lineups = pgTable(
  'lineups',
  {
    id: serial('id').primaryKey(),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    format: text('format').notNull(), // T20 | ODI | Test
    captainPlayerId: integer('captain_player_id').references(() => players.id, { onDelete: 'set null' }),
    viceCaptainPlayerId: integer('vice_captain_player_id').references(() => players.id, { onDelete: 'set null' }),
    wicketkeeperPlayerId: integer('wicketkeeper_player_id').references(() => players.id, { onDelete: 'set null' }),
    battingOrderJson: jsonb('batting_order_json').$type<number[]>().notNull().default([]),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('lineups_team_format_idx').on(table.teamId, table.format)]
);

export const auctions = pgTable('auctions', {
  id: serial('id').primaryKey(),
  leagueId: integer('league_id')
    .notNull()
    .unique()
    .references(() => leagues.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('lobby'), // lobby | live | paused | completed
  currentLotId: integer('current_lot_id'),
  currentBid: integer('current_bid').notNull().default(0),
  highestBidderTeamId: integer('highest_bidder_team_id').references(() => teams.id, { onDelete: 'set null' }),
  highestBidderUid: text('highest_bidder_uid').references(() => users.uid, { onDelete: 'set null' }),
  lotEndsAt: timestamp('lot_ends_at'),
  remainingSecondsOnPause: integer('remaining_seconds_on_pause'),
  autoAdvance: boolean('auto_advance').notNull().default(true),
  currentSetName: text('current_set_name').notNull().default('Marquee Stars'),
  acceleratedRound: boolean('accelerated_round').notNull().default(false),
  pauseRequestsJson: jsonb('pause_requests_json')
    .$type<Array<{ uid: string; managerName: string; teamShortCode?: string; requestedAt: string }>>()
    .notNull()
    .default([]),
  pausedByUid: text('paused_by_uid'),
  pausedByName: text('paused_by_name'),
  autoSimVotesJson: jsonb('auto_sim_votes_json')
    .$type<Array<{ uid: string; managerName: string; teamShortCode?: string; votedAt: string }>>()
    .notNull()
    .default([]),
  skipVotesJson: jsonb('skip_votes_json')
    .$type<Array<{ uid: string; managerName: string; teamShortCode?: string; votedAt: string }>>()
    .notNull()
    .default([]),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const auctionPlayers = pgTable(
  'auction_players',
  {
    id: serial('id').primaryKey(),
    auctionId: integer('auction_id')
      .notNull()
      .references(() => auctions.id, { onDelete: 'cascade' }),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    lotOrder: integer('lot_order').notNull(),
    basePrice: integer('base_price').notNull(),
    status: text('status').notNull().default('pending'), // pending | active | sold | unsold
    soldPrice: integer('sold_price'),
    winningTeamId: integer('winning_team_id').references(() => teams.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('auction_players_auction_status_idx').on(table.auctionId, table.status, table.lotOrder),
    uniqueIndex('auction_players_auction_player_idx').on(table.auctionId, table.playerId),
  ]
);

export const bids = pgTable(
  'bids',
  {
    id: serial('id').primaryKey(),
    auctionId: integer('auction_id')
      .notNull()
      .references(() => auctions.id, { onDelete: 'cascade' }),
    auctionPlayerId: integer('auction_player_id')
      .notNull()
      .references(() => auctionPlayers.id, { onDelete: 'cascade' }),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid),
    amount: integer('amount').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('bids_lot_created_idx').on(table.auctionPlayerId, table.createdAt)]
);

export const leagueMessages = pgTable(
  'league_messages',
  {
    id: serial('id').primaryKey(),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid),
    teamShortCode: text('team_short_code'),
    body: text('body').notNull(),
    messageType: text('message_type').notNull().default('chat'), // chat | system
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('league_messages_league_created_idx').on(table.leagueId, table.createdAt)]
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    targetUid: text('target_uid'),
    category: text('category').notNull().default('League'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    readByUidsJson: jsonb('read_by_uids_json').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_league_created_idx').on(table.leagueId, table.createdAt)]
);

export const friendships = pgTable(
  'friendships',
  {
    id: serial('id').primaryKey(),
    requesterUid: text('requester_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    addresseeUid: text('addressee_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'), // pending | accepted
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('friendships_pair_idx').on(table.requesterUid, table.addresseeUid),
    index('friendships_requester_idx').on(table.requesterUid),
    index('friendships_addressee_idx').on(table.addresseeUid),
  ]
);

export const directMessages = pgTable(
  'direct_messages',
  {
    id: serial('id').primaryKey(),
    senderUid: text('sender_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    recipientUid: text('recipient_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    inviteCode: text('invite_code'),
    inviteLeagueName: text('invite_league_name'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('dm_pair_created_idx').on(table.senderUid, table.recipientUid, table.createdAt),
    index('dm_recipient_read_idx').on(table.recipientUid, table.isRead),
  ]
);

export interface MatchBatterLine {
  playerId: number;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissal: string;
}

export interface MatchBowlerLine {
  playerId: number;
  name: string;
  overs: string;
  runs: number;
  wickets: number;
  econ: number;
}

export interface MatchInningsSummary {
  teamId: number;
  teamName: string;
  teamShortCode: string;
  runs: number;
  wickets: number;
  overs: string;
  topScorer: string;
  topBowler: string;
  batters: MatchBatterLine[];
  bowlers: MatchBowlerLine[];
}

export interface MatchResultSummary {
  tossWinnerTeamId: number;
  tossDecision: 'bat' | 'bowl';
  coinResult: 'heads' | 'tails';
  userCall: 'heads' | 'tails';
  innings1: MatchInningsSummary;
  innings2: MatchInningsSummary;
  winnerTeamId: number | null;
  marginText: string;
  manOfTheMatch: string;
  venue: string;
  pitchCondition: string;
  highlights: string[];
  droppedCatches?: string[];
  turningPoints?: string[];
}

export const matches = pgTable(
  'matches',
  {
    id: serial('id').primaryKey(),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    homeTeamId: integer('home_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    awayTeamId: integer('away_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    format: text('format').notNull().default('T20'), // T20 | ODI | Test | Hundred
    competitionLabel: text('competition_label').notNull().default('Indian Premier League'),
    venue: text('venue').notNull(),
    pitchCondition: text('pitch_condition').notNull().default('Balanced · Even Bounce'),
    status: text('status').notNull().default('completed'),
    homeLineupIdsJson: jsonb('home_lineup_ids_json').$type<number[]>().notNull().default([]),
    awayLineupIdsJson: jsonb('away_lineup_ids_json').$type<number[]>().notNull().default([]),
    tossWinnerTeamId: integer('toss_winner_team_id'),
    tossDecision: text('toss_decision'),
    winnerTeamId: integer('winner_team_id'),
    marginText: text('margin_text').notNull().default(''),
    resultSummaryJson: jsonb('result_summary_json').$type<MatchResultSummary | null>(),
    pressConferenceCompleted: boolean('press_conference_completed').notNull().default(false),
    pressConferenceJson: jsonb('press_conference_json').$type<PressConferenceData | null>(),
    resolutionType: text('resolution_type').notNull().default('manual'), // manual | ai_vs_ai | auto_inactivity
    createdByUid: text('created_by_uid').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('matches_league_created_idx').on(table.leagueId, table.createdAt)]
);

export interface PvpLiveMatchState {
  inningsNumber: 1 | 2;
  targetRuns: number | null;
  maxBallsPerInnings: number;
  ballsPerOver: number;
  pitchCondition: string;
  format: string;
  homeTeamId: number;
  awayTeamId: number;
  innings1: any;
  innings2: any | null;
  completedInnings1Summary: MatchInningsSummary | null;
  commentary: Array<{
    id: number;
    over: string;
    text: string;
    tone: 'wicket' | 'boundary' | 'normal';
  }>;
  highlights: string[];
  finished: boolean;
  lastTickAt: number;
}

export const fixtures = pgTable(
  'fixtures',
  {
    id: serial('id').primaryKey(),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    matchNumber: integer('match_number').notNull(),
    scheduledDay: integer('scheduled_day').notNull(),
    stage: text('stage').notNull().default('league'), // league | qualifier1 | eliminator | qualifier2 | final
    homeTeamId: integer('home_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    awayTeamId: integer('away_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    format: text('format').notNull().default('T20'),
    venue: text('venue').notNull(),
    pitchCondition: text('pitch_condition').notNull().default('Balanced · True Bounce'),
    status: text('status').notNull().default('scheduled'), // scheduled | lobby | toss | live | paused | completed
    homeReady: boolean('home_ready').notNull().default(false),
    awayReady: boolean('away_ready').notNull().default(false),
    homeLineupIdsJson: jsonb('home_lineup_ids_json').$type<number[]>().notNull().default([]),
    awayLineupIdsJson: jsonb('away_lineup_ids_json').$type<number[]>().notNull().default([]),
    homeStrategy: text('home_strategy').notNull().default('Normal'),
    awayStrategy: text('away_strategy').notNull().default('Normal'),
    simPace: text('sim_pace').notNull().default('medium'),
    tossWinnerTeamId: integer('toss_winner_team_id'),
    tossDecision: text('toss_decision'),
    coinResult: text('coin_result'),
    liveStateJson: jsonb('live_state_json').$type<PvpLiveMatchState | null>(),
    skipVotesJson: jsonb('skip_votes_json')
      .$type<Array<{ uid: string; managerName: string; teamShortCode?: string; votedAt: string }>>()
      .notNull()
      .default([]),
    matchId: integer('match_id').references(() => matches.id, { onDelete: 'set null' }),
    resolutionType: text('resolution_type').notNull().default('manual'), // manual | ai_vs_ai | auto_inactivity
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('fixtures_league_day_idx').on(table.leagueId, table.scheduledDay, table.matchNumber),
    index('fixtures_league_status_idx').on(table.leagueId, table.status),
  ]
);

export const leagueNews = pgTable(
  'league_news',
  {
    id: serial('id').primaryKey(),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    category: text('category').notNull().default('press'), // press | upset | injury | training | trade | milestone
    headline: text('headline').notNull(),
    summary: text('summary').notNull(),
    quote: text('quote'),
    teamId: integer('team_id').references(() => teams.id, { onDelete: 'set null' }),
    playerId: integer('player_id').references(() => players.id, { onDelete: 'set null' }),
    relatedMatchId: integer('related_match_id').references(() => matches.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('league_news_league_created_idx').on(table.leagueId, table.createdAt)]
);

export const tradeOffers = pgTable(
  'trade_offers',
  {
    id: serial('id').primaryKey(),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    proposerTeamId: integer('proposer_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    recipientTeamId: integer('recipient_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    proposerUid: text('proposer_uid'),
    recipientUid: text('recipient_uid'),
    offeredPlayerIdsJson: jsonb('offered_player_ids_json').$type<number[]>().notNull().default([]),
    requestedPlayerIdsJson: jsonb('requested_player_ids_json').$type<number[]>().notNull().default([]),
    cashDeltaLakhs: integer('cash_delta_lakhs').notNull().default(0),
    status: text('status').notNull().default('pending'), // pending | accepted | rejected | cancelled
    message: text('message').notNull().default(''),
    aiEvaluationNote: text('ai_evaluation_note'),
    isAiInitiated: boolean('is_ai_initiated').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    respondedAt: timestamp('responded_at'),
  },
  (table) => [
    index('trade_offers_league_status_idx').on(table.leagueId, table.status, table.createdAt),
  ]
);

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(managerProfiles, {
    fields: [users.uid],
    references: [managerProfiles.userUid],
  }),
  memberships: many(leagueMembers),
}));

export const managerProfilesRelations = relations(managerProfiles, ({ one }) => ({
  user: one(users, {
    fields: [managerProfiles.userUid],
    references: [users.uid],
  }),
}));

export const leaguesRelations = relations(leagues, ({ many, one }) => ({
  members: many(leagueMembers),
  teams: many(teams),
  players: many(players),
  auction: one(auctions, {
    fields: [leagues.id],
    references: [auctions.leagueId],
  }),
}));

export const leagueMembersRelations = relations(leagueMembers, ({ one }) => ({
  league: one(leagues, {
    fields: [leagueMembers.leagueId],
    references: [leagues.id],
  }),
  user: one(users, {
    fields: [leagueMembers.userUid],
    references: [users.uid],
  }),
  profile: one(managerProfiles, {
    fields: [leagueMembers.userUid],
    references: [managerProfiles.userUid],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  league: one(leagues, {
    fields: [teams.leagueId],
    references: [leagues.id],
  }),
  contracts: many(playerContracts),
  lineups: many(lineups),
}));

export const playersRelations = relations(players, ({ one }) => ({
  league: one(leagues, {
    fields: [players.leagueId],
    references: [leagues.id],
  }),
  contract: one(playerContracts, {
    fields: [players.id],
    references: [playerContracts.playerId],
  }),
}));

export const playerContractsRelations = relations(playerContracts, ({ one }) => ({
  team: one(teams, {
    fields: [playerContracts.teamId],
    references: [teams.id],
  }),
  player: one(players, {
    fields: [playerContracts.playerId],
    references: [players.id],
  }),
}));
