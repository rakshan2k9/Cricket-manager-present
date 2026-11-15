import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Calendar,
  ChevronDown,
  Coins,
  Compass,
  Flag,
  Gavel,
  LogOut,
  Play,
  Save,
  Trash2,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type { CurrencyCode, LeagueStateSnapshot, ManagerProfile, Player } from '../types/game';
import {
  AUTO_SIM_INTERVAL_OPTIONS,
  AVATAR_PRESETS,
  COACH_BACKGROUNDS,
  COACH_EXPERIENCES,
  COACHING_STYLES,
  COUNTRIES,
  CURRENCIES,
  DEFAULT_AUTO_SIM_INTERVAL_SEC,
  formatAutoSimIntervalLabel,
  MONTHS,
} from '../utils/format';
import { CountryFlag } from '../components/CountryFlag';
import { ManagerBadge } from '../components/ManagerBadge';
import { OfficeHubPanel } from '../components/OfficeHubPanel';
import { GameSettingsPanel } from '../components/GameSettingsPanel';
import type { ActiveTab } from '../components/AppShell';

export function ProfileSettingsView({
  leagueState,
  initialSection,
  onLeaveLeagueSuccess,
  onRefreshState,
  onOpenAuction,
  onNavigate,
  onInspectTeam,
  onToast,
  onBackToLobby,
}: {
  leagueState?: LeagueStateSnapshot | null;
  initialSection?: 'hub' | 'settings' | 'gameSettings';
  onLeaveLeagueSuccess?: () => void;
  onRefreshState?: () => Promise<void>;
  onOpenAuction?: () => void;
  onNavigate?: (tab: ActiveTab) => void;
  onInspectTeam?: (teamId: number) => void;
  onToast: (t: { tone: 'success' | 'error'; title: string; body?: string }) => void;
  onBackToLobby?: () => void;
}) {
  const { user, profile, setProfile, signOut } = useAuth();
  const [officeSection, setOfficeSection] = useState<'hub' | 'settings' | 'gameSettings'>(
    initialSection || (leagueState ? 'hub' : 'settings')
  );

  useEffect(() => {
    if (initialSection) {
      setOfficeSection(initialSection);
    }
  }, [initialSection]);
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);

  useEffect(() => {
    if (!leagueState) return;
    apiFetch<{ players: Player[] }>(
      `/api/leagues/${leagueState.league.id}/players?limit=5&sortBy=overall&sortDir=desc`
    )
      .then((res) => setTopPlayers(res.players || []))
      .catch(() => {});
  }, [leagueState?.league.id]);

  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [preferredName, setPreferredName] = useState(
    profile?.preferredName || profile?.managerName || ''
  );
  const [managerName, setManagerName] = useState(profile?.managerName || '');
  const [country, setCountry] = useState(profile?.country || 'India');
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode>(
    profile?.preferredCurrency || 'INR'
  );
  const [birthYear, setBirthYear] = useState(profile?.birthYear || 1993);
  const [birthMonth, setBirthMonth] = useState(profile?.birthMonth || 'MAY');
  const [birthDay, setBirthDay] = useState(profile?.birthDay || 7);
  const [coachExperience, setCoachExperience] = useState(
    profile?.coachExperience || COACH_EXPERIENCES[1]
  );
  const [coachBackground, setCoachBackground] = useState(
    profile?.coachBackground || COACH_BACKGROUNDS[0]
  );
  const [coachingStyle, setCoachingStyle] = useState(
    profile?.coachingStyle || COACHING_STYLES[0]
  );
  const [favoriteFormat, setFavoriteFormat] = useState<'T20' | 'ODI' | 'Test'>(
    profile?.favoriteFormat || 'T20'
  );
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || AVATAR_PRESETS[0].url);
  const [bio, setBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [startingAuction, setStartingAuction] = useState(false);

  const isHost = Boolean(
    leagueState &&
      (leagueState.league.myRole === 'host' || leagueState.league.hostUid === user?.uid)
  );
  const auctionStatus = leagueState?.auctionSnapshot?.auction.status;

  const [leagueAutoSimSec, setLeagueAutoSimSec] = useState<number>(
    leagueState?.league.dayDurationSec || DEFAULT_AUTO_SIM_INTERVAL_SEC
  );
  const [inactivitySimEnabled, setInactivitySimEnabled] = useState<boolean>(
    Boolean(leagueState?.league.inactivitySimEnabled ?? leagueState?.inactivitySimEnabled)
  );
  const [inactivityTimeoutSec, setInactivityTimeoutSec] = useState<number>(
    leagueState?.league.inactivityTimeoutSec ?? leagueState?.inactivityTimeoutSec ?? 86400
  );
  const [savingLeagueSettings, setSavingLeagueSettings] = useState(false);

  useEffect(() => {
    if (!leagueState) return;
    setLeagueAutoSimSec(leagueState.league.dayDurationSec || DEFAULT_AUTO_SIM_INTERVAL_SEC);
    setInactivitySimEnabled(
      Boolean(leagueState.league.inactivitySimEnabled ?? leagueState.inactivitySimEnabled)
    );
    setInactivityTimeoutSec(
      leagueState.league.inactivityTimeoutSec ?? leagueState.inactivityTimeoutSec ?? 86400
    );
  }, [
    leagueState?.league.id,
    leagueState?.league.dayDurationSec,
    leagueState?.league.inactivitySimEnabled,
    leagueState?.league.inactivityTimeoutSec,
  ]);

  const handleSaveLeagueAutoSim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueState || !isHost) return;
    setSavingLeagueSettings(true);
    try {
      await apiFetch(`/api/leagues/${leagueState.league.id}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          autoSimIntervalSec: leagueAutoSimSec,
          dayDurationSec: leagueAutoSimSec,
          inactivitySimEnabled,
          inactivityTimeoutSec,
        }),
      });
      await onRefreshState?.();
      onToast({
        tone: 'success',
        title: 'Auto-Simulation Settings Updated',
        body: `Global calendar interval set to ${formatAutoSimIntervalLabel(leagueAutoSimSec)}. Current league date & manager progress preserved.`,
      });
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Could Not Update League Settings', body: err.message });
    } finally {
      setSavingLeagueSettings(false);
    }
  };

  const displayPreview =
    preferredName.trim() ||
    managerName.trim() ||
    `${firstName} ${lastName}`.trim() ||
    'CM27 Manager';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const effectiveManagerName =
        managerName.trim() ||
        preferredName.trim() ||
        `${firstName} ${lastName}`.trim() ||
        'CM27 Manager';
      const data = await apiFetch<{ profile: ManagerProfile }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          managerName: effectiveManagerName,
          firstName,
          lastName,
          preferredName: preferredName || effectiveManagerName,
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
        }),
      });
      setProfile(data.profile);
      onToast({ tone: 'success', title: 'Manager Profile & Office Settings Saved' });
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Save Failed', body: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleStartAuctionFromOffice = async () => {
    if (!leagueState) return;
    setStartingAuction(true);
    try {
      await apiFetch(`/api/leagues/${leagueState.league.id}/auction/start`, {
        method: 'POST',
      });
      await onRefreshState?.();
      onToast({ tone: 'success', title: 'Live Player Auction Started!' });
      onOpenAuction?.();
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Cannot Start Auction', body: err.message });
    } finally {
      setStartingAuction(false);
    }
  };

  const handleLeaveLeague = async () => {
    if (!leagueState) return;
    setLeaving(true);
    try {
      await apiFetch(`/api/leagues/${leagueState.league.id}/leave`, {
        method: 'POST',
      });
      setShowLeaveConfirm(false);
      onToast({ tone: 'success', title: `Left ${leagueState.league.name}` });
      onLeaveLeagueSuccess?.();
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Could not leave league', body: err.message });
    } finally {
      setLeaving(false);
    }
  };

  const handleDeleteLeague = async () => {
    if (!leagueState) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/leagues/${leagueState.league.id}`, {
        method: 'DELETE',
      });
      setShowDeleteConfirm(false);
      onToast({ tone: 'success', title: `Deleted ${leagueState.league.name}` });
      onLeaveLeagueSuccess?.();
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Could not delete league', body: err.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className={
        officeSection === 'hub' || officeSection === 'gameSettings'
          ? 'space-y-6'
          : 'max-w-4xl space-y-6'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
        <div className="inline-flex items-center gap-1 p-1 rounded bg-[#0C1016] border border-white/[0.08]">
          {leagueState && (
            <button
              type="button"
              onClick={() => setOfficeSection('hub')}
              className={`px-4 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                officeSection === 'hub' ? 'cm27-btn-3d font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Office Hub
            </button>
          )}
          <button
            type="button"
            onClick={() => setOfficeSection('gameSettings')}
            className={`px-4 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              officeSection === 'gameSettings'
                ? 'cm27-btn-3d font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Game Settings
          </button>
          <button
            type="button"
            onClick={() => setOfficeSection('settings')}
            className={`px-4 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              officeSection === 'settings'
                ? 'cm27-btn-3d font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Manager &amp; League
          </button>
        </div>
        {onBackToLobby && (
          <button
            onClick={onBackToLobby}
            className="cm27-btn-dark-3d flex items-center gap-1.5 px-4 py-2 rounded text-xs text-slate-200 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        )}
      </div>

      {officeSection === 'gameSettings' ? (
        <GameSettingsPanel />
      ) : leagueState && officeSection === 'hub' ? (
        <OfficeHubPanel
          leagueState={leagueState}
          profile={profile}
          currency={preferredCurrency}
          topPlayers={topPlayers}
          onNavigate={onNavigate}
          onInspectTeam={onInspectTeam}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <ManagerBadge name={displayPreview} country={country} accent={avatarUrl} size="lg" />
              <div>
                <p className="text-xs font-condensed uppercase tracking-[0.2em] text-[#EAB308] font-bold">
                  FRONT OFFICE &amp; PASSPORT
                </p>
                <h1 className="text-3xl font-condensed font-bold uppercase tracking-tight text-white">
                  Manager Info &amp; Preferences
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
              </div>
            </div>
            {!leagueState && onBackToLobby && (
              <button
                onClick={onBackToLobby}
                className="cm27-btn-dark-3d flex items-center gap-1.5 px-4 py-2 rounded text-xs text-slate-200 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
          </div>

      {/* Host Commissioner Auction Control in Office */}
      {leagueState && isHost && auctionStatus === 'lobby' && (
        <div className="cm27-panel cm27-card-focus p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#1D2834] border border-[#93E6EE]/40 flex items-center justify-center shrink-0">
              <Gavel className="w-5 h-5 text-[#93E6EE]" />
            </div>
            <div>
              <div className="text-xs font-condensed uppercase tracking-wider text-[#93E6EE] font-bold">
                League Host Administration
              </div>
              <div className="text-sm font-semibold text-white">
                Player Auction is ready in Lobby
              </div>
              <p className="text-xs text-slate-300">
                Launch the live auction room for all managers in {leagueState.league.name}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStartAuctionFromOffice}
            disabled={startingAuction}
            className="cm27-btn-3d flex items-center gap-2 px-5 py-2.5 rounded disabled:opacity-50 font-bold text-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4 fill-current" />
            {startingAuction ? 'Starting Auction...' : 'Start Live Auction'}
          </button>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="cm27-panel p-6 space-y-5 shadow-xl"
      >
        <div>
          <label className="block text-xs font-condensed uppercase tracking-wider text-slate-400 mb-2">
            Manager Crest Theme
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset.url}
                type="button"
                onClick={() => setAvatarUrl(preset.url)}
                className={`cm27-hover-sweep flex items-center gap-3 p-2.5 rounded border text-left cursor-pointer transition-colors ${
                  avatarUrl === preset.url
                    ? 'cm27-card-focus text-white'
                    : 'bg-[#0C1016] border-white/[0.08] text-slate-400 hover:border-white/20'
                }`}
              >
                <ManagerBadge
                  name={displayPreview}
                  country={country}
                  accent={preset.url}
                  size="sm"
                />
                <span className="text-xs font-semibold">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
              <User className="w-3.5 h-3.5 text-[#93E6EE]/80" />
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-sm text-white focus:outline-none focus:border-[#93E6EE]"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
              <User className="w-3.5 h-3.5 text-[#93E6EE]/80" />
              Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-sm text-white focus:outline-none focus:border-[#93E6EE]"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
              <Award className="w-3.5 h-3.5 text-[#EAB308]/80" />
              Preferred Name
            </label>
            <input
              type="text"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-sm text-white focus:outline-none focus:border-[#93E6EE]"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
              <User className="w-3.5 h-3.5 text-[#93E6EE]/80" />
              Display Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-sm text-white focus:outline-none focus:border-[#93E6EE]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
              <Flag className="w-3.5 h-3.5 text-[#93E6EE]/80" />
              Nationality
            </label>
            <button
              type="button"
              onClick={() => setCountryOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 hover:border-white/30 text-sm text-white cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <CountryFlag country={country} size="sm" />
                <span>{country}</span>
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {countryOpen && (
              <div className="absolute left-0 right-0 mt-1.5 z-30 bg-[#12161E] border border-white/15 rounded shadow-2xl max-h-60 overflow-y-auto py-1">
                {COUNTRIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCountry(c);
                      setCountryOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center gap-2.5 cursor-pointer ${
                      country === c
                        ? 'bg-[#212A38] text-white'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <CountryFlag country={c} size="sm" />
                    <span>{c}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
              <Coins className="w-3.5 h-3.5 text-[#EAB308]/80" />
              Preferred Currency (Applies across Auctions &amp; Budgets)
            </label>
            <select
              value={preferredCurrency}
              onChange={(e) => setPreferredCurrency(e.target.value as CurrencyCode)}
              className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-sm text-white focus:outline-none focus:border-[#93E6EE] cursor-pointer"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#12161E]">
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Birth Year
            </label>
            <select
              value={birthYear}
              onChange={(e) => setBirthYear(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-sm text-white focus:outline-none focus:border-[#93E6EE]"
            >
              {Array.from({ length: 50 }, (_, i) => 2005 - i).map((yr) => (
                <option key={yr} value={yr} className="bg-[#12161E]">
                  {yr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Birth Month
            </label>
            <select
              value={birthMonth}
              onChange={(e) => setBirthMonth(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-sm text-white focus:outline-none focus:border-[#93E6EE]"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m} className="bg-[#12161E]">
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Birth Day
            </label>
            <select
              value={birthDay}
              onChange={(e) => setBirthDay(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-sm text-white focus:outline-none focus:border-[#93E6EE]"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d} className="bg-[#12161E]">
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
              <Award className="w-3.5 h-3.5 text-[#93E6EE]" />
              Coach Experience
            </label>
            <select
              value={coachExperience}
              onChange={(e) => setCoachExperience(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-[#93E6EE]/40 text-xs font-semibold text-[#93E6EE] focus:outline-none focus:border-[#93E6EE]"
            >
              {COACH_EXPERIENCES.map((exp) => (
                <option key={exp} value={exp} className="bg-[#12161E]">
                  {exp}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
              <Compass className="w-3.5 h-3.5 text-[#EAB308]" />
              Coach Background
            </label>
            <select
              value={coachBackground}
              onChange={(e) => setCoachBackground(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-xs text-white focus:outline-none focus:border-[#93E6EE]"
            >
              {COACH_BACKGROUNDS.map((bg) => (
                <option key={bg} value={bg} className="bg-[#12161E]">
                  {bg}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
              <Compass className="w-3.5 h-3.5 text-[#93E6EE]" />
              Coaching Style
            </label>
            <select
              value={coachingStyle}
              onChange={(e) => setCoachingStyle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-xs text-white focus:outline-none focus:border-[#93E6EE]"
            >
              {COACHING_STYLES.map((st) => (
                <option key={st} value={st} className="bg-[#12161E]">
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Primary Format Focus
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['T20', 'ODI', 'Test'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setFavoriteFormat(fmt)}
                className={`py-2 px-4 rounded border text-xs font-medium cursor-pointer transition-colors ${
                  favoriteFormat === fmt
                    ? 'cm27-btn-3d font-bold'
                    : 'bg-[#0C1016] border-white/15 text-slate-300 hover:border-white/25'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Management Philosophy &amp; Bio
          </label>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Outline your auction budget discipline, scouting focus, and dressing room standards..."
            className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-sm text-white resize-none focus:outline-none focus:border-[#93E6EE]"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <span className="text-xs text-slate-400 tabular-nums">
            Manager Reputation:{' '}
            <strong className="text-[#EAB308]">{profile?.reputation ?? 50}/100</strong>
          </span>
          <button
            type="submit"
            disabled={saving}
            className="cm27-btn-3d flex items-center gap-2 px-5 py-2.5 rounded font-bold text-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* League Auto-Simulation Settings */}
      {leagueState && (
        <form onSubmit={handleSaveLeagueAutoSim} className="cm27-panel p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#93E6EE] font-bold">
                LEAGUE SETTINGS · AUTO-SIMULATION SETTINGS
              </div>
              <h2 className="text-base font-semibold text-white mt-0.5">
                Real-World Auto-Simulation Interval
              </h2>
              <p className="text-xs text-slate-400">
                Server advances the Global League Day automatically on this schedule. Updating applies to future cycles without resetting the league date, completed matches, or individual manager progress.
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider border ${
                isHost
                  ? 'bg-[#93E6EE]/10 border-[#93E6EE]/35 text-[#93E6EE]'
                  : 'bg-white/[0.04] border-white/15 text-slate-400'
              }`}
            >
              {isHost ? 'Host Control' : 'Host-Only Setting'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="league-settings-autosim-interval"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Real-World Auto-Simulation Interval
              </label>
              <select
                id="league-settings-autosim-interval"
                value={leagueAutoSimSec}
                disabled={!isHost || savingLeagueSettings}
                onChange={(e) => setLeagueAutoSimSec(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-sm text-white focus:outline-none focus:border-[#93E6EE] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {AUTO_SIM_INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.seconds} value={opt.seconds} className="bg-[#12161E]">
                    {opt.label}{opt.seconds === DEFAULT_AUTO_SIM_INTERVAL_SEC ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="cm27-panel-inset p-3.5 space-y-2.5 rounded">
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Abandoned Fixture Inactivity Auto-Sim
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Optional rule: auto-simulate human fixtures only after extended inactivity. When off, missed human fixtures stay pending without stalling the league.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={inactivitySimEnabled}
                  disabled={!isHost || savingLeagueSettings}
                  onChange={(e) => setInactivitySimEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#93E6EE] mt-0.5 disabled:opacity-60"
                />
              </label>
              {inactivitySimEnabled && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06]">
                  <span className="text-[11px] text-slate-400">Inactivity Window</span>
                  <select
                    value={inactivityTimeoutSec}
                    disabled={!isHost || savingLeagueSettings}
                    onChange={(e) => setInactivityTimeoutSec(Number(e.target.value))}
                    className="px-2.5 py-1 rounded bg-[#0C0F14] border border-white/15 text-xs text-white focus:outline-none focus:border-[#93E6EE] disabled:opacity-60"
                  >
                    <option value={86400}>24 hours</option>
                    <option value={172800}>48 hours</option>
                    <option value={259200}>72 hours</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
            <span className="text-xs text-slate-400 tabular-nums">
              Active Global Day:{' '}
              <strong className="text-white">
                Day {leagueState.currentGameDay || leagueState.league.currentGameDay || 1}
              </strong>{' '}
              · Current Cycle:{' '}
              <strong className="text-[#93E6EE]">
                {formatAutoSimIntervalLabel(leagueState.league.dayDurationSec)}
              </strong>
            </span>
            {isHost && (
              <button
                type="submit"
                disabled={savingLeagueSettings}
                className="cm27-btn-3d flex items-center gap-2 px-5 py-2 rounded font-bold text-xs cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {savingLeagueSettings ? 'Applying...' : 'Save Auto-Sim Settings'}
              </button>
            )}
          </div>
        </form>
      )}

      {/* League & Session Actions */}
      <div className="cm27-panel p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">League &amp; Session Controls</h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {leagueState && (
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(true)}
                className="px-4 py-2 rounded bg-[#EAB308]/10 border border-[#EAB308]/35 text-[#EAB308] hover:bg-[#EAB308]/20 text-xs font-medium cursor-pointer"
              >
                Leave {leagueState.league.name}
              </button>
            )}
            {leagueState && isHost && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete League Permanently
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={signOut}
            className="cm27-btn-dark-3d flex items-center gap-2 px-4 py-2 rounded text-xs text-slate-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out of Account
          </button>
        </div>
      </div>

      {showLeaveConfirm && leagueState && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cm27-panel w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-[#EAB308]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-semibold text-white">
                Leave {leagueState.league.name}?
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Leaving releases ownership of your claimed club in this league. If you are the
              only remaining member, the league world will be closed.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="px-4 py-2 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveLeague}
                disabled={leaving}
                className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
              >
                {leaving ? 'Leaving...' : 'Confirm Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && leagueState && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cm27-panel border-rose-500/35 w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-base font-semibold text-white">
                Delete {leagueState.league.name}?
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently erase the league, all squads, auction history, and league chat
              for all managers. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteLeague}
                disabled={deleting}
                className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
