import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  CheckCircle2,
  Crown,
  Flame,
  GripVertical,
  Plus,
  Save,
  Shield,
  Sparkles,
  Star,
  Swords,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  CoachCatalogEntry,
  LeagueStateSnapshot,
  Lineup,
  SquadPlayer,
  Team,
} from '../types/game';
import { apiFetch } from '../lib/api';
import {
  formatCurrencyLakhs,
  formatOvrWithDelta,
  getFormatDisplayLabel,
  getLeagueFormats,
  getPlayerOverall,
  type MatchFormatCode,
} from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { PlayerProfileModal } from '../components/PlayerProfileModal';
import { TeamCrest } from '../components/TeamCrest';
import { CountryFlag } from '../components/CountryFlag';
import { CyanPlayerCard } from '../components/CyanPlayerCard';
import type { ActiveTab } from '../components/AppShell';
import { computeDevelopmentPlanAttributes } from '../utils/officeMetrics';

type SquadSubTab = 'hub' | 'staff' | 'status' | 'lineups' | 'development';

function getBowlStyleShort(bowlingStyle: string): string {
  const s = (bowlingStyle || '').toLowerCase();
  if (!s || s === 'none' || s.includes('wicket')) return 'NON';
  if (s.includes('left-arm') && s.includes('fast')) return 'LF';
  if (s.includes('fast-medium') || s.includes('medium-fast')) return s.includes('left') ? 'LM' : 'RM';
  if (s.includes('fast')) return 'RF';
  if (s.includes('medium')) return s.includes('left') ? 'LM' : 'RM';
  if (s.includes('chinaman') || s.includes('unorthodox')) return 'LC';
  if (s.includes('orthodox') || (s.includes('left') && s.includes('spin'))) return 'SLA';
  if (s.includes('leg-break') || s.includes('leg break') || s.includes('leg-spin')) return 'LS';
  if (s.includes('off-break') || s.includes('off break') || s.includes('off-spin')) return 'OS';
  return 'OS';
}

function getPrefPositionLabel(role: string, battingRating: number): string {
  if (role === 'Batsman' || role === 'Wicketkeeper') {
    return battingRating >= 80 ? 'Top' : 'Mid';
  }
  if (role === 'All-Rounder') return 'Mid';
  return 'Low';
}

const GROWTH_TRAJECTORIES = [
  { id: 'Balanced', desc: 'Even growth across core skills' },
  { id: 'Dynamic', desc: 'Flexible growth — adapt to match roles' },
  { id: 'BAT | Aggressor', desc: 'Power hitting & boundary timing focus' },
  { id: 'BAT | Finisher', desc: 'Death-over strike rotation & composure' },
  { id: 'BAT | Anchor', desc: 'Technique, temperament & innings pacing' },
  { id: 'BOWL | New-ball', desc: 'Swing, seam & powerplay breakthroughs' },
  { id: 'BOWL | Death overs', desc: 'Yorker accuracy & slower-ball control' },
  { id: 'BOWL | Containment', desc: 'Economy, spin drift & line discipline' },
];

