import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  FastForward,
  Gavel,
  Layers,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Send,
  Settings,
  Shield,
  SkipForward,
  Target,
  Users,
  X,
} from 'lucide-react';
import type { AuctionLot, LeagueStateSnapshot, Player, SquadPlayer, Team } from '../types/game';
import { apiFetch } from '../lib/api';
import {
  formatClockTime,
  formatCurrencyLakhs,
  formatOvrWithDelta,
  formatTimeAgo,
  getPlayerOverall,
} from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { PlayerProfileModal } from '../components/PlayerProfileModal';
import { TeamCrest } from '../components/TeamCrest';
import { CountryFlag } from '../components/CountryFlag';
import type { ActiveTab } from '../components/AppShell';

interface LotRow {
  lot: AuctionLot;
  player: Player;
  winningTeamName: string | null;
  winningTeamShortCode: string | null;
  winningTeamColor: string | null;
}

interface SetSummaryRow {
  setName: string;
  total: number;
  pending: number;
  sold: number;
  unsold: number;
  completed: boolean;
}

interface BookmarkedStatusRow {
  playerId: number;
  playerName: string;
  primaryRole: string;
  country: string;
  ovr: number;
  marqueeSet: string;
  status: string;
  basePrice: number;
  soldPrice: number | null;
  winningTeamShortCode: string | null;
}

