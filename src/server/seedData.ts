import {
  COACH_CATALOG,
  FRANCHISE_CATALOG,
  LEAGUE_CATEGORIES,
  MARQUEE_SET_ORDER,
  SCOUT_CATALOG,
  assignMarqueeSet,
  buildRealCricketPlayerPool,
  getHomeNationForCompetition,
  isPlayerEligibleForCompetition,
  shuffleAuctionPoolByMarqueeSet,
  type CoachCatalogEntry,
  type FranchiseCatalogEntry,
  type LeagueCategory,
  type MarqueeSetName,
  type RealPlayerRow,
  type ScoutCatalogEntry,
} from './realCricketData.ts';

export {
  COACH_CATALOG,
  FRANCHISE_CATALOG,
  LEAGUE_CATEGORIES,
  MARQUEE_SET_ORDER,
  SCOUT_CATALOG,
  assignMarqueeSet,
  buildRealCricketPlayerPool,
  getHomeNationForCompetition,
  isPlayerEligibleForCompetition,
  shuffleAuctionPoolByMarqueeSet,
};

export type {
  CoachCatalogEntry,
  FranchiseCatalogEntry,
  LeagueCategory,
  MarqueeSetName,
  RealPlayerRow,
  ScoutCatalogEntry,
};

// Backwards-compatible exports
export const FRANCHISE_TEMPLATES = FRANCHISE_CATALOG;

export function generateProceduralPlayers(
  leagueId: number,
  defaultBasePrice = 50,
  competition?: LeagueCategory | string
): RealPlayerRow[] {
  return buildRealCricketPlayerPool(leagueId, defaultBasePrice, competition);
}
