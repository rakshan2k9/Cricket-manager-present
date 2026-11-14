import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Info,
  Menu,
  X,
} from 'lucide-react';
import type { LeagueStateSnapshot } from '../types/game';
import { formatCurrencyLakhs, formatTimeAgo } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { TeamCrest } from './TeamCrest';

export type ActiveTab =
  | 'dashboard'
  | 'inbox'
  | 'squad'
  | 'training'
  | 'matchday'
  | 'auction'
  | 'transfers'
  | 'scouts'
  | 'players'
  | 'franchises'
  | 'gazette'
  | 'friends'
  | 'chat'
  | 'settings';

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'dashboard', label: 'Home' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'squad', label: 'Squad' },
  { id: 'training', label: 'Training' },
  { id: 'matchday', label: 'Matchday' },
  { id: 'auction', label: 'Auction' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'scouts', label: 'Scouts' },
  { id: 'players', label: 'Players' },
  { id: 'franchises', label: 'Teams' },
  { id: 'gazette', label: 'Gazette' },
  { id: 'friends', label: 'Friends' },
  { id: 'chat', label: 'Chat' },
  { id: 'settings', label: 'Office' },
];

export function AppShell({
  state,
  activeTab,
  onSelectTab,
  onBackToLobby,
  wsConnected,
  onRefreshState,
  children,
}: {
  state: LeagueStateSnapshot;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onBackToLobby: () => void;
  wsConnected: boolean;
  onRefreshState: () => Promise<void>;
  children: React.ReactNode;
}) {
  const { user, profile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clubInfoModalOpen, setClubInfoModalOpen] = useState(false);

  const currency = profile?.preferredCurrency || 'INR';

  const unreadCount = state.notifications.filter(
    (n) => !(n.readByUidsJson || []).includes(user?.uid || '')
  ).length;

  const currentIdx = NAV_ITEMS.findIndex((item) => item.id === activeTab);

  const stepTab = (delta: -1 | 1) => {
    const nextIdx = (currentIdx + delta + NAV_ITEMS.length) % NAV_ITEMS.length;
    onSelectTab(NAV_ITEMS[nextIdx].id);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '[' || e.key === 'q' || e.key === 'Q' || (e.shiftKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        stepTab(-1);
      }
      if (e.key === ']' || e.key === 'e' || e.key === 'E' || (e.shiftKey && e.key === 'ArrowRight')) {
        e.preventDefault();
        stepTab(1);
      }
      if (e.key === 'Escape' && clubInfoModalOpen) {
        setClubInfoModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleSelectNav = (tab: ActiveTab) => {
    onSelectTab(tab);
  };

  const pursePercent = state.myTeam
    ? Math.max(
        8,
        Math.min(
          100,
          Math.round((state.myTeam.remainingBudget / Math.max(1, state.myTeam.startingBudget)) * 100)
        )
      )
    : 100;

  const auctionLive = state.auctionSnapshot?.auction.status === 'live';
  const pendingTrades = (state.tradeOffers || []).filter(
    (o) => state.myTeam && o.recipientTeamId === state.myTeam.id && o.status === 'pending'
  ).length;
  const readyPress = (state.matches || []).filter(
    (m) =>
      state.myTeam &&
      (m.homeTeamId === state.myTeam.id || m.awayTeamId === state.myTeam.id) &&
      !m.pressConferenceCompleted &&
      Boolean(m.pressConferenceJson?.questions?.length)
  ).length;
  const pendingPress = (state.matches || []).filter(
    (m) =>
      state.myTeam &&
      (m.homeTeamId === state.myTeam.id || m.awayTeamId === state.myTeam.id) &&
      !m.pressConferenceCompleted
  ).length;
  const currentDay = state.currentGameDay || state.league.currentGameDay || 1;
  const activeTabLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Home';

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col relative">
      {/* Subtle CM27 background stadium boundary & crease lines (Reference Image 5) */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none opacity-[0.045] z-0"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
      >
        <ellipse cx="960" cy="760" rx="760" ry="380" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1" />
        <line x1="960" y1="380" x2="960" y2="1080" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <rect x="880" y="610" width="160" height="310" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      </svg>

      {/* Primary CM27 Top Navigation Header matching Reference Image 4 */}
      <header className="sticky top-0 z-40 bg-[#070A0E]/80 backdrop-blur-md border-b border-white/[0.07]">
        <div className="max-w-[1560px] mx-auto h-13 px-3 sm:px-5 flex items-center justify-between gap-2">
          {/* Left: CM27 White/Gold Logo + Lobby Back */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              onClick={() => handleSelectNav('dashboard')}
              className="flex items-baseline cursor-pointer whitespace-nowrap shrink-0"
              title="Cricket Manager 27 Home"
            >
              <span className="font-condensed text-[26px] font-extrabold tracking-tight text-white leading-none">
                CM
              </span>
              <span className="font-condensed text-[26px] font-extrabold tracking-tight text-[#EAB308] leading-none">
                27
              </span>
            </button>

            <button
              onClick={onBackToLobby}
              className="hidden 2xl:flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer pl-3 border-l border-white/[0.08] whitespace-nowrap shrink-0"
              title="Return to League Lobby"
            >
              <ArrowLeft className="w-3 h-3" />
              <span className="max-w-[100px] truncate font-medium">{state.league.name}</span>
            </button>
          </div>

          {/* Center: Hub Context + [Q] + Underlined Tabs + [E] matching Reference Image 4 */}
          <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto no-scrollbar">
            <span className="text-[12px] font-semibold text-white whitespace-nowrap shrink-0 mr-2 hidden 2xl:inline tracking-wide">
              {activeTabLabel} Hub
            </span>

            <button
              onClick={() => stepTab(-1)}
              className="cm27-keycap hover:text-white hover:border-white/35 transition-colors mr-1 cursor-pointer shrink-0"
              title="Previous tab (Q or [)"
            >
              Q
            </button>

            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              const showInboxDot = item.id === 'inbox' && unreadCount > 0;
              const showLiveDot = item.id === 'auction' && auctionLive;
              const showTradeDot = item.id === 'transfers' && pendingTrades > 0;
              const showPressDot = item.id === 'gazette' && (readyPress > 0 || pendingPress > 0);
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectNav(item.id)}
                  title={
                    item.id === 'gazette' && readyPress > 0
                      ? 'Press Conference Ready'
                      : undefined
                  }
                  className={`relative px-1.5 xl:px-2 py-3.5 text-[11.5px] font-semibold tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1 ${
                    active ? 'text-white' : 'text-slate-400/90 hover:text-slate-100'
                  }`}
                >
                  <span>{item.label}</span>
                  {showInboxDot && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" title="Unread Inbox" />
                  )}
                  {showLiveDot && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" title="Live Auction" />
                  )}
                  {showTradeDot && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" title="Pending Trade Offer" />
                  )}
                  {showPressDot && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        readyPress > 0 ? 'bg-[#93E6EE]' : 'bg-slate-400'
                      }`}
                      title={readyPress > 0 ? 'Press Conference Ready' : 'Press Briefing Pending'}
                    />
                  )}
                  {active && (
                    <span className="cm27-nav-underline absolute left-1.5 right-1.5 bottom-1.5 h-[2px] bg-white" />
                  )}
                </button>
              );
            })}

            <button
              onClick={() => stepTab(1)}
              className="cm27-keycap hover:text-white hover:border-white/35 transition-colors ml-1 cursor-pointer shrink-0"
              title="Next tab (E or ])"
            >
              E
            </button>
          </nav>

          {/* Right: Crest + Team Name + Tri-Color Confidence/Purse Bar + S1·D{day} */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleSelectNav(state.myTeam ? 'squad' : 'franchises')}
              className="flex items-center gap-2.5 px-2 py-1 rounded hover:bg-white/[0.04] transition-colors cursor-pointer text-left shrink-0"
              title={state.myTeam ? `${state.myTeam.name} Operations` : 'Select Your Team'}
            >
              <TeamCrest
                templateKey={state.myTeam?.templateKey}
                shortCode={state.myTeam?.shortCode || 'HQ'}
                primaryColor={state.myTeam?.primaryColor || '#EAB308'}
                secondaryColor={state.myTeam?.secondaryColor || '#1E293B'}
                size="sm"
              />

              <div className="min-w-[112px] hidden sm:block">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-white truncate max-w-[115px] leading-tight">
                    {state.myTeam ? state.myTeam.name : 'Select Team'}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="relative h-[4px] w-24 bg-white/10 rounded-full overflow-visible">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#EF4444] via-[#EAB308] to-[#22C55E]"
                      style={{ width: `${pursePercent}%` }}
                    />
                    <span
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white"
                      style={{ left: `calc(${pursePercent}% - 4px)` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-300 tabular-nums whitespace-nowrap">
                    {wsConnected ? `S1·D${currentDay}` : 'SYNC'}
                  </span>
                </div>
              </div>
            </button>

            <button
              onClick={() => setClubInfoModalOpen(true)}
              className="w-7 h-7 rounded-full border border-white/25 hover:border-white/60 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Club & League Info"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/75" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 w-72 bg-[#11151C] border-r border-white/10 h-full flex flex-col p-5 space-y-5">
            <div className="flex items-center justify-between">
              <span className="font-condensed text-2xl font-extrabold text-white">
                CM<span className="text-[#EAB308]">27</span>
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onBackToLobby();
              }}
              className="flex items-center gap-2 text-xs text-slate-300 hover:text-white py-2 border-b border-white/[0.08]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Switch League ({state.league.name})
            </button>

            <nav className="space-y-1 flex-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      handleSelectNav(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`cm27-hover-sweep cm27-hover-bar w-full text-left px-3.5 py-2.5 rounded text-sm font-medium flex items-center justify-between ${
                      active ? 'text-white bg-white/[0.06]' : 'text-slate-400 hover:text-white'
                    }`}
                    data-active={active ? 'true' : 'false'}
                  >
                    <span>{item.label}</span>
                    {item.id === 'inbox' && unreadCount > 0 && (
                      <span className="text-[10px] font-mono text-emerald-400 tabular-nums">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Viewport with smooth transition per tab */}
      <main key={activeTab} className="cm27-view-enter relative z-10 flex-1 w-full max-w-[1560px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
        {children}
      </main>

      {/* Bottom Keybind & Season Strip */}
      <footer className="relative z-10 border-t border-white/[0.07] bg-[#070A0E]/80 backdrop-blur-md py-2 px-4 sm:px-6">
        <div className="max-w-[1560px] mx-auto flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-3.5">
            <button
              onClick={onBackToLobby}
              className="inline-flex items-center gap-1.5 hover:text-white cursor-pointer"
            >
              <span className="cm27-keycap">Esc</span>
              <span>Lobby</span>
            </button>
            <span className="inline-flex items-center gap-1.5">
              <span className="cm27-keycap">↑ ↓ ← →</span>
              <span>Navigate</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="cm27-keycap">Q / E</span>
              <span>Switch Tabs</span>
            </span>
            <span className="hidden sm:inline text-slate-500">
              INVITE <strong className="font-mono text-[#EAB308]">{state.league.inviteCode}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
            <span className={wsConnected ? 'text-[#22C55E]' : 'text-[#EAB308]'}>
              {wsConnected ? 'Live Sync' : 'Reconnecting'}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-300">
              Season 1 · Day {currentDay} · {state.league.name}
            </span>
          </div>
        </div>
      </footer>

      {/* Quick Club & League Dossier Modal from (i) button */}
      {clubInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md cm27-panel p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-3">
                <TeamCrest
                  templateKey={state.myTeam?.templateKey}
                  shortCode={state.myTeam?.shortCode || 'HQ'}
                  primaryColor={state.myTeam?.primaryColor}
                  secondaryColor={state.myTeam?.secondaryColor}
                  size="md"
                />
                <div>
                  <h3 className="font-condensed text-2xl font-bold text-white uppercase">
                    {state.myTeam ? state.myTeam.name : 'No Club Claimed Yet'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {state.myTeam ? `${state.myTeam.leagueCategory} · ${state.myTeam.homeGround}` : state.league.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setClubInfoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 cm27-panel-inset">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Manager</div>
                <div className="text-white font-semibold mt-0.5">
                  {profile?.preferredName || profile?.managerName}
                </div>
              </div>
              <div className="p-3 cm27-panel-inset">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Invite Code</div>
                <div className="font-mono text-[#EAB308] font-bold mt-0.5 tabular-nums">
                  {state.league.inviteCode}
                </div>
              </div>
              <div className="p-3 cm27-panel-inset">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Remaining Purse</div>
                <div className="font-mono text-[#22C55E] font-bold mt-0.5 tabular-nums">
                  {state.myTeam
                    ? formatCurrencyLakhs(state.myTeam.remainingBudget, currency)
                    : formatCurrencyLakhs(state.league.startingBudget, currency)}
                </div>
              </div>
              <div className="p-3 cm27-panel-inset">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Backroom Staff</div>
                <div className="font-mono text-slate-200 font-bold mt-0.5 tabular-nums">
                  {(state.myTeam?.hiredStaffJson || []).length}/10 Coaches ·{' '}
                  {(state.myTeam?.hiredScoutsJson || []).length} Scouts
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setClubInfoModalOpen(false);
                  handleSelectNav('franchises');
                }}
                className="px-4 py-2 rounded cm27-btn-3d text-xs font-semibold cursor-pointer"
              >
                Switch / View Clubs
              </button>
              <button
                onClick={() => setClubInfoModalOpen(false)}
                className="px-4 py-2 rounded cm27-btn-dark-3d text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden usage guard for formatTimeAgo */}
      <span className="hidden">{formatTimeAgo(state.league.createdAt)}</span>
    </div>
  );
}
