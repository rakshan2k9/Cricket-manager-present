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

export type CurrencyCode = 'INR' | 'GBP' | 'USD' | 'AUD';

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

export interface CoachCatalogEntry {
  id: string;
  name: string;
  country: string;
  role: 'Head Coach' | 'Batting Coach' | 'Bowling Coach' | 'Fielding Coach' | 'Wicketkeeping Coach';
  knowledge: 'Expert' | 'Accomplished' | 'Competent' | 'Novice';
  batStars: number;
  bowlStars: number;
  fieldStars: number;
  wkStars: number;
  signingFeeLakhs: number;
  weeklyWageLakhs: number;
  legacyNote: string;
}

export interface ScoutCatalogEntry {
  id: string;
  name: string;
  country: string;
  experienceStars: number;
  judgementStars: number;
  networkCostLakhs: number;
  specialtyRegion: string;
}

export interface ManagerProfile {
  userUid: string;
  managerName: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  country: string;
  preferredCurrency: CurrencyCode;
  birthYear: number;
  birthMonth: string;
  birthDay: number;
  coachExperience: string;
  coachBackground: string;
  coachingStyle: string;
  favoriteFormat: 'T20' | 'ODI' | 'Test';
  avatarUrl: string;
  bio: string;
  reputation: number;
  updatedAt: string;
}

export interface League {
  id: number;
  name: string;
  inviteCode: string;
  hostUid: string;
  primaryCompetition?: 'IPL' | 'PSL' | 'SA20' | 'BBL' | 'The Hundred' | 'International';
  competitionFormat: string;
  maxManagers: number;
  allowCustomTeams: boolean;
  startingBudget: number;
  maxSquadSize: number;
  minSquadSize: number;
  maxOverseas: number;
  defaultBasePrice: number;
  bidIncrement: number;
  auctionDurationSec: number;
  status: 'setup' | 'auction' | 'active';
  seasonStartedAt?: string;
  dayDurationSec?: number;
  currentGameDay?: number;
  nextDayInSec?: number;
  createdAt: string;
  myRole?: 'host' | 'member';
  memberCount?: number;
  onlineCount?: number;
  myTeam?: Team | null;
}

export interface LeagueMember {
  id: number;
  userUid: string;
  role: 'host' | 'member';
  joinedAt: string;
  managerName: string | null;
  country: string | null;
  favoriteFormat: string | null;
  avatarUrl: string | null;
  reputation: number | null;
  isOnline: boolean;
}

export interface Team {
  id: number;
  leagueId: number;
  templateKey: string | null;
  ownerUid: string | null;
  name: string;
  shortCode: string;
  leagueCategory: string;
  homeGround: string;
  foundedYear: number;
  boardValue: number;
  fanbaseDevotion: string;
  youthFacilities: string;
  primaryColor: string;
  secondaryColor: string;
  coachName: string;
  coachingSpecialty: string;
  startingBudget: number;
  remainingBudget: number;
  reputation: number;
  trophiesCount: number;
  historicalTitlesJson: string[];
  hiredStaffJson: HiredStaffEntry[];
  hiredScoutsJson: HiredScoutEntry[];
  developmentPlansJson: Record<string, PlayerDevPlan>;
  tacticsJson: TeamTacticsConfig;
  bookmarkedPlayerIdsJson?: number[];
  trainingSlotsUsedDay?: number;
  trainingSlotsUsedCount?: number;
  rivalryBuffJson?: RivalryBuff | null;
  pressMoraleBuff?: number;
  isCustom: boolean;
  squadCount?: number;
  overseasCount?: number;
  ownerName?: string | null;
  ownerOnline?: boolean;
}

export interface RivalryBuff {
  vsTeamId?: number;
  vsTeamShortCode?: string;
  aggressionBoost: number;
  moraleBoost: number;
  expiresAfterMatchId?: number;
  sourceNote?: string;
}

export interface Player {
  id: number;
  leagueId: number;
  name: string;
  country: string;
  leagueOrigin: string;
  isOverseas: boolean;
  age: number;
  battingHand: string;
  bowlingStyle: string;
  primaryRole: 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicketkeeper';
  battingRating: number;
  bowlingRating: number;
  fieldingRating: number;
  fitness: number;
  consistency: number;
  temperament: number;
  potential: number;
  currentForm: number;
  morale: number;
  basePrice: number;
  marketValue: number;
  isGenerated: boolean;
  sourceLabel: string;
  injuryStatus: string;
  marqueeSet?: string;
  formDelta?: number;
  stamina?: number;
  consecutiveMatches?: number;
  benchedStreak?: number;
  injuryGamesRemaining?: number;
  drillsCompleted?: number;
  traitsJson?: string[];
  transferRequested?: boolean;
  statsJson: PlayerStatsBundle;
  ownedByTeamId?: number | null;
  ownedByTeamName?: string | null;
  ownedByTeamShortCode?: string | null;
  ownedByTeamColor?: string | null;
  purchasePrice?: number | null;
}

