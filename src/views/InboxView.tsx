import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, CheckCheck, MailOpen } from 'lucide-react';
import type { LeagueNotification, LeagueStateSnapshot } from '../types/game';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type { ActiveTab } from '../components/AppShell';

type InboxSectionId =
  | 'board'
  | 'matches'
  | 'league'
  | 'medical'
  | 'transfers'
  | 'media'
  | 'all';

type MailStatusFilter = 'all' | 'inbox' | 'archive';

const MAIL_SECTIONS: Array<{
  id: InboxSectionId;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'board',
    label: 'Board & Staff',
    subtitle: 'Ownership memos, Chief Executive, Director of Cricket & club setup',
  },
  {
    id: 'matches',
    label: 'Match Reports',
    subtitle: 'Full post-match reports and scorecard dispatches for your club',
  },
  {
    id: 'league',
    label: 'League Results',
    subtitle: 'Tournament scorecards, AI vs AI results & calendar notices',
  },
  {
    id: 'medical',
    label: 'Medical & Training',
    subtitle: 'Physio injury bulletins, fitness updates, drills & academy reports',
  },
  {
    id: 'transfers',
    label: 'Transfers & Auction',
    subtitle: 'Trade proposals, player transfer requests, auction settlements & watchlists',
  },
  {
    id: 'media',
    label: 'Press & Scouting',
    subtitle: 'Press conference fallout, scouting dossiers & rivalry quotes',
  },
  {
    id: 'all',
    label: 'All Mail',
    subtitle: 'Chronological view across every club and league dispatch',
  },
];

function classifyMailSection(
  n: LeagueNotification,
  myTeamShortCode?: string | null
): Exclude<InboxSectionId, 'all'> {
  const cat = (n.category || '').toLowerCase();
  const title = (n.title || '').toLowerCase();
  const body = (n.body || '').toLowerCase();

  if (
    cat.includes('medical') ||
    cat.includes('injury') ||
    cat.includes('training') ||
    cat.includes('academy') ||
    title.includes('injury report') ||
    title.includes('training session')
  ) {
    return 'medical';
  }

  if (
    cat.includes('transfer') ||
    cat.includes('auction') ||
    cat.includes('watchlist')
  ) {
    return 'transfers';
  }

  if (
    cat.includes('press') ||
    cat.includes('rivalry') ||
    cat.includes('banter') ||
    cat.includes('media') ||
    cat.includes('scout')
  ) {
    return 'media';
  }

  if (cat === 'league result' || cat.includes('league notice') || cat === 'league') {
    return 'league';
  }

  if (cat === 'match result') {
    if (
      myTeamShortCode &&
      (title.includes(myTeamShortCode.toLowerCase()) ||
        body.includes(`(${myTeamShortCode.toLowerCase()})`))
    ) {
      return 'matches';
    }
    return 'league';
  }

  return 'board';
}

