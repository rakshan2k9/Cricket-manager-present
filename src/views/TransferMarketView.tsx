import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import type { LeagueStateSnapshot, Player, TradeOfferRecord } from '../types/game';
import { apiFetch } from '../lib/api';
import { formatCurrencyLakhs, formatOvrWithDelta } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { CountryFlag } from '../components/CountryFlag';

interface TransferHubResponse {
  myNeeds: {
    count: number;
    overseasCount: number;
    batters: number;
    bowlers: number;
    allRounders: number;
    keepers: number;
    needsBatting: boolean;
    needsBowling: boolean;
    needsWK: boolean;
    avgOvr: number;
  };
  teamRosters: Record<number, Player[]>;
  unsoldPool: Player[];
  transferRequestedPlayers: Array<Player & { teamId: number }>;
}

export function TransferMarketView({
  state,
  squadVersion,
  onRefreshState,
  onToast,
}: {
  state: LeagueStateSnapshot;
  squadVersion: number;
  onRefreshState: () => Promise<void>;
  onToast: (t: { tone: 'success' | 'error' | 'info' | 'warning'; title: string; body?: string }) => void;
}) {
  const { profile } = useAuth();
  const currency = profile?.preferredCurrency || 'INR';
  const myTeam = state.myTeam;

  const [hub, setHub] = useState<TransferHubResponse | null>(null);
  const [loadingHub, setLoadingHub] = useState(false);

  const otherTeams = useMemo(
    () => state.teams.filter((t) => t.id !== myTeam?.id),
    [state.teams, myTeam?.id]
  );

  const [targetTeamId, setTargetTeamId] = useState<number>(otherTeams[0]?.id || 0);
  const [offeredIds, setOfferedIds] = useState<number[]>([]);
  const [requestedIds, setRequestedIds] = useState<number[]>([]);
  const [cashDeltaLakhs, setCashDeltaLakhs] = useState<number>(0);
  const [tradeNote, setTradeNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [generatingOffer, setGeneratingOffer] = useState(false);

  // Injury replacement selection
  const [injuredPlayerId, setInjuredPlayerId] = useState<number>(0);
  const [signingRepId, setSigningRepId] = useState<number | null>(null);

  const loadHub = async () => {
    setLoadingHub(true);
    try {
      const data = await apiFetch<TransferHubResponse>(
        `/api/leagues/${state.league.id}/transfers/hub`
      );
      setHub(data);
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Could not load Transfer Hub', body: err.message });
    } finally {
      setLoadingHub(false);
    }
  };

  useEffect(() => {
    loadHub();
  }, [state.league.id, squadVersion]);

  useEffect(() => {
    if (!targetTeamId && otherTeams.length > 0) {
      setTargetTeamId(otherTeams[0].id);
    }
  }, [otherTeams, targetTeamId]);

  const myRoster = useMemo(
    () => (myTeam && hub?.teamRosters ? hub.teamRosters[myTeam.id] || [] : []),
    [hub, myTeam?.id]
  );

  const targetRoster = useMemo(
    () => (targetTeamId && hub?.teamRosters ? hub.teamRosters[targetTeamId] || [] : []),
    [hub, targetTeamId]
  );

  const injuredContracted = useMemo(
    () => myRoster.filter((p) => (p.injuryGamesRemaining ?? 0) > 0),
    [myRoster]
  );

  useEffect(() => {
    if (injuredContracted.length > 0 && !injuredContracted.some((p) => p.id === injuredPlayerId)) {
      setInjuredPlayerId(injuredContracted[0].id);
    }
  }, [injuredContracted, injuredPlayerId]);

  const toggleOffered = (id: number) => {
    setOfferedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleRequested = (id: number) => {
    setRequestedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleProposeTrade = async () => {
    if (!myTeam || !targetTeamId) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        offer: TradeOfferRecord;
        evaluation?: { accepted: boolean; reason: string };
      }>(`/api/leagues/${state.league.id}/transfers/propose`, {
        method: 'POST',
        body: JSON.stringify({
          recipientTeamId: targetTeamId,
          offeredPlayerIds: offeredIds,
          requestedPlayerIds: requestedIds,
          cashDeltaLakhs,
          message: tradeNote,
        }),
      });
      setOfferedIds([]);
      setRequestedIds([]);
      setCashDeltaLakhs(0);
      setTradeNote('');
      await Promise.all([loadHub(), onRefreshState()]);

      if (res.evaluation) {
        onToast({
          tone: res.evaluation.accepted ? 'success' : 'warning',
          title: res.evaluation.accepted ? 'Trade Accepted Immediately!' : 'Trade Declined by AI GM',
          body: res.evaluation.reason,
        });
      } else {
        onToast({
          tone: 'info',
          title: 'Trade Proposal Sent',
          body: 'Awaiting response from opposing franchise manager.',
        });
      }
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Proposal Failed', body: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondOffer = async (offerId: number, action: 'accept' | 'reject' | 'cancel') => {
    try {
      await apiFetch(`/api/leagues/${state.league.id}/transfers/${offerId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      await Promise.all([loadHub(), onRefreshState()]);
      onToast({
        tone: action === 'accept' ? 'success' : 'info',
        title:
          action === 'accept'
            ? 'Trade Completed!'
            : action === 'reject'
              ? 'Offer Declined'
              : 'Offer Withdrawn',
      });
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Action Failed', body: err.message });
    }
  };

  const handleGenerateAiOffer = async () => {
    setGeneratingOffer(true);
    try {
      const res = await apiFetch<{ offer: TradeOfferRecord | null; message?: string }>(
        `/api/leagues/${state.league.id}/transfers/generate-ai-offer`,
        { method: 'POST' }
      );
      await onRefreshState();
      onToast({
        tone: res.offer ? 'info' : 'warning',
        title: res.offer ? 'New AI Trade Enquiry Received' : 'Quiet Market',
        body: res.offer ? res.offer.message : res.message || 'No clubs matched your roster needs right now.',
      });
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Failed', body: err.message });
    } finally {
      setGeneratingOffer(false);
    }
  };

  const handleSignInjuryReplacement = async (replacementPlayerId: number) => {
    if (!injuredPlayerId) return;
    setSigningRepId(replacementPlayerId);
    try {
      const res = await apiFetch<{ signedPlayer: Player; fee: number }>(
        `/api/leagues/${state.league.id}/transfers/injury-replacement`,
        {
          method: 'POST',
          body: JSON.stringify({
            injuredPlayerId,
            replacementPlayerId,
          }),
        }
      );
      await Promise.all([loadHub(), onRefreshState()]);
      onToast({
        tone: 'success',
        title: `Signed ${res.signedPlayer.name}`,
        body: `Injury cover secured for ${formatCurrencyLakhs(res.fee, currency)}.`,
      });
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Replacement Failed', body: err.message });
    } finally {
      setSigningRepId(null);
    }
  };

  const tradeOffers = state.tradeOffers || [];
  const targetTeam = state.teams.find((t) => t.id === targetTeamId);

  if (!myTeam) {
    return (
      <div className="cm27-panel p-10 text-center space-y-2">
        <ArrowLeftRight className="w-8 h-8 text-[#93E6EE] mx-auto" />
        <h2 className="font-condensed text-2xl font-bold text-white uppercase">
          Claim a Franchise to Access Transfer Window
        </h2>
        <p className="text-xs text-slate-400">
          Join a club in Teams to negotiate player swaps, purse trades, and injury replacements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="cm27-panel p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#93E6EE]">
            INTER-ROUND TRADE &amp; REPLACEMENT WINDOW · {myTeam.name}
          </div>
          <h1 className="font-condensed text-3xl sm:text-4xl font-extrabold text-white uppercase leading-none mt-1">
            DYNAMIC TRANSFER MARKET
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Propose player swaps &amp; cash deals to AI or human GMs while respecting purse and {state.league.maxOverseas}-overseas caps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleGenerateAiOffer}
            disabled={generatingOffer}
            className="cm27-btn-dark-3d px-3.5 py-2 rounded text-xs font-semibold text-[#93E6EE] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generatingOffer ? 'animate-spin' : ''}`} />
            <span>Check AI GM Enquiries</span>
          </button>
          <div className="cm27-panel-inset px-3.5 py-2 text-xs font-mono tabular-nums">
            PURSE:{' '}
            <strong className="text-[#EAB308]">
              {formatCurrencyLakhs(myTeam.remainingBudget, currency)}
            </strong>{' '}
            · OVERSEAS:{' '}
            <strong className="text-white">
              {hub?.myNeeds.overseasCount ?? myTeam.overseasCount ?? 0}/{state.league.maxOverseas}
            </strong>
          </div>
        </div>
      </div>

      {/* Trade Proposal Builder */}
      <div className="cm27-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-[#EAB308]" />
            <h2 className="font-condensed text-2xl font-bold text-white uppercase">
              TRADE PROPOSAL DESK
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Partner Club:</span>
            <select
              value={targetTeamId}
              onChange={(e) => {
                setTargetTeamId(Number(e.target.value));
                setRequestedIds([]);
              }}
              className="bg-[#0C1016] border border-white/15 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#93E6EE]"
            >
              {otherTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.shortCode} — {t.name} ({t.ownerUid ? `Mgr: ${t.ownerName || 'Human'}` : 'AI GM'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingHub ? (
          <div className="py-8 text-center text-xs font-mono text-slate-400">
            Loading franchise rosters...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Offered Players (Mine) */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
                <span>Outgoing from {myTeam.shortCode} ({offeredIds.length} selected)</span>
                <span>OVR · ROLE</span>
              </div>
              <div className="cm27-panel-inset max-h-[260px] overflow-y-auto divide-y divide-white/[0.05] p-1">
                {myRoster.map((p) => {
                  const sel = offeredIds.includes(p.id);
                  const { ovr } = formatOvrWithDelta(p);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleOffered(p.id)}
                      className={`w-full px-2.5 py-2 rounded flex items-center justify-between text-left text-xs cursor-pointer ${
                        sel ? 'cm27-card-focus' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CountryFlag country={p.country} size="xs" />
                        <span className="font-semibold text-white truncate">{p.name}</span>
                        {p.transferRequested && (
                          <span className="text-[9px] font-mono text-amber-300 uppercase">UNHAPPY</span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-slate-300 tabular-nums shrink-0">
                        {ovr} · {p.primaryRole.slice(0, 3).toUpperCase()}
                        {p.isOverseas ? ' · OS' : ''}
                      </span>
                    </button>
                  );
                })}
                {myRoster.length === 0 && (
                  <div className="p-4 text-xs text-slate-500 text-center">No contracted players.</div>
                )}
              </div>
            </div>

            {/* Requested Players (Target) */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
                <span>Incoming from {targetTeam?.shortCode || 'Partner'} ({requestedIds.length} selected)</span>
                <span>OVR · ROLE</span>
              </div>
              <div className="cm27-panel-inset max-h-[260px] overflow-y-auto divide-y divide-white/[0.05] p-1">
                {targetRoster.map((p) => {
                  const sel = requestedIds.includes(p.id);
                  const { ovr } = formatOvrWithDelta(p);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleRequested(p.id)}
                      className={`w-full px-2.5 py-2 rounded flex items-center justify-between text-left text-xs cursor-pointer ${
                        sel ? 'cm27-card-focus' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CountryFlag country={p.country} size="xs" />
                        <span className="font-semibold text-white truncate">{p.name}</span>
                        {p.transferRequested && (
                          <span className="text-[9px] font-mono text-amber-300 uppercase">
                            SEEKING MOVE
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-slate-300 tabular-nums shrink-0">
                        {ovr} · {p.primaryRole.slice(0, 3).toUpperCase()}
                        {p.isOverseas ? ' · OS' : ''}
                      </span>
                    </button>
                  );
                })}
                {targetRoster.length === 0 && (
                  <div className="p-4 text-xs text-slate-500 text-center">No contracted players on this club.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cash & Submit Bar */}
        <div className="pt-2 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-slate-300 flex items-center gap-2">
              <span>Cash Adjustment (₹ Lakhs, + = You Pay):</span>
              <input
                type="number"
                step={25}
                value={cashDeltaLakhs}
                onChange={(e) => setCashDeltaLakhs(Number(e.target.value) || 0)}
                className="w-28 bg-[#0C1016] border border-white/15 rounded px-2.5 py-1.5 text-xs font-mono text-white"
              />
            </label>
            <input
              type="text"
              value={tradeNote}
              onChange={(e) => setTradeNote(e.target.value)}
              placeholder="Optional GM pitch..."
              className="w-56 bg-[#0C1016] border border-white/15 rounded px-3 py-1.5 text-xs text-white"
            />
          </div>

          <button
            onClick={handleProposeTrade}
            disabled={submitting || (offeredIds.length === 0 && requestedIds.length === 0)}
            className="cm27-btn-3d px-6 py-2.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-45"
          >
            {submitting ? 'Evaluating Package...' : 'Submit Trade Proposal'}
          </button>
        </div>
      </div>

      {/* Trade Inbox & Injury Replacement Pool */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 cm27-panel p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.07] pb-2.5">
            <h2 className="font-condensed text-2xl font-bold text-white uppercase">
              TRADE INBOX &amp; NEGOTIATIONS ({tradeOffers.length})
            </h2>
          </div>

          {tradeOffers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No active trade negotiations yet. Submit a proposal or check AI GM enquiries.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {tradeOffers.map((offer) => {
                const isRecipient = offer.recipientTeamId === myTeam.id;
                const isProposer = offer.proposerTeamId === myTeam.id;
                return (
                  <div key={offer.id} className="cm27-panel-inset p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-white font-bold">
                        {offer.proposerTeam?.shortCode || 'PRO'} ⇄{' '}
                        {offer.recipientTeam?.shortCode || 'REC'}
                        {offer.isAiInitiated && (
                          <span className="ml-2 text-[#93E6EE]">AI GM ENQUIRY</span>
                        )}
                      </span>
                      <span
                        className={`uppercase font-bold ${
                          offer.status === 'accepted'
                            ? 'text-[#4ADE80]'
                            : offer.status === 'rejected'
                              ? 'text-rose-400'
                              : offer.status === 'pending'
                                ? 'text-[#EAB308]'
                                : 'text-slate-500'
                        }`}
                      >
                        {offer.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300">
                      <strong className="text-white">
                        {offer.proposerTeam?.shortCode} sends:
                      </strong>{' '}
                      {(offer.offeredPlayers || []).map((p) => p.name).join(', ') || 'None'}
                      {offer.cashDeltaLakhs > 0 ? ` + ₹${offer.cashDeltaLakhs}L` : ''}
                      <span className="mx-2 text-slate-500">|</span>
                      <strong className="text-white">
                        {offer.recipientTeam?.shortCode} sends:
                      </strong>{' '}
                      {(offer.requestedPlayers || []).map((p) => p.name).join(', ') || 'None'}
                      {offer.cashDeltaLakhs < 0 ? ` + ₹${Math.abs(offer.cashDeltaLakhs)}L` : ''}
                    </div>

                    {offer.aiEvaluationNote && (
                      <div className="text-[11px] font-mono text-[#93E6EE]">
                        {offer.aiEvaluationNote}
                      </div>
                    )}

                    {offer.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        {isRecipient && (
                          <>
                            <button
                              onClick={() => handleRespondOffer(offer.id, 'accept')}
                              className="cm27-btn-3d px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3" /> Accept
                            </button>
                            <button
                              onClick={() => handleRespondOffer(offer.id, 'reject')}
                              className="cm27-btn-dark-3d px-3 py-1 rounded text-[11px] text-rose-300 flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3 h-3" /> Decline
                            </button>
                          </>
                        )}
                        {isProposer && (
                          <button
                            onClick={() => handleRespondOffer(offer.id, 'cancel')}
                            className="cm27-btn-dark-3d px-3 py-1 rounded text-[11px] text-slate-300 cursor-pointer"
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Injury Replacement & Unhappy Watchlist */}
        <div className="lg:col-span-5 cm27-panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.07] pb-2.5">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#93E6EE]" />
              <h2 className="font-condensed text-2xl font-bold text-white uppercase">
                INJURY REPLACEMENT POOL
              </h2>
            </div>
          </div>

          {injuredContracted.length === 0 ? (
            <div className="cm27-panel-inset p-4 text-xs text-slate-400 flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#4ADE80] shrink-0" />
              <span>
                Your entire contracted squad is fit. Emergency replacements unlock automatically if a
                player suffers a match layoff.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded bg-rose-950/35 border border-rose-500/30 text-xs text-rose-200 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Covering Injury:</span>
                </span>
                <select
                  value={injuredPlayerId}
                  onChange={(e) => setInjuredPlayerId(Number(e.target.value))}
                  className="bg-[#0C1016] border border-white/15 rounded px-2 py-1 text-xs text-white"
                >
                  {injuredContracted.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.injuryStatus} · {p.injuryGamesRemaining}G)
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-[260px] overflow-y-auto divide-y divide-white/[0.05] cm27-panel-inset p-1">
                {(hub?.unsoldPool || []).slice(0, 20).map((p) => {
                  const { ovr } = formatOvrWithDelta(p);
                  return (
                    <div
                      key={p.id}
                      className="px-2.5 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{p.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {p.primaryRole} · OVR {ovr} · Base{' '}
                          {formatCurrencyLakhs(p.basePrice, currency)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSignInjuryReplacement(p.id)}
                        disabled={signingRepId === p.id}
                        className="cm27-btn-3d px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        {signingRepId === p.id ? 'Signing...' : 'Sign Cover'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(hub?.transferRequestedPlayers || []).length > 0 && (
            <div className="pt-2 border-t border-white/[0.07] space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300">
                UNSETTLED / BENCHED STARS SEEKING MOVES
              </div>
              <div className="space-y-1.5">
                {hub!.transferRequestedPlayers.slice(0, 5).map((p) => {
                  const tm = state.teams.find((t) => t.id === p.teamId);
                  return (
                    <div
                      key={p.id}
                      className="cm27-panel-inset px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <span className="text-white font-semibold truncate">
                        {p.name} <span className="text-slate-400 font-normal">({tm?.shortCode})</span>
                      </span>
                      <span className="text-[10px] font-mono text-amber-300">
                        {p.primaryRole} · {formatOvrWithDelta(p).ovr} OVR
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