export function SquadView({
  state,
  initialTeamId,
  squadVersion,
  onToast,
  onRefreshLeague,
  onNavigate,
}: {
  state: LeagueStateSnapshot;
  initialTeamId: number | null;
  squadVersion: number;
  onToast: (t: { type: 'success' | 'error' | 'info'; title: string; detail?: string }) => void;
  onRefreshLeague: () => Promise<void>;
  onNavigate?: (tab: ActiveTab) => void;
}) {
  const { user, profile } = useAuth();
  const currency = profile?.preferredCurrency || 'INR';

  const defaultTeamId = initialTeamId || state.myTeam?.id || state.teams[0]?.id || 0;
  const [selectedTeamId, setSelectedTeamId] = useState<number>(defaultTeamId);
  const [subTab, setSubTab] = useState<SquadSubTab>('hub');

  const [teamInfo, setTeamInfo] = useState<Team | null>(null);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [lineupsList, setLineupsList] = useState<Lineup[]>([]);
  const [loading, setLoading] = useState(true);

  // Squad Status selected player
  const [statusPlayerId, setStatusPlayerId] = useState<number | null>(null);

  // Lineup Editor state
  const allowedFormats = useMemo(
    () => getLeagueFormats(teamInfo?.leagueCategory, state.league.primaryCompetition),
    [teamInfo?.leagueCategory, state.league.primaryCompetition]
  );
  const [activeFormat, setActiveFormat] = useState<MatchFormatCode>(allowedFormats[0] || 'T20');
  const [battingOrder, setBattingOrder] = useState<number[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [wicketkeeperId, setWicketkeeperId] = useState<number | null>(null);
  const [lineupFocusId, setLineupFocusId] = useState<number | null>(null);
  const [swapSourceId, setSwapSourceId] = useState<number | null>(null);
  const [dragPlayerId, setDragPlayerId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [savingLineup, setSavingLineup] = useState(false);

  const syncedLineupSigRef = useRef<string>('');
  const persistInFlightRef = useRef<boolean>(false);

  useEffect(() => {
    if (!allowedFormats.includes(activeFormat)) {
      setActiveFormat(allowedFormats[0]);
    }
  }, [allowedFormats, activeFormat]);

  // Coaching Staff catalog
  const [coachCatalog, setCoachCatalog] = useState<CoachCatalogEntry[]>([]);
  const [staffBusyId, setStaffBusyId] = useState<string | null>(null);

  // Development & Tactics state
  const [devPlayerId, setDevPlayerId] = useState<number | null>(null);
  const [devTrajectory, setDevTrajectory] = useState('Dynamic');
  const [devIntensity, setDevIntensity] = useState<'Light' | 'Standard' | 'Intensive'>('Standard');
  const [savingDev, setSavingDev] = useState(false);

  const [t20Tempo, setT20Tempo] = useState<'Balanced' | 'Aggressive' | 'Ultra-Attacking' | 'Anchor-Led'>('Aggressive');
  const [aimRpo, setAimRpo] = useState(9.2);
  const [savingTactics, setSavingTactics] = useState(false);

  const [profileModalPlayer, setProfileModalPlayer] = useState<SquadPlayer | null>(null);

  useEffect(() => {
    if (initialTeamId) setSelectedTeamId(initialTeamId);
    else if (state.myTeam && !selectedTeamId) setSelectedTeamId(state.myTeam.id);
  }, [initialTeamId, state.myTeam?.id]);

  const loadSquadData = async () => {
    if (!selectedTeamId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{
        team: Team;
        squad: SquadPlayer[];
        lineups: Lineup[];
      }>(`/api/leagues/${state.league.id}/teams/${selectedTeamId}/squad`);
      setTeamInfo(data.team);
      setSquad(data.squad);
      setLineupsList(data.lineups);
      if (data.squad.length > 0) {
        const firstId = devPlayerId || data.squad[0].id;
        setStatusPlayerId((prev) => prev || data.squad[0].id);
        setDevPlayerId((prev) => prev || firstId);
        const firstPlayer = data.squad.find((p) => p.id === firstId) || data.squad[0];
        const savedPlan =
          data.team.developmentPlansJson?.[String(firstPlayer.id)]?.trajectory ||
          (firstPlayer.primaryRole === 'Bowler' ? 'BOWL | New-ball' : 'Balanced');
        setDevTrajectory(savedPlan);
      }
      if (data.team.tacticsJson) {
        setT20Tempo(data.team.tacticsJson.t20Tempo || 'Aggressive');
        setAimRpo(data.team.tacticsJson.aimRpo || 9.2);
      }
    } catch (err: any) {
      onToast({ type: 'error', title: 'Could not load squad', detail: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSquadData();
  }, [selectedTeamId, state.league.id, squadVersion]);

  useEffect(() => {
    apiFetch<{ coaches: CoachCatalogEntry[] }>(`/api/leagues/${state.league.id}/catalogs`)
      .then((res) => setCoachCatalog(res.coaches || []))
      .catch(() => {});
  }, [state.league.id]);

  useEffect(() => {
    if (persistInFlightRef.current) return;
    const existing = lineupsList.find((l) => l.format === activeFormat);
    const sig = existing
      ? `${selectedTeamId}:${activeFormat}:${existing.updatedAt}:${existing.captainPlayerId}:${existing.wicketkeeperPlayerId}:${(existing.battingOrderJson || []).join(',')}`
      : `${selectedTeamId}:${activeFormat}:auto:${squad.map((p) => p.id).slice(0, 11).join(',')}`;

    if (syncedLineupSigRef.current === sig) return;
    syncedLineupSigRef.current = sig;

    if (existing) {
      setBattingOrder(existing.battingOrderJson || []);
      setCaptainId(existing.captainPlayerId);
      setViceCaptainId(existing.viceCaptainPlayerId);
      // Guard WK to natural wicketkeeper only
      const wkCandidate = squad.find((p) => p.id === existing.wicketkeeperPlayerId);
      if (wkCandidate && wkCandidate.primaryRole === 'Wicketkeeper') {
        setWicketkeeperId(wkCandidate.id);
      } else {
        const naturalWk = squad.find(
          (p) => p.primaryRole === 'Wicketkeeper' && (existing.battingOrderJson || []).includes(p.id)
        );
        setWicketkeeperId(naturalWk?.id ?? null);
      }
    } else {
      const autoXI = squad.slice(0, 11).map((p) => p.id);
      setBattingOrder(autoXI);
      setCaptainId(autoXI[0] ?? null);
      setViceCaptainId(autoXI[1] ?? null);
      const naturalKeeper = squad.find((p) => p.primaryRole === 'Wicketkeeper' && autoXI.includes(p.id));
      setWicketkeeperId(naturalKeeper?.id ?? null);
    }
  }, [selectedTeamId, activeFormat, lineupsList, squad]);

  useEffect(() => {
    if (battingOrder.length > 0 && (!lineupFocusId || !squad.some((s) => s.id === lineupFocusId))) {
      setLineupFocusId(battingOrder[0]);
    }
  }, [battingOrder, lineupFocusId, squad]);

  const isMyTeam = teamInfo?.ownerUid === user?.uid;
  const squadMap = useMemo(() => new Map(squad.map((p) => [p.id, p])), [squad]);
  const playingXI = battingOrder.map((id) => squadMap.get(id)).filter((p): p is SquadPlayer => Boolean(p));
  const reserves = squad.filter((p) => !battingOrder.includes(p.id));

  const hiredStaff = teamInfo?.hiredStaffJson || [];
  const headCoachSlot = hiredStaff.find((s) => s.role === 'Head Coach');
  const batCoachSlot = hiredStaff.find((s) => s.role === 'Batting Coach');
  const bowlCoachSlot = hiredStaff.find((s) => s.role === 'Bowling Coach');
  const fieldCoachSlot = hiredStaff.find((s) => s.role === 'Fielding Coach');
  const wkCoachSlot = hiredStaff.find((s) => s.role === 'Wicketkeeping Coach');

  // Role breakdown counts for Manage Squad card (Image 8)
  const battersCount = squad.filter((p) => p.primaryRole === 'Batsman').length;
  const arCount = squad.filter((p) => p.primaryRole === 'All-Rounder').length;
  const bowlersCount = squad.filter((p) => p.primaryRole === 'Bowler').length;
  const wkCount = squad.filter((p) => p.primaryRole === 'Wicketkeeper').length;

  const avgFitness = squad.length
    ? Math.round(squad.reduce((s, p) => s + p.fitness, 0) / squad.length)
    : 88;
  const avgSharpness = squad.length
    ? Math.round(squad.reduce((s, p) => s + p.currentForm, 0) / squad.length)
    : 74;
  const avgMorale = squad.length
    ? Math.round(squad.reduce((s, p) => s + p.morale, 0) / squad.length)
    : 76;

  // Actions
  const handleHireCoach = async (coachId: string) => {
    if (!teamInfo || !isMyTeam) return;
    setStaffBusyId(coachId);
    try {
      await apiFetch(`/api/leagues/${state.league.id}/teams/${teamInfo.id}/staff/hire`, {
        method: 'POST',
        body: JSON.stringify({ coachId }),
      });
      await Promise.all([loadSquadData(), onRefreshLeague()]);
      onToast({ type: 'success', title: 'Coach Appointed', detail: 'Coaching staff updated.' });
    } catch (err: any) {
      onToast({ type: 'error', title: 'Cannot hire coach', detail: err.message });
    } finally {
      setStaffBusyId(null);
    }
  };

  const handleReleaseCoach = async (coachId: string) => {
    if (!teamInfo || !isMyTeam) return;
    setStaffBusyId(coachId);
    try {
      await apiFetch(`/api/leagues/${state.league.id}/teams/${teamInfo.id}/staff/release`, {
        method: 'POST',
        body: JSON.stringify({ coachId }),
      });
      await Promise.all([loadSquadData(), onRefreshLeague()]);
      onToast({ type: 'info', title: 'Coach Released' });
    } catch (err: any) {
      onToast({ type: 'error', title: 'Release failed', detail: err.message });
    } finally {
      setStaffBusyId(null);
    }
  };

  const persistLineup = async (
    nextOrder: number[],
    nextCaptainId: number | null,
    nextViceCaptainId: number | null,
    nextWicketkeeperId: number | null,
    toastTitle?: string
  ) => {
    if (!teamInfo || !isMyTeam) return;
    persistInFlightRef.current = true;
    setSavingLineup(true);
    try {
      const res = await apiFetch<{ lineup: Lineup }>(
        `/api/leagues/${state.league.id}/teams/${teamInfo.id}/lineup`,
        {
          method: 'PUT',
          body: JSON.stringify({
            format: activeFormat,
            battingOrder: nextOrder,
            captainPlayerId: nextCaptainId,
            viceCaptainPlayerId: nextViceCaptainId,
            wicketkeeperPlayerId: nextWicketkeeperId,
          }),
        }
      );
      if (res.lineup) {
        const saved = res.lineup;
        syncedLineupSigRef.current = `${selectedTeamId}:${activeFormat}:${saved.updatedAt}:${saved.captainPlayerId}:${saved.wicketkeeperPlayerId}:${(saved.battingOrderJson || []).join(',')}`;
        setLineupsList((prev) => {
          const rest = prev.filter((l) => l.format !== activeFormat);
          return [...rest, saved];
        });
      }
      if (toastTitle) {
        onToast({ type: 'success', title: toastTitle });
      }
    } catch (err: any) {
      onToast({ type: 'error', title: 'Lineup update failed', detail: err.message });
    } finally {
      persistInFlightRef.current = false;
      setSavingLineup(false);
    }
  };

  const handleSaveLineup = async () => {
    await persistLineup(
      battingOrder,
      captainId,
      viceCaptainId,
      wicketkeeperId,
      `${getFormatDisplayLabel(activeFormat)} Lineup Saved`
    );
  };

  const handleReleasePlayer = async (player: SquadPlayer) => {
    if (!teamInfo || !isMyTeam) return;
    try {
      const res = await apiFetch<{ refund: number }>(
        `/api/leagues/${state.league.id}/teams/${teamInfo.id}/release`,
        {
          method: 'POST',
          body: JSON.stringify({ playerId: player.id }),
        }
      );
      onToast({
        type: 'info',
        title: `Released ${player.name}`,
        detail: `Recovered ${formatCurrencyLakhs(res.refund, currency)}.`,
      });
      await Promise.all([loadSquadData(), onRefreshLeague()]);
    } catch (err: any) {
      onToast({ type: 'error', title: 'Release failed', detail: err.message });
    }
  };

  const handleSaveDevPlan = async () => {
    if (!teamInfo || !isMyTeam || !devPlayerId) return;
    setSavingDev(true);
    try {
      await apiFetch(`/api/leagues/${state.league.id}/teams/${teamInfo.id}/development`, {
        method: 'PUT',
        body: JSON.stringify({
          playerId: devPlayerId,
          trajectory: devTrajectory,
          focusAttribute: devTrajectory.includes('BOWL') ? 'Pace / Accuracy' : 'Timing / Power',
          weeklyIntensity: devIntensity,
        }),
      });
      await Promise.all([loadSquadData(), onRefreshLeague()]);
      onToast({ type: 'success', title: 'Development Trajectory Saved' });
    } catch (err: any) {
      onToast({ type: 'error', title: 'Save failed', detail: err.message });
    } finally {
      setSavingDev(false);
    }
  };

  const handleSaveTactics = async () => {
    if (!teamInfo || !isMyTeam) return;
    setSavingTactics(true);
    try {
      await apiFetch(`/api/leagues/${state.league.id}/teams/${teamInfo.id}/tactics`, {
        method: 'PUT',
        body: JSON.stringify({
          t20Tempo,
          odiTempo: 'Balanced',
          testTempo: 'Measured',
          aimRpo,
          powerplayAggression: 'High',
          deathPlan: 'Yorker Focus',
        }),
      });
      await Promise.all([loadSquadData(), onRefreshLeague()]);
      onToast({ type: 'success', title: 'Team Tactics Saved' });
    } catch (err: any) {
      onToast({ type: 'error', title: 'Save failed', detail: err.message });
    } finally {
      setSavingTactics(false);
    }
  };

  const toggleInXI = (playerId: number) => {
    if (!isMyTeam) return;
    setLineupFocusId(playerId);
    if (battingOrder.includes(playerId)) {
      const nextOrder = battingOrder.filter((id) => id !== playerId);
      const nextCap = captainId === playerId ? (nextOrder[0] ?? null) : captainId;
      const nextWk = wicketkeeperId === playerId ? null : wicketkeeperId;
      setBattingOrder(nextOrder);
      setCaptainId(nextCap);
      setWicketkeeperId(nextWk);
      if (swapSourceId === playerId) setSwapSourceId(null);
      void persistLineup(nextOrder, nextCap, viceCaptainId, nextWk);
    } else if (swapSourceId && battingOrder.includes(swapSourceId)) {
      const nextOrder = battingOrder.map((id) => (id === swapSourceId ? playerId : id));
      const nextCap = captainId === swapSourceId ? playerId : captainId;
      const incoming = squadMap.get(playerId);
      const nextWk =
        wicketkeeperId === swapSourceId
          ? incoming?.primaryRole === 'Wicketkeeper'
            ? playerId
            : null
          : wicketkeeperId;
      setBattingOrder(nextOrder);
      setCaptainId(nextCap);
      setWicketkeeperId(nextWk);
      setSwapSourceId(null);
      void persistLineup(nextOrder, nextCap, viceCaptainId, nextWk);
    } else if (battingOrder.length < 11) {
      const nextOrder = [...battingOrder, playerId];
      const nextCap = captainId ?? playerId;
      const incoming = squadMap.get(playerId);
      const nextWk =
        wicketkeeperId ?? (incoming?.primaryRole === 'Wicketkeeper' ? playerId : null);
      setBattingOrder(nextOrder);
      setCaptainId(nextCap);
      setWicketkeeperId(nextWk);
      void persistLineup(nextOrder, nextCap, viceCaptainId, nextWk);
    } else {
      onToast({
        type: 'info',
        title: 'Playing XI Full (11/11)',
        detail: 'Drag any reserve onto an XI row or click Swap first.',
      });
    }
  };

  const handleAssignCaptain = (playerId: number) => {
    if (!isMyTeam) return;
    setCaptainId(playerId);
    const playerName = squadMap.get(playerId)?.name || 'Player';
    void persistLineup(
      battingOrder,
      playerId,
      viceCaptainId,
      wicketkeeperId,
      `${playerName} named Captain (C)`
    );
  };

  const handleAssignWk = (player: SquadPlayer) => {
    if (!isMyTeam) return;
    if (player.primaryRole !== 'Wicketkeeper') {
      onToast({
        type: 'error',
        title: 'Natural Wicketkeeper Required',
        detail: `${player.name} is a ${player.primaryRole}. Only natural Wicketkeepers can be assigned WK.`,
      });
      return;
    }
    setWicketkeeperId(player.id);
    void persistLineup(
      battingOrder,
      captainId,
      viceCaptainId,
      player.id,
      `${player.name} assigned Wicketkeeper (WK)`
    );
  };

  const handleDropOnXI = (targetPlayerId: number) => {
    if (!isMyTeam || !dragPlayerId || dragPlayerId === targetPlayerId) {
      setDragPlayerId(null);
      setDragOverId(null);
      return;
    }

    const fromIdx = battingOrder.indexOf(dragPlayerId);
    const toIdx = battingOrder.indexOf(targetPlayerId);

    if (fromIdx !== -1 && toIdx !== -1) {
      // Reorder inside XI
      const nextOrder = [...battingOrder];
      const [moved] = nextOrder.splice(fromIdx, 1);
      nextOrder.splice(toIdx, 0, moved);
      setBattingOrder(nextOrder);
      setDragPlayerId(null);
      setDragOverId(null);
      void persistLineup(nextOrder, captainId, viceCaptainId, wicketkeeperId);
      return;
    }

    if (fromIdx === -1 && toIdx !== -1) {
      // Dropped a reserve player onto an XI slot -> swap into that slot
      const nextOrder = battingOrder.map((id) => (id === targetPlayerId ? dragPlayerId : id));
      const incoming = squadMap.get(dragPlayerId);
      const nextCap = captainId === targetPlayerId ? dragPlayerId : captainId;
      const nextWk =
        wicketkeeperId === targetPlayerId
          ? incoming?.primaryRole === 'Wicketkeeper'
            ? dragPlayerId
            : null
          : wicketkeeperId;
      setBattingOrder(nextOrder);
      setCaptainId(nextCap);
      setWicketkeeperId(nextWk);
      setDragPlayerId(null);
      setDragOverId(null);
      void persistLineup(nextOrder, nextCap, viceCaptainId, nextWk);
      return;
    }

    setDragPlayerId(null);
    setDragOverId(null);
  };

  const handleAutoPickXI = () => {
    if (!isMyTeam || squad.length === 0) return;
    const sorted = [...squad].sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a));
    const wk = sorted.find((p) => p.primaryRole === 'Wicketkeeper');
    const bowlers = sorted.filter((p) => p.primaryRole === 'Bowler').slice(0, 4);
    const chosen: SquadPlayer[] = [];
    if (wk) chosen.push(wk);
    for (const b of bowlers) {
      if (!chosen.some((c) => c.id === b.id)) chosen.push(b);
    }
    for (const p of sorted) {
      if (chosen.length >= 11) break;
      if (!chosen.some((c) => c.id === p.id)) chosen.push(p);
    }
    const roleRank: Record<string, number> = {
      Batsman: 1,
      Wicketkeeper: 2,
      'All-Rounder': 3,
      Bowler: 4,
    };
    chosen.sort((a, b) => (roleRank[a.primaryRole] ?? 5) - (roleRank[b.primaryRole] ?? 5));
    const ids = chosen.map((p) => p.id);
    const nextCap = ids[0] ?? null;
    const nextVc = ids[1] ?? null;
    const nextWk = wk?.id ?? null;
    setBattingOrder(ids);
    setCaptainId(nextCap);
    setViceCaptainId(nextVc);
    setWicketkeeperId(nextWk);
    setLineupFocusId(ids[0] ?? null);
    setSwapSourceId(null);
    void persistLineup(ids, nextCap, nextVc, nextWk, 'Auto-Picked & Saved Balanced XI');
  };

  const moveOrder = (idx: number, dir: -1 | 1) => {
    if (!isMyTeam) return;
    const target = idx + dir;
    if (target < 0 || target >= battingOrder.length) return;
    const copy = [...battingOrder];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setBattingOrder(copy);
    void persistLineup(copy, captainId, viceCaptainId, wicketkeeperId);
  };

  const renderCircularGauge = (value: number, label: string, strokeColor: string) => {
    const r = 20;
    const c = 2 * Math.PI * r;
    const offset = c - (value / 100) * c;
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
            <circle
              cx="24"
              cy="24"
              r={r}
              fill="none"
              stroke={strokeColor}
              strokeWidth="4"
              strokeDasharray={c}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-xs font-mono font-bold text-white tabular-nums">{value}</span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{label}</span>
      </div>
    );
  };

  const renderStars = (n: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i <= n ? 'text-[#EAB308] fill-[#EAB308]' : 'text-slate-700'}`}
        />
      ))}
    </div>
  );

  const selectedStatusPlayer = squad.find((p) => p.id === statusPlayerId) || squad[0] || null;
  const focusedLineupPlayer =
    squad.find((p) => p.id === lineupFocusId) || playingXI[0] || squad[0] || null;
  const devPlayer = squad.find((p) => p.id === devPlayerId) || squad[0] || null;

  const [hubFocusIdx, setHubFocusIdx] = useState(1);

  useEffect(() => {
    if (profileModalPlayer) return;
    const hubSubTabs: SquadSubTab[] = ['staff', 'status', 'development', 'lineups', 'development'];
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (subTab !== 'hub' && e.key === 'Escape') {
        e.preventDefault();
        setSubTab('hub');
        return;
      }

      if (subTab === 'hub') {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setHubFocusIdx((i) => (i + 1) % hubSubTabs.length);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setHubFocusIdx((i) => (i - 1 + hubSubTabs.length) % hubSubTabs.length);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          setSubTab(hubSubTabs[hubFocusIdx]);
        }
        return;
      }

      if (subTab === 'status' && squad.length > 0) {
        const curIdx = Math.max(0, squad.findIndex((p) => p.id === (selectedStatusPlayer?.id ?? null)));
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setStatusPlayerId(squad[(curIdx + 1) % squad.length].id);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setStatusPlayerId(squad[(curIdx - 1 + squad.length) % squad.length].id);
        } else if (e.key === 'Enter' && selectedStatusPlayer) {
          e.preventDefault();
          setProfileModalPlayer(selectedStatusPlayer);
        }
        return;
      }

      if (subTab === 'lineups' && playingXI.length > 0) {
        const curIdx = Math.max(0, playingXI.findIndex((p) => p.id === (focusedLineupPlayer?.id ?? null)));
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setLineupFocusId(playingXI[(curIdx + 1) % playingXI.length].id);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setLineupFocusId(playingXI[(curIdx - 1 + playingXI.length) % playingXI.length].id);
        }
        return;
      }

      if (subTab === 'development') {
        const curIdx = Math.max(0, GROWTH_TRAJECTORIES.findIndex((t) => t.id === devTrajectory));
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setDevTrajectory(GROWTH_TRAJECTORIES[(curIdx + 1) % GROWTH_TRAJECTORIES.length].id);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setDevTrajectory(
            GROWTH_TRAJECTORIES[(curIdx - 1 + GROWTH_TRAJECTORIES.length) % GROWTH_TRAJECTORIES.length].id
          );
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    profileModalPlayer,
    subTab,
    hubFocusIdx,
    squad,
    selectedStatusPlayer,
    playingXI,
    focusedLineupPlayer,
    devTrajectory,
  ]);

  return (
    <div className="space-y-5">
      {/* Top Club Selector + Sub-Nav Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-3">
          {teamInfo && (
            <TeamCrest
              templateKey={teamInfo.templateKey}
              shortCode={teamInfo.shortCode}
              primaryColor={teamInfo.primaryColor}
              secondaryColor={teamInfo.secondaryColor}
              size="md"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(Number(e.target.value))}
                className="bg-[#0C0F14] border border-white/15 rounded px-3 py-1.5 text-sm font-bold text-white cursor-pointer focus:outline-none focus:border-[#93E6EE]"
              >
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.leagueCategory}) {t.ownerUid === user?.uid ? '★' : ''}
                  </option>
                ))}
              </select>
            </div>
            {teamInfo && (
              <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                Purse:{' '}
                <strong className="font-mono text-[#4ADE80]">
                  {formatCurrencyLakhs(teamInfo.remainingBudget, currency)}
                </strong>{' '}
                · Contracted: {squad.length}/{state.league.maxSquadSize}
              </p>
            )}
          </div>
        </div>

        {/* Sub-Tabs matching CM27 underlined selector */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {(
            [
              { id: 'hub', label: 'Squad Hub' },
              { id: 'staff', label: 'Coaching Staff' },
              { id: 'status', label: 'Status' },
              { id: 'lineups', label: 'Lineups' },
              { id: 'development', label: 'Development & Tactics' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors border-b-2 ${
                subTab === t.id
                  ? 'border-[#93E6EE] text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================= SUB-TAB 1: SQUAD HUB (Reference Image 2) ================= */}
      {subTab === 'hub' && (
        <div className="cm27-view-enter grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {/* Card 1: COACHING STAFF */}
          <div
            onMouseEnter={() => setHubFocusIdx(0)}
            onClick={() => setSubTab('staff')}
            className={`cm27-panel p-5 flex flex-col justify-between min-h-[420px] cursor-pointer transition-all ${
              hubFocusIdx === 0 ? 'cm27-card-focus' : 'hover:border-white/25'
            }`}
          >
            <div>
              <h2 className="font-condensed text-2xl font-extrabold text-white uppercase text-center tracking-wide mb-4">
                COACHING STAFF
              </h2>
              <div className="space-y-2">
                {[
                  { title: 'Head Coach', slot: headCoachSlot, count: headCoachSlot ? '4/4' : '0/4' },
                  { title: 'Batting', slot: batCoachSlot, count: batCoachSlot ? '4/11' : '0/11' },
                  { title: 'Bowling', slot: bowlCoachSlot, count: bowlCoachSlot ? '4/11' : '0/11' },
                  { title: 'Fielding', slot: fieldCoachSlot, count: fieldCoachSlot ? '3/7' : '0/7' },
                  { title: 'Wicketkeeping', slot: wkCoachSlot, count: wkCoachSlot ? '2/7' : '0/7' },
                ].map((row) => (
                  <div
                    key={row.title}
                    className="cm27-panel-inset p-3 flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">{row.title}</div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {row.slot ? row.slot.name : 'Coach Vacant'}
                      </div>
                    </div>
                    <span className="font-condensed text-lg font-bold text-slate-300 tabular-nums">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-4 text-center text-xs font-mono text-[#93E6EE]">
              Tap to Appoint / Manage Staff →
            </div>
          </div>

          {/* Card 2: MANAGE SQUAD */}
          <div
            onMouseEnter={() => setHubFocusIdx(1)}
            onClick={() => setSubTab('status')}
            className={`cm27-panel p-5 flex flex-col justify-between min-h-[420px] cursor-pointer transition-all ${
              hubFocusIdx === 1 ? 'cm27-card-focus' : 'hover:border-white/25'
            }`}
          >
            <div className="text-center">
              <h2 className="font-condensed text-2xl font-extrabold text-white uppercase tracking-wide">
                MANAGE SQUAD
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{squad.length} registered players</p>
            </div>

            <div className="flex justify-center my-6">
              <Users className="w-12 h-12 text-slate-300/80" />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  { label: 'Batters', val: battersCount },
                  { label: 'All-Rnd', val: arCount },
                  { label: 'Bowlers', val: bowlersCount },
                  { label: 'Keepers', val: wkCount },
                ].map((box) => (
                  <div
                    key={box.label}
                    className="cm27-panel-inset py-2 px-1"
                  >
                    <div className="font-condensed text-xl font-bold text-white tabular-nums">{box.val}</div>
                    <div className="text-[9px] text-slate-400 truncate">{box.label}</div>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-center text-slate-400 leading-snug">
                Review contracted roles, match fitness, and form trajectories.
              </p>

              <div className="flex items-center justify-around pt-1">
                {renderCircularGauge(avgFitness, 'FITNESS', '#94A3B8')}
                {renderCircularGauge(avgSharpness, 'SHARPNESS', '#93E6EE')}
                {renderCircularGauge(avgMorale, 'MORALE', '#EAB308')}
              </div>
            </div>
          </div>

          {/* Card 3: DEVELOPMENT PLAN */}
          <div
            onMouseEnter={() => setHubFocusIdx(2)}
            onClick={() => setSubTab('development')}
            className={`cm27-panel p-5 flex flex-col justify-between min-h-[420px] cursor-pointer transition-all ${
              hubFocusIdx === 2 ? 'cm27-card-focus' : 'hover:border-white/25'
            }`}
          >
            <div className="text-center space-y-2">
              <h2 className="font-condensed text-2xl font-extrabold text-white uppercase tracking-wide">
                DEVELOPMENT PLAN
              </h2>
              <p className="text-xs text-[#93E6EE] font-medium">Set trajectories for the first team</p>
              <p className="text-xs text-slate-400 leading-relaxed pt-2">
                Assign Balanced, Dynamic, or archetype plans (Aggressor, Finisher, Death Overs). Staff hold veteran form.
              </p>
            </div>

            <div className="cm27-panel-inset p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Active Plans</span>
                <span className="font-mono text-white font-bold tabular-nums">
                  {Object.keys(teamInfo?.developmentPlansJson || {}).length} players
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Top Prospect</span>
                <span className="text-[#EAB308] font-semibold">
                  {squad[0]?.name || 'Draft in Auction'}
                </span>
              </div>
            </div>

            <div className="text-center text-xs font-mono text-[#93E6EE]">
              Open Trajectories →
            </div>
          </div>

          {/* Card 4: LINEUPS (Neutral Charcoal Oval Pitch SVG matching Image 2) */}
          <div
            onMouseEnter={() => setHubFocusIdx(3)}
            onClick={() => setSubTab('lineups')}
            className={`cm27-panel p-5 flex flex-col justify-between min-h-[420px] cursor-pointer transition-all ${
              hubFocusIdx === 3 ? 'cm27-card-focus' : 'hover:border-white/25'
            }`}
          >
            <div className="text-center">
              <h2 className="font-condensed text-2xl font-extrabold text-white uppercase tracking-wide">
                LINEUPS
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Created Lineups: {Math.max(1, lineupsList.length)}
              </p>
            </div>

            <div className="flex justify-center my-6">
              <svg className="w-28 h-36" viewBox="0 0 110 140">
                <rect
                  x="15"
                  y="10"
                  width="80"
                  height="120"
                  rx="40"
                  fill="#151922"
                  stroke="#94A3B8"
                  strokeOpacity="0.45"
                  strokeWidth="2"
                />
                <ellipse
                  cx="55"
                  cy="70"
                  rx="30"
                  ry="48"
                  fill="none"
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <rect
                  x="49"
                  y="44"
                  width="12"
                  height="52"
                  rx="2"
                  fill="#1E2430"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1"
                />
              </svg>
            </div>

            <p className="text-xs text-center text-slate-400">
              Pick your playing XI ({playingXI.length}/11) and match roles from the full squad.
            </p>
          </div>

          {/* Card 5: TACTICS (matching Image 2 with 3D Set Tactics CTA) */}
          <div
            onMouseEnter={() => setHubFocusIdx(4)}
            onClick={() => setSubTab('development')}
            className={`cm27-panel p-5 flex flex-col justify-between min-h-[420px] cursor-pointer transition-all ${
              hubFocusIdx === 4 ? 'cm27-card-focus' : 'hover:border-white/25'
            }`}
          >
            <div className="text-center space-y-2">
              <h2 className="font-condensed text-2xl font-extrabold text-white uppercase tracking-wide">
                TACTICS
              </h2>
              <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                {allowedFormats.map((fmt) => (
                  <span
                    key={fmt}
                    className="cm27-panel-inset px-2.5 py-1 text-[10px] font-mono text-white"
                  >
                    {getFormatDisplayLabel(fmt)} · {t20Tempo.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>

            <div className="text-center my-auto py-4">
              <div className="text-xs text-slate-400">Aim RPO</div>
              <div className="font-condensed text-5xl font-extrabold text-[#EAB308] tabular-nums">
                {aimRpo}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Powerplay: High Aggression</div>
            </div>

            <div className="flex justify-center">
              <span className="cm27-btn-3d px-4 py-1.5 rounded-full font-bold text-xs inline-flex items-center gap-1.5">
                Set Tactics
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUB-TAB 2: COACHING STAFF ================= */}
      {subTab === 'staff' && (
        <div className="cm27-view-enter space-y-4">
          <div className="cm27-panel overflow-hidden">
            {/* Grey-Slate Capacity Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#1A212B] via-[#131820] to-[#0E1218] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="font-condensed text-xl font-extrabold text-white uppercase tracking-wide">
                  STAFF CAPACITY: 10{' '}
                  <span className="text-xs font-mono text-[#93E6EE] ml-2">
                    Open Positions: {Math.max(0, 10 - hiredStaff.length)}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Signing fees come from club purse. World-class legacy coaches accelerate squad sharpness &amp; development.
                </p>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono uppercase text-slate-400">Available Cash</div>
                <div className="font-condensed text-2xl font-extrabold text-white tabular-nums">
                  {teamInfo ? formatCurrencyLakhs(teamInfo.remainingBudget, currency) : '—'}
                </div>
              </div>
            </div>

            {/* Hired Coaches Strip */}
            {hiredStaff.length > 0 && (
              <div className="px-6 py-3 bg-[#0C0F14] border-b border-white/[0.07] flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#93E6EE] mr-2">
                  Contracted Staff ({hiredStaff.length}/10):
                </span>
                {hiredStaff.map((s) => (
                  <div
                    key={s.id}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#181E27] border border-white/15 text-xs text-white"
                  >
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-[10px] text-slate-400">({s.role})</span>
                    {isMyTeam && (
                      <button
                        onClick={() => handleReleaseCoach(s.id)}
                        disabled={staffBusyId === s.id}
                        className="text-slate-400 hover:text-rose-400 cursor-pointer"
                        title="Release Coach"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Table Column Header */}
            <div className="px-6 py-2.5 bg-[#0C0F14] border-b border-white/[0.06] grid grid-cols-12 text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <div className="col-span-4">COACH</div>
              <div className="col-span-2">KNOWLEDGE</div>
              <div className="col-span-1">BAT</div>
              <div className="col-span-1">BOWL</div>
              <div className="col-span-1">FIELD</div>
              <div className="col-span-1">WK</div>
              <div className="col-span-2 text-right">FEE / WAGE</div>
            </div>

            <div className="divide-y divide-white/[0.06] max-h-[540px] overflow-y-auto">
              {coachCatalog.map((coach) => {
                const isHired = hiredStaff.some((s) => s.id === coach.id);
                return (
                  <div
                    key={coach.id}
                    className={`px-6 py-3 grid grid-cols-12 items-center gap-2 transition-colors ${
                      isHired ? 'bg-[#1B222D]' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="col-span-4 min-w-0">
                      <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                        <CountryFlag country={coach.country} size="xs" />
                        <span>{coach.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {coach.role} · {coach.legacyNote}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`text-xs font-semibold ${
                          coach.knowledge === 'Expert'
                            ? 'text-[#EAB308]'
                            : coach.knowledge === 'Accomplished'
                              ? 'text-[#93E6EE]'
                              : 'text-slate-300'
                        }`}
                      >
                        {coach.knowledge}
                      </span>
                    </div>
                    <div className="col-span-1">{renderStars(coach.batStars)}</div>
                    <div className="col-span-1">{renderStars(coach.bowlStars)}</div>
                    <div className="col-span-1">{renderStars(coach.fieldStars)}</div>
                    <div className="col-span-1">{renderStars(coach.wkStars)}</div>
                    <div className="col-span-2 flex items-center justify-end gap-3">
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-[#4ADE80] tabular-nums">
                          {formatCurrencyLakhs(coach.signingFeeLakhs, currency)}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                          {formatCurrencyLakhs(coach.weeklyWageLakhs, currency)}/wk
                        </div>
                      </div>
                      {isHired ? (
                        <span className="text-[11px] font-mono text-[#4ADE80] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        isMyTeam && (
                          <button
                            onClick={() => handleHireCoach(coach.id)}
                            disabled={staffBusyId === coach.id}
                            className="cm27-btn-3d px-2.5 py-1 rounded font-bold text-[11px] cursor-pointer"
                          >
                            {staffBusyId === coach.id ? '...' : 'Hire'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= SUB-TAB 3: SQUAD STATUS SPLIT ================= */}
      {subTab === 'status' && (
        <div className="cm27-view-enter space-y-3">
          <div className="flex justify-end">
            <div className="cm27-panel-inset px-3 py-1 text-[11px] font-mono text-slate-300 tabular-nums">
              BAT {battersCount} · AR {arCount} · BOWL {bowlersCount} · WK {wkCount} · TOTAL{' '}
              <strong className="text-white">{squad.length}</strong>
            </div>
          </div>

          {squad.length === 0 ? (
            <div className="cm27-panel p-12 text-center space-y-2">
              <Shield className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-sm font-semibold text-white">No Contracted Players Yet</div>
              <p className="text-xs text-slate-400">
                Win players in the Live Auction Room to populate your club roster.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Scrollable Roster Table */}
              <div className="lg:col-span-7 cm27-panel overflow-hidden">
                <div className="px-4 py-2.5 bg-[#0C0F14] border-b border-white/[0.06] grid grid-cols-12 text-[10px] font-mono uppercase text-slate-400">
                  <div className="col-span-1">NO.</div>
                  <div className="col-span-5">PLAYER</div>
                  <div className="col-span-2">ROLE</div>
                  <div className="col-span-2">FORM</div>
                  <div className="col-span-1">MOR</div>
                  <div className="col-span-1 text-right">OVR</div>
                </div>
                <div className="divide-y divide-white/[0.05] max-h-[540px] overflow-y-auto p-1.5 space-y-0.5">
                  {squad.map((p, idx) => {
                    const { ovr, delta } = formatOvrWithDelta(p);
                    const selected = selectedStatusPlayer?.id === p.id;
                    const squadRole =
                      ovr >= 80 ? 'Key Player' : ovr >= 71 ? 'Important' : 'Rotation';
                    return (
                      <button
                        key={p.id}
                        onClick={() => setStatusPlayerId(p.id)}
                        className={`w-full px-3 py-2.5 rounded grid grid-cols-12 items-center text-left cursor-pointer transition-all ${
                          selected
                            ? 'cm27-card-focus'
                            : 'hover:bg-white/[0.03] border border-transparent'
                        }`}
                      >
                        <div className="col-span-1 text-xs font-mono text-slate-400 tabular-nums">{idx + 1}</div>
                        <div className="col-span-5 min-w-0 pr-2">
                          <div className="text-xs sm:text-sm font-semibold text-white truncate flex items-center gap-1.5">
                            <CountryFlag country={p.country} size="xs" />
                            <span>{p.name}</span>
                          </div>
                        </div>
                        <div className="col-span-2 text-xs text-slate-300">{squadRole}</div>
                        <div className="col-span-2 text-xs text-slate-300">
                          {p.currentForm >= 78 ? 'Peak' : p.currentForm >= 64 ? 'Good' : 'Steady'}
                        </div>
                        <div className="col-span-1 text-xs font-mono text-[#EAB308] tabular-nums">{p.morale}</div>
                        <div className="col-span-1 text-right text-xs font-mono font-bold tabular-nums">
                          <span className="text-white">{ovr}</span>
                          {delta !== 0 && (
                            <span className={delta > 0 ? 'text-[#4ADE80] ml-0.5' : 'text-rose-400 ml-0.5'}>
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Player Status & Match Impact Detail Card */}
              {selectedStatusPlayer && (() => {
                const { ovr, delta } = formatOvrWithDelta(selectedStatusPlayer);
                return (
                <div className="lg:col-span-5 cm27-panel p-6 space-y-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-baseline gap-3">
                        <span className="font-condensed text-5xl font-extrabold text-[#EAB308] tabular-nums leading-none">
                          {ovr}
                          {delta !== 0 && (
                            <sup
                              className={`text-lg font-mono ml-0.5 ${
                                delta > 0 ? 'text-[#4ADE80]' : 'text-rose-400'
                              }`}
                            >
                              {delta > 0 ? `+${delta}` : delta}
                            </sup>
                          )}
                        </span>
                        <div>
                          <h2 className="font-condensed text-3xl font-extrabold text-white uppercase leading-none">
                            {selectedStatusPlayer.name}
                          </h2>
                          <div className="text-xs text-slate-400 mt-1">
                            {selectedStatusPlayer.primaryRole} · Age {selectedStatusPlayer.age} ·{' '}
                            {selectedStatusPlayer.battingHand}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-white/[0.07]">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                      PLAYER STATUS
                    </div>
                    {[
                      { label: 'Potential', value: String(selectedStatusPlayer.potential) },
                      {
                        label: 'Squad Role',
                        value:
                          ovr >= 80
                            ? 'Key Player'
                            : ovr >= 71
                              ? 'Important'
                              : 'Rotation',
                      },
                      {
                        label: 'Form',
                        value:
                          selectedStatusPlayer.currentForm >= 78
                            ? 'Peak'
                            : selectedStatusPlayer.currentForm >= 65
                              ? 'Good'
                              : 'Steady',
                      },
                      {
                        label: 'Availability',
                        value:
                          (selectedStatusPlayer.injuryGamesRemaining ?? 0) > 0
                            ? `Injured (${selectedStatusPlayer.injuryStatus} · ${selectedStatusPlayer.injuryGamesRemaining}G)`
                            : 'Fit to Play',
                      },
                      {
                        label: 'Match Stamina',
                        value: `${selectedStatusPlayer.stamina ?? 100}%`,
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between py-2 border-b border-white/[0.05] text-xs"
                      >
                        <span className="text-slate-400">{row.label}</span>
                        <span
                          className={`font-semibold ${
                            row.label === 'Availability' &&
                            (selectedStatusPlayer.injuryGamesRemaining ?? 0) > 0
                              ? 'text-rose-400'
                              : row.label === 'Match Stamina' &&
                                  (selectedStatusPlayer.stamina ?? 100) < 55
                                ? 'text-rose-400'
                                : 'text-white'
                          }`}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {selectedStatusPlayer.transferRequested && (
                    <div className="p-3 rounded bg-amber-500/10 border border-amber-400/30 text-xs text-amber-200">
                      <strong>Transfer Requested:</strong> Benched for{' '}
                      {selectedStatusPlayer.benchedStreak ?? 4}+ straight fixtures. Consider starting
                      him or exploring deals in the Transfers tab.
                    </div>
                  )}

                  {Array.isArray(selectedStatusPlayer.traitsJson) &&
                    selectedStatusPlayer.traitsJson.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                          BROADCAST TRAITS
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedStatusPlayer.traitsJson.map((trait) => (
                            <span
                              key={trait}
                              className="px-2 py-0.5 rounded bg-[#13262B] border border-[#2DD4BF]/35 text-[10px] font-mono uppercase text-[#93E6EE]"
                            >
                              {trait}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  <div className="space-y-2.5">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                      MATCH IMPACT
                    </div>
                    <div className="cm27-panel-inset p-3 flex items-center gap-3">
                      <Sparkles className="w-4 h-4 text-slate-300" />
                      <div>
                        <div className="text-sm font-bold text-white tabular-nums">
                          {selectedStatusPlayer.stamina ?? 100}%
                        </div>
                        <div className="text-[11px] text-slate-400">Match Stamina &amp; Conditioning</div>
                      </div>
                    </div>
                    <div className="cm27-panel-inset p-3 flex items-center gap-3">
                      <Flame className="w-4 h-4 text-[#93E6EE]" />
                      <div>
                        <div className="text-sm font-bold text-white tabular-nums">
                          {selectedStatusPlayer.currentForm}
                        </div>
                        <div className="text-[11px] text-slate-400">Match Sharpness</div>
                      </div>
                    </div>
                    <div className="cm27-panel-inset p-3 flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[#EAB308]" />
                      <div>
                        <div className="text-sm font-bold text-[#EAB308] tabular-nums">
                          {selectedStatusPlayer.transferRequested ? 'Unsettled' : 'Content'} ·{' '}
                          {selectedStatusPlayer.morale}
                        </div>
                        <div className="text-[11px] text-slate-400">Morale</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <button
                      onClick={() => setProfileModalPlayer(selectedStatusPlayer)}
                      className="cm27-btn-dark-3d flex-1 py-2 rounded text-xs font-semibold text-white cursor-pointer"
                    >
                      Open Full Career Card
                    </button>
                    {isMyTeam && (
                      <button
                        onClick={() => handleReleasePlayer(selectedStatusPlayer)}
                        className="px-3 py-2 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-semibold text-rose-300 cursor-pointer"
                      >
                        Release
                      </button>
                    )}
                  </div>
                </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ================= SUB-TAB 4: LINEUPS + CYAN PLAYER CARD ================= */}
      {subTab === 'lineups' && (
        <div className="cm27-view-enter grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Sheet & Actions Panel */}
          <div className="lg:col-span-2 space-y-2">
            {isMyTeam && (
              <button
                onClick={handleAutoPickXI}
                disabled={squad.length === 0}
                className="w-full p-3.5 cm27-panel hover:border-[#93E6EE]/60 text-center space-y-1 cursor-pointer transition-colors disabled:opacity-40"
              >
                <Plus className="w-4 h-4 text-[#93E6EE] mx-auto" />
                <div className="text-xs font-bold text-white">Auto-Pick Best XI</div>
                <div className="text-[10px] text-slate-400">Balanced squad order</div>
              </button>
            )}

            {allowedFormats.map((fmt) => {
              const saved = lineupsList.find((l) => l.format === fmt);
              const active = activeFormat === fmt;
              return (
                <button
                  key={fmt}
                  onClick={() => {
                    setActiveFormat(fmt);
                    setSwapSourceId(null);
                  }}
                  className={`w-full text-left p-3 rounded border cursor-pointer transition-all ${
                    active
                      ? 'cm27-card-focus text-white'
                      : 'cm27-panel text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold uppercase">
                    {allowedFormats.length === 1
                      ? 'Default Lineup'
                      : `${getFormatDisplayLabel(fmt)} Lineup`}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {saved
                      ? `${saved.battingOrderJson.length}/11 · Roles set`
                      : `${getFormatDisplayLabel(fmt)} · XI ready`}
                  </div>
                </button>
              );
            })}

            {isMyTeam && (
              <button
                onClick={handleSaveLineup}
                disabled={savingLineup || playingXI.length === 0}
                className="cm27-btn-3d w-full py-2.5 px-3 rounded disabled:opacity-40 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingLineup ? 'Saving...' : `Save ${getFormatDisplayLabel(activeFormat)} XI`}</span>
              </button>
            )}

            {onNavigate && (
              <button
                onClick={() => onNavigate('matchday')}
                className="cm27-btn-dark-3d w-full py-2.5 px-3 rounded text-slate-100 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Swords className="w-3.5 h-3.5 text-[#93E6EE]" />
                <span>Play Matchday →</span>
              </button>
            )}
          </div>

          {/* Center Playing XI Table */}
          <div className="lg:col-span-6 cm27-panel p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-condensed text-2xl font-extrabold text-white uppercase">
                    {allowedFormats.length === 1
                      ? 'DEFAULT LINEUP'
                      : `${getFormatDisplayLabel(activeFormat)} LINEUP`}
                  </h2>
                  <span className="text-[10px] font-mono text-[#93E6EE] uppercase">
                    · {getFormatDisplayLabel(activeFormat)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Overseas {playingXI.filter((p) => p.isOverseas).length}/{state.league.maxOverseas} · Selected{' '}
                  {playingXI.length}/11 ·{' '}
                  {swapSourceId
                    ? 'Tap any Reserve below to swap into XI'
                    : 'Drag rows, use arrows, or assign C / natural WK'}
                </p>
              </div>
              <div className="cm27-panel-inset px-3 py-1.5 font-mono text-sm font-bold text-white shrink-0 tabular-nums">
                {playingXI.length} <span className="text-slate-400">/ 11</span>
              </div>
            </div>

            {playingXI.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Sign players in the auction room (or head to Matchday for Exhibition fixtures) to build your Playing XI.
              </div>
            ) : (
              <div className="space-y-1">
                <div className="px-3 py-1.5 grid grid-cols-12 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  <div className="col-span-1">ROLE</div>
                  <div className="col-span-4">NAME</div>
                  <div className="col-span-1 text-center">BAT</div>
                  <div className="col-span-1 text-center">BOWL</div>
                  <div className="col-span-1 text-center">PREF</div>
                  <div className="col-span-1 text-right">OVR</div>
                  <div className="col-span-3 text-right">C · WK · MOVE</div>
                </div>
                {playingXI.map((p, idx) => {
                  const focused = focusedLineupPlayer?.id === p.id;
                  const isSwapSource = swapSourceId === p.id;
                  const isDragOver = dragOverId === p.id && dragPlayerId !== p.id;
                  const { ovr, delta, label: ovrLabel } = formatOvrWithDelta(p);
                  const isNaturalWk = p.primaryRole === 'Wicketkeeper';
                  const isWkAssigned = wicketkeeperId === p.id;
                  const roleAbbr =
                    p.primaryRole === 'Batsman'
                      ? 'BAT'
                      : p.primaryRole === 'Wicketkeeper'
                        ? 'WK'
                        : p.primaryRole === 'All-Rounder'
                          ? 'AR'
                          : 'BWL';
                  return (
                    <div
                      key={p.id}
                      draggable={isMyTeam}
                      onDragStart={() => setDragPlayerId(p.id)}
                      onDragOver={(e) => {
                        if (!isMyTeam) return;
                        e.preventDefault();
                        if (dragOverId !== p.id) setDragOverId(p.id);
                      }}
                      onDragLeave={() => {
                        if (dragOverId === p.id) setDragOverId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnXI(p.id);
                      }}
                      onDragEnd={() => {
                        setDragPlayerId(null);
                        setDragOverId(null);
                      }}
                      onClick={() => setLineupFocusId(p.id)}
                      className={`px-2.5 py-2 rounded grid grid-cols-12 items-center gap-1 cursor-pointer transition-all border ${
                        isDragOver
                          ? 'bg-[#1D2838] border-[#93E6EE] text-white'
                          : isSwapSource
                            ? 'bg-amber-500/15 border-[#EAB308] text-white'
                            : focused
                              ? 'cm27-card-focus text-white'
                              : 'bg-[#0C0F14] border-transparent hover:bg-white/[0.04] text-slate-200'
                      }`}
                    >
                      <div className="col-span-1 flex items-center gap-1">
                        {isMyTeam && (
                          <GripVertical className="w-3 h-3 shrink-0 cursor-grab text-slate-600" />
                        )}
                        <span
                          className={`w-3.5 text-[11px] font-mono tabular-nums ${
                            focused && !isSwapSource ? 'text-[#93E6EE] font-bold' : 'text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="w-5 h-5 rounded-full bg-[#151922] border border-white/15 text-slate-300 text-[8px] font-mono font-bold flex items-center justify-center shrink-0">
                          {roleAbbr}
                        </span>
                      </div>

                      <div className="col-span-4 flex items-center gap-1 min-w-0 pr-1">
                        <span className="text-xs font-bold truncate text-white">{p.name}</span>
                        {captainId === p.id && (
                          <span className="px-1 py-0.5 rounded bg-amber-500/20 text-[#EAB308] text-[9px] font-mono font-bold shrink-0">
                            C
                          </span>
                        )}
                        {isWkAssigned && (
                          <span className="px-1 py-0.5 rounded bg-cyan-500/20 text-[#93E6EE] text-[9px] font-mono font-bold shrink-0">
                            WK
                          </span>
                        )}
                      </div>

                      <div className="col-span-1 text-center text-[10px] font-mono text-slate-400">
                        {p.battingHand === 'Left-hand' ? 'LHB' : 'RHB'}
                      </div>
                      <div className="col-span-1 text-center text-[10px] font-mono text-slate-400">
                        {getBowlStyleShort(p.bowlingStyle)}
                      </div>
                      <div className="col-span-1 text-center text-[10px] font-mono text-slate-400">
                        {getPrefPositionLabel(p.primaryRole, p.battingRating)}
                      </div>
                      <div
                        className={`col-span-1 text-right text-[11px] font-mono font-bold tabular-nums ${
                          delta < 0 ? 'text-rose-400' : 'text-[#4ADE80]'
                        }`}
                        title={`Overall ${ovr}`}
                      >
                        {ovrLabel}
                      </div>

                      <div
                        className="col-span-3 flex items-center justify-end gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isMyTeam && (
                          <>
                            <button
                              onClick={() => handleAssignCaptain(p.id)}
                              className={`p-1 rounded cursor-pointer ${
                                captainId === p.id
                                  ? 'text-[#EAB308] bg-amber-500/15'
                                  : 'text-slate-400 hover:text-[#EAB308]'
                              }`}
                              title="Assign Captain (C)"
                            >
                              <Crown className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleAssignWk(p)}
                              disabled={!isNaturalWk}
                              className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold ${
                                !isNaturalWk
                                  ? 'opacity-25 cursor-not-allowed'
                                  : isWkAssigned
                                    ? 'bg-cyan-500/20 text-[#93E6EE] cursor-pointer'
                                    : 'text-slate-400 hover:text-[#93E6EE] cursor-pointer'
                              }`}
                              title={
                                isNaturalWk
                                  ? 'Assign Wicketkeeper (WK)'
                                  : 'Only natural Wicketkeepers can be assigned WK'
                              }
                            >
                              WK
                            </button>
                            <button
                              onClick={() =>
                                setSwapSourceId((prev) => (prev === p.id ? null : p.id))
                              }
                              className={`p-1 cursor-pointer ${
                                isSwapSource ? 'text-[#EAB308]' : 'text-slate-400 hover:text-[#93E6EE]'
                              }`}
                              title="Select to Swap with Reserve"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => moveOrder(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-[#93E6EE] cursor-pointer disabled:opacity-25"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => moveOrder(idx, 1)}
                              disabled={idx === playingXI.length - 1}
                              className="p-1 text-slate-400 hover:text-[#93E6EE] cursor-pointer disabled:opacity-25"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => toggleInXI(p.id)}
                              className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                              title="Move to Dropped"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {reserves.length > 0 && (
              <div className="pt-3 border-t border-white/[0.07]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Dropped / Reserves ({reserves.length}) — {swapSourceId ? 'Click to Swap into XI' : 'Drag onto XI slot or click to Swap / Add'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                  {reserves.map((p) => {
                    const { label: resOvrLabel, delta: resDelta } = formatOvrWithDelta(p);
                    return (
                    <button
                      key={p.id}
                      draggable={isMyTeam}
                      onDragStart={() => setDragPlayerId(p.id)}
                      onDragEnd={() => {
                        setDragPlayerId(null);
                        setDragOverId(null);
                      }}
                      onClick={() => toggleInXI(p.id)}
                      className={`px-3 py-1.5 rounded bg-[#0C0F14] border flex items-center justify-between text-xs text-slate-300 cursor-pointer transition-colors ${
                        swapSourceId
                          ? 'border-[#EAB308]/60 hover:bg-amber-500/10 text-amber-200'
                          : 'border-white/10 hover:border-[#93E6EE]/55'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        {isMyTeam && <GripVertical className="w-3 h-3 text-slate-600 shrink-0" />}
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] text-slate-500">({p.primaryRole})</span>
                      </span>
                      <span
                        className={`flex items-center gap-1.5 font-mono shrink-0 tabular-nums ${
                          resDelta < 0 ? 'text-rose-400' : 'text-[#4ADE80]'
                        }`}
                      >
                        {resOvrLabel}
                        {isMyTeam && <Plus className="w-3 h-3" />}
                      </span>
                    </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Cyan-Teal Attribute Card */}
          {focusedLineupPlayer && (
            <div className="lg:col-span-4">
              <CyanPlayerCard
                player={focusedLineupPlayer}
                slotNumber={
                  battingOrder.indexOf(focusedLineupPlayer.id) >= 0
                    ? battingOrder.indexOf(focusedLineupPlayer.id) + 1
                    : undefined
                }
                isCaptain={captainId === focusedLineupPlayer.id}
                isWicketkeeper={wicketkeeperId === focusedLineupPlayer.id}
              />
            </div>
          )}
        </div>
      )}

      {/* ================= SUB-TAB 5: DEVELOPMENT PLAN & TACTICS (Video 00:06-00:13) ================= */}
      {subTab === 'development' && (() => {
        const planMetrics = computeDevelopmentPlanAttributes(devPlayer, devTrajectory, devIntensity);
        const roleShort = (r?: string) =>
          r === 'All-Rounder' ? 'AR' : r === 'Bowler' ? 'BWL' : r === 'Wicketkeeper' ? 'WK' : 'BAT';

        return (
        <div className="cm27-view-enter space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Vertical Player Selector Rail (matching video 00:06-00:13) */}
            <div className="lg:col-span-4 xl:col-span-3 cm27-panel p-2 space-y-1 max-h-[600px] overflow-y-auto">
              <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400 border-b border-white/[0.06] mb-1">
                SQUAD PLAYERS ({squad.length})
              </div>
              {squad.length === 0 ? (
                <div className="p-4 text-xs text-slate-500 text-center">No contracted players yet.</div>
              ) : (
                squad.map((p) => {
                  const selected = devPlayer?.id === p.id;
                  const savedPlan =
                    teamInfo?.developmentPlansJson?.[String(p.id)]?.trajectory ||
                    (p.primaryRole === 'Bowler' ? 'BOWL | New-ball' : 'Balanced');
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setDevPlayerId(p.id);
                        setDevTrajectory(savedPlan);
                      }}
                      className={`cm27-hover-sweep w-full px-3 py-2.5 rounded-md border text-left flex items-center gap-3 cursor-pointer transition-all ${
                        selected
                          ? 'cm27-card-focus text-white'
                          : 'bg-transparent border-transparent hover:bg-white/[0.04] text-slate-300'
                      }`}
                    >
                      <span className="w-7 h-7 rounded-full border border-white/20 bg-[#0B0E14] text-[9px] font-mono font-bold text-slate-200 flex items-center justify-center shrink-0">
                        {roleShort(p.primaryRole)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-condensed text-base font-bold uppercase tracking-wide text-white truncate leading-tight">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {savedPlan.includes('|') ? savedPlan.split('|')[1].trim() : savedPlan}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#4ADE80] tabular-nums shrink-0">
                        {getPlayerOverall(p)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Main Right Panel: Large CM27 Development View + Club Tactical Doctrine */}
            <div className="lg:col-span-8 xl:col-span-9 space-y-5">
              <div
                key={`${devPlayer?.id ?? 0}-${devTrajectory}`}
                className="cm27-slide-right cm27-panel p-6 space-y-6"
              >
                {/* Plan Title + Action */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-condensed text-4xl sm:text-5xl font-extrabold text-white uppercase tracking-tight leading-none">
                      {planMetrics.planTitle}
                    </h2>
                    {devPlayer && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1.5">
                        <CountryFlag country={devPlayer.country} size="xs" />
                        <span className="font-semibold text-slate-200">{devPlayer.name}</span>
                        <span>· Age {devPlayer.age} · {devPlayer.primaryRole}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={devTrajectory}
                      onChange={(e) => setDevTrajectory(e.target.value)}
                      className="bg-[#0C0F14] border border-white/15 rounded px-3 py-2 text-xs font-semibold text-white cursor-pointer focus:outline-none focus:border-[#93E6EE]"
                    >
                      {GROWTH_TRAJECTORIES.map((tr) => (
                        <option key={tr.id} value={tr.id}>
                          {tr.id}
                        </option>
                      ))}
                    </select>
                    {isMyTeam && devPlayer && (
                      <button
                        onClick={handleSaveDevPlan}
                        disabled={savingDev}
                        className="cm27-btn-3d px-4 py-2 rounded font-bold text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
                      >
                        {savingDev ? 'Saving...' : 'Confirm Plan'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Strip matching video 00:06 */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 border-t border-b border-white/[0.07] py-3.5 items-center">
                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                      MATCH XP
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-semibold text-[#EAB308]">Building</span>
                      <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="cm27-bar-fill h-full bg-[#4ADE80]"
                          style={{ width: `${planMetrics.matchXpPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                      COACHING
                    </div>
                    <div className="text-xs font-semibold text-white mt-1 tabular-nums">
                      {planMetrics.coachingPct}% of plan
                    </div>
                  </div>

                  <div className="sm:col-span-1">
                    <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                      LEVEL UP IN {planMetrics.levelUpWeeks} WEEKS
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="cm27-bar-fill h-full bg-[#93E6EE]"
                        style={{ width: `${planMetrics.coachingPct}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                      ROLE GROWTH
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs font-semibold text-white">
                        {planMetrics.roleGrowthLabel}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-[#4ADE80] tabular-nums">
                        {planMetrics.coachingPct}%
                      </span>
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                      POTENTIAL
                    </div>
                    <div className="font-condensed text-2xl font-extrabold text-white tabular-nums leading-none mt-0.5">
                      {planMetrics.potentialMin}–{planMetrics.potentialMax}
                    </div>
                  </div>
                </div>

                {/* 3x2 Large Attribute Grid matching video 00:06-00:13 */}
                {devPlayer ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-6">
                    {planMetrics.attributes.map((attr, idx) => (
                      <div
                        key={attr.label}
                        className={`cm27-stagger-${Math.min(6, idx + 1)} space-y-1.5`}
                      >
                        <div className="flex items-baseline gap-1.5 tabular-nums">
                          <span className="font-condensed text-4xl font-extrabold text-white leading-none">
                            {attr.val}
                          </span>
                          {attr.delta > 0 && (
                            <span className="text-xs font-mono font-bold text-[#4ADE80]">
                              +{attr.delta}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-semibold">
                          {attr.label}
                        </div>
                        <div className="h-[2px] w-full bg-white/[0.08] rounded-full overflow-hidden">
                          <div
                            className="cm27-bar-fill h-full bg-white/55"
                            style={{ width: `${attr.barPct}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 tabular-nums">
                          <span>
                            {attr.shortName} {attr.val}
                          </span>
                          {attr.delta >= 2 ? (
                            <span className="text-[#4ADE80] font-bold tracking-tighter">▲▲</span>
                          ) : attr.delta === 1 ? (
                            <span className="text-[#4ADE80] font-bold">▲</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">No players contracted yet.</div>
                )}

                {/* Legend + Intensity + PLAN/ROLE/OVR Footer */}
                <div className="pt-4 border-t border-white/[0.07] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                      <span>
                        <strong className="text-[#4ADE80]">▲</strong> Medium growth
                      </span>
                      <span>
                        <strong className="text-[#EAB308]">▲▲</strong> Significant growth
                      </span>
                      <span className="text-slate-500">No mark = will not grow on this trajectory</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-400 mr-1">Intensity:</span>
                      {(['Light', 'Standard', 'Intensive'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => setDevIntensity(lvl)}
                          className={`px-3 py-1 rounded text-xs cursor-pointer transition-colors ${
                            devIntensity === lvl
                              ? 'cm27-btn-3d font-bold'
                              : 'cm27-btn-dark-3d text-slate-300'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {devPlayer && (
                    <div className="pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500">
                          PLAN
                        </div>
                        <div className="font-semibold text-white mt-0.5">
                          {planMetrics.planTitle}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500">
                          ROLE
                        </div>
                        <div className="font-semibold text-white mt-0.5">{devPlayer.primaryRole}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500">
                          OVR
                        </div>
                        <div className="font-condensed text-2xl font-extrabold text-[#4ADE80] tabular-nums leading-none mt-0.5">
                          {planMetrics.ovr}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Team Matchday Tactical Doctrine Card */}
              <div className="cm27-panel p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                  <h2 className="font-condensed text-2xl font-extrabold text-white uppercase">
                    CLUB TACTICAL DOCTRINE
                  </h2>
                  {isMyTeam && (
                    <button
                      onClick={handleSaveTactics}
                      disabled={savingTactics}
                      className="cm27-btn-3d px-4 py-1.5 rounded font-bold text-xs uppercase tracking-wider cursor-pointer"
                    >
                      {savingTactics ? 'Saving Doctrine...' : 'Lock Club Tactics'}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs items-center">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1.5">
                      T20 Batting Tempo
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Balanced', 'Aggressive', 'Ultra-Attacking', 'Anchor-Led'] as const).map(
                        (tempo) => (
                          <button
                            key={tempo}
                            onClick={() => setT20Tempo(tempo)}
                            className={`py-2 px-3 rounded border text-xs font-semibold cursor-pointer transition-all ${
                              t20Tempo === tempo
                                ? 'cm27-card-focus text-[#93E6EE]'
                                : 'cm27-panel-inset text-slate-400 hover:text-white'
                            }`}
                          >
                            {tempo}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="cm27-panel-inset p-4">
                    <label className="text-slate-300 flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase text-slate-400">Target Aim RPO</span>
                      <strong className="text-[#EAB308] font-mono text-base tabular-nums">{aimRpo}</strong>
                    </label>
                    <input
                      type="range"
                      min={5.5}
                      max={12.5}
                      step={0.1}
                      value={aimRpo}
                      onChange={(e) => setAimRpo(Number(e.target.value))}
                      className="w-full accent-[#EAB308]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {profileModalPlayer && (
        <PlayerProfileModal
          player={profileModalPlayer}
          onClose={() => setProfileModalPlayer(null)}
        />
      )}

      {loading && squad.length === 0 && (
        <div className="text-xs font-mono text-slate-500">Loading club dossier...</div>
      )}
    </div>
  );
}