export interface PlayerContract {
  id: number;
  leagueId: number;
  teamId: number;
  playerId: number;
  purchasePrice: number;
  salary: number;
  contractYears: number;
  acquiredVia: string;
  createdAt: string;
}

export interface SquadPlayer extends Player {
  contract: PlayerContract;
}

export interface Lineup {
  id: number;
  leagueId: number;
  teamId: number;
  format: 'T20' | 'ODI' | 'Test' | 'Hundred';
  captainPlayerId: number | null;
  viceCaptainPlayerId: number | null;
  wicketkeeperPlayerId: number | null;
  battingOrderJson: number[];
  updatedAt: string;
}

export interface Auction {
  id: number;
  leagueId: number;
  status: 'lobby' | 'live' | 'paused' | 'completed';
  currentLotId: number | null;
  currentBid: number;
  highestBidderTeamId: number | null;
  highestBidderUid: string | null;
  lotEndsAt: string | null;
  remainingSecondsOnPause: number | null;
  autoAdvance: boolean;
  currentSetName?: string;
  acceleratedRound?: boolean;
  pauseRequestsJson?: Array<{
    uid: string;
    managerName: string;
    teamShortCode?: string;
    requestedAt: string;
  }>;
  pausedByUid?: string | null;
  pausedByName?: string | null;
  autoSimVotesJson?: Array<{
    uid: string;
    managerName: string;
    teamShortCode?: string;
    votedAt: string;
  }>;
  skipVotesJson?: Array<{
    uid: string;
    managerName: string;
    teamShortCode?: string;
    votedAt: string;
  }>;
  updatedAt: string;
}

export interface AuctionLot {
  id: number;
  auctionId: number;
  leagueId: number;
  playerId: number;
  lotOrder: number;
  basePrice: number;
  status: 'pending' | 'active' | 'sold' | 'unsold';
  soldPrice: number | null;
  winningTeamId: number | null;
}

export interface BidEntry {
  id: number;
  amount: number;
  teamId: number;
  teamName: string;
  teamShortCode: string;
  teamColor: string;
  userUid: string;
  createdAt: string;
}

export interface AuctionSnapshot {
  auction: Auction;
  currentLot: AuctionLot | null;
  currentPlayer: Player | null;
  recentBids: BidEntry[];
  counts: {
    total: number;
    pending: number;
    sold: number;
    unsold: number;
  };
  serverTime: number;
}

export interface LeagueChatMessage {
  id: number;
  leagueId: number;
  userUid: string;
  teamShortCode: string | null;
  body: string;
  messageType: 'chat' | 'system';
  createdAt: string;
  managerName?: string | null;
  avatarUrl?: string | null;
}

export interface LeagueNotification {
  id: number;
  leagueId: number;
  targetUid: string | null;
  category: string;
  title: string;
  body: string;
  readByUidsJson: string[];
  createdAt: string;
}

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

