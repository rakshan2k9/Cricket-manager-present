import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, getFreshIdToken } from '../lib/api';
import { auth } from '../lib/firebase';
import { isAutostartDemo } from '../utils/demoLeagueState';
import type {
  DirectMessageRecord,
  DiscoverManagerEntry,
  FriendshipRecord,
} from '../types/game';

interface FriendsPayload {
  accepted: FriendshipRecord[];
  incoming: FriendshipRecord[];
  outgoing: FriendshipRecord[];
  totalUnread: number;
}

export function useGlobalSocial(
  enabled: boolean,
  onToast?: (t: { tone: 'info' | 'success' | 'warning' | 'error'; title: string; body?: string }) => void,
  onLeagueDeleted?: (payload: { leagueId: number; leagueName: string }) => void
) {
  const [friends, setFriends] = useState<FriendsPayload>({
    accepted: [],
    incoming: [],
    outgoing: [],
    totalUnread: 0,
  });
  const [loading, setLoading] = useState(false);
  const [activeFriendUid, setActiveFriendUid] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessageRecord[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const activeFriendRef = useRef<string | null>(null);
  activeFriendRef.current = activeFriendUid;

  const refreshFriends = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await apiFetch<FriendsPayload>('/api/friends');
      setFriends(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const openConversation = useCallback(
    async (friendUid: string) => {
      setActiveFriendUid(friendUid);
      setMessagesLoading(true);
      try {
        const data = await apiFetch<{ messages: DirectMessageRecord[] }>(`/api/dm/${friendUid}`);
        setMessages(data.messages || []);
        refreshFriends();
      } catch (err: any) {
        onToast?.({ tone: 'error', title: 'Could not open chat', body: err.message });
      } finally {
        setMessagesLoading(false);
      }
    },
    [refreshFriends, onToast]
  );

  const sendDirectMessage = useCallback(
    async (friendUid: string, body: string, leagueId?: number) => {
      const data = await apiFetch<{ message: DirectMessageRecord }>(`/api/dm/${friendUid}`, {
        method: 'POST',
        body: JSON.stringify({ body, leagueId }),
      });
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
      refreshFriends();
      return data.message;
    },
    [refreshFriends]
  );

  const searchManagers = useCallback(async (q: string) => {
    const data = await apiFetch<{ managers: DiscoverManagerEntry[] }>(
      `/api/friends/search?q=${encodeURIComponent(q)}`
    );
    return data.managers || [];
  }, []);

  const sendFriendRequest = useCallback(
    async (payload: { targetUid?: string; identifier?: string }) => {
      const data = await apiFetch<{ friendship: any; autoAccepted: boolean }>('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await refreshFriends();
      onToast?.({
        tone: 'success',
        title: data.autoAccepted ? 'Friend Connected!' : 'Friend Request Sent',
        body: data.autoAccepted
          ? 'You both had pending requests — now connected.'
          : 'They can accept from their Friends hub.',
      });
      return data;
    },
    [refreshFriends, onToast]
  );

  const respondFriendRequest = useCallback(
    async (friendshipId: number, action: 'accept' | 'decline') => {
      await apiFetch('/api/friends/respond', {
        method: 'POST',
        body: JSON.stringify({ friendshipId, action }),
      });
      await refreshFriends();
      onToast?.({
        tone: action === 'accept' ? 'success' : 'info',
        title: action === 'accept' ? 'Friend Request Accepted' : 'Request Removed',
      });
    },
    [refreshFriends, onToast]
  );

  const removeFriend = useCallback(
    async (friendUid: string) => {
      await apiFetch(`/api/friends/${friendUid}`, { method: 'DELETE' });
      if (activeFriendRef.current === friendUid) {
        setActiveFriendUid(null);
        setMessages([]);
      }
      await refreshFriends();
      onToast?.({ tone: 'info', title: 'Removed from friends list' });
    },
    [refreshFriends, onToast]
  );

  useEffect(() => {
    if (!enabled || (isAutostartDemo() && !auth.currentUser)) {
      setFriends({ accepted: [], incoming: [], outgoing: [], totalUnread: 0 });
      setActiveFriendUid(null);
      setMessages([]);
      return;
    }

    refreshFriends();

    let active = true;
    let retryAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (!active) return;
      try {
        const token = await getFreshIdToken(false);
        if (!active) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
        wsRef.current = ws;

        ws.onopen = () => {
          retryAttempt = 0;
        };

        ws.onmessage = (event) => {
          if (!active) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'friend:request') {
              const fromName = msg.payload?.from?.managerName || 'A manager';
              onToast?.({
                tone: 'info',
                title: `Friend Request from ${fromName}`,
                body: 'Open Friends & Chat to accept or decline.',
              });
              refreshFriends();
            } else if (msg.type === 'friend:updated') {
              refreshFriends();
            } else if (msg.type === 'dm:message') {
              const dm = msg.payload?.message as DirectMessageRecord | undefined;
              const senderName = msg.payload?.sender?.managerName || 'Friend';
              if (!dm) return;

              const currentOpen = activeFriendRef.current;
              const isInActiveThread =
                currentOpen &&
                (dm.senderUid === currentOpen || dm.recipientUid === currentOpen);

              if (isInActiveThread) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === dm.id)) return prev;
                  return [...prev, dm];
                });
                // Mark as read if received in open thread
                if (dm.senderUid === currentOpen) {
                  apiFetch(`/api/dm/${currentOpen}`).catch(() => {});
                }
              } else if (msg.payload?.sender?.uid && dm.senderUid === msg.payload.sender.uid) {
                onToast?.({
                  tone: 'info',
                  title: `New Message from ${senderName}`,
                  body: dm.body,
                });
              }
              refreshFriends();
            } else if (msg.type === 'league:deleted') {
              onLeagueDeleted?.(msg.payload);
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          if (!active) return;
          const delay = Math.min(10000, 1500 * Math.pow(1.5, retryAttempt));
          retryAttempt += 1;
          reconnectTimer = setTimeout(connect, delay);
        };
      } catch {
        if (active) {
          reconnectTimer = setTimeout(connect, 4000);
        }
      }
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, refreshFriends, onToast, onLeagueDeleted]);

  return {
    friends,
    loading,
    activeFriendUid,
    setActiveFriendUid,
    messages,
    messagesLoading,
    refreshFriends,
    openConversation,
    sendDirectMessage,
    searchManagers,
    sendFriendRequest,
    respondFriendRequest,
    removeFriend,
  };
}
