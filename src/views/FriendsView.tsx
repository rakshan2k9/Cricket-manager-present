import { useState } from 'react';
import {
  Copy,
  Check,
  MessageSquare,
  Eye,
  UserPlus,
  Users,
  Shield,
  ArrowRightLeft,
} from 'lucide-react';
import type { League, LeagueStateSnapshot } from '../types/game';
import type { ActiveTab } from '../components/AppShell';
import { formatCurrencyLakhs, formatTimeAgo } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { TeamCrest } from '../components/TeamCrest';
import { ManagerBadge } from '../components/ManagerBadge';
import { CountryFlag } from '../components/CountryFlag';
import type { useGlobalSocial } from '../hooks/useGlobalSocial';
import { GlobalFriendsView } from './GlobalFriendsView';

type GlobalSocialHook = ReturnType<typeof useGlobalSocial>;

export function FriendsView({
  state,
  currentUid,
  social,
  leagues,
  onSelectLeague,
  onNavigate,
  onInspectTeam,
  onSwitchLeague,
  onToast,
}: {
  state: LeagueStateSnapshot;
  currentUid: string;
  social: GlobalSocialHook;
  leagues: League[];
  onSelectLeague: (leagueId: number) => void;
  onNavigate: (tab: ActiveTab) => void;
  onInspectTeam: (teamId: number) => void;
  onSwitchLeague: () => void;
  onToast: (t: { tone: 'success' | 'info' | 'warning' | 'error'; title: string; body?: string }) => void;
}) {
  const { profile } = useAuth();
  const currency = profile?.preferredCurrency || 'INR';
  const { league, members, teams } = state;
  const [subMode, setSubMode] = useState<'global' | 'league'>('global');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [search, setSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInviteMsg, setCopiedInviteMsg] = useState(false);

  const onlineCount = members.filter((m) => m.isOnline).length;
  const globalBadge = social.friends.incoming.length + social.friends.totalUnread;

  const filteredMembers = members.filter((m) => {
    if (filter === 'online' && !m.isOnline) return false;
    if (filter === 'offline' && m.isOnline) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const team = teams.find((t) => t.ownerUid === m.userUid);
      const matchesName = (m.managerName || '').toLowerCase().includes(q);
      const matchesCountry = (m.country || '').toLowerCase().includes(q);
      const matchesTeam = (team?.name || '').toLowerCase().includes(q);
      if (!matchesName && !matchesCountry && !matchesTeam) return false;
    }
    return true;
  });

  const copyCode = () => {
    navigator.clipboard.writeText(league.inviteCode);
    setCopiedCode(true);
    onToast({ tone: 'success', title: `Invite code ${league.inviteCode} copied` });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyFullInvite = () => {
    const shareText = `Join my Cricket Manager 27 (CM27) league "${league.name}"! Use Invite Code: ${league.inviteCode} at ${window.location.origin}`;
    navigator.clipboard.writeText(shareText);
    setCopiedInviteMsg(true);
    onToast({ tone: 'success', title: 'Invite message copied to clipboard' });
    setTimeout(() => setCopiedInviteMsg(false), 2000);
  };

  const openTeams = teams.filter((t) => !t.ownerUid);

  return (
    <div className="space-y-6">
      {/* Top Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-6 overflow-x-auto">
          <button
            onClick={() => setSubMode('global')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 border-b-2 ${
              subMode === 'global'
                ? 'border-[#93E6EE] text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-[#93E6EE]" />
            <span>Add Friends &amp; Direct Chat</span>
            {globalBadge > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[#EAB308] text-[#0B0E14] text-[10px] font-mono font-bold tabular-nums">
                {globalBadge}
              </span>
            )}
          </button>
          <button
            onClick={() => setSubMode('league')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 border-b-2 ${
              subMode === 'league'
                ? 'border-[#93E6EE] text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#93E6EE]" />
            <span>League Rivals &amp; Invite Code ({members.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 pb-3">
          <button
            onClick={() => onNavigate('chat')}
            className="cm27-btn-dark-3d flex items-center gap-2 px-3.5 py-1.5 rounded text-slate-100 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#93E6EE]" />
            League Room Chat
          </button>
          <button
            onClick={onSwitchLeague}
            className="cm27-btn-dark-3d flex items-center gap-2 px-3.5 py-1.5 rounded text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#93E6EE]" />
            Switch / Join League
          </button>
        </div>
      </div>

      {subMode === 'global' ? (
        <GlobalFriendsView
          social={social}
          leagues={leagues}
          onJoinedLeague={onSelectLeague}
          onToast={onToast}
        />
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#EAB308]">
              LEAGUE ROSTER &amp; INVITATIONS
            </p>
            <h1 className="text-3xl font-condensed font-bold uppercase tracking-tight text-white">
              Rival Managers in {league.name}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {onlineCount} online now · {members.length}/{league.maxManagers} seats filled
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8 Cols: League Members Directory */}
            <div className="lg:col-span-8 cm27-panel overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0E1218]">
                <div className="flex items-center gap-1 p-1 bg-[#0C0F14] border border-white/[0.08] rounded w-fit">
                  {(
                    [
                      { id: 'all', label: `All (${members.length})` },
                      { id: 'online', label: `Online (${onlineCount})` },
                      { id: 'offline', label: `Offline (${members.length - onlineCount})` },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilter(tab.id)}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        filter === tab.id
                          ? 'cm27-btn-3d font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter rivals or club..."
                  className="px-3.5 py-1.5 rounded bg-[#0C0F14] border border-white/12 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#93E6EE] sm:w-60"
                />
              </div>

              <div className="divide-y divide-white/[0.06]">
                {filteredMembers.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-500">
                    No managers match this filter.
                  </div>
                ) : (
                  filteredMembers.map((m) => {
                    const ownedTeam = teams.find((t) => t.ownerUid === m.userUid);
                    const isSelf = m.userUid === currentUid;
                    const alreadyFriend = social.friends.accepted.some(
                      (f) => f.friend.uid === m.userUid
                    );

                    return (
                      <div
                        key={m.userUid}
                        className={`cm27-hover-sweep px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                          isSelf ? 'bg-[#19202B]' : 'hover:bg-white/[0.025]'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="relative shrink-0">
                            <ManagerBadge
                              name={m.managerName || 'Manager'}
                              country={m.country}
                              accent={m.avatarUrl}
                              size="md"
                            />
                            <span
                              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0E1218] ${
                                m.isOnline ? 'bg-[#22C55E]' : 'bg-slate-600'
                              }`}
                              title={m.isOnline ? 'Online' : 'Offline'}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white truncate">
                                {m.managerName || 'Manager'}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] font-mono uppercase text-[#93E6EE]">
                                  · You
                                </span>
                              )}
                              {m.role === 'host' && (
                                <span className="text-[10px] font-mono uppercase text-[#EAB308]">
                                  · Host
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                              <span className="inline-flex items-center gap-1.5">
                                <CountryFlag country={m.country || 'International'} size="xs" />
                                <span>{m.country || 'International'}</span>
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-[11px] text-slate-500">
                                Joined {formatTimeAgo(m.joinedAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          {ownedTeam ? (
                            <div className="text-right">
                              <div className="flex items-center sm:justify-end gap-2 text-xs font-semibold text-white">
                                <TeamCrest
                                  templateKey={ownedTeam.templateKey}
                                  shortCode={ownedTeam.shortCode}
                                  primaryColor={ownedTeam.primaryColor}
                                  secondaryColor={ownedTeam.secondaryColor}
                                  size="xs"
                                />
                                <span>{ownedTeam.name}</span>
                                <span className="font-mono text-[#EAB308]">
                                  ({ownedTeam.shortCode})
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                                Squad {ownedTeam.squadCount ?? 0}/{league.maxSquadSize} · Purse{' '}
                                <span className="text-[#4ADE80]">
                                  {formatCurrencyLakhs(ownedTeam.remainingBudget, currency)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 italic">No club claimed</span>
                          )}

                          <div className="flex items-center gap-2">
                            {!isSelf && !alreadyFriend && (
                              <button
                                onClick={() => social.sendFriendRequest({ targetUid: m.userUid })}
                                className="cm27-btn-dark-3d p-2 rounded text-[#93E6EE] cursor-pointer"
                                title="Send Friend Request"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isSelf && alreadyFriend && (
                              <button
                                onClick={() => {
                                  social.openConversation(m.userUid);
                                  setSubMode('global');
                                }}
                                className="cm27-btn-dark-3d p-2 rounded text-[#93E6EE] cursor-pointer"
                                title="Direct Message"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {ownedTeam && (
                              <button
                                onClick={() => onInspectTeam(ownedTeam.id)}
                                className="cm27-btn-dark-3d flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-slate-200 hover:text-white cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#93E6EE]" />
                                Squad
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right 4 Cols: Invite Friends & Seat Capacity */}
            <div className="lg:col-span-4 space-y-5">
              <div className="cm27-panel p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-[#181E27] border border-white/15 flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-[#93E6EE]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">Invite Friends to {league.name}</h2>
                    <p className="text-[11px] text-slate-400 tabular-nums">
                      {league.maxManagers - members.length} manager slots available
                    </p>
                  </div>
                </div>

                <div className="cm27-panel-inset p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      League Invite Code
                    </div>
                    <div className="text-2xl font-mono font-bold tracking-[0.2em] text-[#EAB308] mt-0.5">
                      {league.inviteCode}
                    </div>
                  </div>
                  <button
                    onClick={copyCode}
                    className="cm27-btn-dark-3d flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium text-white cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <button
                  onClick={copyFullInvite}
                  className="cm27-btn-3d w-full py-2.5 px-4 rounded font-bold text-xs cursor-pointer"
                >
                  {copiedInviteMsg ? 'Invite Message Copied!' : 'Copy Shareable Friend Invite'}
                </button>

                <div className="pt-3 border-t border-white/[0.06] space-y-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2 text-slate-300 font-medium">
                    <Shield className="w-3.5 h-3.5 text-[#93E6EE]" />
                    How Friends Join
                  </div>
                  <p>
                    1. Add friends in the <strong>Add Friends &amp; Direct Chat</strong> tab or share code{' '}
                    <span className="font-mono text-[#EAB308]">{league.inviteCode}</span>.
                  </p>
                  <p>
                    2. They pick any of the {teams.length} clubs across IPL, International, BBL &amp;
                    The Hundred.
                  </p>
                </div>
              </div>

              {/* Open Franchises Quick Summary */}
              <div className="cm27-panel p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Users className="w-4 h-4 text-[#93E6EE]" />
                    Open Clubs ({openTeams.length})
                  </div>
                  <button
                    onClick={() => onNavigate('franchises')}
                    className="text-xs text-[#93E6EE] hover:text-white cursor-pointer"
                  >
                    Browse All →
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {openTeams.slice(0, 16).map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#0C0F14] border border-white/10 text-xs font-mono text-slate-300"
                    >
                      <TeamCrest
                        templateKey={t.templateKey}
                        shortCode={t.shortCode}
                        primaryColor={t.primaryColor}
                        secondaryColor={t.secondaryColor}
                        size="xs"
                      />
                      {t.shortCode}
                    </span>
                  ))}
                  {openTeams.length > 16 && (
                    <span className="text-xs font-mono text-slate-500 self-center">
                      +{openTeams.length - 16} more
                    </span>
                  )}
                  {openTeams.length === 0 && (
                    <p className="text-xs text-slate-500">All clubs are currently claimed.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
