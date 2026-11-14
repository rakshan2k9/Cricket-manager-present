import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock,
  MessageSquare,
  Search,
  Send,
  ShieldPlus,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type { DiscoverManagerEntry, League } from '../types/game';
import { formatTimeAgo } from '../utils/format';
import type { useGlobalSocial } from '../hooks/useGlobalSocial';
import { ManagerBadge } from '../components/ManagerBadge';
import { CountryFlag } from '../components/CountryFlag';

type GlobalSocialHook = ReturnType<typeof useGlobalSocial>;

export function GlobalFriendsView({
  social,
  leagues,
  onJoinedLeague,
  onToast,
}: {
  social: GlobalSocialHook;
  leagues: League[];
  onJoinedLeague?: (leagueId: number) => void;
  onToast?: (t: { tone: 'info' | 'success' | 'warning' | 'error'; title: string; body?: string }) => void;
}) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [directory, setDirectory] = useState<DiscoverManagerEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [directAddValue, setDirectAddValue] = useState('');
  const [addingIdentifier, setAddingIdentifier] = useState(false);

  const [draft, setDraft] = useState('');
  const [sendingDm, setSendingDm] = useState(false);
  const [inviteLeagueId, setInviteLeagueId] = useState<string>('');
  const [joiningInviteCode, setJoiningInviteCode] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const loadDirectory = useCallback(
    async (q: string) => {
      setSearching(true);
      try {
        const list = await social.searchManagers(q);
        setDirectory(list);
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    },
    [social.searchManagers]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      loadDirectory(searchQuery);
    }, 220);
    return () => clearTimeout(t);
  }, [searchQuery, loadDirectory, social.friends.accepted.length, social.friends.incoming.length, social.friends.outgoing.length]);

  useEffect(() => {
    return () => {
      social.setActiveFriendUid(null);
    };
  }, [social.setActiveFriendUid]);

  // Auto-select first accepted friend if none selected
  useEffect(() => {
    if (!social.activeFriendUid && social.friends.accepted.length > 0) {
      social.openConversation(social.friends.accepted[0].friend.uid);
    }
  }, [social.activeFriendUid, social.friends.accepted, social.openConversation]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [social.messages.length, social.activeFriendUid]);

  const activeFriendRecord = useMemo(
    () =>
      social.friends.accepted.find((f) => f.friend.uid === social.activeFriendUid) || null,
    [social.friends.accepted, social.activeFriendUid]
  );

  const handleDirectAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directAddValue.trim()) return;
    setAddingIdentifier(true);
    try {
      await social.sendFriendRequest({ identifier: directAddValue.trim() });
      setDirectAddValue('');
      loadDirectory(searchQuery);
    } catch (err: any) {
      onToast?.({ tone: 'error', title: 'Friend Request Failed', body: err.message });
    } finally {
      setAddingIdentifier(false);
    }
  };

  const handleAddManager = async (targetUid: string) => {
    try {
      await social.sendFriendRequest({ targetUid });
      loadDirectory(searchQuery);
    } catch (err: any) {
      onToast?.({ tone: 'error', title: 'Could not send request', body: err.message });
    }
  };

  const handleSendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!social.activeFriendUid) return;
    const text = draft.trim();
    const leagueNum = inviteLeagueId ? Number(inviteLeagueId) : undefined;
    if (!text && !leagueNum) return;

    setSendingDm(true);
    try {
      await social.sendDirectMessage(social.activeFriendUid, text, leagueNum);
      setDraft('');
      setInviteLeagueId('');
    } catch (err: any) {
      onToast?.({ tone: 'error', title: 'Message failed', body: err.message });
    } finally {
      setSendingDm(false);
    }
  };

  const handleJoinFromInvite = async (code: string) => {
    setJoiningInviteCode(code);
    try {
      const data = await apiFetch<{ league: League }>('/api/leagues/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: code }),
      });
      onToast?.({
        tone: 'success',
        title: `Joined ${data.league.name}`,
        body: 'Entering League HQ...',
      });
      onJoinedLeague?.(data.league.id);
    } catch (err: any) {
      onToast?.({ tone: 'error', title: 'Could not join league', body: err.message });
    } finally {
      setJoiningInviteCode(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#EAB308]">
            CM27 GLOBAL SOCIAL &amp; DIRECT CHAT
          </p>
          <h1 className="text-2xl sm:text-3xl font-condensed font-bold uppercase tracking-tight text-white">
            Add Friends &amp; Direct Messages
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Connect with registered managers, accept requests, chat 1-on-1, and invite friends to
            any league.
          </p>
        </div>

        {/* Quick Direct Add by Name or Email */}
        <form onSubmit={handleDirectAdd} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={directAddValue}
            onChange={(e) => setDirectAddValue(e.target.value)}
            placeholder="Manager name or email..."
            className="flex-1 sm:w-64 px-3.5 py-2 rounded bg-[#0C0F14] border border-white/12 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#93E6EE]"
          />
          <button
            type="submit"
            disabled={addingIdentifier || !directAddValue.trim()}
            className="cm27-btn-3d flex items-center gap-1.5 px-3.5 py-2 rounded disabled:opacity-50 font-bold text-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Friend
          </button>
        </form>
      </div>

      {/* Incoming Friend Requests Banner */}
      {social.friends.incoming.length > 0 && (
        <div className="cm27-panel border-[#EAB308]/35 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#EAB308]">
            <UserPlus className="w-4 h-4" />
            <span>Pending Incoming Requests ({social.friends.incoming.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {social.friends.incoming.map((req) => (
              <div
                key={req.id}
                className="cm27-panel-inset p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ManagerBadge
                    name={req.friend.managerName}
                    country={req.friend.country}
                    accent={req.friend.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {req.friend.managerName}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                      <CountryFlag country={req.friend.country} size="xs" />
                      <span>{req.friend.country}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => social.respondFriendRequest(req.id, 'accept')}
                    className="cm27-btn-dark-3d p-1.5 rounded text-[#4ADE80] cursor-pointer"
                    title="Accept Request"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => social.respondFriendRequest(req.id, 'decline')}
                    className="cm27-btn-dark-3d p-1.5 rounded text-rose-300 cursor-pointer"
                    title="Decline Request"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main 2-Column Split: Left Friends & Discover | Right 1-on-1 Direct Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left 5 Columns: Friends List + Discover Registered Managers */}
        <div className="lg:col-span-5 space-y-4 flex flex-col">
          {/* Accepted Friends */}
          <div className="cm27-panel overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.08] bg-[#0E1218] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Users className="w-4 h-4 text-[#93E6EE]" />
                <span>Your Friends ({social.friends.accepted.length})</span>
              </div>
              {social.friends.totalUnread > 0 && (
                <span className="text-[10px] font-mono text-[#EAB308] tabular-nums">
                  {social.friends.totalUnread} unread
                </span>
              )}
            </div>

            {social.friends.accepted.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No friends connected yet. Send a request to any manager below to start chatting.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06] max-h-64 overflow-y-auto">
                {social.friends.accepted.map((item) => {
                  const isActive = social.activeFriendUid === item.friend.uid;
                  return (
                    <div
                      key={item.id}
                      onClick={() => social.openConversation(item.friend.uid)}
                      className={`px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isActive ? 'bg-[#1B222D] border-l-0 ring-1 ring-inset ring-[#93E6EE]/45' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <ManagerBadge
                            name={item.friend.managerName}
                            country={item.friend.country}
                            accent={item.friend.avatarUrl}
                            size="sm"
                          />
                          <span
                            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0E1218] ${
                              item.friend.isOnline ? 'bg-[#22C55E]' : 'bg-slate-600'
                            }`}
                            title={item.friend.isOnline ? 'Online' : 'Offline'}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white truncate">
                              {item.friend.managerName}
                            </span>
                            {(item.unreadCount ?? 0) > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-[#EAB308] text-[#0B0E14] text-[10px] font-mono font-bold tabular-nums">
                                {item.unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                            {item.lastMessage ? (
                              <span>{item.lastMessage.body}</span>
                            ) : (
                              <>
                                <CountryFlag country={item.friend.country} size="xs" />
                                <span>{item.friend.country}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            social.openConversation(item.friend.uid);
                          }}
                          className="cm27-btn-dark-3d p-1.5 rounded text-[#93E6EE] cursor-pointer"
                          title="Open Chat"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            social.removeFriend(item.friend.uid);
                          }}
                          className="cm27-btn-dark-3d p-1.5 rounded text-slate-400 hover:text-rose-400 cursor-pointer"
                          title="Remove Friend"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Discover Registered CM27 Managers */}
          <div className="cm27-panel overflow-hidden flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-white/[0.08] bg-[#0E1218] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#93E6EE]" />
                  Discover Registered Managers
                </span>
                {social.friends.outgoing.length > 0 && (
                  <span className="text-[10px] font-mono text-[#EAB308] tabular-nums">
                    {social.friends.outgoing.length} sent
                  </span>
                )}
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search managers by name, email or country..."
                  className="w-full pl-8 pr-3 py-1.5 rounded bg-[#0C0F14] border border-white/12 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#93E6EE]"
                />
              </div>
            </div>

            <div className="divide-y divide-white/[0.06] max-h-72 overflow-y-auto">
              {searching && directory.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">Searching managers...</div>
              ) : directory.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No other registered managers found yet.
                </div>
              ) : (
                directory.map((m) => (
                  <div
                    key={m.uid}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <ManagerBadge
                          name={m.managerName}
                          country={m.country}
                          accent={m.avatarUrl}
                          size="sm"
                        />
                        <span
                          className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0E1218] ${
                            m.isOnline ? 'bg-[#22C55E]' : 'bg-slate-600'
                          }`}
                          title={m.isOnline ? 'Online' : 'Offline'}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {m.managerName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                          <CountryFlag country={m.country} size="xs" />
                          <span>
                            {m.country} · Rep {m.reputation}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {m.relationStatus === 'friends' ? (
                        <button
                          onClick={() => social.openConversation(m.uid)}
                          className="cm27-btn-dark-3d inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium text-[#93E6EE] cursor-pointer"
                        >
                          <UserCheck className="w-3 h-3" />
                          Chat
                        </button>
                      ) : m.relationStatus === 'outgoing_pending' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-slate-400">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      ) : m.relationStatus === 'incoming_pending' && m.friendshipId ? (
                        <button
                          onClick={() => social.respondFriendRequest(m.friendshipId!, 'accept')}
                          className="cm27-btn-dark-3d inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold text-[#EAB308] cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          Accept
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddManager(m.uid)}
                          className="cm27-btn-dark-3d inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold text-white cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 7 Columns: Live 1-on-1 Direct Chat Window */}
        <div className="lg:col-span-7 cm27-panel overflow-hidden flex flex-col min-h-[500px]">
          {activeFriendRecord ? (
            <>
              <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#0E1218] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <ManagerBadge
                      name={activeFriendRecord.friend.managerName}
                      country={activeFriendRecord.friend.country}
                      accent={activeFriendRecord.friend.avatarUrl}
                      size="sm"
                    />
                    <span
                      className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0E1218] ${
                        activeFriendRecord.friend.isOnline ? 'bg-[#22C55E]' : 'bg-slate-600'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {activeFriendRecord.friend.managerName}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      {activeFriendRecord.friend.isOnline ? (
                        <span className="text-[#4ADE80]">Online</span>
                      ) : (
                        <span>Offline</span>
                      )}
                      <span>·</span>
                      <CountryFlag country={activeFriendRecord.friend.country} size="xs" />
                      <span>{activeFriendRecord.friend.country}</span>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Direct Messages
                </span>
              </div>

              {/* Message Thread */}
              <div className="flex-1 p-5 space-y-3 overflow-y-auto bg-[#0C0F14]/75 max-h-[380px]">
                {social.messagesLoading ? (
                  <div className="text-center py-12 text-xs text-slate-500">
                    Loading conversation...
                  </div>
                ) : social.messages.length === 0 ? (
                  <div className="text-center py-16 space-y-2">
                    <MessageSquare className="w-8 h-8 text-[#93E6EE]/50 mx-auto" />
                    <div className="text-sm font-semibold text-white">
                      Say hello to {activeFriendRecord.friend.managerName}
                    </div>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Discuss auction strategy, trade targets, or send an instant invite to any of
                      your leagues.
                    </p>
                  </div>
                ) : (
                  social.messages.map((m) => {
                    const isMine = m.senderUid === user?.uid;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[82%] rounded px-4 py-2.5 text-xs space-y-2 ${
                            isMine
                              ? 'bg-[#1D2532] border border-[#93E6EE]/40 text-white'
                              : 'bg-[#131720] border border-white/10 text-slate-100'
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>

                          {m.inviteCode && (
                            <div className="cm27-panel-inset p-2.5 border-[#EAB308]/35 flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[10px] font-mono uppercase text-[#EAB308]">
                                  LEAGUE INVITE · {m.inviteCode}
                                </div>
                                <div className="text-xs font-semibold text-white">
                                  {m.inviteLeagueName || 'Multiplayer League'}
                                </div>
                              </div>
                              {onJoinedLeague && (
                                <button
                                  type="button"
                                  disabled={joiningInviteCode === m.inviteCode}
                                  onClick={() => handleJoinFromInvite(m.inviteCode!)}
                                  className="cm27-btn-3d px-3 py-1.5 rounded font-bold text-[11px] cursor-pointer shrink-0"
                                >
                                  {joiningInviteCode === m.inviteCode ? 'Joining...' : 'Join League'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 mt-1 px-1">
                          {formatTimeAgo(m.createdAt)}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Composer */}
              <form
                onSubmit={handleSendDm}
                className="p-4 border-t border-white/[0.08] bg-[#0E1218] space-y-2.5"
              >
                {leagues.length > 0 && (
                  <div className="flex items-center gap-2">
                    <ShieldPlus className="w-3.5 h-3.5 text-[#EAB308] shrink-0" />
                    <select
                      value={inviteLeagueId}
                      onChange={(e) => setInviteLeagueId(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded bg-[#0C0F14] border border-white/12 text-xs text-slate-200 focus:outline-none focus:border-[#EAB308]"
                    >
                      <option value="">Optional: Attach a league invite card...</option>
                      {leagues.map((l) => (
                        <option key={l.id} value={String(l.id)}>
                          Invite to {l.name} (Code: {l.inviteCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={500}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Message ${activeFriendRecord.friend.managerName}...`}
                    className="flex-1 px-3.5 py-2.5 rounded bg-[#0C0F14] border border-white/12 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#93E6EE]"
                  />
                  <button
                    type="submit"
                    disabled={sendingDm || (!draft.trim() && !inviteLeagueId)}
                    className="cm27-btn-3d flex items-center gap-1.5 px-4 py-2.5 rounded disabled:opacity-50 font-bold text-xs cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded bg-[#181E27] border border-white/15 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-[#93E6EE]" />
              </div>
              <h3 className="text-base font-semibold text-white">Direct 1-on-1 Manager Chat</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Add any registered manager from the directory on the left or search by name/email.
                Once accepted, select them to chat directly without needing a shared league first.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
