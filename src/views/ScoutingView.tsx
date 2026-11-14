import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  Bookmark,
  Check,
  CheckCircle2,
  Compass,
  Play,
  Plus,
  Search,
  Star,
  Target,
  Trash2,
} from 'lucide-react';
import type { LeagueStateSnapshot, Player, ScoutCatalogEntry } from '../types/game';
import { COUNTRIES, formatCurrencyLakhs, formatOvrWithDelta } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { PlayerProfileModal } from '../components/PlayerProfileModal';
import { CountryFlag } from '../components/CountryFlag';

const LEAGUE_ORIGINS = ['ALL', 'IPL', 'PSL', 'SA20', 'International', 'BBL', 'The Hundred'];

const ROLE_CARDS = [
  { id: 'Batsman', title: 'BATTER', desc: 'Top-order, middle-order & power hitters' },
  { id: 'Bowler', title: 'BOWLER', desc: 'Strike pacers, swing & mystery spinners' },
  { id: 'All-Rounder', title: 'ALL-ROUNDER', desc: 'Dual-threat seamers & spinning finishers' },
  { id: 'Wicketkeeper', title: 'WICKETKEEPER', desc: 'Glovemen & explosive keeper-batters' },
  { id: 'ALL', title: 'ANY ROLE', desc: 'Scan all positions across the pool' },
] as const;

const BAT_ARCHETYPES = [
  'Aggressor',
  'Finisher',
  'Strike rotator',
  'Power hitter',
  'Finesse',
  'Defensive wall',
  'Anchor',
] as const;

const BOWL_ARCHETYPES = [
  'New-ball',
  'Death overs',
  'Control spinner',
  'Containment',
  'Wicket-taker',
  'Enforcer',
] as const;

type ViewMode = 'overview' | 'hub' | 'hire' | 'wizard';

