import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { LeagueStateSnapshot } from '../types/game';
import { apiFetch } from '../lib/api';
import { formatClockTime } from '../utils/format';
import { TeamCrest } from '../components/TeamCrest';
import { ManagerBadge } from '../components/ManagerBadge';

export function LeagueChatView({
  state,
  currentUid,
  onToast,
}: {
  state: LeagueStateSnapshot;
  currentUid: string;
  onToast: (t: { tone: 'error'; title: string; body?: string }) => void;
}) {
  const { league, messages, members, teams } = state;
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await apiFetch(`/api/leagues/${league.id}/chat`, {
        method: 'POST',
        body: JSON.stringify({ body: trimmed }),
      });
      setBody('');
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Message failed', body: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-13rem)] min-h-[480px]">
      {/* Chat Thread */}
      <div className="lg:col-span-8 cm27-panel flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08] bg-[#0B0F15]">
          <h1 className="text-xl font-condensed font-bold uppercase text-white">
            {league.name} · League Communications
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Private league-wide channel · Restricted to active league members
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-xs text-slate-500 py-10">
              No messages yet. Start the discussion with your rival managers.
            </div>
          ) : (
            messages.map((m) => {
              if (m.messageType === 'system') {
                return (
                  <div
                    key={m.id}
                    className="cm27-panel-inset flex items-center justify-between gap-4 py-2 px-3 text-xs text-slate-400"
                  >
                    <span>
                      <strong className="font-mono text-[#EAB308] mr-2">
                        [{m.teamShortCode || 'HQ'}]
                      </strong>
                      {m.body}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                      {formatClockTime(m.createdAt)}
                    </span>
                  </div>
                );
              }

              const isMe = m.userUid === currentUid;
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1">
                    <span className="font-medium text-slate-200">
                      {m.managerName || 'Manager'}
                    </span>
                    {m.teamShortCode && (
                      <span className="font-mono text-[#EAB308]">{m.teamShortCode}</span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{formatClockTime(m.createdAt)}</span>
                  </div>
                  <div
                    className={`max-w-lg px-4 py-2.5 rounded text-sm ${
                      isMe
                        ? 'bg-[#222B38] border border-[#93E6EE]/45 text-white font-medium'
                        : 'bg-[#0C1016] border border-white/[0.08] text-slate-100'
                    }`}
                  >
                    {m.body}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSend}
          className="p-4 border-t border-white/[0.08] bg-[#0B0F15] flex items-center gap-3"
        >
          <input
            type="text"
            maxLength={500}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message league managers..."
            className="flex-1 px-4 py-2.5 rounded bg-[#0C0F14] border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#93E6EE]"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="cm27-btn-3d flex items-center gap-2 px-4 py-2.5 rounded disabled:opacity-40 font-bold text-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>

      {/* Online Managers Roster */}
      <div className="lg:col-span-4 cm27-panel overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-white/[0.08] bg-[#0B0F15]">
          <h2 className="text-sm font-semibold text-white">League Managers</h2>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            {members.filter((m) => m.isOnline).length} online · {members.length} total
          </p>
        </div>

        <div className="divide-y divide-white/[0.05] overflow-y-auto flex-1">
          {members.map((m) => {
            const team = teams.find((t) => t.ownerUid === m.userUid);
            return (
              <div key={m.userUid} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ManagerBadge
                    name={m.managerName || 'Manager'}
                    country={m.country}
                    accent={m.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {m.managerName || 'Manager'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                      {team ? (
                        <>
                          <TeamCrest
                            templateKey={team.templateKey}
                            shortCode={team.shortCode}
                            primaryColor={team.primaryColor}
                            secondaryColor={team.secondaryColor}
                            size="xs"
                          />
                          <span>
                            {team.shortCode} · {team.name}
                          </span>
                        </>
                      ) : (
                        <span>No club claimed</span>
                      )}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-xs font-mono shrink-0 ${
                    m.isOnline ? 'text-[#4ADE80]' : 'text-slate-500'
                  }`}
                >
                  {m.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