export function InboxView({
  state,
  onRefreshState,
  onNavigate,
}: {
  state: LeagueStateSnapshot;
  onRefreshState: () => Promise<void>;
  onNavigate: (tab: ActiveTab) => void;
}) {
  const { user } = useAuth();
  const myShort = state.myTeam?.shortCode || null;
  const uid = user?.uid || '';

  const sectionCounts = useMemo(() => {
    const counts: Record<InboxSectionId, { total: number; unread: number }> = {
      board: { total: 0, unread: 0 },
      matches: { total: 0, unread: 0 },
      league: { total: 0, unread: 0 },
      medical: { total: 0, unread: 0 },
      transfers: { total: 0, unread: 0 },
      media: { total: 0, unread: 0 },
      all: { total: 0, unread: 0 },
    };
    for (const n of state.notifications) {
      const sec = classifyMailSection(n, myShort);
      const isUnread = !(n.readByUidsJson || []).includes(uid);
      counts[sec].total += 1;
      counts.all.total += 1;
      if (isUnread) {
        counts[sec].unread += 1;
        counts.all.unread += 1;
      }
    }
    return counts;
  }, [state.notifications, myShort, uid]);

  const [activeSection, setActiveSection] = useState<InboxSectionId>(() => {
    const order: InboxSectionId[] = ['board', 'matches', 'transfers', 'medical', 'media', 'league'];
    const firstWithUnread = order.find((id) =>
      state.notifications.some(
        (n) =>
          classifyMailSection(n, state.myTeam?.shortCode) === id &&
          !(n.readByUidsJson || []).includes(user?.uid || '')
      )
    );
    if (firstWithUnread) return firstWithUnread;
    const firstNonEmpty = order.find((id) =>
      state.notifications.some((n) => classifyMailSection(n, state.myTeam?.shortCode) === id)
    );
    return firstNonEmpty || 'board';
  });

  const [statusFilter, setStatusFilter] = useState<MailStatusFilter>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [marking, setMarking] = useState(false);

  const visibleMessages = useMemo(() => {
    return state.notifications.filter((n) => {
      if (activeSection !== 'all' && classifyMailSection(n, myShort) !== activeSection) {
        return false;
      }
      const isRead = (n.readByUidsJson || []).includes(uid);
      if (statusFilter === 'inbox' && isRead) return false;
      if (statusFilter === 'archive' && !isRead) return false;
      return true;
    });
  }, [state.notifications, myShort, activeSection, statusFilter, uid]);

  const activeMessage =
    visibleMessages.find((n) => n.id === selectedId) || visibleMessages[0] || null;

  const markSingleRead = async (msg: LeagueNotification) => {
    if (!uid || (msg.readByUidsJson || []).includes(uid)) return;
    try {
      await apiFetch(`/api/leagues/${state.league.id}/notifications/read`, {
        method: 'POST',
        body: JSON.stringify({ notificationId: msg.id }),
      });
      await onRefreshState();
    } catch {
      // ignore non-fatal read sync
    }
  };

  const handleSelectMessage = (msg: LeagueNotification) => {
    setSelectedId(msg.id);
    void markSingleRead(msg);
  };

  useEffect(() => {
    if (visibleMessages.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const curIdx = Math.max(
        0,
        visibleMessages.findIndex((m) => m.id === (activeMessage?.id ?? null))
      );
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = visibleMessages[(curIdx + 1) % visibleMessages.length];
        if (next) handleSelectMessage(next);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = visibleMessages[(curIdx - 1 + visibleMessages.length) % visibleMessages.length];
        if (prev) handleSelectMessage(prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleMarkAllRead = async () => {
    setMarking(true);
    try {
      await apiFetch(`/api/leagues/${state.league.id}/notifications/read`, {
        method: 'POST',
      });
      await onRefreshState();
    } finally {
      setMarking(false);
    }
  };

  const formatShortDate = (iso: string) => {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${mon}`;
  };

  const suggestActionForMessage = (category: string): { label: string; tab: ActiveTab } | null => {
    const cat = category.toLowerCase();
    if (cat.includes('director') || cat.includes('medical') || cat.includes('squad')) {
      return { label: 'Open Squad & Lineups', tab: 'squad' };
    }
    if (cat.includes('chief')) return { label: 'Open Coaching Staff', tab: 'squad' };
    if (cat.includes('training')) return { label: 'Open Training Ground', tab: 'training' };
    if (cat.includes('press')) return { label: 'Open League Gazette', tab: 'gazette' };
    if (cat.includes('transfer') || cat.includes('rivalry') || cat.includes('banter')) {
      return { label: 'Open Transfer Market', tab: 'transfers' };
    }
    if (cat.includes('academy') || cat.includes('watchlist') || cat.includes('scout')) {
      return { label: 'Open Scouting Network', tab: 'scouts' };
    }
    if (cat.includes('auction')) return { label: 'Go to Auction Floor', tab: 'auction' };
    if (cat.includes('match') || cat.includes('league result')) {
      return { label: 'View Schedule & Points', tab: 'matchday' };
    }
    return { label: 'View Teams & Board', tab: 'franchises' };
  };

  const renderEditorialParagraphs = (body: string) => {
    const blocks = body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    return blocks.map((para, idx) => {
      const isQuoted =
        para.startsWith('"') ||
        para.startsWith('“') ||
        para.startsWith('Headline Quote:') ||
        para.startsWith('Manager Note:');
      if (isQuoted) {
        return (
          <blockquote
            key={idx}
            className="rounded-md bg-white/[0.03] border border-white/[0.08] px-4 py-3 text-sm text-slate-100 italic leading-relaxed"
          >
            {para}
          </blockquote>
        );
      }
      return (
        <p key={idx} className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
          {para}
        </p>
      );
    });
  };

  const currentTabMeta = MAIL_SECTIONS.find((t) => t.id === activeSection)!;

  return (
    <div className="space-y-4">
      {/* Top Broadcast Mail Folder Navigation (Image 3 style) */}
      <div className="cm27-panel p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate-400">
              Communications Desk · {state.league.name}
            </div>
            <h1 className="font-condensed text-3xl font-bold text-white uppercase tracking-tight mt-0.5">
              Club Mail &amp; Dispatches
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented View: All | Unread Inbox | Read Archive */}
            <div className="inline-flex items-center p-0.5 rounded-md bg-[#080B10]/85 border border-white/[0.08]">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'inbox', label: 'Unread' },
                  { id: 'archive', label: 'Archive' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => {
                    setStatusFilter(mode.id);
                    setSelectedId(null);
                  }}
                  className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    statusFilter === mode.id
                      ? 'bg-white/[0.12] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleMarkAllRead}
              disabled={marking || sectionCounts.all.unread === 0}
              className="cm27-btn-dark-3d px-3.5 py-1.5 rounded text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[#4ADE80]" />
              <span>{marking ? 'Updating...' : 'Mark All Read'}</span>
            </button>
          </div>
        </div>

        {/* Multi-Section Sorted Folders */}
        <div className="flex items-center gap-5 overflow-x-auto border-b border-white/[0.08]">
          {MAIL_SECTIONS.map((tab) => {
            const active = activeSection === tab.id;
            const stats = sectionCounts[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSection(tab.id);
                  setSelectedId(null);
                }}
                className={`pb-2.5 text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer border-b-2 -mb-[1px] transition-colors ${
                  active
                    ? 'border-[#93E6EE] text-white'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {stats.total}
                </span>
                {stats.unread > 0 && (
                  <span className="font-mono text-[10px] font-bold text-[#4ADE80] tabular-nums">
                    · {stats.unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="text-xs text-slate-400">{currentTabMeta.subtitle}</div>
      </div>

      {/* Split Master-Detail Reader matching Reference Image 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[540px]">
        {/* Left Message List */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-1.5 max-h-[660px] overflow-y-auto pr-1">
          {visibleMessages.length === 0 ? (
            <div className="cm27-panel p-8 text-center text-xs text-slate-400 space-y-2">
              <p>
                No dispatches in <strong className="text-white">{currentTabMeta.label}</strong>
                {statusFilter !== 'all' ? ` (${statusFilter})` : ''}.
              </p>
              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="text-[#93E6EE] hover:underline cursor-pointer"
                >
                  Show all messages in this folder
                </button>
              )}
            </div>
          ) : (
            visibleMessages.map((msg) => {
              const selected = activeMessage?.id === msg.id;
              const isRead = (msg.readByUidsJson || []).includes(uid);
              return (
                <button
                  key={msg.id}
                  onClick={() => handleSelectMessage(msg)}
                  className={`cm27-hover-sweep w-full text-left px-4 py-3.5 rounded-md border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    selected
                      ? 'cm27-card-focus'
                      : 'bg-[#0C1016]/75 border-white/[0.06] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        !isRead
                          ? 'bg-[#22C55E] text-[#07110B]'
                          : 'bg-white/[0.08] text-slate-400'
                      }`}
                      title={isRead ? 'Read' : 'Unread'}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{msg.category}</div>
                      <div
                        className={`text-xs truncate mt-0.5 ${
                          selected
                            ? 'text-[#93E6EE] font-medium'
                            : !isRead
                              ? 'text-slate-200 font-medium'
                              : 'text-slate-400'
                        }`}
                      >
                        {msg.title}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0 tabular-nums">
                    {formatShortDate(msg.createdAt)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Right Open Editorial Reader (Image 3 spacious dark slate canvas) */}
        <div className="lg:col-span-7 xl:col-span-8 cm27-panel p-6 sm:p-8 flex flex-col justify-between">
          {activeMessage ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-4">
                <div>
                  <div className="text-base font-bold text-white">{activeMessage.category}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{activeMessage.title}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {!(activeMessage.readByUidsJson || []).includes(uid) && (
                    <button
                      onClick={() => void markSingleRead(activeMessage)}
                      className="text-[11px] font-semibold text-[#4ADE80] hover:text-emerald-300 cursor-pointer whitespace-nowrap"
                    >
                      Mark Read
                    </button>
                  )}
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    {formatShortDate(activeMessage.createdAt)}
                  </span>
                </div>
              </div>

              <div className="space-y-4 max-w-2xl">
                {renderEditorialParagraphs(activeMessage.body)}
              </div>
            </div>
          ) : (
            <div className="m-auto text-center space-y-2 text-slate-500 py-16">
              <MailOpen className="w-8 h-8 mx-auto opacity-50" />
              <p className="text-xs">Select a dispatch from the left folder to read it.</p>
            </div>
          )}

          {activeMessage &&
            (() => {
              const action = suggestActionForMessage(activeMessage.category);
              if (!action) return null;
              return (
                <div className="pt-6 mt-6 border-t border-white/[0.06] flex justify-end">
                  <button
                    onClick={() => onNavigate(action.tab)}
                    className="cm27-btn-3d px-4 py-2 rounded text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>{action.label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })()}
        </div>
      </div>
    </div>
  );
}
