import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, getFreshIdToken } from '../lib/api';
import { auth } from '../lib/firebase';
import { DEMO_LEAGUE_STATE, isAutostartDemo } from '../utils/demoLeagueState';
import type {
  AuctionSnapshot,
  LeagueChatMessage,
  LeagueNotification,
  LeagueStateSnapshot,
} from '../types/game';

export interface ToastNotice {
  id: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body?: string;
}

export function useLeagueRealtime(
  leagueId: number | null,
  onLeagueDeleted?: (payload: { leagueId: number; leagueName?: string }) => void,
  currentUid?: string | null
) {
  const [state, setState] = useState<LeagueStateSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [squadVersion, setSquadVersion] = useState(0);
  const [playersVersion, setPlayersVersion] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const onLeagueDeletedRef = useRef(onLeagueDeleted);
  onLeagueDeletedRef.current = onLeagueDeleted;
  const currentUidRef = useRef(currentUid);
  currentUidRef.current = currentUid;

  const pushToast = useCallback((notice: Omit<ToastNotice, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { ...notice, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchLeagueState = useCallback(async (id: number) => {
    try {
      const data = await apiFetch<LeagueStateSnapshot>(`/api/leagues/${id}/state`);
      if (!unmountedRef.current) {
        setState(data);
        if (data.auctionSnapshot?.serverTime) {
          setClockOffsetMs(data.auctionSnapshot.serverTime - Date.now());
        }
        setError(null);
      }
    } catch (err: any) {
      if (!unmountedRef.current) {
        setError(err.message || 'Failed to synchronize league state.');
      }
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    if (!leagueId) {
      setState(null);
      setWsConnected(false);
      return;
    }

    if (isAutostartDemo() && !auth.currentUser) {
      setState(DEMO_LEAGUE_STATE);
      setWsConnected(true);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    fetchLeagueState(leagueId).finally(() => {
      if (active) setLoading(false);
    });

    let retryAttempt = 0;

    const connectWs = async () => {
      if (!active) return;
      try {
        const token = await getFreshIdToken(false);
        if (!active) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!active) {
            ws.close();
            return;
          }
          retryAttempt = 0;
          setWsConnected(true);
          ws.send(JSON.stringify({ type: 'subscribe_league', leagueId }));
          // Refresh authoritative state on (re)connect
          fetchLeagueState(leagueId);
        };

        ws.onmessage = (event) => {
          if (!active) return;
          try {
            const msg = JSON.parse(event.data);
            if (typeof msg.serverTime === 'number') {
              setClockOffsetMs(msg.serverTime - Date.now());
            }

            switch (msg.type) {
              case 'presence:update': {
                const onlineSet = new Set<string>(msg.payload?.onlineUids || []);
                setState((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    onlineUids: Array.from(onlineSet),
                    members: prev.members.map((m) => ({
                      ...m,
                      isOnline: onlineSet.has(m.userUid),
                    })),
                    teams: prev.teams.map((t) => ({
                      ...t,
                      ownerOnline: t.ownerUid ? onlineSet.has(t.ownerUid) : false,
                    })),
                  };
                });
                break;
              }

              case 'league:updated': {
                setState((prev) => {
                  if (!prev) return prev;
                  const nextTeams = msg.payload?.teams ?? prev.teams;
                  const myUid = prev.myTeam?.ownerUid;
                  return {
                    ...prev,
                    league: msg.payload?.league ?? prev.league,
                    members: msg.payload?.members ?? prev.members,
                    teams: nextTeams,
                    myTeam: myUid
                      ? nextTeams.find((t: any) => t.ownerUid === myUid) ?? prev.myTeam
                      : prev.myTeam,
                  };
                });
                // Also pull full state to ensure myTeam is accurate if newly claimed
                fetchLeagueState(leagueId);
                break;
              }

              case 'auction:state': {
                const snapshot = msg.payload as AuctionSnapshot;
                setState((prev) => (prev ? { ...prev, auctionSnapshot: snapshot } : prev));
                break;
              }

              case 'auction:bid': {
                const snapshot = msg.payload?.snapshot as AuctionSnapshot;
                setState((prev) => (prev ? { ...prev, auctionSnapshot: snapshot } : prev));
                break;
              }

              case 'auction:lot_settled': {
                const p = msg.payload;
                if (p?.outcome === 'sold') {
                  pushToast({
                    tone: 'success',
                    title: `${p.playerName} sold to ${p.winningTeamShortCode}`,
                    body: `Winning bid committed to franchise squad.`,
                  });
                } else {
                  pushToast({
                    tone: 'warning',
                    title: `${p?.playerName || 'Player'} went unsold`,
                  });
                }
                fetchLeagueState(leagueId);
                setSquadVersion((v) => v + 1);
                setPlayersVersion((v) => v + 1);
                break;
              }

              case 'auction:paused': {
                pushToast({
                  tone: 'warning',
                  title: 'Auction Paused',
                  body: msg.payload?.pausedByName
                    ? `Paused by ${msg.payload.pausedByName}. Bidding frozen until resumed.`
                    : 'Bidding frozen until someone resumes.',
                });
                fetchLeagueState(leagueId);
                break;
              }

              case 'auction:resumed': {
                pushToast({
                  tone: 'success',
                  title: 'Auction Resumed',
                  body: msg.payload?.resumedByName
                    ? `Resumed by ${msg.payload.resumedByName}. Bidding is live.`
                    : 'Bidding is live again.',
                });
                fetchLeagueState(leagueId);
                break;
              }

              case 'auction:pause_requested': {
                const p = msg.payload;
                pushToast({
                  tone: 'warning',
                  title: `Pause Requested (${p?.requestedByName || 'Manager'})`,
                  body: p?.teamShortCode
                    ? `${p.requestedByName} (${p.teamShortCode}) requested an auction pause.`
                    : `${p?.requestedByName || 'A manager'} requested an auction pause.`,
                });
                setState((prev) => {
                  if (!prev || !prev.auctionSnapshot) return prev;
                  return {
                    ...prev,
                    auctionSnapshot: {
                      ...prev.auctionSnapshot,
                      auction: {
                        ...prev.auctionSnapshot.auction,
                        pauseRequestsJson: Array.isArray(p?.pauseRequests)
                          ? p.pauseRequests
                          : prev.auctionSnapshot.auction.pauseRequestsJson,
                      },
                    },
                  };
                });
                fetchLeagueState(leagueId);
                break;
              }

              case 'auction:auto_sim_vote': {
                const p = msg.payload;
                if (p?.agree) {
                  pushToast({
                    tone: 'info',
                    title: `Auto-Sim Vote (${p.agreedCount}/${p.requiredCount})`,
                    body: `${p.managerName || 'A manager'} agreed to auto-simulate the auction.`,
                  });
                }
                setState((prev) => {
                  if (!prev || !prev.auctionSnapshot) return prev;
                  return {
                    ...prev,
                    auctionSnapshot: {
                      ...prev.auctionSnapshot,
                      auction: {
                        ...prev.auctionSnapshot.auction,
                        autoSimVotesJson: Array.isArray(p?.votes)
                          ? p.votes
                          : prev.auctionSnapshot.auction.autoSimVotesJson,
                      },
                    },
                  };
                });
                break;
              }

              case 'auction:skip_vote': {
                const p = msg.payload;
                if (p?.agree && p?.managerName) {
                  pushToast({
                    tone: 'info',
                    title: `Skip Vote (${p.agreedCount}/${p.requiredCount})`,
                    body: `${p.managerName} voted to skip ${p.playerName || 'current lot'}.`,
                  });
                }
                setState((prev) => {
                  if (!prev || !prev.auctionSnapshot) return prev;
                  return {
                    ...prev,
                    auctionSnapshot: {
                      ...prev.auctionSnapshot,
                      auction: {
                        ...prev.auctionSnapshot.auction,
                        skipVotesJson: Array.isArray(p?.votes)
                          ? p.votes
                          : prev.auctionSnapshot.auction.skipVotesJson,
                      },
                    },
                  };
                });
                break;
              }

              case 'auction:auto_simulated': {
                const p = msg.payload;
                pushToast({
                  tone: 'success',
                  title: 'Auction Auto-Simulated!',
                  body: `${p?.soldCount ?? 'All'} players assigned. Every club now has a 22+ player squad.`,
                });
                fetchLeagueState(leagueId);
                setSquadVersion((v) => v + 1);
                setPlayersVersion((v) => v + 1);
                break;
              }

              case 'fixture:pvp_update': {
                const updatedFx = msg.payload?.fixture;
                if (updatedFx) {
                  setState((prev) => {
                    if (!prev) return prev;
                    const existingFixtures = prev.fixtures || [];
                    const exists = existingFixtures.some((f) => f.id === updatedFx.id);
                    const nextFixtures = exists
                      ? existingFixtures.map((f) => (f.id === updatedFx.id ? updatedFx : f))
                      : [...existingFixtures, updatedFx];
                    return {
                      ...prev,
                      fixtures: nextFixtures,
                    };
                  });
                }
                break;
              }

              case 'squad:updated': {
                setSquadVersion((v) => v + 1);
                fetchLeagueState(leagueId);
                break;
              }

              case 'players:imported': {
                setPlayersVersion((v) => v + 1);
                pushToast({
                  tone: 'info',
                  title: 'Player Pool Updated',
                  body: `${msg.payload?.count ?? ''} players added to the league catalog.`,
                });
                fetchLeagueState(leagueId);
                break;
              }

              case 'chat:message': {
                const chatMsg = msg.payload as LeagueChatMessage;
                if (
                  chatMsg.messageType === 'chat' &&
                  chatMsg.userUid &&
                  chatMsg.userUid !== currentUidRef.current
                ) {
                  pushToast({
                    tone: 'info',
                    title: `${chatMsg.managerName || 'Manager'}${
                      chatMsg.teamShortCode ? ` (${chatMsg.teamShortCode})` : ''
                    }`,
                    body: chatMsg.body,
                  });
                }
                setState((prev) => {
                  if (!prev) return prev;
                  if (prev.messages.some((m) => m.id === chatMsg.id)) return prev;
                  return {
                    ...prev,
                    messages: [...prev.messages.slice(-80), chatMsg],
                  };
                });
                break;
              }

              case 'notification:new': {
                const notif = msg.payload as LeagueNotification;
                setState((prev) => {
                  if (!prev) return prev;
                  if (prev.notifications.some((n) => n.id === notif.id)) return prev;
                  return {
                    ...prev,
                    notifications: [notif, ...prev.notifications].slice(0, 40),
                  };
                });
                break;
              }

              case 'match:completed': {
                pushToast({
                  tone: 'success',
                  title: 'Match Result Confirmed',
                  body: msg.payload?.headline || 'Match scorecard recorded to League HQ.',
                });
                fetchLeagueState(leagueId);
                break;
              }

              case 'gazette:new': {
                const story = msg.payload;
                if (story?.id) {
                  setState((prev) => {
                    if (!prev) return prev;
                    const cur = prev.newsFeed || [];
                    if (cur.some((n) => n.id === story.id)) return prev;
                    return {
                      ...prev,
                      newsFeed: [story, ...cur].slice(0, 40),
                    };
                  });
                }
                break;
              }

              case 'trade:updated': {
                fetchLeagueState(leagueId);
                setSquadVersion((v) => v + 1);
                break;
              }

              case 'training:completed': {
                if (msg.payload?.unlockedTrait) {
                  pushToast({
                    tone: 'success',
                    title: 'Broadcast Trait Unlocked',
                    body: `Player earned ${msg.payload.unlockedTrait} badge at Training Ground.`,
                  });
                }
                fetchLeagueState(leagueId);
                setSquadVersion((v) => v + 1);
                break;
              }

              case 'match:press_ready': {
                pushToast({
                  tone: 'info',
                  title: 'Press Conference Ready',
                  body: 'Correspondents have filed questions in The League Gazette.',
                });
                fetchLeagueState(leagueId);
                break;
              }

              case 'press:completed': {
                fetchLeagueState(leagueId);
                break;
              }

              case 'league:deleted': {
                onLeagueDeletedRef.current?.(msg.payload);
                break;
              }
            }
          } catch (err) {
            console.error('WS message parse error:', err);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          if (!active) return;
          const delay = Math.min(8000, 1000 * Math.pow(1.6, retryAttempt));
          retryAttempt++;
          reconnectTimerRef.current = setTimeout(connectWs, delay);
        };
      } catch (err) {
        console.error('WS connect error:', err);
        if (active) {
          reconnectTimerRef.current = setTimeout(connectWs, 3000);
        }
      }
    };

    connectWs();

    return () => {
      active = false;
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [leagueId, fetchLeagueState, pushToast]);

  return {
    state,
    loading,
    error,
    wsConnected,
    clockOffsetMs,
    toasts,
    pushToast,
    dismissToast,
    squadVersion,
    playersVersion,
    refreshState: () => (leagueId ? fetchLeagueState(leagueId) : Promise.resolve()),
  };
}
