import type { CurrencyCode } from '../types/game';

export function formatCurrencyLakhs(lakhs: number, currency: CurrencyCode = 'INR'): string {
  if (currency === 'GBP') {
    const gbp = lakhs * 1000;
    if (gbp >= 1_000_000) return `£${(gbp / 1_000_000).toFixed(2)}M`;
    if (gbp >= 1_000) return `£${Math.round(gbp / 1_000)}K`;
    return `£${gbp.toLocaleString()}`;
  }
  if (currency === 'USD') {
    const usd = lakhs * 1200;
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`;
    return `$${usd.toLocaleString()}`;
  }
  if (currency === 'AUD') {
    const aud = lakhs * 1800;
    if (aud >= 1_000_000) return `A$${(aud / 1_000_000).toFixed(2)}M`;
    if (aud >= 1_000) return `A$${Math.round(aud / 1_000)}K`;
    return `A$${aud.toLocaleString()}`;
  }
  if (lakhs >= 100) {
    const cr = lakhs / 100;
    return `₹${Number.isInteger(cr) ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  }
  return `₹${lakhs} L`;
}

export function formatTimeAgo(isoDate: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(isoDate).toLocaleDateString();
}

export function formatClockTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const DEFAULT_AUTO_SIM_INTERVAL_SEC = 600;

export const AUTO_SIM_INTERVAL_OPTIONS: ReadonlyArray<{
  seconds: number;
  label: string;
  shortLabel: string;
}> = [
  { seconds: 300, label: '5 minutes', shortLabel: '5m' },
  { seconds: 600, label: '10 minutes', shortLabel: '10m' },
  { seconds: 900, label: '15 minutes', shortLabel: '15m' },
  { seconds: 1200, label: '20 minutes', shortLabel: '20m' },
  { seconds: 1800, label: '30 minutes', shortLabel: '30m' },
  { seconds: 3600, label: '1 hour', shortLabel: '1h' },
  { seconds: 7200, label: '2 hours', shortLabel: '2h' },
  { seconds: 21600, label: '6 hours', shortLabel: '6h' },
  { seconds: 43200, label: '12 hours', shortLabel: '12h' },
  { seconds: 86400, label: '24 hours', shortLabel: '24h' },
];

export const VALID_AUTO_SIM_INTERVAL_SET = new Set<number>(
  AUTO_SIM_INTERVAL_OPTIONS.map((opt) => opt.seconds)
);

export function isValidAutoSimIntervalSec(value: unknown): value is number {
  const num = Number(value);
  return Number.isInteger(num) && VALID_AUTO_SIM_INTERVAL_SET.has(num);
}

export function normalizeAutoSimIntervalSec(value: unknown): number {
  const num = Number(value);
  if (Number.isInteger(num) && VALID_AUTO_SIM_INTERVAL_SET.has(num)) return num;
  return DEFAULT_AUTO_SIM_INTERVAL_SEC;
}

export function formatAutoSimIntervalLabel(seconds?: number | null): string {
  const sec = Number(seconds || DEFAULT_AUTO_SIM_INTERVAL_SEC);
  const found = AUTO_SIM_INTERVAL_OPTIONS.find((opt) => opt.seconds === sec);
  if (found) return found.label;
  if (sec >= 3600) {
    const hrs = Math.round((sec / 3600) * 10) / 10;
    return `${hrs} hour${hrs === 1 ? '' : 's'}`;
  }
  const mins = Math.max(1, Math.round(sec / 60));
  return `${mins} minute${mins === 1 ? '' : 's'}`;
}

export function formatCountdownDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getPlayerFormDelta(p: {
  currentForm?: number;
  formDelta?: number;
}): number {
  if (typeof p.formDelta === 'number') {
    return Math.max(-4, Math.min(4, Math.round(p.formDelta)));
  }
  const form = typeof p.currentForm === 'number' ? p.currentForm : 70;
  return Math.max(-4, Math.min(4, Math.round((form - 70) / 8)));
}

export function getPlayerBaseOverall(p: {
  primaryRole: string;
  battingRating: number;
  bowlingRating: number;
}): number {
  const raw =
    p.primaryRole === 'All-Rounder'
      ? Math.round(
          Math.max(p.battingRating, p.bowlingRating) * 0.6 +
            Math.min(p.battingRating, p.bowlingRating) * 0.4 +
            2
        )
      : Math.max(p.battingRating, p.bowlingRating);
  return Math.max(48, Math.min(89, raw));
}

export function getPlayerOverall(p: {
  primaryRole: string;
  battingRating: number;
  bowlingRating: number;
  currentForm?: number;
  formDelta?: number;
}): number {
  const base = getPlayerBaseOverall(p);
  const delta = getPlayerFormDelta(p);
  return Math.max(48, Math.min(90, base + delta));
}

export function formatOvrWithDelta(p: {
  primaryRole: string;
  battingRating: number;
  bowlingRating: number;
  currentForm?: number;
  formDelta?: number;
}): { ovr: number; delta: number; label: string } {
  const ovr = getPlayerOverall(p);
  const delta = getPlayerFormDelta(p);
  const label = delta === 0 ? `${ovr}` : `${ovr}(${delta > 0 ? `+${delta}` : delta})`;
  return { ovr, delta, label };
}

export const COUNTRY_FLAGS: Record<string, string> = {
  India: '🇮🇳',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Australia: '🇦🇺',
  'South Africa': '🇿🇦',
  'New Zealand': '🇳🇿',
  Pakistan: '🇵🇰',
  'Sri Lanka': '🇱🇰',
  'West Indies': '🏝️',
  Bangladesh: '🇧🇩',
  Afghanistan: '🇦🇫',
  Ireland: '🇮🇪',
  Zimbabwe: '🇿🇼',
  Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  Netherlands: '🇳🇱',
  Nepal: '🇳🇵',
  'United States': '🇺🇸',
  'United Arab Emirates': '🇦🇪',
  Italy: '🇮🇹',
};

export function getCountryFlag(country: string): string {
  return COUNTRY_FLAGS[country] || '🏏';
}

export type MatchFormatCode = 'T20' | 'ODI' | 'Test' | 'Hundred';

export function getLeagueFormats(
  teamCategory?: string | null,
  primaryCompetition?: string | null
): MatchFormatCode[] {
  const scope = teamCategory || primaryCompetition || 'IPL';
  if (scope === 'International') return ['T20', 'ODI', 'Test'];
  if (scope === 'The Hundred') return ['Hundred'];
  return ['T20'];
}

export function getFormatDisplayLabel(fmt: string): string {
  if (fmt === 'Hundred') return '100-BALL';
  return fmt.toUpperCase();
}

export function getCompetitionDisplayLabel(comp?: string | null): string {
  switch (comp) {
    case 'IPL':
      return 'Indian Premier League';
    case 'PSL':
      return 'Pakistan Super League';
    case 'SA20':
      return 'SA20';
    case 'BBL':
      return 'Big Bash League';
    case 'The Hundred':
      return 'The Hundred';
    case 'International':
      return 'International Cricket';
    default:
      return comp || 'Indian Premier League';
  }
}

export const LEAGUE_COMPETITION_OPTIONS: Array<{
  id: 'IPL' | 'PSL' | 'SA20' | 'BBL' | 'The Hundred' | 'International';
  label: string;
  formatLabel: string;
  description: string;
}> = [
  {
    id: 'IPL',
    label: 'Indian Premier League',
    formatLabel: 'T20 Format',
    description: '10 IPL Franchises · Domestic Indian core & eligible overseas stars',
  },
  {
    id: 'PSL',
    label: 'Pakistan Super League',
    formatLabel: 'T20 Format',
    description: '6 PSL Franchises · Pakistan core & global T20 stars',
  },
  {
    id: 'SA20',
    label: 'SA20',
    formatLabel: 'T20 Format',
    description: '6 South African Franchises · Proteas core & overseas stars',
  },
  {
    id: 'BBL',
    label: 'Big Bash League',
    formatLabel: 'T20 Format',
    description: '8 Australian BBL Clubs · High-tempo T20 competition',
  },
  {
    id: 'The Hundred',
    label: 'The Hundred',
    formatLabel: '100-Ball Format',
    description: '8 ECB Franchises · 100-ball tactical format',
  },
  {
    id: 'International',
    label: 'International Cricket',
    formatLabel: 'T20 · ODI · Test',
    description: '10 Full Member Nations · Multi-format tours & Test series',
  },
];

export const AVATAR_PRESETS = [
  {
    label: 'Emerald Shield',
    url: 'crest:emerald',
  },
  {
    label: 'Amber Crown',
    url: 'crest:amber',
  },
  {
    label: 'Cyan Tactician',
    url: 'crest:cyan',
  },
];

export const COUNTRIES = [
  'India',
  'England',
  'Australia',
  'South Africa',
  'New Zealand',
  'Pakistan',
  'Sri Lanka',
  'West Indies',
  'Bangladesh',
  'Afghanistan',
  'Ireland',
  'Zimbabwe',
  'Scotland',
  'Netherlands',
  'United Arab Emirates',
  'United States',
];

export const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: 'INR', label: 'INDIAN RUPEE (₹ CR / L)' },
  { code: 'GBP', label: 'BRITISH POUND (£)' },
  { code: 'USD', label: 'US DOLLAR ($)' },
  { code: 'AUD', label: 'AUSTRALIAN DOLLAR (A$)' },
];

export const MONTHS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

export const COACH_EXPERIENCES = [
  'ROOKIE COACH',
  'REGIONAL EXPERIENCE',
  'NATIONAL PATHWAY',
  'ELITE RESUME',
];

export const COACH_BACKGROUNDS = [
  'TACTICAL ANALYST',
  'FORMER TEST CRICKETER',
  'FRANCHISE SCOUTING LEAD',
  'ACADEMY DEVELOPMENT DIRECTOR',
  'HIGH-PERFORMANCE STRATEGIST',
];

export const COACHING_STYLES = [
  'BALANCED TACTICAL',
  'POWERPLAY AGGRESSOR',
  'DATA & MATCHUP ANALYST',
  'YOUTH & CULTURE BUILDER',
  'SPIN & CONTAINMENT MASTER',
];
