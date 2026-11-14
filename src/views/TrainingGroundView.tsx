import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, CheckCircle2, Dumbbell, Play, ShieldAlert, Sparkles, Timer, Zap } from 'lucide-react';
import type { LeagueStateSnapshot, SquadPlayer } from '../types/game';
import { apiFetch } from '../lib/api';
import { formatCurrencyLakhs, formatOvrWithDelta } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { CountryFlag } from '../components/CountryFlag';

type DrillId = 'relay_catching' | 'yorker_lab' | 'pull_reaction' | 'spin_control';

interface DrillMeta {
  id: DrillId;
  title: string;
  targetStat: string;
  durationSec: number;
  instruction: string;
  controlHint: string;
}

const DRILLS: DrillMeta[] = [
  {
    id: 'relay_catching',
    title: 'Boundary Relay Catching',
    targetStat: 'Fielding & Temperament',
    durationSec: 16,
    instruction: 'Move the fielder left/right with Mouse or A/D/Arrows to intercept high boundary balls before they touch the turf.',
    controlHint: 'Catch 6+ of 10 balls to pass',
  },
  {
    id: 'yorker_lab',
    title: 'Yorker Execution Lab',
    targetStat: 'Bowling & Consistency',
    durationSec: 18,
    instruction: 'Click or press Space when the oscillating pace marker aligns inside the crimson blockhole box at the base of the stumps.',
    controlHint: 'Land 3+ of 5 deliveries in the blockhole',
  },
  {
    id: 'pull_reaction',
    title: 'Short-Ball Pull Reaction',
    targetStat: 'Batting & Temperament',
    durationSec: 16,
    instruction: 'Watch the bowler release the rising bouncer and hit Space / Click when the ball enters the sweet-spot timing arc.',
    controlHint: 'Time 4+ of 6 deliveries cleanly',
  },
  {
    id: 'spin_control',
    title: 'Spin Variation & Drift Control',
    targetStat: 'Bowling & Consistency',
    durationSec: 18,
    instruction: 'Use Mouse or Arrow keys to steer the flight marker through drift crosswinds onto the rough patch outside off-stump.',
    controlHint: 'Hit the target patch 4+ of 6 times',
  },
];

