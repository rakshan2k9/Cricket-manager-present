import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  PlusCircle,
  Star,
  Trophy,
  Info,
} from 'lucide-react';
import type { LeagueStateSnapshot, Team } from '../types/game';
import { formatCurrencyLakhs, getFormatDisplayLabel, getLeagueFormats } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { TeamCrest } from '../components/TeamCrest';

const LEAGUE_TABS = [
  { id: 'IPL', label: 'Indian Premier League', format: 'T20' },
  { id: 'PSL', label: 'Pakistan Super League', format: 'T20' },
  { id: 'SA20', label: 'SA20', format: 'T20' },
  { id: 'BBL', label: 'Big Bash League', format: 'T20' },
  { id: 'The Hundred', label: 'The Hundred', format: '100-Ball' },
  { id: 'International', label: 'International', format: 'T20 · ODI · Test' },
];

export function FranchisesView({
  state,
  onRefresh,
  onInspectTeam,
  onToast,
}: {
  state: LeagueStateSnapshot;
  onRefresh: () => Promise<void>;
  onInspectTeam: (teamId: number) => void;
  onToast: (t: { type: 'success' | 'error' | 'info'; title: string; detail?: string }) => void;
}) {
  const { user, profile } = useAuth();
  const currency = profile?.preferredCurrency || 'INR';

  const availableTabs = useMemo(() => {
    const present = new Set(state.teams.map((t) => t.leagueCategory || 'IPL'));
    const filtered = LEAGUE_TABS.filter((tab) => present.has(tab.id));
    return filtered.length > 0 ? filtered : LEAGUE_TABS;
  }, [state.teams]);

  const initialCategory =
    state.myTeam?.leagueCategory || state.league.primaryCompetition || availableTabs[0]?.id || 'IPL';
  const [leagueIdx, setLeagueIdx] = useState(
    Math.max(0, availableTabs.findIndex((l) => l.id === initialCategory))
  );
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(
    state.myTeam?.id ?? state.teams[0]?.id ?? null
  );
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const [customName, setCustomName] = useState('');
  const [customShort, setCustomShort] = useState('');
  const [customGround, setCustomGround] = useState('');
  const [customColor, setCustomColor] = useState('#EAB308');
  const [creatingCustom, setCreatingCustom] = useState(false);

  const safeIdx = Math.min(leagueIdx, Math.max(0, availableTabs.length - 1));
  const activeTabMeta = availableTabs[safeIdx] || availableTabs[0];
  const activeCategory = activeTabMeta?.id || 'IPL';

  const teamsInCategory = useMemo(() => {
    const filtered = state.teams.filter(
      (t) => (t.leagueCategory || 'IPL') === activeCategory
    );
    return filtered.length > 0 ? filtered : state.teams;
  }, [state.teams, activeCategory]);

  const activeTeam: Team | null = useMemo(() => {
    const matchInCat = teamsInCategory.find((t) => t.id === selectedTeamId);
    return matchInCat || teamsInCategory[0] || state.teams[0] || null;
  }, [teamsInCategory, selectedTeamId, state.teams]);

  const stepLeague = (delta: -1 | 1) => {
    if (availableTabs.length <= 1) return;
    const nextIdx = (safeIdx + delta + availableTabs.length) % availableTabs.length;
    setLeagueIdx(nextIdx);
    const nextCat = availableTabs[nextIdx].id;
    const firstInCat = state.teams.find((t) => (t.leagueCategory || 'IPL') === nextCat);
    if (firstInCat) setSelectedTeamId(firstInCat.id);
  };

  const stepTeam = (delta: -1 | 1) => {
    if (teamsInCategory.length === 0 || !activeTeam) return;
    const idx = teamsInCategory.findIndex((t) => t.id === activeTeam.id);
    const next = teamsInCategory[(idx + delta + teamsInCategory.length) % teamsInCategory.length];
    setSelectedTeamId(next.id);
  };

  const handleClaim = async (team: Team) => {
    setClaimingId(team.id);
    try {
      await apiFetch(`/api/leagues/${state.league.id}/teams/claim`, {
        method: 'POST',
        body: JSON.stringify({ teamId: team.id }),
      });
      await onRefresh();
      onToast({
        type: 'success',
        title: `${team.name} Selected`,
        detail: `You are now managing ${team.name} (${team.leagueCategory}).`,
      });
    } catch (err: any) {
      onToast({ type: 'error', title: 'Cannot claim club', detail: err.message });
    } finally {
      setClaimingId(null);
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingCustom(true);
    try {
      const data = await apiFetch<{ team: Team }>(`/api/leagues/${state.league.id}/teams/custom`, {
        method: 'POST',
        body: JSON.stringify({
          name: customName,
          shortCode: customShort,
          homeGround: customGround,
          primaryColor: customColor,
        }),
      });
      setShowCustomForm(false);
      setCustomName('');
      setCustomShort('');
      setCustomGround('');
      await onRefresh();
      setSelectedTeamId(data.team.id);
      onToast({
        type: 'success',
        title: `Founded ${data.team.name}`,
        detail: `Custom franchise ${data.team.shortCode} entered ${state.league.name}.`,
      });
    } catch (err: any) {
      onToast({ type: 'error', title: 'Creation failed', detail: err.message });
    } finally {
      setCreatingCustom(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || showCustomForm) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepTeam(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepTeam(1);
      } else if (e.key === 'ArrowUp' && availableTabs.length > 1) {
        e.preventDefault();
        stepLeague(-1);
      } else if (e.key === 'ArrowDown' && availableTabs.length > 1) {
        e.preventDefault();
        stepLeague(1);
      } else if (e.key === 'Enter' && activeTeam && !activeTeam.ownerUid && claimingId !== activeTeam.id) {
        e.preventDefault();
        void handleClaim(activeTeam);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const starRating = activeTeam ? Math.min(5, Math.max(3, Math.round(activeTeam.reputation / 19))) : 4;
  const batScore = activeTeam ? Math.min(89, Math.round(58 + activeTeam.reputation * 0.3)) : 79;
  const bowlScore = activeTeam ? Math.min(88, Math.round(57 + activeTeam.reputation * 0.29)) : 77;
  const fieldScore = activeTeam ? Math.min(87, Math.round(56 + activeTeam.reputation * 0.28)) : 76;

  return (
    <div className="space-y-5 cm27-view-enter">
      {/* Header matching Reference Image 5 (SELECT TEAM) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-condensed text-4xl sm:text-5xl font-extrabold text-white uppercase tracking-tight">
            SELECT TEAM
          </h1>
          <div className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-widest text-slate-500 mt-1">
            <span>MANAGER</span>
            <span>PATH</span>
            <span className="text-[#93E6EE] border-b border-[#93E6EE] pb-0.5 font-semibold">
              CLUB
            </span>
            <span>CONTRACT</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {state.league.allowCustomTeams && (
            <button
              onClick={() => setShowCustomForm((v) => !v)}
              className="cm27-btn-dark-3d px-3.5 py-2 rounded text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#EAB308]" />
              <span>{showCustomForm ? 'Close Custom Club' : 'Create Custom Club'}</span>
            </button>
          )}
          <span className="w-8 h-8 rounded border border-white/15 bg-[#0C1016] flex items-center justify-center text-slate-300">
            <Info className="w-4 h-4" />
          </span>
        </div>
      </div>

      {/* Custom Franchise Modal / Panel */}
      {showCustomForm && (
        <form
          onSubmit={handleCreateCustom}
          className="cm27-panel p-5 border-[#EAB308]/35 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
        >
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
              Club / Franchise Name
            </label>
            <input
              type="text"
              required
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Bengaluru Mavericks"
              className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-xs text-white focus:outline-none focus:border-[#93E6EE]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
              Code (3-4)
            </label>
            <input
              type="text"
              required
              maxLength={4}
              value={customShort}
              onChange={(e) => setCustomShort(e.target.value.toUpperCase())}
              placeholder="BLR"
              className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-xs font-mono uppercase text-white focus:outline-none focus:border-[#93E6EE]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
              Home Ground
            </label>
            <input
              type="text"
              value={customGround}
              onChange={(e) => setCustomGround(e.target.value)}
              placeholder="Dynasty Oval"
              className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-xs text-white focus:outline-none focus:border-[#93E6EE]"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-10 h-9 rounded bg-transparent border border-white/15 cursor-pointer"
            />
            <button
              type="submit"
              disabled={creatingCustom}
              className="cm27-btn-3d flex-1 py-2 px-3 rounded font-bold text-xs cursor-pointer"
            >
              {creatingCustom ? 'Creating...' : 'Found Club'}
            </button>
          </div>
        </form>
      )}

      {/* League Selector Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        <div className="lg:col-span-5 cm27-card-focus flex items-center justify-between px-3 py-2 rounded border">
          <button
            onClick={() => stepLeague(-1)}
            disabled={availableTabs.length <= 1}
            className="cm27-btn-dark-3d w-7 h-7 rounded disabled:opacity-35 flex items-center justify-center text-slate-200 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-sm font-bold text-white tracking-wide">
            <span>{activeTabMeta?.label}</span>
            <span className="text-[11px] font-mono text-[#93E6EE] tabular-nums">
              {teamsInCategory.length} clubs · {activeTabMeta?.format}
            </span>
          </div>
          <button
            onClick={() => stepLeague(1)}
            disabled={availableTabs.length <= 1}
            className="cm27-btn-dark-3d w-7 h-7 rounded disabled:opacity-35 flex items-center justify-center text-slate-200 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Competition Chips */}
        <div className="lg:col-span-7 flex flex-wrap items-center gap-1.5">
          {availableTabs.map((lt, idx) => (
            <button
              key={lt.id}
              onClick={() => {
                setLeagueIdx(idx);
                const first = state.teams.find((t) => (t.leagueCategory || 'IPL') === lt.id);
                if (first) setSelectedTeamId(first.id);
              }}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                idx === safeIdx
                  ? 'cm27-card-focus text-white font-semibold'
                  : 'bg-[#12161E] border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {lt.id} ({lt.format})
            </button>
          ))}
        </div>
      </div>

      {/* Horizontal Team Switcher Strip for Active League */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {teamsInCategory.map((t) => {
          const isSelected = activeTeam?.id === t.id;
          const isMine = t.ownerUid === user?.uid;
          const isTaken = Boolean(t.ownerUid && t.ownerUid !== user?.uid);
          return (
            <button
              key={t.id}
              onClick={() => setSelectedTeamId(t.id)}
              className={`cm27-hover-sweep shrink-0 px-3 py-2 rounded border flex items-center gap-2.5 cursor-pointer transition-all ${
                isSelected
                  ? 'cm27-card-focus'
                  : 'bg-[#12161E] border-white/[0.08] hover:border-white/25'
              }`}
            >
              <TeamCrest
                templateKey={t.templateKey}
                shortCode={t.shortCode}
                primaryColor={t.primaryColor}
                secondaryColor={t.secondaryColor}
                size="xs"
              />
              <span className="text-xs font-semibold text-white whitespace-nowrap">{t.shortCode}</span>
              {isMine && (
                <span className="text-[9px] font-mono uppercase text-[#93E6EE]">YOU</span>
              )}
              {isTaken && (
                <span className="text-[9px] font-mono uppercase text-[#EAB308]">OWNED</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main 3-Column Team Showcase matching Reference Image 5 */}
      {activeTeam && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left Column: Team Crest, Stars & BAT/BOW/FIE */}
          <div className="lg:col-span-4 cm27-panel p-6 flex flex-col items-center justify-between text-center">
            <div className="w-full flex items-center justify-between">
              <button
                onClick={() => stepTeam(-1)}
                className="cm27-btn-dark-3d p-2 rounded text-slate-300 cursor-pointer"
                title="Previous Club (←)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#EAB308]">
                  {activeTeam.leagueCategory} ·{' '}
                  {getLeagueFormats(activeTeam.leagueCategory, state.league.primaryCompetition)
                    .map(getFormatDisplayLabel)
                    .join(' / ')}
                </div>
                <h2 className="font-condensed text-3xl font-extrabold text-white uppercase tracking-wide">
                  {activeTeam.name}
                </h2>
              </div>
              <button
                onClick={() => stepTeam(1)}
                className="cm27-btn-dark-3d p-2 rounded text-slate-300 cursor-pointer"
                title="Next Club (→)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Large TeamCrest SVG */}
            <div className="my-6 flex flex-col items-center gap-4">
              <div className="p-4 rounded cm27-panel-inset">
                <TeamCrest
                  templateKey={activeTeam.templateKey}
                  shortCode={activeTeam.shortCode}
                  primaryColor={activeTeam.primaryColor}
                  secondaryColor={activeTeam.secondaryColor}
                  size="xl"
                />
              </div>

              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`w-4 h-4 ${
                      n <= starRating ? 'text-[#EAB308] fill-[#EAB308]' : 'text-slate-600'
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-6 pt-1">
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">BAT</div>
                  <div className="font-condensed text-2xl font-bold text-white tabular-nums">
                    {batScore}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">BOW</div>
                  <div className="font-condensed text-2xl font-bold text-white tabular-nums">
                    {bowlScore}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">FIE</div>
                  <div className="font-condensed text-2xl font-bold text-white tabular-nums">
                    {fieldScore}
                  </div>
                </div>
              </div>
            </div>

            {/* Claim / Inspect Action */}
            <div className="w-full space-y-2 pt-3 border-t border-white/[0.07]">
              {activeTeam.ownerUid === user?.uid ? (
                <div className="cm27-card-focus flex items-center justify-center gap-2 py-2.5 rounded border text-[#93E6EE] text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Your Active Club</span>
                </div>
              ) : activeTeam.ownerUid ? (
                <button
                  onClick={() => onInspectTeam(activeTeam.id)}
                  className="cm27-btn-dark-3d w-full py-2.5 rounded text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  Managed by {activeTeam.ownerName} · View Squad
                </button>
              ) : (
                <button
                  onClick={() => handleClaim(activeTeam)}
                  disabled={claimingId === activeTeam.id}
                  className="cm27-btn-3d w-full py-3 rounded font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  {claimingId === activeTeam.id ? 'Claiming Club...' : `Select ${activeTeam.name}`}
                </button>
              )}
            </div>
          </div>

          {/* Center Column: FOUNDED YEAR, Trophy Cabinet, Board Value & Auction Budget matching Image 5 */}
          <div className="lg:col-span-5 cm27-panel p-6 flex flex-col justify-between">
            <div className="text-center space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-[0.26em] text-slate-400">
                FOUNDED
              </div>
              <div className="font-condensed text-5xl font-extrabold text-white tracking-tight tabular-nums">
                {activeTeam.foundedYear || 2008}
              </div>
              <div className="flex justify-center pt-1 text-slate-500">
                <Trophy className="w-5 h-5 text-[#EAB308]/75" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 my-8 text-center">
              <div>
                <div className="text-[11px] text-slate-400">Major Titles</div>
                <div className="font-condensed text-3xl font-bold text-white mt-1 tabular-nums">
                  {activeTeam.trophiesCount}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Reputation Index</div>
                <div className="font-condensed text-3xl font-bold text-[#EAB308] mt-1 tabular-nums">
                  {activeTeam.reputation}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Title Years</div>
                <div className="text-xs font-mono text-slate-200 mt-1.5">
                  {activeTeam.historicalTitlesJson?.length
                    ? activeTeam.historicalTitlesJson.slice(0, 5).join(' · ')
                    : 'Chasing Maiden Crown'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Head Coach</div>
                <div className="text-xs font-semibold text-[#93E6EE] mt-1.5">
                  {activeTeam.coachName}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.08] grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-[11px] text-slate-400">Board Value</div>
                <div className="font-condensed text-2xl font-extrabold text-white mt-0.5 tabular-nums">
                  {formatCurrencyLakhs(activeTeam.boardValue || 125000, currency)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Auction / Transfer Purse</div>
                <div className="font-condensed text-2xl font-extrabold text-[#4ADE80] mt-0.5 tabular-nums">
                  {formatCurrencyLakhs(activeTeam.remainingBudget, currency)}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Stadium Wireframe & Warm Amber-Orange Devotion / Facilities Cards matching Image 5 */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            {/* Stadium Card */}
            <div className="cm27-panel p-4 text-center space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-400">
                STADIUM NAME
              </div>
              <svg className="w-12 h-9 mx-auto text-slate-300" viewBox="0 0 64 44" fill="none">
                <path
                  d="M10 10 L10 38 H54 V10 L44 16 H20 Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <ellipse cx="32" cy="27" rx="14" ry="7" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
              </svg>
              <div className="text-xs font-bold uppercase tracking-wide text-white leading-snug">
                {activeTeam.homeGround}
              </div>
            </div>

            {/* Warm Amber-Orange Gradient Card 1: FANBASE DEVOTION */}
            <div className="flex-1 p-4 rounded bg-gradient-to-br from-[#9A3412]/80 via-[#7C2D12]/85 to-[#2B1207] border border-orange-400/25 flex flex-col justify-end">
              <div className="text-[10px] font-mono uppercase tracking-wider text-orange-100/80">
                FANBASE DEVOTION
              </div>
              <div className="font-condensed text-2xl font-extrabold text-white uppercase mt-0.5">
                {activeTeam.fanbaseDevotion || 'HIGH'}
              </div>
            </div>

            {/* Warm Amber-Orange Gradient Card 2: YOUTH FACILITIES */}
            <div className="flex-1 p-4 rounded bg-gradient-to-br from-[#9A3412]/80 via-[#7C2D12]/85 to-[#2B1207] border border-orange-400/25 flex flex-col justify-end">
              <div className="text-[10px] font-mono uppercase tracking-wider text-orange-100/80">
                YOUTH FACILITIES
              </div>
              <div className="font-condensed text-2xl font-extrabold text-white uppercase mt-0.5">
                {activeTeam.youthFacilities || 'VERY HIGH'}
              </div>
            </div>

            {/* Warm Amber-Orange Gradient Card 3: CLUB PHILOSOPHY */}
            <div className="flex-1 p-4 rounded bg-gradient-to-br from-[#9A3412]/80 via-[#7C2D12]/85 to-[#2B1207] border border-orange-400/25 flex flex-col justify-end">
              <div className="text-[10px] font-mono uppercase tracking-wider text-orange-100/80">
                CLUB PHILOSOPHY
              </div>
              <div className="text-sm font-bold text-white uppercase mt-0.5 leading-tight">
                {activeTeam.coachingSpecialty}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