export interface LeagueFixture {
  id: number;
  leagueId: number;
  roundNumber: number;
  matchNumber: number;
  scheduledDay: number;
  stage: 'league' | 'qualifier1' | 'eliminator' | 'qualifier2' | 'final';
  homeTeamId: number;
  awayTeamId: number;
  format: 'T20' | 'ODI' | 'Test' | 'Hundred';
  venue: string;
  pitchCondition: string;
  status: 'scheduled' | 'lobby' | 'toss' | 'live' | 'paused' | 'completed';
  homeReady: boolean;
  awayReady: boolean;
  homeLineupIdsJson: number[];
  awayLineupIdsJson: number[];
  homeStrategy: 'Defensive' | 'Normal' | 'Aggressive' | 'Ultra-Attacking';
  awayStrategy: 'Defensive' | 'Normal' | 'Aggressive' | 'Ultra-Attacking';
  simPace: 'slow' | 'medium' | 'quick';
  tossWinnerTeamId: number | null;
  tossDecision: 'bat' | 'bowl' | null;
  coinResult: 'heads' | 'tails' | null;
  liveStateJson: PvpLiveMatchState | null;
  skipVotesJson?: Array<{
    uid: string;
    managerName: string;
    teamShortCode?: string;
    votedAt: string;
  }>;
  matchId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeagueStandingRow {
  teamId: number;
  teamName: string;
  shortCode: string;
  primaryColor: string;
  secondaryColor: string;
  templateKey: string | null;
  ownerUid: string | null;
  ownerName: string | null;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  nrr: number;
  runsFor: number;
  oversFor: number;
  runsAgainst: number;
  oversAgainst: number;
}

export interface LeagueNewsItem {
  id: number;
  leagueId: number;
  category: 'press' | 'upset' | 'injury' | 'training' | 'trade' | 'milestone';
  headline: string;
  summary: string;
  quote?: string | null;
  teamId?: number | null;
  teamName?: string | null;
  teamShortCode?: string | null;
  playerId?: number | null;
  playerName?: string | null;
  relatedMatchId?: number | null;
  createdAt: string;
}

export interface TradeOfferRecord {
  id: number;
  leagueId: number;
  proposerTeamId: number;
  recipientTeamId: number;
  proposerUid?: string | null;
  recipientUid?: string | null;
  offeredPlayerIdsJson: number[];
  requestedPlayerIdsJson: number[];
  cashDeltaLakhs: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  message: string;
  aiEvaluationNote?: string | null;
  isAiInitiated: boolean;
  createdAt: string;
  respondedAt?: string | null;
  proposerTeam?: { id: number; name: string; shortCode: string; ownerName?: string | null };
  recipientTeam?: { id: number; name: string; shortCode: string; ownerName?: string | null };
  offeredPlayers?: Player[];
  requestedPlayers?: Player[];
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

export interface KeyMomentChoice {
  id: string;
  label: string;
  detail: string;
  effectSummary: string;
  wicketMultDelta?: number;
  boundaryShiftDelta?: number;
  dotShiftDelta?: number;
  momentumShift?: number;
  promotePinchHitter?: boolean;
  bringStrikeBowler?: boolean;
}

export interface KeyMomentDilemma {
  id: string;
  title: string;
  situation: string;
  overLabel: string;
  choices: [KeyMomentChoice, KeyMomentChoice, KeyMomentChoice];
}

export interface LeagueStateSnapshot {
  league: League;
  members: LeagueMember[];
  teams: Team[];
  myTeam: Team | null;
  auctionSnapshot: AuctionSnapshot | null;
  messages: LeagueChatMessage[];
  notifications: LeagueNotification[];
  matches?: MatchRecord[];
  fixtures?: LeagueFixture[];
  standings?: LeagueStandingRow[];
  newsFeed?: LeagueNewsItem[];
  tradeOffers?: TradeOfferRecord[];
  currentGameDay?: number;
  nextDayInSec?: number;
  onlineUids: string[];
}

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

export interface MatchRecord {
  id: number;
  leagueId: number;
  homeTeamId: number;
  awayTeamId: number;
  format: 'T20' | 'ODI' | 'Test' | 'Hundred';
  competitionLabel: string;
  venue: string;
  pitchCondition: string;
  status: string;
  homeLineupIdsJson: number[];
  awayLineupIdsJson: number[];
  tossWinnerTeamId: number | null;
  tossDecision: 'bat' | 'bowl' | null;
  winnerTeamId: number | null;
  marginText: string;
  resultSummaryJson: MatchResultSummary | null;
  pressConferenceCompleted?: boolean;
  pressConferenceJson?: PressConferenceData | null;
  createdByUid: string;
  createdAt: string;
}

export interface MatchPreviewData {
  format: 'T20' | 'ODI' | 'Test' | 'Hundred';
  competitionLabel: string;
  venue: string;
  pitchCondition: string;
  homeTeam: Team;
  awayTeam: Team;
  homeSquadSource: 'contracted' | 'club_exhibition';
  awaySquadSource: 'contracted' | 'club_exhibition';
  homeXI: Player[];
  awayXI: Player[];
  homeSquadAll: Player[];
  homeRatings: { bat: number; bowl: number; field: number; overall: number };
  awayRatings: { bat: number; bowl: number; field: number; overall: number };
  winChance: { homePct: number; tiePct: number; awayPct: number };
  headToHead: {
    played: number;
    homeWins: number;
    awayWins: number;
    ties: number;
    recent: MatchRecord[];
  };
}

export interface FriendUserSummary {
  uid: string;
  email?: string;
  managerName: string;
  preferredName?: string;
  country: string;
  avatarUrl: string;
  coachExperience?: string;
  favoriteFormat?: string;
  reputation: number;
  isOnline: boolean;
}

export interface DirectMessageRecord {
  id: number;
  senderUid: string;
  recipientUid: string;
  body: string;
  inviteCode?: string | null;
  inviteLeagueName?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface FriendshipRecord {
  id: number;
  status: 'pending' | 'accepted';
  friend: FriendUserSummary;
  unreadCount?: number;
  lastMessage?: DirectMessageRecord | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DiscoverManagerEntry extends FriendUserSummary {
  relationStatus: 'none' | 'friends' | 'incoming_pending' | 'outgoing_pending';
  friendshipId: number | null;
}