export function TrainingGroundView({
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

  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [loadingSquad, setLoadingSquad] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [activeDrill, setActiveDrill] = useState<DrillId>('yorker_lab');

  // Mini-game execution state
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(18);
  const [liveScore, setLiveScore] = useState(0);
  const [liveAttempts, setLiveAttempts] = useState(0);
  const [lastResult, setLastResult] = useState<{
    drillTitle: string;
    playerName: string;
    success: boolean;
    score: number;
    statChanges: string[];
    unlockedTrait: string | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<any>({});

  useEffect(() => {
    if (!myTeam) {
      setSquad([]);
      return;
    }
    setLoadingSquad(true);
    apiFetch<{ squad: SquadPlayer[] }>(`/api/leagues/${state.league.id}/teams/${myTeam.id}/squad`)
      .then((res) => {
        setSquad(res.squad || []);
        if (res.squad?.length && !selectedPlayerId) {
          setSelectedPlayerId(res.squad[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSquad(false));
  }, [state.league.id, myTeam?.id, squadVersion]);

  const currentDay = state.currentGameDay || state.league.currentGameDay || 1;
  const slotsUsed =
    myTeam && myTeam.trainingSlotsUsedDay === currentDay ? myTeam.trainingSlotsUsedCount || 0 : 0;
  const slotsRemaining = Math.max(0, 2 - slotsUsed);

  const selectedPlayer = useMemo(
    () => squad.find((p) => p.id === selectedPlayerId) || null,
    [squad, selectedPlayerId]
  );

  const drillMeta = DRILLS.find((d) => d.id === activeDrill) || DRILLS[0];

  const finishDrill = async (score: number, attempts: number) => {
    setRunning(false);
    if (!selectedPlayer || !myTeam) return;
    const passThreshold =
      activeDrill === 'relay_catching' ? 6 : activeDrill === 'yorker_lab' ? 3 : 4;
    const success = score >= passThreshold;
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        statChanges: string[];
        unlockedTrait: string | null;
      }>(`/api/leagues/${state.league.id}/training/complete`, {
        method: 'POST',
        body: JSON.stringify({
          playerId: selectedPlayer.id,
          drillType: activeDrill,
          score,
          attempts,
          success,
        }),
      });
      setLastResult({
        drillTitle: drillMeta.title,
        playerName: selectedPlayer.name,
        success,
        score,
        statChanges: res.statChanges || [],
        unlockedTrait: res.unlockedTrait,
      });
      await onRefreshState();
      onToast({
        tone: success ? 'success' : 'info',
        title: success ? `${selectedPlayer.name} Drill Passed` : `${selectedPlayer.name} Drill Logged`,
        body: res.unlockedTrait
          ? `Trait Unlocked: ${res.unlockedTrait}!`
          : res.statChanges?.length
            ? res.statChanges.join(' · ')
            : 'Stamina -10% applied.',
      });
    } catch (err: any) {
      onToast({ tone: 'error', title: 'Training save failed', body: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const startDrill = () => {
    if (!myTeam || !selectedPlayer) return;
    if (slotsRemaining <= 0) {
      onToast({
        tone: 'warning',
        title: 'Daily Slots Used',
        body: `All 2 training sessions used for Game Day ${currentDay}.`,
      });
      return;
    }
    if (myTeam.remainingBudget < 20) {
      onToast({
        tone: 'warning',
        title: 'Insufficient Purse',
        body: 'Each high-performance drill requires ₹20L.',
      });
      return;
    }
    if ((selectedPlayer.injuryGamesRemaining ?? 0) > 0) {
      onToast({
        tone: 'warning',
        title: 'Player Injured',
        body: `${selectedPlayer.name} cannot train while recovering.`,
      });
      return;
    }
    if ((selectedPlayer.stamina ?? 100) < 15) {
      onToast({
        tone: 'warning',
        title: 'Stamina Too Low',
        body: `Rest ${selectedPlayer.name} for a fixture before training.`,
      });
      return;
    }

    setLastResult(null);
    setLiveScore(0);
    setLiveAttempts(0);
    setTimeLeft(drillMeta.durationSec);

    stateRef.current = {
      score: 0,
      attempts: 0,
      maxAttempts:
        activeDrill === 'relay_catching' ? 10 : activeDrill === 'yorker_lab' ? 5 : 6,
      startTime: performance.now(),
      durationMs: drillMeta.durationSec * 1000,
      // Shared player/cursor
      fielderX: 280,
      ballX: 120 + Math.random() * 320,
      ballY: 20,
      ballVy: 2.8,
      // Yorker bar
      markerY: 0.1,
      markerDir: 1,
      feedback: '',
      feedbackAge: 0,
      // Pull shot ball distance 0..1
      deliveryProg: 0,
      deliverySpeed: 0.015 + Math.random() * 0.008,
      // Spin control wind + patch
      aimX: 280,
      aimY: 130,
      patchX: 210 + Math.random() * 140,
      patchY: 95 + Math.random() * 70,
      windVx: (Math.random() - 0.5) * 1.4,
      windVy: (Math.random() - 0.5) * 0.8,
      keys: {} as Record<string, boolean>,
    };
    setRunning(true);
  };

  // Interactive HTML5 Canvas Loop
  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let finishedFlag = false;

    const triggerAction = () => {
      const s = stateRef.current;
      if (finishedFlag) return;

      if (activeDrill === 'yorker_lab') {
        s.attempts += 1;
        // Blockhole target is markerY between 0.72 and 0.87
        const hit = s.markerY >= 0.72 && s.markerY <= 0.87;
        if (hit) {
          s.score += 1;
          s.feedback = 'PINPOINT YORKER!';
        } else if (s.markerY < 0.72) {
          s.feedback = 'FULL TOSS — TOO HIGH';
        } else {
          s.feedback = 'OVER-PITCHED';
        }
        s.feedbackAge = 35;
        s.markerY = 0.08;
        setLiveScore(s.score);
        setLiveAttempts(s.attempts);
      } else if (activeDrill === 'pull_reaction') {
        s.attempts += 1;
        // Sweet spot deliveryProg between 0.70 and 0.88
        const hit = s.deliveryProg >= 0.70 && s.deliveryProg <= 0.88;
        if (hit) {
          s.score += 1;
          s.feedback = 'CLEAN PULL FOR SIX!';
        } else {
          s.feedback = s.deliveryProg < 0.7 ? 'SWUNG EARLY' : 'BEATEN FOR PACE';
        }
        s.feedbackAge = 35;
        s.deliveryProg = 0;
        s.deliverySpeed = 0.013 + Math.random() * 0.01;
        setLiveScore(s.score);
        setLiveAttempts(s.attempts);
      } else if (activeDrill === 'spin_control') {
        s.attempts += 1;
        const dist = Math.hypot(s.aimX - s.patchX, s.aimY - s.patchY);
        if (dist <= 28) {
          s.score += 1;
          s.feedback = 'SHARP DRIFT ON ROUGH!';
        } else {
          s.feedback = 'MISSED PATCH';
        }
        s.feedbackAge = 35;
        s.patchX = 160 + Math.random() * 240;
        s.patchY = 75 + Math.random() * 110;
        s.windVx = (Math.random() - 0.5) * 1.9;
        s.windVy = (Math.random() - 0.5) * 1.0;
        setLiveScore(s.score);
        setLiveAttempts(s.attempts);
      }

      if (s.attempts >= s.maxAttempts && !finishedFlag) {
        finishedFlag = true;
        cancelAnimationFrame(rafId);
        finishDrill(s.score, s.attempts);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key] = true;
      if (e.key === ' ' && activeDrill !== 'relay_catching') {
        e.preventDefault();
        triggerAction();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key] = false;
    };
    const onPointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      if (activeDrill === 'relay_catching') {
        stateRef.current.fielderX = Math.max(36, Math.min(canvas.width - 36, x));
      } else if (activeDrill === 'spin_control') {
        stateRef.current.aimX = Math.max(40, Math.min(canvas.width - 40, x));
        stateRef.current.aimY = Math.max(30, Math.min(canvas.height - 30, y));
      }
    };
    const onCanvasClick = () => {
      if (activeDrill !== 'relay_catching') triggerAction();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('click', onCanvasClick);

    const renderFrame = (now: number) => {
      const s = stateRef.current;
      const elapsed = now - s.startTime;
      const remSec = Math.max(0, Math.ceil((s.durationMs - elapsed) / 1000));
      setTimeLeft(remSec);

      if (elapsed >= s.durationMs && !finishedFlag) {
        finishedFlag = true;
        finishDrill(s.score, s.attempts);
        return;
      }

      // Draw crisp stadium pitch turf backdrop
      ctx.fillStyle = '#0B1017';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle turf stripes & pitch strip
      ctx.fillStyle = '#101920';
      ctx.fillRect(140, 20, 280, 220);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(140, 20, 280, 220);

      // Crease lines
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(155, 210);
      ctx.lineTo(405, 210);
      ctx.stroke();

      if (activeDrill === 'relay_catching') {
        if (s.keys['ArrowLeft'] || s.keys['a'] || s.keys['A']) s.fielderX -= 5.5;
        if (s.keys['ArrowRight'] || s.keys['d'] || s.keys['D']) s.fielderX += 5.5;
        s.fielderX = Math.max(36, Math.min(canvas.width - 36, s.fielderX));

        s.ballY += s.ballVy;
        // Boundary rope
        ctx.strokeStyle = '#EAB308';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, 232);
        ctx.lineTo(canvas.width - 20, 232);
        ctx.stroke();

        // Catch check
        if (s.ballY >= 204 && Math.abs(s.ballX - s.fielderX) <= 36) {
          s.score += 1;
          s.attempts += 1;
          s.feedback = 'CLEAN CATCH!';
          s.feedbackAge = 30;
          s.ballY = 18;
          s.ballX = 70 + Math.random() * (canvas.width - 140);
          s.ballVy = 2.9 + Math.random() * 1.4;
          setLiveScore(s.score);
          setLiveAttempts(s.attempts);
        } else if (s.ballY > 240) {
          s.attempts += 1;
          s.feedback = 'DROPPED / SIX';
          s.feedbackAge = 30;
          s.ballY = 18;
          s.ballX = 70 + Math.random() * (canvas.width - 140);
          s.ballVy = 2.9 + Math.random() * 1.4;
          setLiveAttempts(s.attempts);
        }

        if (s.attempts >= s.maxAttempts && !finishedFlag) {
          finishedFlag = true;
          finishDrill(s.score, s.attempts);
          return;
        }

        // Fielder pad
        ctx.fillStyle = '#93E6EE';
        ctx.fillRect(s.fielderX - 32, 210, 64, 12);
        // White cricket ball
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(s.ballX, s.ballY, 9, 0, Math.PI * 2);
        ctx.fill();
      } else if (activeDrill === 'yorker_lab') {
        s.markerY += s.markerDir * 0.022;
        if (s.markerY >= 0.96) {
          s.markerY = 0.96;
          s.markerDir = -1;
        } else if (s.markerY <= 0.06) {
          s.markerY = 0.06;
          s.markerDir = 1;
        }

        // Stumps at bottom
        ctx.fillStyle = '#EAB308';
        [268, 280, 292].forEach((sx) => ctx.fillRect(sx, 195, 3, 28));

        // Blockhole target zone
        const zoneTop = 20 + 0.72 * 200;
        const zoneH = (0.87 - 0.72) * 200;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.fillRect(215, zoneTop, 130, zoneH);
        ctx.strokeStyle = '#EF4444';
        ctx.strokeRect(215, zoneTop, 130, zoneH);
        ctx.fillStyle = '#FCA5A5';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('BLOCKHOLE ZONE', 236, zoneTop + 18);

        // Oscillating delivery marker
        const curY = 20 + s.markerY * 200;
        ctx.fillStyle = '#93E6EE';
        ctx.fillRect(200, curY - 3, 160, 6);
      } else if (activeDrill === 'pull_reaction') {
        s.deliveryProg += s.deliverySpeed;
        if (s.deliveryProg > 1.05) {
          s.attempts += 1;
          s.feedback = 'BALL THROUGH TO KEEPER';
          s.feedbackAge = 30;
          s.deliveryProg = 0;
          s.deliverySpeed = 0.013 + Math.random() * 0.01;
          setLiveAttempts(s.attempts);
          if (s.attempts >= s.maxAttempts && !finishedFlag) {
            finishedFlag = true;
            finishDrill(s.score, s.attempts);
            return;
          }
        }

        // Sweet spot timing zone
        ctx.fillStyle = 'rgba(74, 222, 128, 0.22)';
        ctx.fillRect(230, 155, 100, 36);
        ctx.strokeStyle = '#4ADE80';
        ctx.strokeRect(230, 155, 100, 36);
        ctx.fillStyle = '#86EFAC';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('PULL WINDOW', 246, 176);

        const ballY = 28 + s.deliveryProg * 195;
        const radius = 5 + s.deliveryProg * 7;
        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.arc(280, ballY, radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (activeDrill === 'spin_control') {
        // Apply wind drift + keyboard nudges
        s.aimX += s.windVx * 0.45;
        s.aimY += s.windVy * 0.45;
        if (s.keys['ArrowLeft'] || s.keys['a']) s.aimX -= 4;
        if (s.keys['ArrowRight'] || s.keys['d']) s.aimX += 4;
        if (s.keys['ArrowUp'] || s.keys['w']) s.aimY -= 4;
        if (s.keys['ArrowDown'] || s.keys['s']) s.aimY += 4;
        s.aimX = Math.max(40, Math.min(canvas.width - 40, s.aimX));
        s.aimY = Math.max(30, Math.min(canvas.height - 30, s.aimY));

        // Rough target patch
        ctx.fillStyle = 'rgba(234, 179, 8, 0.25)';
        ctx.beginPath();
        ctx.arc(s.patchX, s.patchY, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#EAB308';
        ctx.stroke();

        // Crosshair
        ctx.strokeStyle = '#93E6EE';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.aimX, s.aimY, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.aimX - 18, s.aimY);
        ctx.lineTo(s.aimX + 18, s.aimY);
        ctx.moveTo(s.aimX, s.aimY - 18);
        ctx.lineTo(s.aimX, s.aimY + 18);
        ctx.stroke();
      }

      if (s.feedbackAge > 0) {
        s.feedbackAge -= 1;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(s.feedback, 20, 32);
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onPointerMove);
      canvas.removeEventListener('click', onCanvasClick);
    };
  }, [running, activeDrill]);

  if (!myTeam) {
    return (
      <div className="cm27-panel p-10 text-center space-y-2">
        <Dumbbell className="w-8 h-8 text-[#93E6EE] mx-auto" />
        <h2 className="font-condensed text-2xl font-bold text-white uppercase">
          Claim a Franchise to Unlock Training Ground
        </h2>
        <p className="text-xs text-slate-400">
          Assign your manager seat in the Teams tab to run specialized player skill drills.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="cm27-panel p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#93E6EE]">
            HIGH-PERFORMANCE CENTER · {myTeam.name}
          </div>
          <h1 className="font-condensed text-3xl sm:text-4xl font-extrabold text-white uppercase leading-none mt-1">
            TRAINING GROUND &amp; SKILL LAB
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            ₹20L per drill · -10% Stamina · Complete 3 drills to unlock a permanent Broadcast Trait badge.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
          <div className="cm27-panel-inset px-3.5 py-2">
            <span className="text-slate-400">DAY {currentDay} SLOTS: </span>
            <strong className={slotsRemaining > 0 ? 'text-[#4ADE80]' : 'text-rose-400'}>
              {slotsRemaining} / 2 REMAINING
            </strong>
          </div>
          <div className="cm27-panel-inset px-3.5 py-2">
            <span className="text-slate-400">PURSE: </span>
            <strong className="text-[#EAB308]">
              {formatCurrencyLakhs(myTeam.remainingBudget, currency)}
            </strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Contracted Squad Selector */}
        <div className="lg:col-span-5 cm27-panel overflow-hidden">
          <div className="px-4 py-3 bg-[#0C0F14] border-b border-white/[0.08] flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-semibold">
              Select Contracted Player ({squad.length})
            </span>
            <span className="text-[10px] font-mono text-slate-500">OVR · STA · DRILLS</span>
          </div>

          {loadingSquad ? (
            <div className="p-8 text-center text-xs font-mono text-slate-400">
              Loading contracted squad...
            </div>
          ) : squad.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Acquire players in the Live Auction Room first.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05] max-h-[540px] overflow-y-auto p-1.5">
              {squad.map((p) => {
                const { ovr } = formatOvrWithDelta(p);
                const selected = p.id === selectedPlayer?.id;
                const injured = (p.injuryGamesRemaining ?? 0) > 0;
                const stamina = p.stamina ?? 100;
                const drillsDone = p.drillsCompleted ?? 0;

                return (
                  <button
                    key={p.id}
                    onClick={() => !running && setSelectedPlayerId(p.id)}
                    className={`w-full px-3 py-2.5 rounded flex items-center justify-between gap-2 text-left cursor-pointer transition-all ${
                      selected
                        ? 'cm27-card-focus'
                        : 'hover:bg-white/[0.03] border border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <CountryFlag country={p.country} size="xs" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{p.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {p.primaryRole} · Age {p.age}
                          {injured && (
                            <span className="text-rose-400 ml-1.5">
                              OUT {p.injuryGamesRemaining}G
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums shrink-0">
                      <span className="text-[#EAB308] font-bold">{ovr}</span>
                      <span
                        className={
                          stamina < 55
                            ? 'text-rose-400'
                            : stamina < 75
                              ? 'text-[#EAB308]'
                              : 'text-[#4ADE80]'
                        }
                      >
                        {stamina}%
                      </span>
                      <span className="text-[#93E6EE]" title="Drills toward next trait">
                        {drillsDone % 3}/3
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Drill Picker + Interactive Canvas */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {DRILLS.map((d) => {
              const active = d.id === activeDrill;
              return (
                <button
                  key={d.id}
                  disabled={running}
                  onClick={() => setActiveDrill(d.id)}
                  className={`p-3.5 rounded border text-left cursor-pointer transition-all disabled:opacity-60 ${
                    active
                      ? 'cm27-card-focus'
                      : 'cm27-panel-inset hover:border-white/25'
                  }`}
                >
                  <div className="text-xs font-bold text-white">{d.title}</div>
                  <div className="text-[11px] font-mono text-[#93E6EE] mt-0.5">
                    +{d.targetStat}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">{d.controlHint}</div>
                </button>
              );
            })}
          </div>

          <div className="cm27-panel p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#EAB308]" />
                  <span>{drillMeta.title}</span>
                  {selectedPlayer && (
                    <span className="text-[#93E6EE]">— {selectedPlayer.name}</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{drillMeta.instruction}</p>
              </div>

              <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <Timer className="w-3.5 h-3.5 text-[#93E6EE]" />
                  {timeLeft}s
                </span>
                <span className="text-[#EAB308] font-bold">
                  SCORE {liveScore} ({liveAttempts} tries)
                </span>
              </div>
            </div>

            <div className="relative rounded border border-white/10 overflow-hidden bg-[#0B1017] flex justify-center">
              <canvas
                ref={canvasRef}
                width={560}
                height={250}
                className="w-full max-w-[560px] h-[250px] block cursor-crosshair"
              />

              {!running && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center p-5 text-center space-y-3">
                  {lastResult ? (
                    <div className="space-y-2 max-w-md">
                      <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase text-[#4ADE80]">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {lastResult.success ? 'Drill Target Achieved' : 'Session Completed'}
                        </span>
                      </div>
                      <div className="font-condensed text-2xl font-extrabold text-white uppercase">
                        {lastResult.playerName} · Score {lastResult.score}
                      </div>
                      {lastResult.statChanges.length > 0 && (
                        <div className="text-xs font-mono text-[#93E6EE]">
                          Permanent Upgrade: {lastResult.statChanges.join(' · ')}
                        </div>
                      )}
                      {lastResult.unlockedTrait && (
                        <div className="p-2 rounded bg-[#13262B] border border-[#2DD4BF]/45 text-xs font-mono text-[#93E6EE] flex items-center justify-center gap-1.5">
                          <Award className="w-4 h-4 text-[#EAB308]" />
                          <span>New Broadcast Trait: {lastResult.unlockedTrait}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1 max-w-md">
                      <Sparkles className="w-6 h-6 text-[#93E6EE] mx-auto" />
                      <div className="font-condensed text-xl font-bold text-white uppercase">
                        Ready for {drillMeta.title}
                      </div>
                      <p className="text-xs text-slate-300">{drillMeta.controlHint}</p>
                    </div>
                  )}

                  <button
                    onClick={startDrill}
                    disabled={submitting || !selectedPlayer || slotsRemaining <= 0}
                    className="cm27-btn-3d px-6 py-2.5 rounded font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-45"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {submitting
                        ? 'Saving Progress...'
                        : slotsRemaining <= 0
                          ? 'Daily Limit Reached (2/2)'
                          : 'Start Drill (₹20L)'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {selectedPlayer && (selectedPlayer.traitsJson?.length || 0) > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] font-mono uppercase text-slate-400">
                  {selectedPlayer.name} Traits:
                </span>
                {selectedPlayer.traitsJson!.map((tr) => (
                  <span
                    key={tr}
                    className="px-2 py-0.5 rounded bg-[#13262B] border border-[#2DD4BF]/35 text-[10px] font-mono uppercase text-[#93E6EE]"
                  >
                    {tr}
                  </span>
                ))}
              </div>
            )}

            {selectedPlayer && (selectedPlayer.stamina ?? 100) < 55 && (
              <div className="p-2.5 rounded bg-rose-950/35 border border-rose-500/30 text-[11px] text-rose-200 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  {selectedPlayer.name} is fatigued ({selectedPlayer.stamina}% stamina). Leaving
                  him out of the next Playing XI recovers +22% stamina.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