export function AuctionRoomView({
  state,
  clockOffsetMs,
  onToast,
  onRefreshLeague,
  onNavigate,
}: {
  state: LeagueStateSnapshot;
  clockOffsetMs: number;
  onToast: (t: { tone: 'success' | 'error' | 'info' | 'warning'; title: string; body?: string }) => void;
  onRefreshLeague: () => Promise<void>;
  onNavigate?: (tab: ActiveTab) => void;
}) {
  const { user, profile } = useAuth();
  const currency = profile?.preferredCurrency || 'INR';
  const { league, teams, myTeam, auctionSnapshot } = state;
  const isHost = league.myRole === 'host';
  const auction = auctionSnapshot?.auction;
  const currentLot = auctionSnapshot?.currentLot;
  const currentPlayer = auctionSnapshot?.currentPlayer;
  const recentBids = auctionSnapshot?.recentBids || [];
  const counts = auctionSnapshot?.counts || { total: 0, pending: 0, sold: 0, unsold: 0 };
  const bookmarkedIds = myTeam?.bookmarkedPlayerIdsJson || [];

  const [secondsLeft, setSecondsLeft] = useState<number>(league.auctionDurationSec);
  const [bidding, setBidding] = useState(false);
  const [customBidInput, setCustomBidInput] = useState<string>('');
  const [customBidUnit, setCustomBidUnit] = useState<'Cr' | 'L'>('Cr');
  const [lotTab, setLotTab] = useState<'sets' | 'sold' | 'unsold' | 'targets'>('sets');
  const [lots, setLots] = useState<LotRow[]>([]);
  const [setSummary, setSetSummary] = useState<SetSummaryRow[]>([]);
  const [bookmarkedStatuses, setBookmarkedStatuses] = useState<BookmarkedStatusRow[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [profilePlayer, setProfilePlayer] = useState<Player | null>(null);
  const [purseScope, setPurseScope] = useState<'claimed' | 'all'>('all');
  const [bookmarkBusyId, setBookmarkBusyId] = useState<number | null>(null);
  const [autoSimBusy, setAutoSimBusy] = useState(false);
  const [skipVoteBusy, setSkipVoteBusy] = useState(false);
  const alertedLotIdRef = useRef<number | null>(null);

  // Squad Inspector Modal state (own + any rival club)
  const [inspectSquadTeamId, setInspectSquadTeamId] = useState<number | null>(null);
  const [inspectSquadData, setInspectSquadData] = useState<{
    team: Team;
    squad: SquadPlayer[];
  } | null>(null);
  const [loadingInspectSquad, setLoadingInspectSquad] = useState(false);

  // In-Auction Mini Chat state
  const [chatDraft, setChatDraft] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const miniChatEndRef = useRef<HTMLDivElement | null>(null);

  // Settings Modal (host only)
  const [showSettings, setShowSettings] = useState(false);
  const [cfgBudgetCr, setCfgBudgetCr] = useState(Math.round(league.startingBudget / 100));
  const [cfgMaxSquad, setCfgMaxSquad] = useState(league.maxSquadSize);
  const [cfgMaxOverseas, setCfgMaxOverseas] = useState(league.maxOverseas);
  const [cfgBasePrice, setCfgBasePrice] = useState(league.defaultBasePrice);
  const [cfgBidInc, setCfgBidInc] = useState(league.bidIncrement);
  const [cfgDuration, setCfgDuration] = useState(league.auctionDurationSec);
  const [savingCfg, setSavingCfg] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      if (!auction) return;
      if (auction.status === 'paused') {
        setSecondsLeft(auction.remainingSecondsOnPause ?? league.auctionDurationSec);
        return;
      }
      if (auction.status === 'live' && auction.lotEndsAt) {
        const syncedNow = Date.now() + clockOffsetMs;
        const endMs = new Date(auction.lotEndsAt).getTime();
        const rem = Math.max(0, Math.ceil((endMs - syncedNow) / 1000));
        setSecondsLeft(rem);
      } else {
        setSecondsLeft(league.auctionDurationSec);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 200);
    return () => clearInterval(interval);
  }, [auction, clockOffsetMs, league.auctionDurationSec]);

  const fetchLots = useCallback(async () => {
    setLoadingLots(true);
    try {
      const data = await apiFetch<{
        lots: LotRow[];
        setSummary?: SetSummaryRow[];
        bookmarkedStatuses?: BookmarkedStatusRow[];
      }>(`/api/leagues/${league.id}/auction/lots`);
      setLots(data.lots || []);
      setSetSummary(data.setSummary || []);
      setBookmarkedStatuses(data.bookmarkedStatuses || []);
    } catch {
      // silent
    } finally {
      setLoadingLots(false);
    }
  }, [league.id]);

  useEffect(() => {
    fetchLots();
  }, [fetchLots, counts.sold, counts.unsold, counts.pending, bookmarkedIds.length]);

  useEffect(() => {
    if (
      auction?.status === 'live' &&
      currentLot &&
      currentPlayer &&
      bookmarkedIds.includes(currentPlayer.id) &&
      alertedLotIdRef.current !== currentLot.id
    ) {
      alertedLotIdRef.current = currentLot.id;
      onToast({
        tone: 'info',
        title: `Scouted Target On Stage: ${currentPlayer.name}`,
        body: `Lot #${currentLot.lotOrder} (${currentPlayer.primaryRole} · OVR ${getPlayerOverall(currentPlayer)}) is now live for bidding.`,
      });
    }
  }, [auction?.status, currentLot, currentPlayer, bookmarkedIds, onToast]);

  // Fetch squad when Inspector Modal is open
  useEffect(() => {
    if (!inspectSquadTeamId) return;
    let active = true;
    setLoadingInspectSquad(true);
    apiFetch<{ team: Team; squad: SquadPlayer[] }>(
      `/api/leagues/${league.id}/teams/${inspectSquadTeamId}/squad`
    )
      .then((res) => {
        if (active) setInspectSquadData({ team: res.team, squad: res.squad || [] });
      })
      .catch(() => {
        if (active) setInspectSquadData(null);
      })
      .finally(() => {
        if (active) setLoadingInspectSquad(false);
      });
    return () => {
      active = false;
    };
  }, [inspectSquadTeamId, league.id, counts.sold]);

  // Auto-scroll mini chat when messages arrive
  useEffect(() => {
    miniChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages.length]);

  // Close Squad Inspector on Escape
  useEffect(() => {
    if (!inspectSquadTeamId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspectSquadTeamId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspectSquadTeamId]);

  const handleToggleBookmark = async (player: Player, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!myTeam) {
      onToast({
        tone: 'error',
        title: 'Claim a club first',
        body: 'Claim a club in Teams to bookmark auction targets.',
      });
      return;
    }
    setBookmarkBusyId(player.id);
    try {
      const res = await apiFetch<{ bookmarked: boolean; playerName: string }>(
        `/api/leagues/${league.id}/teams/${myTeam.id}/bookmarks/toggle`,
        {
          method: 'POST',
          body: JSON.stringify({ playerId: player.id }),
        }
      );
      await onRefreshLeague();
      onToast({
        tone: res.bookmarked ? 'success' : 'info',
        title: res.bookmarked ? `Bookmarked ${res.playerName}` : `Removed ${res.playerName}`,
      });
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Bookmark failed', body: err.message });
    } finally {
      setBookmarkBusyId(null);
    }
  };

  const handleHostAction = async (endpoint: string, label: string) => {
    try {
      await apiFetch(`/api/leagues/${league.id}/auction/${endpoint}`, { method: 'POST' });
      await onRefreshLeague();
    } catch (err: any) {
      onToast({ tone: 'error', title: `${label} failed`, body: err.message });
    }
  };

  const handleToggleAutoSimVote = async (agree: boolean) => {
    setAutoSimBusy(true);
    try {
      const res = await apiFetch<{
        triggered: boolean;
        agreedCount: number;
        requiredCount: number;
      }>(`/api/leagues/${league.id}/auction/auto-sim/vote`, {
        method: 'POST',
        body: JSON.stringify({ agree }),
      });
      await onRefreshLeague();
      if (!res.triggered) {
        onToast({
          tone: agree ? 'info' : 'warning',
          title: agree
            ? `Auto-Sim Agreed (${res.agreedCount}/${res.requiredCount})`
            : 'Auto-Sim Vote Withdrawn',
          body: agree
            ? 'Waiting for all remaining human managers in the league to agree.'
            : 'Auction will continue live unless all managers agree.',
        });
      }
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Auto-Sim Vote Failed', body: err.message });
    } finally {
      setAutoSimBusy(false);
    }
  };

  const handleToggleSkipVote = async (agree: boolean) => {
    if (!currentLot) return;
    setSkipVoteBusy(true);
    try {
      const res = await apiFetch<{
        skipped: boolean;
        agreedCount: number;
        requiredCount: number;
      }>(`/api/leagues/${league.id}/auction/skip-vote`, {
        method: 'POST',
        body: JSON.stringify({ agree }),
      });
      await onRefreshLeague();
      if (res.skipped) {
        onToast({
          tone: 'info',
          title: 'Player Resolved by Skip Vote',
          body: 'Resolved using AI market valuation and moved to the next lot.',
        });
      } else {
        onToast({
          tone: agree ? 'info' : 'warning',
          title: agree
            ? `Voted to Skip (${res.agreedCount}/${res.requiredCount})`
            : 'Skip Vote Withdrawn',
          body: agree
            ? 'Lot advances immediately once all human managers agree to skip.'
            : 'Lot continues unless all human managers vote skip.',
        });
      }
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Skip Vote Failed', body: err.message });
    } finally {
      setSkipVoteBusy(false);
    }
  };

  const handlePlaceBid = async (amount: number) => {
    if (!currentLot) return;
    setBidding(true);
    try {
      await apiFetch(`/api/leagues/${league.id}/auction/bid`, {
        method: 'POST',
        body: JSON.stringify({ amount, lotId: currentLot.id }),
      });
      setCustomBidInput('');
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Bid Rejected', body: err.message });
    } finally {
      setBidding(false);
    }
  };

  const handleSubmitCustomBid = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = Number(customBidInput);
    if (!Number.isFinite(raw) || raw <= 0) {
      onToast({ tone: 'error', title: 'Enter a valid bid number' });
      return;
    }
    const targetLakhs = customBidUnit === 'Cr' ? Math.round(raw * 100) : Math.round(raw);
    await handlePlaceBid(targetLakhs);
  };

  const handleSendMiniChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatDraft.trim();
    if (!text) return;
    setSendingChat(true);
    try {
      await apiFetch(`/api/leagues/${league.id}/chat`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      });
      setChatDraft('');
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Chat failed', body: err.message });
    } finally {
      setSendingChat(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCfg(true);
    try {
      await apiFetch(`/api/leagues/${league.id}/auction/settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          startingBudget: cfgBudgetCr * 100,
          maxSquadSize: cfgMaxSquad,
          maxOverseas: cfgMaxOverseas,
          defaultBasePrice: cfgBasePrice,
          bidIncrement: cfgBidInc,
          auctionDurationSec: cfgDuration,
        }),
      });
      setShowSettings(false);
      await onRefreshLeague();
      onToast({ tone: 'success', title: 'Auction Rules Updated' });
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Update Failed', body: err.message });
    } finally {
      setSavingCfg(false);
    }
  };

  const leadingTeam = teams.find((t) => t.id === auction?.highestBidderTeamId) ?? null;
  const minNextBid = currentLot
    ? auction?.currentBid === 0
      ? currentLot.basePrice
      : (auction?.currentBid || 0) + league.bidIncrement
    : 0;

  const isAlreadyLeading = Boolean(myTeam && leadingTeam && myTeam.id === leadingTeam.id);
  const canAffordMin = Boolean(myTeam && myTeam.remainingBudget >= minNextBid);
  const squadFull = Boolean(myTeam && (myTeam.squadCount ?? 0) >= league.maxSquadSize);
  const overseasFull = Boolean(
    myTeam &&
      currentPlayer?.isOverseas &&
      (myTeam.overseasCount ?? 0) >= league.maxOverseas
  );

  const filteredLots = useMemo(() => {
    if (lotTab === 'sold') return lots.filter((item) => item.lot.status === 'sold');
    if (lotTab === 'unsold') return lots.filter((item) => item.lot.status === 'unsold');
    return [];
  }, [lots, lotTab]);

  const currentPlayerIsTarget = Boolean(
    currentPlayer && bookmarkedIds.includes(currentPlayer.id)
  );
  const currentPlayerOvr = currentPlayer ? formatOvrWithDelta(currentPlayer) : null;

  const displayedPurseTeams = useMemo(() => {
    const claimed = teams.filter((t) => Boolean(t.ownerUid));
    if (purseScope === 'claimed' && claimed.length > 0) {
      return claimed;
    }
    return [...teams].sort((a, b) => Number(Boolean(b.ownerUid)) - Number(Boolean(a.ownerUid)));
  }, [teams, purseScope]);

  const sortedInspectorTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      if (myTeam && a.id === myTeam.id) return -1;
      if (myTeam && b.id === myTeam.id) return 1;
      const aClaimed = Number(Boolean(a.ownerUid));
      const bClaimed = Number(Boolean(b.ownerUid));
      if (aClaimed !== bClaimed) return bClaimed - aClaimed;
      return (b.squadCount ?? 0) - (a.squadCount ?? 0);
    });
  }, [teams, myTeam]);

  const humanMembers = state.members || [];
  const autoSimVotes = auction?.autoSimVotesJson || [];
  const autoSimVoteSet = new Set(autoSimVotes.map((v) => v.uid));
  const autoSimAgreedCount = humanMembers.filter((m) => autoSimVoteSet.has(m.userUid)).length;
  const autoSimRequiredCount = humanMembers.length;
  const iAgreedAutoSim = Boolean(user?.uid && autoSimVoteSet.has(user.uid));

  const skipVotes = auction?.skipVotesJson || [];
  const skipVoteSet = new Set(skipVotes.map((v) => v.uid));
  const skipAgreedCount = humanMembers.filter((m) => skipVoteSet.has(m.userUid)).length;
  const skipRequiredCount = humanMembers.length;
  const iVotedSkip = Boolean(user?.uid && skipVoteSet.has(user.uid));

  const openSquadInspector = (preferredTeamId?: number) => {
    const target = preferredTeamId || myTeam?.id || sortedInspectorTeams[0]?.id || null;
    if (target) setInspectSquadTeamId(target);
  };

  return (
    <div className="space-y-5">
      {/* Stage Banner & Control Bar */}
      <div className="relative cm27-panel overflow-hidden">
        <img
          src="/src/assets/images/auction_stage_1794579233196.jpg"
          alt="Auction Dais"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-15"
        />
        <div className="relative z-10 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-[#0C0F14]/96 via-[#12161E]/90 to-[#0C0F14]/82">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#EAB308] font-mono">
              <span>LIVE AUCTION FLOOR</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums text-slate-300">
                {counts.sold} Sold · {counts.unsold} Unsold · {counts.pending} Remaining
              </span>
              {auction?.currentSetName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#93E6EE] uppercase">
                    Set: {auction.currentSetName}
                  </span>
                </>
              )}
              {auction?.acceleratedRound && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300 uppercase">
                    Accelerated Unsold Round
                  </span>
                </>
              )}
            </div>
            <h1 className="text-3xl font-condensed font-bold uppercase text-white mt-0.5">
              {auction?.status === 'live'
                ? 'Active Bidding Stage'
                : auction?.status === 'paused'
                  ? 'Auction Paused'
                  : auction?.status === 'completed'
                    ? 'Auction Completed'
                    : 'Auction Lobby'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isHost && auction?.status === 'lobby' && (
              <button
                onClick={() => handleHostAction('start', 'Start Auction')}
                className="cm27-btn-3d flex items-center gap-1.5 px-4 py-2 rounded font-bold text-xs cursor-pointer whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                Start Auction
              </button>
            )}

            {auction?.status === 'live' && (
              <button
                onClick={() => handleHostAction('pause', 'Pause Auction')}
                className="cm27-btn-dark-3d flex items-center gap-1.5 px-3.5 py-2 rounded border-[#EAB308]/45 text-amber-200 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Pause className="w-3.5 h-3.5 text-[#EAB308]" />
                Pause
              </button>
            )}
            {auction?.status === 'paused' && (
              <button
                onClick={() => handleHostAction('resume', 'Resume Auction')}
                className="cm27-btn-3d flex items-center gap-1.5 px-4 py-2 rounded font-bold text-xs cursor-pointer whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                Resume Auction
              </button>
            )}

            {(auction?.status === 'live' || auction?.status === 'paused') && currentLot && (
              <button
                onClick={() => handleToggleSkipVote(!iVotedSkip)}
                disabled={skipVoteBusy}
                className={`cm27-btn-dark-3d flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
                  iVotedSkip ? '!border-[#93E6EE] !text-[#93E6EE]' : 'text-slate-100'
                }`}
                title="Vote to skip the ongoing player if no one wants them (advances immediately when all human managers vote skip)"
              >
                <SkipForward className="w-3.5 h-3.5 text-[#EAB308]" />
                <span>
                  {iVotedSkip
                    ? `Skip Voted (${skipAgreedCount}/${skipRequiredCount})`
                    : `Vote Skip (${skipAgreedCount}/${skipRequiredCount})`}
                </span>
              </button>
            )}

            <button
              onClick={() => openSquadInspector()}
              className="cm27-btn-dark-3d flex items-center gap-1.5 px-3.5 py-2 rounded text-slate-100 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <Users className="w-3.5 h-3.5 text-[#93E6EE]" />
              <span>View Squads</span>
            </button>

            {auction && auction.status !== 'completed' && (
              <button
                onClick={() => handleToggleAutoSimVote(!iAgreedAutoSim)}
                disabled={autoSimBusy}
                className={`cm27-btn-dark-3d flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
                  iAgreedAutoSim ? '!border-[#93E6EE] !text-[#93E6EE]' : 'text-slate-200'
                }`}
                title="Auto-simulates the entire auction in seconds once 100% of real managers in the league agree"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>
                  {iAgreedAutoSim
                    ? `Auto-Sim Agreed (${autoSimAgreedCount}/${autoSimRequiredCount})`
                    : `Auto-Sim (${autoSimAgreedCount}/${autoSimRequiredCount})`}
                </span>
              </button>
            )}

            {isHost && (
              <>
                {(auction?.status === 'live' || auction?.status === 'paused') && (
                  <button
                    onClick={() => handleHostAction('next', 'Settle & Next Lot')}
                    className="cm27-btn-dark-3d flex items-center gap-1.5 px-3.5 py-2 rounded text-slate-100 text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <SkipForward className="w-3.5 h-3.5 text-[#93E6EE]" />
                    Force Next
                  </button>
                )}
                {counts.unsold > 0 && (
                  <button
                    onClick={() => handleHostAction('relist-unsold', 'Re-list Unsold')}
                    className="cm27-btn-dark-3d flex items-center gap-1.5 px-3.5 py-2 rounded text-slate-200 text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Re-list Unsold ({counts.unsold})
                  </button>
                )}
                <button
                  onClick={() => setShowSettings(true)}
                  className="cm27-btn-dark-3d flex items-center gap-1.5 px-3 py-2 rounded text-slate-300 text-xs cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Rules
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Unanimous Vote-Skip Consensus Strip */}
      {(auction?.status === 'live' || auction?.status === 'paused') &&
        currentLot &&
        skipAgreedCount > 0 && (
          <div className="p-3.5 cm27-panel border-[#93E6EE]/45 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <SkipForward className="w-4 h-4 text-[#EAB308] shrink-0" />
              <span className="font-semibold text-white">
                Skip Current Player ({skipAgreedCount}/{skipRequiredCount} Managers Voted Skip):
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {humanMembers.map((m) => {
                  const voted = skipVoteSet.has(m.userUid);
                  return (
                    <span
                      key={m.userUid}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                        voted
                          ? 'bg-[#1D2532] border-[#93E6EE]/65 text-[#93E6EE]'
                          : 'bg-[#0C0F14] border-white/10 text-slate-400'
                      }`}
                    >
                      {m.managerName || 'Manager'} {voted ? '✓' : '…'}
                    </span>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => handleToggleSkipVote(!iVotedSkip)}
              disabled={skipVoteBusy}
              className={`px-3.5 py-1.5 rounded text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
                iVotedSkip ? 'cm27-btn-dark-3d' : 'cm27-btn-3d'
              }`}
            >
              {iVotedSkip ? 'Withdraw Skip Vote' : 'Agree & Skip Player'}
            </button>
          </div>
        )}

      {/* Unanimous Auto-Simulate Consensus Strip */}
      {auction && auction.status !== 'completed' && autoSimAgreedCount > 0 && (
        <div className="p-3.5 cm27-panel border-[#93E6EE]/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <FastForward className="w-4 h-4 text-[#93E6EE] shrink-0" />
            <span className="font-semibold text-white">
              Instant Auction Auto-Sim ({autoSimAgreedCount}/{autoSimRequiredCount} Managers Agreed):
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {humanMembers.map((m) => {
                const voted = autoSimVoteSet.has(m.userUid);
                return (
                  <span
                    key={m.userUid}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                      voted
                        ? 'bg-[#1D2532] border-[#93E6EE]/60 text-[#93E6EE]'
                        : 'bg-[#0C0F14] border-white/10 text-slate-400'
                    }`}
                  >
                    {m.managerName || 'Manager'} {voted ? '✓' : '…'}
                  </span>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => handleToggleAutoSimVote(!iAgreedAutoSim)}
            disabled={autoSimBusy}
            className={`px-3.5 py-1.5 rounded text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
              iAgreedAutoSim ? 'cm27-btn-dark-3d' : 'cm27-btn-3d'
            }`}
          >
            {iAgreedAutoSim ? 'Withdraw Vote' : 'Agree & Auto-Sim'}
          </button>
        </div>
      )}

      {/* Compulsory Pause Active Banner */}
      {auction?.status === 'paused' && (
        <div className="p-4 cm27-panel bg-amber-500/10 border-[#EAB308]/55 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Pause className="w-4 h-4 text-[#EAB308] shrink-0" />
            <div className="text-xs text-amber-100">
              <span className="font-bold uppercase tracking-wider text-[#EAB308] mr-2">
                Auction Paused
              </span>
              {auction.pausedByName
                ? `Frozen by ${auction.pausedByName}. Clock holds at ${secondsLeft}s until someone clicks Resume.`
                : `Clock holds at ${secondsLeft}s until someone clicks Resume.`}
            </div>
          </div>
          <button
            onClick={() => handleHostAction('resume', 'Resume Auction')}
            className="cm27-btn-3d px-4 py-1.5 rounded font-bold text-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            Resume Auction
          </button>
        </div>
      )}

      {/* Main Bidding Stage + Franchise Purse Rail & Mini Chat */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left 8 Cols */}
        <div className="xl:col-span-8 space-y-5">
          {auction?.status === 'completed' ? (
            <div className="cm27-panel p-8 text-center space-y-4">
              <h2 className="text-2xl font-condensed font-bold uppercase text-white">
                Auction Summary Complete
              </h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                {counts.sold} players have been signed across clubs and {counts.unsold} went unsold.
                Review any club's final roster or jump into lineups and Matchday.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => openSquadInspector()}
                  className="cm27-btn-3d px-4 py-2 rounded font-bold text-xs cursor-pointer"
                >
                  Inspect All Club Squads
                </button>
              </div>
            </div>
          ) : !currentPlayer || !currentLot ? (
            <div className="cm27-panel p-10 text-center space-y-3">
              <Gavel className="w-8 h-8 text-[#EAB308] mx-auto" />
              <h2 className="text-2xl font-condensed font-bold uppercase text-white">
                Waiting in Auction Lobby
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {isHost
                  ? 'Review auction rules above and click Start Auction once managers are ready.'
                  : 'The league host will begin the live auction shortly. Ensure you have claimed a club in Teams.'}
              </p>
              {!myTeam && onNavigate && (
                <button
                  onClick={() => onNavigate('franchises')}
                  className="cm27-btn-dark-3d inline-flex items-center gap-1.5 px-4 py-2 rounded text-amber-300 text-xs font-semibold cursor-pointer"
                >
                  Claim Your Club First
                </button>
              )}
              {isHost && auction?.status === 'lobby' && (
                <div className="pt-1">
                  <button
                    onClick={() => handleHostAction('start', 'Start Auction')}
                    className="cm27-btn-3d inline-flex items-center gap-2 px-5 py-2.5 rounded font-bold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Start Live Auction Now
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`cm27-panel overflow-hidden transition-colors ${
                currentPlayerIsTarget ? 'border-[#EAB308]/75' : ''
              }`}
            >
              {/* Timer Bar */}
              <div className="h-1 bg-[#0C0F14] w-full">
                <div
                  className={`h-full transition-all duration-200 ${
                    secondsLeft <= 5
                      ? 'bg-rose-500'
                      : currentPlayerIsTarget
                        ? 'bg-[#EAB308]'
                        : 'bg-[#93E6EE]'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((secondsLeft / Math.max(1, league.auctionDurationSec)) * 100)
                    )}%`,
                  }}
                />
              </div>

              {currentPlayerIsTarget && (
                <div className="px-6 py-2 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-b border-amber-400/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                    <Target className="w-4 h-4 text-amber-400" />
                    <span>★ Scouted Target On Stage</span>
                  </div>
                  <span className="text-[11px] font-mono text-amber-200/80">
                    Bookmarked in your shortlist
                  </span>
                </div>
              )}

              <div className="p-6 flex flex-col md:flex-row gap-6">
                {/* Player Spotlight Card */}
                <div className="flex gap-4 md:w-7/12">
                  <div className="w-28 h-32 rounded-lg border border-white/12 bg-[#0C0F14] shrink-0 flex flex-col items-center justify-center gap-2 p-2.5">
                    <CountryFlag
                      country={currentPlayer.country}
                      size="lg"
                      className="!w-20 !h-14 rounded-md border border-white/25 shadow-md"
                    />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 text-center leading-tight line-clamp-2">
                      {currentPlayer.country}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <span className="font-mono text-amber-400">Lot #{currentLot.lotOrder}</span>
                        <span>·</span>
                        <span>{currentPlayer.primaryRole}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <CountryFlag country={currentPlayer.country} size="xs" />
                          <span>{currentPlayer.country}</span>
                        </span>
                        {currentPlayer.isOverseas && (
                          <span className="text-cyan-300 font-medium">(OS)</span>
                        )}
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#0C0F14] border border-white/10 text-slate-300">
                          {currentPlayer.leagueOrigin}
                        </span>
                        {currentPlayer.marqueeSet && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#93E6EE]/12 border border-[#93E6EE]/35 text-[#93E6EE]">
                            {currentPlayer.marqueeSet}
                          </span>
                        )}
                      </div>

                      {myTeam && (
                        <button
                          type="button"
                          onClick={(e) => handleToggleBookmark(currentPlayer, e)}
                          disabled={bookmarkBusyId === currentPlayer.id}
                          className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            currentPlayerIsTarget
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                              : 'bg-[#0C0F14] border-white/10 text-slate-400 hover:text-amber-300'
                          }`}
                          title={currentPlayerIsTarget ? 'Bookmarked Target' : 'Bookmark Target'}
                        >
                          {currentPlayerIsTarget ? (
                            <Target className="w-3.5 h-3.5" />
                          ) : (
                            <Bookmark className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setProfilePlayer(currentPlayer)}
                      className="text-3xl font-condensed font-bold uppercase text-white hover:text-amber-300 text-left mt-1 cursor-pointer block truncate w-full transition-colors"
                    >
                      {currentPlayer.name}
                    </button>
                    <div className="text-xs text-slate-400 mt-1">
                      Age {currentPlayer.age} · {currentPlayer.battingHand} ·{' '}
                      {currentPlayer.bowlingStyle}
                    </div>

                    <div className="grid grid-cols-5 gap-2 mt-4 pt-4 border-t border-white/[0.06] text-center">
                      <div>
                        <div className="text-[11px] text-slate-400">OVR</div>
                        <div className="font-mono font-bold tabular-nums text-amber-400">
                          {currentPlayerOvr?.ovr}
                          {currentPlayerOvr && currentPlayerOvr.delta !== 0 && (
                            <span
                              className={`ml-0.5 text-[11px] ${
                                currentPlayerOvr.delta > 0 ? 'text-[#4ADE80]' : 'text-rose-400'
                              }`}
                            >
                              ({currentPlayerOvr.delta > 0 ? `+${currentPlayerOvr.delta}` : currentPlayerOvr.delta})
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">BAT</div>
                        <div className="font-mono font-bold text-white tabular-nums">
                          {currentPlayer.battingRating}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">BWL</div>
                        <div className="font-mono font-bold text-white tabular-nums">
                          {currentPlayer.bowlingRating}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">FLD</div>
                        <div className="font-mono font-bold text-white tabular-nums">
                          {currentPlayer.fieldingRating}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">POT</div>
                        <div className="font-mono font-bold text-[#93E6EE] tabular-nums">
                          {currentPlayer.potential}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Bid & Clock Panel */}
                <div className="md:w-5/12 cm27-panel-inset p-5 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-slate-400">
                        {auction?.currentBid ? 'Current Highest Bid' : 'Base Price'}
                      </div>
                      <div className="text-3xl font-mono font-bold text-[#4ADE80] tabular-nums mt-0.5">
                        {formatCurrencyLakhs(
                          auction?.currentBid ? auction.currentBid : currentLot.basePrice,
                          currency
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400">Clock</div>
                      <div
                        className={`text-3xl font-mono font-bold tabular-nums mt-0.5 ${
                          secondsLeft <= 5 ? 'text-rose-400' : 'text-white'
                        }`}
                      >
                        {secondsLeft}s
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400">Leading Club</div>
                      {leadingTeam ? (
                        <div className="flex items-center gap-2.5 mt-1.5">
                          <TeamCrest
                            templateKey={leadingTeam.templateKey}
                            shortCode={leadingTeam.shortCode}
                            primaryColor={leadingTeam.primaryColor}
                            secondaryColor={leadingTeam.secondaryColor}
                            size="sm"
                          />
                          <span className="text-sm font-semibold text-white truncate">
                            {leadingTeam.name} ({leadingTeam.shortCode})
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500 mt-1">Opening bid awaiting</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bidding Action Bar */}
              <div className="px-6 py-4 bg-[#0E1218] border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {!myTeam ? (
                  <p className="text-xs text-amber-300">
                    Claim a club in the Teams tab to submit live bids.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <TeamCrest
                        templateKey={myTeam.templateKey}
                        shortCode={myTeam.shortCode}
                        primaryColor={myTeam.primaryColor}
                        secondaryColor={myTeam.secondaryColor}
                        size="sm"
                      />
                      <div className="text-xs text-slate-300 space-y-0.5">
                        <div>
                          Bidding as <strong className="text-white">{myTeam.name}</strong> · Purse:{' '}
                          <span className="font-mono text-[#4ADE80] tabular-nums">
                            {formatCurrencyLakhs(myTeam.remainingBudget, currency)}
                          </span>
                        </div>
                        {isAlreadyLeading && (
                          <div className="text-[#93E6EE] font-medium">
                            Your club holds the current highest bid
                          </div>
                        )}
                        {!isAlreadyLeading && squadFull && (
                          <div className="text-rose-400">Maximum squad size reached</div>
                        )}
                        {!isAlreadyLeading && !squadFull && overseasFull && (
                          <div className="text-rose-400">Overseas slot limit reached</div>
                        )}
                        {!isAlreadyLeading && !canAffordMin && (
                          <div className="text-rose-400">Insufficient purse for next increment</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        disabled={
                          bidding ||
                          auction?.status !== 'live' ||
                          isAlreadyLeading ||
                          !canAffordMin ||
                          squadFull ||
                          overseasFull
                        }
                        onClick={() => handlePlaceBid(minNextBid)}
                        className="cm27-btn-3d px-5 py-2.5 rounded disabled:opacity-40 font-bold text-sm font-mono tabular-nums cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Bid {formatCurrencyLakhs(minNextBid, currency)}
                      </button>
                      <button
                        disabled={
                          bidding ||
                          auction?.status !== 'live' ||
                          isAlreadyLeading ||
                          myTeam.remainingBudget < minNextBid + league.bidIncrement ||
                          squadFull ||
                          overseasFull
                        }
                        onClick={() => handlePlaceBid(minNextBid + league.bidIncrement)}
                        className="cm27-btn-dark-3d px-3.5 py-2.5 rounded disabled:opacity-40 text-slate-100 font-mono text-xs tabular-nums cursor-pointer whitespace-nowrap shrink-0"
                      >
                        +{formatCurrencyLakhs(league.bidIncrement, currency)}
                      </button>

                      {/* Direct Custom Jump Bid */}
                      <form onSubmit={handleSubmitCustomBid} className="flex items-center gap-1.5">
                        <div className="flex items-center rounded bg-[#0C0F14] border border-white/15 focus-within:border-[#93E6EE] overflow-hidden">
                          <input
                            type="number"
                            step={customBidUnit === 'Cr' ? '0.25' : '25'}
                            min="0"
                            value={customBidInput}
                            onChange={(e) => setCustomBidInput(e.target.value)}
                            placeholder="Enter the bid"
                            className="w-28 px-2.5 py-2 bg-transparent text-xs font-mono text-white placeholder-slate-500 focus:outline-none tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => setCustomBidUnit((u) => (u === 'Cr' ? 'L' : 'Cr'))}
                            className="px-2 py-2 border-l border-white/10 text-[11px] font-mono font-bold text-[#EAB308] hover:bg-white/5 cursor-pointer"
                            title="Switch between Crores (Cr) and Lakhs (L)"
                          >
                            {customBidUnit}
                          </button>
                        </div>
                        <button
                          type="submit"
                          disabled={
                            bidding ||
                            auction?.status !== 'live' ||
                            isAlreadyLeading ||
                            !customBidInput.trim() ||
                            squadFull ||
                            overseasFull
                          }
                          className="cm27-btn-dark-3d px-3 py-2 rounded disabled:opacity-40 text-white font-semibold text-xs cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Jump Bid
                        </button>
                      </form>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bid History & Lot Lists */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-5 cm27-panel overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.08] bg-[#0E1218] text-xs font-semibold text-white">
                Current Lot Bid History
              </div>
              <div className="divide-y divide-white/[0.05] max-h-64 overflow-y-auto">
                {recentBids.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No bids on this lot yet.
                  </div>
                ) : (
                  recentBids.map((b) => {
                    const bidTeam = teams.find((t) => t.id === b.teamId);
                    return (
                      <div
                        key={b.id}
                        className="px-4 py-2.5 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <TeamCrest
                            templateKey={bidTeam?.templateKey}
                            shortCode={b.teamShortCode}
                            primaryColor={b.teamColor}
                            secondaryColor={bidTeam?.secondaryColor}
                            size="xs"
                          />
                          <span className="font-semibold text-white">{b.teamShortCode}</span>
                          <span className="text-slate-400 font-mono tabular-nums">
                            {formatClockTime(b.createdAt)}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-[#4ADE80] tabular-nums">
                          {formatCurrencyLakhs(b.amount, currency)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="md:col-span-7 cm27-panel overflow-hidden">
              <div className="px-4 pt-2.5 border-b border-white/[0.08] bg-[#0E1218] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-5 overflow-x-auto">
                  <button
                    onClick={() => setLotTab('sets')}
                    className={`pb-2.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                      lotTab === 'sets'
                        ? 'border-[#93E6EE] text-white'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Marquee Sets ({setSummary.length})</span>
                  </button>
                  <button
                    onClick={() => setLotTab('sold')}
                    className={`pb-2.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                      lotTab === 'sold'
                        ? 'border-[#93E6EE] text-white'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    Sold ({counts.sold})
                  </button>
                  <button
                    onClick={() => setLotTab('unsold')}
                    className={`pb-2.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                      lotTab === 'unsold'
                        ? 'border-[#93E6EE] text-white'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    Unsold ({counts.unsold})
                  </button>
                  <button
                    onClick={() => setLotTab('targets')}
                    className={`pb-2.5 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                      lotTab === 'targets'
                        ? 'border-[#EAB308] text-[#EAB308]'
                        : 'border-transparent text-amber-300/75 hover:text-amber-200'
                    }`}
                  >
                    <Target className="w-3 h-3" />
                    <span>Targets ({bookmarkedStatuses.length})</span>
                  </button>
                </div>
              </div>

              <div className="divide-y divide-white/[0.05] max-h-64 overflow-y-auto">
                {loadingLots ? (
                  <div className="p-6 text-center text-xs text-slate-500">Loading auction tracker...</div>
                ) : lotTab === 'sets' ? (
                  setSummary.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Marquee sets will appear here once lots are initialized.
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-2 text-[11px] font-mono text-slate-400 bg-[#0C0F14]">
                        Upcoming player order within each set is randomized by chance. Unsold players re-enter the Accelerated Round automatically.
                      </div>
                      {setSummary.map((s) => {
                        const isActiveSet = auction?.currentSetName === s.setName;
                        return (
                          <div
                            key={s.setName}
                            className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs ${
                              isActiveSet ? 'bg-[#1B222D]' : ''
                            }`}
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              {s.completed ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80] shrink-0" />
                              ) : (
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    isActiveSet ? 'bg-[#93E6EE]' : 'bg-slate-600'
                                  }`}
                                />
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold text-white truncate flex items-center gap-2">
                                  <span>{s.setName}</span>
                                  {isActiveSet && (
                                    <span className="text-[10px] font-mono uppercase text-[#93E6EE]">
                                      · Active Set
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                                  {s.sold} Sold · {s.unsold} Unsold · {s.pending} Remaining
                                </div>
                              </div>
                            </div>
                            <span className="font-mono text-[11px] text-slate-300 tabular-nums shrink-0">
                              {s.total} Players
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )
                ) : lotTab === 'targets' ? (
                  bookmarkedStatuses.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No bookmarked auction targets yet. Bookmark players in Scouts or Players to track them here.
                    </div>
                  ) : (
                    bookmarkedStatuses.map((b) => (
                      <div
                        key={b.playerId}
                        className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs bg-amber-500/[0.04]"
                      >
                        <div className="min-w-0 flex items-center gap-2.5">
                          <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-100 truncate flex items-center gap-1.5">
                              <CountryFlag country={b.country} size="xs" />
                              <span className="truncate">{b.playerName}</span>
                              <span
                                className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                                  b.status === 'active'
                                    ? 'bg-amber-400 text-[#0C0F14] font-bold'
                                    : b.status === 'sold'
                                      ? 'bg-emerald-500/20 text-[#4ADE80]'
                                      : b.status === 'unsold'
                                        ? 'bg-rose-500/20 text-rose-300'
                                        : 'bg-white/10 text-slate-300'
                                }`}
                              >
                                {b.status === 'pending' ? b.marqueeSet : b.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {b.primaryRole} · OVR {b.ovr} · Base {formatCurrencyLakhs(b.basePrice, currency)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 font-mono tabular-nums">
                          {b.status === 'sold' ? (
                            <div>
                              <span className="text-[#4ADE80] font-semibold">
                                {b.winningTeamShortCode}
                              </span>{' '}
                              <span className="text-amber-400">
                                {formatCurrencyLakhs(b.soldPrice || b.basePrice, currency)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">In Pool</span>
                          )}
                        </div>
                      </div>
                    ))
                  )
                ) : filteredLots.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No {lotTab} players in this list yet.
                  </div>
                ) : (
                  filteredLots.slice(0, 80).map((item) => {
                    const isTarget = bookmarkedIds.includes(item.player.id);
                    const ovrInfo = formatOvrWithDelta(item.player);
                    return (
                      <div
                        key={item.lot.id}
                        onClick={() => setProfilePlayer(item.player)}
                        className={`cm27-hover-sweep px-4 py-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer ${
                          isTarget ? 'bg-amber-500/[0.06]' : ''
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2.5">
                          {myTeam && (
                            <button
                              type="button"
                              onClick={(e) => handleToggleBookmark(item.player, e)}
                              disabled={bookmarkBusyId === item.player.id}
                              className={`p-1 rounded border cursor-pointer shrink-0 ${
                                isTarget
                                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                                  : 'border-transparent text-slate-600 hover:text-amber-300'
                              }`}
                              title={isTarget ? 'Remove Target Bookmark' : 'Bookmark Target'}
                            >
                              {isTarget ? (
                                <Target className="w-3 h-3" />
                              ) : (
                                <Bookmark className="w-3 h-3" />
                              )}
                            </button>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-slate-100 truncate flex items-center gap-1.5">
                              <CountryFlag country={item.player.country} size="xs" />
                              <span className="truncate">{item.player.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {item.player.primaryRole} · OVR {ovrInfo.label} ·{' '}
                              {item.player.marqueeSet || item.player.leagueOrigin}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 font-mono tabular-nums">
                          {item.lot.status === 'sold' ? (
                            <div>
                              <span className="text-[#4ADE80] font-semibold">
                                {item.winningTeamShortCode}
                              </span>{' '}
                              <span className="text-amber-400">
                                {formatCurrencyLakhs(
                                  item.lot.soldPrice || item.lot.basePrice,
                                  currency
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">
                              Base {formatCurrencyLakhs(item.lot.basePrice, currency)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Club Purse Tracker + Mini Auction Chat */}
        <div className="xl:col-span-4 space-y-5">
          {/* Club Purse & Click-to-Inspect Squad Tracker */}
          <div className="cm27-panel overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.08] bg-[#0E1218] flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-white">Club Purse Tracker</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Click any club to inspect bought squad</p>
              </div>
              <div className="flex items-center gap-1 p-0.5 bg-[#0C0F14] border border-white/10 rounded text-[11px]">
                <button
                  onClick={() => setPurseScope('claimed')}
                  className={`px-2 py-1 rounded cursor-pointer whitespace-nowrap shrink-0 ${
                    purseScope === 'claimed'
                      ? 'cm27-btn-3d font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setPurseScope('all')}
                  className={`px-2 py-1 rounded cursor-pointer whitespace-nowrap shrink-0 ${
                    purseScope === 'all'
                      ? 'cm27-btn-3d font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({teams.length})
                </button>
              </div>
            </div>

            <div className="divide-y divide-white/[0.05] max-h-[300px] overflow-y-auto">
              {displayedPurseTeams.map((t) => {
                const isLeading = leadingTeam?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openSquadInspector(t.id)}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                      isLeading
                        ? 'bg-[#1D2532] ring-1 ring-inset ring-[#93E6EE]/65'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TeamCrest
                        templateKey={t.templateKey}
                        shortCode={t.shortCode}
                        primaryColor={t.primaryColor}
                        secondaryColor={t.secondaryColor}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">
                          {t.name}{' '}
                          <span className="font-normal text-slate-400">
                            · {t.ownerName || 'CPU AI'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          Squad {t.squadCount ?? 0}/{league.maxSquadSize} · OS {t.overseasCount ?? 0}
                          /{league.maxOverseas}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-semibold text-[#4ADE80] tabular-nums">
                        {formatCurrencyLakhs(t.remainingBudget, currency)}
                      </div>
                      {t.ownerOnline && (
                        <div className="text-[10px] text-[#4ADE80] font-mono">Online</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Embedded Mini Auction Chat */}
          <div className="cm27-panel overflow-hidden flex flex-col h-[310px]">
            <div className="px-4 py-2.5 border-b border-white/[0.08] bg-[#0E1218] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-[#93E6EE]" />
                <span className="text-xs font-semibold text-white">Auction Floor Chat</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                {state.messages.length} msgs
              </span>
            </div>

            <div className="flex-1 p-3 space-y-2 overflow-y-auto bg-[#0C0F14]/75">
              {state.messages.length === 0 ? (
                <div className="text-center py-8 text-[11px] text-slate-500">
                  Banter, negotiate skips, or call bluff bids right here.
                </div>
              ) : (
                state.messages.slice(-40).map((m) => {
                  const isMine = m.userUid === user?.uid;
                  const isSystem = m.messageType === 'system';
                  if (isSystem) {
                    return (
                      <div
                        key={m.id}
                        className="px-2.5 py-1.5 rounded bg-white/[0.03] border border-white/[0.06] text-[11px] font-mono text-slate-400"
                      >
                        <span className="text-[#EAB308] mr-1.5">[{m.teamShortCode || 'AUC'}]</span>
                        <span>{m.body}</span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[88%] px-3 py-1.5 rounded text-xs ${
                          isMine
                            ? 'bg-[#1D2532] border border-[#93E6EE]/40 text-white'
                            : 'bg-[#141922] border border-white/10 text-slate-200'
                        }`}
                      >
                        <div className="text-[10px] font-mono text-slate-400 mb-0.5 flex items-center gap-1.5">
                          <span className={isMine ? 'text-[#93E6EE] font-semibold' : 'text-[#EAB308] font-semibold'}>
                            {m.managerName || 'Manager'}
                          </span>
                          {m.teamShortCode && <span>({m.teamShortCode})</span>}
                          <span>· {formatTimeAgo(m.createdAt)}</span>
                        </div>
                        <p className="leading-snug break-words">{m.body}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={miniChatEndRef} />
            </div>

            <form
              onSubmit={handleSendMiniChat}
              className="p-2.5 border-t border-white/[0.08] bg-[#0E1218] flex items-center gap-2"
            >
              <input
                type="text"
                maxLength={500}
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder="Chat with managers in auction..."
                className="flex-1 px-3 py-1.5 rounded bg-[#0C0F14] border border-white/12 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#93E6EE]"
              />
              <button
                type="submit"
                disabled={sendingChat || !chatDraft.trim()}
                className="cm27-btn-3d p-2 rounded disabled:opacity-40 cursor-pointer shrink-0"
                title="Send Message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Club Squads Inspector Modal (Own & Rival Acquired Players) */}
      {inspectSquadTeamId !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setInspectSquadTeamId(null)}
        >
          <div
            className="cm27-panel w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-white/[0.08] bg-[#0E1218] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-[#93E6EE]" />
                <h2 className="font-condensed text-2xl font-bold uppercase text-white tracking-wide">
                  Club Squads &amp; Auction Buys
                </h2>
              </div>
              <button
                onClick={() => setInspectSquadTeamId(null)}
                className="cm27-btn-dark-3d p-1.5 rounded text-slate-300 hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Club Switcher Tabs */}
            <div className="px-6 py-3 bg-[#0C0F14] border-b border-white/[0.07] flex items-center gap-2 overflow-x-auto">
              {sortedInspectorTeams.map((t) => {
                const selected = t.id === inspectSquadTeamId;
                const isMine = myTeam?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setInspectSquadTeamId(t.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-all ${
                      selected
                        ? 'cm27-btn-3d font-bold'
                        : 'cm27-btn-dark-3d text-slate-300'
                    }`}
                  >
                    <TeamCrest
                      templateKey={t.templateKey}
                      shortCode={t.shortCode}
                      primaryColor={t.primaryColor}
                      secondaryColor={t.secondaryColor}
                      size="xs"
                    />
                    <span>{t.shortCode}</span>
                    {isMine && (
                      <span className="text-[10px] font-mono uppercase opacity-80">(You)</span>
                    )}
                    <span className="text-[10px] font-mono opacity-80 tabular-nums">
                      ({t.squadCount ?? 0})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Team Summary + Squad List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingInspectSquad && !inspectSquadData ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Loading club roster...
                </div>
              ) : inspectSquadData ? (
                <>
                  <div className="cm27-panel-inset p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <TeamCrest
                        templateKey={inspectSquadData.team.templateKey}
                        shortCode={inspectSquadData.team.shortCode}
                        primaryColor={inspectSquadData.team.primaryColor}
                        secondaryColor={inspectSquadData.team.secondaryColor}
                        size="md"
                      />
                      <div>
                        <div className="text-lg font-condensed font-bold uppercase text-white">
                          {inspectSquadData.team.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          Manager: {inspectSquadData.team.ownerName || 'CPU AI'} ·{' '}
                          {inspectSquadData.team.leagueCategory}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right font-mono tabular-nums">
                      <div>
                        <div className="text-[10px] uppercase text-slate-400">Players</div>
                        <div className="text-sm font-bold text-white">
                          {inspectSquadData.squad.length}/{league.maxSquadSize}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-400">Overseas</div>
                        <div className="text-sm font-bold text-cyan-300">
                          {inspectSquadData.squad.filter((p) => p.isOverseas).length}/{league.maxOverseas}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-400">Purse Left</div>
                        <div className="text-sm font-bold text-[#4ADE80]">
                          {formatCurrencyLakhs(inspectSquadData.team.remainingBudget, currency)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {inspectSquadData.squad.length === 0 ? (
                    <div className="cm27-panel-inset p-8 text-center text-xs text-slate-400">
                      No players signed by {inspectSquadData.team.name} yet.
                    </div>
                  ) : (
                    <div className="cm27-panel-inset divide-y divide-white/[0.06] overflow-hidden">
                      <div className="px-4 py-2 bg-[#0E1218] grid grid-cols-12 text-[10px] font-mono uppercase text-slate-400">
                        <div className="col-span-5">Player</div>
                        <div className="col-span-3">Role</div>
                        <div className="col-span-1 text-center">OVR</div>
                        <div className="col-span-3 text-right">Signed Price</div>
                      </div>
                      {inspectSquadData.squad.map((p) => {
                        const ovr = getPlayerOverall(p);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setProfilePlayer(p)}
                            className="w-full px-4 py-2.5 grid grid-cols-12 items-center text-left text-xs hover:bg-white/[0.03] cursor-pointer"
                          >
                            <div className="col-span-5 flex items-center gap-2 min-w-0 pr-2">
                              <CountryFlag country={p.country} size="xs" />
                              <span className="font-semibold text-white truncate">{p.name}</span>
                              {p.isOverseas && (
                                <span className="text-[9px] font-mono text-cyan-300 shrink-0">
                                  (OS)
                                </span>
                              )}
                            </div>
                            <div className="col-span-3 text-slate-300 truncate">{p.primaryRole}</div>
                            <div className="col-span-1 text-center font-mono font-bold text-[#EAB308] tabular-nums">
                              {ovr}
                            </div>
                            <div className="col-span-3 text-right font-mono font-semibold text-[#4ADE80] tabular-nums">
                              {formatCurrencyLakhs(p.purchasePrice ?? p.basePrice, currency)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  Select a club above to inspect its roster.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {profilePlayer && (
        <PlayerProfileModal
          player={profilePlayer}
          onClose={() => setProfilePlayer(null)}
          isBookmarked={bookmarkedIds.includes(profilePlayer.id)}
          onToggleBookmark={myTeam ? () => handleToggleBookmark(profilePlayer) : undefined}
          bookmarkBusy={bookmarkBusyId === profilePlayer.id}
        />
      )}

      {/* Host Auction Rules Modal */}
      {showSettings && isHost && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cm27-panel w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/[0.08] bg-[#0E1218] flex items-center justify-between">
              <h2 className="font-condensed text-xl font-bold uppercase text-white tracking-wide">
                Configure Auction Rules
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Starting Purse (Cr){auction?.status !== 'lobby' ? ' — Locked' : ''}
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={250}
                    disabled={auction?.status !== 'lobby'}
                    value={cfgBudgetCr}
                    onChange={(e) => setCfgBudgetCr(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/12 text-sm font-mono text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Lot Timer (Seconds)</label>
                  <input
                    type="number"
                    min={8}
                    max={60}
                    value={cfgDuration}
                    onChange={(e) => setCfgDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/12 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Max Squad Size (22+ Min)</label>
                  <input
                    type="number"
                    min={22}
                    max={30}
                    value={cfgMaxSquad}
                    onChange={(e) => setCfgMaxSquad(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/12 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Max Overseas</label>
                  <input
                    type="number"
                    min={0}
                    max={11}
                    value={cfgMaxOverseas}
                    onChange={(e) => setCfgMaxOverseas(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/12 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Base Price (Lakhs)</label>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    step={10}
                    value={cfgBasePrice}
                    onChange={(e) => setCfgBasePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/12 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Bid Increment (Lakhs)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={200}
                    step={5}
                    value={cfgBidInc}
                    onChange={(e) => setCfgBidInc(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/12 text-sm font-mono text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="cm27-btn-dark-3d px-4 py-2 rounded text-xs text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCfg}
                  className="cm27-btn-3d px-5 py-2 rounded font-bold text-xs cursor-pointer"
                >
                  {savingCfg ? 'Saving...' : 'Save Rules'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