export function ScoutingView({
  state,
  onRefreshState,
  onToast,
}: {
  state: LeagueStateSnapshot;
  onRefreshState: () => Promise<void>;
  onToast: (t: { type: 'success' | 'error' | 'info'; title: string; detail?: string }) => void;
}) {
  const { profile } = useAuth();
  const currency = profile?.preferredCurrency || 'INR';
  const myTeam = state.myTeam;

  const [mode, setMode] = useState<ViewMode>('overview');
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [slotFocusIdx, setSlotFocusIdx] = useState(0);

  const [catalog, setCatalog] = useState<ScoutCatalogEntry[]>([]);
  const [registryPlayers, setRegistryPlayers] = useState<Player[]>([]);
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedScoutId, setSelectedScoutId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Talent Brief Wizard state
  const [missionScoutId, setMissionScoutId] = useState<string>('');
  const [targetLeague, setTargetLeague] = useState('ALL');
  const [targetRegion, setTargetRegion] = useState('ALL');
  const [targetRole, setTargetRole] = useState<string>('ALL');
  const [minPotential, setMinPotential] = useState(78);
  const [selectedArchetypes, setSelectedArchetypes] = useState<string[]>([]);
  const [archFocusIdx, setArchFocusIdx] = useState(0);
  const [resultFocusIdx, setResultFocusIdx] = useState(0);

  const [runningMission, setRunningMission] = useState(false);
  const [scoutedResults, setScoutedResults] = useState<Player[]>([]);
  const [inspectPlayer, setInspectPlayer] = useState<Player | null>(null);
  const [bookmarkBusyId, setBookmarkBusyId] = useState<number | null>(null);

  const bookmarkedIds = myTeam?.bookmarkedPlayerIdsJson || [];
  const hiredScouts = myTeam?.hiredScoutsJson || [];

  useEffect(() => {
    apiFetch<{ scouts: ScoutCatalogEntry[] }>(`/api/leagues/${state.league.id}/catalogs`)
      .then((res) => {
        setCatalog(res.scouts || []);
        if (res.scouts?.length && !selectedScoutId) setSelectedScoutId(res.scouts[0].id);
      })
      .catch(() => {});
    apiFetch<{ players: Player[] }>(`/api/leagues/${state.league.id}/players?limit=25`)
      .then((res) => setRegistryPlayers(res.players || []))
      .catch(() => {});
  }, [state.league.id]);

  useEffect(() => {
    if (hiredScouts.length > 0 && !hiredScouts.some((s) => s.id === missionScoutId)) {
      setMissionScoutId(hiredScouts[0].id);
    }
  }, [hiredScouts, missionScoutId]);

  const sortedCatalog = useMemo(
    () =>
      [...catalog].sort((a, b) =>
        sortAsc
          ? a.name.localeCompare(b.name)
          : b.judgementStars - a.judgementStars || b.experienceStars - a.experienceStars
      ),
    [catalog, sortAsc]
  );

  const availableArchetypes = useMemo(() => {
    if (targetRole === 'Bowler') return [...BOWL_ARCHETYPES];
    if (targetRole === 'All-Rounder' || targetRole === 'ALL') {
      return [...BAT_ARCHETYPES, ...BOWL_ARCHETYPES];
    }
    return [...BAT_ARCHETYPES];
  }, [targetRole]);

  // Clear invalid archetypes when role narrows
  useEffect(() => {
    setSelectedArchetypes((prev) =>
      prev.filter((a) => (availableArchetypes as readonly string[]).includes(a))
    );
    setArchFocusIdx(0);
  }, [availableArchetypes]);

  const handleHireScout = async (scoutId: string) => {
    if (!myTeam) {
      onToast({ type: 'error', title: 'Claim a club first', detail: 'Select a team before hiring scouts.' });
      return;
    }
    setBusyId(scoutId);
    try {
      await apiFetch(`/api/leagues/${state.league.id}/teams/${myTeam.id}/scouts/hire`, {
        method: 'POST',
        body: JSON.stringify({ scoutId }),
      });
      await onRefreshState();
      onToast({ type: 'success', title: 'Scout Contracted', detail: 'Added to your Scout Network.' });
      setMissionScoutId(scoutId);
      setMode('hub');
    } catch (err: any) {
      onToast({ type: 'error', title: 'Could not hire scout', detail: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleReleaseScout = async (scoutId: string) => {
    if (!myTeam) return;
    setBusyId(scoutId);
    try {
      await apiFetch(`/api/leagues/${state.league.id}/teams/${myTeam.id}/scouts/release`, {
        method: 'POST',
        body: JSON.stringify({ scoutId }),
      });
      await onRefreshState();
      onToast({ type: 'info', title: 'Scout Released' });
    } catch (err: any) {
      onToast({ type: 'error', title: 'Release failed', detail: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleRunMission = useCallback(async () => {
    const activeScoutId = missionScoutId || hiredScouts[0]?.id;
    if (!myTeam || !activeScoutId) {
      onToast({ type: 'error', title: 'Hire a scout first', detail: 'Contract at least one scout in the network.' });
      return;
    }
    setRunningMission(true);
    try {
      const data = await apiFetch<{ scoutedPlayers: Player[] }>(
        `/api/leagues/${state.league.id}/teams/${myTeam.id}/scouts/assign`,
        {
          method: 'POST',
          body: JSON.stringify({
            scoutId: activeScoutId,
            targetRegion,
            targetRole,
            targetLeague,
            minPotential,
            archetypes: selectedArchetypes,
          }),
        }
      );
      setScoutedResults(data.scoutedPlayers || []);
      setResultFocusIdx(0);
      setWizardStep(4);
      await onRefreshState();
      onToast({
        type: 'success',
        title: `Scouting Report Ready (${data.scoutedPlayers?.length || 0} Targets)`,
        detail: 'Target shortlist generated from the verified global player registry.',
      });
    } catch (err: any) {
      onToast({ type: 'error', title: 'Mission failed', detail: err.message });
    } finally {
      setRunningMission(false);
    }
  }, [
    missionScoutId,
    hiredScouts,
    myTeam,
    state.league.id,
    targetRegion,
    targetRole,
    targetLeague,
    minPotential,
    selectedArchetypes,
    onRefreshState,
    onToast,
  ]);

  const handleToggleBookmark = async (player: Player) => {
    if (!myTeam) {
      onToast({
        type: 'error',
        title: 'Claim a club first',
        detail: 'Claim a club in Teams before bookmarking auction targets.',
      });
      return;
    }
    setBookmarkBusyId(player.id);
    try {
      const res = await apiFetch<{ bookmarked: boolean; playerName: string }>(
        `/api/leagues/${state.league.id}/teams/${myTeam.id}/bookmarks/toggle`,
        {
          method: 'POST',
          body: JSON.stringify({ playerId: player.id }),
        }
      );
      await onRefreshState();
      onToast({
        type: res.bookmarked ? 'success' : 'info',
        title: res.bookmarked ? `Bookmarked ${res.playerName}` : `Removed ${res.playerName}`,
        detail: res.bookmarked
          ? 'Tracked in Auction Targets & alerted when entering bidding.'
          : 'Removed from your auction target shortlist.',
      });
    } catch (err: any) {
      onToast({ type: 'error', title: 'Bookmark failed', detail: err.message });
    } finally {
      setBookmarkBusyId(null);
    }
  };

  const toggleArchetype = (arch: string) => {
    setSelectedArchetypes((prev) => {
      if (prev.includes(arch)) return prev.filter((a) => a !== arch);
      if (prev.length >= 3) {
        onToast({ type: 'info', title: 'Max 3 Archetypes', detail: 'Deselect one before adding another.' });
        return prev;
      }
      return [...prev, arch];
    });
  };

  const launchWizardForScout = (scoutId: string) => {
    setMissionScoutId(scoutId);
    setWizardStep(1);
    setMode('wizard');
  };

  // Full Arrow / Enter / Escape Keyboard Navigation
  useEffect(() => {
    if (inspectPlayer) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        if (mode === 'hub') {
          e.preventDefault();
          setMode('overview');
        } else if (mode === 'hire') {
          e.preventDefault();
          setMode('hub');
        } else if (mode === 'wizard') {
          e.preventDefault();
          if (wizardStep > 1) setWizardStep((s) => (s - 1) as 1 | 2 | 3 | 4);
          else setMode('hub');
        }
        return;
      }

      if (mode === 'hub') {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setSlotFocusIdx((i) => Math.min(2, i + 1));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setSlotFocusIdx((i) => Math.max(0, i - 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const scoutInSlot = hiredScouts[slotFocusIdx];
          if (scoutInSlot) {
            launchWizardForScout(scoutInSlot.id);
          } else {
            setMode('hire');
          }
        }
        return;
      }

      if (mode === 'hire' && sortedCatalog.length > 0) {
        const curIdx = sortedCatalog.findIndex((s) => s.id === selectedScoutId);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = sortedCatalog[(curIdx + 1) % sortedCatalog.length];
          if (next) setSelectedScoutId(next.id);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = sortedCatalog[(curIdx - 1 + sortedCatalog.length) % sortedCatalog.length];
          if (prev) setSelectedScoutId(prev.id);
        } else if (e.key === 'Enter' && selectedScoutId) {
          e.preventDefault();
          const alreadyHired = hiredScouts.some((s) => s.id === selectedScoutId);
          if (!alreadyHired) handleHireScout(selectedScoutId);
        }
        return;
      }

      if (mode === 'wizard') {
        if (wizardStep === 1) {
          const curIdx = LEAGUE_ORIGINS.indexOf(targetLeague);
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            setTargetLeague(LEAGUE_ORIGINS[(curIdx + 1) % LEAGUE_ORIGINS.length]);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            setTargetLeague(LEAGUE_ORIGINS[(curIdx - 1 + LEAGUE_ORIGINS.length) % LEAGUE_ORIGINS.length]);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            setWizardStep(2);
          }
        } else if (wizardStep === 2) {
          const curIdx = Math.max(0, ROLE_CARDS.findIndex((r) => r.id === targetRole));
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            setTargetRole(ROLE_CARDS[(curIdx + 1) % ROLE_CARDS.length].id);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            setTargetRole(ROLE_CARDS[(curIdx - 1 + ROLE_CARDS.length) % ROLE_CARDS.length].id);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            setWizardStep(3);
          }
        } else if (wizardStep === 3) {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            setArchFocusIdx((i) => (i + 1) % availableArchetypes.length);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setArchFocusIdx((i) => (i - 1 + availableArchetypes.length) % availableArchetypes.length);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setArchFocusIdx((i) => Math.min(availableArchetypes.length - 1, i + 4));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setArchFocusIdx((i) => Math.max(0, i - 4));
          } else if (e.key === ' ') {
            e.preventDefault();
            const arch = availableArchetypes[archFocusIdx];
            if (arch) toggleArchetype(arch);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            void handleRunMission();
          }
        } else if (wizardStep === 4 && scoutedResults.length > 0) {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            setResultFocusIdx((i) => (i + 1) % scoutedResults.length);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            setResultFocusIdx((i) => (i - 1 + scoutedResults.length) % scoutedResults.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const p = scoutedResults[resultFocusIdx];
            if (p) setInspectPlayer(p);
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    inspectPlayer,
    mode,
    wizardStep,
    slotFocusIdx,
    hiredScouts,
    sortedCatalog,
    selectedScoutId,
    targetLeague,
    targetRole,
    availableArchetypes,
    archFocusIdx,
    scoutedResults,
    resultFocusIdx,
    handleRunMission,
  ]);

  const renderStars = (count: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${
            n <= count ? 'text-[#EAB308] fill-[#EAB308]' : 'text-slate-700'
          }`}
        />
      ))}
    </div>
  );

  const activeScout = hiredScouts.find((s) => s.id === missionScoutId) || hiredScouts[0] || null;

  return (
    <div className="space-y-6">
      {/* ================= MODE 0: 3-CARD CM27 SCOUTING OVERVIEW HUB (Video 00:03–00:05) ================= */}
      {mode === 'overview' && (
        <div className="cm27-view-enter py-2 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#93E6EE]">
                TALENT ACQUISITION &amp; YOUTH STAFF
              </p>
              <h1 className="font-condensed text-4xl font-extrabold text-white uppercase tracking-wide leading-none mt-1">
                SCOUTING HUB
              </h1>
            </div>
            <div className="text-xs font-mono text-slate-400 tabular-nums">
              Transfer Purse{' '}
              <span className="text-white font-semibold">
                {myTeam
                  ? formatCurrencyLakhs(myTeam.remainingBudget, currency)
                  : formatCurrencyLakhs(state.league.startingBudget, currency)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            {/* Card 1: SCOUTED SHORTLIST */}
            <div className="cm27-panel cm27-hub-card cm27-stagger-1 p-5 min-h-[430px] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#4ADE80]">
                      PROSPECT REPORT
                    </div>
                    <h2 className="font-condensed text-2xl font-extrabold text-white uppercase tracking-wide">
                      SCOUTED SHORTLIST
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    {(scoutedResults.length > 0 ? scoutedResults : registryPlayers).length} Indexed
                  </span>
                </div>

                <div className="space-y-2.5">
                  {(scoutedResults.length > 0 ? scoutedResults : registryPlayers)
                    .slice(0, 5)
                    .map((p) => {
                      const ovrInfo = formatOvrWithDelta(p);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setInspectPlayer(p)}
                          className="cm27-hover-sweep w-full text-left px-3 py-2.5 rounded-md bg-[#0B0F15]/80 border border-white/[0.06] hover:border-white/25 flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CountryFlag country={p.country} size="xs" />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">{p.name}</div>
                              <div className="text-[10px] font-mono text-slate-400">
                                {p.primaryRole} · Age {p.age} · POT {p.potential}
                              </div>
                            </div>
                          </div>
                          <span className="w-8 h-8 rounded-full border-2 border-[#4ADE80]/75 bg-[#0A1410] flex items-center justify-center font-condensed text-sm font-bold text-[#4ADE80] tabular-nums shrink-0">
                            {ovrInfo.ovr}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="pt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (scoutedResults.length > 0) {
                      setWizardStep(4);
                      setMode('wizard');
                    } else if (hiredScouts.length > 0) {
                      launchWizardForScout(hiredScouts[0].id);
                    } else {
                      setMode('hire');
                    }
                  }}
                  className="cm27-pill-cta cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Enter Shortlist</span>
                </button>
              </div>
            </div>

            {/* Card 2: SCOUT NETWORK */}
            <div className="cm27-panel cm27-hub-card cm27-stagger-2 p-5 min-h-[430px] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#93E6EE]">
                      TRANSFER STAFF
                    </div>
                    <h2 className="font-condensed text-2xl font-extrabold text-white uppercase tracking-wide">
                      SCOUT NETWORK
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-[#93E6EE] tabular-nums">
                    {hiredScouts.length}/3 Slots
                  </span>
                </div>

                <div className="space-y-2.5">
                  {[0, 1, 2].map((idx) => {
                    const sc = hiredScouts[idx];
                    return (
                      <div
                        key={sc ? sc.id : `slot-preview-${idx}`}
                        className={`p-3 rounded-md border flex items-center justify-between gap-3 ${
                          sc?.activeMission
                            ? 'bg-[#171510]/85 border-[#EAB308]/45'
                            : 'bg-[#0B0F15]/80 border-white/[0.06]'
                        }`}
                      >
                        {sc ? (
                          <>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">{sc.name}</div>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                {sc.activeMission
                                  ? `In Transit · ${sc.activeMission.targetRole === 'ALL' ? 'Global' : sc.activeMission.targetRole}`
                                  : sc.specialtyRegion}
                              </div>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              {renderStars(sc.judgementStars)}
                              <span
                                className={`text-[9px] font-mono uppercase ${
                                  sc.activeMission ? 'text-[#EAB308]' : 'text-[#4ADE80]'
                                }`}
                              >
                                {sc.activeMission ? 'In Transit' : 'Ready'}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-semibold text-slate-500">
                              Slot {idx + 1} · {idx === hiredScouts.length ? 'Open for Hire' : 'Empty Slot'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">+ Assign</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setMode('hub')}
                  className="cm27-pill-cta cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Enter Scout Network</span>
                </button>
              </div>
            </div>

            {/* Card 3: AUCTION TARGETS & TALENT BRIEF */}
            <div className="cm27-panel cm27-hub-card cm27-stagger-3 p-5 min-h-[430px] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#EAB308]">
                      DEVELOPMENT &amp; TARGETS
                    </div>
                    <h2 className="font-condensed text-2xl font-extrabold text-white uppercase tracking-wide">
                      AUCTION TARGETS
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-[#EAB308] tabular-nums">
                    {bookmarkedIds.length} Tracked
                  </span>
                </div>

                <div className="space-y-2.5">
                  {registryPlayers
                    .filter((p) => bookmarkedIds.includes(p.id))
                    .slice(0, 4)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setInspectPlayer(p)}
                        className="cm27-hover-sweep w-full text-left px-3 py-2.5 rounded-md bg-[#16140F]/85 border border-[#EAB308]/35 hover:border-[#EAB308]/75 flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{p.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {p.primaryRole} · Base {formatCurrencyLakhs(p.basePrice, currency)}
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-[#EAB308] tabular-nums shrink-0">
                          POT {p.potential}
                        </span>
                      </button>
                    ))}
                  {bookmarkedIds.length === 0 && (
                    <div className="p-4 rounded-md cm27-panel-inset text-xs text-slate-400 leading-relaxed">
                      Dispatch scouts on targeted Talent Briefs to unearth high-potential batters, strike bowlers, and death specialists across global T20 leagues.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (hiredScouts.length > 0) {
                      launchWizardForScout(hiredScouts[0].id);
                    } else {
                      setMode('hire');
                    }
                  }}
                  className="cm27-pill-cta cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Enter Talent Brief</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODE 1: 3-SLOT SCOUT NETWORK HUB (Video 00:01–00:02) ================= */}
      {mode === 'hub' && (
        <div className="cm27-view-enter py-2 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMode('overview')}
              className="cm27-btn-dark-3d px-3.5 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Scouting Hub</span>
              <span className="cm27-keycap">Esc</span>
            </button>
            <div className="text-xs font-mono text-slate-400 tabular-nums">
              Scout Network · Budget{' '}
              <span className="text-slate-200 font-semibold">
                {myTeam
                  ? formatCurrencyLakhs(myTeam.remainingBudget, currency)
                  : formatCurrencyLakhs(state.league.startingBudget, currency)}
              </span>
            </div>
          </div>

          <div className="text-center space-y-1">
            <h1 className="font-condensed text-4xl sm:text-5xl font-extrabold text-white uppercase tracking-wide">
              TRANSFER STAFF
            </h1>
            <p className="text-xs font-mono text-slate-400 tabular-nums">
              Click an active scout slot to dispatch a Talent Brief or contract new staff
              {bookmarkedIds.length > 0 && (
                <>
                  {' '}
                  · <span className="text-[#EAB308]">{bookmarkedIds.length} Auction Targets</span>
                </>
              )}
            </p>
          </div>

          {/* 3 Visual Slot Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[0, 1, 2].map((slotIdx) => {
              const scout = hiredScouts[slotIdx] || null;
              const isNextHireSlot = !scout && slotIdx === hiredScouts.length;
              const isFocused = slotFocusIdx === slotIdx;
              const inTransit = Boolean(scout?.activeMission);
              const staggerCls = `cm27-stagger-${slotIdx + 1}`;

              if (scout) {
                return (
                  <div
                    key={scout.id}
                    onMouseEnter={() => setSlotFocusIdx(slotIdx)}
                    onClick={() => launchWizardForScout(scout.id)}
                    className={`cm27-panel cm27-hub-card ${staggerCls} p-5 min-h-[360px] flex flex-col justify-between cursor-pointer transition-all relative ${
                      inTransit
                        ? 'border-[#EAB308]/60 bg-gradient-to-b from-[#1D1B14]/85 to-[#0D1117]/85'
                        : isFocused
                          ? 'cm27-card-focus'
                          : 'hover:border-white/25'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-condensed text-xl font-extrabold text-white uppercase tracking-wide leading-tight">
                          {scout.name}
                        </h2>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReleaseScout(scout.id);
                          }}
                          disabled={busyId === scout.id}
                          className="p-1.5 rounded text-slate-500 hover:text-rose-400 cursor-pointer shrink-0"
                          title="Release Scout"
                          aria-label={`Release ${scout.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                            EXPERIENCE
                          </div>
                          {renderStars(scout.experienceStars)}
                        </div>
                        <div>
                          <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                            JUDGEMENT
                          </div>
                          {renderStars(scout.judgementStars)}
                        </div>
                      </div>

                      <div
                        className={`text-xs font-semibold ${
                          inTransit ? 'text-[#EAB308]' : 'text-[#93E6EE]'
                        }`}
                      >
                        {inTransit ? 'In Transit' : 'Available'}
                      </div>
                    </div>

                    <div className="my-auto flex flex-col items-center justify-center gap-2 py-6">
                      {inTransit ? (
                        <div className="cm27-transit-float w-12 h-12 rounded-full bg-[#EAB308]/15 border border-[#EAB308]/55 flex items-center justify-center">
                          <Compass className="w-5 h-5 text-[#EAB308]" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/15 flex items-center justify-center transition-transform">
                          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                        </div>
                      )}
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300">
                        {inTransit ? 'Update Talent Brief' : 'Start Talent Brief'}
                      </span>
                    </div>

                    <div className={`text-[11px] ${inTransit ? 'text-amber-200/90' : 'text-[#93E6EE]'}`}>
                      {scout.activeMission
                        ? `Assignment: ${scout.activeMission.targetRole === 'ALL' ? 'Any Role' : scout.activeMission.targetRole} (${scout.activeMission.targetRegion})`
                        : 'Available for a new mission.'}
                    </div>
                  </div>
                );
              }

              if (isNextHireSlot) {
                return (
                  <button
                    key={`hire-slot-${slotIdx}`}
                    type="button"
                    onMouseEnter={() => setSlotFocusIdx(slotIdx)}
                    onClick={() => setMode('hire')}
                    className={`cm27-panel cm27-hub-card ${staggerCls} p-5 min-h-[360px] flex flex-col justify-between text-left cursor-pointer transition-all ${
                      isFocused ? 'cm27-card-focus' : 'hover:border-white/25'
                    }`}
                  >
                    <div>
                      <h2 className="font-condensed text-xl font-extrabold text-white uppercase tracking-wide">
                        HIRE SCOUT
                      </h2>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Slot {slotIdx + 1} of 3
                      </div>
                    </div>

                    <div className="my-auto flex items-center justify-center">
                      <span className="w-12 h-12 rounded-full border border-dashed border-white/30 bg-white/[0.03] flex items-center justify-center text-slate-200">
                        <Plus className="w-5 h-5" />
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Hire your next transfer scout for the network.
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={`empty-slot-${slotIdx}`}
                  type="button"
                  onMouseEnter={() => setSlotFocusIdx(slotIdx)}
                  onClick={() => setMode('hire')}
                  className={`cm27-panel-inset ${staggerCls} p-5 min-h-[360px] flex flex-col justify-between text-left cursor-pointer transition-all opacity-70 hover:opacity-100 ${
                    isFocused ? 'cm27-card-focus !opacity-100' : ''
                  }`}
                >
                  <div>
                    <h2 className="font-condensed text-xl font-extrabold text-slate-500 uppercase tracking-wide">
                      EMPTY
                    </h2>
                  </div>
                  <div className="text-[11px] text-slate-500">Open slot</div>
                </button>
              );
            })}
          </div>

          {/* Hub Footer Controls */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {hiredScouts.length > 0 && (
              <button
                type="button"
                onClick={() => launchWizardForScout(hiredScouts[0].id)}
                className="cm27-btn-3d px-5 py-2.5 rounded font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Launch Talent Brief</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode('hire')}
              className="cm27-btn-dark-3d px-4 py-2.5 rounded text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Browse Full Scout Catalog ({catalog.length})
            </button>
            {scoutedResults.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setWizardStep(4);
                  setMode('wizard');
                }}
                className="cm27-btn-dark-3d px-4 py-2.5 rounded text-xs font-semibold text-[#EAB308] cursor-pointer"
              >
                View Last Shortlist ({scoutedResults.length})
              </button>
            )}
          </div>

          <div className="flex items-center justify-center gap-5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="cm27-keycap">← →</span> Select Slot
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="cm27-keycap">Enter</span> Open Mission / Hire
            </span>
          </div>
        </div>
      )}

      {/* ================= MODE 2: HIRE SCOUT CATALOG ================= */}
      {mode === 'hire' && (
        <div className="cm27-view-enter space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMode('hub')}
              className="cm27-btn-dark-3d px-3.5 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Network</span>
              <span className="cm27-keycap">Esc</span>
            </button>

            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Transfer Budget
              </div>
              <div className="font-condensed text-2xl font-extrabold text-white tabular-nums">
                {myTeam
                  ? formatCurrencyLakhs(myTeam.remainingBudget, currency)
                  : formatCurrencyLakhs(state.league.startingBudget, currency)}
              </div>
            </div>
          </div>

          <div className="cm27-panel overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-[#1A212B] via-[#131820] to-[#0E1218] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-condensed text-3xl font-extrabold text-white uppercase tracking-wide">
                  HIRE PLAYER &amp; YOUTH SCOUT
                </h1>
                <p className="text-xs text-slate-400 max-w-xl leading-snug mt-0.5">
                  Higher Experience expands shortlist depth across IPL, PSL, SA20, International, BBL &amp; The Hundred. Better Judgement unearths higher-potential stars.
                </p>
              </div>
              <div className="text-xs font-mono text-[#93E6EE] tabular-nums">
                {hiredScouts.length}/6 Hired
              </div>
            </div>

            <div className="px-6 py-2.5 bg-[#0C0F14] border-b border-white/[0.06] grid grid-cols-12 text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <button
                onClick={() => setSortAsc((s) => !s)}
                className="col-span-5 flex items-center gap-1.5 text-left hover:text-white cursor-pointer"
              >
                <span>SCOUT NAME</span>
                <ArrowUpDown className="w-3 h-3" />
              </button>
              <div className="col-span-2">EXPERIENCE</div>
              <div className="col-span-2">JUDGEMENT</div>
              <div className="col-span-2">NETWORK COST</div>
              <div className="col-span-1 text-right">ACTION</div>
            </div>

            <div className="divide-y divide-white/[0.06] max-h-[460px] overflow-y-auto">
              {sortedCatalog.map((scout) => {
                const isSelected = selectedScoutId === scout.id;
                const isHired = hiredScouts.some((s) => s.id === scout.id);
                return (
                  <div
                    key={scout.id}
                    onClick={() => setSelectedScoutId(scout.id)}
                    className={`px-6 py-3 grid grid-cols-12 items-center gap-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#1D2532] ring-1 ring-inset ring-[#93E6EE]/55'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="col-span-5 flex items-center gap-3 min-w-0">
                      <CountryFlag country={scout.country} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{scout.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {scout.country} · {scout.specialtyRegion}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2">{renderStars(scout.experienceStars)}</div>
                    <div className="col-span-2">{renderStars(scout.judgementStars)}</div>
                    <div className="col-span-2 font-mono text-sm font-bold text-white tabular-nums">
                      {formatCurrencyLakhs(scout.networkCostLakhs, currency)}
                    </div>
                    <div className="col-span-1 text-right">
                      {isHired ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#4ADE80]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Hired
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHireScout(scout.id);
                          }}
                          disabled={busyId === scout.id}
                          className="cm27-btn-3d px-3 py-1 rounded font-bold text-xs cursor-pointer disabled:opacity-50"
                        >
                          {busyId === scout.id ? '...' : 'Hire'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODE 3: INTERACTIVE 4-STEP TALENT BRIEF WIZARD (Images 4 & 5) ================= */}
      {mode === 'wizard' && (
        <div className="cm27-view-enter space-y-6">
          {/* Top Segmented Step Bars & Back Control */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                wizardStep > 1
                  ? setWizardStep((s) => (s - 1) as 1 | 2 | 3 | 4)
                  : setMode('hub')
              }
              className="cm27-btn-dark-3d px-3.5 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{wizardStep > 1 ? 'Previous Step' : 'Back to Network'}</span>
              <span className="cm27-keycap">Esc</span>
            </button>

            <div className="flex items-center gap-1.5">
              {([1, 2, 3, 4] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    if (st < 4 || scoutedResults.length > 0) setWizardStep(st);
                  }}
                  className={`h-1.5 w-10 rounded-sm transition-all cursor-pointer ${
                    wizardStep === st
                      ? 'bg-[#93E6EE]'
                      : wizardStep > st
                        ? 'bg-slate-400'
                        : 'bg-white/15'
                  }`}
                  title={`Step ${st} of 4`}
                />
              ))}
            </div>

            <div className="text-xs font-mono text-slate-400">
              Scout: <strong className="text-white">{activeScout?.name || 'Network'}</strong>
            </div>
          </div>

          {/* STEP 1: COMPETITION, NATION & POTENTIAL */}
          {wizardStep === 1 && (
            <div className="cm27-view-enter max-w-4xl mx-auto space-y-6 py-4">
              <div className="text-center space-y-1">
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-400">
                  TALENT BRIEF · TERRITORY
                </div>
                <h2 className="font-condensed text-4xl font-extrabold text-white uppercase tracking-wide">
                  WHERE SHOULD {activeScout?.name || 'YOUR SCOUT'} SEARCH?
                </h2>
                <p className="text-xs text-slate-400">
                  Choose target competition, nationality, and minimum potential threshold
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                {LEAGUE_ORIGINS.map((comp) => {
                  const selected = targetLeague === comp;
                  return (
                    <button
                      key={comp}
                      type="button"
                      onClick={() => setTargetLeague(comp)}
                      className={`cm27-panel p-4 text-center cursor-pointer transition-all ${
                        selected ? 'cm27-card-focus' : 'hover:border-white/25'
                      }`}
                    >
                      <div className="font-condensed text-lg font-extrabold text-white uppercase">
                        {comp === 'ALL' ? 'GLOBAL' : comp}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {comp === 'ALL' ? 'All Leagues' : 'Verified'}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="cm27-panel p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1.5">
                    Target Nationality
                  </label>
                  <select
                    value={targetRegion}
                    onChange={(e) => setTargetRegion(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0C0F14] border border-white/15 text-white text-xs focus:outline-none focus:border-[#93E6EE]"
                  >
                    <option value="ALL">ALL COUNTRIES</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 flex items-center justify-between mb-1.5 tabular-nums">
                    <span>Minimum Potential</span>
                    <strong className="text-[#93E6EE] text-xs">{minPotential} POT</strong>
                  </label>
                  <input
                    type="range"
                    min={65}
                    max={92}
                    value={minPotential}
                    onChange={(e) => setMinPotential(Number(e.target.value))}
                    className="w-full accent-[#93E6EE] mt-1.5"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="cm27-btn-3d px-8 py-2.5 rounded font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                >
                  <span>Next: Choose Role</span>
                  <span className="cm27-keycap">Enter</span>
                </button>
                <div className="text-[11px] font-mono text-slate-500">1 / 4</div>
              </div>
            </div>
          )}

          {/* STEP 2: WHO ARE WE HUNTING? (Reference Image 4) */}
          {wizardStep === 2 && (
            <div className="cm27-view-enter max-w-5xl mx-auto space-y-6 py-4">
              <div className="text-center space-y-1">
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-400">
                  TALENT BRIEF
                </div>
                <h2 className="font-condensed text-4xl font-extrabold text-white uppercase tracking-wide">
                  WHO ARE WE HUNTING?
                </h2>
                <p className="text-xs text-slate-400">Pick a role to narrow the search</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {ROLE_CARDS.map((role) => {
                  const selected = targetRole === role.id;
                  return (
                    <div
                      key={role.id}
                      onClick={() => setTargetRole(role.id)}
                      className={`cm27-panel p-5 min-h-[210px] flex flex-col justify-between cursor-pointer transition-all ${
                        selected ? 'cm27-card-focus' : 'hover:border-white/25'
                      }`}
                    >
                      <div>
                        <h3 className="font-condensed text-2xl font-extrabold text-white uppercase tracking-wide">
                          {role.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{role.desc}</p>
                      </div>
                      <div className="pt-4">
                        <span
                          className={`inline-block text-[11px] font-mono uppercase ${
                            selected ? 'text-[#93E6EE] font-bold' : 'text-slate-500'
                          }`}
                        >
                          {selected ? 'Selected' : 'Click to pick'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className="cm27-btn-3d px-8 py-2.5 rounded font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                >
                  <span>Next: Playing Style</span>
                  <span className="cm27-keycap">Enter</span>
                </button>
                <div className="text-[11px] font-mono text-slate-500">2 / 4</div>
              </div>
            </div>
          )}

          {/* STEP 3: PLAYING STYLE / ARCHETYPES (Video 00:00 — BAT STYLES & BOWL STYLES split) */}
          {wizardStep === 3 && (
            <div className="cm27-view-enter max-w-4xl mx-auto space-y-6 py-4">
              <div className="text-center space-y-1">
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-400">
                  PLAYING STYLE
                </div>
                <h2 className="font-condensed text-4xl sm:text-5xl font-extrabold text-white uppercase tracking-wide">
                  ARCHETYPES
                </h2>
                <p className="text-xs text-slate-400">Pick up to 3 · leave empty for any</p>
                <div className="text-xs font-mono font-bold text-[#93E6EE] pt-1 tabular-nums">
                  {selectedArchetypes.length}/3 SELECTED
                </div>
              </div>

              {/* Separated BAT STYLES & BOWL STYLES Sections matching Video 00:00 */}
              <div className="space-y-5 max-w-3xl mx-auto">
                {availableArchetypes.some((a) => (BAT_ARCHETYPES as readonly string[]).includes(a)) && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                      BAT STYLES
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {availableArchetypes
                        .filter((a) => (BAT_ARCHETYPES as readonly string[]).includes(a))
                        .map((arch) => {
                          const idx = availableArchetypes.indexOf(arch);
                          const checked = selectedArchetypes.includes(arch);
                          const focused = archFocusIdx === idx;
                          return (
                            <button
                              key={arch}
                              type="button"
                              onMouseEnter={() => setArchFocusIdx(idx)}
                              onClick={() => toggleArchetype(arch)}
                              className={`cm27-panel cm27-hover-sweep px-4 py-3.5 text-left flex items-center gap-3 cursor-pointer transition-all ${
                                checked || focused ? 'cm27-card-focus' : 'hover:border-white/25'
                              }`}
                            >
                              <span
                                className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${
                                  checked
                                    ? 'bg-[#93E6EE] border-[#93E6EE] text-[#0B0E14]'
                                    : 'border-white/25 bg-[#0C0F14]'
                                }`}
                              >
                                {checked && <Check className="w-3 h-3 stroke-[3]" />}
                              </span>
                              <span className="text-xs sm:text-sm font-semibold text-white">{arch}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {availableArchetypes.some((a) => (BOWL_ARCHETYPES as readonly string[]).includes(a)) && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                      BOWL STYLES
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {availableArchetypes
                        .filter((a) => (BOWL_ARCHETYPES as readonly string[]).includes(a))
                        .map((arch) => {
                          const idx = availableArchetypes.indexOf(arch);
                          const checked = selectedArchetypes.includes(arch);
                          const focused = archFocusIdx === idx;
                          return (
                            <button
                              key={arch}
                              type="button"
                              onMouseEnter={() => setArchFocusIdx(idx)}
                              onClick={() => toggleArchetype(arch)}
                              className={`cm27-panel cm27-hover-sweep px-4 py-3.5 text-left flex items-center gap-3 cursor-pointer transition-all ${
                                checked || focused ? 'cm27-card-focus' : 'hover:border-white/25'
                              }`}
                            >
                              <span
                                className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${
                                  checked
                                    ? 'bg-[#93E6EE] border-[#93E6EE] text-[#0B0E14]'
                                    : 'border-white/25 bg-[#0C0F14]'
                                }`}
                              >
                                {checked && <Check className="w-3 h-3 stroke-[3]" />}
                              </span>
                              <span className="text-xs sm:text-sm font-semibold text-white">{arch}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Brief & Cost Footer Bar matching Video 00:00 */}
              <div className="max-w-3xl mx-auto border-t border-white/[0.08] pt-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    BRIEF
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-white mt-0.5">
                    {targetRole === 'ALL' ? 'Any Role' : targetRole} ·{' '}
                    {selectedArchetypes.length > 0
                      ? selectedArchetypes.join(', ')
                      : 'Any archetype'}{' '}
                    · {targetLeague === 'ALL' ? 'Global' : targetLeague}
                    {targetRegion !== 'ALL' ? ` (${targetRegion})` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    COST
                  </div>
                  <div className="font-condensed text-xl font-extrabold text-white tabular-nums">
                    {activeScout ? formatCurrencyLakhs(activeScout.networkCostLakhs, currency) : 'Free'}
                    <span className="text-[11px] font-mono text-[#93E6EE] ml-2">
                      · {minPotential}+ POT
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleRunMission}
                  disabled={runningMission}
                  className="cm27-btn-3d px-8 py-2.5 rounded font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{runningMission ? 'Scanning Registry...' : 'Start Mission'}</span>
                </button>
                <div className="text-[11px] font-mono text-slate-500">3 / 4</div>
              </div>
            </div>
          )}

          {/* STEP 4: SCOUTED SHORTLIST RESULTS */}
          {wizardStep === 4 && (
            <div className="cm27-view-enter cm27-panel p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                <div>
                  <h2 className="font-condensed text-3xl font-extrabold text-white uppercase">
                    SCOUTED SHORTLIST ({scoutedResults.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    {targetRole === 'ALL' ? 'All Roles' : targetRole} ·{' '}
                    {selectedArchetypes.length > 0
                      ? selectedArchetypes.join(', ')
                      : 'Balanced Profile'}{' '}
                    · Bookmark targets to alert you when they enter the Live Auction
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#EAB308] tabular-nums px-3 py-1.5 rounded bg-[#0C0F14] border border-white/10">
                    <Target className="w-3.5 h-3.5" />
                    <span>{bookmarkedIds.length} Auction Targets</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="cm27-btn-dark-3d px-3.5 py-1.5 rounded text-xs font-semibold cursor-pointer"
                  >
                    Refine Brief
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('hub')}
                    className="cm27-btn-3d px-3.5 py-1.5 rounded text-xs font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>

              {scoutedResults.length === 0 ? (
                <div className="cm27-panel-inset p-10 text-center space-y-2">
                  <p className="text-xs text-slate-400">
                    No players matched those exact filters. Lower Minimum Potential or widen Competition.
                  </p>
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="cm27-btn-dark-3d px-4 py-2 rounded text-xs font-semibold cursor-pointer"
                  >
                    Adjust Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-1">
                  {scoutedResults.map((p, idx) => {
                    const ovrInfo = formatOvrWithDelta(p);
                    const isBookmarked = bookmarkedIds.includes(p.id);
                    const focused = resultFocusIdx === idx;
                    return (
                      <div
                        key={p.id}
                        onMouseEnter={() => setResultFocusIdx(idx)}
                        onClick={() => setInspectPlayer(p)}
                        className={`cm27-hover-sweep p-4 rounded border cursor-pointer flex items-center justify-between gap-3 transition-all ${
                          focused
                            ? 'cm27-card-focus'
                            : isBookmarked
                              ? 'border-[#EAB308]/60 bg-[#1B1810]'
                              : 'cm27-panel-inset hover:border-white/25'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1.5">
                            <CountryFlag country={p.country} size="xs" />
                            <span className="truncate">{p.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {p.primaryRole} · {p.leagueOrigin} · Age {p.age}
                          </div>
                          <div className="text-[10px] font-mono text-[#4ADE80] mt-1 tabular-nums">
                            Base {formatCurrencyLakhs(p.basePrice, currency)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleBookmark(p);
                            }}
                            disabled={bookmarkBusyId === p.id}
                            className={`p-2 rounded border transition-colors cursor-pointer ${
                              isBookmarked
                                ? 'bg-amber-500/20 border-[#EAB308] text-[#EAB308]'
                                : 'bg-[#0C0F14] border-white/10 text-slate-400 hover:border-[#EAB308]/60 hover:text-[#EAB308]'
                            }`}
                            title={isBookmarked ? 'Bookmarked for Auction' : 'Bookmark for Auction'}
                          >
                            {isBookmarked ? (
                              <Target className="w-4 h-4" />
                            ) : (
                              <Bookmark className="w-4 h-4" />
                            )}
                          </button>
                          <div className="text-right">
                            <div className="font-condensed text-2xl font-extrabold text-[#EAB308] leading-none tabular-nums">
                              {ovrInfo.ovr}
                              {ovrInfo.delta !== 0 && (
                                <span
                                  className={`text-xs font-mono ml-0.5 ${
                                    ovrInfo.delta > 0 ? 'text-[#4ADE80]' : 'text-rose-400'
                                  }`}
                                >
                                  {ovrInfo.delta > 0 ? `+${ovrInfo.delta}` : ovrInfo.delta}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-[#93E6EE] mt-1 tabular-nums">
                              POT {p.potential}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {inspectPlayer && (
        <PlayerProfileModal
          player={inspectPlayer}
          onClose={() => setInspectPlayer(null)}
          isBookmarked={bookmarkedIds.includes(inspectPlayer.id)}
          onToggleBookmark={() => handleToggleBookmark(inspectPlayer)}
          bookmarkBusy={bookmarkBusyId === inspectPlayer.id}
        />
      )}
    </div>
  );
}
