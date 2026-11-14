import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  KeyRound,
  Copy,
  Check,
  ArrowRight,
  LogOut,
  Users,
  Settings,
  Home,
  Trophy,
  UserPlus,
  Database,
  Gavel,
  ClipboardList,
  Shield,
  Sparkles,
  User,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type { League } from '../types/game';
import {
  formatCurrencyLakhs,
  getCompetitionDisplayLabel,
  LEAGUE_COMPETITION_OPTIONS,
} from '../utils/format';
import { TeamCrest } from '../components/TeamCrest';
import { ManagerBadge } from '../components/ManagerBadge';
import { CountryFlag } from '../components/CountryFlag';
import type { useGlobalSocial } from '../hooks/useGlobalSocial';
import { GlobalFriendsView } from './GlobalFriendsView';

export type LobbyTab = 'home' | 'leagues' | 'friends' | 'profile' | 'settings';

export function LeagueLobbyView({
  initialTab = 'home',
  social,
  onSelectLeague,
  onOpenAccountSettings,
  onBackToTitle,
  onLeaguesUpdated,
  onToast,
}: {
  initialTab?: LobbyTab;
  social: ReturnType<typeof useGlobalSocial>;
  onSelectLeague: (leagueId: number) => void;
  onOpenAccountSettings: () => void;
  onBackToTitle?: () => void;
  onLeaguesUpdated?: () => void;
  onToast?: (t: { tone: 'info' | 'success' | 'warning' | 'error'; title: string; body?: string }) => void;
}) {
  const { user, profile, signOut } = useAuth();
  const currency = profile?.preferredCurrency || 'INR';
  const [activeTab, setActiveTab] = useState<LobbyTab>(initialTab);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Join form
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Create form modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [primaryCompetition, setPrimaryCompetition] = useState<
    'IPL' | 'PSL' | 'SA20' | 'BBL' | 'The Hundred' | 'International'
  >('IPL');
  const [competitionFormat, setCompetitionFormat] = useState('League');
  const [maxManagers, setMaxManagers] = useState(10);
  const [startingBudgetCr, setStartingBudgetCr] = useState(100);
  const [maxSquadSize, setMaxSquadSize] = useState(25);
  const [maxOverseas, setMaxOverseas] = useState(8);
  const [defaultBasePrice, setDefaultBasePrice] = useState(50);
  const [bidIncrement, setBidIncrement] = useState(25);
  const [auctionDurationSec, setAuctionDurationSec] = useState(20);
  const [allowCustomTeams, setAllowCustomTeams] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Local UI preferences inside lobby Settings tab
  const [liveBidAlerts, setLiveBidAlerts] = useState(true);
  const [compactTables, setCompactTables] = useState(false);

  // Delete league modal
  const [leagueToDelete, setLeagueToDelete] = useState<League | null>(null);
  const [deletingLeague, setDeletingLeague] = useState(false);

  const loadLeagues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ leagues: League[] }>('/api/leagues');
      setLeagues(data.leagues);
    } catch (err: any) {
      setError(err.message || 'Failed to load leagues.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeagues();
  }, [loadLeagues]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setJoining(true);
    try {
      const data = await apiFetch<{ league: League }>('/api/leagues/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      });
      setInviteCode('');
      onLeaguesUpdated?.();
      onSelectLeague(data.league.id);
    } catch (err: any) {
      setJoinError(err.message || 'Could not join league.');
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteLeague = async () => {
    if (!leagueToDelete) return;
    setDeletingLeague(true);
    try {
      await apiFetch(`/api/leagues/${leagueToDelete.id}`, { method: 'DELETE' });
      onToast?.({ tone: 'success', title: `Deleted ${leagueToDelete.name}` });
      setLeagueToDelete(null);
      await loadLeagues();
      onLeaguesUpdated?.();
    } catch (err: any) {
      onToast?.({ tone: 'error', title: 'Delete Failed', body: err.message });
    } finally {
      setDeletingLeague(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const data = await apiFetch<{ league: League }>('/api/leagues', {
        method: 'POST',
        body: JSON.stringify({
          name,
          primaryCompetition,
          competitionFormat,
          maxManagers,
          allowCustomTeams,
          startingBudget: startingBudgetCr * 100,
          maxSquadSize,
          maxOverseas,
          defaultBasePrice,
          bidIncrement,
          auctionDurationSec,
        }),
      });
      setShowCreateModal(false);
      onLeaguesUpdated?.();
      onSelectLeague(data.league.id);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create league.');
    } finally {
      setCreating(false);
    }
  };

  const onlineFriendsCount = social.friends.accepted.filter((f) => f.friend.isOnline).length;
  const friendsBadge = social.friends.incoming.length + social.friends.totalUnread;
  const primaryLeague = leagues[0] || null;

  const lobbyNav: Array<{ id: LobbyTab; label: string; icon: React.ComponentType<any>; badge?: number }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'leagues', label: 'Leagues', icon: Trophy },
    { id: 'friends', label: 'Friends', icon: Users, badge: friendsBadge > 0 ? friendsBadge : undefined },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const stepLobbyTab = (delta: -1 | 1) => {
    const idx = lobbyNav.findIndex((n) => n.id === activeTab);
    const nextIdx = (idx + delta + lobbyNav.length) % lobbyNav.length;
    setActiveTab(lobbyNav[nextIdx].id);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'q' || e.key === 'Q') stepLobbyTab(-1);
      if (e.key === 'e' || e.key === 'E') stepLobbyTab(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col">
      {/* Top CM27 Home Hub Navigation Bar matching Reference Image 3 */}
      <header className="border-b border-white/[0.08] bg-[#0D1016]/92 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            {onBackToTitle && (
              <button
                onClick={onBackToTitle}
                className="cm27-btn-dark-3d p-1.5 rounded text-slate-300 hover:text-white cursor-pointer"
                title="Back to CM27 Title Menu"
                aria-label="Back to CM27 Title Menu"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-baseline gap-0.5">
              <span className="font-condensed text-[26px] font-extrabold tracking-tight text-white leading-none">
                CM
              </span>
              <span className="font-condensed text-[26px] font-extrabold tracking-tight text-[#EAB308] leading-none">
                27
              </span>
            </div>
          </div>

          {/* Center: Hub Label + [Q] + Clean Underlined Tabs + [E] */}
          <nav className="flex items-center gap-1 overflow-x-auto">
            <span className="hidden md:inline text-xs font-semibold text-white whitespace-nowrap shrink-0 mr-1.5">
              Central Hub
            </span>
            <button
              onClick={() => stepLobbyTab(-1)}
              className="hidden sm:flex cm27-keycap mr-1.5 cursor-pointer shrink-0 hover:border-white/40 hover:text-white transition-colors"
              title="Previous Tab (Q)"
            >
              Q
            </button>

            {lobbyNav.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-3.5 py-4 text-[13px] font-semibold tracking-wide flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.badge ? (
                    <span className="px-1.5 py-0.5 rounded bg-[#EAB308] text-[#05140B] text-[10px] font-mono font-bold leading-none tabular-nums">
                      {tab.badge}
                    </span>
                  ) : null}
                  {active && (
                    <span className="absolute left-2.5 right-2.5 bottom-2 h-[2px] bg-white" />
                  )}
                </button>
              );
            })}

            <button
              onClick={() => stepLobbyTab(1)}
              className="hidden sm:flex cm27-keycap ml-1.5 cursor-pointer shrink-0 hover:border-white/40 hover:text-white transition-colors"
              title="Next Tab (E)"
            >
              E
            </button>
          </nav>

          {/* Right: Flag/Crest + Name + Tri-color Confidence Bar + S1 matching Reference Image 3 */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenAccountSettings}
              className="hidden sm:flex items-center gap-2.5 px-2 py-1 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer text-left shrink-0"
              title="Manager Profile & Currency"
            >
              <ManagerBadge
                name={profile?.preferredName || profile?.managerName}
                country={profile?.country}
                accent={profile?.avatarUrl}
                size="sm"
              />
              <div className="min-w-[96px]">
                <div className="text-[13px] font-semibold text-white truncate max-w-[115px] leading-tight">
                  {profile?.preferredName || profile?.managerName}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="relative h-[4px] w-20 bg-white/10 rounded-full overflow-visible">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#EF4444] via-[#EAB308] to-[#22C55E]"
                      style={{ width: `${Math.min(100, Math.max(35, profile?.reputation || 75))}%` }}
                    />
                    <span
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]"
                      style={{ left: `calc(${Math.min(100, Math.max(35, profile?.reputation || 75))}% - 4px)` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-300">S1</span>
                </div>
              </div>
            </button>

            <button
              onClick={signOut}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1480px] mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'home' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* LEFT COLUMN: Quick Actions, Join League & Manager Card */}
            <div className="xl:col-span-4 space-y-4">
              {/* Manager Operations Passport */}
              <div className="cm27-panel p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <ManagerBadge
                      name={profile?.preferredName || profile?.managerName}
                      country={profile?.country}
                      accent={profile?.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#EAB308]">
                        Active Manager
                      </div>
                      <h2 className="text-lg font-condensed font-bold text-white truncate uppercase">
                        {profile?.preferredName || profile?.managerName}
                      </h2>
                      <div className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                        <CountryFlag country={profile?.country || 'India'} size="xs" />
                        <span>
                          {profile?.country} ·{' '}
                          {profile?.coachExperience || 'REGIONAL EXPERIENCE'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onOpenAccountSettings}
                    className="cm27-btn-dark-3d p-2 rounded text-slate-300 hover:text-white cursor-pointer"
                    title="Edit Manager Profile"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06] text-center">
                  <div className="cm27-panel-inset p-2">
                    <div className="text-[10px] text-slate-400">Leagues</div>
                    <div className="text-base font-mono font-bold text-white tabular-nums">
                      {leagues.length}
                    </div>
                  </div>
                  <div className="cm27-panel-inset p-2">
                    <div className="text-[10px] text-slate-400">Friends On</div>
                    <div className="text-base font-mono font-bold text-[#4ADE80] tabular-nums">
                      {onlineFriendsCount}
                    </div>
                  </div>
                  <div className="cm27-panel-inset p-2">
                    <div className="text-[10px] text-slate-400">Rep</div>
                    <div className="text-base font-mono font-bold text-[#EAB308] tabular-nums">
                      {profile?.reputation ?? 50}
                    </div>
                  </div>
                </div>
              </div>

              {/* Join League by Code */}
              <div className="cm27-panel p-5">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <KeyRound className="w-4 h-4 text-[#93E6EE]" />
                  Join a Friend&apos;s League
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Enter a 6-character invitation code to enter a multiplayer game world.
                </p>

                <form onSubmit={handleJoin} className="mt-3.5 space-y-3">
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="ENTER CODE (E.G. K7X9MP)"
                    className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-xs font-mono tracking-widest text-white uppercase placeholder-slate-500 focus:outline-none focus:border-[#93E6EE]"
                  />
                  {joinError && <p className="text-xs text-rose-400">{joinError}</p>}
                  <button
                    type="submit"
                    disabled={joining || !inviteCode.trim()}
                    className="cm27-btn-dark-3d w-full py-2.5 px-4 rounded text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                  >
                    {joining ? 'Joining League...' : 'Join League'}
                  </button>
                </form>
              </div>

              {/* Quick Game Destinations */}
              <div className="cm27-panel p-5 space-y-2.5">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Home Menu Shortcuts
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="cm27-btn-3d w-full flex items-center justify-between px-3.5 py-2.5 rounded text-xs font-bold cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create New Private League
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setActiveTab('friends')}
                  className="cm27-btn-dark-3d w-full flex items-center justify-between px-3.5 py-2.5 rounded text-xs text-slate-200 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#93E6EE]" />
                    Friends &amp; Invite Center
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="cm27-btn-dark-3d w-full flex items-center justify-between px-3.5 py-2.5 rounded text-xs text-slate-200 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#EAB308]" />
                    Game &amp; Account Settings
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* CENTER & RIGHT COLUMNS: Featured Banner + Active Worlds + Game Mode Cards */}
            <div className="xl:col-span-8 space-y-5">
              {/* Featured CM27 Banner */}
              <div className="relative cm27-panel overflow-hidden">
                <img
                  src="/src/assets/images/stadium_hero_1794579233002.jpg"
                  alt="CM27 Operations"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
                <div className="relative z-10 p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 bg-gradient-to-r from-[#0C0F14]/95 via-[#11151C]/85 to-transparent">
                  <div className="max-w-xl">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#EAB308] uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      Cricket Manager 27 · Multiplayer Headquarters
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-condensed font-bold text-white uppercase tracking-tight mt-1">
                      Command Your Global Dynasty
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                      Create dedicated worlds across IPL, PSL, SA20, Big Bash League, The Hundred,
                      and Internationals — with competition-exclusive clubs, eligible real players,
                      live randomized marquee auctions, and competitive AI rivals.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3 shrink-0">
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="cm27-btn-3d flex items-center gap-2 px-5 py-2.5 rounded font-bold text-xs cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      Create League
                    </button>
                    {primaryLeague && (
                      <button
                        onClick={() => onSelectLeague(primaryLeague.id)}
                        className="cm27-btn-dark-3d flex items-center gap-2 px-5 py-2.5 rounded text-white font-semibold text-xs cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Resume {primaryLeague.name}
                        <ArrowRight className="w-4 h-4 text-[#93E6EE]" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 4 Simulation Pillars Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="cm27-hover-sweep cm27-panel p-4">
                  <Gavel className="w-4 h-4 text-[#EAB308]" />
                  <div className="text-xs font-semibold text-white mt-2">Live Auctions</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Server-locked clocks &amp; anti-snipe extensions
                  </div>
                </div>
                <div className="cm27-hover-sweep cm27-panel p-4">
                  <Database className="w-4 h-4 text-[#93E6EE]" />
                  <div className="text-xs font-semibold text-white mt-2">Authentic Real Stars</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    IPL, PSL, SA20, BBL, The Hundred &amp; Int&apos;l
                  </div>
                </div>
                <div className="cm27-hover-sweep cm27-panel p-4">
                  <ClipboardList className="w-4 h-4 text-[#93E6EE]" />
                  <div className="text-xs font-semibold text-white mt-2">Coaches &amp; Scouts</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Hire Fleming, Dravid &amp; global scouting leads
                  </div>
                </div>
                <div className="cm27-hover-sweep cm27-panel p-4">
                  <Shield className="w-4 h-4 text-[#EAB308]" />
                  <div className="text-xs font-semibold text-white mt-2">6 Global Competitions</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Dedicated franchises, AI clubs &amp; custom builder
                  </div>
                </div>
              </div>

              {/* Active Leagues List */}
              <div className="cm27-panel overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#0B0F15] flex items-center justify-between">
                  <h2 className="text-base font-condensed font-bold uppercase tracking-wide text-white">
                    Your Active Multiplayer Leagues
                  </h2>
                  <button
                    onClick={() => setActiveTab('leagues')}
                    className="text-xs font-mono text-[#93E6EE] hover:text-white cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Manage All ({leagues.length}) →
                  </button>
                </div>

                {error && (
                  <div className="m-4 p-3 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                    {error}
                  </div>
                )}

                {loading ? (
                  <div className="p-5 space-y-3">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-20 rounded bg-[#0C1016] border border-white/[0.06]"
                      />
                    ))}
                  </div>
                ) : leagues.length === 0 ? (
                  <div className="p-10 text-center">
                    <Users className="w-8 h-8 text-[#EAB308]/80 mx-auto" />
                    <h3 className="text-base font-semibold text-white mt-3">
                      No active leagues yet
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Create your first private league or enter a friend&apos;s invite code on the
                      left to enter the CM27 command center.
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="cm27-btn-3d mt-4 px-5 py-2 rounded font-bold text-xs cursor-pointer"
                    >
                      Launch First League
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {leagues.map((league) => (
                      <div
                        key={league.id}
                        className="cm27-hover-sweep p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          {league.myTeam ? (
                            <TeamCrest
                              templateKey={league.myTeam.templateKey}
                              shortCode={league.myTeam.shortCode}
                              primaryColor={league.myTeam.primaryColor}
                              secondaryColor={league.myTeam.secondaryColor}
                              size="md"
                              className="shrink-0 mt-0.5"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-[#070B0D] border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Trophy className="w-4 h-4 text-[#EAB308]" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#EAB308]">
                              <span>
                                {getCompetitionDisplayLabel(league.primaryCompetition)} ·{' '}
                                {league.competitionFormat}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="uppercase text-[#4ADE80]">
                                {league.status === 'auction'
                                  ? 'Auction Live'
                                  : league.status === 'active'
                                    ? 'Post-Auction'
                                    : 'Lobby Setup'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-400">
                                {league.myRole === 'host' ? 'Host' : 'Manager'}
                              </span>
                            </div>

                            <h3 className="text-lg font-semibold text-white mt-0.5 truncate">
                              {league.name}
                            </h3>

                            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-300">
                              <span className="font-mono tabular-nums">
                                Managers: {league.memberCount}/{league.maxManagers}
                              </span>
                              <span className="font-mono tabular-nums text-[#4ADE80]">
                                {league.onlineCount || 0} online
                              </span>
                              <span>
                                Club:{' '}
                                <strong className="text-white">
                                  {league.myTeam
                                    ? `${league.myTeam.name} (${league.myTeam.shortCode})`
                                    : 'Unclaimed'}
                                </strong>
                              </span>
                              <span className="font-mono tabular-nums text-slate-400">
                                Purse: {formatCurrencyLakhs(league.startingBudget, currency)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <button
                            onClick={() => handleCopyCode(league.inviteCode)}
                            className="cm27-btn-dark-3d flex items-center gap-1.5 px-3 py-2 rounded text-xs font-mono text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                            title="Copy invite code"
                          >
                            {copiedCode === league.inviteCode ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>{league.inviteCode}</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => onSelectLeague(league.id)}
                            className="cm27-btn-3d flex items-center gap-1.5 px-4 py-2 rounded font-bold text-xs cursor-pointer whitespace-nowrap shrink-0"
                          >
                            Enter HQ
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          {(league.myRole === 'host' || league.hostUid === user?.uid) && (
                            <button
                              onClick={() => setLeagueToDelete(league)}
                              className="p-2 rounded bg-[#0C1016] border border-rose-500/25 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 transition-colors cursor-pointer"
                              title="Delete League"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leagues' && (
          <div className="space-y-5 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-condensed font-bold uppercase text-white">
                  All Multiplayer Leagues
                </h1>
                <p className="text-xs text-slate-400">
                  Every league seeds its competition&apos;s authentic clubs, eligible player auction pool, and competitive AI-managed rivals
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="cm27-btn-3d flex items-center gap-2 px-4 py-2 rounded font-bold text-xs cursor-pointer self-start whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                Create Private League
              </button>
            </div>

            {leagues.length === 0 ? (
              <div className="cm27-panel p-10 text-center text-xs text-slate-400">
                No leagues joined yet. Create one or switch to Home to join by invite code.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {leagues.map((league) => (
                  <div
                    key={league.id}
                    className="cm27-hover-sweep cm27-panel hover:border-[#93E6EE]/45 p-5 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs font-mono text-[#EAB308]">
                        <span>{getCompetitionDisplayLabel(league.primaryCompetition)}</span>
                        <span className="text-[#93E6EE]">Code: {league.inviteCode}</span>
                      </div>
                      <h3 className="text-lg font-semibold text-white mt-1">{league.name}</h3>
                      <div className="mt-2 text-xs text-slate-400 space-y-1">
                        <div>
                          Managers: {league.memberCount}/{league.maxManagers} (
                          {league.onlineCount || 0} online)
                        </div>
                        <div className="flex items-center gap-2">
                          <span>My Club:</span>
                          {league.myTeam ? (
                            <span className="inline-flex items-center gap-1.5 text-white font-medium">
                              <TeamCrest
                                templateKey={league.myTeam.templateKey}
                                shortCode={league.myTeam.shortCode}
                                primaryColor={league.myTeam.primaryColor}
                                secondaryColor={league.myTeam.secondaryColor}
                                size="xs"
                              />
                              {league.myTeam.name}
                            </span>
                          ) : (
                            <span className="text-slate-500">Unclaimed</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectLeague(league.id)}
                        className="cm27-btn-3d flex-1 py-2 rounded font-bold text-xs cursor-pointer"
                      >
                        Enter League HQ
                      </button>
                      {(league.myRole === 'host' || league.hostUid === user?.uid) && (
                        <button
                          onClick={() => setLeagueToDelete(league)}
                          className="p-2 rounded bg-[#0C1016] border border-rose-500/30 text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                          title="Delete League Permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="max-w-6xl mx-auto">
            <GlobalFriendsView
              social={social}
              leagues={leagues}
              onJoinedLeague={(leagueId) => {
                loadLeagues();
                onLeaguesUpdated?.();
                onSelectLeague(leagueId);
              }}
              onToast={onToast}
            />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto cm27-panel p-6 space-y-5">
            <div className="flex items-center gap-4">
              <ManagerBadge
                name={profile?.preferredName || profile?.managerName}
                country={profile?.country}
                accent={profile?.avatarUrl}
                size="lg"
              />
              <div>
                <h1 className="text-2xl font-condensed font-bold uppercase text-white">
                  {profile?.preferredName || profile?.managerName}
                </h1>
                <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>{user?.email}</span>
                  <span>·</span>
                  <CountryFlag country={profile?.country || 'India'} size="xs" />
                  <span>
                    {profile?.country} · {profile?.coachExperience || 'REGIONAL EXPERIENCE'} ·{' '}
                    {currency}
                  </span>
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-300 cm27-panel-inset p-4">
              {profile?.bio || 'No management philosophy statement configured yet.'}
            </p>
            <button
              onClick={onOpenAccountSettings}
              className="cm27-btn-3d px-5 py-2.5 rounded font-bold text-xs cursor-pointer"
            >
              Edit Manager Profile &amp; Currency
            </button>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto cm27-panel p-6 space-y-5">
            <div>
              <h1 className="text-2xl font-condensed font-bold uppercase text-white">
                CM27 Game &amp; Account Settings
              </h1>
              <p className="text-xs text-slate-400">
                Customize client preferences or manage your manager profile
              </p>
            </div>

            <div className="space-y-3">
              <label className="cm27-panel-inset flex items-center justify-between p-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-white">Real-Time Bid Alerts</div>
                  <div className="text-xs text-slate-400">
                    Show live toast dispatches when rival managers outbid or sign players
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={liveBidAlerts}
                  onChange={(e) => setLiveBidAlerts(e.target.checked)}
                  className="w-4 h-4 accent-[#93E6EE]"
                />
              </label>

              <label className="cm27-panel-inset flex items-center justify-between p-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-white">High-Density Scouting Tables</div>
                  <div className="text-xs text-slate-400">
                    Prefer compact tabular rows across Player DB and Standings
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={compactTables}
                  onChange={(e) => setCompactTables(e.target.checked)}
                  className="w-4 h-4 accent-[#93E6EE]"
                />
              </label>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
              <button
                onClick={onOpenAccountSettings}
                className="cm27-btn-dark-3d px-4 py-2 rounded text-xs font-semibold text-white cursor-pointer"
              >
                Open Full Profile Editor
              </button>
              <button
                onClick={signOut}
                className="px-4 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-400 hover:bg-rose-500/20 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom CM27 Status Strip */}
      <footer className="border-t border-white/[0.08] bg-[#0D1016] py-2 px-4 sm:px-6 text-[11px] text-slate-400">
        <div className="max-w-[1480px] mx-auto flex items-center justify-between">
          <span>Cricket Manager 27 (CM27) · Main Hub</span>
          <span className="font-mono text-slate-400">Season 1 · {leagues.length} Leagues</span>
        </div>
      </footer>

      {/* Create Private League Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="cm27-panel w-full max-w-2xl overflow-hidden shadow-2xl my-auto">
            <div className="px-6 py-4 border-b border-white/[0.08] bg-[#0B0F15] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-condensed uppercase tracking-wide font-bold text-white">
                  Create Private Multiplayer League
                </h2>
                <p className="text-xs text-slate-400">
                  Seeds the selected competition&apos;s clubs across IPL, PSL, SA20, BBL, The Hundred, or Internationals with eligible players and live auction room
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              {createError && (
                <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Select Competition &amp; Match Format
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {LEAGUE_COMPETITION_OPTIONS.map((opt) => {
                    const active = primaryCompetition === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPrimaryCompetition(opt.id)}
                        className={`p-3 rounded border text-left cursor-pointer transition-all ${
                          active
                            ? 'cm27-card-focus'
                            : 'bg-[#0C1016] border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white">{opt.label}</span>
                          <span
                            className={`text-[10px] font-mono ${
                              active ? 'text-[#93E6EE]' : 'text-[#EAB308]'
                            }`}
                          >
                            {opt.formatLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{opt.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    League Name
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={50}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. CM27 Premier Cup"
                    className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-sm text-white focus:outline-none focus:border-[#93E6EE]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Tournament Structure
                  </label>
                  <select
                    value={competitionFormat}
                    onChange={(e) => setCompetitionFormat(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-sm text-white focus:outline-none focus:border-[#93E6EE]"
                  >
                    <option value="League">League + Playoffs</option>
                    <option value="Round-Robin">Full Round-Robin</option>
                    <option value="Group + Playoffs">Group Stage + Semi-Finals</option>
                    <option value="Knockout">Knockout Cup</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Max Managers
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={12}
                    value={maxManagers}
                    onChange={(e) => setMaxManagers(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-sm font-mono text-white focus:outline-none focus:border-[#93E6EE]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Starting Purse (Cr)
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={250}
                    value={startingBudgetCr}
                    onChange={(e) => setStartingBudgetCr(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-sm font-mono text-white focus:outline-none focus:border-[#93E6EE]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Max Squad Size (22+ Min)
                  </label>
                  <input
                    type="number"
                    min={22}
                    max={30}
                    value={maxSquadSize}
                    onChange={(e) => setMaxSquadSize(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-sm font-mono text-white focus:outline-none focus:border-[#93E6EE]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Max Overseas
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={11}
                    value={maxOverseas}
                    onChange={(e) => setMaxOverseas(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-sm font-mono text-white focus:outline-none focus:border-[#93E6EE]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Bid Increment (Lakhs)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={200}
                    step={5}
                    value={bidIncrement}
                    onChange={(e) => setBidIncrement(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-sm font-mono text-white focus:outline-none focus:border-[#93E6EE]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Lot Timer (Sec)
                  </label>
                  <input
                    type="number"
                    min={8}
                    max={60}
                    value={auctionDurationSec}
                    onChange={(e) => setAuctionDurationSec(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-sm font-mono text-white focus:outline-none focus:border-[#93E6EE]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Default Base Price (Lakhs)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    step={10}
                    value={defaultBasePrice}
                    onChange={(e) => setDefaultBasePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-sm font-mono text-white focus:outline-none focus:border-[#93E6EE]"
                  />
                </div>

                <label className="flex items-center gap-3 pt-4 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowCustomTeams}
                    onChange={(e) => setAllowCustomTeams(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#93E6EE]"
                  />
                  <span className="text-xs text-slate-300">
                    Allow managers to create custom clubs
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="cm27-btn-dark-3d px-4 py-2 rounded text-xs text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="cm27-btn-3d px-6 py-2.5 rounded disabled:opacity-50 font-bold text-sm cursor-pointer"
                >
                  {creating ? 'Seeding Authentic Players...' : 'Launch League'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete League Confirmation Modal */}
      {leagueToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cm27-panel border-rose-500/35 w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-base font-semibold text-white">
                Delete {leagueToDelete.name}?
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently erase the league, all claimed clubs, player contracts, auction
              history, and league messages for all managers. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setLeagueToDelete(null)}
                className="px-4 py-2 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteLeague}
                disabled={deletingLeague}
                className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {deletingLeague ? 'Deleting...' : 'Delete League'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
